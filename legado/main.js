import * as THREE from 'three';
import { buildAvatar } from './avatar.js';
import { buildUniverso, ISLA_DIR } from './space.js';
import { buildWorld } from './world.js';
import { clamp, smooth } from './util.js';

/* ---------- Renderer, escena, cámara ---------- */
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5));
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);
const scene = new THREE.Scene();
scene.background = new THREE.Color(0x02030a);
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.05, 9000);

/* ---------- Universo, planeta con vida y mundo dentro ---------- */
const uni = buildUniverso(scene);
const aurora = uni.aurora, RP = aurora.R;
const mundo = buildWorld(RP);
const isla = mundo.island;
isla.position.copy(ISLA_DIR).multiplyScalar(RP);
isla.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), ISLA_DIR);
aurora.spin.add(isla);

// que la mañana empiece con el sol alto sobre el valle
{
  const sunDir = aurora.group.position.clone().negate().normalize(), q = new THREE.Quaternion(); let best = 0, bd = 9;
  for (let k = 0; k < 360; k++) {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), k / 360 * Math.PI * 2); const n = ISLA_DIR.clone().applyQuaternion(q);
    const e = Math.abs(n.dot(sunDir) - 0.78); if (e < bd) { bd = e; best = k / 360 * Math.PI * 2; }
  }
  aurora.spin0 = best;
}

/* ---------- Cielo (aparece al bajar a la atmósfera) ---------- */
const cielo = new THREE.Mesh(new THREE.SphereGeometry(4000, 24, 16), new THREE.ShaderMaterial({
  uniforms: { arriba: { value: new THREE.Vector3(0, 1, 0) }, zen: { value: new THREE.Color(0x2c68b8) }, hor: { value: new THREE.Color(0xa6cdf0) }, amt: { value: 0 } },
  vertexShader: 'varying vec3 vD; void main(){ vD = position; gl_Position = projectionMatrix*modelViewMatrix*vec4(position,1.); }',
  fragmentShader: 'uniform vec3 arriba; uniform vec3 zen; uniform vec3 hor; uniform float amt; varying vec3 vD; void main(){ float h = dot(normalize(vD), arriba); float t = smoothstep(-0.1, 0.75, h); gl_FragColor = vec4(mix(vec3(0.008,0.012,0.04), mix(hor, zen, t), amt), 1.0); }',
  side: THREE.BackSide, depthWrite: false, depthTest: false, fog: false }));
cielo.renderOrder = -10; cielo.frustumCulled = false; scene.add(cielo);

/* ---------- Luces ---------- */
const sol = new THREE.DirectionalLight(0xfff1dc, 0);
sol.castShadow = true; sol.shadow.mapSize.set(1536, 1536); sol.shadow.bias = -0.0004; sol.shadow.normalBias = 0.04;
{ const c = sol.shadow.camera; c.left = -15; c.right = 15; c.top = 15; c.bottom = -15; c.near = 1; c.far = 220; }
scene.add(sol, sol.target);
const hemi = new THREE.HemisphereLight(0x9ec4ff, 0x2a3a22, 0.3); scene.add(hemi);

