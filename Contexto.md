Crea una aplicación web que permita gestionar torneos de un juego de estrategia. 
La aplicación debe permitir el registro de jugadores y usar una bbdd para almacenar la información de los jugadores.
Los jugadores deben poder dar de alta un nic, su email de registro, su idioma, su id de discord y una contraseña
La aplicación debe permitir el registro automatico y tener un panel de administración donde se puedan ver las solicitudes de registro y confirmarlas.
El panel de administración debe permitir bloquear una cuenta
El panel de administración debe permitir configurar politicas de contraseña seguras (longitud mínima, simbolos, numeros, mayusculas, minusculas, número de contraseñas anteriores no permitidas, etc)
Los usuarios deben poder cambiar sus contraseñas
el frontend web debe permitir reportar victorias (solo reporta el jugador ganador) a los jugadores registrados indicando contra quien jugaron y dar detalles de la partida (mapa, facciones de cada jugador, comentarios y valoración del oponente con un sistema de 5 estrellas, y adjuntar el archivo replay de la partida). El oponente recibira una notificación vía email y podra confirmar o contestar el registro, añadiendo ademas su valoración del oponente y sus comentarios. Referencia https://wesnoth.gamingladder.info/
En la página principal de la aplicación se vera información de los ultimos jugadores registrados, de las ultimas partidas reportadas, y del top 10 del ranking de jugadores. Tambien habran un tablon de noticias ordenadas de mas recientes a mas antiguas (se veran las 3 ultimas y habra una opción de ver mas)
Los idiomas del sitio seran inglés, español, chino y alemán
en el panel de adminiistración se podrá editar el panel de noticias
El sitio tendrá además un apartado de torneos donde el administrador o cualquier jugador podrá proponer un torneo. Ahi se abrira un panel para poder poner la descripción y reglas del torneo. los jugadores se podrán registrar. El creador del torneo puede definir el sistema de juega, por ejemplo suizo de x rondas + cuartos de final y finales, asi como en numero de partidas de cada ronda. Los torneos deben ser aprobados por el admninistrador del sitio. una vez que se participa en un torne, se podra reportar la partida con un sistema igual al del reporte global desde dentro del apartado torneos, esto reporta la partida en ambos sitos pero no genera duplicado, simplemente aplica al ranking global y al del torneo. el torneo tendra un apartado donde se pueda ver el ranking del torneo.
El sistema de gestión de puntos sera similar al ELO del ajedrez (referencia chess.com)
El frontend tendra un apartado donde se pueda ver el ranking global.
El frontend ira dando un nivel a los jugadores (novato, iniciado, veterano, experto, etc) segun el rango de ELO (similar al ajedrez)
El frontend tendra un apartado para el jugador registrado donde puede ver sus ultimas partidas, con estadisticas de ganadas, perdidas, elo ganado, elo perdido, etc. tambien con las facciones y mapas reportados.
Para las facciones te proporcionare una lista de facciones que el administrador podra cambiar, para los mapas crearas una lista a medida que los jugadores reporten para facilitar el reporte de los siguientes jugadores, les propondras el mapa a medida que escriben.
En el frontend habra un apartado donde se podrá buscar información de otros jugadores, ver sus estadisticas, etc, estado en linea, etc.
El frontend tenra un apartado donde se pueden ver las partidas de todos los jugadores (game history, ver las puntuaciones, estadisticas y descargar el replay de la partida)
El frontend tendra una sección de FAQ que el administrador podra cubrir
El frontend tendra un selector de idioma
Cuando el adminsitrador añada un faq, o algo al tablon, el backend usara servicios de chat gpt o google para traducir, mostrar la traducción en los 4 idiomas antes de publicar o aceptar
El sistema permitira ver si hay otros jugadores en linea e iniciar un chat directo.
