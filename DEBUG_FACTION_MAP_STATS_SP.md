# Debugging: Faction Map Statistics Not Recalculating

## 🔍 El Problema

El botón "Recalculate All Stats" en admin no está:
1. Truncando `faction_map_statistics`
2. Reconstruyendo la tabla

## ✅ Pasos para Debuggear

### Paso 1: Verificar que la función existe

```sql
-- En la BD, ejecuta:
SELECT * FROM information_schema.routines 
WHERE routine_name = 'recalculate_faction_map_statistics';

-- Debería retornar 1 fila con la función
```

### Paso 2: Verificar que el trigger existe

```sql
-- En la BD, ejecuta:
SELECT * FROM information_schema.triggers 
WHERE trigger_name = 'trg_update_faction_map_stats';

-- Debería retornar 1 fila
```

### Paso 3: Ejecutar la función manualmente

```sql
-- En la BD, ejecuta directamente:
SELECT recalculate_faction_map_statistics();

-- Observa si hay errores
```

### Paso 4: Ver los logs del backend

Después de presionar el botón en el frontend, busca en los logs:

```
🟢 Faction/map statistics recalculated successfully
```

o

```
🔴 ERROR recalculating faction/map statistics:
Error message: ...
Error code: ...
```

### Paso 5: Verificar estado de la tabla

```sql
-- Antes de recalculate
SELECT COUNT(*) as before_count FROM faction_map_statistics;

-- Presiona el botón en el frontend

-- Después de recalculate
SELECT COUNT(*) as after_count FROM faction_map_statistics;
```

---

## 🔧 Posibles Problemas y Soluciones

### Problema A: Función no existe
```
ERROR: function recalculate_faction_map_statistics() does not exist
```

**Solución**: Ejecuta la migración manualmente:
```bash
psql -U postgres -d tournament_db < backend/migrations/20251227_faction_map_statistics.sql
```

### Problema B: Trigger no fue recreado
```
ERROR: permission denied for schema public
o similar
```

**Solución**: El DROP TRIGGER funciona, pero el CREATE falla. Verificar:
```sql
-- Ver si existe el trigger
\dt trg_update_faction_map_stats

-- Recreaerlo manualmente:
CREATE TRIGGER trg_update_faction_map_stats
AFTER INSERT OR UPDATE ON matches
FOR EACH ROW
EXECUTE FUNCTION update_faction_map_statistics();
```

### Problema C: TRUNCATE falla
```
ERROR: cannot truncate table faction_map_statistics because other objects depend on it
```

**Solución**: Hay una FK o vista que previene el TRUNCATE. En lugar de TRUNCATE, usar DELETE:

Cambiar en `backend/migrations/20251227_faction_map_statistics.sql`:
```sql
-- De:
TRUNCATE TABLE faction_map_statistics;

-- A:
DELETE FROM faction_map_statistics;
```

Luego ejecutar la migración de nuevo.

---

## 🎯 Test Rápido Sin BD

Si no puedes acceder a la BD, aquí está lo que debería pasar:

1. Frontend hace: `POST /api/admin/recalculate-all-stats`
2. Backend:
   ```
   - DROP TRIGGER (no error) → Log: "Disabled trigger"
   - Loop matches (UPDATE) → Sin errores
   - UPDATE users → Sin errores
   - CREATE TRIGGER → Log: "Re-enabled trigger"
   - SELECT recalculate_faction_map_statistics() → Log: "🟢 Recalculated successfully"
   - RETURN 200 OK
   ```

3. Si ve "🔴 ERROR", ahí está el problema

---

## 📋 Checklist

- [ ] Función `recalculate_faction_map_statistics()` existe en BD
- [ ] Trigger `trg_update_faction_map_stats` existe en BD
- [ ] Logs muestran "Re-enabled trigger" (sin error)
- [ ] Logs muestran "🟢 Recalculated successfully"
- [ ] Tabla `faction_map_statistics` tiene rows después de recalculate
- [ ] Winrates en la tabla están entre 0-100

---

## 🔗 Archivos Relevantes

- Función SQL: [`backend/migrations/20251227_faction_map_statistics.sql`](backend/migrations/20251227_faction_map_statistics.sql#L109)
- Endpoint: [`backend/src/routes/admin.ts#L650`](backend/src/routes/admin.ts#L650) (recalculate_faction_map_statistics call)
- Trigger definition: [`backend/migrations/20251227_faction_map_statistics.sql#L44`](backend/migrations/20251227_faction_map_statistics.sql#L44)

---

## 💡 Cambios Recientes

Se agregó mejor logging en el endpoint (línea 670):
```typescript
const recalcResult = await query('SELECT recalculate_faction_map_statistics()');
console.log('🟢 Faction/map statistics recalculated successfully');
console.log('Result:', recalcResult.rows);
```

Busca estos logs en el backend después de presionar el botón.

---

## 🚨 Urgente: Verificar Comando exacto

Cuando presionas el botón, en los logs deberías ver:

```
Global stats recalculation completed: X matches replayed, Y users updated
Disabled trigger: trg_update_faction_map_stats
Re-enabled trigger: trg_update_faction_map_stats
🟢 Faction/map statistics recalculated successfully
Result: [{ ... }]
```

Si ves error, cópialo y pégalo aquí.
