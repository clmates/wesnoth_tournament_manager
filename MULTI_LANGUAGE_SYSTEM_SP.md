---
# Multi-Language System

## Overview

El sistema permite gestionar contenido en 5 idiomas (EN, ES, ZH, DE, RU) para News y FAQ, con administración centralizada y un sistema de fallback inteligente para el usuario final.

---

## 1. Multi-Language System (Gestión y Administración)

### Supported Languages

- **EN** - English
- **ES** - Español (Spanish)
- **ZH** - 中文 (Chinese)
- **DE** - Deutsch (German)
- **RU** - Русский (Russian)

### Database Schema

#### News Table (`news`)
- id (UUID) — Unique identifier, same for all language versions
- title (VARCHAR)
- content (TEXT)
- language_code (VARCHAR(10))
- author (VARCHAR)
- published_at (TIMESTAMP)
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
- **Unique Constraint**: (id, language_code)

#### FAQ Table (`faq`)
- id (UUID)
- question (VARCHAR)
- answer (TEXT)
- language_code (VARCHAR(10))
- created_at (TIMESTAMP)
- updated_at (TIMESTAMP)
- **Unique Constraint**: (id, language_code)

### Admin UI

- Formularios con pestañas para los 5 idiomas.
- Un solo submit crea/actualiza todas las versiones.
- Estructura de estado:
  ```typescript
  {
    en: { title/question, content/answer },
    es: { ... },
    zh: { ... },
    de: { ... },
    ru: { ... }
  }
  ```

### API Endpoints

- POST/PUT/DELETE/GET para `/api/admin/news` y `/api/admin/faq` gestionan todas las versiones de idioma.
- El frontend agrupa por ID para mostrar el contenido multilingüe.

---

## 2. Language Fallback System (Selección y Experiencia de Usuario)

### Principio Clave

**El backend retorna todas las versiones de idioma; el frontend selecciona la mejor para el usuario, con fallback automático a inglés.**

### Flujo de Datos

1. El usuario abre la app con preferencia de idioma (ej: ES).
2. El frontend llama a `/api/public/news` y `/api/public/faq` (sin filtro de idioma).
3. El backend retorna todos los registros en todos los idiomas.
4. El frontend agrupa por ID y aplica lógica de fallback:
   - Si existe el idioma del usuario → lo usa.
   - Si no, usa inglés.
   - Si no hay inglés, usa cualquier idioma disponible.

### Utilidades Frontend

- `groupByLanguage(items)`
- `getLocalizedContent(groupedItem, userLanguage)`
- `processMultiLanguageItems(items, userLanguage)`

### Ejemplo de Uso

```typescript
const rawData = await publicService.getNews();
const localized = processMultiLanguageItems(rawData, i18n.language);
```

### Ejemplo de Fallback

- Usuario ES, item tiene ES → muestra ES.
- Usuario DE, item solo EN → muestra EN.
- Usuario RU, item no existe → no se muestra.

### Beneficios

- Siempre muestra contenido (nunca vacío).
- Menos llamadas API (una sola para todos los idiomas).
- Mejor UX y rendimiento.
- Transparente para el usuario.

### Futuras Mejoras

- Badge de idioma cuando se usa fallback.
- Flags de "traducción pendiente" para admins.
- Sugerencias de traducción comunitaria.
```json
{
  "en": { "title": "Welcome", "content": "Welcome to our site" },
  "es": { "title": "Bienvenido", "content": "Bienvenido a nuestro sitio" },
  "zh": { "title": "欢迎", "content": "欢迎来到我们的网站" },
  "de": { "title": "Willkommen", "content": "Willkommen auf unserer Website" },
  "ru": { "title": "Добро пожаловать", "content": "Добро пожаловать на наш сайт" }
}
```

**Response** (201 Created):
```json
{
  "id": "uuid-here",
  "message": "News created in all languages"
}
```

### Update News/Announcement
**Endpoint**: `PUT /api/admin/news/:id`

**Request Body**: Same structure as POST

**Behavior**: 
- Deletes all existing language versions for the given ID
- Creates 5 new records with updated content
- Returns success message

**Response**:
```json
{
  "id": "uuid-here",
  "message": "News updated in all languages"
}
```

### Delete News/Announcement
**Endpoint**: `DELETE /api/admin/news/:id`

**Behavior**:
- Deletes all 5 language versions with the given ID

### Get News/Announcements
**Endpoint**: `GET /api/admin/news`

**Response** (200 OK):
Returns array of records, typically grouped by ID on frontend to show multi-language items

