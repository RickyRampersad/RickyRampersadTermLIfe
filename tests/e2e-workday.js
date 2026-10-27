// My workday on a real screen (23 October 2026): the page on the branch's site, with the tracker answered here.
// It opens with the progress bar, the check-in, what was achieved, next up, the bars and (for him) the team;
// checking in posts and redraws; the last copy draws at once on the next open; nothing spills off a phone.
// Run: node tests/e2e-workday.js   (needs playwright + a chromium on disk)
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME_PATH || (fs.existsSync('/opt/pw-browsers/chromium') ? '/opt/pw-browsers/chromium' : '/opt/pw-browsers/chromium-1194/chrome-linux/chrome');
const OUT = process.env.SHOTS || '';
const server = http.createServer((q, r) => {
  let f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { r.writeHead(404); return r.end('no'); }
  r.writeHead(200, { 'Content-Type': f.endsWith('.html') ? 'text/html' : f.endsWith('.svg') ? 'image/svg+xml' : 'application/octet-stream' });
  fs.createReadStream(f).pipe(r);
});
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };
const day = new Date().toLocaleDateString('en-CA', { timeZone: 'America/Port_of_Spain' });
const model = (o = {}) => Object.assign({ ok: true, v: '2026-10-23c', sid: 'sasha', name: 'Sasha Lalla-Jagassar', first: 'Sasha', day, date: 'Friday 23 October 2026', at: '10:30am',
  hours: '7am – 2pm', lunch: '12:00 – 12:30pm', start: '7:00am', full: 'https://script.google.com/macros/s/X/exec?rs=sasha&f=plan', fullLabel: 'Open my day page',
  checkin: { at: '7:09am', late: 9, status: 'in', out: '', why: '' },
  progress: { sf: true, closed: 6, target: 14, pct: 43, dayPct: 54, proj: 11, behind: true, noted: 5, unnoted: 1, overdue: 41, dueToday: 5, lastAt: '10:41am', notes: 3, plan: 12, planDone: 4 },
  achieved: [{ k: 'close', s: 'Orphan response: call-back from the branch - 5000816447 GERALD HEERAH', noted: false }, { k: 'close', s: 'Premium due: Call back - 5004096791 HEMAN BAHADOOR', noted: true },
    { k: 'close', s: 'Statement request for a client with a very long subject line that has to wrap neatly on a phone without spilling off the side', noted: true }],
  next: [{ s: 'Change of address', due: 'Mon 12 Oct', late: true, ty: 'Servicing', id: '00T9', url: 'https://sf.example/00T9' }, { s: 'Statement request', due: 'Fri 23 Oct', late: false, ty: 'Servicing', url: '' }],
  list: [{ id: '00T7', s: 'Statement request for Gerald Heerah', ty: 'Servicing', done: true, url: 'https://sf.example/00T7' }, { id: '00T9', s: 'Change of address', ty: 'Servicing', done: false, url: 'https://sf.example/00T9' }], listSet: true,
  bars: [{ d: '2026-10-19', l: 'M', n: 9 }, { d: '2026-10-20', l: 'Tu', n: 12 }, { d: '2026-10-21', l: 'W', n: 7 }, { d: '2026-10-22', l: 'Th', n: 11 }, { d: day, l: 'F', n: 6 }],
  team: [] }, o);

