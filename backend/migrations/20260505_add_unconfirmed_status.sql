-- Add 'unconfirmed' status to participation_status CHECK constraint
-- This status is used for:
-- 1. Team members awaiting confirmation (team_position join requests)
-- 2. Substitutes awaiting confirmation (team member replacements)

ALTER TABLE tournament_participants 
MODIFY COLUMN `participation_status` varchar(30) DEFAULT 'pending' COMMENT 'Participant status: pending (join request), accepted (active), pending_replacement (substitute waiting confirmation), replaced (was replaced mid-tournament), unconfirmed (awaiting confirmation), rejected' CHECK (`participation_status` IN ('pending','accepted','pending_replacement','replaced','rejected','unconfirmed'));
