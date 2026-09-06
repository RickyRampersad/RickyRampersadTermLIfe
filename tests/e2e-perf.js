// The performance screen: the form, the evidence, the two halves.
//
// A support desk signs in and opens "My performance". What has to be true:
// the ten goals show with their weights and targets; opening a review shows
// the evidence under each goal and the overall rating computed the way the
// form computes it (this stub carries the real numbers from a signed one);
// the person's own half is editable and the People Leader's half is not;
// and a colleague's name never appears, because the stub is a demo account.
//
// Run: node tests/e2e-perf.js   (needs playwright + a chromium on disk)
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const TYPES = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.png':'image/png', '.svg':'image/svg+xml' };
const PORT = Number(process.env.PORT) || 8792;
const SHOT = process.env.PERF_SHOT || '';

const server = http.createServer((req, res) => {
  let f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('no'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

const P = { staffId:'demo', name:'Demo Account', email:'demo@example.com', agentNumber:'D0',
            unit:'Support', grade:'Sales Support Assistant · G3', role:'ssa',
            tier:'support', tierLabel:'Sales Support', tierOrder:4, reportsTo:'lead', manager:false };
const SCH = { demo: { hours:'8am – 4pm', lunch:'12:30 – 1:30pm',
  blocks: { KPI1:{time:'8 – 10am', focus:'Premium Dues', kpi:'Renewa/PDl/Bill'}, KPI2:{time:'10 – 12pm', focus:'x'},
            PM1:{time:'1 – 3pm', focus:'y'}, PM2:{time:'3 – 4pm', focus:'z'} } } };

const GW = [15,10,10,15,10,5,10,10,5,10];
const NAMES = ['New Applications & Increase Applications Processing','Group Applications / Group Changes / Dependent Enrollments',
  'Policy Contract and Scripts / Clawback Management','Premium Dues / Lapse Management','Reinstatements / Alterations Processing',
  'Existing Individual Health and Group Plans Management','Mail / Transmittal Management','Administrative Support',
  'Campaigns / Projects','Reporting'];
const PL = [3,2,4,4,3,3,4,3,3,4], SELF = [4,2,4,4,3,3,4,3,3,4];
const goals = NAMES.map((n, i) => ({ goal:n, description:'', targetType:'Increasing', weight:GW[i], target:0.9,
  kpiTypes:['Renewa/PDl/Bill'], actual: i === 3 ? '96' : '', selfRating:String(SELF[i]), selfNote: i === 3 ? 'Dues out on time every week' : '',
  plRating:String(PL[i]), plNote: i === 3 ? 'Consistent and on time' : '',
  evidence:{ blocks: i === 3 ? 27 : 2, planned: i === 3 ? 2430 : 120, met:{met: i === 3 ? 21 : 1, partly: i === 3 ? 5 : 1, no: i === 3 ? 1 : 0},
             lines:[{date:'2026-05-11', text:'Premium dues — 14 processed, 2 back to the advisor'}],
             closed: i === 3 ? 401 : 12, open: 11, needs: 1, late: 0 } }));
const COMPS = ['Courtesy & Interpersonal Skills','Customer Service','Growth','Innovation','Positive Energy','Quality','Reliability','Responsiveness']
  .map((c, i) => ({ competency:c, definition:'Definition of ' + c, behaviours:['Behaviour one','Behaviour two'],
                    selfRating:'4', selfNote:'', plRating:String([4,4,3,2,4,3,4,3][i]), plNote:'' }));
const SCORES = { self:{ goalScore:0.875, compScore:1, opr:0.9, goalsRated:10, goalsTotal:10, compsRated:8, compsTotal:8, weightsSum:100, meetsStandard:true },
                 pl:{ goalScore:0.8375, compScore:0.84375, opr:0.83875, goalsRated:10, goalsTotal:10, compsRated:8, compsTotal:8, weightsSum:100, meetsStandard:true },
                 standard:0.72 };
const REVIEW = { id:'demo-2026-04-13-mid-probation', staffId:'demo', type:'Mid Probation', from:'2026-04-13', to:'2026-06-13', status:'open', selfSigned:'', plSigned:'' };
const HR = { ok:true, me:{ staffId:'demo', role:'ssa', goals: goals.map(g => ({ goal:g.goal, description:g.description, targetType:g.targetType, weight:g.weight, target:g.target, kpiTypes:g.kpiTypes })),
             competencies: COMPS.map(c => ({ competency:c.competency, definition:c.definition, behaviours:c.behaviours })),
             reviews:[REVIEW], development:[{ id:'d1', reviewId:REVIEW.id, source:'Social', action:'Fortnightly coaching with the People Leader',
               why:'Group business is not yet independent', success:'One group application end to end without help', status:'planned' }],
             training:[{ order:1, activity:'AS400 / Ingenium', objective:'All screens', facilitator:'People Leader', dates:'May – June 2026', venue:'Branch', evidence:'', evaluation:'', signedOff:'' }] },
             reports:[], types:['Mid Probation','End of Probation','Quarterly','Mid Year','End of Year','End of Contract'],
             sources:['Experiential','Social','Formal'], setup:{ goals:true, competencies:true }, standard:0.72 };
const RV = { ok:true, review:REVIEW, role:'ssa', side:'self', selfComment:'', plComment:'A good two months', goals, competencies:COMPS,
             development:HR.me.development, training:HR.me.training, scores:SCORES, days:38, salesforce:true, types:HR.types, sources:HR.sources };

let fails = 0;
const ok = (what, cond, extra) => { console.log((cond ? '  ok   ' : '  FAIL ') + what + (extra && !cond ? '  — ' + extra : '')); if (!cond) fails++; };

(async () => {
  server.listen(PORT);
  const b = await chromium.launch({ executablePath: CHROME });
  const ctx = await b.newContext({ viewport:{ width:390, height:844 }, deviceScaleFactor: SHOT ? 2 : 1, isMobile:true, hasTouch:true });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.message)));
  const saved = [];
  await page.route('**/macros/s/**', async r => {
    const body = JSON.parse(r.request().postData() || '{}');
    const j = o => r.fulfill({ status:200, contentType:'application/json', body:JSON.stringify(o) });
    if (body.action === 'login' || body.action === 'me') return j({ ok:true, token:'t', profile:P, roster:[P], schedule:SCH, kpis:{ ssa:[] } });
    if (body.action === 'rows') return j({ ok:true, rows:[], metrics:{ ok:false, reason:'notConfigured' } });
    if (body.action === 'hr') return j(HR);
    if (body.action === 'review') return j(RV);
    if (body.action === 'saveRating') { saved.push(body); return j({ ok:true, side:'self' }); }
    return j({ ok:true });
  });
  await page.clock.setFixedTime(new Date('2026-09-07T11:30:00'));
  await page.goto(`http://localhost:${PORT}/kpi/`, { waitUntil:'networkidle' });
  const i = await page.$$('input');
  await i[0].fill('demo@example.com'); await i[1].fill('1');
  await page.click('button:has-text("Sign in")');
  await page.waitForTimeout(2200);

  console.log('\nThe door:\n');
  // After ten, signing in lands on the day. The door is on the home screen.
  await page.click('button:has-text("Branch")');
  await page.waitForTimeout(600);
  ok('the home screen offers My performance', await page.locator('button:has-text("My performance")').count() === 1);
  await page.click('button:has-text("My performance")');
  await page.waitForTimeout(1200);
  let t = await page.locator('body').innerText();
  ok('it opens on the goals', /Your performance/.test(t) && /What you are measured on/.test(t), t.slice(0, 120));
  ok('ten goals with their weights', (t.match(/\b(15|10|5)%/g) || []).length >= 10);
  ok('and a target', /target 90%/.test(t));

  console.log('\nOpening a review:\n');
  await page.click('button:has-text("Reviews")');
  await page.waitForTimeout(400);
  t = await page.locator('body').innerText();
  ok('the review is listed', /Mid Probation/.test(t) && /13 Apr/.test(t));
  await page.locator('button:has-text("Open")').first().click();
  await page.waitForTimeout(900);
  await page.click('button:has-text("Goals")');
  await page.waitForTimeout(400);
  t = await page.locator('body').innerText();
  ok('the overall rating is the form\'s: 83.9% of record', /83\.9%/.test(t), (t.match(/\d+\.\d%/g) || []).join(' '));
  ok('and the self assessment 90%', /90%/.test(t));
  ok('with the standard named', /standard of 72%/.test(t));
  ok('and how the number is made', /× 80/.test(t) && /× 20/.test(t));
  ok('the evidence sits under the goal', /27 blocks worked/.test(t) && /401 closed in Salesforce/.test(t));
  ok('with a line of what was actioned', /14 processed/.test(t));
  ok('the person\'s half is theirs to write', /Self assessment\s+· yours/i.test(t));
  ok('the People Leader\'s half is read-only, and shown', /Consistent and on time/.test(t));
  ok('the People Leader\'s rating shows in words', /3 · Meets most/.test(t));

  if (SHOT) {
    await page.locator('text=Premium Dues / Lapse Management').first().scrollIntoViewIfNeeded();
    await page.waitForTimeout(300);
    await page.screenshot({ path: SHOT, fullPage: false });
  }

  console.log('\nSaving a rating sends only the person\'s half:\n');
  const card = page.locator('div', { hasText: /^Reporting/ }).last();
  const five = page.locator('button:has-text("5")').last();
  await five.click();
  await page.waitForTimeout(200);
  const save = page.locator('button:has-text("Save")').last();
  await save.click();
  await page.waitForTimeout(600);
  ok('one save went out', saved.length === 1, String(saved.length));
  ok('for a goal, with the rating picked', saved[0] && saved[0].kind === 'goal' && saved[0].rating === '5', JSON.stringify(saved[0]));
  ok('and it never carries the other half', saved[0] && saved[0].plRating === undefined);

  console.log('\nThe other tabs:\n');
  await page.click('button:has-text("Competencies")');
  await page.waitForTimeout(300);
  t = await page.locator('body').innerText();
  ok('eight competencies with their behaviours', /Responsiveness/.test(t) && /Behaviour one/.test(t));
  await page.click('button:has-text("Development")');
  await page.waitForTimeout(300);
  t = await page.locator('body').innerText();
  ok('the 70-20-10 action, with why and success', /Social · 20%/.test(t) && /Why:/.test(t) && /Success looks like:/.test(t));
  ok('the person can mark it done, not write one', /Mark done/.test(t) && !/Add an action/.test(t));
  await page.click('button:has-text("Training plan")');
  await page.waitForTimeout(300);
  t = await page.locator('body').innerText();
  ok('the training plan row', /AS400/.test(t) && /Open/.test(t));

  ok('no javascript errors', errors.length === 0, errors.join(' | '));
  const html = fs.readFileSync(path.join(ROOT, 'kpi/index.html'), 'utf8');
  ok('no colleague is named in the screen\'s code', !/sasha|kamla|elizabeth|azariah|pawan|kerwyn|akaash/i.test(html.slice(html.indexOf('function Half('), html.indexOf('function KpiPicker('))));

  await b.close(); server.close();
  console.log('\n' + (fails ? fails + ' FAILED' : 'all green') + '\n');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
