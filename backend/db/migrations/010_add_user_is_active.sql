-- Migration 010: Add is_active to users
-- Used to filter freelancers in the admin availability grid.
ALTER TABLE ops.users ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;
