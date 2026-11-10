// Who owes this meeting what, and the running order as a clock (10 November 2026).
//
// Ricky: "I'm not seeing the staff being held accountable ... our meeting could have a
// timeline as it goes, reminding us the times and who is responsible ... [she] continues
// to sit in our meetings and get away with craziness."
//
// Pinned: ONE PERSON, ONE LINE (the first cut put the chair on the screen five times and
// painted fifteen of eighteen rows red, and a wall of red says nothing); a person who has
// put something in reads in, one who has not reads their name with "nothing in"; an item
// the room owns asks nobody for anything; a first name answers for a full name; the rail
// works the times out from the meeting's own start when the backend sends no clock; and
// the working view carries both, with the names of whoever has brought nothing.
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
const PORT = Number(process.env.PORT) || 8879;
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
  await p.evaluate(() => { S.token = 't'; S.user = { email: 'one@example.com', name: 'The Branch Manager', role: 'manager' }; loadMeeting('MTG1'); });
  await p.waitForSelector('.owed', { timeout: 8000 });

  // ---- one person, one line --------------------------------------------------
  const rows = await p.$$eval('.owed-row', es => es.map(e => ({
    who: e.querySelector('.nm').textContent.trim(),
    what: e.querySelector('.wt').textContent.trim(),
    st: e.querySelector('.st').textContent.trim(),
    no: e.classList.contains('no')
  })));
  /*  NOT /^The Branch Manager\b/ — that also matches "The Branch Manager's
      Assistant", which is a different person. The first cut of this test
      failed on it, and the test held the bug, not the page. */
  const bm = rows.filter(r => /^The Branch Manager\s+MANAGER$/i.test(r.who.replace(/\s+/g, ' ')));
  ok('the chair is on the list once, not once per item', bm.length === 1, JSON.stringify(bm.map(r => r.who)));
  ok('and that one line carries every item they own',
    /production board/.test(bm[0].what) && /orphan book/.test(bm[0].what), bm[0].what);
  ok('nobody is listed twice', new Set(rows.map(r => r.who)).size === rows.length);

  // ---- in, or not, with the name on it ---------------------------------------
  const two = rows.find(r => /^Agent Two/.test(r.who));
  ok('somebody who brought something reads in', two && !two.no && two.st === 'in', JSON.stringify(two));
  const five = rows.find(r => /^Agent Five/.test(r.who));
  ok('somebody who brought nothing reads nothing in', five && five.no && /nothing in/i.test(five.st), JSON.stringify(five));
  ok('what they said is on the line',
    /took a fact find/.test(await p.locator('.owed-row.yes .sd').first().innerText()));
  ok('the head counts them', /3 of 12/.test(await p.locator('.owed-head').innerText()),
    await p.locator('.owed-head').innerText());

  // ---- an item the room owns asks nobody ---------------------------------------
  ok('"Everyone" is never put on the list as a person',
    !rows.some(r => /^(Everyone|The room)$/i.test(r.who)), JSON.stringify(rows.map(r => r.who)));
  ok('and the items the room owns are not demanded of anybody',
    !rows.some(r => /What worked for me|Open floor/.test(r.what)));

  // ---- a first name answers for a full name ------------------------------------
  const same = await p.evaluate(() => [
    owedSame('Liz', 'Liz'), owedSame('Sasha Lalla', 'Sasha Lalla-Jagassar'),
    owedSame('Agent Two', 'Agent Three'), owedSame('', 'Agent Two'), owedSame('A Unit Manager', 'A Unit Manager')
  ]);
  ok('the same person matches', same[0] === true && same[1] === true && same[4] === true, JSON.stringify(same));
  ok('a different person does not', same[2] === false && same[3] === false, JSON.stringify(same));

  // ---- the rail, with times worked out from the start ---------------------------
  const segs = await p.$$eval('.rail2 .seg', es => es.map(e => ({
    t: e.querySelector('.tm').textContent.trim(), o: e.querySelector('.ow').textContent.trim(),
    m: +getComputedStyle(e).getPropertyValue('--m') })));
  ok('one segment per timed item', segs.length === 11, String(segs.length));
  ok('the first starts at the meeting start', segs[0].t === '9:00', segs[0].t);
  ok('and each one follows the last', segs[1].t === '9:03' && segs[2].t === '9:10', segs.map(x => x.t).join(' '));
  ok('the last starts before the end', segs[segs.length - 1].t === '10:25', segs[segs.length - 1].t);
  ok('every segment names who is responsible', segs.every(x => x.o && /·/.test(x.o)));
  ok('and is as wide as its minutes', segs[2].m === 12 && segs[0].m === 3, segs[0].m + '/' + segs[2].m);

  // ---- the working view carries both --------------------------------------------
  await p.evaluate(() => scrOpen());
  await p.waitForTimeout(500);
  ok('the clock rail is on the screen the room watches', await p.locator('#scr .rail2').count() === 1);
  const owed = await p.locator('#scr .scr-owed').innerText();
  ok('so is who has put something in', /3 of 12 have put something in/.test(owed), owed.slice(0, 60));
  ok('with the names of whoever has not', /Nothing in yet/.test(owed) && /Agent Five/.test(owed), owed.slice(0, 160));
  ok('no page errors anywhere', errs.length === 0, errs.join(' | '));

  // ---- the branch's own numbers ------------------------------------------------
  await p.evaluate(() => scrClose());
  await p.waitForTimeout(300);
  const nums = await p.locator('section:has(.nmrow)').innerText();
  ok('the production board is on the screen', /60[\s\S]*applications since 1 Oct/.test(nums), nums.slice(0, 80));
  ok('so are the fact finds and the open book',
    /157[\s\S]*fact finds this year/.test(nums) && /121[\s\S]*renewals and premiums due/.test(nums));
  ok('and it says where they were read and when',
    /Read at 7:02 from Salesforce and the fact find/.test(nums));
  ok('no money reaches the page', !/\$|TT\$|premium of|API/.test(nums), nums.slice(0, 200));

  const desks = await p.$$eval('.dsk-row', es => es.map(e => e.innerText.replace(/\s+/g, ' ').trim()));
  ok('every desk is there by name', desks.length === 4, String(desks.length));
  ok('a desk who is not in is said to be absent', /Support Three absent/.test(desks[2]), desks[2]);
  ok('each is against their own normal, not each other',
    /a day, against 9/.test(desks[0]) && /a day, against 11/.test(desks[1]), desks.slice(0, 2).join(' | '));

  //  the whole point of the fallback: a tracker that is not linked says so
  await p.evaluate(() => { delete S.detail.pack; drawMeeting(); });
  await p.waitForTimeout(250);
  const none = await p.locator('section:has(.hint)').first().innerText();
  ok('with no pack it names what to set, never a blank',
    /TRACKER_URL/.test(await p.locator('#view').innerText()), none.slice(0, 80));

  await b.close(); server.close();
  console.log(fails ? '\n' + fails + ' FAILED' : '\nall passing');
  process.exit(fails ? 1 : 0);
})();
