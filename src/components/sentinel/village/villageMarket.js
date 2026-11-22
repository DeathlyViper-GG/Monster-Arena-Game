import * as THREE from "three";
import { glowTexture, rand } from "@/components/glacialArchive/Cutscene";

/* ═════════════════════════════════════════════════════════════════
   HOLLOWMERE'S MARKET — the bits that make it a village and not a
   green with six huts: a strip of stalls under striped awnings,
   strings of lanterns between the posts, crates, barrels and the
   warm pool of light each cart throws on the cobbles.
   ═════════════════════════════════════════════════════════════════ */

function flat(color, extra = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.9,
    metalness: 0.05,
    flatShading: true,
    ...extra,
  });
}

function glowSprite(rgb, opacity = 0.5, scale = 2) {
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture(128, rgb),
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  sprite.scale.setScalar(scale);
  return sprite;
}

function rgbOf(color) {
  const c = new THREE.Color(color);
  return `${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)}`;
}

/* A four-panel awning, alternating colour so it reads as stripes. */
function createAwning(radius, height, colors) {
  const positions = [];
  const vertexColors = [];
  const corners = [
    [radius, 0, radius],
    [-radius, 0, radius],
    [-radius, 0, -radius],
    [radius, 0, -radius],
  ];
  for (let i = 0; i < 4; i++) {
    const a = corners[i];
    const b = corners[(i + 1) % 4];
    positions.push(0, height, 0, a[0], a[1], a[2], b[0], b[1], b[2]);
    const c = new THREE.Color(colors[i % colors.length]);
    for (let k = 0; k < 3; k++) vertexColors.push(c.r, c.g, c.b);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(vertexColors, 3));
  geometry.computeVertexNormals();
  return new THREE.Mesh(
    geometry,
    new THREE.MeshStandardMaterial({
      vertexColors: true,
      flatShading: true,
      roughness: 0.92,
      side: THREE.DoubleSide,
    }),
  );
}

export function createCrate(seed = 0) {
  const size = rand(0.62, 0.9);
  const crate = new THREE.Mesh(new THREE.BoxGeometry(size, size, size), flat(0x6b563c));
  crate.position.y = size / 2;
  const band = new THREE.Mesh(new THREE.BoxGeometry(size * 1.02, 0.07, size * 0.18), flat(0x40352a));
  band.position.y = size * 0.72;
  const group = new THREE.Group();
  group.add(crate, band);
  group.rotation.y = seed * 0.9;
  return { group, radius: size * 0.7 };
}

export function createBarrel(seed = 0) {
  const group = new THREE.Group();
  const body = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.36, 0.95, 10), flat(0x53412c));
  body.position.y = 0.48;
  group.add(body);
  for (const y of [0.24, 0.72]) {
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.035, 5, 12), flat(0x2f2a22));
    hoop.rotation.x = Math.PI / 2;
    hoop.position.y = y;
    group.add(hoop);
  }
  const lid = new THREE.Mesh(new THREE.CircleGeometry(0.35, 10), flat(0x6b563c));
  lid.rotation.x = -Math.PI / 2;
  lid.position.y = 0.96;
  group.add(lid);
  group.rotation.y = seed;
  return { group, radius: 0.55 };
}

/* ── a market stall ───────────────────────────────────────── */

