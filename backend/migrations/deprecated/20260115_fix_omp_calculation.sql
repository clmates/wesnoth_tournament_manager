-- Fix: OMP calculation should use 1 point per win, not 3
-- Since there are no draws, each win = 1 point

CREATE OR REPLACE FUNCTION calculate_swiss_tiebreakers(
  p_tournament_id UUID
)
RETURNS TABLE (
  user_id UUID,
  total_points INT,
  omp DECIMAL(8,2),
  gwp DECIMAL(5,2),
  ogp DECIMAL(5,2)
) AS $$
DECLARE
  v_user RECORD;
  v_total_points INT;
  v_omp DECIMAL(8,2);
  v_gwp DECIMAL(5,2);
  v_ogp DECIMAL(5,2);
  v_total_games_played INT;
  v_games_won INT;
  v_games_lost INT;
BEGIN
  FOR v_user IN 
    SELECT DISTINCT tp.user_id
    FROM tournament_participants tp
    WHERE tp.tournament_id = p_tournament_id
    ORDER BY tp.user_id
  LOOP
    -- 1. TOTAL POINTS = number of wins (1 point per win)
    SELECT COALESCE(tp.tournament_wins, 0) INTO v_total_points
    FROM tournament_participants tp
    WHERE tp.tournament_id = p_tournament_id
      AND tp.user_id = v_user.user_id;

    -- 2. OMP (Opponent Match Points) = Average wins of all opponents faced
    WITH opponent_wins AS (
      SELECT DISTINCT
        CASE 
          WHEN tm.player1_id = v_user.user_id THEN tm.player2_id
          ELSE tm.player1_id
        END as opponent_id,
        COALESCE(tp.tournament_wins, 0) as opp_wins
      FROM tournament_round_matches tm
      LEFT JOIN tournament_participants tp ON tp.tournament_id = p_tournament_id AND tp.user_id = 
        CASE 
          WHEN tm.player1_id = v_user.user_id THEN tm.player2_id
          ELSE tm.player1_id
        END
      WHERE tm.tournament_id = p_tournament_id
        AND (tm.player1_id = v_user.user_id OR tm.player2_id = v_user.user_id)
        AND tm.series_status = 'completed'
    )
    SELECT COALESCE(AVG(opp_wins), 0)::DECIMAL(8,2) INTO v_omp
    FROM opponent_wins;

    -- 3. GWP (Game Win Percentage) = (Games won / Total games played) * 100
    SELECT 
      COALESCE(SUM(CASE WHEN tm.player1_id = v_user.user_id THEN tm.player1_wins ELSE tm.player2_wins END), 0),
      COALESCE(SUM(CASE WHEN tm.player1_id = v_user.user_id THEN tm.player2_wins ELSE tm.player1_wins END), 0)
    INTO v_games_won, v_games_lost
    FROM tournament_round_matches tm
    WHERE tm.tournament_id = p_tournament_id
      AND (tm.player1_id = v_user.user_id OR tm.player2_id = v_user.user_id)
      AND tm.series_status = 'completed';

    v_total_games_played := v_games_won + v_games_lost;

    IF v_total_games_played > 0 THEN
      v_gwp := (v_games_won::DECIMAL / v_total_games_played * 100)::DECIMAL(5,2);
    ELSE
      v_gwp := 0;
    END IF;

    -- 4. OGP (Opponent Game Percentage) = Average GWP of opponents
    WITH opponent_gwp AS (
      SELECT DISTINCT
        CASE 
          WHEN tm.player1_id = v_user.user_id THEN tm.player2_id
          ELSE tm.player1_id
        END as opponent_id,
        CASE 
          WHEN tm.player1_id = v_user.user_id THEN tm.player2_wins
          ELSE tm.player1_wins
        END as opp_wins,
        CASE 
          WHEN tm.player1_id = v_user.user_id THEN tm.player1_wins
          ELSE tm.player2_wins
        END as opp_losses
      FROM tournament_round_matches tm
      WHERE tm.tournament_id = p_tournament_id
        AND (tm.player1_id = v_user.user_id OR tm.player2_id = v_user.user_id)
        AND tm.series_status = 'completed'
    )
    SELECT COALESCE(AVG(
      CASE 
        WHEN (opp_wins + opp_losses) > 0 THEN (opp_wins::DECIMAL / (opp_wins + opp_losses) * 100)
        ELSE 0
      END
    ), 0)::DECIMAL(5,2) INTO v_ogp
    FROM opponent_gwp;

    RETURN QUERY SELECT 
      v_user.user_id,
      v_total_points,
      v_omp,
      v_gwp,
      v_ogp;
  END LOOP;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION calculate_league_tiebreakers(
  p_tournament_id UUID
)
RETURNS TABLE (
  user_id UUID,
  total_points INT,
  omp DECIMAL(8,2),
  gwp DECIMAL(5,2),
  ogp DECIMAL(5,2)
) AS $$
DECLARE
  v_user RECORD;
  v_total_points INT;
  v_omp DECIMAL(8,2);
  v_gwp DECIMAL(5,2);
  v_ogp DECIMAL(5,2);
  v_total_games_played INT;
  v_games_won INT;
  v_games_lost INT;
