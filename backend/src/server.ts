import app from './app.js';
import { query } from './config/database.js';
import { runMigrations } from './scripts/migrate.js';
import { initializeScheduledJobs } from './jobs/scheduler.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = parseInt(process.env.PORT || '3000', 10);

const initDatabase = async () => {
  try {
    const schemaPath = path.join(__dirname, 'config', 'schema.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf-8');
    
    // Execute the entire schema file as one statement to preserve DO $$ blocks
    await query(schemaSQL);

    // Insert default password policy if not exists
    const policyResult = await query('SELECT COUNT(*) FROM password_policy');
    if (parseInt(policyResult.rows[0].count) === 0) {
      await query(`
        INSERT INTO password_policy (min_length, require_uppercase, require_lowercase, require_numbers, require_symbols, previous_passwords_count)
        VALUES (8, true, true, true, true, 5)
      `);
    }

    console.log('✅ Database initialized');

    // Run pending migrations
    await runMigrations();
  } catch (error) {
    console.error('❌ Database initialization error:', error);
  }
};

const startServer = async () => {
  try {
    await initDatabase();

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
