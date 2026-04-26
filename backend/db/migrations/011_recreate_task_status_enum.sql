BEGIN;

-- 1. Update data in ops.tasks to remove values being dropped/split
UPDATE ops.tasks SET status = 'done' WHERE status IN ('paid', 'approved');
UPDATE ops.tasks SET status = 'in_review' WHERE status = 'review';
UPDATE ops.tasks SET status = 'assigned' 
  WHERE status = 'brief_pending' AND assigned_to IS NOT NULL;
UPDATE ops.tasks SET status = 'unassigned' 
  WHERE status = 'brief_pending' AND assigned_to IS NULL;

-- 2. Update data in ops.task_history (TEXT columns)
UPDATE ops.task_history SET from_value = 'done' WHERE from_value IN ('paid', 'approved');
UPDATE ops.task_history SET to_value = 'done' WHERE to_value IN ('paid', 'approved');

UPDATE ops.task_history SET from_value = 'in_review' WHERE from_value = 'review';
UPDATE ops.task_history SET to_value = 'in_review' WHERE to_value = 'review';

UPDATE ops.task_history SET from_value = 'unassigned' WHERE from_value = 'brief_pending';
UPDATE ops.task_history SET to_value = 'unassigned' WHERE to_value = 'brief_pending';

-- 3. Recreate enum with correct values only
CREATE TYPE ops.task_status_new AS ENUM (
  'unassigned', 
  'assigned', 
  'in_progress', 
  'in_review', 
  'done'
);

-- 4. Migrate tasks.status column to new type
ALTER TABLE ops.tasks ALTER COLUMN status DROP DEFAULT;
ALTER TABLE ops.tasks 
  ALTER COLUMN status TYPE ops.task_status_new 
  USING status::text::ops.task_status_new;

-- 5. Clean up old type
DROP TYPE ops.task_status;
ALTER TYPE ops.task_status_new RENAME TO task_status;

-- 6. Set new default
ALTER TABLE ops.tasks 
  ALTER COLUMN status SET DEFAULT 'unassigned';

COMMIT;
