-- Migration: Fix duplicate faction_map_statistics caused by UPDATE trigger processing state changes
-- Problem: Trigger was firing on INSERT AND UPDATE for ALL state changes
--          When match status changed (unconfirmed→confirmed), stats were registered again
--          Duplicate statistics entries created for the same match
-- Solution: 
--   1. Clear all existing duplicate statistics
--   2. Recalculate from scratch
--   3. Trigger now selective: only registers on INSERT, removes on UPDATE to 'cancelled'

-- Step 1: Clear all existing statistics
TRUNCATE TABLE faction_map_statistics;

-- Step 2: Rebuild statistics from scratch, handling mirror matches
-- Mirror matches (same faction on both sides) are stored as single record
-- Using ON CONFLICT to handle existing records and make migration idempotent

-- Insert statistics for all matchups (separating mirror from normal)
WITH all_matchups AS (
  SELECT
    gm.id as map_id,
    f_winner.id as faction_id,
    f_loser.id as opponent_faction_id,
    COUNT(*)::INT as total_games,
    COUNT(*)::INT as wins,
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
FROM all_matchups
ON CONFLICT (map_id, faction_id, opponent_faction_id)
DO UPDATE SET
  total_games = EXCLUDED.total_games,
  wins = EXCLUDED.wins,
  losses = EXCLUDED.losses,
  winrate = EXCLUDED.winrate;

-- Insert statistics for loser perspective (non-mirror matches only)
-- Mirror matches are already handled above
WITH loser_stats AS (
  SELECT
    gm.id as map_id,
    f_loser.id as faction_id,
    f_winner.id as opponent_faction_id,
    COUNT(*)::INT as total_games,
    0::INT as wins,
    COUNT(*)::INT as losses
  FROM matches m
  JOIN game_maps gm ON gm.name = m.map
  JOIN factions f_winner ON f_winner.name = m.winner_faction
  JOIN factions f_loser ON f_loser.name = m.loser_faction
  WHERE m.tournament_mode != 'unranked' 
    AND m.status != 'cancelled'
    AND f_winner.id != f_loser.id
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
  ROUND(100.0 * wins / total_games, 2)::NUMERIC(5,2)
FROM loser_stats
ON CONFLICT (map_id, faction_id, opponent_faction_id)
DO UPDATE SET
  total_games = EXCLUDED.total_games,
  wins = EXCLUDED.wins,
  losses = EXCLUDED.losses,
  winrate = EXCLUDED.winrate;

-- Verify the fix
SELECT 
  COUNT(*) as total_records,
  SUM(total_games) as sum_total_games,
  COUNT(DISTINCT map_id) as unique_maps,
  COUNT(DISTINCT faction_id) as unique_factions
FROM faction_map_statistics;
