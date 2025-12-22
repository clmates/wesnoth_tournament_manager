# Discord Environment Toggle

## Overview
Discord notifications are now controlled by the `DISCORD_ENABLED` environment variable. This allows flexible control of Discord notifications independently of the deployment environment.

## Configuration

### Environment Variables
- **DISCORD_ENABLED:** Set to `true` to enable Discord notifications, any other value (or not set) disables them
  - `DISCORD_ENABLED=true` → Discord **ENABLED** ✅
  - `DISCORD_ENABLED=false` or unset → Discord **DISABLED** ⏭️

### Implementation Details

**File:** `backend/src/services/discordService.ts`

The Discord service checks the `DISCORD_ENABLED` environment variable:

```typescript
const DISCORD_ENABLED = process.env.DISCORD_ENABLED === 'true';

// Log Discord status on module load
console.log(`🔔 Discord Service: ${DISCORD_ENABLED ? '✅ ENABLED' : '⏭️  DISABLED'} (DISCORD_ENABLED=${process.env.DISCORD_ENABLED || 'not set'})`);
```

### Protected Methods

All Discord notification methods are protected with a startup check:

1. **`createTournamentThread()`** - Creates Discord forum threads for tournaments
2. **`publishTournamentMessage()`** - Posts messages to tournament threads (base method for all notifications)

Each method logs when Discord is disabled:
```
⏭️  Discord disabled (DISCORD_ENABLED=false). Skipping [operation].
```

### Behavior

**When DISCORD_ENABLED=true:**
- ✅ Discord notifications work normally
- 📤 All messages sent to configured Discord forum
- 📝 Standard logging for successful operations

**When DISCORD_ENABLED is false or not set (default):**
- ✅ Discord service initializes normally
- ⏭️ All `createTournamentThread()` and `publishTournamentMessage()` calls return gracefully
- 📝 Logs indicate when Discord operations are skipped
- ✅ No API calls to Discord servers
- ✅ No errors thrown - graceful degradation

## Testing

### Verify Discord is Disabled (Default)
When starting the server without setting `DISCORD_ENABLED`, you should see:
```
🔔 Discord Service: ⏭️  DISABLED (DISCORD_ENABLED=not set)
```

And when operations are performed:
```
⏭️  Discord disabled (DISCORD_ENABLED=not set). Skipping thread creation.
⏭️  Discord disabled (DISCORD_ENABLED=not set). Skipping message publish.
```

### Verify Discord is Enabled
When starting with `DISCORD_ENABLED=true`, you should see:
```
🔔 Discord Service: ✅ ENABLED (DISCORD_ENABLED=true)
```

## Railway Configuration

The `DISCORD_ENABLED` variable should be configured in Railway dashboard:

**Main Branch (Test):**
- Variable: `DISCORD_ENABLED`
- Value: `false` (or leave unset)

**Production Branch:**
- Variable: `DISCORD_ENABLED`
- Value: `true`

## Code Changes Summary

- Changed from `NODE_ENV`-based logic to explicit `DISCORD_ENABLED` variable
- `DISCORD_ENABLED = process.env.DISCORD_ENABLED === 'true'`
- Default value: `false` (disabled unless explicitly set to 'true')
- Added startup logging showing current value
- Protected `createTournamentThread()` with DISCORD_ENABLED check
- Protected `publishTournamentMessage()` with DISCORD_ENABLED check (affects all child notification methods)
- All skipped operations log their reason and variable value

## Benefits

1. **Independent Control:** Discord status isn't tied to deployment environment
2. **Flexible Testing:** Enable Discord in test if needed, disable in production if needed
3. **Clear Logging:** Shows exact value of DISCORD_ENABLED variable
4. **Safe Default:** Defaults to disabled - must explicitly enable with `DISCORD_ENABLED=true`
5. **Graceful Fallback:** No errors - methods return default values when disabled
6. **Simple Toggle:** Just set the environment variable in Railway - no code changes needed

## Quick Reference

| Scenario | DISCORD_ENABLED | Result |
|----------|----------------|--------|
| Test environment | (unset) | ⏭️ Disabled |
| Test with Discord | `true` | ✅ Enabled |
| Production normal | `true` | ✅ Enabled |
| Production emergency disable | `false` | ⏭️ Disabled |

## Future Enhancements

If needed, you could also:
- Add more granular control (disable specific notification types)
- Add Discord metrics/logging for production monitoring
- Environment-specific defaults (if needed)

