# Implementation Status: Unranked & Team Tournaments

**Fecha del análisis:** 11 de Enero de 2026  
**Rama actual:** feature/unranked-tournaments  
**Estado general:** PARCIALMENTE IMPLEMENTADO

---

## ✅ YA EXISTE

### Backend Endpoints (admin.ts)
- ✅ `GET /admin/unranked-factions` - Obtiene todas las facciones sin ranking
- ✅ `POST /admin/unranked-factions` - Crea nueva facción sin ranking
- ✅ `GET /admin/unranked-factions/:id/usage` - Verifica uso en torneos antes de eliminar
- ✅ `DELETE /admin/unranked-factions/:id` - Elimina facción sin ranking (con validaciones)
- ✅ `GET /admin/unranked-maps` - Obtiene todos los mapas sin ranking
- ✅ `POST /admin/unranked-maps` - Crea nuevo mapa sin ranking
- ✅ `GET /admin/unranked-maps/:id/usage` - Verifica uso en torneos antes de eliminar
- ✅ `DELETE /admin/unranked-maps/:id` - Elimina mapa sin ranking (con validaciones)

### Backend Endpoints (public.ts)
- ✅ `GET /tournaments/:id/unranked-assets` - Endpoint público que devuelve facciones y mapas disponibles para torneos sin ranking

### Base de Datos (Migration 20260112)
- ✅ `factions.is_ranked` - Columna para clasificar facciones (true=ranked, false=unranked)
- ✅ `game_maps.is_ranked` - Columna para clasificar mapas (true=ranked, false=unranked)
- ✅ `tournaments.tournament_type` - Columna con valores: 'ranked', 'unranked', 'team'
- ✅ `tournaments.tournament_type` - CHECK constraint validando solo valores permitidos
- ✅ `matches.tournament_type` - Columna para guardar tipo en momento del match
- ✅ `tournament_unranked_factions` - Tabla de asociación entre torneos y facciones
- ✅ `tournament_unranked_maps` - Tabla de asociación entre torneos y mapas
- ✅ Índices para queries eficientes en ambas tablas

### Frontend Components
- ✅ `UnrankedFactionSelect.tsx` - Componente selector de facciones sin ranking
- ✅ `UnrankedMapSelect.tsx` - Componente selector de mapas sin ranking
- ✅ `UnrankedFactionSelect.css` - Estilos para selector de facciones
- ✅ `UnrankedMapSelect.css` - Estilos para selector de mapas

### Frontend Pages - Tournament Management
- ✅ `MyTournaments.tsx` - Formulario de creación con `tournament_type` dropdown:
  - ✅ Radio buttons/dropdown para seleccionar tipo ('elimination', 'league', 'swiss', 'swiss_elimination')
  - ✅ Configuración de rondas según tipo de torneo
  - ✅ Soporte para lógica de configuración por tipo
- ✅ `TournamentDetail.tsx` - Página de detalle del torneo:
  - ✅ Muestra `tournament.tournament_type`
  - ✅ Soporte para endpoints públicos

### Frontend Components - Match Reporting
- ✅ `TournamentMatchReportModal.tsx` - Modal para reportar resultados de matches de torneo:
  - ✅ Carga mapas desde API (`/public/maps`)
  - ✅ Carga facciones desde API (`/public/factions`)
  - ✅ Validación que map y facciones sean requeridos
  - ✅ Envía `tournament_id` y `tournament_match_id` en reporte
  - ⚠️ NO tiene validaciones específicas para torneos unranked/team

### Frontend Components - Reported Matches
- ✅ `MatchConfirmationModal.tsx` - Modal de confirmación de matches
- ✅ `MatchDetailsModal.tsx` - Modal de detalles de matches

---

## ❌ FALTA IMPLEMENTAR

