// A wall screen must survive a feed that drops one read.
//
// Seven screens post to the same Apps Script within seconds of each other when
// the wall boots, and again on every refresh. Google drops one of those now and
// then — a reset, a queue, a cold container. The pages used to fetch once, fall
// into their catch and sit on "no feed" until the next thirty-minute tick,
// which is exactly what the branch kept seeing on 9 September: "not seeing the
// data on some walls" while the others were fine.
//
// Every screen shares one feed() helper, so proving it on one proves it on all
// seven. This drives day.html, whose payload is written here rather than taken
// off the live feed — a fixture cut from live data carries the branch's agent
// names, and this repository is public.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), PORT = 8834;
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const DAY = { ok: true, data: {
  generatedAt: '2026-09-09', at: '10:42', configured: true, error: '',
  branch: { closed: 37, open: 250, overdue: 104, needs: 96, done: 9, of: 22, in: 5, out: 1, absent: 1 },
  pace: { perDay: 64, share: 58 },
  desks: [
    { name: 'Agent A', role: 'Sales Support', closed: 14, open: 41, overdue: 0, needs: 9,
      blocks: ['done','done','due','due'], in: '07:58', out: '', late: 0, absent: false },
    { name: 'Agent B', role: 'Branch Management Asst.', closed: 4, open: 69, overdue: 16, needs: 6,
      blocks: ['done','due','due','due'], in: '08:00', out: '', late: 0, absent: false },
    { name: 'Agent C', role: 'Unit Manager', closed: 0, open: 16, overdue: 4, needs: 1,
      blocks: ['','','',''], in: '', out: '', late: 0, absent: true }
  ],
  blocks: [
    { id: 'KPI1', label: 'Premium Dues / Surveys',   time: '8 – 10am',  done: 5, of: 6 },
    { id: 'KPI2', label: 'Ind. Health Billing Recon', time: '10 – 12pm', done: 2, of: 6 },
    { id: 'PM1',  label: 'Adopt an Orphan',           time: '1 – 3pm',   done: 1, of: 6 },
    { id: 'PM2',  label: 'Task Mgmt / Reports',       time: '3 – 4pm',   done: 1, of: 4 }
  ] } };

const srv = http.createServer((q, r) => {
  let f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { r.writeHead(404); return r.end(); }
  r.writeHead(200, { 'Content-Type': 'text/html' });
  fs.createReadStream(f).pipe(r);
});
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  ok   ' : '  FAIL ') + l + (x && !c ? ' — ' + x : '')); if (!c) fails++; };

(async () => {
  await new Promise(r => srv.listen(PORT, r));
  const b = await chromium.launch({ executablePath: CHROME });

  // drops before the answer → what the pill must end up saying
  for (const [name, drops, expect] of [['a read that lands first time', 0, 'live'],
                                       ['one dropped read', 1, 'live'],
                                       ['two dropped reads', 2, 'live'],
                                       ['a feed that never answers', 9, 'no feed']]) {
    const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
    let n = 0; const errs = [];
    p.on('pageerror', e => errs.push(String(e.message)));
    await p.route(u => u.hostname !== 'localhost', r => {
      if (!/script\.google\.com$/.test(new URL(r.request().url()).hostname))
        return r.fulfill({ status: 200, contentType: 'text/css', body: '' });
      n++;
      return n <= drops ? r.abort()
                        : r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(DAY) });
    });
    await p.goto(`http://localhost:${PORT}/intelligence/wall/day.html`, { waitUntil: 'domcontentloaded' });
    await p.waitForTimeout(drops >= 9 ? 16000 : drops * 4500 + 3500);
    const pill = await p.locator('#liveTxt').innerText().catch(() => '?');
    const text = await p.locator('body').innerText();
    ok(name + ' → the pill reads "' + expect + '"', pill === expect, 'got "' + pill + '" after ' + n + ' attempt(s)');
    if (expect === 'live') {
      ok('  and the day is painted', /37/.test(text) && /Agent A/.test(text));
      ok('  it tried ' + (drops + 1) + ' time(s), no more', n === drops + 1, 'tried ' + n);
    } else {
      ok('  it gave up rather than hanging for ever', n === 3, 'tried ' + n);
    }
    ok('  no javascript errors', errs.length === 0, errs.join(' | '));
    await p.close();
  }

  await b.close(); srv.close();
  console.log(fails ? '\n' + fails + ' FAILED\n' : '\nall green\n');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
