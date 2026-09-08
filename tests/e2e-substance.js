// Ask once, then send.
//
// The branch was filing "Actioned remaining tasks" and "3 tasks" and the
// tracker was accepting both without a word. It now asks once, says exactly
// what is missing, and sends on the second press whatever the answer — a
// block is never blocked, because somebody having a rotten day must still be
// able to log it.
//
// Run: node tests/e2e-substance.js   (needs playwright + a chromium on disk)
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const TYPES = { '.html':'text/html', '.js':'application/javascript' };
const server = http.createServer((q,r) => {
  let f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f,'index.html');
  if (!fs.existsSync(f)) { r.writeHead(404); return r.end('no'); }
  r.writeHead(200, {'Content-Type':TYPES[path.extname(f)]||'application/octet-stream'});
  fs.createReadStream(f).pipe(r);
});
const P = { staffId:'sasha', name:'Sasha Lalla', email:'s@example.com', agentNumber:'S1', unit:'Support',
            grade:'Sales Support Assistant · G3', role:'ssa', tier:'support', tierLabel:'Sales Support',
            tierOrder:4, reportsTo:'kamla', manager:false };
const SCH = { sasha:{ start:'08:00', end:'16:00', lunch:'12:30-13:30',
  blocks:{ KPI1:{time:'8 – 10am',focus:'Premium Dues'}, KPI2:{time:'10 – 12pm',focus:'Billing Recon'},
           PM1:{time:'1 – 3pm',focus:'Adopt an Orphan'}, PM2:{time:'3 – 4pm',focus:'Task Mgmt'} } } };

let sent = 0, lastPayload = null, fails = 0;
const ok=(l,c,x='')=>{console.log((c?'  PASS  ':'  FAIL  ')+l+(x?'  '+x:''));if(!c)fails++;};

(async () => {
  await new Promise(r => server.listen(8795, r));
  const b = await chromium.launch({ executablePath: CHROME });
  const page = await b.newPage();
  await page.route('**/macros/s/**', async r => {
    const body = JSON.parse(r.request().postData()||'{}');
    const j = o => r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(o)});
    if (body.action==='login'||body.action==='me') return j({ok:true,token:'t',profile: Object.assign({}, P, { attendance: { first:false, at:'08:00', lastSeen:'08:00', status:'in', reason:'', late:0 } }),roster:[P],schedule:SCH,kpis:{}});
    if (body.action==='rows') return j({ok:true,rows:[]});
    if (body.action==='training') return j({ok:true,training:[]});
    if (body.action==='saveBlock') { sent++; lastPayload = body;
      return j({ok:true,block:body.block,at:'15:25',blocksDone:1,submitted:[body.block]}); }
    return j({ok:true});
  });

  await page.goto('http://localhost:8795/kpi/', { waitUntil:'networkidle' });
  const i = await page.$$('input');
  await i[0].fill('s@example.com'); await i[1].fill('1');
  await page.click('button:has-text("Sign in")');
  await page.waitForTimeout(1600);

  console.log('\nShe writes what she has been writing:\n');
  await page.locator('text=Afternoon 2').first().click();
  await page.waitForTimeout(400);
  let t = await page.locator('textarea:visible').all();
  await t[0].fill('Actioned remaining tasks');
  await t[1].fill('3 tasks');
  await page.waitForTimeout(300);

  await page.click('button:has-text("Submit block")');
  await page.waitForTimeout(900);
  ok('nothing was sent yet', sent === 0, sent + ' sent');
  ok('it says what is missing', await page.locator('text=/a count, but nothing named/').count() > 0);
  ok('and the button offers the way through',
     await page.locator('button:has-text("Send it anyway")').count() > 0);

  console.log('\nShe presses again — it goes, exactly as she wrote it:\n');
  await page.click('button:has-text("Send it anyway")');
  await page.waitForTimeout(2200);
  ok('it sent on the second press', sent === 1, sent + ' sent');
  ok('unchanged, word for word',
     lastPayload && lastPayload.data.actioned === 'Actioned remaining tasks' &&
     lastPayload.data.resolved === '3 tasks');
  ok('and she is told it landed', await page.locator('text=/Sent 15:25/').count() > 0);

  console.log('\nA real entry is never questioned at all:\n');
  sent = 0;
  await page.locator('text=KPI 1').first().click();
  await page.waitForTimeout(400);
  t = await page.locator('textarea:visible').all();
  await t[0].fill('Premium dues, 14 processed and 2 returned to the advisor');
  await t[1].fill('12 cleared, 2 back to the advisor');
  await page.waitForTimeout(300);
  await page.click('button:has-text("Submit block")');
  await page.waitForTimeout(2200);
  ok('it went straight through, no question', sent === 1, sent + ' sent');
  ok('no thin warning was shown', await page.locator('text=/reads thin/').count() === 0);

  await b.close(); server.close();
  console.log('\n' + (fails ? fails+' FAILED' : 'all green') + '\n');
  process.exit(fails?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
