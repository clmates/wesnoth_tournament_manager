-- Add dispute tracking and admin review columns to matches table
ALTER TABLE matches 
ADD COLUMN IF NOT EXISTS status VARCHAR(50) DEFAULT 'unconfirmed',
ADD COLUMN IF NOT EXISTS admin_reviewed BOOLEAN DEFAULT false,
ADD COLUMN IF NOT EXISTS admin_reviewed_at TIMESTAMP,
ADD COLUMN IF NOT EXISTS admin_reviewed_by UUID REFERENCES users(id);

-- Create indexes for dispute management
CREATE INDEX IF NOT EXISTS idx_matches_status ON matches(status);
CREATE INDEX IF NOT EXISTS idx_matches_admin_reviewed ON matches(admin_reviewed);
CREATE INDEX IF NOT EXISTS idx_matches_created_at_desc ON matches(created_at DESC);

-- Update existing matches to have status 'confirmed' if loser_confirmed is true
UPDATE matches SET status = 'confirmed' WHERE loser_confirmed = true AND status IS NULL;
UPDATE matches SET status = 'unconfirmed' WHERE loser_confirmed = false AND status IS NULL;

-- Log of this migration
-- This migration adds support for dispute tracking and admin review of disputed matches
-- Statuses: 'pending' (waiting for loser confirmation), 'confirmed' (match validated), 'disputed' (loser disputed), 'voided' (admin voided)
