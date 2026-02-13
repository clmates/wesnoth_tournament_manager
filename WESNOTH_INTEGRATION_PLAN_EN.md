# Integration Plan: Tournament Manager into Wesnoth

**Creation Date:** February 4, 2026  
**Status:** ✅ FULLY IMPLEMENTED (February 13, 2026)  
**Last Updated:** February 13, 2026

---

## Executive Summary (TL;DR)

✅ **COMPLETE** - Integration of Tournament Manager with Wesnoth is fully implemented. Single migration from PostgreSQL to shared MariaDB. Reuse of Wesnoth `users` table (phpBB). Login validation using WML protocol against official Wesnoth multiplayer server. Complete elimination of user registration in Tournament Manager. Auto-creation of users on first login. Case-insensitive username handling throughout the system.

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
- ✅ **Unidirectional synchronization** Wesnoth → Tournament Manager

### 1.4 Structure
- ✅ **Location in Wesnoth root** as `tournament-manager/` (parallel to `wesnoth-multiplayer-data-dashboard/`)
- ✅ **Independent versioning** with own releases
- ✅ **Frontend on subdomain** (e.g., `ranked.wesnoth.org`)
- ✅ **File storage** pending definition

---

## 2. Wesnoth C++ Function: `fuh::login()`

### 2.1 Location
- **Header File:** `src/server/common/forum_user_handler.hpp`
- **Implementation File:** `src/server/common/forum_user_handler.cpp`
- **Class:** `fuh` (Forum User Handler) inherits from `user_handler`

### 2.2 Function Signature
```cpp
bool fuh::login(const std::string& name, const std::string& password) {
    // Retrieves hash from DB (phpbb3_users.user_password)
    // Validates hash is valid (MD5 or bcrypt)
    // Compares password_hash_sent === hash_db
    // Returns true if match, false if not
}
```

### 2.3 Related Methods Needed
```cpp
std::string fuh::extract_salt(const std::string& name)
// Extracts salt from stored hash
// MD5: first 12 characters
// Bcrypt: uses bcryptjs library

std::string fuh::get_hashed_password_from_db(const std::string& user)
// Gets user_password directly from phpbb3_users table
```

### 2.4 Supported Algorithms
| Algorithm | Format | Versions | Notes |
|-----------|--------|----------|-------|
| **MD5** | `$2a$12$[salt+hash]` | Classic phpBB | 12 character salt, variable iterations |
| **Bcrypt** | `$2a$12$...` | Modern (secure) | $2a$, $2b$, $2x$, $2y$ supported |

### 2.5 Wesnoth Authentication Flow
```
Client → username + password plaintext
    ↓
server::authenticate()
    ↓
extract_salt(username)  [retrieves from DB]
    ↓
hash_password(password, salt, username)  [REHASHES with same algorithm]
    ↓
fuh::login(username, password_hashed)  [COMPARES HASHES]
    ↓
Returns: true/false
```

---

## 3. Node.js Porting Strategy

### 3.1 Option A: HTTP Endpoint (Encapsulation)
**Advantage:** Centralizes logic in Wesnoth C++, higher security  
**Disadvantage:** Requires changes to Wesnoth server, network latency  
**Effort:** High (modify C++)  
**Recommendation:** ❌ Not recommended (complicates integration)

### 3.2 Option B: Node.js Porting (RECOMMENDED)
**Advantage:** Self-contained, low latency, full control  
**Disadvantage:** Duplicates hash logic  
**Effort:** Medium (hash logic with libraries)  
**Recommendation:** ✅ Implement this option

### 3.3 Option B Porting - Technical Details

#### Required NPM Dependencies
```bash
npm install bcryptjs        # For bcrypt validation/generation
npm install mysql2/promise  # For connection to Wesnoth DB
```

