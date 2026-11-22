/* ═════════════════════════════════════════════════════════════════
   A villager's errand, offered inside their own conversation: take
   it, watch it fill as you play, then report back for the stones.
   ═════════════════════════════════════════════════════════════════ */

export default function VillageQuestBlock({ quest, accent = "#9fe3ff", onAccept, onClaim }) {
  if (!quest) return null;
  const { def, state } = quest;

  const shell = {
    borderColor: `${accent}55`,
    background: "linear-gradient(180deg,rgba(24,32,28,.75),rgba(10,14,14,.75))",
  };

  if (state.claimed) {
    return (
      <div className="rounded-xl border px-3 py-2" style={shell}>
        <div className="text-[9.5px] font-black uppercase tracking-[0.2em]" style={{ color: accent }}>
          Errand done
        </div>
        <div className="mt-0.5 text-[12.5px] font-bold text-white/85">
          {def.title} — paid, ✦ {def.reward}
        </div>
      </div>
    );
  }

  if (!state.accepted) {
    return (
      <div className="rounded-xl border px-3 py-2.5" style={shell}>
        <div className="text-[9.5px] font-black uppercase tracking-[0.2em]" style={{ color: accent }}>
          An errand · pays ✦ {def.reward}
        </div>
        <div className="mt-1 text-[13px] font-bold text-white">{def.title}</div>
        <p className="mt-1 text-[11.5px] leading-relaxed text-white/60">{def.brief}</p>
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation();
            onAccept?.(def.id);
          }}
          className="mt-2 w-full rounded-lg px-3 py-1.5 text-[10.5px] font-black uppercase tracking-[0.16em] text-black transition hover:brightness-110"
          style={{ background: accent }}
        >
          Take the errand
        </button>
      </div>
    );
  }

  if (!state.done) {
    const pct = Math.min(100, Math.round((state.p / def.goal) * 100));
    return (
      <div className="rounded-xl border px-3 py-2.5" style={shell}>
        <div className="text-[9.5px] font-black uppercase tracking-[0.2em]" style={{ color: accent }}>
          Errand in hand
        </div>
        <div className="mt-1 text-[12.5px] font-bold text-white">{def.objective}</div>
        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-white/10">
          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: accent }} />
        </div>
        <div className="mt-1 text-[10px] uppercase tracking-[0.18em] text-white/35">
          {def.scope === "story" ? "Out in the story" : "Here in the village"} · {state.p}/{def.goal}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border px-3 py-2.5" style={{ ...shell, borderColor: accent }}>
      <div className="text-[9.5px] font-black uppercase tracking-[0.2em]" style={{ color: accent }}>
        Ready to report
      </div>
      <div className="mt-1 text-[12.5px] font-bold text-white">{def.title}</div>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onClaim?.(def.id);
        }}
        className="mt-2 w-full rounded-lg px-3 py-1.5 text-[10.5px] font-black uppercase tracking-[0.16em] text-black transition hover:brightness-110"
        style={{ background: accent }}
      >
        Report back · ✦ {def.reward}
      </button>
    </div>
  );
}