/* The renewal site's three static pages (renewal/index.html, motor-policy.html,
   corporate.html) in a real browser: the shared renewal theme, no sideways
   scroll at phone and laptop widths, no emoji, the average clause calculator
   drawn live, the sign-in hand-off to the secure portal, the renewal form's
   payload, the fleet portal in preview and against an API, and nothing left
   invisible with reduced motion. Every client and figure is made up.

     node tests/e2e-renewal-site.js
   Screenshots go to $SHOTS (default: a folder beside this file is NOT used;
   pass SHOTS=/some/dir to keep them).                                       */
'use strict';
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');

const ROOT = path.resolve(__dirname, '..');
const SHOTS = process.env.SHOTS || '';
const PORTAL = 'https://script.google.com/macros/s/AKfycbwYQlLt1txn4pCWEq3xO_FmmPUfRAUMzey-vzbUe-qDr9tX27BpM0ZbkP5G0WuYQuZJ8g/exec';
const SIZES = [[360, 740], [390, 844], [1366, 900]];

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; console.log('  ok   ' + m); } else { fail++; console.log('  FAIL ' + m); } };

const TYPES = { '.html': 'text/html; charset=utf-8', '.css': 'text/css', '.js': 'application/javascript', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg' };
function serve() {
  return new Promise((res) => {
    const srv = http.createServer((req, rsp) => {
      const u = decodeURIComponent(req.url.split('?')[0]);
      if (u === '/api') {
        let body = '';
        req.on('data', (c) => body += c);
        req.on('end', () => {
          srv.posts.push({ method: req.method, url: req.url, body, type: req.headers['content-type'] });
          rsp.writeHead(200, { 'content-type': 'application/json', 'access-control-allow-origin': '*' });
          if (req.method === 'GET') {
            const tok = new URL(req.url, 'http://x').searchParams.get('token');
            rsp.end(JSON.stringify(tok === 'NOPE' ? { found: false } : srv.fleetData));
          } else rsp.end(JSON.stringify({ ok: true }));
        });
        return;
      }
      const f = path.join(ROOT, u.endsWith('/') ? u + 'index.html' : u);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rsp.writeHead(404); rsp.end('nf'); return; }
      rsp.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' });
      fs.createReadStream(f).pipe(rsp);
    });
    srv.posts = [];
    srv.listen(0, '127.0.0.1', () => res(srv));
  });
}

