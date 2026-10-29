// My workday is the one screen (29 October 2026), in a real browser with the tracker answered here.
//
// Ricky, 6:15am: "shouldn't you just get the first dark screen, and persons can actually do it in the dark screen ... at the top
// ... if they see the update on it, so they can leave that screen and refresh, and at the end they could put a checkout or close
// their day under that". Pinned here:
//   - a task on the list opens into its card (what to do, its notes, the templates); a template fills the note; Close now posts
//     act=card with the note, and the task ticks itself; an empty note is refused before anything is sent;
//   - Add to my day posts each line;
//   - the two-minute read never wipes what is being typed: the bar at the top says what changed, and Refresh draws it;
//   - Close my day opens the close-out here, asks for every answer, and posts the reasons, dates, checks and the sign-out;
//   - a manager checks out from the same screen.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
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
const model = (o = {}) => Object.assign({ ok: true, v: '2026-10-29a', sid: 'sasha', name: 'Sasha Lalla-Jagassar', first: 'Sasha', day, date: 'Thursday 29 October 2026', at: '9:10am',
  hours: '8am – 4pm', lunch: '12:00 – 12:30pm', start: '8:00am', closeInline: true,
  checkin: { at: '7:58am', late: 0, status: 'in', out: '', why: '' },
  progress: { sf: true, closed: 3, target: 12, pct: 25, dayPct: 14, proj: 12, noted: 3, unnoted: 0, overdue: 4, dueToday: 6 },
  achieved: [{ k: 'close', s: 'Settlement - 1000908895', noted: true }],
  list: [{ id: '00T1', s: 'Premium due: call back - 5001234567', ty: 'Renewa/PDl/Bill', done: false, url: 'https://sf.example/00T1' },
         { id: '00T2', s: 'Proof of address for the Ramlal case', ty: 'Pendings', done: true, url: 'https://sf.example/00T2' }], listSet: true,
  next: [{ id: '00T3', s: 'Follow up with UW - 1000906663', due: 'Tue 27 Oct', late: true, ty: 'Pendings', url: 'https://sf.example/00T3' }],
  close: { url: 'https://script.google.com/macros/s/X/exec?f=hk', end: '4:00pm' },
  types: [{ k: 'Servicing', l: 'Servicing' }, { k: 'Pendings', l: 'Pendings' }],
  bars: [{ l: 'F', n: 4 }, { l: 'M', n: 6 }, { l: 'Tu', n: 9 }, { l: 'W', n: 8 }, { l: 'Th', n: 3 }], team: [] }, o);
const CARD = { ok: true, id: '00T1', label: 'Premium due', must: true, todo: 'Call the client and confirm how the premium will be paid.', next: 'Past its projected lapse date',
  close: 'Close when the client has paid or says when.', client: 'A Client', policy: '5001234567',
  notes: [{ who: 'Sasha', day: '27 Oct', s: 'Called, no answer.' }], more: 2, min: '2026-10-30',
  tpl: [{ n: 'Spoke to the client: paying [amount] by [date].', a: 'close' }, { n: 'No answer; trying again [day].', a: 'move' }, { n: 'Left a message.', a: 'note' }] };
const FORM = { ok: true, form: { planned: true, done: ['Proof of address for the Ramlal case'], open: [{ id: '00T1', s: 'Premium due: call back - 5001234567', r: '', d: '2026-11-05' }], min: '2026-10-30', end: '4:00pm',
  checks: [{ id: 'hk_inbox', s: 'Inbox cleared', done: false, r: '' }, { id: 'hk_desk', s: 'Desk tidy', done: false, r: '' }], mailbag: null, inno: false, innoSaid: '' } };

