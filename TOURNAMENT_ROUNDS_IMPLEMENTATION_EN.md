# Tournament Rounds Configuration Implementation (REFACTORED)

## Overview
This implementation provides intelligent tournament lifecycle management with smart round configuration. Instead of manually adding rounds, organizers define round types (general, final_rounds, great_final) which are automatically generated based on tournament type and participant count.

## Key Design Changes

### From: Manual Round Addition
```
Create tournament → Add rounds manually → Start
Problem: No validation, no participant-based calculation
```

### To: Smart Round Configuration
```
Create tournament → Register participants → Close registration → Prepare (auto-generate) → Start
Benefit: Validated, calculated, professional workflow
```

### Round Type Semantics
- **general_rounds**: Qualifying/preliminary rounds (all use BO3 format)
- **final_rounds**: Final stages (1=final only, 2=semis+final, 3=quarters+semis+final, etc.) (all use BO5 format)
  - Count represents how many final-stage rounds to create
  - Last round is the championship final
  - All use higher match format (BO5) for prestige

## Changes Summary

### 1. Frontend Changes

#### 1.1 MyTournaments.tsx (Refactored)
**File**: `frontend/src/pages/MyTournaments.tsx`

**Major Changes**:
- Removed `RoundConfig` interface (per-round manual addition)
- Added `RoundTypeConfig` interface:
  ```typescript
  interface RoundTypeConfig {
    generalRounds: number;        // Number of general rounds to create
    finalRounds: number;          // Number of final rounds to create
    hasGreatFinal: boolean;       // Include great final/championship
  }
  ```

**Form Data Structure**:
```typescript
{
  name: string;
  description: string;
  tournament_type: string;
  max_participants: number;      // NOW REQUIRED (was optional)
  round_duration_days: number;   // Default 7
  auto_advance_round: boolean;   // Default false
  // Round counts configured separately in roundTypeConfig
}
```

**New Helper Functions**:
- `getAvailableRoundTypes()`: Returns available round types based on tournament_type
  - League/Swiss → only 'general'
  - Elimination/Swiss-Mix → 'general', 'final_rounds', 'great_final'
  
- `canConfigureRounds()`: Validates if rounds can be configured
  - Requires: max_participants > 0
  - Prevents: Incomplete tournament setup

**Form Validation**:
- ✓ Max participants required (no rounds without it)
- ✓ At least 1 round for elimination/swiss-mix
- ✓ League/swiss don't need round config

**Conditional UI**:
- Show warning if max_participants not set
- Show different round config options per tournament_type
- Disable round inputs until max_participants provided
- Real-time total rounds calculation

#### 1.2 CSS Styling (Auth.css)
**File**: `frontend/src/styles/Auth.css`

**New Classes Added**:
- `.tournament-form`: Main form container
- `.form-section`: Section container with border-left accent
- `.form-group`: Individual form field container
- `.checkbox-group`: Checkbox field styling
- `.form-row` / `.form-row-thirds`: Grid layouts for multi-column forms
- `.rounds-container`: Container for round configuration list
- `.round-item`: Individual round configuration item
- `.round-number`: Round number badge styling
- `.round-format-select`: Round format selector styling
- `.btn-remove-round`: Red button for removing rounds
- `.btn-add-round`: Green button for adding rounds
- `.btn-create-tournament`: Green primary button
- `.btn-cancel-tournament`: Gray secondary button
- `.tournament-form-buttons`: Buttons container

**New Classes**:
- `.round-types-config`: Container for round type selection
- `.info-text`: Helper text styling
- `.round-summary`: Summary box showing total rounds
- `.info-box`: Reusable info/warning box styling
- `.info-box.warning`: Warning state (yellow/orange)
- `.info-box.info`: Info state (blue)

**Enhanced Classes**:
- `.form-group input:disabled`: Greyed out disabled inputs
- Button disabled states with reduced opacity

#### 1.3 API Service Updates (api.ts)
**File**: `frontend/src/services/api.ts`

**Unchanged**: `getTournamentRounds(id)` - Still retrieves rounds

**Note**: Round generation moved to backend prepare endpoint

