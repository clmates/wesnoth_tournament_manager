-- Migration 014: Soporte para modos de torneo (Liga, Suizo, Suizo Mixto, Eliminación Mejorada)
-- Adds new fields to support multiple tournament types and configurations

-- ============================================================================
-- 1. ALTER TABLE tournaments - Nuevos campos para modos de torneo
-- ============================================================================

ALTER TABLE tournaments ADD COLUMN (
  -- Tipo de torneo (elimination es el default para backward compatibility)
  tournament_type VARCHAR(20) NOT NULL DEFAULT 'elimination'
    CHECK (tournament_type IN ('elimination', 'league', 'swiss', 'swiss_hybrid')),
  
  -- Configuración Liga (Round Robin)
  league_type VARCHAR(20),  -- 'single_round' | 'double_round'
  
  -- Configuración Suizo
  swiss_rounds INT,  -- Número de rondas suizo
  
  -- Configuración Suizo Mixto
  swiss_hybrid_rounds INT,  -- Rondas suizo en modo híbrido
  
  -- Configuración Eliminación Mejorada
  elimination_type VARCHAR(20),  -- 'single' | 'double' para tipo eliminación
  elimination_matches_dieciseisavos INT DEFAULT 1,  -- Matches dieciseisavos (si aplica)
  elimination_matches_octavos INT DEFAULT 1,        -- Matches octavos de final
  elimination_matches_cuartos INT DEFAULT 1,        -- Matches cuartos de final
  elimination_matches_semis INT DEFAULT 1,          -- Matches semifinales
  elimination_matches_final INT DEFAULT 1,          -- Matches FINAL (puede ser distinto)
  
  -- Configuración General
  finalists_count INT,  -- Cuántos avanzan (16, 8, 4 para suizo_hybrid)
  points_win INT DEFAULT 3,
  points_loss INT DEFAULT 0,
  points_bye INT DEFAULT 1,
  
  -- Configuración Series
  series_format_swiss VARCHAR(3),  -- 'bo1' | 'bo3' | 'bo5' para suizo
  series_format_finals VARCHAR(3),  -- 'bo1' | 'bo3' | 'bo5' para finales/eliminación
  
  -- Configuración Desempates (Liga/Suizo)
  tiebreaker_1 VARCHAR(20) DEFAULT 'points',  -- 'points' | 'head_to_head' | 'set_diff'
  tiebreaker_2 VARCHAR(20),
  tiebreaker_3 VARCHAR(20),
  
  -- Timestamps para fases completadas
  league_final_standings_at TIMESTAMP,
  swiss_final_standings_at TIMESTAMP
);

-- ============================================================================
-- 2. ALTER TABLE tournament_rounds - Campos para metadata de rondas
-- ============================================================================

ALTER TABLE tournament_rounds ADD COLUMN (
  -- Tipo de ronda
  round_type VARCHAR(30) NOT NULL DEFAULT 'regular'
    CHECK (round_type IN ('regular', 'octavos', 'cuartos', 'semifinal', 'final', 'dieciseisavos')),
  
  -- Orden dentro de la fase de eliminación
  round_order_in_phase INT,
  
  -- Información para suizo
  is_bye_round BOOLEAN DEFAULT FALSE,
  max_points_possible INT,
  
  -- Snapshot del ranking después de esta ronda
  standings_snapshot JSON,
  
  -- Cuántos jugadores avanzan a la siguiente fase
  promoted_count INT
);

-- ============================================================================
-- 3. CREATE TABLE tournament_standings
-- ============================================================================

