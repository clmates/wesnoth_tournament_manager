#!/bin/bash

################################################################################
# Complete migration script: PostgreSQL -> MariaDB
# 
# Steps:
# 1. DROP and RECREATE tables in MariaDB
# 2. Download data from PostgreSQL
# 3. Convert COPY format to INSERT
# 4. Import data into MariaDB
# 5. Generate reports (before, after, differences)
################################################################################

set -e

# Output colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Directories
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
MIGRATION_TMP="${SCRIPT_DIR}/migration_tmp"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)

# Files
PG_EXPORT="${MIGRATION_TMP}/pg_data_export_${TIMESTAMP}.sql"
MARIADB_CONVERTED="${MIGRATION_TMP}/mariadb_converted_${TIMESTAMP}.sql"
BEFORE_REPORT="${SCRIPT_DIR}/before.txt"
AFTER_REPORT="${SCRIPT_DIR}/after.txt"
RESULTS_REPORT="${SCRIPT_DIR}/results.txt"

# Connection variables
PG_HOST=""
PG_PORT=""
PG_DB=""
PG_USER=""
PG_PASS=""
MB_HOST=""
MB_PORT=""
MB_DB=""
MB_USER=""
MB_PASS=""

# Create temporary directory
mkdir -p "${MIGRATION_TMP}"

echo -e "${BLUE}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${BLUE}║  PostgreSQL → MariaDB Migration Script                       ║${NC}"
echo -e "${BLUE}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""

################################################################################
# Function: Connect to PostgreSQL and download data
################################################################################
get_pg_data() {
    echo -e "${YELLOW}[1/5] Connecting to PostgreSQL...${NC}"
    
    read -p "PostgreSQL Host (default: $PG_HOST): " INPUT && PG_HOST="${INPUT:-$PG_HOST}"
    read -p "PostgreSQL Port (default: $PG_PORT): " INPUT && PG_PORT="${INPUT:-$PG_PORT}"
    read -p "PostgreSQL Database (default: $PG_DB): " INPUT && PG_DB="${INPUT:-$PG_DB}"
    read -p "PostgreSQL User (default: $PG_USER): " INPUT && PG_USER="${INPUT:-$PG_USER}"
    read -sp "PostgreSQL Password (press Enter to use default): " INPUT && PG_PASS="${INPUT:-$PG_PASS}"
    echo ""
    
    export PGPASSWORD="$PG_PASS"
    
    echo -e "${BLUE}Exporting data from PostgreSQL...${NC}"
    
    # Export data in COPY format
    pg_dump -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" \
            --data-only --on-conflict=nothing \
            -t audit_logs -t balance_events -t countries -t factions \
            -t faction_map_statistics -t faction_map_statistics_history \
            -t faction_translations -t faq -t game_maps -t map_translations \
            -t matches -t migrations -t news -t password_history \
            -t password_policy -t player_match_statistics -t player_of_month \
            -t system_settings -t team_substitutes -t tournament_matches \
            -t tournament_participants -t tournament_round_matches -t tournament_rounds \
            -t tournament_teams -t tournament_unranked_factions -t tournament_unranked_maps \
            -t tournaments -t "user" \
            "$PG_DB" > "$PG_EXPORT" 2>/dev/null
    
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ PostgreSQL data exported: ${PG_EXPORT}${NC}"
    else
        echo -e "${RED}✗ Error exporting from PostgreSQL${NC}"
        unset PGPASSWORD
        exit 1
    fi
    
    unset PGPASSWORD
}

