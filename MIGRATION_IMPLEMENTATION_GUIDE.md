# Plan de Migración: Stored Procedures PostgreSQL → TypeScript/Node.js

## Resumen Ejecutivo

**Total de funciones a migrar:** 24
**Horas estimadas:** 191.9 (incluyendo testing y buffer)
**Equipo recomendado:** 1 senior + 2 mid-level developers
**Timeline:** 3-4 semanas con equipo completo

### Categorías de Migración

| Categoría | Funciones | Criticidad | Frecuencia | Horas | Orden |
|-----------|-----------|-----------|-----------|-------|-------|
| Tiebreaker Calculations | 6 | HIGH | MEDIUM | 24 | 1️⃣ |
| Team/Tournament Validators | 6 | HIGH | HIGH | 18 | 2️⃣ |
| Faction/Map Statistics | 3 | HIGH | HIGH | 28 | 3️⃣ |
| Balance Events & Snapshots | 6 | HIGH | LOW | 32 | 4️⃣ |
| Balance Event Analytics | 3 | MEDIUM | MEDIUM | 12 | 5️⃣ |

---

## 1️⃣ PHASE 1: Tiebreaker Calculations (24 horas)

### Funciones to migrate
- `calculate_league_tiebreakers`
- `calculate_swiss_tiebreakers`
- `calculate_team_swiss_tiebreakers`
- `update_league_tiebreakers`
- `update_team_tiebreakers`
- `update_tournament_tiebreakers`

### Características Clave
- **Complejidad:** MEDIUM-HIGH (múltiples CTEs con lógica compleja)
- **Dependencias:** tournament_participants, tournament_teams, tournament_round_matches
- **Duplicidad detectada:** league y swiss usan mismo algoritmo
- **Tipo:** Funciones normales (no triggers)

### Estructura Propuesta
```
src/utils/tiebreakers/
├── tiebreaker.service.ts          (clase base + actualizaciones)
├── league-tiebreaker.helper.ts    (lógica de league)
├── swiss-tiebreaker.helper.ts     (lógica de swiss)
├── team-tiebreaker.helper.ts      (lógica de team)
├── tiebreaker.dto.ts               (interfaces)
└── tiebreaker.test.ts              (tests)
```

### Implementación Recomendada

#### Interface
```typescript
// src/utils/tiebreakers/tiebreaker.dto.ts
export interface TiebreakerCalculationResult {
  userId?: string;          // para individual
  teamId?: string;          // para team
  totalPoints: number;      // wins * multiplier
  omp: Decimal;            // Opponent Match Points
  gwp: Decimal;            // Game Win Percentage
  ogp: Decimal;            // Opponent Game Percentage
}
```

#### Service
```typescript
// src/utils/tiebreakers/tiebreaker.service.ts
export class TiebreakerService {
  async calculateLeagueTiebreakers(tournamentId: string): Promise<TiebreakerCalculationResult[]> {
    // Implementar logic similar a calculate_league_tiebreakers
    // Usar Query Builder + aggregations
  }
  
  async calculateSwissTiebreakers(tournamentId: string): Promise<TiebreakerCalculationResult[]> {
    // Similar pero para swiss format
  }
  
  async calculateTeamSwissTiebreakers(tournamentId: string): Promise<TiebreakerCalculationResult[]> {
    // Versión para teams
  }
  
  async updateTiebreakersForTournament(tournamentId: string, format: 'league'|'swiss'|'team'): Promise<void> {
    // Transactional update
    const results = await this.calculate(tournamentId);
    // Batch update tournament_participants/tournament_teams
  }
}
```

### Critical Queries
```typescript
// OMP calculation pattern
const opponentWins = await db('tournament_round_matches as tm')
  .leftJoin('tournament_participants as tp', ...)
  .select(db.raw('COALESCE(tp.tournament_wins, 0) as opp_wins'))
  .where('tm.tournament_id', tournamentId)
  .andWhere('tm.series_status', 'completed');

const omp = opponentWins.length > 0 
  ? opponentWins.reduce((sum, r) => sum + r.opp_wins, 0) / opponentWins.length
  : 0;
```

