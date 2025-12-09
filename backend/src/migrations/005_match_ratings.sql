-- Add ELO ratings and ranking at match time to matches table
ALTER TABLE matches 
ADD COLUMN IF NOT EXISTS winner_elo_before INTEGER DEFAULT 1600,
ADD COLUMN IF NOT EXISTS winner_elo_after INTEGER DEFAULT 1600,
ADD COLUMN IF NOT EXISTS loser_elo_before INTEGER DEFAULT 1600,
ADD COLUMN IF NOT EXISTS loser_elo_after INTEGER DEFAULT 1600,
ADD COLUMN IF NOT EXISTS winner_level_before VARCHAR(50) DEFAULT 'novato',
ADD COLUMN IF NOT EXISTS winner_level_after VARCHAR(50) DEFAULT 'novato',
ADD COLUMN IF NOT EXISTS loser_level_before VARCHAR(50) DEFAULT 'novato',
ADD COLUMN IF NOT EXISTS loser_level_after VARCHAR(50) DEFAULT 'novato';

-- Create index for match queries
CREATE INDEX IF NOT EXISTS idx_matches_created_at ON matches(created_at DESC);

