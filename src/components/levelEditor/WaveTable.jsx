import React from "react";
import { BOSSES, MONSTERS, bossOf } from "@/lib/customLevels";

// One row per wave: which monsters may spawn, and which warden arrives.
export default function WaveTable({ waves, onChange }) {
  const toggle = (wave, id) => {
    const types = wave.types.includes(id)
      ? wave.types.filter((t) => t !== id)
      : [...wave.types, id];
    onChange(waves.map((w) => (w.n === wave.n ? { ...w, types } : w)));
  };

  const setBoss = (wave, boss) => {
    onChange(waves.map((w) => (w.n === wave.n ? { ...w, boss: boss || null } : w)));
  };

  return (
    <div className="space-y-2">
      {waves.map((wave) => {
        const boss = bossOf(wave.boss);
        return (
          <div key={wave.n} className="rounded-lg border border-border bg-card/60 p-2">
            <div className="flex flex-wrap items-center gap-2">
              <span className="w-14 shrink-0 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                Wave {wave.n}
              </span>
              <div className="flex flex-wrap gap-1">
                {MONSTERS.map((m) => {
                  const on = wave.types.includes(m.id);
                  return (
                    <button
                      key={m.id}
                      type="button"
                      title={m.desc}
                      onClick={() => toggle(wave, m.id)}
                      className={
                        "rounded-full border px-2 py-1 text-xs font-semibold transition " +
                        (on
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border text-muted-foreground hover:text-foreground")
                      }
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
              <select
                value={wave.boss || ""}
                onChange={(e) => setBoss(wave, e.target.value)}
                className="ml-auto rounded-md border border-border bg-background px-2 py-1 text-xs"
              >
                <option value="">No warden</option>
                {BOSSES.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.label}
                  </option>
                ))}
              </select>
            </div>
            {wave.types.length === 0 && (
              <p className="mt-1 pl-16 text-[11px] text-muted-foreground">
                Nothing picked on this wave yet — the arena's standard mix spawns.
              </p>
            )}
            {boss && (
              <p className="mt-1 pl-16 text-[11px] text-muted-foreground">{boss.desc}</p>
            )}
          </div>
        );
      })}
    </div>
  );
}