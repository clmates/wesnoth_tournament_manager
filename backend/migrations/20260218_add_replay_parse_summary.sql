-- Phase 7 (continued): Add parse_summary column to replays table
-- Stores human-readable summary of parsed replay data

ALTER TABLE replays 
ADD COLUMN parse_summary TEXT AFTER parse_stage;

-- Index for faster lookups
CREATE INDEX idx_parsed_status ON replays(parsed, parse_status);
