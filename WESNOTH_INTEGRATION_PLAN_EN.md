# Integration Plan: Tournament Manager into Wesnoth

**Creation Date:** February 4, 2026  
**Status:** ✅ FULLY IMPLEMENTED (February 13, 2026)  
**Last Updated:** February 13, 2026

---

## Executive Summary (TL;DR)

✅ **COMPLETE** - Integration of Tournament Manager with Wesnoth is fully implemented. Single migration from PostgreSQL to MariaDB. Single `users_extension` table combining all user data (ratings, security, profiles). Direct phpBB password validation for login. Complete elimination of user registration in Tournament Manager. Auto-population on first login. Username stored as provided by phpBB.

---

## 1. Confirmed Decisions

### 1.1 Database
- ✅ **Single migration** PostgreSQL → MariaDB (no dual support)
- ✅ **Shared database** with existing Wesnoth
- ✅ **`users` table** reused from Wesnoth (phpBB)
- ✅ **Extension tables** separated for Tournament Manager data:
  - `users_extension` (ELO, level, is_rated, wins/losses, trend, matches_played, failed_login_attempts, locked_until, last_login_attempt, password_must_change, country, avatar, language, discord_id)

### 1.2 Authentication
- ✅ **No registration in Tournament Manager** (completely removed)
- ✅ **User creation only in Wesnoth** (phpBB)
- ✅ **Password validation against Wesnoth** via C++ function porting
- ✅ **No password changes** allowed in Tournament Manager (read-only)
- ✅ **Migration of existing users** from Wesnoth users (populate extension tables)

### 1.3 Data and Migration
- ✅ **Filesaves parser** already implemented
- ✅ **Users without Wesnoth user match lose data** (accepted)
- ✅ **Migration of matches, ELO, statistics** to MariaDB tables
- ✅ **Single users_extension table** combines: ratings, security, profile data
- ✅ **Unidirectional synchronization** phpBB → Tournament Manager

### 1.4 Structure
- ✅ **Location in Wesnoth root** as `tournament-manager/` (parallel to `wesnoth-multiplayer-data-dashboard/`)
- ✅ **Independent versioning** with own releases
- ✅ **Frontend on subdomain** (e.g., `ranked.wesnoth.org`)
- ✅ **File storage** pending definition

---

## 2. phpBB Authentication

### 2.1 Database Location
- **Database:** Wesnoth shared MariaDB
- **Table:** `phpbb3_users` (read-only from Tournament Manager)
- **Columns used:** `user_id`, `username`, `user_password`

### 2.2 Authentication Flow
```
Client → POST /api/auth/login {username, password}
    ↓
Query phpbb3_users by username
    ↓
Extract password_hash from phpbb3_users.user_password
    ↓
Validate password against hash (MD5 or Bcrypt)
    ↓
If valid: Check/create users_extension record
    ↓
Generate JWT token
    ↓
Returns: {token, user_data}
```

### 2.3 Supported Hash Algorithms
| Algorithm | Format | Notes |
|-----------|--------|-------|
| **Bcrypt** | `$2a$12$...` | Modern (secure), phpBB 3.1+ |
| **MD5** | `$2a$12$[salt+hash]` | Legacy phpBB, for compatibility |

### 2.4 Node.js Implementation
- Uses `bcryptjs` library for hash validation
- No salt extraction needed (bcryptjs handles it internally)
- Direct hash comparison: `bcryptjs.compare(password, hash_from_db)`

---

## 3. Node.js Implementation Details

### 3.1 Required NPM Dependencies
```bash
npm install bcryptjs        # For hash validation
npm install mysql2/promise  # For phpBB DB connection
```

### 3.2 Authentication Service Implementation

#### Function: Validate phpBB Password
```typescript
async function validatePhpBBPassword(
    passwordPlaintext: string,
    hashFromDB: string
): Promise<boolean> {
    const bcrypt = require('bcryptjs');
    return await bcrypt.compare(passwordPlaintext, hashFromDB);
}
```

#### Function: Get User from phpBB
```typescript
async function getUserFromPhpBB(
    username: string
): Promise<{user_id: string, username: string, user_password: string} | null> {
    const mysql = require('mysql2/promise');
    const connection = await mysql.createConnection({
        host: process.env.WESNOTH_DB_HOST,
        user: process.env.WESNOTH_DB_USER,
        password: process.env.WESNOTH_DB_PASSWORD,
        database: process.env.WESNOTH_DB_NAME
    });
    
    try {
        const [rows] = await connection.execute(
            `SELECT user_id, username, user_password FROM phpbb3_users 
             WHERE username = ? AND user_type = 0`,
            [username]
        );
        connection.end();
        return rows[0] || null;
    } catch (error) {
        connection.end();
        throw error;
    }
}
```

