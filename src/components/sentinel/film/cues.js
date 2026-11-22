import * as THREE from "three";

/* ═════════════════════════════════════════════════════════════════
   WORD CUES — the world answers what is being said.

   While a line is spoken the director watches the word the actor has just
   reached. When it matches a cue ("the leaf falls", "nine signatures",
   "the seal breaks", "the tide"), something happens in the 3D world at
   that moment — a leaf drops on the count, tablets rise into a ring,
   five seal sigils ignite, a crack runs outward from the speaker.
   ═════════════════════════════════════════════════════════════════ */

const TAU = Math.PI * 2;
const add = { blending: THREE.AdditiveBlending, depthWrite: false, transparent: true };

/* regex → cue. Order matters only for the log; every matching cue fires once per line. */
export const CUES = [
  { name: "leaf",     re: /\b(leaf|leaves|falls?|falling|nine thousand)\b/i },
  { name: "tablets",  re: /\b(signatures?|ledger|written down|nine names|names|folios?|tablets|pages?|book)\b/i },
  { name: "scatter",  re: /\b(taken apart|apart|unwrit\w*|scatter\w*|drift\w*)\b/i },
  { name: "seal",     re: /\b(seals?|bound|binding|sealed|protocols?)\b/i },
  { name: "hush",     re: /\b(still(?:ness)?|stopped|mid-breath|frozen|hold(?:s)?|holds|silence|silent|quiet|dark)\b/i },
  { name: "crack",    re: /\b(break|breaks|broken|shatter\w*|cracks?|torn|tears?|come open|lifts|opens?)\b/i },
  { name: "erase",    re: /\b(erase\w*|blank|missing|gone|dust|forgot\w*|margin|unwritten|nothing)\b/i },
  { name: "embers",   re: /\b(fires?|embers?|flame\w*|brazier|lantern|kettle|dusk|evening|festival)\b/i },
  { name: "ripple",   re: /\b(tide|sea|water|swell|ships?|boat|harbou?r|ice|weather)\b/i },
  { name: "crown",    re: /\b(crown|throne|kingdom|court|rebel\w*)\b/i },
  { name: "heart",    re: /\b(heart|lodestone|core|guardian|construct)\b/i },
  { name: "bells",    re: /\b(bells?|ring|rings|music|count)\b/i },
  { name: "release",  re: /\b(arguments?|grief|change|free|let it|open at once|listening)\b/i },
];

export function createFx(scene) {
  const live = [];
  const group = new THREE.Group(); group.name = "film-fx"; scene.add(group);
  const push = (obj, update) => { group.add(obj); live.push({ obj, update, t: 0 }); };
  return {
    group,
    add: push,
    update(dt) {
      for (let i = live.length - 1; i >= 0; i--) {
        const e = live[i]; e.t += dt;
        if (!e.update(e.t, dt, e.obj)) { group.remove(e.obj); e.obj.traverse?.((o) => { o.geometry?.dispose?.(); o.material?.dispose?.(); }); live.splice(i, 1); }
      }
    },
    clear() { live.splice(0).forEach((e) => group.remove(e.obj)); },
    get count() { return live.length; },
  };
}

function ring(color, r0, r1, life, y, thick = 0.28) {
  const m = new THREE.Mesh(new THREE.RingGeometry(1 - thick, 1, 64), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, opacity: 1, ...add }));
  m.rotation.x = -Math.PI / 2; m.position.y = y;
  return { obj: m, update: (t) => { const k = Math.min(1, t / life); const s = r0 + (r1 - r0) * (1 - Math.pow(1 - k, 2.4)); m.scale.set(s, s, 1); m.material.opacity = (1 - k) * 0.9; return k < 1; } };
}

function burst(count, color, { speed = 10, gravity = -6, life = 2.2, size = 0.7, spread = 1, up = 0.6 } = {}) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3), vel = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * TAU, e = (Math.random() - 0.3) * spread, s = speed * (0.35 + Math.random() * 0.8);
    vel[i * 3] = Math.cos(a) * s * (1 - Math.abs(e) * 0.3); vel[i * 3 + 1] = (up + Math.random() * 0.7) * s; vel[i * 3 + 2] = Math.sin(a) * s * (1 - Math.abs(e) * 0.3);
  }
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({ color, size, map: SPRITE(), opacity: 1, sizeAttenuation: true, ...add });
  const pts = new THREE.Points(geo, mat); pts.frustumCulled = false;
  return { obj: pts, update: (t, dt) => { const p = geo.attributes.position.array; for (let i = 0; i < count; i++) { vel[i * 3 + 1] += gravity * dt; p[i * 3] += vel[i * 3] * dt; p[i * 3 + 1] += vel[i * 3 + 1] * dt; p[i * 3 + 2] += vel[i * 3 + 2] * dt; } geo.attributes.position.needsUpdate = true; mat.opacity = Math.max(0, 1 - t / life); return t < life; } };
}

