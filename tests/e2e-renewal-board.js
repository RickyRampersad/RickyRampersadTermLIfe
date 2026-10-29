// The renewal board (apps-script/Board.html) in a real browser, against the real
// RenewalBoard.gs run in Node with made-up sheets: signed in as the branch, as staff
// and as an agent, at 360, 390 and 1366 wide. Checks the gate, the scope (an agent
// sees only their own clients and no "who is carrying what"), the charts with their
// values in the text, the tiles that filter, the search, a note logged, an assignment
// by staff, sign-out forgetting the board, no sideways scroll, and nothing invisible
// with reduced motion. Every name is made up.
//
// Run: node tests/e2e-renewal-board.js [screenshot-dir]
const fs = require('fs'), path = require('path'), vm = require('vm');
const ROOT = path.join(__dirname, '..');
const SHOTS = process.argv[2] || path.join(require('os').tmpdir(), 'renewal-board-shots');
fs.mkdirSync(SHOTS, { recursive: true });
let fails = 0, passes = 0;
const ok = (what, cond, extra) => {
  console.log((cond ? '  ok   ' : '  FAIL ') + what + (extra && !cond ? '  — ' + extra : ''));
  if (cond) passes++; else fails++;
};

/* ---------------- the backend: RenewalBoard.gs itself, on made-up sheets ---------------- */
const KEY = 'TESTKEY';
const STAFF = {
  'admin@example.com': { email: 'admin@example.com', name: 'Rana Branchley', role: 'admin', pin: '1111' },
  'staff@example.com': { email: 'staff@example.com', name: 'Sasha Example', role: 'staff', pin: '2222' },
  'agent@example.com': { email: 'agent@example.com', name: 'NEIL PRETEND', role: 'agent', pin: '3333' },
};
const day = n => { const d = new Date(); d.setDate(d.getDate() + n); return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); };
const M = (client, cov, days, prem, o) => Object.assign({ client, coverage: cov, policy: 'TT MOT ' + (100000 + Math.floor(prem)), nextDue: day(days), days, premium: prem,
  paid: 0, balance: 0, payStatus: '', renewalStatus: '', email: client.split(' ')[0].toLowerCase() + '@mail.example', mobile: '868-555-0' + String(100 + Math.floor(prem) % 900),
  assignedTo: '', agent: '', agentEmail: '', sumInsured: prem * 20, renewedDate: '' }, o || {});
