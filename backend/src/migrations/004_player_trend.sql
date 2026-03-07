-- Add trend column to users table
ALTER TABLE users ADD COLUMN IF NOT EXISTS trend VARCHAR(10) DEFAULT '-';

-- Create index for trend
CREATE INDEX IF NOT EXISTS idx_users_trend ON users(trend);

-- Set initial trend to '-' for all existing users
UPDATE users SET trend = '-' WHERE trend IS NULL;
