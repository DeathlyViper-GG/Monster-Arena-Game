import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { isReviewer, playLevel, storedAccount, themeOf } from "@/lib/customLevels";
import { sealedIds } from "@/lib/levelApproval";
import LevelPreview from "@/components/levels/LevelPreview";
import LevelComments from "@/components/levels/LevelComments";
import PendingLevels from "@/components/levels/PendingLevels";
import MyDraftShelf from "@/components/levels/MyDraftShelf";
import ArenaCornerPanel from "@/components/ArenaCornerPanel";

export default function CommunityLevels() {
  const { user } = useAuth();
  const [levels, setLevels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);
  // Ask the account itself who is signed in, rather than relying on the page's
  // cached copy, so the reviewer tools appear for DeathlyViper every time.
  const [me, setMe] = useState(null);
  const [local] = useState(storedAccount);
  const [note, setNote] = useState("");

  // The reviewer tools follow the account, the page's own auth state and the
  // identity the game page mirrored into storage — whichever is available.
  const owner = isReviewer(user, me);

  useEffect(() => {
    base44.auth.me().then(setMe).catch(() => {});
  }, []);

  const myIds = [user?.id, me?.id].filter(Boolean);
  const myEmails = [user?.email, me?.email, local.email]
    .filter(Boolean)
    .map((e) => String(e).toLowerCase().trim());
  const isMine = (level) =>
    (level.created_by_id && myIds.includes(level.created_by_id)) ||
    Boolean(level.author_email) && myEmails.includes(String(level.author_email).toLowerCase().trim());

  // A level is on the board only when DeathlyViper has sealed it: the seal is a
  // record only the owner account can write, so a builder approving their own
  // level still puts nothing here.
  const loadLevels = async () => {
    try {
      const [page, approved] = await Promise.all([
        base44.entities.CustomLevel.filter({ status: "approved" }, { sort: "-created_date", limit: 60 }),
        sealedIds(),
      ]);
      setLevels((page.items || []).filter((l) => approved.has(l.id)));
    } catch (_) {
      setLevels([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadLevels();
  }, []);

  // Only the builder or the reviewer may write to a level, so a play is counted
  // for them and simply not counted for anyone else instead of being refused.
  const play = async (level) => {
    const mine = Boolean(level.created_by_id) && me?.id === level.created_by_id;
    if (mine || owner) {
      base44.entities.CustomLevel.update(level.id, { plays: (Number(level.plays) || 0) + 1 }).catch(() => {});
    }
    playLevel(level);
  };

  // The reviewer can take a level down for good; its builder can pull their own.
  const remove = async (level) => {
    if (!window.confirm(`Delete “${level.name}”? This cannot be undone.`)) return;
    try {
      await base44.entities.CustomLevel.delete(level.id);
      setLevels((list) => list.filter((l) => l.id !== level.id));
      setNote("");
    } catch (err) {
      setNote(err?.message || "Only the builder or DeathlyViper can delete a level.");
    }
  };

  return (
    <div className="min-h-screen bg-background text-foreground">
      {/* Announcements in the corner, on the top layer above the platform
          badge, exactly as on the game page. */}
      <ArenaCornerPanel mode="menu" level="" essence="" />
      <div className="mx-auto max-w-5xl px-5 py-10">
        <div className="flex items-center justify-between">
          <Link to="/" className="text-sm text-muted-foreground hover:text-foreground">← Back to game</Link>
          {owner && (
            <Link to="/level-review" className="rounded-md border border-primary px-3 py-1.5 text-sm font-bold text-primary hover:bg-primary/10">
              ✔ Approve levels
            </Link>
          )}
        </div>
        <h1 className="mt-4 font-heading text-3xl font-bold">Community Levels</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Arenas built by players and approved by DeathlyViper. Play one, then tell the builder what you thought.
        </p>
        {note && <p className="mt-2 text-sm font-semibold text-destructive">{note}</p>}
        <div className="mt-4">
          <Link
            to="/editor"
            className="inline-block rounded-md bg-primary px-4 py-2 text-sm font-bold text-primary-foreground"
          >
            🛠️ Build a level
          </Link>
        </div>

        {/* The builder's unfinished maps live right here, above the board. */}
        <MyDraftShelf email={user?.email || me?.email || local.email} />

        <PendingLevels owner={owner} onDecided={loadLevels} />

        {loading && <p className="mt-8 text-sm text-muted-foreground">Loading levels…</p>}
        {!loading && levels.length === 0 && (
          <p className="mt-8 text-sm text-muted-foreground">
            No levels have been approved yet. Build one and it could be the first.
          </p>
        )}

        <div className="mt-8 grid gap-5 sm:grid-cols-2">
          {levels.map((level) => {
            const theme = themeOf(level.theme_id);
            const open = openId === level.id;
            return (
              <div key={level.id} className="rounded-xl border border-border bg-card/60 p-4">
                <div className="flex items-baseline justify-between gap-2">
                  <h2 className="font-heading text-lg font-bold">{level.name}</h2>
                  <span className="text-xs font-semibold" style={{ color: theme.accent }}>{theme.name}</span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {level.mode === "pvp" ? "PvP arena" : `${level.wave_count} waves`} · by {level.author_name || "Player"} · {Number(level.plays) || 0} plays
                </p>
                <LevelPreview level={level} className="mt-3" />
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => play(level)}
                    className="flex-1 rounded-md bg-primary px-3 py-2 text-sm font-bold text-primary-foreground"
                  >
                    ▶ Play
                  </button>
                  <button
                    type="button"
                    onClick={() => setOpenId(open ? null : level.id)}
                    className="rounded-md border border-border px-3 py-2 text-sm font-semibold text-muted-foreground hover:text-foreground"
                  >
                    💬 Comments
                  </button>
                  {(owner || isMine(level)) && (
                    <button
                      type="button"
                      onClick={() => remove(level)}
                      title="Delete this level"
                      className="rounded-md border border-destructive/60 px-3 py-2 text-sm font-bold text-destructive hover:bg-destructive/10"
                    >
                      🗑 Delete
                    </button>
                  )}
                </div>
                {open && <LevelComments level={level} />}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}