### Testing Strategy
- Unit tests: Cada algoritmo con casos conocidos
- Integration tests: Verificar con BD real
- Precision tests: Comparar resultados vs PostgreSQL

---

## 2️⃣ PHASE 2: Team/Tournament Validators (18 horas)

### Funciones to migrate
- `check_team_member_count` (TRIGGER)
- `check_team_member_positions` (TRIGGER)
- `validate_tournament_match_players` (TRIGGER)
- `validate_tournament_match_results` (TRIGGER)
- `validate_tournament_round_match_players` (TRIGGER)
- `update_team_elo` (TRIGGER)

### Características Clave
- **Tipo:** La mayoría son TRIGGERS → necesitan ser middleware/hooks
- **Criticidad:** HIGH (garantizan integridad de datos)
- **Frecuencia:** HIGH (se ejecutan en cada creación/actualización)
- **Complejidad:** LOW-MEDIUM (mostly simple validations)

### Estructura Propuesta
```
src/middleware/validation/
├── tournament.validators.ts        (tournament match validation)
├── team.validators.ts              (team-specific validation)
├── validation.dto.ts               (interfaces)
└── validation.test.ts

src/services/
├── team-service.ts                 (contiene hook para update_team_elo)
└── tournament-service.ts           (orchestration)
```

### Implementación Recomendada

#### Middleware Pattern
```typescript
// src/middleware/validation/tournament.validators.ts

export const validateTournamentMatchPlayers = async (req, res, next) => {
  const { tournament_id, player1_id, player2_id } = req.body;
  
  try {
    // Obtener modo del torneo
    const tournament = await Tournament.findById(tournament_id);
    
    if (tournament.tournament_mode === 'team') {
      // Validar contra tournament_teams
      const team1 = await TournamentTeam.findById(player1_id);
      const team2 = await TournamentTeam.findById(player2_id);
      
      if (!team1 || !team2) {
        throw new Error('Team does not exist in tournament_teams');
      }
    } else {
      // Validar contra users
      const user1 = await User.findById(player1_id);
      const user2 = await User.findById(player2_id);
      
      if (!user1 || !user2) {
        throw new Error('User does not exist in users table');
      }
    }
    
    next();
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

export const validateTournamentMatchResults = async (req, res, next) => {
  const { tournament_id, winner_id, loser_id } = req.body;
  
  if (!winner_id && !loser_id) {
    return next(); // Solo validar si se setean resultados
  }
  
  // Similar pattern a validateTournamentMatchPlayers
};
```

#### Service Hook
```typescript
// src/services/team-service.ts

export class TeamService {
  async addParticipantToTeam(teamId: string, userId: string) {
    // Validar team member count
    const memberCount = await TournamentParticipant.count({ team_id: teamId });
    if (memberCount >= 2) {
      throw new Error('Team cannot have more than 2 active members');
    }
    
    const participant = new TournamentParticipant({
      team_id: teamId,
      user_id: userId,
      ...
    });
    
    await participant.save();
    
    // Hook: Update team ELO después de agregar
    await this.updateTeamElo(teamId);
  }
  
  private async updateTeamElo(teamId: string) {
    const participants = await TournamentParticipant.find({ team_id: teamId });
    const totalElo = participants.reduce((sum, p) => sum + p.elo_rating, 0);
    
    await TournamentTeam.update(
      { id: teamId },
      { team_elo: totalElo }
    );
  }
}
```

#### Integration en Routes
```typescript
// routes/tournament-matches.ts

router.post('/tournament-matches', 
  validateTournamentMatchPlayers,
  validateTournamentMatchResults,
  async (req, res) => {
    // Crear match
  }
);
```

### Testing Strategy
- Unit tests con mocks de BD
- Integration tests validando cada escenario
- Tests de error: casos invalidos

---

## 3️⃣ PHASE 3: Faction/Map Statistics (28 horas)

### Funciones to migrate
- `update_faction_map_statistics` (TRIGGER - MUY CRÍTICO)
- `recalculate_faction_map_statistics`
- `recalculate_player_match_statistics`

