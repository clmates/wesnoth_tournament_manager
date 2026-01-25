-- Fix incorrect opponent statistics calculation in recent_opponents
-- The issue: total_games was being set to only wins (for winners) or losses (for losers)
-- instead of wins + losses (total games against that opponent)

-- Create a new version of recalculate function with correct calculation
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
  GROUP BY player_id
  ON CONFLICT (player_id, COALESCE(opponent_id, '00000000-0000-0000-0000-000000000000'::UUID), COALESCE(map_id, '00000000-0000-0000-0000-000000000000'::UUID), COALESCE(faction_id, '00000000-0000-0000-0000-000000000000'::UUID), COALESCE(opponent_faction_id, '00000000-0000-0000-0000-000000000000'::UUID)) DO UPDATE SET
    total_games = EXCLUDED.total_games,
    wins = EXCLUDED.wins,
    losses = EXCLUDED.losses,
    winrate = EXCLUDED.winrate,
    last_updated = CURRENT_TIMESTAMP;

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
    wins + losses,
    wins,
    losses,
    100.00::NUMERIC(5,2),
    avg_elo_change,
    last_elo_against_me,
    elo_gained,
    elo_lost,
    last_match_date
  FROM h2h_winner
  ON CONFLICT (player_id, COALESCE(opponent_id, '00000000-0000-0000-0000-000000000000'::UUID), COALESCE(map_id, '00000000-0000-0000-0000-000000000000'::UUID), COALESCE(faction_id, '00000000-0000-0000-0000-000000000000'::UUID), COALESCE(opponent_faction_id, '00000000-0000-0000-0000-000000000000'::UUID)) DO UPDATE SET
    total_games = EXCLUDED.total_games,
    wins = EXCLUDED.wins,
    losses = EXCLUDED.losses,
    winrate = EXCLUDED.winrate,
    avg_elo_change = EXCLUDED.avg_elo_change,
    last_elo_against_me = EXCLUDED.last_elo_against_me,
    elo_gained = EXCLUDED.elo_gained,
    elo_lost = EXCLUDED.elo_lost,
    last_match_date = EXCLUDED.last_match_date,
    last_updated = CURRENT_TIMESTAMP;

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
    wins + losses,
    wins,
    losses,
    0.00::NUMERIC(5,2),
    avg_elo_change,
    last_elo_against_me,
    elo_gained,
    elo_lost,
    last_match_date
  FROM h2h_loser
  ON CONFLICT (player_id, COALESCE(opponent_id, '00000000-0000-0000-0000-000000000000'::UUID), COALESCE(map_id, '00000000-0000-0000-0000-000000000000'::UUID), COALESCE(faction_id, '00000000-0000-0000-0000-000000000000'::UUID), COALESCE(opponent_faction_id, '00000000-0000-0000-0000-000000000000'::UUID)) DO UPDATE SET
    total_games = EXCLUDED.total_games,
    wins = EXCLUDED.wins,
    losses = EXCLUDED.losses,
    winrate = EXCLUDED.winrate,
    avg_elo_change = EXCLUDED.avg_elo_change,
    last_elo_against_me = EXCLUDED.last_elo_against_me,
    elo_gained = EXCLUDED.elo_gained,
    elo_lost = EXCLUDED.elo_lost,
    last_match_date = EXCLUDED.last_match_date,
    last_updated = CURRENT_TIMESTAMP;

  -- ===== HEAD-TO-HEAD WINNER AGGREGATED (no map/faction) =====
  -- FIXED: Changed from "wins" to "wins + losses" for total_games
  WITH h2h_winner_agg AS (
    SELECT
      m.winner_id as player_id,
      m.loser_id as opponent_id,
      NULL::UUID as map_id,
      NULL::UUID as faction_id,
      NULL::UUID as opponent_faction_id,
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
  )
  INSERT INTO player_match_statistics (player_id, opponent_id, map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate, avg_elo_change, last_elo_against_me, elo_gained, elo_lost, last_match_date)
  SELECT
    player_id,
    opponent_id,
    map_id,
    faction_id,
    opponent_faction_id,
    wins + losses,
    wins,
    losses,
    CASE WHEN wins + losses > 0 THEN ROUND(100.0 * wins / (wins + losses), 2)::NUMERIC(5,2) ELSE 0 END,
    avg_elo_change,
    last_elo_against_me,
    elo_gained,
    elo_lost,
    last_match_date
  FROM h2h_winner_agg
  ON CONFLICT (player_id, COALESCE(opponent_id, '00000000-0000-0000-0000-000000000000'::UUID), COALESCE(map_id, '00000000-0000-0000-0000-000000000000'::UUID), COALESCE(faction_id, '00000000-0000-0000-0000-000000000000'::UUID), COALESCE(opponent_faction_id, '00000000-0000-0000-0000-000000000000'::UUID)) DO UPDATE SET
    total_games = EXCLUDED.total_games,
    wins = EXCLUDED.wins,
    losses = EXCLUDED.losses,
    winrate = EXCLUDED.winrate,
    avg_elo_change = EXCLUDED.avg_elo_change,
    last_elo_against_me = EXCLUDED.last_elo_against_me,
    elo_gained = EXCLUDED.elo_gained,
    elo_lost = EXCLUDED.elo_lost,
    last_match_date = EXCLUDED.last_match_date,
    last_updated = CURRENT_TIMESTAMP;

  -- ===== HEAD-TO-HEAD LOSER AGGREGATED (no map/faction) =====
  -- FIXED: Changed from "losses" to "wins + losses" for total_games
  WITH h2h_loser_agg AS (
    SELECT
      m.loser_id as player_id,
      m.winner_id as opponent_id,
      NULL::UUID as map_id,
      NULL::UUID as faction_id,
      NULL::UUID as opponent_faction_id,
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
  )
  INSERT INTO player_match_statistics (player_id, opponent_id, map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate, avg_elo_change, last_elo_against_me, elo_gained, elo_lost, last_match_date)
  SELECT
    player_id,
    opponent_id,
    map_id,
    faction_id,
    opponent_faction_id,
    wins + losses,
    wins,
    losses,
    CASE WHEN wins + losses > 0 THEN ROUND(100.0 * wins / (wins + losses), 2)::NUMERIC(5,2) ELSE 0 END,
    avg_elo_change,
    last_elo_against_me,
    elo_gained,
    elo_lost,
    last_match_date
  FROM h2h_loser_agg
  ON CONFLICT (player_id, COALESCE(opponent_id, '00000000-0000-0000-0000-000000000000'::UUID), COALESCE(map_id, '00000000-0000-0000-0000-000000000000'::UUID), COALESCE(faction_id, '00000000-0000-0000-0000-000000000000'::UUID), COALESCE(opponent_faction_id, '00000000-0000-0000-0000-000000000000'::UUID)) DO UPDATE SET
    total_games = EXCLUDED.total_games,
    wins = EXCLUDED.wins,
    losses = EXCLUDED.losses,
    winrate = EXCLUDED.winrate,
    avg_elo_change = EXCLUDED.avg_elo_change,
    last_elo_against_me = EXCLUDED.last_elo_against_me,
    elo_gained = EXCLUDED.elo_gained,
    elo_lost = EXCLUDED.elo_lost,
    last_match_date = EXCLUDED.last_match_date,
    last_updated = CURRENT_TIMESTAMP;

  -- ===== PER-MAP STATS =====
  WITH map_stats AS (
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
  )
  INSERT INTO player_match_statistics (player_id, opponent_id, map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate, avg_elo_change, elo_gained, elo_lost)
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
  GROUP BY player_id, map_id, opponent_id, faction_id, opponent_faction_id
  ON CONFLICT (player_id, COALESCE(opponent_id, '00000000-0000-0000-0000-000000000000'::UUID), COALESCE(map_id, '00000000-0000-0000-0000-000000000000'::UUID), COALESCE(faction_id, '00000000-0000-0000-0000-000000000000'::UUID), COALESCE(opponent_faction_id, '00000000-0000-0000-0000-000000000000'::UUID)) DO UPDATE SET
    total_games = EXCLUDED.total_games,
    wins = EXCLUDED.wins,
    losses = EXCLUDED.losses,
    winrate = EXCLUDED.winrate,
    avg_elo_change = EXCLUDED.avg_elo_change,
    last_updated = CURRENT_TIMESTAMP;

  -- ===== PER-FACTION STATS =====
  WITH faction_stats AS (
    SELECT
      m.winner_id as player_id,
      f.id as faction_id,
      NULL::UUID as opponent_id,
      NULL::UUID as map_id,
      NULL::UUID as opponent_faction_id,
      COUNT(*)::INT as wins,
      0::INT as losses,
      AVG(m.winner_elo_after - m.winner_elo_before)::NUMERIC(8,2) as avg_elo_change,
      0::NUMERIC(8,2) as elo_gained,
      0::NUMERIC(8,2) as elo_lost
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
      AVG(m.loser_elo_after - m.loser_elo_before)::NUMERIC(8,2) as avg_elo_change,
      0::NUMERIC(8,2) as elo_gained,
      0::NUMERIC(8,2) as elo_lost
    FROM matches m
    JOIN factions f ON f.name = m.loser_faction
    WHERE NOT (m.admin_reviewed = true AND m.status = 'cancelled')
    GROUP BY m.loser_id, f.id
  )
  INSERT INTO player_match_statistics (player_id, opponent_id, map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate, avg_elo_change, elo_gained, elo_lost)
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
  GROUP BY player_id, faction_id, opponent_id, map_id, opponent_faction_id
  ON CONFLICT (player_id, COALESCE(opponent_id, '00000000-0000-0000-0000-000000000000'::UUID), COALESCE(map_id, '00000000-0000-0000-0000-000000000000'::UUID), COALESCE(faction_id, '00000000-0000-0000-0000-000000000000'::UUID), COALESCE(opponent_faction_id, '00000000-0000-0000-0000-000000000000'::UUID)) DO UPDATE SET
    total_games = EXCLUDED.total_games,
    wins = EXCLUDED.wins,
    losses = EXCLUDED.losses,
    winrate = EXCLUDED.winrate,
    avg_elo_change = EXCLUDED.avg_elo_change,
    last_updated = CURRENT_TIMESTAMP;

  -- Recreate trigger for new matches
  DROP TRIGGER IF EXISTS trg_update_player_match_stats ON matches;
  CREATE TRIGGER trg_update_player_match_stats
  AFTER INSERT OR UPDATE ON matches
  FOR EACH ROW
  EXECUTE FUNCTION update_player_match_statistics();
END;
$$ LANGUAGE plpgsql;
