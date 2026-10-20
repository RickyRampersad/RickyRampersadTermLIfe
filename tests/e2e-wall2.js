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
const all0 = t => t.join('\n');
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
    for (let i = 0; i < 12; i++) {
      await page.waitForTimeout(2700);
      const k = await page.evaluate(() => { const e = document.querySelector('.scene.on .kick'); return e ? e.innerText : 'ident'; });
      seen.push(k);
      const bad = await page.evaluate(() => [...document.querySelectorAll('.scene.on .panel, .scene.on .tile')].filter(p => p.scrollWidth > p.clientWidth + 6).length);
      if (bad) spill.push(k);
      text.push(await page.evaluate(() => document.querySelector('.scene.on').innerText));
      await page.keyboard.press('ArrowRight');
    }
    ok('twelve scenes, staff to live, the Branch Manager\'s day, how we served and the shout-outs among them', seen.length === 12 && new Set(seen).size === 12 && /LIVE/.test(seen[11]) && seen.some(k => /BRANCH MANAGER'S DAY/.test(k)) && seen.some(k => /HOW WE SERVED/.test(k)) && seen.some(k => /SHOUT-OUTS/.test(k)), seen.join(' | '));
    ok('the shout-outs: par, five stars, a level up, a streak and a thank-you', /Today's wins/.test(all0(text)) && /PAR/.test(all0(text)) && /FIVE STARS/.test(all0(text)) && /LEVEL UP/.test(all0(text)) && /ON A STREAK/.test(all0(text)) && /THANK YOU/.test(all0(text)));
    ok('nothing spills sideways', !spill.length, spill.join(', '));
    ok('no page errors', !errs.length, errs.join(' | '));
    ok('the sample is marked', /SAMPLE/.test(await page.innerText('#mode')));
    const all = text.join('\n');
    if (view === 'outside') {
      ok('no dollars', !/\$\d/.test(all));
      ok('no arrival times or lateness', !/In at \d|min after the start/.test(all));
      ok('no week below someone\'s usual', !/-\d+% on their usual/.test(all));
      ok('who is out, by name', /Sasha/.test(all) && /Out today/i.test(all));
      ok('how we served: the branch\'s stars and four and five by name', /Rated by the people we serve/.test(all) && /FOUR AND FIVE STARS/.test(all) && /from an agent/.test(all));
    } else {
      ok('inside: arrival times and dollars', /In at 6:55/.test(all) && /\$412k/.test(all));
    }
    await page.close();
  }
  // A phone, upright and on its side: the stacked layout, nothing off the side of the screen, every scene.
  for (const [w, h, name] of [[390, 844, 'phone upright'], [844, 390, 'phone on its side']]) {
    const pg = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const errs = []; pg.on('pageerror', e => errs.push(String(e)));
    await pg.route('**/macros/s/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":false}' }));
    await pg.route('**/fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await pg.goto('http://localhost:8798/wall/?demo=1&view=outside', { waitUntil: 'domcontentloaded' });
    await pg.click('#goQuiet');
    const off = [];
    for (let i = 0; i < 12; i++) {
      await pg.waitForTimeout(2700);
      const r = await pg.evaluate(() => ({ k: (document.querySelector('.scene.on .kick') || {}).innerText || 'ident', sw: document.documentElement.scrollWidth, iw: innerWidth,
        out: [...document.querySelectorAll('.scene.on *')].filter(e => { const b = e.getBoundingClientRect(); return b.width > 0 && (b.right > innerWidth + 2 || b.left < -2); }).length }));
      if (r.sw > r.iw + 1 || r.out) off.push(r.k + ' (' + r.out + ')');
      if (process.env.SHOTS) await pg.screenshot({ path: process.env.SHOTS + '/mob_' + w + '_' + i + '.png', fullPage: h > w });
      if (i === 3) { const c = await pg.evaluate(() => { CELE.q.unshift({ k: 'level', who: 'Elizabeth', text: 'Premium fixer · level 4' }); CELE.busy = false; celePlay(); return new Promise(r => setTimeout(() => { const b = document.querySelector('#cele .cc').getBoundingClientRect(); r(b.left >= 0 && b.right <= innerWidth && b.top >= 0 && b.bottom <= innerHeight); }, 900)); });
        if (!c) off.push('celebration card'); }
      await pg.keyboard.press('ArrowRight');
    }
    ok(name + ': the stacked layout', await pg.evaluate(() => document.body.classList.contains('mob')));
    ok(name + ': nothing off the side of the screen', !off.length, off.join(', '));
    ok(name + ': no page errors', !errs.length, errs.join(' | '));
    await pg.close();
  }
  // Quick taps through a channel's bumper: one scene on the stage at the end, never two on top of each other.
  {
    const pg = await b.newPage({ viewport: { width: 1920, height: 1080 } });
    await pg.route('**/macros/s/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":false}' }));
    await pg.route('**/fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await pg.goto('http://localhost:8798/wall/?demo=1', { waitUntil: 'domcontentloaded' });
    await pg.click('#goQuiet');
    for (let i = 0; i < 6; i++) { await pg.waitForTimeout(250); await pg.keyboard.press('ArrowRight'); }
    await pg.waitForTimeout(2500);
    const n = await pg.evaluate(() => document.querySelectorAll('#stage .scene').length);
    ok('quick taps: one scene on the stage, not two on top of each other', n === 1, String(n));
    await pg.close();
  }
  // Celebrations: a win gets its card and confetti every few scenes; with reduced motion, the card and no confetti.
  for (const calmView of [false, true]) {
    const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, reducedMotion: calmView ? 'reduce' : 'no-preference' });
    const pg = await ctx.newPage(); const errs = []; pg.on('pageerror', e => errs.push(String(e)));
    await pg.route('**/macros/s/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":false}' }));
    await pg.route('**/fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await pg.goto('http://localhost:8798/wall/?demo=1', { waitUntil: 'domcontentloaded' });
    await pg.click('#goQuiet');
    let card = '', bits = 0;
    for (let i = 0; i < 5 && !card; i++) {
      await pg.keyboard.press('ArrowRight');
      for (let t = 0; t < 8 && !card; t++) { await pg.waitForTimeout(500);
        const r = await pg.evaluate(() => ({ c: document.querySelector('#cele.on .ct') ? document.querySelector('#cele .ck').innerText + ' ' + document.querySelector('#cele .ct').innerText : '', n: (confetti.ps || []).length }));
        card = r.c; bits = Math.max(bits, r.n); }
    }
    await pg.waitForTimeout(700); bits = Math.max(bits, await pg.evaluate(() => (confetti.ps || []).length));
    const tag = calmView ? 'reduced motion: ' : 'celebrations: ';
    ok(tag + 'a win gets its card', /PAR Elizabeth|FIVE STARS|LEVEL UP|ON A STREAK|BEST DAY|THANK YOU/.test(card), card);
    ok(tag + (calmView ? 'and no confetti' : 'and confetti'), calmView ? bits === 0 : bits > 50, String(bits));
    await pg.waitForTimeout(4500);
    ok(tag + 'the card goes again, the wall carries on', await pg.evaluate(() => !document.querySelector('#cele').classList.contains('on') && !CELE.busy));
    ok(tag + 'no page errors', !errs.length, errs.join(' | '));
    await ctx.close();
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
