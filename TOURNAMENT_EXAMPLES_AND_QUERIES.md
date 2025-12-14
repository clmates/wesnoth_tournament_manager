# Ejemplos Prácticos - Sistema de Torneos

## Ejemplos de Datos y Consultas

---

## 1. CREACIÓN DE UN TORNEO COMPLETO

### Paso 1: Crear el Torneo

```sql
INSERT INTO tournaments (
  name, 
  description, 
  creator_id, 
  status,
  general_rounds, 
  final_rounds,
  general_rounds_format,
  final_rounds_format,
  max_participants,
  tournament_type,
  round_duration_days,
  auto_advance_round
)
VALUES (
  'CLM Spring Championship 2025',
  'Torneo principal de primavera con 32 participantes',
  'uuid-admin',
  'registration_open',
  3,  -- 3 rondas generales
  1,  -- 1 ronda final
  'bo3',  -- Best Of 3 en rondas generales
  'bo5',  -- Best Of 5 en final
  32,
  'swiss',
  7,  -- 7 días por ronda
  true
)
RETURNING id;
-- Result: tournament_id = 'uuid-tournament-001'
```

### Paso 2: Registrar Participantes

```sql
INSERT INTO tournament_participants (tournament_id, user_id, participation_status)
VALUES
  ('uuid-tournament-001', 'uuid-player-1', 'pending'),
  ('uuid-tournament-001', 'uuid-player-2', 'pending'),
  ('uuid-tournament-001', 'uuid-player-3', 'pending'),
  -- ... más participantes
  ('uuid-tournament-001', 'uuid-player-32', 'pending');
```

### Paso 3: Iniciar el Torneo

```sql
UPDATE tournaments
SET status = 'in_progress', 
    started_at = CURRENT_TIMESTAMP,
    prepared_at = CURRENT_TIMESTAMP
WHERE id = 'uuid-tournament-001';

UPDATE tournament_participants
SET participation_status = 'active'
WHERE tournament_id = 'uuid-tournament-001';
```

### Paso 4: Crear Primera Ronda

```sql
INSERT INTO tournament_rounds (
  tournament_id,
  round_number,
  match_format,
  round_type,
  round_status
)
VALUES (
  'uuid-tournament-001',
  1,
  'bo3',  -- Heredado de general_rounds_format
  'general',
  'pending'
)
RETURNING id;
-- Result: round_id = 'uuid-round-001'
```

### Paso 5: Crear Emparejamientos (Ejemplo: 2 Series BO3)

```sql
-- Serie 1: Player1 vs Player2
INSERT INTO tournament_round_matches (
  tournament_id,
  round_id,
  player1_id,
  player2_id,
  best_of,
  wins_required,
  series_status
)
VALUES (
  'uuid-tournament-001',
  'uuid-round-001',
  'uuid-player-1',
  'uuid-player-2',
  3,  -- BO3
  2,  -- Necesita 2 victorias
  'in_progress'
)
RETURNING id;
-- Result: round_match_id_1 = 'uuid-series-001'

-- Serie 2: Player3 vs Player4
INSERT INTO tournament_round_matches (
  tournament_id,
  round_id,
  player1_id,
  player2_id,
  best_of,
  wins_required,
  series_status
)
VALUES (
  'uuid-tournament-001',
  'uuid-round-001',
  'uuid-player-3',
  'uuid-player-4',
  3,
  2,
  'in_progress'
)
RETURNING id;
-- Result: round_match_id_2 = 'uuid-series-002'
```

### Paso 6: Crear Juegos Individuales para Serie BO3

