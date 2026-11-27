// The staff page's new look (27 November 2026: "yes the staff page a new look"): Home, the menu (side, icon strip, tab
// bar), the group in sections, and the pages. The backend is mocked with three invented groups. Run: node tests/e2e-staff-shell.js
const { chromium } = require('playwright'), path = require('path'), http = require('http'), { spawn } = require('child_process');
const ROOT = path.join(__dirname, '..'), PORT = 8874, U = 'http://localhost:' + PORT + '/groupclientmanagement/';
let fails = 0, passes = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x && !c ? '  ' + x : '')); if (!c) fails++; else passes++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const up = () => new Promise(res => http.get(U, r => { r.resume(); res(true); }).on('error', () => res(false)));
const st = (o) => Object.assign({ open: 3, late: 0, waiting: 0, oldest: 12, done: 20, onTimePct: 90, rating: 4.5, needReason: 0, ready: true, hold: '', why: '', week: 'due',
  nextSendLabel: 'Monday 30 Nov, 10:30', sentThisWeek: '', shown: 2, lastResponse: '' }, o);
const grp = (key, name, own, s) => ({ key, name, assigned: own ? 'Dana Sample' : 'Kerry Sample', ownerActive: true, bills: [key.toUpperCase() + ' 1000'], own, canAct: own, stats: st(s), doneToday: [] });
const BOARD = { ok: true, role: 'staff', title: 'Support team', me: 'Dana Sample', dow: 5, today: '2026-11-27', refreshed: '27 Nov 2026, 6:05 AM', salesforce: true, nextSend: 'Monday 30 Nov, 10:30',
  groups: [grp('abc', 'Alpha Bay Co Ltd', true, {}), grp('bcd', 'Beta Cove Ltd', true, { week: 'queued', approved: { for: 'Monday 30 Nov, 10:30' }, late: 2 }),
    grp('cde', 'Cedar Point Ltd', false, { needReason: 1 })] };
const GROUP = { ok: true, canAct: true, reasonDays: 30, ai: false,
  group: { key: 'abc', name: 'Alpha Bay Co Ltd', assigned: 'Dana Sample', ownerActive: true, bills: ['ABC 1000'], to: ['hr@alpha.example'], toFrom: 'salesforce', contact: 'Pat Admin', personal: [] },
  stats: st({}), account: null, items: [], doneWeek: [], sends: [], responses: [], views: [], record: [], pending: null, coming: null, year: null };

