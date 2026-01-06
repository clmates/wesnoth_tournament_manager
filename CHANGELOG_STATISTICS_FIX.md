# Changelog: Fix de Estadísticas Acumulándose

## 📅 Fecha: 6 de Enero de 2025

## 🔧 Cambios Realizados

### 1. Archivo Principal Modificado

**File**: `backend/src/routes/matches.ts`

**Endpoint**: `POST /api/matches/admin/:id/dispute`
- **Método**: Admin valida/rechaza disputas de matches
- **Action Modified**: `validate` (cuando se cancela un match por disputa)
- **Línea**: ~1155 (después de recalcular stats de usuario)

**Cambio Específico**:
```diff
+      // STEP 7: Recalculate faction/map balance statistics
+      try {
+        await query('SELECT recalculate_faction_map_statistics()');
+        if (process.env.BACKEND_DEBUG_LOGS === 'true') console.log('Faction/map statistics recalculated successfully after dispute validation');
+      } catch (error) {
+        console.error('Error recalculating faction/map statistics:', error);
+        // Don't fail the entire operation if balance stats fail
+      }
```

---

## 📄 Documentación Creada

Se generaron 4 documentos detallados:

### 1. **STATISTICS_ACCUMULATION_FIX.md**
- Explicación técnica completa del problema y solución
- Funcionamiento de la función SQL `recalculate_faction_map_statistics()`
- Flujo antes y después
- Verificación recomendada

### 2. **STATISTICS_FIX_DIAGRAM.md**
- Diagramas visuales ASCII del problema
- Comparativa antes/después
- Código antes y después
- Tabla comparativa

### 3. **STATISTICS_FIX_TESTING_GUIDE.md**
- 5 métodos diferentes para testear el fix
- Test manual en BD
- Comparación con tabla matches
- Script automático
- Scenario completo
- Troubleshooting

### 4. **STATISTICS_FIX_SUMMARY.md** (este documento)
- Resumen ejecutivo del problema y solución
- Checklist de implementación
- Próximos pasos

---

## 🎯 Problema Solucionado

### Síntoma
Las estadísticas en `faction_map_statistics` se acumulaban cada vez que se validaba una disputa:
- Winrates subían a valores > 100%
- Los mismos games se contaban múltiples veces
- Los datos en la página de Statistics eran incorrectos

### Causa Root
En el endpoint de validar disputa (`/api/matches/admin/:id/dispute`), se recalculaban los stats de usuario (ELO) pero **NO** se recalculaban las estadísticas de facción/mapa. Esto permitía que el trigger automático continuara sumando datos duplicados.

### Solución
Agregar una llamada a `recalculate_faction_map_statistics()` después de recalcular stats de usuario. Esta función:
1. **TRUNCATE**: Limpia todos los registros de `faction_map_statistics`
2. **Recalcula desde cero**: Lee de tabla `matches` y reinserta datos correctos
3. **Filtra cancelados**: Excluye los matches que fueron cancelados

---

## ✅ Verificación del Fix

### Rápido (1 minuto)
```bash
# En la BD
psql -h localhost -U postgres -d tournament_db -c \
  "SELECT COUNT(*) as total, 
          MIN(winrate) as min_wr, 
          MAX(winrate) as max_wr 
   FROM faction_map_statistics;"
   
# Esperado: min_wr ≥ 0, max_wr ≤ 100
```

### Completo (10 minutos)
- Ver **STATISTICS_FIX_TESTING_GUIDE.md** para tests detallados

---

## 🚀 Deployment Checklist

- [x] Código modificado sin errores de compilación
- [x] Sin breaking changes en API
- [x] Compatible con código existente
- [x] Documentación completa
- [x] Tests preparados
- [ ] **TODO**: Deploy a staging
- [ ] **TODO**: Deploy a producción
- [ ] **TODO**: Ejecutar `POST /api/admin/recalculate-all-stats` después de deploy
- [ ] **TODO**: Monitorear logs para "Faction/map statistics recalculated"

---

## 📊 Impacto

| Aspecto | Antes | Después |
|---------|-------|---------|
| **Líneas modificadas** | - | 7 líneas |
| **Archivos tocados** | - | 1 archivo |
| **Breaking changes** | N/A | Ninguno |
| **Performance impact** | N/A | Ninguno (misma función) |
| **DB schema changes** | N/A | Ninguno |
| **API contract changes** | N/A | Ninguno |

---

## 🔍 Validación Técnica

### Código Agregado
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
```

**Análisis**:
- ✅ Sigue patrón ya usado en `admin.ts` línea 654
- ✅ Manejo de errores graceful (no failea operación)
- ✅ Logs adecuados para debugging
- ✅ Sin dependencias nuevas
- ✅ Compatible con middleware existente

---

## 📞 Preguntas Frecuentes

### ¿Qué estadísticas se ven afectadas?
- `faction_map_statistics`: Tabla de balance de facción por mapa (DIRECTAMENTE)
- `faction_map_statistics_history`: Snapshots históricos (indirectamente, al crear nuevos snapshots)
- Página de **Statistics** en UI (los datos mostrados)

### ¿Qué estadísticas NO se ven afectadas?
- `users.elo_rating`: Se recalculaba correctamente antes y después
- `users.matches_played`, `total_wins`, `total_losses`: Correctas en ambos casos
- `player_match_statistics`: No relacionado con este problema

### ¿Cuál es el performance impact?
- Negligible: La función `recalculate_faction_map_statistics()` ya se usaba en otro lugar
- Misma complejidad temporal y espacial
- Solo se ejecuta cuando se valida una disputa (operación infrecuente)

### ¿Necesito migrar datos?
- No necesariamente, pero se RECOMIENDA:
  1. Después de deploy, ejecutar: `POST /api/admin/recalculate-all-stats`
  2. Esto "limpiará" cualquier acumulación anterior

### ¿Qué pasa si la función `recalculate_faction_map_statistics()` falla?
- El endpoint no falla (try/catch)
- Se registra el error en logs
- La validación de disputa se completa (stats de usuario sí se actualizan)
- La siguiente acción de admin que recalcule stats limpiará los datos

---

## 📚 Archivos Relacionados

### Migración que define la función
`backend/migrations/20251227_faction_map_statistics.sql` (línea 109)

### Código que ya usaba esta función correctamente
`backend/src/routes/admin.ts` (línea 654)

### Código que ahora también la usa
`backend/src/routes/matches.ts` (línea ~1155) ← **NUEVO**

---

## 🔗 Referencias

Para entender el sistema de estadísticas completo, revisar:
- `BALANCE_STATISTICS_IMPLEMENTATION.md` - Documentación del sistema
- `STATS_STRUCTURE.md` - Estructura de datos
- `MATCH_STATUS_SYSTEM.md` - Cómo funcionan los estados de matches

---

## ⏭️ Próximas Mejoras Potenciales

1. **Logging mejorado**: Registrar cuántos records se insertaron/truncaron
2. **Alertas**: Si un recalculate toma > X segundos, avisar a admins
3. **Validación**: Comparar con tabla matches para detectar inconsistencias
4. **Tests automatizados**: CI/CD pipeline para validar estadísticas

---

## 📋 Conclusión

Se identificó y corrigió un bug donde las estadísticas de balance de facción/mapa se acumulaban al validar disputas. La solución es simple, elegante y sigue el patrón ya establecido en el código. No hay impacto en performance ni en la API.

**Status**: ✅ **LISTO PARA DEPLOY**

---

*Generado: 6 de Enero de 2025*
*Modificado: backend/src/routes/matches.ts (7 líneas)*
*Documentación: 4 archivos nuevos*
