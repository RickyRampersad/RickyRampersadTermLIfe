// Friday's meet-and-discuss ON THE SCREEN, the day before it happens.
//
// 28 October 2026: "create a framework for all to log in from tomorrow to create an
// experience". The experience is this: an agent opens the meeting on Thursday, sees the
// agenda with a question against every item, answers one, and it is on the agenda before
// anybody sits down. The floor stays shut until the day, and nothing they do on Thursday
// puts them on the register.
//
// What has to be true in the browser: the pre-meeting box is there before the day and the
// floor composer is not; the picker lists every item; picking one shows ITS question; what
// they send carries the item they picked; an entry brought in beforehand says so rather than
// claiming a minute of a meeting that has not run; and none of it runs off a phone.
//
// Run: node tests/e2e-friday.js   (needs playwright + a chromium on disk)
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const ROOT = path.join(__dirname, '..');
/* The container's chromium moves version by version, so it is looked for
   rather than pinned: a pinned path is the commonest reason one of these
   tests "fails" on a fresh machine. */
const CHROME = process.env.CHROME_PATH || (() => {
  const tries = ['/opt/pw-browsers/chromium'];
  for (const d of (fs.existsSync('/opt/pw-browsers') ? fs.readdirSync('/opt/pw-browsers') : [])) {
    tries.push('/opt/pw-browsers/' + d + '/chrome-linux64/chrome',
               '/opt/pw-browsers/' + d + '/chrome-linux/chrome');
  }
  return tries.find(p => { try { return fs.statSync(p).isFile(); } catch (e) { return false; } }) || tries[0];
})();
const TYPES = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css',
                '.png':'image/png', '.svg':'image/svg+xml', '.jpg':'image/jpeg' };
const PORT = Number(process.env.PORT) || 8871;
const SHOT = process.env.SHOT_DIR || require('os').tmpdir();

let fails = 0;
const ok = (what, cond, extra) => {
  console.log((cond ? '  ok   ' : '  FAIL ') + what + (extra !== undefined && !cond ? '  — ' + extra : ''));
  if (!cond) fails++;
};

