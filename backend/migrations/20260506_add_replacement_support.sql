-- Migration: Add Team Member Replacement Support
-- Date: 2026-05-06
-- Description: Adds support for team member replacement/substitution workflow
-- Includes: replacement tracking fields, foreign keys, and indices

-- ============================================================================
-- 1. Add replacement tracking columns to tournament_participants (if missing)
-- ============================================================================

ALTER TABLE tournament_participants 
ADD COLUMN IF NOT EXISTS replacement_requested_at DATETIME NULL DEFAULT NULL;

ALTER TABLE tournament_participants 
ADD COLUMN IF NOT EXISTS replaced_by_participant_id CHAR(36) NULL DEFAULT NULL;

ALTER TABLE tournament_participants 
ADD COLUMN IF NOT EXISTS requested_replacement_of_id CHAR(36) NULL DEFAULT NULL;

-- ============================================================================
-- 2. Create indices for replacement queries (if missing)
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_tournament_participants_replacement_requested_at 
ON tournament_participants(replacement_requested_at);

CREATE INDEX IF NOT EXISTS idx_tournament_participants_replaced_by 
ON tournament_participants(replaced_by_participant_id);

CREATE INDEX IF NOT EXISTS idx_tournament_participants_replacement_of 
ON tournament_participants(requested_replacement_of_id);
