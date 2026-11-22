// The editor's viewport, drawn by the arena's own renderer. The game's WebGL
// world is loaded once, handed the builder's layout, and walked in first person
// — so the ground, the hills, the trees, the rocks and the houses are literally
// the ones the match shows, not an impression of them.
import { CELL, COLS, ROWS, monsterArt } from "@/lib/level3d";
import { WORLD } from "@/lib/customLevels";
import { buildArenaWorld } from "@/lib/arenaWorld";

// Versioned URLs: the arena scripts change often, and an unversioned /js/ URL can
// be answered from the browser's cache with an old renderer that still turns a
// builder's blocks into scenery.
const V = "26";
const SCRIPTS = [`/js/gl3d.js?v=${V}`, `/js/shaders3d.js?v=${V}`, `/js/render3d.js?v=${V}`];
const WALK = 340;      // units per second
const SPRINT = 660;
const REACH = 900;     // how far the crosshair can land a piece

const CLIMB = 900;     // units per second while flying up or down
const MAX_ALT = 1800;  // how far above the ground flight can go
const PIN_H = { monster: 108, chest: 56, gen: 50 };  // world height of each marker

let loader = null;

function loadEngine() {
  if (loader) return loader;
  window.__editorEngine = true;
  loader = SCRIPTS.reduce(
    (chain, src) =>
      chain.then(
        () =>
          new Promise((resolve, reject) => {
            const tag = document.createElement("script");
            tag.src = src;
            tag.async = false;
            tag.onload = () => resolve();
            tag.onerror = () => reject(new Error(`Could not load ${src}`));
            document.head.appendChild(tag);
          })
      ),
    Promise.resolve()
  );
  return loader;
}

