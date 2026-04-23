# Estadísticas Globales del Sitio - Documentación Técnica

## Overview
Sistema de estadísticas globales que muestra métricas agregadas del sitio en un panel en la página de inicio (Home). Los datos se cachean y actualizan automáticamente cada 30 minutos mediante un job del scheduler.

## Arquitectura

### Backend

#### 1. Base de Datos
**Tabla: `global_statistics`**
- Almacena snapshots de todas las estadísticas globales
- Una fila por métrica (clave única `statistic_key`)
- Actualizada cada 30 minutos por el scheduler

```sql
CREATE TABLE global_statistics (
  id CHAR(36) PRIMARY KEY,
  statistic_key VARCHAR(100) UNIQUE,
  statistic_value BIGINT,
  last_updated DATETIME,
  calculated_at DATETIME,
  INDEX idx_statistic_key,
  INDEX idx_last_updated
)
```

#### 2. Servicio: `globalStatisticsService.ts`

Funciones principales:

- **`calculateGlobalStatistics()`**
  - Calcula todas las métricas desde cero consultando la base de datos
  - Retorna objeto `GlobalStatistics` tipado
  - Operaciones:
    - Usuarios: COUNT con filtros is_active, enable_ranked, created_at
    - Partidas ranked (matches): COUNT con status='confirmed'
    - Partidas torneos (tournament_matches): COUNT con status IN ('completed', 'played')
    - Torneos: COUNT desde tabla tournaments

- **`updateGlobalStatisticsCache(stats)`**
  - Actualiza tabla `global_statistics` con nuevos valores
  - Ejecuta 16 UPDATE queries (una por métrica)
  - Establece `calculated_at = NOW()`

- **`getGlobalStatisticsFromCache()`**
  - Retrieves todas las filas desde `global_statistics`
  - Reconstruye objeto `GlobalStatistics`
  - Retorna timestamp más reciente

#### 3. Endpoint: `GET /api/statistics/global`

```typescript
router.get('/global', async (req, res) => {
  const forceRecalculate = req.query.force === 'true';
  
  if (forceRecalculate) {
    // Recalculate and update cache immediately
    const stats = await calculateGlobalStatistics();
    await updateGlobalStatisticsCache(stats);
    return res.json(stats);
  }
  
  // Return cached data
  const stats = await getGlobalStatisticsFromCache();
  res.json(stats);
});
```

Características:
- **Público**: Sin autenticación requerida
- **Parámetro force**: `?force=true` fuerza recálculo inmediato
- **CORS**: Habilitado para acceso desde frontend

#### 4. Job Scheduler: `globalStatisticsJob.ts`

```typescript
export const calculateGlobalStatisticsJob = async () => {
  console.log('📊 [GlobalStats] Calculating global statistics...');
  
  const stats = await calculateGlobalStatistics();
  await updateGlobalStatisticsCache(stats);
  
  console.log(`✅ [GlobalStats] Updated successfully at ${stats.last_updated}`);
}
```

En `scheduler.ts`:
```typescript
// Ejecuta cada 30 minutos
cron.schedule('*/30 * * * *', async () => {
  try {
    await calculateGlobalStatisticsJob();
  } catch (error) {
    console.error('❌ Global statistics calculation failed:', error);
  }
});
```

### Frontend

#### 1. Componente: `GlobalStats.tsx`

Props: Ninguno (trae datos directamente del API)

State:
- `stats`: Objeto GlobalStatistics | null
- `loading`: boolean
- `error`: string | null

Funcionamiento:
1. En `useEffect`, fetch `/api/statistics/global` al montar
2. Auto-refresh cada 10 minutos
3. Renderiza StatCard por cada métrica
4. Manejo de loading/error states

**StatCard**: Componente auxiliar que renderiza una métrica individual
- Props: label, value, icon, color
- ColorMap: blue, green, purple, orange, red

Estructura de secciones:
```
┌─────────────────────────────┐
│   Global Statistics         │
├─────────────────────────────┤
│ [Users Section]             │
│  - Total, Active, Ranked    │
│  - New (month, year)        │
│                             │
│ [Ranked Matches Section]    │
│  - Today, Week, Month       │
│  - Year, Total              │
│                             │
│ [Tournament Matches Section]│
│  - Month, Year, Total       │
│                             │
│ [Tournaments Section]       │
│  - Month, Year, Total       │
│                             │
│ Last updated: HH:MM:SS      │
└─────────────────────────────┘
```

