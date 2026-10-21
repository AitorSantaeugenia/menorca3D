# Menorca3D en GitHub: publicación y colaboración

Todo lo necesario para publicar los dos proyectos en GitHub y para que otras personas ayuden a modelar casas.

| Repositorio | Carpeta local | Contenido |
|---|---|---|
| **menorca3d_v2** (público) | `Escritorio\menorca3d_v2` | El visor de la isla, el pipeline, los datos procesados y las casas editadas (`casas/`) |
| **menorca3d_forge** (público) | `Escritorio\menorca3d_v2_forge` | El editor de casas y el empaquetador del .exe para colaboradores |

## 1. Proceso de subida (a mano, con GitHub Desktop)
Se sube **primero menorca3d_v2** y después Forge, porque el workflow que crea el .exe de Forge descarga menorca3d_v2 desde GitHub.

### Fase 0 · Preparación (una sola vez)
1. **Cuenta y programa:** crea una cuenta en github.com si no la tienes, instala GitHub Desktop (desktop.github.com) e inicia sesión con ella («File → Options → Accounts»).
2. **Mueve los workflows**, en **cada** proyecto (`menorca3d_v2` y `menorca3d_v2_forge`):
   1. crea la carpeta `.github`, y dentro, `workflows`. Si el Explorador no deja crear un nombre que empieza por punto, escribe `.github.` con un punto también al final: Windows lo quita;
   2. mueve ahí el `.yml` de `flujos_github`;
   3. borra la carpeta `flujos_github`.
3. **Opcional:** en los dos `LICENSE`, cambia «Autores de Menorca3D» por tu nombre o alias.

### Fase 1 · Repositorio menorca3d_v2
1. GitHub Desktop: «File → Add local repository…» → elige `Escritorio\menorca3d_v2`. Saldrá «This directory does not appear to be a Git repository»: pulsa **«create a repository»**.
2. En la ventana de creación:
   - Name: `menorca3d_v2`;
   - **Git ignore: None**, **License: None** y **sin** «Initialize this repository with a README», porque los tres ya existen;
   - pulsa «Create repository».
3. **Comprueba la pestaña «Changes» antes de confirmar nada.**
   - Deben aparecer: `.github`, `casas`, `cesium` (sin `models`), `data` (sin `raw`), `pipeline`, `v0.7` (sin `node_modules`), `README.md`, `GITHUB.md`, `ATRIBUCIONES.md`, `LICENSE` y `.gitignore`.
   - **No** deben aparecer: `imageRefs`, `_copias`, `data/raw`, `cesium/models`, `cesium/assets/textures`, `casas/historial` ni `node_modules`. Si alguno aparece, para y revisa `.gitignore`.
4. Abajo a la izquierda, en Summary, escribe «Primera versión» → **«Commit to main»**.
5. **«Publish repository»** → **desmarca «Keep this code private»** → «Publish repository».
6. **Activar la web.** En github.com, en el repositorio: «Settings → Pages → Build and deployment → Source: **GitHub Actions**».
7. **Primera publicación.** Pestaña «Actions» → «Publicar visor» → «Run workflow». La primera ejecución, la de la subida, falla si Pages aún no estaba activado; es normal. Tarda unos minutos. Al acabar, el visor está en `https://<usuario>.github.io/<repositorio>/cesium/` (la dirección principal redirige ahí).

### Fase 2 · Repositorio menorca3d_forge
1. GitHub Desktop: «File → Add local repository…» → `Escritorio\menorca3d_v2_forge` → «create a repository». Pon de nombre `menorca3d_forge` (el nombre en GitHub puede ser distinto del de la carpeta), con Git ignore None, License None y sin README.
2. **Comprueba «Changes».**
   - Deben aparecer: `.github`, `app`, `empaquetar`, `iniciar.bat`, `servidor.cjs`, `servidor.mjs`, `package.json`, `package-lock.json`, `forge.config.ejemplo.json`, `README.md`, `LICENSE` y `.gitignore`.
   - **No** deben aparecer: `node_modules`, `dist`, `casas`, `integracion` ni **`forge.config.json`**, que lleva el enlace del formulario.
