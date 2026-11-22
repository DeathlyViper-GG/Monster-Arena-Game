import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { ANNOUNCEMENTS } from "@/components/announcements/announcementItems";

// Corner panel, drawn by the page that hosts the game frame so it can sit above
// the platform badge in the bottom-right corner. Its content follows the game:
// announcements on every menu overlay, the essence counter in a match, and the
// realm name during a cinematic. The notes themselves are shared with the
// announcements card on the sign-up, about and contact pages.
const ITEMS = ANNOUNCEMENTS;

// TESTING FLAG — while true the announcements tab stops covering the platform
// badge: it is drawn in the page's normal stacking instead of the raised top
// layer, so the badge sits in front of it. Flip to false to seat the tab back
// over the badge. Only this switch decides the stacking; the tab's own markup
// and behaviour are untouched.
const TESTING_UNBLOCK_BADGE = false;

const HEADER =
  "flex items-center gap-2 border-b border-amber-300/20 bg-[linear-gradient(90deg,rgba(255,170,90,0.16),rgba(120,80,220,0.14))] px-3 py-2.5";
const HEADER_LABEL =
  "text-[11px] font-black uppercase tracking-[0.14em] text-amber-100 drop-shadow-[0_0_12px_rgba(255,180,90,0.45)]";
const LIST =
  "flex max-h-[132px] flex-col gap-1.5 overflow-y-auto overscroll-contain px-2.5 pb-2.5 pt-2";

// Seated squarely on the platform badge in the bottom-right corner at every
// window size (a split-screen or minimised window is exactly when the badge
// would otherwise show through), for every tab the panel draws: the
// announcements list, the essence counter, the key counter and the now-playing
// plate. Never wider than the viewport.
const CARD =
  "fixed right-3 bottom-3 z-[2147483647] flex w-[min(236px,calc(100vw-24px))] flex-col overflow-hidden rounded-2xl border border-amber-300/30 bg-[linear-gradient(180deg,rgba(14,11,26,0.96),rgba(6,8,16,0.97))] shadow-[0_24px_60px_rgba(0,0,0,0.72),0_0_40px_rgba(255,160,80,0.18)] backdrop-blur-md";

// The platform badge is injected into the document at the maximum z-index, so an
// element only beats it by also being last in the DOM. This keeps the panel's
// host node at the end of <body>, re-raising it whenever the window changes size
// (split screen, minimised, rotated) — the moments the badge is re-drawn.
function useTopLayerHost(onReady) {
  const [host] = useState(() => document.createElement("div"));
  const [ready, setReady] = useState(false);
  const notify = useRef(onReady);
  notify.current = onReady;

  // A layout effect, not an effect: the host node and its plate are in the
  // document before the browser's first paint, so the announcements are the
  // very first thing on screen — never a beat after the game frame.
  useLayoutEffect(() => {
    host.setAttribute("data-arena-corner", "");
    host.style.position = "fixed";
    host.style.inset = "0";
    host.style.pointerEvents = "none";
    host.style.zIndex = "2147483647";
    document.body.appendChild(host);

    const raise = () => {
      if (host.parentNode !== document.body || document.body.lastElementChild !== host) {
        document.body.appendChild(host);
      }
    };
    raise();
    setReady(true);
    // Tells the bare-document plate in index.html that the real panel is up,
    // so it can step aside without ever leaving the corner empty.
    window.__arenaPanelReady = true;
    // The page holds the game frame back until this fires, so the corner is
    // covered before anything else is allowed on screen.
    notify.current?.();
    // The badge can be injected at any moment after mount, which would put it
    // back in front: keep the panel last in the document at all times.
    const tick = window.setInterval(raise, 400);
    window.addEventListener("resize", raise);
    window.addEventListener("orientationchange", raise);
    window.visualViewport?.addEventListener("resize", raise);

    return () => {
      window.clearInterval(tick);
      window.removeEventListener("resize", raise);
      window.removeEventListener("orientationchange", raise);
      window.visualViewport?.removeEventListener("resize", raise);
      host.remove();
      setReady(false);
      window.__arenaPanelReady = false;
    };
  }, [host]);

  return ready ? host : null;
}

