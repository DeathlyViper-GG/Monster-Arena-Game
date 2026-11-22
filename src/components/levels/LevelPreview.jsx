import React from "react";
import { WORLD, themeOf } from "@/lib/customLevels";
import { cubesOf, materialOf } from "@/lib/level3d";

// Read-only miniature of a built map, used on the community board and in the
// owner's review queue.
export default function LevelPreview({ level, className = "" }) {
  const layout = level?.layout || {};
  const theme = themeOf(level?.theme_id);
  const box = (x, y, w, h) => ({
    left: `${(x / WORLD.w) * 100}%`,
    top: `${(y / WORLD.h) * 100}%`,
    width: `${(w / WORLD.w) * 100}%`,
    height: `${(h / WORLD.h) * 100}%`,
  });

  return (
    <div
      className={"relative overflow-hidden rounded-lg border border-border " + className}
      style={{
        aspectRatio: `${WORLD.w} / ${WORLD.h}`,
        background: `radial-gradient(circle at 50% 45%, ${theme.accent}22, transparent 70%), hsl(var(--card))`,
      }}
    >
      {(layout.hills || []).map((q, i) => (
        <div
          key={`h${i}`}
          className="absolute rounded-full bg-emerald-300/25"
          style={{
            left: `${((q.x - (q.r || 200)) / WORLD.w) * 100}%`,
            top: `${((q.y - (q.r || 200)) / WORLD.h) * 100}%`,
            width: `${(((q.r || 200) * 2) / WORLD.w) * 100}%`,
            height: `${(((q.r || 200) * 2) / WORLD.h) * 100}%`,
          }}
        />
      ))}
      {cubesOf(layout.blocks).map((c, i) => (
        <div
          key={`k${i}`}
          className="absolute border border-black/40"
          style={{
            ...box(c.x, c.y, c.s, c.s),
            background: materialOf(c.mat).hex,
            opacity: 0.55 + 0.12 * Math.min(4, Math.round((c.z + c.s) / 100) || 1),
          }}
        />
      ))}
      {(layout.buildings || []).map((b, i) => (
        <div key={`b${i}`} className="absolute rounded-sm border border-primary/70 bg-primary/20" style={box(b.x, b.y, b.w, b.h)} />
      ))}
      {(layout.obstacles || []).map((o, i) => (
        <div key={`o${i}`} className="absolute rounded-sm bg-foreground/50" style={box(o.x, o.y, o.w, o.h)} />
      ))}
      {(layout.chests || []).map((c, i) => (
        <div key={`c${i}`} className="absolute h-1.5 w-1.5 rounded-full bg-emerald-400" style={box(c.x - 25, c.y - 25, 50, 50)} />
      ))}
      {(layout.generators || []).map((g, i) => (
        <div key={`g${i}`} className="absolute h-2 w-2 rounded-full border border-fuchsia-300 bg-fuchsia-500/40" style={box(g.x - 40, g.y - 40, 80, 80)} />
      ))}
    </div>
  );
}