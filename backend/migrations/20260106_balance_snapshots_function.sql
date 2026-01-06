-- Function to recalculate balance event snapshots
-- Creates BEFORE and AFTER snapshots for balance events based on match data
-- BEFORE: matches from previous event (or start) to day before current event
-- AFTER: matches from current event to day before next event (or today)

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
  v_before_date DATE;
  v_after_date DATE;
  v_matches_start_date TIMESTAMP;
  v_matches_end_date TIMESTAMP;
  v_before_count INT := 0;
  v_after_count INT := 0;
  v_total_events INT := 0;
  v_total_snapshots INT := 0;
BEGIN
  -- Step 1: Optionally truncate history if recreate_all is true
  IF recreate_all THEN
    TRUNCATE TABLE faction_map_statistics_history;
    RAISE NOTICE 'Truncated faction_map_statistics_history table';
  END IF;

  -- Step 2: Get the events to process
  -- If event_id_param is provided, only process that event; otherwise process all
  FOR v_event IN 
    SELECT id, event_date
    FROM balance_events
    WHERE (event_id_param IS NULL OR id = event_id_param)
    ORDER BY event_date ASC
  LOOP
    v_total_events := v_total_events + 1;
    
    -- Get previous event (if exists)
    SELECT id, event_date INTO v_prev_event
    FROM balance_events
    WHERE event_date < v_event.event_date
    ORDER BY event_date DESC
    LIMIT 1;
    
    -- Get next event (if exists)
    SELECT id, event_date INTO v_next_event
    FROM balance_events
    WHERE event_date > v_event.event_date
    ORDER BY event_date ASC
    LIMIT 1;
    
    -- Calculate BEFORE snapshot date and match range
    v_before_date := (v_event.event_date::DATE) - INTERVAL '1 day';
    IF v_prev_event.id IS NOT NULL THEN
      v_matches_start_date := v_prev_event.event_date;
    ELSE
      v_matches_start_date := (SELECT MIN(created_at) FROM matches);
    END IF;
    v_matches_end_date := v_event.event_date - INTERVAL '1 day';
    
    -- Create BEFORE snapshot
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
    WITH before_stats AS (
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
      WHERE m.created_at >= v_matches_start_date
      AND m.created_at < v_matches_end_date
      AND NOT (m.admin_reviewed = true AND m.status = 'cancelled')
      GROUP BY gm.id, f_winner.id, f_loser.id
    )
    SELECT
      v_before_date,
      CURRENT_TIMESTAMP,
      map_id,
      faction_id,
      opponent_faction_id,
      total_games,
      wins,
      losses,
      ROUND(100.0 * wins / total_games, 2)::NUMERIC(5,2),
      CASE
        WHEN total_games < 10 THEN 'small'
        WHEN total_games < 50 THEN 'medium'
        ELSE 'large'
      END,
      CASE
        WHEN total_games < 10 THEN 25.0
        WHEN total_games < 30 THEN 50.0
        WHEN total_games < 50 THEN 75.0
        ELSE 95.0
      END
    FROM before_stats
    ON CONFLICT (snapshot_date, map_id, faction_id, opponent_faction_id)
    DO UPDATE SET
      total_games = EXCLUDED.total_games,
      wins = EXCLUDED.wins,
      losses = EXCLUDED.losses,
      winrate = EXCLUDED.winrate,
      sample_size_category = EXCLUDED.sample_size_category,
      confidence_level = EXCLUDED.confidence_level;
    
    GET DIAGNOSTICS v_before_count = ROW_COUNT;
    v_total_snapshots := v_total_snapshots + v_before_count;
    
    RAISE NOTICE 'Event %: BEFORE snapshot (%) created with % records', 
      v_event.id, v_before_date, v_before_count;
    
    -- Calculate AFTER snapshot date and match range
    v_after_date := v_event.event_date::DATE;
    v_matches_start_date := v_event.event_date;
    IF v_next_event.id IS NOT NULL THEN
      v_matches_end_date := v_next_event.event_date - INTERVAL '1 day';
    ELSE
      v_matches_end_date := CURRENT_TIMESTAMP;
    END IF;
    
    -- Create AFTER snapshot
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
    WITH after_stats AS (
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
      WHERE m.created_at >= v_matches_start_date
      AND m.created_at <= v_matches_end_date
      AND NOT (m.admin_reviewed = true AND m.status = 'cancelled')
      GROUP BY gm.id, f_winner.id, f_loser.id
    )
    SELECT
      v_after_date,
      CURRENT_TIMESTAMP,
      map_id,
      faction_id,
      opponent_faction_id,
      total_games,
      wins,
      losses,
      ROUND(100.0 * wins / total_games, 2)::NUMERIC(5,2),
      CASE
        WHEN total_games < 10 THEN 'small'
        WHEN total_games < 50 THEN 'medium'
        ELSE 'large'
      END,
      CASE
        WHEN total_games < 10 THEN 25.0
        WHEN total_games < 30 THEN 50.0
        WHEN total_games < 50 THEN 75.0
        ELSE 95.0
      END
    FROM after_stats
    ON CONFLICT (snapshot_date, map_id, faction_id, opponent_faction_id)
    DO UPDATE SET
      total_games = EXCLUDED.total_games,
      wins = EXCLUDED.wins,
      losses = EXCLUDED.losses,
      winrate = EXCLUDED.winrate,
      sample_size_category = EXCLUDED.sample_size_category,
      confidence_level = EXCLUDED.confidence_level;
    
    GET DIAGNOSTICS v_after_count = ROW_COUNT;
    v_total_snapshots := v_total_snapshots + v_after_count;
    
    RAISE NOTICE 'Event %: AFTER snapshot (%) created with % records', 
      v_event.id, v_after_date, v_after_count;
  END LOOP;

  RETURN QUERY SELECT
    TRUE::BOOLEAN,
    'Balance event snapshots recalculated successfully'::TEXT,
    v_total_events,
    v_total_snapshots,
    (v_total_snapshots / 2)::INT,  -- Approximate before count
    (v_total_snapshots / 2)::INT;  -- Approximate after count