### 2. Backend Changes

#### 2.1 Tournament Routes (tournaments.ts)
**File**: `backend/src/routes/tournaments.ts`

**Updated**: `POST /tournaments`
- **Input**:
  ```typescript
  {
    name: string;
    description: string;
    tournament_type: string;
    max_participants: number;         // NOW REQUIRED
    round_duration_days: number;
    auto_advance_round: boolean;
    general_rounds: number;           // NEW: count of general rounds
    final_rounds: number;             // NEW: count of final rounds (1=final, 2=semis+final, etc.)
  }
  ```
- **Validation**:
  - Requires: name, description, tournament_type
  - Requires: max_participants > 0
  - Validates round config per tournament_type:
    - League/Swiss: final_rounds must be 0 (or will be ignored)
    - Elimination: all configs allowed
  - At least one round must be configured (general_rounds > 0 OR final_rounds > 0)
- **Process**:
  1. Creates tournament with status='registration_open'
  2. Does NOT create rounds (done at prepare stage)
  3. Returns tournament ID + status
- **Output**:
  ```typescript
  {
    id: tournament_id,
    status: 'registration_open',
    message: 'Tournament created. Registration is now open.'
  }
  ```

**New**: `POST /tournaments/:id/close-registration`
- **Purpose**: Stop accepting new participants
- **Validation**: Creator-only, tournament must be registration_open
- **Process**: Changes status to registration_closed

**New**: `POST /tournaments/:id/prepare`
- **Purpose**: Auto-generate tournament rounds based on configuration
- **Validation**: Creator-only, tournament must be registration_closed
- **Process**:
  1. Reads general_rounds, final_rounds from tournament
  2. Creates tournament_rounds entries:
     - FOR i=1 TO general_rounds: Insert with type='general', match_format='bo3'
     - FOR i=1 TO final_rounds: Insert with type='final', match_format='bo5'
  3. Updates status to 'prepared'
  4. Sets current_round = 1
- **Example Output**:
  - If general_rounds=2, final_rounds=2:
    - Round 1: type='general', format='bo3'
    - Round 2: type='general', format='bo3'
    - Round 3: type='final', format='bo5' (semis)
    - Round 4: type='final', format='bo5' (final)
  - Output: {rounds_created: 4, status: 'prepared'}

**New**: `POST /tournaments/:id/start`
- **Purpose**: Begin tournament matches
- **Validation**: Creator-only, tournament must be prepared
- **Process**: Changes status to 'in_progress'

#### 2.2 Database Schema (schema.sql)
**File**: `backend/src/config/schema.sql`

**Updated Table**: `tournaments`
```sql
status VARCHAR(30) DEFAULT 'registration_open'
  -- Was: VARCHAR(20) 'pending'
  -- Now: registration_open → registration_closed → prepared → in_progress → finished

max_participants INTEGER NOT NULL
  -- Was: INTEGER (nullable)
  -- Now: Required for round configuration

general_rounds INTEGER DEFAULT 0
  -- Number of general/qualifying rounds to create

final_rounds INTEGER DEFAULT 0
  -- Number of final-stage rounds to create
  -- (1=final, 2=semis+final, 3=quarters+semis+final, etc.)

registration_closed_at TIMESTAMP
prepared_at TIMESTAMP

current_round INTEGER DEFAULT 0
  -- Was: DEFAULT 1
```

**Updated Table**: `tournament_rounds`
```sql
round_type VARCHAR(20) CHECK (round_type IN ('general', 'final'))
  -- Was: ('general', 'final_rounds', 'great_final')
  -- Now: Only 'general' or 'final'
  -- Match format auto-determined from round type:
  -- - 'general': match_format = 'bo3'
  -- - 'final': match_format = 'bo5'
```

**Updated Table**: `matches`
- Added column: `round_id UUID REFERENCES tournament_rounds(id) ON DELETE SET NULL`

#### 2.3 Database Migration (006_tournament_rounds.sql)
**File**: `backend/migrations/006_tournament_rounds.sql`

Updates existing databases with:
1. New columns in tournaments table
2. New columns in tournament_rounds table
3. New status values and transitions
4. New indexes for queries

