# 🚀 Deployment a Supabase + Railway + Netlify

## ✅ Status

- ✅ Licencia MIT aplicada
- ✅ Nombre del proyecto renombrado (clm_competitive_wesnoth → wesnoth_tournament_manager)
- ✅ Schema completo generado: `backend/src/config/schema_full.sql`
- ⏳ Próximos pasos: Supabase + Railway + Netlify

---

## 📋 Pasos para Supabase

### Paso 1: Crear Proyecto en Supabase
```
1. Ir a https://supabase.com
2. Click "New Project"
3. Configurar:
   - Name: wesnoth_tournament_manager
   - Database Password: (guardar de forma segura)
   - Region: (elegir la más cercana a tu ubicación)
4. Esperar a que se cree (2-3 min)
```

### Paso 2: Obtener Connection String
```
1. En Supabase Dashboard
2. Lado izquierdo → Settings (engranaje)
3. → Database
4. → Connection strings
5. Selecciona: "PostgreSQL"
6. Copia la URL:
   postgresql://postgres:PASSWORD@db.xxxxx.supabase.co:5432/postgres
```

### Paso 3: Ejecutar Schema en Supabase
```
1. En Supabase Dashboard → SQL Editor
2. Click "New Query"
3. Abre este archivo: backend/src/config/schema_full.sql
4. Ctrl+A (selecciona todo)
5. Ctrl+C (copia)
6. En Supabase → Ctrl+V (pega todo)
7. Click "▶ Run" (botón verde)
8. Espera a que diga "✓ Success"
```

**✅ Si ves "table already exists":** Es normal, significa que ya existe.

---

## 🚂 Pasos para Railway

### Paso 1: Crear Proyecto en Railway
```
1. Ir a https://railway.app
2. Click "New Project"
3. → "Deploy from GitHub"
4. Selecciona: clmates/wesnoth_tournament_manager
5. Autoriza si es necesario
```

### Paso 2: Configurar Railway
```
1. En Railway, click en el proyecto
2. → "Generate" (o configurar manualmente)
3. Selecciona la rama: main
4. Railway debería detectar que hay un backend
5. Configura las variables de entorno
```

### Paso 3: Variables de Entorno en Railway

Copia y pega en Railway → Settings → Variables:

```
DATABASE_URL=postgresql://postgres:PASSWORD@db.xxxxx.supabase.co:5432/postgres
JWT_SECRET=tu-super-secret-jwt-key-change-this-change-this-change-this-key-min-32-chars
OPENAI_API_KEY=sk-proj-xxxxx (tu API key de OpenAI)
FRONTEND_URL=https://tu-sitio.netlify.app (lo tendrás después de Netlify)
PORT=3000
NODE_ENV=production
```

**Generar JWT_SECRET seguro:**
```
openssl rand -base64 32
```

### Paso 4: Deploy en Railway
```
1. Railway detectará que necesita buildear Node.js
2. Buildear: npm run build
3. Start: npm start
4. Railway mostrará una URL del backend (ej: https://wesnoth-tournament-api.up.railway.app)
5. Copia esa URL (la necesitarás para Netlify)
```

---

## 🌐 Pasos para Netlify

### Paso 1: Crear Sitio en Netlify
```
1. Ir a https://netlify.com
2. Click "New site from Git"
3. Conecta GitHub → Selecciona: clmates/wesnoth_tournament_manager
```

### Paso 2: Configurar Build en Netlify
```
1. Build command: npm run build
2. Publish directory: dist
3. Base directory: frontend
4. Clickea "Deploy site"
```

### Paso 3: Variables de Entorno en Netlify

Después del primer deploy (que fallará porque falta variable):

```
1. En Netlify → Site settings → Build & deploy → Environment
2. Añade variable:

   VITE_API_URL=https://wesnoth-tournament-api.up.railway.app/api
   
   (Reemplaza con la URL real de Railway)
```

### Paso 4: Redeploy
```
1. Una vez añadida la variable
2. Netlify → Deployments → trigger redeploy
3. Espera a que termine
4. Tu frontend estará en: https://tu-sitio.netlify.app
```

---

## ✅ Verificación Final

Una vez todo desplegado:

```bash
# Verificar Backend
curl https://wesnoth-tournament-api.up.railway.app/health

# Verificar Frontend
https://tu-sitio.netlify.app
# Deberías ver la página de login
```

---

## 🔑 Checklist de Deployment

- [ ] Supabase: Proyecto creado
- [ ] Supabase: Connection string obtenida
- [ ] Supabase: schema_full.sql ejecutado
- [ ] Railway: Proyecto creado
- [ ] Railway: Variables de entorno configuradas
- [ ] Railway: Backend deployado (muestra URL)
- [ ] Netlify: Proyecto creado
- [ ] Netlify: Variables de entorno configuradas (VITE_API_URL)
- [ ] Netlify: Frontend deployado
- [ ] ✅ Verificación: Backend responde a /health
- [ ] ✅ Verificación: Frontend carga correctamente

---

## 🆘 Troubleshooting

### Error de Connection en Railway
```
Causa: DATABASE_URL incorrecta
Solución: Verifica que PASSWORD sea correcto en Supabase
```

### Frontend Whiteblanc
```
Causa: VITE_API_URL mal configurada o Backend no responde
Solución: Verifica que VITE_API_URL apunte a URL correcta de Railway
```

### Schema no se aplicó en Supabase
```
Causa: El SQL no se ejecutó correctamente
Solución: Verifica que no haya errores de sintaxis, ejecuta línea por línea si es necesario
```

---

**¿Dudas?** Sigue los pasos en el orden exacto.
