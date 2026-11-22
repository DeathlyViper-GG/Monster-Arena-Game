import React, { useEffect, useRef, useState } from "react";
import { BLOCK_MAX_Z, CELL, WORLD, clampBlockSize, cubesOf } from "@/lib/level3d";
import { createEditorScene } from "./engineStage";

const MAX = { trees: 400, hills: 200, monsters: 220, hazards: 160, chests: 220, generators: 80, blocks: 1200, obstacles: 500, buildings: 120 };

const overlap = (a, x, y, w, h) => x < a.x + a.w && a.x < x + w && y < a.y + a.h && a.y < y + h;

function clone(layout) {
  return JSON.parse(JSON.stringify(layout));
}

// Applies the equipped tool to the looked-at cell. Returns the new layout, or
// null when that cell cannot take the piece.
export function placePiece(layout, tool, cell) {
  if (!cell || !tool) return null;
  const x = cell.cx * CELL;
  const y = cell.cy * CELL;
  const cx = x + CELL / 2;
  const cy = y + CELL / 2;
  const next = clone(layout);

  // Erasing lifts out the exact cube the crosshair is on — the rest of the stack
  // stays where it is; everything else in the cell goes at once.
  if (tool.id === "erase") {
    const cube = cell.hit;
    if (cube) {
      const cubes = cubesOf(next.blocks);
      const rest = cubes.filter(
        (c) => !(c.x === cube.x && c.y === cube.y && c.z === cube.z0 && c.s === cube.w)
      );
      if (rest.length === cubes.length) return null;
      next.blocks = rest;
      return next;
    }
    // A house comes down whole: it is one building, not a stack of blocks.
    const house = next.buildings.find((b) => overlap(b, x, y, CELL, CELL));
    if (house) {
      next.buildings = next.buildings.filter((b) => b !== house);
      return next;
    }
    const before = JSON.stringify(next);
    const inCell = (p) => p.x >= x && p.x < x + CELL && p.y >= y && p.y < y + CELL;
    next.obstacles = next.obstacles.filter((o) => !overlap(o, x, y, CELL, CELL));
    next.blocks = cubesOf(next.blocks).filter(
      (c) => !overlap({ x: c.x, y: c.y, w: c.s, h: c.s }, x, y, CELL, CELL)
    );
    next.hills = next.hills.filter(
      (q) => !(q.x >= x - CELL / 2 && q.x < x + CELL * 1.5 && q.y >= y - CELL / 2 && q.y < y + CELL * 1.5)
    );
    ["trees", "chests", "generators", "hazards", "monsters"].forEach((key) => {
      next[key] = next[key].filter((p) => !inCell(p));
    });
    return JSON.stringify(next) === before ? null : next;
  }

  // A hill is terrain, not a rock: it lifts the ground under it, and both the
  // arena's renderer and the player's feet follow that height.
  if (tool.id === "hill") {
    if (next.hills.length >= MAX.hills) return null;
    next.hills.push({ x: cx, y: cy, r: 210, h: 165 });
    return next;
  }

  if (tool.id === "rock") {
    if (next.obstacles.length >= MAX.obstacles) return null;
    if (next.obstacles.some((o) => overlap(o, x - CELL * 0.2, y - CELL * 0.2, CELL * 1.4, CELL * 1.4))) return null;
    next.obstacles.push({ x: x + CELL * 0.2, y: y + CELL * 0.2, w: CELL * 1.1, h: CELL * 0.9 });
    return next;
  }

  // The block tool lays one cube on the face being looked at: the top face
  // stacks a cube on the one below, a side face puts a cube beside it at that
  // cube's own height — nothing is filled in underneath. The cube's edge length
  // is the size chosen in the rail, and its material the one picked there.
  if (tool.id === "block") {
    const mat = tool.mat || "stone";
    const size = clampBlockSize(tool.size);
    const aim = cell.aim || { x: cell.cx * CELL, y: cell.cy * CELL, z: 0 };
    const snap = (v) => Math.round((Number(v) || 0) / size) * size;
    const bx = snap(aim.x);
    const by = snap(aim.y);
    let bz = Math.max(0, Math.min(BLOCK_MAX_Z, snap(aim.z)));
    // Building against the side of a raised cube must never drop back to the
    // floor: when the aimed cube sits above the ground, the new cube joins it at
    // that height, so the space underneath stays open.
    const aimed = cell.hit;
    if (aimed && Number(aimed.z0) > 0 && bz === 0) {
      bz = Math.max(0, Math.min(BLOCK_MAX_Z, snap(aimed.z0)));
    }
    if (bx < 0 || by < 0 || bx + size > WORLD.w || by + size > WORLD.h) return null;
    next.blocks = cubesOf(next.blocks);
    const same = next.blocks.find((c) => c.x === bx && c.y === by && c.z === bz && c.s === size);
    if (same) {
      // tapping a block that is already there only re-skins it
      if (same.mat === mat) return null;
      same.mat = mat;
      return next;
    }
    if (next.blocks.length >= MAX.blocks) return null;
    // a block cannot be laid inside a rock formation — it would vanish under it
    if (next.obstacles.some((o) => overlap(o, bx, by, size, size))) return null;
    next.blocks.push({ x: bx, y: by, z: bz, s: size, mat });
    return next;
  }

  // A house is its own kind of piece — four walls, a doorway and one to three
  // storeys — never a stack of blocks. The arena's own building renderer draws
  // it, so a house placed here looks exactly like a house in play.
  if (tool.id === "building") {
    if (next.buildings.length >= MAX.buildings) return null;
    const bw = CELL * 2;
    const bh = CELL * 2;
    if (x < 40 || y < 40 || x + bw > WORLD.w - 40 || y + bh > WORLD.h - 40) return null;
    // its whole footprint has to be free: no blocks, rock or another house there
    const pad = CELL * 0.3;
    if (next.buildings.some((b) => overlap(b, x - pad, y - pad, bw + pad * 2, bh + pad * 2))) return null;
    if (cubesOf(next.blocks).some((c) => overlap({ x: c.x, y: c.y, w: c.s, h: c.s }, x, y, bw, bh))) return null;
    if (next.obstacles.some((o) => overlap(o, x, y, bw, bh))) return null;
    next.buildings.push({ x, y, w: bw, h: bh, floors: Math.max(1, Math.min(3, Number(tool.floors) || 2)) });
    return next;
  }

  if (tool.id === "decor") {
    if (next.trees.length >= MAX.trees) return null;
    if (next.trees.some((t) => Math.hypot(t.x - cx, t.y - cy) < CELL * 0.6)) return null;
    next.trees.push({ x: cx, y: cy, kind: tool.kind || "tree" });
    return next;
  }

  if (tool.id === "chest") {
    if (next.chests.length >= MAX.chests) return null;
    next.chests.push({ x: cx, y: cy, rarity: tool.rarity || "rare" });
    return next;
  }

  if (tool.id === "generator") {
    if (next.generators.length >= MAX.generators) return null;
    next.generators.push({ x: cx, y: cy, count: Number(tool.count) || 3 });
    return next;
  }

  if (tool.id === "hazard") {
    if (next.hazards.length >= MAX.hazards) return null;
    next.hazards.push({ x: cx, y: cy, kind: tool.kind || "sand" });
    return next;
  }

  if (tool.id === "monster") {
    if (next.monsters.length >= MAX.monsters) return null;
    next.monsters.push({ x: cx, y: cy, type: tool.type || "chaser" });
    return next;
  }

  return null;
}

