# E2E Test - Schedule with Comment: Database Queries & Manual Test Steps

## Database Verification Queries

### Query 1: Check if message_extra Column Exists

```sql
-- Verify message_extra column in user_notifications table
DESCRIBE user_notifications;
```

**Expected Output**:
```
Field              | Type         | Null | Key | Default | Extra
...
message_extra      | text         | YES  |     | NULL    |
...
```

**What to Look For**:
- ✅ Column name: message_extra
- ✅ Type: text or VARCHAR
- ✅ Null: YES (allows optional values)
- ✅ Default: NULL

---

### Query 2: Retrieve Latest Schedule Proposal Notification

After a schedule proposal with comment is submitted, run this query to verify storage:

```sql
SELECT 
    id,
    user_id,
    tournament_id,
    match_id,
    type,
    title,
    message,
    message_extra,
    is_read,
    created_at
FROM user_notifications
WHERE type = 'schedule_proposal'
ORDER BY created_at DESC
LIMIT 1;
```

**Expected Output** (Example):
```
id                                   | 550e8400-e29b-41d4-a716-446655440000
user_id                              | user-456 (opponent ID)
tournament_id                        | tournament-123
match_id                             | match-789
type                                 | schedule_proposal
title                                | 🗓️ Schedule Proposal - Tournament Name
message                              | Player1 proposed schedule: 2026-04-30 14:00 UTC
message_extra                        | I'm available earlier in the day if needed ✅
is_read                              | 0 (false)
created_at                           | 2026-04-29 12:34:56
```

**What to Verify**:
- ✅ type = 'schedule_proposal'
- ✅ message_extra contains the comment text
- ✅ message_extra is NOT NULL
- ✅ created_at is recent timestamp

---

### Query 3: Check message_extra Length for Max Validation

Test that message_extra respects 500 character limit:

```sql
-- Check length of stored message_extra
SELECT 
    id,
    message_extra,
    LENGTH(message_extra) as char_count
FROM user_notifications
WHERE type = 'schedule_proposal'
AND message_extra IS NOT NULL
ORDER BY created_at DESC
LIMIT 5;
```

**Expected Output**:
```
id                                   | message_extra                        | char_count
550e8400-e29b-41d4-a716-446655440000 | I'm available earlier in the day... | 67
550e8400-e29b-41d4-a716-446655440001 | Please confirm this time works...   | 52
...
```

**What to Verify**:
- ✅ All char_count values are ≤ 500
- ✅ character count matches actual text length

---

### Query 4: Retrieve All Notifications for Specific User

Verify opponent receives the notification:

```sql
-- Get all unread notifications for opponent user
SELECT 
    id,
    type,
    title,
    message,
    message_extra,
    is_read,
    created_at
FROM user_notifications
WHERE user_id = 'opponent-user-id'
AND is_read = false
ORDER BY created_at DESC;
```

**Expected Output**:
```
id                                   | type                | title                          | message                        | message_extra                        | is_read | created_at
550e8400-e29b-41d4-a716-446655440000 | schedule_proposal   | 🗓️ Schedule Proposal - Tourney | Player1 proposed schedule:... | I'm available earlier in the...     | 0       | 2026-04-29 12:34:56
```

**What to Verify**:
- ✅ Notification created for opponent
- ✅ message_extra field populated
- ✅ is_read = false (unread)

---

### Query 5: Verify NULL Handling for Optional Message

Test with a proposal that has NO comment:

```sql
-- After proposing schedule WITH NO MESSAGE, verify NULL storage
SELECT 
    id,
    message_extra,
    CASE 
        WHEN message_extra IS NULL THEN 'NULL'
        WHEN message_extra = '' THEN 'EMPTY'
        ELSE message_extra 
    END as value_status
FROM user_notifications
WHERE type = 'schedule_proposal'
ORDER BY created_at DESC
LIMIT 3;
```

**Expected Output**:
```
id                                   | message_extra | value_status
550e8400-e29b-41d4-a716-446655440000 | NULL          | NULL ✅
550e8400-e29b-41d4-a716-446655440001 | <comment>     | <comment text>
550e8400-e29b-41d4-a716-446655440002 | NULL          | NULL ✅
```

