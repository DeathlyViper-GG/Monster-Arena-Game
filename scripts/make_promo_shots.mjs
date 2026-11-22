// Builds the three promo images the email embeds: dark arena plates with the
// game's own sprites, so the mail always has art that matches the game and
// never depends on a third-party image host.
// Run: node scripts/make_promo_shots.mjs
import sharp from "sharp";
import fs from "node:fs";
import path from "node:path";

const W = 1200;
const H = 600;
const OUT = "public/promo";

const PLATES = [
  { file: "waves.png", accent: "#ff5f57", glow: "#7a1f2a", box: [320, 330],
    sprites: ["public/assets/monsters/void-seraph.png", "public/assets/monsters/gorgon-x.png", "public/assets/monsters/hellforged.png"] },
  { file: "arsenal.png", accent: "#ffc25c", glow: "#6b4a12", box: [380, 210],
    sprites: ["public/assets/guns/rifles/rifle1.png", "public/assets/guns/shotguns/shotgun2.png", "public/assets/guns/pistols/pistol3.png"] },
  { file: "glyphs.png", accent: "#9fe3ff", glow: "#123a52", box: [300, 300],
    sprites: ["public/assets/glyphs/fire/fire1.png", "public/assets/glyphs/water/water1.png", "public/assets/glyphs/earth/earth1.png"] },
];

function backdrop(accent, glow) {
  return Buffer.from(`<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <radialGradient id="pool" cx="50%" cy="46%" r="62%">
        <stop offset="0%" stop-color="${glow}" stop-opacity="0.95"/>
        <stop offset="55%" stop-color="#101828" stop-opacity="0.9"/>
        <stop offset="100%" stop-color="#05070d" stop-opacity="1"/>
      </radialGradient>
      <linearGradient id="floor" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="${accent}" stop-opacity="0.42"/>
        <stop offset="100%" stop-color="${accent}" stop-opacity="0"/>
      </linearGradient>
      <linearGradient id="vignette" x1="0" y1="0" x2="1" y2="1">
        <stop offset="0%" stop-color="#000000" stop-opacity="0.55"/>
        <stop offset="45%" stop-color="#000000" stop-opacity="0"/>
        <stop offset="100%" stop-color="#000000" stop-opacity="0.7"/>
      </linearGradient>
    </defs>
    <rect width="${W}" height="${H}" fill="#05070d"/>
    <rect width="${W}" height="${H}" fill="url(#pool)"/>
    <g opacity="0.18">
      ${Array.from({ length: 13 }, (_, i) => {
        const x = (i / 12) * W;
        return `<line x1="${x}" y1="${H * 0.62}" x2="${W / 2 + (x - W / 2) * 2.6}" y2="${H}" stroke="${accent}" stroke-width="2"/>`;
      }).join("")}
      ${Array.from({ length: 5 }, (_, i) => {
        const y = H * 0.62 + (i / 5) * (H * 0.38);
        return `<line x1="0" y1="${y}" x2="${W}" y2="${y}" stroke="${accent}" stroke-width="1.4"/>`;
      }).join("")}
    </g>
    <rect x="0" y="${H * 0.62}" width="${W}" height="${H * 0.38}" fill="url(#floor)" opacity="0.25"/>
    <ellipse cx="${W / 2}" cy="${H * 0.79}" rx="${W * 0.46}" ry="26" fill="${accent}" opacity="0.16"/>
    <rect width="${W}" height="${H}" fill="url(#vignette)"/>
    <rect x="0" y="0" width="${W}" height="4" fill="${accent}" opacity="0.55"/>
  </svg>`);
}

fs.mkdirSync(OUT, { recursive: true });

for (const plate of PLATES) {
  const base = await sharp({ create: { width: W, height: H, channels: 4, background: "#05070d" } })
    .composite([{ input: backdrop(plate.accent, plate.glow), top: 0, left: 0 }])
    .png()
    .toBuffer();

  const layers = [];
  const centres = [300, 600, 900];

  for (let i = 0; i < plate.sprites.length; i++) {
    const src = plate.sprites[i];
    const height = i === 1 ? plate.box[1] * 1.08 : plate.box[1];
    const sprite = await sharp(src)
      .resize({ width: plate.box[0], height: Math.round(height), fit: "inside" })
      .png()
      .toBuffer();
    const meta = await sharp(sprite).metadata();
    const left = Math.round(centres[i] - meta.width / 2);
    const top = Math.round(H * 0.52 - meta.height / 2 + (i === 1 ? 0 : 16));

    const glow = await sharp(sprite).blur(26).ensureAlpha(0.5).png().toBuffer();
    layers.push({ input: glow, left, top, blend: "screen" });
    layers.push({ input: sprite, left, top, blend: "over" });
  }

  const out = path.join(OUT, plate.file);
  await sharp(base).composite(layers).png({ compressionLevel: 9 }).toFile(out);
  const stat = await sharp(out).stats();
  console.log(out, fs.statSync(out).size, "bytes", "mean=", stat.channels.map((c) => c.mean.toFixed(1)).join(","));
}