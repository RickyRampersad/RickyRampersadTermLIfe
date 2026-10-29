/* The client's motor renewal portal (apps-script/Portal.html, built by clientPage_)
   and "Track your renewal" (findPage_ in apps-script/Code.gs), in the renewal theme.
   Made-up clients only. Run: node tests/e2e-renewal-portal.js [screenshot dir] */
const fs = require('fs'), path = require('path'), vm = require('vm');
const { chromium } = require('playwright');

const ROOT = path.join(__dirname, '..');
const SHOTS = process.argv[2] || path.join(require('os').tmpdir(), 'renewal-portal-shots');
fs.mkdirSync(SHOTS, { recursive: true });
const THEME = fs.readFileSync(path.join(ROOT, 'apps-script/RenewalTheme.html'), 'utf8');
const PORTAL = fs.readFileSync(path.join(ROOT, 'apps-script/Portal.html'), 'utf8');

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) { pass++; } else { fail++; console.log('FAIL ' + m); } };

/* ---- the payload, in the shape clientPage_ builds ---- */
const BASE = {
  ok: true, survey: false, token: 'tok-anika-1', firstName: 'Anika', client: 'Anika Pretend',
  policies: [
    { rowIndex: 7, coverage: 'Private Motor Comprehensive', comp: true, nextDue: '12 Nov 2026', days: 17,
      premium: 6420.5, sumInsured: 148000, balance: 0, payStatus: 'Paid to date', policy: 'TT MPC 0100001',
      mobile: '868 555 0101', email: 'anika.pretend@example.com', renewalStatus: 'RENEW — proceed — 20 Oct 2026',
      valueHistory: [],
      guide: { current: 148000, low: 125000, high: 133000, basis: 'your own value history — this vehicle has moved about 9.4% a year with us', rate: -0.094, years: 3, stale: true } },
    { rowIndex: 9, coverage: 'Private Motor Third Party', comp: false, nextDue: '30 Nov 2026', days: 35,
      premium: 1890, sumInsured: '', balance: 410.25, payStatus: 'Balance outstanding', policy: 'TT MPT 0200002',
      mobile: '868 555 0101', email: 'anika.pretend@example.com', renewalStatus: '', valueHistory: [], guide: null },
  ],
  history: [
    { when: '20 Oct 2026', policy: 'TT MPC 0100001', coverage: 'Private Motor Comprehensive', instruction: 'RENEW — proceed', value: 'TT$140,000.00', valueRaw: 140000, payMethod: 'Bank transfer', payRef: 'BT-1', status: 'Received' },
  ],
  comms: [
    { when: '20 Oct 2026', label: 'Your renewal instruction received', from: 'you', detail: 'RENEW — proceed · value TT$140,000.00' },
    { when: '14 Oct 2026', label: 'Renewal reminder emailed to you', from: 'us', detail: '' },
    { when: '01 Oct 2026', label: 'Renewal invitation emailed to you', from: 'us', detail: '' },
  ],
  vehicles: [
    { reg: 'PDX 1234', make: 'Toyota', model: 'Corolla', year: '2019', chassis: 'NZE-PRETEND-01', engine: '1ZR-0001', cover: 'Comprehensive',
      ncd: '40', windscreen: 7500, depreciation: '10', policy: 'TT MPC 0100001', carrier: 'Guardian General', periodTo: '11 Nov 2026', comp: true,
      since: '12 Nov 2021', years: '5', address: '1 Pretend Street', value: 148000,
      valueHistory: [{ when: '11 Nov 2022', value: 'TT$198,000.00' }, { when: '11 Nov 2023', value: 'TT$180,000.00' }, { when: '11 Nov 2024', value: 'TT$163,000.00' }, { when: '11 Nov 2025', value: 'TT$148,000.00' }] },
    { reg: 'PCC 5678', make: 'Nissan', model: 'Tiida', year: '2012', chassis: '', engine: '', cover: 'Third Party',
      ncd: '35', windscreen: '', depreciation: '', policy: 'TT MPT 0200002', carrier: 'Guardian General', periodTo: '29 Nov 2026', comp: false,
      since: '', years: '', address: '', value: '', valueHistory: [] },
  ],
  crossSell: 'home',
  agent: { name: 'Ricky Rampersad', phone: '(868) 678-5921' },
};
const NEW_HISTORY = [{ when: '26 Oct 2026', policy: 'TT MPT 0200002', coverage: 'Private Motor Third Party', instruction: 'RENEW WITH CHANGES', value: '', payMethod: 'Bank transfer', payRef: '', status: 'Received' }].concat(BASE.history);

