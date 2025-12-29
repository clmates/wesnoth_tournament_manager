import app from './app.js';
import { query } from './config/database.js';
import { runMigrations } from './scripts/migrate.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';
import cron from 'node-cron';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = process.env.PORT || 3000;

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

    app.listen(PORT, () => {
      console.log(`🚀 Server running on port ${PORT}`);
    });

    // Schedule daily balance snapshot at 00:30 UTC
    cron.schedule('30 0 * * *', async () => {
      try {
        console.log('⏰ Running scheduled daily balance snapshot...');
        await query('SELECT daily_snapshot_faction_map_statistics()');
        console.log('✅ Daily balance snapshot created successfully');
      } catch (error) {
        console.error('❌ Failed to create daily snapshot:', error);
      }
    });
    
    // Schedule daily inactive player check at 01:00 UTC
    // Marks players as inactive if they have no confirmed matches in the last 30 days
    cron.schedule('0 1 * * *', async () => {
      try {
        console.log('👤 Running daily inactive player check...');
        const result = await query(
          `UPDATE users 
           SET is_active = false, updated_at = CURRENT_TIMESTAMP
           WHERE is_active = true 
             AND is_blocked = false
             AND id NOT IN (
               SELECT DISTINCT u.id
               FROM users u
               INNER JOIN matches m ON (m.winner_id = u.id OR m.loser_id = u.id)
               WHERE m.status = 'confirmed' 
                 AND m.created_at >= CURRENT_DATE - INTERVAL '30 days'
             )
           RETURNING id`
        );
        if (result.rows.length > 0) {
          console.log(`✅ Marked ${result.rows.length} players as inactive (no activity in 30 days)`);
        }
      } catch (error) {
        console.error('❌ Failed to check inactive players:', error);
      }
    });
    
    console.log('📅 Daily snapshot scheduler initialized (runs at 00:30 UTC)');
    console.log('👤 Daily inactive player checker initialized (runs at 01:00 UTC)');
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
