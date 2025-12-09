API Endpoints (summary)

Format: [METHOD] /path  — (Public/Private) — params — Short description

Source: canonical mapping is `frontend/src/services/api.ts` (the frontend service wrappers). Use that file for the exact query parameter names used by the UI.

Auth
- [POST] /api/auth/register — Public — body: {nickname, email, password, language?, discord_id?} — Register a new user.
- [POST] /api/auth/login — Public — body: {nickname, password} — Authenticate and return token + userId.
- [POST] /api/auth/change-password — Private — body: {oldPassword, newPassword} — Change current user's password.

Public API (no auth)
- [GET] /api/public/faq — Public — none — Retrieve all FAQ entries (all languages). Frontend applies user language with EN fallback.
- [GET] /api/public/tournaments?page=1&name=&status=&type= — Public — query: page, name, status, type — List public tournaments (supports pagination and filters).
- [GET] /api/public/tournaments/:id — Public — params: id — Get tournament details (public view).
- [GET] /api/public/tournaments/:id/participants — Public — params: id — List participants for a tournament.
- [GET] /api/public/tournaments/:id/matches — Public — params: id — List tournament matches (public view).
- [GET] /api/public/news — Public — none — List all news/announcements (all languages). Frontend applies user language with EN fallback.
- [GET] /api/public/matches/recent — Public — none — Recent confirmed matches.
- [GET] /api/public/players?page=1&nickname=&min_elo=&max_elo=&min_matches=&rated_only= — Public — query: pagination + filters — Players directory (supports pagination and filter query params).
- [GET] /api/public/matches?page=1 — Public — query: page — List public matches (paginated).

User routes
- [GET] /api/users/profile — Private — none — Get profile of current authenticated user.
- [PUT] /api/users/profile/discord — Private — body: {discord_id} — Update current user's Discord ID.
- [GET] /api/users/:id/stats — Public — params: id — Get aggregated stats for a user (wins/losses/elo).
- [GET] /api/users/:id/matches — Public — params: id — Get recent matches for a user (limit 20).
- [GET] /api/users/search/:searchQuery — Public — params: searchQuery — Search users by nickname (ILIKE).
- [GET] /api/users/ranking/global?page=1&nickname=&min_elo=&max_elo= — Public — query: page + optional filters — Global ranking list (supports paging and basic filters used by UI).
- [GET] /api/users/ranking/active?page=1 — Public — query: page — Active ranking (recently active players).
- [GET] /api/users/all — Public — none — Get all active users (for opponent selection).

Tournament routes
- [POST] /api/tournaments — Private — body: tournament creation fields (name, description, tournament_type, max_participants, round_duration_days, auto_advance_round, general_rounds, final_rounds, general_rounds_format, final_rounds_format) — Create a tournament (organizer).
- [GET] /api/tournaments/my — Private — none — Get tournaments created by current user.
- [GET] /api/tournaments/:id — Public — params: id — Get tournament full details (organizer id, status, rounds counts etc.).
- [PUT] /api/tournaments/:id — Private — body: fields to update — Update tournament configuration (organizer only).
- [GET] /api/tournaments/:id/rounds — Public — params: id — Get tournament rounds (list).
- [GET] /api/tournaments — Public — query: page — Get all tournaments (public view: approved/in_progress/finished), supports pagination.
- [POST] /api/tournaments/:id/join — Private — none — Join a tournament (immediate accepted join).
- [POST] /api/tournaments/:id/request-join — Private — none — Request to join tournament (creates pending participant).
- [POST] /api/tournaments/:tournamentId/participants/:participantId/accept — Private — organizer only — Accept a pending participant.
- [POST] /api/tournaments/:tournamentId/participants/:participantId/reject — Private — organizer only — Reject a pending participant.
- [GET] /api/tournaments/:id/ranking — Public — params: id — Get tournament ranking (participants ordered by points/wins).
- [POST] /api/tournaments/:id/close-registration — Private — organizer only — Close registration (moves status to registration_closed).
- [POST] /api/tournaments/:id/prepare — Private — organizer only — Generate tournament rounds based on configuration (must be registration_closed).
- [POST] /api/tournaments/:id/start — Private — organizer only — Start tournament (activate first round, create rounds if missing).
- [GET] /api/tournaments/:tournamentId/rounds/:roundId/matches — Public — params: tournamentId, roundId — List individual tournament_matches for a specific round.
- [GET] /api/tournaments/:tournamentId/round-matches — Public — params: tournamentId — List tournament_round_matches (Best-Of series summary), includes player1_wins/player2_wins, best_of, series_status.
- [GET] /api/tournaments/:tournamentId/matches — Public — params: tournamentId — List all tournament_matches (individual matches) with player nicknames, reported status.
- [POST] /api/tournaments/:tournamentId/matches/:matchId/result — Private — params: tournamentId, matchId — body: {winner_id, reported_match_id?} — Record result for a tournament match (used by UI organizer/player to mark tournament match completed and trigger round completion checks).
- [POST] /api/tournaments/:tournamentId/matches/:matchId/determine-winner — Private — organizer only — body: {winner_id} — Organizer manually sets match winner (no ELO impact).
- [POST] /api/tournaments/:id/next-round — Private — organizer only — Activate the next configured round (after previous completed).

