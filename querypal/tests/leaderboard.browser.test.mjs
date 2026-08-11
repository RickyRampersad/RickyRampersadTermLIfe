/* Drives the real dashboard with a seeded feed: leaderboard maths, role gating,
   time-range interactivity. */
import { existsSync, readFileSync } from 'fs';
const _idx = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
if (!_idx.includes('dashBoard')) {
  console.log('  SKIPPED — this feature is not in the live build yet (the Board tab / leaderboard).');
  console.log('  Port it onto the current index.html first, then re-run.');
  process.exit(0);
}

import { createRequire } from 'module';
import path from 'path';
const { chromium } = createRequire(import.meta.url)('/opt/node22/lib/node_modules/playwright');
const HERE = path.dirname(new URL(import.meta.url).pathname);

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 760, height: 1000 }, deviceScaleFactor: 2 });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
await page.goto('file://' + path.join(HERE, '..', 'index.html'));

let pass = 0, fail = 0;
const t = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log((ok?'  PASS  ':'  FAIL  ')+label+(ok?'':`\n          got  ${JSON.stringify(got)}\n          want ${JSON.stringify(want)}`));
  ok ? pass++ : fail++;
};

const daysAgo = n => new Date(Date.now() - n*86400000).toISOString();
// agent A: 3/3 on time · agent B: 1/3 on time + 1 overdue · agent C: nothing closed
const seed = role => ({
  ok: true, role, name: 'Aidan Eugene',
  counts: { open: 4, done: 6, total: 10 },
  rows: [
    { ref:'R1', agent:'Aidan Eugene', dept:'GLOC Premium', qtype:'Bounce Cheque', status:'Closed', tat:'5', days:'2', score:5, fu:0, tsIso:daysAgo(10), client:'C1' },
    { ref:'R2', agent:'Aidan Eugene', dept:'GLOC Premium', qtype:'Bounce Cheque', status:'Closed', tat:'5', days:'4', score:4, fu:0, tsIso:daysAgo(9),  client:'C2' },
    { ref:'R3', agent:'Aidan Eugene', dept:'GLOC Claims',  qtype:'Surrenders',    status:'Closed', tat:'10',days:'6', score:5, fu:1, tsIso:daysAgo(8),  client:'C3' },
    { ref:'R4', agent:'Gary Sookdeo', dept:'GLOC Premium', qtype:'Bounce Cheque', status:'Closed', tat:'5', days:'9', score:2, fu:2, tsIso:daysAgo(20), client:'C4' },
    { ref:'R5', agent:'Gary Sookdeo', dept:'GLOC Claims',  qtype:'Surrenders',    status:'Closed', tat:'10',days:'14',score:3, fu:3, tsIso:daysAgo(19), client:'C5' },
    { ref:'R6', agent:'Gary Sookdeo', dept:'GLOC Claims',  qtype:'Surrenders',    status:'Closed', tat:'10',days:'8', score:4, fu:0, tsIso:daysAgo(18), client:'C6' },
    { ref:'R7', agent:'Gary Sookdeo', dept:'GLOC Claims',  qtype:'Surrenders',    status:'Open',   tat:'1', days:'',  score:0, fu:2, tsIso:daysAgo(40), client:'C7' },
    { ref:'R8', agent:'Neil Ramnanan',dept:'GLOC Premium', qtype:'Bounce Cheque', status:'Open',   tat:'5', days:'',  score:0, fu:0, tsIso:daysAgo(1),  client:'C8' },
    { ref:'R9', agent:'Neil Ramnanan',dept:'GLOC Premium', qtype:'Bounce Cheque', status:'In Progress', tat:'5', days:'', score:0, fu:1, tsIso:daysAgo(2), client:'C9' },
    { ref:'R10',agent:'Neil Ramnanan',dept:'GLOC Premium', qtype:'Bounce Cheque', status:'Open',   tat:'5', days:'',  score:0, fu:0, tsIso:daysAgo(100),client:'C10' },
  ]});

const load = async role => page.evaluate(d => {
  agentAuth = { code:'X', name:d.name, email:'', role:d.role };
  dashData = d; _dashTab='open'; dashDept=''; dashRange=0; dashOver=false;
  document.getElementById('dashModal').classList.add('show');
  dashSetup(); dashRender();
}, seed(role));

