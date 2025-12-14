# Índice de Referencia Rápida - Sistema de Torneos

## 📑 Documentación Disponible

Este análisis incluye 4 documentos principales:

1. **TOURNAMENT_DATABASE_STRUCTURE.md** ← _Estructura completa de tablas_
2. **TOURNAMENT_DIAGRAMS_AND_FLOWS.md** ← _Diagramas visuales y flujos_
3. **TOURNAMENT_EXAMPLES_AND_QUERIES.md** ← _Ejemplos SQL y casos de uso_
4. **TOURNAMENT_QUICK_REFERENCE.md** ← _Este documento (referencia rápida)_

---

## 🗂️ Tablas Principales

### 1. `tournaments` - Información Principal del Torneo

```
Campos clave: id, name, status, general_rounds, final_rounds, 
              general_rounds_format, final_rounds_format, 
              tournament_type, creator_id
              
Estados: registration_open, in_progress, completed

Formatos: bo1, bo3, bo5
```

### 2. `tournament_rounds` - Rondas del Torneo

```
Campos clave: id, tournament_id, round_number, match_format, 
              round_type (general/final), round_status
              
Estados: pending, in_progress, completed

Unique: (tournament_id, round_number)
```

### 3. `tournament_participants` - Participación de Usuarios

```
Campos clave: id, tournament_id, user_id, tournament_ranking,
              tournament_wins, tournament_losses, tournament_points,
              participation_status
              
Estados: pending, active, eliminated

Unique: (tournament_id, user_id)
```

### 4. `tournament_round_matches` - Series Best Of

```
Campos clave: id, tournament_id, round_id, player1_id, player2_id,
              best_of (1/3/5), wins_required (1/2/3),
              player1_wins, player2_wins, series_status, winner_id
              
Estados: in_progress, completed

Unique: (tournament_id, round_id, player1_id, player2_id)
```

### 5. `tournament_matches` - Juegos Individuales

```
Campos clave: id, tournament_id, round_id, player1_id, player2_id,
              tournament_round_match_id, winner_id, match_status,
              match_id (FK a tabla matches), played_at
              
Estados: pending, in_progress, completed, cancelled

Relación: Cada juego pertenece a una serie BO (tournament_round_match_id)
```

---

## 🔗 Relaciones Entre Tablas

```
tournaments (1) ──────→ (N) tournament_rounds
     ↓                            ↓
     ├──────────────→ tournament_participants
     │                            │
     └──────────────→ tournament_round_matches ──→ tournament_matches
                             ↓            ↓
                           players     winners
                             ↓            ↓
                           (usuarios)
```

---

## 📊 Mapeo Best Of

| Best Of | Victorias Req. | Juegos Máx. | Descripción |
|---------|---|---|---|
| BO1 | 1 | 1 | Eliminación simple |
| BO3 | 2 | 3 | Rondas generales |
| BO5 | 3 | 5 | Finales |

---

## 🎯 Estados de Máquina

### Torneo
```
registration_open → in_progress → completed
```

### Ronda
```
pending → in_progress → completed
```

### Serie BO
```
in_progress → completed
```

### Juego Individual
```
pending → in_progress → {completed, cancelled}
```

### Participante
```
pending → active → {eliminated, completed}
```

---

## 💾 Operaciones Básicas

### Crear Torneo
```sql
INSERT INTO tournaments (name, description, creator_id, status, 
  general_rounds, final_rounds, general_rounds_format, final_rounds_format)
VALUES (...)
```

### Registrar Participante
```sql
INSERT INTO tournament_participants (tournament_id, user_id, participation_status)
VALUES (...)
```

### Iniciar Ronda
```sql
INSERT INTO tournament_rounds (tournament_id, round_number, match_format, round_type)
VALUES (...)
```

### Crear Serie BO
```sql
INSERT INTO tournament_round_matches 
  (tournament_id, round_id, player1_id, player2_id, best_of, wins_required)
VALUES (...)
```

### Crear Juego Individual
```sql
INSERT INTO tournament_matches 
  (tournament_id, round_id, player1_id, player2_id, tournament_round_match_id)
VALUES (...)
```

