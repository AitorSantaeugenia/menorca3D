import json, glob, math, base64, io, sys, os, numpy as np, tifffile
# Uso: python tools/procesar_terreno.py ["data/raw/mdt/*.tif"]
MDT=sys.argv[1] if len(sys.argv)>1 else 'data/raw/mdt/*.tif'
OUT='public/data/menorca/es-castell/santa-anna'
from PIL import Image, ImageDraw
D=json.load(open('data/processed/zona.json'))
lat0,lon0=D['origin']['lat'],D['origin']['lon']; kx,kz=111320*math.cos(math.radians(lat0)),110540
X0,X1,Z0,Z1=D['box']; ST=5
xs=np.arange(X0,X1+1,ST,dtype=float); zs=np.arange(Z0,Z1+1,ST,dtype=float); GX,GZ=np.meshgrid(xs,zs)
lat=lat0-GZ/kz; lon=lon0+GX/kx
def utm(lat,lon,lc=3.0):  # ETRS89/GRS80 -> UTM huso 31
    a=6378137.0; f=1/298.257222101; e2=f*(2-f); ep=e2/(1-e2); k0=.9996
    p=np.radians(lat); l=np.radians(lon-lc); s,c,t=np.sin(p),np.cos(p),np.tan(p)
    N=a/np.sqrt(1-e2*s*s); T=t*t; C=ep*c*c; A=c*l
    M=a*((1-e2/4-3*e2**2/64-5*e2**3/256)*p-(3*e2/8+3*e2**2/32+45*e2**3/1024)*np.sin(2*p)+(15*e2**2/256+45*e2**3/1024)*np.sin(4*p)-35*e2**3/3072*np.sin(6*p))
    E=k0*N*(A+(1-T+C)*A**3/6+(5-18*T+T*T+72*C-58*ep)*A**5/120)+5e5
    Nn=k0*(M+N*t*(A*A/2+(5-T+9*C+4*C*C)*A**4/24+(61-58*T+T*T+600*C-330*ep)*A**6/720))
    return E,Nn
E,N=utm(lat,lon); H=np.full(GX.shape,np.nan)
for f in sorted(glob.glob(MDT)):
    try:
        with tifffile.TiffFile(f) as tf:
            pg=tf.pages[0]; e0,n0=pg.tags[33922].value[3:5]; a=pg.asarray().astype(np.float32)
    except Exception as ex:
        print(f[-28:],'ERROR al leer:',ex); continue
    a[a<-1000]=np.nan; r,c=a.shape; r10,c10=r//10*10,c//10*10
    with np.errstate(all='ignore'): b=np.nanmean(a[:r10,:c10].reshape(r10//10,10,c10//10,10),axis=(1,3))
    del a
    ci=((E-e0)/5).astype(int); ri=((n0-N)/5).astype(int)
    m=(ci>=0)&(ri>=0)&(ci<b.shape[1])&(ri<b.shape[0])&np.isnan(H)
    H[m]=b[ri[m],ci[m]]
    print(f[-28:],'puntos',int(m.sum()))
print('sin dato (mar/fuera):',int(np.isnan(H).sum()),'de',H.size,' rango',np.nanmin(H),np.nanmax(H))
Hf=np.where(np.isnan(H),-3.0,H)
from matplotlib.path import Path as MP
pts=np.c_[GX.ravel(),GZ.ravel()]; m=MP(D['land']).contains_points(pts)
for i in D['islands']: m|=MP(i).contains_points(pts)
Hf[(~m.reshape(Hf.shape))&(Hf<2)]=-3.0  # fondo marino bajo el agua
D['terrain']={'x0':X0,'z0':Z0,'step':ST,'cols':len(xs),'rows':len(zs),
 'h':base64.b64encode(np.round(Hf*10).astype('<i2').tobytes()).decode()}
# --- Textura del suelo a partir de OSM (colores de mapa) ---
S=2048/(X1-X0); P=lambda q:((q[0]-X0)*S,(q[1]-Z0)*S)
im=Image.new('RGB',(2048,2048),'#7fbfd6'); g=ImageDraw.Draw(im)
g.polygon([P(q) for q in D['land']],fill='#ece6d6')
for i in D['islands']: g.polygon([P(q) for q in i],fill='#ece6d6')
for a in sorted(D['areas'],key=lambda a:a['k']=='swimming_pool'): g.polygon([P(q) for q in a['p']],fill=a['c'])
for b in D['buildings']: g.polygon([P(q) for q in b['p']],fill='#cfc6b4')
for cas in (1,0):
    for r in D['roads']:
        w=max(1,int((r['w']+(1.4 if cas else 0))*S)); g.line([P(q) for q in r['p']],fill='#a8a090' if cas else r['c'],width=w,joint='curve')
os.makedirs(OUT,exist_ok=True); im.save(OUT+'/ground.png',optimize=True)
json.dump(D,open(OUT+'/zone.json','w'),ensure_ascii=True,separators=(',',':'))
print('Listo:',OUT)
# --- Comprobación: sombreado del relieve + costa OSM ---
dy,dx=np.gradient(Hf,ST); sh=np.clip(.6+(-dx-dy)*.4,0,1)
import matplotlib;matplotlib.use('Agg');import matplotlib.pyplot as plt
fig,ax=plt.subplots(figsize=(8,8));ax.imshow(np.where(np.isnan(H),np.nan,sh),cmap='gray',extent=[X0,X1,Z1,Z0])
ax.contour(xs,zs,Hf,levels=[1,10,20,30],colors=['b','g','orange','r'],linewidths=.6)
ax.plot(*zip(*D['land']),c='m',lw=.8);ax.set_xlim(X0,X1);ax.set_ylim(Z1,Z0);plt.savefig('data/generated/comprobacion_relieve.png',dpi=80)
