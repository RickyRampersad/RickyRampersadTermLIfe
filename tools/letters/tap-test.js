// node tools/letters/tap-test.js   (Playwright with Chromium; NODE_PATH to where it is installed)
// Every link in every generated letter, followed on the local copy of the site. Every beacon to
// the live backend is intercepted and aborted, so no test row reaches Client Responses.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..', '..');
const srv = http.createServer((req, res) => {
  const u = decodeURIComponent(req.url.split('?')[0]);
  const f = path.join(ROOT, u.endsWith('/') ? u + 'index.html' : u);
  if (!f.startsWith(ROOT) || !fs.existsSync(f)) { res.writeHead(404); return res.end(); }
  const type = f.endsWith('.html') ? 'text/html' : f.endsWith('.js') ? 'application/javascript' : f.endsWith('.png') ? 'image/png' : f.endsWith('.jpg') ? 'image/jpeg' : 'application/octet-stream';
  res.writeHead(200, { 'content-type': type }); fs.createReadStream(f).pipe(res);
}).listen(8765);
const LAND = fs.readFileSync(ROOT + '/your-policy/index.html', 'utf8');
const CHECKS = JSON.parse(LAND.match(/var CHECKS = (.*);\n/)[1]);
const SEGS = JSON.parse(fs.readFileSync(ROOT + '/orphan-transition/letters/manifest.json', 'utf8')).letters.map(l => l.segment);

