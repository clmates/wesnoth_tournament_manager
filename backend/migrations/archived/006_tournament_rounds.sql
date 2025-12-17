-- Create tournament rounds configuration table (UPDATED)
CREATE TABLE IF NOT EXISTS tournament_rounds (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  round_type VARCHAR(20) NOT NULL CHECK (round_type IN ('general', 'final')),
  match_format VARCHAR(10) NOT NULL CHECK (match_format IN ('bo1', 'bo3', 'bo5')),
  round_status VARCHAR(20) DEFAULT 'pending' CHECK (round_status IN ('pending', 'in_progress', 'completed')),
  round_start_date TIMESTAMP,
  round_end_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tournament_id, round_number)
);

-- Add index for faster queries
CREATE INDEX IF NOT EXISTS idx_tournament_rounds_tournament ON tournament_rounds(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_rounds_status ON tournament_rounds(round_status);
CREATE INDEX IF NOT EXISTS idx_tournament_rounds_type ON tournament_rounds(round_type);

-- Update matches table to include round_id if not exists
ALTER TABLE matches ADD COLUMN IF NOT EXISTS round_id UUID REFERENCES tournament_rounds(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_matches_round ON matches(round_id);

-- Update tournaments table with new fields (if running against old schema)
-- This is safe to run multiple times with IF NOT EXISTS
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS general_rounds INTEGER DEFAULT 0;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS final_rounds INTEGER DEFAULT 0;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS registration_closed_at TIMESTAMP;
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS prepared_at TIMESTAMP;

-- Update status values if needed
-- Change old status values to new ones
UPDATE tournaments SET status = 'registration_open' WHERE status = 'pending' AND status != 'registration_open';
UPDATE tournaments SET status = 'in_progress' WHERE status = 'active' AND status != 'in_progress';

