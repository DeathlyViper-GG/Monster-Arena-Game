import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { base44 } from "@/api/base44Client";
import { useAuth } from "@/lib/AuthContext";
import { defaultWaves, isOwner, playLevel, resizeWaves, MODES, THEMES } from "@/lib/customLevels";
import { emptyLayout3D } from "@/lib/level3d";
import EditorView from "@/components/editor3d/EditorView";
import MonsterRail from "@/components/editor3d/MonsterRail";
import BuildRail from "@/components/editor3d/BuildRail";
import WaveTable from "@/components/levelEditor/WaveTable";
import ArenaCornerPanel from "@/components/ArenaCornerPanel";

const STATUS_TONE = {
  draft: "text-white/45",
  pending: "text-primary",
  approved: "text-emerald-400",
  rejected: "text-red-400",
};

const REALMS = THEMES;

export default function LevelEditor() {
  const { user } = useAuth();
  const [realmId, setRealmId] = useState(1);
  // The builder starts in the meadow's arena with nothing in it: no rock, no
  // tree, no house. Every solid thing in the map is one the builder puts there.
  const [layout, setLayout] = useState(() => emptyLayout3D());
  const [tool, setTool] = useState({ id: "block", label: "Block", mat: "stone", size: 100, rarity: "rare", count: 3 });
  const [name, setName] = useState("");
  const [mode, setMode] = useState("pve");
  const [waveCount, setWaveCount] = useState(5);
  const [waves, setWaves] = useState(() => defaultWaves(5, 5));
  const [mine, setMine] = useState([]);
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [openPanel, setOpenPanel] = useState(false);
  const [failed, setFailed] = useState("");
  // The draft this build is saved under, so "Save draft" keeps updating the same
  // record instead of piling up copies, and submitting turns it into a real entry.
  const [draftId, setDraftId] = useState(null);
  // A short-lived confirmation drawn over the arena, so pressing Save always
  // answers back even when the setup panel is closed.
  const [flash, setFlash] = useState("");
  const flashTimer = useRef(null);

  // Undo / redo live outside React state so a fast paint never reads a stale
  // layout; the state mirrors whatever the history has at its tip.
  const live = useRef(layout);
  const history = useRef({ past: [], future: [] });
  // Anything that changes the map or its setup marks the work as unsaved, so
  // leaving the editor warns the builder before a whole map is thrown away.
  const unsaved = useRef(false);
  const markUnsaved = () => { unsaved.current = true; };
  const navigate = useNavigate();

  const leave = (to) => {
    if (unsaved.current && !window.confirm("You haven't saved this build yet — your map will be lost. Leave anyway?")) return;
    navigate(to);
  };

  const announce = (message) => {
    setFlash(message);
    window.clearTimeout(flashTimer.current);
    flashTimer.current = window.setTimeout(() => setFlash(""), 6000);
  };

  useEffect(() => {
    const beforeUnload = (e) => {
      if (!unsaved.current) return;
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", beforeUnload);
    return () => window.removeEventListener("beforeunload", beforeUnload);
  }, []);

  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.body.style.overflow = previous; };
  }, []);

  useEffect(() => {
    if (!user?.email) return;
    base44.entities.CustomLevel.filter({ author_email: user.email }, { sort: "-created_date", limit: 20 })
      .then((page) => setMine(page.items || []))
      .catch(() => {});
  }, [user?.email, note]);

  const record = (next) => {
    markUnsaved();
    const h = history.current;
    h.past.push(live.current);
    if (h.past.length > 40) h.past.shift();
    h.future.length = 0;
    live.current = next;
    setLayout(next);
  };

  const undo = () => {
    const h = history.current;
    if (!h.past.length) return;
    markUnsaved();
    h.future.push(live.current);
    live.current = h.past.pop();
    setLayout(live.current);
  };

  const redo = () => {
    const h = history.current;
    if (!h.future.length) return;
    markUnsaved();
    h.past.push(live.current);
    live.current = h.future.pop();
    setLayout(live.current);
  };

  useEffect(() => {
    const onKey = (e) => {
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === "z" && !e.shiftKey) { e.preventDefault(); undo(); }
      else if (e.key === "y" || (e.key === "z" && e.shiftKey)) { e.preventDefault(); redo(); }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  // Picking a realm re-dresses the ground and the walls in that realm's colours;
  // the arena itself stays bare so the builder's own blocks are the only things
  // standing in it.
  const chooseRealm = (id) => {
    setRealmId(id);
    record(emptyLayout3D());
  };

  const clearPlain = () => record(emptyLayout3D());

  const changeCount = (n) => {
    const c = Math.max(1, Math.min(30, n || 1));
    markUnsaved();
    setWaveCount(c);
    setWaves((w) => resizeWaves(w, c));
  };

  // Everything a level stores about the build itself, shared by drafts and
  // review submissions so the two can never drift apart.
  const build = () => ({
    author_name: user?.full_name || user?.email || "Player",
    author_email: user?.email || "",
    mode,
    theme_id: realmId || 1,
    wave_count: Math.max(1, waveCount),
    layout: live.current,
    waves: mode === "pve" ? waves : [],
  });

  const keepMine = (saved) => setMine((list) => [saved, ...list.filter((l) => l.id !== saved.id)]);

  // A draft needs no name: it is a private work in progress only its builder
  // can open, so a half-built map can be put down and picked up later.
  const saveDraft = async () => {
    setBusy(true);
    setNote("");
    try {
      const data = { ...build(), name: (name.trim() || "Untitled draft").slice(0, 60), status: "draft" };
      const saved = draftId
        ? await base44.entities.CustomLevel.update(draftId, data)
        : await base44.entities.CustomLevel.create({ ...data, plays: 0 });
      unsaved.current = false;
      setDraftId(saved.id);
      keepMine(saved);
      setNote("Draft saved — it is waiting under “Your drafts” on the Levels page.");
      announce("Draft saved — find it under “Your drafts” on the Levels page.");
    } catch (err) {
      const message = err?.message || "Could not save the draft.";
      setNote(message);
      announce(message);
    } finally {
      setBusy(false);
    }
  };

  // Picks a draft back up: the map, realm, map type and waves all return exactly
  // as they were left, ready for the next block.
  const resume = (level) => {
    const next = level.layout && typeof level.layout === "object" ? level.layout : emptyLayout3D();
    const count = Math.max(1, Math.min(30, Number(level.wave_count) || 1));
    history.current = { past: [], future: [] };
    live.current = next;
    setLayout(next);
    setRealmId(Number(level.theme_id) || 1);
    setMode(level.mode === "pvp" ? "pvp" : "pve");
    setWaveCount(count);
    setWaves(Array.isArray(level.waves) && level.waves.length ? level.waves : defaultWaves(count, count));
    setName(level.name || "");
    setDraftId(level.id);
    unsaved.current = false;
    setNote(`Back in “${level.name}” — carry on where you left off.`);
    setOpenPanel(false);
  };

  // Arriving from the drafts shelf: open the draft named in the address, so the
  // builder lands back on the exact map they saved.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("draft");
    if (!id) return;
    base44.entities.CustomLevel.get(id)
      .then((level) => { if (level?.status === "draft") resume(level); })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async () => {
    if (!name.trim()) {
      setNote("Give the level a name first.");
      setOpenPanel(true);
      return;
    }
    setBusy(true);
    setNote("");
    try {
      const data = { ...build(), name: name.trim().slice(0, 60), status: "pending" };
      const saved = draftId
        ? await base44.entities.CustomLevel.update(draftId, { ...data, review_note: "" })
        : await base44.entities.CustomLevel.create({ ...data, plays: 0 });
      unsaved.current = false;
      setDraftId(null);
      keepMine(saved);
      setNote("Sent to DeathlyViper for review. It appears on the community board once approved.");
      announce("Sent to DeathlyViper for review.");
    } catch (err) {
      const message = err?.message || "Could not save that level.";
      setNote(message);
      announce(message);
    } finally {
      setBusy(false);
    }
  };

  const counts = [
    `${layout.blocks.length} blocks`,
    `${layout.buildings.length} houses`,
    `${layout.obstacles.length} rocks`,
    `${layout.trees.length} trees`,
    `${layout.hills.length} hills`,
    `${layout.monsters.length} monsters`,
  ];

  return (
    <div className="fixed inset-0 overflow-hidden bg-background text-foreground">
      <EditorView
        layout={layout}
        tool={tool}
        realmId={realmId}
        onChange={record}
        onUnavailable={(reason) => setFailed(reason)}
      />

      <ArenaCornerPanel mode="menu" level="" essence="" />

      {failed && (
        <div className="pointer-events-none absolute inset-0 grid place-items-center">
          <p className="max-w-sm rounded-xl border border-white/20 bg-black/70 px-4 py-3 text-center text-sm text-white/80 backdrop-blur">
            The 3D arena could not start in this browser ({failed}).
          </p>
        </div>
      )}

      {/* top bar */}
      <div className="pointer-events-none absolute inset-x-0 top-0 flex flex-wrap items-center gap-2 bg-[linear-gradient(180deg,rgba(6,9,16,0.9),transparent)] px-3 py-2.5">
        <button
          type="button"
          onClick={() => leave("/levels")}
          className="pointer-events-auto rounded-lg border border-white/15 bg-black/45 px-2.5 py-1.5 text-[11px] font-bold text-white/70 backdrop-blur hover:text-white"
        >
          ← Levels
        </button>
        <input
          value={name}
          onChange={(e) => { markUnsaved(); setName(e.target.value); }}
          maxLength={60}
          placeholder="Level name"
          className="pointer-events-auto w-[150px] rounded-lg border border-white/15 bg-black/50 px-2.5 py-1.5 text-[12px] font-bold text-white outline-none backdrop-blur placeholder:text-white/35 focus:border-primary"
        />
        <select
          value={realmId}
          onChange={(e) => chooseRealm(Number(e.target.value))}
          className="pointer-events-auto rounded-lg border border-white/15 bg-black/50 px-2 py-1.5 text-[11px] font-bold text-white outline-none backdrop-blur"
        >
          {REALMS.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
        <button type="button" onClick={undo} className="pointer-events-auto rounded-lg border border-white/15 bg-black/45 px-2.5 py-1.5 text-[11px] font-bold text-white/70 backdrop-blur hover:text-white">
          ↶ Undo
        </button>
        <button type="button" onClick={redo} className="pointer-events-auto rounded-lg border border-white/15 bg-black/45 px-2.5 py-1.5 text-[11px] font-bold text-white/70 backdrop-blur hover:text-white">
          ↷ Redo
        </button>
        <button type="button" onClick={clearPlain} className="pointer-events-auto rounded-lg border border-white/15 bg-black/45 px-2.5 py-1.5 text-[11px] font-bold text-white/70 backdrop-blur hover:text-white">
          Clear
        </button>
        {isOwner(user) && (
          <button
            type="button"
            onClick={() => leave("/level-review")}
            className="pointer-events-auto rounded-lg border border-primary/60 px-2.5 py-1.5 text-[11px] font-bold text-primary backdrop-blur hover:bg-primary/10"
          >
            ✔ Review
          </button>
        )}
        <button
          type="button"
          onClick={saveDraft}
          disabled={busy}
          className="pointer-events-auto ml-auto rounded-lg border border-white/25 bg-black/50 px-2.5 py-1.5 text-[11px] font-bold text-white/80 backdrop-blur hover:border-primary hover:text-white disabled:opacity-40"
        >
          💾 Save draft
        </button>
        <button
          type="button"
          onClick={() => setOpenPanel(true)}
          className="pointer-events-auto rounded-lg border border-primary bg-primary px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-primary-foreground"
        >
          Level setup
        </button>
      </div>

      {/* left rail — monsters, hazards, scenery */}
      <div className="absolute bottom-24 left-3 top-16 flex justify-start">
        <MonsterRail tool={tool} onEquip={setTool} />
      </div>

      {/* right rail — build tools */}
      <div className="absolute bottom-24 right-3 top-16 flex justify-end">
        <BuildRail tool={tool} onEquip={setTool} onTool={setTool} />
      </div>

      <div className="pointer-events-none absolute bottom-1 left-1/2 -translate-x-1/2 whitespace-nowrap text-[10px] font-semibold text-white/45">
        Drag to look · WASD to walk · ✈ Fly, then Q/E to rise or sink · Tap a block&rsquo;s side to build beside it · Ctrl+Z undo
      </div>
      <div className="pointer-events-none absolute left-1/2 top-16 -translate-x-1/2 rounded-lg bg-black/50 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider text-white/60 backdrop-blur">
        {tool.label || tool.id} · {counts.join(" · ")}
      </div>

      {flash && (
        <div className="pointer-events-none absolute left-1/2 top-[104px] w-[min(360px,90vw)] -translate-x-1/2 rounded-xl border border-emerald-300/45 bg-[linear-gradient(180deg,rgba(10,40,30,0.92),rgba(6,16,14,0.94))] px-3 py-2 text-center text-[11.5px] font-semibold text-emerald-100 shadow-[0_10px_30px_rgba(0,0,0,0.55)] backdrop-blur">
          ✓ {flash}
        </div>
      )}

      {/* level setup slide-over */}
      {openPanel && (
        <div className="absolute inset-0 z-30 flex justify-end bg-black/50 backdrop-blur-sm">
          <div className="h-full w-[min(430px,94vw)] overflow-y-auto border-l border-white/15 bg-[linear-gradient(180deg,#0b1120,#060910)] p-4">
            <div className="flex items-center justify-between">
              <h2 className="font-heading text-lg font-bold">Level setup</h2>
              <button type="button" onClick={() => setOpenPanel(false)} className="rounded-md border border-white/20 px-2 py-1 text-xs font-bold text-white/70 hover:text-white">
                Close
              </button>
            </div>

            <label className="mt-4 block text-[10px] font-black uppercase tracking-widest text-white/45">
              Map type
              <select
                value={mode}
                onChange={(e) => { markUnsaved(); setMode(e.target.value); }}
                className="mt-1 w-full rounded-md border border-white/20 bg-black/50 px-2 py-1.5 text-sm font-normal normal-case tracking-normal text-white outline-none"
              >
                {MODES.map((m) => (
                  <option key={m.id} value={m.id}>{m.label}</option>
                ))}
              </select>
            </label>
            <p className="mt-1 text-[11px] text-white/45">{MODES.find((m) => m.id === mode)?.blurb}</p>

            {mode === "pve" && (
              <>
                <label className="mt-3 block text-[10px] font-black uppercase tracking-widest text-white/45">
                  Waves (level length)
                  <input
                    type="number"
                    min={1}
                    max={30}
                    value={waveCount}
                    onChange={(e) => changeCount(Number(e.target.value))}
                    className="mt-1 w-full rounded-md border border-white/20 bg-black/50 px-2 py-1.5 text-sm font-normal normal-case tracking-normal text-white outline-none"
                  />
                </label>
                <h3 className="mt-4 font-heading text-sm font-bold">Waves</h3>
                <p className="mb-2 text-[11px] text-white/45">Pick what each wave spawns, and where its warden arrives.</p>
                <WaveTable waves={waves} onChange={(w) => { markUnsaved(); setWaves(w); }} />
              </>
            )}

            <button
              type="button"
              onClick={submit}
              disabled={busy}
              className="mt-5 w-full rounded-md bg-primary px-3 py-2 text-sm font-bold text-primary-foreground disabled:opacity-40"
            >
              {busy ? "Saving…" : draftId ? "Submit draft for review" : "Submit for review"}
            </button>
            <button
              type="button"
              onClick={saveDraft}
              disabled={busy}
              className="mt-2 w-full rounded-md border border-white/25 px-3 py-2 text-sm font-bold text-white/80 disabled:opacity-40"
            >
              💾 {draftId ? "Save draft changes" : "Save as draft (finish later)"}
            </button>
            {note && <p className="mt-2 text-xs text-white/60">{note}</p>}

            <h3 className="mt-6 font-heading text-sm font-bold">Your drafts</h3>
            <div className="mt-2 space-y-2">
              {mine.filter((l) => l.status === "draft").length === 0 && (
                <p className="text-xs text-white/40">No drafts yet — press 💾 Save draft and it waits here.</p>
              )}
              {mine.filter((l) => l.status === "draft").map((l) => (
                <div key={l.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-primary/40 bg-white/5 px-2 py-1.5 text-xs">
                  <span className="font-semibold text-white/85">{l.name}</span>
                  <span className="ml-auto text-[10px] font-bold uppercase text-white/45">draft</span>
                  <button
                    type="button"
                    onClick={() => resume(l)}
                    className="rounded-md border border-primary/60 px-2 py-0.5 text-[10px] font-bold text-primary hover:bg-primary/10"
                  >
                    ✎ Continue
                  </button>
                </div>
              ))}
            </div>

            <h3 className="mt-6 font-heading text-sm font-bold">My submissions</h3>
            <div className="mt-2 space-y-2">
              {mine.filter((l) => l.status !== "draft").length === 0 && <p className="text-xs text-white/40">Nothing submitted yet.</p>}
              {mine.filter((l) => l.status !== "draft").map((l) => (
                <div key={l.id} className="flex flex-wrap items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-2 py-1.5 text-xs">
                  <span className="font-semibold text-white/85">{l.name}</span>
                  <span className={"text-[10px] font-bold uppercase " + (STATUS_TONE[l.status] || "")}>{l.status}</span>
                  {l.status === "approved" && (
                    <button type="button" onClick={() => playLevel(l)} className="ml-auto rounded-md border border-white/20 px-2 py-0.5 text-[10px] font-bold hover:border-primary">
                      ▶ Play
                    </button>
                  )}
                  {l.review_note && <span className="w-full text-[10px] text-white/40">“{l.review_note}”</span>}
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}