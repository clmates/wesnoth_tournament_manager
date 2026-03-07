import app from './app.js';
import { initializeScheduledJobs } from './jobs/scheduler.js';
import { runMigrations } from './services/migrationRunner.js';

const PORT = parseInt(process.env.PORT || '3000', 10);

const startServer = async () => {
  try {
    // NOTE: PostgreSQL initialization removed - using MariaDB instead
    console.log('ℹ️  Using MariaDB for database operations (phpBB and Tournament Manager)');
    
    // Run migrations on startup (for all environments)
    console.log('\n🔄 Running database migrations...\n');
    await runMigrations();
    console.log('\n');

    // Listen on all interfaces for Nginx reverse proxy
    // Nginx reverse proxy on tournament.wesnoth.org:443 will forward to this
    app.listen(PORT, () => {
      console.log(`🚀 Backend server running on http://0.0.0.0:${PORT}`);
      console.log('📡 Nginx will reverse proxy tournament.wesnoth.org:443 → localhost:8100');
    });

    // Initialize all scheduled jobs (crons)
    initializeScheduledJobs();
    
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
