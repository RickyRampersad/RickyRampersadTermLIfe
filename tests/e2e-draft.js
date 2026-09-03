// Sasha, 2 September, 3:25pm: "Server returned 404." on her last block of
// the day, with the whole thing typed out.
//
// She had filed three blocks that morning without trouble. The fourth went in
// at the hour when the branch checkpoint and the staff nudge both run on the
// same script, and everybody files at once.
//
// This walks her afternoon: type it, be refused three times, close the page,
// come back. The block must still be filled in.
//
// Run: node tests/e2e-draft.js   (needs playwright + a chromium on disk)
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const ROOT = require('path').join(__dirname, '..');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const TYPES = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css',
                '.mp3':'audio/mpeg', '.mp4':'video/mp4', '.png':'image/png', '.jpg':'image/jpeg' };

const server = http.createServer((req, res) => {
  let f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('no'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

const PERSON = { staffId:'sasha', name:'Sasha Lalla', email:'sasha@example.com', agentNumber:'S1',
                 unit:'Support', grade:'Sales Support Assistant · G3', role:'ssa',
                 tier:'support', tierLabel:'Sales Support', tierOrder:4, reportsTo:'kamla', manager:false };
const SCHEDULE = { sasha: { start:'08:00', end:'16:00', lunch:'12:30-13:30',
  blocks: { KPI1:{time:'8 – 10am', focus:'Premium Dues / Surveys'},
            KPI2:{time:'10 – 12pm', focus:'Ind. Health Billing Recon'},
            PM1:{time:'1 – 3pm',   focus:'Adopt an Orphan'},
            PM2:{time:'3 – 4pm',   focus:'Task Mgmt / Branch Meeting Reports'} } } };

let failSaves = true, saveAttempts = 0;
let fails = 0;
const ok = (l,c,x='') => { console.log((c?'  PASS  ':'  FAIL  ')+l+(x?'  '+x:'')); if(!c) fails++; };

(async () => {
  await new Promise(r => server.listen(8791, r));
  const browser = await chromium.launch({ executablePath: CHROME });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e)));
  page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });

  await page.route('**/macros/s/**', async route => {
    const body = JSON.parse(route.request().postData() || '{}');
    const reply = j => route.fulfill({ status:200, contentType:'application/json', body:JSON.stringify(j) });
    if (body.action === 'login')
      return reply({ ok:true, token:'tok', profile:PERSON, roster:[PERSON], schedule:SCHEDULE, kpis:{} });
    if (body.action === 'me')
      return reply({ ok:true, profile:PERSON, roster:[PERSON], schedule:SCHEDULE, kpis:{} });
    if (body.action === 'rows')    return reply({ ok:true, rows:[] });
    if (body.action === 'training')return reply({ ok:true, training:[] });
    if (body.action === 'saveBlock') {
      saveAttempts++;
      if (failSaves) return route.fulfill({ status:404, contentType:'text/html', body:'Page Not Found' });
      return reply({ ok:true, block:body.block, at:'15:42', blocksDone:1, submitted:[body.block] });
    }
    return reply({ ok:true });
  });

  await page.goto('http://localhost:8791/kpi/', { waitUntil:'networkidle' });
  console.log('\nSigning in:\n');
  await page.fill('input[type="text"], input:not([type="password"]):visible', 'sasha@example.com').catch(()=>{});
  const inputs = await page.$$('input');
  await inputs[0].fill('sasha@example.com');
  await inputs[1].fill('1');
  await page.click('button:has-text("Sign in")');
  await page.waitForTimeout(1500);
  ok('landed on her own day', await page.locator('text=YOUR DAY').count() > 0);

  console.log('\nShe opens the last block and types it out:\n');
  const pm2 = page.locator('text=Afternoon 2').first();
  await pm2.click();
  await page.waitForTimeout(400);
  const areas = await page.locator('textarea:visible').all();
  ok('the block opened', areas.length >= 3, areas.length + ' fields');
  await areas[0].fill('Actioned remaining tasks');
  await areas[1].fill('3 tasks');
  await areas[2].fill('2');
  await page.waitForTimeout(400);

  const stored = await page.evaluate(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k.indexOf('rrb_kpi_draft_') === 0) return localStorage.getItem(k);
    }
    return null;
  });
  ok('the draft is on the device before she even submits', !!stored && stored.includes('Actioned remaining tasks'));

  console.log('\nThe sheet answers 404, three times:\n');
  await page.click('button:has-text("Submit block")');
  await page.waitForTimeout(9000);
  ok('it retried instead of giving up on the first 404', saveAttempts >= 3, saveAttempts + ' attempts');
  const msg = await page.locator('text=/busy, not broken|saved on this phone/').count();
  ok('she is told her words are safe', msg > 0);
  ok('the text is still on screen', await areas[0].inputValue() === 'Actioned remaining tasks');

  console.log('\nShe closes the page and comes back — the hard case:\n');
  await page.reload({ waitUntil:'networkidle' });
  await page.waitForTimeout(1800);
  await page.locator('text=Afternoon 2').first().click();
  await page.waitForTimeout(500);
  const after = await page.locator('textarea:visible').all();
  const back = await after[0].inputValue();
  ok('her afternoon survived the reload', back === 'Actioned remaining tasks', JSON.stringify(back));
  ok('and the rest of it', await after[1].inputValue() === '3 tasks');

  console.log('\nThe sheet recovers:\n');
  failSaves = false;
  await page.click('button:has-text("Submit block")');
  await page.waitForTimeout(2500);
  ok('it sends', await page.locator('text=/Sent 15:42/').count() > 0);
  const left = await page.evaluate(() => {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k.indexOf('rrb_kpi_draft_') === 0) return localStorage.getItem(k);
    }
    return null;
  });
  ok('the landed block is dropped from the draft', !left || !JSON.parse(left).blocks.PM2);

  const real = errors.filter(e => !/favicon|Failed to load resource/i.test(e));
  ok('no javascript errors on the page', real.length === 0, real.slice(0,2).join(' | '));

  await browser.close(); server.close();
  console.log('\n' + (fails ? fails + ' FAILED' : 'all green') + '\n');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
