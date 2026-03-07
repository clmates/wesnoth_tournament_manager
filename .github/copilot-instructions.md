# 🏆 Wesnoth Tournament Manager — Copilot Instructions

## Overview
Advanced web manager for competitive Wesnoth tournaments. Features:
- Player registration and authentication (integrated with wesnoth.org phpBB forum)
- Tournament creation and management (Elimination, League, Swiss, Mixed; ranked and unranked; 1v1 and 2v2)
- Match reporting, confirmation and dispute handling with dynamic ELO
- Multi-language admin panel (EN, ES, DE, RU, ZH) 
- Discord integration for notifications
- Automatic replay processing from the Wesnoth forum/game-server database
- Default language for all documentation, code and commit comments is english.

---

## Tech Stack (CURRENT)
- **Frontend**: React 18+ (TypeScript), Vite, Zustand, i18n, Tailwind CSS → deployed on **Cloudflare Pages**
- **Backend**: Node.js + Express (TypeScript) → deployed on **wesnoth.org** server (managed by the wesnoth.org team; we have no control over the server infrastructure)
- **Database**: **MariaDB** — two schemas: `tournament` (app data) and `forum` (phpBB + wesnothd_game tables)
- **Authentication**: phpBB forum users (`phpbb3_users` table), JWT
- **Replay processing**: Periodic background jobs that read from `wesnothd_game_*` forum tables and parse replay files directly from the replay server filesystem

> ⚠️ The app was migrated from Supabase/PostgreSQL to MariaDB. Old `.env.example` files and legacy docs may reference Supabase/Railway/PostgreSQL — ignore them. The current reality is MariaDB on wesnoth.org.

---

## Project Structure
```
├── backend/                # REST API (TypeScript + Express)
│   ├── src/
│   │   ├── routes/         # API endpoints
│   │   ├── services/       # Business logic
│   │   ├── jobs/           # Cron jobs (forum sync, replay parsing)
│   │   ├── types/          # TypeScript interfaces
│   │   └── config/         # DB, auth, etc.
│   └── migrations/         # SQL scripts (MariaDB)
├── frontend/               # React SPA
│   ├── src/
│   │   ├── pages/          # Main views
│   │   ├── components/     # Reusable components
│   │   ├── services/       # API calls (api.ts)
│   │   ├── store/          # State management (Zustand)
│   │   └── i18n/           # Translations (EN, ES, DE, ZH)
├── testing/                # Test scripts
└── .github/                # GitHub / Copilot configuration
```

---

## Database — Dual Schema Architecture

### `tournament` schema (app data)
- `users_extension` — extended player profile (ELO, stats, roles)
- `matches` — direct matches (ranked/unranked)
- `tournaments`, `tournament_participants`, `tournament_rounds`, `tournament_matches`, 'tournament_teams', 'tournament_round_matches'
- `replays` — discovered replays registry + parse status
- `game_maps`, `factions`, `balance_events`, `player_match_statistics`
- `system_settings` — dynamic config (e.g. `replay_last_check_timestamp`)
- `migrations` — executed migrations control

### `forum` schema (phpBB + Wesnoth game server)
- `phpbb3_users` — forum users (authentication)
- `wesnothd_game_info` — game metadata from the Wesnoth game server
- `wesnothd_game_player_info` — players per game
- `wesnothd_game_content_info` — active addons/mods (type `modification` for the Ranked addon)

---

## Replay Processing Flow

1. **SyncGamesFromForumJob** (every 60s): queries `wesnothd_game_info` WHERE `END_TIME > lastCheckTimestamp` and `ADDON_ID = 'Ranked'` (type=`modification`), inserts records into `replays` table with `parse_status='new'`
2. **ParseNewReplaysRefactoredJob** (every 30s): reads `replays` WHERE `parse_status='new'`, loads the `.bz2` file directly from `REPLAY_BASE_PATH/version/YYYY/MM/DD/filename` on the replay server filesystem, parses WML
3. **Parser** (`replayRankedParser.ts`): decompresses bz2, looks for `ranked_mode="yes"` in `[carryover_sides_start][variables]`, extracts players from `[old_side1]`/`[old_side2]`, detects surrender via `[fire_event] raise="menu item surrender"` + `[input] value=2`
4. If `tournament="none"` → confidence=2 (auto-confirms match). If `tournament` has a value → confidence=1 (manual confirmation required)

> Replays are **never uploaded by users**. They are read directly from the replay server filesystem where the backend is co-located.

