import * as THREE from "three";
import {
  createSky,
  createTerrain,
  createGroundFog,
  glowTexture,
  rand,
  clamp01,
} from "@/components/glacialArchive/Cutscene";
import { createGodRay } from "@/components/cinderIntro/CinderKit";
import { createFireflies } from "@/components/realmCinematic/finish";

/* ═════════════════════════════════════════════════════════════════
   CRYSTO — the shared set for its cinematics.

   The vale the films show is the vale the player walks: rolling green
   hills, a stone-and-plaster village under shingled roofs, three
   shrines, a dark keep and the Sunstone. Every texture here is painted
   onto a canvas so the village reads as lime wash, oak and slate rather
   than flat colour, exactly like the ground it stands on.
   ═════════════════════════════════════════════════════════════════ */

/* ── textures ─────────────────────────────────────────────── */

function canvasOf(w, h) {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  return c;
}

function texOf(canvas, rx = 1, ry = 1) {
  const t = new THREE.CanvasTexture(canvas);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

const TEX = {};

function plasterMap() {
  if (TEX.plaster) return TEX.plaster;
  const S = 256, c = canvasOf(S, S), x = c.getContext("2d");
  x.fillStyle = "#e2d4b7";
  x.fillRect(0, 0, S, S);
  for (let i = 0; i < 80; i++) {
    const px = rand(0, S), py = rand(0, S), r = rand(6, 32);
    const g = x.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0, Math.random() > 0.45 ? "rgba(255,250,235,0.10)" : "rgba(90,80,60,0.10)");
    g.addColorStop(1, "rgba(0,0,0,0)");
    x.fillStyle = g;
    x.fillRect(px - r, py - r, r * 2, r * 2);
  }
  x.strokeStyle = "rgba(70,60,45,0.20)";
  for (let i = 0; i < 6; i++) {
    x.lineWidth = rand(0.6, 1.5);
    x.beginPath();
    let px = rand(0, S), py = rand(0, S);
    x.moveTo(px, py);
    for (let j = 0; j < 5; j++) { px += rand(-16, 16); py += rand(5, 20); x.lineTo(px, py); }
    x.stroke();
  }
  const damp = x.createLinearGradient(0, S * 0.7, 0, S);
  damp.addColorStop(0, "rgba(60,55,40,0)");
  damp.addColorStop(1, "rgba(60,55,40,0.22)");
  x.fillStyle = damp;
  x.fillRect(0, S * 0.7, S, S * 0.3);
  TEX.plaster = texOf(c, 2, 2);
  return TEX.plaster;
}

function shingleMap(tone) {
  const key = "sh" + tone;
  if (TEX[key]) return TEX[key];
  const S = 256, c = canvasOf(S, S), x = c.getContext("2d");
  const base = new THREE.Color(tone);
  x.fillStyle = `rgb(${(base.r * 130) | 0},${(base.g * 130) | 0},${(base.b * 130) | 0})`;
  x.fillRect(0, 0, S, S);
  const rh = 26;
  for (let r = 0; r * rh < S + rh; r++) {
    const off = r % 2 ? 16 : 0;
    for (let px = -32 + off; px < S + 32; px += 32) {
      const k = rand(0.78, 1.18);
      const col = base.clone().multiplyScalar(k);
      x.fillStyle = `rgb(${(col.r * 255) | 0},${(col.g * 255) | 0},${(col.b * 255) | 0})`;
      x.beginPath();
      x.moveTo(px + 1, r * rh + rh);
      x.lineTo(px + 1, r * rh + 6);
      x.quadraticCurveTo(px + 16, r * rh - 2, px + 31, r * rh + 6);
      x.lineTo(px + 31, r * rh + rh);
      x.closePath();
      x.fill();
      x.fillStyle = "rgba(255,240,220,0.10)";
      x.fillRect(px + 3, r * rh + 7, 26, 2);
      x.fillStyle = "rgba(0,0,0,0.26)";
      x.fillRect(px + 1, r * rh + rh - 3, 30, 3);
    }
  }
  TEX[key] = texOf(c, 2.4, 1.8);
  return TEX[key];
}

