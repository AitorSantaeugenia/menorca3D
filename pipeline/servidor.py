#!/usr/bin/env python3
"""Servidor local del visor, con proxy para los autobuses en directo de TMSA.

Uso (desde menorca3d_v2):
    python pipeline/servidor.py            → http://localhost:8080/cesium/
    python pipeline/servidor.py 8090       → otro puerto

Hace lo mismo que «python -m http.server» (sirve los archivos de la carpeta) y además responde a
    /tmsa/posicion/602/1   y   /tmsa/posicion/602/2
con la posición en directo de los autobuses de la línea L02 (sentido Es Castell / sentido Maó), que pide a
https://www.tmsa.es/es/posicion-bus-nuevo/602/<sentido>. El navegador no puede pedirla directamente porque la web de
TMSA no lo permite desde otras webs (CORS). Las respuestas se guardan 15 s para no cargar el servidor de TMSA.
Solo usa la biblioteca estándar de Python.
"""
import http.server, json, os, sys, time, urllib.request

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), '..'))
PORT = int(sys.argv[1]) if len(sys.argv) > 1 else 8080
CACHE = {}

class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *a, **k): super().__init__(*a, directory=ROOT, **k)

    def do_GET(self):
        p = self.path.split('?')[0].rstrip('/').split('/')
        if len(p) == 5 and p[1] == 'tmsa' and p[2] == 'posicion' and p[3].isdigit() and p[4] in ('1', '2'):
            key = (p[3], p[4])
            if key not in CACHE or time.time() - CACHE[key][0] > 15:
                try:
                    req = urllib.request.Request(f'https://www.tmsa.es/es/posicion-bus-nuevo/{p[3]}/{p[4]}',
                                                 headers={'User-Agent': 'menorca3d-v2 (visor local)'})
                    with urllib.request.urlopen(req, timeout=10) as r: body = r.read()
                    json.loads(body)   # comprobar que es JSON
                    CACHE[key] = (time.time(), body)
                except Exception as e:
                    self.send_response(502); self.send_header('Content-Type', 'application/json'); self.end_headers()
                    self.wfile.write(json.dumps({'error': str(e)}).encode()); return
            body = CACHE[key][1]
            self.send_response(200); self.send_header('Content-Type', 'application/json; charset=utf-8')
            self.send_header('Cache-Control', 'no-store'); self.end_headers(); self.wfile.write(body); return
        return super().do_GET()

    def end_headers(self):   # que el navegador pregunte siempre si el archivo ha cambiado (modelos regenerados)
        if not self.path.startswith('/tmsa/'): self.send_header('Cache-Control', 'no-cache')
        super().end_headers()

    def log_message(self, fmt, *args):   # menos ruido: solo errores
        if args and str(args[1])[:1] in '45': super().log_message(fmt, *args)

if __name__ == '__main__':
    print(f'Visor en http://localhost:{PORT}/cesium/  (Ctrl+C para parar)')
    http.server.ThreadingHTTPServer(('', PORT), Handler).serve_forever()
