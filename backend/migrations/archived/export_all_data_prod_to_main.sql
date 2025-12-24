-- ============================================================
-- WESNOTH TOURNAMENT MANAGER - EXPORT ALL DATA
-- ============================================================
-- Run this in production database to export all data as INSERTs
-- Copy the results and paste into main database
-- ============================================================

-- STEP 1: EXPORT INDEPENDENT TABLES (no dependencies)
-- ============================================================

-- Export users (FIRST - needed by other tables)
(SELECT 'INSERT INTO public.users (id, nickname, email, password_hash, language, discord_id, elo_rating, level, is_active, is_blocked, is_admin, created_at, updated_at, is_rated, matches_played, elo_provisional, total_wins, total_losses, trend) VALUES (' || 
  quote_literal(id) || ', ' || quote_literal(nickname) || ', ' || quote_literal(email) || ', ' || quote_literal(password_hash) || ', ' || 
  quote_literal(language) || ', ' || COALESCE(quote_literal(discord_id), 'NULL') || ', ' || elo_rating || ', ' || quote_literal(level) || ', ' || 
  is_active || ', ' || is_blocked || ', ' || is_admin || ', ' || quote_literal(created_at) || ', ' || quote_literal(updated_at) || ', ' ||
  is_rated || ', ' || matches_played || ', ' || elo_provisional || ', ' || total_wins || ', ' || total_losses || ', ' || quote_literal(trend) || ');'
FROM public.users ORDER BY created_at)

UNION ALL

-- Export factions
(SELECT 'INSERT INTO public.factions (id, name, description, icon_path, created_at) VALUES (' || 
  quote_literal(id) || ', ' || quote_literal(name) || ', ' || COALESCE(quote_literal(description), 'NULL') || ', ' || COALESCE(quote_literal(icon_path), 'NULL') || ', ' || quote_literal(created_at) || ');'
FROM public.factions ORDER BY created_at)

UNION ALL

-- Export game_maps
(SELECT 'INSERT INTO public.game_maps (id, name, created_at, usage_count) VALUES (' || 
  quote_literal(id) || ', ' || quote_literal(name) || ', ' || quote_literal(created_at) || ', ' || usage_count || ');'
FROM public.game_maps ORDER BY created_at)

UNION ALL

-- Export faq
(SELECT 'INSERT INTO public.faq (id, question, answer, language_code, created_at, updated_at) VALUES (' || 
  quote_literal(id) || ', ' || quote_literal(question) || ', ' || quote_literal(answer) || ', ' || quote_literal(language_code) || ', ' || quote_literal(created_at) || ', ' || quote_literal(updated_at) || ');'
FROM public.faq ORDER BY created_at)

UNION ALL

-- Export password_policy
(SELECT 'INSERT INTO public.password_policy (id, min_length, require_uppercase, require_lowercase, require_numbers, require_symbols, previous_passwords_count, updated_at) VALUES (' ||
  quote_literal(id) || ', ' || min_length || ', ' || require_uppercase || ', ' || require_lowercase || ', ' || require_numbers || ', ' || require_symbols || ', ' || previous_passwords_count || ', ' || quote_literal(updated_at) || ');'
FROM public.password_policy)

UNION ALL

-- Export registration_requests
(SELECT 'INSERT INTO public.registration_requests (id, nickname, email, language, discord_id, status, created_at, reviewed_at, reviewed_by) VALUES (' ||
  quote_literal(id) || ', ' || quote_literal(nickname) || ', ' || quote_literal(email) || ', ' || COALESCE(quote_literal(language), 'NULL') || ', ' || COALESCE(quote_literal(discord_id), 'NULL') || ', ' || quote_literal(status) || ', ' || quote_literal(created_at) || ', ' || COALESCE(quote_literal(reviewed_at), 'NULL') || ', ' || COALESCE(quote_literal(reviewed_by), 'NULL') || ');'
FROM public.registration_requests ORDER BY created_at)

UNION ALL

-- Export news
(SELECT 'INSERT INTO public.news (id, title, content, translations, author_id, published_at, created_at, updated_at, language_code) VALUES (' ||
  quote_literal(id) || ', ' || quote_literal(title) || ', ' || quote_literal(content) || ', ' || quote_literal(translations::text) || '::jsonb, ' || quote_literal(author_id) || ', ' || COALESCE(quote_literal(published_at), 'NULL') || ', ' || quote_literal(created_at) || ', ' || quote_literal(updated_at) || ', ' || quote_literal(language_code) || ');'
FROM public.news ORDER BY created_at)

UNION ALL

-- Export online_users
(SELECT 'INSERT INTO public.online_users (id, user_id, last_seen) VALUES (' ||
  quote_literal(id) || ', ' || quote_literal(user_id) || ', ' || quote_literal(last_seen) || ');'
FROM public.online_users ORDER BY last_seen DESC)

UNION ALL

