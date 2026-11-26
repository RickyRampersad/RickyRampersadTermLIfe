// The group client management mark in teal (26 November 2026): the branch's own shield and check from favicon.svg,
// untouched, white on a teal tile, for the group pages and the group e-mails once they moved off the corporate blue
// ("Still seeing the blue!!!!"; the manager then took the recommendation: branch teal, as the homepage). gcm-mark.png,
// the blue one, is kept: the letters already sent load it from the server.
//   node tools/brand/gcm-mark-teal.js   → groupclientmanagement/gcm-mark-teal.png (352 × 352, like gcm-mark.png)
const { chromium } = require('playwright');
const path = require('path');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 88 88" width="352" height="352">
  <defs>
    <linearGradient id="t" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#0E93B0"/><stop offset="55%" stop-color="#00728D"/><stop offset="100%" stop-color="#0A4A52"/></linearGradient>
    <linearGradient id="s" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stop-color="#ffffff"/><stop offset="100%" stop-color="#E2F1F3"/></linearGradient>
  </defs>
  <rect width="88" height="88" rx="18" fill="url(#t)"/>
  <path d="M44 9L73 21.5V41C73 60.5 60.5 72 44 78.5C27.5 72 15 60.5 15 41V21.5Z" fill="url(#s)"/>
  <path d="M30 44L39.5 53.5L58 32.5" stroke="#0A4A52" stroke-width="6.5" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
  <path d="M30 44L39.5 53.5L58 32.5" stroke="#2FB3C9" stroke-width="2.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 352, height: 352 }, deviceScaleFactor: 1 });
  await p.setContent(`<html><body style="margin:0;background:transparent">${svg}</body></html>`);
  const out = path.join(__dirname, '..', '..', 'groupclientmanagement', 'gcm-mark-teal.png');
  await p.screenshot({ path: out, omitBackground: true, clip: { x: 0, y: 0, width: 352, height: 352 } });
  await b.close(); console.log('wrote ' + out);
})();
