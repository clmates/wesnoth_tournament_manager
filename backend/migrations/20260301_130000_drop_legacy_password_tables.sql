-- Drop legacy password management tables.
-- These were carried over from the Supabase era.
-- Password management is now delegated entirely to the Wesnoth forum.

ALTER TABLE password_history DROP FOREIGN KEY IF EXISTS `password_history_ibfk_1`;
DROP TABLE IF EXISTS `password_history`;
DROP TABLE IF EXISTS `password_policy`;
