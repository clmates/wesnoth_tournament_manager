#!/bin/bash
# migrate_pg_to_mariadb.sh
# Migrates selected tables from PostgreSQL to MariaDB, including structure changes for users/users_extension.
# Usage: ./migrate_pg_to_mariadb.sh

set -e

# --- CONFIGURATION ---
# PostgreSQL connection
PG_HOST="localhost"
PG_PORT="5432"
PG_USER="your_pg_user"
PG_DB="your_pg_db"
PG_SCHEMA="public"

# MariaDB connection
MDB_HOST="localhost"
MDB_PORT="3306"
MDB_USER="your_mariadb_user"
MDB_PASS="your_mariadb_password"
MDB_DB="your_mariadb_db"

# Migration working directory
WORKDIR="$(pwd)/migration_tmp"
mkdir -p "$WORKDIR"

# Tables to migrate (update as needed)
TABLES=(
  faction_map_statistics_history
  player_match_statistics
  audit_logs
  faction_map_statistics
  tournament_matches
  tournament_participants
  tournament_round_matches
  tournament_unranked_factions
  matches
  tournament_rounds
  migrations
  countries
  tournament_unranked_maps
  game_maps
  tournament_teams
  users
  tournaments
  map_translations
  factions
  faq
  password_history
  faction_translations
  news
  password_policy
  player_of_month
  balance_events
  system_settings
  team_substitutes
)

# --- STEP 1: SELECT COUNTS BEFORE EXPORT ---
echo "[INFO] Getting row counts from PostgreSQL before export..."
BEFORE_FILE="$WORKDIR/before.txt"
echo -e "Table\tCount" > "$BEFORE_FILE"
for tbl in "${TABLES[@]}"; do
  psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" -c "SELECT '$tbl', COUNT(*) FROM $PG_SCHEMA.\"$tbl\";" -t | awk '{print $1 "\t" $2}' >> "$BEFORE_FILE"
done

# --- STEP 2: EXPORT DATA FROM POSTGRESQL ---
DUMP_FILE="$WORKDIR/pg_data_export.sql"
echo "[INFO] Exporting data from PostgreSQL..."
pg_dump -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" -d "$PG_DB" --data-only --column-inserts $(printf -- "--table=%s " "${TABLES[@]}") > "$DUMP_FILE"
echo "[INFO] Data export complete: $DUMP_FILE"

# --- STEP 3: CONVERT DATA TO MARIADB FORMAT ---
CONVERTED_FILE="$WORKDIR/mariadb_data_import.sql"
echo "[INFO] Converting PostgreSQL data export to MariaDB format..."
python3 "$(dirname "$0")/convert_pg_to_mariadb_data.py" "$DUMP_FILE" "$CONVERTED_FILE"
echo "[INFO] Data conversion complete: $CONVERTED_FILE"

# --- STEP 4: IMPORT INTO MARIADB ---
echo "[INFO] Importing data into MariaDB..."
mysql -h "$MDB_HOST" -P "$MDB_PORT" -u "$MDB_USER" -p"$MDB_PASS" "$MDB_DB" < "$CONVERTED_FILE"
echo "[INFO] Data import complete."

# --- STEP 5: SELECT COUNTS AFTER IMPORT ---
AFTER_FILE="$WORKDIR/after.txt"
echo -e "Table\tCount" > "$AFTER_FILE"
for tbl in "${TABLES[@]}"; do
  mysql -h "$MDB_HOST" -P "$MDB_PORT" -u "$MDB_USER" -p"$MDB_PASS" -D "$MDB_DB" -N -e "SELECT '$tbl', COUNT(*) FROM ${tbl == "users" ? "users_extension" : tbl};" | awk '{print $1 "\t" $2}' >> "$AFTER_FILE"
done

echo "[INFO] Migration complete. Row counts before and after are in:"
echo "  $BEFORE_FILE"
echo "  $AFTER_FILE"
