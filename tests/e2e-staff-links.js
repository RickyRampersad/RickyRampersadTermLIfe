// The staff page's "Links to send" (23 November 2026: "we should be able to copy and paste the link into the respond io").
// A group's own links anyone may copy; a new member's own enrolment link, made in the group's name without e-mailing it,
// for whoever looks after the group. The Apps Script backend is mocked; every name, address and code is invented.
// A laptop and a phone; the clipboard read back; no sideways scroll, no page errors. Run: node tests/e2e-staff-links.js
const { chromium } = require('playwright'), path = require('path'), fs = require('fs'), http = require('http'), { spawn } = require('child_process');
const ROOT = path.join(__dirname, '..'), PORT = 8873, U = 'http://localhost:' + PORT + '/groupclientmanagement/';
let fails = 0, passes = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x && !c ? '  ' + x : '')); if (!c) fails++; else passes++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SHOTS = process.env.SHOTS || '';
const shot = async (page, name) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: true }); } };
const up = () => new Promise(res => http.get(U, r => { r.resume(); res(true); }).on('error', () => res(false)));
const LINK = 'https://rickyrampersadbranch.com/benefits/enroll.html?inv=';

function world(live) {
  return { posts: [], live, invites: [
    { ref: 'EN-261120-001', employee: 'Chris Sample', first: 'Chris', email: 'chris@home.example', mobile: '', cover: 'Group Health', effective: '2026-12-01', status: 'waiting', words: 'Waiting on Chris · reminded 2 times', test: !live, link: LINK + 'c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1c1', expires: '2027-01-19', madeBy: '', sentBy: 'Pat Admin' },
    { ref: 'EN-260901-001', employee: 'Lee Sample', first: 'Lee', email: '', mobile: '868-555-0199', cover: 'Group Life', effective: '2026-10-01', status: 'expired', words: 'Link expired', test: !live, link: '', expires: '2026-10-31', madeBy: 'made at the branch by Kerry Sample', sentBy: 'Pat Admin' }] };
}
const GROUP = (canAct) => ({ ok: true, canAct, reasonDays: 30, ai: false,
  group: { key: 'hpl', name: 'Harbour Point Logistics Ltd', assigned: 'Kerry Sample', ownerActive: true, bills: ['TQQ 0001'], to: ['hr@harbour.example'], toFrom: 'salesforce', contact: 'Pat Admin', personal: [] },
  stats: { open: 0, shown: 0, oldest: 0, done: 0, onTimePct: null, rating: null, week: '', nextSendLabel: 'Monday 30 Nov', waiting: 0, late: 0, needReason: 0 },
  account: null, items: [], doneWeek: [], sends: [], responses: [], views: [], record: [], pending: null, coming: null, year: null });

