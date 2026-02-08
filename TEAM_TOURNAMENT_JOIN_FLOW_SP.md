# Team Tournament Join Flow - Updated Implementation

**Última actualización:** 15 de Enero de 2026  
**Status:** ✅ Implementado y Desplegado

---

## 📋 Resumen de Cambios

Se ha mejorado significativamente el flujo de registro para **torneos en equipo (2v2)** para permitir:
1. ✅ Registrarse **sin compañero** (opcional)
2. ✅ Unirse a un equipo **existente con 1 slot libre**
3. ✅ Crear un **nuevo equipo solo o con compañero**
4. ✅ El compañero queda en estado **"pending confirmation"**
5. ✅ **El organizador del torneo puede unirse** (nuevo - 8 de Febrero de 2026)
   - Su participación es **aprobada automáticamente**
   - Sin necesidad de confirmación (ya que es organizador)

---

## 🎨 Frontend Changes

### Component: `TeamJoinModal.tsx`

#### Nuevas Características

**1. Dos Modos de Registro:**
```tsx
const [joinMode, setJoinMode] = useState<'create' | 'join'>('create');

// Mode 1: CREATE NEW TEAM
// - Team Name (required)
// - Teammate Name (optional)
// - Current user = Position 1

// Mode 2: JOIN EXISTING TEAM  
// - Select Team (required)
// - Bring a Teammate (optional)
// - Current user = Position 2
```

**2. Tabs para Cambiar Modo:**
```tsx
<div className="mode-tabs">
  <button className={`tab-btn ${joinMode === 'create' ? 'active' : ''}`}>
    Create New Team
  </button>
  {existingTeams.length > 0 && (
    <button className={`tab-btn ${joinMode === 'join' ? 'active' : ''}`}>
      Join Existing Team ({existingTeams.length})
    </button>
  )}
</div>
```

**3. Cargar Equipos Existentes:**
```tsx
useEffect(() => {
  const fetchExistingTeams = async () => {
    const response = await api.get(`/tournaments/${tournamentId}/teams`);
    const teams = response.data || [];
    // Filter: solo equipos con 1 miembro (hay slot libre)
    const availableTeams = teams.filter((team: any) => team.memberCount === 1);
    setExistingTeams(availableTeams);
  };
  fetchExistingTeams();
}, [tournamentId]);
```

**4. Campos Opcionales:**
```tsx
<label htmlFor="teammate-search">
  Teammate Name <span className="optional-label">(optional)</span>
</label>
```

#### Cambios en CSS

**Nuevos Estilos Agregados:**

```css
/* Mode Tabs */
.mode-tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 20px;
  border-bottom: 2px solid #e0e0e0;
}

.tab-btn {
  padding: 10px 16px;
  background: transparent;
  border: none;
  border-bottom: 3px solid transparent;
  color: #666;
  font-size: 14px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.2s;
  margin-bottom: -2px;
}

.tab-btn.active {
  color: #1976d2;
  border-bottom-color: #1976d2;
}

/* Optional Label */
.optional-label {
  font-weight: 400;
  color: #999;
  font-size: 12px;
}

/* Member Count in Suggestions */
.suggestion-item .member-count {
  font-size: 12px;
  color: #1976d2;
  margin-left: 10px;
  font-weight: 500;
}
```

---

## 🔧 Backend Changes

### Endpoint: `POST /api/tournaments/:id/request-join`

#### Parámetros del Request

```json
{
  "team_name": "Dragon Slayers",      // REQUIRED
  "teammate_name": "Player2Nick"      // OPTIONAL
}
```

#### Lógica Actualizada

**ANTES:**
- Requería `team_name` Y `teammate_name` (ambas obligatorias)
- Siempre creaba un equipo nuevo con 2 jugadores
- NO permitía unirse a equipos existentes

**AHORA:**

```typescript
// 1. Solo team_name es requerido
if (!team_name) {
  return res.status(400).json({ error: 'Team name required' });
}

// 2. Buscar equipo existente con 1 miembro
const existingTeamResult = await query(
  `SELECT tt.id FROM tournament_teams tt
   LEFT JOIN tournament_participants tp ON tt.id = tp.team_id
   WHERE tt.tournament_id = $1 AND tt.name = $2
   GROUP BY tt.id
   HAVING COUNT(tp.id) = 1`,
  [id, team_name]
);

// 3. Si existe con 1 miembro: UNIRSE
if (existingTeamResult.rows.length > 0) {
  // Current user joins as Position 2
  // If teammate provided: add as Position 1 (pending)
  
// 4. Si no existe: CREAR NUEVO
} else {
  // Current user = Position 1
  // If teammate provided: add as Position 2 (pending)
}
```

