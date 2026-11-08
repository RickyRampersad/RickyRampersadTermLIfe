//  Shoot the REAL Meeting Builder for the how-to film. The backend is fully
//  mocked, so nothing reaches the live sheet. The agent, every name on screen
//  and every contribution are invented: no real agent number and no client
//  anything goes into an MP4 at a public URL.
//
//  The agenda items ARE the branch's own standing rota items, with their own
//  Detail text as the question, because that is what an agent opening the page
//  tomorrow will actually see.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = '/home/user/RickyRampersadTermLIfe';
const OUT = process.argv[2] || path.join(ROOT, 'tools/film/mtuseshots');
const CHROME = '/opt/pw-browsers/chromium';
const TYPES = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css',
                '.png':'image/png', '.svg':'image/svg+xml', '.jpg':'image/jpeg' };
const PORT = 8893;

const AGENT = 'A10072', WHO = 'Marcus Alleyne', EMAIL = 'marcus@example.invalid';

//  checkInOpen FALSE is what opens the composer: floorSection draws the
//  pre-meeting box only while the register has not opened (upcoming =
//  !live && !past && !checkInOpen). That is the state the night before,
//  which is exactly what the film teaches.
const MTG = {
  id: 'M1', title: 'Branch Meeting', type: 'Branch', week: 'Week 5',
  date: 'Friday 30 October 2026', dateISO: '2026-10-30',
  start: '12:00', end: '13:30', location: 'Branch boardroom',
  chair: 'Branch Manager', format: 'In the boardroom',
  status: 'scheduled', past: false, checkInOpen: false,
  checkInOpensAt: 'at 11:30', checkInClosesAt: 'at 12:30'
};

const AGENDA = [
  { id:'A1', order:1, title:'Open · Mission Statement · Moment of Silence', minutes:3,
    section:'Opening', presenter:'', presenterEmail:'', mine:false, materials:[],
    visibility:'all', ready:true,
    detail:'Three minutes. The register is the app; nobody is marked in from the front.' },
  { id:'A2', order:2, title:'The production board', minutes:7,
    section:'Production', presenter:'', presenterEmail:'', mine:false, materials:[],
    visibility:'all', ready:true,
    detail:'Written this week against target, by unit. The screen is up — only the exceptions are spoken aloud.' },
  { id:'A3', order:3, title:'This week’s call list', minutes:12,
    section:'Production', presenter:'', presenterEmail:'', mine:false, materials:[],
    visibility:'all', ready:true,
    detail:'Who called, what was asked, what closed.' },
  { id:'A4', order:4, title:'What worked for me', minutes:8,
    section:'The room', presenter:'', presenterEmail:'', mine:false, materials:[],
    visibility:'all', ready:true,
    detail:'One agent, one case, what they actually did.' },
  { id:'A5', order:5, title:'Open floor', minutes:8,
    section:'The room', presenter:'', presenterEmail:'', mine:false, materials:[],
    visibility:'all', ready:true, detail:'The room’s time. Anything not on the agenda.' }
];

const ANSWER = 'Six on the list, four reached. Two asked for the critical illness ' +
  'top-up — I am bringing both files Friday.';

//  Six invented people, so the branch sees the shape of a built agenda.
const BROUGHT = [
  { name:'Marcus Alleyne', email:EMAIL, kind:'Point', agendaId:'A3', topic:'Cross-sell',
    body:ANSWER, role:'agent', offset:-1, at:'last night' },
  { name:'Renee Charles', email:'r@example.invalid', kind:'Commitment', agendaId:'A2',
    topic:'Production', role:'agent', offset:-1, at:'last night',
    body:'Two applications in by Thursday. Both already have the fact find signed.' },
  { name:'Devon Pierre', email:'d@example.invalid', kind:'Concern', agendaId:'A3',
    topic:'Cross-sell', role:'agent', offset:-1, at:'this morning',
    body:'Three of mine on the list have no number on file. I need those updated before I can call.' },
  { name:'Simone Baptiste', email:'s@example.invalid', kind:'Question', agendaId:'A5',
    topic:'', role:'agent', offset:-1, at:'this morning',
    body:'Who do I send a maturity to when the client wants the money moved the same week?' },
  { name:'Kofi Ramdeen', email:'k@example.invalid', kind:'Point', agendaId:'A4',
    topic:'', role:'agent', offset:-1, at:'this morning',
    body:'The one that closed for me was the second call, not the first. I stopped pitching and read the gap back.' },
  { name:'Arlene Joseph', email:'a@example.invalid', kind:'Answer', agendaId:'A2',
    topic:'Production', role:'staff', offset:-1, at:'this morning',
    body:'Board is current to last night. Anything settled today shows tomorrow morning.' }
];

