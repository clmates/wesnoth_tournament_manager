-- Migration: Add Unranked Tournaments Support
-- Date: 2026-01-12
-- Description: Adds tables and columns for unranked tournament functionality

-- ============================================================================
-- 1. Add is_ranked column to factions table
-- ============================================================================
ALTER TABLE factions ADD COLUMN IF NOT EXISTS is_ranked BOOLEAN DEFAULT TRUE;
COMMENT ON COLUMN factions.is_ranked IS 'true = available for ranked tournaments (default), false = only for unranked tournaments';

-- ============================================================================
-- 2. Add is_ranked column to game_maps table
-- ============================================================================
ALTER TABLE game_maps ADD COLUMN IF NOT EXISTS is_ranked BOOLEAN DEFAULT TRUE;
COMMENT ON COLUMN game_maps.is_ranked IS 'true = available for ranked tournaments (default), false = only for unranked tournaments';

-- ============================================================================
-- 3. Add tournament_type column to tournaments table
-- ============================================================================
ALTER TABLE tournaments ADD COLUMN IF NOT EXISTS tournament_type VARCHAR(20) 
CHECK (tournament_type IN ('ranked', 'unranked', 'team'))
DEFAULT 'ranked';
COMMENT ON COLUMN tournaments.tournament_type IS 'ranked = standard 1v1 with ELO impact, unranked = 1v1 without ELO, team = 2v2 team-based';

-- ============================================================================
-- 4. Add tournament_type column to matches table
-- ============================================================================
ALTER TABLE matches ADD COLUMN IF NOT EXISTS tournament_type VARCHAR(20);
COMMENT ON COLUMN matches.tournament_type IS 'Stores tournament type at match record time for filtering and statistics';

-- Create index for efficient tournament_type queries
CREATE INDEX IF NOT EXISTS idx_matches_tournament_type ON matches(tournament_type);

-- ============================================================================
-- 5. Create tournament_unranked_factions table
-- ============================================================================
CREATE TABLE IF NOT EXISTS tournament_unranked_factions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  faction_id UUID NOT NULL REFERENCES factions(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tournament_id, faction_id)
);

COMMENT ON TABLE tournament_unranked_factions IS 'Links tournaments to their available unranked factions. When tournament is deleted, associations are removed but factions remain.';
COMMENT ON COLUMN tournament_unranked_factions.tournament_id IS 'Foreign key to tournaments table (CASCADE delete)';
COMMENT ON COLUMN tournament_unranked_factions.faction_id IS 'Foreign key to factions table (RESTRICT delete)';

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_tournament_unranked_factions_tournament_id 
  ON tournament_unranked_factions(tournament_id);
CREATE INDEX IF NOT EXISTS idx_tournament_unranked_factions_faction_id 
  ON tournament_unranked_factions(faction_id);

-- ============================================================================
-- 6. Create tournament_unranked_maps table
-- ============================================================================
CREATE TABLE IF NOT EXISTS tournament_unranked_maps (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  map_id UUID NOT NULL REFERENCES game_maps(id) ON DELETE RESTRICT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tournament_id, map_id)
);

COMMENT ON TABLE tournament_unranked_maps IS 'Links tournaments to their available unranked maps. When tournament is deleted, associations are removed but maps remain.';
COMMENT ON COLUMN tournament_unranked_maps.tournament_id IS 'Foreign key to tournaments table (CASCADE delete)';
COMMENT ON COLUMN tournament_unranked_maps.map_id IS 'Foreign key to maps table (RESTRICT delete)';

-- Create indexes for efficient queries
CREATE INDEX idx_tournament_unranked_maps_tournament_id 
  ON tournament_unranked_maps(tournament_id);
CREATE INDEX idx_tournament_unranked_maps_map_id 
  ON tournament_unranked_maps(map_id);
