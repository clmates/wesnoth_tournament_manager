/**
 * Replay URL Builder
 * File: backend/src/utils/replayUrlBuilder.ts
 * 
 * Purpose: Build Wesnoth official replay server URLs from replay metadata
 * Format: https://replays.wesnoth.org/{version}/{year}/{month}/{day}/{replay_name}
 */

export interface ReplayUrlComponents {
  wesnothVersion: string;  // e.g., "1.18"
  year: number;            // e.g., 2026
  month: number;           // e.g., 2 (1-12, NOT zero-indexed)
  day: number;             // e.g., 21
  replayName: string;      // e.g., "RBBgJBzJXQEAAAr" or filename without path
}

/**
 * Build official Wesnoth replay server URL
 * 
 * @param components - Replay metadata components
 * @returns Full URL to replay on official Wesnoth server
 * 
 * @example
 * buildReplayUrl({
 *   wesnothVersion: '1.18',
 *   year: 2026,
 *   month: 2,
 *   day: 21,
 *   replayName: 'game_12345'
 * })
 * // Returns: "https://replays.wesnoth.org/1.18/2026/02/21/game_12345.wrz"
 */
export function buildReplayUrl(components: ReplayUrlComponents): string {
  const {
    wesnothVersion,
    year,
    month,
    day,
    replayName
  } = components;

  // Validate inputs
  if (!wesnothVersion) {
    throw new Error('Wesnoth version is required');
  }

  if (!year || year < 2000 || year > 2100) {
    throw new Error('Invalid year provided');
  }

  if (!month || month < 1 || month > 12) {
    throw new Error('Invalid month provided (must be 1-12)');
  }

  if (!day || day < 1 || day > 31) {
    throw new Error('Invalid day provided (must be 1-31)');
  }

  if (!replayName || replayName.trim().length === 0) {
    throw new Error('Replay name is required');
  }

  // Format month and day to 2 digits
  const monthPadded = String(month).padStart(2, '0');
  const dayPadded = String(day).padStart(2, '0');

  // Remove any file extensions from replay name if present
  let cleanReplayName = replayName.trim();
  if (cleanReplayName.endsWith('.wrz')) {
    cleanReplayName = cleanReplayName.slice(0, -4);
  }

  // Build URL
  return `https://replays.wesnoth.org/${wesnothVersion}/${year}/${monthPadded}/${dayPadded}/${cleanReplayName}.wrz`;
}

/**
 * Extract replay components from database record
 * 
 * @param replay - Database replay record with end_time, wesnoth_version, replay_filename
 * @returns ReplayUrlComponents ready for buildReplayUrl()
 */
export function extractReplayComponents(replay: {
  wesnoth_version: string;
  end_time: Date;
  replay_filename: string;
}): ReplayUrlComponents {
  const endTime = new Date(replay.end_time);

  return {
    wesnothVersion: replay.wesnoth_version,
    year: endTime.getFullYear(),
    month: endTime.getMonth() + 1, // getMonth() is 0-indexed
    day: endTime.getDate(),
    replayName: replay.replay_filename
  };
}

/**
 * Build replay URL from database record (convenience function)
 * 
 * @param replay - Database replay record
 * @returns Full URL to replay on official Wesnoth server
 */
export function buildReplayUrlFromRecord(replay: {
  wesnoth_version: string;
  end_time: Date;
  replay_filename: string;
}): string {
  const components = extractReplayComponents(replay);
  return buildReplayUrl(components);
}

/**
 * Validate Wesnoth replay URL format
 * 
 * @param url - URL to validate
 * @returns true if URL matches expected format
 */
export function isValidReplayUrl(url: string): boolean {
  const replayUrlPattern = /^https:\/\/replays\.wesnoth\.org\/\d+\.\d+\/\d{4}\/\d{2}\/\d{2}\/[a-zA-Z0-9_\-]+\.wrz$/;
  return replayUrlPattern.test(url);
}

/**
 * Parse replay URL to extract components
 * 
 * @param url - Replay URL from official Wesnoth server
 * @returns Extracted components or null if invalid format
 * 
 * @example
 * parseReplayUrl("https://replays.wesnoth.org/1.18/2026/02/21/game_12345.wrz")
 * // Returns: { wesnothVersion: "1.18", year: 2026, month: 2, day: 21, replayName: "game_12345" }
 */
export function parseReplayUrl(url: string): ReplayUrlComponents | null {
  const pattern = /^https:\/\/replays\.wesnoth\.org\/(\d+\.\d+)\/(\d{4})\/(\d{2})\/(\d{2})\/([a-zA-Z0-9_\-]+)\.wrz$/;
  const match = url.match(pattern);

  if (!match) {
    return null;
  }

  return {
    wesnothVersion: match[1],
    year: parseInt(match[2]),
    month: parseInt(match[3]),
    day: parseInt(match[4]),
    replayName: match[5]
  };
}