async function mock(page) {
  const json = (route, o) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
  await page.route(/fonts\.(googleapis|gstatic)\.com|cdnjs\.cloudflare\.com/, r => r.abort());
  await page.route(/script\.google(usercontent)?\.com/, async route => {
    const u = new URL(route.request().url()), a = u.searchParams.get('action');
    if (route.request().method() === 'GET' && !a) return route.fulfill({ status: 200, contentType: 'image/gif', body: Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64') });
    if (a === 'gcm.board') return json(route, BOARD);
    if (a === 'gcm.group') return json(route, GROUP);
    return json(route, { ok: true, invites: [], live: false });
  });
}
const sideways = page => page.evaluate(() => { window.scrollTo(500, window.scrollY); const x = window.scrollX; window.scrollTo(0, window.scrollY); return x === 0; });

(async () => {
  const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', ROOT], { stdio: 'ignore' });
  for (let i = 0; i < 50 && !(await up()); i++) await sleep(100);
  const browser = await chromium.launch();
  try {
    for (const [label, vp] of [['laptop', { width: 1366, height: 900 }], ['tablet', { width: 820, height: 1180 }], ['phone', { width: 390, height: 844 }]]) {
      console.log('\n' + label);
      const ctx = await browser.newContext({ viewport: vp }), page = await ctx.newPage(), errs = [];
      await ctx.addInitScript(() => {
        if (sessionStorage.getItem('t')) return;
        ['rrb-gcm-page', 'rrb-gcm-filter', 'rrb-gcm-acc'].forEach(k => localStorage.removeItem(k));
        localStorage.setItem('rrb-gcm-code', 'TEST'); localStorage.setItem('rrb-gcm-who', 'A00001'); sessionStorage.setItem('t', '1');
      });
      page.on('pageerror', e => errs.push(String(e)));
      await mock(page);
      await page.goto(U, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('.kpis', { timeout: 15000 });
      const app = await page.innerText('#app');
      ok('opens on Home: the greeting, the figures, Needs you and This week', /Needs you/.test(app) && /This week/.test(app) && !!(await page.$('.hero h1')));
      ok('Home counts only the groups you look after', await page.$eval('.hero .pills', e => /\b2\s+groups you look after/.test(e.innerText)));
      ok('"to approve" on Home is the same count as the Groups filter', await page.$eval('.kpi[data-fs="due"] .kv', e => e.textContent) === '1');
      ok('the menu is shown and marks Home', await page.$eval('#side', e => getComputedStyle(e).display !== 'none') && await page.$eval('#side .nv.on', e => e.dataset.page) === 'home');
      const rows = await page.$$eval('.arow', r => r.map(x => x.innerText).join('|'));
      ok('Needs you lists the approval and the late items', /Alpha Bay[\s\S]*Approve/.test(rows) && /past target/.test(rows));
      await page.click('.kpi[data-fs="due"]');
      ok('a figure opens Groups filtered to it', await page.$eval('#side .nv.on', e => e.dataset.page) === 'groups' && (await page.$$('.cards .card')).length === 1);
      await page.click('.cards .card');
      await page.waitForSelector('.secnav', { timeout: 10000 });
      ok('a group opens with its name, Billing review and the section bar', !!(await page.$('.gtitle h1')) && !!(await page.$('#bkBill')) && (await page.$$('.secnav a')).length >= 4);
      ok('each part of the group is a section', (await page.$$eval('section.gsec', s => s.map(x => x.id))).join(',') === 'sLetter,sItems,sLinks,sRecord');
      await page.click('#bk'); await page.waitForSelector('.cards', { timeout: 10000 });
      ok('← Groups goes back to Groups', await page.$eval('#side .nv.on', e => e.dataset.page) === 'groups');
      await page.click('#side [data-page="accounts"]'); await sleep(300);
      ok('Every account is its own page', /Every account/.test(await page.$eval('.phd h1', e => e.textContent)));
      if (label === 'phone') {
        ok('on a phone the menu is a tab bar along the bottom', await page.$eval('#side', e => getComputedStyle(e).position === 'fixed' && e.getBoundingClientRect().bottom >= innerHeight - 1));
        await page.click('[data-more]');
        ok('More holds the tools', (await page.$$eval('.side .xs a.nv', a => a.map(x => x.getAttribute('href')))).join(' ') === 'billing.html /premium-due/ training.html');
        ok('the top bar fits on one line', await page.$eval('.topin', e => e.getBoundingClientRect().height <= 64));
      } else if (label === 'tablet') ok('on a tablet the menu is a strip of icons', await page.$eval('#side', e => e.getBoundingClientRect().width < 110));
      else ok('on a laptop the menu has its section names', await page.$eval('.nlab', e => getComputedStyle(e).display !== 'none'));
      ok('no sideways scroll', await sideways(page));
      await page.reload({ waitUntil: 'domcontentloaded' }); await page.waitForSelector('#side .nv.on', { timeout: 15000 });
      ok('a reload comes back to the same page', await page.$eval('#side .nv.on', e => e.dataset.page) === 'accounts');
      ok('no page errors', errs.length === 0, errs.join(' | '));
      await ctx.close();
    }
  } finally { await browser.close(); srv.kill(); }
  console.log('\n' + passes + ' passed, ' + fails + ' failed');
  process.exit(fails ? 1 : 0);
})();