const server = http.createServer((req, res) => {
  let f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('no'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  res.end(fs.readFileSync(f));
});

/* The agenda the seeder writes, as the backend hands it back. */
const AGENDA = [
  ['Opening',     'Where the year stands, 30 days in',        8,  'FY27 started on 1 October. Question: what have your first 30 days told you that your plan did not?'],
  ['Report back', 'What we took to the company',              10, 'Five things went in. Question: which one of the five matters most to your week, and why that one?'],
  ['Report back', 'What came back: business preserved counts', 12, 'Question: if a review filed earned the same recognition as new production, what would you do differently on Monday?'],
  ['The path',    'Moving by record, not by tenure',          10, 'Question: what is the next step you want, and what would you need to show for it?'],
  ['The work',    'Protecting what we win',                   12, 'Question: where does the work still fall down between you and the client?'],
  ['The floor',   'Every voice — what you are bringing',      25, 'Question: what do you want us to push this year, and what do you want us to fix?'],
  ['Close',       'What we commit to, and who owns it',        8, 'Question: what are you taking, and by when?'],
  ['Close',       'Wednesday resumes',                         5, 'The standing branch meeting is back on Wednesday 4 November at 9:00.']
].map((a, i) => ({
  id: 'AGD' + (i + 1), order: i + 1, clock: '', section: a[0], title: a[1],
  detail: a[3], presenter: i === 5 ? 'Everyone' : 'The Branch Manager',
  presenterEmail: i === 5 ? '' : 'bm@example.com', mine: false, minutes: a[2],
  visibility: 'all', materialsRequired: false, ready: false, readyAt: '',
  topics: '', reviewedBy: '', status: 'Scheduled', materials: []
}));

const MEETING = {
  id: 'MTG1', ref: 'MD-2026-10-30', type: 'Meet & Discuss',
  title: 'Back from the retreat: shaping FY27',
  subtitle: 'What we took to the company, what came back, and what you say',
  week: '', date: '30 Oct 2026', dateISO: '2026-10-30', start: '12:00 PM', end: '1:30 PM',
  format: 'In-person', location: '', chair: 'The Branch Manager', guest: '',
  status: 'published', scope: 'branch', participants: '', clientRef: '', topics: '',
  minutesStatus: 'none', lateAfter: 10, materialsDue: '', anchor: '', archiveLink: '',
  preRead: 'What the branch took to the company, in five lines: …',
  purpose: 'This is where we share what came out of the retreat and hear the whole team.',
  mission: 'Every voice heard, with a structure.',
  // The day before: the register has NOT opened, and the meeting is not past.
  checkInOpen: false, checkInOpensAt: 'Fri 30 Oct 11:30 AM',
  checkInClosesAt: 'Fri 30 Oct 1:30 PM', startsAt: 'Fri 30 Oct 12:00 PM',
  past: false, me: null
};

const detail = (over = {}) => Object.assign({
  ok: true,
  user: { email: 'one@example.com', name: 'Agent One', role: 'agent', unit: 'Unit One', agentNo: 'A00003' },
  meeting: MEETING, agenda: AGENDA, actions: [], minutes: [], contributions: [],
  minutesPublished: false, sections: ['Opening', 'Report back', 'The path', 'The work', 'The floor', 'Close'],
  session: null, kinds: ['Point', 'Question', 'Answer', 'Decision', 'Concern', 'Commitment', 'Apology'],
  topicList: ['Production', 'Persistency', 'Recruitment'], canRun: false,
  maxClipMinutes: 15, apologyReasons: ['Client appointment'], apologyOther: 'Something else',
  myRole: 'agent', presentCount: 0
}, over);

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const posted = [];

  const wire = async page => {
    await page.route('**script.google.com/**', async route => {
      const url = route.request().url();
      if (route.request().method() === 'POST') {
        let body = {};
        try { body = JSON.parse(route.request().postData() || '{}'); } catch (e) {}
        posted.push(body);
        return route.fulfill({ status: 200, contentType: 'application/json',
          body: JSON.stringify({ ok: true, id: 'CON1' }) });
      }
      if (/action=meeting\b/.test(url))
        return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(detail()) });
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ ok: true, user: detail().user, meetings: [MEETING], actions: [], feed: [] }) });
    });
  };

  /* ───────────── the day before, as an agent ───────────── */
  console.log('\nTHE DAY BEFORE, ON A LAPTOP');
  let page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e.message)));
  await wire(page);
  await page.addInitScript(() => {
    try { localStorage.setItem('rrb-meetings-token', 'tok-one'); sessionStorage.setItem('rrb-mm-door', '1'); } catch (e) {}
  });
  await page.goto(`http://localhost:${PORT}/meetings/`, { waitUntil: 'domcontentloaded' });
  await page.waitForTimeout(600);
  await page.evaluate(() => { S.token = 'tok-one'; S.user = { email: 'one@example.com', name: 'Agent One', role: 'agent' }; loadMeeting('MTG1'); });
  await page.waitForSelector('#fl-body', { timeout: 8000 });

  ok('the pre-meeting box is there the day before', await page.locator('#fl-agenda').count() === 1);
  ok('and it asks for the agenda, not the record',
    /Put it on the agenda/.test(await page.locator('#fl-go').innerText()),
    await page.locator('#fl-go').innerText());
  ok('the clip recorder is not offered before the meeting', await page.locator('#fl-rec').count() === 0);
  ok('it says the floor opens on the day',
    /floor opens on the day/i.test(await page.locator('#fl-body').locator('xpath=ancestor::div[contains(@class,"card")][1]').innerText()),
    await page.locator('#fl-body').locator('xpath=ancestor::div[contains(@class,"card")][1]').innerText());

  const opts = await page.locator('#fl-agenda option').allInnerTexts();
  ok('the picker lists all eight items plus the whole meeting', opts.length === 9, opts.length);
  ok('the floor is one of them', opts.some(o => /Every voice/.test(o)), opts.join(' | '));

  await page.selectOption('#fl-agenda', 'AGD6');
  await page.waitForTimeout(120);
  ok("picking an item shows THAT item's question",
    /what do you want us to push/i.test(await page.locator('#fl-ask').innerText()),
    await page.locator('#fl-ask').innerText());
  await page.selectOption('#fl-agenda', 'AGD4');
  await page.waitForTimeout(120);
  ok('and changing the item changes the question',
    /the next step you want/i.test(await page.locator('#fl-ask').innerText()),
    await page.locator('#fl-ask').innerText());

  await page.selectOption('#fl-agenda', 'AGD6');
  await page.selectOption('#fl-kind', 'Concern');
  await page.fill('#fl-body', 'Push: get retention counted beside production. Fix: the wait after a client answers.');
  await page.screenshot({ path: path.join(SHOT, 'friday-laptop.png'), fullPage: true });
  await page.click('#fl-go');
  await page.waitForTimeout(500);

  const sent = posted.filter(b => b.action === 'contribute')[0];
  ok('pressing it sends the contribution', !!sent, JSON.stringify(posted));
  ok('carrying the item they picked', sent && sent.agendaId === 'AGD6', sent && sent.agendaId);
  ok('and what kind it is', sent && sent.kind === 'Concern', sent && sent.kind);
  ok('with their own words', sent && /retention counted beside production/.test(sent.body || ''));
  ok('no script errors', errs.length === 0, errs.join(' | '));

  /* ───────────── what it looks like once brought in ───────────── */
  console.log('\nONCE IT IS IN');
  await page.unroute('**script.google.com/**');
  await page.route('**script.google.com/**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(detail({
      contributions: [{ id: 'CON1', meetingId: 'MTG1', agendaId: 'AGD6',
        when: 'Thu 29 Oct 8:12 PM', time: '8:12 PM', offset: -1,
        email: 'one@example.com', name: 'Agent One', role: 'agent', kind: 'Concern',
        body: 'Push: get retention counted beside production.', topics: '',
        visibility: 'all', clipId: '', edited: '' }]
    })) }));
  await page.evaluate(() => loadMeeting('MTG1'));
  await page.waitForSelector('.said', { timeout: 8000 });
  const said = await page.locator('.said').first().innerText();
  ok('it says it was brought in beforehand', /brought in beforehand/.test(said), said);
  ok('and never claims a minute of a meeting that has not run', !/min in/.test(said), said);

  /* ───────────── on the day, the floor is the floor ───────────── */
  console.log('\nON THE DAY');
  await page.unroute('**script.google.com/**');
  await page.route('**script.google.com/**', route =>
    route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(detail({
      meeting: Object.assign({}, MEETING, { checkInOpen: true }),
      session: null
    })) }));
  await page.evaluate(() => loadMeeting('MTG1'));
  await page.waitForTimeout(500);
  ok('the pre-meeting box is gone once the register opens',
    await page.locator('#fl-agenda').count() === 0);

  /* ───────────── a phone ───────────── */
  console.log('\nON A PHONE');
  const ph = await browser.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
  const perrs = [];
  ph.on('pageerror', e => perrs.push(String(e.message)));
  await wire(ph);
  await ph.addInitScript(() => {
    try { localStorage.setItem('rrb-meetings-token', 'tok-one'); sessionStorage.setItem('rrb-mm-door', '1'); } catch (e) {}
  });
  await ph.goto(`http://localhost:${PORT}/meetings/`, { waitUntil: 'domcontentloaded' });
  await ph.waitForTimeout(600);
  await ph.evaluate(() => { S.token = 'tok-one'; S.user = { email: 'one@example.com', name: 'Agent One', role: 'agent' }; loadMeeting('MTG1'); });
  await ph.waitForSelector('#fl-body', { timeout: 8000 });
  await ph.screenshot({ path: path.join(SHOT, 'friday-phone.png'), fullPage: true });

  const over = await ph.evaluate(() => {
    window.scrollTo(2000, 0);
    const x = window.scrollX;
    window.scrollTo(0, 0);
    return x;
  });
  ok('nothing scrolls sideways on a phone', over === 0, over + 'px');
  const box = await ph.locator('#fl-body').boundingBox();
  ok('the box fits inside the screen', box && box.x >= 0 && box.x + box.width <= 390,
    box && JSON.stringify(box));
  const fsz = await ph.locator('#fl-body').evaluate(el => parseFloat(getComputedStyle(el).fontSize));
  ok('and is 16px or more, so iOS does not zoom in on it', fsz >= 16, fsz + 'px');
  ok('no script errors on the phone', perrs.length === 0, perrs.join(' | '));

  console.log('\nscreenshots: ' + path.join(SHOT, 'friday-laptop.png') + ', ' + path.join(SHOT, 'friday-phone.png'));
  await browser.close();
  server.close();
  console.log('\n' + (fails ? fails + ' FAILED' : 'all passing'));
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); server.close(); process.exit(1); });
