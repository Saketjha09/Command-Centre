-- Migration: 007_task_sheets_sync.sql
-- Description: Add sync_failed flag and payout_amount for ledger integration.

ALTER TABLE ops.tasks ADD COLUMN IF NOT EXISTS sync_failed BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE ops.tasks ADD COLUMN IF NOT EXISTS payout_amount NUMERIC(10,2) DEFAULT 0.00;
