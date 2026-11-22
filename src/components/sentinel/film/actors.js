import * as THREE from "three";

/* ═════════════════════════════════════════════════════════════════
   THE CAST — real 3D people for the Sentinel films.

   Each actor is a rigged little hierarchy (hips → torso → head, two
   shoulder-pivoted arms, a prop in the hand) so the director can make
   them turn to the player, breathe, gesture on the beat of their own
   words and nod at the ends of clauses. The Sentinel is a colossus
   built the same way, with a pulsing Lodestone Heart and three halos.
   ═════════════════════════════════════════════════════════════════ */

const TAU = Math.PI * 2;
const mat = (color, o = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.78, metalness: 0.05, ...o });
const glowMat = (color, k = 1.6) => new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: k, roughness: 0.4 });

const KINDS = {
  "Ilyra":                  { cloak: 0x1d5c5a, trim: 0x9fffe0, skin: 0xe3c8a8, prop: "lantern", voice: 0, height: 1.0 },
  "Sable of the Reliquary": { cloak: 0x2e6b38, trim: 0xb8ff9e, skin: 0xd8b48e, prop: "staff", voice: 1, height: 0.96 },
  "Orrin the Unfrozen":     { cloak: 0x7a5a1e, trim: 0xffd98a, skin: 0xe6cfae, prop: "scroll", voice: 2, height: 1.04 },
  "Maren Tidewright":       { cloak: 0x24506e, trim: 0xaee8ff, skin: 0xcaa07c, prop: "rope", voice: 3, height: 1.0 },
  "Vesh, the Ninth":        { cloak: 0xdedbd2, trim: 0xffffff, skin: 0xf0e6d8, prop: "quill", voice: 4, height: 1.02 },
  "default":                { cloak: 0x4a4a62, trim: 0xd0d0ff, skin: 0xd8b48e, prop: "lantern", voice: 0, height: 1.0 },
};

function arm(side, material, handMat, withProp) {
  const shoulder = new THREE.Group();
  shoulder.position.set(side * 0.36, 1.42, 0);
  const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.07, 0.42, 8), material);
  upper.position.y = -0.21; shoulder.add(upper);
  const elbow = new THREE.Group(); elbow.position.y = -0.42; shoulder.add(elbow);
  const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.066, 0.058, 0.4, 8), material);
  fore.position.y = -0.2; elbow.add(fore);
  const hand = new THREE.Mesh(new THREE.SphereGeometry(0.07, 10, 8), handMat);
  hand.position.y = -0.42; elbow.add(hand);
  upper.castShadow = fore.castShadow = hand.castShadow = true;
  return { shoulder, elbow, hand };
}

function makeProp(kind, trim) {
  const g = new THREE.Group();
  if (kind === "lantern") {
    const cage = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.22, 8, 1, true), mat(0x2a2018, { side: THREE.DoubleSide }));
    const flame = new THREE.Mesh(new THREE.SphereGeometry(0.075, 12, 10), glowMat(0xffd08a, 3));
    g.add(cage, flame);
    const l = new THREE.PointLight(0xffc880, 9, 16, 2); g.add(l); g.userData.light = l; g.userData.flame = flame;
    g.position.set(0, -0.22, 0.04);
  } else if (kind === "staff") {
    const rod = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.035, 1.9, 8), mat(0x4a3320));
    rod.position.y = 0.4;
    const tip = new THREE.Mesh(new THREE.OctahedronGeometry(0.1), glowMat(trim, 2.4)); tip.position.y = 1.4;
    g.add(rod, tip); g.userData.flame = tip;
    const l = new THREE.PointLight(trim, 6, 12, 2); l.position.y = 1.4; g.add(l); g.userData.light = l;
  } else if (kind === "scroll") {
    const s = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.06, 0.34, 10), mat(0xe9dcb4)); s.rotation.z = Math.PI / 2;
    for (const e of [-1, 1]) { const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.04, 10), mat(0x7a5a1e)); cap.rotation.z = Math.PI / 2; cap.position.x = e * 0.19; g.add(cap); }
    g.add(s);
  } else if (kind === "rope") {
    const c = new THREE.Mesh(new THREE.TorusGeometry(0.11, 0.035, 8, 16), mat(0xb89a68)); c.rotation.x = Math.PI / 2; g.add(c);
  } else if (kind === "quill") {
    const q = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.5, 6), mat(0xf5f0e4)); q.rotation.z = -0.5; q.position.y = 0.1;
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.03, 8, 8), glowMat(0x9dffbe, 3)); tip.position.set(-0.1, -0.12, 0);
    g.add(q, tip); g.userData.flame = tip;
    const l = new THREE.PointLight(0x9dffbe, 5, 10, 2); l.position.set(-0.1, -0.12, 0); g.add(l); g.userData.light = l;
  }
  return g;
}

