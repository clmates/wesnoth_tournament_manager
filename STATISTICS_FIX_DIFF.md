# Diff Exact del Fix

## Archivo: backend/src/routes/matches.ts

### Ubicación: Línea ~1155 (dentro del endpoint POST /api/matches/admin/:id/dispute, acción 'validate')

```diff
--- a/backend/src/routes/matches.ts
+++ b/backend/src/routes/matches.ts
@@ -1153,6 +1153,16 @@
       }
     }

+      // STEP 7: Recalculate faction/map balance statistics
+      try {
+        await query('SELECT recalculate_faction_map_statistics()');
+        if (process.env.BACKEND_DEBUG_LOGS === 'true') console.log('Faction/map statistics recalculated successfully after dispute validation');
+      } catch (error) {
+        console.error('Error recalculating faction/map statistics:', error);
+        // Don't fail the entire operation if balance stats fail
+      }
+
       // Reopen the associated tournament match for re-reporting
       const tournamentMatchResult = await query(
         `SELECT tm.id as tm_id FROM tournament_matches tm
```

---

## Contexto Completo (ANTES)

```typescript
      // STEP 6: Update all users in the database with their recalculated stats
      for (const [userId, stats] of userStates.entries()) {
        // ... [código de actualización de usuarios] ...
        await query(
          `UPDATE users 
           SET elo_rating = $1, 
               matches_played = $2,
               total_wins = $3,
               total_losses = $4,
               trend = $5,
               is_rated = $6,
               updated_at = CURRENT_TIMESTAMP 
           WHERE id = $7`,
          [stats.elo_rating, stats.matches_played, stats.total_wins, stats.total_losses, stats.trend, isRated, userId]
        );
      }

      // ❌ ANTES: Directamente pasaba a reabrir el tournament match
      // Reopen the associated tournament match for re-reporting
      const tournamentMatchResult = await query(
        `SELECT tm.id as tm_id FROM tournament_matches tm
         WHERE tm.match_id = $1`,
        [id]
      );
