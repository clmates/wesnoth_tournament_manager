# API de Torneos Mejorada: Liga, Suizo, Suizo Mixto y Eliminación Mejorada

## 📋 Resumen

Esta documentación describe los nuevos endpoints y funcionalidad para soportar múltiples modos de torneo en CLM Competitive.

## 🎯 Modos de Torneo Soportados

### 1. Eliminación (Eliminación Mejorada)
- **Tipo**: `elimination`
- **Configuración flexible**: Diferente número de matches por fase (octavos, cuartos, semis, final)
- **Ejemplo**: Final BO5 mientras octavos es BO1

### 2. Liga (Round Robin)
- **Tipo**: `league`
- **Configuración**: Ida simple o ida y vuelta
- **Puntuación**: Puntos por victoria

### 3. Suizo (Swiss System)
- **Tipo**: `swiss`
- **Configuración**: N rondas con emparejamientos por puntuación
- **Menos partidas que liga**: Más justo que eliminación

### 4. Suizo Mixto (Hybrid)
- **Tipo**: `swiss_hybrid`
- **Configuración**: N rondas suizo + F rondas de eliminación
- **Mejor de ambos mundos**: Feria de suizo + drama de eliminación

---

## 🔌 Endpoints API

### GET `/api/tournaments/:id/config`
Obtiene la configuración completa del torneo incluyendo todos los campos de nuevos modos.

**Respuesta:**
```json
{
  "tournament_id": 1,
  "tournament_name": "Liga XYZ",
  "tournament_type": "league",
  "league_type": "double_round",
  "series_format_swiss": "bo1",
  "points_win": 3,
  "points_loss": 0,
  "elimination_matches_final": 3,
  "tiebreaker_1": "points",
  ...
}
```

---

### GET `/api/tournaments/suggestions/by-count?participant_count=32`
Obtiene sugerencias automáticas de configuración según el número de participantes.

**Parámetros Query:**
- `participant_count` (required): Número de participantes

**Respuesta:**
```json
{
  "suggestions": {
    "league": {
      "league_type": "single_round",
      "series_format": "bo1",
      "estimated_matches": 496
    },
    "swiss": {
      "swiss_rounds": 5,
      "series_format": "bo1",
      "estimated_matches": 80
    },
    "swiss_hybrid": {
      "swiss_hybrid_rounds": 5,
      "finalists_count": 8,
      "estimated_matches": 111
    },
    "elimination": {
      "elimination_type": "single",
      "finalists_count": 32,
      "series_format_final": "bo3",
      "estimated_matches": 31
    }
  }
}
```

---

### GET `/api/tournaments/:id/standings?round_id=1`
Obtiene las posiciones actuales del torneo.

**Parámetros Query:**
- `round_id` (optional): ID de la ronda específica

**Respuesta:**
```json
{
  "standings": [
    {
      "tournament_id": 1,
      "player_id": 10,
      "matches_played": 5,
      "matches_won": 4,
      "matches_lost": 1,
      "sets_won": 12,
      "sets_lost": 5,
      "total_points": 12,
      "current_rank": 1
    },
    ...
  ]
}
```

---

### GET `/api/tournaments/:id/league-standings`
Obtiene las posiciones de liga (solo para torneos de tipo `league`).

**Respuesta:**
```json
{
  "standings": [
    {
      "tournament_id": 1,
      "player_id": 10,
      "league_position": 1,
      "league_matches_played": 10,
      "league_matches_won": 9,
      "league_matches_lost": 1,
      "league_sets_won": 27,
      "league_sets_lost": 8,
      "league_total_points": 27,
      "head_to_head_record": "2-0",
      "set_difference": 19
    },
    ...
  ]
}
```

---

### GET `/api/tournaments/:id/swiss-pairings/:round_id`
Obtiene los emparejamientos suizos para una ronda (solo para torneos `swiss` y `swiss_hybrid`).

**Respuesta:**
```json
{
  "pairings": [
    {
      "id": 1,
      "tournament_id": 1,
      "tournament_round_id": 5,
      "player1_id": 10,
      "player2_id": 15,
      "winner_id": 10,
      "match_status": "completed",
      "pairing_number": 1,
      "table_number": 1
    },
    ...
  ]
}
```

---

## 📦 Estructura de Base de Datos

### Tabla `tournaments` - Nuevos Campos

```sql
-- Tipo de torneo
tournament_type VARCHAR(20) DEFAULT 'elimination'

-- Liga
league_type VARCHAR(20)  -- 'single_round' | 'double_round'

-- Suizo
swiss_rounds INT

-- Suizo Mixto
swiss_hybrid_rounds INT
finalists_count INT

-- Eliminación Mejorada
elimination_type VARCHAR(20)  -- 'single' | 'double'
elimination_matches_dieciseisavos INT DEFAULT 1
elimination_matches_octavos INT DEFAULT 1
elimination_matches_cuartos INT DEFAULT 1
elimination_matches_semis INT DEFAULT 1
elimination_matches_final INT DEFAULT 1  -- ← Puede ser diferente!

-- General
points_win INT DEFAULT 3
points_loss INT DEFAULT 0
points_bye INT DEFAULT 1
series_format_swiss VARCHAR(3)
series_format_finals VARCHAR(3)

-- Desempates
tiebreaker_1 VARCHAR(20) DEFAULT 'points'
tiebreaker_2 VARCHAR(20)
tiebreaker_3 VARCHAR(20)
```

