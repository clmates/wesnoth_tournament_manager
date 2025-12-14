# Diagramas Visuales - Sistema de Torneos

## Diagrama Entidad-Relación Completo

```
                              ┌─────────────────────────────┐
                              │         USERS              │
                              │ (tabla referencial)        │
                              ├─────────────────────────────┤
                              │ id (PK)                     │
                              │ nickname                    │
                              │ email                       │
                              │ ...                         │
                              └──────────┬──────────────────┘
                                         │
                ┌────────────────────────┼────────────────────────────────┐
                │                        │                                │
                │ (creator_id)    (user_id)                        (user_id)
                │                        │                                │
    ┌───────────▼────────────────┐      │                                │
    │    TOURNAMENTS             │      │                                │
    │  (Tabla Principal)         │      │                                │
    ├────────────────────────────┤      │                                │
    │ id (PK)                    │      │                                │
    │ name                       │      │                                │
    │ description                │      │                                │
    │ creator_id (FK) ───────────┼──────┘                                │
    │ status                     │                                       │
    │ general_rounds             │                                       │
    │ final_rounds               │                                       │
    │ general_rounds_format      │                                       │
    │ final_rounds_format        │                                       │
    │ max_participants           │                                       │
    │ tournament_type            │                                       │
    │ round_duration_days        │                                       │
    │ auto_advance_round         │                                       │
    │ current_round              │                                       │
    │ total_rounds               │                                       │
    │ created_at                 │                                       │
    │ started_at                 │                                       │
    │ finished_at                │                                       │
    └──────────┬──────────────────┘                                      │
               │ (1:N) - Relación Jerárquica                            │
               │                                                         │
    ┌──────────▼─────────────────────────────────────────┐               │
    │  TOURNAMENT_ROUNDS                                 │               │
    │ (Rondas del Torneo)                               │               │
    ├────────────────────────────────────────────────────┤               │
    │ id (PK)                                            │               │
    │ tournament_id (FK) ──────┐                         │               │
    │ round_number             │                         │               │
    │ match_format (bo1/bo3/bo5)                        │               │
    │ round_type (general/final)                        │               │
    │ round_status             │                         │               │
    │ round_start_date         │                         │               │
    │ round_end_date           │                         │               │
    │ created_at               │                         │               │
    │ UNIQUE (tournament_id, round_number)              │               │
    └────────┬──────────────────┬───────────────────────┘                │
             │ (1:N)            └──────────────────────────┐              │
             │                                             │ (FK)        │
    ┌────────▼─────────────────────────────────────────────┐│             │
    │  TOURNAMENT_PARTICIPANTS                            ││             │
    │ (Participación de Usuarios)                        ││             │
    ├─────────────────────────────────────────────────────┤│             │
    │ id (PK)                                             ││             │
    │ tournament_id (FK) ─────────────┐                  ││             │
    │ user_id (FK) ───────────────────┼──────┐           ││             │
    │ current_round                   │      │           ││             │
    │ status                          │      │           ││             │
    │ participation_status            │      │           ││             │
    │ tournament_ranking              │      │           ││             │
    │ tournament_wins                 │      │           ││             │
    │ tournament_losses               │      │           ││             │
    │ tournament_points               │      │           ││             │
    │ created_at                      │      │           ││             │
    │ UNIQUE (tournament_id, user_id) │      │           ││             │
    └────────────────────────────────┬┘      │           ││             │
                                     │       │           ││             │
                    ┌────────────────┘       │           ││             │
                    │                        │           ││             │
                    │ (tournament_id)        │ (user_id) ││             │
                    │                        │           ││             │
        ┌───────────▼────────────────────────▼────┐      ││             │
        │  TOURNAMENT_ROUND_MATCHES               │      ││             │
        │ (Series Best Of entre 2 jugadores)     │      ││             │
        ├─────────────────────────────────────────┤      ││             │
        │ id (PK)                                 │      ││             │
        │ tournament_id (FK)                      │      ││             │
        │ round_id (FK)                           │      ││             │
        │ player1_id (FK) ────────────────────────┼──────┤│             │
        │ player2_id (FK) ────────────────────────┼──────┤│             │
        │ best_of (1/3/5)                         │      │├─────────────┘
        │ wins_required                           │      ││
        │ player1_wins                            │      ││
        │ player2_wins                            │      ││
        │ matches_scheduled                       │      ││
        │ series_status                           │      ││
        │ winner_id (FK) ─────────────────────────┼──────┤│
        │ created_at                              │      ││
        │ UNIQUE (tournament_id, round_id,        │      ││
        │         player1_id, player2_id)         │      ││
        └────────┬─────────────────────────────────┘      ││
                 │ (1:N) - Relación por Serie             ││
                 │                                         ││
    ┌────────────▼────────────────────────────────────────┐│
    │  TOURNAMENT_MATCHES                                 ││
    │ (Juegos Individuales dentro de la Serie)           ││
    ├─────────────────────────────────────────────────────┤│
    │ id (PK)                                             ││
    │ tournament_id (FK)                                  ││
    │ round_id (FK)                                       ││
    │ player1_id (FK)                                     ││
    │ player2_id (FK)                                     ││
    │ winner_id (FK)                                      ││
    │ match_id (FK) → matches table (juego registrado)   ││
    │ tournament_round_match_id (FK) ──────────────────┬─┘│
    │ match_status                                       │  │
    │ played_at                                          │  │
    │ created_at                                         │  │
    └────────────────────────────────────────────────────┴──┘

Legend:
───► FK (Foreign Key)
(PK) = Primary Key
(1:N) = Relación uno a muchos
```

