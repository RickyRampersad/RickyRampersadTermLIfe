// Each group's Schedule of Benefits (23 November 2026), in the browser: the staff panel on a group's page (a PDF read on
// the device, the text checked, saved, published, the employees' link and the message for HR copied) and the employee
// page from that link (the plan, the search, the WhatsApp button, a wrong link). The backend is mocked; every group,
// figure and code is invented. A laptop and a phone. Run: node tests/e2e-schedules.js
// pdf.js is served from a local copy when PDFJS_DIR names a folder holding pdf.min.js and pdf.worker.min.js; without it
// the PDF step is skipped and said so.
const { chromium } = require('playwright'), path = require('path'), fs = require('fs'), http = require('http'), { spawn } = require('child_process');
const ROOT = path.join(__dirname, '..'), PORT = 8874, BASE = 'http://localhost:' + PORT;
const PDFLib = require(path.join(ROOT, 'motor-quote/vendor/pdf-lib-1.17.1.min.js'));
const PDFJS = process.env.PDFJS_DIR || '';
let fails = 0, passes = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x && !c ? '  ' + x : '')); if (!c) fails++; else passes++; };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const SHOTS = process.env.SHOTS || '';
const shot = async (page, name) => { if (SHOTS) { fs.mkdirSync(SHOTS, { recursive: true }); await page.screenshot({ path: path.join(SHOTS, name + '.png'), fullPage: true }); } };
const up = () => new Promise(res => http.get(BASE + '/', r => { r.resume(); res(true); }).on('error', () => res(false)));
const K = 'a1b2c3d4e5f60718293a';
const TEXT = ['GROUP HEALTH SCHEDULE OF BENEFITS', 'Major Medical Maximum | $500,000 per person', 'Calendar Year Deductible | $300 per person | $900 per family',
  'HOSPITAL BENEFITS', 'Room and board, daily maximum | $1,500 per day', 'DENTAL', 'Preventive dental | 100% | $1,000 per year', 'Major dental | 50% after deductible',
  'VISION', 'Lenses and frames | $500 every 24 months', 'MATERNITY', 'Normal delivery | $10,000'].join('\n');

