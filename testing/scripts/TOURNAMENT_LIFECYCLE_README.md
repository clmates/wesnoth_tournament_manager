# Tournament Full Lifecycle Testing Script

Comprehensive testing script for the complete tournament workflow from creation to completion.

## Features

✅ **Menu-driven interface** - Select tournament type and execution mode  
✅ **Multiple tournament types** - Elimination, League, Swiss, Swiss-Elimination Mix  
✅ **Two execution modes**:
  - **Automatic**: Runs all phases without interruption
  - **Step-by-Step**: Pauses at each phase (creation, enrollment, prep, gameplay, each round)

✅ **Complete workflow testing**:
  1. User login and authentication
  2. Tournament creation
  3. Player enrollment
  4. Tournament preparation (match generation)
  5. Tournament start
  6. Round execution (matches reporting)
  7. Round completion and advancement

✅ **Comprehensive logging**:
  - Timestamped actions
  - Success/error tracking
  - Detailed phase summaries
  - Final tournament status

✅ **API-only approach** - No direct database access

## Prerequisites

1. **Backend running** on `localhost:3000` (or set `TEST_BASE_HOST` and `TEST_BASE_PORT` environment variables)
2. **Test credentials file** at `testing/scripts/test_credentials.csv`
3. **Node.js** installed

### Test Credentials File Format

Create `testing/scripts/test_credentials.csv`:

```csv
nickname,password
player1,password123
player2,password123
player3,password123
player4,password123
player5,password123
player6,password123
player7,password123
player8,password123
```

## Running the Script

### From testing/scripts directory:

```bash
node tournament_full_lifecycle.js
```

### With custom API endpoint:

```bash
TEST_BASE_HOST=192.168.1.100 TEST_BASE_PORT=3000 node tournament_full_lifecycle.js
```

### Interactive Mode

The script will display a menu:

```
================================================================================
TOURNAMENT LIFECYCLE TESTING SCRIPT
================================================================================

Select Tournament Type:
1) Elimination
2) League
3) Swiss
4) Swiss-Elimination Mix

Select Mode:
A) Automatic (runs all phases without pausing)
S) Step-by-Step (pauses at each phase, requires confirmation)
Q) Quit
```

#### Option Examples:

**Automatic Elimination Tournament:**
- Enter `1` for Elimination
- Enter `A` for Automatic mode
- Script runs to completion without pausing

**Step-by-Step League Tournament:**
- Enter `2` for League
- Enter `S` for Step-by-Step mode
- Script pauses after each phase, waiting for confirmation

**Step-by-Step Swiss Tournament:**
- Enter `3` for Swiss
- Enter `S` for Step-by-Step mode
- Script pauses at each round for review

## Output

### Console Output

Real-time progress display with:
- ✓ Success indicators
- ✗ Error indicators
- Phase summaries
- Action details

### Log File

Timestamped log file created in `testing/results/`:

Example: `tournament_lifecycle_20241214_143022.log`

Contains:
- Detailed action logs with timestamps
- Success/failure status for each action
- Error messages with troubleshooting info
- Tournament lifecycle summary

## Tournament Type Details

### Elimination
- Direct elimination bracket
- Single loss elimination
- Auto-calculated rounds based on participants
- Best for: Quick tournaments with clear winner

### League
- Round-robin format
- All players play all other players
- Configurable number of rounds
- Best for: Fair ranking tournaments

### Swiss
- Swiss system (similar rounds for similar records)
- Configurable rounds
- More fair than league, faster than round-robin
- Best for: Balanced competitive tournaments

### Swiss-Elimination Mix
- Swiss system for qualifying rounds
- Elimination bracket for finals
- Combines fairness and speed
- Best for: Professional tournaments

## Error Handling

The script handles common errors:

- **Login failures** - Logged and skipped
- **API errors** - Detailed error messages with suggestion
- **Network failures** - Connection errors logged
- **Validation errors** - Invalid tournament configuration reported

## Analyzing Results

After running the test:

1. **Check console output** for real-time feedback
2. **Review log file** in `testing/results/` for detailed action history
3. **Look for error patterns** to identify issues
4. **Verify tournament status** in the summary section

### Common Issues and Solutions

