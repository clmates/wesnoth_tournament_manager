#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { Client } from 'pg';

dotenv.config({ path: path.resolve(process.cwd(), '.env') });

const outDir = path.resolve(process.cwd(), 'tmp');
if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
const outFile = path.join(outDir, 'db_schema.json');

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    await client.connect();

    const tablesRes = await client.query(
      `SELECT table_name, table_type
       FROM information_schema.tables
       WHERE table_schema = 'public'
       ORDER BY table_name`
    );

    const pkRes = await client.query(
      `SELECT tc.table_name, kcu.column_name, tc.constraint_type
       FROM information_schema.table_constraints tc
       JOIN information_schema.key_column_usage kcu
         ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
       WHERE tc.table_schema = 'public' AND tc.constraint_type IN ('PRIMARY KEY','UNIQUE')`
    );

    const fkRes = await client.query(
      `SELECT tc.table_name, kcu.column_name, ccu.table_name AS foreign_table_name, ccu.column_name AS foreign_column_name
       FROM information_schema.table_constraints AS tc
       JOIN information_schema.key_column_usage AS kcu
         ON tc.constraint_name = kcu.constraint_name
         AND tc.table_schema = kcu.table_schema
       JOIN information_schema.constraint_column_usage AS ccu
         ON tc.constraint_name = ccu.constraint_name
         AND tc.table_schema = ccu.table_schema
       WHERE tc.constraint_type = 'FOREIGN KEY' AND tc.table_schema = 'public'`
    );

    const indexRes = await client.query(
      `SELECT tablename, indexname, indexdef FROM pg_indexes WHERE schemaname = 'public' ORDER BY tablename`);

    // Additional constraints: CHECKs and other constraint definitions
    const constraintRes = await client.query(
      `SELECT t.relname as table_name, c.oid::regprocedure::text as constraint_oid, conname, contype, pg_get_constraintdef(c.oid) as definition
       FROM pg_constraint c
       JOIN pg_class t ON c.conrelid = t.oid
       JOIN pg_namespace n ON t.relnamespace = n.oid
       WHERE n.nspname = 'public' ORDER BY t.relname`);

    // Triggers
    const triggersRes = await client.query(
      `SELECT c.relname as table_name, t.tgname as trigger_name, pg_get_triggerdef(t.oid) as definition
       FROM pg_trigger t
       JOIN pg_class c ON t.tgrelid = c.oid
       JOIN pg_namespace n ON c.relnamespace = n.oid
       WHERE n.nspname = 'public' AND NOT t.tgisinternal`);

    // Sequences owned by columns
    const seqRes = await client.query(
      `SELECT seq.relname as sequence_name, tab.relname as table_name, col.attname as column_name
       FROM pg_class seq
       JOIN pg_depend d ON d.objid = seq.oid
       JOIN pg_class tab ON d.refobjid = tab.oid
       JOIN pg_attribute col ON col.attrelid = tab.oid AND col.attnum = d.refobjsubid
       WHERE seq.relkind = 'S' AND d.deptype = 'a' AND tab.relnamespace = (SELECT oid FROM pg_namespace WHERE nspname = 'public')`);

    // Functions in public schema (definitions)
    const funcRes = await client.query(
      `SELECT n.nspname as schema, p.proname as name, pg_get_functiondef(p.oid) as definition
       FROM pg_proc p
       JOIN pg_namespace n ON p.pronamespace = n.oid
       WHERE n.nspname = 'public' ORDER BY p.proname`
    );

    // User-defined functions (language not 'c')
    const funcUserRes = await client.query(
      `SELECT n.nspname as schema, p.proname as name, l.lanname as language, pg_get_functiondef(p.oid) as definition
       FROM pg_proc p
       JOIN pg_namespace n ON p.pronamespace = n.oid
       JOIN pg_language l ON p.prolang = l.oid
       WHERE n.nspname = 'public' AND l.lanname <> 'c' ORDER BY p.proname`
    );

    // Rules (pg_rules view) in public schema
    const rulesRes = await client.query(
      `SELECT * FROM pg_rules WHERE schemaname = 'public' ORDER BY tablename, rulename`);

    const result = {};

    for (const row of tablesRes.rows) {
      const table = row.table_name;
      const colsRes = await client.query(
        `SELECT column_name, data_type, is_nullable, column_default, ordinal_position
         FROM information_schema.columns
         WHERE table_schema = 'public' AND table_name = $1
         ORDER BY ordinal_position`,
        [table]
      );
      const constraints = constraintRes.rows.filter(c => c.table_name === table).map(c => ({ name: c.conname, type: c.contype, definition: c.definition }));
      const triggers = triggersRes.rows.filter(t => t.table_name === table).map(t => ({ name: t.trigger_name, definition: t.definition }));
      const sequences = seqRes.rows.filter(s => s.table_name === table).map(s => ({ sequence_name: s.sequence_name, column: s.column_name }));

      result[table] = {
        table_type: row.table_type,
        columns: colsRes.rows,
        primary_keys: pkRes.rows.filter(r => r.table_name === table && r.constraint_type === 'PRIMARY KEY').map(r => r.column_name),
        unique_columns: pkRes.rows.filter(r => r.table_name === table && r.constraint_type === 'UNIQUE').map(r => r.column_name),
        foreign_keys: fkRes.rows.filter(r => r.table_name === table).map(r => ({ column: r.column_name, references_table: r.foreign_table_name, references_column: r.foreign_column_name })),
        constraints,
        triggers,
        sequences,
        indexes: indexRes.rows.filter(r => r.tablename === table).map(r => ({ indexname: r.indexname, indexdef: r.indexdef }))
      };
    }

    const fullOutFile = path.join(outDir, 'db_schema_full.json');
    const output = { tables: result, functions: funcRes.rows, user_functions: funcUserRes.rows, rules: rulesRes.rows };
    fs.writeFileSync(outFile, JSON.stringify(output, null, 2), 'utf8');
    fs.writeFileSync(fullOutFile, JSON.stringify(output, null, 2), 'utf8');
    // also write only user-defined functions to a separate file for quick access
    const userFuncsFile = path.join(outDir, 'user_functions.json');
    fs.writeFileSync(userFuncsFile, JSON.stringify(funcUserRes.rows, null, 2), 'utf8');
    console.log('Wrote DB schema to', outFile);
    console.log('Wrote full DB schema to', fullOutFile);

    // Also produce a markdown summary at repo root
    const mdLines = [];
    mdLines.push('# Database schema (live)');
    mdLines.push('');
    mdLines.push(`Extracted on: ${new Date().toISOString()}`);
    for (const [table, info] of Object.entries(result)) {
      mdLines.push(`\n## Table: ${table}\n`);
      mdLines.push('Columns:');
      mdLines.push('| Column | Type | Nullable | Default |');
      mdLines.push('|---|---|---:|---|');
      for (const c of info.columns) {
        mdLines.push(`| ${c.column_name} | ${c.data_type} | ${c.is_nullable} | ${c.column_default || ''} |`);
      }
      if (info.primary_keys && info.primary_keys.length) mdLines.push(`\n**Primary key**: ${info.primary_keys.join(', ')}`);
      if (info.unique_columns && info.unique_columns.length) mdLines.push(`\n**Unique columns**: ${info.unique_columns.join(', ')}`);
      if (info.foreign_keys && info.foreign_keys.length) {
        mdLines.push('\n**Foreign keys:**');
        for (const fk of info.foreign_keys) mdLines.push(`- ${fk.column} -> ${fk.references_table}(${fk.references_column})`);
      }
      if (info.constraints && info.constraints.length) {
        mdLines.push('\n**Constraints:**');
        for (const ct of info.constraints) mdLines.push(`- ${ct.name} [${ct.type}]: ${ct.definition}`);
      }
      if (info.indexes && info.indexes.length) {
        mdLines.push('\n**Indexes:**');
        for (const ix of info.indexes) mdLines.push(`- ${ix.indexname}: \`${ix.indexdef}\``);
      }
      if (info.triggers && info.triggers.length) {
        mdLines.push('\n**Triggers:**');
        for (const tg of info.triggers) mdLines.push(`- ${tg.name}: ${tg.definition}`);
      }
      if (info.sequences && info.sequences.length) {
        mdLines.push('\n**Sequences owned:**');
        for (const s of info.sequences) mdLines.push(`- ${s.sequence_name} (column: ${s.column})`);
      }
    }
    // Append only user-defined Functions (exclude C/extension functions)
    mdLines.push('\n## Application-defined Functions (public schema)\n');
    if (funcUserRes.rows.length === 0) {
      mdLines.push('No application-defined functions found in the `public` schema.');
    } else {
      for (const f of funcUserRes.rows) {
        mdLines.push(`\n### Function: ${f.name} (${f.language})`);
        mdLines.push('```sql');
        mdLines.push(f.definition.trim());
        mdLines.push('```');
      }
    }
    mdLines.push('\n*Note: extension functions (typically implemented in C) are present in the schema; the full function list (including extension functions) is available in `backend/tmp/db_schema_full.json`.*');

    // Append Rules
    mdLines.push('\n## Rules (pg_rules for public schema)\n');
    if (rulesRes.rows.length === 0) {
      mdLines.push('No rules found in `public` schema.');
    } else {
      for (const r of rulesRes.rows) {
        mdLines.push(`\n### Rule: ${r.schemaname}.${r.tablename} -> ${r.rulename}`);
        mdLines.push('');
        mdLines.push('**Definition:**');
        mdLines.push('');
        mdLines.push('```');
        mdLines.push(JSON.stringify(r));
        mdLines.push('```');
      }
    }
    const mdPath = path.resolve(process.cwd(), '..', 'DB_SCHEMA.md');
    fs.writeFileSync(mdPath, mdLines.join('\n'), 'utf8');
    console.log('Wrote markdown summary to', mdPath);
  } catch (err) {
    console.error('Error extracting DB schema:', err.message || err);
    process.exitCode = 2;
  } finally {
    await client.end();
  }
}

run();
