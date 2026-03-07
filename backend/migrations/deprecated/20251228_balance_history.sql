-- Add balance history and event tracking for faction/map statistics
-- Allows analysis of balance changes over time and comparison before/after patches

-- ===== BALANCE EVENTS TABLE =====
-- Track significant balance changes (nerfs, buffs, etc.)
CREATE TABLE IF NOT EXISTS balance_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_date TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  patch_version VARCHAR(20),
  event_type VARCHAR(50) NOT NULL CHECK (event_type IN ('BUFF', 'NERF', 'REWORK', 'HOTFIX', 'GENERAL_BALANCE_CHANGE')),
  faction_id UUID REFERENCES factions(id) ON DELETE SET NULL,
  map_id UUID REFERENCES game_maps(id) ON DELETE SET NULL,
  description TEXT NOT NULL,
  notes TEXT,
  created_by UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX idx_balance_events_date ON balance_events(event_date DESC);
CREATE INDEX idx_balance_events_faction ON balance_events(faction_id) WHERE faction_id IS NOT NULL;
CREATE INDEX idx_balance_events_map ON balance_events(map_id) WHERE map_id IS NOT NULL;
CREATE INDEX idx_balance_events_type ON balance_events(event_type);

-- ===== FACTION_MAP_STATISTICS_HISTORY TABLE =====
-- Daily snapshots of faction/map balance statistics
CREATE TABLE IF NOT EXISTS faction_map_statistics_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Snapshot metadata
  snapshot_date DATE NOT NULL,
  snapshot_timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  
  -- Stats dimensions (same as current table)
  map_id UUID NOT NULL REFERENCES game_maps(id) ON DELETE CASCADE,
  faction_id UUID NOT NULL REFERENCES factions(id) ON DELETE CASCADE,
  opponent_faction_id UUID NOT NULL REFERENCES factions(id) ON DELETE CASCADE,
  
  -- Stats metrics
  total_games INT DEFAULT 0,
  wins INT DEFAULT 0,
  losses INT DEFAULT 0,
  winrate DECIMAL(5, 2),
  
  -- Calculated fields for analysis
  sample_size_category VARCHAR(20), -- 'small' (<10), 'medium' (10-50), 'large' (50+)
  confidence_level DECIMAL(5, 2), -- Statistical confidence (0-100)
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(snapshot_date, map_id, faction_id, opponent_faction_id)
);

CREATE INDEX idx_history_date ON faction_map_statistics_history(snapshot_date DESC);
CREATE INDEX idx_history_map_faction ON faction_map_statistics_history(map_id, faction_id, opponent_faction_id);
CREATE INDEX idx_history_date_range ON faction_map_statistics_history(snapshot_date, map_id, faction_id, opponent_faction_id);

-- ===== SNAPSHOT CREATION FUNCTION =====
-- Creates a snapshot of current statistics for a given date
CREATE OR REPLACE FUNCTION create_faction_map_statistics_snapshot(snapshot_date_param DATE DEFAULT CURRENT_DATE)
RETURNS TABLE(snapshots_created INT, snapshots_skipped INT) AS $$
DECLARE
  v_snapshots_created INT := 0;
  v_snapshots_skipped INT := 0;
  v_sample_size INT;
  v_confidence DECIMAL(5, 2);
BEGIN
  -- Insert or update snapshot for each faction/map/opponent combination
  INSERT INTO faction_map_statistics_history (
    snapshot_date,
    snapshot_timestamp,
    map_id,
    faction_id,
    opponent_faction_id,
    total_games,
    wins,
    losses,
    winrate,
    sample_size_category,
    confidence_level
  )
  SELECT
    snapshot_date_param,
    CURRENT_TIMESTAMP,
    fms.map_id,
    fms.faction_id,
    fms.opponent_faction_id,
    fms.total_games,
    fms.wins,
    fms.losses,
    fms.winrate,
    CASE
      WHEN fms.total_games < 10 THEN 'small'
      WHEN fms.total_games < 50 THEN 'medium'
      ELSE 'large'
    END as sample_size_category,
    CASE
      WHEN fms.total_games < 10 THEN 25.0
      WHEN fms.total_games < 30 THEN 50.0
      WHEN fms.total_games < 50 THEN 75.0
      ELSE 95.0
    END as confidence_level
  FROM faction_map_statistics fms
  WHERE fms.total_games > 0
  ON CONFLICT (snapshot_date, map_id, faction_id, opponent_faction_id)
  DO UPDATE SET
    total_games = EXCLUDED.total_games,
    wins = EXCLUDED.wins,
    losses = EXCLUDED.losses,
    winrate = EXCLUDED.winrate,
    snapshot_timestamp = CURRENT_TIMESTAMP,
    sample_size_category = EXCLUDED.sample_size_category,
    confidence_level = EXCLUDED.confidence_level;

  GET DIAGNOSTICS v_snapshots_created = ROW_COUNT;
  
  RETURN QUERY SELECT v_snapshots_created, v_snapshots_skipped;
