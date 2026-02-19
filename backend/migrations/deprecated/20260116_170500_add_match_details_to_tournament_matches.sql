-- Migration: Add match details columns to tournament_matches
-- Purpose: Store match details (winner/loser IDs, factions, map) directly in tournament_matches
-- for unranked and team tournaments, making tournament_matches the source of truth for all tournament modes
-- Date: 2026-01-16

-- Add columns to tournament_matches table
ALTER TABLE tournament_matches
ADD COLUMN IF NOT EXISTS winner_id UUID,
ADD COLUMN IF NOT EXISTS loser_id UUID,
ADD COLUMN IF NOT EXISTS map VARCHAR(255),
ADD COLUMN IF NOT EXISTS winner_faction VARCHAR(255),
ADD COLUMN IF NOT EXISTS loser_faction VARCHAR(255);

-- Add comments for clarity
COMMENT ON COLUMN tournament_matches.winner_id IS 'ID of winner (user_id for 1v1, team_id for team tournaments)';
COMMENT ON COLUMN tournament_matches.loser_id IS 'ID of loser (user_id for 1v1, team_id for team tournaments)';
COMMENT ON COLUMN tournament_matches.map IS 'Map name where match was played';
COMMENT ON COLUMN tournament_matches.winner_faction IS 'Winner faction (NULL for team tournaments)';
COMMENT ON COLUMN tournament_matches.loser_faction IS 'Loser faction (NULL for team tournaments)';

-- Create index for querying by winner/loser
CREATE INDEX IF NOT EXISTS idx_tournament_matches_winner_loser 
ON tournament_matches(tournament_id, winner_id, loser_id);

CREATE INDEX IF NOT EXISTS idx_tournament_matches_map 
ON tournament_matches(map);
