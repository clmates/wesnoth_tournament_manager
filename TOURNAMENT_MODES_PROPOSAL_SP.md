# Propuesta: Soporte para Torneos Liga, Suizo, Suizo Mixto y Eliminación Mejorada

## 📋 Resumen Ejecutivo

Análisis y propuesta de cambios en la estructura de base de datos para soportar cuatro modos de torneo:
- **Liga**: Todos contra todos (ida y vuelta o solo ida)
- **Suizo**: Emparejamientos basados en puntuación
- **Suizo Mixto**: N rondas de suizo + F rondas de eliminación
- **Eliminación Mejorada**: Eliminación directa con configuración flexible por fase

---

## 🎯 Requisitos Funcionales

### 1. MODO LIGA (Round Robin)

**Características:**
- Todos los participantes juegan contra todos
- Configuración: Ida (1 ronda) o Ida y Vuelta (2 rondas)
- Puntuación por victoria/derrota (típicamente 3 puntos por victoria)
- Ranking final por puntos totales
- Desempates: Diferencia de sets, cabeza a cabeza, etc.

**Configuración:**
```
tournament_type = 'league'
league_type = 'single_round' | 'double_round'  -- Solo ida o ida y vuelta
series_format = 'bo1' | 'bo3' | 'bo5'  -- Cada enfrentamiento
points_win = 3  -- Puntos por victoria
points_loss = 0  -- Puntos por derrota
```

**Número de partidas:**
- N participantes, ida: N*(N-1)/2 enfrentamientos
- N participantes, ida y vuelta: N*(N-1) enfrentamientos
- Cada enfrentamiento = series_format partidas

**Ejemplo: 8 jugadores, ida:**
- 28 enfrentamientos
- Si BO3: 84 partidas máximo

---

### 2. MODO SUIZO (Swiss System)

**Características:**
- N rondas configurables
- Emparejamientos por puntuación (los que tienen puntuaciones similares juegan entre sí)
- Menos partidas que liga, pero más justo que eliminatoria
- Típicamente 4-5 rondas para 16+ jugadores

**Configuración:**
```
tournament_type = 'swiss'
swiss_rounds = 4 | 5 | 6  -- Número de rondas
series_format = 'bo1' | 'bo3' | 'bo5'  -- Cada enfrentamiento
points_win = 3
points_loss = 0
bye_points = 1  -- Puntos por no jugar (bye)
```

**Algoritmo de emparejamiento:**
- Ronda 1: Emparejamiento aleatorio o por ranking inicial
- Rondas 2+: Agrupar por puntuación, emparejar dentro del grupo
- Si n es impar, un jugador recibe "bye" (no juega) ese round

**Número de partidas:**
- N participantes, R rondas: R * (N/2) enfrentamientos
- Ejemplo: 16 jugadores, 4 rondas suizo = 32 enfrentamientos

---

### 3. MODO SUIZO MIXTO (Hybrid Swiss-Elimination)

**Características:**
- N rondas de suizo inicial
- F rondas finales de eliminación directa
- Los mejores clasificados en suizo avanzan a eliminación
- Propuesta automática de alternativas según número de jugadores

**Configuración:**
```
tournament_type = 'swiss_hybrid'
swiss_rounds = 4  -- Rondas suizo
finalists_count = 16 | 8 | 4  -- Cuántos avanzan a eliminación
points_win = 3
points_loss = 0
series_format_swiss = 'bo1' | 'bo3'  -- En rondas suizo
series_format_eliminations = 'bo1' | 'bo3' | 'bo5'  -- En rondas eliminación

-- Configuración detallada de eliminación:
eliminale_matches_per_round = {
  octavos: 1 | 3,     -- Matches octavos de final (si aplica)
  cuartos: 1 | 3,     -- Matches cuartos de final
  semis: 1 | 3,       -- Matches semifinales
  final: 1 | 3 | 5    -- Matches FINAL (puede diferir del resto)
}

-- O simplificado: usar mismo formato para todas MENOS final:
series_format_eliminations = 'bo3'  -- Para octavos, cuartos, semis
series_format_final = 'bo5'         -- Para final (opcional, distinto)
```

**Ejemplo: 32 jugadores**
- Opción 1: 4 rondas suizo → 8 finales (octavos BO3, cuartos BO3, semis BO3, final BO5)
- Opción 2: 5 rondas suizo → 4 finales (cuartos BO3, semis BO3, final BO5)
- Opción 3: 3 rondas suizo → 16 finales (octavos BO1, cuartos BO1, semis BO1, final BO3)

