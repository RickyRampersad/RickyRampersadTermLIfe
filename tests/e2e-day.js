// MY DAY and THE BRANCH, on the page, one role at a time.
//
// The backend is mocked to the exact shapes apiDesk_ returns, so what this
// asserts is the PAGE: that each role lands on its own screen, that the
// masthead calls a unit manager a unit manager, and above all that an agent's
// browser is never handed another advisor's name or another desk's figures.
// The branch here is invented and every figure on it is made up.
const path = require('path'), fs = require('fs');
const CH = '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
let chromium;
try { chromium = require('playwright').chromium; }
catch (e) {
  try { chromium = require(process.env.PW || '/opt/node22/lib/node_modules/playwright').chromium; }
  catch (e2) { console.log('  SKIP  playwright is not installed here'); process.exit(0); }
}
const PAGE = 'file://' + path.join(__dirname, '..', 'meetings', 'index.html');
const MARK = path.join(__dirname, '..', 'logo-mark.png');

let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };

const SRC = [
  { key: 'tasks', label: 'Salesforce tasks', live: true, why: '' },
  { key: 'goals', label: 'Flight plans and goals', live: false, why: 'Needs FACTFIND_GOAL_TOKEN.' }
];
const CLO = (id, item, done, detail) => ({ id, item, auto: id, done, detail,
  by: done ? 'checked' : '', at: '', reason: '' });

const DAY = (o) => Object.assign({
  live: true, why: '', onTracker: true, staffId: 'x', hours: '9am – 5pm',
  arrived: '08:52', signedOut: '', absent: false, absentReason: '',
  mailAM: '08:25', mailPM: '', blocks: [], owed: 0, filed: 0, late: 0,
  items: [], itemsOf: 0, itemsLeft: 0, closeoutAt: '15:45',
  ownCloseOff: false, trackerUrl: 'https://rickyrampersadbranch.com/kpi/'
}, o);

const BLOCK = (state, focus, sf) => ({
  id: 'KPI1', label: 'KPI 1', time: '8 – 10am', focus: focus, kpi: 'Pendings', due: 10,
  type: 'Pendings', state: state, filed: state === 'filed',
  actioned: state === 'filed' ? 'Cleared four' : '', blocker: '', resolved: '', open: '',
  sf: sf === undefined ? null : sf
});

const BRANCH = {
  findings: [{ key: 'pipe.stuck', severity: 3, heading: 'The pipeline is holding the year',
               finding: '197 applications over 120 days, TT$3,448,693 of API.', figure: 3448693,
               source: 'Salesforce', who: '', first: true }],
  close: { days: 7, expected: 4, filed: 2, rate: 50,
           closed: [{ name: 'Gita Imaginary', role: 'staff', days: 2,
                      blocked: [{ day: '2026-10-16', text: 'Waiting on labs' }], help: [] }],
           silent: [{ name: 'Pawan Imagined', role: 'staff' }] },
  tasks: { live: true, total: { open: 399, overdue: 123, waiting: 133, nodate: 17, untouched: 42 },
           people: [{ name: 'Gita Imaginary', open: 107, overdue: 56, waiting: 55, oldestDays: 74 }] },
  pipeline: { total: { stuck: 197, stuckApi: 3448693 }, oldestDays: 640,
              bySupport: [{ name: 'Gita', n: 61, api: 1240500, oldest: 640 }],
              byAgent: [], byStatus: [] },
  factfind: { year: { submitted: 131, apiRec: 3168518, pickedUp: 152626, conversion: 4.8 },
              week: { submitted: 11 }, month: { submitted: 23 },
              queue: { pending: 21, breaching: 18, oldestDays: 37, oldestWho: 'Devi Invented' },
              reviewers: [], logging: { total: 0 }, series: [] },
  reminders: { live: true, set: 310, behind: 480, noReminder: 170 },
  quiet: [{ name: 'Hamid Fictitious', month: 0, year: 3, owed: 4, why: 'Nothing this month.' }],
  topics: [{ name: 'Devi Invented', role: 'unitmgr', topic: 'Your review queue' }],
  days: [{ name: 'Gita Imaginary', role: 'staff', unit: '', hours: '9am – 5pm',
           owed: 4, filed: 1, late: 2, blocks: [BLOCK('filed', 'Premium Dues', 12)],
           arrived: '08:52', mailAM: '08:25', mailPM: '', itemsOf: 3, itemsLeft: 2 }]
};

