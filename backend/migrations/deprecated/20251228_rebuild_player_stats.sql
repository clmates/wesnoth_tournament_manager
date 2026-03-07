-- Completely rebuild player_match_statistics with simpler unique constraints
-- Drop and recreate with better index strategy

-- Drop existing objects
DROP TRIGGER IF EXISTS trg_update_player_match_stats ON matches;
DROP FUNCTION IF EXISTS update_player_match_statistics();
DROP FUNCTION IF EXISTS recalculate_player_match_statistics();
DROP TABLE IF EXISTS player_match_statistics;

-- Create player_match_statistics table
CREATE TABLE player_match_statistics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opponent_id UUID REFERENCES users(id) ON DELETE CASCADE,
  map_id UUID REFERENCES game_maps(id) ON DELETE CASCADE,
  faction_id UUID REFERENCES factions(id) ON DELETE CASCADE,
  opponent_faction_id UUID REFERENCES factions(id) ON DELETE CASCADE,
  
  total_games INT DEFAULT 0,
  wins INT DEFAULT 0,
  losses INT DEFAULT 0,
  winrate DECIMAL(5, 2),
  avg_elo_change DECIMAL(8, 2),
  
  -- Additional opponent-related fields for recent opponents endpoint
  last_elo_against_me DECIMAL(8, 2),
  elo_gained DECIMAL(8, 2) DEFAULT 0,
  elo_lost DECIMAL(8, 2) DEFAULT 0,
  last_match_date TIMESTAMP,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create separate UNIQUE constraints for each query pattern
-- Pattern 1: Global (all NULL except player_id)
CREATE UNIQUE INDEX idx_player_stats_global 
  ON player_match_statistics(player_id)
  WHERE opponent_id IS NULL AND map_id IS NULL AND faction_id IS NULL AND opponent_faction_id IS NULL;

-- Pattern 2: By-map (map_id NOT NULL, others NULL except player_id)
CREATE UNIQUE INDEX idx_player_stats_by_map 
  ON player_match_statistics(player_id, map_id)
  WHERE opponent_id IS NULL AND faction_id IS NULL AND opponent_faction_id IS NULL;

-- Pattern 3: By-faction (faction_id NOT NULL, others NULL except player_id)
CREATE UNIQUE INDEX idx_player_stats_by_faction 
  ON player_match_statistics(player_id, faction_id)
  WHERE opponent_id IS NULL AND map_id IS NULL AND opponent_faction_id IS NULL;

-- Pattern 4: Head-to-head (opponent_id NOT NULL, all others specified)
CREATE UNIQUE INDEX idx_player_stats_h2h 
  ON player_match_statistics(player_id, opponent_id, map_id, faction_id, opponent_faction_id)
  WHERE opponent_id IS NOT NULL;

-- Additional search indices
CREATE INDEX idx_player_stats_player ON player_match_statistics(player_id);
CREATE INDEX idx_player_stats_opponent ON player_match_statistics(opponent_id) WHERE opponent_id IS NOT NULL;
CREATE INDEX idx_player_stats_map ON player_match_statistics(map_id) WHERE map_id IS NOT NULL;
CREATE INDEX idx_player_stats_faction ON player_match_statistics(faction_id) WHERE faction_id IS NOT NULL;

-- Function to update player statistics after each match
CREATE OR REPLACE FUNCTION update_player_match_statistics()
RETURNS TRIGGER AS $$
DECLARE
  v_map_id UUID;
  v_winner_faction_id UUID;
  v_loser_faction_id UUID;
  v_existing_id UUID;
