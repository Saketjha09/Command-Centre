// Package sheets provides Google Sheets integration for payroll sync.
// The integration is optional — if GoogleSheetsID or GoogleServiceAccountJSON
// is empty in config, all operations are silent no-ops.
package sheets

import (
	"context"
	"encoding/base64"
	"fmt"
	"time"

	"golang.org/x/oauth2/google"
	"google.golang.org/api/option"
	sheetsv4 "google.golang.org/api/sheets/v4"

	"github.com/saket/command-center/backend/pkg/config"
)

// AppendPayrollRow appends a single row to the named sheet tab in the
// configured Google Spreadsheet.
//
// If GoogleSheetsID or GoogleServiceAccountJSON is empty, this is a silent
// no-op — returns nil immediately. This makes the Sheets integration
// optional in dev environments where no service account is configured.
//
// Row format: [period, userID, userName, taskCount, totalAmount]
func AppendPayrollRow(
	cfg *config.Config,
	sheetName, userID, userName string,
	taskCount int,
	totalAmount float64,
	period string,
) error {
	// Optional config — skip sync if not configured.
	if cfg.GoogleSheetsID == "" || cfg.GoogleServiceAccountJSON == "" {
		return nil
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

	// Build the row data.
	row := &sheetsv4.ValueRange{
		Values: [][]interface{}{
			{period, userID, userName, taskCount, totalAmount},
		},
	}

	// Append to the named sheet tab. INSERT_ROWS guarantees we never
	// overwrite existing data. USER_ENTERED preserves any formulas in
	// the sheet.
	_, err = srv.Spreadsheets.Values.Append(
		cfg.GoogleSheetsID,
		sheetName,
		row,
	).
		ValueInputOption("USER_ENTERED").
		InsertDataOption("INSERT_ROWS").
		Context(ctx).
		Do()

	if err != nil {
		return fmt.Errorf("sheets: append row: %w", err)
	}

	return nil
}
