import * as THREE from "three";
import { glowTexture } from "@/components/glacialArchive/Cutscene";

/* ═════════════════════════════════════════════════════════════════
   THE PEOPLE OF HOLLOWMERE

   Two builders. `createWanderer` is you: the same hovering shell,
   visor and flourish you fight with in the arena, rolled along the
   road. `createNpc` builds the villagers — real people with a head,
   hair, a tunic, two arms and two legs that stride, varied in height,
   build and dress so a crowd never reads as one figure copied. The
   hooded look is kept for the things in the village that are not
   people.
   ═════════════════════════════════════════════════════════════════ */

const TAU = Math.PI * 2;

function flat(color, extra = {}) {
  return new THREE.MeshStandardMaterial({
    color,
    roughness: 0.88,
    metalness: 0.05,
    flatShading: true,
    ...extra,
  });
}

function glowSprite(rgb, size = 128, opacity = 0.6) {
  return new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture(size, rgb),
      transparent: true,
      opacity,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
}

const rgbOf = (color) =>
  `${Math.round(color.r * 255)},${Math.round(color.g * 255)},${Math.round(color.b * 255)}`;

/* ── the flourish that matches the arena's Customise designs ── */

function buildFlourish(parent, design, accent) {
  const glow = new THREE.MeshStandardMaterial({
    color: accent,
    emissive: accent,
    emissiveIntensity: 1.1,
    roughness: 0.35,
    flatShading: true,
  });
  const dark = new THREE.MeshStandardMaterial({
    color: 0x141a22,
    roughness: 0.7,
    flatShading: true,
    emissive: accent,
    emissiveIntensity: 0.22,
  });
  const ring = (radius, tube) => new THREE.Mesh(new THREE.TorusGeometry(radius, tube, 6, 16), glow);

  if (design === 1) {
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU;
      const spike = new THREE.Mesh(new THREE.ConeGeometry(0.07, 0.34, 4), glow);
      spike.position.set(Math.cos(a) * 0.56, 0, Math.sin(a) * 0.56);
      spike.rotation.z = -Math.cos(a) * 1.4;
      spike.rotation.x = Math.sin(a) * 1.4;
      parent.add(spike);
    }
  } else if (design === 2) {
    const maw = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.1, 5, 14), dark);
    maw.rotation.x = Math.PI / 2;
    parent.add(maw);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      const tooth = new THREE.Mesh(new THREE.ConeGeometry(0.06, 0.2, 4), glow);
      tooth.position.set(Math.cos(a) * 0.5, -0.12, Math.sin(a) * 0.5);
      tooth.rotation.x = Math.PI;
      parent.add(tooth);
    }
  } else if (design === 3) {
    parent.add(new THREE.Mesh(new THREE.CylinderGeometry(0.62, 0.62, 0.12, 6, 1, true), dark));
  } else if (design === 4) {
    const halo = ring(0.42, 0.05);
    halo.position.y = 0.94;
    halo.rotation.x = Math.PI / 2;
    parent.add(halo);
  } else if (design === 5) {
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      const flame = new THREE.Mesh(new THREE.ConeGeometry(0.11, 0.44, 5), glow);
      flame.position.set(Math.cos(a) * 0.5, Math.sin(i * 1.7) * 0.12, Math.sin(a) * 0.5);
      parent.add(flame);
    }
  } else if (design === 6) {
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU;
      const shard = new THREE.Mesh(new THREE.OctahedronGeometry(0.12, 0), glow);
      shard.position.set(Math.cos(a) * 0.62, 0.06, Math.sin(a) * 0.62);
      parent.add(shard);
    }
  } else if (design === 7) {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU;
      const rod = new THREE.Mesh(new THREE.BoxGeometry(0.06, 0.06, 0.5), glow);
      rod.position.set(Math.cos(a) * 0.42, 0.1, Math.sin(a) * 0.42);
      rod.rotation.y = -a;
      parent.add(rod);
    }
  } else if (design === 8) {
    for (const side of [-1, 1]) {
      const horn = new THREE.Mesh(new THREE.ConeGeometry(0.09, 0.5, 5), glow);
      horn.position.set(side * 0.26, 0.98, 0);
      horn.rotation.z = -side * 0.5;
      parent.add(horn);
    }
  } else if (design === 9) {
    for (let i = 0; i < 3; i++) {
      const a = (i / 3) * TAU;
      const blade = new THREE.Mesh(new THREE.BoxGeometry(0.09, 0.06, 0.62), glow);
      blade.position.set(Math.cos(a) * 0.5, 0, Math.sin(a) * 0.5);
      blade.rotation.y = -a;
      parent.add(blade);
    }
  } else if (design >= 10) {
    const wingMat = new THREE.MeshStandardMaterial({
      color: accent,
      emissive: accent,
      emissiveIntensity: 0.75,
      transparent: true,
      opacity: 0.55,
      side: THREE.DoubleSide,
      flatShading: true,
    });
    for (const side of [-1, 1]) {
      const wing = new THREE.Mesh(new THREE.PlaneGeometry(0.7, 0.9), wingMat);
      wing.position.set(side * 0.62, 0.28, -0.2);
      wing.rotation.y = side * 0.5;
      wing.rotation.z = side * 0.25;
      parent.add(wing);
    }
  } else {
    const basic = ring(0.66, 0.035);
    basic.rotation.x = Math.PI / 2;
    parent.add(basic);
  }
}

