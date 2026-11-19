GitHub page: https://isasaza.github.io/Trabajo-Final/

GitHub repositorio: https://github.com/isasaza/Trabajo-Final

Integrantes:

-Isabella Marín Narváez - 30000140555
-Santiago Uribe Uribe - 30000139538

Opción elegida: Cruce imposible (Tipo Frogger)

Controles:

W / A / S / D o las flechas: Movimiento del personaje

Tecla espacio: Saltar

Tabulador: Activa al ayudante quien le proporciona un doble salto al personaje

ESC o P: Pausar      


Tilemap: La arquitectura del tilemap y sus identificadores se gestionan en dos puntos clave de game3D.js. Primero, entre las líneas 18 y 72, se define la constante TRAMOS, la cual estructura los tres sectores del nivel (Z = 0 a 73) asignando a cada rango de filas su tipo de zona ("suelo", "carretera", "agua", "sierras", "checkpoint" y "trofeo"). Posteriormente, entre las líneas 691 y 778, la función construirTramo(tramo) lee esta configuración para generar el escenario y sus mecánicas: asigna el material visual de cada superficie (líneas 705 a 712), registra las filas de agua para detectar caídas al río (línea 726), instancia los obstáculos dinámicos como vehículos, troncos y sierras (líneas 763 a 773), y ubica las gemas de guardado o el trofeo final al cierre de cada sector (líneas 778 a 786).


Decisiones de diseño:

-Construcción progresiva: Cuando el jugador al final del tramo obtiene una gema se desbloque un nuevo tramo del nivel

-Función del ayudante: Se creo un ayudante con aspecto de dron que acompaña al jugador en su aventura por el nivel, mediante la tecla TAB este se activa y le brinda un doble salto para ayudarlo.

-Para que el jugador identifique peligros y zonas seguras de un vistazo en un entorno espacial oscuro, se utilizó una paleta de colores neón, además de música dinámica según el estado del juego (menú, partida, pausa, victoria y derrota) y un periodo breve de invulnerabilidad con parpadeo tras reaparecer.
    
Declaración de uso de IA

Se utilizó asistencia de inteligencia artificial (Gemini) como herramienta de apoyo técnico para comprender e implementar la integración de los efectos de sonido y la música dinámica en JavaScript mediante el objeto Audio, vinculando cada pista a los distintos estados del juego (menú, partida, pausa, victoria y derrota).

Creditos:

-Dave404 (Modelo 3D del drone)
plataforma: Poly.pizza
Enlace: https://poly.pizza/m/2iyQx2YscRq

-Polygonal Mind (Modelo 3D del jugador)
plataforma: Poly.pizza
Enlace: https://poly.pizza/m/ejDr8lRglP

(Los siguientes modelos fueron descargados con autorización de la docente)

-Carros o automoviles (No hay un nombre que identifique al creador)
Plataforma: itch.io
Enlace: https://funky-tiefighter.itch.io/voxel-karts

-Lamparas (No hay nombre que identifique al creador)
plataforma: itch.io
Enlace: https://eh98.itch.io/low-poly-cyberpunk-city-free-sample-5-models

