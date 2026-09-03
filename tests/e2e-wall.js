// The wall, driven on a real screen.
//
// Ten slides now, and slide three is new: how the day is being written. The
// deck and the narration are indexed by the same number, so this also checks
// that inserting a card did not leave Andrew describing the wrong one.
//
// Run: node tests/e2e-wall.js   (needs playwright + a chromium on disk)
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const TYPES = { '.html':'text/html', '.js':'application/javascript', '.mp3':'audio/mpeg' };
const asked = new Set();
const server = http.createServer((q,r) => {
  const url = decodeURIComponent(q.url.split('?')[0]);
  if (url.endsWith('.mp3')) asked.add(path.basename(url));
  let f = path.join(ROOT, url);
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f,'index.html');
  if (!fs.existsSync(f)) { r.writeHead(404); return r.end('no'); }
  r.writeHead(200, {'Content-Type':TYPES[path.extname(f)]||'application/octet-stream'});
  fs.createReadStream(f).pipe(r);
});

const today = new Date().toISOString().slice(0,10);
const ROSTER = [
  { staffId:'sasha', name:'Sasha Lalla', tier:'support', tierLabel:'Sales Support', tierOrder:4, role:'ssa', manager:false },
  { staffId:'liz',   name:'Elizabeth Lee', tier:'bma', tierLabel:'Branch Manager’s Assistant', tierOrder:2, role:'bma', manager:false },
  { staffId:'ricky', name:'Ricky Rampersad', tier:'management', tierLabel:'Management', tierOrder:1, role:'bm', manager:true }
];
const SCHEDULE = {};
['sasha','liz','ricky'].forEach(id => SCHEDULE[id] = { start:'08:00', end:'16:00', lunch:'12:30-13:30',
  blocks:{ KPI1:{time:'8 – 10am',focus:'A'}, KPI2:{time:'10 – 12pm',focus:'B'},
           PM1:{time:'1 – 3pm',focus:'C'}, PM2:{time:'3 – 4pm',focus:'D'} } });

// One thin day, one full day, one untouched.
const ROWS = [
  { Date:today, StaffId:'sasha', Name:'Sasha Lalla',
    KPI1_Actioned:'Actioned remaining tasks', KPI1_Resolved:'3 tasks', KPI1_At:today+'T11:07:00',
    PM2_Actioned:'Head Office and Underwriting', PM2_Resolved:'', PM2_At:today+'T15:25:00' },
  { Date:today, StaffId:'liz', Name:'Elizabeth Lee',
    KPI1_Actioned:'Premium dues, 14 processed and 2 returned to the advisor',
    KPI1_Resolved:'12 cleared', KPI1_At:today+'T09:40:00' }
];

let fails = 0;
const ok=(l,c,x='')=>{console.log((c?'  PASS  ':'  FAIL  ')+l+(x?'  '+x:''));if(!c)fails++;};

(async () => {
  await new Promise(r => server.listen(8796, r));
  const b = await chromium.launch({ executablePath: CHROME });
  const page = await b.newPage({ viewport:{ width:1920, height:1080 } });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));

  await page.route('**/macros/s/**', async r => {
    const body = JSON.parse(r.request().postData()||'{}');
    const j = o => r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(o)});
    if (body.action==='login')
      return j({ok:true,token:'t',profile:ROSTER[2],roster:ROSTER,schedule:SCHEDULE});
    if (body.action==='rows')
      return j({ok:true,rows:ROWS,roster:ROSTER,schedule:SCHEDULE});
    return j({ok:true});
  });

  await page.goto('http://localhost:8796/wall/', { waitUntil:'networkidle' });
  const gi = await page.$$('#gate input');
  if (gi.length >= 2) { await gi[0].fill('ricky@example.com'); await gi[1].fill('1'); await page.click('#gGo'); }
  await page.waitForTimeout(2500);

  console.log('\nThe deck:\n');
  const n = await page.locator('.slide').count();
  ok('twelve slides', n === 12, n + ' slides');
  ok('twelve dots to match', await page.locator('#dotsNav i').count() === 12);

  console.log('\nSlide three — how the day is being written:\n');
  await page.evaluate(() => go(2));
  await page.waitForTimeout(700);
  const on = page.locator('.slide.on');
  ok('the new card is card 3', (await on.locator('.kick').innerText()).indexOf('3 ·') === 0,
     await on.locator('.kick').innerText());
  const head = await on.locator('h2').innerText();
  ok('it counts what stands up', /of\s+3\s+entries name a count or a case/.test(head), head);
  const body = await on.innerText();
  ok('Sasha is named', /Sasha Lalla/.test(body));
  ok('with the reason for each block',
     /a count, but nothing named/.test(body) && /a name, but nothing done with it/.test(body));
  ok('Elizabeth is not named — her entry stands up', !/Elizabeth/.test(body));

  console.log('\nThe voice still matches the card:\n');
  await page.evaluate(() => fetch('/wall/audio/s' + (cur+1) + '.mp3'));
  await page.waitForTimeout(600);
  ok('slide 3 asks for s3.mp3', asked.has('s3.mp3'), [...asked].join(', ') || 'none asked');
  ok('a twelfth narration file exists', fs.existsSync(path.join(ROOT,'wall','audio','s12.mp3')));

  console.log('\nAnd the rest of the deck still works:\n');
  await page.evaluate(() => go(11));
  await page.waitForTimeout(600);
  ok('the last card is 12', (await page.locator('.slide.on .kick').innerText()).indexOf('12 ·') === 0,
     await page.locator('.slide.on .kick').innerText());
  const flow = await page.locator('.slide.on').innerText();
  ok('it says the book is not a volume problem', /not<\/b>? a volume problem|not a volume problem/i.test(flow), flow.slice(0,50));
  ok('and keeps the robot out of it', /birthday mailer is excluded/i.test(flow));
  // The sign has to be the right way round: closing more than arrived means
  // the book shrank. It shipped backwards once.
  ok('closing more than arrived reads as the book shrinking',
     /Sasha[\s\S]{0,120}the book shrank/i.test(flow), flow.replace(/\n/g,' | ').slice(0,150));
  ok('and taking in more than went out reads as growth',
     /Ricky[\s\S]{0,140}the book grew/i.test(flow));
  await page.evaluate(() => go(10));
  await page.waitForTimeout(600);
  const eod = await page.locator('.slide.on').innerText();
  ok('it separates never-started from late', /Never started/i.test(eod), eod.slice(0,60));
  ok('the staffing matter is not named on the wall',
     !/salary/i.test(eod) && /named privately/i.test(eod));
  // The mask has to hold in the source too. The first version of this card
  // masked the row and then explained what it was in a comment, in a file
  // that is served publicly from a public repository.
  const src = fs.readFileSync(path.join(ROOT,'wall','index.html'),'utf8');
  ok('and not described anywhere in the served file', !/salary/i.test(src));
  const real = errs.filter(e => !/favicon|Failed to load/i.test(e));
  ok('no javascript errors', real.length === 0, real.slice(0,2).join(' | '));

  await page.evaluate(() => go(2));
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(require('os').tmpdir(), 'wall-card3.png') });
  console.log('\n  screenshot: ' + path.join(require('os').tmpdir(), 'wall-card3.png'));

  await b.close(); server.close();
  console.log('\n' + (fails ? fails+' FAILED' : 'all green') + '\n');
  process.exit(fails?1:0);
})().catch(e=>{console.error(e);process.exit(1);});
