import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { queryTournament } from '../config/tournamentDatabase.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.resolve(__dirname, '../../migrations');

/**
 * Convert PostgreSQL syntax to MariaDB syntax
 */
function convertPostgresToMariaDB(sql: string): string {
  let converted = sql;

  // Replace gen_random_uuid() with UUID()
  converted = converted.replace(/gen_random_uuid\(\)/gi, 'UUID()');

  // Replace JSONB with JSON
  converted = converted.replace(/\bJSONB\b/gi, 'JSON');

  // Replace CURRENT_TIMESTAMP ON UPDATE syntax
  converted = converted.replace(
    /CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP/gi,
    'CURRENT_TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP'
  );

  // Remove public. schema references (MariaDB doesn't use this)
  converted = converted.replace(/\bpublic\./gi, '');

  // Replace NOW() with CURRENT_TIMESTAMP (both work, but CURRENT_TIMESTAMP is more consistent)
  // Keep NOW() as is - it's compatible with MariaDB

  // Replace SERIAL with INT AUTO_INCREMENT
  converted = converted.replace(/\bSERIAL\b/gi, 'INT AUTO_INCREMENT');

  // Replace TEXT with LONGTEXT where needed for JSONB columns  
  // (this is handled by JSON replacement above)

  // Replace || concatenation operator with CONCAT()
  // This is tricky, so we'll skip it for now as it might appear in WHERE clauses

  // Replace REFERENCES syntax if needed
  // (MariaDB supports standard FOREIGN KEY syntax, so this should work)

  return converted;
}

/**
 * Initialize migrations table if it doesn't exist
 */
async function initializeMigrationsTable(): Promise<void> {
  try {
    await queryTournament(`
      CREATE TABLE IF NOT EXISTS migrations (
        id INT AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(255) NOT NULL UNIQUE,
        executed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        INDEX idx_name (name)
      )
    `);
    console.log('✅ Migrations table ready');
  } catch (error) {
    console.error('❌ Error initializing migrations table:', error);
    throw error;
  }
}

/**
 * Get list of already applied migrations
 */
async function getAppliedMigrations(): Promise<string[]> {
  try {
    const results = await queryTournament(
      'SELECT name FROM migrations ORDER BY executed_at'
    ) as any;
    // Handle both { rows: [...] } and direct array formats
    const rows = results?.rows || results || [];
    return rows.map((row: any) => row.name);
  } catch (error) {
    console.error('❌ Error fetching applied migrations:', error);
    return [];
  }
}

/**
 * Get list of pending SQL migration files
 */
function getPendingMigrationFiles(): string[] {
  try {
    const files = fs.readdirSync(MIGRATIONS_DIR);
    
    // Filter SQL files that look like migrations (start with date or have .sql extension)
    const sqlFiles = files.filter(
      (file) =>
        file.endsWith('.sql') &&
        (file.match(/^\d{8}/) || file.match(/^\d{4}-\d{2}-\d{2}/))
    );
    
    return sqlFiles.sort(); // Sort alphabetically/chronologically
  } catch (error) {
    console.error('❌ Error reading migrations directory:', error);
    return [];
  }
}

/**
 * Execute a single migration file
 */
async function executeMigration(filename: string): Promise<void> {
  try {
    const filePath = path.join(MIGRATIONS_DIR, filename);
    let sql = fs.readFileSync(filePath, 'utf8');
    
    // Convert PostgreSQL syntax to MariaDB
    sql = convertPostgresToMariaDB(sql);
    
    // Remove multi-line comments /* ... */
    sql = sql.replace(/\/\*[\s\S]*?\*\//g, '');
    
    // Split by semicolon and filter out empty statements
    const statements = sql
      .split(';')
      .map((stmt) => stmt.trim())
      .filter((stmt) => stmt.length > 0 && !stmt.startsWith('--'));
    
    console.log(`   📄 Found ${statements.length} SQL statements`);
    
    // Execute each statement
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      try {
        await queryTournament(statement);
      } catch (stmtError) {
        console.error(`   Error in statement ${i + 1}/${statements.length}:`, stmtError);
        throw stmtError;
      }
    }
    
    // Record migration as applied ONLY if all statements succeeded
    await queryTournament(
      'INSERT INTO migrations (name) VALUES (?)',
      [filename]
    );
    
  } catch (error) {
    console.error(`❌ Error executing migration ${filename}:`, error);
    throw error;
  }
}

/**
 * Run all pending migrations
 */
export async function runMigrations(): Promise<void> {
  try {
    console.log('🔄 Starting database migrations...\n');

    // Step 1: Initialize migrations table
    await initializeMigrationsTable();

    // Step 2: Get applied migrations
    const appliedMigrations = await getAppliedMigrations();
    console.log(`📊 Already applied: ${appliedMigrations.length} migrations\n`);

    // Step 3: Get pending migrations
    const allMigrations = getPendingMigrationFiles();
    const pendingMigrations = allMigrations.filter(
      (file) => !appliedMigrations.includes(file)
    );

    if (pendingMigrations.length === 0) {
      console.log('✅ Database is up to date\n');
      return;
    }

    console.log(`📝 Pending migrations: ${pendingMigrations.length}\n`);

    // Step 4: Execute pending migrations
    for (let i = 0; i < pendingMigrations.length; i++) {
      const migration = pendingMigrations[i];
      console.log(`[${i + 1}/${pendingMigrations.length}] ⏳ Executing: ${migration}`);
      await executeMigration(migration);
      console.log(`[${i + 1}/${pendingMigrations.length}] ✅ Completed: ${migration}\n`);
    }

    console.log(`\n✅ All migrations completed successfully`);
  } catch (error) {
    console.error('\n❌ Migration failed:', error);
    throw error;
  }
}
