import * as THREE from "three";
import {
  TAU,
  clamp01,
  rand,
  fbm2,
  smoothstep,
  glowTexture,
  runeTexture,
  createEnvMap,
  createTerrain,
  createGroundFog,
  createRuneCircle,
} from "@/components/glacialArchive/Cutscene";

// Shared primitives the desert cinematic reuses from the Glacial toolkit.
export {
  TAU,
  clamp01,
  rand,
  fbm2,
  smoothstep,
  glowTexture,
  runeTexture,
  createEnvMap,
  createTerrain,
  createGroundFog,
  createRuneCircle,
};

/* ── desert palette + materials ───────────────────────────── */

export function createDesertEnvMap(renderer) {
  return createEnvMap(renderer, { top: 0x2a1330, horizon: 0xd97b39, ground: 0x2a1608 });
}

export function createDesertMaterials() {
  return {
    sand: (opts = {}) =>
      new THREE.MeshStandardMaterial({
        color: 0xc99257,
        roughness: 0.96,
        metalness: 0.02,
        envMapIntensity: 0.45,
        ...opts,
      }),
    stone: (opts = {}) =>
      new THREE.MeshStandardMaterial({
        color: 0x6b4f31,
        roughness: 0.9,
        metalness: 0.06,
        envMapIntensity: 0.5,
        ...opts,
      }),
    glass: (opts = {}) =>
      new THREE.MeshPhysicalMaterial({
        color: 0xc6e6ff,
        roughness: 0.06,
        metalness: 0.02,
        clearcoat: 1,
        clearcoatRoughness: 0.03,
        transparent: true,
        opacity: 0.66,
        envMapIntensity: 2.6,
        side: THREE.DoubleSide,
        ...opts,
      }),
    gold: (opts = {}) =>
      new THREE.MeshStandardMaterial({
        color: 0xd9a44e,
        roughness: 0.32,
        metalness: 0.92,
        envMapIntensity: 1.6,
        emissive: 0x3a2008,
        emissiveIntensity: 0.5,
        ...opts,
      }),
    emissive: (color, intensity = 2) => {
      const material = new THREE.MeshBasicMaterial({ color: new THREE.Color(color) });
      material.color.multiplyScalar(intensity);
      return material;
    },
  };
}

/* ── dusk sky with a glaring low sun ──────────────────────── */

export function createDesertSky({
  top = 0x1a0b28,
  horizon = 0xe07a34,
  sun = 0xfff1c6,
  dust = 0xcf9450,
  sunDir = new THREE.Vector3(0.34, 0.11, -0.93),
} = {}) {
  const uniforms = {
    uTime: { value: 0 },
    uTop: { value: new THREE.Color(top) },
    uHorizon: { value: new THREE.Color(horizon) },
    uSun: { value: new THREE.Color(sun) },
    uDust: { value: new THREE.Color(dust) },
    uSunDir: { value: sunDir.clone().normalize() },
  };

  const material = new THREE.ShaderMaterial({
    side: THREE.BackSide,
    depthWrite: false,
    fog: false,
    uniforms,
    vertexShader: `
      varying vec3 vDirection;
      void main() {
        vDirection = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform float uTime;
      uniform vec3 uTop;
      uniform vec3 uHorizon;
      uniform vec3 uSun;
      uniform vec3 uDust;
      uniform vec3 uSunDir;
      varying vec3 vDirection;

      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
      }
      float fbm(vec2 p) {
        float v = 0.0;
        float a = 0.5;
        for (int i = 0; i < 5; i++) { v += a * noise(p); p *= 2.03; a *= 0.5; }
        return v;
      }

      void main() {
        vec3 dir = normalize(vDirection);
        float h = dir.y;
        vec3 color = mix(uHorizon, uTop, smoothstep(-0.05, 0.62, h));

        float sd = max(dot(dir, normalize(uSunDir)), 0.0);
        color += uSun * pow(sd, 1400.0) * 6.0;
        color += uSun * pow(sd, 24.0) * 0.62;
        color += uSun * pow(sd, 5.0) * 0.14;

        float dustBand = exp(-pow((h - 0.02) * 5.5, 2.0));
        float swirl = fbm(vec2(dir.x * 2.3 + uTime * 0.02, dir.z * 2.7 - uTime * 0.014));
        color += uDust * dustBand * (0.16 + swirl * 0.34);

        float stars = pow(hash(floor(dir.xz * 320.0)), 68.0) * smoothstep(0.34, 0.9, h);
        color += vec3(0.86, 0.8, 0.95) * stars * 0.7;

        gl_FragColor = vec4(color, 1.0);
      }
    `,
  });

  const mesh = new THREE.Mesh(new THREE.SphereGeometry(1600, 48, 30), material);
  mesh.frustumCulled = false;
  return {
    mesh,
    uniforms,
    update(time) {
      uniforms.uTime.value = time;
    },
  };
}

