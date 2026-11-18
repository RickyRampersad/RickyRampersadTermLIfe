// The meeting on the screen (10 Nov 2026): one item at a time, full screen, the owner, the question, the clock, and what the
// room has put on the record against the item. Before the meeting it steps through the agenda; live, it follows On now.
// AGENDA_JSON may point at a file of agenda items to draw instead of the made-up ones (for a preview of a real Wednesday).
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), http = require('http');
const ROOT = path.join(__dirname, '..'), PORT = Number(process.env.PORT) || 8873, SHOT = process.env.SHOT_DIR || '';
let fails = 0; const ok = (w, c, x) => { console.log((c ? '  ok   ' : '  FAIL ') + w + (x !== undefined && !c ? '  — ' + x : '')); if (!c) fails++; };
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.jpg': 'image/jpeg' };
const server = http.createServer((req, res) => { let f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0])); if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('no'); } res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' }); res.end(fs.readFileSync(f)); });
let RAW = [['Opening', 'Open: why we are here', 2, 'The Branch Manager', 'One sentence on the week.'],
  ['Accountability', 'Last week’s actions, answered by their owners', 6, 'The BMA', 'Each owner answers.\nQuestion: What did you commit to, and is it done?'],
  ['Orphan portfolio', 'The agent round: one household each', 18, 'Every agent named on orphans', 'Two minutes each.\nQuestion: One household, what was agreed, the next date.'],
  ['Decision', 'Actions read back', 3, 'The BMA', 'Every action with its owner and date.']];
if (process.env.AGENDA_JSON) RAW = JSON.parse(fs.readFileSync(process.env.AGENDA_JSON, 'utf8'));
let t = 9 * 60; const AGENDA = RAW.map((a, i) => { const c = Math.floor(t / 60) + ':' + String(t % 60).padStart(2, '0'); t += a[2];
  return { id: 'AG' + i, order: i + 1, clock: c, section: a[0], title: a[1], minutes: a[2], presenter: a[3], detail: a[4], mine: false, materials: [], topics: '', visibility: 'all' }; });
const MEETING = { id: 'MTG1', ref: 'BM-2026-11-11', type: 'Branch Meeting', title: process.env.MTG_TITLE || 'Branch meeting', subtitle: 'A working meeting.', date: 'Wed 11 Nov 2026', start: '9:00 AM', end: '10:30 AM', status: 'published', scope: 'branch', checkInOpen: true, past: false, minutesStatus: 'none', archiveLink: '' };
const CUR = Math.min(2, AGENDA.length - 1);
let live = false;
const detail = () => ({ ok: true, user: { email: 'bm@example.com', name: 'The Branch Manager', role: 'manager' }, meeting: MEETING, agenda: AGENDA, actions: [], minutes: [],
  contributions: [{ agendaId: AGENDA[CUR].id, name: 'Neil Ramnanan', kind: 'Commitment', body: 'Household reviewed Monday; client keeps the policy, beneficiary updated. Next call 18 Nov.', offset: 12 },
    { agendaId: AGENDA[CUR].id, name: 'Felicia Rampersad', kind: 'Point', body: 'Client asked for a joint visit with the branch. Booked Thursday 10am.', offset: 14 },
    { agendaId: AGENDA[0].id, name: 'Joy Barbara Sammah', kind: 'Point', body: 'An idea: one hour on Thursdays for orphan call-backs, all agents.', offset: -1 }],
  session: live ? { running: true, elapsed: 26, allotted: 90, started: '9:01 AM', startedBy: 'The Branch Manager', currentAgendaId: AGENDA[CUR].id, currentTitle: AGENDA[CUR].title,
    currentPresenter: AGENDA[CUR].presenter, currentAllotted: AGENDA[CUR].minutes, itemStartedISO: new Date(Date.now() - 7 * 60000 - 20000).toISOString(),
    nextAgendaId: (AGENDA[CUR + 1] || {}).id, nextTitle: (AGENDA[CUR + 1] || {}).title, nextPresenter: (AGENDA[CUR + 1] || {}).presenter } : null,
  canRun: true, kinds: ['Point', 'Question', 'Commitment'], topicList: [], sections: [], myRole: 'manager', presentCount: 21, maxClipMinutes: 15, apologyReasons: [], apologyOther: '' });
