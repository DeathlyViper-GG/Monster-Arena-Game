import * as THREE from "three";
import {
  TAU,
  rand,
  glowTexture,
  createEnvMap,
  createMaterialLibrary,
  createRock,
  createHoodedFigure,
} from "@/components/glacialArchive/Cutscene";

/* ═════════════════════════════════════════════════════════════════
   THE NEON VOID — a fracture where every memory overlaps.
   Shattered fragments of the other realms drift in a magenta-cyan
   void, lit by a rift in the sky and the last soul-shard.
   ═════════════════════════════════════════════════════════════════ */

export function createVoidEnvMap(renderer) {
  return createEnvMap(renderer, { top: 0x0a0420, horizon: 0x3d1160, ground: 0x05020d });
}

export function createVoidMaterials() {
  const lib = createMaterialLibrary();
  return {
    stone: (opts = {}) => lib.stone({ color: 0x241f3a, roughness: 0.8, metalness: 0.15, ...opts }),
    cloth: (opts = {}) => lib.cloth({ color: 0x140a26, sheenColor: new THREE.Color(0xb07cff), ...opts }),
    ice: (opts = {}) => lib.ice({ color: 0x9ad7f0, ...opts }),
    glow: (color = 0xd066ff, intensity = 2.2) => {
      const material = new THREE.MeshBasicMaterial({ color: new THREE.Color(color) });
      material.color.multiplyScalar(intensity);
      return material;
    },
  };
}

/* ── starfield scattered through the void ────────────────── */

export function createStarfield({ count = 4200, radius = 1400 } = {}) {
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const theta = rand(0, TAU);
    const phi = Math.acos(rand(-1, 1));
    const r = rand(radius * 0.55, radius);
    positions[i * 3] = Math.sin(phi) * Math.cos(theta) * r;
    positions[i * 3 + 1] = Math.cos(phi) * r * 0.7;
    positions[i * 3 + 2] = Math.sin(phi) * Math.sin(theta) * r;
    seeds[i] = Math.random();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: { uTime: { value: 0 } },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      uniform float uTime;
      attribute float aSeed;
      varying float vTwinkle;
      void main() {
        vec4 mv = modelViewMatrix * vec4(position, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (1.2 + aSeed * 3.4) * (320.0 / max(1.0, -mv.z));
        vTwinkle = 0.45 + 0.55 * sin(uTime * (0.8 + aSeed * 2.4) + aSeed * 42.0);
      }
    `,
    fragmentShader: `
      varying float vTwinkle;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float alpha = smoothstep(0.5, 0.05, d);
        if (alpha < 0.01) discard;
        gl_FragColor = vec4(vec3(0.82, 0.86, 1.0), alpha * vTwinkle * 0.85);
      }
    `,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return { mesh: points, update: (time) => { material.uniforms.uTime.value = time; } };
}

/* ── drifting fragments of the realms below ──────────────── */

const FRAGMENT_TINTS = [0x2e4a3a, 0x5a4326, 0x2f4a63, 0x5c2418, 0x3d2458];

export function createFloatingFragments({ count = 40, radius = 320, materials }) {
  const group = new THREE.Group();
  const entries = [];
  for (let i = 0; i < count; i++) {
    const tint = FRAGMENT_TINTS[i % FRAGMENT_TINTS.length];
    const chunk = createRock({
      radius: rand(3, 14),
      detail: 1,
      material: materials.stone({ color: tint }),
      seed: i * 2.7,
    });
    const angle = rand(0, TAU);
    const distance = rand(radius * 0.28, radius);
    chunk.position.set(Math.cos(angle) * distance, rand(-90, 110), Math.sin(angle) * distance - 60);
    chunk.scale.y = rand(0.5, 1.5);
    group.add(chunk);
    entries.push({ chunk, spin: rand(-0.14, 0.14), phase: rand(0, TAU), rise: rand(0.3, 1.1) });
  }
  group.userData.update = (time) => {
    for (const entry of entries) {
      entry.chunk.rotation.y += entry.spin * 0.016;
      entry.chunk.rotation.x += entry.spin * 0.008;
      entry.chunk.position.y += Math.sin(time * 0.35 + entry.phase) * entry.rise * 0.016;
    }
  };
  return group;
}

/* ── overlapping memory washes, one per realm ────────────── */

const MEMORY_COLORS = [
  { color: 0x7dffa3, rgb: "125,255,163" },
  { color: 0xffd166, rgb: "255,209,102" },
  { color: 0x9fe3ff, rgb: "159,227,255" },
  { color: 0xff7a3a, rgb: "255,122,58" },
  { color: 0xd066ff, rgb: "208,102,255" },
];

export function createMemoryVeils({ count = 9, radius = 220 } = {}) {
  const group = new THREE.Group();
  const entries = [];
  for (let i = 0; i < count; i++) {
    const memory = MEMORY_COLORS[i % MEMORY_COLORS.length];
    const veil = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture(128, memory.rgb),
        color: memory.color,
        transparent: true,
        opacity: 0.16,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    const angle = rand(0, TAU);
    const distance = rand(radius * 0.35, radius);
    veil.position.set(Math.cos(angle) * distance, rand(-40, 70), Math.sin(angle) * distance - 120);
    veil.scale.setScalar(rand(120, 300));
    group.add(veil);
    entries.push({ veil, phase: rand(0, TAU), speed: rand(0.12, 0.3) });
  }
  group.userData.update = (time) => {
    for (const entry of entries) {
      entry.veil.material.opacity = 0.09 + 0.09 * (0.5 + 0.5 * Math.sin(time * entry.speed + entry.phase));
      entry.veil.position.y += Math.sin(time * 0.22 + entry.phase) * 0.03;
    }
  };
  return group;
}

/* ── the rift: a tear of light in the void ───────────────── */

export function createRift({ width = 120, height = 420, color = 0xd066ff, opacity = 0.9 } = {}) {
  const geometry = new THREE.PlaneGeometry(width, height, 1, 1);
  const uniforms = {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(color) },
    uOpacity: { value: opacity },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    side: THREE.DoubleSide,
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform float uTime; uniform vec3 uColor; uniform float uOpacity;
      varying vec2 vUv;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      void main() {
        float d = abs(vUv.x - 0.5) * 2.0;
        float body = pow(max(0.0, 1.0 - d), 2.6);
        float shimmer = 0.55 + 0.45 * noise(vec2(vUv.y * 26.0 - uTime * 2.2, uTime * 0.7));
        float vertical = smoothstep(0.0, 0.22, vUv.y) * (1.0 - smoothstep(0.72, 1.0, vUv.y));
        float core = pow(max(0.0, 1.0 - d * 3.4), 1.6);
        vec3 col = uColor * (0.6 + 1.7 * core);
        gl_FragColor = vec4(col, body * shimmer * vertical * uOpacity);
      }
    `,
  });
  const mesh = new THREE.Mesh(geometry, material);
  return { mesh, update: (time) => { uniforms.uTime.value = time; } };
}

