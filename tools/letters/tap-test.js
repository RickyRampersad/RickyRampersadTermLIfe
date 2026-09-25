// node tools/letters/tap-test.js   (Playwright with Chromium; NODE_PATH to where it is installed)
// Every link in every generated letter, checked in whichever mode the letters were built in (receipt.json
// reply.mode): page links are followed on the local copy of the site, and replies (mailto) are decoded and
// read as the inbox reader in Transition.gs reads them. Every beacon to the live backend is intercepted and
// aborted, so no test row reaches Client Responses.
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
const MAN = JSON.parse(fs.readFileSync(ROOT + '/orphan-transition/letters/manifest.json', 'utf8'));
const RJ = JSON.parse(fs.readFileSync(ROOT + '/orphan-transition/letters/receipt.json', 'utf8'));
const SEGS = MAN.letters.map(l => l.segment);
const PAGE_MODE = RJ.reply.mode !== 'reply';
const T_REF = /Ref:\s*([A-Za-z0-9_-]{6,64})\s+([a-z]+)(?:\s+([a-z_]+))?/;   // the same expression as Transition.gs
const ANSWERS = {};   // answer code → [question, label, tap]
for (const [k, [q, ans]] of Object.entries(CHECKS.questions)) for (const [label, tap, code] of ans) ANSWERS[code] = [q, label, tap];

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
  let links = 0, replies = 0, slowest = 0;
  for (const seg of SEGS) {
    const L = MAN.letters.find(l => l.segment === seg);
    const html = fs.readFileSync(`${ROOT}/orphan-transition/letters/${seg}.html`, 'utf8');
    const plain = fs.readFileSync(`${ROOT}/orphan-transition/letters/plain/${seg}.html`, 'utf8');
    const mailtos = [...new Set([...html.matchAll(/href="(mailto:[^"]+)"/g)].map(m => m[1].replace(/&amp;/g, '&')))];
    const hrefs = [...new Set([...html.matchAll(/href="(https:\/\/rickyrampersadbranch\.com\/your-policy\/\?[^"]+)"/g)].map(m => m[1].replace(/&amp;/g, '&')))];
    if (PAGE_MODE) check(mailtos.length === 0, `${seg}: in page mode no answer is a reply (${mailtos.length})`);
    // the replies: every mailto on the letter, decoded and read like the inbox reader
    const seen = new Set();
    for (const h of mailtos) {
      replies++;
      const u = new URL(h);
      const subject = u.searchParams.get('subject') || '', body = (u.searchParams.get('body') || '').replace('{{token}}', 'TESTTOKEN');
      const ref = T_REF.exec(body);
      check(u.pathname === RJ.reply.to && subject && ref && ref[1] === 'TESTTOKEN', `${seg} reply "${subject}": to support@, with a reference`);
      if (!ref) continue;
      const r = ref[2], q = ref[3] || '';
      seen.add(r + (q ? ':' + q : ''));
      // the two doors (agent now, the full review) are on every letter, as a card or as a line, whether or not they are among its taps
      check(!RJ.reply.form_taps.includes(r) && (q ? ANSWERS[q] && ANSWERS[q][2] === r : L.taps.includes(r) || r === 'urgent' || r === 'review'),
            `${seg} reply "${subject}": ${r}${q ? ' ' + q : ''} is a tap of this letter`);
      const lines = body.split('\n');
      check(/\n\n\n?\n?Ref: /.test(body) && lines[lines.length - 1].startsWith('Ref: TESTTOKEN ' + r),
            `${seg} reply "${subject}": room to write, then the reference on the last line`);
      if (q) check(lines[0] === ANSWERS[q][0] && lines[1] === ANSWERS[q][1] && subject === ANSWERS[q][1], `${seg} reply "${subject}": question and answer in the page's own words`);
      else { const label = L.tap_labels[r] || MAN.taps[r]; check(lines[0] === label + '.' && subject === label, `${seg} reply "${subject}": the tap's own words`); }
      const known = new Set(RJ.reply.lines.map(l => l.toLowerCase()));
      const left = body.split(/\n\s*Ref:/)[0].split('\n').map(l => l.trim()).filter(l => l && !known.has(l.toLowerCase()));
      check(left.length === 0, `${seg} reply "${subject}": every pre-written line is on the reader's list (${left.join(' | ')})`);
      check(plain.includes(h) || plain.includes(h.replace(/&/g, '&amp;')), `${seg} reply "${subject}": the plain letter carries the same reply`);
    }
    if (!PAGE_MODE) for (const r of L.taps) check(RJ.reply.form_taps.includes(r) || seen.has(r), `${seg}: the ${r} tap is a reply`);
    // the page links: the film line, and in page mode every tap and every answer
    for (const h of hrefs) {
      links++;
      const url = h.replace('https://rickyrampersadbranch.com', 'http://localhost:8765').replace('{{token}}', 'TESTTOKEN').replace('{{segment}}', seg);
      const p = new URL(url).searchParams, r = p.get('r'), q = p.get('q') || '';
      if (!PAGE_MODE) check(!r || RJ.reply.form_taps.includes(r), `${seg} page link ${r || 'film'}${q ? ' ' + q : ''}: only the form opens a page`);
      const { page, beacons, ms } = await open(url);
      const here = page.url(), got = resp(beacons);
      if (!r) {
        check(here.startsWith('http://localhost:8765/orphan-video/?t=TESTTOKEN&s=' + seg) && got.length === 0, `${seg} film line → ${here}`);
      } else if (r === 'urgent' || r === 'review') {
        slowest = Math.max(slowest, ms);
        check(here.startsWith('http://localhost:8765/your-policy/review.html?from=client&t=TESTTOKEN&type=individual') && (!q || here.endsWith('&q=' + q)),
              `${seg} ${r}${q ? ' ' + q : ''} → the form: ${here}`);
        check(got.length === 1 && got[0].includes('r=' + r + '&') && got[0].includes('s=' + seg) && (!q || got[0].includes('?q=' + q)), `${seg} ${r} ${q}: one beacon (${got.length})`);
      } else {
        slowest = Math.max(slowest, ms);
        const head = await page.textContent('#head'), msg = await page.textContent('#msg');
        const want0 = (q && CHECKS.said[q]) || CHECKS.tap_said[r];
        const owned = r !== 'informed' && CHECKS.care && CHECKS.care.Us;    // the team owns anything that asks something of us
        const want = owned ? want0.replace(/^Thank you[^.]*\.\s*/, '') : want0;
        const headOk = owned ? head === 'Thank you. ' + CHECKS.care.Us + ' has this.' : /recorded/.test(head);
        check(here.startsWith('http://localhost:8765/your-policy/') && headOk && msg === want, `${seg} ${r} ${q}: "${head}" · "${msg.slice(0, 40)}"`);
        check(got.length === 1 && got[0].includes('r=' + r + '&') && got[0].includes('t=TESTTOKEN') && got[0].includes('s=' + seg) && (!q || got[0].includes('?q=' + q)),
              `${seg} ${r} ${q}: one beacon (${got.length})`);
        const asked = await page.$$eval('#qs .q b', bs => bs.map(b => b.textContent));
        const expect = (CHECKS.segments[seg] || []).concat(['reach']).concat(r === 'callme' ? ['when'] : []).map(k => CHECKS.questions[k]).filter(Q => !Q[1].some(a => a[2] === q)).map(Q => Q[0]);
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
  console.log(`${PAGE_MODE ? 'page' : 'reply'} mode: ${replies} replies read and ${links} page links followed; slowest page ${slowest} ms (local, including a 700 ms wait)`);
  console.log(`${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