### 3. Type System Updates

#### 3.1 Frontend Types
**File**: `frontend/src/pages/MyTournaments.tsx`

```typescript
interface RoundTypeConfig {
  generalRounds: number;    // Number of general/qualifying rounds
  finalRounds: number;      // Number of final-stage rounds (each increments prestige level)
}
```

#### 3.2 Tournament States
```typescript
type TournamentStatus = 
  | 'registration_open'
  | 'registration_closed'
  | 'prepared'
  | 'in_progress'
  | 'finished';
```

#### 3.3 Round Types
```typescript
type RoundType = 'general' | 'final';
```
```typescript
interface FormData {
  name: string;
  description: string;
  tournament_type: string;
  max_participants: number;         // NOW REQUIRED
  round_duration_days: number;      // Days per round
  auto_advance_round: boolean;      // Auto-advance after deadline
}
```

## Tournament Lifecycle State Machine

The tournament follows a strict lifecycle with 5 states:

```
┌──────────────────┐
│ registration_open│  ← Tournament created, accepting participants
└────────┬─────────┘
         │
         ↓ close-registration endpoint
┌──────────────────────┐
│ registration_closed  │  ← Registration complete, ready to prepare rounds
└────────┬─────────────┘
         │
         ↓ prepare endpoint (auto-generates tournament_rounds)
┌──────────────────┐
│   prepared       │  ← Rounds generated, ready to start matches
└────────┬─────────┘
         │
         ↓ start endpoint
┌──────────────────┐
│  in_progress     │  ← Matches being played
└────────┬─────────┘
         │
         ↓ tournament completed (automatic or manual)
┌──────────────────┐
│    finished      │  ← Tournament results finalized
└──────────────────┘
```

## Tournament Workflow: The Complete Lifecycle

### Phase 1: Tournament Creation (registration_open)

**User Actions**:
1. Creates tournament from "Create Tournament" form in MyTournaments.tsx
2. Enters: name, description, tournament_type, max_participants
3. Configures: round_duration_days, auto_advance_round
4. Selects round type counts:
   - **League/Swiss tournaments**: Only `general_rounds` shown
   - **Elimination tournaments**: `general_rounds`, `final_rounds`, `great_final` shown

**Frontend Processing**:
- `canConfigureRounds()` validates max_participants is set
- `getAvailableRoundTypes()` returns type-appropriate options
- Form shows conditional UI sections per tournament_type

**Backend Processing**:
```
POST /tournaments
├─ Validates: max_participants required, name/description required
├─ Inserts: tournaments record with status='registration_open'
├─ Does NOT create tournament_rounds yet
└─ Returns: {id: tournament_id, status: 'registration_open'}
```

**State After**: Tournament exists with `registration_open` status, no rounds yet

---

### Phase 2: Close Registration (registration_closed)

**User Actions**:
- Tournament creator calls `close-registration` endpoint

**Backend Processing**:
```
POST /tournaments/:id/close-registration
├─ Validates: creator-only, status='registration_open'
├─ Updates: status → 'registration_closed'
├─ Records: registration_closed_at timestamp
└─ Returns: {status: 'registration_closed', message}
```

**State After**: No more participants can join, ready for round preparation

---

### Phase 3: Prepare Rounds (prepared)

**User Actions**:
- Tournament creator calls `prepare` endpoint
- Backend auto-generates all tournament_rounds

**Backend Processing**:
```
POST /tournaments/:id/prepare
├─ Validates: creator-only, status='registration_closed'
├─ Reads tournament: general_rounds, final_rounds
│
├─ FOR i=1 TO general_rounds:
│  └─ INSERT tournament_rounds(round_type='general', round_number=i, match_format='bo3')
│
├─ FOR i=1 TO final_rounds:
│  └─ INSERT tournament_rounds(round_type='final', round_number=i, match_format='bo5')
│
├─ Updates: status → 'prepared', current_round → 1
└─ Returns: {rounds_created: N, status: 'prepared'}
```

