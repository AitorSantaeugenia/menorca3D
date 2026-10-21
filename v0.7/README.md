# Menorca 3D

Exploración 3D de Menorca en el navegador, construida con **datos geográficos reales**. Primera zona («vertical slice»): **Es Castell, con inicio en Santa Anna** (incluye el casco de Es Castell, Cales Fonts y Sol del Este).

Tecnología: **Three.js** (renderizado 3D) + **Vite** (servidor y empaquetado web) + herramientas en **Python** para procesar los datos geográficos.

---

## 1. Qué hay hecho (versión 0.7)

### Experiencia
- **v0.7**:
  - El inicio muestra **toda Menorca**: costa real de OSM; fuera de Es Castell todo es campo provisional, con un relieve suave inventado.
  - **Faros de toda la isla**: los de la bocana de Maó con su secuencia de destellos real, y los 6 grandes con su ritmo pendiente de OSM.
  - **Botón Día / Noche** arriba en el centro, en el inicio y en el juego. De noche, en el juego, se encienden las farolas y algunas ventanas.
  - Se entra directamente en Es Castell; el personaje empieza **delante del Ayuntamiento**.
  - Lugar **devPlace** delante del edificio nº 1061.
  - **Ajustes por edificio** en `ajustes_edificios.json`: el nº 1061, blanco con tejado de teja.
- **Pantalla de inicio nocturna (v0.6)**: todo el municipio de Es Castell en 3D, de noche, con su frontera real; fuera de ella no se dibuja nada, como en un mapa.
  - Relieve real, mar con luna y estrellas, edificios con ventanas encendidas y farolas en las calles.
  - Faros de OSM con su color y ritmo de destellos reales (cuando se ejecuta `extraer_faros.py`).
  - Panel translúcido encima; al entrar, la cámara vuela hasta la zona elegida y funde con el juego.
- Pantalla de inicio con logo → «¿Dónde quieres explorar?» (Es Castell) → «¿Qué zona?» (Santa Anna).
- Nombre y personaje (2 cuerpos, 3 estilos), guardados en el navegador como **invitado** (sin registro).
- Zoom 2D Menorca → Es Castell → Santa Anna y descenso de la cámara desde la vista aérea hasta el personaje.
- Movimiento en tercera persona: caminar, correr, saltar, aceleración y giro suaves, cámara con suavizado.
- Colisiones con edificios, muros, mar y pendientes imposibles (en escaleras se permite más pendiente).
- **Minimapa** orientado con calles y lugares, y debajo **coordenadas en vivo** (latitud, longitud y altitud).
- Lugares señalados con haz de luz y cartel: Explanada, Ayuntamiento, farmacia y supermercados. El panel «Lugares» permite teletransportarse.
- Controles táctiles en móvil (joystick y botones).

### Mundo
- **Relieve real** a partir del MDT de 50 cm del IGN, remuestreado a 5 m. La costa del MDT coincide con la de OpenStreetMap.
- **Suelo** texturizado con los colores de mapa de OSM: calles, zonas, piscinas y huellas.
- **Edificios con volúmenes reales del Catastro**: 4.326 piezas con su huella, su número de plantas y sus patios, más 113 edificios de OSM donde no hay Catastro.
- **Tejados**: a cuatro aguas con teja en casas exentas casi rectangulares; terraza con pretil en adosados, edificios con patio y bloques.
- **Fachadas procedurales**: ventanas de guillotina georgianas con recercado blanco y puertas en planta baja, a escala real por planta.
- **Ayuntamiento** con su estilo propio: muro rojo con jambas, dinteles y zócalo blancos.
- **Muros** de OSM (353 en la zona, 134 de piedra seca), vallas y setos.
- **Aceras**: las reales de OSM y 229 tramos estimados en el casco (8,5 km), ajustados al espacio entre calzada y fachadas.
- **Escaleras** con peldaños (14).
- **Texturas** (piedra seca, lajas, losa de acera, asfalto, estuco, teja, terraza, losa de plaza, baldosa roja, adoquín, sillarejo) calibradas con fotos propias.
- **Persianas mallorquinas** y zócalos de lajas en las urbanizaciones; calzadas de asfalto; farolas; barandillas.
- **Edificios numerados (v0.5)**: número estable por parcela catastral, «ir al edificio nº X» y mapa grande con estado acabado/pendiente (ver sección 8).
- **Casco y Explanada (v0.4)**, con referencias de las carpetas 7–26:
  - Cuarteles y Ayuntamiento en rojo con esquinas dentadas, zócalo y cornisa blancos, tejado a cuatro aguas y torre del reloj.
  - Explanada con losas, farolas altas, plátanos en cuadrícula y bancos.
  - Casco con recercados en arco, cornisas, pilastras, balcones, persianas verdes y azules, paleta de colores medida y algunas fachadas de sillarejo.
  - Calzada de adoquín junto a la Explanada, aceras de baldosa roja y farolas de brazo en fachada.
  - Santa Anna con alero de teja dentado.
