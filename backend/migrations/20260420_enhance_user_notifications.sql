-- Migration: Enhance user_notifications table
-- Purpose: Add message_extra and is_deleted columns for better schedule comments and soft deletes
-- Date: 2026-04-20

-- Add new columns
ALTER TABLE user_notifications 
  ADD COLUMN message_extra TEXT DEFAULT NULL COMMENT 'Optional comment from schedule proposer',
  ADD COLUMN is_deleted TINYINT(1) DEFAULT 0 COMMENT 'Soft delete flag for retention';

-- Add indexes for improved query performance
ALTER TABLE user_notifications 
  ADD INDEX idx_user_is_read (user_id, is_read),
  ADD INDEX idx_user_created_at (user_id, created_at DESC),
  ADD INDEX idx_user_undeleted (user_id, is_deleted);
