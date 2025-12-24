# API Endpoints Reference

**Última actualización:** 2025-12-24  
*Actualiza este archivo cada vez que se añada, modifique o elimine un endpoint.*

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
- [GET] /api/public/maps — Public — List all active maps (is_active = true)
- [GET] /api/public/factions — Public — List all active factions (is_active = true)

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
- [GET] /api/matches/:id — Private — Get match details.

Admin routes
- [GET] /api/admin/registration-requests — Private — List pending registration requests
- [POST] /api/admin/registration-requests/:id/approve — Private — Approve registration (requires password)
- [POST] /api/admin/registration-requests/:id/reject — Private — Reject registration
- [GET] /api/admin/users — Private — List all users
- [POST] /api/admin/users/:id/block — Private — Block user
- [POST] /api/admin/users/:id/unblock — Private — Unblock user
- [POST] /api/admin/users/:id/unlock — Private — Unlock user account
- [POST] /api/admin/users/:id/make-admin — Private — Grant admin role
- [POST] /api/admin/users/:id/remove-admin — Private — Remove admin role
- [DELETE] /api/admin/users/:id — Private — Delete user
- [POST] /api/admin/users/:id/force-reset-password — Private — Force password reset
- [POST] /api/admin/recalculate-all-stats — Private — Recalculate all stats
- [GET] /api/admin/audit-logs — Private — Get audit logs (optional params)
- [DELETE] /api/admin/audit-logs — Private — Delete audit logs (by logIds)
- [DELETE] /api/admin/audit-logs/old — Private — Delete old audit logs (by daysBack)
- [PUT] /api/admin/password-policy — Private — Update password policy
- [GET] /api/admin/news — Private — List news
- [POST] /api/admin/news — Private — Create news
- [PUT] /api/admin/news/:id — Private — Update news
- [DELETE] /api/admin/news/:id — Private — Delete news
- [GET] /api/admin/faq — Private — List FAQ
- [POST] /api/admin/faq — Private — Create FAQ
- [PUT] /api/admin/faq/:id — Private — Update FAQ
- [DELETE] /api/admin/faq/:id — Private — Delete FAQ

## Maps & Factions Endpoints

### Admin Maps
- [GET] /api/admin/maps — Private — List all maps
- [GET] /api/admin/maps/:mapId/translations — Private — Get translations for a map
- [POST] /api/admin/maps — Private — Create new map
- [POST] /api/admin/maps/:mapId/translations — Private — Add/update translation for a map
- [DELETE] /api/admin/maps/:mapId — Private — Delete map (checks if used in matches)

### Admin Factions
- [GET] /api/admin/factions — Private — List all factions
- [GET] /api/admin/factions/:factionId/translations — Private — Get translations for a faction
- [POST] /api/admin/factions — Private — Create new faction
- [POST] /api/admin/factions/:factionId/translations — Private — Add/update translation for a faction
- [DELETE] /api/admin/factions/:factionId — Private — Delete faction (checks if used in matches)

---

## Ejemplo de formato para cada endpoint

- **[METHOD] /path** — (Public/Private) — params — Descripción

### Request
```json
{
  // Ejemplo de body o parámetros
}
```
### Response
```json
{
  // Ejemplo de respuesta
}
```

---

# Endpoints con ejemplos

### [POST] /api/auth/register — Public — body: {nickname, email, password, language?, discord_id?} — Register a new user.
**Request:**
```json
{
  "nickname": "player1",
  "email": "player1@email.com",
  "password": "securepass",
  "language": "es",
  "discord_id": "123456789"
}
```
**Response:**
```json
{
  "success": true,
  "userId": "abc123",
  "token": "jwt-token-string"
}
```

### [POST] /api/auth/login — Public — body: {nickname, password} — Authenticate and return token + userId.
**Request:**
```json
{
  "nickname": "player1",
  "password": "securepass"
}
```
**Response:**
```json
{
  "success": true,
  "userId": "abc123",
  "token": "jwt-token-string"
}
```

