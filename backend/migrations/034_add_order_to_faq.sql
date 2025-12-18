-- Migration: Add order column to FAQ
-- Created: 2025-12-18
-- Description: Adds numeric order column to faq table for custom sorting

-- ============================================================
-- Add order column to faq table
-- ============================================================
ALTER TABLE faq ADD COLUMN IF NOT EXISTS "order" integer DEFAULT 0;

-- ============================================================
-- Create index for order column
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_faq_order ON faq("order");

-- ============================================================
-- Set initial order based on creation date
-- ============================================================
UPDATE faq SET "order" = ROW_NUMBER() OVER (ORDER BY created_at ASC) WHERE "order" = 0;
