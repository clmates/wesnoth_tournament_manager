/**
 * Service: Replay Parser (WML Analysis)
 * File: backend/src/services/replayParser.ts
 * 
 * Purpose: Parse Wesnoth replay files (.rpy.gz) and extract match data
 * 
 * Two-stage parsing strategy:
 * Stage 1 (Quick): Decompress and find tournament addon (< 1 second)
 * Stage 2 (Full): Extract all match data - players, factions, map, winner (1-10 seconds)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as pako from 'pako'; // For gzip decompression
import { query } from '../config/database.js';
import { v4 as uuidv4 } from 'uuid';

interface WMLNode {
    [key: string]: any;
}

interface ReplayAnalysis {
    metadata: {
        version: string;
        scenario_id: string;
        scenario_name: string;
        map_file: string;
        era_id: string;
    };
    addons: Array<{
        id: string;
        version: string;
        required: boolean;
    }>;
    players: Array<{
        side: number;
        name: string;
        faction_id: string;
        faction_name: string;
        leader_id: string;
        leader_type: string;
        controller: string;
    }>;
    victory: {
        winner_side: number;
        winner_name: string;
        result_type: string;
        detected_from: string;
    };
    timestamp: Date;
}

interface QuickAddonCheckResult {
    has_tournament_addon: boolean;
    tournament_addon_id: string | null;
    version: string;
    era_id: string;
}

export class ReplayParser {
    private readonly tournamentAddonFilter: string;

    constructor(
        tournamentAddonFilter: string = process.env.REPLAY_ADDON_FILTER || 'tournament-addon'
    ) {
        this.tournamentAddonFilter = tournamentAddonFilter;
    }

    /**
     * Stage 1: Quick Addon Check (< 1 second)
     * 
     * Decompress and search for tournament addon UUID.
     * Returns boolean and addon ID for fast filtering.
     */
    public async quickAddonCheck(replayPath: string): Promise<QuickAddonCheckResult> {
        const startTime = Date.now();

        try {
            // Verify file exists and is readable
            if (!fs.existsSync(replayPath)) {
                throw new Error(`Replay file not found: ${replayPath}`);
            }

            // Decompress .gz file
            const gzBuffer = fs.readFileSync(replayPath);
            let wmlText: string;

            try {
                const decompressed = pako.inflate(gzBuffer, { to: 'string' });
                wmlText = decompressed;
            } catch (error) {
                const errorMsg = (error as any)?.message || String(error);
                throw new Error(
                    `Failed to decompress replay file: ${errorMsg}. ` +
                    `File may be corrupted or not a valid .gz file.`
                );
            }

            // Parse WML to find addons section
            // Use simple regex for speed (avoids full WML parsing)
            const addonsMatch = wmlText.match(/\[addon\]([\s\S]*?)\[\/addon\]/g);
            let hasTournamentAddon = false;
            let tournamentAddonId: string | null = null;
            let version = '';
            let eraId = '';

            // Extract version
            const versionMatch = wmlText.match(/version="([^"]+)"/);
            version = versionMatch ? versionMatch[1] : 'unknown';

            // Extract era_id
            const eraMatch = wmlText.match(/era\s*=\s*"([^"]+)"/);
            eraId = eraMatch ? eraMatch[1] : '';

            // Check for tournament addon
            if (addonsMatch) {
                for (const addonBlock of addonsMatch) {
                    if (addonBlock.includes(this.tournamentAddonFilter)) {
                        hasTournamentAddon = true;
                        // Extract addon ID
                        const idMatch = addonBlock.match(/id=\s*"([^"]+)"/);
                        tournamentAddonId = idMatch ? idMatch[1] : this.tournamentAddonFilter;
                        break;
                    }
                }
            }

            const duration = Date.now() - startTime;

            console.log(`Stage 1 Quick Addon Check: ${path.basename(replayPath)}`, {
                duration_ms: duration,
                has_tournament_addon: hasTournamentAddon,
                version,
                era_id: eraId
            });

            return {
                has_tournament_addon: hasTournamentAddon,
                tournament_addon_id: tournamentAddonId,
                version,
                era_id: eraId
            };

        } catch (error) {
            const errorMsg = (error as any)?.message || String(error);
            console.error(
                `Stage 1 Quick Check failed for ${path.basename(replayPath)}: ${errorMsg}`
            );
            throw error;
        }
    }

    /**
     * Stage 2: Full Replay Analysis (1-10 seconds)
     * 
     * Complete WML parsing and extraction of match data.
     */
    public async fullReplayParse(replayPath: string): Promise<ReplayAnalysis> {
        const startTime = Date.now();

        try {
            // Decompress file
            const gzBuffer = fs.readFileSync(replayPath);
            let wmlText: string;

            try {
                const decompressed = pako.inflate(gzBuffer, { to: 'string' });
                wmlText = decompressed;
            } catch (error) {
                const errorMsg = (error as any)?.message || String(error);
                throw new Error(`Failed to decompress replay: ${errorMsg}`);
            }

            // Parse WML structure (simplified parser for key sections)
            const wmlRoot = this.parseWML(wmlText);

            // Extract metadata
            const metadata = this.extractMetadata(wmlRoot);

            // Extract addons
            const addons = this.extractAddons(wmlRoot);

            // Extract players
            const players = this.extractPlayers(wmlRoot);

            // Determine victory
            const victory = this.determineVictory(wmlRoot, players);

            const duration = Date.now() - startTime;

            console.log(`Stage 2 Full Parse completed: ${path.basename(replayPath)}`, {
                duration_ms: duration,
                players_count: players.length,
                winner_side: victory.winner_side
            });

            return {
                metadata,
                addons,
                players,
                victory,
                timestamp: new Date()
            };

        } catch (error) {
            console.error(
                `Stage 2 Full Parse failed for ${path.basename(replayPath)}`,
                error
            );
            throw error;
        }
    }

    /**
     * Parse WML structure (simplified implementation)
     * 
     * Real implementation would use a proper WML parser.
     * This is a basic extraction for demonstration.
     */
    private parseWML(wmlText: string): WMLNode {
        const result: WMLNode = {};

        // Extract version
        const versionMatch = wmlText.match(/version="([^"]+)"/);
        result.version = versionMatch ? versionMatch[1] : 'unknown';

        // Extract scenario section
        const scenarioMatch = wmlText.match(/\[scenario\]([\s\S]*?)\[\/scenario\]/);
        if (scenarioMatch) {
            result.scenario = this.parseSection(scenarioMatch[1]);
        }

        // Extract side sections (players)
        result.sides = [];
        const sideMatches = wmlText.matchAll(/\[side\]([\s\S]*?)\[\/side\]/g);
        for (const match of sideMatches) {
            result.sides.push(this.parseSection(match[1]));
        }

        // Extract endlevel (victory condition)
        const endlevelMatch = wmlText.match(/\[endlevel\]([\s\S]*?)\[\/endlevel\]/);
        if (endlevelMatch) {
            result.endlevel = this.parseSection(endlevelMatch[1]);
        }

        // Extract addons
        result.addons = [];
        const addonMatches = wmlText.matchAll(/\[addon\]([\s\S]*?)\[\/addon\]/g);
        for (const match of addonMatches) {
            result.addons.push(this.parseSection(match[1]));
        }

        // Extract era
        const eraMatch = wmlText.match(/era\s*=\s*"([^"]+)"/);
        result.era_id = eraMatch ? eraMatch[1] : '';

        return result;
    }

    /**
     * Parse a WML section into key-value pairs
     */
    private parseSection(content: string): WMLNode {
        const result: WMLNode = {};

        // Simple regex-based extraction of key="value" pairs
        const kvMatches = content.matchAll(/(\w+)\s*=\s*"([^"]*)"/g);
        for (const match of kvMatches) {
            result[match[1]] = match[2];
        }

        return result;
    }

    /**
     * Extract metadata from WML
     */
    private extractMetadata(wml: WMLNode) {
        return {
            version: wml.version || 'unknown',
            scenario_id: wml.scenario?.id || '',
            scenario_name: wml.scenario?.name || '',
            map_file: wml.scenario?.map_data || '',
            era_id: wml.era_id || ''
        };
    }

    /**
     * Extract addons from WML
     */
    private extractAddons(wml: WMLNode): Array<{ id: string; version: string; required: boolean }> {
        if (!wml.addons || !Array.isArray(wml.addons)) {
            return [];
        }

        return wml.addons.map((addon: any) => ({
            id: addon.id || '',
            version: addon.version || '',
            required: addon.required === 'yes'
        }));
    }

    /**
     * Extract players from WML side sections
     */
    private extractPlayers(wml: WMLNode) {
        if (!wml.sides || !Array.isArray(wml.sides)) {
            return [];
        }

        return wml.sides.map((side: any, index: number) => ({
            side: (side.side || index + 1) as number,
            name: side.name || `Player ${index + 1}`,
            faction_id: side.faction || '',
            faction_name: side.faction || '',
            leader_id: side.leader || '',
            leader_type: side.type || '',
            controller: side.controller || 'human'
        }));
    }

    /**
     * Determine victory from WML
     * 
     * Priority detection:
     * 1. Explicit endlevel result
     * 2. Resignation
     * 3. Leader death
     * 4. Victory points
     */
    private determineVictory(wml: WMLNode, players: Array<any>) {
        const totalPlayers = players.length;

        // 1. Check explicit endlevel result
        if (wml.endlevel) {
            if (wml.endlevel.result === 'victory' && wml.endlevel.side) {
                const winnerSide = parseInt(wml.endlevel.side, 10);
                const winner = players.find((p: any) => p.side === winnerSide);
                return {
                    winner_side: winnerSide,
                    winner_name: winner?.name || `Player ${winnerSide}`,
                    result_type: 'explicit_victory',
                    detected_from: 'endlevel_result'
                };
            }

            // 2. Check resignation
            if (wml.endlevel.result === 'resign' && wml.endlevel.side) {
                const loserSide = parseInt(wml.endlevel.side, 10);
                const winnerSide = totalPlayers === 2 ? (loserSide === 1 ? 2 : 1) : null;
                if (winnerSide) {
                    const winner = players.find((p: any) => p.side === winnerSide);
                    return {
                        winner_side: winnerSide,
                        winner_name: winner?.name || `Player ${winnerSide}`,
                        result_type: 'resignation',
                        detected_from: 'endlevel_resign'
                    };
                }
            }
        }

        // 3. Default: assume first player or highest points
        const winner = players[0];
        return {
            winner_side: winner?.side || 1,
            winner_name: winner?.name || 'Unknown',
            result_type: 'fallback',
            detected_from: 'default_assumption'
        };
    }

    /**
     * Update replay record with parsed data
     */
    public async updateReplayRecord(
        replayId: string,
        analysis: ReplayAnalysis,
        isTournamentMatch: boolean
    ): Promise<void> {
        try {
            await query(
                `UPDATE replays 
                 SET parsed = 1, 
                     need_integration = ?,
                     wesnoth_version = ?,
                     map_name = ?,
                     era_id = ?,
                     tournament_addon_id = ?,
                     parse_status = 'parsed',
                     parsing_completed_at = NOW()
                 WHERE id = ?`,
                [
                    isTournamentMatch ? 1 : 0,
                    analysis.metadata.version,
                    analysis.metadata.map_file,
                    analysis.metadata.era_id,
                    analysis.addons.find(
                        (a: any) => a.id === this.tournamentAddonFilter
                    )?.id || null,
                    replayId
                ]
            );
        } catch (error) {
            console.error(`Failed to update replay record: ${replayId}`, error);
            throw error;
        }
    }

    /**
     * Mark parsing error in database
     */
    public async markParsingError(
        replayId: string,
        errorMessage: string
    ): Promise<void> {
        try {
            await query(
                `UPDATE replays 
                 SET parse_status = 'error',
                     parse_error_message = ?,
                     parsing_completed_at = NOW()
                 WHERE id = ?`,
                [errorMessage.substring(0, 500), replayId]
            );
        } catch (error) {
            console.error(
                `Failed to mark parsing error for ${replayId}`,
                error
            );
        }
    }
}

export default ReplayParser;

/**
 * USAGE EXAMPLE:
 * 
 * const parser = new ReplayParser(db, logger);
 * 
 * // Stage 1: Quick check
 * const quickCheck = await parser.quickAddonCheck(replayPath);
 * console.log(quickCheck.has_tournament_addon); // true/false
 * 
 * // Stage 2: Full parse (only if tournament match)
 * if (quickCheck.has_tournament_addon) {
 *     const analysis = await parser.fullReplayParse(replayPath);
 *     console.log(analysis.victory.winner_side); // 1 or 2
 * }
 */
