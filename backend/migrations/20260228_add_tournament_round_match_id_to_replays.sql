-- Migration: Add tournament_round_match_id to replays
-- Allows linking a parsed replay (confidence=1, pending confirmation) 
-- to the specific tournament_round_match it belongs to.
-- This enables the tournament round match view to surface the pending replay
-- and let the player confirm the result without manually reporting.

ALTER TABLE replays
  ADD COLUMN tournament_round_match_id char(36) NULL AFTER match_id,
  ADD INDEX idx_replay_trm_id (tournament_round_match_id);