#### Function: Ensure User Extension Exists
```typescript
async function ensureUserExtensionExists(
    phpbbUserId: string,
    username: string
): Promise<void> {
    // Auto-create users_extension record with defaults on first login
    // Updates login metadata on subsequent logins
}
```

---

## 4. Implementation Steps

### Step 1: Configure Wesnoth Database Access
**Database:** Shared MariaDB with Wesnoth  
**Table:** `phpbb3_users` (phpBB user store)  

**Environment variables in `.env.example`:**
```
WESNOTH_DB_HOST=localhost
WESNOTH_DB_USER=wesnoth
WESNOTH_DB_PASSWORD=***
WESNOTH_DB_NAME=wesnoth
WESNOTH_USERS_TABLE=phpbb3_users
```

**Notes:**
- phpBB table contains: user_id, username, user_password (hash)
- user_type field used to filter active users (0 = active, 1+ = inactive/banned)
- Password hashes: Bcrypt (modern) or MD5 (legacy)

### Step 2: Create users_extension Table in MariaDB

**Single Table: `users_extension`** combines ratings, security, and profile data
```sql
CREATE TABLE users_extension (
    id CHAR(36) PRIMARY KEY,
    nickname VARCHAR(255) NOT NULL,
    email VARCHAR(255),
    password_hash VARCHAR(255),
    language VARCHAR(2) DEFAULT 'en',
    discord_id VARCHAR(255),
    elo_rating INT DEFAULT 1400,
    level VARCHAR(50) DEFAULT 'novato',
    is_active TINYINT(1) DEFAULT 0,
    is_blocked TINYINT(1) DEFAULT 0,
    is_admin TINYINT(1) DEFAULT 0,
    is_rated TINYINT(1) DEFAULT 0,
    matches_played INT DEFAULT 0,
    elo_provisional TINYINT(1) DEFAULT 0,
    total_wins INT DEFAULT 0,
    total_losses INT DEFAULT 0,
    trend VARCHAR(10) DEFAULT '-',
    failed_login_attempts INT DEFAULT 0,
    locked_until DATETIME NULL,
    last_login_attempt DATETIME NULL,
    password_must_change TINYINT(1) DEFAULT 0,
    country VARCHAR(2),
    avatar VARCHAR(255),
    email_verified TINYINT(1) DEFAULT 0,
    password_reset_token VARCHAR(255),
    password_reset_expires DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
```

**Key Design:** Single table eliminates complexity of joining ratings, security, and profile tables. User created on first login with default values.

**Deliverable:** Migration file in `backend/migrations/`

### Step 3: Create `wesnothAuth.ts` Module

**Location:** `backend/src/services/wesnothAuth.ts`  
**Functions:**
- `getUserFromPhpBB(username): Promise<phpBBUser | null>` - Query phpBB user
- `validatePhpBBPassword(plaintext, hash): Promise<boolean>` - Hash comparison
- `ensureUserExtensionExists(phpbbUser): Promise<void>` - Auto-create on first login
- `handleLogin(username, password): Promise<LoginResponse>` - Complete login flow

**Deliverable:** Complete module with unit tests

### Step 4: Adapt POST `/api/auth/login` Endpoint

**Location:** `backend/src/routes/auth.ts`  
**Changes:**
1. Receive `{ username, password }`
2. Query phpBB: `const phpbbUser = await getUserFromPhpBB(username)`
3. If null, return 401 "User not found"
4. Validate hash: `const isValid = await validatePhpBBPassword(password, phpbbUser.user_password)`
5. If valid:
   - Ensure users_extension record exists via `ensureUserExtensionExists()`
   - Update login metadata (last_login_attempt, failed_attempts reset)
   - Check maintenance mode and blocking status
   - Generate JWT token
   - Return `{ token, user: { nickname, elo_rating, level, ... } }`

**Deliverable:** Modified endpoint + tests

### Step 5: Remove Registration Endpoints

**Files to modify:**
- `backend/src/routes/auth.ts` - Remove `POST /register`, `POST /verify-email`
- `backend/src/routes/admin.ts` - Remove `registration-requests` endpoints
- `frontend/src/pages/Register.tsx` - Convert to info page or remove

**SQL Changes:**
- Migration executing `DROP TABLE registration_requests CASCADE`
- Remove references in documentation

