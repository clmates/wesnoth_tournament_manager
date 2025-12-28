-- Fix player_match_statistics recalculation to include all record types
-- This migration corrects the recalculate_player_match_statistics function to properly populate
-- global, head-to-head, and detailed (map/faction specific) statistics

CREATE OR REPLACE FUNCTION recalculate_player_match_statistics()
RETURNS void AS $$
BEGIN
  -- Clear existing statistics
  TRUNCATE TABLE player_match_statistics;
  
  -- ===== GLOBAL STATS (per player, aggregated from all matches) =====
  WITH all_player_games AS (
    SELECT m.winner_id as player_id, COUNT(*) as wins, 0 as losses, AVG(m.winner_elo_after - m.winner_elo_before) as avg_elo_change
    FROM matches m WHERE NOT (m.admin_reviewed = true AND m.status = 'cancelled') GROUP BY m.winner_id
    UNION ALL
    SELECT m.loser_id as player_id, 0 as wins, COUNT(*) as losses, AVG(m.loser_elo_after - m.loser_elo_before) as avg_elo_change
    FROM matches m WHERE NOT (m.admin_reviewed = true AND m.status = 'cancelled') GROUP BY m.loser_id
  )
  INSERT INTO player_match_statistics (player_id, opponent_id, map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate, avg_elo_change)
  SELECT
    player_id,
    NULL,
    NULL,
    NULL,
    NULL,
    SUM(wins + losses)::INT as total_games,
    SUM(wins)::INT as wins,
    SUM(losses)::INT as losses,
    CASE WHEN SUM(wins + losses) > 0 THEN ROUND(100.0 * SUM(wins) / SUM(wins + losses), 2)::NUMERIC(5,2) ELSE 0 END,
    AVG(avg_elo_change)::NUMERIC(8,2)
  FROM all_player_games
  GROUP BY player_id;

  -- ===== HEAD-TO-HEAD WINNER PERSPECTIVE =====
  WITH h2h_winner AS (
    SELECT
      m.winner_id as player_id,
      m.loser_id as opponent_id,
      gm.id as map_id,
      f_winner.id as faction_id,
      f_loser.id as opponent_faction_id,
      COUNT(*)::INT as wins,
      0::INT as losses,
      MAX(m.loser_elo_after)::DECIMAL(8,2) as last_elo_against_me,
      SUM(m.winner_elo_after - m.winner_elo_before)::NUMERIC(8,2) / COUNT(*) as avg_elo_change,
      SUM(CASE WHEN m.winner_elo_after - m.winner_elo_before > 0 THEN m.winner_elo_after - m.winner_elo_before ELSE 0 END)::NUMERIC(8,2) as elo_gained,
      0::NUMERIC(8,2) as elo_lost,
      MAX(m.created_at)::TIMESTAMP as last_match_date
    FROM matches m
    JOIN game_maps gm ON gm.name = m.map
    JOIN factions f_winner ON f_winner.name = m.winner_faction
    JOIN factions f_loser ON f_loser.name = m.loser_faction
    WHERE NOT (m.admin_reviewed = true AND m.status = 'cancelled')
    GROUP BY m.winner_id, m.loser_id, gm.id, f_winner.id, f_loser.id
  )
  INSERT INTO player_match_statistics (player_id, opponent_id, map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate, avg_elo_change, last_elo_against_me, elo_gained, elo_lost, last_match_date)
  SELECT
    player_id,
    opponent_id,
    map_id,
    faction_id,
    opponent_faction_id,
    wins,
    wins,
    losses,
    100.00::NUMERIC(5,2),
    avg_elo_change,
    last_elo_against_me,
    elo_gained,
    elo_lost,
    last_match_date
  FROM h2h_winner;

  -- ===== HEAD-TO-HEAD LOSER PERSPECTIVE =====
  WITH h2h_loser AS (
    SELECT
      m.loser_id as player_id,
      m.winner_id as opponent_id,
      gm.id as map_id,
      f_loser.id as faction_id,
      f_winner.id as opponent_faction_id,
      0::INT as wins,
      COUNT(*)::INT as losses,
      MAX(m.winner_elo_after)::DECIMAL(8,2) as last_elo_against_me,
      SUM(m.loser_elo_after - m.loser_elo_before)::NUMERIC(8,2) / COUNT(*) as avg_elo_change,
      0::NUMERIC(8,2) as elo_gained,
      SUM(CASE WHEN m.loser_elo_after - m.loser_elo_before < 0 THEN ABS(m.loser_elo_after - m.loser_elo_before) ELSE 0 END)::NUMERIC(8,2) as elo_lost,
      MAX(m.created_at)::TIMESTAMP as last_match_date
    FROM matches m
    JOIN game_maps gm ON gm.name = m.map
    JOIN factions f_loser ON f_loser.name = m.loser_faction
    JOIN factions f_winner ON f_winner.name = m.winner_faction
    WHERE NOT (m.admin_reviewed = true AND m.status = 'cancelled')
    GROUP BY m.loser_id, m.winner_id, gm.id, f_loser.id, f_winner.id
  )
  INSERT INTO player_match_statistics (player_id, opponent_id, map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate, avg_elo_change, last_elo_against_me, elo_gained, elo_lost, last_match_date)
  SELECT
    player_id,
    opponent_id,
    map_id,
    faction_id,
    opponent_faction_id,
    losses,
    wins,
    losses,
    0.00::NUMERIC(5,2),
    avg_elo_change,
    last_elo_against_me,
    elo_gained,
    elo_lost,
    last_match_date
  FROM h2h_loser;

  -- ===== PER-MAP STATS (aggregated across all opponents and factions) =====
  WITH map_stats AS (
    SELECT
      m.winner_id as player_id,
      gm.id as map_id,
      NULL::UUID as opponent_id,
      NULL::UUID as faction_id,
      NULL::UUID as opponent_faction_id,
      COUNT(*)::INT as wins,
      0::INT as losses,
      SUM(m.winner_elo_after - m.winner_elo_before)::NUMERIC(8,2) / COUNT(*) as avg_elo_change
    FROM matches m
    JOIN game_maps gm ON gm.name = m.map
    WHERE NOT (m.admin_reviewed = true AND m.status = 'cancelled')
    GROUP BY m.winner_id, gm.id
    UNION ALL
    SELECT
      m.loser_id as player_id,
      gm.id as map_id,
      NULL::UUID as opponent_id,
      NULL::UUID as faction_id,
      NULL::UUID as opponent_faction_id,
      0::INT as wins,
      COUNT(*)::INT as losses,
      SUM(m.loser_elo_after - m.loser_elo_before)::NUMERIC(8,2) / COUNT(*) as avg_elo_change
    FROM matches m
    JOIN game_maps gm ON gm.name = m.map
    WHERE NOT (m.admin_reviewed = true AND m.status = 'cancelled')
    GROUP BY m.loser_id, gm.id
  )
  INSERT INTO player_match_statistics (player_id, opponent_id, map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate, avg_elo_change)
  SELECT
    player_id,
    opponent_id,
    map_id,
    faction_id,
    opponent_faction_id,
    SUM(wins + losses)::INT as total_games,
    SUM(wins)::INT as wins,
    SUM(losses)::INT as losses,
    CASE WHEN SUM(wins + losses) > 0 THEN ROUND(100.0 * SUM(wins) / SUM(wins + losses), 2)::NUMERIC(5,2) ELSE 0 END,
    AVG(avg_elo_change)::NUMERIC(8,2)
  FROM map_stats
  GROUP BY player_id, map_id;

  -- ===== PER-FACTION STATS (aggregated across all opponents and maps) =====
  WITH faction_stats AS (
    SELECT
      m.winner_id as player_id,
      f.id as faction_id,
      NULL::UUID as opponent_id,
      NULL::UUID as map_id,
      NULL::UUID as opponent_faction_id,
      COUNT(*)::INT as wins,
      0::INT as losses,
      SUM(m.winner_elo_after - m.winner_elo_before)::NUMERIC(8,2) / COUNT(*) as avg_elo_change
    FROM matches m
    JOIN factions f ON f.name = m.winner_faction
    WHERE NOT (m.admin_reviewed = true AND m.status = 'cancelled')
    GROUP BY m.winner_id, f.id
    UNION ALL
    SELECT
      m.loser_id as player_id,
      f.id as faction_id,
      NULL::UUID as opponent_id,
      NULL::UUID as map_id,
      NULL::UUID as opponent_faction_id,
      0::INT as wins,
      COUNT(*)::INT as losses,
      SUM(m.loser_elo_after - m.loser_elo_before)::NUMERIC(8,2) / COUNT(*) as avg_elo_change
    FROM matches m
    JOIN factions f ON f.name = m.loser_faction
    WHERE NOT (m.admin_reviewed = true AND m.status = 'cancelled')
    GROUP BY m.loser_id, f.id
  )
  INSERT INTO player_match_statistics (player_id, opponent_id, map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate, avg_elo_change)
  SELECT
    player_id,
    opponent_id,
    map_id,
    faction_id,
    opponent_faction_id,
    SUM(wins + losses)::INT as total_games,
    SUM(wins)::INT as wins,
    SUM(losses)::INT as losses,
    CASE WHEN SUM(wins + losses) > 0 THEN ROUND(100.0 * SUM(wins) / SUM(wins + losses), 2)::NUMERIC(5,2) ELSE 0 END,
    AVG(avg_elo_change)::NUMERIC(8,2)
  FROM faction_stats
  GROUP BY player_id, faction_id;

  RAISE NOTICE 'Player match statistics recalculated successfully with all record types';
END;
$$ LANGUAGE plpgsql;

-- Execute the recalculation
SELECT recalculate_player_match_statistics();
