import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { BOSSES, isReviewer, themeOf } from "@/lib/customLevels";
import { seal, unseal } from "@/lib/levelApproval";
import LevelPreview from "@/components/levels/LevelPreview";

function waveSummary(level) {
  const waves = Array.isArray(level.waves) ? level.waves : [];
  const wardens = waves.filter((w) => w.boss).map((w) => {
    const b = BOSSES.find((x) => x.id === w.boss);
    return `wave ${w.n}: ${b ? b.label : w.boss}`;
  });
  return wardens.length ? wardens.join(", ") : "no wardens";
}

// DeathlyViper's gate: nothing reaches the community board until it is approved.
export default function LevelReview() {
  const { user, authChecked } = useAuth();
  const [pending, setPending] = useState([]);
  const [notes, setNotes] = useState({});
  const [busyId, setBusyId] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [me, setMe] = useState(null);
  const [checked, setChecked] = useState(false);

  // The account is resolved from the session as well as the page's auth state,
  // so the reviewer is recognised whichever one answers first.
  useEffect(() => {
    base44.auth.me().then(setMe).catch(() => {}).finally(() => setChecked(true));
  }, []);

  const owner = isReviewer(user, me);
  const waiting = !authChecked || !checked;

  useEffect(() => {
    if (!owner) return;
    base44.entities.CustomLevel.filter({ status: "pending" }, { sort: "created_date", limit: 60 })
      .then((page) => setPending(page.items || []))
      .catch((err) => setLoadError(err?.message || "The queue could not be loaded."));
  }, [owner]);

  const decide = async (level, status) => {
    setBusyId(level.id);
    try {
      if (status === "approved") await seal(level);
      else await unseal(level.id);
      await base44.entities.CustomLevel.update(level.id, {
        status,
        review_note: (notes[level.id] || "").slice(0, 200),
      });
      setPending((list) => list.filter((l) => l.id !== level.id));
    } finally {
      setBusyId(null);
    }
  };

  const remove = async (level) => {
    if (!window.confirm(`Delete “${level.name}” for good?`)) return;
    setBusyId(level.id);
    try {
      await unseal(level.id);
      await base44.entities.CustomLevel.delete(level.id);
      setPending((list) => list.filter((l) => l.id !== level.id));
    } finally {
      setBusyId(null);
    }
  };

  if (!waiting && !owner) {
    return (
      <div className="min-h-screen bg-background text-foreground">
        <div className="mx-auto max-w-xl px-5 py-16">
          <Link to="/levels" className="text-sm text-muted-foreground hover:text-foreground">← Community levels</Link>
          <h1 className="mt-4 font-heading text-2xl font-bold">Owner only</h1>
          <p className="mt-2 text-sm text-muted-foreground">
            Level verification belongs to DeathlyViper. Only the owner account can approve or reject community levels.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background text-foreground">
      <div className="mx-auto max-w-4xl px-5 py-10">
        <Link to="/levels" className="text-sm text-muted-foreground hover:text-foreground">← Community levels</Link>
        <h1 className="mt-4 font-heading text-3xl font-bold">Level verification</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {pending.length} level{pending.length === 1 ? "" : "s"} waiting. Approve to publish it for every player, or reject it with a reason the builder can read.
        </p>

        <div className="mt-6 space-y-5">
          {loadError && <p className="text-sm text-red-400">Could not load the queue: {loadError}</p>}
          {!loadError && pending.length === 0 && <p className="text-sm text-muted-foreground">Nothing waiting for review.</p>}
          {pending.map((level) => {
            const theme = themeOf(level.theme_id);
            return (
              <div key={level.id} className="rounded-xl border border-border bg-card/60 p-4">
                <div className="flex flex-wrap items-baseline justify-between gap-2">
                  <h2 className="font-heading text-lg font-bold">{level.name}</h2>
                  <span className="text-xs font-semibold" style={{ color: theme.accent }}>
                    {theme.name} · {level.wave_count} waves
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  by {level.author_name || "Player"}{level.author_email ? ` (${level.author_email})` : ""} · wardens: {waveSummary(level)}
                </p>
                <LevelPreview level={level} className="mt-3" />
                <div className="mt-3 flex flex-wrap gap-2">
                  <input
                    value={notes[level.id] || ""}
                    onChange={(e) => setNotes({ ...notes, [level.id]: e.target.value })}
                    placeholder="Note for the builder (optional)"
                    maxLength={200}
                    className="min-w-[200px] flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
                  />
                  <button
                    type="button"
                    disabled={busyId === level.id}
                    onClick={() => decide(level, "approved")}
                    className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-bold text-white disabled:opacity-40"
                  >
                    Approve
                  </button>
                  <button
                    type="button"
                    disabled={busyId === level.id}
                    onClick={() => decide(level, "rejected")}
                    className="rounded-md bg-destructive px-4 py-2 text-sm font-bold text-destructive-foreground disabled:opacity-40"
                  >
                    Reject
                  </button>
                  <button
                    type="button"
                    disabled={busyId === level.id}
                    onClick={() => remove(level)}
                    className="rounded-md border border-border px-4 py-2 text-sm font-bold text-muted-foreground hover:text-destructive disabled:opacity-40"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}