/* ---------- Seres del mundo ---------- */
const gente = [
  { nombre: 'Valentina', rol: 'Exploradora', frase: 'Siempre anda buscando algo nuevo al otro lado del estanque.', sexo: 'F', altura: 0.97, piel: 0xf1c7a5, pelo: 0x4a2a17, peloEstilo: 'cola', flequillo: true, arriba: 0x394350, abajo: 0x5b8fc7, zapatos: 0xf2f2f2, capucha: true, ojos: 0x4a3020,
    dice: ['Detrás de esas rocas vi huellas raras.', '¿Quién se anima a explorar el borde del valle?', 'Ese estanque tiene algo escondido, lo juro.'] },
  { nombre: 'Mateo', rol: 'Ingeniero', frase: 'Arregla todo lo que se rompe y habla de puentes.', sexo: 'M', altura: 1.04, piel: 0xd9a77e, pelo: 0x1c1a19, peloEstilo: 'corto', arriba: 0xc8553d, abajo: 0x30343b, zapatos: 0x2a2a2a, lentes: true, ojos: 0x2b1a10,
    dice: ['Podemos hacer un puente sobre el estanque.', 'La casa necesita un techo más firme.', 'Con un par de tablas esto queda perfecto.'] },
  { nombre: 'Camila', rol: 'Astrónoma', frase: 'De noche cuenta las estrellas desde el tronco junto al fuego.', sexo: 'F', altura: 0.99, piel: 0xe8b894, pelo: 0xa85a28, peloEstilo: 'larga', flequillo: true, arriba: 0x6b4fb3, abajo: 0x22262e, zapatos: 0xe9e2d0, vestido: true, ojos: 0x5a3a1e,
    dice: ['Esta noche se ve el planeta de los anillos.', 'Desde aquí la luna se ve enorme.', '¿Sabías que Ámbar tiene anillos?'] },
  { nombre: 'Santiago', rol: 'Piloto', frase: 'Llegó volando y todavía no sabe si quedarse.', sexo: 'M', altura: 1.06, piel: 0x9c6b4a, pelo: 0x0f0e0e, peloEstilo: 'rizo', arriba: 0x2e7d6b, abajo: 0x8a7a5c, zapatos: 0x1f1f1f, capucha: true, barba: true, ojos: 0x1c120a,
    dice: ['Desde arriba este mundo se ve diminuto.', 'Mañana despego, si el viento deja.', 'Cuéntenme qué pasó mientras volaba.'] },
  { nombre: 'Sofía', rol: 'Bióloga', frase: 'Conoce el nombre de cada flor y cada mariposa del valle.', sexo: 'F', altura: 0.95, piel: 0xf6d5bd, pelo: 0xd9b46a, peloEstilo: 'moño', arriba: 0xe9a23b, abajo: 0x4a6fa5, zapatos: 0xffffff, ojos: 0x3c5e7a,
    dice: ['¡Miren, las mariposas amarillas volvieron!', 'Esas flores solo abren con el sol.', 'El estanque está lleno de vida.'] },
  { nombre: 'Andrés', rol: 'Músico', frase: 'Toca de noche junto a la fogata y todos se quedan a escuchar.', sexo: 'M', altura: 1.0, piel: 0xc58f68, pelo: 0x4a2c17, peloEstilo: 'corto', arriba: 0x1d2b53, abajo: 0x3a3a3a, zapatos: 0xd04a35, mangaLarga: true, ojos: 0x3a2416,
    dice: ['Esta noche toco algo junto al fuego.', 'Qué silencio tan lindo hay hoy.', 'Se me ocurrió una canción del estanque.'] },
];
const dichosComunes = ['Qué buen día hace hoy.', '¿Vieron cómo brilla el estanque?', 'Me encanta este mundo.', 'Ya casi es hora de la fogata.', '¿Quién trae algo de beber?', 'Miren cómo se mueven las nubes.'];

const personas = [];
const R0 = 2.3;
gente.forEach((d, i) => {
  const a = buildAvatar(d);
  a.group.scale.setScalar(0.78 * d.altura);
  const ang = (i / gente.length) * Math.PI * 2 + 0.4;
  const p = { a, d, nombre: d.nombre, x: Math.cos(ang) * R0, z: Math.sin(ang) * R0, yaw: Math.atan2(-Math.cos(ang), -Math.sin(ang)) + Math.PI / 2, estado: 'quieto', t: 1 + Math.random() * 4,
    vel: 0, vmax: 0.75 + Math.random() * 0.3, tx: 0, tz: 0, atasco: 0, habla: false, escucha: false, mira: null, miraT: 0, pareja: null, bub: null };
  p.yaw = Math.atan2(-p.x, -p.z);
  isla.add(a.group); a.group.position.set(p.x, mundo.groundY(p.x, p.z), p.z); a.group.rotation.y = p.yaw;
  personas.push(p);
});