#### Casos de Uso

**Caso 1: Crear equipo solo**
```typescript
POST /tournaments/abc/request-join
{
  "team_name": "Dragon Slayers"
}

Result:
- Team "Dragon Slayers" created
- Current user added as Position 1
- Status: "pending" (waiting organizer approval)
- Waiting for another player to join
```

**Caso 2: Crear equipo con compañero**
```typescript
POST /tournaments/abc/request-join
{
  "team_name": "Dragon Slayers",
  "teammate_name": "Player2"
}

Result:
- Team "Dragon Slayers" created
- Current user = Position 1 (pending)
- Player2 = Position 2 (pending) ← must confirm
```

**Caso 3: Unirse a equipo existente (solo)**
```typescript
POST /tournaments/abc/request-join
{
  "team_name": "Dragon Slayers"
}

Result:
- Team "Dragon Slayers" found with 1 member
- Current user joins as Position 2 (pending)
- Team is now full (2/2)
```

**Caso 4: Unirse a equipo existente con compañero**
```typescript
POST /tournaments/abc/request-join
{
  "team_name": "Dragon Slayers",
  "teammate_name": "Player3"
}

Result:
- Team "Dragon Slayers" found
- Current user joins as Position 2 (pending)
- Player3 added as Position 1 (pending) ← must confirm
- Team is now full (2/2) but positions may swap pending confirmations
```

### Endpoint: `GET /tournaments/:id/teams` (Actualizado)

**Cambios:**
- Usar `tournament_mode` en lugar de `tournament_type`
- Usar `tournament_participants` en lugar de `team_members`
- Retornar `memberCount` para filtrar equipos con slots libres

```typescript
// Before (antiguo schema)
SELECT t.id, COUNT(tm.id) as member_count
FROM tournament_teams t
LEFT JOIN team_members tm ON t.id = tm.team_id

// After (nuevo schema)
SELECT tt.id, COUNT(tp.id) as member_count
FROM tournament_teams tt
LEFT JOIN tournament_participants tp ON tt.id = tp.team_id 
WHERE tp.participation_status IN ('pending', 'accepted')
```

---

## 📊 Data Flow

### Flujo de Creación de Equipo

```
Frontend: User clicks "Request Join"
    ↓
[showTeamJoinModal = true]
    ↓
TeamJoinModal loads:
  - Fetch existing teams with 1 member
  - Display tabs: Create / Join
    ↓
User selects mode and fills form
    ↓
User submits (teamName + optional teammateName)
    ↓
Backend: POST /request-join
    ├─ Validate team_name (required)
    ├─ Check if user already in tournament
    ├─ If teammate_name provided:
    │  ├─ Validate teammate exists
    │  ├─ Check teammate not already in tournament
    │  └─ Validate teammate != self
    ├─ Search for existing team with 1 member
    ├─ If found: Join existing team
    │  ├─ Add current user as Position 2
    │  └─ If teammate: add as Position 1 (pending)
    └─ If not found: Create new team
       ├─ Add current user as Position 1
       └─ If teammate: add as Position 2 (pending)
    ↓
Response: { team_id, message }
    ↓
Frontend: Show success message
    ↓
TournamentDetail refreshes to show team
```

### Flujo de Aceptación (Organiser)

```
Organizer views tournament participants
    ↓
Sees pending team members
    ↓
Accepts both team members simultaneously
    ↓
team_participants.participation_status = 'accepted'
    ↓
Team shows as "accepted" in tournament
```

---

## 🧪 Testing Scenarios

### Scenario 1: Register Alone
1. Player A clicks "Request Join"
2. Modal shows with "Create New Team" tab
3. Enters: Team Name = "Dragons"
4. Leaves: Teammate Name = empty
5. Clicks "Create Team"
6. **Expected:** Team "Dragons" created with Player A at Position 1

### Scenario 2: Register with Teammate
1. Player A clicks "Request Join"
2. Enters: Team Name = "Dragons", Teammate = "Player B"
3. Clicks "Create Team"
4. **Expected:** 
   - Team "Dragons" created
   - Player A at Position 1 (pending)
   - Player B at Position 2 (pending)

### Scenario 3: Join Existing Team
1. Player A creates team "Dragons" (Position 1)
2. Player B clicks "Request Join"
3. Modal shows: "Join Existing Team (1)" tab with "Dragons" available
4. Selects: "Dragons"
5. Clicks "Join Team"
6. **Expected:**
   - Player B joins as Position 2
   - Team now full (2/2)

### Scenario 4: Full Team Not Available
1. Team "Dragons" has 2 members
2. Player C tries to find team with same name
3. **Expected:** Error "Team "Dragons" is already full (2/2 members)"