### 1. Backend - Endpoints para Torneos de Equipo (Team)
- ❌ `GET /admin/team-tournaments` - Listar torneos de equipo
- ❌ `POST /admin/team-tournaments/:id/teams` - Crear equipo en torneo
- ❌ `PUT /admin/team-tournaments/:id/teams/:teamId` - Actualizar equipo
- ❌ `DELETE /admin/team-tournaments/:id/teams/:teamId` - Eliminar equipo
- ❌ `POST /admin/team-tournaments/:id/teams/:teamId/members` - Agregar miembro a equipo
- ❌ `DELETE /admin/team-tournaments/:id/teams/:teamId/members/:playerId` - Remover miembro de equipo
- ❌ `GET /tournaments/:id/teams` - Endpoint público para obtener equipos de torneo

### 2. Backend - Endpoints para Validaciones de Torneos
- ❌ Validación en `POST /tournaments` para verificar tournament_type
- ❌ Lógica para cargar mapas/facciones según tournament_type en endpoints de tournament
- ❌ Actualización de endpoints de matches para considerar tournament_type

### 3. Backend - Estructura de Datos para Equipos
- ❌ Tabla `teams` (id, tournament_id, name, created_at)
- ❌ Tabla `team_members` (id, team_id, player_id, role, joined_at)
- ❌ Tabla `team_tournament_matches` (para 2v2, almacenar team_id en lugar de player_id)
- ❌ Actualización de `tournament_matches` para soportar team_id

### 4. Frontend - Componentes para Configuración de Torneos Unranked/Team
- ❌ **UnrankedTournamentConfig.tsx** - Componente para seleccionar facciones/mapas en MyTournaments.tsx
- ❌ **TeamTournamentSetup.tsx** - Componente para crear y configurar equipos
- ❌ **Actualización en MyTournaments.tsx**:
  - Mostrar selectores de facciones/mapas cuando tournament_type === 'unranked'
  - Mostrar interfaz de creación de equipos cuando tournament_type === 'team'

### 5. Frontend - Componentes para Reporte de Matches en Torneos
- ❌ **Validaciones en TournamentMatchReportModal.tsx**:
  - Para torneos `unranked`: cargar facciones/mapas del endpoint `/tournaments/:id/unranked-assets`
  - Para torneos `team`: adaptar modal para 2v2 (2 jugadores por lado)
  - Mostrar validaciones específicas según tournament_type

### 6. Frontend - Interfaces de Visualización de Torneos
- ❌ **Actualización en TournamentDetail.tsx**:
  - Para `tournament_type === 'unranked'`: mostrar etiqueta/badge distintivo
  - Para `tournament_type === 'team'`: mostrar teams en lugar de participantes individuales
  - Adaptar tabla de resultados para 2v2
- ❌ **Actualización en TournamentList.tsx**:
  - Filtro por tournament_type
  - Mostrar icono/badge para unranked y team tournaments
- ❌ **Actualización en MyTournaments.tsx**:
  - Mostrar tournament_type en lista de torneos creados

### 7. Frontend - Componentes Específicos para Team Tournaments
- ❌ **TeamSelector.tsx** - Selector de compañero de equipo
- ❌ **TeamStandings.tsx** - Tabla de posiciones de equipos
- ❌ **TeamMatchDetails.tsx** - Detalle de match 2v2 con información de ambos jugadores

### 8. Frontend - Validaciones en MatchReport
- ❌ Validaciones en `ReportMatch.tsx` si es torneo (normal vs unranked vs team)
- ❌ Lógica para cargar assets específicos según tournament_type

### 9. Falta Implementar - Configuración de Assets en MyTournaments
- ❌ **Paso 2 en creación de torneo unranked**: 
  - Seleccionar facciones permitidas para el torneo
  - Seleccionar mapas permitidos para el torneo
  - Asociar mediante tablas `tournament_unranked_factions` y `tournament_unranked_maps`

---

## 🔍 Análisis de Implementación Actual

### Estructura de Base de Datos
La migración `20260112_add_unranked_tournaments.sql` implementa correctamente:
- ✅ Sistema de clasificación de facciones y mapas (ranked vs unranked)
- ✅ Campo `tournament_type` en tabla `tournaments`
- ✅ Tablas de asociación `tournament_unranked_factions` y `tournament_unranked_maps`
- ⚠️ **FALTA**: Tablas para estructura de equipos (teams, team_members)

