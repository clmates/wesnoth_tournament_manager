#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { Client } from 'pg';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Load .env from backend directory
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

const client = new Client({ connectionString: process.env.DATABASE_URL });

async function generateSqlSchema() {
  try {
    await client.connect();
    console.log('✅ Conectado a la BD local');

    // Obtener todas las tablas ordenadas
    const tablesRes = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      ORDER BY table_name
    `);

    let sqlScript = `-- ============================================================
-- WESNOTH TOURNAMENT MANAGER - COMPLETE SCHEMA
-- Generated: ${new Date().toISOString()}
-- Source: Local PostgreSQL Database
-- ============================================================
-- This schema is idempotent (safe to run multiple times)
-- All CREATE TABLE statements use IF NOT EXISTS
-- ============================================================

`;

    // Generar CREATE TABLE para cada tabla
    for (const table of tablesRes.rows) {
      const tableName = table.table_name;
      
      // Obtener columnas
      const columnsRes = await client.query(`
        SELECT column_name, data_type, is_nullable, column_default, 
               character_maximum_length, numeric_precision, numeric_scale
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position
      `, [tableName]);

      sqlScript += `-- ${tableName} table\n`;
      sqlScript += `CREATE TABLE IF NOT EXISTS ${tableName} (\n`;

      const columnDefs = [];
      
      for (const col of columnsRes.rows) {
        let colDef = `  ${col.column_name} ${col.data_type}`;
        
        // Agregar tamaño de caracteres si aplica
        if (col.character_maximum_length && !col.data_type.includes('(')) {
          colDef = `  ${col.column_name} ${col.data_type}(${col.character_maximum_length})`;
        }
        
        // Agregar precisión/escala si aplica
        if (col.numeric_precision && col.data_type !== 'integer') {
          colDef = `  ${col.column_name} ${col.data_type}(${col.numeric_precision}${col.numeric_scale ? ',' + col.numeric_scale : ''})`;
        }
        
        // Agregar DEFAULT
        if (col.column_default) {
          colDef += ` DEFAULT ${col.column_default}`;
        }
        
        // Agregar NOT NULL
        if (col.is_nullable === 'NO') {
          colDef += ' NOT NULL';
        }
        
        columnDefs.push(colDef);
      }

      sqlScript += columnDefs.join(',\n');

      // Obtener PRIMARY KEY
      const pkRes = await client.query(`
        SELECT a.attname
        FROM pg_index i
        JOIN pg_attribute a ON a.attrelid = i.indrelid
          AND a.attnum = ANY(i.indkey)
        JOIN pg_class t ON i.indrelid = t.oid
        WHERE i.indisprimary = true AND t.relname = $1
        ORDER BY a.attnum
      `, [tableName]);

      if (pkRes.rows.length > 0) {
        const pkCols = pkRes.rows.map(r => r.attname).join(', ');
        sqlScript += `,\n  PRIMARY KEY (${pkCols})`;
      }

      // Obtener UNIQUE constraints
      const uniqueRes = await client.query(`
        SELECT constraint_name, string_agg(column_name, ', ' ORDER BY ordinal_position)::text as columns
        FROM information_schema.constraint_column_usage ccu
        JOIN information_schema.columns col 
          ON col.table_schema = ccu.table_schema 
          AND col.table_name = ccu.table_name 
          AND col.column_name = ccu.column_name
        WHERE ccu.table_schema = 'public' AND ccu.table_name = $1
          AND ccu.constraint_name IN (
            SELECT constraint_name 
            FROM information_schema.table_constraints 
            WHERE constraint_type = 'UNIQUE' 
              AND table_schema = 'public' 
              AND table_name = $1
          )
        GROUP BY ccu.constraint_name
      `, [tableName]);

      if (uniqueRes.rows.length > 0) {
        uniqueRes.rows.forEach(u => {
          sqlScript += `,\n  UNIQUE (${u.columns})`;
        });
      }

      // Obtener CHECK constraints
      const checkRes = await client.query(`
        SELECT pg_get_constraintdef(oid) as definition
        FROM pg_constraint
        WHERE conrelid = $1::regclass AND contype = 'c'
      `, [tableName]);

      if (checkRes.rows.length > 0) {
        checkRes.rows.forEach(c => {
          const def = c.definition.replace(/^CHECK /, '').replace(/\)$/, '');
          sqlScript += `,\n  CHECK (${def})`;
        });
      }

      // Obtener FOREIGN KEY constraints
      const fkRes = await client.query(`
        SELECT 
          kcu.column_name,
          ccu.table_name as foreign_table,
          ccu.column_name as foreign_column,
          rc.update_rule,
          rc.delete_rule
        FROM information_schema.referential_constraints rc
        JOIN information_schema.key_column_usage kcu
          ON rc.constraint_name = kcu.constraint_name
          AND rc.constraint_schema = kcu.table_schema
        JOIN information_schema.constraint_column_usage ccu
          ON rc.unique_constraint_name = ccu.constraint_name
          AND rc.unique_constraint_schema = ccu.table_schema
        WHERE rc.constraint_schema = 'public' AND kcu.table_name = $1
      `, [tableName]);

      if (fkRes.rows.length > 0) {
        fkRes.rows.forEach(fk => {
          sqlScript += `,\n  FOREIGN KEY (${fk.column_name}) REFERENCES ${fk.foreign_table}(${fk.foreign_column})`;
          if (fk.delete_rule && fk.delete_rule !== 'RESTRICT') {
            sqlScript += ` ON DELETE ${fk.delete_rule}`;
          }
          if (fk.update_rule && fk.update_rule !== 'RESTRICT') {
            sqlScript += ` ON UPDATE ${fk.update_rule}`;
          }
        });
      }

      sqlScript += '\n);\n\n';
    }

    // Agregar índices
    const indexRes = await client.query(`
      SELECT tablename, indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public' 
        AND indexname NOT LIKE '%_pkey'
        AND indexdef NOT LIKE '%UNIQUE%'
      ORDER BY tablename, indexname
    `);

    if (indexRes.rows.length > 0) {
      sqlScript += `-- ============================================================\n`;
      sqlScript += `-- Indexes\n`;
      sqlScript += `-- ============================================================\n`;
      indexRes.rows.forEach(idx => {
        sqlScript += `${idx.indexdef};\n`;
      });
      sqlScript += `\n`;
    }

    // Footer
    sqlScript += `-- ============================================================\n`;
    sqlScript += `-- Schema generation complete\n`;
    sqlScript += `-- Total tables: ${tablesRes.rows.length}\n`;
    sqlScript += `-- Total indexes: ${indexRes.rows.length}\n`;
    sqlScript += `-- ============================================================\n`;

    // Guardar archivo
    const outPath = path.resolve(__dirname, '..', 'src', 'config', 'schema_full.sql');
    fs.writeFileSync(outPath, sqlScript, 'utf8');
    
    console.log(`\n✅ Esquema generado exitosamente`);
    console.log(`📁 Ubicación: ${outPath}`);
    console.log(`📊 Total de tablas: ${tablesRes.rows.length}`);
    console.log(`📇 Total de índices: ${indexRes.rows.length}`);
    console.log(`\n✨ El archivo schema_full.sql está listo para usarse en Supabase`);

    await client.end();
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

generateSqlSchema();