/* ── wind-blown desert terrain ────────────────────────────── */

export function duneHeight(x, z) {
  const warp = (fbm2(x * 0.0015, z * 0.0015, 3) - 0.5) * 90;
  const ridge = Math.sin((x + warp) * 0.0085) * 0.5 + 0.5;
  const cross = Math.cos((z - warp * 0.5) * 0.0055) * 0.5 + 0.5;
  const crest = Math.pow(ridge, 1.7) * (7 + 15 * cross);
  const grit = (fbm2(x * 0.06, z * 0.06, 3) - 0.5) * 0.75;
  const far = smoothstep(150, 780, Math.hypot(x, z)) * (fbm2(x * 0.0021, z * 0.0021, 4) - 0.35) * 110;
  return crest + grit + far;
}

export function createDuneField({ size = 1500, segments = 300, heightFn = duneHeight, material } = {}) {
  return createTerrain({
    size,
    segments,
    heightFn,
    colors: { snow: 0xf0c68a, rock: 0xa9713f, shadow: 0x3a2011, base: -6 },
    material,
  });
}

/* ── horizontal sandstorm (GPU points) ────────────────────── */

export function createSandStorm({
  count = 9000,
  area = 260,
  height = 70,
  size = 1.5,
  speed = 1,
  color = 0xf3cb96,
  opacity = 0.5,
} = {}) {
  const positions = new Float32Array(count * 3);
  const sizes = new Float32Array(count);
  const speeds = new Float32Array(count);
  const seeds = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    positions[i * 3] = rand(-area / 2, area / 2);
    positions[i * 3 + 1] = rand(-2, height);
    positions[i * 3 + 2] = rand(-area / 2, area / 2);
    sizes[i] = rand(0.7, 2.8) * size;
    speeds[i] = rand(0.6, 1.9) * speed;
    seeds[i] = Math.random();
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("aSpeed", new THREE.BufferAttribute(speeds, 1));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uArea: { value: area },
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
      uPixelRatio: { value: Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 1.8) },
    },
    vertexShader: `
      uniform float uTime;
      uniform float uArea;
      uniform float uPixelRatio;
      attribute float aSize;
      attribute float aSpeed;
      attribute float aSeed;
      varying float vFade;
      void main() {
        vec3 p = position;
        p.x = mod(p.x + uTime * aSpeed * 16.0 + uArea * 0.5, uArea) - uArea * 0.5;
        p.z += sin(uTime * 0.5 + aSeed * 6.2831) * 6.0;
        p.y += sin(uTime * 0.9 + aSeed * 11.0) * 1.6;
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float dist = -mv.z;
        gl_PointSize = aSize * uPixelRatio * (420.0 / max(dist, 1.0));
        vFade = smoothstep(1.0, 16.0, dist) * (1.0 - smoothstep(uArea * 0.34, uArea * 0.5, dist));
        vFade *= 0.5 + 0.5 * smoothstep(-4.0, 8.0, p.y);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying float vFade;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float alpha = smoothstep(0.5, 0.05, d);
        if (alpha * vFade < 0.004) discard;
        gl_FragColor = vec4(uColor, alpha * vFade * uOpacity);
      }
    `,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return {
    mesh: points,
    update(time) {
      material.uniforms.uTime.value = time;
    },
  };
}

/* ── swirling sand vortex around a figure ─────────────────── */

