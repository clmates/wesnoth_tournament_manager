-- Smart snapshot system for balance events
-- BEFORE snapshot: Created when balance event is created (with closest prior data)
-- AFTER snapshot: Created/updated on each recalculation to latest date

-- ===== ADD COLUMNS TO BALANCE_EVENTS =====
ALTER TABLE balance_events
ADD COLUMN IF NOT EXISTS snapshot_before_date DATE,
ADD COLUMN IF NOT EXISTS snapshot_after_date DATE;

-- ===== CREATE BEFORE SNAPSHOT WHEN EVENT IS CREATED =====
-- This function is called when a balance event is inserted
CREATE OR REPLACE FUNCTION create_balance_event_before_snapshot()
RETURNS TRIGGER AS $$
DECLARE
  v_before_date DATE;
BEGIN
  -- Use yesterday's date (closest data before event)
  v_before_date := (NEW.event_date::DATE) - INTERVAL '1 day';
  
  -- Create snapshot with current statistics data
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
    v_before_date,
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
    END,
    CASE
      WHEN fms.total_games < 10 THEN 25.0
      WHEN fms.total_games < 30 THEN 50.0
      WHEN fms.total_games < 50 THEN 75.0
      ELSE 95.0
    END
  FROM faction_map_statistics fms
  WHERE fms.total_games > 0
  ON CONFLICT (snapshot_date, map_id, faction_id, opponent_faction_id)
  DO NOTHING;
  
  -- Update balance_events to record when snapshots were created
  UPDATE balance_events
  SET snapshot_before_date = v_before_date
  WHERE id = NEW.id;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger for BEFORE snapshot
DROP TRIGGER IF EXISTS trg_balance_event_before_snapshot ON balance_events;
CREATE TRIGGER trg_balance_event_before_snapshot
AFTER INSERT ON balance_events
FOR EACH ROW
EXECUTE FUNCTION create_balance_event_before_snapshot();

-- ===== SMART RECALCULATION WITH SNAPSHOT MANAGEMENT =====
-- This function should be called after faction_map_statistics recalculation
-- It:
-- 1. Finds the last balance event
-- 2. Deletes all snapshots AFTER that event
-- 3. Creates/updates AFTER snapshot with today's date
CREATE OR REPLACE FUNCTION manage_faction_map_statistics_snapshots()
RETURNS TABLE(
  last_event_id UUID,
  last_event_date TIMESTAMP,
  snapshot_before_date DATE,
  snapshots_deleted INT,
  snapshot_after_date DATE,
  snapshot_after_created BOOLEAN
) AS $$
DECLARE
  v_last_event_id UUID;
  v_last_event_date TIMESTAMP;
  v_snapshot_before_date DATE;
  v_snapshots_deleted INT := 0;
  v_snapshot_after_date DATE;
  v_snapshot_after_created BOOLEAN := FALSE;
BEGIN
  -- Find the last balance event
  SELECT id, event_date, snapshot_before_date
  INTO v_last_event_id, v_last_event_date, v_snapshot_before_date
  FROM balance_events
  ORDER BY event_date DESC
  LIMIT 1;
  
  -- If no balance event exists, create snapshots for all dates (first run scenario)
  IF v_last_event_id IS NULL THEN
    v_last_event_date := CURRENT_TIMESTAMP;
    v_snapshot_before_date := (CURRENT_DATE - INTERVAL '1 day');
  END IF;
  
  -- Delete all snapshots AFTER the last balance event
  DELETE FROM faction_map_statistics_history
  WHERE snapshot_date > (v_last_event_date::DATE + INTERVAL '1 day');
  
  GET DIAGNOSTICS v_snapshots_deleted = ROW_COUNT;
  
  -- Set AFTER snapshot date to today
  v_snapshot_after_date := CURRENT_DATE;
  
  -- Create or update AFTER snapshot with current statistics
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
    v_snapshot_after_date,
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
    END,
    CASE
      WHEN fms.total_games < 10 THEN 25.0
      WHEN fms.total_games < 30 THEN 50.0
      WHEN fms.total_games < 50 THEN 75.0
      ELSE 95.0
    END
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
  
  GET DIAGNOSTICS v_snapshot_after_created = ROW_COUNT;
  
  -- Update the balance_events record with the AFTER snapshot date
  IF v_last_event_id IS NOT NULL THEN
    UPDATE balance_events
    SET snapshot_after_date = v_snapshot_after_date
    WHERE id = v_last_event_id;
  END IF;
  
  RETURN QUERY SELECT
    v_last_event_id,
    v_last_event_date,
    v_snapshot_before_date,
    v_snapshots_deleted,
    v_snapshot_after_date,
    (v_snapshot_after_created > 0)::BOOLEAN;
END;
$$ LANGUAGE plpgsql;

-- ===== DOCUMENTATION =====
COMMENT ON FUNCTION create_balance_event_before_snapshot() IS 'Trigger function that creates BEFORE snapshot when a balance event is created';
COMMENT ON FUNCTION manage_faction_map_statistics_snapshots() IS 'Called after recalculation to manage snapshots: deletes old ones after last event, creates/updates current AFTER snapshot';
COMMENT ON COLUMN balance_events.snapshot_before_date IS 'Date of the BEFORE snapshot (usually day before event)';
COMMENT ON COLUMN balance_events.snapshot_after_date IS 'Date of the most recent AFTER snapshot (updated on each recalculation)';
