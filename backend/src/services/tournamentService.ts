// services/tournamentService.ts
// Tournament service with support for multiple modes (League, Swiss, Swiss Hybrid, Enhanced Elimination)

import db from '../config/database';
import {
  TournamentConfigUnion,
  TournamentType,
  EliminationConfig,
  SwissConfig,
  LeagueConfig,
  SwissHybridConfig,
  TournamentStanding,
  SwissPairing,
  LeagueStanding,
  isEliminationConfig,
  isSwissConfig,
  isLeagueConfig,
  isSwissHybridConfig,
} from '../types/tournament';

class TournamentService {
  /**
   * Get tournament configuration by ID
   */
  async getTournamentConfig(tournamentId: number): Promise<TournamentConfigUnion | null> {
    try {
      const query = `
        SELECT 
          tournament_id,
          tournament_name,
          tournament_status,
          tournament_type,
          
          -- Liga
          league_type,
          
          -- Suizo
          swiss_rounds,
          
          -- Suizo Mixto
          swiss_hybrid_rounds,
          finalists_count,
          
          -- Eliminación Mejorada
          elimination_type,
          elimination_matches_dieciseisavos,
          elimination_matches_octavos,
          elimination_matches_cuartos,
          elimination_matches_semis,
          elimination_matches_final,
          
          -- General
          points_win,
          points_loss,
          points_bye,
          series_format_swiss,
          series_format_finals,
          tiebreaker_1,
          tiebreaker_2,
          tiebreaker_3
        FROM tournaments
        WHERE tournament_id = $1
      `;
      
      const result = await db.query(query, [tournamentId]);
      
      if (!result.rows || result.rows.length === 0) {
        return null;
      }
      
      const config = result.rows[0] as TournamentConfigUnion;
      return config;
    } catch (error) {
      console.error('Error fetching tournament config:', error);
      throw error;
    }
  }

  /**
   * Create tournament with specific type and configuration
   */
  async createTournament(
    tournamentName: string,
    tournamentType: TournamentType,
    config: Partial<TournamentConfigUnion>
  ): Promise<number> {
    try {
      const configAny = config as any;
      const query = `
        INSERT INTO tournaments (
          tournament_name,
          tournament_status,
          tournament_type,
          league_type,
          swiss_rounds,
          swiss_hybrid_rounds,
          finalists_count,
          elimination_type,
          elimination_matches_dieciseisavos,
          elimination_matches_octavos,
          elimination_matches_cuartos,
          elimination_matches_semis,
          elimination_matches_final,
          points_win,
          points_loss,
          points_bye,
          series_format_swiss,
          series_format_finals,
          tiebreaker_1,
          tiebreaker_2,
          tiebreaker_3
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20, $21)
        RETURNING id
      `;
      
      const result = await db.query(query, [
        tournamentName,
        'pending',
        tournamentType,
        configAny.league_type ?? null,
        configAny.swiss_rounds ?? null,
        configAny.swiss_hybrid_rounds ?? null,
        configAny.finalists_count ?? null,
        configAny.elimination_type ?? null,
        (isEliminationConfig(config as any) ? (config as any).elimination_matches_dieciseisavos : 1) ?? 1,
        (isEliminationConfig(config as any) ? (config as any).elimination_matches_octavos : 1) ?? 1,
        (isEliminationConfig(config as any) ? (config as any).elimination_matches_cuartos : 1) ?? 1,
        (isEliminationConfig(config as any) ? (config as any).elimination_matches_semis : 1) ?? 1,
        (isEliminationConfig(config as any) ? (config as any).elimination_matches_final : 1) ?? 1,
        configAny.points_win ?? 3,
        configAny.points_loss ?? 0,
        configAny.points_bye ?? 1,
        configAny.series_format_swiss ?? null,
        configAny.series_format_finals ?? null,
        configAny.tiebreaker_1 ?? 'points',
        configAny.tiebreaker_2 ?? null,
        configAny.tiebreaker_3 ?? null,
      ]);
      
      return result.rows[0]?.id || 0;
    } catch (error) {
      console.error('Error creating tournament:', error);
      throw error;
    }
  }

  /**
   * Get tournament standings for current round
   */
  async getStandings(
    tournamentId: number,
    roundId?: number
  ): Promise<TournamentStanding[]> {
    try {
      let query = `
        SELECT *
        FROM tournament_standings
        WHERE tournament_id = $1
      `;
      
      const params: any[] = [tournamentId];
      
      if (roundId) {
        query += ` AND tournament_round_id = $2`;
        params.push(roundId);
      }
      
      query += ` ORDER BY current_rank ASC`;
      
      const result = await db.query(query, params);
      return (result.rows || []) as TournamentStanding[];
    } catch (error) {
      console.error('Error fetching standings:', error);
      throw error;
    }
  }

  /**
   * Get league standings
   */
  async getLeagueStandings(tournamentId: number): Promise<LeagueStanding[]> {
    try {
      const query = `
        SELECT *
        FROM league_standings
        WHERE tournament_id = $1
        ORDER BY league_position ASC
      `;
      
      const result = await db.query(query, [tournamentId]);
      return (result.rows || []) as LeagueStanding[];
    } catch (error) {
      console.error('Error fetching league standings:', error);
      throw error;
    }
  }

