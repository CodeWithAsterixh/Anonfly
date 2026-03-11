-- Add allowed_features column to identities table
ALTER TABLE identities ADD COLUMN IF NOT EXISTS allowed_features TEXT[] DEFAULT '{}';
