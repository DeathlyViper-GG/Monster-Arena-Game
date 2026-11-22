import * as THREE from "three";
import {
  TAU,
  rand,
  clamp01,
  fbm2,
  ridged2,
  smoothstep,
  glowTexture,
  createEnvMap,
  createMaterialLibrary,
  createRuneCircle,
  createHoodedFigure,
  createRock,
} from "@/components/glacialArchive/Cutscene";

/* ═════════════════════════════════════════════════════════════════
   AGE OF THE SENTINEL — the shared asset kit.
   One visual vocabulary for the whole campaign: pale carved stone,
   gold inscription bands, and a single enormous construct whose eye
   is the only warm light in a still world.
   ═════════════════════════════════════════════════════════════════ */

export function createSentinelMaterials() {
  // The Scribe campaign's surfaces are carved, not painted: they carry normal
  // maps, clearcoat and a real environment reflection. The Sentinel kit had
  // plain standard materials, which is why its stone read as flat card.
  const lib = createMaterialLibrary();
  return {
    pale: lib.stone({
      color: 0xd6cfc0,
      roughness: 0.48,
      metalness: 0.16,
      envMapIntensity: 1.0,
      normalScale: new THREE.Vector2(0.7, 0.7),
    }),
    stone: lib.stone({
      color: 0x6b665e,
      roughness: 0.88,
      metalness: 0.14,
      envMapIntensity: 0.8,
      normalScale: new THREE.Vector2(1.0, 1.0),
    }),
    dark: new THREE.MeshPhysicalMaterial({
      color: 0x241f1b,
      roughness: 0.6,
      metalness: 0.4,
      clearcoat: 0.5,
      clearcoatRoughness: 0.34,
      envMapIntensity: 1.1,
    }),
    gold: new THREE.MeshPhysicalMaterial({
      color: 0xcf9d4a,
      roughness: 0.22,
      metalness: 1,
      clearcoat: 1,
      clearcoatRoughness: 0.1,
      emissive: 0x3a2205,
      emissiveIntensity: 1.15,
      envMapIntensity: 2.1,
    }),
    glass: new THREE.MeshPhysicalMaterial({
      color: 0xa8dbe8,
      roughness: 0.03,
      metalness: 0.5,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      transparent: true,
      opacity: 0.44,
      ior: 1.5,
      envMapIntensity: 2.4,
    }),
  };
}

/** An additive glow billboard. */
export function glowSprite(rgb = "255,214,150", size = 256, opacity = 1) {
  const material = new THREE.SpriteMaterial({
    map: glowTexture(size, rgb),
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    depthTest: false,
  });
  return new THREE.Sprite(material);
}

/* ── THE SENTINEL ────────────────────────────────────────────────
   A tower of pale stone with inscription bands, a crown of facets,
   three slow protocol rings and a single burning iris. Every scene
   places it at a different distance; it never faces away. */

const SENTINEL_PROFILE = [
  [0.0, 0.0],
  [0.46, 0.0],
  [0.52, 0.05],
  [0.4, 0.14],
  [0.32, 0.32],
  [0.37, 0.48],
  [0.46, 0.58],
  [0.37, 0.67],
  [0.21, 0.75],
  [0.25, 0.81],
  [0.15, 0.89],
  [0.08, 0.95],
  [0.0, 0.99],
];

