/**
 * Asset Validation Utility
 * File: backend/src/utils/assetValidator.ts
 * 
 * Purpose: Validate that factions and maps meet ranked requirements
 * 
 * When Ranked addon marks ranked_mode="yes", we must verify:
 * 1. Both factions are marked as is_ranked=true in factions table
 * 2. Map is marked as is_ranked=true in maps table
 * 3. If validation fails, the match is NOT ranked (confidence=0)
 */

import { query } from '../config/database.js';

export interface AssetValidationResult {
  isValid: boolean;
  winnerFactionValid: boolean;
  loserFactionValid: boolean;
  mapValid: boolean;
  invalidReasons: string[];
}

/**
 * Generate map name variants for flexible matching
 * e.g., "2p — Tombs of Kesorak" → ["2p — Tombs of Kesorak", "Tombs of Kesorak"]
 * e.g., "4p - The Great Chasm" → ["4p - The Great Chasm", "The Great Chasm"]
 */
function getMapNameVariants(mapName: string): string[] {
  const variants: Set<string> = new Set([mapName]);
  
  // Try removing common player count prefixes: "Np —", "Np -", "Np " (where N is 1-6 digits)
  // Match patterns like: "2p —", "4p -", "1p ", etc.
  const cleaned = mapName.replace(/^\d+p[\s—\-]+/i, '');
  if (cleaned !== mapName) {
    variants.add(cleaned);
  }
  
  return Array.from(variants);
}

/**
 * Find a map in database trying multiple name variants
 */
async function findMapInDatabase(mapName: string): Promise<any> {
  const variants = getMapNameVariants(mapName);
  
  for (const variant of variants) {
    const result = await query(
      `SELECT is_ranked FROM game_maps WHERE name = ? LIMIT 1`,
      [variant]
    );
    
    if (result && (result as any).rows && (result as any).rows.length > 0) {
      console.log(`   📍 Map found: "${variant}" (from: "${mapName}")`);
      return (result as any).rows[0];
    }
  }
  
  return null;
}

/**
 * Generate faction name variants for flexible matching
 * e.g., "Ladder Rebels" → ["Ladder Rebels", "Rebels"]
 * Removes common addon prefixes to find base faction names
 */
function getFactionNameVariants(factionName: string): string[] {
  const variants: Set<string> = new Set([factionName]);
  
  // Remove common addon prefixes: "Ladder ", "Campaign ", etc.
  const cleaned = factionName.replace(/^(Ladder|Campaign|Ranked|Custom)\s+/i, '');
  if (cleaned !== factionName) {
    variants.add(cleaned);
  }
  
  return Array.from(variants);
}

/**
 * Find a faction in database trying multiple name variants
 */
async function findFactionInDatabase(factionName: string): Promise<any> {
  const variants = getFactionNameVariants(factionName);
  
  for (const variant of variants) {
    const result = await query(
      `SELECT is_ranked FROM factions WHERE name = ? LIMIT 1`,
      [variant]
    );
    
    if (result && (result as any).rows && (result as any).rows.length > 0) {
      console.log(`   🏛️  Faction found: "${variant}" (from: "${factionName}")`);
      return (result as any).rows[0];
    }
  }
  
  return null;
}

/**
 * Validate that assets (factions and map) meet ranked requirements
 * Returns validation result and reason if invalid
 */
