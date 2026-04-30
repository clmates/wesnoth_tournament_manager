-- Migration: Normalize user nickname case to match forum username
-- Date: 2026-04-30 21:44:16
-- Description: Update existing nicknames from lowercase to original forum case from phpbb3_users.username

UPDATE tournament.users_extension ue
JOIN forum.phpbb3_users u ON LOWER(ue.nickname) = LOWER(u.username)
SET ue.nickname = u.username
WHERE ue.nickname != u.username;
