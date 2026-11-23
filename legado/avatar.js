import * as THREE from 'three';
import { clamp } from './util.js';

const std = (color, rough = 0.7, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });
const mesh = (geo, mat, x = 0, y = 0, z = 0, sombra = true) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = sombra; return m; };
// extremidad que cuelga desde su articulación (y=0) hasta y=-len
const limb = (rTop, rBot, len, mat, seg = 14) => { const geo = new THREE.CylinderGeometry(rTop, rBot, len, seg, 1); geo.translate(0, -len / 2, 0); return mesh(geo, mat); };
const lerp = (a, b, t) => a + (b - a) * t;

function cabezaGeo(d) {
  const geo = new THREE.SphereGeometry(1, 56, 42), p = geo.attributes.position;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const bajo = y < 0 ? Math.pow(-y, 1.35) : 0;
    x *= 0.078 * (1 - 0.30 * bajo);                       // mandíbula que se afina hacia el mentón
    z *= 0.098 * (1 - 0.12 * bajo * (z < 0 ? 1 : 0.4));
    y *= 0.118;
    if (y < -0.07 && z > 0) z += 0.006 * (-y - 0.07) * 20; // mentón levemente hacia adelante
    if (z > 0 && y > 0.02 && y < 0.08) z += 0.002;          // frente
    p.setXYZ(i, x, y, z);
  }
  geo.computeVertexNormals(); return geo;
}

