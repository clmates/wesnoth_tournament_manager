/**
 * Replay/Save Parser Service
 * Extracts map, players, and factions from Wesnoth replay (.gz and .bz2) and save files
 */

import { decompress as decompressBz2Data } from 'bz2';

interface ReplayData {
  map: string | null;
  players: Array<{ id: string; name: string; faction: string }>;
  winner?: string;
  loser?: string;
}

/**
 * Decompress bzip2 data using bz2 library
 */
async function decompressBz2(data: Uint8Array): Promise<Uint8Array> {
  try {
    const decompressed = decompressBz2Data(data);
    return new Uint8Array(decompressed);
  } catch (err: any) {
    throw new Error(`Failed to decompress bzip2 file: ${err.message}`);
  }
}

/**
 * Parse a Wesnoth replay or save file and extract game information
 * Handles both compressed replay files (.gz and .bz2) and uncompressed save files
 * @param file - The replay or save file to parse
 * @returns Promise with extracted map, players, and faction data
 */
export async function parseReplayFile(file: File): Promise<ReplayData> {
  return new Promise(async (resolve, reject) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      
      // Check compression type by magic bytes
      const view = new Uint8Array(arrayBuffer);
      const isGzip = view[0] === 0x1f && view[1] === 0x8b; // gzip magic bytes
      const isBz2 = view[0] === 0x42 && view[1] === 0x5a; // bz2 magic bytes: 'BZ'
      
      let xmlText: string;
      
      if (isGzip) {
        // Decompress gzip file
        let decompressed: Uint8Array;
        
        if ('DecompressionStream' in window) {
          try {
            const stream = new ReadableStream<Uint8Array>({
              start(controller) {
                controller.enqueue(new Uint8Array(arrayBuffer));
                controller.close();
              },
            });
            
            const decompressedStream = (stream as ReadableStream<Uint8Array>).pipeThrough(
              new (window as any).DecompressionStream('gzip')
            ) as ReadableStream<Uint8Array>;
            
            const reader = (decompressedStream as ReadableStream<Uint8Array>).getReader();
            const chunks: Uint8Array[] = [];
            
            let result = await reader.read();
            while (!result.done) {
              const chunk = result.value as Uint8Array;
              if (chunk) chunks.push(chunk);
              result = await reader.read();
            }
            
            decompressed = new Uint8Array(
              chunks.reduce((acc, chunk) => acc + chunk.length, 0)
            );
            let offset = 0;
            for (const chunk of chunks) {
              decompressed.set(chunk, offset);
              offset += chunk.length;
            }
          } catch (err) {
            throw new Error('Failed to decompress gzip file. Please use a modern browser.');
          }
        } else {
          throw new Error('Your browser does not support decompression. Please use Chrome, Firefox, or Edge.');
        }
        
        // Convert decompressed data to string
        const decoder = new TextDecoder();
        xmlText = decoder.decode(decompressed);
      } else if (isBz2) {
        // Decompress bzip2 file
        // bzip2 requires a library as it's not natively supported by DecompressionStream
        const decompressed = await decompressBz2(new Uint8Array(arrayBuffer));
        const decoder = new TextDecoder();
        xmlText = decoder.decode(decompressed);
      } else {
        // File is not compressed (save file)
        const decoder = new TextDecoder();
        xmlText = decoder.decode(arrayBuffer);
      }
      
      // Extract information from XML
      const replayData = extractReplayInfo(xmlText);
      resolve(replayData);
    } catch (err: any) {
      reject(new Error(`Failed to parse file: ${err.message}`));
    }
  });
}

/**
 * Extract replay information from XML content
 * @param xmlText - The XML content as string
 * @returns Extracted replay data
 */