**Propuesta automática según participantes:**
```
8-15 jugadores: 3 rondas suizo → 4 finales (cuartos, semis, final)
16-31 jugadores: 4 rondas suizo → 8 finales (octavos, cuartos, semis, final)
32-63 jugadores: 5 rondas suizo → 16 finales (dieciseisavos, octavos, ...)
64+ jugadores: 5 rondas suizo → 16 finales (con play-in si necesario)
```

---

### 4. MODO ELIMINACIÓN MEJORADO (Enhanced Elimination)

**Características:**
- Torneo de eliminación directa (simple o doble)
- Configuración flexible de matches por fase (octavos, cuartos, semis, final)
- Permite enfatizar la final con más matches que el resto
- Compatible con estructura actual de torneos

**Configuración:**
```
tournament_type = 'elimination'
elimination_type = 'single' | 'double'  -- Eliminación simple o doble
finalists_count = 16 | 8 | 4 | 2  -- Tamaño del bracket
series_format_eliminations = 'bo1' | 'bo3' | 'bo5'  -- Para octavos, cuartos, semis
series_format_final = 'bo1' | 'bo3' | 'bo5'  -- FINAL (puede ser diferente)

-- O configuración detallada por fase:
elimination_matches_per_round = {
  dieciseisavos: 1 | 3,  -- Matches dieciseisavos (si aplica)
  octavos: 1 | 3,        -- Matches octavos de final
  cuartos: 1 | 3,        -- Matches cuartos de final
  semis: 1 | 3,          -- Matches semifinales
  final: 1 | 3 | 5       -- Matches FINAL (puede diferir)
}
```

**Ejemplo: 16 jugadores, simple elimination**
- Opción 1: Octavos BO1, Cuartos BO1, Semis BO3, Final BO5
- Opción 2: Octavos BO3, Cuartos BO3, Semis BO3, Final BO5
- Opción 3: Todos BO3 excepto Final BO5

**Ejemplo: 32 jugadores, simple elimination**
- Dieciseisavos BO1, Octavos BO3, Cuartos BO3, Semis BO3, Final BO5
- O: Todo BO3 excepto Final BO5

**Ventajas respecto a versión actual:**
- ✅ Control granular sobre matches por fase
- ✅ Final puede ser "best-of-7" mientras octavos es "best-of-1"
- ✅ Mejor experiencia para campeonatos importantes
- ✅ Mantiene compatibilidad con torneos eliminación existentes (default BO1 todas fases)

---

## 🗄️ Cambios en Base de Datos

### 1. Tabla `tournaments` - Nuevos Campos

```sql
ALTER TABLE tournaments ADD COLUMN (
  tournament_type VARCHAR(20) NOT NULL DEFAULT 'elimination'
    CHECK (tournament_type IN ('elimination', 'league', 'swiss', 'swiss_hybrid')),
  
  -- Configuración Liga
  league_type VARCHAR(20)  -- 'single_round' | 'double_round'
  
  -- Configuración Suizo
  swiss_rounds INT,  -- Número de rondas suizo
  
  -- Configuración Suizo Mixto
  swiss_hybrid_rounds INT,  -- Rondas suizo en modo híbrido
  finalists_count INT,  -- Cuántos avanzan (16, 8, 4)
  
  -- Configuración Eliminación Mejorada
  elimination_type VARCHAR(20),  -- 'single' | 'double' para tipo eliminación
  elimination_matches_dieciseisavos INT DEFAULT 1,  -- Matches dieciseisavos
  elimination_matches_octavos INT DEFAULT 1,        -- Matches octavos
  elimination_matches_cuartos INT DEFAULT 1,        -- Matches cuartos
  elimination_matches_semis INT DEFAULT 1,          -- Matches semifinales
  elimination_matches_final INT DEFAULT 1,          -- Matches FINAL (distinto)
  
  -- Configuración General Puntuación
  points_win INT DEFAULT 3,
  points_loss INT DEFAULT 0,
  points_bye INT DEFAULT 1,
  
  -- Configuración Series
  series_format_swiss VARCHAR(3),  -- 'bo1' | 'bo3' | 'bo5' para suizo
  series_format_finals VARCHAR(3),  -- 'bo1' | 'bo3' | 'bo5' para finales/eliminación
  
  -- Configuración Desempates (Liga/Suizo)
  tiebreaker_1 VARCHAR(20) DEFAULT 'points',  -- 'points' | 'head_to_head' | 'set_diff'
  tiebreaker_2 VARCHAR(20),
  tiebreaker_3 VARCHAR(20),
  
  -- Timestamps
  last_round_completed_at TIMESTAMP,
  swiss_final_standings_at TIMESTAMP
);
```

