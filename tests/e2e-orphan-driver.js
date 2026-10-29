// The Branch Manager's drive on the Branch Intelligence wall (28 October 2026): "Driving the campaign" (orphans-driver.html),
// in a real browser, fed the way the campaign script feeds it (GET action=board&who=wall), at the branch television, two
// laptops and a phone.
// Pinned here:
//   - nothing below the fold and nothing cut through on the television and the laptops; no sideways scroll anywhere;
//   - his prompts since 25 September as one bar by kind; four figures: answered, the lift on his busiest days, the share of
//     the team's notes after a prompt, what his automation sent; one insight at a time, and all of them on the ticker;
//   - the flow (kind → when → who), every ribbon drawn and flowing; the hour of day; how fast the answer comes; the stream
//     of the last twenty working days; the team, each with a ring; nothing invisible with motion off;
//   - Javid and Aleema nowhere on the page;
//   - a script older than the drive says what to paste; a dead feed after a good one paints the last good answer;
//   - the shield, the narration (six lines), the views beacon, and the stop on the wall after the cup.
// Run: node tests/e2e-orphan-driver.js   (SHOTS=<dir> to keep screenshots)
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME_PATH || undefined;
const PORT = 8873;
const SHOTS = process.env.SHOTS || '';
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.mp3': 'audio/mpeg' };
const server = http.createServer((req, res) => {
  const f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (!fs.existsSync(f) || fs.statSync(f).isDirectory()) { res.writeHead(404); return res.end('no'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x && !c ? '  — ' + x : '')); if (!c) fails++; };

/* the shape of the real answer on 28 October 2026: counts only, no client, no note */
const DRIVE = {"flow":{"kinds":{"hand":{"same":5,"next":6,"later":6,"open":7},"chase":{"same":75,"next":70,"later":44,"open":176},"instr":{"same":73,"next":263,"later":258,"open":67},"move":{"same":119,"next":67,"later":39,"open":49},"list":{"same":24,"next":13,"later":3,"open":31}},"who":{"same":{"sasha":144,"kamla":28,"azariah":62,"liz":62},"next":{"kamla":21,"azariah":99,"liz":131,"sasha":168},"later":{"kamla":25,"azariah":94,"liz":122,"sasha":109},"open":{"sasha":30,"liz":68,"kamla":148,"azariah":84}}},"hours":{"from":5,"prompts":[0,156,262,130,379,53,85,14,9,56,42,195,8,3,3],"notes":[0,0,28,110,81,200,189,61,53,57,95,119,8,1,1],"peakPrompts":9,"peakNotes":10},"wave":{"edges":[1,2,4,8,24,48,72,1000000000],"counts":[63,55,80,76,70,161,129,431],"median":50.7,"within4":198,"within24":344,"answered":1065},"weeks":[{"w":"28 Sep","prompts":183,"answered":182,"same":6,"notes":7,"after":6},{"w":"5 Oct","prompts":126,"answered":116,"same":10,"notes":204,"after":158},{"w":"12 Oct","prompts":297,"answered":262,"same":61,"notes":214,"after":114},{"w":"19 Oct","prompts":455,"answered":339,"same":109,"notes":270,"after":136},{"w":"26 Oct","prompts":334,"answered":166,"same":110,"notes":308,"after":98}],"lift":{"busy":44.7,"quiet":27.8,"busyPrompts":94.7,"quietPrompts":9,"r":0.32,"days":23},"parked":{"notes":170,"tasks":120,"now":13},"stream":[{"d":"2026-10-01","label":"Thu 1","hand":0,"auto":0,"notes":0,"after":0},{"d":"2026-10-02","label":"Fri 2","hand":0,"auto":176,"notes":7,"after":6},{"d":"2026-10-05","label":"Mon 5","hand":0,"auto":42,"notes":54,"after":41},{"d":"2026-10-06","label":"Tue 6","hand":0,"auto":19,"notes":41,"after":36},{"d":"2026-10-07","label":"Wed 7","hand":0,"auto":9,"notes":60,"after":44},{"d":"2026-10-08","label":"Thu 8","hand":0,"auto":6,"notes":49,"after":37},{"d":"2026-10-09","label":"Fri 9","hand":0,"auto":50,"notes":0,"after":0},{"d":"2026-10-12","label":"Mon 12","hand":0,"auto":12,"notes":42,"after":22},{"d":"2026-10-13","label":"Tue 13","hand":0,"auto":11,"notes":60,"after":25},{"d":"2026-10-14","label":"Wed 14","hand":0,"auto":98,"notes":33,"after":18},{"d":"2026-10-15","label":"Thu 15","hand":0,"auto":104,"notes":44,"after":25},{"d":"2026-10-16","label":"Fri 16","hand":2,"auto":69,"notes":35,"after":24},{"d":"2026-10-19","label":"Mon 19","hand":3,"auto":87,"notes":51,"after":23},{"d":"2026-10-20","label":"Tue 20","hand":1,"auto":78,"notes":50,"after":38},{"d":"2026-10-21","label":"Wed 21","hand":4,"auto":60,"notes":14,"after":13},{"d":"2026-10-22","label":"Thu 22","hand":0,"auto":128,"notes":89,"after":38},{"d":"2026-10-23","label":"Fri 23","hand":0,"auto":81,"notes":66,"after":24},{"d":"2026-10-26","label":"Mon 26","hand":0,"auto":65,"notes":12,"after":7},{"d":"2026-10-27","label":"Tue 27","hand":3,"auto":83,"notes":91,"after":17},{"d":"2026-10-28","label":"Wed 28","hand":8,"auto":175,"notes":205,"after":74}],"days":[{"d":"2026-10-15","label":"Thu 15","hand":0,"auto":104,"notes":44,"after":25},{"d":"2026-10-16","label":"Fri 16","hand":2,"auto":69,"notes":35,"after":24},{"d":"2026-10-19","label":"Mon 19","hand":3,"auto":87,"notes":51,"after":23},{"d":"2026-10-20","label":"Tue 20","hand":1,"auto":78,"notes":50,"after":38},{"d":"2026-10-21","label":"Wed 21","hand":4,"auto":60,"notes":14,"after":13},{"d":"2026-10-22","label":"Thu 22","hand":0,"auto":128,"notes":89,"after":38},{"d":"2026-10-23","label":"Fri 23","hand":0,"auto":81,"notes":66,"after":24},{"d":"2026-10-26","label":"Mon 26","hand":0,"auto":65,"notes":12,"after":7},{"d":"2026-10-27","label":"Tue 27","hand":3,"auto":83,"notes":91,"after":17},{"d":"2026-10-28","label":"Wed 28","hand":8,"auto":175,"notes":205,"after":74}],"posts":{"all":{"own":24,"chase":365,"list":40,"intel":31,"follow":661,"move":274,"hold":105,"name":16,"auto":14},"week":{"own":8,"chase":65,"list":40,"intel":6,"follow":10,"move":54,"hold":0,"name":10,"auto":0},"today":{"own":8,"chase":65,"list":40,"intel":6,"follow":10,"move":54,"hold":0,"name":10,"auto":0},"hand":{"all":24,"week":8,"today":8},"auto":{"all":1371,"week":175,"today":175},"tasks":336},"answer":{"prompts":1395,"answered":1065,"same":296,"next":419,"later":350,"open":330,"hand":{"prompts":24,"answered":17,"same":5}},"notes":1003,"after":512,"team":[{"hours":76.3,"name":"Liz","notes":268,"after":147,"own":121,"closes":22,"waiting":68,"read":{"drive":12,"park":58,"record":147,"status":51},"themes":{"r":118,"t":83,"p":59,"k":0,"z":0,"a":0,"q":1,"m":34,"d":0,"n":11,"v":35,"x":16},"answered":200,"same":60},{"hours":28.2,"name":"Sasha","notes":454,"after":209,"own":245,"closes":94,"waiting":30,"read":{"drive":28,"park":71,"record":195,"status":160},"themes":{"r":119,"t":82,"p":59,"k":66,"z":3,"a":12,"q":6,"m":35,"d":1,"n":13,"v":15,"x":86},"answered":451,"same":135},{"hours":53.5,"name":"Azariah","notes":238,"after":131,"own":107,"closes":50,"waiting":84,"read":{"drive":1,"park":51,"record":59,"status":127},"themes":{"r":37,"t":17,"p":51,"k":15,"z":9,"a":0,"q":1,"m":11,"d":0,"n":0,"v":50,"x":92},"answered":255,"same":76},{"hours":33.3,"name":"Kamla","notes":43,"after":25,"own":18,"closes":5,"waiting":148,"read":{"drive":8,"park":1,"record":23,"status":11},"themes":{"r":20,"t":13,"p":1,"k":6,"z":3,"a":0,"q":0,"m":5,"d":0,"n":8,"v":0,"x":9},"answered":74,"same":22}],"since":"2026-09-25","periods":{"week":"2026-10-28"},"named":{"board":7,"salesforce":17},"mail":{"total":4321,"kinds":[{"key":"letters","label":"Letters to clients","n":1477,"to":"clients"},{"key":"reminders","label":"Reminders to clients","n":1199,"to":"clients"},{"key":"receipts","label":"Thank-you receipts","n":278,"to":"clients"},{"key":"late","label":"Late alerts to the branch","n":653,"to":"branch"},{"key":"replies","label":"Client replies read and filed","n":447,"to":"branch"},{"key":"briefs","label":"Briefs to agents","n":72,"to":"agents"},{"key":"still","label":"\"Still on it\" notes","n":87,"to":"clients"},{"key":"notes","label":"Notes in his name","n":41,"to":"clients"},{"key":"again","label":"Letters sent again","n":38,"to":"clients"},{"key":"clock","label":"Reminders on clients waiting","n":14,"to":"agents"},{"key":"intros","label":"Introductions to their agent","n":9,"to":"clients"},{"key":"chasing","label":"Alerts when a client chases","n":6,"to":"branch"}]}};
const FEED = { ok: true, wall: 1, at: '28 Oct, 3:10 PM', today: '2026-10-28', sf: { on: true },
  agents: { clients: 72, week: 41, today: 30, people: [{ name: 'Neil R.', clients: 12, week: 2, today: 0, feedback: 0 }] },
  charge: { agents: [], namers: [{ name: 'Branch Manager', n: 7 }, { name: 'In Salesforce', n: 17 }], support: [] },
  drive: DRIVE };

let mode = 'good', feed = FEED;
async function open(b, vp) {
  const ctx = await b.newContext({ viewport: vp });
  const page = await ctx.newPage();
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.route('https://script.google.com/**', r => {
    const u = r.request().url();
    if (mode === 'good' && /action=board/.test(u) && /who=wall/.test(u)) return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(feed) });
    if (mode === 'old') return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: false, refused: true, error: 'That name or number was not found.' }) });
    return r.abort();
  });
  await page.route('https://fonts.googleapis.com/**', r => r.abort());
  return { ctx, page, errs };
}
const shot = async (page, n) => { if (SHOTS) await page.screenshot({ path: path.join(SHOTS, n + '.png') }); };
const fit = page => page.evaluate(() => {
  const H = innerHeight, W = innerWidth, out = [], cut = [];
  document.querySelectorAll('.card, .tc, .ticker, header, .insight, .keys, .klg').forEach(el => { const r = el.getBoundingClientRect(); if (r.bottom > H + 1 || r.right > W + 1) out.push(el.className + ' ' + Math.round(r.bottom) + '/' + H); });
  /* nothing spills out of its card */
  document.querySelectorAll('.card').forEach(c => { const cr = c.getBoundingClientRect(); c.querySelectorAll('.tc, .keys, .klg, .kbar, .chart, p, .bm .num span, .bm .num small').forEach(el => { const r = el.getBoundingClientRect(); if (r.bottom > cr.bottom + 1 || r.right > cr.right + 1) out.push('spills: ' + el.className + ' ' + el.textContent.trim().slice(0, 30)); }); });
  /* every label in a chart stays inside its chart's box */
  document.querySelectorAll('.chart').forEach(ch => { const cr = ch.getBoundingClientRect(); ch.querySelectorAll('text').forEach(t => { const r = t.getBoundingClientRect(); if (r.width && (r.left < cr.left - 4 || r.right > cr.right + 4 || r.top < cr.top - 6 || r.bottom > cr.bottom + 22)) out.push('label out: ' + t.textContent.slice(0, 30) + ' in #' + ch.id); }); });
  document.querySelectorAll('.bm b, .bm small, .tc .nm, .klg span, .kpi p').forEach(el => { if (el.scrollWidth > el.clientWidth + 2) cut.push(el.className + ': ' + el.textContent.trim().slice(0, 40)); });
  return { out, cut, sx: document.documentElement.scrollWidth > W + 1, mark: document.querySelectorAll('header .mark img[src$="logo-mark.png"]').length };
});

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const b = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const BASE = 'http://127.0.0.1:' + PORT + '/intelligence/wall/';

  for (const [label, vp] of [['the branch television, 1920x1080', { width: 1920, height: 1080 }], ['a laptop, 1366x768', { width: 1366, height: 768 }], ['a small laptop, 1280x720', { width: 1280, height: 720 }]]) {
    console.log('\nDriving the campaign, ' + label + ':');
    mode = 'good'; feed = FEED;
    const { ctx, page, errs } = await open(b, vp);
    await page.goto(BASE + 'orphans-driver.html'); await page.waitForTimeout(4200);
    const f = await fit(page);
    ok('nothing below the fold, past the right edge or out of its card', !f.out.length, f.out.join(' | '));
    ok('nothing cut through', !f.cut.length, f.cut.join(' | '));
    ok('no sideways scroll', !f.sx);
    ok('the gold shield', f.mark === 1);
    const m = await page.evaluate(() => ({
      all: document.querySelector('#pAll').textContent, kbar: [...document.querySelectorAll('#kbar i')].map(i => i.style.width), klg: document.querySelector('#klg').textContent,
      ap: document.querySelector('#aPct').textContent, arc: document.querySelector('#aArc').style.strokeDasharray, aP: document.querySelector('#aP').textContent,
      lift: document.querySelector('#lPct').textContent, lP: document.querySelector('#lP').textContent, fp: document.querySelector('#fPct').textContent,
      mt: document.querySelector('#mTot').textContent, mP: document.querySelector('#mP').textContent,
      bands: document.querySelectorAll('#flow .band').length, bandsOn: document.querySelectorAll('#flow .band.on').length, flows: document.querySelectorAll('#flow .flowl').length,
      nodes: document.querySelectorAll('#flow .node').length, flowTxt: [...document.querySelectorAll('#flow text')].map(t => t.textContent).join(' | '),
      hrs: document.querySelectorAll('#hours path').length, hrCap: document.querySelector('#hrCap').textContent,
      bars: [...document.querySelectorAll('#wave rect')].map(r => +r.getAttribute('height')), wvCap: document.querySelector('#wvCap').textContent,
      st: document.querySelectorAll('#stream path').length, stTxt: [...document.querySelectorAll('#stream text')].map(t => t.textContent),
      team: [...document.querySelectorAll('.tc .nm')].map(x => x.firstChild.textContent), rings: [...document.querySelectorAll('.tc .rg b')].map(x => x.textContent),
      say: [...document.querySelectorAll('#say span')].map(s => s.textContent), sayOn: document.querySelectorAll('#say span.on').length, dots: document.querySelectorAll('#sayDots i').length,
      tk: document.querySelector('#tk').textContent, body: document.body.innerText }));
    ok('his prompts since 25 September', m.all === '1,395', m.all);
    ok('the five kinds as one bar, with their counts', m.kbar.length === 5 && m.kbar.every(w => /%$/.test(w)) && /own words 24/.test(m.klg) && /Instructions drafted for him 661/.test(m.klg) && /Hold notices 105/.test(m.klg), m.klg);
    ok('answered: 76%, the ring drawn, and when', m.ap === '76%' && /^\d/.test(m.arc) && /296 the same day/.test(m.aP), m.ap + ' ' + m.arc + ' ' + m.aP);
    ok('the lift on his busiest days: +61%, 44.7 notes a day against 27.8', m.lift === '+61%' && /44\.7/.test(m.lP) && /27\.8/.test(m.lP), m.lift + ' ' + m.lP);
    ok('51% of the team\'s notes after a prompt', m.fp === '51%', m.fp);
    ok('what his automation sent, its three biggest kinds', m.mt === '4,321' && /Letters to clients 1,477/.test(m.mP), m.mt + ' ' + m.mP);
    ok('the flow: five kinds, four answers, five people, every ribbon drawn and flowing', m.nodes >= 13 && m.bands >= 30 && m.bandsOn === m.bands && m.flows >= 20, m.nodes + ' nodes, ' + m.bands + ' bands, ' + m.bandsOn + ' on, ' + m.flows + ' flows');
    ok('the flow says who waits on what', /The same day296/.test(m.flowTxt) && /No word yet330/.test(m.flowTxt) && /Kamla/.test(m.flowTxt) && /148 waiting on them/.test(m.flowTxt), m.flowTxt.slice(0, 300));
    ok('hour by hour: his peak 9 am, theirs 10 am', m.hrs >= 4 && /9 am/.test(m.hrCap) && /10 am/.test(m.hrCap), m.hrCap);
    ok('how fast: eight bars grown, 198 inside four hours, half within 2.1 days', m.bars.length === 8 && m.bars.every(h => h > 0) && /198/.test(m.wvCap) && /2\.1 days/.test(m.wvCap), m.bars.join(',') + ' ' + m.wvCap);
    ok('the stream: twenty days, the biggest marked', m.st >= 5 && m.stTxt.some(t => /183 prompts/.test(t)) && m.stTxt.some(t => /205 notes/.test(t)), m.stTxt.join(','));
    ok('the team, most notes first, each with a ring', m.team.join(',') === 'Sasha,Liz,Azariah,Kamla' && m.rings.join(',') === '46%,55%,55%,58%', m.team.join(',') + ' ' + m.rings.join(','));
    ok('the insights, one at a time', m.say.length >= 6 && m.sayOn === 1 && m.dots === m.say.length && m.say.some(s => /61% more notes/.test(s)) && m.say.some(s => /Sasha answers fastest/.test(s)), m.say.join(' || '));
    ok('the ticker carries the insights', /1,395/.test(m.tk) && /61% more notes/.test(m.tk), m.tk.slice(0, 200));
    ok('no Javid, no Aleema', !/Javid|Aleema/.test(m.body));
    ok('no script error', !errs.length, errs.join(' | '));
    await shot(page, 'driver-' + vp.width + 'x' + vp.height);
    await ctx.close();
  }

  console.log('\na phone, 390x844:');
  {
    mode = 'good'; feed = FEED;
    const { ctx, page, errs } = await open(b, { width: 390, height: 844 });
    await page.goto(BASE + 'orphans-driver.html'); await page.waitForTimeout(3500);
    const m = await page.evaluate(() => {
      const small = [...document.querySelectorAll('body *')].filter(el => !(el instanceof SVGElement) && el.children.length === 0 && el.textContent.trim() && el.getClientRects().length
        && parseFloat(getComputedStyle(el).fontSize) < 8.5).map(el => el.textContent.trim().slice(0, 30));
      const svgSmall = [...document.querySelectorAll('svg text')].filter(t => parseFloat(getComputedStyle(t).fontSize) < 8.5).map(t => t.textContent.slice(0, 20));
      return { sx: document.documentElement.scrollWidth > innerWidth + 1, small, svgSmall, team: document.querySelectorAll('.tc').length, bands: document.querySelectorAll('#flow .band').length };
    });
    ok('no sideways scroll', !m.sx);
    ok('nothing under 8.5px', !m.small.length && !m.svgSmall.length, m.small.concat(m.svgSmall).slice(0, 5).join(' | '));
    ok('the whole team and the flow', m.team === 4 && m.bands >= 30);
    ok('no script error', !errs.length, errs.join(' | '));
    if (SHOTS) await page.screenshot({ path: path.join(SHOTS, 'driver-phone.png'), fullPage: true });
    await ctx.close();
  }

  console.log('\nOld script, dead feed, no Salesforce, reduced motion:');
  {
    mode = 'old'; feed = FEED;
    const { ctx, page } = await open(b, { width: 1920, height: 1080 });
    await page.goto(BASE + 'orphans-driver.html'); await page.waitForTimeout(1500);
    let t = await page.locator('#say').innerText();
    ok('a script older than the stop says what to paste', /Transition\.gs/.test(t) && /New version/.test(t), t);
    mode = 'good'; await page.reload(); await page.waitForTimeout(2500);
    mode = 'dead'; await page.reload(); await page.waitForTimeout(1800);
    t = await page.locator('#pAll').innerText();
    ok('a dead feed after a good one paints the last good answer', t === '1,395', t);
    await ctx.close();
  }
  {
    mode = 'good';
    feed = Object.assign({}, FEED); delete feed.drive;
    const { ctx, page, errs } = await open(b, { width: 1366, height: 768 });
    await page.goto(BASE + 'orphans-driver.html'); await page.waitForTimeout(1800);
    const t = await page.locator('#say').innerText();
    ok('an answer from a script without the drive says what to paste, with no error', /Transition\.gs/.test(t) && !errs.length, t + ' / ' + errs.join(','));
    await ctx.close();
  }
  {
    mode = 'good';
    feed = JSON.parse(JSON.stringify(FEED)); feed.drive = { mail: FEED.drive.mail, error: 'Salesforce did not answer: timeout' };
    const { ctx, page, errs } = await open(b, { width: 1366, height: 768 });
    await page.goto(BASE + 'orphans-driver.html'); await page.waitForTimeout(1800);
    const t = await page.locator('#flow').innerText(), mt = await page.locator('#mTot').innerText();
    ok('without Salesforce: what his automation sent still shows, and why the rest waits', /Salesforce did not answer/.test(t) && mt === '4,321' && !errs.length, t + ' / ' + mt);
    await ctx.close();
  }
  {
    mode = 'good'; feed = FEED;
    const ctx = await b.newContext({ viewport: { width: 1920, height: 1080 }, reducedMotion: 'reduce' });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e)));
    await page.route('https://script.google.com/**', r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(FEED) }));
    await page.route('https://fonts.googleapis.com/**', r => r.abort());
    await page.goto(BASE + 'orphans-driver.html'); await page.waitForTimeout(1200);
    const m = await page.evaluate(() => ({ cards: [...document.querySelectorAll('.card')].every(c => getComputedStyle(c).opacity === '1'),
      clip: getComputedStyle(document.querySelector('#stream .reveal')).clipPath }));
    ok('with motion off, every card and chart shows at once', m.cards && (m.clip === 'none' || m.clip === '' || /^inset\(0(px)?\)$/.test(m.clip)), JSON.stringify(m));
    await ctx.close();
  }

  console.log('\nThe page itself:');
  const html = fs.readFileSync(path.join(ROOT, 'intelligence/wall/orphans-driver.html'), 'utf8');
  const nar = (/var NARRATION = \[([\s\S]*?)\n\];/.exec(html) || [])[1] || '';
  ok('six narration lines', (nar.match(/\{t:"/g) || []).length === 6);
  ok('the narration speaks of the flow', /ribbon/.test(nar));
  ok('the views beacon', html.indexOf('<!-- rrb-views -->') > 0);
  ok('asks the campaign script with no code', /action=board&who=wall/.test(html) && !/code=/.test(html));
  ok('no colleague\'s surname, no client, no Javid in the page', !/Lalla|Jagassar|Griffith|Dookran|Probhu|Kerwyn|Ramroach|Javid|Aleema/i.test(html));
  const all = fs.readFileSync(path.join(ROOT, 'intelligence/wall/all.html'), 'utf8');
  ok('the wall plays it after the cup and before the dues', all.indexOf("file:'orphans-driver.html'") > all.indexOf("file:'orphans-cup.html'") && all.indexOf("file:'orphans-driver.html'") < all.indexOf("file:'index.html'"));

  await b.close(); server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nAll passed.');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