### Características Clave
- **Criticidad:** CRITICAL
- **Frecuencia:** VERY HIGH (después de cada match)
- **Complejidad:** VERY HIGH
- **Bloqueadores:** Performance critical - afecta tiempo de creación de matches
- **update_faction_map_statistics:** Se ejecuta DESPUÉS de INSERT en matches

### Estructura Propuesta
```
src/utils/statistics/
├── faction-map-statistics.service.ts   (cálculos y updates)
├── player-statistics.service.ts        (player stats - QUEUE JOB)
├── statistics.helper.ts                (utility functions)
├── statistics.dto.ts
└── statistics.test.ts

src/jobs/
└── recalculate-player-stats.job.ts    (queue job para player stats)

src/services/
└── match-service.ts                    (orquestación + hook para update_faction_map_statistics)
```

### Implementación Recomendada

#### Hook Pattern en Match Service
```typescript
// src/services/match-service.ts

export class MatchService {
  constructor(
    private statisticsService: StatisticsService,
    private queue: Bull.Queue
  ) {}
  
  async createMatch(matchData): Promise<Match> {
    const match = new Match(matchData);
    await match.save(); // TRANSACTION 1
    
    // ASYNC: Actualizar faction/map statistics (trigger equivalent)
    // No bloquear la respuesta - usar job queue
    await this.queue.add('update-faction-stats', {
      matchId: match.id,
      winnerId: match.winner_id,
      loserId: match.loser_id,
      map: match.map,
      winnerFaction: match.winner_faction,
      loserFaction: match.loser_faction
    });
    
    return match;
  }
}
```

#### Faction/Map Statistics Service
```typescript
// src/utils/statistics/faction-map-statistics.service.ts

export class FactionMapStatisticsService {
  async updateStatisticsForMatch(matchData) {
    // Similar a update_faction_map_statistics trigger
    const mapId = await this.getMapId(matchData.map);
    const winnerFactionId = await this.getFactionId(matchData.winnerFaction);
    const loserFactionId = await this.getFactionId(matchData.loserFaction);
    
    // Usar UPSERT (INSERT ... ON CONFLICT DO UPDATE)
    await this.db('faction_map_statistics').raw(`
      INSERT INTO faction_map_statistics 
        (map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate)
      VALUES (?, ?, ?, 1, 1, 0, 100.00)
      ON CONFLICT (map_id, faction_id, opponent_faction_id) DO UPDATE SET
        total_games = total_games + 1,
        wins = wins + 1,
        winrate = ROUND(100.0 * (wins + 1) / (total_games + 1), 2),
        last_updated = NOW()
    `, [mapId, winnerFactionId, loserFactionId]);
    
    // Similar para loser faction
    await this.db('faction_map_statistics').raw(`
      INSERT INTO faction_map_statistics 
        (map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate)
      VALUES (?, ?, ?, 1, 0, 1, 0.00)
      ON CONFLICT (map_id, faction_id, opponent_faction_id) DO UPDATE SET
        total_games = total_games + 1,
        losses = losses + 1,
        winrate = ROUND(100.0 * wins / (total_games + 1), 2),
        last_updated = NOW()
    `, [mapId, loserFactionId, winnerFactionId]);
  }
  
  async recalculateAllStatistics() {
    // Truncate + recalculate desde matches table
    await this.db('faction_map_statistics').truncate();
    
    // Get map IDs and faction IDs from matches table
    // Insert for all winner factions
    const winnerStats = await this.db.raw(`
      WITH winner_stats AS (
        SELECT
          gm.id as map_id,
          f_winner.id as faction_id,
          f_loser.id as opponent_faction_id,
          COUNT(*)::INT as total_games,
          COUNT(*)::INT as wins,
          0::INT as losses
        FROM matches m
        JOIN game_maps gm ON gm.name = m.map
        JOIN factions f_winner ON f_winner.name = m.winner_faction
        JOIN factions f_loser ON f_loser.name = m.loser_faction
        WHERE NOT (m.admin_reviewed = true AND m.status = 'cancelled')
        GROUP BY gm.id, f_winner.id, f_loser.id
      )
      INSERT INTO faction_map_statistics (map_id, faction_id, opponent_faction_id, total_games, wins, losses, winrate)
      SELECT 
        map_id,
        faction_id,
        opponent_faction_id,
        total_games,
        wins,
        losses,
        ROUND(100.0 * wins / total_games, 2)::NUMERIC(5,2)
      FROM winner_stats
    `);
    
    // Repeat for loser...
  }
}
```

