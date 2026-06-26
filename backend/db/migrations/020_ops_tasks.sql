-- Phase 1 Ops Dashboard: lightweight task assignment table
-- Separate from ops.tasks (kanban board) — this is for simple assign→progress→done workflows.

CREATE TYPE ops.ops_task_status AS ENUM ('assigned', 'in_progress', 'done');

CREATE TABLE ops.ops_tasks (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    brand_id        UUID REFERENCES ops.brands(id) ON DELETE SET NULL,
    brand_name      TEXT NOT NULL,
    brief           TEXT NOT NULL,
    sheet_link      TEXT,
    assignee_id     UUID NOT NULL REFERENCES ops.users(id) ON DELETE CASCADE,
    assignee_name   TEXT NOT NULL,
    assignee_role   TEXT NOT NULL,
    created_by_id   UUID NOT NULL REFERENCES ops.users(id) ON DELETE CASCADE,
    created_by_name TEXT NOT NULL,
    status          ops.ops_task_status NOT NULL DEFAULT 'assigned',
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_ops_tasks_assignee_id ON ops.ops_tasks(assignee_id);
CREATE INDEX idx_ops_tasks_status      ON ops.ops_tasks(status);
CREATE INDEX idx_ops_tasks_brand_id    ON ops.ops_tasks(brand_id);
CREATE INDEX idx_ops_tasks_created_at  ON ops.ops_tasks(created_at DESC);
