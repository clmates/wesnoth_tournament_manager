## Plan consolidado: Password reset y verificación de email vía MailerSend

Se migrará el flujo de reseteo de contraseña y se implementará la verificación de email usando MailerSend vía API REST, eliminando la dependencia de Discord para este propósito. El usuario podrá identificarse por nickname o email, pero siempre se mostrará el email enmascarado y se pedirá confirmación antes de enviar el reseteo. Los tokens de la API REST de MailerSend se almacenarán en variables de entorno de Railway.

### Cambios y pasos a seguir

1. **Backend**
   - Modificar el endpoint de reseteo para aceptar nickname o email, mostrar el email enmascarado y requerir confirmación antes de enviar el reseteo.
   - Generar tokens seguros para reseteo y verificación, con expiración, y almacenarlos en los nuevos campos de la tabla `users`.
   - Implementar integración con MailerSend vía API REST para el envío de emails de reseteo y verificación, usando los tokens almacenados en variables de entorno Railway.
   - Crear endpoints para:
     - Solicitud de reseteo (requiere confirmación de email)
     - Aplicar nuevo password (vía token)
     - Solicitud de verificación de email
     - Confirmación de verificación (vía token)
   - Eliminar toda lógica de Discord relacionada con reseteo de contraseña.
   - Registrar todos los intentos y acciones de reseteo/verificación en la tabla `audit_log`.

2. **Base de datos**
   - Añadir/ajustar en la tabla `users`:
     - `email_verified` (boolean, default: false)
     - `password_reset_token` (string, nullable)
     - `password_reset_expires` (datetime, nullable)
     - `email_verification_token` (string, nullable)
     - `email_verification_expires` (datetime, nullable)
   - Implementar una tarea automática (cron/job) para limpiar tokens expirados de reseteo y verificación.
   - Mantener email y nickname como campos no editables.

3. **Frontend**
   - Actualizar el formulario de solicitud de reseteo para aceptar nickname o email, mostrar el email enmascarado y pedir confirmación.
   - Crear página para ingresar la nueva contraseña desde el enlace recibido por email.
   - Añadir formularios y páginas para la verificación de email durante el registro y para confirmar la verificación desde el enlace.
   - Adaptar mensajes y flujos para reflejar el nuevo sistema basado en email.

4. **Documentación**
   - Actualizar guías de usuario y administrador para reflejar el nuevo flujo de reseteo y verificación.
   - Eliminar referencias a Discord en el contexto de reseteo de contraseña.

5. **Seguridad y auditoría**
   - Registrar todos los eventos relevantes en la tabla `audit_log`.
   - Asegurar que los tokens tengan expiración y se limpien automáticamente.
   - Revisar la periodicidad y condiciones de la limpieza automática para optimizar recursos.
   - El acceso a los logs seguirá restringido a administradores.

Este plan cubre la migración completa del reseteo de contraseña y la implementación de la verificación de email, asegurando seguridad, trazabilidad y una experiencia de usuario clara y moderna.
