DO $$ BEGIN
    CREATE TYPE ops.task_content_type AS ENUM ('script', 'video_edit', 'other');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE ops.tasks ADD COLUMN IF NOT EXISTS content_type ops.task_content_type;
