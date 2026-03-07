-- Fix matches table status DEFAULT from 'pending' to 'unconfirmed'
-- This ensures all new matches are created with 'unconfirmed' status
ALTER TABLE matches 
ALTER COLUMN status SET DEFAULT 'unconfirmed';

-- Update any existing 'pending' status matches that should be 'unconfirmed'
-- (pending is only used as an intermediate state when a match is disputed)
UPDATE matches 
SET status = 'unconfirmed' 
WHERE status = 'pending' AND admin_reviewed = false;
