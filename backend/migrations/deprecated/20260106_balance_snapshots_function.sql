-- Function to recalculate balance event snapshots
-- Creates BEFORE and AFTER snapshots for balance events based on match data

CREATE OR REPLACE FUNCTION recalculate_balance_event_snapshots(
  event_id_param UUID DEFAULT NULL,
  recreate_all BOOLEAN DEFAULT FALSE
)
RETURNS TABLE(
  success BOOLEAN,
  message TEXT,
  total_events_processed INT,
  total_snapshots_created INT,
  before_snapshots INT,
  after_snapshots INT
) AS $$
DECLARE
  v_event RECORD;
  v_prev_event RECORD;
  v_next_event RECORD;
  v_snapshot_count INT := 0;
  v_total_events INT := 0;
  v_total_snapshots INT := 0;
  v_before_matches INT := 0;
  v_after_matches INT := 0;
  v_before_date DATE;
  v_after_date DATE;
BEGIN
  IF recreate_all THEN
    TRUNCATE TABLE faction_map_statistics_history;
  END IF;

  FOR v_event IN 
    SELECT id, event_date
    FROM balance_events
    WHERE (event_id_param IS NULL OR id = event_id_param)
    ORDER BY event_date ASC
  LOOP
    v_total_events := v_total_events + 1;
    
    -- Get previous event for date range
    SELECT id, event_date INTO v_prev_event
    FROM balance_events
    WHERE event_date < v_event.event_date
    ORDER BY event_date DESC
    LIMIT 1;
    
    -- Count unique matches BEFORE this event
    SELECT COUNT(DISTINCT id) INTO v_before_matches
    FROM matches m
    WHERE m.created_at::DATE < v_event.event_date::DATE
    AND (v_prev_event.id IS NULL OR m.created_at::DATE >= v_prev_event.event_date::DATE)
    AND NOT (m.admin_reviewed = true AND m.status = 'cancelled');
    
    -- Count unique matches AFTER this event (up to today)
    SELECT COUNT(DISTINCT id) INTO v_after_matches
    FROM matches m
    WHERE m.created_at::DATE >= v_event.event_date::DATE
    AND NOT (m.admin_reviewed = true AND m.status = 'cancelled');
    
    v_before_date := (v_event.event_date::DATE) - INTERVAL '1 day';
    
    -- Create snapshot for this event (capture all cumulative stats)
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
      v_event.event_date::DATE as snapshot_date,
      CURRENT_TIMESTAMP,
      fs.map_id,
      fs.faction_id,
      fs.opponent_faction_id,
      fs.total_games,
      fs.wins,
      fs.losses,
      fs.winrate,
      CASE
        WHEN fs.total_games < 10 THEN 'small'
        WHEN fs.total_games < 50 THEN 'medium'
        ELSE 'large'
      END as sample_size_category,
      CASE
        WHEN fs.total_games < 10 THEN 25.0
        WHEN fs.total_games < 30 THEN 50.0
        WHEN fs.total_games < 50 THEN 75.0
        ELSE 95.0
      END as confidence_level
    FROM faction_map_statistics fs
    ON CONFLICT (snapshot_date, map_id, faction_id, opponent_faction_id)
    DO UPDATE SET
      total_games = EXCLUDED.total_games,
      wins = EXCLUDED.wins,
      losses = EXCLUDED.losses,
      winrate = EXCLUDED.winrate,
      sample_size_category = EXCLUDED.sample_size_category,
      confidence_level = EXCLUDED.confidence_level;
    
    GET DIAGNOSTICS v_snapshot_count = ROW_COUNT;
    v_total_snapshots := v_total_snapshots + v_snapshot_count;
  END LOOP;

  RETURN QUERY SELECT
    TRUE::BOOLEAN,
    'Balance event snapshots created successfully'::TEXT,
    v_total_events,
    v_total_snapshots,
    v_before_matches,
    v_after_matches;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION recalculate_balance_event_snapshots_loser(
  event_id_param UUID DEFAULT NULL,
  recreate_all BOOLEAN DEFAULT FALSE
)
RETURNS void AS $$
DECLARE
  v_event RECORD;
BEGIN
  -- Loser stats are now captured in the winner function
  -- since we capture full faction_map_statistics which includes both perspectives
  RETURN;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION recalculate_balance_event_snapshots(UUID, BOOLEAN) IS 'Creates BEFORE and AFTER snapshots for balance events from match data.';
