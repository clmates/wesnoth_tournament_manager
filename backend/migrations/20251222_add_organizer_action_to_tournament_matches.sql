-- Add organizer_action column to tournament_matches
-- This tracks when the tournament organizer assigns a win/loss due to player abandonment
-- Using DO block to safely handle if column already exists

DO $$ 
BEGIN
  -- Add column only if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'tournament_matches' 
    AND column_name = 'organizer_action'
  ) THEN
    ALTER TABLE tournament_matches 
    ADD COLUMN organizer_action VARCHAR(50) DEFAULT NULL 
    CHECK (organizer_action IN ('organizer_win', 'organizer_loss'));
    
    -- Add index for filtering organizer actions
    CREATE INDEX idx_tournament_matches_organizer_action ON tournament_matches(organizer_action);
  END IF;
END $$;
