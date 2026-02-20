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
        confidence_level: 1 | 2; // 1=manual_confirm_needed, 2=auto_report
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
     * Decompress replay file based on extension
     * Supports both .bz2 and .gz formats
     */
    private async decompressReplay(replayPath: string): Promise<string> {
        const filename = path.basename(replayPath);
        const fileBuffer = fs.readFileSync(replayPath);
        let wmlText: string;

        try {
            // Detect format by file extension
            if (filename.endsWith('.bz2')) {
                // BZ2 decompression
                const bz2Module = await import('bz2');
                let decompress = bz2Module.decompress || bz2Module.default?.decompress;
                
                if (!decompress && typeof bz2Module === 'function') {
                    decompress = bz2Module;
                }

                if (typeof decompress !== 'function') {
                    throw new Error('bz2.decompress is not available');
                }

                const decompressedData = decompress(fileBuffer);
                wmlText = Buffer.from(decompressedData).toString('utf-8');
            } else {
                // GZIP decompression (default for .gz, .rpy.gz, etc.)
                const decompressed = pako.inflate(fileBuffer, { to: 'string' });
                wmlText = decompressed;
            }

            return wmlText;
        } catch (error) {
            const errorMsg = (error as any)?.message || String(error);
            throw new Error(
                `Failed to decompress replay file (${filename}): ${errorMsg}. ` +
                `File may be corrupted or not in a supported format (.bz2 or .gz).`
            );
        }
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

            // Decompress replay file (auto-detects .bz2 or .gz)
            const wmlText = await this.decompressReplay(replayPath);

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
            // Decompress replay file (auto-detects .bz2 or .gz)
            const wmlText = await this.decompressReplay(replayPath);

            // Parse WML structure (simplified parser for key sections)
            const wmlRoot = this.parseWML(wmlText);

            // Extract metadata
            const metadata = this.extractMetadata(wmlRoot);

            // VALIDATION: Check if this is a real match (not map selection/preview)
            const validationError = this.validateReplayIsRealMatch(wmlRoot, metadata);
            if (validationError) {
                console.log(`ℹ️  [DISCARD] ${path.basename(replayPath)}: ${validationError}`);
                throw new Error(`DISCARD: ${validationError}`);
            }

            // Extract addons
            const addons = this.extractAddons(wmlRoot);

            // Extract players
            const players = this.extractPlayers(wmlRoot);

            // Determine victory
            let victory = this.determineVictory(wmlRoot, players, wmlText);
            
            // DEBUG LOG: Show what we parsed
            console.log(`[DEBUG] Replay Parse Results for ${path.basename(replayPath)}:`, {
                map: metadata.scenario_name,
                players_count: players.length,
                players: players.map(p => ({ side: p.side, name: p.name, faction: p.faction_name })),
                endlevel_detected: !!wmlRoot.endlevel,
                endlevel_result: wmlRoot.endlevel?.result || 'none',
                endlevel_side: wmlRoot.endlevel?.side || 'none',
                victory_result_type: victory.result_type,
                victory_winner_side: victory.winner_side,
                victory_winner_name: victory.winner_name
            });

            // FALLBACK: Comprehensive faction extraction from ALL WML sources
            const hasUnknownFactions = players.some((p: any) => 
                p.faction_name === 'Unknown' || p.faction_name === 'Custom'
            );
            
            if (hasUnknownFactions) {
                console.log(`🔍 [FACTION HUNT] Detected Unknown/Custom factions, searching entire WML...`);
                const factionInfo = this.extractComprehensiveFactionInfo(wmlText, players);
                
                // Enrich player data with extracted faction info
                for (let i = 0; i < players.length; i++) {
                    const playerName = players[i].name;
                    const factionData = factionInfo.get(playerName);
                    
                    if (factionData && (players[i].faction_name === 'Unknown' || players[i].faction_name === 'Custom')) {
                        console.log(`💫 [ENRICH] ${playerName}: ${players[i].faction_name} (conf=${factionData.confidence}) → ${factionData.faction_name}`);
                        players[i].faction_name = factionData.faction_name;
                        players[i].faction_id = factionData.faction_id;
                    }
                }
                
                // Try to detect surrender victory
                const surrenderVictory = this.detectSurrenderVictory(wmlRoot, players, wmlText);
                if (surrenderVictory.detected && surrenderVictory.winner_side) {
                    const winner = players.find((p: any) => p.side === surrenderVictory.winner_side);
                    victory = {
                        winner_side: surrenderVictory.winner_side,
                        winner_name: winner?.name || `Player ${surrenderVictory.winner_side}`,
                        result_type: 'surrender',
                        detected_from: 'server_surrender_message',
                        confidence_level: 2 as const // AUTO: Clear surrender via server message
                    };
                }
            }

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

        // Extract scenario section - IMPORTANT: Handle game reloads where [scenario] appears multiple times
        // ALWAYS take the LAST (most recent) [scenario] block for post-reload state
        let lastScenarioMatch: RegExpMatchArray | null = null;
        const scenarioRegex = /\[scenario\]([\s\S]*?)\[\/scenario\]/g;
        
        for (const match of wmlText.matchAll(scenarioRegex)) {
            lastScenarioMatch = match as RegExpMatchArray;
        }
        
        if (lastScenarioMatch) {
            const scenarioContent = lastScenarioMatch[1];
            result.scenario = this.parseSection(scenarioContent);
            
            // Extract name/scenario - can be named scenario, name, or mp_scenario_name
            // Try multiple field names as different Wesnoth versions use different conventions
            const scenarioMatch2 = scenarioContent.match(/scenario\s*=\s*"([^"]+)"/);
            const nameMatch = scenarioContent.match(/name\s*=\s*"([^"]+)"/);
            const idMatch = scenarioContent.match(/id\s*=\s*"([^"]+)"/);
            
            if (scenarioMatch2) result.scenario.scenario = scenarioMatch2[1];
            if (nameMatch) result.scenario.name = nameMatch[1];
            if (idMatch) result.scenario.id = idMatch[1];
        }

        // Extract side sections (players) - Handle reload/pause cases where [side] appears multiple times
        // IMPORTANT: After game reload/pause, [side] blocks can appear multiple times for same side#
        // We ALWAYS take the LAST occurrence of each side number (most recent state)
        result.sides = [];
        const sideRegex = /\[side\]([\s\S]*?)\[\/side\]/g;
        const sidesByNumber = new Map<number, {data: WMLNode, fileOrder: number}>();
        let sideCount = 0;
        
        // First pass: collect all [side] blocks indexed by side number
        for (const match of wmlText.matchAll(sideRegex)) {
            sideCount++;
            const sideData = this.parseSection(match[1]);
            const sideNum = parseInt(sideData.side || '0', 10);
            
            if (sideNum > 0) {
                // Always overwrite with newer occurrence (later in file = after reload)
                sidesByNumber.set(sideNum, {
                    data: sideData,
                    fileOrder: sideCount  // Track which occurrence this was
                });
            }
        }
        
        // Convert to array sorted by side number
        result.sides = Array.from(sidesByNumber.entries())
            .sort((a, b) => a[0] - b[0])  // Sort by side number
            .map(([sideNum, entry]) => ({...entry.data, side: sideNum}));
        
        // Log reload detection if found
        if (sideCount > result.sides.length) {
            console.log(`[INFO] Replay reload/pause detected: ${sideCount} [side] blocks found, ${result.sides.length} unique sides`);
            for (const [sideNum, entry] of sidesByNumber.entries()) {
                const totalOccurrences = sideCount / result.sides.length;  // Approximate
                console.log(`  - Side ${sideNum}: occurrence #${entry.fileOrder}, player="${entry.data.current_player}"`);
            }
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
     * Handles various key formats: word chars, underscores, dots
     */
    private parseSection(content: string): WMLNode {
        const result: WMLNode = {};

        // Extract key="value" pairs - supports word chars, underscores, dots in keys
        const kvMatches = content.matchAll(/([\w._-]+)\s*=\s*"([^"]*)"/g);
        for (const match of kvMatches) {
            result[match[1]] = match[2];
        }

        return result;
    }

    /**
     * Extract metadata from WML
     * Captures: version, scenario ID, scenario name (map), era
     */
    /**
     * Validate if replay is a real match (not map selection/preview)
     * Returns null if valid, error message if should be discarded
     */
    private validateReplayIsRealMatch(wml: WMLNode, metadata: any): string | null {
        // Extract map name
        const mapName = metadata.scenario_name || '';
        
        // Discard if map is '$next_scenario' (placeholder, not real map)
        if (mapName === '$next_scenario' || mapName.includes('$next_scenario')) {
            return 'Map selection/scouting phase ($next_scenario placeholder)';
        }
        
        // Extract turn number
        const turn = parseInt(wml.turn || '0', 10);
        
        // Discard if turn is 0 or 1 AND map is placeholder
        if ((turn === 0 || turn === 1) && (mapName === '' || mapName === 'Unknown')) {
            return 'Map preview/selection phase (turn 0-1, no real map)';
        }
        
        return null; // Valid match
    }

    private extractMetadata(wml: WMLNode) {
        // Extract map name - PRIORITY ORDER:
        // 1. scenario field (Wesnoth convention)
        // 2. mp_scenario_name (multiplayer specific name)
        // 3. name field (default name)
        // 4. Empty if nothing found
        let mapName = '';
        
        if (wml.scenario) {
            // Try scenario field first (primary convention in ladder maps)
            if (wml.scenario.scenario && typeof wml.scenario.scenario === 'string') {
                mapName = wml.scenario.scenario.trim();
            }
            // Try mp_scenario_name next (multiplayer maps)
            else if (wml.scenario.mp_scenario_name && typeof wml.scenario.mp_scenario_name === 'string') {
                mapName = wml.scenario.mp_scenario_name.trim();
            }
            // Fall back to name field
            else if (wml.scenario.name && typeof wml.scenario.name === 'string') {
                mapName = wml.scenario.name.trim();
            }
        }
        
        // Clean up map name - remove common prefixes
        mapName = mapName.replace(/^2p\s*[—-]\s*/i, '');  // "2p — " or "2p - "
        mapName = mapName.replace(/^\d+p\s*[—-]\s*/i, ''); // "3p — ", "4p — ", etc.
        
        // If still empty, mark as Unknown
        if (!mapName) {
            mapName = 'Unknown';
        }
        
        return {
            version: wml.version || 'unknown',
            scenario_id: wml.scenario?.id || '',
            scenario_name: mapName,
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
     * Captures: side number, player name, faction (ID and display name)
     * Handles reload/pause cases: deduplicates by player name, keeps latest data
     */
    private extractPlayers(wml: WMLNode) {
        if (!wml.sides || !Array.isArray(wml.sides)) {
            return [];
        }

        // Use a Map keyed by player name to handle reload cases
        // If same player appears multiple times (from reload/pause), keep only the latest
        const playerMap = new Map<string, any>();
        
        wml.sides.forEach((side: any, index: number) => {
            const sideNum = parseInt(side.side || String(index + 1), 10);
            const playerName = (side.current_player || side.name || `Player ${sideNum}`).trim();
            
            // faction_name can be "Drakes", "Undead", etc.
            // faction_id is the internal identifier
            // Both may be prefixed with underscore (internationalization)
            let factionName = side.faction_name || side.faction || 'Unknown';
            factionName = factionName.replace(/^_/, '');  // Remove underscore prefix if present
            
            const player = {
                side: sideNum,
                name: playerName,
                faction_id: side.faction || '',
                faction_name: factionName,
                leader_id: side.leader || '',
                leader_type: side.type || '',
                controller: side.controller || 'human'
            };
            
            // Use player name as key (handles reload/pause where same player reappears)
            const mapKey = playerName;
            
            if (playerMap.has(mapKey)) {
                console.log(`[DEBUG] extractPlayers: Player "${playerName}" appears multiple times (reload/pause), keeping latest version`);
            }
            
            playerMap.set(mapKey, player);
        });
        
        // Convert Map to array, sorted by side number
        return Array.from(playerMap.values()).sort((a, b) => a.side - b.side);
    }

    /**
     * Extract player info from [old_sideN] blocks (fallback source of truth)
     * These blocks contain accurate faction and player names
     */
    /**
     * Comprehensive faction information extraction from multiple WML sources
     * Searches the ENTIRE WML text for all possible faction references
     * Returns faction info mapped by player name
     */
    private extractComprehensiveFactionInfo(wmlText: string, players: Array<any>): Map<string, { faction_name: string; faction_id: string; confidence: number }> {
        const factionMap = new Map<string, { faction_name: string; faction_id: string; confidence: number }>();
        
        // Strategy: Build a map of player → faction from all possible sources
        // Priority order:
        // 1. [old_sideN] blocks with faction= (most reliable when not "Custom")
        // 2. All [side] blocks in the WML (not just first one)
        // 3. previous_recruits entries (infer faction from unit names)
        
        // === Source 1: Extract from ALL [old_sideN] blocks ===
        const oldSideRegex = /\[old_side(\d+)\]([\s\S]*?)\[\/old_side\d+\]/g;
        let match;
        while ((match = oldSideRegex.exec(wmlText)) !== null) {
            const blockContent = match[2];
            
            // Extract current_player
            const playerMatch = blockContent.match(/current_player\s*=\s*"([^"]+)"/);
            const playerName = playerMatch ? playerMatch[1].trim() : null;
            
            // Extract faction (prefer faction_name if available)
            const factionNameMatch = blockContent.match(/faction_name\s*=\s*"([^"]+)"/);
            const factionIdMatch = blockContent.match(/faction\s*=\s*"([^"]+)"/);
            
            const factionName = factionNameMatch ? factionNameMatch[1].trim() : null;
            const factionId = factionIdMatch ? factionIdMatch[1].trim() : null;
            
            if (playerName && factionName && factionName !== 'Custom') {
                factionMap.set(playerName, {
                    faction_name: factionName,
                    faction_id: factionId || factionName,
                    confidence: 3 // HIGH: From [old_sideN] and not Custom
                });
                console.log(`✅ [old_sideN] Found faction for ${playerName}: ${factionName}`);
            }
        }
        
        // === Source 2: Extract from ALL [side] blocks (including non-initial ones) ===
        const sideRegex = /\[side\]([\s\S]*?)\[\/side\]/g;
        while ((match = sideRegex.exec(wmlText)) !== null) {
            const blockContent = match[1];
            
            const playerMatch = blockContent.match(/current_player\s*=\s*"([^"]+)"/);
            const playerName = playerMatch ? playerMatch[1].trim() : null;
            
            const factionNameMatch = blockContent.match(/faction_name\s*=\s*"([^"]+)"/);
            const factionIdMatch = blockContent.match(/faction\s*=\s*"([^"]+)"/);
            
            const factionName = factionNameMatch ? factionNameMatch[1].trim() : null;
            const factionId = factionIdMatch ? factionIdMatch[1].trim() : null;
            
            // Only use if faction is NOT "Custom" or if we don't have better info yet
            if (playerName && factionName && factionName !== 'Custom') {
                const existing = factionMap.get(playerName);
                if (!existing || existing.confidence < 2) {
                    factionMap.set(playerName, {
                        faction_name: factionName,
                        faction_id: factionId || factionName,
                        confidence: 2 // MEDIUM: From [side] block and not Custom
                    });
                    console.log(`✅ [side] Found faction for ${playerName}: ${factionName}`);
                }
            }
        }
        
        // === Source 3: Infer faction from previous_recruits (unit names reveal faction) ===
        // Example: "L_Goblin Spearman,L_Naga Fighter,L_Undead..." reveals faction
        const recruitsRegex = /previous_recruits\s*=\s*"([^"]+)"/g;
        while ((match = recruitsRegex.exec(wmlText)) !== null) {
            const recruitsStr = match[1];
            
            // Parse who recruited these units (find the side/player this belongs to)
            // We need context - look backward for current_player
            const contextStart = Math.max(0, match.index - 500);
            const context = wmlText.substring(contextStart, match.index + 100);
            
            const playerMatch = context.match(/current_player\s*=\s*"([^"]+)"/);
            const playerName = playerMatch ? playerMatch[1].trim() : null;
            
            if (playerName && !factionMap.has(playerName)) {
                // Try to infer faction from unit names
                // L_Undead_* → Undead, L_Drake_* → Drake, L_Goblin_* → Goblin, etc.
                const inferredFaction = this.inferFactionFromUnitNames(recruitsStr);
                if (inferredFaction && inferredFaction !== 'Custom') {
                    factionMap.set(playerName, {
                        faction_name: inferredFaction,
                        faction_id: inferredFaction.toLowerCase(),
                        confidence: 1 // LOW: Inferred from unit names
                    });
                    console.log(`✅ [units] Inferred faction for ${playerName}: ${inferredFaction}`);
                }
            }
        }
        
        return factionMap;
    }
    
    /**
     * Infer faction from unit type names
     * Examples: L_Drake Warrior → Drake, L_Undead Knight → Undead, etc.
     */
    private inferFactionFromUnitNames(recruitsStr: string): string | null {
        const units = recruitsStr.split(',').map(u => u.trim());
        
        // Extract faction keyword from unit names
        // Format is usually: L_<Faction> <Type> [modifiers]
        const factionCounts: Map<string, number> = new Map();
        
        for (const unit of units) {
            // Remove "L_" prefix and "Ladder_N" suffix
            let cleaned = unit.replace(/^L_/, '').replace(/[\s_]Ladder_\d+$/, '');
            
            // Extract faction word (first word before space or end)
            const factionMatch = cleaned.match(/^([A-Za-z]+)/);
            if (factionMatch) {
                const faction = factionMatch[1];
                factionCounts.set(faction, (factionCounts.get(faction) || 0) + 1);
            }
        }
        
        // Return most common faction keyword
        if (factionCounts.size === 0) return null;
        
        let mostCommon = 'Custom';
        let maxCount = 0;
        for (const [faction, count] of factionCounts) {
            if (count > maxCount) {
                maxCount = count;
                mostCommon = faction;
            }
        }
        
        return mostCommon !== 'Custom' ? mostCommon : null;
    }

    private extractOldSideInfo(wml: WMLNode): Array<{
        side: number;
        player_name: string;
        faction_name: string;
        faction_id: string;
    }> {
        const oldSideInfo: Array<any> = [];
        
        // Look for [old_side1], [old_side2], etc.
        for (let i = 1; i <= 10; i++) {
            const oldSideKey = `old_side${i}`;
            if (wml[oldSideKey]) {
                const sideData = wml[oldSideKey];
                oldSideInfo.push({
                    side: i,
                    player_name: sideData.current_player || `Player ${i}`,
                    faction_name: sideData.faction_name || sideData.faction || 'Unknown',
                    faction_id: sideData.faction || 'unknown'
                });
            }
        }
        
        return oldSideInfo;
    }

    /**
     * Detect surrender victory from server messages in replay
     * Looks for: "PlayerName has surrendered." in [speak] blocks with id="server"
     * Searches in raw wmlText directly for robustness
     * Returns player name who surrendered (loser) and winning side
     */
    private detectSurrenderVictory(wml: WMLNode, players: Array<any>, wmlText?: string): {
        winner_side: number | null;
        loser_name: string | null;
        detected: boolean;
    } {
        // Primary: Search in raw wmlText for direct pattern matching
        if (wmlText) {
            // Search for server surrender messages
            // Format: message="PlayerName has surrendered."
            const surrenderRegex = /message\s*=\s*"([^"]+)\s+has\s+surrendered\."/gi;
            const matches = wmlText.matchAll(surrenderRegex);
            
            for (const match of matches) {
                const surrenderPlayer = match[1].trim();
                const loserSide = players.find((p: any) => p.name === surrenderPlayer)?.side;
                
                if (loserSide && players.length === 2) {
                    const winnerSide = loserSide === 1 ? 2 : 1;
                    console.log(`[DEBUG] Surrender detected: "${surrenderPlayer}" (side ${loserSide}) → Winner: side ${winnerSide}`);
                    return {
                        winner_side: winnerSide,
                        loser_name: surrenderPlayer,
                        detected: true
                    };
                }
            }
        }

        // Fallback: Look in command blocks (for structured WML)
        const commands = wml.command || [];
        const commandArray = Array.isArray(commands) ? commands : [commands];
        
        for (const command of commandArray) {
            if (command.speak && typeof command.speak === 'object') {
                const message = command.speak.message || '';
                // Match pattern: "PlayerName has surrendered."
                const surrenderMatch = message.match(/^(.+)\s+has\s+surrendered\.$/i);
                
                if (surrenderMatch) {
                    const surrenderPlayer = surrenderMatch[1].trim();
                    const loserSide = players.find((p: any) => p.name === surrenderPlayer)?.side;
                    
                    if (loserSide && players.length === 2) {
                        const winnerSide = loserSide === 1 ? 2 : 1;
                        return {
                            winner_side: winnerSide,
                            loser_name: surrenderPlayer,
                            detected: true
                        };
                    }
                }
            }
        }
        
        return {
            winner_side: null,
            loser_name: null,
            detected: false
        };
    }

    /**
     * Determine victory from WML
     * 
     * Priority detection (in order of confidence):
     * 1. Explicit endlevel result=victory (HIGHEST)
     * 2. Explicit endlevel result=resign (HIGH)
     * 3. Server surrender message (MEDIUM-HIGH)
     * 4. Surrender block presence (MEDIUM)
     * 5. Fallback: first player (LOW - needs manual confirmation)
     */
    private determineVictory(wml: WMLNode, players: Array<any>, wmlText?: string): {
        winner_side: number;
        winner_name: string;
        result_type: string;
        detected_from: string;
        confidence_level: 1 | 2;
    } {
        const totalPlayers = players.length;

        // 1. Check explicit endlevel result (highest confidence)
        if (wml.endlevel) {
            if (wml.endlevel.result === 'victory' && wml.endlevel.side) {
                const winnerSide = parseInt(wml.endlevel.side, 10);
                const winner = players.find((p: any) => p.side === winnerSide);
                return {
                    winner_side: winnerSide,
                    winner_name: winner?.name || `Player ${winnerSide}`,
                    result_type: 'explicit_victory',
                    detected_from: 'endlevel_victory',
                    confidence_level: 2 as const // AUTO: Clear explicit victory
                };
            }

            // 2. Check resignation (high confidence)
            if (wml.endlevel.result === 'resign' && wml.endlevel.side) {
                const loserSide = parseInt(wml.endlevel.side, 10);
                const winnerSide = totalPlayers === 2 ? (loserSide === 1 ? 2 : 1) : null;
                if (winnerSide) {
                    const winner = players.find((p: any) => p.side === winnerSide);
                    return {
                        winner_side: winnerSide,
                        winner_name: winner?.name || `Player ${winnerSide}`,
                        result_type: 'resignation',
                        detected_from: 'endlevel_resign',
                        confidence_level: 2 as const // AUTO: Clear resignation
                    };
                }
            }
        }

        // 3. Check for server-sent surrender message (medium-high confidence)
        // Format: "PlayerName has surrendered."
        const surrenderVictory = this.detectSurrenderVictory(wml, players, wmlText);
        if (surrenderVictory.detected && surrenderVictory.winner_side) {
            const winner = players.find((p: any) => p.side === surrenderVictory.winner_side);
            return {
                winner_side: surrenderVictory.winner_side,
                winner_name: winner?.name || `Player ${surrenderVictory.winner_side}`,
                result_type: 'surrender',
                detected_from: 'server_surrender_message',
                confidence_level: 2 as const // AUTO: Clear surrender via server message
            };
        }

        // 4. Default/Fallback: assume first player (LOW confidence - needs manual confirmation)
        const winner = players.find((p: any) => p.side === 1) || players[0];
        return {
            winner_side: winner?.side || 1,
            winner_name: winner?.name || 'Unknown',
            result_type: 'fallback',
            detected_from: 'default_assumption',
            confidence_level: 1 as const // MANUAL: Player must confirm
        };
    }

    /**
     * Update replay record with parsed data
     */
    public async updateReplayRecord(
        replayId: string,
        analysis: ReplayAnalysis,
        isTournamentMatch: boolean,
        parsingStartTime?: Date,
        parsingEndTime?: Date
    ): Promise<void> {
        try {
            const summary = this.generateSummary(analysis);
            const confidenceLevel = analysis.victory.confidence_level;
            
            // Format timestamps if provided
            let startTimeStr = parsingStartTime ? parsingStartTime.toISOString().slice(0, 19).replace('T', ' ') : null;
            let endTimeStr = parsingEndTime ? parsingEndTime.toISOString().slice(0, 19).replace('T', ' ') : null;
            
            await query(
                `UPDATE replays 
                 SET parsed = 1, 
                     need_integration = ?,
                     integration_confidence = ?,
                     wesnoth_version = ?,
                     map_name = ?,
                     era_id = ?,
                     tournament_addon_id = ?,
                     parse_status = 'completed',
                     parse_summary = ?,
                     parsing_started_at = COALESCE(?, parsing_started_at),
                     parsing_completed_at = COALESCE(?, NOW())
                 WHERE id = ?`,
                [
                    isTournamentMatch ? 1 : 0,
                    confidenceLevel, // 1=manual_confirm, 2=auto_report
                    analysis.metadata.version,
                    analysis.metadata.scenario_name,  // Use scenario_name which now contains proper map name
                    analysis.metadata.era_id,
                    analysis.addons.find(
                        (a: any) => a.id === this.tournamentAddonFilter
                    )?.id || null,
                    summary,
                    startTimeStr,
                    endTimeStr,
                    replayId
                ]
            );

            // Register participants if this is a tournament match
            if (isTournamentMatch) {
                await this.recordReplayParticipants(replayId, analysis);
            }
        } catch (error) {
            console.error(`Failed to update replay record: ${replayId}`, error);
            throw error;
        }
    }

    /**
     * Record all players who participated in this replay
     * Used for linking players to replays for confirmation queries
     */
    private async recordReplayParticipants(
        replayId: string,
        analysis: ReplayAnalysis
    ): Promise<void> {
        try {
            for (const player of analysis.players) {
                try {
                    // Check if player already exists for this replay
                    const existing = await query(
                        `SELECT id FROM replay_participants WHERE replay_id = ? AND player_name = ?`,
                        [replayId, player.name]
                    );

                    const existingRows = (existing as any).rows || (existing as unknown as any[]);
                    if (!existingRows || existingRows.length === 0) {
                        await query(
                            `INSERT INTO replay_participants 
                             (replay_id, player_id, player_name, side, faction_name, result_side, created_at)
                             VALUES (?, ?, ?, ?, ?, ?, NOW())`,
                            [
                                replayId,
                                null, // placeholder - would need actual phpBB user_id mapping from username
                                player.name,
                                player.side,
                                player.faction_name,
                                analysis.victory.winner_side === player.side ? 1 : 0,
                            ]
                        );
                    }
                } catch (error) {
                    console.warn(`Failed to record participant ${player.name} for replay ${replayId}:`, error);
                }
            }
        } catch (error) {
            console.error(`Failed to record replay participants for ${replayId}:`, error);
            // Don't throw - this is non-critical
        }
    }

    /**
     * Generate human-readable summary of parsed replay
     * Returns concise text with key information
     */
    public generateSummary(analysis: ReplayAnalysis): string {
        const players = analysis.players.map(p => `${p.name} (${p.faction_name || 'Unknown'})`).join(' vs ');
        const addons = analysis.addons.map(a => a.id).join(', ') || 'None';
        
        return [
            `Map: ${analysis.metadata.scenario_name || 'Unknown'}`,
            `Players: ${players || 'Unknown'}`,
            `Era: ${analysis.metadata.era_id || 'Unknown'}`,
            `Victory: ${analysis.victory.result_type}`,
            `Add-ons: ${addons}`,
            `Winner: ${analysis.victory.winner_name}`
        ].join(' | ');
    }

    /**
     * Add log entry to replay_parsing_logs table
     */
    public async addParsingLog(
        replayId: string,
        stage: string,
        status: 'started' | 'success' | 'error',
        details?: any,
        errorMessage?: string
    ): Promise<void> {
        try {
            const logId = uuidv4();
            const startTime = Date.now();
            
            await query(
                `INSERT INTO replay_parsing_logs (id, replay_id, stage, status, error_message, details, created_at)
                 VALUES (?, ?, ?, ?, ?, ?, NOW())`,
                [
                    logId,
                    replayId,
                    stage,
                    status,
                    errorMessage ? errorMessage.substring(0, 500) : null,
                    details ? JSON.stringify(details) : null
                ]
            );
        } catch (error) {
            console.error(`Failed to add parsing log for ${replayId}:`, error);
        }
    }

    /**
     * Mark parsing error in database
     */
    public async markAsDiscarded(
        replayId: string,
        discardReason: string
    ): Promise<void> {
        try {
            await query(
                `UPDATE replays 
                 SET parse_status = 'completed',
                     integration_confidence = 0,
                     parse_error_message = NULL,
                     parse_summary = ?,
                     parsing_completed_at = NOW()
                 WHERE id = ?`,
                [discardReason.substring(0, 500), replayId]
            );
        } catch (error) {
            console.error(
                `Failed to mark replay as discarded for ${replayId}`,
                error
            );
        }
    }

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