-- Export chat_messages
(SELECT 'INSERT INTO public.chat_messages (id, sender_id, receiver_id, message, is_read, created_at) VALUES (' ||
  quote_literal(id) || ', ' || quote_literal(sender_id) || ', ' || quote_literal(receiver_id) || ', ' || quote_literal(message) || ', ' || is_read || ', ' || quote_literal(created_at) || ');'
FROM public.chat_messages ORDER BY created_at)

UNION ALL

-- Export password_history
(SELECT 'INSERT INTO public.password_history (id, user_id, password_hash, created_at) VALUES (' ||
  quote_literal(id) || ', ' || quote_literal(user_id) || ', ' || quote_literal(password_hash) || ', ' || quote_literal(created_at) || ');'
FROM public.password_history ORDER BY created_at)

UNION ALL

-- STEP 2: EXPORT TOURNAMENT DATA (depends on users)
-- ============================================================

-- Export tournaments
(SELECT 'INSERT INTO public.tournaments (id, name, description, creator_id, status, approved_at, started_at, finished_at, created_at, updated_at, general_rounds, final_rounds, registration_closed_at, prepared_at, tournament_type, max_participants, round_duration_days, auto_advance_round, current_round, total_rounds, general_rounds_format, final_rounds_format) VALUES (' ||
  quote_literal(id) || ', ' || quote_literal(name) || ', ' || quote_literal(description) || ', ' || quote_literal(creator_id) || ', ' || quote_literal(status) || ', ' || COALESCE(quote_literal(approved_at), 'NULL') || ', ' || COALESCE(quote_literal(started_at), 'NULL') || ', ' || COALESCE(quote_literal(finished_at), 'NULL') || ', ' || quote_literal(created_at) || ', ' || quote_literal(updated_at) || ', ' || general_rounds || ', ' || final_rounds || ', ' || COALESCE(quote_literal(registration_closed_at), 'NULL') || ', ' || COALESCE(quote_literal(prepared_at), 'NULL') || ', ' || COALESCE(quote_literal(tournament_type), 'NULL') || ', ' || COALESCE(max_participants::text, 'NULL') || ', ' || round_duration_days || ', ' || auto_advance_round || ', ' || current_round || ', ' || total_rounds || ', ' || quote_literal(general_rounds_format) || ', ' || quote_literal(final_rounds_format) || ');'
FROM public.tournaments ORDER BY created_at)

UNION ALL

-- Export tournament_rounds
(SELECT 'INSERT INTO public.tournament_rounds (id, tournament_id, round_number, match_format, round_status, round_start_date, round_end_date, created_at, updated_at, round_type, round_classification, players_remaining, players_advancing_to_next, round_phase_label, round_phase_description) VALUES (' ||
  quote_literal(id) || ', ' || quote_literal(tournament_id) || ', ' || round_number || ', ' || quote_literal(match_format) || ', ' || quote_literal(round_status) || ', ' || COALESCE(quote_literal(round_start_date), 'NULL') || ', ' || COALESCE(quote_literal(round_end_date), 'NULL') || ', ' || quote_literal(created_at) || ', ' || quote_literal(updated_at) || ', ' || quote_literal(round_type) || ', ' || quote_literal(round_classification) || ', ' || COALESCE(players_remaining::text, 'NULL') || ', ' || COALESCE(players_advancing_to_next::text, 'NULL') || ', ' || COALESCE(quote_literal(round_phase_label), 'NULL') || ', ' || COALESCE(quote_literal(round_phase_description), 'NULL') || ');'
FROM public.tournament_rounds ORDER BY created_at)

UNION ALL

-- Export tournament_participants
(SELECT 'INSERT INTO public.tournament_participants (id, tournament_id, user_id, current_round, status, created_at, participation_status, tournament_ranking, tournament_wins, tournament_losses, tournament_points) VALUES (' ||
  quote_literal(id) || ', ' || quote_literal(tournament_id) || ', ' || quote_literal(user_id) || ', ' || current_round || ', ' || quote_literal(status) || ', ' || quote_literal(created_at) || ', ' || quote_literal(participation_status) || ', ' || COALESCE(tournament_ranking::text, 'NULL') || ', ' || tournament_wins || ', ' || tournament_losses || ', ' || tournament_points || ');'
FROM public.tournament_participants ORDER BY created_at)

UNION ALL

-- STEP 3: EXPORT MATCH DATA (depends on users and tournaments)
-- ============================================================

