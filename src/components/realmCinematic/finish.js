import * as THREE from "three";

/* ═════════════════════════════════════════════════════════════════
   THE FILM FINISH — shared by every Age of the Sentinel cinematic and the
   walkable village.

   • LensShader   chromatic fringing toward the frame edge, a gentle sharpen,
                  an S-curve with split-toning (cool shadows, warm highlights),
                  soft vignette and a breath of animated dust.
   • enableShadows  turns the scene's key light into a real shadow caster and
                  marks solid meshes as casters/receivers, so figures, trees,
                  pillars and ruins stop floating over their ground.
   • createFireflies  a drifting cloud of warm glints for the village.
   ═════════════════════════════════════════════════════════════════ */

export const LensShader = {
  uniforms: {
    tDiffuse: { value: null },
    uTime: { value: 0 },
    uRes: { value: new THREE.Vector2(1, 1) },
    uAberration: { value: 0.0013 },
    uSharpen: { value: 0.32 },
    uContrast: { value: 0.16 },
    uVignette: { value: 0.34 },
    uWarm: { value: new THREE.Color(1.04, 1.0, 0.94) },
    uCool: { value: new THREE.Color(0.94, 1.0, 1.07) },
  },
  vertexShader: `varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }`,
  fragmentShader: `
    uniform sampler2D tDiffuse; uniform float uTime, uAberration, uSharpen, uContrast, uVignette;
    uniform vec2 uRes; uniform vec3 uWarm, uCool; varying vec2 vUv;
    float h(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main(){
      vec2 c = vUv - 0.5; float r = dot(c, c);
      vec2 off = c * r * uAberration * 14.0;
      vec3 col;
      col.r = texture2D(tDiffuse, vUv + off).r;
      col.g = texture2D(tDiffuse, vUv).g;
      col.b = texture2D(tDiffuse, vUv - off).b;
      // unsharp from the four neighbours
      vec2 px = 1.0 / uRes;
      vec3 blur = (texture2D(tDiffuse, vUv + vec2(px.x, 0.)).rgb + texture2D(tDiffuse, vUv - vec2(px.x, 0.)).rgb +
                   texture2D(tDiffuse, vUv + vec2(0., px.y)).rgb + texture2D(tDiffuse, vUv - vec2(0., px.y)).rgb) * 0.25;
      col += (col - blur) * uSharpen;
      // S-curve + split tone
      float l = dot(col, vec3(0.299, 0.587, 0.114));
      vec3 curved = mix(col, col * col * (3.0 - 2.0 * col), uContrast);
      vec3 tone = mix(uCool, uWarm, smoothstep(0.15, 0.85, l));
      col = curved * tone;
      // vignette
      col *= 1.0 - smoothstep(0.18, 0.62, r) * uVignette * 1.7;
      // dust
      float d = h(floor(vUv * uRes * 0.5) + floor(uTime * 24.0));
      col += (d - 0.5) * 0.012;
      gl_FragColor = vec4(max(col, 0.0), 1.0);
    }`,
};

const isSkyLike = (m) => {
  const mats = Array.isArray(m.material) ? m.material : [m.material];
  return mats.some((x) => x && (x.side === THREE.BackSide || x.depthWrite === false || (x.transparent && x.opacity < 0.7)));
};

/* Make the scene's strongest directional light cast soft shadows over the stage. */
export function enableShadows(scene, { extent = 110, mapSize = 2048, follow = null } = {}) {
  let key = null;
  scene.traverse((o) => {
    if (o.isDirectionalLight && (!key || o.intensity > key.intensity)) key = o;
  });
  if (!key) return null;
  key.castShadow = true;
  key.shadow.mapSize.set(mapSize, mapSize);
  const cam = key.shadow.camera;
  cam.left = -extent; cam.right = extent; cam.top = extent; cam.bottom = -extent;
  cam.near = 1; cam.far = extent * 5;
  key.shadow.bias = -0.00035;
  key.shadow.normalBias = 0.06;
  key.shadow.radius = 3;
  if (!key.target.parent) scene.add(key.target);
  scene.traverse((o) => {
    if (!o.isMesh || o.userData.noShadow || isSkyLike(o)) return;
    o.castShadow = true;
    o.receiveShadow = true;
  });
  return key;
}

/* Keep the shadow frustum centred on the action (village: the player). */
export function followShadow(key, target, offset) {
  if (!key || !target) return;
  key.target.position.copy(target);
  key.position.copy(target).add(offset);
  key.target.updateMatrixWorld();
}

export function createFireflies({ count = 160, radius = 46, height = 9, color = 0xffe9a0 } = {}) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3), seed = new Float32Array(count);
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * radius;
    pos[i * 3] = Math.cos(a) * r; pos[i * 3 + 1] = 0.6 + Math.random() * height; pos[i * 3 + 2] = Math.sin(a) * r;
    seed[i] = Math.random() * 100;
  }
  geo.setAttribute("position", new THREE.BufferAttribute(pos, 3));
  const c = document.createElement("canvas"); c.width = c.height = 64;
  const g = c.getContext("2d"), grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
  grd.addColorStop(0, "rgba(255,255,255,1)"); grd.addColorStop(0.3, "rgba(255,255,255,.4)"); grd.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = grd; g.fillRect(0, 0, 64, 64);
  const tex = new THREE.CanvasTexture(c);
  const mat = new THREE.PointsMaterial({ map: tex, color, size: 0.9, transparent: true, opacity: 0.9, depthWrite: false, blending: THREE.AdditiveBlending, sizeAttenuation: true });
  const pts = new THREE.Points(geo, mat);
  pts.userData.noShadow = true;
  pts.frustumCulled = false;
  const base = pos.slice();
  const update = (t) => {
    const p = geo.attributes.position.array;
    for (let i = 0; i < count; i++) {
      const s = seed[i];
      p[i * 3] = base[i * 3] + Math.sin(t * 0.35 + s) * 2.2;
      p[i * 3 + 1] = base[i * 3 + 1] + Math.sin(t * 0.6 + s * 1.7) * 0.9;
      p[i * 3 + 2] = base[i * 3 + 2] + Math.cos(t * 0.3 + s * 0.8) * 2.2;
    }
    geo.attributes.position.needsUpdate = true;
    mat.opacity = 0.65 + Math.sin(t * 1.3) * 0.2;
  };
  return { points: pts, update };
}