/* ---------- Comportamiento: caminan, se detienen, se miran y conversan ---------- */
const wrap = a => Math.atan2(Math.sin(a), Math.cos(a));
const pw = new THREE.Vector3(), pw2 = new THREE.Vector3();
function cabezaMundo(p, out) { return p.a.cabeza.getWorldPosition(out); }
function puntoLibre() { for (let k = 0; k < 40; k++) { const a = Math.random() * 6.283, r = Math.sqrt(Math.random()) * 7.4; const x = Math.cos(a) * r, z = Math.sin(a) * r; if (mundo.libre(x, z)) return [x, z]; } return [0, 2.5]; }
let conv = null, proxConv = 4;
function iniciarConversacion() {
  const libres = personas.filter(p => (p.estado === 'quieto' || p.estado === 'camina') && p !== sel);
  if (libres.length < 2) return;
  const a = libres[Math.floor(Math.random() * libres.length)]; let b = libres.filter(p => p !== a).sort((u, v) => Math.hypot(u.x - a.x, u.z - a.z) - Math.hypot(v.x - a.x, v.z - a.z))[Math.floor(Math.random() * 2)] || libres.find(p => p !== a);
  let m = puntoLibre(); const dx = b.x - a.x, dz = b.z - a.z, L = Math.hypot(dx, dz) || 1, nx = -dz / L, nz = dx / L;
  const ax = m[0] + nx * 0.55, az = m[1] + nz * 0.55, bx = m[0] - nx * 0.55, bz = m[1] - nz * 0.55;
  if (!mundo.libre(ax, az) || !mundo.libre(bx, bz)) return;
  a.estado = 'va-charla'; b.estado = 'va-charla'; a.tx = ax; a.tz = az; b.tx = bx; b.tz = bz; a.pareja = b; b.pareja = a; a.atasco = b.atasco = 0;
  conv = { a, b, fase: 'va', t: 0, dur: 9 + Math.random() * 8, turno: 0, quien: a, tTurno: 0 };
}
function terminarConversacion() {
  if (!conv) return;
  for (const p of [conv.a, conv.b]) { if (p.estado !== 'seleccionado') { p.estado = 'quieto'; p.t = 0.6 + Math.random() * 2; } p.habla = false; p.escucha = false; p.pareja = null; ocultarBurbuja(p); }
  conv = null; proxConv = 5 + Math.random() * 9;
}
function decirAlgo(p) { const v = Math.random() < 0.65 ? p.d.dice : dichosComunes; mostrarBurbuja(p, v[Math.floor(Math.random() * v.length)]); }

function moverPersona(p, dt) {
  // meta: caminar hacia (tx,tz)
  let velObj = 0;
  if (p.estado === 'camina' || p.estado === 'va-charla') {
    const dx = p.tx - p.x, dz = p.tz - p.z, d = Math.hypot(dx, dz);
    if (d < 0.14) { if (p.estado === 'camina') { p.estado = 'quieto'; p.t = 2 + Math.random() * 7; } else p.llego = true; }
    else {
      velObj = p.vmax * smooth(0.0, 0.7, d) * 0.6 + p.vmax * 0.4;                // frena al llegar
      const objetivo = Math.atan2(dx, dz), dy = wrap(objetivo - p.yaw);
      p.yaw += clamp(dy, -4.5 * dt, 4.5 * dt);
      velObj *= 1 - 0.7 * smooth(0.6, 2.2, Math.abs(dy));                          // primero gira, después avanza
    }
  }
  p.vel += (velObj - p.vel) * (1 - Math.exp(-dt * 6));
  const px = p.x, pz = p.z;
  p.x += Math.sin(p.yaw) * p.vel * dt; p.z += Math.cos(p.yaw) * p.vel * dt;
  // obstáculos y otras personas
  const [ex, ez] = mundo.empuje(p.x, p.z); p.x += ex; p.z += ez;
  for (const o of personas) if (o !== p) { const dx = p.x - o.x, dz = p.z - o.z, d = Math.hypot(dx, dz), lim = o === p.pareja ? 0.55 : 0.75; if (d < lim && d > 1e-4) { p.x += dx / d * (lim - d) * 0.5; p.z += dz / d * (lim - d) * 0.5; } }
  const real = Math.hypot(p.x - px, p.z - pz) / Math.max(dt, 1e-3);
  if (velObj > 0.3 && real < velObj * 0.3) { p.atasco += dt; if (p.atasco > 1.6) { p.atasco = 0; if (p.estado === 'camina') { [p.tx, p.tz] = puntoLibre(); } else p.llego = true; } } else p.atasco = Math.max(0, p.atasco - dt);
  return real;
}

