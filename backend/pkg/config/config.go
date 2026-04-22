// Package config loads and validates application configuration from environment
// variables. A missing required variable is a hard fatal error — the process
// must not start in a misconfigured state.
package config

import (
	"fmt"
	"os"
	"strings"
)

// Config holds all runtime configuration for the API server.
type Config struct {
	// DatabaseDSN is the full PostgreSQL connection string.
	// Example (local dev only — use sslmode=require in production):
	// postgres://user:pass@localhost:5432/command_center?sslmode=disable
	DatabaseDSN string

	// JWTSecret is the HMAC signing secret for access tokens.
	// Must be at least 32 bytes of high-entropy random data in production.
	JWTSecret string

	// Port is the TCP port the HTTP server will listen on (e.g. "8080").
	Port string

	// SlackBotToken is the OAuth bot token used to post Slack messages.
	// Required — the notification system cannot function without it.
	SlackBotToken string

	// SlackChannelID is the default channel for broadcast messages.
	// Required — used by SendChannelMessage.
	SlackChannelID string

	// GoogleSheetsID is the spreadsheet ID for payroll sync.
	// Optional — if empty, AppendPayrollRow is a no-op.
	GoogleSheetsID string

	// GoogleServiceAccountJSON is the base64-encoded service account key.
	// Optional — if empty, Sheets sync is skipped entirely.
	GoogleServiceAccountJSON string
	// GOEnv is the operating environment, either "development" or "production".
	GOEnv string

	// AllowedOrigins restricts access for the CORS middleware.
	AllowedOrigins string
}

// Load reads configuration from environment variables and returns a validated
// *Config. It returns a descriptive error listing all missing variables so that
// operators can fix every problem in a single restart cycle.
func Load() (*Config, error) {
	cfg := &Config{
		DatabaseDSN:              os.Getenv("DATABASE_DSN"),
		JWTSecret:                os.Getenv("JWT_SECRET"),
		Port:                     os.Getenv("PORT"),
		SlackBotToken:            os.Getenv("SLACK_BOT_TOKEN"),
		SlackChannelID:           os.Getenv("SLACK_CHANNEL_ID"),
		GoogleSheetsID:           os.Getenv("GOOGLE_SHEETS_ID"),
		GoogleServiceAccountJSON: os.Getenv("GOOGLE_SERVICE_ACCOUNT_JSON"),
		GOEnv:                    os.Getenv("GO_ENV"),
		AllowedOrigins:           os.Getenv("ALLOWED_ORIGINS"),
	}

	if cfg.GOEnv == "" {
		cfg.GOEnv = "development"
	}

	if cfg.GOEnv != "production" && cfg.AllowedOrigins == "" {
		cfg.AllowedOrigins = "http://localhost:5173,http://localhost:5174"
	}

	var missing []string

	if strings.TrimSpace(cfg.DatabaseDSN) == "" {
		missing = append(missing, "DATABASE_DSN")
	}
	if strings.TrimSpace(cfg.JWTSecret) == "" {
		missing = append(missing, "JWT_SECRET")
	}
	if strings.TrimSpace(cfg.Port) == "" {
		missing = append(missing, "PORT")
	}
	if strings.TrimSpace(cfg.SlackBotToken) == "" {
		missing = append(missing, "SLACK_BOT_TOKEN")
	}
	if strings.TrimSpace(cfg.SlackChannelID) == "" {
		missing = append(missing, "SLACK_CHANNEL_ID")
	}
	
	if cfg.GOEnv == "production" {
		if strings.TrimSpace(cfg.AllowedOrigins) == "" {
			missing = append(missing, "ALLOWED_ORIGINS")
		}
		if strings.Contains(cfg.DatabaseDSN, "sslmode=disable") {
			return nil, fmt.Errorf("config: DATABASE_DSN must not contain sslmode=disable in production")
		}
	}

	if len(missing) > 0 {
		return nil, fmt.Errorf(
			"config: missing required environment variable(s): %s",
			strings.Join(missing, ", "),
		)
	}

	if len(strings.TrimSpace(cfg.JWTSecret)) < 32 {
		return nil, fmt.Errorf("config: JWT_SECRET must be at least 32 characters")
	}

	// Normalise: strip any ":" prefix users might accidentally add.
	cfg.Port = strings.TrimPrefix(cfg.Port, ":")

	return cfg, nil
}
