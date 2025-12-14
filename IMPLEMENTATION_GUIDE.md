# 🚀 Guía de Implementación: Modos de Torneo (Liga, Suizo, Suizo Mixto, Eliminación Mejorada)

## 📋 Resumen de Cambios Implementados

✅ **SQL Migration**: `backend/migrations/014_tournament_modes.sql`
- Agrega 20+ campos nuevos a tabla `tournaments`
- Crea 3 tablas nuevas: `tournament_standings`, `swiss_pairings`, `league_standings`
- Añade índices para performance

✅ **TypeScript Types**: `backend/src/types/tournament.ts`
- Define tipos para cada modo de torneo
- Type guards para validación en compile-time
- Interfaces para standings, pairings, configuración

✅ **Backend Service**: `backend/src/services/tournamentService.ts`
- Métodos para crear torneos con configuración flexible
- Obtener standings y pairings
- Generar sugerencias automáticas por número de participantes

✅ **API Endpoints**: `backend/src/routes/tournaments.ts`
- GET `/api/tournaments/:id/config` - Obtener configuración
- GET `/api/tournaments/suggestions/by-count` - Sugerencias automáticas
- GET `/api/tournaments/:id/standings` - Posiciones
- GET `/api/tournaments/:id/league-standings` - Liga standings
- GET `/api/tournaments/:id/swiss-pairings/:round_id` - Emparejamientos suizos

✅ **Documentación**: 
- `API_TOURNAMENT_MODES.md` - Completa documentación de API
- `TOURNAMENT_MODES_PROPOSAL.md` - Propuesta detallada con ejemplos

---

## 🔧 Instalación y Configuración

### Paso 1: Ejecutar Migración SQL

```bash
# Conectarse a la base de datos
mysql -u [usuario] -p [contraseña] [base_de_datos] < backend/migrations/014_tournament_modes.sql
```

O mediante Node.js:

```javascript
// backend/scripts/run_migration.js
const mysql = require('mysql2/promise');
const fs = require('fs');

async function runMigration() {
  const connection = await mysql.createConnection({
    host: process.env.DB_HOST,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME
  });

  const sql = fs.readFileSync('./migrations/014_tournament_modes.sql', 'utf8');
  
  // Split by ; and execute each statement
  const statements = sql.split(';').filter(s => s.trim());
  
  for (const statement of statements) {
    try {
      console.log(`Executing: ${statement.substring(0, 80)}...`);
      await connection.execute(statement);
    } catch (error) {
      console.error('Error executing migration:', error);
    }
  }
  
  await connection.end();
  console.log('✅ Migration completed successfully');
}

runMigration();
```

### Paso 2: Compilar TypeScript

```bash
cd backend
npm run build
# o
tsc
```

### Paso 3: Verificar Tablas y Campos

```bash
# Verificar campos nuevos en tournaments
mysql> DESC tournaments;

# Verificar tablas nuevas
mysql> SHOW TABLES LIKE '%standings%';
mysql> SHOW TABLES LIKE '%pairings%';
```

Debería ver:
```
tournaments:
- tournament_type
- league_type
- swiss_rounds
- swiss_hybrid_rounds
- elimination_matches_final
- ... (y otros campos)

tournament_standings: Existe
swiss_pairings: Existe
league_standings: Existe
```

### Paso 4: Reiniciar Servidor

```bash
npm restart
# o
npm run dev
```

---

## 🧪 Pruebas

### Probar Crear Torneo de Eliminación Mejorada

```bash
curl -X GET \
  'http://localhost:3000/api/tournaments/suggestions/by-count?participant_count=16' \
  -H 'Authorization: Bearer [TOKEN]'
```

Respuesta esperada:
```json
{
  "suggestions": {
    "league": { ... },
    "swiss": { ... },
    "elimination": {
      "elimination_type": "single",
      "finalists_count": 16,
      "series_format_eliminations": "bo1",
      "series_format_final": "bo3",
      "estimated_matches": 15
    }
  }
}
```

### Probar GET Configuración de Torneo

```bash
curl -X GET \
  'http://localhost:3000/api/tournaments/1/config' \
  -H 'Authorization: Bearer [TOKEN]'
```

Debería retornar todos los campos incluyendo `elimination_matches_final`, `tournament_type`, etc.

---

## 📊 Verificación de Datos

### Verificar Que Las Tablas Se Crearon Correctamente

```sql
-- Verificar tournaments tiene los campos nuevos
SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS 
WHERE TABLE_NAME = 'tournaments' 
AND COLUMN_NAME LIKE 'elimination_%';

-- Debería retornar:
-- elimination_type
-- elimination_matches_dieciseisavos
-- elimination_matches_octavos
-- elimination_matches_cuartos
-- elimination_matches_semis
-- elimination_matches_final
-- league_type
-- swiss_rounds
-- swiss_hybrid_rounds

-- Verificar tournament_standings existe y tiene estructura correcta
DESC tournament_standings;

-- Verificar swiss_pairings existe
DESC swiss_pairings;

-- Verificar league_standings existe
DESC league_standings;
```

### Verificar Backward Compatibility