const DESK = {
  agent: { token: 'T-A', me: { name: 'Rajiv Pretendo', role: 'agent', unit: 'Devi Invented' },
    items: [], numbers: [{ label: 'Fact finds this week', value: 4 }],
    day: DAY({ onTracker: false, staffId: 'rajiv', hours: '', arrived: '', mailAM: '',
               none: 'Advisors are not on the KPI tracker: no blocks, no mail sweep. ' +
                     'Your day is your flight plan, your fact finds and what you wrote below.' }),
    topic: { topic: 'Recommended against written', question: 'Which case do you re-open first?',
             evidence: 'Conversion 7.5%.', source: 'Fact finds', rank: 90 },
    closedToday: false, sources: SRC },
  staff: { token: 'T-S', me: { name: 'Gita Imaginary', role: 'staff', unit: '' },
    items: [{ kind: 'stuck', what: 'A client — TPI10041', why: 'Postponed, TT$75,948 API',
              days: 640, source: 'Salesforce', day: '2026-10-16' }],
    numbers: [{ label: 'Open tasks', value: 107 }],
    day: DAY({ staffId: 'gita', owed: 2, filed: 1, late: 1,
               blocks: [BLOCK('filed', 'Premium Dues', 12), BLOCK('late', 'Reporting')],
               itemsOf: 3, itemsLeft: 2,
               items: [CLO('blocks', 'Every block reported', false, '1 of 2 reported'),
                       CLO('mail', 'Afternoon mail sweep cleared', false, 'not swept'),
                       CLO('written', 'Anything you fell short on, noted', true, '2 noted today')] }),
    topic: { topic: 'The applications on your desk', question: 'Which three clear this week?',
             evidence: '61 over 120 days.', source: 'Pipeline', rank: 95 },
    closedToday: false, sources: SRC, branch: BRANCH },
  unitmgr: { token: 'T-U', me: { name: 'Devi Invented', role: 'unitmgr', unit: 'Devi Invented' },
    items: [], numbers: [{ label: 'Fact finds waiting on you', value: 13 }],
    day: DAY({ staffId: 'devi', hours: '8am – 4:30pm', arrived: '07:58', owed: 1, filed: 1,
               late: 0, blocks: [BLOCK('filed', 'Unit activity and pipeline', 3)],
               itemsOf: 1, itemsLeft: 0,
               items: [CLO('blocks', 'Every block reported', true, '1 of 1 reported')] }),
    topic: { topic: 'Your review queue', question: 'When are they cleared?',
             evidence: '13 waiting.', source: 'Fact finds', rank: 95 },
    closedToday: false, sources: SRC,
    unit: { name: 'Devi Invented',
            review: { pending: 13, medianDays: 1.4, returnRate: 10 }, days: [],
            people: [{ name: 'Hamid Fictitious', topic: 'What changed', evidence: '3 this year.' }],
            quiet: BRANCH.quiet } },
  manager: { token: 'T-M', me: { name: 'Anand Pretend', role: 'manager', unit: '' },
    items: [], numbers: [{ label: 'Open tasks', value: 35 }],
    day: DAY({ staffId: 'ricky', hours: '5am – 12am', arrived: '05:04', mailAM: '05:30',
               owed: 1, filed: 0, late: 1,
               blocks: [BLOCK('late', 'Recruitment, licensing and staffing')],
               itemsOf: 1, itemsLeft: 1,
               items: [CLO('blocks', 'Every block reported', false, '0 of 1 reported')] }),
    topic: { topic: 'Recommended against written, for the branch', question: 'What are we changing?',
             evidence: '4.8%.', source: 'Fact finds', rank: 100 },
    closedToday: true, sources: SRC, branch: BRANCH }
};

const HOME = (role, name) => ({
  ok: true, user: { name: name, role: role, email: 'x@example.com', unit: '' },
  meetings: [], next: null, actionCounts: { overdue: 0, open: 0 }
});