### Tablas Nuevas

#### `tournament_standings`
Posiciones por ronda para liga, suizo y suizo mixto.

```sql
CREATE TABLE tournament_standings (
  id INT PRIMARY KEY,
  tournament_id INT,
  tournament_round_id INT,
  player_id INT,
  
  matches_played INT,
  matches_won INT,
  matches_lost INT,
  sets_won INT,
  sets_lost INT,
  total_points INT,
  current_rank INT,
  previous_rank INT
);
```

#### `swiss_pairings`
Emparejamientos suizos con resultados.

```sql
CREATE TABLE swiss_pairings (
  id INT PRIMARY KEY,
  tournament_id INT,
  tournament_round_id INT,
  
  player1_id INT,
  player2_id INT,
  winner_id INT,
  match_status VARCHAR(20),
  tournament_match_id INT,
  
  pairing_number INT,
  table_number INT
);
```

#### `league_standings`
Posiciones finales de liga.

```sql
CREATE TABLE league_standings (
  id INT PRIMARY KEY,
  tournament_id INT,
  player_id INT,
  
  league_position INT,
  league_matches_played INT,
  league_matches_won INT,
  league_matches_lost INT,
  league_sets_won INT,
  league_sets_lost INT,
  league_total_points INT,
  
  head_to_head_record VARCHAR(50),
  set_difference INT
);
```

---

## 🎮 Ejemplos de Uso

### Crear un torneo de Eliminación Mejorada

Final BO5, Semis BO3, resto BO1:

```json
POST /api/tournaments

{
  "tournament_name": "Open Argentino 2025",
  "tournament_type": "elimination",
  "elimination_type": "single",
  "elimination_matches_octavos": 1,
  "elimination_matches_cuartos": 1,
  "elimination_matches_semis": 3,
  "elimination_matches_final": 5,
  "series_format_finals": "bo3"
}
```

### Crear un torneo de Liga

Ida y vuelta, BO1:

```json
POST /api/tournaments

{
  "tournament_name": "Liga Clausura 2025",
  "tournament_type": "league",
  "league_type": "double_round",
  "series_format": "bo1",
  "points_win": 3,
  "tiebreaker_1": "points",
  "tiebreaker_2": "head_to_head"
}
```

### Crear un torneo Suizo Mixto

5 rondas suizo + 8 finales:

```json
POST /api/tournaments

{
  "tournament_name": "Campeonato Nacional 2025",
  "tournament_type": "swiss_hybrid",
  "swiss_hybrid_rounds": 5,
  "finalists_count": 8,
  "series_format_swiss": "bo1",
  "series_format_finals": "bo3",
  "elimination_type": "single"
}
```

### Obtener sugerencias automáticas

Para 32 participantes:

```bash
GET /api/tournaments/suggestions/by-count?participant_count=32
```

Respuesta sugerirá:
- Liga: 1 ronda (496 matches totales en BO1)
- Suizo: 5 rondas (80 matches)
- Suizo Mixto: 5 suizo + 8 finales
- Eliminación: 32 bracket (31 matches)

---

## 🔄 Flujo de Implementación Recomendado

### Fase 1: Infraestructura ✅ COMPLETA
- [x] SQL migrations (014_tournament_modes.sql)
- [x] TypeScript types (tournament.ts)
- [x] TournamentService
- [x] API endpoints

### Fase 2: Algorithms (PRÓXIMA)
1. Generador de emparejamientos suizos
2. Cálculo automático de standings
3. Lógica de promoción/eliminación

### Fase 3: Frontend (DESPUÉS)
1. Wizard de creación de torneo
2. Vistas de standings
3. Gestión de pairings

### Fase 4: Tests (FINAL)
1. Unit tests de algoritmos
2. Integration tests
3. E2E tests

---

## 📝 Notas Importantes

### Backward Compatibility ✅
- Todos los torneos existentes seguirán funcionando
- `tournament_type` por defecto es `'elimination'`
- Campos nuevos son NULLABLE o tienen DEFAULTs sensibles
- Cero breaking changes

### Performance
- Nuevos índices en `tournament_type` y `round_type`
- `tournament_standings` indexada por `tournament_id` y `current_rank`
- `league_standings` y `swiss_pairings` optimizadas para queries rápidas

### Validación
- La aplicación debe validar que se usan campos correctos según `tournament_type`
- Ej: No enviar `swiss_rounds` si `tournament_type` es `'elimination'`

---

## 🚀 Próximos Pasos

1. ✅ Ejecutar migración SQL (014_tournament_modes.sql)
2. ✅ Deployar TypeScript types y service
3. ✅ Deployar nuevos endpoints
4. ⏳ Implementar algoritmos de emparejamiento (suizo, liga)
5. ⏳ Crear endpoints para generar pairings
6. ⏳ Actualizar frontend con wizards de creación

---

## 📞 Soporte

Para preguntas o problemas:
- Ver TOURNAMENT_MODES_PROPOSAL.md para análisis detallado
- Ver migrations/014_tournament_modes.sql para schema completo
- Ver src/types/tournament.ts para interfaces TypeScript
