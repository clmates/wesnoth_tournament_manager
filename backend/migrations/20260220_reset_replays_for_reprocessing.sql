-- Reset replays with need_integration=1 for reprocessing with new validation, extraction, and surrender detection
-- This migration clears cached parse results so existing replays can be reprocessed with the improved logic:
-- - Map selection validation (discard $next_scenario replays)
-- - Fallback extraction from [old_sideN] blocks
-- - Surrender detection from server messages

UPDATE replays 
SET 
    parse_status = 'pending',  -- Mark as pending for full parse (bypass quick addon check)
    parsed = 0,                 -- Reset parsed flag
    parsing_started_at = NULL,  -- Clear timestamps
    parsing_completed_at = NULL,
    parse_error_message = NULL, -- Clear any previous errors
    parse_summary = NULL,
    parse_stage = NULL,
    -- Keep scenario/map data, but allow re-extraction:
    wesnoth_version = NULL,
    era_id = NULL,
    tournament_addon_id = NULL,
    -- Clear integration confidence so new logic can set it
    integration_confidence = NULL,
    match_id = NULL             -- Clear match link (will be re-determined)
WHERE need_integration = 1
  AND parse_status != 'error';  -- Don't touch replays that had actual parse errors

-- Verify the reset
SELECT COUNT(*) as reset_count, parse_status 
FROM replays 
WHERE need_integration = 1 
  AND parsing_started_at IS NULL
GROUP BY parse_status;
