# Menorca 3D v2

Reconstrucción del proyecto con un motor geoespacial: CesiumJS (globo real, ortofoto, carga por teselas). Más adelante se añadirán reconstrucciones de HY-World 2.0. El proyecto original (`Escritorio\menorca3d`) no se modifica: solo se lee.

> **Publicación y licencias:** el código es MIT (`LICENSE`); los datos tienen su propia licencia y atribución (`ATRIBUCIONES.md`). Qué se sube a GitHub, la revisión de privacidad y cómo colaborar con Menorca3D Forge: `GITHUB.md`.

**Ver Menorca3D online:** https://aitorsantaeugenia.github.io/menorca3D/cesium/

> [!IMPORTANT]
> **Menorca3D Forge**, el editor para retocar las casas de este modelo, está en su propio repositorio: **[AitorSantaeugenia/menorca3D-Forge](https://github.com/AitorSantaeugenia/menorca3D-Forge)**
> - **Probarlo online** (pide código de acceso): https://aitorsantaeugenia.github.io/menorca3D-Forge/app/
> - **Descargar para Windows** (`MenorcaForge.zip` con el .exe): [MenorcaForge.zip](https://github.com/AitorSantaeugenia/menorca3D-Forge/releases/latest/download/MenorcaForge.zip)

## Estructura
| Carpeta | Qué es |
|---|---|
| `v0.7/` | Copia del visor Three.js v0.7: referencia, código reutilizable y datos ya procesados. Para arrancarlo: `npm install` y `npm run dev` |
| `pipeline/coords.py` | Conversión exacta EPSG:25831 ↔ lon/lat (series de Krüger, error < 1 mm) y origen común de la isla |
| `pipeline/preparar_cesium.py` | Genera `cesium/data/es-castell.js` a partir del Catastro (original, solo lectura) y de los datos de v0.7 |
| `pipeline/exportar_glb.mjs` | Genera modelos detallados (GLB) con el código de v0.7: fachadas, tejados y torre. Necesita `npm install` en `v0.7` |
| `cesium/` | Visor nuevo: intro nocturna de Menorca, vuelo a Es Castell, edificios, faros y ficha por edificio |

## Abrir el visor
Basta con hacer doble clic en `cesium\index.html`. Necesita internet, porque CesiumJS y la ortofoto se cargan en directo.

Si el navegador bloquea algo al abrirlo como archivo, sírvelo con un servidor local desde `cesium\`, con `python -m http.server 8080` o con `npx vite`, y abre `http://localhost:8080`.

Para regenerar los datos, ejecuta desde esta carpeta:
```
python pipeline/preparar_cesium.py
```
Por defecto lee `..\menorca3d\menorca3d\data\raw\catastro\*buildingpart*.gml`. Necesita numpy.

## Modelos detallados (texturas de v0.7)
En la zona detallada de v0.7 (Santa Anna, casco, Explanada y Sol del Este, unos 1,8 × 1,8 km), los volúmenes simples se sustituyen por los edificios que genera el código de v0.7, sin cambios:
- 5 estilos de fachada.
- Colores medidos en tus fotos.
- Tejados de teja o terraza.
- Cuarteles y Ayuntamiento en rojo, con la torre del reloj.

Las ventanas, persianas y molduras las dibuja `cesium/js/facade.js`, un port del shader de v0.7.

**Detalle de calle (capa `calle`):** generado por `v0.7/src/world/streetDetail.js`, sin cambios.
- **Pavimentos:** calzadas de asfalto, o de adoquín junto a la Explanada.
- **Aceras con bordillo:** losa de rombos en las urbanizaciones y baldosa roja en el casco.
- **Plazas:** losa de plaza.
- **Muros:** de piedra seca con albardilla, tapias, vallas y setos.
- **Escaleras:** con barandilla.
- **Mobiliario:** farolas de globo, de brazo y de plaza; árboles de alcorque y bancos.

Trazados REALES (OSM); materiales, alturas y posiciones del mobiliario ESTIMADOS o PROCEDURALES, igual que en v0.7. En la zona detallada, el relieve del visor queda 25 cm por debajo del MDT para que el pavimento no quede tapado por el terreno.

**Ver los modelos.** Necesitan un servidor local, porque el navegador no carga archivos .glb abriendo el HTML con doble clic. Desde la carpeta `cesium`:
```
python -m http.server 8080
```
Después abre http://localhost:8080.

**Resto del municipio (`municipio`, `municipio_calle`):**
- `pipeline/preparar_extension.py` ejecuta la misma cadena de v0.7 (OSM → `catastro_volumenes.py` → `aceras_estimadas.py`) sobre todo el municipio.
- Descarta lo que ya está en la zona detallada y lo que cae fuera de Es Castell.
- No hay fotos propias de esas zonas, así que llevan los estilos residenciales medidos en las fotos de Santa Anna (ESTIMADO).
- Con eso, todas las piezas del Catastro de Es Castell (7.231) tienen fachada y tejado.

**Cambios en la copia `v0.7/` de esta carpeta** (el proyecto original no se toca):
- **Ayuntamiento** (según tu foto y el fotograma 18/): azotea con pretil blanco y remates, en vez de tejado de teja; torre con cuerpo del reloj, balaustrada, linterna y veleta. Medidas ESTIMADAS.
- **Cales Fonts:** recibe el estilo del casco. Centro y radio ESTIMADOS a partir de los nombres de calle.
- **`tools/geolocal.py`:** conversión UTM → local exacta (antes, ajuste afín válido solo a ±1,5 km).

**Compresión:** vértices indexados y `KHR_mesh_quantization` (posición en 16 bits, unos 7 mm; normales y colores en 8 bits). Cada bloque de 300 m lleva su propio origen, para que la curvatura de la Tierra no lo levante.

| Capa | Antes | Ahora |
|---|---|---|
| Edificios de la zona detallada | 29,7 MB | 15,1 MB |
| Calle de la zona detallada | 42 MB | 12,2 MB |
| Resto del municipio | — | 10,5 MB (edificios) + 29,2 MB (calle) |

**Regenerar** (desde esta carpeta, con `npm install` hecho en `v0.7`):
```
python pipeline/preparar_cesium.py
python pipeline/preparar_extension.py
node pipeline/exportar_glb.mjs --zona
node pipeline/exportar_glb.mjs --zonefile data/extension/zona_municipio.json --name municipio
```

## Datos del IDE Menorca (Consell Insular)
El IDE Menorca (https://ide.cime.es) publica con licencia **CC BY 4.0** la cartografía 1:5.000 del Consell y el modelo de elevaciones de toda la isla. Todo se descarga con un solo comando (necesita internet; solo usa Python estándar):

```
python pipeline/descargar_ide_menorca.py                 # capas de Es Castell + relieve de toda la isla a 10 m
python pipeline/descargar_ide_menorca.py --resolucion 5  # relieve a la resolución nativa (unos 240 MB)
python pipeline/preparar_terreno_isla.py                 # genera cesium/data/isla.js con ese relieve
```

Se guarda en `data/raw/ide_menorca/` (GeoJSON, EPSG:25831) y `data/raw/mdt_isla/`:

| Capa | Qué es | Uso previsto en el visor |
|---|---|---|
| re007urb_vorera | Aceras reales | Sustituye a las aceras ESTIMADAS de v0.7 |
| re007urb_carrer | Superficie de calle | Calzadas con su ancho real |
| re007urb_escala, re007urb_porxo | Escaleras y porches | Detalle de calle |
| re007urb_constru | Construcciones (tipo y planta) | Contraste con el Catastro |
| re007urb_arbres, jardins, zverda | Árboles (posición real), jardines, zonas verdes | Vegetación REAL en lugar de procedural |
| re007urb_piscina | Piscinas | Láminas de agua |
| re007rus_parets5000 | Paredes secas | Las «parets seques» del campo |
| re007urb_cotes, portals, illaurb | Cotas, números de portal, manzanas | Control de altura, búsqueda por dirección |
| MO007MDT_mde2007 (WCS) | Modelo de elevaciones 2007, 5 m, toda la isla | Relieve del visor fuera de Es Castell |

### Integración en el modelo (aceras, escaleras, porches, árboles y paredes)
```
python pipeline/preparar_ide.py                                                         # → data/ide/ide_local.json
node pipeline/exportar_glb.mjs --zona                                                   # zona detallada + calle
node pipeline/exportar_glb.mjs --zonefile data/extension/zona_municipio.json --name municipio
```
`preparar_ide.py` pasa las capas a coordenadas locales (conversión exacta de `coords.py`), se queda con lo que cae dentro de Es Castell y simplifica las paredes (Douglas-Peucker, 25 cm). El exportador las usa EN LUGAR de las estimaciones de v0.7 (con `--sin-ide`, vuelve a v0.7):

| Elemento | Qué es REAL (IDE) | Qué es ESTIMADO |
|---|---|---|
| Aceras (565) | Forma exacta, con huecos | Bordillo de 12 cm; material por zona (baldosa roja en el casco, losa gris junto a la Explanada, acera gris en el resto) |
| Escaleras (635) | Planta exacta | Peldaños de unos 17 cm. Subida según el relieve; si el relieve no la marca, hacia el edificio más cercano y 0,5 m en total |
| Porches (1.074) | Planta exacta; tipo porche o marquesina | Alto: 2,7 m el porche y 2,6 m la marquesina. Pilares en las esquinas que no tocan un edificio |
| Árboles (4.150) | Posición | Especie y tamaño: plátano junto a la Explanada, copa redonda en el resto. Alcorque si el árbol cae en una acera |
| Paredes (11.751) | Trazado; tipo (paret, muro de contención, bancal) | Alto y ancho. Acabado: tapia enlucida en el casco, piedra con albardilla en urbanizaciones, paret seca en el campo |

Los muros de OSM que coinciden con una pared del IDE se descartan, y también los escalones de OSM que caen sobre una escalera del IDE. Tamaño de los modelos de calle: calle 26,6 MB y municipio_calle 38,1 MB.

Atribución obligatoria (ya incluida en el visor cuando se usa el MDE o las capas): «Informació geogràfica de l'administració local de Menorca per mitjà del projecte IDE menorca. http://ide.cime.es».

## Relieve de toda Menorca
Sin `cesium/data/isla.js`, fuera de Es Castell el relieve es plano. Dos fuentes posibles (se pueden mezclar; donde se solapan gana la más fina):
- **IDE Menorca (recomendado):** `python pipeline/descargar_ide_menorca.py`, como arriba.
- **CNIG:** en https://centrodedescargas.cnig.es, «Modelos Digitales de Elevación» → **MDT25** o **MDT05**. Guarda las hojas (.tif o .asc) en `data\raw\mdt_isla\`.

Después: `python pipeline/preparar_terreno_isla.py` (paso de malla por defecto 40 m; se cambia con `--paso 25`). El lector admite GeoTIFF con ModelPixelScale/Tiepoint (CNIG) o ModelTransformation (WCS del IDE), sin dependencias extra para TIFF sin comprimir. Probado con una hoja MDT de 50 cm del IGN (coincide con v0.7 con menos de 0,5 m de diferencia) y con GeoTIFF sintéticos en el formato exacto del WCS del IDE.

## Coordenadas
- **Trabajo:** ETRS89 / UTM 31N (EPSG:25831), el sistema nativo del Catastro y del MDT.
- **Visor:** lon/lat ETRS89, tratado como WGS84 (la diferencia es de centímetros).
- **Edificios:** se reproyectan exactamente desde el GML del Catastro.
- **Calles, frontera, relieve y faros:** vienen de v0.7, que los guardaba en su proyección local (x = este, z = sur, con origen en Es Castell). Se devuelven a lon/lat con la inversa de esa proyección. Error medido: 0,1 m a 500 m del origen, 0,3 m a 1,5 km, 1,3 m a 3 km y 3 m a 4,5 km. Para eliminarlo, en adelante se procesarán desde la fuente original.
- **Alturas:** ortométricas del MDT del IGN, usadas tal cual como altura del visor. Es coherente mientras todo el relieve salga de ese MDT. Si se mezcla con un terreno elipsoidal (Cesium World Terrain, teselas de terceros), habrá que sumar la ondulación del geoide: unos 50 m en Menorca, valor aproximado pendiente de verificar.
- **Origen local de la isla** (para Three.js o WorldMirror): E 590000, N 4420000 (EPSG:25831). Está en `pipeline/coords.py`.

## Estado de cada dato
| Elemento | Estado | Fuente |
|---|---|---|
| Ortofoto | REAL | PNOA máxima actualidad, WMTS del IGN, licencia CC BY 4.0 (scne.es) |
| Relieve de Es Castell | REAL | MDT 50 cm del IGN remuestreado a 10 m (v0.7) |
| Relieve del resto de la isla | PLACEHOLDER hasta generar `cesium/data/isla.js` | MDE 2007 del IDE Menorca o MDT del IGN (ver «Relieve de toda Menorca») |
| Huella y plantas de edificios | REAL | Catastro INSPIRE, 7.231 piezas |
| Altura de edificios | ESTIMADA | 3 m por planta |
| Color de edificios y ventanas encendidas | PROCEDURAL | Paleta medida en las fotos propias (v0.7) |
| Faros y luces | REAL | OSM: posición, color y ritmo. Los faros principales sin datos en OSM llevan ritmo ESTIMADO |
| Haz giratorio, farolas cada 28 m | PROCEDURAL | — |
| Frontera del municipio | REAL aproximada | Unión de parcelas catastrales (v0.7) |

## Carga y efectos del visor
- **Pantalla de carga:** se quita cuando la isla ya está completa (relieve, ortofoto y mar), con un máximo de 15 s, para que no se vean teselas de baja resolución apareciendo y desapareciendo.
- **Modelos, carga por cercanía:** no se piden al abrir la página. Empiezan 1,5 s después de que aparezca la isla, o al pulsar «Entrar». Abajo, en el centro, se ve el progreso.
  - **Edificios:** se cargan todos, porque se ven desde lejos, del bloque más cercano al punto al que mira la cámara al más lejano. Se dibujan hasta 25 km.
  - **Detalle de calle (aceras, árboles, muros…),** el 70 % del peso: solo los bloques a menos de 900 m del punto al que mira la cámara, y con la cámara a menos de 4 km de altura. Al alejarse, se quitan de memoria y se vuelven a pedir al volver.
- **Modo ligero:** se activa solo en móviles, tablets, televisores y equipos con poca memoria. Dibuja a menos resolución, con menos teselas y sin suavizado de bordes, carga 3 modelos a la vez en vez de 6 y el detalle de calle solo a 600 m. Se fuerza con `?ligero=1` al final de la dirección y se quita con `?ligero=0`.
- **Mar:** lámina animada con oleaje PROCEDURAL (material «Water» de Cesium) a 0 m. Bajo ella, el relieve del mar se hunde 4 m para que no haya parpadeos.
- **Haz de los faros:** de 1,2 a 5 km de largo. Se apaga por debajo de 1,5 km de altura de cámara y se ve entero a partir de 6 km.

## Minimapa, mapa de edificios y día/noche
- **Minimapa** (arriba a la derecha, al entrar en Es Castell): se orienta con la cámara, de modo que arriba es hacia donde miras, y el zoom depende de la altura. **Doble clic** o la tecla **M** abren el mapa de edificios.
- **Mapa de edificios** (como en v0.7): norte arriba, cada parcela con su número de v0.7, que es estable, todas en el mismo color neutro. Las parcelas de fuera de esa zona llevan un número provisional.
  - **Clic en una parcela:** ficha con la referencia catastral, enlazada a la Sede del Catastro.
  - **Buscador:** por número o por referencia.
  - **«Ir delante»:** la cámara 3D vuela al edificio.
- **Día/noche:** al abrir, sigue la hora real de Menorca, calculada con la altura del sol en Es Castell. El botón muestra el modo actual y se puede cambiar a mano, en cuyo caso pone «(manual)». Al salir o ponerse el sol vuelve solo a la hora real. Al pasar el ratón por el botón se ven las horas de salida y puesta del sol de hoy.

## Capas, servicios y bus L02
- **Capas** (botón bajo el minimapa, al estilo del IDE Menorca):
  - Servicios;
  - Ruta del bus L02;
  - Detalle de calle;
  - Frontera del municipio;
  - Faros y luces;
  - Mar animado.
- **Servicios** (`cesium/data/servicios.js`): al hacer clic en un icono se abre su ficha con dirección, teléfono, horario y si está abierto ahora (según la hora del ordenador; no cuenta festivos).

  | Servicio | Horario | Fuente |
  |---|---|---|
  | Ajuntament des Castell | SAC: lunes a viernes, 8:30–14:00 | aj-escastell.org |
  | Parròquia del Roser | Misas de invierno: lunes a sábado 19:30, domingo 10:30 | bisbatdemenorca.org |
  | Policia Local | Teléfono 971 36 27 47 | aj-escastell.org |
  | Biblioteca | Lunes a viernes, 9–14 y 16–20 | aj-escastell.org |
  | Correus | Lunes a viernes, 8:30–14:30 | horarioscorreos.com |
  | Unitat Bàsica de Salut | Sin horario publicado: cita previa en IB-Salut | caib.es |
  | Hospital Mateu Orfila | Urgencias 24 h | infohospitales.com |
  | Parada de bus Església des Castell | Horarios de la L02 | tmsa.es |

  Posiciones de OpenStreetMap; la de la parada, de TMSA.
- **Bus L02 Maó – Es Castell** (`cesium/data/bus_l02.js`, datos de tmsa.es copiados el 13-10-2026 y vigentes hasta el 31-05-2027): paradas, recorrido de los dos sentidos y horarios de lunes a viernes, sábados y domingos y festivos.
  - **Al hacer clic en la parada** (en su icono o en la marquesina 3D, delante de la iglesia): se ven los próximos autobuses, la ruta en el mapa y las tablas completas.
  - **Autobuses en directo:** abre el visor con `python pipeline/servidor.py` en lugar de `python -m http.server`. Es igual, pero añade un pequeño proxy hacia la web de TMSA, que no deja pedir la posición directamente desde el navegador.
  - **Sin ese proxy** (por ejemplo, en la web publicada en GitHub Pages): el visor muestra la posición **ESTIMADA según el horario**. Calcula, para cada expedición en ruta, el punto del recorrido que corresponde a la hora actual, entre qué paradas va y cuándo llega a Es Castell. No tiene en cuenta retrasos y se marca como «≈ … estimado».
  - **Para tener la posición real también en la web**, basta con un intermediario en la nube (por ejemplo, un Worker de Cloudflare que haga lo mismo que `servidor.py`) y definir su dirección antes de `js/servicios.js`: `window.MENORCA_BUS_DIRECTO = 'https://…/posicion/602/{sentido}'`.
  - **Si TMSA cambia horarios:** hay que actualizar `bus_l02.js`.
- **Marquesina de la parada:** modelo 3D en `v0.7/src/buildings/church.js` (`busShelter`). La posición es la de TMSA; la forma, ESTIMADA.
- **Girar la cámara:** botones ⟲ ⟳ (mantener pulsado) y N (mirar al norte) bajo el minimapa, o las teclas Q y E.
- **Ortofoto:** de cerca, PNOA del IGN (WMTS). De lejos, la ortofoto del Govern balear (IDEIB, Orto 2024), porque el WMTS del IGN sirve hasta el nivel 13 un mosaico de satélite de otro color, y se notaba el cambio al acercarse.

## Novedades del 13-10-2026 (noche)
- **Ruta del bus:** el tramo de la L02 dentro de Es Castell se ve siempre (capa activa por defecto). Al abrir la ficha de cualquier parada se ve la ruta completa hasta Maó. Las líneas van 1,5 m por encima del relieve, en lugar de pegadas al suelo.
- **Paradas:** todas las paradas de la L02 dentro del municipio tienen icono y ficha con sus horarios: Església des Castell, Fontanelles, Son Vilar-1 y Son Vilar-2.
- **Servicios:** la capa empieza activa.
- **Relieve de la isla:** se recorta por la línea de costa de OSM (`preparar_terreno_isla.py --costa`). El MDE 2007 traía triángulos sueltos sobre el mar que se veían como franjas.
- **Menú:** botón «Ver la isla sin menú» y «☰ Menú» para volver a mostrarlo.
- **Alejamiento máximo:** 80 km; la vista inicial es de 62 km.
- **Acercamiento máximo:** 25 m del suelo.
- **Abajo a la izquierda:** se indica qué ortofoto y qué relieve se están dibujando en ese momento.
- **Logotipo de Cesium:** oculto. Los créditos de los datos (CC BY) siguen en «Data attribution».

## Novedades del 14-10-2026
- **Menú inicial:** botón ✕ para cerrarlo; hace lo mismo que «Ver la isla sin menú».
- **Acercamiento antes de entrar:** hasta 1,5 km del suelo; se ve el municipio entero y la ciudad en 3D. Al entrar en Es Castell, hasta 25 m. Se cambia en `ZOOM_MIN` (`cesium/js/app.js`).
- **Molino (edificio nº 120, `v0.7/src/buildings/molino.js`):**
  - REAL: posición y tamaño de la torre, del círculo de la huella del Catastro y de la ortofoto PNOA.
  - ESTIMADO a partir de las fotos de referencia:
    - torre blanca de unos 11 m;
    - cubierta cónica con gajos rojos y blancos;
    - 6 aspas de celosía con palo de proa y cables, orientadas al NNE;
    - puerta elevada con escalera, al ONO;
    - plataforma circular de pared seca;
    - terraza blanca.
- **Campo de fútbol de la Zona Deportiva Sergio Llull (nº 116, `v0.7/src/buildings/campoFutbol.js`):**
  - REAL: contorno del césped de OSM, que coincide con la ortofoto.
  - ESTIMADO:
    - césped artificial con franjas;
    - líneas reglamentarias;
    - porterías;
    - barandilla;
    - redes detrás de las porterías;
    - 6 torres de focos de 18 m.
- Regenerado con `node pipeline/exportar_glb.mjs --zona --sin-calle`. Solo cambian los `zona_*.glb`.
- **Museo Histórico Militar (nº 641):** en la capa «Servicios», con su horario: último sábado del mes y cerrado en enero y febrero.
- **Sa Farmàcia – Teresa Hernández Jansà (nº 642, `v0.7/src/buildings/farmacia.js`):**
  - En «Servicios»: horario, teléfono, correo y enlace a safarmacia.com.
  - En 3D, según las fotos de referencia:
    - escaparates con marco blanco y zócalo morado;
    - pilares color melocotón;
    - rótulos «Farmàcia», con textura de `pipeline/textura_rotulos.py`;
    - cruz verde luminosa;
    - plaza de aparcamiento pintada.
- **Luces de noche (`cesium/js/luces.js`, con datos de `cesium/data/luces.js` que escribe `exportar_glb.mjs --zona`):**
  - **Campo de fútbol:** los 6 focos se encienden de noche hasta las 00:00, y de 00:00 a 07:00 están apagados. Se ve el brillo de cada proyector, un cono de luz hacia el campo y el césped iluminado.
  - **Farmacia:** halo verde en la cruz y luz verde en la acera, toda la noche.
- **Carrer Fontanilles (`v0.7/src/buildings/fontanilles.js`, a partir de fotos de referencia):**
  - **nº 35 y 59:** franjas color salmón en cada forjado, galerías acristaladas con carpintería oscura, alero de teja y zócalo beige en la fachada de la calle.
  - **Farmàcia Alicia Quesada (C/ Fontanilles 47, planta baja del nº 35):**
    - en 3D: rótulo blanco «FARMACIA» en verde, puertas de cristal, ventana con reja y cruz verde;
    - en «Servicios»: ficha con el horario de un directorio de farmacias;
    - de noche: halo verde.
  - **nº 84:** marés visto con esquinas dentadas blancas.
  - **nº 65:** blanco con tejado de teja.
  - Los colores de pared van en `ajustes_edificios.json`.
- **Conjunto nº 1061 (`v0.7/src/buildings/casa1061.js`, a partir de fotos de referencia):**
  - **Planta baja:** continua con la casa vecina; el hueco se rellena solo en planta baja.
  - **Fachada trasera, en dos cuerpos:**
    - el tejadillo, el toldo, el balcón y su barandilla acaban en la línea entre los dos cuerpos;
    - las puertas y ventanas del sombreado general quedan tapadas: solo están las de las fotos.
  - **Jardín:** pared seca baja (0,6 m) con malla verde encima hasta 1,5 m; la barbacoa está por dentro, pegada a la pared.
  - **Pared del IDE:** el tramo que rodea el jardín se quita del detalle de calle (`recortaParedesIDE`) y se dibuja aquí.
  - **Paso a la calle:** verja.
  - **Pared del fondo del conjunto:** portón.
- **Caché:** los modelos llevan `?v=<huella>` en `zona.js`, y `servidor.py` envía `Cache-Control: no-cache`. Así, al regenerar, el navegador no usa modelos viejos.

## Casas retocadas a mano (Menorca3D Forge)
> [!IMPORTANT]
> Repositorio de Forge: **[AitorSantaeugenia/menorca3D-Forge](https://github.com/AitorSantaeugenia/menorca3D-Forge)** · [Probarlo online](https://aitorsantaeugenia.github.io/menorca3D-Forge/app/) (con código de acceso) · [Descargar MenorcaForge.zip](https://github.com/AitorSantaeugenia/menorca3D-Forge/releases/latest/download/MenorcaForge.zip) (Windows)

`..\menorca3d_v2_forge` es un editor para corregir casas una a una. Se abre con doble clic en `iniciar.bat`; se busca la casa por número o referencia catastral, se edita y se pulsa «Enviar a Menorca3D».
- Guarda cada casa en `menorca3d_v2\casas\<REF>.forge.json`.
- `pipeline/exportar_glb.mjs` lee esa carpeta. Para cada referencia editada, usa la casa de Forge **en lugar de** la generada por v0.7.
  - Va en los mismos bloques `zona_*.glb` / `municipio_*.glb`, con los mismos materiales y el mismo shader de fachada.
  - `--sin-forge` exporta como antes; `--forge <carpeta>` usa otra carpeta.
- El detalle de calle sigue esquivando la huella del Catastro de las casas editadas.

## Limitaciones conocidas
- No hay modo a pie ni personaje; eso sigue en v0.7.
- Fuera de la zona detallada de Es Castell, los edificios no tienen fachadas detalladas.
- No hay teselas 3D (3D Tiles) todavía: los modelos se cargan por bloques de 300 m.

## Siguientes pasos propuestos
1. Calzadas con su ancho real (re007urb_carrer), piscinas y jardines del IDE.
2. Edificios de los 8 municipios en 3D Tiles, con carga progresiva.
3. Piloto de HY-World 2.0: reconstrucción de una calle con las fotos propias, alineada con puntos de control del Catastro.