#### 2. Integración en Home.tsx

- Importa componente `GlobalStats`
- Renderiza en sidebar derecho (right column)
- Posicionado después de Top 10 Players
- Hereda estilos consistentes del sitio

#### 3. API Client: `api.ts`

```typescript
export const publicService = {
  // ... otros métodos
  getGlobalStatistics: () => api.get('/statistics/global'),
};
```

## Estadísticas Recolectadas

### Usuarios
- `users_total`: COUNT(*) FROM users_extension
- `users_active`: COUNT(*) WHERE is_active=1
- `users_ranked`: COUNT(*) WHERE enable_ranked=1
- `users_new_month`: COUNT(*) WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)
- `users_new_year`: COUNT(*) WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 YEAR)

### Partidas Ranked (tabla `matches`)
- `matches_today`: COUNT(*) WHERE DATE(created_at)=CURDATE()
- `matches_week`: COUNT(*) WHERE created_at >= DATE_SUB(NOW(), INTERVAL 7 DAY)
- `matches_month`: COUNT(*) WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)
- `matches_year`: COUNT(*) WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 YEAR)
- `matches_total`: COUNT(*)

### Partidas de Torneos (tabla `tournament_matches`)
- `tournament_matches_month`: COUNT(*) WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)
- `tournament_matches_year`: COUNT(*) WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 YEAR)
- `tournament_matches_total`: COUNT(*)

### Torneos (tabla `tournaments`)
- `tournaments_month`: COUNT(*) WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 MONTH)
- `tournaments_year`: COUNT(*) WHERE created_at >= DATE_SUB(NOW(), INTERVAL 1 YEAR)
- `tournaments_total`: COUNT(*)

## Formato de Respuesta API

```json
{
  "users_total": 150,
  "users_active": 85,
  "users_ranked": 42,
  "users_new_month": 12,
  "users_new_year": 45,
  "matches_today": 3,
  "matches_week": 18,
  "matches_month": 72,
  "matches_year": 280,
  "matches_total": 2156,
  "tournament_matches_month": 24,
  "tournament_matches_year": 95,
  "tournament_matches_total": 512,
  "tournaments_month": 2,
  "tournaments_year": 8,
  "tournaments_total": 42,
  "last_updated": "2026-04-23T21:18:47.653Z"
}
```

## Flujo de Datos

```
┌─────────────────────────────────────────────────────┐
│ Scheduler (cada 30 min)                             │
│ calculateGlobalStatisticsJob()                      │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│ Backend: globalStatisticsService                    │
│ calculateGlobalStatistics()                         │
│ ├─ Query users_extension                           │
│ ├─ Query matches (ranked)                          │
│ ├─ Query tournament_matches                        │
│ └─ Query tournaments                               │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│ Database: global_statistics table                   │
│ (UPDATE 16 rows con nuevos valores)                 │
└──────────────────┬──────────────────────────────────┘
                   │
                   ▼
┌─────────────────────────────────────────────────────┐
│ Frontend: GET /api/statistics/global                │
│ ├─ Cache retrieval (10 min)                         │
│ └─ Display in GlobalStats component                │
└─────────────────────────────────────────────────────┘
```

## Performance

- **Database Query**: Queries optimizadas con índices
- **Caching**: 30 minutos en base de datos + 10 minutos en frontend
- **Endpoint Response**: ~10ms (lectura de tabla pequeña con 16 filas)
- **Frontend Render**: <100ms (simple grid de cards)

## Monitoreo

Logs del job scheduler:
```
📊 [GlobalStats] Calculating global statistics...
   Users: 150 total, 85 active, 42 ranked
   Ranked matches: 3 today, 2156 total
   Tournament matches: 512 total
   Tournaments: 42 total
✅ [GlobalStats] Global statistics updated successfully at 2026-04-23T21:18:47.653Z
```

## Errores Comunes

| Error | Causa | Solución |
|-------|-------|----------|
| `Failed to fetch global statistics` | Endpoint no disponible | Verificar que servidor está running |
| Statisticsno se actualizan | Scheduler no ejecutándose | Verificar logs del job scheduler |
| Datos incorrectos | Query error | Revisar columnars en queries, considerar usar ?force=true |

## Extensiones Futuras

- Agregar gráficos de tendencia histórica
- Incluir top players por frecuencia
- Estadísticas por mapa/facción
- Exportar datos a CSV
- Cachear en Redis para performance mejorada