function actualizarPersona(p, dt, t) {
  p.t -= dt; p.miraT -= dt;
  if (p.estado === 'seleccionado') {
    p.vel += (0 - p.vel) * (1 - Math.exp(-dt * 6));
    pw.copy(camera.position); isla.worldToLocal(pw); const objetivo = Math.atan2(pw.x - p.x, pw.z - p.z);
    p.yaw += clamp(wrap(objetivo - p.yaw), -3.2 * dt, 3.2 * dt);
    p.mira = camera.position; p.habla = false; p.escucha = false;
    p.a.update(dt, t, { velocidad: 0, saluda: (t - p.selT) < 4.5, mirar: camera.position, habla: (t - p.selT) < 4.5 });
  } else {
    if (p.estado === 'quieto' && p.t <= 0) { p.estado = 'camina'; [p.tx, p.tz] = puntoLibre(); p.atasco = 0; }
    if (p.estado === 'va-charla' && p.llego) { p.estado = 'charla'; p.llego = false; }
    // mirada: hacia la pareja, o hacia quien pasa cerca
    if (p.estado === 'charla' && p.pareja) { cabezaMundo(p.pareja, pw2); p.mira = pw2.clone(); }
    else if (p.miraT <= 0) {
      p.miraT = 2 + Math.random() * 4; p.mira = null;
      if (Math.random() < 0.55) { const cerca = personas.filter(o => o !== p && Math.hypot(o.x - p.x, o.z - p.z) < 4).sort((u, v) => Math.hypot(u.x - p.x, u.z - p.z) - Math.hypot(v.x - p.x, v.z - p.z))[0]; if (cerca) p.mira = cabezaMundo(cerca, new THREE.Vector3()); }
      else if (Math.random() < 0.15) p.mira = camera.position.clone();
    }
    const real = moverPersona(p, dt);
    if (p.estado === 'charla' && p.pareja) {                                       // se miran de frente
      const objetivo = Math.atan2(p.pareja.x - p.x, p.pareja.z - p.z); p.yaw += clamp(wrap(objetivo - p.yaw), -3 * dt, 3 * dt);
    }
    p.a.update(dt, t, { velocidad: real, habla: p.habla, escucha: p.escucha, mirar: p.mira });
  }
  p.a.group.position.set(p.x, mundo.groundY(p.x, p.z), p.z);
  p.a.group.rotation.y = p.yaw;
}

function dirigir(dt, t) {
  if (!conv) { proxConv -= dt; if (proxConv <= 0) { iniciarConversacion(); proxConv = 3; } return; }
  const { a, b } = conv;
  if (a.estado === 'seleccionado' || b.estado === 'seleccionado') { terminarConversacion(); return; }
  if (conv.fase === 'va') {
    conv.t += dt; if (a.estado === 'charla' && b.estado === 'charla') { conv.fase = 'habla'; conv.t = 0; conv.quien = a; conv.tTurno = 0; a.habla = true; b.escucha = true; decirAlgo(a); }
    else if (conv.t > 14) terminarConversacion();
    return;
  }
  conv.t += dt; conv.tTurno += dt;
  if (conv.tTurno > 2.6 + Math.random() * 0.6) { conv.tTurno = 0; const o = conv.quien === a ? b : a; conv.quien.habla = false; conv.quien.escucha = true; ocultarBurbuja(conv.quien); conv.quien = o; o.habla = true; o.escucha = false; decirAlgo(o); }
  if (conv.t > conv.dur) terminarConversacion();
}

/* ---------- Burbujas de diálogo ---------- */
const burbujas = document.getElementById('burbujas');
function mostrarBurbuja(p, txt) { if (!p.bub) { p.bub = document.createElement('div'); p.bub.className = 'bub'; burbujas.appendChild(p.bub); } p.bub.textContent = txt; p.bub.style.display = 'block'; p.bubOn = true; }
function ocultarBurbuja(p) { p.bubOn = false; if (p.bub) p.bub.style.display = 'none'; }

/* ---------- Cámara: universo → planeta → mundo → ser ---------- */
let modo = 'universo', sel = null, focus = uni.planetas.find(p => p.id === 'aurora'), entrando = false;
const orb = { universo: { theta: 0.5, phi: 0.98, dist: 1750 }, planeta: { theta: 0, phi: 1.1, dist: 100 }, mundo: { theta: 3.1, phi: 1.15, dist: 11 }, ser: { theta: 0, phi: 1.4, dist: 3.4 } };
const meta = JSON.parse(JSON.stringify(orb));
const lookCur = new THREE.Vector3(), upCur = new THREE.Vector3(0, 1, 0), tmpQ = new THREE.Quaternion(), qI = new THREE.Quaternion(), tmpV = new THREE.Vector3(), tmpV2 = new THREE.Vector3();
let auto = true, cambioT = 99;

