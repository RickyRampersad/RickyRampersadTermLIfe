// The board films' mark (15 October 2026): the branch's own shield and check, white on a violet tile, for the
// midnight electric look. The manager chose the purple look from four and asked that "the yellow logo needs to
// change". The shape is favicon.svg's, untouched; only the colours differ, as gcm-mark.png did for group client
// management. It is embedded in the three films and nowhere else: the site keeps logo-mark.png.
//   node board-mark.js            → board-mark.png (352 × 352, like logo-mark.png)
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs'), path = require('path');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 88 88" width="352" height="352">
  <defs>
    <linearGradient id="t" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#7C5CFF"/><stop offset="55%" stop-color="#4B2FD6"/><stop offset="100%" stop-color="#2A1680"/></linearGradient>
    <linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ffffff"/><stop offset="100%" stop-color="#E4DDFF"/></linearGradient>
  </defs>
  <rect width="88" height="88" rx="18" fill="url(#t)"/>
  <path d="M44 9L73 21.5V41C73 60.5 60.5 72 44 78.5C27.5 72 15 60.5 15 41V21.5Z" fill="url(#s)"/>
  <path d="M30 44L39.5 53.5L58 32.5" stroke="#4B2FD6" stroke-width="6.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M30 44L39.5 53.5L58 32.5" stroke="#00E5FF" stroke-width="2.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  const p = await b.newPage({ viewport: { width: 352, height: 352 }, deviceScaleFactor: 1 });
  await p.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
  await p.screenshot({ path: path.join(__dirname, 'board-mark.png'), omitBackground: true, clip: { x: 0, y: 0, width: 352, height: 352 } });
  await b.close(); console.log('wrote board-mark.png');
})();
