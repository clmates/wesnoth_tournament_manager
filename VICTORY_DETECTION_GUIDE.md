# 🏆 Detección de Condición de Victoria en Replays

## Orden de Prioridades (Confidence Level)

El parser determina la victoria en este orden:

### 1. **Explicit Endlevel Result** ⭐⭐ (HIGHEST - AUTO REPORT)
```
[endlevel]
    result="victory"
    side="1"           ← Winner is side 1
[/endlevel]
```
- **Método:** Busca bloque `[endlevel]` con `result="victory"`
- **Confianza:** ALTÍSIMA - Comando explícito del servidor
- **Tipo reportado:** `explicit_victory`
- **Confidence_level:** 2 (AUTO: Sin confirmación manual)

---

### 2. **Resignation (Dimisión)** ⭐⭐ (HIGH - AUTO REPORT)
```
[endlevel]
    result="resign"
    side="2"           ← Side 2 renunció → Winner es side 1
[/endlevel]
```
- **Método:** Busca `[endlevel]` con `result="resign"` + `side` del perdedor
- **Lógica:** En 2 players, el ganador es el lado opuesto
- **Confianza:** ALTA - Acción de jugador registrada
- **Tipo reportado:** `resignation`
- **Confidence_level:** 2 (AUTO: Sin confirmación)

---

### 3. **Server Surrender Message** ⭐⭐ (MEDIUM-HIGH - AUTO REPORT)
```
[command]
    [speak]
        id="server"
        message="StonyDrew has surrendered."    ← Patrón clave
    [/speak]
[/command]
```
- **Método:** Busca mensajes en raw WML: `message="PlayerName has surrendered."`
- **Lógica:** Extrae nombre del jugador que se rindió → Lado opuesto gana
- **Confianza:** MEDIA-ALTA - Mensaje del servidor de Wesnoth
- **Tipo reportado:** `surrender`
- **Confidence_level:** 2 (AUTO: Claro registro de servidor)
- **Caso Real:** Replay "2p__Hamlets_Turn_21_(91653)" usa este método
  ```
  message="StonyDrew has surrendered."
  → StonyDrew estaba en side 1
  → Megac1 (side 2) es el ganador
  ```

---

### 4. **Default/Fallback** ⚠️ (LOWEST - NEEDS MANUAL CONFIRMATION)
```
Si no se detecta ninguno de los anteriores:
→ Asumir ganador = Jugador en Side 1
```
- **Método:** Último recurso cuando no hay info explícita
- **Confianza:** BAJA - Suposición
- **Tipo reportado:** `fallback`
- **Confidence_level:** 1 (MANUAL: Admin DEBE confirmar)
- **Casos:**
  - Replay incompleto/corrupto
  - Partida en progreso (sin endlevel)
  - Condición de victoria personalizada no reconocida

---

## Ejemplo: Replay "2p__Hamlets_Turn_21_(91653)"

```
ANÁLISIS DE VICTORIA
═══════════════════════════════════════════════════════════════════

1️⃣  EXPLICIT ENDLEVEL
    ✗ NOT FOUND: No [endlevel] block
    
2️⃣  RESIGNATION
    ✗ NOT FOUND: No [resign] action
    
3️⃣  SERVER SURRENDER MESSAGE
    ✓ FOUND: "StonyDrew has surrendered."
    → Linea 25233 en archivo
    → StonyDrew = Side 1
    → Megac1 = Side 2 (WINNER)
    
4️⃣  FALLBACK
    (no usado - ya detectado en #3)

═══════════════════════════════════════════════════════════════════
RESULTADO: Megac1 victorioso
Método: Server Surrender Message
Confidence: MEDIUM-HIGH (Auto-report)
```

---

## Registro de Debug en Logs

Cuando se procesa un replay, el parser muestra:

```typescript
[DEBUG] Surrender detected: "StonyDrew" (side 1) → Winner: side 2

[DEBUG] Replay Parse Results for 2p__Hamlets_Turn_21_(91653):
{
    map: "Hamlets",
    players_count: 2,
    players: [
        { side: 1, name: "StonyDrew", faction: "Custom" },
        { side: 2, name: "Megac1", faction: "Custom" }
    ],
    endlevel_detected: false,
    victory_result_type: "surrender",
    victory_winner_side: 2,
    victory_winner_name: "Megac1"
}
```

---

## Handling de Reloads

Cuando una partida se pausa/recarga, Wesnoth escribe MÚLTIPLES bloques:

```
[scenario] ... primera inicialización
[side]side=1 ... inicial StonyDrew
[side]side=2 ... inicial Megac1

... muchas acciones ...

[scenario] ... DESPUÉS del reload (estado post-pausa)
[side]side=1 ... estado actualizado de StonyDrew
[side]side=2 ... estado actualizado de Megac1

[speak]message="StonyDrew has surrendered."... DESPUÉS del reload
```

**Solución implementada:**
- Parser toma el **ÚLTIMO** `[scenario]` block (valor post-reload) ✓
- Parser toma el **ÚLTIMO** `[side]` para cada side number ✓
- Busca mensajes de surrender en TODO el archivo ✓

---

## Casos Especiales

### Partida Incompleta
- Sin `[endlevel]` → Fallback a Side 1
- **Confidence: 1 (MANUAL CONFIRMATION NEEDED)**
- Aparece en DB como: `need_integration=true, integration_confidence=1`

### Partida con Crash/Desconexión
- Si hay mensaje de surrender incompleto → Fallback
- Si hay `[endlevel]` pero corrupto → Fallback
- **Confidence: 1**

### Partida Normal (Victoria estándar)
- Busca `[endlevel]result="victory" side="X"`
- **Confidence: 2 (AUTO)**

---

## Integración en Base de Datos

```sql
UPDATE replays 
SET 
    need_integration = (confidence == 1 ? true : false),
    integration_confidence = 1 | 2,
    parse_summary = "victory_type | winner_name | confidence"
WHERE id = replay_id;
```

Campos relevantes:
- `need_integration`: `true` si confidence=1 (necesita confirmación)
- `integration_confidence`: 1=manual required, 2=auto report
- `parse_summary`: Texto con detalles de la victoria

---

## ¿Cuándo Necesita el Admin Confirmación?

```
integration_confidence = 1 CUANDO:
├─ No hay [endlevel] explícito
├─ El replay está incompleto
├─ No hay surrender message detectado
├─ Hay discrepancias en los datos
└─ Custom victory condition no reconocida
```

El admin verá estas partidas en la sección **"Partidas Pendientes de Confirmación"** del dashboard.

