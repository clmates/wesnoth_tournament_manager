/**
 * Types & Interfaces for Replay Processing
 * File: backend/src/types/replay.ts
 * 
 * Shared type definitions for replay
 * parsing and match creation
 */

export interface ReplayFile {
    id: string;
    replay_filename: string;
    replay_path: string;
    file_size_bytes: number;
    parsed: boolean;
    need_integration: boolean;
    match_id: string | null;
    parse_status: 'pending' | 'parsing' | 'parsed' | 'error';
    parse_error_message: string | null;
    detected_at: Date;
    file_write_closed_at: Date | null;
    parsing_started_at: Date | null;
    parsing_completed_at: Date | null;
}

export interface ReplayMetadata {
    version: string;
    scenario_id: string;
    scenario_name: string;
    map_file: string;
    era_id: string;
}

export interface ReplayAddon {
    id: string;
    version: string;
    required: boolean;
}

export interface ReplayPlayer {
    side: number;
    name: string;
    faction_id: string;
    faction_name: string;
    leader_id: string;
    leader_type: string;
    controller: string;
}

export interface ReplayVictory {
    winner_side: number;
    winner_name: string;
    result_type:
        | 'explicit_victory'
        | 'resignation'
        | 'leadership_kill'
        | 'victory_points'
        | 'fallback';
    detected_from: string;
    confidence_level: 1 | 2; // 1=manual_confirm_needed, 2=auto_report
}

export interface ReplayAnalysis {
    metadata: ReplayMetadata;
    addons: ReplayAddon[];
    players: ReplayPlayer[];
    victory: ReplayVictory;
    timestamp: Date;
}

export interface QuickAddonCheckResult {
    has_tournament_addon: boolean;
    tournament_addon_id: string | null;
    version: string;
    era_id: string;
}

export interface ParseJobResult {
    parsed_count: number;
    tournament_matches: number;
    errors: number;
    duration_ms: number;
}

export interface AutoReportedMatch {
    id: string;
    winner_id: string;
    loser_id: string;
    map: string;
    winner_faction: string;
    loser_faction: string;
    status: 'auto_reported';
    auto_reported: boolean;
    replay_id: string;
    created_at: Date;
}

export interface MatchConfirmation {
    match_id: string;
    confirming_player_id: string;
    confirmer_type: 'winner' | 'loser';
    comment?: string;
    opponent_rating?: number;
    confirmed_at: Date;
}

export const VictoryTypes = {
    EXPLICIT_VICTORY: 'explicit_victory',
    RESIGNATION: 'resignation',
    LEADERSHIP_KILL: 'leadership_kill',
    VICTORY_POINTS: 'victory_points',
    FALLBACK: 'fallback'
} as const;

export const ParseStatus = {
    PENDING: 'pending',
    PARSING: 'parsing',
    PARSED: 'parsed',
    ERROR: 'error'
} as const;

export const MatchStatus = {
    UNCONFIRMED: 'unconfirmed',
    AUTO_REPORTED: 'auto_reported',
    CONFIRMED: 'confirmed',
    VERIFIED: 'verified',
    DISPUTED: 'disputed',
    REJECTED: 'rejected'
} as const;

export const AuditEventTypes = {
    REPLAY_DETECTED: 'REPLAY_DETECTED',
    REPLAY_PARSING_STARTED: 'REPLAY_PARSING_STARTED',
    REPLAY_PARSED_SUCCESS: 'REPLAY_PARSED_SUCCESS',
    REPLAY_PARSED_ERROR: 'REPLAY_PARSED_ERROR',
    REPLAY_TOURNAMENT_MATCH: 'REPLAY_TOURNAMENT_MATCH',
    MATCH_AUTO_CREATED: 'MATCH_AUTO_CREATED',
    MATCH_CONFIRMED_WINNER: 'MATCH_CONFIRMED_WINNER',
    MATCH_CONFIRMED_LOSER: 'MATCH_CONFIRMED_LOSER'
} as const;
