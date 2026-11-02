// THE SIGN-IN SCREEN, which is where the branch actually got stuck.
//
// 29 October 2026, the day before the meeting: agents typed their number and
// were refused. Three faults behind one screen, and the existing e2e could
// not have seen any of them, because it skips the gate by planting a token.
//
//   1. pullRoster had never been run, so the People tab held one row and
//      every agent was correctly told they were not on the roll — with no
//      hint anywhere that it was one unrun step and not thirty bad numbers.
//   2. The page answered that refusal by revealing a password box. The
//      phone autofilled a saved portal password into it, the next tap sent
//      that stale password, and the refusal came back as "that agent number
//      and password do not match" — the agent's fault, apparently.
//   3. The box was inputmode="numeric", and some skill-bank numbers carry a
//      letter (A10024). On an iPhone that agent cannot type their number.
//
// Run: node tests/e2e-meetings-gate.js   (needs playwright + chromium)
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME_PATH || (() => {
  const tries = ['/opt/pw-browsers/chromium'];
  for (const d of (fs.existsSync('/opt/pw-browsers') ? fs.readdirSync('/opt/pw-browsers') : [])) {
    tries.push('/opt/pw-browsers/' + d + '/chrome-linux64/chrome',
               '/opt/pw-browsers/' + d + '/chrome-linux/chrome');
  }
  return tries.find(p => { try { return fs.statSync(p).isFile(); } catch (e) { return false; } }) || tries[0];
})();
const TYPES = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css',
                '.png':'image/png', '.svg':'image/svg+xml', '.jpg':'image/jpeg' };
const PORT = Number(process.env.PORT) || 8873;

let fails = 0;
const ok = (what, cond, extra) => {
  console.log((cond ? '  ok   ' : '  FAIL ') + what + (extra !== undefined && !cond ? '  — ' + extra : ''));
  if (!cond) fails++;
};

