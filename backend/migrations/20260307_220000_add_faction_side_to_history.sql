-- Add faction_side to faction_map_statistics_history to mirror faction_map_statistics structure.
-- faction_side: 1=side1, 2=side2 (matches with unknown side default to 1 by convention)
ALTER TABLE faction_map_statistics_history
  ADD COLUMN IF NOT EXISTS faction_side TINYINT NOT NULL DEFAULT 1 AFTER opponent_faction_id;