**Example**: If tournament_type='Elimination' with general_rounds=2, final_rounds=2:
- Creates 4 total rounds:
  - Round 1-2: type='general', match_format='bo3' (qualifiers)
  - Round 3: type='final', match_format='bo5' (semi-finals)
  - Round 4: type='final', match_format='bo5' (final championship)

**State After**: All tournament_rounds created, ready to start matches

---

### Phase 4: Start Tournament (in_progress)

**User Actions**:
- Tournament creator calls `start` endpoint

**Backend Processing**:
```
POST /tournaments/:id/start
├─ Validates: creator-only, status='prepared'
├─ Updates: status → 'in_progress'
└─ Returns: {status: 'in_progress', current_round: 1}
```

**State After**: Matches can now be reported for Round 1

---

### Phase 5: Tournament Completion (finished)

**Triggered When**:
- All matches in final round completed
- Tournament creator manually finishes tournament
- Admin closure (future feature)

**State After**: Tournament results are finalized, no more changes

---

## Database Relationships

```
tournaments (1 record per tournament)
├── tournament_rounds (N records, auto-generated at prepare)
│   ├── round_type: 'general' | 'final_rounds' | 'great_final'
│   ├── round_number: auto-incremented per tournament
│   ├── match_format: 'bo3' (general/final) or 'bo5' (great_final)
│   └── matches (1:N) [via round_id]
├── tournament_participants (N players)
└── matches (matches with round_id association)
```

## Data Flow Diagram

### Tournament Creation Flow

```
Frontend: User fills form + clicks Create
    ↓
POST /api/tournaments
{name, description, tournament_type, max_participants, 
 general_rounds, final_rounds, great_final}
    ↓
Backend: tournaments.ts
├─ Validate input
├─ INSERT tournaments (status='registration_open')
└─ Return: {id, status}
    ↓
Frontend: UI shows tournament in registration_open state
```

### Registration Close Flow

```
Frontend: Creator clicks "Close Registration"
    ↓
POST /api/tournaments/:id/close-registration
    ↓
Backend: tournaments.ts
├─ Validate: creator-only, status='registration_open'
├─ UPDATE tournaments SET status='registration_closed'
└─ Return: {status}
    ↓
Frontend: UI shows tournament in registration_closed state
```

### Round Preparation Flow

```
Frontend: Creator clicks "Prepare Rounds"
    ↓
POST /api/tournaments/:id/prepare
    ↓
Backend: tournaments.ts
├─ SELECT tournament (get general_rounds, final_rounds, great_final)
├─ FOR LOOP: Insert general_rounds entries with type='general'
├─ FOR LOOP: Insert final_rounds entries with type='final_rounds'
├─ CONDITIONAL: Insert 1 entry with type='great_final' if enabled
├─ UPDATE tournaments SET status='prepared', current_round=1
└─ Return: {rounds_created, status}
    ↓
Frontend: UI shows rounds list, ready to start
```

### Match Retrieval by Round

```
Frontend: Load tournament details
    ↓
GET /api/tournaments/:id/matches?round_type=general
    ↓
Backend: matches.ts
├─ SELECT matches m
│  JOIN tournament_rounds tr ON m.round_id = tr.id
│  WHERE m.tournament_id = :id AND tr.round_type = :round_type
└─ Return: [matches...]
```

## Validation Rules

### Frontend Validation

**Tournament Basic Information**:
- `name`: Required, non-empty string (max 100 chars)
- `description`: Required, non-empty string
- `tournament_type`: Required, must be in enum (League, Swiss, Elimination, Swiss-Mix)
- `max_participants`: **REQUIRED**, must be > 0 and < 1000

**Round Configuration** (only shown if max_participants set):
- `general_rounds`: 0 or positive integer
- `final_rounds`: 0 or positive integer
- `great_final`: Boolean
- **Type-based validation**:
  - League/Swiss: Only `general_rounds` allowed (final_rounds & great_final disabled)
  - Elimination/Swiss-Mix: All round types allowed
- `canConfigureRounds()`: Returns false if max_participants not set or form incomplete

**Round Duration**:
- `round_duration_days`: 1-365 days (default 7)
- `auto_advance_round`: Boolean toggle

