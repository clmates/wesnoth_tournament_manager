-- Create player_match_statistics table for comprehensive player analysis
-- Single flexible table that supports multiple query patterns via NULL values

CREATE TABLE IF NOT EXISTS player_match_statistics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  opponent_id UUID REFERENCES users(id) ON DELETE CASCADE,
  map_id UUID REFERENCES game_maps(id) ON DELETE CASCADE,
  faction_id UUID REFERENCES factions(id) ON DELETE CASCADE,
  opponent_faction_id UUID REFERENCES factions(id) ON DELETE CASCADE,
  
  -- Metrics
  total_games INT DEFAULT 0,
  wins INT DEFAULT 0,
  losses INT DEFAULT 0,
  winrate DECIMAL(5, 2),
  avg_elo_change DECIMAL(8, 2),
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create unique index that handles NULL values correctly
CREATE UNIQUE INDEX IF NOT EXISTS idx_player_stats_unique 
  ON player_match_statistics(
    player_id,
    COALESCE(opponent_id, '00000000-0000-0000-0000-000000000000'::UUID),
    COALESCE(map_id, '00000000-0000-0000-0000-000000000000'::UUID),
    COALESCE(faction_id, '00000000-0000-0000-0000-000000000000'::UUID),
    COALESCE(opponent_faction_id, '00000000-0000-0000-0000-000000000000'::UUID)
  );

-- Create indices for common query patterns
CREATE INDEX IF NOT EXISTS idx_player_stats_player 
  ON player_match_statistics(player_id);

CREATE INDEX IF NOT EXISTS idx_player_stats_opponent 
  ON player_match_statistics(opponent_id) 
  WHERE opponent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_player_stats_map 
  ON player_match_statistics(map_id) 
  WHERE map_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_player_stats_faction 
  ON player_match_statistics(faction_id) 
  WHERE faction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_player_stats_player_opponent 
  ON player_match_statistics(player_id, opponent_id) 
  WHERE opponent_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_player_stats_player_map 
  ON player_match_statistics(player_id, map_id) 
  WHERE map_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_player_stats_player_faction 
  ON player_match_statistics(player_id, faction_id) 
  WHERE faction_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_player_stats_global 
  ON player_match_statistics(player_id) 
  WHERE opponent_id IS NULL AND map_id IS NULL AND faction_id IS NULL;

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
  
  -- Update winner player stats (global) - check if exists first
  SELECT id INTO v_existing_id FROM player_match_statistics 
  WHERE player_id = NEW.winner_id 
    AND opponent_id IS NULL 
    AND map_id IS NULL 
    AND faction_id IS NULL 
    AND opponent_faction_id IS NULL 
  LIMIT 1;
  
  IF v_existing_id IS NOT NULL THEN
    UPDATE player_match_statistics SET
      total_games = total_games + 1,
      wins = wins + 1,
      winrate = ROUND(100.0 * (wins + 1)::NUMERIC / (total_games + 1), 2),
      avg_elo_change = ROUND(((avg_elo_change * total_games) + COALESCE(NEW.elo_change, 0)) / (total_games + 1), 2),
      last_updated = CURRENT_TIMESTAMP
    WHERE id = v_existing_id;
  ELSE
    INSERT INTO player_match_statistics 
      (player_id, opponent_id, map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate, avg_elo_change)
    VALUES 
      (NEW.winner_id, NULL, NULL, NULL, NULL, 1, 1, 0, 100.00, COALESCE(NEW.elo_change, 0));
  END IF;
  
  -- Update loser player stats (global)
  SELECT id INTO v_existing_id FROM player_match_statistics 
  WHERE player_id = NEW.loser_id 
    AND opponent_id IS NULL 
    AND map_id IS NULL 
    AND faction_id IS NULL 
    AND opponent_faction_id IS NULL 
  LIMIT 1;
  
  IF v_existing_id IS NOT NULL THEN
    UPDATE player_match_statistics SET
      total_games = total_games + 1,
      losses = losses + 1,
      winrate = ROUND(100.0 * wins::NUMERIC / (total_games + 1), 2),
      avg_elo_change = ROUND(((avg_elo_change * total_games) - COALESCE(NEW.elo_change, 0)) / (total_games + 1), 2),
      last_updated = CURRENT_TIMESTAMP
    WHERE id = v_existing_id;
  ELSE
    INSERT INTO player_match_statistics 
      (player_id, opponent_id, map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate, avg_elo_change)
    VALUES 
      (NEW.loser_id, NULL, NULL, NULL, NULL, 1, 0, 1, 0.00, -COALESCE(NEW.elo_change, 0));
  END IF;
  
  -- Update head-to-head stats (winner vs loser)
  SELECT id INTO v_existing_id FROM player_match_statistics 
  WHERE player_id = NEW.winner_id 
    AND opponent_id = NEW.loser_id 
    AND map_id = v_map_id 
    AND faction_id = v_winner_faction_id 
    AND opponent_faction_id = v_loser_faction_id 
  LIMIT 1;
  
  IF v_existing_id IS NOT NULL THEN
    UPDATE player_match_statistics SET
      total_games = total_games + 1,
      wins = wins + 1,
      winrate = ROUND(100.0 * (wins + 1)::NUMERIC / (total_games + 1), 2),
      avg_elo_change = ROUND(((avg_elo_change * total_games) + COALESCE(NEW.elo_change, 0)) / (total_games + 1), 2),
      last_updated = CURRENT_TIMESTAMP
    WHERE id = v_existing_id;
  ELSE
    INSERT INTO player_match_statistics 
      (player_id, opponent_id, map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate, avg_elo_change)
    VALUES 
      (NEW.winner_id, NEW.loser_id, v_map_id, v_winner_faction_id, v_loser_faction_id, 1, 1, 0, 100.00, COALESCE(NEW.elo_change, 0));
  END IF;
  
  -- Update head-to-head stats (loser vs winner)
  SELECT id INTO v_existing_id FROM player_match_statistics 
  WHERE player_id = NEW.loser_id 
    AND opponent_id = NEW.winner_id 
    AND map_id = v_map_id 
    AND faction_id = v_loser_faction_id 
    AND opponent_faction_id = v_winner_faction_id 
  LIMIT 1;
  
  IF v_existing_id IS NOT NULL THEN
    UPDATE player_match_statistics SET
      total_games = total_games + 1,
      losses = losses + 1,
      winrate = ROUND(100.0 * wins::NUMERIC / (total_games + 1), 2),
      avg_elo_change = ROUND(((avg_elo_change * total_games) - COALESCE(NEW.elo_change, 0)) / (total_games + 1), 2),
      last_updated = CURRENT_TIMESTAMP
    WHERE id = v_existing_id;
  ELSE
    INSERT INTO player_match_statistics 
      (player_id, opponent_id, map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate, avg_elo_change)
    VALUES 
      (NEW.loser_id, NEW.winner_id, v_map_id, v_loser_faction_id, v_winner_faction_id, 1, 0, 1, 0.00, -COALESCE(NEW.elo_change, 0));
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trg_update_player_match_stats ON matches;