################################################################################
# Function: Get row counts from PostgreSQL (BEFORE migration)
################################################################################
get_pg_counts() {
    echo -e "${BLUE}Getting row counts from PostgreSQL...${NC}"
    
    export PGPASSWORD="$PG_PASS"
    
    # List of tables
    local tables=(
        audit_logs balance_events countries factions
        faction_map_statistics faction_map_statistics_history
        faction_translations faq game_maps map_translations
        matches migrations news password_history
        password_policy player_match_statistics player_of_month
        system_settings team_substitutes tournament_matches
        tournament_participants tournament_round_matches tournament_rounds
        tournament_teams tournament_unranked_factions tournament_unranked_maps
        tournaments "user"
    )
    
    # Create report header
    {
        echo "PostgreSQL Row Counts (BEFORE Migration)"
        echo "=========================================="
        echo "Generated: $(date)"
        echo ""
        printf "%-40s %15s\n" "TABLE" "ROW_COUNT"
        printf "%-40s %15s\n" "$(printf '%.0s-' {1..40})" "$(printf '%.0s-' {1..15})"
        
        local total=0
        for table in "${tables[@]}"; do
            # Get row count from PostgreSQL for this table
            local count=$(psql -h "$PG_HOST" -p "$PG_PORT" -U "$PG_USER" \
                              -t -c "SELECT COUNT(*) FROM \"$table\";" "$PG_DB" 2>/dev/null | xargs)
            [ -z "$count" ] && count="0"
            printf "%-40s %15s\n" "$table" "$count"
            total=$((total + count))
        done
        
        printf "%-40s %15s\n" "$(printf '%.0s-' {1..40})" "$(printf '%.0s-' {1..15})"
        printf "%-40s %15s\n" "TOTAL" "$total"
        echo ""
    } > "$BEFORE_REPORT"
    
    unset PGPASSWORD
    echo -e "${GREEN}✓ Before report generated: ${BEFORE_REPORT}${NC}"
}

################################################################################
# Function: Convert data from COPY format to INSERT
################################################################################
convert_data() {
    echo -e "${YELLOW}[2/5] Converting data format...${NC}"
    
    echo -e "${BLUE}Running Python conversion script...${NC}"
    
    # Run the conversion script to transform COPY format to MariaDB INSERT format
    if python3 "${SCRIPT_DIR}/convert_pg_copy_to_mariadb.py" \
               "$PG_EXPORT" "$MARIADB_CONVERTED" 2>&1; then
        echo -e "${GREEN}✓ Data converted successfully${NC}"
    else
        echo -e "${RED}✗ Conversion failed${NC}"
        exit 1
    fi
}

################################################################################
# Function: Connect to MariaDB and recreate structure
################################################################################
recreate_mariadb_structure() {
    echo -e "${YELLOW}[3/5] Recreating MariaDB structure...${NC}"
    
    read -p "MariaDB Host (default: $MB_HOST): " INPUT && MB_HOST="${INPUT:-$MB_HOST}"
    read -p "MariaDB Port (default: $MB_PORT): " INPUT && MB_PORT="${INPUT:-$MB_PORT}"
    read -p "MariaDB Database (default: $MB_DB): " INPUT && MB_DB="${INPUT:-$MB_DB}"
    read -p "MariaDB User (default: $MB_USER): " INPUT && MB_USER="${INPUT:-$MB_USER}"
    read -sp "MariaDB Password (press Enter to use default): " INPUT && MB_PASS="${INPUT:-$MB_PASS}"
    echo ""
    
    echo -e "${BLUE}Dropping and recreating tables...${NC}"
    
    # Execute the migration structure SQL file
    if mysql -h "$MB_HOST" -P "$MB_PORT" -u "$MB_USER" -p"$MB_PASS" \
             --skip-ssl "$MB_DB" < "${SCRIPT_DIR}/mariadb_database_migration_structure.sql" 2>/dev/null; then
        echo -e "${GREEN}✓ MariaDB structure recreated${NC}"
    else
        echo -e "${RED}✗ Error recreating MariaDB structure${NC}"
        exit 1
    fi
}

