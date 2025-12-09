-- ============================================================
-- TOURNAMENT SCHEMA UPDATE v2 - Corrected for existing schema
-- ============================================================

-- Step 1: Add missing columns to tournaments table if they don't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tournaments' AND column_name = 'tournament_type'
  ) THEN
    ALTER TABLE tournaments ADD COLUMN tournament_type VARCHAR(50);
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tournaments' AND column_name = 'max_participants'
  ) THEN
    ALTER TABLE tournaments ADD COLUMN max_participants INTEGER;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tournaments' AND column_name = 'round_duration_days'
  ) THEN
    ALTER TABLE tournaments ADD COLUMN round_duration_days INTEGER DEFAULT 7;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tournaments' AND column_name = 'auto_advance_round'
  ) THEN
    ALTER TABLE tournaments ADD COLUMN auto_advance_round BOOLEAN DEFAULT false;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tournaments' AND column_name = 'current_round'
  ) THEN
    ALTER TABLE tournaments ADD COLUMN current_round INTEGER DEFAULT 0;
  END IF;
END
$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tournaments' AND column_name = 'total_rounds'
  ) THEN
    ALTER TABLE tournaments ADD COLUMN total_rounds INTEGER DEFAULT 0;
  END IF;
END
$$;

-- Step 2: Verify round_type constraint is correctly set
-- The constraint should be ('general', 'final') only
-- This should already be in place from the schema.sql

-- Step 3: Update tournament_rounds indexes if needed
CREATE INDEX IF NOT EXISTS idx_tournament_rounds_tournament ON tournament_rounds(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_rounds_status ON tournament_rounds(round_status);

-- Step 4: Update matches table to include round_id if not exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'matches' AND column_name = 'round_id'
  ) THEN
    ALTER TABLE matches ADD COLUMN round_id UUID REFERENCES tournament_rounds(id) ON DELETE SET NULL;
    CREATE INDEX idx_matches_round ON matches(round_id);
  END IF;
END
$$;

-- Step 5: Update tournament status values
-- Map 'pending' to 'registration_open'
UPDATE tournaments 
SET status = 'registration_open' 
WHERE status = 'pending' AND status NOT IN ('registration_open', 'registration_closed', 'prepared', 'in_progress', 'finished');

-- Step 6: Ensure status defaults are correct (for new tournaments)
-- Note: This won't affect existing rows, only new inserts

-- Step 7: Set default tournament_type if not set (for existing tournaments)
UPDATE tournaments
SET tournament_type = 'elimination'
WHERE tournament_type IS NULL;

-- Step 8: Create indexes for better query performance
CREATE INDEX IF NOT EXISTS idx_tournaments_status ON tournaments(status);
CREATE INDEX IF NOT EXISTS idx_tournaments_creator ON tournaments(creator_id);

-- ============================================================
-- Verification queries - uncomment to verify
-- ============================================================
-- Run these to check the schema after migration:

-- Check tournaments columns
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'tournaments'
-- ORDER BY ordinal_position;

-- Check tournament_rounds columns
-- SELECT column_name, data_type, is_nullable 
-- FROM information_schema.columns 
-- WHERE table_name = 'tournament_rounds'
-- ORDER BY ordinal_position;

-- Check round_type constraint
-- SELECT constraint_name, check_clause
-- FROM information_schema.check_constraints
-- WHERE constraint_name LIKE '%round_type%';

-- Check tournament status values
-- SELECT DISTINCT status FROM tournaments;

-- ============================================================
-- Migration complete!
-- ============================================================
