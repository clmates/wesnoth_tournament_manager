#!/usr/bin/env python3
"""
convert_pg_to_mariadb_data.py

Converts a PostgreSQL data-only export (with INSERT statements) to MariaDB-compatible SQL.
- Renames 'users' table to 'users_extension' and only includes columns present in the MariaDB structure.
- Converts booleans (TRUE/FALSE) to 1/0.
- Ensures timestamps are in 'YYYY-MM-DD HH:MM:SS' format.
- Leaves other tables' INSERTs mostly unchanged, but you can add more rules as needed.

Usage:
  python3 convert_pg_to_mariadb_data.py full_database_export_testenvironment.txt mariadb_data_import.sql
"""
import sys
import re
from datetime import datetime

# Columns to keep for users_extension (must match MariaDB structure)
USERS_EXTENSION_COLUMNS = [
    'username', 'nickname', 'country', 'avatar', 'language', 'discord_id', 'elo_rating', 'level',
    'is_rated', 'elo_provisional', 'total_wins', 'total_losses', 'trend', 'matches_played',
    'failed_login_attempts', 'locked_until', 'last_login_attempt', 'created_at', 'updated_at'
]

def convert_bool(val):
    if val == 'TRUE': return '1'
    if val == 'FALSE': return '0'
    return val

def convert_timestamp(val):
    # Remove timezone if present, keep as 'YYYY-MM-DD HH:MM:SS'
    if val.startswith("'") and val.endswith("'"):
        v = val.strip("'")
        if 'T' in v:
            v = v.replace('T', ' ')
        if '+' in v:
            v = v.split('+')[0]
        if '.' in v:
            v = v.split('.')[0]
        return f"'{v}'"
    return val

def process_insert(line):
    # For users table, remap to users_extension and filter columns
    m = re.match(r"INSERT INTO ([\w\.]+) \(([^)]+)\) VALUES (.+);", line)
    if not m:
        return line
    table = m.group(1)
    columns = [c.strip() for c in m.group(2).split(',')]
    values_part = m.group(3)
    if table.endswith('.users'):
        # Only keep columns in USERS_EXTENSION_COLUMNS
        keep_idx = [i for i, c in enumerate(columns) if c in USERS_EXTENSION_COLUMNS]
        new_columns = [columns[i] for i in keep_idx]
        # Split values (handle multi-row inserts)
        value_rows = re.findall(r'\(([^)]+)\)', values_part)
        new_value_rows = []
        for row in value_rows:
            vals = [v.strip() for v in re.split(r',(?![^\(]*\))', row)]
            vals = [convert_bool(vals[i]) for i in keep_idx]
            vals = [convert_timestamp(v) if 'timestamp' in new_columns[j] or 'created_at' in new_columns[j] or 'updated_at' in new_columns[j] else v for j, v in enumerate(vals)]
            new_value_rows.append(f"({', '.join(vals)})")
        return f"INSERT INTO users_extension ({', '.join(new_columns)}) VALUES\n  {',\n  '.join(new_value_rows)};"
    else:
        # For other tables, just convert booleans and timestamps
        def fix_row(row):
            vals = [v.strip() for v in re.split(r',(?![^\(]*\))', row)]
            vals = [convert_bool(v) for v in vals]
            vals = [convert_timestamp(v) if re.match(r"'.*\d{2}:\d{2}:\d{2}.*'", v) else v for v in vals]
            return f"({', '.join(vals)})"
        value_rows = re.findall(r'\(([^)]+)\)', values_part)
        new_value_rows = [fix_row(row) for row in value_rows]
        return f"INSERT INTO {table.split('.')[-1]} ({', '.join(columns)}) VALUES\n  {',\n  '.join(new_value_rows)};"

def main():
    if len(sys.argv) != 3:
        print("Usage: python3 convert_pg_to_mariadb_data.py <input_pg_export.sql> <output_mariadb.sql>")
        sys.exit(1)
    infile, outfile = sys.argv[1], sys.argv[2]
    with open(infile, 'r') as fin, open(outfile, 'w') as fout:
        for line in fin:
            if line.startswith('INSERT INTO'):
                fout.write(process_insert(line) + '\n')
            # Optionally, copy TRUNCATE/DELETE/SET/other statements if needed
    print(f"Conversion complete. Output written to {outfile}")

if __name__ == '__main__':
    main()
