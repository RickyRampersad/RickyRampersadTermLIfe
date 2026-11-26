// The CV on the two recruiting pages, when the backend cannot keep it.
//
// Why this exists. From 19 to 26 November 2026 the personal assistant's page
// offered a CV upload that the live Quotes.gs did not know about: every file
// attached was thrown away, and the applicant was told so only after sending
// ("the CV did not come through"). Applicants reported the upload as broken,
// and one e-mailed his CV at 3:38am because of it.
//
// So both pages now ask the backend's ping on load. Without `cv: 1` they hide
// the upload and ask for the CV by e-mail, and the gate lets the form through
// without a file. With `cv: 1` the upload stays exactly as it was. A ping that
// does not answer leaves the upload too.
//
// Run: node tests/e2e-cv-email-mode.js     (nothing is filed: Apps Script is mocked)
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : undefined);
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

/* ping: 'old' = the live backend before the paste (no cv), 'cv' = cv:1, 'dead' = no answer */
async function open(br, url, ping, w = 390) {
  const p = await br.newPage({ viewport: { width: w, height: 860 } });
  const st = { posted: false, body: null, errs: [] };
  p.on('pageerror', e => st.errs.push(e.message));
  await p.route('**/script.google.com/**', async r => {
    const q = r.request();
    if (q.method() === 'POST') {
      st.posted = true;
      try { st.body = JSON.parse(q.postData() || '{}'); } catch (e) {}
      return r.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ ok: true, ref: 'TEST-0001', cv: !!(st.body && st.body.cv) }) });
    }
    if (/action=q\.ping/.test(q.url())) {
      if (ping === 'dead') return r.abort();
      const x = { ok: true, forms: ['admin', 'underwriter'], quotes: 1, hiring: 1 };
      if (ping === 'cv') x.cv = 1;
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(x) });
    }
    return r.fulfill({ status: 200, contentType: 'image/gif',
      body: Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64') });
  });
  await p.goto(B + url, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(900);
  return { p, st };
}

const put = (p, n, v) => p.evaluate(([n, v]) => {
  const els = [...document.querySelectorAll('[name="' + n + '"]')];
  if (!els.length) return false;
  const e = els[0];
  if (e.type === 'radio' || e.type === 'checkbox') { e.checked = true; e.dispatchEvent(new Event('change', { bubbles: true })); return true; }
  if (e.tagName === 'SELECT') { e.selectedIndex = 1; e.dispatchEvent(new Event('change', { bubbles: true })); return true; }
  e.value = v; e.dispatchEvent(new Event('input', { bubbles: true })); e.dispatchEvent(new Event('change', { bubbles: true })); return true;
}, [n, v]);

const ADMIN = { name: 'Test Applicant', phone: '868 555 0100', email: 't@example.com', town: 'Chaguanas',
  travel: 'x', exp: 'x', emp_co: 'Example Ltd', emp_role: 'Administrator', emp_dates: 'March 2023 - now',
  emp_changed: LONG, edu: 'CXC', pay_now: 'x', pay_want: 'x', start: 'x',
  w_built: LONG, w_slim: LONG, w_cv: LONG };
const CM = { name: 'Test Applicant', phone: '868 555 0100', email: 't@example.com', town: 'Chaguanas',
  uw_door: 'x', uw_years: 'x', cls: 'x', uw_auth: 'x', uw_systems: 'AS400 and Salesforce',
  uw_uwexp: 'x', uw_uwwhere: 'Guardian, 6 years', uw_quals: 'ACII part',
  emp_co: 'Example Ltd', emp_role: 'Underwriter', pay_now: 'x', pay_want: 'x', start: 'x',
  uw_declined: LONG, uw_endorse: LONG, uw_right: LONG, uw_stopped: LONG, uw_learned: LONG, uw_renewals: LONG };
const PAGES = [
  { key: 'admin', url: '/buildwithus/', base: ADMIN, err: '#jErr', done: '#jDone', addr: 'support@rickyrampersadbranch.com' },
  { key: 'cm', url: '/clientmanager/', base: CM, err: '#uErr', done: '#uDone', addr: 'Ricky.Rampersad@myguardiangroup.com' }
];

