-- Phase 8: Add integration confidence level to replays
-- Allows players to confirm/discard matches with unclear winners
-- match_id column already exists from a previous migration

ALTER TABLE replays 
ADD COLUMN integration_confidence TINYINT(1) DEFAULT 0 AFTER need_integration;

-- Index for finding pending confirmations
CREATE INDEX IF NOT EXISTS idx_pending_confirmations ON replays(integration_confidence, parsed, need_integration);
CREATE INDEX IF NOT EXISTS idx_match_link ON replays(match_id);

-- Create table for replay participants (for linking players to replays)
CREATE TABLE IF NOT EXISTS replay_participants (
    id VARCHAR(36) PRIMARY KEY,
    replay_id VARCHAR(36) NOT NULL,
    player_id INT NOT NULL,
    player_name VARCHAR(255),
    side INT,
    faction_name VARCHAR(255),
    result_side INT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (replay_id) REFERENCES replays(id) ON DELETE CASCADE,
    INDEX idx_replay (replay_id),
    INDEX idx_player (player_id),
    UNIQUE KEY unique_replay_player (replay_id, player_id)
);
