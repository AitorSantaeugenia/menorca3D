# Fuentes de datos

Estado: REAL = dato obtenido de la fuente · ESTIMADO = derivado · PROCEDURAL = generado · PLACEHOLDER = temporal.

| Fuente | Datos utilizados | Licencia | URL | Uso permitido | Atribución necesaria |
|---|---|---|---|---|---|
| OpenStreetMap (Overpass API) | Huellas de edificios, calles, costa, zonas, piscinas, nombres, comercios (REAL) | ODbL 1.0 | https://www.openstreetmap.org/copyright | Sí, con atribución y compartir en las mismas condiciones las bases derivadas | © colaboradores de OpenStreetMap |
| IDE Menorca / IDEIB | Pendiente de revisar (elevación, ortofoto, cartografía) | Por verificar | — | Por verificar antes de usar | Por verificar |
| CNIG / IGN · MDT de 50 cm (hojas 0647 3-6 a 3-8 y 4-6 a 4-8) | Relieve (REAL), remuestreado a 5 m en la zona y a 10 m en todo el municipio (inicio) | Licencia del CNIG: verificar el texto exacto en la descarga | https://centrodedescargas.cnig.es | Uso con atribución (por confirmar) | © Instituto Geográfico Nacional |
| CNIG / IGN · PNOA | Pendiente: ortofoto | Por verificar | https://centrodedescargas.cnig.es | Por verificar | Por verificar |
| Catastro (INSPIRE Buildings, municipio 07064 Es Castell) | Volúmenes por BuildingPart: huella, patios y número de plantas (REAL), 4.326 piezas en la zona; altura con 3 m/planta (ESTIMADA). Los 113 edificios OSM sin parte catastral se conservan | Metadatos del conjunto: «No conditions apply» / «no limitation». Licencia general de los servicios INSPIRE del Catastro (2016) aún por leer | https://www.catastro.hacienda.gob.es/webinspire/index.html | Sí según metadatos (confirmar con la licencia) | Se acredita «Dirección General del Catastro» por prudencia |
| Wikimedia Commons, Mapillary, KartaView | Pendiente de investigar | Por verificar | — | No usar hasta confirmar licencia | Por verificar |

## Elementos del prototipo actual
- Edificios: volúmenes REALES del Catastro (una pieza por parte catastral, con patios); edificios OSM donde no hay Catastro; colores PROCEDURALES salvo etiqueta OSM.
- Tejados: forma desde OSM (roof:shape) si existe; si no, PROCEDURAL: a cuatro aguas con teja para huellas casi rectangulares de 20–450 m² y hasta 2 plantas, terraza plana con pretil para el resto, incluidas las piezas adosadas a otro edificio y las que tienen patio.
- Terreno: REAL (MDT 50 cm del IGN, remuestreado a 5 m; fondo marino PLACEHOLDER a -3 m). La hoja 0647 4-8 llegó dañada y no se ha usado.
- Suelo: textura con colores de mapa a partir de zonas, calles y edificios de OSM (REAL en forma, colores de estilo de mapa).
- Árboles: PROCEDURALES, colocados dentro de zonas REALES de bosque/parque/jardín.
- Personaje: PLACEHOLDER.
- Zonas «Santa Anna» y «Sol del Este»: ESTIMADAS a partir de los nombres de calles de OSM.
- Muros, vallas y setos: trazado REAL (OSM barrier=*); material REAL si OSM indica dry_stone; altura y ancho ESTIMADOS (OSM no trae altura en ninguno). Muros sin material: color encalado ESTIMADO.
- Aceras: REALES donde OSM las indica (7 tramos) + ESTIMADAS en el casco de Es Castell (229 tramos, 8,5 km): ancho ajustado al espacio real entre calzada y fachadas (máx. 1,8 m, mín. 0,8 m), cortadas en los cruces. Bordillo de 12 cm ESTIMADO. Escaleras: trazado REAL, peldaños PROCEDURALES.
- Coordenadas en pantalla: calculadas desde la proyección local (error < 1 m); altitud del MDT (REAL).
- Fachadas: ventanas de guillotina con recercado blanco, puertas en planta baja (35 % de vanos) y vanos de ~3,2 m: PROCEDURAL, basado en referencias documentadas (docs/REFERENCIAS_VISUALES.md). Colores de carpintería y vidrio: PLACEHOLDER.
- Ayuntamiento: posición REAL (OSM amenity=townhall) y volumen REAL (Catastro 0454501FE1105S); muro rojo con jambas, dinteles y zócalo blancos según descripciones; tono exacto ESTIMADO.

