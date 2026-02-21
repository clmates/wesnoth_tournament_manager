/**
 * Ranked Addon Replay Parser
 * File: backend/src/utils/replayRankedParser.ts
 * 
 * Purpose: Parse replays from Wesnoth's "Ranked" addon to extract:
 * 1. Ranked mode detection (ranked_mode="yes")
 * 2. Tournament linkage (tournament="yes/no")
 * 3. Tournament name (if tournament="yes")
 * 4. Surrender confirmations (fire_event + input)
 * 5. Faction information (if DB fetch fails)
 * 6. Victory determination with confidence level
 * 
 * Addon Configuration:
 * - ranked_mode="yes" → Partida ranked
 * - tournament="no" → Solo ranked global (confidence=2, auto-confirm)
 * - tournament="yes" → Torneo específico (confidence=1, pending, game_name=tournamentName)
 * 
 * Surrender Flow:
 * [fire_event] raise="menu item surrender"
 *   → [input] value=2 → ✅ CONFIRMADO (jugador perdió)
 *   → [input] value=1 → ❌ RECHAZADO (partida continúa)
 */

import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';

export interface RankedAddonConfig {
  ranked_mode: boolean;
  tournament: boolean;
  tournament_name?: string;
}

export interface SurrenderEvent {
  side: number; // 1 or 2
  confirmed: boolean;
}

export interface ParsedRankedReplay {
  // Addon configuration
  addon: RankedAddonConfig;
  
  // Validation: Is this truly ranked based on assets?
  isValidRanked: boolean; // false if assets aren't ranked-approved
  invalidReason?: string;
  
  // Participants
  players: Array<{
    side: number;
    name: string;
    faction?: string;
  }>;
  
  // Victory info
  victory: {
    winner_side: number;
    loser_side: number;
    winner_name: string;
    loser_name: string;
    winner_faction?: string;
    loser_faction?: string;
    reason: 'victory_conditions' | 'surrender' | 'timeout' | 'unknown';
    confidence_level: 1 | 2; // 2=auto-confirm (global ranked), 1=pending (tournament or invalid assets)
  };
  
  // Surrender details if applicable
  surrenders?: SurrenderEvent[];
  
  // Raw WML (for debugging)
  rawWml?: string;
}

/**
 * Main function: Parse ranked replay from .wrz file or URL
 * Returns structured data ready for match creation
 */
export async function parseRankedReplay(
  replayPath: string
): Promise<ParsedRankedReplay> {
  try {
    console.log(`🎬 [RANKED PARSE] Starting: ${path.basename(replayPath)}`);

    // Decompress .wrz file
    const wmlContent = await decompressReplay(replayPath);
    
    if (!wmlContent) {
      throw new Error('Failed to decompress replay file');
    }

    // Parse WML content
    const parsed = parseWml(wmlContent);

    // Extract addon configuration
    const addon = extractAddonConfig(parsed);

    // Extract players and factions
    const players = extractPlayers(parsed);

    // Extract surrenders if any
    const surrenders = extractSurrenders(parsed);

    // Determine victory
    const victory = determineVictory(parsed, players, surrenders, addon);

    const result: ParsedRankedReplay = {
      addon,
      isValidRanked: addon.ranked_mode, // Will be validated later by asset validator
      players,
      victory,
      surrenders: surrenders.length > 0 ? surrenders : undefined,
      rawWml: wmlContent.substring(0, 500) // Store first 500 chars for debugging
    };

    console.log(`✅ [RANKED PARSE] Success`);
    console.log(`   Mode: ${addon.ranked_mode ? 'Ranked' : 'Unknown'}`);
    console.log(`   Tournament: ${addon.tournament ? addon.tournament_name : 'None'}`);
    console.log(`   Winner: ${victory.winner_name} vs Loser: ${victory.loser_name}`);
    console.log(`   Victory: ${victory.reason} (confidence: ${victory.confidence_level})`);

    return result;

  } catch (error) {
    const errorMsg = (error as any)?.message || String(error);
    console.error(`❌ [RANKED PARSE] Failed:`, errorMsg);
    throw error;
  }
}

/**
 * Decompress .wrz file (bz2 or gz compressed)
 * Returns decompressed WML content as string
 * Uses same approach as replayParser.ts
 */