function marco(m) {   // punto de mira, orientación y "arriba" del modo
  const r = { look: tmpV2.set(0, 0, 0), q: qI.identity(), up: new THREE.Vector3(0, 1, 0) };
  if (m === 'planeta') r.look.copy(focus.group.position);
  else if (m === 'mundo' || m === 'ser') {
    isla.updateWorldMatrix(true, false); isla.getWorldQuaternion(tmpQ); r.q = tmpQ; r.up.set(0, 1, 0).applyQuaternion(tmpQ);
    if (m === 'mundo') { isla.getWorldPosition(r.look); r.look.addScaledVector(r.up, 0.9); }
    else { cabezaMundo(sel, r.look); r.look.addScaledVector(r.up, -0.28); }
  }
  return r;
}
function posDeseada(m, out) {
  const o = orb[m], f = marco(m), sp = Math.sin(o.phi);
  out.set(sp * Math.sin(o.theta), Math.cos(o.phi), sp * Math.cos(o.theta)).multiplyScalar(o.dist);
  if (m === 'mundo' || m === 'ser') out.applyQuaternion(f.q);
  out.add(f.look); return { pos: out, look: f.look.clone(), up: f.up };
}
function convertir(nuevo) {   // pasar de modo sin salto: calcula theta/phi/dist para que la cámara siga donde está
  const f = marco(nuevo); const rel = camera.position.clone().sub(f.look);
  if (nuevo === 'mundo' || nuevo === 'ser') rel.applyQuaternion(f.q.clone().invert());
  const d = rel.length() || 1; orb[nuevo] = { theta: Math.atan2(rel.x, rel.z), phi: Math.acos(clamp(rel.y / d, -1, 1)), dist: d };
  meta[nuevo] = { ...orb[nuevo] }; modo = nuevo; cambioT = 0; ui();
}
function suave(k, dt, wrapTheta) {
  for (const m of [modo]) {
    const o = orb[m], g = meta[m], kk = 1 - Math.exp(-dt * k);
    o.theta += wrap(g.theta - o.theta) * kk; o.phi += (g.phi - o.phi) * kk; o.dist += (g.dist - o.dist) * kk;
  }
}
const limites = () => ({ universo: [600, 3600], planeta: [focus.R * 1.4, focus.R * 9], mundo: [2.6, 30], ser: [1.3, 10] });

function elegirPlaneta(p) {
  sel = null; focus = p; entrando = false; auto = false;
  personas.forEach(x => { if (x.estado === 'seleccionado') { x.estado = 'quieto'; x.t = 1; } });
  convertir('planeta'); meta.planeta.dist = p.R * 3.6; meta.planeta.phi = clamp(orb.planeta.phi, 0.7, 1.5);
}
function entrarAlMundo() { if (!focus.habitado) return; if (modo === 'universo') { focus = aurora; convertir('planeta'); meta.planeta.dist = Math.min(orb.planeta.dist, RP * 5); } entrando = true; ui(); }
function volverAlUniverso() { sel = null; entrando = false; convertir('universo'); meta.universo.dist = 1750; meta.universo.phi = clamp(orb.universo.phi, 0.6, 1.3); auto = true; }
function salirDelMundo() { sel = null; entrando = false; personas.forEach(x => { if (x.estado === 'seleccionado') { x.estado = 'quieto'; x.t = 1; } }); convertir('planeta'); meta.planeta.dist = RP * 3.2; }
function volverAlMundo() {
  if (sel && sel.estado === 'seleccionado') { sel.estado = 'quieto'; sel.t = 1.5; }
  sel = null; convertir('mundo'); meta.mundo.dist = clamp(orb.mundo.dist, 6, 14); meta.mundo.phi = Math.min(1.35, Math.max(0.7, orb.mundo.phi));
}
function seleccionar(p) {
  if (modo === 'universo' || modo === 'planeta') return;
  if (sel && sel !== p && sel.estado === 'seleccionado') { sel.estado = 'quieto'; sel.t = 1; }
  sel = p; p.estado = 'seleccionado'; p.selT = clock.elapsedTime;
  if (conv && (conv.a === p || conv.b === p)) terminarConversacion();
  if (modo !== 'ser') convertir('ser'); else { ui(); }
  meta.ser = { theta: wrap(p.yaw + 0.3), phi: 1.42, dist: 3.4 };
  auto = false;
}
function atras() { if (modo === 'ser') volverAlMundo(); else if (modo === 'mundo') salirDelMundo(); else if (modo === 'planeta') volverAlUniverso(); }

