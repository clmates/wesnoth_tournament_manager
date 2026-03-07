-- ============================================================================
-- Script to recalculate historical statistics snapshots
-- Use this when you create new balance events for dates in the past
-- ============================================================================

-- First, create snapshots for all missing dates up to today
-- This will populate faction_map_statistics_history with current data as 
-- snapshots for all historical dates

BEGIN;

-- Clear existing snapshots (optional - comment out if you want to keep them)
-- DELETE FROM faction_map_statistics_history;

-- Generate snapshots for today and all historical dates that are missing
-- This creates a complete historical record from the current statistics
SELECT create_faction_map_statistics_snapshot(snapshot_date)
FROM (
  -- Generate a series of dates from the earliest match date to today
  SELECT DISTINCT DATE(created_at) as snapshot_date
  FROM matches
  WHERE created_at IS NOT NULL
  ORDER BY snapshot_date DESC
  LIMIT 1000  -- Adjust limit if you have more historical data
) date_series;

COMMIT;

-- Verify the snapshots were created
SELECT 
  COUNT(*) as total_snapshots,
  MIN(snapshot_date) as earliest_snapshot,
  MAX(snapshot_date) as latest_snapshot
FROM faction_map_statistics_history;

-- Check balance events registered
SELECT 
  id,
  event_date,
  event_type,
  description,
  faction_id,
  map_id
FROM balance_events
ORDER BY event_date DESC;
