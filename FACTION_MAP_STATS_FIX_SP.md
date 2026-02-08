# Fix: Errores en el Cálculo de Faction Map Statistics

## Problemas Identificados

### 1. **Inconsistencia en la Condición WHERE**

**En el trigger `update_faction_map_statistics()`:**
```sql
IF NEW.admin_reviewed = true AND NEW.status = 'cancelled' THEN
  RETURN NEW; -- Skip
END IF;
```

**En la función `recalculate_faction_map_statistics()`:**
```sql
WHERE NOT (m.admin_reviewed = true AND m.status = 'cancelled')
```

✅ Ambos son equivalentes, está bien.

### 2. **Bug en el Cálculo del Winrate para Perdedores** (CRÍTICO)

**Línea 89-91 en `20251227_faction_map_statistics.sql`:**

```sql
losses = faction_map_statistics.losses + 1,
winrate = ROUND(100.0 * faction_map_statistics.wins / (faction_map_statistics.total_games + 1), 2)::NUMERIC(5,2),
```

**Problema**: El winrate se calcula usando `wins` OLD pero `total_games` nuevo (+1).

**Ejemplo con números:**
- Registro actual: `total_games=2, wins=1, losses=1, winrate=50%`
- Nueva derrota:
  - ✅ `losses = 1 + 1 = 2`
  - ✅ `total_games + 1 = 3`
  - ❌ `winrate = 100.0 * 1 / 3 = 33.33%` ← CORRECTO por coincidencia, pero está usando el OLD wins
  
**Cuando hay múltiples pérdidas consecutivas se desvirtuá:**
- Registro: `total_games=5, wins=2, losses=3, winrate=40%`
- Nueva derrota:
  - `losses = 3 + 1 = 4`
  - `total_games + 1 = 6`  
  - ❌ `winrate = 100.0 * 2 / 6 = 33.33%` ← INCORRECTO (debería ser 2/6=33.33, está correcto)
  
**En realidad está calculando correctamente, pero es confuso. El verdadero problema es:**

### 3. **Matches Existentes no Procesadas** (PROBLEMA PRINCIPAL)

Hay 100+ matches en la tabla `matches`, pero la tabla `faction_map_statistics` tiene muy pocos registros con `total_games=1`.

Esto significa que **muchas partidas nunca fueron procesadas por el trigger**, probablemente porque:
- El trigger NO se ejecutó al insertar los matches originales
- O se insertaron antes de crear el trigger

## Solución

### Paso 1: Verificar Cuántos Matches Faltan

```sql
-- Matches sin procesar
SELECT COUNT(*) as matches_not_in_stats
FROM (
  SELECT DISTINCT m.map, m.winner_faction, m.loser_faction
  FROM matches m
  WHERE m.status != 'cancelled'
  EXCEPT
  SELECT DISTINCT gm.name, f_winner.name, f_loser.name
  FROM faction_map_statistics fms
  JOIN game_maps gm ON fms.map_id = gm.id
  JOIN factions f_winner ON fms.faction_id = f_winner.id
  JOIN factions f_loser ON fms.opponent_faction_id = f_loser.id
  WHERE fms.wins > 0  -- Ganadores que sí están registrados
) as missing;
```

### Paso 2: Ejecutar Recalculate

```sql
SELECT recalculate_faction_map_statistics();
```

### Paso 3: Corregir el Winrate en el Trigger (Limpieza)

En `20251227_faction_map_statistics.sql`, línea 89:

**Cambiar:**
```sql
winrate = ROUND(100.0 * faction_map_statistics.wins / (faction_map_statistics.total_games + 1), 2)::NUMERIC(5,2),
```

**A:**
```sql
winrate = ROUND(100.0 * faction_map_statistics.wins::NUMERIC / (faction_map_statistics.total_games + 1), 2)::NUMERIC(5,2),
```

(Agregando `::NUMERIC` para evitar división entera)

## Verificación

Ejecuta después del fix:

```sql
-- Debe mostrar el mismo total de games entre matches y faction_map_statistics
SELECT 
  'matches' as source,
  SUM(1) as total
FROM matches
WHERE status != 'cancelled'
UNION ALL
SELECT 
  'faction_map_statistics' as source,
  CEIL(SUM(total_games) / 2.0) as total  -- Dividir entre 2 porque cada match genera 2 registros
FROM faction_map_statistics;
```

Ambos deben ser iguales ~100 matches.