const server = http.createServer((req, res) => {
  let f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('no'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  res.end(fs.readFileSync(f));
});

/*  The backend as it stood on the night: one row on the People tab, so a
 *  real agent number is refused with the backend's own words.             */
const NOT_ON_ROLL = { ok: false,
  error: 'That agent number is not on the roll. Use 0000 to look in as a guest.' };

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const b = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });

  const open = async (roll, onLogin) => {
    const pg = await b.newPage({ viewport: { width: 390, height: 844 } });
    const sent = [];
    await pg.route('**script.google.com/**', async route => {
      const url = route.request().url();
      const j = x => route.fulfill({ status: 200, contentType: 'application/json',
                                     body: JSON.stringify(x) });
      if (route.request().method() === 'POST') {
        let body = {};
        try { body = JSON.parse(route.request().postData() || '{}'); } catch (e) {}
        sent.push(body);
        return j(onLogin ? onLogin(body) : NOT_ON_ROLL);
      }
      if (/action=ping/.test(url)) return j({ ok: true, roster: roll });
      return j({ ok: false, error: 'no' });
    });
    //  localhost, never 127.0.0.1: the session proxy bypasses the one and
    //  not the other, and the page then loads as chrome-error://chromewebdata.
    //  domcontentloaded, never networkidle: the page's fonts are fetched from
    //  Google and the network never goes idle behind the proxy.
    await pg.goto(`http://localhost:${PORT}/meetings/`, { waitUntil: 'domcontentloaded' });
    return { pg, sent };
  };

  console.log('\nTHE EMPTY ROLL SAYS SO');
  {
    const { pg } = await open({ onTheRoll: 1, canSignIn: 1, cannot: 0 });
    await pg.waitForTimeout(400);
    const t = await pg.textContent('#li-roll');
    ok('the gate says the branch list has not been pulled across', /not been pulled/i.test(t), t);
    ok('and tells the agent it is not their number', /not your number/i.test(t));
    ok('and gives them a way in tonight', /0000/.test(t));
    ok('and names the step the branch manager has to run', /pullRoster/.test(t));
    await pg.close();
  }
  {
    const { pg } = await open({ onTheRoll: 26, canSignIn: 26, cannot: 0 });
    await pg.waitForTimeout(400);
    const t = (await pg.textContent('#li-roll')) || '';
    ok('and says nothing at all once the roll is pulled', t.trim() === '', JSON.stringify(t));
    await pg.close();
  }

  console.log('\nA REFUSAL NEVER ASKS FOR A PASSWORD');
  {
    const { pg, sent } = await open({ onTheRoll: 1, canSignIn: 1, cannot: 0 });
    await pg.fill('#li-email', '12663');
    await pg.click('#li-go');
    await pg.waitForTimeout(500);

    ok('the first try carries no password at all',
      sent.length === 1 && !('password' in sent[0]) && !('pin' in sent[0]),
      JSON.stringify(sent[0]));
    ok('and sends the number as who', sent[0] && sent[0].who === '12663');

    const pin = await pg.$('#li-pin');
    const type = pin && await pin.getAttribute('type');
    ok('no password box appears after the refusal', type === 'hidden', String(type));
    ok('and none is visible anywhere on the screen',
      (await pg.$$('input[type=password]:visible')).length === 0);

    const msg = await pg.textContent('#li-msg');
    ok('the message is the backend\'s own words', /not on the roll/i.test(msg), msg);
    ok('and never blames their password', !/password/i.test(msg), msg);
    ok('and tells them whose fault it is', /not yours/i.test(msg), msg);
    ok('and points them at the guest number', /0000/.test(msg));

    //  Tapping again must not start sending a password either: that is what
    //  turns on the backend's lockout counter, five taps to fifteen minutes.
    await pg.click('#li-go');
    await pg.waitForTimeout(400);
    ok('tapping again still carries no password',
      sent.length === 2 && !('password' in sent[1]), JSON.stringify(sent[1]));
    await pg.close();
  }

  console.log('\nTHE NUMBER ON THE CARD CAN BE TYPED');
  {
    const { pg } = await open({ onTheRoll: 26, canSignIn: 26, cannot: 0 });
    const im = await pg.getAttribute('#li-email', 'inputmode');
    ok('the box is not a number pad, so A10024 can be typed', im !== 'numeric', String(im));
    await pg.fill('#li-email', 'A10024');
    ok('and a letter-prefixed number goes in', (await pg.inputValue('#li-email')) === 'A10024');
    const fs16 = await pg.$eval('#li-email', el => parseFloat(getComputedStyle(el).fontSize));
    ok('and is 16px or more, so iOS does not zoom in on it', fs16 >= 16, String(fs16));
    await pg.close();
  }

  console.log('\nAND IT STILL LETS THE RIGHT PERSON IN');
  {
    const { pg, sent } = await open({ onTheRoll: 26, canSignIn: 26, cannot: 0 }, body =>
      body.action === 'login'
        ? { ok: true, token: 'tok-x', user: { name: 'Agent One', role: 'agent' } }
        : { ok: true, user: { name: 'Agent One', role: 'agent' }, meetings: [], actionCounts: {} });
    await pg.fill('#li-email', '12663');
    await pg.click('#li-go');
    await pg.waitForTimeout(600);
    ok('the gate closes on a good number', await pg.isHidden('#gate'));
    ok('and the number alone was all that was sent',
      sent[0] && sent[0].who === '12663' && !('password' in sent[0]));
    await pg.close();
  }

  const errs = [];
  {
    const { pg } = await open({ onTheRoll: 1, canSignIn: 1, cannot: 0 });
    pg.on('pageerror', e => errs.push(String(e)));
    await pg.fill('#li-email', '12663');
    await pg.click('#li-go');
    await pg.waitForTimeout(500);
    ok('no script errors on the gate', errs.length === 0, errs.join(' | '));
    const w = await pg.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    ok('nothing runs off a phone', w <= 1, String(w));
    await pg.close();
  }

  /* ── 0000 ASKS WHO IS AT THE DOOR ──
     The code is published in the branch WhatsApp group, so this is the first
     thing a visitor meets. It must read as a welcome, not a refusal, and it
     must end with the branch knowing who looked in. */
  {
    console.log('\n0000 ASKS WHO IS LOOKING IN');
    const { pg, sent } = await open({ onTheRoll: 19, canSignIn: 19, cannot: 0 }, body => {
      if (String(body.who).replace(/\s+/g, '') !== '0000') return NOT_ON_ROLL;
      const name = [body.firstName, body.lastName].filter(Boolean).join(' ').trim();
      if (!name) return { ok: false, needGuest: true,
        error: 'Welcome. Tell us your name and your role, so the branch knows who looked in.' };
      if (!body.jobTitle) return { ok: false, needGuest: true, haveName: name,
        error: 'And your role, so we know who we had with us.' };
      return { ok: true, token: 'tok-guest',
               user: { email: 'gregg.mannette@guest.invalid', name: name,
                       role: 'guest', unit: '', staff: false } };
    });
    const errs = [];
    pg.on('pageerror', e => errs.push(String(e)));

    const vis = () => pg.$eval('#li-guest', e => getComputedStyle(e).display);
    ok('the name boxes are hidden until 0000 is typed', (await vis()) === 'none');

    await pg.fill('#li-email', '0000');
    await pg.click('#li-go');
    await pg.waitForFunction(
      () => getComputedStyle(document.getElementById('li-guest')).display !== 'none',
      null, { timeout: 5000 }).catch(() => {});

    ok('typing 0000 brings up the boxes', (await vis()) !== 'none');
    const msg = (await pg.textContent('#li-msg')).trim();
    ok('it welcomes rather than refusing', /welcome/i.test(msg), msg);
    ok('it does not read as a failure', !/not match|did not work|wrong/i.test(msg), msg);
    ok('the button says what it does now',
      /look in/i.test((await pg.textContent('#li-go')).trim()),
      (await pg.textContent('#li-go')).trim());
    ok('there are three boxes: first, last and role',
      (await pg.$$('#li-guest input')).length === 3);
    ok('and no password box appeared',
      (await pg.$$('#gate-login input[type=password]')).length === 0);

    await pg.fill('#gu-first', 'Gregg');
    await pg.fill('#gu-last', 'Mannette');
    await pg.click('#li-go');
    await pg.waitForTimeout(500);
    ok('a name with no role is asked for the role',
      /role/i.test((await pg.textContent('#li-msg')).trim()),
      (await pg.textContent('#li-msg')).trim());
    ok('and the boxes are still up', (await vis()) !== 'none');

    await pg.fill('#gu-job', 'Head of Agency');
    await pg.click('#li-go');
    await pg.waitForFunction(
      () => getComputedStyle(document.getElementById('gate')).display === 'none',
      null, { timeout: 8000 }).catch(() => {});
    ok('name and role let them in',
      (await pg.$eval('#gate', e => getComputedStyle(e).display)) === 'none');

    const last = sent[sent.length - 1];
    ok('the name was sent', last.firstName === 'Gregg' && last.lastName === 'Mannette',
      JSON.stringify(last));
    ok('the role was sent', last.jobTitle === 'Head of Agency', JSON.stringify(last));
    ok('and never a password', !last.password && !last.pin && !last.code,
      JSON.stringify(last));
    ok('no script errors on the visitor path', errs.length === 0, errs.join(' | '));
    await pg.close();
  }

  /* ── and the boxes come back down for the next person ── */
  {
    console.log('\nTHE GATE COMES BACK CLEAN');
    const { pg } = await open({ onTheRoll: 19, canSignIn: 19, cannot: 0 }, body =>
      String(body.who).replace(/\s+/g, '') === '0000'
        ? { ok: false, needGuest: true, error: 'Welcome. Tell us your name and your role.' }
        : NOT_ON_ROLL);
    await pg.fill('#li-email', '0000');
    await pg.click('#li-go');
    await pg.waitForTimeout(600);
    ok('the boxes are up',
      (await pg.$eval('#li-guest', e => getComputedStyle(e).display)) !== 'none');
    await pg.fill('#gu-first', 'Somebody');
    //  A phone in the branch is handed round, and showGate is what every
    //  route back to the door goes through.
    await pg.evaluate(() => showGate('login'));
    ok('they come back down for the next person',
      (await pg.$eval('#li-guest', e => getComputedStyle(e).display)) === 'none');
    ok('and the half-typed name is gone',
      (await pg.$eval('#gu-first', e => e.value)) === '');
    ok('and the button says Sign in again',
      /sign in/i.test((await pg.textContent('#li-go')).trim()));
    await pg.close();
  }

  await b.close();
  server.close();
  console.log(fails ? `\n${fails} FAILED` : '\nall passing');
  process.exit(fails ? 1 : 0);
})();
