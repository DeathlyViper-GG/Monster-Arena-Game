import * as THREE from "three";
import {
  TAU,
  rand,
  clamp01,
  fbm2,
  ridged2,
  smoothstep,
  createMaterialLibrary,
} from "@/components/glacialArchive/Cutscene";

/* ═════════════════════════════════════════════════════════════════
   AGE OF THE SENTINEL — scenery the campaign was missing.
   The Scribe films are lit by actual light shafts falling through
   atmosphere, over ground that has shape. These two pieces give the
   Sentinel realms the same two things, in one line each.
   ═════════════════════════════════════════════════════════════════ */

/* ── volumetric light shafts ──────────────────────────────────── */

export function createGodShafts({
  count = 8,
  radius = 90,
  height = 320,
  color = 0xffd9a0,
  opacity = 0.11,
  tilt = 0.16,
  spread = 1,
  y = 0,
} = {}) {
  const group = new THREE.Group();
  const shaftGeometryCache = [];

  for (let i = 0; i < count; i++) {
    const h = height * rand(0.7, 1.25);
    const geometry = new THREE.CylinderGeometry(
      h * 0.012,
      h * 0.085 * rand(0.65, 1.25),
      h,
      26,
      1,
      true,
    );
    shaftGeometryCache.push(geometry);

    const uniforms = {
      uTime: { value: rand(0, 8) },
      uColor: { value: new THREE.Color(color) },
      uOpacity: { value: opacity * rand(0.55, 1.2) },
    };

    const material = new THREE.ShaderMaterial({
      uniforms,
      transparent: true,
      depthWrite: false,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      vertexShader: `varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
      fragmentShader: `
        uniform vec3 uColor;
        uniform float uOpacity;
        uniform float uTime;
        varying vec2 vUv;
        void main() {
          // max() guards the pow(): a base a hair below zero returns NaN, and a
          // NaN in the half-float buffer surfaces as a black block in the bloom.
          float a = pow(max(0.0, 1.0 - vUv.y), 1.7);
          float edge = smoothstep(0.0, 0.22, vUv.x) * smoothstep(1.0, 0.78, vUv.x);
          float flicker = 0.82 + 0.18 * sin(uTime * 0.8 + vUv.x * 6.0);
          gl_FragColor = vec4(uColor, a * edge * uOpacity * flicker);
        }
      `,
    });

    const mesh = new THREE.Mesh(geometry, material);
    const a = (i / count) * TAU + rand(-0.34, 0.34);
    const rad = radius * Math.pow(Math.random(), 0.65) * spread;
    mesh.position.set(Math.cos(a) * rad, y + h / 2 - 40, Math.sin(a) * rad);
    mesh.rotation.z = rand(-tilt, tilt);
    mesh.rotation.x = rand(-tilt, tilt);
    mesh.frustumCulled = false;
    // Self-driven: a scene only has to add the group, no per-frame plumbing.
    mesh.onBeforeRender = () => {
      uniforms.uTime.value = performance.now() / 1000;
    };
    group.add(mesh);
  }

  group.userData.geometries = shaftGeometryCache;
  return group;
}

/* ── ground with actual shape ─────────────────────────────────── */

export function createSentinelGround({
  size = 1600,
  segments = 190,
  base = 0x16241c,
  peak = 0x2c5340,
  amp = 14,
  ridge = 0.5,
  flat = 50,
  roughness = 0.94,
  metalness = 0.08,
  envMapIntensity = 0.8,
  normalTiles = 18,
  seed = 0,
} = {}) {
  const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
  geometry.rotateX(-Math.PI / 2);

  const position = geometry.attributes.position;
  const colors = new Float32Array(position.count * 3);
  const low = new THREE.Color(base);
  const high = new THREE.Color(peak);
  const mixed = new THREE.Color();

  for (let i = 0; i < position.count; i++) {
    const x = position.getX(i);
    const z = position.getZ(i);
    const distance = Math.hypot(x, z);
    const swell = (fbm2(x * 0.0032 + seed, z * 0.0032 - seed, 4) - 0.5) * 2;
    const spines = ridged2(x * 0.0016 + seed * 0.5, z * 0.0016, 4);
    // Flat under the camera, swelling into country at the edges.
    const relief = smoothstep(flat, flat + size * 0.32, distance);
    const h = (swell * 0.6 + (spines - 0.35) * ridge * 2) * amp * relief;
    position.setY(i, h);

    const tone = clamp01(0.2 + (h / (amp * 1.6)) * 0.7 + (spines - 0.4) * 0.55);
    mixed.copy(low).lerp(high, tone);
    colors[i * 3] = mixed.r;
    colors[i * 3 + 1] = mixed.g;
    colors[i * 3 + 2] = mixed.b;
  }

  geometry.setAttribute("color", new THREE.BufferAttribute(colors, 3));
  geometry.computeVertexNormals();

  const lib = createMaterialLibrary();
  const material = lib.stone({
    color: 0xffffff,
    vertexColors: true,
    roughness,
    metalness,
    envMapIntensity,
    normalScale: new THREE.Vector2(0.55, 0.55),
  });
  if (material.normalMap) {
    material.normalMap = material.normalMap.clone();
    material.normalMap.needsUpdate = true;
    material.normalMap.repeat.set(normalTiles, normalTiles);
  }

  return new THREE.Mesh(geometry, material);
}