Match routes
- [POST] /api/matches/report-json — Private — body: {opponent_id, map, winner_faction, loser_faction, comments?, rating?, tournament_id?, tournament_match_id?} — Report a match result (JSON, no file). If tournament_id & tournament_match_id provided, links to tournament match and updates Best-Of series and participants stats.
- [POST] /api/matches/report — Private — multipart/form-data with optional replay file and same body fields as report-json — Report a match with replay upload.
- [POST] /api/matches/:id/confirm — Private — params: id — body: {action: 'confirm'|'dispute', comments?, rating?} — Loser confirms or disputes a match result.
- [GET] /api/matches/disputed/all — Private — admin only — List all disputed matches for admin review.
- [GET] /api/matches/pending/all — Private — admin only — List all pending/unconfirmed matches.
- [GET] /api/matches/pending/user — Private — Get pending matches for current user (as winner or loser).
- [POST] /api/matches/admin/:id/dispute — Private — admin only — body: {action: 'validate'|'reject'} — Admin resolves disputed match (validate will cancel and rebuild stats globally).
- [GET] /api/matches/:matchId/replay/download — Public/Private — params: matchId — Download replay file for a match (if exists).
- [POST] /api/matches/:matchId/replay/download-count — Public — params: matchId — Increment replay download count for analytics.
- [GET] /api/matches?page=1&winner=&loser=&map=&status=&confirmed= — Private — query: pagination + filters — List matches (supports pagination and filtering parameters used by the UI).

Admin routes (prefix /api/admin)
- [GET] /api/admin/users — Private — admin only — List all users.
- [GET] /api/admin/registration-requests — Private — admin — List pending registration requests.
- [POST] /api/admin/registration-requests/:id/approve — Private — admin — body: {password} — Approve registration and create user (unrated).
- [POST] /api/admin/registration-requests/:id/reject — Private — admin — Reject registration request.
- [POST] /api/admin/users/:id/block — Private — admin — Block a user.
- [POST] /api/admin/users/:id/unblock — Private — admin — Unblock a user.
- [POST] /api/admin/users/:id/make-admin — Private — admin — Grant admin rights.
- [POST] /api/admin/users/:id/remove-admin — Private — admin — Revoke admin rights.
- [DELETE] /api/admin/users/:id — Private — admin — Delete a user.
- [POST] /api/admin/users/:id/force-reset-password — Private — admin — Force password reset and return temp password.
- [PUT] /api/admin/password-policy — Private — admin — Update password policy settings.
- [POST] /api/admin/news — Private — admin — Create news/announcement with all 5 languages (body: {en: {title, content}, es: {title, content}, zh: {title, content}, de: {title, content}, ru: {title, content}}).
- [PUT] /api/admin/news/:id — Private — admin — Update news with all 5 languages (replaces all language versions).
- [DELETE] /api/admin/news/:id — Private — admin — Delete news (removes all language versions).
- [GET] /api/admin/news — Private — admin — List news (returns all language versions grouped by ID).
- [GET] /api/admin/faq — Private — admin — List FAQ entries (returns all language versions grouped by ID).
- [POST] /api/admin/faq — Private — admin — Create FAQ entry with all 5 languages (body: {en: {question, answer}, es: {question, answer}, zh: {question, answer}, de: {question, answer}, ru: {question, answer}}).
- [PUT] /api/admin/faq/:id — Private — admin — Update FAQ entry with all 5 languages (replaces all language versions).
- [DELETE] /api/admin/faq/:id — Private — admin — Delete FAQ (removes all language versions).
- [POST] /api/admin/recalculate-all-stats — Private — admin — Recalculate all stats globally by replaying matches.

Notes:
- Many endpoints require authentication via Bearer token (middleware `authMiddleware`).
- Admin routes additionally verify `is_admin` in DB.
- Tournament and match endpoints interoperate: when reporting a match tied to a tournament match (tournament_id + tournament_match_id), the server updates tournament_matches, tournament_participants stats, and Best-Of series state.

If you want, I can expand each endpoint with example requests and sample responses, or generate a machine-readable OpenAPI (Swagger) spec next.