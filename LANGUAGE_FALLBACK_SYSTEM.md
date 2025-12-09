# Language Fallback System - User-Facing Documentation

## Overview

The application supports 5 languages with an intelligent fallback system. When a user logs in or browses the site:

- **Default Language**: English (EN)
- **User Language**: Whatever language the user has selected in their profile/browser

## How It Works

### Step 1: Load All Languages from Backend
```
GET /api/public/news → Returns ALL news in all languages mixed together
GET /api/public/faq  → Returns ALL FAQ items in all languages mixed together
```

Example raw data returned:
```json
[
  { id: "news-1", title: "Welcome", content: "Welcome to...", language_code: "en", author: "Admin", published_at: "..." },
  { id: "news-1", title: "Bienvenido", content: "Bienvenido a...", language_code: "es", author: "Admin", published_at: "..." },
  { id: "news-1", title: "欢迎", content: "欢迎来到...", language_code: "zh", author: "Admin", published_at: "..." },
  { id: "news-2", title: "Update", content: "New features...", language_code: "en", author: "Admin", published_at: "..." },
  ...
]
```

### Step 2: Frontend Groups by ID
```javascript
// Convert raw data into grouped structure
{
  "news-1": {
    en: { id: "news-1", title: "Welcome", ... },
    es: { id: "news-1", title: "Bienvenido", ... },
    zh: { id: "news-1", title: "欢迎", ... }
    // de and ru might not exist for this item
  },
  "news-2": {
    en: { id: "news-2", title: "Update", ... }
    // Other languages might not exist
  }
}
```

### Step 3: Frontend Applies Language Fallback
For each grouped item:

```javascript
const userLanguage = "es"; // User is Spanish speaker

// For news-1:
// 1. Check if ES exists → YES → Use Spanish version
// 2. Result: Show "Bienvenido" with Spanish content

// For news-2:
// 1. Check if ES exists → NO
// 2. Fallback to EN → YES → Use English version
// 3. Result: Show "Update" with English content
```

## Fallback Priority

For each item, the system checks in this order:

1. **User's Language** (e.g., ES for Spanish user)
   - If available, use this version
2. **English (EN)** - Guaranteed Fallback
   - If user's language not available, use English
3. **Any Available Language** - Last Resort
   - If even English is missing (rare), use any language available

## Example Scenarios

### Scenario 1: Spanish User, Item Has Spanish Translation
```
User Language: ES (Spanish)
Items available: EN, ES, ZH

Result: Shows Spanish version ✓
Content: "¿Cuál es...?" (Spanish question)
```

### Scenario 2: German User, Item Only Has English
```
User Language: DE (German)
Items available: EN only

Result: Shows English version (fallback) ✓
Content: "What is...?" (English question - fallback)
Language badge: Shows "en" to indicate fallback occurred
```

### Scenario 3: Russian User, No Data for Item Yet
```
User Language: RU (Russian)
Items available: (none - admin hasn't added this item yet)

Result: Item doesn't appear in list ✓
Reason: Protection - shows nothing if base item doesn't exist
```

## Implementation Details

### Frontend Utility: `languageFallback.ts`

Three main functions:

#### 1. `groupByLanguage(items)`
Converts raw data into grouped structure by ID.

```typescript
groupByLanguage([
  { id: 'news-1', language_code: 'en', title: 'Welcome', ... },
  { id: 'news-1', language_code: 'es', title: 'Bienvenido', ... },
  { id: 'news-2', language_code: 'en', title: 'Update', ... }
])
// Returns:
{
  'news-1': { en: {...}, es: {...} },
  'news-2': { en: {...} }
}
```

#### 2. `getLocalizedContent(groupedItem, userLanguage)`
Gets the correct language version with fallback.

```typescript
getLocalizedContent(groupedItem['news-1'], 'es')
// If ES exists → return ES version
// Else if EN exists → return EN version
// Else → return any available language
```

#### 3. `processMultiLanguageItems(items, userLanguage)`
One-step function that does everything:
- Groups by ID
- Applies localization
- Removes duplicates
- Returns unique, localized items

```typescript
const rawNews = await publicService.getNews(); // All languages mixed
const localizedNews = processMultiLanguageItems(rawNews, i18n.language);
// Result: Ready-to-display items in user's language with EN fallback
```

### Where It's Used

#### Home Page (Home.tsx)
```typescript
const { i18n } = useTranslation();
const newsRes = await publicService.getNews();
const localizedNews = processMultiLanguageItems(newsRes.data, i18n.language);
// Displays announcements in user's language
```

#### FAQ Page (FAQ.tsx)
```typescript
const faqRes = await publicService.getFaq();
const localizedFaq = processMultiLanguageItems(faqRes.data, i18n.language);
// Displays FAQ items in user's language
```

## API Behavior

### News Endpoint
```
GET /api/public/news
Returns: All news items in ALL languages (not filtered)
Frontend: Applies language selection + fallback
```

### FAQ Endpoint
```
GET /api/public/faq
Returns: All FAQ items in ALL languages (not filtered)
Frontend: Applies language selection + fallback
```

## Important Notes

### ✓ Always Load English First
```
The backend returns ALL versions including EN
This ensures base content always exists
```

### ✓ Admin Controls All Languages
```
When admin submits news/FAQ in 5 languages simultaneously
All 5 versions created in database
Users see their language (or EN fallback)
```

### ✓ No API Calls Per Language
```
Old approach: Call /faq?language=es, /faq?language=en, etc.
New approach: Load once with ALL languages, process in frontend
More efficient, faster, fewer API calls
```

### ✓ Transparent to Users
```
User sees content in their language
User doesn't notice fallback to English
If item only exists in EN, they see EN
If item exists in their language, they see their language
```

## User Experience Flow

```
User opens site
   ↓
App loads user's language preference (ES, for example)
   ↓
Fetch all news/FAQ from server (all languages mixed)
   ↓
Frontend groups by ID
   ↓
Frontend applies fallback:
  - Try ES → Found? Show ES
  - Try ES → Not found? Try EN → Found? Show EN
   ↓
Display localized, relevant content to user
```

## Benefits

1. **Consistency**: All items guaranteed to have base EN version
2. **Efficiency**: One API call returns all languages
3. **Transparency**: Fallback is automatic, user doesn't notice
4. **Reliability**: Never shows broken/missing content
5. **Scalability**: Easy to add more languages later

## Future Enhancements

- [ ] Show language indicator (badge showing "Translated from EN" if fallback used)
- [ ] Admin can set "translate_needed" flag for items
- [ ] Report untranslated content for admin review
- [ ] Community translation suggestions