function portalHtml(payload) {
  return PORTAL.replace('<?!= rrTheme_() ?>', THEME)
    .replace('<?!= JSON.stringify(payload) ?>', JSON.stringify(JSON.stringify(payload)));
}
/* google.script.run, chainable, recording every call */
const STUB = `<script>window.__calls=[];window.__fail=false;(function(){function R(){var s=null,f=null,o={};
o.withSuccessHandler=function(h){s=h;return o};o.withFailureHandler=function(h){f=h;return o};o.withUserObject=function(){return o};
var ret={submitInstruction:{ok:true,history:${JSON.stringify(NEW_HISTORY)}},submitSurvey:{ok:true},sendMyLink:{ok:true}};
Object.keys(ret).forEach(function(k){o[k]=function(a){window.__calls.push({fn:k,arg:a});setTimeout(function(){if(window.__fail){f&&f(new Error('Test failure'))}else{s&&s(ret[k])}},60);};});return o;}
window.google={script:{get run(){return R()}}};})();</script>`;
const withStub = h => h.replace('<head>', '<head>' + STUB);

/* ---- findPage_, run from Code.gs itself with HtmlService stubbed ---- */
function findHtml(p) {
  let out = null;
  const out$ = { setTitle() { return out$; }, addMetaTag() { return out$; }, setXFrameOptionsMode() { return out$; } };
  const ctx = {
    HtmlService: { createHtmlOutput(h) { out = h; return out$; }, createHtmlOutputFromFile() { return { getContent: () => THEME }; },
      XFrameOptionsMode: { ALLOWALL: 1 }, createTemplateFromFile() { throw new Error('no template expected'); } },
    Utilities: {}, Session: {}, console,
  };
  vm.createContext(ctx);
  vm.runInContext(fs.readFileSync(path.join(ROOT, 'apps-script/Code.gs'), 'utf8'), ctx);
  ctx.doGet({ parameter: p });
  return out;
}

async function noSideScroll(page) {
  return page.evaluate(() => { window.scrollTo(500, window.scrollY); const x = window.scrollX; window.scrollTo(0, window.scrollY); return x === 0 && document.documentElement.scrollWidth <= innerWidth + 1; });
}