### [GET] /api/public/tournaments?page=1&name=&status=&type= — Public — query: page, name, status, type — List public tournaments.
**Request:**
```http
GET /api/public/tournaments?page=1&name=Summer&status=in_progress&type=elimination
```
**Response:**
```json
{
  "data": [
    {
      "id": "t1",
      "name": "Summer Cup",
      "status": "in_progress",
      "type": "elimination"
    }
  ],
  "page": 1,
  "total": 10
}
```

### [POST] /api/matches/report — Private — multipart/form-data — Report a match with replay upload.
**Request:**
```http
POST /api/matches/report
Content-Type: multipart/form-data

{
  "opponent_id": "user2",
  "map": "Weldyn Channel",
  "winner_faction": "Drakes",
  "loser_faction": "Undead",
  "comments": "Good game!",
  "rating": 5,
  "replay": "file.wesnoth"
}
```
**Response:**
```json
{
  "success": true,
  "match_id": "m123"
}
```

### [POST] /api/matches/:id/confirm — Private — params: id — body: {action: 'confirm'|'dispute', comments?, rating?}
**Request:**
```json
{
  "action": "confirm",
  "comments": "No issues",
  "rating": 4
}
```
**Response:**
```json
{
  "success": true,
  "status": "confirmed"
}
```

### [GET] /api/users/profile — Private — none — Get profile of current authenticated user.
**Response:**
```json
{
  "id": "abc123",
  "nickname": "player1",
  "email": "player1@email.com",
  "language": "es",
  "discord_id": "123456789"
}
```

### [GET] /api/tournaments/:id — Public — params: id — Get tournament full details.
**Response:**
```json
{
  "id": "t1",
  "name": "Summer Cup",
  "status": "in_progress",
  "rounds": 5,
  "participants": ["player1", "player2"]
}
```

### [POST] /api/tournaments/:tournamentId/matches/:matchId/result — Private — body: {winner_id, reported_match_id?}
**Request:**
```json
{
  "winner_id": "player1",
  "reported_match_id": "m123"
}
```
**Response:**
```json
{
  "success": true,
  "match_id": "m123",
  "status": "completed"
}
```

### [GET] /api/matches/disputed/all — Private — admin only — List all disputed matches for admin review.
**Response:**
```json
{
  "matches": [
    {
      "id": "m123",
      "status": "disputed",
      "players": ["player1", "player2"],
      "map": "Weldyn Channel"
    }
  ]
}
```

### [GET] /api/public/faq — Public — none — Retrieve all FAQ entries.
**Response:**
```json
{
  "question": "¿Cómo reporto una partida?",
  "answer": "Usa el botón Report Match en la página de partidas.",
  "language": "es"
}
```

### [GET] /api/public/news — Public — none — List all news/announcements.
**Response:**
```json
{
  "id": "n1",
  "title": "Nuevo torneo disponible",
  "content": "Inscríbete ya!",
  "language": "es"
}
```

### [GET] /api/public/matches/recent — Public — none — Recent confirmed matches.
**Response:**
```json
{
  "id": "m123",
  "winner": "player1",
  "loser": "player2",
  "map": "Weldyn Channel",
  "date": "2025-12-23T18:00:00Z"
}
```

### [GET] /api/public/players — Public — query: pagination + filters — Players directory.
**Response:**
```json
{
  "players": [
    {
      "id": "abc123",
      "nickname": "player1",
      "elo": 1500,
      "matches": 20
    }
  ],
  "page": 1,
  "total": 100
}
```

### [GET] /api/users/:id/stats — Public — params: id — Get aggregated stats for a user.
**Response:**
```json
{
  "id": "abc123",
  "wins": 10,
  "losses": 5,
  "elo": 1500
}
```

