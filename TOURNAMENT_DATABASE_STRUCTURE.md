# Análisis Estructura de Base de Datos de Torneos

## Resumen Ejecutivo

El proyecto CLM Competitive Wesnoth implementa un sistema completo de torneos con soporte para múltiples formatos (Best Of 1, 3, 5), rondas generales y finales, y gestión detallada de participantes y enfrentamientos. La arquitectura utiliza 5 tablas principales relacionadas entre sí con referencias de clave foránea.

---

## 1. TABLAS DE TORNEOS

### 1.1 Tabla: `tournaments`

**Descripción**: Tabla principal que almacena la información de cada torneo.

| Campo | Tipo | Nullable | Default | Descripción |
|-------|------|----------|---------|-------------|
| `id` | UUID | NO | `gen_random_uuid()` | Identificador único del torneo |
| `name` | VARCHAR | NO | - | Nombre del torneo |
| `description` | TEXT | NO | - | Descripción detallada del torneo |
| `creator_id` | UUID | NO | - | FK → `users(id)` - Usuario que creó el torneo |
| `status` | VARCHAR | YES | - | Estado del torneo |
| `approved_at` | TIMESTAMP | YES | - | Fecha de aprobación |
| `started_at` | TIMESTAMP | YES | - | Fecha de inicio |
| `finished_at` | TIMESTAMP | YES | - | Fecha de finalización |
| `created_at` | TIMESTAMP | YES | `CURRENT_TIMESTAMP` | Fecha de creación |
| `updated_at` | TIMESTAMP | YES | `CURRENT_TIMESTAMP` | Fecha última actualización |
| `general_rounds` | INTEGER | YES | - | Número de rondas generales |
| `final_rounds` | INTEGER | YES | - | Número de rondas finales |
| `registration_closed_at` | TIMESTAMP | YES | - | Fecha de cierre de registro |
| `prepared_at` | TIMESTAMP | YES | - | Fecha de preparación |
| `tournament_type` | VARCHAR | YES | - | Tipo de torneo (ej: swiss, eliminación, etc.) |
| `max_participants` | INTEGER | YES | - | Máximo número de participantes permitidos |
| `round_duration_days` | INTEGER | YES | - | Duración de cada ronda en días |
| `auto_advance_round` | BOOLEAN | YES | - | Flag para avance automático de ronda |
| `current_round` | INTEGER | YES | - | Ronda actual en progreso |
| `total_rounds` | INTEGER | YES | - | Total de rondas en el torneo |
| `general_rounds_format` | VARCHAR | YES | `'bo3'` | Formato Best Of para rondas generales (bo1, bo3, bo5) |
| `final_rounds_format` | VARCHAR | YES | `'bo5'` | Formato Best Of para rondas finales (bo1, bo3, bo5) |

**Restricciones**:
- `PRIMARY KEY`: `id`
- `FOREIGN KEY`: `creator_id` → `users(id)`
- `CHECK`: `general_rounds_format` IN ('bo1', 'bo3', 'bo5')
- `CHECK`: `final_rounds_format` IN ('bo1', 'bo3', 'bo5')

**Índices**:
- `idx_tournament_creator` ON `creator_id`
- `idx_tournaments_status` ON `status`
- `idx_tournaments_formats` ON `(general_rounds_format, final_rounds_format)`
- `tournaments_pkey` ON `id`

**Estados Soportados**:
- `registration_open` - Registro abierto
- `in_progress` - En progreso
- `completed` - Completado
- Otros: `pending`, `active`

---

### 1.2 Tabla: `tournament_rounds`

**Descripción**: Define las rondas de cada torneo. Cada ronda representa una fase del torneo.

