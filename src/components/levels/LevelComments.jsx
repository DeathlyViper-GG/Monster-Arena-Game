import React, { useEffect, useState } from "react";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";

// Comments live on their own entity so a level page stays cheap to load.
export default function LevelComments({ level }) {
  const { user, isAuthenticated } = useAuth();
  const [comments, setComments] = useState([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;
    base44.entities.LevelComment.filter({ level_id: level.id }, { sort: "-created_date", limit: 50 })
      .then((page) => { if (live) setComments(page.items || []); })
      .catch(() => {});
    return () => { live = false; };
  }, [level.id]);

  const post = async (e) => {
    e.preventDefault();
    const body = text.trim();
    if (!body) return;
    setBusy(true);
    setError("");
    try {
      const saved = await base44.entities.LevelComment.create({
        level_id: level.id,
        level_name: level.name,
        author_name: user?.full_name || user?.email || "Player",
        text: body.slice(0, 400),
      });
      setComments([saved, ...comments]);
      setText("");
    } catch (err) {
      setError(err?.message || "Could not post that comment.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mt-3 space-y-3 border-t border-border pt-3">
      {isAuthenticated ? (
        <form onSubmit={post} className="flex gap-2">
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            maxLength={400}
            placeholder="Leave a comment on this level…"
            className="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary"
          />
          <button
            type="submit"
            disabled={busy || !text.trim()}
            className="rounded-md bg-primary px-3 py-2 text-sm font-semibold text-primary-foreground disabled:opacity-40"
          >
            {busy ? "Posting…" : "Post"}
          </button>
        </form>
      ) : (
        <p className="text-xs text-muted-foreground">Sign in to leave a comment.</p>
      )}
      {error && <p className="text-xs text-destructive">{error}</p>}
      <div className="space-y-2">
        {comments.length === 0 && <p className="text-xs text-muted-foreground">No comments yet.</p>}
        {comments.map((c) => (
          <div key={c.id} className="rounded-md bg-secondary/40 px-3 py-2">
            <div className="text-xs font-semibold text-foreground">{c.author_name || "Player"}</div>
            <p className="text-sm text-muted-foreground">{c.text}</p>
          </div>
        ))}
      </div>
    </div>
  );
}