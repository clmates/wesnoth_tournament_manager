-- Migration: Add multi-language support to maps and factions
-- Created: 2025-12-18
-- Description: Adds translation tables for game_maps and factions with support for multiple languages

-- ============================================================
-- Create map_translations table
-- ============================================================
CREATE TABLE IF NOT EXISTS map_translations (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  map_id uuid NOT NULL,
  language_code character varying(10) NOT NULL,
  name character varying(255) NOT NULL,
  description text,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (map_id) REFERENCES game_maps(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  UNIQUE(map_id, language_code)
);

-- ============================================================
-- Create faction_translations table
-- ============================================================
CREATE TABLE IF NOT EXISTS faction_translations (
  id uuid DEFAULT gen_random_uuid() NOT NULL,
  faction_id uuid NOT NULL,
  language_code character varying(10) NOT NULL,
  name character varying(255) NOT NULL,
  description text,
  created_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  updated_at timestamp without time zone DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  FOREIGN KEY (faction_id) REFERENCES factions(id) ON DELETE CASCADE ON UPDATE NO ACTION,
  UNIQUE(faction_id, language_code)
);

-- ============================================================
-- Add indexes for performance
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_map_translations_language ON map_translations(language_code);
CREATE INDEX IF NOT EXISTS idx_map_translations_map_id ON map_translations(map_id);
CREATE INDEX IF NOT EXISTS idx_faction_translations_language ON faction_translations(language_code);
CREATE INDEX IF NOT EXISTS idx_faction_translations_faction_id ON faction_translations(faction_id);

-- ============================================================
-- Add is_active flag to existing tables (if not exists)
-- ============================================================
ALTER TABLE game_maps ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;
ALTER TABLE factions ADD COLUMN IF NOT EXISTS is_active boolean DEFAULT true;

-- ============================================================
-- Add indexes for active status queries
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_game_maps_active ON game_maps(is_active);
CREATE INDEX IF NOT EXISTS idx_factions_active ON factions(is_active);