(async () => {
  await new Promise(r => server.listen(8813, r));
  const b = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
  const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e)));
  let posts = [], current = model(), gets = 0;
  await page.route(/script\.google\.com\/macros/, async route => {
    const req = route.request(), reply = o => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
    if (req.method() !== 'POST') { gets++; return reply(current); }
    const q = Object.fromEntries(new URLSearchParams(req.postData())); posts.push(q);
    if (q.act === 'card' && q.sub === 'open') return reply(CARD);
    if (q.act === 'card' && q.sub === 'close') return reply({ ok: true, act: 'close', msg: 'Closed 9:14am · note on Chatter' });
    if (q.act === 'scrub') return reply({ ok: true, out: q.lines.split('\n').map(l => ({ s: l, ok: true, res: 'a task in your day' })) });
    if (q.act === 'closeform') return reply(FORM);
    if (q.act === 'close') { current = model({ checkin: { at: '7:58am', late: 0, status: 'in', out: '4:02pm' } }); return reply(Object.assign({}, current, { closed: { checks: 2, moved: 1, out: '4:02pm' } })); }
    if (q.act === 'signout') { current = model({ checkin: { at: '6:00am', late: 0, status: 'in', out: '3:05pm' } }); return reply(Object.assign({}, current, { signedOut: '3:05pm' })); }
    return reply({ ok: false, error: 'Nothing to do.' });
  });
  await page.goto('http://localhost:8813/myworkday/?p=sasha&k=KEY'); await page.waitForTimeout(1200);

  console.log('\nOne screen:\n');
  ok('no button to the white page', !(await page.$('.foot')) && !/Open my day|slower Google page/.test(await page.textContent('#main')));
  ok('Close my day sends you to the foot of this page, not to Google', (await page.getAttribute('#closeday', 'data-closego')) !== null && !(await page.getAttribute('#closeday', 'href')));
  ok('the update line is at the top', /Updated 9:10am/.test(await page.textContent('#upat')));

  console.log('\nA task, worked from its card:\n');
  await page.click('li.tk[data-id="00T1"] [data-open]'); await page.waitForTimeout(500);
  const card = await page.textContent('li.tk[data-id="00T1"] .tc');
  ok('it opens with what to do, the last note and the templates', /What to do: Call the client/.test(card) && /Called, no answer/.test(card) && /Past its projected lapse/.test(card) && (await page.$$('li.tk[data-id="00T1"] [data-tpl]')).length === 3, card.slice(0, 200));
  ok('asked for once, by its id', posts.filter(p => p.act === 'card' && p.sub === 'open' && p.id === '00T1').length === 1);
  await page.click('li.tk[data-id="00T1"] [data-cact="close"]');
  ok('an empty note is refused before anything is sent', /Say what was done first/.test(await page.textContent('li.tk[data-id="00T1"] .cst')) && !posts.some(p => p.sub === 'close'));
  await page.click('li.tk[data-id="00T1"] [data-tpl][data-a="close"]');
  ok('a template fills the note, with its first blank chosen', /paying \[amount\]/.test(await page.inputValue('li.tk[data-id="00T1"] [data-note]')));
  await page.fill('li.tk[data-id="00T1"] [data-note]', 'Spoke to the client: paying 552.29 by Friday, through the bank.');
  await page.click('li.tk[data-id="00T1"] [data-cact="close"]'); await page.waitForTimeout(500);
  const cl = posts.find(p => p.sub === 'close');
  ok('Close now posts the note to close it, with her key', cl && cl.id === '00T1' && /552\.29/.test(cl.note) && cl.wd === 'sasha' && cl.k === 'KEY', JSON.stringify(cl));
  ok('and the task ticks itself', /Closed 9:14am/.test(await page.textContent('li.tk[data-id="00T1"]')) && (await page.$('li.tk[data-id="00T1"] .li .s.done')) !== null);
  ok('a task on the overdue list has its card too', !!(await page.$('li.tk[data-id="00T3"] [data-open]')));

  console.log('\nWhat came up:\n');
  await page.fill('#scrubt', 'Agent Persad asked for the Mohammed medicals\nClient wants a statement');
  await page.click('[data-scrub]'); await page.waitForTimeout(500);
  const sc = posts.find(p => p.act === 'scrub');
  ok('each line goes, with its type', sc && sc.lines.split('\n').length === 2 && sc.type === 'Servicing', JSON.stringify(sc));
  ok('and says so', (await page.textContent('#scrubres')).match(/a task in your day/g).length === 2);

  console.log('\nThe read every two minutes:\n');
  await page.waitForTimeout(1600);
  await page.click('li.tk[data-id="00T3"] [data-open]'); await page.waitForTimeout(400);
  await page.fill('li.tk[data-id="00T3"] [data-note]', 'Half-written note for the underwriter');
  current = model({ at: '9:20am', progress: Object.assign({}, model().progress, { closed: 5 }) });
  await page.evaluate(() => { Object.defineProperty(document, 'visibilityState', { configurable: true, get: () => 'visible' }); document.dispatchEvent(new Event('visibilitychange')); });
  await page.waitForTimeout(700);
  ok('what is being typed is not wiped', (await page.inputValue('li.tk[data-id="00T3"] [data-note]')) === 'Half-written note for the underwriter');
  ok('the bar at the top says what changed', !(await page.isHidden('#upd')) && /Updated 9:20am: 2 more closed/.test(await page.textContent('#updt')), await page.textContent('#updt'));
  if (OUT) await page.screenshot({ path: path.join(OUT, 'one-update.png') });
  await page.click('#updgo'); await page.waitForTimeout(500);
  ok('Refresh draws the new day', await page.isHidden('#upd') && /Updated 9:20am/.test(await page.textContent('#upat')));

  console.log('\nClose my day, here:\n');
  await page.click('#closeday'); await page.waitForTimeout(700);
  ok('the close-out opens at the foot of the page', !!(await page.$('#closeform')) && /Inbox cleared/.test(await page.textContent('#closeform')));
  if (OUT) await page.screenshot({ path: path.join(OUT, 'one-close.png'), fullPage: true });
  await page.click('[data-closesend]');
  ok('every answer is asked for first', /answers are missing/.test(await page.textContent('#closest')) && !posts.some(p => p.act === 'close'));
  await page.fill('[data-r="00T1"]', 'Client away until Monday');
  await page.click('input[name="c_hk_inbox"][value="Done"] + span');
  await page.click('input[name="c_hk_desk"][value="Not done"] + span');
  ok('Not done asks why', !(await page.isHidden('[data-cr="hk_desk"]')));
  await page.fill('[data-cr="hk_desk"]', 'Filing left for the morning');
  await page.fill('[data-comment]', 'A good day');
  await page.click('[data-closesend]'); await page.waitForTimeout(600);
  const cq = posts.find(p => p.act === 'close');
  ok('it posts the reason and date, the checks, the comment and the sign-out', cq && cq.r_00T1 === 'Client away until Monday' && cq.d_00T1 === '2026-11-05' && cq.c_hk_inbox === 'Done' && cq.c_hk_desk === 'Not done' && cq.cr_hk_desk === 'Filing left for the morning' && cq.comment === 'A good day' && cq.out === '1', JSON.stringify(cq));
  ok('and the day reads closed', /Day closed · signed out 4:02pm/.test(await page.textContent('#main')) && /Your day is closed/.test(await page.textContent('#main')));
  ok('no page errors', !errs.length, errs.join(' | '));
  await ctx.close();

  console.log('\nA manager checks out:\n');
  const ctx2 = await b.newContext({ viewport: { width: 390, height: 844 } }); const p2 = await ctx2.newPage(); const errs2 = []; p2.on('pageerror', e => errs2.push(String(e)));
  current = model({ sid: 'akaash', first: 'Akaash', closeInline: false, close: null, types: null, list: null, checkin: { at: '6:00am', late: 0, status: 'in', out: '' } });
  await p2.route(/script\.google\.com\/macros/, async route => { const req = route.request(); if (req.method() !== 'POST') return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(current) });
    const q = Object.fromEntries(new URLSearchParams(req.postData())); posts.push(q);
    if (q.act === 'signout') { current = Object.assign({}, current, { checkin: { at: '6:00am', late: 0, status: 'in', out: '3:05pm' } }); return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(Object.assign({}, current, { signedOut: '3:05pm' })) }); }
    return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":false}' }); });
  await p2.goto('http://localhost:8813/myworkday/?p=akaash&k=KEY'); await p2.waitForTimeout(1000);
  ok('Check out, from this screen', /Check out/.test(await p2.textContent('#closeday')));
  await p2.click('#closeday'); await p2.waitForTimeout(500);
  ok('it signs out and says so', posts.some(p => p.act === 'signout' && p.wd === 'akaash') && /signed out 3:05pm/.test(await p2.textContent('#main')));
  ok('no page errors', !errs2.length, errs2.join(' | '));
  await b.close(); server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall green');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
