# 📋 HOJA DE REFERENCIA - SISTEMA DE TORNEOS

## Tabla Rápida: Estructura de Torneos

```
┌─────────────────────────────────────────────────────────────┐
│                    TOURNAMENT STRUCTURE                      │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  1 TOURNAMENT                                              │
│   ├─ 4-5 ROUNDS (general + final)                          │
│   │  ├─ BO3 format (general rounds)                        │
│   │  └─ BO5 format (finals)                                │
│   │                                                         │
│   ├─ 32 PARTICIPANTS                                       │
│   │  ├─ Status: active, eliminated, completed              │
│   │  ├─ Wins/Losses tracked                                │
│   │  └─ Rankings calculated                                │
│   │                                                         │
│   └─ Multiple SERIES BO                                    │
│      ├─ 1-3 games per round                                │
│      ├─ Winner determined by wins_required                 │
│      └─ Stats updated                                      │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## Base de Datos: Tablas y Relaciones

```
TOURNAMENTS (25 fields)
├─ id (PK)
├─ name, description
├─ status: registration_open | in_progress | completed
├─ general_rounds_format: bo1 | bo3 | bo5
├─ final_rounds_format: bo1 | bo3 | bo5
└─ creator_id (FK → users)
       │
       ├─→ TOURNAMENT_ROUNDS (10 fields)
       │    ├─ id (PK)
       │    ├─ round_number (UNIQUE con tournament_id)
       │    ├─ match_format: bo1 | bo3 | bo5
       │    ├─ round_type: general | final
       │    ├─ round_status: pending | in_progress | completed
       │    └─ round_start_date, round_end_date
       │          │
       │          └─→ TOURNAMENT_ROUND_MATCHES (14 fields)
       │               ├─ id (PK)
       │               ├─ player1_id (FK → users)
       │               ├─ player2_id (FK → users)
       │               ├─ best_of: 1 | 3 | 5
       │               ├─ player1_wins, player2_wins
       │               ├─ series_status: in_progress | completed
       │               └─ winner_id (FK → users)
       │                    │
       │                    └─→ TOURNAMENT_MATCHES (12 fields)
       │                         ├─ id (PK)
       │                         ├─ player1_id (FK → users)
       │                         ├─ player2_id (FK → users)
       │                         ├─ winner_id (FK → users)
       │                         ├─ match_status
       │                         └─ match_id (FK → matches table)
       │
       └─→ TOURNAMENT_PARTICIPANTS (12 fields)
            ├─ id (PK)
            ├─ user_id (FK → users)
            ├─ participation_status: pending | active | eliminated
            ├─ tournament_ranking
            ├─ tournament_wins
            ├─ tournament_losses
            └─ tournament_points
```

---

## Estados de Máquina

```
TOURNAMENT STATES
  registration_open ──→ in_progress ──→ completed

ROUND STATES
  pending ──→ in_progress ──→ completed

SERIES STATES
  in_progress ──→ completed
  (when player1_wins >= wins_required OR player2_wins >= wins_required)

GAME STATES
  pending ──→ in_progress ──→ {completed, cancelled}

PARTICIPANT STATES
  pending ──→ active ──→ {eliminated, completed}
```

---

## Best Of Mapping

```
FORMAT    WINS_REQUIRED    MAX_GAMES    USED FOR
─────────────────────────────────────────────────
BO1       1                1            Qualifiers, quick rounds
BO3       2                3            General rounds
BO5       3                5            Finals, important matches
```

---

## Campos de Configuración Importantes

```
tournaments.general_rounds_format        → 'bo3' (default)
tournaments.final_rounds_format          → 'bo5' (default)
tournaments.max_participants             → 32
tournaments.round_duration_days          → 7
tournaments.auto_advance_round           → true
tournaments.tournament_type              → 'swiss' | 'elimination'
```

---

## Operaciones Básicas (SQL)

### Crear Torneo
```sql
INSERT INTO tournaments (name, description, creator_id, status,
  general_rounds, final_rounds, general_rounds_format, final_rounds_format)
VALUES ('Spring 2025', '...', creator_uuid, 'registration_open',
  3, 1, 'bo3', 'bo5');
```

### Registrar Participante
```sql
INSERT INTO tournament_participants (tournament_id, user_id, participation_status)
VALUES (tournament_uuid, user_uuid, 'pending');
```

### Crear Serie BO
```sql
INSERT INTO tournament_round_matches
  (tournament_id, round_id, player1_id, player2_id, best_of, wins_required)
VALUES (t_uuid, r_uuid, p1_uuid, p2_uuid, 3, 2);
```

### Registrar Resultado
```sql
UPDATE tournament_matches SET match_status='completed', 
  winner_id=winner_uuid WHERE id=match_uuid;

UPDATE tournament_round_matches SET player1_wins = player1_wins + 1
  WHERE id=series_uuid;
```

### Ver Rankings
```sql
SELECT ROW_NUMBER() OVER (ORDER BY tournament_wins DESC) rank,
  u.nickname, tp.tournament_wins, tp.tournament_losses
FROM tournament_participants tp
JOIN users u ON tp.user_id = u.id
WHERE tp.tournament_id = tournament_uuid
ORDER BY rank;
```

---

## Validaciones Críticas

```
BEFORE Creating Series BO:
  ✓ Both players must be active participants
  ✓ No existing series between them in this round
  ✓ Round must be in 'pending' or 'in_progress' state

BEFORE Recording Result:
  ✓ Game must be in 'pending' or 'in_progress' state
  ✓ Series must not be 'completed'
  ✓ Winner must be one of the two players

BEFORE Completing Round:
  ✓ All series in round must be 'completed'
  ✓ All games must be 'completed' or 'cancelled'
