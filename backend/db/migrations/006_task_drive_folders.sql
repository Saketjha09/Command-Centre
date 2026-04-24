-- Migration 006: Google Drive Folder Integration
-- Adds storage for the generated drive folder ID.

ALTER TABLE ops.tasks ADD COLUMN IF NOT EXISTS google_drive_folder_id TEXT;
