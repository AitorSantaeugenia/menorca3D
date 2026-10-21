# Hoja de ruta

Objetivo final: **toda Menorca en 3D**, modelada edificio a edificio con ayuda de la gente, navegable a pie, en coche, en bus y en barco.

## Hecho
- **v0.1–0.3**:
  - Datos reales de OSM, del Catastro y del MDT.
  - Edificios con volumen real, tejados, fachadas procedurales y texturas.
  - Aceras, muros, farolas y vegetación.
  - Inicio, personaje, minimapa y coordenadas.
- **v0.4**: casco y Explanada a partir de las fotos propias 1–26 (cuarteles, Ayuntamiento, torre del reloj, pavimentos, farolas, balcones).
- **v0.5**:
  - Número estable por edificio (parcela catastral) e «ir al edificio nº X».
  - Mapa grande con estado acabado o pendiente, que se guarda en `edificios.json`.
  - Corregido el fotograma 3D que se veía antes del zoom inicial.
- **v0.6**: pantalla de inicio nocturna de todo Es Castell con su frontera, faros de OSM, panel translúcido y vuelo hasta la zona.
- **v0.7**:
  - Isla completa en el inicio (resto de municipios en hierba) y faros de toda la isla.
  - Modo día / noche en el inicio y en el juego.
  - El personaje empieza en el Ayuntamiento.
  - Lugar devPlace y ajustes por edificio.

## Fase 1 · Pantalla de inicio — hecha (v0.6–0.7); falta el relieve real del resto de la isla
- **Isla en 3D** con el relieve real (MDT de toda Menorca, a baja resolución) y mar alrededor, de noche, con cielo estrellado.
- **Faros reales** según OpenStreetMap (`man_made=lighthouse` y etiquetas `seamark:light:*`): posición, color, alcance y ritmo de destellos REALES. Haz giratorio visible sobre el mar.
- Luces de los pueblos (puntos cálidos de los núcleos de OSM) para que se lea la silueta.
- **Panel translúcido** encima (nombre, personaje, destino) con la isla de fondo; después, vuelo de cámara continuo hasta la zona elegida, que sustituye al mapa 2D.
- Para toda la isla: hojas del MDT de toda Menorca (MDT25 o MDT200 del CNIG) y la frontera de cada municipio.

## Fase 2 · Detalle a pie de calle
- **Escaleras**:
  - Las de OSM (14), que ya están.
  - Las que faltan, añadidas a mano a partir de tus fotos (se guardan en un archivo de añadidos, ESTIMADO).
  - Detección automática de tramos peatonales con mucha pendiente.
- **Cerramientos de parcela**: muretes, verjas, barandillas y puertas en el frente de cada casa.
  - El trazado sale de las **parcelas catastrales** (lindes REALES); el tipo de cerramiento es ESTIMADO según la zona y las fotos.
- Detalle por edificio («edificio nº X»): colores, carpintería, balcones y portales según tus fotos (archivo de ajustes por edificio).
- Necesario: el GML de **parcelas** del Catastro (CP) del municipio 07064.

## Fase 3 · Gráficos
- **Sombras** del sol y oclusión ambiental (rincones, aleros y bajo los balcones más oscuros).
- Cielo con degradado, bruma lejana y **agua** con reflejos y oleaje.
- **Ciclo de día y noche**: farolas encendidas y faros, enlazados con la pantalla de inicio.
- **Ortofoto PNOA** como textura del suelo fuera de calles y aceras (licencia del IGN por verificar).
- Ajuste automático de calidad según el dispositivo (móvil, PC).

## Fase 4 · Colaboración
- Tres estados: **pendiente** (rojo) · **con referencias** (amarillo) · **acabado** (verde).
- **Notas en el mapa**: un pin con texto («aquí hay unas escaleras», «la verja es verde»), guardado en un archivo de notas.
- **Ficha por edificio** en JSON (colores, estilo, ventanas, puertas, notas) para que alguien sin conocimientos de 3D pueda aportar; editor sencillo dentro del juego.
- Guía para colaborar:
  - Qué fotos hacen falta.
  - Licencia de las aportaciones.
  - Privacidad: sin caras ni matrículas, y nunca Street View ni fotos ajenas.
- Repositorio público y web publicada.

## Fase 5 · Toda la isla
- Pipeline por **municipio** (los 8), automatizado con un solo comando.
- **Chunks** de ~250 m con carga por distancia y niveles de detalle (LOD) para edificios, terreno y vegetación.
- Numeración de edificios única en la isla: prefijo de municipio + número (los números actuales de Es Castell se conservan).

## Fase 6 · Moverse y vivir la isla
- Coche, bus (rutas y paradas reales), barco por el puerto de Maó y la costa.
- Comercios, lugares y ofertas; cuentas de usuario.

## Pendiente transversal
- Verificar las licencias de IDEIB, CNIG (MDT, PNOA) y Catastro y completar `DATA_SOURCES.md`.
- Personaje definitivo con animaciones; editor con referencia por foto.