(async () => {
  await new Promise(r => server.listen(8799, r));
  const b = await chromium.launch({ executablePath: CHROME });
  const url = 'http://localhost:8799/myworkday/?p=sasha&k=KEY';
  for (const vp of [{ width: 390, height: 844, n: 'phone' }, { width: 1280, height: 860, n: 'laptop' }]) {
    console.log('\n' + vp.n + ':\n');
    const ctx = await b.newContext({ viewport: { width: vp.width, height: vp.height } });
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e)));
    let asked = [], posted = [], current = model({ checkin: { at: '', late: 0, status: '', out: '', why: '' } });
    await page.route(/script\.google\.com\/macros/, async route => {
      const req = route.request();
      if (req.method() === 'POST') { posted.push(req.postData()); current = model(); current.checkedIn = { at: '7:12am', first: true }; return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(current) }); }
      asked.push(req.url()); return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(current) });
    });
    await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await page.goto(url); await page.waitForTimeout(1800);
    ok('it asks the tracker for her day, with her key', asked.length === 1 && /wd=sasha&k=KEY/.test(asked[0]), asked[0]);
    ok('the greeting and the day', /Sasha$/.test(await page.textContent('#hello')) && /Friday 23 October 2026/.test(await page.textContent('#when')));
    ok('the progress bar: the percentage and the count', /43%/.test(await page.textContent('#pct')) && /6 of 14 closed today/.test(await page.textContent('#of')));
    const fillW = await page.$eval('#fill', e => e.getBoundingClientRect().width), barW = await page.$eval('#bar', e => e.getBoundingClientRect().width);
    ok('the bar fills to the share closed', Math.abs(fillW / barW - 0.43) < 0.03, (fillW / barW).toFixed(2));
    const nowL = await page.$eval('#nowm', e => e.style.left);
    ok('and marks where the day is', nowL === '54%', nowL);
    ok('behind the day: the bar says so in amber', /behind/.test(await page.getAttribute('#prog', 'class')));
    ok('the pace', /54%<\/b> of your day gone/.test(await page.innerHTML('#pace')) && /class="mk"/.test(await page.innerHTML('#pace')) && /On pace for <b>11<\/b>: 8 to go/.test(await page.innerHTML('#pace')));
    const chips = await page.innerHTML('#chips');
    ok('the chips: with and without a note, overdue, due, the plan', /<b>5<\/b>closed with your note/.test(chips) && /chip bad"><b>1<\/b>closed with no note/.test(chips) && /<b>41<\/b>overdue/.test(chips) && /<b>4 of 12<\/b>/.test(chips), chips.slice(0, 200));
    ok('not in yet: the check-in button', !!(await page.$('#ci')) && /Your day starts at 7:00am/.test(await page.textContent('#main')));
    ok('what was achieved, with a nudge where there is no note', (await page.$$('ul.list')).length === 3 && /add your note/.test(await page.textContent('#main')));
    ok('the day\'s list: what is done ticked, each to its task', /Your list today/.test(await page.textContent('#list')) && /1 of 2 done/.test(await page.textContent('#list')) && (await page.$$('#list .s.done')).length === 1 && !!(await page.$('#list a[href="https://sf.example/00T9"]')));
    ok('what is on the list is not repeated under Next up', /Also overdue or due/.test(await page.textContent('#main')) && (await page.$$('#main a[href="https://sf.example/00T9"]')).length === 1 && /Statement request/.test(await page.textContent('#main')));
    const bars = await page.$$eval('.bb', es => es.map(e => e.getBoundingClientRect().height));
    ok('five bars, grown to their numbers, the tallest the best day', bars.length === 5 && bars[1] === Math.max(...bars) && bars[1] > bars[3] && bars[3] > bars[0] && bars[0] > bars[2] && bars[4] > 0, bars.map(Math.round).join(','));
    ok('one button to the full day page', /Open my day page/.test(await page.textContent('.foot')) && (await page.getAttribute('.foot a', 'href')).includes('f=plan'));
    const wide = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok('nothing off the side', wide <= 0, String(wide));
    if (OUT) await page.screenshot({ path: path.join(OUT, 'workday-' + vp.n + '.png'), fullPage: true });
    await page.click('#ci'); await page.waitForTimeout(1500);
    ok('checking in posts her key and redraws: in at 7:12', posted.length === 1 && /wd=sasha/.test(posted[0]) && /act=checkin/.test(posted[0]) && /In at 7:09am/.test(await page.textContent('#main')), posted[0]);
    ok('and says so', /Checked in at 7:12am/.test(await page.textContent('#toast')));
    // The next open: the last copy at once, before the tracker answers.
    await page.unroute(/script\.google\.com\/macros/);
    await page.route(/script\.google\.com\/macros/, async route => { await new Promise(r => setTimeout(r, 2500)); route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(model()) }); });
    await page.goto(url); await page.waitForTimeout(1300);
    ok('the next open draws the last copy at once, then updates', /43%/.test(await page.textContent('#pct')) && /updating/.test(await page.textContent('#asat')), await page.textContent('#asat'));
    ok('no errors on the page', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }
  console.log('\nHis page, with the team; a wrong link; no link:\n');
  {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, colorScheme: 'dark' }); const page = await ctx.newPage();
    const rk = model({ sid: 'ricky', name: 'Ricky Rampersad', first: 'Ricky', fullLabel: 'Open My day', barsLabel: 'your own notes each day',
      progress: { lead: true, sf: true, target: 20, cleared: 9, you: 6, team: 3, pct: 45, dayPct: 54, behind: true, waiting: 11, asks: 7, inbox: 3, mineDue: 1, yourNotes: 6,
        sys: { 'chases in your voice': 15, 'absence handovers': 11, 'questions from Branch Intelligence': 30 } },
      waiting: [{ k: 'ask', id: '00TA', s: 'Orphan response - Radicia Julal', by: 'Sasha Lalla-Jagassar', said: 'Mr Rampersad, which agent should take Radicia Julal?', read: 'Sasha has asked since 10:54; Waterloo area.', next: 'Name the agent today', draft: 'Sasha, assign Radicia Julal to Fawwaz. Please send the introduction today.' },
        { k: 'inbox', id: 'kB-20261023', s: 'Dear Mr. Bisnath,', by: 'kamla.dookran@myguardiangroup.com', said: 'Review and approve the reply', done: 'Kamla drafted the reply.', next: 'open a task for Kamla, due Mon 26 Oct', draft: 'Kamla, the reply reads well. Send it on Monday.', to: 'kamla' }],
      desks: [{ sid: 'kamla', first: 'Kamla' }, { sid: 'sasha', first: 'Sasha' }, { sid: 'ricky', first: 'Me' }],
      achieved: [{ k: 'note', s: 'Note on CDD form', at: '11:41am' }, { k: 'email', s: 'To Natalie Ramdhan: Brentwood Towers', at: '9:22am', g: 'Other' }],
      team: [{ sid: 'sasha', name: 'Sasha', at: '7:09am', late: 9, closed: 6, target: 14, pct: 43, dayPct: 54 }, { sid: 'elizabeth', name: 'Elizabeth', at: '7:58am', late: 0, closed: 2, target: 7, pct: 29, dayPct: 30 },
        { sid: 'azariah', name: 'Azariah', at: '', absent: true, closed: 0, target: 9, pct: 0, dayPct: 40 }] });
    let posted = [];
    await page.route(/script\.google\.com\/macros/, r => { if (r.request().method() === 'POST') { posted.push(r.request().postData()); return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, res: "posted on Sasha's task" }) }); }
      return r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(rk) }); });
    await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await page.goto('http://localhost:8799/myworkday/?p=ricky&k=K2'); await page.waitForTimeout(1800);
    ok('his bar: cleared of what waited on him', /45%/.test(await page.textContent('#pct')) && /9 of 20 cleared today/.test(await page.textContent('#of')));
    const yw = await page.$eval('#fill', e => e.getBoundingClientRect().width), tw = await page.$eval('#fill2', e => e.getBoundingClientRect().width), bw = await page.$eval('#bar', e => e.getBoundingClientRect().width);
    ok('two colours: by him, then by the team', Math.abs(yw / bw - 0.30) < 0.03 && Math.abs(tw / bw - 0.15) < 0.03, (yw / bw).toFixed(2) + ' / ' + (tw / bw).toFixed(2));
    ok('who still waits, and the staff waiting on his word', /11<\/b> still waiting on you/.test(await page.innerHTML('#pace')) && /<b>7<\/b>staff waiting on your word/.test(await page.innerHTML('#chips')));
    ok('what the system did for him, apart', /Done for you by the system today: <b>30<\/b> questions from Branch Intelligence · <b>15<\/b> chases in your voice/.test(await page.innerHTML('#sys')));
    ok('waiting on him, with Claude\'s words in the box', (await page.$$('#waiting .wt')).length === 2 && (await page.$eval('#waiting .wt textarea', e => e.value)).startsWith('Sasha, assign Radicia Julal to Fawwaz'));
    ok('a mail\'s note has the desk Claude chose', (await page.$eval('#waiting .wt[data-k="inbox"] select', e => e.value)) === 'kamla');
    ok('the team, each against the day', (await page.$$('.team .row')).length === 3 && /absent/.test(await page.textContent('.team')) && /6\/14/.test(await page.textContent('.team')));
    ok('his notes and e-mails among what he achieved; his bars are his notes', /E-mail · 9:22am/.test(await page.textContent('#main')) && /your own notes each day/.test(await page.textContent('#main')));
    let wide = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
    ok('nothing off the side, in the dark too', wide <= 0, String(wide));
    if (OUT) await page.screenshot({ path: path.join(OUT, 'workday-ricky-dark.png'), fullPage: true });
    await page.fill('#waiting .wt textarea', 'Sasha, assign Radicia Julal to Fawwaz today.');
    await page.click('#waiting .wt [data-post]'); await page.waitForTimeout(700);
    ok('one tap posts his words on her task', posted.length === 1 && /act=post/.test(posted[0]) && /kind=ask/.test(posted[0]) && /id=00TA/.test(posted[0]) && /Fawwaz\+today/.test(posted[0]), posted[0]);
    ok('and it says so, and the item goes', /posted on Sasha's task/.test(await page.textContent('#toast')) && /gone/.test(await page.getAttribute('#waiting .wt', 'class')));
    await page.waitForTimeout(800);
    await page.click('#waiting .wt[data-k="inbox"] [data-post]'); await page.waitForTimeout(700);
    ok('a mail\'s note posts to the desk chosen', posted.length === 2 && /kind=inbox/.test(posted[1]) && /to=kamla/.test(posted[1]), posted[1]);
    await page.unroute(/script\.google\.com\/macros/);
    await page.route(/script\.google\.com\/macros/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'This link is not right. Open it again from your morning e-mail.' }) }));
    // 27 Oct 2026: a dropped first answer is tried once more by itself.
    await page.unroute(/script\.google\.com\/macros/);
    let tries2 = 0;
    await page.route(/script\.google\.com\/macros/, r => { tries2++; return tries2 === 1 ? r.abort('failed') : r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(model()) }); });
    await page.evaluate(() => localStorage.clear());
    await page.goto('http://localhost:8799/myworkday/?p=sasha&k=KEY'); await page.waitForTimeout(2600);
    ok('a dropped first answer is tried again by itself, and the day draws', tries2 === 2 && /Sasha$/.test(await page.textContent('#hello')) && !(await page.$('#again')), String(tries2));
    await page.unroute(/script\.google\.com\/macros/);
    await page.route(/script\.google\.com\/macros/, r => r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: false, error: 'This link is not right. Open it again from your morning e-mail.' }) }));
    await page.evaluate(() => localStorage.clear());
    await page.goto('http://localhost:8799/myworkday/?p=ricky&k=bad'); await page.waitForTimeout(1200);
    ok('a wrong link says so, with a way to try again', /This link is not right/.test(await page.textContent('#notice')) && !!(await page.$('#again')));
    await page.evaluate(() => localStorage.clear());
    await page.goto('http://localhost:8799/myworkday/'); await page.waitForTimeout(600);
    ok('no link: where to find yours', /<b>My day<\/b> in the <a href="\/rroperations\/">branch app<\/a>/.test(await page.innerHTML('#notice')) && /the <b>My workday<\/b> link in your morning e-mail/.test(await page.innerHTML('#notice')));
    await ctx.close();
  }

  // My day in the branch app (26 Oct 2026: "make available as a view on the branch apps as my day"): the app's sign-in,
  // not the e-mail's link; the tile and the first step of a staff member's day open it; an agent has no My day.
  console.log('\nfrom the branch app:\n');
  {
    const ctx = await b.newContext({ viewport: { width: 390, height: 844 } });
    const TOK = 'T'.repeat(32);
    await ctx.addInitScript(t => { try { if (!localStorage.getItem('rrb-ops-session')) localStorage.setItem('rrb-ops-session', JSON.stringify({ token: t, name: 'Pawan Prabhu', role: 'Staff', agentNo: 'PP005', mode: 'test' })); } catch (e) {} }, TOK);
    const page = await ctx.newPage(); const errs = []; page.on('pageerror', e => errs.push(String(e)));
    let asked = [], posted = [];
    await page.route(/script\.google\.com\/macros/, async route => {
      const req = route.request();
      if (!/AKfycbzb9/.test(req.url())) return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, mode: 'test' }) });   // the app's own backend
      if (req.method() === 'POST') { posted.push(req.postData() || ''); const m = model({ sid: 'pawan', name: 'Pawan Prabhu', first: 'Pawan' }); m.checkedIn = { at: '4:55pm', first: true }; return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(m) }); }
      asked.push(req.url()); return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(model({ sid: 'pawan', name: 'Pawan Prabhu', first: 'Pawan', checkin: { at: '', late: 0, status: '', out: '', why: '' } })) });
    });
    await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
    await page.goto('http://localhost:8799/rroperations/'); await page.waitForTimeout(900);
    const tile = await page.$('a.app[href="/myworkday/?app=1"]');
    ok('staff: a My day tile, first under Every day', !!tile && /My day/.test(await tile.textContent()) && (await page.$$eval('#sections .grid', g => g[0] ? g[0].querySelector('a.app').getAttribute('href') : '')) === '/myworkday/?app=1');
    ok('and the first step of the day opens it', /Check in on My day/.test(await page.textContent('#day')) && !!(await page.$('#day a[href="/myworkday/?app=1"]')));
    await page.evaluate(() => localStorage.setItem('wd_link', JSON.stringify({ p: 'sasha', k: 'OLDKEY' })));
    await page.click('a.app[href="/myworkday/?app=1"]'); await page.waitForTimeout(1500);
    ok('My day asks the tracker with the app\'s sign-in, not a link left on the phone', asked.length >= 1 && /wd=app&ops=T{32}/.test(asked[0]) && !/k=OLDKEY/.test(asked[0]), asked[0]);
    ok('it is his day, with the way back to the app', /Pawan$/.test(await page.textContent('#hello')) && await page.isVisible('#toapp'));
    await page.click('#ci'); await page.waitForTimeout(900);
    ok('checking in goes with the app\'s sign-in', posted.length === 1 && /act=checkin/.test(posted[0]) && /ops=T{32}/.test(posted[0]) && /wd=app/.test(posted[0]), posted[0]);
    await page.evaluate(() => localStorage.setItem('rrb-ops-session', JSON.stringify({ token: 'A'.repeat(32), name: 'Some Agent', role: 'Agent', agentNo: 'A01234' })));
    await page.goto('http://localhost:8799/rroperations/'); await page.waitForTimeout(800);
    ok('an agent has no My day tile', !(await page.$('a.app[href="/myworkday/?app=1"]')));
    ok('no page errors', errs.length === 0, errs.join(' | '));
    await ctx.close();
  }
  await b.close(); server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall green');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