const NEIL = { agent: 'Neil Pretend', agentEmail: 'agent@example.com' };
const MARA = { agent: 'Mara Sample', agentEmail: 'mara@example.com' };
let motor = [
  M('Anika Pretend', 'Comprehensive', -9, 6400, NEIL),
  M('Brent Madeup', 'Third Party', 3, 2100, NEIL),
  M('Celia Notreal', 'Comprehensive', 11, 8800, MARA),
  M('Dev Imaginary', 'Third Party', 25, 1900, MARA),
  M('Esha Fictional', 'Comprehensive', -40, 7300, Object.assign({ renewalStatus: 'RENEWED', renewedDate: day(-42), balance: 2400, paid: 4900 }, NEIL)),
  M('Farid Example', 'Comprehensive', 5, 9900, { assignedTo: 'Sasha Example' }),
  M('Gita Sampleton', 'Third Party', -2, 2300, MARA),
  M('Hal Placeholder', 'Comprehensive', 40, 12100, NEIL),
  M('Ira Testcase', 'Third Party', 18, 2500, NEIL),
  M('Jo Mockup', 'Comprehensive', -5, 6100, Object.assign({ renewalStatus: 'RENEWED', renewedDate: day(-6), paid: 6100 }, MARA)),
  M('Kai Dummy', 'Third Party', 0, 1800, {}),
  M('Lia Pretendson', 'Comprehensive', 9, 7700, NEIL),
  M('Moe Fakename', 'Third Party', 52, 2050, MARA),
  M('Nia Stand-in', 'Comprehensive', -3, 6900, Object.assign({ renewalStatus: 'RENEWED', renewedDate: day(-3), balance: 900, paid: 6000 }, MARA)),
];
motor.forEach((r, i) => { r.rowIndex = i + 2; r.token = 'm' + (i + 1); });
let props = [
  { client: 'Olu Inventa', policy: 'TT FHO 0100021', location: '12 Sample Street, Arima', occupancy: 'Dwelling', renewalDate: day(6), days: 6, premium: 5400, status: '', stage: 'Values sent', email: 'olu@mail.example', mobile: '868-555-0901', assignedTo: '', ...NEIL, total: 1250000 },
  { client: 'Pia Hypothetic', policy: 'TT FCP 0100088', location: 'Unit 4, Make-Believe Plaza', occupancy: 'Shop', renewalDate: day(33), days: 33, premium: 14200, status: '', stage: '', email: '', mobile: '868-555-0902', assignedTo: 'Sasha Example', ...MARA, total: 3400000 },
  { client: 'Quin Notaperson', policy: 'TT FHO 0100107', location: '', occupancy: 'Dwelling', renewalDate: '', days: null, premium: 3100, status: '', stage: '', email: 'quin@mail.example', mobile: '', assignedTo: '', agent: '', agentEmail: '', total: 640000 },
];
props.forEach((r, i) => { r.rowIndex = i + 2; r.token = 'p' + (i + 1); });
const log = [];
const lineSrc = fs.readFileSync(path.join(ROOT, 'apps-script/RenewalLines.gs'), 'utf8').match(/function lineOf_\([\s\S]*?\n}\n/)[0];
const ctx = vm.createContext({
  HtmlService: {}, console,
  staffKey_: () => KEY, STAFF_KEY_PROP: 'STAFF_KEY',
  requireStaff_: (key, me, pin) => {
    if (key !== KEY) throw new Error('Invalid staff link.');
    const s = STAFF[String(me || '').trim().toLowerCase()];
    if (!s) throw new Error('Your email is not on the Staff sheet — ask an admin to add you.');
    if (String(pin) !== s.pin) throw new Error('Wrong access code — use the code beside your name on the Staff tab.');
    return { email: s.email, name: s.name, role: s.role };
  },
  allRenewals_: () => JSON.parse(JSON.stringify(motor)),
  allProperties_: () => JSON.parse(JSON.stringify(props)),
  logActivity_: (...a) => log.push(a),
  setRenewalCell_: (ri, h, v) => { motor.find(r => r.rowIndex === ri)[h === 'Assigned To' ? 'assignedTo' : h] = v; },
  setPropCell_: (ri, h, v) => { props.find(r => r.rowIndex === ri)[h === 'Assigned To' ? 'assignedTo' : h] = v; },
  nowStamp_: () => '26 Oct 2026',
});
vm.runInContext(lineSrc + '\n' + fs.readFileSync(path.join(ROOT, 'apps-script/RenewalBoard.gs'), 'utf8'), ctx);
const backend = {
  renewalBoardData: (...a) => ctx.renewalBoardData(...a),
  renewalBoardAct: (...a) => ctx.renewalBoardAct(...a),
};

