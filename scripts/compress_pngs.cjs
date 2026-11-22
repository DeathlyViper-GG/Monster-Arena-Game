// One-off build script: lossy-compress every PNG under public/assets in place
// using palette quantization (<=256 colors) + max zlib effort. Keeps pixel
// resolution; only trims the ~51MB of bloated sprites down to a servable size.
// Run: node scripts/compress_pngs.cjs
const fs = require('fs');
const path = require('path');
const sharp = require('sharp');

const ROOT = path.join(__dirname, '..', 'public', 'assets');
const files = [];
(function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p);
    else if (e.name.toLowerCase().endsWith('.png')) files.push(p);
  }
})(ROOT);

const OPTS = { palette: true, colors: 256, quality: 80, dither: 1.0, compressionLevel: 9, effort: 10 };

(async () => {
  let before = 0, after = 0, changed = 0, skipped = 0, failed = 0;
  for (const f of files) {
    try {
      const src = fs.readFileSync(f);
      before += src.length;
      const out = await sharp(src).png(OPTS).toBuffer();
      if (out.length < src.length) {
        fs.writeFileSync(f, out);
        after += out.length;
        changed++;
      } else {
        after += src.length;
        skipped++;
      }
    } catch (e) {
      after += fs.statSync(f).size;
      failed++;
      console.error('FAIL', f, e.message);
    }
  }
  const mb = (n) => (n / 1048576).toFixed(2);
  console.log(`files: ${files.length} | changed: ${changed} | kept: ${skipped} | failed: ${failed}`);
  console.log(`total: ${mb(before)}MB -> ${mb(after)}MB (-${Math.round((1 - after / before) * 100)}%)`);
})();