- **Vegetación** mediterránea (pino, acebuche, ciprés, palmera, matorral) dentro de las zonas reales de OSM.

---

## 2. Requisitos

| Herramienta | Para qué | Notas |
|---|---|---|
| **Node.js** (versión LTS) | Ejecutar el juego (`npm`) | https://nodejs.org |
| **Python 3.9 o superior** (recomendado Miniconda) | Procesar los datos | Python 3.7 da problemas de certificados y de librerías |
| Navegador moderno | Jugar | Chrome, Edge o Firefox |
| QGIS (opcional) | Revisar los datos en un mapa | Ver apartado 5 |

---

## 3. Fuentes de datos (todas utilizables) y cómo se obtienen

| Fuente | Qué aporta | Licencia | Atribución en el juego |
|---|---|---|---|
| **OpenStreetMap** (Overpass API) | Costa, calles, zonas, muros, aceras, piscinas, lugares, nombres | ODbL 1.0 | © colaboradores de OpenStreetMap |
| **CNIG / IGN – MDT 50 cm** | Relieve | Licencia del CNIG (verificar el texto exacto en la descarga) | © Instituto Geográfico Nacional |
| **Catastro – INSPIRE Buildings** (municipio 07064) | Volúmenes de edificios y número de plantas | Metadatos: «No conditions apply» / «no limitation». Licencia general INSPIRE del Catastro pendiente de leer | Dirección General del Catastro |

### 3.1 OpenStreetMap
Se descarga con el script del proyecto (ver apartado 7). No hace falta cuenta.

### 3.2 MDT del CNIG (relieve)
1. Entrar en el Centro de Descargas del CNIG: https://centrodedescargas.cnig.es
2. Buscar el **Modelo Digital del Terreno de 50 cm (MDT50cm)** en la zona de Es Castell.
3. Descargar las hojas de la **hoja 0647**. Para Santa Anna y el casco bastan la **4-6** y la **4-7**; las hojas 3-6, 3-7, 3-8 y 4-8 sirven para ampliar.
4. Guardarlas en `data/raw/mdt/`.

### 3.3 Catastro (edificios)
1. Entrar en los servicios INSPIRE del Catastro: https://www.catastro.hacienda.gob.es/webinspire/index.html
2. **Servicios ATOM → Edificios (Buildings) → Illes Balears → Es Castell (07064)**.
3. Descargar `07064_Buildings.zip` y descomprimirlo.
4. Copiar **`A_ES_SDGC_BU_07064_buildingpart.gml`** a `data/raw/catastro/`. Los demás archivos (building, otherconstruction, direcciones, parcelas) no se usan todavía, pero conviene guardarlos para fases futuras (comercios, búsqueda por dirección).

