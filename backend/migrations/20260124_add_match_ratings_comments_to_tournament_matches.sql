-- Migration: Add match ratings, comments, replay, and status to tournament_matches
-- Purpose: Extend tournament_matches table with columns equivalent to the matches table
-- This allows unranked tournaments (1v1 and teams) to store detailed match information
-- including player ratings, comments, replay files, and match status
-- Date: 2026-01-24

-- ============================================================================
-- 1. Add new columns to tournament_matches table
-- ============================================================================
ALTER TABLE tournament_matches
ADD COLUMN IF NOT EXISTS winner_comments TEXT,
ADD COLUMN IF NOT EXISTS winner_rating INTEGER,
ADD COLUMN IF NOT EXISTS loser_comments TEXT,
ADD COLUMN IF NOT EXISTS loser_rating INTEGER,
ADD COLUMN IF NOT EXISTS replay_file_path VARCHAR(500),
ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'unconfirmed';

-- ============================================================================
-- 2. Add constraints for rating columns
-- ============================================================================
ALTER TABLE tournament_matches
ADD CONSTRAINT tournament_matches_winner_rating_check 
CHECK (winner_rating IS NULL OR (winner_rating >= 1 AND winner_rating <= 5)),
ADD CONSTRAINT tournament_matches_loser_rating_check 
CHECK (loser_rating IS NULL OR (loser_rating >= 1 AND loser_rating <= 5)),
ADD CONSTRAINT tournament_matches_status_check 
CHECK (status IS NULL OR status IN ('unconfirmed', 'confirmed', 'disputed', 'cancelled'));

-- ============================================================================
-- 3. Add comments for clarity
-- ============================================================================
COMMENT ON COLUMN tournament_matches.winner_comments IS 'Optional comments from the winner about the match';
COMMENT ON COLUMN tournament_matches.winner_rating IS 'Winner rating (1-5) of opponent performance';
COMMENT ON COLUMN tournament_matches.loser_comments IS 'Optional comments from the loser about the match';
COMMENT ON COLUMN tournament_matches.loser_rating IS 'Loser rating (1-5) of opponent performance';
COMMENT ON COLUMN tournament_matches.replay_file_path IS 'Path/URL to the replay file stored in storage service';
COMMENT ON COLUMN tournament_matches.status IS 'Match confirmation status: unconfirmed, confirmed, disputed, cancelled';

-- ============================================================================
-- 4. Create indexes for common queries
-- ============================================================================
CREATE INDEX IF NOT EXISTS idx_tournament_matches_status 
ON tournament_matches(status);

CREATE INDEX IF NOT EXISTS idx_tournament_matches_rating 
ON tournament_matches(winner_rating, loser_rating);

-- ============================================================================
-- 5. Update existing matches with values from linked matches table if available
-- ============================================================================
-- For matches that have match_id pointing to the matches table,
-- copy the rating and comment data from matches
UPDATE tournament_matches tm
SET 
  winner_comments = m.winner_comments,
  winner_rating = m.winner_rating,
  loser_comments = m.loser_comments,
  loser_rating = m.loser_rating,
  replay_file_path = m.replay_file_path,
  status = m.status
FROM matches m
WHERE tm.match_id = m.id
  AND (tm.winner_comments IS NULL OR tm.winner_rating IS NULL 
       OR tm.loser_comments IS NULL OR tm.loser_rating IS NULL
       OR tm.replay_file_path IS NULL OR tm.status IS NULL);