################################################################################
# Function: Import data to MariaDB
################################################################################
import_mariadb_data() {
    echo -e "${YELLOW}[4/5] Importing data to MariaDB...${NC}"
    
    echo -e "${BLUE}Executing import...${NC}"
    
    # Import the converted data file
    if mysql -h "$MB_HOST" -P "$MB_PORT" -u "$MB_USER" -p"$MB_PASS" \
             --skip-ssl "$MB_DB" < "$MARIADB_CONVERTED" 2>/dev/null; then
        echo -e "${GREEN}✓ Data imported successfully${NC}"
    else
        echo -e "${RED}✗ Error importing data${NC}"
        exit 1
    fi
}

################################################################################
# Function: Get row counts from MariaDB (AFTER migration)
################################################################################
get_mariadb_counts() {
    echo -e "${BLUE}Getting row counts from MariaDB...${NC}"
    
    local tables=(
        audit_logs balance_events countries factions
        faction_map_statistics faction_map_statistics_history
        faction_translations faq game_maps map_translations
        matches migrations news password_history
        password_policy player_match_statistics player_of_month
        system_settings team_substitutes tournament_matches
        tournament_participants tournament_round_matches tournament_rounds
        tournament_teams tournament_unranked_factions tournament_unranked_maps
        tournaments users_extension
    )
    
    # Create report header
    {
        echo "MariaDB Row Counts (AFTER Migration)"
        echo "====================================="
        echo "Generated: $(date)"
        echo ""
        printf "%-40s %15s\n" "TABLE" "ROW_COUNT"
        printf "%-40s %15s\n" "$(printf '%.0s-' {1..40})" "$(printf '%.0s-' {1..15})"
        
        local total=0
        for table in "${tables[@]}"; do
            # Get row count from MariaDB for this table
            local count=$(mysql -h "$MB_HOST" -P "$MB_PORT" -u "$MB_USER" -p"$MB_PASS" \
                               --skip-ssl -sN -e "SELECT COUNT(*) FROM \`$table\`;" "$MB_DB" 2>/dev/null | xargs)
            [ -z "$count" ] && count="0"
            printf "%-40s %15s\n" "$table" "$count"
            total=$((total + count))
        done
        
        printf "%-40s %15s\n" "$(printf '%.0s-' {1..40})" "$(printf '%.0s-' {1..15})"
        printf "%-40s %15s\n" "TOTAL" "$total"
        echo ""
    } > "$AFTER_REPORT"
    
    echo -e "${GREEN}✓ After report generated: ${AFTER_REPORT}${NC}"
}

