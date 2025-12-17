-- Add language_code column to news table if it doesn't exist
ALTER TABLE IF EXISTS news
ADD COLUMN IF NOT EXISTS language_code VARCHAR(10) DEFAULT 'en';

-- Create index on language_code for better query performance
CREATE INDEX IF NOT EXISTS idx_news_language_code ON news(language_code);

-- Add unique constraint on (id, language_code) to ensure each news item has one record per language
ALTER TABLE news
ADD CONSTRAINT IF NOT EXISTS news_id_language_unique UNIQUE (id, language_code);

-- Verify the migration
SELECT column_name, data_type, column_default 
FROM information_schema.columns 
WHERE table_name = 'news' AND column_name = 'language_code';
