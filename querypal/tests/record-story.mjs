/* Query Pal — the story film. A brand piece for the public, not a product demo:
   why the branch built this, and what it means for someone waiting on an answer.
   Same mocked backend as record-demo.mjs, so nothing real is ever sent.
   Output: demo/querypal-story.webm + demo/story-timeline.json                */
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
const { chromium } = createRequire(import.meta.url)('/opt/node22/lib/node_modules/playwright');
const HERE = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(HERE, 'demo');
fs.mkdirSync(OUT, { recursive: true });

const W = 1280, H = 800;
const browser = await chromium.launch();
const ctx = await browser.newContext({
  viewport: { width: W, height: H },
  recordVideo: { dir: OUT, size: { width: W, height: H } },
  deviceScaleFactor: 1,
});
const page = await ctx.newPage();
const sleep = ms => new Promise(r => setTimeout(r, ms));
const T0 = Date.now();
const MARKS = [];
const mark = (kind, text) => MARKS.push({ t: Date.now() - T0, kind, text });

/* ---------------- mocked backend ---------------- */
const REF = 'RRB/2026/214/Anita Maharaj/Tax statem';
const daysAgo = n => new Date(Date.now() - n * 864e5).toISOString();
/* Nothing external: every off-disk request either hits the webhook mock below
   or is aborted, so page loads never sit waiting on the network. */
await page.route(/^https?:\/\//, route =>
  route.request().url().includes('/macros/s/') ? route.fallback() : route.abort());
