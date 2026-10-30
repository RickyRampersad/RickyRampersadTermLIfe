// Shoot the REAL meetings gate for the sign-in film. Backend fully mocked, so
// nothing is written to the live sheet. Agent number and name are invented:
// no real agent number goes into an MP4.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = '/home/user/RickyRampersadTermLIfe';
const OUT = process.argv[2];
const CHROME = '/opt/pw-browsers/chromium';
const TYPES = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css',
                '.png':'image/png', '.svg':'image/svg+xml', '.jpg':'image/jpeg' };
const PORT = 8891;

const AGENT = 'A10072', WHO = 'Marcus Alleyne';
const MTG = { id: 'M1', title: 'Branch Meeting', type: 'Branch', date: 'Friday 30 October 2026',
              dateISO: '2026-10-30', start: '12:00', location: 'Branch boardroom',
              status: 'scheduled', week: 'Week 5', checkInOpen: true,
              checkInOpensAt: 'at 11:30', checkInClosesAt: 'at 12:30' };

const server = http.createServer((req, res) => {
  let f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('no'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  res.end(fs.readFileSync(f));
});

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const b = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  let here = false;   // has the mocked person pressed "I am here"?

  const open = async () => {
    const pg = await b.newPage({ viewport: { width: 390, height: 844 }, deviceScaleFactor: 2 });
    await pg.route('**script.google.com/**', async route => {
      const url = route.request().url();
      const j = x => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(x) });
      if (route.request().method() === 'POST') {
        let bd = {}; try { bd = JSON.parse(route.request().postData() || '{}'); } catch (e) {}
        if (bd.action === 'login') {
          if (/^0+$/.test(String(bd.who || '').trim())) {
            const nm = [bd.firstName, bd.lastName].filter(Boolean).join(' ').trim();
            if (!nm) return j({ ok: false, needGuest: true,
              error: 'Welcome. Tell us your name and your role, so the branch knows who looked in.' });
            if (!String(bd.jobTitle || '').trim()) return j({ ok: false, needGuest: true, haveName: nm,
              error: 'And your role, so we know who we had with us.' });
            return j({ ok: true, token: 'tk', user: { name: nm, role: 'guest' } });
          }
          return j({ ok: true, token: 'tk', user: { name: WHO, role: 'agent' } });
        }
        if (bd.action === 'checkIn') { here = true; return j({ ok: true, status: 'present', signedIn: '11:52' }); }
        return j({ ok: true });
      }
      if (/action=ping/.test(url))  return j({ ok: true, roster: { onTheRoll: 19, canSignIn: 19, cannot: 0 } });
      if (/action=home/.test(url)) {
        const m = Object.assign({}, MTG, here ? { me: { status: 'present', signedIn: '11:52' } } : {});
        return j({ ok: true, user: { name: WHO, role: 'agent' }, next: m, meetings: [m], actionCounts: {} });
      }
      return j({ ok: false, error: 'no' });
    });
    await pg.goto(`http://localhost:${PORT}/meetings/`, { waitUntil: 'domcontentloaded' });
    await pg.waitForTimeout(900);
    return pg;
  };

  const shot = async (pg, name) => {
    await pg.waitForTimeout(450);
    await pg.screenshot({ path: path.join(OUT, name + '.png') });
    console.log('  shot ' + name);
  };
  //  A phone at 272px in a 1280 frame puts the field they must type into at
  //  about 10px tall, which nobody reads. The card on its own, cropped tight
  //  by the element itself, is what the instruction actually needs.
  const card = async (pg, sel, name) => {
    await pg.waitForTimeout(450);
    const el = await pg.$(sel);
    if (!el) throw new Error('no element ' + sel + ' for ' + name);
    await el.screenshot({ path: path.join(OUT, name + '.png') });
    console.log('  card ' + name + '  (' + sel + ')');
  };

  // 1-4: the agent's path
  let pg = await open();
  await shot(pg, '01-gate');
  await pg.fill('#li-email', AGENT);
  await shot(pg, '02-typed');
  await card(pg, '.gate-card', 'c-typed');
  await pg.click('#li-go');
  await pg.waitForTimeout(1200);
  await shot(pg, '03-here');
  await card(pg, '.checkin', 'c-here');
  const btn = await pg.$('[data-checkin]');
  if (!btn) throw new Error('no "I am here" button on the card');
  await btn.click();
  await pg.waitForTimeout(1400);
  await shot(pg, '04-done');
  await card(pg, '.checkin', 'c-done');
  await pg.close();

  // 5: the visitor
  pg = await open();
  await pg.fill('#li-email', '0000');
  await pg.click('#li-go');
  await pg.waitForTimeout(900);
  await pg.fill('#gu-first', 'Dale');
  await pg.fill('#gu-last', 'Pierre');
  await pg.fill('#gu-job', 'Regional Manager');
  await shot(pg, '05-guest');
  await card(pg, '.gate-card', 'c-guest');
  await pg.close();

  await b.close(); server.close();
  console.log('done');
})().catch(e => { console.error('FAILED: ' + e.message); process.exit(1); });
