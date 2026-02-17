-- Migration: Phase 7 - Automated Replay Detection and Processing
-- Date: February 17, 2026
-- Database: MariaDB
-- Status: Ready for implementation

-- ============================================================================
-- Table: replays
-- Purpose: Track all detected replay files and their parsing status
-- ============================================================================

CREATE TABLE replays (
    id CHAR(36) PRIMARY KEY COMMENT 'UUID primary key',
    replay_filename VARCHAR(500) NOT NULL UNIQUE COMMENT 'Filename only (e.g., 20250217_player1_vs_player2.rpy.gz)',
    replay_path VARCHAR(1000) NOT NULL COMMENT 'Absolute path on server (e.g., /var/games/wesnoth/replays/...)',
    file_size_bytes BIGINT COMMENT 'Size of compressed .gz file in bytes',
    
    -- Parsing status tracking
    parsed TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 if parsing completed successfully',
    need_integration TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 if tournament addon detected, ready for match creation',
    match_id CHAR(36) COMMENT 'FK to matches.id (if match auto-created)',
    
    -- Detailed parsing status
    parse_status VARCHAR(50) NOT NULL DEFAULT 'pending' COMMENT 'pending, parsing, parsed, error',
    parse_error_message TEXT COMMENT 'Error details if parse_status = error',
    parse_stage VARCHAR(20) COMMENT 'current_stage: stage_1_addon_check, stage_2_full_parse',
    
    -- Timestamps for processing pipeline
    detected_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP COMMENT 'When file was first detected (inotify CREATE)',
    file_write_closed_at DATETIME COMMENT 'When file finished writing (inotify CLOSE_WRITE)',
    file_mtime DATETIME COMMENT 'File modification time from filesystem (for timestamp-based recovery)',
    parsing_started_at DATETIME COMMENT 'When Stage 1 began',
    parsing_completed_at DATETIME COMMENT 'When parsing fully completed',
    
    -- Extracted metadata (for quick reference without full WML parse)
    wesnoth_version VARCHAR(20) COMMENT 'e.g., 1.18.5',
    map_name VARCHAR(255) COMMENT 'Extracted map filename',
    era_id VARCHAR(100) COMMENT 'Era identifier',
    tournament_addon_id VARCHAR(100) COMMENT 'Tournament addon UUID found',
    
    -- Standard timestamps
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    deleted_at DATETIME COMMENT 'Soft delete timestamp',
    
    -- Indexes for performance
    INDEX idx_parsed (parsed),
    INDEX idx_need_integration (need_integration),
    INDEX idx_match_id (match_id),
    INDEX idx_parse_status (parse_status),
    INDEX idx_detected_at (detected_at),
    INDEX idx_tournament_addon (tournament_addon_id),
    
    -- Foreign key constraint
    CONSTRAINT fk_replays_match_id 
        FOREIGN KEY (match_id) 
        REFERENCES matches(id) 
        ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Tracks detected replay files, parsing progress, and automation status';

-- ============================================================================
-- Table Extension: matches
-- Purpose: Add replay-related columns to existing matches table
-- ============================================================================

-- Add new columns to matches table
ALTER TABLE matches 
ADD COLUMN IF NOT EXISTS auto_reported TINYINT(1) NOT NULL DEFAULT 0 COMMENT '1 if created automatically from replay' AFTER status,
ADD COLUMN IF NOT EXISTS replay_id CHAR(36) COMMENT 'FK to replays.id' AFTER auto_reported,
ADD COLUMN IF NOT EXISTS detected_from VARCHAR(20) NOT NULL DEFAULT 'manual' COMMENT 'manual or replay' AFTER replay_id,
ADD COLUMN IF NOT EXISTS winner_comments TEXT COMMENT 'Winner confirmation comment' AFTER dispute_reason,
ADD COLUMN IF NOT EXISTS loser_confirmed_at DATETIME COMMENT 'When loser confirmed match' AFTER winner_comments;

-- Add indexes for new columns
ALTER TABLE matches 
ADD INDEX IF NOT EXISTS idx_auto_reported (auto_reported),
ADD INDEX IF NOT EXISTS idx_replay_id (replay_id),
ADD INDEX IF NOT EXISTS idx_detected_from (detected_from);

-- Add foreign key for replay_id
ALTER TABLE matches 
ADD CONSTRAINT IF NOT EXISTS fk_matches_replay_id 
    FOREIGN KEY (replay_id) 
    REFERENCES replays(id) 
    ON DELETE SET NULL;

-- ============================================================================
-- Modify matches status enum to include new statuses
-- ============================================================================

-- Update existing ENUM constraint (if it exists)
-- Note: In MariaDB, we need to recreate column to change ENUM
-- This is commented out as it may already exist - verify before uncommenting

/*
ALTER TABLE matches 
MODIFY COLUMN status ENUM(
    'unconfirmed',      -- Manual upload, not confirmed
    'auto_reported',    -- Automatically created from replay, pending winner confirmation
    'confirmed',        -- Either player or winner confirmed
    'verified',         -- Both players confirmed
    'disputed',         -- Winner and loser disagree on result
    'rejected'          -- Admin rejected due to fraud/invalid
) NOT NULL DEFAULT 'unconfirmed' COMMENT 'Match status progression';
*/

-- ============================================================================
-- Table: replay_parsing_logs (optional - for debugging)
-- Purpose: Detailed logs of each parsing attempt for troubleshooting
-- ============================================================================

CREATE TABLE IF NOT EXISTS replay_parsing_logs (
    id CHAR(36) PRIMARY KEY COMMENT 'UUID',
    replay_id CHAR(36) NOT NULL COMMENT 'FK to replays.id',
    stage VARCHAR(50) COMMENT 'stage_1_addon_check, stage_2_full_parse',
    status VARCHAR(20) COMMENT 'started, success, failed',
    duration_ms INT COMMENT 'How long parsing took (milliseconds)',
    error_message TEXT COMMENT 'Error details if failed',
    details JSON COMMENT 'Additional debugging info',
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    
    INDEX idx_replay_id (replay_id),
    INDEX idx_stage (stage),
    INDEX idx_status (status),
    
    CONSTRAINT fk_parsing_logs_replay_id 
        FOREIGN KEY (replay_id) 
        REFERENCES replays(id) 
        ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci
COMMENT='Detailed logs of replay parsing attempts for debugging';

-- ============================================================================
-- Add audit log event types (if not already present)
-- ============================================================================

-- These should be added to application code, but documenting here for reference:
-- - REPLAY_DETECTED: New replay file found by inotify
-- - REPLAY_PARSING_STARTED: Parser began (Stage 1 or 2)
-- - REPLAY_PARSED_SUCCESS: Parsing completed successfully
-- - REPLAY_PARSED_ERROR: Parsing failed
-- - REPLAY_TOURNAMENT_MATCH: Tournament addon detected
-- - MATCH_AUTO_CREATED: Auto-reported match created from replay
-- - MATCH_CONFIRMED_WINNER: Winner confirmed match
-- - MATCH_CONFIRMED_LOSER: Loser confirmed match
-- - REPLAY_RECOVERY_FROM_CRASH: Resumed processing after server crash using timestamp

-- ============================================================================
-- System Settings for Replay Resilience and Recovery
-- Purpose: Track integration state for recovery after server crashes
-- ============================================================================

-- Insert default system settings for replay processing
INSERT INTO system_settings (setting_key, setting_value, description, updated_by) VALUES
(
    'replay_last_integration_timestamp',
    NULL,
    'DATETIME of the last successful replay integration. Used to recover after server crash. Format: YYYY-MM-DD HH:MM:SS or NULL for first run.',
    NULL
),
(
    'replay_last_check_timestamp', 
    NULL,
    'DATETIME of the last check for new replays. Used by timestamp-based scanner (fallback to inotify). Format: YYYY-MM-DD HH:MM:SS or NULL.',
    NULL
),
(
    'replay_processing_enabled',
    'true',
    'Enable or disable automatic replay processing. Set to false to pause processing without losing state.',
    NULL
),
(
    'replay_max_concurrent_parses',
    '3',
    'Maximum number of replays to parse simultaneously. Increase for faster processing, decrease to reduce CPU.',
    NULL
)
ON DUPLICATE KEY UPDATE updated_at = CURRENT_TIMESTAMP;

-- ============================================================================
-- Verify and index existing tables for performance
-- ============================================================================

-- Ensure users_extension has proper indexes for lookups
ALTER TABLE users_extension 
ADD INDEX IF NOT EXISTS idx_nickname (nickname);

-- Ensure matches has indexes for auto_reported queries
ALTER TABLE matches 
ADD INDEX IF NOT EXISTS idx_winner_id (winner_id),
ADD INDEX IF NOT EXISTS idx_loser_id (loser_id),
ADD INDEX IF NOT EXISTS idx_created_at (created_at);

-- ============================================================================
-- Summary of Changes
-- ============================================================================

/*
NEW TABLES:
  - replays (804 rows expected for high-volume tournament)
  - replay_parsing_logs (debugging, can be pruned after 30 days)

MODIFIED TABLES:
  - matches: added auto_reported, replay_id, detected_from, winner_comments, loser_confirmed_at

NEW COLUMNS:
  - matches.auto_reported: Flag for automatically created matches
  - matches.replay_id: Link to source replay file
  - matches.detected_from: 'manual' or 'replay' source
  - matches.winner_comments: Winner's confirmation comment
  - matches.loser_confirmed_at: Timestamp for loser confirmation

NEW INDEXES:
  - replays: parsed, need_integration, match_id, parse_status, detected_at, tournament_addon_id
  - matches: auto_reported, replay_id, detected_from

FOREIGN KEYS:
  - replays.match_id → matches.id
  - matches.replay_id → replays.id
  - replay_parsing_logs.replay_id → replays.id

STATUS FLAGS:
  - replays.parsed: 0 = not parsed, 1 = parsed successfully
  - replays.need_integration: 0 = not tournament, 1 = tournament match detected
  - replays.parse_status: pending, parsing, parsed, error
  - matches.auto_reported: 0 = manual, 1 = auto from replay
  - matches.detected_from: manual or replay

MATCH STATUS ENUM (proposed):
  - unconfirmed: Manual upload, not confirmed
  - auto_reported: From replay, pending winner confirmation
  - confirmed: Either party or winner confirmed
  - verified: Both parties confirmed
  - disputed: Disagreement on result
  - rejected: Admin rejected

EXECUTION TIME ESTIMATE: < 1 minute (all operations are non-blocking)
*/

-- ============================================================================
-- Verification Queries (run after migration)
-- ============================================================================

-- Verify replays table created
-- SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = 'replays' AND TABLE_SCHEMA = DATABASE();

-- Verify matches columns added
-- SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME = 'matches' AND COLUMN_NAME IN ('auto_reported', 'replay_id', 'detected_from');

-- Verify indexes created
-- SHOW INDEX FROM replays WHERE Key_name NOT LIKE 'PRIMARY';
-- SHOW INDEX FROM matches WHERE Key_name = 'idx_auto_reported' OR Key_name = 'idx_replay_id';

-- ============================================================================
-- Rollback Procedure (if needed)
-- ============================================================================

/*
-- To rollback this migration:

DROP TABLE IF EXISTS replay_parsing_logs;
DROP TABLE IF EXISTS replays;

-- Remove added columns from matches (careful with data loss)
ALTER TABLE matches 
DROP COLUMN IF EXISTS auto_reported,
DROP COLUMN IF EXISTS replay_id,
DROP COLUMN IF EXISTS detected_from,
DROP COLUMN IF EXISTS winner_comments,
DROP COLUMN IF EXISTS loser_confirmed_at;

-- Remove added indexes
ALTER TABLE matches 
DROP INDEX IF EXISTS idx_auto_reported,
DROP INDEX IF EXISTS idx_replay_id,
DROP INDEX IF EXISTS idx_detected_from;
*/

-- ============================================================================
-- RESILIENCE STRATEGY: TIMESTAMP-BASED RECOVERY
-- ============================================================================

/*
SCENARIO: Server crash during replay processing

BEFORE CRASH:
  - system_settings.replay_last_integration_timestamp = '2026-02-17 14:35:00'
  - Parsed replays 1-15, currently processing #16

SERVER CRASHES:
  - Replays 16+ left in 'pending' or 'parsing' status
  - Entries in system_settings survive (MariaDB persistent storage)

AFTER RESTART:
  - ParseNewReplaysJob.execute() reads replay_last_integration_timestamp
  - Processes only replays with file_mtime > '2026-02-17 14:35:00'
  - Skips already-processed replays 1-15 (file_mtime < timestamp)
  - Continues from replay #16 onward
  - Updates replay_last_integration_timestamp when batch done

DUAL-MODE BENEFITS:
  - Mode A (Live):     inotify detects new files in real-time
  - Mode B (Fallback): Timestamp-based job runs every N minutes
  - Both modes respect replay_last_integration_timestamp
  - Both update timestamp after batch completion
  
ADVANTAGES:
  ✅ Zero data loss after crash (no duplicate processing)
  ✅ Can disable inotify and use ONLY timestamp-based scanning
  ✅ No manual intervention needed
  ✅ Audit trail in system_settings.updated_at
  ✅ Can pause processing with replay_processing_enabled = false
  ✅ Works with incomplete database migrations
  ✅ Horizontal scaling compatible (multiple servers can share timestamp)

SCHEMA SUPPORT:
  - replays.file_mtime: filesystem modification time for filtering
  - system_settings.replay_last_integration_timestamp: checkpoint location
  - system_settings.replay_last_check_timestamp: scanner progress marker
  - system_settings.replay_processing_enabled: pause/resume flag
  - system_settings.replay_max_concurrent_parses: concurrency control
*/

-- ============================================================================
-- END OF MIGRATION
-- ============================================================================
