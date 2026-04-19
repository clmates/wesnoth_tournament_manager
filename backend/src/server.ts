import http from 'http';
import { Server as SocketServer } from 'socket.io';
import app from './app.js';
import { initializeScheduledJobs, autoDiscardUnconfirmedReplays } from './jobs/scheduler.js';
import { runMigrations } from './services/migrationRunner.js';
import { initializeNotificationService } from './services/notificationSocketService.js';

// Port configuration - 7100 for test, 8100 for production
const PORT = parseInt(process.env.PORT || '7100', 10);
const NOTIFICATIONS_ENABLED = process.env.NOTIFICATIONS_ENABLED !== 'false';

// Validate and load replay auto-discard configuration
const validateReplayAutoDiscardConfig = (): number => {
  const envValue = process.env.REPLAY_AUTO_DISCARD_TIME;
  const defaultValue = 30;
  
  if (!envValue) {
    console.log(`ℹ️  REPLAY_AUTO_DISCARD_TIME not set, using default: ${defaultValue} days`);
    return defaultValue;
  }
  
  const thresholdDays = parseInt(envValue, 10);
  if (isNaN(thresholdDays) || thresholdDays <= 0) {
    console.error(`❌ REPLAY_AUTO_DISCARD_TIME must be a positive integer, got: ${envValue}. Using default: ${defaultValue}`);
    return defaultValue;
  }
  
  console.log(`✅ Auto-discard threshold: ${thresholdDays} days`);
  return thresholdDays;
};

const startServer = async () => {
  try {
    // NOTE: PostgreSQL initialization removed - using MariaDB instead
    console.log('ℹ️  Using MariaDB for database operations (phpBB and Tournament Manager)');
    
    // Log environment configuration
    console.log(`\n⚙️  Configuration:`);
    console.log(`   PORT: ${PORT}`);
    console.log(`   NOTIFICATIONS_ENABLED: ${NOTIFICATIONS_ENABLED}`);
    console.log(`   DISCORD_ENABLED: ${process.env.DISCORD_ENABLED === 'true' ? 'true' : 'false'}\n`);
    
    // Validate replay auto-discard configuration
    validateReplayAutoDiscardConfig();
    
    // Run migrations on startup (for all environments)
    console.log('\n🔄 Running database migrations...\n');
    await runMigrations();
    console.log('\n');

    // Create HTTP server for Socket.IO integration
    const server = http.createServer(app);
    
    // Initialize Socket.IO
    const io = new SocketServer(server, {
      cors: {
        origin: [
          'https://wesnoth-tournament-manager.pages.dev',
          'https://main.wesnoth-tournament-manager.pages.dev',
          'https://wesnoth.playranked.org',
          'https://tournament.wesnoth.org',
          'https://tournament-test.wesnoth.org',
          'http://localhost:3000',
          'http://localhost:5173'
        ],
        credentials: true
      }
    });
    
    // Initialize notification service
    initializeNotificationService(io);

    // Listen on all interfaces for Nginx reverse proxy
    // Nginx reverse proxy on tournament.wesnoth.org:443 will forward to this
    server.listen(PORT, () => {
      console.log(`🚀 Backend server running on http://0.0.0.0:${PORT}`);
      console.log('📡 Nginx will reverse proxy tournament.wesnoth.org:443 → localhost:8100');
      console.log('🔌 WebSocket (Socket.IO) ready for real-time notifications');
    });

    // Initialize all scheduled jobs (crons)
    initializeScheduledJobs();
    
    // Run auto-discard on startup in case backend was down during scheduled time
    console.log('\n🔄 Running replay auto-discard on startup...');
    try {
      await autoDiscardUnconfirmedReplays();
      console.log('✅ Startup auto-discard completed\n');
    } catch (error) {
      console.error('❌ Startup auto-discard failed:', error);
      // Don't exit, just log the error
    }
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('\n⏹️  SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\n⏹️  SIGINT received, shutting down gracefully...');
  process.exit(0);
});

startServer();
