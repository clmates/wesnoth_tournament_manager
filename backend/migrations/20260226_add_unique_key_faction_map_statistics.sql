-- Migration: matches + faction_map_statistics enhancements
-- 1. Add winner_side, game_id, wesnoth_version, instance_uuid to matches
--    (all games must now come from a parsed replay)
-- 2. Fix faction_map_statistics corruption + add faction_side dimension
-- 3. Add UNIQUE constraints that were missing in the live DB

-- ============================================================
-- matches: new columns from replay metadata
-- ============================================================
-- Idempotent: safe to run multiple times (IF NOT EXISTS / DROP IF EXISTS guards)

-- 1. matches: add replay-metadata columns (required since all games must come from a replay)
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS winner_side     TINYINT(1)   NULL COMMENT '1 or 2 — which side the winner played',
  ADD COLUMN IF NOT EXISTS game_id         INT          NULL COMMENT 'wesnothd game_id from forum',
  ADD COLUMN IF NOT EXISTS wesnoth_version VARCHAR(20)  NULL COMMENT 'e.g. 1.18.0',
  ADD COLUMN IF NOT EXISTS instance_uuid   CHAR(36)     NULL COMMENT 'wesnothd instance UUID from forum';

-- Prevent duplicate match creation from the same replay (drop first for idempotency)
ALTER TABLE matches DROP INDEX IF EXISTS unique_replay_game;
ALTER TABLE matches ADD UNIQUE KEY unique_replay_game (instance_uuid, game_id);

-- 2. faction_map_statistics: clear corrupt data + add faction_side dimension
TRUNCATE TABLE faction_map_statistics;

ALTER TABLE faction_map_statistics
  ADD COLUMN IF NOT EXISTS faction_side TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '0=unknown, 1=played as side 1, 2=played as side 2';

-- Drop old UNIQUE KEY (wrong shape, missing faction_side) and add new one
ALTER TABLE faction_map_statistics DROP INDEX IF EXISTS unique_faction_map_opponent;
ALTER TABLE faction_map_statistics DROP INDEX IF EXISTS unique_faction_map_opponent_side;
ALTER TABLE faction_map_statistics
  ADD UNIQUE KEY unique_faction_map_opponent_side (map_id, faction_id, opponent_faction_id, faction_side);
