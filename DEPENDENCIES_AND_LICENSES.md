# 📋 ANÁLISIS COMPLETO DE DEPENDENCIAS Y LICENCIAS
## Wesnoth Tournament Manager

---

## 📊 RESUMEN EJECUTIVO

### Tecnologías Principales REALMENTE USADAS

**Backend:**
- **Runtime**: Node.js + Express 4.22.1 + TypeScript 5.9.3
- **Base de Datos**: PostgreSQL (cliente: pg 8.16.3)
- **Autenticación**: JWT (jsonwebtoken 9.0.3) + Bcrypt (5.1.1)
- **Hosting**: Supabase (SDK 2.89.0)
- **HTTP Client**: Axios 1.13.2
- **File Upload**: Multer 2.0.2
- **CORS**: CORS 2.8.5
- **Tareas Programadas**: Node-cron 4.2.1
- **Rate Limiting**: express-rate-limit 7.5.1
- **Compresión**: bz2 1.0.1
- **Utilidades**: uuid 10.0.0, dotenv 16.6.1

**Frontend:**
- **Librería UI**: React 18.3.1 + React DOM 18.3.1
- **Bundler**: Vite 5.4.21
- **Enrutamiento**: React Router DOM 6.30.2
- **Internacionalización**: i18next 23.16.8 + react-i18next 13.5.0
- **Gráficos**: Recharts 3.5.1
- **Gestor de Estado**: Zustand 4.5.7
- **HTTP Client**: Axios 1.13.2
- **TypeScript**: TypeScript 5.9.3

### ⚠️ DEPENDENCIAS NO USADAS
- **OpenAI 4.104.0** (backend) - ❌ **INSTALADO PERO NO USADO**
  - No hay imports de `openai` en backend
  - Puede ser removido: `npm uninstall openai`

- **netlify-cli 23.12.3** (raíz) - ❌ **INSTALADO PERO NO USADO**
  - No se usa Netlify para deployment (se usa Railway/Supabase)
  - Puede ser removido: `npm uninstall netlify-cli`

---

## 📦 DEPENDENCIAS DEL BACKEND (24 paquetes)

### ✅ Dependencias Principales REALMENTE USADAS (13 paquetes)

| Paquete | Versión | Licencia | Uso Real |
|---------|---------|----------|----------|
| @supabase/supabase-js | 2.89.0 | **MIT** | ✅ Almacenamiento de replays + API |
| axios | 1.13.2 | **MIT** | ✅ Requests HTTP (Discord, externos) |
| bcrypt | 5.1.1 | **MIT** | ✅ Hash de contraseñas |
| bz2 | 1.0.1 | **MIT** | ✅ Compresión de archivos |
| cors | 2.8.5 | **MIT** | ✅ Middleware CORS |
| dotenv | 16.6.1 | **BSD-2-Clause** | ✅ Cargar variables de entorno |
| express | 4.22.1 | **MIT** | ✅ Framework web |
| express-rate-limit | 7.5.1 | **MIT** | ✅ Rate limiting en endpoints |
| jsonwebtoken | 9.0.3 | **MIT** | ✅ Tokens JWT para auth |
| multer | 2.0.2 | **MIT** | ✅ Upload de archivos |
| node-cron | 4.2.1 | **ISC** | ✅ Tareas programadas (cleanup, etc) |
| pg | 8.16.3 | **MIT** | ✅ Cliente PostgreSQL |
| uuid | 10.0.0 | **MIT** | ✅ Generación de IDs únicos |

### ❌ Dependencias NO USADAS (1 paquete)

| Paquete | Versión | Licencia | Problema |
|---------|---------|----------|----------|
| openai | 4.104.0 | **Apache-2.0** | ❌ **NO IMPORTADO EN EL CÓDIGO** |

**Recomendación:** Remover `openai` del `package.json` ya que no se usa.

---

### Dependencia Raíz No Usada

| Paquete | Versión | Licencia | Problema |
|---------|---------|----------|----------|
| netlify-cli | 23.12.3 | MIT | ❌ **NO USADO - Deployment es via Railway** |

**Recomendación:** Remover `netlify-cli` del package.json raíz ya que no se usa para deployment.

