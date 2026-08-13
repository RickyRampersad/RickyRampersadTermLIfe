/* Client portal in Chromium with the webhook intercepted: get-a-code flow,
   stats tiles, client-safe history, comments, and company enrollment. */
import { createRequire } from 'module';
import path from 'path';
const { chromium } = createRequire(import.meta.url)('/opt/node22/lib/node_modules/playwright');
const HERE = path.dirname(new URL(import.meta.url).pathname);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport:{width:760,height:1100} });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
const calls = [];
await page.route('**/macros/s/**', async route => {
  const req = route.request(); const url = new URL(req.url());
  const a = url.searchParams.get('action') || (req.postData()||'').match(/"action":"(\w+)"/)?.[1] || 'post';
  calls.push({ a, url: req.url(), body: req.postData() || null });
  const ok = b => route.fulfill({ status:200, contentType:'application/json', body: JSON.stringify(b) });
  if (a==='clientauth')   return ok({ ok:true, type:'company', name:'Acme Manufacturing Ltd' });
  if (a==='clientcases')  return ok({ ok:true, type:'company', name:'Acme Manufacturing Ltd', cases:[
    { ref:'RRB/2026/101/Jane', subject:'Group Health Enrollment', type:'Group Health Enrollment',
      department:'Group Insurance Administration', status:'Open', logged:new Date().toISOString(),
      progress:'<div class="pgx">gauge</div>' },
    { ref:'RRB/2026/090/Tom', subject:'Bounce Cheque', type:'Bounce Cheque',
      department:'GLOC Premium Query', status:'Closed', logged:new Date(Date.now()-864e5*9).toISOString(), progress:'' }]});
  if (a==='clientstats')  return ok({ ok:true, total:12, open:3, resolved:9, resolutionRate:75,
                                      responseRate:92, avgResponse:1.4, avgClose:4.2, onTime:88 });
  if (a==='clienthistory')return ok({ ok:true, items:[
    { who:'Branch', text:'Request logged and routed to Group Insurance Administration', when:'2 Aug · 9:14 AM' },
    { who:'Department', text:'The department responded on your case', when:'4 Aug · 2:02 PM' }]});
  if (a==='requestcode')  return ok({ ok:true, msg:'If that email is on our records, your access code is on its way.' });
  if (a==='clientcomment')return ok({ ok:true });
  if (a==='enroll')       return ok({ ok:true, ref:'RRB/2026/0812/101010/ENRL', plans:'Group Life & Group Health' });
  return ok({ ok:true });
});
await page.goto('file://' + path.join(HERE, '..', 'index.html'));

let pass=0, fail=0;
const t=(l,got,want)=>{const ok=JSON.stringify(got)===JSON.stringify(want);
  console.log((ok?'  PASS  ':'  FAIL  ')+l+(ok?'':`\n          got  ${JSON.stringify(got)}\n          want ${JSON.stringify(want)}`)); ok?pass++:fail++;};

// ── get-my-code, before signing in ──
await page.evaluate(() => openClientGate());
t('self-service code link exists', (await page.locator('.ccgetcode').innerText()).includes('Get it by email'), true);
await page.evaluate(() => ccGetCodeToggle());
await page.fill('#ccGetEmail', 'jane@acme.com');
await page.click('#ccGetGo');
await page.waitForFunction(() => document.getElementById('ccGetOut').innerText.length > 0);
t('neutral confirmation shown', (await page.locator('#ccGetOut').innerText()).includes('on its way'), true);
t('requestcode called with the email',
  calls.some(c => c.a==='requestcode' && c.url.includes('jane%40acme.com')), true);
t('company codes stay branch-issued (note shown)',
  (await page.locator('.ccgetcode').innerText()).includes('Company accounts'), true);

// ── sign in as a company ──
await page.fill('#ccCode', 'CO-ACME');
await page.evaluate(() => clientLogin());
await page.waitForSelector('#clientCases.show', { timeout: 5000 });
t('company name shown', await page.locator('#ccName').innerText(), 'Acme Manufacturing Ltd');
t('company badge', await page.locator('#ccBadge').innerText(), 'COMPANY');  // CSS uppercases it

// stats tiles
await page.waitForSelector('.ccstats', { timeout: 5000 });
const tiles = await page.locator('.ccstat').allInnerTexts();
t('four stat tiles render', tiles.length, 4);
t('response rate tile', tiles[0].replace(/\n/g,' '), '92% RESPONSE RATE');
t('resolution rate tile', tiles[1].replace(/\n/g,' '), '75% RESOLUTION RATE');
t('avg resolution tile', tiles[2].replace(/\n/g,' '), '4.2d AVG RESOLUTION');
t('on-time tile', tiles[3].replace(/\n/g,' '), '88% ON TIME');

