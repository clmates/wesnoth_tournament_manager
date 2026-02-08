/**
 * Replay/Save Parser Service
 * Extracts map, players, and factions from Wesnoth replay (.gz, .bz2) and save files
 */

interface ReplayData {
  map: string | null;
  players: Array<{ id: string; name: string; faction: string }>;
  winner?: string;
  loser?: string;
}

/**
 * Normalize map names for consistent comparison
 * Handles special characters, smart quotes, and whitespace
 * - Converts smart quotes (', ', ", ") to standard quotes (' and ")
 * - Trims whitespace
 * - Lowercases for comparison
 * @param mapName - The map name to normalize
 * @returns Normalized map name suitable for comparison
 */
export function normalizeMapName(mapName: string | null | undefined): string {
  if (!mapName) return '';
  
  const original = mapName;
  // Use Unicode escape sequences to handle all quote variants
  let result = mapName
    // U+2018 (') and U+2019 (') - Left and right single quotation marks
    .replace(/[\u2018\u2019]/g, "'")
    // U+201C (") and U+201D (") - Left and right double quotation marks  
    .replace(/[\u201C\u201D]/g, '"')
    // U+201E („) and U+201F (‟) - Double low-9 quotation mark
    .replace(/[\u201E\u201F]/g, '"')
    // U+2039 (‹) and U+203A (›) - Single-pointing angle quotation marks
    .replace(/[\u2039\u203A]/g, "'")
    // U+2035 (`) and U+2032 (′) - Grave accent and prime
    .replace(/[\u2035\u2032]/g, "'")
    // U+201A (‚) - Single low-9 quotation mark
    .replace(/[\u201A]/g, "'")
    .trim()
    .toLowerCase();
  
  if (original !== result) {
    console.log(`🗺️ [NORMALIZE] "${original}" → "${result}"`);
    console.log(`🗺️ [NORMALIZE] Original char codes:`, Array.from(original).map((c, i) => ({ i, char: c, code: c.charCodeAt(0) })));
    console.log(`🗺️ [NORMALIZE] Result char codes:`, Array.from(result).map((c, i) => ({ i, char: c, code: c.charCodeAt(0) })));
  }
  
  return result;
}

/**
 * Parse a Wesnoth replay or save file and extract game information
 * - Handles .gz files: browser-side decompression
 * - Handles .bz2 files: backend-side decompression (via preview endpoint)
 * - Handles uncompressed .save files: direct parsing
 * @param file - The replay or save file to parse
 * @returns Promise with extracted map, players, and faction data
 */
export async function parseReplayFile(file: File): Promise<ReplayData> {
  try {
    const arrayBuffer = await file.arrayBuffer();
    
    // Check compression type by magic bytes
    const view = new Uint8Array(arrayBuffer);
    const isGzip = view[0] === 0x1f && view[1] === 0x8b; // gzip magic bytes
    const isBz2 = view[0] === 0x42 && view[1] === 0x5a; // bz2 magic bytes: 'BZ'
    
    let xmlText: string;
    
    if (isGzip) {
      // Decompress gzip file using browser API
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
      // Decompress bzip2 file using backend endpoint
      console.log('[REPLAY] Detected BZ2 file:', file.name);
      
      const token = localStorage.getItem('token') || '';
      console.log('[REPLAY] Token available:', !!token);
      
      // Convert file to base64 for JSON transmission (avoids multipart/form-data issues)
      const arrayBuffer = await file.arrayBuffer();
      const bytes = new Uint8Array(arrayBuffer);
      let binaryString = '';
      for (let i = 0; i < bytes.byteLength; i++) {
        binaryString += String.fromCharCode(bytes[i]);
      }
      const fileData = btoa(binaryString);
      
      // Determine backend URL based on environment
      let backendUrl = '/api/matches/preview-replay-base64';
      if (window.location.hostname === 'main.wesnoth-tournament-manager.pages.dev') {
        backendUrl = 'https://wesnothtournamentmanager-main.up.railway.app/api/matches/preview-replay-base64';
      } else if (window.location.hostname === 'wesnoth-tournament-manager.pages.dev') {
        backendUrl = 'https://wesnothtournamentmanager-production.up.railway.app/api/matches/preview-replay-base64';
      } else if (window.location.hostname.includes('feature-unranked-tournaments')) {
        backendUrl = 'https://wesnothtournamentmanager-wesnothtournamentmanager-pr-1.up.railway.app/api/matches/preview-replay-base64';
      } else if (window.location.hostname === 'wesnoth.playranked.org') {
        backendUrl = 'https://wesnothtournamentmanager-production.up.railway.app/api/matches/preview-replay-base64';
      }
      console.log('[REPLAY] Sending BZ2 request to', backendUrl);
      
      const response = await fetch(backendUrl, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
        },
        body: JSON.stringify({
          fileData,
          fileName: file.name,
        }),
      });
      
      console.log('[REPLAY] Response status:', response.status, response.statusText);
      console.log('[REPLAY] Response headers:', Array.from(response.headers.entries()));
      
      if (!response.ok) {
        let errorMessage = 'Failed to parse bzip2 file';
        try {
          const errorText = await response.text();
          console.log('[REPLAY] Error response text:', errorText);
          const errorData = JSON.parse(errorText);
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          console.log('[REPLAY] Could not parse error response:', e);
          errorMessage = `Server error (${response.status}): ${response.statusText}`;
        }
        throw new Error(errorMessage);
      }
      
      let result;
      try {
        result = await response.json();
        console.log('[REPLAY] Successfully parsed response:', result);
      } catch (e) {
        console.error('[REPLAY] Failed to parse JSON response:', e);
        throw new Error('Invalid server response - could not parse JSON');
      }
      
      // Return the parsed data directly from backend
      return {
        map: result.map,
        players: result.players.map((p: any) => ({
          id: p.id,
          name: p.name,
          faction: p.faction || 'Unknown',
        })),
      };
    } else {
      // File is not compressed (save file)
      const decoder = new TextDecoder();
      xmlText = decoder.decode(arrayBuffer);
    }
    
    // Extract information from XML
    const replayData = extractReplayInfo(xmlText);
    return replayData;
  } catch (err: any) {
    throw new Error(`Failed to parse file: ${err.message}`);
  }
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
    console.log('🗺️ [EXTRACT] Raw scenario match:', mapName);
    console.log('🗺️ [EXTRACT] Char codes:', Array.from(mapName).map((c, i) => ({ i, char: c, code: c.charCodeAt(0) })));
    
    // Remove "2p — " prefix if present
    mapName = mapName.replace(/^2p\s*—\s*/, '');
    console.log('🗺️ [EXTRACT] After removing 2p prefix:', mapName);
    
    data.map = mapName;
  }
  console.log('🗺️ [EXTRACT] Final extracted map:', data.map);

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
