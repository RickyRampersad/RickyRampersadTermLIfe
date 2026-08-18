/* Query Pal demo recorder — drives the real app in Chromium and records it.
   Backend calls are intercepted with realistic responses, so the video shows
   the true UI with no live emails sent. Output: demo/querypal-demo.webm     */
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

/* ---------------- mocked backend ---------------- */
const REF = 'RRB/2026/214/Anita Maharaj/Tax statem';
const daysAgo = n => new Date(Date.now() - n * 864e5).toISOString();
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

/* ---------------- caption machinery ---------------- */
async function installCaption() {
  await page.evaluate(() => {
    if (document.getElementById('demoCap')) return;
    const c = document.createElement('div');
    c.id = 'demoCap';
    c.style.cssText = 'position:fixed;left:50%;bottom:26px;transform:translateX(-50%);z-index:99999;'
      + 'max-width:86%;background:rgba(6,28,49,.94);color:#eaf4ff;padding:13px 26px;border-radius:14px;'
      + 'font:600 17px/1.45 Inter,system-ui,sans-serif;letter-spacing:.1px;text-align:center;'
      + 'box-shadow:0 10px 34px rgba(0,0,0,.4);border:1px solid rgba(84,188,228,.35);'
      + 'opacity:0;transition:opacity .4s;pointer-events:none;';
    document.body.appendChild(c);
  });
}
async function cap(text, holdMs) {
  await installCaption();
  await page.evaluate(t => { const c = document.getElementById('demoCap');
    c.style.opacity = '0'; setTimeout(() => { c.textContent = t; c.style.opacity = '1'; }, 180); }, text);
  await sleep(holdMs);
}
async function card(title, sub, holdMs) {
  await page.evaluate(({ t, s }) => {
    let o = document.getElementById('demoCard');
    if (!o) { o = document.createElement('div'); o.id = 'demoCard';
      o.style.cssText = 'position:fixed;inset:0;z-index:999999;display:grid;place-items:center;'
        + 'background:linear-gradient(150deg,#061c31,#0b355b);opacity:1;transition:opacity .6s;';
      document.body.appendChild(o); }
    o.style.opacity = '1';
    o.innerHTML = '<div style="text-align:center;font-family:Inter,system-ui,sans-serif;padding:0 40px;">'
      + '<div style="width:74px;height:74px;margin:0 auto 22px;border-radius:20px;background:linear-gradient(135deg,#37b1ec,#0b6ab4);display:grid;place-items:center;color:#04223b;font-weight:800;font-size:24px;box-shadow:0 14px 44px rgba(11,127,212,.5);">RRB</div>'
      + '<div style="color:#fff;font-size:38px;font-weight:800;letter-spacing:-1px;">' + t + '</div>'
      + '<div style="color:#9dbdd8;font-size:18px;margin-top:12px;font-weight:500;">' + s + '</div></div>';
  }, { t: title, s: sub });
  await sleep(holdMs);
  await page.evaluate(() => { const o = document.getElementById('demoCard'); if (o) { o.style.opacity = '0'; setTimeout(() => o.remove(), 650); } });
  await sleep(700);
}
const type = async (sel, text) => { await page.click(sel); await page.type(sel, text, { delay: 34 }); };

/* ================= THE FILM ================= */
await page.goto('file://' + path.join(HERE, '..', 'index.html'));
await sleep(900);
await card('Query Pal', 'Ricky Rampersad Branch · how a request travels', 3200);

/* — Scene 1: a client logs a request — */
await cap('One link for clients, agents and companies — this is the client view.', 2600);
await page.locator('.card', { hasText: 'Client' }).first().click();
await sleep(1400);
await cap('They pick what they need in plain language — no email addresses to know.', 2600);
await page.locator('.card', { hasText: 'My Policy & Documents' }).first().click();
await sleep(1500);
await cap('Every request type knows its department and its promised turnaround.', 2400);
await page.locator('.qrow', { hasText: 'tax or policy statement' }).first().click();
await sleep(1600);
await cap('Guided details — and the prep checklist shows exactly what to have ready.', 2500);
await type('#f_client', 'Anita Maharaj');
await type('#f_email', 'anita.maharaj@gmail.com');
await type('#f_policy', 'L5501234');
await type('#f_subject', 'Tax statement for 2025');
await type('#f_desc', 'Good day, I need my 2025 premium tax statement for my BIR filing please.');
await sleep(600);
await cap('Documents attach right on the form — PDF, Word, Excel or photos.', 1800);
const fx = path.join(OUT, 'Signed Request Letter.pdf');
fs.writeFileSync(fx, '%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF');
await page.setInputFiles('#gen_file', [fx]);
await sleep(1700);
await page.locator('#submitBtn').scrollIntoViewIfNeeded();
await sleep(500);
await page.click('#submitBtn');
await sleep(1800);
await cap('Routed instantly — Customer Service Chaguanas gets the branded email, the agent, their manager and the branch are copied, and a Salesforce case is created.', 3600);
await cap('The client walks away with a reference, a deadline — and a PDF receipt if they want one.', 2800);