#### `wesnothAuth.ts` Module (Pseudocode)
```typescript
// Function 1: Extract salt from stored hash
function extractSalt(hashString: string): string {
    // MD5: return first 12 characters
    if (!hashString.startsWith("$2")) {
        return hashString.substring(0, 12);
    }
    // Bcrypt: already integrated in hash string, return complete
    return hashString;
}

// Function 2: Validate password against hash
async function validateWesnothPassword(
    passwordPlaintext: string,
    hashFromDB: string,
    username: string
): Promise<boolean> {
    // Extract salt
    const salt = extractSalt(hashFromDB);
    
    // Rehash with same algorithm
    const hashedPassword = await hashPasswordWesnoth(
        passwordPlaintext,
        salt
    );
    
    // Direct comparison
    return hashedPassword === hashFromDB;
}

// Function 3: Rehash password with Wesnoth algorithm
async function hashPasswordWesnoth(
    plaintext: string,
    salt: string
): Promise<string> {
    // Escape HTML (as phpBB does)
    let password = plaintext
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");
    
    if (salt.startsWith("$2")) {
        // BCRYPT
        const bcrypt = require('bcryptjs');
        return await bcrypt.hash(password, salt);
    } else {
        // MD5 (legacy)
        const crypto = require('crypto');
        const hash = crypto.createHash('md5');
        hash.update(password + salt);
        return salt + hash.digest('base64');
    }
}

// Function 4: Get password hash from Wesnoth DB
async function getPasswordHashFromWesnoth(
    username: string
): Promise<string | null> {
    const mysql = require('mysql2/promise');
    
    const connection = await mysql.createConnection({
        host: process.env.WESNOTH_DB_HOST,
        user: process.env.WESNOTH_DB_USER,
        password: process.env.WESNOTH_DB_PASSWORD,
        database: process.env.WESNOTH_DB_NAME
    });
    
    try {
        const [rows] = await connection.execute(
            `SELECT user_password FROM ${process.env.WESNOTH_USERS_TABLE} 
             WHERE UPPER(username) = UPPER(?)`,
            [username]
        );
        
        connection.end();
        return rows[0]?.user_password || null;
    } catch (error) {
        connection.end();
        throw new Error(`Failed to get password hash for ${username}: ${error.message}`);
    }
}
```

---

## 4. Implementation Steps

### Step 1: Investigate Wesnoth Configuration
**File:** `wesnothd.conf` (Wesnoth server)  
**Variables to find:**
- `db_users_table` - phpBB table name (default: `phpbb3_users`)
- `db_extra_table` - Wesnoth custom table
- DB credentials (host, user, password, database)

**Deliverable:** Environment variables in `.env.example`:
```
WESNOTH_DB_HOST=localhost
WESNOTH_DB_USER=wesnoth
WESNOTH_DB_PASSWORD=***
WESNOTH_DB_NAME=wesnoth
WESNOTH_USERS_TABLE=phpbb3_users
```

### Step 2: Create Extension Tables in MariaDB

**Table: `user_ratings`**
```sql
CREATE TABLE user_ratings (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(255) NOT NULL UNIQUE,
    elo_rating INT DEFAULT 1200,
    level VARCHAR(50),
    is_rated BOOLEAN DEFAULT FALSE,
    elo_provisional BOOLEAN DEFAULT FALSE,
    total_wins INT DEFAULT 0,
    total_losses INT DEFAULT 0,
    trend VARCHAR(5) DEFAULT '-',
    matches_played INT DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE
);
```

**Table: `user_security`**
```sql
CREATE TABLE user_security (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(255) NOT NULL UNIQUE,
    failed_login_attempts INT DEFAULT 0,
    locked_until TIMESTAMP NULL,
    last_login_attempt TIMESTAMP NULL,
    password_must_change BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE
);
```

**Table: `user_profiles`**
```sql
CREATE TABLE user_profiles (
    id INT PRIMARY KEY AUTO_INCREMENT,
    username VARCHAR(255) NOT NULL UNIQUE,
    country VARCHAR(2),
    avatar VARCHAR(255),
    language VARCHAR(10) DEFAULT 'en',
    discord_id VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (username) REFERENCES users(username) ON DELETE CASCADE
);
```

**Deliverable:** MariaDB migration files in `backend/src/migrations/`

### Step 3: Create `wesnothAuth.ts` Module

**Location:** `backend/src/services/wesnothAuth.ts`  
**Functions:**
- `extractSalt(hashString): string`
- `validateWesnothPassword(plaintext, hash, username): Promise<boolean>`
- `hashPasswordWesnoth(plaintext, salt): Promise<string>`
- `getPasswordHashFromWesnoth(username): Promise<string | null>`

**Deliverable:** Complete module with unit tests

### Step 4: Adapt POST `/api/auth/login` Endpoint

**Location:** `backend/src/routes/auth.ts`  
**Changes:**
1. Receive `{ username, password }`
2. Get hash: `const hashFromDB = await getPasswordHashFromWesnoth(username)`
3. If null, return 401 "User not found"
4. Validate: `const isValid = await validateWesnothPassword(password, hashFromDB, username)`
5. If valid:
   - Create/update row in `user_ratings` (if not exists)
   - Create/update row in `user_security` (reset failed_attempts)
   - Create/update row in `user_profiles` (if not exists)
   - Generate JWT token
   - Return `{ token, user: { username, elo_rating, ... } }`

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

### Step 6: Create User Migration Script

**Location:** `backend/src/scripts/migrateUsersFromFilesaves.ts` or similar  
**Logic:**
1. Filesaves parser (existing) obtains user list + data
2. For each user:
   - Search Wesnoth `users` table by username
   - If exists: insert/update in `user_ratings`, `user_profiles`, `user_security`
   - If not exists: register as "not migrated" in log
3. Return statistics: X users migrated, Y lost

**Execution:** 
```bash
npm run migrate:users
```

**Deliverable:** Executable script + documentation

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

## 5. Pending Technical Considerations

