-- Add is_premium column to identities table
ALTER TABLE identities ADD COLUMN IF NOT EXISTS is_premium BOOLEAN DEFAULT FALSE;