**What to Verify**:
- ✅ message_extra is NULL when not provided
- ✅ No EMPTY strings (proper validation on backend)
- ✅ Allows both NULL and populated values

---

### Query 6: Check Notification Index Performance

Verify indexes exist for query optimization:

```sql
-- Show indexes on user_notifications table
SHOW INDEX FROM user_notifications;
```

**Expected Output**:
```
Table                | Non_unique | Key_name         | Seq_in_index | Column_name | Collation | Cardinality | Index_type
user_notifications   | 1          | idx_user_id      | 1            | user_id     | A         | 100         | BTREE
user_notifications   | 1          | idx_is_read      | 1            | is_read     | A         | 2           | BTREE
user_notifications   | 1          | idx_user_is_read | 1            | user_id     | A         | 100         | BTREE ✅
user_notifications   | 1          | idx_user_is_read | 2            | is_read     | A         | 2           | BTREE ✅
...
```

**What to Verify**:
- ✅ Index: idx_user_is_read exists
- ✅ Index: idx_user_created_at exists  
- ✅ Composite indexes present

---

## Manual Test Steps

### Setup Phase

**Prerequisites**:
- Two test user accounts created and logged in
- Active tournament with pending match between players
- Both players accessible in match list

**Test Users**:
- Player 1: player1@test.com / password123
- Player 2: player2@test.com / password123

---

### Test Execution: Schedule Proposal with Comment

#### Step 1: Player 1 Navigates to Match
```
ACTION: Login as Player 1
VERIFY: Dashboard shows tournaments
ACTION: Click on active tournament
VERIFY: Tournament page loads with match list
ACTION: Find pending match vs Player 2
EXPECTED: Match card shows "Schedule" or "Propose" button
```

#### Step 2: Open Schedule Modal
```
ACTION: Click "Schedule" button on match
EXPECTED: Modal opens with title "Schedule Match"
VERIFY ELEMENTS:
  ✓ Match info shows: "Player1 vs Player2"
  ✓ Date input field (empty or shows previous date)
  ✓ Time input field (shows 12:00)
  ✓ Timezone display: "Your timezone: [User's TZ]"
  ✓ Optional message textarea
  ✓ Character counter: "0/500 characters"
  ✓ Buttons: "📅 Propose", "Close"
```

#### Step 3: Fill Date and Time
```
ACTION: Click date input
VERIFY: Date picker opens
ACTION: Select tomorrow's date (e.g., 2026-04-30)
VERIFY: Date field shows selected date
ACTION: Click time input
ACTION: Clear current time and type: 14:00
VERIFY: Time field shows "14:00"
```

#### Step 4: Add Comment Message
```
ACTION: Click on textarea with label "Optional message for opponent"
ACTION: Type: "I'm available earlier in the day if needed"
VERIFY DURING TYPING:
  ✓ Text appears in textarea
  ✓ Character counter updates: "67/500 characters"
  ✓ Text remains within 500 char limit
VERIFY AFTER TYPING:
  ✓ Placeholder text disappears
  ✓ Full message visible
  ✓ Counter shows: "67/500 characters"
```

#### Step 5: Test Character Counter
```
ACTION: Clear textarea
ACTION: Type exactly 500 characters (edge case test)
VERIFY: Counter shows "500/500 characters"
VERIFY: All 500 chars visible in textarea
ACTION: Try typing 501st character
EXPECTED: Character not added (frontend blocks at maxLength=500)
VERIFY: Counter still shows "500/500 characters"
```

#### Step 6: Submit Proposal
```
ACTION: Click "📅 Propose" button
VERIFY BUTTON STATE:
  ✓ Button shows loading indicator (text changes to "..." or shows spinner)
  ✓ Button is disabled (grayed out)
  ✓ All form fields become disabled
WAIT: 1-2 seconds for request to process
VERIFY SUCCESS STATE:
  ✓ Success message appears: "✅ Success!" (green box)
  ✓ Message shows for ~1.5 seconds
  ✓ Modal closes automatically
  ✓ Character count clears
```