### Registrar Resultado
```sql
UPDATE tournament_matches
SET match_status = 'completed', winner_id = $winner_id, played_at = NOW()
WHERE id = $match_id;

-- Luego actualizar serie:
UPDATE tournament_round_matches
SET player1_wins = player1_wins + 1  -- si gana player1
WHERE id = $series_id;
```

---

## 🔍 Consultas Comunes

### Obtener Torneo Activo
```sql
SELECT * FROM tournaments WHERE status = 'in_progress' LIMIT 1;
```

### Obtener Ronda Actual
```sql
SELECT * FROM tournament_rounds 
WHERE tournament_id = $1 AND round_status = 'in_progress';
```

### Obtener Series de una Ronda
```sql
SELECT * FROM tournament_round_matches WHERE round_id = $1;
```

### Obtener Juegos de una Serie
```sql
SELECT * FROM tournament_matches WHERE tournament_round_match_id = $1;
```

### Obtener Rankings
```sql
SELECT u.nickname, tp.tournament_wins, tp.tournament_losses, tp.tournament_points
FROM tournament_participants tp
JOIN users u ON tp.user_id = u.id
WHERE tp.tournament_id = $1
ORDER BY tp.tournament_wins DESC, tp.tournament_losses ASC;
```

### Verificar Ronda Completa
```sql
SELECT COUNT(*) as series_pendientes
FROM tournament_round_matches
WHERE round_id = $1 AND series_status = 'in_progress';
-- Resultado 0 = ronda completa
```

---

## ⚡ Índices Para Rendimiento

| Tabla | Índice | Propósito |
|-------|--------|----------|
| tournaments | idx_tournament_status | Filtrar por estado |
| tournament_rounds | idx_tournament_rounds_tournament | Buscar rondas de torneo |
| tournament_round_matches | idx_tournament_round_matches_round | Buscar series de ronda |
| tournament_matches | idx_tournament_matches_tournament | Buscar juegos de torneo |
| tournament_participants | tournament_participants_tournament_id_user_id_key | Evitar duplicados |

---

## ⚠️ Restricciones Importante

### Validaciones
```
✓ Formatos válidos: bo1, bo3, bo5
✓ States válidos: según tabla
✓ Unique constraints evitan duplicados
✓ Foreign keys mantienen integridad referencial
✓ Cascadas de eliminación limpian datos relacionados
```

### Antes de Crear Series BO
```sql
-- Verificar participantes activos
SELECT COUNT(*) FROM tournament_participants 
WHERE tournament_id = $1 
  AND user_id IN ($player1_id, $player2_id)
  AND participation_status = 'active';
-- Debe retornar 2
```

### Antes de Registrar Resultado
```sql
-- Verificar que serie no esté completada
SELECT series_status FROM tournament_round_matches WHERE id = $series_id;
-- Debe ser 'in_progress'
```

---

## 📈 Flujo de Datos Típico

```
1. Usuario crea torneo
   └─ INSERT tournaments

2. Usuarios se registran
   └─ INSERT tournament_participants (status='pending')

3. Admin inicia torneo
   └─ UPDATE tournaments (status='in_progress')
   └─ UPDATE tournament_participants (status='active')

4. Crear ronda
   └─ INSERT tournament_rounds

5. Emparejar jugadores
   └─ INSERT tournament_round_matches

6. Crear juegos
   └─ INSERT tournament_matches (status='pending')

7. Jugar juegos y registrar resultados
   ├─ UPDATE tournament_matches (status='completed', winner_id)
   ├─ UPDATE tournament_round_matches (player1_wins/player2_wins)
   └─ Si wins_required alcanzado:
      └─ UPDATE tournament_participants (tournament_wins++)

8. Completar ronda
   └─ UPDATE tournament_rounds (status='completed')

9. Siguiente ronda o finalización
   ├─ Si hay más rondas: repite paso 4-8
   └─ Si es final: UPDATE tournaments (status='completed')
```

---

## 🎮 Ejemplo Ciclo Completo (Swiss BO3, 4 jugadores)

```
RONDA 1: A vs B (A gana 2-0) | C vs D (C gana 2-1)
         Rankings: A(1-0), C(1-0), B(0-1), D(0-1)

RONDA 2: A vs C (C gana 2-1) | B vs D (B gana 2-0)
         Rankings: C(2-0), A(1-1), B(1-1), D(0-2)

RONDA 3: C vs A (C gana 2-0) | B vs D (B gana 2-0)
         Rankings: C(3-0), B(2-1), A(1-2), D(0-3)

FINAL:   C vs B (BO5) → C gana 3-1
         CAMPEÓN: C
```