**Deliverable:** Modified files without registration endpoints

### Step 6: Auto-Population on First Login

**Mechanism:** No separate migration script needed  
**Process:**
1. User attempts login with phpBB credentials
2. Password validated against phpBB hash
3. `ensureUserExtensionExists()` called automatically
4. If new: users_extension record created with default values
5. If exists: metadata updated (last login, attempt counter reset)
6. No manual migration required - users auto-created on first login

**Default Values for New Users:**
- `elo_rating: 1400`
- `level: 'novato'`
- `is_active: true`
- `is_blocked: false`
- `is_admin: false`
- `is_rated: false`
- `matches_played: 0`
- `failed_login_attempts: 0`

**Deliverable:** Auto-population logic embedded in login endpoint

### Step 7: Adapt Structure in Wesnoth Repository

**Location in Wesnoth:** `/tournament-manager/` (root)

**Structure:**
```
wesnoth/
├── tournament-manager/
│   ├── backend/
│   │   ├── src/
│   │   │   ├── routes/
│   │   │   │   ├── auth.ts (modified: no registration)
│   │   │   │   └── ...
│   │   │   ├── services/
│   │   │   │   ├── wesnothAuth.ts (NEW)
│   │   │   │   └── ...
│   │   │   ├── migrations/ (converted to MariaDB)
│   │   │   ├── scripts/
│   │   │   │   └── migrateUsersFromFilesaves.ts (NEW)
│   │   │   └── ...
│   │   ├── package.json (with bcryptjs, mysql2/promise)
│   │   ├── .env.example (with WESNOTH_DB_* vars)
│   │   └── Dockerfile
│   ├── frontend/
│   │   ├── src/
│   │   │   └── pages/
│   │   │       ├── Register.tsx (converted to info or removed)
│   │   │       └── ...
│   │   ├── package.json
│   │   └── Dockerfile
│   ├── migrations/
│   │   └── [SQL MariaDB files]
│   ├── docker-compose.yml (points to shared MariaDB)
│   ├── package.json (workspace root)
│   ├── README.md (how to integrate, run)
│   ├── MAINTAINERS.md
│   ├── MIGRATION_GUIDE.md (explain user flow)
│   └── .env.example
```

**Deliverable:** Folder structure in Wesnoth repository

---

## 5. Technical Implementation Details

### 5.1 Password Hash Validation
- **Library:** `bcryptjs` for both Bcrypt and MD5 validation
- **No salt extraction needed:** bcryptjs.compare() handles internally
- **Direct comparison:** Result of bcryptjs.compare() is definitive

### 5.2 Username Handling
- **Case sensitivity:** phpBB usernames are case-insensitive in login
- **Storage:** Username stored in users_extension as provided by phpBB
- **Lookup:** Query phpBB with exact username from login form

### 5.3 User Status Checks
- **phpBB user_type field:** 0 = active, 1+ = inactive/banned
- **Tournament Manager:** is_blocked flag for additional blocking
- **Maintenance mode:** Checked after phpBB validation

### 5.4 Account Lockout
- **Failed attempts tracking:** In users_extension.failed_login_attempts
- **Timeout:** users_extension.locked_until (timestamp)
- **Reset:** On successful login, failed_attempts set to 0

### 5.5 User Profile Data
- **From phpBB:** user_id, username (all user data)
- **From users_extension:** elo_rating, level, country, language, discord_id, avatar
- **Auto-populated:** On first login with defaults

---

## 6. Risks and Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| phpBB user not found on login | Low | Medium | Clear error message, link to Wesnoth registration |
| Hash format unsupported | Low | High | Unit tests for Bcrypt and MD5 formats |
| Concurrent login attempts | Low | Medium | Database locking mechanisms in place |
| users_extension auto-creation fails | Low | High | Transaction rollback, retry logic |
| phpBB password field empty | Low | High | Validate hash format before comparison |

---

## 7. New Dependencies

### Backend
```json
{
  "dependencies": {
    "bcryptjs": "^2.4.3",
    "mysql2/promise": "^3.x.x",
    "...": "..."
  },
  "devDependencies": {
    "@types/bcryptjs": "^2.4.2",
    "...": "..."
  }
}
```

### Frontend
No new dependencies added (no registration form changes).

---

## 8. Estimated Timeline

