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

    // Check winner faction
    const winnerFactionResult = await query(
      `SELECT is_ranked FROM factions WHERE name = ? LIMIT 1`,
      [winnerFactionName]
    );

    if (!winnerFactionResult || !(winnerFactionResult as any).rows || (winnerFactionResult as any).rows.length === 0) {
      result.winnerFactionValid = false;
      result.isValid = false;
      result.invalidReasons.push(`Winner faction not found in database: ${winnerFactionName}`);
    } else {
      const isRanked = (winnerFactionResult as any).rows[0].is_ranked;
      if (!isRanked) {
        result.winnerFactionValid = false;
        result.isValid = false;
        result.invalidReasons.push(`Winner faction not marked as ranked: ${winnerFactionName}`);
      }
    }

    // Check loser faction
    const loserFactionResult = await query(
      `SELECT is_ranked FROM factions WHERE name = ? LIMIT 1`,
      [loserFactionName]
    );

    if (!loserFactionResult || !(loserFactionResult as any).rows || (loserFactionResult as any).rows.length === 0) {
      result.loserFactionValid = false;
      result.isValid = false;
      result.invalidReasons.push(`Loser faction not found in database: ${loserFactionName}`);
    } else {
      const isRanked = (loserFactionResult as any).rows[0].is_ranked;
      if (!isRanked) {
        result.loserFactionValid = false;
        result.isValid = false;
        result.invalidReasons.push(`Loser faction not marked as ranked: ${loserFactionName}`);
      }
    }

    // Check map
    const mapResult = await query(
      `SELECT is_ranked FROM maps WHERE name = ? LIMIT 1`,
      [mapName]
    );

    if (!mapResult || !(mapResult as any).rows || (mapResult as any).rows.length === 0) {
      result.mapValid = false;
      result.isValid = false;
      result.invalidReasons.push(`Map not found in database: ${mapName}`);
    } else {
      const isRanked = (mapResult as any).rows[0].is_ranked;
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
 * Check if a specific faction is ranked
 */
export async function isFactionRanked(factionName: string): Promise<boolean> {
  try {
    const result = await query(
      `SELECT is_ranked FROM factions WHERE name = ? LIMIT 1`,
      [factionName]
    );

    if (!result || !(result as any).rows || (result as any).rows.length === 0) {
      return false;
    }

    return (result as any).rows[0].is_ranked === true || (result as any).rows[0].is_ranked === 1;
  } catch (error) {
    console.error(`[VALIDATE] Error checking faction: ${factionName}`, error);
    return false;
  }
}

/**
 * Check if a specific map is ranked
 */
export async function isMapRanked(mapName: string): Promise<boolean> {
  try {
    const result = await query(
      `SELECT is_ranked FROM maps WHERE name = ? LIMIT 1`,
      [mapName]
    );

    if (!result || !(result as any).rows || (result as any).rows.length === 0) {
      return false;
    }

    return (result as any).rows[0].is_ranked === true || (result as any).rows[0].is_ranked === 1;
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