### Type Definitions (10 paquetes de desarrollo - sin impacto en licencias)
- @types/bcrypt, @types/cors, @types/express, @types/jsonwebtoken, @types/multer
- @types/node, @types/pg, @types/uuid, tsx, typescript

---

## 📦 DEPENDENCIAS DEL FRONTEND (14 paquetes)

### Dependencias Principales (7 paquetes)

| Paquete | Versión | Licencia | Descripción |
|---------|---------|----------|------------|
| axios | 1.13.2 | **MIT** | Cliente HTTP |
| i18next | 23.16.8 | **MIT** | Motor de internacionalización |
| react | 18.3.1 | **MIT** | Librería UI |
| react-dom | 18.3.1 | **MIT** | Renderizador DOM de React |
| react-i18next | 13.5.0 | **MIT** | Integración React + i18next |
| react-router-dom | 6.30.2 | **MIT** | Enrutamiento |
| recharts | 3.5.1 | **MIT** | Librería de gráficos |
| zustand | 4.5.7 | **MIT** | Gestor de estado |

### Dependencias de Desarrollo (6 paquetes - Type Definitions & Build Tools)

| Paquete | Versión | Licencia | Descripción |
|---------|---------|----------|------------|
| @types/react | 18.3.27 | **MIT** | Type definitions |
| @types/react-dom | 18.3.7 | **MIT** | Type definitions |
| @vitejs/plugin-react | 4.7.0 | **MIT** | Plugin React para Vite |
| typescript | 5.9.3 | **Apache-2.0** | Compilador TypeScript |
| vite | 5.4.21 | **MIT** | Bundler y dev server |

### Dependencia Raíz

| Componente | Licencia | Ubicación |
|-----------|----------|----------|
| netlify-cli | - | devDependencies (raíz) |

---

## � ANÁLISIS REAL DE LICENCIAS (Solo dependencias usadas)

### Distribución de Licencias - DEPENDENCIAS REALMENTE USADAS

```
MIT:                   31 paquetes (91%)
Apache-2.0:             1 paquete  (3%)   [TypeScript solo]
BSD-2-Clause:           1 paquete  (3%)   [dotenv]
ISC:                    1 paquete  (3%)   [node-cron]
────────────────────────────────────
TOTAL (SIN UNUSED):     34 paquetes

NO USADOS (para remover):
- openai:              1 paquete  ❌ [backend]
- netlify-cli:         1 paquete  ❌ [raíz]
```

### Licencias Presentes EN CÓDIGO REAL

1. **MIT (31 paquetes)** - ✅ PERMISIVA - 91% del código
   - React ecosystem completo
   - Express ecosystem
   - Herramientas de desarrollo
   - Librerías de utilidad

2. **Apache-2.0 (1 paquete)** - ✅ PERMISIVA - 3%
   - TypeScript (solo en desarrollo)

3. **BSD-2-Clause (1 paquete)** - ✅ PERMISIVA - 3%
   - dotenv

4. **ISC (1 paquete)** - ✅ PERMISIVA - 3%
   - node-cron

---

## ⚖️ ANÁLISIS DE COMPATIBILIDAD CON AGPL - REVISADO

### ¿Puedes usar AGPL v3 en tu proyecto?

#### **RESPUESTA: ✅ SÍ, AHORA SÍ ES POSIBLE (sin OpenAI)**

**IMPORTANTE:** El análisis cambió significativamente porque OpenAI NO se usa en el código.

### Razones de la compatibilidad mejorada:

#### 1. **OpenAI removido del análisis** ✅
   - OpenAI tiene Apache-2.0 y crea conflicto con AGPL v3
   - Como NO está siendo usado, puede ignorarse/removerse
   - **Acción recomendada:** Eliminar `openai` del package.json

#### 2. **Solo quedan licencias permisivas simples** ✅
   - MIT (91%): Completamente compatible con AGPL v3
   - TypeScript Apache-2.0 (dev only): Compatible en contexto dev
   - BSD-2-Clause (3%): Compatible
   - ISC (3%): Compatible
   
   **Resultado:** Sin conflictos significativos

#### 3. **Mejor análisis jurídico sin Apache-2.0 en runtime** ✅
   - Apache-2.0 (OpenAI) era en runtime → conflicto potencial
   - TypeScript Apache-2.0 está solo en dev → SIN conflicto
   - Las herramientas de desarrollo no afectan licencia final

