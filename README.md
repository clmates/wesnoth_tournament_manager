# Wesnoth Tournament Manager

Una aplicación web completa para gestionar torneos de Wesnoth con sistema de ranking ELO, reportes de partidas, panel de administración y soporte multiidioma.

## Características

- ✅ Registro de jugadores con validación de contraseña
- ✅ Panel de administración para aprobar/rechazar solicitudes
- ✅ Sistema de ranking ELO (estilo chess.com)
- ✅ Reportes de partidas con archivo replay
- ✅ Confirmación de partidas por ambos jugadores
- ✅ Gestión de torneos (crear, unirse, participar)
- ✅ Múltiples idiomas (Inglés, Español, Chino, Alemán, Ruso)
- ✅ Niveles de jugadores automáticos

## Requisitos previos

- Node.js (v18+)
- Docker y Docker Compose
- PostgreSQL (o usar Docker)
- OpenAI API Key (para traducciones)

## Instalación

### Opción 1: Con Docker (Recomendado)

```bash
# Clonar el repositorio
git clone https://github.com/clmates/wesnoth_tournament_manager.git
cd wesnoth_tournament_manager

# Copiar archivo de configuración
cp backend/.env.example backend/.env

# Editar backend/.env con tus valores (especialmente OPENAI_API_KEY)

# Iniciar los servicios
docker-compose up
```

La aplicación estará disponible en:
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000
- Base de datos: localhost:5432

### Opción 2: Instalación Local

#### Backend

```bash
cd backend

# Instalar dependencias
npm install

# Crear archivo .env
cp .env.example .env

# Editar .env con tus valores
# En Windows con PowerShell:
notepad .env
# O con VS Code:
code .env

# Importante: Agrega tu OPENAI_API_KEY en .env

# Compilar TypeScript
npm run build

# Iniciar servidor (desarrollo)
npm run dev

# O iniciar en producción
npm run start
```

El backend estará disponible en: `http://localhost:3000`

#### Frontend (en otra terminal)

```bash
cd frontend

# Instalar dependencias
npm install

# Iniciar servidor de desarrollo
npm run dev

# O compilar para producción
npm run build
```

El frontend estará disponible en: `http://localhost:5173`

---

## 🚀 Guía de Prueba Local (Completa)

### Paso 1: Preparar el Entorno

```bash
# 1. Clonar o descargar el repositorio
git clone https://github.com/clmates/wesnoth_tournament_manager.git
cd wesnoth_tournament_manager
```

### Paso 2: Elegir entre Docker o Local

#### **Opción A: Con Docker (Más Fácil)**

⚠️ **Si tienes Windows 11 Home**, ve a **Opción B**. Consulta [DOCKER_SETUP.md](./DOCKER_SETUP.md) para alternativas con WSL 2.

```bash
# 1. Crear archivo .env
cp backend/.env.example backend/.env

# 2. Editar backend/.env y agregar tu OPENAI_API_KEY
# En Windows: notepad backend\.env

# 3. Iniciar todo con Docker
docker-compose up

# Esperar a que se inicialice la BD (verás mensajes en la consola)
# La primera ejecución puede tomar unos minutos
```

**Acceder a:**
- Frontend: http://localhost:5173
- Backend API: http://localhost:3000/health
- Base de datos: localhost:5432 (usuario: postgres, password: postgres)

#### **Opción B: Local (Sin Docker)**

**Requisitos:**
- PostgreSQL corriendo localmente (o en Docker solo)
- Node.js v18+

```bash
# Terminal 1: Iniciar Base de Datos (Opcional - si usas Docker solo para BD)
docker run -d \
  -e POSTGRES_USER=postgres \
  -e POSTGRES_PASSWORD=postgres \
  -e POSTGRES_DB=wesnoth_tournament \
  -p 5432:5432 \
  postgres:16-alpine

# Terminal 2: Backend
cd backend
npm install
cp .env.example .env
# Editar .env con OPENAI_API_KEY
npm run dev
# Esperar mensaje: "Server running on port 3000"

# Terminal 3: Frontend
cd frontend
npm install
npm run dev
# Esperar mensaje: "Local: http://localhost:5173"
```

