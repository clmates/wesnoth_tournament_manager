# Password Security Implementation Guide

## Overview
This document describes the complete password management security implementation, including validation, history tracking, and reset mechanisms.

## Password History Management

### When Password History is Recorded

| Event | Password Saved to History | Reason |
|-------|---------------------------|--------|
| **User Registration** | ✅ YES | Prevent immediate reuse after registration |
| **Request Password Reset** | ❌ NO | Only saves after completion, not on request |
| **Complete Email Reset** | ✅ YES | Save previous password after successful reset |
| **Complete Force Change** | ✅ YES | Save previous password after forced change |
| **Admin Force Reset** | ✅ YES | Save previous password before temp password |
| **Change Password** | ✅ YES | Save previous password after change |

### Security Guarantees

#### For Users
- **Protected:** Cannot use any of the last N passwords (configurable, default: 5)
- **Protected:** Cannot reuse current password during a change
- **Safe:** Ignored password reset emails don't affect ability to reuse current password
- **Safe:** Current password remains valid if reset token expires

#### Against Attackers
- **Attack:** Cannot force password rotation to weaken password history
  - Reason: Password only added to history when user successfully completes change
- **Attack:** Cannot enumerate users by repeatedly requesting resets
  - Reason: Generic response returned ("`If an account exists with that email...`")
- **Attack:** Cannot force a user to weaken their password
  - Reason: All password changes must meet policy requirements

## Password Validation Policy

### Requirements (Configurable)
- Minimum length: 8 characters
- At least 1 uppercase letter: `[A-Z]`
- At least 1 lowercase letter: `[a-z]`
- At least 1 number: `[0-9]`
- At least 1 special character: `[!@#$%^&*(),.?":{}|<>]`
- NOT in previous N passwords: Checked via `password_history` table

### Validation Flow

```
New Password Request
    ↓
Check policy rules (length, uppercase, etc)
    ↓ Fails?
Return error with specific requirement
    ↓ Passes?
Compare against previous N passwords in history
    ↓ Match found?
Return: "Password cannot be one of the last N passwords"
    ↓ No match?
✅ APPROVED - Proceed with password change
```

## Endpoints and Their Behavior

### 1. POST `/auth/register`
**Visibility:** Public
**Rate Limit:** Yes (registerLimiter)

```javascript
// Flow
1. Validate password against policy
   - If fails: reject immediately
   - If passes: continue

2. Create user with passwordHash
   → INSERT password_history (initial password) ← SECURITY

3. Generate email verification token
   → Send verification email

// Result
- User cannot use same password if they reset before verifying email
- If password reset requested but ignored, current password still valid
```

### 2. POST `/auth/request-password-reset`
**Visibility:** Public
**Rate Limit:** Yes (registerLimiter)

```javascript
// Flow
1. Accept only EMAIL (no nickname parameter)
   - Prevents user enumeration via nickname

2. Find user by email
   - If found: generate secure token, store in DB
   - If not found: SILENT (return generic message anyway)

3. Send email with reset link
   - Link: /reset-password?token=<32-byte-hex>
   - Token expires in 1 hour

// Result
- ✅ No password_history insertion (ignoring this email is safe)
- ✅ User's current password remains valid
- ✅ Token stored in password_reset_token field
```

### 3. POST `/auth/reset-password`
**Visibility:** Public (unauthenticated)
**Required:** token + newPassword

```javascript
// Flow
1. Find user with matching token
   - If not found: error "Invalid or expired reset token"

2. Check token expiration (1 hour)
   - If expired: error "Password reset token has expired"

3. Fetch current password hash

4. Compare: newPassword vs currentPassword
   - If same: error "New password cannot be the same as current password"

5. Validate newPassword against policy
   - Uses validatePassword(newPassword, userId)
   - Checks against previous N passwords in password_history

6. If all checks pass:
   - Hash new password
   - Save current password to password_history ← SECURITY
   - Update user with new hash
   - Clear reset token fields
   - Audit log: PASSWORD_RESET

// Result
- ✅ User changed password successfully
- ✅ Previous password now in history (cannot reuse)
- ✅ Audit trail recorded
```

### 4. POST `/auth/force-change-password`
**Visibility:** Private (authenticated)
**Required:** newPassword
**Trigger:** After admin forces password reset

```javascript
// Flow
1. User is authenticated and has flag: sessionStorage.mustChangePassword = 'true'

2. Fetch current password hash

3. Compare: newPassword vs currentPassword
   - If same: error "New password cannot be the same as current password"

4. Validate newPassword against policy

5. If all checks pass:
   - Hash new password
   - Save current password to password_history ← SECURITY
   - Update user with new hash
   - Clear password_must_change flag
   - Audit log: PASSWORD_CHANGE_FORCED

// Result
- ✅ User changed forced password successfully
- ✅ Previous password now in history
```

### 5. POST `/auth/change-password`
**Visibility:** Private (authenticated)
**Required:** oldPassword + newPassword