let _sprite = null;
function SPRITE() {
  if (_sprite) return _sprite;
  const c = document.createElement("canvas"); c.width = c.height = 64; const g = c.getContext("2d");
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 32); gr.addColorStop(0, "rgba(255,255,255,1)"); gr.addColorStop(0.35, "rgba(255,255,255,.45)"); gr.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = gr; g.fillRect(0, 0, 64, 64); _sprite = new THREE.CanvasTexture(c); return _sprite;
}

function pillar(color, h, r, life, delay = 0) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r * 1.4, h, 16, 1, true), new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide, opacity: 0, ...add }));
  m.position.y = h / 2;
  return { obj: m, update: (t) => { const k = (t - delay) / life; m.material.opacity = k < 0 ? 0 : Math.sin(Math.min(1, k) * Math.PI) * 0.55; return k < 1; } };
}

/* ctx: { fx, stage:Vector3 (ground point beside the speaker), focus:Vector3 (what the anchor looks at),
          ground:number, accent:THREE.Color, speaker, shake(a), dim(a, secs), flash(a) } */
export const RUN = {
  leaf(c) {
    const y0 = c.ground + 30, x = c.stage.x + 6, z = c.stage.z - 4;
    const leaf = new THREE.Group();
    const blade = new THREE.Mesh(new THREE.SphereGeometry(0.9, 14, 10), new THREE.MeshStandardMaterial({ color: 0xb6ffc8, emissive: 0x6dffa3, emissiveIntensity: 2.4 }));
    blade.scale.set(0.55, 0.06, 1.0); leaf.add(blade);
    const l = new THREE.PointLight(0x9dffbe, 24, 22, 2); leaf.add(l);
    leaf.position.set(x, y0, z);
    const trail = burst(36, 0xa8ffc4, { speed: 0.8, gravity: 0.2, life: 2.6, size: 0.55, up: 0 });
    c.fx.add(leaf, (t) => {
      const k = Math.min(1, t / 3.0), ease = k * k * (3 - 2 * k) * 0.4 + k * 0.6;
      leaf.position.set(x + Math.sin(k * 7) * 2.4, y0 - (y0 - c.ground - 0.2) * ease, z + Math.cos(k * 5) * 1.6);
      leaf.rotation.set(Math.sin(k * 9) * 0.8, k * 6, Math.cos(k * 8) * 0.6);
      if (k >= 1 && !leaf.userData.landed) { leaf.userData.landed = true; const r = ring(0x9dffbe, 0.6, 7, 1.6, c.ground + 0.1); c.fx.add(r.obj, r.update); }
      l.intensity = 24 * (k < 1 ? 1 : Math.max(0, 1 - (t - 3.0)));
      return t < 4.2;
    });
    trail.obj.position.set(x, y0, z); c.fx.add(trail.obj, trail.update);
  },
  tablets(c) {
    const n = 9, slabs = [];
    const g = new THREE.Group(); g.position.copy(c.stage).add(new THREE.Vector3(0, 0, -6));
    const m = new THREE.MeshStandardMaterial({ color: 0x3a2e1a, emissive: 0xffd166, emissiveIntensity: 0.55, roughness: 0.6 });
    for (let i = 0; i < n; i++) {
      const s = new THREE.Mesh(new THREE.BoxGeometry(1.5, 2.2, 0.22), m);
      const edge = new THREE.Mesh(new THREE.BoxGeometry(1.56, 2.26, 0.04), new THREE.MeshBasicMaterial({ color: 0xffe9a8, ...add, opacity: 0.8 })); edge.position.z = 0.12; s.add(edge);
      s.userData.a = i / n * TAU; g.add(s); slabs.push(s);
    }
    c.fx.add(g, (t) => {
      const k = Math.min(1, t / 1.8), e = k * k * (3 - 2 * k);
      slabs.forEach((s, i) => { const a = s.userData.a + t * 0.35, r = 9 - e * 2; s.position.set(Math.cos(a) * r, c.ground + 0.5 + e * (5.4 + Math.sin(i * 1.3) * 1.4), Math.sin(a) * r); s.rotation.y = -a + Math.PI / 2; s.material.emissiveIntensity = 0.55 + Math.sin(t * 3 + i) * 0.25; });
      g.children.forEach((s) => (s.visible = true));
      const fade = t > 5 ? Math.max(0, 1 - (t - 5)) : 1; g.scale.setScalar(0.4 + fade * 0.6); return t < 6;
    });
  },
  scatter(c) {
    const b = burst(70, 0xffd166, { speed: 12, gravity: -3, life: 3, size: 0.9, up: 0.3 }); b.obj.position.copy(c.stage).add(new THREE.Vector3(0, 4, -6)); c.fx.add(b.obj, b.update);
    c.dim(0.55, 1.6);
  },
  seal(c) {
    const g = new THREE.Group(); g.position.copy(c.stage).add(new THREE.Vector3(0, c.ground - c.stage.y + 0.1, -4));
    const discs = [];
    for (let i = 0; i < 5; i++) {
      const a = i / 5 * TAU - Math.PI / 2, r = 7;
      const d = new THREE.Group(); d.position.set(Math.cos(a) * r, 0.05, Math.sin(a) * r);
      const ringM = new THREE.Mesh(new THREE.RingGeometry(1.3, 1.6, 40), new THREE.MeshBasicMaterial({ color: c.accent, side: THREE.DoubleSide, opacity: 0, ...add })); ringM.rotation.x = -Math.PI / 2; d.add(ringM);
      const star = new THREE.Mesh(new THREE.CircleGeometry(0.9, 5), new THREE.MeshBasicMaterial({ color: 0xffffff, side: THREE.DoubleSide, opacity: 0, ...add })); star.rotation.x = -Math.PI / 2; d.add(star);
      const p = pillar(c.accent, 14, 0.5, 2.2, i * 0.35); d.add(p.obj); d.userData = { ringM, star, p };
      g.add(d); discs.push(d);
    }
    c.fx.add(g, (t) => {
      discs.forEach((d, i) => { const k = Math.min(1, Math.max(0, (t - i * 0.35) / 0.6)); d.userData.ringM.material.opacity = k * Math.max(0, 1 - Math.max(0, t - 5) / 1.2); d.userData.star.material.opacity = k * 0.8 * Math.max(0, 1 - Math.max(0, t - 5) / 1.2); d.userData.star.rotation.z = t * 0.8; d.userData.p.update(t); });
      return t < 6.4;
    });
  },
  hush(c) { const r = ring(0xdfe9ff, 1, 22, 2.4, c.ground + 0.1, 0.12); c.fx.add(r.obj, r.update); r.obj.position.x = c.stage.x; r.obj.position.z = c.stage.z; c.dim(0.62, 1.8); },
  crack(c) {
    c.flash(0.55); c.shake(0.7);
    for (let i = 0; i < 3; i++) { const r = ring(0xffffff, 1, 26 + i * 8, 1.2 + i * 0.2, c.ground + 0.15, 0.1); r.obj.position.x = c.stage.x; r.obj.position.z = c.stage.z; c.fx.add(r.obj, r.update); }
    const b = burst(90, 0xffe9b0, { speed: 16, gravity: -14, life: 1.8, size: 0.7 }); b.obj.position.copy(c.stage).add(new THREE.Vector3(0, 1.2, 0)); c.fx.add(b.obj, b.update);
  },
  erase(c) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), new THREE.MeshBasicMaterial({ color: 0x050308, transparent: true, opacity: 0 }));
    const rim = new THREE.Mesh(new THREE.SphereGeometry(1.06, 28, 20), new THREE.MeshBasicMaterial({ color: 0xb48aff, side: THREE.BackSide, ...add, opacity: 0 })); s.add(rim);
    s.position.copy(c.stage).add(new THREE.Vector3(0, 10, -12));
    c.fx.add(s, (t) => { const k = Math.min(1, t / 1.6), f = t > 3 ? Math.max(0, 1 - (t - 3) / 1.4) : 1; const sc = 0.5 + k * 7.5; s.scale.setScalar(sc); s.material.opacity = 0.92 * f; rim.material.opacity = 0.45 * f; return t < 4.4; });
    c.dim(0.5, 2.6);
  },
  embers(c) { const b = burst(150, 0xffa850, { speed: 7, gravity: 2.4, life: 3.4, size: 0.8, up: 1.3 }); b.obj.position.copy(c.stage).add(new THREE.Vector3(0, 0.6, -3)); c.fx.add(b.obj, b.update); const l = new THREE.PointLight(0xff9a4a, 60, 40, 2); l.position.copy(c.stage).add(new THREE.Vector3(0, 4, -3)); c.fx.add(l, (t) => { l.intensity = 60 * Math.max(0, 1 - t / 3); return t < 3; }); },
  ripple(c) { for (let i = 0; i < 4; i++) { const r = ring(0x9fe3ff, 1, 30, 3.2 + i * 0.4, c.ground + 0.12, 0.08); r.obj.position.x = c.stage.x; r.obj.position.z = c.stage.z - 4; const u = r.update; let started = false; c.fx.add(r.obj, (t, dt, o) => { if (t < i * 0.55) { o.visible = false; return true; } o.visible = true; return u(t - i * 0.55, dt, o); }); } },
  crown(c) {
    const g = new THREE.Group(); g.position.copy(c.stage).add(new THREE.Vector3(0, 0, -8));
    const halo = new THREE.Mesh(new THREE.TorusGeometry(3, 0.12, 8, 56), new THREE.MeshBasicMaterial({ color: 0xffd98a, ...add, opacity: 0.95 })); halo.rotation.x = Math.PI / 2; g.add(halo);
    for (let i = 0; i < 9; i++) { const sp = new THREE.Mesh(new THREE.ConeGeometry(0.22, 1.1 + (i % 2) * 0.6, 4), new THREE.MeshBasicMaterial({ color: 0xffe9b0, ...add, opacity: 0.9 })); const a = i / 9 * TAU; sp.position.set(Math.cos(a) * 3, 0.7, Math.sin(a) * 3); g.add(sp); }
    const beam = pillar(0xffd98a, 20, 1.6, 4.2); g.add(beam.obj);
    c.fx.add(g, (t) => { const k = Math.min(1, t / 2.2); g.position.y = c.ground + 22 - k * k * 14; g.rotation.y = t * 0.6; beam.update(t); halo.material.opacity = Math.max(0, 0.95 - Math.max(0, t - 3.4)); return t < 4.6; });
  },
  heart(c) { const p = c.speaker && c.speaker.kind === "colossus" ? c.speaker.group.localToWorld(new THREE.Vector3(0, 14, 2.5)) : c.stage.clone().add(new THREE.Vector3(0, 8, -10)); for (let i = 0; i < 3; i++) { const m = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 16), new THREE.MeshBasicMaterial({ color: 0xffe6b0, ...add, opacity: 0.8 })); m.position.copy(p); c.fx.add(m, (t) => { const tt = t - i * 0.3; if (tt < 0) { m.visible = false; return true; } m.visible = true; const k = tt / 1.4; m.scale.setScalar(1 + k * 10); m.material.opacity = Math.max(0, 0.55 * (1 - k)); return k < 1; }); } },
  bells(c) { for (let i = 0; i < 3; i++) { const r = ring(0xffffff, 1, 18 + i * 4, 1.6, c.stage.y + 6 + i * 2, 0.06); r.obj.position.x = c.stage.x; r.obj.position.z = c.stage.z; const u = r.update; c.fx.add(r.obj, (t, dt, o) => { const tt = t - i * 0.45; if (tt < 0) { o.visible = false; return true; } o.visible = true; return u(tt, dt, o); }); } },
  release(c) { c.flash(0.25); const b = burst(220, 0xeaf6ff, { speed: 14, gravity: -1.2, life: 3.6, size: 0.8, up: 0.9 }); b.obj.position.copy(c.stage).add(new THREE.Vector3(0, 6, -4)); c.fx.add(b.obj, b.update); },
};

/* Which cues fire between two caption positions. Each cue fires at most once per line. */
export function scanCues(text, from, to, fired) {
  const out = [];
  for (const cue of CUES) {
    if (fired.has(cue.name)) continue;
    const re = new RegExp(cue.re.source, "gi"); let m;
    while ((m = re.exec(text))) { const end = m.index + m[0].length; if (end > from && end <= to) { fired.add(cue.name); out.push(cue.name); break; } if (m.index > to) break; }
  }
  return out;
}