| Campo | Tipo | Nullable | Default | Descripción |
|-------|------|----------|---------|-------------|
| `id` | UUID | NO | `gen_random_uuid()` | Identificador único de la ronda |
| `tournament_id` | UUID | NO | - | FK → `tournaments(id)` - Torneo al que pertenece |
| `round_number` | INTEGER | NO | - | Número de la ronda (1, 2, 3...) |
| `match_format` | VARCHAR | NO | - | Formato de enfrentamiento (bo1, bo3, bo5) |
| `round_type` | VARCHAR | YES | `'general'` | Tipo de ronda (general o final) |
| `round_status` | VARCHAR | YES | `'pending'` | Estado de la ronda |
| `round_start_date` | TIMESTAMP | YES | - | Fecha de inicio de la ronda |
| `round_end_date` | TIMESTAMP | YES | - | Fecha de finalización de la ronda |
| `created_at` | TIMESTAMP | YES | `CURRENT_TIMESTAMP` | Fecha de creación |
| `updated_at` | TIMESTAMP | YES | `CURRENT_TIMESTAMP` | Fecha última actualización |

**Restricciones**:
- `PRIMARY KEY`: `id`
- `UNIQUE`: `(tournament_id, round_number)` - Una ronda por número dentro de cada torneo
- `FOREIGN KEY`: `tournament_id` → `tournaments(id)` ON DELETE CASCADE
- `CHECK`: `match_format` IN ('bo1', 'bo3', 'bo5')
- `CHECK`: `round_type` IN ('general', 'final')
- `CHECK`: `round_status` IN ('pending', 'in_progress', 'completed')

**Índices**:
- `idx_tournament_rounds_tournament` ON `tournament_id`
- `idx_tournament_rounds_status` ON `round_status`
- `idx_tournament_rounds_type` ON `round_type`
- `tournament_rounds_tournament_id_round_number_key` ON `(tournament_id, round_number)`

**Estados Soportados**:
- `pending` - Pendiente de inicio
- `in_progress` - En progreso
- `completed` - Completada

**Formatos Soportados**:
- `bo1` - Best Of 1 (1 juego para ganar)
- `bo3` - Best Of 3 (2 juegos para ganar)
- `bo5` - Best Of 5 (3 juegos para ganar)

---

### 1.3 Tabla: `tournament_participants`

**Descripción**: Registra la participación de usuarios en torneos.

| Campo | Tipo | Nullable | Default | Descripción |
|-------|------|----------|---------|-------------|
| `id` | UUID | NO | `gen_random_uuid()` | Identificador único del registro |
| `tournament_id` | UUID | NO | - | FK → `tournaments(id)` - Torneo |
| `user_id` | UUID | NO | - | FK → `users(id)` - Usuario participante |
| `current_round` | INTEGER | YES | `1` | Ronda actual del participante |
| `status` | VARCHAR | YES | `'active'` | Estado de participación actual |
| `participation_status` | VARCHAR | YES | `'pending'` | Estado de participación (pending, active, eliminated) |
| `tournament_ranking` | INTEGER | YES | - | Ranking del jugador en el torneo |
| `tournament_wins` | INTEGER | YES | `0` | Victorias en el torneo |
| `tournament_losses` | INTEGER | YES | `0` | Derrotas en el torneo |
| `tournament_points` | INTEGER | YES | `0` | Puntos acumulados en el torneo |
| `created_at` | TIMESTAMP | YES | `CURRENT_TIMESTAMP` | Fecha de inscripción |

**Restricciones**:
- `PRIMARY KEY`: `id`
- `UNIQUE`: `(tournament_id, user_id)` - Un registro por usuario por torneo
- `FOREIGN KEY`: `tournament_id` → `tournaments(id)` ON DELETE CASCADE
- `FOREIGN KEY`: `user_id` → `users(id)`

**Índices**:
- `tournament_participants_tournament_id_user_id_key` ON `(tournament_id, user_id)`

**Estados de Participación**:
- `pending` - Inscripción pendiente
- `active` - Participante activo
- `eliminated` - Eliminado del torneo

---

### 1.4 Tabla: `tournament_rounds_matches` (también referida como `tournament_round_matches`)

