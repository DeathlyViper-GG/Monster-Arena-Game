import React from "react";

// Wave tab shown over the death screen. It mirrors the announcements corner
// panel exactly — same corner, same width, same chrome — but carries the wave
// the run ended on, and swallows its own clicks so nothing behind it reacts.
const CARD =
  "pointer-events-auto fixed right-2 bottom-[calc(76px+env(safe-area-inset-bottom,0px))] z-[2147483647] flex w-[320px] max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-2xl border border-amber-300/30 bg-[linear-gradient(180deg,rgba(14,11,26,0.96),rgba(6,8,16,0.97))] shadow-[0_24px_60px_rgba(0,0,0,0.72),0_0_40px_rgba(255,160,80,0.18)] backdrop-blur-md md:right-1 md:bottom-4";
const HEADER =
  "flex items-center gap-2 border-b border-amber-300/20 bg-[linear-gradient(90deg,rgba(255,170,90,0.16),rgba(120,80,220,0.14))] px-3 py-2.5";
const HEADER_LABEL =
  "text-[11px] font-black uppercase tracking-[0.14em] text-amber-100 drop-shadow-[0_0_12px_rgba(255,180,90,0.45)]";

export default function DeathWavePanel({ wave = 0 }) {
  const swallow = (event) => {
    event.preventDefault();
    event.stopPropagation();
  };

  return (
    <aside
      aria-label={`Wave reached: ${wave}`}
      onClick={swallow}
      onPointerDown={swallow}
      onMouseDown={swallow}
      className={CARD}
    >
      <div className={HEADER}>
        <span className={HEADER_LABEL}>🌊 Wave reached</span>
        <span className="ml-auto text-[15px] font-black text-amber-200 drop-shadow-[0_0_12px_rgba(255,190,90,0.55)]">
          {wave}
        </span>
      </div>
      <div className="px-3 pb-3 pt-2.5">
        <div className="rounded-[11px] border border-violet-400/25 border-l-[3px] border-l-amber-300/70 bg-[linear-gradient(180deg,rgba(24,20,40,0.78),rgba(11,10,20,0.78))] px-2.5 pb-2.5 pt-2">
          <div className="text-[9.5px] font-black uppercase tracking-[0.12em] text-violet-300/80">
            you fell at
          </div>
          <div className="mt-0.5 flex items-end gap-2">
            <span className="font-black leading-none text-amber-100 drop-shadow-[0_0_18px_rgba(255,190,90,0.5)] text-[34px]">
              {wave}
            </span>
            <span className="pb-0.5 text-[11px] font-semibold uppercase tracking-[0.1em] text-slate-400">
              waves survived
            </span>
          </div>
        </div>
      </div>
    </aside>
  );
}