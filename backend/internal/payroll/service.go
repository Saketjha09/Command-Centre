package payroll

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"
)

func UpsertEditorRate(ctx context.Context, pool *pgxpool.Pool, editorID string, req UpsertRateRequest) error {
	if req.Rate < 0 {
		return fmt.Errorf("rate cannot be negative")
	}
	if req.ContentType != "script" && req.ContentType != "video_edit" && req.ContentType != "other" {
		return fmt.Errorf("invalid content type")
	}
	return upsertEditorRate(ctx, pool, editorID, req.ContentType, req.Rate)
}

func GetEditorRates(ctx context.Context, pool *pgxpool.Pool, editorID string) ([]EditorRate, error) {
	return getEditorRates(ctx, pool, editorID)
}

func GetAllEditorRates(ctx context.Context, pool *pgxpool.Pool) ([]EditorRate, error) {
	return getAllEditorRates(ctx, pool)
}

func PreviewPayroll(ctx context.Context, pool *pgxpool.Pool, req RunPayrollRequest) (PayrollRunDetail, error) {
	if req.PeriodStart == "" || req.PeriodEnd == "" {
		return PayrollRunDetail{}, fmt.Errorf("period start and end are required")
	}
	start, err := time.Parse("2006-01-02", req.PeriodStart)
	if err != nil {
		return PayrollRunDetail{}, fmt.Errorf("invalid period start format")
	}
	end, err := time.Parse("2006-01-02", req.PeriodEnd)
	if err != nil {
		return PayrollRunDetail{}, fmt.Errorf("invalid period end format")
	}
	if start.After(end) {
		return PayrollRunDetail{}, fmt.Errorf("period start must be before or equal to period end")
	}
	return previewPayroll(ctx, pool, req.EditorID, req.PeriodStart, req.PeriodEnd)
}

func CreatePayrollRun(ctx context.Context, pool *pgxpool.Pool, req RunPayrollRequest, createdBy string) (PayrollRun, error) {
	if req.PeriodStart == "" || req.PeriodEnd == "" {
		return PayrollRun{}, fmt.Errorf("period start and end are required")
	}
	start, err := time.Parse("2006-01-02", req.PeriodStart)
	if err != nil {
		return PayrollRun{}, fmt.Errorf("invalid period start format")
	}
	end, err := time.Parse("2006-01-02", req.PeriodEnd)
	if err != nil {
		return PayrollRun{}, fmt.Errorf("invalid period end format")
	}
	if start.After(end) {
		return PayrollRun{}, fmt.Errorf("period start must be before or equal to period end")
	}
	return createPayrollRun(ctx, pool, req.EditorID, req.PeriodStart, req.PeriodEnd, createdBy)
}

func MarkPaid(ctx context.Context, pool *pgxpool.Pool, runID string) (PayrollRun, error) {
	return markPaid(ctx, pool, runID)
}

func GetPayrollRuns(ctx context.Context, pool *pgxpool.Pool, editorID string) ([]PayrollRun, error) {
	return getPayrollRuns(ctx, pool, editorID)
}

func GetPayrollRunDetail(ctx context.Context, pool *pgxpool.Pool, runID string) (PayrollRunDetail, error) {
	return getPayrollRunDetail(ctx, pool, runID)
}
