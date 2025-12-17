-- Fix tournament_participants table structure
-- Remove elo_rating (should only be in users table)
-- Add tournament_ranking if not exists

ALTER TABLE tournament_participants
DROP COLUMN IF EXISTS elo_rating;

ALTER TABLE tournament_participants
ADD COLUMN IF NOT EXISTS tournament_ranking INTEGER;
