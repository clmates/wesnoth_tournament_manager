-- ============================================================
-- TOURNAMENT ROUNDS SCHEMA UPDATE v2
-- Updates the database schema to the new round configuration
-- ============================================================
-- IMPORTANT: Run this AFTER ensuring schema.sql has been applied
-- This migration is idempotent (safe to run multiple times)
-- ============================================================

-- Step 1: Add new columns to tournaments table (if not exists)
-- These columns are needed for the new round configuration system
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tournaments' AND column_name = 'general_rounds'
  ) THEN
    ALTER TABLE tournaments ADD COLUMN general_rounds INTEGER DEFAULT 0;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tournaments' AND column_name = 'final_rounds'
  ) THEN
    ALTER TABLE tournaments ADD COLUMN final_rounds INTEGER DEFAULT 0;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tournaments' AND column_name = 'registration_closed_at'
  ) THEN
    ALTER TABLE tournaments ADD COLUMN registration_closed_at TIMESTAMP;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tournaments' AND column_name = 'prepared_at'
  ) THEN
    ALTER TABLE tournaments ADD COLUMN prepared_at TIMESTAMP;
  END IF;
END
$$;

-- Step 2: Add round_type column to tournament_rounds if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tournament_rounds' AND column_name = 'round_type'
  ) THEN
    ALTER TABLE tournament_rounds ADD COLUMN round_type VARCHAR(20) DEFAULT 'general';
    -- Add constraint after adding the column
    ALTER TABLE tournament_rounds 
      ADD CONSTRAINT tournament_rounds_round_type_check 
      CHECK (round_type IN ('general', 'final'));
  END IF;
END
$$;

-- Step 3: If upgrading from old schema, map old round types to new ones
-- This handles the migration from (general, final_rounds, great_final) to (general, final)
UPDATE tournament_rounds 
SET round_type = 'final' 
WHERE round_type = 'final_rounds' OR round_type = 'great_final';

-- Step 4: Ensure match_format is correctly set based on round_type
UPDATE tournament_rounds 
SET match_format = 'bo3' 
WHERE round_type = 'general' AND match_format != 'bo3';

UPDATE tournament_rounds 
SET match_format = 'bo5' 
WHERE round_type = 'final' AND match_format != 'bo5';

-- Step 5: Update tournament status values to new state machine
-- Old schema: pending, in_progress, finished
-- New schema: registration_open, registration_closed, prepared, in_progress, finished

-- Map old 'pending' to 'registration_open' if not already done
UPDATE tournaments 
SET status = 'registration_open' 
WHERE status = 'pending' AND status != 'registration_open';

-- Map old 'active' to 'in_progress' if not already done
UPDATE tournaments 
SET status = 'in_progress' 
WHERE status = 'active' AND status != 'in_progress';

-- Step 6: Set current_round to 0 for new tournaments (if still 1)
UPDATE tournaments 
SET current_round = 0 
WHERE current_round = 1 AND status = 'registration_open';

-- Step 7: Ensure max_participants is NOT NULL (add default if needed)
-- Note: This requires manual review if you have NULL values
-- UPDATE tournaments SET max_participants = 0 WHERE max_participants IS NULL;

-- Step 8: Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_tournament_rounds_type ON tournament_rounds(round_type);
CREATE INDEX IF NOT EXISTS idx_tournaments_status ON tournaments(status);
CREATE INDEX IF NOT EXISTS idx_tournaments_creator ON tournaments(creator_id);

-- Step 9: Verify migration success
-- Run this to check the schema after migration:
-- SELECT * FROM information_schema.columns 
-- WHERE table_name IN ('tournaments', 'tournament_rounds') 
-- ORDER BY table_name, ordinal_position;

-- ============================================================
-- Migration complete!
-- ============================================================
-- Summary of changes:
-- 1. Added columns: general_rounds, final_rounds, registration_closed_at, prepared_at
-- 2. Added column: round_type (with CHECK constraint for 'general' | 'final')
-- 3. Migrated old round types to new semantics:
--    - 'final_rounds' and 'great_final' → 'final'
-- 4. Updated match formats based on round type:
--    - 'general' rounds → 'bo3'
--    - 'final' rounds → 'bo5'
-- 5. Updated tournament statuses to new lifecycle
-- 6. Created indexes for performance
--
-- IMPORTANT: Review any NULL max_participants values manually
-- ============================================================
