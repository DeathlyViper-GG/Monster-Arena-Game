import "/tmp/diag/canvas-stub.js";
import * as THREE from "three";

const which = process.argv[2] || "forge";
const mods = {
  forge: () => import("/tmp/diag/bundle-forge.mjs"),
  titan: () => import("/tmp/diag/bundle-titan.mjs"),
  shard: () => import("/tmp/diag/bundle-shard.mjs"),
};
const { default: build } = await mods[which]();
const fakeRenderer = { capabilities: {}, getRenderTarget() {}, setRenderTarget() {} };
const { scene, camera, update } = build({ renderer: fakeRenderer });
const tList = which === "forge" ? [0.2, 6] : [0.2, 2];
for (const t of tList) {
  update(t, 0.016, { x: 0, y: 0 });
  camera.updateMatrixWorld(true);
  const rows = [];
  scene.traverse((o) => {
    if (!(o.isMesh || o.isSprite)) return;
    if (o.material?.transparent) return;
    const box = new THREE.Box3();
    if (o.isSprite) box.setFromCenterAndSize(o.getWorldPosition(new THREE.Vector3()), new THREE.Vector3(o.scale.x, o.scale.y, 1));
    else { if (!o.geometry?.attributes?.position) return; box.setFromObject(o); }
    if (!isFinite(box.min.x)) return;
    let minX = 9, maxX = -9, minY = 9, maxY = -9;
    for (const x of [box.min.x, box.max.x]) for (const y of [box.min.y, box.max.y]) for (const z of [box.min.z, box.max.z]) {
      const p = new THREE.Vector3(x, y, z).project(camera);
      minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x);
      minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y);
    }
    minX = Math.max(-1, minX); maxX = Math.min(1, maxX);
    minY = Math.max(-1, minY); maxY = Math.min(1, maxY);
    const w = (maxX - minX) / 2, h = (maxY - minY) / 2;
    if (w <= 0.005 || h <= 0.005) return;
    const lum = o.material?.color ? o.material.color.r * 0.3 + o.material.color.g * 0.6 + o.material.color.b * 0.1 : -1;
    rows.push({ area: Math.round(w * h * 10000) / 100, w: Math.round(w * 100), h: Math.round(h * 100), cx: Math.round(((maxX + minX) / 2) * 100), cy: Math.round(((maxY + minY) / 2) * 100), geo: o.geometry?.type, mat: o.material?.type, col: o.material?.color ? "#" + o.material.color.getHexString() : "-", lum: Math.round(lum * 1000) / 1000, d: Math.round(camera.position.distanceTo(box.getCenter(new THREE.Vector3()))) });
  });
  rows.sort((a, b) => b.area - a.area);
  console.log(`\n===== ${which} t=${t} =====`);
  for (const r of rows.slice(0, 12)) console.log(JSON.stringify(r));
}
