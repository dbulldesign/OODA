/* Lightbulb logo OPTION — a single-line-drawn bulb that draws on and glows
   (same behaviour idea as the current loop mark). Renders a static geometry
   check + a draw-on/glow storyboard + a live webm. Touches nothing in icons/. */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { renameSync } = require('fs');
const path = require('path');
const OUT = process.argv[2] || '.';
const MODE = process.argv[3] || 'all';
const ACC = '#5FA37A', INK = '#EAF1EE';

// ---- bulb geometry (512 viewBox) ----
const cx = 256, cy = 188, R = 104, D2R = d => d * Math.PI / 180;
const P = (a, r = R) => [cx + r * Math.cos(D2R(a)), cy + r * Math.sin(D2R(a))];
const [glx, gly] = P(116), [grx, gry] = P(64);
// glass: open arc at the bottom (gap ~52°), drawn the long way over the top
const glass = `M ${glx.toFixed(1)} ${gly.toFixed(1)} A ${R} ${R} 0 1 1 ${grx.toFixed(1)} ${gry.toFixed(1)}`;
// neck: short lines from the glass ends down to the metal base
const neck = `M ${glx.toFixed(1)} ${gly.toFixed(1)} L 224 300 M ${grx.toFixed(1)} ${gry.toFixed(1)} L 288 300`;
// base: three stacked, narrowing thread lines (the screw cap)
const base = `M 224 300 L 288 300 M 230 322 L 282 322 M 240 344 L 272 344`;
const SOLID = `${glass} ${neck} ${base}`;
// filament: a little zig-zag inside the glass — this is what "lights up"
const fila = `M 224 206 L 242 162 L 256 200 L 270 162 L 288 206`;

const SW = 28, BW = 24, FW = 15;
function svg(size, { draw = 1, fglow = 0 } = {}) {
  // draw ∈ [0,1] reveal of the outline; fglow ∈ [0,1] filament brightness/glow
  const L = 1000; const off = (L * (1 - Math.min(1, draw / 0.85))).toFixed(0);
  const fdraw = draw < .8 ? 0 : Math.min(1, (draw - .8) / .2);
  const foff = (600 * (1 - fdraw)).toFixed(0);
  const blur = (3 + 5 * fglow).toFixed(1);
  const fop = (0.5 + 0.5 * fglow).toFixed(2);
  return `<svg viewBox="0 0 512 512" width="${size}" height="${size}">
    <defs><filter id="fg" x="-80%" y="-80%" width="260%" height="260%"><feGaussianBlur stdDeviation="${blur}"/></filter></defs>
    <g fill="none" stroke="${ACC}" stroke-linecap="round" stroke-linejoin="round" pathLength="1000"
       stroke-dasharray="1000" stroke-dashoffset="${off}">
      <path d="${glass}" stroke-width="${SW}"/>
      <path d="${neck}" stroke-width="${BW}"/>
      <path d="${base}" stroke-width="${BW}"/>
    </g>
    <g stroke="${INK}" fill="none" stroke-linecap="round" stroke-linejoin="round">
      <path d="${fila}" stroke-width="${FW}" pathLength="600" stroke-dasharray="600" stroke-dashoffset="${foff}"
            opacity="${fop}" filter="url(#fg)"/>
      <path d="${fila}" stroke-width="${FW}" pathLength="600" stroke-dasharray="600" stroke-dashoffset="${foff}"/>
    </g>
  </svg>`;
}

(async () => {
  const b = await chromium.launch();
  // 1) geometry check (final state)
  if (MODE === 'all' || MODE === 'static') {
    const pg = await b.newPage({ viewport: { width: 760, height: 360 } });
    const tile = (bg, label) => `<div style="text-align:center"><div style="width:240px;height:240px;background:${bg};border-radius:30px;display:flex;align-items:center;justify-content:center">${svg(200, { draw: 1, fglow: 1 })}</div><div style="font:600 14px sans-serif;color:#9FB3AD;margin-top:10px">${label}</div></div>`;
    await pg.setContent(`<body style="margin:0;background:#0E1413;display:flex;gap:30px;align-items:center;justify-content:center;height:360px">${tile('#16323f', 'on dark header')}${tile('#FBF7EE', 'on light')}</body>`);
    await pg.screenshot({ path: path.join(OUT, 'bulb-static.png') });
    await pg.close();
  }
  // 2) storyboard of the draw
  if (MODE === 'all' || MODE === 'board') {
    const pg = await b.newPage({ viewport: { width: 820, height: 220 } });
    const ts = [0.12, 0.4, 0.7, 0.9, 1.0];
    const cells = ts.map((t, i) => `<div style="width:130px;height:130px;background:#16323f;border-radius:20px;display:flex;align-items:center;justify-content:center">${svg(110, { draw: t, fglow: t >= 1 ? 1 : 0 })}</div>${i < ts.length - 1 ? '<span style="color:#5a6b66;font-size:20px">→</span>' : ''}`).join('');
    await pg.setContent(`<body style="margin:0;background:#0E1413;padding:30px"><div style="font:700 19px sans-serif;color:#EBE8E0;margin-bottom:18px">Lightbulb option — draws on, then the filament lights & glows</div><div style="display:flex;align-items:center;gap:12px">${cells}</div></body>`);
    await pg.screenshot({ path: path.join(OUT, 'bulb-board.png') });
    await pg.close();
  }
  // 3) live webm (CSS animation)
  if (MODE === 'all' || MODE === 'webm') {
    const css = `
      .out path{stroke-dasharray:1000;stroke-dashoffset:1000;animation:bdraw 1.2s ease-out .2s forwards}
      .fl{stroke-dasharray:600;stroke-dashoffset:600;animation:fdraw .5s ease 1.2s forwards}
      .flg{stroke-dasharray:600;stroke-dashoffset:600;animation:fdraw .5s ease 1.2s forwards, fglow 2.4s ease-in-out 1.7s infinite}
      @keyframes bdraw{to{stroke-dashoffset:0}}
      @keyframes fdraw{to{stroke-dashoffset:0}}
      @keyframes fglow{0%,100%{opacity:.45;filter:drop-shadow(0 0 1px ${ACC})}50%{opacity:1;filter:drop-shadow(0 0 7px ${ACC})}}`;
    const live = `<svg viewBox="0 0 512 512" width="240" height="240">
      <g class="out" fill="none" stroke="${ACC}" stroke-linecap="round" stroke-linejoin="round">
        <path d="${glass}" stroke-width="${SW}"/><path d="${neck}" stroke-width="${BW}"/><path d="${base}" stroke-width="${BW}"/></g>
      <path class="flg" d="${fila}" fill="none" stroke="${INK}" stroke-width="${FW}" stroke-linecap="round" stroke-linejoin="round"/>
      <path class="fl" d="${fila}" fill="none" stroke="${INK}" stroke-width="${FW}" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`;
    const ctx = await b.newContext({ viewport: { width: 320, height: 360 }, recordVideo: { dir: OUT, size: { width: 320, height: 360 } } });
    const pg = await ctx.newPage();
    await pg.setContent(`<style>${css}</style><body style="margin:0;background:#16323f;display:flex;align-items:center;justify-content:center;height:360px">${live}</body>`);
    await pg.waitForTimeout(6500);
    const vp = await pg.video().path();
    await ctx.close();
    renameSync(vp, path.join(OUT, 'bulb-anim.webm'));
  }
  await b.close();
  console.log('done', MODE);
})();
