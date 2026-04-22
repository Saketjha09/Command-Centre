-- Migration 004: Brand Management
-- Converts brands from a hardcoded enum to a dynamic table.

CREATE TABLE IF NOT EXISTS ops.brands (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL UNIQUE,
    slug TEXT NOT NULL UNIQUE,
    hex_color TEXT NOT NULL DEFAULT '#6366f1',
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seed with initial brands
INSERT INTO ops.brands (name, slug, hex_color) VALUES 
('Master App', 'master_app', '#3b82f6'),
('Supernova AI', 'supernova_ai', '#8b5cf6')
ON CONFLICT (slug) DO NOTHING;

-- Update tasks to reference brand table? 
-- For now, we'll keep the tasks.brand as TEXT but validate it against the brands table slugs.
-- Alternatively, we could migrate tasks.brand to UUID, but let's keep it simple first.