// The viewport: the 3D arena filling the screen, with the crosshair, the walk
// pad and a place button. Drag to look, walk with the keys or the pad.
export default function EditorView({ layout, tool, realmId, onChange, onHover, onUnavailable }) {
  const host = useRef(null);
  const scene = useRef(null);
  const live = useRef(layout);
  const equipped = useRef(tool);
  const gesture = useRef(null);
  const placeRef = useRef(() => {});
  const [cell, setCell] = useState(null);
  const [flying, setFlying] = useState(false);

  useEffect(() => {
    let instance = null;
    const node = host.current;
    // The arena renderer reports its own failure (no WebGL 2, for instance).
    const fail = (e) => onUnavailable?.(e.detail);
    node.addEventListener("engine-failed", fail);
    try {
      instance = createEditorScene(node, realmId);
      instance.syncLayout(live.current);
      instance.setTool(equipped.current);
      instance.onCell((c) => {
        setCell(c);
        onHover?.(c);
      });
    } catch (err) {
      console.error("3D editor could not start:", err);
      onUnavailable?.(err?.message || "The 3D view could not start in this browser.");
      return undefined;
    }
    scene.current = instance;
    return () => {
      node.removeEventListener("engine-failed", fail);
      scene.current = null;
      instance.dispose();
    };
    // Mounted once: realm, tool and layout are pushed in by the effects below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => { live.current = layout; }, [layout]);
  useEffect(() => { equipped.current = tool; }, [tool]);
  useEffect(() => {
    try {
      scene.current?.syncLayout(layout);
    } catch (err) {
      console.error("3D editor could not draw the map:", err);
    }
  }, [layout]);
  useEffect(() => { scene.current?.setTool(tool); }, [tool]);
  useEffect(() => { scene.current?.setRealm(realmId); }, [realmId]);

  const place = (target) => {
    const next = placePiece(live.current, equipped.current, target);
    if (!next) return;
    live.current = next;
    onChange(next);
  };
  useEffect(() => { placeRef.current = place; });

  useEffect(() => {
    const DIRS = {
      KeyW: "f", ArrowUp: "f",
      KeyS: "b", ArrowDown: "b",
      KeyA: "l", ArrowLeft: "l",
      KeyD: "r", ArrowRight: "r",
    };
    const LIFT = { KeyQ: "up", KeyE: "down" };
    const typing = (e) => {
      const tag = (e.target?.tagName || "").toUpperCase();
      return tag === "INPUT" || tag === "SELECT" || tag === "TEXTAREA";
    };
    const onDown = (e) => {
      if (typing(e)) return;
      if (e.key === "Shift") { scene.current?.setInput({ sprint: true }); return; }
      if (e.code === "Space" || e.code === "Enter") {
        e.preventDefault();
        placeRef.current(scene.current?.placeCell());
        return;
      }
      const dir = DIRS[e.code] || LIFT[e.code];
      if (!dir) return;
      e.preventDefault();
      scene.current?.setInput({ [dir]: true });
    };
    const onUp = (e) => {
      if (e.key === "Shift") { scene.current?.setInput({ sprint: false }); return; }
      const dir = DIRS[e.code] || LIFT[e.code];
      if (dir) scene.current?.setInput({ [dir]: false });
    };
    window.addEventListener("keydown", onDown);
    window.addEventListener("keyup", onUp);
    return () => {
      window.removeEventListener("keydown", onDown);
      window.removeEventListener("keyup", onUp);
    };
  }, []);

  const onPointerDown = (e) => {
    gesture.current = { x: e.clientX, y: e.clientY, moved: false };
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };

  const onPointerMove = (e) => {
    const g = gesture.current;
    if (!g) return;
    const dx = e.clientX - g.x;
    const dy = e.clientY - g.y;
    if (!g.moved && Math.hypot(dx, dy) > 7) g.moved = true;
    if (!g.moved) return;
    g.x = e.clientX;
    g.y = e.clientY;
    scene.current?.look(dx, dy);
  };

  const onPointerUp = () => {
    const g = gesture.current;
    gesture.current = null;
    if (g && !g.moved) place(scene.current?.placeCell());
  };

  const hold = (dir) => ({
    onPointerDown: (e) => { e.preventDefault(); scene.current?.setInput({ [dir]: true }); },
    onPointerUp: () => scene.current?.setInput({ [dir]: false }),
    onPointerLeave: () => scene.current?.setInput({ [dir]: false }),
    onPointerCancel: () => scene.current?.setInput({ [dir]: false }),
  });

  const toggleFly = () => {
    const next = !flying;
    setFlying(next);
    scene.current?.setFly(next);
  };

  const padBtn =
    "flex h-10 w-10 items-center justify-center rounded-lg border border-white/25 bg-black/50 text-sm font-bold text-white backdrop-blur transition active:border-primary";

  return (
    <>
      <div
        ref={host}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={() => { gesture.current = null; }}
        onContextMenu={(e) => e.preventDefault()}
        className="absolute inset-0 cursor-crosshair touch-none select-none"
      />

      <div className="pointer-events-none absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-xl font-bold text-white/70">
        +
      </div>

      <div className="absolute bottom-4 left-4 flex items-end gap-2">
        <div className="flex flex-col gap-1">
          <button
            type="button"
            onClick={toggleFly}
            title="Fly over the map (Q up, E down)"
            className={
              "flex h-10 items-center justify-center rounded-lg border px-2 text-[11px] font-black uppercase tracking-wider backdrop-blur transition " +
              (flying ? "border-primary bg-primary/25 text-primary" : "border-white/25 bg-black/50 text-white")
            }
          >
            ✈ Fly
          </button>
          {flying && (
            <>
              <button type="button" className={padBtn} {...hold("up")}>↑</button>
              <button type="button" className={padBtn} {...hold("down")}>↓</button>
            </>
          )}
        </div>
        <div className="grid grid-cols-3 grid-rows-2 gap-1">
          <span />
          <button type="button" className={padBtn} {...hold("f")}>▲</button>
          <span />
          <button type="button" className={padBtn} {...hold("l")}>◀</button>
          <button type="button" className={padBtn} {...hold("b")}>▼</button>
          <button type="button" className={padBtn} {...hold("r")}>▶</button>
        </div>
      </div>

      <button
        type="button"
        onClick={() => place(scene.current?.placeCell())}
        className="absolute bottom-5 left-1/2 -translate-x-1/2 rounded-xl border border-primary bg-primary px-7 py-2.5 text-sm font-black uppercase tracking-widest text-primary-foreground shadow-[0_0_30px_rgba(34,230,255,0.45)]"
      >
        Place
      </button>

      <div className="pointer-events-none absolute bottom-4 right-4 rounded-lg bg-black/55 px-3 py-1.5 text-[11px] font-semibold text-white/70 backdrop-blur">
        {cell
          ? `cell ${cell.cx + 1}, ${cell.cy + 1}${cell.aim && cell.aim.z ? ` · height ${Math.round(cell.aim.z)}` : ""}`
          : "aim at the floor"}
      </div>
    </>
  );
}