---

## Flujo de Datos: Ciclo Completo de un Torneo

```
FASE 1: CREACIÓN Y REGISTRO
══════════════════════════════════════════════════════════════════════

1. CREAR TORNEO
   ┌─ INSERT INTO tournaments (name, description, creator_id, status='registration_open', ...)
   │
   └─ RESULT: tournament_id
   
2. REGISTRAR PARTICIPANTES
   ┌─ INSERT INTO tournament_participants (tournament_id, user_id, participation_status='pending', ...)
   │  × N (cantidad de participantes)
   │
   └─ RESULT: N registros de participación


FASE 2: PREPARACIÓN E INICIO
══════════════════════════════════════════════════════════════════════

1. ACTIVAR TORNEO
   ┌─ UPDATE tournaments SET status='in_progress', started_at=NOW
   │
   └─ UPDATE tournament_participants SET participation_status='active' WHERE tournament_id=...

2. CREAR RONDAS
   ┌─ INSERT INTO tournament_rounds (tournament_id, round_number=1, match_format='bo3', ...)
   │  × general_rounds + final_rounds
   │
   └─ RESULT: round_id (para cada ronda)


FASE 3: GENERAR EMPAREJAMIENTOS
══════════════════════════════════════════════════════════════════════

1. EMPAREJAR JUGADORES POR RONDA
   ┌─ Para cada pareja de jugadores:
   │  INSERT INTO tournament_round_matches (
   │    tournament_id, round_id, player1_id, player2_id, best_of, wins_required
   │  )
   │  × M (número de series en la ronda)
   │
   └─ RESULT: round_match_id (para cada serie)

2. CREAR JUEGOS INDIVIDUALES
   ┌─ Para cada serie BO:
   │  INSERT INTO tournament_matches (
   │    tournament_id, round_id, player1_id, player2_id, 
   │    tournament_round_match_id
   │  )
   │  × best_of (1, 3, o 5 juegos máximo)
   │
   └─ RESULT: match_id (para cada juego)


FASE 4: JUGAR SERIES
══════════════════════════════════════════════════════════════════════

PARA CADA SERIE BO:

   JUEGO 1:
   ┌─ UPDATE tournament_matches SET match_status='completed', winner_id=...
   ├─ UPDATE tournament_round_matches SET player1_wins++ OR player2_wins++
   
   JUEGO 2 (si wins_required no alcanzado):
   ├─ UPDATE tournament_matches SET match_status='completed', winner_id=...
   ├─ UPDATE tournament_round_matches SET player1_wins++ OR player2_wins++
   
   JUEGO 3 (si wins_required no alcanzado):
   └─ UPDATE tournament_matches SET match_status='completed', winner_id=...
   └─ UPDATE tournament_round_matches SET player1_wins++ OR player2_wins++

   SERIE COMPLETADA (cuando player1_wins >= wins_required O player2_wins >= wins_required):
   └─ UPDATE tournament_round_matches SET series_status='completed', winner_id=...
   └─ UPDATE tournament_participants SET tournament_wins++, tournament_points+=3


FASE 5: COMPLETAR RONDA
══════════════════════════════════════════════════════════════════════

1. VERIFICAR RONDA COMPLETA
   ┌─ SELECT COUNT WHERE series_status='pending' FROM tournament_round_matches
   │  (Si = 0, ronda está completa)
   
2. ACTUALIZAR ESTADO RONDA
   ├─ UPDATE tournament_rounds SET round_status='completed', round_end_date=NOW
   │
   └─ Calcular rankings finales de ronda
   
3. MOSTRAR RANKINGS
   └─ SELECT * FROM tournament_participants ORDER BY tournament_wins DESC


FASE 6: SIGUIENTE RONDA (si aplica)
══════════════════════════════════════════════════════════════════════

1. CREAR NUEVA RONDA
   ├─ INSERT INTO tournament_rounds (round_number = anterior + 1, ...)
   
2. EMPAREJAR SEGÚN RANKING
   ├─ Aplicar lógica de sistema (swiss, eliminación, etc.)
   
3. REPETIR FASES 3-5


FASE 7: FINALIZACIÓN
══════════════════════════════════════════════════════════════════════

1. COMPLETAR TORNEO
   ├─ UPDATE tournaments SET status='completed', finished_at=NOW
   
2. DETERMINAR CAMPEÓN
   ├─ SELECT * FROM tournament_participants 
   │  WHERE tournament_id=... 
   │  ORDER BY tournament_ranking LIMIT 1
   
3. ACTUALIZAR ESTADÍSTICAS GLOBALES
   └─ Actualizar usuarios con récords, ELO, etc.

```

