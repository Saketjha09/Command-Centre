-- =============================================================================
-- Migration: 013_availability_status_enum.sql
-- Description: Replace ops.availability.is_available (BOOLEAN) with a proper
--              ops.availability_status enum column.
-- Scope: Schema + data only. No Go files touched in this migration.
-- =============================================================================

BEGIN;

-- -----------------------------------------------------------------------------
-- STEP 1: Create the new enum type
-- -----------------------------------------------------------------------------
DO $$ BEGIN
    CREATE TYPE ops.availability_status AS ENUM (
        'available',
        'busy_manual',
        'busy_task',
        'off',
        'unknown'
    );
EXCEPTION
    WHEN duplicate_object THEN NULL;
END $$;

-- -----------------------------------------------------------------------------
-- STEP 2: Add the new status column — nullable first so the UPDATE below
--         can populate it before we enforce NOT NULL.
-- -----------------------------------------------------------------------------
ALTER TABLE ops.availability
    ADD COLUMN IF NOT EXISTS status ops.availability_status;

-- -----------------------------------------------------------------------------
-- STEP 3: Migrate existing boolean data into the enum column
--         is_available = true  → 'available'
--         is_available = false → 'off'
-- -----------------------------------------------------------------------------
UPDATE ops.availability
    SET status = 'available'
    WHERE is_available = true;

UPDATE ops.availability
    SET status = 'off'
    WHERE is_available = false;

-- -----------------------------------------------------------------------------
-- STEP 4: Enforce NOT NULL + set default now that every row is populated
-- -----------------------------------------------------------------------------
ALTER TABLE ops.availability
    ALTER COLUMN status SET NOT NULL;

ALTER TABLE ops.availability
    ALTER COLUMN status SET DEFAULT 'unknown';

-- -----------------------------------------------------------------------------
-- STEP 5: Drop the old boolean column
-- -----------------------------------------------------------------------------
ALTER TABLE ops.availability
    DROP COLUMN is_available;

COMMIT;
