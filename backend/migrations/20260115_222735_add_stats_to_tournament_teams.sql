-- Add statistics columns to tournament_teams table for team tournament tracking
-- These columns are only used in 'team' mode tournaments
-- In 1v1 tournaments, stats remain in tournament_participants

ALTER TABLE tournament_teams 
ADD COLUMN IF NOT EXISTS tournament_wins INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS tournament_losses INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS tournament_points INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS omp DECIMAL(10, 2) DEFAULT 0,      -- Opposition Match Points
ADD COLUMN IF NOT EXISTS gwp DECIMAL(5, 2) DEFAULT 0,        -- Game Win Percentage
ADD COLUMN IF NOT EXISTS ogp DECIMAL(5, 2) DEFAULT 0,        -- Opposition Game Percentage
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active'; -- 'active' or 'eliminated'

-- Create index for faster tournament standings queries
CREATE INDEX IF NOT EXISTS idx_tournament_teams_tournament_status 
ON tournament_teams(tournament_id, status);

-- Add comment for clarity (PostgreSQL syntax)
COMMENT ON COLUMN tournament_teams.tournament_wins IS 'Only used in team tournament mode. Tracks team wins.';
COMMENT ON COLUMN tournament_teams.tournament_losses IS 'Only used in team tournament mode. Tracks team losses.';
COMMENT ON COLUMN tournament_teams.tournament_points IS 'Only used in team tournament mode. Swiss points.';
COMMENT ON COLUMN tournament_teams.omp IS 'Only used in team tournament mode. Opposition Match Points for Swiss tiebreaker.';
COMMENT ON COLUMN tournament_teams.gwp IS 'Only used in team tournament mode. Game Win Percentage for Swiss tiebreaker.';
COMMENT ON COLUMN tournament_teams.ogp IS 'Only used in team tournament mode. Opposition Game Percentage for Swiss tiebreaker.';
COMMENT ON COLUMN tournament_teams.status IS 'Only used in team tournament mode. Tracks team elimination status.';
