-- Migration: Add FIDE ELO system support
-- Date: 2025-12-06

-- Add new columns to users table for FIDE ELO system
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_rated BOOLEAN DEFAULT false;
ALTER TABLE users ADD COLUMN IF NOT EXISTS matches_played INTEGER DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS elo_provisional BOOLEAN DEFAULT false;

-- Update existing users to mark them as already rated (backward compatibility)
UPDATE users SET is_rated = true, elo_provisional = false WHERE elo_rating >= 1400;

-- Set new column defaults for the ELO system
-- New unrated players will have NULL elo_rating
ALTER TABLE users ALTER COLUMN elo_rating DROP DEFAULT;

-- Create index for efficient rating queries
CREATE INDEX IF NOT EXISTS idx_users_is_rated ON users(is_rated);
CREATE INDEX IF NOT EXISTS idx_users_elo_rating ON users(elo_rating) WHERE is_rated = true AND elo_rating >= 1400;
