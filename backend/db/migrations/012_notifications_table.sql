-- Migration: 012_notifications_table.sql
-- Description: Create ops.notifications table for in-app alerts

CREATE TABLE IF NOT EXISTS ops.notifications (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id    UUID NOT NULL REFERENCES ops.users(id) ON DELETE CASCADE,
    type            TEXT NOT NULL,
    title           TEXT NOT NULL,
    message         TEXT NOT NULL,
    related_task_id UUID REFERENCES ops.tasks(id) ON DELETE SET NULL,
    is_read         BOOLEAN NOT NULL DEFAULT FALSE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Fast unread count lookup for badge notifications
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread 
ON ops.notifications(recipient_id, is_read) 
WHERE is_read = FALSE;

-- Fast feed fetching sorted by newest first
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_created 
ON ops.notifications(recipient_id, created_at DESC);
