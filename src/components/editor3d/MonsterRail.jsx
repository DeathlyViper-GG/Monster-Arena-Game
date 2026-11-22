import React, { useState } from "react";
import { MONSTERS } from "@/lib/customLevels";
import { DECOR_KINDS, HAZARD_KINDS, monsterArt } from "@/lib/level3d";

// The left rail: what the builder can put down and let live — monsters,
// hazards and scenery. Equipping one loads it into the crosshair.
const TABS = [
  { id: "monsters", label: "Monsters" },
  { id: "hazards", label: "Hazards" },
  { id: "decor", label: "Scenery" },
];

export default function MonsterRail({ tool, onEquip }) {
  const [tab, setTab] = useState("monsters");

  const equipped = (id, extra) =>
    tool.id === id && (!extra || Object.keys(extra).every((k) => tool[k] === extra[k]));

  const row = (active, key, onClick, content) => (
    <button
      key={key}
      type="button"
      onClick={onClick}
      className={
        "flex w-full items-center gap-2 rounded-lg border px-2 py-1.5 text-left transition " +
        (active
          ? "border-primary bg-primary/15 text-foreground"
          : "border-white/10 bg-white/5 text-white/70 hover:border-white/30 hover:text-white")
      }
    >
      {content}
    </button>
  );

  return (
    <div className="pointer-events-auto flex max-h-full w-[168px] flex-col overflow-hidden rounded-2xl border border-white/15 bg-[linear-gradient(180deg,rgba(14,20,34,0.92),rgba(8,11,20,0.94))] shadow-[0_16px_40px_rgba(0,0,0,0.6)] backdrop-blur-md">
      <div className="flex border-b border-white/10">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={
              "flex-1 px-1 py-2 text-[10px] font-black uppercase tracking-wider transition " +
              (tab === t.id ? "bg-primary/15 text-primary" : "text-white/50 hover:text-white")
            }
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="flex-1 space-y-1.5 overflow-y-auto p-2">
        {tab === "monsters" &&
          MONSTERS.map((m) => {
            const art = monsterArt(m.id);
            return row(
              equipped("monster", { type: m.id }),
              m.id,
              () => onEquip({ id: "monster", type: m.id, label: m.label }),
              <>
                <span className="grid h-8 w-8 shrink-0 place-items-center rounded-md bg-black/40">
                  {art ? (
                    <img src={art} alt="" className="h-7 w-7 object-contain" draggable={false} />
                  ) : (
                    <span className="text-[10px] font-black">?</span>
                  )}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-[11px] font-bold leading-tight">{m.label}</span>
                  <span className="block truncate text-[9px] text-white/45">{m.group}</span>
                </span>
              </>
            );
          })}

        {tab === "hazards" &&
          HAZARD_KINDS.map((h) =>
            row(
              equipped("hazard", { kind: h.id }),
              h.id,
              () => onEquip({ id: "hazard", kind: h.id, label: h.label }),
              <>
                <span
                  className="h-7 w-7 shrink-0 rounded-md border border-white/20"
                  style={{ background: h.color, opacity: 0.75 }}
                />
                <span className="min-w-0">
                  <span className="block truncate text-[11px] font-bold leading-tight">{h.label}</span>
                  <span className="block truncate text-[9px] text-white/45">{h.blurb}</span>
                </span>
              </>
            )
          )}

        {tab === "decor" &&
          DECOR_KINDS.map((d) =>
            row(
              equipped("decor", { kind: d.id }),
              d.id,
              () => onEquip({ id: "decor", kind: d.id, label: d.label }),
              <span className="px-1 text-[11px] font-bold">{d.label}</span>
            )
          )}
      </div>

      <div className="border-t border-white/10 px-2 py-1.5 text-[9px] leading-tight text-white/40">
        Equip, look at a spot, then place.
      </div>
    </div>
  );
}