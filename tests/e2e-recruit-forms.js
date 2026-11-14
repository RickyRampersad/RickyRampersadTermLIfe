// The two recruiting applications that file through Quotes.gs: the administrator's
// (/buildwithus/, form key 'admin', QB-) and the client manager's (/clientmanager/,
// form key 'underwriter', QU-).
//
// Why this exists. Reported on 14 November 2026: the administrator's form would not
// send and showed a red line. The gate, the progress rail and the scroll-to-the-field
// each kept their own idea of what counts as answered, so an answer the gate refused
// could be one the rail called complete — and the scroll, which asks the RAIL which
// field is empty, then found nothing wrong and did not move. The page said "18 of 18
// answered · ready to send", refused, restated a question the person had just answered,
// and sat still. Pressing again did the same thing for ever.
//
// So every check here is about those three agreeing:
//   * whatever refuses the form is the field that gets focused;
//   * the rail never says "ready to send" about something the gate will refuse;
//   * a too-short answer is told it is too short, not asked the question again;
//   * every field with a minimum says so while the person is typing.
//
// Run: node tests/e2e-recruit-forms.js     (needs playwright + a chromium on disk)
// Nothing is filed: the POST to Apps Script is intercepted and answered locally.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : '/opt/pw-browsers/chromium-1194/chrome-linux/chrome');
const TYPE = { '.html': 'text/html', '.svg': 'image/svg+xml', '.css': 'text/css', '.js': 'text/javascript',
               '.jpg': 'image/jpeg', '.png': 'image/png', '.mp4': 'video/mp4' };
