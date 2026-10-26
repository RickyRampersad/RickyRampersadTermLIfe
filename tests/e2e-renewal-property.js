// The property renewal portal (apps-script/PropertyPortal.html, served by
// propertyPage_ in Property.gs) in a real browser, with the shared renewal
// theme folded in as rrTheme_() would, made-up payloads in the shape the .gs
// builds and a fake google.script.run. It checks: the page in the renewal
// look (light, the blue shield, no gold, no emoji), the average graphic drawn
// from the payload's own figures, a changed value moving the total, the bar
// and the estimate, the reality check's three verdicts, the address and the
// instruction sent with the right payload, the progress after it, a policy
// with two locations, a link with ?opt=adjust, the survey, a bad link, three
// widths with no sideways scroll, and nothing hidden with reduced motion.
// Run: node tests/e2e-renewal-property.js   (needs playwright + chromium)
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const SHOTS = process.env.SHOTS || '/tmp/claude-0/-home-user-RickyRampersadTermLIfe/3c5124b6-4eb1-5162-b90c-3f3bcb9aa8d9/scratchpad/rr/property';
fs.mkdirSync(SHOTS, { recursive: true });

const TPL = fs.readFileSync(path.join(ROOT, 'apps-script/PropertyPortal.html'), 'utf8');
const THEME = fs.readFileSync(path.join(ROOT, 'apps-script/RenewalTheme.html'), 'utf8');
const STAGES = [
  { key: 'instructed', label: 'Instruction received', blurb: 'We have your instructions and your file is open.' },
  { key: 'crms', label: 'With Guardian CRMS', blurb: 'Your renewal is with the insurer for terms.' },
  { key: 'terms', label: 'Terms received', blurb: 'Renewal terms are in — we are checking them for you.' },
  { key: 'accepted', label: 'Accepted & payment', blurb: 'Terms agreed; payment being arranged.' },
  { key: 'issued', label: 'Schedule issued', blurb: 'Your policy schedule and documents are issued.' },
];
const LINES = [
  { key: 'building', label: 'Building' }, { key: 'stock', label: 'Stock' },
  { key: 'contents', label: 'Furniture / Fixtures / Fittings' }, { key: 'plant', label: 'Plant, Machinery & Equipment' },
  { key: 'electronic', label: 'Electronic Equipment' },
];
function risk(o) {
  const values = Object.assign({ building: 0, stock: 0, contents: 0, plant: 0, electronic: 0 }, o.values);
  const total = Object.values(values).reduce((a, b) => a + b, 0);
  return Object.assign({
    rowIndex: 2, location: '#12 Pretend Street, Chaguanas', occupancy: 'Hardware store', policy: 'TTFP 0000123', carrier: 'Guardian General',
    renewalDate: '15 Nov 2026', days: 20, values, total, premium: 9540, excess: 'Fire: 1% of sum insured; Flood: TT$10,000; All other: TT$2,500',
    email: 'anika@example.com', mobile: '868-555-0101', stage: '', stageUpdated: '', status: '', since: '01 Jan 2014', years: '12',
    valuesReviewed: '01 Jun 2021', guide: { total, years: 5.4, stale: true, suggested: Math.round(total * Math.pow(1.05, 5.4) / 1000) * 1000, note: 'x' },
    rate: 3.0, taxRate: 0.06, premiumHistory: [{ year: '2022', amount: 8200 }, { year: '2023', amount: 8650 }, { year: '2024', amount: 9100 }, { year: '2025', amount: 9540 }],
    progress: [],
  }, o, { values, total });
}
const BASE = {
  ok: true, token: 'tok-pretend', opt: '', survey: false,
  comms: [
    { when: '20 Oct 2026', label: 'Renewal invitation emailed to you', from: 'us', detail: 'Schedule of values and premium' },
    { when: '22 Oct 2026', label: 'You opened your renewal page', from: 'you', detail: '' },
  ],
  firstName: 'Anika', client: 'Anika Pretend Hardware Ltd', stages: STAGES, lines: LINES,
  agent: { name: 'Ricky Rampersad', phone: '868-555-0000' },
};
const ONE = Object.assign({}, BASE, { risks: [risk({ values: { building: 1200000, stock: 450000, contents: 120000, plant: 80000, electronic: 60000 } })] });
const TWO = Object.assign({}, BASE, { comms: [], risks: [
  risk({ rowIndex: 2, values: { building: 900000, stock: 300000, contents: 50000 } }),
  risk({ rowIndex: 3, location: 'Lot 4 Made-up Road, Couva', occupancy: 'Warehouse', values: { stock: 600000, plant: 150000 }, guide: { total: 750000, years: null, stale: true, suggested: null, note: 'none' }, premiumHistory: [] }),
] });
const SURVEY = Object.assign({}, ONE, { survey: true });
const BAD = Object.assign({}, BASE, { ok: false, firstName: '', risks: [] });
const STAGED = Object.assign({}, ONE, { risks: [risk({ values: { building: 1200000, stock: 450000 }, stage: 'crms',
  progress: [{ when: '24 Oct 2026', stage: 'crms', note: 'Sent to Guardian CRMS for terms', by: 'staff' }, { when: '23 Oct 2026', stage: 'instructed', note: 'RENEW — existing terms · 1 location(s)', by: 'client' }] })] });

