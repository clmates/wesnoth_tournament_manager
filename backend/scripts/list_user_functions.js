#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { Client } from 'pg';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const outDir = path.resolve(process.cwd(), 'tmp');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, 'user_functions.json');

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    await client.connect();
    const res = await client.query(
      `SELECT n.nspname as schema, p.proname as name, l.lanname as language, pg_get_functiondef(p.oid) as definition
       FROM pg_proc p
       JOIN pg_namespace n ON p.pronamespace = n.oid
       JOIN pg_language l ON p.prolang = l.oid
       WHERE n.nspname = 'public' AND l.lanname <> 'c'
       ORDER BY p.proname`
    );

    fs.writeFileSync(outFile, JSON.stringify(res.rows, null, 2), 'utf8');
    console.log('Wrote user functions to', outFile);
    if (res.rows.length === 0) console.log('No user-defined functions found (language != c).');
    else console.log(`Found ${res.rows.length} function(s).`);
  } catch (err) {
    console.error('Error listing user functions:', err.message || err);
    process.exitCode = 2;
  } finally {
    await client.end();
  }
}

run();
