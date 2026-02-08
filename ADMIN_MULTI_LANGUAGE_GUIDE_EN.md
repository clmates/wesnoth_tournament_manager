# Quick Start Guide - Multi-Language Admin Forms

## For Administrators

### Creating a New FAQ Entry

1. **Navigate** to Admin > FAQ
2. **Click** "New FAQ Item" button
3. **Enter content** for each language:
   - Click the language tab (EN, ES, ZH, DE, RU)
   - Enter Question for that language
   - Enter Answer for that language
   - Repeat for all 5 languages
4. **Submit** - Single click creates all 5 language versions

### Editing an Existing FAQ Entry

1. **Navigate** to Admin > FAQ
2. **Locate** the FAQ item (shows all languages together)
3. **Click** "Edit" button
4. **Update** content in each language:
   - Click language tabs to switch between them
   - Modify question/answer as needed
5. **Submit** - Updates all 5 language versions

### Deleting an FAQ Entry

1. **Navigate** to Admin > FAQ
2. **Locate** the FAQ item
3. **Click** "Delete" button
4. **Confirm** deletion - removes all 5 language versions at once

### Creating a New Announcement

1. **Navigate** to Admin > Announcements
2. **Click** "New Announcement" button
3. **Enter content** for each language:
   - Click the language tab (EN, ES, ZH, DE, RU)
   - Enter Title for that language
   - Enter Content for that language
   - Repeat for all 5 languages
4. **Submit** - Single click creates all 5 language versions

### Editing an Existing Announcement

Same process as FAQ editing

### Deleting an Announcement

Same process as FAQ deletion

## Understanding the Interface

### Language Tabs
- **Layout**: Row of 5 buttons at top of form (EN, ES, ZH, DE, RU)
- **Active Tab**: Highlighted with purple gradient background
- **Purpose**: Switch which language you're editing
- **Click**: Any tab to view/edit that language's content

### Language Badge
- **Location**: Next to item title in list view
- **Shows**: "Multi-language" indicating all 5 languages available
- **Color**: Informational (not individual language codes anymore)

### Validation
- **Required**: All 5 languages must have complete content
- **Error Message**: Shows which language is missing content
- **Cannot Submit**: Without all 5 languages filled

## How It Works

### Behind the Scenes
- **One Logical Item** = 5 Database Records
- **Same ID**: All language versions share the same ID
- **Different language_code**: Each record has language_code (en, es, zh, de, ru)
- **One Submit**: Creates/updates all 5 records simultaneously

### Example Database State
```
FAQ ID: uuid-abc123
├── English (language_code=en): "What is Wesnoth?" / "It's a strategy game..."
├── Spanish (language_code=es): "¿Qué es Wesnoth?" / "Es un juego de estrategia..."
├── Chinese (language_code=zh): "什么是Wesnoth?" / "这是一个策略游戏..."
├── German (language_code=de): "Was ist Wesnoth?" / "Es ist ein Strategiespiel..."
└── Russian (language_code=ru): "Что такое Wesnoth?" / "Это стратегическая игра..."
```

## Benefits for Admin

✅ **Save Time**: One form instead of 5 separate forms  
✅ **No Mistakes**: All languages submitted together  
✅ **Consistent**: All versions always in sync  
✅ **Easy**: Intuitive tab-based interface  
✅ **Clear**: "Multi-language" badge shows what you're managing  

## Benefits for Users

✅ **Choice**: Content available in all 5 languages  
✅ **Consistency**: All information always available in their language  
✅ **Quality**: Admin-curated translations (not AI-generated)  

## Common Tasks

### Make a typo fix in one language
1. Click Edit on the item
2. Click the language tab with the typo
3. Fix the typo
4. Click Submit (all 5 versions re-saved)

### Add content for a new question
1. Click New FAQ Item
2. Fill in all 5 languages (required)
3. Click Submit

### Delete all versions of an item
1. Click Delete on any item
2. Confirm deletion (removes all 5 languages)

### View all languages for an item (as admin)
1. In the list, click Edit
2. Click through each language tab to see all content

## Form Tips

**Switching Languages Mid-Edit**:
- Click any language tab - content is automatically saved to that tab as you type
- No need to explicitly save between languages
- Only final Submit button saves to database

**Validation Errors**:
- Error shows which language is missing content
- Fix the specified language
- Try Submit again

**Empty Form Reset**:
- Click Cancel button when creating new item
- Resets all 5 languages to empty

## Database Note

When you submit a form:
- **Creating**: Creates 5 new records with unique ID
- **Updating**: Deletes old 5 records, creates 5 new ones
- **Deleting**: Removes all 5 language versions (single delete command)

This ensures data integrity and consistency across all languages.

## Technical Details (For Reference)

### Form State Structure
```
{
  en: { question: "...", answer: "..." },
  es: { question: "...", answer: "..." },
  zh: { question: "...", answer: "..." },
  de: { question: "...", answer: "..." },
  ru: { question: "...", answer: "..." }
}
```

### API Request Example
```json
POST /api/admin/faq
{
  "en": { "question": "What is X?", "answer": "X is..." },
  "es": { "question": "¿Qué es X?", "answer": "X es..." },
  "zh": { "question": "X是什么?", "answer": "X是..." },
  "de": { "question": "Was ist X?", "answer": "X ist..." },
  "ru": { "question": "Что такое X?", "answer": "X это..." }
}
```

### Response
```json
{
  "id": "uuid-here",
  "message": "FAQ created in all languages"
}
```

## Support

If you encounter issues:
1. Check that all 5 languages have content (no empty fields)
2. Browser console for error messages (F12)
3. Check server logs: `/api/admin/faq` and `/api/admin/news` endpoints
4. Verify database migration has been applied

---
**Last Updated**: [Current Implementation Date]  
**Supported Languages**: English (EN), Spanish (ES), Chinese (ZH), German (DE), Russian (RU)
