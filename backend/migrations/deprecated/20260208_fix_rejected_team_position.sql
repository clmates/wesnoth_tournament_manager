-- Migration: Fix team_position constraint for rejected players
-- Date: 2026-02-08
-- Description: Allows NULL team_position for rejected players team members
--              Rejects should have team_position = NULL instead of sequential numbers

-- The check constraint (team_position IS NULL OR team_position IN (1, 2))
-- already allows NULL, so we just need to update the code to use NULL
-- for rejected player team members instead of incrementing position numbers

-- This is a code-only fix, no database schema changes needed
-- The constraint already supports NULL values, we just need to update
-- the application logic to set team_position = NULL for rejected players

COMMENT ON TABLE tournament_participants IS 'Tournament participants with optional team support.
  For team tournaments: team_id and team_position (1-2) are used
  For rejected players: team_id points to rejected team, team_position should be NULL
  For regular tournaments: team_id and team_position are NULL';