```

---

## Índices para Performance

```
tournaments:
  ├─ idx_tournaments_status ON (status)
  └─ idx_tournaments_formats ON (general_rounds_format, final_rounds_format)

tournament_rounds:
  ├─ idx_tournament_rounds_tournament ON (tournament_id)
  ├─ idx_tournament_rounds_status ON (round_status)
  └─ idx_tournament_rounds_type ON (round_type)

tournament_round_matches:
  ├─ idx_tournament_round_matches_tournament ON (tournament_id)
  ├─ idx_tournament_round_matches_round ON (round_id)
  ├─ idx_tournament_round_matches_players ON (player1_id, player2_id)
  └─ idx_tournament_round_matches_status ON (series_status)

tournament_matches:
  ├─ idx_tournament_matches_tournament ON (tournament_id)
  ├─ idx_tournament_matches_round ON (round_id)
  ├─ idx_tournament_matches_player1 ON (player1_id)
  ├─ idx_tournament_matches_player2 ON (player2_id)
  ├─ idx_tournament_matches_status ON (match_status)
  └─ idx_tournament_matches_winner ON (winner_id)
```

---

## Cascade Behavior

```
DELETE tournaments
  ├─ CASCADE → tournament_rounds
  │  └─ CASCADE → tournament_round_matches
  │     └─ CASCADE → tournament_matches
  ├─ CASCADE → tournament_participants
  └─ SET NULL on foreign keys to users
```

---

## Consultas Comunes

### Obtener ronda actual
```sql
SELECT * FROM tournament_rounds 
WHERE tournament_id = $1 AND round_status = 'in_progress';
```

### Obtener series de una ronda
```sql
SELECT trm.*, u1.nickname p1, u2.nickname p2
FROM tournament_round_matches trm
JOIN users u1 ON trm.player1_id = u1.id
JOIN users u2 ON trm.player2_id = u2.id
WHERE trm.round_id = $1;
```

### Obtener juegos de una serie
```sql
SELECT * FROM tournament_matches 
WHERE tournament_round_match_id = $1 ORDER BY created_at;
```

### Verificar si ronda está completa
```sql
SELECT COUNT(*) pending FROM tournament_round_matches
WHERE round_id = $1 AND series_status = 'in_progress';
-- 0 = round complete
```

### Actualizar progreso de serie
```sql
UPDATE tournament_round_matches
SET (player1_wins, player2_wins) = (
  SELECT COUNT(CASE WHEN winner_id = player1_id THEN 1 END),
         COUNT(CASE WHEN winner_id = player2_id THEN 1 END)
  FROM tournament_matches
  WHERE tournament_round_match_id = $1
)
WHERE id = $1;
```

---

## Errores Comunes

❌ **Error**: Crear serie con participante inactivo
```
✓ Verificar: SELECT * FROM tournament_participants 
             WHERE tournament_id = t_id AND user_id IN (p1, p2)
             AND participation_status = 'active';
```

❌ **Error**: Serie duplicada en ronda
```
✓ Constraint: UNIQUE (tournament_id, round_id, player1_id, player2_id)
```

❌ **Error**: Completar serie sin ganador
```
✓ Lógica: winner_id = CASE WHEN p1_wins >= wins_required THEN p1 ELSE p2 END
```

❌ **Error**: Juego sin serie padre
```
✓ FK: tournament_round_match_id REFERENCES tournament_round_matches(id)
```

---

## Ciclo de Vida Simplificado

```
1. CREATE TOURNAMENT
   INSERT tournaments

2. REGISTER PARTICIPANTS
   INSERT tournament_participants (status='pending')

3. START TOURNAMENT
   UPDATE tournaments (status='in_progress')
   UPDATE tournament_participants (status='active')

4. CREATE ROUND
   INSERT tournament_rounds (status='pending')

5. PAIR PLAYERS
   INSERT tournament_round_matches (best_of=3)
   INSERT tournament_matches (×3 games max for BO3)

6. PLAY & RECORD RESULTS
   UPDATE tournament_matches (status='completed', winner_id)
   UPDATE tournament_round_matches (player1_wins or player2_wins)
   → If wins_required reached:
     UPDATE tournament_round_matches (status='completed')
     UPDATE tournament_participants (tournament_wins++)

7. COMPLETE ROUND
   UPDATE tournament_rounds (status='completed')

8. NEXT ROUND OR FINAL
   REPEAT steps 4-7

9. COMPLETE TOURNAMENT
   UPDATE tournaments (status='completed')
   SELECT tournament_ranking=1 AS champion
```

---

## Documentación Referencias

```
Para más información, ver:

TOURNAMENT_ANALYSIS_SUMMARY.md          ← Visión general
TOURNAMENT_DATABASE_STRUCTURE.md        ← Detalles técnicos
TOURNAMENT_DIAGRAMS_AND_FLOWS.md        ← Diagramas
TOURNAMENT_EXAMPLES_AND_QUERIES.md      ← Código SQL
TOURNAMENT_QUICK_REFERENCE.md           ← Referencia rápida
TOURNAMENT_DOCUMENTATION_INDEX.md       ← Índice completo
```

---

## 🎯 Puntos Clave

✅ **5 Tablas** - tournaments, rounds, participants, round_matches, matches  
✅ **3 Formatos BO** - bo1 (1 win), bo3 (2 wins), bo5 (3 wins)  
✅ **Flexible** - Soporta múltiples tipos de torneos  
✅ **Escalable** - Crece con número de participantes  
✅ **Seguro** - Constraints y validaciones integradas  
✅ **Rastreable** - Historial completo de datos  

---

**Quick Reference Card**  
Version: 1.0  
Last Updated: December 14, 2025
