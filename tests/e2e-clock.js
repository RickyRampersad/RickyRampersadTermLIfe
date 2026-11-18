// A meeting time is not what was typed into it (11 November 2026).
//
// Start and End are time-only cells, and Google Sheets keeps a time with no
// date on 30 December 1899 — a date old enough to carry a local-mean-time
// offset, since Port of Spain ran at -04:06:04 until 1912. So the backend
// hands the page "Sat Dec 30 1899 09:00:00 GMT-0400 (Atlantic Standard Time)"
// where somebody typed 9:00, and printing it raw put that whole string on the
// home screen under "starts". Read off the live sheet that morning: every
// meeting it held, script-written ones included.
//
// The mock used to send the tidy '9:00 AM', which is why no test caught it —
// the fifth harness in this repository to model a field as the code wished it
// were rather than as the sheet gives it back. It sends the real thing now.
//
// Pinned: the banner and every other display spot read as a person would say
// the time; the staff builder's <input type="time"> gets 24-hour HH:MM, which
// is the only thing it accepts; the rail still works the times out from the
// meeting's own start; and the four shapes the sheet can hand over all parse.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME_PATH || (() => {
  const t = ['/opt/pw-browsers/chromium'];
  for (const d of (fs.existsSync('/opt/pw-browsers') ? fs.readdirSync('/opt/pw-browsers') : []))
    t.push('/opt/pw-browsers/' + d + '/chrome-linux64/chrome', '/opt/pw-browsers/' + d + '/chrome-linux/chrome');
  return t.find(p => { try { return fs.statSync(p).isFile(); } catch (e) { return false; } }) || t[0];
})();
const TYPES = { '.html': 'text/html', '.js': 'application/javascript', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg' };
const PORT = Number(process.env.PORT) || 8883;
const F = require('./mockmeet.js');
let fails = 0;
const ok = (w, c, x) => { console.log((c ? '  ok   ' : '  FAIL ') + w + (x !== undefined && !c ? '  — ' + x : '')); if (!c) fails++; };
const server = http.createServer((q, r) => {
  let f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { r.writeHead(404); return r.end('no'); }
  r.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  r.end(fs.readFileSync(f));
});
const NINETEEN = 'Sat Dec 30 1899 09:00:00 GMT-0400 (Atlantic Standard Time)';

(async () => {
  await new Promise(r => server.listen(PORT, r));
  const b = await chromium.launch({ executablePath: CHROME, args: ['--no-sandbox'] });
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const errs = []; p.on('pageerror', e => errs.push(String(e.message)));
  await p.route('**script.google.com/**', rt => rt.fulfill({ status: 200, contentType: 'application/json',
    body: JSON.stringify(/action=meeting\b/.test(rt.request().url()) ? F.detail('manager') : F.home('manager')) }));
  await p.addInitScript(() => { try { localStorage.setItem('rrb-meetings-token', 't'); sessionStorage.setItem('rrb-mm-door', '1'); } catch (e) {} });
  await p.goto(`http://localhost:${PORT}/meetings/`, { waitUntil: 'domcontentloaded' });
  await p.waitForTimeout(400);

  console.log('\n--- every shape the sheet can hand over ---');
  const parsed = await p.evaluate(() => {
    const W = typeof timeWords === 'function' ? timeWords : () => '(no timeWords)';
    const T = typeof time24 === 'function' ? time24 : () => '(no time24)';
    const J = typeof justTime === 'function' ? justTime : () => '(no justTime)';
    return ({
    nineteen: W('Sat Dec 30 1899 09:00:00 GMT-0400 (Atlantic Standard Time)'),
    afternoon: W('Sat Dec 30 1899 13:30:00 GMT-0400 (Atlantic Standard Time)'),
    h24: W('09:00'),
    h24pm: W('13:30'),
    ampm: W('9:00 AM'),
    stamp: W('11 Nov 2026, 8:30 AM'),
    stampPm: W('11 Nov 2026, 1:30 PM'),
    noon: W('12:00'),
    midnight: W('00:00'),
    blank: W(''),
    nothing: W(null),
    dateOnly: W('11 Nov 2026'),
    rubbish: W('99:99'),
    t24: T('Sat Dec 30 1899 09:00:00 GMT-0400 (Atlantic Standard Time)'),
    t24pm: T('Sat Dec 30 1899 13:30:00 GMT-0400 (Atlantic Standard Time)'),
    t24ampm: T('1:30 PM'),
    t24blank: T(''),
    legacy: J('11 Nov 2026, 8:30 AM')
  });
  });
  ok('the 1899 morning reads 9:00 AM', parsed.nineteen === '9:00 AM', parsed.nineteen);
  ok('the 1899 afternoon reads 1:30 PM', parsed.afternoon === '1:30 PM', parsed.afternoon);
  ok('"09:00" reads 9:00 AM', parsed.h24 === '9:00 AM', parsed.h24);
  ok('"13:30" reads 1:30 PM', parsed.h24pm === '1:30 PM', parsed.h24pm);
  ok('"9:00 AM" is left as it is', parsed.ampm === '9:00 AM', parsed.ampm);
  ok('a stamp gives up its time', parsed.stamp === '8:30 AM', parsed.stamp);
  ok('a stamp keeps the afternoon', parsed.stampPm === '1:30 PM', parsed.stampPm);
  ok('noon is 12:00 PM, not 0:00', parsed.noon === '12:00 PM', parsed.noon);
  ok('midnight is 12:00 AM', parsed.midnight === '12:00 AM', parsed.midnight);
  ok('nothing in, nothing out', parsed.blank === '' && parsed.nothing === '', parsed.blank + '/' + parsed.nothing);
  ok('a date with no time says nothing', parsed.dateOnly === '', parsed.dateOnly);
  ok('an impossible clock says nothing', parsed.rubbish === '', parsed.rubbish);
  ok('time24 gives the input 09:00', parsed.t24 === '09:00', parsed.t24);
  ok('time24 gives the input 13:30', parsed.t24pm === '13:30', parsed.t24pm);
  ok('time24 turns 1:30 PM into 13:30', parsed.t24ampm === '13:30', parsed.t24ampm);
  ok('time24 of nothing is empty', parsed.t24blank === '', parsed.t24blank);
  ok('justTime still answers, through the same parser', parsed.legacy === '8:30 AM', parsed.legacy);

  //  clockText was already taken, by the live session clock's own minutes
  //  formatter, defined later in the file — so it won every one of these call
  //  sites and they all read "NaN min". The page's one duplicate function name
  //  was the one I had just added. Grep before naming, and pin it here.
  const dupes = await p.evaluate(() => {
    const src = Array.from(document.querySelectorAll('script')).map(s => s.textContent).join('\n');
    const seen = {}, out = [];
    (src.match(/function\s+([A-Za-z0-9_$]+)\s*\(/g) || []).forEach(m => {
      const n = m.replace(/function\s+/, '').replace(/\s*\($/, '');
      if (seen[n]++) out.push(n);
    });
    return out;
  });
  ok('no function on the page is defined twice', dupes.length === 0, dupes.join(', '));

  console.log('\n--- the home banner, which is what the branch sees first ---');
  await p.evaluate(() => { S.token = 't'; S.user = { email: 'one@example.com', name: 'The Branch Manager', role: 'manager' }; });
  await p.evaluate(() => loadHome());
  await p.waitForTimeout(600);
  const home = await p.evaluate(() => document.body.innerText);
  ok('no 1899 anywhere on the home screen', !/1899/.test(home));
  ok('no raw GMT offset on the home screen', !/GMT[-+]\d{4}/.test(home));
  ok('the banner says it starts 9:00 AM', /starts\s*9:00\s*AM/i.test(home.replace(/\s+/g, ' ')), home.slice(0, 300));

  console.log('\n--- the meeting, the rail and the staff builder ---');
  await p.evaluate(() => loadMeeting('MTG1'));
  await p.waitForSelector('.rail2', { timeout: 8000 });
  const mt = await p.evaluate(() => document.body.innerText);
  ok('no 1899 on the meeting view', !/1899/.test(mt));
  ok('no raw GMT offset on the meeting view', !/GMT[-+]\d{4}/.test(mt));
  const rail = await p.evaluate(() => Array.from(document.querySelectorAll('.rail2 .seg .tm')).map(e => e.textContent.trim()));
  ok('every rail segment carries a time', rail.length > 0 && rail.every(t => /\d{1,2}:\d{2}/.test(t)), JSON.stringify(rail.slice(0, 4)));
  ok('the rail opens at the start time', /^9:0?0/.test(rail[0] || ''), rail[0]);
  const inputs = await p.evaluate(() => {
    const d = (S.detail && S.detail.meeting) || {};
    const T = typeof time24 === 'function' ? time24 : () => '(no time24)';
    return { start: T(d.start), end: T(d.end) };
  });
  ok('the Starts input would get 09:00', inputs.start === '09:00', inputs.start);
  ok('the Ends input would get 10:30', inputs.end === '10:30', inputs.end);
  ok('no page errors', errs.length === 0, errs.join(' | '));

  console.log('\n--- and it is still right when the sheet is tidy ---');
  await p.evaluate(nineteen => {
    S.detail.meeting.start = '9:00 AM'; S.detail.meeting.end = '10:30 AM';
    S.home.next.start = '9:00 AM';
    window.__n = nineteen;
  }, NINETEEN);
  await p.evaluate(() => render());
  await p.waitForTimeout(300);
  const tidy = await p.evaluate(() => document.body.innerText);
  ok('a clean time is shown unchanged', !/1899/.test(tidy) && /9:00\s*AM/.test(tidy.replace(/\s+/g, ' ')));

  await b.close(); server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall passed');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
