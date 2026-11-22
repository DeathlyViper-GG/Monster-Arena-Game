/* ═════════════════════════════════════════════════════════════════
   The errand book: what you have taken on and how far along it is.
   Sits under the village sign, out of the way of the corner panel
   that shows the iron keys.
   ═════════════════════════════════════════════════════════════════ */

export default function VillageQuestTracker({ quests = [] }) {
  if (!quests.length) return null;

  return (
    <div className="pointer-events-none absolute left-3 top-[6.6rem] z-20 w-[min(17rem,64vw)] md:left-6 md:top-36">
      <div className="text-[9px] uppercase tracking-[0.34em] text-amber-200/60">Errands</div>
      <div className="mt-1 space-y-1.5">
        {quests.map(({ def, state }) => {
          const pct = Math.min(100, Math.round((state.p / def.goal) * 100));
          return (
            <div
              key={def.id}
              className="rounded-lg border border-amber-300/25 bg-black/45 px-2.5 py-1.5 backdrop-blur"
            >
              <div className="flex items-baseline gap-2">
                <span className="min-w-0 flex-1 truncate text-[11.5px] font-bold text-amber-50">
                  {def.title}
                </span>
                <span className="shrink-0 text-[9.5px] font-black uppercase tracking-[0.12em] text-amber-200/70">
                  {state.done ? "report" : `${state.p}/${def.goal}`}
                </span>
              </div>
              <div className="mt-1 h-[3px] overflow-hidden rounded-full bg-white/10">
                <div
                  className="h-full rounded-full bg-amber-300/80"
                  style={{ width: `${state.done ? 100 : pct}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}