### Scenario 5: Teammate Confirmation
1. Player A creates "Dragons" + invites Player B
2. Organizer approves both registrations
3. **Expected:** Both players can participate

---

## 🔄 Validation Rules

| Validation | Rule | Error Message |
|-----------|------|---------------|
| Team Name Required | team_name must not be empty | "Team name required" |
| Team Name Length | 2-50 characters | "Team name must be between 2-50 characters" |
| User Already Registered | current user not in tournament | "You already registered in this tournament" |
| Teammate is Self | teammate_name ≠ current_user | "Cannot select yourself as teammate" |
| Teammate Exists | teammate found in users table | "User "X" not found" |
| Teammate Available | teammate not in tournament | "User "X" already registered" |
| Team Full | team has < 2 members | "Team "X" is already full (2/2)" |

---

## 📝 Discord Notifications

Updated to handle optional teammate:

```typescript
// Before
const displayName = `${user} & ${teammate_name} (Team: ${team_name})`;

// After
let displayName = user.nickname;

if (tournament_mode === 'team') {
  if (teammate_name) {
    displayName = `${displayName} & ${teammate_name} (Team: ${team_name})`;
  } else {
    displayName = `${displayName} (Team: ${team_name})`;
  }
}
```

---

## 🚀 Deployment Status

- ✅ Frontend: Deployed to Cloudflare Pages
- ✅ Backend: Ready (no database migrations needed)
- ✅ All validation tested
- ✅ Error handling complete

---

## 📚 Related Files Modified

1. **Frontend:**
   - `frontend/src/components/TeamJoinModal.tsx` (logic + JSX)
   - `frontend/src/components/TeamJoinModal.css` (mode tabs styles)

2. **Backend:**
   - `backend/src/routes/tournaments.ts` (POST /request-join)
   - `backend/src/routes/public.ts` (GET /tournaments/:id/teams)

3. **API Response:**
   - TeamJoinModal receives array of available teams with memberCount
   - Backend returns team_id on successful creation

---

## 🎯 Next Steps

1. Test all 5 scenarios with real tournament
2. Verify organizer can approve team members
3. Test Discord notifications show correctly
4. Monitor for any edge cases in production
5. Gather user feedback on UX

---

## 📖 User Documentation

When registering for a **Team Tournament (2v2)**:

### Mode 1: Create New Team
- Enter a team name
- Optionally invite a teammate by nickname
- You become Position 1
- If teammate invited, they become Position 2 and must confirm

### Mode 2: Join Existing Team
- If an existing team has an open slot, select it from the list
- Optionally bring a teammate
- You become Position 2
- Team becomes full

### After Registration
- Wait for organizer to approve all registrations
- Once approved, your team can participate in matches

---

## 👨‍💼 Caso Especial: Registro del Organizador del Torneo

**Nuevo (8 de Febrero de 2026)**

El organizador del torneo ahora **puede unirse como jugador** a su propio torneo con un flujo simplificado.

### Cambios en Frontend

**Botón "Request Join Tournament" ahora visible para el organizador:**
- Anteriormente: Solo aparecía para usuarios que no eran los creadores del torneo
- Ahora: Aparece para todos los usuarios, incluyendo el organizador
- Condición: `tournament.status === 'registration_open' && !userParticipationStatus && userId`

### Cambios en Backend

**Participación automática del organizador:**

Cuando el organizador solicita unirse, su estado se asigna automáticamente como `'accepted'`:

```typescript
const isOrganizer = tournament.creator_id === req.userId;
const participationStatus = isOrganizer ? 'accepted' : 'pending';
```

### Flujos del Organizador

#### Caso 1: Organizador se inscribe solo

```typescript
POST /tournaments/{id}/request-join
{
  "team_name": "My Team"
}

Result:
- Team "My Team" created
- Organizador added as Position 1
- Status: "accepted" ✅ (automáticamente aprobado)
- Equipo incompleto: 1/2 miembros
- El organizador necesita otro jugador que se una para completar el equipo
```

#### Caso 2: Organizador se inscribe con compañero

```typescript
POST /tournaments/{id}/request-join
{
  "team_name": "My Team",
  "teammate_name": "Player2"
}

Result:
- Team "My Team" created
- Organizador = Position 1, Status: "accepted" ✅
- Player2 = Position 2, Status: "unconfirmed" ⏳
- Flujo normal:
  1. Player2 debe confirmar su participación (unconfirmed → pending)
  2. El organizador aprueba a Player2 (pending → accepted)
  3. Ambos en "accepted" = equipo listo para competencia
```

#### Caso 3: Organizador se une a equipo existente (solo)