#### Player Match Statistics Service (ASYNC)
```typescript
// src/utils/statistics/player-statistics.service.ts
// NOTE: Esta es EXTREMADAMENTE COMPLEJA - 5 secciones diferentes

export class PlayerStatisticsService {
  async recalculateAllPlayerStatistics() {
    // CRITICAL: Recrear tabla limpia (drop + create)
    await this.db.schema.dropTableIfExists('player_match_statistics');
    await this.createTable();
    
    // ===== SECTION 1: GLOBAL STATS =====
    await this.insertGlobalStats();
    
    // ===== SECTION 2: HEAD-TO-HEAD =====
    // CRITICAL FIX: Combinar WINNER y LOSER antes de INSERT
    // NO usar ON CONFLICT (previene que loser sobrescriba winner)
    await this.insertHeadToHeadStats();
    
    // ===== SECTION 3: PER-MAP STATS =====
    await this.insertPerMapStats();
    
    // ===== SECTION 4: PER-FACTION STATS =====
    await this.insertPerFactionStats();
  }
  
  private async insertHeadToHeadStats() {
    // CRITICAL PATTERN: Combinar perspectives ANTES de insertar
    const h2hData = await this.db.raw(`
      WITH h2h_combined AS (
        -- Winners perspective
        SELECT
          m.winner_id as player_id,
          m.loser_id as opponent_id,
          COUNT(*)::INT as wins,
          0::INT as losses,
          ...
        FROM matches m
        WHERE NOT (m.admin_reviewed = true AND m.status = 'cancelled')
        GROUP BY m.winner_id, m.loser_id
        
        UNION ALL
        
        -- Losers perspective (será combinado con winners)
        SELECT
          m.loser_id as player_id,
          m.winner_id as opponent_id,
          0::INT as wins,
          COUNT(*)::INT as losses,
          ...
        FROM matches
        GROUP BY m.loser_id, m.winner_id
      ),
      h2h_merged AS (
        SELECT
          player_id,
          opponent_id,
          SUM(wins)::INT as wins,
          SUM(losses)::INT as losses,
          ...
        FROM h2h_combined
        GROUP BY player_id, opponent_id
      )
      SELECT * FROM h2h_merged
    `);
    
    // Batch insert sin ON CONFLICT
    for (const record of h2hData) {
      await this.db('player_match_statistics').insert(record);
    }
  }
}
```

#### Job Queue Configuration
```typescript
// src/jobs/recalculate-player-stats.job.ts

export const registerPlayerStatsJob = (queue: Bull.Queue) => {
  queue.process('update-faction-stats', async (job) => {
    const service = new FactionMapStatisticsService();
    await service.updateStatisticsForMatch(job.data);
  });
  
  // Scheduled job para recalcular TODAS las stats (ej: nightly)
  queue.add('recalculate-player-stats', {}, {
    repeat: { cron: '0 2 * * *' } // 2 AM daily
  });
};

queue.process('recalculate-player-stats', async (job) => {
  const service = new PlayerStatisticsService();
  await service.recalculateAllPlayerStatistics();
});
```

### Performance Considerations
- `update_faction_map_statistics`: Debe ser ASYNC (no bloquear match creation)
- Usar bulk operations para recalculate
- Implementar índices recomendados
- Considerar denormalization si performance es crítica
- Redis caching para estadísticas frecuentes

### Testing Strategy
- Unit tests con mathematical validation
- Performance tests: 1000+ matches
- Edge cases: div by zero, NULL values, cancelled matches
- Comparación vs PostgreSQL results