async function mock(page, W) {
  const json = (route, o) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
  await page.route(/fonts\.(googleapis|gstatic)\.com|cdnjs\.cloudflare\.com/, r => r.abort());
  await page.route(/script\.google(usercontent)?\.com/, async route => {
    const req = route.request();
    if (req.method() !== 'POST') return route.fulfill({ status: 200, contentType: 'image/gif', body: Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64') });
    let b = {}; try { b = JSON.parse(req.postData() || '{}'); } catch (e) {} W.posts.push(b);
    if (b.action !== 'gcm.billAct') return json(route, { ok: false, error: 'Unknown action (mock): ' + b.action });
    if (b.act === 'invites') return json(route, { ok: true, live: W.live, contact: 'Pat Admin', invites: W.invites });
    if (b.act === 'inviteMake') {
      const x = { ref: 'EN-261123-001', employee: b.first + ' ' + b.last, first: b.first, email: b.email || '', mobile: b.mobile || '', cover: b.covHealth === 'Y' && b.covLife === 'Y' ? 'Group Health and Group Life' : b.covLife === 'Y' ? 'Group Life' : 'Group Health',
        effective: b.effective, status: 'waiting', words: 'Waiting on ' + b.first, test: !W.live, link: LINK + 'a9a9a9a9a9a9a9a9a9a9a9a9a9a9a9a9', expires: '2027-01-22', madeBy: 'made at the branch by Ricky Sample', sentBy: b.admin };
      W.invites.unshift(x); return json(route, { ok: true, ref: x.ref, test: !W.live, invite: x, said: 'Link made for ' + x.first + ' (' + x.ref + '). Copy it and paste it into respond.io.' });
    }
    if (b.act === 'inviteAgain') { const x = W.invites.find(i => i.ref === b.ref); x.status = 'waiting'; x.words = 'Waiting on ' + x.first; x.link = LINK + 'b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2'; x.expires = '2027-01-22'; return json(route, { ok: true, said: x.first + '’s link is good for another 60 days. Copy it and paste it into respond.io.' }); }
    return json(route, { ok: false, error: 'Unknown action (mock): ' + b.act });
  });
}
async function noSideways(page) { return page.evaluate(() => { window.scrollTo(400, window.scrollY); const x = window.scrollX; window.scrollTo(0, window.scrollY); return x === 0; }); }
async function openGroup(page, canAct) {
  await page.goto(U, { waitUntil: 'domcontentloaded' });
  await page.evaluate(g => { AUTH = { code: 'TEST', who: 'A00001' }; GROUP = g; VIEW = 'group'; drawGroup(); }, GROUP(canAct));
}
const clip = page => page.evaluate(() => navigator.clipboard.readText());

(async () => {
  const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', ROOT], { stdio: 'ignore' });
  for (let i = 0; i < 50 && !(await up()); i++) await sleep(100);
  const browser = await chromium.launch();
  try {
    for (const [label, vp] of [['laptop', { width: 1366, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
      console.log('\n' + label);
      const ctx = await browser.newContext({ viewport: vp, permissions: ['clipboard-read', 'clipboard-write'] });
      const page = await ctx.newPage(), errs = [], W = world(false);
      page.on('pageerror', e => errs.push(String(e)));
      await mock(page, W);
      await openGroup(page, true);
      await page.waitForSelector('#lnkInv .lk.inv', { timeout: 8000 });
      ok('the panel sits under the account bar', await page.$eval('#lnk', e => /Links to send/.test(e.textContent) && /respond\.io/.test(e.textContent)));
      ok('test mode is said plainly', /Test mode/.test(await page.textContent('#lnkInv')));
      // the group's own links
      ok('the group’s links are open to see, not folded away', await page.$eval('#lnk details.lkg', d => d.open));
      const gl = await page.$$eval('#lnk details.lkg .lku', els => els.map(e => e.value));
      ok('five group links, each a full address', gl.length === 5 && gl.every(u => /^https:\/\/rickyrampersadbranch\.com\//.test(u)), gl.join(' '));
      ok('the films are among them', ['/healthenrollment/', '/terminations/', '/pensionpresentationourprocess/'].every(p => gl.some(u => u.endsWith(p))));
      ok('the walkthrough cut on the old layout is not offered until it is re-cut', !gl.some(u => u.endsWith('/groupmgt/yourpage/')));
      await page.click('#lnk details.lkg [data-copy="lg1"]');
      ok('Copy link puts the health enrolment film on the clipboard', (await clip(page)) === 'https://rickyrampersadbranch.com/healthenrollment/');
      ok('the toast says paste it into respond.io', /respond\.io/.test(await page.textContent('#toast')));
      // a member's own link
      await page.click('#lnkInv [data-copy="li0"]');
      ok('Copy link copies Chris’s own link', (await clip(page)) === W.invites[0].link);
      await page.click('#lnkInv [data-wa="0"]');
      const msg = await clip(page);
      ok('the WhatsApp message greets them, names the group and the cover', /^Hi Chris, Harbour Point Logistics Ltd has asked us/.test(msg) && /Group Health/.test(msg) && /1 Dec 2026/.test(msg), msg);
      ok('the message carries the link and says it is theirs alone', msg.includes(W.invites[0].link) && /yours alone/.test(msg));
      ok('an expired link has no address to copy, only Renew', !(await page.$('#li1')) && !!(await page.$('[data-renew="EN-260901-001"]')));
      ok('a link with no e-mail says WhatsApp only', /no e-mail: WhatsApp only/.test(await page.textContent('#lnkInv')));
      await page.click('[data-renew="EN-260901-001"]');
      await page.waitForSelector('#li1', { timeout: 5000 });
      ok('Renew asks for no e-mail and gives the link back', W.posts.some(p => p.act === 'inviteAgain' && p.send === 'N') && (await page.inputValue('#li1')).endsWith('b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2b2'));
      // make one
      if (!(await page.$('#mkF'))) await page.click('#mkBox summary'); else if (!(await page.$eval('#mkBox', d => d.open))) await page.click('#mkBox summary');
      ok('the contact is filled from Salesforce', (await page.inputValue('#mkF [name=admin]')) === 'Pat Admin');
      await page.fill('#mkF [name=first]', 'Marcus'); await page.fill('#mkF [name=last]', 'Sample');
      await page.fill('#mkF [name=mobile]', '868-555-0101'); await page.fill('#mkF [name=effective]', '2026-12-15');
      await page.check('#mkF [name=covLife]');
      await page.click('#mkGo');
      await page.waitForFunction(() => /Marcus/.test(document.querySelector('#lnkInv').textContent), null, { timeout: 5000 });
      const mk = W.posts.find(p => p.act === 'inviteMake');
      ok('made without e-mailing it', mk && mk.send === 'N' && !mk.email && mk.covHealth === 'Y' && mk.covLife === 'Y');
      ok('the new link is selected, ready to copy', await page.evaluate(() => document.activeElement && document.activeElement.id === 'li0' && document.activeElement.value.includes('a9a9')));
      // asking to e-mail with no address is stopped on the page
      if (!(await page.$eval('#mkBox', d => d.open))) await page.click('#mkBox summary');
      await page.fill('#mkF [name=first]', 'Ann'); await page.fill('#mkF [name=last]', 'Sample'); await page.fill('#mkF [name=effective]', '2026-12-15');
      await page.check('#mkF [name=send]'); const n = W.posts.length; await page.click('#mkGo'); await sleep(300);
      ok('e-mail ticked with no address: stopped before anything is sent', W.posts.length === n && /e-mail address/.test(await page.textContent('#toast')));
      ok('no sideways scroll', await noSideways(page));
      await shot(page, 'links-' + label);
      ok('no page errors', !errs.length, errs.join(' | '));
      await ctx.close();
    }
    console.log('\nread only (a colleague’s group)');
    const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 }, permissions: ['clipboard-read', 'clipboard-write'] });
    const page = await ctx.newPage(), W = world(true);
    await mock(page, W);
    await openGroup(page, false);
    await sleep(500);
    ok('the group’s links are there to copy', (await page.$$('#lnk details.lkg .lku')).length === 5);
    ok('no member links are read for a colleague’s group', !W.posts.some(p => p.act === 'invites') && /assistant branch manager or the branch manager/.test(await page.textContent('#lnkInv')));
    await ctx.close();
    console.log('\nlive');
    const ctx2 = await browser.newContext({ viewport: { width: 1366, height: 900 } });
    const p2 = await ctx2.newPage(), W2 = world(true);
    await mock(p2, W2); await openGroup(p2, true);
    await p2.waitForSelector('#lnkInv .lk.inv', { timeout: 8000 });
    ok('live: no test-mode note', !/Test mode/.test(await p2.textContent('#lnkInv')));
    await ctx2.close();
  } finally { await browser.close(); srv.kill(); }
  console.log('\n' + passes + ' passed, ' + fails + ' failed');
  process.exit(fails ? 1 : 0);
})();
