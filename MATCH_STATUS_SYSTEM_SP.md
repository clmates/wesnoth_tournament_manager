# Sistema de Estados de Partidas

## Descripción General

El sistema de partidas utiliza un campo `status` VARCHAR(20) para rastrear el estado de cada partida a través de su ciclo de vida. Este documento describe los estados posibles y las transiciones entre ellos.

## Estados Disponibles

### 1. **unconfirmed** (Por defecto)
- **Cuándo**: Se establece cuando el ganador reporta la victoria
- **Descripción**: La partida ha sido reportada por el ganador pero no ha sido confirmada por el perdedor
- **ELO**: Ya ha sido aplicado a ambos jugadores
- **Acciones posibles**:
  - El perdedor puede CONFIRMAR (→ confirmed)
  - El perdedor puede DISPUTAR (→ disputed)

### 2. **confirmed**
- **Cuándo**: El perdedor confirma la derrota
- **Descripción**: La partida es oficial y aceptada por ambos jugadores
- **ELO**: Se mantiene aplicado
- **Acciones posibles**:
  - No hay acciones desde este estado (partida finalizada)
  - Admin solo puede revisar

### 3. **disputed**
- **Cuándo**: El perdedor disputa la partida confirmada
- **Descripción**: El perdedor ha impugnado el resultado de la partida
- **ELO**: Se mantiene aplicado
- **Acciones posibles**:
  - Admin puede VALIDAR (→ cancelled)
  - Admin puede RECHAZAR (→ confirmed)

### 4. **cancelled**
- **Cuándo**: Admin revisa y valida la disputa
- **Descripción**: La partida ha sido marcada como cancelada por el sistema administrativo
- **ELO**: se revierten ELO y stats de ambos jugadores y se recalculan en cascada todas las partidas posteriores.
- **Acciones posibles**:
  - Ninguna (estado final)

## Transiciones de Estados

```
unconfirmed
    ├── confirmar (perdedor) → confirmed
    └── disputar (perdedor) → disputed

confirmed
    └── (sin acciones desde esta vista de usuario)

disputed
    ├── validar (admin) → cancelled
    └── rechazar (admin) → confirmed

cancelled
    └── (estado final)
```

## Campos Relacionados

### En la tabla `matches`:
- `status`: VARCHAR(20) - Estado actual de la partida
- `winner_elo_before`: INTEGER - Rating del ganador antes del match
- `winner_elo_after`: INTEGER - Rating del ganador después del match
- `loser_elo_before`: INTEGER - Rating del perdedor antes del match
- `loser_elo_after`: INTEGER - Rating del perdedor después del match
- `admin_reviewed`: BOOLEAN - Si el admin ha revisado esta partida
- `admin_reviewed_at`: TIMESTAMP - Cuándo se revisó
- `admin_reviewed_by`: UUID - ID del admin que revisó

## Cambios de ELO

### Cuando se reporta (unconfirmed)
- Se calculan y aplican los cambios de ELO y ranking a ambos jugadores
- Se guardan todas las estadisticvas y valores before y after de ambos jugadores

### Cuando se confirma (confirmed)
- no se alteran estadisticas, solo se cambia el estado a confirmed

### Cuando se disputa (disputed)
- no se alteran estadisticas, solo se cambia el estado a disputed

### Cuando se valida la disputa (cancelled)
- Se revierte el ELO y todas las estadisticas de ambos jugadores
- Se recalcula en cascada el elo de los matches posteriores (todos, no solo ambos jugadores ya que puede haber cruces con otros jugadores)
- Se cambia el estado a cancelled

### Cuando se rechaza la disputa (confirmed)
- no se alteran estadisticas, solo se cambia el estado a confirmed

## Consultas Útiles

### Partidas pendientes de confirmación
```sql
SELECT * FROM matches WHERE status IN ('unconfirmed', 'pending')
ORDER BY created_at DESC;
```

### Partidas confirmadas
```sql
SELECT * FROM matches WHERE status = 'confirmed'
ORDER BY created_at DESC;
```

### Partidas disputadas
```sql
SELECT * FROM matches WHERE status = 'disputed'
ORDER BY created_at DESC;
```

### Partidas que requieren acción del admin
```sql
SELECT * FROM matches WHERE status = 'pending'
ORDER BY created_at DESC;
```

## Cambios Recientes

- Se eliminó el campo booleano `loser_confirmed`
- Se agregó el campo `status` con valores 'unconfirmed', 'confirmed', 'pending', 'disputed'
- Se agregaron campos para guardar ELO antes y después
- Se agregaron campos de revisión administrativa
