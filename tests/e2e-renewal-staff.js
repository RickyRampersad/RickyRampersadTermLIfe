// The renewals staff dashboard (apps-script/Staff.html) in a real browser,
// against a fake google.script.run that answers in the shapes Code.gs builds
// (staffData, staffAction, productionData, productionWorkbook). Made-up names
// and figures only. It signs in, reads the first screen (the pipeline as a
// stacked bar, renewals by month as columns, tiles that count up and filter),
// works every action (assign, open a file, mark renewed, resend invite, task,
// comment, query, answer, add renewal, property stage, invite, rate review,
// production, download, audit filters) and checks that nothing runs wider than
// a phone, that every chart carries its values in text, and that nothing is
// invisible with reduced motion.
// Run: node tests/e2e-renewal-staff.js [screenshot-dir]
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const SHOTS = process.argv[2] || process.env.SHOTS || '';
const CHROME = ['/opt/pw-browsers/chromium', '/opt/pw-browsers/chromium-1194/chrome-linux/chrome'].find(p => { try { return fs.statSync(p).isFile(); } catch (e) { return false; } });

let fails = 0, passes = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (c) passes++; else fails++; };

/* ---------- made-up data, in the shape staffData returns ---------- */
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const fmt = d => String(d.getDate()).padStart(2, '0') + ' ' + MON[d.getMonth()] + ' ' + d.getFullYear();
const inDays = n => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + n); return d; };
const NAMES = ['Anika Pretend', 'Bertrand Madeup', 'Celeste Sample', 'Dexter Example', 'Elena Fictional', 'Farouk Testcase', 'Gita Invented',
  'Hollis Notreal', 'Imani Placeholder', 'Jarvis Dummy', 'Kiran Mockup', 'Lena Specimen', 'Marlon Fakename', 'Nadia Pretendo', 'Omar Sampleton',
  'Priya Imaginary', 'Quentin Notaperson', 'Rhea Madeupson', 'Sanjay Figment', 'Tamara Hypothetical', 'Ulric Standin', 'Vashti Proxy'];
const STAFF = [
  { email: 'sasha@example.com', name: 'Sasha Testing', role: 'staff', pin: '' },
  { email: 'liz@example.com', name: 'Liz Sample', role: 'staff', pin: '' },
  { email: 'boss@example.com', name: 'Ricky Manager', role: 'manager', pin: '' }];