### 2. Tabla `tournament_rounds` - Nuevos Campos

```sql
ALTER TABLE tournament_rounds ADD COLUMN (
  round_type VARCHAR(20) NOT NULL DEFAULT 'regular'
    CHECK (round_type IN ('regular', 'finals', 'quarterfinals', 
                          'semifinals', 'final')),
  
  -- Orden dentro de la fase
  round_order_in_phase INT,  -- 1, 2, 3... dentro de eliminación
  
  -- Información para suizo
  is_bye_round BOOLEAN DEFAULT FALSE,
  max_points_possible INT,  -- Máximo de puntos a conseguir
  
  -- Información de clasificación
  standings_snapshot JSON,  -- Snapshot del ranking después de esta ronda
  promoted_count INT  -- Cuántos avanzan a siguiente fase
);
```

### 3. Tabla `tournament_matches` - Cambios

```sql
-- Esta tabla ya existe y es suficiente para los nuevos modos
-- Solo necesita confirmación de que maneja bien:
-- - match_status: 'pending', 'in_progress', 'completed', 'cancelled'
-- - replay_file_path para cada juego
-- - Puntos/resultado de cada juego en la serie
```

### 4. Tabla `tournament_standings` (NUEVA)

```sql
CREATE TABLE tournament_standings (
  id UUID PRIMARY KEY,
  tournament_id UUID NOT NULL REFERENCES tournaments(id),
  participant_id UUID NOT NULL REFERENCES tournament_participants(id),
  round_number INT NOT NULL,
  
  -- Estadísticas de puntuación
  total_points INT DEFAULT 0,
  games_played INT DEFAULT 0,
  games_won INT DEFAULT 0,
  games_lost INT DEFAULT 0,
  games_drawn INT DEFAULT 0,
  
  -- Desempates
  sets_for INT DEFAULT 0,
  sets_against INT DEFAULT 0,
  set_difference INT GENERATED ALWAYS AS (sets_for - sets_against),
  
  -- Head to head (liga/suizo)
  h2h_points INT DEFAULT 0,
  h2h_games INT DEFAULT 0,
  
  -- Ranking
  current_rank INT,
  previous_rank INT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(tournament_id, participant_id, round_number),
  FOREIGN KEY(tournament_id) REFERENCES tournaments(id),
  FOREIGN KEY(participant_id) REFERENCES tournament_participants(id)
);

CREATE INDEX idx_standings_tournament_round 
  ON tournament_standings(tournament_id, round_number);
CREATE INDEX idx_standings_current_rank 
  ON tournament_standings(tournament_id, current_rank);
```

### 5. Tabla `swiss_pairings` (NUEVA)

```sql
CREATE TABLE swiss_pairings (
  id UUID PRIMARY KEY,
  tournament_id UUID NOT NULL REFERENCES tournaments(id),
  round_number INT NOT NULL,
  
  player1_id UUID NOT NULL REFERENCES users(id),
  player2_id UUID REFERENCES users(id),  -- NULL si es bye
  match_id UUID REFERENCES tournament_matches(id),
  
  pairing_type VARCHAR(20) NOT NULL DEFAULT 'regular'
    CHECK (pairing_type IN ('regular', 'bye', 'repeat_preventer')),
  
  -- Para prevenir rondas
  previous_pairings INT DEFAULT 0,  -- Cuántas veces han jugado
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(tournament_id, round_number, player1_id, player2_id),
  FOREIGN KEY(tournament_id) REFERENCES tournaments(id)
);

CREATE INDEX idx_pairings_round 
  ON swiss_pairings(tournament_id, round_number);
```

### 6. Tabla `league_standings` (NUEVA)

```sql
CREATE TABLE league_standings (
  id UUID PRIMARY KEY,
  tournament_id UUID NOT NULL REFERENCES tournaments(id),
  participant_id UUID NOT NULL REFERENCES tournament_participants(id),
  
  -- Resultados
  total_points INT DEFAULT 0,
  games_played INT DEFAULT 0,
  games_won INT DEFAULT 0,
  games_drawn INT DEFAULT 0,
  games_lost INT DEFAULT 0,
  
  -- Desempates
  sets_for INT DEFAULT 0,
  sets_against INT DEFAULT 0,
  
  -- Head to head (para desempates)
  h2h_vs_tied JSON,  -- {'player_id': points, ...}
  
  -- Ranking
  current_rank INT,
  
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  
  UNIQUE(tournament_id, participant_id),
  FOREIGN KEY(tournament_id) REFERENCES tournaments(id),
  FOREIGN KEY(participant_id) REFERENCES tournament_participants(id)
);

CREATE INDEX idx_league_standings_rank 
  ON league_standings(tournament_id, current_rank);
```

