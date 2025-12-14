// types/tournament.ts
// Tournament modes and configuration types

export type TournamentType = 'elimination' | 'league' | 'swiss' | 'swiss_hybrid';
export type EliminationType = 'single' | 'double';
export type LeagueType = 'single_round' | 'double_round';
export type BestOfFormat = 'bo1' | 'bo3' | 'bo5' | 'bo7';
export type MatchStatus = 'pending' | 'completed' | 'cancelled';
export type RoundType = 'regular' | 'octavos' | 'cuartos' | 'semifinal' | 'final' | 'dieciseisavos';
export type TiebreakerType = 'points' | 'head_to_head' | 'set_diff' | 'mayor_victorias';

// Base tournament configuration
export interface TournamentConfig {
  tournament_type: TournamentType;
  tournament_id: number;
  tournament_name: string;
  tournament_status: string;
  
  // General configuration
  points_win: number;
  points_loss: number;
  points_bye: number;
  series_format_swiss?: BestOfFormat;
  series_format_finals?: BestOfFormat;
  
  // Tiebreaker configuration
  tiebreaker_1: TiebreakerType;
  tiebreaker_2?: TiebreakerType;
  tiebreaker_3?: TiebreakerType;
}

// League-specific configuration
export interface LeagueConfig extends TournamentConfig {
  tournament_type: 'league';
  league_type: LeagueType;
  series_format: BestOfFormat;
}

// Swiss system configuration
export interface SwissConfig extends TournamentConfig {
  tournament_type: 'swiss';
  swiss_rounds: number;
  series_format: BestOfFormat;
  bye_points: number;
}

// Swiss Hybrid configuration
export interface SwissHybridConfig extends TournamentConfig {
  tournament_type: 'swiss_hybrid';
  swiss_hybrid_rounds: number;
  finalists_count: number;
  series_format_swiss: BestOfFormat;
  series_format_eliminations: BestOfFormat;
  series_format_final?: BestOfFormat;
  elimination_type: EliminationType;
}

// Enhanced Elimination configuration
export interface EliminationConfig extends TournamentConfig {
  tournament_type: 'elimination';
  elimination_type: EliminationType;
  finalists_count?: number;
  
  // Matches per phase (default 1 for backward compatibility)
  elimination_matches_dieciseisavos: number;
  elimination_matches_octavos: number;
  elimination_matches_cuartos: number;
  elimination_matches_semis: number;
  elimination_matches_final: number;
  
  // Series format
  series_format_eliminations: BestOfFormat;
  series_format_final?: BestOfFormat;
}

// Union type for all configs
export type TournamentConfigUnion = 
  | LeagueConfig 
  | SwissConfig 
  | SwissHybridConfig 
  | EliminationConfig;

// Round information
export interface TournamentRound {
  tournament_round_id: number;
  tournament_id: number;
  round_number: number;
  round_type: RoundType;
  round_order_in_phase?: number;
  is_bye_round: boolean;
  max_points_possible?: number;
  standings_snapshot?: unknown;
  promoted_count?: number;
  round_status: string;
  created_at: Date;
  updated_at: Date;
}

// Tournament standings entry
export interface TournamentStanding {
  id: number;
  tournament_id: number;
  tournament_round_id: number;
  player_id: number;
  
  // Statistics
  matches_played: number;
  matches_won: number;
  matches_lost: number;
  sets_won: number;
  sets_lost: number;
  total_points: number;
  
  // Ranking
  current_rank: number;
  previous_rank?: number;
  
  created_at: Date;
  updated_at: Date;
}

// Swiss pairing
export interface SwissPairing {
  id: number;
  tournament_id: number;
  tournament_round_id: number;
  
  player1_id: number;
  player2_id: number;
  
  winner_id?: number;
  match_status: MatchStatus;
  tournament_match_id?: number;
  
  pairing_number: number;
  table_number?: number;
  
  created_at: Date;
  updated_at: Date;
}

// League standing
export interface LeagueStanding {
  id: number;
  tournament_id: number;
  player_id: number;
  
  league_position: number;
  league_matches_played: number;
  league_matches_won: number;
  league_matches_lost: number;
  league_sets_won: number;
  league_sets_lost: number;
  league_total_points: number;
  
  head_to_head_record?: string;
  set_difference: number;
  
  updated_at: Date;
}

// Helper type guards
export function isLeagueConfig(config: TournamentConfigUnion): config is LeagueConfig {
  return config.tournament_type === 'league';
}

export function isSwissConfig(config: TournamentConfigUnion): config is SwissConfig {
  return config.tournament_type === 'swiss';
}

export function isSwissHybridConfig(config: TournamentConfigUnion): config is SwissHybridConfig {
  return config.tournament_type === 'swiss_hybrid';
}

export function isEliminationConfig(config: TournamentConfigUnion): config is EliminationConfig {
  return config.tournament_type === 'elimination';
}
