-- Migration: 009_auth_audit_logs.sql
-- Description: Add audit logs for auth actions.

CREATE TABLE IF NOT EXISTS ops.auth_audit_logs (
    id          UUID        NOT NULL DEFAULT gen_random_uuid(),
    actor_id    UUID        NOT NULL,
    action      TEXT        NOT NULL,
    target_id   UUID        NOT NULL,
    metadata    JSONB,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT auth_audit_logs_pkey PRIMARY KEY (id),
    CONSTRAINT auth_audit_logs_actor_id_fkey FOREIGN KEY (actor_id)
        REFERENCES ops.users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS auth_audit_logs_actor_id_idx ON ops.auth_audit_logs (actor_id);
CREATE INDEX IF NOT EXISTS auth_audit_logs_target_id_idx ON ops.auth_audit_logs (target_id);
