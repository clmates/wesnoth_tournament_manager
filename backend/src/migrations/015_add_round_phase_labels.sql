-- Add detailed round description for better UI display
-- This allows us to show "QUARTERFINALS (8→4)" instead of just "final"

ALTER TABLE tournament_rounds 
ADD COLUMN IF NOT EXISTS round_phase_label VARCHAR(50) DEFAULT NULL,
ADD COLUMN IF NOT EXISTS round_phase_description VARCHAR(255) DEFAULT NULL;

-- Update existing rounds with descriptive labels
UPDATE tournament_rounds 
SET round_phase_label = 'GENERAL', round_phase_description = 'General round phase'
WHERE round_type = 'general' AND round_phase_label IS NULL;

UPDATE tournament_rounds 
SET round_phase_label = 'FINAL', round_phase_description = 'Final elimination round'
WHERE round_type = 'final' AND round_phase_label IS NULL;

-- Add index for better query performance
CREATE INDEX IF NOT EXISTS idx_tournament_rounds_phase_label ON tournament_rounds(round_phase_label);
