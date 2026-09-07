// Your quarter, on the screen.
//
// What has to be true in the browser: the day view carries every goal with
// what the record says under it and how it stands against the target; the
// plan says which goals are behind before the blocks are chosen; the
// performance screen's goals carry the quarter's evidence without a review
// being open; a competency shows its signals and moments; noting a moment
// sends the competency and the line, and nothing else; and an older server
// that says nothing about standing breaks none of it.
//
// Run: node tests/e2e-standing.js   (needs playwright + a chromium on disk)
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const TYPES = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.png':'image/png', '.svg':'image/svg+xml' };
const PORT = Number(process.env.PORT) || 8803;

const server = http.createServer((req, res) => {
  let f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('no'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

const P = { staffId:'demo', name:'Demo Account', email:'demo@example.com', agentNumber:'D0', unit:'Support',
            grade:'Sales Support Assistant · G3', role:'ssa', tier:'support', tierLabel:'Sales Support', tierOrder:4, reportsTo:'boss', manager:false, leads:[] };
const SCH = { demo: { hours:'8am – 4pm', lunch:'12:30 – 1:30pm', blocks: { KPI1:{time:'8 – 10am', focus:'Premium Dues', kpi:'Renewa/PDl/Bill'}, KPI2:{time:'10 – 12pm', focus:'x'}, PM1:{time:'1 – 3pm', focus:'y'}, PM2:{time:'3 – 4pm', focus:'z'} } } };

const ev = (blocks, met, partly, no, closed) => ({ blocks, planned: blocks * 90, met: { met, partly, no }, lines: [], closed, open: 4, needs: 1, late: 0 });
const GOALS = [
  { goal:'Premium Dues / Lapse Management', description:'', targetType:'Increasing', weight:15, target:0.9, kpiTypes:['Renewa/PDl/Bill'], evidence: ev(27, 21, 5, 1, 401), landed: 0.78 },
  { goal:'Reporting', description:'', targetType:'Increasing', weight:10, target:0.9, kpiTypes:['Reporting'], evidence: ev(12, 12, 0, 0, 30), landed: 1 },
  { goal:'Campaigns / Projects', description:'', targetType:'Increasing', weight:5, target:0.9, kpiTypes:['Campaigns'], evidence: ev(0, 0, 0, 0, 0), landed: null } ];
const COMPS = [
  { competency:'Reliability', definition:'Can be counted on.', behaviours:['Is here', 'Delivers'],
    signals:[{ label:'Days in', value:44, tone:'' }, { label:'Not in', value:1, tone:'amber' }, { label:'After your start', value:0, tone:'green' }], lines:[], moments:[] },
  { competency:'Customer Service', definition:'Puts the client first.', behaviours:['Listens'],
    signals:[{ label:'Value-added lines', value:6, tone:'' }], lines:[{ date:'2026-08-14', text:'Walked a widow through the claim forms at her kitchen table' }],
    moments:[{ id:'m1', date:'2026-08-20', competency:'Customer Service', what:'Calmed a client who had been told three different things', by:'demo' }] },
  { competency:'Positive Energy', definition:'Lifts the room.', behaviours:['Smiles'], signals:[], lines:[], moments:[] } ];
const STANDING = { ok:true, staffId:'demo', role:'ssa', quarter:'2026-Q3', from:'2026-07-01', to:'2026-09-08', today:'2026-09-07',
                   daysIn:49, daysLeft:17, goals:GOALS, competencies:COMPS, salesforce:true, setup:{ goals:true, competencies:true }, side:'self',
                   training:{ covered:[{ date:'2026-08-12', topic:'AS400 screens', trainer:'Demo Lead', achieved:'', result:'Confident' }], taught:[],
                              planned:[{ activity:'Ingenium end to end', objective:'', dates:'Sept – Oct', facilitator:'' }], signedOff:1, planTotal:2,
                              actions:[{ action:'Run the dues list alone', source:'Experiential', why:'' }], actionsDone:0 }, jobDoc:true };
const HR = { ok:true, me:{ staffId:'demo', role:'ssa', goals: GOALS.map(g => ({ goal:g.goal, weight:g.weight, target:g.target, kpiTypes:g.kpiTypes })),
             competencies: COMPS.map(c => ({ competency:c.competency, definition:c.definition, behaviours:c.behaviours })), reviews:[], development:[], training:[] },
             reports:[], types:['Quarterly'], sources:['Experiential','Social','Formal'], setup:{ goals:true, competencies:true }, standard:0.72 };

let fails = 0;
const ok = (what, cond, extra) => { console.log((cond ? '  ok   ' : '  FAIL ') + what + (extra && !cond ? '  — ' + extra : '')); if (!cond) fails++; };

async function session(b, withStanding, noted) {
  const ctx = await b.newContext({ viewport:{ width:390, height:844 }, isMobile:true, hasTouch:true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.message)));
  await page.route('**/macros/s/**', async r => {
    const body = JSON.parse(r.request().postData() || '{}');
    const j = o => r.fulfill({ status:200, contentType:'application/json', body:JSON.stringify(o) });
    if (body.action === 'login' || body.action === 'me')
      return j({ ok:true, token:'t', profile: Object.assign({}, P, { attendance: { first:false, at:'08:02', lastSeen:'11:30', status:'in', reason:'', late:0 } }), roster:[P], schedule:SCH, kpis:{ ssa:[] } });
    if (body.action === 'rows') return j({ ok:true, rows:[], metrics:{ ok:false, reason:'notConfigured' }, attendance:{} });
    if (body.action === 'hr') return j(HR);
    if (body.action === 'standing') return j(withStanding ? STANDING : { ok:true });
    if (body.action === 'noteMoment') { noted.push(body); return j({ ok:true, id:'m2', date:'2026-09-07', competency: body.competency, what: body.what, by:'demo' }); }
    return j({ ok:true });
  });
  await page.clock.setFixedTime(new Date('2026-09-07T11:30:00'));
  await page.goto(`http://localhost:${PORT}/kpi/`, { waitUntil:'networkidle' });
  const i = await page.$$('input');
  await i[0].fill('demo@example.com'); await i[1].fill('1');
  await page.click('button:has-text("Sign in")');
  await page.waitForTimeout(2200);
  return { page, ctx, errors };
}

(async () => {
  server.listen(PORT);
  const b = await chromium.launch({ executablePath: CHROME });
  const noted = [];

  console.log('\nThe day view carries the quarter:\n');
  let s = await session(b, true, noted);
  let t = await s.page.locator('body').innerText();
  ok('it opens on the day', /Submit each block as it ends/.test(t), t.slice(0, 80));
  ok('with the quarter under the blocks', /Your quarter · 2026 Q3/i.test(t) && /49 days in · 17 left/.test(t));
  ok('every goal with what the record says', /27 blocks · 401 closed · 4 open, 1 untouched/.test(t), (t.match(/27 blocks[^\n]*/) || [''])[0]);
  ok('and how it stands against the target', /landed 78% · target 90%/.test(t) && /landed 100% · target 90%/.test(t));
  ok('a goal with no blocks says so', /no blocks yet/.test(t));
  ok('the competencies with how much sits behind each', /Customer Service · 1 moment/.test(t));
  ok('what they were trained on this quarter', /12 Aug — AS400 screens · with Demo Lead · Confident/.test(t), (t.match(/12 Aug[^\n]*/) || [''])[0]);
  ok('and what is still to cover, from the plan and the development actions', /Ingenium end to end · Sept – Oct/.test(t) && /Run the dues list alone · experiential/.test(t));
  ok('with the plan\'s count', /1 of 2 on the training plan signed off/.test(t));
  ok('and the door to the job document', await s.page.locator('button:has-text("Your job document")').count() === 1);
  ok('no javascript errors', s.errors.length === 0, s.errors.join(' | '));

  console.log('\nThe plan says what is behind:\n');
  await s.page.click('button:has-text("Plan the day")');
  await s.page.waitForTimeout(500);
  t = await s.page.locator('body').innerText();
  ok('behind on the one goal under target, by name and number', /behind on Premium Dues \/ Lapse Management \(78% of 90%\)/.test(t), (t.match(/Your quarter[^\n]*/) || [''])[0]);
  ok('and not on the one at 100%', !/behind on[^\n]*Reporting/.test(t));

  console.log('\nThe performance screen, without a review open:\n');
  await s.page.click('button:has-text("← Branch")');
  await s.page.waitForTimeout(400);
  await s.page.click('button:has-text("My performance")');
  await s.page.waitForTimeout(1500);
  t = await s.page.locator('body').innerText();
  ok('the goals say where you stand this quarter', /Where you stand this quarter — 2026 Q3, 49 working days in, 17 left/.test(t), (t.match(/Where you stand[^\n]*/) || [''])[0]);
  ok('with the evidence under each goal', /27 blocks worked/.test(t) && /21 met · 5 partly · 1 not yet/.test(t) && /401 closed in Salesforce/.test(t));
  await s.page.click('button:has-text("Competencies")');
  await s.page.waitForTimeout(400);
  t = await s.page.locator('body').innerText();
  ok('a competency shows what the record says', /Days in 44/.test(t) && /Not in 1/.test(t) && /After your start 0/.test(t));
  ok('its lines from the day log', /Walked a widow through the claim forms/.test(t));
  ok('and its moments', /20 Aug — Calmed a client who had been told three different things/.test(t));
  ok('one with nothing on record says so', /Nothing on record yet. Note a moment when this shows./.test(t));

  console.log('\nNoting a moment:\n');
  await s.page.click('button:has-text("Positive Energy")');
  await s.page.locator('input[placeholder="What happened, in a line"]').fill('Covered the front desk through lunch so nobody waited');
  await s.page.click('button:has-text("Note it")');
  await s.page.waitForTimeout(700);
  ok('one moment went out', noted.length === 1, String(noted.length));
  ok('with the competency and the line, and nothing else', noted[0] && noted[0].competency === 'Positive Energy' && /Covered the front desk/.test(noted[0].what) && noted[0].staffId === 'demo' && noted[0].rating === undefined, JSON.stringify(noted[0]));
  t = await s.page.locator('body').innerText();
  ok('and the screen says so', /Noted\./.test(t));
  ok('no javascript errors', s.errors.length === 0, s.errors.join(' | '));
  await s.ctx.close();

  console.log('\nAn older server that says nothing about standing:\n');
  s = await session(b, false, noted);
  t = await s.page.locator('body').innerText();
  // The strip still names "Your quarter" as a door; what must be absent is the card itself.
  ok('the day opens with no quarter card and no error', /Submit each block as it ends/.test(t) && !/Your quarter · /.test(t) && !/days in · /.test(t));
  await s.page.click('button:has-text("← Branch")');
  await s.page.waitForTimeout(400);
  await s.page.click('button:has-text("My performance")');
  await s.page.waitForTimeout(1200);
  t = await s.page.locator('body').innerText();
  ok('the goals list as before', /What you are measured on/.test(t) && /Premium Dues \/ Lapse Management/.test(t));
  ok('no javascript errors', s.errors.length === 0, s.errors.join(' | '));
  await s.ctx.close();

  const html = fs.readFileSync(path.join(ROOT, 'kpi/index.html'), 'utf8');
  ok('no colleague is named in the quarter code', !/sasha|kamla|elizabeth|azariah|pawan|kerwyn|akaash|ashley/i.test(html.slice(html.indexOf('function YourQuarter('), html.indexOf('function Evidence('))));

  await b.close(); server.close();
  console.log('\n' + (fails ? fails + ' FAILED' : 'all green') + '\n');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