#### Step 7: Verify No Error Messages
```
VERIFY:
  ✓ No red error box appears during submission
  ✓ No validation error messages shown
  ✓ Modal closes cleanly without errors
  ✓ Button returns to normal state
```

---

### Database Verification Phase

**After Step 7, run this query** (on database server):

```sql
SELECT 
    id,
    user_id,
    tournament_id,
    match_id,
    type,
    title,
    message,
    message_extra,
    is_read,
    created_at
FROM user_notifications
WHERE type = 'schedule_proposal'
ORDER BY created_at DESC
LIMIT 1;
```

**Verify Results**:

| Field | Expected Value | Status |
|-------|----------------|--------|
| type | schedule_proposal | ✅ |
| user_id | Player 2's user ID | ✅ |
| tournament_id | Tournament ID | ✅ |
| match_id | Match ID | ✅ |
| title | 🗓️ Schedule Proposal - [Tournament Name] | ✅ |
| message | [Player1] proposed schedule: [date] [time] UTC | ✅ |
| message_extra | "I'm available earlier in the day if needed" | ✅ |
| is_read | 0 (false) | ✅ |
| created_at | Recent timestamp (within last minute) | ✅ |

---

### UI Verification Phase 1: Navbar Notification

**Action: Login as Player 2 (the opponent)**

```
ACTION: Login as Player 2
ACTION: Wait 1-2 seconds for notifications to load
ACTION: Look at navbar top-right
VERIFY NOTIFICATION BADGE:
  ✓ Notification bell icon shows badge with count (red circle with number)
  ✓ Badge shows "1" or higher indicating unread notifications
```

**Action: Click Notification Bell**

```
ACTION: Click the notification bell icon
EXPECTED: Dropdown menu opens
VERIFY DROPDOWN CONTENT:
  ✓ Shows title: "Recent Notifications" or "Notifications"
  ✓ Lists recent notifications (last 5)
  ✓ Your new schedule proposal appears in list
```

**Verify Notification Item in Dropdown**:

```
ITEM TEXT SHOULD CONTAIN:
  ✓ Emoji: 📅
  ✓ Title: "Schedule Proposal - Tournament Name"
  ✓ Message: "[Player1] proposed schedule: 2026-04-30 14:00 UTC"
  ✓ Comment line: "💬 I'm available earlier in the day if needed..."
  ✓ Time: "a few seconds ago" or "just now"

VISUAL STRUCTURE:
  ┌──────────────────────────────────┐
  │ 🔔 Recent Notifications          │
  ├──────────────────────────────────┤
  │ 📅 Schedule Proposal - Tournament│
  │    Player1 proposed schedule...  │
  │    💬 I'm available earlier... ✅│
  │    2 seconds ago                 │
  └──────────────────────────────────┘
```

**Verify Character Truncation**:
```
ACTION: In dropdown, examine the comment line
VERIFY:
  ✓ Message starts with 💬 emoji
  ✓ Text is truncated to ~60 characters
  ✓ Ends with "..." if original message is longer than 60 chars
  ✓ Hover tooltip (optional): might show full text
```

---

### UI Verification Phase 2: Notifications Page

**Action: Go to Notifications Page**

```
ACTION: While logged in as Player 2
ACTION: Navigate to "Notifications" page (usually in menu or profile dropdown)
ACTION: Click "Pending" filter tab
VERIFY PAGE LOADS:
  ✓ Filter tabs visible: "All", "Pending", "Accepted"
  ✓ "Pending" tab is highlighted/selected
  ✓ List of pending notifications shows
```

**Locate the Schedule Proposal Notification**:

