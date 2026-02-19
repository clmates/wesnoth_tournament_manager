-- Fix ambiguous column reference in manage_faction_map_statistics_snapshots function
-- The function was trying to select snapshot_before_date from balance_events which doesn't exist
-- Now it only selects id and event_date, and calculates snapshot_before_date as needed

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
  SELECT id, event_date
  INTO v_last_event_id, v_last_event_date
  FROM balance_events
  ORDER BY event_date DESC
  LIMIT 1;
  
  -- If no balance event exists, create snapshots for all dates (first run scenario)
  IF v_last_event_id IS NULL THEN
    v_last_event_date := CURRENT_TIMESTAMP;
    v_snapshot_before_date := (CURRENT_DATE - INTERVAL '1 day');
  ELSE
    v_snapshot_before_date := (v_last_event_date::DATE - INTERVAL '1 day');
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

SELECT 'Migration: Fixed manage_faction_map_statistics_snapshots function - removed ambiguous column reference' AS migration_info;
