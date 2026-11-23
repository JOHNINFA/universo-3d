import * as THREE from 'three';

function hash(x, y, z) { let h = Math.sin(x * 127.1 + y * 311.7 + z * 74.7) * 43758.5453; return h - Math.floor(h); }
function vnoise(x, y, z) {
  const xi = Math.floor(x), yi = Math.floor(y), zi = Math.floor(z), xf = x - xi, yf = y - yi, zf = z - zi;
  const s = t => t * t * (3 - 2 * t), u = s(xf), v = s(yf), w = s(zf);
  const l = (a, b, t) => a + (b - a) * t;
  return l(l(l(hash(xi, yi, zi), hash(xi + 1, yi, zi), u), l(hash(xi, yi + 1, zi), hash(xi + 1, yi + 1, zi), u), v),
           l(l(hash(xi, yi, zi + 1), hash(xi + 1, yi, zi + 1), u), l(hash(xi, yi + 1, zi + 1), hash(xi + 1, yi + 1, zi + 1), u), v), w);
}
function fbm(x, y, z, o = 5) { let a = 0.5, s = 0, f = 1; for (let i = 0; i < o; i++) { s += a * vnoise(x * f, y * f, z * f); f *= 2; a *= 0.5; } return s; }

// textura esférica sin costuras: muestreo 3D por píxel
function planetTexture(w, h, colorFn) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const ctx = c.getContext('2d'); const img = ctx.createImageData(w, h);
  for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
    const lon = (i / w) * Math.PI * 2, lat = (j / h - 0.5) * Math.PI;
    const x = Math.cos(lat) * Math.cos(lon), y = Math.sin(lat), z = Math.cos(lat) * Math.sin(lon);
    const [r, g, b, a = 255] = colorFn(x, y, z, lat); const k = (j * w + i) * 4; img.data[k] = r; img.data[k + 1] = g; img.data[k + 2] = b; img.data[k + 3] = a;
  }
  ctx.putImageData(img, 0, 0); const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.anisotropy = 4; return t;
}
const mix = (a, b, t) => a.map((v, i) => v + (b[i] - v) * t);

