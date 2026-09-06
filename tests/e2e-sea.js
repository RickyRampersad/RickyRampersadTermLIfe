// The S.E.A. practice app, at /sea/.
//
// The mock paper is the part that has to be right. A student who sits it is
// spending seventy-five minutes on the strength of a claim — that this is the
// shape of the real Mathematics paper. The Assessment Framework fixes that
// shape: 40 items, 75 marks, sections of 20/16/4 items worth 20/39/16 marks,
// and 19/6/9/6 items across Number, Geometry, Measurement and Statistics.
// The generator shuffles and swaps to hit those numbers, so it is checked here
// on real papers rather than on the blueprint it was written from.
//
// The rest is the promise the page makes. To a child working alone: a paper
// answered correctly scores full marks, a blank one scores nothing and hands
// back every worked explanation, and nothing typed is lost on reload.
//
// And the promise made to whoever is paying for it — that a student is helped
// before they are told. The answer rung must be shut until the child has
// actually tried, and must open the moment they do, right or wrong. A parent
// or a teacher signing in sees everything at once. If the student gate ever
// springs open on its own, the app is an answer key with a clock on it.
//
// Run: node tests/e2e-sea.js   (needs playwright + a chromium on disk)
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const TYPES = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css',
                '.json':'application/json', '.png':'image/png', '.svg':'image/svg+xml' };
const PORT = 8797;

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