export function createSandVortex({
  count = 2600,
  radius = 4.2,
  height = 13,
  color = 0xffd9a0,
  opacity = 0.6,
} = {}) {
  const positions = new Float32Array(count * 3);
  const seeds = new Float32Array(count);
  const lifts = new Float32Array(count);

  for (let i = 0; i < count; i++) {
    const seed = Math.random();
    seeds[i] = seed;
    lifts[i] = Math.random();
    positions[i * 3] = 0;
    positions[i * 3 + 1] = 0;
    positions[i * 3 + 2] = 0;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aSeed", new THREE.BufferAttribute(seeds, 1));
  geometry.setAttribute("aLift", new THREE.BufferAttribute(lifts, 1));

  const material = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
    uniforms: {
      uTime: { value: 0 },
      uRadius: { value: radius },
      uHeight: { value: height },
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity },
      uPixelRatio: { value: Math.min(typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1, 1.8) },
    },
    vertexShader: `
      uniform float uTime;
      uniform float uRadius;
      uniform float uHeight;
      uniform float uPixelRatio;
      attribute float aSeed;
      attribute float aLift;
      varying float vFade;
      void main() {
        float t = fract(aLift + uTime * (0.045 + aSeed * 0.05));
        float angle = aSeed * 6.2831 + uTime * (0.9 + aSeed * 1.4) + t * 5.2;
        float r = uRadius * (0.32 + t * 0.95) * (0.75 + aSeed * 0.5);
        vec3 p = vec3(cos(angle) * r, t * uHeight, sin(angle) * r);
        vec4 mv = modelViewMatrix * vec4(p, 1.0);
        gl_Position = projectionMatrix * mv;
        float dist = -mv.z;
        gl_PointSize = (1.1 + aSeed * 1.9) * uPixelRatio * (420.0 / max(dist, 1.0));
        vFade = (0.25 + 0.75 * (1.0 - t)) * smoothstep(0.0, 3.0, dist);
      }
    `,
    fragmentShader: `
      uniform vec3 uColor;
      uniform float uOpacity;
      varying float vFade;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        float alpha = smoothstep(0.5, 0.04, d);
        if (alpha * vFade < 0.004) discard;
        gl_FragColor = vec4(uColor, alpha * vFade * uOpacity);
      }
    `,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  return {
    mesh: points,
    update(time) {
      material.uniforms.uTime.value = time;
    },
  };
}

/* ── sun disc + anamorphic flare ──────────────────────────── */

export function createSunFlare({ position = new THREE.Vector3(), size = 120 } = {}) {
  const group = new THREE.Group();
  group.position.copy(position);

  const disc = new THREE.Mesh(
    new THREE.SphereGeometry(size * 0.12, 32, 24),
    new THREE.MeshBasicMaterial({ color: 0xfff6dc, fog: false }),
  );
  group.add(disc);

  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture(128, "255,236,190"),
      color: 0xffd9a1,
      transparent: true,
      opacity: 0.72,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    }),
  );
  halo.scale.setScalar(size * 4.2);
  group.add(halo);

  const streak = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture(128, "255,226,176"),
      color: 0xffcf92,
      transparent: true,
      opacity: 0.34,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    }),
  );
  streak.scale.set(size * 16, size * 0.55, 1);
  group.add(streak);

  return { group, disc, halo, streak };
}

/* ── half-buried Nhalori obelisks ─────────────────────────── */

export function createObelisk({ height = 16, radius = 1.2, material, runeMaterial, seed = 0 } = {}) {
  const group = new THREE.Group();

  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(radius * 0.66, radius, height, 4, 6), material);
  shaft.position.y = height / 2;
  shaft.rotation.y = Math.PI / 4 + seed * 0.3;
  group.add(shaft);

  const cap = new THREE.Mesh(new THREE.ConeGeometry(radius * 0.68, height * 0.11, 4), material);
  cap.position.y = height + height * 0.055;
  cap.rotation.y = shaft.rotation.y;
  group.add(cap);

  const goldTip = new THREE.Mesh(
    new THREE.ConeGeometry(radius * 0.46, height * 0.075, 4),
    runeMaterial,
  );
  goldTip.position.y = height + height * 0.045;
  goldTip.rotation.y = shaft.rotation.y;
  group.add(goldTip);

  for (const side of [-1, 1]) {
    for (let i = 0; i < 2; i++) {
      const panel = new THREE.Mesh(
        new THREE.PlaneGeometry(radius * 0.7, height * 0.34),
        new THREE.MeshBasicMaterial({
          map: runeTexture(7 + i),
          color: 0x9fe0ff,
          transparent: true,
          opacity: 0.24,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          side: THREE.DoubleSide,
        }),
      );
      const angle = shaft.rotation.y + (i === 0 ? 0 : Math.PI);
      panel.position.set(Math.sin(angle) * radius * 0.94 * side, height * (0.34 + i * 0.3), Math.cos(angle) * radius * 0.94 * side);
      panel.rotation.y = angle;
      group.add(panel);
    }
  }

  return group;
}

