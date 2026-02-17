import app from './app.js';
import { initializeScheduledJobs } from './jobs/scheduler.js';

const PORT = parseInt(process.env.PORT || '3000', 10);

const startServer = async () => {
  try {
    // NOTE: PostgreSQL initialization removed - using MariaDB instead
    console.log('ℹ️  Using MariaDB for database operations (phpBB and Tournament Manager)');
    
    // Initialize scheduled jobs if needed
    // await initializeScheduledJobs();

    // Listen only on localhost (127.0.0.1)
    // Nginx reverse proxy on wesnoth.org:4443 will forward to this
    app.listen(PORT, '127.0.0.1', () => {
      console.log(`🚀 Backend server running on http://127.0.0.1:${PORT}`);
      console.log('📡 Nginx will reverse proxy wesnoth.org:4443 → localhost:3000');
    });

    // Initialize all scheduled jobs (crons)
    initializeScheduledJobs();
    
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