export function createStall({ accent = 0xffd166, seed = 0 } = {}) {
  const group = new THREE.Group();

  const paving = new THREE.Mesh(new THREE.BoxGeometry(5.4, 0.12, 4.4), flat(0x4c5049));
  paving.position.y = 0.06;
  group.add(paving);

  for (const sx of [-1.75, 1.75]) {
    for (const sz of [-1.35, 1.35]) {
      const post = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.13, 3.0, 6), flat(0x3b2f26));
      post.position.set(sx, 1.5, sz);
      group.add(post);
    }
  }

  const awning = createAwning(2.95, 1.2, [accent, 0xf2e6cf, accent, 0xf2e6cf]);
  awning.position.y = 2.92;
  group.add(awning);
  awning.rotation.y = Math.PI / 4;

  /* scalloped edge, glowing faintly in the stall's colour */
  const trim = new THREE.Mesh(
    new THREE.TorusGeometry(2.05, 0.06, 5, 20),
    flat(accent, { emissive: accent, emissiveIntensity: 0.7 }),
  );
  trim.rotation.x = Math.PI / 2;
  trim.position.y = 2.86;
  group.add(trim);

  /* counter and back shelf */
  const counter = new THREE.Mesh(new THREE.BoxGeometry(3.3, 1.05, 1.1), flat(0x7a6446));
  counter.position.set(0, 0.53, 0.55);
  group.add(counter);
  const ledge = new THREE.Mesh(new THREE.BoxGeometry(3.5, 0.12, 1.2), flat(0x8f7854));
  ledge.position.set(0, 1.1, 0.55);
  group.add(ledge);

  const shelf = new THREE.Mesh(new THREE.BoxGeometry(3.3, 0.14, 0.85), flat(0x7a6446));
  shelf.position.set(0, 1.45, -0.95);
  group.add(shelf);

  /* goods: jars on the counter, bundles on the shelf */
  for (let i = 0; i < 5; i++) {
    const jar = new THREE.Mesh(
      new THREE.SphereGeometry(rand(0.1, 0.16), 8, 6),
      new THREE.MeshStandardMaterial({
        color: 0xf6e7c4,
        emissive: accent,
        emissiveIntensity: 0.5,
        roughness: 0.4,
        flatShading: true,
      }),
    );
    jar.position.set(-1.2 + i * 0.6, 1.28, 0.55);
    group.add(jar);
  }
  for (let i = 0; i < 4; i++) {
    const bundle = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.3, 0.5), flat(i % 2 ? 0x8c6f45 : 0x5f7a5a));
    bundle.position.set(-1.1 + i * 0.75, 1.62, -0.95);
    bundle.rotation.y = rand(-0.3, 0.3);
    group.add(bundle);
  }

  /* the shop sign, hung from the front of the awning */
  const sign = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.62, 0.09), flat(0x2b2118));
  sign.position.set(0, 2.45, 1.5);
  group.add(sign);
  const sigil = new THREE.Mesh(
    new THREE.OctahedronGeometry(0.19, 0),
    new THREE.MeshStandardMaterial({
      color: 0xffffff,
      emissive: accent,
      emissiveIntensity: 1.8,
      roughness: 0.2,
      flatShading: true,
    }),
  );
  sigil.position.set(0, 2.45, 1.58);
  group.add(sigil);

  /* a lantern at the corner, and the warm pool it throws */
  const lantern = new THREE.Mesh(
    new THREE.SphereGeometry(0.2, 9, 7),
    new THREE.MeshBasicMaterial({ color: accent }),
  );
  lantern.position.set(-1.75, 2.35, 1.45);
  group.add(lantern);
  const halo = glowSprite(rgbOf(accent), 0.55, 3.6);
  halo.position.copy(lantern.position);
  group.add(halo);

  const light = new THREE.PointLight(accent, 14, 12, 2);
  light.position.set(0, 2.5, 1.0);
  group.add(light);

  const crates = [];
  for (let i = 0; i < 2; i++) {
    const crate = createCrate(seed + i);
    crate.group.position.set(2.35 + i * 0.15, 0, -0.9 + i * 0.9);
    group.add(crate.group);
    crates.push(crate);
  }
  const barrel = createBarrel(seed * 0.7);
  barrel.group.position.set(-2.5, 0, -0.7);
  group.add(barrel.group);

  return { group, radius: 2.9, halo, light, sigil };
}

/* ── lantern strings ──────────────────────────────────────── */

export function createFestoon(ax, az, bx, bz, { height = 4.3, sag = 1.0, color = 0xffd9a0, count = 9 } = {}) {
  const group = new THREE.Group();
  const points = [];
  for (let i = 0; i <= 24; i++) {
    const t = i / 24;
    const x = ax + (bx - ax) * t;
    const z = az + (bz - az) * t;
    const y = height - sag * 4 * t * (1 - t);
    points.push(new THREE.Vector3(x, y, z));
  }
  const wire = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(points),
    new THREE.LineBasicMaterial({ color: 0x2a2620, transparent: true, opacity: 0.7 }),
  );
  group.add(wire);

  const halos = [];
  const bulbs = [];
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    const x = ax + (bx - ax) * t;
    const z = az + (bz - az) * t;
    const y = height - sag * 4 * t * (1 - t) - 0.16;
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.1, 7, 6),
      new THREE.MeshBasicMaterial({ color }),
    );
    bulb.position.set(x, y, z);
    group.add(bulb);
    bulbs.push(bulb);
    const halo = glowSprite(rgbOf(color), 0.42, 1.5);
    halo.position.set(x, y, z);
    group.add(halo);
    halos.push(halo);
  }
  return { group, halos, bulbs };
}

/* ── a pennant run for the gable of a house ───────────────── */

export function createPennants(ax, az, bx, bz, { height = 3.6, color = 0xffd166, count = 7 } = {}) {
  const group = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const t = (i + 0.5) / count;
    const flag = new THREE.Mesh(
      new THREE.PlaneGeometry(0.34, 0.5),
      new THREE.MeshStandardMaterial({
        color: i % 2 ? color : 0xf2e6cf,
        side: THREE.DoubleSide,
        roughness: 0.9,
        flatShading: true,
      }),
    );
    flag.position.set(ax + (bx - ax) * t, height + Math.sin(t * Math.PI) * 0.16 - 0.25, az + (bz - az) * t);
    flag.rotation.y = Math.atan2(bx - ax, bz - az);
    group.add(flag);
  }
  return { group, count };
}