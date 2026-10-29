// The day's coach and what is new for you on My workday (29 October 2026, 2026-10-29b), in a real browser.
//
// Ricky, 6:45am: "we can put a note on top there ... 30 minutes, the progress update before you leave to lunch ... letting them
// know the expectations when you set in", and Claude for the managers and the BMA only. The coach is made by the tracker's own
// wdCoach_ (from the harness), so the page is tested on what the tracker really sends. Pinned here:
//   - checked in, the coach is the first card and its line sits in the bar at the top; before check-in, the check-in comes first;
//   - the line is the one for the time now, and moves on by itself as the clock runs (half an hour later, the update line);
//   - the day's stops: done, missed and owed now, the marker between them;
//   - the news card: the urgent count, who wrote, answered or not; a news item opens as a task card;
//   - a desk's card has no Draft with Claude; Kamla's has; the two-minute read says "new for you";
//   - nothing runs off the side of a phone, 390 or 360 wide.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const { makeEnv } = require('./harness');
const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const OUT = process.env.SHOTS || '';
const server = http.createServer((q, r) => {
  let f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { r.writeHead(404); return r.end('no'); }
  r.writeHead(200, { 'Content-Type': f.endsWith('.html') ? 'text/html' : 'application/octet-stream' });
  fs.createReadStream(f).pipe(r);
});
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x && !c ? '  ' + x : '')); if (!c) fails++; };
const day = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Port_of_Spain' });
const env = makeEnv(); env.todayISO_ = () => '2026-10-29';
const H = (h, m) => h * 60 + (m || 0);
const coach = (now, o) => env.wdCoach_('azariah', '2026-10-29', now, Object.assign({ inM: H(7, 58), closed: 3, target: 10, unnoted: 1, overdue: 4, dueToday: 5, proj: 9, sf: true, late: 0, scrubs: [H(8, 20)] }, o || {}));
const NEWS = { items: [
  { k: 'note', id: '00TN1', s: 'Servicing - ALI', said: 'The client is upset, still waiting on her refund.', by: 'Neil', role: 'agent', m: H(9, 12), at: '9:12am', u: 2, answered: false, fresh: true, url: '' },
  { k: 'new', id: '00TN2', s: 'Inbox · Agent Persad · Mohammed medicals', by: 'Routed from the inbox', m: H(8, 40), at: '8:40am', u: 1, fresh: true, ty: 'Servicing', url: 'https://sf.example/00TN2' },
  { k: 'note', id: '00TN3', s: 'Pending - 1000123456 RAMLAL', said: 'Please call the client back today about the medicals.', by: 'Mr Rampersad', role: 'bm', m: H(9, 5), at: '9:05am', u: 2, answered: true, fresh: true, url: '' }],
  more: 0, total: 3, fresh: 3, urgent: 1, open: 2, chase: 2 };
const model = (o = {}) => Object.assign({ ok: true, v: '2026-10-29b', sid: 'azariah', name: 'Azariah Griffith', first: 'Azariah', day, date: 'Thursday 29 October 2026', at: '10:00am',
  hours: '8am – 4pm', lunch: '1:00 – 2:00pm', start: '8:00am', closeInline: true, claude: false,
  checkin: { at: '7:58am', late: 0, status: 'in', out: '', why: '' },
  progress: { sf: true, closed: 3, target: 10, pct: 30, dayPct: 30, proj: 9, noted: 2, unnoted: 1, overdue: 4, dueToday: 5 },
  achieved: [], list: [{ id: '00T1', s: 'Premium due: call back - 5001234567', ty: 'Renewa/PDl/Bill', done: false, url: '' }], listSet: true, next: [],
  close: { url: '', end: '4:00pm' }, types: [{ k: 'Servicing', l: 'Servicing' }], bars: [], team: [],
  coach: coach(H(10)), news: NEWS }, o);
const CARD = { ok: true, id: '00TN1', label: 'Servicing', must: false, todo: 'Call the client.', next: '', close: 'Close when done.', client: 'Ali', policy: '', notes: [], more: 0, min: '2026-10-30', tpl: [{ n: 'Called the client.', a: 'note' }] };