```sql
-- Juego 1 de la serie
INSERT INTO tournament_matches (
  tournament_id,
  round_id,
  player1_id,
  player2_id,
  tournament_round_match_id,
  match_status
)
VALUES (
  'uuid-tournament-001',
  'uuid-round-001',
  'uuid-player-1',
  'uuid-player-2',
  'uuid-series-001',
  'pending'
)
RETURNING id;
-- Result: match_id_1 = 'uuid-match-001'

-- Juego 2
INSERT INTO tournament_matches (
  tournament_id,
  round_id,
  player1_id,
  player2_id,
  tournament_round_match_id,
  match_status
)
VALUES (
  'uuid-tournament-001',
  'uuid-round-001',
  'uuid-player-1',
  'uuid-player-2',
  'uuid-series-001',
  'pending'
)
RETURNING id;
-- Result: match_id_2 = 'uuid-match-002'

-- Juego 3 (si es necesario)
INSERT INTO tournament_matches (
  tournament_id,
  round_id,
  player1_id,
  player2_id,
  tournament_round_match_id,
  match_status
)
VALUES (
  'uuid-tournament-001',
  'uuid-round-001',
  'uuid-player-1',
  'uuid-player-2',
  'uuid-series-001',
  'pending'
)
RETURNING id;
-- Result: match_id_3 = 'uuid-match-003'
```

---

## 2. REGISTRAR RESULTADOS DE JUEGOS

### Juego 1: Gana Player 1

```sql
UPDATE tournament_matches
SET match_status = 'completed',
    winner_id = 'uuid-player-1',
    played_at = CURRENT_TIMESTAMP
WHERE id = 'uuid-match-001';

-- Actualizar serie: Player 1 gana 1-0
UPDATE tournament_round_matches
SET player1_wins = 1
WHERE id = 'uuid-series-001';
```

### Juego 2: Gana Player 2

```sql
UPDATE tournament_matches
SET match_status = 'completed',
    winner_id = 'uuid-player-2',
    played_at = CURRENT_TIMESTAMP
WHERE id = 'uuid-match-002';

-- Actualizar serie: Empate 1-1
UPDATE tournament_round_matches
SET player2_wins = 1
WHERE id = 'uuid-series-001';
```

### Juego 3: Gana Player 1 (Serie completada)

```sql
UPDATE tournament_matches
SET match_status = 'completed',
    winner_id = 'uuid-player-1',
    played_at = CURRENT_TIMESTAMP
WHERE id = 'uuid-match-003';

-- Actualizar serie: Player 1 gana 2-1 (serie completa)
UPDATE tournament_round_matches
SET player1_wins = 2,
    series_status = 'completed',
    winner_id = 'uuid-player-1'
WHERE id = 'uuid-series-001';

-- Actualizar estadísticas del participante ganador
UPDATE tournament_participants
SET tournament_wins = tournament_wins + 1
WHERE tournament_id = 'uuid-tournament-001'
  AND user_id = 'uuid-player-1';

-- Actualizar estadísticas del participante perdedor
UPDATE tournament_participants
SET tournament_losses = tournament_losses + 1
WHERE tournament_id = 'uuid-tournament-001'
  AND user_id = 'uuid-player-2';
```

---

## 3. CONSULTAS ÚTILES

### 3.1 Estado Actual de una Ronda

```sql
SELECT 
  tr.round_number,
  tr.round_type,
  tr.match_format,
  tr.round_status,
  COUNT(DISTINCT trm.id) as total_series,
  COUNT(DISTINCT CASE WHEN trm.series_status = 'completed' THEN trm.id END) as series_completadas,
  COUNT(DISTINCT tm.id) as total_juegos,
  COUNT(DISTINCT CASE WHEN tm.match_status = 'completed' THEN tm.id END) as juegos_completados
FROM tournament_rounds tr
LEFT JOIN tournament_round_matches trm ON tr.id = trm.round_id
LEFT JOIN tournament_matches tm ON trm.id = tm.tournament_round_match_id
WHERE tr.tournament_id = 'uuid-tournament-001'
  AND tr.round_number = 1
GROUP BY tr.id, tr.round_number, tr.round_type, tr.match_format, tr.round_status;

/* Resultado esperado:
round_number | round_type | match_format | round_status | total_series | series_completadas | total_juegos | juegos_completados
1            | general    | bo3          | in_progress  | 2            | 0                  | 6            | 0
*/
```

### 3.2 Progreso de una Serie BO

