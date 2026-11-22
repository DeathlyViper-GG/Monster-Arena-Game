import React, { useEffect, useState } from "react";
import { createPortal } from "react-dom";

// The badge belongs to the platform and is drawn at the very top of this
// document, so it is only ever covered, never removed. No page can close a
// browser's developer tools — nothing in the web platform can — so the next
// best thing is done: the moment they are docked (which is what Chrome's
// ⋮ › More tools › Developer tools does by default) the page gets narrower or
// shorter, that is detected instantly, and the whole screen is sealed, badge
// included, until they are closed again. The owner can lift the seal for a
// session with the admin key.
const WIDTH_GAP = 160;
const HEIGHT_GAP = 220;

// Shared with the owner, like the Human Pack's secret key.
const ADMIN_KEY = "ARENA-KEEPER-4X7Q";
const UNLOCK_KEY = "arenaDevtoolsKey";

const norm = (s) => String(s || "").toUpperCase().replace(/[^A-Z0-9]/g, "");

function devtoolsOpen() {
  if (!window.outerWidth || !window.outerHeight) return false;
  // Docked to the side.
  if (window.outerWidth - window.innerWidth > WIDTH_GAP) return true;
  // Docked to the bottom (browser chrome alone never costs this much height).
  return window.outerHeight - window.innerHeight > HEIGHT_GAP;
}

// The badge is injected last into <body> at the maximum z-index, so a curtain
// only wins by also being last. This keeps its host node at the end.
function useTopLayerHost() {
  const [host] = useState(() => document.createElement("div"));
  const [ready, setReady] = useState(false);

  useEffect(() => {
    host.setAttribute("data-arena-devtools", "");
    host.style.position = "fixed";
    host.style.inset = "0";
    host.style.pointerEvents = "none";
    host.style.zIndex = "2147483647";
    document.body.appendChild(host);
    setReady(true);

    // Removing the seal in the inspector is the obvious way round it, so it
    // puts itself back: watching the page catches a deletion the moment it
    // happens, and the interval covers the badge being re-injected after it.
    const raise = () => {
      if (host.parentNode !== document.body || document.body.lastElementChild !== host) {
        document.body.appendChild(host);
      }
    };
    const observer = new MutationObserver(raise);
    observer.observe(document.body, { childList: true });
    const tick = window.setInterval(raise, 250);

    return () => {
      observer.disconnect();
      window.clearInterval(tick);
      host.remove();
      setReady(false);
    };
  }, [host]);

  return ready ? host : null;
}

export default function DevtoolsCurtain() {
  const host = useTopLayerHost();
  const [open, setOpen] = useState(false);
  const [unlocked, setUnlocked] = useState(() => {
    try { return localStorage.getItem(UNLOCK_KEY) === "1"; } catch { return false; }
  });
  const [code, setCode] = useState("");
  const [wrong, setWrong] = useState(false);

  useEffect(() => {
    // Inside a frame (the builder preview, or a site embedding the game) the
    // window metrics compare against the host page, so they mean nothing here.
    if (window.self !== window.top) return;

    const check = () => setOpen(devtoolsOpen());
    const tick = setInterval(check, 300);
    check();
    return () => clearInterval(tick);
  }, []);

  const tryUnlock = (event) => {
    event.preventDefault();
    if (norm(code) !== norm(ADMIN_KEY)) {
      setWrong(true);
      return;
    }
    try { localStorage.setItem(UNLOCK_KEY, "1"); } catch {}
    setUnlocked(true);
    setWrong(false);
    setCode("");
  };

  if (!host || !open || unlocked) return null;

  return createPortal(
    <aside
      aria-label="Developer tools open"
      onClick={(e) => e.stopPropagation()}
      className="pointer-events-auto fixed inset-0 grid place-items-center bg-[#04060d]/[0.98] px-8 text-center"
    >
      <div className="w-full max-w-sm">
        <div className="text-4xl">🜏</div>
        <h2 className="mt-4 font-heading text-[13px] font-black uppercase tracking-[0.35em] text-amber-200 drop-shadow-[0_0_16px_rgba(255,190,90,0.5)]">
          The arena is sealed
        </h2>
        <p className="mt-3 text-[13px] leading-relaxed text-slate-300">
          Close the browser&rsquo;s developer tools to return to the game.
        </p>
        <form onSubmit={tryUnlock} className="mt-6 flex items-center gap-2">
          <input
            value={code}
            onChange={(e) => { setCode(e.target.value); setWrong(false); }}
            placeholder="ADMIN KEY"
            autoComplete="off"
            spellCheck="false"
            maxLength={24}
            className="min-w-0 flex-1 rounded-md border border-amber-300/30 bg-white/5 px-3 py-2 text-center text-[12px] font-bold uppercase tracking-[0.18em] text-amber-100 placeholder:text-amber-100/30 focus:border-amber-300/80 focus:outline-none"
          />
          <button
            type="submit"
            className="rounded-md border border-amber-300/50 bg-amber-300/10 px-3 py-2 text-[11px] font-black uppercase tracking-[0.14em] text-amber-100 transition hover:bg-amber-300/20"
          >
            Unlock
          </button>
        </form>
        {wrong && (
          <p className="mt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-rose-300/90">
            That key was refused.
          </p>
        )}
      </div>
    </aside>,
    host
  );
}