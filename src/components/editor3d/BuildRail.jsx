import React from "react";
import { BLOCK_MATERIALS, BLOCK_SIZES, BLOCK_SIZE_MAX, BLOCK_SIZE_MIN, clampBlockSize, materialOf } from "@/lib/level3d";
import { CHEST_RARITIES } from "@/lib/customLevels";

// The right rail: the blocks the arena's shader can draw in real materials, and
// the build tools around them — hills you can walk over, rock, erasing, chests
// and chest generators.
const TOOLS = [
  { id: "block", label: "Block", glyph: "▦" },
  { id: "building", label: "House", glyph: "🏠" },
  { id: "hill", label: "Hill", glyph: "⛰" },
  { id: "rock", label: "Rock", glyph: "▰" },
  { id: "erase", label: "Erase", glyph: "✕" },
  { id: "chest", label: "Chest", glyph: "▤" },
  { id: "generator", label: "Chest gen", glyph: "◈" },
];

const BLURB = {
  block: "Tap a face: the top stacks a cube, a side adds one at that height.",
  building: "A real house with a doorway and its own storeys — its own piece, not blocks.",
  hill: "A hill lifts the ground itself — walk up it to check the shape.",
  rock: "Rock and forest formations, exactly as the realm scatters them.",
  erase: "Lifts out the single cube you are looking at.",
  chest: "One chest, wherever you point.",
  generator: "Scatters a handful of chests around the spot.",
};

