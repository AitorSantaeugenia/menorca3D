import { defineConfig } from 'vite';
import fs from 'node:fs';
import path from 'node:path';

// Solo en desarrollo (npm run dev): el mapa grande guarda el estado de los edificios (acabado/pendiente)
// directamente en public/data/.../edificios.json. En la versión publicada no existe y los cambios
// se quedan en el navegador hasta exportarlos.
const ESTADOS = new Set(['pendiente', 'acabado']);
function estadoEdificios() {
  return {
    name: 'estado-edificios',
    configureServer(server) {
      server.middlewares.use('/__edificios', (req, res) => {
        const reply = (code, obj) => { res.statusCode = code; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(obj)); };
        if (req.method !== 'POST') return reply(405, { ok: false });
        let body = '';
        req.on('data', c => { body += c; if (body.length > 1e6) req.destroy(); });
        req.on('end', () => {
          try {
            const { file, cambios } = JSON.parse(body);
            const rel = String(file).replace(/^\/+/, '');
            if (!/^data\/[\w-]+(\/[\w-]+)*\/edificios\.json$/.test(rel)) throw new Error('ruta no permitida');
            const abs = path.join(server.config.publicDir, rel);
            const d = JSON.parse(fs.readFileSync(abs, 'utf8'));
            let n = 0;
            for (const e of d.edificios) { const v = cambios[e.ref]; if (ESTADOS.has(v) && e.estado !== v) { e.estado = v; n++; } }
            fs.writeFileSync(abs, '{\n"nota": ' + JSON.stringify(d.nota || '') + ',\n"edificios": [\n' + d.edificios.map(e => JSON.stringify(e)).join(',\n') + '\n]\n}\n');
            reply(200, { ok: true, cambiados: n });
          } catch (err) { reply(400, { ok: false, error: err.message }); }
        });
      });
    },
  };
}

export default defineConfig({
  plugins: [estadoEdificios()],
  server: { watch: { ignored: ['**/edificios.json'] } },
});
