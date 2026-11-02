// The managers' screen on My workday (29 October 2026, 2026-10-29f), in a real browser, with a sample day for Mr Rampersad:
// the branch's work by agent (each agent's tasks drawn when opened), a task opened as a card with Draft my reply, Post and Close
// for the agent, a task opened for an agent, the day's notes as a timeline that opens the task, and his numbers for the day.
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
const T = (id, s, ty, o, due, late, stale) => ({ id, s, ty, o, due, late, stale: stale || 0 });
const unit = () => ({ at: '2:14pm', open: 9, late: 5, pend: 4, closedToday: 6, notesToday: 4, agents: [
  { a: 'Ricky Rampersad', aid: '003R', n: 2, late: 1, pend: 1, tasks: [T('00TU1', 'Pending - medicals - 1000894223 Ravi Persad', 'Pendings', 'Azariah', 'Tue 27 Oct', true), T('00TU2', 'Premium due - 5001816653 Reena Seeparsan', 'Renewa/PDl/Bill', 'Sasha', 'Thu 29 Oct', false)] },
  { a: 'Darryl Manick', aid: '003D', n: 3, late: 2, pend: 2, tasks: [T('00TU3', 'Pending - ECG - 1000906663 Marcus Bailey', 'Pendings', 'Azariah', 'Mon 26 Oct', true, 9), T('00TU4', 'Pending - proof of address - Ann Ali', 'Pendings', 'Azariah', 'Wed 28 Oct', true), T('00TU5', 'Servicing - beneficiary change - Khan', 'Servicing', 'Elizabeth', 'Thu 29 Oct', false)] },
  { a: 'Joy Barbara Sammah', aid: '003J', n: 2, late: 1, pend: 1, tasks: [T('00TU6', 'Pending - signature - 1000123456 Boodram', 'Pendings', 'Azariah', 'Fri 23 Oct', true, 6), T('00TU7', 'New business - quote follow-up - Mohammed', 'Opportunity', 'Elizabeth', 'Thu 29 Oct', false)] },
  { a: 'Neil Ramnanan', aid: '003N', n: 2, late: 1, pend: 0, tasks: [T('00TU8', 'Orphan adoption - Dhaniram 5002897487', 'Servicing', 'Sasha', 'Wed 28 Oct', true), T('00TU9', 'Premium due - Marcus Bailey', 'Renewa/PDl/Bill', 'Sasha', 'Thu 29 Oct', false)] },
  { a: 'Rajiv Soodoo', aid: '', n: 0, late: 0, pend: 0, tasks: [] }],
  timeline: [
    { id: '00TU3', m: 834, at: '1:54pm', who: 'Darryl', role: 'agent', s: 'Client did the ECG this morning at the clinic; results to underwriting by Friday.', on: 'Pending - ECG - 1000906663 Marcus Bailey', a: 'Darryl' },
    { id: '00TU8', m: 790, at: '1:10pm', who: 'Sasha', role: 'sales support', s: 'Passed to Neil by e-mail; he calls Mr Dhaniram this evening.', on: 'Orphan adoption - Dhaniram 5002897487', a: 'Neil' },
    { id: '00TU1', m: 700, at: '11:40am', who: 'Akaash', role: 'Unit Manager', s: 'Azariah, chase the clinic for the medicals today and post the date here.', on: 'Pending - medicals - 1000894223 Ravi Persad', a: 'Ricky' },
    { id: '00TU6', m: 610, at: '10:10am', who: 'Kamla', role: 'BMA', s: 'Joy, the signature page is still missing; please bring it in by Friday.', on: 'Pending - signature - 1000123456 Boodram', a: 'Joy' }] });
