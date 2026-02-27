-- Run this directly in MariaDB to unblock the statistics system.
-- Equivalent to applying migration 20260226 + clearing stale migration record.

-- ① Remove the stale "already applied" record so the runner won't skip it on next restart
DELETE FROM migrations WHERE name = '20260226_add_unique_key_faction_map_statistics.sql';

-- ② matches: new columns (safe — IF NOT EXISTS guards)
ALTER TABLE matches
  ADD COLUMN IF NOT EXISTS winner_side     TINYINT(1)   NULL    COMMENT '1 or 2 — which side the winner played',
  ADD COLUMN IF NOT EXISTS game_id         INT          NULL    COMMENT 'wesnothd game_id from forum',
  ADD COLUMN IF NOT EXISTS wesnoth_version VARCHAR(20)  NULL    COMMENT 'e.g. 1.18.0',
  ADD COLUMN IF NOT EXISTS instance_uuid   CHAR(36)     NULL    COMMENT 'wesnothd instance UUID from forum';

-- ③ matches: unique constraint to prevent duplicate replay imports
ALTER TABLE matches DROP INDEX IF EXISTS unique_replay_game;
ALTER TABLE matches ADD UNIQUE KEY unique_replay_game (instance_uuid, game_id);

-- ④ faction_map_statistics: wipe corrupt data
TRUNCATE TABLE faction_map_statistics;

-- ⑤ faction_map_statistics: add faction_side dimension
ALTER TABLE faction_map_statistics
  ADD COLUMN IF NOT EXISTS faction_side TINYINT(1) NOT NULL DEFAULT 0
    COMMENT '0=unknown, 1=played as side 1, 2=played as side 2';

-- ⑥ faction_map_statistics: drop old/wrong UNIQUE KEY and add correct one
ALTER TABLE faction_map_statistics DROP INDEX IF EXISTS unique_faction_map_opponent;
ALTER TABLE faction_map_statistics DROP INDEX IF EXISTS unique_faction_map_opponent_side;
ALTER TABLE faction_map_statistics
  ADD UNIQUE KEY unique_faction_map_opponent_side (map_id, faction_id, opponent_faction_id, faction_side);

-- Done. Now restart the backend, then call:
-- POST /api/admin/recalculate-statistics
-- to rebuild faction_map_statistics from scratch with clean, side-aware data.
