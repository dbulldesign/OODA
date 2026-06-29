/* Show animation OPTIONS for the rebuilt OODA mark as one short webm:
   a 2x2 grid (Spin · Draw-on · Sync-spin · Pulse) animated live via CSS and
   captured with Playwright's video recorder. Touches nothing in icons/. */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { renameSync } = require('fs');
const path = require('path');
const OUT = process.argv[2] || '.';

const C = 256, D2R = d => (d * Math.PI) / 180;
const P = (deg, r) => [C + r * Math.cos(D2R(deg)), C + r * Math.sin(D2R(deg))];
const ORANGE = '#D8912E', BG = '#222B2D', DOT = '#ECE7DC', R = 120, SW = 38;
const aL = 121, aR = 59;
const [lx, ly] = P(aL, R), [rx, ry] = P(aR, R);
const RING = `M ${lx.toFixed(1)} ${ly.toFixed(1)} A ${R} ${R} 0 1 1 ${rx.toFixed(1)} ${ry.toFixed(1)}`;
const E = P(aR, R), dir = aR + 90, rad = D2R(dir), prad = D2R(dir + 90);
const dx = Math.cos(rad), dy = Math.sin(rad), px = Math.cos(prad), py = Math.sin(prad);
const LEN = 50, HW = 30, BACK = 8;
const tipP = [E[0] + LEN * dx, E[1] + LEN * dy];
const bL = [E[0] - BACK * dx + HW * px, E[1] - BACK * dy + HW * py];
const bR = [E[0] - BACK * dx - HW * px, E[1] - BACK * dy - HW * py];
const HEAD = `M ${tipP[0].toFixed(1)} ${tipP[1].toFixed(1)} L ${bL[0].toFixed(1)} ${bL[1].toFixed(1)} L ${bR[0].toFixed(1)} ${bR[1].toFixed(1)} Z`;
const RINGLEN = (R * D2R(360 - (aL - aR))).toFixed(1);

const ring = (extra = '') => `<path d="${RING}" fill="none" stroke="${ORANGE}" stroke-width="${SW}" stroke-linecap="round" ${extra}/>`;
const head = (extra = '') => `<path d="${HEAD}" fill="${ORANGE}" ${extra}/>`;
const dot = (extra = '') => `<circle cx="${C}" cy="${C}" r="26" fill="${DOT}" ${extra}/>`;
const SIZE = 220;
const cellSvg = (cls, inner) => `<svg class="${cls}" viewBox="0 0 512 512" width="${SIZE}" height="${SIZE}"><defs>
  <filter id="blur" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="24"/></filter></defs>${inner}</svg>`;

const cells = {
  spin: cellSvg('', `<g class="spin">${ring()}${head()}</g>${dot()}`),
  draw: cellSvg('', `<g class="draw">${ring(`stroke-dasharray="${RINGLEN}"`)}${head('class="ah"')}</g>${dot()}`),
  sync: cellSvg('', `<g class="sync">${ring()}${head()}</g>${dot()}`),
  pulse: cellSvg('', `<circle class="glow" cx="${C}" cy="${C}" r="150" fill="${ORANGE}" filter="url(#blur)"/>${ring()}${head()}<circle class="pdot" cx="${C}" cy="${C}" r="26" fill="${DOT}"/>`),
};
const cell = (k, label) => `<div style="text-align:center">
  <div style="width:${SIZE}px;height:${SIZE}px;border-radius:34px;overflow:hidden;background:${BG};box-shadow:0 10px 28px rgba(0,0,0,.45);display:inline-block">${cells[k]}</div>
  <div style="font:600 17px -apple-system,Segoe UI,sans-serif;color:#EBE8E0;margin-top:11px">${label}</div></div>`;

const html = `<!doctype html><html><head><meta charset="utf8"><style>
  *{box-sizing:border-box} svg{transform-box:view-box}
  .spin{transform-origin:256px 256px;animation:spin 3.4s linear infinite}
  @keyframes spin{to{transform:rotate(360deg)}}
  .draw .ah{opacity:0;transform-origin:${tipP[0]}px ${tipP[1]}px}
  .draw path:first-of-type{animation:draw 3.4s ease-in-out infinite}
  .draw .ah{animation:pop 3.4s ease-in-out infinite}
  @keyframes draw{0%{stroke-dashoffset:${RINGLEN}}70%,100%{stroke-dashoffset:0}}
  @keyframes pop{0%,66%{opacity:0;transform:scale(.4)}80%,100%{opacity:1;transform:scale(1)}}
  .sync{transform-origin:256px 256px;animation:sync 3.4s cubic-bezier(.6,0,.2,1) infinite}
  @keyframes sync{0%,55%{transform:rotate(0)}100%{transform:rotate(360deg)}}
  .glow{animation:glow 2.6s ease-in-out infinite;transform-origin:256px 256px}
  .pdot{animation:pdot 2.6s ease-in-out infinite;transform-origin:256px 256px}
  @keyframes glow{0%,100%{opacity:.16;transform:scale(.92)}50%{opacity:.42;transform:scale(1.12)}}
  @keyframes pdot{0%,100%{r:24px}50%{r:33px}}
</style></head><body style="margin:0;background:#0E1413;padding:34px 30px">
  <div style="font:700 22px -apple-system,Segoe UI,sans-serif;color:#EBE8E0;text-align:center;margin-bottom:24px">OODA mark — animation options</div>
  <div style="display:grid;grid-template-columns:1fr 1fr;gap:30px 26px;max-width:520px;margin:0 auto">
    ${cell('spin', '1 · Continuous spin')}${cell('draw', '2 · Draw-on (page load)')}
    ${cell('sync', '3 · Sync spin (on refresh)')}${cell('pulse', '4 · Pulse / glow')}
  </div></body></html>`;

(async () => {
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport: { width: 560, height: 640 }, recordVideo: { dir: OUT, size: { width: 560, height: 640 } } });
  const page = await ctx.newPage();
  await page.setContent(html);
  await page.waitForTimeout(7000); // ~2 cycles
  const vp = await page.video().path();
  await ctx.close();           // finalizes the webm
  await browser.close();
  const dest = path.join(OUT, 'logo-anim-options.webm');
  renameSync(vp, dest);
  console.log('wrote', dest);
})();