export function createEditorScene(host, realmId) {
  const canvas = document.createElement("canvas");
  canvas.style.cssText = "position:absolute;inset:0;display:block;width:100%;height:100%";
  const pins = document.createElement("div");
  pins.style.cssText = "position:absolute;inset:0;overflow:hidden;pointer-events:none";
  host.appendChild(canvas);
  host.appendChild(pins);

  const state = {
    layout: null,
    realm: Number(realmId) || 1,
    px: WORLD.w * 0.5,
    py: WORLD.h * 0.72,
    yaw: -Math.PI / 2,
    pitch: 0.34,
    keys: {},
    tool: null,
    fly: false,
    alt: 0,
    altTo: 0,
    world: null,
    ready: false,
    time: 0,
    last: 0,
    raf: 0,
    cell: null,
    onCell: null,
    pins: [],
    disposed: false,
  };

  const terrainAt = (x, y) => {
    const W3 = window.W3;
    return W3 && W3.data ? W3.terrain(x, y) : 0;
  };

  const blocked = (x, y) => {
    const walls = state.world ? state.world.walls : [];
    for (let i = 0; i < walls.length; i++) {
      const w = walls[i];
      if (x > w.x - 18 && x < w.x + w.w + 18 && y > w.y - 18 && y < w.y + w.h + 18) return true;
    }
    return false;
  };

  const freeSpot = () => {
    const cx = WORLD.w / 2;
    const cy = WORLD.h * 0.75;
    for (let ring = 0; ring < 30; ring++) {
      for (let a = 0; a < 8; a++) {
        const x = cx + Math.cos((a / 8) * Math.PI * 2) * ring * 90;
        const y = cy + Math.sin((a / 8) * Math.PI * 2) * ring * 90;
        if (x < 120 || y < 120 || x > WORLD.w - 120 || y > WORLD.h - 120) continue;
        if (!blocked(x, y)) return { x, y };
      }
    }
    return { x: cx, y: cy };
  };

  // ---- placed things that the arena's static world cannot show -------------
  // Monsters and chests live outside the static mesh in the real game, so they
  // are pinned over the canvas where they were put, using the same artwork.
  function addPin(x, y, kind, art, glyph) {
    const el = document.createElement("div");
    el.style.cssText = "position:absolute;left:0;top:0;display:none;filter:drop-shadow(0 4px 10px rgba(0,0,0,0.85))";
    if (art) {
      const img = document.createElement("img");
      img.src = art;
      img.alt = "";
      img.draggable = false;
      // The artwork keeps its own proportions and stands on the ground, the way
      // the arena draws the same creature during a match.
      img.style.cssText = "display:block;width:100%;height:100%;object-fit:contain;object-position:50% 100%";
      el.appendChild(img);
    } else {
      el.textContent = glyph;
      el.style.color = kind === "chest" ? "#ffd479" : "#c07bff";
      el.style.textAlign = "center";
      el.style.lineHeight = "1";
    }
    pins.appendChild(el);
    state.pins.push({ el, x, y, kind, h: PIN_H[kind] || 100, glyph: !art });
  }

  function rebuildPins() {
    pins.innerHTML = "";
    state.pins = [];
    const L = state.layout || {};
    (L.monsters || []).slice(0, 220).forEach((m) => addPin(m.x, m.y, "monster", monsterArt(m.type), "✹"));
    (L.chests || []).slice(0, 220).forEach((c) => addPin(c.x, c.y, "chest", "", "▤"));
    (L.generators || []).slice(0, 120).forEach((g) => addPin(g.x, g.y, "gen", "", "◈"));
  }

  function syncLayout(layout) {
    state.layout = layout;
    state.world = buildArenaWorld(layout, state.realm);
    // Ask the renderer and the terrain builder for fresh meshes: the layout the
    // builder is editing has just changed under them.
    if (window.Render3D && window.Render3D.world) window.Render3D.world.key = "stale";
    if (window.W3) window.W3.key = "stale";
    rebuildPins();
  }

  // ---- where the crosshair is pointing ------------------------------------
  function pickGround() {
    const R = window.Render3D;
    if (!R || !R.ok || !R.cw) return null;
    const sx = R.cw / 2;
    const sy = R.ch / 2;
    let plane = 12;
    let hit = null;
    for (let i = 0; i < 5; i++) {
      const p = R.screenToWorld(sx, sy, plane);
      if (!p) break;
      hit = p;
      plane = terrainAt(p.x, p.y) + 6;
    }
    if (!hit) {
      hit = { x: state.px + Math.cos(state.yaw) * 260, y: state.py + Math.sin(state.yaw) * 260 };
    }
    return hit;
  }

  // The ray through the centre of the screen, taken straight from the camera
  // matrix: the two clip-space ends of the centre pixel, unprojected.
  function centreRay() {
    const R = window.Render3D;
    if (!R || !R.ok || !R.cw || !R.ivp) return null;
    const iv = R.ivp;
    const unp = (z) => {
      const w = iv[11] * z + iv[15];
      return {
        x: (iv[8] * z + iv[12]) / w,
        y: (iv[9] * z + iv[13]) / w,
        z: (iv[10] * z + iv[14]) / w,
      };
    };
    const a = unp(-1);
    const b = unp(1);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    const len = Math.hypot(dx, dy, dz) || 1;
    return { ox: a.x, oy: a.y, oz: a.z, dx: dx / len, dy: dy / len, dz: dz / len };
  }

  // The first block column the crosshair lands on, and the face it lands on: the
  // top (stack on it) or one of the four sides (build in the cell beside it).
  function blockHit(ray) {
    const blocks = state.world ? state.world.blocks : [];
    let best = null;
    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i];
      // A cube carries its own bottom and top, measured from the arena floor
      // exactly as the renderer draws it — so the crosshair lands on the cube
      // that is really under it. An older column is read as cubes from the floor.
      const bz0 = Math.max(0, Number(b.z0) || 0);
      const bz1 = b.z1 != null ? Number(b.z1) : bz0 + Math.max(1, Number(b.l) || 1) * 100;
      const lo = [b.x, bz0, b.y];
      const hi = [b.x + b.w, bz1, b.y + b.h];
      const o = [ray.ox, ray.oy, ray.oz];
      const d = [ray.dx, ray.dy, ray.dz];
      let tmin = 0;
      let tmax = 1e9;
      let axis = -1;
      let sign = 0;
      let miss = false;
      for (let k = 0; k < 3; k++) {
        if (Math.abs(d[k]) < 1e-6) {
          if (o[k] < lo[k] || o[k] > hi[k]) { miss = true; break; }
          continue;
        }
        let t1 = (lo[k] - o[k]) / d[k];
        let t2 = (hi[k] - o[k]) / d[k];
        let s = -1;
        if (t1 > t2) { const t = t1; t1 = t2; t2 = t; s = 1; }
        if (t1 > tmin) { tmin = t1; axis = k; sign = s; }
        if (t2 < tmax) tmax = t2;
        if (tmin > tmax) { miss = true; break; }
      }
      if (miss || axis < 0 || tmax < 0) continue;
      if (!best || tmin < best.t) best = { t: tmin, axis, sign, b, z0: bz0, z1: bz1 };
    }
    return best;
  }

  function cellAt() {
    const ray = centreRay();
    const hit = ray ? blockHit(ray) : null;
    if (hit) {
      const b = hit.b;
      const bx = Math.floor(b.x / CELL);
      const by = Math.floor(b.y / CELL);
      // the exact cube under the crosshair: its footprint and its height band
      const cube = { x: b.x, y: b.y, w: b.w, h: b.h, z0: hit.z0, z1: hit.z1 };
      const level = Math.max(1, Math.min(5, Math.round(hit.z1 / CELL) || 1));
      const reach = Math.hypot(b.x + b.w / 2 - state.px, b.y + b.h / 2 - state.py);
      if (reach <= REACH) {
        // The top face stacks a cube on this one. A side face places a cube
        // beside it, at this cube's own height — never a column beneath it —
        // and erasing always takes the cube that was aimed at.
        if (hit.axis === 1 || (state.tool && state.tool.id === "erase")) {
          return { cx: bx, cy: by, level, aim: { x: b.x, y: b.y, z: hit.z1 }, hit: cube };
        }
        const nx = bx + (hit.axis === 0 ? hit.sign : 0);
        const ny = by + (hit.axis === 2 ? hit.sign : 0);
        if (nx >= 0 && ny >= 0 && nx < COLS && ny < ROWS) {
          return {
            cx: nx,
            cy: ny,
            level,
            aim: {
              x: b.x + (hit.axis === 0 ? hit.sign * b.w : 0),
              y: b.y + (hit.axis === 2 ? hit.sign * b.h : 0),
              z: hit.z0,
            },
            hit: cube,
          };
        }
      }
    }
    const ground = pickGround();
    if (!ground) return null;
    const reach = Math.hypot(ground.x - state.px, ground.y - state.py);
    const x = Math.max(40, Math.min(WORLD.w - 40, ground.x));
    const y = Math.max(40, Math.min(WORLD.h - 40, ground.y));
    return {
      cx: Math.floor(x / CELL),
      cy: Math.floor(y / CELL),
      aim: { x, y, z: 0 },
      hit: null,
      far: reach > REACH,
    };
  }

  // ---- the frame loop -----------------------------------------------------
  let crash = false;
  function loop(now) {
    if (state.disposed) return;
    state.raf = requestAnimationFrame(loop);
    if (crash) return;
    try {
      step(now);
    } catch (err) {
      crash = true;
      console.error("The arena renderer stopped:", err);
      host.dispatchEvent(
        new CustomEvent("engine-failed", { detail: err?.message || "The arena renderer stopped." })
      );
    }
  }

  function step(now) {
    const R = window.Render3D;
    if (!R || !R.ok || !state.ready) return;
    if (!state.world) state.world = buildArenaWorld(state.layout || {}, state.realm);

    const dt = Math.min(0.05, state.last ? (now - state.last) / 1000 : 0.016);
    state.last = now;
    state.time += dt;

    const k = state.keys;
    // Flight: hold up or down to climb or sink. Turning it off settles the
    // builder back onto the ground.
    if (!state.fly) state.altTo = 0;
    else {
      if (k.up) state.altTo = Math.min(MAX_ALT, state.altTo + CLIMB * dt);
      if (k.down) state.altTo = Math.max(0, state.altTo - CLIMB * dt);
    }
    state.alt += (state.altTo - state.alt) * Math.min(1, dt * 10);
    let fx = 0;
    let fz = 0;
    if (k.f) fz += 1;
    if (k.b) fz -= 1;
    if (k.l) fx -= 1;
    if (k.r) fx += 1;
    if (fx || fz) {
      const len = Math.hypot(fx, fz) || 1;
      const speed = (k.sprint ? SPRINT : WALK) * dt;
      const cosY = Math.cos(state.yaw);
      const sinY = Math.sin(state.yaw);
      const dx = ((fx * 1) / len) * speed;
      const dz = ((fz * 1) / len) * speed;
      const nx = state.px + cosY * dz - sinY * dx;
      const ny = state.py + sinY * dz + cosY * dx;
      if (state.fly) {
        // In flight nothing on the ground stops you: walls and rooftops pass
        // underneath.
        state.px = Math.max(60, Math.min(WORLD.w - 60, nx));
        state.py = Math.max(60, Math.min(WORLD.h - 60, ny));
      } else {
        if (!blocked(nx, state.py)) state.px = Math.max(60, Math.min(WORLD.w - 60, nx));
        if (!blocked(state.px, ny)) state.py = Math.max(60, Math.min(WORLD.h - 60, ny));
      }
    }

    R.cam.mode = "tps";
    R.cam.fp = true;
    R.cam.tyaw = state.yaw;
    R.cam.tpitch = state.pitch;
    R.cam.kick = 0;
    R.resize(host.clientWidth, host.clientHeight, window.devicePixelRatio || 1);

    const z = terrainAt(state.px, state.py) + state.alt;
    R.frame({
      t: state.time,
      dt,
      theme: { id: state.realm },
      world: state.world,
      cam: { x: state.px, y: state.py, sx: 0, sy: 0, shake: 0 },
      me: { x: state.px, y: state.py, z },
      idle: false,
    });

    // pins over the canvas
    for (let i = 0; i < state.pins.length; i++) {
      const pin = state.pins[i];
      const ground = terrainAt(pin.x, pin.y);
      const base = R.w2s(pin.x, pin.y, ground);
      const top = R.w2s(pin.x, pin.y, ground + pin.h);
      if (!base || !top || base.w <= 0) { pin.el.style.display = "none"; continue; }
      // Project the creature's own height and use it as the marker's height, so
      // a placed monster stands in the map at the size it really is.
      const size = Math.max(10, Math.min(340, Math.abs(base.y - top.y)));
      pin.el.style.display = "block";
      pin.el.style.width = `${size}px`;
      pin.el.style.height = `${size}px`;
      pin.el.style.fontSize = `${Math.round(size * 0.9)}px`;
      pin.el.style.transform =
        `translate3d(${Math.round(base.x)}px,${Math.round(base.y)}px,0) translate(-50%,-100%)`;
      pin.el.style.opacity = base.w > 900 ? "0.6" : "1";
    }

    const c = cellAt();
    // the height the crosshair is on belongs to the target too, so moving from
    // the bottom of a stack to the cube above it is reported
    const key = c ? `${c.cx}:${c.cy}:${Math.round((c.aim && c.aim.z) || 0)}` : "";
    if (key !== state.cellKey) {
      state.cellKey = key;
      state.cell = c;
      state.onCell?.(c);
    }
  }

  const instance = {
    syncLayout,
    setTool(tool) {
      state.tool = tool || null;
    },
    setFly(on) {
      state.fly = Boolean(on);
      state.altTo = state.fly ? Math.max(state.altTo, 240) : 0;
      if (!state.fly) state.alt = 0;
    },
    isFlying() {
      return state.fly;
    },
    onCell(cb) {
      state.onCell = cb;
    },
    setInput(partial) {
      Object.assign(state.keys, partial);
    },
    look(dx, dy) {
      state.yaw += dx * 0.0045;
      state.pitch = Math.max(-1.2, Math.min(1.25, state.pitch + dy * 0.0045));
    },
    placeCell() {
      return cellAt();
    },
    setRealm(id) {
      state.realm = Number(id) || 1;
      if (state.layout) syncLayout(state.layout);
      const spot = freeSpot();
      state.px = spot.x;
      state.py = spot.y;
    },
    // Where the builder stands, so a saved level can drop the player in
    // somewhere sensible; and the height under their feet.
    position() {
      return { x: state.px, y: state.py, z: terrainAt(state.px, state.py) };
    },
    dispose() {
      state.disposed = true;
      cancelAnimationFrame(state.raf);
      canvas.remove();
      pins.remove();
    },
  };

  loadEngine()
    .then(() => {
      if (state.disposed) return;
      const R = window.Render3D;
      if (!R) throw new Error("The arena renderer did not load.");
      R.init(canvas);
      if (!R.ok) throw new Error("WebGL 2 is unavailable in this browser.");
      R.setQuality("medium");
      state.ready = true;
      if (state.layout) syncLayout(state.layout);
      const spot = freeSpot();
      state.px = spot.x;
      state.py = spot.y;
      state.raf = requestAnimationFrame(loop);
    })
    .catch((err) => {
      console.error("The arena renderer could not start:", err);
      host.dispatchEvent(new CustomEvent("engine-failed", { detail: err?.message || "WebGL 2 is unavailable." }));
    });

  return instance;
}