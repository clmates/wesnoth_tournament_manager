-- ============================================================================
-- UNIFIED MIGRATION: Player Match Statistics - Complete Implementation
-- ============================================================================
-- Date: 2025-12-30
-- Purpose: Consolidates all player statistics functionality with pre-calculated
--          aggregates for O(1) query performance using NULL-based grouping
-- Replaces: 8 fragmented migrations (see deprecated/ folder)
-- Previous: Manual SUPABASE_MANUAL_MIGRATION.sql - this file is the backend
--           automated migration version with identical logic
-- ============================================================================

-- ============================================================================
-- STEP 1: Create player_match_statistics table
-- ============================================================================

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
  last_elo_against_me DECIMAL(8, 2),
  elo_gained DECIMAL(8, 2) DEFAULT 0,
  elo_lost DECIMAL(8, 2) DEFAULT 0,
  last_match_date TIMESTAMP,
  
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

-- ============================================================================
-- STEP 2: Create update trigger function
-- ============================================================================

CREATE OR REPLACE FUNCTION update_player_match_statistics()
RETURNS TRIGGER AS $$
DECLARE
  v_winner_id UUID;
  v_loser_id UUID;
  v_winner_elo_after INT;
  v_loser_elo_after INT;
  v_winner_elo_before INT;
  v_loser_elo_before INT;
  v_map_id UUID;
  v_winner_faction_id UUID;
  v_loser_faction_id UUID;
  v_elo_change INT;
  v_existing_id UUID;
