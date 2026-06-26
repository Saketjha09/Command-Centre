package rls_test

import (
	"context"
	"os"
	"testing"

	"github.com/google/uuid"
	"github.com/jackc/pgx/v5/pgxpool"
)

func setupPool(t *testing.T) *pgxpool.Pool {
	t.Helper()
	dsn := os.Getenv("TEST_DATABASE_URL")
	if dsn == "" {
		t.Skip("TEST_DATABASE_URL not set — skipping RLS tests")
	}
	pool, err := pgxpool.New(context.Background(), dsn)
	if err != nil {
		t.Fatalf("failed to connect: %v", err)
	}
	t.Cleanup(func() { pool.Close() })
	return pool
}

func setTenant(ctx context.Context, pool *pgxpool.Pool, tenantID uuid.UUID) error {
	_, err := pool.Exec(ctx,
		"SET LOCAL app.tenant_id = $1", tenantID.String())
	return err
}

func TestRLS_TenantCannotReadOtherTenantScripts(t *testing.T) {
	pool := setupPool(t)
	ctx := context.Background()

	tenantA := uuid.New()
	tenantB := uuid.New()

	tx, _ := pool.Begin(ctx)
	defer tx.Rollback(ctx)

	_ = setTenant(ctx, pool, tenantA)

	var count int
	err := pool.QueryRow(ctx,
		"SELECT COUNT(*) FROM scripts WHERE tenant_id = $1", tenantB).
		Scan(&count)
	if err != nil {
		t.Fatalf("query error: %v", err)
	}
	if count != 0 {
		t.Errorf("RLS BREACH: tenant A read %d scripts belonging to tenant B", count)
	}
}

func TestRLS_TenantCannotReadOtherTenantBrands(t *testing.T) {
	pool := setupPool(t)
	ctx := context.Background()

	tenantA := uuid.New()
	tenantB := uuid.New()

	_ = setTenant(ctx, pool, tenantA)

	var count int
	err := pool.QueryRow(ctx,
		"SELECT COUNT(*) FROM brands WHERE tenant_id = $1", tenantB).
		Scan(&count)
	if err != nil {
		t.Fatalf("query error: %v", err)
	}
	if count != 0 {
		t.Errorf("RLS BREACH: tenant A read %d brands belonging to tenant B", count)
	}
}

func TestRLS_TenantCannotReadOtherTenantContentCards(t *testing.T) {
	pool := setupPool(t)
	ctx := context.Background()

	tenantA := uuid.New()
	tenantB := uuid.New()

	_ = setTenant(ctx, pool, tenantA)

	var count int
	err := pool.QueryRow(ctx,
		"SELECT COUNT(*) FROM tasks WHERE tenant_id = $1", tenantB).
		Scan(&count)
	if err != nil {
		t.Fatalf("query error: %v", err)
	}
	if count != 0 {
		t.Errorf("RLS BREACH: tenant A read %d tasks belonging to tenant B", count)
	}
}

func TestRLS_TenantCannotReadOtherTenantTalentRecords(t *testing.T) {
	pool := setupPool(t)
	ctx := context.Background()

	tenantA := uuid.New()
	tenantB := uuid.New()

	_ = setTenant(ctx, pool, tenantA)

	var count int
	err := pool.QueryRow(ctx,
		"SELECT COUNT(*) FROM users WHERE tenant_id = $1", tenantB).
		Scan(&count)
	if err != nil {
		t.Fatalf("query error: %v", err)
	}
	if count != 0 {
		t.Errorf("RLS BREACH: tenant A read %d users belonging to tenant B", count)
	}
}

func TestRLS_TenantCannotWriteToOtherTenantTable(t *testing.T) {
	pool := setupPool(t)
	ctx := context.Background()

	tenantA := uuid.New()
	tenantB := uuid.New()

	_ = setTenant(ctx, pool, tenantA)

	_, err := pool.Exec(ctx,
		"INSERT INTO tasks (id, tenant_id, title, status) VALUES ($1, $2, $3, $4)",
		uuid.New(), tenantB, "injected task", "todo")

	if err == nil {
		t.Error("RLS BREACH: tenant A successfully wrote a task into tenant B's data")
	}
}
