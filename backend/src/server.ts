import app from './app.js';
import { initializeScheduledJobs } from './jobs/scheduler.js';
import { runMigrations } from './services/migrationRunner.js';
import ReplayMonitor from './services/replayMonitor.js';

const PORT = parseInt(process.env.PORT || '3000', 10);
let replayMonitor: ReplayMonitor | null = null;

const startServer = async () => {
  try {
    // NOTE: PostgreSQL initialization removed - using MariaDB instead
    console.log('ℹ️  Using MariaDB for database operations (phpBB and Tournament Manager)');
    
    // Run migrations on startup (for all environments)
    console.log('\n🔄 Running database migrations...\n');
    await runMigrations();
    console.log('\n');

    // Listen only on localhost (127.0.0.1)
    // Nginx reverse proxy on wesnoth.org:4443 will forward to this
    app.listen(PORT, '127.0.0.1', () => {
      console.log(`🚀 Backend server running on http://127.0.0.1:${PORT}`);
      console.log('📡 Nginx will reverse proxy wesnoth.org:4443 → localhost:3000');
    });

    // Initialize all scheduled jobs (crons)
    initializeScheduledJobs();

    // Initialize Replay Monitor (if enabled)
    if (process.env.REPLAY_AUTO_PARSE === 'true') {
      console.log('\n🔍 Starting Replay Monitor for automatic match detection...');
      replayMonitor = new ReplayMonitor();
      await replayMonitor.start();
    } else {
      console.log('\n⏭️  Replay Monitor disabled (REPLAY_AUTO_PARSE=false)');
    }
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', async () => {
  console.log('\n⏹️  SIGTERM received, shutting down gracefully...');
  if (replayMonitor) {
    await replayMonitor.stop();
  }
  process.exit(0);
});

process.on('SIGINT', async () => {
  console.log('\n⏹️  SIGINT received, shutting down gracefully...');
  if (replayMonitor) {
    await replayMonitor.stop();
  }
  process.exit(0);
});

startServer();
