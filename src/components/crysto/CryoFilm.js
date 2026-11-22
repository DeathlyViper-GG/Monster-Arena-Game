import * as THREE from "three";
import { clamp01 } from "@/components/glacialArchive/Cutscene";
import {
  createStage,
  createCrystoMaterials,
  createVillage,
  scatterTrees,
  createMeadowDust,
  valeHeight,
} from "./CrystoKit";

/* ═════════════════════════════════════════════════════════════════
   CRYSTO — OUT OF THE ICE
   Not a flyover: the waking. Frost on the inside of the glass, a
   breath of fog, the strip light stuttering up from red to amber,
   the hatch letting go and the vale pouring in.
   ═════════════════════════════════════════════════════════════════ */

const METAL = 0x2a3138;

function frostTexture() {
  const S = 512;
  const cv = document.createElement("canvas");
  cv.width = cv.height = S;
  const x = cv.getContext("2d");

  const g = x.createRadialGradient(S / 2, S / 2, S * 0.1, S / 2, S / 2, S * 0.75);
  g.addColorStop(0, "rgba(226,240,250,0.34)");
  g.addColorStop(0.55, "rgba(210,232,246,0.62)");
  g.addColorStop(1, "rgba(238,248,255,0.92)");
  x.fillStyle = g;
  x.fillRect(0, 0, S, S);

  // crystal branches growing in from the frame
  const branch = (x0, y0, a, len, w, depth) => {
    if (depth <= 0 || len < 3) return;
    const x1 = x0 + Math.cos(a) * len;
    const y1 = y0 + Math.sin(a) * len;
    x.strokeStyle = `rgba(255,255,255,${0.10 + depth * 0.14})`;
    x.lineWidth = w;
    x.beginPath();
    x.moveTo(x0, y0);
    x.lineTo(x1, y1);
    x.stroke();
    for (let i = 1; i <= 3; i++) {
      const u = i / 4;
      branch(x0 + (x1 - x0) * u, y0 + (y1 - y0) * u, a + (i % 2 ? 0.8 : -0.8), len * 0.42, w * 0.6, depth - 1);
    }
    branch(x1, y1, a + 0.2, len * 0.6, w * 0.7, depth - 1);
  };
  for (let i = 0; i < 26; i++) {
    const edge = i % 4;
    const t = Math.random();
    const x0 = edge === 0 ? t * S : edge === 1 ? S : edge === 2 ? t * S : 0;
    const y0 = edge === 0 ? 0 : edge === 1 ? t * S : edge === 2 ? S : t * S;
    const inward = edge === 0 ? Math.PI / 2 : edge === 1 ? Math.PI : edge === 2 ? -Math.PI / 2 : 0;
    branch(x0, y0, inward + (Math.random() - 0.5) * 0.9, 40 + Math.random() * 70, 2.4, 3);
  }

  // the cold bloom of crystals
  for (let i = 0; i < 900; i++) {
    const px = Math.random() * S;
    const py = Math.random() * S;
    const r = Math.random() * 1.8;
    x.fillStyle = `rgba(255,255,255,${0.10 + Math.random() * 0.5})`;
    x.beginPath();
    x.arc(px, py, r, 0, 7);
    x.fill();
  }
  return new THREE.CanvasTexture(cv);
}

