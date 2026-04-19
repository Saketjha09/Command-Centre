// Package payroll implements monthly tally computation and freelancer payout
// notifications. rate_multiplier is read from the DB for internal payroll
// calculations but is NEVER exposed in any Slack message, HTTP response, or log.
package payroll

import (
	"context"
	"fmt"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/saket/command-center/backend/internal/notifications"
	"github.com/saket/command-center/backend/pkg/config"
)

// freelancerRow holds the fields fetched for each freelancer during tally.
// rate_multiplier is internal-only — used only for future payment arithmetic,
// never in any Slack message text, HTTP response, or log output.
type freelancerRow struct {
	ID             string
	Name           string
	SlackUserID    *string // nullable — some users may not have Slack linked
	RateMultiplier float64
}

// GetMonthlyTally returns the count of approved tasks for a user in a given
// calendar month.
func GetMonthlyTally(pool *pgxpool.Pool, userID string, year, month int) (int, error) {
	ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	var count int
	err := pool.QueryRow(ctx, `
		SELECT COUNT(*) FROM ops.tasks
		WHERE assigned_to = $1
		  AND status = 'approved'
		  AND EXTRACT(YEAR FROM updated_at) = $2
		  AND EXTRACT(MONTH FROM updated_at) = $3`,
		userID, year, month,
	).Scan(&count)

	if err != nil {
		return 0, fmt.Errorf("payroll: tally for %s (%d/%d): %w", userID, month, year, err)
	}
	return count, nil
}

// DispatchMonthEndTallies fires a goroutine that:
//  1. Fetches all freelancers from ops.users.
//  2. Computes each freelancer's approved task count for the given month.
//  3. Sends a Slack DM with the tally details.
//
// On any Slack error: logs it and continues to the next freelancer.
// The "Approve Tally" button flow and Sheets sync are Phase 5 features.
// This goroutine handles the DM only.
func DispatchMonthEndTallies(pool *pgxpool.Pool, cfg *config.Config, year, month int) {
	go func() {
		defer func() {
			if r := recover(); r != nil {
				log.Printf("payroll: panic recovered in DispatchMonthEndTallies: %v", r)
			}
		}()
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		// 1. Fetch all freelancers.
		rows, err := pool.Query(ctx, `
			SELECT id, name, slack_user_id, rate_multiplier
			FROM ops.users
			WHERE role = 'freelancer'
			ORDER BY name ASC`)
		if err != nil {
			log.Printf("payroll: fetch freelancers: %v", err)
			return
		}
		defer rows.Close()

		var freelancers []freelancerRow
		for rows.Next() {
			var f freelancerRow
			if err := rows.Scan(&f.ID, &f.Name, &f.SlackUserID, &f.RateMultiplier); err != nil {
				log.Printf("payroll: scan freelancer: %v", err)
				return
			}
			freelancers = append(freelancers, f)
		}
		if err := rows.Err(); err != nil {
			log.Printf("payroll: iterate freelancers: %v", err)
			return
		}

		monthName := time.Month(month).String()

		// 2. For each freelancer: compute tally + send DM.
		for _, f := range freelancers {
			count, err := GetMonthlyTally(pool, f.ID, year, month)
			if err != nil {
				log.Printf("payroll: tally for %s (%s): %v", f.ID, f.Name, err)
				continue
			}

			// Skip users without Slack linked — we can't DM them.
			if f.SlackUserID == nil {
				log.Printf("payroll: skipping %s (%s) — no slack_user_id", f.ID, f.Name)
				continue
			}

			msg := fmt.Sprintf(
				"Monthly tally for %s %d:\n"+
					"Approved tasks: %d\n"+
					"Reply APPROVE to confirm this tally.",
				monthName, year, count,
			)

			if err := notifications.SendDM(cfg, *f.SlackUserID, msg); err != nil {
				log.Printf("payroll: DM tally to %s (%s): %v", f.ID, f.Name, err)
				// Do not stop processing other freelancers.
				continue
			}
		}
	}()
}
