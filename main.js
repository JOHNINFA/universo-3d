import * as THREE from 'three';
import { buildAvatar } from './avatar.js';
import { buildSpace } from './space.js';

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(1);
renderer.setSize(innerWidth, innerHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
renderer.outputColorSpace = THREE.SRGBColorSpace;
document.body.appendChild(renderer.domElement);

const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(45, innerWidth / innerHeight, 0.1, 4000);

const space = buildSpace(scene);
const fill = new THREE.DirectionalLight(0xffffff, 1.6); fill.position.set(0.5, 1, 2); camera.add(fill); fill.target.position.set(0, 0, -5); camera.add(fill.target); scene.add(camera);

// Isla donde viven los personajes
const island = new THREE.Group();
island.position.set(0, 0, 0);
scene.add(island);
const ground = new THREE.Mesh(
  new THREE.CylinderGeometry(7, 5.2, 1.2, 64),
  new THREE.MeshStandardMaterial({ color: 0x4f9a4a, roughness: 0.95 }));
ground.position.y = -0.6; ground.receiveShadow = true; island.add(ground);
const rock = new THREE.Mesh(
  new THREE.ConeGeometry(5.2, 4, 40),
  new THREE.MeshStandardMaterial({ color: 0x6b5a4a, roughness: 1, flatShading: true }));
rock.position.y = -3.2; rock.rotation.x = Math.PI; island.add(rock);
// árboles y piedras simples
function tree(x, z, s = 1) {
  const g = new THREE.Group();
  const t = new THREE.Mesh(new THREE.CylinderGeometry(.12*s,.18*s,1.2*s,8), new THREE.MeshStandardMaterial({color:0x6b4a2b,roughness:1}));
  t.position.y = .6*s; t.castShadow = true; g.add(t);
  for (let i = 0; i < 3; i++) {
    const c = new THREE.Mesh(new THREE.IcosahedronGeometry((.75-i*.15)*s, 1), new THREE.MeshStandardMaterial({color:0x2f7d3a+i*0x0a1200,roughness:.9,flatShading:true}));
    c.position.y = (1.4+i*.55)*s; c.castShadow = true; g.add(c);
  }
  g.position.set(x, 0, z); island.add(g);
}
for (let k = 0; k < 9; k++) { const a = k / 9 * Math.PI * 2 + 0.3; const r = 5.7 + (k % 2) * 0.6; tree(Math.cos(a) * r, Math.sin(a) * r, 0.8 + (k % 3) * 0.2); }

// Personajes (estilo avatar Xbox)
const gente = [
  { nombre: 'Valentina', rol: 'Exploradora', piel: 0xf1c7a5, pelo: 0x3b2417, peloEstilo: 'cola', arriba: 0x394350, abajo: 0x5b8fc7, zapatos: 0xf2f2f2, capucha: true },
  { nombre: 'Mateo', rol: 'Ingeniero', piel: 0xd9a77e, pelo: 0x1c1a19, peloEstilo: 'corto', arriba: 0xc8553d, abajo: 0x30343b, zapatos: 0x2a2a2a },
  { nombre: 'Camila', rol: 'Astrónoma', piel: 0xe8b894, pelo: 0xb8602a, peloEstilo: 'larga', arriba: 0x6b4fb3, abajo: 0x22262e, zapatos: 0xe9e2d0 },
  { nombre: 'Santiago', rol: 'Piloto', piel: 0x9c6b4a, pelo: 0x0f0e0e, peloEstilo: 'rizo', arriba: 0x2e7d6b, abajo: 0x8a7a5c, zapatos: 0x1f1f1f, capucha: true },
  { nombre: 'Sofía', rol: 'Bióloga', piel: 0xf6d5bd, pelo: 0xe3c07a, peloEstilo: 'moño', arriba: 0xe9a23b, abajo: 0x4a6fa5, zapatos: 0xffffff },
  { nombre: 'Andrés', rol: 'Músico', piel: 0xc58f68, pelo: 0x4a2c17, peloEstilo: 'corto', arriba: 0x1d2b53, abajo: 0x3a3a3a, zapatos: 0xd04a35 },
];
const avatars = [];
const R = 3.2;
gente.forEach((d, i) => {
  const a = buildAvatar(d);
  const ang = (i / gente.length) * Math.PI * 2 + Math.PI / 6;
  a.group.position.set(Math.cos(ang) * R, 0, Math.sin(ang) * R);
  a.group.rotation.y = Math.atan2(-Math.cos(ang), -Math.sin(ang));
  a.base = a.group.rotation.y; a.fase = i * 1.3; a.data = d;
  island.add(a.group); avatars.push(a);
});

// Cámara orbital simple
let theta = 0.4, phi = 1.25, dist = 14, target = new THREE.Vector3(0, 1.4, 0), targetGoal = target.clone(), distGoal = dist;
let drag = null, moved = 0;
const el = renderer.domElement;
el.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY }; moved = 0; });
addEventListener('pointerup', e => { if (drag && moved < 5) pick(e); drag = null; });
addEventListener('pointermove', e => {
  if (!drag) return;
  const dx = e.clientX - drag.x, dy = e.clientY - drag.y; moved += Math.abs(dx) + Math.abs(dy);
  theta -= dx * 0.006; phi = Math.min(1.5, Math.max(0.35, phi - dy * 0.005));
  drag = { x: e.clientX, y: e.clientY }; auto = false;
});
el.addEventListener('wheel', e => { distGoal = Math.min(30, Math.max(3.5, distGoal + e.deltaY * 0.01)); e.preventDefault(); }, { passive: false });
let auto = true;