---

## Estados de Máquina: Transiciones Válidas

```
TORNEO (tournaments.status)
═══════════════════════════

                         ┌─────────────────────┐
                         │ registration_open   │  (Aceptando jugadores)
                         └──────────┬──────────┘
                                    │
                         (Todos registrados,
                          Inicia torneo)
                                    ▼
                         ┌─────────────────────┐
                         │   in_progress       │  (Rondas activas)
                         └──────────┬──────────┘
                                    │
                         (Todas las rondas
                          completadas)
                                    ▼
                         ┌─────────────────────┐
                         │    completed        │  (Campeón determinado)
                         └─────────────────────┘


RONDA (tournament_rounds.round_status)
═════════════════════════════════════

                         ┌──────────────┐
                         │   pending    │  (Preparada, sin jugar)
                         └──────┬───────┘
                                │
                         (Primera serie
                          comienza)
                                ▼
                         ┌──────────────┐
                         │ in_progress  │  (Juegos activos)
                         └──────┬───────┘
                                │
                         (Todas las series
                          completadas)
                                ▼
                         ┌──────────────┐
                         │  completed   │  (Ronda finalizada)
                         └──────────────┘


SERIE BO (tournament_round_matches.series_status)
═════════════════════════════════════════════════

                         ┌──────────────┐
                         │ in_progress  │  (Juegos en curso)
                         └──────┬───────┘
                                │
                         (player1_wins >= wins_required
                          O player2_wins >= wins_required)
                                ▼
                         ┌──────────────┐
                         │  completed   │  (Ganador determinado)
                         └──────────────┘


JUEGO INDIVIDUAL (tournament_matches.match_status)
═════════════════════════════════════════════════

                         ┌──────────────┐
                         │   pending    │  (Programado)
                         └──────┬───────┘
                                │
                         (Jugadores inician)
                                ▼
                         ┌──────────────┐
                         │ in_progress  │  (Partida activa)
                         └──────┬───────┘
                                │
                    ┌───────────┴────────────┐
                    ▼                        ▼
            ┌──────────────┐        ┌──────────────┐
            │  completed   │        │  cancelled   │
            └──────────────┘        └──────────────┘


PARTICIPANTE (tournament_participants.participation_status)
════════════════════════════════════════════════════════════

                         ┌──────────────┐
                         │   pending    │  (Inscripción aceptada)
                         └──────┬───────┘
                                │
                         (Torneo inicia)
                                ▼
                         ┌──────────────┐
                         │    active    │  (Jugando)
                         └──────┬───────┘
                                │
                    ┌───────────┴──────────┐
                    ▼                      ▼
            ┌──────────────┐      ┌──────────────┐
            │ eliminated   │      │  completed   │
            │ (perdió)     │      │ (campeón)    │
            └──────────────┘      └──────────────┘
```