await page.route('**/macros/s/**', route => {
  const req = route.request(); const url = new URL(req.url());
  const a = url.searchParams.get('action') || (req.postData() || '').match(/"action":"(\w+)"/)?.[1] || 'post';
  const ok = b => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(b) });
  if (a === 'post')        return ok({ ok: true, reference: REF, runNo: 214 });
  if (a === 'track')       return ok({ found: true, reference: REF, status: 'Open',
    queryType: 'Statements – tax and csv', department: 'Customer Service – Chaguanas',
    logged: '18 Aug 2026, 9:12 AM', turnaround: '1 day', dateClosed: '', daysToClose: '' });
  if (a === 'agentauth') {
    const onWall = (route.request().frame().url() || '').includes('wall.html');
    return ok(onWall ? { ok: true, code: '260026', name: 'Ricky Rampersad', email: '', role: 'branch' }
                     : { ok: true, code: 'AE101', name: 'Aidan Eugene', email: '', role: 'manager' });
  }
  if (a === 'myqueries')   return ok({ ok: true, role: 'manager', name: 'Aidan Eugene',
    counts: { open: 4, done: 9, total: 13 },
    rows: [
      { ref: REF, ts: '18 Aug · 9:12 AM', status: 'Open', client: 'Anita Maharaj', agent: 'Aidan Eugene',
        qtype: 'Statements – tax and csv', dept: 'Customer Service – Chaguanas', tat: '1', pri: 'Normal',
        closed: '', days: '', tsIso: daysAgo(0), score: 0, fu: 0, asg: '' },
      { ref: 'RRB/2026/210/R Persad/Surrender', ts: '14 Aug · 2:40 PM', status: 'Open', client: 'Ravi Persad',
        agent: 'Crystal Fraser', qtype: 'Surrenders', dept: 'Customer Service – Chaguanas', tat: '10',
        pri: 'Normal', closed: '', days: '', tsIso: daysAgo(4), score: 0, fu: 1, asg: '' },
      { ref: 'RRB/2026/205/S Ali/Bounce', ts: '11 Aug · 10:05 AM', status: 'Closed', client: 'Shazad Ali',
        agent: 'Aidan Eugene', qtype: 'Bounce Cheque', dept: 'GLOC Premium Query', tat: '5', pri: 'Normal',
        closed: '13 Aug', days: '2', tsIso: daysAgo(7), score: 5, fu: 0, asg: '' },
      { ref: 'RRB/2026/198/K Dass/Address', ts: '6 Aug · 3:22 PM', status: 'Closed', client: 'Kavita Dass',
        agent: 'Crystal Fraser', qtype: 'Change of Address - Life and Pension', dept: 'Customer Service – Chaguanas',
        tat: '2', pri: 'Normal', closed: '8 Aug', days: '2', tsIso: daysAgo(12), score: 4, fu: 0, asg: '' },
    ]});
  if (a === 'requestcode') return ok({ ok: true, msg: 'If that email is on our records, your access code is on its way.' });
  if (a === 'clientauth')  return ok({ ok: true, type: 'company', name: 'Acme Manufacturing Ltd' });
  if (a === 'clientcases') return ok({ ok: true, type: 'company', name: 'Acme Manufacturing Ltd', cases: [
    { ref: 'RRB/2026/0817/ENRL', subject: 'Group Health Enrollment – Jane Ramlogan', type: 'Group Health Enrollment',
      department: 'Group Insurance Administration', status: 'Open', logged: daysAgo(1),
      progress: '<div style="background:#f7fafc;border:1px solid #e4eef6;border-radius:14px;padding:13px 15px;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td style="font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#0b6ab4;">Logged · routed</td><td style="text-align:right;font-size:20px;font-weight:800;color:#0b6ab4;">24%</td></tr></table><table width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;border-radius:100px;overflow:hidden;border-collapse:separate;"><tr><td style="width:24%;background:#0b6ab4;height:12px;"></td><td style="width:31%;background:#e4eef6;height:12px;"></td><td style="width:25%;background:#f0d9da;height:12px;"></td><td style="width:20%;background:#e4eef6;height:12px;"></td></tr></table><div style="margin-top:9px;padding-top:8px;border-top:1px dashed #dbe6f0;font-size:11.5px;color:#5e7a93;">Day 1 of 5 working-day target · due 25 Aug · <b style="color:#15803d;">on track</b></div></div>' },
    { ref: 'RRB/2026/188/T Mohammed', subject: 'Query on value of policy', type: 'Query on value of policy or paid to date etc.',
      department: 'Customer Service – Chaguanas', status: 'Closed', logged: daysAgo(14),
      progress: '<div style="background:#f7fafc;border:1px solid #e4eef6;border-radius:14px;padding:13px 15px;"><table width="100%" cellpadding="0" cellspacing="0"><tr><td style="font-size:11px;font-weight:800;letter-spacing:.08em;text-transform:uppercase;color:#12b76a;">Resolved</td><td style="text-align:right;font-size:20px;font-weight:800;color:#12b76a;">100%</td></tr></table><table width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;border-radius:100px;overflow:hidden;border-collapse:separate;"><tr><td style="width:25%;background:#0b6ab4;height:12px;"></td><td style="width:30%;background:#eab308;height:12px;"></td><td style="width:25%;background:#f0d9da;height:12px;"></td><td style="width:20%;background:#12b76a;height:12px;"></td></tr></table><div style="margin-top:9px;padding-top:8px;border-top:1px dashed #dbe6f0;font-size:11.5px;color:#5e7a93;">Completed · thank you for your patience</div></div>' },
  ]});
  if (a === 'clientstats')   return ok({ ok: true, total: 14, open: 2, resolved: 12,
    resolutionRate: 86, responseRate: 93, avgResponse: 1.2, avgClose: 3.8, onTime: 91 });
  if (a === 'clienthistory') return ok({ ok: true, items: [
    { who: 'Branch', text: 'Request logged and routed to Group Insurance Administration', when: '17 Aug · 11:04 AM' },
    { who: 'Branch', text: 'We followed up with the department on your behalf', when: '18 Aug · 9:00 AM' },
    { who: 'Department', text: 'The department responded on your case', when: '18 Aug · 1:35 PM' },
    { who: 'Acme Manufacturing Ltd (Company)', text: 'Please expedite — the employee starts Monday', when: '18 Aug · 2:10 PM' } ]});
  if (a === 'clientcomment') return ok({ ok: true });
  if (a === 'enroll')        return ok({ ok: true, ref: 'RRB/2026/0818/141230/ENRL', plans: 'Group Life & Group Health' });
  if (a === 'wall')          return ok({ ok: true, role: 'branch', name: 'Ricky Rampersad', days: 0,
    generated: '18 Aug 2026 · 2:15 PM',
    totals: { total: 214, open: 21, done: 193, overdue: 4, chased: 58, onTime: 84, avg: 3.9, csat: 4.5, rated: 96 },
    weeks: [9,12,11,15,13,17,14,16,12,19,17,14], age: { ok: 13, soon: 4, late: 4 },
    scoreDist: { 1: 2, 2: 4, 3: 9, 4: 30, 5: 51 },
    notes: [{ score: 5, text: 'Sorted the same day — excellent service' }, { score: 4, text: 'Kept me informed the whole way' }],
    depts: [
      { name: 'Customer Service – Chaguanas', n: 84, done: 79, late: 1, chased: 14, onTime: 90, avg: 3.1, csat: 4.6 },
      { name: 'GLOC Premium Query', n: 46, done: 41, late: 1, chased: 12, onTime: 78, avg: 4.6, csat: 4.3 },
      { name: 'Group Insurance Administration', n: 31, done: 27, late: 2, chased: 18, onTime: 74, avg: 5.2, csat: 4.2 },
      { name: 'Health Claims TT', n: 26, done: 24, late: 0, chased: 6, onTime: 95, avg: 2.6, csat: 4.8 } ],
    agents: [
      { name: 'Aidan Eugene', n: 52, done: 49, late: 0, chased: 6, onTime: 94, avg: 3.0, csat: 4.7 },
      { name: 'Crystal Fraser', n: 44, done: 40, late: 2, chased: 15, onTime: 81, avg: 4.4, csat: 4.4 },
      { name: 'Gary Sookdeo', n: 38, done: 33, late: 2, chased: 19, onTime: 69, avg: 5.8, csat: 4.1 } ],
    types: [ { name: 'Bounce Cheque', n: 38 }, { name: 'Surrenders', n: 29 }, { name: 'Statements – tax and csv', n: 24 },
             { name: 'Change of Address', n: 19 }, { name: 'Group Health Enrollment', n: 14 } ]});
  return ok({ ok: true });
});