**Descripción**: Agrupa enfrentamientos Best Of entre dos jugadores en una ronda. Cada registro representa una serie que puede tener múltiples juegos.

| Campo | Tipo | Nullable | Default | Descripción |
|-------|------|----------|---------|-------------|
| `id` | UUID | NO | `gen_random_uuid()` | Identificador único de la serie |
| `tournament_id` | UUID | NO | - | FK → `tournaments(id)` - Torneo |
| `round_id` | UUID | NO | - | FK → `tournament_rounds(id)` - Ronda |
| `player1_id` | UUID | NO | - | FK → `users(id)` - Primer jugador |
| `player2_id` | UUID | NO | - | FK → `users(id)` - Segundo jugador |
| `best_of` | INTEGER | NO | - | Formato (1, 3, o 5) |
| `wins_required` | INTEGER | NO | - | Victorias necesarias para ganar (1, 2, o 3) |
| `player1_wins` | INTEGER | NO | `0` | Juegos ganados por jugador 1 |
| `player2_wins` | INTEGER | NO | `0` | Juegos ganados por jugador 2 |
| `matches_scheduled` | INTEGER | NO | `0` | Juegos programados en la serie |
| `series_status` | VARCHAR | NO | `'in_progress'` | Estado de la serie |
| `winner_id` | UUID | YES | - | FK → `users(id)` - Ganador de la serie |
| `created_at` | TIMESTAMP | YES | `CURRENT_TIMESTAMP` | Fecha de creación |
| `updated_at` | TIMESTAMP | YES | `CURRENT_TIMESTAMP` | Fecha última actualización |

**Restricciones**:
- `PRIMARY KEY`: `id`
- `UNIQUE`: `(tournament_id, round_id, player1_id, player2_id)` - Una serie por pareja por ronda
- `FOREIGN KEY`: `tournament_id` → `tournaments(id)` ON DELETE CASCADE
- `FOREIGN KEY`: `round_id` → `tournament_rounds(id)` ON DELETE CASCADE
- `FOREIGN KEY`: `player1_id` → `users(id)` ON DELETE CASCADE
- `FOREIGN KEY`: `player2_id` → `users(id)` ON DELETE CASCADE
- `FOREIGN KEY`: `winner_id` → `users(id)` ON DELETE SET NULL
- `CHECK`: `best_of` IN (1, 3, 5)
- `CHECK`: `series_status` IN ('in_progress', 'completed')

**Índices**:
- `idx_tournament_round_matches_tournament` ON `tournament_id`
- `idx_tournament_round_matches_round` ON `round_id`
- `idx_tournament_round_matches_players` ON `(player1_id, player2_id)`
- `idx_tournament_round_matches_status` ON `series_status`

**Estados de Serie**:
- `in_progress` - Serie en curso
- `completed` - Serie completada

**Relación Best Of → Wins Required**:
- BO1: 1 victoria requerida
- BO3: 2 victorias requeridas (mejor de 3)
- BO5: 3 victorias requeridas (mejor de 5)

---

### 1.5 Tabla: `tournament_matches`

**Descripción**: Registra juegos individuales dentro del torneo (cada juego jugado).

| Campo | Tipo | Nullable | Default | Descripción |
|-------|------|----------|---------|-------------|
| `id` | UUID | NO | `gen_random_uuid()` | Identificador único del juego |
| `tournament_id` | UUID | NO | - | FK → `tournaments(id)` - Torneo |
| `round_id` | UUID | NO | - | FK → `tournament_rounds(id)` - Ronda |
| `player1_id` | UUID | NO | - | FK → `users(id)` - Jugador 1 |
| `player2_id` | UUID | NO | - | FK → `users(id)` - Jugador 2 |
| `winner_id` | UUID | YES | - | FK → `users(id)` - Ganador del juego |
| `match_id` | UUID | YES | - | FK → `matches(id)` - Juego relacionado |
| `tournament_round_match_id` | UUID | YES | - | FK → `tournament_round_matches(id)` - Serie BO a la que pertenece |
| `match_status` | VARCHAR | YES | `'pending'` | Estado del juego |
| `played_at` | TIMESTAMP | YES | - | Fecha de juego |
| `created_at` | TIMESTAMP | YES | `CURRENT_TIMESTAMP` | Fecha de creación |
| `updated_at` | TIMESTAMP | YES | `CURRENT_TIMESTAMP` | Fecha última actualización |

