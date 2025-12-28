-- Expand player_match_statistics table with additional opponent-related fields
-- Adds: last_elo_against_me, elo_gained, elo_lost, last_match_date

ALTER TABLE player_match_statistics
ADD COLUMN IF NOT EXISTS last_elo_against_me DECIMAL(8, 2),
ADD COLUMN IF NOT EXISTS elo_gained DECIMAL(8, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS elo_lost DECIMAL(8, 2) DEFAULT 0,
ADD COLUMN IF NOT EXISTS last_match_date TIMESTAMP;

-- Update the update_player_match_statistics function to calculate new fields
CREATE OR REPLACE FUNCTION update_player_match_statistics()
RETURNS TRIGGER AS $$
DECLARE
  v_winner_id UUID;
  v_loser_id UUID;
  v_winner_elo_after INT;
  v_loser_elo_after INT;
  v_winner_elo_before INT;
  v_loser_elo_before INT;
  v_map_id UUID;
  v_winner_faction_id UUID;
  v_loser_faction_id UUID;
  v_elo_change INT;
  v_existing_id UUID;
BEGIN
  -- Skip cancelled/disputed matches
  IF NEW.admin_reviewed = true AND NEW.status = 'cancelled' THEN
    RETURN NEW;
  END IF;

  v_winner_id := NEW.winner_id;
  v_loser_id := NEW.loser_id;
  v_winner_elo_after := NEW.winner_elo_after;
  v_loser_elo_after := NEW.loser_elo_after;
  v_winner_elo_before := NEW.winner_elo_before;
  v_loser_elo_before := NEW.loser_elo_before;

  -- Get map and faction IDs
  SELECT id INTO v_map_id FROM game_maps WHERE name = NEW.map LIMIT 1;
  SELECT id INTO v_winner_faction_id FROM factions WHERE name = NEW.winner_faction LIMIT 1;
  SELECT id INTO v_loser_faction_id FROM factions WHERE name = NEW.loser_faction LIMIT 1;

  IF v_map_id IS NULL OR v_winner_faction_id IS NULL OR v_loser_faction_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Calculate ELO changes
  v_elo_change := v_winner_elo_after - v_winner_elo_before;

  -- ===== WINNER GLOBAL STATS =====
  SELECT id INTO v_existing_id FROM player_match_statistics 
    WHERE player_id = v_winner_id AND opponent_id IS NULL AND map_id IS NULL AND faction_id IS NULL AND opponent_faction_id IS NULL;
  
  IF v_existing_id IS NOT NULL THEN
    UPDATE player_match_statistics SET
      total_games = total_games + 1,
      wins = wins + 1,
      winrate = ROUND(100.0 * (wins + 1) / (total_games + 1), 2)::NUMERIC(5,2),
      avg_elo_change = ROUND((avg_elo_change * total_games + v_elo_change) / (total_games + 1), 2)::NUMERIC(8,2),
      last_updated = CURRENT_TIMESTAMP
    WHERE id = v_existing_id;
  ELSE
    INSERT INTO player_match_statistics (player_id, opponent_id, map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate, avg_elo_change)
    VALUES (v_winner_id, NULL, NULL, NULL, NULL, 1, 1, 0, 100.00, v_elo_change::DECIMAL(8,2));
  END IF;

  -- ===== LOSER GLOBAL STATS =====
  SELECT id INTO v_existing_id FROM player_match_statistics 
    WHERE player_id = v_loser_id AND opponent_id IS NULL AND map_id IS NULL AND faction_id IS NULL AND opponent_faction_id IS NULL;
  
  v_elo_change := v_loser_elo_after - v_loser_elo_before;
  
  IF v_existing_id IS NOT NULL THEN
    UPDATE player_match_statistics SET
      total_games = total_games + 1,
      losses = losses + 1,
      winrate = ROUND(100.0 * wins / (total_games + 1), 2)::NUMERIC(5,2),
      avg_elo_change = ROUND((avg_elo_change * total_games + v_elo_change) / (total_games + 1), 2)::NUMERIC(8,2),
      last_updated = CURRENT_TIMESTAMP
    WHERE id = v_existing_id;
  ELSE
    INSERT INTO player_match_statistics (player_id, opponent_id, map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate, avg_elo_change)
    VALUES (v_loser_id, NULL, NULL, NULL, NULL, 1, 0, 1, 0.00, v_elo_change::DECIMAL(8,2));
  END IF;

  -- ===== WINNER vs LOSER HEAD-TO-HEAD =====
  v_elo_change := NEW.winner_elo_after - NEW.winner_elo_before;
  
  SELECT id INTO v_existing_id FROM player_match_statistics 
    WHERE player_id = v_winner_id AND opponent_id = v_loser_id 
    AND map_id = v_map_id AND faction_id = v_winner_faction_id AND opponent_faction_id = v_loser_faction_id;
  
  IF v_existing_id IS NOT NULL THEN
    UPDATE player_match_statistics SET
      total_games = total_games + 1,
      wins = wins + 1,
      winrate = ROUND(100.0 * (wins + 1) / (total_games + 1), 2)::NUMERIC(5,2),
      avg_elo_change = ROUND((avg_elo_change * total_games + v_elo_change) / (total_games + 1), 2)::NUMERIC(8,2),
      last_elo_against_me = NEW.loser_elo_after::DECIMAL(8,2),
      elo_gained = elo_gained + CASE WHEN v_elo_change > 0 THEN v_elo_change ELSE 0 END,
      last_match_date = NEW.created_at,
      last_updated = CURRENT_TIMESTAMP
    WHERE id = v_existing_id;
  ELSE
    INSERT INTO player_match_statistics (player_id, opponent_id, map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate, avg_elo_change, last_elo_against_me, elo_gained, elo_lost, last_match_date)
    VALUES (v_winner_id, v_loser_id, v_map_id, v_winner_faction_id, v_loser_faction_id, 1, 1, 0, 100.00, v_elo_change::DECIMAL(8,2), NEW.loser_elo_after::DECIMAL(8,2), CASE WHEN v_elo_change > 0 THEN v_elo_change::DECIMAL(8,2) ELSE 0 END, 0, NEW.created_at);
  END IF;

  -- ===== LOSER vs WINNER HEAD-TO-HEAD =====
  v_elo_change := NEW.loser_elo_after - NEW.loser_elo_before;
  
  SELECT id INTO v_existing_id FROM player_match_statistics 
    WHERE player_id = v_loser_id AND opponent_id = v_winner_id 
    AND map_id = v_map_id AND faction_id = v_loser_faction_id AND opponent_faction_id = v_winner_faction_id;
  
  IF v_existing_id IS NOT NULL THEN
    UPDATE player_match_statistics SET
      total_games = total_games + 1,
      losses = losses + 1,
      winrate = ROUND(100.0 * wins / (total_games + 1), 2)::NUMERIC(5,2),
      avg_elo_change = ROUND((avg_elo_change * total_games + v_elo_change) / (total_games + 1), 2)::NUMERIC(8,2),
      last_elo_against_me = NEW.winner_elo_after::DECIMAL(8,2),
      elo_lost = elo_lost + CASE WHEN v_elo_change < 0 THEN ABS(v_elo_change) ELSE 0 END,
      last_match_date = NEW.created_at,
      last_updated = CURRENT_TIMESTAMP
    WHERE id = v_existing_id;
  ELSE
    INSERT INTO player_match_statistics (player_id, opponent_id, map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate, avg_elo_change, last_elo_against_me, elo_gained, elo_lost, last_match_date)
    VALUES (v_loser_id, v_winner_id, v_map_id, v_loser_faction_id, v_winner_faction_id, 1, 0, 1, 0.00, v_elo_change::DECIMAL(8,2), NEW.winner_elo_after::DECIMAL(8,2), 0, CASE WHEN v_elo_change < 0 THEN ABS(v_elo_change)::DECIMAL(8,2) ELSE 0 END, NEW.created_at);
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Recreate trigger
DROP TRIGGER IF EXISTS trg_update_player_match_stats ON matches;
CREATE TRIGGER trg_update_player_match_stats
AFTER INSERT OR UPDATE ON matches
FOR EACH ROW
EXECUTE FUNCTION update_player_match_statistics();

-- Update the recalculate function to include new fields
CREATE OR REPLACE FUNCTION recalculate_player_match_statistics()
RETURNS void AS $$
BEGIN
  -- Clear existing statistics
  TRUNCATE TABLE player_match_statistics;
  
  -- Insert global stats for each player (aggregated from all matches)
  WITH player_global_stats AS (
    SELECT
      m.winner_id as player_id,
      COUNT(*)::INT as wins,
      0::INT as losses,
      SUM(m.winner_elo_after - m.winner_elo_before)::NUMERIC(8,2) / COUNT(*) as avg_elo_change
    FROM matches m
    WHERE NOT (m.admin_reviewed = true AND m.status = 'cancelled')
    GROUP BY m.winner_id
    UNION ALL
    SELECT
      m.loser_id as player_id,
      0::INT as wins,
      COUNT(*)::INT as losses,
      SUM(m.loser_elo_after - m.loser_elo_before)::NUMERIC(8,2) / COUNT(*) as avg_elo_change
    FROM matches m
    WHERE NOT (m.admin_reviewed = true AND m.status = 'cancelled')
    GROUP BY m.loser_id
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
  FROM player_global_stats
  GROUP BY player_id;

  -- Insert head-to-head stats with opponent info
  WITH h2h_stats AS (
    SELECT
      m.winner_id as player_id,
      m.loser_id as opponent_id,
      gm.id as map_id,
      f_winner.id as faction_id,
      f_loser.id as opponent_faction_id,
      COUNT(*)::INT as wins,
      0::INT as losses,
      m.loser_elo_after as last_elo_against_me,
      SUM(m.winner_elo_after - m.winner_elo_before)::NUMERIC(8,2) / COUNT(*) as avg_elo_change,
      SUM(CASE WHEN m.winner_elo_after - m.winner_elo_before > 0 THEN m.winner_elo_after - m.winner_elo_before ELSE 0 END)::NUMERIC(8,2) as elo_gained,
      0::NUMERIC(8,2) as elo_lost,
      MAX(m.created_at) as last_match_date
    FROM matches m
    JOIN game_maps gm ON gm.name = m.map
    JOIN factions f_winner ON f_winner.name = m.winner_faction
    JOIN factions f_loser ON f_loser.name = m.loser_faction
    WHERE NOT (m.admin_reviewed = true AND m.status = 'cancelled')
    GROUP BY m.winner_id, m.loser_id, gm.id, f_winner.id, f_loser.id, m.loser_elo_after
  )
  INSERT INTO player_match_statistics (player_id, opponent_id, map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate, avg_elo_change, last_elo_against_me, elo_gained, elo_lost, last_match_date)
  SELECT
    player_id,
    opponent_id,
    map_id,
    faction_id,
    opponent_faction_id,
    wins::INT as total_games,
    wins::INT,
    losses::INT,
    100.00::NUMERIC(5,2),
    avg_elo_change,
    last_elo_against_me::DECIMAL(8,2),
    elo_gained,
    elo_lost,
    last_match_date
  FROM h2h_stats;

  -- Insert loser perspective h2h stats
  WITH h2h_losses AS (
    SELECT
      m.loser_id as player_id,
      m.winner_id as opponent_id,
      gm.id as map_id,
      f_loser.id as faction_id,
      f_winner.id as opponent_faction_id,
      0::INT as wins,
      COUNT(*)::INT as losses,
      m.winner_elo_after as last_elo_against_me,
      SUM(m.loser_elo_after - m.loser_elo_before)::NUMERIC(8,2) / COUNT(*) as avg_elo_change,
      0::NUMERIC(8,2) as elo_gained,
      SUM(CASE WHEN m.loser_elo_after - m.loser_elo_before < 0 THEN ABS(m.loser_elo_after - m.loser_elo_before) ELSE 0 END)::NUMERIC(8,2) as elo_lost,
      MAX(m.created_at) as last_match_date
    FROM matches m
    JOIN game_maps gm ON gm.name = m.map
    JOIN factions f_loser ON f_loser.name = m.loser_faction
    JOIN factions f_winner ON f_winner.name = m.winner_faction
    WHERE NOT (m.admin_reviewed = true AND m.status = 'cancelled')
    GROUP BY m.loser_id, m.winner_id, gm.id, f_loser.id, f_winner.id, m.winner_elo_after
  )
  INSERT INTO player_match_statistics (player_id, opponent_id, map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate, avg_elo_change, last_elo_against_me, elo_gained, elo_lost, last_match_date)
  SELECT
    player_id,
    opponent_id,
    map_id,
    faction_id,
    opponent_faction_id,
    losses::INT as total_games,
    wins::INT,
    losses::INT,
    CASE WHEN losses > 0 THEN 0.00::NUMERIC(5,2) ELSE 0.00::NUMERIC(5,2) END,
    avg_elo_change,
    last_elo_against_me::DECIMAL(8,2),
    elo_gained,
    elo_lost,
    last_match_date
  FROM h2h_losses;

  RAISE NOTICE 'Player match statistics recalculated successfully';
END;
$$ LANGUAGE plpgsql;
