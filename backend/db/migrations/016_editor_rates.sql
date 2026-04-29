BEGIN;
CREATE TABLE ops.editor_rates (
    editor_id    UUID                    NOT NULL REFERENCES ops.users(id) ON DELETE CASCADE,
    content_type ops.task_content_type   NOT NULL,
    rate         NUMERIC(10,2)           NOT NULL CHECK (rate >= 0),
    updated_at   TIMESTAMPTZ             NOT NULL DEFAULT now(),
    PRIMARY KEY (editor_id, content_type)
);
COMMIT;