```sql
SELECT 
  trm.id,
  u1.nickname as player1,
  u2.nickname as player2,
  trm.best_of,
  trm.player1_wins,
  trm.player2_wins,
  trm.wins_required,
  trm.series_status,
  COUNT(tm.id) as juegos_jugados,
  COUNT(CASE WHEN tm.match_status = 'completed' THEN tm.id END) as juegos_completados
FROM tournament_round_matches trm
JOIN users u1 ON trm.player1_id = u1.id
JOIN users u2 ON trm.player2_id = u2.id
LEFT JOIN tournament_matches tm ON trm.id = tm.tournament_round_match_id
WHERE trm.round_id = 'uuid-round-001'
GROUP BY trm.id, u1.nickname, u2.nickname, trm.best_of, 
         trm.player1_wins, trm.player2_wins, trm.wins_required, trm.series_status;

/* Resultado esperado:
id              | player1  | player2  | best_of | p1_wins | p2_wins | wins_req | status      | total | completados
uuid-series-001 | Player1  | Player2  | 3       | 2       | 1       | 2        | completed   | 3     | 3
uuid-series-002 | Player3  | Player4  | 3       | 0       | 0       | 2        | in_progress | 0     | 0
*/
```

### 3.3 Rankings Después de Ronda

```sql
SELECT 
  ROW_NUMBER() OVER (ORDER BY tp.tournament_wins DESC, 
                              tp.tournament_losses ASC, 
                              tp.tournament_points DESC) as ranking,
  u.nickname,
  tp.tournament_wins as victorias,
  tp.tournament_losses as derrotas,
  tp.tournament_points as puntos,
  tp.participation_status
FROM tournament_participants tp
JOIN users u ON tp.user_id = u.id
WHERE tp.tournament_id = 'uuid-tournament-001'
ORDER BY ranking;

/* Resultado esperado:
ranking | nickname | victorias | derrotas | puntos | participation_status
1       | Player1  | 1         | 0        | 3      | active
2       | Player3  | 0         | 1        | 0      | active
3       | Player2  | 0         | 1        | 0      | active
4       | Player4  | 0         | 0        | 0      | active
*/
```

### 3.4 Historial de Juegos de un Jugador en Ronda

```sql
SELECT 
  tm.id,
  CASE WHEN tm.player1_id = 'uuid-player-1' THEN u2.nickname ELSE u1.nickname END as opponent,
  CASE WHEN tm.winner_id = 'uuid-player-1' THEN 'Victoria' ELSE 'Derrota' END as resultado,
  tm.match_status,
  tm.played_at,
  trm.round_number,
  trm.match_format
FROM tournament_matches tm
JOIN tournament_round_matches trm ON tm.tournament_round_match_id = trm.id
JOIN users u1 ON tm.player1_id = u1.id
JOIN users u2 ON tm.player2_id = u2.id
WHERE tm.tournament_id = 'uuid-tournament-001'
  AND (tm.player1_id = 'uuid-player-1' OR tm.player2_id = 'uuid-player-1')
  AND trm.round_number = 1
ORDER BY tm.played_at DESC;

/* Resultado esperado:
id              | opponent | resultado | match_status | played_at                | round_number | match_format
uuid-match-003  | Player2  | Victoria  | completed    | 2025-12-14 10:30:00     | 1            | bo3
uuid-match-002  | Player2  | Derrota   | completed    | 2025-12-14 09:15:00     | 1            | bo3
uuid-match-001  | Player2  | Victoria  | completed    | 2025-12-14 08:00:00     | 1            | bo3
*/
```

### 3.5 Comparativa Formato BO1 vs BO3 vs BO5

```sql
SELECT 
  match_format,
  COUNT(*) as series_totales,
  AVG(CASE WHEN series_status = 'completed' 
           THEN (player1_wins + player2_wins) 
           ELSE NULL END) as promedio_juegos_completados,
  COUNT(CASE WHEN series_status = 'in_progress' THEN 1 END) as series_activas
FROM tournament_round_matches
WHERE tournament_id = 'uuid-tournament-001'
GROUP BY match_format;

/* Resultado esperado (si tuviera datos):
match_format | series_totales | promedio_juegos_completados | series_activas
bo1          | 8              | 1.0                         | 2
bo3          | 8              | 2.5                         | 3
bo5          | 4              | NULL                        | 4
*/
```