```json
[
  {
    "id": "uuid-1",
    "title": "Welcome",
    "content": "...",
    "language_code": "en",
    "author": "Admin",
    "published_at": "2024-01-01T10:00:00Z"
  },
  {
    "id": "uuid-1",
    "title": "Bienvenido",
    "content": "...",
    "language_code": "es",
    "author": "Admin",
    "published_at": "2024-01-01T10:00:00Z"
  },
  ...
]
```

### Create FAQ
**Endpoint**: `POST /api/admin/faq`

**Request Body**:
```json
{
  "en": { "question": "What is this?", "answer": "This is..." },
  "es": { "question": "¿Qué es esto?", "answer": "Esto es..." },
  "zh": { "question": "这是什么?", "answer": "这是..." },
  "de": { "question": "Was ist das?", "answer": "Das ist..." },
  "ru": { "question": "Что это?", "answer": "Это..." }
}
```

**Response** (201 Created):
```json
{
  "id": "uuid-here",
  "message": "FAQ created in all languages"
}
```

### Update FAQ
**Endpoint**: `PUT /api/admin/faq/:id`

**Request Body**: Same structure as POST

**Behavior**: Same as news - deletes and re-inserts all 5 versions

**Response**:
```json
{
  "id": "uuid-here",
  "message": "FAQ updated in all languages"
}
```

### Delete FAQ
**Endpoint**: `DELETE /api/admin/faq/:id`

**Behavior**: Deletes all 5 language versions

### Get FAQ
**Endpoint**: `GET /api/admin/faq`

**Response**: Returns array of FAQ records (all languages) to be grouped by frontend

## Frontend Service Wrappers

All service methods are in `frontend/src/services/api.ts` under `adminService`:

```typescript
adminService.createNews(data: MultiLangNews) => POST /api/admin/news
adminService.updateNews(id: string, data: MultiLangNews) => PUT /api/admin/news/:id
adminService.deleteNews(id: string) => DELETE /api/admin/news/:id
adminService.getNews() => GET /api/admin/news

adminService.createFaq(data: MultiLangFaq) => POST /api/admin/faq
adminService.updateFaq(id: string, data: MultiLangFaq) => PUT /api/admin/faq/:id
adminService.deleteFaq(id: string) => DELETE /api/admin/faq/:id
adminService.getFaq() => GET /api/admin/faq
```

## Frontend Grouping Logic

Both AdminFAQ.tsx and AdminAnnouncements.tsx handle grouping:

```typescript
// Group FAQ items by ID to get all language versions
const grouped: Record<string, any> = {};
(res.data || []).forEach((item: any) => {
  if (!grouped[item.id]) {
    grouped[item.id] = {};
  }
  grouped[item.id][item.language_code || 'en'] = item;
});
setFaqItems(Object.values(grouped));
```

This creates a structure where each item has properties for each language:
```typescript
{
  en: { id, question, answer, language_code: 'en', ... },
  es: { id, question, answer, language_code: 'es', ... },
  zh: { ... },
  de: { ... },
  ru: { ... }
}
```

## User-Facing FAQ/News Pages

Public pages (FAQ.tsx, Home.tsx announcements section) display content filtered by the user's selected language:

1. Fetch all language versions from public endpoint
2. Filter/select based on user's `language` preference
3. Display only the selected language version

## UI Components

### Language Tabs
- Located in `.language-tabs` container
- Shows 5 buttons: EN, ES, ZH, DE, RU
- Active tab highlighted with gradient background
- Click to switch language context in form

### Language Tab Styles (Admin.css)
```css
.language-tabs {
  display: flex;
  gap: 0.5rem;
  margin-bottom: 1.5rem;
  flex-wrap: wrap;
}

.language-tab {
  padding: 0.6rem 1.2rem;
  border: 2px solid #e0e0e0;
  border-radius: 8px;
  background: white;
  cursor: pointer;
  font-weight: 500;
  transition: all 0.3s ease;
  color: #666;
}

.language-tab.active {
  background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
  color: white;
  border-color: #667eea;
}
```

## Migration

Migration file `backend/migrations/013_add_language_code_to_news.sql` adds the `language_code` column to the news table:

```sql
ALTER TABLE news ADD COLUMN language_code VARCHAR(10) DEFAULT 'en';
CREATE INDEX idx_news_language_code ON news(language_code);
ALTER TABLE news ADD CONSTRAINT unique_news_language UNIQUE(id, language_code);
```

This migration must be applied before the new endpoints are fully operational.

## Key Benefits

1. **No External APIs**: Eliminates dependency on translation APIs (cost, latency)
2. **Full Control**: Admin has complete control over all language versions
3. **Unified Form**: One submit action creates all 5 language variants
4. **Consistency**: Ensures all languages are always in sync
5. **Clear UI**: Language tabs make it obvious which language is being edited
6. **Scalability**: Easy to add new languages by updating form structure and backend validation
