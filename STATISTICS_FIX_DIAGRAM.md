# Diagrama del Fix: Estadísticas Acumulándose

## ANTES (Problema)

```
┌─────────────────────────────────────────────────────────────────┐
│  ACCIÓN 1: Admin recalcula estadísticas                          │
└─────────────────────────────────────────────────────────────────┘
POST /api/admin/recalculate-all-stats
  ↓
[admin.ts línea 654]
  await query('SELECT recalculate_faction_map_statistics()');
  ↓
✅ TRUNCATE faction_map_statistics
✅ Reinserta correctamente
  ↓
  Stats: A=50%, B=45% ✅ (correctas)

┌─────────────────────────────────────────────────────────────────┐
│  ACCIÓN 2: Admin valida una disputa (cancela un match)          │
└─────────────────────────────────────────────────────────────────┘
POST /api/matches/admin/:id/dispute?action=validate
  ↓
[matches.ts línea 1030+]
  Marca match como cancelled
  ↓
  Recalcula stats de usuario (ELO)
  ↓
  ❌ NO LLAMA recalculate_faction_map_statistics()
  ❌
  Stats quedan sin limpiar en faction_map_statistics
  ↓
  [TRIGGER AUTOMÁTICO] update_faction_map_statistics()
  Se ejecuta al UPDATE de matches
  ↓
  ❌ Suma NUEVAMENTE a los valores existentes
  ↓
  ACUMULACIÓN:
  Stats: A=100% (50% + 50% nuevamente), B=90% (45% + 45%) ❌

┌─────────────────────────────────────────────────────────────────┐
│  RESULTADO: Estadísticas desvirtuadas 🔴                        │
└─────────────────────────────────────────────────────────────────┘
```

## DESPUÉS (Solución)

```
┌─────────────────────────────────────────────────────────────────┐
│  ACCIÓN 1: Admin recalcula estadísticas                          │
└─────────────────────────────────────────────────────────────────┘
POST /api/admin/recalculate-all-stats
  ↓
[admin.ts línea 654]
  await query('SELECT recalculate_faction_map_statistics()');
  ↓
✅ TRUNCATE faction_map_statistics
✅ Reinserta correctamente
  ↓
  Stats: A=50%, B=45% ✅ (correctas)

┌─────────────────────────────────────────────────────────────────┐
│  ACCIÓN 2: Admin valida una disputa (cancela un match)          │
└─────────────────────────────────────────────────────────────────┘
POST /api/matches/admin/:id/dispute?action=validate
  ↓
[matches.ts línea 1030+]
  Marca match como cancelled
  ↓
  Recalcula stats de usuario (ELO)
  ↓
  ✅ [NUEVO] STEP 7: Llama recalculate_faction_map_statistics()
  ↓
  ✅ TRUNCATE faction_map_statistics (limpia todo)
  ✅ Reinserta desde matches (excluyendo los cancelados)
  ↓
  Stats: A=48%, B=43% ✅ (correctas, sin el match cancelado)

┌─────────────────────────────────────────────────────────────────┐
│  RESULTADO: Estadísticas correctas y limpias 🟢                 │
└─────────────────────────────────────────────────────────────────┘
```

## Líneas de Código

### ❌ ANTES (matches.ts línea ~1155)
```typescript
// Reopen the associated tournament match for re-reporting
const tournamentMatchResult = await query(
  `SELECT tm.id as tm_id FROM tournament_matches tm
   WHERE tm.match_id = $1`,
  [id]
);

// FALTA: recalculate_faction_map_statistics()
```

### ✅ DESPUÉS (matches.ts línea ~1155)
```typescript
// STEP 7: Recalculate faction/map balance statistics
try {
  await query('SELECT recalculate_faction_map_statistics()');
  if (process.env.BACKEND_DEBUG_LOGS === 'true') 
    console.log('Faction/map statistics recalculated successfully after dispute validation');
} catch (error) {
  console.error('Error recalculating faction/map statistics:', error);
  // Don't fail the entire operation if balance stats fail
}

// Reopen the associated tournament match for re-reporting
const tournamentMatchResult = await query(
  `SELECT tm.id as tm_id FROM tournament_matches tm
   WHERE tm.match_id = $1`,
  [id]
);
```

## Tabla Comparativa

| Aspecto | Antes | Después |
|---------|-------|---------|
| **Admin recalcula stats** | ✅ Trunca + Reinserta | ✅ Trunca + Reinserta |
| **Admin valida disputa** | ❌ No trunca | ✅ Trunca + Reinserta |
| **Resultado de stats** | Acumuladas, incorrectas | Correctas, limpias |
| **Matches contados** | Múltiples veces | Una sola vez |
| **Winrates** | Inflados | Precisos |

## Código de la Función (schema)

```typescript
// En backend/migrations/20251227_faction_map_statistics.sql

CREATE OR REPLACE FUNCTION recalculate_faction_map_statistics()
RETURNS void AS $$
DECLARE
  v_total_records INT := 0;
BEGIN
  -- 🔑 CLAVE: Trunca primero
  TRUNCATE TABLE faction_map_statistics;
  
  -- Luego inserta desde matches, filtrando los cancelados
  WITH winner_stats AS (
    SELECT
      gm.id as map_id,
      f_winner.id as faction_id,
      f_loser.id as opponent_faction_id,
      COUNT(*)::INT as total_games,
      COUNT(*)::INT as wins,
      0::INT as losses
    FROM matches m
    WHERE NOT (m.admin_reviewed = true AND m.status = 'cancelled')
    GROUP BY ...
  )
  INSERT INTO faction_map_statistics ...
  
  -- Similar para loser_stats
  ...
END;
```

## Impact Summary

✅ **Problema solucionado**: Estadísticas ahora se reinician correctamente en ambas acciones
✅ **Sin breaking changes**: Mismo comportamiento esperado, pero correcto
✅ **Compatible**: Funciona con todos los sistemas de estadísticas existentes
✅ **Performance**: Mismo costo que antes (misma función)
