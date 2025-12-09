# Tournament Rounds Configuration - Quick Reference

## What Was Added

### 1. Enhanced Tournament Creation Form
Users can now create tournaments with customizable rounds, each with:
- **Match Format**: Best of 1, Best of 3, or Best of 5
- **Round Duration**: Configurable in days
- **Auto-Advance**: Optional automatic progression to next round

### 2. Database Support
- New `tournament_rounds` table to store round configurations
- Updated `matches` table with `round_id` foreign key
- Full relationship between tournaments → rounds → matches

### 3. API Endpoints
- `POST /tournaments` - Create tournament with round configs
- `GET /tournaments/:id/rounds` - Get all rounds for a tournament

## Key Files Modified

```
frontend/
  src/pages/
    MyTournaments.tsx          ← Enhanced form with RoundConfig
  src/styles/
    Auth.css                   ← Added tournament form styles
  src/services/
    api.ts                     ← Added getTournamentRounds()

backend/
  src/routes/
    tournaments.ts             ← Updated POST /tournaments endpoint
  src/config/
    schema.sql                 ← Added tournament_rounds table
  migrations/
    006_tournament_rounds.sql  ← Migration file
```

## Using the API

### Create Tournament with Rounds

```typescript
// Frontend
const createTournament = async (formData) => {
  const data = {
    name: "Spring League 2024",
    description: "Competitive league with 3 rounds",
    tournament_type: "league",
    max_participants: 32,
    round_duration_days: 7,
    auto_advance_round: true,
    total_rounds: 3,
    round_configs: [
      { roundNumber: 1, matchFormat: "bo3" },
      { roundNumber: 2, matchFormat: "bo3" },
      { roundNumber: 3, matchFormat: "bo5" }
    ]
  };
  
  const response = await tournamentService.createTournament(data);
  return response.data.id; // Tournament ID
};
```

### Retrieve Tournament Rounds

```typescript
// Frontend
const getTournamentRounds = async (tournamentId) => {
  const response = await tournamentService.getTournamentRounds(tournamentId);
  // Response format:
  // [
  //   { id: "uuid", tournament_id: "uuid", round_number: 1, 
  //     match_format: "bo3", round_status: "pending", ... },
  //   { id: "uuid", tournament_id: "uuid", round_number: 2, 
  //     match_format: "bo3", round_status: "pending", ... },
  //   ...
  // ]
  return response.data;
};
```

## Data Structure

### RoundConfig Interface
```typescript
interface RoundConfig {
  roundNumber: number;        // 1, 2, 3, ...
  matchFormat: 'bo1' | 'bo3' | 'bo5';  // Match format for round
}
```

### Tournament Creation Payload
```typescript
{
  name: string;                     // Tournament name
  description: string;              // Description
  tournament_type: string;          // 'elimination', 'league', 'swiss', etc.
  max_participants?: number;        // Optional max participant limit
  round_duration_days: number;      // Days per round (1-365)
  auto_advance_round: boolean;      // Auto-advance after deadline
  total_rounds: number;             // Number of rounds
  round_configs: RoundConfig[];     // Array of round configurations
}
```

### Tournament Rounds Response
```typescript
[
  {
    id: "uuid",
    tournament_id: "uuid",
    round_number: 1,
    match_format: "bo3",
    round_status: "pending" | "in_progress" | "completed",
    round_start_date: timestamp | null,
    round_end_date: timestamp | null,
    created_at: timestamp,
    updated_at: timestamp
  }
  // ... more rounds
]
```

## Database Schema Highlights

### tournament_rounds Table
```sql
CREATE TABLE tournament_rounds (
  id UUID PRIMARY KEY,
  tournament_id UUID NOT NULL REFERENCES tournaments(id) ON DELETE CASCADE,
  round_number INTEGER NOT NULL,
  match_format VARCHAR(10) NOT NULL,  -- 'bo1', 'bo3', 'bo5'
  round_status VARCHAR(20) DEFAULT 'pending',
  round_start_date TIMESTAMP,
  round_end_date TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tournament_id, round_number)
);
```

### matches Table Addition
```sql
ALTER TABLE matches ADD COLUMN round_id UUID 
  REFERENCES tournament_rounds(id) ON DELETE SET NULL;
```

## Frontend Form Components

### Basic Information Section
- Tournament Name (required)
- Description (required)
- Tournament Type (required)
- Max Participants (optional)

### Round Configuration Section
- Round Duration (1-365 days)
- Auto-Advance Toggle
- Round List:
  - Round number (1, 2, 3, ...)
  - Match Format Selector (BO1, BO3, BO5)
  - Remove Button (if > 1 round)
- Add Round Button

## CSS Classes

| Class | Purpose |
|-------|---------|
| `.tournament-form` | Main form container |
| `.form-section` | Section with left border accent |
| `.form-group` | Individual form field |
| `.rounds-container` | Rounds list container |
| `.round-item` | Single round configuration |
| `.btn-add-round` | Green "Add" button |
| `.btn-remove-round` | Red "Remove" button |
| `.btn-create-tournament` | Green primary button |

## Responsive Design

- **Desktop**: Full grid layout for form sections
- **Mobile (< 768px)**: Single column layout, stacked buttons

## Validation

### Client-Side
- ✓ Name and description required
- ✓ Tournament type required
- ✓ At least 1 round required
- ✓ Round duration: 1-365 days
- ✓ Valid match formats: bo1, bo3, bo5

### Server-Side
- ✓ All required fields validated
- ✓ Round configurations validated
- ✓ Database constraints enforced

## Deployment Steps

1. **Update Database**:
   ```bash
   # If using fresh database, schema.sql includes tournament_rounds
   # If upgrading, run migration:
   psql -U postgres -d tournament_db -f backend/migrations/006_tournament_rounds.sql
   ```

2. **Build Backend**:
   ```bash
   cd backend
   npm install
   npm run build
   ```

3. **Build Frontend**:
   ```bash
   cd frontend
   npm install
   npm run build
   ```

4. **Start Services**:
   ```bash
   # Backend
   cd backend && npm start
   
   # Frontend (separate terminal)
   cd frontend && npm start
   ```

## Testing Checklist

- [ ] Create tournament with 1 round
- [ ] Create tournament with 3+ rounds
- [ ] Add rounds dynamically
- [ ] Remove rounds (keep minimum 1)
- [ ] Select different match formats per round
- [ ] Verify tournament creation succeeds
- [ ] Retrieve tournament rounds via API
- [ ] Verify round_deadline calculated correctly
- [ ] Test on mobile (responsive design)

## Future Work

1. Implement round pairing algorithm
2. Auto-advance rounds based on deadline
3. Display round status in UI
4. Bracket generation for elimination rounds
5. Admin panel for round management

## Troubleshooting

### Tournament not created
- Check: Name, description, tournament_type required
- Check: At least one round_config provided
- Check: round_configs array format correct

### Rounds not retrieved
- Check: Tournament ID is valid
- Check: Correct endpoint: `/tournaments/:id/rounds`
- Check: CORS enabled if calling from different origin

### Build errors
- Backend: Run `npm install` and check TypeScript errors
- Frontend: Clear node_modules and reinstall if needed

## Support

For issues or questions, refer to:
- `TOURNAMENT_ROUNDS_IMPLEMENTATION.md` - Detailed documentation
- `backend/src/routes/tournaments.ts` - API implementation
- `frontend/src/pages/MyTournaments.tsx` - UI implementation
