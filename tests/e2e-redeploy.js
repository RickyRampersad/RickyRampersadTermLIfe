// The page Kamla uses, and the four answers it can give.
//
// The point of this page is that whoever does the deployment finds out
// themselves whether it worked, instead of messaging somebody and waiting.
// So the four outcomes have to be right, and the wrong-turn case — "New
// deployment" instead of "New version" — has to say so in words rather than
// leave them staring at a green tick that means nothing.
//
// Run: node tests/e2e-redeploy.js   (needs playwright + a chromium on disk)
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const srv = http.createServer((q,r)=>{
  let f = path.join(ROOT, decodeURIComponent(q.url.split('?')[0]));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f,'index.html');
  if (!fs.existsSync(f)) { r.writeHead(404); return r.end('no'); }
  r.writeHead(200,{'Content-Type':'text/html'});
  fs.createReadStream(f).pipe(r);
});

// The expected version is read out of the page itself, so bumping
// SCRIPT_VERSION never leaves this test asserting a stale string.
const WANT = (fs.readFileSync(path.join(ROOT,'redeploy','index.html'),'utf8')
  .match(/const WANT="([^"]+)"/) || [])[1];
if (!WANT) { console.log('  FAIL  could not read WANT from the page'); process.exit(1); }
let mode = 'old', fails = 0;
const ok=(l,c,x='')=>{console.log((c?'  PASS  ':'  FAIL  ')+l+(x?'  '+x:''));if(!c)fails++;};

(async () => {
  await new Promise(r => srv.listen(8799, r));
  const b = await chromium.launch({ executablePath: CHROME });
  const page = await b.newPage({ viewport:{width:760,height:1000} });
  const errs=[]; page.on('pageerror',e=>errs.push(String(e)));

  await page.route('**/macros/s/**', async r => {
    if (mode === 'dead') return r.abort();
    const body = { ok:true, today:'2026-09-03' };
    if (mode === 'new')  body.version = WANT;
    if (mode === 'other') body.version = '2026-08-30';
    return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(body)});
  });

  const run = async () => { await page.click('#go'); await page.waitForTimeout(1200);
                            return (await page.locator('#out').innerText()); };

  await page.goto('http://localhost:8799/redeploy/', { waitUntil:'networkidle' });

  console.log('\nShe has not done it yet — the old script answers:\n');
  mode='old';
  let t = await run();
  ok('it says not done', /Not done yet/.test(t), t.split('\n')[0]);
  ok('and names the likely wrong turn', /New deployment/.test(t) && /New version/.test(t));

  console.log('\nShe used "New deployment" by mistake — same answer, on purpose:\n');
  ok('the wrong turn is spelled out, not implied',
     /Manage deployments/.test(t) && /edit the/.test(t));

  console.log('\nShe did it properly:\n');
  mode='new';
  t = await run();
  ok('it says done', /Done — the new script is live/.test(t), t.split('\n')[0]);
  ok('it names the version', t.indexOf(WANT) > -1, WANT);
  ok('and reports the speed', /Timed at/.test(t) && /average/.test(t));

  console.log('\nShe copied an older file:\n');
  mode='other';
  t = await run();
  ok('it says the versions do not match', /A different version is live/.test(t), t.split('\n')[0]);
  ok('and shows both numbers', /2026-08-30/.test(t) && t.indexOf(WANT) > -1);

  console.log('\nThe workbook cannot be reached:\n');
  mode='dead';
  t = await run();
  ok('it says so plainly', /Could not reach the workbook/.test(t), t.split('\n')[0]);
  ok('and points at the Access setting', /Anyone/.test(t));

  ok('no javascript errors', errs.filter(e=>!/favicon/i.test(e)).length === 0);
  ok('the button invites a retry', (await page.locator('#go').innerText()).indexOf('again') > -1);

  await b.close(); srv.close();
  console.log('\n' + (fails ? fails+' FAILED' : 'all green') + '\n');
  process.exit(fails?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