### Backend (Express Routes)
- ✅ **admin.ts**: Gestión completa de facciones y mapas sin ranking (CRUD)
- ✅ **public.ts**: Endpoint para obtener assets unranked de un torneo
- ⚠️ **tournaments.ts**: Sin cambios visibles para soportar unranked/team logic
- ⚠️ **matches.ts**: Sin cambios visibles para considerar tournament_type

### Frontend (React)
- ✅ **Dropdown de tournament_type** en MyTournaments.tsx (implementation ready)
- ✅ **Componentes de selectores** para facciones y mapas (UnrankedFactionSelect, UnrankedMapSelect)
- ⚠️ **Integración incompleta**: Los selectores existen pero no están conectados en el flujo de creación
- ❌ **Sin interfaz para configurar assets por torneo** en el proceso de creación
- ❌ **Sin validaciones en TournamentMatchReportModal** para considerar tournament_type

---

## 📋 Siguientes Pasos Recomendados

### FASE 1: Completar Soporte de Torneos Unranked (PRIORITARIO)
1. Actualizar `MyTournaments.tsx` para mostrar selectores de facciones/mapas cuando `tournament_type === 'unranked'`
2. Implementar lógica para guardar asociaciones en `tournament_unranked_factions` y `tournament_unranked_maps`
3. Actualizar `TournamentMatchReportModal.tsx` para cargar assets desde `/tournaments/:id/unranked-assets`
4. Validar en backend que tournaments unranked usen solo facciones/mapas sin ranking

### FASE 2: Soporte para Torneos de Equipo
1. Crear tablas de base de datos para equipos (`teams`, `team_members`)
2. Implementar endpoints backend de gestión de equipos
3. Crear componentes frontend para configuración y display de equipos
4. Adaptar TournamentMatchReportModal para matches 2v2

### FASE 3: UI/UX Mejoras
1. Añadir filtros de tournament_type en listados
2. Badges/iconos visuales para diferenciar tipos de torneo
3. Validaciones más robustas en todo el flujo

---

## 🏗️ Arquitectura Actual

```
wesnoth_tournament_manager/
├── backend/
│   ├── migrations/
│   │   └── 20260112_add_unranked_tournaments.sql ✅
│   ├── src/
│   │   └── routes/
│   │       ├── admin.ts ✅ (endpoints unranked)
│   │       ├── public.ts ✅ (endpoint unranked-assets)
│   │       ├── tournaments.ts ⚠️ (needs updates)
│   │       └── matches.ts ⚠️ (needs updates)
│
└── frontend/
    ├── src/
    │   ├── components/
    │   │   ├── UnrankedFactionSelect.tsx ✅
    │   │   ├── UnrankedMapSelect.tsx ✅
    │   │   ├── TournamentMatchReportModal.tsx ⚠️ (needs validation logic)
    │   │   └── ... otros componentes
    │   ├── pages/
    │   │   ├── MyTournaments.tsx ⚠️ (needs integration)
    │   │   ├── TournamentDetail.tsx ✅ (basic support)
    │   │   └── ReportMatch.tsx ⚠️ (needs tournament type check)
```

---

## 📊 Resumen Ejecutivo

| Aspecto | Estado | Progreso |
|--------|--------|----------|
| Base de Datos | ✅ Completo | 100% |
| Backend - Gestión de Assets | ✅ Completo | 100% |
| Backend - Lógica de Torneos | ⚠️ Parcial | 40% |
| Frontend - Componentes Base | ✅ Listo | 100% |
| Frontend - Integración | ⚠️ Parcial | 30% |
| Frontend - Validaciones | ❌ Falta | 0% |
| Team Tournaments | ❌ No iniciado | 0% |
| **TOTAL** | **⚠️ PARCIAL** | **43%** |

**Conclusión**: La infraestructura de base de datos y endpoints administrativos para unranked tournaments está lista, pero falta la integración frontend y las validaciones en el flujo de creación y reporte de torneos. Los team tournaments aún no han sido iniciados.
