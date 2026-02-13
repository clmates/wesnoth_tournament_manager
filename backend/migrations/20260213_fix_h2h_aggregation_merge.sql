-- Fix: Merge H2H winner and loser stats correctly BEFORE inserting
-- The issue: ON CONFLICT was overwriting winner stats with loser stats instead of merging
-- Solution: Use UNION to combine winner and loser data, then aggregate and INSERT

CREATE OR REPLACE FUNCTION recalculate_player_match_statistics()
RETURNS void AS $$
BEGIN
  -- Drop and recreate table to ensure clean state
  DROP TABLE IF EXISTS player_match_statistics CASCADE;
  
  CREATE TABLE player_match_statistics (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    player_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    opponent_id UUID REFERENCES users(id) ON DELETE CASCADE,
    map_id UUID REFERENCES game_maps(id) ON DELETE CASCADE,
    faction_id UUID REFERENCES factions(id) ON DELETE CASCADE,
    opponent_faction_id UUID REFERENCES factions(id) ON DELETE CASCADE,
    
    -- Metrics
    total_games INT DEFAULT 0,
    wins INT DEFAULT 0,
    losses INT DEFAULT 0,
    winrate DECIMAL(5, 2),
    avg_elo_change DECIMAL(8, 2),
    last_elo_against_me DECIMAL(8, 2),
    elo_gained DECIMAL(8, 2) DEFAULT 0,
    elo_lost DECIMAL(8, 2) DEFAULT 0,
    last_match_date TIMESTAMP,
    
    -- Metadata
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_updated TIMESTAMP DEFAULT CURRENT_TIMESTAMP
  );

  -- Create unique index
  CREATE UNIQUE INDEX idx_player_stats_unique 
    ON player_match_statistics(
      player_id,
      COALESCE(opponent_id, '00000000-0000-0000-0000-000000000000'::UUID),
      COALESCE(map_id, '00000000-0000-0000-0000-000000000000'::UUID),
      COALESCE(faction_id, '00000000-0000-0000-0000-000000000000'::UUID),
      COALESCE(opponent_faction_id, '00000000-0000-0000-0000-000000000000'::UUID)
    );

  -- ===== GLOBAL STATS =====
  WITH all_player_games AS (
    SELECT m.winner_id as player_id, 1 as wins, 0 as losses
    FROM matches m WHERE NOT (m.admin_reviewed = true AND m.status = 'cancelled')
    
    UNION ALL
    
    SELECT m.loser_id as player_id, 0 as wins, 1 as losses
    FROM matches m WHERE NOT (m.admin_reviewed = true AND m.status = 'cancelled')
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
    0::NUMERIC(8,2)
  FROM all_player_games
  GROUP BY player_id;

  -- ===== HEAD-TO-HEAD AGGREGATED (no map/faction) =====
  -- CRITICAL FIX: Combine WINNER and LOSER data BEFORE INSERT, not with ON CONFLICT
  -- This prevents loser data from overwriting winner data
  WITH h2h_combined AS (
    -- Winners perspective
    SELECT
      m.winner_id as player_id,
      m.loser_id as opponent_id,
      COUNT(*)::INT as wins,
      0::INT as losses,
      MAX(m.loser_elo_after)::DECIMAL(8,2) as last_elo_against_me,
      SUM(m.winner_elo_after - m.winner_elo_before)::NUMERIC(8,2) / COUNT(*) as avg_elo_change,
      SUM(CASE WHEN m.winner_elo_after - m.winner_elo_before > 0 THEN m.winner_elo_after - m.winner_elo_before ELSE 0 END)::NUMERIC(8,2) as elo_gained,
      0::NUMERIC(8,2) as elo_lost,
      MAX(m.created_at)::TIMESTAMP as last_match_date
    FROM matches m
    WHERE NOT (m.admin_reviewed = true AND m.status = 'cancelled')
    GROUP BY m.winner_id, m.loser_id
    
    UNION ALL
    
    -- Losers perspective (will be combined with winners)
    SELECT
      m.loser_id as player_id,
      m.winner_id as opponent_id,
      0::INT as wins,
      COUNT(*)::INT as losses,
      MAX(m.winner_elo_after)::DECIMAL(8,2) as last_elo_against_me,
      SUM(m.loser_elo_after - m.loser_elo_before)::NUMERIC(8,2) / COUNT(*) as avg_elo_change,
      0::NUMERIC(8,2) as elo_gained,
      SUM(CASE WHEN m.loser_elo_after - m.loser_elo_before < 0 THEN ABS(m.loser_elo_after - m.loser_elo_before) ELSE 0 END)::NUMERIC(8,2) as elo_lost,
      MAX(m.created_at)::TIMESTAMP as last_match_date
    FROM matches m
    WHERE NOT (m.admin_reviewed = true AND m.status = 'cancelled')
    GROUP BY m.loser_id, m.winner_id
  ),
  h2h_merged AS (
    SELECT
      player_id,
      opponent_id,
      SUM(wins)::INT as wins,
      SUM(losses)::INT as losses,
      (SUM(wins) + SUM(losses))::INT as total_games,
      MAX(last_elo_against_me)::DECIMAL(8,2) as last_elo_against_me,
      AVG(avg_elo_change)::NUMERIC(8,2) as avg_elo_change,
      SUM(elo_gained)::NUMERIC(8,2) as elo_gained,
      SUM(elo_lost)::NUMERIC(8,2) as elo_lost,
      MAX(last_match_date)::TIMESTAMP as last_match_date
    FROM h2h_combined
    GROUP BY player_id, opponent_id
  )
  INSERT INTO player_match_statistics (player_id, opponent_id, map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate, avg_elo_change, last_elo_against_me, elo_gained, elo_lost, last_match_date)
  SELECT
    player_id,
    opponent_id,
    NULL,
    NULL,
    NULL,
    total_games,
    wins,
    losses,
    CASE WHEN total_games > 0 THEN ROUND(100.0 * wins / total_games, 2)::NUMERIC(5,2) ELSE 0 END,
    avg_elo_change,
    last_elo_against_me,
    elo_gained,
    elo_lost,
    last_match_date
  FROM h2h_merged;

  -- ===== PER-MAP STATS =====
  WITH map_stats_combined AS (
    -- Winners on map
    SELECT
      m.winner_id as player_id,
      gm.id as map_id,
      NULL::UUID as opponent_id,
      NULL::UUID as faction_id,
      NULL::UUID as opponent_faction_id,
      COUNT(*)::INT as wins,
      0::INT as losses,
      AVG(m.winner_elo_after - m.winner_elo_before)::NUMERIC(8,2) as avg_elo_change,
      0::NUMERIC(8,2) as elo_gained,
      0::NUMERIC(8,2) as elo_lost
    FROM matches m
    JOIN game_maps gm ON gm.name = m.map
    WHERE NOT (m.admin_reviewed = true AND m.status = 'cancelled')
    GROUP BY m.winner_id, gm.id
    
    UNION ALL
    
    -- Losers on map
    SELECT
      m.loser_id as player_id,
      gm.id as map_id,
      NULL::UUID as opponent_id,
      NULL::UUID as faction_id,
      NULL::UUID as opponent_faction_id,
      0::INT as wins,
      COUNT(*)::INT as losses,
      AVG(m.loser_elo_after - m.loser_elo_before)::NUMERIC(8,2) as avg_elo_change,
      0::NUMERIC(8,2) as elo_gained,
      0::NUMERIC(8,2) as elo_lost
    FROM matches m
    JOIN game_maps gm ON gm.name = m.map
    WHERE NOT (m.admin_reviewed = true AND m.status = 'cancelled')
    GROUP BY m.loser_id, gm.id
  ),
  map_stats_merged AS (
    SELECT
      player_id,
      map_id,
      opponent_id,
      faction_id,
      opponent_faction_id,
      SUM(wins)::INT as wins,
      SUM(losses)::INT as losses,
      (SUM(wins) + SUM(losses))::INT as total_games,
      AVG(avg_elo_change)::NUMERIC(8,2) as avg_elo_change,
      SUM(elo_gained)::NUMERIC(8,2) as elo_gained,
      SUM(elo_lost)::NUMERIC(8,2) as elo_lost
    FROM map_stats_combined
    GROUP BY player_id, map_id, opponent_id, faction_id, opponent_faction_id
  )
  INSERT INTO player_match_statistics (player_id, opponent_id, map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate, avg_elo_change, elo_gained, elo_lost)
  SELECT
    player_id,
    opponent_id,
    map_id,
    faction_id,
    opponent_faction_id,
    total_games,
    wins,
    losses,
    CASE WHEN total_games > 0 THEN ROUND(100.0 * wins / total_games, 2)::NUMERIC(5,2) ELSE 0 END,
    avg_elo_change,
    elo_gained,
    elo_lost
  FROM map_stats_merged;

  -- ===== PER-FACTION STATS =====
  WITH faction_stats_combined AS (
    -- Winners with faction
    SELECT
      m.winner_id as player_id,
      f_winner.id as faction_id,
      NULL::UUID as opponent_id,
      NULL::UUID as map_id,
      NULL::UUID as opponent_faction_id,
      COUNT(*)::INT as wins,
      0::INT as losses,
      AVG(m.winner_elo_after - m.winner_elo_before)::NUMERIC(8,2) as avg_elo_change,
      0::NUMERIC(8,2) as elo_gained,
      0::NUMERIC(8,2) as elo_lost
    FROM matches m
    JOIN factions f_winner ON f_winner.name = m.winner_faction
    WHERE NOT (m.admin_reviewed = true AND m.status = 'cancelled')
    GROUP BY m.winner_id, f_winner.id
    
    UNION ALL
    
    -- Losers with faction
    SELECT
      m.loser_id as player_id,
      f_loser.id as faction_id,
      NULL::UUID as opponent_id,
      NULL::UUID as map_id,
      NULL::UUID as opponent_faction_id,
      0::INT as wins,
      COUNT(*)::INT as losses,
      AVG(m.loser_elo_after - m.loser_elo_before)::NUMERIC(8,2) as avg_elo_change,
      0::NUMERIC(8,2) as elo_gained,
      0::NUMERIC(8,2) as elo_lost
    FROM matches m
    JOIN factions f_loser ON f_loser.name = m.loser_faction
    WHERE NOT (m.admin_reviewed = true AND m.status = 'cancelled')
    GROUP BY m.loser_id, f_loser.id
  ),
  faction_stats_merged AS (
    SELECT
      player_id,
      faction_id,
      opponent_id,
      map_id,
      opponent_faction_id,
      SUM(wins)::INT as wins,
      SUM(losses)::INT as losses,
      (SUM(wins) + SUM(losses))::INT as total_games,
      AVG(avg_elo_change)::NUMERIC(8,2) as avg_elo_change,
      SUM(elo_gained)::NUMERIC(8,2) as elo_gained,
      SUM(elo_lost)::NUMERIC(8,2) as elo_lost
    FROM faction_stats_combined
    GROUP BY player_id, faction_id, opponent_id, map_id, opponent_faction_id
  )
  INSERT INTO player_match_statistics (player_id, opponent_id, map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate, avg_elo_change, elo_gained, elo_lost)
  SELECT
    player_id,
    opponent_id,
    map_id,
    faction_id,
    opponent_faction_id,
    total_games,
    wins,
    losses,
    CASE WHEN total_games > 0 THEN ROUND(100.0 * wins / total_games, 2)::NUMERIC(5,2) ELSE 0 END,
    avg_elo_change,
    elo_gained,
    elo_lost
  FROM faction_stats_merged;

END;
$$ LANGUAGE plpgsql;

-- Call the function to recalculate all statistics
SELECT recalculate_player_match_statistics();
