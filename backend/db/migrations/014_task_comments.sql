-- =============================================================================
-- Migration: 014_task_comments.sql
-- Description: Create ops.task_comments table for in-task discussion threads.
-- Scope: Schema only. No Go files touched in this migration.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- STEP 1: Create the task_comments table
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ops.task_comments (
    id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    task_id     UUID NOT NULL REFERENCES ops.tasks(id) ON DELETE CASCADE,
    author_id   UUID NOT NULL REFERENCES ops.users(id) ON DELETE CASCADE,
    body        TEXT NOT NULL CHECK (char_length(body) BETWEEN 1 AND 2000),
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- -----------------------------------------------------------------------------
-- STEP 2: Index for fetching comments by task, newest first
-- -----------------------------------------------------------------------------
CREATE INDEX IF NOT EXISTS idx_task_comments_task_created
ON ops.task_comments(task_id, created_at DESC);

COMMIT;
