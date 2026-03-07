-- Migration: Replay Processing Refactor
-- Date: 2026-02-21
-- Purpose: Add forum database integration columns and restructure replay/match linking

-- ============================================================================
-- 1. UPDATE MATCHES TABLE
-- ============================================================================

-- Increase replay_file_path to accommodate full URLs
ALTER TABLE matches MODIFY COLUMN replay_file_path VARCHAR(1000);

-- Remove detected_from from matches (detection metadata belongs in replays table)
ALTER TABLE matches DROP COLUMN IF EXISTS detected_from;

-- ============================================================================
-- 2. UPDATE REPLAYS TABLE
-- ============================================================================

-- Add forum database source identifiers
ALTER TABLE replays ADD COLUMN IF NOT EXISTS instance_uuid CHAR(36);
ALTER TABLE replays ADD COLUMN IF NOT EXISTS game_id INT UNSIGNED;

-- Add game metadata from wesnothd_game_info
ALTER TABLE replays ADD COLUMN IF NOT EXISTS game_name VARCHAR(255);
ALTER TABLE replays ADD COLUMN IF NOT EXISTS start_time TIMESTAMP;
ALTER TABLE replays ADD COLUMN IF NOT EXISTS end_time TIMESTAMP;

-- Add game flags
ALTER TABLE replays ADD COLUMN IF NOT EXISTS oos TINYINT(1) DEFAULT 0;
ALTER TABLE replays ADD COLUMN IF NOT EXISTS is_reload TINYINT(1) DEFAULT 0;

-- Add detection/confidence information
-- Note: Integration_confidence already exists, but adding detection_confidence for clarity
ALTER TABLE replays ADD COLUMN IF NOT EXISTS detection_confidence TINYINT(1);
ALTER TABLE replays ADD COLUMN IF NOT EXISTS detected_from VARCHAR(50) DEFAULT 'manual';

-- Add replay server URL (built from game metadata)
ALTER TABLE replays ADD COLUMN IF NOT EXISTS replay_url VARCHAR(1000);

-- Add timestamp for forum sync tracking
ALTER TABLE replays ADD COLUMN IF NOT EXISTS last_checked_at DATETIME;

-- ============================================================================
-- 3. ADD INDEXES FOR EFFICIENT QUERIES
-- ============================================================================

-- Index for forum source tracking (used by syncGamesFromForum)
ALTER TABLE replays ADD UNIQUE KEY IF NOT EXISTS uq_instance_game (instance_uuid, game_id);

-- Index for match linking
ALTER TABLE replays ADD KEY IF NOT EXISTS idx_match_id (match_id);

-- Index for parse status queries
ALTER TABLE replays ADD KEY IF NOT EXISTS idx_parsed (parsed);

-- Index for forum sync queries
ALTER TABLE replays ADD KEY IF NOT EXISTS idx_last_checked (last_checked_at);

-- Index for game end time (when fetching games from forum)
ALTER TABLE replays ADD KEY IF NOT EXISTS idx_end_time (end_time);

-- Index for detection confidence (for reporting pending matches)
ALTER TABLE replays ADD KEY IF NOT EXISTS idx_detection_confidence (detection_confidence);

-- Index for detected_from filtering
ALTER TABLE replays ADD KEY IF NOT EXISTS idx_detected_from (detected_from);

-- ============================================================================
-- 4. ENSURE FOREIGN KEY CONSTRAINT
-- ============================================================================

-- Drop old foreign key if exists
ALTER TABLE matches DROP FOREIGN KEY IF EXISTS fk_matches_replay;

-- Add new foreign key constraint
ALTER TABLE matches ADD CONSTRAINT fk_matches_replay 
  FOREIGN KEY (replay_id) REFERENCES replays(id) ON DELETE SET NULL;

-- ============================================================================
-- 5. MIGRATION COMPLETE
-- ============================================================================

INSERT INTO migrations (name, executed_at) VALUES ('20260221_replay_processing_refactor', NOW());
