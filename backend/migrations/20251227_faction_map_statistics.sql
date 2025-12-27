-- Create faction_map_statistics table for balance analysis
-- This is a cube/fact table for fast analytical queries on faction balance

CREATE TABLE IF NOT EXISTS faction_map_statistics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Dimensions (map and faction matchup)
  map_id UUID NOT NULL REFERENCES game_maps(id) ON DELETE CASCADE,
  faction_id UUID NOT NULL REFERENCES factions(id) ON DELETE CASCADE,
  opponent_faction_id UUID NOT NULL REFERENCES factions(id) ON DELETE CASCADE,
  
  -- Metrics
  total_games INT DEFAULT 0,
  wins INT DEFAULT 0,
  losses INT DEFAULT 0,
  winrate DECIMAL(5, 2),
  
  -- Metadata
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  -- Unique constraint to prevent duplicate entries
  CONSTRAINT unique_faction_map_matchup UNIQUE(map_id, faction_id, opponent_faction_id)
);

-- Create indices for common query patterns
CREATE INDEX IF NOT EXISTS idx_faction_map_stats_map 
  ON faction_map_statistics(map_id);

CREATE INDEX IF NOT EXISTS idx_faction_map_stats_faction 
  ON faction_map_statistics(faction_id);

CREATE INDEX IF NOT EXISTS idx_faction_map_stats_opponent_faction 
  ON faction_map_statistics(opponent_faction_id);

CREATE INDEX IF NOT EXISTS idx_faction_map_stats_matchup 
  ON faction_map_statistics(faction_id, opponent_faction_id);

CREATE INDEX IF NOT EXISTS idx_faction_map_stats_map_faction 
  ON faction_map_statistics(map_id, faction_id);

-- Function to update statistics after each match
-- This is called by the trigger when matches are inserted or updated
CREATE OR REPLACE FUNCTION update_faction_map_statistics()
RETURNS TRIGGER AS $$
DECLARE
  v_map_id UUID;
  v_winner_faction_id UUID;
  v_loser_faction_id UUID;
BEGIN
  -- Only process confirmed matches
  IF NEW.status != 'confirmed' THEN
    RETURN NEW;
  END IF;
  
  -- Get map ID from map name
  SELECT id INTO v_map_id FROM game_maps WHERE name = NEW.map LIMIT 1;
  IF v_map_id IS NULL THEN
    RETURN NEW; -- Map not found, skip statistics update
  END IF;
  
  -- Get winner faction ID from faction name
  SELECT id INTO v_winner_faction_id FROM factions WHERE name = NEW.winner_faction LIMIT 1;
  IF v_winner_faction_id IS NULL THEN
    RETURN NEW; -- Winner faction not found, skip statistics update
  END IF;
  
  -- Get loser faction ID from faction name
  SELECT id INTO v_loser_faction_id FROM factions WHERE name = NEW.loser_faction LIMIT 1;
  IF v_loser_faction_id IS NULL THEN
    RETURN NEW; -- Loser faction not found, skip statistics update
  END IF;
  
  -- Insert or update for winner faction
  INSERT INTO faction_map_statistics 
    (map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate)
  VALUES 
    (v_map_id, v_winner_faction_id, v_loser_faction_id, 1, 1, 0, 100.00)
  ON CONFLICT (map_id, faction_id, opponent_faction_id)
  DO UPDATE SET 
    total_games = total_games + 1,
    wins = wins + 1,
    winrate = ROUND(100.0 * (excluded.wins + 1) / (excluded.total_games + 1), 2)::NUMERIC(5,2),
    last_updated = CURRENT_TIMESTAMP;
  
  -- Insert or update for loser faction (reverse perspective)
  INSERT INTO faction_map_statistics 
    (map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate)
  VALUES 
    (v_map_id, v_loser_faction_id, v_winner_faction_id, 1, 0, 1, 0.00)
  ON CONFLICT (map_id, faction_id, opponent_faction_id)
  DO UPDATE SET 
    total_games = total_games + 1,
    losses = losses + 1,
    winrate = ROUND(100.0 * excluded.wins / (excluded.total_games + 1), 2)::NUMERIC(5,2),
    last_updated = CURRENT_TIMESTAMP;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Drop existing trigger if it exists
DROP TRIGGER IF EXISTS trg_update_faction_map_stats ON matches;

-- Create trigger to maintain statistics on match insertion/update
CREATE TRIGGER trg_update_faction_map_stats
AFTER INSERT OR UPDATE ON matches
FOR EACH ROW
EXECUTE FUNCTION update_faction_map_statistics();

-- Function to recalculate all statistics (useful for initial load or corrections)
-- This rebuilds the entire statistics table from scratch using confirmed matches
CREATE OR REPLACE FUNCTION recalculate_faction_map_statistics()
RETURNS void AS $$
DECLARE
  v_total_records INT := 0;
BEGIN
  -- Clear existing statistics
  TRUNCATE TABLE faction_map_statistics;
  
  -- Get map IDs and faction IDs from the matches table
  -- Insert for all winner factions
  WITH winner_stats AS (
    SELECT
      gm.id as map_id,
      f_winner.id as faction_id,
      f_loser.id as opponent_faction_id,
      COUNT(*)::INT as total_games,
      COUNT(*)::INT as wins,
      0::INT as losses
    FROM matches m
    JOIN game_maps gm ON gm.name = m.map
    JOIN factions f_winner ON f_winner.name = m.winner_faction
    JOIN factions f_loser ON f_loser.name = m.loser_faction
    WHERE m.status = 'confirmed'
    GROUP BY gm.id, f_winner.id, f_loser.id
  )
  INSERT INTO faction_map_statistics (map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate)
  SELECT 
    map_id,
    faction_id,
    opponent_faction_id,
    total_games,
    wins,
    losses,
    ROUND(100.0 * wins / total_games, 2)::NUMERIC(5,2)
  FROM winner_stats;

  -- Insert for all loser factions
  WITH loser_stats AS (
    SELECT
      gm.id as map_id,
      f_loser.id as faction_id,
      f_winner.id as opponent_faction_id,
      COUNT(*)::INT as total_games,
      0::INT as wins,
      COUNT(*)::INT as losses
    FROM matches m
    JOIN game_maps gm ON gm.name = m.map
    JOIN factions f_winner ON f_winner.name = m.winner_faction
    JOIN factions f_loser ON f_loser.name = m.loser_faction
    WHERE m.status = 'confirmed'
    GROUP BY gm.id, f_loser.id, f_winner.id
  )
  INSERT INTO faction_map_statistics (map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate)
  SELECT 
    map_id,
    faction_id,
    opponent_faction_id,
    total_games,
    wins,
    losses,
    ROUND(100.0 * wins / total_games, 2)::NUMERIC(5,2)
  FROM loser_stats;

  GET DIAGNOSTICS v_total_records = ROW_COUNT;
  RAISE NOTICE 'Faction map statistics recalculated successfully: % records inserted', v_total_records;
END;
$$ LANGUAGE plpgsql;

-- Add comment for documentation
COMMENT ON TABLE faction_map_statistics IS 'Cube/fact table for fast analytical queries on faction balance across maps. Tracks winrates and matchup statistics.';
COMMENT ON COLUMN faction_map_statistics.faction_id IS 'The faction being analyzed';
COMMENT ON COLUMN faction_map_statistics.opponent_faction_id IS 'The opposing faction';
COMMENT ON COLUMN faction_map_statistics.winrate IS 'Percentage of games won by faction_id';