### 3.6 Estado Global del Torneo

```sql
SELECT 
  t.name,
  t.status,
  t.general_rounds,
  t.final_rounds,
  COUNT(DISTINCT tp.user_id) as participantes_activos,
  COUNT(DISTINCT tr.id) as rondas_creadas,
  SUM(CASE WHEN tr.round_status = 'pending' THEN 1 ELSE 0 END) as rondas_pendientes,
  SUM(CASE WHEN tr.round_status = 'in_progress' THEN 1 ELSE 0 END) as rondas_activas,
  SUM(CASE WHEN tr.round_status = 'completed' THEN 1 ELSE 0 END) as rondas_completadas
FROM tournaments t
LEFT JOIN tournament_participants tp ON t.id = tp.tournament_id 
                                       AND tp.participation_status = 'active'
LEFT JOIN tournament_rounds tr ON t.id = tr.tournament_id
WHERE t.id = 'uuid-tournament-001'
GROUP BY t.id, t.name, t.status, t.general_rounds, t.final_rounds;

/* Resultado esperado:
name                          | status      | gen_rounds | fin_rounds | part_activos | rondas_creadas | pendientes | activas | completadas
CLM Spring Championship 2025  | in_progress | 3          | 1          | 32           | 1              | 0          | 1       | 0
*/
```

---

## 4. ESCENARIOS DE NEGOCIO

### Escenario A: Torneo Swiss (3 Rondas Generales + Final)

```
Ronda 1 (General, BO3): 16 series entre 32 jugadores
├─ Series 1: Player1 vs Player2 → Player1 gana 2-0
├─ Series 2: Player3 vs Player4 → Player3 gana 2-1
├─ Series 3: Player5 vs Player6 → Player5 gana 2-1
└─ Series 16: Player31 vs Player32 → Player31 gana 2-0

Rankings después Ronda 1:
1. Player1 (1-0, 3 puntos)
2. Player3 (1-0, 3 puntos)
3. Player5 (1-0, 3 puntos)
...

Ronda 2 (General, BO3): Emparejamiento por ranking
├─ Series 1: Player1 (1-0) vs Player3 (1-0) → Player3 gana 2-1
├─ Series 2: Player5 (1-0) vs Player7 (1-0) → Player5 gana 2-0
...

Ronda 3 (General, BO3): Top 8 se avanzan automáticamente

Ronda Final (BO5): Final entre top 2
├─ Final: Player5 vs Player3 (BO5) → Player5 gana 3-1
```

### Escenario B: Eliminación Directa (5 Rondas = 32→16→8→4→2→1)

```
Ronda 1 (BO1): 16 series, todos participan
Ronda 2 (BO1): 8 series, ganadores de R1
Ronda 3 (BO3): 4 series, ganadores de R2 (semifinales)
Ronda 4 (BO3): 2 series, ganadores de R3
Ronda 5 (BO5): Final entre ganadores

Nota: match_format diferente por ronda
```

---

## 5. TRANSICIONES DE ESTADO

### Transición: Completar Ronda

```sql
-- Verificar si todos los juegos de la ronda están completados
WITH ronda_stats AS (
  SELECT 
    COUNT(DISTINCT trm.id) as total_series,
    COUNT(DISTINCT CASE WHEN trm.series_status = 'completed' THEN trm.id END) as series_completas
  FROM tournament_round_matches trm
  WHERE trm.round_id = 'uuid-round-001'
)
UPDATE tournament_rounds
SET round_status = 'completed',
    round_end_date = CURRENT_TIMESTAMP
WHERE id = 'uuid-round-001'
  AND (SELECT total_series = series_completas FROM ronda_stats);
```

### Transición: Avanzar Ronda

```sql
-- Después de completar Ronda 1, crear Ronda 2
INSERT INTO tournament_rounds (
  tournament_id,
  round_number,
  match_format,
  round_type,
  round_status
)
VALUES (
  'uuid-tournament-001',
  2,
  'bo3',
  'general',
  'pending'
)
RETURNING id;

-- Crear nuevos emparejamientos basados en rankings
-- (lógica de negocio específica del sistema)
```