---

## Ejemplo Concreto: Ronda Swiss BO3 con 4 Jugadores

```
DATOS INICIALES:
═════════════════════════════════════════════════════════════════

Tournament:
  ├─ name: "Spring 2025"
  ├─ status: in_progress
  ├─ general_rounds: 3
  ├─ final_rounds: 1
  └─ general_rounds_format: bo3

Participantes:
  ├─ Player A (1600 ELO)
  ├─ Player B (1550 ELO)
  ├─ Player C (1500 ELO)
  └─ Player D (1450 ELO)


RONDA 1: EMPAREJAMIENTO INICIAL
═════════════════════════════════════════════════════════════════

Round 1 (general, BO3):
  ├─ Series 1: Player A vs Player B
  │  ├─ Juego 1.1: A vs B → Gana A
  │  ├─ Juego 1.2: A vs B → Gana A ✓ (A=2-0, serie completada)
  │  └─ Resultado: Player A gana 2-0
  │
  └─ Series 2: Player C vs Player D
     ├─ Juego 2.1: C vs D → Gana D
     ├─ Juego 2.2: C vs D → Gana C
     ├─ Juego 2.3: C vs D → Gana C ✓ (C=2-1, serie completada)
     └─ Resultado: Player C gana 2-1

Rankings después Ronda 1:
  1. Player A (1-0, 3 pts)
  2. Player C (1-0, 3 pts)
  3. Player B (0-1, 0 pts)
  4. Player D (0-1, 0 pts)

Base de Datos después de Ronda 1:
┌─────────────────────────────────────────────────────────────┐
│ TOURNAMENT_ROUND_MATCHES                                    │
├─────────────────────────────────────────────────────────────┤
│ id  │ player1 │ player2 │ p1_w │ p2_w │ status    │ winner  │
├─────┼─────────┼─────────┼──────┼──────┼───────────┼─────────┤
│ s1  │ A       │ B       │ 2    │ 0    │ completed │ A       │
│ s2  │ C       │ D       │ 2    │ 1    │ completed │ C       │
└─────┴─────────┴─────────┴──────┴──────┴───────────┴─────────┘

┌─────────────────────────────────────────────────────────────┐
│ TOURNAMENT_MATCHES                                          │
├─────────────────────────────────────────────────────────────┤
│ id  │ p1  │ p2  │ series │ status    │ winner │ round_match │
├─────┼─────┼─────┼────────┼───────────┼────────┼─────────────┤
│ m1  │ A   │ B   │ s1     │ completed │ A      │ 1-1         │
│ m2  │ A   │ B   │ s1     │ completed │ A      │ 2-0         │
│ m3  │ C   │ D   │ s2     │ completed │ D      │ 1-0         │
│ m4  │ C   │ D   │ s2     │ completed │ C      │ 1-1         │
│ m5  │ C   │ D   │ s2     │ completed │ C      │ 2-1         │
└─────┴─────┴─────┴────────┴───────────┴────────┴─────────────┘


RONDA 2: EMPAREJAMIENTO POR RANKING (SWISS)
═════════════════════════════════════════════════════════════════

Lógica Swiss: Emparejar ganadores entre sí, perdedores entre sí

Round 2 (general, BO3):
  ├─ Series 1: Player A (1-0) vs Player C (1-0)  [Top winners]
  │  ├─ Juego 1.1: A vs C → Gana C
  │  ├─ Juego 1.2: A vs C → Gana A
  │  ├─ Juego 1.3: A vs C → Gana C ✓ (C=2-1, serie completada)
  │  └─ Resultado: Player C gana 2-1
  │
  └─ Series 2: Player B (0-1) vs Player D (0-1)  [Losers bracket]
     ├─ Juego 2.1: B vs D → Gana B
     ├─ Juego 2.2: B vs D → Gana B ✓ (B=2-0, serie completada)
     └─ Resultado: Player B gana 2-0

Rankings después Ronda 2:
  1. Player C (2-0, 6 pts)
  2. Player A (1-1, 3 pts)
  3. Player B (1-1, 3 pts)
  4. Player D (0-2, 0 pts)


RONDA 3: ÚLTIMO RONDA GENERAL
═════════════════════════════════════════════════════════════════

Round 3 (general, BO3):
  ├─ Series 1: Player C (2-0) vs Player A (1-1)
  │  ├─ Juego 1.1: C vs A → Gana C
  │  ├─ Juego 1.2: C vs A → Gana C ✓ (C=2-0, serie completada)
  │  └─ Resultado: Player C gana 2-0 (IMBATIBLE)
  │
  └─ Series 2: Player B (1-1) vs Player D (0-2)
     ├─ Juego 2.1: B vs D → Gana B
     ├─ Juego 2.2: B vs D → Gana B ✓ (B=2-0, serie completada)
     └─ Resultado: Player B gana 2-0

Rankings después Ronda 3 (General):
  1. Player C (3-0, 9 pts) ← TOP SEED PARA FINAL
  2. Player B (2-1, 6 pts) ← SEGUNDO SEED PARA FINAL
  3. Player A (1-2, 3 pts)
  4. Player D (0-3, 0 pts)

Top 2 avanzan a FINAL


RONDA FINAL: BO5
═════════════════════════════════════════════════════════════════

Final (BO5) - Necesita 3 victorias:

  Series 1: Player C vs Player B
  ├─ Juego 1: C vs B → Gana C
  ├─ Juego 2: C vs B → Gana C
  ├─ Juego 3: C vs B → Gana B
  ├─ Juego 4: C vs B → Gana C ✓ (C=3-1, final completada)
  └─ Resultado: Player C CAMPEÓN (3-1 en BO5)

TORNEO COMPLETADO:
┌──────────────────────────────┐
│ RANKINGS FINALES DEL TORNEO  │
├──────────────────────────────┤
│ 1. Player C (CAMPEÓN)        │ 4-0 récord
│ 2. Player B                  │ 2-2 récord
│ 3. Player A                  │ 1-3 récord
│ 4. Player D                  │ 0-4 récord
└──────────────────────────────┘
```