---

## 🔄 Flujos de Datos por Modo

### MODO LIGA

```
1. Usuario crea torneo → tipo=liga, liga_type=single/double
2. Sistema genera todos los enfrentamientos:
   - Si ida: N*(N-1)/2 enfrentamientos
   - Si ida y vuelta: N*(N-1) enfrentamientos
3. Sistema crea tournament_matches para cada juego de cada serie
4. Conforme se juegan partidas:
   - Se actualiza tournament_standings
   - Se recalcula ranking tras cada ronda/fecha
5. Final: Ranking definitivo por puntos (con desempates)
```

### MODO SUIZO

```
1. Usuario crea torneo → tipo=swiss, swiss_rounds=4/5/6
2. Ronda 1: Emparejamiento aleatorio
   - Sistema genera pairings en swiss_pairings
   - Crea tournament_matches para cada serie
3. Después de cada ronda:
   - Actualiza tournament_standings
   - Calcula puntos acumulados
4. Rondas 2+: Emparejamiento por puntuación
   - Agrupa jugadores por puntos (buckets)
   - Empareja dentro de cada bucket
   - Evita rondas repetidas
5. Final: Ranking por puntos totales
```

### MODO SUIZO MIXTO

```
1. Usuario crea torneo → tipo=swiss_hybrid, swiss_rounds=4, finalists=8
2. FASE SUIZO (Rondas 1-4):
   - Igual que modo suizo puro
   - Calcula puntos totales tras 4 rondas
3. TRANSICIÓN:
   - Top 8 jugadores avanzan a fase eliminación
   - Se generan bracket de 8 (cuartos, semis, final)
4. FASE FINAL (Rondas 5-7):
   - Round 5: Cuartos (4 enfrentamientos)
   - Round 6: Semis (2 enfrentamientos)
   - Round 7: Final (1 enfrentamiento)
5. Final: Campeón de la final
```

---

## 📊 Propuesta Automática de Configuración

```javascript
// Función: suggestTournamentConfig(participantCount, desiredFormat)

const suggestions = {
  8-15: [
    {
      type: 'league',
      league_type: 'single_round',  // 28-105 enfrentamientos
      description: '1 Ronda - Todos contra todos'
    },
    {
      type: 'swiss',
      swiss_rounds: 3,  // 12-22.5 enfrentamientos
      description: '3 Rondas Suizo - Menos partidas, justo'
    },
    {
      type: 'swiss_hybrid',
      swiss_rounds: 2,
      finalists_count: 4,  // 8 + 4 + 2 + 1 = 15 enfrentamientos
      description: '2 Suizo + 4 Finales (Cuartos/Semis/Final)'
    }
  ],
  
  16-31: [
    {
      type: 'league',
      league_type: 'single_round',  // 120-465 enfrentamientos
      description: '1 Ronda - Todos contra todos'
    },
    {
      type: 'swiss',
      swiss_rounds: 4,  // 32-62 enfrentamientos
      description: '4 Rondas Suizo - Balanceado'
    },
    {
      type: 'swiss_hybrid',
      swiss_rounds: 3,
      finalists_count: 8,  // 24 + 28 = 52 enfrentamientos
      description: '3 Suizo + 8 Finales (Octavos/Cuartos/Semis/Final)'
    }
  ],
  
  32-63: [
    {
      type: 'league',
      league_type: 'single_round',  // 496-1953 enfrentamientos
      description: '1 Ronda - Muchas partidas'
    },
    {
      type: 'swiss',
      swiss_rounds: 5,  // 80-157.5 enfrentamientos
      description: '5 Rondas Suizo - Completo'
    },
    {
      type: 'swiss_hybrid',
      swiss_rounds: 4,
      finalists_count: 16,  // 64 + 60 = 124 enfrentamientos
      description: '4 Suizo + 16 Finales (Dieciseisavos/...)'
    }
  ],
  
  64+: [
    {
      type: 'swiss',
      swiss_rounds: 6,  // 192+ enfrentamientos
      description: '6 Rondas Suizo - Garantiza justicia'
    },
    {
      type: 'swiss_hybrid',
      swiss_rounds: 5,
      finalists_count: 16,  // 160 + 120 = 280 enfrentamientos
      description: '5 Suizo + 16 Finales'
    }
  ]
};
```

---

## 🔑 Cambios en Lógica de Aplicación

### Backend Endpoints