/* ── the Pharaoh of Glass ─────────────────────────────────── */

const PHARAOH_ROBE = [
  [0.0, 0.0],
  [2.62, 0.03],
  [2.7, 0.55],
  [2.62, 1.35],
  [2.48, 2.2],
  [2.3, 3.1],
  [2.12, 3.95],
  [1.98, 4.7],
  [1.9, 5.4],
  [1.86, 5.9],
  [1.78, 6.25],
  [1.52, 6.45],
  [1.12, 6.56],
  [0.84, 6.62],
].map(([r, y]) => new THREE.Vector2(r, y));

export function createPharaoh(mats) {
  const group = new THREE.Group();

  const glass = mats.glass({ color: 0xc4e6ff, opacity: 0.62, emissive: 0x1a4358, emissiveIntensity: 0.4 });
  const glassDeep = mats.glass({ color: 0x8fc4e6, opacity: 0.5, emissive: 0x14313f, emissiveIntensity: 0.55 });
  const glassFine = mats.glass({ color: 0xdcf2ff, opacity: 0.5, emissive: 0x2c6c88, emissiveIntensity: 0.6 });
  const gold = mats.gold();
  const eyeMaterial = mats.emissive(0xa9f2ff, 6);

  /* robe */
  const robeGeometry = new THREE.LatheGeometry(PHARAOH_ROBE, 128);
  const rp = robeGeometry.attributes.position;
  for (let i = 0; i < rp.count; i++) {
    const x = rp.getX(i);
    const y = rp.getY(i);
    const z = rp.getZ(i);
    const angle = Math.atan2(z, x);
    const fold = fbm2(Math.cos(angle) * 2.4 + 3.1, Math.sin(angle) * 2.4 + y * 0.4, 4) - 0.5;
    const ripple = Math.sin(angle * 9 + y * 0.9) * 0.035;
    const scale = 1 + fold * 0.16 + ripple;
    rp.setXYZ(i, x * scale, y, z * scale);
  }
  robeGeometry.computeVertexNormals();
  const robe = new THREE.Mesh(robeGeometry, glass);
  group.add(robe);

  /* gold collar + pectoral */
  const collar = new THREE.Mesh(new THREE.TorusGeometry(1.34, 0.3, 12, 60), gold);
  collar.position.y = 6.3;
  collar.rotation.x = Math.PI / 2;
  collar.scale.z = 0.6;
  group.add(collar);

  const pectoral = new THREE.Mesh(new THREE.TorusGeometry(1.02, 0.14, 10, 48), gold);
  pectoral.position.y = 5.72;
  pectoral.rotation.x = Math.PI / 2;
  pectoral.scale.z = 0.55;
  group.add(pectoral);

  /* nemes headdress */
  const nemesProfile = [
    [1.34, 6.42],
    [1.62, 6.78],
    [1.7, 7.3],
    [1.56, 7.86],
    [1.3, 8.24],
    [0.86, 8.46],
    [0.0, 8.52],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  // Open at the front (phi gap) so the glass face looks out from under it.
  const nemes = new THREE.Mesh(new THREE.LatheGeometry(nemesProfile, 96, 0.72, TAU - 1.44), glassFine);
  group.add(nemes);

  /* the two side lappets falling to the shoulders */
  for (const side of [-1, 1]) {
    const lappet = new THREE.Mesh(new THREE.BoxGeometry(0.34, 2.5, 1.15, 2, 8, 2), glassFine);
    const lp = lappet.geometry.attributes.position;
    for (let i = 0; i < lp.count; i++) {
      const y = lp.getY(i);
      const x = lp.getX(i);
      lp.setX(i, x * (0.7 + (1.25 - y) * 0.16));
    }
    lappet.geometry.computeVertexNormals();
    lappet.position.set(side * 1.28, 7.05, 0.16);
    lappet.rotation.z = side * 0.06;
    group.add(lappet);

    const band = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.2, 1.2), gold);
    band.position.set(side * 1.28, 8.12, 0.16);
    group.add(band);
  }

  const uraeus = new THREE.Mesh(new THREE.ConeGeometry(0.16, 0.5, 6), gold);
  uraeus.position.set(0, 8.62, 0.62);
  uraeus.rotation.x = 0.24;
  group.add(uraeus);

  /* the glass face */
  const face = new THREE.Mesh(new THREE.SphereGeometry(1.02, 40, 30), glassFine);
  face.scale.set(0.88, 1.04, 0.84);
  face.position.set(0, 7.44, 0.24);
  group.add(face);

  const browBand = new THREE.Mesh(new THREE.BoxGeometry(1.7, 0.18, 0.55), gold);
  browBand.position.set(0, 8.06, 0.42);
  group.add(browBand);

  const eyes = [];
  for (const side of [-1, 1]) {
    const eye = new THREE.Mesh(new THREE.SphereGeometry(0.13, 16, 12), eyeMaterial);
    eye.position.set(side * 0.31, 7.62, 1.0);
    eye.scale.set(1.5, 0.72, 0.7);
    group.add(eye);
    eyes.push(eye);
  }

  const beard = new THREE.Mesh(new THREE.ConeGeometry(0.15, 0.95, 8), glassFine);
  beard.position.set(0, 6.72, 0.78);
  beard.rotation.x = Math.PI;
  group.add(beard);

  /* crossed arms — crook and flail */
  for (const side of [-1, 1]) {
    const arm = new THREE.Mesh(new THREE.CapsuleGeometry(0.24, 1.5, 5, 12), glassDeep);
    arm.position.set(side * 0.74, 5.42, 0.62);
    arm.rotation.z = side * 1.16;
    arm.rotation.x = -0.2;
    group.add(arm);

    const cuff = new THREE.Mesh(new THREE.TorusGeometry(0.26, 0.09, 8, 20), gold);
    cuff.position.set(side * 1.26, 5.28, 0.78);
    cuff.rotation.y = Math.PI / 2;
    group.add(cuff);
  }

  const crook = new THREE.Mesh(new THREE.TorusGeometry(0.42, 0.1, 10, 24, Math.PI * 1.15), gold);
  crook.position.set(-1.5, 5.9, 0.86);
  crook.rotation.y = 0.3;
  group.add(crook);

  const flailHandle = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 1.5, 8), gold);
  flailHandle.position.set(1.52, 5.5, 0.84);
  flailHandle.rotation.z = 0.12;
  group.add(flailHandle);

  for (let i = 0; i < 3; i++) {
    const a = -0.5 + i * 0.5;
    const strand = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.62, 5), gold);
    strand.position.set(1.52 + Math.sin(a) * 0.28, 4.98, 0.84 + Math.cos(a) * 0.12);
    strand.rotation.z = Math.sin(a) * 0.34;
    group.add(strand);

    const bead = new THREE.Mesh(new THREE.SphereGeometry(0.09, 10, 8), glassFine);
    bead.position.set(1.52 + Math.sin(a) * 0.38, 4.62, 0.84 + Math.cos(a) * 0.16);
    group.add(bead);
  }

  /* a crown of shattered glass behind the head */
  const crown = new THREE.Group();
  crown.position.y = 8.45;
  group.add(crown);
  for (let i = 0; i < 11; i++) {
    const angle = (i / 11) * TAU;
    const height = rand(0.5, 1.5);
    const spike = new THREE.Mesh(new THREE.ConeGeometry(rand(0.06, 0.13), height, 5), glassFine);
    spike.position.set(Math.cos(angle) * 0.95, height * 0.34, Math.sin(angle) * 0.95);
    spike.rotation.z = -Math.cos(angle) * 0.32;
    spike.rotation.x = Math.sin(angle) * 0.32;
    crown.add(spike);
  }

  /* sand spilling out of the hem */
  const hemGlow = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture(128, "255,206,150"),
      color: 0xffc98a,
      transparent: true,
      opacity: 0.28,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  hemGlow.scale.set(7.4, 3.2, 1);
  hemGlow.position.y = 0.5;
  group.add(hemGlow);

  return { group, eyes, eyeMaterial, crown, robe, hemGlow };
}