END;
$$ LANGUAGE plpgsql;

-- ===== SCHEDULED SNAPSHOT FUNCTION =====
-- Call this daily to create snapshots (can be run via cron or scheduled job)
CREATE OR REPLACE FUNCTION daily_snapshot_faction_map_statistics()
RETURNS void AS $$
DECLARE
  v_yesterday DATE;
  v_rows_created INT;
  v_rows_skipped INT;
BEGIN
  v_yesterday := CURRENT_DATE - INTERVAL '1 day';
  
  -- Only create snapshot if one doesn't already exist for yesterday
  IF NOT EXISTS (
    SELECT 1 FROM faction_map_statistics_history
    WHERE snapshot_date = v_yesterday
  ) THEN
    SELECT * INTO v_rows_created, v_rows_skipped
    FROM create_faction_map_statistics_snapshot(v_yesterday);
    
    RAISE NOTICE 'Snapshot created for %: % rows', v_yesterday, v_rows_created;
  ELSE
    RAISE NOTICE 'Snapshot already exists for %', v_yesterday;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- ===== COMPARISON FUNCTION =====
-- Compare balance before and after a balance event
CREATE OR REPLACE FUNCTION get_balance_event_impact(
  event_id_param UUID,
  days_before INT DEFAULT 30,
  days_after INT DEFAULT 30
)
RETURNS TABLE(
  map_id UUID,
  map_name VARCHAR,
  faction_id UUID,
  faction_name VARCHAR,
  opponent_faction_id UUID,
  opponent_faction_name VARCHAR,
  winrate_before DECIMAL(5,2),
  winrate_after DECIMAL(5,2),
  winrate_change DECIMAL(6,2),
  sample_size_before INT,
  sample_size_after INT,
  games_before INT,
  games_after INT
) AS $$
DECLARE
  v_event_date DATE;
  v_faction_id UUID;
  v_map_id UUID;
