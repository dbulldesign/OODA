/* Static storyboard: each animation option as a row of keyframes (left→right),
   so the motion is legible even without playing the video. */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
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
const tipP = [E[0] + 50 * dx, E[1] + 50 * dy];
const bL = [E[0] - 8 * dx + 30 * px, E[1] - 8 * dy + 30 * py];
const bR = [E[0] - 8 * dx - 30 * px, E[1] - 8 * dy - 30 * py];
const HEAD = `M ${tipP[0].toFixed(1)} ${tipP[1].toFixed(1)} L ${bL[0].toFixed(1)} ${bL[1].toFixed(1)} L ${bR[0].toFixed(1)} ${bR[1].toFixed(1)} Z`;
const RINGLEN = R * D2R(360 - (aL - aR));
const ease = t => t < .5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
function frame(kind, t) {
  if (kind === 'spin' || kind === 'sync') {
    const ang = kind === 'spin' ? 360 * t : (t < .5 ? 0 : 360 * ease((t - .5) / .5));
    return `<g transform="rotate(${ang.toFixed(0)} ${C} ${C})"><path d="${RING}" fill="none" stroke="${ORANGE}" stroke-width="${SW}" stroke-linecap="round"/><path d="${HEAD}" fill="${ORANGE}"/></g><circle cx="${C}" cy="${C}" r="26" fill="${DOT}"/>`;
  }
  if (kind === 'draw') {
    const p = ease(Math.min(1, t / .82)); const off = RINGLEN * (1 - p);
    const hv = t > .80 ? Math.min(1, (t - .80) / .15) : 0;
    return `<path d="${RING}" fill="none" stroke="${ORANGE}" stroke-width="${SW}" stroke-linecap="round" stroke-dasharray="${RINGLEN.toFixed(0)}" stroke-dashoffset="${off.toFixed(0)}"/><path d="${HEAD}" fill="${ORANGE}" opacity="${hv.toFixed(2)}"/><circle cx="${C}" cy="${C}" r="26" fill="${DOT}" opacity="${(.3 + .7 * p).toFixed(2)}"/>`;
  }
  if (kind === 'pulse') {
    const s = Math.sin(2 * Math.PI * t); const dr = 26 + 7 * s; const go = (.18 + .2 * (s + 1) / 2).toFixed(2); const gr = 150 + 16 * s;
    return `<circle cx="${C}" cy="${C}" r="${gr.toFixed(0)}" fill="${ORANGE}" opacity="${go}" filter="url(#blur)"/><path d="${RING}" fill="none" stroke="${ORANGE}" stroke-width="${SW}" stroke-linecap="round"/><path d="${HEAD}" fill="${ORANGE}"/><circle cx="${C}" cy="${C}" r="${dr.toFixed(1)}" fill="${DOT}"/>`;
  }
}
const S = 120;
const tile = (kind, t) => `<div style="width:${S}px;height:${S}px;border-radius:20px;overflow:hidden;background:${BG};display:inline-block"><svg viewBox="0 0 512 512" width="${S}" height="${S}"><defs><filter id="blur" x="-60%" y="-60%" width="220%" height="220%"><feGaussianBlur stdDeviation="22"/></filter></defs>${frame(kind, t)}</svg></div>`;
const ROWS = [['spin', 'Continuous spin'], ['draw', 'Draw-on (page load)'], ['sync', 'Sync spin (on refresh)'], ['pulse', 'Pulse / glow']];
const ts = [0, .25, .5, .75, .95];
const rowHtml = ([k, label]) => `<div style="display:flex;align-items:center;gap:14px;margin-bottom:18px">
  <div style="width:160px;font:600 16px -apple-system,Segoe UI,sans-serif;color:#EBE8E0;text-align:right">${label}</div>
  <div style="display:flex;gap:10px;align-items:center">${ts.map((t, i) => tile(k, t) + (i < ts.length - 1 ? '<span style="color:#5a6b66;font-size:18px">→</span>' : '')).join('')}</div></div>`;
(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 980, height: 700 } });
  await pg.setContent(`<!doctype html><body style="margin:0;background:#0E1413;padding:36px 30px">
    <div style="font:700 22px -apple-system,Segoe UI,sans-serif;color:#EBE8E0;margin-bottom:6px">OODA mark — animation options (keyframes left → right)</div>
    <div style="font:400 14px -apple-system,Segoe UI,sans-serif;color:#9FB3AD;margin-bottom:26px">Same even-arrow mark; each row is one motion style over one cycle.</div>
    ${ROWS.map(rowHtml).join('')}</body>`);
  await pg.locator('body').screenshot({ path: path.join(OUT, 'logo-anim-board.png') });
  await b.close();
  console.log('wrote logo-anim-board.png');
})();
