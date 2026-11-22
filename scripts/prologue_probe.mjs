// Headless build check for the five story-prologue scenes: rebuilds each one
// without WebGL, ticks the animation across its runtime, and reports the set
// contents plus any NaN transform or exception.
// Run: node scripts/prologue_probe.mjs
import fs from "node:fs";
import path from "node:path";
import * as THREE from "three";

function makeCanvas() {
  const canvas = { width: 1, height: 1 };
  const gradient = { addColorStop() {} };
  const ctx = {
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    putImageData() {},
    createRadialGradient: () => gradient,
    createLinearGradient: () => gradient,
    fillRect() {}, clearRect() {}, beginPath() {}, arc() {}, ellipse() {},
    moveTo() {}, lineTo() {}, quadraticCurveTo() {}, closePath() {},
    fill() {}, stroke() {}, save() {}, restore() {}, clip() {},
    translate() {}, rotate() {}, drawImage() {},
  };
  for (const key of ["fillStyle", "strokeStyle", "lineWidth", "lineCap", "globalCompositeOperation", "globalAlpha"]) {
    Object.defineProperty(ctx, key, { set() {}, get() { return null; } });
  }
  canvas.getContext = () => ctx;
  return canvas;
}
globalThis.document = { createElement: () => makeCanvas() };
globalThis.window = { devicePixelRatio: 1, addEventListener() {} };
THREE.PMREMGenerator.prototype.fromScene = function stub() {
  return { texture: new THREE.Texture() };
};

const root = process.cwd();
const dir = path.join(root, "scripts", ".probe_prologue");
fs.mkdirSync(dir, { recursive: true });

const files = [
  "src/components/glacialArchive/Cutscene.jsx",
  "src/components/cinderIntro/CinderKit.js",
  "src/components/storyPrologue/PrologueKit.js",
  "src/components/storyPrologue/PrologueSets.js",
  "src/components/storyPrologue/WakeScene.js",
  "src/components/storyPrologue/SealScene.js",
  "src/components/storyPrologue/EmpireScene.js",
  "src/components/storyPrologue/ShatterScene.js",
  "src/components/storyPrologue/HollowScene.js",
];

for (const rel of files) {
  let code = fs.readFileSync(path.join(root, rel), "utf8");
  code = code
    .replace(/@\/components\/glacialArchive\/Cutscene/g, "./Cutscene.js")
    .replace(/@\/components\/cinderIntro\/CinderKit/g, "./CinderKit.js")
    .replace(/from "\.\/PrologueKit"/g, 'from "./PrologueKit.js"')
    .replace(/from "\.\/PrologueSets"/g, 'from "./PrologueSets.js"');
  fs.writeFileSync(path.join(dir, path.basename(rel).replace(".jsx", ".js")), code);
}

const renderer = {
  getDrawingBufferSize: (v) => v.set(1280, 720),
  capabilities: { isWebGL2: true, maxTextureSize: 4096 },
  getRenderTarget() { return null; },
  setRenderTarget() {}, getContext() { return {}; }, compile() {}, dispose() {},
  domElement: makeCanvas(),
};

const SCENES = [
  ["WakeScene", "I · waking", [0.2, 3, 8, 16]],
  ["SealScene", "II · the seals", [0.2, 4, 9, 18]],
  ["EmpireScene", "III · Nhalori", [0.2, 4, 9, 18]],
  ["ShatterScene", "IV · the shattering", [0.5, 3, 6, 12]],
  ["HollowScene", "V · the Hollow King", [0.2, 3, 9, 18]],
];

let failed = false;

for (const [file, label, times] of SCENES) {
  try {
    const { default: build } = await import(path.join(dir, `${file}.js`));
    const api = build({ renderer });
    let meshes = 0;
    let sprites = 0;
    let points = 0;
    let lights = 0;
    let tris = 0;
    const bad = [];

    for (const time of times) {
      api.update?.(time, 0.016, { x: 0.2, y: -0.1 });
      api.camera.updateMatrixWorld(true);
      if (!Number.isFinite(api.camera.position.x + api.camera.position.y + api.camera.position.z)) {
        bad.push(`camera NaN at t=${time}`);
      }
    }

    api.scene.updateMatrixWorld(true);
    api.scene.traverse((object) => {
      if (object.isMesh) {
        meshes++;
        const g = object.geometry;
        if (g?.index) tris += g.index.count / 3;
        else if (g?.attributes?.position) tris += g.attributes.position.count / 3;
      } else if (object.isSprite) sprites++;
      else if (object.isPoints) points++;
      else if (object.isLight) lights++;
      if (!Number.isFinite(object.position.x + object.position.y + object.position.z)) {
        bad.push(`NaN position on ${object.type}`);
      }
    });

    console.log(
      `${label.padEnd(22)} meshes ${String(meshes).padStart(4)}  sprites ${String(sprites).padStart(3)}` +
        `  points ${points}  lights ${lights}  tris ${Math.round(tris).toLocaleString()}` +
        (bad.length ? `  ⚠ ${bad.slice(0, 3).join("; ")}` : "  ok"),
    );
    if (bad.length) failed = true;
  } catch (error) {
    failed = true;
    console.log(`${label.padEnd(22)} ✖ ${error.message}`);
  }
}

fs.rmSync(dir, { recursive: true, force: true });
process.exit(failed ? 1 : 0);