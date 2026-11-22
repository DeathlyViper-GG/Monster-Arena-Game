import * as THREE from "three";
import {
  TAU,
  rand,
  clamp01,
  glowTexture,
  createEnvMap,
  createMaterialLibrary,
} from "@/components/glacialArchive/Cutscene";

/* ═════════════════════════════════════════════════════════════════
   THE CINDER BELOW — forge-cathedral toolkit.
   Obsidian masonry, molten seams, lava fields, ember drifts, hanging
   chains and the chained Magma Titan.
   ═════════════════════════════════════════════════════════════════ */

export function createForgeEnvMap(renderer) {
  return createEnvMap(renderer, { top: 0x1c0703, horizon: 0x5e2008, ground: 0x0b0302 });
}

export function createForgeMaterials() {
  const lib = createMaterialLibrary();
  const EMBER = new THREE.Color(0x5a2c1a);
  // Callers all pass very dark stone colours. Lifting them half-way to a warm
  // ember tone keeps every surface lit by the forge light instead of collapsing
  // into a flat black mass against the glowing sky.
  const warm = (color) => new THREE.Color(color ?? 0x1b100e).lerp(EMBER, 0.5);
  return {
    // A faint ember glow lives inside every stone so a silhouette never
    // collapses into a flat black mass against the forge light.
    basalt: (opts = {}) =>
      lib.stone({
        roughness: 0.94,
        metalness: 0.08,
        emissive: 0x33120a,
        emissiveIntensity: 1.0,
        ...opts,
        color: warm(opts.color),
      }),
    obsidian: (opts = {}) =>
      new THREE.MeshPhysicalMaterial({
        roughness: 0.18,
        metalness: 0.55,
        clearcoat: 0.8,
        clearcoatRoughness: 0.2,
        envMapIntensity: 1.6,
        emissive: 0x33120a,
        emissiveIntensity: 0.9,
        ...opts,
        color: warm(opts.color ?? 0x0d0809),
      }),
    iron: (opts = {}) =>
      new THREE.MeshStandardMaterial({
        color: 0x2a1a13,
        roughness: 0.42,
        metalness: 0.95,
        emissive: 0x1a0805,
        emissiveIntensity: 0.7,
        ...opts,
      }),
    molten: (color = 0xff6a1e, intensity = 2.4) => {
      const material = new THREE.MeshBasicMaterial({ color: new THREE.Color(color) });
      material.color.multiplyScalar(intensity);
      return material;
    },
    stone: (opts = {}) => lib.stone(opts),
    cloth: (opts = {}) => lib.cloth(opts),
  };
}

/* ── molten ground: flowing lava veins across cooled basalt ── */

const LAVA_CHUNK = `
  float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
  float noise(vec2 p) {
    vec2 i = floor(p); vec2 f = fract(p);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
               mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
  }
  float fbm(vec2 p) {
    float v = 0.0; float a = 0.5;
    for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
    return v;
  }
`;

