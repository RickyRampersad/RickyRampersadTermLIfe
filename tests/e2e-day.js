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
           owed: 4, filed: 1, late: 2, blocks: [BLOCK('filed', 'Premium Dues', 12)] }]
};

const DESK = {
  agent: { token: 'T-A', me: { name: 'Rajiv Pretendo', role: 'agent', unit: 'Devi Invented' },
    items: [], numbers: [{ label: 'Fact finds this week', value: 4 }],
    day: { live: true, staffId: 'rajiv', blocks: [], none: 'No day blocks on file for Rajiv.' },
    topic: { topic: 'Recommended against written', question: 'Which case do you re-open first?',
             evidence: 'Conversion 7.5%.', source: 'Fact finds', rank: 90 },
    closedToday: false, sources: SRC },
  staff: { token: 'T-S', me: { name: 'Gita Imaginary', role: 'staff', unit: '' },
    items: [{ kind: 'stuck', what: 'A client — TPI10041', why: 'Postponed, TT$75,948 API',
              days: 640, source: 'Salesforce', day: '2026-10-16' }],
    numbers: [{ label: 'Open tasks', value: 107 }],
    day: BRANCH.days[0],
    topic: { topic: 'The applications on your desk', question: 'Which three clear this week?',
             evidence: '61 over 120 days.', source: 'Pipeline', rank: 95 },
    closedToday: false, sources: SRC, branch: BRANCH },
  unitmgr: { token: 'T-U', me: { name: 'Devi Invented', role: 'unitmgr', unit: 'Devi Invented' },
    items: [], numbers: [{ label: 'Fact finds waiting on you', value: 13 }],
    day: { live: true, staffId: 'devi', hours: '8am – 4:30pm', owed: 1, filed: 1, late: 0,
           blocks: [BLOCK('filed', 'Unit activity and pipeline', 3)] },
    topic: { topic: 'Your review queue', question: 'When are they cleared?',
             evidence: '13 waiting.', source: 'Fact finds', rank: 95 },
    closedToday: false, sources: SRC,
    unit: { name: 'Devi Invented',
            review: { pending: 13, medianDays: 1.4, returnRate: 10 }, days: [],
            people: [{ name: 'Hamid Fictitious', topic: 'What changed', evidence: '3 this year.' }],
            quiet: BRANCH.quiet } },
  manager: { token: 'T-M', me: { name: 'Anand Pretend', role: 'manager', unit: '' },
    items: [], numbers: [{ label: 'Open tasks', value: 35 }],
    day: { live: true, staffId: 'ricky', hours: '5am – 12am', owed: 1, filed: 0, late: 1,
           blocks: [BLOCK('late', 'Recruitment, licensing and staffing')] },
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
    ok('an agent with no blocks is told why, not shown an empty list',
       /No day blocks on file/.test(txt));
    ok('an agent is offered the three questions', /What got done today\?/.test(txt));
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
       /read from the daily KPI tracker/.test(txt));
    /* The close-off posts the three lines and nothing else. */
    await page.fill('#co-done', 'Cleared four pendings');
    await page.fill('#co-blocked', 'Three waiting on labs');
    await page.click('#co-go');
    await page.waitForTimeout(600);
    ok('closing off posts the three lines', posted.length === 1 &&
       posted[0].done === 'Cleared four pendings' &&
       posted[0].blocked === 'Three waiting on labs');
    ok('and says which device it came from', /phone|desk/.test(posted[0].device || ''));
    await ctx.close();
  }

  /* ---------------- a unit manager ---------------- */
  {
    const { page, ctx } = await open('unitmgr', 'day');
    const txt = await page.textContent('#view');
    ok('a unit manager gets his own day first', /Your day, Devi/.test(txt));
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
