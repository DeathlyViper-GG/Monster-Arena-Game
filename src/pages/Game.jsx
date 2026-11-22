import React, { useEffect, useRef, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/lib/AuthContext";
import { appParams } from "@/lib/app-params";
import { base44 } from "@/api/base44Client";
import { hydrateProgress, uploadProgress, isProgressKey, cloudAccountId, setCloudAccountId } from "@/lib/cloudSync";
import { installInspectGuard } from "@/lib/preventInspect";
import CursedCasketScene from "@/components/casketCutscene/CasketScene";
import CasketDialogue from "@/components/casketCutscene/CasketDialogue";
import HearthWardenIntroStage from "@/components/hearthWardenIntro/HearthWardenIntroStage";
import GlacialArchiveStage from "@/components/glacialArchive/GlacialArchiveStage";
import DunesIntroStage from "@/components/desertIntro/DunesIntroStage";
import CinderIntroStage from "@/components/cinderIntro/CinderIntroStage";
import VoidIntroStage from "@/components/voidIntro/VoidIntroStage";
import StoryPrologueStage from "@/components/storyPrologue/StoryPrologueStage";
import SentinelCinematic from "@/components/sentinel/SentinelCinematic";
import SentinelVillage from "@/components/sentinel/village/SentinelVillage";
import DeathScreen from "@/components/deathScreen/DeathScreen";
import DeathWavePanel from "@/components/deathScreen/DeathWavePanel";
import ArenaCornerPanel from "@/components/ArenaCornerPanel";
import CrystoStage from "@/components/crysto/CrystoStage";
import { VILLAGE_KEYS, foundKeys } from "@/components/sentinel/village/villageFolk";

const BUILD_TAG = Date.now();
// The one account that owns the in-game developer story tools (see
// public/js/dev_switches.js). Decided here, where the real signed-in user is
// known, and handed to the game as a plain yes/no so the switches never depend
// on the frame re-reading the account itself.
const DEV_ACCOUNT_EMAIL = "deathlyviper@outlook.com";

// Hosts the real Monster Arena game (vanilla JS 3D client in /game.html) full-screen.
// The game owns its own menu, lobby, and arena. The query string is forwarded so
// shareable links (/?lobby=CODE) and offline flags reach the game's network layer.
//
// Optional cloud accounts: when a player is signed in, their full progress
// (RuneStones, weapons, skins, loadout, story) is hydrated into the shared
// localStorage before the iframe loads, and re-uploaded periodically. The game
// iframe and this parent share localStorage (same origin), so the data needs no
// postMessage — only the auth state is bridged across so the intro can show the
// username / Sign in / Log out controls.
export default function Game() {
  const iframeRef = useRef(null);
  const [casketPlaying, setCasketPlaying] = useState(false);
  const [restartToken, setRestartToken] = useState(0);
  const [hearthIntroPlaying, setHearthIntroPlaying] = useState(false);
  const [glacialPlaying, setGlacialPlaying] = useState(false);
  const [dunesPlaying, setDunesPlaying] = useState(false);
  const [cinderPlaying, setCinderPlaying] = useState(false);
  const [voidPlaying, setVoidPlaying] = useState(false);
  const [prologuePlaying, setProloguePlaying] = useState(false);
  // Age of the Sentinel: which cinematic script the game asked to play.
  const [sentinelScript, setSentinelScript] = useState(null);
  // Hollowmere: the campaign asks for its walkable village, cast included.
  const [village, setVillage] = useState(null);
  // The village counts the iron keys; this page draws the count in the corner
  // panel so it can never be covered by the village's own overlays.
  const [villageKeys, setVillageKeys] = useState({ found: 0, total: VILLAGE_KEYS.length });
  const [introRealm, setIntroRealm] = useState(1);
  const [deathPlaying, setDeathPlaying] = useState(false);
  const [deathRespawn, setDeathRespawn] = useState(true);
  const [deathWave, setDeathWave] = useState(0);
  // Who ended the run and with what, straight from the arena's kill record.
  const [deathKiller, setDeathKiller] = useState(null);
  // The game reports what is on screen; this page draws the corner panel for it.
  // Starts on "menu" so the announcements are on screen from the first paint,
  // before the frame has booted enough to report what it is doing.
  const [corner, setCorner] = useState({ mode: "menu", level: "", essence: "" });
  // Nothing else on this page is allowed on screen until the announcements tab
  // is in the document, so the corner is never briefly empty.
  const [panelReady, setPanelReady] = useState(false);
  // Crysto tells its story in its own films, drawn by this page (the world
  // itself lives inside the game frame, which cannot paint them).
  const [crystoFilm, setCrystoFilm] = useState(null);
  // Bumped every time the game frame finishes loading (it remounts once the
  // account resolves), so a pending player-made level is offered again.
  const [frameLoads, setFrameLoads] = useState(0);
  const { user, isAuthenticated, authChecked, logout } = useAuth();

  useEffect(() => {
    document.title = "Monster Arena";
  }, []);

  // The platform badge lives in this document, behind the corner panel. No
  // right-click menu or DevTools shortcut may open a view where it can be
  // reached while the arena is on screen.
  useEffect(() => installInspectGuard(), []);

  useEffect(() => {
    const onKeys = (event) => {
      setVillageKeys({
        found: Number(event?.detail?.found) || 0,
        total: Number(event?.detail?.total) || VILLAGE_KEYS.length
      });
    };
    window.addEventListener("village-keys", onKeys);
    return () => window.removeEventListener("village-keys", onKeys);
  }, []);

  // The arena owns the whole viewport: this is the one page that locks the
  // document. Every other page scrolls normally (see index.css).
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const prevHtml = html.style.overflow;
    const prevBody = body.style.overflow;
    html.style.overflow = "hidden";
    body.style.overflow = "hidden";
    return () => {
      html.style.overflow = prevHtml;
      body.style.overflow = prevBody;
    };
  }, []);

  const postToGame = useCallback((payload) => {
    const w = iframeRef.current?.contentWindow;
    if (w) w.postMessage(payload, "*");
  }, []);

  // The cinematics this page draws itself leave nothing inside the game frame,
  // so the frame cannot see them. Tell it when one is up: the corner panel then
  // names the cinematic from a fact instead of a flag that may outlive the scene
  // that set it. Re-sent whenever the frame reloads, so it never misses one.
  useEffect(() => {
    postToGame({
      type: "arena:cinematic",
      on: !!(
        casketPlaying ||
        hearthIntroPlaying ||
        glacialPlaying ||
        dunesPlaying ||
        cinderPlaying ||
        voidPlaying ||
        prologuePlaying ||
        sentinelScript ||
        crystoFilm
      ),
    });
  }, [
    casketPlaying,
    hearthIntroPlaying,
    glacialPlaying,
    dunesPlaying,
    cinderPlaying,
    voidPlaying,
    prologuePlaying,
    sentinelScript,
    crystoFilm,
    frameLoads,
    postToGame,
  ]);

  // Phones whose browser has no fullscreen for web pages (iPhone Safari) still
  // deserve the whole screen: give the document a sliver of scroll so the
  // browser collapses its own bars. The frame is fixed, so nothing on screen
  // shifts — the arena simply gains the bar's height.
  const immersive = useRef(false);
  const immersiveTimer = useRef(null);
  const setImmersive = useCallback((on) => {
    const html = document.documentElement;
    const body = document.body;
    clearTimeout(immersiveTimer.current);
    immersive.current = !!on;

    if (on) {
      // Give the page real room to scroll, then scroll it: that is what makes
      // the browser slide its own bars away. The frame is fixed, so nothing on
      // screen moves — the arena just gains the height of those bars.
      const before = window.innerHeight;
      // Bars already gone (or a tall desktop window): nothing left to reclaim.
      const alreadyFull = before >= (window.screen?.height || 0) - 8;
      html.style.overflowY = "auto";
      body.style.overflowY = "auto";
      body.style.minHeight = "calc(100vh + 140px)";
      // Two nudges: iOS sometimes needs a second scroll event before it will
      // slide its bars away.
      window.scrollTo(0, 140);
      requestAnimationFrame(() => window.scrollTo(0, 160));
      setTimeout(() => { if (immersive.current) window.scrollTo(0, 180); }, 120);
      // Did the page actually move? If it cannot scroll at all there is nothing
      // left to reclaim, so do not pretend the game went fullscreen.
      immersiveTimer.current = setTimeout(() => {
        const moved = window.scrollY > 0 || window.innerHeight > before + 4;
        if (immersive.current && !alreadyFull && !moved) setImmersive(false);
        else postToGame({ type: "arena:fullscreen-state", on: true });
      }, 700);
      return;
    }

    html.style.overflowY = "hidden";
    body.style.overflowY = "hidden";
    body.style.minHeight = "";
    window.scrollTo(0, 0);
    postToGame({ type: "arena:fullscreen-state", on: false });
  }, [postToGame]);

  const navigate = useNavigate();

  // The game's side menu links to app pages (/vpn, /about, /contact) with
  // target="_top". That is a full page load of the whole window, which the
  // editor preview blocks — the link appears dead or lands on a blank page.
  // Same origin, so catch those clicks and let React Router handle them: no
  // reload, and the page opens inside the app exactly like any other route.
  const interceptGameNav = useCallback(() => {
    const doc = iframeRef.current?.contentDocument;
    if (!doc) return;
    doc.addEventListener("click", (event) => {
      const link = event.target?.closest?.("a[href]");
      const href = link?.getAttribute("href") || "";
      if (!href.startsWith("/") || href.startsWith("//") || href.startsWith("/game")) return;
      event.preventDefault();
      navigate(href);
    });
  }, [navigate]);

  // Hydrate the signed-in account's save into shared localStorage before the
  // iframe (re)mounts. It is merged, never simply overwritten, so a stale cloud
  // copy can no longer wipe ranks, XP, quests or RuneStones earned here.
  const hydratedFor = useRef(null);
  if (authChecked && isAuthenticated && user?.id && hydratedFor.current !== user.id) {
    hydratedFor.current = user.id;
    const savedAccount = cloudAccountId();
    // A different account signing in on this device replaces the old profile
    // instead of blending two players' progress together.
    const adopt = !!user.gameProgress && !!savedAccount && savedAccount !== user.id;
    if (user.gameProgress) hydrateProgress(user.gameProgress, { adopt });
    setCloudAccountId(user.id);
    // Written before the frame mounts, so the game knows the account the
    // moment its scripts run (the posted message alone can arrive too early).
    try {
      if (user?.email) localStorage.setItem("arenaAuthEmail", user.email);
      else localStorage.removeItem("arenaAuthEmail");
    } catch {}
  }

  // Save straight back (healing the cloud record with the merged values), then
  // keep saving: the game's own writes to localStorage surface here as storage
  // events, so a new rank or claimed quest reaches the account within seconds.
  useEffect(() => {
    if (!authChecked || !isAuthenticated || !user?.id) return;
    if (hydratedFor.current !== user.id) return;

    uploadProgress();
    let pending = null;
    const onStorage = (e) => {
      if (e.key && !isProgressKey(e.key)) return;
      clearTimeout(pending);
      pending = setTimeout(() => uploadProgress(), 2500);
    };
    const onHide = () => { if (document.visibilityState === "hidden") uploadProgress(); };
    const flush = () => { uploadProgress(); };
    const t = setInterval(() => uploadProgress(), 20000);

    window.addEventListener("storage", onStorage);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    window.addEventListener("beforeunload", flush);
    return () => {
      clearTimeout(pending);
      clearInterval(t);
      window.removeEventListener("storage", onStorage);
      document.removeEventListener("visibilitychange", onHide);
      window.removeEventListener("pagehide", flush);
      window.removeEventListener("beforeunload", flush);
      uploadProgress();
    };
  }, [authChecked, isAuthenticated, user?.id]);

  // Tell the game intro who's signed in (so it can show username / logout).
  const postAuth = useCallback(() => {
    // Mirror the account into shared storage as well as posting it: the game
    // reads it directly, so admin status cannot be lost to message timing.
    const devAccount = !!isAuthenticated && (
      String(user?.email || "").toLowerCase().trim() === DEV_ACCOUNT_EMAIL ||
      String(user?.full_name || "").toLowerCase().trim() === "deathlyviper"
    );
    try {
      if (isAuthenticated && user?.email) localStorage.setItem("arenaAuthEmail", user.email);
      else localStorage.removeItem("arenaAuthEmail");
      localStorage.setItem("arenaDevAccount", devAccount ? "1" : "0");
    } catch {}
    postToGame({
      type: "auth:user",
      isAuthenticated: !!isAuthenticated,
      username: user?.username || user?.full_name || "",
      email: user?.email || "",
      dev: devAccount
    });
  }, [isAuthenticated, user, postToGame]);
  useEffect(() => { postAuth(); }, [postAuth]);

  // The hall's holographic leaderboard: the best records in the database,
  // handed to the game frame, which has no SDK of its own.
  const postRecords = useCallback(() => {
    base44.entities.ArenaRecord.list("-best_wave", 12)
      .then((rows) => {
        const list = Array.isArray(rows) ? rows : rows?.items || [];
        postToGame({
          type: "arena:records",
          rows: list.map((r) => ({
            name: r.player_name || "Fighter",
            rank: Number(r.rank_level) || 1,
            wave: Number(r.best_wave) || 0,
            kills: Number(r.kills) || 0,
            staff: !!r.staff
          }))
        });
      })
      .catch(() => postToGame({ type: "arena:records", rows: [] }));
  }, [postToGame]);
  useEffect(() => { postRecords(); }, [postRecords]);
  // The standing this device has already written, so a repeated beacon never
  // turns into a stream of writes.
  const lastRecord = useRef("");

  // A community level chosen on the Levels page is handed to the arena and kept
  // on offer until the arena confirms it has taken it — a slow first load, or the
  // frame remounting once the account resolves, would otherwise swallow the
  // message and leave the player on the home screen.
  useEffect(() => {
    let level = null;
    try {
      const raw = sessionStorage.getItem("arenaLaunchLevel");
      if (raw) level = JSON.parse(raw);
    } catch (_) {
      level = null;
    }
    if (!level) return;

    let settled = false;
    const send = () => { if (!settled) postToGame({ type: "arena:custom-level", level }); };
    const settle = () => {
      settled = true;
      try { sessionStorage.removeItem("arenaLaunchLevel"); } catch (_) {}
    };
    const onLevelMessage = (e) => {
      const data = e.data || {};
      if (data.type === "arena:custom-level-request") send();
      else if (data.type === "arena:custom-level-ack") settle();
    };
    window.addEventListener("message", onLevelMessage);
    send();
    const retry = setInterval(send, 700);
    const giveUp = setTimeout(settle, 40000);
    return () => {
      window.removeEventListener("message", onLevelMessage);
      clearInterval(retry);
      clearTimeout(giveUp);
    };
  }, [postToGame, frameLoads]);

  useEffect(() => {
    // The cutscenes and the death screen are drawn by this page, not by the
    // game frame. While the frame holds the screen fullscreen nothing else is
    // painted, so give the screen back before showing one of them.
    const HOST_OVERLAYS = [
      "casket-cutscene-start", "hearth-warden-intro-start", "glacial-archive-start",
      "dunes-intro-start", "cinder-intro-start", "void-intro-start",
      "story-prologue-start", "player-died", "sentinel-cinematic-start", "sentinel-village-start",
      "crysto-cutscene"
    ];
    const releaseFullscreen = () => {
      try {
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        if ((document.fullscreenElement || document.webkitFullscreenElement) && exit) {
          Promise.resolve(exit.call(document)).catch(() => {});
        }
      } catch {}
      postToGame({ type: "arena:fullscreen", on: false });
    };
    const onMessage = (e) => {
      const data = e.data || {};
      if (HOST_OVERLAYS.indexOf(data.type) >= 0) releaseFullscreen();
      if (data.type === "casket-cutscene-start") {
        setRestartToken((t) => t + 1);
        setCasketPlaying(true);
      }
      if (data.type === "hearth-warden-intro-start") {
        setIntroRealm(Number(data.realm) || 1);
        setHearthIntroPlaying(true);
      }
      if (data.type === "glacial-archive-start") {
        setGlacialPlaying(true);
        // Acknowledge immediately so the game knows the host is playing the
        // 3D cutscene instead of falling back to its 2D version.
        postToGame({ type: "glacial-archive-ack" });
      }
      if (data.type === "dunes-intro-start") {
        setDunesPlaying(true);
        postToGame({ type: "dunes-intro-ack" });
      }
      if (data.type === "cinder-intro-start") {
        setCinderPlaying(true);
        postToGame({ type: "cinder-intro-ack" });
      }
      if (data.type === "void-intro-start") {
        setVoidPlaying(true);
        postToGame({ type: "void-intro-ack" });
      }
      if (data.type === "story-prologue-start") {
        setProloguePlaying(true);
        postToGame({ type: "story-prologue-ack" });
      }
      if (data.type === "sentinel-cinematic-start") {
        setSentinelScript(data.key || "prologue");
        postToGame({ type: "sentinel-cinematic-ack" });
      }
      if (data.type === "sentinel-village-start") {
        setVillageKeys({ found: foundKeys().length, total: VILLAGE_KEYS.length });
        setVillage({
          cast: data.cast || [],
          talks: data.talks || {},
          focusId: data.focusId || null
        });
        postToGame({ type: "sentinel-village-ack" });
      }
      if (data.type === "player-died") {
        // Practice PvP and spectating never respawn: the game says so here.
        setDeathRespawn(data.respawn !== false);
        setDeathWave(Number(data.wave) || 0);
        setDeathKiller(data.killer || null);
        setDeathPlaying(true);
      }
      // The duel ladder lives in the app: the game reports results and asks for
      // the shared board through this page.
      if (data.type === "player-respawned") {
        // A duel round ended and the room put the fighter back on their mark:
        // clear the death screen so the next round is actually playable.
        setDeathPlaying(false);
      }
      if (data.type === "duel:result") {
        base44.functions
          .invoke("duel_rank", { action: "record", name: data.name, won: !!data.won })
          .catch(() => {});
      }
      if (data.type === "duel:board") {
        base44.functions
          .invoke("duel_rank", { action: "board", name: data.name })
          .then((res) => postToGame({ type: "duel:board:data", rows: res?.data?.rows || [] }))
          .catch(() => postToGame({ type: "duel:board:data", rows: [] }));
      }
      // Crysto asks for one of its films; the world waits behind it until the
      // last beat lands (or the player skips).
      if (data.type === "crysto-cutscene") {
        setCrystoFilm(data.key || "arrival");
        postToGame({ type: "crysto-cutscene-ack" });
      }
      if (data.type === "crysto-cutscene-cancel") setCrystoFilm(null);
      if (data.type === "arena:panel") {
        setCorner({
          mode: data.mode || "none",
          level: data.level || "",
          essence: data.essence || ""
        });
      }
      if (data.type === "auth:request") {
        postAuth();
        postRecords();
      }
      if (data.type === "arena:records-request") {
        postRecords();
      }
      // The fighter's own standing, sent up by the game now and then. One row
      // per account, updated in place, flagged for the developer account so an
      // admin-assisted run never tops the board.
      if (data.type === "arena:progress" && isAuthenticated && user?.id) {
        const payload = {
          player_name: user?.username || user?.full_name || "Fighter",
          rank_level: Math.max(1, Number(data.rank) || 1),
          best_wave: Math.max(0, Number(data.best) || 0),
          kills: Math.max(0, Number(data.kills) || 0),
          staff:
            !!data.staff ||
            String(user?.email || "").toLowerCase() === DEV_ACCOUNT_EMAIL
        };
        const stamp = JSON.stringify(payload);
        if (stamp !== lastRecord.current) {
          lastRecord.current = stamp;
          base44.entities.ArenaRecord.filter({ created_by_id: user.id }, { limit: 1 })
            .then((res) => {
              const rows = Array.isArray(res) ? res : res?.items || [];
              const mine = rows[0];
              return mine
                ? base44.entities.ArenaRecord.update(mine.id, payload)
                : base44.entities.ArenaRecord.create(payload);
            })
            .then(postRecords)
            .catch(() => {});
        }
      }
      if (data.type === "auth:logout") {
        (async () => { await uploadProgress(); logout(true); })();
      }
      if (data.type === "arena:fullscreen") {
        // A phone tap asked for the whole screen. Fullscreen this page rather
        // than the frame: the story cutscenes and death screen live here, so
        // they stay on screen. Always answer, so the game stops asking.
        const el = document.documentElement;
        const req = el.requestFullscreen || el.webkitRequestFullscreen;
        const exit = document.exitFullscreen || document.webkitExitFullscreen;
        const already = !!(document.fullscreenElement || document.webkitFullscreenElement);
        // The button toggles: `on: false` means leave fullscreen again.
        const wantOn = data.on !== false;
        const answer = () =>
          postToGame({
            type: "arena:fullscreen-state",
            on: !!(document.fullscreenElement || document.webkitFullscreenElement)
          });
        const chromeFree = () =>
          !!(window.navigator.standalone === true ||
            window.matchMedia?.("(display-mode: standalone)").matches ||
            window.matchMedia?.("(display-mode: fullscreen)").matches);
        if (wantOn === already) {
          answer();
        } else if (wantOn) {
          if (chromeFree()) { answer(); return; }
          if (!req) { setImmersive(true); return; }
          Promise.resolve(req.call(el, { navigationUI: "hide" })).then(
            answer,
            () => setImmersive(true)
          );
        } else {
          if (immersive.current) setImmersive(false);
          if (!exit) { answer(); return; }
          Promise.resolve(exit.call(document)).then(answer, answer);
        }
      }
    };
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      if (immersive.current) setImmersive(false);
    };
  }, [logout, postToGame, postAuth, postRecords, setImmersive, isAuthenticated, user]);

  // Live match transport. The game frame has no SDK, so this shell owns the
  // realtime room for the match and relays it both ways: the game sends its
  // inputs out, and every snapshot the room pushes comes straight back in.
  useEffect(() => {
    let room = null;
    let sub = null;
    const closeRoom = () => {
      try { sub?.unsubscribe(); } catch {}
      try { room?.close(); } catch {}
      room = null;
      sub = null;
    };

    const onMessage = (e) => {
      const d = e.data || {};
      if (d.type === "net:connect" && typeof d.roomId === "string") {
        closeRoom();
        try {
          room = base44.actors.ArenaRoom(d.roomId).connect({ id: d.connId || crypto.randomUUID() });
          sub = room.subscribe((msg) => postToGame({ type: "net:msg", data: msg }));
        } catch {
          postToGame({ type: "net:closed" });
        }
      } else if (d.type === "net:send" && room) {
        try { room.send(d.data); } catch {}
      } else if (d.type === "net:close") {
        closeRoom();
      }
    };
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      closeRoom();
    };
  }, [postToGame]);

  // Hall presence transport: the walking menu lives in the game frame, so the
  // shell owns its room too — everyone standing in the menu is relayed both
  // ways, which is what puts other players' orbs in the same building.
  useEffect(() => {
    let room = null;
    let sub = null;
    const closeRoom = () => {
      try { sub?.unsubscribe(); } catch {}
      try { room?.close(); } catch {}
      room = null;
      sub = null;
    };
    const onMessage = (e) => {
      const d = e.data || {};
      if (d.type === "hub:join") {
        closeRoom();
        try {
          room = base44.actors.HubRoom("HUB").connect({ id: d.connId || crypto.randomUUID() });
          sub = room.subscribe((msg) => postToGame({ type: "hub:msg", data: msg }));
        } catch {
          postToGame({ type: "hub:closed" });
        }
      } else if (d.type === "hub:send" && room) {
        try { room.send(d.data); } catch {}
      } else if (d.type === "hub:leave") {
        closeRoom();
      }
    };
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      closeRoom();
    };
  }, [postToGame]);

  // Global chat transport: the game frame has no SDK, so this shell reads and
  // writes the chat records and forwards every new line down to the game.
  useEffect(() => {
    const toLine = (r) => ({
      t: new Date(r.created_date).getTime(),
      name: r.name || "Player",
      text: r.text || "",
      rank: Number(r.rank) || 0
    });
    let stopSub = null;
    const startSub = () => {
      if (stopSub) return;
      try {
        stopSub = base44.entities.ChatMessage.subscribe((event) => {
          if (event.type === "create" && event.data) {
            postToGame({ type: "chat:msg", line: toLine(event.data) });
          }
        });
      } catch {
        stopSub = null;
      }
    };
    const loadFeed = async () => {
      const page = await base44.entities.ChatMessage.list("-created_date", 60);
      const items = Array.isArray(page) ? page : page?.items || [];
      postToGame({ type: "chat:history", chat: items.slice().reverse().map(toLine) });
    };
    const onMessage = (e) => {
      const d = e.data || {};
      if (d.type === "chat:load") {
        loadFeed().catch(() => {});
        startSub();
      } else if (d.type === "chat:send" && d.text) {
        base44.entities.ChatMessage.create({
          name: String(d.name || "Player").slice(0, 18),
          text: String(d.text).slice(0, 140),
          rank: Number(d.rank) || 0
        }).catch(() => {});
      }
    };
    window.addEventListener("message", onMessage);
    return () => {
      window.removeEventListener("message", onMessage);
      try { stopSub?.(); } catch {}
      stopSub = null;
    };
  }, [postToGame]);

  const handleLoop = useCallback(() => {
    setCasketPlaying(false);
    postToGame({ type: "casket-cutscene-done" });
  }, [postToGame]);

  const handleHearthIntroDone = useCallback(() => {
    setHearthIntroPlaying(false);
    // Resume the game directly in the iframe: a lost postMessage here used to
    // leave the player stuck on the cutscene with no match starting.
    const w = iframeRef.current?.contentWindow;
    if (w?.Story?.resumeRealm) w.Story.resumeRealm(introRealm);
    // Belt and braces: the message is the game's own resume path and is
    // ignored if the direct call already started the match.
    postToGame({ type: "hearth-warden-intro-done", realm: introRealm });
  }, [introRealm, postToGame]);

  const handleGlacialDone = useCallback(() => {
    setGlacialPlaying(false);
    // Resume the realm directly: a lost postMessage would otherwise drop the
    // player back on the story hub after the cinematic.
    const w = iframeRef.current?.contentWindow;
    if (w?.Story?.resumeRealm) w.Story.resumeRealm(3);
    postToGame({ type: "glacial-archive-done" });
  }, [postToGame]);

  const handleDunesDone = useCallback(() => {
    setDunesPlaying(false);
    const w = iframeRef.current?.contentWindow;
    if (w?.Story?.resumeRealm) w.Story.resumeRealm(2);
    postToGame({ type: "dunes-intro-done" });
  }, [postToGame]);

  const handleCinderDone = useCallback(() => {
    setCinderPlaying(false);
    // Resume the realm directly: a lost postMessage would otherwise drop the
    // player back on the story hub after the cinematic.
    const w = iframeRef.current?.contentWindow;
    if (w?.Story?.resumeRealm) w.Story.resumeRealm(4);
    postToGame({ type: "cinder-intro-done" });
  }, [postToGame]);

  const handleVoidDone = useCallback(() => {
    setVoidPlaying(false);
    const w = iframeRef.current?.contentWindow;
    if (w?.Story?.resumeRealm) w.Story.resumeRealm(5);
    postToGame({ type: "void-intro-done" });
  }, [postToGame]);

  const handleSentinelDone = useCallback(() => {
    setSentinelScript(null);
    // Resume the campaign directly: a lost postMessage would otherwise leave the
    // player looking at a closed cinematic with nothing behind it.
    const w = iframeRef.current?.contentWindow;
    if (w?.SentinelStory?.cinematicDone) w.SentinelStory.cinematicDone();
    postToGame({ type: "sentinel-cinematic-done" });
  }, [postToGame]);

  const handleVillageChoice = useCallback((topicId, value) => {
    setVillage((current) =>
      current ? { ...current, talks: { ...current.talks, [topicId]: value } } : current,
    );
    postToGame({ type: "sentinel-village-choice", topicId, value });
  }, [postToGame]);

  const handleVillageClose = useCallback(() => {
    setVillage(null);
    // Resume the campaign directly: a lost postMessage would otherwise leave the
    // player on a closed village with nothing behind it.
    const w = iframeRef.current?.contentWindow;
    if (w?.SentinelStory?.villageDone) w.SentinelStory.villageDone();
    postToGame({ type: "sentinel-village-done" });
  }, [postToGame]);

  const handleCrystoDone = useCallback(() => {
    setCrystoFilm(null);
    // Resume the world directly: a lost postMessage would otherwise leave the
    // player standing on a closed film with the vale frozen behind it.
    const w = iframeRef.current?.contentWindow;
    if (w?.Crysto?.cutsceneDone) w.Crysto.cutsceneDone();
    postToGame({ type: "crysto-cutscene-done" });
  }, [postToGame]);

  const handlePrologueDone = useCallback(() => {
    setProloguePlaying(false);
    // Resume the story hub directly: a lost postMessage would otherwise leave
    // the player sitting on the closed cutscene with no hub behind it.
    const w = iframeRef.current?.contentWindow;
    if (w?.Story?.prologueDone) w.Story.prologueDone();
    postToGame({ type: "story-prologue-done" });
  }, [postToGame]);

  const handleDeathRise = useCallback(() => {
    setDeathPlaying(false);
    postToGame({ type: "death-restart" });
  }, [postToGame]);

  const handleDeathHome = useCallback(() => {
    setDeathPlaying(false);
    postToGame({ type: "death-home" });
  }, [postToGame]);

  const qs = window.location.search || "";
  const iframeKey = (user?.id || "guest") + (isAuthenticated && user?.gameProgress ? "-cloud" : "-local");
  // Always ask for the current game build: a cached game.html would pin the whole
  // client to an older engine, so a fix ships but the player never sees it.
  const gameSrc = `/game.html?build=${BUILD_TAG}${qs ? "&" + qs.replace(/^\?/, "") : ""}`;

  // Only delay for users holding a token (so their cloud save hydrates before the
  // single iframe load). Guests mount instantly with no flash.
  if (appParams.token && !authChecked) {
    // The corner panel mounts with this first paint, not after the account
    // loads: a bare loading screen would leave the badge uncovered.
    return (
      <>
        <div className="fixed inset-0 grid place-items-center bg-black text-sm tracking-widest text-white/40">LOADING…</div>
        <ArenaCornerPanel
          mode="menu"
          level=""
          essence=""
          keys={villageKeys}
          onReady={() => setPanelReady(true)}
        />
      </>
    );
  }

  return (
    <>
      {/* The corner panel is drawn first and the game frame is only requested
          after it has painted, so the announcements are always on screen before
          anything else. */}
      <ArenaCornerPanel
        mode={village ? "village" : corner.mode}
        level={corner.level}
        essence={corner.essence}
        keys={villageKeys}
        onReady={() => setPanelReady(true)}
      />
      {panelReady && (
        <iframe
          key={iframeKey}
          ref={iframeRef}
          src={gameSrc}
          title="Monster Arena"
          className="fixed inset-0 w-full h-full"
          style={{ border: 0 }}
          allow="autoplay; fullscreen; gamepad; pointer-lock"
          onLoad={() => { postAuth(); interceptGameNav(); setFrameLoads((n) => n + 1); }}
        />
      )}
      {deathPlaying && <DeathWavePanel wave={deathWave} />}
      {casketPlaying && (
        <div className="fixed inset-0 z-[100] bg-black">
          <CursedCasketScene playing restartToken={restartToken} onLoop={handleLoop} />
          <button
            onClick={() => handleLoop()}
            className="absolute top-5 right-5 z-[101] rounded-md border border-white/25 bg-black/60 px-4 py-2 text-xs font-semibold uppercase tracking-widest text-white/90 transition hover:bg-white/10"
          >
            Skip ▸
          </button>
          <p className="pointer-events-none absolute top-2 left-1/2 -translate-x-1/2 z-[101] text-center text-xs uppercase tracking-[0.2em] text-white/55">
            Tap the crypt to feed each soul ▸ the fifth seal opens the casket
          </p>
          <CasketDialogue onDone={handleLoop} />
        </div>
      )}
      {hearthIntroPlaying && <HearthWardenIntroStage onDone={handleHearthIntroDone} />}
      {glacialPlaying && <GlacialArchiveStage onDone={handleGlacialDone} />}
      {dunesPlaying && <DunesIntroStage onDone={handleDunesDone} />}
      {cinderPlaying && <CinderIntroStage onDone={handleCinderDone} />}
      {voidPlaying && <VoidIntroStage onDone={handleVoidDone} />}
      {prologuePlaying && <StoryPrologueStage onDone={handlePrologueDone} />}
      {sentinelScript && <SentinelCinematic scriptKey={sentinelScript} onDone={handleSentinelDone} />}
      {village && (
        <SentinelVillage
          cast={village.cast}
          talks={village.talks}
          focusId={village.focusId}
          onChoose={handleVillageChoice}
          onClose={handleVillageClose}
        />
      )}
      {crystoFilm && <CrystoStage filmKey={crystoFilm} onDone={handleCrystoDone} />}
      {deathPlaying && (
        <div className="fixed inset-0 z-[110] bg-black">
          <DeathScreen
            onRise={handleDeathRise}
            onHome={handleDeathHome}
            canRise={deathRespawn}
            killer={deathKiller}
          />
        </div>
      )}
    </>
  );
}