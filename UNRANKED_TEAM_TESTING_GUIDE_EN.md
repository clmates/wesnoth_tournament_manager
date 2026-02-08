# Unranked & Team Tournament Testing Guide

## Overview
This guide covers comprehensive testing of the new Unranked and Team Tournament features implemented in the `feature/unranked-tournaments` branch.

## Database Status
- ✅ Migration `20260112_add_unranked_tournaments.sql` - Executed in Supabase
- ✅ Migration `20260112_add_team_tournaments.sql` - Executed in Supabase
- Both migrations include `IF NOT EXISTS` clauses for idempotency

## Implementation Checklist

### Backend (✅ COMPLETED)
- [x] Added `tournament_mode` column to `tournaments` table (VARCHAR(20), CHECK constraint)
- [x] Added `tournament_mode` column to `matches` table for tracking
- [x] Created `tournament_unranked_factions` and `tournament_unranked_maps` tables
- [x] Created `tournament_teams`, `team_substitutes`, `team_tournament_matches` tables
- [x] Extended `tournament_participants` with `team_id` and `team_position` columns
- [x] Updated `/api/tournaments/:id/matches/report` to validate tournament_mode
- [x] Updated `/api/tournaments` POST endpoint for unranked asset handling
- [x] Added team management endpoints in `/api/admin/tournaments/:id/teams/*`
- [x] Implemented ELO skip for unranked tournaments in match reporting

### Frontend (✅ COMPLETED)
- [x] Added `tournament_mode` selector to MyTournaments.tsx (radio buttons)
- [x] Integrated UnrankedFactionSelect and UnrankedMapSelect components
- [x] Created TeamSelect.tsx component
- [x] Created TeamMemberInput.tsx component with position management
- [x] Created TeamSubstituteList.tsx component with priority ordering
- [x] Updated TournamentMatchReportModal for tournament_mode-aware asset loading
- [x] Updated TournamentDetail with team view (grouped participants)
- [x] Updated TournamentDetail rankings for team aggregation
- [x] Added CSS styling for team cards and member tables

---

## Testing Scenarios

### SCENARIO 1: Create Ranked Tournament (1v1 - Baseline)

**Steps:**
1. Navigate to "My Tournaments" → Create Tournament
2. Fill form:
   - Name: "Test Ranked 1v1"
   - Description: "Testing ranked baseline functionality"
   - Match Type: **Ranked** (default selected)
   - Tournament Format: Elimination
   - Max Participants: 4
3. Select tournament type and complete creation
4. Verify in database:
   ```sql
   SELECT id, name, tournament_mode FROM tournaments WHERE name = 'Test Ranked 1v1';
   -- Expected: tournament_mode = 'ranked'
   ```

**Expected Results:**
- Tournament created with `tournament_mode = 'ranked'`
- Standard ELO calculations enabled
- Asset validation disabled (any maps/factions allowed)

---

### SCENARIO 2: Create Unranked Tournament (1v1 - With Asset Restrictions)

**Steps:**
1. Navigate to "My Tournaments" → Create Tournament
2. Fill form:
   - Name: "Test Unranked 1v1"
   - Description: "Testing unranked with faction/map restrictions"
   - Match Type: **Unranked** (select radio button)
   - Faction Selection: Choose 2-3 factions (e.g., Elves, Dwarves, Undead)
   - Map Selection: Choose 2-3 maps (e.g., Caves of the Basilisk, Kabus)
   - Tournament Format: Swiss
   - Max Participants: 4
3. Create tournament
4. Verify in database:
   ```sql
   SELECT id, name, tournament_mode FROM tournaments WHERE name = 'Test Unranked 1v1';
   SELECT * FROM tournament_unranked_factions WHERE tournament_id = '<tournament_id>';
   SELECT * FROM tournament_unranked_maps WHERE tournament_id = '<tournament_id>';
   ```

**Expected Results:**
- Tournament created with `tournament_mode = 'unranked'`
- Selected factions stored in `tournament_unranked_factions`
- Selected maps stored in `tournament_unranked_maps`
- Asset restrictions visible in dropdown when reporting matches

---

### SCENARIO 3: Create Team Tournament (2v2)

**Steps:**
1. Navigate to "My Tournaments" → Create Tournament
2. Fill form:
   - Name: "Test Team Tournament"
   - Description: "Testing 2v2 team format"
   - Match Type: **Team** (select radio button)
   - Tournament Format: League
   - Max Participants: 4 (will represent 2 teams of 2)
3. Create tournament
4. Verify in database:
   ```sql
   SELECT id, name, tournament_mode FROM tournaments WHERE name = 'Test Team Tournament';
   ```