function page(payload) {
  return TPL.replace('<?!= rrTheme_() ?>', () => THEME)
    .replace('<?!= JSON.stringify(payload) ?>', () => JSON.stringify(JSON.stringify(payload)));
}
const PAGES = { one: ONE, two: TWO, survey: SURVEY, bad: BAD, staged: STAGED };
const server = http.createServer((req, res) => {
  const u = req.url.split('?')[0];
  const m = u.match(/^\/p\/(\w+)\.html$/);
  if (m && PAGES[m[1]]) { res.writeHead(200, { 'Content-Type': 'text/html' }); return res.end(page(PAGES[m[1]])); }
  const f = path.join(ROOT, decodeURIComponent(u));
  if (fs.existsSync(f) && fs.statSync(f).isFile()) { res.writeHead(200, { 'Content-Type': f.endsWith('.png') ? 'image/png' : 'text/plain' }); return res.end(fs.readFileSync(f)); }
  res.writeHead(404); res.end('no');
});

/* The fake google.script.run: chainable, records each call, answers like the .gs. */
const FAKE = `window.__calls=[];window.__fail=false;
(function(){function R(){this.s=null;this.f=null;}
R.prototype.withSuccessHandler=function(f){this.s=f;return this};R.prototype.withFailureHandler=function(f){this.f=f;return this};R.prototype.withUserObject=function(){return this};
var answers={submitPropertyInstruction:function(p){return {ok:true,stage:'instructed',progress:[{when:'26 Oct 2026',stage:'instructed',note:p.instruction+' · '+p.locations.length+' location(s)',by:'client'}]}},submitSurvey:function(){return {ok:true}}};
var run={};Object.keys(answers).forEach(function(k){run[k]=function(){var r=this,a=[].slice.call(arguments);window.__calls.push({fn:k,args:a});setTimeout(function(){if(window.__fail){r.f&&r.f(new Error('Made-up failure'));return;}r.s&&r.s(answers[k].apply(null,a));},120);};});
['withSuccessHandler','withFailureHandler','withUserObject'].forEach(function(m){run[m]=function(f){var r=new R();Object.keys(answers).forEach(function(k){r[k]=run[k];});return r[m](f);};});
window.google={script:{run:run}};})();`;

let fails = 0, passes = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (c) passes++; else fails++; };