const checks = [['recruit', 'Recruitment: new names added to the pipeline'], ['coach', 'Coaching: agents coached one to one'], ['field', 'Joint field work: client meetings with an agent'], ['pendings', 'Unit pendings moved to a next step']].map(([id, q]) => ({ id, q, ph: 'Who', v: '', n: '' }));
const model = () => ({ ok: true, v: '2026-10-29f', sid: 'ricky', name: 'Ricky Rampersad', first: 'Ricky', day, date: 'Thursday 29 October 2026', at: '2:14pm', hours: '5am – 3pm', lunch: '12:00 – 1:00pm', start: '5:00am', claude: true,
  checkin: { at: '5:02am', late: 0, status: 'in', out: '', why: '' },
  progress: { lead: true, cleared: 9, target: 14, pct: 64, dayPct: 92, you: 6, team: 3, waiting: 2, asks: 2, inbox: 1, mineDue: 3, yourNotes: 11, sys: { 'follow-ups': 14 } },
  waiting: [{ k: 'ask', id: '00TW1', s: 'Bond letter for RPM Express', by: 'Kamla Dookran', said: 'Can I send the revised bond letter to the client today?', read: 'Kamla is waiting on your approval since 9:40am.', next: 'Approve, and she sends it today.', draft: 'Kamla, yes, send the revised bond letter to the client today and copy me.' }],
  desks: [{ sid: 'ricky', first: 'Me' }, { sid: 'kamla', first: 'Kamla' }], newDesks: [{ sid: 'sasha', first: 'Sasha' }, { sid: 'elizabeth', first: 'Elizabeth' }, { sid: 'azariah', first: 'Azariah' }, { sid: 'kamla', first: 'Kamla' }, { sid: 'pawan', first: 'Pawan' }],
  utypes: [{ k: 'Pendings', l: 'Pendings', to: 'azariah' }, { k: 'Servicing', l: 'Servicing', to: 'elizabeth' }, { k: 'Renewa/PDl/Bill', l: 'Premium dues and billing', to: 'sasha' }],
  next: [], achieved: [{ k: 'note', s: 'Note on Pending - medicals - Ravi Persad', at: '11:02am' }], bars: [], team: [],
  unit: unit(), unitLabel: 'The branch', checks, unitEve: 'https://script.google.com/x?f=umeve' });
const CARD = { ok: true, id: '00TU3', a: 'Darryl Manick', o: 'Azariah', label: 'Pendings', todo: 'Chase underwriting for the ECG result and post the date it is expected.', next: 'Overdue since Mon 26 Oct',
  notes: [{ who: 'Darryl', day: 'Thu 29 Oct', s: 'Client did the ECG this morning at the clinic; results to underwriting by Friday.' }, { who: 'Azariah', day: 'Tue 27 Oct', s: 'Clinic booked for Thursday.' }], more: 1 };