// Ser del mundo: articulado (cadera, rodilla, hombro, codo), camina de verdad, respira, parpadea, conversa y mira alrededor.
export function buildAvatar(d) {
  const F = d.sexo === 'F';
  const g = new THREE.Group();
  const piel = std(d.piel, 0.58), pelo = std(d.pelo, 0.5), top = std(d.arriba, 0.85), pant = std(d.abajo, 0.9), zap = std(d.zapatos, 0.6);
  const labio = std(new THREE.Color(d.piel).lerp(new THREE.Color(0xb04a4a), 0.45).getHex(), 0.45);
  const manga = d.capucha || d.mangaLarga;

  // ---- pelvis y piernas
  const pelvis = new THREE.Group(); pelvis.position.y = 0.95; g.add(pelvis);
  const cad = mesh(new THREE.SphereGeometry(1, 20, 14), d.vestido ? piel : pant); cad.scale.set(F ? 0.175 : 0.16, 0.1, 0.105); pelvis.add(cad);
  const piernas = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(s * (F ? 0.085 : 0.082), -0.02, 0); pelvis.add(hip);
    const mp = d.vestido ? piel : pant;
    hip.add(limb(F ? 0.082 : 0.078, 0.058, 0.46, mp));
    const rodilla = new THREE.Group(); rodilla.position.y = -0.46; hip.add(rodilla);
    rodilla.add(mesh(new THREE.SphereGeometry(0.058, 14, 10), mp));
    rodilla.add(limb(0.056, 0.038, 0.42, mp));
    const tobillo = new THREE.Group(); tobillo.position.y = -0.42; rodilla.add(tobillo);
    const pie = mesh(new THREE.CapsuleGeometry(0.042, 0.13, 6, 12), zap, 0, -0.035, 0.05); pie.rotation.x = Math.PI / 2; pie.scale.set(1.05, 1, 0.85); tobillo.add(pie);
    tobillo.add(mesh(new THREE.BoxGeometry(0.098, 0.022, 0.25), std(0xeeeeee, 0.9), 0, -0.07, 0.05));
    piernas.push({ hip, rodilla, tobillo, s });
  }

  // ---- torso (curvas distintas según silueta)
  const torso = new THREE.Group(); torso.position.y = 0.06; pelvis.add(torso);
  {
    const pts = F ? [[0.12, 0], [0.118, 0.07], [0.128, 0.16], [0.16, 0.27], [0.168, 0.35], [0.165, 0.41], [0.12, 0.465], [0.052, 0.5]]
                  : [[0.14, 0], [0.142, 0.08], [0.155, 0.19], [0.18, 0.3], [0.2, 0.38], [0.19, 0.44], [0.13, 0.485], [0.055, 0.5]];
    const geo = new THREE.LatheGeometry(pts.map(([r, y]) => new THREE.Vector2(r, y)), 28); geo.scale(1, 1, 0.64);
    torso.add(mesh(geo, top));
    if (d.vestido) {      // falda del vestido
      const fp = [[0.125, 0.04], [0.17, -0.12], [0.235, -0.34], [0.27, -0.5]]; const fg = new THREE.LatheGeometry(fp.map(([r, y]) => new THREE.Vector2(r, y)), 28);
      const f = mesh(fg, top); f.material = top.clone(); f.material.side = THREE.DoubleSide; pelvis.add(f);
    } else if (!d.camisaSuelta) {
      torso.add(mesh(new THREE.CylinderGeometry(0.146, 0.142, 0.03, 20), std(0x2a2522, 0.6), 0, 0.01, 0, false)).scale.z = 0.64; // cinturón
    }
    if (d.capucha) { const h = mesh(new THREE.TorusGeometry(0.1, 0.045, 10, 22), top, 0, 0.5, -0.05); h.rotation.x = Math.PI / 2 - 0.35; torso.add(h); }
    else { const cu = mesh(new THREE.TorusGeometry(0.058, 0.014, 8, 20), F ? top : std(0xf2f2f2, 0.9), 0, 0.495, 0.01); cu.rotation.x = Math.PI / 2; torso.add(cu); }
  }

  // ---- brazos
  const brazos = [], ancho = F ? 0.178 : 0.2;
  for (const s of [-1, 1]) {
    const sho = new THREE.Group(); sho.position.set(s * ancho, 0.455, 0); torso.add(sho);
    sho.add(mesh(new THREE.SphereGeometry(0.062, 16, 12), manga || !d.sinMangas ? top : piel));
    sho.add(limb(0.05, 0.041, 0.285, manga ? top : piel));
    if (!manga) sho.add(limb(0.056, 0.049, 0.13, top));                        // manga corta
    const codo = new THREE.Group(); codo.position.y = -0.285; sho.add(codo);
    codo.add(mesh(new THREE.SphereGeometry(0.043, 12, 10), manga ? top : piel));
    codo.add(limb(0.041, 0.031, 0.25, manga ? top : piel));
    const muneca = new THREE.Group(); muneca.position.y = -0.25; codo.add(muneca);
    const mano = mesh(new THREE.SphereGeometry(1, 14, 10), piel, 0, -0.055, 0); mano.scale.set(0.034, 0.062, 0.022); muneca.add(mano);
    const pulgar = mesh(new THREE.CapsuleGeometry(0.011, 0.04, 4, 8), piel, -s * 0.028, -0.04, 0.012); pulgar.rotation.z = -s * 0.5; muneca.add(pulgar);
    if (manga) muneca.add(mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.025, 12), top, 0, -0.01, 0, false));
    brazos.push({ sho, codo, muneca, s });
  }

  // ---- cuello y cabeza
  const cuello = mesh(new THREE.CylinderGeometry(0.042, 0.05, 0.12, 14), piel, 0, 1.5, 0); g.add(cuello);
  const cabeza = new THREE.Group(); cabeza.position.set(0, 1.565, 0); g.add(cabeza);
  const cara = new THREE.Group(); cara.position.y = 0.09; cabeza.add(cara);            // origen = centro del cráneo
  cara.add(mesh(cabezaGeo(d), piel));
  for (const s of [-1, 1]) {                                                           // orejas
    const o = mesh(new THREE.SphereGeometry(1, 12, 10), piel, s * 0.077, -0.004, -0.004); o.scale.set(0.009, 0.024, 0.017); cara.add(o);
  }
  // nariz
  const nar = mesh(new THREE.SphereGeometry(1, 14, 10), piel, 0, -0.012, 0.093); nar.scale.set(0.011, 0.024, 0.016); nar.rotation.x = -0.25; cara.add(nar);
  cara.add(mesh(new THREE.SphereGeometry(0.0105, 12, 10), piel, 0, -0.028, 0.1));
  for (const s of [-1, 1]) cara.add(mesh(new THREE.SphereGeometry(0.0072, 10, 8), piel, s * 0.0105, -0.026, 0.093, false));
  // ojos
  const ojos = [], cejas = [], iris = std(d.ojos || 0x3a2416, 0.25);
  for (const s of [-1, 1]) {
    const ojo = new THREE.Group(); ojo.position.set(s * 0.035, 0.014, 0.077); ojo.rotation.y = s * 0.33; cara.add(ojo);
    const blanco = mesh(new THREE.SphereGeometry(0.0165, 18, 14), std(0xf6f2ee, 0.25), 0, 0, 0, false); blanco.scale.set(1, 0.82, 0.5); ojo.add(blanco);
    const pupilaG = new THREE.Group(); ojo.add(pupilaG);
    const ir = mesh(new THREE.SphereGeometry(0.0098, 16, 12), iris, 0, 0, 0.0035, false); ir.scale.set(1, 1, 0.42); pupilaG.add(ir);
    const pu = mesh(new THREE.SphereGeometry(0.0048, 12, 10), std(0x050505, 0.2), 0, 0, 0.0062, false); pu.scale.set(1, 1, 0.3); pupilaG.add(pu);
    const br = mesh(new THREE.SphereGeometry(0.0022, 8, 6), new THREE.MeshBasicMaterial({ color: 0xffffff }), 0.003, 0.003, 0.0078, false); pupilaG.add(br);
    const parpado = mesh(new THREE.TorusGeometry(0.0158, 0.0016, 6, 20, Math.PI * 1.02), std(F ? 0x241512 : 0x2a1a14, 0.6), 0, 0.001, 0.003, false); parpado.rotation.z = -0.05; ojo.add(parpado);
    const ceja = mesh(new THREE.BoxGeometry(0.034, F ? 0.0045 : 0.0065, 0.007), pelo, s * 0.036, 0.043, 0.081, false); ceja.rotation.y = s * 0.33; ceja.rotation.z = s * -0.07; cara.add(ceja);
    const rubor = new THREE.Mesh(new THREE.CircleGeometry(0.017, 16), new THREE.MeshBasicMaterial({ color: 0xff8a7a, transparent: true, opacity: 0.16, depthWrite: false }));
    rubor.position.set(s * 0.05, -0.03, 0.074); rubor.rotation.y = s * 0.7; cara.add(rubor);
    ojos.push({ ojo, pupilaG, s }); cejas.push({ ceja, y0: 0.043, s });
  }
  // boca
  const boca = new THREE.Group(); boca.position.set(0, -0.058, 0.082); cara.add(boca);
  const interior = mesh(new THREE.SphereGeometry(1, 12, 8), std(0x3a0f12, 0.8), 0, -0.002, -0.002, false); interior.scale.set(0.014, 0.001, 0.006); boca.add(interior);
  const labioSup = mesh(new THREE.SphereGeometry(1, 14, 8), labio, 0, 0.003, 0.003, false); labioSup.scale.set(0.0215, 0.0048, 0.0075); boca.add(labioSup);
  const labioInf = mesh(new THREE.SphereGeometry(1, 14, 8), labio, 0, -0.0045, 0.003, false); labioInf.scale.set(0.019, 0.0055, 0.0075); boca.add(labioInf);
  const comisuras = [-1, 1].map(s => { const c = mesh(new THREE.SphereGeometry(0.0035, 8, 6), labio, s * 0.0215, 0.0005, 0.0015, false); boca.add(c); return c; });
  // accesorios
  if (d.lentes) {
    const mm = std(0x1a1a1a, 0.4);
    for (const s of [-1, 1]) { const a = mesh(new THREE.TorusGeometry(0.0225, 0.0022, 8, 24), mm, s * 0.037, 0.014, 0.093, false); a.rotation.y = s * 0.2; cara.add(a); }
    cara.add(mesh(new THREE.BoxGeometry(0.026, 0.003, 0.003), mm, 0, 0.018, 0.097, false));
    for (const s of [-1, 1]) cara.add(mesh(new THREE.BoxGeometry(0.003, 0.003, 0.085), mm, s * 0.068, 0.016, 0.05, false));
  }
  if (d.barba) {
    const bg = new THREE.SphereGeometry(1, 28, 16, 0, Math.PI * 2, Math.PI * 0.46, Math.PI * 0.4); const b = mesh(bg, pelo, 0, 0, 0.001, false); b.scale.set(0.0805, 0.119, 0.1); b.rotation.x = 0.0; cara.add(b);
    const bigote = mesh(new THREE.SphereGeometry(1, 12, 8), pelo, 0, -0.045, 0.092, false); bigote.scale.set(0.024, 0.006, 0.01); cara.add(bigote);
  }

  // ---- pelo
  {
    const st = d.peloEstilo;
    const casco = new THREE.SphereGeometry(1, 40, 26, 0, Math.PI * 2, 0, Math.PI * 0.53); const cp = casco.attributes.position;
    for (let i = 0; i < cp.count; i++) { const k = 1 + (Math.sin(cp.getX(i) * 40 + cp.getZ(i) * 31) + Math.sin(cp.getY(i) * 53)) * 0.012; cp.setXYZ(i, cp.getX(i) * k, cp.getY(i) * k, cp.getZ(i) * k); }
    casco.computeVertexNormals();
    const c = mesh(casco, pelo, 0, 0.004, -0.004); c.scale.set(0.085, 0.124, 0.106); c.rotation.x = -0.72; cara.add(c);
    if (st !== 'rizo') {
      for (const s of [-1, 1]) { const p = mesh(new THREE.SphereGeometry(1, 12, 10), pelo, s * 0.071, 0.025, 0.015, false); p.scale.set(0.014, 0.036, 0.034); cara.add(p); }
    }
    if (st === 'corto') {
      const t = mesh(new THREE.SphereGeometry(1, 16, 12), pelo, 0, 0.098, 0.035); t.scale.set(0.058, 0.032, 0.05); t.rotation.x = -0.25; cara.add(t);
    } else if (st === 'larga') {
      const b = mesh(new THREE.CapsuleGeometry(0.083, 0.2, 8, 16), pelo, 0, -0.13, -0.045); b.scale.set(1, 1, 0.58); cara.add(b);
      for (const s of [-1, 1]) { const m = mesh(new THREE.CapsuleGeometry(0.02, 0.2, 6, 10), pelo, s * 0.076, -0.07, 0.035); m.rotation.z = s * 0.06; cara.add(m); }
    } else if (st === 'cola') {
      const c2 = mesh(new THREE.CapsuleGeometry(0.03, 0.2, 6, 12), pelo, 0, -0.04, -0.125); c2.rotation.x = -0.35; cara.add(c2);
      cara.add(mesh(new THREE.TorusGeometry(0.03, 0.007, 8, 14), std(0xd04a6a, 0.6), 0, 0.045, -0.1, false)).rotation.x = Math.PI / 2 - 0.5;
    } else if (st === 'moño') {
      cara.add(mesh(new THREE.SphereGeometry(0.05, 18, 14), pelo, 0, 0.12, -0.05));
    } else if (st === 'rizo') {
      for (let i = 0; i < 46; i++) {
        const a = Math.random() * Math.PI * 2, e = Math.pow(Math.random(), 0.8) * 1.15; const x = Math.sin(e) * Math.cos(a) * 0.085, y = Math.cos(e) * 0.122, z = Math.sin(e) * Math.sin(a) * 0.1 - 0.005;
        if (z > 0.03 && y < 0.07) continue;
        cara.add(mesh(new THREE.SphereGeometry(0.03 + Math.random() * 0.01, 10, 8), pelo, x, y + 0.005, z, false));
      }
    }
    if (d.flequillo) { const fq = mesh(new THREE.SphereGeometry(1, 20, 12, 0, Math.PI * 2, 0.15, 0.7), pelo, 0, 0.055, 0.055); fq.scale.set(0.082, 0.07, 0.07); fq.rotation.x = -0.15; cara.add(fq); }
  }

  g.traverse(o => { if (o.isMesh) o.receiveShadow = false; });

  // ---------- Animación ----------
  const W = { camina: 0, habla: 0, saluda: 0, fase: Math.random() * 6.28, mira: new THREE.Vector2(), mirada: new THREE.Vector2(), parp: 2 + Math.random() * 3, ant: 0, cabY: 0, cabX: 0 };
  const tmp = new THREE.Vector3(), tmp2 = new THREE.Vector3();
  const semilla = Math.random() * 100;

  // s: { velocidad (u/s en el mundo), habla: bool, saluda: bool, mirar: Vector3 mundo | null, escucha: bool }
  function update(dt, t, s) {
    const aCam = 1 - Math.exp(-dt * 6);
    const vel = s.velocidad || 0, camina = clamp(vel / 0.9, 0, 1.25);
    W.camina += (Math.min(camina, 1) - W.camina) * aCam;
    W.habla += ((s.habla ? 1 : 0) - W.habla) * (1 - Math.exp(-dt * 5));
    W.saluda += ((s.saluda ? 1 : 0) - W.saluda) * (1 - Math.exp(-dt * 5));
    W.fase += dt * (vel / 0.52) * Math.PI;                                // un paso cada 0.52 unidades recorridas
    const ph = W.fase, wk = W.camina, idle = 1 - wk;

    // pelvis: balanceo, rebote al caminar y apoyo en una pierna cuando está quieto
    pelvis.position.y = 0.95 - Math.abs(Math.sin(ph)) * 0.026 * wk + Math.sin(t * 2.2 + semilla) * 0.003 * idle;
    pelvis.position.x = Math.sin(ph) * 0.014 * wk + Math.sin(t * 0.45 + semilla) * 0.012 * idle;
    pelvis.rotation.y = -Math.sin(ph) * 0.11 * wk + Math.sin(t * 0.37 + semilla) * 0.05 * idle;
    pelvis.rotation.z = Math.sin(ph) * 0.03 * wk + Math.sin(t * 0.45 + semilla) * 0.035 * idle;
    // torso: contra-giro, inclinación y respiración
    const resp = Math.sin(t * 1.9 + semilla);
    torso.rotation.y = Math.sin(ph) * 0.13 * wk + (-pelvis.rotation.y) * 0.5 * idle;
    torso.rotation.x = 0.06 * wk + resp * 0.012 + W.habla * Math.sin(t * 2.3) * 0.02;
    torso.rotation.z = -pelvis.rotation.z * 0.6;
    torso.scale.set(1 + resp * 0.012, 1 + resp * 0.018, 1 + resp * 0.02);

    // piernas
    for (const p of piernas) {
      const f = p.s > 0 ? ph : ph + Math.PI;                               // piernas en contrafase
      const quieto = (p.s > 0 ? 1 : -1) * Math.sin(t * 0.45 + semilla);   // una pierna descansa, la otra carga el peso
      p.hip.rotation.x = -Math.sin(f) * 0.62 * wk + idle * (quieto > 0 ? 0.04 : -0.02);
      p.rodilla.rotation.x = (0.1 + Math.max(0, Math.cos(f)) * 0.95) * wk + idle * (quieto > 0 ? 0.1 : 0.02);
      p.tobillo.rotation.x = (Math.sin(f) * 0.22 - Math.max(0, Math.cos(f)) * 0.3) * wk;
      p.hip.rotation.z = p.s * 0.02 * idle;
    }

    // brazos: balanceo opuesto a las piernas, gestos al hablar, saludo
    for (const b of brazos) {
      const f = b.s > 0 ? ph : ph + Math.PI;
      let hx = Math.sin(f) * 0.5 * wk + Math.sin(t * 1.3 + b.s + semilla) * 0.03 * idle;
      let cx = -0.28 - 0.35 * wk - 0.04 * idle - Math.max(0, -Math.sin(f)) * 0.3 * wk;
      let hz = b.s * (0.07 + 0.02 * Math.sin(t * 1.1 + semilla)) * idle + b.s * 0.04 * wk;
      let cy = 0;
      if (b.s > 0) {
        // gesticula con la mano derecha al hablar
        const g1 = Math.sin(t * 2.7 + semilla) * 0.5 + 0.5, g2 = Math.sin(t * 4.1) * 0.5 + 0.5;
        hx -= W.habla * (0.75 + g1 * 0.35); cx -= W.habla * (0.55 + g2 * 0.5); hz += W.habla * 0.12;
      } else {
        hx -= W.habla * 0.12; cx -= W.habla * 0.25;
      }
      if (b.s < 0) {                                                       // saluda con el brazo izquierdo (el que ve la cámara)
        hz = lerp(hz, -(Math.PI * 0.82 + Math.sin(t * 1.6) * 0.04), W.saluda); hx = lerp(hx, 0, W.saluda);
        cx = lerp(cx, -0.35 + Math.sin(t * 9) * 0.45, W.saluda);
      }
      b.sho.rotation.set(hx, cy, hz); b.codo.rotation.x = cx; b.muneca.rotation.z = b.s * 0.05;
    }

    // mirada: la cabeza gira hacia lo que mira (con inercia) y los ojos se adelantan un poco
    let yawT = Math.sin(t * 0.31 + semilla) * 0.25, pitchT = Math.sin(t * 0.23 + semilla) * 0.04;
    if (s.mirar) {
      tmp.copy(s.mirar); g.worldToLocal(tmp); tmp.y -= 1.65;
      yawT = Math.atan2(tmp.x, tmp.z);
      pitchT = Math.atan2(tmp.y, Math.hypot(tmp.x, tmp.z));
    }
    const yawC = clamp(yawT, -1.1, 1.1), pitC = clamp(pitchT, -0.35, 0.3);
    W.cabY += (yawC * 0.8 - W.cabY) * (1 - Math.exp(-dt * 4)); W.cabX += (-pitC * 0.8 - W.cabX) * (1 - Math.exp(-dt * 4));
    cabeza.rotation.y = W.cabY + Math.sin(t * 2.0) * 0.015 * W.habla;
    cabeza.rotation.x = W.cabX + (W.habla * Math.sin(t * 3.1) * 0.04) + (s.escucha ? Math.max(0, Math.sin(t * 1.4 + semilla)) * 0.06 : 0);
    cabeza.rotation.z = Math.sin(t * 0.5 + semilla) * 0.025;
    for (const o of ojos) {
      o.pupilaG.position.x += (clamp((yawC - W.cabY) * 0.01, -0.004, 0.004) - o.pupilaG.position.x) * 0.2;
      o.pupilaG.position.y += (clamp(-(pitC * 0.8 - (-W.cabX)) * 0.004, -0.003, 0.003) - o.pupilaG.position.y) * 0.2;
    }

    // parpadeo (con parpadeos dobles de vez en cuando)
    W.parp -= dt; let cierre = 0;
    if (W.parp < 0) { W.parp = 2.2 + Math.random() * 4; W.cierra = 0.15; if (Math.random() < 0.2) W.parp = 0.35; }
    if (W.cierra > 0) { W.cierra -= dt; cierre = Math.sin(clamp(1 - W.cierra / 0.15, 0, 1) * Math.PI); }
    for (const o of ojos) o.ojo.scale.y = 1 - cierre * 0.92;

    // cejas y boca (sonrisa leve, se abre al hablar o saludar)
    const abre = W.habla * (0.25 + 0.75 * Math.abs(Math.sin(t * 11 + Math.sin(t * 3) * 2))) * (0.5 + 0.5 * Math.abs(Math.sin(t * 5.3)));
    const sonrisa = 0.55 + 0.4 * W.saluda + 0.1 * Math.sin(t * 0.4 + semilla);
    labioInf.position.y = -0.0045 - abre * 0.012; labioInf.scale.y = 0.0055 + abre * 0.002;
    interior.scale.y = 0.001 + abre * 0.0095; interior.position.y = -0.002 - abre * 0.005;
    comisuras.forEach((c, i) => { c.position.y = 0.0005 + sonrisa * 0.0035 - abre * 0.002; c.position.x = (i ? 1 : -1) * (0.0205 + sonrisa * 0.0022); });
    boca.rotation.z = 0;
    for (const c of cejas) c.ceja.position.y = c.y0 + (W.saluda * 0.004) + W.habla * Math.max(0, Math.sin(t * 2.4 + c.s)) * 0.004;
  }

  return { group: g, update, cabeza, boca, ojos, W };
}
