# Estadísticas de Jugadores - Estructura Base de Datos

## Campos en la tabla `users`:

### Campos de Rating FIDE:
- `elo_rating` (INTEGER) - Rating ELO actual
- `is_rated` (BOOLEAN) - Si el jugador está clasificado (rating oficial)
- `matches_played` (INTEGER) - Total de partidas jugadas
- `elo_provisional` (BOOLEAN) - Si el rating es provisional

### Campos de Estadísticas (nuevos):
- `total_wins` (INTEGER) - Total de victorias
- `total_losses` (INTEGER) - Total de derrotas
- `total_draws` (INTEGER) - Total de empates

### Índices:
- `idx_users_is_rated` - Para filtrar jugadores rated
- `idx_users_elo_rating` - Para ordenar por ELO
- `idx_users_matches_played` - Para filtros
- `idx_users_total_wins` (DESC) - Para ordenar por victorias
- `idx_users_total_losses` - Para estadísticas
- `idx_users_total_draws` - Para estadísticas

## Actualización de Estadísticas:

### En endpoint `/matches/report` (cuando ganador reporta):
1. Se incrementa `total_wins` para el ganador
2. Se incrementa `total_losses` para el perdedor
3. Se incrementa `matches_played` para ambos
4. Se actualiza `elo_rating` con cálculos FIDE

### Estadísticas Calculadas (en Frontend):
- `Win %` = (total_wins / matches_played) * 100
- `W-L Ratio` = "total_wins-total_losses"
- `Trend` = Últimas rachas consecutivas de W/L (desde matches table)

## Información Almacenada vs Calculada:

### Almacenada en users:
- total_wins
- total_losses  
- total_draws
- matches_played
- elo_rating
- is_rated

### Calculada desde matches table:
- Trend (últimas rachas W/L)
- Detalles de partidas individuales

## Performance:
- Índices en total_wins, total_losses, total_draws para queries rápidas
- Almacenamiento en caché en users table evita queries lentas en matches table
- Frontend calcula Win % y ratio desde datos ya presentes