function thatchMap() {
  if (TEX.thatch) return TEX.thatch;
  const S = 256, c = canvasOf(S, S), x = c.getContext("2d");
  x.fillStyle = "#9c7f45";
  x.fillRect(0, 0, S, S);
  for (let i = 0; i < 2200; i++) {
    const px = rand(0, S), py = rand(0, S);
    x.strokeStyle = Math.random() > 0.5
      ? `rgba(226,198,132,${rand(0.2, 0.5).toFixed(2)})`
      : `rgba(84,64,30,${rand(0.15, 0.38).toFixed(2)})`;
    x.lineWidth = rand(0.6, 1.7);
    x.beginPath();
    x.moveTo(px, py);
    x.lineTo(px + rand(-3, 3), py + rand(7, 18));
    x.stroke();
  }
  for (let r = 0; r < 4; r++) {
    x.fillStyle = "rgba(60,44,18,0.20)";
    x.fillRect(0, r * 64 + 54, S, 6);
  }
  TEX.thatch = texOf(c, 2, 1.6);
  return TEX.thatch;
}

/* ── materials ────────────────────────────────────────────── */

export function createCrystoMaterials() {
  return {
    plaster: () =>
      new THREE.MeshStandardMaterial({ map: plasterMap(), roughness: 0.92, metalness: 0.02 }),
    oak: (color = 0x4a3527) =>
      new THREE.MeshStandardMaterial({ color, roughness: 0.86, metalness: 0.04 }),
    stone: (color = 0x8b8679) =>
      new THREE.MeshStandardMaterial({ color, roughness: 0.94, metalness: 0.04, flatShading: true }),
    shingle: (tone = 0x8c3f2c) =>
      new THREE.MeshStandardMaterial({ map: shingleMap(tone), roughness: 0.88, metalness: 0.03 }),
    thatch: () =>
      new THREE.MeshStandardMaterial({ map: thatchMap(), roughness: 0.97, metalness: 0 }),
    cloth: (color) =>
      new THREE.MeshStandardMaterial({ color, roughness: 0.9, side: THREE.DoubleSide }),
    glass: (color = 0xffb457, strength = 1.4) =>
      new THREE.MeshStandardMaterial({
        color: 0x2a2418, emissive: color, emissiveIntensity: strength, roughness: 0.35,
      }),
    iron: () =>
      new THREE.MeshStandardMaterial({ color: 0x33343a, roughness: 0.5, metalness: 0.75 }),
    leaf: (color) =>
      new THREE.MeshStandardMaterial({ color, roughness: 0.85, flatShading: true }),
  };
}

/* ── the ground ───────────────────────────────────────────── */

export function valeHeight(x, z) {
  return (
    Math.sin(x * 0.011) * 7 +
    Math.cos(z * 0.009) * 6 +
    Math.sin((x + z) * 0.0042) * 11 +
    Math.cos((x - z) * 0.0075) * 4
  );
}

export function createStage({
  sky = { top: 0x1c3a63, horizon: 0xbcd6e8, glow: 0xffe6b8, aurora: 0x8fb7d8 },
  fog = 0x9fb6c4,
  fogDensity = 0.0032,
  sun = 0xffe2b0,
  sunStrength = 2.4,
  size = 900,
  segments = 130,
  heightFn = valeHeight,
  colors = { snow: 0x86a04e, rock: 0x6f6a44, shadow: 0x3d4a2c, base: -12 },
} = {}) {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(fog);
  scene.fog = new THREE.FogExp2(fog, fogDensity);

  const camera = new THREE.PerspectiveCamera(44, 1, 0.1, 4000);

  const skyMesh = createSky({
    top: sky.top,
    horizon: sky.horizon,
    glow: sky.glow,
    aurora: sky.aurora,
    auroraAmount: 0.22,
    moonDir: new THREE.Vector3(0.45, 0.34, -0.8),
  });
  scene.add(skyMesh.mesh);

  scene.add(new THREE.HemisphereLight(0xdcecff, 0x3f4a2c, 1.15));

  const key = new THREE.DirectionalLight(sun, sunStrength);
  key.position.set(120, 150, 90);
  scene.add(key);

  const rim = new THREE.DirectionalLight(0xffd9a8, 0.55);
  rim.position.set(-140, 40, -110);
  scene.add(rim);

  const ground = createTerrain({
    size,
    segments,
    heightFn,
    colors,
    material: new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.96, metalness: 0.02 }),
  });
  scene.add(ground);

  return { scene, camera, sky: skyMesh, key, heightFn, ground };
}