export function createLavaGround({ size = 2400, hot = 0xff6a1e, deep = 0x180909, scale = 2.2 } = {}) {
  const geometry = new THREE.PlaneGeometry(size, size, 1, 1);
  geometry.rotateX(-Math.PI / 2);
  const uniforms = {
    uTime: { value: 0 },
    uHot: { value: new THREE.Color(hot) },
    uDeep: { value: new THREE.Color(deep) },
    uScale: { value: scale },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform float uTime; uniform vec3 uHot; uniform vec3 uDeep; uniform float uScale;
      varying vec2 vUv;
      ${LAVA_CHUNK}
      void main() {
        vec2 p = (vUv - 0.5) * uScale * 8.0;
        float drift = fbm(p * 1.6 + vec2(uTime * 0.028, uTime * 0.06));
        float veins = fbm(p * 3.4 - vec2(uTime * 0.05, uTime * 0.018));
        float glow = smoothstep(0.34, 0.86, drift * 0.62 + veins * 0.62);
        float pulse = 0.82 + 0.18 * sin(uTime * 1.3 + drift * 6.2831);
        vec3 col = mix(uDeep, uHot * 1.5, glow * pulse);
        float distanceFade = smoothstep(0.0, 0.62, 1.0 - length(vUv - 0.5) * 1.6);
        // Far across the plain the cooled basalt must sink into a warm ember
        // haze, never into black: a dark far field reads as a flat black slab
        // with a hard horizon edge against the glowing sky.
        col = mix(col, uHot * 0.42 + uDeep * 0.5, (1.0 - distanceFade) * 0.92);
        col *= 0.62 + 0.38 * distanceFade;
        gl_FragColor = vec4(col, 1.0);
      }
    `,
  });
  const mesh = new THREE.Mesh(geometry, material);
  return { mesh, update: (time) => { uniforms.uTime.value = time; } };
}

/* ── a lava river: a narrow strip of fast-flowing melt ───── */

export function createLavaRiver({ length = 900, width = 26, hot = 0xff7a26, speed = 0.6, opacity = 0.95 } = {}) {
  const geometry = new THREE.PlaneGeometry(width, length, 1, 1);
  geometry.rotateX(-Math.PI / 2);
  const uniforms = {
    uTime: { value: 0 },
    uHot: { value: new THREE.Color(hot) },
    uSpeed: { value: speed },
    uOpacity: { value: opacity },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform float uTime; uniform vec3 uHot; uniform float uSpeed; uniform float uOpacity;
      varying vec2 vUv;
      ${LAVA_CHUNK}
      void main() {
        float flow = fbm(vec2(vUv.x * 7.0, vUv.y * 2.2 - uTime * uSpeed));
        float bands = 0.5 + 0.5 * sin(vUv.y * 42.0 - uTime * 3.4 + flow * 6.0);
        float core = smoothstep(0.0, 0.16, vUv.x) * smoothstep(0.0, 0.16, 1.0 - vUv.x);
        float hot = (0.45 + 0.55 * bands) * (0.55 + 0.65 * flow) * core;
        vec3 col = mix(uHot * 0.35, uHot * 2.0, hot);
        gl_FragColor = vec4(col, uOpacity * hot);
      }
    `,
  });
  const mesh = new THREE.Mesh(geometry, material);
  return { mesh, update: (time) => { uniforms.uTime.value = time; } };
}

/* ── drifting embers ──────────────────────────────────────── */

export function createEmbers({ count = 2600, area = 300, height = 110, size = 2.4, color = 0xffb066 } = {}) {
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    positions[i * 3] = rand(-area / 2, area / 2);
    positions[i * 3 + 1] = rand(0, height);
    positions[i * 3 + 2] = rand(-area / 2, area / 2);
    seeds[i] = Math.random();
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      uSize: { value: size },
      uHeight: { value: height },
      uColor: { value: new THREE.Color(color) },
    },
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `
      uniform float uTime; uniform float uSize; uniform float uHeight;
      attribute float aSeed;
      varying float vFade;
      void main() {
        vec3 p = position;
        float speed = 3.0 + aSeed * 7.0;
        p.y = mod(p.y + uTime * speed, uHeight);
        p.x += sin(uTime * (0.4 + aSeed) + aSeed * 31.0) * (1.6 + aSeed * 3.0);
        p.z += cos(uTime * (0.32 + aSeed) + aSeed * 17.0) * (1.4 + aSeed * 2.4);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        float dist = -mv.z;
        gl_Position = projectionMatrix * mv;
        // Unclamped, this blows up as an ember passes the lens: a single point
        // 1 unit away became a screen-filling square that strobed as the camera
        // flew through the ember field (Forge Gate).
        float pointSize = uSize * (0.6 + aSeed * 1.9) * (320.0 / max(1.0, dist));
        gl_PointSize = min(pointSize, 26.0);
        float h = p.y / uHeight;
        vFade = smoothstep(0.0, 0.12, h) * (1.0 - smoothstep(0.7, 1.0, h));
        vFade *= smoothstep(2.5, 16.0, dist);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor; uniform float uTime;
      varying float vFade;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float alpha = smoothstep(0.5, 0.04, d);
        if (alpha * vFade < 0.004) discard;
        float flicker = 0.72 + 0.28 * sin(uTime * 5.0 + gl_PointCoord.y * 24.0);
        gl_FragColor = vec4(uColor, alpha * vFade * flicker);
      }
    `,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return { mesh: points, update: (time) => { material.uniforms.uTime.value = time; } };
}