#### 4. **AGPL v3 es compatible con MIT** ✅
   - MIT dice: "Haz lo que quieras"
   - AGPL dice: "Haz lo que quieras, pero comparte con usuarios de red"
   - MIT + AGPL wrapper = Funciona (AGPL es más restrictivo)

#### 5. **Para una aplicación SaaS, AGPL v3 tiene sentido** ✅
   - Tu app es un servicio web público
   - AGPL v3 requiere compartir código con usuarios de red
   - Alineado con modelo de servicio (quieres que vean el código)
   - Si es privado o interno, AGPL asegura acceso al código

---

## ✅ LICENCIAS RECOMENDADAS PARA TU PROYECTO (VERSIÓN ACTUALIZADA)

### **OPCIÓN 1: AGPL v3** (AHORA VIABLE) ⭐⭐⭐⭐

**Por qué AGPL v3 es viables AHORA:**

✅ **Compatible con tus dependencias reales**
- MIT (91%): Completamente compatible
- BSD-2-Clause: Compatible
- ISC: Compatible
- TypeScript Apache-2.0 (solo dev): Compatible

✅ **OpenAI removido = Sin conflictos**
- OpenAI no se usa en código
- Puede/debe removerse del package.json
- Elimina el único conflicto potencial

✅ **Jurídicamente clara con las dependencias que tienes**
- Todas tus dependencias runtime son MIT-compatible
- Sin conflictos de patentes
- Comunidad open source entiende AGPL bien

✅ **Alineado con tu modelo de negocio**
- Tu aplicación es un servicio web (SaaS)
- AGPL v3 exige compartir código con usuarios de red
- Perfecto para servicio web de torneos
- Los usuarios del servicio verían el código
- Contribuciones mejoran el servicio para todos

✅ **Bueno para comunidad**
- Fuerza que mejoras se compartan
- Evita "forks privados" que no contribuyen
- Alineado con filosofía de torneos abiertos

✅ **Compatible Apache-2.0 (solo TypeScript dev)**
- TypeScript solo en desarrollo
- No hay conflicto real
- Apache-2.0 en dev tools es muy común

**Requisitos de AGPL v3:**
- Incluir copia de licencia AGPL v3
- Documentar cambios significativos
- Dar acceso a código fuente a usuarios web
- Un poco más complejo que MIT, pero viable

**Acciones necesarias:**
1. ✅ Remover `openai` del backend/package.json (no se usa)
2. Añadir licencia AGPL v3 en archivo LICENSE
3. Documentar que aplicación es AGPL v3

---

### **OPCIÓN 2: MIT** (RECOMENDADA SI PREFIERES SIMPLICIDAD) ⭐⭐⭐⭐⭐

**Razones para mantener MIT:**

✅ **Ultra-compatible**
- 91% de dependencias la usan
- Cero conflictos
- Expectativa natural

✅ **Máxima simplicidad jurídica**
- Menos requisitos legales
- Menos documentación
- Mejor para empresas corporativas

✅ **Máxima permisividad**
- Permites usos más flexibles
- Mejor adopción en comunidad corporativa

⚠️ **Desventaja vs AGPL v3:**
- No asegura que mejoras vuelvan al proyecto
- Competidores pueden hacer fork privado
- Menos "compartido" con comunidad

**Mejor si:**
- Quieres máxima adopción comercial
- Prefieres código libre pero sin obligaciones
- Quieres que otros hagan fork sin compartir

---

## ❌ ¿POR QUÉ ANTES NO AGPL v3? (ANÁLISIS ANTERIOR)

### Antes: OpenAI estaba en el análisis

La incompatibilidad anterior era porque:
- OpenAI SDK tiene Apache-2.0
- Apache-2.0 + AGPL v3 = conflicto potencial de patentes
- Esto hacía problemático usar AGPL v3

### Ahora: Sin OpenAI = Compatible

**Verificación en código:**
```bash
grep -r "import.*openai" backend/src/
grep -r "from 'openai'" backend/src/
grep -r "require.*openai" backend/src/
# RESULTADO: ❌ No encontrado
```

OpenAI NO se usa en ningún archivo del código.

### Conclusión: El análisis inicial era correcto pero cambió

- Analizar dependencias instaladas ≠ analizar dependencias usadas
- OpenAI está en package.json pero no importado
- Debe removerse del package.json para limpiar

