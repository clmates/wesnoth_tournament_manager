-- Migration: Fix double-counting of total_games for mirror matches
-- Problem: Mirror matches (same faction vs same faction) were counting total_games twice
--          Winner perspective counted it once, loser perspective added it again on conflict
-- Solution: For mirrors, update only wins/losses, not total_games on the loser insert

-- Step 1: Clear all existing statistics
TRUNCATE TABLE faction_map_statistics;

-- Step 2: Insert winner perspective (all matches)
WITH winner_aggregated AS (
  SELECT
    gm.id as map_id,
    f_winner.id as faction_id,
    f_loser.id as opponent_faction_id,
    SUM(1)::INT as total_games,
    SUM(1)::INT as wins,
    0::INT as losses
  FROM matches m
  JOIN game_maps gm ON gm.name = m.map
  JOIN factions f_winner ON f_winner.name = m.winner_faction
  JOIN factions f_loser ON f_loser.name = m.loser_faction
  WHERE m.tournament_mode != 'unranked' 
    AND m.status != 'cancelled'
  GROUP BY gm.id, f_winner.id, f_loser.id
)
INSERT INTO faction_map_statistics (map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate)
SELECT 
  map_id,
  faction_id,
  opponent_faction_id,
  total_games,
  wins,
  losses,
  ROUND(100.0 * wins / total_games, 2)::NUMERIC(5,2)
FROM winner_aggregated;

-- Step 3: Insert loser perspective (all matches)
-- For non-mirrors: add total_games, wins, losses
-- For mirrors: only add losses (total_games already counted, wins=0)
WITH loser_aggregated AS (
  SELECT
    gm.id as map_id,
    f_loser.id as faction_id,
    f_winner.id as opponent_faction_id,
    SUM(1)::INT as total_games,
    0::INT as wins,
    SUM(1)::INT as losses,
    CASE WHEN f_winner.id = f_loser.id THEN true ELSE false END as is_mirror
  FROM matches m
  JOIN game_maps gm ON gm.name = m.map
  JOIN factions f_winner ON f_winner.name = m.winner_faction
  JOIN factions f_loser ON f_loser.name = m.loser_faction
  WHERE m.tournament_mode != 'unranked' 
    AND m.status != 'cancelled'
  GROUP BY gm.id, f_loser.id, f_winner.id, is_mirror
)
INSERT INTO faction_map_statistics (map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate)
SELECT 
  map_id,
  faction_id,
  opponent_faction_id,
  CASE WHEN is_mirror THEN 0 ELSE total_games END,
  wins,
  losses,
  ROUND(100.0 * NULLIF(wins, 0) / NULLIF(total_games, 0), 2)::NUMERIC(5,2)
FROM loser_aggregated
ON CONFLICT (map_id, faction_id, opponent_faction_id)
DO UPDATE SET
  total_games = faction_map_statistics.total_games + EXCLUDED.total_games,
  wins = faction_map_statistics.wins + EXCLUDED.wins,
  losses = faction_map_statistics.losses + EXCLUDED.losses,
  winrate = ROUND(100.0 * (faction_map_statistics.wins + EXCLUDED.wins) / (faction_map_statistics.total_games + EXCLUDED.total_games), 2)::NUMERIC(5,2);

-- Verify
SELECT 
  COUNT(*) as total_records,
  SUM(total_games) as sum_total_games,
  SUM(wins) as total_wins,
  SUM(losses) as total_losses,
  SUM(wins) - SUM(losses) as difference
FROM faction_map_statistics;
