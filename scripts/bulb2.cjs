/* Refined continuous-line lightbulb (matches the reference): thin line-art
   glass + coiled screw base + a real two-loop filament. Renders states:
   draw-in→light, running(pulse), completed(burst). MODE = static|board|webm|all */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { renameSync } = require('fs');
const path = require('path');
const OUT = process.argv[2] || '.';
const MODE = process.argv[3] || 'all';
const INK = '#1c1c1c', INKD = '#EAF1EE', ACC = '#5FA37A';

// ---- geometry (512 viewBox) ----
const glass = 'M 230 298 C 196 290 150 250 150 196 C 150 120 196 86 256 86 C 316 86 362 120 362 196 C 362 250 316 290 282 298';
const base = [
  'M 280 300 C 298 305 298 315 279 317 L 234 317',
  'C 215 318 215 329 234 330 L 279 330',
  'C 298 332 298 342 279 343 L 234 343',
  'C 218 345 221 354 236 355 L 262 355 C 275 356 275 365 261 366'
].join(' ');
const filament = [
  'M 256 300 L 256 168',                          // stem
  'C 256 142 228 142 224 166 C 221 186 250 186 256 168',  // left loop
  'C 262 186 291 186 288 166 C 284 142 256 142 256 168'   // right loop
].join(' ');

function bulbSvg(size, { ink = INKD, draw = 1, light = 0, burst = 0, rays = 0 } = {}) {
  // draw: 0..1 outline reveal; light: 0..1 filament glow; burst: 0..1 flash scale
  const oOff = (1400 * (1 - Math.min(1, draw / 0.8))).toFixed(0);
  const fdraw = draw < .75 ? 0 : Math.min(1, (draw - .75) / .25);
  const fOff = (520 * (1 - fdraw)).toFixed(0);
  const gOp = (0.0 + 0.6 * light + 0.4 * burst).toFixed(2);
  const haloR = (150 + 70 * light + 150 * burst).toFixed(0); // emanates beyond the glass
  const flCol = light > .02 || burst > 0 ? ACC : ink;
  const rayG = rays > 0 ? raysMarkup(rays) : '';
  const sc = (1 + 0.06 * burst).toFixed(3);
  return `<svg viewBox="0 0 512 512" width="${size}" height="${size}" overflow="visible">
    <defs><radialGradient id="halo" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${ACC}" stop-opacity="0.85"/>
      <stop offset="42%" stop-color="${ACC}" stop-opacity="0.38"/>
      <stop offset="100%" stop-color="${ACC}" stop-opacity="0"/></radialGradient></defs>
    <circle cx="256" cy="188" r="${haloR}" fill="url(#halo)" opacity="${gOp}"/>
    <g transform="translate(256 230) scale(${sc}) translate(-256 -230)">
      ${rayG}
      <g fill="none" stroke="${ink}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round">
        <path d="${glass}" pathLength="1400" stroke-dasharray="1400" stroke-dashoffset="${oOff}"/>
        <path d="${base}" pathLength="1400" stroke-dasharray="1400" stroke-dashoffset="${oOff}"/>
      </g>
      <path d="${filament}" fill="none" stroke="${flCol}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"
        pathLength="520" stroke-dasharray="520" stroke-dashoffset="${fOff}"
        style="filter:drop-shadow(0 0 ${(2 + 6 * light + 8 * burst).toFixed(1)}px ${ACC})"/>
    </g>
  </svg>`;
}
function raysMarkup(k) {
  let s = '<g stroke="' + ACC + '" stroke-width="7" stroke-linecap="round" opacity="' + (0.9 * k).toFixed(2) + '">';
  const cx = 256, cy = 150, n = 8, r0 = 120, r1 = 120 + 46 * k;
  for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2 - Math.PI / 2;
    s += `<line x1="${(cx + r0 * Math.cos(a)).toFixed(0)}" y1="${(cy + r0 * Math.sin(a)).toFixed(0)}" x2="${(cx + r1 * Math.cos(a)).toFixed(0)}" y2="${(cy + r1 * Math.sin(a)).toFixed(0)}"/>`; }
  return s + '</g>';
}