const ray = new THREE.Raycaster();
function pick(e) {
  ray.setFromCamera(new THREE.Vector2(e.clientX / innerWidth * 2 - 1, -(e.clientY / innerHeight) * 2 + 1), camera);
  const hit = ray.intersectObjects(avatars.map(a => a.group), true)[0];
  if (hit) { const a = avatars.find(a => { let o = hit.object; while (o) { if (o === a.group) return true; o = o.parent; } }); select(a); }
}
let sel = null;
const card = document.getElementById('card');
const bar = document.getElementById('chars');
avatars.forEach(a => {
  const b = document.createElement('button'); b.textContent = a.data.nombre; b.onclick = () => select(a); a.btn = b; bar.appendChild(b);
});
function select(a) {
  sel = a; auto = false;
  avatars.forEach(x => x.btn.classList.toggle('on', x === a));
  card.style.display = 'block';
  card.innerHTML = `<b>${a.data.nombre}</b><br><span style="opacity:.7">${a.data.rol}</span><br><br>Habitante del Mundo 1. Te saluda con la mano.`;
  const p = new THREE.Vector3(); a.group.getWorldPosition(p);
  targetGoal.set(p.x, 1.3, p.z); distGoal = 3.3;
  // girar cámara para ver de frente
  theta = Math.atan2(p.x, p.z) + Math.PI; phi = 1.38;
}
addEventListener('keydown', e => { if (e.key === 'Escape') { sel = null; targetGoal.set(0, 1.4, 0); distGoal = 14; card.style.display = 'none'; avatars.forEach(x => x.btn.classList.remove('on')); auto = true; } });

addEventListener('resize', () => { camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix(); renderer.setSize(innerWidth, innerHeight); });

const clock = new THREE.Clock();
function loop() {
  const dt = Math.min(clock.getDelta(), 0.5), t = clock.elapsedTime, k = 1 - Math.exp(-dt * 4);
  if (auto) theta += dt * 0.05;
  target.lerp(targetGoal, k); dist += (distGoal - dist) * k;
  camera.position.set(target.x + Math.sin(theta) * Math.sin(phi) * dist, target.y + Math.cos(phi) * dist, target.z + Math.cos(theta) * Math.sin(phi) * dist);
  camera.lookAt(target);
  space.update(t);
  avatars.forEach(a => a.update(t + a.fase, a === sel));
  island.position.y = Math.sin(t * 0.5) * 0.12;
  renderer.render(scene, camera);
  requestAnimationFrame(loop);
}
loop();
