/* Regenerate favicon + PWA icons as a STATIC lit line-art bulb on the brand
   tile. Thicker strokes than the header mark so it stays legible down to 32px.
   Fixed brand colours (icons aren't themed). Writes into icons/. */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const ICONS = path.join(__dirname, '..', 'icons');
const TILE = '#222B2D', LINE = '#EDE7D8', ACC = '#F2A33C';   // warm-orange filament glow

const glass = 'M 230 298 C 196 290 150 250 150 196 C 150 120 196 86 256 86 C 316 86 362 120 362 196 C 362 250 316 290 282 298';
const base = 'M 280 300 C 298 305 298 315 279 317 L 234 317 C 215 318 215 329 234 330 L 279 330 C 298 332 298 342 279 343 L 234 343 C 218 345 221 354 236 355 L 262 355 C 275 356 275 365 261 366';
const fila = 'M 256 300 L 256 168 C 256 142 228 142 224 166 C 221 186 250 186 256 168 C 262 186 291 186 288 166 C 284 142 256 142 256 168';

function bulbInner(scale = 1) {
  const g = `<g transform="translate(256 200) scale(${scale}) translate(-256 -200)">
    <radialGradient id="h" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${ACC}" stop-opacity=".8"/>
      <stop offset="42%" stop-color="${ACC}" stop-opacity=".34"/>
      <stop offset="100%" stop-color="${ACC}" stop-opacity="0"/></radialGradient>
    <circle cx="256" cy="192" r="150" fill="url(#h)"/>
    <g fill="none" stroke="${LINE}" stroke-width="24" stroke-linecap="round" stroke-linejoin="round">
      <path d="${glass}"/><path d="${base}"/></g>
    <path d="${fila}" fill="none" stroke="${ACC}" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"
      style="filter:drop-shadow(0 0 8px ${ACC})"/></g>`;
  return g;
}
function svg(size, { round = true, maskable = false } = {}) {
  const rx = round ? Math.round((size * 0.22) / size * 512) : 0;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${size}" height="${size}">
    <rect width="512" height="512" rx="${rx}" fill="${TILE}"/>${bulbInner(maskable ? 0.78 : 1)}</svg>`;
}
const jobs = [
  ['icon-512.png', 512, { round: true }],
  ['icon-192.png', 192, { round: true }],
  ['apple-touch-icon.png', 180, { round: false }],
  ['favicon-32.png', 32, { round: true }],
  ['icon-maskable-512.png', 512, { round: false, maskable: true }],
];
(async () => {
  const b = await chromium.launch();
  for (const [name, size, opts] of jobs) {
    const pg = await b.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 });
    await pg.setContent(`<!doctype html><body style="margin:0">${svg(size, opts)}</body>`);
    await pg.locator('svg').screenshot({ path: path.join(ICONS, name) });
    await pg.close();
    console.log('wrote', name, size);
  }
  await b.close();
})();