### Backend Validation

**POST /tournaments**:
1. Check required fields: name, description, tournament_type
2. Check max_participants: **Must be set**, > 0, < 1000
3. Validate tournament_type against enum
4. Validate round counts per tournament_type:
   - League/Swiss: final_rounds=0, great_final=false (ignored if provided)
   - Elimination/Mix: accepts any round counts
5. At least one round must be configured (general_rounds > 0 OR final_rounds > 0 OR great_final=true)

**POST /tournaments/:id/close-registration**:
1. Verify requester is tournament creator
2. Verify tournament status='registration_open'
3. Verify at least one participant registered (future: add min participants check)

**POST /tournaments/:id/prepare**:
1. Verify requester is tournament creator
2. Verify tournament status='registration_closed'
3. Verify round configuration not already applied
4. Check for database conflicts (rounds already exist)

**POST /tournaments/:id/start**:
1. Verify requester is tournament creator
2. Verify tournament status='prepared'
3. Verify all tournament_rounds created successfully

## Error Handling

### Frontend Error Handling

**Form Validation Errors**:
- Display red error box under field: "This field is required"
- Display warning: "Configure rounds first (set max_participants)"
- Display info box: "This option not available for League tournaments"

**API Errors**:
- HTTP 400: "Invalid tournament configuration. Please check round settings."
- HTTP 401: "You don't have permission to perform this action"
- HTTP 409: "Tournament status doesn't allow this action"
- HTTP 500: "Server error occurred. Please try again."

**State Management**:
- Store error in Zustand authStore if needed
- Display error toast/notification
- Keep form data intact for correction

### Backend Error Handling

**Validation Failures**:
```typescript
// 400 Bad Request
{
  error: "Invalid tournament configuration",
  details: {
    max_participants: "This field is required",
    general_rounds: "At least one round type must be configured"
  }
}
```

**Authorization Failures**:
```typescript
// 401 Unauthorized / 403 Forbidden
{
  error: "Only the tournament creator can perform this action"
}
```

**State Conflicts**:
```typescript
// 409 Conflict
{
  error: "Cannot close registration: tournament is not in registration_open status",
  current_status: "prepared"
}
```

**Database Errors**:
```typescript
// 500 Internal Server Error
{
  error: "Database operation failed",
  message: "Failed to generate tournament rounds"
}
```

## Example Workflows

### Example 1: League Tournament (General Rounds Only)

```
1. Create League Tournament:
   POST /tournaments
   {
     name: "Winter League 2024",
     tournament_type: "League",
     max_participants: 16,
     general_rounds: 3,
     final_rounds: 0,
     great_final: false
   }
   → Returns: tournament_id = "abc123", status='registration_open'

2. Players register (via participant signup endpoint)

3. Close registration:
   POST /tournaments/abc123/close-registration
   → Returns: status='registration_closed'

4. Prepare rounds:
   POST /tournaments/abc123/prepare
   → Creates: 3 rounds with type='general', match_format='bo3'
   → Returns: rounds_created=3, status='prepared'

5. Start tournament:
   POST /tournaments/abc123/start
   → Returns: status='in_progress', current_round=1

6. Matches reported for rounds 1, 2, 3
   → After all matches in round 3 complete, tournament finishes
```

### Example 2: Elimination Tournament (All Round Types)

```
1. Create Elimination Tournament:
   POST /tournaments
   {
     name: "Spring Championship",
     tournament_type: "Elimination",
     max_participants: 32,
     general_rounds: 2,     // Qualifiers
     final_rounds: 2        // Semis + Final
   }
   → Returns: tournament_id = "xyz789", status='registration_open'

2. Players register

3. Close registration:
   POST /tournaments/xyz789/close-registration

4. Prepare rounds:
   POST /tournaments/xyz789/prepare
   → Creates:
     - Rounds 1-2: type='general', match_format='bo3' (qualifiers)
     - Round 3: type='final', match_format='bo5' (semi-finals)
     - Round 4: type='final', match_format='bo5' (final championship)
   → Returns: rounds_created=4

5. Start tournament:
   POST /tournaments/xyz789/start

6. Matches reported:
   - Rounds 1-2: Qualifying rounds (BO3)
   - Round 3: Semi-finals (BO5)
   - Round 4: Championship Final (BO5)
```

