-- Add ranking and round tracking columns to tournament_teams table
-- These columns help track team progression through tournament rounds
-- and display their current standing/rank

ALTER TABLE tournament_teams 
ADD COLUMN IF NOT EXISTS current_round INTEGER DEFAULT 1,           -- Current round the team is in
ADD COLUMN IF NOT EXISTS tournament_ranking INTEGER DEFAULT NULL;   -- Current ranking in tournament

-- Create indexes for fast ranking queries
CREATE INDEX IF NOT EXISTS idx_tournament_teams_ranking 
ON tournament_teams(tournament_id, tournament_ranking);

CREATE INDEX IF NOT EXISTS idx_tournament_teams_round 
ON tournament_teams(tournament_id, current_round);

-- Add comments for clarity
COMMENT ON COLUMN tournament_teams.current_round IS 'Team tournament mode only. Tracks which round the team is currently in (1 = first round). Updated as team progresses.';
COMMENT ON COLUMN tournament_teams.tournament_ranking IS 'Team tournament mode only. Current ranking position in tournament (1 = first place). NULL if not yet ranked. Updated after each round.';
