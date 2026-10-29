// The agent's day on My day (29 October 2026, 2026-10-29e), in a real browser: the tiles, the projection saved from the screen,
// the close-off with the balance as they type, an update posted on a task, and the e-mail's place (go=agclose, t=).
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
const OUT = process.env.SHOTS || '';
const server = http.createServer((q, r) => {
  let f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { r.writeHead(404); return r.end('no'); }
  r.writeHead(200, { 'Content-Type': f.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
});
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x && !c ? '  ' + x : '')); if (!c) fails++; };
const day = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Port_of_Spain' });
const MET = [['calls', 'Calls to make', 'Calls made'], ['appts', 'Appointments to set', 'Appointments set'], ['ff', 'Fact finds to do', 'Fact finds done'], ['close', 'Closing interviews to hold', 'Closing interviews held'],
  ['apps', 'Applications to write', 'Applications written'], ['dues', 'Premium due and lapse clients to call', 'Premium due and lapse clients called'], ['pend', 'Pendings to move', 'Pendings moved']];
const model = (planned, closeDone) => ({ ok: true, v: '2026-10-29e', agent: true, on: true, native: true, first: 'Neil', name: 'Neil Ramnanan', day, date: 'Thursday 29 October 2026', at: '12:45pm',
  film: 'https://rickyrampersadbranch.com/agentworkday/', project: { url: 'https://script.google.com/x?f=ag', done: !!planned, by: '10:30am' },
  close: { url: 'https://script.google.com/x?f=agc', done: !!closeDone, at: '5:30pm', open: true }, mailed: {}, absentAt: '10:30am', lateForPlan: !planned,
  metrics: MET.map(([id, p, d], i) => ({ id, s: id, p, d, planned: planned ? String(planned[i]) : '', pnote: '', done: closeDone ? String(closeDone[i]) : '', dnote: '' })), summary: { plan: '', close: '' },
  items: [{ id: '00TAG1', s: 'Premium due - Marcus Bailey', o: 'Sasha', due: 'Tue 27 Oct', late: true, done: false, notes: [{ who: 'Sasha', day: 'Wed 28 Oct', s: 'Called, no answer; trying again tomorrow.' }], more: 1 },
          { id: '00TAG2', s: 'Pending - medicals - Ann Ali', o: 'Azariah', due: 'Thu 29 Oct', late: false, done: true, notes: [], more: 0 }],
  closedToday: [{ s: 'Pending - medicals - Ann Ali', o: 'Azariah' }], tiles: { worked: 1, late: 1, closed: 1 },
  balance: closeDone ? { proj: 24, done: 22, bal: -2, pct: 90, text: '−2' } : null });