END;
$$ LANGUAGE plpgsql;

-- Add loser faction snapshots (mirror of winner)
-- This is needed because we need both perspectives (winner vs loser)
CREATE OR REPLACE FUNCTION recalculate_balance_event_snapshots_loser(
  event_id_param UUID DEFAULT NULL,
  recreate_all BOOLEAN DEFAULT FALSE
)
RETURNS void AS $$
DECLARE
  v_event RECORD;
  v_prev_event RECORD;
  v_next_event RECORD;
  v_before_date DATE;
  v_after_date DATE;
  v_matches_start_date TIMESTAMP;
  v_matches_end_date TIMESTAMP;
BEGIN
  -- Process loser faction snapshots (same logic as winner but reversed)
  FOR v_event IN 
    SELECT id, event_date
    FROM balance_events
    WHERE (event_id_param IS NULL OR id = event_id_param)
    ORDER BY event_date ASC
  LOOP
    SELECT id, event_date INTO v_prev_event
    FROM balance_events
    WHERE event_date < v_event.event_date
    ORDER BY event_date DESC
    LIMIT 1;
    
    SELECT id, event_date INTO v_next_event
    FROM balance_events
    WHERE event_date > v_event.event_date
    ORDER BY event_date ASC
    LIMIT 1;
    
    -- BEFORE snapshot for loser faction
    v_before_date := (v_event.event_date::DATE) - INTERVAL '1 day';
    IF v_prev_event.id IS NOT NULL THEN
      v_matches_start_date := v_prev_event.event_date;
    ELSE
      v_matches_start_date := (SELECT MIN(created_at) FROM matches);
    END IF;
    v_matches_end_date := v_event.event_date - INTERVAL '1 day';
    
    INSERT INTO faction_map_statistics_history (
      snapshot_date, snapshot_timestamp, map_id, faction_id, 
      opponent_faction_id, total_games, wins, losses, winrate,
      sample_size_category, confidence_level
    )
    WITH before_stats_loser AS (
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
      WHERE m.created_at >= v_matches_start_date
      AND m.created_at < v_matches_end_date
      AND NOT (m.admin_reviewed = true AND m.status = 'cancelled')
      GROUP BY gm.id, f_loser.id, f_winner.id
    )
    SELECT
      v_before_date, CURRENT_TIMESTAMP, map_id, faction_id,
      opponent_faction_id, total_games, wins, losses,
      ROUND(100.0 * wins / total_games, 2)::NUMERIC(5,2),
      CASE WHEN total_games < 10 THEN 'small' WHEN total_games < 50 THEN 'medium' ELSE 'large' END,
      CASE WHEN total_games < 10 THEN 25.0 WHEN total_games < 30 THEN 50.0 WHEN total_games < 50 THEN 75.0 ELSE 95.0 END
    FROM before_stats_loser
    ON CONFLICT (snapshot_date, map_id, faction_id, opponent_faction_id)
    DO UPDATE SET total_games = EXCLUDED.total_games, wins = EXCLUDED.wins, losses = EXCLUDED.losses, winrate = EXCLUDED.winrate;
    
    -- AFTER snapshot for loser faction
    v_after_date := v_event.event_date::DATE;
    v_matches_start_date := v_event.event_date;
    IF v_next_event.id IS NOT NULL THEN
      v_matches_end_date := v_next_event.event_date - INTERVAL '1 day';
    ELSE
      v_matches_end_date := CURRENT_TIMESTAMP;
    END IF;
    
    INSERT INTO faction_map_statistics_history (
      snapshot_date, snapshot_timestamp, map_id, faction_id,
      opponent_faction_id, total_games, wins, losses, winrate,
      sample_size_category, confidence_level
    )
    WITH after_stats_loser AS (
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
      WHERE m.created_at >= v_matches_start_date
      AND m.created_at <= v_matches_end_date
      AND NOT (m.admin_reviewed = true AND m.status = 'cancelled')
      GROUP BY gm.id, f_loser.id, f_winner.id
    )
    SELECT
      v_after_date, CURRENT_TIMESTAMP, map_id, faction_id,
      opponent_faction_id, total_games, wins, losses,
      ROUND(100.0 * wins / total_games, 2)::NUMERIC(5,2),
      CASE WHEN total_games < 10 THEN 'small' WHEN total_games < 50 THEN 'medium' ELSE 'large' END,
      CASE WHEN total_games < 10 THEN 25.0 WHEN total_games < 30 THEN 50.0 WHEN total_games < 50 THEN 75.0 ELSE 95.0 END
    FROM after_stats_loser
    ON CONFLICT (snapshot_date, map_id, faction_id, opponent_faction_id)
    DO UPDATE SET total_games = EXCLUDED.total_games, wins = EXCLUDED.wins, losses = EXCLUDED.losses, winrate = EXCLUDED.winrate;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION recalculate_balance_event_snapshots(UUID, BOOLEAN) IS 'Creates BEFORE and AFTER snapshots for balance events from match data. Parameters: event_id (NULL=all), recreate_all (true=truncate history first)';
