-- Global Statistics Cache Table
-- Stores aggregated site-wide statistics for fast retrieval
-- Updated periodically by the GlobalStatisticsCalculatorJob

CREATE TABLE IF NOT EXISTS global_statistics (
  id CHAR(36) PRIMARY KEY DEFAULT (UUID()),
  statistic_key VARCHAR(100) NOT NULL UNIQUE,
  statistic_value BIGINT NOT NULL DEFAULT 0,
  last_updated DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  calculated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_statistic_key (statistic_key),
  INDEX idx_last_updated (last_updated)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Insert default entries for all statistics
INSERT INTO global_statistics (statistic_key, statistic_value) VALUES
  ('users_total', 0),
  ('users_active', 0),
  ('users_ranked', 0),
  ('users_new_month', 0),
  ('users_new_year', 0),
  ('matches_today', 0),
  ('matches_week', 0),
  ('matches_month', 0),
  ('matches_year', 0),
  ('matches_total', 0),
  ('tournament_matches_month', 0),
  ('tournament_matches_year', 0),
  ('tournament_matches_total', 0),
  ('tournaments_month', 0),
  ('tournaments_year', 0),
  ('tournaments_total', 0)
ON DUPLICATE KEY UPDATE statistic_value = VALUES(statistic_value);
