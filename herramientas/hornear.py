"""Proyecta la imagen frontal original (Gemini) sobre la cara/frente del modelo TRELLIS y sube la textura a 4096.
uso: hornear.py modelo.glb imagen.png salida.glb [T]"""
import json, struct, sys, io
import numpy as np
from PIL import Image

src, imgp, out = sys.argv[1:4]
T = int(sys.argv[4]) if len(sys.argv) > 4 else 4096
b = open(src, 'rb').read()
jl = struct.unpack('<I', b[12:16])[0]
j = json.loads(b[20:20 + jl])
bin0 = 20 + jl + 8
binlen = struct.unpack('<I', b[20 + jl:24 + jl])[0]
BIN = b[bin0:bin0 + binlen]

def acc(i):
    a = j['accessors'][i]; bv = j['bufferViews'][a['bufferView']]
    o = bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    n = {'SCALAR': 1, 'VEC2': 2, 'VEC3': 3}[a['type']]
    dt = {5126: np.float32, 5125: np.uint32, 5123: np.uint16}[a['componentType']]
    return np.frombuffer(BIN, dt, a['count'] * n, o).reshape(-1, n) if n > 1 else np.frombuffer(BIN, dt, a['count'], o)

prim = j['meshes'][0]['primitives'][0]
P = acc(prim['attributes']['POSITION']).astype(np.float64)
UV = acc(prim['attributes']['TEXCOORD_0']).astype(np.float64)
F = acc(prim['indices']).reshape(-1, 3)
mn, mx = P.min(0), P.max(0); H = mx[1] - mn[1]
X = (P[:, 0] - (mn[0] + mx[0]) / 2) / H; Y = (P[:, 1] - mn[1]) / H; Z = (P[:, 2] - (mn[2] + mx[2]) / 2) / H

# Imagen: fondo claro -> máscara de la figura
im = np.asarray(Image.open(imgp).convert('RGB')).astype(np.float32)
fondo = np.median(np.concatenate([im[:8].reshape(-1, 3), im[-8:].reshape(-1, 3), im[:, :8].reshape(-1, 3), im[:, -8:].reshape(-1, 3)]), 0)
dist = np.abs(im - fondo).sum(2)
mask = dist > 40
# Rellenar agujeros: fondo = solo lo claro conectado con el borde (el blanco de los ojos o del vestido no es fondo)
from PIL import ImageDraw
_m = Image.fromarray(np.where(mask, 0, 128).astype(np.uint8)).copy()
for sx, sy in [(0, 0), (_m.width - 1, 0), (0, _m.height - 1), (_m.width - 1, _m.height - 1)]:
    if _m.getpixel((sx, sy)) == 128: ImageDraw.floodfill(_m, (sx, sy), 255)
mask = np.asarray(_m) != 255
filas = np.where(mask.sum(1) > 2)[0]; cols = np.where(mask.sum(0) > 2)[0]
top, bot = filas.min(), filas.max(); izq, der = cols.min(), cols.max()
s = (bot - top) / 1.0
xmodel = (X.max() + X.min()) / 2
cxi = (izq + der) / 2
def a_img(x, y):
    return cxi + (x - xmodel) * s, bot - y * s
print('figura en imagen', top, bot, izq, der, 'escala', s, 'ancho modelo px', (X.max() - X.min()) * s, 'ancho img', der - izq)
# máscara erosionada (no tomar el borde blanco)
from PIL import ImageFilter
mask_e = np.asarray(Image.fromarray((mask * 255).astype(np.uint8)).filter(ImageFilter.MinFilter(5))) > 128

# Buffer de profundidad desde el frente (+Z mira a la cámara)
Hh, Ww = mask.shape
depth = np.full((Hh, Ww), -9.0)
ix, iy = a_img(X, Y)
for f in F:
    xs, ys, zs = ix[f], iy[f], Z[f]
    x0, x1 = int(max(0, np.floor(xs.min()))), int(min(Ww - 1, np.ceil(xs.max())))
    y0, y1 = int(max(0, np.floor(ys.min()))), int(min(Hh - 1, np.ceil(ys.max())))
    if x1 < x0 or y1 < y0: continue
    gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
    d = (ys[1] - ys[2]) * (xs[0] - xs[2]) + (xs[2] - xs[1]) * (ys[0] - ys[2])
    if abs(d) < 1e-9: continue
    l0 = ((ys[1] - ys[2]) * (gx - xs[2]) + (xs[2] - xs[1]) * (gy - ys[2])) / d
    l1 = ((ys[2] - ys[0]) * (gx - xs[2]) + (xs[0] - xs[2]) * (gy - ys[2])) / d
    l2 = 1 - l0 - l1
    ins = (l0 >= -0.01) & (l1 >= -0.01) & (l2 >= -0.01)
    z = l0 * zs[0] + l1 * zs[1] + l2 * zs[2]
    sub = depth[y0:y1 + 1, x0:x1 + 1]
    np.maximum(sub, np.where(ins, z, -9), out=sub)

# Textura original, escalada a T
bvi = j['images'][0]['bufferView']; bv = j['bufferViews'][bvi]
tex0 = Image.open(io.BytesIO(BIN[bv.get('byteOffset', 0):bv.get('byteOffset', 0) + bv['byteLength']])).convert('RGB')
tex = np.asarray(tex0.resize((T, T), Image.BICUBIC)).astype(np.float32)
imgB = Image.fromarray(im.astype(np.uint8))

