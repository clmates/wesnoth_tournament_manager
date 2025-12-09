-- Add participation_status column to tournament_participants table
ALTER TABLE tournament_participants
ADD COLUMN IF NOT EXISTS participation_status VARCHAR(20) DEFAULT 'pending';