async function send(p) {
  const btn = await p.$('#jSend, button[type=submit]');
  await btn.scrollIntoViewIfNeeded(); await btn.click();
  await p.waitForTimeout(900);
  const asIs = await p.$('#jRev:not([hidden]) [data-send]');
  if (asIs) await asIs.click();
  await p.waitForTimeout(1300);
}
const fileShown = p => p.evaluate(() => { const f = document.querySelector('input[type=file]');
  if (!f) return false; let e = f; while (e) { if (e.hidden) return false; e = e.parentElement; } return f.offsetParent !== null; });

(async () => {
  await new Promise(r => server.listen(0, 'localhost', r));
  B = 'http://localhost:' + server.address().port;
  const br = await chromium.launch(CHROME ? { executablePath: CHROME } : {});

  for (const pg of PAGES) {
    /* 1. the backend cannot keep a CV: the page asks for it by e-mail */
    {
      const { p, st } = await open(br, pg.url, 'old');
      console.log('· ' + pg.url + ' — backend without CV support');
      ok('  the upload is hidden', !(await fileShown(p)));
      const hint = await p.evaluate(() => { const f = document.querySelector('input[type=file]');
        const s = f && f.closest('[data-sec]'); const h = s && s.querySelector('.hint'); return h ? h.textContent : ''; });
      ok('  the page says to e-mail the CV', /by e-mail/.test(hint) && hint.indexOf(pg.addr) > -1, hint.slice(0, 90));
      for (const k of Object.keys(pg.base)) await put(p, k, pg.base[k]);
      await p.waitForTimeout(250);
      await send(p);
      const red = await p.$eval(pg.err, e => e.classList.contains('on') ? e.textContent.trim() : '').catch(() => '');
      ok('  it files with no file attached', st.posted, red);
      ok('  no CV travels', st.posted && !st.body.cv);
      const f = (st.body && st.body.fields || []).find(x => x.k === 'cv_later');
      ok('  the row says the CV is to follow', !!(f && /e-mail/.test(f.value)), f ? f.value : 'no field');
      const done = await p.$eval(pg.done, e => e.textContent).catch(() => '');
      ok('  the done screen gives the last step', /One last step: your CV/.test(done) && done.indexOf('TEST-0001') > -1 && done.indexOf(pg.addr) > -1, done.slice(0, 120));
      ok('  it does not say the CV failed', !/did not (come through|attach)/.test(done));
      ok('  no script errors', st.errs.length === 0, st.errs[0] || '');
      await p.close();
    }
    /* 2. the backend keeps CVs: the upload is there and the file travels */
    {
      const { p, st } = await open(br, pg.url, 'cv', 1280);
      console.log('· ' + pg.url + ' — backend with CV support');
      ok('  the upload is shown', await fileShown(p));
      for (const k of Object.keys(pg.base)) await put(p, k, pg.base[k]);
      await p.setInputFiles('input[type=file]', { name: 'cv.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 test') });
      await p.waitForTimeout(250);
      await send(p);
      ok('  it files', st.posted);
      ok('  the CV travels', !!(st.body && st.body.cv && /^data:application\/pdf/.test(st.body.cv.data)));
      const done = await p.$eval(pg.done, e => e.textContent).catch(() => '');
      ok('  the done screen says the CV went', /CV went with it/.test(done), done.slice(0, 120));
      ok('  no script errors', st.errs.length === 0, st.errs[0] || '');
      await p.close();
    }
    /* 3. the ping does not answer: the upload stays */
    {
      const { p, st } = await open(br, pg.url, 'dead');
      console.log('· ' + pg.url + ' — ping does not answer');
      ok('  the upload stays', await fileShown(p));
      ok('  no script errors', st.errs.length === 0, st.errs[0] || '');
      await p.close();
    }
  }
  await br.close(); server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
  process.exit(fails ? 1 : 0);
})();
