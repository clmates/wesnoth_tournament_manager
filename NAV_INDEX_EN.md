Navigation-oriented API Index

This index is organized following the app navigation (Navbar as entry point). For each screen/page it lists the frontend page, where it appears in nav, and the API endpoints the page calls (with purpose).

Note (canonical locations)
- Routes are registered in `frontend/src/App.tsx` (React Router `Routes`/`Route`).
- Navbar links are in `frontend/src/components/Navbar.tsx`.
- Frontend ↔ backend mapping (query param names, endpoints used by UI) is in `frontend/src/services/api.ts`.

Navbar (global links)
- Home → `/` (page: `frontend/src/pages/Home.tsx`)
- Players → `/players` (page: `frontend/src/pages/Players.tsx`)
- Rankings → `/rankings` (page: `frontend/src/pages/Rankings.tsx`)
- Tournaments → `/tournaments` (page: `frontend/src/pages/Tournaments.tsx`)
- Matches → `/matches` (page: `frontend/src/pages/Matches.tsx`)
- FAQ → `/faq` (page: `frontend/src/pages/FAQ.tsx`)
- (Auth links) Login/Register → `/login`, `/register`
- Report Match (authenticated) → `/report-match` (page: `frontend/src/pages/ReportMatch.tsx`)
- User/Profile → `/user` (page: `frontend/src/pages/User.tsx`)

Home (`/`) — `frontend/src/pages/Home.tsx`
- Calls:
  - `userService.getGlobalRanking()` → [GET] `/api/users/ranking/global` — show top players on home (supports `page` and basic ranking filters).
  - `publicService.getRecentMatches()` → [GET] `/api/public/matches/recent` — show recent matches.
  - `publicService.getTournaments()` → [GET] `/api/public/tournaments` — show featured / latest tournaments (supports `page` and filters).
  - `userService.getMatches()` / `matchService` used for lists when authenticated.
- Purpose: Landing, quick stats, recent activity.

Players (`/players`) — `frontend/src/pages/Players.tsx`
- Calls:
  - `publicService.getAllPlayers(page, filters)` → [GET] `/api/public/players` — players directory list (supports `page` and filters: `nickname`, `min_elo`, `max_elo`, `min_matches`, `rated_only`).
  - `userService.getUserStats(userId)` → [GET] `/api/users/:id/stats` (on player card/profile) — show player stats.
- Notes: The UI applies client-side debounce to filter inputs and sends requests using the query params above.
- Purpose: Browse players and inspect a player's recent results.

Rankings (`/rankings`) — `frontend/src/pages/Rankings.tsx`
- Calls:
  - `userService.getGlobalRanking(page, filters)` → [GET] `/api/users/ranking/global` — global ranking (supports `page`, `nickname`, `min_elo`, `max_elo`).
  - Optionally `matchService.getPendingMatches` for additional context.
- Notes: Filters use the same debounce pattern as Players; the frontend sends filter values as query params.
- Purpose: Leaderboards.

Tournaments list (`/tournaments`) — `frontend/src/pages/Tournaments.tsx`
- Calls:
  - `publicService.getTournaments(page, filters)` → [GET] `/api/public/tournaments` — list tournaments (public view), supports `page`, `name`, `status`, `type` query params.
  - `tournamentService.getMyTournaments()` → [GET] `/api/tournaments/my` (if viewing own area).
- Notes: Tournaments page also debounces filter inputs in the UI before sending requests.
- Purpose: Browse and open tournament details.

Tournament Detail (`/tournament/:id`) — `frontend/src/pages/TournamentDetail.tsx`
- Calls (on load via `fetchTournamentData`):
  - `publicService.getTournamentById(id)` → [GET] `/api/public/tournaments/:id` — tournament meta/details.
  - `publicService.getTournamentParticipants(id)` → [GET] `/api/public/tournaments/:id/participants` — participants list.
  - `tournamentService.getTournamentMatches(id)` → [GET] `/api/tournaments/:tournamentId/matches` — individual tournament matches.
  - `tournamentService.getTournamentRoundMatches(id)` → [GET] `/api/tournaments/:tournamentId/round-matches` — Best-Of series summary (player wins, best_of, series_status).
  - `tournamentService.getTournamentRounds(id)` → [GET] `/api/tournaments/:id/rounds` — rounds metadata.