---

## 6. DATOS DE EJEMPLO EN INSERT

```sql
-- Crear torneo
INSERT INTO tournaments VALUES (
  'uuid-001',
  'Spring Open 2025',
  'Torneo abierto de primavera',
  'uuid-admin',
  'in_progress',
  '2025-12-14T10:00:00Z',
  '2025-12-17T18:00:00Z',
  '2025-12-14T18:00:00Z',
  '2025-12-14T10:00:00Z',
  '2025-12-14T10:00:00Z',
  3,
  1,
  '2025-12-13T23:59:59Z',
  '2025-12-14T09:00:00Z',
  'swiss',
  32,
  7,
  true,
  1,
  4,
  'bo3',
  'bo5'
);

-- Crear ronda
INSERT INTO tournament_rounds VALUES (
  'uuid-round-001',
  'uuid-001',
  1,
  'bo3',
  'in_progress',
  '2025-12-14T10:00:00Z',
  NULL,
  '2025-12-14T10:00:00Z',
  '2025-12-14T10:00:00Z',
  'general'
);

-- Crear participantes (ejemplo)
INSERT INTO tournament_participants VALUES
  ('uuid-part-001', 'uuid-001', 'uuid-player-1', 1, 'active', '2025-12-10T12:00:00Z', 'active', 1, 1, 0, 3),
  ('uuid-part-002', 'uuid-001', 'uuid-player-2', 1, 'active', '2025-12-10T12:00:00Z', 'active', 2, 0, 1, 0);
```

---

## 7. VALIDACIONES IMPORTANTES

### Antes de Crear Series BO

```sql
-- Verificar que los jugadores son participantes activos
SELECT COUNT(*) 
FROM tournament_participants 
WHERE tournament_id = 'uuid-tournament-001'
  AND user_id IN ('uuid-player-1', 'uuid-player-2')
  AND participation_status = 'active';
-- Resultado esperado: 2

-- Verificar que no exista ya una serie entre estos jugadores en esta ronda
SELECT COUNT(*)
FROM tournament_round_matches
WHERE round_id = 'uuid-round-001'
  AND ((player1_id = 'uuid-player-1' AND player2_id = 'uuid-player-2') 
       OR (player1_id = 'uuid-player-2' AND player2_id = 'uuid-player-1'));
-- Resultado esperado: 0 (no debe existir)
```

---

## 8. PATRONES DE ACTUALIZACIÓN

### Patrón: Actualizar Resultado + Estadísticas

```sql
-- Comenzar transacción
BEGIN;

-- 1. Actualizar juego individual
UPDATE tournament_matches
SET match_status = 'completed',
    winner_id = $winner_id,
    played_at = CURRENT_TIMESTAMP
WHERE id = $match_id;

-- 2. Verificar si serie está completa
UPDATE tournament_round_matches
SET (player1_wins, player2_wins) = (
  SELECT 
    COUNT(CASE WHEN winner_id = player1_id THEN 1 END),
    COUNT(CASE WHEN winner_id = player2_id THEN 1 END)
  FROM tournament_matches
  WHERE tournament_round_match_id = $series_id
)
WHERE id = $series_id;

-- 3. Si serie completa, actualizar winner y participantes
UPDATE tournament_round_matches
SET series_status = 'completed',
    winner_id = CASE WHEN player1_wins >= wins_required THEN player1_id ELSE player2_id END
WHERE id = $series_id
  AND (player1_wins >= wins_required OR player2_wins >= wins_required);

-- 4. Actualizar estadísticas de participante ganador
UPDATE tournament_participants
SET tournament_wins = tournament_wins + 1,
    tournament_points = tournament_points + 3
WHERE tournament_id = $tournament_id
  AND user_id = (SELECT winner_id FROM tournament_round_matches WHERE id = $series_id)
  AND (SELECT series_status FROM tournament_round_matches WHERE id = $series_id) = 'completed';

COMMIT;
```

---

**Última actualización**: 14 de Diciembre, 2025
