# Fix: Opponent Statistics Calculation Bug

## Problema Identificado

**Síntoma**: En la página "My Opponents" de un jugador como StonyDrew, se mostraba un total de partidas incorrecto (14 partidas vs Megac1) cuando en la lista de matches se veían muchas más.

**Root Cause**: El bug estaba en la función `recalculate_player_match_statistics()` que se usa para precalcular las estadísticas por oponente. Esta función tiene dos pasos:

1. **Inserta estadísticas desde la perspectiva de GANADOR** (h2h_winner_agg)
   - Ejemplo: StonyDrew ganó 5 partidas vs Megac1

2. **Inserta estadísticas desde la perspectiva de PERDEDOR** (h2h_loser_agg)
   - Ejemplo: StonyDrew perdió 9 partidas vs Megac1

### El Error Específico:

En las migraciones previas (20260125_fix_opponent_stats_calculation.sql y 20260125_fix_h2h_stats_merge.sql), se usaba `ON CONFLICT` para manejar duplicados:

```sql
INSERT INTO player_match_statistics (...) 
SELECT ... FROM h2h_winner_agg
ON CONFLICT (...) DO UPDATE SET
    total_games = EXCLUDED.total_games,  -- Sobrescribe!
    wins = EXCLUDED.wins,                -- Sobrescribe!
    losses = EXCLUDED.losses,            -- Sobrescribe!
    ...
```

**Problema**: Cuando h2h_loser_agg intentaba insertar datos para el mismo par (jugador, oponente), el `ON CONFLICT` **REEMPLAZABA COMPLETAMENTE** los datos del winner en lugar de **COMBINARLOS**.

### Resultado:
- **Esperado**: total_games = 5 wins + 9 losses = 14 partidas
- **Actual**: total_games = solo 9 (del último INSERT, loser_agg)

## Solución Implementada

Migración: `20260213_fix_h2h_aggregation_merge.sql`

### Cambios:

1. **Usar UNION para combinar datos ANTES de insertar**:
   ```sql
   WITH h2h_combined AS (
       -- Winners perspective
       SELECT winner_id, loser_id, COUNT(*) as wins, 0 as losses, ...
       FROM matches WHERE ...
       GROUP BY winner_id, loser_id
       
       UNION ALL
       
       -- Losers perspective (same pairs, different counts)
       SELECT loser_id, winner_id, 0 as wins, COUNT(*) as losses, ...
       FROM matches WHERE ...
       GROUP BY loser_id, winner_id
   )
   ```

2. **Agregar (SUM) después del UNION**:
   ```sql
   WITH h2h_merged AS (
       SELECT
           player_id,
           opponent_id,
           SUM(wins) as wins,       -- Suma wins de ambas perspectivas
           SUM(losses) as losses,   -- Suma losses de ambas perspectivas
           SUM(wins + losses) as total_games,
           ...
       FROM h2h_combined
       GROUP BY player_id, opponent_id
   )
   ```

3. **Insertar una sola vez con datos correctos**:
   ```sql
   INSERT INTO player_match_statistics (...)
   SELECT ... FROM h2h_merged
   -- NO ON CONFLICT - solo una inserción correcta
   ```

## Cómo Ejecutar la Migración

1. En tu base de datos (Supabase o local):
   ```bash
   psql -d <your_db> -f backend/migrations/20260213_fix_h2h_aggregation_merge.sql
   ```

2. O si estás usando Supabase, copia el contenido en el SQL Editor:
   - Supabase Dashboard → SQL Editor → New Query
   - Pega el contenido de `20260213_fix_h2h_aggregation_merge.sql`
   - Click Execute

3. La función `recalculate_player_match_statistics()` se ejecutará automáticamente al final.

## Verificación

Después de ejecutar la migración, verifica que las estadísticas sean correctas:

```sql
-- Ver estadísticas de StonyDrew vs todos sus oponentes
SELECT 
  u.nickname as opponent_name,
  pms.total_games,
  pms.wins,
  pms.losses,
  pms.winrate
FROM player_match_statistics pms
JOIN users u ON pms.opponent_id = u.id
WHERE pms.player_id = (SELECT id FROM users WHERE nickname = 'StonyDrew')
  AND pms.opponent_id IS NOT NULL
  AND pms.map_id IS NULL
  AND pms.faction_id IS NULL
ORDER BY pms.total_games DESC;
```

Ahora `total_games` debe coincidir con `wins + losses` y ser consistente con la tabla de matches.

## Archivos Modificados

- ✅ `backend/migrations/20260213_fix_h2h_aggregation_merge.sql` - Nueva migración con fix

## Cambios en Datos

- ✅ `recalculate_player_match_statistics()` - Función reparada
- ✅ `player_match_statistics` - Tabla recalculada con valores correctos para:
  - **Head-to-Head (Opponent Stats)**: Ahora suma correctamente wins + losses
  - **Per-Map Stats**: Ahora suma correctamente wins + losses por mapa
  - **Per-Faction Stats**: Ahora suma correctamente wins + losses por facción
- ✅ API endpoints afectados:
  - `/player-statistics/player/:playerId/recent-opponents` - Retorna H2H correctos
  - Cualquier endpoint que use map stats o faction stats también será correcto

## Notas

- El trigger `update_player_match_statistics()` que se ejecuta en cada nuevo match ya estaba implementado correctamente en `20251230_unified_player_statistics.sql`
- Solo necesitaba corregir la función de recalculation
- Los nuevos matches seguirán siendo registrados correctamente por el trigger
