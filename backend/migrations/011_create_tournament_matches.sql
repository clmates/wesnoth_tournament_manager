-- Migration 011: Create tournament_matches and tournament_round_matches tables
-- This migration creates the table structure for managing tournament matches and Best Of series

-- Create tournament_round_matches table first (since tournament_matches references it)
CREATE TABLE IF NOT EXISTS tournament_round_matches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round_id UUID NOT NULL REFERENCES tournament_rounds(id) ON DELETE CASCADE,
  player1_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  player2_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  best_of INT NOT NULL CHECK (best_of IN (1, 3, 5)),
  wins_required INT NOT NULL,
  player1_wins INT NOT NULL DEFAULT 0,
  player2_wins INT NOT NULL DEFAULT 0,
  matches_scheduled INT NOT NULL DEFAULT 0,
  series_status VARCHAR(50) NOT NULL DEFAULT 'in_progress' CHECK (series_status IN ('in_progress', 'completed')),
  winner_id UUID REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tournament_id, round_id, player1_id, player2_id)
);

-- Add column tournament_round_match_id to tournament_matches if it doesn't exist
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'tournament_matches' AND column_name = 'tournament_round_match_id'
  ) THEN
    ALTER TABLE tournament_matches
    ADD COLUMN tournament_round_match_id UUID REFERENCES tournament_round_matches(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Add indexes for tournament_round_matches
CREATE INDEX IF NOT EXISTS idx_tournament_round_matches_tournament ON tournament_round_matches(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_round_matches_round ON tournament_round_matches(round_id);
CREATE INDEX IF NOT EXISTS idx_tournament_round_matches_players ON tournament_round_matches(player1_id, player2_id);

-- Add indexes for tournament_matches
CREATE INDEX IF NOT EXISTS idx_tournament_matches_tournament ON tournament_matches(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_round ON tournament_matches(round_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_player1 ON tournament_matches(player1_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_player2 ON tournament_matches(player2_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_winner ON tournament_matches(winner_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_match ON tournament_matches(match_id);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_status ON tournament_matches(match_status);
CREATE INDEX IF NOT EXISTS idx_tournament_matches_round_match ON tournament_matches(tournament_round_match_id);