```
VERIFY IN LIST:
  ✓ Schedule proposal notification appears
  ✓ Notification card shows:
    - Emoji: 📅
    - Title: "Schedule Proposal - Tournament Name"
    - Main message: "[Player1] proposed schedule: 2026-04-30 14:00 UTC"
    - Blue dot indicator (unread status)
    - Timestamp

NOTIFICATION CARD LAYOUT:
  ┌─────────────────────────────────────┐
  │ 📅 Schedule Proposal - Tournament   │●
  │ Player1 proposed schedule:          │
  │ 2026-04-30 14:00 UTC                │
  │                                     │
  │ ┃ Message: I'm available earlier   │ ← STYLED BOX
  │ ┃ in the day if needed              │
  │                                     │
  │ 2026-04-29 12:34  ✓ Delete          │
  └─────────────────────────────────────┘
```

**Verify Comment Display**:

```
SPECIFIC CHECKS FOR COMMENT BOX:
  ✓ Background color: Light gray
  ✓ Left border: 4px blue line
  ✓ Text: "Message:" label in bold
  ✓ Text: Full comment text visible (not truncated)
  ✓ Text: Italic font style
  ✓ Text: Smaller font size than main message
  ✓ Padding: Comfortable spacing inside box

EXACT TEXT SHOWN:
  "Message: I'm available earlier in the day if needed"
```

---

### Edge Case Tests

#### Edge Case 1: Empty/No Comment

```
SETUP: Propose schedule WITHOUT adding comment
VERIFY DATABASE:
  ✓ message_extra column is NULL (not empty string)
  
VERIFY NAVBAR:
  ✓ No 💬 line appears in dropdown
  
VERIFY NOTIFICATIONS PAGE:
  ✓ No message box shown for this notification
  ✓ Only main notification content visible
```

#### Edge Case 2: Maximum Length (500 chars)

```
SETUP: 
  ACTION: Propose schedule with exactly 500 character message
  ACTION: Generate 500 char text (copy/paste from text generator)
  ACTION: Paste into textarea
  
VERIFY FRONTEND:
  ✓ All 500 characters accepted
  ✓ Counter shows "500/500 characters"
  ✓ Character 501+ is not added (maxLength enforcement)
  
VERIFY DATABASE:
  SELECT LENGTH(message_extra) from user_notifications 
  WHERE type='schedule_proposal' ORDER BY created_at DESC LIMIT 1
  
  ✓ Result: 500 (exactly 500, not truncated)
  
VERIFY UI:
  ✓ Full 500 char message visible in comment box
```

#### Edge Case 3: Special Characters

```
SETUP:
  ACTION: Propose with comment containing special chars:
         "I'm available! Can we do 2-3pm? Unicode: 你好 Emoji: 👍"
  
VERIFY DATABASE:
  ✓ Special characters preserved (not escaped)
  ✓ Message_extra contains exact text as typed
  
VERIFY UI:
  ✓ Emoji renders correctly: 👍
  ✓ Unicode characters display: 你好
  ✓ Apostrophe displays: I'm
  ✓ Question mark displays: ?
  ✓ Exclamation mark displays: !
```

#### Edge Case 4: Whitespace Handling

```
SETUP:
  ACTION: Propose with message: "   spaces before and after   "
  
VERIFY DATABASE:
  SELECT message_extra FROM user_notifications 
  WHERE type='schedule_proposal' ORDER BY created_at DESC LIMIT 1
  
  ✓ Result: "spaces before and after" (trimmed, no leading/trailing spaces)
  
VERIFY UI:
  ✓ Message displays without excessive whitespace
```

---

## Test Results Checklist

### Frontend Tests
- [ ] Modal opens successfully
- [ ] Date input accepts valid dates
- [ ] Time input accepts valid times
- [ ] Message textarea accepts input
- [ ] Character counter updates correctly
- [ ] Frontend enforces 500 char max
- [ ] Propose button works
- [ ] Success message appears
- [ ] Modal closes after submit
- [ ] No error messages for valid input

### Database Tests
- [ ] message_extra column exists
- [ ] Notification created with type='schedule_proposal'
- [ ] message_extra contains correct text
- [ ] message_extra is NULL for proposals without comment
- [ ] message_extra does not exceed 500 chars
- [ ] User receives notification (opponent_id)
- [ ] Timestamp is recent and accurate

