BEGIN;

CREATE TYPE ops.payroll_status AS ENUM ('pending', 'paid');

CREATE TABLE ops.payroll_runs (
    id            UUID                NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    editor_id     UUID                NOT NULL REFERENCES ops.users(id),
    period_start  DATE                NOT NULL,
    period_end    DATE                NOT NULL,
    task_count    INT                 NOT NULL DEFAULT 0,
    total_amount  NUMERIC(10,2)       NOT NULL DEFAULT 0,
    status        ops.payroll_status  NOT NULL DEFAULT 'pending',
    paid_at       TIMESTAMPTZ,
    created_by    UUID                NOT NULL REFERENCES ops.users(id),
    created_at    TIMESTAMPTZ         NOT NULL DEFAULT now()
);

-- Snapshot table: locks in rate per task at the moment the run is created
-- Rates themselves are NOT frozen — this just records what was calculated
CREATE TABLE ops.payroll_run_tasks (
    run_id        UUID            NOT NULL REFERENCES ops.payroll_runs(id) ON DELETE CASCADE,
    task_id       UUID            NOT NULL REFERENCES ops.tasks(id),
    rate_applied  NUMERIC(10,2)   NOT NULL,
    amount        NUMERIC(10,2)   NOT NULL,
    PRIMARY KEY (run_id, task_id)
);

COMMIT;
