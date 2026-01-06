# Guía de Testing: Fix de Estadísticas Acumulándose

## Objetivo
Verificar que las estadísticas de `faction_map_statistics` se recalculan correctamente sin acumularse cuando se valida una disputa.

---

## Test 1: Verificación Manual en Base de Datos

### Paso 1: Contar registros antes de validar disputa
```sql
-- Ejecutar ANTES de validar una disputa
SELECT 
  COUNT(*) as total_fms_records,
  SUM(total_games) as total_games_sum,
  COUNT(DISTINCT map_id) as maps_affected
FROM faction_map_statistics;

-- Resultado esperado: N registros, suma de games, M mapas
```

### Paso 2: Obtener una disputa pendiente
```sql
-- Encontrar una disputa para probar
SELECT id, winner_id, loser_id, map, created_at
FROM matches
WHERE status = 'disputed'
ORDER BY created_at DESC
LIMIT 1;
```

### Paso 3: Validar la disputa vía API
```bash
MATCH_ID="<uuid de disputa>"
ADMIN_TOKEN="<token de admin>"

curl -X POST "http://localhost:3000/api/matches/admin/$MATCH_ID/dispute" \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"action":"validate"}'
```

### Paso 4: Contar registros después
```sql
-- Ejecutar DESPUÉS de validar la disputa
SELECT 
  COUNT(*) as total_fms_records,
  SUM(total_games) as total_games_sum,
  COUNT(DISTINCT map_id) as maps_affected
FROM faction_map_statistics;

-- Resultado esperado: MENOS registros que antes (si el match eliminado era único)
-- O IGUAL si el match tenía duplicados en otro matchup
```

### Paso 5: Verificar que winrates son válidos
```sql
-- NO debería retornar filas (winrate debe estar entre 0-100)
SELECT *
FROM faction_map_statistics
WHERE winrate < 0 OR winrate > 100 OR winrate IS NULL;

-- Resultado esperado: 0 filas
```

---

## Test 2: Comparación con Matches Table

### Verificar que faction_map_statistics coincide con matches

```sql
-- QUERY A: Lo que debería haber en faction_map_statistics
WITH expected_stats AS (
  SELECT
    gm.id as map_id,
    gm.name as map_name,
    f_winner.id as faction_id,
    f_loser.id as opponent_faction_id,
    COUNT(*) as expected_games,
    COUNT(*) as expected_wins,
    0 as expected_losses,
    100.0 as expected_winrate
  FROM matches m
  JOIN game_maps gm ON gm.name = m.map
  JOIN factions f_winner ON f_winner.name = m.winner_faction
  JOIN factions f_loser ON f_loser.name = m.loser_faction
  WHERE NOT (m.admin_reviewed = true AND m.status = 'cancelled')
  GROUP BY gm.id, gm.name, f_winner.id, f_loser.id
)
SELECT 
  es.map_name,
  es.faction_id,
  es.opponent_faction_id,
  es.expected_games,
  fms.total_games,
  CASE 
    WHEN es.expected_games = fms.total_games THEN '✅ OK'
    ELSE '❌ MISMATCH'
  END as status
FROM expected_stats es
LEFT JOIN faction_map_statistics fms 
  ON fms.map_id = es.map_id 
  AND fms.faction_id = es.faction_id 
  AND fms.opponent_faction_id = es.opponent_faction_id
ORDER BY status DESC, es.map_name;

-- Resultado esperado: Todos con '✅ OK'
```

---

## Test 3: Automatizado con Script

### Crear script de test automático

```bash
#!/bin/bash
# test_statistics_consistency.sh

API_HOST="localhost"
API_PORT="3000"
ADMIN_TOKEN="$1"

if [ -z "$ADMIN_TOKEN" ]; then
  echo "Usage: ./test_statistics_consistency.sh <admin_token>"
  exit 1
fi

# Test 1: Recalcular estadísticas
echo "=== TEST 1: Recalcular Estadísticas ==="
curl -s -X POST "http://$API_HOST:$API_PORT/api/admin/recalculate-all-stats" \
  -H "Authorization: Bearer $ADMIN_TOKEN" | jq '.message'

sleep 2

# Test 2: Obtener estadísticas
echo -e "\n=== TEST 2: Obtener Estadísticas ==="
STATS=$(curl -s "http://$API_HOST:$API_PORT/api/statistics/faction-by-map?minGames=0" \
  -H "Authorization: Bearer $ADMIN_TOKEN")

TOTAL=$(echo "$STATS" | jq 'length')
echo "Total de registros: $TOTAL"

# Test 3: Verificar no hay winrates inválidos
INVALID=$(echo "$STATS" | jq '[.[] | select(.faction_1_winrate < 0 or .faction_1_winrate > 100 or .faction_2_winrate < 0 or .faction_2_winrate > 100)] | length')
echo "Registros con winrates inválidos: $INVALID"

if [ "$INVALID" == "0" ]; then
  echo "✅ TEST PASSED: No hay winrates inválidos"
else
  echo "❌ TEST FAILED: Se encontraron winrates inválidos"
fi

# Test 4: Mostrar sample de datos
echo -e "\n=== TEST 3: Sample de Datos ==="
echo "$STATS" | jq '.[0:3]'
```