/* ── village pieces ───────────────────────────────────────── */

export function createHouse(m, { w = 8, d = 7, h = 6.5, roof = 0x8c3f2c, thatch = false } = {}) {
  const g = new THREE.Group();
  const base = 1.4;

  const plinth = new THREE.Mesh(new THREE.BoxGeometry(w + 0.5, base, d + 0.5), m.stone(0x6d6559));
  plinth.position.y = base / 2;
  plinth.castShadow = true;
  plinth.receiveShadow = true;
  g.add(plinth);

  const body = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m.plaster());
  body.position.y = base + h / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);

  // oak frame
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.42, h, 0.42), m.oak());
      post.position.set(sx * (w / 2 - 0.1), base + h / 2, sz * (d / 2 - 0.1));
      g.add(post);
    }
  }
  for (const sz of [-1, 1]) {
    const rail = new THREE.Mesh(new THREE.BoxGeometry(w + 0.2, 0.34, 0.3), m.oak());
    rail.position.set(0, base + h * 0.56, sz * d / 2);
    g.add(rail);
    const plate = new THREE.Mesh(new THREE.BoxGeometry(w + 0.3, 0.4, 0.34), m.oak());
    plate.position.set(0, base + h - 0.2, sz * d / 2);
    g.add(plate);
  }

  // gable roof
  const rise = Math.max(2.1, w * 0.4);
  const halfSpan = w / 2 + 0.9;
  const slope = Math.hypot(halfSpan, rise);
  const ang = Math.atan2(rise, halfSpan);
  const roofMat = thatch ? m.thatch() : m.shingle(roof);
  for (const sx of [-1, 1]) {
    const plane = new THREE.Mesh(new THREE.BoxGeometry(slope, 0.42, d * 1.2), roofMat);
    plane.position.set(sx * (halfSpan / 2), base + h + rise / 2, 0);
    plane.rotation.z = -sx * ang;
    plane.castShadow = true;
    plane.receiveShadow = true;
    g.add(plane);
  }
  const ridge = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.5, d * 1.24), m.oak(0x3d2c1e));
  ridge.position.y = base + h + rise;
  g.add(ridge);

  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, 0);
  shape.lineTo(w / 2, 0);
  shape.lineTo(0, rise);
  shape.closePath();
  const gableGeo = new THREE.ExtrudeGeometry(shape, { depth: 0.24, bevelEnabled: false });
  for (const sz of [-1, 1]) {
    const gable = new THREE.Mesh(gableGeo, m.plaster());
    gable.position.set(0, base + h, sz > 0 ? d / 2 - 0.24 : -d / 2);
    gable.castShadow = true;
    g.add(gable);
  }

  // chimney
  const chimney = new THREE.Mesh(new THREE.BoxGeometry(1.4, h * 0.62 + 3.4, 1.4), m.stone(0x6d6559));
  chimney.position.set(w * 0.3, base + h * 0.72, -d * 0.22);
  chimney.castShadow = true;
  g.add(chimney);
  const cap = new THREE.Mesh(new THREE.BoxGeometry(1.8, 0.4, 1.8), m.stone(0x5d574d));
  cap.position.set(w * 0.3, base + h * 0.72 + (h * 0.62 + 3.4) / 2 + 0.2, -d * 0.22);
  g.add(cap);

  // door, step, lamp
  const dw = Math.min(1.7, w * 0.26), dh = 2.9;
  const door = new THREE.Mesh(new THREE.BoxGeometry(dw, dh, 0.2), m.oak(0x5a3f26));
  door.position.set(0, base + dh / 2, d / 2 + 0.08);
  g.add(door);
  const frame = new THREE.Mesh(new THREE.BoxGeometry(dw + 0.5, 0.3, 0.3), m.oak(0x3d2c1e));
  frame.position.set(0, base + dh + 0.15, d / 2 + 0.1);
  g.add(frame);
  const step = new THREE.Mesh(new THREE.BoxGeometry(dw + 1, 0.36, 1), m.stone(0x77705f));
  step.position.set(0, base / 2 - 0.2, d / 2 + 0.6);
  g.add(step);
  const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.7, 0.5), m.glass(0xffab48, 2));
  lamp.position.set(dw * 0.7, base + dh + 0.5, d / 2 + 0.3);
  g.add(lamp);
  const lampGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture(64, "255,180,92"), color: 0xffb45c, transparent: true,
      opacity: 0.55, blending: THREE.AdditiveBlending, depthWrite: false,
    }),
  );
  lampGlow.scale.setScalar(3.4);
  lampGlow.position.copy(lamp.position);
  g.add(lampGlow);

  // windows with shutters
  const pane = m.glass(0xffb457, 1.5);
  const placeWindow = (px, pz, ry) => {
    const u = new THREE.Group();
    const glass = new THREE.Mesh(new THREE.BoxGeometry(1.1, 1.4, 0.12), pane);
    u.add(glass);
    const barV = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.5, 0.18), m.oak(0x3d2c1e));
    u.add(barV);
    const barH = new THREE.Mesh(new THREE.BoxGeometry(1.2, 0.1, 0.18), m.oak(0x3d2c1e));
    u.add(barH);
    const sill = new THREE.Mesh(new THREE.BoxGeometry(1.5, 0.16, 0.4), m.oak(0x3d2c1e));
    sill.position.y = -0.8;
    u.add(sill);
    for (const sx of [-1, 1]) {
      const sh = new THREE.Mesh(new THREE.BoxGeometry(0.6, 1.4, 0.1), m.oak(0x4a3527));
      sh.position.set(sx * 0.86, 0, 0.22);
      sh.rotation.y = sx * -0.55;
      u.add(sh);
    }
    u.position.set(px, base + h * 0.66, pz);
    u.rotation.y = ry;
    g.add(u);
  };
  placeWindow(-w * 0.28, d / 2 + 0.05, 0);
  placeWindow(w * 0.28, d / 2 + 0.05, 0);
  placeWindow(w / 2 + 0.05, 0, Math.PI / 2);

  // a barrel and a woodpile by the wall
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.58, 1.3, 10), m.oak(0x6b4a2c));
  barrel.position.set(-w * 0.42, base / 2 + 0.65, d / 2 + 0.7);
  barrel.castShadow = true;
  g.add(barrel);

  return g;
}

