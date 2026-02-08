# Country & Avatar Implementation Checklist

## Database Setup
- [ ] Run migration: `psql < backend/migrations/20251230_add_country_and_avatar.sql`
  - [ ] Verify `countries` table created with `names_json` column
  - [ ] Verify `player_avatars` table created
  - [ ] Verify `country` and `avatar` columns added to `users` table

## Generate Data
- [ ] Run: `python backend/scripts/generate_countries_with_translations.py`
  - [ ] Check that `scripts/countries_insert.sql` was created
  - [ ] Check that `frontend/src/data/countries.json` was created
  - [ ] Verify file contains 250+ countries with translations in all 5 languages
  
- [ ] Run: `python backend/scripts/download_wesnoth_avatars.py`
  - [ ] Check that PNG files are in `frontend/public/wesnoth-units/`
  - [ ] Check that `frontend/public/wesnoth-units/manifest.json` was created
  - [ ] Verify manifest contains valid avatar entries

- [ ] Run: `python backend/scripts/update_translations.py`
  - [ ] Verify all `.json` locale files were updated
  - [ ] Check that `common` section added with translations
  - [ ] Check that `profile` section includes `country`, `avatar`, `updated` keys

## Database Seeding
- [ ] Execute countries SQL: `psql < scripts/countries_insert.sql`
  - [ ] Verify 250+ rows inserted in `countries` table
  - [ ] Sample query: `SELECT COUNT(*) FROM countries WHERE is_active = true;`

- [ ] Populate avatars in database (manual or script):
  - [ ] Option A: Create a script to read `manifest.json` and insert into `player_avatars`
  - [ ] Option B: Manually insert sample avatars for testing
  - [ ] Verify avatars table has entries
  - [ ] Sample query: `SELECT COUNT(*) FROM player_avatars WHERE is_active = true;`

## Backend Verification
- [ ] Test endpoint: `GET /users/data/countries?lang=en`
  - [ ] Returns array of countries
  - [ ] Each country has: `code`, `name`, `flag`, `names`
  - [ ] Names includes all languages: en, es, de, ru, zh

- [ ] Test endpoint: `GET /users/data/avatars`
  - [ ] Returns array of avatars
  - [ ] Each avatar has: `id`, `name`, `icon_path`, `description`

- [ ] Test endpoint: `POST /auth/register` with new fields
  - [ ] Accepts `country` (optional)
  - [ ] Accepts `avatar` (optional)
  - [ ] Fields stored in database

- [ ] Test endpoint: `PUT /users/profile/update`
  - [ ] Accepts `country` (optional)
  - [ ] Accepts `avatar` (optional)
  - [ ] Returns updated user profile

- [ ] Verify country/avatar in GET requests
  - [ ] `GET /users/profile` includes `country` and `avatar`
  - [ ] `GET /users/ranking/global` includes `country` and `avatar` in player data
  - [ ] `GET /users/all` includes `country` and `avatar`
  - [ ] `GET /public/players/:id` includes `country` and `avatar`

## Frontend Components
- [ ] Verify `CountrySelector` component created
  - [ ] File: `frontend/src/components/CountrySelector.tsx`
  - [ ] Styles: `frontend/src/styles/CountrySelector.css`
  - [ ] Service: `frontend/src/services/countryAvatarService.ts`

- [ ] Verify `AvatarSelector` component created
  - [ ] File: `frontend/src/components/AvatarSelector.tsx`
  - [ ] Styles: `frontend/src/styles/AvatarSelector.css`

- [ ] Test CountrySelector component
  - [ ] [ ] Dropdown opens/closes
  - [ ] [ ] Search filters countries
  - [ ] [ ] Selection triggers onChange callback
  - [ ] [ ] Displays flag emoji
  - [ ] [ ] Shows country name in selected language

- [ ] Test AvatarSelector component
  - [ ] [ ] Grid displays all avatars
  - [ ] [ ] Preview shows selected avatar
  - [ ] [ ] Selection triggers onChange callback
  - [ ] [ ] Images load correctly
  - [ ] [ ] Selected state shows checkmark

## Frontend Pages Integration

### Register.tsx
- [ ] Import `CountrySelector` and `AvatarSelector`
- [ ] Add country field to form state
- [ ] Add avatar field to form state
- [ ] Render country selector
- [ ] Render avatar selector
- [ ] Send both fields with registration request
- [ ] Test registration with country and avatar
- [ ] Test registration without country and avatar (optional)

