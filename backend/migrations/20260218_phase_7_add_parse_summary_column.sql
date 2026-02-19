-- Phase 7b: Add parse_summary column to replays table
-- Contains readable human-friendly summary of parsed replay data

ALTER TABLE replays 
ADD COLUMN parse_summary TEXT AFTER parse_error_message,
ADD INDEX idx_parse_summary (parse_summary(100));

-- Example summary format:
-- "Map: Caves of the Basilisk | Players: matto (Undead) vs Haldiel (Drakes) | Era: Ladder Test Era (ladder_test_era) | Victory: Leadership Kill | Add-ons: Rav_Color_Mod, Ladder_Test_Era"
