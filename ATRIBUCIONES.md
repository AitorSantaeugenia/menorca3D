# Atribuciones y licencias

Menorca3D combina **código propio** (licencia MIT, ver `LICENSE`) con **datos públicos de terceros**, que conservan su licencia. Para publicarlo hay que citar cada fuente. El visor ya muestra los créditos en «Data attribution», abajo a la derecha.

## Datos geográficos
| Fuente | Qué se usa | Licencia | Atribución |
|---|---|---|---|
| Dirección General del Catastro (INSPIRE Buildings y CadastralParcels, municipio 07064) | Huellas, patios y plantas de las 7.231 piezas; frontera aproximada del municipio | Reutilización libre con cita de la fuente | «Fuente: Dirección General del Catastro» |
| IDE Menorca, Consell Insular de Menorca (ide.cime.es) | Aceras, calles, escaleras, porches, árboles, jardines, piscinas, paredes secas, portales, MDE 2007 | CC BY 4.0 | «Informació geogràfica de l'administració local de Menorca per mitjà del projecte IDE menorca. http://ide.cime.es» |
| Instituto Geográfico Nacional / CNIG (scne.es) | MDT de 50 cm; ortofoto PNOA máxima actualidad (WMTS y WMS) | CC BY 4.0 | «© Instituto Geográfico Nacional» / «PNOA cedido por © Instituto Geográfico Nacional» |
| IDEIB, Govern de les Illes Balears | Ortofoto 2024 (vista lejana) | Licencia abierta del Govern con atribución (comprobar el texto exacto en ideib.caib.es) | «© IDEIB – Govern de les Illes Balears» |
| OpenStreetMap | Calles, costa, plazas, edificios con nombre, faros, comercios y servicios | ODbL 1.0 | «© colaboradores de OpenStreetMap» (openstreetmap.org/copyright) |
| TMSA (tmsa.es) | Paradas, recorrido y horarios de la línea L02 (copiados el 13-10-2026) | Información pública del operador | Se cita la fuente en la ficha del bus |
| Webs municipales y de cada servicio (aj-escastell.org, bisbatdemenorca.org, safarmacia.com…) | Dirección, teléfono y horario públicos de los servicios | Información pública | Enlace a la fuente en cada ficha |

## Software de terceros
| Biblioteca | Uso | Licencia |
|---|---|---|
| CesiumJS 1.141 (CDN jsDelivr) | Visor 3D del globo | Apache 2.0 |
| three.js 0.169 | Generación de modelos (v0.7) y Menorca3D Forge | MIT |
| Vite 5 | Servidor de desarrollo de v0.7 | MIT |

## Recursos propios
- **Texturas:** las genera `v0.7/tools/generar_texturas.py` (piedra seca, estuco, teja, etc.), y los rótulos y la sillería los generan `pipeline/textura_*.py`. Se publican con la licencia MIT del proyecto.
- **Colores, formas de fachada y casas retocadas a mano:** son trabajo propio basado en fotos personales. **Las fotos no se publican** (`imageRefs/` está fuera del repositorio).

## Lo que es aproximado
Muchos elementos son **ESTIMADOS** o **PROCEDURALES**: alturas a 3 m por planta, colores, ventanas, mobiliario urbano, especies de árboles… La tabla «Estado de cada dato» del README lo detalla. El modelo es una reconstrucción divulgativa y **no tiene validez oficial**: no sirve para medir, ni para trámites, ni para saber el estado real de un inmueble.