/* ---------------- the film's own furniture ---------------- */
/* Sync beacon — see sync_timeline.py. The final encode masks it. */
const PATCH = ['#ff0000', '#00ff00', '#0000ff'];
async function setPatch(i) {
  await page.evaluate(c => {
    let p = document.getElementById('qpPatch');
    if (!p) { p = document.createElement('div'); p.id = 'qpPatch';
      p.style.cssText = 'position:fixed;left:2px;bottom:2px;width:10px;height:10px;z-index:2147483647;pointer-events:none;';
      document.body.appendChild(p); }
    p.style.background = c;
  }, PATCH[i % 3]);
}

/* Subtitles: many people will watch this muted on the website, so every line
   of narration is also on screen — thin, on the bottom edge, never covering. */
async function installCaption() {
  await page.evaluate(() => {
    if (document.getElementById('qpCap')) return;
    const c = document.createElement('div');
    c.id = 'qpCap';
    c.style.cssText = 'position:fixed;left:0;right:0;bottom:0;z-index:99999;'
      + 'background:linear-gradient(180deg,rgba(4,17,30,0),rgba(4,17,30,.80) 46%,rgba(4,17,30,.90));'
      + 'color:#eaf4ff;padding:22px 30px 9px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;'
      + "font:400 14px/1.35 'Segoe UI',system-ui,sans-serif;letter-spacing:.2px;text-align:center;"
      + 'text-shadow:0 1px 6px rgba(0,0,0,.8);opacity:0;transition:opacity .5s;pointer-events:none;';
    document.body.appendChild(c);
  });
}
async function cap(text, holdMs) {
  mark('cap', text);
  await setPatch(MARKS.length - 1);
  await installCaption();
  await page.evaluate(t => { const c = document.getElementById('qpCap');
    c.style.opacity = '0';
    setTimeout(() => { c.textContent = t; c.style.opacity = '1'; }, 200); }, text);
  await sleep(holdMs);
}

/* A story card: full screen, one thought. The narrative beats have no UI to
   show, and pretending otherwise would make this a demo instead of a story. */
async function story(line, opts, holdMs) {
  mark('cap', line);
  await setPatch(MARKS.length - 1);
  const o = Object.assign({ sub: '', size: 46, tone: 'dark', hold: true }, opts || {});
  await page.evaluate(({ line, sub, size, tone }) => {
    let s = document.getElementById('qpStory');
    if (!s) { s = document.createElement('div'); s.id = 'qpStory';
      s.style.cssText = 'position:fixed;inset:0;z-index:999998;display:grid;place-items:center;'
        + 'transition:opacity .9s ease;padding:0 9vw;';
      document.body.appendChild(s); }
    s.style.opacity = '1';
    s.style.background = tone === 'light'
      ? 'linear-gradient(155deg,#0d3f68,#0b6ab4)'
      : 'linear-gradient(155deg,#04111e,#0a2338)';
    s.innerHTML = '<div id="qpStoryIn" style="text-align:center;max-width:19em;'
      + "font-family:'Segoe UI',system-ui,sans-serif;\">"
      + '<div style="color:#fff;font-size:' + size + 'px;font-weight:600;line-height:1.25;'
      + 'letter-spacing:-.022em;text-wrap:balance;">' + line + '</div>'
      + (sub ? '<div style="color:#8fb8d8;font-size:17px;margin-top:20px;font-weight:400;'
             + 'letter-spacing:.01em;">' + sub + '</div>' : '')
      + '</div>';
    document.getElementById('qpStoryIn').animate(
      [{ opacity: 0, transform: 'translateY(14px)' }, { opacity: 1, transform: 'none' }],
      { duration: 1100, easing: 'cubic-bezier(.16,1,.3,1)' });
  }, { line, sub: o.sub, size: o.size, tone: o.tone });
  await sleep(holdMs);
}
async function storyOut() {
  await page.evaluate(() => { const s = document.getElementById('qpStory');
    if (s) { s.style.opacity = '0'; setTimeout(() => s.remove(), 950); } });
  await sleep(1000);
}
const type = async (sel, text) => { await page.click(sel); await page.type(sel, text, { delay: 30 }); };

