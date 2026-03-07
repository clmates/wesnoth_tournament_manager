-- Migration 012: Remove UNIQUE constraint from tournament_matches
-- The constraint (round_id, player1_id, player2_id) prevents multiple matches 
-- in the same pairing for Best Of series. Removing it allows flexibility for all tournament formats.

-- Drop the constraint if it exists
DO $$
BEGIN
  ALTER TABLE tournament_matches
  DROP CONSTRAINT IF EXISTS tournament_matches_round_id_player1_id_player2_id_key;
EXCEPTION WHEN OTHERS THEN
  NULL; -- Ignore if constraint doesn't exist
END $$;