/* ── souls streaming toward a point ──────────────────────── */

export function createSoulStream({ count = 1500, radius = 70, height = 90, color = 0xc9a4ff } = {}) {
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = rand(-radius, radius);
    positions[i * 3 + 1] = rand(-height / 2, height / 2);
    positions[i * 3 + 2] = rand(-radius, radius);
    seeds[i] = Math.random();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uColor: { value: new THREE.Color(color) },
      uRadius: { value: radius },
      uHeight: { value: height },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      uniform float uTime; uniform float uRadius; uniform float uHeight;
      attribute float aSeed;
      varying float vFade;
      void main() {
        vec3 p = position;
        float life = fract(uTime * (0.05 + aSeed * 0.08) + aSeed);
        float tighten = 1.0 - life;
        float angle = aSeed * 6.2831 + uTime * (0.4 + aSeed * 0.7);
        float r = (0.25 + tighten * 0.75) * length(p.xz);
        p.x = cos(angle) * r;
        p.z = sin(angle) * r;
        p.y = mix(p.y, sin(life * 3.14159) * uHeight * 0.12, 0.5) + (0.5 - life) * 12.0;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        gl_PointSize = (1.6 + aSeed * 3.6) * (300.0 / max(1.0, -mv.z));
        vFade = smoothstep(0.0, 0.25, life) * (1.0 - smoothstep(0.6, 1.0, life));
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      varying float vFade;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float alpha = smoothstep(0.5, 0.04, d);
        if (alpha * vFade < 0.004) discard;
        gl_FragColor = vec4(uColor, alpha * vFade * 0.7);
      }
    `,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return { mesh: points, update: (time) => { material.uniforms.uTime.value = time; } };
}

/* ── the Hollow's Echo: a warden wearing the Scribe's face ─ */

export function createEcho({ materials, height = 16 } = {}) {
  const group = new THREE.Group();

  const figure = createHoodedFigure({
    height,
    material: materials.cloth({ color: 0x150a24, roughness: 0.9 }),
    voidMaterial: materials.cloth({ color: 0x2a0f44, emissive: new THREE.Color(0x7a32c8), emissiveIntensity: 0.6 }),
  });
  group.add(figure);

  // the face: a pale mask of light inside the hood
  const face = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture(128, "240,235,255"),
      color: 0xe8dcff,
      transparent: true,
      opacity: 0.9,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  face.scale.setScalar(height * 0.42);
  face.position.set(0, height * 0.88, height * 0.1);
  group.add(face);

  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture(128, "190,120,255"),
      color: 0xb06cff,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  halo.scale.setScalar(height * 2.6);
  halo.position.y = height * 0.72;
  group.add(halo);

  const light = new THREE.PointLight(0xb06cff, 70, height * 12, 2);
  light.position.set(0, height * 0.8, 1.5);
  group.add(light);

  // the shards of every recovered realm orbiting the Echo
  const orbiters = [];
  for (let i = 0; i < 5; i++) {
    const orb = new THREE.Mesh(
      new THREE.OctahedronGeometry(height * 0.09, 0),
      materials.glow(MEMORY_COLORS[i].color, 2.4),
    );
    group.add(orb);
    orbiters.push({ orb, phase: (i / 5) * TAU, tilt: rand(-0.4, 0.4) });
  }

  group.userData.update = (time) => {
    face.material.opacity = 0.72 + 0.2 * Math.sin(time * 1.6);
    halo.material.opacity = 0.42 + 0.14 * Math.sin(time * 1.1);
    light.intensity = 60 + 18 * Math.sin(time * 1.9);
    for (const entry of orbiters) {
      const angle = time * 0.55 + entry.phase;
      entry.orb.position.set(
        Math.cos(angle) * height * 0.72,
        height * (0.5 + Math.sin(angle * 0.7 + entry.tilt) * 0.22),
        Math.sin(angle) * height * 0.72,
      );
      entry.orb.rotation.y = time * 1.2 + entry.phase;
      entry.orb.rotation.x = time * 0.8;
    }
  };

  return group;
}

/* ── a shattered platform of memory-stone ────────────────── */

export function createShatteredPlatform({ materials, radius = 34 } = {}) {
  const group = new THREE.Group();
  const stone = materials.stone({ color: 0x2a2440, roughness: 0.72, metalness: 0.22 });

  const core = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 0.82, 3.2, 9), stone);
  core.position.y = -1.6;
  group.add(core);

  for (let i = 0; i < 22; i++) {
    const angle = (i / 22) * TAU;
    const slab = new THREE.Mesh(new THREE.BoxGeometry(rand(3, 8), rand(0.6, 1.6), rand(4, 11)), stone);
    const distance = radius * rand(0.7, 1.35);
    slab.position.set(Math.cos(angle) * distance, rand(-8, 3), Math.sin(angle) * distance);
    slab.rotation.set(rand(-0.5, 0.5), angle, rand(-0.5, 0.5));
    group.add(slab);
  }
  return group;
}

/* ── vertical rune rings floating in the void ────────────── */

export function createRuneRing({ radius = 18, color = 0xb06cff, opacity = 0.5, rings = 2, glyphs = 40 } = {}) {
  const canvas = document.createElement("canvas");
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext("2d");
  const c = 256;

  for (let r = 0; r < rings; r++) {
    const rad = c * (0.42 + r * 0.2);
    ctx.strokeStyle = "rgba(255,255,255,0.85)";
    ctx.lineWidth = r === 0 ? 3 : 1.6;
    ctx.beginPath();
    ctx.arc(c, c, rad, 0, TAU);
    ctx.stroke();

    const count = glyphs + r * 8;
    for (let i = 0; i < count; i++) {
      const a = (i / count) * TAU;
      const x = c + Math.cos(a) * rad;
      const y = c + Math.sin(a) * rad;
      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(a + Math.PI / 2);
      ctx.strokeStyle = "rgba(255,255,255,0.7)";
      ctx.lineWidth = 1.6;
      ctx.beginPath();
      const h = 4 + Math.random() * 8;
      ctx.moveTo(-2, -h);
      ctx.lineTo(2, -h * 0.3);
      ctx.lineTo(-2, h * 0.4);
      ctx.lineTo(2, h);
      ctx.stroke();
      ctx.restore();
    }
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;

  const material = new THREE.MeshBasicMaterial({
    map: texture,
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(radius * 2, radius * 2), material);
  return mesh;
}

export { TAU, rand, glowTexture };