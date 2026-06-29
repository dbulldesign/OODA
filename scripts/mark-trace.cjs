/* Clean SVG rebuild of the favicon: an orange OODA-loop ring (open at the
   bottom) with ONE EVEN, symmetric arrowhead and the cream focal dot.
   Renders side-by-side vs the real PNG to confirm it still reads the same. */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { writeFileSync, readFileSync } = require('fs');
const path = require('path');
const OUT = process.argv[2] || '.';

const C = 256, D2R = d => (d * Math.PI) / 180;
const P = (deg, r) => [C + r * Math.cos(D2R(deg)), C + r * Math.sin(D2R(deg))];
// y-down angles: 0=right 90=bottom 180=left 270=top
const ORANGE = '#D8912E', BG = '#222B2D', DOT = '#ECE7DC';
const R = 120, SW = 38;

// Ring open symmetrically at the bottom: gap centred on 90° (6 o'clock).
// Left end (rounded cap) at 121°, sweeping clockwise to right end at 59°.
const aL = 121, aR = 59;
const [lx, ly] = P(aL, R), [rx, ry] = P(aR, R);
const ring = `M ${lx.toFixed(1)} ${ly.toFixed(1)} A ${R} ${R} 0 1 1 ${rx.toFixed(1)} ${ry.toFixed(1)}`;

// Even arrowhead: a filled, symmetric isosceles triangle at the right end,
// pointing along the clockwise tangent (continuing the loop into the gap).
const E = P(aR, R);
const dir = aR + 90;                    // tangent direction (down-left)
const rad = D2R(dir), prad = D2R(dir + 90);
const dx = Math.cos(rad), dy = Math.sin(rad);     // forward unit
const px = Math.cos(prad), py = Math.sin(prad);   // perpendicular unit
const LEN = 50, HW = 30, BACK = 8;       // tip length, base half-width, base recess
const tipP = [E[0] + LEN * dx, E[1] + LEN * dy];
const bL = [E[0] - BACK * dx + HW * px, E[1] - BACK * dy + HW * py];
const bR = [E[0] - BACK * dx - HW * px, E[1] - BACK * dy - HW * py];
const head = `M ${tipP[0].toFixed(1)} ${tipP[1].toFixed(1)} L ${bL[0].toFixed(1)} ${bL[1].toFixed(1)} L ${bR[0].toFixed(1)} ${bR[1].toFixed(1)} Z`;

const MARK = `<path d="${ring}" fill="none" stroke="${ORANGE}" stroke-width="${SW}" stroke-linecap="round"/>
  <path d="${head}" fill="${ORANGE}" stroke="${ORANGE}" stroke-width="2" stroke-linejoin="round"/>
  <circle cx="${C}" cy="${C}" r="26" fill="${DOT}"/>`;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="320" height="320">
  <rect width="512" height="512" rx="112" fill="${BG}"/>
  ${MARK}
</svg>`;
writeFileSync(path.join(OUT, 'mark.svg'), svg);
writeFileSync(path.join(OUT, 'mark-defs.json'), JSON.stringify({ ORANGE, BG, DOT, R, SW, MARK }));

const pngB64 = readFileSync(path.join(__dirname, '..', 'icons', 'icon-512.png')).toString('base64');
const compare = `<!doctype html><body style="margin:0;background:#0E1413;padding:40px;display:flex;gap:40px;align-items:center;justify-content:center">
  <figure style="margin:0;text-align:center"><img src="data:image/png;base64,${pngB64}" width="320" height="320" style="border-radius:24px"><figcaption style="font:600 16px sans-serif;color:#9FB3AD;margin-top:12px">current favicon</figcaption></figure>
  <figure style="margin:0;text-align:center;border-radius:24px;overflow:hidden">${svg}<figcaption style="font:600 16px sans-serif;color:#9FB3AD;margin-top:12px">rebuilt — even arrow</figcaption></figure>
</body>`;
(async () => {
  const b = await chromium.launch();
  const pg = await b.newPage({ viewport: { width: 820, height: 440 } });
  await pg.setContent(compare);
  await pg.locator('body').screenshot({ path: path.join(OUT, 'mark-compare.png') });
  await b.close();
  console.log('wrote mark-compare.png');
})();