export function createVillage(m, { count = 7, radius = 14 } = {}) {
  const g = new THREE.Group();
  const roofs = [0x8c3f2c, 0x7a4a2e, 0x6b3a34, 0x5d5a52];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + 0.2;
    const r = radius + rand(-1.5, 1.5);
    const h = createHouse(m, {
      w: rand(7, 9.6),
      d: rand(6.4, 8.2),
      h: rand(5.6, 7.4),
      roof: roofs[i % roofs.length],
      thatch: i % 3 === 0,
    });
    h.position.set(Math.cos(a) * r, 0, Math.sin(a) * r);
    h.rotation.y = Math.atan2(-Math.cos(a), -Math.sin(a));
    g.add(h);
  }

  // the well
  const well = new THREE.Group();
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, 1.5, 14), m.stone(0x8b8578));
  drum.position.y = 0.75;
  drum.castShadow = true;
  well.add(drum);
  for (const sx of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, 3, 0.3), m.oak());
    post.position.set(sx * 1.2, 2.1, 0);
    well.add(post);
  }
  const roof = new THREE.Mesh(new THREE.ConeGeometry(2.4, 1.5, 4), m.shingle(0x7a4a2e));
  roof.rotation.y = Math.PI / 4;
  roof.position.y = 4.2;
  roof.castShadow = true;
  well.add(roof);
  g.add(well);

  // lantern posts down the lane
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + 0.9;
    const post = new THREE.Group();
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(0.18, 3.4, 0.18), m.oak());
    shaft.position.y = 1.7;
    post.add(shaft);
    const lamp = new THREE.Mesh(new THREE.BoxGeometry(0.44, 0.6, 0.44), m.glass(0xffab48, 2.2));
    lamp.position.y = 3.5;
    post.add(lamp);
    const halo = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture(64, "255,190,110"), color: 0xffb45c, transparent: true,
        opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false,
      }),
    );
    halo.scale.setScalar(3);
    halo.position.y = 3.5;
    post.add(halo);
    post.position.set(Math.cos(a) * (radius - 5.5), 0, Math.sin(a) * (radius - 5.5));
    g.add(post);
  }

  // split-rail fences between the houses
  for (let i = 0; i < count; i++) {
    const a = (i / count) * Math.PI * 2 + 0.2 + Math.PI / count;
    const px = Math.cos(a) * (radius - 3), pz = Math.sin(a) * (radius - 3);
    const fence = new THREE.Group();
    for (let k = -1; k <= 1; k++) {
      const post = new THREE.Mesh(new THREE.BoxGeometry(0.14, 1.1, 0.14), m.oak(0x5a4630));
      post.position.set(k * 1.6, 0.55, 0);
      fence.add(post);
    }
    for (const y of [0.45, 0.85]) {
      const rail = new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.12, 0.1), m.oak(0x5a4630));
      rail.position.y = y;
      fence.add(rail);
    }
    fence.position.set(px, 0, pz);
    fence.rotation.y = -a;
    g.add(fence);
  }

  return g;
}