## Fase de texturas (v0.3)
- Fotos propias (urbanización Santa Anna / Sol del Este), solo como referencia de color y forma: ver `docs/REFERENCIAS_VISUALES.md`.
- Calzadas: trazado y ancho REALES (OSM); asfalto PROCEDURAL.
- Aceras ESTIMADAS ampliadas a las calles urbanas de las urbanizaciones (476 tramos, 25,8 km), porque las fotos muestran acera en casi todas.
- Farolas: posición PROCEDURAL cada ~27 m en calles urbanas (OSM no tiene farolas mapeadas en la zona); forma según fotos.
- Persianas, zócalos de lajas y colores de fachada residencial: PROCEDURAL con colores medidos en fotos propias.
- Especie de cada árbol: PROCEDURAL según el tipo de zona OSM (bosque, matorral, parque, jardín).

## Casco y Explanada (v0.4)
- Plazas peatonales (contorno de la Explanada y otras 2) y edificios con nombre (cuarteles, Ayuntamiento): REAL (OSM), guardados en `zone.json` como `plazas` y `landmarks`.
- Estilo rojo de cuarteles y Ayuntamiento: se aplica a las piezas del Catastro que caen dentro de esos edificios OSM. Colores ESTIMADOS a partir de fotos propias.
- Torre del reloj: forma según fotos; posición ESTIMADA (lado del Ayuntamiento más cercano a la plaza).
- Pavimentos: losa en plazas; adoquín a menos de 140 m de la Explanada; baldosa roja en aceras del casco. Las zonas son ESTIMADAS.
- Farolas (brazo, farol, globo y las altas de la plaza), árboles de alcorque, cuadrícula de plátanos y bancos de la Explanada: posición PROCEDURAL/ESTIMADA.
- Estilo de cada fachada (casco, sillarejo, residencial con o sin lajas): PROCEDURAL con proporciones observadas en las fotos.

## Pantalla de inicio (v0.6)
- Frontera del municipio: unión de las parcelas y polígonos catastrales (INSPIRE CadastralParcels, 07064), con las calles rellenadas (cierre morfológico de ~16 m) y simplificada a ~3 m: REAL aproximada. No es la línea oficial del IGN.
- Edificios de todo el municipio: Catastro BuildingPart (7.215 piezas), 3 m por planta (ESTIMADO).
- Faros y luces de navegación: OSM (`man_made=lighthouse`, `seamark:light:*`): posición, color, ritmo y periodo REALES. El giro del haz es PROCEDURAL.
- Ventanas encendidas, farolas (cada ~28 m en calles con edificios), luna, estrellas y oleaje: PROCEDURAL.

## Isla completa en el inicio (v0.7)
- Costa de Menorca e islotes de más de 2 ha: OSM (`natural=coastline`, desde `outline.json`), REAL.
- Fuera de Es Castell: hierba y relieve suave PLACEHOLDER (no hay MDT de toda la isla en el proyecto). Alrededor de Es Castell se funde con el MDT real.
- Faros: `data/raw/faros.json` (OSM) con secuencia de destellos REAL (`seamark:light:sequence`). Faros principales que OSM aún no ha dado: posición, altura focal y alcance de «List of lighthouses in Spain» (Wikipedia); ritmo ESTIMADO.
- Modo noche del juego: ventanas encendidas y luz de farolas PROCEDURALES.
- `ajustes_edificios.json`: ajustes manuales por edificio (nº 1061: fachada blanca y tejado de teja).