function softTexture() {
  const S = 64;
  const cv = document.createElement("canvas");
  cv.width = cv.height = S;
  const x = cv.getContext("2d");
  const g = x.createRadialGradient(S / 2, S / 2, 0, S / 2, S / 2, S / 2);
  g.addColorStop(0, "rgba(255,255,255,0.9)");
  g.addColorStop(0.5, "rgba(220,238,250,0.35)");
  g.addColorStop(1, "rgba(220,238,250,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, S, S);
  return new THREE.CanvasTexture(cv);
}

/* The pod, from the inside: hull, ribs, the frosted hatch and the lights. */
function buildPod() {
  const group = new THREE.Group();
  const metal = new THREE.MeshStandardMaterial({ color: METAL, roughness: 0.42, metalness: 0.86 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x151a20, roughness: 0.6, metalness: 0.7 });

  const hull = new THREE.Mesh(new THREE.CylinderGeometry(2.6, 2.5, 6.6, 26, 1, true), metal);
  hull.material.side = THREE.BackSide;
  hull.position.y = 3.3;
  group.add(hull);

  const floor = new THREE.Mesh(new THREE.CircleGeometry(2.5, 26), dark);
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = 0.02;
  group.add(floor);

  const dome = new THREE.Mesh(new THREE.SphereGeometry(2.58, 22, 12, 0, 6.283, 0, 1.2), metal);
  dome.material.side = THREE.BackSide;
  dome.position.y = 6.4;
  group.add(dome);

  for (let i = 0; i < 5; i++) {
    const rib = new THREE.Mesh(new THREE.TorusGeometry(2.58, 0.05, 6, 30), dark);
    rib.rotation.x = Math.PI / 2;
    rib.position.y = 0.25 + i * 1.4;
    group.add(rib);
  }
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    const strut = new THREE.Mesh(new THREE.BoxGeometry(0.08, 6.4, 0.12), dark);
    strut.position.set(Math.cos(a) * 2.55, 3.2, Math.sin(a) * 2.55);
    strut.rotation.y = -a;
    group.add(strut);
  }

  // the hatch glass, frosted from the inside
  const frost = new THREE.Mesh(
    new THREE.PlaneGeometry(3.6, 4.4),
    new THREE.MeshStandardMaterial({
      map: frostTexture(),
      transparent: true,
      opacity: 1,
      roughness: 0.65,
      metalness: 0.05,
      color: 0xdcecf7,
      emissive: 0x123044,
      emissiveIntensity: 0.5,
      side: THREE.DoubleSide,
    })
  );
  frost.position.set(0, 2.5, -2.42);
  group.add(frost);

  // crystal spikes clinging to the frame
  const iceMat = new THREE.MeshStandardMaterial({
    color: 0xcfeaf8, roughness: 0.2, metalness: 0.1,
    transparent: true, opacity: 0.75, flatShading: true,
  });
  const spikes = [];
  for (let i = 0; i < 16; i++) {
    const a = Math.random() * Math.PI * 2;
    const s = new THREE.Mesh(new THREE.ConeGeometry(0.05 + Math.random() * 0.07, 0.2 + Math.random() * 0.45, 4), iceMat);
    s.position.set(Math.cos(a) * (1.1 + Math.random() * 0.5), 1.4 + Math.random() * 3.4, -2.35);
    s.rotation.z = Math.random() * 0.6;
    group.add(s);
    spikes.push(s);
  }

  // the strip light, and the warm one that comes up with the thaw
  const stripMat = new THREE.MeshStandardMaterial({
    color: 0x2a1010, emissive: 0xff3a2a, emissiveIntensity: 1.6, roughness: 0.4,
  });
  const strip = new THREE.Mesh(new THREE.BoxGeometry(0.06, 3.4, 0.12), stripMat);
  strip.position.set(-2.46, 3.1, -0.4);
  group.add(strip);

  const red = new THREE.PointLight(0xff3a2a, 2.2, 9, 2);
  red.position.set(-2.1, 3.0, -0.6);
  group.add(red);

  const warm = new THREE.PointLight(0xffd9a8, 0.2, 12, 2);
  warm.position.set(0, 3.4, -2.0);
  group.add(warm);

  // the pale light of the country beyond the glass
  const outside = new THREE.Mesh(
    new THREE.PlaneGeometry(9, 7),
    new THREE.MeshBasicMaterial({ color: 0x9ec8e0, transparent: true, opacity: 0.22 })
  );
  outside.position.set(0, 2.6, -2.9);
  group.add(outside);

  // vapour, hanging in the cold
  const soft = softTexture();
  const vapour = [];
  for (let i = 0; i < 46; i++) {
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({
      map: soft, color: 0xdff1ff, transparent: true, opacity: 0, depthWrite: false,
    }));
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * 2.1;
    sp.position.set(Math.cos(a) * r, Math.random() * 4.2, Math.sin(a) * r - 0.4);
    sp.scale.setScalar(0.7 + Math.random() * 1.5);
    sp.userData = { a: a, r: r, y: sp.position.y, sp: 0.12 + Math.random() * 0.22 };
    group.add(sp);
    vapour.push(sp);
  }

  return {
    group, frost, spikes, stripMat, red, warm, vapour, iceMat, outside,
    update(t, thaw) {
      // the strip light stutters as the pod comes up
      const stutter = 0.55 + Math.sin(t * 11.3) * 0.12 + Math.sin(t * 3.1) * 0.08;
      stripMat.emissiveIntensity = 1.2 + stutter * (1 - thaw);
      red.intensity = 2.2 * (1 - thaw * 0.75) * stutter;
      warm.intensity = 0.2 + thaw * 5.5;
      frost.material.opacity = Math.max(0, 1 - thaw * 1.25);
      frost.material.emissiveIntensity = 0.5 - thaw * 0.45;
      outside.material.opacity = 0.22 + thaw * 0.5;
      iceMat.opacity = Math.max(0, 0.75 - thaw * 0.9);
      for (const s of spikes) s.scale.setScalar(Math.max(0.001, 1 - thaw * 1.2));
      for (const sp of vapour) {
        const d = sp.userData;
        d.y += d.sp * 0.06;
        if (d.y > 4.6) d.y = 0.1;
        sp.position.y = d.y;
        sp.position.x = Math.cos(d.a + t * 0.25) * d.r;
        sp.position.z = Math.sin(d.a + t * 0.25) * d.r - 0.4;
        sp.material.opacity = (0.05 + thaw * 0.32) * (0.5 + 0.5 * Math.sin(t * 1.7 + d.a * 3));
      }
    },
  };
}

