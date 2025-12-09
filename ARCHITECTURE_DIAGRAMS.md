# Multi-Language System - Visual Architecture

## System Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                     ADMIN INTERFACE                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  AdminFAQ.tsx / AdminAnnouncements.tsx                           │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │  Language Tabs: [EN] [ES] [ZH] [DE] [RU]                │   │
│  ├──────────────────────────────────────────────────────────┤   │
│  │                                                            │   │
│  │  Active Tab: English                                     │   │
│  │  ┌─────────────────────────────────────────────────────┐ │   │
│  │  │ Question/Title: [____________]                     │ │   │
│  │  │                                                     │ │   │
│  │  │ Answer/Content: [____________]                     │ │   │
│  │  │                                                     │ │   │
│  │  │                  [SUBMIT]                           │ │   │
│  │  └─────────────────────────────────────────────────────┘ │   │
│  │                                                            │   │
│  │  Existing Items:                                         │   │
│  │  ├─ Question 1 [Multi-language] [Edit] [Delete]         │   │
│  │  ├─ Question 2 [Multi-language] [Edit] [Delete]         │   │
│  │  └─ Question 3 [Multi-language] [Edit] [Delete]         │   │
│  │                                                            │   │
│  └──────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                            │ API Call
                            │ (5-language object)
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                    BACKEND API                                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  POST /api/admin/faq                                            │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │ Request Body:                                            │   │
│  │ {                                                        │   │
│  │   "en": { "question": "...", "answer": "..." },         │   │
│  │   "es": { "question": "...", "answer": "..." },         │   │
│  │   "zh": { "question": "...", "answer": "..." },         │   │
│  │   "de": { "question": "...", "answer": "..." },         │   │
│  │   "ru": { "question": "...", "answer": "..." }          │   │
│  │ }                                                        │   │
│  │                                                          │   │
│  │ ✓ Validate all 5 languages                              │   │
│  │ ✓ Generate UUID                                         │   │
│  │ ✓ Create 5 INSERT statements                            │   │
│  │ ✓ Return { id, message }                                │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ↓
┌─────────────────────────────────────────────────────────────────┐
│                    DATABASE                                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                   │
│  Table: faq                                                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ id          | question    | answer    | language_code  │    │
│  ├─────────────────────────────────────────────────────────┤    │
│  │ uuid-abc123 | What is...? | It is...  | en             │    │
│  │ uuid-abc123 | ¿Qué es...? | Es...     | es             │    │
│  │ uuid-abc123 | 什么是...?   | 是...     | zh             │    │
│  │ uuid-abc123 | Was ist...? | Es ist... | de             │    │
│  │ uuid-abc123 | Что такое..?| Это...    | ru             │    │
│  │                                                          │    │
│  │ UNIQUE(id, language_code) ← Ensures data integrity     │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                   │
└─────────────────────────────────────────────────────────────────┘
```

## Data Flow - Create/Edit/Delete

### CREATE Flow
```
User Input (5 languages)
         ↓
Validation (all required)
         ↓
POST /api/admin/faq
         ↓
Backend Validation
         ↓
Generate UUID
         ↓
Create 5 INSERT statements
         ↓
↓ Loop through languages (en, es, zh, de, ru)
  ├─ INSERT faq (uuid, question_en, answer_en, 'en')
  ├─ INSERT faq (uuid, question_es, answer_es, 'es')
  ├─ INSERT faq (uuid, question_zh, answer_zh, 'zh')
  ├─ INSERT faq (uuid, question_de, answer_de, 'de')
  └─ INSERT faq (uuid, question_ru, answer_ru, 'ru')
         ↓
Return { id: uuid }
         ↓
Frontend: Success message
```

### UPDATE Flow
```
User Input (modify one language)
         ↓
PUT /api/admin/faq/:id
         ↓
Backend receives updated 5-language object
         ↓
DELETE FROM faq WHERE id = :id  ← Remove all old versions
         ↓
Create 5 new INSERT statements
         ↓
↓ Loop through languages (en, es, zh, de, ru)
  ├─ INSERT faq (id, new_question_en, new_answer_en, 'en')
  ├─ INSERT faq (id, new_question_es, new_answer_es, 'es')
  ├─ ... (and so on)
         ↓
Return { id }
         ↓
Frontend: Fetch updated items
```

### DELETE Flow
```
User clicks Delete on item
         ↓
Confirm dialog
         ↓
DELETE /api/admin/faq/:id
         ↓
DELETE FROM faq WHERE id = :id  ← Removes all 5 versions at once!
         ↓
Return { message: "deleted" }
         ↓
Frontend: Remove from list + Success message
```

## Frontend Grouping Logic

### Raw Data from API
```
[
  { id: 'uuid-1', question: 'Q-EN', answer: 'A-EN', language_code: 'en' },
  { id: 'uuid-1', question: 'Q-ES', answer: 'A-ES', language_code: 'es' },
  { id: 'uuid-1', question: 'Q-ZH', answer: 'A-ZH', language_code: 'zh' },
  { id: 'uuid-1', question: 'Q-DE', answer: 'A-DE', language_code: 'de' },
  { id: 'uuid-1', question: 'Q-RU', answer: 'A-RU', language_code: 'ru' },
  { id: 'uuid-2', question: 'Q2-EN', answer: 'A2-EN', language_code: 'en' },
  { id: 'uuid-2', question: 'Q2-ES', answer: 'A2-ES', language_code: 'es' },
  ... (and so on)
]
```

### After Grouping Logic
```javascript
const grouped = {};
data.forEach(item => {
  if (!grouped[item.id]) {
    grouped[item.id] = {};
  }
  grouped[item.id][item.language_code] = item;
});