---

## 4️⃣ PHASE 4: Balance Events & Snapshots (32 horas)

### Funciones to migrate
- `create_balance_event_before_snapshot` (TRIGGER)
- `create_faction_map_statistics_snapshot`
- `daily_snapshot_faction_map_statistics` (JOB)
- `manage_faction_map_statistics_snapshots`
- `recalculate_balance_event_snapshots`
- `recalculate_balance_event_snapshots_loser` (EMPTY)

### Características Clave
- **Tipo:** Mix de triggers y jobs
- **create_balance_event_before_snapshot:** TRIGGER BEFORE INSERT on balance_events
- **daily_snapshot_faction_map_statistics:** JOB que se ejecuta diariamente
- **Criticidad:** HIGH (afecta análisis de balance)
- **Complejidad:** MEDIUM-HIGH

### Estructura Propuesta
```
src/utils/balance-events/
├── balance-event.service.ts         (manejo de balance events)
├── snapshot.service.ts              (snapshot logic)
├── balance-event.dto.ts
└── balance-event.test.ts

src/jobs/
└── daily-snapshot.job.ts            (cron job para snapshot diario)
```

### Implementación Recomendada

#### Balance Event Service
```typescript
// src/utils/balance-events/balance-event.service.ts

export class BalanceEventService {
  constructor(
    private snapshotService: SnapshotService,
    private db: Database
  ) {}
  
  async createBalanceEvent(eventData) {
    const { eventDate, factionId, mapId, description } = eventData;
    
    // TRANSACTIONAL
    return this.db.transaction(async (trx) => {
      // 1. Crear balance event
      const balanceEvent = new BalanceEvent(eventData);
      await balanceEvent.save();
      
      // 2. Trigger equivalent: Crear before snapshot
      const beforeDate = new Date(eventDate);
      beforeDate.setDate(beforeDate.getDate() - 1);
      
      await this.snapshotService.createBeforeSnapshot(
        balanceEvent.id,
        beforeDate,
        trx
      );
      
      return balanceEvent;
    });
  }
  
  async getBalanceEventWithSnapshots(eventId: string) {
    const event = await BalanceEvent.findById(eventId);
    const beforeSnapshot = await this.snapshotService.getSnapshot(
      event.snapshot_before_date
    );
    const afterSnapshot = await this.snapshotService.getSnapshot(
      event.snapshot_after_date
    );
    
    return { event, beforeSnapshot, afterSnapshot };
  }
}
```

#### Snapshot Service
```typescript
// src/utils/balance-events/snapshot.service.ts

export class SnapshotService {
  async createBeforeSnapshot(eventId: string, beforeDate: Date, trx = null) {
    // Usar yesterday's date (closest data before event)
    const snapshots = await this.db('faction_map_statistics')
      .select([
        this.db.raw(`? as snapshot_date`, [beforeDate]),
        'map_id',
        'faction_id',
        'opponent_faction_id',
        'total_games',
        'wins',
        'losses',
        'winrate',
        this.db.raw(`
          CASE
            WHEN total_games < 10 THEN 'small'
            WHEN total_games < 50 THEN 'medium'
            ELSE 'large'
          END as sample_size_category
        `),
        this.db.raw(`
          CASE
            WHEN total_games < 10 THEN 25.0
            WHEN total_games < 30 THEN 50.0
            WHEN total_games < 50 THEN 75.0
            ELSE 95.0
          END as confidence_level
        `)
      ])
      .where('total_games', '>', 0);
    
    // UPSERT pattern
    const db = trx || this.db;
    await db('faction_map_statistics_history').insert(snapshots).onConflict(
      ['snapshot_date', 'map_id', 'faction_id', 'opponent_faction_id']
    ).ignore();
    
    // Update balance_events record
    await db('balance_events').where('id', eventId).update({
      snapshot_before_date: beforeDate
    });
  }
  
  async createDailySnapshot(snapshotDate: Date = new Date()) {
    // Check if snapshot already exists
    const existingSnapshot = await this.db('faction_map_statistics_history')
      .where('snapshot_date', snapshotDate)
      .first();
    
    if (existingSnapshot) {
      console.log(`Snapshot already exists for ${snapshotDate}`);
      return { skipped: true };
    }
    
    // Create snapshot
    const snapshots = await this.db('faction_map_statistics')
      .select([
        this.db.raw(`? as snapshot_date`, [snapshotDate]),
        'map_id',
        'faction_id',
        'opponent_faction_id',
        'total_games',
        'wins',
        'losses',
        'winrate',
        this.db.raw(`CASE WHEN total_games < 10 THEN 'small' ... END`),
        ...
      ])
      .where('total_games', '>', 0);
    
    await this.db('faction_map_statistics_history').insert(snapshots);
    
    return { created: snapshots.length };
  }
}
```