def muestra(px, py):
    px = np.clip(px, 0, Ww - 1.001); py = np.clip(py, 0, Hh - 1.001)
    x0 = np.floor(px).astype(int); y0 = np.floor(py).astype(int); fx = (px - x0)[:, None]; fy = (py - y0)[:, None]
    c = im[y0, x0] * (1 - fx) * (1 - fy) + im[y0, x0 + 1] * fx * (1 - fy) + im[y0 + 1, x0] * (1 - fx) * fy + im[y0 + 1, x0 + 1] * fx * fy
    return c

V0, V1, V2 = P[F[:, 0]], P[F[:, 1]], P[F[:, 2]]
N = np.cross(V1 - V0, V2 - V0); N /= np.linalg.norm(N, axis=1, keepdims=True) + 1e-12
nz = N[:, 2]
U = UV[:, 0] * T; Vv = UV[:, 1] * T   # glTF: v hacia abajo = fila
pintados = 0
zt = np.full((T, T), -9.0, np.float32)
degen = [0]
for k, f in enumerate(F):
    cab = Y[f].mean() > 0.74
    w_n = np.clip((nz[k] - (0.3 if cab else 0.15)) / (0.35 if cab else 0.4), 0, 1); w_n = w_n * w_n * (3 - 2 * w_n)
    if w_n <= 0: continue
    us, vs = U[f], Vv[f]
    x0, x1 = int(max(0, np.floor(us.min()) - 1)), int(min(T - 1, np.ceil(us.max()) + 1))
    y0, y1 = int(max(0, np.floor(vs.min()) - 1)), int(min(T - 1, np.ceil(vs.max()) + 1))
    gx, gy = np.meshgrid(np.arange(x0, x1 + 1) + 0.5, np.arange(y0, y1 + 1) + 0.5)
    d = (vs[1] - vs[2]) * (us[0] - us[2]) + (us[2] - us[1]) * (vs[0] - vs[2])
    if abs(d) < 4.0:   # UV casi un punto: el triángulo entero usa 1-2 texeles -> pintarlos con el color del centro proyectado
        cx_, cy_ = int(us.mean()), int(vs.mean()); pcx, pcy = ix[f].mean(), iy[f].mean(); zc = Z[f].mean()
        if 0 <= int(pcy) < Hh and 0 <= int(pcx) < Ww and zc >= depth[int(pcy), int(pcx)] - 0.03 and mask_e[int(pcy), int(pcx)]:
            c = muestra(np.array([pcx]), np.array([pcy]))[0]
            tex[max(0, cy_ - 2):cy_ + 3, max(0, cx_ - 2):cx_ + 3] = c; degen[0] += 1
        continue
    l0 = ((vs[1] - vs[2]) * (gx - us[2]) + (us[2] - us[1]) * (gy - vs[2])) / d
    l1 = ((vs[2] - vs[0]) * (gx - us[2]) + (us[0] - us[2]) * (gy - vs[2])) / d
    l2 = 1 - l0 - l1
    ins = (l0 >= -0.08) & (l1 >= -0.08) & (l2 >= -0.08)
    if not ins.any(): continue
    l0, l1, l2, gx, gy = l0[ins], l1[ins], l2[ins], gx[ins], gy[ins]
    px = l0 * ix[f[0]] + l1 * ix[f[1]] + l2 * ix[f[2]]
    py = l0 * iy[f[0]] + l1 * iy[f[1]] + l2 * iy[f[2]]
    z = l0 * Z[f[0]] + l1 * Z[f[1]] + l2 * Z[f[2]]
    pxi = np.clip(px.astype(int), 0, Ww - 1); pyi = np.clip(py.astype(int), 0, Hh - 1)
    vis = (z >= depth[pyi, pxi] - (0.03 if cab else 0.012)) & mask_e[pyi, pxi]
    if not vis.any(): continue
    tx, ty = gx[vis].astype(int), gy[vis].astype(int)
    gana = z[vis] > zt[ty, tx]
    if not gana.any(): continue
    tx, ty = tx[gana], ty[gana]; zt[ty, tx] = z[vis][gana]
    col = muestra(px[vis][gana], py[vis][gana])
    tex[ty, tx] = tex[ty, tx] * (1 - w_n) + col * w_n
    pintados += vis.sum()
print('texeles pintados', pintados, 'uv degenerados', degen[0])

buf = io.BytesIO(); Image.fromarray(np.clip(tex, 0, 255).astype(np.uint8)).save(buf, 'JPEG', quality=88)
nuevo = buf.getvalue()
Image.fromarray(np.clip(tex, 0, 255).astype(np.uint8)).resize((1024, 1024)).save(out + '.tex.jpg')
# Reconstruir el BIN reemplazando la imagen
partes, off = [], 0
for i, v in enumerate(j['bufferViews']):
    datos = nuevo if i == bvi else BIN[v.get('byteOffset', 0):v.get('byteOffset', 0) + v['byteLength']]
    v['byteOffset'] = off; v['byteLength'] = len(datos)
    pad = (-len(datos)) % 4
    partes.append(datos + b'\0' * pad); off += len(datos) + pad
nb = b''.join(partes)
j['buffers'][0]['byteLength'] = len(nb)
j['images'][0]['mimeType'] = 'image/jpeg'
js = json.dumps(j, separators=(',', ':')).encode(); js += b' ' * ((-len(js)) % 4)
glb = b'glTF' + struct.pack('<II', 2, 12 + 8 + len(js) + 8 + len(nb)) + struct.pack('<I', len(js)) + b'JSON' + js + struct.pack('<I', len(nb)) + b'BIN\0' + nb
open(out, 'wb').write(glb)
print('listo', out, len(glb) // 1024, 'KB')
