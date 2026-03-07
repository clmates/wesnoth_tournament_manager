-- FIDE ELO System Migration
-- Adds columns for FIDE-compliant ELO rating system

-- Add columns to users table for FIDE tracking
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS is_rated BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS matches_played INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS elo_provisional BOOLEAN DEFAULT false;

-- Update existing users as rated for backward compatibility
UPDATE users 
SET is_rated = true, matches_played = COALESCE(
  (SELECT COUNT(*) FROM matches WHERE winner_id = users.id OR loser_id = users.id), 
  0
)
WHERE is_active = true AND is_blocked = false;

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_users_is_rated ON users(is_rated);
CREATE INDEX IF NOT EXISTS idx_users_elo_rating ON users(elo_rating);
CREATE INDEX IF NOT EXISTS idx_users_matches_played ON users(matches_played);
