// The English B essay workshop, at /englishb/, driven in a browser against the REAL
// apps-script/EssayWorkshop.gs: every request the page makes is handed to the script running
// here under the fake Sheets, so this is the page and the backend together, not the page
// against a stand-in that agrees with it. Only Claude is faked, and it records what it
// is sent.
//
// It walks the whole promise: the teacher signs in and adds a student; the student signs
// in with the code they were given, logs fear, answers, asks the coach, plans, writes,
// has a paragraph read and hands in; the teacher reads every word of it, marks a stage
// and returns it; the student finds the note and the essay open again. Along the way:
// nothing typed is lost on reload, a pasted block is seen by the teacher, a hand-in
// locks the page, a wrong door is named, and a phone gets the whole thing without
// scrolling sideways.
//
// Run: node tests/e2e-englishb.js   (needs playwright + a chromium on disk)
//      SHOTS=/some/dir node tests/e2e-englishb.js   also saves screenshots there
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path'), crypto = require('crypto');

const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const TYPES = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.png':'image/png', '.svg':'image/svg+xml' };
const PORT = 8798, FAKE = 'https://essay.test/exec', URL = `http://localhost:${PORT}/englishb/`;
const SHOTS = process.env.SHOTS || '';

// ---- the real backend ----------------------------------------------------------------
process.env.GS_PATH = path.join(ROOT, 'apps-script/EssayWorkshop.gs');
const { makeEnv } = require('./harness');
const env = makeEnv();
env.Utilities.DigestAlgorithm = { SHA_256: 'SHA_256' };
env.Utilities.computeDigest = (a, s) => [...crypto.createHash('sha256').update(String(s), 'utf8').digest()];
env.Utilities.computeHmacSha256Signature = (v, k) => [...crypto.createHmac('sha256', String(k)).update(String(v), 'utf8').digest()];
env.Utilities.base64EncodeWebSafe = s => Buffer.from(String(s), 'utf8').toString('base64url');
env.Utilities.base64DecodeWebSafe = s => [...Buffer.from(String(s), 'base64url')];
env.Utilities.getUuid = () => crypto.randomUUID();
const props = { ANTHROPIC_API_KEY: 'sk-test' };
env.PropertiesService = { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); } }) };
const sent = [];
env.UrlFetchApp = { fetch: (url, opt) => {
  const body = JSON.parse(opt.payload); sent.push(body);
  const text = body.output_config && body.output_config.format
    ? JSON.stringify({ strengths: ['Your first sentence names one idea about fear.'],
        questions: ['Which word in your quotation does the most work, and why?', 'How does your last sentence connect to your thesis?'],
        checks: { point: true, evidence: true, technique: true, explain: false, link: false } })
    : 'Good question. Look at the walk on Garnet Road again: what does Paul do with his father’s hand?';
  return { getResponseCode: () => 200, getContentText: () => JSON.stringify({ stop_reason: 'end_turn', content: [{ type: 'text', text }] }) };
} };
env.essaySetup();
const TEACHER = env.__sheets['Essay Codes']._grid.find(r => r[1] === 'teacher')[0];

