import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { themeOf } from "@/lib/customLevels";

// The builder's own work in progress: every draft they have saved, each with a
// way straight back into the editor where it was left off. Drafts are private
// — nobody but their builder ever sees them here or anywhere else.
export default function MyDraftShelf({ email }) {
  const [drafts, setDrafts] = useState([]);
  const [note, setNote] = useState("");

  useEffect(() => {
    if (!email) return;
    base44.entities.CustomLevel.filter(
      { status: "draft", author_email: email },
      { sort: "-updated_date", limit: 30 }
    )
      .then((page) => setDrafts(page.items || []))
      .catch(() => {});
  }, [email]);

  if (!email) return null;

  const drop = async (level) => {
    if (!window.confirm(`Delete the draft “${level.name}”? This cannot be undone.`)) return;
    try {
      await base44.entities.CustomLevel.delete(level.id);
      setDrafts((list) => list.filter((d) => d.id !== level.id));
      setNote("");
    } catch (err) {
      setNote(err?.message || "Could not delete that draft.");
    }
  };

  return (
    <section className="mt-6 rounded-xl border border-border bg-card/60 p-4">
      <div className="flex items-baseline justify-between gap-2">
        <h2 className="font-heading text-lg font-bold">Your drafts</h2>
        <span className="text-xs text-muted-foreground">{drafts.length} saved</span>
      </div>
      {drafts.length === 0 && (
        <p className="mt-2 text-sm text-muted-foreground">
          Nothing saved yet — build a map and press 💾 Save draft to keep it here for later.
        </p>
      )}
      {note && <p className="mt-2 text-xs text-destructive">{note}</p>}
      <div className="mt-3 space-y-2">
        {drafts.map((level) => {
          const theme = themeOf(level.theme_id);
          return (
            <div
              key={level.id}
              className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-background/50 px-3 py-2"
            >
              <span className="font-heading text-sm font-bold">{level.name}</span>
              <span className="text-[11px] font-semibold" style={{ color: theme.accent }}>{theme.name}</span>
              <span className="text-[11px] text-muted-foreground">
                {level.mode === "pvp" ? "PvP arena" : `${level.wave_count} waves`}
              </span>
              <Link
                to={`/editor?draft=${level.id}`}
                className="ml-auto rounded-md bg-primary px-3 py-1.5 text-xs font-bold text-primary-foreground"
              >
                ✎ Continue
              </Link>
              <button
                type="button"
                onClick={() => drop(level)}
                title="Delete this draft"
                className="rounded-md border border-destructive/60 px-2 py-1.5 text-xs font-bold text-destructive hover:bg-destructive/10"
              >
                🗑
              </button>
            </div>
          );
        })}
      </div>
    </section>
  );
}