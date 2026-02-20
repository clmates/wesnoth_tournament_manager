-- Phase 8: Add integration confidence level to replays
-- Allows players to confirm/discard matches with unclear winners
-- match_id column already exists from a previous migration

ALTER TABLE replays 
ADD COLUMN integration_confidence TINYINT(1) DEFAULT 0 AFTER need_integration;

-- Index for finding pending confirmations
CREATE INDEX IF NOT EXISTS idx_pending_confirmations ON replays(integration_confidence, parsed, need_integration);
CREATE INDEX IF NOT EXISTS idx_match_link ON replays(match_id);