/* ---------- Interfaz ---------- */
const $ = id => document.getElementById(id);
const card = $('card'), bar = $('chars'), btnEntrar = $('entrar'), btnAtras = $('atras'), ruta = $('ruta'), ayuda = $('ayuda'), etqs = $('etiquetas');
personas.forEach(p => { const b = document.createElement('button'); b.textContent = p.nombre; b.onclick = () => seleccionar(p); p.btn = b; bar.appendChild(b); });
uni.planetas.forEach(p => { const e = document.createElement('div'); e.className = 'etq'; e.innerHTML = `${p.nombre}${p.habitado ? ' <small>habitado</small>' : ''}`; e.onclick = ev => { ev.stopPropagation(); elegirPlaneta(p); }; p.etq = e; etqs.appendChild(e); });
btnEntrar.onclick = () => { entrarAlMundo(); btnEntrar.blur(); };
btnAtras.onclick = () => { atras(); btnAtras.blur(); };
function ui() {
  const enMundo = modo === 'mundo' || modo === 'ser';
  bar.style.display = enMundo ? 'flex' : 'none';
  btnAtras.style.display = modo === 'universo' ? 'none' : 'block';
  btnEntrar.style.display = modo === 'planeta' && focus.habitado && !entrando ? 'block' : (modo === 'universo' ? 'block' : 'none');
  btnEntrar.textContent = modo === 'universo' ? 'Ir al mundo con vida' : 'Entrar al mundo';
  etqs.style.display = modo === 'universo' ? 'block' : 'none';
  personas.forEach(p => p.btn.classList.toggle('on', p === sel));
  const partes = ['Universo']; if (modo !== 'universo') partes.push(focus.nombre); if (enMundo) partes.push('El valle'); if (modo === 'ser' && sel) partes.push(sel.nombre);
  ruta.textContent = partes.join('  ›  ');
  ayuda.textContent = { universo: 'Toca un planeta · arrastra para girar · rueda para acercar', planeta: focus.habitado ? 'Acércate con la rueda o toca “Entrar al mundo”' : 'Mira este mundo · rueda para alejar · Esc para volver', mundo: 'Toca a alguien para conocerlo · Esc para salir al espacio', ser: 'Esc para volver al valle' }[modo];
  if (modo === 'universo') card.style.display = 'none';
  else if (modo === 'planeta') { card.style.display = 'block'; card.innerHTML = `<b>${focus.nombre}</b><br><span style="opacity:.75">${focus.info}</span>`; }
  else if (modo === 'mundo') { card.style.display = 'block'; card.innerHTML = `<b>El valle de Aurora</b><br><span style="opacity:.75">Seis personas viven aquí: caminan, conversan y se juntan junto a la fogata.</span>`; }
  else if (sel) cardSer();
}
function estadoTxt(p) {
  if (p.estado === 'seleccionado') return 'Te está mirando.'; if (p.estado === 'charla') return `Conversando con ${p.pareja ? p.pareja.nombre : 'alguien'}.`;
  if (p.estado === 'va-charla') return `Va a hablar con ${p.pareja ? p.pareja.nombre : 'alguien'}.`; if (p.estado === 'camina') return 'Camina por el valle.'; return 'Descansando un momento.';
}
function cardSer() { if (!sel) return; card.style.display = 'block'; card.innerHTML = `<b>${sel.nombre}</b><br><span style="opacity:.75">${sel.d.rol}</span><br><br>${sel.d.frase}<br><br><i style="opacity:.8">${estadoTxt(sel)}</i>`; }