################################################################################
# Function: Compare and generate differences report
################################################################################
generate_comparison_report() {
    echo -e "${YELLOW}[5/5] Generating comparison report...${NC}"
    
    {
        echo "Migration Comparison Report"
        echo "==========================="
        echo "Generated: $(date)"
        echo ""
        echo "SUMMARY:"
        echo "--------"
        
        # Extract totals from before and after reports
        local before_total=$(grep "^TOTAL" "$BEFORE_REPORT" | awk '{print $NF}')
        local after_total=$(grep "^TOTAL" "$AFTER_REPORT" | awk '{print $NF}')
        local difference=$((after_total - before_total))
        
        printf "PostgreSQL Total Rows: %s\n" "$before_total"
        printf "MariaDB Total Rows:    %s\n" "$after_total"
        printf "Difference:            %s\n" "$difference"
        echo ""
        
        if [ "$difference" -eq 0 ]; then
            echo "Status: ✓ SUCCESS - All rows transferred!"
        else
            echo "Status: ✗ MISMATCH - Row count difference detected"
        fi
        
        echo ""
        echo "DETAILED COMPARISON:"
        echo "-------------------"
        printf "%-40s %15s %15s %15s\n" "TABLE" "PG_COUNT" "MB_COUNT" "DIFFERENCE"
        printf "%-40s %15s %15s %15s\n" "$(printf '%.0s-' {1..40})" "$(printf '%.0s-' {1..15})" "$(printf '%.0s-' {1..15})" "$(printf '%.0s-' {1..15})"
        
        # Extract and compare counts for each table
        local tables=(
            audit_logs balance_events countries factions
            faction_map_statistics faction_map_statistics_history
            faction_translations faq game_maps map_translations
            matches migrations news password_history
            password_policy player_match_statistics player_of_month
            system_settings team_substitutes tournament_matches
            tournament_participants tournament_round_matches tournament_rounds
            tournament_teams tournament_unranked_factions tournament_unranked_maps
            tournaments
        )
        
        local pg_count mb_count diff status
        for table in "${tables[@]}"; do
            pg_count=$(grep "^$table " "$BEFORE_REPORT" 2>/dev/null | awk '{print $NF}' || echo "0")
            mb_count=$(grep "^$table " "$AFTER_REPORT" 2>/dev/null | awk '{print $NF}' || echo "0")
            [ -z "$pg_count" ] && pg_count="0"
            [ -z "$mb_count" ] && mb_count="0"
            diff=$((mb_count - pg_count))
            
            if [ "$diff" -eq 0 ]; then
                status="✓"
            else
                status="✗"
            fi
            
            printf "%-40s %15s %15s %15s %s\n" "$table" "$pg_count" "$mb_count" "$diff" "$status"
        done
        
        # users_extension table (mapped from PostgreSQL 'user' table)
        pg_count=$(grep "^user " "$BEFORE_REPORT" 2>/dev/null | awk '{print $NF}' || echo "0")
        mb_count=$(grep "^users_extension " "$AFTER_REPORT" 2>/dev/null | awk '{print $NF}' || echo "0")
        [ -z "$pg_count" ] && pg_count="0"
        [ -z "$mb_count" ] && mb_count="0"
        diff=$((mb_count - pg_count))
        
        if [ "$diff" -eq 0 ]; then
            status="✓"
        else
            status="✗"
        fi
        printf "%-40s %15s %15s %15s %s\n" "users_extension (from user)" "$pg_count" "$mb_count" "$diff" "$status"
        
        printf "%-40s %15s %15s %15s\n" "$(printf '%.0s-' {1..40})" "$(printf '%.0s-' {1..15})" "$(printf '%.0s-' {1..15})" "$(printf '%.0s-' {1..15})"
        printf "%-40s %15s %15s %15s\n" "TOTAL" "$before_total" "$after_total" "$difference"
        
    } > "$RESULTS_REPORT"
    
    echo -e "${GREEN}✓ Comparison report generated: ${RESULTS_REPORT}${NC}"
}

################################################################################
# MAIN EXECUTION
################################################################################

# Step 1: Get data from PostgreSQL
get_pg_data

# Step 2: Get row counts before migration
get_pg_counts

# Step 3: Convert data format
convert_data

# Step 4: Connect to MariaDB and recreate structure
recreate_mariadb_structure

# Step 5: Import data
import_mariadb_data

# Step 6: Get row counts after migration
get_mariadb_counts

# Step 7: Generate comparison report
generate_comparison_report

# Display migration completion summary
echo ""
echo -e "${GREEN}╔════════════════════════════════════════════════════════════════╗${NC}"
echo -e "${GREEN}║  MIGRATION COMPLETED SUCCESSFULLY!                            ║${NC}"
echo -e "${GREEN}╚════════════════════════════════════════════════════════════════╝${NC}"
echo ""
echo "Generated Reports:"
echo "  • Before:  ${BEFORE_REPORT}"
echo "  • After:   ${AFTER_REPORT}"
echo "  • Results: ${RESULTS_REPORT}"
echo ""
echo "Temporary Files:"
echo "  • Directory: ${MIGRATION_TMP}"
echo "  • PG Export:     ${PG_EXPORT}"
echo "  • Converted SQL: ${MARIADB_CONVERTED}"
echo ""

# Display the comparison report
echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
cat "$RESULTS_REPORT"
echo -e "${BLUE}════════════════════════════════════════════════════════════════${NC}"