---

## Key User Flows
- **Player**: Register → Login → Report match → Confirm/dispute → View rankings
- **Player in tournament**: Join tournament → Report round match → Confirm/dispute
- **Organizer**: Create tournament → Configure → Manage participants → Advance rounds → Close
- **Admin**: All of the above + moderate disputes + user management

---

## Roles and Permissions
- **Tournament organizer**: Defines rules, advances rounds, forces results on abandonment or resolved disputes
- **Player**: Join, report, confirm/dispute matches, view stats
- **Admin**: Everything + create/edit/delete tournaments, manage users, resolve disputes

---

## Match Types
- **Direct matches**: Outside of any tournament. Simple bilateral flow (report → confirm/dispute)
- **Tournament matches**: Tied to tournament rounds and rules
- **Disputes**: Only admins can resolve disputes; players can report and dispute but cannot make final decisions

---

## Required Data for Match Reporting
- Map, each player's faction, participating players
- Replay file is **not uploaded** — matches are auto-created from replay server processing
- Manual reporting (without replay) is also supported for cases not covered by auto-processing

---

## Main State Machines
- **Tournaments**: `registration_open` → `in_progress` → `completed`
- **Participants**: `pending` → `approved` → `active` → `eliminated`
- **Matches**: `pending_confirmation` → `confirmed` / `disputed` → `completed`

---

## Migration Convention
- **Format**: `yyyymmdd_hhmmss_short_description.sql` (e.g. `20260115_222737_add_ranking_columns_tournament_teams.sql`)
- **Location**: `backend/migrations/`
- **Auto-execution**: Migrations run automatically on server startup (`backend/src/services/migrationRunner.ts`)
- **Rule**: Use `IF NOT EXISTS` / `IF EXISTS` to make them idempotent

---

## Internationalisation (i18n)
- Translations in `frontend/src/i18n/` (EN, ES, DE, RU, ZH)
- Adding a language: create JSON file and register it in `i18n.ts`
- Fallback support and in-app editing via admin panel

---

## Authentication and State
- JWT stored in localStorage
- Zustand for global state (user, admin, language, etc.)
- Authentication middleware in backend

---

## Deployment
- **Backend**: wesnoth.org server — managed by the wesnoth.org team; we do not control the server infrastructure
- **Frontend**: Cloudflare Pages (auto-deploy from `main` branch)
- **Deploy script**: `production_deploy.ps1` (merges main → production branch)
- **Environment variables**: `.env` files — never commit to version control

---

## Reference Files
- `API_ENDPOINTS.md` — API endpoint reference
- `DB_SCHEMA.md` / `DB_SCHEMA_EN.md` — Database schema
- `NAV_INDEX_EN.md` — Frontend navigation ↔ API index

---

## Useful Commands
```bash
# Backend
cd backend && npm install && npm run dev

# Frontend
cd frontend && npm install && npm run dev
```

---

## Copilot-Specific Instructions

### Workflow
- **Use the best AI model for each task.**, for example GPT 4.1 or GPT 5-mini for git commands. Claude Haiku for simple tasks or corrections, Claude Sonnet for complex requirements.
- **Never execute code without prior confirmation.** First evaluate the request, clearly explain the proposed change, and wait for confirmation before executing.
- **Ask about any doubts before proceeding.** Clarify all open questions before proposing a plan.
- **Do not create analysis files or documentation unless explicitly requested.** Propose any files you plan to create and wait for confirmation.

### Git
- **Never run git commands (commit, merge, push, etc.) automatically.** Only describe the command and its purpose; do not execute unless explicitly asked.

### Files and Configuration
- **Do not modify `.env`, `.gitignore`, or other critical config files without confirmation.**
- **Do not delete files or folders without explicit authorization.**
- **Always ask before destructive or irreversible actions.**

### Code
- **No code duplication.** Prioritize refactoring and reusable components over duplicating logic.
- **Strict TypeScript** throughout the project.
- **Conditional debug logs**:
  - Frontend: guard with `VITE_DEBUG_LOGS` (`true` → print, `false` → suppress)
  - Backend: guard with `BACKEND_DEBUG_LOGS` (`true` → print, `false` → suppress)

### Living Documentation (keep updated on changes)
- `API_ENDPOINTS.md` — update whenever an endpoint is added, modified, or removed
- `DB_SCHEMA.md` — update whenever the database structure changes
- `NAV_INDEX_EN.md` — update whenever navigation structure or options change
