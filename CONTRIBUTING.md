# Contributing to Wesnoth Tournament Manager

¡Gracias por tu interés en contribuir a este proyecto! Este documento explica cómo contribuir y qué debes saber sobre nuestra licencia AGPL.

## 📋 Requisitos Legales - AGPL-3.0-or-later

Este proyecto usa **GNU Affero General Public License v3 (AGPL-3.0-or-later)**.

### Lo que esto significa para contribuidores:

1. **Tus contribuciones también serán AGPL-3.0**
   - Cualquier código que aportes se licencia automáticamente bajo AGPL
   - No necesitas hacer nada especial, sucede automáticamente

2. **Si usas nuestro código, debes compartir mejoras**
   - Si haces mejoras y las usas en un servicio, debes compartir el código con los usuarios
   - Esto es la esencia de AGPL: beneficiar a la comunidad

3. **Compatibilidad de licencias**
   - Todas nuestras dependencias (MIT, BSD, ISC, Apache-2.0 dev-only) son compatibles
   - Tu código nuevo será AGPL, lo cual es compatible con todas estas licencias

### ¿Por qué AGPL?

- ✅ **Transparencia**: El código del servicio es visible para los usuarios
- ✅ **Comunidad**: Las mejoras benefician a todos los usuarios
- ✅ **Confianza**: Los usuarios pueden auditar el código
- ✅ **Filosofía abierta**: Refleja nuestro compromiso con código abierto para torneos abiertos

## 🔧 Proceso de Contribución

### Paso 1: Fork y Clonar

```bash
git clone https://github.com/tu-usuario/wesnoth_tournament_manager.git
cd wesnoth_tournament_manager
```

### Paso 2: Crear Branch

```bash
git checkout -b feature/tu-feature-name
# o para bugfixes:
git checkout -b fix/descripcion-del-bug
```

### Paso 3: Hacer Cambios

```bash
# Editar archivos, hacer commits
git commit -m "Descripción clara de los cambios"
```

### Paso 4: Push y Pull Request

```bash
git push origin feature/tu-feature-name
```

Luego crea un Pull Request en GitHub.

## 📝 Guías de Estilo

### Commits

```
Usa mensajes claros en inglés o español:
- ✅ "Fix avatar display on user profile page"
- ✅ "Add AGPL license disclaimer to footer"
- ❌ "fix stuff"
- ❌ "asdfgh"
```

### Código

- **Backend (TypeScript/Node.js)**
  - Usa TypeScript estrictamente
  - Sigue el estilo de archivos existentes
  - Añade tipos explícitos

- **Frontend (React/TypeScript)**
  - Usa componentes funcionales
  - Usa hooks de React
  - Mantén componentes pequeños y reutilizables

- **Tests**
  - Incluye tests para nuevo código crítico
  - Asegúrate de que tests pasen localmente

### Documentación

- Actualiza README.md si cambias configuración
- Documenta nuevas APIs
- Añade comentarios en código complejo

## 🐛 Reportar Bugs

Por favor usa GitHub Issues con:

```markdown
**Descripción:**
[Descripción clara del bug]

**Pasos para reproducir:**
1. 
2.
3.

**Resultado esperado:**
[Qué debería pasar]

**Resultado actual:**
[Qué está pasando]

**Entorno:**
- OS: 
- Node.js version:
- Browser:
```

## 💡 Sugerir Mejoras

Crea un Issue con:

```markdown
**Descripción de la mejora:**
[Qué quieres añadir o cambiar]

**¿Por qué es útil?**
[Por qué beneficia al proyecto]

**Posible implementación:**
[Ideas sobre cómo implementarlo]
```

## 🏗️ Arquitectura General

### Backend

```
backend/
├── src/
│   ├── server.ts          # Punto de entrada
│   ├── app.ts             # Configuración de Express
│   ├── routes/            # Rutas de API
│   ├── middleware/         # Middleware (auth, CORS, etc)
│   ├── services/          # Lógica de negocio
│   ├── utils/             # Funciones auxiliares
│   ├── types/             # TypeScript interfaces
│   └── config/            # Configuración
├── migrations/            # Migraciones de BD
└── package.json

Key: Database (PostgreSQL) via Supabase
```

### Frontend

```
frontend/
├── src/
│   ├── main.tsx           # Punto de entrada
│   ├── App.tsx            # Componente raíz
│   ├── pages/             # Páginas (routas)
│   ├── components/        # Componentes reutilizables
│   ├── services/          # API calls (axios)
│   ├── store/             # Zustand stores
│   ├── utils/             # Funciones auxiliares
│   ├── styles/            # CSS modules
│   ├── locales/           # Traducciones i18next
│   └── types/             # TypeScript interfaces
├── public/
│   └── wesnoth-avatars/   # Avatar images + manifest
└── package.json

Key: React 18 + Vite + React Router + i18next
```

## 🚀 Instalación para Desarrollo

```bash
# Clonar
git clone https://github.com/tu-usuario/wesnoth_tournament_manager.git

# Backend
cd backend
npm install
cp .env.example .env
# Editar .env con tus valores
npm run dev

# Frontend (en otra terminal)
cd frontend
npm install
npm run dev
```

Frontend: http://localhost:5173
Backend: http://localhost:3000

## ✅ Checklist Antes de Hacer Push

- [ ] Código sigue el estilo del proyecto
- [ ] Commit messages son claros
- [ ] Tests pasan (si aplica)
- [ ] Sin console.log() innecesarios
- [ ] Sin dependencias no usadas
- [ ] Documentación actualizada
- [ ] Entiendés que tu código será AGPL-3.0

## 📚 Documentación Importante

- [DEPENDENCIES_AND_LICENSES.md](DEPENDENCIES_AND_LICENSES.md) - Análisis de dependencias y licencias
- [DEPENDENCY_USAGE_ANALYSIS.md](DEPENDENCY_USAGE_ANALYSIS.md) - Qué dependencias se usan realmente
- [LICENSE](LICENSE) - Texto completo de AGPL-3.0
- [README.md](README.md) - Información general del proyecto

## ❓ Preguntas?

- Abre un Issue para preguntas sobre el código
- Revisa issues existentes antes de crear uno nuevo
- Sé respetuoso y constructivo en las discusiones

## 🙏 Gracias

¡Gracias por considerar contribuir a este proyecto! Cada contribución, sin importar su tamaño, ayuda a mejorar el software para toda la comunidad de Wesnoth.

---

**Nota Legal**: Al contribuir, aceptas que tu código será licenciado bajo AGPL-3.0-or-later, igual que el resto del proyecto.