BEGIN
  -- Get event details
  SELECT event_date::DATE, faction_id, map_id
  INTO v_event_date, v_faction_id, v_map_id
  FROM balance_events
  WHERE id = event_id_param;
  
  IF v_event_date IS NULL THEN
    RAISE EXCEPTION 'Balance event not found: %', event_id_param;
  END IF;

  RETURN QUERY
  WITH before_stats AS (
    SELECT
      fms.map_id,
      gm.name as map_name,
      fms.faction_id,
      f1.name as faction_name,
      fms.opponent_faction_id,
      f2.name as opponent_faction_name,
      fms.winrate,
      fms.total_games
    FROM faction_map_statistics_history fms
    JOIN game_maps gm ON fms.map_id = gm.id
    JOIN factions f1 ON fms.faction_id = f1.id
    JOIN factions f2 ON fms.opponent_faction_id = f2.id
    WHERE fms.snapshot_date BETWEEN (v_event_date - days_before) AND (v_event_date - INTERVAL '1 day')
    AND (v_faction_id IS NULL OR fms.faction_id = v_faction_id)
    AND (v_map_id IS NULL OR fms.map_id = v_map_id)
  ),
  after_stats AS (
    SELECT
      fms.map_id,
      gm.name as map_name,
      fms.faction_id,
      f1.name as faction_name,
      fms.opponent_faction_id,
      f2.name as opponent_faction_name,
      fms.winrate,
      fms.total_games
    FROM faction_map_statistics_history fms
    JOIN game_maps gm ON fms.map_id = gm.id
    JOIN factions f1 ON fms.faction_id = f1.id
    JOIN factions f2 ON fms.opponent_faction_id = f2.id
    WHERE fms.snapshot_date BETWEEN v_event_date AND (v_event_date + days_after)
    AND (v_faction_id IS NULL OR fms.faction_id = v_faction_id)
    AND (v_map_id IS NULL OR fms.map_id = v_map_id)
  )
  SELECT
    COALESCE(b.map_id, a.map_id),
    COALESCE(b.map_name, a.map_name),
    COALESCE(b.faction_id, a.faction_id),
    COALESCE(b.faction_name, a.faction_name),
    COALESCE(b.opponent_faction_id, a.opponent_faction_id),
    COALESCE(b.opponent_faction_name, a.opponent_faction_name),
    AVG(b.winrate)::DECIMAL(5,2) as winrate_before,
    AVG(a.winrate)::DECIMAL(5,2) as winrate_after,
    (AVG(a.winrate) - AVG(b.winrate))::DECIMAL(6,2) as winrate_change,
    COUNT(DISTINCT b.map_id)::INT as sample_size_before,
    COUNT(DISTINCT a.map_id)::INT as sample_size_after,
    COALESCE(SUM(b.total_games), 0)::INT as games_before,
    COALESCE(SUM(a.total_games), 0)::INT as games_after
  FROM before_stats b
  FULL OUTER JOIN after_stats a ON
    b.map_id = a.map_id AND
    b.faction_id = a.faction_id AND
    b.opponent_faction_id = a.opponent_faction_id
  GROUP BY
    COALESCE(b.map_id, a.map_id),
    COALESCE(b.map_name, a.map_name),
    COALESCE(b.faction_id, a.faction_id),
    COALESCE(b.faction_name, a.faction_name),
    COALESCE(b.opponent_faction_id, a.opponent_faction_id),
    COALESCE(b.opponent_faction_name, a.opponent_faction_name);
END;
$$ LANGUAGE plpgsql;

-- ===== BALANCE TREND FUNCTION =====
-- Get balance trends over a date range
CREATE OR REPLACE FUNCTION get_balance_trend(
  map_id_param UUID,
  faction_id_param UUID,
  opponent_faction_id_param UUID,
  date_from DATE,
  date_to DATE
)
RETURNS TABLE(
  snapshot_date DATE,
  total_games INT,
  wins INT,
  losses INT,
  winrate DECIMAL(5,2),
  confidence_level DECIMAL(5,2),
  sample_size_category VARCHAR
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    fms.snapshot_date,
    fms.total_games,
    fms.wins,
    fms.losses,
    fms.winrate,
    fms.confidence_level,
    fms.sample_size_category
  FROM faction_map_statistics_history fms
  WHERE fms.map_id = map_id_param
  AND fms.faction_id = faction_id_param
  AND fms.opponent_faction_id = opponent_faction_id_param
  AND fms.snapshot_date BETWEEN date_from AND date_to
  ORDER BY fms.snapshot_date ASC;
END;
$$ LANGUAGE plpgsql;

-- ===== DOCUMENTATION COMMENTS =====
COMMENT ON TABLE balance_events IS 'Records significant balance changes (nerfs, buffs, reworks) with timestamps and descriptions for impact analysis';
COMMENT ON TABLE faction_map_statistics_history IS 'Daily snapshots of faction/map balance statistics for historical analysis and trend detection';
COMMENT ON COLUMN faction_map_statistics_history.sample_size_category IS 'Data quality indicator: small (<10 games), medium (10-50), large (50+)';
COMMENT ON COLUMN faction_map_statistics_history.confidence_level IS 'Statistical confidence in the winrate (0-100%), increases with more games';
COMMENT ON FUNCTION create_faction_map_statistics_snapshot(DATE) IS 'Creates a snapshot of current faction_map_statistics for historical tracking';
COMMENT ON FUNCTION daily_snapshot_faction_map_statistics() IS 'Scheduled function to create daily snapshots - call via cron job';
COMMENT ON FUNCTION get_balance_event_impact(UUID, INT, INT) IS 'Compares balance before and after a specific event to measure impact';
COMMENT ON FUNCTION get_balance_trend(UUID, UUID, UUID, DATE, DATE) IS 'Returns balance trend for a specific faction/map matchup over a date range';