### Profile.tsx
- [ ] Import `CountrySelector` and `AvatarSelector`
- [ ] Load user profile including country/avatar
- [ ] Display current country selection
- [ ] Display current avatar selection
- [ ] Implement update handler for country changes
- [ ] Implement update handler for avatar changes
- [ ] Show success message after update
- [ ] Show error message on failure
- [ ] Disable selectors while saving
- [ ] Test country update
- [ ] Test avatar update

### Rankings.tsx / Players.tsx
- [ ] Import countries service
- [ ] Load countries list on component mount
- [ ] Display country flag in player rows
- [ ] Display avatar thumbnail in player grid
- [ ] Add tooltip for country name
- [ ] Responsive layout for mobile
- [ ] Test flag display with various languages
- [ ] Test missing country/avatar handling

## Translations
- [ ] `profile.country` key exists in all locale files
- [ ] `profile.avatar` key exists in all locale files
- [ ] `profile.updated` key exists in all locale files
- [ ] `common.select` key exists in all locale files
- [ ] `common.search` key exists in all locale files
- [ ] `common.loading` key exists in all locale files
- [ ] `common.noResults` key exists in all locale files
- [ ] Test labels in each language: en, es, de, ru, zh

## API Service Layer
- [ ] `userService.updateProfile()` method exists
  - [ ] Accepts `{ country?, avatar? }`
  - [ ] Sends PUT request to `/users/profile/update`
  - [ ] Returns updated profile

- [ ] `countriesService.getCountriesByLanguage()` implemented
  - [ ] Caches results (1 hour)
  - [ ] Respects language parameter
  - [ ] Returns Country[] array

- [ ] `avatarsService.getAvatars()` implemented
  - [ ] Loads manifest from `/wesnoth-units/manifest.json`
  - [ ] Caches results
  - [ ] Returns Avatar[] array

## Testing
- [ ] Manual browser testing
  - [ ] Register with country + avatar
  - [ ] Update profile country/avatar
  - [ ] View rankings with flags/avatars
  - [ ] View player list with flags/avatars
  - [ ] Change language and verify translations

- [ ] API testing (Postman/curl)
  - [ ] GET /users/data/countries with different lang params
  - [ ] GET /users/data/avatars
  - [ ] POST /auth/register with new fields
  - [ ] PUT /users/profile/update with country/avatar
  - [ ] GET /users/profile returns updated data

- [ ] Edge cases
  - [ ] Invalid country code handling
  - [ ] Missing avatar image fallback
  - [ ] Null/undefined country/avatar values
  - [ ] Very long player names with flags
  - [ ] Mobile responsive layout

## Performance
- [ ] Cache duration set appropriately (1 hour)
- [ ] Avatar images optimized (PNG, small file size)
- [ ] Database queries have proper indexes
  - [ ] `idx_countries_active` exists
  - [ ] `idx_player_avatars_active` exists
- [ ] No N+1 queries in player/ranking lists
- [ ] Country dropdown doesn't cause layout shift

## Deployment
- [ ] Database migration run in production
- [ ] Countries data seeded in production
- [ ] Avatars downloaded to production server
- [ ] Frontend build passes without errors
- [ ] Asset paths correct in production environment
- [ ] API endpoints working in production
- [ ] Translations working in production
- [ ] Tested in production environment

## Documentation
- [ ] README updated with country/avatar feature
- [ ] COUNTRY_AVATAR_FRONTEND_GUIDE.md complete and accurate
- [ ] COUNTRY_AVATAR_INTEGRATION_EXAMPLES.md included
- [ ] API documentation updated
- [ ] Translation keys documented

## Rollback Plan (if needed)
- [ ] Keep backup of original database
- [ ] Keep migration rollback script (drop columns/tables)
- [ ] Version control has tagged releases
- [ ] Can revert frontend to previous build

---

## Notes

### First Time Setup Order
1. Run database migration
2. Generate countries + avatars data
3. Update translation files
4. Seed countries into database
5. Seed avatars into database
6. Test backend endpoints
7. Integrate components into frontend pages
8. Test frontend functionality
9. Deploy to production

### Maintenance Tasks
- Monitor avatar image 404 errors
- Monitor countries API performance
- Update REST Countries API data periodically
- Check cache hit rates

### Common Issues & Solutions

**Issue**: Dropdown not loading countries
- **Solution**: Check Network tab in DevTools for API errors, verify `/users/data/countries` endpoint

**Issue**: Avatar images not showing
- **Solution**: Check that PNG files exist in `public/wesnoth-units/`, verify manifest.json path is correct

**Issue**: Translations missing
- **Solution**: Run `update_translations.py` script again, verify all locale files have updated keys

**Issue**: Country flag emoji not displaying
- **Solution**: Check browser/OS supports emoji, can add fallback to text (e.g., "ES" for Spain)
