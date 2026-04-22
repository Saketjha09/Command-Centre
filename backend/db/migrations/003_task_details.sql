-- Migration: 003_task_details.sql
-- Description: Add description and priority to tasks.

DO $$ BEGIN
    CREATE TYPE ops.task_priority AS ENUM ('low', 'medium', 'high', 'urgent');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE ops.tasks ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE ops.tasks ADD COLUMN IF NOT EXISTS priority ops.task_priority NOT NULL DEFAULT 'medium';