| Phase | Duration | Dependencies |
|-------|----------|--------------|
| Phase 1: Investigate Wesnoth (table, function) | 2-3 hours | Access to local Wesnoth repo |
| Phase 2: Create MariaDB tables + migrations | 4-6 hours | Decisions about storage |
| Phase 3: Implement `wesnothAuth.ts` + tests | 8-10 hours | Clarity on HTML escaping, algorithms |
| Phase 4: Adapt endpoints, remove registration | 6-8 hours | Complete login tests |
| Phase 5: User migration script + testing | 6-8 hours | Filesaves parser working |
| Phase 6: Integration in Wesnoth repo | 4-6 hours | Folder structure approved |
| **Total Estimated** | **30-41 hours** | No blockers |

---

## 9. Next Steps (After Approval)

1. ✅ **Review and approve this plan**
2. ⏳ **Get access to local Wesnoth repo** to investigate:
   - Exact phpBB table structure
   - `wesnothd.conf` configuration
   - File storage
3. ⏳ **Start Phase 1** (Wesnoth investigation)
4. ⏳ **Create detailed technical documentation** per phase
5. ⏳ **Phase-by-phase implementation** with testing

---

**Document created:** February 4, 2026  
**Last Updated:** February 13, 2026  
**Status:** ✅ IMPLEMENTATION COMPLETE  
**Author:** Wesnoth Tournament Manager Integration Plan

---

## IMPLEMENTATION COMPLETION SUMMARY

### ✅ All Phases Complete

**Phase 1: Wesnoth Investigation** ✅  
- Identified official phpBB direct query (phpbb3_users table)
- Analyzed phpBB authentication requirements
- Determined case-insensitive username handling

**Phase 2: Database Migration** ✅  
- PostgreSQL to MariaDB migration completed
- `users_extension` table created and populated
- Database schema validated

**Phase 3: Wesnoth Authentication Service** ✅  
- `wesnothAuth.ts` implemented with full phpBB direct query support
- Case-sensitive password validation
- User profile retrieval
- Auto-creation on first login

**Phase 4: Login Endpoint Refactored** ✅  
- All registration/password reset endpoints removed
- Single `/login` endpoint using Wesnoth credentials
- Case-sensitive username handling throughout
- JWT token generation with exact username
- Account blocking and maintenance mode still supported

**Phase 5: Automatic User Population** ✅  
- Auto-creation via `ensureUserExtensionExists()`
- No manual migration needed
- Default values set correctly on first login

**Phase 6: Frontend Migration** ✅  
- Login form updated for username-only input
- API service simplified
- Environment-based configuration
- Registration/password reset UI disabled

### Key Features Implemented

✅ **Direct phpBB Authentication**
- Queries phpbb3_users directly from shared MariaDB
- Password validation using bcryptjs (Bcrypt format)
- No password storage in Tournament Manager
- Future-proof (works with phpBB updates)
- No external protocol dependencies

✅ **Single users_extension Table**
- Consolidates ratings, security, and profile data
- Eliminates JOIN complexity
- Improves query performance
- Cleaner data model

✅ **Production Ready**
- Nginx reverse proxy with SSL/TLS
- CORS properly configured for Cloudflare
- Rate limiting on login endpoints
- Account blocking (is_blocked flag)
- Maintenance mode (system_settings)

### Testing Results

✅ **Backend Tests**
- Login with valid Wesnoth credentials: PASS
- Login with invalid credentials: FAIL (expected)
- Case-sensitive login variations: PASS
- users_extension auto-creation: PASS
- JWT token generation: PASS
- Maintenance mode blocking: PASS
- Account blocking: PASS

✅ **Frontend Tests**
- Login form submits correct data: PASS
- Token stored in localStorage: PASS
- API calls include JWT header: PASS
- 401 errors trigger re-login: PASS
- Case-sensitive usernames work: PASS

✅ **Integration Tests**
- End-to-end login flow: PASS
- No CORS errors: PASS
- Database auto-creation works: PASS
- Token validation succeeds: PASS

### Files Delivered

**Backend:**
- ✅ `backend/src/services/wesnothAuth.ts` - Authentication service
- ✅ `backend/src/services/wesnothMultiplayerClient.ts` - phpBB direct query client
- ✅ `backend/src/routes/auth.ts` - Login endpoint (refactored)
- ✅ `backend/src/middleware/accountLockout.ts` - Account locking support
- ✅ `backend/src/middleware/audit.ts` - Audit logging
- ✅ `backend/scripts/testWesnothClient.js` - Testing utility

**Frontend:**
- ✅ `frontend/src/pages/Login.tsx` - Updated login page
- ✅ `frontend/src/services/api.ts` - Simplified API service
- ✅ `frontend/.env.example` - Configuration template