/* ---------- Entrada: arrastrar, pellizcar, rueda, clic ---------- */
const el = renderer.domElement, punteros = new Map(); let moved = 0, pinch0 = 0;
el.addEventListener('pointerdown', e => { el.setPointerCapture?.(e.pointerId); punteros.set(e.pointerId, { x: e.clientX, y: e.clientY }); moved = 0; if (punteros.size === 2) { const [a, b] = [...punteros.values()]; pinch0 = Math.hypot(a.x - b.x, a.y - b.y); } });
el.addEventListener('pointermove', e => {
  const p = punteros.get(e.pointerId); if (!p) return;
  if (punteros.size === 2) { const o = [...punteros.entries()].map(([k, v]) => k === e.pointerId ? { x: e.clientX, y: e.clientY } : v); const d = Math.hypot(o[0].x - o[1].x, o[0].y - o[1].y); if (pinch0) zoom(Math.log(pinch0 / d) * 420); pinch0 = d; moved = 99; p.x = e.clientX; p.y = e.clientY; return; }
  const dx = e.clientX - p.x, dy = e.clientY - p.y; moved += Math.abs(dx) + Math.abs(dy); p.x = e.clientX; p.y = e.clientY; auto = false;
  const m = meta[modo]; m.theta -= dx * 0.006; orb[modo].theta -= dx * 0.006;
  const lo = (modo === 'mundo' || modo === 'ser') ? 0.25 : 0.2, hi = (modo === 'mundo' || modo === 'ser') ? 1.62 : Math.PI - 0.2;
  m.phi = clamp(m.phi - dy * 0.005, lo, hi);
});
const finPuntero = e => { if (punteros.has(e.pointerId)) { if (punteros.size === 1 && moved < 6) pick(e); punteros.delete(e.pointerId); } };
el.addEventListener('pointerup', finPuntero); el.addEventListener('pointercancel', e => punteros.delete(e.pointerId));
function zoom(dy) {
  const m = meta[modo], lim = limites()[modo]; const antes = m.dist; m.dist = clamp(m.dist * Math.exp(dy * 0.0013), lim[0] * 0.98, lim[1] * 1.04);
  if (modo === 'planeta' && focus.habitado && dy < 0 && m.dist < RP * 1.46) entrarAlMundo();
  else if (modo === 'planeta' && dy > 0 && m.dist > lim[1]) volverAlUniverso();
  else if (modo === 'mundo' && dy > 0 && m.dist > lim[1]) salirDelMundo();
  else if (modo === 'ser' && dy > 0 && m.dist > lim[1]) volverAlMundo();
  if (entrando) m.dist = Math.max(m.dist, 0);
}
addEventListener('wheel', e => { if (e.target !== el) return; zoom(e.deltaY); e.preventDefault(); }, { passive: false });
addEventListener('keydown', e => { if (e.key === 'Escape') atras(); });

const ray = new THREE.Raycaster();
function pick(e) {
  ray.setFromCamera(new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), camera);
  if (modo === 'mundo' || modo === 'ser') {
    const hit = ray.intersectObjects(personas.map(p => p.a.group), true)[0];
    if (hit) { const p = personas.find(x => { let o = hit.object; while (o) { if (o === x.a.group) return true; o = o.parent; } return false; }); if (p) seleccionar(p); }
  } else {
    const hit = ray.intersectObjects(uni.planetas.map(p => p.body), false)[0];
    if (hit) { const p = uni.planetas.find(x => x.body === hit.object); if (p && (modo === 'universo' || p !== focus)) elegirPlaneta(p); }
  }
}
addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

/* ---------- Arranque directo desde el enlace (#universo, #planeta, #mundo, #ser=2) ---------- */
function irA(h) {
  const [m, v] = h.replace('#', '').split('='); if (!m) return;
  if (m === 'planeta' || m === 'mundo' || m === 'ser') { focus = aurora; }
  if (m === 'planeta') { modo = 'planeta'; orb.planeta = { theta: 0.4, phi: 1.15, dist: RP * 3.4 }; meta.planeta = { ...orb.planeta }; }
  if (m === 'mundo' || m === 'ser') { modo = 'mundo'; orb.mundo = { theta: 3.0, phi: 1.15, dist: 11 }; meta.mundo = { ...orb.mundo }; }
  if (m === 'ser') { const p = personas[parseInt(v || '0', 10) % personas.length]; sel = p; p.estado = 'seleccionado'; p.selT = 0; modo = 'ser'; orb.ser = { theta: wrap(p.yaw + 0.3), phi: 1.42, dist: 3.4 }; meta.ser = { ...orb.ser }; }
  cambioT = 99; auto = false; const q = new URLSearchParams(location.hash.split('&').slice(1).join('&')); if (q.get('d')) { meta[modo].dist = orb[modo].dist = parseFloat(q.get('d')); } if (q.get('p')) { meta[modo].phi = orb[modo].phi = parseFloat(q.get('p')); } if (q.get('t')) { meta[modo].theta = orb[modo].theta = parseFloat(q.get('t')); }
  ui();
}