(async () => {
  await new Promise(r => server.listen(8815, r));
  const b = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
  const run = async (width, m0, fn) => {
    const ctx = await b.newContext({ viewport: { width, height: 860 } }); const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e)));
    await page.clock.install();
    const st = { current: m0, posts: [] };
    await page.route(/script\.google\.com\/macros/, async route => {
      const req = route.request(), reply = o => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
      if (req.method() !== 'POST') return reply(st.current);
      const q = Object.fromEntries(new URLSearchParams(req.postData())); st.posts.push(q);
      if (q.act === 'card' && q.sub === 'open') return reply(Object.assign({}, CARD, { id: q.id }));
      return reply({ ok: false, error: 'Nothing to do.' });
    });
    await page.goto('http://localhost:8815/myworkday/?p=' + m0.sid + '&k=KEY'); await page.clock.runFor(1500);
    await fn(page, st, errs);
    ok('no page errors', !errs.length, errs.join(' | '));
    await ctx.close();
  };

  console.log('\nChecked in, at 10am:\n');
  await run(390, model(), async (page, st) => {
    const first = await page.$eval('#main .card', e => e.id);
    ok('the coach is the first card', first === 'coach', first);
    ok('the morning line: what lunch needs', (await page.textContent('#coachh')) === '3 of 10 closed · 5 more by lunch', await page.textContent('#coachh'));
    ok('and it sits in the bar at the top', (await page.textContent('#clinet')) === '3 of 10 closed · 5 more by lunch' && !(await page.isHidden('#cline')));
    const states = await page.$$eval('#rail .st', els => els.map(e => e.className.replace('st ', '')));
    ok('the stops: in and the scrub done, the rest to come', states.join() === 'done,done,next,next,next,next,next', states.join());
    const left = await page.$eval('#railn', e => parseFloat(e.style.left));
    ok('the marker between the scrub and the update', left > 20 && left < 35, String(left));
    if (OUT) await page.screenshot({ path: path.join(OUT, 'coach-10am.png') });
    // The page is put in the background so the two-minute read does not run: the line must move on with no tracker at all.
    await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); });
    await page.clock.runFor(155 * 60 * 1000);   // to 12:35, no read in between
    ok('12:35: the line moves on by itself to the update, in amber', (await page.textContent('#coachh')) === 'Lunch at 1:00pm: update now' && /warn/.test(await page.getAttribute('#coach', 'class')) && /warn/.test(await page.getAttribute('#cline', 'class')), await page.textContent('#coachh'));
    ok('with its checklist', (await page.$$('#coachi li')).length === 4 && /Close 5 more/.test(await page.textContent('#coachi')));
    const st2 = await page.$$eval('#rail .st', els => els.map(e => e.className.replace('st ', '')));
    ok('the update stop is owed now, and the morning scrub still done', st2[2] === 'owe' && st2[1] === 'done', st2.join());
    if (OUT) { await page.screenshot({ path: path.join(OUT, 'coach-1230.png') }); await page.emulateMedia({ colorScheme: 'dark' }); await page.screenshot({ path: path.join(OUT, 'coach-1230-dark.png'), fullPage: true }); await page.emulateMedia({ colorScheme: 'light' }); }
    console.log('\nWhat is new for you:\n');
    const news = await page.textContent('#news');
    ok('the urgent count, who wrote, and what they said', /1 urgent: answer it first/.test(news) && /Neil:/.test(news) && /still waiting on her refund/.test(news) && /3 since you checked in/.test(news), news.slice(0, 200));
    ok('answered, urgent and new each marked', (await page.textContent('#news li[data-id="00TN3"]')).includes('answered') && (await page.textContent('#news li[data-id="00TN1"]')).includes('urgent') && (await page.textContent('#news li[data-id="00TN2"]')).includes('new task'));
    await page.click('#news li[data-id="00TN1"] [data-open]'); await page.clock.runFor(600);
    ok('a news item opens as its card', st.posts.some(p => p.act === 'card' && p.sub === 'open' && p.id === '00TN1') && /Call the client/.test(await page.textContent('#news li[data-id="00TN1"] .tc')));
    ok('a desk\'s card has no Draft with Claude', !(await page.$('#news li[data-id="00TN1"] .cai')));
    const ow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    ok('nothing runs off the side at 390', ow <= 0, String(ow));
  });

  console.log('\nBefore check-in:\n');
  await run(390, model({ checkin: { at: '', late: 0, status: '', out: '' }, coach: env.wdCoach_('azariah', '2026-10-29', H(7, 40), { closed: 0, target: 10, overdue: 4, dueToday: 5 }), news: null }), async (page) => {
    const ids = await page.$$eval('#main .card', els => els.slice(0, 2).map(e => e.id || (e.querySelector('#ci') ? 'checkin' : '')));
    ok('the check-in first, then the coach', ids.join() === 'checkin,coach', ids.join());
    ok('what today asks: the expectations', (await page.textContent('#coachh')) === 'Your day starts at 8:00am' && (await page.$$('#coachi li')).length === 5 && /What today asks/.test(await page.textContent('#coachk')));
    await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'hidden' }); });
    await page.clock.runFor(30 * 60 * 1000);
    ok('past the start and still not in: red', (await page.textContent('#coachh')) === 'You have not checked in' && /bad/.test(await page.getAttribute('#coach', 'class')));
  });

  console.log('\nKamla, and a phone 360 wide:\n');
  await run(360, model({ sid: 'kamla', first: 'Kamla', claude: true, coach: env.wdCoach_('kamla', '2026-10-29', H(11, 40), { inM: H(8), closed: 2, target: 8, unnoted: 0, overdue: 1, dueToday: 3 }) }), async (page, st) => {
    ok('her midday update line', (await page.textContent('#coachh')) === 'Midday: update now', await page.textContent('#coachh'));
    ok('six stops: no lunch on a flexible day', (await page.$$('#rail .st')).length === 6);
    await page.click('#news li[data-id="00TN2"] [data-open]'); await page.clock.runFor(600);
    ok('her card has Draft with Claude', !!(await page.$('#news li[data-id="00TN2"] .cai')));
    const ow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    const railOver = await page.$eval('#rail', r => { const cb = r.closest('.card').getBoundingClientRect(); return Array.from(r.querySelectorAll('.st')).some(s => { const b = s.getBoundingClientRect(); return b.left < cb.left - 1 || b.right > cb.right + 1; }); });
    ok('nothing runs off the side at 360, the stops inside the card', ow <= 0 && !railOver, String(ow) + ' ' + railOver);
    if (OUT) await page.screenshot({ path: path.join(OUT, 'coach-kamla-360.png') });
    st.current = model({ sid: 'kamla', claude: true, at: '11:44am', coach: env.wdCoach_('kamla', '2026-10-29', H(11, 44), { inM: H(8), closed: 2, target: 8 }), news: Object.assign({}, NEWS, { total: 4, urgent: 2 }) });
    await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); });
    await page.clock.runFor(2 * 60 * 1000 + 500);
    ok('the two-minute read, with a card open, says what is new for her', !(await page.isHidden('#upd')) && /1 new for you, urgent/.test(await page.textContent('#updt')), await page.textContent('#updt'));
  });

  await b.close(); server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall green');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