function data(me) {
  const days = [-12, -3, 2, 5, 9, 13, 20, 27, 45, 70, 110, 160, null, -1, 4, 30, 60, 85, 3, 8, 200, 240];
  const renewals = NAMES.map((n, i) => {
    const d = days[i];
    const due = d === null ? '' : fmt(inDays(d));
    let renewalStatus = '', renewedDate = '';
    if (i === 3 || i === 14) renewalStatus = 'RENEW AS IS — ' + fmt(inDays(-2));
    if (i === 7 || i === 9) { renewalStatus = 'RENEWED — ' + fmt(inDays(-1)); renewedDate = fmt(inDays(-1)); }
    return { rowIndex: i + 2, client: n, contact: n, coverage: i % 3 === 0 ? 'Comprehensive' : (i % 3 === 1 ? 'Third Party' : 'Third Party Fire & Theft'),
      nextDue: due, days: d, sumInsured: i % 3 === 0 ? 85000 + i * 1000 : '', premium: 2400 + i * 137, paid: 0, balance: i % 5 === 0 ? 350 : 0,
      payStatus: i % 5 === 0 ? 'Part paid' : 'Paid', policy: 'TTMV' + String(1000 + i).padStart(8, '0'), mobile: i % 4 === 0 ? '868-555-01' + String(10 + i) : '',
      email: n.split(' ')[0].toLowerCase() + '@example.com', renewalStatus, remindersSent: i % 2 === 0 ? 'stage1@' + fmt(inDays(-20)) : '',
      renewedDate, assignedTo: i % 3 === 0 ? 'sasha@example.com' : (i % 3 === 1 ? 'liz@example.com' : ''), agent: '', agentEmail: '', token: 'tok' + i };
  });
  const lastTouch = { tok0: { when: fmt(inDays(-1)), by: 'sasha@example.com', type: 'comment' }, tok2: { when: fmt(inDays(-9)), by: 'liz@example.com', type: 'invite-sent' } };
  const feed = Array.from({ length: 26 }, (_, i) => ({ when: fmt(inDays(-i)), client: NAMES[i % NAMES.length],
    type: ['comment', 'invite-sent', 'assigned', 'query', 'login', 'renewed', 'client-instruction', 'task-created'][i % 8],
    by: i % 2 ? 'liz@example.com' : 'sasha@example.com', details: 'Made-up detail number ' + i + ' for the test trail' }));
  const tasks = [
    { id: 'T1', created: fmt(inDays(-5)), due: fmt(inDays(-1)), dueDays: -1, assignee: me, client: NAMES[0], token: 'tok0', title: 'Call about the updated vehicle value', status: 'Open', createdBy: 'liz@example.com', completed: '', completedBy: '' },
    { id: 'T2', created: fmt(inDays(-2)), due: fmt(inDays(3)), dueDays: 3, assignee: 'liz@example.com', client: NAMES[2], token: 'tok2', title: 'Chase the signed value letter', status: 'Open', createdBy: me, completed: '', completedBy: '' },
    { id: 'T3', created: fmt(inDays(-9)), due: '', dueDays: null, assignee: '', client: '', token: '', title: 'Tidy the reminders list', status: 'Open', createdBy: me, completed: '', completedBy: '' },
    { id: 'T4', created: fmt(inDays(-9)), due: '', dueDays: null, assignee: me, client: NAMES[5], token: 'tok5', title: 'An old done task', status: 'Done', createdBy: me, completed: fmt(inDays(-3)), completedBy: me }];
  const queries = [
    { id: 'Q1', created: fmt(inDays(-1)), token: 'tok1', client: NAMES[1], by: 'liz@example.com', of: me, question: 'Client called twice: what is the status?', status: 'Open', answer: '', answered: '', answeredBy: '' },
    { id: 'Q2', created: fmt(inDays(-4)), token: 'tok3', client: NAMES[3], by: me, of: 'liz@example.com', question: 'Terms overdue from Guardian?', status: 'Answered', answer: 'Chased today, due Friday', answered: fmt(inDays(-3)), answeredBy: 'liz@example.com' }];
  const surveys = { count: 6, avgSat: 4.3, avgEase: 4.5, avgSpeed: 3.8, recent: [
    { when: fmt(inDays(-2)), client: NAMES[7], sat: 5, ease: 5, comments: 'Quick and clear, thank you' },
    { when: fmt(inDays(-6)), client: NAMES[9], sat: 3, ease: 4, comments: '' }] };
  const vehicles = { tok0: [{ reg: 'PDX 0001', make: 'Toyota', model: 'Aqua', year: '2019', chassis: 'CH0000TEST', engine: 'EN0000TEST', cover: 'Comprehensive', ncd: '30', value: 85000, years: '4', address: '1 Pretend Street, Couva', comp: true }] };
  const properties = [
    { token: 'pt1', client: 'Pretend Hardware Ltd', policy: 'TTFP00000001', renewalDate: fmt(inDays(10)), days: 10, stage: 'crms', stageUpdated: fmt(inDays(-4)), email: 'office@example.com', mobile: '868-555-0199', assignedTo: 'sasha@example.com', status: 'Invitation sent', locations: 2, premium: 14200, rate: 1.85, premiumHistory: [{ year: 2023, amount: 12100 }, { year: 2024, amount: 13050 }, { year: 2025, amount: 14200 }], years: 6 },
    { token: 'pt2', client: 'Sample Bakery', policy: '', renewalDate: fmt(inDays(-4)), days: -4, stage: '', stageUpdated: '', email: 'bake@example.com', mobile: '', assignedTo: '', status: '', locations: 1, premium: 5300 },
    { token: 'pt3', client: 'Madeup Estates', policy: 'TTFP00000003', renewalDate: fmt(inDays(40)), days: 40, stage: 'issued', stageUpdated: fmt(inDays(-1)), email: 'est@example.com', mobile: '', assignedTo: 'liz@example.com', status: '', locations: 3, premium: 22800 }];
  const propStages = [
    { key: 'instructed', label: 'Instruction received', blurb: 'We have your instructions and your file is open.' },
    { key: 'crms', label: 'With Guardian CRMS', blurb: 'Your renewal is with the insurer for terms.' },
    { key: 'terms', label: 'Terms received', blurb: 'Renewal terms are in: we are checking them for you.' },
    { key: 'accepted', label: 'Accepted & payment', blurb: 'Terms agreed; payment being arranged.' },
    { key: 'issued', label: 'Schedule issued', blurb: 'Your policy schedule and documents are issued.' }];
  const meRow = STAFF.find(s => s.email === me) || STAFF[0];
  return { me: { email: meRow.email, name: meRow.name, role: meRow.role }, staff: STAFF, renewals, tasks, lastTouch, feed, surveys, queries, vehicles, properties, propStages, portalBase: 'https://script.google.com/macros/s/FAKE/exec' };
}
const PRODDATA = { ok: true, asOf: fmt(new Date()), by: 'Ricky Manager', role: 'manager', marks: { appsW: 2, apiW: 9000, appsM: 5, apiM: 30000, appsY: 30, apiY: 200000 },
  total: { appsW: 5, apiW: 18000.5, appsM: 14, apiM: 61000, appsY: 80, apiY: 410000 },
  rows: [
    { code: 'B1', name: 'Ricky Rampersad Branch', level: 'branch', depth: 0, appsW: 5, apiW: 18000.5, appsM: 14, apiM: 61000, appsY: 80, apiY: 410000 },
    { code: 'U1', name: 'Unit Pretend', level: 'unit', depth: 1, appsW: 3, apiW: 11000, appsM: 9, apiM: 40000, appsY: 50, apiY: 260000 },
    { code: 'A001', name: 'Agent Madeup', level: 'agent', depth: 2, appsW: 2, apiW: 9000, appsM: 6, apiM: 32000, appsY: 31, apiY: 210000 },
    { code: 'A002', name: 'Agent Sample', level: 'agent', depth: 2, appsW: 1, apiW: 2000, appsM: 3, apiM: 8000, appsY: 19, apiY: 50000 },
    { code: 'A003', name: 'Agent Example', level: 'agent', depth: 1, appsW: 2, apiW: 7000.5, appsM: 5, apiM: 21000, appsY: 30, apiY: 150000 }] };