CREATE TABLE IF NOT EXISTS tournament_standings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tournament_id INT NOT NULL,
  tournament_round_id INT NOT NULL,
  player_id INT NOT NULL,
  
  -- Estadísticas generales
  matches_played INT DEFAULT 0,
  matches_won INT DEFAULT 0,
  matches_lost INT DEFAULT 0,
  sets_won INT DEFAULT 0,
  sets_lost INT DEFAULT 0,
  
  -- Puntuación
  total_points INT DEFAULT 0,
  
  -- Ranking
  current_rank INT,
  previous_rank INT,
  
  -- Timestamps
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (tournament_id) REFERENCES tournaments(tournament_id),
  FOREIGN KEY (tournament_round_id) REFERENCES tournament_rounds(tournament_round_id),
  FOREIGN KEY (player_id) REFERENCES players(player_id),
  
  UNIQUE KEY unique_round_player (tournament_round_id, player_id),
  INDEX idx_tournament_rank (tournament_id, current_rank),
  INDEX idx_player_tournament (player_id, tournament_id)
);

-- ============================================================================
-- 4. CREATE TABLE swiss_pairings
-- ============================================================================

CREATE TABLE IF NOT EXISTS swiss_pairings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tournament_id INT NOT NULL,
  tournament_round_id INT NOT NULL,
  
  player1_id INT NOT NULL,
  player2_id INT NOT NULL,
  
  -- Matchup result (NULL = not played yet)
  winner_id INT,
  match_status VARCHAR(20) DEFAULT 'pending'
    CHECK (match_status IN ('pending', 'completed', 'cancelled')),
  
  -- Linked match
  tournament_match_id INT,
  
  -- Metadata
  pairing_number INT,
  table_number INT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (tournament_id) REFERENCES tournaments(tournament_id),
  FOREIGN KEY (tournament_round_id) REFERENCES tournament_rounds(tournament_round_id),
  FOREIGN KEY (player1_id) REFERENCES players(player_id),
  FOREIGN KEY (player2_id) REFERENCES players(player_id),
  FOREIGN KEY (tournament_match_id) REFERENCES tournament_matches(tournament_match_id),
  
  INDEX idx_tournament_round (tournament_id, tournament_round_id),
  INDEX idx_status (match_status)
);

-- ============================================================================
-- 5. CREATE TABLE league_standings
-- ============================================================================

CREATE TABLE IF NOT EXISTS league_standings (
  id INT AUTO_INCREMENT PRIMARY KEY,
  tournament_id INT NOT NULL,
  player_id INT NOT NULL,
  
  -- Posición en la liga
  league_position INT,
  
  -- Estadísticas de liga
  league_matches_played INT DEFAULT 0,
  league_matches_won INT DEFAULT 0,
  league_matches_lost INT DEFAULT 0,
  league_sets_won INT DEFAULT 0,
  league_sets_lost INT DEFAULT 0,
  league_total_points INT DEFAULT 0,
  
  -- Desempates
  head_to_head_record VARCHAR(50),
  set_difference INT,
  
  -- Timestamp
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (tournament_id) REFERENCES tournaments(tournament_id),
  FOREIGN KEY (player_id) REFERENCES players(player_id),
  
  UNIQUE KEY unique_tournament_player (tournament_id, player_id),
  INDEX idx_tournament_position (tournament_id, league_position)
);

-- ============================================================================
-- Índices adicionales para performance
-- ============================================================================

ALTER TABLE tournaments 
  ADD INDEX idx_tournament_type (tournament_type),
  ADD INDEX idx_tournament_status (tournament_status, tournament_type);

ALTER TABLE tournament_rounds 
  ADD INDEX idx_round_type (round_type),
  ADD INDEX idx_tournament_round_type (tournament_id, round_type);

-- ============================================================================
-- Constraint checks para validación
-- ============================================================================

-- Validar que se usan los campos correctos según tournament_type
-- Esto se puede validar en la aplicación también para mejor UX

-- ============================================================================
-- Migration notes:
-- - Backward compatible: tournament_type DEFAULT 'elimination'
-- - Existing tournaments seguirán funcionando sin cambios
-- - Nuevos campos son NULLABLE o tienen sensible DEFAULTs
-- - Se pueden comenzar nuevos torneos con nuevos tipos inmediatamente
-- ============================================================================