// cases + dynamic progress
t('cases listed', await page.locator('#ccList .trackcard').count(), 2);
t('server-rendered progress gauge present', await page.locator('#ccList .pgx').count(), 1);
t('open case offers a comment box', (await page.locator('#ccList .trackcard').first().innerText()).includes('Add a comment'), true);

// history — must call the client-scoped endpoint, never casehistory
await page.locator('.ccbtn', { hasText:'History' }).first().click();
await page.waitForSelector('.cctl li', { timeout: 5000 });
t('history renders items', await page.locator('.cctl li').count(), 2);
t('history used the client-scoped endpoint',
  calls.some(c => c.a==='clienthistory' && c.url.includes('code=CO-ACME')), true);
t('the unscoped internal endpoint was never called',
  calls.some(c => c.a==='casehistory'), false);

// comment still works
await page.locator('.ccbtn', { hasText:'comment' }).first().click();
await page.fill('#ccList textarea', 'Any update on this enrollment?');
await page.locator('.ccsend').click();
await page.waitForFunction(cs => cs.some(x=>x), [], { timeout: 3000 }).catch(()=>{});
await page.waitForTimeout(300);
t('client comment posted with the code',
  calls.some(c => c.a==='clientcomment' && c.url.includes('code=CO-ACME')), true);

// ── enrollment ──
t('company sees the enroll button', (await page.locator('#ccEnrollRow').innerText()).includes('Enroll a new member'), true);
await page.evaluate(() => enrollOpen());
t('enrollment modal opens', await page.locator('#enrollModal.show').count(), 1);
await page.fill('#enFirst','Jane'); await page.fill('#enLast','Ramlogan');
await page.check('#enLife'); await page.check('#enHealth');
await page.fill('#enLifePol','GL-5501'); await page.fill('#enEff','2026-09-01');
await page.fill('#enEmail','jane.r@acme.com');
// attach one real PDF through the picker
const fs = await import('fs');
const dir = path.join(HERE,'fixtures'); fs.mkdirSync(dir,{recursive:true});
const pdf = path.join(dir,'Enrollment Form.pdf');
fs.writeFileSync(pdf, '%PDF-1.4\n1 0 obj<</Type/Catalog>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF');
await page.setInputFiles('#enFile', [pdf]);
await page.waitForSelector('.enfile', { timeout: 5000 });
t('document chip shown', (await page.locator('.enfile').innerText()).includes('Enrollment Form.pdf'), true);
await page.click('#enGo');
await page.waitForFunction(() => document.getElementById('enOut').innerText.includes('submitted'), null, { timeout: 5000 });
const en = calls.find(c => c.a==='enroll');
const body = JSON.parse(en.body);
t('enroll POSTed as JSON', en.body !== null, true);
t('  carries the company code', body.code, 'CO-ACME');
t('  both plans', [body.life, body.health], [true, true]);
t('  effective date', body.effdate, '2026-09-01');
t('  document attached with real mime', [body.files.length, body.files[0].mime], [1, 'application/pdf']);
t('  file named for the member', body.files[0].name.startsWith('Enroll_Jane_Ramlogan'), true);
t('  base64 has no data-uri prefix', body.files[0].data.startsWith('JVBER'), true);
t('reference shown to the company', (await page.locator('#enOut').innerText()).includes('/ENRL'), true);
t('form cleared after success', await page.evaluate(() => document.getElementById('enFirst').value), '');

// an individual client must NOT see the enroll button
await page.unroute('**/macros/s/**');
await page.route('**/macros/s/**', route => {
  const a = new URL(route.request().url()).searchParams.get('action');
  const ok = b => route.fulfill({ status:200, contentType:'application/json', body: JSON.stringify(b) });
  if (a==='clientauth')  return ok({ ok:true, type:'individual', name:'Tom Sooknanan' });
  if (a==='clientcases') return ok({ ok:true, type:'individual', name:'Tom Sooknanan', cases:[] });
  return ok({ ok:true, total:0 });
});
await page.evaluate(() => { enrollClose(); ccSignOut(); openClientGate(); });
await page.waitForSelector('#clientGate.show');
await page.fill('#ccCode', 'IND4471');
await page.evaluate(() => clientLogin());
await page.waitForSelector('#clientCases.show', { timeout: 5000 });
t('individual client gets no enroll button', await page.locator('#ccEnrollRow').innerText(), '');

t('no page errors', errors, []);
await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
