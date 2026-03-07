#!/usr/bin/env python3
r"""
convert_pg_copy_to_mariadb.py

Converts PostgreSQL COPY statements to grouped INSERT statements for MariaDB.
- Reads COPY format lines (tab-separated values)
- Groups all data for each table into a single bulk INSERT
- Handles \N as NULL
- Converts types: booleans, JSON, timestamps, etc.

Usage:
  python3 convert_pg_copy_to_mariadb.py full_database_export_testenvironment.txt mariadb_data_import.sql
"""

import sys
import re
from collections import defaultdict

# Reserved keywords in MariaDB/MySQL that need escaping with backticks
RESERVED_KEYWORDS = {
    'order', 'group', 'select', 'from', 'where', 'table', 'key', 'value', 'status',
    'level', 'range', 'check', 'create', 'alter', 'drop', 'delete', 'insert', 'update',
    'union', 'join', 'left', 'right', 'inner', 'outer', 'on', 'using', 'having',
    'limit', 'offset', 'distinct', 'all', 'any', 'some', 'exists', 'in', 'between',
    'like', 'is', 'null', 'and', 'or', 'not', 'as', 'by', 'with', 'case', 'when',
    'then', 'else', 'end', 'type', 'user', 'role', 'permission', 'column', 'index',
    'constraint', 'foreign', 'primary', 'unique', 'default', 'cascade', 'restrict',
    'action', 'match', 'partition', 'interval', 'precision', 'cascade', 'restrict',
    'set', 'cascade', 'restrict', 'change', 'modify', 'rename', 'add', 'constraint',
    'call', 'procedure', 'function', 'trigger', 'view', 'database', 'schema'
}

# Columns to keep for users_extension
USERS_EXTENSION_COLUMNS = [
    'id', 'nickname', 'email', 'password_hash', 'language', 'discord_id', 'elo_rating', 
    'level', 'is_active', 'is_blocked', 'is_admin', 'created_at', 'updated_at', 'is_rated',
    'matches_played', 'elo_provisional', 'total_wins', 'total_losses', 'trend',
    'failed_login_attempts', 'locked_until', 'last_login_attempt', 'password_must_change',
    'country', 'avatar', 'email_verified', 'password_reset_token', 'password_reset_expires',
    'email_verification_token', 'email_verification_expires'
]

def escape_column_name(col):
    """Escape reserved column names with backticks"""
    col_lower = col.lower().strip('"`')
    if col_lower in RESERVED_KEYWORDS:
        return f'`{col_lower}`'
    return col_lower

def convert_value(val):
    """Convert values from PostgreSQL (COPY format) to MariaDB"""
    if val == '\\N':
        return 'NULL'
    
    # Booleans
    if val == 't':
        return '1'
    if val == 'f':
        return '0'
    
    # Remove timezone offset from timestamps (PostgreSQL: +00:00 or +00)
    # Format: YYYY-MM-DD HH:MM:SS.microseconds+TZ
    if '+' in val and 'e' not in val.lower():  # avoid scientific notation
        val = re.sub(r'(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}(?:\.\d+)?)\+.*$', r'\1', val)
    
    # Strings: escape quotes and wrap in quotes
    val = val.replace("\\", "\\\\")
    val = val.replace("'", "\\'")
    return f"'{val}'"

def main():
    if len(sys.argv) != 3:
        print("Usage: python3 convert_pg_copy_to_mariadb.py <input_pg_export.sql> <output_mariadb.sql>")
        sys.exit(1)
    
    infile = sys.argv[1]
    outfile = sys.argv[2]
    
    print(f"Converting {infile} (COPY format) to MariaDB format...")
    
    # Group data by table
    tables_data = defaultdict(lambda: {'columns': None, 'rows': []})
    
    current_table = None
    current_columns = None
    
    with open(infile, 'r', encoding='utf-8') as f:
        for line in f:
            line = line.rstrip('\n')
            
            # Detectar COPY statement
            if line.startswith('COPY public.'):
                # Extraer tabla y columnas
                match = re.match(r'COPY public\.(\w+) \((.*?)\) FROM stdin;', line)
                if match:
                    current_table = match.group(1)
                    cols_str = match.group(2)
                    current_columns = [c.strip() for c in cols_str.split(',')]
                    
                    # Rename users to users_extension
                    if current_table == 'users':
                        current_table = 'users_extension'
                    
                    tables_data[current_table]['columns'] = current_columns
                    print(f"  Reading table: {current_table}")
                continue
            
            # End of COPY
            if line == '\\.':
                current_table = None
                current_columns = None
                continue
            
            # Skip empty lines and comments
            if not line or line.startswith('--'):
                continue
            
            # If we're inside a COPY, parse the data
            if current_table and current_columns:
                # Split by tabs
                values = line.split('\t')
                
                # Filter columns if it's users_extension
                if current_table == 'users_extension':
                    filtered_cols = current_columns
                    filtered_vals = values
                    
                    # Keep only the desired columns
                    new_vals = []
                    for i, col in enumerate(filtered_cols):
                        if col in USERS_EXTENSION_COLUMNS:
                            if i < len(filtered_vals):
                                new_vals.append(filtered_vals[i])
                            else:
                                new_vals.append('\\N')
                    
                    # Update columns
                    filtered_cols = [c for c in filtered_cols if c in USERS_EXTENSION_COLUMNS]
                    values = new_vals
                
                # Convert values
                converted = [convert_value(v) for v in values]
                tables_data[current_table]['rows'].append(converted)
    
    # Generate SQL file
    with open(outfile, 'w', encoding='utf-8') as f:
        f.write("-- MariaDB data import (COPY format converted to INSERT)\n")
        f.write("-- Generated from PostgreSQL export\n\n")
        
        for table in sorted(tables_data.keys()):
            data = tables_data[table]
            if not data['rows']:
                continue
            
            cols = data['columns']
            rows = data['rows']
            
            # If it's users_extension, filter columns
            if table == 'users_extension':
                cols = [c for c in cols if c in USERS_EXTENSION_COLUMNS]
            
            # Escape reserved column names and remove quotes
            cols_clean = [escape_column_name(c) for c in cols]
            
            # Generate bulk INSERT
            f.write(f"-- {table}: {len(rows)} rows\n")
            f.write(f"INSERT INTO {table} ({', '.join(cols_clean)}) VALUES\n")
            
            for i, row in enumerate(rows):
                # Filter values according to columns
                if table == 'users_extension':
                    filtered_row = []
                    for j, col in enumerate(data['columns']):
                        if col in USERS_EXTENSION_COLUMNS:
                            if j < len(row):
                                filtered_row.append(row[j])
                            else:
                                filtered_row.append('NULL')
                    row = filtered_row
                
                row_str = '(' + ', '.join(row) + ')'
                if i < len(rows) - 1:
                    f.write(f"  {row_str},\n")
                else:
                    f.write(f"  {row_str};\n")
            
            f.write("\n")
    
    print(f"✅ Conversion completed")
    print(f"   Tables: {len([t for t in tables_data if tables_data[t]['rows']])}")
    print(f"   Output file: {outfile}")
    for table in sorted(tables_data.keys()):
        if tables_data[table]['rows']:
            print(f"   - {table}: {len(tables_data[table]['rows'])} rows")

if __name__ == '__main__':
    main()
