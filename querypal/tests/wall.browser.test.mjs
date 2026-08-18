/* The rotating TV wall in Chromium: gate, remembered sign-in, seven boards,
   rotation, and the data rendering. */
import { createRequire } from 'module';
import path from 'path';
const { chromium } = createRequire(import.meta.url)('/opt/node22/lib/node_modules/playwright');
const HERE = path.dirname(new URL(import.meta.url).pathname);
const WALL = 'file://' + path.join(HERE, '..', 'wall.html');

const feed = { ok:true, role:'branch', name:'Ricky Rampersad', days:0, generated:'x',
  totals:{ total:214, open:21, done:193, overdue:4, chased:58, onTime:84, avg:3.9, csat:4.5, rated:96 },
  weeks:[9,12,11,15,13,17,14,16,12,19,17,14], age:{ ok:13, soon:4, late:4 },
  scoreDist:{1:2,2:4,3:9,4:30,5:51},
  notes:[{score:5,text:'Sorted the same day'},{score:4,text:'Kept me informed'}],
  depts:[ {name:'Health Claims TT',n:26,done:24,late:0,chased:6,onTime:95,avg:2.6,csat:4.8},
          {name:'Customer Service – Chaguanas',n:84,done:79,late:1,chased:14,onTime:90,avg:3.1,csat:4.6},
          {name:'GLOC Premium Query',n:46,done:41,late:1,chased:12,onTime:78,avg:4.6,csat:4.3} ],
  agents:[ {name:'Aidan Eugene',n:52,done:49,late:0,chased:6,onTime:94,avg:3.0,csat:4.7},
           {name:'Crystal Fraser',n:44,done:40,late:2,chased:15,onTime:81,avg:4.4,csat:4.4} ],
  types:[ {name:'Bounce Cheque',n:38}, {name:'Surrenders',n:29}, {name:'Statements – tax and csv',n:24} ] };

const browser = await chromium.launch();
const page = await browser.newPage({ viewport:{ width:1280, height:800 } });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
let wallCalls = 0;
await page.route('**/macros/s/**', route => {
  const req = route.request();
  const ok = b => route.fulfill({ status:200, contentType:'application/json', body: JSON.stringify(b) });
  if (req.method() === 'POST') return ok({ ok:true, token:'TOK1', code:'260026', name:'Ricky Rampersad', role:'branch' });
  wallCalls++; return ok(feed);
});

let pass=0, fail=0;
const t=(l,got,want)=>{const ok=JSON.stringify(got)===JSON.stringify(want);
  console.log((ok?'  PASS  ':'  FAIL  ')+l+(ok?'':`\n          got  ${JSON.stringify(got)}\n          want ${JSON.stringify(want)}`)); ok?pass++:fail++;};

await page.goto(WALL);
t('gate shows on a fresh screen', await page.locator('#gate:not(.off)').count(), 1);
await page.fill('#gNum','260026'); await page.fill('#gPwd','pw');
await page.click('#gGo');
await page.waitForSelector('#gate.off', { state:'attached', timeout:5000 });
await page.waitForFunction(() => document.getElementById('v_total').textContent !== '—', null, { timeout:5000 });

t('seven boards exist', await page.locator('main .panel').count(), 7);
t('first board is showing', await page.locator('#p0.on').count(), 1);
t('headline open count', await page.locator('#h_open').innerText(), '21');
t('on-time headline in the title', (await page.locator('#t_p0').innerText()).includes('84%'), true);
t('rating tile', await page.locator('#v_csat').innerText(), '★4.5');
t('auto follow-ups tile', await page.locator('#v_chased').innerText(), '58');

// rotation: click advances
await page.locator('header').click();
t('click advances to demand board', await page.locator('#p1.on').count(), 1);
t('twelve week columns', await page.locator('#chart .col').count(), 12);
t('trend line present', (await page.locator('#c_trend').innerText()).match(/up|down/i) !== null, true);  // h2 CSS uppercases it

await page.locator('header').click();
t('ageing board', await page.locator('#p2.on').count(), 1);
t('overdue hero', await page.locator('#h_late').innerText(), '4');

await page.locator('header').click();
t('departments ranked by on-time, best first',
  await page.locator('#depts .who').first().innerText().then(s=>s.split('\n')[0]), 'Health Claims TT');
t('gold rank on first row', await page.locator('#depts .prow.r1').count(), 1);
t('dynamic dept title', (await page.locator('#t_p3').innerText()).includes('Health Claims TT'), true);

await page.locator('header').click();
t('leading agent named in the title', (await page.locator('#t_p4').innerText()).includes('Aidan Eugene'), true);

await page.locator('header').click();
t('mix board shows Statements', (await page.locator('#types').innerText()).includes('Statements – tax and csv'), true);

await page.locator('header').click();
t('csat hero', await page.locator('#h_csat').innerText(), '★4.5');
t('five star rows', await page.locator('#stars .srow').count(), 5);
t('quotes render', await page.locator('#quotes .rec').count(), 2);

await page.locator('header').click();
t('rotation wraps back to the pulse', await page.locator('#p0.on').count(), 1);

// remembered sign-in: reload skips the gate
await page.reload();
await page.waitForFunction(() => document.getElementById('v_total').textContent !== '—', null, { timeout:5000 });
t('reload skips the gate (device remembered)', await page.locator('#gate.off').count(), 1);

// ?code= boot path
await page.evaluate(() => localStorage.removeItem('qpwall'));
await page.goto(WALL + '?code=RRB2026');
await page.waitForFunction(() => document.getElementById('v_total').textContent !== '—', null, { timeout:5000 });
t('?code= boots straight to the wall', await page.locator('#gate.off').count(), 1);
t('the code is stripped from the address bar', page.url().includes('code='), false);

t('no page errors', errors, []);
await page.screenshot({ path: path.join(HERE,'wall-tv.png') });
await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
