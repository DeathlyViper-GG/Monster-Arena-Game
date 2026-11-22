import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { themeOf } from "@/lib/customLevels";
import { seal, unseal } from "@/lib/levelApproval";

// Owner-only queue shown right on the community board: every level waiting for
// a verdict, with its approve and reject buttons and a note for the builder.
// Only DeathlyViper's own account sees it.
export default function PendingLevels({ owner, onDecided }) {
  const [rows, setRows] = useState([]);
  const [notes, setNotes] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!owner) { setLoading(false); return; }
    base44.entities.CustomLevel.filter({ status: "pending" }, { sort: "-created_date", limit: 40 })
      .then((page) => setRows(page.items || []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [owner]);

  if (!owner) return null;

  const decide = async (level, status) => {
    setBusyId(level.id);
    setError("");
    try {
      if (status === "approved") await seal(level);
      else await unseal(level.id);
      await base44.entities.CustomLevel.update(level.id, {
        status,
        review_note: (notes[level.id] || "").trim().slice(0, 200),
      });
      setRows((list) => list.filter((r) => r.id !== level.id));
      onDecided?.(level, status);
    } catch (err) {
      setError(err?.message || "Could not save that decision.");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <section className="mt-6 rounded-xl border border-primary/40 bg-card/60 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-heading text-lg font-bold text-primary">Pending levels</h2>
        <span className="text-xs text-muted-foreground">{rows.length} waiting</span>
      </div>
      {loading && <p className="mt-2 text-sm text-muted-foreground">Checking the queue…</p>}
      {!loading && rows.length === 0 && (
        <p className="mt-2 text-sm text-muted-foreground">Nothing is waiting for approval right now.</p>
      )}
      {error && <p className="mt-2 text-xs text-destructive">{error}</p>}

      <div className="mt-3 space-y-2">
        {rows.map((level) => {
          const theme = themeOf(level.theme_id);
          return (
            <div key={level.id} className="rounded-lg border border-border bg-background/50 p-3">
              <div className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-heading text-sm font-bold">{level.name}</span>
                <span className="text-[11px] font-semibold" style={{ color: theme.accent }}>{theme.name}</span>
                <span className="text-[11px] text-muted-foreground">
                  {level.mode === "pvp" ? "PvP arena" : `${level.wave_count} waves`} · by {level.author_name || "Player"}
                </span>
              </div>
              <input
                value={notes[level.id] || ""}
                onChange={(e) => setNotes({ ...notes, [level.id]: e.target.value })}
                maxLength={200}
                placeholder="Note for the builder (optional)"
                className="mt-2 w-full rounded-md border border-input bg-background px-2 py-1.5 text-xs outline-none focus:border-primary"
              />
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={busyId === level.id}
                  onClick={() => decide(level, "approved")}
                  className="flex-1 rounded-md bg-primary px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-primary-foreground disabled:opacity-40"
                >
                  ✔ Approve
                </button>
                <button
                  type="button"
                  disabled={busyId === level.id}
                  onClick={() => decide(level, "rejected")}
                  className="flex-1 rounded-md border border-destructive/60 px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-destructive disabled:opacity-40"
                >
                  ✕ Reject
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}