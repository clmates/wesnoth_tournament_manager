-- Remove unused columns from tournaments table
ALTER TABLE tournaments DROP COLUMN system;
ALTER TABLE tournaments DROP COLUMN matches_per_round;