/* a schedule as Guardian lays one out: two columns of text on a page, made with pdf-lib */
async function makePdf() {
  const doc = await PDFLib.PDFDocument.create(), font = await doc.embedFont(PDFLib.StandardFonts.Helvetica), bold = await doc.embedFont(PDFLib.StandardFonts.HelveticaBold);
  const pg = doc.addPage([612, 792]); let y = 740;
  const row = (a, b, f) => { pg.drawText(a, { x: 54, y, size: 11, font: f || font }); if (b) pg.drawText(b, { x: 330, y, size: 11, font }); y -= 22; };
  row('GROUP HEALTH SCHEDULE OF BENEFITS', '', bold); row('Major Medical Maximum', '$500,000 per person'); row('Calendar Year Deductible', '$300 per person');
  row('DENTAL', '', bold); row('Preventive dental', '100% to $1,000 a year'); row('VISION', '', bold); row('Lenses and frames', '$500 every 24 months');
  return Buffer.from(await doc.save());
}
function world(canAct) {
  return { canAct, posts: [], published: false, sched: [] };
}
async function mock(page, W) {
  const json = (route, o) => route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(o) });
  await page.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort());
  await page.route(/cdnjs\.cloudflare\.com/, r => {
    const u = r.request().url(), f = /pdf\.worker\.min\.js$/.test(u) ? 'pdf.worker.min.js' : /pdf\.min\.js$/.test(u) ? 'pdf.min.js' : '';
    if (PDFJS && f) return r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(PDFJS, f)) });
    return r.abort();
  });
  await page.route(/script\.google(usercontent)?\.com/, async route => {
    const req = route.request(), url = new URL(req.url());
    if (req.method() !== 'POST') {
      const a = url.searchParams.get('action') || '';
      if (a === 'gcm.sobList') return json(route, { ok: true, canAct: W.canAct, whatsapp: true, lines: { health: 'Group Health', life: 'Group Life', dental: 'Dental and vision', other: 'Other benefits' },
        link: W.published ? 'https://rickyrampersadbranch.com/mybenefits/?k=' + K : '', group: { key: 'HPL', name: 'Harbour Point Logistics Ltd' }, schedules: W.sched.slice().reverse(),
        questions: W.published ? [{ when: '23 Nov 2026 10:00', via: 'card', q: 'does it cover the dentist', matched: 3 }, { when: '23 Nov 2026 10:05', via: 'card', q: 'zebra', matched: 0 }] : [] });
      if (a === 'gcm.sobView') {
        if (url.searchParams.get('k') !== K) return json(route, { ok: false, error: 'This link is not right. Ask your HR department for your plan’s link, or message HELP 868 on WhatsApp.' });
        return json(route, { ok: true, group: 'Harbour Point Logistics Ltd', code: K, help868: '18684357868',
          plans: [{ ref: 'SB-1', line: 'health', label: 'Group Health', title: 'Group Health · Schedule of Benefits', effective: '2026-06-01', text: TEXT, hasPdf: true },
            { ref: 'SB-2', line: 'life', label: 'Group Life', title: 'Group Life · Schedule of Benefits', effective: '2026-06-01', text: 'GROUP LIFE\nBasic life | 2 times annual salary\nAccidental death | same as basic life', hasPdf: false }] });
      }
      if (a === 'gcm.sobPdf') return json(route, { ok: true, name: 'schedule.pdf', b64: Buffer.from('%PDF-1.4 test').toString('base64') });
      return route.fulfill({ status: 200, contentType: 'image/gif', body: Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64') });
    }
    let b = {}; try { b = JSON.parse(req.postData() || '{}'); } catch (e) {} W.posts.push(b);
    if (b.action === 'gcm.billAct') return json(route, { ok: true, live: false, invites: [] });
    if (b.action !== 'gcm.sobAct') return json(route, { ok: false, error: 'Unknown action (mock)' });
    if (b.act === 'save') { const s = { ref: 'SB-261123-00' + (W.sched.length + 1), line: b.line, label: 'Group Health', title: b.title || 'Group Health · Schedule of Benefits', effective: b.effective, status: 'draft', text: b.text, hasPdf: !!b.pdf, by: 'Kerry Sample', when: '23 Nov 2026 10:00' }; W.sched.push(s); return json(route, { ok: true, ref: s.ref, said: 'Draft saved. Read it as employees will, then press Publish.' }); }
    if (b.act === 'publish') { const s = W.sched.find(x => x.ref === b.ref); s.status = 'published'; s.pubBy = 'Kerry Sample'; s.pubAt = '23 Nov 2026 10:01'; W.published = true; return json(route, { ok: true, said: 'Group Health schedule published.', link: 'https://rickyrampersadbranch.com/mybenefits/?k=' + K }); }
    if (b.act === 'retire') { const s = W.sched.find(x => x.ref === b.ref); s.status = 'retired'; W.published = false; return json(route, { ok: true, said: 'Taken down.' }); }
    return json(route, { ok: false, error: 'Unknown act' });
  });
}
const GROUP = canAct => ({ ok: true, canAct, reasonDays: 30, ai: false,
  group: { key: 'HPL', name: 'Harbour Point Logistics Ltd', assigned: 'Kerry Sample', ownerActive: true, bills: ['TQQ 0001'], to: ['hr@harbour.example'], toFrom: 'salesforce', contact: 'Pat Admin', personal: [] },
  stats: { open: 0, shown: 0, oldest: 0, done: 0, onTimePct: null, rating: null, week: '', nextSendLabel: 'Monday 30 Nov', waiting: 0, late: 0, needReason: 0 },
  account: null, items: [], doneWeek: [], sends: [], responses: [], views: [], record: [], pending: null, coming: null, year: null });
async function noSideways(page) { return page.evaluate(() => { window.scrollTo(400, window.scrollY); const x = window.scrollX; window.scrollTo(0, window.scrollY); return x === 0; }); }

(async () => {
  const srv = spawn('python3', ['-m', 'http.server', String(PORT), '--directory', ROOT], { stdio: 'ignore' });
  for (let i = 0; i < 50 && !(await up()); i++) await sleep(100);
  const browser = await chromium.launch();
  const pdfPath = path.join(require('os').tmpdir(), 'rrb-sob-test.pdf'); fs.writeFileSync(pdfPath, await makePdf());
  try {
    for (const [label, vp] of [['laptop', { width: 1366, height: 900 }], ['phone', { width: 390, height: 844 }]]) {
      console.log('\nStaff page · ' + label);
      const ctx = await browser.newContext({ viewport: vp, permissions: ['clipboard-read', 'clipboard-write'] });
      const page = await ctx.newPage(), errs = [], W = world(true);
      page.on('pageerror', e => errs.push(String(e)));
      page.on('dialog', d => d.accept());
      await mock(page, W);
      await page.goto(BASE + '/groupclientmanagement/', { waitUntil: 'domcontentloaded' });
      await page.evaluate(g => { AUTH = { code: 'TEST', who: 'A00001' }; GROUP = g; VIEW = 'group'; drawGroup(); }, GROUP(true));
      await page.waitForSelector('#sobBody .small', { timeout: 8000 });
      ok('the panel sits on the group’s page under Links to send', await page.$eval('#sob', e => /Schedule of benefits/.test(e.textContent) && !!e.previousElementSibling && e.previousElementSibling.id === 'lnk'));
      ok('with nothing published it says employees have no page yet', /Nothing is published yet/.test(await page.textContent('#sobBody')));
      ok('the add form is open for whoever looks after the group', await page.$eval('#sobAddBox', d => d.open));
      if (PDFJS) {
        await page.setInputFiles('#sobFile', pdfPath);
        await page.waitForFunction(() => /Preventive dental/.test(document.getElementById('sobText').value), null, { timeout: 15000 });
        const t = await page.inputValue('#sobText');
        ok('the PDF is read on the device: a row is a line, its columns split by |', /Preventive dental \| 100% to \$1,000 a year/.test(t) && /^GROUP HEALTH SCHEDULE OF BENEFITS/m.test(t), t);
        ok('the preview draws it as employees will read it', await page.$eval('#sobPrev', e => !!e.querySelector('table') && /Dental/i.test(e.querySelector('.sob-h').parentNode.parentNode.textContent)));
      } else console.log('  SKIP  the PDF read (set PDFJS_DIR to a folder with pdf.min.js and pdf.worker.min.js)');
      await page.fill('#sobText', TEXT);
      await page.fill('#sobF input[name="effective"]', '2026-06-01');
      ok('typing redraws the preview, with headings in sentence case', await page.$eval('#sobPrev', e => [...e.querySelectorAll('.sob-h')].map(h => h.textContent).join('|') === 'Group health schedule of benefits|Hospital benefits|Dental|Vision|Maternity'));
      ok('the count under the box says how many benefit rows there are', /7 benefit rows/.test(await page.textContent('#sobCount')));
      await shot(page, 'sob-staff-form-' + label);
      await page.click('#sobSave');
      await page.waitForSelector('[data-sobpub]', { timeout: 5000 });
      const save = W.posts.find(p => p.act === 'save');
      ok('Save sends the text, the plan, the date and the group', save && save.line === 'health' && save.effective === '2026-06-01' && save.text === TEXT && save.group === 'HPL');
      ok('PDF goes with it when one was read', !PDFJS || (save.pdf && save.fileName === path.basename(pdfPath)));
      ok('the draft says employees do not see it', /Draft: employees do not see it/.test(await page.textContent('#sobBody')));
      await page.click('[data-sobpub]');
      await page.waitForSelector('#sobLink', { timeout: 5000 });
      ok('published: the employees’ link is there to copy', (await page.inputValue('#sobLink')) === 'https://rickyrampersadbranch.com/mybenefits/?k=' + K);
      await page.click('[data-sobcopy="link"]');
      ok('Copy link copies it', (await page.evaluate(() => navigator.clipboard.readText())) === 'https://rickyrampersadbranch.com/mybenefits/?k=' + K);
      await page.click('[data-sobcopy="hr"]');
      const msg = await page.evaluate(() => navigator.clipboard.readText());
      ok('the message for HR greets the contact, gives the link and HELP 868, and says no personal details', /^Hi Pat, your employees can now read Harbour Point Logistics Ltd’s schedule/.test(msg) && msg.includes('/mybenefits/?k=' + K) && /435-7868/.test(msg) && /never anyone’s personal details/.test(msg), msg);
      await page.click('[data-sobview]');
      ok('Read it shows the schedule as employees see it', await page.$eval('.sobview', e => !e.hidden && /Preventive dental/.test(e.textContent)));
      ok('what employees asked lately is listed, and a question the schedule could not answer is flagged', /not in the schedule: a person should answer/.test(await page.textContent('#sobBody')));
      await shot(page, 'sob-staff-published-' + label);
      ok('no sideways scroll', await noSideways(page));
      ok('no page errors', errs.length === 0, errs.join(' | '));
      /* a colleague's group: read only */
      const W2 = world(false); W2.published = true; W2.sched = [{ ref: 'SB-1', line: 'health', label: 'Group Health', title: 'Group Health', status: 'published', text: TEXT, pubBy: 'Kerry Sample' }];
      const p2 = await ctx.newPage(); await mock(p2, W2);
      await p2.goto(BASE + '/groupclientmanagement/', { waitUntil: 'domcontentloaded' });
      await p2.evaluate(g => { AUTH = { code: 'TEST', who: 'A00002' }; GROUP = g; VIEW = 'group'; drawGroup(); }, GROUP(false));
      await p2.waitForSelector('#sobLink', { timeout: 8000 });
      ok('a colleague can copy the link but has no upload, publish or take-down', !(await p2.$('#sobF')) && !(await p2.$('[data-sobret]')) && /are for Kerry Sample/.test(await p2.textContent('#sobBody')));
      await ctx.close();
    }
    for (const [label, vp] of [['phone', { width: 390, height: 844 }], ['laptop', { width: 1366, height: 900 }]]) {
      console.log('\nEmployee page · ' + label);
      const ctx = await browser.newContext({ viewport: vp });
      const page = await ctx.newPage(), errs = [], W = world(true);
      page.on('pageerror', e => errs.push(String(e)));
      await mock(page, W);
      await page.goto(BASE + '/mybenefits/?k=' + K, { waitUntil: 'domcontentloaded' });
      await page.waitForSelector('#plan:not([hidden])', { timeout: 8000 });
      ok('the group’s name heads the page', (await page.textContent('#title')) === 'Harbour Point Logistics Ltd');
      ok('two plans, as tabs, Group Health first', (await page.$$eval('.tab', b => b.map(x => x.textContent))).join() === 'Group Health,Group Life');
      ok('the schedule is drawn as a table', await page.$eval('#sched', e => e.querySelectorAll('tr').length === 7));
      ok('the date it runs from is shown', /from 1 June 2026/.test(await page.textContent('#meta')));
      await page.fill('#q', 'dentist');
      ok('searching “dentist” shows only the dental rows', await page.$eval('#sched', e => { const v = [...e.querySelectorAll('tr')].filter(r => !r.hidden && r.closest('section') && !r.closest('section').hidden).map(r => r.querySelector('th').textContent); return v.join('|') === 'Preventive dental|Major dental'; }));
      await page.click('.chip >> text=Glasses');
      ok('the Glasses chip finds the vision rows', await page.$eval('#sched', e => [...e.querySelectorAll('tr')].filter(r => !r.hidden && !r.closest('section').hidden).map(r => r.querySelector('th').textContent).join('|') === 'Lenses and frames'));
      await page.fill('#q', 'zebra');
      ok('a search the schedule says nothing about points to HELP 868', await page.isVisible('#noHit'));
      await page.fill('#q', '');
      const wa = await page.getAttribute('#wa', 'href');
      ok('the WhatsApp button opens HELP 868 with the group and the plan code in the message', wa.startsWith('https://wa.me/18684357868?text=') && decodeURIComponent(wa).includes('Harbour Point Logistics Ltd. Plan code: ' + K), wa);
      ok('the message is plain ASCII, so nothing is mangled on the way', /^[\x20-\x7e]*$/.test(decodeURIComponent(wa.split('text=')[1])));
      ok('the PDF button shows where a PDF is kept', await page.isVisible('#pdf'));
      await page.click('.tab >> text=Group Life');
      ok('Group Life opens its own schedule, with no PDF button', /Basic life/.test(await page.textContent('#sched')) && !(await page.isVisible('#pdf')));
      ok('the page says Guardian assesses every claim', /assesses every claim/.test(await page.textContent('#plan')));
      ok('no sideways scroll', await noSideways(page));
      await shot(page, 'sob-employee-' + label);
      ok('the link never leaves in a referrer', (await page.getAttribute('meta[name="referrer"]', 'content')) === 'no-referrer');
      const p2 = await ctx.newPage(); await mock(p2, W);
      await p2.goto(BASE + '/mybenefits/?k=ffffffffffffffffffff', { waitUntil: 'domcontentloaded' });
      await p2.waitForSelector('#bad:not([hidden])', { timeout: 8000 });
      ok('a wrong link says so and still offers HELP 868', /not right/.test(await p2.textContent('#badText')) && await p2.isVisible('#badWa'));
      await p2.goto(BASE + '/mybenefits/?k=abc', { waitUntil: 'domcontentloaded' });
      await p2.waitForSelector('#bad:not([hidden])', { timeout: 8000 });
      ok('a cut-off link is caught on the page, without asking the backend', /not complete/.test(await p2.textContent('#badText')));
      ok('no page errors', errs.length === 0, errs.join(' | '));
      await ctx.close();
    }
  } finally { await browser.close(); srv.kill(); }
  console.log('\n' + passes + ' passed, ' + fails + ' failed');
  process.exit(fails ? 1 : 0);
})();
