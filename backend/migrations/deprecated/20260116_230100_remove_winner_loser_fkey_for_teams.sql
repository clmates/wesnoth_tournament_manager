-- Migration: Replace Foreign Key for winner_id/loser_id in tournament_matches
-- Date: 2026-01-16
-- Description: Removes static FK constraints from tournament_matches.winner_id and .loser_id
--              and replaces with dynamic trigger validation
--              Trigger validates based on tournament_mode:
--              - 1v1 mode: winner_id/loser_id must exist in users table
--              - Team mode: winner_id/loser_id must exist in tournament_teams table
--              This maintains data integrity while supporting team tournaments

-- ============================================================================
-- 1. Drop existing foreign key constraints for winner_id and loser_id
-- ============================================================================
ALTER TABLE tournament_matches
DROP CONSTRAINT IF EXISTS tournament_matches_winner_id_fkey;

ALTER TABLE tournament_matches
DROP CONSTRAINT IF EXISTS tournament_matches_loser_id_fkey;

-- ============================================================================
-- 2. Create function for conditional validation of winner_id and loser_id
-- ============================================================================
CREATE OR REPLACE FUNCTION validate_tournament_match_results()
RETURNS TRIGGER AS $$
DECLARE
  v_tournament_mode VARCHAR;
  v_winner_exists BOOLEAN;
  v_loser_exists BOOLEAN;
BEGIN
  -- Only validate if winner_id or loser_id is being set
  IF NEW.winner_id IS NULL AND NEW.loser_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get tournament mode
  SELECT tournament_mode INTO v_tournament_mode
  FROM tournaments
  WHERE id = NEW.tournament_id;

  IF v_tournament_mode = 'team' THEN
    -- Team mode: validate against tournament_teams
    IF NEW.winner_id IS NOT NULL THEN
      SELECT EXISTS(SELECT 1 FROM tournament_teams WHERE id = NEW.winner_id) INTO v_winner_exists;
      IF NOT v_winner_exists THEN
        RAISE EXCEPTION 'Team (winner_id) % does not exist in tournament_teams', NEW.winner_id;
      END IF;
    END IF;
    
    IF NEW.loser_id IS NOT NULL THEN
      SELECT EXISTS(SELECT 1 FROM tournament_teams WHERE id = NEW.loser_id) INTO v_loser_exists;
      IF NOT v_loser_exists THEN
        RAISE EXCEPTION 'Team (loser_id) % does not exist in tournament_teams', NEW.loser_id;
      END IF;
    END IF;
  ELSE
    -- 1v1 mode: validate against users (original FK behavior)
    IF NEW.winner_id IS NOT NULL THEN
      SELECT EXISTS(SELECT 1 FROM users WHERE id = NEW.winner_id) INTO v_winner_exists;
      IF NOT v_winner_exists THEN
        RAISE EXCEPTION 'User (winner_id) % does not exist in users table', NEW.winner_id;
      END IF;
    END IF;
    
    IF NEW.loser_id IS NOT NULL THEN
      SELECT EXISTS(SELECT 1 FROM users WHERE id = NEW.loser_id) INTO v_loser_exists;
      IF NOT v_loser_exists THEN
        RAISE EXCEPTION 'User (loser_id) % does not exist in users table', NEW.loser_id;
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. Create trigger to enforce validation on INSERT and UPDATE
-- ============================================================================
DROP TRIGGER IF EXISTS trg_validate_tournament_match_results ON tournament_matches;

CREATE TRIGGER trg_validate_tournament_match_results
BEFORE INSERT OR UPDATE ON tournament_matches
FOR EACH ROW
EXECUTE FUNCTION validate_tournament_match_results();

-- ============================================================================
-- 4. Update table comments
-- ============================================================================
COMMENT ON COLUMN tournament_matches.winner_id IS 'Winner ID: user_id for 1v1 tournaments, team_id for team tournaments. Validated by trg_validate_tournament_match_results trigger.';
COMMENT ON COLUMN tournament_matches.loser_id IS 'Loser ID: user_id for 1v1 tournaments, team_id for team tournaments. Validated by trg_validate_tournament_match_results trigger.';
