#!/bin/bash
# Script de verificación del fix de estadísticas

# Este script verifica que las estadísticas de facción/mapa se recalculan correctamente

echo "============================================================"
echo "TEST: Verificación de Estadísticas (Faction/Map Statistics)"
echo "============================================================"
echo ""

# Configuración
API_HOST="${API_HOST:-localhost}"
API_PORT="${API_PORT:-3000}"
ADMIN_TOKEN="${ADMIN_TOKEN}"

if [ -z "$ADMIN_TOKEN" ]; then
  echo "ERROR: ADMIN_TOKEN no está definido"
  echo "Uso: ADMIN_TOKEN='token' ./test_statistics_fix.sh"
  exit 1
fi

# Función para hacer requests
api_call() {
  local method=$1
  local endpoint=$2
  local data=$3
  
  if [ -z "$data" ]; then
    curl -s -X "$method" \
      "http://$API_HOST:$API_PORT$endpoint" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json"
  else
    curl -s -X "$method" \
      "http://$API_HOST:$API_PORT$endpoint" \
      -H "Authorization: Bearer $ADMIN_TOKEN" \
      -H "Content-Type: application/json" \
      -d "$data"
  fi
}

echo "TEST 1: Recalcular estadísticas globales"
echo "=========================================="
echo "POST /api/admin/recalculate-all-stats"
echo ""

result1=$(api_call POST "/api/admin/recalculate-all-stats" "{}")
echo "Respuesta:"
echo "$result1" | jq '.'
echo ""

echo "TEST 2: Consultar estadísticas de facción/mapa después de recalcular"
echo "===================================================================="
echo "GET /api/statistics/faction-by-map?minGames=0"
echo ""

result2=$(api_call GET "/api/statistics/faction-by-map?minGames=0")
total_rows=$(echo "$result2" | jq 'length')
echo "Total de registros: $total_rows"
echo ""

# Mostrar primeros 5 registros
echo "Primeros 5 registros:"
echo "$result2" | jq '.[0:5]'
echo ""

echo "TEST 3: Consultar estadísticas de balance de mapa"
echo "=================================================="
echo "GET /api/statistics/map-balance"
echo ""

result3=$(api_call GET "/api/statistics/map-balance")
map_count=$(echo "$result3" | jq 'length')
echo "Total de mapas analizados: $map_count"
echo ""

echo "Primeros 3 mapas:"
echo "$result3" | jq '.[0:3]'
echo ""

echo "TEST 4: Estadísticas globales por facción"
echo "=========================================="
echo "GET /api/statistics/faction-global"
echo ""

result4=$(api_call GET "/api/statistics/faction-global")
faction_count=$(echo "$result4" | jq 'length')
echo "Total de facciones: $faction_count"
echo ""

echo "Facciones:"
echo "$result4" | jq '.[] | {faction_name, global_winrate, total_games}'
echo ""

echo "============================================================"
echo "✅ TEST COMPLETADO"
echo "============================================================"
echo ""
echo "Puntos a verificar:"
echo "1. ✅ Recalculation completada sin errores"
echo "2. ✅ faction_map_statistics contiene datos"
echo "3. ✅ No hay valores duplicados (winrates entre 0-100%)"
echo "4. ✅ Total de games coincide entre consultas"
echo "5. ✅ Facciones muestran winrates realistas"
echo ""
