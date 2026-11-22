#!/usr/bin/env bash
# build_render.sh — assembles a complete Render-ready bundle into ./render/
# Usage:  bash build_render.sh
# Output: render/  with the flat layout (server/ public/ src/ web/)
set -euo pipefail

ROOT="$(cd "$(dirname "$0")" && pwd)"
OUT="$ROOT/render"

echo "==> Building Render bundle at: $OUT"

# --- clean previous bundle ---
rm -rf "$OUT"
mkdir -p "$OUT"

# --- 1. server/  (from base44/_orig_server/) ---
echo "   copying server/ ..."
mkdir -p "$OUT/server"
cp "$ROOT/base44/_orig_server/signaling_http.js" "$OUT/server/"
cp "$ROOT/base44/_orig_server/bots.js"          "$OUT/server/"
cp "$ROOT/base44/_orig_server/glyph.js"         "$OUT/server/"
cp "$ROOT/base44/_orig_server/package.json"     "$OUT/server/"
cp "$ROOT/base44/_orig_server/RENDER_DEPLOY.md"  "$OUT/" 2>/dev/null || true

# --- 2. public/  (the game client — copy whole folder) ---
echo "   copying public/ ..."
cp -R "$ROOT/public" "$OUT/public"

# --- 3. src/  (React cutscene source — copy whole folder) ---
echo "   copying src/ ..."
cp -R "$ROOT/src" "$OUT/src"

# --- 4. web/  (Vite React host) ---
echo "   copying web/ ..."
cp -R "$ROOT/base44/_orig_server/web" "$OUT/web"

# --- done ---
echo ""
echo "==> Done. Structure:"
( cd "$OUT" && find . -maxdepth 2 -type d | sort )
echo ""
echo "File counts:"
echo "   server: $(find "$OUT/server" -type f | wc -l) files"
echo "   public: $(find "$OUT/public" -type f | wc -l) files"
echo "   src:    $(find "$OUT/src"    -type f | wc -l) files"
echo "   web:    $(find "$OUT/web"    -type f | wc -l) files"
echo ""
echo "Next: push ./render/ to a new git repo, connect to Render, and set:"
echo "   Build:  cd web && npm install && npm run build && cd ../server && npm install"
echo "   Start:  cd server && npm start"
echo "   See RENDER_DEPLOY.md for full details."