### UI Display Tests (Navbar)
- [ ] Notification bell shows badge with count
- [ ] Dropdown opens on click
- [ ] Schedule proposal appears in dropdown
- [ ] Comment line shows with 💬 emoji
- [ ] Comment is truncated to ~60 chars
- [ ] Comment ends with "..." if longer

### UI Display Tests (Notifications Page)
- [ ] Notifications page loads
- [ ] Pending filter tab works
- [ ] Schedule proposal appears in list
- [ ] Blue unread indicator visible
- [ ] Main message displays correctly
- [ ] Comment appears in styled box
- [ ] Comment box has blue left border
- [ ] Comment box has gray background
- [ ] Full comment text visible (not truncated)
- [ ] Special characters display correctly
- [ ] Timestamp displays in correct timezone

### Security Tests
- [ ] XSS prevention: Special characters rendered safely
- [ ] SQL injection: Parameterized queries used
- [ ] Input validation: Backend rejects >500 char
- [ ] Type validation: Backend rejects non-string types
- [ ] Null handling: NULL values handled gracefully

### Performance Tests
- [ ] Notification loads within 2 seconds
- [ ] UI responsive with 500 char message
- [ ] Database query completes quickly
- [ ] No lag when typing in textarea

---

## Troubleshooting Guide

### Issue: Comment not appearing in database

**Check Steps**:
```
1. Verify message_extra column exists:
   DESCRIBE user_notifications;
   
2. Check backend validation logs:
   Look for: "Schedule message must be a string" or length error
   
3. Verify request was sent:
   Browser DevTools → Network tab → POST propose-schedule
   Check request body includes scheduleMessage
   
4. Check notification was created:
   SELECT COUNT(*) FROM user_notifications 
   WHERE type='schedule_proposal'
   AND created_at > DATE_SUB(NOW(), INTERVAL 1 MINUTE);
```

### Issue: Comment not showing in UI

**Check Steps**:
```
1. Refresh page (cache issue):
   Browser → F5 or Cmd+Shift+R (hard refresh)
   
2. Check API response includes message_extra:
   Browser DevTools → Network tab → GET /api/notifications
   Look in response JSON for message_extra field
   
3. Check NotificationsList component renders:
   Browser DevTools → Elements tab
   Search for: "message_extra" or look for styled box
   
4. Check for JavaScript errors:
   Browser DevTools → Console tab
   Look for red error messages
```

### Issue: Character counter not updating

**Check Steps**:
```
1. Check textarea onChange handler:
   Browser DevTools → Elements tab → Find textarea
   
2. Verify state updates:
   React DevTools extension (if installed)
   Watch scheduleMessage state change as you type
   
3. Clear browser cache:
   Ctrl+Shift+Delete or Cmd+Shift+Delete
   Clear cache and reload
```

### Issue: Backend rejecting message as "too long"

**Check Steps**:
```
1. Count actual characters typed:
   Verify character counter shows ≤ 500
   
2. Check for hidden characters:
   Paste into text editor and look for extra whitespace
   
3. Test with shorter message:
   Try comment under 100 characters first
```

---

## Success Criteria

✅ **All tests pass when**:

1. **Modal accepts message input** without errors
2. **Database stores message_extra** with correct text
3. **API returns message_extra** in notification objects
4. **UI displays comment** in notifications page
5. **UI displays comment** in navbar dropdown with 💬 emoji
6. **No error messages** appear during normal flow
7. **Character limit enforced** at 500 chars
8. **Special characters** display correctly
9. **Whitespace trimmed** on backend
10. **NULL values handled** when no comment provided

---

## Sign-Off

**Test Execution Date**: _______________  
**Tester Name**: _______________  
**Test Environment**: Development / Staging / Production  
**Browser**: _______________  
**Database**: _______________  

**Overall Result**: ☐ PASS ☐ FAIL ☐ BLOCKED  

**Notes/Issues Found**:
```
[Space for notes]
```

**Approved By**: _______________  
**Date**: _______________