**Restricciones**:
- `PRIMARY KEY`: `id`
- `FOREIGN KEY`: `tournament_id` → `tournaments(id)` ON DELETE CASCADE
- `FOREIGN KEY`: `round_id` → `tournament_rounds(id)` ON DELETE CASCADE
- `FOREIGN KEY`: `player1_id` → `users(id)` ON DELETE CASCADE
- `FOREIGN KEY`: `player2_id` → `users(id)` ON DELETE CASCADE
- `FOREIGN KEY`: `winner_id` → `users(id)` ON DELETE SET NULL
- `FOREIGN KEY`: `match_id` → `matches(id)` ON DELETE SET NULL
- `FOREIGN KEY`: `tournament_round_match_id` → `tournament_round_matches(id)` ON DELETE SET NULL
- `CHECK`: `match_status` IN ('pending', 'in_progress', 'completed', 'cancelled')

**Índices**:
- `idx_tournament_matches_tournament` ON `tournament_id`
- `idx_tournament_matches_round` ON `round_id`
- `idx_tournament_matches_player1` ON `player1_id`
- `idx_tournament_matches_player2` ON `player2_id`
- `idx_tournament_matches_winner` ON `winner_id`
- `idx_tournament_matches_match` ON `match_id`
- `idx_tournament_matches_status` ON `match_status`
- `idx_tournament_matches_round_match` ON `tournament_round_match_id`

**Estados de Juego**:
- `pending` - Pendiente de jugar
- `in_progress` - En progreso
- `completed` - Completado
- `cancelled` - Cancelado

---

## 2. ESTRUCTURA DE RELACIONES

### Diagrama de Entidades y Relaciones

```
┌─────────────────────┐
│     tournaments     │
│  (tabla principal)  │
├─────────────────────┤
│ id (PK)             │
│ name                │
│ description         │
│ creator_id (FK)     │──→ users
│ status              │
│ general_rounds      │
│ final_rounds        │
│ general_rounds_fmt  │
│ final_rounds_fmt    │
│ ...                 │
└──────────┬──────────┘
           │ 1:N
           │
    ┌──────▼─────────────────────┐
    │  tournament_rounds         │
    │ (rondas del torneo)        │
    ├────────────────────────────┤
    │ id (PK)                    │
    │ tournament_id (FK) ────────┼──→ tournaments
    │ round_number               │
    │ match_format (bo1/bo3/bo5) │
    │ round_type (general/final) │
    │ round_status               │
    └────┬──────────┬────────────┘
         │ 1:N      │
         │          │
    ┌────▼──────────▼────────────────────────┐
    │  tournament_round_matches              │
    │ (series BO entre dos jugadores)        │
    ├───────────────────────────────────────┤
    │ id (PK)                                │
    │ tournament_id (FK)                     │
    │ round_id (FK)                          │
    │ player1_id (FK) ──→ users             │
    │ player2_id (FK) ──→ users             │
    │ best_of (1, 3, 5)                      │
    │ player1_wins                           │
    │ player2_wins                           │
    │ series_status                          │
    │ winner_id (FK) ──→ users              │
    │ matches_scheduled                      │
    └────┬─────────────────────┬─────────────┘
         │ 1:N                 │
         │                     │
    ┌────▼────────────────────────────┐
    │  tournament_matches             │
    │ (juegos individuales dentro BO)│
    ├─────────────────────────────────┤
    │ id (PK)                         │
    │ tournament_id (FK)              │
    │ round_id (FK)                   │
    │ player1_id (FK)                 │
    │ player2_id (FK)                 │
    │ tournament_round_match_id (FK)  │
    │ winner_id (FK)                  │
    │ match_id (FK) ──→ matches      │
    │ match_status                    │
    └─────────────────────────────────┘

┌────────────────────────┐
│ tournament_participants│
│ (participantes)        │
├────────────────────────┤
│ id (PK)                │
│ tournament_id (FK) ────┼──→ tournaments
│ user_id (FK) ──────────┼──→ users
│ tournament_ranking     │
│ tournament_wins        │
│ tournament_losses      │
│ tournament_points      │
└────────────────────────┘
```

