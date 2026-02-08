# Funcionalidad de Modo Mantenimiento - Guía de Implementación

## Descripción General
Se ha implementado un sistema completo de modo mantenimiento que permite a los administradores poner el sitio en mantenimiento de forma segura. Cuando está activado, solo los administradores pueden iniciar sesión, mientras que todos los demás usuarios ven un banner prominente.

## Cambios Realizados

### 1. Base de Datos
**Archivo**: `backend/migrations/20260207_add_maintenance_mode.sql`

- **Tabla `system_settings`**: Nueva tabla para almacenar configuraciones globales del sistema
  - `id` (SERIAL PRIMARY KEY)
  - `setting_key` (VARCHAR 100, UNIQUE) - Identificador único de la configuración
  - `setting_value` (TEXT) - Valor de la configuración
  - `description` (TEXT) - Descripción de la configuración
  - `created_at`, `updated_at` (TIMESTAMP) - Fechas de creación y actualización
  - `updated_by` (UUID) - Admin que realizó el cambio
  
- Se inicializa con `maintenance_mode = false`
- Índice rápido en `setting_key` para búsquedas eficientes

### 2. Backend - Rutas de Admin
**Archivo**: `backend/src/routes/admin.ts`

#### Endpoints nuevos:

**GET `/admin/maintenance-status`**
- Público (sin autenticación)
- Devuelve: `{ maintenance_mode: boolean }`
- Caso de uso: Verificar si el sitio está en mantenimiento

**POST `/admin/toggle-maintenance`**
- Solo administradores
- Body: `{ enable: boolean, reason?: string }`
- Devuelve: `{ success: true, maintenance_mode: boolean, message: string, timestamp: string }`
- Registra en `audit_logs` con `event_type: 'MAINTENANCE_MODE_TOGGLE'`
- Incluye razón del mantenimiento (opcional)

**GET `/admin/maintenance-logs`**
- Solo administradores
- Query params: `limit` (máximo 100, default 50)
- Devuelve: Historial de cambios de modo mantenimiento desde `audit_logs`

### 3. Backend - Autenticación
**Archivo**: `backend/src/routes/auth.ts`

**Modificación en POST `/auth/login`**:
- Se agregó verificación de modo mantenimiento
- Si `maintenance_mode = true` y el usuario NO es admin:
  - Devuelve error 503 (Service Unavailable)
  - Mensaje: "Site under maintenance. Please try again later."
  - Se registra en `audit_logs` con razón: 'maintenance_mode_active'
- Los administradores pueden iniciar sesión normalmente

### 4. Frontend - Servicios API
**Archivo**: `frontend/src/services/api.ts`

Nuevos métodos en `adminService`:
```typescript
getMaintenanceStatus: () => api.get('/admin/maintenance-status')
toggleMaintenance: (enable: boolean, reason?: string) => api.post('/admin/toggle-maintenance', { enable, reason })
getMaintenanceLogs: (limit?: number) => api.get('/admin/maintenance-logs', { params: limit ? { limit } : {} })
```

### 5. Frontend - Panel de Admin
**Archivo**: `frontend/src/pages/Admin.tsx`

**Nuevos estados**:
- `maintenanceMode`: Almacena el estado actual
- `maintenanceReason`: Campo para la razón del mantenimiento
- `showMaintenanceModal`: Control del modal
- `togglingMaintenance`: Estado durante la transición

**Funciones nuevas**:
- `fetchMaintenanceStatus()`: Obtiene el estado actual del servidor
- `handleToggleMaintenance()`: Alterna el modo mantenimiento

**Interfaz de usuario**:
- Botón con color dinámico:
  - 🟡 Amarillo cuando está desactivado (⚠️ Maintenance OFF)
  - 🔴 Rojo cuando está activado (✓ Maintenance ON)
- Modal de confirmación con:
  - Campo de texto para la razón (solo cuando se activa)
  - Advertencia informativa
  - Botones de cancelar/confirmar

### 6. Frontend - Componente Banner
**Archivo**: `frontend/src/components/MaintenanceBanner.tsx`

Nuevo componente que muestra:
- Banner rojo fijo en la parte superior
- Ícono animado (🔧)
- Títulos y mensajes multiidioma:
  - **English**: "Site Under Maintenance" / "We are performing scheduled maintenance. Please try again later."
  - **Español**: "Sitio en Mantenimiento" / "Estamos realizando mantenimiento programado. Por favor, intenta más tarde."
  - **Deutsch**: "Website wird gewartet" / "Wir führen geplante Wartungsarbeiten durch. Bitte versuchen Sie es später erneut."
  - **Русский**: "Сайт на техническом обслуживании" / "Мы проводим плановое обслуживание. Пожалуйста, попробуйте позже."
  - **中文**: "网站维护中" / "我们正在进行计划的维护。请稍后再试。"
- Solo visible cuando `maintenanceMode = true`
- Usa `useTranslation()` para obtener las claves multiidioma

### 7. Frontend - App Principal
**Archivo**: `frontend/src/App.tsx`

Cambios:
- Importación del `MaintenanceBanner`
- Nuevo estado: `maintenanceMode`
- Hook `useEffect` que:
  - Obtiene el estado de mantenimiento al cargar
  - Verifica cada 30 segundos si hay cambios
  - Actualiza el estado en tiempo real