3. «Primera versión» → «Commit to main» → «Publish repository», con «Keep this code private» **desmarcado**.
4. En github.com, en el repositorio de Forge: «Settings → Secrets and variables → Actions → pestaña Variables → New repository variable». Crea dos:
   - `REPO_V2` = `<usuario>/menorca3d_v2`;
   - `FORMULARIO_URL` = el enlace rellenado previamente del formulario. Está en tu `forge.config.json`; cópialo sin las comillas.
5. **Primera versión del .exe para colaboradores:**
   1. en github.com, en el repositorio de Forge: «Releases → Draft a new release»;
   2. en «Choose a tag» escribe `v0.1` → «Create new tag»;
   3. pon de título «Menorca3D Forge 0.1» → «Publish release».

   El workflow «Construir .exe» crea `MenorcaForge.zip` en un servidor Windows y lo adjunta a esa versión en unos minutos. El enlace que mandas a los colaboradores es `https://github.com/<usuario>/menorca3d_forge/releases/latest`.

### Fase 3 · Día a día
| Qué ha pasado | Qué haces |
|---|---|
| Has aceptado una propuesta o editado una casa | Forge → «Enviar a Menorca3D» (lo ves en local). En GitHub Desktop, repositorio `menorca3d_v2`, verás `casas/<REF>.forge.json` en «Changes»: commit («Casa nº 1061: propuesta de …») → «Push origin». La web se actualiza sola en unos minutos |
| Cambias código del visor o del pipeline | Igual: commit + «Push origin» en `menorca3d_v2` |
| Mejoras Forge | Commit + «Push origin» en `menorca3d_forge`. Para que los colaboradores tengan la mejora, crea una release nueva (`v0.2`, `v0.3`…) y se genera otro zip |
| Cambias el formulario y su enlace | Actualiza `forge.config.json` (local) y la variable `FORMULARIO_URL` (GitHub), y crea una release nueva |

Si algo falla en GitHub, la pestaña «Actions» de cada repositorio muestra el registro de cada ejecución. Ahí se ve el error.

## 2. Qué se sube y qué no (menorca3d_v2)
| Carpeta / archivo | ¿Se sube? | Motivo |
|---|---|---|
| `pipeline/`, `cesium/js`, `cesium/css`, `cesium/index.html` | Sí | Código |
| `cesium/data/*.js` (es-castell, isla, servicios, bus, luces, edificios) | Sí | Datos procesados. `es-castell.js` necesita el Catastro original para regenerarse |
| `v0.7/` (código, `public/data`, `public/assets/textures`, `tools`, `docs`) | Sí | Generador de edificios y sus datos |
| `data/extension/`, `data/ide/` | Sí | Datos procesados que usa el exportador |
| `casas/*.forge.json` | Sí | Casas retocadas con Forge |
| `.github/workflows/publicar.yml` | Sí | Publicación automática del visor |
| `imageRefs/` | **No** | Fotos propias: privadas |
| `data/raw/` | No | Unos 100 MB que se vuelven a descargar con `python pipeline/descargar_ide_menorca.py` |
| `cesium/models/`, `cesium/assets/textures/` | No | Unos 90 MB que genera `exportar_glb.mjs` y cambian en cada exportación; los genera el workflow |
| `casas/historial/`, `_copias/` | No | Historial y copias de seguridad locales |
| `node_modules/`, `__pycache__/` | No | Dependencias y cachés |

Tamaño aproximado: **unos 40 MB**. Para ver el visor en local después de clonarlo hay que generar los modelos:
```
cd v0.7 && npm install && cd ..
node pipeline/exportar_glb.mjs --zona
node pipeline/exportar_glb.mjs --zonefile data/extension/zona_municipio.json --name municipio
```

## 3. Revisión de privacidad (21-10-2026)
Revisados los dos proyectos completos:
- **Claves, tokens y contraseñas:** ninguno. El visor no usa Cesium ion ni servicios con clave.
- **Rutas personales, usuario de Windows o correo:** no aparecen en el código.
- **Correos y teléfonos:** solo los públicos de los servicios (Ayuntamiento, parroquia, biblioteca, farmacias), copiados de sus webs.
- **Fotos:** fuera del repositorio (`imageRefs/`).
- **Casas editadas (`casas/`):** solo geometría, nombres de piezas y fechas. Las notas están vacías.
- **Nombres de personas:** no hay ninguno de particulares. Los únicos nombres propios son los de dos farmacias, que son el nombre público del negocio.
- **Conjunto nº 1061 y Carrer Fontanilles:** se han quitado del código, la documentación y los datos todas las referencias al usuario, a sus fotos (`imageRefs/…`, nombres de archivo) y a sus correcciones. Ahora hablan de «fotos de referencia» y «ajustes manuales». El modelado 3D se conserva intacto. Originales en `_copias/2026-10-21_1800/`.

