-- Migration: Remove player_match_statistics trigger, move logic to backend
-- Date: 2026-02-15
-- Purpose: Debuggable backend-based player statistics updates instead of trigger

-- STEP 1: Drop the trigger
DROP TRIGGER IF EXISTS trg_update_player_match_stats ON matches;

-- STEP 2: Drop the function
DROP FUNCTION IF EXISTS update_player_match_statistics();

-- STEP 3: Clean up any bad H2H records (with map/faction specifics)
DELETE FROM player_match_statistics
WHERE opponent_id IS NOT NULL 
  AND (map_id IS NOT NULL OR faction_id IS NOT NULL OR opponent_faction_id IS NOT NULL);

-- All player_match_statistics updates now handled by backend TypeScript function
