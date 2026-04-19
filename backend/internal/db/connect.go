// Package db provides the PostgreSQL connection pool used by all internal
// packages. It is intentionally thin: no ORM, no query builder — just a
// configured pgxpool that callers obtain and use directly with raw SQL.
package db

import (
	"context"
	"fmt"
	"time"

	"github.com/jackc/pgx/v5/pgxpool"

	"github.com/saket/command-center/backend/pkg/config"
)

// Connect creates and validates a *pgxpool.Pool from the supplied Config.
//
// Pool is bounded to MaxConns=25 to prevent runaway connection exhaustion on a
// shared Postgres instance. If the host is unreachable at startup the error is
// wrapped and returned so the caller can log.Fatal rather than silently
// proceeding with a broken pool.
func Connect(cfg *config.Config) (*pgxpool.Pool, error) {
	poolCfg, err := pgxpool.ParseConfig(cfg.DatabaseDSN)
	if err != nil {
		return nil, fmt.Errorf("db: parse DSN: %w", err)
	}

	// Hard cap: 25 concurrent connections to PostgreSQL.
	poolCfg.MaxConns = 25

	// Eagerly drop connections that have idled for more than 30 minutes so
	// Postgres does not accumulate stale backends.
	poolCfg.MaxConnIdleTime = 30 * time.Minute

	pool, err := pgxpool.NewWithConfig(context.Background(), poolCfg)
	if err != nil {
		return nil, fmt.Errorf("db: create pool: %w", err)
	}

	// Validate connectivity at startup with a strict 5-second budget.
	pingCtx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
	defer cancel()

	if err := pool.Ping(pingCtx); err != nil {
		pool.Close()
		return nil, fmt.Errorf("db: ping failed (is Postgres running?): %w", err)
	}

	return pool, nil
}
