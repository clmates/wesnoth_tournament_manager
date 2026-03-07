-- Migration: Add Cancel Column to Replays Table
-- Date: 2026-02-27
-- Purpose: Support "Cancel Replay" feature for games that were saved mid-match
--          (Save & Exit scenario). Both players must agree to cancel.
--
-- Flow:
--   1. Player 1 clicks "Cancel Replay" → cancel_requested_by = player1_user_id
--   2. Player 2 also clicks "Cancel Replay" → the replay row is DELETED entirely.
--
-- Replays exist only to become confirmed matches. If both players agree the game
-- was not finished, there is no match to create and the record can be removed.
-- Only the first-player request needs to be persisted between both clicks.

-- ============================================================================
-- 1. ADD CANCEL REQUEST TRACKING COLUMN
-- ============================================================================

-- Stores the user ID of the first player who requested the replay be cancelled.
-- When the second player also requests cancel, the row is deleted (not updated).
ALTER TABLE replays ADD COLUMN IF NOT EXISTS cancel_requested_by VARCHAR(36) DEFAULT NULL;

-- ============================================================================
-- 2. ADD INDEX
-- ============================================================================

ALTER TABLE replays ADD KEY IF NOT EXISTS idx_cancel_requested_by (cancel_requested_by);

-- ============================================================================
-- 3. MIGRATION COMPLETE
-- ============================================================================

INSERT INTO migrations (name, executed_at) VALUES ('20260227_add_replay_cancel_columns', NOW());
