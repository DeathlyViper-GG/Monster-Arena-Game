import React, { useRef, useState } from "react";
import { WORLD } from "@/lib/customLevels";

// A 40 × 28 arena grid. One cell is 100 world units; a building takes a 2 × 2
// block so it has room for walls, a doorway and a chest inside.
const COLS = WORLD.w / WORLD.cell;
const ROWS = WORLD.h / WORLD.cell;

function pct(v, total) {
  return (v / total) * 100;
}

export default function MapGrid({ layout, tool, brush, onChange }) {
  const [painting, setPainting] = useState(false);
  const boxRef = useRef(null);

  const cellAt = (e) => {
    const box = boxRef.current;
    if (!box) return null;
    const r = box.getBoundingClientRect();
    const cx = Math.floor(((e.clientX - r.left) / r.width) * COLS);
    const cy = Math.floor(((e.clientY - r.top) / r.height) * ROWS);
    if (cx < 0 || cy < 0 || cx >= COLS || cy >= ROWS) return null;
    return { cx, cy };
  };

  const paint = (cell) => {
    if (!cell) return;
    const x = cell.cx * WORLD.cell;
    const y = cell.cy * WORLD.cell;
    const next = {
      obstacles: layout.obstacles.slice(),
      buildings: layout.buildings.slice(),
      chests: layout.chests.slice(),
      generators: layout.generators.slice(),
    };
    const hits = (item, w, h) =>
      x < item.x + w && x + WORLD.cell > item.x && y < item.y + h && y + WORLD.cell > item.y;

    if (tool === "erase") {
      ["obstacles", "buildings", "generators"].forEach((k) => {
        next[k] = next[k].filter((it) => !hits(it, it.w || 1, it.h || 1));
      });
      next.chests = next.chests.filter((c) => !hits(c, 1, 1));
      onChange(next);
      return;
    }

    // one item per cell for the point tools, so a drag cannot stack duplicates
    const occupied = (list) => list.some((c) => hits(c, 1, 1));

    if (tool === "obstacle") {
      if (occupied(next.obstacles) || occupied(next.chests) || occupied(next.buildings)) return;
      next.obstacles.push({ x, y, w: WORLD.cell, h: WORLD.cell });
    } else if (tool === "building") {
      const bw = WORLD.cell * 2;
      if (x + bw > WORLD.w || y + bw > WORLD.h) return;
      if (occupied(next.obstacles) || occupied(next.buildings) || occupied(next.generators)) return;
      next.buildings.push({ x, y, w: bw, h: bw, floors: Math.max(1, Math.min(3, Number(brush.floors) || 2)) });
    } else if (tool === "chest") {
      if (occupied(next.obstacles) || occupied(next.buildings) || occupied(next.chests)) return;
      next.chests.push({ x: x + WORLD.cell / 2, y: y + WORLD.cell / 2, rarity: brush.rarity || "rare" });
    } else if (tool === "generator") {
      if (occupied(next.obstacles) || occupied(next.buildings) || occupied(next.generators)) return;
      next.generators.push({ x: x + WORLD.cell / 2, y: y + WORLD.cell / 2, count: brush.count || 3 });
    }
    onChange(next);
  };

  const onDown = (e) => {
    e.preventDefault();
    setPainting(true);
    paint(cellAt(e));
  };
  const onMove = (e) => {
    if (!painting) return;
    paint(cellAt(e));
  };
  const stop = () => setPainting(false);

  return (
    <div
      ref={boxRef}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={stop}
      onPointerLeave={stop}
      className="relative w-full overflow-hidden rounded-xl border border-border bg-secondary/40 select-none touch-none"
      style={{ aspectRatio: `${WORLD.w} / ${WORLD.h}` }}
    >
      <div
        className="absolute inset-0 opacity-40"
        style={{
          backgroundImage:
            "linear-gradient(to right, hsl(var(--border)) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--border)) 1px, transparent 1px)",
          backgroundSize: `${100 / COLS}% ${100 / ROWS}%`,
        }}
      />
      {layout.buildings.map((b, i) => (
        <div
          key={`b${i}`}
          className="absolute rounded-sm border-2 border-primary/70 bg-primary/15"
          style={{
            left: `${pct(b.x, WORLD.w)}%`,
            top: `${pct(b.y, WORLD.h)}%`,
            width: `${pct(b.w, WORLD.w)}%`,
            height: `${pct(b.h, WORLD.h)}%`,
          }}
        />
      ))}
      {layout.obstacles.map((o, i) => (
        <div
          key={`o${i}`}
          className="absolute rounded-sm bg-foreground/60"
          style={{
            left: `${pct(o.x, WORLD.w)}%`,
            top: `${pct(o.y, WORLD.h)}%`,
            width: `${pct(o.w, WORLD.w)}%`,
            height: `${pct(o.h, WORLD.h)}%`,
          }}
        />
      ))}
      {layout.generators.map((g, i) => (
        <div
          key={`g${i}`}
          className="absolute grid place-items-center rounded-full border border-fuchsia-400/80 bg-fuchsia-500/20 text-[9px] font-bold text-fuchsia-200"
          style={{
            left: `${pct(g.x - WORLD.cell / 2, WORLD.w)}%`,
            top: `${pct(g.y - WORLD.cell / 2, WORLD.h)}%`,
            width: `${pct(WORLD.cell, WORLD.w)}%`,
            height: `${pct(WORLD.cell, WORLD.h)}%`,
          }}
        >
          {g.count}
        </div>
      ))}
      {layout.chests.map((c, i) => (
        <div
          key={`c${i}`}
          className="absolute rounded-full bg-emerald-400 ring-1 ring-emerald-200"
          style={{
            left: `${pct(c.x - 26, WORLD.w)}%`,
            top: `${pct(c.y - 26, WORLD.h)}%`,
            width: `${pct(52, WORLD.w)}%`,
            height: `${pct(52, WORLD.h)}%`,
          }}
        />
      ))}
    </div>
  );
}