// The agent's coach on My day (2 November 2026, 2026-10-29h), in a real browser, from the tracker's own model for Felicia
// (built by the harness from her real production by month and her goal plan): the note and one thing first, the check-in
// that asks about October before the plan, the plan filled in from her goal, present once saved, the midday check-in, the
// goal, fact finds, orphans, pendings and calls in Ricky's order; a manager's view that cannot save; 390px, light and dark.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..'), OUT = process.env.SHOTS || '';
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x && !c ? '  ' + x : '')); if (!c) fails++; };

// The model, as the tracker builds it.
const DAY = '2026-11-02';
const env = makeEnv(); env.todayISO_ = () => DAY;
const realDate = env.Date; let NOW = new realDate(DAY + 'T07:40:00');
env.Date = new Proxy(realDate, { construct(t, a) { return a.length ? new realDate(...a) : new realDate(NOW.getTime()); }, get(t, k) { return k === 'now' ? () => NOW.getTime() : t[k]; } });
env.__mkSheet('Access', 1, ['Name', 'StaffId', 'Email', 'Password', 'Role', 'Unit', 'Active'], [['Ricky Rampersad', 'ricky', 'ricky@example.com', '1', 'Branch Manager', 'Branch', 'Yes'], ['Kamla Dookran', 'kamla', 'kamla@example.com', '1', 'BMA', 'Branch', 'Yes']]);
env.__mkSheet('Agent Day', 1, env.AGDAY.head, []);
env.PropertiesService.getScriptProperties().setProperty('MANAGER_EMAIL', 'ricky@example.com');
env.mailSend_ = () => 'relay';
const F = { key: 'a-felicia-rampersad', name: 'Felicia Rampersad', agentName: 'Felicia Rampersad', agentId: 'A13710', code: 'A13710', email: 'felicia@example.com', manager: '' };
env.agentPeople_ = () => ({ [F.key]: F });
env.goalFor_ = () => ({ q: [0, 0, 0, 0], api: 600000, title: 'MDRT', contactsWk: 27, apptsWk: 7.5, ffWk: 7.5, appsWk: 2.5, weeksIn: 5, last: null });
env.ff360Feed_ = () => ({}); env.ff360Agent_ = () => ({ week: 0, month: 0, year: 8, pickedUp: 0, pipeline: 34000, known: true });
env.iLoadCache_ = () => null;
env.agentBook_ = () => ({ urgent: [{ client: 'Shivani Pancham', days: 1829 }, { client: 'Shivani Pancham', days: 367 }, { client: 'Alex John', days: 77 }, { client: 'Alex John', days: 77 }, {}, {}, {}, {}],
  slipped: [{ client: 'Jabraele Talleh' }, { client: 'Jabraele Talleh' }, { client: 'Jason Banmally' }, { client: 'Joshua Gowandan' }, {}], lapsed: [], chase: new Array(8).fill({}), pend: [], follow: [] });
env.bookRows_ = (k, tab) => (k === 'SKILL' && /Household/.test(tab)) ? [{ Household: 'H1', Token: 'T1', Client: 'Orphan client A', 'Agent assigned': 'Felicia Rampersad', 'Date assigned': '2026-10-19', Feedback: 'Spoke to her, booked appointment for Thursday' },
  { Household: 'H2', Token: 'T2', Client: 'Orphan client B', 'Agent assigned': 'Felicia Rampersad', 'Date assigned': '2026-10-26', Feedback: '' }]
  : (k === 'SKILL' && /Responses/.test(tab)) ? [{ Token: 'T2', Response: 'callme', Needs: 'a call this week', Status: 'Open', 'Assigned to': 'Felicia Rampersad', 'Assigned on': '2026-10-26' }] : [];
const PICK = [[2026, 9, 4, 16722.72], [2026, 5, 4, 21523.44], [2025, 11, 2, 11877.96], [2025, 12, 1, 18000], [2026, 7, 8, 36943.08], [2025, 10, 2, 9004.68], [2026, 2, 3, 5902.8], [2026, 6, 6, 44962.44], [2026, 3, 1, 2895.96], [2026, 1, 5, 18668.04], [2026, 8, 0, 2400]];
env.sfkQuery_ = q => /CLIENT_PORTFOLIO__c/.test(q) ? PICK.map(([y, m, apps, api]) => ({ ag: 'A13710', y, m, apps, api }))
  : /'Pendings'/.test(q) ? [{ Id: '00TUl00000plS8RMAU', Subject: 'UWPRO: FLORA  SARRAN 5004304211', Owner: { Name: 'Azariah Griffith' }, ActivityDate: '2026-11-03', CreatedDate: '2026-10-30T12:46:51.000+0000' }]
  : /Fact_Finding_Interviews__c/.test(q) ? [{ Date_of_Interview__c: '2026-03-24' }] : [];