### 3.4 Referencias visuales (solo para diseñar, no se incluyen en el juego)
| Fuente | Licencia | Uso |
|---|---|---|
| Wikimedia Commons, p. ej. «EsCastell - Ajuntament.jpg» | Según cada archivo (ese figura como dominio público) | Referencia y posible reutilización según su licencia |
| Mapillary | CC BY-SA 4.0 (uso comercial con condiciones aparte) | Referencia visual |
| Flickr con licencia Creative Commons | Según cada foto | Referencia |
| Fotos propias | Propias | Referencia y reutilización |
| Textos de guías y prensa (Barceló, Baleària, menorca.info) | Copyright | Solo para extraer hechos documentados |

Hechos documentados que guían el diseño (detalle en `docs/REFERENCIAS_VISUALES.md`):
- Es Castell se fundó como **Georgetown** (1771) y conserva arquitectura **georgiana**: fachadas de colores y **ventanas de guillotina**.
- El **Ayuntamiento** (antiguos cuarteles, en la Explanada) tiene muros rojos con dinteles y jambas blancos.
- Santa Anna: villas con jardín, piscina y caminos entre muros de piedra.

**Fuentes descartadas** (no se pueden usar para crear contenido): Google Maps / Street View y bancos de imágenes de pago como Shutterstock.

---

## 4. Dónde va cada archivo

Todo se ejecuta desde la **carpeta raíz del proyecto**, la que contiene `package.json` y `tools/`.

```
menorca3d/
├─ data/
│  ├─ raw/                          ← tus descargas (no se tocan al actualizar)
│  │  ├─ world.json                 ← OpenStreetMap (lo genera extraer_es_castell.py)
│  │  ├─ mdt/                       ← hojas del MDT (.tif)
│  │  └─ catastro/
│  │     └─ A_ES_SDGC_BU_07064_buildingpart.gml
│  ├─ processed/                    ← resultados intermedios (zona.json)
│  └─ generated/                    ← imágenes de comprobación
├─ public/data/menorca/
│  ├─ outline.json                  ← contorno de Menorca (opcional)
│  └─ es-castell/santa-anna/
│     ├─ zone.json                  ← datos que carga el juego
│     └─ ground.png                 ← textura del suelo
├─ src/                             ← código del juego
├─ tools/                           ← scripts de datos
└─ docs/                            ← documentación
```

---

## 5. QGIS (opcional)

QGIS **no es necesario** para generar ni ejecutar el proyecto: todo el procesado lo hacen los scripts de `tools/`. Es útil para **revisar visualmente** los datos descargados.

**Instalación**
1. Ir a https://qgis.org y entrar en Descargas.
2. Elegir la versión **LTR** (soporte a largo plazo), que es la más estable, e instalarla para Windows.

**Uso con este proyecto**
- Arrastrar un `.tif` de `data/raw/mdt/` a QGIS para ver el relieve.
- Arrastrar `A_ES_SDGC_BU_07064_buildingpart.gml` para ver los edificios del Catastro y consultar su número de plantas (herramienta «Identificar objetos»).
- Ambos usan el sistema de coordenadas **ETRS89 / UTM 31N (EPSG:25831)**.

---

## 6. Instalación (solo la primera vez)

Desde la terminal de **Miniconda**, en la carpeta raíz del proyecto:

```
cd ruta\a\menorca3d
pip install -r tools/requirements.txt
npm install
```

---

## 7. Generar los datos (en este orden)

```
python tools/extraer_es_castell.py --out data/raw/world.json
python tools/preparar_zona.py data/raw/world.json
python tools/catastro_volumenes.py
python tools/aceras_estimadas.py
python tools/procesar_terreno.py
python tools/extraer_contorno_menorca.py
python tools/generar_texturas.py
python tools/numerar_edificios.py
python tools/extraer_faros.py
python tools/preparar_municipio.py
```

