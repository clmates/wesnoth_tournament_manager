-- Add password_must_change column to users table
-- This flag indicates that the user MUST change their password on next login
-- (typically set when admin resets password)

ALTER TABLE users ADD COLUMN IF NOT EXISTS password_must_change BOOLEAN DEFAULT false;

-- Create index for quick lookup
CREATE INDEX IF NOT EXISTS idx_users_password_must_change ON users(password_must_change) WHERE password_must_change = true;

-- Log the migration
SELECT 'Migration: Added password_must_change column to users table' AS migration_info;