---

## 📝 Pruebas de Funcionalidad

### 1. **Registro de Usuario**

```
URL: http://localhost:5173/register
- Nick: TestPlayer1
- Email: test1@example.com
- Contraseña: Test@12345
- Idioma: Español
- Discord ID: (opcional)
```

Esto crea una **solicitud de registro pendiente**.

### 2. **Aprobar Registro (Admin)**

Necesitas acceso admin. En la BD, ejecuta:

```sql
-- Conectar a PostgreSQL
psql -U postgres -d wesnoth_tournament

-- Hacer admin al primer usuario
UPDATE users SET is_admin = true WHERE nickname = 'TestPlayer1';
```

Luego accede a: `http://localhost:3000/api/admin/registration-requests`

### 3. **Login**

```
URL: http://localhost:5173/login
- Nick: TestPlayer1
- Contraseña: Test@12345
```

### 4. **Crear dos usuarios de prueba**

```bash
# Terminal (en backend)
cd backend
node -e "
const crypto = require('crypto');
console.log('UUID Aleatorio:', crypto.randomUUID());
"
```

Repite el proceso de registro 2 veces para tener 2 usuarios (necesitarás aprobar ambos).

### 5. **Reportar una Partida**

- Login como jugador 1
- Ir a "Reportar Partida"
- Seleccionar Jugador 2 como oponente
- Llenar datos (Mapa, Facciones, Comentarios, Rating)
- Enviar

### 6. **Confirmar Partida**

- Logout
- Login como jugador 2
- Ver partidas pendientes
- Confirmar/Disputar la partida

### 7. **Ver Ranking**

- Ambos jugadores verán su ELO actualizado
- Verificar en "Ranking Global"

---

## 🔧 Variables de Entorno

### Backend (.env)

```env
# Base de Datos
DATABASE_URL=postgresql://postgres:postgres@localhost:5432/wesnoth_tournament
DB_HOST=localhost
DB_PORT=5432
DB_NAME=wesnoth_tournament
DB_USER=postgres
DB_PASSWORD=postgres

# JWT
JWT_SECRET=tu-clave-secreta-super-segura-min-32-caracteres
JWT_EXPIRATION=7d

# Server
PORT=3000
NODE_ENV=development


# URLs
FRONTEND_URL=http://localhost:5173
```

---

## 📊 Estructura de Bases de Datos

```sql
-- Ver estructura
\dt

-- Ver usuarios
SELECT id, nickname, email, is_admin, is_active FROM users;

-- Ver partidas
SELECT * FROM matches;

-- Ver solicitudes pendientes
SELECT * FROM registration_requests WHERE status = 'pending';
```

---

## 🐛 Troubleshooting

### Puerto 3000 en uso
```bash
# Windows
netstat -ano | findstr :3000
taskkill /PID <PID> /F

# Linux/Mac
lsof -i :3000
kill -9 <PID>
```

### Puerto 5173 en uso
```bash
# Windows
netstat -ano | findstr :5173
taskkill /PID <PID> /F
```

### Error de conexión a BD
```bash
# Verificar que PostgreSQL está corriendo
# Si usas Docker:
docker ps

# Verificar credenciales en .env
# Por defecto:
# Usuario: postgres
# Contraseña: postgres
# Puerto: 5432
```

### Error de OPENAI_API_KEY
- No es necesaria para funcionalidad básica
- Sin ella, las traducciones no funcionarán automáticamente
- Obtener en: https://platform.openai.com/api-keys

---

## 📱 Usar Diferentes Idiomas

- Botones en Navbar: EN | ES | ZH | DE | RU
- Las traducciones cambiarán automáticamente
- El idioma se guardará en localStorage

---## Estructura del Proyecto