---

## 3. FLUJO DE DATOS - CICLO DE VIDA DE UN TORNEO

### 3.1 Creación de Torneo

```
1. tournament (creator_id, status='registration_open', ...)
   ↓
2. tournament_participants (user_id, status='pending')
```

### 3.2 Preparación de Torneo

```
1. tournaments → status='in_progress', prepared_at=NOW
   ↓
2. tournament_rounds (round_number=1, match_format, round_type='general')
   ↓
3. tournament_participants → participation_status='active'
```

### 3.3 Creación de Enfrentamientos

```
1. tournament_round_matches creada (player1_id, player2_id, best_of, series_status='in_progress')
   ↓
2. tournament_matches creados (N registros según best_of)
   - BO1: 1 juego
   - BO3: hasta 3 juegos
   - BO5: hasta 5 juegos
```

### 3.4 Desarrollo de Seriones

```
tournament_round_matches:
  player1_wins=0, player2_wins=0, series_status='in_progress'
  
  ↓ (cada juego jugado)
  
tournament_matches: match_status='completed', winner_id=X
  
  ↓ (actualizar serie)
  
tournament_round_matches:
  player1_wins++/player2_wins++
  
  ↓ (si se alcanza wins_required)
  
tournament_round_matches: series_status='completed', winner_id=X
tournament_participants: tournament_wins++
```

---

## 4. TIPOS DE TORNEOS Y CONFIGURACIONES SOPORTADAS

### 4.1 Formatos Best Of

| Formato | Victorias Requeridas | Juegos Máximos | Uso |
|---------|---------------------|-----------------|-----|
| BO1 | 1 | 1 | Rondas rápidas, eliminación simple |
| BO3 | 2 | 3 | Torneos estándar, rondas generales |
| BO5 | 3 | 5 | Finales, torneos importantes |

### 4.2 Estructura de Rondas

**Rondas Generales** → **Rondas Finales**
- Pueden tener diferentes formatos
- Ejemplo: General=BO3, Final=BO5

### 4.3 Estados de Torneo

| Estado | Descripción |
|--------|-------------|
| `registration_open` | Aceptando nuevos participantes |
| `in_progress` | Torneo activo con rondas ejecutándose |
| `completed` | Torneo finalizado |

---

## 5. MÉTRICAS Y ESTADÍSTICAS

### 5.1 Por Participante

```sql
SELECT 
  tp.user_id,
  COUNT(DISTINCT tp.tournament_id) as torneos_jugados,
  SUM(tp.tournament_wins) as total_victorias,
  SUM(tp.tournament_losses) as total_derrotas,
  SUM(tp.tournament_points) as puntos_totales,
  COUNT(CASE WHEN tp.tournament_ranking = 1 THEN 1 END) as campeonatos
FROM tournament_participants tp
GROUP BY tp.user_id
```

### 5.2 Por Torneo

```sql
SELECT 
  t.id,
  t.name,
  COUNT(DISTINCT tp.user_id) as participantes,
  COUNT(DISTINCT tr.id) as rondas,
  COUNT(DISTINCT trm.id) as series_jugadas,
  COUNT(DISTINCT tm.id) as juegos_totales
FROM tournaments t
LEFT JOIN tournament_participants tp ON t.id = tp.tournament_id
LEFT JOIN tournament_rounds tr ON t.id = tr.tournament_id
LEFT JOIN tournament_round_matches trm ON tr.id = trm.round_id
LEFT JOIN tournament_matches tm ON t.id = tm.tournament_id
GROUP BY t.id, t.name
```