---

## 🛠️ Consideraciones de Implementación

### Para Crear Nuevas Rondas (Sistema)
1. Calcular emparejamientos según formato (swiss, eliminación, etc.)
2. Crear tournament_round_matches para cada pareja
3. Crear tournament_matches para cada juego en serie

### Para Registrar Resultados (Backend)
1. Verificar serie no completada
2. Actualizar tournament_matches
3. Actualizar tournament_round_matches
4. Si serie completa, actualizar tournament_participants

### Para Mostrar Standings (Frontend)
```sql
SELECT 
  ROW_NUMBER() OVER (ORDER BY wins DESC) as rank,
  nickname, wins, losses, points
FROM tournament_participants tp
JOIN users u ON tp.user_id = u.id
WHERE tp.tournament_id = $tournament_id
ORDER BY rank
```

---

## 📝 Campos Configurables por Torneo

| Campo | Tipo | Ejemplo |
|-------|------|---------|
| `tournament_type` | VARCHAR | 'swiss', 'elimination', 'round-robin' |
| `general_rounds_format` | VARCHAR | 'bo3' |
| `final_rounds_format` | VARCHAR | 'bo5' |
| `max_participants` | INTEGER | 32 |
| `round_duration_days` | INTEGER | 7 |
| `auto_advance_round` | BOOLEAN | true |

---

## 🚨 Errores Comunes

❌ **Error**: Crear juegos para una serie completada
```
✓ Verificar: WHERE series_status = 'in_progress'
```

❌ **Error**: Participante duplicado en torneo
```
✓ Constraint UNIQUE: (tournament_id, user_id)
```

❌ **Error**: Ronda sin torneo padre
```
✓ Constraint FK: tournament_id REFERENCES tournaments(id)
```

❌ **Error**: Serie completada sin ganador
```
✓ Lógica: Si player1_wins >= wins_required, player1_id es winner
```

---

## 📞 Consultas de Ayuda

### ¿Cuántas rondas en un torneo?
```sql
SELECT COUNT(DISTINCT round_number) FROM tournament_rounds 
WHERE tournament_id = $1;
```

### ¿Cuántas series en una ronda?
```sql
SELECT COUNT(*) FROM tournament_round_matches WHERE round_id = $1;
```

### ¿Progreso de una serie?
```sql
SELECT player1_wins, player2_wins, wins_required, series_status 
FROM tournament_round_matches WHERE id = $1;
```

### ¿Cuántos juegos jugados en serie?
```sql
SELECT COUNT(*) FROM tournament_matches 
WHERE tournament_round_match_id = $1 AND match_status = 'completed';
```

### ¿Ranking actual?
```sql
SELECT ROW_NUMBER() OVER (ORDER BY tournament_wins DESC) as rank,
       nickname, tournament_wins, tournament_losses
FROM tournament_participants tp
JOIN users u ON tp.user_id = u.id
WHERE tp.tournament_id = $1
ORDER BY rank;
```

---

## 📚 Referencias Cruzadas

| Documento | Sección | Tema |
|-----------|---------|------|
| STRUCTURE | 1.1 | Tabla tournaments completa |
| STRUCTURE | 1.4 | Tabla tournament_round_matches |
| DIAGRAMS | Flujo | Ciclo completo de torneo |
| EXAMPLES | 2 | Registrar resultados |
| EXAMPLES | 3.2 | Query progreso serie |
| EXAMPLES | 4 | Escenarios de negocio |

---

## 🎯 Próximos Pasos Recomendados

1. **Revisar TOURNAMENT_DATABASE_STRUCTURE.md** para entender tablas
2. **Ver TOURNAMENT_DIAGRAMS_AND_FLOWS.md** para visualizar flujos
3. **Consultar TOURNAMENT_EXAMPLES_AND_QUERIES.md** para implementar
4. **Usar este documento** como referencia rápida durante desarrollo

---

**Versión**: 1.0  
**Última actualización**: 14 de Diciembre, 2025  
**Database**: PostgreSQL  
**Status**: Completo y documentado