const server = http.createServer((req, res) => {
  let f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('no'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  res.end(fs.readFileSync(f));
});

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const b = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  //  How many of the six have "arrived" — scene 8 wants a full agenda, the
  //  earlier scenes want it empty so the composer is the thing on screen.
  let brought = 0;

  const detail = () => ({
    ok: true,
    user: { email: EMAIL, name: WHO, role: 'agent', staff: false },
    meeting: MTG,
    agenda: AGENDA,
    actions: [], minutes: [], minutesPublished: false,
    sections: ['Opening', 'Production', 'The room'],
    session: null,
    contributions: BROUGHT.slice(0, brought),
    kinds: ['Point', 'Question', 'Answer', 'Decision', 'Concern', 'Commitment', 'Apology'],
    topicList: ['Production', 'Cross-sell', 'Conservation', 'Recruiting', 'Service'],
    canRun: false, maxClipMinutes: 15, myRole: 'member',
    apologyReasons: ['On leave', 'With a client', 'Unwell'], apologyOther: 'Something else',
    statuses: ['Open', 'In progress', 'Complete'],
    register: null, locked: false
  });

  const open = async (w, h) => {
    const pg = await b.newPage({ viewport: { width: w, height: h }, deviceScaleFactor: 2 });
    pg.on('pageerror', e => console.log('  PAGE ERROR: ' + e.message));
    pg.on('console', m => { if (m.type() === 'error') console.log('  console: ' + m.text()); });
    await pg.route('**script.google.com/**', async route => {
      const url = route.request().url();
      const j = x => route.fulfill({ status: 200, contentType: 'application/json',
                                     body: JSON.stringify(x) });
      if (route.request().method() === 'POST') {
        let bd = {}; try { bd = JSON.parse(route.request().postData() || '{}'); } catch (e) {}
        if (bd.action === 'login')
          return j({ ok: true, token: 'tk', user: { name: WHO, email: EMAIL, role: 'agent' } });
        if (bd.action === 'contribute') { brought = Math.max(brought, 1); return j({ ok: true }); }
        return j({ ok: true });
      }
      if (/action=ping/.test(url))
        return j({ ok: true, roster: { onTheRoll: 19, canSignIn: 19, cannot: 0 } });
      if (/action=home/.test(url))
        return j({ ok: true, user: { name: WHO, email: EMAIL, role: 'agent' },
                   next: MTG, meetings: [MTG], actionCounts: {} });
      if (/action=meeting/.test(url)) return j(detail());
      if (/action=prep/.test(url))
        return j({ ok: true, id: 'M1', slots: [] });
      return j({ ok: false, error: 'not mocked: ' + url });
    });
    await pg.goto(`http://localhost:${PORT}/meetings/`, { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(700);
    await pg.fill('#li-email', AGENT);
    await pg.click('#li-go');
    await pg.waitForTimeout(1300);
    return pg;
  };

  const shot = async (pg, name) => {
    await pg.waitForTimeout(400);
    //  JPEG, because the builder folds every shot into one page as a data
    //  URI and PNG took that page to 2.4 MB.
    await pg.screenshot({ path: path.join(OUT, name + '.jpg'), quality: 88 });
    console.log('  shot ' + name);
  };
  //  The nav is sticky, so an element screenshot of anything tall catches
  //  the bar across the middle of it and reads as a rendering fault.
  const unstick = pg => pg.addStyleTag({ content: '.nav{position:static !important}' });
  //  The composer card runs 1,176px tall because of its preamble, and the
  //  film's card frame is 468px high: cropped it loses the Send button,
  //  scaled it is unreadable. So the FORM is clipped out of it — from the
  //  pickers down to the button — which is the part the line is about.
  //  `w` names the element whose width the crop takes, when the top anchor
  //  is a narrow one (a label) and the crop still has to be card-wide.
  const clipTo = async (pg, from, to, name, pad, w) => {
    await pg.waitForTimeout(400);
    const box = await pg.evaluate(([f, t, p, wsel]) => {
      const a = document.querySelector(f).getBoundingClientRect();
      const b = document.querySelector(t).getBoundingClientRect();
      const c = document.querySelector(wsel || f).getBoundingClientRect();
      return { x: Math.max(0, c.left - p), y: Math.max(0, a.top - p),
               width: c.width + p * 2, height: (b.bottom - a.top) + p * 2 };
    }, [from, to, pad == null ? 16 : pad, w]);
    await pg.screenshot({ path: path.join(OUT, name + '.jpg'), quality: 88, clip: box });
    console.log('  clip ' + name);
  };
  const card = async (pg, sel, name) => {
    await pg.waitForTimeout(400);
    const el = await pg.$(sel);
    if (!el) throw new Error('no element ' + sel + ' for ' + name);
    await el.screenshot({ path: path.join(OUT, name + '.jpg'), quality: 88 });
    console.log('  card ' + name + '  (' + sel + ')');
  };

  // 1-2: the day, and the run-up stop that says bring something
  let pg = await open(390, 844);
  await shot(pg, '01-day');
  const bring = await pg.$('[data-bring]');
  if (bring) await card(pg, '[data-bring]', 'c-bringbtn');
  await unstick(pg);
  //  The one stop the film is about, on its own.
  const stop = await pg.$('.rail li:has-text("Put what you are bringing")');
  if (stop) await card(pg, '.rail li:has-text("Put what you are bringing")', 'c-stop');
  const rail = await pg.$('.todo');
  if (rail) await card(pg, '.todo', 'c-bring');
  await card(pg, '.todo .btn-row', 'c-btns');

  // 3-5: the composer — empty, item picked with its question, answer typed
  await pg.evaluate(() => { S.meetingId = 'M1'; go('meeting'); });
  await pg.waitForTimeout(1500);
  const comp = await pg.$('#fl-agenda');
  if (!comp) throw new Error('the pre-meeting composer did not draw');
  await pg.$eval('#fl-agenda', el => el.scrollIntoView({ block: 'center' }));
  await shot(pg, '02-form');
  await card(pg, '#fl-agenda >> xpath=ancestor::div[contains(@class,"card")][1]', 'c-form');

  await pg.selectOption('#fl-agenda', 'A3');
  await pg.selectOption('#fl-topic', 'Cross-sell');
  await pg.waitForTimeout(500);
  await shot(pg, '03-picked');
  await clipTo(pg, '.row3', '#fl-ask', 'c-picked');

  await pg.selectOption('#fl-kind', 'Point');
  await pg.fill('#fl-body', ANSWER);
  await pg.waitForTimeout(400);
  await shot(pg, '04-typed');
  await clipTo(pg, 'label[for="fl-body"]', '#fl-go', 'c-typed', 18, '#fl-body');
  await card(pg, '#fl-go', 'c-go');
  await pg.close();

  // 6: the whole branch's answers, grouped
  brought = BROUGHT.length;
  pg = await open(1280, 900);
  await pg.evaluate(() => { S.meetingId = 'M1'; go('built'); });
  await pg.waitForTimeout(1600);
  await unstick(pg);
  await shot(pg, '05-built');
  await card(pg, '.btstrip', 'c-strip');
  const seg = await pg.$('.btseg');
  if (seg) await card(pg, '.btseg', 'c-seg');
  await pg.click('[data-by="who"]');
  await pg.waitForTimeout(700);
  await shot(pg, '06-who');
  await pg.close();

  await b.close(); server.close();
  console.log('done');
})().catch(e => { console.error('FAILED: ' + e.message); process.exit(1); });
