import json, math, sys, os, numpy as np
# Uso: python tools/preparar_zona.py [data/raw/world.json]
SRC=sys.argv[1] if len(sys.argv)>1 else 'data/raw/world.json'
def load(f):
    try: return json.load(open(f,encoding='utf-8'))
    except UnicodeDecodeError: return json.load(open(f,encoding='cp1252'))
from matplotlib.path import Path
d=load(SRC)
X0,X1,Z0,Z1=-700,1100,-900,900
inb=lambda p:X0<=p[0]<=X1 and Z0<=p[1]<=Z1
anyin=lambda pts:any(inb(p) for p in pts)
cl=[a['pts'] for a in d['areas'] if a['kind']=='coastline']
closed=[c for c in cl if c[0]==c[-1]]; op=[c for c in cl if c[0]!=c[-1]]
ends={tuple(c[-1]) for c in op}
start=[c for c in op if tuple(c[0]) not in ends][0]
chain=list(start); used=[start]
while True:
    nx=[c for c in op if c[0]==used[-1][-1] and c not in used]
    if not nx: break
    used.append(nx[0]); chain+=nx[0][1:]
CUT=[-1488.4,-956.5]  # fin de la costa sur del puerto (específico de esta descarga)
chain=chain[:chain.index(CUT)+1] if CUT in chain else chain
land=chain+[[-3500,-956.5],[-3500,4300],[chain[0][0],4300]]
islands=[c for c in closed if len(c)>6 and anyin(c)]
WATER={'water','bay','tidal_channel','wetland','canal','sea'}
GREEN={'greenfield','common','heath','grass','grassland','playground','dog_park','scrub'}
areas=[]
for a in d['areas']:
    p=a['pts']
    if a['kind']=='coastline' or len(p)<4 or p[0]!=p[-1] or not anyin(p): continue
    c=a['color']; k=a['kind']
    if k=='swimming_pool': c='#6fc3df'
    elif k in WATER: c='#aad3df'
    elif k in GREEN: c='#cdebb0'
    elif k=='cemetery': c='#aacbaf'
    areas.append({'k':k,'c':c,'p':p})
bl=[{'p':b['pts'],'h':b['h'],**({'c':b['color']} if b['color']!='#f4f1e8' else {}),**({'rs':b['roof_shape']} if b.get('roof_shape') else {})} for b in d['buildings'] if anyin(b['pts'])]
rd=[{'p':r['pts'],'w':r['w'],'c':r['color'],'t':r.get('type'),**({'sw':r['sidewalk']} if r.get('sidewalk') else {}),**({'fw':r['footway']} if r.get('footway') else {})} for r in d['roads'] if anyin(r['pts'])]
wl=[{'p':w['pts'],'t':w['type'],**({'h':w['h']} if w.get('h') else {}),**({'m':w['material']} if w.get('material') else {})} for w in d.get('walls',[]) if anyin(w['pts'])]
pois=[]
for p in d['pois']:
    if not (p['important'] or p['kind']=='townhall') or not inb([p['x'],p['z']]): continue
    n=p['name']; k='ayuntamiento' if p['kind']=='townhall' else p['kind']
    if k=='explanada' and any(q['k']=='explanada' for q in pois): continue  # la plaza son varios tramos: un solo marcador
    if k=='explanada': lab='Explanada'
    elif k=='ayuntamiento': lab=n
    elif k=='farmacia': lab=n if n.lower().startswith('farmacia') else 'Farmacia '+n
    else:
        lab='Supermercado'+(' '+n.split(None,1)[1] if n.lower().startswith('supermerc') and ' ' in n else '' if n.lower().startswith('supermerc') else ' '+n)
    pois.append({'k':k,'l':lab,'x':p['x'],'z':p['z']})
ex=[p for p in pois if p['k']=='explanada'][0]; ex['x'],ex['z']=-111.0,-392.0  # centro de Plaça de s'Esplanada (nombre de vía en OSM)
T=(68,30)  # Carrer Tramuntana (Santa Anna)
sp=min((q for r in rd for q in r['p']),key=lambda q:(q[0]-T[0])**2+(q[1]-T[1])**2)
zones=[{'n':'Santa Anna','x':150,'z':10,'r':260},{'n':'Sol del Este','x':480,'z':260,'r':230},{'n':'Es Castell','x':-150,'z':-380,'r':330}]
# Plazas: vías peatonales cerradas de OSM (p. ej. Plaça de s'Esplanada) → superficie pavimentada (REAL en forma).
plazas=[{'n':r.get('name'),'p':r['pts']} for r in d['roads'] if r['type']=='pedestrian' and len(r['pts'])>3 and r['pts'][0]==r['pts'][-1] and anyin(r['pts'])]
# Edificios emblemáticos con nombre en OSM (cuarteles de la Explanada): sus piezas del Catastro reciben estilo propio.
landmarks=[{'n':b['name'],'k':'cuartel' if b['name'].lower().startswith('cuartel') else 'otro','p':b['pts']} for b in d['buildings'] if b.get('name') and anyin(b['pts'])]
out={'box':[X0,X1,Z0,Z1],'plazas':plazas,'landmarks':landmarks,'land':land,'islands':islands,'areas':areas,'buildings':bl,'roads':rd,'walls':wl,'pois':pois,'spawn':sp,'zones':zones,'attr':d['attribution'],'origin':d['origin']}
json.dump(out,open('data/processed/zona.json','w'),ensure_ascii=True,separators=(',',':'))
print({k:len(v) for k,v in out.items() if isinstance(v,list)},os.path.getsize('data/processed/zona.json'),sp)
for p in pois: print(p)
# debug
import matplotlib;matplotlib.use('Agg');import matplotlib.pyplot as plt
gx,gz=np.meshgrid(np.arange(X0,X1,8),np.arange(Z0,Z1,8));pts=np.c_[gx.ravel(),gz.ravel()]
m=Path(land).contains_points(pts)
for i in islands: m|=Path(i).contains_points(pts)
fig,ax=plt.subplots(figsize=(9,9));ax.imshow(m.reshape(gx.shape),extent=[X0,X1,Z1,Z0],cmap='GnBu',alpha=.5)
for b in bl: ax.fill(*zip(*b['p']),c='k',lw=0)
for r in rd: ax.plot(*zip(*r['p']),c='gray',lw=.4)
for p in pois: ax.plot(p['x'],p['z'],'r*');ax.text(p['x'],p['z'],p['l'][:14],fontsize=6)
ax.plot(*sp,'g^');ax.set_xlim(X0,X1);ax.set_ylim(Z1,Z0);plt.savefig('data/generated/comprobacion_zona.png',dpi=80)
