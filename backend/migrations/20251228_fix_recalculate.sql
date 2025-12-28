-- Fix recalculate_player_match_statistics function to include all dimensions
-- This fixes the missing by-map, by-faction, and head-to-head statistics

DROP FUNCTION IF EXISTS recalculate_player_match_statistics();

CREATE OR REPLACE FUNCTION recalculate_player_match_statistics()
RETURNS void AS $$
BEGIN
  -- Clear existing statistics
  DELETE FROM player_match_statistics;
  
  -- 1. Insert global player statistics (wins)
  INSERT INTO player_match_statistics 
    (player_id, opponent_id, map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate, avg_elo_change, created_at, last_updated)
  SELECT
    m.winner_id as player_id,
    NULL::UUID as opponent_id,
    NULL::UUID as map_id,
    NULL::UUID as faction_id,
    NULL::UUID as opponent_faction_id,
    COUNT(*) as total_games,
    COUNT(*) as wins,
    0 as losses,
    100.00 as winrate,
    AVG(COALESCE(m.elo_change, 0)) as avg_elo_change,
    NOW(),
    NOW()
  FROM matches m
  WHERE m.status = 'confirmed' AND NOT (m.admin_reviewed = true AND m.status = 'cancelled')
  GROUP BY m.winner_id;
  
  -- 2. Insert global player statistics (losses)
  INSERT INTO player_match_statistics 
    (player_id, opponent_id, map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate, avg_elo_change, created_at, last_updated)
  SELECT
    m.loser_id as player_id,
    NULL::UUID as opponent_id,
    NULL::UUID as map_id,
    NULL::UUID as faction_id,
    NULL::UUID as opponent_faction_id,
    COUNT(*) as total_games,
    0 as wins,
    COUNT(*) as losses,
    0.00 as winrate,
    AVG(-COALESCE(m.elo_change, 0)) as avg_elo_change,
    NOW(),
    NOW()
  FROM matches m
  WHERE m.status = 'confirmed' AND NOT (m.admin_reviewed = true AND m.status = 'cancelled')
  GROUP BY m.loser_id;
  
  -- 3. Insert by-map statistics (winner)
  INSERT INTO player_match_statistics 
    (player_id, opponent_id, map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate, avg_elo_change, created_at, last_updated)
  SELECT
    m.winner_id as player_id,
    NULL::UUID as opponent_id,
    gm.id as map_id,
    NULL::UUID as faction_id,
    NULL::UUID as opponent_faction_id,
    COUNT(*) as total_games,
    COUNT(*) as wins,
    0 as losses,
    100.00 as winrate,
    AVG(COALESCE(m.elo_change, 0)) as avg_elo_change,
    NOW(),
    NOW()
  FROM matches m
  JOIN game_maps gm ON m.map = gm.name
  WHERE m.status = 'confirmed' AND NOT (m.admin_reviewed = true AND m.status = 'cancelled')
  GROUP BY m.winner_id, gm.id;
  
  -- 4. Insert by-map statistics (loser)
  INSERT INTO player_match_statistics 
    (player_id, opponent_id, map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate, avg_elo_change, created_at, last_updated)
  SELECT
    m.loser_id as player_id,
    NULL::UUID as opponent_id,
    gm.id as map_id,
    NULL::UUID as faction_id,
    NULL::UUID as opponent_faction_id,
    COUNT(*) as total_games,
    0 as wins,
    COUNT(*) as losses,
    0.00 as winrate,
    AVG(-COALESCE(m.elo_change, 0)) as avg_elo_change,
    NOW(),
    NOW()
  FROM matches m
  JOIN game_maps gm ON m.map = gm.name
  WHERE m.status = 'confirmed' AND NOT (m.admin_reviewed = true AND m.status = 'cancelled')
  GROUP BY m.loser_id, gm.id;
  
  -- 5. Insert by-faction statistics (winner)
  INSERT INTO player_match_statistics 
    (player_id, opponent_id, map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate, avg_elo_change, created_at, last_updated)
  SELECT
    m.winner_id as player_id,
    NULL::UUID as opponent_id,
    NULL::UUID as map_id,
    f.id as faction_id,
    NULL::UUID as opponent_faction_id,
    COUNT(*) as total_games,
    COUNT(*) as wins,
    0 as losses,
    100.00 as winrate,
    AVG(COALESCE(m.elo_change, 0)) as avg_elo_change,
    NOW(),
    NOW()
  FROM matches m
  JOIN factions f ON m.winner_faction = f.name
  WHERE m.status = 'confirmed' AND NOT (m.admin_reviewed = true AND m.status = 'cancelled')
  GROUP BY m.winner_id, f.id;
  
  -- 6. Insert by-faction statistics (loser)
  INSERT INTO player_match_statistics 
    (player_id, opponent_id, map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate, avg_elo_change, created_at, last_updated)
  SELECT
    m.loser_id as player_id,
    NULL::UUID as opponent_id,
    NULL::UUID as map_id,
    f.id as faction_id,
    NULL::UUID as opponent_faction_id,
    COUNT(*) as total_games,
    0 as wins,
    COUNT(*) as losses,
    0.00 as winrate,
    AVG(-COALESCE(m.elo_change, 0)) as avg_elo_change,
    NOW(),
    NOW()
  FROM matches m
  JOIN factions f ON m.loser_faction = f.name
  WHERE m.status = 'confirmed' AND NOT (m.admin_reviewed = true AND m.status = 'cancelled')
  GROUP BY m.loser_id, f.id;
  
  -- 7. Insert head-to-head statistics (winner vs loser)
  INSERT INTO player_match_statistics 
    (player_id, opponent_id, map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate, avg_elo_change, created_at, last_updated)
  SELECT
    m.winner_id as player_id,
    m.loser_id as opponent_id,
    gm.id as map_id,
    f_winner.id as faction_id,
    f_loser.id as opponent_faction_id,
    COUNT(*) as total_games,
    COUNT(*) as wins,
    0 as losses,
    100.00 as winrate,
    AVG(COALESCE(m.elo_change, 0)) as avg_elo_change,
    NOW(),
    NOW()
  FROM matches m
  JOIN game_maps gm ON m.map = gm.name
  JOIN factions f_winner ON m.winner_faction = f_winner.name
  JOIN factions f_loser ON m.loser_faction = f_loser.name
  WHERE m.status = 'confirmed' AND NOT (m.admin_reviewed = true AND m.status = 'cancelled')
  GROUP BY m.winner_id, m.loser_id, gm.id, f_winner.id, f_loser.id;
  
  -- 8. Insert head-to-head statistics (loser vs winner)
  INSERT INTO player_match_statistics 
    (player_id, opponent_id, map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate, avg_elo_change, created_at, last_updated)
  SELECT
    m.loser_id as player_id,
    m.winner_id as opponent_id,
    gm.id as map_id,
    f_loser.id as faction_id,
    f_winner.id as opponent_faction_id,
    COUNT(*) as total_games,
    0 as wins,
    COUNT(*) as losses,
    0.00 as winrate,
    AVG(-COALESCE(m.elo_change, 0)) as avg_elo_change,
    NOW(),
    NOW()
  FROM matches m
  JOIN game_maps gm ON m.map = gm.name
  JOIN factions f_winner ON m.winner_faction = f_winner.name
  JOIN factions f_loser ON m.loser_faction = f_loser.name
  WHERE m.status = 'confirmed' AND NOT (m.admin_reviewed = true AND m.status = 'cancelled')
  GROUP BY m.loser_id, m.winner_id, gm.id, f_loser.id, f_winner.id;
  
  RAISE NOTICE 'Player match statistics recalculated successfully with all dimensions';
END;
$$ LANGUAGE plpgsql;
