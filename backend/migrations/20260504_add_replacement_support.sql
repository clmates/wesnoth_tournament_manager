-- Migration: Add Team Member Replacement Support
-- Date: 2026-05-04
-- Description: Adds support for team member replacement/substitution workflow
-- Includes: new participation_status values, tracking fields for replacements

-- ============================================================================
-- 1. Add replacement tracking columns to tournament_participants
-- ============================================================================

ALTER TABLE tournament_participants 
ADD COLUMN IF NOT EXISTS replacement_requested_at DATETIME NULL DEFAULT NULL 
COMMENT 'When this participant was initiated for replacement by organizer';

ALTER TABLE tournament_participants 
ADD COLUMN IF NOT EXISTS replaced_by_participant_id CHAR(36) NULL DEFAULT NULL 
COMMENT 'If replaced, points to the new participant that replaced them';

ALTER TABLE tournament_participants 
ADD COLUMN IF NOT EXISTS requested_replacement_of_id CHAR(36) NULL DEFAULT NULL 
COMMENT 'If this is a substitute, points to the original participant they are replacing';

-- ============================================================================
-- 2. Create indices for replacement queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_tournament_participants_replacement_requested_at 
ON tournament_participants(replacement_requested_at);

CREATE INDEX IF NOT EXISTS idx_tournament_participants_replaced_by 
ON tournament_participants(replaced_by_participant_id);

CREATE INDEX IF NOT EXISTS idx_tournament_participants_replacement_of 
ON tournament_participants(requested_replacement_of_id);