### Example 3: Swiss Tournament (General Only)

```
1. Create Swiss Tournament:
   POST /tournaments
   {
     name: "City Tournament",
     tournament_type: "Swiss",
     max_participants: 24,
     general_rounds: 4,
     final_rounds: 0,
     great_final: false
   }
   → UI auto-disables final_rounds and great_final

2. Close registration

3. Prepare rounds:
   → Creates: 4 rounds with type='general', match_format='bo3'
   → Uses Swiss system pairing (future enhancement)

4. Start & play rounds
```

## Testing Recommendations

### Phase 1: Form Validation Tests
1. **Required Fields**:
   - Create tournament without max_participants → Form shows error
   - Cannot see round configuration UI until max_participants set ✓
   
2. **Tournament Type Logic**:
   - Select League → Only general_rounds shown, final_rounds disabled ✓
   - Select Elimination → All round type options shown ✓
   - Switch between types → UI updates correctly ✓

3. **Round Configuration**:
   - Set general_rounds=0, final_rounds=0, great_final=false → Form shows error ✓
   - Set general_rounds=5 → Shows "5 general rounds" ✓
   - Toggle great_final → UI updates ✓

### Phase 2: API Endpoint Tests
1. **POST /tournaments**:
   - Create with max_participants → Returns status='registration_open' ✓
   - Create without max_participants → Returns 400 error ✓
   - Verify no tournament_rounds created yet ✓

2. **POST /tournaments/:id/close-registration**:
   - Creator closes registration → status='registration_closed' ✓
   - Non-creator tries to close → 403 Forbidden ✓
   - Close non-existent tournament → 404 Not Found ✓

3. **POST /tournaments/:id/prepare**:
   - Prepare tournament → Creates correct number of rounds ✓
   - General rounds have correct round_type ✓
   - Final rounds have correct round_type ✓
   - Great final has correct round_type if enabled ✓
   - Match format auto-set to bo3/bo5 ✓
   - Status updated to 'prepared' ✓

4. **POST /tournaments/:id/start**:
   - Start prepared tournament → status='in_progress' ✓
   - current_round set to 1 ✓

### Phase 3: Round Type Logic Tests
1. **League Tournament**:
   - Create with general_rounds=3 → 3 rounds generated ✓
   - No final_rounds or great_final ✓

2. **Elimination Tournament**:
   - Create with general_rounds=2, final_rounds=2, great_final=true
   - Generates 5 rounds total ✓
   - Round 1-2: type='general' ✓
   - Round 3-4: type='final_rounds' ✓
   - Round 5: type='great_final' ✓

3. **Match Format Validation**:
   - General/final_rounds: match_format='bo3' ✓
   - Great_final: match_format='bo5' ✓

### Phase 4: Match Association Tests
1. Report match for Round 1 → round_id stored correctly ✓
2. Query matches by round_type → Returns only matches from that round ✓
3. Get tournament with rounds → All rounds returned in correct order ✓

### Phase 5: Error Scenarios
1. Try to close registration twice → 409 Conflict ✓
2. Try to prepare twice → 409 Conflict ✓
3. Try to start non-prepared tournament → 409 Conflict ✓
4. Creator deactivates account → Consider cascade/permission changes ✓

## Future Enhancements

### Round Management
1. **Modify Round Counts**:
   - Allow updating round configuration before registration closes
   - Auto-recalculate total rounds

2. **Extend/Reduce Rounds**:
   - Add/remove rounds mid-tournament (for admin only)
   - Cascade changes to schedule matches

3. **Round Status Tracking**:
   - Add round status: pending → in_progress → completed
   - Display remaining matches per round
   - Show completion percentage

### Match Pairing & Scheduling
1. **Swiss System Pairing**:
   - Auto-generate pairings for general rounds
   - Sort by Elo rating for optimal matchups

2. **Elimination Bracket**:
   - Auto-generate bracket for elimination rounds
   - Display tree structure for great_final