(async () => {
  await new Promise(r => server.listen(PORT, r));
  const b = await chromium.launch(); const page = await b.newPage({ viewport: { width: 1920, height: 1080 } });
  const errs = []; page.on('pageerror', e => errs.push(String(e.message)));
  const posted = [];
  await page.route('**script.google.com/**', r => { if (r.request().method() === 'POST') { posted.push(r.request().postData()); return r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' }); }
    return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(/action=meeting\b/.test(r.request().url()) ? detail() : { ok: true, user: detail().user, meetings: [MEETING], actions: [], feed: [] }) }); });
  await page.addInitScript(() => { try { localStorage.setItem('rrb-meetings-token', 'tok'); sessionStorage.setItem('rrb-mm-door', '1'); } catch (e) {} });
  await page.goto(`http://localhost:${PORT}/meetings/`, { waitUntil: 'domcontentloaded' }); await page.waitForTimeout(700);
  await page.evaluate(() => { S.token = 'tok'; S.user = { email: 'bm@example.com', name: 'The Branch Manager', role: 'manager' }; loadMeeting('MTG1'); });
  await page.waitForSelector('#scr-open', { timeout: 8000 });
  ok('the meeting page offers "Put it on the screen"', await page.locator('#scr-open').count() === 1);
  await page.click('#scr-open'); await page.waitForTimeout(300);
  ok('it opens on the agenda: every item, its owner and minutes', await page.locator('#scr .scr-list > div').count() === AGENDA.length);
  ok('and what was brought in before the meeting', /Brought in before the meeting · 1/i.test(await page.locator('#scr').innerText()));
  if (SHOT) await page.screenshot({ path: SHOT + '/screen-agenda.png' });
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(150);
  ok('the right arrow moves to item 1', /1 of /i.test(await page.locator('#scr .scr-eyebrow').innerText()));
  await page.keyboard.press('ArrowRight'); await page.waitForTimeout(150);
  ok('the question is set apart', await page.locator('#scr .scr-det .q').count() === 1);
  await page.keyboard.press('Escape'); await page.waitForTimeout(200);
  ok('Escape closes it and the meeting page is back', await page.locator('#scr').isHidden() && await page.locator('#scr-open').count() === 1);
  live = true;
  await page.evaluate(() => loadMeeting('MTG1')); await page.waitForSelector('#scr-open'); await page.click('#scr-open'); await page.waitForTimeout(1300);
  const txt = await page.locator('#scr').innerText();
  ok('live, it follows the item On now', txt.indexOf(AGENDA[CUR].title) > -1 && /on now/i.test(txt), txt.slice(0, 200));
  ok('the clock counts the item down', /^\+?\d+:\d\d$/.test((await page.locator('#scr-n').innerText()).trim()), await page.locator('#scr-n').innerText());
  ok('what the room put on the record for this item, newest first', /On the record for this item · 2/i.test(txt) && txt.indexOf('Felicia') < txt.indexOf('Neil'));
  ok('the next item is named', txt.indexOf('Next:') > -1);
  if (SHOT) await page.screenshot({ path: SHOT + '/screen-live.png' });
  await page.keyboard.press(' '); await page.waitForTimeout(300);
  ok('Space moves the meeting on, for whoever runs it', posted.some(p => /"currentItem"/.test(p) && p.indexOf(AGENDA[CUR + 1] ? AGENDA[CUR + 1].id : 'zz') > -1));
  const sw = await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1);
  ok('nothing runs off the screen at 1920', sw);
  await page.evaluate(() => document.fullscreenElement && document.exitFullscreen()).catch(() => {});
  await page.waitForTimeout(200);
  ok('no script errors', !errs.length, errs.join(' | '));
  await b.close(); server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall green'); process.exit(fails ? 1 : 0);
})();