  /**
   * Get swiss pairings for a round
   */
  async getSwissPairings(
    tournamentId: number,
    roundId: number
  ): Promise<SwissPairing[]> {
    try {
      const query = `
        SELECT *
        FROM swiss_pairings
        WHERE tournament_id = $1 AND tournament_round_id = $2
        ORDER BY pairing_number ASC
      `;
      
      const result = await db.query(query, [tournamentId, roundId]);
      return (result.rows || []) as SwissPairing[];
    } catch (error) {
      console.error('Error fetching swiss pairings:', error);
      throw error;
    }
  }

  /**
   * Save standings after a round
   */
  async saveStandings(
    tournamentId: number,
    roundId: number,
    standings: Omit<TournamentStanding, 'id' | 'created_at' | 'updated_at'>[]
  ): Promise<void> {
    try {
      // Delete existing standings for this round
      await db.query(
        'DELETE FROM tournament_standings WHERE tournament_id = $1 AND tournament_round_id = $2',
        [tournamentId, roundId]
      );
      
      // Insert new standings
      for (const standing of standings) {
        const query = `
          INSERT INTO tournament_standings (
            tournament_id,
            tournament_round_id,
            player_id,
            matches_played,
            matches_won,
            matches_lost,
            sets_won,
            sets_lost,
            total_points,
            current_rank,
            previous_rank
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
        `;
        
        await db.query(query, [
          standing.tournament_id,
          standing.tournament_round_id,
          standing.player_id,
          standing.matches_played,
          standing.matches_won,
          standing.matches_lost,
          standing.sets_won,
          standing.sets_lost,
          standing.total_points,
          standing.current_rank,
          standing.previous_rank ?? null,
        ]);
      }
    } catch (error) {
      console.error('Error saving standings:', error);
      throw error;
    }
  }

  /**
   * Get tournament configuration suggestions based on participant count
   */
  getSuggestions(participantCount: number): Record<string, any> {
    const suggestions: Record<string, any> = {};
    
    // Liga suggestions
    if (participantCount >= 4 && participantCount <= 32) {
      suggestions.league = {
        league_type: participantCount <= 8 ? 'double_round' : 'single_round',
        series_format: participantCount <= 8 ? 'bo1' : 'bo1',
        estimated_matches: 
          participantCount <= 8 
            ? participantCount * (participantCount - 1)  // double round
            : Math.floor(participantCount * (participantCount - 1) / 2),
      };
    }
    
    // Suizo suggestions
    if (participantCount >= 4) {
      const swissRounds = 
        participantCount <= 8 ? 3 :
        participantCount <= 16 ? 4 :
        participantCount <= 32 ? 5 : 6;
      
      suggestions.swiss = {
        swiss_rounds: swissRounds,
        series_format: participantCount <= 8 ? 'bo1' : 'bo1',
        estimated_matches: swissRounds * Math.floor(participantCount / 2),
      };
    }
    
    // Suizo Mixto suggestions
    if (participantCount >= 8) {
      let swissRounds = 0;
      let finalists = 0;
      
      if (participantCount <= 15) {
        swissRounds = 3;
        finalists = 4;
      } else if (participantCount <= 31) {
        swissRounds = 4;
        finalists = 8;
      } else if (participantCount <= 63) {
        swissRounds = 5;
        finalists = 16;
      } else {
        swissRounds = 5;
        finalists = 16;
      }
      
      suggestions.swiss_hybrid = {
        swiss_hybrid_rounds: swissRounds,
        finalists_count: finalists,
        elimination_phases: this.getEliminationPhases(finalists),
        estimated_swiss_matches: swissRounds * Math.floor(participantCount / 2),
        estimated_elimination_matches: finalists - 1, // Single elimination
      };
    }
    
    // Eliminación suggestions
    if (participantCount >= 2) {
      suggestions.elimination = {
        elimination_type: 'single',
        finalists_count: this.getNearestPowerOf2(participantCount),
        elimination_phases: this.getEliminationPhases(this.getNearestPowerOf2(participantCount)),
        series_format_eliminations: participantCount <= 8 ? 'bo1' : 'bo1',
        series_format_final: 'bo3',
        estimated_matches: this.getNearestPowerOf2(participantCount) - 1,
      };
    }
    
    return suggestions;
  }

  /**
   * Get elimination phases (octavos, cuartos, semis, final)
   */
  private getEliminationPhases(finalists: number): string[] {
    const phases: string[] = [];
    
    if (finalists >= 16) phases.push('dieciseisavos');
    if (finalists >= 8) phases.push('octavos');
    if (finalists >= 4) phases.push('cuartos');
    if (finalists >= 2) phases.push('semifinal');
    phases.push('final');
    
    return phases;
  }

  /**
   * Get nearest power of 2 for bracket size
   */
  private getNearestPowerOf2(n: number): number {
    if (n <= 2) return 2;
    if (n <= 4) return 4;
    if (n <= 8) return 8;
    if (n <= 16) return 16;
    if (n <= 32) return 32;
    if (n <= 64) return 64;
    return 128;
  }
}

export default new TournamentService();
