# Sistema de Abandono de Jugador en Torneos

## Resumen de Implementación

Se ha implementado un sistema completo que permite a los organizadores de torneos manejar situaciones donde un jugador abandona durante una ronda, asignando la victoria al otro jugador sin afectar el ELO global pero otorgando puntos en el torneo.

---

## 1. Base de Datos

### Migración: `20251222_add_organizer_action_to_tournament_matches.sql`

```sql
ALTER TABLE tournament_matches 
ADD COLUMN organizer_action VARCHAR(50) DEFAULT NULL 
CHECK (organizer_action IN ('organizer_win', 'organizer_loss'));

CREATE INDEX idx_tournament_matches_organizer_action ON tournament_matches(organizer_action);
```

**Propósito:**
- Registra cuando el organizador asigna manualmente una victoria debido a abandono
- Permite auditar las acciones del organizador
- No afecta al ELO global (el match nunca se reporta en la tabla `matches`)

---

## 2. Backend

### Endpoint Mejorado: `POST /api/tournaments/:tournamentId/matches/:matchId/determine-winner`

**Ubicación:** `backend/src/routes/tournaments.ts` (línea ~1603)

**Funcionalidad:**
1. **Validación:** Solo el organizador del torneo puede usar este endpoint
2. **Actualización de Match:** 
   - Marca el match como completado
   - Registra la acción como `organizer_action = 'organizer_win'` o `'organizer_loss'`
   - NO reporta el match a nivel global (no afecta ELO)

3. **Manejo de Series BO (Best Of):**
   - Si es una serie BO3/BO5 incompleta, automáticamente marca los games restantes como ganados por el vencedor
   - Actualiza `tournament_round_matches` con los wins y el estado de la serie

4. **Recálculo de Puntuación:**
   - Actualiza `tournament_participants` con los puntos ganados
   - Recalcula la clasificación del torneo

5. **Validación de Ronda:**
   - Verifica si la ronda está completada
   - Ejecuta `checkAndCompleteRound` automáticamente

### Flujo de Lógica:

```
1. Organizador selecciona ganador en modal
   ↓
2. Backend recibe POST con winner_id
   ↓
3. Valida que sea el organizador
   ↓
4. Actualiza tournament_matches
   - winner_id = X
   - organizer_action = 'organizer_win'
   ↓
5. Si hay tournament_round_match (serie BO):
   a. Obtiene información de la serie
   b. Incrementa player_wins para el ganador
   c. Si wins_required alcanzado:
      - Marca serie como 'completed'
      - Marca todos los matches pendientes como ganados
   d. Actualiza tournament_round_matches
   ↓
6. Recalcula tournament_participants scores
   ↓
7. Completa ronda si es necesario
```

---

## 3. Frontend

### Componente: `TournamentDetail.tsx`

**Cambios:**
1. Modal mejorado con mensajes claros sobre abandono
2. Traducciones agregadas en 5 idiomas
3. Interfaz intuitiva para asignar ganador

### Modal de Determinación de Ganador:

**Ubicación:** Línea ~1282 en `TournamentDetail.tsx`

**Elementos:**
- Título: "Determine Winner / Player Abandoned"
- Descripción del proceso
- Dos botones: uno para cada jugador
- Nota sobre el impacto (no ELO, sí puntos del torneo)

### Flujo UI:

```
1. Organizador ve Round en estado 'completed'
   ↓
2. Match sin ganador → Botón "Determine Winner" visible
   ↓
3. Clic en botón abre modal
   ↓
4. Organizador selecciona ganador
   ↓
5. POST a /api/tournaments/:id/matches/:matchId/determine-winner
   ↓
6. UI se actualiza:
   - Match ahora aparece en "Completed Matches"
   - Muestra badge "ADMIN" (acción de organizador)
   - Puntos del jugador ganador se actualizan
   ↓
7. Si ronda completa → Status pasa a 'completed'
```

---

## 4. Traducciones Agregadas

Se agregaron en todos los idiomas soportados (EN, ES, DE, ZH, RU):

```json
{
  "tournaments.player_abandoned": "Texto del idioma",
  "tournaments.abandonment_note": "Explicación detallada"
}
```

**Idiomas:**
- 🇬🇧 Inglés (en.json)
- 🇪🇸 Español (es.json)
- 🇩🇪 Alemán (de.json)
- 🇨🇳 Chino (zh.json)
- 🇷🇺 Ruso (ru.json)

---

## 5. Flujo Operativo Completo

### Escenario: Jugador Abandona en Ronda Incompleta

