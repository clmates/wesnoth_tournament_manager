-- Add match scheduling columns to tournament_round_matches
-- All timestamps stored in UTC
-- scheduled_status: pending, player1_proposed, player2_proposed, confirmed

ALTER TABLE tournament_round_matches 
ADD COLUMN scheduled_datetime DATETIME NULL COMMENT 'Proposed/confirmed schedule time (UTC)',
ADD COLUMN scheduled_status VARCHAR(20) DEFAULT 'pending' COMMENT 'pending, player1_proposed, player2_proposed, confirmed',
ADD COLUMN scheduled_by_player_id CHAR(36) NULL COMMENT 'Which player proposed the schedule',
ADD COLUMN scheduled_confirmed_at DATETIME NULL COMMENT 'When both players confirmed (UTC)',
ADD INDEX idx_scheduled_status (scheduled_status),
ADD INDEX idx_scheduled_datetime (scheduled_datetime);
