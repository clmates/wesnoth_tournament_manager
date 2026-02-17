import { query } from '../config/database.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Run pending migrations from the migrations folder
 */
export async function runMigrations() {
  try {
    if (process.env.BACKEND_DEBUG_LOGS === 'true') console.log('🔄 Starting database migrations...');

    // Create migrations tracking table if it doesn't exist
    await query(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) UNIQUE NOT NULL,
        executed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Get list of migration files
    const migrationsDir = path.join(__dirname, '../../migrations');
    const migrationFiles = fs.readdirSync(migrationsDir)
      .filter(file => file.endsWith('.sql'))
      .sort();

    if (migrationFiles.length === 0) {
      if (process.env.BACKEND_DEBUG_LOGS === 'true') console.log('✅ No migration files found');
      return;
    }

    // Get list of already executed migrations
    const executedResult = await query('SELECT name FROM public.migrations');
    const executed = new Set(executedResult.rows.map((row: any) => row.name));

    // Run pending migrations
    let executedCount = 0;
    for (const migrationFile of migrationFiles) {
      if (executed.has(migrationFile)) {
        if (process.env.BACKEND_DEBUG_LOGS === 'true') console.log(`⏭️  Skipping already executed: ${migrationFile}`);
        continue;
      }

      try {
        const migrationPath = path.join(migrationsDir, migrationFile);
        const migrationSQL = fs.readFileSync(migrationPath, 'utf-8');

        // Execute migration
        await query(migrationSQL);

        // Record migration as executed
        await query(
          'INSERT INTO public.migrations (name) VALUES ($1)',
          [migrationFile]
        );

        if (process.env.BACKEND_DEBUG_LOGS === 'true') console.log(`✅ Executed: ${migrationFile}`);
        executedCount++;
      } catch (error) {
        console.error(`❌ Failed to execute migration ${migrationFile}:`, error);
        throw error;
      }
    }

    if (executedCount === 0) {
      if (process.env.BACKEND_DEBUG_LOGS === 'true') console.log('✅ All migrations already executed');
    } else {
      if (process.env.BACKEND_DEBUG_LOGS === 'true') console.log(`✅ Successfully executed ${executedCount} migration(s)`);
    }
  } catch (error) {
    console.error('❌ Migration error:', error);
    throw error;
  }
}

export default { runMigrations };
