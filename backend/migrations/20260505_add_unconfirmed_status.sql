-- Migration: Add 'unconfirmed' to participation_status valid values
-- Date: 2026-05-05
-- Description: Adds 'unconfirmed' as a valid participation_status for:
--   - Player 2 in request-to-join (2v2 teams) awaiting confirmation
--   - Substitute players awaiting confirmation before replacement takes effect

-- ============================================================================
-- Drop and recreate the CHECK constraint to include 'unconfirmed'
-- ============================================================================

-- First, drop the old constraint
ALTER TABLE tournament_participants 
DROP CONSTRAINT tournament_participants_chk_1;

-- Add the new constraint with 'unconfirmed' included
ALTER TABLE tournament_participants 
ADD CONSTRAINT participation_status_check 
CHECK (`participation_status` IN ('pending','accepted','pending_replacement','replaced','rejected','unconfirmed'));