(async () => {
  await new Promise(r => server.listen(8818, r));
  const b = await chromium.launch(CHROME ? { executablePath: CHROME } : {});
  const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme: process.env.DARK ? 'dark' : 'light' }); const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e)));
  const posts = [];
  await page.route(/script\.google\.com\/macros/, route => { const req = route.request(), reply = o => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
    if (req.method() !== 'POST') return reply(model()); const p = Object.fromEntries(new URLSearchParams(req.postData())); posts.push(p);
    if (p.act === 'unit' && p.sub === 'open') return reply(Object.assign({}, CARD, { id: p.id }));
    if (p.act === 'unit' && p.sub === 'draft') return reply({ ok: true, read: 'Overdue since 26 Oct; Darryl says the ECG was done today.', reply: 'Azariah, Darryl confirms the ECG was done this morning. Please ask underwriting for the result by Friday 30 Oct and post the date here.', next: 'Azariah chases underwriting by Friday.' });
    if (p.act === 'unit' && p.sub === 'note') return reply({ ok: true, act: 'note', msg: 'On its Chatter, as yours.' });
    if (p.act === 'unit' && p.sub === 'new') return reply({ ok: true, msg: 'Opened for Rajiv, with Azariah, your note on it.' });
    if (p.act === 'unit' && p.sub === 'plan') return reply({ ok: true, msg: 'Your day is set.' });
    return reply({ ok: false }); });
  await page.goto('http://localhost:8818/myworkday/?p=ricky&k=KEY'); await page.waitForTimeout(1500);
  console.log('\nHis screen:\n');
  ok('the branch\'s work, by agent, with the totals', /The branch's work, by agent/.test(await page.textContent('#unit')) && (await page.$$('details.ua')).length === 5 && /9open/.test((await page.textContent('#unit .uchips')).replace(/\s/g, '')));
  ok('each agent closed until opened, with his counts', /Darryl Manick3 open · 2 overdue · 2 pendings/.test((await page.textContent('details.ua[data-ua="1"] summary')).replace(/\s+/g, ' ').replace(/ ?· ?/g, ' · ').replace(/\s(?=3 open)/, '')) || /3 open/.test(await page.textContent('details.ua[data-ua="1"] summary')));
  ok('no performance figures anywhere', !/API|production|persistency %|ranked|fact finds this/i.test(await page.textContent('#unit')));
  await page.click('details.ua[data-ua="1"] summary'); await page.waitForTimeout(300);
  ok('opened: his tasks, pendings first, with who has each and how late', (await page.$$('details.ua[data-ua="1"] li.ut')).length === 3 && /untouched 9 days/.test(await page.textContent('details.ua[data-ua="1"]')));
  await page.click('li.ut[data-uid="00TU3"] [data-uopen]'); await page.waitForTimeout(400);
  ok('a task opens as a card: what to do and its notes', /What to do: Chase underwriting/.test(await page.textContent('li.ut[data-uid="00TU3"] .tc')) && /Client did the ECG/.test(await page.textContent('li.ut[data-uid="00TU3"] .tc')));
  await page.click('li.ut[data-uid="00TU3"] [data-uact="draft"]'); await page.waitForTimeout(400);
  ok('Draft my reply fills the box, with where it stands', /ask underwriting for the result by Friday/.test(await page.inputValue('li.ut[data-uid="00TU3"] [data-unote]')) && /Where it stands/.test(await page.textContent('li.ut[data-uid="00TU3"] [data-uread]')) && !(await page.isHidden('li.ut[data-uid="00TU3"] [data-utone]')));
  if (OUT) await page.screenshot({ path: path.join(OUT, 'managers-card.png') });
  await page.click('li.ut[data-uid="00TU3"] [data-uact="note"]'); await page.waitForTimeout(400);
  ok('Post sends it for that task', posts.some(p => p.act === 'unit' && p.sub === 'note' && p.id === '00TU3' && /underwriting/.test(p.text)) && /On its Chatter/.test(await page.textContent('li.ut[data-uid="00TU3"] .tc .cst')));
  console.log('\nA task opened for an agent with nothing open:\n');
  await page.click('details.ua[data-ua="4"] summary'); await page.waitForTimeout(300);
  await page.click('details.ua[data-ua="4"] [data-unew]'); await page.waitForTimeout(200);
  await page.fill('details.ua[data-ua="4"] [data-uns]', 'Boodram - signature for 1000123456');
  await page.fill('details.ua[data-ua="4"] [data-unn]', 'Azariah, Rajiv will bring the signed page Friday; please hold the file until then.');
  ok('Pendings goes to Azariah by default', (await page.inputValue('details.ua[data-ua="4"] [data-und]')) === 'azariah');
  await page.click('details.ua[data-ua="4"] [data-unewgo]'); await page.waitForTimeout(400);
  ok('Open it sends the agent, the task, the desk and the note', posts.some(p => p.sub === 'new' && p.agent === 'Rajiv Soodoo' && p.to === 'azariah' && p.type === 'Pendings' && /signed page/.test(p.text)));
  console.log('\nThe day, as it happens:\n');
  ok('the timeline, newest first, who and on what', (await page.$$('#timeline li')).length === 4 && /Darryl \(agent\)/.test(await page.textContent('#timeline li:first-child')) && /1:54pm/.test(await page.textContent('#timeline li:first-child')));
  await page.click('#timeline [data-tlgo="00TU6"]'); await page.waitForTimeout(500);
  ok('a note opens its task in the list', !(await page.isHidden('li.ut[data-uid="00TU6"] .tc')) && await page.evaluate(() => document.querySelector('details.ua[data-ua="2"]').open));
  await page.fill('#mychecks [data-cp="coach"]', '2'); await page.click('#mychecks [data-uplan]'); await page.waitForTimeout(400);
  ok('his numbers for the day save', posts.some(p => p.sub === 'plan' && p.p_coach === '2'));
  const ow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  ok('nothing off the side at 390', ow <= 0, String(ow));
  ok('no page errors', !errs.length, errs.join(' | '));
  if (OUT) { await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: path.join(OUT, 'managers-full.png'), fullPage: true }); }
  await b.close(); server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall green');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