-- Create trigger to maintain statistics on match insertion/update
CREATE TRIGGER trg_update_player_match_stats
AFTER INSERT OR UPDATE ON matches
FOR EACH ROW
EXECUTE FUNCTION update_player_match_statistics();

-- Function to recalculate all player statistics
CREATE OR REPLACE FUNCTION recalculate_player_match_statistics()
RETURNS void AS $$
BEGIN
  -- Clear existing statistics
  TRUNCATE TABLE player_match_statistics;
  
  -- Insert all player statistics
  INSERT INTO player_match_statistics 
    (player_id, opponent_id, map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate, avg_elo_change, created_at, last_updated)
  SELECT
    m.winner_id as player_id,
    NULL::UUID as opponent_id,
    NULL::UUID as map_id,
    NULL::UUID as faction_id,
    NULL::UUID as opponent_faction_id,
    COUNT(*) as total_games,
    COUNT(*) as wins,
    0 as losses,
    100.00 as winrate,
    AVG(COALESCE(m.elo_change, 0)) as avg_elo_change,
    NOW(),
    NOW()
  FROM matches m
  WHERE m.status = 'confirmed' AND NOT (m.admin_reviewed = true AND m.status = 'cancelled')
  GROUP BY m.winner_id
  
  UNION ALL
  
  SELECT
    m.loser_id as player_id,
    NULL::UUID as opponent_id,
    NULL::UUID as map_id,
    NULL::UUID as faction_id,
    NULL::UUID as opponent_faction_id,
    COUNT(*) as total_games,
    0 as wins,
    COUNT(*) as losses,
    0.00 as winrate,
    AVG(-COALESCE(m.elo_change, 0)) as avg_elo_change,
    NOW(),
    NOW()
  FROM matches m
  WHERE m.status = 'confirmed' AND NOT (m.admin_reviewed = true AND m.status = 'cancelled')
  GROUP BY m.loser_id;
  
  RAISE NOTICE 'Player match statistics recalculated successfully';
END;
$$ LANGUAGE plpgsql;

-- Add comments
COMMENT ON TABLE player_match_statistics IS 'Comprehensive player statistics with support for global, head-to-head, map-specific, and faction-specific queries. NULL values indicate "all" for that dimension.';
COMMENT ON COLUMN player_match_statistics.opponent_id IS 'NULL = global stats, specific UUID = head-to-head vs that player';
COMMENT ON COLUMN player_match_statistics.map_id IS 'NULL = all maps, specific UUID = stats on that map only';
COMMENT ON COLUMN player_match_statistics.faction_id IS 'NULL = all factions, specific UUID = stats with that faction only';
COMMENT ON COLUMN player_match_statistics.avg_elo_change IS 'Average ELO change per game (positive = gaining ELO, negative = losing ELO)';
