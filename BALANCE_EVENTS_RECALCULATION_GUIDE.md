# Balance Events - Historical Snapshots Recalculation

## El Problema

Cuando creas un **balance event con fecha retroactiva** (ej: 26/11/2025), el sistema no tiene snapshots históricos en `faction_map_statistics_history` para esa fecha. Esto causa que:

- ✅ El balance event se registra correctamente en `balance_events`
- ❌ No hay datos históricos para comparar "antes/después"
- ❌ El componente `BalanceEventImpactPanel` no muestra resultados

## La Solución

Tu sistema tiene dos tablas de estadísticas:

### 1. `faction_map_statistics` (Tabla Principal)
- Contiene las estadísticas **actuales/agregadas**
- Se actualiza automáticamente con cada partido nuevo
- Incluye datos de todo el historial de partidos

### 2. `faction_map_statistics_history` (Tabla de Snapshots)
- Contiene **snapshots diarios** de las estadísticas
- Se usa para mostrar tendencias históricas
- Se usa para comparar impacto de balance events

## Cómo Recalcular

### Opción 1: Vía API (Recomendado)

```bash
POST /api/statistics/history/recalculate-snapshots
```

**Respuesta:**
```json
{
  "message": "Historical snapshots recalculated successfully",
  "totalSnapshots": 1250,
  "totalSkipped": 15,
  "dateRange": {
    "from": "2024-12-01",
    "to": "2025-12-29"
  }
}
```

Este endpoint:
- ✅ Calcula automáticamente todas las fechas del primer partido al hoy
- ✅ Crea snapshots para cada día
- ✅ Es seguro (no duplica datos)
- ✅ Reporta cuántos snapshots se crearon

### Opción 2: Vía SQL Directo

Ejecuta el script en tu base de datos:

```sql
-- Generate snapshots for all missing dates
SELECT create_faction_map_statistics_snapshot(snapshot_date)
FROM (
  SELECT DISTINCT DATE(match_date) as snapshot_date
  FROM matches
  WHERE match_date IS NOT NULL
  ORDER BY snapshot_date DESC
  LIMIT 1000
) date_series;
```

## Después de Recalcular

Una vez que recalcules los snapshots:

1. **Selecciona el balance event** en la página de Estadísticas
2. El sistema mostrará:
   - Estadísticas **antes** del balance event
   - Estadísticas **después** del balance event
   - **Cambio de winrate** para cada matchup afectado
   - **Impacto visual** en gráficos

## ¿Qué Sucede en Background?

La función `create_faction_map_statistics_snapshot()`:

```sql
-- Para cada fecha, copia el estado actual de faction_map_statistics
INSERT INTO faction_map_statistics_history
SELECT * FROM faction_map_statistics
WHERE snapshot_date = '2025-11-26'
```

Esto significa que:
- **Todos los snapshots contendrán el estado ACTUAL** de las estadísticas
- Es como si hubieras capturado el estado actual en cada fecha histórica
- Perfecto para análisis retroactivo de balance changes

## Flujo Completo

```
1. Creas balance event → balance_events
                  ↓
2. Ejecutas recalculate-snapshots → faction_map_statistics_history (se pobla)
                  ↓
3. Seleccionas el balance event en UI
                  ↓
4. get_balance_event_impact() compara:
   - Datos ANTES: faction_map_statistics_history (30 días antes)
   - Datos DESPUÉS: faction_map_statistics_history (30 días después)
                  ↓
5. Se muestran los cambios en winrate
```

## Parámetros Configurables

En el endpoint de impacto:

```bash
GET /api/statistics/history/events/{eventId}/impact?daysBefore=30&daysAfter=30
```

- `daysBefore`: Cuántos días antes del evento usar para comparación (default: 30)
- `daysAfter`: Cuántos días después del evento usar para comparación (default: 30)

## Ejemplo Práctico

**Balance Event:** Nerf a Undead el 26/11/2025

1. Haces POST a `/api/statistics/history/recalculate-snapshots`
2. Esperas ~10-30 segundos (depende de cuántos partidos tengas)
3. Vas a Estadísticas → Seleccionas "26/11/2025 - Nerf"
4. Ves:
   - Winrate de Undead ANTES (promedio 26/10 - 26/11)
   - Winrate de Undead DESPUÉS (promedio 26/11 - 26/12)
   - Cambio en porcentaje
   - Cantidad de games usados para cálculo

## Notas Importantes

- **Los snapshots se crean sin duplicar**: Si ya existe uno para esa fecha, se salta
- **Es idempotente**: Puedes ejecutar multiple veces sin problema
- **No afecta datos actuales**: Solo lee de `faction_map_statistics` y escribe en `_history`
- **Mejor ejecutar en horario off-peak**: Si tienes miles de partidos, puede tomar tiempo

## Solución Rápida (1 minuto)

1. Ve a `/admin/statistics` (o donde sea que hayas expuesto el endpoint)
2. Click en botón "Recalculate Historical Snapshots" (si lo añades al UI)
3. O ejecuta desde terminal:
   ```bash
   curl -X POST https://tu-api.com/api/statistics/history/recalculate-snapshots
   ```
4. Espera el resultado
5. Listo ✅