const server = http.createServer((req, res) => {
  let f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('no'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

let fails = 0;
const ok = (what, cond, extra) => {
  console.log((cond ? '  ok   ' : '  FAIL ') + what + (extra && !cond ? '  — ' + extra : ''));
  if (!cond) fails++;
};
const sixty = Array.from({ length: 70 }, (_, i) => ['fear', 'grows', 'in', 'the', 'dark', 'of', 'Paul’s', 'mind'][i % 8]).join(' ');
const body130 = 'Wickham shows fear through “spectral light” and ' + Array.from({ length: 123 }, (_, i) => ['shadow', 'moon', 'brother', 'fear', 'hate'][i % 5]).join(' ');   // 130 words in all

(async () => {
  server.listen(PORT);
  const b = await chromium.launch({ executablePath: CHROME });
  const errs = [];
  const open = async (viewport) => {
    const ctx = await b.newContext({ viewport });
    const page = await ctx.newPage();
    page.on('pageerror', e => errs.push('page error: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
    await page.route(FAKE, async route => {
      const out = env.doPost({ postData: { contents: route.request().postData() } }).getContent();
      await route.fulfill({ contentType: 'application/json', headers: { 'access-control-allow-origin': '*' }, body: out });
    });
    await page.addInitScript(u => { window.ESSAY_API_OVERRIDE = u; }, FAKE);
    return page;
  };
  const shot = async (page, name) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: false }); };

  // ---- the gate ---------------------------------------------------------------------------
  const tp = await open({ width: 1280, height: 900 });
  await tp.goto(URL, { waitUntil: 'networkidle' });
  ok('the page opens on the gate, with a door for each', await tp.isVisible('form[data-door="student"]') && await tp.isVisible('form[data-door="teacher"]'));
  ok('the gate carries the branch mark', await tp.locator('.gatebox .mark img[src="../logo-mark.png"]').count() === 1);
  await shot(tp, 'gate-desktop');
  await tp.fill('#code-student', 'MOON-ZZZZ'); await tp.click('form[data-door="student"] button');
  await tp.waitForFunction(() => document.querySelector('#gateErr').textContent.length > 0);
  ok('a wrong code is refused with the reason', /not right/.test(await tp.textContent('#gateErr')));
  await tp.fill('#code-student', TEACHER); await tp.click('form[data-door="student"] button');
  await tp.waitForFunction(() => /teacher door/.test(document.querySelector('#gateErr').textContent));
  ok('the teacher code at the student door is named for what it is', true);

  // ---- the teacher adds a student ------------------------------------------------------------
  await tp.fill('#code-teacher', TEACHER.toLowerCase()); await tp.click('form[data-door="teacher"] button');
  await tp.waitForSelector('.tpage');
  ok('the teacher code opens the class', /Your class/.test(await tp.textContent('.tpage h1')));
  ok('an empty class says how to begin', /No students yet/.test(await tp.textContent('.tpage')));
  await tp.fill('#newName', 'Aisha'); await tp.click('#addForm button');
  await tp.waitForSelector('.flash .code');
  const CODE = (await tp.textContent('.flash .code')).trim();
  ok('adding a student shows the code to hand out', /^[A-Z]+-[2-9A-HJKMNP-Z]{4}$/.test(CODE), CODE);
  ok('and the card carries it too', (await tp.textContent('.scard .codeline')).includes(CODE));

  // ---- the student ------------------------------------------------------------------------
  const sp = await open({ width: 1280, height: 900 });
  await sp.goto(URL, { waitUntil: 'networkidle' });
  await sp.fill('#code-teacher', CODE); await sp.click('form[data-door="teacher"] button');
  await sp.waitForFunction(() => /student door/.test(document.querySelector('#gateErr').textContent));
  ok('the student code at the teacher door is named for what it is', true);
  await sp.fill('#code-student', CODE.toLowerCase()); await sp.click('form[data-door="student"] button');
  await sp.waitForSelector('.shell');
  ok('the code opens the notebook at Stage 1', /Find the fear/.test(await sp.textContent('.page h1')));
  ok('the question is beside the stages', /Blood Brothers/.test(await sp.textContent('.rail .q')));
  ok('an empty notebook says how to begin', /No moments logged yet/.test(await sp.textContent('.page')));

  await sp.click('[data-act="add-moment"]');
  await sp.selectOption('select[data-bind="moments.0.who"]', 'Paul');
  await sp.fill('[data-bind="moments.0.trigger"]', 'the shadows on Garnet Road at night');
  await sp.fill('[data-bind="moments.0.words"]', '“weird and macabre”');
  await sp.click('[data-act="add-moment"]');
  await sp.selectOption('select[data-bind="moments.1.who"]', 'Benjy');
  await sp.fill('[data-bind="moments.1.trigger"]', 'Paul standing over him with the awl');
  await sp.fill('[data-bind="moments.1.words"]', '“horror and fear”');
  await sp.click('[data-act="add-moment"]');
  await sp.selectOption('select[data-bind="moments.2.who"]', 'Paul');
  await sp.fill('[data-bind="moments.2.trigger"]', 'what Benjy might think of him');
  await sp.fill('[data-bind="moments.2.words"]', '“a coward”');
  ok('the checklist follows what is typed', /3 so far/.test(await sp.textContent('[data-live="checks:find"]')) &&
     (await sp.locator('[data-live="checks:find"] li.ok').count()) >= 2);
  await sp.click('[data-act="hint"]');
  ok('a hint opens one at a time', await sp.locator('.hint-p').count() === 1 && /Garnet Road/.test(await sp.textContent('.hint-p')));
  await shot(sp, 'student-find');
  await sp.waitForFunction(() => document.querySelector('.sync').textContent === 'Saved', null, { timeout: 8000 });
  ok('it saves by itself', true);
  await sp.reload({ waitUntil: 'networkidle' });
  await sp.waitForSelector('.shell');
  ok('nothing typed is lost on reload, and no code is asked for again',
     await sp.locator('.moment').count() === 3 && (await sp.inputValue('[data-bind="moments.1.words"]')) === '“horror and fear”');

  // ---- asking why, and the coach ------------------------------------------------------------
  await sp.click('[data-go="why"]');
  ok('Stage 2 asks the questions', /Did the trees change, or did Paul\?/.test(await sp.textContent('.page')));
  await sp.fill('#why-trees', 'The trees stay the same. It is Paul who changes, because the dark makes him see them as “ghostlike shapes”.');
  await sp.click('[data-act="nudge"][data-k="grow"]');
  ok('“I’m stuck” opens a nudge that points to the story without answering', /Which word does Paul keep using/.test(await sp.textContent('.nudge')));
  await sp.fill('#cin', 'Is my answer to A deep enough?');
  await sp.click('#csend');
  await sp.waitForSelector('.clog .bub.c:last-child:not(.think)');
  await sp.waitForFunction(() => /father’s hand/.test(document.querySelector('.clog').textContent));
  ok('the coach answers in the panel', true);
  const coachReq = sent[sent.length - 1];
  ok('and was sent the answer just typed, saved first', /The trees stay the same/.test(coachReq.messages[coachReq.messages.length - 1].content));
  ok('starter questions change with the stage', /deep enough/.test(await sp.textContent('#chips')));

  // ---- the big idea and the plan ------------------------------------------------------------
  await sp.click('[data-go="idea"]');
  await sp.fill('[data-bind="groups.0.name"]', 'Fear of the dark');
  await sp.fill('[data-bind="groups.1.name"]', 'Fear of being judged');
  await sp.fill('[data-bind="groups.2.name"]', 'Fear in Benjy');
  const sorts = sp.locator('select[data-kinds]');
  await sorts.nth(0).selectOption('1'); await sorts.nth(1).selectOption('3'); await sorts.nth(2).selectOption('2');
  ok('the sorting lists carry the names she gave each kind', /Fear of being judged/.test(await sorts.nth(0).textContent()));
  await sp.fill('[data-bind="thesis"]', 'In Blood Brothers, Wickham shows that fear kept secret turns into hate, through the dark, through shame and through the brother who seemed fearless.');
  await sp.check('[data-bind="thesisTicks.three"]');
  ok('the thesis is checked as she types', (await sp.locator('[data-live="thesis"] li.ok').count()) === 5);
  await sp.click('[data-go="plan"]');
  ok('the plan shows her thesis and her kinds', /fear kept secret/.test(await sp.textContent('.page')) && /Fear of the dark/.test(await sp.textContent('.page')));
  await sp.selectOption('select[data-pick="0"]', { index: 1 });
  ok('a logged moment drops into the evidence, in quotation marks', /“weird and macabre”/.test(await sp.inputValue('#ev-0')));
  await sp.selectOption('select[data-bind="plan.b.0.technique"]', 'Imagery');
  ok('choosing a technique explains it with an everyday example', /burnt sugar/.test(await sp.textContent('[data-live="tech:0"]')));

  // ---- writing ------------------------------------------------------------------------------
  await sp.click('[data-go="write"]');
  for (const k of ['intro', 'concl']) await sp.fill(`#d-${k}`, sixty);
  for (const k of ['b2', 'b3']) await sp.fill(`#d-${k}`, body130);
  await sp.focus('#d-b1');
  await sp.evaluate(text => {
    const el = document.querySelector('#d-b1'), dt = new DataTransfer(); dt.setData('text', text);
    el.dispatchEvent(new ClipboardEvent('paste', { clipboardData: dt, bubbles: true }));
    el.value = text; el.dispatchEvent(new Event('input', { bubbles: true }));
  }, body130);
  ok('word counts show the aim for each paragraph', /130 words · aim for 120–180/.test(await sp.textContent('[data-live="wc:b1"]')));
  await sp.click('[data-act="check"][data-p="b1"]');
  await sp.waitForFunction(() => /Questions to think about/.test(document.querySelector('[data-live="check:b1"]').textContent));
  ok('the coach reads a paragraph and asks questions about it', /Which word in your quotation/.test(await sp.textContent('[data-live="check:b1"]')));
  await shot(sp, 'student-write');

  // ---- handing in ---------------------------------------------------------------------------
  await sp.click('[data-go="hand"]');
  ok('the whole essay is there to read once more', (await sp.textContent('[data-live="essay"]')).includes('spectral light'));
  await sp.click('[data-act="handin"]');
  ok('the first press only asks to be sure', /Press again/.test(await sp.textContent('[data-act="handin"]')));
  await sp.click('[data-act="handin"]');
  await sp.waitForFunction(() => /Handed in/.test(document.querySelector('.page').textContent));
  ok('the second hands it in, and the page says so', /Handed in/.test(await sp.textContent('.banner.lock')));
  await sp.click('[data-go="write"]');
  ok('a handed-in essay cannot be typed into', await sp.isDisabled('#d-b1'));

  // ---- the teacher reads it all ------------------------------------------------------------------
  await tp.click('[data-act="t-refresh"]');
  await tp.waitForSelector('.scard .pill.in');
  ok('the class shows her as handed in', /Handed in/.test(await tp.textContent('.scard .pill')));
  ok('and that text was pasted', /Pasted text: 1 time, the largest 130 words/.test(await tp.textContent('.scard')));
  await tp.click('[data-act="t-open"]');
  await tp.click('[data-ttab="find"]');
  ok('the teacher reads her fear moments', /weird and macabre/.test(await tp.textContent('.ro')) && /1 of 5/.test(await tp.textContent('.ro')));
  await tp.click('[data-ttab="coach"]');
  await tp.waitForFunction(() => /deep enough/.test(document.querySelector('.ro').textContent));
  ok('and every word she and the coach said', /father’s hand/.test(await tp.textContent('.ro')));
  await tp.click('[data-ttab="activity"]');
  ok('the activity says where the paste went', /130 words into Body paragraph 1/.test(await tp.textContent('.ro')));
  await tp.click('[data-ttab="find"]');
  await tp.fill('#tnote', 'Good start. Find two more moments for Benjy.');
  await tp.click('[data-act="t-status"][data-v="more"]');
  await tp.waitForFunction(() => document.querySelector('[data-ttab="find"] .tn.more'));
  ok('the teacher marks a stage and leaves a note', true);
  await tp.fill('#retNote', 'Add a second quotation to body paragraph 1.');
  await tp.click('[data-act="t-return"]'); await tp.click('[data-act="t-return"]');
  await tp.waitForSelector('.thead .pill.back');
  ok('the teacher returns the essay, and stays on it', /Returned to work on/.test(await tp.textContent('.thead .pill')));
  await tp.click('[data-act="t-back"]');
  await tp.waitForSelector('.scard');
  await shot(tp, 'teacher-class');

  // ---- the student finds it open again ------------------------------------------------------------
  await sp.reload({ waitUntil: 'networkidle' });
  await sp.waitForSelector('.shell');
  await sp.click('[data-go="find"]');
  ok('the teacher’s return note is the first thing she reads', /Add a second quotation/.test(await sp.textContent('.banner.back')));
  ok('the stage note sits at the top of the stage', /Find two more moments for Benjy/.test(await sp.textContent('[data-live="tnote:find"]')));
  ok('the stage is marked in the list of stages', /look again/.test(await sp.textContent('[data-go="find"]')));
  ok('and the essay can be worked on again', !(await sp.isDisabled('[data-bind="moments.0.words"]')));

  // ---- a phone ----------------------------------------------------------------------------------
  const pp = await open({ width: 390, height: 844 });
  await pp.goto(URL, { waitUntil: 'networkidle' });
  ok('the gate fits a phone', await pp.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth));
  await shot(pp, 'gate-phone');
  await pp.fill('#code-student', CODE); await pp.click('form[data-door="student"] button');
  await pp.waitForSelector('.shell');
  for (const k of ['find', 'why', 'idea', 'plan', 'write', 'hand']) {
    await pp.click(`.rail [data-go="${k}"]`);
    const wide = await pp.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    ok(`stage “${k}” fits a phone without scrolling sideways`, wide <= 0, wide + 'px over');
  }
  await pp.click('.rail [data-go="find"]');
  await shot(pp, 'student-phone');
  await pp.click('.fab');
  await pp.waitForFunction(() => { const r = document.querySelector('#coach').getBoundingClientRect(); return r.top < window.innerHeight - 100; });
  ok('the coach opens from the button on a phone', true);
  await shot(pp, 'coach-phone');

  // ---- signing out ------------------------------------------------------------------------------
  await sp.click('[data-act="signout"]');
  await sp.waitForSelector('form[data-door="student"]');
  await sp.reload({ waitUntil: 'networkidle' });
  ok('signing out forgets the sign-in on that device', await sp.isVisible('form[data-door="student"]'));

  ok('no errors in any console', errs.length === 0, errs.slice(0, 4).join(' | '));
  await b.close(); server.close();
  console.log();
  console.log(fails ? `  ${fails} failed` : '  all good');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