/* — Scene 2: tracking + the autopilot — */
await page.evaluate(() => { try { openTrack(); } catch (e) {} });
await sleep(800);
await cap('Anyone can track a request by its reference…', 1600);
await page.fill('#trackRef', REF);
await page.evaluate(() => trackGo());
await sleep(2300);
await cap('…and behind the scenes the autopilot chases the department until it answers: follow-ups on the same email thread, escalation, then a phone-call alert.', 3800);
await page.evaluate(() => { try { closeTrack(); } catch (e) {} });
await sleep(400);

/* — Scene 3: the agent dashboard — */
await cap('Agents sign in with their own code — managers see their whole team.', 2200);
await page.evaluate(() => {
  agentAuth = { code: 'AE101', name: 'Aidan Eugene', email: '', role: 'manager' };
  updateAgentBar && updateAgentBar();
  openDash();
});
await sleep(2600);
await cap('Live status on every case — overdue flags, follow-up counts, client ratings.', 3000);
await page.evaluate(() => dashTab('done'));
await sleep(1800);
await page.evaluate(() => { closeDash(); });
await sleep(400);

/* — Scene 4: the client portal — */
await cap('Clients and companies get their own portal. No code? It arrives by email, automatically.', 2400);
await page.evaluate(() => openClientGate());
await sleep(700);
await page.evaluate(() => ccGetCodeToggle());
await type('#ccGetEmail', 'jane@acme.com');
await page.click('#ccGetGo');
await sleep(2300);
await cap('A company signs in and sees every employee case — with live service stats.', 2200);
await page.fill('#ccCode', 'CO-ACME');
await page.evaluate(() => clientLogin());
await sleep(2400);
await cap('Response rate, resolution rate, average days — computed on their cases only. Every case carries a live progress gauge.', 3400);
await page.locator('.ccbtn', { hasText: 'History' }).first().click();
await sleep(1000);
await cap('Full history on every case — follow-ups, department replies, comments. Internal branch notes never appear here.', 3400);
await page.locator('.ccbtn', { hasText: 'History' }).first().click();
await sleep(400);
await cap('Companies can enroll a new member without a single email…', 2000);
await page.evaluate(() => enrollOpen());
await sleep(900);
await type('#enFirst', 'Jane');
await type('#enLast', 'Ramlogan');
await page.check('#enLife'); await sleep(250); await page.check('#enHealth');
await page.fill('#enEff', '2026-09-01');
await sleep(500);
await page.setInputFiles('#enFile', [fx]);
await sleep(1200);
await cap('…Group Insurance Administration is notified, the case is logged, assigned and chased to completion.', 2600);
await page.click('#enGo');
await sleep(2300);
await page.evaluate(() => { enrollClose(); ccSignOut(); });
await sleep(400);

/* — Scene 5: the wall — */
await cap('And the branch sees everything on the wall.', 1800);
await page.goto('file://' + path.join(HERE, '..', 'wall.html'));
await sleep(800);
await page.fill('#gNum', '260026'); await page.fill('#gPwd', '••••••');
await page.click('#gGo');
await sleep(2800);
await installCaption();
await cap('Live: volume, on-time delivery, department performance, agent leaderboard, client satisfaction — refreshed every five minutes.', 4200);
await page.evaluate(() => window.scrollTo({ top: 700, behavior: 'smooth' }));
await sleep(2600);
await page.evaluate(() => window.scrollTo({ top: 1500, behavior: 'smooth' }));
await sleep(2600);

/* — Outro — */
await card('Logged. Routed. Chased. Resolved.', 'Query Pal · querymypolicies.netlify.app', 3600);

await ctx.close();               // flushes the video
const files = fs.readdirSync(OUT).filter(f => f.endsWith('.webm'));
const src = path.join(OUT, files[0]);
const dst = path.join(OUT, 'querypal-demo.webm');
if (src !== dst) fs.renameSync(src, dst);
console.log('recorded:', dst, Math.round(fs.statSync(dst).size / 1024) + ' KB');
await browser.close();