export default function BuildRail({ tool, onEquip, onTool }) {
  const mat = materialOf(tool.mat);
  // Any edge length in quarter-cell steps, not only the three presets.
  const size = clampBlockSize(tool.size);
  const setSize = (v) =>
    onTool({ id: "block", label: "Block", mat: tool.mat, size: clampBlockSize(v), rarity: tool.rarity, count: tool.count });
  return (
    <div className="pointer-events-auto flex w-[186px] flex-col gap-2 overflow-y-auto rounded-2xl border border-white/15 bg-[linear-gradient(180deg,rgba(14,20,34,0.92),rgba(8,11,20,0.94))] p-2 shadow-[0_16px_40px_rgba(0,0,0,0.6)] backdrop-blur-md">
      <div className="grid grid-cols-2 gap-1.5">
        {TOOLS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() =>
              onEquip({
                id: t.id,
                label: t.label,
                mat: t.id === "block" ? mat.id : tool.mat,
                size: tool.size || 100,
                rarity: tool.rarity,
                count: tool.count,
                floors: tool.floors || 2,
              })
            }
            className={
              "flex flex-col items-center gap-0.5 rounded-lg border px-1 py-2 text-[10px] font-bold uppercase tracking-wide transition " +
              (tool.id === t.id
                ? "border-primary bg-primary/15 text-primary"
                : "border-white/10 bg-white/5 text-white/70 hover:border-white/30 hover:text-white")
            }
          >
            <span className="text-base leading-none">{t.glyph}</span>
            {t.label}
          </button>
        ))}
      </div>

      <div>
        <div className="mb-1 text-[9px] font-black uppercase tracking-wider text-white/45">Blocks</div>
        <div className="grid grid-cols-5 gap-1">
          {BLOCK_MATERIALS.map((m) => (
            <button
              key={m.id}
              type="button"
              title={m.label}
              onClick={() => onTool({ id: "block", label: "Block", mat: m.id, size: tool.size || 100, rarity: tool.rarity, count: tool.count })}
              style={{ background: m.hex }}
              className={
                "h-6 rounded-[4px] border transition " +
                (tool.id === "block" && mat.id === m.id
                  ? "border-white shadow-[0_0_10px_rgba(255,255,255,0.55)]"
                  : "border-black/50 hover:border-white/70")
              }
            />
          ))}
        </div>
        <p className="mt-1 truncate text-[9px] font-bold uppercase tracking-wider text-white/50">{mat.label}</p>
      </div>

      {tool.id === "block" && (
        <div className="rounded-lg border border-white/10 bg-black/25 p-2">
          <div className="mb-1 text-[9px] font-black uppercase tracking-wider text-white/45">Block size</div>
          <div className="grid grid-cols-3 gap-1">
            {BLOCK_SIZES.map((s) => (
              <button
                key={s.id}
                type="button"
                title={`${s.id} × ${s.id} units`}
                onClick={() =>
                  onTool({ id: "block", label: "Block", mat: tool.mat, size: s.id, rarity: tool.rarity, count: tool.count })
                }
                className={
                  "rounded-md border py-1 text-[10px] font-bold uppercase tracking-wide transition " +
                  ((Number(tool.size) || 100) === s.id
                    ? "border-primary bg-primary/20 text-primary"
                    : "border-white/10 bg-white/5 text-white/70 hover:border-white/30 hover:text-white")
                }
              >
                {s.label}
              </button>
            ))}
          </div>
          <div className="mt-1.5 flex items-center gap-1">
            <button
              type="button"
              onClick={() => setSize(size - 25)}
              className="h-6 w-6 shrink-0 rounded-md border border-white/15 bg-white/5 text-xs font-black text-white/70 hover:border-white/40 hover:text-white"
            >
              −
            </button>
            <input
              type="number"
              min={BLOCK_SIZE_MIN}
              max={BLOCK_SIZE_MAX}
              step={25}
              value={size}
              onChange={(e) => setSize(Number(e.target.value))}
              className="w-full rounded-md border border-white/20 bg-black/50 px-1 py-1 text-center text-[11px] font-bold text-white outline-none"
            />
            <button
              type="button"
              onClick={() => setSize(size + 25)}
              className="h-6 w-6 shrink-0 rounded-md border border-white/15 bg-white/5 text-xs font-black text-white/70 hover:border-white/40 hover:text-white"
            >
              +
            </button>
          </div>
          <p className="mt-1 text-[9px] font-semibold text-white/40">{size} × {size} units · any size, in 25-unit steps</p>
        </div>
      )}

      {tool.id === "building" && (
        <div className="rounded-lg border border-white/10 bg-black/25 p-2">
          <div className="mb-1 text-[9px] font-black uppercase tracking-wider text-white/45">Storeys</div>
          <select
            value={Number(tool.floors) || 2}
            onChange={(e) => onTool({ id: "building", label: "House", floors: Number(e.target.value), mat: tool.mat, rarity: tool.rarity, count: tool.count })}
            className="w-full rounded-md border border-white/20 bg-black/50 px-2 py-1 text-[11px] font-semibold text-white outline-none"
          >
            <option value={1}>1 storey</option>
            <option value={2}>2 storeys</option>
            <option value={3}>3 storeys</option>
          </select>
        </div>
      )}

      {tool.id === "chest" && (
        <div className="rounded-lg border border-white/10 bg-black/25 p-2">
          <div className="mb-1 text-[9px] font-black uppercase tracking-wider text-white/45">Chest rarity</div>
          <select
            value={tool.rarity || "rare"}
            onChange={(e) => onTool({ id: "chest", label: "Chest", rarity: e.target.value, count: tool.count })}
            className="w-full rounded-md border border-white/20 bg-black/50 px-2 py-1 text-[11px] font-semibold text-white outline-none"
          >
            {CHEST_RARITIES.map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>
      )}

      {tool.id === "generator" && (
        <div className="rounded-lg border border-white/10 bg-black/25 p-2">
          <div className="mb-1 text-[9px] font-black uppercase tracking-wider text-white/45">Chests each</div>
          <input
            type="number"
            min={1}
            max={8}
            value={Number(tool.count) || 3}
            onChange={(e) => onTool({ id: "generator", label: "Generator", rarity: tool.rarity, count: Math.max(1, Math.min(8, Number(e.target.value) || 1)) })}
            className="w-full rounded-md border border-white/20 bg-black/50 px-2 py-1 text-[11px] font-semibold text-white outline-none"
          />
        </div>
      )}

      <p className="rounded-lg border border-white/10 bg-black/25 px-2 py-1.5 text-[9px] leading-tight text-white/40">
        {BLURB[tool.id] || BLURB.block}
      </p>
    </div>
  );
}