```
wesnoth_tournament_manager/
├── backend/
│   ├── src/
│   │   ├── config/          # Configuración de BD
│   │   ├── middleware/      # Middleware de autenticación
│   │   ├── routes/          # Rutas de API
│   │   ├── services/        # Servicios de negocio
│   │   ├── types/           # Tipos TypeScript
│   │   ├── utils/           # Utilidades (Auth, Traducción)
│   │   ├── app.ts           # Configuración Express
│   │   └── server.ts        # Punto de entrada
│   ├── package.json
│   └── tsconfig.json
├── frontend/
│   ├── src/
│   │   ├── components/      # Componentes React
│   │   ├── pages/           # Páginas
│   │   ├── services/        # Llamadas a API
│   │   ├── store/           # Estado global (Zustand)
│   │   ├── i18n/            # Configuración i18n
│   │   ├── styles/          # Estilos CSS
│   │   ├── types/           # Tipos TypeScript
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── package.json
│   ├── tsconfig.json
│   └── vite.config.ts
├── docker-compose.yml
├── .gitignore
└── README.md
```

## Endpoints de API

### Autenticación
- `POST /api/auth/register` - Registro de usuario
- `POST /api/auth/login` - Login
- `POST /api/auth/change-password` - Cambiar contraseña

### Usuarios
- `GET /api/users/profile` - Perfil del usuario
- `GET /api/users/:id/stats` - Estadísticas de usuario
- `GET /api/users/:id/matches` - Últimas partidas
- `GET /api/users/search/:query` - Buscar usuarios
- `GET /api/users/ranking/global` - Ranking global

### Partidas
- `POST /api/matches/report` - Reportar partida
- `POST /api/matches/:id/confirm` - Confirmar partida
- `GET /api/matches` - Obtener todas las partidas

### Torneos
- `POST /api/tournaments` - Crear torneo
- `GET /api/tournaments` - Obtener torneos
- `GET /api/tournaments/:id` - Obtener detalles del torneo
- `POST /api/tournaments/:id/join` - Unirse a torneo
- `GET /api/tournaments/:id/ranking` - Ranking del torneo

### Administración
- `GET /api/admin/registration-requests` - Solicitudes pendientes
- `POST /api/admin/registration-requests/:id/approve` - Aprobar registro
- `POST /api/admin/registration-requests/:id/reject` - Rechazar registro
- `POST /api/admin/users/:id/block` - Bloquear usuario
- `POST /api/admin/users/:id/unblock` - Desbloquear usuario
- `PUT /api/admin/password-policy` - Actualizar política de contraseñas
- `POST /api/admin/news` - Crear noticia
- `PUT /api/admin/news/:id` - Editar noticia

## Variables de Entorno

### Backend (.env)

```
DATABASE_URL=postgresql://user:password@localhost:5432/wesnoth_tournament
DB_HOST=localhost
DB_PORT=5432
DB_NAME=wesnoth_tournament
DB_USER=postgres
DB_PASSWORD=postgres

JWT_SECRET=your-super-secret-jwt-key-change-this
JWT_EXPIRATION=7d

PORT=3000
NODE_ENV=development

OPENAI_API_KEY=your-openai-api-key
FRONTEND_URL=http://localhost:5173
```

## Características Principales

### Sistema de ELO
- Basado en el sistema de ajedrez
- K-factor: 32
- Niveles automáticos: Novato, Iniciado, Veterano, Experto, Maestro

### Políticas de Contraseña
- Longitud mínima configurable (por defecto: 8)
- Requisitos: mayúsculas, minúsculas, números, símbolos
- Historial de contraseñas anteriores no permitidas (por defecto: 5)

### Sistema de Torneos
- Sistema suizo con múltiples rondas
- Cuartos de final y finales
- Ranking específico del torneo
- Reporte de partidas dentro del torneo

### Multiidioma
- Inglés, Español, Chino, Alemán, Ruso
- Selector de idioma en interfaz

## Otras Características

- 📊 Estadísticas avanzadas
- 🎮 Integración con Discord

## Contribuir

Las contribuciones son bienvenidas. Por favor:

1. Fork el proyecto
2. Crea una rama para tu feature (`git checkout -b feature/AmazingFeature`)
3. Commit tus cambios (`git commit -m 'Add some AmazingFeature'`)
4. Push a la rama (`git push origin feature/AmazingFeature`)
5. Abre un Pull Request

## Licencia

Este proyecto está bajo la licencia GPL.

## Contacto

Para preguntas o sugerencias, contacta a: support@wesnoth-tournament.com
