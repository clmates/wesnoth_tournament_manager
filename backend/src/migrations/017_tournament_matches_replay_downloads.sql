-- Add replay_downloads column to tournament_matches table
ALTER TABLE tournament_matches
ADD COLUMN IF NOT EXISTS replay_downloads INTEGER DEFAULT 0;

-- Create an index for faster queries
CREATE INDEX IF NOT EXISTS idx_tournament_matches_replay_downloads 
ON tournament_matches(replay_downloads DESC);