/* ---------------- the page, as HtmlService would serve it ---------------- */
function pageHtml(boot) {
  let h = fs.readFileSync(path.join(ROOT, 'apps-script/Board.html'), 'utf8');
  const theme = fs.readFileSync(path.join(ROOT, 'apps-script/RenewalTheme.html'), 'utf8');
  if (!h.includes('<?!= rrTheme_() ?>')) throw new Error('Board.html does not include the theme');
  h = h.replace('<?!= rrTheme_() ?>', () => theme);
  // boardPage_ sets t.payload = JSON.stringify({...}); the scriptlet prints it as Apps Script would.
  const payload = JSON.stringify(boot);
  h = h.replace(/<\?!=\s*JSON\.stringify\(payload\)\s*\?>/, () => JSON.stringify(payload))
       .replace(/<\?!=\s*payload\s*\?>/, () => payload);
  if (/<\?/.test(h)) throw new Error('an unreplaced scriptlet is left in Board.html');
  return h;
}
const STUB = `
  window.google = { script: { run: (function () {
    function mk(ok, bad) {
      var o = {
        withSuccessHandler: function (f) { return mk(f, bad); },
        withFailureHandler: function (f) { return mk(ok, f); },
        withUserObject: function () { return o; }
      };
      ['renewalBoardData', 'renewalBoardAct'].forEach(function (n) {
        o[n] = function () {
          var args = Array.prototype.slice.call(arguments);
          window.__calls = (window.__calls || []).concat([[n, args]]);
          window.__gs(n, JSON.stringify(args)).then(function (r) {
            var x = JSON.parse(r);
            setTimeout(function () { if (x.err) { bad && bad(new Error(x.err)); } else { ok && ok(x.v); } }, 30);
          });
        };
      });
      return o;
    }
    return mk(null, null);
  })() } };`;