export function buildSpace(scene) {
  scene.background = new THREE.Color(0x02030a);
  // estrellas
  const N = 5000, pos = new Float32Array(N * 3), col = new Float32Array(N * 3);
  for (let i = 0; i < N; i++) {
    const r = 1500 + Math.random() * 500, a = Math.random() * 6.283, b = Math.acos(2 * Math.random() - 1);
    pos.set([r * Math.sin(b) * Math.cos(a), r * Math.cos(b), r * Math.sin(b) * Math.sin(a)], i * 3);
    const c = new THREE.Color().setHSL(Math.random() < 0.5 ? 0.6 : 0.1, 0.4, 0.6 + Math.random() * 0.4); col.set([c.r, c.g, c.b], i * 3);
  }
  const sg = new THREE.BufferGeometry(); sg.setAttribute('position', new THREE.BufferAttribute(pos, 3)); sg.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: 3.2, sizeAttenuation: false, vertexColors: true, fog: false }));
  scene.add(stars);

  // luces: sol + relleno
  const sun = new THREE.DirectionalLight(0xfff1dc, 3.2);
  sun.position.set(30, 40, 25); sun.castShadow = true;
  sun.shadow.mapSize.set(1024, 1024); const sc = sun.shadow.camera; sc.left = -10; sc.right = 10; sc.top = 10; sc.bottom = -10; sc.near = 1; sc.far = 120; sun.shadow.bias = -0.0005;
  scene.add(sun);
  scene.add(new THREE.HemisphereLight(0x8fb4ff, 0x2a3a22, 0.7));
  const sunDir = sun.position.clone().normalize();

  // Sol visible (lejano)
  const sunMesh = new THREE.Mesh(new THREE.SphereGeometry(60, 24, 16), new THREE.MeshBasicMaterial({ color: 0xfff2c4, fog: false }));
  sunMesh.position.copy(sunDir).multiplyScalar(1100); scene.add(sunMesh);
  const glow = new THREE.Sprite(new THREE.SpriteMaterial({ map: radial(), color: 0xffd9a0, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
  glow.scale.set(700, 700, 1); glow.position.copy(sunMesh.position); scene.add(glow);

  // Tierra
  const earthTex = planetTexture(768, 384, (x, y, z, lat) => {
    const n = fbm(x * 2.2 + 3, y * 2.2, z * 2.2, 6);
    const ice = Math.abs(lat) > 1.25 ? 1 : 0;
    if (n > 0.52) {
      const h = (n - 0.52) / 0.3; const dry = fbm(x * 4, y * 4 + 9, z * 4, 4);
      let c = mix([58, 120, 56], [150, 130, 80], Math.min(1, dry * 1.4 * 0.7 + h * 0.5));
      if (h > 0.75) c = mix(c, [235, 235, 240], (h - 0.75) * 3);
      return ice ? [240, 244, 250] : c;
    }
    const d = Math.min(1, (0.52 - n) / 0.25); const c = mix([40, 120, 175], [8, 30, 90], d); return ice ? [240, 244, 250] : c;
  });
  const cloudTex = planetTexture(768, 384, (x, y, z) => { const n = fbm(x * 3 + 7, y * 4, z * 3, 6); const a = Math.max(0, (n - 0.5) * 3.2); return [255, 255, 255, Math.min(255, a * 255)]; });
  const earth = new THREE.Group(); earth.position.set(-70, 28, -150); scene.add(earth);
  const E = 45;
  const body = new THREE.Mesh(new THREE.SphereGeometry(E, 64, 48), new THREE.MeshStandardMaterial({ map: earthTex, roughness: 0.75 })); earth.add(body);
  const clouds = new THREE.Mesh(new THREE.SphereGeometry(E * 1.012, 64, 48), new THREE.MeshStandardMaterial({ map: cloudTex, transparent: true, roughness: 1, depthWrite: false })); earth.add(clouds);
  earth.add(atmosphere(E * 1.08, new THREE.Color(0x5aa8ff), sunDir));
  earth.rotation.z = 0.4;

  // Luna
  const moonTex = planetTexture(384, 192, (x, y, z) => { const n = fbm(x * 5, y * 5, z * 5, 5); const c = 110 + n * 110; const crater = vnoise(x * 14, y * 14, z * 14) > 0.82 ? 0.7 : 1; return [c * crater, c * crater, c * crater * 0.97]; });
  const moon = new THREE.Mesh(new THREE.SphereGeometry(11, 48, 32), new THREE.MeshStandardMaterial({ map: moonTex, roughness: 1 })); scene.add(moon);

  // Planeta rojizo con anillo
  const marsTex = planetTexture(512, 256, (x, y, z) => { const n = fbm(x * 3 + 20, y * 6, z * 3, 5); return mix([150, 70, 40], [220, 150, 90], n); });
  const mars = new THREE.Group(); mars.position.set(160, -20, -260); scene.add(mars);
  mars.add(new THREE.Mesh(new THREE.SphereGeometry(26, 48, 32), new THREE.MeshStandardMaterial({ map: marsTex, roughness: 0.95 })));
  const ringG = new THREE.RingGeometry(36, 58, 96); const rp = ringG.attributes.position, uv = ringG.attributes.uv;
  for (let i = 0; i < rp.count; i++) { const r = Math.hypot(rp.getX(i), rp.getY(i)); uv.setXY(i, (r - 36) / 22, 0.5); }
  const ringC = document.createElement('canvas'); ringC.width = 256; ringC.height = 2; const rc = ringC.getContext('2d');
  const gr = rc.createLinearGradient(0, 0, 256, 0); gr.addColorStop(0, 'rgba(230,200,160,0)'); gr.addColorStop(0.15, 'rgba(230,200,160,.8)'); gr.addColorStop(0.5, 'rgba(200,170,130,.4)'); gr.addColorStop(0.7, 'rgba(235,210,170,.85)'); gr.addColorStop(1, 'rgba(230,200,160,0)');
  rc.fillStyle = gr; rc.fillRect(0, 0, 256, 2);
  const ring = new THREE.Mesh(ringG, new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(ringC), side: THREE.DoubleSide, transparent: true, depthWrite: false }));
  ring.rotation.x = Math.PI / 2.4; mars.add(ring);

  // Nebulosa (sprites)
  for (let i = 0; i < 6; i++) {
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: radial(), color: [0x4b2a8a, 0x1f4a8a, 0x8a2a5a][i % 3], opacity: 0.18, blending: THREE.AdditiveBlending, depthWrite: false, transparent: true }));
    s.scale.set(700 + Math.random() * 400, 400 + Math.random() * 300, 1); s.position.set(-600 + Math.random() * 1200, -100 + Math.random() * 400, -1000 - Math.random() * 300); scene.add(s);
  }

  return {
    update(t) {
      body.rotation.y = t * 0.02; clouds.rotation.y = t * 0.027;
      moon.position.set(earth.position.x + Math.cos(t * 0.05) * 95, earth.position.y + 8, earth.position.z + Math.sin(t * 0.05) * 95); moon.rotation.y = t * 0.01;
      mars.rotation.y = t * 0.01;
    },
  };
}

function radial() {
  const c = document.createElement('canvas'); c.width = c.height = 128; const x = c.getContext('2d');
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64); g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.3, 'rgba(255,255,255,.35)'); g.addColorStop(1, 'rgba(255,255,255,0)');
  x.fillStyle = g; x.fillRect(0, 0, 128, 128); return new THREE.CanvasTexture(c);
}

function atmosphere(r, color, sunDir) {
  return new THREE.Mesh(new THREE.SphereGeometry(r, 48, 32), new THREE.ShaderMaterial({
    uniforms: { c: { value: color } }, transparent: true, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false,
    vertexShader: 'varying vec3 vN; void main(){ vN = normalize(normalMatrix*normal); gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
    fragmentShader: 'uniform vec3 c; varying vec3 vN; void main(){ float i = pow(max(0.0, 0.75 - dot(vN, vec3(0.,0.,1.))), 3.0); gl_FragColor = vec4(c, 1.0) * i * 1.6; }',
  }));
}
