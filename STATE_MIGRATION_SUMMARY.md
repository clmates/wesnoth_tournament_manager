# Estado de Migración de Estados de Partidas

## Cambios Realizados

### 1. Backend - matches.ts

#### POST `/matches/:id/confirm` - Acción DISPUTE
- **Cambio**: Removidas todas las reversiones de stats y trend
- **Nuevo comportamiento**: Solo marca el estado como `disputed`
- **Explicación**: Los stats NO se revierten cuando el jugador disputa. Solo se revierten cuando el admin valida la disputa.
- **Líneas**: ~410-424

#### POST `/admin/:id/dispute` - Acción VALIDATE
- **Cambio Anterior**: Marcaba como `disputed` sin revertir stats
- **Nuevo Comportamiento**: Marca como `cancelled`, revierte stats y trend de ambos jugadores, recalcula ELO en cascada
- **Explicación**: Cuando el admin valida la disputa, significa que la disputa es válida, por lo tanto:
  1. Se revierte los stats (wins/losses/matches_played)
  2. Se revierte el trend
  3. Se marca como `cancelled` (no `disputed`)
  4. Se recalcula ELO para TODOS los matches posteriores (de todos los jugadores involucrados)
  5. Se reabre el tournament_match para re-reporting
- **Líneas**: ~567-680
- **Validación**: Ahora verifica que el match tenga estado `disputed` (no `pending`)

#### POST `/admin/:id/dispute` - Acción REJECT
- **Cambio**: El admin rechaza la disputa
- **Nuevo Comportamiento**: Marca como `confirmed`, SIN cambios en stats ni ELO
- **Explicación**: Si el admin rechaza la disputa, significa que la disputa NO es válida. El match se mantiene como fue reportado originalmente, sin reversiones.

### 2. Frontend - RecentGamesTable.tsx

#### Status Display
- **Cambio**: De usar `loser_confirmed` (booleano antiguo) a usar `status` (campo actual de matches)
- **Estados mostrados**:
  - `unconfirmed` → "⏳ Unconfirmed" (badge azul)
  - `confirmed` → "✓ Confirmed" (badge verde)
  - `disputed` → "⚠ Disputed" (badge naranja)
  - `cancelled` → "✗ Cancelled" (badge rojo/gris)
- **Acción del Botón**: Solo muestra "Report" si el match está en estado `unconfirmed`
- **Líneas**: ~155-170

## Estados Correctos del Sistema

```
Flujo Correcto:

1. REPORTA GANADOR
   ↓
   Estado: unconfirmed
   ELO: ✓ Aplicado
   Stats: ✓ Aplicadas

2. OPCIÓN A: PERDEDOR CONFIRMA
   ↓
   Estado: confirmed
   ELO: ✓ Mantiene
   Stats: ✓ Mantiene
   → FIN

3. OPCIÓN B: PERDEDOR DISPUTA
   ↓
   Estado: disputed
   ELO: ✓ MANTIENE (no revierte aquí)
   Stats: ✓ MANTIENE (no revierte aquí)
   
   3a. ADMIN VALIDA DISPUTA (la disputa es válida)
       ↓
       Estado: cancelled
       ELO: ✗ REVERTIDO (ahora sí se revierte)
       Stats: ✗ REVERTIDAS (ahora sí se revierten)
       Recalcula: ✓ ELO en cascada para matches posteriores de TODOS los jugadores
       → Reabre tournament_match
       → FIN

   3b. ADMIN RECHAZA DISPUTA (la disputa no es válida)
       ↓
       Estado: confirmed
       ELO: ✓ Mantiene (no cambia, el match fue válido)
       Stats: ✓ Mantiene (no cambia, el match fue válido)
       → FIN
```

## Cambios en Base de Datos Necesarios

### Revisar:
1. Matches con estado `pending` → Estos deberían ser `unconfirmed` o `disputed`
   - Si nunca fue disputado: cambiar a `unconfirmed`
   - Si fue disputado: cambiar a `disputed`

2. Matches con campo `loser_confirmed = true` → Cambiar a estado `confirmed`

3. Matches con campo `loser_confirmed = false` → Cambiar a estado `unconfirmed`

### Script de Migración Sugerido:
```sql
-- Antes de ejecutar, hacer backup

-- Cambiar pending a unconfirmed (si no hay evidencia de disputa)
UPDATE matches 
SET status = 'unconfirmed' 
WHERE status = 'pending' AND admin_reviewed = false;

-- Cambiar pending a disputed (si fue revisado por admin)
UPDATE matches 
SET status = 'disputed' 
WHERE status = 'pending' AND admin_reviewed = true;

-- Limpiar datos viejos (si existe campo loser_confirmed)
-- (Revisar si existe este campo en tu schema actual)
```

## Validación del Cambio

### Pruebas Necesarias:
1. ✓ Backend: Dispute sin reversar stats
2. ✓ Backend: Admin validate con reversal de stats
3. ✓ Backend: Admin reject sin cambios
4. ✓ Frontend: RecentGamesTable muestra estado correcto
5. ✓ Frontend: TournamentDetail ya usa status correcto (verificado)
6. ⏳ Database: Auditar datos existentes y migrar si necesario

## Resumen de Estados en la Tabla matches

| Estado | Significado | ELO Aplicado | Stats Aplicadas | Editable |
|--------|-------------|--------------|-----------------|----------|
| unconfirmed | Reportado, pendiente de confirmación | ✓ Sí | ✓ Sí | Sí (disputar/confirmar) |
| confirmed | Aceptado por ambos jugadores | ✓ Sí | ✓ Sí | No |
| disputed | Impugnado, awaiting admin | ✓ Sí | ✓ Sí | No (solo admin) |
| cancelled | Anulado por admin | ✗ No | ✗ No | No (final) |