/* ---------- the page, as HtmlService would serve it ---------- */
const theme = fs.readFileSync(path.join(ROOT, 'apps-script/RenewalTheme.html'), 'utf8');
function build(boot) {
  return fs.readFileSync(path.join(ROOT, 'apps-script/Staff.html'), 'utf8')
    .replace('<?!= rrTheme_() ?>', () => theme)
    .replace('<?!= JSON.stringify(payload) ?>', () => JSON.stringify(JSON.stringify(boot)));
}
const FAKE = `
window.__calls = []; window.__fail = null;
(function(){
  function runner(){
    var ok=null, bad=null, uo;
    var api = { withSuccessHandler:function(f){ok=f;return api;}, withFailureHandler:function(f){bad=f;return api;}, withUserObject:function(u){uo=u;return api;} };
    ['staffData','staffAction','productionData','productionWorkbook'].forEach(function(fn){
      api[fn]=function(){ var args=[].slice.call(arguments); window.__calls.push({fn:fn,args:args});
        setTimeout(function(){
          if(window.__fail===fn){ bad && bad({message:'Wrong access code: use the code beside your name on the Staff tab.'}); return; }
          var out = window.__answer(fn,args);
          ok && ok(out, uo);
        }, 30); };
    });
    return api;
  }
  window.google = { script: {} };
  Object.defineProperty(window.google.script, 'run', { get: runner });
})();`;

const PNG = fs.readFileSync(path.join(ROOT, 'orphan-transition/board-mark.png'));
let PAGE = '';
const server = http.createServer((req, res) => {
  if (req.url.startsWith('/staff')) { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' }); return res.end(PAGE); }
  res.writeHead(404); res.end('no');
});

async function newPage(browser, vp, opts = {}) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: opts.dsf || 1, reducedMotion: opts.reduce ? 'reduce' : 'no-preference', acceptDownloads: true });
  await ctx.route('https://rickyrampersadbranch.com/**', r => r.fulfill({ status: 200, contentType: 'image/png', body: PNG }));
  await ctx.addInitScript(FAKE);
  await ctx.addInitScript(`window.__answer=function(fn,args){
    if(fn==='staffData'||fn==='staffAction') return window.__D;
    if(fn==='productionData') return ${JSON.stringify(PRODDATA)};
    if(fn==='productionWorkbook') return {xml:'<Workbook/>',filename:'Production.xls'};
  };`);
  const page = await ctx.newPage();
  page.__errors = [];
  page.on('pageerror', e => page.__errors.push(e.message));
  page.on('dialog', d => d.dismiss());
  return page;
}
async function signIn(page, base, me) {
  await page.addInitScript(d => { window.__D = d; }, data(me));
  await page.goto(base + '/staff');
  await page.waitForSelector('#lEmail');
  await page.fill('#lEmail', me);
  await page.fill('#lPin', '1234');
  await page.click('#lGo');
  await page.waitForSelector('.rrow[data-row]');
  await page.waitForTimeout(250);
}
const calls = page => page.evaluate(() => window.__calls);
const lastCall = async page => { const c = await calls(page); return c[c.length - 1]; };
async function noSideScroll(page) {
  return page.evaluate(() => { window.scrollTo(500, window.scrollY); const x = window.scrollX; window.scrollTo(0, window.scrollY); return x === 0 && document.documentElement.scrollWidth <= window.innerWidth + 1; });
}
async function shot(page, name) { if (!SHOTS) return; fs.mkdirSync(SHOTS, { recursive: true }); await page.waitForTimeout(900);
  await page.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); } window.scrollTo(0, 0); });
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(SHOTS, name), fullPage: true }); }

