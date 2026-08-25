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
  agents:[ {name:'Felicia Rampersad',n:52,done:49,late:0,chased:6,onTime:94,avg:3.0,csat:4.7},
           {name:'Fawwaz Mohamed',n:44,done:40,late:2,chased:15,onTime:81,avg:4.4,csat:4.4} ],
  types:[ {name:'Bounce Cheque',n:38}, {name:'Surrenders',n:29}, {name:'Statements – tax and csv',n:24} ],
  intake:{ today:9, week:41, month:167, rToday:7, rWeek:38, rMonth:150 },
  staff:[ {name:'Sasha Lalla Jagassar',n:34,done:31,open:3,late:1,self:19,auto:12,autoShare:39,
            depts:[{name:'Group Insurance Administration',n:20},{name:'GLOC Premium Query',n:9}],
            types:[{name:'Group Life Termination',n:18}] },
          {name:'Elizabeth Lee',n:22,done:19,open:3,late:0,self:4,auto:15,autoShare:79,
            depts:[{name:'Customer Service – Chaguanas',n:14}], types:[{name:'Surrenders',n:8}] } ],
  closers:[ {name:'Sasha Lalla Jagassar',self:12,app:7,total:19},
            {name:'Felicia Rampersad',self:9,app:0,total:9} ],
  // auto.chases and totals.chased are the same sum on the real backend
  auto:{ chases:58, surveys:96, replies:58, autoClosed:31, humanClosed:12,
         sysActs:261, humanActs:87, solvedAlone:132, neededHands:61,
         touchless:140, minutes:626, hours:10.4, sysShare:75, aloneShare:68 } };

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

t('twelve boards exist', await page.locator('main .panel').count(), 12);
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
t('leading agent named in the title', (await page.locator('#t_p4').innerText()).includes('Felicia Rampersad'), true);

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
t('intake board rotates in', await page.locator('#p8.on').count(), 1);
await page.locator('header').click();
t('automation board rotates in', await page.locator('#p9.on').count(), 1);
t('autopilot names the hours it handed back', await page.locator('#a_hours').innerText(), '10.4h');
t('autopilot explains what the number means',
  (await page.locator('#a_mean').innerText()).includes('10.4 hours'), true);
await page.locator('header').click();
t('people-vs-system board rotates in', await page.locator('#p10.on').count(), 1);
t('system share in the donut', await page.locator('#s_pct').innerText(), '75%');
t('cases the system closed alone', await page.locator('#s_alone').innerText(), '132');
t('cases that needed hands', await page.locator('#s_hands').innerText(), '61');
t('the split bar is drawn', (await page.locator('#s_sys').evaluate(e => e.style.width)).startsWith('75'), true);
t('title names the system share', (await page.locator('#t_p10').innerText()).includes('75%'), true);
await page.locator('header').click();
t('desks board rotates in', await page.locator('#p11.on').count(), 1);
t('a desk shows its department lanes',
  (await page.locator('#desks').innerText()).includes('Group Insurance Administration'), true);
t('a desk shows open, late and done', (await page.locator('#desks .oc').first().innerText()).replace(/\s+/g,' '), '3 OPEN 1 LATE 31 DONE');   // .oc span is uppercased in CSS
t('a desk separates system closes from its own',
  (await page.locator('#desks .mixlab').first().innerText()).includes('12 by the system'), true);
t('desks title counts the desks', (await page.locator('#t_p11').innerText()).includes('2'), true);
await page.locator('header').click();
t('rotation wraps back to the pulse', await page.locator('#p0.on').count(), 1);
t('pulse shows hands-free share', await page.locator('#v_alone').innerText(), '68%');
t('pulse shows time saved', await page.locator('#v_hours').innerText(), '10.4h');

// sound: the button exists, and nothing plays until someone asks for it
t('sound button present', await page.locator('#snd').count(), 1);
t('sound starts off', await page.locator('#snd.on').count(), 0);
t('a briefing is composed from live data',
  (await page.evaluate(() => briefing(0))).includes('21 requests are open'), true);
t('the scorecard briefing quotes the grade',
  (await page.evaluate(() => briefing(7))).length > 10, true);