export function createSentinel({ height = 60, accent = 0xffc46a, ringColor = 0xffca7a } = {}) {
  const group = new THREE.Group();
  const mats = createSentinelMaterials();
  const h = height;

  const body = new THREE.Mesh(
    new THREE.LatheGeometry(
      SENTINEL_PROFILE.map(([r, y]) => new THREE.Vector2(r * h * 0.34, y * h)),
      56,
    ),
    mats.pale,
  );
  group.add(body);

  /* inscription bands, each with its own glow phase */
  const bands = [];
  [0.16, 0.34, 0.56, 0.74].forEach((y, i) => {
    const radius = h * 0.34 * (0.52 - Math.abs(y - 0.45) * 0.5);
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(radius, h * 0.006, 8, 72),
      mats.gold.clone(),
    );
    band.rotation.x = Math.PI / 2;
    band.position.y = h * y;
    group.add(band);
    bands.push(band);
  });

  const crown = new THREE.Mesh(new THREE.ConeGeometry(h * 0.1, h * 0.14, 6), mats.pale);
  crown.position.y = h * 0.98;
  group.add(crown);

  const iris = new THREE.Mesh(
    new THREE.SphereGeometry(h * 0.042, 24, 18),
    new THREE.MeshBasicMaterial({ color: accent }),
  );
  iris.position.set(0, h * 0.93, h * 0.075);
  group.add(iris);

  const halo = glowSprite("255,212,148", 256, 0.8);
  halo.position.copy(iris.position);
  halo.scale.setScalar(h * 0.46);
  group.add(halo);

  const eyeLight = new THREE.PointLight(accent, 5, h * 8, 2);
  eyeLight.position.copy(iris.position);
  group.add(eyeLight);

  /* three protocol rings — preservation, correction, release */
  const rings = [];
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(h * (0.42 + i * 0.09), h * 0.007, 8, 96),
      new THREE.MeshBasicMaterial({
        color: ringColor,
        transparent: true,
        opacity: 0.5 - i * 0.11,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    ring.position.y = h * (0.54 + i * 0.015);
    group.add(ring);
    rings.push({ mesh: ring, speed: 0.16 + i * 0.1, dir: i % 2 ? -1 : 1 });
  }

  const update = (time) => {
    for (let i = 0; i < rings.length; i++) {
      const r = rings[i];
      r.mesh.rotation.z = time * r.speed * r.dir;
      r.mesh.rotation.x = Math.sin(time * 0.17 + i) * 0.34;
    }
    for (let i = 0; i < bands.length; i++) {
      bands[i].material.emissiveIntensity = 0.75 + Math.sin(time * 1.05 + i * 1.3) * 0.4;
    }
    const pulse = 0.75 + Math.sin(time * 1.5) * 0.25;
    halo.material.opacity = 0.5 + pulse * 0.4;
    halo.scale.setScalar(h * (0.4 + pulse * 0.12));
    eyeLight.intensity = 3.5 + pulse * 4.5;
  };

  return { group, update, iris, halo, body };
}

/* ── orbiting ward-shards ─────────────────────────────────────── */

export function createWardShards({ count = 5, radius = 26, height = 20, color = 0xffca7a, size = 1.5 } = {}) {
  const group = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0.85,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const shards = [];
  for (let i = 0; i < count; i++) {
    const mesh = new THREE.Mesh(new THREE.OctahedronGeometry(size, 0), material);
    group.add(mesh);
    shards.push({ mesh, phase: (i / count) * TAU, spin: rand(0.4, 1.1) });
  }
  const update = (time) => {
    for (let i = 0; i < shards.length; i++) {
      const s = shards[i];
      const a = s.phase + time * 0.24;
      s.mesh.position.set(
        Math.cos(a) * radius,
        height + Math.sin(time * 0.8 + s.phase) * 2.4,
        Math.sin(a) * radius,
      );
      s.mesh.rotation.y = time * s.spin;
      s.mesh.rotation.x = time * s.spin * 0.6;
    }
  };
  return { group, update };
}

/* ── ritual braziers ──────────────────────────────────────────── */

export function createBraziers({ count = 6, radius = 32, rgb = "255,150,70", height = 4.6 } = {}) {
  const group = new THREE.Group();
  const stoneMat = new THREE.MeshStandardMaterial({ color: 0x2b2320, roughness: 0.88, metalness: 0.24 });
  const flames = [];
  for (let i = 0; i < count; i++) {
    const a = (i / count) * TAU;
    const x = Math.cos(a) * radius;
    const z = Math.sin(a) * radius;
    const bowl = new THREE.Mesh(new THREE.CylinderGeometry(1.6, 0.9, height, 10), stoneMat);
    bowl.position.set(x, height / 2, z);
    group.add(bowl);

    const flame = glowSprite(rgb, 128, 0.9);
    flame.position.set(x, height + 1.5, z);
    flame.scale.setScalar(7);
    group.add(flame);

    const light = new THREE.PointLight(0xff8a3c, 7, 80, 2);
    light.position.set(x, height + 2, z);
    group.add(light);

    flames.push({ flame, light, phase: rand(0, TAU) });
  }
  const update = (time) => {
    for (let i = 0; i < flames.length; i++) {
      const f = flames[i];
      const flick = 0.7 + Math.sin(time * 6 + f.phase) * 0.16 + Math.sin(time * 13 + i) * 0.09;
      f.flame.scale.setScalar(6 + flick * 2.6);
      f.flame.material.opacity = 0.5 + flick * 0.4;
      f.light.intensity = 4.5 + flick * 5;
    }
  };
  return { group, update };
}