export function createTree(m, { height = 9, conifer = false } = {}) {
  const g = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.28, 0.52, height * 0.55, 7), m.oak(0x4a3a28));
  trunk.position.y = height * 0.275;
  trunk.castShadow = true;
  g.add(trunk);
  if (conifer) {
    for (let i = 0; i < 4; i++) {
      const r = 2.6 - i * 0.5;
      const cone = new THREE.Mesh(new THREE.ConeGeometry(r, height * 0.34, 8), m.leaf(i % 2 ? 0x2f5c33 : 0x26492a));
      cone.position.y = height * (0.42 + i * 0.16);
      cone.castShadow = true;
      g.add(cone);
    }
  } else {
    for (let i = 0; i < 4; i++) {
      const r = rand(1.7, 2.6);
      const canopy = new THREE.Mesh(new THREE.IcosahedronGeometry(r, 1), m.leaf(i % 2 ? 0x3c6b35 : 0x2f5c33));
      canopy.position.set(rand(-1.4, 1.4), height * 0.62 + rand(0, 2.2), rand(-1.4, 1.4));
      canopy.scale.y = 0.85;
      canopy.castShadow = true;
      g.add(canopy);
    }
  }
  return g;
}

export function scatterTrees(m, heightFn, { count = 90, radius = 220, skip = 26 } = {}) {
  const g = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = skip + Math.sqrt(Math.random()) * (radius - skip);
    const x = Math.cos(a) * r, z = Math.sin(a) * r;
    const tree = createTree(m, { height: rand(7, 13), conifer: Math.random() > 0.65 });
    tree.position.set(x, heightFn(x, z) - 0.4, z);
    tree.rotation.y = rand(0, 6.28);
    g.add(tree);
  }
  return g;
}

