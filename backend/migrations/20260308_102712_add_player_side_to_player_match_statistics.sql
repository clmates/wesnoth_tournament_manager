-- Add player_side dimension to player_match_statistics.
-- player_side = 0: aggregate (all sides combined, default/existing rows)
-- player_side = 1: games where this player was Side 1
-- player_side = 2: games where this player was Side 2
-- Old rows default to 0 (aggregate) which is correct until next recalculation.
ALTER TABLE player_match_statistics
  ADD COLUMN IF NOT EXISTS player_side TINYINT(1) NOT NULL DEFAULT 0
  COMMENT '0=all sides aggregate, 1=played as side 1, 2=played as side 2';