env.cmdChatter_ = () => ({}); env.ffResponses_ = () => ({});
env.bigPut_('ag_items_' + F.key + '_' + DAY, [{ id: '00TUl00000pcoWIMAY', s: 'Orphan: Change in Beneficiary Request- Cathy Khalawan :1000669718 and 5003939965,', o: 'Elizabeth Lee', due: '2026-10-30', late: true },
  { id: '00TUl00000o5TZPMA2', s: 'Orphan response: what the policy has built; wrote to us - 1000775615 JESSICA RAMLAKHAN', o: 'Elizabeth Lee', due: DAY, late: false }]);
env.PropertiesService.getScriptProperties().setProperty('AGENT_COACH', 'live');
const link = { wd: F.key, k: env.workSig_(F.key) };
const morning = env.workdayGet_(link);
NOW = new realDate(DAY + 'T12:20:00');
const midday = env.workdayGet_(link);   // before any plan: the midday card is not shown yet

const server = http.createServer((q, r) => {
  let f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { r.writeHead(404); return r.end('no'); }
  r.writeHead(200, { 'Content-Type': f.endsWith('.html') ? 'text/html' : 'application/octet-stream' }); fs.createReadStream(f).pipe(r);
});
(async () => {
  await new Promise(r => server.listen(8829, r));
  const b = await chromium.launch();
  for (const scheme of ['light', 'dark']) {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme: scheme, deviceScaleFactor: 2 }); const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e)));
    let current = JSON.parse(JSON.stringify(morning)); const posts = [];
    await page.route(/script\.google\.com\/macros/, route => { const req = route.request(), reply = o => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
      if (req.method() !== 'POST') return reply(current);
      const p = Object.fromEntries(new URLSearchParams(req.postData())); posts.push(p);
      if (p.act === 'agplan') {
        if (!p.mreason) return reply({ ok: false, error: 'Pick what held October back first.' });
        NOW = new realDate(DAY + 'T07:42:00');
        const r2 = env.workdayPost_(Object.assign({}, p, link)); current = r2; return reply(r2);
      }
      if (p.act === 'agmid') { NOW = new realDate(DAY + 'T12:20:00'); const r3 = env.workdayPost_(Object.assign({}, p, link)); current = r3; return reply(r3); }
      return reply({ ok: false, error: 'no' }); });
    await page.goto('http://localhost:8829/myworkday/?p=' + F.key + '&k=KEY'); await page.waitForTimeout(1600);
    if (scheme === 'light') {
      console.log('\nThe first screen:\n');
      const order = await page.$$eval('#main > .card', els => els.map(e => e.id || e.className));
      ok('the note first, then the check-in, then the goal, fact finds, orphans, pendings, the branch, the calls', ['cxhero', 'agplan', 'cxgoal', 'cxfactfinds', 'cxorphans', 'cxpend', 'agitems', 'cxcalls'].every((id, i, all) => order.indexOf(id) > -1 && (i === 0 || order.indexOf(id) > order.indexOf(all[i - 1]))), JSON.stringify(order));
      ok('the note: her pipeline, her best month, the one thing first', /Your pipeline is ready to close/.test(await page.textContent('#cxhero')) && /June: \$45k on 6 apps/.test(await page.textContent('#cxhero')) && /First:/.test(await page.textContent('#cxhero')));
      ok('the goal: October $0 of $50.5k, November so far of $48.9k, her usual month', /October\$0 of \$50\.5k · 0 apps/.test((await page.textContent('#cxgoal')).replace(/\s+/g, '')) || /\$0 of \$50\.5k/.test(await page.textContent('#cxgoal')) && /\$48\.9k/.test(await page.textContent('#cxgoal')) && /usual month: \$15\.7k/.test(await page.textContent('#cxgoal')));
      ok('fact finds: 0 · 0 · 8, $34k pipeline, and the ask', /0 · 0 · 8/.test(await page.textContent('#cxfactfinds')) && /\$34k/.test(await page.textContent('#cxfactfinds')) && /No fact find in 223 days/.test(await page.textContent('#cxfactfinds')));
      ok('pendings: Flora Sarran, with Azariah', /FLORA/.test(await page.textContent('#cxpend')) && /Azariah has it/.test(await page.textContent('#cxpend')));
      ok('calls: the orphan client first, each a name to ring', /Orphan client B/.test(await page.textContent('#cxcalls')));
      if (OUT) await page.screenshot({ path: path.join(OUT, 'coach-1-morning.png'), fullPage: true });
      console.log('\nChecking in:\n');
      await page.click('#agplan [data-cxopen="plan"]'); await page.waitForTimeout(300);
      ok('October is asked first, then the plan', await page.isVisible('[data-cxrv="1"]') && /October closed/.test(await page.textContent('[data-cxrv]')));
      ok('the plan is filled in from her goal: 6 calls, 2 appointments, 2 fact finds', (await page.textContent('[data-cxp="calls"]')) === '6' && (await page.textContent('[data-cxp="appts"]')) === '2' && (await page.textContent('[data-cxp="ff"]')) === '2');
      if (OUT) await page.screenshot({ path: path.join(OUT, 'coach-2-checkin.png'), fullPage: true });
      await page.click('[data-cxsave="plan"]'); await page.waitForTimeout(200);
      ok('without October\'s reason it is caught on the screen', /held last month back/.test(await page.textContent('#agplan [data-st]')) && !posts.length);
      await page.click('[data-cxr="appts"]'); await page.click('[data-cxp="calls"] + button'); await page.click('[data-cxsave="plan"]'); await page.waitForTimeout(800);
      const pp = posts.find(p => p.act === 'agplan');
      ok('saved with the reason and the numbers (7 calls after one tap)', pp && pp.mreason === 'appts' && pp.m_calls === '7' && pp.m_appts === '2', JSON.stringify(pp));
      ok('present, with the time', /Present · checked in 7:42am/.test(await page.textContent('#agplan')));
      ok('October shows what she said', /You said: No appointments/.test(await page.textContent('#cxgoal')));
      if (OUT) await page.screenshot({ path: path.join(OUT, 'coach-3-present.png') });
      console.log('\nMidday:\n');
      NOW = new realDate(DAY + 'T12:20:00'); current = env.workdayGet_(link); await page.reload(); await page.waitForTimeout(1500);
      ok('the midday check-in is there after the plan', await page.isVisible('#agmid'));
      await page.click('#agmid [data-cxd="calls"] + button'); await page.click('#agmid [data-cxd="calls"] + button'); await page.click('[data-cxmood="On track"]'); await page.click('[data-cxsave="mid"]'); await page.waitForTimeout(800);
      ok('saved: 2 of the plan done so far, on track', /2 of \d+/.test(await page.textContent('#agmid')) && /On track/.test(await page.textContent('#agmid')), await page.textContent('#agmid'));
      if (OUT) await page.screenshot({ path: path.join(OUT, 'coach-4-midday.png') });
      const ow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
      ok('nothing off the side at 390', ow <= 0, String(ow));
    } else {
      if (OUT) await page.screenshot({ path: path.join(OUT, 'coach-5-dark.png'), fullPage: true });
      ok('dark: draws with no errors', !errs.length, errs.join(' | '));
    }
    ok(scheme + ': no page errors', !errs.length, errs.join(' | '));
    await ctx.close();
  }
  console.log('\nA manager\'s view:\n');
  const view = env.workdayGet_({ wd: 'ricky', k: env.workSig_('ricky'), as: F.key });
  const c3 = await b.newContext({ viewport: { width: 390, height: 844 } }); const p3 = await c3.newPage(); const posted = [];
  await p3.route(/script\.google\.com\/macros/, route => { if (route.request().method() === 'POST') posted.push(1); route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(view) }); });
  await p3.goto('http://localhost:8829/myworkday/?p=ricky&k=KEY&as=' + F.key); await p3.waitForTimeout(1400);
  ok('he sees her day, with what he should know', /You are seeing Felicia's day/.test(await p3.textContent('.agpv')) && /3\.2× last year/.test(await p3.textContent('.agpv')));
  await p3.click('#agplan [data-cxopen="plan"]'); await p3.click('[data-cxsave="plan"]'); await p3.waitForTimeout(300);
  ok('and cannot save it for her', !posted.length);
  if (OUT) await p3.screenshot({ path: path.join(OUT, 'coach-6-manager.png') });
  await c3.close(); await b.close(); server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall green');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
