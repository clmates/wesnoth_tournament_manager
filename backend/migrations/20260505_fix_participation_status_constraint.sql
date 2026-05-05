-- Migration: Fix participation_status CHECK constraint to include 'unconfirmed'
-- Date: 2026-05-05
-- Description: Corrects the participation_status CHECK constraint syntax
--   Adds 'unconfirmed' as a valid value for:
--   - Player 2 in request-to-join (2v2 teams) awaiting confirmation
--   - Substitute players awaiting confirmation before replacement takes effect

-- ============================================================================
-- Update the participation_status column with corrected CHECK constraint
-- ============================================================================

-- In MariaDB, modify the column to update the CHECK constraint
-- This recreates the column with the new constraint while preserving data
ALTER TABLE tournament_participants 
MODIFY COLUMN participation_status VARCHAR(30) 
DEFAULT 'pending' 
COMMENT 'Participant status: pending (join request), accepted (active), unconfirmed (awaiting confirmation), pending_replacement (substitute waiting confirmation), replaced (was replaced mid-tournament), rejected'
CHECK (`participation_status` IN ('pending','accepted','pending_replacement','replaced','rejected','unconfirmed'));
