-- ============================================================================
-- Fix: get_balance_event_forward_impact - ambiguous column reference
-- ============================================================================
-- The function had ambiguous column references for faction_id and map_id
-- This migration recreates the function with proper table aliases

DROP FUNCTION IF EXISTS get_balance_event_forward_impact(UUID);

CREATE OR REPLACE FUNCTION get_balance_event_forward_impact(
  event_id_param UUID
)
RETURNS TABLE(
  map_id UUID,
  map_name VARCHAR,
  faction_id UUID,
  faction_name VARCHAR,
  opponent_faction_id UUID,
  opponent_faction_name VARCHAR,
  winrate DECIMAL(5,2),
  total_games INT,
  wins INT,
  losses INT,
  snapshot_date DATE,
  days_since_event INT
) AS $$
DECLARE
  v_event_date DATE;
  v_next_event_date DATE;
  v_faction_id UUID;
  v_map_id UUID;
BEGIN
  -- Get current event details (use table alias to avoid ambiguity)
  SELECT be.event_date::DATE, be.faction_id, be.map_id
  INTO v_event_date, v_faction_id, v_map_id
  FROM balance_events be
  WHERE be.id = event_id_param;
  
  IF v_event_date IS NULL THEN
    RAISE EXCEPTION 'Balance event not found: %', event_id_param;
  END IF;

  -- Get next event date (if any)
  SELECT be.event_date::DATE
  INTO v_next_event_date
  FROM balance_events be
  WHERE be.event_date::DATE > v_event_date
  ORDER BY be.event_date ASC
  LIMIT 1;

  -- If no next event, use today
  IF v_next_event_date IS NULL THEN
    v_next_event_date := CURRENT_DATE;
  END IF;

  RETURN QUERY
  SELECT
    fms.map_id,
    gm.name as map_name,
    fms.faction_id,
    f1.name as faction_name,
    fms.opponent_faction_id,
    f2.name as opponent_faction_name,
    fms.winrate,
    fms.total_games,
    fms.wins,
    fms.losses,
    fms.snapshot_date,
    (fms.snapshot_date - v_event_date)::INT as days_since_event
  FROM faction_map_statistics_history fms
  JOIN game_maps gm ON fms.map_id = gm.id
  JOIN factions f1 ON fms.faction_id = f1.id
  JOIN factions f2 ON fms.opponent_faction_id = f2.id
  WHERE fms.snapshot_date BETWEEN v_event_date AND v_next_event_date
  AND (v_faction_id IS NULL OR fms.faction_id = v_faction_id)
  AND (v_map_id IS NULL OR fms.map_id = v_map_id)
  ORDER BY fms.snapshot_date ASC, fms.map_id, fms.faction_id;
END;
$$ LANGUAGE plpgsql;

COMMENT ON FUNCTION get_balance_event_forward_impact(UUID) IS 'Returns balance statistics from event date onwards until next event or today';
