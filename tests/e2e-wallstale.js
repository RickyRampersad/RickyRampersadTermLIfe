// The wall has to say when it is running old code.
//
// On 15 and 16 September 2026 the birthday strip named two agents whose
// birthday it was not, on two consecutive mornings. The second time the
// question was "why is this the 2nd time" — and the answer was that the fix
// had been written the day before and never pasted into Apps Script.
//
// Nothing on the screen said so, and nothing could have: the DATA rebuilds
// every night, so the wall read "built today" and looked perfectly healthy
// while serving three-week-old logic. That is the fault this covers — not the
// birthday query, which tests/test-wallstore.js already pins, but the silence
// around a stale deployment.
//
// intel.ping is answered without a token and has reported its version since
// 2026-09-08, so the check works against the OLD deployment — the only one it
// matters on. The route is stubbed here rather than called: a test that
// depends on what happens to be deployed passes or fails for reasons that have
// nothing to do with the code under it.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), PORT = 8841;
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const WANT = (fs.readFileSync(path.join(ROOT, 'intelligence/wall/all.html'), 'utf8')
  .match(/var WANT_SCRIPT = '([^']+)';/) || [])[1];

const srv = http.createServer((q, r) => {
  let f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': 'text/html' });
  fs.createReadStream(f).pipe(r);
});
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  ok   ' : '  FAIL ') + l + (x && !c ? ' — ' + x : '')); if (!c) fails++; };

// Every page in the wall posts to the same /exec. Answer the ping as asked and
// let every other action fall through to "no feed", which is what a screen
// does anyway when it cannot reach the sheet.
async function wall(page, pingBody) {
  await page.route('**/script.google.com/**', route => {
    let body = '{}';
    try { body = route.request().postData() || '{}'; } catch (e) {}
    const isPing = body.indexOf('intel.ping') !== -1;
    route.fulfill({
      status: 200, contentType: 'application/json',
      body: isPing ? JSON.stringify(pingBody) : JSON.stringify({ ok: false, error: 'stubbed' })
    });
  });
  await page.goto('http://127.0.0.1:' + PORT + '/intelligence/wall/all.html', { waitUntil: 'load' });
}

const bar = page => page.evaluate(() => {
  const el = document.getElementById('stale');
  if (!el) return 'NO ELEMENT';
  return {
    shown: !el.hidden,
    got: (document.getElementById('staleGot') || {}).textContent || '',
    want: (document.getElementById('staleWant') || {}).textContent || '',
    text: el.innerText.replace(/\s+/g, ' ').trim()
  };
});