export function createSunstone(m, { lit = false, scale = 1 } = {}) {
  const g = new THREE.Group();
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(2.4, 3.2, 4, 8), m.stone(0x9a9488));
  pedestal.position.y = 2;
  pedestal.castShadow = true;
  g.add(pedestal);

  const mat = new THREE.MeshStandardMaterial({
    color: lit ? 0xffd27a : 0x6b6250,
    emissive: 0xffc457,
    emissiveIntensity: lit ? 2.4 : 0.05,
    roughness: 0.2,
    metalness: 0.2,
  });
  const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(2.6 * scale, 1), mat);
  orb.position.y = 8 * scale;
  g.add(orb);

  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture(128, "255,210,140"), color: 0xffc457, transparent: true,
      opacity: lit ? 0.85 : 0.06, blending: THREE.AdditiveBlending, depthWrite: false,
    }),
  );
  halo.scale.setScalar(lit ? 34 : 12);
  halo.position.y = orb.position.y;
  g.add(halo);

  const light = new THREE.PointLight(0xffc457, lit ? 60 : 2, lit ? 90 : 20, 2);
  light.position.y = orb.position.y;
  g.add(light);

  const cage = new THREE.Mesh(new THREE.TorusGeometry(4 * scale, 0.22, 6, 26), m.iron());
  cage.rotation.x = Math.PI / 2;
  cage.position.y = orb.position.y;
  g.add(cage);

  g.userData.update = (t) => {
    orb.rotation.y = t * 0.2;
    orb.position.y = 8 * scale + Math.sin(t * 0.7) * 0.3;
    halo.position.y = orb.position.y;
    cage.rotation.z = t * 0.25;
    if (lit) halo.material.opacity = 0.75 + 0.2 * Math.sin(t * 2.1);
  };
  return g;
}

export function createShrine(m, { color = 0x7dffa3, lit = false } = {}) {
  const g = new THREE.Group();
  for (let i = 0; i < 3; i++) {
    const step = new THREE.Mesh(new THREE.CylinderGeometry(13 - i, 13.6 - i, 0.8, 20), m.stone(0x9a9488));
    step.position.y = 0.4 + i * 0.8;
    step.receiveShadow = true;
    g.add(step);
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    const px = Math.cos(a) * 8.4, pz = Math.sin(a) * 8.4;
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(1.7, 9.4, 1.7), m.stone(0x8b8679));
    shaft.position.set(px, 5.6, pz);
    shaft.rotation.y = -a;
    shaft.castShadow = true;
    g.add(shaft);
    const cap = new THREE.Mesh(new THREE.BoxGeometry(2.5, 1.1, 2.5), m.stone(0x7e796d));
    cap.position.set(px, 10.6, pz);
    cap.rotation.y = -a;
    g.add(cap);
  }
  const ring = new THREE.Mesh(new THREE.TorusGeometry(8.6, 0.7, 6, 22), m.stone(0x8b8679));
  ring.rotation.x = Math.PI / 2;
  ring.position.y = 11.4;
  g.add(ring);

  const orbMat = new THREE.MeshStandardMaterial({
    color, emissive: color, emissiveIntensity: lit ? 2.6 : 0.1, roughness: 0.22, metalness: 0.15,
  });
  const orb = new THREE.Mesh(new THREE.IcosahedronGeometry(1.9, 1), orbMat);
  orb.position.y = 7.6;
  g.add(orb);
  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture(128, "255,255,255"), color, transparent: true,
      opacity: lit ? 0.8 : 0.08, blending: THREE.AdditiveBlending, depthWrite: false,
    }),
  );
  halo.scale.setScalar(lit ? 26 : 10);
  halo.position.y = 7.6;
  g.add(halo);

  g.userData.update = (t) => {
    orb.rotation.y = t * 0.4;
    orb.position.y = 7.6 + Math.sin(t * 0.9) * 0.25;
    halo.position.y = orb.position.y;
    if (lit) halo.material.opacity = 0.68 + 0.2 * Math.sin(t * 1.7);
  };
  return g;
}