export async function validateRankedAssets(
  winnerFactionName: string | undefined,
  loserFactionName: string | undefined,
  mapName: string | undefined
): Promise<AssetValidationResult> {
  const result: AssetValidationResult = {
    isValid: true,
    winnerFactionValid: true,
    loserFactionValid: true,
    mapValid: true,
    invalidReasons: []
  };

  try {
    // If no assets provided, cannot validate - mark as invalid
    if (!winnerFactionName || !loserFactionName || !mapName) {
      result.isValid = false;
      if (!winnerFactionName) {
        result.winnerFactionValid = false;
        result.invalidReasons.push('Winner faction not provided');
      }
      if (!loserFactionName) {
        result.loserFactionValid = false;
        result.invalidReasons.push('Loser faction not provided');
      }
      if (!mapName) {
        result.mapValid = false;
        result.invalidReasons.push('Map not provided');
      }
      return result;
    }

    // Check winner faction with variant matching
    const winnerFactionRecord = await findFactionInDatabase(winnerFactionName);

    if (!winnerFactionRecord) {
      result.winnerFactionValid = false;
      result.isValid = false;
      const variants = getFactionNameVariants(winnerFactionName);
      result.invalidReasons.push(`Winner faction not found in database: ${winnerFactionName}${variants.length > 1 ? ` (tried: ${variants.join(', ')})` : ''}`);
    } else {
      const isRanked = winnerFactionRecord.is_ranked;
      if (!isRanked) {
        result.winnerFactionValid = false;
        result.isValid = false;
        result.invalidReasons.push(`Winner faction not marked as ranked: ${winnerFactionName}`);
      }
    }

    // Check loser faction with variant matching
    const loserFactionRecord = await findFactionInDatabase(loserFactionName);

    if (!loserFactionRecord) {
      result.loserFactionValid = false;
      result.isValid = false;
      const variants = getFactionNameVariants(loserFactionName);
      result.invalidReasons.push(`Loser faction not found in database: ${loserFactionName}${variants.length > 1 ? ` (tried: ${variants.join(', ')})` : ''}`);
    } else {
      const isRanked = loserFactionRecord.is_ranked;
      if (!isRanked) {
        result.loserFactionValid = false;
        result.isValid = false;
        result.invalidReasons.push(`Loser faction not marked as ranked: ${loserFactionName}`);
      }
    }

    // Check map with variant matching
    const mapRecord = await findMapInDatabase(mapName);

    if (!mapRecord) {
      result.mapValid = false;
      result.isValid = false;
      const variants = getMapNameVariants(mapName);
      result.invalidReasons.push(`Map not found in database: ${mapName}${variants.length > 1 ? ` (tried: ${variants.join(', ')})` : ''}`);
    } else {
      const isRanked = mapRecord.is_ranked;
      if (!isRanked) {
        result.mapValid = false;
        result.isValid = false;
        result.invalidReasons.push(`Map not marked as ranked: ${mapName}`);
      }
    }

    if (result.isValid) {
      console.log(`✅ [VALIDATE] All assets are valid for ranked: ${winnerFactionName} vs ${loserFactionName} on ${mapName}`);
    } else {
      console.warn(`⚠️  [VALIDATE] Asset validation failed:`, result.invalidReasons);
    }

    return result;

  } catch (error) {
    console.error('[VALIDATE] Error validating assets:', error);
    result.isValid = false;
    result.invalidReasons.push(`Validation error: ${(error as any)?.message}`);
    return result;
  }
}

/**
 * Check if a specific faction is ranked (tries multiple name variants)
 */
export async function isFactionRanked(factionName: string): Promise<boolean> {
  try {
    const factionRecord = await findFactionInDatabase(factionName);

    if (!factionRecord) {
      return false;
    }

    return factionRecord.is_ranked === true || factionRecord.is_ranked === 1;
  } catch (error) {
    console.error(`[VALIDATE] Error checking faction: ${factionName}`, error);
    return false;
  }
}

/**
 * Check if a specific map is ranked (tries multiple name variants)
 */
export async function isMapRanked(mapName: string): Promise<boolean> {
  try {
    const mapRecord = await findMapInDatabase(mapName);

    if (!mapRecord) {
      return false;
    }

    return mapRecord.is_ranked === true || mapRecord.is_ranked === 1;
  } catch (error) {
    console.error(`[VALIDATE] Error checking map: ${mapName}`, error);
    return false;
  }
}

export default {
  validateRankedAssets,
  isFactionRanked,
  isMapRanked
};
