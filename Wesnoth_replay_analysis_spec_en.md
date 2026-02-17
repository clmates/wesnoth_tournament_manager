
# Technical Document  
## Processing and Analysis of Battle for Wesnoth Replays

---

# 1. Introduction

This document describes how to design a system to process Wesnoth replay files (`.gz`) and automatically extract:

- Players
- Each player's faction
- Add-ons used
- Map
- Era
- Winning player
- Victory conditions

The goal is to provide a clear technical foundation for implementing a robust, production-ready replay parser.

---

# 2. Replay Technical Model

A Wesnoth replay:

- Is a compressed `.gz` file
- Contains text written in **WML (Wesnoth Markup Language)**
- Stores:
  - Initial game state
  - Scenario definition
  - Side (player) definitions
  - Turn-by-turn events
  - Final result

## 2.1 General Structure

Typical structure:

```
[replay]
    version="1.18.x"

    [scenario]
        ...
    [/scenario]

    [side]
        ...
    [/side]

    [turn]
        ...
    [/turn]

    [event]
        ...
    [/event]

    [endlevel]
        ...
    [/endlevel]
[/replay]
```

A replay is not a video. It is a deterministic sequence of game logic that the engine can reproduce.

---

# 3. Recommended Architecture

## General Workflow

1. Decompress `.gz`
2. Parse WML → convert into structured tree
3. Extract metadata
4. Build internal data model
5. Analyze final events
6. Determine winner and victory condition

---

# 4. Recommended Data Structure

```json
ReplayAnalysis {
  metadata: {
    version: string,
    scenario_id: string,
    scenario_name: string,
    map_file: string,
    era_id: string
  },

  addons: [
    {
      id: string,
      version: string,
      required: boolean
    }
  ],

  players: [
    {
      side: int,
      name: string,
      faction_id: string,
      faction_name: string,
      leader_id: string,
      leader_type: string,
      controller: string
    }
  ],

  victory: {
    winner_side: int,
    winner_name: string,
    result_type: string,
    detected_from: string
  }
}
```

---

# 5. Element Detection

## Version
Search at root level:
`version="1.18.x"`

## Map
Inside `[scenario]`:
- `id`
- `name`
- `map_file`

## Era
Search for:
`era=...` or `[era]` block

## Add-ons
Look for:

```
[addon]
    id=...
    version=...
    required=yes
[/addon]
```

## Players
`[side]` blocks:
- side
- name
- controller
- faction

## Leader
Unit with:
`canrecruit=yes`

## Winner
Final block:

```
[endlevel]
    result=victory
    side=X
[/endlevel]
```

## Victory Conditions

Detection priority:

1. `[result=resign]`
2. `controller=null`
3. `[die]` event of unit with `canrecruit=yes`
4. Only `[endlevel]` → assume leader kill (standard multiplayer)

---

# 6. Recommended Algorithm

1. Parse WML
2. Extract metadata
3. Build players[]
4. Locate [endlevel]
5. Determine winner_side
6. Analyze previous events
7. Classify result_type

---

# 7. Important Considerations

- Not all replays store every explicit event.
- Multiplayer may omit explicit `[die]` blocks.
- Do not assume a single universal victory condition.

---

# 8. Future Extensions

- Turn count
- Starting gold
- Recruitment timeline
- Combat statistics
- Critical event timeline

---

# 9. Conclusion

A Wesnoth replay can be analyzed deterministically if:

- WML is parsed correctly
- Event hierarchy is respected
- Victory detection rules are applied in priority order
- The internal structure is properly modeled
