// The Recruit Tracker page talking to the Recruit Tracker backend.
//
// recruiting/app.js runs in a real browser; every request it makes is handed
// to apps-script/Recruiting.gs through doPost, exactly as a deployed web app
// would receive it. Nothing between them is written to match: if the two
// halves disagree about the contract, this is where it shows. The other tests
// check each half against something written alongside it, which cannot catch
// the two of them being wrong together.
//
// What this cannot do is run Google's own Sheets, Drive and quotas. The
// harness enforces the limits that are documented — grid width, cell size, the
// six-hour cache — but a deployed script can still meet something neither of
// us predicted. Deploy it and watch the first import.
//
// Fixtures are invented. Point RRB_SEED_DIR at the private seed folder to run
// the same walk against the real record.
const http = require('http'), fs = require('fs'), path = require('path');
const { makeEnv } = require('./harness');

let chromium;
try { ({ chromium } = require('playwright')); }
catch { console.log('playwright is not installed — skipped'); process.exit(0); }

const ROOT = path.join(__dirname, '..');
const EXE = process.env.CHROMIUM_PATH || '/opt/pw-browsers/chromium';
const API = 'https://script.google.com/macros/s/DEPLOYED/exec';
const SHOTS = process.env.SHOT_DIR || '';
const PORT = 8771;

let failed = 0, passed = 0;
const ok = (c, m) => { if (c) { passed++; console.log('  ok   ' + m); } else { failed++; console.log('  FAIL ' + m); } return c; };
const note = m => console.log('  note ' + m);
const sleep = ms => new Promise(r => setTimeout(r, ms));
const shot = async (page, name) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, name), fullPage: true }); } };

// ---- the workbook, with a roster and a couple of figures -------------------
// Salesforce answers with the newest recruit's real settled figures, which are
// already in board/dashboard.html: 3 apps, $89,303, nothing last year.
const SF_SETTLED = { THIS_YEAR: [{ a: 'Rajiv Soodoo', n: 3, api: 89303 }], THIS_MONTH: [], THIS_WEEK: [] };
const g = makeEnv({ gs: ROOT + '/apps-script/Recruiting.gs', strictGrid: true,
  properties: { ANTHROPIC_API_KEY: 'sk-ant-harness', SF_KEY: 'k', SF_SECRET: 's', SF_USER: 'u', SF_PASS: 'p' },
  fetchHandler: (url) => {
    if (/oauth2\/token/.test(url)) return { code: 200, body: JSON.stringify({ access_token: 't', instance_url: 'https://x.my.salesforce.com' }) };
    if (/salesforce\.com/.test(url)) {
      const q = decodeURIComponent(url.split('q=')[1] || '');
      if (/Policy_Increases__c/.test(q)) return { code: 200, body: JSON.stringify({ records: [] }) };
      const win = ['THIS_WEEK', 'THIS_MONTH', 'THIS_YEAR'].find(w => q.includes(w)) || 'THIS_YEAR';
      return { code: 200, body: JSON.stringify({ records: SF_SETTLED[win] || [] }) };
    }
    return { code: 200, body: JSON.stringify({ model: 'claude-opus-5', stop_reason: 'end_turn',
      usage: { input_tokens: 9, output_tokens: 18 }, content: [{ type: 'text', text: 'A coaching brief.' }] }) };
  } });
g.setup();
const acc = g.__sheets['Access'];
acc._grid.length = 1;
[['Ricky Rampersad', 'Branch Manager', 'bm1', '', 'Yes'],
 ['Gary Sookdeo', 'Unit Mgr', 'gary1', '', 'Yes'],
 ['Akaash Kalladeen', 'Unit Manager', 'ak1', '', 'Yes']].forEach(r => acc.appendRow(r));
g.__sheets['Cohort'].appendRow(['Recruit One', 2025, 'Gary Sookdeo', 51, 31, -11, 24, 37, 38, 40, 5, 'caution', 45, 'hired', 'contracted', 'A001', '2025-03-01', '', 'active', 'Marginal POP, on-track production.']);
g.__sheets['Cohort'].appendRow(['Recruit Two', 2024, 'Akaash Kalladeen', 18, 13, -16, -23, 61, 57, 70, 1, 'extreme_caution', 10, 'dropped', 'no_contract', '', '', '', 'never_contracted', 'The POP should have ended it.']);
g.__sheets['Production'].appendRow(['A001', 'Recruit One', 7, 22506, 0, 0, '', '']);
g.__sheets['ManagerPulse'].appendRow(['Gary Sookdeo', 7, 1, 4, 2, 1, '2026-01-13', 'One on One', 'Recruit One', 'Recruit One', 'Names the same agent weekly.']);

