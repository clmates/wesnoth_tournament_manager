-- Migration: add enable_ranked to users_extension
-- Players must explicitly opt in to ranked ladder matches.
-- Default 0 (disabled). Players can toggle this in their profile.

ALTER TABLE users_extension
  ADD COLUMN IF NOT EXISTS enable_ranked TINYINT(1) NOT NULL DEFAULT 0;