#### Cron Job
```typescript
// src/jobs/daily-snapshot.job.ts

import cron from 'node-cron';

export const setupDailySnapshotJob = (snapshotService: SnapshotService) => {
  // Ejecutar a las 00:00 UTC
  cron.schedule('0 0 * * *', async () => {
    try {
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      
      const result = await snapshotService.createDailySnapshot(yesterday);
      console.log('Daily snapshot completed:', result);
    } catch (error) {
      console.error('Daily snapshot failed:', error);
      // ALERT: Enviar notificación
    }
  });
};
```

### Testing Strategy
- Unit tests: Snapshot creation logic
- Integration tests: End-to-end balance event flow
- Idempotency tests: Múltiples ejecuciones del job
- Timezone tests: Diferentes timezones

---

## 5️⃣ PHASE 5: Balance Event Analytics (12 horas)

### Funciones to migrate
- `get_balance_event_forward_impact`
- `get_balance_event_impact`
- `get_balance_trend`

### Características Clave
- **Tipo:** Funciones de lectura (queries complejas)
- **Criticidad:** MEDIUM (no afectan escritura de datos)
- **Complejidad:** MEDIUM (JOINs y agregaciones)
- **Oportunidad:** Caching + pagination

### Estructura Propuesta
```
src/utils/balance-events/analytics/
├── balance-event-analytics.service.ts
├── analytics.dto.ts
└── analytics.test.ts

src/routes/
└── balance-analytics.routes.ts  (API endpoints)
```

### Implementación Recomendada

