-- Migration: Add Team Member Replacement Support
-- Date: 2026-05-06
-- Description: Adds support for team member replacement/substitution workflow
-- Includes: replacement tracking fields, constraints, indices, and CHECK constraint for participation_status

-- ============================================================================
-- 1. Add replacement tracking columns to tournament_participants
-- ============================================================================

ALTER TABLE tournament_participants 
ADD COLUMN IF NOT EXISTS replacement_requested_at DATETIME NULL DEFAULT NULL;

ALTER TABLE tournament_participants 
ADD COLUMN IF NOT EXISTS replaced_by_participant_id CHAR(36) NULL DEFAULT NULL;

ALTER TABLE tournament_participants 
ADD COLUMN IF NOT EXISTS requested_replacement_of_id CHAR(36) NULL DEFAULT NULL;

-- ============================================================================
-- 2. Update participation_status CHECK constraint to include new values
-- ============================================================================

-- Drop existing CHECK constraint if it exists, then recreate with full list
ALTER TABLE tournament_participants
MODIFY COLUMN participation_status VARCHAR(30) DEFAULT 'pending' 
CHECK (participation_status IN ('pending', 'accepted', 'pending_replacement', 'replaced', 'rejected', 'unconfirmed'));

-- ============================================================================
-- 3. Add foreign keys for replacement tracking
-- ============================================================================

-- Add foreign keys only if they don't already exist
-- Use error-suppressing approach for AlterTable
ALTER TABLE tournament_participants 
ADD CONSTRAINT fk_replaced_by_participant 
FOREIGN KEY (replaced_by_participant_id) REFERENCES tournament_participants(id) ON DELETE SET NULL;

ALTER TABLE tournament_participants 
ADD CONSTRAINT fk_requested_replacement_of_participant 
FOREIGN KEY (requested_replacement_of_id) REFERENCES tournament_participants(id) ON DELETE SET NULL;

-- ============================================================================
-- 4. Create indices for replacement queries
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_tournament_participants_replacement_requested_at 
ON tournament_participants(replacement_requested_at);

CREATE INDEX IF NOT EXISTS idx_tournament_participants_replaced_by 
ON tournament_participants(replaced_by_participant_id);

CREATE INDEX IF NOT EXISTS idx_tournament_participants_replacement_of 
ON tournament_participants(requested_replacement_of_id);