/* ── drifting motes (embers, dust, pollen) ────────────────────── */

export function createMotes({
  count = 1400,
  area = 260,
  height = 120,
  rgb = "255,190,120",
  size = 2.6,
  rise = 5,
} = {}) {
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const scales = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = rand(-area / 2, area / 2);
    positions[i * 3 + 1] = rand(0, height);
    positions[i * 3 + 2] = rand(-area / 2, area / 2);
    seeds[i] = Math.random();
    scales[i] = rand(0.55, 1.6);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
  geometry.setAttribute("aScale", new THREE.BufferAttribute(scales, 1));

  // Moved off the CPU: this is the same drift the Scribe campaign's ember
  // fields use, so every realm gets thousands of depth-faded, softly lit
  // particles for the cost of one uniform write per frame.
  const uniforms = {
    uTime: { value: 0 },
    uSize: { value: size },
    uHeight: { value: height },
    uRise: { value: rise },
    uColor: { value: new THREE.Color(`rgb(${rgb})`) },
    uPixelRatio: {
      value: Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 1.8),
    },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      uniform float uTime;
      uniform float uSize;
      uniform float uHeight;
      uniform float uRise;
      uniform float uPixelRatio;
      attribute float aSeed;
      attribute float aScale;
      varying float vFade;
      void main() {
        vec3 p = position;
        float speed = 0.35 + aSeed * 1.5;
        p.y = mod(p.y + uTime * speed * uRise, uHeight);
        p.x += sin(uTime * (0.3 + aSeed) + aSeed * 6.2831) * (0.7 + aSeed * 2.4);
        p.z += cos(uTime * (0.24 + aSeed) + aSeed * 4.1) * (0.6 + aSeed * 2.0);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float dist = -mv.z;
        gl_Position = projectionMatrix * mv;
        gl_PointSize = clamp(uSize * aScale * uPixelRatio * (420.0 / max(dist, 5.0)), 0.6, 30.0);
        vFade = smoothstep(1.0, 9.0, dist) * (1.0 - smoothstep(uHeight * 3.0, uHeight * 6.5, dist));
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      varying float vFade;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float alpha = smoothstep(0.5, 0.04, d);
        if (alpha * vFade < 0.004) discard;
        gl_FragColor = vec4(uColor * (0.65 + alpha * 0.9), alpha * vFade * 0.85);
      }
    `,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  const update = (time) => {
    uniforms.uTime.value = time;
  };
  return { points, update };
}

/* ── still water / glass sea ──────────────────────────────────── */

export function createGlassSea({ size = 2600, color = 0x0c2730, glitter = 0xbfe9ff } = {}) {
  // A stopped sea, shaded rather than displaced on the CPU: rolling swell in
  // the vertex shader, ripple normals and a fresnel sheen with sun glints in
  // the fragment shader — glass instead of a dark grey sheet.
  const geometry = new THREE.PlaneGeometry(size, size, 200, 200);
  geometry.rotateX(-Math.PI / 2);

  const uniforms = {
    uTime: { value: 0 },
    uDeep: { value: new THREE.Color(color) },
    uSky: { value: new THREE.Color(glitter) },
    uSun: { value: new THREE.Vector3(0.18, 0.4, -0.9).normalize() },
  };

  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `
      uniform float uTime;
      varying vec3 vWorld;
      float wave(vec2 p, float t) {
        return sin(p.x * 0.028 + t * 0.3) * 1.1
             + sin(p.y * 0.022 - t * 0.24) * 0.9
             + sin((p.x + p.y) * 0.055 + t * 0.5) * 0.32;
      }
      void main() {
        vec4 world = modelMatrix * vec4(position, 1.0);
        world.y += wave(world.xz, uTime);
        vWorld = world.xyz;
        gl_Position = projectionMatrix * viewMatrix * world;
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uDeep;
      uniform vec3 uSky;
      uniform vec3 uSun;
      varying vec3 vWorld;
      void main() {
        vec2 ripple = vec2(
          sin(vWorld.x * 0.3 + uTime * 0.85) + sin(vWorld.z * 0.19 - uTime * 0.65),
          cos(vWorld.z * 0.28 + uTime * 0.75) + cos(vWorld.x * 0.17 + uTime * 0.55)
        ) * 0.055;
        vec3 normal = normalize(vec3(ripple.x, 1.0, ripple.y));
        vec3 viewDir = normalize(cameraPosition - vWorld);
        float fres = pow(1.0 - clamp(dot(normal, viewDir), 0.0, 1.0), 2.4);
        vec3 halfV = normalize(uSun + viewDir);
        float spec = pow(max(dot(normal, halfV), 0.0), 200.0) * 2.6;
        float sparkle = pow(max(dot(normal, halfV), 0.0), 34.0)
                      * (0.35 + 0.35 * sin(uTime * 1.7 + vWorld.x * 0.35 + vWorld.z * 0.2));
        vec3 col = mix(uDeep * 0.85, uSky * 0.8, fres * 0.85);
        col += uSky * (spec + sparkle);
        float fade = 1.0 - smoothstep(${(size * 0.1).toFixed(1)}, ${(size * 0.46).toFixed(1)}, length(vWorld.xz));
        col = mix(uSky * 0.3 + uDeep * 0.45, col, clamp(fade, 0.0, 1.0));
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });

  const mesh = new THREE.Mesh(geometry, material);
  const update = (time) => {
    uniforms.uTime.value = time;
  };
  return { mesh, update };
}