#### Analytics Service
```typescript
// src/utils/balance-events/analytics/balance-event-analytics.service.ts

export class BalanceEventAnalyticsService {
  async getForwardImpact(eventIdParam: string): Promise<ForwardImpactResult[]> {
    // Get current event details
    const event = await this.db('balance_events').where('id', eventIdParam).first();
    
    if (!event) {
      throw new Error(`Balance event not found: ${eventIdParam}`);
    }
    
    // Get next event date (if any)
    const nextEvent = await this.db('balance_events')
      .where('event_date', '>', event.event_date)
      .orderBy('event_date', 'asc')
      .first();
    
    const nextEventDate = nextEvent?.event_date ?? new Date();
    
    // Query
    const results = await this.db('faction_map_statistics_history as fms')
      .join('game_maps as gm', 'fms.map_id', 'gm.id')
      .join('factions as f1', 'fms.faction_id', 'f1.id')
      .join('factions as f2', 'fms.opponent_faction_id', 'f2.id')
      .select(
        'fms.map_id',
        'gm.name as map_name',
        'fms.faction_id',
        'f1.name as faction_name',
        'fms.opponent_faction_id',
        'f2.name as opponent_faction_name',
        'fms.winrate',
        'fms.total_games',
        'fms.wins',
        'fms.losses',
        'fms.snapshot_date',
        this.db.raw(`(fms.snapshot_date - ?) as days_since_event`, [event.event_date])
      )
      .whereBetween('fms.snapshot_date', [event.event_date, nextEventDate])
      .where(builder => {
        if (event.faction_id) builder.where('fms.faction_id', event.faction_id);
      })
      .where(builder => {
        if (event.map_id) builder.where('fms.map_id', event.map_id);
      })
      .orderBy('fms.snapshot_date', 'asc')
      .orderBy('fms.map_id')
      .orderBy('fms.faction_id');
    
    return results;
  }
  
  async getBalanceEventImpact(
    eventIdParam: string,
    daysBefore: number = 30,
    daysAfter: number = 30
  ): Promise<BalanceImpactResult[]> {
    // Get event
    const event = await this.db('balance_events').where('id', eventIdParam).first();
    
    if (!event) {
      throw new Error(`Balance event not found: ${eventIdParam}`);
    }
    
    const eventDate = new Date(event.event_date);
    const beforeDate = new Date(eventDate);
    beforeDate.setDate(beforeDate.getDate() - daysBefore);
    const afterDate = new Date(eventDate);
    afterDate.setDate(afterDate.getDate() + daysAfter);
    
    // Get before-stats
    const beforeStats = await this.getHistoryStats(
      beforeDate,
      new Date(eventDate.getTime() - 86400000), // Yesterday
      event
    );
    
    // Get after-stats
    const afterStats = await this.getHistoryStats(
      eventDate,
      afterDate,
      event
    );
    
    // Merge results
    return this.mergeBeforeAfterStats(beforeStats, afterStats);
  }
  
  async getBalanceTrend(
    mapIdParam: string,
    factionIdParam: string,
    opponentFactionIdParam: string,
    dateFrom: Date,
    dateTo: Date,
    limit: number = 100,
    offset: number = 0
  ): Promise<PaginatedTrend> {
    const results = await this.db('faction_map_statistics_history as fms')
      .select(
        'fms.snapshot_date',
        'fms.total_games',
        'fms.wins',
        'fms.losses',
        'fms.winrate',
        'fms.confidence_level',
        'fms.sample_size_category'
      )
      .where('fms.map_id', mapIdParam)
      .where('fms.faction_id', factionIdParam)
      .where('fms.opponent_faction_id', opponentFactionIdParam)
      .whereBetween('fms.snapshot_date', [dateFrom, dateTo])
      .orderBy('fms.snapshot_date', 'asc')
      .limit(limit)
      .offset(offset);
    
    return {
      data: results,
      total: await this.db('faction_map_statistics_history')
        .count('* as total')
        .where('map_id', mapIdParam)
        .first()
    };
  }
  
  private async getHistoryStats(dateFrom: Date, dateTo: Date, event) {
    return this.db('faction_map_statistics_history as fms')
      .join('game_maps as gm', 'fms.map_id', 'gm.id')
      .join('factions as f1', 'fms.faction_id', 'f1.id')
      .join('factions as f2', 'fms.opponent_faction_id', 'f2.id')
      .select(
        'fms.map_id',
        'gm.name as map_name',
        'fms.faction_id',
        'f1.name as faction_name',
        'fms.opponent_faction_id',
        'f2.name as opponent_faction_name',
        'fms.winrate',
        'fms.total_games'
      )
      .whereBetween('fms.snapshot_date', [dateFrom, dateTo])
      .where(builder => {
        if (event.faction_id) builder.where('fms.faction_id', event.faction_id);
      })
      .where(builder => {
        if (event.map_id) builder.where('fms.map_id', event.map_id);
      });
  }
}
```

#### API Routes
```typescript
// src/routes/balance-analytics.routes.ts

router.get('/balance-events/:eventId/forward-impact', async (req, res) => {
  const { eventId } = req.params;
  const service = new BalanceEventAnalyticsService();
  
  try {
    const results = await service.getForwardImpact(eventId);
    res.json(results);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/balance-events/:eventId/impact', async (req, res) => {
  const { eventId, daysBefore = 30, daysAfter = 30 } = req.query;
  const service = new BalanceEventAnalyticsService();
  
  try {
    const results = await service.getBalanceEventImpact(
      eventId,
      parseInt(daysBefore),
      parseInt(daysAfter)
    );
    res.json(results);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

router.get('/balance-trends/:mapId/:factionId/:opponentFactionId', async (req, res) => {
  const { mapId, factionId, opponentFactionId } = req.params;
  const { dateFrom, dateTo, limit = 100, offset = 0 } = req.query;
  const service = new BalanceEventAnalyticsService();
  
  try {
    const results = await service.getBalanceTrend(
      mapId,
      factionId,
      opponentFactionId,
      new Date(dateFrom),
      new Date(dateTo),
      parseInt(limit),
      parseInt(offset)
    );
    res.json(results);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
```