export function createPerson(name) {
  const cfg = KINDS[name] || KINDS.default;
  const root = new THREE.Group();
  const body = new THREE.Group(); root.add(body);
  const cloakMat = mat(cfg.cloak, { roughness: 0.9 });
  const trimMat = glowMat(cfg.trim, 1.1);
  const skinMat = mat(cfg.skin, { roughness: 0.7 });

  // cloak: a lathe profile — hem flare, waist, shoulders
  const prof = [[0.52, 0], [0.5, 0.15], [0.4, 0.55], [0.3, 0.95], [0.27, 1.25], [0.3, 1.42], [0.2, 1.52], [0.0, 1.55]].map(([r, y]) => new THREE.Vector2(r, y));
  const cloak = new THREE.Mesh(new THREE.LatheGeometry(prof, 18), cloakMat); cloak.castShadow = true; body.add(cloak);
  const hem = new THREE.Mesh(new THREE.TorusGeometry(0.51, 0.018, 6, 24), trimMat); hem.rotation.x = Math.PI / 2; hem.position.y = 0.03; body.add(hem);
  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.31, 0.02, 6, 20), trimMat); belt.rotation.x = Math.PI / 2; belt.position.y = 0.98; body.add(belt);

  // head, hood and a soft glint of eyes
  const head = new THREE.Group(); head.position.y = 1.7; body.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(0.17, 18, 14), skinMat); skull.castShadow = true; head.add(skull);
  const hood = new THREE.Mesh(new THREE.SphereGeometry(0.205, 18, 14, 0, TAU, 0, Math.PI * 0.68), cloakMat);
  hood.rotation.x = -0.35; hood.position.set(0, 0.02, -0.025); hood.castShadow = true; head.add(hood);
  const hoodRim = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.012, 6, 20, Math.PI * 1.1), trimMat);
  hoodRim.position.set(0, 0.03, 0.12); hoodRim.rotation.set(0.15, 0, Math.PI * 0.95); head.add(hoodRim);
  const eyeMat = glowMat(cfg.trim, 2.8);
  for (const e of [-1, 1]) { const eye = new THREE.Mesh(new THREE.SphereGeometry(0.019, 8, 6), eyeMat); eye.position.set(e * 0.062, 0.025, 0.152); head.add(eye); }
  const mouth = new THREE.Mesh(new THREE.BoxGeometry(0.07, 0.012, 0.01), mat(0x3a1c18)); mouth.position.set(0, -0.07, 0.158); head.add(mouth);

  const L = arm(-1, cloakMat, skinMat), Rm = arm(1, cloakMat, skinMat);
  body.add(L.shoulder, Rm.shoulder);
  const prop = makeProp(cfg.prop, cfg.trim);
  if (cfg.prop === "staff") { Rm.hand.add(prop); prop.position.set(0, 0.0, 0.05); }
  else if (cfg.prop === "quill") Rm.hand.add(prop);
  else L.hand.add(prop);
  root.scale.setScalar(cfg.height);

  const st = { speaking: 0, gesture: 0, gestureT: 99, nod: 0, look: new THREE.Vector3(), seed: Math.random() * 10, mood: 0 };
  const tmp = new THREE.Vector3();

  const actor = {
    kind: "person", name, group: root, height: 1.9 * cfg.height, voice: cfg.voice, prop,
    setSpeaking(v) { st.speaking = v ? 1 : 0; },
    gesture(strength = 1) { st.gesture = strength; st.gestureT = 0; },
    nod() { st.nod = 1; },
    mood(v) { st.mood = v; },
    /* where the face is, in world space */
    eye(out = new THREE.Vector3()) { head.getWorldPosition(out); return out; },
    lookAt(v) { st.look.copy(v); },
    update(t, dt) {
      st.gestureT += dt; st.nod = Math.max(0, st.nod - dt * 3); st.gesture = Math.max(0, st.gesture - dt * 0.9);
      const sp = st.speaking;
      body.position.y = Math.sin(t * 1.5 + st.seed) * 0.012;
      body.rotation.z = Math.sin(t * 0.7 + st.seed) * 0.012;
      // arms: relaxed, lifting into a gesture when one is called
      const g = st.gesture;
      const gl = Math.sin(st.gestureT * 5.2) * 0.25 * g;
      Rm.shoulder.rotation.set(-0.12 - g * 1.0 - sp * 0.12 + gl, 0, -0.12 - g * 0.28);
      Rm.elbow.rotation.set(-0.35 - g * 0.8 + gl * 0.6, 0, 0);
      L.shoulder.rotation.set(-0.08 + Math.sin(t * 0.9 + st.seed) * 0.03 - (cfg.prop === "lantern" ? 0.55 : 0) - st.mood * 0.1, 0, 0.1);
      L.elbow.rotation.set(-0.15 - (cfg.prop === "lantern" ? 0.7 : 0), 0, 0);
      // head: tracks the look target (the player's eye) within human limits, bobs with speech
      head.getWorldPosition(tmp);
      const dx = st.look.x - tmp.x, dz = st.look.z - tmp.z, dy = st.look.y - tmp.y;
      const wantYaw = Math.atan2(dx, dz), selfYaw = root.rotation.y;
      let rel = wantYaw - selfYaw; rel = Math.atan2(Math.sin(rel), Math.cos(rel));
      const lim = Math.max(-1.0, Math.min(1.0, rel));
      head.rotation.y += (lim - head.rotation.y) * Math.min(1, dt * 5);
      const pitch = Math.max(-0.35, Math.min(0.35, -Math.atan2(dy, Math.hypot(dx, dz))));
      head.rotation.x += ((pitch + Math.sin(t * 6.3 + st.seed) * 0.03 * sp + st.nod * 0.18 + st.mood * 0.12) - head.rotation.x) * Math.min(1, dt * 7);
      head.rotation.z = Math.sin(t * 2.1 + st.seed) * 0.02 + sp * Math.sin(t * 4.0) * 0.02;
      mouth.scale.y = 1 + sp * Math.max(0, Math.sin(t * 17 + st.seed)) * 3.2;
      mouth.scale.x = 1 - sp * Math.max(0, Math.sin(t * 17 + st.seed)) * 0.25;
      // the lantern / tip breathes
      if (prop.userData.light) prop.userData.light.intensity = (cfg.prop === "lantern" ? 9 : 6) * (0.85 + Math.sin(t * 7.3 + st.seed) * 0.1 + sp * 0.2);
      if (prop.userData.flame) prop.userData.flame.scale.setScalar(1 + Math.sin(t * 9 + st.seed) * 0.08 + sp * 0.15);
    },
  };
  return actor;
}

