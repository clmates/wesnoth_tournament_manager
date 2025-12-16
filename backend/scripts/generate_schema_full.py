#!/usr/bin/env python3
import os
import sys
import psycopg2
from dotenv import load_dotenv
from pathlib import Path

# Load .env
backend_dir = Path(__file__).parent.parent
load_dotenv(backend_dir / '.env')

DATABASE_URL = os.getenv('DATABASE_URL')

if not DATABASE_URL:
    print('❌ Error: DATABASE_URL no encontrada en .env')
    sys.exit(1)

try:
    conn = psycopg2.connect(DATABASE_URL)
    cursor = conn.cursor()
    print('✅ Conectado a la BD local')
    
    # Obtener todas las tablas
    cursor.execute("""
        SELECT table_name 
        FROM information_schema.tables 
        WHERE table_schema = 'public' 
        ORDER BY table_name
    """)
    
    tables = cursor.fetchall()
    
    sql_script = f"""-- ============================================================
-- WESNOTH TOURNAMENT MANAGER - COMPLETE SCHEMA
-- Generated: {__import__('datetime').datetime.now().isoformat()}
-- Source: Local PostgreSQL Database
-- ============================================================
-- This schema is idempotent (safe to run multiple times)
-- All CREATE TABLE statements use IF NOT EXISTS
-- ============================================================

"""
    
    for (table_name,) in tables:
        # Obtener columnas
        cursor.execute("""
            SELECT column_name, data_type, is_nullable, column_default, 
                   character_maximum_length, numeric_precision, numeric_scale
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = %s
            ORDER BY ordinal_position
        """, (table_name,))
        
        columns = cursor.fetchall()
        
        sql_script += f"-- {table_name} table\n"
        sql_script += f"CREATE TABLE IF NOT EXISTS {table_name} (\n"
        
        col_defs = []
        for col in columns:
            col_name, data_type, is_nullable, col_default, char_max_len, num_precision, num_scale = col
            
            col_def = f"  {col_name} {data_type}"
            
            if char_max_len and '(' not in data_type:
                col_def = f"  {col_name} {data_type}({char_max_len})"
            
            if num_precision and data_type != 'integer':
                scale = f",{num_scale}" if num_scale else ""
                col_def = f"  {col_name} {data_type}({num_precision}{scale})"
            
            if col_default:
                col_def += f" DEFAULT {col_default}"
            
            if is_nullable == 'NO':
                col_def += " NOT NULL"
            
            col_defs.append(col_def)
        
        sql_script += ",\n".join(col_defs)
        
        # Obtener PRIMARY KEY
        cursor.execute("""
            SELECT a.attname
            FROM pg_index i
            JOIN pg_attribute a ON a.attrelid = i.indrelid
              AND a.attnum = ANY(i.indkey)
            JOIN pg_class t ON i.indrelid = t.oid
            WHERE i.indisprimary = true AND t.relname = %s
            ORDER BY a.attnum
        """, (table_name,))
        
        pk_cols = cursor.fetchall()
        if pk_cols:
            pk_str = ", ".join([col[0] for col in pk_cols])
            sql_script += f",\n  PRIMARY KEY ({pk_str})"
        
        # Obtener FOREIGN KEYs
        cursor.execute("""
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
            WHERE rc.constraint_schema = 'public' AND kcu.table_name = %s
        """, (table_name,))
        
        fks = cursor.fetchall()
        for fk in fks:
            col, fk_table, fk_col, upd_rule, del_rule = fk
            sql_script += f",\n  FOREIGN KEY ({col}) REFERENCES {fk_table}({fk_col})"
            if del_rule and del_rule != 'RESTRICT':
                sql_script += f" ON DELETE {del_rule}"
            if upd_rule and upd_rule != 'RESTRICT':
                sql_script += f" ON UPDATE {upd_rule}"
        
        sql_script += "\n);\n\n"
    
    # Obtener índices
    cursor.execute("""
        SELECT tablename, indexname, indexdef
        FROM pg_indexes
        WHERE schemaname = 'public' 
          AND indexname NOT LIKE '%_pkey'
          AND indexdef NOT LIKE '%UNIQUE%'
        ORDER BY tablename, indexname
    """)
    
    indexes = cursor.fetchall()
    if indexes:
        sql_script += "-- ============================================================\n"
        sql_script += "-- Indexes\n"
        sql_script += "-- ============================================================\n"
        for table, idx_name, idx_def in indexes:
            sql_script += f"{idx_def};\n"
        sql_script += "\n"
    
    # Footer
    sql_script += "-- ============================================================\n"
    sql_script += f"-- Schema generation complete\n"
    sql_script += f"-- Total tables: {len(tables)}\n"
    sql_script += f"-- Total indexes: {len(indexes)}\n"
    sql_script += "-- ============================================================\n"
    
    # Guardar archivo
    out_path = backend_dir / 'src' / 'config' / 'schema_full.sql'
    with open(out_path, 'w', encoding='utf-8') as f:
        f.write(sql_script)
    
    print(f"\n✅ Esquema generado exitosamente")
    print(f"📁 Ubicación: {out_path}")
    print(f"📊 Total de tablas: {len(tables)}")
    print(f"📇 Total de índices: {len(indexes)}")
    print(f"\n✨ El archivo schema_full.sql está listo para usarse en Supabase")
    
    cursor.close()
    conn.close()

except Exception as e:
    print(f"❌ Error: {str(e)}")
    sys.exit(1)
