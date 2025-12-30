# Player Country and Avatar Implementation

## Cambios realizados

### 1. Base de datos
- **Migración:** `20251230_add_country_and_avatar.sql`
- **Nuevos campos en tabla `users`:**
  - `country VARCHAR(2)` - Código ISO 3166-1 alpha-2
  - `avatar VARCHAR(255)` - Nombre o path del avatar

- **Nuevas tablas:**
  - `countries` - Tabla con lista de países disponibles
  - `player_avatars` - Tabla con avatares disponibles

### 2. Backend - API Endpoints

#### Registro (`POST /auth/register`)
- Ahora acepta `country` y `avatar` en el body
- Ambos campos son opcionales

#### Actualizar Perfil (`PUT /users/profile/update`)
- Endpoint autenticado
- Permite actualizar `country` y `avatar`
- Al menos uno debe ser proporcionado

#### Obtener Datos (`GET`)
- `GET /users/data/countries` - Lista de países disponibles
- `GET /users/data/avatars` - Lista de avatares disponibles
- `GET /users/ranking/global` - Incluye country y avatar
- `GET /users/ranking/active` - Incluye country y avatar
- `GET /users/all` - Incluye country y avatar
- `GET /public/players` - Incluye country y avatar
- `GET /public/players/:id` - Incluye country y avatar

### 3. Avatares Disponibles

Los avatares están basados en tipos de unidades de Wesnoth:

1. Knight - Brave Knight
2. Archer - Skilled Archer
3. Mage - Powerful Mage
4. Rogue - Stealthy Rogue
5. Paladin - Holy Paladin
6. Warrior - Strong Warrior
7. Scout - Swift Scout
8. Healer - Healing Priest
9. Assassin - Dark Assassin
10. Swordsman - Master Swordsman
11. Ranger - Forest Ranger
12. Necromancer - Dark Necromancer
13. Shaman - Wise Shaman
14. Cavalry - Mounted Cavalry
15. Spearman - Disciplined Spearman
16. Fencer - Elegant Fencer

### 4. Países Disponibles

Se incluye una lista de 18 países con códigos ISO y emojis:
- ES, US, GB, FR, DE, IT, MX, BR, AR, CA, AU, JP, CN, IN, RU, ZA, y XX (Other)

### 5. Frontend - Cambios Necesarios

#### Página de Registro
- Agregar selector de país (dropdown con lista de `GET /users/data/countries`)
- Agregar selector de avatar (grid/dropdown con imágenes de `GET /users/data/avatars`)

#### Página de Perfil
- Permitir editar país y avatar
- Mostrar avatar actual con nombre del jugador

#### Páginas de Ranking
- Mostrar avatar y país al lado del nickname
- Formato: [FLAG] Nickname [AVATAR]

#### Página de Jugador
- Mostrar avatar prominente
- Mostrar país con emoji
- En la sección de perfil

#### Página de Listado de Jugadores
- Mostrar avatar en miniatura
- Mostrar país junto al nombre
- En la tabla/grid de jugadores

### 6. Notas

- Los paths de avatares están configurados como `/avatars/[nombre].png`
- Será necesario proporcionar los archivos PNG de los avatares
- Los emojis de banderas se usan para los países (compatible con navegadores modernos)
- Todos los campos country y avatar son NULL por defecto para usuarios existentes