// Result:
{
  'uuid-1': {
    en: { id: 'uuid-1', question: 'Q-EN', language_code: 'en', ... },
    es: { id: 'uuid-1', question: 'Q-ES', language_code: 'es', ... },
    zh: { id: 'uuid-1', question: 'Q-ZH', language_code: 'zh', ... },
    de: { id: 'uuid-1', question: 'Q-DE', language_code: 'de', ... },
    ru: { id: 'uuid-1', question: 'Q-RU', language_code: 'ru', ... }
  },
  'uuid-2': {
    en: { ... },
    es: { ... },
    ... (and so on)
  }
}
```

### Display in List
```
Each grouped item shows:
┌─────────────────────────────────────┐
│ Question 1                 [Multi]   │  ← Shows first language
├─────────────────────────────────────┤
│ Answer text...                      │
├─────────────────────────────────────┤
│ [Edit Button] [Delete Button]       │
└─────────────────────────────────────┘
```

## Form State Structure

```
formData = {
  en: {
    question: "What is Wesnoth?",
    answer: "Wesnoth is a strategy game..."
  },
  es: {
    question: "¿Qué es Wesnoth?",
    answer: "Wesnoth es un juego de estrategia..."
  },
  zh: {
    question: "什么是Wesnoth?",
    answer: "Wesnoth是一个策略游戏..."
  },
  de: {
    question: "Was ist Wesnoth?",
    answer: "Wesnoth ist ein Strategiespiel..."
  },
  ru: {
    question: "Что такое Wesnoth?",
    answer: "Wesnoth - это стратегическая игра..."
  }
}

activeLanguageTab = 'en'  // Which tab currently visible

// When user types in form, updates:
// formData[activeLanguageTab].question or .answer
// Does NOT auto-save to DB until Submit
```

## Component Interactions

```
AdminFAQ.tsx / AdminAnnouncements.tsx
│
├─ State Management
│  ├─ formData: Multi-language form state
│  ├─ faqItems: Grouped items from API
│  ├─ activeLanguageTab: Currently visible tab
│  └─ editingId: ID of item being edited (null = creating new)
│
├─ API Calls (via adminService)
│  ├─ fetchFAQ(): GET /api/admin/faq → Group by ID
│  ├─ createFaq(formData): POST /api/admin/faq
│  ├─ updateFaq(id, formData): PUT /api/admin/faq/:id
│  └─ deleteFaq(id): DELETE /api/admin/faq/:id
│
├─ Event Handlers
│  ├─ handleSubmit(): Validate & POST/PUT
│  ├─ handleEdit(item): Load item into form
│  ├─ handleDelete(id): DELETE & refresh list
│  └─ Setter for activeLanguageTab
│
└─ Rendering
   ├─ Language tabs (EN | ES | ZH | DE | RU)
   ├─ Form inputs (question + answer for active language)
   ├─ Submit button
   └─ Items list with Edit/Delete buttons
```

## Comparison: Old vs New Architecture

### OLD APPROACH
```
User creates FAQ
  ↓
Form with language selector dropdown
  ↓
Enter question + answer for ONE language
  ↓
Click Submit
  ↓
Backend creates 1 record with language_code='en' (or selected)
  ↓
User repeats 4 more times for other languages!
  ↓
Result: 5 form submissions, 5 API calls
```

### NEW APPROACH
```
User creates FAQ
  ↓
Form with language tabs (EN|ES|ZH|DE|RU)
  ↓
Click tabs to enter content for all 5 languages
  ↓
Click Submit ONCE
  ↓
Backend creates 5 records with same ID
  ↓
Done! All languages created simultaneously
  ↓
Result: 1 form, 1 API call
```

## Benefits Visualization

```
Cost Reduction
├─ NO external translation APIs
├─ NO API latency
├─ NO subscription fees
└─ Save ~$100-1000/month

User Experience
├─ Admin: Less work (1 form vs 5)
├─ Admin: Clearer UI (tabs vs dropdown)
├─ Admin: Faster (1 submit vs 5)
└─ Users: All languages guaranteed

Data Quality
├─ Admin-controlled quality
├─ No AI translation errors
├─ All languages verified
└─ Consistent messaging

Maintainability
├─ Clear code structure
├─ Obvious data model
├─ Easy to extend
└─ Self-documenting
```

## Technology Stack

```
Frontend: React + TypeScript
├─ AdminFAQ.tsx / AdminAnnouncements.tsx
├─ Language tab UI (CSS)
└─ Grouping logic (JavaScript)

Backend: Express.js + TypeScript
├─ admin.ts routes
├─ UUID generation
└─ Multi-record insertion

Database: PostgreSQL
├─ news table (with language_code column)
├─ faq table (with language_code column)
└─ Unique constraint (id, language_code)

API: REST
├─ JSON request/response
└─ Bearer token auth
```

---

**This diagram system shows:**
- ✅ How data flows through the system
- ✅ What the database looks like
- ✅ How frontend transforms raw data
- ✅ Differences between old and new approaches
- ✅ Benefits at a glance