const PDF = Buffer.from('%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n').toString('base64');
const SEED = process.env.RRB_SEED_DIR;
const seedFiles = SEED ? [1, 2, 3].map(n => path.join(SEED, `felicia-seed-part${n}.json`)).filter(f => fs.existsSync(f)) : [];
let importFiles = seedFiles, expectDocs = 18, subject = 'Felicia Rampersad';
if (!seedFiles.length) {
  // An invented candidate in the shape the app exports, written to a temp file
  // so the page's own Import reads it the way it reads the real thing.
  const uploads = {};
  for (const k of ['3', '6.a', '12']) uploads[k] = { filename: `${k} doc.pdf`, sizeKB: 1, uploadedAt: '2026-09-01T00:00:00.000Z', base64: PDF, mediaType: 'application/pdf', uploadedBy: 'Test' };
  const rec = { id: 'cand_test', created: '2026-01-02T00:00:00.000Z', updated: '2026-09-01T00:00:00.000Z',
    meta: { name: 'Test Candidate', recruitingManager: 'Gary Sookdeo', currentStage: 'selectionFile', phone: '000-0000', email: 't@example.com' },
    stages: { firstInterview: { date: '2026-01-12', outcome: 'proceed', rmComments: 'Steady.' },
      pop7Review: { finalRating: 3, uploadedReport: { filename: 'POP.pdf', sizeKB: 1, base64: PDF, mediaType: 'application/pdf' } },
      selectionFile: { documentUploads: uploads, filePrepChecklist: { '3': true, '6.a': true, '12': true } },
      induction: { coachingNotes: 'Started well.' } } };
  const tmp = path.join(require('os').tmpdir(), 'rrb-e2e-seed.json');
  fs.writeFileSync(tmp, JSON.stringify({ exportedAt: new Date().toISOString(), candidates: [rec] }));
  importFiles = [tmp]; expectDocs = 4; subject = 'Test Candidate';
  note('using an invented candidate (set RRB_SEED_DIR for the real one)');
}

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.png': 'image/png', '.svg': 'image/svg+xml' };
const server = http.createServer((req, res) => {
  let p = decodeURIComponent(req.url.split('?')[0]);
  if (p.endsWith('/')) p += 'index.html';
  const f = path.join(ROOT, p);
  if (!f.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
  fs.readFile(f, (e, d) => { if (e) { res.writeHead(404); res.end(); return; }
    res.writeHead(200, { 'Content-Type': MIME[path.extname(f)] || 'application/octet-stream' }); res.end(d); });
});

const calls = [], errors = [], dialogs = [];

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const browser = await chromium.launch({ executablePath: EXE, args: ['--no-sandbox'] });
  const page = await browser.newPage({ viewport: { width: 1360, height: 900 } });
  page.on('pageerror', e => errors.push('pageerror: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 300)); });
  page.on('dialog', d => { dialogs.push(d.message()); d.accept(); });
  page.on('request', rq => { if (/api\.anthropic\.com/.test(rq.url())) errors.push('the page called Anthropic directly: ' + rq.url()); });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
  await page.route('**/recruiting/app.js', r => r.fulfill({ status: 200, contentType: 'text/javascript',
    body: fs.readFileSync(path.join(ROOT, 'recruiting', 'app.js'), 'utf8').replace('"PASTE_THE_WEB_APP_URL_HERE"', JSON.stringify(API)) }));
  // Every request the page makes goes through the real doPost.
  await page.route(u => u.href.startsWith(API), async route => {
    const body = route.request().postData() || '';
    let out;
    try { out = g.doPost({ postData: { contents: body } }).getContent(); }
    catch (e) { out = JSON.stringify({ ok: false, error: 'backend threw: ' + e.message }); errors.push('BACKEND THREW: ' + e.message); }
    let action = '?'; try { action = JSON.parse(body).action; } catch {}
    calls.push({ action, bytes: body.length });
    await route.fulfill({ status: 200, contentType: 'application/json', body: out });
  });

  console.log('\nsigning in');
  await page.goto(`http://localhost:${PORT}/recruiting/`);
  await page.waitForSelector('button:has-text("Sign in")', { timeout: 20000 });
  ok(await page.locator('.mark img[src$="logo-mark.png"]').count() >= 1, 'the sign-in screen carries the branch mark, not a drawn substitute');
  await page.fill('input[placeholder="Your name"]', 'Ricky Rampersad');
  await page.fill('input[placeholder="Password"]', 'wrong');
  await page.click('button:has-text("Sign in")');
  await page.waitForSelector('text=Wrong password.', { timeout: 15000 });
  ok(true, 'a wrong password is refused in the words the workbook chose');
  await page.fill('input[placeholder="Password"]', 'bm1');
  await page.click('button:has-text("Sign in")');
  await page.waitForSelector('button:has-text("Sign out")', { timeout: 20000 });
  ok(true, 'the right one signs in against the real Access tab');
  ok(await page.locator('span:has-text("Branch Manager")').first().isVisible(), 'and the header says which role the sheet gave back');
  await shot(page, '01-signed-in.png');

  console.log('\nthe figures the backend shaped');
  await page.locator('button:has-text("Trends")').first().click({ force: true });
  await sleep(1200);
  const trends = await page.locator('body').innerText();
  ok(trends.length > 2000, `Trends renders from server-supplied data (${trends.length} chars)`);
  ok(/Recruit One|Recruit Two/.test(trends), 'and shows the cohort rows that came out of the workbook');
  await shot(page, '02-trends.png');
  await page.locator('button:has-text("Pipeline")').first().click({ force: true });
  await sleep(500);

  console.log('\nimporting through the page');
  for (let i = 0; i < importFiles.length; i++) {
    const before = dialogs.length;
    await page.setInputFiles('input[accept="application/json"]', importFiles[i]);
    for (let n = 0; n < 900 && dialogs.length === before; n++) await sleep(100);
    ok(dialogs.length > before && /Import complete/.test(dialogs[dialogs.length - 1] || ''), `part ${i + 1} imported through the real backend`);
  }
  ok(g.__rows('Candidates').length === 1, `the workbook holds one candidate row (${g.__rows('Candidates').length})`);
  ok(g.__rows('Documents').length === expectDocs, `and ${expectDocs} Documents rows (${g.__rows('Documents').length})`);
  ok([...g.__drive.files.values()].filter(f => !f.trashed).length === expectDocs, 'with a file in Drive for each');
  const row = g.__rows('Candidates')[0];
  ok(!/"base64":"[A-Za-z0-9+/]{200,}/.test(JSON.stringify(row)), 'no base64 reached a spreadsheet cell');
  const biggest = Math.max(...Object.keys(row).filter(k => /^Json/.test(k)).map(k => String(row[k]).length));
  ok(biggest <= 45000, `the largest cell is ${biggest} characters, inside Google's 50,000 limit`);

  await page.reload();
  await page.waitForSelector(`text=${subject}`, { timeout: 20000 });
  ok(true, 'after a reload the candidate comes back from the workbook, not from the browser');

  console.log('\nthe candidate');
  await page.click(`text=${subject}`);
  await sleep(1000);
  for (const l of ['Interview', 'BM + POP', 'POP Review', 'Discovery', 'File', 'Approval', 'Onboard', 'Induction', 'File']) {
    const el = page.locator(`button:has-text("${l}")`).first();
    if (await el.count()) { await el.click({ force: true }).catch(() => {}); await sleep(300); }
  }
  ok(errors.length === 0, 'every one of the eight stages renders' + (errors.length ? ' — ' + errors[0].slice(0, 180) : ''));
  await shot(page, '03-file-stage.png');

  const beforeGet = calls.filter(c => c.action === 'docGet').length;
  const prev = page.locator('button:has-text("Preview")');
  if (await prev.count()) {
    await prev.first().click({ force: true });
    await sleep(1500);
    ok(calls.filter(c => c.action === 'docGet').length > beforeGet, 'Preview pulls the file back out of Drive through the backend');
    await shot(page, '04-preview.png');
    await page.keyboard.press('Escape').catch(() => {});
    await sleep(400);
    if (await page.locator('div.fixed.inset-0').count()) {
      const closer = page.locator('div.fixed.inset-0 button').last();
      if (await closer.count()) await closer.click({ force: true }).catch(() => {});
      await sleep(400);
    }
    ok((await page.locator('div.fixed.inset-0').count()) === 0, 'and the preview closes again');
  } else note('no Preview button on this stage');

  const ta = page.locator('textarea').first();
  if (await ta.count()) {
    const saves = calls.filter(c => c.action === 'save').length;
    await ta.click(); await ta.type(' An edit from the test.', { delay: 15 });
    await sleep(2800);
    ok(calls.filter(c => c.action === 'save').length === saves + 1, 'typing twenty characters produces one save, not twenty');
    ok(JSON.stringify(g.__rows('Candidates')[0]).includes('An edit from the test.'), 'and the words are in the spreadsheet cell');
  }

  const coach = page.locator('button:has-text("Ask AI coach")').first();
  if (await coach.count()) {
    await coach.click({ force: true });
    await page.waitForSelector('text=A coaching brief.', { timeout: 20000 })
      .then(() => ok(true, 'the coaching brief comes back through the backend proxy'))
      .catch(() => ok(false, 'the coaching brief comes back through the backend proxy'));
    // Salesforce is called too now, so pick the Anthropic one out rather than
    // assuming it is the only thing that went out.
    const ai = g.__fetches.filter(f => /api\.anthropic\.com/.test(f.url));
    ok(ai.length === 1 && JSON.parse(ai[0].params.payload).model === 'claude-opus-5', 'one call to Anthropic, on claude-opus-5');
    ok(ai[0].params.headers['x-api-key'] === 'sk-ant-harness', 'carrying the key from Script Properties, never from the page');
    ok(g.__fetches.some(f => /salesforce/.test(f.url)), 'and Salesforce was asked for the production figures');
    ok(g.__rows('AiLog')[0].Who === 'Ricky Rampersad', 'and the AiLog records who asked');
  }

  console.log('\nanother unit');
  await page.locator('button:has-text("Sign out")').click({ force: true });
  await page.waitForSelector('button:has-text("Sign in")', { timeout: 20000 });
  await page.fill('input[placeholder="Your name"]', 'Akaash Kalladeen');
  await page.fill('input[placeholder="Password"]', 'ak1');
  await page.click('button:has-text("Sign in")');
  await page.waitForSelector('button:has-text("Sign out")', { timeout: 20000 });
  await sleep(1200);
  const akText = await page.locator('body').innerText();
  ok(!akText.includes(subject), 'a Unit Manager from another unit is not shown the candidate');
  ok(!akText.includes('Recruit One'), 'nor another unit\'s cohort rows');
  ok(await page.locator('span:has-text("Unit Manager")').first().isVisible(), 'and is shown as a Unit Manager');
  await shot(page, '05-other-unit.png');

  await page.locator('button:has-text("Sign out")').click({ force: true });
  await page.waitForSelector('button:has-text("Sign in")', { timeout: 20000 });
  await page.fill('input[placeholder="Your name"]', 'Gary Sookdeo');
  await page.fill('input[placeholder="Password"]', 'gary1');
  await page.click('button:has-text("Sign in")');
  await page.waitForSelector(`text=${subject}`, { timeout: 20000 })
    .then(() => ok(true, 'the manager who recruits her does see her'))
    .catch(() => ok(false, 'the manager who recruits her does see her'));

  console.log('\nthe newest recruit, contracted and producing, with no agent number yet');
  {
    // addRecruit puts him in at the induction stage with the dates left blank.
    const id = g.addRecruit('Rajiv Soodoo', 'Gary Sookdeo', { stage: 'induction' });
    ok(!!id, 'addRecruit adds him with nothing invented');
    await page.reload();
    await page.waitForSelector('text=Rajiv Soodoo', { timeout: 20000 });
    ok(true, 'and he appears in the pipeline');
    await page.click('text=Rajiv Soodoo');
    await sleep(1200);
    const ind = page.locator('button:has-text("Induction")').first();
    if (await ind.count()) { await ind.click({ force: true }).catch(() => {}); await sleep(900); }
    const body = await page.locator('body').innerText();
    ok(/89,?303/.test(body),
       'his $89,303 reaches the induction screen through the name, with no agent number anywhere');
    ok(/Settled production from Salesforce/.test(body), 'and the panel says where the figure came from');
    // A recruit added this morning has no probation dates, so there is no pace
    // to be behind. Saying otherwise is a false alarm on the one screen meant
    // to tell a manager who genuinely needs intervention.
    ok(/Probation dates not set/.test(body), 'with no contract dates the screen asks for them');
    ok(!/Behind probation pace/.test(body), 'rather than calling him behind pace');
    ok(!/100%/.test(body.split('Coaching reports')[0]), 'and nothing claims 100% of a probation that has not started');
    ok(!/⚠|In-memory only/.test(body), 'and nothing on the screen is complaining');
    await shot(page, '06-newest-recruit.png');
  }

  ok(errors.length === 0, 'no console or page errors across the whole run' + (errors.length ? '\n       ' + errors.slice(0, 5).join('\n       ') : ''));
  ok(!g.__lockHeld(), 'the script lock is not left held');
  note(`${calls.length} requests went through the real doPost: ` +
    Object.entries(calls.reduce((a, c) => ((a[c.action] = (a[c.action] || 0) + 1), a), {})).map(([k, v]) => `${k}×${v}`).join(', '));
  note(`largest request body: ${(Math.max(...calls.map(c => c.bytes)) / 1048576).toFixed(2)} MB`);

  await browser.close(); server.close();
  console.log(`\n${failed ? 'FAILED' : 'OK'} — ${passed} passed, ${failed} failed`);
  process.exit(failed ? 1 : 0);
})().catch(e => {
  console.error('CRASH:', e && e.message);
  if (errors.length) console.error('errors:\n  ' + errors.join('\n  '));
  server.close();
  process.exit(2);
});