BEGIN
  -- Skip cancelled/disputed matches
  IF NEW.admin_reviewed = true AND NEW.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  v_winner_id := NEW.winner_id;
  v_loser_id := NEW.loser_id;
  v_winner_elo_after := NEW.winner_elo_after;
  v_loser_elo_after := NEW.loser_elo_after;
  v_winner_elo_before := NEW.winner_elo_before;
  v_loser_elo_before := NEW.loser_elo_before;

  -- Get map and faction IDs
  SELECT id INTO v_map_id FROM game_maps WHERE name = NEW.map LIMIT 1;
  SELECT id INTO v_winner_faction_id FROM factions WHERE name = NEW.winner_faction LIMIT 1;
  SELECT id INTO v_loser_faction_id FROM factions WHERE name = NEW.loser_faction LIMIT 1;

  IF v_map_id IS NULL OR v_winner_faction_id IS NULL OR v_loser_faction_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Calculate ELO changes
  v_elo_change := v_winner_elo_after - v_winner_elo_before;

  -- ===== WINNER GLOBAL STATS =====
  SELECT id INTO v_existing_id FROM player_match_statistics 
    WHERE player_id = v_winner_id AND opponent_id IS NULL AND map_id IS NULL AND faction_id IS NULL AND opponent_faction_id IS NULL;
  
  IF v_existing_id IS NOT NULL THEN
    UPDATE player_match_statistics SET
      total_games = total_games + 1,
      wins = wins + 1,
      winrate = ROUND(100.0 * (wins + 1) / (total_games + 1), 2)::NUMERIC(5,2),
      avg_elo_change = ROUND((avg_elo_change * total_games + v_elo_change) / (total_games + 1), 2)::NUMERIC(8,2),
      last_updated = CURRENT_TIMESTAMP
    WHERE id = v_existing_id;
  ELSE
    INSERT INTO player_match_statistics (player_id, opponent_id, map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate, avg_elo_change)
    VALUES (v_winner_id, NULL, NULL, NULL, NULL, 1, 1, 0, 100.00, v_elo_change::DECIMAL(8,2));
  END IF;

  -- ===== LOSER GLOBAL STATS =====
  SELECT id INTO v_existing_id FROM player_match_statistics 
    WHERE player_id = v_loser_id AND opponent_id IS NULL AND map_id IS NULL AND faction_id IS NULL AND opponent_faction_id IS NULL;
  
  v_elo_change := v_loser_elo_after - v_loser_elo_before;
  
  IF v_existing_id IS NOT NULL THEN
    UPDATE player_match_statistics SET
      total_games = total_games + 1,
      losses = losses + 1,
      winrate = ROUND(100.0 * wins / (total_games + 1), 2)::NUMERIC(5,2),
      avg_elo_change = ROUND((avg_elo_change * total_games + v_elo_change) / (total_games + 1), 2)::NUMERIC(8,2),
      last_updated = CURRENT_TIMESTAMP
    WHERE id = v_existing_id;
  ELSE
    INSERT INTO player_match_statistics (player_id, opponent_id, map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate, avg_elo_change)
    VALUES (v_loser_id, NULL, NULL, NULL, NULL, 1, 0, 1, 0.00, v_elo_change::DECIMAL(8,2));
  END IF;

  -- ===== WINNER vs LOSER HEAD-TO-HEAD =====
  v_elo_change := NEW.winner_elo_after - NEW.winner_elo_before;
  
  SELECT id INTO v_existing_id FROM player_match_statistics 
    WHERE player_id = v_winner_id AND opponent_id = v_loser_id 
    AND map_id = v_map_id AND faction_id = v_winner_faction_id AND opponent_faction_id = v_loser_faction_id;
  
  IF v_existing_id IS NOT NULL THEN
    UPDATE player_match_statistics SET
      total_games = total_games + 1,
      wins = wins + 1,
      winrate = ROUND(100.0 * (wins + 1) / (total_games + 1), 2)::NUMERIC(5,2),
      avg_elo_change = ROUND((avg_elo_change * total_games + v_elo_change) / (total_games + 1), 2)::NUMERIC(8,2),
      last_elo_against_me = NEW.loser_elo_after::DECIMAL(8,2),
      elo_gained = elo_gained + CASE WHEN v_elo_change > 0 THEN v_elo_change ELSE 0 END,
      last_match_date = NEW.created_at,
      last_updated = CURRENT_TIMESTAMP
    WHERE id = v_existing_id;
  ELSE
    INSERT INTO player_match_statistics (player_id, opponent_id, map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate, avg_elo_change, last_elo_against_me, elo_gained, elo_lost, last_match_date)
    VALUES (v_winner_id, v_loser_id, v_map_id, v_winner_faction_id, v_loser_faction_id, 1, 1, 0, 100.00, v_elo_change::DECIMAL(8,2), NEW.loser_elo_after::DECIMAL(8,2), CASE WHEN v_elo_change > 0 THEN v_elo_change::DECIMAL(8,2) ELSE 0 END, 0, NEW.created_at);
  END IF;

  -- ===== WINNER vs LOSER AGGREGATED (no map/faction) =====
  SELECT id INTO v_existing_id FROM player_match_statistics 
    WHERE player_id = v_winner_id AND opponent_id = v_loser_id 
    AND map_id IS NULL AND faction_id IS NULL AND opponent_faction_id IS NULL;
  
  IF v_existing_id IS NOT NULL THEN
    UPDATE player_match_statistics SET
      total_games = total_games + 1,
      wins = wins + 1,
      winrate = ROUND(100.0 * (wins + 1) / (total_games + 1), 2)::NUMERIC(5,2),
      avg_elo_change = ROUND((avg_elo_change * total_games + v_elo_change) / (total_games + 1), 2)::NUMERIC(8,2),
      last_elo_against_me = NEW.loser_elo_after::DECIMAL(8,2),
      elo_gained = elo_gained + CASE WHEN v_elo_change > 0 THEN v_elo_change ELSE 0 END,
      last_match_date = NEW.created_at,
      last_updated = CURRENT_TIMESTAMP
    WHERE id = v_existing_id;
  ELSE
    INSERT INTO player_match_statistics (player_id, opponent_id, map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate, avg_elo_change, last_elo_against_me, elo_gained, elo_lost, last_match_date)
    VALUES (v_winner_id, v_loser_id, NULL, NULL, NULL, 1, 1, 0, 100.00, v_elo_change::DECIMAL(8,2), NEW.loser_elo_after::DECIMAL(8,2), CASE WHEN v_elo_change > 0 THEN v_elo_change::DECIMAL(8,2) ELSE 0 END, 0, NEW.created_at);
  END IF;

  -- ===== LOSER vs WINNER HEAD-TO-HEAD =====
  v_elo_change := NEW.loser_elo_after - NEW.loser_elo_before;
  
  SELECT id INTO v_existing_id FROM player_match_statistics 
    WHERE player_id = v_loser_id AND opponent_id = v_winner_id 
    AND map_id = v_map_id AND faction_id = v_loser_faction_id AND opponent_faction_id = v_winner_faction_id;
  
  IF v_existing_id IS NOT NULL THEN
    UPDATE player_match_statistics SET
      total_games = total_games + 1,
      losses = losses + 1,
      winrate = ROUND(100.0 * wins / (total_games + 1), 2)::NUMERIC(5,2),
      avg_elo_change = ROUND((avg_elo_change * total_games + v_elo_change) / (total_games + 1), 2)::NUMERIC(8,2),
      last_elo_against_me = NEW.winner_elo_after::DECIMAL(8,2),
      elo_lost = elo_lost + CASE WHEN v_elo_change < 0 THEN ABS(v_elo_change) ELSE 0 END,
      last_match_date = NEW.created_at,
      last_updated = CURRENT_TIMESTAMP
    WHERE id = v_existing_id;
  ELSE
    INSERT INTO player_match_statistics (player_id, opponent_id, map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate, avg_elo_change, last_elo_against_me, elo_gained, elo_lost, last_match_date)
    VALUES (v_loser_id, v_winner_id, v_map_id, v_loser_faction_id, v_winner_faction_id, 1, 0, 1, 0.00, v_elo_change::DECIMAL(8,2), NEW.winner_elo_after::DECIMAL(8,2), 0, CASE WHEN v_elo_change < 0 THEN ABS(v_elo_change)::DECIMAL(8,2) ELSE 0 END, NEW.created_at);
  END IF;

  -- ===== LOSER vs WINNER AGGREGATED (no map/faction) =====
  SELECT id INTO v_existing_id FROM player_match_statistics 
    WHERE player_id = v_loser_id AND opponent_id = v_winner_id 
    AND map_id IS NULL AND faction_id IS NULL AND opponent_faction_id IS NULL;
  
  IF v_existing_id IS NOT NULL THEN
    UPDATE player_match_statistics SET
      total_games = total_games + 1,
      losses = losses + 1,
      winrate = ROUND(100.0 * wins / (total_games + 1), 2)::NUMERIC(5,2),
      avg_elo_change = ROUND((avg_elo_change * total_games + v_elo_change) / (total_games + 1), 2)::NUMERIC(8,2),
      last_elo_against_me = NEW.winner_elo_after::DECIMAL(8,2),
      elo_lost = elo_lost + CASE WHEN v_elo_change < 0 THEN ABS(v_elo_change) ELSE 0 END,
      last_match_date = NEW.created_at,
      last_updated = CURRENT_TIMESTAMP
    WHERE id = v_existing_id;
  ELSE
    INSERT INTO player_match_statistics (player_id, opponent_id, map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate, avg_elo_change, last_elo_against_me, elo_gained, elo_lost, last_match_date)
    VALUES (v_loser_id, v_winner_id, NULL, NULL, NULL, 1, 0, 1, 0.00, v_elo_change::DECIMAL(8,2), NEW.winner_elo_after::DECIMAL(8,2), 0, CASE WHEN v_elo_change < 0 THEN ABS(v_elo_change)::DECIMAL(8,2) ELSE 0 END, NEW.created_at);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger
DROP TRIGGER IF EXISTS trg_update_player_match_stats ON matches;
CREATE TRIGGER trg_update_player_match_stats
AFTER INSERT OR UPDATE ON matches
FOR EACH ROW
EXECUTE FUNCTION update_player_match_statistics();

-- ============================================================================
-- STEP 3: Create recalculation function
-- ============================================================================

CREATE OR REPLACE FUNCTION recalculate_player_match_statistics()
RETURNS void AS $$
BEGIN
  -- Drop and recreate table to ensure clean state
  DROP TABLE IF EXISTS player_match_statistics CASCADE;
  
  CREATE TABLE player_match_statistics (
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
    last_elo_against_me DECIMAL(8, 2),
    elo_gained DECIMAL(8, 2) DEFAULT 0,
    elo_lost DECIMAL(8, 2) DEFAULT 0,
    last_match_date TIMESTAMP,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- Create unique index
  CREATE UNIQUE INDEX idx_player_stats_unique 
    ON player_match_statistics(
      player_id,
      COALESCE(opponent_id, '00000000-0000-0000-0000-000000000000'::UUID),
      COALESCE(map_id, '00000000-0000-0000-0000-000000000000'::UUID),
      COALESCE(faction_id, '00000000-0000-0000-0000-000000000000'::UUID),
      COALESCE(opponent_faction_id, '00000000-0000-0000-0000-000000000000'::UUID)
    );

  -- Create indices
  CREATE INDEX idx_player_stats_player ON player_match_statistics(player_id);
  CREATE INDEX idx_player_stats_opponent ON player_match_statistics(opponent_id) WHERE opponent_id IS NOT NULL;
  CREATE INDEX idx_player_stats_map ON player_match_statistics(map_id) WHERE map_id IS NOT NULL;
  CREATE INDEX idx_player_stats_faction ON player_match_statistics(faction_id) WHERE faction_id IS NOT NULL;
  CREATE INDEX idx_player_stats_player_opponent ON player_match_statistics(player_id, opponent_id) WHERE opponent_id IS NOT NULL;
  CREATE INDEX idx_player_stats_player_map ON player_match_statistics(player_id, map_id) WHERE map_id IS NOT NULL;
  CREATE INDEX idx_player_stats_player_faction ON player_match_statistics(player_id, faction_id) WHERE faction_id IS NOT NULL;
  CREATE INDEX idx_player_stats_global ON player_match_statistics(player_id) WHERE opponent_id IS NULL AND map_id IS NULL AND faction_id IS NULL;
  
  -- ===== GLOBAL STATS (per player, aggregated from all matches) =====
  WITH all_player_games AS (
    SELECT m.winner_id as player_id, COUNT(*) as wins, 0 as losses, AVG(m.winner_elo_after - m.winner_elo_before) as avg_elo_change
    FROM matches m WHERE NOT (m.admin_reviewed = true AND m.status = 'cancelled') GROUP BY m.winner_id
    UNION ALL
    SELECT m.loser_id as player_id, 0 as wins, COUNT(*) as losses, AVG(m.loser_elo_after - m.loser_elo_before) as avg_elo_change
    FROM matches m WHERE NOT (m.admin_reviewed = true AND m.status = 'cancelled') GROUP BY m.loser_id
  )
  INSERT INTO player_match_statistics (player_id, opponent_id, map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate, avg_elo_change)
  SELECT
    player_id,
    NULL,
    NULL,
    NULL,
    NULL,
    SUM(wins + losses)::INT as total_games,
    SUM(wins)::INT as wins,
    SUM(losses)::INT as losses,
    CASE WHEN SUM(wins + losses) > 0 THEN ROUND(100.0 * SUM(wins) / SUM(wins + losses), 2)::NUMERIC(5,2) ELSE 0 END,
    AVG(avg_elo_change)::NUMERIC(8,2)
  FROM all_player_games
  GROUP BY player_id
  ON CONFLICT (player_id, COALESCE(opponent_id, '00000000-0000-0000-0000-000000000000'::UUID), COALESCE(map_id, '00000000-0000-0000-0000-000000000000'::UUID), COALESCE(faction_id, '00000000-0000-0000-0000-000000000000'::UUID), COALESCE(opponent_faction_id, '00000000-0000-0000-0000-000000000000'::UUID)) DO UPDATE SET
    total_games = EXCLUDED.total_games,
    wins = EXCLUDED.wins,
    losses = EXCLUDED.losses,
    winrate = EXCLUDED.winrate,
    avg_elo_change = EXCLUDED.avg_elo_change,
    last_updated = CURRENT_TIMESTAMP;

  -- ===== HEAD-TO-HEAD WINNER PERSPECTIVE =====
  WITH h2h_winner AS (
    SELECT
      m.winner_id as player_id,
      m.loser_id as opponent_id,
      gm.id as map_id,
      f_winner.id as faction_id,
      f_loser.id as opponent_faction_id,
      COUNT(*)::INT as wins,
      0::INT as losses,
      MAX(m.loser_elo_after)::DECIMAL(8,2) as last_elo_against_me,
      SUM(m.winner_elo_after - m.winner_elo_before)::NUMERIC(8,2) / COUNT(*) as avg_elo_change,
      SUM(CASE WHEN m.winner_elo_after - m.winner_elo_before > 0 THEN m.winner_elo_after - m.winner_elo_before ELSE 0 END)::NUMERIC(8,2) as elo_gained,
      0::NUMERIC(8,2) as elo_lost,
      MAX(m.created_at)::TIMESTAMP as last_match_date
    FROM matches m
    JOIN game_maps gm ON gm.name = m.map
    JOIN factions f_winner ON f_winner.name = m.winner_faction
    JOIN factions f_loser ON f_loser.name = m.loser_faction
    WHERE NOT (m.admin_reviewed = true AND m.status = 'cancelled')
    GROUP BY m.winner_id, m.loser_id, gm.id, f_winner.id, f_loser.id
  )
  INSERT INTO player_match_statistics (player_id, opponent_id, map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate, avg_elo_change, last_elo_against_me, elo_gained, elo_lost, last_match_date)
  SELECT
    player_id,
    opponent_id,
    map_id,
    faction_id,
    opponent_faction_id,
    wins,
    wins,
    losses,
    100.00::NUMERIC(5,2),
    avg_elo_change,
    last_elo_against_me,
    elo_gained,
    elo_lost,
    last_match_date
  FROM h2h_winner
  ON CONFLICT (player_id, COALESCE(opponent_id, '00000000-0000-0000-0000-000000000000'::UUID), COALESCE(map_id, '00000000-0000-0000-0000-000000000000'::UUID), COALESCE(faction_id, '00000000-0000-0000-0000-000000000000'::UUID), COALESCE(opponent_faction_id, '00000000-0000-0000-0000-000000000000'::UUID)) DO UPDATE SET
    total_games = EXCLUDED.total_games,
    wins = EXCLUDED.wins,
    losses = EXCLUDED.losses,
    winrate = EXCLUDED.winrate,
    avg_elo_change = EXCLUDED.avg_elo_change,
    last_elo_against_me = EXCLUDED.last_elo_against_me,
    elo_gained = EXCLUDED.elo_gained,
    elo_lost = EXCLUDED.elo_lost,
    last_match_date = EXCLUDED.last_match_date,
    last_updated = CURRENT_TIMESTAMP;

  -- ===== HEAD-TO-HEAD LOSER PERSPECTIVE =====
  WITH h2h_loser AS (
    SELECT
      m.loser_id as player_id,
      m.winner_id as opponent_id,
      gm.id as map_id,
      f_loser.id as faction_id,
      f_winner.id as opponent_faction_id,
      0::INT as wins,
      COUNT(*)::INT as losses,
      MAX(m.winner_elo_after)::DECIMAL(8,2) as last_elo_against_me,
      SUM(m.loser_elo_after - m.loser_elo_before)::NUMERIC(8,2) / COUNT(*) as avg_elo_change,
      0::NUMERIC(8,2) as elo_gained,
      SUM(CASE WHEN m.loser_elo_after - m.loser_elo_before < 0 THEN ABS(m.loser_elo_after - m.loser_elo_before) ELSE 0 END)::NUMERIC(8,2) as elo_lost,
      MAX(m.created_at)::TIMESTAMP as last_match_date
    FROM matches m
    JOIN game_maps gm ON gm.name = m.map
    JOIN factions f_loser ON f_loser.name = m.loser_faction
    JOIN factions f_winner ON f_winner.name = m.winner_faction
    WHERE NOT (m.admin_reviewed = true AND m.status = 'cancelled')
    GROUP BY m.loser_id, m.winner_id, gm.id, f_loser.id, f_winner.id
  )
  INSERT INTO player_match_statistics (player_id, opponent_id, map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate, avg_elo_change, last_elo_against_me, elo_gained, elo_lost, last_match_date)
  SELECT
    player_id,
    opponent_id,
    map_id,
    faction_id,
    opponent_faction_id,
    losses,
    wins,
    losses,
    0.00::NUMERIC(5,2),
    avg_elo_change,
    last_elo_against_me,
    elo_gained,
    elo_lost,
    last_match_date
  FROM h2h_loser
  ON CONFLICT (player_id, COALESCE(opponent_id, '00000000-0000-0000-0000-000000000000'::UUID), COALESCE(map_id, '00000000-0000-0000-0000-000000000000'::UUID), COALESCE(faction_id, '00000000-0000-0000-0000-000000000000'::UUID), COALESCE(opponent_faction_id, '00000000-0000-0000-0000-000000000000'::UUID)) DO UPDATE SET
    total_games = EXCLUDED.total_games,
    wins = EXCLUDED.wins,
    losses = EXCLUDED.losses,
    winrate = EXCLUDED.winrate,
    avg_elo_change = EXCLUDED.avg_elo_change,
    last_elo_against_me = EXCLUDED.last_elo_against_me,
    elo_gained = EXCLUDED.elo_gained,
    elo_lost = EXCLUDED.elo_lost,
    last_match_date = EXCLUDED.last_match_date,
    last_updated = CURRENT_TIMESTAMP;

  -- ===== HEAD-TO-HEAD WINNER AGGREGATED (no map/faction) =====
  WITH h2h_winner_agg AS (
    SELECT
      m.winner_id as player_id,
      m.loser_id as opponent_id,
      NULL::UUID as map_id,
      NULL::UUID as faction_id,
      NULL::UUID as opponent_faction_id,
      COUNT(*)::INT as wins,
      0::INT as losses,
      MAX(m.loser_elo_after)::DECIMAL(8,2) as last_elo_against_me,
      SUM(m.winner_elo_after - m.winner_elo_before)::NUMERIC(8,2) / COUNT(*) as avg_elo_change,
      SUM(CASE WHEN m.winner_elo_after - m.winner_elo_before > 0 THEN m.winner_elo_after - m.winner_elo_before ELSE 0 END)::NUMERIC(8,2) as elo_gained,
      0::NUMERIC(8,2) as elo_lost,
      MAX(m.created_at)::TIMESTAMP as last_match_date
    FROM matches m
    WHERE NOT (m.admin_reviewed = true AND m.status = 'cancelled')
    GROUP BY m.winner_id, m.loser_id
  )
  INSERT INTO player_match_statistics (player_id, opponent_id, map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate, avg_elo_change, last_elo_against_me, elo_gained, elo_lost, last_match_date)
  SELECT
    player_id,
    opponent_id,
    map_id,
    faction_id,
    opponent_faction_id,
    wins,
    wins,
    losses,
    100.00::NUMERIC(5,2),
    avg_elo_change,
    last_elo_against_me,
    elo_gained,
    elo_lost,
    last_match_date
  FROM h2h_winner_agg
  ON CONFLICT (player_id, COALESCE(opponent_id, '00000000-0000-0000-0000-000000000000'::UUID), COALESCE(map_id, '00000000-0000-0000-0000-000000000000'::UUID), COALESCE(faction_id, '00000000-0000-0000-0000-000000000000'::UUID), COALESCE(opponent_faction_id, '00000000-0000-0000-0000-000000000000'::UUID)) DO UPDATE SET
    total_games = EXCLUDED.total_games,
    wins = EXCLUDED.wins,
    losses = EXCLUDED.losses,
    winrate = EXCLUDED.winrate,
    avg_elo_change = EXCLUDED.avg_elo_change,
    last_elo_against_me = EXCLUDED.last_elo_against_me,
    elo_gained = EXCLUDED.elo_gained,
    elo_lost = EXCLUDED.elo_lost,
    last_match_date = EXCLUDED.last_match_date,
    last_updated = CURRENT_TIMESTAMP;

  -- ===== HEAD-TO-HEAD LOSER AGGREGATED (no map/faction) =====
  WITH h2h_loser_agg AS (
    SELECT
      m.loser_id as player_id,
      m.winner_id as opponent_id,
      NULL::UUID as map_id,
      NULL::UUID as faction_id,
      NULL::UUID as opponent_faction_id,
      0::INT as wins,
      COUNT(*)::INT as losses,
      MAX(m.winner_elo_after)::DECIMAL(8,2) as last_elo_against_me,
      SUM(m.loser_elo_after - m.loser_elo_before)::NUMERIC(8,2) / COUNT(*) as avg_elo_change,
      0::NUMERIC(8,2) as elo_gained,
      SUM(CASE WHEN m.loser_elo_after - m.loser_elo_before < 0 THEN ABS(m.loser_elo_after - m.loser_elo_before) ELSE 0 END)::NUMERIC(8,2) as elo_lost,
      MAX(m.created_at)::TIMESTAMP as last_match_date
    FROM matches m
    WHERE NOT (m.admin_reviewed = true AND m.status = 'cancelled')
    GROUP BY m.loser_id, m.winner_id
  )
  INSERT INTO player_match_statistics (player_id, opponent_id, map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate, avg_elo_change, last_elo_against_me, elo_gained, elo_lost, last_match_date)
  SELECT
    player_id,
    opponent_id,
    map_id,
    faction_id,
    opponent_faction_id,
    losses,
    wins,
    losses,
    0.00::NUMERIC(5,2),
    avg_elo_change,
    last_elo_against_me,
    elo_gained,
    elo_lost,
    last_match_date
  FROM h2h_loser_agg
  ON CONFLICT (player_id, COALESCE(opponent_id, '00000000-0000-0000-0000-000000000000'::UUID), COALESCE(map_id, '00000000-0000-0000-0000-000000000000'::UUID), COALESCE(faction_id, '00000000-0000-0000-0000-000000000000'::UUID), COALESCE(opponent_faction_id, '00000000-0000-0000-0000-000000000000'::UUID)) DO UPDATE SET
    total_games = EXCLUDED.total_games,
    wins = EXCLUDED.wins,
    losses = EXCLUDED.losses,
    winrate = EXCLUDED.winrate,
    avg_elo_change = EXCLUDED.avg_elo_change,
    last_elo_against_me = EXCLUDED.last_elo_against_me,
    elo_gained = EXCLUDED.elo_gained,
    elo_lost = EXCLUDED.elo_lost,
    last_match_date = EXCLUDED.last_match_date,
    last_updated = CURRENT_TIMESTAMP;

  -- ===== PER-MAP STATS =====
  WITH map_stats AS (
    SELECT
      m.winner_id as player_id,
      gm.id as map_id,
      NULL::UUID as opponent_id,
      NULL::UUID as faction_id,
      NULL::UUID as opponent_faction_id,
      COUNT(*)::INT as wins,
      0::INT as losses,
      SUM(m.winner_elo_after - m.winner_elo_before)::NUMERIC(8,2) / COUNT(*) as avg_elo_change
    FROM matches m
    JOIN game_maps gm ON gm.name = m.map
    WHERE NOT (m.admin_reviewed = true AND m.status = 'cancelled')
    GROUP BY m.winner_id, gm.id
    UNION ALL
    SELECT
      m.loser_id as player_id,
      gm.id as map_id,
      NULL::UUID as opponent_id,
      NULL::UUID as faction_id,
      NULL::UUID as opponent_faction_id,
      0::INT as wins,
      COUNT(*)::INT as losses,
      SUM(m.loser_elo_after - m.loser_elo_before)::NUMERIC(8,2) / COUNT(*) as avg_elo_change
    FROM matches m
    JOIN game_maps gm ON gm.name = m.map
    WHERE NOT (m.admin_reviewed = true AND m.status = 'cancelled')
    GROUP BY m.loser_id, gm.id
  )
  INSERT INTO player_match_statistics (player_id, opponent_id, map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate, avg_elo_change)
  SELECT
    player_id,
    opponent_id,
    map_id,
    faction_id,
    opponent_faction_id,
    SUM(wins + losses)::INT as total_games,
    SUM(wins)::INT as wins,
    SUM(losses)::INT as losses,
    CASE WHEN SUM(wins + losses) > 0 THEN ROUND(100.0 * SUM(wins) / SUM(wins + losses), 2)::NUMERIC(5,2) ELSE 0 END,
    AVG(avg_elo_change)::NUMERIC(8,2)
  FROM map_stats
  GROUP BY player_id, map_id, opponent_id, faction_id, opponent_faction_id
  ON CONFLICT (player_id, COALESCE(opponent_id, '00000000-0000-0000-0000-000000000000'::UUID), COALESCE(map_id, '00000000-0000-0000-0000-000000000000'::UUID), COALESCE(faction_id, '00000000-0000-0000-0000-000000000000'::UUID), COALESCE(opponent_faction_id, '00000000-0000-0000-0000-000000000000'::UUID)) DO UPDATE SET
    total_games = EXCLUDED.total_games,
    wins = EXCLUDED.wins,
    losses = EXCLUDED.losses,
    winrate = EXCLUDED.winrate,
    avg_elo_change = EXCLUDED.avg_elo_change,
    last_updated = CURRENT_TIMESTAMP;

  -- ===== PER-FACTION STATS =====
  WITH faction_stats AS (
    SELECT
      m.winner_id as player_id,
      f.id as faction_id,
      NULL::UUID as opponent_id,
      NULL::UUID as map_id,
      NULL::UUID as opponent_faction_id,
      COUNT(*)::INT as wins,
      0::INT as losses,
      SUM(m.winner_elo_after - m.winner_elo_before)::NUMERIC(8,2) / COUNT(*) as avg_elo_change
    FROM matches m
    JOIN factions f ON f.name = m.winner_faction
    WHERE NOT (m.admin_reviewed = true AND m.status = 'cancelled')
    GROUP BY m.winner_id, f.id
    UNION ALL
    SELECT
      m.loser_id as player_id,
      f.id as faction_id,
      NULL::UUID as opponent_id,
      NULL::UUID as map_id,
      NULL::UUID as opponent_faction_id,
      0::INT as wins,
      COUNT(*)::INT as losses,
      SUM(m.loser_elo_after - m.loser_elo_before)::NUMERIC(8,2) / COUNT(*) as avg_elo_change
    FROM matches m
    JOIN factions f ON f.name = m.loser_faction
    WHERE NOT (m.admin_reviewed = true AND m.status = 'cancelled')
    GROUP BY m.loser_id, f.id
  )
  INSERT INTO player_match_statistics (player_id, opponent_id, map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate, avg_elo_change)
  SELECT
    player_id,
    opponent_id,
    map_id,
    faction_id,
    opponent_faction_id,
    SUM(wins + losses)::INT as total_games,
    SUM(wins)::INT as wins,
    SUM(losses)::INT as losses,
    CASE WHEN SUM(wins + losses) > 0 THEN ROUND(100.0 * SUM(wins) / SUM(wins + losses), 2)::NUMERIC(5,2) ELSE 0 END,
    AVG(avg_elo_change)::NUMERIC(8,2)
  FROM faction_stats
  GROUP BY player_id, faction_id, opponent_id, map_id, opponent_faction_id
  ON CONFLICT (player_id, COALESCE(opponent_id, '00000000-0000-0000-0000-000000000000'::UUID), COALESCE(map_id, '00000000-0000-0000-0000-000000000000'::UUID), COALESCE(faction_id, '00000000-0000-0000-0000-000000000000'::UUID), COALESCE(opponent_faction_id, '00000000-0000-0000-0000-000000000000'::UUID)) DO UPDATE SET
    total_games = EXCLUDED.total_games,
    wins = EXCLUDED.wins,
    losses = EXCLUDED.losses,
    winrate = EXCLUDED.winrate,
    avg_elo_change = EXCLUDED.avg_elo_change,
    last_updated = CURRENT_TIMESTAMP;

  RAISE NOTICE 'Player match statistics recalculated successfully';
END;
$$ LANGUAGE plpgsql;

-- ============================================================================
-- STEP 4: Execute recalculation to populate data
-- ============================================================================

SELECT recalculate_player_match_statistics();