- Actions available in UI and corresponding endpoints:
  - Create tournament (MyTournaments page) → `tournamentService.createTournament()` → [POST] `/api/tournaments`.
  - Join tournament → `tournamentService.joinTournament(id)` → [POST] `/api/tournaments/:id/join`.
  - Request join (pending) → `tournamentService.requestJoinTournament(id)` → [POST] `/api/tournaments/:id/request-join`.
  - Close registration → `tournamentService.updateTournament(id, {status:'registration_closed'})` (calls [PUT] `/api/tournaments/:id`).
  - Prepare tournament → `tournamentService.updateTournament(id, {status:'prepared'})` (PUT), or `POST /api/tournaments/:id/prepare` (organizer) — server generates rounds.
  - Start tournament → `tournamentService.startTournament(id)` → [POST] `/api/tournaments/:id/start`.
  - Accept/Reject participants → [POST] `/api/tournaments/:tournamentId/participants/:participantId/accept` and `/reject`.
  - Report tournament match (via Report modal) → `matchService.reportMatch` → [POST] `/api/matches/report` or `report-json` endpoint; after report the client calls `tournamentService.recordMatchResult(tournamentId, matchId, {winner_id, reported_match_id})` → [POST] `/api/tournaments/:tournamentId/matches/:matchId/result`.
  - Determine match winner (organizer) → `tournamentService.determineMatchWinner(tournamentId, matchId, {winner_id})` → [POST] `/api/tournaments/:tournamentId/matches/:matchId/determine-winner`.
  - Activate next round (organizer) → `tournamentService.updateTournament(...)` or `POST /api/tournaments/:id/next-round`.

My Tournaments (`/my-tournaments`) — `frontend/src/pages/MyTournaments.tsx`
- Calls:
  - `tournamentService.getMyTournaments()` → [GET] `/api/tournaments/my` — list of tournaments created by current user.
  - `tournamentService.createTournament(data)` → [POST] `/api/tournaments` — create new tournament.
  - `tournamentService.joinTournament(id)` → [POST] `/api/tournaments/:id/join` — join a tournament from list.
- Purpose: Organizer dashboard and actions.

Matches (`/matches`) — `frontend/src/pages/Matches.tsx`
- Calls:
  - `matchService.getAllMatches(page, filters)` → [GET] `/api/matches` (auth required) — list matches (supports paging and filters: `winner`, `loser`, `map`, `status`, `confirmed`).
  - `matchService.getPendingMatches()` → [GET] `/api/matches/pending/user` — user's pending matches.
  - Admin pages call `/matches/pending/all` and `/matches/disputed/all`.
- Purpose: View and confirm/dispute matches.

Report Match (`/report-match`) — `frontend/src/pages/ReportMatch.tsx`
- Calls:
  - `userService.getAllUsers()` → [GET] `/api/users/all` — opponent selector.
  - `matchService.reportMatch(data)` → [POST] `/api/matches/report` — report match (with optional replay file).
  - Alternatively `POST /api/matches/report-json` is used by scripts/tests.
- Purpose: Report a non-tournament or tournament match.

Profile / User (`/user`) — `frontend/src/pages/User.tsx` and `Profile.tsx`
- Calls:
  - `userService.getProfile()` → [GET] `/api/users/profile` — get current user profile.
  - `userService.getUserStats(userId)` → [GET] `/api/users/:id/stats` — aggregated stats.
  - `userService.getRecentMatches(userId)` → [GET] `/api/users/:id/matches` — recent matches.
  - `userService.updateDiscordId(discordId)` → [PUT] `/api/users/profile/discord` — update discord id.

FAQ (`/faq`) — `frontend/src/pages/FAQ.tsx`
- Calls:
  - `publicService.getFaqByLanguage(lang)` → [GET] `/api/public/faq?language=xx` — fetch FAQ entries.
  - Admin FAQ page uses admin endpoints `/api/admin/faq` for CRUD.

Admin area (`/admin` and subpages) — `frontend/src/pages/Admin*.tsx`
- Calls (admin-only):
  - `adminService.getRegistrationRequests()` → [GET] `/api/admin/registration-requests`.
  - `adminService.approveRegistration(id, password)` → [POST] `/api/admin/registration-requests/:id/approve`.
  - `adminService.getAllUsers()` → [GET] `/api/admin/users`.
  - `adminService.recalculateAllStats()` → [POST] `/api/admin/recalculate-all-stats`.
  - News/FAQ admin pages use `/api/admin/news` and `/api/admin/faq` endpoints for CRUD.

Notes & guidance
- All frontend service wrappers are in `frontend/src/services/api.ts`. Use it as canonical mapping from UI to back-end endpoints.
- Pages that expose table filters (Players, Rankings, Tournaments) use a client-side debounce: the UI updates an intermediate input state immediately and applies filters after a short delay — the values are sent as query params to the endpoints above.
- Most pages call multiple endpoints on load (see `fetchTournamentData` in `TournamentDetail.tsx` for an example of how multiple calls are made in parallel).
- If you want, I can convert this index into a clickable markdown with direct links to source lines where each call occurs.

---
Generated by scanning `frontend/src/services/api.ts`, `frontend/src/App.tsx` and page files in `frontend/src/pages`. If you want a machine-readable spec (OpenAPI/Swagger) or a CSV/JSON export of endpoints/navigation, tell me which format and I will generate it.