-- Migration: Add Missing Replay Columns
-- Date: 2026-02-21
-- Purpose: Add columns that should have been created in the previous migration

-- ============================================================================
-- 1. ADD MISSING COLUMNS TO REPLAYS TABLE
-- ============================================================================

-- Add forum database source identifier
ALTER TABLE replays ADD COLUMN IF NOT EXISTS instance_uuid CHAR(36);

-- Add game flags that might be missing
ALTER TABLE replays ADD COLUMN IF NOT EXISTS oos TINYINT(1) DEFAULT 0;

-- Add detection confidence that might be missing
ALTER TABLE replays ADD COLUMN IF NOT EXISTS detection_confidence TINYINT(1);

-- Add replay server URL (if missing)
ALTER TABLE replays ADD COLUMN IF NOT EXISTS replay_url VARCHAR(1000);

-- Add timestamp for forum sync tracking (if missing)
ALTER TABLE replays ADD COLUMN IF NOT EXISTS last_checked_at DATETIME;

-- Add game_name if it doesn't exist
ALTER TABLE replays ADD COLUMN IF NOT EXISTS game_name VARCHAR(255);

-- ============================================================================
-- 2. ADD MISSING INDEXES
-- ============================================================================

-- Index for forum source tracking
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
-- 3. UPDATE FOREIGN KEYS
-- ============================================================================

-- Drop old foreign key if exists
ALTER TABLE matches DROP FOREIGN KEY IF EXISTS fk_matches_replay;

-- Add new foreign key constraint
ALTER TABLE matches ADD CONSTRAINT fk_matches_replay 
  FOREIGN KEY (replay_id) REFERENCES replays(id) ON DELETE SET NULL;

-- ============================================================================
-- 4. MIGRATION COMPLETE
-- ============================================================================

INSERT INTO migrations (name, executed_at) VALUES ('20260221_add_missing_replay_columns', NOW());
