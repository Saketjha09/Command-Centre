package ai

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

const (
	DailyBudgetUSD      = 5.00
	SoftLimitPercentage = 0.80
)

var ErrDailyBudgetExceeded = fmt.Errorf("daily AI budget exceeded — try again tomorrow")

type UsageMiddleware struct {
	pool *pgxpool.Pool
}

func NewUsageMiddleware(pool *pgxpool.Pool) *UsageMiddleware {
	return &UsageMiddleware{pool: pool}
}

type UsageRecord struct {
	UserID       uuid.UUID
	Provider     string
	Model        string
	Feature      string
	InputTokens  int
	OutputTokens int
	CostUSD      float64
}

func (m *UsageMiddleware) CheckBudget(ctx context.Context, userID uuid.UUID) (exceeded bool, usedUSD float64, err error) {
	today := time.Now().UTC().Truncate(24 * time.Hour)
	row := m.pool.QueryRow(ctx,
		`SELECT COALESCE(SUM(cost_usd), 0)
         FROM ops.ai_usage_log
         WHERE user_id = $1 AND created_at >= $2`,
		userID, today)
	if err = row.Scan(&usedUSD); err != nil {
		return false, 0, fmt.Errorf("budget check failed: %w", err)
	}
	exceeded = usedUSD >= DailyBudgetUSD
	return exceeded, usedUSD, nil
}

func (m *UsageMiddleware) LogUsage(ctx context.Context, rec UsageRecord) error {
	_, err := m.pool.Exec(ctx,
		`INSERT INTO ops.ai_usage_log
            (user_id, provider, model, feature,
             input_tokens, output_tokens, cost_usd)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
		rec.UserID, rec.Provider, rec.Model,
		rec.Feature, rec.InputTokens, rec.OutputTokens, rec.CostUSD)
	if err != nil {
		slog.Error("ai_usage_log_failed",
			"user_id", rec.UserID,
			"feature", rec.Feature,
			"error", err)
		return fmt.Errorf("usage log failed: %w", err)
	}
	return nil
}

func (m *UsageMiddleware) CallWithBudget(
	ctx context.Context,
	userID uuid.UUID,
	feature string,
	call func() (*UsageRecord, error),
) (*UsageRecord, error) {
	exceeded, usedUSD, err := m.CheckBudget(ctx, userID)
	if err != nil {
		return nil, err
	}
	if exceeded {
		slog.Warn("ai_budget_exceeded",
			"user_id", userID,
			"used_usd", usedUSD,
			"limit_usd", DailyBudgetUSD)
		return nil, ErrDailyBudgetExceeded
	}
	if usedUSD >= DailyBudgetUSD*SoftLimitPercentage {
		slog.Warn("ai_budget_soft_limit",
			"user_id", userID,
			"used_usd", usedUSD,
			"soft_limit_usd", DailyBudgetUSD*SoftLimitPercentage)
	}
	rec, err := call()
	if err != nil {
		return nil, err
	}
	if logErr := m.LogUsage(ctx, *rec); logErr != nil {
		slog.Error("ai_usage_log_error", "error", logErr)
	}
	return rec, nil
}
