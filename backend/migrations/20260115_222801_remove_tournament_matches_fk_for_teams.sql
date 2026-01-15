-- Migration: Replace Foreign Key with Conditional Trigger for tournament_matches
-- Date: 2026-01-15
-- Description: Removes static FK constraints from tournament_matches and replaces with dynamic trigger
--              Trigger validates based on tournament_mode:
--              - 1v1 mode: player1_id/player2_id must exist in users table
--              - Team mode: player1_id/player2_id must exist in tournament_teams table
--              This maintains data integrity while supporting team tournaments (Option B architecture)

-- ============================================================================
-- 1. Drop existing foreign key constraints
-- ============================================================================
ALTER TABLE tournament_matches
DROP CONSTRAINT IF EXISTS tournament_matches_player1_id_fkey;

ALTER TABLE tournament_matches
DROP CONSTRAINT IF EXISTS tournament_matches_player2_id_fkey;

-- ============================================================================
-- 2. Create function for conditional validation
-- ============================================================================
CREATE OR REPLACE FUNCTION validate_tournament_match_players()
RETURNS TRIGGER AS $$
DECLARE
  v_tournament_mode VARCHAR;
  v_player1_exists BOOLEAN;
  v_player2_exists BOOLEAN;
BEGIN
  -- Get tournament mode
  SELECT tournament_mode INTO v_tournament_mode
  FROM tournaments
  WHERE id = NEW.tournament_id;

  IF v_tournament_mode = 'team' THEN
    -- Team mode: validate against tournament_teams
    SELECT EXISTS(SELECT 1 FROM tournament_teams WHERE id = NEW.player1_id) INTO v_player1_exists;
    SELECT EXISTS(SELECT 1 FROM tournament_teams WHERE id = NEW.player2_id) INTO v_player2_exists;
    
    IF NOT v_player1_exists THEN
      RAISE EXCEPTION 'Team % does not exist in tournament_teams', NEW.player1_id;
    END IF;
    
    IF NOT v_player2_exists THEN
      RAISE EXCEPTION 'Team % does not exist in tournament_teams', NEW.player2_id;
    END IF;
  ELSE
    -- 1v1 mode: validate against users (original FK behavior)
    SELECT EXISTS(SELECT 1 FROM users WHERE id = NEW.player1_id) INTO v_player1_exists;
    SELECT EXISTS(SELECT 1 FROM users WHERE id = NEW.player2_id) INTO v_player2_exists;
    
    IF NOT v_player1_exists THEN
      RAISE EXCEPTION 'User % does not exist in users table', NEW.player1_id;
    END IF;
    
    IF NOT v_player2_exists THEN
      RAISE EXCEPTION 'User % does not exist in users table', NEW.player2_id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- 3. Create trigger to enforce validation on INSERT and UPDATE
-- ============================================================================
DROP TRIGGER IF EXISTS trg_validate_tournament_match_players ON tournament_matches;

CREATE TRIGGER trg_validate_tournament_match_players
BEFORE INSERT OR UPDATE ON tournament_matches
FOR EACH ROW
EXECUTE FUNCTION validate_tournament_match_players();

-- ============================================================================
-- 4. Update table comments
-- ============================================================================
COMMENT ON TABLE tournament_matches IS 'Individual tournament matches. In 1v1 mode: player1_id/player2_id are user_ids. In team mode: player1_id/player2_id are team_ids (from tournament_teams table). Validation enforced by conditional trigger.';
COMMENT ON COLUMN tournament_matches.player1_id IS 'Player or Team ID: user_id for 1v1 tournaments, team_id for team tournaments. Validated by trg_validate_tournament_match_players trigger.';
COMMENT ON COLUMN tournament_matches.player2_id IS 'Player or Team ID: user_id for 1v1 tournaments, team_id for team tournaments. Validated by trg_validate_tournament_match_players trigger.';