**Paso 1: Ronda Activa**
- Round status = 'in_progress'
- Match status = 'pending'
- Varios matches ya reportados, algunos pendientes

**Paso 2: Jugador Abandona**
- Organizador abre Tournament Detail
- Va a tab "Matches" → Scheduled Matches → Encuentra match con jugador que abandonó
- Hace clic en botón "Determine Winner"

**Paso 3: Modal de Determinación**
- Se abre modal mostrando:
  ```
  Player 1 vs Player 2
  
  Select the winner. If a player abandoned, their opponent 
  automatically wins all remaining matches (no ELO impact, 
  tournament points awarded).
  
  [Button: Player 1 Wins] [Button: Player 2 Wins]
  ```

**Paso 4: Backend Procesa**
- Marca match como completado
- Registra como `organizer_action`
- Si serie BO: marca games restantes como ganados
- Actualiza puntos en tournament_participants
- Valida que ronda esté completa

**Paso 5: UI Se Actualiza**
- Match desaparece de "Scheduled Matches"
- Aparece en "Completed Matches" con badge "ADMIN"
- Puntos del ganador se actualizan en tab "Ranking"
- Clasificación del torneo se recalcula

**Paso 6: Verificación**
- Si todos los matches de la ronda están completados
- Round status → 'completed'
- Organizador puede iniciar siguiente ronda

---

## 6. Campos Base de Datos

### tournament_matches

| Campo | Tipo | Propósito |
|-------|------|-----------|
| `organizer_action` | VARCHAR(50) | 'organizer_win', 'organizer_loss', o NULL |
| `winner_id` | UUID | ID del ganador |
| `match_status` | VARCHAR | 'pending', 'completed', 'cancelled' |

### tournament_round_matches

| Campo | Propósito |
|-------|-----------|
| `player1_wins` | Actualizado cuando se asigna victoria |
| `player2_wins` | Actualizado cuando se asigna victoria |
| `series_status` | 'in_progress' → 'completed' |
| `winner_id` | ID del ganador de la serie BO |

### tournament_participants

| Campo | Propósito |
|-------|-----------|
| `points` | Recalculado cuando hay abandono |
| `tournament_wins` | Se incrementa |

---

## 7. Seguridad y Restricciones

✅ **Solo el organizador** puede usar `determine-winner`
✅ **No afecta ELO global** (match nunca se reporta en tabla `matches`)
✅ **Auditable** (campo `organizer_action` registra la acción)
✅ **Valida jugadores** (el ganador debe ser uno de los dos participantes)
✅ **Maneja series** (automáticamente completa BO3/BO5)

---

## 8. Casos de Uso Cubiertos

| Caso | Resultado |
|------|-----------|
| Jugador no aparece en match | Organizador asigna victoria al otro |
| Jugador abandona a mitad de BO3 | Marca BO3 como completo, gana el otro |
| Jugador abandona toda la ronda | Todas sus partidas pendientes se pierden |
| Múltiples abandonos en una ronda | Cada uno se maneja independientemente |

---

## 9. Testing Recomendado

```javascript
// POST /api/tournaments/:id/matches/:matchId/determine-winner
{
  "winner_id": "player_uuid_here"
}

// Verificar:
1. ✓ Match status = 'completed'
2. ✓ organizer_action = 'organizer_win' / 'organizer_loss'
3. ✓ tournament_round_matches actualizado si existe
4. ✓ tournament_participants.points recalculado
5. ✓ ELO global NO cambiado
6. ✓ Round completada si todos los matches listos
```

---

## 10. Notas Importantes

- **No requiere reportar match:** El sistema NO crea un entry en tabla `matches`
- **Series BO automáticas:** Si BO3/BO5, se marcan automáticamente games restantes
- **Puntos correctos:** Se recalculan basándose en series ganadas, no en matches individuales
- **Auditable:** Campo `organizer_action` permite ver qué fue asignado por organizador
- **Multiidioma:** Soporta EN, ES, DE, ZH, RU con mensajes claros

---

## 11. Migración a Producción

```bash
# 1. Ejecutar migración en BD
psql -d production_db -f backend/migrations/20251222_add_organizer_action_to_tournament_matches.sql

# 2. Compilar backend
cd backend && npm run build

# 3. Desplegar cambios frontend/backend

# 4. Verificar columna existe
SELECT column_name FROM information_schema.columns 
WHERE table_name='tournament_matches' AND column_name='organizer_action';
```

---

**Implementación Completada:** ✅
**Fecha:** 2025-12-22
**Estado:** Listo para uso en producción
