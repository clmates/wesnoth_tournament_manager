import {
  calculateGlobalStatistics,
  updateGlobalStatisticsCache,
} from '../services/globalStatisticsService.js';

/**
 * Calculate and update global site statistics
 * Should run every 30 minutes to keep statistics fresh
 */
export const calculateGlobalStatisticsJob = async (): Promise<void> => {
  try {
    console.log('📊 [GlobalStats] Calculating global statistics...');

    const stats = await calculateGlobalStatistics();
    await updateGlobalStatisticsCache(stats);

    console.log(`✅ [GlobalStats] Global statistics updated successfully at ${stats.last_updated}`);
    console.log(`   Users: ${stats.users_total} total, ${stats.users_active} active, ${stats.users_ranked} ranked`);
    console.log(`   Ranked matches: ${stats.matches_today} today, ${stats.matches_total} total`);
    console.log(`   Tournament matches: ${stats.tournament_matches_total} total`);
    console.log(`   Tournaments: ${stats.tournaments_total} total`);
  } catch (error) {
    console.error('❌ [GlobalStats] Error calculating global statistics:', error);
    throw error;
  }
};