export default function ArenaCornerPanel({ mode: rawMode, level, essence, keys, onReady }) {
  const [minimised, setMinimised] = useState(false);
  const host = useTopLayerHost(onReady);
  // Announcements own the corner whenever the arena is between things: booting,
  // refreshing or returning home from a match. The panel never stands down, so
  // there is no moment where the platform badge is left uncovered.
  const mode = !rawMode || rawMode === "none" ? "menu" : rawMode;

  // Testing flag: while it is on, the announcements plate is not drawn at all,
  // so nothing sits in the corner and the platform badge stays visible there.
  // Flip the switch above to false to bring the tab back over the badge.
  const render = (node) =>
    TESTING_UNBLOCK_BADGE && mode === "menu" ? null : host ? createPortal(node, host) : null;

  // In the village the corner belongs to the iron keys: same slot, same
  // stacking as the announcements, so nothing on the page can cover it.
  if (mode === "village") {
    const total = keys?.total || 5;
    const found = Math.min(keys?.found || 0, total);
    return render(
      <aside aria-label="Iron keys" className={`${CARD} pointer-events-auto`}>
        <div className={HEADER}>
          <span className={HEADER_LABEL}>🗝 Iron keys</span>
          <span className="ml-auto text-[15px] font-black text-amber-200 drop-shadow-[0_0_12px_rgba(255,190,90,0.55)]">
            {found}/{total}
          </span>
        </div>
        <div className="px-3 pb-3 pt-2.5">
          <div className="flex gap-1.5">
            {Array.from({ length: total }).map((_, index) => (
              <span
                key={index}
                className={
                  index < found
                    ? "h-2 flex-1 rounded-full bg-amber-300 shadow-[0_0_10px_rgba(255,190,90,0.75)]"
                    : "h-2 flex-1 rounded-full bg-white/12"
                }
              />
            ))}
          </div>
          <p className="mt-2 text-[11px] leading-snug text-slate-400">
            {found >= total
              ? "All five — the quarter gate is lifting. The Margin Quarter is open."
              : "Behind the well, the carts, the shrine, the pines, the arch. Ask the villagers."}
          </p>
        </div>
      </aside>
    );
  }

  // A cinematic is the ONLY thing that gets its own plate. Anything else the
  // game reports keeps the announcements tab in the corner, so a stray state
  // can never leave the story plate sitting over the menu.
  if (mode === "cutscene") {
    return render(
      <aside aria-label="Current cinematic" className={`${CARD} pointer-events-auto`}>
        <div className="px-3 py-2.5">
          <div className="text-[9.5px] font-black uppercase tracking-[0.16em] text-violet-300/80">
            🎬 Now playing
          </div>
          <div className="mt-0.5 text-[13px] font-black tracking-[0.02em] text-violet-50">
            {level || "Story"}
          </div>
        </div>
      </aside>
    );
  }

  // A match uses the compressed announcements tab — same position and stacking,
  // header bar only — with the essence counter in it. The tab keeps its clicks:
  // a tap on the counter is spent on the counter, never on the arena behind it.
  const isMenu = mode !== "game";
  return render(
    <aside
      aria-label={isMenu ? "Announcements" : "Essence"}
      className={`${CARD} pointer-events-auto`}
    >
      <div className={HEADER}>
        <span className={HEADER_LABEL}>{isMenu ? "📣 Announcements" : "✦ Essence"}</span>
        {isMenu ? (
          <button
            type="button"
            onClick={() => setMinimised((v) => !v)}
            aria-label={minimised ? "Expand announcements" : "Minimise announcements"}
            className="ml-auto grid h-[22px] w-[22px] place-items-center rounded-[7px] border border-violet-300/40 bg-white/5 text-sm font-black leading-none text-violet-200 transition hover:border-violet-300/90 hover:text-white hover:shadow-[0_0_14px_rgba(160,110,255,0.5)]"
          >
            {minimised ? "+" : "–"}
          </button>
        ) : (
          <span className="ml-auto text-[15px] font-black text-amber-200 drop-shadow-[0_0_12px_rgba(255,190,90,0.55)]">
            {essence || "0"}
          </span>
        )}
      </div>

      {isMenu && !minimised && (
        <div className={LIST}>
          {ITEMS.map((item) => (
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