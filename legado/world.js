import * as THREE from 'three';
import { fbm, mix, clamp, smooth, rng } from './util.js';
import { GRAMA } from './space.js';

// El mundo: un valle sobre la superficie curva del planeta. Marco local: y hacia arriba, el centro del planeta en (0,-RP,0).
export function buildWorld(RP) {
  const RC = 12.5;                                         // radio del valle
  const island = new THREE.Group();
  const pond = { x: 3.7, z: -3.5, r: 1.7 };
  const casa = { x: -5.8, z: -3.2, rot: 0.55 };
  const obst = [];                                         // obstaculos circulares: { x, z, r }
  const rnd = rng(20261123);

  const hills = (x, z) => (fbm(x * 0.2 + 5, 3.1, z * 0.2 + 5, 3) - 0.42) * 1.5;
  function bump(x, z) {
    const r = Math.hypot(x, z);
    let b = hills(x, z) * (0.2 + 0.8 * smooth(2.4, 5.5, r));               // plaza casi plana
    b -= 0.42 * (1 - smooth(pond.r * 0.55, pond.r * 1.9, Math.hypot(x - pond.x, z - pond.z)));
    return b * (1 - smooth(8.0, 11.5, r)) - 0.14 * smooth(10.0, 12.4, r);
  }
  const groundY = (x, z) => Math.sqrt(Math.max(0, RP * RP - x * x - z * z)) - RP + bump(x, z);
  const sueloY = (x, z) => groundY(x, z) + 0.03;

  // ----- caminos (de la plaza hacia afuera, ondulados)
  const caminos = [0.45, 2.35, Math.atan2(casa.z, casa.x)];
  function distCamino(x, z) {
    let best = 9;
    for (let k = 0; k < caminos.length; k++) {
      const a = caminos[k], al = x * Math.cos(a) + z * Math.sin(a); if (al < 0 || al > 11) continue;
      const pe = Math.abs(-x * Math.sin(a) + z * Math.cos(a) - 0.5 * Math.sin(al * 0.6 + k * 2));
      best = Math.min(best, pe - 0.42 * (1 - al / 16));
    }
    return best;
  }

  // ----- terreno (casquete del planeta con colinas, plaza, caminos y orilla del estanque)
  {
    const rings = 56, segs = 112, verts = [], cols = [], idx = [];
    const c = new THREE.Color(); const col = (r, g, b) => c.setRGB(r / 255, g / 255, b / 255, THREE.SRGBColorSpace);
    for (let i = 0; i <= rings; i++) {
      const rho = RC * Math.pow(i / rings, 0.8);
      for (let j = 0; j < (i === 0 ? 1 : segs); j++) {
        const a = j / segs * Math.PI * 2, x = Math.cos(a) * rho, z = Math.sin(a) * rho;
        verts.push(x, sueloY(x, z), z);
        const n = fbm(x * 0.9, 1.7, z * 0.9, 4), m = fbm(x * 0.25 + 40, 0, z * 0.25, 3);
        let k = mix(mix([58, 112, 48], GRAMA, clamp(n * 1.4, 0, 1)), [118, 160, 66], clamp((m - 0.4) * 2.2, 0, 1));
        const plaza = 1 - smooth(2.0, 2.6 + n * 0.5, rho), cam = 1 - smooth(-0.1, 0.18, distCamino(x, z));
        const dp = Math.hypot(x - pond.x, z - pond.z), orilla = 1 - smooth(pond.r * 0.9, pond.r * 1.45 + n * 0.4, dp);
        const tierra = mix([150, 118, 80], [172, 140, 98], n);
        k = mix(k, tierra, Math.max(plaza, cam * 0.9)); k = mix(k, [196, 178, 128], orilla);
        k = mix(k, GRAMA, smooth(9.8, 12.4, rho));                      // el borde se funde con la textura del planeta
        col(k[0], k[1], k[2]); cols.push(c.r, c.g, c.b);
      }
    }
    const rowStart = i => i === 0 ? 0 : 1 + (i - 1) * segs;
    for (let i = 1; i <= rings; i++) for (let j = 0; j < segs; j++) {
      const j2 = (j + 1) % segs, a = i === 1 ? 0 : rowStart(i - 1) + j, b = i === 1 ? 0 : rowStart(i - 1) + j2, c1 = rowStart(i) + j, d = rowStart(i) + j2;
      if (i === 1) idx.push(0, d, c1); else idx.push(a, d, c1, a, b, d);
    }
    const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3)); geo.setAttribute('color', new THREE.Float32BufferAttribute(cols, 3)); geo.setIndex(idx);
    geo.computeVertexNormals();
    const terreno = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 1 })); terreno.receiveShadow = true; island.add(terreno);
  }

  // ----- estanque
  {
    const wl = Math.sqrt(RP * RP - pond.x * pond.x - pond.z * pond.z) - RP - 0.17;
    const geo = new THREE.CircleGeometry(pond.r * 1.7, 48); geo.rotateX(-Math.PI / 2);
    const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const x = pond.x + p.getX(i), z = pond.z + p.getZ(i); p.setY(i, Math.sqrt(RP * RP - x * x - z * z) - RP - 0.17); }
    const agua = new THREE.Mesh(geo, new THREE.MeshStandardMaterial({ color: 0x3b86b8, roughness: 0.08, metalness: 0.1, transparent: true, opacity: 0.86 }));
    agua.position.set(pond.x, 0, pond.z); agua.receiveShadow = true; island.add(agua);
    island.userData.agua = agua;
    obst.push({ x: pond.x, z: pond.z, r: pond.r * 1.25 });
  }

  // ----- árboles
  const verde = (t) => new THREE.Color().setHSL(0.27 + rnd() * 0.06, 0.45 + rnd() * 0.15, 0.2 + t * 0.12);
  function arbol(x, z, tipo, s) {
    const g = new THREE.Group(); g.position.set(x, groundY(x, z) - 0.05, z); g.rotation.y = rnd() * 6.28; g.scale.setScalar(s);
    const tm = new THREE.MeshStandardMaterial({ color: tipo === 'abedul' ? 0xd8d2c4 : 0x6b4a2b, roughness: 1 });
    const th = tipo === 'pino' ? 1.0 : 1.3;
    const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.17, th, 8), tm); tr.position.y = th / 2; tr.castShadow = true; g.add(tr);
    if (tipo === 'pino') {
      for (let i = 0; i < 4; i++) { const h = 1.25 - i * 0.18, r = 0.95 - i * 0.2; const c = new THREE.Mesh(new THREE.ConeGeometry(r, h, 9), new THREE.MeshStandardMaterial({ color: verde(0.2 + i * 0.1), roughness: 0.95, flatShading: true })); c.position.y = 0.9 + i * 0.62; c.castShadow = true; g.add(c); }
    } else {
      const n = tipo === 'abedul' ? 3 : 5;
      for (let i = 0; i < n; i++) {
        const c = new THREE.Mesh(new THREE.IcosahedronGeometry((tipo === 'abedul' ? 0.6 : 0.85) - i * 0.06, 1), new THREE.MeshStandardMaterial({ color: verde(0.3 + rnd() * 0.5), roughness: 0.9, flatShading: true }));
        const a = rnd() * 6.28, rr = i === 0 ? 0 : 0.5 * rnd() + 0.3; c.position.set(Math.cos(a) * rr, th + 0.55 + (i === 0 ? 0.35 : rnd() * 0.5), Math.sin(a) * rr); c.castShadow = true; g.add(c);
      }
    }
    island.add(g); obst.push({ x, z, r: 0.45 * s });
  }
  for (let k = 0, put = 0; k < 160 && put < 26; k++) {
    const a = rnd() * Math.PI * 2, r = 6.2 + rnd() * 4.6, x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (Math.hypot(x - pond.x, z - pond.z) < 3.2 || Math.hypot(x - casa.x, z - casa.z) < 3.0 || distCamino(x, z) < 0.9) continue;
    if (obst.some(o => Math.hypot(o.x - x, o.z - z) < 1.5)) continue;
    arbol(x, z, rnd() < 0.35 ? 'pino' : rnd() < 0.6 ? 'redondo' : 'abedul', 0.85 + rnd() * 0.5); put++;
  }

  // ----- casa
  {
    const g = new THREE.Group(); g.position.set(casa.x, groundY(casa.x, casa.z) + 0.02, casa.z); g.rotation.y = casa.rot + Math.PI / 2 * 0; island.add(g);
    const pared = new THREE.MeshStandardMaterial({ color: 0xe6dcc2, roughness: 0.95 });
    const b = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.3, 1.7), pared); b.position.y = 0.65; b.castShadow = b.receiveShadow = true; g.add(b);
    const t = new THREE.Mesh(new THREE.ConeGeometry(1.75, 1.0, 4), new THREE.MeshStandardMaterial({ color: 0xa8482f, roughness: 0.9, flatShading: true })); t.position.y = 1.8; t.rotation.y = Math.PI / 4; t.scale.set(1.0, 1, 0.78); t.castShadow = true; g.add(t);
    const puerta = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.8, 0.06), new THREE.MeshStandardMaterial({ color: 0x5b3a22, roughness: 0.8 })); puerta.position.set(0.5, 0.4, 0.86); g.add(puerta);
    const vent = new THREE.Mesh(new THREE.BoxGeometry(0.45, 0.4, 0.05), new THREE.MeshStandardMaterial({ color: 0xffe2a0, emissive: 0xffb050, emissiveIntensity: 0.55, roughness: 0.4 })); vent.position.set(-0.55, 0.75, 0.86); g.add(vent);
    const chim = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.7, 0.28), new THREE.MeshStandardMaterial({ color: 0x8a7a6a, roughness: 1 })); chim.position.set(-0.7, 1.9, -0.2); chim.castShadow = true; g.add(chim);
    obst.push({ x: casa.x, z: casa.z, r: 1.6 });
    island.userData.casa = g;
  }

  // ----- fogata y troncos para sentarse
  const fuego = new THREE.Group(); fuego.position.set(0, groundY(0, 0), 0); island.add(fuego);
  const llamas = [];
  {
    const piedra = new THREE.MeshStandardMaterial({ color: 0x777067, roughness: 1, flatShading: true });
    for (let i = 0; i < 9; i++) { const a = i / 9 * 6.283; const s = new THREE.Mesh(new THREE.DodecahedronGeometry(0.13 + rnd() * 0.05, 0), piedra); s.position.set(Math.cos(a) * 0.5, 0.07, Math.sin(a) * 0.5); s.castShadow = true; fuego.add(s); }
    for (let i = 0; i < 3; i++) { const l = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.7, 7), new THREE.MeshStandardMaterial({ color: 0x4a2f1a, roughness: 1 })); l.position.y = 0.12; l.rotation.set(Math.PI / 2 - 0.2, i * 2.1, 0); l.rotation.order = 'YXZ'; fuego.add(l); }
    for (let i = 0; i < 3; i++) {
      const f = new THREE.Mesh(new THREE.ConeGeometry(0.17 - i * 0.03, 0.55 - i * 0.1, 8), new THREE.MeshBasicMaterial({ color: [0xff7a1a, 0xffa020, 0xffd860][i], transparent: true, opacity: 0.9 }));
      f.position.set((i - 1) * 0.07, 0.38, (i % 2) * 0.05); fuego.add(f); llamas.push(f);
    }
    var luzFuego = new THREE.PointLight(0xff9a40, 1.6, 8, 1.6); luzFuego.position.set(0, 0.7, 0); fuego.add(luzFuego);
    const tm = new THREE.MeshStandardMaterial({ color: 0x6b4a2b, roughness: 1 });
    for (const a of [1.2, 3.6, 5.2]) { const tr = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 1.1, 10), tm); const x = Math.cos(a) * 1.7, z = Math.sin(a) * 1.7; tr.position.set(x, groundY(x, z) + 0.2, z); tr.rotation.set(0, -a, Math.PI / 2); tr.rotation.order = 'YXZ'; tr.castShadow = true; island.add(tr); }
    obst.push({ x: 0, z: 0, r: 0.85 });
  }

  // ----- rocas
  for (let i = 0; i < 9; i++) {
    const a = rnd() * 6.283, r = 3.5 + rnd() * 7, x = Math.cos(a) * r, z = Math.sin(a) * r;
    if (obst.some(o => Math.hypot(o.x - x, o.z - z) < o.r + 0.6) || distCamino(x, z) < 0.6) continue;
    const s = 0.2 + rnd() * 0.35, m = new THREE.Mesh(new THREE.DodecahedronGeometry(s, 0), new THREE.MeshStandardMaterial({ color: 0x8a857a, roughness: 1, flatShading: true }));
    m.position.set(x, groundY(x, z) + s * 0.3, z); m.scale.set(1.2, 0.7, 1); m.rotation.set(rnd(), rnd() * 6, rnd()); m.castShadow = true; island.add(m);
    if (s > 0.35) obst.push({ x, z, r: s });
  }

  // ----- césped y flores (instanciados)
  {
    const NT = 2600, tuft = new THREE.InstancedMesh(new THREE.ConeGeometry(0.05, 0.3, 4).translate(0, 0.15, 0), new THREE.MeshStandardMaterial({ roughness: 1 }), NT);
    const d = new THREE.Object3D(), c = new THREE.Color(); let n = 0;
    for (let k = 0; k < NT * 2 && n < NT; k++) {
      const a = rnd() * 6.283, r = Math.sqrt(rnd()) * 10.5, x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (r < 2.5 || distCamino(x, z) < 0.35 || Math.hypot(x - pond.x, z - pond.z) < pond.r * 1.3 || Math.hypot(x - casa.x, z - casa.z) < 1.3) continue;
      d.position.set(x, groundY(x, z) - 0.02, z); d.rotation.set((rnd() - 0.5) * 0.4, rnd() * 6.28, (rnd() - 0.5) * 0.4); d.scale.set(1, 0.7 + rnd() * 1.1, 1); d.updateMatrix(); tuft.setMatrixAt(n, d.matrix);
      c.setHSL(0.24 + rnd() * 0.08, 0.5, 0.22 + rnd() * 0.16); tuft.setColorAt(n, c); n++;
    }
    tuft.count = n; island.add(tuft);
    const NF = 160, flor = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.065, 0), new THREE.MeshStandardMaterial({ roughness: 0.7 }), NF);
    const pal = [0xffffff, 0xffe14d, 0xff7aa8, 0xb27cff, 0xff8c42]; let f = 0;
    for (let k = 0; k < NF * 3 && f < NF; k++) {
      const a = rnd() * 6.283, r = 3 + rnd() * 7.2, x = Math.cos(a) * r, z = Math.sin(a) * r;
      if (distCamino(x, z) < 0.5 || Math.hypot(x - pond.x, z - pond.z) < pond.r * 1.5 || Math.hypot(x - casa.x, z - casa.z) < 1.6) continue;
      d.position.set(x, groundY(x, z) + 0.2, z); d.rotation.set(0, 0, 0); d.scale.setScalar(0.8 + rnd() * 0.6); d.updateMatrix(); flor.setMatrixAt(f, d.matrix);
      flor.setColorAt(f, c.set(pal[Math.floor(rnd() * pal.length)])); f++;
    }
    flor.count = f; island.add(flor);
  }

  // ----- mariposas
  const mariposas = [];
  for (let i = 0; i < 7; i++) {
    const g = new THREE.Group(); const col = [0xffd54a, 0xff9acb, 0x9ad0ff, 0xffffff][i % 4];
    const mat = new THREE.MeshBasicMaterial({ color: col, side: THREE.DoubleSide });
    const alas = [];
    for (const s of [-1, 1]) { const w = new THREE.Mesh(new THREE.CircleGeometry(0.07, 8), mat); w.geometry.translate(s * 0.07, 0, 0); const p = new THREE.Group(); p.add(w); g.add(p); alas.push([p, s]); }
    island.add(g); mariposas.push({ g, alas, cx: (rnd() - 0.5) * 12, cz: (rnd() - 0.5) * 12, ph: rnd() * 6.28, sp: 0.2 + rnd() * 0.25, rad: 0.8 + rnd() * 1.6 });
  }

  function update(t) {
    llamas.forEach((f, i) => { const k = 1 + Math.sin(t * (9 + i * 3) + i) * 0.16; f.scale.set(1 / k, k, 1 / k); f.rotation.y = t * 2 + i; });
    luzFuego.intensity = 1.5 + Math.sin(t * 13) * 0.18 + Math.sin(t * 5.3) * 0.2;
    for (const m of mariposas) {
      const a = t * m.sp + m.ph, x = m.cx + Math.cos(a) * m.rad, z = m.cz + Math.sin(a * 1.3) * m.rad;
      const r = Math.hypot(x, z); const xx = r > 9.5 ? x * 9.5 / r : x, zz = r > 9.5 ? z * 9.5 / r : z;
      m.g.position.set(xx, groundY(xx, zz) + 0.65 + Math.sin(a * 2.2) * 0.25, zz); m.g.rotation.y = -a * 1.3 + 1.5;
      const fl = Math.sin(t * 26 + m.ph) * 0.9; for (const [p, s] of m.alas) p.rotation.z = s * (0.25 + Math.abs(fl));
    }
  }

  // evita obstáculos al caminar: devuelve un empuje
  function empuje(x, z, rPersona = 0.28) {
    let ex = 0, ez = 0;
    for (const o of obst) { const dx = x - o.x, dz = z - o.z, d = Math.hypot(dx, dz), lim = o.r + rPersona; if (d < lim && d > 1e-4) { ex += dx / d * (lim - d); ez += dz / d * (lim - d); } }
    const r = Math.hypot(x, z), R = 8.6; if (r > R) { ex -= x / r * (r - R); ez -= z / r * (r - R); }
    return [ex, ez];
  }
  const libre = (x, z) => Math.hypot(x, z) < 7.6 && obst.every(o => Math.hypot(o.x - x, o.z - z) > o.r + 0.55);

  return { island, groundY: sueloY, empuje, libre, update, pond, casa, RC };
}