## 4. Licencias
- **Código y texturas propias:** MIT (`LICENSE` en cada repositorio). Puedes cambiar «Autores de Menorca3D» por tu nombre.
- **Datos de terceros:** cada uno con su licencia y su texto de atribución en `ATRIBUCIONES.md`: Catastro, IGN/CNIG (CC BY 4.0), IDE Menorca (CC BY 4.0), IDEIB y OpenStreetMap (ODbL). Todos permiten publicarse con cita. La licencia exacta de la ortofoto del IDEIB está por confirmar.
- **El workflow** copia `LICENSE` y `ATRIBUCIONES.md` junto al visor publicado.

## 5. Aviso en la web: sin ventana emergente
Las licencias piden *citar* las fuentes, y el visor ya lo hace en «Data attribution». Para aclarar que el modelo es aproximado hay una línea discreta en el panel de inicio del visor y en la pantalla de inicio de Forge: «Reconstrucción aproximada con fines divulgativos; no tiene validez oficial». No hay ventanas emergentes.

## 6. Colaborar con Menorca3D Forge
- **El .exe:** versión ligera que abre el editor en el navegador (`MenorcaForge.exe` + `recursos/`, unos 45 MB comprimido). La versión con ventana propia (Electron) queda para más adelante.
- **Recepción de cambios: opción B (archivo).**
  1. El colaborador pulsa **Enviar propuesta**: escribe su nombre y qué ha cambiado, y se descarga `propuesta_n<nº>_<REF>_<fecha>.forge.json`.
  2. Te lo envía.
  3. Tú lo abres en Forge con «⋯ → Importar propuesta» (o arrastrándolo). Forge detecta el edificio y muestra «Ver actual / Ver propuesta / Aceptar y guardar / Descartar».
  4. Al aceptar, «Enviar a Menorca3D» lo publica en local. Al subir `casas/` a GitHub, se publica también en la web.
- **Cómo envía el archivo: formulario de Google con subida de archivo** (decidido el 21-10-2026).
  - Al terminar «Enviar propuesta», Forge muestra «Abrir el formulario de envío». El formulario sale ya relleno con el nombre, el nº de edificio, la referencia, el comentario y el nombre del archivo, y el colaborador solo adjunta el archivo y envía.
  - Queda registrado quién (correo verificado por Google) y cuándo. Los archivos llegan a tu Google Drive. El colaborador necesita una cuenta de Google.
  - **Montaje:** los pasos para crear el formulario y conectarlo están en el README de Forge, apartado «Formulario de envío». El enlace va en `forge.config.json`, que no se sube al repositorio.
- **«Alguien ya está editando esta casa»:** el formulario no lo puede avisar solo, porque Forge no lee las respuestas. Por ahora se coordina a mano: el colaborador avisa antes de empezar una casa. Más adelante se podría añadir una hoja de Google con las casas «en edición» que Forge consulte al abrir una casa.
- **Privacidad:** el nombre y el correo del colaborador quedan en tus respuestas del formulario, no en GitHub. En la casa aceptada solo queda la nota «Propuesta de <nombre>».

## 7. Pendiente de decidir
Nada. El formulario de envío ya está creado y configurado en `forge.config.json`.

## 8. Archivos de la publicación
| Archivo | Qué es |
|---|---|
| `.gitignore` | Lo que no se sube (apartado 2) |
| `LICENSE` | Licencia MIT del código |
| `ATRIBUCIONES.md` | Fuentes de datos, licencias y textos de atribución |
| `GITHUB.md` | Este documento |
| `.github/workflows/publicar.yml` | Publicación automática del visor en GitHub Pages (llega en `flujos_github/`: ver la fase 0) |
| `casas/` | Casas retocadas con Forge (`historial/` es local) |
| `_copias/` | Copias de los archivos de v2 antes de modificarlos (solo en local) |
