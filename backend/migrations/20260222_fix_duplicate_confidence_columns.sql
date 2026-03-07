-- Migration: Remove Duplicate Detection Confidence Column
-- Date: 2026-02-22
-- Purpose: Remove detection_confidence column (was created by mistake), use only integration_confidence

-- ============================================================================
-- 1. CLEAN UP DUPLICATE COLUMN
-- ============================================================================

-- The integration_confidence column is the primary confidence tracker for replay parsing.
-- Remove detection_confidence column if it was created (it was a mistake)
ALTER TABLE replays DROP COLUMN IF EXISTS detection_confidence;

-- ============================================================================
-- 2. MIGRATION COMPLETE
-- ============================================================================

INSERT INTO migrations (name, executed_at) VALUES ('20260222_fix_duplicate_confidence_columns', NOW());