export function createKeep(m, { lit = false } = {}) {
  const g = new THREE.Group();
  const wallH = 14, half = 34;
  const stone = m.stone(0x6f6a60);

  const wall = (w, d, px, pz) => {
    const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, wallH, d), stone);
    mesh.position.set(px, wallH / 2, pz);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    g.add(mesh);
    const along = Math.max(w, d), horiz = w > d;
    const n = Math.floor(along / 6);
    for (let i = 0; i < n; i++) {
      const t = (i + 0.5) / n - 0.5;
      const merlon = new THREE.Mesh(new THREE.BoxGeometry(horiz ? 3 : 5, 3, horiz ? 5 : 3), m.stone(0x847e72));
      merlon.position.set(px + (horiz ? t * w : 0), wallH + 1.5, pz + (horiz ? 0 : t * d));
      g.add(merlon);
    }
  };
  wall(4, half * 2, -half, 0);
  wall(4, half * 2, half, 0);
  wall(half * 2, 4, 0, -half);
  for (const sx of [-1, 1]) wall(half - 10, 4, sx * (half / 2 + 5), half);

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const tower = new THREE.Mesh(new THREE.CylinderGeometry(7, 8, 26, 12), stone);
      tower.position.set(sx * half, 13, sz * half);
      tower.castShadow = true;
      g.add(tower);
      const cap = new THREE.Mesh(new THREE.ConeGeometry(9, 9, 12), m.shingle(0x4a3f52));
      cap.position.set(sx * half, 30, sz * half);
      cap.castShadow = true;
      g.add(cap);
    }
  }

  // gatehouse
  for (const sx of [-1, 1]) {
    const t = new THREE.Mesh(new THREE.BoxGeometry(9, 21, 9), stone);
    t.position.set(sx * 11, 10.5, half);
    t.castShadow = true;
    g.add(t);
    const cap = new THREE.Mesh(new THREE.ConeGeometry(7, 8, 4), m.shingle(0x4a3f52));
    cap.rotation.y = Math.PI / 4;
    cap.position.set(sx * 11, 25, half);
    g.add(cap);
    const banner = new THREE.Mesh(new THREE.PlaneGeometry(3.4, 8), m.cloth(0x6a2130));
    banner.position.set(sx * 11, 12, half + 4.7);
    g.add(banner);
  }
  const arch = new THREE.Mesh(new THREE.BoxGeometry(15, 3.4, 9), m.stone(0x847e72));
  arch.position.set(0, 21, half);
  g.add(arch);

  // the dais and the Sunstone it holds
  for (let i = 0; i < 3; i++) {
    const step = new THREE.Mesh(new THREE.CylinderGeometry(11 - i * 1.8, 11.4 - i * 1.8, 0.9, 16), m.stone(0x8b8579));
    step.position.y = 0.45 + i * 0.9;
    g.add(step);
  }
  const sun = createSunstone(m, { lit, scale: 1.1 });
  sun.position.y = 2.7;
  g.add(sun);
  g.userData.sun = sun;

  // torches at the gate
  const flames = [];
  for (const sx of [-1, 1]) {
    const post = new THREE.Mesh(new THREE.BoxGeometry(0.3, 4, 0.3), m.oak());
    post.position.set(sx * 7, 2, half + 6);
    g.add(post);
    const fl = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture(64, "255,170,80"), color: 0xff9a3c, transparent: true,
        opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false,
      }),
    );
    fl.scale.setScalar(3.6);
    fl.position.set(sx * 7, 4.4, half + 6);
    g.add(fl);
    flames.push(fl);
  }

  g.userData.update = (t) => {
    sun.userData.update(t);
    flames.forEach((f, i) => {
      f.scale.setScalar(3.4 + Math.sin(t * 8 + i) * 0.5);
      f.material.opacity = 0.7 + 0.25 * Math.sin(t * 9 + i);
    });
  };
  return g;
}

