# Migración a Supabase Storage

## Cambios Realizados

✅ **Backend adaptado para usar Supabase Storage**
- Nuevo archivo: `backend/src/config/supabase.ts` con funciones de upload/download
- `POST /api/matches/report` sube replays a Supabase Storage
- `GET /api/matches/:matchId/replay/download` descarga desde Supabase Storage
- Eliminados archivos locales temporales después de subir
- Mantenido sistema de logs detallado (`[UPLOAD]`, `[DOWNLOAD]`, `[SUPABASE]`)

## Configuración en Railway

### 1. Variables de Entorno Necesarias

Agregar a Railway → Backend service → Variables:

```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...
```

⚠️ **IMPORTANTE**: Usar `SUPABASE_SERVICE_ROLE_KEY` (Secret Key), NO `SUPABASE_ANON_KEY`
- **Service Role Key**: Para backend (acceso completo)
- **Anon Key**: Legacy, solo para cliente (limitado)

### 2. Dónde Obtener las Credenciales

1. Ve a: https://supabase.com/dashboard
2. Selecciona tu proyecto
3. **Settings → API**
4. Copia:
   - `Project URL` → `SUPABASE_URL`
   - `Service Role Secret` (al fondo) → `SUPABASE_SERVICE_ROLE_KEY`
   
⚠️ **Seguridad**: Service Role Key es secreto - **NUNCA** lo expongas al cliente

### 3. Crear Bucket en Supabase

En Supabase Dashboard:
1. **Storage → Create new bucket**
2. **Nombre**: `replays`
3. **Privacy**: `Private` (más seguro)
4. Guardar

## Ventajas vs Almacenamiento Local

| Aspecto | Local | Supabase |
|--------|-------|----------|
| Costo | Variable (volumen Railway) | $0 (1GB gratis/mes) |
| Persistencia | Solo si configuras volumen | Automática |
| Disponibilidad | Depende de Railway | Redundancia global |
| Escalabilidad | Limitada | Ilimitada |
| CDN | No | Sí |

## Flujo de Subida/Descarga

### Upload (POST /matches/report)
```
1. Usuario sube archivo (multer)
2. Archivo se carga en memoria
3. Se sube a Supabase Storage
4. Se guarda ruta en DB
5. Archivo temporal se elimina
```

Logs esperados:
```
📤 [UPLOAD] Starting Supabase upload...
📤 [UPLOAD] File buffer size: 23839 bytes
✅ [UPLOAD] Replay uploaded to Supabase: replays/replay_1234567890.gz
✅ [UPLOAD] Replay stored in Supabase at: replays/replay_1234567890.gz
```

### Download (GET /matches/:matchId/replay/download)
```
1. Backend obtiene path de DB
2. Descarga desde Supabase Storage
3. Envía archivo al cliente
```

Logs esperados:
```
📥 [DOWNLOAD] Starting download for match: c3a06811-...
📥 [DOWNLOAD] Retrieved replay path from DB: replays/replay_1234567890.gz
📥 [DOWNLOAD] Downloading from Supabase...
✅ [SUPABASE] Download successful, size: 23839 bytes
📥 [DOWNLOAD] Sending file to client...
✅ [DOWNLOAD] Successfully sent replay file
```

## Variables de Entorno Completas

```
# Database
DATABASE_URL=postgresql://...

# JWT
JWT_SECRET=your-jwt-secret

# Supabase Storage (Backend - Secret Key)
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_SERVICE_ROLE_KEY=eyJhbGc...  (SECRET - Backend only)

# Frontend (No necesita Supabase en cliente)
FRONTEND_URL=https://your-frontend-url.com
PORT=3000
NODE_ENV=production
```

## Testing Local (Desarrollo)

Si quieres probar en desarrollo antes de pushear:

1. Obtén las credenciales de Supabase
2. Crea un `.env.local`:
```
SUPABASE_URL=https://xxxxx.supabase.co
SUPABASE_ANON_KEY=eyJhbGc...
```
3. `npm run dev`
4. Intenta subir un replay

## Monitoreo

Revisa los logs en Railway con filtros:
- `[UPLOAD]` - Información de carga
- `[DOWNLOAD]` - Información de descarga
- `[SUPABASE]` - Operaciones Supabase
- `❌` - Errores

## Rollback (Si algo falla)

Si necesitas volver a almacenamiento local:
1. Revert el commit
2. Los replays antiguos en Supabase permanecerán
3. Los nuevos irán a almacenamiento local

## Próximos Pasos

1. ✅ Instalar dependencias: `npm install`
2. ✅ Agregar credenciales a Railway
3. ✅ Crear bucket `replays` en Supabase
4. ✅ Push a main
5. ✅ Railway redeploy automático
6. ✅ Probar subida y descarga de replays

## Preguntas Frecuentes

**¿Qué pasa con los replays viejos?**
- Permanecen en el almacenamiento anterior
- Puedes migrarlos manualmente si necesitas

**¿Se pueden eliminar replays?**
- Sí, hay función `deleteReplayFromSupabase` en supabase.ts
- Se puede usar si implementas feature de eliminación

**¿El bucket debe ser público?**
- No, es mejor privado. Las descargas usan la API
- Las URLs en Supabase son seguras

**¿Hay límite de tamaño?**
- Supabase tiene límites según plan
- Plan gratuito: 1GB total
- Puedes aumentar si necesario