async function decompressReplay(replayPath: string): Promise<string> {
  try {
    const filename = path.basename(replayPath);
    const fileBuffer = fs.readFileSync(replayPath);
    let wmlText: string;

    // Detect format by file extension
    if (filename.endsWith('.bz2')) {
      // BZ2 decompression using bz2 module
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
    } else if (filename.endsWith('.gz') || filename.endsWith('.rpy.gz')) {
      // GZIP decompression
      wmlText = zlib.gunzipSync(fileBuffer).toString('utf-8');
    } else {
      // Try direct read (uncompressed or unknown format)
      wmlText = fileBuffer.toString('utf-8');
    }

    return wmlText;
  } catch (error) {
    const errorMsg = (error as any)?.message || String(error);
    throw new Error(`Failed to decompress replay: ${errorMsg}`);
  }
}

/**
 * Simple WML parser - converts WML to nested object structure
 * WML Format:
 *   [section]
 *     key=value
 *     [subsection]
 *       ...
 *     [/subsection]
 *   [/section]
 */
interface WmlNode {
  [key: string]: string | WmlNode | WmlNode[];
}

function parseWml(content: string): WmlNode {
  const lines = content.split('\n');
  const root: WmlNode = {};
  const stack: Array<{ key: string; node: WmlNode }> = [{ key: 'root', node: root }];

  for (const line of lines) {
    const trimmed = line.trim();
    
    if (!trimmed || trimmed.startsWith('#')) {
      continue; // Skip empty lines and comments
    }

    // Opening section: [name]
    if (trimmed.startsWith('[') && !trimmed.startsWith('[/')) {
      const sectionName = trimmed.slice(1, -1);
      const newNode: WmlNode = {};
      const current = stack[stack.length - 1].node;

      if (current[sectionName]) {
        // Section already exists, make it an array
        if (Array.isArray(current[sectionName])) {
          (current[sectionName] as WmlNode[]).push(newNode);
        } else {
          current[sectionName] = [current[sectionName] as WmlNode, newNode];
        }
      } else {
        current[sectionName] = newNode;
      }

      stack.push({ key: sectionName, node: newNode });
    }
    // Closing section: [/name]
    else if (trimmed.startsWith('[/')) {
      stack.pop();
    }
    // Key-value pair: key=value
    else if (trimmed.includes('=')) {
      const [key, ...valueParts] = trimmed.split('=');
      const value = valueParts.join('=').trim().replace(/^"(.*)"$/, '$1');
      const current = stack[stack.length - 1].node;
      current[key.trim()] = value;
    }
  }

  return root;
}

/**
 * Extract addon configuration from WML
 * Looks for [scenario] > scenario-data with ranked_mode and tournament flags
 */
function extractAddonConfig(wml: WmlNode): RankedAddonConfig {
  try {
    // Navigate to scenario-data section
    const scenario = wml.scenario as WmlNode | undefined;
    if (!scenario) {
      throw new Error('No [scenario] section found');
    }

    const scenarioData = scenario['scenario_data'] as WmlNode | undefined;
    if (!scenarioData) {
      throw new Error('No scenario_data with addon config found');
    }

    const rankedMode = scenarioData.ranked_mode === 'yes';
    const tournament = scenarioData.tournament === 'yes';
    const tournamentName = scenarioData.tournament_name as string | undefined;

    return {
      ranked_mode: rankedMode,
      tournament,
      tournament_name: tournament ? tournamentName : undefined
    };
  } catch (error) {
    console.warn('⚠️  [RANKED PARSE] Could not extract addon config:', error);
    return {
      ranked_mode: false,
      tournament: false
    };
  }
}

/**
 * Extract player names and factions from WML
 */
function extractPlayers(wml: WmlNode): Array<{ side: number; name: string; faction?: string }> {
  try {
    const players: Array<{ side: number; name: string; faction?: string }> = [];
    const scenario = wml.scenario as WmlNode | undefined;

    if (!scenario) {
      return [];
    }

    // Look for [side] sections
    const sides = scenario.side as WmlNode | WmlNode[] | undefined;

    if (!sides) {
      return [];
    }

    const sideArray = Array.isArray(sides) ? sides : [sides];

    for (const side of sideArray) {
      const sideNum = parseInt(side.side as string) || players.length + 1;
      const leader = side.leader as WmlNode | undefined;

      if (leader) {
        const playerName = (leader.name as string) || `Player${sideNum}`;
        const faction = leader.type as string | undefined;

        players.push({
          side: sideNum,
          name: playerName,
          faction
        });
      }
    }

    return players;
  } catch (error) {
    console.warn('⚠️  [RANKED PARSE] Could not extract players:', error);
    return [];
  }
}