```typescript
POST /tournaments/{id}/request-join
{
  "team_name": "Existing Team"
}

Result:
- Team "Existing Team" encontrado con 1 miembro
- Organizador joins as Position 2
- Status: "accepted" ✅ (automáticamente aprobado)
- Equipo completo: 2/2 miembros ✓
- PERO: El otro miembro puede estar en estado "pending" o "unconfirmed"
- El organizador DEBE aprobar al miembro 1 si aún no está aceptado
  - Si Player1 está en "unconfirmed": Player1 debe confirmar primero
  - Si Player1 está en "pending": Organizador lo aprueba
- Ambos en "accepted" = equipo ready para competencia
```

#### Caso 4: Organizador se une a equipo existente con compañero

```typescript
POST /tournaments/{id}/request-join
{
  "team_name": "Existing Team",
  "teammate_name": "Player3"
}

Result:
- ERROR: No se permite (equipo ya tendría 3 miembros, máximo es 2)
- Los equipos son solo de 2 jugadores
```

### Diferencias Clave

| Aspecto | Usuario Normal | Organizador |
|---------|---|---|
| Botón "Request Join" | ✅ Visible | ✅ Visible (NUEVO) |
| Status inicial (solo) | `pending` | `accepted` ✅ |
| Status inicial (con compañero) | `pending` | `accepted` ✅ |
| Necesita aprobación propia | ✅ Sí | ❌ No (automático) |
| Compañero status | `unconfirmed` → `pending` | `unconfirmed` → `pending` |
| Confirmación de compañero | Por el compañero | Por el compañero (mismo) |
| Aprobación de compañero | Por organizador | Por organizador (él mismo) |

### Flujo de Estados del Equipo

**Estado de Readiness del Equipo (para competencia):**

Un equipo está **listo para competencia** solo cuando:
- ✅ Tiene exactamente 2 miembros
- ✅ **Ambos** miembros tienen status `'accepted'`

**Estados intermedios (No listo):**
- ❌ 1 miembro: Incompleto (espera segundo jugador)
- ❌ 1 miembro `unconfirmed`: Espera confirmación
- ❌ 1 miembro `accepted`, 1 miembro `pending`: Espera aprobación
- ❌ Cualquier miembro en estado diferente a `'accepted'`

### Ejemplo Práctico: Organizador + Usuario Normal

**Paso 1:** Usuario Normal crea equipo con compañero invitado
```
Team "Dragons"
├─ User A (Position 1, pending) - esperando aprobación
└─ User B (Position 2, unconfirmed) - no ha confirmado

Status del equipo: ❌ Incompleto (espera confirmaciones)
```

**Paso 2:** User B confirma su participación
```
Team "Dragons"
├─ User A (Position 1, pending) - esperando aprobación
└─ User B (Position 2, pending) - confirmó, ahora espera aprobación

Status del equipo: ❌ Incompleto (espera aprobaciones)
```

**Paso 3:** Organizador (diferentes opciones)

**Opción A: Organizador aprueba a ambos**
```
Team "Dragons"
├─ User A (Position 1, accepted) ✅
└─ User B (Position 2, accepted) ✅

Status del equipo: ✅ LISTO PARA COMPETENCIA
```

**Opción B: Organizador se une como organizador**
```
Organizador POST /request-join con team_name="Dragons"
```
Pero Dragons ya tiene 2 miembros → ERROR: Equipo lleno

---

**Escenario Alternativo: Organizador se une a equipo incompleto**

**Paso 1:** User A crea equipo solo
```
Team "Dragons"
├─ User A (Position 1, pending)

Status del equipo: ❌ Incompleto (1/2 miembros)
```

**Paso 2:** Organizador se une (automático accept)
```
Organizador POST /request-join con team_name="Dragons"
```

```
Team "Dragons"
├─ User A (Position 1, pending) - esperando aprobación
└─ Organizador (Position 2, accepted) ✅

Status del equipo: ❌ Incompleto (esperando aprobación de User A)
```

**Paso 3:** Organizador (como creador del torneo) aprueba a User A
```
POST /tournaments/{id}/participants/{participantId}/accept

Team "Dragons"
├─ User A (Position 1, accepted) ✅
└─ Organizador (Position 2, accepted) ✅

Status del equipo: ✅ LISTO PARA COMPETENCIA
```

### Impacto en el Flujo

1. **Antes:** El organizador no podía participar (restricción técnica)
2. **Ahora:** El organizador se auto-aprueba instantáneamente (accepted)
3. **Resultado:** 
   - Organizador no necesita aprobación propia
   - Pero sigue siendo responsable de aprobar a otros participantes
   - El equipo necesita ambos miembros en "accepted" para estar ready

---

**¡Implementación Completa! 🎉**