export function createClouds({ count = 14, radius = 260, height = 90 } = {}) {
  const g = new THREE.Group();
  const puffs = [];
  for (let i = 0; i < count; i++) {
    const s = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture(128, "255,255,255"), color: 0xf4f8ff, transparent: true,
        opacity: rand(0.14, 0.3), depthWrite: false,
      }),
    );
    const a = Math.random() * Math.PI * 2;
    const r = rand(40, radius);
    s.position.set(Math.cos(a) * r, height + rand(-14, 26), Math.sin(a) * r);
    s.scale.set(rand(60, 140), rand(26, 52), 1);
    g.add(s);
    puffs.push({ s, speed: rand(0.4, 1.1) });
  }
  g.userData.update = (t) => {
    puffs.forEach((p) => {
      p.s.position.x += p.speed * 0.02;
      if (p.s.position.x > radius) p.s.position.x = -radius;
      p.s.material.opacity = 0.16 + 0.06 * Math.sin(t * 0.3 + p.s.position.z);
    });
  };
  return g;
}

export function createBirds({ count = 14, radius = 60, height = 34 } = {}) {
  const g = new THREE.Group();
  const birds = [];
  const mat = new THREE.MeshStandardMaterial({ color: 0x23282c, roughness: 0.9 });
  for (let i = 0; i < count; i++) {
    const b = new THREE.Group();
    const body = new THREE.Mesh(new THREE.ConeGeometry(0.28, 1.5, 4), mat);
    body.rotation.x = Math.PI / 2;
    b.add(body);
    for (const sx of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 0.4), mat);
      wing.position.x = sx * 0.8;
      b.add(wing);
      b.userData["wing" + (sx > 0 ? "R" : "L")] = wing;
    }
    g.add(b);
    birds.push({ b, a: Math.random() * 6.28, r: radius * rand(0.7, 1.3), y: height + rand(-8, 10), speed: rand(0.06, 0.14) });
  }
  g.userData.update = (t) => {
    birds.forEach((o, i) => {
      o.a += o.speed * 0.02;
      o.b.position.set(Math.cos(o.a) * o.r, o.y + Math.sin(t * 0.6 + i) * 1.5, Math.sin(o.a) * o.r);
      o.b.rotation.y = -o.a;
      const flap = Math.sin(t * 9 + i * 1.3) * 0.5;
      o.b.userData.wingL.rotation.z = flap;
      o.b.userData.wingR.rotation.z = -flap;
    });
  };
  return g;
}

export function createMeadowDust({ count = 900, area = 160, height = 30, color = 0xfff2c8 } = {}) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3] = rand(-area / 2, area / 2);
    pos[i * 3 + 1] = rand(0.5, height);
    pos[i * 3 + 2] = rand(-area / 2, area / 2);
  }
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const mat = new THREE.PointsMaterial({
    map: glowTexture(64, "255,240,200"), color, size: 0.7, transparent: true,
    opacity: 0.55, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true,
  });
  const pts = new THREE.Points(geo, mat);
  pts.userData.noShadow = true;
  const base = pos.slice();
  pts.userData.update = (t) => {
    const p = geo.attributes.position.array;
    for (let i = 0; i < count; i++) {
      p[i * 3] = base[i * 3] + Math.sin(t * 0.4 + i) * 2.4;
      p[i * 3 + 1] = base[i * 3 + 1] + Math.sin(t * 0.7 + i * 0.7) * 1.2;
      p[i * 3 + 2] = base[i * 3 + 2] + Math.cos(t * 0.35 + i * 0.4) * 2.4;
    }
    geo.attributes.position.needsUpdate = true;
  };
  return pts;
}

export { createGodRay, createGroundFog, createFireflies, glowTexture, clamp01, rand };