window.__u = { scene, camera, personas, uni, mundo, THREE, get modo() { return modo; } };
const clock = new THREE.Clock();
let primera = true, tUi = 0;
const sunDirW = new THREE.Vector3(), islaPos = new THREE.Vector3(), islaUp = new THREE.Vector3(), cp = new THREE.Vector3();
function loop() {
  const dt = Math.min(clock.getDelta(), 0.1), t = clock.elapsedTime;
  if (primera) { // coloca el planeta antes de calcular nada
    uni.update(0); aurora.spin.rotation.y = aurora.spin0; if (location.hash.length > 1) irA(location.hash); else ui();
    const d0 = posDeseada(modo, cp.clone()); camera.position.copy(d0.pos); lookCur.copy(d0.look); upCur.copy(d0.up); primera = false;
  }
  uni.update(t); aurora.spin.rotation.y = aurora.spin0 + aurora.spinVel * t;
  mundo.update(t);
  personas.forEach(p => actualizarPersona(p, dt, t));
  dirigir(dt, t);

  // cámara
  if (auto && modo === 'universo') { meta.universo.theta += dt * 0.025; }
  if (entrando && modo === 'planeta') {
    isla.getWorldPosition(islaPos); const n = islaPos.clone().sub(aurora.group.position).normalize();
    meta.planeta.theta = Math.atan2(n.x, n.z); meta.planeta.phi = Math.acos(clamp(n.y, -1, 1)); meta.planeta.dist = RP * 1.62;
    const c = camera.position.clone().sub(aurora.group.position); const ang = c.angleTo(n);
    if (ang < 0.3 && orb.planeta.dist < RP * 1.95) { entrando = false; convertir('mundo'); meta.mundo = { theta: Math.PI + 0.4, phi: 1.12, dist: 11 }; }
  }
  suave(entrando ? 2.2 : 4.2, dt);
  const d = posDeseada(modo, cp);
  cambioT += dt; const fin = smooth(0, 1.8, cambioT);
  camera.position.lerp(d.pos, modo === 'universo' || modo === 'planeta' ? 1 : 1 - Math.exp(-dt * (6 + 22 * fin)));
  lookCur.lerp(d.look, 1 - Math.exp(-dt * (3.5 + 16 * fin))); upCur.lerp(d.up, 1 - Math.exp(-dt * 4)).normalize();
  camera.up.copy(upCur); camera.lookAt(lookCur);

  // cielo, estrellas y luces según la altura sobre Aurora y la hora del valle
  isla.getWorldPosition(islaPos); islaUp.set(0, 1, 0).applyQuaternion(isla.getWorldQuaternion(tmpQ));
  sunDirW.copy(islaPos).negate().normalize();
  const alt = camera.position.distanceTo(aurora.group.position) - RP;
  const mundoAmt = 1 - smooth(10, 34, alt);
  const dia = smooth(-0.12, 0.3, islaUp.dot(sunDirW));
  const cieloAmt = mundoAmt * dia;
  cielo.position.copy(camera.position); cielo.material.uniforms.arriba.value.copy(islaUp); cielo.material.uniforms.amt.value = cieloAmt;
  uni.starMat.opacity = 1 - cieloAmt * 0.97; for (const n of uni.nebulas) n.material.opacity = 0.2 * (1 - cieloAmt);
  uni.sunLight.intensity = 3.0 * (1 - mundoAmt * 0.85);
  sol.intensity = 2.8 * mundoAmt * dia; sol.position.copy(islaPos).addScaledVector(sunDirW, 90); sol.target.position.copy(islaPos); sol.target.updateMatrixWorld();
  hemi.intensity = 0.16 + 0.5 * mundoAmt * (0.35 + 0.65 * dia);
  aurora.nubesOn = mundoAmt < 0.5;

  // etiquetas de planetas, burbujas y tarjeta
  if (modo === 'universo') for (const p of uni.planetas) {
    tmpV.copy(p.group.position); tmpV.y += p.R * 1.35; tmpV.project(camera);
    const ok = tmpV.z < 1 && Math.abs(tmpV.x) < 1.05 && Math.abs(tmpV.y) < 1.05; p.etq.style.display = ok ? 'block' : 'none';
    if (ok) p.etq.style.transform = `translate(-50%,-100%) translate(${(tmpV.x * 0.5 + 0.5) * innerWidth}px,${(-tmpV.y * 0.5 + 0.5) * innerHeight}px)`;
  }
  const enMundo = modo === 'mundo' || modo === 'ser';
  for (const p of personas) if (p.bub) {
    const v = enMundo && p.bubOn; if (!v) { p.bub.style.display = 'none'; continue; }
    cabezaMundo(p, tmpV); tmpV.addScaledVector(islaUp, 0.32); tmpV.project(camera);
    const ok = tmpV.z < 1 && tmpV.z > -1 && Math.abs(tmpV.x) < 1.1; p.bub.style.display = ok ? 'block' : 'none';
    if (ok) p.bub.style.transform = `translate(-50%,-100%) translate(${(tmpV.x * 0.5 + 0.5) * innerWidth}px,${(-tmpV.y * 0.5 + 0.5) * innerHeight}px)`;
  }
  if (modo === 'ser' && (tUi += dt) > 0.6) { tUi = 0; cardSer(); }
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
loop();