| Issue | Solution |
|-------|----------|
| Login fails for all users | Check test credentials file format |
| Tournament creation fails | Verify API is running and max_participants is valid |
| No matches generated | Check tournament preparation status |
| Match reporting fails | Verify round is active and player IDs are correct |
| Round completion fails | Check if all matches in round are completed |

## Advanced Usage

### Running Multiple Tests

```bash
for i in {1..5}; do
  echo "Test run $i"
  node tournament_full_lifecycle.js
  sleep 2
done
```

### Custom Test Data

Modify the script to use different:
- Tournament names
- Number of participants
- Round configurations
- Match formats (BO1, BO3, BO5)

### Performance Testing

Run with `automatic` mode multiple times to stress test the system:
- Monitor API response times
- Check database queries
- Verify match generation performance

## Development & Debugging

### Adding Logging

Edit the script to add custom logging in `runTournamentLifecycle()`:

```javascript
logAction('Custom Action', 'SUCCESS', 'Additional details');
```

### Testing Specific Phases

Comment out phases you don't want to test in `runTournamentLifecycle()`:

```javascript
// Comment out this section to skip enrollment
// for (let i = 1; i < Math.min(...) { ... }
```

### Modifying Tournament Configuration

Edit the `tournamentData` object in the creation phase:

```javascript
const tournamentData = {
  name: 'Custom Test Tournament',
  general_rounds: 5,  // Change number of rounds
  general_rounds_format: 'bo3',  // Change match format
  // ... other config
};
```

## File Structure

```
testing/
├── scripts/
│   ├── tournament_full_lifecycle.js  ← Main test script
│   ├── test_credentials.csv          ← Test user accounts
│   └── ...other scripts
├── results/
│   └── tournament_lifecycle_YYYYMMDD_HHMMSS.log  ← Generated logs
└── README.md
```

## API Endpoints Used

The script uses these API endpoints:

- `POST /api/auth/login` - User authentication
- `POST /api/tournaments` - Create tournament
- `POST /api/tournaments/:id/join` - Enroll player
- `POST /api/tournaments/:id/prepare` - Prepare tournament
- `POST /api/tournaments/:id/start` - Start tournament
- `GET /api/tournaments/:id` - Get tournament details
- `GET /api/tournaments/:id/rounds` - Get tournament rounds
- `GET /api/tournaments/:id/rounds/:roundId/matches` - Get round matches
- `POST /api/matches/:id/report` - Report match result
- `POST /api/tournaments/:id/rounds/:roundId/complete` - Complete round

## Troubleshooting

### "Test credentials file not found"
- Create `testing/scripts/test_credentials.csv` with valid user accounts

### "Need at least 2 logged-in users"
- Check credentials file has at least 2 users
- Verify users exist in the system
- Check backend is running

### "Invalid tournament type"
- Select 1-4 for tournament type
- Don't use letters or invalid numbers

### "API Error" responses
- Verify backend is running on the specified host/port
- Check tournament data is valid (especially max_participants)
- Review log file for detailed error messages

## Log File Format

Each action in the log follows this format:

```
[2024-12-14T14:30:22.123Z] [✓] Action Description
[2024-12-14T14:30:22.125Z]     Details: Additional information
```

Errors:
```
[2024-12-14T14:30:25.456Z] [✗] ERROR in Action Name
[2024-12-14T14:30:25.458Z]     Error message details
```

Phases:
```
================================================================================
PHASE: TOURNAMENT CREATION
DETAILS: Creating elimination tournament with 8 players
================================================================================
```

## Performance Notes

- **Automatic mode**: ~1-2 minutes for full tournament lifecycle (varies by tournament type)
- **Step-by-Step mode**: ~10-15 minutes (includes wait times for confirmations)
- **Logging overhead**: Minimal, all operations logged asynchronously

## Future Enhancements

- [ ] Parallel tournament testing (multiple tournaments simultaneously)
- [ ] Performance metrics collection
- [ ] Report generation (HTML/PDF)
- [ ] Regression testing suite
- [ ] Load testing with many tournaments
- [ ] Match result validation and verification
- [ ] Tournament rollback testing
- [ ] Concurrent player enrollment testing

---

**Last Updated**: 2024-12-14  
**Script Version**: 1.0  
**Tested With**: Node.js 14+