async function open(browser, name, vp, opts = {}) {
  const ctx = await browser.newContext({ viewport: vp, deviceScaleFactor: opts.dpr || 1, reducedMotion: opts.reduce ? 'reduce' : 'no-preference' });
  await ctx.route('https://rickyrampersadbranch.com/**', r => {
    const f = path.join(ROOT, new URL(r.request().url()).pathname);
    return fs.existsSync(f) ? r.fulfill({ path: f }) : r.fulfill({ status: 404, body: '' });
  });
  await ctx.addInitScript(FAKE);
  const p = await ctx.newPage();
  p.errors = [];
  p.on('pageerror', e => p.errors.push(e.message));
  p.on('console', m => { if (m.type() === 'error' && !/favicon|404/.test(m.text())) p.errors.push(m.text()); });
  await p.goto(`${base}/p/${name}.html${opts.q || ''}`);
  await p.waitForTimeout(opts.wait || 500);
  return p;
}
async function sideways(p) {
  return p.evaluate(() => { window.scrollTo(500, window.scrollY); const x = window.scrollX; window.scrollTo(0, window.scrollY);
    const wide = [...document.querySelectorAll('body *')].filter(e => { const r = e.getBoundingClientRect(); return r.width && r.right > innerWidth + 1 && !e.closest('.waves,.rr-tabs'); }).map(e => e.tagName + '.' + e.className).slice(0, 5);
    return { x, wide }; });
}
async function scrollThrough(p) {
  await p.evaluate(async () => { for (let y = 0; y < document.body.scrollHeight; y += 300) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 30)); } window.scrollTo(0, 0); });
  await p.waitForTimeout(900);
}
let base;
(async () => {
  await new Promise(r => server.listen(0, r));
  base = 'http://127.0.0.1:' + server.address().port;
  const browser = await chromium.launch();

  /* ---- 1. the page in the renewal look, at three widths ---- */
  for (const [w, h, tag] of [[360, 740, 'phone360'], [390, 844, 'phone390'], [1366, 900, 'desk']]) {
    const p = await open(browser, 'one', { width: w, height: h }, { dpr: w < 500 ? 2 : 1 });
    ok(`${tag}: no page errors`, p.errors.length === 0, p.errors.join(' | '));
    const sw = await sideways(p);
    ok(`${tag}: no sideways scroll`, sw.x === 0 && sw.wide.length === 0, JSON.stringify(sw));
    await scrollThrough(p);
    await p.screenshot({ path: path.join(SHOTS, `property-${tag}.png`), fullPage: true });
    await p.screenshot({ path: path.join(SHOTS, `property-${tag}-first.png`) });
    if (tag === 'desk') {
      const side = await p.evaluate(() => { const m = document.querySelector('.pmain').getBoundingClientRect(), s = document.querySelector('.pside').getBoundingClientRect(); return s.left > m.right - 2; });
      ok('desk: progress and premium history sit in a second column', side);
    }
    if (tag === 'phone360') {
      const small = await p.evaluate(() => [...document.querySelectorAll('button, .opt, input[type=text], input[type=email], input[inputmode]')].filter(e => { const r = e.getBoundingClientRect(); return r.width && r.height < 40; }).map(e => e.outerHTML.slice(0, 60)));
      ok('phone360: every button and field is 40px or taller', small.length === 0, small.join(' | '));
    }
    await p.context().close();
  }

  const p = await open(browser, 'one', { width: 390, height: 844 }, { dpr: 2 });
  const look = await p.evaluate(() => {
    const bg = getComputedStyle(document.body).backgroundColor;
    const text = document.body.innerText;
    return {
      rr: document.body.classList.contains('rr'), mark: document.querySelector('.rr-top .mark img').getAttribute('src'),
      band: !!document.querySelector('.hero .rr-band.t-prop .waves'), fonts: !!document.querySelector('link[href*="fonts.googleapis"]'),
      emoji: /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}⭐]/u.test(text), gold: /efc24b|dca530|c9942c/i.test(document.documentElement.outerHTML),
      dark: [...document.querySelectorAll('.rr-card,.loc,body')].some(e => { const m = getComputedStyle(e).backgroundColor.match(/\d+/g); return m && m.length >= 3 && (+m[0] + +m[1] + +m[2]) < 150 && (m[3] === undefined || +m[3] > 0); }),
      words: /orphan|reassigned|lapse|verify your details/i.test(text), bg,
      tabs: [...document.querySelectorAll('#tabs button')].map(b => b.textContent.trim()),
    };
  });
  ok('the theme is on the page (body.rr)', look.rr);
  ok('the blue shield is the mark', /orphan-transition\/board-mark\.png$/.test(look.mark));
  ok('the welcome is a violet band with waves', look.band);
  ok('no Google Fonts link', !look.fonts);
  ok('no emoji anywhere', !look.emoji);
  ok('no gold in the page', !look.gold);
  ok('no dark backgrounds', !look.dark, look.bg);
  ok('no words kept off client pages', !look.words);
  ok('tabs: values, average, instruction, progress, messages', look.tabs.join('|') === 'Values|Average|Instruction|Progress|Messages 2', look.tabs.join('|'));

  /* the figures, counted up and in text */
  const figs = await p.evaluate(() => ({
    stats: document.querySelector('.hero .stats').textContent.replace(/\s+/g, ' '),
    polval: document.getElementById('polval_0').textContent,
    tiles: document.querySelector('.phead .rr-tiles').textContent.replace(/\s+/g, ' '),
    ring: document.querySelector('.phead .rr-ring').getAttribute('aria-label'),
    cols: [...document.querySelectorAll('.rr-cols .c')].map(c => c.getAttribute('aria-label')),
    mix: [...document.querySelectorAll('#mix_0 .rr-stack i')].map(l => parseFloat(l.style.width)),
    rows: [...document.querySelectorAll('#loc_0 .vrow')].map(l => l.querySelector('.lab').textContent.trim() + ' ' + l.querySelector('input').value),
    exc: [...document.querySelectorAll('.exchip')].map(e => e.textContent.trim()),
    comms: [...document.querySelectorAll('#comms li')].map(l => l.textContent.replace(/\s+/g, ' ').trim()),
  }));
  ok('welcome stats: renewal date, days, locations, years', /15 Nov 2026/.test(figs.stats) && /20\s*days to go/.test(figs.stats) && /1\s*location/.test(figs.stats) && /12\s*years with us/.test(figs.stats), figs.stats);
  ok('policy total sums insured in text', figs.polval === 'TT$1,910,000', figs.polval);
  ok('renewal premium tile', /TT\$9,540/.test(figs.tiles), figs.tiles);
  ok('days ring says the days in words', /20 days to renewal/.test(figs.ring), figs.ring);
  ok('premium history: a column a year, value in text', figs.cols.length === 4 && figs.cols[3] === '2025: TT$9,540', figs.cols.join(' | '));
  ok('value mix bar: a segment a line, to scale', figs.mix.length === 5 && Math.abs(figs.mix[0] - 1200000 / 1910000 * 100) < 0.01 && Math.abs(figs.mix.reduce((a, b) => a + b, 0) - 100) < 0.05, figs.mix.join(' | '));
  ok('each value line in text beside its colour', figs.rows.length === 5 && figs.rows[0] === 'Building 1,200,000', figs.rows.join(' | '));
  ok('excess chips', figs.exc.length === 3 && /Flood TT\$10,000/.test(figs.exc[1]), figs.exc.join(' | '));
  ok('communication history, with who it came from in words', figs.comms.length === 2 && /From us/.test(figs.comms[0]) && /From you/.test(figs.comms[1]), figs.comms.join(' | '));

  /* the average graphic: seeded with our estimate, which is above the cover */
  const seeded = await p.evaluate(() => {
    const g = document.getElementById('rcg_0'), f = k => g.querySelector(`[data-f="${k}"]`);
    return { rc: document.getElementById('rc_0').value, under: g.classList.contains('under'), rp: f('rp').textContent, rl: f('rl').textContent,
      rv: f('rv').textContent, gl: f('gl').textContent, pay: f('payv').textContent, carry: f('carryv').textContent,
      sw: parseFloat(f('sb').style.width), verdict: document.getElementById('rcv_0').textContent.replace(/\s+/g, ' ') };
  });
  // 1,910,000 * 1.05^5.4 rounded to the thousand
  const sug = Math.round(1910000 * Math.pow(1.05, 5.4) / 1000) * 1000;
  const pct = Math.round(1910000 / sug * 100);
  ok('reality check opens on our estimate, not the client\'s own figure', seeded.rc === sug.toLocaleString('en-US'), seeded.rc);
  ok('average graphic: under-insured against our estimate', seeded.under && seeded.rp === pct + '%' && seeded.rl === 'Our estimate of rebuilding cost', JSON.stringify(seeded));
  ok('average graphic: the gap in money and percent', seeded.gl === `Short by TT$${(sug - 1910000).toLocaleString('en-US')} (${100 - pct}%)`, seeded.gl);
  ok('average graphic: the claim split in text', seeded.pay === 'TT$' + Math.round(100000 * 1910000 / sug).toLocaleString('en-US') && seeded.carry === 'TT$' + Math.round(100000 * (1 - 1910000 / sug)).toLocaleString('en-US'), seeded.pay + ' / ' + seeded.carry);
  ok('average graphic: the cover bar drawn to scale', Math.abs(seeded.sw - 1910000 / sug * 100) < 0.1, String(seeded.sw));
  ok('verdict: average cuts every claim, said against our estimate', /Insured at \d+% of our estimated rebuilding cost/.test(seeded.verdict), seeded.verdict);

  /* the client puts in their own figure: lower than the cover */
  await p.fill('#rc_0', '1500000'); await p.locator('#rc_0').blur(); await p.waitForTimeout(200);
  const full = await p.evaluate(() => ({ v: document.getElementById('rcv_0').textContent, under: document.getElementById('rcg_0').classList.contains('under'), rp: document.querySelector('#rcg_0 [data-f="rp"]').textContent }));
  ok('own figure below the cover: insured at full value', /Insured at full value/.test(full.v) && !full.under && full.rp === '127%', JSON.stringify(full));
  await p.fill('#rc_0', ''); await p.locator('#rc_0').blur(); await p.waitForTimeout(150);
  const none = await p.evaluate(() => ({ v: document.getElementById('rcv_0').textContent, nofig: document.getElementById('rcg_0').classList.contains('nofig'), shown: getComputedStyle(document.getElementById('rcv_0')).display }));
  ok('no figure: the verdict stays silent, the graphic asks for one', none.v === '' && none.nofig && none.shown === 'none', JSON.stringify(none));
  await p.fill('#rc_0', '2500000'); await p.locator('#rc_0').blur(); await p.waitForTimeout(150);
  const own = await p.evaluate(() => document.getElementById('rcv_0').textContent);
  ok('own figure above the cover: 76%, a $100,000 loss pays TT$76,400', /Insured at 76% of that rebuilding cost/.test(own) && /TT\$76,400/.test(own), own.replace(/\s+/g, ' '));

  /* change a value: the total, the bar of lines, the estimate, the sticky bar */
  ok('the sticky bar is hidden until a figure changes', await p.evaluate(() => document.getElementById('bar').style.display === 'none'));
  await p.click('#val_0_building'); await p.fill('#val_0_building', '1500000'); await p.locator('#val_0_building').blur(); await p.waitForTimeout(250);
  const after = await p.evaluate(() => ({
    tot: document.getElementById('tot_0').textContent, changed: document.getElementById('tot_0').classList.contains('changed'),
    was: document.getElementById('was_0_building').textContent, polval: document.getElementById('polval_0').textContent,
    est: document.getElementById('est_0').textContent.replace(/\s+/g, ' '), estShown: getComputedStyle(document.getElementById('est_0')).display,
    bar: document.getElementById('bar').style.display, nums: document.getElementById('barNums').textContent.replace(/\s+/g, ' '),
    mix: parseFloat(document.querySelector('#mix_0 .rr-stack i[data-k="building"]').style.width), verdict: document.getElementById('rcv_0').textContent,
    val: document.getElementById('val_0_building').value,
  }));
  ok('a changed value moves the total and marks it', after.tot === 'TT$2,210,000' && after.changed && after.was === 'was 1,200,000' && after.val === '1,500,000', JSON.stringify(after));
  ok('the policy total follows', after.polval === 'TT$2,210,000', after.polval);
  ok('premium estimate at the client\'s rate', after.estShown !== 'none' && /≈ TT\$7,027\.80/.test(after.est) && /less than now/.test(after.est), after.est);
  ok('the progress bar shows with the numbers', after.bar === 'block' && /New total: TT\$2,210,000/.test(after.nums) && /\+TT\$300,000/.test(after.nums) && /Est\. premium: ≈ TT\$7,027\.80/.test(after.nums), after.nums);
  ok('the bar of value lines follows', Math.abs(after.mix - 1500000 / 2210000 * 100) < 0.01, String(after.mix));
  ok('the reality check reads the new total (88%)', /Insured at 88%/.test(after.verdict), after.verdict.replace(/\s+/g, ' '));
  await p.screenshot({ path: path.join(SHOTS, 'property-phone-changed.png') });
  await p.click('#bar button'); await p.waitForTimeout(900);
  ok('Review & send scrolls to the send card', await p.evaluate(() => { const r = document.getElementById('sendcard0').getBoundingClientRect(); return r.top < innerHeight && r.bottom > 0; }));

  /* tabs go to their sections */
  await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(200);
  await p.click('#tabs button:has-text("Progress")'); await p.waitForTimeout(900);
  ok('the Progress tab goes to the progress card', await p.evaluate(() => { const r = document.getElementById('track0').getBoundingClientRect(); return r.top >= 0 && r.top < 260; }));
  ok('the progress card says the journey starts with the instruction', await p.evaluate(() => /starts when you send your instruction/.test(document.getElementById('track0').textContent) && document.querySelectorAll('#track0 .tstep').length === 5));

  /* address correction box */
  await p.locator('#addrok_0').uncheck(); await p.waitForTimeout(100);
  ok('unticking the address opens the correction box', await p.isVisible('#addrnew_0'));
  await p.fill('#addrnew_0', '#12A Pretend Street, Chaguanas');
  await p.fill('#occ_0', 'Hardware store and office');

  /* send: the checks first, then the payload */
  await p.click('[data-submit="0"]'); await p.waitForTimeout(150);
  ok('sending with no instruction asks for one', /Choose an instruction/.test(await p.textContent('#err0')));
  await p.click('.opt.o-adjust'); await p.waitForTimeout(100);
  ok('choosing an option marks it', await p.evaluate(() => document.querySelector('.opt.o-adjust').classList.contains('sel') && !document.querySelector('.opt.o-renew').classList.contains('sel')));
  await p.click('[data-submit="0"]'); await p.waitForTimeout(150);
  ok('sending without the declaration asks for it', /tick the declaration/.test(await p.textContent('#err0')));
  await p.check('#mf_0');
  await p.fill('#notes0', 'New shelving in the stock room.');
  await p.evaluate(() => { window.__fail = true; });
  await p.click('[data-submit="0"]'); await p.waitForTimeout(400);
  ok('a failure says so and lets the client try again', /Something went wrong: Made-up failure/.test(await p.textContent('#err0')) && !(await p.isDisabled('[data-submit="0"]')));
  await p.evaluate(() => { window.__fail = false; window.__calls = []; });
  await p.click('[data-submit="0"]'); await p.waitForTimeout(700);
  const call = await p.evaluate(() => window.__calls[0]);
  const a = call && call.args[0];
  ok('submitPropertyInstruction is called once', call && call.fn === 'submitPropertyInstruction');
  ok('the payload: token, policy, instruction, notes, email, mobile', a && a.token === 'tok-pretend' && a.rowIndex === 2 && a.policy === 'TTFP 0000123' && a.instruction === 'RENEW — adjusted values' && a.notes === 'New shelving in the stock room.' && a.email === 'anika@example.com' && a.mobile === '868-555-0101', JSON.stringify(a));
  ok('the payload: the location with its adjusted value and the address', a && a.locations.length === 1 && a.locations[0].adjusted.building === 1500000 && Object.keys(a.locations[0].adjusted).length === 1 && a.locations[0].addressConfirmed === false && a.locations[0].addressCorrection === '#12A Pretend Street, Chaguanas' && a.locations[0].occupancy === 'Hardware store and office', JSON.stringify(a && a.locations));
  const done = await p.evaluate(() => ({ on: document.querySelector('.phead .rr-steps li.on') && document.querySelector('.phead .rr-steps li.on').textContent, stage: document.querySelector('.phead .stage').textContent, now: document.querySelector('#track0 .tstep.now h4').textContent, feed: document.querySelector('#track0 .rr-tl') && document.querySelector('#track0 .rr-tl').textContent, bar: document.getElementById('bar').style.display, toast: !!document.querySelector('.rr-toast') }));
  ok('after sending, the journey shows "Instruction received"', done.on === 'Instruction received' && /Where it stands: Instruction received/.test(done.stage) && /Instruction received/.test(done.now), JSON.stringify(done));
  ok('after sending, the latest step is in the feed, the bar is gone, a toast says sent', /RENEW — adjusted values/.test(done.feed || '') && done.bar === 'none' && done.toast, JSON.stringify(done));
  ok('phone 390: no errors after the whole flow', p.errors.length === 0, p.errors.join(' | '));
  await p.context().close();

  /* ---- 2. two locations, one with no review date: we suggest nothing ---- */
  {
    const q = await open(browser, 'two', { width: 360, height: 740 }, { dpr: 2 });
    const t = await q.evaluate(() => ({
      locs: document.querySelectorAll('#cover0 .loc').length, rc1: document.getElementById('rc_1').value,
      hint1: document.querySelector('#loc_1 .rhint').textContent, explain: document.getElementById('avg0').textContent,
      noBuilding: !document.getElementById('val_1_building'), tabs: [...document.querySelectorAll('#tabs button')].map(b => b.textContent.trim()),
      v1: document.getElementById('rcv_1').textContent, polval: document.getElementById('polval_0').textContent,
    }));
    ok('two locations under one policy', t.locs === 2 && t.polval === 'TT$2,000,000', JSON.stringify(t));
    ok('no review date: nothing suggested, and it asks', t.rc1 === '' && /no record/.test(t.hint1) && t.v1 === '', t.hint1);
    ok('a location with no building does not offer the building line', t.noBuilding);
    ok('the explainer says average applies to each location separately', /each location separately/.test(t.explain));
    ok('one policy, no messages: four tabs', t.tabs.join('|') === 'Values|Average|Instruction|Progress', t.tabs.join('|'));
    await q.click('.opt.o-renew'); await q.check('#mf_0'); await q.evaluate(() => { window.__calls = []; });
    await q.click('[data-submit="0"]'); await q.waitForTimeout(500);
    const a2 = await q.evaluate(() => window.__calls[0] && window.__calls[0].args[0]);
    ok('two locations are sent together, unchanged', a2 && a2.locations.length === 2 && a2.locations.every(l => Object.keys(l.adjusted).length === 0 && l.addressConfirmed === true) && a2.instruction === 'RENEW — existing terms', JSON.stringify(a2 && a2.locations));
    const sw = await sideways(q);
    ok('two locations, 360: no sideways scroll, no errors', sw.x === 0 && sw.wide.length === 0 && q.errors.length === 0, JSON.stringify(sw) + q.errors.join('|'));
    await q.context().close();
  }

  /* ---- 3. a renewal already moving, on a desktop ---- */
  {
    const q = await open(browser, 'staged', { width: 1366, height: 900 });
    const t = await q.evaluate(() => ({ done: document.querySelectorAll('.phead .rr-steps li.done').length, on: document.querySelector('.phead .rr-steps li.on').textContent,
      feed: [...document.querySelectorAll('#track0 .rr-tl li')].map(l => l.textContent.replace(/\s+/g, ' ').trim()), words: [...document.querySelectorAll('#track0 .rr-pill')].map(x => x.textContent) }));
    ok('stage "With Guardian CRMS": one step done, the second now', t.done === 1 && t.on === 'With Guardian CRMS', JSON.stringify(t));
    ok('progress feed newest first, each step said in words', t.feed.length === 2 && /24 Oct 2026/.test(t.feed[0]) && t.words.join(',') === 'Done,Now', JSON.stringify(t));
    await scrollThrough(q);
    await q.screenshot({ path: path.join(SHOTS, 'property-desk-staged.png'), fullPage: true });
    await q.context().close();
  }

  /* ---- 4. a link from the e-mail: ?opt=adjust preselects ---- */
  {
    const ADJ = Object.assign({}, ONE, { opt: 'adjust' }); PAGES.adj = ADJ;
    const q = await open(browser, 'adj', { width: 390, height: 844 }, { wait: 900 });
    ok('?opt=adjust preselects "Renew with my adjusted values"', await q.evaluate(() => document.querySelector('input[name="inst0"]:checked').value === 'RENEW — adjusted values' && document.querySelector('.opt.o-adjust').classList.contains('sel')));
    await q.context().close();
  }

  /* ---- 5. reduced motion: nothing invisible, nothing moving ---- */
  {
    const q = await open(browser, 'one', { width: 390, height: 844 }, { reduce: true, dpr: 2 });
    const r = await q.evaluate(() => {
      const hidden = [...document.querySelectorAll('.rr-card, .loc, .rr-tile, .rr-cols .c i, .demo i, .rr-stack i, .howto li')].filter(e => +getComputedStyle(e).opacity < 0.99).length;
      const moving = [...document.querySelectorAll('body *')].filter(e => getComputedStyle(e).animationName !== 'none').length;
      return { hidden, moving, cu: document.querySelector('.hero .stats .cu').textContent };
    });
    ok('reduced motion: nothing left invisible', r.hidden === 0, JSON.stringify(r));
    ok('reduced motion: no animation runs', r.moving === 0, JSON.stringify(r));
    await q.screenshot({ path: path.join(SHOTS, 'property-phone-reduced.png'), fullPage: true });
    await q.context().close();
  }

  /* ---- 6. the survey ---- */
  for (const [w, h, tag] of [[360, 740, 'phone'], [1366, 900, 'desk']]) {
    const q = await open(browser, 'survey', { width: w, height: h }, { dpr: w < 500 ? 2 : 1 });
    await q.click('#svSend'); await q.waitForTimeout(100);
    ok(`survey ${tag}: asks for all three ratings`, /all three questions/.test(await q.textContent('#svErr')));
    await q.click('.stars[data-k="sat"] button[data-n="5"]');
    await q.click('.stars[data-k="ease"] button[data-n="4"]');
    await q.click('.stars[data-k="speed"] button[data-n="3"]');
    const s = await q.evaluate(() => ({ on: document.querySelectorAll('.stars[data-k="ease"] button.on').length, word: document.querySelector('.stars[data-k="ease"] .sv').textContent, pressed: document.querySelector('.stars[data-k="sat"] button[data-n="5"]').getAttribute('aria-pressed') }));
    ok(`survey ${tag}: stars light up to the one tapped, with the score in words`, s.on === 4 && s.word === '4 of 5' && s.pressed === 'true', JSON.stringify(s));
    await q.fill('#svComments', 'Quick and clear.');
    if (tag === 'phone') await q.screenshot({ path: path.join(SHOTS, 'property-survey-phone.png'), fullPage: true });
    await q.evaluate(() => { window.__calls = []; });
    await q.click('#svSend'); await q.waitForTimeout(400);
    const c = await q.evaluate(() => window.__calls[0]);
    ok(`survey ${tag}: submitSurvey with the three scores and the comment`, c && c.fn === 'submitSurvey' && JSON.stringify(c.args[0]) === JSON.stringify({ token: 'tok-pretend', sat: 5, ease: 4, speed: 3, comments: 'Quick and clear.' }), JSON.stringify(c));
    ok(`survey ${tag}: thank-you shown`, await q.isVisible('#svOk'));
    const sw = await sideways(q);
    ok(`survey ${tag}: no sideways scroll, no errors`, sw.x === 0 && sw.wide.length === 0 && q.errors.length === 0, JSON.stringify(sw) + q.errors.join('|'));
    if (tag === 'desk') await q.screenshot({ path: path.join(SHOTS, 'property-survey-desk.png'), fullPage: true });
    await q.context().close();
  }

  /* ---- 7. a link that matches nothing ---- */
  {
    const q = await open(browser, 'bad', { width: 360, height: 740 });
    const t = await q.textContent('#app');
    ok('a bad link: says so and names who to contact', /couldn't find your renewal/.test(t) && /Ricky Rampersad at 868-555-0000/.test(t), t.replace(/\s+/g, ' '));
    ok('a bad link: no errors', q.errors.length === 0, q.errors.join('|'));
    await q.screenshot({ path: path.join(SHOTS, 'property-notfound.png'), fullPage: true });
    await q.context().close();
  }

  await browser.close(); server.close();
  console.log(`\n${passes} passed, ${fails} failed`);
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