| Comando | Qué hace | Resultado esperado |
|---|---|---|
| `extraer_es_castell.py` | Descarga OSM de la zona | `Listo: ... 5505 edificios, 1204 calles...` |
| `preparar_zona.py` | Recorta la zona, costa, lugares e inicio | `'buildings': 1587, 'roads': 307, 'walls': 353...` |
| `catastro_volumenes.py` | Sustituye los edificios por los volúmenes del Catastro | `volúmenes del Catastro: 4326 · edificios OSM conservados: 113` |
| `aceras_estimadas.py` | Aceras estimadas en el casco y las urbanizaciones | `aceras estimadas: 476 tramos, 25.8 km` |
| `procesar_terreno.py` | Relieve y textura del suelo; escribe `zone.json` | `sin dato (mar/fuera): 0 de 130321` y `Listo` |
| `extraer_contorno_menorca.py` | Contorno real de Menorca para el mapa de entrada (opcional) | `N tramos de costa guardados` |
| `generar_texturas.py` | Texturas procedurales (ya vienen generadas; solo si las cambias) | `Listo.` |
| `extraer_faros.py` | Faros y luces de navegación de OSM con su ritmo (`data/raw/faros.json`) | Lista de faros con su color y periodo |
| `preparar_municipio.py` | Pantalla de inicio: frontera, relieve, edificios, calles y faros de todo el municipio | `frontera: 1 polígonos...` y `Listo: .../municipio.json` |
| `numerar_edificios.py` | Número estable por edificio y su estado en `edificios.json` (nunca renumera) | `1401 edificios en la zona (1288 catastrales, 113 de OSM)...` |

Notas:
- Si aparece un **error de certificado SSL** al descargar, añade `--insecure` al comando (solo descarga datos públicos).
- `catastro_alturas.py` es una alternativa sencilla a `catastro_volumenes.py`: solo copia las plantas sobre las huellas de OSM.
- Las imágenes de comprobación quedan en `data/generated/`.

---

## 8. Ejecutar el juego

```
npm run dev        # servidor de desarrollo → abrir http://localhost:5173
npm run build      # versión optimizada para publicar (carpeta dist/)
npm run preview    # probar la versión de build en local
```

### Controles
| Acción | Teclado y ratón | Móvil |
|---|---|---|
| Moverse | W A S D o flechas | Joystick |
| Correr | Mantener Shift | Botón «Correr» |
| Saltar | Espacio | Botón «Saltar» |
| Girar la cámara | Arrastrar con el ratón | Arrastrar con el dedo |
| Turbo (solo pruebas) | T | — |
| Mapa de edificios | M o doble clic en el minimapa | Doble toque en el minimapa |
| Ir a un edificio | Escribir el nº en «Edificio nº» y pulsar «Ir» | Igual |

### Ajustes por edificio
`public/data/menorca/es-castell/santa-anna/ajustes_edificios.json` guarda lo que se indica de cada edificio por su número:
- `fachada`: color de la pared.
- `tejado: "teja"`: cubierta de teja. Si la forma lo permite, a cuatro aguas; si no, plana con teja.

Ejemplo: el nº 1061, blanco con tejado rojo.

### Lugares propios
`src/config/places.js`: lugares que no vienen de OSM (por ejemplo `devPlace`, delante del edificio nº 1061). Salen en «Lugares» con su haz de luz.

### Edificios numerados y mapa de estado
- Cada edificio tiene un **número estable** (nº 1 a 1401). Equivale a una **parcela del Catastro** con todas sus piezas; la referencia catastral (14 caracteres) aparece en la ficha. Los 113 edificios que solo existen en OSM no tienen referencia catastral, pero sí número.
- Abajo a la derecha, bajo las coordenadas, se ve el **número del edificio más cercano**. Para pedir cambios: «edificio nº 700» y las fotos.
- **Ir a un edificio**: en el panel de la izquierda, escribir el número (o la referencia catastral) y pulsar «Ir». El personaje aparece en la calle más cercana, mirando al edificio, que se resalta unos segundos.
- **Mapa grande** (M o doble clic en el minimapa): edificios en blanco con una máscara **verde = acabado** y **rojo = pendiente**, y su número al acercar el zoom. Arrastrar para mover y usar la rueda o pellizcar para el zoom.
  - Clic en un edificio: ficha con número, referencia (enlace a la Sede del Catastro), «Ir delante» y «Marcar acabado/pendiente».
  - «Marcar con clic»: cada clic cambia el estado directamente, para marcar muchos seguidos.
  - Con `npm run dev`, los cambios se **guardan solos** en `public/data/menorca/es-castell/santa-anna/edificios.json`. En otros casos se quedan en el navegador y el mapa avisa: pulsa «Exportar» y sustituye ese archivo.

