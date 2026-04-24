package sheets

import (
	"context"
	"encoding/base64"
	"fmt"
	"log"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
	"github.com/saket/command-center/backend/pkg/config"
	"golang.org/x/oauth2/google"
	"google.golang.org/api/option"
	sheetsv4 "google.golang.org/api/sheets/v4"
)

// AppendTallyRow appends a single row to a Google Sheet.
// It uses "USER_ENTERED" so formulas in the sheet are preserved and "INSERT_ROWS"
// to ensure no data is overwritten.
func AppendTallyRow(cfg *config.Config, spreadsheetID, targetRange string, data []any) error {
	if cfg.GoogleServiceAccountJSON == "" {
		return fmt.Errorf("sheets: service account JSON not configured")
	}

	// Decode the base64-encoded service account JSON key.
	keyJSON, err := base64.StdEncoding.DecodeString(cfg.GoogleServiceAccountJSON)
	if err != nil {
		return fmt.Errorf("sheets: decode service account key: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 15*time.Second)
	defer cancel()

	// Authenticate with Google using the service account.
	creds, err := google.CredentialsFromJSON(ctx, keyJSON, sheetsv4.SpreadsheetsScope)
	if err != nil {
		return fmt.Errorf("sheets: parse credentials: %w", err)
	}

	srv, err := sheetsv4.NewService(ctx, option.WithCredentials(creds))
	if err != nil {
		return fmt.Errorf("sheets: create service: %w", err)
	}

	row := &sheetsv4.ValueRange{
		Values: [][]interface{}{data},
	}

	_, err = srv.Spreadsheets.Values.Append(spreadsheetID, targetRange, row).
		ValueInputOption("USER_ENTERED").
		InsertDataOption("INSERT_ROWS").
		Context(ctx).
		Do()

	if err != nil {
		return fmt.Errorf("sheets: append row: %w", err)
	}

	return nil
}

// DispatchTallySync handles the Sheets API call in a non-blocking goroutine.
// If it fails, it updates the task in PostgreSQL with sync_failed = true.
func DispatchTallySync(pool *pgxpool.Pool, cfg *config.Config, taskID string, data []any) {
	go func() {
		// Use the configured GoogleSheetsID (Master Ledger)
		err := AppendTallyRow(cfg, cfg.GoogleSheetsID, "Ledger!A1", data)
		if err != nil {
			log.Printf("sheets: sync failed for task %s: %v", taskID, err)
			
			// Mark as failed in DB for later retry
			_, dbErr := pool.Exec(context.Background(), "UPDATE ops.tasks SET sync_failed = true WHERE id = $1", taskID)
			if dbErr != nil {
				log.Printf("sheets: failed to update sync_failed flag for task %s: %v", taskID, dbErr)
			}
			return
		}
		
		log.Printf("sheets: successfully synced tally for task %s", taskID)
		
		// If it was previously failed, clear the flag
		_, _ = pool.Exec(context.Background(), "UPDATE ops.tasks SET sync_failed = false WHERE id = $1", taskID)
	}()
}
