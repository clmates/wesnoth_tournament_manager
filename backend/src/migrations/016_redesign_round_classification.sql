-- Redesign tournament rounds classification based on tournament type
-- This migration adds better semantics for round types per tournament format

-- Add new columns to tournament_rounds for better classification
ALTER TABLE tournament_rounds
ADD COLUMN IF NOT EXISTS round_classification VARCHAR(50) DEFAULT 'standard' CHECK (round_classification IN (
  'standard',           -- For League tournaments (all rounds are league rounds)
  'swiss',              -- For Swiss tournaments (all rounds are swiss)
  'general',            -- For Swiss-Elimination Mix (swiss phase)
  'elimination',        -- For Swiss-Elimination Mix (elimination phase)
  'quarterfinals',      -- For Elimination tournaments (8→4)
  'semifinals',         -- For Elimination tournaments (4→2)
  'final'               -- For Elimination tournaments (2→1) or final round of any type
)),
ADD COLUMN IF NOT EXISTS players_remaining INTEGER,
ADD COLUMN IF NOT EXISTS players_advancing_to_next INTEGER;

-- Create index for better query performance
CREATE INDEX IF NOT EXISTS idx_tournament_rounds_classification ON tournament_rounds(round_classification);

-- Add comment columns for better documentation
COMMENT ON COLUMN tournament_rounds.round_classification IS 'Semantic classification of round type based on tournament format';
COMMENT ON COLUMN tournament_rounds.players_remaining IS 'Number of players in this round at start';
COMMENT ON COLUMN tournament_rounds.players_advancing_to_next IS 'Number of players advancing to next round';