**Documentation:**
- ✅ `WESNOTH_INTEGRATION_STATUS.md` - Current status and deployment guide
- ✅ `WESNOTH_INTEGRATION_PLAN_EN.md` - This plan (updated)
- ✅ `NGINX_CERTBOT_SETUP_EN.md` - Nginx + SSL configuration
- ✅ `FRONTEND_ENV_CONFIGURATION_EN.md` - Frontend configuration guide

### Production Deployment

The system is ready for production deployment:

1. **Backend**: Listens on `localhost:3000` (not publicly exposed)
2. **Nginx**: Reverse proxy on `wesnoth.org:4443` with SSL/TLS
3. **Frontend**: Cloudflare Pages with auto-detected API URL
4. **Database**: MariaDB with Wesnoth integration
5. **Authentication**: phpBB database password validation

**Deployment Steps:**
1. Install Node.js dependencies
2. Configure `.env` with database credentials
3. Build backend and start on localhost:3000
4. Configure Nginx as reverse proxy
5. Deploy frontend to Cloudflare
6. Test end-to-end login flow

### Known Limitations

- Email/language retrieved from Wesnoth defaults (can be enhanced with forums API)
- No real-time password sync (acceptable - uses phpBB database)
- users_extension auto-created only on first login (by design)

### Future Enhancements

- Wesnoth forums API integration for user profiles
- Statistics synchronization with Wesnoth servers
- Multi-language support for UI
- Mobile app authentication

---

**Implementation Status:** ✅ COMPLETE AND PRODUCTION READY  
**Date Completed:** February 13, 2026  
**Next Phase:** Production Deployment and Monitoring
````


## Phase 7: Automated Replay Detection and Processing

**Status:** 🔲 Design Complete - Ready for Implementation  
**Date:** February 17, 2026  
**Documentation:** See WESNOTH_REPLAY_PROCESSING_EN.md

### Overview

Replace manual replay uploads with server-side automation:
- **File Detection:** inotify watcher on `/var/games/wesnoth/replays/` directory
- **Progressive Parsing:** Quick addon check (< 1s) → Full WML analysis (1-10s)
- **Auto Match Creation:** Replays with tournament addon auto-generate match records
- **Winner Confirmation:** Winners confirm match with comment + opponent rating
- **Match Status Flow:** `auto_reported` → `confirmed`

### Key Components

**Database Changes:**
- New `replays` table: replay_name, replay_path, parsed, need_integration, match_id + timestamps
- Extended `matches`: auto_reported, replay_id, detected_from columns
- New match status: `auto_reported` (transition to `confirmed` via winner confirmation)

**Backend Services:**
- `replayMonitor.ts` - inotify watcher (CREATE, CLOSE_WRITE events)
- `replayParser.ts` - WML parsing with addon filtering
- `parseNewReplays` job - Background cron every 30 seconds
- Confirmation endpoints - Winner/loser validation API

**Implementation Flow:**
```
Replay created on Debian server
    ↓ inotify CLOSE_WRITE event
Insert to replays table (pending)
    ↓ Background job (every 30s)
Stage 1: Quick addon check (< 1s)
    ↓ Tournament addon found?
Set need_integration = 1
    ↓ Stage 2: Full WML parse (1-10s)
Extract: players, factions, map, winner, victory condition
    ↓
Create match: status = 'auto_reported', auto_reported = 1
    ↓ Winner receives notification
Winner confirms with comment + opponent rating
    ↓
Match status = 'confirmed', ELO updated, stats added
```

### Implementation Timeline

| Phase | Component | Duration | Complexity |
|-------|-----------|----------|------------|
| 7A | Database schema | 2 hours | Low |
| 7B | inotify watcher | 4 hours | Medium |
| 7C | WML parser | 8 hours | High |
| 7D | Background job | 4 hours | Medium |
| 7E | Confirmation API | 6 hours | Medium |
| 7F | Frontend UI | 6 hours | Medium |
| **Total** | **All phases** | **30 hours** | - |

### Next Steps (Post Phase-6 Deployment)

1. Finalize tournament addon UUID specification
2. Define victory conditions per tournament format
3. Begin Phase 7A: Database schema implementation
4. Set up Debian replay directory environment
5. Implement and test inotify file watcher
6. Deploy background parsing service

---

**Current Status:** ✅ Phases 1-6 Complete (Production Ready)  
**Next Phase:** 🔲 Phase 7 - Automated Replay Detection and Processing  
**Last Updated:** February 17, 2026
