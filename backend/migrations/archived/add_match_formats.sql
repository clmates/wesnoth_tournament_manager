-- Add match format columns to tournaments table
ALTER TABLE tournaments 
  ADD COLUMN IF NOT EXISTS general_rounds_format VARCHAR(10) DEFAULT 'bo3' CHECK (general_rounds_format IN ('bo1', 'bo3', 'bo5')),
  ADD COLUMN IF NOT EXISTS final_rounds_format VARCHAR(10) DEFAULT 'bo5' CHECK (final_rounds_format IN ('bo1', 'bo3', 'bo5'));

-- Create indexes for the new columns
CREATE INDEX IF NOT EXISTS idx_tournaments_formats ON tournaments(general_rounds_format, final_rounds_format);