(async () => {
  PAGE = build({ ok: true, key: 'k'.repeat(24), why: '' });
  await new Promise(r => server.listen(0, r));
  const base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch(CHROME ? { executablePath: CHROME } : {});

  /* ---- an invalid link says so and offers nothing ---- */
  {
    PAGE = build({ ok: false, key: '', why: 'This dashboard has no staff key set.' });
    const page = await newPage(browser, { width: 390, height: 844 });
    await page.goto(base + '/staff'); await page.waitForTimeout(200);
    ok('invalid link: says why', /no staff key set/.test(await page.textContent('#app')));
    ok('invalid link: no sign-in form', !(await page.$('#lEmail')));
    await page.context().close();
    PAGE = build({ ok: true, key: 'k'.repeat(24), why: '' });
  }

  /* ---- a refused code comes back to the sign-in with the reason ---- */
  {
    const page = await newPage(browser, { width: 390, height: 844 });
    await page.addInitScript(d => { window.__D = d; window.__fail = 'staffData'; }, data('sasha@example.com'));
    await page.goto(base + '/staff'); await page.waitForSelector('#lEmail');
    ok('sign-in: the blue shield in the top bar', await page.$eval('.rr-top .mark img', i => /board-mark\.png$/.test(i.src)));
    ok('sign-in: no gold, no Google Fonts', !/fonts\.googleapis|#efc24b|#07131f/i.test(PAGE));
    ok('sign-in: no emoji in the page', !/[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}\u{2B50}\u{FF0B}]/u.test(PAGE.replace(/<\?!= rrTheme_\(\) \?>/, '')));
    await page.fill('#lEmail', 'Sasha@Example.com'); await page.fill('#lPin', '9');
    await page.click('#lGo'); await page.waitForSelector('#lErr:not(:empty)');
    ok('sign-in: a refusal shows its reason', /Wrong access code/.test(await page.textContent('#lErr')));
    const c = (await calls(page)).find(x => x.fn === 'staffData');
    ok('sign-in: staffData(key, me, true, pin)', c && c.args[0] === 'k'.repeat(24) && c.args[1] === 'sasha@example.com' && c.args[2] === true && c.args[3] === '9', JSON.stringify(c && c.args));
    await shot(page, 'phone-signin.png');
    await page.context().close();
  }

  /* ---- a phone: the first screen, the charts, the list, every action ---- */
  for (const vp of [{ width: 360, height: 740 }, { width: 390, height: 844 }]) {
    const page = await newPage(browser, vp, { dsf: 2 });
    await signIn(page, base, 'sasha@example.com');
    const tag = vp.width + 'px: ';
    ok(tag + 'no sideways scroll on the first screen', await noSideScroll(page));
    const h1 = await page.textContent('.st-hero h1');
    ok(tag + 'the first screen says what needs doing', /need/.test(h1), h1);
    ok(tag + 'the band has its waves', !!(await page.$('.st-hero .rr-band .waves')));
    // the pipeline stack: every part's count is in the text
    const keys = await page.$$eval('.pk', bs => bs.map(b => b.textContent.trim()));
    ok(tag + 'the pipeline stack carries its counts', keys.length === 7 && keys.every(k => /\d+$/.test(k)), keys.join(' | '));
    ok(tag + 'the stacked bar is drawn', (await page.$$('.st-stack i')).length >= 4);
    const months = await page.$$eval('.mch .mc', bs => bs.map(b => b.getAttribute('aria-label')));
    ok(tag + 'renewals by month: 12 columns, each with its count', months.length === 12 && months.every(m => /\d+ renewal/.test(m)));
    // tiles count up and the true figure is in the text
    const tiles = await page.$$eval('.st-tiles .rr-tile', ts => ts.map(t => t.textContent.replace(/\s+/g, ' ').trim()));
    ok(tag + '8 tiles, each with its figure', tiles.length === 8 && tiles.every(t => /\d/.test(t)), tiles.join(' | '));
    // rows: status as a word, days to renewal, actions in reach
    const row0 = await page.$eval('.rrow[data-row]', r => r.textContent.replace(/\s+/g, ' '));
    ok(tag + 'a row carries a status word and the days', /(Client instructed|Overdue|Due in)/.test(row0) && /(overdue|in \d+ day|Due today)/.test(row0), row0.slice(0, 120));
    const rowsW = await page.$$eval('.rrow', rs => rs.every(r => r.getBoundingClientRect().right <= innerWidth + 1));
    ok(tag + 'every row fits the screen', rowsW);
    const small = await page.$$eval('.rrow .asg, .rrow .rr-btn, .rrow .ic-btn, .rr-tile, .rr-tabs button', es => es.filter(e => e.getBoundingClientRect().height < 40).map(e => e.className));
    ok(tag + 'tap targets are 40px or more', small.length === 0, small.join(','));
    if (vp.width === 390) {
      await shot(page, 'phone-390-pipeline.png');
      // a tile filters the list
      await page.click('.st-tiles .rr-tile[data-f="overdue"]');
      const st = await page.$$eval('.rrow[data-row] .c-st', cs => cs.map(c => c.textContent.trim()));
      ok('tile: Overdue filters the list to overdue files', st.length > 0 && st.every(s => /Overdue/.test(s)), st.join(','));
      ok('tile: the tapped tile is marked on', await page.$eval('.st-tiles .rr-tile[data-f="overdue"]', t => t.classList.contains('on') && t.getAttribute('aria-pressed') === 'true'));
      // a part of the stack filters too
      await page.click('.pk[data-f="renewed"]');
      const st2 = await page.$$eval('.rrow[data-row] .c-st', cs => cs.map(c => c.textContent.trim()));
      ok('stack key: Renewed filters to renewed files', st2.length === 2 && st2.every(s => s === 'Renewed'), st2.join(','));
      await page.click('.rr-opts [data-f="all"]');
      ok('All shows every renewal', (await page.$$('.rrow[data-row]')).length === 22);
      // a month column filters, and again clears
      const anyMonth = await page.$eval('.mch .mc b:not(:empty)', b => b.closest('.mc').dataset.m);
      await page.click(`.mch .mc[data-m="${anyMonth}"]`);
      const dues = await page.$$eval('.rrow[data-row] .c-due b', bs => bs.map(b => b.textContent));
      ok('month column filters to that month', dues.length > 0 && dues.every(d => d.includes(anyMonth)), anyMonth + ': ' + dues.join(','));
      await page.click(`.mch .mc[data-m="${anyMonth}"]`);
      ok('the same month again clears it', (await page.$$('.rrow[data-row]')).length === 22);
      // this month and next: the two months, every renewal in them, each opens its file
      {
        const now = new Date(), a = [now.getFullYear(), now.getMonth()], b = new Date(now.getFullYear(), now.getMonth() + 1, 1);
        const inMon = (d, y, m) => d !== null && inDays(d).getFullYear() === y && inDays(d).getMonth() === m;
        const D0 = data('sasha@example.com');
        const want = [[a[0], a[1]], [b.getFullYear(), b.getMonth()]].map(([y, m]) =>
          D0.renewals.filter(r => inMon(r.days, y, m)).length + D0.properties.filter(p => inMon(p.days, y, m)).length);
        const cols = await page.$$eval('#mmCard .mm-col', cs => cs.map(c => ({ n: c.querySelectorAll('.mm-r').length, more: (c.querySelector('[data-mmall]') || {}).textContent || '', h: c.querySelector('.mm-h').textContent })));
        ok('this month and next: two months', cols.length === 2 && /This month/.test(cols[0].h) && /Next month/.test(cols[1].h), cols.map(c => c.h).join(' | '));
        const got = cols.map(c => { const m = c.more.match(/all (\d+)/); return m ? Number(m[1]) : c.n; });
        ok('this month and next: every renewal in each month is there', got[0] === want[0] && got[1] === want[1], got.join(',') + ' want ' + want.join(','));
        const first = await page.$('#mmCard [data-mmrow]');
        if (first) {
          await first.click(); await page.waitForSelector('#dr.open');
          ok('this month and next: a row opens the file', true);
          await page.keyboard.press('Escape'); await page.waitForTimeout(150);
        } else ok('this month and next: a motor row to open', false);
      }
      // search, with the cursor kept in the box
      await page.fill('#q', 'celeste');
      ok('search narrows the list', (await page.$$('.rrow[data-row]')).length === 1);
      ok('search keeps the focus', await page.evaluate(() => document.activeElement && document.activeElement.id === 'q'));
      await page.click('#fClear');
      // selects
      await page.selectOption('#fWho', 'unassigned');
      const asg = await page.$$eval('.rrow[data-row] .rasg', ss => ss.map(s => s.value));
      ok('Who: Unassigned filters', asg.length > 0 && asg.every(v => v === ''));
      await page.selectOption('#fWho', '');
      await page.selectOption('#fCov', 'Third Party');
      ok('Cover filter: property list empties for a motor cover', /No property file matches/.test(await page.textContent('#propCard')));
      await page.click('#fClear');
      // assign from the row, without opening the file
      await page.selectOption('.rrow[data-row="4"] .rasg', 'liz@example.com');
      await page.waitForTimeout(100);
      let c = await lastCall(page);
      ok('row assign: staffAction assign', c.fn === 'staffAction' && c.args[2] === 'assign' && c.args[3].rowIndex === 4 && c.args[3].assignee === 'liz@example.com' && c.args[3].token === 'tok2' && c.args[4] === '1234', JSON.stringify(c.args));
      ok('row assign: the drawer did not open', !(await page.$eval('#dr', d => d.classList.contains('open'))));
      // open a file
      await page.click('.rrow[data-row="2"] .c-who');
      await page.waitForSelector('#dr.open #dRenewed');
      await page.waitForTimeout(350);
      ok('drawer: fits the phone', await page.$eval('#dr', d => d.getBoundingClientRect().width <= innerWidth + 1 && d.getBoundingClientRect().left >= -1));
      ok('drawer: the journey strip and the ring', !!(await page.$('#dr .rr-steps li')) && !!(await page.$('#dr .rr-ring')));
      ok('drawer: vehicles on record', /PDX 0001/.test(await page.textContent('#dr')));
      ok('drawer: the history with the trail', (await page.$$('#dr .rr-tl li')).length > 0);
      await shot(page, 'phone-390-drawer.png');
      await page.fill('#dCom', 'Spoke to the made-up client'); await page.click('#dComAdd'); await page.waitForTimeout(100);
      c = await lastCall(page);
      ok('drawer: comment', c.args[2] === 'comment' && c.args[3].text === 'Spoke to the made-up client' && c.args[3].token === 'tok0');
      ok('drawer: closes after a comment', !(await page.$eval('#dr', d => d.classList.contains('open'))));
      await page.click('.rrow[data-row="2"]'); await page.waitForSelector('#dr.open #dTaskT');
      await page.fill('#dTaskT', 'Call the made-up client'); await page.selectOption('#dTaskA', 'liz@example.com'); await page.fill('#dTaskD', '2026-11-02');
      await page.click('#dTaskAdd'); await page.waitForTimeout(100);
      c = await lastCall(page);
      ok('drawer: add task', c.args[2] === 'addTask' && c.args[3].title === 'Call the made-up client' && c.args[3].assignee === 'liz@example.com' && c.args[3].due === '2026-11-02' && c.args[3].token === 'tok0');
      await page.click('.rrow[data-row="2"]'); await page.waitForSelector('#dr.open #dAskT');
      await page.selectOption('#dAskWho', 'boss@example.com'); await page.fill('#dAskT', 'Please advise'); await page.click('#dAskGo'); await page.waitForTimeout(100);
      c = await lastCall(page);
      ok('drawer: raise a query', c.args[2] === 'ask' && c.args[3].assignee === 'boss@example.com' && c.args[3].text === 'Please advise');
      await page.click('.rrow[data-row="2"]'); await page.waitForSelector('#dr.open #dInvite');
      await page.click('#dInvite'); await page.waitForTimeout(100);
      c = await lastCall(page);
      ok('drawer: resend invite', c.args[2] === 'resendInvite' && c.args[3].rowIndex === 2);
      ok('drawer: stays open after an invite (as before)', await page.$eval('#dr', d => d.classList.contains('open')));
      await page.keyboard.press('Escape');
      await page.click('.rrow[data-row="2"]'); await page.waitForSelector('#dr.open #dAssign');
      await page.selectOption('#dAssign', 'boss@example.com'); await page.waitForTimeout(100);
      c = await lastCall(page);
      ok('drawer: assign', c.args[2] === 'assign' && c.args[3].assignee === 'boss@example.com' && c.args[3].rowIndex === 2);
      await page.keyboard.press('Escape');
      await page.click('.rrow[data-row="2"]'); await page.waitForSelector('#dr.open [data-ddone]');
      await page.click('#dr [data-ddone="T1"]'); await page.waitForTimeout(100);
      c = await lastCall(page);
      ok('drawer: complete a task', c.args[2] === 'completeTask' && c.args[3].id === 'T1');
      await page.click('.rrow[data-row="2"]'); await page.waitForSelector('#dr.open #dRenewed');
      await page.click('#dRenewed'); await page.waitForTimeout(100);
      c = await lastCall(page);
      ok('drawer: mark renewed', c.args[2] === 'markRenewed' && c.args[3].rowIndex === 2 && c.args[3].token === 'tok0' && c.args[3].client === 'Anika Pretend');
      await page.waitForSelector('.rr-toast');
      ok('a toast says it was done', (await page.$$eval('.rr-toast', ts => ts.map(t => t.textContent))).some(t => /Marked renewed/.test(t)));
      // Escape and the overlay close the drawer
      await page.click('.rrow[data-row="2"]'); await page.waitForSelector('#dr.open');
      await page.keyboard.press('Escape');
      ok('Escape closes the drawer', !(await page.$eval('#dr', d => d.classList.contains('open'))));
      // the query waiting on me
      await page.fill('#qa_Q1', 'Called back today');
      await page.click('[data-qans="Q1"]'); await page.waitForTimeout(100);
      c = await lastCall(page);
      ok('answer a query', c.args[2] === 'answer' && c.args[3].id === 'Q1' && c.args[3].answer === 'Called back today');
      // add a renewal
      await page.click('#addBtn'); await page.waitForSelector('#modal.open #aClient');
      ok('add renewal: the sheet fits the phone', await page.$eval('#mw', m => m.getBoundingClientRect().right <= innerWidth + 1));
      await shot(page, 'phone-390-add.png');
      await page.click('#aGo');
      ok('add renewal: refuses without client and date', await page.$eval('#modal', m => m.classList.contains('open')));
      await page.fill('#aClient', 'Wendell Newpretend'); await page.fill('#aDue', '2026-12-01'); await page.selectOption('#aCov', 'Comprehensive');
      await page.fill('#aPrem', '3100'); await page.fill('#aEmail', 'w@example.com'); await page.fill('#aMob', '868-555-0000'); await page.fill('#aPol', 'TTMV1'); await page.fill('#aSum', '90000'); await page.fill('#aContact', 'Wendell');
      await page.click('#aGo'); await page.waitForTimeout(100);
      c = await lastCall(page);
      ok('add renewal: staffAction addRenewal with every field', c.args[2] === 'addRenewal' && c.args[3].client === 'Wendell Newpretend' && c.args[3].nextDue === '2026-12-01' && c.args[3].coverage === 'Comprehensive' && c.args[3].premium === '3100' && c.args[3].sumInsured === '90000' && c.args[3].policy === 'TTMV1' && c.args[3].email === 'w@example.com' && c.args[3].mobile === '868-555-0000' && c.args[3].contact === 'Wendell' && c.args[3].assignee === 'sasha@example.com', JSON.stringify(c.args[3]));
      // property
      await page.click('#kProp'); await page.waitForTimeout(300);
      await page.click('.rrow[data-prop="pt1"]'); await page.waitForSelector('#dr.open #pInvite');
      ok('property drawer: the premium by year as columns, values in text', /12,100/.test(await page.textContent('#dr .rr-cols')) && (await page.$$('#dr .rr-cols .c')).length === 3);
      ok('property drawer: the journey with the next stage to advance', !!(await page.$('#dr [data-adv="terms"]')));
      await shot(page, 'phone-390-property.png');
      await page.fill('#pNote', 'Terms in'); await page.click('[data-adv="terms"]'); await page.waitForTimeout(100);
      c = await lastCall(page);
      ok('property: advance stage', c.args[2] === 'propStage' && c.args[3].token === 'pt1' && c.args[3].stage === 'terms' && c.args[3].note === 'Terms in');
      await page.click('.rrow[data-prop="pt1"]'); await page.waitForSelector('#dr.open #pRate');
      await page.click('#pRate'); await page.waitForTimeout(100);
      ok('property: rate review', (await lastCall(page)).args[2] === 'propRateReview');
      await page.click('.rrow[data-prop="pt1"]'); await page.waitForSelector('#dr.open #pInvite');
      await page.click('#pInvite'); await page.waitForTimeout(100);
      ok('property: invite', (await lastCall(page)).args[2] === 'propInvite');
      await page.click('.rrow[data-prop="pt1"]'); await page.waitForSelector('#dr.open #pAskGo');
      await page.fill('#pAskT', 'Chase terms'); await page.click('#pAskGo'); await page.waitForTimeout(100);
      c = await lastCall(page);
      ok('property: query', c.args[2] === 'ask' && c.args[3].token === 'pt1' && c.args[3].text === 'Chase terms');
      await page.click('.rrow[data-prop="pt1"]'); await page.waitForSelector('#dr.open #pAssign');
      await page.selectOption('#pAssign', 'liz@example.com'); await page.waitForTimeout(100);
      c = await lastCall(page);
      ok('property: assign in the drawer', c.args[2] === 'propAssign' && c.args[3].assignee === 'liz@example.com');
      await page.keyboard.press('Escape');
      await page.selectOption('.rrow[data-prop="pt2"] .prasg', 'sasha@example.com'); await page.waitForTimeout(100);
      c = await lastCall(page);
      ok('property: assign from the row', c.args[2] === 'propAssign' && c.args[3].token === 'pt2' && c.args[3].assignee === 'sasha@example.com');
      // the tasks tab on a phone
      await page.click('#taskBtn'); await page.waitForTimeout(250);
      ok('Tasks tab: the open tasks and the trail', (await page.$$('#viewArea [data-done]')).length === 3 && (await page.$$('#viewArea .rr-tl li')).length > 0);
      const tabTop = await page.evaluate(() => { window.scrollTo(0, 2600); const t = document.querySelector('.rr-tabs').getBoundingClientRect(); return [scrollY, t.top, document.documentElement.scrollHeight]; });
      ok('Tasks tab: tabs stay on screen when scrolled', tabTop[1] >= 0 && tabTop[1] < 80, JSON.stringify(tabTop));
      await shot(page, 'phone-390-tasks.png');
      await page.click('#viewArea [data-done="T2"]'); await page.waitForTimeout(100);
      ok('Tasks tab: done', (await lastCall(page)).args[3].id === 'T2');
      // reports
      await page.click('#repBtn'); await page.waitForTimeout(250);
      ok('reports: no sideways scroll', await noSideScroll(page));
      const funnel = await page.$$eval('.fs', fs => fs.map(f => f.textContent.replace(/\s+/g, ' ').trim()));
      ok('reports: the funnel with its counts', funnel.length === 3 && funnel.every(f => /\d/.test(f)), funnel.join(' | '));
      ok('reports: money in text', /TT\$[\d,]+/.test(await page.textContent('#viewArea')));
      ok('reports: client score rings', (await page.$$('#viewArea .rings .rr-ring')).length === 3);
      await shot(page, 'phone-390-reports.png');
      await page.click('[data-who="liz@example.com"]'); await page.waitForTimeout(200);
      const asg2 = await page.$$eval('.rrow[data-row] .rasg', ss => ss.map(s => s.value));
      ok('reports: a name opens their files', asg2.length > 0 && asg2.every(v => v === 'liz@example.com'));
      // audit
      await page.click('#fClear').catch(() => {});
      await page.click('#audBtn'); await page.waitForTimeout(250);
      ok('audit: rows', (await page.$$('#viewArea .rr-table tbody tr')).length === 26);
      await page.selectOption('#audBy', 'liz@example.com');
      ok('audit: by person', (await page.$$('#viewArea .rr-table tbody tr')).length === 13);
      await page.fill('#audQ', 'number 1');
      ok('audit: search keeps the focus', await page.evaluate(() => document.activeElement && document.activeElement.id === 'audQ'));
      ok('audit: no sideways scroll', await noSideScroll(page));
      await shot(page, 'phone-390-audit.png');
      // the switch link signs out
      await page.click('#lo');
      ok('Switch: back to the sign-in, the code forgotten', !!(await page.$('#lEmail')) && await page.evaluate(() => !localStorage.getItem('gg_staff_pin')));
    } else {
      await shot(page, 'phone-360-pipeline.png');
      await page.click('#repBtn'); await page.waitForTimeout(250);
      ok(tag + 'reports: no sideways scroll', await noSideScroll(page));
      await page.click('#audBtn'); await page.waitForTimeout(250);
      ok(tag + 'audit: no sideways scroll', await noSideScroll(page));
    }
    ok(tag + 'no page errors', page.__errors.length === 0, page.__errors.join(' / '));
    await page.context().close();
  }

  /* ---- a laptop, as the branch manager: production and the download ---- */
  {
    const page = await newPage(browser, { width: 1366, height: 900 });
    await signIn(page, base, 'boss@example.com');
    ok('desktop: no sideways scroll', await noSideScroll(page));
    ok('desktop: the tasks and the trail beside the list', await page.$eval('.side-pipe', s => getComputedStyle(s).display !== 'none' && s.getBoundingClientRect().left > 700));
    ok('desktop: the tiles in one row', await page.$$eval('.st-tiles .rr-tile', ts => new Set(ts.map(t => t.offsetTop)).size === 1));
    ok('desktop: the list has its column heads', await page.$eval('.rhead', h => getComputedStyle(h).display !== 'none'));
    await page.waitForTimeout(900);
  await page.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 500) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); } window.scrollTo(0, 0); });
  await page.waitForTimeout(500);
    const v = await page.$eval('.st-tiles .rr-tile[data-f="instructed"] .cu', b => getComputedStyle(b).getPropertyValue('--n').trim());
    ok('desktop: the counter lands on the true figure', v === '2', v);
    await shot(page, 'desktop-pipeline.png');
    await page.click('.rrow[data-row="2"]'); await page.waitForSelector('#dr.open'); await page.waitForTimeout(400);
    await shot(page, 'desktop-drawer.png');
    await page.keyboard.press('Escape');
    ok('desktop: Production tab for a manager', !!(await page.$('#prodBtn')));
    await page.click('#prodBtn'); await page.waitForSelector('.ptable'); await page.waitForTimeout(300);
    ok('production: productionData(key, me, pin)', (await calls(page)).some(c => c.fn === 'productionData' && c.args[1] === 'boss@example.com' && c.args[2] === '1234'));
    ok('production: head office table with its total', /Total/.test(await page.textContent('.ptable tfoot')) && (await page.$$('.ptable tbody tr')).length === 5);
    ok('production: standouts shaded', (await page.$$('.ptable td.hot')).length > 0);
    ok('production: API by agent as bars, values in text', /\$32,000/.test(await page.textContent('#viewArea .rr-bars')));
    await shot(page, 'desktop-production.png');
    const dl = page.waitForEvent('download', { timeout: 3000 }).catch(() => null);
    await page.click('#prodDl');
    const d = await dl;
    ok('production: download the workbook', d && d.suggestedFilename() === 'Production.xls');
    await page.click('#repBtn'); await page.waitForTimeout(400);
    await shot(page, 'desktop-reports.png');
    await page.click('#viewArea .mch .mc[data-m="' + MON[new Date().getMonth()] + '"]'); await page.waitForTimeout(150);
    ok('reports: a month column opens that month in the pipeline', await page.$eval('#pipeBtn', b => b.getAttribute('aria-selected') === 'true') && await page.$eval('#fMon', (s, m) => s.value === m, MON[new Date().getMonth()]));
    await page.click('#audBtn'); await page.waitForTimeout(300);
    await shot(page, 'desktop-audit.png');
    ok('desktop: no page errors', page.__errors.length === 0, page.__errors.join(' / '));
    await page.context().close();
  }
  /* staff (not a manager) has no production tab */
  {
    const page = await newPage(browser, { width: 1366, height: 900 });
    await signIn(page, base, 'liz@example.com');
    ok('staff: no Production tab', !(await page.$('#prodBtn')));
    await page.context().close();
  }

  /* ---- reduced motion: nothing invisible, nothing moving ---- */
  {
    const page = await newPage(browser, { width: 390, height: 844 }, { reduce: true });
    await signIn(page, base, 'sasha@example.com');
    const hidden = await page.$$eval('.rr-tile, .rrow, .rr-card, .st-stack i, .mch .mc .st i, .rr-sec .ic', es => es.filter(e => { const s = getComputedStyle(e); return +s.opacity < 0.99 || s.visibility === 'hidden'; }).length);
    ok('reduced motion: everything visible', hidden === 0, String(hidden));
    const moving = await page.evaluate(() => document.getAnimations().filter(a => a.playState === 'running').length);
    ok('reduced motion: nothing animating', moving === 0, String(moving));
    const v = await page.$eval('.st-tiles .rr-tile[data-f="instructed"] .cu', b => getComputedStyle(b).getPropertyValue('--n').trim());
    ok('reduced motion: counters show the true figure at once', v === '2', v);
    await page.click('.rrow[data-row="2"]'); await page.waitForTimeout(50);
    ok('reduced motion: the drawer opens', await page.$eval('#dr', d => getComputedStyle(d).visibility === 'visible' && d.getBoundingClientRect().left < 5));
    await page.context().close();
  }

  await browser.close(); server.close();
  console.log(`\n${passes} passed, ${fails} failed`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
