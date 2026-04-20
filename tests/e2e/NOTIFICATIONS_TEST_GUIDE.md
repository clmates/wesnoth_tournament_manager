# E2E Test Guide: Notifications Page Functionality

## Overview
This guide provides step-by-step manual testing procedures for the Notifications tab in the User profile page.

## Prerequisites
- Frontend running on `http://localhost:5173`
- Backend running on `http://localhost:3000`
- User account created and able to login
- Test data: Notifications available in the system

## Test Environment Setup

### Start Backend
```bash
cd /home/carlos/programacion/wesnoth_tournament_manager/backend
npm run dev
```

### Start Frontend
```bash
cd /home/carlos/programacion/wesnoth_tournament_manager/frontend
npm run dev
```

## Test Procedures

### ✅ TEST 1: Navigation and Tab Visibility

**Steps:**
1. Navigate to `http://localhost:5173/user`
2. Look at the top of the page for tab buttons
3. Verify you see these tabs in order:
   - Overall
   - Matches
   - Opponents
   - By Map
   - By Faction
   - **Notifications** ← Should be the last tab

**Expected Result:**
- All 6 tabs are visible
- Notifications tab is clickable
- Page loads without errors
- No error messages in browser console

**Test Result:** [PASS/FAIL]
- [ ] Notifications tab visible
- [ ] Tab is clickable
- [ ] No console errors

---

### ✅ TEST 2: Filter Tabs Functionality

**Steps:**
1. Click on the "Notifications" tab
2. Verify three filter buttons appear below the tabs:
   - "All"
   - "Pending"
   - "Accepted"
3. Click on "All" filter
   - Verify: Blue bottom border appears on the button
   - Verify: Notification list updates (if notifications exist)
4. Click on "Pending" filter
   - Verify: Blue bottom border moves to "Pending" button
   - Verify: Only pending notifications are shown
5. Click on "Accepted" filter
   - Verify: Blue bottom border moves to "Accepted" button
   - Verify: Only accepted notifications are shown
6. Click back on "All" filter

**Expected Result:**
- Filter buttons have visual feedback (blue bottom border)
- Notification list updates when filter changes
- No error messages appear

**Test Result:** [PASS/FAIL]
- [ ] All filter exists
- [ ] Pending filter exists
- [ ] Accepted filter exists
- [ ] Filter styling changes (blue border)
- [ ] Notification list updates per filter
- [ ] No console errors

---

### ✅ TEST 3: Notification List Display

**Steps:**
1. Click on "Notifications" tab
2. Verify notifications display with ALL of these fields:

   a) **Icon** (top-left of each notification)
      - Should be one of: 📅 (proposal), ✅ (confirmed), ❌ (cancelled), 📬 (other)

   b) **Title** (below icon, in bold text)
      - Example: "Match Schedule Proposal"

   c) **Message** (main text content)
      - Example: "Your match with Player X has been proposed for..."

   d) **Message Extra** (if present, gray box with italics)
      - Appears only if the notification has additional notes
      - Displayed with 💬 or message icon

   e) **Date/Time** (small gray text at bottom)
      - Format: "dd MMM YYYY, HH:mm"
      - Example: "15 Feb 2025, 14:30"

   f) **Unread Indicator** (if unread)
      - Small blue dot (●) in top-right corner of title area

**Expected Result:**
- Each notification displays all required fields
- Icons are appropriate to notification type
- Date/time is formatted correctly
- Unread indicators (blue dots) show only for unread messages

**Test Result:** [PASS/FAIL]
- [ ] Icons display correctly
- [ ] Titles visible
- [ ] Messages visible
- [ ] Dates visible
- [ ] Unread indicators (blue dots) present for unread
- [ ] Message extra displayed when present

---

### ✅ TEST 4: Mark as Read Action

**Steps:**
1. Scroll to find an unread notification (has blue dot in top-right)
2. Verify a "✓" button appears on the right side
3. Click the "✓" button
4. Verify:
   - Blue dot (unread indicator) disappears
   - Notification background changes from blue-tinted to white
   - Button disappears (mark as read only shows for unread)
   - No error messages appear

**Expected Result:**
- Mark as read action completes successfully
- UI updates immediately to show notification is now read
- No error messages in console

**Test Result:** [PASS/FAIL]
- [ ] ✓ button clickable
- [ ] Blue dot disappears after click
- [ ] No console errors
- [ ] Notification still in list

---

### ✅ TEST 5: Delete Notification Action

**Steps:**
1. Find any notification in the list
2. Verify a "🗑️" button appears on the right side
3. Click the "🗑️" button
4. Verify:
   - Notification is removed from the list
   - Total notification count decreases
   - No error messages appear
   - Page remains stable

**Expected Result:**
- Delete action completes successfully
- Notification is removed from the list
- No error messages in console

**Test Result:** [PASS/FAIL]
- [ ] 🗑️ button clickable
- [ ] Notification removed from list
- [ ] List updates correctly
- [ ] No console errors

---

### ✅ TEST 6: Pagination

