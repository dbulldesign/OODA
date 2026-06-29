/* Regenerate the favicon + PWA icons from the rebuilt even-arrow OODA mark.
   Writes into icons/ at every size the manifest/links reference. */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const ICONS = path.join(__dirname, '..', 'icons');

const C = 256, D2R = d => (d * Math.PI) / 180;
const P = (deg, r) => [C + r * Math.cos(D2R(deg)), C + r * Math.sin(D2R(deg))];
const ORANGE = '#D8912E', BG = '#222B2D', DOT = '#ECE7DC', R = 120, SW = 38;
const aL = 121, aR = 59;
const [lx, ly] = P(aL, R), [rx, ry] = P(aR, R);
const RING = `M ${lx.toFixed(1)} ${ly.toFixed(1)} A ${R} ${R} 0 1 1 ${rx.toFixed(1)} ${ry.toFixed(1)}`;
const E = P(aR, R), dir = aR + 90, rad = D2R(dir), prad = D2R(dir + 90);
const dx = Math.cos(rad), dy = Math.sin(rad), px = Math.cos(prad), py = Math.sin(prad);
const tipP = [E[0] + 50 * dx, E[1] + 50 * dy];
const bL = [E[0] - 8 * dx + 30 * px, E[1] - 8 * dy + 30 * py];
const bR = [E[0] - 8 * dx - 30 * px, E[1] - 8 * dy - 30 * py];
const HEAD = `M ${tipP[0].toFixed(1)} ${tipP[1].toFixed(1)} L ${bL[0].toFixed(1)} ${bL[1].toFixed(1)} L ${bR[0].toFixed(1)} ${bR[1].toFixed(1)} Z`;
const MARK = `<path d="${RING}" fill="none" stroke="${ORANGE}" stroke-width="${SW}" stroke-linecap="round"/>
  <path d="${HEAD}" fill="${ORANGE}"/>
  <circle cx="${C}" cy="${C}" r="26" fill="${DOT}"/>`;

// rounded = bg rounded-rect (tab/app icon); maskable = full-bleed + safe-zone scale
function svg(size, { round = true, maskable = false } = {}) {
  const rx = round ? Math.round(size * 0.22) : 0;
  const inner = maskable
    ? `<g transform="translate(256 256) scale(0.8) translate(-256 -256)">${MARK}</g>`
    : MARK;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${size}" height="${size}">
    <rect width="512" height="512" rx="${(rx / size * 512).toFixed(0)}" fill="${BG}"/>${inner}</svg>`;
}

const jobs = [
  ['icon-512.png', 512, { round: true }],
  ['icon-192.png', 192, { round: true }],
  ['apple-touch-icon.png', 180, { round: false }],   // iOS masks its own corners
  ['favicon-32.png', 32, { round: true }],
  ['icon-maskable-512.png', 512, { round: false, maskable: true }],
];

(async () => {
  const b = await chromium.launch();
  for (const [name, size, opts] of jobs) {
    const pg = await b.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await pg.setContent(`<!doctype html><body style="margin:0">${svg(size, opts)}</body>`);
    await pg.locator('svg').screenshot({ path: path.join(ICONS, name), omitBackground: false });
    await pg.close();
    console.log('wrote', name, size);
  }
  await b.close();
})();