(async () => {
  const { chromium } = require('playwright');
  const browser = await chromium.launch();

  async function open(w, h, opts) {
    opts = opts || {};
    const context = await browser.newContext({ viewport: { width: w, height: h }, reducedMotion: opts.reduce ? 'reduce' : 'no-preference', deviceScaleFactor: 1 });
    const page = await context.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(String(e)));
    page.on('console', m => { if (m.type() === 'error' && !/favicon|board-mark|ERR_|net::/.test(m.text())) errors.push(m.text()); });
    await page.route('**/*', r => r.request().url().startsWith('https://rickyrampersadbranch.com/')
      ? r.fulfill({ status: 200, contentType: 'image/png', body: fs.readFileSync(path.join(ROOT, 'orphan-transition/board-mark.png')) })
      : r.continue());
    await page.exposeFunction('__gs', (name, args) => {
      try { return JSON.stringify({ v: backend[name](...JSON.parse(args)) }); }
      catch (e) { return JSON.stringify({ err: e.message }); }
    });
    // setContent does not run init scripts, so the fake google.script.run goes into the page itself.
    await page.setContent(pageHtml(opts.boot || { ok: true, key: KEY, why: '' }).replace('<head>', () => '<head><script>' + STUB + '</script>'), { waitUntil: 'load' });
    return { page, context, errors };
  }
  async function signIn(page, em, pin) {
    await page.fill('#em', em); await page.fill('#pin', pin);
    await page.click('#go');
    await page.waitForSelector('#app:not([hidden]) .rb-row, #app:not([hidden]) .rr-empty', { timeout: 8000 });
    await page.waitForTimeout(1500);
  }
  async function noSideways(page) {
    return page.evaluate(() => { window.scrollTo(500, window.scrollY); const x = window.scrollX; window.scrollTo(0, window.scrollY); return x === 0 && document.documentElement.scrollWidth <= window.innerWidth + 1; });
  }

  /* ---------- the gate ---------- */
  {
    const { page, context, errors } = await open(390, 844);
    ok('gate: shown first, board hidden', await page.isVisible('#gate') && !(await page.isVisible('#app')));
    ok('gate: the blue shield in the top bar', await page.$eval('.rr-top .mark img', i => /board-mark\.png$/.test(i.src)));
    ok('gate: body carries the theme class', await page.$eval('body', b => b.classList.contains('rr')));
    ok('gate: no gold, no Google Fonts', !/logo-mark\.png|fonts\.googleapis|Montserrat|#efc24b/i.test(await page.content()));
    await page.click('#go');
    ok('gate: an empty e-mail asks for it', /work e-mail/.test(await page.textContent('#gerr')));
    await page.fill('#em', 'staff@example.com'); await page.fill('#pin', '9999'); await page.click('#go');
    await page.waitForFunction(() => /Wrong access code/.test(document.querySelector('#gerr').textContent));
    ok('gate: a wrong code is refused with the server\'s words', true);
    ok('gate: the button comes back after a refusal', await page.$eval('#go', b => !b.disabled && /Open my board/.test(b.textContent)));
    await page.screenshot({ path: path.join(SHOTS, 'gate-390.png'), fullPage: true });
    ok('gate: no page errors', !errors.length, errors.join(' | '));
    await context.close();
  }
  {
    const { page, context } = await open(390, 844, { boot: { ok: false, key: '', why: 'This board has no staff key set.' } });
    ok('gate: a board with no key says why and will not sign in', /no staff key/.test(await page.textContent('#gerr')) && await page.$eval('#go', b => b.disabled));
    await context.close();
  }

  /* ---------- as the branch, at three widths ---------- */
  for (const [w, h] of [[360, 740], [390, 844], [1366, 900]]) {
    const { page, context, errors } = await open(w, h);
    await signIn(page, 'admin@example.com', '1111');
    const tag = 'admin-' + w;
    ok(tag + ': signed in, gate gone', await page.isVisible('#app') && !(await page.isVisible('#gate')));
    ok(tag + ': who is signed in, in the top bar', (await page.textContent('#whoName')) === 'Rana Branchley' && (await page.textContent('#whoRole')) === 'The branch');
    ok(tag + ': as-of date shown', /Read 26 Oct 2026/.test(await page.textContent('#asof')));
    const pipe = await page.textContent('#pipe');
    ok(tag + ': pipeline stack drawn with its values in text', await page.$$eval('#pipe .rr-stack i', a => a.length) === 4 && /Need you now/.test(pipe) && /Renewed and paid/.test(pipe) && /17 renewals/.test(pipe), pipe);
    const tiles = await page.$$eval('.rr-tile[data-f]', a => a.map(t => t.dataset.f + ':' + t.querySelector('.cu .vh').textContent));
    ok(tag + ': six counting tiles carry the server counts', tiles.join() === 'act:10,owed:2,comprehensive:8,third-party:6,property:3,all:17', tiles.join());
    ok(tag + ': money still to collect shown', /TT\$3,300/.test(await page.textContent('#bandStats')));
    ok(tag + ': "need you now" is the opening filter', (await page.$$('.rb-row')).length === 10);
    const cols = await page.$$eval('#secComing .rr-cols .c', a => a.map(c => c.getAttribute('aria-label')));
    ok(tag + ': renewals coming as six week columns, values in text', cols.length === 6 && cols.every(x => /: \d+$/.test(x)), cols.join(' | '));
    ok(tag + ': coming-up sentence carries the figures', /in the next two weeks/.test(await page.textContent('#secComing')));
    ok(tag + ': by-line bars with counts', (await page.$$eval('#secLines .rr-bar .n', a => a.map(n => n.textContent))).join() === '8,6,3');
    const ag = await page.$$eval('#agents [data-agent]', a => a.map(b => b.dataset.agent));
    ok(tag + ': who is carrying what, with nobody named', ag.length === 3 && ag.includes('(nobody named)'), ag.join());
    ok(tag + ': section tabs include who carries what', (await page.$$('#tabs [data-go]')).length === 4);
    ok(tag + ': every row has days-to-go, a line icon and word, an ask',
      await page.$$eval('.rb-row', rs => rs.every(r => r.querySelector('.rb-when') && r.querySelector('.rb-line svg') && /Motor|Property/.test(r.querySelector('.rb-line').textContent) && r.querySelector('.rb-ask').textContent.trim().length > 5)));
    ok(tag + ': the most pressing is first (a renewal already past its date)', /days past|due today/.test(await page.$eval('.rb-row', r => r.textContent)));
    ok(tag + ': staff words for the ask', /Past its renewal date and not renewed/.test(await page.textContent('#list')));
    ok(tag + ': no sideways scroll', await noSideways(page));
    ok(tag + ': tap targets 44px+', await page.$$eval('.rb-acts .rr-btn, #go, .rr-tile[data-f]', a => a.filter(e => e.offsetParent).every(e => e.getBoundingClientRect().height >= 43.5)));

    // tiles filter
    await page.click('.rr-tile[data-f="property"]');
    ok(tag + ': property tile filters to property', (await page.$$('.rb-row')).length === 3 && await page.$$eval('.rb-row .rb-line', a => a.every(e => /Property/.test(e.textContent))));
    await page.click('.rr-tile[data-f="all"]');
    ok(tag + ': all tile shows every renewal', (await page.$$('.rb-row')).length === 17);
    await page.fill('#q', 'celia');
    ok(tag + ': search finds a client', (await page.$$('.rb-row')).length === 1);
    await page.fill('#q', 'zzzz');
    ok(tag + ': search with nothing says so', /Nothing matches/.test(await page.textContent('#list')));
    await page.fill('#q', '');
    // agent filter from the bars
    await page.click('#agents [data-agent="Mara Sample"]');
    await page.waitForTimeout(500);
    const mara = await page.$$eval('.rb-row', rs => rs.map(r => r.textContent));
    ok(tag + ': tapping an agent shows only their renewals', mara.length === 7 && mara.every(t => /Mara Sample/.test(t)), String(mara.length));
    await page.click('#clearF');
    ok(tag + ': "show everything" clears it', (await page.$$('.rb-row')).length === 17);

    if (w === 390 || w === 1366) {
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.screenshot({ path: path.join(SHOTS, tag + '.png'), fullPage: true });
    }
    ok(tag + ': no page errors', !errors.length, errors.join(' | '));
    await context.close();
  }

  /* ---------- as staff: a note and an assignment ---------- */
  {
    const { page, context, errors } = await open(390, 844);
    await signIn(page, 'staff@example.com', '2222');
    ok('staff: role reads Client Support', (await page.textContent('#whoRole')) === 'Client Support');
    ok('staff: who is carrying what is shown', await page.isVisible('#agents'));
    const first = await page.$eval('.rb-row [data-note]', b => b.dataset.note);
    await page.click(`[data-note="${first}"]`);
    ok('staff: log panel opens', await page.isVisible('#p_' + first));
    await page.fill(`#p_${first} textarea`, 'short');
    await page.click(`[data-save="${first}"]`);
    await page.waitForSelector(`#p_${first} .err`);
    ok('staff: a note under ten characters is refused', /ten characters/.test(await page.textContent(`#p_${first}`)));
    await page.fill(`#p_${first} textarea`, 'Called the client, renewing on Friday with the same cover.');
    await page.click(`[data-save="${first}"]`);
    await page.waitForFunction(() => window.__calls.filter(c => c[0] === 'renewalBoardData').length >= 2, null, { timeout: 5000 });
    ok('staff: the note is logged under their name', log.some(l => l[2] === 'note' && l[3] === 'Sasha Example' && /Friday/.test(l[4])));
    const tok = await page.$eval('.rb-row [data-assign]', b => b.dataset.assign);
    await page.click(`[data-assign="${tok}"]`);
    await page.fill(`#a_${tok} input`, 'Sasha Example');
    await page.click(`[data-assignsave="${tok}"]`);
    await page.waitForTimeout(400);
    ok('staff: assigning writes Assigned To through the board action', log.some(l => l[2] === 'assign' && /Assigned to Sasha Example/.test(l[4])));
    ok('staff: the call buttons are tel: links', await page.$$eval('.rb-acts a[href^="tel:"]', a => a.length > 0));
    ok('staff: no page errors', !errors.length, errors.join(' | '));
    await context.close();
  }

  /* ---------- as an agent: their own clients, nobody else's ---------- */
  for (const [w, h] of [[360, 740], [390, 844], [1366, 900]]) {
    const { page, context, errors } = await open(w, h);
    await signIn(page, 'agent@example.com', '3333');
    const tag = 'agent-' + w;
    ok(tag + ': greeted by first name', /Good (morning|afternoon|evening), Neil\./.test(await page.textContent('#hello')));
    ok(tag + ': role reads Your clients', (await page.textContent('#whoRole')) === 'Your clients');
    await page.click('.rr-tile[data-f="all"]');
    const names = await page.$$eval('.rb-row b.name', a => a.map(x => x.textContent));
    ok(tag + ': only their own clients (7)', names.length === 7 && !names.some(n => /Celia|Dev |Gita|Jo |Moe|Nia|Kai|Farid|Pia|Quin/.test(n)), names.join());
    ok(tag + ': no who-is-carrying-what for an agent', !(await page.isVisible('#agents')) && (await page.$$('#tabs [data-go]')).length === 3);
    ok(tag + ': agent words for the ask', /Cover has lapsed or is about to — call today|Confirm what the vehicle is worth now/.test(await page.textContent('#list')));
    ok(tag + ': no agent or assignment on the rows, no assign button', !/Agent:/.test(await page.textContent('#list')) && (await page.$$('[data-assign]')).length === 0);
    const top = await page.evaluate(() => ({ list: document.querySelector('#secList').getBoundingClientRect().top, side: document.querySelector('#side').getBoundingClientRect().top }));
    ok(tag + ': their clients come before the charts', w > 900 || top.list < top.side);
    ok(tag + ': no sideways scroll', await noSideways(page));
    // a client that is not theirs is refused on the server, whatever the page does
    const refused = await page.evaluate(() => new Promise(res => google.script.run.withSuccessHandler(() => res('allowed')).withFailureHandler(e => res(e.message))
      .renewalBoardAct('TESTKEY', 'agent@example.com', '3333', { what: 'note', token: 'm3', note: 'Trying a client that is not mine.' })));
    ok(tag + ': another agent\'s client refused', /not yours/.test(refused), refused);
    if (w !== 360) { await page.click('.rr-tile[data-f="act"]'); await page.evaluate(() => window.scrollTo(0, 0)); await page.screenshot({ path: path.join(SHOTS, tag + '.png'), fullPage: true }); }
    // sign out forgets the board
    await page.click('#out');
    ok(tag + ': sign-out forgets the board', await page.isVisible('#gate') && (await page.$$('.rb-row')).length === 0 && (await page.inputValue('#pin')) === '');
    ok(tag + ': no page errors', !errors.length, errors.join(' | '));
    await context.close();
  }

  /* ---------- reduced motion: nothing left invisible ---------- */
  {
    const { page, context, errors } = await open(390, 844, { reduce: true });
    await signIn(page, 'admin@example.com', '1111');
    await page.click('.rr-tile[data-f="all"]');
    const hidden = await page.evaluate(() => {
      const bad = [];
      document.querySelectorAll('#app *').forEach(el => {
        if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') return;
        const cs = getComputedStyle(el);
        if (parseFloat(cs.opacity) < 0.99 || cs.animationName !== 'none') bad.push(el.className || el.tagName);
      });
      return bad.slice(0, 8);
    });
    ok('reduced motion: nothing faded or still animating', hidden.length === 0, hidden.join());
    ok('reduced motion: counters show the true figure', await page.$eval('.rr-tile[data-f="all"] .v', v => /17/.test(v.innerText)));
    await page.screenshot({ path: path.join(SHOTS, 'reduced-390.png'), fullPage: true });
    ok('reduced motion: no page errors', !errors.length, errors.join(' | '));
    await context.close();
  }

  await browser.close();
  console.log('\n' + passes + ' passed, ' + fails + ' failed. Screenshots: ' + SHOTS);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
