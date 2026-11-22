import React, { useState } from "react";
import { ANNOUNCEMENTS } from "./announcementItems";

// The announcements panel as a page block. Same notes as the corner panel over
// the game, so the sign-up, about and contact pages always match the game.
// It folds down to its header bar, exactly like the panel over the arena.
export default function AnnouncementsCard({ className = "" }) {
  const [minimised, setMinimised] = useState(false);

  return (
    <section
      aria-label="Announcements"
      className={`overflow-hidden rounded-2xl border border-border bg-card shadow-sm ${className}`}
    >
      <button
        type="button"
        onClick={() => setMinimised((v) => !v)}
        aria-expanded={!minimised}
        aria-label={minimised ? "Expand announcements" : "Minimise announcements"}
        className="flex w-full items-center gap-2 px-4 py-2.5 text-left"
      >
        <span className="text-[11px] font-black uppercase tracking-[0.18em] text-muted-foreground">
          📣 Announcements
        </span>
        <span className="ml-auto grid h-[22px] w-[22px] place-items-center rounded-[7px] border border-border text-sm font-black leading-none text-muted-foreground transition hover:border-primary hover:text-foreground">
          {minimised ? "+" : "–"}
        </span>
      </button>

      {!minimised && (
        <ul className="space-y-2 px-4 pb-4">
          {ANNOUNCEMENTS.map((item) => (
            <li
              key={item.title}
              style={{ borderLeftColor: item.accent }}
              className="rounded-lg border border-border border-l-[3px] bg-muted/40 px-3 py-2"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-foreground">{item.title}</span>
                {item.tag && (
                  <span
                    style={{ color: item.accent, borderColor: item.accent }}
                    className="rounded-full border px-1.5 py-px text-[9px] font-black uppercase tracking-[0.1em]"
                  >
                    {item.tag}
                  </span>
                )}
              </div>
              <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.body}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}