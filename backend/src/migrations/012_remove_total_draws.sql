-- Remove total_draws column - draws are not possible in this game
ALTER TABLE users 
DROP COLUMN IF EXISTS total_draws;

-- Drop the index if it exists
DROP INDEX IF EXISTS idx_users_total_draws;