(async () => {
  // the repository's own Playwright may expect a browser build this machine does not have: fall back to the installed one
  const browser = await chromium.launch().catch(() => chromium.launch({ executablePath: process.env.CHROMIUM || '/opt/pw-browsers/chromium' }));
  let pass = 0, fail = 0;
  const check = (ok, msg) => { ok ? pass++ : fail++; if (!ok || process.env.V) console.log((ok ? 'PASS ' : 'FAIL ') + msg); };
  async function open(url, human = true) {
    const page = await browser.newPage({ viewport: { width: 390, height: 800 } });
    if (human) await page.addInitScript(() => Object.defineProperty(navigator, 'webdriver', { get: () => false }));
    const beacons = [];
    await page.route('**/script.google.com/**', route => { beacons.push(route.request().url()); route.abort(); });
    await page.route('**/your-policy/review.html**', route => route.fulfill({ status: 200, contentType: 'text/html', body: '<title>review stub</title>' }));
    await page.route(u => !u.href.startsWith('http://localhost:8765/') && !u.href.includes('script.google.com'), route => route.abort());
    const t0 = Date.now();
    await page.goto(url, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(700);
    return { page, beacons, ms: Date.now() - t0 };
  }
  const resp = b => b.filter(x => x.includes('action=resp')).map(x => decodeURIComponent(x));
  let links = 0, slowest = 0;
  for (const seg of SEGS) {
    const html = fs.readFileSync(`${ROOT}/orphan-transition/letters/${seg}.html`, 'utf8');
    const hrefs = [...new Set([...html.matchAll(/href="(https:\/\/rickyrampersadbranch\.com\/your-policy\/\?[^"]+)"/g)].map(m => m[1].replace(/&amp;/g, '&')))];
    for (const h of hrefs) {
      links++;
      const url = h.replace('https://rickyrampersadbranch.com', 'http://localhost:8765').replace('{{token}}', 'TESTTOKEN').replace('{{segment}}', seg);
      const p = new URL(url).searchParams, r = p.get('r'), q = p.get('q') || '';
      const { page, beacons, ms } = await open(url);
      const here = page.url(), got = resp(beacons);
      if (!r) {
        check(here.startsWith('http://localhost:8765/orphan-video/?t=TESTTOKEN&s=' + seg) && got.length === 0, `${seg} film line → ${here}`);
      } else if (r === 'urgent' || r === 'review') {
        check(here.startsWith('http://localhost:8765/your-policy/review.html?from=client&t=TESTTOKEN&type=individual') && (!q || here.endsWith('&q=' + q)),
              `${seg} ${r}${q ? ' ' + q : ''} → the form: ${here}`);
        check(got.length === 1 && got[0].includes('r=' + r + '&') && got[0].includes('s=' + seg) && (!q || got[0].includes('?q=' + q)), `${seg} ${r} ${q}: one beacon (${got.length})`);
      } else {
        slowest = Math.max(slowest, ms);
        const head = await page.textContent('#head'), msg = await page.textContent('#msg');
        const want0 = (q && CHECKS.said[q]) || CHECKS.tap_said[r];
        const owned = r !== 'informed' && CHECKS.care && CHECKS.care.name;    // a named person owns anything that asks something of us
        const want = owned ? want0.replace(/^Thank you[^.]*\.\s*/, '') : want0;
        const headOk = owned ? head === 'Thank you. ' + CHECKS.care.name + ' has this.' : /recorded/.test(head);
        check(here.startsWith('http://localhost:8765/your-policy/') && headOk && msg === want, `${seg} ${r} ${q}: "${head}" · "${msg.slice(0, 40)}"`);
        check(got.length === 1 && got[0].includes('r=' + r + '&') && got[0].includes('t=TESTTOKEN') && got[0].includes('s=' + seg) && (!q || got[0].includes('?q=' + q)),
              `${seg} ${r} ${q}: one beacon (${got.length})`);
        const asked = await page.$$eval('#qs .q b', bs => bs.map(b => b.textContent));
        const expect = (CHECKS.segments[seg] || []).concat(['reach']).map(k => CHECKS.questions[k]).filter(Q => !Q[1].some(a => a[2] === q)).map(Q => Q[0]);
        check(JSON.stringify(asked) === JSON.stringify(expect), `${seg} ${r} ${q}: offers the other checks (${asked.length})`);
      }
      await page.close();
    }
  }
  // answering on the page: a noted answer stays and ticks; "talk to me first" opens the form
  {
    const { page, beacons } = await open(`http://localhost:8765/your-policy/?t=TESTTOKEN&s=F2&r=informed&q=rate_well`);
    await page.click('text=☐ Phone call'); await page.waitForTimeout(300);
    const b = resp(beacons);
    check(b.length === 2 && b[1].includes('r=informed&') && b[1].includes('?q=reach_phone'), `on the page: "Phone call" sends one more beacon (${b.length})`);
    check((await page.textContent('#qs')).includes('☑ Phone call') && (await page.textContent('#qs')).includes('Noted: we will call you.'), 'on the page: the answer is ticked and acknowledged');
    await page.click('text=☐ Yes, talk to me first'); await page.waitForTimeout(500);
    check(page.url().includes('/your-policy/review.html?from=client&t=TESTTOKEN&type=individual&q=approached_yes'), `on the page: "talk to me first" opens the form → ${page.url()}`);
    await page.close();
  }
  // a mail scanner's headless browser opens the link: it must record nothing
  {
    const { page, beacons } = await open(`http://localhost:8765/your-policy/?t=TESTTOKEN&s=F1&r=callme&q=life_changed`, false);
    check(resp(beacons).length === 0, `a scripted browser records nothing (${resp(beacons).length})`);
    await page.close();
  }
  // the form still arrives with the approach question answered
  {
    const page = await browser.newPage();
    await page.route(u => !u.href.startsWith('http://localhost:8765/'), route => route.abort());
    await page.goto('http://localhost:8765/your-policy/review.html?from=client&t=TESTTOKEN&type=individual&q=approached_yes', { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(1200);
    const v = await page.evaluate(() => { try { return state.answers.approached || null; } catch (e) { return 'no state: ' + e.message; } });
    check(v === 'Yes', `review form arrives with "Has anyone been in touch" answered: ${v}`);
    await page.close();
  }
  await browser.close(); srv.close();
  console.log(`${links} letter links followed; slowest thank-you page ${slowest} ms (local, including a 700 ms wait)`);
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
