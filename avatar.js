import * as THREE from 'three';

const std = (color, rough = 0.7, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: rough, ...extra });
const mesh = (geo, mat, x = 0, y = 0, z = 0) => { const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.castShadow = true; return m; };

// Avatar estilo Xbox: cabeza grande, ojos grandes, cuerpo suave. De pie en y=0, mira hacia +z.
export function buildAvatar(d) {
  const g = new THREE.Group();
  const skin = std(d.piel, 0.55), hair = std(d.pelo, 0.45), top = std(d.arriba, 0.85), pants = std(d.abajo, 0.9), shoe = std(d.zapatos, 0.6);

  // Piernas
  const legs = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group(); hip.position.set(s * 0.115, 0.95, 0); g.add(hip);
    hip.add(mesh(new THREE.CapsuleGeometry(0.105, 0.68, 6, 14), pants, 0, -0.42, 0));
    // bolsillo cargo
    hip.add(mesh(new THREE.BoxGeometry(0.05, 0.2, 0.17), pants, s * 0.11, -0.4, 0.02));
    const sh = mesh(new THREE.CapsuleGeometry(0.095, 0.16, 6, 14), shoe, 0, -0.9, 0.06); sh.rotation.x = Math.PI / 2; sh.scale.set(1, 1, 0.8);
    hip.add(sh);
    const sole = mesh(new THREE.BoxGeometry(0.2, 0.035, 0.36), std(0xeeeeee, 0.9), 0, -0.965, 0.07); hip.add(sole);
    legs.push(hip);
  }

  // Torso (sudadera) y cadera
  const torso = new THREE.Group(); torso.position.y = 1.2; g.add(torso);
  const body = mesh(new THREE.CapsuleGeometry(0.2, 0.3, 8, 18), top, 0, 0, 0); body.scale.set(1.1, 1, 0.75); torso.add(body);
  const waist = mesh(new THREE.CapsuleGeometry(0.2, 0.05, 6, 16), pants, 0, -0.27, 0); waist.scale.set(1.1, 1, 0.75); torso.add(waist);
  if (d.capucha) { // capucha atrás del cuello
    const hood = mesh(new THREE.TorusGeometry(0.13, 0.06, 10, 20), top, 0, 0.32, -0.05); hood.rotation.x = Math.PI / 2 - 0.3; torso.add(hood);
  } else {
    const cuello = mesh(new THREE.TorusGeometry(0.1, 0.03, 8, 20), std(0xffffff, 0.9), 0, 0.33, 0.02); cuello.rotation.x = Math.PI / 2; torso.add(cuello);
  }

  // Brazos
  const arms = [];
  for (const s of [-1, 1]) {
    const sho = new THREE.Group(); sho.position.set(s * 0.27, 1.42, 0); g.add(sho);
    sho.add(mesh(new THREE.CapsuleGeometry(0.065, 0.42, 6, 14), top, 0, -0.26, 0));
    sho.add(mesh(new THREE.SphereGeometry(0.07, 16, 12), skin, 0, -0.56, 0));
    sho.rotation.z = s * 0.12;
    arms.push(sho);
  }

  // Cuello y cabeza
  g.add(mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.1, 14), skin, 0, 1.54, 0));
  const head = new THREE.Group(); head.position.y = 1.8; g.add(head);
  const skull = mesh(new THREE.SphereGeometry(0.3, 40, 30), skin); skull.scale.set(1, 1.06, 0.98); head.add(skull);
  // orejas
  for (const s of [-1, 1]) head.add(mesh(new THREE.SphereGeometry(0.05, 12, 10), skin, s * 0.3, -0.02, 0));
  // ojos
  const eyes = [];
  for (const s of [-1, 1]) {
    const eye = new THREE.Group(); eye.position.set(s * 0.115, 0.0, 0.272); eye.rotation.y = s * 0.38; head.add(eye);
    const white = mesh(new THREE.SphereGeometry(0.062, 20, 16), std(0xffffff, 0.3)); white.scale.set(1, 1.2, 0.35); white.castShadow = false; eye.add(white);
    const iris = mesh(new THREE.SphereGeometry(0.048, 20, 16), std(0x3a2416, 0.25)); iris.scale.set(1, 1.2, 0.35); iris.position.z = 0.012; iris.castShadow = false; eye.add(iris);
    const pupil = mesh(new THREE.SphereGeometry(0.026, 14, 12), std(0x050505, 0.2)); pupil.scale.set(1, 1.1, 0.3); pupil.position.z = 0.022; pupil.castShadow = false; eye.add(pupil);
    const glint = mesh(new THREE.SphereGeometry(0.013, 8, 8), new THREE.MeshBasicMaterial({ color: 0xffffff }), 0.017, 0.028, 0.03); glint.castShadow = false; eye.add(glint);
    const brow = mesh(new THREE.BoxGeometry(0.1, 0.016, 0.02), hair, s * 0.12, 0.115, 0.268); brow.rotation.z = s * -0.08; brow.rotation.y = s * 0.38; brow.castShadow = false; head.add(brow);
    const blush = new THREE.Mesh(new THREE.CircleGeometry(0.04, 16), new THREE.MeshBasicMaterial({ color: 0xff8a8a, transparent: true, opacity: 0.22 }));
    blush.position.set(s * 0.17, -0.09, 0.23); blush.rotation.y = s * 0.7; head.add(blush);
    eyes.push(eye);
  }
  head.add(mesh(new THREE.SphereGeometry(0.025, 12, 10), skin, 0, -0.06, 0.305));
  const mouth = mesh(new THREE.TorusGeometry(0.05, 0.009, 8, 20, Math.PI), std(0x8a3b3b, 0.5), 0, -0.13, 0.285);
  mouth.rotation.z = Math.PI; mouth.castShadow = false; head.add(mouth);

  // Pelo
  const cap = mesh(new THREE.SphereGeometry(0.325, 36, 24, 0, Math.PI * 2, 0, Math.PI * 0.55), hair); cap.scale.set(1, 1.06, 1.0); cap.position.y = 0.02; cap.rotation.x = -0.18; head.add(cap);
  const st = d.peloEstilo;
  if (st === 'cola') {
    const c = mesh(new THREE.CapsuleGeometry(0.07, 0.42, 6, 12), hair, 0, 0.0, -0.4); c.rotation.x = -0.25; head.add(c);
    head.add(mesh(new THREE.SphereGeometry(0.075, 12, 10), std(0xd04a6a, 0.6), 0, 0.18, -0.34));
    const fl = mesh(new THREE.SphereGeometry(0.31, 24, 16, 0, Math.PI * 2, 0.3, 0.5), hair); fl.position.set(0, 0.03, 0.04); fl.scale.set(1, 1, 1.05); head.add(fl);
  } else if (st === 'larga') {
    const b = mesh(new THREE.CapsuleGeometry(0.3, 0.5, 6, 16), hair, 0, -0.2, -0.1); b.scale.set(1, 1, 0.55); head.add(b);
    for (const s of [-1, 1]) head.add(mesh(new THREE.CapsuleGeometry(0.06, 0.4, 6, 12), hair, s * 0.28, -0.15, 0.05));
  } else if (st === 'moño') {
    head.add(mesh(new THREE.SphereGeometry(0.13, 18, 14), hair, 0, 0.34, -0.05));
    const fl = mesh(new THREE.SphereGeometry(0.31, 24, 16, 0, Math.PI * 2, 0.35, 0.45), hair); fl.position.set(0, 0.03, 0.04); head.add(fl);
  } else if (st === 'rizo') {
    for (let i = 0; i < 26; i++) {
      const a = Math.random() * Math.PI * 2, e = Math.random() * 0.9;
      const r = 0.3; const x = Math.sin(e) * Math.cos(a) * r, y = Math.cos(e) * r * 1.05, z = Math.sin(e) * Math.sin(a) * r - 0.04;
      if (z > 0.18 && y < 0.2) continue;
      head.add(mesh(new THREE.SphereGeometry(0.08, 10, 8), hair, x, y + 0.04, z));
    }
  } else { // corto: flequillo
    const fl = mesh(new THREE.SphereGeometry(0.31, 24, 16, 0, Math.PI * 2, 0.35, 0.4), hair); fl.position.set(0, 0.04, 0.03); head.add(fl);
  }

  g.traverse(o => { if (o.isMesh) o.receiveShadow = false; });
  const blinkAt = 2 + Math.random() * 3;
  return {
    group: g,
    update(t, waving) {
      torso.scale.set(1, 1 + Math.sin(t * 1.8) * 0.012, 1 + Math.sin(t * 1.8) * 0.02);
      head.rotation.y = Math.sin(t * 0.7) * 0.18; head.rotation.x = Math.sin(t * 0.9) * 0.03;
      arms[0].rotation.z = -0.12 - Math.sin(t * 1.2) * 0.04;
      if (waving) { arms[1].rotation.z = Math.PI * 0.82 + Math.sin(t * 9) * 0.3; }
      else { arms[1].rotation.z += (0.12 + Math.sin(t * 1.2 + 1) * 0.04 - arms[1].rotation.z) * 0.1; }
      const k = ((t + blinkAt) % 4.2) < 0.12 ? 0.1 : 1;
      eyes.forEach(e => e.scale.y = k);
    },
  };
}
