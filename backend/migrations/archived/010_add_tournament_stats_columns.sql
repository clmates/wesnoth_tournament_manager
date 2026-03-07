-- Add missing columns to tournament_participants table
ALTER TABLE tournament_participants
ADD COLUMN IF NOT EXISTS tournament_ranking INTEGER,
ADD COLUMN IF NOT EXISTS tournament_wins INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS tournament_losses INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS tournament_points INTEGER DEFAULT 0;
