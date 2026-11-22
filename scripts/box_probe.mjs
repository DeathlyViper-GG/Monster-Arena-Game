// Black-box probe: rebuilds the real Cinder scenes headlessly (no WebGL) and
// prints a luminance map of the nearest opaque surface in each screen cell, so
// a dark slab in the frame can be traced to the exact object and material.
// Run: node scripts/box_probe.mjs
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
const dir = path.join(root, "scripts", ".probe_tmp");
fs.mkdirSync(dir, { recursive: true });
const files = [
  "src/components/glacialArchive/Cutscene.jsx",
  "src/components/cinderIntro/CinderKit.js",
  "src/components/cinderIntro/ForgeGateScene.js",
  "src/components/cinderIntro/TitanScene.js",
  "src/components/cinderIntro/CinderShardScene.js",
  "src/components/realmCinematic/shard.js",
];
for (const rel of files) {
  let code = fs.readFileSync(path.join(root, rel), "utf8");
  code = code
    .replace(/@\/components\/glacialArchive\/Cutscene/g, "./Cutscene.js")
    .replace(/@\/components\/realmCinematic\/shard/g, "./shard.js")
    .replace(/from "\.\/CinderKit"/g, 'from "./CinderKit.js"');
  fs.writeFileSync(path.join(dir, path.basename(rel).replace(".jsx", ".js")), code);
}

const lum = (c) => (c ? 0.2126 * c.r + 0.7152 * c.g + 0.0722 * c.b : 0);
// three stores colours in linear space; measure perceived (sRGB) lightness
const lumHex = (hex) => {
  const n = parseInt(hex.replace("#", ""), 16);
  return lum(new THREE.Color().setHex(n).convertLinearToSRGB());
};

function classify(hit) {
  if (!hit) return { ch: ".", label: "EMPTY (sky shows through)" };
  const object = hit.object;
  const m = Array.isArray(object.material) ? object.material[0] : object.material;
  if (m?.type === "ShaderMaterial") return { ch: "s", label: `SHADER ${object.geometry?.type} (emissive look, not measured)` };
  const base = m?.color ? lumHex(`#${m.color.getHexString()}`) : 0;
  const glow = m?.emissive ? lumHex(`#${m.emissive.getHexString()}`) * (m.emissiveIntensity ?? 1) : 0;
  const lit = base * 0.85 + glow;
  const ch = lit < 0.05 ? "#" : lit < 0.12 ? "K" : lit < 0.24 ? "d" : "o";
  const hex = m?.color ? `#${m.color.getHexString()}` : "none";
  const emi = m?.emissive ? `#${m.emissive.getHexString()}x${(m.emissiveIntensity ?? 1).toFixed(2)}` : "-";
  return { ch, label: `${object.geometry?.type ?? object.type} ${m?.type} ${hex} em=${emi}` };
}

const COLS = 40;
const ROWS = 16;
const raycaster = new THREE.Raycaster();

async function probe(file, label, times) {
  const mod = await import(path.join(dir, file));
  const renderer = {
    getDrawingBufferSize: (v) => v.set(1280, 720),
    capabilities: { isWebGL2: true, maxTextureSize: 4096 },
    getRenderTarget() { return null; },
    setRenderTarget() {}, getContext() { return {}; }, compile() {}, dispose() {},
    domElement: makeCanvas(),
  };
  const api = mod.default({ renderer });
  const { scene, camera } = api;

  for (const time of times) {
    api.update?.(time, 0.016, { x: 0, y: 0 });
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    const legend = new Map();
    const rowsOut = [];
    for (let row = 0; row < ROWS; row++) {
      let line = "";
      for (let col = 0; col < COLS; col++) {
        const x = ((col + 0.5) / COLS) * 2 - 1;
        const y = 1 - ((row + 0.5) / ROWS) * 2;
        raycaster.setFromCamera({ x, y }, camera);
        const hits = raycaster.intersectObjects(scene.children, true);
        const solid = hits.find((hit) => {
          const m = Array.isArray(hit.object.material) ? hit.object.material[0] : hit.object.material;
          return m && m.side !== THREE.BackSide && !m.transparent;
        });
        const info = classify(solid);
        if (!legend.has(info.label)) legend.set(info.label, "ABCDEFGHIJKLMNOPQRSTUVWXYZ"[legend.size] ?? "?");
        line += info.ch === "." ? "." : info.ch;
      }
      rowsOut.push(line);
    }
    console.log(`\n===== ${label} @ t=${time}s  cam=[${camera.position.toArray().map((n) => n.toFixed(0)).join(",")}] =====`);
    console.log("  (# = near-black <4%, K = black 4-10%, d = dark 10-22%, o = lit, . = sky/empty)");
    rowsOut.forEach((line, i) => console.log(String(i).padStart(2) + " " + line.split("").join("")));
    console.log("  legend:");
    for (const [key, code] of legend.entries()) console.log(`    ${code}: ${key}`);
  }
}

await probe("ForgeGateScene.js", "FORGE GATE", [2, 8, 16]);
await probe("TitanScene.js", "TITAN", [2, 8, 16]);
await probe("CinderShardScene.js", "SHARD", [2, 8, 16]);