---

## 6. INDICES Y OPTIMIZACIONES

### 6.1 Índices Principales

| Tabla | Índices | Propósito |
|-------|---------|----------|
| `tournaments` | `idx_tournament_creator`, `idx_tournaments_status`, `idx_tournaments_formats` | Búsquedas y filtros rápidos |
| `tournament_rounds` | `idx_tournament_rounds_tournament`, `idx_tournament_rounds_status`, `idx_tournament_rounds_type` | Acceso por torneo y estado |
| `tournament_round_matches` | `idx_tournament_round_matches_tournament`, `idx_tournament_round_matches_round`, `idx_tournament_round_matches_players`, `idx_tournament_round_matches_status` | Búsquedas de series por múltiples criterios |
| `tournament_matches` | Múltiples índices por jugador, ronda, estado | Análisis de juegos |
| `tournament_participants` | `tournament_participants_tournament_id_user_id_key` | Evitar duplicados, acceso rápido |

### 6.2 Constraints Únicos

- `tournaments`: Ninguno (múltiples torneos del mismo creador)
- `tournament_rounds`: `(tournament_id, round_number)` - Una ronda por número
- `tournament_participants`: `(tournament_id, user_id)` - Un registro por usuario por torneo
- `tournament_round_matches`: `(tournament_id, round_id, player1_id, player2_id)` - Una serie por pareja por ronda
- `tournament_matches`: Ninguno (pueden haber múltiples juegos iguales en cancelaciones)

---

## 7. CASCADAS DE ELIMINACIÓN

| Tabla | Relación | Comportamiento |
|-------|----------|-----------------|
| `tournaments` | → tournament_rounds | DELETE CASCADE |
| `tournaments` | → tournament_participants | DELETE CASCADE |
| `tournaments` | → tournament_round_matches | DELETE CASCADE |
| `tournaments` | → tournament_matches | DELETE CASCADE |
| `tournament_rounds` | → tournament_round_matches | DELETE CASCADE |
| `tournament_rounds` | → tournament_matches | DELETE CASCADE |
| `tournament_round_matches` | → tournament_matches | SET NULL en `tournament_round_match_id` |
| Usuarios | → tournament_participants | Cascade o SET NULL (depende de contexto) |

---

## 8. MIGRACIONES APLICADAS

### Orden Cronológico

1. **001_fide_elo_system.sql** - Añade columnas ELO al sistema de usuarios
2. **006_tournament_rounds.sql** - Crea tabla `tournament_rounds` y columnas de configuración
3. **008_add_participation_status.sql** - Añade estado de participación
4. **009_fix_tournament_participants.sql** - Elimina columnas duplicadas (elo_rating)
5. **010_add_tournament_stats_columns.sql** - Añade wins, losses, points, ranking
6. **011_create_tournament_matches.sql** - Crea tablas `tournament_round_matches` y añade columna a `tournament_matches`
7. **012_remove_tournament_matches_unique_constraint.sql** - Permite múltiples juegos iguales
8. **013_add_language_code_to_news.sql** - Sin relación directa con torneos

---

## 9. CAMPOS DE CONFIGURACIÓN IMPORTANTES

### Configuración de Torneo

| Campo | Tipo | Uso |
|-------|------|-----|
| `general_rounds_format` | VARCHAR | Define formato BO para rondas generales |
| `final_rounds_format` | VARCHAR | Define formato BO para rondas finales |
| `max_participants` | INTEGER | Límite de participantes |
| `round_duration_days` | INTEGER | Duración de cada ronda |
| `auto_advance_round` | BOOLEAN | Avance automático de rondas |
| `tournament_type` | VARCHAR | Tipo (swiss, eliminación, round-robin, etc.) |