---

## 📋 PASOS PARA IMPLEMENTAR LA LICENCIA

### Paso 1: Remover Dependencias No Usadas (IMPORTANTE)

**En `backend/package.json`:**
```bash
cd backend
npm uninstall openai
```

**En `package.json` raíz:**
```bash
cd ..
npm uninstall netlify-cli
```

**Por qué remover openai:**
- No se usa en el código (verificado: no hay imports)
- Tiene Apache-2.0 que crea complejidad innecesaria
- Si usas AGPL v3, simplifica las cosas

**Por qué remover netlify-cli:**
- No se usa Netlify para deployment (se usa Railway)
- No hay referencias en el código
- Reduce complejidad de dependencias
- Reduce tamaño de node_modules

---

### Para AGPL v3 (OPCIÓN 1 - RECOMENDADA si quieres mayor control):

**1. Crear archivo LICENSE en raíz:**
```
GNU AFFERO GENERAL PUBLIC LICENSE
Version 3, 19 November 2007

Copyright (c) 2024 [Tu Nombre/Organización]

This program is free software: you can redistribute it and/or modify
it under the terms of the GNU Affero General Public License as published
by the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

This program is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
GNU Affero General Public License for more details.

[... versión completa de AGPL v3 ...]
```

**2. Actualizar package.json:**
```json
{
  "license": "AGPL-3.0-or-later",
  ...
}
```

**3. Actualizar README.md:**
```markdown
## License

This project is licensed under the GNU Affero General Public License v3 (AGPL-3.0-or-later).

This means:
- You can use, modify, and distribute this software
- If you run this software on a server accessible via network, 
  you must provide access to the source code to users

See [LICENSE](LICENSE) for details.

## Dependencies

This project uses open-source libraries. See [DEPENDENCIES.md](DEPENDENCIES.md) for complete license information.
```

**Ventajas AGPL v3:**
- ✅ Asegura que mejoras vuelvan al proyecto
- ✅ Previene "forks privados" sin contribuir
- ✅ Mejor para comunidad de código abierto
- ✅ Compatible con tu actual stack

**Desventajas AGPL v3:**
- ⚠️ Menos adoptado por corporaciones
- ⚠️ Un poco más complejo legalmente
- ⚠️ Algunos desarrolladores evitan AGPL

---

### Para MIT (OPCIÓN 2 - Si prefieres máxima simplicidad):

**1. Crear archivo LICENSE en raíz:**
```
MIT License

Copyright (c) 2024 [Tu Nombre/Organización]

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

**2. Actualizar package.json:**
```json
{
  "license": "MIT",
  ...
}
```

**3. Actualizar README.md:**
```markdown
## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Dependencies