---

## Impacto en Otras Tablas (matches, users)

```
RELACIÓN CON TABLA: matches (Juegos generales no-tournament)
════════════════════════════════════════════════════════════

tournament_matches.match_id → matches.id (FK opcional)

Si tournament_matches.match_id = NULL:
  └─ Serie BO no vinculada a juego registrado (solo internal tracking)

Si tournament_matches.match_id = match_uuid:
  └─ Juego sincronizado con sistema general:
     ├─ ELO ratings actualizado en users
     ├─ Match statistics actualizado
     └─ Replay disponible


IMPACTO EN TABLA: users
════════════════════════

UPDATE users SET:
  ├─ matches_played ++ (cuando tournament_matches.match_status = 'completed')
  ├─ elo_rating += delta (si tournament_matches.match_id referencia juego completo)
  └─ (estadísticas de nivel/ranking global)

RELACIÓN:
  ├─ tournament_participants.user_id → users.id
  ├─ tournament_round_matches.player1_id → users.id
  ├─ tournament_round_matches.player2_id → users.id
  ├─ tournament_round_matches.winner_id → users.id
  ├─ tournament_matches.player1_id → users.id
  ├─ tournament_matches.player2_id → users.id
  ├─ tournament_matches.winner_id → users.id
  └─ tournament_matches.match_id → matches.id (para ELO sync)
```

---

**Última actualización**: 14 de Diciembre, 2025
