-- Add discord_thread_id column to tournaments table for Discord forum thread integration
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS discord_thread_id VARCHAR(255) NULL;

-- Create index for efficient lookups
CREATE INDEX IF NOT EXISTS idx_discord_thread_id ON tournaments(discord_thread_id);
