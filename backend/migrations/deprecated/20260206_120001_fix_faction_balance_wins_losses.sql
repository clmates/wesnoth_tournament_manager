-- Migration: Fix faction balance - ensure sum(wins) = sum(losses)
-- Problem: Mirror matches were counting only wins, not losses
--          This caused total_wins ≠ total_losses (should always be equal)
-- Solution: Add a separate INSERT for mirror match losses so they're counted twice
--          (once as win, once as loss - because same faction plays both sides)

-- Step 1: Clear all existing statistics
TRUNCATE TABLE faction_map_statistics;

-- Step 2: Rebuild statistics from scratch, handling mirror matches correctly

-- Insert statistics for winner perspective (all matchups)
WITH winner_stats AS (
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
FROM winner_stats
ON CONFLICT (map_id, faction_id, opponent_faction_id)
DO UPDATE SET
  total_games = faction_map_statistics.total_games + EXCLUDED.total_games,
  wins = faction_map_statistics.wins + EXCLUDED.wins,
  losses = faction_map_statistics.losses + EXCLUDED.losses,
  winrate = ROUND(100.0 * (faction_map_statistics.wins + EXCLUDED.wins) / (faction_map_statistics.total_games + EXCLUDED.total_games), 2)::NUMERIC(5,2);

-- Insert statistics for loser perspective (non-mirror matches only)
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
  total_games = faction_map_statistics.total_games + EXCLUDED.total_games,
  wins = faction_map_statistics.wins + EXCLUDED.wins,
  losses = faction_map_statistics.losses + EXCLUDED.losses,
  winrate = ROUND(100.0 * (faction_map_statistics.wins + EXCLUDED.wins) / (faction_map_statistics.total_games + EXCLUDED.total_games), 2)::NUMERIC(5,2);

-- For mirror matches, also count the losses (same faction losing to itself)
WITH mirror_losses AS (
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
    AND f_winner.id = f_loser.id
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
FROM mirror_losses
ON CONFLICT (map_id, faction_id, opponent_faction_id)
DO UPDATE SET
  total_games = faction_map_statistics.total_games + EXCLUDED.total_games,
  wins = faction_map_statistics.wins + EXCLUDED.wins,
  losses = faction_map_statistics.losses + EXCLUDED.losses,
  winrate = ROUND(100.0 * (faction_map_statistics.wins + EXCLUDED.wins) / (faction_map_statistics.total_games + EXCLUDED.total_games), 2)::NUMERIC(5,2);

-- Verify the fix: sum(wins) should equal sum(losses)
SELECT 
  COUNT(*) as total_records,
  SUM(total_games) as sum_total_games,
  SUM(wins) as total_wins,
  SUM(losses) as total_losses,
  SUM(wins) - SUM(losses) as difference,
  COUNT(DISTINCT map_id) as unique_maps,
  COUNT(DISTINCT faction_id) as unique_factions
FROM faction_map_statistics;
