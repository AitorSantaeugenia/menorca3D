# Referencias visuales

Uso: SOLO como referencia para diseñar materiales y reglas procedurales. No se copia ningún píxel de ninguna foto
dentro del juego: las texturas son PROCEDURALES (tools/generar_texturas.py) y solo toman los colores medidos.

## 1. Fotos propias (fuente principal)
Grabaciones propias con el móvil en calles residenciales de la urbanización (Santa Anna / Sol del Este), guardadas
FUERA del proyecto en `referencias_propias/1..6/frames/` (94 fotogramas). No se incluyen en el repositorio ni en la web:
contienen matrículas y números de portal.

### Paleta medida (mediana de cada recorte; entre paréntesis, tonos más oscuro y más claro)
Día nublado: los colores ya incluyen esa luz difusa.

| Material | Color | Rango | Fotograma de origen | Uso en el juego |
|---|---|---|---|---|
| Losa hidráulica de acera (relieve de rombos) | #a39790 | #938882 – #afa099 | 2/frame_000020 | textura `acera` |
| Losa de acera (sombra) | #897970 | #7f6e65 – #97837a | 6/frame_000006 | textura `acera` |
| Asfalto | #919494 / #7c746d | — | 2/frame_000020, 4/frame_000001 | textura `asfalto` |
| Bordillo | #8a8987 | — | 2/frame_000020 | bordillo de aceras |
| Piedra seca | #a5938a / #997a69 | #816e64 – #c2b3aa | 2/frame_000008, 3/frame_000004 | textura `piedra_seca` |
| Albardilla blanca de muros | #e4e2d5 | — | 3/frame_000004 | remate de muros de piedra urbanos |
| Pared blanca | #e6ecee (neutralizado a #e9ebe8) | — | 5/frame_000001 | fachadas y tapias |
| Tapia beige | #ba9d80 (aclarado a #c9ae90) | — | 1/frame_000010 | fachadas y tapias |
| Tapia salmón | #9e877b (en sombra; aclarado a #b9a091) | — | 2/frame_000022 | fachadas y tapias |
| Fachada gris verdosa | #87928b (aclarado a #9aa59e) | — | 3/frame_000003 | fachadas |
| Zócalo de lajas (aplacado) | #9a8f84 | #858278 – #aca092 | 2/frame_000019 | textura `aplacado` |
| Teja | #b7918e (luz nublada) | #9e7875 – #cfaaa6 | 3/frame_000006–07 | textura `teja`, saturación corregida (ESTIMADO) |
| Persiana verde azulada | #2a4552 | — | 5/frame_000003 | persianas |
| Puerta / persiana verde | #2d614f | — | 2/frame_000014 | persianas y puertas |
| Seto | #424b2d | — | 4/frame_000006 | setos |
| Malla de ocultación verde | #437773 | — | 1/frame_000023 | (pendiente) |

### Elementos observados → aplicados
- Aceras de **losa hidráulica rojiza con relieve de rombos** y bordillo gris en casi todas las calles → aceras estimadas
  también en las urbanizaciones.
- **Muros de piedra seca** con albardilla enlucida blanca en zona urbana; piedra vista en el campo.
- Fachadas **blancas** mayoritarias; también beige, salmón y gris verdoso. **Zócalos de lajas** de piedra gris.
- **Persianas mallorquinas** verdes, verde azuladas o blancas; puertas en arco con hoja verde.
- **Farolas** de poste gris galvanizado con farol en la parte alta.
- **Barandillas de acero inoxidable** en las escaleras.
- **Vegetación**: palmeras canarias, pinos, cipreses, árboles de copa redonda (acebuche, cítricos) y setos altos.
- Líneas amarillas de prohibido aparcar junto al bordillo (pendiente: OSM no indica dónde están).

## 2. Otras fuentes
| Fuente | Qué aporta | Licencia | Uso |
|---|---|---|---|
| Wikimedia Commons («EsCastell - Ajuntament.jpg») | Ayuntamiento y Explanada | Dominio público (según el archivo) | Referencia |
| Mapillary | Fotos a pie de calle | CC BY-SA 4.0 | Sin cobertura útil en estas calles |
| Guías turísticas y prensa (Barceló, Baleària, menorca.info) | Arquitectura georgiana del casco, Ayuntamiento rojo con recercados blancos | Copyright | Solo hechos, sin reutilizar fotos |
| Google Street View, Shutterstock | — | No reutilizables | Descartadas |

## 1b. Fotos propias, carpetas 7–26 (casco de Es Castell y Explanada) — v0.4
Recorridos a pie por Santa Anna, el casco y la Explanada. Mismo uso: solo referencia de color y forma; las fotos
no se publican ni se incluyen en el proyecto (contienen matrículas y números de portal).

| Elemento | Color medido | Frames de referencia |
|---|---|---|
| Rojo cuarteles de la Explanada | `#82233f` | 17/1, 18/3 |
| Rojo Ayuntamiento | `#912033` | 19/4 |
| Fachada ocre | `#bda67a` | 24/3 |
| Fachada coral / salmón | `#cb947e` | 20/4 |
| Fachada magenta | `#825265` | 15/12 |
| Fachada granate | `#6f1c2d` | 24/2 |
| Sillarejo de marès visto | `#978679` | 18/1 |
| Losa de la plaza (oscura / clara) | `#aaa4a0` / `#c3b5aa` | 17/13 |
| Baldosa roja de acera del casco | `#9b8788` | 9/1 |
| Adoquín gris de calzada | `#aba59c` | 16/11 |
| Persiana verde del casco | `#2e636a` | 20/2 |
| Persiana azul del casco | `#354657` | 13/4 |
| Persiana verde-gris Santa Anna | `#4b6776` | 8/13 |

### Elementos observados → aplicados (v0.4)
- **Cuarteles y Ayuntamiento**: rojo con **esquinas de sillares dentadas** blancas, zócalo y cornisa blancos, carpintería verde; tejado a cuatro aguas.
- **Torre del reloj** del Ayuntamiento (forma y colores según fotos; posición ESTIMADA).
- **Explanada**: losas grandes grises en hilada, farolas altas en el perímetro, plátanos de sombra en cuadrícula y bancos.
- **Casco**: fachadas mayoritariamente blancas con recercados de **arco rebajado**, cornisa y a veces pilastras blancas;
  zócalo oscuro o de piedra; balcones con barandilla; persianas verdes y azules; algunas fachadas de sillarejo de marès.
- **Pavimento**: adoquín gris cerca de la Explanada; aceras de baldosa roja en el casco; asfalto en el resto.
- **Farolas de brazo** sujetas a la fachada en el casco; de globo blanco en las urbanizaciones.
- **Santa Anna**: alero de teja con remate dentado bajo el tejado; persianas verde-gris.

## 3. Pendiente
- Cales Fonts y el puerto (barcas, muelles, terrazas).
- Posición real de farolas, árboles y bancos (OSM no los tiene mapeados en la zona).