/* ── the glass pyramid tomb ───────────────────────────────── */

export function createGlassPyramid({ base = 9, height = 13, mats } = {}) {
  const group = new THREE.Group();

  const corners = [
    [base, base],
    [-base, base],
    [-base, -base],
    [base, -base],
  ];

  const positions = [];
  const colors = [];
  const warm = new THREE.Color(0xffd49a);
  const cool = new THREE.Color(0x9fd8ff);
  const deep = new THREE.Color(0x5f8fb8);

  for (let f = 0; f < 4; f++) {
    const a = corners[f];
    const b = corners[(f + 1) % 4];
    positions.push(0, height, 0, a[0], 0, a[1], b[0], 0, b[1]);
    const lit = f === 0 || f === 3;
    colors.push(
      ...(lit ? [warm.r, warm.g, warm.b] : [cool.r, cool.g, cool.b]),
      ...(lit ? [warm.r, warm.g, warm.b] : [deep.r, deep.g, deep.b]),
      ...(lit ? [cool.r, cool.g, cool.b] : [deep.r, deep.g, deep.b]),
    );
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute("color", new THREE.Float32BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  const shell = new THREE.Mesh(
    geometry,
    new THREE.MeshPhysicalMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.52,
      roughness: 0.05,
      metalness: 0.02,
      clearcoat: 1,
      clearcoatRoughness: 0.02,
      envMapIntensity: 2.8,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  shell.renderOrder = 2;
  group.add(shell);

  /* glowing seams */
  const seams = [];
  for (let f = 0; f < 4; f++) {
    const a = corners[f];
    const b = corners[(f + 1) % 4];
    seams.push(0, height, 0, a[0], 0, a[1]);
    seams.push(a[0], 0, a[1], b[0], 0, b[1]);
  }
  const seamGeometry = new THREE.BufferGeometry();
  seamGeometry.setAttribute("position", new THREE.Float32BufferAttribute(seams, 3));
  group.add(
    new THREE.LineSegments(
      seamGeometry,
      new THREE.LineBasicMaterial({
        color: 0xd6f2ff,
        transparent: true,
        opacity: 0.55,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    ),
  );

  /* stepped plinth */
  for (let i = 0; i < 3; i++) {
    const step = new THREE.Mesh(
      new THREE.BoxGeometry(base * 2.4 - i * 0.9, 0.7, base * 2.4 - i * 0.9),
      mats.stone({ color: i === 2 ? 0x7b5b38 : 0x66492c }),
    );
    step.position.y = -0.35 - i * 0.7;
    group.add(step);
  }

  /* the buried shard suspended inside */
  const shardGeometry = new THREE.OctahedronGeometry(0.9, 0);
  shardGeometry.scale(1, 2.8, 1);
  const shard = new THREE.Mesh(
    shardGeometry,
    mats.glass({ color: 0xe6f8ff, opacity: 0.9, emissive: 0x2f9dd6, emissiveIntensity: 2.6 }),
  );
  shard.position.y = height * 0.42;
  group.add(shard);

  const core = new THREE.Mesh(new THREE.OctahedronGeometry(0.36, 0), mats.emissive(0xe8fbff, 5));
  core.scale.set(1, 2.6, 1);
  shard.add(core);

  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture(128, "170,226,255"),
      color: 0x8fe0ff,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    }),
  );
  halo.scale.setScalar(9);
  shard.add(halo);

  const innerLight = new THREE.PointLight(0x8fdcff, 42, 70, 2);
  innerLight.position.y = height * 0.42;
  group.add(innerLight);

  return { group, shard, core, shell, innerLight, halo };
}

/* ── sand curtains drifting across the dunes ──────────────── */

export function createSandCurtain({ width = 320, height = 90, x = 0, z = -120, opacity = 0.16 } = {}) {
  const material = new THREE.MeshBasicMaterial({
    map: glowTexture(128, "255,214,160"),
    color: 0xffc98f,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(width, height), material);
  mesh.position.set(x, height * 0.32, z);
  return mesh;
}