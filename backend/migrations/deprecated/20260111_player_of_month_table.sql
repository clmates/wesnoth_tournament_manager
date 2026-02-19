-- Create player_of_month table to store monthly top earner
CREATE TABLE IF NOT EXISTS public.player_of_month (
  id SERIAL PRIMARY KEY,
  player_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  nickname VARCHAR(255) NOT NULL,
  elo_rating INTEGER NOT NULL,
  ranking_position INTEGER NOT NULL,
  elo_gained INTEGER NOT NULL DEFAULT 0,
  positions_gained INTEGER NOT NULL DEFAULT 0,
  month_year DATE NOT NULL, -- First day of the month
  calculated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create unique index to ensure only one record per month
CREATE UNIQUE INDEX IF NOT EXISTS idx_player_of_month_month ON player_of_month(month_year);

-- Create index on player_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_player_of_month_player_id ON player_of_month(player_id);

SELECT 'Migration: Created player_of_month table' AS migration_info;
