-- Add player statistics columns for performance optimization
-- These columns cache statistics that can be calculated from matches table
-- but are stored here for faster queries

ALTER TABLE users 
ADD COLUMN IF NOT EXISTS total_wins INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_losses INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS total_draws INTEGER DEFAULT 0;

-- Create indexes for statistics queries
CREATE INDEX IF NOT EXISTS idx_users_total_wins ON users(total_wins DESC);
CREATE INDEX IF NOT EXISTS idx_users_total_losses ON users(total_losses);
CREATE INDEX IF NOT EXISTS idx_users_total_draws ON users(total_draws);
