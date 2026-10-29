// My workday opens where the e-mail's button points (29 October 2026, 2026-10-29d), in a real browser.
//
// go=close opens Close my day there and then; go=update brings the coach up; t= opens that task's card; the place is taken out
// of the address after, so a refresh does not open it again.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const { makeEnv } = require('./harness');
const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const server = http.createServer((q, r) => {
  let f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { r.writeHead(404); return r.end('no'); }
  r.writeHead(200, { 'Content-Type': f.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
});
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x && !c ? '  ' + x : '')); if (!c) fails++; };
const day = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Port_of_Spain' });
const env = makeEnv(); env.todayISO_ = () => '2026-10-29';
const many = Array.from({ length: 14 }, (_, i) => ({ id: '00TL' + i, s: 'List task ' + i, ty: 'Servicing', done: false, url: '' }));
const model = () => ({ ok: true, v: '2026-10-29d', sid: 'sasha', name: 'Sasha Lalla-Jagassar', first: 'Sasha', day, date: 'Thursday 29 October 2026', at: '11:40am',
  hours: '8am – 4pm', lunch: '2:00 – 3:00pm', start: '8:00am', closeInline: true, claude: false, checkin: { at: '7:58am', late: 0, status: 'in', out: '', why: '' },
  progress: { sf: true, closed: 3, target: 10, pct: 30, dayPct: 40, proj: 8, noted: 3, unnoted: 0, overdue: 4, dueToday: 5 }, achieved: [], list: many, listSet: true, next: [],
  close: { url: '', end: '4:00pm' }, types: [{ k: 'Servicing', l: 'Servicing' }], bars: [], team: [],
  coach: env.wdCoach_('sasha', '2026-10-29', 13 * 60 + 35, { inM: 478, closed: 3, target: 10, scrubs: [] }), news: { items: [], total: 0, fresh: 0, urgent: 0, more: 0 } });
const FORM = { ok: true, form: { planned: true, done: [], open: [{ id: '00TL1', s: 'List task 1', r: '', d: '2026-11-02' }], min: '2026-10-30', end: '4:00pm', checks: [], mailbag: null, inno: false, innoSaid: '' } };
(async () => {
  await new Promise(r => server.listen(8816, r));
  const b = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
  const open = async (q, fn) => {
    const ctx = await b.newContext({ viewport: { width: 390, height: 760 } }); const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e)));
    const posts = [];
    await page.route(/script\.google\.com\/macros/, route => { const req = route.request(); const reply = o => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
      if (req.method() !== 'POST') return reply(model()); const p = Object.fromEntries(new URLSearchParams(req.postData())); posts.push(p);
      if (p.act === 'closeform') return reply(FORM); if (p.act === 'card') return reply({ ok: true, id: p.id, todo: 'Call the client.', tpl: [], notes: [], min: '2026-10-30' }); return reply({ ok: false }); });
    await page.goto('http://localhost:8816/myworkday/?p=sasha&k=KEY' + q); await page.waitForTimeout(1600);
    await fn(page, posts); ok('no page errors', !errs.length, errs.join(' | ')); await ctx.close();
  };
  console.log('\ngo=close (the close-out e-mails):\n');
  await open('&go=close', async (page, posts) => {
    ok('Close my day is open, asked for once', !!(await page.$('#closeform')) && posts.filter(p => p.act === 'closeform').length === 1);
    ok('and on screen', await page.evaluate(() => { const r = document.getElementById('closecard').getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }));
    ok('the place is taken out of the address', !/go=/.test(page.url()) && /p=sasha/.test(page.url()), page.url());
  });
  console.log('\ngo=update (the midday e-mail):\n');
  await open('&go=update', async (page) => {
    ok('the coach is at the top of the screen, saying update now', await page.evaluate(() => { const r = document.getElementById('coach').getBoundingClientRect(); return r.top >= -5 && r.top < 300; }) && /update now/.test(await page.textContent('#coachh')), await page.textContent('#coachh'));
  });
  console.log('\nt= (a task):\n');
  await open('&go=list&t=00TL12', async (page, posts) => {
    ok('that task\'s card opens, and is on screen', posts.some(p => p.act === 'card' && p.sub === 'open' && p.id === '00TL12') && !(await page.isHidden('li.tk[data-id="00TL12"] .tc')) &&
      await page.evaluate(() => { const r = document.querySelector('li.tk[data-id="00TL12"]').getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }));
  });
  await b.close(); server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall green');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
