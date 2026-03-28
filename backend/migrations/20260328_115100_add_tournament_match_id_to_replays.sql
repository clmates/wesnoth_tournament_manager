-- Add tournament_match_id column to replays table
-- Allows replays to be linked to tournament_matches (for unranked/tournament matches)
-- while keeping match_id for ranked matches

ALTER TABLE replays 
ADD COLUMN tournament_match_id CHAR(36) NULL AFTER match_id,
ADD CONSTRAINT fk_replays_tournament_match_id 
  FOREIGN KEY (tournament_match_id) 
  REFERENCES tournament_matches(id) 
  ON DELETE SET NULL;