(async () => {
  server.listen(PORT);
  const b = await chromium.launch({ executablePath: CHROME });
  const page = await b.newPage({ viewport: { width: 1180, height: 900 } });

  const errs = [];
  page.on('pageerror', e => errs.push('page error: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  page.on('response', r => { if (r.status() >= 400) errs.push(r.status() + ' ' + r.url()); });

  const URL = `http://localhost:${PORT}/sea/`;
  await page.goto(URL, { waitUntil: 'networkidle' });

  // ---- the gate ------------------------------------------------------------
  ok('the app is behind the gate until somebody signs in', await page.isHidden('#app'));
  await page.fill('#gateCode', 'NOPE');
  await page.click('#gateGo');
  ok('a wrong code is refused', (await page.textContent('#gateErr')).length > 0 && await page.isHidden('#app'));
  const signIn = async (roleName, code) => {
    await page.evaluate(() => { sessionStorage.clear(); });
    await page.goto(URL, { waitUntil: 'networkidle' });
    await page.click(`#roles .role[data-role="${roleName}"]`);
    await page.fill('#gateCode', code);
    await page.click('#gateGo');
    await page.waitForSelector('#app:not([hidden])');
  };
  await signIn('student', 'RRB2027');
  ok('the student code opens the app', await page.isVisible('#app') &&
     (await page.textContent('#rolePill')) === 'Student');

  // ---- every section opens -------------------------------------------------
  for (const v of ['practice', 'exam', 'writing', 'papers', 'syllabus', 'home']) {
    await page.click(`#nav button[data-view="${v}"]`);
    ok(`the ${v} section opens`, await page.isVisible(`#v-${v}`));
  }
  ok('a student is not offered the answer key',
     (await page.$('#nav button[data-view="key"]')) === null);
  await page.goto(URL + '#key', { waitUntil: 'networkidle' });
  ok('a student typing the answer key straight into the address bar lands on Home',
     await page.isVisible('#v-home') && await page.isHidden('#v-key'));

  // ---- the mock paper keeps the Ministry's shape, three papers running ------
  page.on('dialog', d => d.accept());
  const shapes = [];
  for (let run = 0; run < 3; run++) {
    await page.click('#nav button[data-view="exam"]');
    if (await page.isVisible('#examAgain')) await page.click('#examAgain');
    await page.check('#examUntimed');
    await page.click('#examStart');
    await page.waitForSelector('#examHost .examq');
    shapes.push(await page.evaluate(() => {
      const by = {}, sec = { 1:0, 2:0, 3:0 }, secMarks = { 1:0, 2:0, 3:0 };
      let marks = 0;
      for (const q of exam.items) {
        by[q.strand] = (by[q.strand] || 0) + 1;
        sec[q.sec]++; secMarks[q.sec] += q.marks; marks += q.marks;
      }
      return { n: exam.items.length, marks, by, sec, secMarks,
               onPage: document.querySelectorAll('#examHost .examq').length,
               ids: exam.items.map(q => q.id) };
    }));
    if (run < 2) await page.click('#examSubmit');
  }
  const shaped = s =>
    s.n === 40 && s.onPage === 40 && s.marks === 75 &&
    s.sec[1] === 20 && s.sec[2] === 16 && s.sec[3] === 4 &&
    s.secMarks[1] === 20 && s.secMarks[2] === 39 && s.secMarks[3] === 16 &&
    s.by.Number === 19 && s.by.Geometry === 6 && s.by.Measurement === 9 && s.by.Statistics === 6;
  ok('three generated papers each hold 40 items and 75 marks in the right split',
     shapes.every(shaped),
     shapes.map(s => `${s.n}i/${s.marks}m ${s.sec[1]}-${s.sec[2]}-${s.sec[3]} ` +
                     `(${s.secMarks[1]}-${s.secMarks[2]}-${s.secMarks[3]})`).join(' | '));
  ok('no paper repeats a question', shapes.every(s => new Set(s.ids).size === s.ids.length));
  ok('two papers are not the same paper', shapes[0].ids.join() !== shapes[1].ids.join());

  // ---- a correct paper scores full marks -----------------------------------
  await page.evaluate(() => exam.items.forEach((q, i) => {
    const el = document.getElementById('ea' + (i + 1));
    el.value = q.a[0]; el.dispatchEvent(new Event('input', { bubbles: true }));
  }));
  ok('the progress counter follows the answers', (await page.textContent('#examProg')) === '40 / 40');
  await page.click('#examSubmit');
  await page.waitForSelector('#examResult h1');
  ok('a paper answered from the bank scores 75 out of 75',
     (await page.textContent('#examResult h1')).trim() === '75 out of 75');

  // ---- a blank paper scores nothing and explains all forty ------------------
  await page.click('#examAgain');
  await page.click('#examStart');
  await page.waitForSelector('#examHost .examq');
  await page.click('#examSubmit');
  await page.waitForSelector('#examResult h1');
  ok('a blank paper scores 0 out of 75',
     (await page.textContent('#examResult h1')).trim() === '0 out of 75');
  ok('every missed question comes back with all four rungs',
     (await page.$$eval('#examResult .hint', n => n.length)) === 40 * 4);

  // ---- the ladder: helped before told --------------------------------------
  await page.click('#nav button[data-view="practice"]');
  const rungState = () => page.$$eval('#pRungs .rung',
    n => n.map(b => ({ k: b.dataset.k, locked: b.disabled })));
  let rungs = await rungState();
  ok('the ladder offers four rungs', rungs.length === 4);
  ok('the pointer is open from the start', !rungs.find(r => r.k === 'ask').locked);
  ok('the answer is shut before any attempt', rungs.find(r => r.k === 'ans').locked);
  ok('the working is shut before any attempt', rungs.find(r => r.k === 'work').locked);
  ok('a locked ladder says what to do about it',
     (await page.textContent('#pLocked')).length > 20);

  await page.click('#pRungs .rung[data-k="ask"]');
  ok('the pointer opens without giving a number', await page.isVisible('#pHints .hint'));
  rungs = await rungState();
  ok('reading the pointer unlocks the first step', !rungs.find(r => r.k === 'step').locked);
  ok('reading the pointer does NOT unlock the answer', rungs.find(r => r.k === 'ans').locked);

  await page.fill('#pAns', 'definitely not the answer');
  await page.click('#pCheck');
  ok('a wrong answer is marked wrong', await page.isVisible('#pVerdict .verdict.no'));
  rungs = await rungState();
  ok('a real attempt — even a wrong one — opens the working and the answer',
     !rungs.find(r => r.k === 'work').locked && !rungs.find(r => r.k === 'ans').locked);
  await page.click('#pRungs .rung[data-k="ans"]');
  ok('the answer rung then shows the answer',
     (await page.$$eval('#pHints .hint', n => n.length)) >= 2);

  // Moving on must re-lock — otherwise one attempt unlocks the whole bank.
  await page.click('#pNext');
  rungs = await rungState();
  ok('the next question starts locked again', rungs.find(r => r.k === 'ans').locked);

  await page.click('#pStrand .chip[data-s="Geometry"]');
  ok('the strand filter narrows the set',
     /of \d+ in this set/.test(await page.textContent('#pCount')) &&
     (await page.$$eval('#pStrand .chip[aria-pressed="true"]', n => n.length)) === 1);

  // ---- the essay is not lost -----------------------------------------------
  await page.click('#nav button[data-view="writing"]');
  await page.fill('#wEssay', 'The lights went out just as the music started.');
  ok('the word count is live', (await page.textContent('#wWords')) === '9');
  await page.click('#wType .chip[data-k="expository"]');
  ok('an expository set offers three prompts',
     (await page.$$eval('#wPrompts .prompt', n => n.length)) === 3);
  await page.reload({ waitUntil: 'networkidle' });
  ok('the essay survives a reload',
     (await page.inputValue('#wEssay')) === 'The lights went out just as the music started.');

  // ---- the papers are linked, never re-hosted ------------------------------
  await page.click('#nav button[data-view="papers"]');
  const links = await page.$$eval('#paperList a.dl', a => a.map(x => x.href));
  ok(`${links.length} past papers are listed`, links.length === 23);
  ok('every past paper link leaves for the Ministry',
     links.every(u => /moe\.gov\.tt|wpuploadstorageaccount\.blob\.core\.windows\.net/.test(u)),
     links.filter(u => !/moe\.gov\.tt|wpuploadstorageaccount/.test(u)).join(' '));

  // ---- parent and teacher see everything at once ---------------------------
  await signIn('parent', 'RRBPARENT');
  ok('the parent code opens the app', (await page.textContent('#rolePill')) === 'Parent');
  await page.click('#nav button[data-view="practice"]');
  const parentRungs = await page.$$eval('#pRungs .rung', n => n.map(b => b.disabled));
  ok('a parent has the whole ladder open without attempting anything',
     parentRungs.every(d => d === false));
  await page.click('#nav button[data-view="key"]');
  ok('a parent gets the answer key', await page.isVisible('#v-key') &&
     (await page.$$eval('#kHost .hint', n => n.length)) > 200);
  ok('a parent is not given the mock exam', (await page.$('#nav button[data-view="exam"]')) === null);

  await signIn('teacher', 'RRBTEACHER');
  ok('the teacher code opens the app', (await page.textContent('#rolePill')) === 'Teacher');
  const tViews = await page.$$eval('#nav button', n => n.map(b => b.dataset.view));
  ok('a teacher gets every section including the key',
     ['home','practice','exam','writing','papers','syllabus','key'].every(v => tViews.includes(v)),
     tViews.join(','));
  await page.click('#nav button[data-view="exam"]');
  ok('only the teacher is offered a printable blank paper', await page.isVisible('#examPrint'));

  // Every question in the key must carry all four rungs.
  await page.click('#nav button[data-view="key"]');
  const keyBlocks = await page.$$eval('#kHost > .card > div', n => n.length);
  const keyHints  = await page.$$eval('#kHost .hint', n => n.length);
  ok(`the key holds all 71 questions with four rungs each (${keyBlocks} blocks, ${keyHints} rungs)`,
     keyBlocks === 71 && keyHints === 71 * 4);

  // ---- the branch mark, on screen ------------------------------------------
  const marks = await page.$$eval('.mark img', n => n.map(i => ({ src: i.getAttribute('src'), w: i.naturalWidth })));
  ok(`the branch mark file loads everywhere it is used (${marks.length} places)`,
     marks.length >= 2 && marks.every(m => /logo-mark\.png$/.test(m.src) && m.w > 0),
     JSON.stringify(marks));

  await signIn('student', 'RRB2027');

  // ---- a phone has to be able to use it ------------------------------------
  await page.setViewportSize({ width: 390, height: 844 });
  await page.click('#nav button[data-view="home"]');
  const spill = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok('nothing spills sideways at 390px', spill <= 1, spill + 'px');

  // ---- sponsors: the strip, and its absence ----------------------------------
  // Free to families means sponsors pay for reach. The strip has to be where a
  // parent looks and nowhere a child works, and the page must never phone the
  // sponsor — a children's app that beacons is a children's app that tracks.
  await page.setViewportSize({ width: 1180, height: 900 });
  ok('with no sponsor configured, nothing sponsor-shaped is on the page',
     (await page.$$eval('.sponsor', n => n.length)) === 0);
  const sponsorHits = [];
  page.on('request', r => { if (/example-bookstore\.tt/.test(r.url())) sponsorHits.push(r.url()); });
  await page.addInitScript(() => { window.SPONSORS_OVERRIDE = [
    { slot: 'title',  name: 'Example Bookstore', tag: 'Books for the S.E.A. year', url: 'https://example-bookstore.tt/',
      logo: 'data:image/svg+xml,<svg xmlns="http://www.w3.org/2000/svg" width="10" height="10"/>' },
    { slot: 'papers', name: 'Example Bookstore', tag: 'The printed booklets', url: 'https://example-bookstore.tt/papers' } ]; });
  await page.evaluate(() => sessionStorage.clear());
  await page.goto(URL, { waitUntil: 'networkidle' });
  ok('the title sponsor is on the sign-in screen', await page.isVisible('#gateSponsor .sponsor[data-slot="title"]'));
  await page.fill('#gateCode', 'RRB2027'); await page.click('#gateGo');
  await page.waitForSelector('#app:not([hidden])');
  ok('and on Home, introduced as the reason the app is free', /thanks to/i.test(await page.textContent('#homeSponsor')));
  await page.click('#nav button[data-view="papers"]');
  ok('the papers sponsor sits above the papers', await page.isVisible('#papersSponsor .sponsor[data-slot="papers"]'));
  const rels = await page.$$eval('.sponsor a', a => a.map(x => [x.getAttribute('rel'), x.getAttribute('target')]));
  ok('every sponsor link is marked sponsored and opens in a new tab',
     rels.length >= 2 && rels.every(([r, t]) => /sponsored/.test(r) && /noopener/.test(r) && t === '_blank'));
  await page.click('#nav button[data-view="practice"]');
  ok('no sponsor appears inside a question', (await page.$$eval('#pHost .sponsor', n => n.length)) === 0);
  ok('the page never called the sponsor on its own', sponsorHits.length === 0, sponsorHits.join(' '));

  // ---- signing in against the Academy sheet ------------------------------
  // A fake of apps-script/Academy.gs, in memory, behind page.route. The real
  // one is tested in test-academy.js; this is the page's half of the promise —
  // that a family the Academy added by e-mail can choose a password and get
  // in, that progress goes up and comes back, and that a parent lands on the
  // child's progress rather than their own.
  await page.setViewportSize({ width: 1180, height: 900 });
  const FAKE = 'https://academy.test/exec';
  const users = {
    'aisha@example.com': { name: 'Aisha Ali', role: 'student', hash: null, student: '' },
    'dad@example.com':   { name: 'Imran Ali', role: 'parent',  hash: null, student: 'aisha@example.com' },
    'off@example.com':   { name: 'Off',       role: 'student', hash: null, status: 'disabled' }
  };
  const progress = {}, calls = [];
  const state = u => !u ? 'unknown' : u.status === 'disabled' ? 'disabled' : !u.hash ? 'new' : 'active';
  const session = email => {
    const u = users[email];
    const out = { ok: true, token: 'tok-' + email, progress: progress[email] || null, child: null,
      user: { email, name: u.name, role: u.role, student: u.student ? { email: u.student, name: users[u.student].name } : null } };
    if (u.role === 'parent' && u.student) out.child = { name: users[u.student].name, email: u.student, progress: progress[u.student] || null };
    return out;
  };
  await page.route(FAKE, async route => {
    const b = JSON.parse(route.request().postData()); calls.push(b.action);
    const email = String(b.email || '').toLowerCase(), u = users[email]; let out;
    const who = () => String(b.token || '').replace('tok-', '');
    if (b.action === 'lookup') out = { ok: true, state: state(u), name: u ? u.name : '' };
    else if (b.action === 'setpassword') {
      if (state(u) !== 'new') out = { ok: false, error: 'This account already has a password.' };
      else if (String(b.password || '').length < 8) out = { ok: false, error: 'Choose a password of at least 8 characters.' };
      else { u.hash = b.password; out = session(email); }
    } else if (b.action === 'signin') {
      if (state(u) !== 'active') out = { ok: false, error: 'not active' };
      else if (u.hash !== b.password) out = { ok: false, error: 'That password is not right.' };
      else out = session(email);
    } else if (b.action === 'load') out = users[who()] ? session(who()) : { ok: false, error: 'Sign in again.' };
    else if (b.action === 'save') { progress[who()] = b.progress; out = { ok: true, updated: 'now' }; }
    else out = { ok: false, error: 'Unknown action.' };
    await route.fulfill({ contentType: 'application/json', body: JSON.stringify(out) });
  });
  await page.addInitScript(() => { window.ACADEMY_API_OVERRIDE = 'https://academy.test/exec'; });
  await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
  await page.goto(URL, { waitUntil: 'networkidle' });

  ok('with a backend set, the gate asks for an e-mail and hides the codes',
     await page.isVisible('#gateAccount') && await page.isHidden('#gateCodes') && await page.isHidden('#app'));
  const before = calls.length;
  await page.fill('#gEmail', 'not-an-email'); await page.click('#gGo');
  ok('something that is not an e-mail is stopped before it reaches the sheet',
     calls.length === before && (await page.textContent('#gateErr')).length > 0);
  await page.fill('#gEmail', 'nobody@example.com'); await page.click('#gGo');
  await page.waitForFunction(() => document.querySelector('#gateErr').textContent.length > 0);
  ok('an e-mail the Academy has not added is told so',
     /not on the Academy list/.test(await page.textContent('#gateErr')) && await page.isHidden('#app'));
  await page.fill('#gEmail', 'off@example.com'); await page.click('#gGo');
  await page.waitForFunction(() => /switched off/.test(document.querySelector('#gateErr').textContent));
  ok('a switched-off family is told so', true);

  await page.fill('#gEmail', 'Aisha@Example.com'); await page.click('#gGo');
  await page.waitForSelector('#gCreateRow:not([hidden])');
  ok('a fresh e-mail is asked to choose a password, by name',
     await page.isVisible('#gPass1') && /Hello, Aisha/.test(await page.textContent('#gWho')));
  await page.fill('#gPass1', 'mango-tree-2027'); await page.fill('#gPass2', 'mango-tree-2028'); await page.click('#gGo');
  ok('two passwords that differ are refused', /do not match/.test(await page.textContent('#gateErr')) && await page.isHidden('#app'));
  await page.fill('#gPass1', 'short'); await page.fill('#gPass2', 'short'); await page.click('#gGo');
  ok('a short password is refused', /Eight/.test(await page.textContent('#gateErr')));
  await page.fill('#gPass1', 'mango-tree-2027'); await page.fill('#gPass2', 'mango-tree-2027'); await page.click('#gGo');
  await page.waitForSelector('#app:not([hidden])');
  ok('choosing a password signs the student in, by name',
     (await page.textContent('#rolePill')) === 'Student · Aisha' && (await page.$('#nav button[data-view="key"]')) === null);

  // Progress goes up after a change, and comes back on the next device.
  await page.click('#nav button[data-view="practice"]');
  const right = await page.evaluate(() => pList[pIdx].a[0]);
  await page.fill('#pAns', right); await page.click('#pCheck');
  await page.waitForFunction(() => document.querySelector('#syncDot').textContent === 'saved', null, { timeout: 8000 });
  ok('an answer is pushed to the sheet a moment later',
     calls.includes('save') && progress['aisha@example.com'] && Object.keys(progress['aisha@example.com'].seen).length === 1);
  await page.reload({ waitUntil: 'networkidle' });
  ok('reloading resumes the session from the token, without the gate',
     await page.isVisible('#app') && calls.filter(c => c === 'load').length >= 1);
  await page.click('#signOut');
  await page.waitForSelector('#gateAccount:not([hidden])');
  ok('signing out returns to the gate and forgets the token',
     await page.isHidden('#app') && (await page.evaluate(() => localStorage.getItem('rrb.sea.token'))) === null);

  await page.fill('#gEmail', 'aisha@example.com'); await page.click('#gGo');
  await page.waitForSelector('#gPassRow:not([hidden])');
  ok('the second time, the e-mail is asked for its password, not a new one',
     await page.isVisible('#gPass') && await page.isHidden('#gPass1'));
  await page.fill('#gPass', 'wrong-one'); await page.click('#gGo');
  await page.waitForFunction(() => /not right/.test(document.querySelector('#gateErr').textContent));
  ok('a wrong password is refused', await page.isHidden('#app'));
  await page.fill('#gPass', 'mango-tree-2027'); await page.click('#gGo');
  await page.waitForSelector('#app:not([hidden])');
  ok('the right one is in, and the earlier progress came back with it',
     (await page.textContent('#hA')) === '1');
  await page.click('#signOut');
  await page.waitForSelector('#gateAccount:not([hidden])');

  // The parent.
  await page.fill('#gEmail', 'dad@example.com'); await page.click('#gGo');
  await page.waitForSelector('#gCreateRow:not([hidden])');
  await page.fill('#gPass1', 'doubles-and-chutney'); await page.fill('#gPass2', 'doubles-and-chutney'); await page.click('#gGo');
  await page.waitForSelector('#app:not([hidden])');
  ok('the parent is in, by name, with the key and without the mock exam',
     (await page.textContent('#rolePill')) === 'Parent · Imran' &&
     (await page.$('#nav button[data-view="key"]')) !== null && (await page.$('#nav button[data-view="exam"]')) === null);
  ok("the parent's home is the child's progress, by the child's name",
     /Aisha's progress/.test(await page.textContent('#homeKicker')) && (await page.textContent('#hA')) === '1');
  ok('a parent cannot clear the child\'s progress', await page.isHidden('#resetBtn'));

  ok('no errors in the console', errs.length === 0, errs.join(' | '));

  await b.close();
  server.close();
  console.log();
  console.log(fails ? `  ${fails} failed` : '  all good');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
