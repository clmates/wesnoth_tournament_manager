# Clone Database Instructions / Instrucciones de Clonación de Base de Datos

## English

### Overview
This script clones the `tournament` database to `tournament-test` safely, with the following guarantees:
- Verifies backend services are stopped (prevents data corruption)
- Creates automatic backups before making changes
- Validates the clone was successful
- Preserves dump files for troubleshooting

### Prerequisites
1. Backend services must be **stopped** before running
2. MariaDB/MySQL must be installed on chantal.wesnoth.org
3. User must have database admin privileges
4. Both `tournament` and `tournament-test` databases must exist

### How to Create tournament-test Database (if missing)
```bash
# SSH into chantal.wesnoth.org
ssh chantal.wesnoth.org

# Create the database
mysql -u root -p -e "CREATE DATABASE tournament-test;"
```

### Usage

#### Option 1: Interactive (Recommended)
```bash
# Clone with defaults (tournament → tournament-test, user = root, host = localhost)
./scripts/clone_tournament_db.sh

# Or specify custom values
./scripts/clone_tournament_db.sh tournament tournament-test root localhost

# With --skip-ssl flag (if your MySQL requires it)
./scripts/clone_tournament_db.sh tournament tournament-test root localhost --skip-ssl
```

#### Option 2: One-liner with password
```bash
# If password is 'mypassword':
mysql -u root -pmypassword tournament | \
  mysql -u root -pmypassword tournament-test
```

#### Option 3: SSH to chantal and run remotely
```bash
# From your local machine:
ssh chantal.wesnoth.org "/path/to/clone_tournament_db.sh"
```

### What the Script Does

1. **Checks backend is stopped** - Fails if services are running
2. **Prompts for MySQL password** - Reads securely (not visible on screen)
3. **Verifies connectivity** - Tests MySQL connection
4. **Verifies source database** - Ensures `tournament` exists
5. **Verifies target database** - Ensures `tournament-test` exists
6. **Asks for confirmation** - Prevents accidental overwrites
7. **Creates backup** - Saves current state of `tournament-test` to `/tmp/`
8. **Dumps source** - Exports entire `tournament` schema and data
9. **Clears target** - Drops and recreates `tournament-test`
10. **Restores dump** - Imports dump into `tournament-test`
11. **Verifies integrity** - Compares table counts to ensure success

### Backup and Recovery

If something goes wrong, the script saves:
- **Dump file**: `/tmp/tournament_dump_TIMESTAMP.sql` - Full export of source
- **Backup file**: `/tmp/tournament-test_backup_TIMESTAMP.sql` - Previous state of target

To restore from backup:
```bash
mysql -u root -p tournament-test < /tmp/tournament-test_backup_TIMESTAMP.sql
```

### Next Steps After Clone
1. Start backend services again:
   ```bash
   cd /home/carlos/programacion/wesnoth_tournament_manager
   npm run dev  # or your normal startup command
   ```

2. Configure backend to use `tournament-test` database:
   - Add environment variable: `DB_NAME=tournament-test`
   - Or update `.env` file to point to `tournament-test`

3. Verify clone in application:
   - Run application against `tournament-test`
   - Verify data appears correctly
   - Test core functionality

---

## Español

### Resumen
Este script clona la base de datos `tournament` a `tournament-test` de forma segura, con garantías:
- Verifica que los servicios del backend estén parados (previene corrupción)
- Crea backups automáticos antes de hacer cambios
- Valida que el clone fue exitoso
- Preserva archivos de dump para debugging

### Requisitos Previos
1. Los servicios del backend deben estar **parados** antes de ejecutar
2. MariaDB/MySQL debe estar instalado en chantal.wesnoth.org
3. El usuario debe tener privilegios de administrador de BD
4. Ambas bases de datos `tournament` y `tournament-test` deben existir

### Cómo Crear la Base de Datos tournament-test (si falta)
```bash
# SSH a chantal.wesnoth.org
ssh chantal.wesnoth.org

# Crear la base de datos
mysql -u root -p -e "CREATE DATABASE tournament-test;"
```

### Uso

#### Opción 1: Interactivo (Recomendado)
```bash
# Clonar con valores por defecto (tournament → tournament-test, usuario = root, host = localhost)
./scripts/clone_tournament_db.sh

# O especificar valores personalizados
./scripts/clone_tournament_db.sh tournament tournament-test root localhost
```

#### Opción 2: Una línea con contraseña
```bash
# Si la contraseña es 'micontraseña':
mysql -u root -pmicontraseña tournament | \
  mysql -u root -pmicontraseña tournament-test
```

#### Opción 3: SSH a chantal y ejecutar remotamente
```bash
# Desde tu máquina local:
ssh chantal.wesnoth.org "/path/to/clone_tournament_db.sh"
```

### Qué Hace el Script

1. **Verifica que el backend esté parado** - Falla si los servicios están corriendo
2. **Pide contraseña MySQL** - Lee de forma segura (no visible en pantalla)
3. **Verifica conectividad** - Prueba la conexión a MySQL
4. **Verifica base de datos origen** - Asegura que `tournament` existe
5. **Verifica base de datos destino** - Asegura que `tournament-test` existe
6. **Pide confirmación** - Previene sobrescrituras accidentales
7. **Crea backup** - Guarda el estado actual de `tournament-test` en `/tmp/`
8. **Dump de origen** - Exporta el schema y datos de `tournament`
9. **Limpia destino** - Borra y recrea `tournament-test`
10. **Restaura dump** - Importa el dump a `tournament-test`
11. **Verifica integridad** - Compara cantidad de tablas para asegurar éxito

### Backup y Recuperación

Si algo sale mal, el script guarda:
- **Archivo de dump**: `/tmp/tournament_dump_TIMESTAMP.sql` - Exportación completa del origen
- **Archivo de backup**: `/tmp/tournament-test_backup_TIMESTAMP.sql` - Estado anterior del destino

Para restaurar desde backup:
```bash
mysql -u root -p tournament-test < /tmp/tournament-test_backup_TIMESTAMP.sql
```

### Próximos Pasos Después del Clone
1. Inicia los servicios del backend de nuevo:
   ```bash
   cd /home/carlos/programacion/wesnoth_tournament_manager
   npm run dev  # o tu comando normal de inicio
   ```

2. Configura el backend para usar la base de datos `tournament-test`:
   - Añade variable de entorno: `DB_NAME=tournament-test`
   - O actualiza el archivo `.env` para apuntar a `tournament-test`

3. Verifica el clone en la aplicación:
   - Ejecuta la aplicación contra `tournament-test`
   - Verifica que los datos aparezcan correctamente
   - Prueba funcionalidades core
