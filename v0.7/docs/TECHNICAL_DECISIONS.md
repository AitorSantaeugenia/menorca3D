# Decisiones técnicas

## Motor: Three.js + Vite (JavaScript con módulos ES)
- **Three.js**: control total del renderizado, terreno propio, instancing y mallas fusionadas; encaja con un pipeline GIS propio procesado antes de llegar al navegador.
- **React Three Fiber**: útil para interfaces complejas, pero añade una capa que de momento no aporta; se puede incorporar más adelante para la UI sin tocar el núcleo.
- **Babylon.js**: muy completo, pero el encargo prioriza Three.js salvo razón técnica fuerte, y no la hay.
- **CesiumJS**: excelente para globo terráqueo y teselas 3D a gran escala, pero pesado para una experiencia de juego a pie y con estética propia. Candidato si algún día se usan 3D Tiles de toda la isla.
- **MapLibre**: adecuado para mapas 2D; podría sustituir al mapa de entrada propio más adelante.
- **Vite**: arranque rápido con `npm run dev`. Se usa JavaScript en lugar de TypeScript para reducir fricción inicial; migrar a TypeScript es directo.

## Coordenadas
Datos OSM en WGS84 y MDT en ETRS89 / UTM huso 31. Todo se convierte en las herramientas Python a metros locales con origen en la zona (x = este, z = sur, y = altura) para evitar problemas de precisión. ETRS89 y WGS84 se tratan como equivalentes (diferencia de centímetros).

## Terreno
MDT de 50 cm del IGN remuestreado a 5 m (media por bloques) y guardado en decímetros (Int16). Fondo marino fijado a −3 m fuera de la costa de OSM (PLACEHOLDER). Comprobado: la curva de 1 m coincide con la costa de OSM.

## Punto de inicio
«Entrada de Santa Anna» es ambiguo. Santa Anna se identificó por sus calles con nombres de vientos (Tramuntana, Gregal, Xaloc…) en OSM. Inicio provisional en Carrer Tramuntana (ESTIMADO), configurable en `src/config/destinations.js`.

## Rendimiento (estado actual y plan)
Ahora: una zona = un bloque (1,8 × 1,8 km), edificios fusionados en una malla, árboles con instancing, rejilla espacial para colisiones. Plan: dividir zonas en chunks de ~250 m con carga y descarga por distancia, LOD de terreno y edificios, y textura de suelo por teselas.

## Numeración de edificios
Unidad = parcela catastral (referencia de 14 caracteres, REAL), no la pieza (BuildingPart): es lo que se reconoce en la calle y en la Sede del Catastro. Los números se guardan en `edificios.json` y **nunca se reasignan**: al regenerar datos, `tools/numerar_edificios.py` conserva números y estados y solo añade los nuevos al final (los desaparecidos quedan con `baja`). Los edificios solo de OSM usan la clave `osm-x_z` (centro redondeado) y se emparejan por cercanía.
El estado (pendiente/acabado) se escribe en ese archivo mediante un middleware de `vite.config.js` que solo existe con `npm run dev` y solo acepta rutas `data/**/edificios.json`; si no está disponible, se guarda en `localStorage` y se puede exportar.
