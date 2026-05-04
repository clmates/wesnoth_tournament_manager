-- Migration: Add Team Member Replacement Support
-- Date: 2026-05-04
-- Description: Adds support for team member replacement/substitution workflow
-- Includes: new participation_status values, tracking fields for replacements

-- ============================================================================
-- 1. Add new participation_status values and update CHECK constraint
-- ============================================================================

-- First, verify the participation_status column accepts new values
-- MariaDB allows modifying CHECK constraints via table restructure

ALTER TABLE tournament_participants
MODIFY COLUMN participation_status VARCHAR(30) DEFAULT 'pending' 
CHECK (participation_status IN ('pending', 'accepted', 'pending_replacement', 'replaced'));

-- ============================================================================
-- 2. Add replacement tracking columns to tournament_participants
-- ============================================================================

ALTER TABLE tournament_participants 
ADD COLUMN IF NOT EXISTS replacement_requested_at DATETIME NULL DEFAULT NULL AFTER participation_status;

ALTER TABLE tournament_participants 
ADD COLUMN IF NOT EXISTS replaced_by_participant_id CHAR(36) NULL DEFAULT NULL AFTER replacement_requested_at;

ALTER TABLE tournament_participants 
ADD COLUMN IF NOT EXISTS requested_replacement_of_id CHAR(36) NULL DEFAULT NULL AFTER replaced_by_participant_id;

-- Add foreign keys for replacement tracking (optional but recommended for data integrity)
ALTER TABLE tournament_participants 
ADD CONSTRAINT fk_replaced_by_participant 
FOREIGN KEY (replaced_by_participant_id) REFERENCES tournament_participants(id) ON DELETE SET NULL;

ALTER TABLE tournament_participants 
ADD CONSTRAINT fk_replacement_of_participant 
FOREIGN KEY (requested_replacement_of_id) REFERENCES tournament_participants(id) ON DELETE SET NULL;

-- ============================================================================
-- 3. Create indices for replacement queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_tournament_participants_participation_status 
ON tournament_participants(participation_status);

CREATE INDEX IF NOT EXISTS idx_tournament_participants_replacement_requested_at 
ON tournament_participants(replacement_requested_at);

-- ============================================================================
-- 4. Documentation/Comments
-- ============================================================================

ALTER TABLE tournament_participants 
COMMENT = 'Tournament participants (individual or team members). Tracks participation_status through tournament lifecycle including replacements.';

-- Update column comments
ALTER TABLE tournament_participants 
MODIFY COLUMN participation_status VARCHAR(30) 
COMMENT 'Participant status: pending (join request), accepted (active), pending_replacement (substitute waiting confirmation), replaced (was replaced mid-tournament)';

ALTER TABLE tournament_participants 
MODIFY COLUMN replacement_requested_at DATETIME 
COMMENT 'When this participant was initiated for replacement by organizer';

ALTER TABLE tournament_participants 
MODIFY COLUMN replaced_by_participant_id CHAR(36) 
COMMENT 'If replaced, points to the new participant that replaced them';

ALTER TABLE tournament_participants 
MODIFY COLUMN requested_replacement_of_id CHAR(36) 
COMMENT 'If this is a substitute, points to the original participant they are replacing';
