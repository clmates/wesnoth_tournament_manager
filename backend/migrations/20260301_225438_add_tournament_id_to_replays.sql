-- Add tournament_id column to replays table for direct tournament link
ALTER TABLE replays
  ADD COLUMN IF NOT EXISTS `tournament_id` char(36) DEFAULT NULL AFTER `match_id`,
  ADD KEY IF NOT EXISTS `idx_replay_tournament_id` (`tournament_id`);

-- Backfill tournament_id from parse_summary JSON for existing parsed replays
UPDATE replays
SET tournament_id = JSON_UNQUOTE(JSON_EXTRACT(parse_summary, '$.linkedTournamentId'))
WHERE parse_summary IS NOT NULL
  AND JSON_EXTRACT(parse_summary, '$.linkedTournamentId') IS NOT NULL
  AND JSON_UNQUOTE(JSON_EXTRACT(parse_summary, '$.linkedTournamentId')) != 'null'
  AND tournament_id IS NULL;

-- Backfill tournament_round_match_id from parse_summary JSON for replays where column is null but JSON has it
UPDATE replays
SET tournament_round_match_id = JSON_UNQUOTE(JSON_EXTRACT(parse_summary, '$.linkedTournamentRoundMatchId'))
WHERE parse_summary IS NOT NULL
  AND JSON_EXTRACT(parse_summary, '$.linkedTournamentRoundMatchId') IS NOT NULL
  AND JSON_UNQUOTE(JSON_EXTRACT(parse_summary, '$.linkedTournamentRoundMatchId')) != 'null'
  AND tournament_round_match_id IS NULL;