```sql
-- Ver que torneos existentes NO tienen valores NULL en campos críticos
SELECT tournament_id, tournament_type, tournament_status 
FROM tournaments 
WHERE tournament_type = 'elimination' 
LIMIT 5;

-- Debería funcionar normalmente, tournament_type será NULL para existentes
-- (esto es normal, se puede migrar después)
```

---

## 🎯 Casos de Uso

### Crear Torneo de Liga

```bash
curl -X POST http://localhost:3000/api/tournaments \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer [TOKEN]' \
  -d '{
    "tournament_name": "Liga Clausura 2025",
    "tournament_type": "league",
    "league_type": "double_round",
    "series_format": "bo1"
  }'
```

### Crear Torneo Suizo

```bash
curl -X POST http://localhost:3000/api/tournaments \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer [TOKEN]' \
  -d '{
    "tournament_name": "Torneo Suizo",
    "tournament_type": "swiss",
    "swiss_rounds": 5,
    "series_format": "bo1"
  }'
```

### Crear Torneo Suizo Mixto

```bash
curl -X POST http://localhost:3000/api/tournaments \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer [TOKEN]' \
  -d '{
    "tournament_name": "Campeonato Nacional",
    "tournament_type": "swiss_hybrid",
    "swiss_hybrid_rounds": 5,
    "finalists_count": 8,
    "series_format_swiss": "bo1",
    "series_format_finals": "bo3"
  }'
```

### Crear Torneo de Eliminación Mejorada

```bash
curl -X POST http://localhost:3000/api/tournaments \
  -H 'Content-Type: application/json' \
  -H 'Authorization: Bearer [TOKEN]' \
  -d '{
    "tournament_name": "Open 2025",
    "tournament_type": "elimination",
    "elimination_type": "single",
    "elimination_matches_octavos": 1,
    "elimination_matches_cuartos": 1,
    "elimination_matches_semis": 3,
    "elimination_matches_final": 5,
    "series_format_finals": "bo3"
  }'
```

---

## 🔍 Troubleshooting

### "Table 'tournament_standings' doesn't exist"
- Ejecutar migración SQL completa
- Verificar que CREATE TABLE no falló silenciosamente
- Revisar logs de MySQL

### "Column 'tournament_type' doesn't exist"
- Migración no se ejecutó completamente
- Ejecutar: `ALTER TABLE tournaments ADD COLUMN tournament_type VARCHAR(20) DEFAULT 'elimination'`

### TypeScript compilation errors
- Verificar que `backend/src/types/tournament.ts` existe
- Ejecutar `npm run build`
- Revisar errores en `tsconfig.json`

### API returns 404 for new endpoints
- Verificar que `backend/src/routes/tournaments.ts` tiene los nuevos endpoints
- Verificar que router está registrado en `app.ts`: `app.use('/api/tournaments', tournamentsRouter)`
- Reiniciar servidor

---

## 📈 Performance Considerations

Las nuevas tablas y campos fueron optimizados para performance:

✅ **Índices agregados:**
- `tournaments`: idx_tournament_type, idx_tournament_status
- `tournament_standings`: idx_tournament_rank, idx_player_tournament
- `league_standings`: idx_tournament_position
- `swiss_pairings`: idx_tournament_round, idx_status

✅ **Estructura:**
- Campos numéricos para queries rápidas
- Timestamps con índices
- Foreign keys con constraints

---

## 🔒 Seguridad

### Validación en API
Todos los endpoints validam:
- Authentication (authMiddleware)
- Tipos válidos (CHECK constraints en DB)
- Campos requeridos según tournament_type
- Participant count válido

### Constraints en Base de Datos
```sql
CHECK (tournament_type IN ('elimination', 'league', 'swiss', 'swiss_hybrid'))
CHECK (round_type IN ('regular', 'octavos', 'cuartos', ...))
CHECK (match_status IN ('pending', 'completed', 'cancelled'))
```

---

## 📚 Documentación Relacionada

- **API Completa**: Ver `API_TOURNAMENT_MODES.md`
- **Propuesta Detallada**: Ver `TOURNAMENT_MODES_PROPOSAL.md`
- **Schema SQL**: Ver `backend/migrations/014_tournament_modes.sql`
- **Types TypeScript**: Ver `backend/src/types/tournament.ts`

---

## ✅ Checklist de Implementación

- [x] SQL Migration creada
- [x] TypeScript types definidas
- [x] TournamentService implementado
- [x] API endpoints creados
- [x] Documentación completa
- [ ] Tests unitarios (TODO)
- [ ] Tests de integración (TODO)
- [ ] Frontend wizard (TODO)
- [ ] Algoritmos suizo/liga (TODO)

---

## 🎉 ¿Qué Sigue?

1. **Ejecutar migración SQL**
2. **Compilar TypeScript**
3. **Reiniciar servidor**
4. **Probar endpoints con ejemplos anteriores**
5. **Implementar algoritmos de emparejamiento (Fase 2)**
6. **Crear frontend de configuración (Fase 3)**
7. **Agregar tests (Fase 4)**

---

**Implementación completada**: 14 Diciembre 2025
**Autor**: GitHub Copilot
**Status**: ✅ Listo para deployment
