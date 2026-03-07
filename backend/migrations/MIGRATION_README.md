# PostgreSQL → MariaDB Migration Script

## Overview

Script de migración automatizado que realiza:
1. **DROP y RECREATE** de tablas en MariaDB (usando `mariadb_database_migration_structure.sql`)
2. **Exportación de datos** desde PostgreSQL
3. **Conversión de formato** (COPY → INSERT agrupados)
4. **Importación de datos** a MariaDB
5. **Generación de reportes** (before, after, diferencias)

## Requisitos

- `bash` (shell)
- `psql` (PostgreSQL client)
- `mysql` (MariaDB client)
- `python3` (para conversión de datos)
- Script `convert_pg_copy_to_mariadb.py` (debe estar en el mismo directorio)
- Script `mariadb_database_migration_structure.sql` (debe estar en el mismo directorio)

### Instalación en Debian/Ubuntu

```bash
# PostgreSQL client
sudo apt-get install postgresql-client

# MariaDB client
sudo apt-get install mariadb-client

# Python 3 (probablemente ya instalado)
sudo apt-get install python3
```

## Uso

### Opción 1: Ejecución interactiva

```bash
cd /home/clmates/wesnoth_tournament_manager/backend/migrations/
./migration_complete.sh
```

El script pedirá:
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

### Opción 2: Con variables de entorno

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

## Proceso de Ejecución

### Paso 1: Conexión a PostgreSQL
- Solicita credenciales PostgreSQL
- Valida la conexión
- Exporta datos en formato COPY

### Paso 2: Conteos ANTES
- Genera `before.txt` con rowcounts de todas las tablas PostgreSQL
- Formato: tabla con 29 filas (28 + header + total)

### Paso 3: Conversión de formato
- Ejecuta `convert_pg_copy_to_mariadb.py`
- Convierte COPY format a INSERT agrupados
- Almacena en `migration_tmp/mariadb_converted_[timestamp].sql`

### Paso 4: Recreación de estructura MariaDB
- Solicita credenciales MariaDB
- Ejecuta `mariadb_database_migration_structure.sql`
- **NOTA:** Esto hace DROP de todas las tablas
- Recrea la estructura completa (28 tablas)

### Paso 5: Importación de datos
- Ejecuta el archivo SQL convertido
- Importa todos los datos (1,739 filas en 27 tablas)

### Paso 6: Conteos DESPUÉS
- Genera `after.txt` con rowcounts de MariaDB
- Mismo formato que `before.txt`

### Paso 7: Reporte de comparación
- Genera `results.txt`
- Compara rowcounts: PostgreSQL vs MariaDB
- Muestra diferencias por tabla
- Indica estado de migración (✓ SUCCESS o ✗ MISMATCH)

## Archivos Generados

### En directorio de scripts:
```
before.txt       - Row counts de PostgreSQL ANTES de migración
after.txt        - Row counts de MariaDB DESPUÉS de migración
results.txt      - Reporte detallado de comparación y diferencias
```

### En directorio migration_tmp:
```
pg_data_export_[TIMESTAMP].sql       - Datos exportados de PostgreSQL
mariadb_converted_[TIMESTAMP].sql    - Datos convertidos para MariaDB
```

## Formato de Reportes

### before.txt / after.txt
```
PostgreSQL Row Counts (BEFORE Migration)
==========================================
Generated: [DATE]

TABLE                                    ROW_COUNT
────────────────────────────────────── ───────────
audit_logs                                   232
balance_events                                 1
countries                                     55
...
────────────────────────────────────── ───────────
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
────────────────────────────────────── ────────── ────────── ────────────
audit_logs                                   232        232           0 ✓
balance_events                                 1          1           0 ✓
...
────────────────────────────────────── ────────── ────────── ────────────
TOTAL                                      1739       1739           0
```

## Casos de Uso

### Caso 1: Migración inicial limpia
```bash
./migration_complete.sh
# Todo desde cero: exporta, convierte, dropea, recrea, importa
```

### Caso 2: Re-migración después de encontrar errores
```bash
./migration_complete.sh
# Se pueden cambiar los parámetros de conexión
# El script sobrescribirá los datos anteriores
```

### Caso 3: Validar integridad después de migración manual
```bash
./migration_complete.sh
# Ejecutar solo para generar los reportes de comparación
```

## Validación de Éxito

✓ **La migración fue exitosa si:**
- El script termina sin errores
- `results.txt` muestra Status: ✓ SUCCESS
- Difference en SUMMARY es 0
- Todas las tablas tienen ✓ en DETAILED COMPARISON
- Total de filas PostgreSQL == Total de filas MariaDB

✗ **Problemas comunes:**

| Síntoma | Causa Probable | Solución |
|---------|---|---|
| Connection refused PostgreSQL | Credenciales incorrectas | Verificar host, puerto, usuario, password |
| Connection refused MariaDB | Credenciales incorrectas | Verificar host, puerto, usuario, password |
| Conversion failed | Script Python no existe | Verificar `convert_pg_copy_to_mariadb.py` está en el mismo directorio |
| Structure recreation failed | Archivo SQL no existe | Verificar `mariadb_database_migration_structure.sql` está en el mismo directorio |
| Row count mismatch | Error en conversión de datos | Revisar logs en terminal, ejecutar de nuevo |

## Limpieza

Después de una migración exitosa, puedes limpiar archivos temporales:

```bash
# Mantener solo los reportes finales
rm -rf backend/migrations/migration_tmp/

# O limpiar todo incluyendo reportes
rm -f backend/migrations/before.txt \
      backend/migrations/after.txt \
      backend/migrations/results.txt
rm -rf backend/migrations/migration_tmp/
```

## Seguridad

⚠️ **IMPORTANTE:**
- Las contraseñas se pasan en texto plano. Considera usar:
  - Variables de entorno en lugar de entrada interactiva
  - `.pgpass` para PostgreSQL
  - `.my.cnf` para MariaDB
- Los reportes contienen información de estructura (no datos sensibles)
- Los archivos temporales se almacenan en `migration_tmp/` local

## Troubleshooting

### El script se detiene en PostgreSQL
```bash
# Probar conexión manualmente
psql -h [host] -p [port] -U [user] -d [database] -c "SELECT COUNT(*) FROM audit_logs;"
```

### El script se detiene en MariaDB
```bash
# Probar conexión manualmente
mysql -h [host] -P [port] -u [user] -p[password] [database] -e "SHOW TABLES;"
```

### Problema con Python script
```bash
# Verificar Python version
python3 --version

# Ejecutar conversión manualmente
python3 convert_pg_copy_to_mariadb.py [input_file] [output_file]
```

## Soporte

Para problemas, revisar:
1. Los logs en la consola durante ejecución
2. Los reportes en `before.txt`, `after.txt`, `results.txt`
3. Los archivos SQL temporales en `migration_tmp/`