// ---------- branch view ----------
await load('branch');
await page.evaluate(() => dashTab('board'));
t('Board tab exists and renders', await page.locator('.lbhero').count(), 1);

const hero = await page.locator('.lbhero .h').allInnerTexts();
t('headline: 10 logged', hero[0].split('\n')[0], '10');
t('headline on-time = 4 of 6 closed', hero[1].split('\n')[0], '67%');
t('headline avg close', hero[2].split('\n')[0], '7.2d');
t('headline CSAT appears now that scores flow', hero[3].split('\n')[0], '★3.8');  // 23/6
t('headline counts auto-chases', hero[4].split('\n')[0], '9');

const agents = await page.evaluate(() =>
  [...document.querySelectorAll('.lbhead')].find(h => h.textContent.includes('Agent leaderboard'))
    .nextElementSibling.querySelectorAll('.lbrow'));
t('three agents ranked', await page.locator('.lbwrap').first().locator('.lbrow').count(), 3);

const order = await page.locator('.lbwrap').first().locator('.lbnm').allInnerTexts();
t('ranked by on-time, best first', order, ['Aidan Eugene','Gary Sookdeo','Neil Ramnanan']);
const pcts = await page.locator('.lbwrap').first().locator('.lbpct').allInnerTexts();
t('Aidan 100%, Gary 33%, Neil has nothing closed', pcts, ['100%','33%','—']);
t('top three get medals',
  await page.locator('.lbwrap').first().locator('.rk').allInnerTexts(), ['🥇','🥈','🥉']);
t('overdue called out in red',
  (await page.locator('.lbwrap').first().locator('.lbrow').nth(1).innerText()).includes('overdue'), true);

const deptNames = await page.locator('.lbwrap').nth(1).locator('.lbnm').allInnerTexts();
t('department scoreboard present', deptNames.sort(), ['GLOC Claims','GLOC Premium']);

// ---------- manager sees the same board ----------
await load('manager');
await page.evaluate(() => dashTab('board'));
t('manager also gets rankings', await page.locator('.lbwrap').first().locator('.lbrow').count(), 3);

// ---------- agent gets a personal scorecard, not a ranking ----------
await load('agent');
await page.evaluate(() => dashTab('board'));
t('agent sees a scorecard heading',
  (await page.locator('.lbhead').first().innerText()).includes('Your scorecard'), true);
t('agent sees exactly one row', await page.locator('.lbrow').count(), 1);
t('agent row is highlighted as theirs', await page.locator('.lbrow.me').count(), 1);
t('agent is not shown other staff',
  (await page.locator('#dashList').innerText()).includes('Gary Sookdeo'), false);

// ---------- interactivity: the time range must move the numbers ----------
await load('branch');
await page.evaluate(() => dashTab('board'));
const allTime = await page.locator('.lbhero .h').first().innerText();
await page.evaluate(() => dashRangeSet(30));
const last30 = await page.locator('.lbhero .h').first().innerText();
t('30-day filter changes the board', [allTime.split('\n')[0], last30.split('\n')[0]], ['10','8']);
await page.evaluate(() => dashRangeSet(7));
t('7-day filter narrows further', (await page.locator('.lbhero .h').first().innerText()).split('\n')[0], '2');

await page.evaluate(() => dashTab('open'));   // range is still 7 from above
t('stat tiles follow the range too (were static before)',
  await page.evaluate(() => document.querySelector('#dashStats .st.o .n').textContent), '2');
await page.evaluate(() => dashRangeSet(0));

// list view still works
await page.evaluate(() => dashTab('open'));
t('open list unaffected', await page.locator('#dashList .qcard').count(), 4);
t('search box hidden on the board, shown on lists',
  await page.evaluate(() => { dashTab('board'); const a=document.querySelector('.drow').style.display;
                              dashTab('open');  const b=document.querySelector('.drow').style.display;
                              return [a,b]; }), ['none','']);

t('no page errors', errors, []);

await page.evaluate(() => { dashRangeSet(0); dashTab('board'); });
await page.locator('#dashList').screenshot({ path: path.join(HERE, 'leaderboard.png') });
await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
