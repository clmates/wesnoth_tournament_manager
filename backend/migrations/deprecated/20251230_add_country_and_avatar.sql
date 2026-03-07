-- Add country and avatar fields to users table
-- Migration: Add player country and avatar support

ALTER TABLE users ADD COLUMN IF NOT EXISTS country VARCHAR(2);
ALTER TABLE users ADD COLUMN IF NOT EXISTS avatar VARCHAR(255);

-- Create avatars table for available avatars
CREATE TABLE IF NOT EXISTS player_avatars (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name VARCHAR(255) NOT NULL UNIQUE,
  icon_path VARCHAR(500) NOT NULL,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Create countries table with support for multilingual names
CREATE TABLE IF NOT EXISTS countries (
  code VARCHAR(2) PRIMARY KEY,
  names_json JSONB NOT NULL DEFAULT '{}',
  flag_emoji VARCHAR(10),
  official_name VARCHAR(255),
  region VARCHAR(100),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Countries will be inserted via generate_countries_with_translations.py script
-- This provides names in: en, es, de, ru, zh
-- Format: names_json = {"en": "Spain", "es": "España", "de": "Spanien", "ru": "Испания", "zh": "西班牙"}

-- Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_countries_active ON countries(is_active);
CREATE INDEX IF NOT EXISTS idx_player_avatars_active ON player_avatars(is_active);