(async () => {
  const browser = await chromium.launch();
  const sizes = [[360, 740, 'phone360'], [390, 844, 'phone390'], [1366, 900, 'desktop']];

  /* ===== the portal, two policies ===== */
  for (const [w, h, tag] of sizes) {
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage(); const errs = [];
    page.on('pageerror', e => errs.push(e.message));
    page.on('console', m => { if (m.type() === 'error' && !/favicon|board-mark|ERR_|Failed to load/.test(m.text())) errs.push(m.text()); });
    await page.setContent(withStub(portalHtml(BASE)), { waitUntil: 'load' });
    await page.waitForTimeout(1500);
    ok(errs.length === 0, tag + ' no page errors: ' + errs.join(' | '));
    ok(await noSideScroll(page), tag + ' no sideways scroll');
    const txt = await page.textContent('body');
    ok(/Welcome, Anika\./.test(txt), tag + ' welcome');
    ok(await page.$('img[src*="board-mark.png"]'), tag + ' the blue shield mark');
    ok(!/[\u{1F300}-\u{1FAFF}☀-➿]/u.test(txt.replace(/[✓]/g, '')), tag + ' no emoji');
    ok(!/orphan|reassigned|lapse|verify your details/i.test(txt), tag + ' no banned words');
    ok(await page.$$eval('.rr-band .waves', n => n.length) >= 3, tag + ' waves on every band');
    ok(/17\s*days to go/.test(await page.textContent('#top')) || (await page.$eval('#top .rr-ring', e => e.getAttribute('aria-label'))) === '17 days to go', tag + ' days ring in hero');
    ok(txt.includes('TT MPC 0100001') && txt.includes('12 Nov 2026') && txt.includes('TT$6,420.50') && txt.includes('TT$148,000.00'), tag + ' policy facts shown');
    ok(txt.includes('Paid to date') && txt.includes('Balance outstanding') && txt.includes('TT$410.25'), tag + ' payment status and balance');
    ok(txt.includes('Your own vehicle covered') && txt.includes('Legal defence costs'), tag + ' benefits for both covers');
    ok(txt.includes('TT$125,000 – TT$133,000') && txt.includes('Unchanged for 3 years'), tag + ' value guide + stale');
    ok(txt.includes('Waiver of Excess') && txt.includes('windscreen cover'), tag + ' waiver and windscreen');
    ok(await page.$$eval('.rr-cols', n => n.length) >= 2, tag + ' value charts drawn');
    ok(/198k[\s\S]*148k/.test(await page.textContent('#pol0 .rr-cols')), tag + ' value chart values in text');
    ok(txt.includes('down 25.3% from TT$198,000 to TT$148,000'), tag + ' value change in words');
    ok(txt.includes('PDX 1234') && txt.includes('NZE-PRETEND-01') && txt.includes('No Claim Discount 40%') && txt.includes('5 years of loyalty'), tag + ' vehicles on record');
    ok(txt.includes('Your renewal instruction received') && txt.includes('From you') && txt.includes('From us'), tag + ' communication history');
    ok(txt.includes('RENEW — proceed') && txt.includes('value TT$140,000.00'), tag + ' history table');
    ok(txt.includes('One branch for everything you protect'), tag + ' home cross-sell');
    ok(await page.$$eval('#pol0 .rr-steps li.done', n => n.length) === 2 && await page.$$eval('#pol0 .rr-steps li.on', n => n.length) === 1, tag + ' journey: instructed policy is with our team');
    ok(txt.includes('We have your instruction (20 Oct 2026)'), tag + ' journey date');
    ok(await page.$$eval('#pol1 .rr-steps li.done', n => n.length) === 0, tag + ' journey: second policy waiting');
    ok(await page.$('a[href^="tel:"]'), tag + ' call link');
    // tabs
    const tabs = await page.$$eval('#tabs button', b => b.map(x => x.textContent.trim()));
    ok(tabs.length === 5 && /Vehicles/.test(tabs.join()) && /Messages/.test(tabs.join()), tag + ' sticky tabs: ' + tabs.join(','));
    await page.click('#tabs [data-go="vehicles"]'); await page.waitForTimeout(900);
    ok(await page.evaluate(() => Math.abs(document.getElementById('vehicles').getBoundingClientRect().top) < 200), tag + ' tab scrolls to vehicles');
    ok(await page.$eval('#tabs [data-go="vehicles"]', b => b.getAttribute('aria-selected')) === 'true', tag + ' tab marked as selected');
    // tap targets
    const small = await page.$$eval('.rr-btn, .opt, #tabs button, .rr-item[data-go]', els => els.filter(e => e.offsetParent && e.getBoundingClientRect().height < 40).length);
    ok(small === 0, tag + ' tap targets at least 40px');

    if (tag === 'phone390' || tag === 'desktop') {
      await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(300);
      await page.evaluate(() => document.querySelectorAll('.sr').forEach(e => e.classList.add('sr-in')));
      await page.screenshot({ path: path.join(SHOTS, 'portal-' + tag + '.png'), fullPage: true });
    }

    // value feedback + scale marker
    await page.fill('#val0', '90000'); await page.waitForTimeout(100);
    ok(/That looks low/.test(await page.textContent('#vfeed0')), tag + ' low value warning');
    ok(await page.$eval('#vmk0', e => e.classList.contains('on')), tag + ' your-figure marker shows');
    await page.fill('#val0', '130000');
    ok(/Noted\.[\s\S]*About TT\$18,000/.test(await page.textContent('#vfeed0')), tag + ' value noted with saving');
    await page.fill('#val0', '160000');
    ok(/above what you carry/.test(await page.textContent('#vfeed0')), tag + ' above-value warning');
    await page.fill('#val0', '130000'); await page.locator('#val0').blur();
    ok(await page.inputValue('#val0') === '130,000', tag + ' value formatted on blur');

    // submit without a choice
    await page.click('[data-submit="1"]');
    ok(/Please choose an instruction/.test(await page.textContent('#err1')) && await page.isVisible('#err1'), tag + ' asks for a choice');
    // choose renew with changes on the TP policy
    await page.click('#pol1 .opt.o-change');
    ok(await page.$eval('#pol1 .opt.o-change', e => e.classList.contains('sel')), tag + ' choice highlighted');
    ok(await page.isVisible('#pol1 .notes-hint'), tag + ' notes hint for changes');
    await page.check('#ws1'); await page.check('#comp1');
    await page.selectOption('#pay1', 'Bank transfer');
    await page.fill('#payref1', 'REF-9'); await page.fill('#notes1', 'New address: 2 Pretend Ave');
    await page.click('[data-submit="1"]');
    await page.waitForTimeout(400);
    const call = (await page.evaluate(() => window.__calls)).filter(c => c.fn === 'submitInstruction').pop();
    ok(call && call.arg.token === 'tok-anika-1' && call.arg.rowIndex === 9 && call.arg.instruction === 'RENEW WITH CHANGES' &&
      call.arg.windscreen === true && call.arg.wantsComp === true && call.arg.waiver === false && call.arg.payMethod === 'Bank transfer' &&
      call.arg.payRef === 'REF-9' && call.arg.notes === 'New address: 2 Pretend Ave' && call.arg.email === 'anika.pretend@example.com' &&
      call.arg.mobile === '868 555 0101' && call.arg.newValue === '', tag + ' submitInstruction arguments ' + JSON.stringify(call && call.arg));
    ok(await page.isVisible('#ok1'), tag + ' sent confirmation');
    ok(/RENEW WITH CHANGES/.test(await page.textContent('#hist')), tag + ' history refreshed');
    ok(await page.$eval('#tabs [data-go="history"] .n', e => e.textContent) === '2', tag + ' history count updated');
    // the comprehensive one, with waiver and value
    await page.click('#pol0 .opt.o-renew');
    await page.click('[data-submit="0"]'); await page.waitForTimeout(300);
    const c0 = (await page.evaluate(() => window.__calls)).filter(c => c.fn === 'submitInstruction').pop();
    ok(c0.arg.instruction === 'RENEW — proceed' && c0.arg.waiver === true && c0.arg.newValue === '130,000' && c0.arg.rowIndex === 7, tag + ' comprehensive submit ' + JSON.stringify(c0.arg));
    // failure path
    await page.evaluate(() => { window.__fail = true; });
    await page.click('#pol0 .opt.o-call'); await page.click('[data-submit="0"]'); await page.waitForTimeout(300);
    ok(/Something went wrong: Test failure/.test(await page.textContent('#err0')), tag + ' failure shown');
    ok(await page.$eval('[data-submit="0"]', b => !b.disabled && /Send my renewal instruction/.test(b.textContent)), tag + ' button restored after failure');
    ok(await noSideScroll(page), tag + ' still no sideways scroll after actions');
    await ctx.close();
  }

  /* ===== one policy, and reduced motion ===== */
  {
    const one = JSON.parse(JSON.stringify(BASE));
    one.policies = [Object.assign(one.policies[0], { renewalStatus: 'RENEWED — 25 Oct 2026', days: -2, valueHistory: [{ when: '20 Oct 2026', value: 'TT$140,000.00' }, { when: '20 Oct 2025', value: 'TT$150,000.00' }] })];
    one.vehicles = []; one.comms = []; one.history = []; one.crossSell = '';
    const ctx = await browser.newContext({ viewport: { width: 375, height: 760 }, reducedMotion: 'reduce' });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.setContent(withStub(portalHtml(one)), { waitUntil: 'load' }); await page.waitForTimeout(300);
    ok(errs.length === 0, 'reduced: no errors ' + errs.join('|'));
    const hidden = await page.$$eval('main *', els => els.filter(e => { const s = getComputedStyle(e); return e.offsetParent && (parseFloat(s.opacity) < 0.99) && !e.closest('.waves,.glide,.okbox,.errbox'); }).map(e => e.className).slice(0, 5));
    ok(hidden.length === 0, 'reduced: nothing faded out ' + hidden.join(','));
    ok(await page.$$eval('#pol0 .rr-steps li.done', n => n.length) === 4, 'renewed: every step done');
    ok(/Your cover is renewed/.test(await page.textContent('#pol0')), 'renewed: words');
    ok(/renewed/i.test(await page.$eval('#pol0 .rr-ring', e => e.textContent)) && !/overdue/.test(await page.textContent('#pol0')), 'renewed policy: no overdue alarm');
    ok(/down 6.7% from TT\$150,000 to TT\$140,000/.test(await page.textContent('#pol0')), 'submitted values charted oldest first');
    ok(/The values you have given us/.test(await page.textContent('#pol0')), 'submitted value history charted');
    ok(/No instructions yet/.test(await page.textContent('#hist')), 'empty history state');
    ok(await page.$$eval('#tabs button', b => b.length) === 2, 'one policy: two tabs');
    ok(await page.$eval('#pol0 [data-money]', e => e.textContent) === 'TT$6,421', 'money figure final under reduced motion');
    await page.screenshot({ path: path.join(SHOTS, 'portal-one-reduced.png'), fullPage: true });
    await ctx.close();
  }

  /* ===== survey mode ===== */
  for (const [w, h, tag] of [[360, 740, 'phone'], [1366, 900, 'desktop']]) {
    const sv = Object.assign({}, BASE, { survey: true });
    const ctx = await browser.newContext({ viewport: { width: w, height: h } });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.setContent(withStub(portalHtml(sv)), { waitUntil: 'load' }); await page.waitForTimeout(700);
    ok(errs.length === 0, 'survey ' + tag + ' no errors');
    ok(/How did we do, Anika\?/.test(await page.textContent('body')), 'survey ' + tag + ' title');
    ok(await noSideScroll(page), 'survey ' + tag + ' no sideways scroll');
    await page.click('#svSend');
    ok(/tap a star rating for all three/.test(await page.textContent('#svErr')), 'survey ' + tag + ' needs all three');
    await page.click('.stars[data-k="sat"] button[data-n="5"]');
    await page.click('.stars[data-k="ease"] button[data-n="4"]');
    await page.click('.stars[data-k="speed"] button[data-n="3"]');
    ok(await page.$$eval('.stars[data-k="ease"] button.on', n => n.length) === 4, 'survey ' + tag + ' stars fill');
    ok(/3 of 5 · Good/.test(await page.textContent('.stars[data-k="speed"] .lbl')), 'survey ' + tag + ' rating in words');
    ok(!(await page.isVisible('#svErr')), 'survey ' + tag + ' error clears once all three are rated');
    if (tag === 'phone') { await page.evaluate(() => scrollTo(0, 0)); await page.waitForTimeout(300); await page.screenshot({ path: path.join(SHOTS, 'survey-phone.png'), fullPage: true }); }
    await page.fill('#svComments', 'Quick and clear.');
    await page.click('#svSend'); await page.waitForTimeout(300);
    const c = (await page.evaluate(() => window.__calls)).find(x => x.fn === 'submitSurvey');
    ok(c && c.arg.token === 'tok-anika-1' && c.arg.sat === 5 && c.arg.ease === 4 && c.arg.speed === 3 && c.arg.comments === 'Quick and clear.', 'survey ' + tag + ' submitSurvey args');
    ok(await page.isVisible('#svOk') && !(await page.isVisible('#svSend')), 'survey ' + tag + ' thank you');
    if (tag === 'desktop') { await page.waitForTimeout(1200); await page.evaluate(() => scrollTo(0, 0)); await page.screenshot({ path: path.join(SHOTS, 'survey-done-desktop.png'), fullPage: true }); }
    await ctx.close();
  }

  /* ===== overdue, not yet renewed ===== */
  {
    const od = JSON.parse(JSON.stringify(BASE)); od.policies = [Object.assign(od.policies[1], { days: -3 })];
    const page = await browser.newPage({ viewport: { width: 360, height: 740 } }); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.setContent(withStub(portalHtml(od)), { waitUntil: 'load' }); await page.waitForTimeout(300);
    ok(errs.length === 0 && /3 days overdue/.test(await page.textContent('#pol0')) && /3\s*overdue/.test(await page.$eval('#pol0 .rr-ring', e => e.textContent)), 'overdue policy shows overdue');
    await page.close();
  }

  /* ===== not found ===== */
  {
    const page = await browser.newPage({ viewport: { width: 360, height: 740 } }); const errs = []; page.on('pageerror', e => errs.push(e.message));
    await page.setContent(withStub(portalHtml({ ok: false, agent: { name: 'Ricky Rampersad', phone: '(868) 678-5921' } })), { waitUntil: 'load' });
    ok(errs.length === 0 && /couldn't find your policy[\s\S]*Ricky Rampersad/.test(await page.textContent('body')), 'not found message');
    await page.close();
  }

  /* ===== Track your renewal (findPage_) ===== */
  {
    const plain = findHtml({ find: '1' });
    ok(plain && plain.includes('Track your renewal') && plain.includes(THEME.slice(0, 200)), 'find: built from Code.gs with the theme');
    ok(!/fonts.googleapis|#07131f|efc24b/i.test(plain.replace(THEME, '')), 'find: no Google Fonts, no near-black, no gold');
    const pre = findHtml({ find: '1', e: 'anika.pretend@example.com' });
    ok(pre.includes('value="anika.pretend@example.com"') && pre.split('anika.pretend@example.com').length === 2, 'find: e prefills the box only');
    const bad = findHtml({ find: '1', e: '"><script>alert(1)</script>@x.com' });
    ok(!bad.includes('<script>alert(1)') && !/id="em"[^>]*value=/.test(bad), 'find: a bad e is ignored');
    const notmail = findHtml({ find: '1', e: 'hello' });
    ok(!/id="em"[^>]*value=/.test(notmail), 'find: not an e-mail is ignored');
    const amp = findHtml({ find: '1', e: "o'neil&co@example.com" });
    ok(amp.includes('value="o&#39;neil&amp;co@example.com"'), 'find: prefill is escaped');

    for (const [w, h, tag] of sizes) {
      for (const which of ['plain', 'pre']) {
        const ctx = await browser.newContext({ viewport: { width: w, height: h } });
        const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(e.message));
        await page.setContent(withStub(which === 'pre' ? pre : plain), { waitUntil: 'load' }); await page.waitForTimeout(800);
        ok(errs.length === 0, 'find ' + tag + ' ' + which + ' no errors ' + errs.join('|'));
        ok(await noSideScroll(page), 'find ' + tag + ' ' + which + ' no sideways scroll');
        ok(await page.$('img[src*="board-mark.png"]') && await page.$$eval('.rr-band .waves', n => n.length) === 1, 'find ' + tag + ' mark and waves');
        if (which === 'pre') {
          ok(await page.inputValue('#em') === 'anika.pretend@example.com', 'find ' + tag + ' prefilled');
          ok(await page.evaluate(() => document.activeElement && document.activeElement.id === 'go'), 'find ' + tag + ' focus on the button');
          await page.keyboard.press('Enter'); await page.waitForTimeout(300);
          const c = (await page.evaluate(() => window.__calls)).find(x => x.fn === 'sendMyLink');
          ok(c && c.arg === 'anika.pretend@example.com', 'find ' + tag + ' one press sends');
          ok(/If that email is on a policy with us/.test(await page.textContent('#ok')) && await page.isVisible('#ok'), 'find ' + tag + ' same reply');
          ok(await page.$$eval('.fp-steps li.done', n => n.length) === 1, 'find ' + tag + ' steps move on');
          if (tag !== 'phone360') { await page.waitForTimeout(1200); await page.screenshot({ path: path.join(SHOTS, 'find-sent-' + tag + '.png'), fullPage: true }); }
        } else {
          ok(await page.inputValue('#em') === '', 'find ' + tag + ' empty without e');
          await page.click('#go');
          ok(/Please enter your email address/.test(await page.textContent('#err')), 'find ' + tag + ' needs an e-mail');
          if (tag !== 'phone360') await page.screenshot({ path: path.join(SHOTS, 'find-' + tag + '.png'), fullPage: true });
          await page.fill('#em', 'someone@example.com'); await page.click('#go'); await page.waitForTimeout(300);
          const c = (await page.evaluate(() => window.__calls)).find(x => x.fn === 'sendMyLink');
          ok(c && c.arg === 'someone@example.com' && await page.isVisible('#ok'), 'find ' + tag + ' sends typed e-mail');
          await page.evaluate(() => { window.__fail = true; });
        }
        await ctx.close();
      }
    }
    // failure path on find
    const page = await browser.newPage({ viewport: { width: 390, height: 844 } });
    await page.setContent(withStub(plain), { waitUntil: 'load' });
    await page.evaluate(() => { window.__fail = true; });
    await page.fill('#em', 'someone@example.com'); await page.click('#go'); await page.waitForTimeout(300);
    ok(/Something went wrong/.test(await page.textContent('#err')) && await page.$eval('#go', b => !b.disabled), 'find: failure shown, button restored');
    await page.close();
  }

  await browser.close();
  console.log(`\n${pass} passed, ${fail} failed. Screenshots: ${SHOTS}`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