/* Contact details on these pages must stay exactly as they were. */
function contacts(html) {
  const out = new Set();
  (html.match(/\(868\)\s?[0-9A-Z]{3}-[0-9A-Z]{4}/g) || []).forEach((x) => out.add(x));
  (html.match(/tel:[+0-9]+/g) || []).forEach((x) => out.add(x));
  (html.match(/[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[a-z]{2,}/g) || []).forEach((x) => out.add(x));
  return [...out].sort().join(' | ');
}

async function common(page, name, w) {
  const r = await page.evaluate(() => {
    scrollTo({ left: 500, top: 0, behavior: 'instant' });
    const sx = scrollX; scrollTo({ left: 0, top: 0, behavior: 'instant' });
    const txt = document.body.innerText;
    const wide = [...document.querySelectorAll('body *')].filter((el) => {
      const b = el.getBoundingClientRect(); if (!b.width) return false;
      let p = el; while (p && p !== document.body) { const o = getComputedStyle(p).overflowX; if (o === 'auto' || o === 'scroll' || o === 'hidden' || o === 'clip') { if (p !== el) return false; } p = p.parentElement; }
      return b.right > innerWidth + 1;
    }).map((el) => el.tagName + '.' + el.className).slice(0, 4);
    const img = document.querySelector('.rr-top .mark img');
    return {
      sx, wide, rr: document.body.classList.contains('rr'), hasRR: !!window.RR,
      emoji: (txt.match(/\p{Extended_Pictographic}/gu) || []).join(''),
      words: (txt.match(/\b(lapse|lapsed|orphan|reassigned|verify your details)\b/gi) || []).join(','),
      mark: img ? img.getAttribute('src') : '', markOk: img ? img.naturalWidth > 0 : false,
      bands: document.querySelectorAll('.rr-band').length, waves: document.querySelectorAll('.rr-band .waves').length,
      oldFonts: document.querySelectorAll('link[href*="fonts.googleapis"]').length,
      gold: /#F2B33D|#efc24b|#c9942c/i.test(document.documentElement.outerHTML),
      raw: document.querySelectorAll('[data-i]:not([data-done]) , [data-i]:empty').length
    };
  });
  ok(r.sx === 0, `${name} @${w}: no sideways scroll (scrollX ${r.sx})`);
  ok(r.wide.length === 0, `${name} @${w}: nothing wider than the screen ${r.wide.join(' ')}`);
  ok(r.rr && r.hasRR, `${name} @${w}: the shared theme is loaded (body.rr, window.RR)`);
  ok(!r.emoji, `${name} @${w}: no emoji in the text ${r.emoji}`);
  ok(!r.words, `${name} @${w}: no words kept off client pages ${r.words}`);
  ok(/board-mark\.png$/.test(r.mark) && r.markOk, `${name} @${w}: the blue shield in the top bar`);
  ok(r.bands > 0 && r.waves === r.bands, `${name} @${w}: every band has its waves (${r.waves}/${r.bands})`);
  ok(r.oldFonts === 0 && !r.gold, `${name} @${w}: no Google Fonts link, no gold`);
}

(async () => {
  const srv = await serve();
  const base = 'http://127.0.0.1:' + srv.address().port;
  const browser = await chromium.launch();
  const shot = async (page, file) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, file), fullPage: true }); } };
  const newPage = async (w, h, o) => {
    const ctx = await browser.newContext(Object.assign({ viewport: { width: w, height: h } }, o || {}));
    const page = await ctx.newPage();
    page.errors = [];
    page.on('pageerror', (e) => page.errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource/.test(m.text())) page.errors.push(m.text()); });
    page.portal = [];
    await page.route('**/*', (rt) => {
      const u = rt.request().url();
      if (u.startsWith(base)) return rt.continue();
      if (u.startsWith('https://script.google.com/')) { page.portal.push(u); return rt.fulfill({ status: 200, contentType: 'text/html', body: '<p>portal</p>' }); }
      return rt.abort();
    });
    return page;
  };

  // ---- contact details unchanged ----
  console.log('\nContact details');
  const ORIG = process.env.ORIG_DIR;
  if (ORIG) {
    for (const f of ['index.html', 'motor-policy.html', 'corporate.html']) {
      const a = contacts(fs.readFileSync(path.join(ORIG, 'orig-renewal-' + f), 'utf8'));
      const b = contacts(fs.readFileSync(path.join(ROOT, 'renewal', f), 'utf8'));
      ok(a === b, `${f}: phone numbers and e-mail addresses unchanged (${b})`);
    }
  }
  for (const f of ['index.html', 'motor-policy.html', 'corporate.html']) {
    const s = fs.readFileSync(path.join(ROOT, 'renewal', f), 'utf8');
    ok(s.includes('<!-- rrb-views -->') && s.includes("RRB_VIEWS_URL"), `${f}: the view-counter beacon is kept`);
    ok(s.includes('href="theme.css"') && s.includes('src="theme.js"'), `${f}: links theme.css and theme.js relatively`);
  }

  // ---- index.html ----
  for (const [w, h] of SIZES) {
    console.log(`\nindex.html @ ${w}x${h}`);
    const page = await newPage(w, h);
    await page.goto(base + '/renewal/index.html', { waitUntil: 'load' });
    await page.waitForTimeout(400);
    await common(page, 'index', w);
    if (SHOTS) {
      await page.evaluate(async () => { for (let y = 0; y < document.documentElement.scrollHeight; y += 400) { scrollTo({ left: 0, top: y, behavior: 'instant' }); await new Promise((r) => setTimeout(r, 60)); } scrollTo({ left: 0, top: 0, behavior: 'instant' }); });
      await page.waitForTimeout(900);
      await shot(page, `renewal-index-${w}-public.png`);
    }

    const first = await page.evaluate(() => ({
      title: document.getElementById('hero-title').textContent,
      code: !!document.getElementById('login-code'),
      steps: document.querySelectorAll('#journey li').length,
      tabs: [...document.querySelectorAll('#tabs a')].map((a) => a.getAttribute('href')).join(' '),
      tabH: Math.min(...[...document.querySelectorAll('#tabs a')].map((a) => a.getBoundingClientRect().height)),
      bars: document.getElementById('cover-bars').innerText,
      comp: document.getElementById('ncd-comp').innerText, tp: document.getElementById('ncd-tp').innerText,
      camps: document.querySelectorAll('#campaign-grid .camp svg.i').length,
      optins: [...document.querySelectorAll('input[name=campaign]')].map((i) => i.value).join(' | ')
    }));
    ok(first.title === 'Your renewal, made simple.' && first.code, 'first screen: title and the access-code sign-in');
    ok(first.steps === 5, 'the renewal journey strip has five steps');
    ok(first.tabs === '#policy #covers #policy-decoded #average #guide #campaigns #respond', 'sticky tabs reach every section');
    ok(first.tabH >= 42, `tabs are a tap target (${first.tabH}px)`);
    ok(/4 of 4/.test(first.bars) && /1 of 4/.test(first.bars), 'cover chart writes its values');
    ok(/30%/.test(first.comp) && /60%/.test(first.comp) && /15%/.test(first.tp) && /35%/.test(first.tp), 'No Claim Discount charts write their values');
    ok(first.camps === 4, 'four offers, each with a line icon');
    ok(first.optins.includes('Special Perils (flood & hurricane) add-on — OEB 1') && first.optins.includes('Third Party → Comprehensive upgrade review'), 'offer opt-ins carry the same titles as values');

    // the calculator, live
    const calc = async () => page.evaluate(() => ({
      res: document.getElementById('c-result').innerText, cls: document.getElementById('c-result').className,
      pay: parseFloat(document.getElementById('v-pay').style.width), you: parseFloat(document.getElementById('v-you').style.width),
      ins: parseFloat(document.getElementById('v-ins').style.width), ring: document.getElementById('v-ring').innerText.replace(/\s+/g, ' '),
      payT: document.getElementById('v-pay-t').textContent, youT: document.getElementById('v-you-t').textContent
    }));
    let c = await calc();
    ok(/Claim pays: TT\$ 14,000\.00/.test(c.res) && /30%/.test(c.res) && /c?calc-result warn/.test(c.cls), 'calculator: the worked example pays TT$ 14,000.00');
    ok(Math.abs(c.pay - 70) < 0.5 && Math.abs(c.you - 30) < 0.5 && Math.abs(c.ins - 70) < 0.5, `calculator: the bars split 70/30 (${c.pay}/${c.you})`);
    ok(/70%/.test(c.ring) && c.payT === 'TT$ 14,000.00' && c.youT === 'TT$ 6,000.00', 'calculator: the ring and the split write their figures');
    await page.fill('#c-insured', '100000');
    c = await calc();
    ok(/Claim pays: TT\$ 20,000\.00/.test(c.res) && /ok/.test(c.cls) && c.you === 0 && /100%/.test(c.ring), 'calculator: full value pays the whole claim, bars follow');
    await page.fill('#c-insured', '50000');
    c = await calc();
    ok(Math.abs(c.pay - 50) < 0.5 && /Claim pays: TT\$ 10,000\.00/.test(c.res), 'calculator: half insured, half paid');
    await page.fill('#c-insured', '120000');
    c = await calc();
    ok(/above/.test(c.res) && /ok/.test(c.cls), 'calculator: over-insured note');
    await page.fill('#c-value', '');
    c = await calc();
    ok(/Enter your values/.test(c.res), 'calculator: asks for values when empty');
    await page.fill('#c-value', '100000'); await page.fill('#c-insured', '70000');

    // a tab takes you to its section
    await page.click('#tabs a[href="#average"]');
    await page.waitForTimeout(900);
    const tab = await page.evaluate(() => ({ top: document.getElementById('average').getBoundingClientRect().top, on: document.querySelector('#tabs a.on') && document.querySelector('#tabs a.on').getAttribute('href') }));
    ok(tab.top > 40 && tab.top < 260 && tab.on === '#average', `tab "Average clause" scrolls there and lights up (${Math.round(tab.top)}, ${tab.on})`);

    // the form
    await page.click('label[for=d2]');
    ok(await page.isVisible('#changes-wrap'), 'form: "I have changes" opens the changes box');
    await page.click('label[for=d4]');
    ok(!(await page.isVisible('#changes-wrap')), 'form: "Call me first" closes it');
    await page.click('label[for=d3]');
    ok(await page.isVisible('#changes-wrap'), 'form: "Upgrade my cover" opens it again');

    if (w === 390) {
      // the full send, through an API, to read the payload
      await page.evaluate((u) => { CONFIG.API_URL = u; }, base + '/api');
      await page.fill('#f-changes', 'New valuation TT$95,000.');
      await page.fill('#f-name', 'Anika Pretend'); await page.fill('#f-mobile', '868-555-0101'); await page.fill('#f-email', 'anika@example.com');
      await page.check('input[name=campaign][value="Motor + Home bundle check"]');
      await page.check('#f-consent');
      srv.posts.length = 0;
      await page.click('#submit-btn');
      await page.waitForSelector('#success-box', { state: 'visible' });
      const p = srv.posts.find((x) => x.method === 'POST');
      const body = p ? JSON.parse(p.body) : {};
      ok(p && /text\/plain/.test(p.type), 'form: posts text/plain to CONFIG.API_URL');
      ok(body.action === 'submit' && body.decision === 'Upgrade / quote requested' && body.name === 'Anika Pretend' && body.mobile === '868-555-0101' && body.email === 'anika@example.com' && body.changes === 'New valuation TT$95,000.', 'form: the payload carries every answer');
      ok(JSON.stringify(body.campaigns) === '["Motor + Home bundle check"]' && body.token === '' && /renewal\/index\.html/.test(body.page), 'form: offers, token and page in the payload');
      ok(!(await page.isVisible('#renewal-form')) && /Instructions received!/.test(await page.innerText('#success-box')), 'form: the success box replaces the form');
      await shot(page, `renewal-index-${w}-sent.png`);
    } else if (w === 360) {
      // with no API the page falls back to the client's mail app
      await page.fill('#f-name', 'Anika Pretend'); await page.fill('#f-mobile', '868-555-0101'); await page.fill('#f-email', 'anika@example.com');
      await page.check('#f-consent');
      await page.click('#submit-btn');
      await page.waitForSelector('#success-box', { state: 'visible' });
      ok(true, 'form: with no API_URL it still shows the success box (mail fallback)');
    }

    // sign-in hands over to the secure portal
    const pg2 = await newPage(w, h);
    await pg2.goto(base + '/renewal/index.html', { waitUntil: 'load' });
    await pg2.click('.signin .rr-btn');
    await pg2.waitForTimeout(200);
    ok(pg2.portal.length === 0, 'sign-in: an empty code goes nowhere');
    await pg2.fill('#login-code', 'ANIKA7');
    await Promise.all([pg2.waitForURL(/script\.google\.com/), pg2.press('#login-code', 'Enter')]);
    ok(pg2.url() === PORTAL + '?t=ANIKA7', 'sign-in: Enter opens the portal with ?t=CODE');
    await pg2.context().close();

    if (w === 1366) {
      const pg3 = await newPage(w, h);
      await pg3.goto(base + '/renewal/index.html', { waitUntil: 'load' });
      await pg3.fill('#login-code', 'X Y/1');
      await Promise.all([pg3.waitForURL(/script\.google\.com/), pg3.click('.signin .rr-btn')]);
      ok(pg3.url() === PORTAL + '?t=X%20Y%2F1', 'sign-in: the button opens the portal, code encoded');
      await pg3.context().close();
      const pg4 = await newPage(w, h);
      await pg4.goto(base + '/renewal/index.html?t=TOK123', { waitUntil: 'commit' });
      await pg4.waitForURL(/script\.google\.com/);
      ok(pg4.url() === PORTAL + '?t=TOK123', 'a personal link (?t=) is handed straight to the portal');
      await pg4.context().close();
    }

    // the policy cards (renderPolicies), with made-up data
    const pc = await page.evaluate(() => {
      const d = (n) => { const x = new Date(); x.setDate(x.getDate() + n); return x.toISOString().slice(0, 10); };
      renderPolicies({ client: 'PRETEND, ANIKA', contact: 'Anika', email: 'anika@example.com', mobile: '868-555-0101', fleet: [{ reg: 'TXX1' }],
        policies: [
          { coverage: 'Comprehensive', nextDue: d(12), premium: 8000, paid: 2000, balance: 6000, paymentStatus: 'Balance owing', policyNo: 'TTMV0000001', sumInsured: 150000 },
          { coverage: 'Third Party', nextDue: d(80), premium: 2000, paid: 2000, balance: 0, paymentStatus: 'Paid up', policyNo: 'TTAPU0000002' },
          { coverage: 'Comprehensive', nextDue: d(-400), premium: 7500, paid: 7500, balance: 0, paymentStatus: 'Paid', policyNo: 'TTMV0000001' }
        ] });
      const deck = document.getElementById('policy');
      return { cards: deck.querySelectorAll('.policy-card').length, urgent: deck.querySelectorAll('.policy-card.due-soon').length,
        txt: deck.innerText, hist: deck.querySelectorAll('details.hist tbody tr').length,
        fleet: (deck.querySelector('.fleetnote a') || {}).href || '', title: document.getElementById('hero-title').textContent,
        name: document.getElementById('f-name').value, ring: deck.querySelectorAll('.rr-ring').length };
    });
    ok(pc.cards === 2 && pc.urgent === 1, 'policy cards: two current, one due soon');
    ok(/TT\$ 8,000\.00/.test(pc.txt) && /TT\$ 150,000\.00/.test(pc.txt) && /TT\$ 6,000\.00/.test(pc.txt) && /12/.test(pc.txt) && /days left/.test(pc.txt), 'policy cards: premium, sum insured, balance and days left in the text');
    ok(/25%/.test(pc.txt) && pc.ring === 2 && /Balance owing — please settle before renewal/.test(pc.txt) && /Paid up/.test(pc.txt), 'policy cards: share paid ring, status as words');
    ok(pc.hist === 1 && /renewal history \(1 earlier record\)/.test(pc.txt), 'policy cards: one record in the history');
    ok(/corporate\.html\?t=/.test(pc.fleet) && pc.title === 'Hi Anika, your renewal is coming up.' && pc.name === 'Anika', 'policy cards: fleet pointer, greeting and form prefill');

    ok(page.errors.length === 0, `index @${w}: no page errors ${page.errors.join(' ; ')}`);
    await page.evaluate(() => scrollTo({ left: 0, top: 0, behavior: 'instant' }));
    await shot(page, `renewal-index-${w}.png`);
    await page.context().close();
  }

  // ---- motor-policy.html ----
  for (const [w, h] of SIZES) {
    console.log(`\nmotor-policy.html @ ${w}x${h}`);
    const page = await newPage(w, h);
    await page.goto(base + '/renewal/motor-policy.html', { waitUntil: 'load' });
    await page.waitForTimeout(400);
    await common(page, 'motor-policy', w);
    const r = await page.evaluate(() => ({
      tabs: document.querySelectorAll('#tabs a').length,
      acc: document.querySelectorAll('details.acc').length,
      chart: document.querySelector('.gchart').getAttribute('aria-label') + ' ' + document.querySelector('.gchart').innerText,
      matrix: document.querySelectorAll('.matrix tbody tr').length,
      back: [...document.querySelectorAll('a')].map((a) => a.getAttribute('href')).join(' '),
      foot: document.querySelector('.footer').innerText
    }));
    ok(r.tabs === 9 && r.acc === 16, `nine tabs, sixteen accordions (${r.tabs}, ${r.acc})`);
    ok(/30%/.test(r.chart) && /60%/.test(r.chart) && /35%/.test(r.chart), 'NCD chart writes both series');
    ok(r.matrix === 7, 'OEB availability matrix has seven rows');
    ok(/index\.html/.test(r.back) && /index\.html#respond/.test(r.back), 'links back to the renewal and the form');
    ok(r.foot.includes('(868) 678-5921 · ricky.rampersad@myguardiangroup.com'), 'footer contact line unchanged');
    // accordions open and close
    const sum = page.locator('#s4 details.acc summary');
    await sum.click();
    ok(await page.evaluate(() => document.querySelector('#s4 details.acc').open), 'an accordion opens on a tap');
    await sum.click();
    ok(!(await page.evaluate(() => document.querySelector('#s4 details.acc').open)), 'and closes again');
    await page.click('#tabs a[href="#s9"]');
    await page.waitForTimeout(900);
    const t = await page.evaluate(() => ({ open: document.querySelector('#s9 details.acc').open, top: document.getElementById('s9').getBoundingClientRect().top }));
    ok(t.open && t.top < 300, `a tab scrolls to its part and opens it (${Math.round(t.top)})`);
    ok(page.errors.length === 0, `motor-policy @${w}: no page errors ${page.errors.join(' ; ')}`);
    await page.evaluate(() => scrollTo({ left: 0, top: 0, behavior: 'instant' }));
    await shot(page, `renewal-motor-policy-${w}.png`);
    await page.context().close();
  }

  // ---- corporate.html ----
  srv.fleetData = { found: true, client: 'PRETEND HAULAGE LTD', contact: 'Ravi Madeup', email: 'ops@example.com', mobile: '868-555-0199',
    policies: [{ coverage: 'Comprehensive', nextDue: '2027-01-20', premium: 30000, paid: 30000, balance: 0, paymentStatus: 'Paid up', policyNo: 'TTACF0000009' }],
    fleet: [
      { reg: 'PCX1111', make: 'Nissan', model: 'Navara', status: 'Current', renewal: '2027-01-20', policyNo: 'TTACF0000009', premium: 4000 },
      { reg: 'PCX2222', make: 'Mazda', model: 'BT-50', status: 'Current', renewal: '2027-01-20', policyNo: 'TTACF0000009', premium: 3500 },
      { reg: 'PCX1111', make: 'Nissan', model: 'Navara', status: 'Current', renewal: '2026-01-20', policyNo: 'TTACF0000009', premium: 3800 },
      { reg: 'PCX0001', make: 'Toyota', model: 'Hiace', status: 'Removed', renewal: '2025-01-20', policyNo: 'TTACF0000009', premium: 3000 }
    ] };
  for (const [w, h] of SIZES) {
    console.log(`\ncorporate.html @ ${w}x${h}`);
    const page = await newPage(w, h);
    await page.goto(base + '/renewal/corporate.html', { waitUntil: 'load' });
    await page.waitForTimeout(300);
    ok(await page.isVisible('#login-card') && !(await page.isVisible('#dashboard')), 'opens on the company sign-in');
    await page.click('#login-card .rr-btn');
    ok(await page.isVisible('#login-card'), 'an empty code stays on the sign-in');
    await page.fill('#code-input', 'DEMO1');
    await page.press('#code-input', 'Enter');
    await page.waitForSelector('#dashboard', { state: 'visible' });
    await page.waitForTimeout(500);
    await common(page, 'corporate', w);
    const d = await page.evaluate(() => ({
      name: document.getElementById('co-name').textContent, kpis: document.getElementById('kpis').textContent.replace(/\s+/g, ' '),
      fleet: document.querySelectorAll('#fleet-table tbody tr').length, hist: document.querySelectorAll('#history details').length,
      pol: document.querySelectorAll('#policy-table tbody tr').length, banner: document.getElementById('banner').innerText,
      veh: document.getElementById('ch-veh').innerText, cyc: document.getElementById('ch-cycles').innerText,
      st: document.getElementById('ch-status').textContent.replace(/\s+/g, ' '), pay: document.getElementById('ch-pay').textContent.replace(/\s+/g, ' '),
      tabs: document.querySelectorAll('#tabs a').length, ff: document.getElementById('ff-name').value
    }));
    ok(d.name === 'SAMPLE LOGISTICS LTD' && /Preview mode/.test(d.banner), 'preview mode shows the sample fleet');
    ok(/Vehicles on cover \(latest cycle\)/.test(d.kpis) && /TT\$ 11,289\.49/.test(d.kpis) && /2026-11-14/.test(d.kpis) && /TT\$ 28,000\.00/.test(d.kpis) && /please settle/.test(d.kpis), 'the four figures, as before');
    ok(d.fleet === 4 && d.hist === 1 && d.pol === 1 && d.tabs === 5, 'fleet table, one earlier cycle, one policy, five tabs');
    ok(/TT\$ 6,598\.99/.test(d.veh) && /TEG7960 \(Sold\)/.test(d.veh), 'premium by vehicle writes its values');
    ok(/2025-11-14: TT\$ 2,980\.00/.test(d.cyc) && /2026-11-14: TT\$ 11,289\.49/.test(d.cyc), 'premium by cycle writes its totals');
    ok(/On cover 3/.test(d.st) && /Sold or removed 1/.test(d.st) && /Paid TT\$ 20,000\.00/.test(d.pay) && /Owing TT\$ 28,000\.00/.test(d.pay), 'status and payment stacks write their values');
    ok(d.ff === 'Operations', 'the form is prefilled');
    await page.click('#history summary');
    ok(await page.evaluate(() => document.querySelector('#history details').open), 'a history cycle opens');
    await page.click('#renew-link');
    await page.waitForTimeout(800);
    ok(await page.evaluate(() => document.getElementById('fleet-form').getBoundingClientRect().top < 300), 'Confirm Fleet Renewal goes to the form');
    if (w === 390) {
      await page.evaluate((u) => { CONFIG.API_URL = u; }, base + '/api');
      await page.fill('#ff-changes', 'Remove TEG7960.');
      srv.posts.length = 0;
      await page.click('#ff-btn');
      await page.waitForSelector('#ff-success', { state: 'visible' });
      const p = srv.posts.find((x) => x.method === 'POST');
      const body = p ? JSON.parse(p.body) : {};
      ok(body.action === 'submit' && body.decision === 'Fleet renewal instructions' && body.token === 'DEMO1' && body.changes === 'Remove TEG7960.' && body.notes === 'Submitted via corporate fleet portal', 'fleet instructions post the same payload');
    }
    ok(page.errors.length === 0, `corporate @${w}: no page errors ${page.errors.join(' ; ')}`);
    await page.evaluate(() => scrollTo({ left: 0, top: 0, behavior: 'instant' }));
    await shot(page, `renewal-corporate-${w}.png`);
    await page.context().close();

    if (w === 1366) {
      // against an API: a ?t= link loads the real fleet, an unknown code is refused
      const pg = await newPage(w, h);
      await pg.addInitScript((u) => { window.__API = u; }, base + '/api');
      await pg.route('**/renewal/corporate.html*', async (rt) => {
        const s = fs.readFileSync(path.join(ROOT, 'renewal/corporate.html'), 'utf8').replace('API_URL: "",', 'API_URL: window.__API,');
        rt.fulfill({ status: 200, contentType: 'text/html', body: s });
      });
      await pg.goto(base + '/renewal/corporate.html?t=PH42', { waitUntil: 'load' });
      await pg.waitForSelector('#dashboard', { state: 'visible' });
      await pg.waitForTimeout(400);
      const a = await pg.evaluate(() => ({ name: document.getElementById('co-name').textContent, fleet: document.querySelectorAll('#fleet-table tbody tr').length, hist: document.querySelectorAll('#history details').length, ff: document.getElementById('ff-email').value, banner: document.getElementById('banner').innerText }));
      ok(a.name === 'PRETEND HAULAGE LTD' && a.fleet === 2 && a.hist === 2 && a.ff === 'ops@example.com' && !a.banner, 'a ?t= link loads the fleet from CONFIG.API_URL');
      ok(srv.posts.some((x) => x.method === 'GET' && /token=PH42/.test(x.url)), 'the fetch asks ?token=CODE');
      await shot(pg, 'renewal-corporate-1366-api.png');
      await pg.goto(base + '/renewal/corporate.html', { waitUntil: 'load' });
      await pg.fill('#code-input', 'NOPE');
      await pg.click('#login-card .rr-btn');
      await pg.waitForSelector('#login-err', { state: 'visible' });
      ok(/didn't match/.test(await pg.innerText('#login-err')), 'an unknown code shows the error');
      ok(pg.errors.length === 0, `corporate API @${w}: no page errors ${pg.errors.join(' ; ')}`);
      await pg.context().close();
    }
  }

  // ---- reduced motion: nothing left invisible ----
  console.log('\nReduced motion');
  for (const f of ['index.html', 'motor-policy.html', 'corporate.html?t=DEMO']) {
    const page = await newPage(390, 844, { reducedMotion: 'reduce' });
    await page.goto(base + '/renewal/' + f, { waitUntil: 'load' });
    await page.waitForTimeout(300);
    const r = await page.evaluate(async () => {
      const h = document.documentElement.scrollHeight;
      for (let y = 0; y < h; y += 500) { scrollTo({ left: 0, top: y, behavior: 'instant' }); await new Promise((r) => setTimeout(r, 20)); }
      const hidden = [...document.querySelectorAll('.rr-card, .sr, .rr-tile, .rr-bar .t i, .rr-cols .c i, .gchart i, .waves svg, .rr-steps li')].filter((el) => {
        if (!el.offsetParent && getComputedStyle(el).position !== 'fixed') return false;
        const cs = getComputedStyle(el); return parseFloat(cs.opacity) < 0.99 || cs.animationName !== 'none';
      }).map((el) => el.className);
      return hidden;
    });
    ok(r.length === 0, `${f}: every card, chart and step is visible and still (${r.slice(0, 3).join(', ')})`);
    await page.evaluate(() => scrollTo({ left: 0, top: 0, behavior: 'instant' }));
    await shot(page, 'renewal-reduced-' + f.replace(/[^a-z-]/gi, '_') + '.png');
    ok(page.errors.length === 0, `${f} (reduced): no page errors ${page.errors.join(' ; ')}`);
    await page.context().close();
  }

  await browser.close();
  srv.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})().catch((e) => { console.error(e); process.exit(1); });
