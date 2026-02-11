# PostgreSQL → MariaDB Migration Script

## Overview

Automated migration script that performs:
1. **DROP and RECREATE** tables in MariaDB (using `mariadb_database_migration_structure.sql`)
2. **Data Export** from PostgreSQL
3. **Format Conversion** (COPY → Grouped INSERTs)
4. **Data Import** into MariaDB
5. **Report Generation** (before, after, differences)

## Requirements

- `bash` (shell)
- `psql` (PostgreSQL client)
- `mysql` (MariaDB client)
- `python3` (for data conversion)
- Script `convert_pg_copy_to_mariadb.py` (must be in same directory)
- Script `mariadb_database_migration_structure.sql` (must be in same directory)

### Installation on Debian/Ubuntu

```bash
# PostgreSQL client
sudo apt-get install postgresql-client

# MariaDB client
sudo apt-get install mariadb-client

# Python 3 (probably already installed)
sudo apt-get install python3
```

## Usage

### Option 1: Interactive Execution

```bash
cd /home/clmates/wesnoth_tournament_manager/backend/migrations/
./migration_complete.sh
```

The script will prompt for:
1. **PostgreSQL Connection Details:**
   - Host (default: localhost)
   - Port (default: 5432)
   - Database name
   - Username
   - Password

2. **MariaDB Connection Details:**
   - Host (default: localhost)
   - Port (default: 3306)
   - Database name
   - Username
   - Password

### Option 2: Using Environment Variables

```bash
export PG_HOST="localhost"
export PG_PORT="5432"
export PG_DB="database"
export PG_USER="user"
export PG_PASS="your_password"

export MB_HOST="host"
export MB_PORT="3306"
export MB_DB="database"
export MB_USER="user"
export MB_PASS="your_password"

./migration_complete.sh
```

## Execution Process

### Step 1: PostgreSQL Connection
- Requests PostgreSQL credentials
- Validates connection
- Exports data in COPY format

### Step 2: Row Counts BEFORE
- Generates `before.txt` with row counts from all PostgreSQL tables
- Format: Table with 29 rows (28 tables + header + total)

### Step 3: Format Conversion
- Executes `convert_pg_copy_to_mariadb.py`
- Converts COPY format to grouped INSERTs
- Stores in `migration_tmp/mariadb_converted_[timestamp].sql`

### Step 4: MariaDB Structure Recreation
- Requests MariaDB credentials
- Executes `mariadb_database_migration_structure.sql`
- **NOTE:** This performs DROP on all tables
- Recreates complete structure (28 tables)

### Step 5: Data Import
- Executes converted SQL file
- Imports all data (1,739 rows across 27 tables)

### Step 6: Row Counts AFTER
- Generates `after.txt` with row counts from MariaDB
- Same format as `before.txt`

### Step 7: Comparison Report
- Generates `results.txt`
- Compares row counts: PostgreSQL vs MariaDB
- Shows differences per table
- Indicates migration status (✓ SUCCESS or ✗ MISMATCH)

## Generated Files

### In migrations directory:
```
before.txt       - PostgreSQL row counts BEFORE migration
after.txt        - MariaDB row counts AFTER migration
results.txt      - Detailed comparison and differences report
```

### In migration_tmp directory:
```
pg_data_export_[TIMESTAMP].sql       - PostgreSQL exported data
mariadb_converted_[TIMESTAMP].sql    - Converted data for MariaDB
```

## Report Format

### before.txt / after.txt
```
PostgreSQL Row Counts (BEFORE Migration)
==========================================
Generated: [DATE]

TABLE                                    ROW_COUNT
 ───────────
audit_logs                                   232
balance_events                                 1
countries                                     55
...
 ───────────
TOTAL                                      1739
```

### results.txt
```
Migration Comparison Report
===========================
Generated: [DATE]

SUMMARY:
--------
PostgreSQL Total Rows: 1739
MariaDB Total Rows:    1739
Difference:            0

Status: ✓ SUCCESS - All rows transferred!

DETAILED COMPARISON:
-------------------
TABLE                                    PG_COUNT    MB_COUNT  DIFFERENCE
 ────────── ────────── ────────────
audit_logs                                   232        232           0 ✓
balance_events                                 1          1           0 ✓
...
 ────────── ────────── ────────────
TOTAL                                      1739       1739           0
```

## Use Cases

### Case 1: Clean Initial Migration
```bash
./migration_complete.sh
# All from scratch: exports, converts, drops, recreates, imports
```

### Case 2: Re-migration after errors
```bash
./migration_complete.sh
# Can change connection parameters
# Script will overwrite previous data
```

### Case 3: Validate integrity after manual migration
```bash
./migration_complete.sh
# Run only to generate comparison reports
```

## Success Validation

 **Migration was successful if:**
- Script completes without errors
- `results.txt` shows Status: ✓ SUCCESS
- Difference in SUMMARY is 0
- All tables have ✓ in DETAILED COMPARISON
- PostgreSQL total rows == MariaDB total rows

 **Common Problems:**

| Symptom | Probable Cause | Solution |
|---------|---|---|
| Connection refused PostgreSQL | Incorrect credentials | Verify host, port, user, password |
| Connection refused MariaDB | Incorrect credentials | Verify host, port, user, password |
| Conversion failed | Python script not found | Verify `convert_pg_copy_to_mariadb.py` is in same directory |
| Structure recreation failed | SQL file not found | Verify `mariadb_database_migration_structure.sql` is in same directory |
| Row count mismatch | Data conversion error | Review terminal logs, run again |

## Cleanup

After successful migration, you can clean up temporary files:

```bash
# Keep only final reports
rm -rf backend/migrations/migration_tmp/

# Or clean everything including reports
rm -f backend/migrations/before.txt \
      backend/migrations/after.txt \
      backend/migrations/results.txt
rm -rf backend/migrations/migration_tmp/
```

## Security

 **IMPORTANT:**
- Passwords are passed in plain text. Consider using:
  - Environment variables instead of interactive input
  - `.pgpass` for PostgreSQL
  - `.my.cnf` for MariaDB
- Reports contain structure information (no sensitive data)
- Temporary files are stored locally in `migration_tmp/`

## Troubleshooting

### Script stops at PostgreSQL
```bash
# Test connection manually
psql -h [host] -p [port] -U [user] -d [database] -c "SELECT COUNT(*) FROM audit_logs;"
```

### Script stops at MariaDB
```bash
# Test connection manually
mysql -h [host] -P [port] -u [user] -p[password] [database] -e "SHOW TABLES;"
```

### Problem with Python script
```bash
# Check Python version
python3 --version

# Run conversion manually
python3 convert_pg_copy_to_mariadb.py [input_file] [output_file]
```

## Support

For issues, review:
1. Console logs during execution
2. Reports in `before.txt`, `after.txt`, `results.txt`
3. Temporary SQL files in `migration_tmp/`
