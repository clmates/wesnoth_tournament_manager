# Instalar Docker en Windows con Scoop

## Paso 1: Instalar Scoop (si no lo tienes)

Abre **PowerShell como Administrador** y ejecuta:

```powershell
# Permitir ejecución de scripts
Set-ExecutionPolicy -ExecutionPolicy RemoteSigned -Scope CurrentUser

# Instalar Scoop
iwr -useb get.scoop.sh | iex
```

Verifica que funciona:
```powershell
scoop --version
```

## Paso 2: Instalar Docker Desktop con Scoop

```powershell
# Agregar el bucket de extras (opcional pero recomendado)
scoop bucket add extras

# Instalar Docker Desktop
scoop install docker

# Instalar Docker Compose (incluido en Docker Desktop, pero por si acaso)
scoop install docker-compose
```

## Paso 3: Verificar la Instalación

```powershell
# Verificar Docker
docker --version

# Verificar Docker Compose
docker-compose --version
```

## Paso 4: Iniciar Docker

Docker Desktop se debe iniciar automáticamente. Si no:

```powershell
# En PowerShell (como Administrador)
docker ps
```

Si ves un error sobre conexión, abre **Docker Desktop** manualmente desde el menú de inicio.

## Paso 5: Verificar que Docker Está Funcionando

```powershell
# Ejecutar un test
docker run hello-world

# Deberías ver un mensaje de éxito
```

## ⚠️ Requisitos del Sistema

- **Windows 10/11 Pro, Enterprise o Education** (Docker Desktop)
- **Virtualization habilitada en BIOS**
- **WSL 2** (Windows Subsystem for Linux 2) - Docker lo instala automáticamente
- **Mínimo 4GB RAM** dedicada a Docker

### Verificar si tienes Windows Pro+

```powershell
# En PowerShell
(Get-WmiObject -Class Win32_OperatingSystem).Caption
```

Deberías ver:
- ✅ Microsoft Windows 10 Pro
- ✅ Microsoft Windows 11 Pro
- ✅ Microsoft Windows 11 Enterprise
- ⚠️ Microsoft Windows Home (ver alternativas abajo)

---

## 🏠 ¿Tienes Windows 11 Home? Tienes Opciones

### **Opción 1: Instalar PostgreSQL Local (Recomendado para Windows Home)**

Windows Home no soporta Docker Desktop, pero puedes instalar PostgreSQL directamente:

```powershell
# Instalar PostgreSQL con Scoop
scoop install postgresql

# Verificar instalación
psql --version

# Iniciar el servicio (automático)
# O iniciar manualmente:
pg_ctl -D "C:\Users\<tu_usuario>\scoop\apps\postgresql\current\data" start
```

Luego sigue la **Opción B (Local)** del README para instalar Backend y Frontend normalmente.

### **Opción 2: WSL 2 + Docker Desktop (Avanzado)**

Aunque tienes Home, puedes habilitar **WSL 2** y Docker Desktop:

```powershell
# En PowerShell como Administrador

# Habilitar WSL
wsl --install

# Reiniciar PC
Restart-Computer

# Después de reiniciar, instalar Docker Desktop desde:
# https://www.docker.com/products/docker-desktop
# (requiere crear cuenta Docker)
```

⚠️ **Nota:** Windows 11 Home soporta WSL 2, pero Docker Desktop puede tener limitaciones.

### **Opción 3: Docker Desktop en WSL 2 (Alternativa)**

Si quieres intentar Docker en Home:

1. Instala **WSL 2**:
```powershell
wsl --install
Restart-Computer
```

2. Descarga **Docker Desktop** desde: https://www.docker.com/products/docker-desktop

3. Durante la instalación, marca: ✅ "Use WSL 2 instead of Hyper-V"

4. Reinicia y verifica:
```powershell
docker --version
```

**Pros:** Usar `docker-compose up` como en Pro
**Contras:** Puede ser lento en Home, requiere WSL 2

## 🔧 Soluciones Comunes

### Error: "Docker daemon is not running"

```powershell
# Abre Docker Desktop manualmente o reinicia:
Restart-Computer
```

### Error: "Virtualization not enabled"

1. Reinicia tu PC
2. Entra al BIOS/UEFI (normalmente presionando Del, F2, F10, o F12 al iniciar)
3. Busca "Virtualization" o "VT-x" o "AMD-V"
4. Habilita la opción
5. Guarda y reinicia

### Después de instalar, no aparece en el menú

```powershell
# Verifica la instalación
scoop list

# Reinstala si es necesario
scoop uninstall docker
scoop install docker
```

## 🚀 Ahora Prueba con Wesnoth Tournament

```powershell
# Navega a tu proyecto
cd c:\Users\carlo\Documents\Desarrollo\Pruebas\clm_competitive_wesnoth

# Inicia los servicios
docker-compose up

# Abre en el navegador:
# Frontend: http://localhost:5173
# Backend: http://localhost:3000
```

## 📚 Comandos Útiles de Docker

```powershell
# Ver contenedores corriendo
docker ps

# Ver todos los contenedores
docker ps -a

# Ver logs de un servicio
docker-compose logs -f backend
docker-compose logs -f frontend

# Detener servicios
docker-compose down

# Limpiar recursos (liberar espacio)
docker system prune

# Reconstruir imágenes
docker-compose build --no-cache

# Reiniciar servicios
docker-compose restart
```

## ✅ Checklist Final

- [ ] Scoop instalado: `scoop --version`
- [ ] Docker instalado: `docker --version`
- [ ] Docker corriendo: `docker ps`
- [ ] WSL 2 habilitado (automático con Docker Desktop)
- [ ] Virtualization habilitado en BIOS
- [ ] Windows Pro o superior

¡Listo! Ahora puedes ejecutar `docker-compose up` en el proyecto.