/* I — the cold: eyes open on the inside of the glass */
export function createCryoOne() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x05090e);
  scene.fog = new THREE.FogExp2(0x0a1a26, 0.055);
  const camera = new THREE.PerspectiveCamera(64, 1, 0.04, 120);

  const pod = buildPod();
  scene.add(pod.group);
  scene.add(new THREE.AmbientLight(0x2a4a63, 0.55));

  const update = (t) => {
    const e = clamp01(t / 20);
    // barely able to move yet: a slow drift, the head settling
    camera.position.set(Math.sin(t * 0.42) * 0.06, 2.34 + Math.sin(t * 0.8) * 0.02, 0.62 - e * 0.12);
    camera.lookAt(0, 2.5, -3);
    pod.update(t, e * 0.12);
  };
  return { scene, camera, baseFov: 64, shadowExtent: 6, update };
}

/* II — the thaw: the frost runs off, the hatch lets go */
export function createCryoTwo() {
  const scene = new THREE.Scene();
  scene.background = new THREE.Color(0x081019);
  scene.fog = new THREE.FogExp2(0x14212c, 0.045);
  const camera = new THREE.PerspectiveCamera(66, 1, 0.04, 160);

  const pod = buildPod();
  scene.add(pod.group);
  scene.add(new THREE.AmbientLight(0x35566d, 0.7));

  const update = (t) => {
    const e = clamp01(t / 20);
    const k = e * e * (3 - 2 * e);
    // the eye pushes through the opening as the glass clears
    camera.position.set(Math.sin(t * 0.5) * 0.04, 2.36 - k * 0.12, 0.62 - k * 3.2);
    camera.lookAt(0, 2.2 - k * 0.5, -4);
    pod.update(t, Math.min(1, e * 1.35));
    // the frost slides off the glass and the hatch swings wide
    pod.frost.position.z = -2.42 + k * 1.6;
    pod.frost.rotation.x = -k * 0.5;
  };
  return { scene, camera, baseFov: 66, shadowExtent: 8, update };
}

/* III — standing in the vale, the pod's breath still on your back */
export function createCryoThree() {
  const m = createCrystoMaterials();
  const stage = createStage({ sky: { top: 0x1d3d66, horizon: 0xc3dcea, glow: 0xffe6b8, aurora: 0x8fb7d8 }, fog: 0xa9c2d2, fogDensity: 0.003 });
  const { scene, camera } = stage;

  const village = createVillage(m, { count: 7, radius: 15 });
  village.position.y = valeHeight(0, 0);
  const treesGroup = scatterTrees(m, valeHeight, { count: 54, radius: 200, skip: 30 });
  const dust = createMeadowDust({ count: 500, area: 90, height: 22, color: 0xfff2c8 });
  scene.add(village, treesGroup, dust);

  // the pod behind them, hatch hanging open
  const hull = new THREE.Mesh(
    new THREE.CylinderGeometry(2.6, 3.0, 7.4, 18),
    m.stone(0x707781)
  );
  hull.position.set(4.6, 3.6, 7.4);
  hull.rotation.z = 0.16;
  scene.add(hull);
  const nose = new THREE.Mesh(new THREE.SphereGeometry(2.6, 18, 12, 0, 6.283, 0, 1.5), m.stone(0x707781));
  nose.position.set(4.6, 7.2, 7.4);
  scene.add(nose);
  const hatch = new THREE.Mesh(new THREE.BoxGeometry(3.1, 3.6, 0.24), m.iron());
  hatch.position.set(6.4, 3.4, 5.4);
  hatch.rotation.set(0.2, -1.1, 0.12);
  scene.add(hatch);

  const update = (t) => {
    stage.sky.update(t);
    dust.userData.update(t);
    const e = clamp01(t / 20);
    const k = e * e * (3 - 2 * e);
    // out of the pod and down onto the grass, the vale opening up ahead
    camera.position.set(3.6 - k * 3.2, 3.1 + k * 1.2, 5.4 - k * 9.5);
    camera.lookAt(-2 - k * 6, 1.4 + k * 2.2, -18);
  };
  return { scene, camera, baseFov: 58, shadowExtent: 70, update };
}