export function extractReplayInfo(xmlText: string): ReplayData {
  const data: ReplayData = {
    map: null,
    players: [],
  };

  // Extract map name from mp_scenario element
  const scenarioMatch = xmlText.match(/mp_scenario_name="([^"]+)"/);
  if (scenarioMatch) {
    let mapName = scenarioMatch[1];
    // Remove "2p — " prefix if present
    mapName = mapName.replace(/^2p\s*—\s*/, '');
    data.map = mapName;
  }

  // Extract players from global side_users attribute (e.g., id1:Nick1,id2:Nick2)
  const sideUsersGlobal = xmlText.match(/side_users="([^"]+)"/);
  const playerNames: string[] = [];
  if (sideUsersGlobal && sideUsersGlobal[1]) {
    const pairs = sideUsersGlobal[1].split(',');
    for (const pair of pairs) {
      const parts = pair.split(':');
      const name = (parts[1] || parts[0]).trim();
      if (name) playerNames.push(name);
    }
  }

  // Extract factions in order of <side ...> blocks (fallback)
  const factionsInOrder: string[] = [];
  const factionRegex = /faction_name\s*=\s*_?"([^"]+)"/g; // matches faction_name="..." and faction_name=_"..."
  const factionMatches = xmlText.matchAll(factionRegex);
  for (const m of factionMatches) {
    const raw = m[1];
    const clean = raw.replace(/^_/, '');
    factionsInOrder.push(clean);
  }

  // Extract factions from [old_side*] blocks mapping current_player -> faction_name (preferred) or faction
  const factionByPlayer: Record<string, string> = {};
  const oldSideBlockRegex = /\[old_side[^\]]*\][\s\S]*?(?=\[old_side|\Z)/g;
  for (const block of xmlText.matchAll(oldSideBlockRegex)) {
    const text = block[0];
    const playerMatch = text.match(/current_player="([^"]+)"/);
    if (!playerMatch) continue;
    const player = playerMatch[1];
    const factionNameMatch = text.match(/faction_name\s*=\s*_?"([^"]+)"/);
    const factionMatch = text.match(/faction="([^"]+)"/);
    const rawFaction = (factionNameMatch?.[1] || factionMatch?.[1] || '').trim();
    if (!rawFaction) continue;
    const cleanFaction = rawFaction.replace(/^_/, '');
    factionByPlayer[player] = cleanFaction;
  }

  // Build players array by index mapping
  const count = Math.min(playerNames.length, factionsInOrder.length);
  for (let i = 0; i < count; i++) {
    const name = playerNames[i];
    const faction = factionByPlayer[name] ?? factionsInOrder[i] ?? 'Unknown';
    data.players.push({ id: name, name, faction });
  }

  // If playerNames are empty but old_side mapping exists, use it to populate players
  if (playerNames.length === 0 && Object.keys(factionByPlayer).length > 0) {
    for (const [name, faction] of Object.entries(factionByPlayer)) {
      data.players.push({ id: name, name, faction });
    }
  }

  return data;
}

/**
 * Get opponent from replay data based on current player name
 */
export function getOpponentFromReplay(
  replayData: ReplayData,
  currentPlayerName?: string
): { name: string; faction: string } | null {
  if (!replayData.players || replayData.players.length < 2) {
    return null;
  }

  if (currentPlayerName) {
    const opponent = replayData.players.find(
      (p) => p.name.toLowerCase() !== currentPlayerName.toLowerCase()
    );
    if (opponent) {
      return { name: opponent.name, faction: opponent.faction };
    }
  }

  // Fallback: return the second player
  return { name: replayData.players[1].name, faction: replayData.players[1].faction };
}

/**
 * Get map from replay data
 */
export function getMapFromReplay(replayData: ReplayData): string | null {
  return replayData.map;
}

/**
 * Get faction for a specific player from replay data
 */
export function getPlayerFactionFromReplay(
  replayData: ReplayData,
  playerName?: string
): string | null {
  if (!playerName || !replayData.players) {
    return null;
  }

  const player = replayData.players.find(
    (p) => p.name.toLowerCase() === playerName.toLowerCase()
  );

  return player?.faction || null;
}