(async () => {
  await new Promise(r => server.listen(8817, r));
  const b = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } }); const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e)));
  let current = model(null, null); const posts = [];
  await page.route(/script\.google\.com\/macros/, route => { const req = route.request(), reply = o => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
    if (req.method() !== 'POST') return reply(current); const p = Object.fromEntries(new URLSearchParams(req.postData())); posts.push(p);
    if (p.act === 'agplan') { current = model([10, 3, 2, 1, 1, 5, 2], null); return reply(Object.assign({}, current, { saved: { act: 'agplan', n: 0, failed: 0 } })); }
    if (p.act === 'agclose') { current = model([10, 3, 2, 1, 1, 5, 2], [12, 2, 2, 1, 0, 3, 2]); return reply(Object.assign({}, current, { saved: { act: 'agclose', n: 0, failed: 0 } })); }
    if (p.act === 'agnote') return reply(Object.assign({}, current, { saved: { act: 'agnote', n: 1, failed: 0 } }));
    return reply({ ok: false }); });
  await page.goto('http://localhost:8817/myworkday/?p=a-neil-ramnanan&k=KEY'); await page.waitForTimeout(1400);
  console.log('\nHis day:\n');
  ok('the tiles: being worked, closed for him, overdue, no projection yet', /1being worked for you/.test((await page.textContent('.agt')).replace(/\s+/g, '')) || /being worked for you/.test(await page.textContent('.agt')) && /No/.test(await page.textContent('.agt')));
  ok('past 10:30 with no projection: said in red', /No projection yet, and it is past 10:30am/.test(await page.textContent('#agplan')));
  ok('seven lines to project, and the tasks being worked', (await page.$$('#agplan [data-m]')).length === 7 && (await page.$$('#agitems li[data-ag]')).length === 2);
  if (OUT) await page.screenshot({ path: path.join(OUT, 'agent-day.png'), fullPage: true });
  await page.fill('#agplan [data-m="calls"]', '10'); await page.click('#agplan [data-agsave]');
  ok('a line left blank is caught before anything is sent', /6 left blank/.test(await page.textContent('#agplan [data-st]')) && !posts.length);
  const nums = [10, 3, 2, 1, 1, 5, 2]; for (let i = 0; i < 7; i++) await page.fill('#agplan [data-m="' + MET[i][0] + '"]', String(nums[i]));
  await page.fill('#agplan [data-sum]', 'Seeing the Alis at 2'); await page.click('#agplan [data-agsave]'); await page.waitForTimeout(700);
  const pp = posts.find(p => p.act === 'agplan');
  ok('Save posts every line, the note and the words, with his link', pp && pp.m_calls === '10' && pp.m_pend === '2' && pp.summary === 'Seeing the Alis at 2' && pp.wd === 'a-neil-ramnanan' && pp.k === 'KEY', JSON.stringify(pp));
  ok('and the card says it is set', /SET/.test(await page.textContent('#agplan')) && /Update my projection/.test(await page.textContent('#agplan')));
  console.log('\nThe close-off:\n');
  await page.fill('#agclose [data-m="calls"]', '12');
  ok('the balance shows as he types: +2 on calls', (await page.textContent('#agclose [data-m="calls"] + [data-bal]')).trim() === '+2');
  await page.fill('#agclose [data-m="dues"]', '3');
  ok('and short in red: −2 on dues', (await page.textContent('#agclose [data-m="dues"] + [data-bal]')).trim() === '−2' && /dn/.test(await page.getAttribute('#agclose [data-m="dues"] + [data-bal]', 'class')));
  const dn = [12, 2, 2, 1, 0, 3, 2]; for (let i = 0; i < 7; i++) await page.fill('#agclose [data-m="' + MET[i][0] + '"]', String(dn[i]));
  await page.click('#agclose [data-agsave]'); await page.waitForTimeout(700);
  ok('Close off posts it, and the day comes back balanced', posts.some(p => p.act === 'agclose' && p.m_calls === '12') && /Projected 24 · done 22 · balance −2/.test((await page.textContent('#agclose .agbal')).replace(/\s+/g, ' ')), await page.textContent('#agclose'));
  console.log('\nAn update on a task:\n');
  await page.click('#agitems li[data-ag="00TAG1"] [data-agopen]'); await page.waitForTimeout(200);
  ok('it opens with its last note', !(await page.isHidden('#agitems li[data-ag="00TAG1"] .tc')) && /Called, no answer/.test(await page.textContent('#agitems li[data-ag="00TAG1"] .tc')));
  await page.fill('#agitems li[data-ag="00TAG1"] [data-agtext]', 'Mr Bailey pays Friday at the bank.'); await page.click('#agitems li[data-ag="00TAG1"] [data-agnote]'); await page.waitForTimeout(500);
  ok('Post sends the update for that task', posts.some(p => p.act === 'agnote' && p.id === '00TAG1' && /pays Friday/.test(p.text)) && /Posted on the task/.test(await page.textContent('#agitems li[data-ag="00TAG1"] .tc .cst')));
  const ow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  ok('nothing off the side at 390', ow <= 0, String(ow));
  ok('no page errors', !errs.length, errs.join(' | '));
  await ctx.close();
  console.log('\nFrom the 5:30 e-mail (go=agclose), and a task (t=):\n');
  const c2 = await b.newContext({ viewport: { width: 360, height: 700 }, colorScheme: 'dark' }); const p2 = await c2.newPage(); current = model([10, 3, 2, 1, 1, 5, 2], null);
  await p2.route(/script\.google\.com\/macros/, route => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(current) }));
  await p2.goto('http://localhost:8817/myworkday/?p=a-neil-ramnanan&k=KEY&go=agclose'); await p2.waitForTimeout(1500);
  ok('the close-off is on screen', await p2.evaluate(() => { const r = document.getElementById('agclose').getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0 && r.top > -50; }));
  if (OUT) await p2.screenshot({ path: path.join(OUT, 'agent-close-dark.png') });
  await p2.goto('http://localhost:8817/myworkday/?p=a-neil-ramnanan&k=KEY&go=agitems&t=00TAG1'); await p2.waitForTimeout(1500);
  ok('the task from the morning e-mail opens', !(await p2.isHidden('#agitems li[data-ag="00TAG1"] .tc')));
  await c2.close(); await b.close(); server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall green');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
