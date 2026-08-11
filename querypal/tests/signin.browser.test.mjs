/* The sign-in flow in a real browser with the webhook intercepted: verifies
   credentials leave over POST (not in the URL) and the token drives the dash. */
import { createRequire } from 'module';
import path from 'path';
const { chromium } = createRequire(import.meta.url)('/opt/node22/lib/node_modules/playwright');
const HERE = path.dirname(new URL(import.meta.url).pathname);

const browser = await chromium.launch();
const page = await browser.newPage();
const errors = []; page.on('pageerror', e => errors.push(String(e)));

const seen = [];
await page.route('**/macros/s/**', async route => {
  const req = route.request();
  const url = req.url(), method = req.method();
  let body = null; try { body = req.postData(); } catch {}
  seen.push({ url, method, body });
  if (method === 'POST' && (body || '').includes('agentauth'))
    return route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ ok: true, token: 'TOK-abc123', code: 'AE101',
                             name: 'Aidan Eugene', email: 'aidan@x.com', role: 'manager' }) });
  if (url.includes('myqueries'))
    return route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ ok: true, role: 'manager', name: 'Aidan Eugene',
                             counts: { open: 0, done: 0, total: 0 }, rows: [] }) });
  return route.fulfill({ status: 200, contentType: 'application/json', body: '{"ok":true}' });
});
await page.goto('file://' + path.join(HERE, '..', 'index.html'));

let pass = 0, fail = 0;
const t = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log((ok?'  PASS  ':'  FAIL  ')+label+(ok?'':`\n          got  ${JSON.stringify(got)}\n          want ${JSON.stringify(want)}`));
  ok ? pass++ : fail++;
};

await page.evaluate(() => openGate());
await page.fill('#agentNum', 'AE101');
await page.fill('#agentCode', 'Sunshine1');
await page.click('#agentGo');
await page.waitForFunction(() => window.agentAuth !== null, null, { timeout: 5000 });

const auth = seen.find(r => (r.body || '').includes('agentauth'));
t('sign-in used POST', auth.method, 'POST');
t('password is NOT in the request URL', /Sunshine1/.test(auth.url), false);
t('agent number is NOT in the request URL', /AE101/.test(auth.url), false);
t('credentials travel in the body', JSON.parse(auth.body).pwd, 'Sunshine1');
t('session token stored', await page.evaluate(() => agentAuth.token), 'TOK-abc123');
t('role captured', await page.evaluate(() => agentAuth.role), 'manager');

await page.evaluate(() => { openDash(); });

await page.waitForTimeout(400);
const dash = seen.find(r => r.url.includes('myqueries'));
t('dashboard sends the token', /token=TOK-abc123/.test(dash.url), true);

// a rejected sign-in must not create a session
await page.evaluate(() => { closeDash(); agentAuth = null; });   // dash modal would block the gate
await page.unroute('**/macros/s/**');
await page.route('**/macros/s/**', route => route.fulfill({ status: 200,
  contentType: 'application/json', body: JSON.stringify({ ok: false, why: 'pwd' }) }));
await page.evaluate(() => openGate());
await page.fill('#agentNum', 'AE101');
await page.fill('#agentCode', 'wrong');
await page.click('#agentGo');
await page.waitForTimeout(500);
t('wrong password leaves you signed out', await page.evaluate(() => agentAuth), null);
t('wrong password is explained',
  (await page.locator('#gateOut').innerText()).includes("doesn't match"), true);

// server-side throttle message
await page.unroute('**/macros/s/**');
await page.route('**/macros/s/**', route => route.fulfill({ status: 200,
  contentType: 'application/json', body: JSON.stringify({ ok: false, why: 'rate' }) }));
await page.click('#agentGo');
await page.waitForTimeout(500);
t('throttle message shown',
  (await page.locator('#gateOut').innerText()).includes('ten minutes'), true);

// no password on file yet
await page.unroute('**/macros/s/**');
await page.route('**/macros/s/**', route => route.fulfill({ status: 200,
  contentType: 'application/json', body: JSON.stringify({ ok: false, why: 'nopw' }) }));
await page.click('#agentGo');
await page.waitForTimeout(500);
t('missing-password message points at the branch',
  (await page.locator('#gateOut').innerText()).includes('No password is set'), true);

t('no page errors', errors, []);
await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
