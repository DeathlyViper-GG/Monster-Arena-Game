import React, { useState } from "react";
import { ANNOUNCEMENTS } from "./announcementItems";

// Announcements as the floating corner panel over a web page — the same plate,
// notes and fold behaviour as the panel that sits over the game, pinned in the
// bottom-right so it rests over the platform badge.
const HEADER =
  "flex items-center gap-2 border-b border-amber-300/20 bg-[linear-gradient(90deg,rgba(255,170,90,0.16),rgba(120,80,220,0.14))] px-3 py-3";
const HEADER_LABEL =
  "text-[11px] font-black uppercase tracking-[0.14em] text-amber-100 drop-shadow-[0_0_12px_rgba(255,180,90,0.45)]";

export default function AnnouncementsCorner() {
  const [minimised, setMinimised] = useState(false);

  return (
    <aside
      aria-label="Announcements"
      className={`pointer-events-auto fixed right-2 bottom-[calc(12px+env(safe-area-inset-bottom,0px))] z-[2147483647] flex max-w-[calc(100vw-24px)] flex-col overflow-hidden rounded-2xl border border-amber-300/30 bg-[linear-gradient(180deg,rgba(14,11,26,0.96),rgba(6,8,16,0.97))] shadow-[0_24px_60px_rgba(0,0,0,0.72),0_0_40px_rgba(255,160,80,0.18)] backdrop-blur-md ${
        minimised ? "w-[236px]" : "w-[320px]"
      }`}
    >
      <div className={HEADER}>
        <span className={HEADER_LABEL}>📣 Announcements</span>
        <button
          type="button"
          onClick={() => setMinimised((v) => !v)}
          aria-expanded={!minimised}
          aria-label={minimised ? "Expand announcements" : "Minimise announcements"}
          className="ml-auto grid h-[22px] w-[22px] place-items-center rounded-[7px] border border-violet-300/40 bg-white/5 text-sm font-black leading-none text-violet-200 transition hover:border-violet-300/90 hover:text-white hover:shadow-[0_0_14px_rgba(160,110,255,0.5)]"
        >
          {minimised ? "+" : "–"}
        </button>
      </div>

      {!minimised && (
        <div className="flex max-h-[232px] flex-col gap-2 overflow-y-auto overscroll-contain px-3 pb-3 pt-2.5">
          {ANNOUNCEMENTS.map((item) => (
            <article
              key={item.title}
              style={{ borderLeftColor: item.accent }}
              className="rounded-[11px] border border-violet-400/25 border-l-[3px] bg-[linear-gradient(180deg,rgba(24,20,40,0.78),rgba(11,10,20,0.78))] px-2.5 pb-2.5 pt-2"
            >
              <h4 className="m-0 mb-1 flex items-center gap-2 text-[12.5px] tracking-[0.02em] text-violet-50">
                {item.title}
                {item.tag && (
                  <span
                    style={{ color: item.accent, borderColor: item.accent }}
                    className="rounded-full border px-1.5 py-px text-[8.5px] font-black uppercase tracking-[0.1em]"
                  >
                    {item.tag}
                  </span>
                )}
              </h4>
              <p className="m-0 text-[11.5px] leading-[1.45] text-slate-400">{item.body}</p>
            </article>
          ))}
        </div>
      )}
    </aside>
  );
}