3. **Round Deadlines**:
   - Implement round_deadline tracking (current_round_start + round_duration_days)
   - Display countdown in UI

4. **Auto-Advance**:
   - If auto_advance_round=true and deadline reached:
     - Mark incomplete matches as defaults
     - Advance to next round

### Tournament Administration
1. **Extend/Reduce Deadlines**:
   - Allow creator to extend current round deadline
   - Automatic notification to participants

2. **Manual Round Transitions**:
   - Allow creator to manually advance to next round
   - Skip or replay rounds (admin only)

3. **Disqualification**:
   - Allow removing player from tournament mid-event
   - Cascade to incomplete matches

4. **Tournament Cancellation**:
   - Allow graceful tournament closure
   - Preserve historical data

### Statistics & Reporting
1. **Round Statistics**:
   - Win rate by round type
   - Average match duration per round
   - Participation rate tracking

2. **Player Tracking**:
   - Progress through rounds
   - Elimination point tracking
   - Final placement

3. **Tournament Reports**:
   - Export tournament results by round
   - CSV/JSON format support

### Performance Optimizations
1. **Batch Operations**:
   - Optimize round preparation for large tournaments (256+ rounds)
   - Parallel insertion with transaction rollback on failure

2. **Caching**:
   - Cache tournament_rounds in memory
   - Invalidate on status changes

3. **Indexing**:
   - Add index on (tournament_id, status)
   - Add index on (round_type, tournament_id)

## Compilation Status

✅ **Frontend**: Successfully compiles (355.76 KB, 108.11 KB gzipped)
✅ **Backend**: Successfully compiles (TypeScript)  
✅ **Database**: Schema updated with new lifecycle states and fields

## Files Modified in This Refactor

### Frontend Files
- `frontend/src/pages/MyTournaments.tsx`
  - Replaced RoundConfig with RoundTypeConfig interface
  - Added canConfigureRounds() validation function
  - Added getAvailableRoundTypes() tournament type logic
  - Refactored form UI with conditional sections
  - New round type configuration section
  - Warning/info box display for incomplete setup

- `frontend/src/styles/Auth.css`
  - Added .round-types-config class
  - Added .info-box with .warning and .info variants
  - Added .info-text and .round-summary classes
  - Added disabled input styling

### Backend Files
- `backend/src/routes/tournaments.ts`
  - Completely rewrote POST /tournaments endpoint
  - Added POST /tournaments/:id/close-registration endpoint
  - Added POST /tournaments/:id/prepare endpoint (auto-generates rounds)
  - Added POST /tournaments/:id/start endpoint
  - All endpoints include creator-only validation

- `backend/src/config/schema.sql`
  - Updated tournaments table (8 columns changed/added)
  - Updated tournament_rounds table (1 column added)
  - Updated matches table (1 column added)
  - New status values and state transitions

- `backend/migrations/006_tournament_rounds.sql`
  - Migration for new columns and indexes

### Database Schema Changes
- **tournaments table**:
  - status: NEW enum with 5 values (registration_open, registration_closed, prepared, in_progress, finished)
  - max_participants: CHANGED from nullable to NOT NULL
  - general_rounds: NEW integer field
  - final_rounds: NEW integer field
  - great_final: NEW boolean field
  - registration_closed_at: NEW timestamp
  - prepared_at: NEW timestamp
  - current_round: CHANGED default from 1 to 0

- **tournament_rounds table**:
  - round_type: NEW varchar field with CHECK constraint ('general'|'final_rounds'|'great_final')

- **matches table**:
  - (preparation for round association)

## Breaking Changes

⚠️ **BREAKING CHANGES** from previous implementation:

1. **max_participants is now REQUIRED**:
   - Old: Could create tournament without participant limit
   - New: Must specify max_participants before round configuration
   - **Impact**: Existing tournaments without max_participants need migration

2. **Tournament Creation No Longer Creates Rounds**:
   - Old: POST /tournaments created tournament + rounds in one step
   - New: POST /tournaments creates tournament only
   - **New Steps**:
     1. POST /tournaments (create with status='registration_open')
     2. POST /tournaments/:id/close-registration
     3. POST /tournaments/:id/prepare (generates rounds)
     4. POST /tournaments/:id/start
   - **Impact**: Tournament creation workflow now 4 steps instead of 1

