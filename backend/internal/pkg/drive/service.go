package drive

import (
	"context"
	"encoding/base64"
	"fmt"
	"time"

	"golang.org/x/oauth2/google"
	"google.golang.org/api/drive/v3"
	"google.golang.org/api/option"

	"github.com/saket/command-center/backend/pkg/config"
)

// EnsureTaskFolder creates a folder on Google Drive for a specific task.
// It also shares the folder with the configured team email so it is visible to humans.
func EnsureTaskFolder(cfg *config.Config, brandName, taskTitle, taskId string) (string, error) {
	if cfg.GoogleServiceAccountJSON == "" {
		return "", nil // Skip if not configured
	}

	keyJSON, err := base64.StdEncoding.DecodeString(cfg.GoogleServiceAccountJSON)
	if err != nil {
		return "", fmt.Errorf("drive: decode service account key: %w", err)
	}

	ctx, cancel := context.WithTimeout(context.Background(), 20*time.Second)
	defer cancel()

	creds, err := google.CredentialsFromJSON(ctx, keyJSON, drive.DriveFileScope)
	if err != nil {
		return "", fmt.Errorf("drive: parse credentials: %w", err)
	}

	srv, err := drive.NewService(ctx, option.WithCredentials(creds))
	if err != nil {
		return "", fmt.Errorf("drive: create service: %w", err)
	}

	// 1. Create the Folder
	folderName := fmt.Sprintf("[%s] %s (ID: %s)", brandName, taskTitle, taskId)
	folder := &drive.File{
		Name:     folderName,
		MimeType: "application/vnd.google-apps.folder",
	}

	if cfg.GoogleDriveParentID != "" {
		folder.Parents = []string{cfg.GoogleDriveParentID}
	}

	createdFolder, err := srv.Files.Create(folder).Fields("id").Context(ctx).Do()
	if err != nil {
		return "", fmt.Errorf("drive: create folder: %w", err)
	}

	// 2. Explicit Sharing (The "Ghost Folder" Fix)
	// If a share email is provided, grant "writer" access to it.
	if cfg.GoogleDriveShareEmail != "" {
		permission := &drive.Permission{
			Type:         "user",
			Role:         "writer",
			EmailAddress: cfg.GoogleDriveShareEmail,
		}
		_, err = srv.Permissions.Create(createdFolder.Id, permission).Context(ctx).Do()
		if err != nil {
			// We log but don't fail the whole operation if sharing fails, 
			// though the user might not see it yet.
			fmt.Printf("drive: warning: failed to share folder %s with %s: %v\n", createdFolder.Id, cfg.GoogleDriveShareEmail, err)
		}
	}

	return createdFolder.Id, nil
}