-- Export matches
(SELECT 'INSERT INTO public.matches (id, winner_id, loser_id, map, winner_faction, loser_faction, winner_comments, winner_rating, loser_comments, loser_rating, loser_confirmed, replay_file_path, tournament_id, elo_change, created_at, updated_at, status, admin_reviewed, admin_reviewed_at, admin_reviewed_by, winner_elo_before, winner_elo_after, loser_elo_before, loser_elo_after, winner_level_before, winner_level_after, loser_level_before, loser_level_after, replay_downloads, winner_ranking_pos, winner_ranking_change, loser_ranking_pos, loser_ranking_change, round_id) VALUES (' ||
  quote_literal(id) || ', ' || quote_literal(winner_id) || ', ' || quote_literal(loser_id) || ', ' || quote_literal(map) || ', ' || quote_literal(winner_faction) || ', ' || quote_literal(loser_faction) || ', ' || COALESCE(quote_literal(winner_comments), 'NULL') || ', ' || COALESCE(winner_rating::text, 'NULL') || ', ' || COALESCE(quote_literal(loser_comments), 'NULL') || ', ' || COALESCE(loser_rating::text, 'NULL') || ', ' || COALESCE(loser_confirmed::text, 'NULL') || ', ' || COALESCE(quote_literal(replay_file_path), 'NULL') || ', ' || COALESCE(quote_literal(tournament_id), 'NULL') || ', ' || COALESCE(elo_change::text, 'NULL') || ', ' || quote_literal(created_at) || ', ' || quote_literal(updated_at) || ', ' || quote_literal(status) || ', ' || admin_reviewed || ', ' || COALESCE(quote_literal(admin_reviewed_at), 'NULL') || ', ' || COALESCE(quote_literal(admin_reviewed_by), 'NULL') || ', ' || winner_elo_before || ', ' || winner_elo_after || ', ' || loser_elo_before || ', ' || loser_elo_after || ', ' || quote_literal(winner_level_before) || ', ' || quote_literal(winner_level_after) || ', ' || quote_literal(loser_level_before) || ', ' || quote_literal(loser_level_after) || ', ' || replay_downloads || ', ' || COALESCE(winner_ranking_pos::text, 'NULL') || ', ' || COALESCE(winner_ranking_change::text, 'NULL') || ', ' || COALESCE(loser_ranking_pos::text, 'NULL') || ', ' || COALESCE(loser_ranking_change::text, 'NULL') || ', ' || COALESCE(quote_literal(round_id), 'NULL') || ');'
FROM public.matches ORDER BY created_at)

UNION ALL

-- Export tournament_round_matches
(SELECT 'INSERT INTO public.tournament_round_matches (id, tournament_id, round_id, player1_id, player2_id, best_of, wins_required, player1_wins, player2_wins, matches_scheduled, series_status, winner_id, created_at, updated_at) VALUES (' ||
  quote_literal(id) || ', ' || quote_literal(tournament_id) || ', ' || quote_literal(round_id) || ', ' || quote_literal(player1_id) || ', ' || quote_literal(player2_id) || ', ' || best_of || ', ' || wins_required || ', ' || player1_wins || ', ' || player2_wins || ', ' || matches_scheduled || ', ' || quote_literal(series_status) || ', ' || COALESCE(quote_literal(winner_id), 'NULL') || ', ' || quote_literal(created_at) || ', ' || quote_literal(updated_at) || ');'
FROM public.tournament_round_matches ORDER BY created_at)

UNION ALL

-- Export tournament_matches
(SELECT 'INSERT INTO public.tournament_matches (id, tournament_id, round_id, player1_id, player2_id, winner_id, match_id, match_status, played_at, created_at, updated_at, tournament_round_match_id) VALUES (' ||
  quote_literal(id) || ', ' || quote_literal(tournament_id) || ', ' || quote_literal(round_id) || ', ' || quote_literal(player1_id) || ', ' || quote_literal(player2_id) || ', ' || COALESCE(quote_literal(winner_id), 'NULL') || ', ' || COALESCE(quote_literal(match_id), 'NULL') || ', ' || quote_literal(match_status) || ', ' || COALESCE(quote_literal(played_at), 'NULL') || ', ' || quote_literal(created_at) || ', ' || quote_literal(updated_at) || ', ' || COALESCE(quote_literal(tournament_round_match_id), 'NULL') || ');'
FROM public.tournament_matches ORDER BY created_at);

-- ============================================================
-- EXECUTION ORDER WHEN IMPORTING TO MAIN:
-- ============================================================
-- 1. Users (independent)
-- 2. Factions (independent)
-- 3. Game Maps (independent)
-- 4. FAQ (independent)
-- 5. Password Policy (independent)
-- 6. Registration Requests (depends on users)
-- 7. News (depends on users)
-- 8. Online Users (depends on users)
-- 9. Chat Messages (depends on users)
-- 10. Password History (depends on users)
-- 11. Tournaments (depends on users)
-- 12. Tournament Rounds (depends on tournaments)
-- 13. Tournament Participants (depends on tournaments and users)
-- 14. Matches (depends on users, tournaments, and tournament_rounds)
-- 15. Tournament Round Matches (depends on tournaments, tournament_rounds, and users)
-- 16. Tournament Matches (depends on tournaments, tournament_rounds, users, and matches)
-- ============================================================