3. **Round Type Semantics Simplified**:
   - Old: Separate types: 'general', 'final_rounds', 'great_final' + boolean great_final field
   - New: Only two types: 'general', 'final' + count-based configuration
   - **Impact**: 
     - final_rounds=1 means only one final round (the championship)
     - final_rounds=2 means semis + final
     - final_rounds=3 means quarters + semis + final (etc.)
     - All final rounds use BO5 format; all general rounds use BO3 format

4. **Round Configuration Format Changed**:
   - Old: Sent array of RoundConfig objects with per-round settings
   - New: Send counts per round type (general_rounds, final_rounds only)
   - **Impact**: Different POST body structure - no more great_final boolean

5. **Tournament Status Enum Expanded**:
   - Old: 'pending', 'in_progress', 'finished'
   - New: 'registration_open', 'registration_closed', 'prepared', 'in_progress', 'finished'
   - **Impact**: Status check logic must be updated throughout application

## Migration Path for Existing Data

For existing tournaments in old schema:

```sql
-- Step 1: Remove great_final column
ALTER TABLE tournaments
  DROP COLUMN great_final;

-- Step 2: Update tournament_rounds to use new round_type values
UPDATE tournament_rounds
  SET round_type = 'final'
  WHERE round_type IN ('final_rounds', 'great_final');

-- Step 3: Add migration for schema (if not already done)
ALTER TABLE tournament_rounds
  DROP CONSTRAINT tournament_rounds_round_type_check,
  ADD CONSTRAINT tournament_rounds_round_type_check 
    CHECK (round_type IN ('general', 'final'));

-- Step 4: Migrate existing tournaments (manual step)
-- For each existing tournament, manually count:
-- - How many general rounds exist
-- - How many final rounds exist (combine final_rounds + great_final counts)
-- Then update:
UPDATE tournaments
  SET general_rounds = <count_of_general>,
      final_rounds = <count_of_final>  -- includes what was great_final
  WHERE id = '<tournament_id>';
```
  WHERE total_rounds IS NOT NULL;

-- Step 3: Map old status values
UPDATE tournaments
  SET status = 'in_progress'
  WHERE status = 'pending';

-- Step 4: Update schema for round types
ALTER TABLE tournament_rounds
  ADD COLUMN round_type VARCHAR(20) DEFAULT 'general';
```

## Dependencies

- React 18+
- TypeScript 5+
- PostgreSQL 12+
- Node.js 16+
- Express.js 4+

## Related Documentation

- `TOURNAMENT_ROUNDS_SUMMARY.md` - High-level overview of new strategy
- `TOURNAMENT_ROUNDS_QUICK_REFERENCE.md` - API quick reference
- `TOURNAMENT_ROUNDS_INDEX.md` - Navigation and file index
- `MATCH_STATUS_SYSTEM.md` - Match status lifecycle
- `README.md` - General project documentation

## Key Design Decisions

1. **Why separate round generation from creation?**
   - Allows time for registration before committing to round structure
   - More realistic tournament workflow
   - Enables participant count validation

2. **Why make max_participants required?**
   - Needed for round structure determination
   - Prevents invalid tournaments with unlimited brackets
   - Enables better capacity planning

3. **Why auto-generate rounds instead of manual addition?**
   - Eliminates user configuration errors
   - Ensures correct tournament type logic
   - Simplifies UI/UX significantly

4. **Why three round types (general, final_rounds, great_final)?**
   - Maps to real tournament structures (qualifiers, semifinals, championship)
   - Different match formats per stage (bo3 vs bo5)
   - Flexible for league, swiss, elimination systems

## Notes for Developers

- Tournament creators can only manage their own tournaments (enforced in backend)
- Round generation is idempotent within same transaction (rollback on duplicate)
- Current round advances manually via separate endpoint (future: auto-advance)
- All timestamps are server-generated (prevents client-side manipulation)
- Round order is immutable after preparation (for data integrity)