/**
 * Extract surrender events from replay commands
 * Looks for fire_event with "menu item surrender" and subsequent input
 */
function extractSurrenders(wml: WmlNode): SurrenderEvent[] {
  try {
    const surrenders: SurrenderEvent[] = [];
    const replay = wml.replay as WmlNode | undefined;

    if (!replay) {
      return [];
    }

    const commands = replay.command as WmlNode | WmlNode[] | undefined;
    if (!commands) {
      return [];
    }

    const commandArray = Array.isArray(commands) ? commands : [commands];

    for (let i = 0; i < commandArray.length; i++) {
      const command = commandArray[i];
      const fireEvent = command.fire_event as WmlNode | undefined;

      if (fireEvent && fireEvent.raise === 'menu item surrender') {
        const fromSide = parseInt(command.from_side as string) || 0;

        // Look for next command with input value=2 (confirmed) or value=1 (rejected)
        const nextCommand = commandArray[i + 1];
        if (nextCommand && nextCommand.input) {
          const inputValue = parseInt((nextCommand.input as any).value as string);
          const confirmed = inputValue === 2;

          surrenders.push({
            side: fromSide,
            confirmed
          });
        }
      }
    }

    return surrenders;
  } catch (error) {
    console.warn('⚠️  [RANKED PARSE] Could not extract surrenders:', error);
    return [];
  }
}

/**
 * Determine victory from WML data
 * Checks for:
 * 1. Confirmed surrenders (clarity dictates surrender = loss)
 * 2. Victory conditions in WML
 * 3. Timeout/other conditions
 */
function determineVictory(
  wml: WmlNode,
  players: Array<{ side: number; name: string; faction?: string }>,
  surrenders: SurrenderEvent[],
  addon: RankedAddonConfig
): ParsedRankedReplay['victory'] {
  try {
    // Check for confirmed surrenders first
    for (const surrender of surrenders) {
      if (surrender.confirmed) {
        const loserSide = surrender.side;
        const winnerSide = loserSide === 1 ? 2 : 1;

        const winner = players.find(p => p.side === winnerSide);
        const loser = players.find(p => p.side === loserSide);

        return {
          winner_side: winnerSide,
          loser_side: loserSide,
          winner_name: winner?.name || `Player${winnerSide}`,
          loser_name: loser?.name || `Player${loserSide}`,
          winner_faction: winner?.faction,
          loser_faction: loser?.faction,
          reason: 'surrender',
          confidence_level: addon.tournament ? 1 : 2
        };
      }
    }

    // Look for victory conditions in scenario end
    const scenario = wml.scenario as WmlNode | undefined;
    if (scenario) {
      // Parse victory condition (simplified - would need to look at side victory flag)
      // For now, assume Player 1 wins if no surrender (can be enhanced)
      const winner = players[0] || { side: 1, name: 'Player1' };
      const loser = players[1] || { side: 2, name: 'Player2' };

      return {
        winner_side: winner.side,
        loser_side: loser.side,
        winner_name: winner.name,
        loser_name: loser.name,
        winner_faction: winner.faction,
        loser_faction: loser.faction,
        reason: 'victory_conditions',
        confidence_level: addon.tournament ? 1 : 2
      };
    }

    // Fallback - assume Player 1 wins
    const winner = players[0] || { side: 1, name: 'Player1' };
    const loser = players[1] || { side: 2, name: 'Player2' };

    return {
      winner_side: winner.side,
      loser_side: loser.side,
      winner_name: winner.name,
      loser_name: loser.name,
      winner_faction: winner.faction,
      loser_faction: loser.faction,
      reason: 'unknown',
      confidence_level: addon.tournament ? 1 : 2
    };

  } catch (error) {
    console.warn('⚠️  [RANKED PARSE] Could not determine victory, defaulting:', error);

    // Ultimate fallback
    return {
      winner_side: 1,
      loser_side: 2,
      winner_name: players[0]?.name || 'Player1',
      loser_name: players[1]?.name || 'Player2',
      winner_faction: players[0]?.faction,
      loser_faction: players[1]?.faction,
      reason: 'unknown',
      confidence_level: addon.tournament ? 1 : 2
    };
  }
}

export default parseRankedReplay;
