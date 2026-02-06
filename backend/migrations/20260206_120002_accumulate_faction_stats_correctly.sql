-- Migration: Properly accumulate faction statistics with correct aggregation
-- Problem: Previous approach used COUNT(*) which counts row occurrences
--          What we need is SUM of wins/losses aggregated by faction/opponent/map
-- Solution: Create a summary table first, then insert with proper accumulation

-- Step 1: Clear all existing statistics
TRUNCATE TABLE faction_map_statistics;

-- Step 2: Rebuild with proper GROUP BY and SUM aggregation
-- First, aggregate all wins by faction (winner perspective)
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

-- Second, aggregate all losses by faction (loser perspective - includes mirrors)
WITH loser_aggregated AS (
  SELECT
    gm.id as map_id,
    f_loser.id as faction_id,
    f_winner.id as opponent_faction_id,
    SUM(1)::INT as total_games,
    0::INT as wins,
    SUM(1)::INT as losses
  FROM matches m
  JOIN game_maps gm ON gm.name = m.map
  JOIN factions f_winner ON f_winner.name = m.winner_faction
  JOIN factions f_loser ON f_loser.name = m.loser_faction
  WHERE m.tournament_mode != 'unranked' 
    AND m.status != 'cancelled'
  GROUP BY gm.id, f_loser.id, f_winner.id
)
INSERT INTO faction_map_statistics (map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate)
SELECT 
  map_id,
  faction_id,
  opponent_faction_id,
  total_games,
  wins,
  losses,
  ROUND(100.0 * wins / NULLIF(total_games, 0), 2)::NUMERIC(5,2)
FROM loser_aggregated
ON CONFLICT (map_id, faction_id, opponent_faction_id)
DO UPDATE SET
  total_games = faction_map_statistics.total_games + EXCLUDED.total_games,
  wins = faction_map_statistics.wins + EXCLUDED.wins,
  losses = faction_map_statistics.losses + EXCLUDED.losses,
  winrate = ROUND(100.0 * (faction_map_statistics.wins + EXCLUDED.wins) / (faction_map_statistics.total_games + EXCLUDED.total_games), 2)::NUMERIC(5,2);

-- Verify: sum(wins) should equal sum(losses) and check faction totals
SELECT 
  COUNT(*) as total_records,
  SUM(total_games) as sum_total_games,
  SUM(wins) as total_wins,
  SUM(losses) as total_losses,
  SUM(wins) - SUM(losses) as difference
FROM faction_map_statistics;
