/**
 * Replay/Save Parser Service
 * Extracts map, players, and factions from Wesnoth replay (.gz) and save files
 */

interface ReplayData {
  map: string | null;
  players: Array<{ id: string; name: string; faction: string }>;
  winner?: string;
  loser?: string;
}

/**
 * Parse a Wesnoth replay or save file and extract game information
 * Handles both compressed replay files (.gz) and uncompressed save files
 * @param file - The replay or save file to parse
 * @returns Promise with extracted map, players, and faction data
 */
export async function parseReplayFile(file: File): Promise<ReplayData> {
  return new Promise(async (resolve, reject) => {
    try {
      const arrayBuffer = await file.arrayBuffer();
      
      // Check if file is gzip compressed (magic bytes: 1f 8b)
      const view = new Uint8Array(arrayBuffer);
      const isGzip = view[0] === 0x1f && view[1] === 0x8b;
      
      let xmlText: string;
      
      if (isGzip) {
        // Decompress gzip file
        let decompressed: Uint8Array;
        
        if ('DecompressionStream' in window) {
          try {
            const stream = new ReadableStream({
              start(controller) {
                controller.enqueue(new Uint8Array(arrayBuffer));
                controller.close();
              },
            });
            
            const decompressedStream = stream.pipeThrough(
              new (window as any).DecompressionStream('gzip')
            );
            
            const reader = decompressedStream.getReader();
            const chunks: Uint8Array[] = [];
            
            let result = await reader.read();
            while (!result.done) {
              chunks.push(result.value);
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

  // Extract side information (players and factions)
  const sideMatches = xmlText.matchAll(/<side[^>]*>/g);
  for (const match of sideMatches) {
    const sideElement = match[0];
    
    // Extract player name from side_users attribute or username element
    let playerName: string | null = null;
    
    // Try to get from side_users attribute
    const sideUsersMatch = sideElement.match(/side_users="([^"]+)"/);
    if (sideUsersMatch) {
      const sideUsers = sideUsersMatch[1];
      // Format: "id1:player1,id2:player2" or just "id1:player1"
      const players = sideUsers.split(',');
      if (players.length > 0) {
        playerName = players[0].split(':')[1] || players[0];
      }
    }

    // Try to get faction from faction_name attribute
    let factionName: string | null = null;
    const factionMatch = sideElement.match(/faction_name="([^"]+)"/);
    if (factionMatch) {
      factionName = factionMatch[1];
      // Clean faction name (remove leading underscores, quotes, etc.)
      factionName = factionName
        .replace(/^["']/, '')
        .replace(/["']$/, '')
        .replace(/^_/, '');
    }

    if (playerName && factionName) {
      data.players.push({
        id: playerName,
        name: playerName,
        faction: factionName,
      });
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