BEGIN
  -- Skip matches that are admin-reviewed as disputed and cancelled
  IF NEW.admin_reviewed = true AND NEW.status = 'cancelled' THEN
    RETURN NEW;
  END IF;
  
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
  
  -- Update winner global stats
  SELECT id INTO v_existing_id FROM player_match_statistics 
  WHERE player_id = NEW.winner_id AND opponent_id IS NULL AND map_id IS NULL AND faction_id IS NULL LIMIT 1;
  
  IF v_existing_id IS NOT NULL THEN
    UPDATE player_match_statistics SET
      total_games = total_games + 1,
      wins = wins + 1,
      winrate = ROUND(100.0 * (wins + 1)::NUMERIC / (total_games + 1), 2),
      avg_elo_change = ROUND(((avg_elo_change * total_games) + COALESCE(NEW.elo_change, 0)) / (total_games + 1), 2),
      last_updated = CURRENT_TIMESTAMP
    WHERE id = v_existing_id;
  ELSE
    INSERT INTO player_match_statistics (player_id, opponent_id, map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate, avg_elo_change)
    VALUES (NEW.winner_id, NULL, NULL, NULL, NULL, 1, 1, 0, 100.00, COALESCE(NEW.elo_change, 0));
  END IF;
  
  -- Update loser global stats
  SELECT id INTO v_existing_id FROM player_match_statistics 
  WHERE player_id = NEW.loser_id AND opponent_id IS NULL AND map_id IS NULL AND faction_id IS NULL LIMIT 1;
  
  IF v_existing_id IS NOT NULL THEN
    UPDATE player_match_statistics SET
      total_games = total_games + 1,
      losses = losses + 1,
      winrate = ROUND(100.0 * wins::NUMERIC / (total_games + 1), 2),
      avg_elo_change = ROUND(((avg_elo_change * total_games) - COALESCE(NEW.elo_change, 0)) / (total_games + 1), 2),
      last_updated = CURRENT_TIMESTAMP
    WHERE id = v_existing_id;
  ELSE
    INSERT INTO player_match_statistics (player_id, opponent_id, map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate, avg_elo_change)
    VALUES (NEW.loser_id, NULL, NULL, NULL, NULL, 1, 0, 1, 0.00, -COALESCE(NEW.elo_change, 0));
  END IF;
  
  -- Update winner map stats
  SELECT id INTO v_existing_id FROM player_match_statistics 
  WHERE player_id = NEW.winner_id AND opponent_id IS NULL AND map_id = v_map_id AND faction_id IS NULL LIMIT 1;
  
  IF v_existing_id IS NOT NULL THEN
    UPDATE player_match_statistics SET
      total_games = total_games + 1,
      wins = wins + 1,
      winrate = ROUND(100.0 * (wins + 1)::NUMERIC / (total_games + 1), 2),
      avg_elo_change = ROUND(((avg_elo_change * total_games) + COALESCE(NEW.elo_change, 0)) / (total_games + 1), 2),
      last_updated = CURRENT_TIMESTAMP
    WHERE id = v_existing_id;
  ELSE
    INSERT INTO player_match_statistics (player_id, opponent_id, map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate, avg_elo_change)
    VALUES (NEW.winner_id, NULL, v_map_id, NULL, NULL, 1, 1, 0, 100.00, COALESCE(NEW.elo_change, 0));
  END IF;
  
  -- Update loser map stats
  SELECT id INTO v_existing_id FROM player_match_statistics 
  WHERE player_id = NEW.loser_id AND opponent_id IS NULL AND map_id = v_map_id AND faction_id IS NULL LIMIT 1;
  
  IF v_existing_id IS NOT NULL THEN
    UPDATE player_match_statistics SET
      total_games = total_games + 1,
      losses = losses + 1,
      winrate = ROUND(100.0 * wins::NUMERIC / (total_games + 1), 2),
      avg_elo_change = ROUND(((avg_elo_change * total_games) - COALESCE(NEW.elo_change, 0)) / (total_games + 1), 2),
      last_updated = CURRENT_TIMESTAMP
    WHERE id = v_existing_id;
  ELSE
    INSERT INTO player_match_statistics (player_id, opponent_id, map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate, avg_elo_change)
    VALUES (NEW.loser_id, NULL, v_map_id, NULL, NULL, 1, 0, 1, 0.00, -COALESCE(NEW.elo_change, 0));
  END IF;
  
  -- Update winner faction stats
  SELECT id INTO v_existing_id FROM player_match_statistics 
  WHERE player_id = NEW.winner_id AND opponent_id IS NULL AND map_id IS NULL AND faction_id = v_winner_faction_id LIMIT 1;
  
  IF v_existing_id IS NOT NULL THEN
    UPDATE player_match_statistics SET
      total_games = total_games + 1,
      wins = wins + 1,
      winrate = ROUND(100.0 * (wins + 1)::NUMERIC / (total_games + 1), 2),
      avg_elo_change = ROUND(((avg_elo_change * total_games) + COALESCE(NEW.elo_change, 0)) / (total_games + 1), 2),
      last_updated = CURRENT_TIMESTAMP
    WHERE id = v_existing_id;
  ELSE
    INSERT INTO player_match_statistics (player_id, opponent_id, map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate, avg_elo_change)
    VALUES (NEW.winner_id, NULL, NULL, v_winner_faction_id, NULL, 1, 1, 0, 100.00, COALESCE(NEW.elo_change, 0));
  END IF;
  
  -- Update loser faction stats
  SELECT id INTO v_existing_id FROM player_match_statistics 
  WHERE player_id = NEW.loser_id AND opponent_id IS NULL AND map_id IS NULL AND faction_id = v_loser_faction_id LIMIT 1;
  
  IF v_existing_id IS NOT NULL THEN
    UPDATE player_match_statistics SET
      total_games = total_games + 1,
      losses = losses + 1,
      winrate = ROUND(100.0 * wins::NUMERIC / (total_games + 1), 2),
      avg_elo_change = ROUND(((avg_elo_change * total_games) - COALESCE(NEW.elo_change, 0)) / (total_games + 1), 2),
      last_updated = CURRENT_TIMESTAMP
    WHERE id = v_existing_id;
  ELSE
    INSERT INTO player_match_statistics (player_id, opponent_id, map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate, avg_elo_change)
    VALUES (NEW.loser_id, NULL, NULL, v_loser_faction_id, NULL, 1, 0, 1, 0.00, -COALESCE(NEW.elo_change, 0));
  END IF;
  
  -- Update winner head-to-head
  SELECT id INTO v_existing_id FROM player_match_statistics 
  WHERE player_id = NEW.winner_id AND opponent_id = NEW.loser_id AND map_id = v_map_id AND faction_id = v_winner_faction_id LIMIT 1;
  
  IF v_existing_id IS NOT NULL THEN
    UPDATE player_match_statistics SET
      total_games = total_games + 1,
      wins = wins + 1,
      winrate = ROUND(100.0 * (wins + 1)::NUMERIC / (total_games + 1), 2),
      avg_elo_change = ROUND(((avg_elo_change * total_games) + COALESCE(NEW.elo_change, 0)) / (total_games + 1), 2),
      last_updated = CURRENT_TIMESTAMP
    WHERE id = v_existing_id;
  ELSE
    INSERT INTO player_match_statistics (player_id, opponent_id, map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate, avg_elo_change)
    VALUES (NEW.winner_id, NEW.loser_id, v_map_id, v_winner_faction_id, v_loser_faction_id, 1, 1, 0, 100.00, COALESCE(NEW.elo_change, 0));
  END IF;
  
  -- Update loser head-to-head
  SELECT id INTO v_existing_id FROM player_match_statistics 
  WHERE player_id = NEW.loser_id AND opponent_id = NEW.winner_id AND map_id = v_map_id AND faction_id = v_loser_faction_id LIMIT 1;
  
  IF v_existing_id IS NOT NULL THEN
    UPDATE player_match_statistics SET
      total_games = total_games + 1,
      losses = losses + 1,
      winrate = ROUND(100.0 * wins::NUMERIC / (total_games + 1), 2),
      avg_elo_change = ROUND(((avg_elo_change * total_games) - COALESCE(NEW.elo_change, 0)) / (total_games + 1), 2),
      last_updated = CURRENT_TIMESTAMP
    WHERE id = v_existing_id;
  ELSE
    INSERT INTO player_match_statistics (player_id, opponent_id, map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate, avg_elo_change)
    VALUES (NEW.loser_id, NEW.winner_id, v_map_id, v_loser_faction_id, v_winner_faction_id, 1, 0, 1, 0.00, -COALESCE(NEW.elo_change, 0));
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger
CREATE TRIGGER trg_update_player_match_stats
AFTER INSERT OR UPDATE ON matches
FOR EACH ROW
EXECUTE FUNCTION update_player_match_statistics();

