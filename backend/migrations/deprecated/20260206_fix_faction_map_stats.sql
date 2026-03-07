-- Migration: Fix Faction Map Statistics Calculation
-- Date: 2026-02-06
-- Issue: Many matches were not being counted in faction_map_statistics
--        because they were inserted before the trigger was properly set up
--        or the trigger was disabled

-- Step 1: Re-enable trigger if it's disabled
ALTER TABLE IF EXISTS matches ENABLE TRIGGER trg_update_faction_map_stats;

-- Step 2: Recalculate all statistics from scratch
SELECT recalculate_faction_map_statistics();

-- Step 3: Verify the fix worked
WITH stats_summary AS (
  SELECT 
    COUNT(*) as total_rows,
    CEIL(SUM(total_games) / 2.0) as estimated_unique_games,
    MIN(total_games) as min_games_per_record,
    MAX(total_games) as max_games_per_record,
    AVG(total_games) as avg_games_per_record
  FROM faction_map_statistics
),
matches_count AS (
  SELECT COUNT(*) as total_matches
  FROM matches
  WHERE status != 'cancelled'
)
SELECT 
  s.total_rows,
  s.estimated_unique_games,
  m.total_matches,
  (CEIL(s.estimated_unique_games) = m.total_matches) as is_correct,
  CASE 
    WHEN CEIL(s.estimated_unique_games) = m.total_matches THEN '✓ Stats are correct'
    ELSE '✗ Mismatch detected: ' || s.estimated_unique_games || ' calculated vs ' || m.total_matches || ' in matches'
  END as verification
FROM stats_summary s, matches_count m;

-- Step 4: Show faction statistics distribution
SELECT 
  f.name as faction_name,
  COUNT(fms.id) as matchups_count,
  SUM(fms.total_games) as total_games_played,
  SUM(fms.wins) as total_wins,
  SUM(fms.losses) as total_losses,
  ROUND(100.0 * SUM(fms.wins) / SUM(fms.total_games), 2) as overall_winrate
FROM faction_map_statistics fms
JOIN factions f ON fms.faction_id = f.id
GROUP BY f.id, f.name
ORDER BY overall_winrate DESC;