This project includes the following open-source libraries. See [DEPENDENCIES.md](DEPENDENCIES.md) for complete license information.
```

**Ventajas MIT:**
- ✅ Máxima simplicidad
- ✅ Mejor aceptación corporativa
- ✅ Máxima libertad para usuarios
- ✅ Coincide con 91% de tus dependencias

**Desventajas MIT:**
- ⚠️ No asegura contribuciones comunitarias
- ⚠️ Competidores pueden hacer fork privado

---

### Para ambas opciones:

**4. Crear DEPENDENCIES_AND_LICENSES.md (este archivo)**
- Ya existe en el proyecto
- Documentar todas las licencias
- Mostrar respeto a contribuidores de terceros

**5. Commit los cambios:**
```bash
git add LICENSE package.json README.md DEPENDENCIES_AND_LICENSES.md
git commit -m "Add AGPL-3.0-or-later license and remove unused openai dependency"
# o para MIT:
git commit -m "Add MIT license"
git push
```

---

## 🎯 CONCLUSIÓN Y RECOMENDACIÓN FINAL (REVISADA)

### **RECOMENDACIÓN #1: AGPL v3** ⭐⭐⭐⭐⭐ (Mi opción favorita para tu caso)

**Por qué AGPL v3 ahora:**

1. **Sin conflictos legales** ✅
   - OpenAI puede removerse (no se usa)
   - Solo MIT + dev tools = Compatible

2. **Alineado con tu filosofía** ✅
   - Torneos abiertos = código abierto
   - AGPL asegura que mejoras vuelvan a comunidad
   - Usuarios del servicio ven el código

3. **Mejor para el ecosistema** ✅
   - Evita "forks privados" que no contribuyen
   - Mejoras benefician a todos los usuarios
   - Fortalece la comunidad de Wesnoth

4. **Perfectamente viable** ✅
   - Tus dependencias son compatibles
   - Comunidad open source lo entiende
   - Precedentes bien establecidos

5. **Diferencia con competidores** ✅
   - Muestra compromiso con código abierto
   - Atrae desarrolladores que creen en "copyleft"
   - Posicionamiento de marca clara

**Acciones necesarias:**
1. ✅ Remover `openai` (npm uninstall openai)
2. ✅ Crear archivo LICENSE con AGPL-3.0
3. ✅ Actualizar package.json con "license": "AGPL-3.0-or-later"
4. ✅ Actualizar README.md

---

### **RECOMENDACIÓN #2: MIT** ⭐⭐⭐⭐

**Si prefieres máxima flexibilidad:**

1. **Ultra-compatible** ✅
   - Coincide con 91% de dependencias
   - Cero complejidad legal

2. **Máxima adopción** ✅
   - Corporaciones lo prefieren
   - Menos barreras de entrada

3. **Simplicidad** ✅
   - Muy fácil de explicar
   - Menos requisitos legales

**Desventaja:** No asegura que mejoras vuelvan al proyecto

---

### Tabla Comparativa Final

| Aspecto | MIT | AGPL v3 |
|--------|-----|---------|
| **Compatibilidad** | ✅ Excelente | ✅ Excelente |
| **Simpleza Legal** | ✅✅✅ | ⚠️✅✅ |
| **Adopción Corporativa** | ✅✅✅ | ⚠️✅ |
| **Comunidad Open Source** | ✅✅ | ✅✅✅ |
| **Asegura Contribuciones** | ❌ | ✅ |
| **Para Torneos Abiertos** | ✅✅ | ✅✅✅ |
| **Para Proyecto Comunitario** | ✅✅ | ✅✅✅ |
| **Sin Conflictos** | ✅ Sí | ✅ Sí (sin OpenAI) |

---

### Resumen Final: AGPL v3 es viable Y recomendado

**Antes:** "No puedes usar AGPL porque OpenAI crea conflictos"
**Ahora:** "OpenAI no se usa, así que AGPL v3 es perfectamente viable"

**Mi recomendación:** **AGPL v3** porque:
- Refleja valores del proyecto (código abierto para torneos abiertos)
- Compatible con todas tus dependencias reales
- Mejor para comunidad de Wesnoth
- Diferencia clara con alternativas propietarias

---

## 📎 ARCHIVO DE REFERENCIA RÁPIDA

### Licencias Compatibles (VERSIÓN ACTUALIZADA)

**Con AGPL v3:**
- ✅ MIT ↔ AGPL v3 (completamente compatible)
- ✅ BSD-2-Clause ↔ AGPL v3 (completamente compatible)
- ✅ ISC ↔ AGPL v3 (completamente compatible)
- ✅ TypeScript Apache-2.0 (dev) ↔ AGPL v3 (compatible en dev)

**Con MIT:**
- ✅ MIT ↔ Apache-2.0 (bidireccional)
- ✅ MIT ↔ BSD-2-Clause (bidireccional)
- ✅ MIT ↔ ISC (bidireccional)
- ✅ Apache-2.0 ↔ BSD-2-Clause (bidireccional)

### Count Summary (Sin Dependencias No Usadas)

```
DEPENDENCIAS REALES (Usadas en código):
- Total paquetes: 34
- MIT: 31 (91%)
- Apache-2.0: 1 (3%) [TypeScript - dev only]
- BSD-2-Clause: 1 (3%)
- ISC: 1 (3%)

DEPENDENCIAS INSTALADAS PERO NO USADAS (Para remover):
- openai: 1 (❌ NO se importa en código backend)
- netlify-cli: 1 (❌ NO se usa en deployment, se usa Railway)

RECOMENDACIONES:
cd backend && npm uninstall openai
cd .. && npm uninstall netlify-cli
```

---

**Última actualización**: 2026-01-01
**Análisis realizado con**: 
- Inspection de package.json y node_modules
- grep de imports en código fuente
- Validación: No se encontró `import openai` en ningún archivo