```javascript
// Flow
1. User is authenticated

2. Fetch current password hash

3. Verify oldPassword is correct
   - If incorrect: error "Invalid current password"

4. Compare: newPassword vs currentPassword
   - If same: error "New password cannot be the same as current password"

5. Validate newPassword against policy

6. If all checks pass:
   - Hash new password
   - Save current password to password_history ← SECURITY
   - Update user with new hash
   - Audit log: PASSWORD_CHANGE_USER

// Result
- ✅ User changed own password successfully
- ✅ Previous password now in history
```

### 6. POST `/admin/users/:id/force-reset-password`
**Visibility:** Private (admin only)
**Effect:** Generates temporary password

```javascript
// Flow
1. Verify admin status

2. Fetch current password hash of target user

3. Save current password to password_history ← SECURITY

4. Generate random temp password (8 characters)
   - Format: alphanumeric
   - Example: "aX9kL2mP"

5. Hash temp password

6. Update user:
   - Set password_hash = tempPasswordHash
   - Set password_must_change = true
   - Audit log: ADMIN_FORCE_RESET_PASSWORD

7. Return temp password in response
   - Admin shares this with user (Discord, email, etc.)

// Result
- ✅ Previous password now in history
- ✅ User forced to change on next login
- ✅ Cannot use any previous password during change
```

## Security Scenarios

### Scenario 1: Immediate Password Reset After Registration
```
User registers: "SecurePass123!"
  ↓ password_history: [SecurePass123!]
  ↓
User requests reset: (email arrives)
  ↓ password_history: [SecurePass123!] (unchanged)
  ↓
User completes reset: "NewPass456!"
  ↓ password_history: [SecurePass123!, NewPass456!]
  ↓
User cannot use either of the last 2 passwords
```

### Scenario 2: Attacker Attempts Forced Rotation
```
Attacker requests reset for victim
  ↓ password_history: [VictimPass] (unchanged)
  ↓
Victim ignores email (token expires)
  ↓ password_history: [VictimPass] (unchanged)
  ↓
Victim can still use VictimPass: ✅ YES
Victim can request another reset: ✅ YES
```

### Scenario 3: User Tries to Reuse Old Password
```
User has used: [Pass1, Pass2, Pass3, Pass4, Pass5, NewPass6]
  ↓
User tries to change back to Pass3
  ↓ validatePassword() checks history
  ↓
Error: "Password cannot be one of the last 5 passwords"
  ↓
Change rejected: ✗
```

## Admin Password Policy

### Configuration
Located in `password_policy` table (accessible via admin UI):

```sql
{
  min_length: 8,
  require_uppercase: true,
  require_lowercase: true,
  require_numbers: true,
  require_symbols: true,
  previous_passwords_count: 5
}
```

### Update Endpoint
- **POST** `/api/admin/password-policy`
- **Body:** `{ min_length, require_uppercase, require_lowercase, require_numbers, require_symbols, previous_passwords_count }`
- **Result:** New policy applies to all future password changes

## Audit Logging

All password operations are logged with event types:

| Event Type | Endpoint | Details |
|-----------|----------|---------|
| REGISTRATION | POST /register | Initial password saved |
| PASSWORD_RESET_REQUEST | POST /request-password-reset | Reset requested |
| PASSWORD_RESET | POST /reset-password | Reset completed |
| PASSWORD_CHANGE_FORCED | POST /force-change-password | Forced change completed |
| PASSWORD_CHANGE_USER | POST /change-password | User-initiated change |
| ADMIN_FORCE_RESET_PASSWORD | POST /admin/.../force-reset-password | Admin temp password generated |

## Implementation Notes

### For Frontend Developers
- Show password requirements clearly before form submission
- Use `/change-password` endpoint for authenticated users
- Expect `errors` array in response (not just single error)
- Handle token expiration gracefully in password reset flow
- Show generic success message (don't reveal if email exists)

### For Backend Developers
- `validatePassword()` utility checks both policy AND history
- Always compare new vs current password before calling `validatePassword()`
- Insert to `password_history` ONLY after successful password update
- Use audit logging for all password operations
- Set appropriate rate limits on public endpoints

### Database Considerations
- `password_history` can grow large; consider archiving old records
- Foreign key: `password_history.user_id` → `users.id` ON DELETE CASCADE
- Consider periodic cleanup: delete history entries older than X years
- Index on `user_id` for efficient validation queries

## Testing Checklist

- [ ] User cannot register with weak password
- [ ] User cannot register with password matching old ones
- [ ] User cannot complete email reset with same password
- [ ] User cannot reset with password from previous 5 changes
- [ ] User can reset if they ignore email once
- [ ] Admin temporary password always differs from current
- [ ] User forced to change temp password on next login
- [ ] User cannot use temporary password again after change
- [ ] Password reset emails don't reveal if account exists
- [ ] Token expires after 1 hour
- [ ] Audit logs capture all password operations