---

## 10. VALIDACIONES Y RESTRICCIONES

### Check Constraints

```sql
-- En tournaments
CHECK (general_rounds_format IN ('bo1', 'bo3', 'bo5'))
CHECK (final_rounds_format IN ('bo1', 'bo3', 'bo5'))

-- En tournament_rounds
CHECK (match_format IN ('bo1', 'bo3', 'bo5'))
CHECK (round_type IN ('general', 'final'))
CHECK (round_status IN ('pending', 'in_progress', 'completed'))

-- En tournament_round_matches
CHECK (best_of IN (1, 3, 5))
CHECK (series_status IN ('in_progress', 'completed'))

-- En tournament_matches
CHECK (match_status IN ('pending', 'in_progress', 'completed', 'cancelled'))
```

---

## 11. CONSULTAS ÚTILES

### Obtener torneos activos

```sql
SELECT * FROM tournaments 
WHERE status = 'in_progress'
ORDER BY started_at DESC
```

### Obtener ronda actual de un torneo

```sql
SELECT * FROM tournament_rounds 
WHERE tournament_id = $1 AND round_status = 'in_progress'
```

### Obtener series de una ronda

```sql
SELECT trm.*, u1.nickname as player1_name, u2.nickname as player2_name
FROM tournament_round_matches trm
JOIN users u1 ON trm.player1_id = u1.id
JOIN users u2 ON trm.player2_id = u2.id
WHERE trm.round_id = $1
ORDER BY trm.created_at
```

### Obtener ranking de un torneo

```sql
SELECT tp.tournament_ranking, u.nickname, tp.tournament_wins, 
       tp.tournament_losses, tp.tournament_points
FROM tournament_participants tp
JOIN users u ON tp.user_id = u.id
WHERE tp.tournament_id = $1
ORDER BY tp.tournament_ranking
```

### Obtener juegos de una serie BO

```sql
SELECT tm.* FROM tournament_matches tm
WHERE tm.tournament_round_match_id = $1
ORDER BY tm.created_at
```

---

## 12. OBSERVACIONES Y RECOMENDACIONES

### Estructura Actual

✅ **Fortalezas**:
- Diseño normalizado y relacional
- Soporta múltiples formatos (BO1, BO3, BO5)
- Separación clara entre series (BO) y juegos individuales
- Tracking detallado de estadísticas por participante
- Cascadas de eliminación correctas
- Índices optimizados para consultas comunes

⚠️ **Consideraciones**:
- No hay soft delete en torneos (podrían necesitar auditoría)
- Campo `tournament_type` no está normalizado (podría ser tabla separada)
- Estados de torneo podrían beneficiarse de tabla de enum si se añaden más
- Sin historial de cambios automático

### Posibles Mejoras

1. **Tabla de Enum**: Crear tablas para estados y tipos si cambian frecuentemente
2. **Auditoría**: Implementar tabla de auditoría para cambios importantes
3. **Cache**: Considerar materializar vistas para estadísticas de rápido acceso
4. **Particionamiento**: Si el volumen crece, particionar por `tournament_id`

---

## Resumen de Tablas

| Tabla | Registros | Propósito | Relaciones |
|-------|-----------|----------|-----------|
| `tournaments` | Torneos | Información principal | ← users (creator) |
| `tournament_rounds` | Rondas | Define fases del torneo | ← tournaments |
| `tournament_participants` | Participaciones | Vínculo usuario-torneo | ← tournaments, users |
| `tournament_round_matches` | Series BO | Enfrentamientos entre dos jugadores | ← tournament_rounds, users |
| `tournament_matches` | Juegos individuales | Juegos específicos dentro de series | ← tournament_round_matches, matches |

---

**Última actualización**: 14 de Diciembre, 2025  
**Base de datos**: PostgreSQL  
**Versión de esquema**: 2.0+