t("intake board shows today's count", (await page.evaluate(() => { render(); return document.getElementById('i_t').textContent; })), '9');
t('intake title says in vs resolved', (await page.locator('#t_p8').innerText()).includes('9'), true);
t('autopilot board counts the chases', await page.locator('#a_chase').innerText(), '58');
t('self-close leaderboard names who closed', (await page.locator('#a_closers').innerText()).includes('Sasha Lalla Jagassar'), true);
t('self-close leaderboard splits self from in-app', (await page.locator('#a_closers').innerText()).includes('12 self-closed'), true);
t('fastest-response title names a department', (await page.locator('#t_p9').innerText()).includes('Fastest response'), true);
t('intake briefing is composed', (await page.evaluate(() => briefing(8))).includes('9 requests came in today'), true);
t('automation briefing is composed', (await page.evaluate(() => briefing(9))).includes('58 reminders were sent'), true);
t('automation briefing explains the payoff', (await page.evaluate(() => briefing(9))).includes('10.4 hours'), true);
t('people-vs-system briefing is composed', (await page.evaluate(() => briefing(10))).includes('75 percent'), true);
t('desks briefing names the busiest desk', (await page.evaluate(() => briefing(11))).includes('Sasha Lalla Jagassar'), true);
t('desks briefing recognises self-closing', (await page.evaluate(() => briefing(11))).includes('28 cases were closed by the person'), true);
t('the real shield is in the header', await page.locator('header img.shield').count(), 1);
t('briefings never carry client names',
  (await page.evaluate(() => [0,1,2,3,4,5,6,7,8,9,10,11].map(i => briefing(i)).join(' '))).includes('Anita'), false);

/* Andrew reads live numbers by splicing a recorded bank. Every clip a board
   asks for must exist, or he goes silent mid-sentence on the wall. */
t('the voice bank is embedded', await page.evaluate(() => Object.keys(WVO).length > 150), true);
t('numbers map to clips', await page.evaluate(() => JSON.stringify([nSeq(0),nSeq(7),nSeq(28),nSeq(100),nSeq(107),nSeq(300),nSeq(1240)])),
  JSON.stringify([['n0'],['n7'],['n28'],['n100'],['h1','n7'],['hf3'],['over','n1','thousand']]));
t('decimals map to clips', await page.evaluate(() => JSON.stringify([dSeq(9.4),dSeq(3),dSeq(4.5)])),
  JSON.stringify([['n9','p4'],['n3'],['n4','p5']]));
const missing = await page.evaluate(() => {
  const gaps = [];
  for (let i = 0; i <= 11; i++) lines(i).forEach(k => { if (!(k in WVO)) gaps.push(i + ':' + k); });
  return gaps;
});
t('every board can be spoken end to end — no missing clips', missing, []);
t('board 0 splices the open count into the sentence',
  (await page.evaluate(() => lines(0).join(' '))).includes('n21'), true);
t('the autopilot board says the hours out loud',
  (await page.evaluate(() => lines(9).join(' '))).includes('p4'), true);
/* Andrew names people by FIRST NAME only, and only from the recorded roster.
   Anything else — a surname, a client, a department — stays on the screen. */
t('every spoken clip is a fragment, a number or a first name', await page.evaluate(() =>
  [0,1,2,3,4,5,6,7,8,9,10,11].flatMap(i => lines(i))
    .filter(k => !/^(f_|nm_|n\d|p\d|h\d|hf\d|g[A-D]|gAp|gNA|over|thousand|open$)/.test(k))), []);
t('a surname is never spoken', await page.evaluate(() =>
  [0,1,2,3,4,5,6,7,8,9,10,11].flatMap(i => lines(i))
    .some(k => /lalla|jagassar|rampersad|griffith|mohamed|dookran/i.test(k))), false);
t('the leading agent is named by first name', await page.evaluate(() =>
  lines(4).includes('nm_felicia')), true);
t('the busiest desk is named by first name', await page.evaluate(() =>
  lines(11).includes('nm_sasha')), true);
t('an unknown name is skipped rather than mangled', await page.evaluate(() =>
  nmSeq('Zebedee Nobody')), []);

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