---

## 9. Actualizar a una versión nueva

- Normalmente solo hay que **sustituir los archivos indicados** (casi siempre en `src/`). Vite recarga solo.
- Si cambia `package.json`: ejecutar `npm install`.
- Si cambia algún script de `tools/`: repetir solo los comandos indicados.
- **No borrar** `data/raw/`, `node_modules/` ni `public/data/menorca/outline.json`.

## 10. Añadir una zona nueva
1. Generar sus datos con `tools/` (rectángulo y carpeta de salida propios).
2. Añadir una entrada en `src/config/destinations.js` (`DESTINATIONS` y `MENU`) con su punto de inicio.
3. Documentar las fuentes en `docs/DATA_SOURCES.md`.

---

## 11. Qué es real y qué no

| Elemento | Estado |
|---|---|
| Costa, calles, muros, lugares, zonas | REAL (OSM) |
| Relieve | REAL (MDT IGN) |
| Huellas y plantas de edificios | REAL (Catastro) |
| Altura por planta (3 m) | ESTIMADO |
| Formas de tejado | PROCEDURAL (salvo `roof:shape` en OSM) |
| Ventanas y puertas | PROCEDURAL, basado en referencias documentadas |
| Colores de fachadas, carpintería, cuarteles y Ayuntamiento | ESTIMADO a partir de fotos propias |
| Plazas y edificios con nombre | REAL (OSM) |
| Torre del reloj (posición), farolas, árboles de calle, bancos, zonas de adoquín | ESTIMADO |
| Aceras del casco | ESTIMADO (las de OSM son REALES) |
| Árboles | PROCEDURAL dentro de zonas REALES |
| Fondo marino, personaje | PLACEHOLDER |
| Inicio: frontera del municipio | REAL (unión de parcelas del Catastro) |
| Inicio: faros (posición, color, ritmo) | REAL (OSM) |
| Inicio: ventanas encendidas, farolas, luna | PROCEDURAL |
| Inicio: costa de Menorca | REAL (OSM) |
| Inicio: relieve y hierba fuera de Es Castell | PLACEHOLDER |
| Faros grandes sin datos en OSM (Artrutx, Cavalleria, Ciutadella, Favàritx, Illa de l'Aire, Punta Nati) | Posición REAL (Wikipedia); ritmo ESTIMADO hasta repetir `extraer_faros.py` |
| Ajustes por edificio (`ajustes_edificios.json`) | Ajustes manuales |

---

## 12. Problemas frecuentes
| Síntoma | Causa | Solución |
|---|---|---|
| `No such file or directory: 'data/raw/...'` | La terminal está en `tools/` o en otra carpeta | `cd ..` hasta la raíz y usar `python tools/...` |
| `partes catastrales ... 0` | Falta el `buildingpart.gml` | Copiarlo a `data/raw/catastro/` |
| `sin dato (mar/fuera): 130321 de 130321` | No hay hojas del MDT | Copiar los `.tif` a `data/raw/mdt/` y repetir `procesar_terreno.py` |
| `CERTIFICATE_VERIFY_FAILED` | Certificados antiguos o fecha del PC | Añadir `--insecure`, o `pip install --upgrade certifi` |
| Extensión duplicada (`world.json.json`) | Windows oculta extensiones | `ren data\raw\world.json.json world.json` |

---

## 13. Próximos pasos
1. Detalle de Cales Fonts y edificios emblemáticos.
2. Carga por bloques y niveles de detalle; ampliar al resto de Es Castell.
3. Personaje definitivo; vehículos; comercios y ofertas.

---

## Créditos
© colaboradores de OpenStreetMap (ODbL) · Relieve: © Instituto Geográfico Nacional · Edificios: Dirección General del Catastro.
