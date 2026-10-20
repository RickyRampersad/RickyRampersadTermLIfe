// Wall Intelligence, driven on a real screen (20 October 2026).
//
// The sample read (?demo=1) through every scene, inside and outside: nothing
// breaks, nothing spills off a TV, the outside screen never shows a dollar, an
// arrival time or a week below someone's usual, and with sound on and no
// recording or Andrew voice to hand the wall still moves on by itself.
//
// Run: node tests/e2e-wall2.js   (needs playwright + a chromium on disk)
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const server = http.createServer((q, r) => {
  let f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { r.writeHead(404); return r.end('no'); }
  r.writeHead(200, { 'Content-Type': f.endsWith('.html') ? 'text/html' : f.endsWith('.mp3') ? 'audio/mpeg' : 'application/octet-stream' });
  fs.createReadStream(f).pipe(r);
});
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };

(async () => {
  await new Promise(r => server.listen(8798, r));
  const b = await chromium.launch({ executablePath: CHROME });
  for (const view of ['inside', 'outside']) {
    console.log('\n' + view + ':\n');
    const page = await b.newPage({ viewport: { width: 1920, height: 1080 } });
    const errs = []; page.on('pageerror', e => errs.push(String(e)));
    await page.route('**/macros/s/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":false}' }));
    await page.route('**/fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await page.goto('http://localhost:8798/wall/?demo=1' + (view === 'outside' ? '&view=outside' : ''), { waitUntil: 'domcontentloaded' });
    await page.click('#goQuiet');
    const seen = [], spill = [], text = [];
    for (let i = 0; i < 9; i++) {
      await page.waitForTimeout(2300);
      const k = await page.evaluate(() => { const e = document.querySelector('.scene.on .kick'); return e ? e.innerText : 'ident'; });
      seen.push(k);
      const bad = await page.evaluate(() => [...document.querySelectorAll('.scene.on .panel, .scene.on .tile')].filter(p => p.scrollWidth > p.clientWidth + 6).length);
      if (bad) spill.push(k);
      text.push(await page.evaluate(() => document.querySelector('.scene.on').innerText));
      await page.keyboard.press('ArrowRight');
    }
    ok('nine scenes, staff to live', seen.length === 9 && new Set(seen).size === 9 && /LIVE/.test(seen[8]), seen.join(' | '));
    ok('nothing spills sideways', !spill.length, spill.join(', '));
    ok('no page errors', !errs.length, errs.join(' | '));
    ok('the sample is marked', /SAMPLE/.test(await page.innerText('#mode')));
    const all = text.join('\n');
    if (view === 'outside') {
      ok('no dollars', !/\$\d/.test(all));
      ok('no arrival times or lateness', !/In at \d|min after the start/.test(all));
      ok('no week below someone\'s usual', !/-\d+% on their usual/.test(all));
      ok('who is out, by name', /Sasha/.test(all) && /Out today/i.test(all));
    } else {
      ok('inside: arrival times and dollars', /In at 6:55/.test(all) && /\$412k/.test(all));
    }
    await page.close();
  }
  // Sound on, no recording and no Andrew voice in this browser: captions, and the wall still moves on by itself.
  const page = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.route('**/macros/s/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":false}' }));
  await page.route('**/fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.goto('http://localhost:8798/wall/?demo=1', { waitUntil: 'domcontentloaded' });
  await page.click('#goSound');
  await page.waitForTimeout(1500);
  ok('the caption carries Andrew\'s line', /Ricky Rampersad Branch, live/.test(await page.innerText('#capText')));
  await page.waitForTimeout(8500);
  ok('and the wall moved on by itself', /STAFF/.test(await page.evaluate(() => { const e = document.querySelector('.scene.on .kick'); return e ? e.innerText : ''; })));
  ok('the sound button shows on', await page.evaluate(() => document.querySelector('#bSound').classList.contains('on')));
  await b.close(); server.close();
  console.log(fails ? '\n' + fails + ' FAILED\n' : '\nall green\n');
  process.exit(fails ? 1 : 0);
})();
