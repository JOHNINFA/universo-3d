import * as THREE from 'three';
import { fbm, vnoise, mix, clamp, smooth, planetTexture } from './util.js';

export const GRAMA = [74, 132, 60];   // verde base del césped (la isla y la textura del planeta coinciden)

function radial() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
}

function atmosphere(r, color, power = 3, gain = 1.6) {
  return new THREE.Mesh(new THREE.SphereGeometry(r, 48, 32), new THREE.ShaderMaterial({
    uniforms: { c: { value: color }, p: { value: power }, g: { value: gain } }, transparent: true, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false,
    vertexShader: 'varying vec3 vN; void main(){ vN = normalize(normalMatrix*normal); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'uniform vec3 c; uniform float p; uniform float g; varying vec3 vN; void main(){ float i = pow(max(0.0, 0.75 - dot(vN, vec3(0.,0.,1.))), p); gl_FragColor = vec4(c, 1.0) * i * g; }',
  }));
}

// Direccion (en la malla) del punto donde esta el mundo habitado
export const ISLA_DIR = new THREE.Vector3(0.28, 0.42, 1).normalize();

export function buildUniverso(scene) {
  // ---- estrellas
  const N = 6000, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const r = 5000 + Math.random() * 800, a = Math.random() * 6.283, b = Math.acos(2 * Math.random() - 1);
    pos.set([r * Math.sin(b) * Math.cos(a), r * Math.cos(b), r * Math.sin(b) * Math.sin(a)], i * 3);
    const c = new THREE.Color().setHSL(Math.random() < 0.5 ? 0.6 : 0.1, 0.4, 0.6 + Math.random() * 0.4); col.set([c.r, c.g, c.b], i * 3);
  }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); sg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const starMat = new THREE.PointsMaterial({ size: 1.7, sizeAttenuation: false, vertexColors: true, fog: false, transparent: true });
  scene.add(new THREE.Points(sg, starMat));

  // ---- nebulosas
  const nebulas = [];
  for (let i = 0; i < 7; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: radial(), color: [0x4b2a8a, 0x1f4a8a, 0x8a2a5a][i % 3], opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
    const a = i / 7 * Math.PI * 2 + 0.5;
    s.scale.set(2600 + (i % 3) * 700, 1500 + (i % 2) * 600, 1); s.position.set(Math.cos(a) * 3800, -400 + (i % 3) * 500, Math.sin(a) * 3800); scene.add(s); nebulas.push(s);
  }

  // ---- sol (el centro del universo)
  const sunLight = new THREE.PointLight(0xfff1dc, 3.0, 0, 0); scene.add(sunLight);
  const sunMesh = new THREE.Mesh(new THREE.SphereGeometry(50, 32, 24), new THREE.MeshBasicMaterial({ color: 0xfff2c4, fog: false })); scene.add(sunMesh);
  for (const [sc, c, o] of [[420, 0xffd9a0, 1], [1100, 0xffb060, 0.5]]) {
    const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: radial(), color: c, opacity: o, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
    glow.scale.set(sc, sc, 1); scene.add(glow);
  }

  // ---- planetas
  const planetas = [];
  function crear(def, colorFn, texW = 512) {
    const group = new THREE.Group(); scene.add(group);
    const spin = new THREE.Group(); group.add(spin);
    const body = new THREE.Mesh(new THREE.SphereGeometry(def.R, 96, 64), new THREE.MeshStandardMaterial({ map: planetTexture(THREE, texW, texW / 2, colorFn), roughness: def.rough ?? 0.9 }));
    spin.add(body);
    const p = { ...def, group, spin, body, ang: def.ang0 };
    if (def.atm) group.add(atmosphere(def.R * 1.07, new THREE.Color(def.atm), 3, def.atmGain ?? 1.6));
    // linea de orbita
    const pts = []; for (let i = 0; i <= 160; i++) { const a = i / 160 * Math.PI * 2; pts.push(new THREE.Vector3(Math.cos(a) * def.orbita, 0, Math.sin(a) * def.orbita)); }
    p.orbitLine = new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), new THREE.LineBasicMaterial({ color: 0x6f86c8, transparent: true, opacity: 0.16, fog: false }));
    scene.add(p.orbitLine);
    planetas.push(p); return p;
  }

  const cobre = crear({ id: 'cobre', nombre: 'Cobre', R: 12, orbita: 150, vel: 0.011, ang0: 0.4, spinVel: 0.03,
    info: 'Un mundo pequeño y rocoso, cerca del sol. Sin habitantes todavía.' },
    (x, y, z) => { const n = fbm(x * 4, y * 4, z * 4, 5); const crater = vnoise(x * 12, y * 12, z * 12) > 0.8 ? 0.65 : 1; const c = mix([120, 92, 74], [196, 160, 120], n); return c.map(v => v * crater); });

  const aurora = crear({ id: 'aurora', nombre: 'Aurora', R: 46, orbita: 280, vel: 0.0065, ang0: 3.9, spinVel: 0.0012, atm: 0x6aa7ff, habitado: true,
    info: 'El mundo con vida. Tiene un valle con seis habitantes.' },
    (x, y, z, lat) => {
      let n = fbm(x * 2.6 + 3, y * 2.6, z * 2.6, 6);
      const cosd = x * ISLA_DIR.x + y * ISLA_DIR.y + z * ISLA_DIR.z;
      const ang = Math.acos(clamp(cosd, -1, 1));
      n += 0.45 * Math.exp(-(ang * ang) / (2 * 0.32 * 0.32));          // el valle del mundo siempre es tierra
      if (Math.abs(lat) > 1.3) return [240, 244, 250];
      if (n > 0.52) {
        const h = (n - 0.52) / 0.3, dry = fbm(x * 4, y * 4 + 9, z * 4, 4);
        let c = mix(GRAMA.map(v => v * 0.9), [150, 130, 82], clamp(dry * 0.95 + h * 0.5 - 0.15, 0, 1));
        const cerca = Math.exp(-(ang * ang) / (2 * 0.2 * 0.2));        // cerca del valle: puro verde
        c = mix(c, GRAMA, cerca);
        if (h > 0.8) c = mix(c, [235, 235, 240], (h - 0.8) * 4);
        return c;
      }
      const d = Math.min(1, (0.52 - n) / 0.25); return mix([44, 124, 178], [8, 30, 90], d);
    }, 1024);
  // nubes de Aurora
  const nubes = new THREE.Mesh(new THREE.SphereGeometry(aurora.R * 1.018, 64, 48), new THREE.MeshStandardMaterial({
    map: planetTexture(THREE, 512, 256, (x, y, z) => { const n = fbm(x * 3 + 7, y * 4, z * 3, 6); return [255, 255, 255, Math.min(255, Math.max(0, (n - 0.52) * 3.4) * 255)]; }),
    transparent: true, roughness: 1, depthWrite: false }));
  aurora.spin.add(nubes); aurora.nubes = nubes;

  crear({ id: 'ambar', nombre: 'Ámbar', R: 28, orbita: 430, vel: 0.0042, ang0: 1.3, spinVel: 0.012, atm: 0xff9a60, atmGain: 0.7,
    info: 'Un planeta rojizo con anillos. Todavía sin habitantes.' },
    (x, y, z) => { const n = fbm(x * 3 + 20, y * 6, z * 3, 5); return mix([150, 70, 40], [225, 155, 92], n); });
  const ambar = planetas[planetas.length - 1];
  {
    const ringG = new THREE.RingGeometry(38, 62, 128); const rp = ringG.attributes.position, uv = ringG.attributes.uv;
    for (let i = 0; i < rp.count; i++) { const r = Math.hypot(rp.getX(i), rp.getY(i)); uv.setXY(i, (r - 38) / 24, 0.5); }
    const rc0 = document.createElement('canvas'); rc0.width = 256; rc0.height = 2; const rc = rc0.getContext('2d');
    const gr = rc.createLinearGradient(0, 0, 256, 0); gr.addColorStop(0, 'rgba(230,200,160,0)'); gr.addColorStop(0.15, 'rgba(230,200,160,.8)'); gr.addColorStop(0.5, 'rgba(200,170,130,.4)'); gr.addColorStop(0.7, 'rgba(235,210,170,.85)'); gr.addColorStop(1, 'rgba(230,200,160,0)');
    rc.fillStyle = gr; rc.fillRect(0, 0, 256, 2);
    const ring = new THREE.Mesh(ringG, new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(rc0), side: THREE.DoubleSide, transparent: true, depthWrite: false }));
    ring.rotation.x = Math.PI / 2.4; ambar.group.add(ring);
  }

  crear({ id: 'coral', nombre: 'Coral', R: 62, orbita: 610, vel: 0.0028, ang0: 5.2, spinVel: 0.02, atm: 0xffb0a0, atmGain: 0.55,
    info: 'Un gigante de gas con bandas de colores. No se puede pisar.' },
    (x, y, z) => {
      const w = fbm(x * 2, y * 3, z * 2, 4) * 0.35; const b = Math.sin((y + w) * 17) * 0.5 + 0.5 + Math.sin((y + w) * 41) * 0.12;
      return mix(mix([230, 188, 160], [190, 108, 92], clamp(b, 0, 1)), [245, 225, 205], fbm(x * 6, y * 22, z * 6, 3) * 0.5);
    });

  crear({ id: 'glaciar', nombre: 'Glaciar', R: 22, orbita: 790, vel: 0.0021, ang0: 2.4, spinVel: 0.015, atm: 0xa8e6ff, atmGain: 1.1,
    info: 'Un mundo de hielo azul. Silencioso y sin habitantes.' },
    (x, y, z) => { const n = fbm(x * 3, y * 3, z * 3, 5); const cr = Math.abs(vnoise(x * 9, y * 9, z * 9) - 0.5) < 0.03 ? 0.78 : 1; return mix([170, 215, 240], [238, 247, 255], n).map(v => v * cr); });

  // ---- luna de Aurora
  const luna = new THREE.Mesh(new THREE.SphereGeometry(10, 48, 32), new THREE.MeshStandardMaterial({
    map: planetTexture(THREE, 384, 192, (x, y, z) => { const n = fbm(x * 5, y * 5, z * 5, 5); const c = 110 + n * 110; const k = vnoise(x * 14, y * 14, z * 14) > 0.82 ? 0.7 : 1; return [c * k, c * k, c * k * 0.97]; }), roughness: 1 }));
  scene.add(luna);

  const tmp = new THREE.Vector3();
  function update(t) {
    for (const p of planetas) {
      p.ang = p.ang0 + t * p.vel;
      p.group.position.set(Math.cos(p.ang) * p.orbita, Math.sin(p.ang * 1.7 + p.ang0) * p.orbita * 0.02, Math.sin(p.ang) * p.orbita);
      if (!p.fijo) p.spin.rotation.y = p.spinVel * t + (p.spin0 || 0);
    }
    aurora.nubes.rotation.y = t * 0.0009;
    aurora.nubes.visible = aurora.nubesOn !== false;
    luna.position.copy(aurora.group.position).add(tmp.set(Math.cos(t * 0.03) * 105, 12, Math.sin(t * 0.03) * 105)); luna.rotation.y = t * 0.01;
  }
  update(0);
  return { planetas, aurora, luna, update, starMat, sunLight, nebulas };
}
