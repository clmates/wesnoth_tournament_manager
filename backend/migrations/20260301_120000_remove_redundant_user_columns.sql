-- Migration: remove_redundant_user_columns
-- Removes columns from users_extension that are no longer needed.
-- Authentication (password, email) is managed exclusively by the Wesnoth forum
-- (phpbb3_users table). Password reset and email verification are handled
-- by the Wesnoth forum. This application does not manage them.
-- Brute-force protection fields (failed_login_attempts, locked_until,
-- last_login_attempt) are intentionally kept.

ALTER TABLE `users_extension`
  DROP COLUMN IF EXISTS `email`,
  DROP COLUMN IF EXISTS `password_hash`,
  DROP COLUMN IF EXISTS `password_must_change`,
  DROP COLUMN IF EXISTS `email_verified`,
  DROP COLUMN IF EXISTS `password_reset_token`,
  DROP COLUMN IF EXISTS `password_reset_expires`,
  DROP COLUMN IF EXISTS `email_verification_token`,
  DROP COLUMN IF EXISTS `email_verification_expires`;
