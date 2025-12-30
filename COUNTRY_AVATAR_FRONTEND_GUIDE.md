# Country & Avatar Implementation Guide

This document explains how to integrate the new country selector and avatar picker with multilingual support into your frontend pages.

## Overview

The implementation consists of:
1. **Backend**: Countries table with JSONB multilingual names, avatars table, updated routes
2. **Frontend**: Reusable `CountrySelector` and `AvatarSelector` components with full i18n support
3. **Services**: `countryAvatarService` for caching and data retrieval
4. **Styling**: Responsive CSS with theme variable support

## Setup Steps

### 1. Database Migration

Execute the migration to create the required tables:

```bash
# In your database client
psql -d your_database < backend/migrations/20251230_add_country_and_avatar.sql
```

This creates:
- `countries` table with `names_json` (JSONB) for multilingual support
- `player_avatars` table with avatar metadata
- Adds `country` and `avatar` columns to `users` table

### 2. Populate Countries Data

Generate and insert countries with all translations:

```bash
cd backend/scripts
python generate_countries_with_translations.py
```

This script:
- Fetches 250+ countries from REST Countries API
- Generates translations in: en, es, de, ru, zh
- Creates `countries_insert.sql` with SQL INSERT statements
- Creates `frontend/src/data/countries.json` with lookup data

Then execute the generated SQL:

```bash
psql -d your_database < scripts/countries_insert.sql
```

### 3. Populate Wesnoth Avatars

Download avatars from the official Wesnoth documentation:

```bash
cd backend/scripts
python download_wesnoth_avatars.py
```

This script:
- Fetches unit icons from the Wesnoth 1.18 Default Era
- Saves PNG files to `frontend/public/wesnoth-units/`
- Generates `manifest.json` with avatar metadata

Then populate the database:

```bash
# You'll need to create a script to insert avatars, or do it manually:
INSERT INTO player_avatars (name, icon_path, description)
SELECT name, filename, description FROM (
  -- Load from manifest.json and insert
) as avatars;
```

### 4. Update Frontend Pages

Import and use the components in your pages:

#### Register.tsx

```tsx
import { CountrySelector } from '../components/CountrySelector';
import { AvatarSelector } from '../components/AvatarSelector';

export const Register = () => {
  const [formData, setFormData] = useState({
    nickname: '',
    email: '',
    password: '',
    language: 'en',
    country: '',
    avatar: '',
    discord_id: ''
  });

  const handleCountryChange = (countryCode: string) => {
    setFormData({ ...formData, country: countryCode });
  };

  const handleAvatarChange = (avatarId: string) => {
    setFormData({ ...formData, avatar: avatarId });
  };

  return (
    <form onSubmit={handleSubmit}>
      {/* existing fields */}
      
      <CountrySelector
        value={formData.country}
        onChange={handleCountryChange}
      />
      
      <AvatarSelector
        value={formData.avatar}
        onChange={handleAvatarChange}
      />
      
      <button type="submit">{t('auth.register')}</button>
    </form>
  );
};
```

#### Profile.tsx

```tsx
import { CountrySelector } from '../components/CountrySelector';
import { AvatarSelector } from '../components/AvatarSelector';

export const Profile = () => {
  const [profile, setProfile] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);

  const handleProfileUpdate = async (country?: string, avatar?: string) => {
    setIsSaving(true);
    try {
      await userService.updateProfile({ country, avatar });
      setProfile({ ...profile, country, avatar });
      showSuccessMessage(t('profile.updated'));
    } catch (error) {
      showErrorMessage(t('profile.updateFailed'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="profile-container">
      {/* Profile info */}
      
      <CountrySelector
        value={profile?.country}
        onChange={(country) => handleProfileUpdate(country, profile?.avatar)}
        disabled={isSaving}
      />
      
      <AvatarSelector
        value={profile?.avatar}
        onChange={(avatar) => handleProfileUpdate(profile?.country, avatar)}
        disabled={isSaving}
      />
    </div>
  );
};
```

