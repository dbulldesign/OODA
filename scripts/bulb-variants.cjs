/* Render bulb VARIANTS so the user can pick a filament + base style. */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const OUT = process.argv[2] || '.';
const ACC = '#5FA37A', INK = '#EAF1EE';
const cx = 256, cy = 188, R = 104, D2R = d => d * Math.PI / 180;
const P = (a, r = R) => [cx + r * Math.cos(D2R(a)), cy + r * Math.sin(D2R(a))];
const [glx, gly] = P(116), [grx, gry] = P(64);
const glass = `M ${glx.toFixed(1)} ${gly.toFixed(1)} A ${R} ${R} 0 1 1 ${grx.toFixed(1)} ${gry.toFixed(1)}`;
const neck = `M ${glx.toFixed(1)} ${gly.toFixed(1)} L 224 300 M ${grx.toFixed(1)} ${gry.toFixed(1)} L 288 300`;
const SW = 28, BW = 24, FW = 15;

const FILAMENTS = {
  zigzag: `M 224 206 L 242 162 L 256 200 L 270 162 L 288 206`,
  loop:   `M 238 214 L 238 184 A 18 18 0 1 0 274 184 L 274 214`,   // two posts + glowing loop
  coil:   `M 226 198 C 232 170 248 170 252 198 C 256 226 272 226 278 198`, // spring/coil
  vee:    `M 234 166 L 256 212 L 278 166`,                         // minimal V
};
const BASES = {
  stacked: `M 224 300 L 288 300 M 230 322 L 282 322 M 240 344 L 272 344`,
  trapez:  `M 222 300 L 290 300 L 280 340 L 232 340 Z M 244 358 L 268 358`,
  rounded: `M 226 300 L 286 300 A 6 6 0 0 1 292 308 L 288 332 A 14 14 0 0 1 274 346 L 238 346 A 14 14 0 0 1 224 332 L 220 308 A 6 6 0 0 1 226 300 Z M 246 360 L 266 360`,
};

function bulb(size, filKey, baseKey) {
  const fila = FILAMENTS[filKey], base = BASES[baseKey];
  return `<svg viewBox="0 0 512 512" width="${size}" height="${size}">
    <defs><filter id="fg" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="6"/></filter></defs>
    <g fill="none" stroke="${ACC}" stroke-linecap="round" stroke-linejoin="round">
      <path d="${glass}" stroke-width="${SW}"/><path d="${neck}" stroke-width="${BW}"/><path d="${base}" stroke-width="${BW}"/></g>
    <path d="${fila}" fill="none" stroke="${INK}" stroke-width="${FW}" stroke-linecap="round" stroke-linejoin="round" opacity=".8" filter="url(#fg)"/>
    <path d="${fila}" fill="none" stroke="${INK}" stroke-width="${FW}" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}
const tile = (svg, label) => `<div style="text-align:center"><div style="width:128px;height:128px;background:#16323f;border-radius:20px;display:flex;align-items:center;justify-content:center">${svg}</div><div style="font:600 13px sans-serif;color:#cfe0db;margin-top:8px">${label}</div></div>`;

(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 720, height: 560 } });
  const filRow = Object.keys(FILAMENTS).map(k => tile(bulb(108, k, 'stacked'), 'filament: ' + k)).join('');
  const baseRow = Object.keys(BASES).map(k => tile(bulb(108, 'loop', k), 'base: ' + k)).join('');
  await pg.setContent(`<body style="margin:0;background:#0E1413;padding:34px 26px">
    <div style="font:700 20px sans-serif;color:#EBE8E0;margin-bottom:4px">Bulb — pick a filament + a base</div>
    <div style="font:400 13px sans-serif;color:#9FB3AD;margin-bottom:20px">Filament is the bit that lights up &amp; glows. Base is the screw cap. Mix any filament with any base.</div>
    <div style="font:600 13px sans-serif;color:#7d918c;margin:6px 0 10px">FILAMENTS (base held constant)</div>
    <div style="display:flex;gap:18px;margin-bottom:26px">${filRow}</div>
    <div style="font:600 13px sans-serif;color:#7d918c;margin:6px 0 10px">BASES (filament held constant)</div>
    <div style="display:flex;gap:18px">${baseRow}</div>
  </body>`);
  await pg.screenshot({ path: path.join(OUT, 'bulb-variants.png') });
  await b.close();
  console.log('wrote bulb-variants.png');
})();