**Steps:**
1. Count the number of notifications in the "All" filter
2. If there are 20 or more notifications:
   - Verify pagination controls appear at the bottom:
     - "← Previous" button (disabled on first page)
     - Page indicator showing "1 - 20 of [total]"
     - "Next →" button
   - Click "Next →" button
   - Verify:
     - Different notifications display
     - Page indicator updates (e.g., "21 - 40 of [total]")
     - "← Previous" button becomes enabled
   - Click "← Previous" button
   - Verify:
     - Original notifications display again
     - Page indicator updates back to "1 - 20 of [total]"

3. If there are less than 20 notifications:
   - Pagination controls should NOT appear

**Expected Result:**
- Pagination controls work correctly (if applicable)
- Navigation between pages works
- Correct notifications display on each page

**Test Result:** [PASS/FAIL]
- [ ] Pagination visible (if >20 notifications)
- [ ] Next button works
- [ ] Previous button works
- [ ] Page indicator correct
- [ ] Pagination not shown (if <20 notifications)

---

### ✅ TEST 7: Direct URL Access

**Steps:**
1. Navigate directly to: `http://localhost:5173/user?tab=notifications`
2. Verify:
   - Page loads without errors
   - Notifications tab is active (shown as selected)
   - Filter buttons (All, Pending, Accepted) are visible
   - Notification list displays correctly
   - No console errors

**Expected Result:**
- Direct URL access works correctly
- Notifications tab loads immediately
- All functionality available

**Test Result:** [PASS/FAIL]
- [ ] Page loads correctly
- [ ] Notifications tab active
- [ ] Filter buttons visible
- [ ] Notifications display
- [ ] No console errors

---

### ✅ TEST 8: Browser Console - No Critical Errors

**Steps:**
1. Open Browser Developer Tools (F12 or Cmd+Option+I)
2. Go to the "Console" tab
3. Navigate through all notification tests (tabs, filters, actions)
4. Check for error messages (red text with ✕ symbol)

**Expected Result:**
- No errors related to notification component
- No 4xx or 5xx API errors
- No JavaScript errors in application code

**Acceptable (Non-critical) Errors:**
- CORS warnings from third-party scripts
- 404 errors for favicon or unrelated resources
- Warnings from external libraries

**Test Result:** [PASS/FAIL]
- [ ] No critical console errors
- [ ] No API 5xx errors
- [ ] No application JavaScript errors

---

## Summary Results

| Test | Status | Notes |
|------|--------|-------|
| 1. Navigation & Tabs | [ ] PASS / [ ] FAIL | |
| 2. Filter Buttons | [ ] PASS / [ ] FAIL | |
| 3. Notification Display | [ ] PASS / [ ] FAIL | |
| 4. Mark as Read | [ ] PASS / [ ] FAIL | |
| 5. Delete Notification | [ ] PASS / [ ] FAIL | |
| 6. Pagination | [ ] PASS / [ ] FAIL | |
| 7. Direct URL Access | [ ] PASS / [ ] FAIL | |
| 8. Console Errors | [ ] PASS / [ ] FAIL | |

### Overall Status: [ ] ALL PASS / [ ] SOME FAILURES

**Failures Found:**
- [ ] None
- [ ] See detailed notes below

**Detailed Notes:**
```
[Add any issues, bugs, or unexpected behavior found during testing]
```

---

## Automated Test Execution

To run the automated Playwright E2E tests:

```bash
# Make sure servers are running first:
# Terminal 1: cd backend && npm run dev
# Terminal 2: cd frontend && npm run dev

# Terminal 3: Run tests
cd /home/carlos/programacion/wesnoth_tournament_manager
npx playwright test tests/e2e/notifications-page.spec.ts
```

**View Test Report:**
```bash
npx playwright show-report
```

---

## Troubleshooting

### Issue: "Cannot find element"
- Verify you're on the correct page (/user)
- Verify you're logged in
- Check browser console for errors

### Issue: "API Error" messages
- Verify backend is running (http://localhost:3000)
- Check backend logs for errors
- Verify authentication token is valid

### Issue: "No notifications displayed"
- Create test notifications in the backend/admin
- Verify API endpoint returns data: `curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/notifications`

### Issue: Filters not updating
- Verify filter buttons are clickable
- Check browser console for JavaScript errors
- Try refreshing the page

---

## Notes for Developers

The Notifications component is located at:
- Component: `/frontend/src/components/NotificationsList.tsx`
- Page: `/frontend/src/pages/User.tsx`
- API Service: `/frontend/src/services/notificationService.ts`
- Store: `/frontend/src/stores/notificationStore.ts`

Key API Endpoints:
- GET `/api/notifications` - Get all notifications (with pagination)
- GET `/api/notifications/pending` - Get pending notifications
- GET `/api/notifications/accepted` - Get accepted notifications
- POST `/api/notifications/{id}/mark-read` - Mark as read
- POST `/api/notifications/{id}/delete` - Delete notification

---

## Test Data Requirements

For complete testing, ensure the following test data exists:
- At least 1 unread notification
- At least 1 schedule_proposal notification (📅)
- At least 1 schedule_confirmed notification (✅)
- At least 1 schedule_cancelled notification (❌)
- Optionally: 1+ notifications with message_extra field
- Optionally: 25+ notifications (to test pagination)

---

**Test Date:** _______________  
**Tester Name:** _______________  
**Environment:** localhost (development)  
**Browser:** _______________  
**Browser Version:** _______________  
