/* Height probe for picking the Crysto cave site. Run: node scripts/cave_probe.cjs */
const fs = require('fs'), vm = require('vm'), path = require('path');
const sandbox = { window: null, console, Math };
sandbox.window = sandbox;
const ctx = vm.createContext(sandbox);
vm.runInContext(fs.readFileSync(path.join('public/js/crysto/noise.js'), 'utf8'), ctx, { filename: 'noise.js' });
const C = sandbox.Crysto;

function line(label, ang, from, to, step) {
  const out = [];
  for (let r = from; r <= to; r += step) {
    const x = Math.cos(ang) * r, z = Math.sin(ang) * r;
    out.push(r + ':' + C.height(x, z).toFixed(0));
  }
  console.log(label, out.join(' '));
}
for (let d = 0; d < 8; d++) line('ang ' + (d * 45) + '°', (d * 45) * Math.PI / 180, 600, 1400, 100);

console.log('\n-- candidate crags --');
const spots = [[420, 700], [500, 800], [-500, 760], [760, 500], [300, 900], [620, 700], [700, 820], [-700, 700]];
spots.forEach(([x, z]) => {
  console.log('(' + x + ',' + z + ') h=' + C.height(x, z).toFixed(0) + ' slope=' + C.slope(x, z).toFixed(2));
});