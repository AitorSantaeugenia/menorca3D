// Sistema de destinos. Para añadir una zona: generar sus datos con /tools y añadir una entrada aquí.
// Estado de cada dato: REAL (de una fuente) · ESTIMADO · PROCEDURAL · PLACEHOLDER (ver docs/DATA_SOURCES.md)
export const DESTINATIONS = {
  'menorca/es-castell/santa-anna': {
    id: 'menorca/es-castell/santa-anna',
    island: 'Menorca', municipality: 'Es Castell', settlement: 'Es Castell',
    coordinates: { lat: 39.8803, lon: 4.2908 }, // Ayuntamiento (OSM)
    data: '/data/menorca/es-castell/santa-anna/zone.json',
    ground: '/data/menorca/es-castell/santa-anna/ground.png',
    // Inicio: delante del Ayuntamiento (Ajuntament des Castell, punto REAL de OSM). El juego coloca al personaje
    // en la calle más cercana mirando al edificio. Coordenadas locales de la zona (metros).
    start: { name: 'Ayuntamiento', x: -112.1, z: -453.1 },
    dataSources: ['OpenStreetMap (ODbL)', 'MDT 50 cm © Instituto Geográfico Nacional'],
  },
};
export const DEFAULT_DESTINATION = 'menorca/es-castell/santa-anna';
// Menú de selección (isla → municipio → zona). Preparado para añadir Maó, Ciutadella...
export const MENU = [
  { name: 'Es Castell', coordinates: { lat: 39.8786, lon: 4.2900 }, children: [{ name: 'Es Castell', dest: 'menorca/es-castell/santa-anna' }] },
];
// Pantalla de inicio: toda la isla con Es Castell modelado (tools/preparar_municipio.py). Marca en el Ayuntamiento.
export const INTRO = { name: 'Es Castell', data: '/data/menorca/es-castell/municipio.json', marks: [{ name: 'Es Castell', x: -112.1, z: -453.1 }] };
export const ISLAND_VIEW = { name: 'Menorca', lat: 39.95, lon: 4.06, span: 0.62 }; // vista general aproximada
