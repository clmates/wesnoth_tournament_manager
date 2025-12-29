-- Add opponent-related statistics columns to player_match_statistics
-- These columns are needed for the recent-opponents endpoint

ALTER TABLE player_match_statistics
ADD COLUMN IF NOT EXISTS last_elo_against_me DECIMAL(8, 2),
ADD COLUMN IF NOT EXISTS elo_gained DECIMAL(8, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS elo_lost DECIMAL(8, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_match_date TIMESTAMP;

-- Update the update_player_match_statistics function to properly calculate opponent stats
CREATE OR REPLACE FUNCTION update_player_match_statistics()
RETURNS TRIGGER AS $$
DECLARE
  v_map_id UUID;
  v_winner_faction_id UUID;
  v_loser_faction_id UUID;
  v_existing_id UUID;
  v_winner_elo_change INT;
  v_loser_elo_change INT;
BEGIN
  -- Skip matches that are admin-reviewed as disputed and cancelled
  IF NEW.admin_reviewed = true AND NEW.status = 'cancelled' THEN
    RETURN NEW;
  END IF;
  
  -- Calculate ELO changes
  v_winner_elo_change := NEW.winner_elo_after - NEW.winner_elo_before;
  v_loser_elo_change := NEW.loser_elo_after - NEW.loser_elo_before;
  
  -- Get map ID from map name
  SELECT id INTO v_map_id FROM game_maps WHERE name = NEW.map LIMIT 1;
  IF v_map_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Get winner faction ID from faction name
  SELECT id INTO v_winner_faction_id FROM factions WHERE name = NEW.winner_faction LIMIT 1;
  IF v_winner_faction_id IS NULL THEN
    RETURN NEW;
  END IF;
  
  -- Get loser faction ID from faction name
  SELECT id INTO v_loser_faction_id FROM factions WHERE name = NEW.loser_faction LIMIT 1;
  IF v_loser_faction_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- ===== GLOBAL STATS =====
  
  -- Update winner global stats
  SELECT id INTO v_existing_id FROM player_match_statistics 
  WHERE player_id = NEW.winner_id AND opponent_id IS NULL AND map_id IS NULL AND faction_id IS NULL LIMIT 1;
  
  IF v_existing_id IS NOT NULL THEN
    UPDATE player_match_statistics SET
      total_games = total_games + 1,
      wins = wins + 1,
      winrate = ROUND(100.0 * (wins + 1)::NUMERIC / (total_games + 1), 2),
      avg_elo_change = ROUND(((avg_elo_change * total_games) + v_winner_elo_change) / (total_games + 1), 2),
      last_updated = CURRENT_TIMESTAMP
    WHERE id = v_existing_id;
  ELSE
    INSERT INTO player_match_statistics (player_id, opponent_id, map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate, avg_elo_change)
    VALUES (NEW.winner_id, NULL, NULL, NULL, NULL, 1, 1, 0, 100.00, v_winner_elo_change);
  END IF;
  
  -- Update loser global stats
  SELECT id INTO v_existing_id FROM player_match_statistics 
  WHERE player_id = NEW.loser_id AND opponent_id IS NULL AND map_id IS NULL AND faction_id IS NULL LIMIT 1;
  
  IF v_existing_id IS NOT NULL THEN
    UPDATE player_match_statistics SET
      total_games = total_games + 1,
      losses = losses + 1,
      winrate = ROUND(100.0 * wins::NUMERIC / (total_games + 1), 2),
      avg_elo_change = ROUND(((avg_elo_change * total_games) + v_loser_elo_change) / (total_games + 1), 2),
      last_updated = CURRENT_TIMESTAMP
    WHERE id = v_existing_id;
  ELSE
    INSERT INTO player_match_statistics (player_id, opponent_id, map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate, avg_elo_change)
    VALUES (NEW.loser_id, NULL, NULL, NULL, NULL, 1, 0, 1, 0.00, v_loser_elo_change);
  END IF;

  -- ===== HEAD-TO-HEAD STATS (for recent opponents) =====
  
  -- Update winner head-to-head (from winner's perspective)
  SELECT id INTO v_existing_id FROM player_match_statistics 
  WHERE player_id = NEW.winner_id AND opponent_id = NEW.loser_id AND map_id IS NULL AND faction_id IS NULL AND opponent_faction_id IS NULL LIMIT 1;
  
  IF v_existing_id IS NOT NULL THEN
    UPDATE player_match_statistics SET
      total_games = total_games + 1,
      wins = wins + 1,
      winrate = ROUND(100.0 * (wins + 1)::NUMERIC / (total_games + 1), 2),
      avg_elo_change = ROUND(((avg_elo_change * total_games) + v_winner_elo_change) / (total_games + 1), 2),
      elo_gained = elo_gained + (CASE WHEN v_winner_elo_change > 0 THEN v_winner_elo_change ELSE 0 END),
      elo_lost = elo_lost + (CASE WHEN v_winner_elo_change < 0 THEN ABS(v_winner_elo_change) ELSE 0 END),
      last_elo_against_me = NEW.loser_elo_after,
      last_match_date = NEW.created_at,
      last_updated = CURRENT_TIMESTAMP
    WHERE id = v_existing_id;
  ELSE
    INSERT INTO player_match_statistics (player_id, opponent_id, map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate, avg_elo_change, elo_gained, elo_lost, last_elo_against_me, last_match_date)
    VALUES (
      NEW.winner_id, 
      NEW.loser_id, 
      NULL, 
      NULL, 
      NULL, 
      1, 
      1, 
      0, 
      100.00, 
      v_winner_elo_change, 
      (CASE WHEN v_winner_elo_change > 0 THEN v_winner_elo_change::NUMERIC(8,2) ELSE 0::NUMERIC(8,2) END),
      (CASE WHEN v_winner_elo_change < 0 THEN ABS(v_winner_elo_change)::NUMERIC(8,2) ELSE 0::NUMERIC(8,2) END),
      NEW.loser_elo_after, 
      NEW.created_at
    );
  END IF;
  
  -- Update loser head-to-head (from loser's perspective)
  SELECT id INTO v_existing_id FROM player_match_statistics 
  WHERE player_id = NEW.loser_id AND opponent_id = NEW.winner_id AND map_id IS NULL AND faction_id IS NULL AND opponent_faction_id IS NULL LIMIT 1;
  
  IF v_existing_id IS NOT NULL THEN
    UPDATE player_match_statistics SET
      total_games = total_games + 1,
      losses = losses + 1,
      winrate = ROUND(100.0 * wins::NUMERIC / (total_games + 1), 2),
      avg_elo_change = ROUND(((avg_elo_change * total_games) + v_loser_elo_change) / (total_games + 1), 2),
      elo_gained = elo_gained + (CASE WHEN v_loser_elo_change > 0 THEN v_loser_elo_change ELSE 0 END),
      elo_lost = elo_lost + (CASE WHEN v_loser_elo_change < 0 THEN ABS(v_loser_elo_change) ELSE 0 END),
      last_elo_against_me = NEW.winner_elo_after,
      last_match_date = NEW.created_at,
      last_updated = CURRENT_TIMESTAMP
    WHERE id = v_existing_id;
  ELSE
    INSERT INTO player_match_statistics (player_id, opponent_id, map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate, avg_elo_change, elo_gained, elo_lost, last_elo_against_me, last_match_date)
    VALUES (
      NEW.loser_id, 
      NEW.winner_id, 
      NULL, 
      NULL, 
      NULL, 
      1, 
      0, 
      1, 
      0.00, 
      v_loser_elo_change, 
      (CASE WHEN v_loser_elo_change > 0 THEN v_loser_elo_change::NUMERIC(8,2) ELSE 0::NUMERIC(8,2) END),
      (CASE WHEN v_loser_elo_change < 0 THEN ABS(v_loser_elo_change)::NUMERIC(8,2) ELSE 0::NUMERIC(8,2) END),
      NEW.winner_elo_after, 
      NEW.created_at
    );
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger with the updated function
DROP TRIGGER IF EXISTS trg_update_player_match_stats ON matches;
CREATE TRIGGER trg_update_player_match_stats
AFTER INSERT OR UPDATE ON matches
FOR EACH ROW
EXECUTE FUNCTION update_player_match_statistics();

COMMENT ON COLUMN player_match_statistics.last_elo_against_me IS 'Last ELO rating of the opponent when they last played against this player';
COMMENT ON COLUMN player_match_statistics.elo_gained IS 'Total ELO gained in matches against this opponent';
COMMENT ON COLUMN player_match_statistics.elo_lost IS 'Total ELO lost in matches against this opponent';
COMMENT ON COLUMN player_match_statistics.last_match_date IS 'Date of the last match against this opponent';
