-- Migration: Add user_notifications table for tournament match scheduling notifications
-- Purpose: Store notifications that appear as toasts when users access the app
-- Created: 2026-04-19

CREATE TABLE IF NOT EXISTS user_notifications (
  id CHAR(36) NOT NULL PRIMARY KEY,
  user_id CHAR(36) NOT NULL,
  tournament_id CHAR(36) NOT NULL,
  match_id CHAR(36) NOT NULL,
  type VARCHAR(50) NOT NULL COMMENT 'schedule_proposal, schedule_confirmed, schedule_cancelled',
  title VARCHAR(255) NOT NULL,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  KEY idx_user_id (user_id),
  KEY idx_tournament_id (tournament_id),
  KEY idx_match_id (match_id),
  KEY idx_is_read (is_read),
  KEY idx_created_at (created_at),
  CONSTRAINT fk_user_notifications_user FOREIGN KEY (user_id) REFERENCES users_extension(user_id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci COMMENT='Notifications shown as toasts when users access the app';
