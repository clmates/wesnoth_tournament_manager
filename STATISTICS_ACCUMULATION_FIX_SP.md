# Fix: Estadísticas de Facción/Mapa Acumulándose en Lugar de Reinicializarse

## Problema Identificado

Las estadísticas en la tabla `faction_map_statistics` se estaban acumulando (sumando) en lugar de reinicializarse cuando se recalculaban, causando que los mismos matches se contaran múltiples veces y desvirtuaran los valores de winrate y statistics.

### Síntomas
- Winrates incorrectos en la página de Statistics
- Matches contados múltiples veces en `faction_map_statistics`
- Valores acumulativos en lugar de valores correctos

## Root Cause

Cuando se realizaban dos acciones administrativas:

1. **Admin recalcula estadísticas** (`POST /api/admin/recalculate-all-stats`)
   - ✅ Se llamaba correctamente `recalculate_faction_map_statistics()`
   - ✅ La función trunca la tabla: `TRUNCATE TABLE faction_map_statistics`
   - ✅ Luego reinserta todos los datos correctamente

2. **Admin confirma/valida una disputa** (`POST /api/matches/admin/:id/dispute` con action='validate')
   - ❌ **FALTABA la llamada a `recalculate_faction_map_statistics()`**
   - Se recalculaban stats de usuario (ELO) pero NO las de facción/mapa
   - Trigger automático continuaba actualizando tabla con datos duplicados

## Solución Implementada

### Cambio en `backend/src/routes/matches.ts`

Se agregó la llamada a `recalculate_faction_map_statistics()` después de recalcular stats de usuario en el endpoint de validar disputa (STEP 7):

```typescript
// STEP 7: Recalculate faction/map balance statistics
try {
  await query('SELECT recalculate_faction_map_statistics()');
  if (process.env.BACKEND_DEBUG_LOGS === 'true') console.log('Faction/map statistics recalculated successfully after dispute validation');
} catch (error) {
  console.error('Error recalculating faction/map statistics:', error);
  // Don't fail the entire operation if balance stats fail
}
```

### Por qué funciona

La función `recalculate_faction_map_statistics()` en `backend/migrations/20251227_faction_map_statistics.sql`:

1. **Trunca la tabla**: `TRUNCATE TABLE faction_map_statistics;`
   - Elimina TODOS los registros existentes
   - Resetea cualquier acumulación

2. **Recalcula desde cero**: Ejecuta dos CTEs (Common Table Expressions)
   - **winner_stats**: Cuenta wins para cada facción como ganadora
   - **loser_stats**: Cuenta losses para cada facción como perdedora
   - Ambas CTEs filtran matches NO cancelados: `WHERE NOT (m.admin_reviewed = true AND m.status = 'cancelled')`

3. **Resultado**: Valores correctos sin duplicación

## Flujo Corregido

### Ahora ambas acciones funcionan correctamente:

```
1. Admin recalcula estadísticas
   ↓
   Trunca faction_map_statistics
   ↓
   Recalcula desde matches table
   ↓
   ✅ Valores correctos sin acumulación

2. Admin valida disputa (cancela un match)
   ↓
   Marca match como cancelled
   ↓
   Recalcula stats de usuario (ELO)
   ↓
   [NUEVO] Llama recalculate_faction_map_statistics()
   ↓
   Trunca faction_map_statistics
   ↓
   Recalcula desde matches table (excluyendo el match cancelado)
   ↓
   ✅ Valores correctos sin acumulación
```

## Verificación

Para verificar que el fix funciona:

1. Revisar logs: `Faction/map statistics recalculated successfully after dispute validation`
2. Consultar BD:
   ```sql
   SELECT COUNT(*) FROM faction_map_statistics;
   SELECT map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate 
   FROM faction_map_statistics 
   ORDER BY last_updated DESC 
   LIMIT 10;
   ```
3. Comparar con matches table:
   ```sql
   SELECT 
     m.map,
     m.winner_faction,
     m.loser_faction,
     COUNT(*) as game_count
   FROM matches m
   WHERE NOT (m.admin_reviewed = true AND m.status = 'cancelled')
   GROUP BY m.map, m.winner_faction, m.loser_faction;
   ```

## Líneas Modificadas

- **Archivo**: `backend/src/routes/matches.ts`
- **Endpoint**: `POST /api/matches/admin/:id/dispute` (action='validate')
- **Línea**: ~1155 (después de actualizar users stats)
- **Cambio**: Agregado bloque STEP 7 con llamada a `recalculate_faction_map_statistics()`

## Impacto

- ✅ Estadísticas de facción/mapa ahora correctas tras validar disparates
- ✅ Sin cambios en API contracts o respuestas
- ✅ Sin impacto en performance (misma función que ya se usaba)
- ✅ Compatible con sistema de balance events históricos
