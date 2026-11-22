# Deploy Monster Arena to Render (with the cinematic cutscenes)

The game runs as: a **Vite React host** (iframes `game.html` and overlays the
three cinematic cutscenes — Cursed Casket, Hearth Warden, Death Screen —
identically to the Base44 link) + the **Express authoritative server** (the
`/functions/game_server` op-endpoint). Same client, same cutscenes, same
protocol as Base44. No porting, no duplication — the React host imports the
cutscene components from your existing `src/` via a Vite alias.

> Base44 multiplayer is offline only until Integration credits reset on
> 2026-11-01 (workspace billing limit, not a bug). The Render link has no
> such dependency and works immediately.

---

## 1. Render repo layout (flat — all four at the root)

```
monster-arena/
├─ server/                  ← from base44/_orig_server/
│  ├─ signaling_http.js        (Express + op-endpoint + static web/dist)
│  ├─ bots.js
│  ├─ glyph.js
│  └─ package.json
├─ public/                  ← the game (copy the app's public/ folder AS-IS)
│  ├─ game.html, sw.js, three.min.js, google*.html
│  ├─ js/   (pve16.js, story*.js, boss_*.js, render3d*.js, …)
│  └─ css/  (style.css, home_visuals.css, abyss_bg.css, realm_select.css)
├─ src/                     ← the React source for the cutscenes (copy AS-IS)
│  ├─ components/casketCutscene/   (CasketScene, CasketDialogue, shadows, soulCrystals)
│  ├─ components/hearthWardenIntro/ (HearthWardenIntro, HearthWardenIntroStage)
│  ├─ components/deathScreen/      (DeathScreen)
│  ├─ components/ui/               (image + responsive-image chain — used by DeathScreen)
│  ├─ hooks/use-size.jsx
│  └─ lib/utils.js
└─ web/                     ← from base44/_orig_server/web/
   ├─ package.json            (react, react-dom, three, framer-motion, clsx, tailwind-merge)
   ├─ vite.config.js          (alias @ → ../src, publicDir → ../public, outDir → dist)
   ├─ index.html              (mounts Host.jsx inline)
   └─ src/Host.jsx            (the React host: iframe + 3 cutscene overlays)
```

**To assemble:** copy `server/`, `web/` from `base44/_orig_server/`; copy the
app's `public/` and `src/` folders to the repo root. (You can copy the whole
`src/` — only the cutscene + ui + hooks + lib files above are actually
imported by the build; the rest is ignored by tree-shaking.)

---

## 2. Render Web Service settings

- **Runtime:** Node
- **Build Command:**
  ```
  cd web && npm install && npm run build && cd ../server && npm install
  ```
- **Start Command:**
  ```
  cd server && npm start
  ```
- **Plan:** Free works (lobbies are in-memory and reset on sleep; for
  persistent lobbies use a paid plan).

The build produces `web/dist/` containing the React host `index.html` PLUS
the copied `public/` assets (`game.html`, `js/`, `css/`). The Express server
serves `web/dist/` as one static root, so `/` loads the React host and
`/game.html` loads the game. Multiplayer goes to `/functions/game_server`.

---

## 3. How it works (parity with Base44)

1. `/` → React host (`Host.jsx`) renders, mounts an `<iframe src="/game.html">`.
2. The game runs inside the iframe. `window.parent !== window`, so it posts
   cutscene triggers to the parent (same as on Base44):
   - `casket-cutscene-start` → `CursedCasketScene` + `CasketDialogue` overlay
   - `hearth-warden-intro-start` → `HearthWardenIntroStage` overlay
   - `player-died` → `DeathScreen` overlay
3. Host posts the done/restart/home events back; the game continues.
4. Account panel links (`/login` etc.) redirect to `/` (no Base44 auth on
   standalone — the game runs as a guest using localStorage, which it
   already supports).

Result: the cutscenes play **identically** to the Base44 link. Realm intros,
boss death cutscenes, the Hollow fight, gauntlet intro — all already native
JS inside `game.html` — are unchanged.

---

## 4. Updating later

- **Game files changed** → re-copy `public/` into the repo, redeploy.
- **Cutscene components changed** → re-copy `src/` (or the relevant
  component folder), redeploy. The web/ host rebuild picks them up.
- **Server logic changed** → re-copy `server/` from `base44/_orig_server/`.

---

## Gotchas

- **In-memory lobbies:** lobbies live in RAM. On Render's free tier the
  service sleeps after ~15 min idle and lobbies reset — fine for casual
  play. For always-on lobbies, use a paid Render plan.
- **`web/dist` must build before `server` starts:** the build command above
  builds web/ first, so `web/dist` exists when the server starts.
- **Keep the flat layout** (`server/`, `public/`, `src/`, `web/` at the
  repo root) — `web/vite.config.js` resolves `../src` and `../public`
  relative to `web/`.