const server = http.createServer((q, r) => {
  let f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { r.writeHead(404); return r.end('no'); }
  r.writeHead(200, { 'Content-Type': TYPE[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(r);
});
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  — ' + x : '')); if (!c) fails++; };

const LONG = 'A real sentence that is comfortably past every minimum length this form asks for, written out.';
let B = '';

/* the browser, with the Apps Script POST answered here so nothing is ever filed */
async function open(br, url, w = 390) {
  const p = await br.newPage({ viewport: { width: w, height: 860 } });
  const state = { posted: false, errs: [] };
  p.on('pageerror', e => state.errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') state.errs.push(m.text()); });
  await p.route('**/script.google.com/**', async r => {
    state.posted = true;
    await r.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true,"ref":"TEST-0001"}' });
  });
  await p.goto(B + url, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(800);
  return { p, state };
}

/* set a field whatever kind it is, the way a person would */
const put = (p, n, v) => p.evaluate(([n, v]) => {
  const els = [...document.querySelectorAll('[name="' + n + '"]')];
  if (!els.length) return false;
  const e = els[0];
  if (e.type === 'radio' || e.type === 'checkbox') { e.checked = true; e.dispatchEvent(new Event('change', { bubbles: true })); return true; }
  if (e.tagName === 'SELECT') { e.selectedIndex = 1; e.dispatchEvent(new Event('change', { bubbles: true })); return true; }
  e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); return true;
}, [n, v]);

const read = async (p, sel, fn, dflt) => { try { return await p.$eval(sel, fn); } catch (e) { return dflt; } };

async function submit(p) {
  const btn = await p.$('#jSend, button[type=submit]');
  await btn.scrollIntoViewIfNeeded();
  await p.waitForTimeout(150);
  await btn.click();
  await p.waitForTimeout(900);
}

/* ─────────── the administrator ─────────── */
const ADMIN = { name: 'Test Applicant', phone: '868 555 0100', email: 't@example.com', town: 'Chaguanas',
  travel: 'x', exp: 'x', emp_co: 'Example Ltd', emp_role: 'Administrator', emp_dates: 'March 2023 - now',
  emp_changed: LONG, edu: 'CXC', pay_now: 'x', pay_want: 'x', start: 'x',
  w_built: LONG, w_slim: LONG, w_cv: LONG };

/* ─────────── the client manager ─────────── */
const CM = { name: 'Test Applicant', phone: '868 555 0100', email: 't@example.com', town: 'Chaguanas',
  uw_door: 'x', uw_years: 'x', cls: 'x', uw_auth: 'x', uw_systems: 'AS400 and Salesforce',
  uw_uwexp: 'x', uw_uwwhere: 'Guardian, 6 years', uw_quals: 'ACII part',
  emp_co: 'Example Ltd', emp_role: 'Underwriter', pay_now: 'x', pay_want: 'x', start: 'x',
  uw_declined: LONG, uw_endorse: LONG, uw_right: LONG, uw_stopped: LONG, uw_learned: LONG, uw_renewals: LONG };

const FORMS = {
  admin: { url: '/buildwithus/', err: '#jErr', base: ADMIN, cv: false,
           min: { emp_changed: 20, w_built: 40, w_slim: 40, w_cv: 10 } },
  cm:    { url: '/clientmanager/', err: '#uErr', base: CM, cv: true,
           min: { uw_declined: 40, uw_endorse: 40, uw_right: 40, uw_stopped: 40, uw_learned: 30, uw_renewals: 30 } }
};

async function fill(p, form, overrides) {
  const v = Object.assign({}, form.base, overrides || {});
  for (const k of Object.keys(v)) if (v[k] !== null) await put(p, k, v[k]);
  if (form.cv) {
    const f = await p.$('input[type=file]');
    if (f) await p.setInputFiles('input[type=file]', { name: 'cv.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 test') });
  }
  await p.waitForTimeout(250);
}

/* one refusal: it must say what is wrong, go to the field at fault, and not
   have claimed the form was ready */
async function refuses(br, key, label, overrides, want) {
  const form = FORMS[key];
  const { p, state } = await open(br, form.url);
  await fill(p, form, overrides);
  const railS = await read(p, '#railS', e => e.textContent.trim(), '');
  await submit(p);
  const red = await read(p, form.err, e => e.classList.contains('on') ? e.textContent.trim() : '', '');
  const focus = await p.evaluate(() => (document.activeElement || {}).name || (document.activeElement || {}).id || '');
  console.log('· ' + label);
  ok('  it refuses rather than filing', !state.posted);
  ok('  a red line says why', !!red, red);
  ok('  it takes you to ' + want.focus, focus === want.focus, 'focus was ' + (focus || 'nothing'));
  ok('  the rail does not say "ready to send"', railS !== 'ready to send', railS);
  if (want.red) ok('  the message names the fault', new RegExp(want.red).test(red), red);
  ok('  no script errors', state.errs.length === 0, state.errs[0] || '');
  await p.close();
}

async function sends(br, key, label) {
  const form = FORMS[key];
  const { p, state } = await open(br, form.url, 1280);
  await fill(p, form, {});
  const railS = await read(p, '#railS', e => e.textContent.trim(), '');
  await submit(p);
  await p.waitForTimeout(1200);
  const red = await read(p, form.err, e => e.classList.contains('on') ? e.textContent.trim() : '', '');
  console.log('· ' + label);
  ok('  a complete application files', state.posted);
  ok('  no red line', !red, red);
  ok('  the rail says it is ready', railS === 'ready to send', railS);
  ok('  no script errors', state.errs.length === 0, state.errs[0] || '');
  await p.close();
}

/* a minimum nobody is told about is a minimum that reads as the page refusing
   for no reason, so every field in MIN must carry a counter that says it */
async function counters(br, key) {
  const form = FORMS[key];
  const { p } = await open(br, form.url);
  console.log('· ' + form.url + ' — every minimum is stated while they type');
  for (const n of Object.keys(form.min)) {
    const m = form.min[n];
    const row = () => p.evaluate(nm => {
      const e = document.querySelector('[name="' + nm + '"]');
      const cc = e && e.parentNode.querySelector('.cc');
      return cc ? cc.innerText.replace(/\s+/g, ' ').trim() : null;
    }, n);
    const empty = await row();
    ok('  ' + n + ' has a counter at all', empty !== null);
    if (empty === null) continue;
    ok('  ' + n + ' empty says "about ' + m + ' characters"', new RegExp('about ' + m + ' characters').test(empty), empty);
    await put(p, n, 'x'.repeat(Math.max(1, m - 7)));
    await p.waitForTimeout(120);
    ok('  ' + n + ' short says how many more', /\b7 more\b/.test(await row()), await row());
    await put(p, n, 'x'.repeat(m + 5));
    await p.waitForTimeout(120);
    const done = await row();
    ok('  ' + n + ' says nothing once met', !/more|about \d+ char/.test(done), done);
  }
  await p.close();
}

/* the page must not scroll sideways once the "N more" line is showing. Attempt
   the scroll and read scrollX: scrollWidth is the wrong measure in both
   directions where anything carries overflow clipping. */
async function noSideways(br, key) {
  const form = FORMS[key];
  console.log('· ' + form.url + ' — no sideways scroll with the counters showing');
  for (const w of [360, 375, 390, 414, 1280, 1536]) {
    const { p } = await open(br, form.url, w);
    await p.evaluate(() => [...document.querySelectorAll('textarea')].forEach(t => {
      t.value = 'short'; t.dispatchEvent(new Event('input', { bubbles: true }));
    }));
    await p.waitForTimeout(200);
    const x = await p.evaluate(() => { window.scrollTo(9999, 0); const v = window.scrollX; window.scrollTo(0, 0); return v; });
    ok('  ' + w + 'px', x === 0, 'scrollX ' + x);
    await p.close();
  }
}

(async () => {
  await new Promise(r => server.listen(0, r));
  B = 'http://localhost:' + server.address().port;
  const br = await chromium.launch({ executablePath: fs.existsSync(CHROME) ? CHROME : undefined });

  console.log('\n══ the administrator — /buildwithus/ ══');
  // the reported fault, exactly: 9 characters where the gate wants 10
  await refuses(br, 'admin', 'THE REPORTED FAULT: "IT skills" in the CV question (9 of 10)',
    { w_cv: 'IT skills' }, { focus: 'w_cv', red: 'little more' });
  await refuses(br, 'admin', 'a short answer on what they built (20 of 40)',
    { w_built: 'A petty cash tracker' }, { focus: 'w_built', red: 'little more' });
  await refuses(br, 'admin', 'a short answer on what changed at that job (13 of 20)',
    { emp_changed: 'Faster filing' }, { focus: 'emp_changed', red: 'little more' });
  await refuses(br, 'admin', 'a letter in the phone box', { phone: 'call me' }, { focus: 'phone' });
  await refuses(br, 'admin', 'an e-mail with no domain', { email: 'me@home' }, { focus: 'email' });
  await refuses(br, 'admin', 'the CV question left empty', { w_cv: '' }, { focus: 'w_cv', red: 'CV in two years' });
  await sends(br, 'admin', 'a complete application');
  await counters(br, 'admin');
  await noSideways(br, 'admin');

  console.log('\n══ the client manager — /clientmanager/ ══');
  await refuses(br, 'cm', 'a short written answer goes to THAT question, not the first one',
    { uw_right: 'It was close' }, { focus: 'uw_right', red: 'little more' });
  await refuses(br, 'cm', 'what they taught themselves, at 20 of 30',
    { uw_learned: 'x'.repeat(20) }, { focus: 'uw_learned', red: 'little more' });
  await refuses(br, 'cm', 'a letter in the phone box', { phone: 'call me' }, { focus: 'phone' });
  await sends(br, 'cm', 'a complete application');
  await counters(br, 'cm');
  await noSideways(br, 'cm');

  await br.close();
  server.close();
  console.log('\n' + (fails ? fails + ' FAILED' : 'all passed'));
  process.exit(fails ? 1 : 0);
})();