(async () => {
  await new Promise(r => srv.listen(PORT, r));
  const b = await chromium.launch({ executablePath: CHROME });

  console.log('\nA script older than the screens — the 16 September case:\n');
  {
    const p = await b.newPage({ viewport: { width: 1366, height: 768 } });
    const errs = []; p.on('pageerror', e => errs.push(String(e)));
    // 2026-09-09a is what was actually deployed on the morning this went wrong.
    await wall(p, { ok: true, service: 'Branch Intelligence', version: '2026-09-09a',
                    built: '2026-09-16 01:07', workbook: 'default' });
    await p.waitForFunction(() => {
      const el = document.getElementById('stale');
      return el && !el.hidden;
    }, { timeout: 15000 }).catch(() => {});
    const s = await bar(p);
    ok('the red bar is on the wall', s && s.shown === true, JSON.stringify(s));
    ok('it names the build that is deployed', s && s.got === '2026-09-09a', s && s.got);
    ok('and the build the screens expect', s && s.want === WANT, (s && s.want) + ' vs ' + WANT);
    ok('it says the figures may be wrong', /may be wrong/i.test(s && s.text || ''));
    ok('it says what to do about it',
       /Paste Intelligence\.gs/.test(s && s.text || '') && /New version/.test(s && s.text || ''),
       s && s.text);
    ok('no javascript errors', errs.length === 0, errs.join(' | '));

    // It must be readable, and it must be at the TOP. The whole chrome moved
    // there on 16 September because three stacked things over the foot were
    // covering the last row of every slide.
    const box = await p.evaluate(() => {
      const el = document.getElementById('stale');
      const r = el.getBoundingClientRect(), cs = getComputedStyle(el);
      const rail = document.getElementById('rail').getBoundingClientRect();
      const hud = document.getElementById('hud').getBoundingClientRect();
      const bar = document.getElementById('bar');
      return { h: Math.round(r.height), w: Math.round(r.width), top: Math.round(r.top),
               z: cs.zIndex, pos: cs.position,
               staleClass: document.body.classList.contains('stale'),
               staleh: getComputedStyle(document.documentElement).getPropertyValue('--staleh').trim(),
               railTop: Math.round(rail.top), hudTop: Math.round(hud.top),
               barBottom: Math.round(bar.getBoundingClientRect().bottom),
               vh: window.innerHeight };
    });
    ok('it spans the screen', box.w >= 1300, JSON.stringify(box));
    ok('  and is tall enough to read', box.h >= 26, JSON.stringify(box));
    ok('  pinned to the TOP, not the foot', box.top <= 1 && box.pos === 'fixed', JSON.stringify(box));
    ok('  one line, not two', box.h <= 46, box.h + 'px');
    ok('  above everything', Number(box.z) >= 40, box.z);
    ok('it marks the body so the rest can make room', box.staleClass === true);
    ok('  and publishes its real height', /^\d+px$/.test(box.staleh) && parseInt(box.staleh, 10) >= 26, box.staleh);
    ok('the rail sits underneath it rather than behind it',
       box.railTop >= parseInt(box.staleh, 10) - 1, 'rail top ' + box.railTop + ' vs ' + box.staleh);
    ok('the timer is at the top too', box.hudTop < box.vh / 2, 'hud top ' + box.hudTop);
    ok('and the only thing left at the foot is the 5px progress line',
       box.barBottom >= box.vh - 1, 'bar bottom ' + box.barBottom + ' of ' + box.vh);
    await p.close();
  }

  console.log('\nThe script and the screens in step — no bar at all:\n');
  {
    const p = await b.newPage({ viewport: { width: 1366, height: 768 } });
    await wall(p, { ok: true, version: WANT, built: '2026-09-16 01:07' });
    await p.waitForTimeout(2500);
    const s = await bar(p);
    ok('nothing is drawn', s && s.shown === false, JSON.stringify(s));
    const clear = await p.evaluate(() => ({
      cls: document.body.classList.contains('stale'),
      h: getComputedStyle(document.documentElement).getPropertyValue('--staleh').trim(),
      railTop: Math.round(document.getElementById('rail').getBoundingClientRect().top)
    }));
    ok('  the body is not marked stale', clear.cls === false);
    ok('  the reserved height goes back to nothing', clear.h === '0px', clear.h);
    ok('  and the rail returns to the very top', clear.railTop <= 1, 'rail top ' + clear.railTop);
    await p.close();
  }

  console.log('\nA script that cannot be reached — the wall already says "no feed":\n');
  {
    const p = await b.newPage({ viewport: { width: 1366, height: 768 } });
    await p.route('**/script.google.com/**', route => route.abort());
    await p.goto('http://127.0.0.1:' + PORT + '/intelligence/wall/all.html', { waitUntil: 'load' });
    await p.waitForTimeout(2500);
    const s = await bar(p);
    ok('a second red bar for the same fault is not raised', s && s.shown === false, JSON.stringify(s));
    await p.close();
  }

  console.log('\nA ping that answers without a version says nothing either way:\n');
  {
    const p = await b.newPage({ viewport: { width: 1366, height: 768 } });
    await wall(p, { ok: true, built: '2026-09-16 01:07' });
    await p.waitForTimeout(2500);
    const s = await bar(p);
    ok('it stays quiet rather than crying stale', s && s.shown === false, JSON.stringify(s));
    await p.close();
  }

  console.log('\nOn a phone it still reads, and still does not cover the story:\n');
  {
    const p = await b.newPage({ viewport: { width: 390, height: 844 } });
    await wall(p, { ok: true, version: '2026-09-09a' });
    await p.waitForFunction(() => {
      const el = document.getElementById('stale');
      return el && !el.hidden;
    }, { timeout: 15000 }).catch(() => {});
    const m = await p.evaluate(() => {
      const r = document.getElementById('stale').getBoundingClientRect();
      return { h: Math.round(r.height), w: Math.round(r.width),
               right: Math.round(r.right), left: Math.round(r.left) };
    });
    ok('it fits the width', m.left >= 0 && m.right <= 391, JSON.stringify(m));
    ok('  and does not eat the screen', m.h <= 200, JSON.stringify(m));
    const sc = await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
    ok('  nothing scrolls sideways', sc);
    await p.close();
  }

  await b.close();
  srv.close();
  console.log('');
  process.exit(fails ? 1 : 0);
})();
