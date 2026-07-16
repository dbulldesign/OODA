/* Generate build/icon.ico for the Windows desktop-host build.
   Renders the OODA line-art bulb tile (same art as the PWA icons) at the
   standard Windows icon sizes with headless Chromium, then packs the PNGs
   into a multi-resolution .ico. Run: node build/make-ico.cjs */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs');
const path = require('path');

const TILE = '#222B2D', LINE = '#EDE7D8', ACC = '#F2A33C';
const glass = 'M 230 298 C 196 290 150 250 150 196 C 150 120 196 86 256 86 C 316 86 362 120 362 196 C 362 250 316 290 282 298';
const base = 'M 280 300 C 298 305 298 315 279 317 L 234 317 C 215 318 215 329 234 330 L 279 330 C 298 332 298 342 279 343 L 234 343 C 218 345 221 354 236 355 L 262 355 C 275 356 275 365 261 366';
const fila = 'M 256 300 L 256 168 C 256 142 228 142 224 166 C 221 186 250 186 256 168 C 262 186 291 186 288 166 C 284 142 256 142 256 168';

function svg(size) {
  const rx = Math.round(0.22 * 512);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="${size}" height="${size}">
    <rect width="512" height="512" rx="${rx}" fill="${TILE}"/>
    <radialGradient id="h" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${ACC}" stop-opacity=".8"/>
      <stop offset="42%" stop-color="${ACC}" stop-opacity=".34"/>
      <stop offset="100%" stop-color="${ACC}" stop-opacity="0"/></radialGradient>
    <circle cx="256" cy="192" r="150" fill="url(#h)"/>
    <g fill="none" stroke="${LINE}" stroke-width="24" stroke-linecap="round" stroke-linejoin="round">
      <path d="${glass}"/><path d="${base}"/></g>
    <path d="${fila}" fill="none" stroke="${ACC}" stroke-width="22" stroke-linecap="round" stroke-linejoin="round"/>
  </svg>`;
}

function packIco(images) {
  // images: [{size, buf(PNG)}]
  const count = images.length;
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);      // reserved
  header.writeUInt16LE(1, 2);      // type: icon
  header.writeUInt16LE(count, 4);  // image count
  const dir = Buffer.alloc(16 * count);
  let offset = 6 + 16 * count;
  images.forEach((img, i) => {
    const e = 16 * i;
    dir.writeUInt8(img.size >= 256 ? 0 : img.size, e + 0);  // width (0 = 256)
    dir.writeUInt8(img.size >= 256 ? 0 : img.size, e + 1);  // height
    dir.writeUInt8(0, e + 2);       // color count
    dir.writeUInt8(0, e + 3);       // reserved
    dir.writeUInt16LE(1, e + 4);    // color planes
    dir.writeUInt16LE(32, e + 6);   // bits per pixel
    dir.writeUInt32LE(img.buf.length, e + 8);   // size of PNG data
    dir.writeUInt32LE(offset, e + 12);          // offset
    offset += img.buf.length;
  });
  return Buffer.concat([header, dir, ...images.map(i => i.buf)]);
}

(async () => {
  const sizes = [16, 24, 32, 48, 64, 128, 256];
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const page = await browser.newPage();
  const images = [];
  for (const size of sizes) {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<!doctype html><html><body style="margin:0">${svg(size)}</body></html>`);
    const buf = await page.screenshot({ omitBackground: false, clip: { x: 0, y: 0, width: size, height: size } });
    images.push({ size, buf });
  }
  await browser.close();
  const out = path.join(__dirname, 'icon.ico');
  fs.writeFileSync(out, packIco(images));
  console.log('Wrote ' + out + ' (' + images.map(i => i.size).join(', ') + ')');
})();