```
POST /api/tournaments
  - Body ahora incluye: tournament_type, league_type, swiss_rounds, etc.
  - Validación: Si tipo=liga, requiere league_type; si=swiss, swiss_rounds, etc.

POST /api/tournaments/:id/generate-pairings
  - Parámetro: round_number
  - Lógica: Según tournament_type, llama función correspondiente:
    - generateLeaguePairings() → todos contra todos
    - generateSwissPairings() → por puntuación
    - generateHybridPairings() → suizo o eliminación

POST /api/tournaments/:id/calculate-standings
  - Recalcula tournament_standings o league_standings
  - Reordena ranking
  - Propone siguientes rondas si aplica

GET /api/tournaments/:id/suggestions
  - Retorna sugerencias de configuración para N participantes
```

### Frontend Cambios

```
1. Tournament Creation Wizard:
   - Paso 1: Seleccionar tipo (Liga, Suizo, Suizo Mixto)
   - Paso 2: Configuración específica del tipo
   - Paso 3: Validación de sugerencias automáticas

2. Tournament Dashboard:
   - Mostrar standings según tipo
   - Modo Liga: Tabla con GJ/G/P/E/PTS
   - Modo Suizo: Tabla con puntos + ronda actual
   - Modo Híbrido: Standings suizo + bracket eliminación

3. Pairings Management:
   - Liga: Mostrar fechas/jornadas
   - Suizo: Mostrar ronda actual + propuesta siguiente
   - Híbrido: Switchear entre vista suizo y eliminación
```

---

## ✅ Ventajas de Esta Propuesta

| Aspecto | Ventaja |
|---------|---------|
| **Flexibilidad** | Soporta 3 formatos diferentes |
| **Escalabilidad** | Funciona de 4 a 1000+ jugadores |
| **Justicia** | Suizo minimiza "fichas" del bracket |
| **Eficiencia** | Menos partidas que liga pura |
| **UX** | Sugerencias automáticas para organizadores |
| **Extensibilidad** | Fácil añadir nuevos formatos |
| **Performance** | Índices optimizados en standings |
| **Reportes** | Standings, head-to-head, desempates claros |

---

## 🚨 Consideraciones Importantes

1. **Desempates en Liga/Suizo:**
   - Necesita orden claro: Puntos > Diferencia Sets > Head-to-Head > Mayor victorias
   - Debe documentarse en torneo

2. **Byes en Suizo:**
   - Si N es impar, alguien recibe bye cada ronda
   - El bye típicamente da 1 punto (configurable)
   - Debe rotarse para ser justo

3. **Rondas Repetidas:**
   - En suizo, prevenir que misma pareja juegue 2 veces
   - Hacer coincidir suizo_rounds con N para máximas rondas

4. **Migración:**
   - Torneos existentes seguirán funcionando (type=elimination)
   - Eliminación mejorada: campos de matches nuevos tendrán DEFAULT 1 (BO1 todas fases)
   - Nuevos torneos pueden usar nuevos tipos y configuraciones granulares
   - Backfill automático de standings si es necesario

5. **Emparejamiento Swiss:**
   - Algoritmo puede ser random mejorado o almohada suiza
   - Depende de complejidad vs rendimiento deseado

---

## 📝 Roadmap de Implementación

### Fase 1: Infraestructura Base
1. Crear migraciones SQL con los nuevos campos y tablas
2. Actualizar tabla `tournaments` con tipos y configuraciones
3. Actualizar tabla `tournament_rounds` con información de fase

### Fase 2: Mejoras Eliminación (Alta Prioridad)
1. Agregar campos de configuración por fase (octavos, cuartos, semis, final)
2. Implementar lógica para usar diferentes BO según fase
3. Permitir que final tenga BO5 mientras octavos es BO1
4. Fully backward compatible: defaults a BO1 todas fases

### Fase 3: Nuevos Modos (Liga, Suizo, Suizo Mixto)
1. Implementar lógica de emparejamiento (liga, suizo)
2. Crear endpoints de generación de pairings
3. Implementar cálculo automático de standings
4. Tests para cada formato

### Fase 4: Frontend & UX
1. Wizard de creación de torneo con selección de modo
2. Diferentes vistas de standings según modo
3. Gestión de pairings para suizo
4. Visualización de brackets

### Fase 5: Tests & Validación
1. Tests unitarios para algoritmos (liga, suizo)
2. Tests de integración para workflows
3. Validación de torneos con datos reales

---

## 📝 Siguiente Paso

¿Apruebas esta propuesta con las cuatro modalidades (Liga, Suizo, Suizo Mixto, y Eliminación Mejorada) o necesitas ajustes?