```

---

## Contexto Completo (DESPUÉS)

```typescript
      // STEP 6: Update all users in the database with their recalculated stats
      for (const [userId, stats] of userStates.entries()) {
        // ... [código de actualización de usuarios] ...
        await query(
          `UPDATE users 
           SET elo_rating = $1, 
               matches_played = $2,
               total_wins = $3,
               total_losses = $4,
               trend = $5,
               is_rated = $6,
               updated_at = CURRENT_TIMESTAMP 
           WHERE id = $7`,
          [stats.elo_rating, stats.matches_played, stats.total_wins, stats.total_losses, stats.trend, isRated, userId]
        );
      }

      // ✅ NUEVO STEP 7: Recalculate faction/map balance statistics
      try {
        await query('SELECT recalculate_faction_map_statistics()');
        if (process.env.BACKEND_DEBUG_LOGS === 'true') console.log('Faction/map statistics recalculated successfully after dispute validation');
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

---

## Líneas Exactas

### Antes
- **Líneas**: 1154-1162
- **Contenido**: Directamente pasa a reabrir tournament match
- **Problema**: No recalcula `faction_map_statistics`

### Después
- **Líneas**: 1154-1172
- **Contenido**: Agrega STEP 7 para recalcular, luego reabrir
- **Solución**: Ahora llama `recalculate_faction_map_statistics()`

---

## Líneas Totales Modificadas

```
Total de líneas agregadas: 9
Total de líneas eliminadas: 0
Total de líneas modificadas: 0

Cambio neto: +9 líneas
```

---

## Verificación de Sintaxis

```bash
# Compilar TypeScript para verificar sintaxis
npx tsc --noEmit backend/src/routes/matches.ts

# Resultado esperado: Sin errores
```

---

## Git Diff Command

```bash
# Para ver el cambio exacto
git diff backend/src/routes/matches.ts

# Para crear un patch
git diff backend/src/routes/matches.ts > statistics-fix.patch

# Para aplicar el patch
git apply statistics-fix.patch
```

---

## Resumen del Cambio

| Aspecto | Detalles |
|---------|----------|
| **Archivo** | backend/src/routes/matches.ts |
| **Línea de inicio** | ~1154 |
| **Línea de fin** | ~1162 |
| **Función** | recalculate_faction_map_statistics() |
| **Tipo de cambio** | Adición (Insert) |
| **Impacto** | Fix de bug |
| **Compatibilidad** | Backward compatible |
| **Breaking change** | No |

---

## Cómo Aplicar Manualmente

Si necesitas aplicar el fix manualmente:

### Opción 1: Edición directa
1. Abre `backend/src/routes/matches.ts`
2. Busca la línea: `// Reopen the associated tournament match for re-reporting`
3. ANTES de esa línea, agrega:
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
4. Guarda y compila

### Opción 2: Usando patch
```bash
cat > fix.patch << 'EOF'
--- a/backend/src/routes/matches.ts
+++ b/backend/src/routes/matches.ts
@@ -1153,6 +1153,16 @@
       }
     }

+      // STEP 7: Recalculate faction/map balance statistics
+      try {
+        await query('SELECT recalculate_faction_map_statistics()');
+        if (process.env.BACKEND_DEBUG_LOGS === 'true') console.log('Faction/map statistics recalculated successfully after dispute validation');
+      } catch (error) {
+        console.error('Error recalculating faction/map statistics:', error);
+        // Don't fail the entire operation if balance stats fail
+      }
+
       // Reopen the associated tournament match for re-reporting
       const tournamentMatchResult = await query(
         `SELECT tm.id as tm_id FROM tournament_matches tm
EOF

git apply fix.patch
```

---

## Validación Post-aplicación

```bash
# 1. Verificar sintaxis
npx tsc --noEmit backend/src/routes/matches.ts

# 2. Verificar que la función existe en DB
psql -h localhost -U postgres -d tournament_db -c \
  "\df recalculate_faction_map_statistics"

# 3. Reiniciar backend
npm run dev  # o tu comando de start

# 4. Probar endpoint
curl -X POST "http://localhost:3000/api/matches/admin/{dispute-id}/dispute" \
  -H "Authorization: Bearer $TOKEN" \
  -d '{"action":"validate"}'

# 5. Verificar log
grep "Faction/map statistics recalculated" logs/*.log
```

---

## Rollback (si es necesario)

```bash
# Opción 1: Revertir con git
git checkout backend/src/routes/matches.ts

# Opción 2: Editar manualmente
# Simplemente eliminar el bloque STEP 7 agregado

# Opción 3: Usar patch inverso
git apply -R fix.patch
```

---

## Comparativa con Código Similar Existente

Esta línea es idéntica a la que ya existe en `admin.ts` línea 654:

```typescript
// En admin.ts (línea 654) ✅ YA EXISTE
try {
  await query('SELECT recalculate_faction_map_statistics()');
  if (process.env.BACKEND_DEBUG_LOGS === 'true') console.log('Faction/map statistics recalculated successfully');
} catch (error) {
  console.error('Error recalculating faction/map statistics:', error);
  // Don't fail the entire operation if balance stats fail
}

// En matches.ts (línea ~1154) ✅ AHORA IGUAL (con pequeña variación en mensaje)
try {
  await query('SELECT recalculate_faction_map_statistics()');
  if (process.env.BACKEND_DEBUG_LOGS === 'true') console.log('Faction/map statistics recalculated successfully after dispute validation');
} catch (error) {
  console.error('Error recalculating faction/map statistics:', error);
  // Don't fail the entire operation if balance stats fail
}
```

Solo difiere el mensaje del log para mayor claridad.

---

## Historial de Cambio

| Fecha | Acción | Responsable |
|-------|--------|-------------|
| 2025-01-06 | Identificado problema | Analysis |
| 2025-01-06 | Implementado fix | Code modification |
| 2025-01-06 | Documentado | Documentation |
| 2025-01-06 | Testing preparado | Testing guide |

---

EOF

**Estado**: ✅ **LISTO PARA MERGE/DEPLOY**