---

## Test 4: Scenario Completo

### Reproducer paso a paso

```
1. [ADMIN] Recalcular estadísticas globales
   POST /api/admin/recalculate-all-stats
   ↓
   ✅ Estadísticas limpias, winrates correctos

2. [ADMIN] Ir a página de Disputas
   GET /api/matches/disputed/all
   ↓
   ✅ Ver lista de disputas pendientes

3. [ADMIN] Validar una disputa (acción que causaba el problema)
   POST /api/matches/admin/{disputeId}/dispute
   Body: {"action": "validate"}
   ↓
   ✅ [NUEVO] Ahora llama recalculate_faction_map_statistics()

4. [USER] Ir a página de Estadísticas
   GET /api/statistics/faction-by-map
   ↓
   ✅ Winrates correctos y sin acumulación

5. [ADMIN] Ir a BD y verificar
   SELECT SUM(total_games) FROM faction_map_statistics;
   ↓
   ✅ Valores consistentes con tabla matches
```

---

## Test 5: Verificación de Logs

### Buscar en logs del backend

```bash
# En el servidor backend, buscar estos logs
tail -f logs/backend.log | grep -i "faction/map"

# Deberías ver:
# [2025-01-06 14:30:45] Faction/map statistics recalculated successfully after dispute validation
```

---

## Checklist de Validación

- [ ] ✅ Sin errores en consola del backend
- [ ] ✅ Log muestra: "Faction/map statistics recalculated successfully after dispute validation"
- [ ] ✅ `SELECT COUNT(*) FROM faction_map_statistics` retorna un número razonable
- [ ] ✅ `SELECT * FROM faction_map_statistics WHERE winrate < 0 OR winrate > 100` retorna 0 filas
- [ ] ✅ Página de Estadísticas muestra winrates entre 0-100%
- [ ] ✅ Winrates coinciden aproximadamente con matches manuales
- [ ] ✅ Validar múltiples disputas no causa acumulación
- [ ] ✅ Recalcular estadísticas manualmente retorna mismos valores

---

## Valores Esperados de Winrate

Después del fix, deberías ver:

### ❌ ANTES (Síntomas del problema)
```
Faction A vs B on Map X:
- Games: 10
- Faction A winrate: 150% ← ❌ IMPOSIBLE
- Significa: Los 10 games se contaron 1.5 veces

Faction C globally:
- Games: 52
- Winrate: 115% ← ❌ IMPOSIBLE
```

### ✅ DESPUÉS (Fix aplicado)
```
Faction A vs B on Map X:
- Games: 10
- Faction A winrate: 60% ← ✅ CORRECTO (6 wins, 4 losses)

Faction C globally:
- Games: 52
- Winrate: 48% ← ✅ REALISTA (25 wins, 27 losses)
```

---

## Troubleshooting

### Si siguen apareciendo winrates > 100%

```bash
# 1. Limpiar manualmente la tabla
psql -h localhost -U postgres -d tournament_db -c "TRUNCATE TABLE faction_map_statistics;"

# 2. Forzar recalcular
curl -X POST "http://localhost:3000/api/admin/recalculate-all-stats" \
  -H "Authorization: Bearer $ADMIN_TOKEN"

# 3. Verificar que el fix está deployado
grep -n "recalculate_faction_map_statistics" backend/src/routes/matches.ts | grep -i "dispute"
# Debería retornar la línea ~1157 con la llamada en dispute validation
```

### Si la función recalculate_faction_map_statistics no existe

```bash
# 1. Verificar que la migración se ejecutó
psql -h localhost -U postgres -d tournament_db -c "\df recalculate_faction_map_statistics"

# 2. Si no existe, ejecutar la migración manualmente
psql -h localhost -U postgres -d tournament_db < backend/migrations/20251227_faction_map_statistics.sql
```

---

## Comando Rápido para Testing

```bash
#!/bin/bash
# test_quick.sh - Test rápido del fix

TOKEN="$1"
API="http://localhost:3000/api"

echo "🔄 Recalculando estadísticas..."
curl -s -X POST "$API/admin/recalculate-all-stats" \
  -H "Authorization: Bearer $TOKEN" | jq '.message'

echo -e "\n📊 Obteniendo estadísticas..."
STATS=$(curl -s "$API/statistics/faction-by-map?minGames=0" \
  -H "Authorization: Bearer $TOKEN")

echo "Total registros: $(echo "$STATS" | jq 'length')"
echo -e "\nPrimero 3 registros:"
echo "$STATS" | jq '.[0:3] | .[] | "\(.faction_1_name) vs \(.faction_2_name) on \(.map_name): \(.faction_1_winrate)% vs \(.faction_2_winrate)%"'

echo -e "\n✅ Test completado"
```

---

## Resultado Esperado Final

✅ **Las estadísticas deben ser:**
- Consistentes con tabla `matches`
- Winrates siempre entre 0-100%
- Sin duplicación de games
- Iguales después de múltiples recalculos
- Correctas después de validar disputas
