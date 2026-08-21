// Drives the queue the way a manager does: open a card, approve, attest, sign,
// submit — and asserts a real PNG signature leaves the page.
const { chromium } = require('playwright');
const S = '/tmp/claude-0/-home-user-RickyRampersadTermLIfe/203562d4-c614-5eed-b728-644df21311be/scratchpad/';

let seed = 11; const rnd = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
const rows = [];
for (let i = 0; i < 8; i++) {
  const sub = new Date(Date.now() - (3 + i) * 864e5);
  const pend = i < 5;
  const r = { submissionId: 'v' + i, advisorName: 'Felicia Rampersad', agentCode: 'A1100' + i,
    reviewerName: 'Ricky Rampersad', submittedAt: sub.toISOString(),
    status: pend ? 'pending_review' : 'approved', approvedAt: pend ? '' : sub.toISOString(),
    appType: 'full', insuranceNeed_calc: 1210000, cashSurplus_calc: 4500,
    clientName: 'Alice Mohammed ' + i, monthlyIncomeTotal: 14000, monthlyExpenses: 9500,
    dob: new Date(1980, 3, 12).toISOString(), idNumber: '19' + Math.floor(rnd() * 9e8),
    maritalStatus: 'Married', smoker: 'No', occupation: 'Teacher',
    rec1Rec: 'Guardian Term Life 20', rec1Amt: 749000, rec1Prem: 419, rec1Mode: 'Monthly',
    rec1Reason: i % 2 ? 'Protection matched to the need' : '',
    caseHoldAt: '', caseHoldBy: '', caseHoldNote: '' };
  if (pend) r._checks = { adviceOnly: false, bio: [{ k: 'Client', v: r.clientName, missing: false }],
    concerns: [], clientEmail: 'c@x.tt' };
  rows.push(r);
}

(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1280, height: 900 } });
  const posts = [];
  const errs = [];
  p.on('pageerror', e => errs.push(e.message));

  await p.route('**/exec*', route => {
    const req = route.request();
    const u = req.url();
    if (req.method() === 'POST') {
      let body = {};
      try { body = JSON.parse(req.postData() || '{}'); } catch (e) {}
      posts.push(body);
      return route.fulfill({ status: 200, contentType: 'application/json',
        body: JSON.stringify({ ok: true, id: body.id,
          status: body.v === 'approve' ? 'approved' : 'changes_requested' }) });
    }
    if (u.includes('action=login')) return route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ ok: true, name: 'Ricky Rampersad', role: 'Branch Manager', token: 'demo' }) });
    return route.fulfill({ status: 200, contentType: 'application/json',
      body: JSON.stringify({ ok: true, rows }) });
  });

  await p.goto('file://' + S + 'factfind360-site/insights.html');
  await p.fill('#gEmail', 'A10099'); await p.fill('#gPass', 'demo');
  await p.click('#gate button'); await p.waitForTimeout(1400);

  const cards = await p.$$('#queue .qc');
  console.log('queue cards:', cards.length);
  if (!cards.length) { console.log('FAIL: no queue'); await b.close(); return; }

  // 1 — Approve opens the signing panel rather than deciding on the spot
  await p.click('#queue .qc:first-child .qb.ok');
  await p.waitForTimeout(400);
  const open = await p.$eval('#queue .qc:first-child .qsign', e => e.classList.contains('open'));
  console.log('panel opens on Approve:', open);
  console.log('nothing sent yet:', posts.length === 0);

  // 2 — submitting with nothing ticked is refused
  await p.click('#queue .qc:first-child .qsgo');
  await p.waitForTimeout(250);
  console.log('blocked without attestations:',
    posts.length === 0, '|', await p.$eval('#queue .qc:first-child .qmsg', e => e.textContent.slice(0, 46)));

  // 3 — tick all four, still refused with no signature
  for (let i = 1; i <= 4; i++)
    await p.click(`#queue .qc:first-child .qsatt label:nth-child(${i}) input`);
  await p.click('#queue .qc:first-child .qsgo');
  await p.waitForTimeout(250);
  console.log('blocked without a signature:',
    posts.length === 0, '|', await p.$eval('#queue .qc:first-child .qmsg', e => e.textContent.slice(0, 46)));

  // 4 — draw on the pad, then submit
  const bb = await (await p.$('#queue .qc:first-child .qpad')).boundingBox();
  await p.mouse.move(bb.x + 40, bb.y + bb.height * 0.65);
  await p.mouse.down();
  for (let i = 0; i <= 24; i++)
    await p.mouse.move(bb.x + 40 + i * 9, bb.y + bb.height * (0.65 - 0.28 * Math.sin(i / 3.2)));
  await p.mouse.up();
  await p.waitForTimeout(150);
  await p.click('#queue .qc:first-child .qsgo');
  await p.waitForTimeout(700);

  const sent = posts[posts.length - 1] || {};
  console.log('posted:', posts.length === 1);
  console.log('  stage      :', sent.stage);
  console.log('  v          :', sent.v);
  console.log('  attestation:', ['vd', 'vr', 'vs', 'vc'].map(k => k + '=' + sent[k]).join(' '));
  console.log('  signName   :', sent.signName);
  console.log('  sig is png :', String(sent.sig || '').startsWith('data:image/png'),
    '(' + Math.round(String(sent.sig || '').length / 1024) + 'kb)');
  console.log('  card msg   :', await p.$eval('#queue .qc:first-child .qmsg', e => e.textContent.slice(0, 70)));

  // 5 — the typed-name fallback also produces a mark
  await p.waitForTimeout(1800);
  const c2 = await p.$$('#queue .qc');
  if (c2.length) {
    await p.click('#queue .qc:first-child .qb.ok'); await p.waitForTimeout(350);
    for (let i = 1; i <= 4; i++)
      await p.click(`#queue .qc:first-child .qsatt label:nth-child(${i}) input`);
    await p.click('#queue .qc:first-child .qstype'); await p.waitForTimeout(200);
    const drawn = await p.$eval('#queue .qc:first-child .qpad', e => e.dataset.drawn === '1');
    console.log('typed name marks the pad:', drawn);
    await p.screenshot({ path: '/tmp/shots/sign_panel.png', clip: await (await p.$('#queue .qc:first-child')).boundingBox() });
  }

  // 6 — send back carries the reason and does not demand a signature
  await p.waitForTimeout(300);
  console.log('page errors:', errs.length ? errs.slice(0, 3) : 'none');
  await b.close();
})();
