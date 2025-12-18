# Maps & Factions Multi-Language Implementation Summary

## Changes Made

### 1. Database Migration
**File**: `backend/migrations/033_add_translations_to_maps_and_factions.sql`

New tables created:
- `map_translations`: Stores map names and descriptions in multiple languages
  - Fields: id, map_id, language_code, name, description, created_at, updated_at
  - Unique constraint: (map_id, language_code)

- `faction_translations`: Stores faction names and descriptions in multiple languages
  - Fields: id, faction_id, language_code, name, description, created_at, updated_at
  - Unique constraint: (faction_id, language_code)

- Added `is_active` boolean flag to both `game_maps` and `factions` tables (default: true)
- Added indexes for performance optimization

### 2. Frontend Changes

#### Removed Hardcoded Values
- **TournamentMatchReportModal.tsx**: Removed fallback hardcoded maps/factions, now shows error if data fails to load
- **ReportMatch.tsx**: Same as above - removed hardcoded values
- Updated error messages to inform users to contact administrator

#### New Admin Page
- **AdminMapsAndFactions.tsx**: New admin interface for managing maps and factions
  - Add new maps/factions
  - Toggle active/inactive status
  - Delete maps/factions (with usage check)
  - Tab interface for switching between maps and factions
  - Admin-only access (checks user.is_admin)

- **AdminMapsAndFactions.css**: Styling for the admin interface

### 3. Backend Changes

#### New Admin Routes
- **adminMapsAndFactions.ts**: New router for admin endpoints
  
Maps endpoints:
- `GET /admin/maps` - List all maps
- `GET /admin/maps/:mapId/translations` - Get translations for a map
- `POST /admin/maps` - Create new map
- `PATCH /admin/maps/:mapId` - Update map status (active/inactive)
- `POST /admin/maps/:mapId/translations` - Add/update translation
- `DELETE /admin/maps/:mapId` - Delete map (checks if used in matches)

Factions endpoints:
- `GET /admin/factions` - List all factions
- `GET /admin/factions/:factionId/translations` - Get translations for a faction
- `POST /admin/factions` - Create new faction
- `PATCH /admin/factions/:factionId` - Update faction status (active/inactive)
- `POST /admin/factions/:factionId/translations` - Add/update translation
- `DELETE /admin/factions/:factionId` - Delete faction (checks if used in matches)

#### Updated Routes
- **public.ts**: Modified `/public/maps` and `/public/factions` to only return active items
- **app.ts**: Registered new admin routes

### 4. API Exports
- **api.ts**: Added named export for `api` instance (was only default export)

## Usage

### For Users
1. Report a match - maps and factions are loaded from database (only active ones)
2. If no maps/factions are available, get an error message

### For Admins
1. Navigate to `/admin/maps-and-factions` (new route needed)
2. Switch between Maps and Factions tabs
3. Add new items with English name and description
4. Toggle status (activate/deactivate) - inactive items won't show to users
5. Delete items (only if not used in matches)
6. Future: Add language translations via `/admin/maps/:mapId/translations` endpoint

## Next Steps (Not Implemented)

1. **Frontend Translation Management UI**: Add interface to manage translations for each map/faction
2. **Language-aware API Response**: Return translations based on user's language preference
3. **Add route** for admin page in frontend router
4. **Database seed**: Populate initial maps and factions with translations
5. **API client methods**: Add admin methods to frontend API service
6. **Audit logging**: Track who added/deleted/modified maps and factions

## Database Schema

```
game_maps
├─ id (uuid)
├─ name (varchar)
├─ is_active (boolean)
├─ created_at (timestamp)
└─ usage_count (integer)
    └─ map_translations
       ├─ id (uuid)
       ├─ map_id (uuid) [FK]
       ├─ language_code (varchar) [en, es, de, zh]
       ├─ name (varchar)
       ├─ description (text)
       ├─ created_at (timestamp)
       └─ updated_at (timestamp)

factions
├─ id (uuid)
├─ name (varchar)
├─ is_active (boolean)
├─ created_at (timestamp)
└─ faction_translations
   ├─ id (uuid)
   ├─ faction_id (uuid) [FK]
   ├─ language_code (varchar) [en, es, de, zh]
   ├─ name (varchar)
   ├─ description (text)
   ├─ created_at (timestamp)
   └─ updated_at (timestamp)
```

## API Examples

### Create Map
```bash
POST /api/admin/maps
{
  "name": "Den of Onis",
  "description": "Classic Wesnoth map",
  "language_code": "en"
}
```

### Add Translation
```bash
POST /api/admin/maps/:mapId/translations
{
  "language_code": "es",
  "name": "Guarida de Onis",
  "description": "Mapa clásico de Wesnoth"
}
```

### Public API (User-facing)
```bash
GET /api/public/maps  # Only returns is_active = true
GET /api/public/factions  # Only returns is_active = true
```