- Renderiza el banner antes del Navbar
- Clase dinámica en `main-content`: `pt-24` cuando hay mantenimiento (para dejar espacio al banner)

## Flujo de Funcionamiento

### Para activar mantenimiento (Admin):
1. Admin va a la página de Admin Users (`/admin`)
2. Hace clic en el botón "⚠️ Maintenance OFF"
3. Se abre modal de confirmación
4. Admin puede agregar una razón (opcional)
5. Al confirmar:
   - Backend actualiza `system_settings.maintenance_mode = 'true'`
   - Se registra en `audit_logs`
   - Frontend recibe confirmación y actualiza estado
   - Banner rojo aparece en toda la aplicación

### Para usuarios regulares durante mantenimiento:
1. Ven el banner rojo: "Site Under Maintenance"
2. Intenta hacer login → recibe error 503 con mensaje
3. No pueden acceder a la plataforma
4. Deben esperar a que se desactive el mantenimiento

### Para administradores durante mantenimiento:
1. Ven el banner rojo igual que otros usuarios
2. Pueden iniciar sesión normalmente
3. Pueden desactivar el mantenimiento desde el panel de admin
4. El banner desaparece en 30 segundos o menos

## Auditoría

Todos los cambios de modo mantenimiento se registran en la tabla `audit_logs`:

```
event_type: 'MAINTENANCE_MODE_TOGGLE'
user_id: <id del admin>
username: <nickname del admin>
details: {
  action: 'ENABLED' | 'DISABLED',
  reason: <reason provided by admin or null>,
  enabled: <boolean>
}
```

## Consideraciones de Seguridad

✅ **Solo admins pueden cambiar el estado**: Verificación en middleware `authMiddleware` + comprobación adicional de `is_admin`

✅ **Bloqueo de login seguro**: Los usuarios no-admin reciben error 503 y el intento se registra en audit logs

✅ **Endpoint público para status**: Permite que el frontend verifique sin autenticación (no expone información sensible)

✅ **Razón de mantenimiento**: Se registra para auditoría

✅ **Auditoría completa**: Cada cambio deja rastro en `audit_logs`

## Testing

### Pruebas manuales recomendadas:

1. **Activar mantenimiento**:
   - Como admin, click en botón de mantenimiento
   - Confirmar en modal
   - Ver que el botón cambia de color a rojo

2. **Banner visible en todos los idiomas**:
   - Refrescar la página
   - Debería ver el banner rojo arriba
   - Cambiar idioma (EN, ES, DE, RU, ZH) y verificar que se traduce:
     - **EN**: "Site Under Maintenance" / "We are performing scheduled maintenance..."
     - **ES**: "Sitio en Mantenimiento" / "Estamos realizando mantenimiento..."
     - **DE**: "Website wird gewartet" / "Wir führen geplante Wartungsarbeiten..."
     - **RU**: "Сайт на техническом обслуживании" / "Мы проводим плановое обслуживание..."
     - **ZH**: "网站维护中" / "我们正在进行计划的维护..."

3. **Bloqueo de login**:
   - Cerrar sesión
   - Intentar login como usuario regular → Falla con "Site under maintenance"
   - Intentar login como admin → Exitoso

4. **Desactivar mantenimiento**:
   - Como admin, click en botón (ahora rojo)
   - Confirmar desactivación
   - Ver que el botón vuelve a amarillo
   - El banner desaparece

5. **Auditoría**:
   - Verificar en `/admin/audit` que se registren los eventos
   - Debería haber eventos de tipo `MAINTENANCE_MODE_TOGGLE`

## Endpoints de la API

| Método | Endpoint | Auth | Descripción |
|--------|----------|------|-------------|
| GET | `/admin/maintenance-status` | No | Obtener estado de mantenimiento |
| POST | `/admin/toggle-maintenance` | Sí (Admin) | Activar/desactivar mantenimiento |
| GET | `/admin/maintenance-logs` | Sí (Admin) | Obtener historial de cambios |

## Variables de Entorno

No se requieren nuevas variables de entorno. El estado se almacena en la base de datos.

## Internacionalización (i18n)

Las traducciones del banner de mantenimiento están disponibles en 5 idiomas:

**Archivos de traducciones actualizados:**
- `frontend/src/i18n/locales/en.json` - English
- `frontend/src/i18n/locales/es.json` - Español
- `frontend/src/i18n/locales/de.json` - Deutsch
- `frontend/src/i18n/locales/ru.json` - Русский
- `frontend/src/i18n/locales/zh.json` - 中文

Cada archivo contiene las claves:
```json
"maintenance": {
  "title": "[Título en el idioma correspondiente]",
  "message": "[Mensaje en el idioma correspondiente]"
}
```

El componente MaintenanceBanner usa `useTranslation()` para acceder a estas claves automáticamente.

## Migración

Para aplicar los cambios:

```bash
# En la carpeta del backend
npm run migrate
# o según tu sistema de migraciones
```

Esto creará la tabla `system_settings` e insertará el registro inicial de `maintenance_mode`.