/* ================= THE FILM ================= */
await page.goto('file://' + path.join(HERE, '..', 'index.html'), { waitUntil: 'domcontentloaded' });
await sleep(700);

/* — Act 1: the problem, told plainly — */
await story('Every day, someone asks us for something.', { sub: 'Ricky Rampersad Branch · Chaguanas' }, 6200);
await story('A statement. A claim. A change of address.', { size: 42 }, 6000);
await story('Small things — but never small to the person asking.', { size: 40 }, 6600);
await story('For years, those requests lived in email.', {}, 5200);
await story('And email forgets.', { size: 56 }, 4800);
await story('“Any update?”', { size: 58, sub: 'The honest answer, too often: let me check.' }, 6800);

/* — Act 2: the turn — */
await story('We got tired of saying<br>“let me check.”', { size: 48, tone: 'light' }, 6600);
await story('So the branch built<br>Query&nbsp;Pal.', { size: 54, tone: 'light',
  sub: 'One place where a request cannot be forgotten' }, 6400);
await storyOut();

/* — Act 3: what it actually does — */
await installCaption();
await cap('One link. Every request logged the moment it is made.', 5200);
await page.locator('.card', { hasText: 'Client' }).first().click();
await sleep(1500);
await page.locator('.qcard, .qbtn, .card').filter({ hasText: /statement/i }).first().click().catch(()=>{});
await sleep(1800);
await cap('It already knows the right department — and the day the answer is due.', 6400);
await sleep(1200);
await cap('From that moment, it is a promise with a date on it.', 5200);

/* — Act 4: the chasing — */
await page.goto('file://' + path.join(HERE, 'email-gallery.html'), { waitUntil: 'domcontentloaded' });
await sleep(700);
await installCaption();
await cap('If the department goes quiet, we do not.', 5000);
await page.evaluate(() => show(2));
await cap('A reminder. Then a firmer one, on the same email thread.', 5600);
await page.evaluate(() => show(3));
await cap('And then the branch manager, personally.', 5400);
await page.evaluate(() => show(4));
await cap('All the while, the client is told where things stand.', 6000);
await page.evaluate(() => show(5));
await cap('And if a case has to pause, we say so — nobody is left guessing.', 6200);

/* — Act 5: measured in the open — */
await page.goto('file://' + path.join(HERE, '..', 'wall.html') + '?freeze=1', { waitUntil: 'domcontentloaded' });
await sleep(2600);
await installCaption();
await cap('When it is done, we ask the client how we did.', 5000);
await page.evaluate(() => { for (let i = 0; i < 8; i++) document.getElementById('p'+i).classList.toggle('on', i === 6); });
await sleep(1000);
await cap('Every rating, in their own words.', 4600);
await page.evaluate(() => { for (let i = 0; i < 8; i++) document.getElementById('p'+i).classList.toggle('on', i === 7); });
await sleep(1000);
await cap('And we put the score on the wall, where anyone can see it.', 6000);
await sleep(2600);
await cap('Nothing hidden. Nothing quietly missed.', 5000);

/* — Act 6: the close — */
await story('This is how we work.', { size: 52, tone: 'light' }, 5000);
await story('Not because a system is impressive —', { size: 42, tone: 'light' }, 4800);
await story('because a promise<br>should be kept.', { size: 52, tone: 'light' }, 7000);
await story('Query&nbsp;Pal', { size: 62,
  sub: 'Ricky Rampersad Branch 26000 · Chaguanas · querymypolicies.netlify.app' }, 7500);

mark('end', '');
fs.writeFileSync(path.join(OUT, 'story-timeline.json'), JSON.stringify(MARKS, null, 1));
await ctx.close();
const files = fs.readdirSync(OUT).filter(f => f.endsWith('.webm') && f !== 'querypal-demo.webm' && f !== 'querypal-story.webm');
if (files.length) {
  const src = path.join(OUT, files[0]);
  const dst = path.join(OUT, 'querypal-story.webm');
  fs.renameSync(src, dst);
  console.log('recorded:', dst, Math.round(fs.statSync(dst).size / 1024) + ' KB');
}
await browser.close();
