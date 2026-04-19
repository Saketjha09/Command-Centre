-- =============================================================================
-- Migration: 001_initial_schema.sql
-- Description: Bootstrap the ops schema with ENUMs, tables, and constraints.
-- Idempotent: All statements use IF NOT EXISTS.
-- =============================================================================

-- Enable pgcrypto for gen_random_uuid()
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- -----------------------------------------------------------------------------
-- Schema
-- -----------------------------------------------------------------------------
CREATE SCHEMA IF NOT EXISTS ops;

-- -----------------------------------------------------------------------------
-- ENUM Types
-- -----------------------------------------------------------------------------

DO $$ BEGIN
    CREATE TYPE ops.user_role AS ENUM ('superadmin', 'admin', 'freelancer');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE ops.task_status AS ENUM (
        'brief_pending',
        'in_progress',
        'review',
        'approved',
        'paid'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE ops.availability_slot AS ENUM ('day', 'evening', 'night');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
    CREATE TYPE ops.brand AS ENUM ('master_app', 'supernova_ai');
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- Table: ops.users
-- NOTE: rate_multiplier is intentionally excluded from any SELECT that is
--       returned to a client. This column is for internal payroll use only.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ops.users (
    id               UUID         NOT NULL DEFAULT gen_random_uuid(),
    name             TEXT         NOT NULL,
    email            TEXT         NOT NULL,
    hashed_password  TEXT         NOT NULL,
    role             ops.user_role NOT NULL,
    slack_user_id    TEXT,
    rate_multiplier  NUMERIC(4,2) NOT NULL DEFAULT 1.00,
    created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),

    CONSTRAINT users_pkey         PRIMARY KEY (id),
    CONSTRAINT users_email_unique UNIQUE (email)
);

-- -----------------------------------------------------------------------------
-- Table: ops.sessions
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ops.sessions (
    id                  UUID        NOT NULL DEFAULT gen_random_uuid(),
    user_id             UUID        NOT NULL,
    refresh_token_hash  TEXT        NOT NULL,
    expires_at          TIMESTAMPTZ NOT NULL,
    created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),

    CONSTRAINT sessions_pkey              PRIMARY KEY (id),
    CONSTRAINT sessions_user_id_fkey      FOREIGN KEY (user_id)
        REFERENCES ops.users (id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS sessions_user_id_idx ON ops.sessions (user_id);

-- -----------------------------------------------------------------------------
-- Table: ops.availability
-- The UNIQUE(user_id, date, slot) constraint is the database-level guarantee
-- against double-booking. It is NOT enforced at the application layer alone.
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ops.availability (
    id           UUID                   NOT NULL DEFAULT gen_random_uuid(),
    user_id      UUID                   NOT NULL,
    date         DATE                   NOT NULL,
    slot         ops.availability_slot  NOT NULL,
    is_available BOOLEAN                NOT NULL DEFAULT TRUE,
    created_at   TIMESTAMPTZ            NOT NULL DEFAULT now(),

    CONSTRAINT availability_pkey                   PRIMARY KEY (id),
    CONSTRAINT availability_user_id_fkey           FOREIGN KEY (user_id)
        REFERENCES ops.users (id) ON DELETE CASCADE,
    CONSTRAINT availability_user_date_slot_unique  UNIQUE (user_id, date, slot)
);

CREATE INDEX IF NOT EXISTS availability_user_id_date_idx
    ON ops.availability (user_id, date);

-- -----------------------------------------------------------------------------
-- Table: ops.tasks
-- notification_failed defaults FALSE; flipped TRUE only by background workers
-- on Slack/external API failures — never set directly by HTTP handlers.
-- assigned_to is nullable (task may be unassigned).
-- -----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS ops.tasks (
    id                  UUID             NOT NULL DEFAULT gen_random_uuid(),
    title               TEXT             NOT NULL,
    brand               ops.brand        NOT NULL,
    status              ops.task_status  NOT NULL DEFAULT 'brief_pending',
    assigned_to         UUID,
    created_by          UUID             NOT NULL,
    deadline            TIMESTAMPTZ,
    notification_failed BOOLEAN          NOT NULL DEFAULT FALSE,
    created_at          TIMESTAMPTZ      NOT NULL DEFAULT now(),
    updated_at          TIMESTAMPTZ      NOT NULL DEFAULT now(),

    CONSTRAINT tasks_pkey              PRIMARY KEY (id),
    CONSTRAINT tasks_assigned_to_fkey  FOREIGN KEY (assigned_to)
        REFERENCES ops.users (id) ON DELETE SET NULL,
    CONSTRAINT tasks_created_by_fkey   FOREIGN KEY (created_by)
        REFERENCES ops.users (id) ON DELETE RESTRICT
);

CREATE INDEX IF NOT EXISTS tasks_assigned_to_idx ON ops.tasks (assigned_to);
CREATE INDEX IF NOT EXISTS tasks_status_idx       ON ops.tasks (status);
CREATE INDEX IF NOT EXISTS tasks_brand_idx        ON ops.tasks (brand);

-- -----------------------------------------------------------------------------
-- Trigger: auto-refresh updated_at on ops.users and ops.tasks
-- Uses DROP + CREATE for Postgres <14 compatibility (no CREATE OR REPLACE TRIGGER).
-- CREATE OR REPLACE FUNCTION is safe and idempotent on all supported versions.
-- -----------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION ops.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS users_set_updated_at ON ops.users;
CREATE TRIGGER users_set_updated_at
    BEFORE UPDATE ON ops.users
    FOR EACH ROW EXECUTE FUNCTION ops.set_updated_at();

DROP TRIGGER IF EXISTS tasks_set_updated_at ON ops.tasks;
CREATE TRIGGER tasks_set_updated_at
    BEFORE UPDATE ON ops.tasks
    FOR EACH ROW EXECUTE FUNCTION ops.set_updated_at();

-- -----------------------------------------------------------------------------
-- Indexes: ops.sessions lookup paths needed by auth domain (Phase 2)
-- -----------------------------------------------------------------------------

-- Token verification: WHERE refresh_token_hash = $1
CREATE INDEX IF NOT EXISTS sessions_token_hash_idx
    ON ops.sessions (refresh_token_hash);

-- Session cleanup worker: DELETE WHERE expires_at < now()
CREATE INDEX IF NOT EXISTS sessions_expires_at_idx
    ON ops.sessions (expires_at);