### 5.1 HTML Escaping of Password
**Question:** Does plaintext password from client need HTML escaping before hashing?
- Wesnoth function escapes: `&` → `&amp;`, `"` → `&quot;`, `<` → `&lt;`, `>` → `&gt;`
- Should Tournament Manager do the same?
- **Recommendation:** Yes, replicate escaping in `hashPasswordWesnoth()`

### 5.2 Exact phpBB Table
**Question:** Is table name hardcoded `phpbb3_users` or configurable?
- Variable in `wesnothd.conf`: `db_users_table`
- **Recommendation:** Make configurable via `.env` (WESNOTH_USERS_TABLE)

### 5.3 Password Change Synchronization
**Question:** If user changes password in Wesnoth, does Tournament Manager use new hash automatically?
- Yes, because each login calls `getPasswordHashFromWesnoth()` (fetch current hash)
- No additional synchronization needed
- **Recommendation:** Automatically implemented without changes

### 5.4 Active/Banned Users
**Question:** Verify if user is banned in Wesnoth?
- phpBB has `user_type` field (0=normal, 1=inactive, 2=ignored)
- **Recommendation:** Check in login: `WHERE user_type = 0`

### 5.5 File Storage
**Pending definition:** Where to save replays, uploads?
- Option A: `tournament-manager/uploads/` local
- Option B: Reuse existing Wesnoth storage
- Option C: Cloud storage (S3, etc.)
- **Recommendation:** Define based on Wesnoth infrastructure

---

## 6. Risks and Mitigations

| Risk | Probability | Impact | Mitigation |
|------|-------------|--------|-----------|
| MD5 vs Bcrypt hash incompatibility | Medium | High | Unit tests for both algorithms |
| phpBB table structure change in future | Low | Medium | Document table contract, version |
| Data loss for users without Wesnoth match | High | Low | Communicate pre-migration, backup first |
| Query performance to Wesnoth DB | Low | Medium | Indexes on `users(username)`, JWT caching |
| Password change synchronization | Low | Low | Fetch on each login, no sync needed |

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
- Identified official WML protocol (server.wesnoth.org:15000)
- Analyzed phpBB authentication requirements
- Determined case-insensitive username handling

**Phase 2: Database Migration** ✅  
- PostgreSQL to MariaDB migration completed
- `users_extension` table created and populated
- Database schema validated

**Phase 3: Wesnoth Authentication Service** ✅  
- `wesnothAuth.ts` implemented with full WML protocol support
- Case-insensitive password validation
- User profile retrieval
- Auto-creation on first login

**Phase 4: Login Endpoint Refactored** ✅  
- All registration/password reset endpoints removed
- Single `/login` endpoint using Wesnoth credentials
- Case-insensitive username handling throughout
- JWT token generation with normalized username
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

✅ **Case-Insensitive Login**
- Username normalized to lowercase: `ClmateS` → `clmates`
- All database lookups use `LOWER(username) = LOWER($1)`
- JWT tokens contain normalized username
- Transparent to users - any case variation works

✅ **WML Protocol Authentication**
- Validates against official Wesnoth server (server.wesnoth.org:15000)
- Supports MD5 (legacy) and Bcrypt (modern) password hashes
- No password storage in Tournament Manager
- Future-proof (works with Wesnoth updates)

✅ **Production Ready**
- Nginx reverse proxy with SSL/TLS
- CORS properly configured
- Rate limiting on login attempts
- Audit logging of authentication events
- Account blocking still functional
- Maintenance mode supported

### Testing Results

✅ **Backend Tests**
- Login with valid Wesnoth credentials: PASS
- Login with invalid credentials: FAIL (expected)
- Case-insensitive login variations: PASS
- users_extension auto-creation: PASS
- JWT token generation: PASS
- Maintenance mode blocking: PASS
- Account blocking: PASS

✅ **Frontend Tests**
- Login form submits correct data: PASS
- Token stored in localStorage: PASS
- API calls include JWT header: PASS
- 401 errors trigger re-login: PASS
- Case-insensitive usernames work: PASS

✅ **Integration Tests**
- End-to-end login flow: PASS
- No CORS errors: PASS
- Database auto-creation works: PASS
- Token validation succeeds: PASS

### Files Delivered

**Backend:**
- ✅ `backend/src/services/wesnothAuth.ts` - Authentication service
- ✅ `backend/src/services/wesnothMultiplayerClient.ts` - WML protocol client
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
5. **Authentication**: Official WML protocol validation

**Deployment Steps:**
1. Install Node.js dependencies
2. Configure `.env` with database credentials
3. Build backend and start on localhost:3000
4. Configure Nginx as reverse proxy
5. Deploy frontend to Cloudflare
6. Test end-to-end login flow

### Known Limitations

- Email/language retrieved from Wesnoth defaults (can be enhanced with forums API)
- No real-time password sync (acceptable - uses official server)
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
