-- Migration: Add team_elo column to tournament_teams
-- Date: 2026-01-16
-- Description: Adds a team_elo column that stores the sum of elo ratings of team members
--              This is used for pairing calculations in tournaments

-- ============================================================================
-- 1. Add team_elo column to tournament_teams
-- ============================================================================
ALTER TABLE tournament_teams
ADD COLUMN IF NOT EXISTS team_elo INTEGER DEFAULT 0;

COMMENT ON COLUMN tournament_teams.team_elo IS 'Sum of elo_rating of all team members. Used for Swiss pairings and team strength calculations.';

-- ============================================================================
-- 2. Create or replace function to update team_elo
-- ============================================================================
CREATE OR REPLACE FUNCTION update_team_elo()
RETURNS TRIGGER AS $$
BEGIN
  -- Update team_elo when a participant is added/modified/deleted
  UPDATE tournament_teams
  SET team_elo = COALESCE(
    (SELECT SUM(u.elo_rating)
     FROM tournament_participants tp
     JOIN users u ON tp.user_id = u.id
     WHERE tp.team_id = NEW.team_id OR tp.team_id = OLD.team_id),
    0
  )
  WHERE id = COALESCE(NEW.team_id, OLD.team_id);
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. Create trigger to update team_elo when participants change
-- ============================================================================
DROP TRIGGER IF EXISTS trg_update_team_elo ON tournament_participants;

CREATE TRIGGER trg_update_team_elo
AFTER INSERT OR UPDATE OR DELETE ON tournament_participants
FOR EACH ROW
EXECUTE FUNCTION update_team_elo();

-- ============================================================================
-- 4. Initialize team_elo for all existing teams
-- ============================================================================
UPDATE tournament_teams
SET team_elo = COALESCE(
  (SELECT SUM(u.elo_rating)
   FROM tournament_participants tp
   JOIN users u ON tp.user_id = u.id
   WHERE tp.team_id = tournament_teams.id),
  0
)
WHERE tournament_teams.tournament_id IN (
  SELECT id FROM tournaments WHERE tournament_mode = 'team'
);
