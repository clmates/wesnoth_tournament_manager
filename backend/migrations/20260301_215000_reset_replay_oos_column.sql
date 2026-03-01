-- Reset oos column for all existing replays.
-- The syncGamesFromForum job was incorrectly converting bit(1) from the forum DB:
-- Buffer objects are always truthy so (game.oos ? 1 : 0) stored 1 for every row.
-- All historical data is corrupted. Reset to 0 so replays can be reprocessed correctly.
UPDATE replays SET oos = 0 WHERE oos = 1 AND parse_status IN ('new', 'rejected', 'parsed');