**Expected Results:**
- Tournament created with `tournament_mode = 'team'`
- Participants tab shows as "Teams" instead of "Participants"

---

### SCENARIO 4: Team Self-Registration - Player Creates Team

**Prerequisites:** 
- Team tournament created (Scenario 3)
- Player accounts available (minimum 2 players)
- Tournament status: "registration_open"

**Steps (Player 1 - Team Creator):**
1. Log in as Player 1
2. Navigate to Tournaments → Find "Test Team Tournament"
3. Click "Request Join" / "Join Tournament"
4. Tournament join modal appears with team selection:
   - Option: "Create New Team" (text input for team name)
   - Input: "Alpha Team"
   - Position: (Auto-assign Position 1 to first member, or let user choose)
   - Submit
5. Verify status: "Pending" (awaiting organizer approval)
6. Verify database:
   ```sql
   SELECT * FROM tournament_teams WHERE tournament_id = '<tournament_id>' AND name = 'Alpha Team';
   SELECT * FROM tournament_participants WHERE tournament_id = '<tournament_id>' AND user_id = '<player1_id>';
   ```

**Expected Results:**
- New team "Alpha Team" created with Player 1
- Player 1 position = 1 (or as selected)
- Team has 1/2 members
- Participation status = "pending"

---

### SCENARIO 5: Team Self-Registration - Player Joins Existing Team

**Prerequisites:**
- Team created in Scenario 4
- Different player account (Player 2)
- Tournament still in registration_open status

**Steps (Player 2 - Team Member):**
1. Log in as Player 2
2. Navigate to Tournaments → Find "Test Team Tournament"
3. Click "Request Join" / "Join Tournament"
4. Tournament join modal appears with team selection:
   - Option dropdown showing existing teams: "Alpha Team (1/2 members)"
   - Select: "Alpha Team"
   - Position: (Auto-assign Position 2 to second member, or let user choose - must not conflict with Position 1)
   - Submit
5. Verify status: "Pending" (awaiting organizer approval)
6. Verify database:
   ```sql
   SELECT * FROM tournament_participants 
   WHERE tournament_id = '<tournament_id>' 
   AND user_id IN ('<player1_id>', '<player2_id>')
   ORDER BY user_id;
   -- Expected: Both show team_id same, positions 1 and 2
   
   SELECT * FROM tournament_teams WHERE id = '<team_id>';
   -- Expected: member_count still shows correct count from trigger validation
   ```

**Expected Results:**
- Team "Alpha Team" now shows 2/2 members
- Player 1 position = 1, Player 2 position = 2 (no conflicts)
- Both players have "pending" status until organizer approves
- Team is "full" (trigger prevents adding 3rd member)

---

### SCENARIO 6: Team Validation - Prevent Third Member

**Prerequisites:**
- Team with 2 members (Scenario 5)
- Third player account available

**Steps:**
1. Log in as Player 3
2. Navigate to Tournaments → Find "Test Team Tournament"
3. Click "Request Join" → Tournament join modal
4. Dropdown shows: "Alpha Team (2/2 members)" with disabled state
5. Try to select disabled team (should not be selectable)
6. Only option: Create new team

**Expected Results:**
- Teams at max capacity are disabled/grayed out in dropdown
- Cannot exceed 2 members per team
- Trigger `check_team_member_count()` prevents database insert if attempted
- User forced to create new team

---

### SCENARIO 7: Admin Team Customization - Add Substitutes (Post-Creation)

**Prerequisites:**
- Team tournament with teams self-registered (Scenarios 4-5)
- User has organizer rights