/* ── the Sentinel: a colossus around a Lodestone Heart ── */
export function createSentinelColossus() {
  const root = new THREE.Group();
  const stone = mat(0x22202c, { roughness: 0.6, metalness: 0.55 });
  const plate = mat(0x34304a, { roughness: 0.45, metalness: 0.7 });
  const seam = glowMat(0xffca7a, 1.8);
  const body = new THREE.Group(); root.add(body);

  const mk = (geo, m, x, y, z, cast = true) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.castShadow = cast; body.add(o); return o; };
  for (const s of [-1, 1]) {
    mk(new THREE.BoxGeometry(2.6, 9, 2.8), stone, s * 2.4, 4.5, 0);
    mk(new THREE.BoxGeometry(3.0, 0.5, 3.2), plate, s * 2.4, 9.2, 0.1);
    mk(new THREE.BoxGeometry(0.16, 8.4, 0.16), seam, s * 2.4, 4.6, 1.45, false);
  }
  mk(new THREE.BoxGeometry(8.6, 8.4, 4.4), plate, 0, 13.6, 0);
  mk(new THREE.BoxGeometry(9.4, 1.2, 4.9), stone, 0, 17.4, 0);
  mk(new THREE.BoxGeometry(0.2, 7.4, 0.2), seam, -2.2, 13.8, 2.3, false);
  mk(new THREE.BoxGeometry(0.2, 7.4, 0.2), seam, 2.2, 13.8, 2.3, false);
  for (const s of [-1, 1]) {
    mk(new THREE.BoxGeometry(3.4, 3.0, 3.4), plate, s * 6.0, 17.2, 0);
    mk(new THREE.BoxGeometry(2.0, 8.4, 2.2), stone, s * 6.9, 12.4, 0.3);
  }
  const head = new THREE.Group(); head.position.set(0, 19.6, 0.2); body.add(head);
  const helm = new THREE.Mesh(new THREE.BoxGeometry(3.4, 3.6, 3.4), plate); helm.castShadow = true; head.add(helm);
  const crest = new THREE.Mesh(new THREE.ConeGeometry(0.5, 2.6, 4), stone); crest.position.y = 3.0; head.add(crest);
  const eye = new THREE.Mesh(new THREE.BoxGeometry(2.4, 0.38, 0.2), glowMat(0xffd88a, 4)); eye.position.set(0, 0.2, 1.72); head.add(eye);
  const eyeLight = new THREE.PointLight(0xffd08a, 80, 90, 2); eyeLight.position.set(0, 0.2, 3); head.add(eyeLight);

  // Lodestone Heart in the chest, held in its own cage of halos
  const heart = new THREE.Mesh(new THREE.OctahedronGeometry(1.5, 0), glowMat(0xfff0cf, 3.4)); heart.position.set(0, 14, 2.5); body.add(heart);
  const heartLight = new THREE.PointLight(0xffd8a0, 140, 120, 2); heartLight.position.copy(heart.position).add(new THREE.Vector3(0, 0, 3)); body.add(heartLight);
  const halos = [0, 1, 2].map((i) => {
    const h = new THREE.Mesh(new THREE.TorusGeometry(2.6 + i * 1.0, 0.07, 6, 48), glowMat(0xffca7a, 1.6));
    h.position.copy(heart.position); body.add(h); return h;
  });

  const st = { speaking: 0, seed: 3.3, look: new THREE.Vector3() };
  const tmp = new THREE.Vector3();
  return {
    kind: "colossus", name: "The Sentinel", group: root, height: 24, voice: 5,
    setSpeaking(v) { st.speaking = v ? 1 : 0; },
    gesture() {}, nod() {}, mood() {},
    eye(out = new THREE.Vector3()) { head.getWorldPosition(out); return out; },
    lookAt(v) { st.look.copy(v); },
    update(t) {
      body.position.y = Math.sin(t * 0.5) * 0.12;
      const sp = st.speaking;
      const pulse = 0.75 + Math.sin(t * 1.9) * 0.18 + sp * (0.35 + Math.sin(t * 14) * 0.2);
      heart.material.emissiveIntensity = 3.4 * pulse; heartLight.intensity = 140 * pulse;
      heart.rotation.y = t * 0.8; heart.rotation.x = Math.sin(t * 0.4) * 0.3;
      halos.forEach((h, i) => { h.rotation.x = t * (0.5 + i * 0.25) * (i % 2 ? -1 : 1); h.rotation.y = t * 0.3 * (i + 1); });
      eye.material.emissiveIntensity = 4 * (0.8 + sp * 0.6 + Math.sin(t * 3) * 0.1);
      eyeLight.intensity = 80 * (0.8 + sp * 0.7);
      head.getWorldPosition(tmp);
      const yaw = Math.atan2(st.look.x - tmp.x, st.look.z - tmp.z) - root.rotation.y;
      head.rotation.y += (Math.max(-0.8, Math.min(0.8, Math.atan2(Math.sin(yaw), Math.cos(yaw)))) - head.rotation.y) * 0.04;
    },
  };
}

export function createActorFor(name) {
  if (/sentinel/i.test(name)) return createSentinelColossus();
  return createPerson(name);
}