#### Players.tsx / Rankings.tsx

Display country flag and avatar in player lists:

```tsx
import { Country } from '../services/countryAvatarService';

interface PlayerRowProps {
  player: {
    id: string;
    nickname: string;
    country?: string;
    avatar?: string;
    // ... other fields
  };
  countries: Country[];
}

const PlayerRow: React.FC<PlayerRowProps> = ({ player, countries }) => {
  const playerCountry = countries.find(c => c.code === player.country);
  
  return (
    <tr>
      <td className="player-avatar">
        {player.avatar && (
          <img 
            src={`/wesnoth-units/${player.avatar}.png`} 
            alt="avatar"
            className="avatar-thumbnail"
          />
        )}
      </td>
      <td className="player-country">
        {playerCountry ? (
          <span title={playerCountry.name} className="country-badge">
            {playerCountry.flag}
          </span>
        ) : null}
      </td>
      <td className="player-name">{player.nickname}</td>
      {/* ... other columns */}
    </tr>
  );
};
```

## API Endpoints

### Get Countries (with translations)

```
GET /users/data/countries?lang=es
```

Response:
```json
[
  {
    "code": "ES",
    "name": "España",
    "flag": "🇪🇸",
    "official_name": "Kingdom of Spain",
    "region": "Europe",
    "names": {
      "en": "Spain",
      "es": "España",
      "de": "Spanien",
      "ru": "Испания",
      "zh": "西班牙"
    }
  }
]
```

### Get Avatars

```
GET /wesnoth-units/manifest.json
```

Response:
```json
{
  "version": "1.0",
  "total": 150,
  "avatars": [
    {
      "id": "archer",
      "name": "Archer",
      "path": "/wesnoth-units/archer.png",
      "filename": "archer.png"
    }
  ]
}
```

### Update Profile (Country & Avatar)

```
PUT /users/profile/update
Content-Type: application/json

{
  "country": "ES",
  "avatar": "archer"
}
```

Response:
```json
{
  "id": "...",
  "nickname": "...",
  "country": "ES",
  "avatar": "archer",
  "...": "..."
}
```

## Styling & Customization

The components use CSS custom properties (variables) for theming. Add these to your main stylesheet:

```css
:root {
  --text-primary: #333;
  --text-secondary: #666;
  --bg-secondary: #fff;
  --bg-tertiary: #f5f5f5;
  --bg-disabled: #f5f5f5;
  --border-color: #ccc;
  --accent-color: #4a90e2;
  --accent-light: #f0f7ff;
}
```

## Internationalization

The components automatically use the current i18n language. Translation keys used:

- `profile.country` - "Country" label
- `profile.avatar` - "Avatar" label
- `common.select` - "Select Country" placeholder
- `common.search` - "Search..." placeholder
- `common.loading` - "Loading..." message
- `common.noResults` - "No countries found" message

Add these to your locale files (`en.json`, `es.json`, etc.)

## Troubleshooting

### Countries dropdown not loading
- Check that `GET /users/data/countries` returns valid data
- Verify the countries table is populated with `names_json` data
- Check browser console for API errors

### Avatar images not showing
- Verify `frontend/public/wesnoth-units/manifest.json` exists
- Check that PNG files are in `frontend/public/wesnoth-units/`
- Check browser network tab for 404 errors

### Translations not working
- Ensure i18n is properly initialized in your app
- Check that translation keys exist in all locale files
- Verify `useTranslation()` hook is called in components

## Performance Considerations

- Both services cache data (1 hour default cache duration)
- Countries are sorted by English name in the database query
- Avatar images use `pixelated` rendering for better retro appearance
- Dropdown is lazy-loaded only when opened

## Future Enhancements

- [ ] Avatar upload functionality for custom avatars
- [ ] Country flag search by region
- [ ] Avatar filtering by category/faction
- [ ] Flag emoji fallbacks for older browsers
- [ ] Custom country mapping for regions