**Steps:**
1. Log in as tournament organizer
2. Navigate to tournament admin panel
3. Select team "Alpha Team"
4. Option to add substitute players:
   - Available players: [Player 3, Player 4, ...]
   - Add Player 3 as substitute
   - Add Player 4 as substitute (auto-assigns priority #2)
5. Verify display shows substitutes with priority numbers
6. Verify database:
   ```sql
   SELECT * FROM team_substitutes 
   WHERE team_id IN (SELECT id FROM tournament_teams WHERE name = 'Alpha Team');
   ```

**Expected Results:**
- Organizer can add substitutes after teams formed
- Substitutes show priority ordering
- Substitutes do NOT count toward team size (trigger validation excludes `team_position IS NULL`)
- Multiple substitutes supported with auto-prioritization

---

### SCENARIO 8: Match Reporting - Ranked (Verify ELO Calculation)

**Prerequisites:**
- Ranked tournament created (Scenario 1) with matches scheduled
- Two players with assigned match

**Steps:**
1. Log in as player 1
2. Navigate to tournament → Matches tab
3. Click "Report Result" on pending match
4. Fill modal:
   - Map: Select any available
   - Your Faction: Select any available
   - Opponent Faction: Select any different
   - Comments: (optional)
5. Submit
6. Verify in database:
   ```sql
   SELECT user_id, elo_rating, tournament_wins, tournament_losses, matches_played, is_rated 
   FROM users 
   WHERE id IN ('<player1_id>', '<player2_id>')
   ORDER BY id;
   ```

**Expected Results:**
- ELO ratings updated for both players
- `matches_played` incremented
- `is_rated` = true
- Win/loss counts updated
- Match status changes to "completed"

---

### SCENARIO 9: Match Reporting - Unranked (Verify ELO Skip)

**Prerequisites:**
- Unranked tournament created (Scenario 2) with matches scheduled
- Selected assets enforced (only chosen factions/maps available)

**Steps:**
1. Log in as player 1
2. Navigate to tournament → Matches tab
3. Click "Report Result" on pending match
4. Verify dropdowns only show selected assets:
   - Map dropdown restricted to tournament's unranked_maps
   - Faction dropdowns restricted to tournament's unranked_factions
5. Fill modal and submit
6. Verify in database:
   ```sql
   SELECT m.tournament_mode, m.winner_faction, m.loser_faction, m.map,
          u1.elo_rating as player1_elo, u2.elo_rating as player2_elo,
          u1.tournament_wins, u2.tournament_losses
   FROM matches m
   JOIN users u1 ON m.winner_id = u1.id
   JOIN users u2 ON m.loser_id = u2.id
   WHERE m.tournament_id = '<tournament_id>'
   ORDER BY m.created_at DESC
   LIMIT 1;
   ```

**Expected Results:**
- Match recorded with `tournament_mode = 'unranked'`
- Map and factions restricted to allowed set
- ELO ratings NOT changed (remain same as before match)
- Win/loss counts updated (tournament-specific only, not global)
- `is_rated` = false
- Trend records created but ELO unchanged

---

### SCENARIO 10: Match Reporting - Team Tournament (2v2 Match)

**Prerequisites:**
- Team tournament created (Scenario 3)
- Two teams fully populated (Scenario 4)
- Match scheduled between teams

**Steps:**
1. Log in as player from team A
2. Navigate to tournament → Matches tab
3. Click "Report Result" (match should show team names)
4. Fill modal:
   - Map: Select available
   - Position 1 Faction (Your Team): Select faction
   - Position 1 Faction (Opponent Team): Select faction
   - Position 2 Faction (Your Team): Select faction
   - Position 2 Faction (Opponent Team): Select faction
5. Submit
6. Verify team statistics updated equally for all members

**Expected Results:**
- Both players on winning team: tournament_wins incremented, tournament_points equal
- Both players on losing team: tournament_losses incremented, tournament_points equal
- Shared tournament_points between team members

---

### SCENARIO 11: Tournament Rankings - Ranked

**Prerequisites:**
- Ranked tournament (Scenario 1) with 2-3 completed matches

**Steps:**
1. Navigate to tournament detail → Ranking tab
2. Verify ranking table shows:
   - Rank #1, #2, etc.
   - Player nicknames
   - Win/loss counts
   - Tournament points
   - OMP, GWP, OGP statistics
   - Status badges
3. Verify sorting by points > OMP > GWP > OGP > wins

**Expected Results:**
- Players ranked by tournament points (descending)
- Tiebreakers applied correctly
- All statistics visible and accurate

---

### SCENARIO 12: Tournament Rankings - Team

**Prerequisites:**
- Team tournament (Scenario 3) with populated teams and completed matches

**Steps:**
1. Navigate to tournament detail → Ranking tab
2. Verify ranking table shows:
   - Rank #1, #2, etc.
   - **Team names** (not individual players)
   - Team members listed below/beside team name
   - Aggregated wins (sum of both members)
   - Aggregated losses (sum of both members)
   - **Shared tournament_points** (same for all members)
3. Verify sorting by team points > team wins

**Expected Results:**
- Rankings grouped by team
- Team statistics aggregated from members
- Team points shared equally between all members
- Players grouped under team header

---

### SCENARIO 13: Tournament Standings - Team View

**Prerequisites:**
- Team tournament with populated teams

**Steps:**
1. Navigate to tournament detail → Participants tab
2. Verify team card layout shows:
   - Team name as header
   - Member count (e.g., "2/2 members")
   - Table with members:
     - Nickname, Position, Status, Wins, Losses, Points
     - Both members showing same tournament_points
   - Substitute list (if any) with priority numbers

**Expected Results:**
- Teams displayed as cards (not tables)
- Participants organized by team
- Shared statistics visible within each team
- Responsive layout on mobile (single column)

---

### SCENARIO 14: Form Flow Verification

**Prerequisites:**
- Access to create tournament form

**Steps:**
1. Verify form field order:
   - ① Tournament Name
   - ② Tournament Description
   - ③ Match Type (Ranked/Unranked/Team) ← NEW POSITION
   - ④ (If Unranked) Faction Select ← NEW
   - ⑤ (If Unranked) Map Select ← NEW
   - ⑥ Tournament Format (Swiss/Elimination/League)
   - ⑦ Max Participants
   - ⑧ Round configuration

**Expected Results:**
- Form flow matches specified order
- Conditional fields appear/disappear based on Match Type
- All fields required/optional as specified

---

### SCENARIO 15: Asset Validation on Match Report

**Prerequisites:**
- Unranked tournament with restricted assets

**Steps:**
1. Create match in unranked tournament
2. Report match and observe asset dropdowns
3. Verify dropdowns only contain tournament-specific assets
4. Attempt to bypass with API call (submit unrestricted asset):
   ```javascript
   // Try to report with asset NOT in tournament_unranked_factions
   POST /api/tournaments/:id/matches/report
   {
     opponent_id: "...",
     map: "Valid Map",
     winner_faction: "INVALID FACTION",  // Not in tournament_unranked_factions
     loser_faction: "INVALID FACTION"
   }
   ```
5. Verify API rejects with error

**Expected Results:**
- Frontend dropdowns only show allowed assets
- API validates and rejects restricted assets
- Error message: "Map/Faction not available for this tournament"

---

## Troubleshooting

### Issue: "Tournament mode not found" when creating tournament
**Solution:**
- Ensure migrations executed successfully: `SELECT * FROM tournaments LIMIT 1;` should show `tournament_mode` column
- Check backend matches.ts has tournament_mode query logic

### Issue: Unranked assets not visible in dropdown
**Solution:**
- Verify tournament_unranked_factions and tournament_unranked_maps populated:
  ```sql
  SELECT COUNT(*) FROM tournament_unranked_factions WHERE tournament_id = '<id>';
  SELECT COUNT(*) FROM tournament_unranked_maps WHERE tournament_id = '<id>';
  ```
- Clear browser cache and reload
- Verify API endpoint returns data: `GET /tournaments/:id?include=unranked_assets`

### Issue: ELO updated when reporting unranked match
**Solution:**
- Verify matches.ts has conditional:
  ```typescript
  if (tournamentMode !== 'unranked') {
    // ELO calculation
  }
  ```
- Check match record has `tournament_mode = 'unranked'`
- Verify user record `is_rated` = false

### Issue: Team members showing individual points instead of shared
**Solution:**
- Verify tournament_participants inserts for team members use same tournament_points value
- Check team match reporting assigns points to both players equally
- Verify UI calculates aggregation correctly

---

## Performance Considerations

1. **Team Fetching**: Teams loaded separately from participants - verify performance with 50+ teams
   ```typescript
   const teamsRes = await fetch(`/tournaments/${id}/teams`);
   ```

2. **Ranking Aggregation**: Team ranking does in-frontend aggregation - verify no slowdown with 50+ participants

3. **Asset Dropdowns**: Verify with tournaments having 100+ factions/maps - should lazy load or paginate if needed

---

## Completion Checklist

- [ ] Scenario 1: Ranked tournament created correctly
- [ ] Scenario 2: Unranked tournament with asset restrictions
- [ ] Scenario 3: Team tournament created with mode='team'
- [ ] Scenario 4: Player 1 creates team on registration
- [ ] Scenario 5: Player 2 joins existing team on registration
- [ ] Scenario 6: Third player prevented from joining full team
- [ ] Scenario 7: Organizer can add substitutes post-registration
- [ ] Scenario 8: Ranked match reports calculate ELO
- [ ] Scenario 9: Unranked match reports skip ELO, restrict assets
- [ ] Scenario 10: Team match reporting works (2v2 format)
- [ ] Scenario 11: Ranked rankings display correctly
- [ ] Scenario 12: Team rankings aggregated and sorted
- [ ] Scenario 13: Team standings view displays team cards
- [ ] Scenario 14: Form flow matches specification
- [ ] Scenario 15: Asset validation prevents invalid data

---

## Notes
- All tests assume backend is running and Supabase is accessible
- Use test accounts that don't have critical tournament data
- For team tournament testing, ensure multiple player accounts available
- Test on both desktop and mobile resolutions