/* ── a city that never changes ────────────────────────────────── */

export function createStoneCity({
  rows = 4,
  perRow = 8,
  spacing = 36,
  color = 0x3c312a,
  rgb = "255,150,70",
  height = 46,
  startZ = -46,
} = {}) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({ color, roughness: 0.86, metalness: 0.26 });
  const seamMaterial = new THREE.MeshBasicMaterial({
    color: new THREE.Color(`rgb(${rgb})`).multiplyScalar(1.7),
    transparent: true,
    opacity: 0.8,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const windows = [];

  for (let r = 0; r < rows; r++) {
    for (let i = 0; i < perRow; i++) {
      const w = rand(9, 17);
      const hh = rand(height * 0.34, height);
      const depth = rand(9, 15);
      const tower = new THREE.Mesh(new THREE.BoxGeometry(w, hh, depth), material);
      const x = (i - (perRow - 1) / 2) * spacing + rand(-3.5, 3.5);
      const z = startZ - r * spacing * 0.92;
      tower.position.set(x, hh / 2, z);
      tower.rotation.y = rand(-0.12, 0.12);
      group.add(tower);

      /* a stepped roof and lit seams: a box with a cap on it reads as a
         building at silhouette, which is all the camera ever sees of a city */
      const cap = new THREE.Mesh(
        new THREE.CylinderGeometry(w * 0.12, w * 0.46, hh * 0.14, 4),
        material,
      );
      cap.position.set(x, hh + hh * 0.05, z);
      cap.rotation.y = tower.rotation.y + Math.PI / 4;
      group.add(cap);

      const seams = 1 + Math.floor(Math.random() * 3);
      for (let s = 0; s < seams; s++) {
        const seamHeight = rand(hh * 0.22, hh * 0.66);
        const seam = new THREE.Mesh(new THREE.PlaneGeometry(rand(0.5, 1.1), seamHeight), seamMaterial);
        seam.position.set(
          x + rand(-w * 0.34, w * 0.34),
          rand(seamHeight * 0.6, hh * 0.82),
          z + depth / 2 + 0.08,
        );
        group.add(seam);
      }

      if (Math.random() < 0.55) {
        const win = glowSprite(rgb, 64, 0.8);
        win.position.set(x + rand(-w * 0.3, w * 0.3), rand(hh * 0.3, hh * 0.9), z + 5.5);
        win.scale.setScalar(rand(3, 5.5));
        group.add(win);
        windows.push({ sprite: win, phase: rand(0, TAU) });
      }
    }
  }

  const update = (time) => {
    for (let i = 0; i < windows.length; i++) {
      const w = windows[i];
      w.sprite.material.opacity = 0.5 + Math.sin(time * 2.1 + w.phase) * 0.28;
    }
  };
  return { group, update };
}

/* ── floating archive tablets ─────────────────────────────────── */

export function createTabletField({ count = 26, radius = 58, height = 26, color = 0x9fb6cc } = {}) {
  const group = new THREE.Group();
  const material = new THREE.MeshStandardMaterial({
    color,
    roughness: 0.4,
    metalness: 0.5,
    emissive: 0x123044,
    emissiveIntensity: 0.9,
  });
  const tablets = [];
  for (let i = 0; i < count; i++) {
    const tablet = new THREE.Mesh(
      new THREE.BoxGeometry(rand(2, 5), rand(3, 8), 0.4),
      material,
    );
    const a = rand(0, TAU);
    const rad = rand(radius * 0.22, radius);
    tablet.position.set(Math.cos(a) * rad, rand(4, height), Math.sin(a) * rad);
    tablet.rotation.set(rand(-0.18, 0.18), rand(0, TAU), rand(-0.2, 0.2));
    group.add(tablet);
    tablets.push({ mesh: tablet, phase: rand(0, TAU), baseY: tablet.position.y });
  }
  const update = (time) => {
    for (let i = 0; i < tablets.length; i++) {
      const t = tablets[i];
      t.mesh.position.y = t.baseY + Math.sin(time * 0.45 + t.phase) * 1.7;
      t.mesh.rotation.y += 0.0016;
    }
  };
  return { group, update };
}

/* ── a seal, cut into the ground ──────────────────────────────── */

export function createSealRune({ radius = 26, color = 0x8fe6ff, opacity = 0.55, y = 0.2 } = {}) {
  const mesh = createRuneCircle({ radius, color, opacity, y, rings: 2, glyphs: 44 });
  const update = (time) => {
    mesh.material.opacity = opacity * (0.6 + Math.sin(time * 1.15) * 0.35);
    mesh.rotation.z = time * 0.055;
  };
  return { mesh, update };
}

/* ── people held in a single instant ──────────────────────────── */

export function createFrozenCrowd({ count = 20, radius = 44, material, seed = 0 } = {}) {
  const group = new THREE.Group();
  const mat = material || new THREE.MeshStandardMaterial({ color: 0x8a8378, roughness: 0.95, metalness: 0.05 });
  for (let i = 0; i < count; i++) {
    const figure = createHoodedFigure({ height: rand(3.4, 4.6), material: mat, seed: seed + i * 1.7 });
    const a = rand(0, TAU);
    const rad = rand(radius * 0.35, radius);
    figure.position.set(Math.cos(a) * rad, 0, Math.sin(a) * rad);
    figure.rotation.y = rand(0, TAU);
    group.add(figure);
  }
  return { group };
}

/** A scatter of broken monoliths to break up flat ground. */
export function createRuinField({ count = 16, radius = 120, material, seed = 3 } = {}) {
  const group = new THREE.Group();
  const mat = material || new THREE.MeshStandardMaterial({ color: 0x5a544b, roughness: 0.94 });
  for (let i = 0; i < count; i++) {
    const rock = createRock({ radius: rand(2.4, 7), detail: 2, material: mat, seed: seed + i * 2.3 });
    const a = rand(0, TAU);
    const rad = rand(radius * 0.25, radius);
    rock.position.set(Math.cos(a) * rad, rand(-1.2, 0.6), Math.sin(a) * rad);
    group.add(rock);
  }
  return { group };
}

/** Environment reflection built from a three-colour gradient. */
export function sentinelEnvironment(renderer, top, horizon, ground) {
  return createEnvMap(renderer, { top, horizon, ground });
}

/* Light shafts and sculpted ground live in their own module; re-exported so
   every realm keeps importing its whole toolkit from one place. */
export { createGodShafts, createSentinelGround } from "./SentinelScenery";