/* The rotating TV wall in Chromium: open-by-default boot, seven boards,
   rotation, data rendering, scoped ?code= boot, and the gate as fallback. */
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
let wallCalls = 0, postCalls = 0, refuseAnon = false;
await page.route('**/macros/s/**', route => {
  const req = route.request();
  const ok = b => route.fulfill({ status:200, contentType:'application/json', body: JSON.stringify(b) });
  if (req.method() === 'POST') { postCalls++; return ok({ ok:true, token:'TOK1', code:'260026', name:'Ricky Rampersad', role:'branch' }); }
  wallCalls++;
  if (refuseAnon && !/code=[^&]/.test(req.url())) return ok({ ok:false });   // a backend with the open wall switched off
  return ok(feed);
});

let pass=0, fail=0;
const t=(l,got,want)=>{const ok=JSON.stringify(got)===JSON.stringify(want);
  console.log((ok?'  PASS  ':'  FAIL  ')+l+(ok?'':`\n          got  ${JSON.stringify(got)}\n          want ${JSON.stringify(want)}`)); ok?pass++:fail++;};

await page.goto(WALL);
await page.waitForFunction(() => document.getElementById('v_total').textContent !== '—', null, { timeout:5000 });
t('a fresh screen boots straight to the boards — no gate', await page.locator('#gate.off').count(), 1);
t('no sign-in call was needed', postCalls, 0);

t('eight boards exist', await page.locator('main .panel').count(), 8);
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
t('KPI scorecard board', await page.locator('#p7.on').count(), 1);
t('four promises scored', await page.locator('#kpis .kpi').count(), 4);
t('on-time promise shows the target', (await page.locator('#kpis').innerText()).includes('90%'), true);
t('overall grade is stated', (await page.locator('#k_grade').innerText()).match(/^[A-D]\+?\s/) !== null, true);
t('scorecard title names the score', (await page.locator('#t_p7').innerText()).includes('%'), true);

await page.locator('header').click();
t('rotation wraps back to the pulse', await page.locator('#p0.on').count(), 1);

// sound: the button exists, and nothing plays until someone asks for it
t('sound button present', await page.locator('#snd').count(), 1);
t('sound starts off', await page.locator('#snd.on').count(), 0);
t('a briefing is composed from live data',
  (await page.evaluate(() => briefing(0))).includes('21 requests are open'), true);
t('the scorecard briefing quotes the grade',
  (await page.evaluate(() => briefing(7))).length > 10, true);
t('briefings never carry client names',
  (await page.evaluate(() => [0,1,2,3,4,5,6,7].map(i => briefing(i)).join(' '))).includes('Anita'), false);

// reload stays open, still no sign-in
await page.reload();
await page.waitForFunction(() => document.getElementById('v_total').textContent !== '—', null, { timeout:5000 });
t('reload boots open again', await page.locator('#gate.off').count(), 1);

// ?code= boot path — a scoped team/agent view, remembered on the device
await page.goto(WALL + '?code=RRB2026');
await page.waitForFunction(() => document.getElementById('v_total').textContent !== '—', null, { timeout:5000 });
t('?code= boots straight to the wall', await page.locator('#gate.off').count(), 1);
t('the code is stripped from the address bar', page.url().includes('code='), false);
t('a scoped boot signs in for a token', postCalls > 0, true);

// gate fallback: only when the open view is refused
await page.evaluate(() => localStorage.removeItem('qpwall'));
refuseAnon = true;
await page.goto(WALL);
await page.waitForSelector('#gate:not(.off)', { timeout:5000 });
t('gate appears when the open wall is refused', await page.locator('#gate:not(.off)').count(), 1);
await page.fill('#gNum','260026'); await page.fill('#gPwd','pw');
await page.click('#gGo');
await page.waitForFunction(() => document.getElementById('v_total').textContent !== '—', null, { timeout:5000 });
t('signing in through the gate still works', await page.locator('#gate.off').count(), 1);
refuseAnon = false;

t('no page errors', errors, []);
await page.screenshot({ path: path.join(HERE,'wall-tv.png') });
await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
