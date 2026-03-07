-- Migration: Add Team Tournaments Support
-- Date: 2026-01-12
-- Description: Adds support for team tournament functionality (2v2)
-- Simplification: Uses tournament_participants with team_id instead of separate team_members table

-- ============================================================================
-- 1. Create tournament_teams table (simple team registry)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tournament_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  name VARCHAR(255) NOT NULL,
  created_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tournament_id, name)
);

COMMENT ON TABLE tournament_teams IS 'Teams within a team tournament. Team membership is tracked via tournament_participants.team_id.';
COMMENT ON COLUMN tournament_teams.tournament_id IS 'Tournament this team belongs to';
COMMENT ON COLUMN tournament_teams.name IS 'Team name (unique within tournament)';
COMMENT ON COLUMN tournament_teams.created_by IS 'User who created the team (usually tournament organizer)';

CREATE INDEX IF NOT EXISTS idx_tournament_teams_tournament_id ON tournament_teams(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_teams_created_by ON tournament_teams(created_by);

-- ============================================================================
-- 2. Add team fields to tournament_participants (replaces separate team_members table)
-- ============================================================================
ALTER TABLE tournament_participants ADD COLUMN IF NOT EXISTS team_id UUID REFERENCES tournament_teams(id) ON DELETE SET NULL;
ALTER TABLE tournament_participants ADD COLUMN IF NOT EXISTS team_position SMALLINT CHECK (team_position IS NULL OR team_position IN (1, 2));

COMMENT ON COLUMN tournament_participants.team_id IS 'Team this participant belongs to (for team tournaments only)';
COMMENT ON COLUMN tournament_participants.team_position IS 'Position in team: 1 or 2 (for team tournaments only, NULL for ranked/unranked)';

CREATE INDEX IF NOT EXISTS idx_tournament_participants_team_id ON tournament_participants(team_id);

-- ============================================================================
-- 3. Create team_substitutes table (backup players)
-- ============================================================================
CREATE TABLE IF NOT EXISTS team_substitutes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  team_id UUID NOT NULL REFERENCES tournament_teams(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  substitute_order SMALLINT DEFAULT 1,
  added_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(team_id, player_id)
);

COMMENT ON TABLE team_substitutes IS 'Substitute/backup players for a team. Can replace active members during tournament.';
COMMENT ON COLUMN team_substitutes.substitute_order IS 'Priority order for substitutions (1 = first substitute)';

CREATE INDEX IF NOT EXISTS idx_team_substitutes_team_id ON team_substitutes(team_id);
CREATE INDEX IF NOT EXISTS idx_team_substitutes_player_id ON team_substitutes(player_id);

-- ============================================================================
-- 4. Create team_tournament_matches table (2v2 matches)
-- ============================================================================
CREATE TABLE IF NOT EXISTS team_tournament_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  team_a_id UUID NOT NULL REFERENCES tournament_teams(id) ON DELETE CASCADE,
  team_b_id UUID NOT NULL REFERENCES tournament_teams(id) ON DELETE CASCADE,
  winning_team_id UUID NOT NULL REFERENCES tournament_teams(id) ON DELETE CASCADE,
  reported_by UUID NOT NULL REFERENCES users(id) ON DELETE SET NULL,
  map_name VARCHAR(255) NOT NULL,
  faction_a VARCHAR(255) NOT NULL,
  faction_b VARCHAR(255) NOT NULL,
  turns INT,
  replay_url VARCHAR(500),
  status VARCHAR(20) DEFAULT 'completed' CHECK (status IN ('pending', 'completed', 'cancelled')),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

COMMENT ON TABLE team_tournament_matches IS '2v2 matches in team tournaments. No draws allowed - always has a winning team.';
COMMENT ON COLUMN team_tournament_matches.team_a_id IS 'First team (left side)';
COMMENT ON COLUMN team_tournament_matches.team_b_id IS 'Second team (right side)';
COMMENT ON COLUMN team_tournament_matches.winning_team_id IS 'Winning team (must be either team_a or team_b)';
COMMENT ON COLUMN team_tournament_matches.reported_by IS 'Player who reported the match (must be from winning team)';

CREATE INDEX IF NOT EXISTS idx_team_tournament_matches_tournament_id ON team_tournament_matches(tournament_id);
CREATE INDEX IF NOT EXISTS idx_team_tournament_matches_team_a_id ON team_tournament_matches(team_a_id);
CREATE INDEX IF NOT EXISTS idx_team_tournament_matches_team_b_id ON team_tournament_matches(team_b_id);
CREATE INDEX IF NOT EXISTS idx_team_tournament_matches_winning_team_id ON team_tournament_matches(winning_team_id);

-- ============================================================================
-- 5. Trigger to enforce team size constraint (2 active members per team)
-- ============================================================================
CREATE OR REPLACE FUNCTION check_team_member_count()
RETURNS TRIGGER AS $$
DECLARE
  v_count INT;
BEGIN
  -- Only check for team tournaments
  IF NEW.team_id IS NOT NULL THEN
    SELECT COUNT(*) INTO v_count 
    FROM tournament_participants 
    WHERE team_id = NEW.team_id AND team_position IS NOT NULL;
    
    IF v_count > 2 THEN
      RAISE EXCEPTION 'Team cannot have more than 2 active members';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_team_member_count ON tournament_participants;
CREATE TRIGGER trigger_check_team_member_count
BEFORE INSERT ON tournament_participants
FOR EACH ROW
EXECUTE FUNCTION check_team_member_count();

-- ============================================================================
-- 6. Trigger to prevent duplicate positions in team
-- ============================================================================
CREATE OR REPLACE FUNCTION check_team_member_positions()
RETURNS TRIGGER AS $$
DECLARE
  v_duplicate INT;
BEGIN
  -- Only check for team tournaments
  IF NEW.team_id IS NOT NULL AND NEW.team_position IS NOT NULL THEN
    SELECT COUNT(*) INTO v_duplicate 
    FROM tournament_participants 
    WHERE team_id = NEW.team_id 
      AND team_position = NEW.team_position 
      AND user_id != NEW.user_id;
    
    IF v_duplicate > 0 THEN
      RAISE EXCEPTION 'Each team position (1 and 2) must be unique';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_check_team_member_positions ON tournament_participants;
CREATE TRIGGER trigger_check_team_member_positions
BEFORE INSERT OR UPDATE ON tournament_participants
FOR EACH ROW
EXECUTE FUNCTION check_team_member_positions();