/* ── volumetric god-rays through forge smoke ─────────────── */

export function createGodRay({
  height = 80,
  radiusTop = 1.6,
  radiusBottom = 12,
  color = 0xffa15c,
  opacity = 0.16,
} = {}) {
  const geometry = new THREE.CylinderGeometry(radiusTop, radiusBottom, height, 22, 1, true);
  const uniforms = {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(color) },
    uOpacity: { value: opacity },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform vec3 uColor; uniform float uOpacity; uniform float uTime;
      varying vec2 vUv;
      void main() {
        // Clamp the base: at the cylinder's own edge vUv.y can tip a hair past
        // 1.0, and pow() of a negative base returns NaN. A NaN survives into the
        // half-float buffer, the bloom blur smears it, and it surfaces as a
        // rectangular black block flickering over the frame.
        float a = pow(max(0.0, 1.0 - vUv.y), 1.7);
        float flicker = 0.82 + 0.18 * sin(uTime * 0.8 + vUv.x * 6.0);
        gl_FragColor = vec4(uColor, a * uOpacity * flicker);
      }
    `,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = height / 2;
  return { mesh, update: (time) => { uniforms.uTime.value = time; } };
}

/* ── a hanging chain of interlocking iron links ──────────── */

export function createChain({ from, to, radius = 0.55, material }) {
  const group = new THREE.Group();
  const direction = new THREE.Vector3().subVectors(to, from);
  const length = direction.length();
  if (length < 0.001) return group;

  group.position.copy(from);
  group.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.clone().normalize());

  const linkLength = radius * 2.15;
  const count = Math.max(2, Math.floor(length / linkLength));
  const geometry = new THREE.TorusGeometry(radius, radius * 0.3, 8, 18);

  for (let i = 0; i < count; i++) {
    const link = new THREE.Mesh(geometry, material);
    link.position.y = (i + 0.5) * (length / count);
    link.rotation.y = i % 2 ? Math.PI / 2 : 0;
    link.rotation.z = Math.PI / 2;
    group.add(link);
  }
  return group;
}

/* ── a basalt column with a molten seam and a hot capital ── */

export function createBasaltPillar({ height = 34, radius = 2.8, materials, seed = 0 }) {
  const group = new THREE.Group();

  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.84, radius, height, 6, 1),
    materials.basalt({ color: 0x1a100d + (seed % 3) * 0x020101 }),
  );
  shaft.position.y = height / 2;
  shaft.rotation.y = (seed % 6) * 0.3;
  group.add(shaft);

  const base = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.24, radius * 1.4, 2.4, 6), materials.basalt({ color: 0x120a08 }));
  base.position.y = 1.2;
  group.add(base);

  const capital = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.34, radius * 0.94, 2.2, 6), materials.basalt({ color: 0x1d1210 }));
  capital.position.y = height - 1.1;
  group.add(capital);

  // molten seam running up the face
  const seam = new THREE.Mesh(new THREE.PlaneGeometry(radius * 0.16, height * 0.92), materials.molten(0xff5f18, 1.9));
  seam.position.set(0, height / 2, radius * 0.93);
  seam.renderOrder = 2;
  group.add(seam);

  const glow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture(128, "255,150,70"),
      color: 0xff7a2a,
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  glow.scale.setScalar(radius * 5);
  glow.position.y = height - 0.5;
  group.add(glow);

  return group;
}

/* ── the forge temple: gate towers, arch and a burning door ─ */

export function createForgeTemple({ materials }) {
  const group = new THREE.Group();
  const stone = materials.basalt({ color: 0x160d0b });
  const trim = materials.obsidian();

  const plinth = new THREE.Mesh(new THREE.BoxGeometry(196, 12, 150), stone);
  plinth.position.set(0, 6, 0);
  group.add(plinth);

  for (const side of [-1, 1]) {
    const tower = new THREE.Mesh(new THREE.BoxGeometry(46, 118, 46), stone);
    tower.position.set(side * 62, 59, 0);
    tower.rotation.y = side * 0.06;
    group.add(tower);

    const crown = new THREE.Mesh(new THREE.ConeGeometry(34, 40, 4), trim);
    crown.position.set(side * 62, 138, 0);
    crown.rotation.y = Math.PI / 4;
    group.add(crown);

    // ribbed buttresses down the face of each tower
    for (let i = 0; i < 4; i++) {
      const rib = new THREE.Mesh(new THREE.BoxGeometry(3.2, 96, 3.2), trim);
      rib.position.set(side * 62 + (i - 1.5) * 10, 58, 23);
      group.add(rib);
    }

    const braziers = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: glowTexture(128, "255,150,70"),
        color: 0xff8a3a,
        transparent: true,
        opacity: 0.72,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    braziers.scale.setScalar(48);
    braziers.position.set(side * 62, 104, 25);
    group.add(braziers);
  }

  const lintel = new THREE.Mesh(new THREE.BoxGeometry(124, 26, 34), stone);
  lintel.position.set(0, 96, 0);
  group.add(lintel);

  const arch = new THREE.Mesh(new THREE.TorusGeometry(40, 6, 10, 28, Math.PI), trim);
  arch.position.set(0, 78, 18);
  arch.rotation.z = Math.PI;
  group.add(arch);

  // the doorway: a wall of living fire
  const door = new THREE.Mesh(new THREE.PlaneGeometry(70, 84, 1, 1), materials.molten(0xff7a26, 2.6));
  door.position.set(0, 54, 16);
  group.add(door);

  const doorHalo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture(128, "255,170,90"),
      color: 0xff9a4a,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    }),
  );
  doorHalo.scale.setScalar(240);
  doorHalo.position.set(0, 54, 30);
  group.add(doorHalo);

  const doorLight = new THREE.PointLight(0xff7a2a, 60, 320, 2);
  doorLight.position.set(0, 46, 40);
  group.add(doorLight);

  // steps climbing to the gate
  for (let i = 0; i < 7; i++) {
    const step = new THREE.Mesh(new THREE.BoxGeometry(120 - i * 4, 2.4, 12), stone);
    step.position.set(0, 1.2 + i * 2.2, 78 - i * 9);
    group.add(step);
  }

  const rays = [];
  for (let i = 0; i < 5; i++) {
    const ray = createGodRay({
      height: 150,
      radiusTop: 2,
      radiusBottom: 16,
      color: 0xffb070,
      opacity: 0.12,
    });
    ray.mesh.position.set((i - 2) * 16, 75, 34);
    ray.mesh.rotation.z = (i - 2) * 0.05;
    group.add(ray.mesh);
    rays.push(ray);
  }

  group.userData.rays = rays;
  return group;
}

/* ── molten cracks crawling over a body ──────────────────── */

export function createMoltenCracks({ count = 22, radius = 2.0, height = 5.0, y = 3.0, color = 0xff5a14 }) {
  const group = new THREE.Group();
  const material = new THREE.MeshBasicMaterial({
    color: new THREE.Color(color).multiplyScalar(2.2),
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  for (let i = 0; i < count; i++) {
    const angle = (i / count) * TAU + rand(-0.12, 0.12);
    const h = rand(height * 0.16, height * 0.8);
    const quad = new THREE.Mesh(new THREE.PlaneGeometry(rand(0.12, 0.3), h), material);
    quad.position.set(Math.cos(angle) * radius, y + rand(-0.5, 0.6), Math.sin(angle) * radius);
    quad.lookAt(0, quad.position.y, 0);
    quad.rotateZ(rand(-0.5, 0.5));
    quad.renderOrder = 3;
    group.add(quad);
  }
  return group;
}

/* ── THE MAGMA TITAN — a chained colossus with a blazing core ── */

export function createMagmaTitan({ materials, scale = 1 } = {}) {
  const group = new THREE.Group();
  const rock = materials.basalt({ color: 0x1a0d09, roughness: 0.88 });
  const limb = materials.basalt({ color: 0x150a07, roughness: 0.9 });

  // torso: broad shoulders tapering to a narrow waist
  const profile = [
    [0.0, 0.0], [2.1, 0.08], [1.9, 0.7], [1.5, 1.6], [1.62, 2.9],
    [1.95, 3.9], [1.62, 4.9], [1.15, 5.7], [0.72, 6.2], [0.0, 6.35],
  ];
  const torso = new THREE.Mesh(
    new THREE.LatheGeometry(profile.map(([r, y]) => new THREE.Vector2(r, y)), 44),
    rock,
  );
  torso.position.y = 3.2;
  group.add(torso);

  // shoulders
  for (const side of [-1, 1]) {
    const shoulder = new THREE.Mesh(new THREE.IcosahedronGeometry(1.5, 3), rock);
    shoulder.position.set(side * 1.85, 9.0, 0);
    shoulder.scale.set(1.1, 0.9, 1.0);
    group.add(shoulder);

    // arms: upper arm, forearm, fist
    const upper = new THREE.Mesh(new THREE.CylinderGeometry(0.72, 0.5, 3.4, 14), limb);
    upper.position.set(side * 2.35, 7.2, 0.15);
    upper.rotation.z = side * 0.24;
    group.add(upper);

    const fore = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.66, 3.2, 14), limb);
    fore.position.set(side * 2.8, 4.2, 0.4);
    fore.rotation.z = side * 0.1;
    group.add(fore);

    const fist = new THREE.Mesh(new THREE.IcosahedronGeometry(0.95, 2), limb);
    fist.position.set(side * 2.9, 2.5, 0.5);
    group.add(fist);

    // legs
    const thigh = new THREE.Mesh(new THREE.CylinderGeometry(1.05, 0.8, 3.4, 14), limb);
    thigh.position.set(side * 0.98, 1.9, 0);
    group.add(thigh);

    const shin = new THREE.Mesh(new THREE.CylinderGeometry(0.8, 1.15, 2.4, 14), limb);
    shin.position.set(side * 1.1, -0.9, 0.2);
    group.add(shin);
  }

  // head with a crown of horns and burning eyes
  const head = new THREE.Mesh(new THREE.IcosahedronGeometry(0.92, 3), rock);
  head.position.y = 10.4;
  head.scale.set(1, 1.15, 0.94);
  group.add(head);

  for (let i = 0; i < 5; i++) {
    const angle = -0.5 + (i / 4) * 1.0;
    const horn = new THREE.Mesh(new THREE.ConeGeometry(0.2, rand(1.1, 1.9), 8), limb);
    horn.position.set(Math.sin(angle) * 0.72, 11.1 + Math.cos(angle) * 0.3, Math.cos(angle) * 0.35);
    horn.rotation.z = -angle * 0.8;
    horn.rotation.x = rand(-0.3, 0.1);
    group.add(horn);
  }

  const eyeMaterial = materials.molten(0xffb44a, 3.4);
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.16, 12, 10), eyeMaterial);
    eye.position.set(side * 0.34, 10.5, 0.78);
    group.add(eye);
  }

  // blazing core set into the chest
  const coreMaterial = materials.molten(0xff8c34, 3.2);
  const core = new THREE.Mesh(new THREE.SphereGeometry(0.9, 22, 18), coreMaterial);
  core.position.set(0, 7.4, 0.9);
  group.add(core);

  const coreHalo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture(128, "255,190,120"),
      color: 0xff9a44,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  coreHalo.scale.setScalar(15);
  coreHalo.position.copy(core.position);
  group.add(coreHalo);

  const coreLight = new THREE.PointLight(0xff8a34, 80, 90, 2);
  coreLight.position.copy(core.position);
  group.add(coreLight);

  // molten cracks over the chest and belly
  const cracksChest = createMoltenCracks({ count: 16, radius: 1.72, height: 4.4, y: 7.2 });
  const cracksBelly = createMoltenCracks({ count: 12, radius: 1.62, height: 3.2, y: 4.0 });
  group.add(cracksChest, cracksBelly);

  // the chains that bind it
  const chainMaterial = materials.iron({ color: 0x37231a, roughness: 0.5 });
  const chainPairs = [
    [new THREE.Vector3(-5.4, 12.2, 0.6), new THREE.Vector3(2.6, 6.4, 1.3)],
    [new THREE.Vector3(5.4, 12.2, 0.6), new THREE.Vector3(-2.6, 6.4, 1.3)],
    [new THREE.Vector3(-4.6, 8.4, -1.4), new THREE.Vector3(4.4, 7.6, 1.6)],
    [new THREE.Vector3(0, 13.4, -0.4), new THREE.Vector3(0, 9.2, 1.2)],
  ];
  for (const [from, to] of chainPairs) {
    group.add(createChain({ from, to, radius: 0.3, material: chainMaterial }));
  }

  group.scale.setScalar(scale);

  group.userData.coreMaterial = coreMaterial;
  group.userData.coreLight = coreLight;
  group.userData.coreHalo = coreHalo;
  return group;
}

/* ── hot ground haze ─────────────────────────────────────── */

export function createForgeHaze({ size = 900, color = 0xff8a44, density = 0.5, y = 6 } = {}) {
  const geometry = new THREE.PlaneGeometry(size, size, 1, 1);
  geometry.rotateX(-Math.PI / 2);
  const uniforms = {
    uTime: { value: 0 },
    uColor: { value: new THREE.Color(color) },
    uDensity: { value: density },
    uTiles: { value: 5 },
  };
  const material = new THREE.ShaderMaterial({
    uniforms,
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: `
      uniform float uTime; uniform vec3 uColor; uniform float uDensity; uniform float uTiles;
      varying vec2 vUv;
      ${LAVA_CHUNK}
      void main() {
        vec2 p = vUv * uTiles;
        float n = fbm(p * 2.2 + vec2(uTime * 0.03, uTime * 0.012));
        float drift = fbm(p * 1.1 - vec2(uTime * 0.018, 0.0));
        float a = smoothstep(0.28, 0.86, n * 0.7 + drift * 0.5) * uDensity;
        a *= smoothstep(0.0, 0.35, 0.5 - abs(vUv.x - 0.5)) * 0.6 + 0.4;
        gl_FragColor = vec4(uColor, a * 0.5);
      }
    `,
  });
  const mesh = new THREE.Mesh(geometry, material);
  mesh.position.y = y;
  return { mesh, update: (time) => { uniforms.uTime.value = time; } };
}

/* ── a burst of lava erupting from the floor ─────────────── */

export function createLavaGeyser({ height = 40, radius = 4 }) {
  const group = new THREE.Group();
  const column = new THREE.Mesh(
    new THREE.CylinderGeometry(radius * 0.35, radius, height, 16, 1, true),
    new THREE.MeshBasicMaterial({
      color: new THREE.Color(0xff7a26).multiplyScalar(1.8),
      transparent: true,
      opacity: 0.5,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  column.position.y = height / 2;
  group.add(column);

  const burst = createEmbers({ count: 700, area: radius * 3, height: height * 1.4, size: 2.6, color: 0xffc07a });
  burst.mesh.position.y = 0;
  group.add(burst.mesh);

  const light = new THREE.PointLight(0xff7a2a, 40, height * 2.4, 2);
  light.position.y = height * 0.3;
  group.add(light);

  group.userData.update = (time) => {
    burst.update(time);
    const pulse = 0.85 + 0.15 * Math.sin(time * 2.3);
    column.scale.set(pulse, 1, pulse);
    light.intensity = 32 + 14 * Math.sin(time * 2.9);
  };
  return group;
}

export { TAU, rand, clamp01, glowTexture };