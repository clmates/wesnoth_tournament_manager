import app from './app.js';
import { query } from './config/database.js';
import * as fs from 'fs';
import * as path from 'path';
import { fileURLToPath } from 'url';

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

    console.log('Database initialized');
  } catch (error) {
    console.error('Database initialization error:', error);
  }
};

const startServer = async () => {
  try {
    await initDatabase();

    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
