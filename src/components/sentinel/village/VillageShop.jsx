import { useMemo, useState } from "react";
import {
  LORE,
  balanceStones,
  buy,
  ownedCodes,
  ownsGood,
  redeem
} from "./villageShop";
import { ownsPotion } from "./villagePotion";

/* ═════════════════════════════════════════════════════════════════
   A market cart, opened. Buy the keeper's stock, carry sealed
   cyphers, and redeem a code from the announcements or a friend.
   ═════════════════════════════════════════════════════════════════ */

const TABS = [
  { id: "goods", label: "Goods" },
  { id: "codes", label: "My cyphers" },
  { id: "redeem", label: "Redeem" }
];

export default function VillageShop({ shop, onClose }) {
  const [tab, setTab] = useState("goods");
  const [tick, setTick] = useState(0);
  const [note, setNote] = useState(null);
  const [draft, setDraft] = useState("");
  const [openInfo, setOpenInfo] = useState(null);

  const balance = useMemo(() => balanceStones(), [tick]);
  const codes = useMemo(() => ownedCodes(), [tick]);

  const handleBuy = (good) => {
    const result = buy(shop, good);
    setNote(result);
    setTick((v) => v + 1);
  };

  const handleRedeem = (code) => {
    const result = redeem(code);
    setNote(result);
    setTick((v) => v + 1);
  };

  return (
    <div className="absolute inset-0 z-30 grid place-items-center bg-black/70 p-3 backdrop-blur-sm">
      <div
        className="flex max-h-[88vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl border bg-[#0b1418]/97 shadow-[0_24px_60px_rgba(0,0,0,.7)]"
        style={{ borderColor: `${shop.accent}66`, boxShadow: `0 0 44px ${shop.accent}33, 0 24px 60px rgba(0,0,0,.7)` }}
      >
        <header className="flex items-center gap-3 border-b px-4 py-3" style={{ borderColor: `${shop.accent}33` }}>
          <span className="text-2xl" style={{ filter: `drop-shadow(0 0 10px ${shop.accent})` }}>{shop.icon}</span>
          <div className="min-w-0">
            <div className="truncate text-sm font-black tracking-wide text-white">{shop.keeper}</div>
            <div className="truncate text-[10px] uppercase tracking-[0.18em]" style={{ color: shop.accent }}>
              {shop.role}
            </div>
          </div>
          <div className="ml-auto rounded-full border border-amber-300/40 bg-amber-300/10 px-2.5 py-1 text-[11px] font-black text-amber-100">
            ✦ {balance}
          </div>
        </header>

        <nav className="flex gap-1 px-3 pt-3">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTab(item.id)}
              className="rounded-lg px-3 py-1.5 text-[10.5px] font-black uppercase tracking-[0.14em] transition"
              style={
                tab === item.id
                  ? { color: "#06121a", background: shop.accent }
                  : { color: "#9fb3c4", background: "rgba(255,255,255,.05)" }
              }
            >
              {item.label}
            </button>
          ))}
        </nav>

        <div className="flex-1 overflow-y-auto px-3 py-3">
          {tab === "goods" && (
            <div className="space-y-2">
              <p className="px-1 text-[11.5px] leading-relaxed text-white/50">{shop.greeting}</p>
              {shop.about && (
                <p className="rounded-lg border border-white/10 bg-white/[0.03] px-2.5 py-2 text-[11px] leading-relaxed text-white/40">
                  {shop.about}
                </p>
              )}
              {shop.goods.map((good) => {
                const free = good.kind === "info";
                const owned =
                  good.kind === "potion" ? ownsPotion(good.id) : free ? false : ownsGood(good.id);
                const short = !owned && !free && balance < good.cost;
                const shown = openInfo === good.id;
                return (
                  <article
                    key={good.id}
                    className="rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5"
                  >
                    <div className="flex items-start gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="text-[12.5px] font-bold text-white">
                          {good.icon ? `${good.icon} ` : ""}
                          {good.name}
                        </div>
                        <div className="mt-0.5 text-[11px] leading-snug text-white/45">{good.blurb}</div>
                      </div>
                      <button
                        type="button"
                        disabled={owned || short}
                        onClick={() => {
                          if (free) setOpenInfo(shown ? null : good.id);
                          else handleBuy(good);
                        }}
                        className="shrink-0 rounded-lg px-2.5 py-1.5 text-[10.5px] font-black uppercase tracking-[0.1em] transition disabled:opacity-40"
                        style={{ background: owned ? "rgba(255,255,255,.08)" : shop.accent, color: owned ? "#9fb3c4" : "#06121a" }}
                      >
                        {free
                          ? shown
                            ? "Close"
                            : "Ask"
                          : owned
                            ? good.kind === "potion"
                              ? "Stoppered"
                              : "Owned"
                            : short
                              ? `Need ${good.cost}`
                              : `✦ ${good.cost}`}
                      </button>
                    </div>
                    {free && shown && (
                      <p className="mt-2 border-t border-white/10 pt-2 text-[11.5px] leading-relaxed text-white/70">
                        {good.body}
                      </p>
                    )}
                    {owned && good.kind === "lore" && LORE[good.id] && (
                      <p className="mt-2 border-t border-white/10 pt-2 text-[11.5px] leading-relaxed text-white/65">
                        {LORE[good.id].body}
                      </p>
                    )}
                    {owned && good.kind === "potion" && (
                      <p className="mt-2 border-t border-white/10 pt-2 text-[11px] leading-relaxed text-emerald-200/70">
                        Waiting at the gate — it is drunk for you when your next Sentinel chapter begins.
                      </p>
                    )}
                  </article>
                );
              })}
            </div>
          )}

          {tab === "codes" && (
            <div className="space-y-2">
              {codes.length === 0 ? (
                <p className="px-1 py-6 text-center text-[11.5px] text-white/40">
                  No cyphers sealed yet. Buy one from the goods tab — or ask a friend for theirs.
                </p>
              ) : (
                codes.map((entry) => (
                  <article
                    key={entry.code}
                    className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-mono text-[12px] font-bold tracking-wider text-white">{entry.code}</div>
                      <div className="text-[10.5px] text-white/45">{entry.label}</div>
                    </div>
                    <button
                      type="button"
                      disabled={entry.redeemed}
                      onClick={() => handleRedeem(entry.code)}
                      className="shrink-0 rounded-lg px-2.5 py-1.5 text-[10.5px] font-black uppercase tracking-[0.1em] transition disabled:opacity-40"
                      style={{ background: entry.redeemed ? "rgba(255,255,255,.08)" : shop.accent, color: entry.redeemed ? "#9fb3c4" : "#06121a" }}
                    >
                      {entry.redeemed ? "Spent" : "Redeem"}
                    </button>
                  </article>
                ))
              )}
            </div>
          )}

          {tab === "redeem" && (
            <div className="space-y-3">
              <p className="px-1 text-[11.5px] leading-relaxed text-white/50">
                Any cypher sealed with a Hollowmere stamp — from another player, or from the announcements board.
              </p>
              <form
                className="flex gap-2"
                onSubmit={(event) => {
                  event.preventDefault();
                  handleRedeem(draft);
                  setDraft("");
                }}
              >
                <input
                  value={draft}
                  onChange={(event) => setDraft(event.target.value.toUpperCase())}
                  placeholder="CIPHER-XXXX"
                  className="min-w-0 flex-1 rounded-lg border border-white/15 bg-black/50 px-3 py-2 font-mono text-[12px] tracking-wider text-white placeholder:text-white/25 focus:outline-none"
                />
                <button
                  type="submit"
                  className="shrink-0 rounded-lg px-3 py-2 text-[10.5px] font-black uppercase tracking-[0.1em]"
                  style={{ background: shop.accent, color: "#06121a" }}
                >
                  Redeem
                </button>
              </form>
            </div>
          )}
        </div>

        {note && (
          <p
            className="mx-3 mb-2 rounded-lg border px-3 py-2 text-[11.5px] leading-snug"
            style={{
              borderColor: note.ok ? "#7de0b855" : "#ff8a8a55",
              background: note.ok ? "#7de0b815" : "#ff8a8a15",
              color: note.ok ? "#c8ffe0" : "#ffd0d0"
            }}
          >
            {note.message}
          </p>
        )}

        <footer className="border-t border-white/10 px-3 py-2.5">
          <button
            type="button"
            onClick={onClose}
            className="w-full rounded-lg border border-white/20 bg-white/5 py-2 text-[10.5px] font-black uppercase tracking-[0.2em] text-white/80 transition hover:bg-white/10"
          >
            Leave the cart
          </button>
        </footer>
      </div>
    </div>
  );
}