/* ── the player: the arena's ball, hovering over the road ─── */

export function createWanderer(look = {}) {
  const accent = new THREE.Color(look.color || "#9fe3ff");
  const design = Number.isFinite(look.design) ? look.design : 0;
  const R = 1.02;
  const HOVER = 1.34;

  const group = new THREE.Group();
  // The shell bobs and leans; the group's own y is the road underfoot.
  const body = new THREE.Group();
  group.add(body);

  const shell = new THREE.Mesh(
    new THREE.SphereGeometry(R, 26, 20),
    new THREE.MeshStandardMaterial({
      color: accent,
      metalness: 0.55,
      roughness: 0.22,
      emissive: accent.clone().multiplyScalar(0.35),
      emissiveIntensity: 0.5,
    }),
  );
  shell.position.y = HOVER;
  body.add(shell);

  const core = glowSprite(rgbOf(accent), 128, 0.46);
  core.position.y = HOVER;
  core.scale.setScalar(R * 4.2);
  body.add(core);

  // The visor is what tells you which way the ball is facing.
  const visor = new THREE.Mesh(
    new THREE.SphereGeometry(R * 0.34, 16, 12),
    new THREE.MeshStandardMaterial({
      color: 0x070d12,
      metalness: 0.85,
      roughness: 0.12,
      emissive: 0x2f9fd0,
      emissiveIntensity: 1.1,
    }),
  );
  visor.position.set(0, HOVER + 0.02, R * 0.74);
  body.add(visor);

  const flourish = new THREE.Group();
  flourish.position.y = HOVER;
  body.add(flourish);
  buildFlourish(flourish, design, accent);

  const contact = new THREE.Mesh(
    new THREE.RingGeometry(R * 0.5, R * 1.05, 26),
    new THREE.MeshBasicMaterial({
      color: accent,
      transparent: true,
      opacity: 0.26,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  contact.rotation.x = -Math.PI / 2;
  contact.position.y = 0.06;
  body.add(contact);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(R * 0.85, 18),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.34, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.04;
  body.add(shadow);

  const update = (time, speed) => {
    const moving = speed > 0.15;
    const bounce = moving ? Math.abs(Math.sin(time * 8.6)) * 0.13 : 0;
    const h = HOVER + Math.sin(time * 2.4) * 0.07 + bounce;
    shell.position.y = h;
    visor.position.y = h + 0.02;
    flourish.position.y = h;
    core.position.y = h;

    // A ball leans into its own run.
    shell.scale.set(1 + bounce * 0.07, 1 - bounce * 0.07, 1 + bounce * 0.07);
    shell.rotation.y = time * (moving ? 2.4 : 0.5);

    flourish.rotation.y = time * (moving ? 2.2 : 0.7);
    flourish.rotation.x = Math.sin(time * 0.9) * 0.14;

    contact.material.opacity = 0.2 + Math.sin(time * 2.4) * 0.06 + (moving ? 0.1 : 0);
    contact.scale.setScalar(1 + Math.sin(time * 2.4) * 0.05);
    core.material.opacity = 0.38 + Math.sin(time * 3.1) * 0.08;
  };

  return { group, update, color: look.color || "#9fe3ff" };
}

/* ── villagers ────────────────────────────────────────────────
   Seven builds, all of them people: men and women in tunics and
   skirts, a stooped elder on a stick, a child, a smith in an apron,
   a shopkeeper, and — for the village's few uncanny residents — a
   hooded figure that is not trying to pass for human. */

const BUILDS = {
  man: { scale: 1, skirt: false, apron: false, cap: false, hair: "short", staff: false, hood: false },
  woman: { scale: 0.97, skirt: true, apron: false, cap: false, hair: "long", staff: false, hood: false },
  elder: { scale: 0.93, skirt: false, apron: false, cap: false, hair: "grey", staff: true, hood: false, stoop: 0.16 },
  child: { scale: 0.6, skirt: false, apron: false, cap: false, hair: "short", staff: false, hood: false },
  smith: { scale: 1.04, skirt: false, apron: true, cap: true, hair: "short", staff: false, hood: false },
  keeper: { scale: 0.98, skirt: true, apron: true, cap: false, hair: "bun", staff: false, hood: false },
  mystic: { scale: 1.1, skirt: false, apron: false, cap: false, hair: "none", staff: false, hood: true },
};

const SKIN_TONES = [0xe7bd97, 0xd4a279, 0xb2825a, 0x8c6242, 0xf1cdaa];
const CLOTH_TONES = [0x4d5a68, 0x5f4d3e, 0x53614c, 0x6b4b54, 0x424f5e, 0x6e5b46, 0x7a4c3b, 0x455048];
const HAIR_TONES = {
  short: [0x2b2119, 0x453224, 0x63492f],
  long: [0x2b2119, 0x4d3524, 0x8a6a3e],
  bun: [0x33261c, 0x584030],
  grey: [0xbdb6a8, 0x9c968a],
  none: [0x1d1a17],
};

export function createNpc({ accent = "#d8f5ff", height = 3.4, seed = 0, variant = "man" } = {}) {
  const build = BUILDS[variant] || BUILDS.man;
  const size = height * build.scale;
  const u = size / 3.4;
  const color = new THREE.Color(accent);
  const pick = (list, k) => list[Math.abs(Math.round(seed * 13.7 + k * 3.1)) % list.length];

  const group = new THREE.Group();
  const figure = new THREE.Group();
  if (build.stoop) figure.rotation.x = build.stoop;
  group.add(figure);

  const cloth = flat(pick(CLOTH_TONES, 1), { roughness: 0.92 });
  const trousers = flat(0x3b3a34, { roughness: 0.93 });
  const skin = flat(pick(SKIN_TONES, 2), { roughness: 0.86 });
  const hair = flat(pick(HAIR_TONES[build.hair] || HAIR_TONES.short, 3), { roughness: 0.95 });
  const trim = new THREE.MeshStandardMaterial({
    color,
    emissive: color,
    emissiveIntensity: 0.3,
    roughness: 0.55,
    flatShading: true,
  });

  /* two legs that take a stride */
  const legs = [];
  for (const side of [-1, 1]) {
    const leg = new THREE.Group();
    leg.position.set(side * 0.15 * u, 0.88 * u, 0);
    figure.add(leg);
    const limb = new THREE.Mesh(new THREE.CapsuleGeometry(0.082 * u, 0.5 * u, 3, 6), trousers);
    limb.position.y = -0.3 * u;
    leg.add(limb);
    const boot = new THREE.Mesh(new THREE.BoxGeometry(0.19 * u, 0.15 * u, 0.33 * u), flat(0x2b2318));
    boot.position.set(0, -0.6 * u, 0.05 * u);
    leg.add(boot);
    legs.push({ group: leg, side });
  }

  /* a tunic, and a skirt over its hem for the women */
  const tunic = new THREE.Mesh(new THREE.CylinderGeometry(0.25 * u, 0.33 * u, 0.76 * u, 8), cloth);
  tunic.position.y = 1.26 * u;
  figure.add(tunic);

  if (build.skirt) {
    const skirt = new THREE.Mesh(new THREE.CylinderGeometry(0.3 * u, 0.46 * u, 0.66 * u, 9), cloth);
    skirt.position.y = 0.92 * u;
    figure.add(skirt);
  }

  const belt = new THREE.Mesh(new THREE.TorusGeometry(0.3 * u, 0.035 * u, 5, 14), flat(0x33291f));
  belt.rotation.x = Math.PI / 2;
  belt.position.y = 0.96 * u;
  figure.add(belt);

  const collar = new THREE.Mesh(new THREE.TorusGeometry(0.2 * u, 0.03 * u, 5, 12), trim);
  collar.rotation.x = Math.PI / 2;
  collar.position.y = 1.58 * u;
  figure.add(collar);

  /* the head */
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.08 * u, 0.1 * u, 0.14 * u, 6), skin);
  neck.position.y = 1.68 * u;
  figure.add(neck);

  const head = new THREE.Mesh(new THREE.SphereGeometry(0.2 * u, 14, 11), skin);
  head.position.y = 1.9 * u;
  figure.add(head);

  if (build.hair !== "none") {
    const cap = new THREE.Mesh(
      new THREE.SphereGeometry(0.208 * u, 14, 10, 0, TAU, 0, Math.PI * 0.62),
      hair,
    );
    cap.position.y = 1.9 * u;
    figure.add(cap);
    if (build.hair === "long") {
      const fall = new THREE.Mesh(new THREE.CapsuleGeometry(0.11 * u, 0.3 * u, 3, 6), hair);
      fall.position.set(0, 1.78 * u, -0.15 * u);
      figure.add(fall);
    }
    if (build.hair === "bun") {
      const bun = new THREE.Mesh(new THREE.SphereGeometry(0.1 * u, 8, 6), hair);
      bun.position.set(0, 1.98 * u, -0.19 * u);
      figure.add(bun);
    }
  }

  const nose = new THREE.Mesh(new THREE.ConeGeometry(0.035 * u, 0.09 * u, 4), skin);
  nose.position.set(0, 1.88 * u, 0.2 * u);
  nose.rotation.x = Math.PI / 2;
  figure.add(nose);

  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.028 * u, 6, 5), flat(0x1b1a18));
    eye.position.set(side * 0.072 * u, 1.94 * u, 0.175 * u);
    figure.add(eye);
  }

  if (build.cap) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.2 * u, 0.22 * u, 0.11 * u, 8), cloth);
    cap.position.y = 2.04 * u;
    figure.add(cap);
  }

  if (build.apron) {
    const apron = new THREE.Mesh(
      new THREE.PlaneGeometry(0.44 * u, 0.66 * u),
      flat(0x8e8168, { roughness: 0.95, side: THREE.DoubleSide }),
    );
    apron.position.set(0, 1.06 * u, 0.29 * u);
    figure.add(apron);
  }

  /* two arms: the left swings, the right is free to wave */
  const arms = [];
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Group();
    shoulder.position.set(side * 0.3 * u, 1.52 * u, 0);
    shoulder.rotation.z = side * 0.14;
    figure.add(shoulder);
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.07 * u, 0.42 * u, 3, 6), cloth);
    arm.position.y = -0.28 * u;
    shoulder.add(arm);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(0.075 * u, 8, 6), skin);
    hand.position.y = -0.54 * u;
    shoulder.add(hand);
    arms.push({ group: shoulder, side });
  }
  const waving = arms[1].group;

  if (build.staff) {
    const staff = new THREE.Mesh(new THREE.CylinderGeometry(0.035 * u, 0.045 * u, 1.9 * u, 6), flat(0x40342a));
    staff.position.set(-0.42 * u, 0.95 * u, 0.1 * u);
    figure.add(staff);
  }

  if (build.hood) {
    const hood = new THREE.Mesh(new THREE.ConeGeometry(0.34 * u, 0.8 * u, 9), flat(0x141c22, { roughness: 0.95 }));
    hood.position.y = 2.0 * u;
    figure.add(hood);
    const eyes = new THREE.Mesh(new THREE.SphereGeometry(0.05 * u, 8, 6), new THREE.MeshBasicMaterial({ color }));
    eyes.position.set(0, 1.92 * u, 0.2 * u);
    figure.add(eyes);
  }

  /* the ground markers are an affordance, not an aura: they only
     really light up for the villager you are speaking to */
  const ring = new THREE.Mesh(
    new THREE.RingGeometry(0.62 * u, 0.82 * u, 24),
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0.1,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.06;
  group.add(ring);

  const halo = glowSprite(rgbOf(color), 64, 0.14);
  halo.position.y = size * 0.7;
  halo.scale.setScalar(1.8 * u);
  group.add(halo);

  const shadow = new THREE.Mesh(
    new THREE.CircleGeometry(0.55 * u, 16),
    new THREE.MeshBasicMaterial({ color: 0x000000, transparent: true, opacity: 0.32, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.04;
  group.add(shadow);

  const update = (time, focused, moving = 0, react = 0) => {
    const stride = time * 7.4 + seed;
    const lift = Math.max(0, Math.min(1, react));
    const walk = Math.min(1, moving);

    figure.position.y = walk > 0.05
      ? Math.abs(Math.sin(stride)) * 0.05 * walk
      : Math.sin(time * 0.9 + seed) * 0.02;
    figure.rotation.z = walk > 0.05
      ? Math.sin(stride) * 0.03 * walk
      : Math.sin(time * 0.5 + seed) * 0.008;

    legs.forEach((leg) => {
      leg.group.rotation.x = Math.sin(stride + (leg.side > 0 ? Math.PI : 0)) * 0.42 * walk;
    });
    arms.forEach((arm) => {
      if (arm.side < 0) arm.group.rotation.x = -Math.sin(stride) * 0.32 * walk;
    });

    // the greeting: the free arm comes up, waves, and settles
    waving.rotation.z = 0.14 + lift * (2.0 + Math.sin(time * 11) * 0.35);
    head.rotation.z = lift * Math.sin(time * 5.5) * 0.1;
    head.rotation.y = walk > 0.05 ? 0 : Math.sin(time * 0.4 + seed) * 0.12;

    ring.material.opacity = focused ? 0.32 : 0.08 + lift * 0.14;
    halo.material.opacity = build.hood
      ? 0.18 + Math.sin(time * 1.3 + seed) * 0.05 + (focused ? 0.12 : 0)
      : focused ? 0.16 : 0;
  };

  return { group, ring, halo, update, height: size * 0.72 };
}