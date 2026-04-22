-- Migration 005: Availability Comments & Brand Decoupling
-- Adds comment field to availability and converts tasks.brand from enum to text.

ALTER TABLE ops.availability ADD COLUMN IF NOT EXISTS comment TEXT DEFAULT '';

-- Decouple tasks from brand enum to allow dynamic brands from ops.brands table
ALTER TABLE ops.tasks ALTER COLUMN brand TYPE TEXT;
DROP TYPE IF EXISTS ops.brand;