### [GET] /api/users/:id/matches — Public — params: id — Get recent matches for a user.
**Response:**
```json
{
  "id": "m123",
  "winner": "player1",
  "loser": "player2",
  "map": "Weldyn Channel",
  "date": "2025-12-23T18:00:00Z"
}
```

### [GET] /api/tournaments/:id/participants — Public — params: id — List participants for a tournament.
**Response:**
```json
{
  "id": "abc123",
  "nickname": "player1",
  "status": "active"
}
```

### [GET] /api/tournaments/:id/matches — Public — params: id — List tournament matches.
**Response:**
```json
{
  "id": "tm1",
  "player1": "player1",
  "player2": "player2",
  "status": "pending"
}
```

### [POST] /api/tournaments/:id/join — Private — none — Join a tournament.
**Response:**
```json
{
  "success": true,
  "participant_id": "p123"
}
```

### [POST] /api/tournaments/:tournamentId/participants/:participantId/accept — Private — organizer only — Accept a pending participant.
**Response:**
```json
{
  "success": true,
  "status": "approved"
}
```

### [POST] /api/tournaments/:id/close-registration — Private — organizer only — Close registration.
**Response:**
```json
{
  "success": true,
  "status": "registration_closed"
}
```

### [POST] /api/tournaments/:id/prepare — Private — organizer only — Generate tournament rounds.
**Response:**
```json
{
  "success": true,
  "rounds_created": 5
}
```

### [POST] /api/tournaments/:id/start — Private — organizer only — Start tournament.
**Response:**
```json
{
  "success": true,
  "status": "in_progress"
}
```

### [GET] /api/tournaments/:tournamentId/rounds/:roundId/matches — Public — params: tournamentId, roundId — List matches for a round.
**Response:**
```json
{
  "id": "tm1",
  "player1": "player1",
  "player2": "player2",
  "status": "pending"
}
```

### [POST] /api/matches/admin/:id/dispute — Private — Admin validates or rejects dispute.
**Request:**
```json
{
  "action": "validate"
}
```
**Response:**
```json
{
  "success": true,
  "status": "validated"
}
```

### [POST] /api/matches/:matchId/replay/download-count — Private — Increment replay download count.
**Response:**
```json
{
  "success": true,
  "downloads": 11
}
```

### [GET] /api/matches/:id — Private — Get match details.
**Response:**
```json
{
  "id": "m123",
  "winner": "player1",
  "loser": "player2",
  "map": "Weldyn Channel",
  "status": "confirmed"
}
```

### [GET] /api/admin/users — Private — List all users.
**Response:**
```json
{
  "id": "abc123",
  "nickname": "player1",
  "email": "player1@email.com",
  "status": "active"
}
```

### [POST] /api/admin/users/:id/block — Private — Block user.
**Response:**
```json
{
  "success": true,
  "status": "blocked"
}
```

### [POST] /api/admin/news — Private — Create news.
**Request:**
```json
{
  "title": "Nuevo torneo disponible",
  "content": "Inscríbete ya!",
  "language": "es"
}
```
**Response:**
```json
{
  "success": true,
  "news_id": "n1"
}
```

### [POST] /api/admin/faq — Private — Create FAQ.
**Request:**
```json
{
  "question": "¿Cómo reporto una partida?",
  "answer": "Usa el botón Report Match en la página de partidas.",
  "language": "es"
}
```
**Response:**
```json
{
  "success": true,
  "faq_id": "f1"
}
```

Notes:
- Many endpoints require authentication via Bearer token (middleware `authMiddleware`).
- Admin routes additionally verify `is_admin` in DB.
- Tournament and match endpoints interoperate: when reporting a match tied to a tournament match (tournament_id + tournament_match_id), the server updates tournament_matches, tournament_participants stats, and Best-Of series state.

If you want, I can expand each endpoint with example requests and sample responses, or generate a machine-readable OpenAPI (Swagger) spec next.