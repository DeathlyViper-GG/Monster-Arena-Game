// Occlusion probe: rebuilds the real Cinder scenes headlessly (no WebGL) and
// raycasts a grid of screen points to report exactly which object owns each
// pixel, with its material colour. Run: node scripts/occlusion_probe.mjs
import fs from "node:fs";
import path from "node:path";
import * as THREE from "three";

/* ── DOM / GPU stubs so the scene builders can run in node ── */
function makeCanvas() {
  const canvas = { width: 1, height: 1 };
  const gradient = { addColorStop() {} };
  const ctx = {
    createImageData: (w, h) => ({ data: new Uint8ClampedArray(w * h * 4), width: w, height: h }),
    putImageData() {},
    createRadialGradient: () => gradient,
    createLinearGradient: () => gradient,
    fillRect() {},
    clearRect() {},
    beginPath() {},
    arc() {},
    ellipse() {},
    moveTo() {},
    lineTo() {},
    quadraticCurveTo() {},
    closePath() {},
    fill() {},
    stroke() {},
    save() {},
    restore() {},
    clip() {},
    translate() {},
    rotate() {},
    drawImage() {},
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

/* ── copy the real scene sources into a temp dir with relative imports ── */
const root = process.cwd();
const dir = path.join(root, "scripts", ".probe_tmp");
fs.mkdirSync(dir, { recursive: true });
const files = [
  "src/components/glacialArchive/Cutscene.jsx",
  "src/components/cinderIntro/CinderKit.js",
  "src/components/cinderIntro/ForgeGateScene.js",
  "src/components/cinderIntro/TitanScene.js",
  "src/components/cinderIntro/CinderShardScene.js",
];
for (const rel of files) {
  let code = fs.readFileSync(path.join(root, rel), "utf8");
  code = code
    .replace(/@\/components\/glacialArchive\/Cutscene/g, "./Cutscene.js")
    .replace(/from "\.\/CinderKit"/g, 'from "./CinderKit.js"');
  fs.writeFileSync(path.join(dir, path.basename(rel).replace(".jsx", ".js")), code);
}

const describe = (object) => {
  if (!object) return "EMPTY";
  const material = Array.isArray(object.material) ? object.material[0] : object.material;
  const colour = material?.color ? `#${material.color.getHexString()}` : "none";
  const geom = object.geometry?.type ?? object.type;
  const blend = material?.blending === THREE.AdditiveBlending ? "ADD" : material?.transparent ? "TRA" : "OPQ";
  const alphaTest = material?.opacity;
  return `${geom}|${material?.type ?? "?"}|${colour}|${blend}|op=${alphaTest}`;
};

async function probe(file, label) {
  const mod = await import(path.join(dir, file));
  const build = mod.default;
  const renderer = {
    getDrawingBufferSize: (v) => v.set(1280, 720),
    capabilities: { isWebGL2: true, maxTextureSize: 4096 },
    getRenderTarget() { return null; },
    setRenderTarget() {},
    getContext() { return {}; },
    compile() {},
    dispose() {},
    domElement: makeCanvas(),
  };
  const api = build({ renderer });
  const { scene, camera } = api;

  const COLS = 37;
  const ROWS = 19;
  const raycaster = new THREE.Raycaster();
  const results = [];
  const legend = new Map();
  const codeFor = (key) => {
    if (!legend.has(key)) legend.set(key, String.fromCharCode(65 + legend.size));
    return legend.get(key);
  };
  const legend2 = new Map();
  const codeFor2 = (key) => {
    if (!legend2.has(key)) legend2.set(key, "abcdefghijklmnopqrstuvwxyz0123456789"[legend2.size] ?? "?");
    return legend2.get(key);
  };

  for (const time of [1, 6, 11, 16]) {
    api.update?.(time, 0.016, { x: 0, y: 0 });
    camera.updateProjectionMatrix();
    camera.updateMatrixWorld(true);
    console.log(`\n[camera t=${time}] pos=${camera.position.toArray().map((n) => n.toFixed(1)).join(",")}`);
    const grid = [];
    const gridT = [];
    for (let row = 0; row < ROWS; row++) {
      const line = [];
      const lineT = [];
      for (let col = 0; col < COLS; col++) {
        const x = ((col + 0.5) / COLS) * 2 - 1;
        const y = 1 - ((row + 0.5) / ROWS) * 2;
        raycaster.setFromCamera({ x, y }, camera);
        const hits = raycaster.intersectObjects(scene.children, true);
        const solid = hits.filter((hit) => {
          const m = Array.isArray(hit.object.material) ? hit.object.material[0] : hit.object.material;
          // the sky dome, additive atmosphere and haze are not what blocks a view
          return m && m.side !== THREE.BackSide && !m.transparent;
        });
        const first = solid[0];
        const key = `${describe(first?.object)}|d=${first ? Math.round(first.distance) : 0}`;
        line.push(codeFor(key));

        // second pass: nearest hit of ANY kind (transparent layers included),
        // which is what actually tints / blocks the pixel on screen
        const anyHit = hits.find((hit) => {
          const m = Array.isArray(hit.object.material) ? hit.object.material[0] : hit.object.material;
          return m && m.side !== THREE.BackSide;
        });
        lineT.push(
          codeFor2(`${describe(anyHit?.object)}|d=${anyHit ? Math.round(anyHit.distance) : 0}`),
        );
        if (col === Math.floor(COLS / 2) && row === Math.floor(ROWS / 2)) {
          results.push({
            time,
            centre: key,
            stack: hits.slice(0, 5).map(
              (h) =>
                `${describe(h.object)}@${h.distance.toFixed(1)} at [${h.point
                  .toArray()
                  .map((n) => n.toFixed(0))
                  .join(",")}] parent=${h.object.parent?.type}`,
            ),
          });
        }
      }
      grid.push(line);
      gridT.push(lineT);
    }
    console.log(`\n===== ${label} @ t=${time}s (opaque) =====`);
    console.log(grid.map((line) => line.join(" ")).join("\n"));
    console.log("legend:");
    for (const [key, code] of legend.entries()) console.log(`  ${code}: ${key}`);
    console.log(`\n----- ${label} @ t=${time}s (ANY hit, transparent included) -----`);
    console.log(gridT.map((line) => line.join(" ")).join("\n"));
    console.log("legend:");
    for (const [key, code] of legend2.entries()) console.log(`  ${code}: ${key}`);
  }

  console.log(`\n===== ${label} CENTRE RAYS =====`);
  for (const entry of results) {
    console.log(`t=${entry.time}  FIRST-OPAQUE: ${entry.centre}`);
    entry.stack.forEach((s) => console.log(`    hit ${s}`));
  }
  const counts = new Map();
  for (const entry of results) counts.set(entry.centre, (counts.get(entry.centre) || 0) + 1);
  console.log("\ncentre tally:", [...counts.entries()]);
}

await probe("ForgeGateScene.js", "FORGE GATE");