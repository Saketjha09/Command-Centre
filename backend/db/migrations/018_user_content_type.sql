BEGIN;
ALTER TABLE ops.users ADD COLUMN IF NOT EXISTS content_type ops.task_content_type;
COMMIT;