(async () => {
  const b = await chromium.launch();
  if (MODE === 'all' || MODE === 'static') {
    const pg = await b.newPage({ viewport: { width: 860, height: 320 } });
    const tile = (bg, ink, opts, label) => `<div style="text-align:center"><div style="width:200px;height:200px;background:${bg};border-radius:26px;display:flex;align-items:center;justify-content:center">${bulbSvg(180, { ink, ...opts })}</div><div style="font:600 13px sans-serif;color:#9FB3AD;margin-top:9px">${label}</div></div>`;
    await pg.setContent(`<body style="margin:0;background:#0E1413;display:flex;gap:26px;align-items:center;justify-content:center;height:320px">
      ${tile('#16323f', INKD, { draw: 1, light: 0 }, 'drawn (off)')}
      ${tile('#16323f', INKD, { draw: 1, light: 1 }, 'lit / glowing')}
      ${tile('#16323f', INKD, { draw: 1, light: 1, burst: 1, rays: 1 }, 'completed (burst)')}
      ${tile('#FBF7EE', INK, { draw: 1, light: .5 }, 'on light theme')}
    </body>`);
    await pg.screenshot({ path: path.join(OUT, 'bulb2-static.png') }); await pg.close();
  }
  if (MODE === 'all' || MODE === 'board') {
    const pg = await b.newPage({ viewport: { width: 880, height: 200 } });
    const steps = [{ draw: .15 }, { draw: .5 }, { draw: .8 }, { draw: 1, light: .4 }, { draw: 1, light: 1 }];
    const cells = steps.map((o, i) => `<div style="width:128px;height:128px;background:#16323f;border-radius:18px;display:flex;align-items:center;justify-content:center">${bulbSvg(112, { ink: INKD, ...o })}</div>${i < steps.length - 1 ? '<span style="color:#5a6b66;font-size:20px">→</span>' : ''}`).join('');
    await pg.setContent(`<body style="margin:0;background:#0E1413;padding:28px"><div style="font:700 18px sans-serif;color:#EBE8E0;margin-bottom:16px">Bulb — line draws in, filament connects &amp; lights up</div><div style="display:flex;align-items:center;gap:12px">${cells}</div></body>`);
    await pg.screenshot({ path: path.join(OUT, 'bulb2-board.png') }); await pg.close();
  }
  if (MODE === 'all' || MODE === 'webm') {
    const css = `
      .ol path{stroke-dasharray:1400;stroke-dashoffset:1400;animation:od 1.4s ease-out .2s forwards}
      .fl{stroke-dasharray:520;stroke-dashoffset:520;animation:fd .55s ease 1.5s forwards, lit .1s linear 2.05s forwards}
      .glw{opacity:0;animation:glw .6s ease 2.05s forwards}
      @keyframes od{to{stroke-dashoffset:0}} @keyframes fd{to{stroke-dashoffset:0}}
      @keyframes lit{to{stroke:${ACC}}} @keyframes glw{to{opacity:.6}}
      /* running: pulse — halo breathes OUTSIDE the glass */
      .run .glw{animation:glw .6s ease 2.05s forwards, pul 2.2s ease-in-out 2.7s infinite}
      .run .fl{animation:fd .55s ease 1.5s forwards, lit .1s linear 2.05s forwards, flp 2.2s ease-in-out 2.7s infinite}
      @keyframes pul{0%,100%{opacity:.4;transform:scale(.9)}50%{opacity:.72;transform:scale(1.25)}}
      @keyframes flp{0%,100%{filter:drop-shadow(0 0 2px ${ACC})}50%{filter:drop-shadow(0 0 9px ${ACC})}}
      .glw{transform-box:fill-box;transform-origin:center}`;
    const halo = `<defs><radialGradient id="halo" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="${ACC}" stop-opacity="0.85"/>
        <stop offset="42%" stop-color="${ACC}" stop-opacity="0.38"/>
        <stop offset="100%" stop-color="${ACC}" stop-opacity="0"/></radialGradient></defs>`;
    const mk = cls => `<svg class="${cls}" viewBox="0 0 512 512" width="200" height="200" overflow="visible">
      ${halo}<circle class="glw" cx="256" cy="188" r="175" fill="url(#halo)" opacity="0"/>
      <g class="ol" fill="none" stroke="${INKD}" stroke-width="9" stroke-linecap="round" stroke-linejoin="round">
        <path d="${glass}"/><path d="${base}"/></g>
      <path class="fl" d="${filament}" fill="none" stroke="${INKD}" stroke-width="8" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
    const ctx = await b.newContext({ viewport: { width: 520, height: 300 }, recordVideo: { dir: OUT, size: { width: 520, height: 300 } } });
    const pg = await ctx.newPage();
    await pg.setContent(`<style>${css}</style><body style="margin:0;background:#16323f;display:flex;align-items:center;justify-content:center;gap:40px;height:300px">
      <div style="text-align:center">${mk('')}<div style="font:600 13px sans-serif;color:#cfe0db;margin-top:6px">draw-in → light</div></div>
      <div style="text-align:center">${mk('run')}<div style="font:600 13px sans-serif;color:#cfe0db;margin-top:6px">timer running (pulse)</div></div>
    </body>`);
    await pg.waitForTimeout(7000);
    const vp = await pg.video().path(); await ctx.close();
    renameSync(vp, path.join(OUT, 'bulb2-anim.webm'));
  }
  await b.close();
  console.log('done', MODE);
})();