BEGIN
  FOR v_user IN 
    SELECT DISTINCT tp.user_id
    FROM tournament_participants tp
    WHERE tp.tournament_id = p_tournament_id
    ORDER BY tp.user_id
  LOOP
    -- 1. TOTAL POINTS = number of wins (1 point per win)
    SELECT COALESCE(tp.tournament_wins, 0) INTO v_total_points
    FROM tournament_participants tp
    WHERE tp.tournament_id = p_tournament_id
      AND tp.user_id = v_user.user_id;

    -- 2. OMP (Opponent Match Points) = Average wins of all opponents faced
    WITH opponent_wins AS (
      SELECT DISTINCT
        CASE 
          WHEN tm.player1_id = v_user.user_id THEN tm.player2_id
          ELSE tm.player1_id
        END as opponent_id,
        COALESCE(tp.tournament_wins, 0) as opp_wins
      FROM tournament_round_matches tm
      LEFT JOIN tournament_participants tp ON tp.tournament_id = p_tournament_id AND tp.user_id = 
        CASE 
          WHEN tm.player1_id = v_user.user_id THEN tm.player2_id
          ELSE tm.player1_id
        END
      WHERE tm.tournament_id = p_tournament_id
        AND (tm.player1_id = v_user.user_id OR tm.player2_id = v_user.user_id)
        AND tm.series_status = 'completed'
    )
    SELECT COALESCE(AVG(opp_wins), 0)::DECIMAL(8,2) INTO v_omp
    FROM opponent_wins;

    -- 3. GWP (Game Win Percentage) = (Games won / Total games played) * 100
    SELECT 
      COALESCE(SUM(CASE WHEN tm.player1_id = v_user.user_id THEN tm.player1_wins ELSE tm.player2_wins END), 0),
      COALESCE(SUM(CASE WHEN tm.player1_id = v_user.user_id THEN tm.player2_wins ELSE tm.player1_wins END), 0)
    INTO v_games_won, v_games_lost
    FROM tournament_round_matches tm
    WHERE tm.tournament_id = p_tournament_id
      AND (tm.player1_id = v_user.user_id OR tm.player2_id = v_user.user_id)
      AND tm.series_status = 'completed';

    v_total_games_played := v_games_won + v_games_lost;

    IF v_total_games_played > 0 THEN
      v_gwp := (v_games_won::DECIMAL / v_total_games_played * 100)::DECIMAL(5,2);
    ELSE
      v_gwp := 0;
    END IF;

    -- 4. OGP (Opponent Game Percentage) = Average GWP of opponents
    WITH opponent_gwp AS (
      SELECT DISTINCT
        CASE 
          WHEN tm.player1_id = v_user.user_id THEN tm.player2_id
          ELSE tm.player1_id
        END as opponent_id,
        CASE 
          WHEN tm.player1_id = v_user.user_id THEN tm.player2_wins
          ELSE tm.player1_wins
        END as opp_wins,
        CASE 
          WHEN tm.player1_id = v_user.user_id THEN tm.player1_wins
          ELSE tm.player2_wins
        END as opp_losses
      FROM tournament_round_matches tm
      WHERE tm.tournament_id = p_tournament_id
        AND (tm.player1_id = v_user.user_id OR tm.player2_id = v_user.user_id)
        AND tm.series_status = 'completed'
    )
    SELECT COALESCE(AVG(
      CASE 
        WHEN (opp_wins + opp_losses) > 0 THEN (opp_wins::DECIMAL / (opp_wins + opp_losses) * 100)
        ELSE 0
      END
    ), 0)::DECIMAL(5,2) INTO v_ogp
    FROM opponent_gwp;

    RETURN QUERY SELECT 
      v_user.user_id,
      v_total_points,
      v_omp,
      v_gwp,
      v_ogp;
  END LOOP;
END;
$$ LANGUAGE plpgsql;
