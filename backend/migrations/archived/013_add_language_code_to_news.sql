-- Add language_code column to news table for multi-language support
-- This migration allows storing news in multiple languages as separate records

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'news' AND column_name = 'language_code'
  ) THEN
    ALTER TABLE news ADD COLUMN language_code VARCHAR(10) DEFAULT 'en';
  END IF;
END
$$;

-- Add index on language_code for faster queries
CREATE INDEX IF NOT EXISTS idx_news_language_code ON news(language_code);

-- Add composite unique constraint for id + language_code (optional but recommended)
-- This ensures we have one record per language per news item
ALTER TABLE news ADD CONSTRAINT news_id_language_unique UNIQUE (id, language_code);
