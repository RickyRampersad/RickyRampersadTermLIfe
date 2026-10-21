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
    // The four channels on their own; channel 5 (FY27) is walked below (21 Oct 2026).
    await page.goto('http://localhost:8798/wall/?demo=1&newway=off' + (view === 'outside' ? '&view=outside' : ''), { waitUntil: 'domcontentloaded' });
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
    ok('the shout-outs: par, five stars, a level up, a streak and a thank-you', /Today's wins/.test(all0(text)) && /PAR/.test(all0(text)) && /FIVE-STAR SERVICE/.test(all0(text)) && /served an agent, rated five stars/.test(all0(text)) && /LEVEL UP/.test(all0(text)) && /ON A STREAK/.test(all0(text)) && /THANK YOU/.test(all0(text)));
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
  // Channel 5, FY27: our new way of work (21 Oct 2026). In the sample it comes straight after the ident, seven scenes, the
  // last one closing the round; the film's own cut is the ident, the six, the shout-outs and the close.
  {
    console.log('\nchannel 5, FY27:\n');
    const page = await b.newPage({ viewport: { width: 1920, height: 1080 } });
    const errs = []; page.on('pageerror', e => errs.push(String(e)));
    await page.route('**/macros/s/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":false}' }));
    await page.route('**/fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await page.goto('http://localhost:8798/wall/?demo=1&view=outside', { waitUntil: 'domcontentloaded' });
    await page.click('#goQuiet');
    const ids = await page.evaluate(() => list().map(s => s.id));
    ok('twenty-seven scenes in the sample: the ident, FY27\'s fourteen, the twelve, and FY27\'s close at the end', ids.length === 27 && ids.slice(0, 15).join() === 'n0,w1,w2,w3,w4,w8,w9,w5,w11,w13,w15,w10,w6,w14,w12' && ids[26] === 'w7', ids.join(','));
    const kicks = [], spill = [], text = [];
    for (const id of ['w1', 'w2', 'w3', 'w4', 'w8', 'w9', 'w5', 'w11', 'w13', 'w15', 'w10', 'w6', 'w14', 'w12', 'w7']) {
      await page.evaluate(id => go(list().findIndex(s => s.id === id), true), id);
      await page.waitForTimeout(2600);
      kicks.push(await page.evaluate(() => { const e = document.querySelector('.scene.on .kick'); return e ? e.innerText : ''; }));
      if (await page.evaluate(() => [...document.querySelectorAll('.scene.on .panel, .scene.on .tile, .scene.on .nwc, .scene.on .nwday')].filter(p => p.scrollWidth > p.clientWidth + 6).length)) spill.push(id);
      text.push(await page.evaluate(() => document.querySelector('.scene.on').innerText));
    }
    ok('each scene opens under FY27', kicks.every(k => /^FY27 · /.test(k)), kicks.join(' | '));
    ok('the header lights FY27', /FY27/.test(await page.evaluate(() => (document.querySelector('.chan.on') || {}).innerText || '')));
    const all = text.join('\n');
    ok('what changed, the app, the day, the week, Branch Intelligence, the game, the team', /We changed the way we work/.test(all) && /rickyrampersadbranch.com\/app/.test(all) && /Every role has its rhythm/.test(all) &&
      /Every week has its beat/.test(all) && /Draft my reply/.test(all) && /Brief me/.test(all) && /Nobody is ranked/.test(all) && /One branch/.test(all) &&
      /Transmittal/.test(all) && /no client waits/.test(all) && /Every manager, one page each morning/.test(all) && /FACT FIND INSIGHTS/.test(all) && /Everyone sees the score/.test(all) &&
      /Every voice heard, with a structure/.test(all) && /The team holds 75 minutes/.test(all) && /Signing in is the register/.test(all) && /The minutes, the same day/.test(all) &&
      /The work shows up for the client/.test(all), all.slice(0, 120));
    ok('the example task carries no client details', /AN EXAMPLE TASK · NO CLIENT DETAILS/.test(all));
    ok('every role named: Branch Manager, Unit Manager, BMA, Sales Support, Agents', ['Branch Manager', 'Unit Manager', 'BMA', 'Sales Support', 'Agents'].every(r => all.indexOf(r) > -1));
    ok('nothing spills sideways', !spill.length, spill.join(', '));
    ok('no page errors', !errs.length, errs.join(' | '));
    await page.goto('http://localhost:8798/wall/?demo=1&film=newway', { waitUntil: 'domcontentloaded' });
    ok('?film=newway: the film\'s own cut', (await page.evaluate(() => list().map(s => s.id).join())) === 'n0,w1,w2,w3,w4,w8,w9,w5,w11,w13,w15,w10,w6,w14,w12,n11,w7');
    ok('the meeting screens are on the site', (await page.evaluate(async () => (await Promise.all(['build-lap','agenda-lap','register-lap','actions-lap','minutes-lap','signin-ph','onreg-ph','prep-ph'].map(k => fetch('/wall/img/meet/' + k + '.jpg').then(r => r.ok)))).every(Boolean))));
    await page.goto('http://localhost:8798/wall/?demo=1&newway=off', { waitUntil: 'domcontentloaded' });
    ok('?newway=off: the four channels only', (await page.evaluate(() => list().filter(s => /^w/.test(s.id)).length)) === 0);
    await page.close();
    for (const [w, h, name] of [[390, 844, 'phone'], [1366, 768, 'laptop']]) {
      const pg = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: w < 900 ? 2 : 1, isMobile: w < 900, hasTouch: w < 900 });
      const e2 = []; pg.on('pageerror', e => e2.push(String(e)));
      await pg.route('**/macros/s/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":false}' }));
      await pg.route('**/fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
      await pg.goto('http://localhost:8798/wall/?demo=1', { waitUntil: 'domcontentloaded' });
      await pg.click('#goQuiet');
      const off = [];
      for (const id of ['w1', 'w2', 'w3', 'w4', 'w8', 'w9', 'w5', 'w11', 'w13', 'w15', 'w10', 'w6', 'w14', 'w12', 'w7']) {
        await pg.evaluate(id => go(list().findIndex(s => s.id === id), true), id);
        await pg.waitForTimeout(1800);
        if (await pg.evaluate(() => document.documentElement.scrollWidth > innerWidth + 2 || [...document.querySelectorAll('.scene.on *')].some(e => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.right > innerWidth + 2 || r.left < -2); }))) off.push(id);
      }
      ok('FY27 on a ' + name + ': nothing off the side of the screen', !off.length, off.join(', '));
      ok('FY27 on a ' + name + ': no page errors', !e2.length, e2.join(' | '));
      await pg.close();
    }
  }
  // A phone, upright and on its side: the stacked layout, nothing off the side of the screen, every scene.
  for (const [w, h, name] of [[390, 844, 'phone upright'], [844, 390, 'phone on its side']]) {
    const pg = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    const errs = []; pg.on('pageerror', e => errs.push(String(e)));
    await pg.route('**/macros/s/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":false}' }));
    await pg.route('**/fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await pg.goto('http://localhost:8798/wall/?demo=1&newway=off&view=outside', { waitUntil: 'domcontentloaded' });
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
  // A laptop (20 Oct 2026: "scale proper ... it's jumbled"): the slimmer frame, and no panel cut through a line, every scene.
  {
    const pg = await b.newPage({ viewport: { width: 1280, height: 680 } });
    const errs = []; pg.on('pageerror', e => errs.push(String(e)));
    await pg.route('**/macros/s/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":false}' }));
    await pg.route('**/fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await pg.goto('http://localhost:8798/wall/?demo=1&newway=off', { waitUntil: 'domcontentloaded' });
    await pg.click('#goQuiet');
    const cut = [], seen = [];
    for (let i = 0; i < 12; i++) {
      await pg.waitForTimeout(2600);
      const r = await pg.evaluate(() => ({ k: (document.querySelector('.scene.on .kick') || {}).innerText || 'ident', txt: (document.querySelector('.scene.on') || {}).innerText || '',
        cut: [...document.querySelectorAll('.scene.on .grid>.panel')].filter(p => p.scrollHeight > p.clientHeight + 3).length }));
      if (r.cut) cut.push(r.k + ' (' + r.cut + ')'); seen.push(r.txt);
      await pg.keyboard.press('ArrowRight');
    }
    ok('laptop: the slimmer frame', await pg.evaluate(() => document.body.classList.contains('lap')));
    ok('laptop: no panel cut through a line', !cut.length, cut.join(', '));
    ok('laptop: Akaash with the desks and at the head of his unit, his agents by name', /Akaash\s+Unit manager/.test(seen.join('\n')) && /AKAASH'S UNIT/.test(seen.join('\n')) && /Stephanie/.test(seen.join('\n')));
    ok('laptop: the agents are the branch\'s own', /Fawwaz/.test(seen.join('\n')) && !/Devendra|Marissa/.test(seen.join('\n')));
    ok('laptop: no page errors', !errs.length, errs.join(' | '));
    await pg.close();
  }
  // A phone keeps everybody on the desks, Akaash too.
  {
    const pg = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2, isMobile: true, hasTouch: true });
    await pg.route('**/macros/s/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":false}' }));
    await pg.route('**/fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await pg.goto('http://localhost:8798/wall/?demo=1&newway=off', { waitUntil: 'domcontentloaded' });
    await pg.click('#goQuiet'); await pg.waitForTimeout(1500); await pg.keyboard.press('ArrowRight'); await pg.waitForTimeout(2600);
    const vis = await pg.evaluate(() => [...document.querySelectorAll('.scene.on .pc')].filter(c => c.style.display !== 'none').map(c => c.querySelector('.nm').innerText));
    ok('phone: all six on the desks, Akaash among them', vis.length === 6 && vis.includes('Akaash'), vis.join(', '));
    ok('phone: the top bar stays put while a scene scrolls', await pg.evaluate(() => { scrollTo(0, 400); return document.querySelector('header').getBoundingClientRect().top === 0; }));
    await pg.close();
  }
  // Quick taps through a channel's bumper: one scene on the stage at the end, never two on top of each other.
  {
    const pg = await b.newPage({ viewport: { width: 1920, height: 1080 } });
    await pg.route('**/macros/s/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":false}' }));
    await pg.route('**/fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await pg.goto('http://localhost:8798/wall/?demo=1&newway=off', { waitUntil: 'domcontentloaded' });
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
    await pg.goto('http://localhost:8798/wall/?demo=1&newway=off', { waitUntil: 'domcontentloaded' });
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
    ok(tag + 'a win gets its card', /PAR Elizabeth|FIVE-STAR SERVICE|LEVEL UP|ON A STREAK|BEST DAY|THANK YOU/.test(card), card);
    ok(tag + (calmView ? 'and no confetti' : 'and confetti'), calmView ? bits === 0 : bits > 50, String(bits));
    await pg.waitForTimeout(4500);
    ok(tag + 'the card goes again, the wall carries on', await pg.evaluate(() => !document.querySelector('#cele').classList.contains('on') && !CELE.busy));
    ok(tag + 'no page errors', !errs.length, errs.join(' | '));
    await ctx.close();
  }
  // Andrew's recorded lines are on the site (20 Oct 2026): sound on plays them, and the wall moves on when he has finished.
  {
    const pg = await b.newPage({ viewport: { width: 1920, height: 1080 } });
    await pg.route('**/macros/s/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":false}' }));
    await pg.route('**/fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await pg.goto('http://localhost:8798/wall/?demo=1&newway=off', { waitUntil: 'domcontentloaded' });
    await pg.click('#goSound');
    let moved = false;
    for (let t = 0; t < 30 && !moved; t++) { await pg.waitForTimeout(700); moved = /STAFF/.test(await pg.evaluate(() => { const e = document.querySelector('.scene.on .kick'); return e ? e.innerText : ''; })); }
    ok('recorded Andrew: every line is on the site', ['n0','n1','n2','n3','n4','n10','n11','n5','n6','n9','n7','n8'].every(id => fs.existsSync(path.join(ROOT, 'wall/audio/v2/' + id + '.mp3'))));
    ok('recorded Andrew: the wall moves on after his line', moved);
    await pg.close();
  }
  // Sound on, no recording and no Andrew voice in this browser: captions, and the wall still moves on by itself.
  const page = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  await page.route('**/wall/audio/v2/**', r => r.fulfill({ status: 404, body: 'no' }));
  await page.route('**/macros/s/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":false}' }));
  await page.route('**/fonts.googleapis.com/**', r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.goto('http://localhost:8798/wall/?demo=1&newway=off', { waitUntil: 'domcontentloaded' });
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