---

## 📊 Tabla Resumen de Esfuerzo

| Fase | Tarea | Horas | Recurso | Semanas |
|------|-------|-------|---------|---------|
| 1 | Tiebreaker Calculations | 24 | 1 senior dev | 0.6 |
| 2 | Team/Tournament Validators | 18 | 1 mid-level dev | 0.45 |
| 3 | Faction/Map Statistics | 28 | 1 senior + 1 mid-level | 0.95 |
| 4 | Balance Events & Snapshots | 32 | 1 mid-level + 1 junior | 1.1 |
| 5 | Balance Event Analytics | 12 | 1 mid-level dev | 0.3 |
| — | Testing (5%) | 30 | All | 1 |
| — | Documentation (15%) | 20 | All | 1 |
| — | Buffer (5%) | 28 | All | — |
| **TOTAL** | | **191.9** | **3 devs** | **3-4** |

---

## 🚨 Riesgos Críticos y Mitigaciones

### 1. CRITICAL: Performance de update_faction_map_statistics
**Riesgo:** Cada match dispara este trigger → puede ralentizar creación de matches
**Mitigación:**
- Implementar como async job (no bloquea)
- Usar batch processing
- Índices optimizados en facción_map_statistics
- Tests de performance con carga

### 2. HIGH: Data Consistency en tiebrekers
**Riesgo:** Cálculos complejos con múltiples CTEs → errores introducidos
**Mitigación:**
- Tests exhaustivos vs PostgreSQL
- Transacciones explícitas
- Función de validación post-cálculo

### 3. HIGH: Complejidad de recalculate_player_match_statistics
**Riesgo:** Lógica muy compleja con 5 secciones diferentes
**Mitigación:**
- Dividir en funciones pequeñas
- Tests con datasets reales
- Documentar cada sección extensamente

### 4. MEDIUM: Job scheduler (daily_snapshot)
**Riesgo:** Job no se ejecuta → snapshots no se crean
**Mitigación:**
- Monitoring + alerting
- Health check API
- Logs detallados
- Considerar systemd timer como backup

### 5. MEDIUM: Timezone handling
**Riesgo:** Balance events con fechas en diferentes timezones
**Mitigación:**
- Usar UTC internamente siempre
- Guardar timezone en BD
- Tests con múltiples timezones

---

## ✅ Checklist de Implementación

### Pre-Migration
- [ ] Setup base de datos de test con datos reales
- [ ] Create test fixtures con casos conocidos
- [ ] Document PostgreSQL behavior con ejemplos
- [ ] Setup CI/CD para tests

### Phase 1
- [ ] Implementar TiebreakerService
- [ ] Tests vs PostgreSQL
- [ ] Benchmarks

### Phase 2
- [ ] Implementar validation middleware
- [ ] Integrar en rutas API
- [ ] Tests de validación cruzada

### Phase 3
- [ ] Implementar FactionMapStatisticsService
- [ ] Setup Bull queue para async jobs
- [ ] Tests de performance

### Phase 4
- [ ] Implementar BalanceEventService
- [ ] Setup cron job
- [ ] Tests de idempotencia

### Phase 5
- [ ] Implementar AnalyticsService
- [ ] Setup API endpoints
- [ ] Setup caching

### Post-Migration
- [ ] Load testing
- [ ] Data validation (migrate histórico)
- [ ] Training del equipo
- [ ] Documentation final

---

## 📚 Referencias

- [PostgreSQL Query Migration Guide](./MIGRATION_PATTERNS.md)
- [Performance Best Practices](./PERFORMANCE_GUIDE.md)
- [Database Indices](./DB_MIGRATION_NOTES.md)

