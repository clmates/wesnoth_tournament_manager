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
CREATE OR REPLACE FUNCTION update_faction_map_statistics()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process confirmed matches
  IF NEW.status != 'confirmed' THEN
    RETURN NEW;
  END IF;
  
  -- Insert or update for winner faction
  INSERT INTO faction_map_statistics 
    (map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate)
  VALUES 
    (NEW.map_id, NEW.winner_faction_id, NEW.loser_faction_id, 1, 1, 0, 100.00)
  ON CONFLICT (map_id, faction_id, opponent_faction_id)
  DO UPDATE SET 
    total_games = total_games + 1,
    wins = wins + 1,
    winrate = ROUND(100.0 * (excluded.wins + 1) / (excluded.total_games + 1), 2),
    last_updated = CURRENT_TIMESTAMP;
  
  -- Insert or update for loser faction (reverse perspective)
  INSERT INTO faction_map_statistics 
    (map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate)
  VALUES 
    (NEW.map_id, NEW.loser_faction_id, NEW.winner_faction_id, 1, 0, 1, 0.00)
  ON CONFLICT (map_id, faction_id, opponent_faction_id)
  DO UPDATE SET 
    total_games = total_games + 1,
    losses = losses + 1,
    winrate = ROUND(100.0 * excluded.wins / (excluded.total_games + 1), 2),
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
CREATE OR REPLACE FUNCTION recalculate_faction_map_statistics()
RETURNS void AS $$
BEGIN
  -- Clear existing statistics
  TRUNCATE TABLE faction_map_statistics;
  
  -- Rebuild from matches
  INSERT INTO faction_map_statistics 
    (map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate)
  SELECT 
    m.map_id,
    m.winner_faction_id,
    m.loser_faction_id,
    COUNT(*)::INT,
    COUNT(*)::INT,
    0,
    ROUND(100.0 * COUNT(*) / (
      SELECT COUNT(*) 
      FROM matches m2 
      WHERE m2.map_id = m.map_id 
      AND (m2.winner_faction_id = m.winner_faction_id OR m2.loser_faction_id = m.winner_faction_id)
      AND m2.status = 'confirmed'
    ), 2)
  FROM matches m
  WHERE m.status = 'confirmed'
  GROUP BY m.map_id, m.winner_faction_id, m.loser_faction_id
  
  UNION ALL
  
  SELECT 
    m.map_id,
    m.loser_faction_id,
    m.winner_faction_id,
    COUNT(*)::INT,
    0,
    COUNT(*)::INT,
    ROUND(100.0 * (SELECT COUNT(*) FROM matches m2 WHERE m2.map_id = m.map_id AND m2.winner_faction_id = m.loser_faction_id AND m2.loser_faction_id = m.winner_faction_id AND m2.status = 'confirmed')::NUMERIC / COUNT(*)::NUMERIC, 2)
  FROM matches m
  WHERE m.status = 'confirmed'
  GROUP BY m.map_id, m.loser_faction_id, m.winner_faction_id;
  
  RAISE NOTICE 'Faction map statistics recalculated successfully';
END;
$$ LANGUAGE plpgsql;

-- Add comment for documentation
COMMENT ON TABLE faction_map_statistics IS 'Cube/fact table for fast analytical queries on faction balance across maps. Tracks winrates and matchup statistics.';
COMMENT ON COLUMN faction_map_statistics.faction_id IS 'The faction being analyzed';
COMMENT ON COLUMN faction_map_statistics.opponent_faction_id IS 'The opposing faction';
COMMENT ON COLUMN faction_map_statistics.winrate IS 'Percentage of games won by faction_id';

-- Function to update statistics after each match
CREATE OR REPLACE FUNCTION update_faction_map_statistics()
RETURNS TRIGGER AS $$
BEGIN
  -- Only process confirmed matches
  IF NEW.status != 'confirmed' THEN
    RETURN NEW;
  END IF;
  
  -- Insert or update for winner faction
  INSERT INTO faction_map_statistics 
    (map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate)
  VALUES 
    (NEW.map_id, NEW.winner_faction_id, NEW.loser_faction_id, 1, 1, 0, 100.00)
  ON CONFLICT (map_id, faction_id, opponent_faction_id)
  DO UPDATE SET 
    total_games = total_games + 1,
    wins = wins + 1,
    winrate = ROUND(100.0 * (excluded.wins + 1) / (excluded.total_games + 1), 2),
    last_updated = CURRENT_TIMESTAMP;
  
  -- Insert or update for loser faction (reverse perspective)
  INSERT INTO faction_map_statistics 
    (map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate)
  VALUES 
    (NEW.map_id, NEW.loser_faction_id, NEW.winner_faction_id, 1, 0, 1, 0.00)
  ON CONFLICT (map_id, faction_id, opponent_faction_id)
  DO UPDATE SET 
    total_games = total_games + 1,
    losses = losses + 1,
    winrate = ROUND(100.0 * excluded.wins / (excluded.total_games + 1), 2),
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
CREATE OR REPLACE FUNCTION recalculate_faction_map_statistics()
RETURNS void AS $$
BEGIN
  -- Clear existing statistics
  TRUNCATE TABLE faction_map_statistics;
  
  -- Rebuild from matches
  INSERT INTO faction_map_statistics 
    (map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate)
  SELECT 
    m.map_id,
    m.winner_faction_id,
    m.loser_faction_id,
    COUNT(*),
    COUNT(*),
    0,
    ROUND(100.0 * COUNT(*) / (
      SELECT COUNT(*) 
      FROM matches m2 
      WHERE m2.map_id = m.map_id 
      AND (m2.winner_faction_id = m.winner_faction_id OR m2.loser_faction_id = m.winner_faction_id)
      AND m2.status = 'confirmed'
    ), 2)
  FROM matches m
  WHERE m.status = 'confirmed'
  GROUP BY m.map_id, m.winner_faction_id, m.loser_faction_id
  
  UNION ALL
  
  SELECT 
    m.map_id,
    m.loser_faction_id,
    m.winner_faction_id,
    COUNT(*),
    0,
    COUNT(*),
    ROUND(100.0 * (SELECT COUNT(*) FROM matches m2 WHERE m2.map_id = m.map_id AND m2.winner_faction_id = m.loser_faction_id AND m2.loser_faction_id = m.winner_faction_id AND m2.status = 'confirmed') / COUNT(*), 2)
  FROM matches m
  WHERE m.status = 'confirmed'
  GROUP BY m.map_id, m.loser_faction_id, m.winner_faction_id;
  
  RAISE NOTICE 'Faction map statistics recalculated successfully';
END;
$$ LANGUAGE plpgsql;

-- Add comment for documentation
COMMENT ON TABLE faction_map_statistics IS 'Cube/fact table for fast analytical queries on faction balance across maps. Tracks winrates and matchup statistics.';
COMMENT ON COLUMN faction_map_statistics.faction_id IS 'The faction being analyzed';
COMMENT ON COLUMN faction_map_statistics.opponent_faction_id IS 'The opposing faction';
COMMENT ON COLUMN faction_map_statistics.winrate IS 'Percentage of games won by faction_id';
