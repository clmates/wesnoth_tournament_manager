# Quick Reference: Balance Event Forward Impact

## 🎯 What Changed?

**OLD BEHAVIOR:** Selected a balance event → showed stats from 30 days before to 30 days after  
**NEW BEHAVIOR:** Selected a balance event → shows stats from event date onwards to next event (or today)

**Key Quote:** "lo que tengo que ver al seleccionar un balance event es siempre desde ese balance event hacia adelante"

---

## 📋 Implementation Status

| Component | Status | Details |
|-----------|--------|---------|
| SQL Function | ✅ Ready | `get_balance_event_forward_impact()` in migration file |
| Backend API | ✅ Ready | Simplified endpoint, calls new function |
| Frontend Service | ✅ Ready | Removed daysBefore/daysAfter parameters |
| React Component | ✅ Ready | Updated table, new interface |
| Translations | ✅ Ready | All 5 languages updated with new keys |

---

## 🧪 How to Test

### 1. **Apply Database Migration**
```bash
cd backend
psql $DATABASE_URL -f migrations/20251229_balance_event_forward_impact.sql
```

### 2. **Verify Function Exists**
```sql
SELECT * FROM get_balance_event_forward_impact('event-id-here');
```

### 3. **Test Backend Endpoint**
```bash
curl http://localhost:5000/api/statistics/history/events/{eventId}/impact
```

**Expected Response:**
```json
[
  {
    "map_id": "uuid",
    "map_name": "River Crossing",
    "faction_id": "uuid",
    "faction_name": "Elves",
    "opponent_faction_id": "uuid",
    "opponent_faction_name": "Orcs",
    "winrate": 52.3,
    "total_games": 127,
    "wins": 66,
    "losses": 61,
    "snapshot_date": "2025-12-23",
    "days_since_event": 27
  },
  ...
]
```

### 4. **Test Frontend**
- Start frontend: `npm start`
- Navigate to: Admin → Balance Events
- Click on a balance event
- Verify table appears with columns: **Date | Days Since | Map | Matchup | Win Rate | Games**

### 5. **Verify Translations**
- Change language in top-right selector
- Verify table headers and labels translate correctly
- Check all 5 languages: EN, ES, DE, RU, ZH

---

## 📊 Data Requirements

**For testing to work, you need:**

1. ✅ At least one **balance event** in `balance_events` table
   - `event_date` set (e.g., 2025-11-26)
   - `event_type`, `description` populated
   
2. ✅ Daily **snapshots** in `faction_map_statistics_history` table
   - Dates between event_date and today (or next event)
   - If missing, run: `backend/scripts/recalculate_statistics_history.sql`

3. ✅ **Match data** with proper dates
   - Must have matches with `created_at` after balance event

---

## 🎨 Visual Layout

```
┌─ BALANCE EVENT IMPACT PANEL ─────────────────────────────┐
│                                                            │
│ SELECT BALANCE EVENT:                                     │
│ [All] [Nov 26 - Buff] [Dec 2 - Nerf] [Dec 15 - Hotfix]   │
│                                                            │
│ EVENT DETAILS:                                            │
│ Type: Buff                Date: Nov 26, 2025              │
│ Description: Increased Elf archer damage by 10%           │
│ Faction: Elves            Map: (all maps)                 │
│                                                            │
│ BALANCE STATISTICS FROM EVENT DATE:                       │
│ ┌─────────────────────────────────────────────────────┐  │
│ │Date       │Days│Map    │Faction    │vs Opponent│WR%│Gm│
│ ├─────────────────────────────────────────────────────┤  │
│ │2025-12-23│27  │River  │Elves      │vs Orcs │52.3%│127│
│ │2025-12-26│30  │River  │Elves      │vs Orcs │51.8%│142│
│ │2025-12-27│31  │River  │Elves      │vs Orcs │53.2%│156│
│ └─────────────────────────────────────────────────────┘  │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

## 🔧 File Changes Summary

### New Files
- `backend/migrations/20251229_balance_event_forward_impact.sql` - SQL function

### Modified Backend
- `backend/src/routes/statistics.ts` - Updated endpoint at line 288

### Modified Frontend
- `frontend/src/services/statisticsService.ts` - Line 66
- `frontend/src/components/BalanceEventImpactPanel.tsx` - Lines 95, 175-210
- `frontend/src/i18n/locales/*.json` - All 5 language files

---

## ❌ Common Issues & Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| Table shows "No data available" | No snapshots in date range | Run recalculate script |
| Event not found error | Invalid event ID | Verify event exists in DB |
| Columns missing or misaligned | Translation keys undefined | Check i18n files loaded |
| Dates show wrong timezone | User locale issue | Use browser locale format |
| Winrate shows as NaN | Bad snapshot data | Verify faction_map_statistics_history |

---

## 🚀 Production Checklist

- [ ] Migration applied to production DB
- [ ] Backend redeployed with updated code
- [ ] Frontend rebuilt with new translations
- [ ] Tested with at least 2 balance events
- [ ] All 5 languages verified
- [ ] Error messages tested (missing data, invalid event)
- [ ] Performance tested (load time < 1s)
- [ ] Mobile responsive layout checked
- [ ] Analytics updated (if tracking impact views)
- [ ] Documentation linked in admin guide

---

## 📞 Support Info

**If snapshots are missing:**
```bash
# Run manual recalculation
psql $DATABASE_URL -f backend/scripts/recalculate_statistics_history.sql
```

**To verify function exists:**
```bash
psql $DATABASE_URL -c "SELECT * FROM information_schema.routines WHERE routine_name = 'get_balance_event_forward_impact';"
```

**To check snapshot dates:**
```sql
SELECT DISTINCT snapshot_date FROM faction_map_statistics_history 
ORDER BY snapshot_date DESC LIMIT 10;
```

---

## 📖 Key SQL Logic

```sql
-- Find event date and next event (or today)
event_date = (FROM balance_events WHERE id = :eventId)
next_event_date = (FROM balance_events WHERE event_date > :event_date, 
                   OR CURRENT_DATE if none exist)

-- Get snapshots in that range
RETURN snapshots WHERE snapshot_date BETWEEN event_date AND next_event_date
WITH days_since_event = (snapshot_date - event_date)::INT
```

---

**Last Updated:** 2025-12-29  
**Status:** Implementation Complete ✅  
**Ready for:** Testing & Deployment