(async () => {
  const browser = await chromium.launch({ executablePath: CH });

  async function open(role, view) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 1000 } });
    const page = await ctx.newPage();
    const posted = [];
    await page.route('**/logo-mark.png', r =>
      r.fulfill({ status: 200, contentType: 'image/png', body: fs.readFileSync(MARK) }));
    await page.route('**/exec*', async (route) => {
      const u = new URL(route.request().url());
      let body = {};
      try { body = JSON.parse(route.request().postData() || '{}'); } catch (e) {}
      const act = u.searchParams.get('action') || body.action || '';
      if (act === 'closeOff') posted.push(body);
      const out = act === 'home' ? HOME(role, DESK[role].me.name)
        : act === 'desk' ? Object.assign({ ok: true }, DESK[role])
        : act === 'closeOff' ? { ok: true, saved: true, replaced: false }
        : { ok: true };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(out) });
    });
    await page.addInitScript((t) => {
      try { sessionStorage.setItem('rrb-mm-door', '1');
            localStorage.setItem('rrb-meetings-token', t); } catch (e) {}
    }, DESK[role].token);
    await page.goto(PAGE);
    await page.waitForTimeout(700);
    if (view) {
      await page.evaluate((v) => go(v), view);
      await page.waitForTimeout(700);
    }
    return { page, ctx, posted };
  }

  /* ---------------- the masthead calls each role by its name ---------------- */
  for (const [role, want] of [['agent', 'Agent'], ['staff', 'Sales Support'],
                              ['unitmgr', 'Unit Manager'], ['manager', 'Branch Manager']]) {
    const { page, ctx } = await open(role, null);
    const got = (await page.textContent('#who-role') || '').trim();
    ok('the masthead calls ' + role + ' "' + want + '"', got === want, got);
    await ctx.close();
  }

  /* ---------------- My Day is the first tab, for everyone ---------------- */
  for (const role of ['agent', 'staff', 'unitmgr', 'manager']) {
    const { page, ctx } = await open(role, null);
    const first = (await page.textContent('#tabs .tab') || '').trim();
    ok(role + ' lands with My Day first', first === 'My Day', first);
    await ctx.close();
  }

  /* ---------------- an agent's own day ---------------- */
  {
    const { page, ctx } = await open('agent', 'day');
    const txt = await page.textContent('#view');
    ok('an agent sees their topic as a question', /Which case do you re-open first\?/.test(txt));
    ok('an agent is told why there are no blocks, not shown an empty list',
       /no blocks, no mail sweep/.test(txt));
    ok('an agent is offered the three questions', /What got done today\?/.test(txt));
    ok('and is told plainly they are not on the tracker',
       /not on the KPI tracker/.test(txt));
    ok('an agent is shown no blocks and no mail sweep',
       !/Morning mail/.test(txt) && !/Before you leave/.test(txt));
    /* THE ONE THAT MATTERS. */
    ok('no other advisor\'s name reaches an agent\'s browser',
       !/Hamid|Gita|Anand|Pawan/.test(txt), (txt.match(/Hamid|Gita|Anand|Pawan/) || [''])[0]);
    ok('no branch figure reaches an agent\'s browser',
       !/3,448,693|3,168,518|197 applications/.test(txt));
    ok('an agent has no Branch tab',
       !(await page.textContent('#tabs')).includes('The Branch'));
    await ctx.close();
  }

  /* ---------------- sales support ---------------- */
  {
    const { page, ctx, posted } = await open('staff', 'day');
    const txt = await page.textContent('#view');
    ok('sales support sees what came to their desk', /Came to you/.test(txt));
    ok('with the age of it in days', /640/.test(txt));
    /*  The state has to be a WORD as well as a colour — the branch's rule
     *  for every status anywhere. Read off the badge itself: textContent
     *  runs "In" straight into the "KPI 1" beneath it, so a regex over
     *  the whole view cannot see the word at all. */
    const states = await page.$$eval('.blk .badge', ns => ns.map(n => n.textContent.trim()));
    ok('their blocks are shown with a state in words',
       /Premium Dues/.test(txt) && states.indexOf('In') > -1, states.join('|'));
    ok('the Salesforce figure for the block is pulled in', /12/.test(txt));
    ok('and the page says the tracker is where a block is filed',
       /Read from the daily KPI tracker/.test(txt));
    /*  The differentiation, on the screen: a desk sees when they came in,
     *  the mail sweep, and the tracker's own before-you-leave list. */
    ok('a desk sees when they came in', /Came in/.test(txt) && /08:52/.test(txt));
    ok('and both mail sweeps', /Morning mail/.test(txt) && /08:25/.test(txt) &&
       /Afternoon mail/.test(txt) && /not swept/.test(txt));
    ok('and the tracker\'s before-you-leave list, with its evidence',
       /Before you leave/.test(txt) && /1 of 2 reported/.test(txt));
    ok('a desk is never asked the three questions as well',
       !/What got done today\?/.test(txt));
    ok('the close-out time is named', /15:45/.test(txt));
    await ctx.close();
  }

  /* ---- the three lines are the advisor's, and they post ---- */
  {
    const { page, ctx, posted } = await open('agent', 'day');
    await page.fill('#co-done', 'Two fact finds, one application in');
    await page.fill('#co-blocked', 'Waiting on a medical');
    await page.click('#co-go');
    await page.waitForTimeout(600);
    ok('an advisor closing off posts the three lines', posted.length === 1 &&
       posted[0].done === 'Two fact finds, one application in' &&
       posted[0].blocked === 'Waiting on a medical');
    ok('and says which device it came from', /phone|desk/.test(posted[0].device || ''));
    await ctx.close();
  }

  /* ---------------- a unit manager ---------------- */
  {
    const { page, ctx } = await open('unitmgr', 'day');
    const txt = await page.textContent('#view');
    ok('a unit manager gets his own day first', /Your day, Devi/.test(txt));
    ok('with his own arrival and close-out',
       /07:58/.test(txt) && /all 1 clear/.test(txt));
    ok('then his unit, person by person', /Your unit/.test(txt) && /Hamid Fictitious/.test(txt));
    ok('each with their topic', /What changed/.test(txt));
    ok('and who filed nothing', /Filed nothing this week/.test(txt));
    ok('a unit manager has no Branch tab',
       !(await page.textContent('#tabs')).includes('The Branch'));
    await ctx.close();
  }

  /* ---------------- the branch view ---------------- */
  {
    const { page, ctx } = await open('manager', 'branch');
    const txt = await page.textContent('#view');
    ok('the chair sees the findings', /The pipeline is holding the year/.test(txt));
    ok('severity is a word, not only a colour', /Act now/.test(txt));
    ok('every desk\'s day is on it', /Every desk today/.test(txt));
    ok('the chair\'s own day shows a five o\'clock start', /05:04/.test(txt) === false);
    ok('what people said was in the way is quoted', /Waiting on labs/.test(txt));
    ok('and who closed off nothing is named', /Pawan Imagined/.test(txt));
    ok('the sources say which is not reporting',
       /Not reporting/.test(txt) && /FACTFIND_GOAL_TOKEN/.test(txt));
    ok('the roles read as words', /unit manager/.test(txt) && !/unitmgr/.test(txt));
    await ctx.close();
  }

  /* ---------------- a phone ---------------- */
  {
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 } });
    const page = await ctx.newPage();
    await page.route('**/logo-mark.png', r =>
      r.fulfill({ status: 200, contentType: 'image/png', body: fs.readFileSync(MARK) }));
    await page.route('**/exec*', async (route) => {
      const u = new URL(route.request().url());
      let b = {}; try { b = JSON.parse(route.request().postData() || '{}'); } catch (e) {}
      const act = u.searchParams.get('action') || b.action || '';
      const out = act === 'home' ? HOME('staff', 'Gita Imaginary')
        : act === 'desk' ? Object.assign({ ok: true }, DESK.staff) : { ok: true };
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(out) });
    });
    await page.addInitScript(() => {
      try { sessionStorage.setItem('rrb-mm-door', '1');
            localStorage.setItem('rrb-meetings-token', 'T-S'); } catch (e) {}
    });
    await page.goto(PAGE);
    await page.waitForTimeout(700);
    await page.evaluate(() => go('day'));
    await page.waitForTimeout(700);
    const over = await page.evaluate(() =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok('nothing runs off a phone', over <= 1, over + 'px over');
    await ctx.close();
  }

  await browser.close();
  console.log('\n' + (fails ? fails + ' FAILED' : 'All checks passed'));
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