-- Recalculate function - simple and clear
CREATE OR REPLACE FUNCTION recalculate_player_match_statistics()
RETURNS void AS $$
BEGIN
  -- Clear existing statistics
  DELETE FROM player_match_statistics;
  
  -- Rebuild all statistics from matches
  WITH match_data AS (
    SELECT
      m.winner_id as player_id,
      NULL::UUID as opponent_id,
      NULL::UUID as map_id,
      NULL::UUID as faction_id,
      NULL::UUID as opponent_faction_id,
      1 as is_win
    FROM matches m
    WHERE m.status = 'confirmed' AND NOT (m.admin_reviewed = true AND m.status = 'cancelled')
    
    UNION ALL
    
    SELECT
      m.loser_id as player_id,
      NULL::UUID as opponent_id,
      NULL::UUID as map_id,
      NULL::UUID as faction_id,
      NULL::UUID as opponent_faction_id,
      0 as is_win
    FROM matches m
    WHERE m.status = 'confirmed' AND NOT (m.admin_reviewed = true AND m.status = 'cancelled')
    
    UNION ALL
    
    SELECT
      m.winner_id as player_id,
      NULL::UUID as opponent_id,
      gm.id as map_id,
      NULL::UUID as faction_id,
      NULL::UUID as opponent_faction_id,
      1 as is_win
    FROM matches m
    JOIN game_maps gm ON m.map = gm.name
    WHERE m.status = 'confirmed' AND NOT (m.admin_reviewed = true AND m.status = 'cancelled')
    
    UNION ALL
    
    SELECT
      m.loser_id as player_id,
      NULL::UUID as opponent_id,
      gm.id as map_id,
      NULL::UUID as faction_id,
      NULL::UUID as opponent_faction_id,
      0 as is_win
    FROM matches m
    JOIN game_maps gm ON m.map = gm.name
    WHERE m.status = 'confirmed' AND NOT (m.admin_reviewed = true AND m.status = 'cancelled')
    
    UNION ALL
    
    SELECT
      m.winner_id as player_id,
      NULL::UUID as opponent_id,
      NULL::UUID as map_id,
      f.id as faction_id,
      NULL::UUID as opponent_faction_id,
      1 as is_win
    FROM matches m
    JOIN factions f ON m.winner_faction = f.name
    WHERE m.status = 'confirmed' AND NOT (m.admin_reviewed = true AND m.status = 'cancelled')
    
    UNION ALL
    
    SELECT
      m.loser_id as player_id,
      NULL::UUID as opponent_id,
      NULL::UUID as map_id,
      f.id as faction_id,
      NULL::UUID as opponent_faction_id,
      0 as is_win
    FROM matches m
    JOIN factions f ON m.loser_faction = f.name
    WHERE m.status = 'confirmed' AND NOT (m.admin_reviewed = true AND m.status = 'cancelled')
    
    UNION ALL
    
    SELECT
      m.winner_id as player_id,
      m.loser_id as opponent_id,
      gm.id as map_id,
      f_w.id as faction_id,
      f_l.id as opponent_faction_id,
      1 as is_win
    FROM matches m
    JOIN game_maps gm ON m.map = gm.name
    JOIN factions f_w ON m.winner_faction = f_w.name
    JOIN factions f_l ON m.loser_faction = f_l.name
    WHERE m.status = 'confirmed' AND NOT (m.admin_reviewed = true AND m.status = 'cancelled')
    
    UNION ALL
    
    SELECT
      m.loser_id as player_id,
      m.winner_id as opponent_id,
      gm.id as map_id,
      f_l.id as faction_id,
      f_w.id as opponent_faction_id,
      0 as is_win
    FROM matches m
    JOIN game_maps gm ON m.map = gm.name
    JOIN factions f_w ON m.winner_faction = f_w.name
    JOIN factions f_l ON m.loser_faction = f_l.name
    WHERE m.status = 'confirmed' AND NOT (m.admin_reviewed = true AND m.status = 'cancelled')
  )
  INSERT INTO player_match_statistics (player_id, opponent_id, map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate, avg_elo_change, created_at, last_updated)
  SELECT
    player_id,
    opponent_id,
    map_id,
    faction_id,
    opponent_faction_id,
    COUNT(*) as total_games,
    SUM(CASE WHEN is_win = 1 THEN 1 ELSE 0 END) as wins,
    SUM(CASE WHEN is_win = 0 THEN 1 ELSE 0 END) as losses,
    ROUND(100.0 * SUM(CASE WHEN is_win = 1 THEN 1 ELSE 0 END)::NUMERIC / COUNT(*), 2) as winrate,
    0::NUMERIC(8,2) as avg_elo_change,
    NOW(),
    NOW()
  FROM match_data
  GROUP BY player_id, opponent_id, map_id, faction_id, opponent_faction_id;
  
  RAISE NOTICE 'Player match statistics recalculated successfully';
END;
$$ LANGUAGE plpgsql;

COMMENT ON TABLE player_match_statistics IS 'Player match statistics with support for global, per-map, per-faction, and head-to-head queries';
