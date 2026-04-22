-- =============================================================================
-- Migration: 002_task_history_and_avatars.sql
-- Description: Add task history tracking and user avatar support.
-- =============================================================================

-- Add avatar_url to users
ALTER TABLE ops.users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Create task_history table
CREATE TABLE IF NOT EXISTS ops.task_history (
    id          UUID        NOT NULL DEFAULT gen_random_uuid(),
    task_id     UUID        NOT NULL,
    user_id     UUID        NOT NULL,
    action      TEXT        NOT NULL,
    from_value  TEXT,
    to_value    TEXT,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT task_history_pkey         PRIMARY KEY (id),
    CONSTRAINT task_history_task_id_fkey FOREIGN KEY (task_id)
        REFERENCES ops.tasks (id) ON DELETE CASCADE,
    CONSTRAINT task_history_user_id_fkey FOREIGN KEY (user_id)
        REFERENCES ops.users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS task_history_task_id_idx ON ops.task_history (task_id);
