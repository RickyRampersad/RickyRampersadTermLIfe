/* Drives wall.html with the webhook intercepted: sign-in gate, all seven
   panels, range switching and the agent-role restriction. */
import { createRequire } from 'module';
import path from 'path';
const { chromium } = createRequire(import.meta.url)('/opt/node22/lib/node_modules/playwright');
const HERE = path.dirname(new URL(import.meta.url).pathname);
const WALL = 'file://' + path.join(HERE, '..', 'wall.html');

const feed = (role='branch') => ({
  ok:true, role, name:'Aidan Eugene', days:0, generated:'11 Aug 2026 · 9:14 AM',
  totals:{ total:142, open:18, done:124, overdue:5, chased:37, onTime:81, avg:4.3, csat:4.4, rated:63 },
  weeks:[6,9,7,11,8,14,10,12,9,15,13,11],
  age:{ ok:9, soon:4, late:5 },
  scoreDist:{1:2,2:3,3:6,4:19,5:33},
  notes:[{score:5,text:'Sorted the same day, excellent'},{score:2,text:'Had to chase twice'}],
  depts:[ {name:'Customer Service – Chaguanas',n:58,done:54,late:1,chased:9,onTime:88,avg:3.4,csat:4.5},
          {name:'GLOC Premium Query',n:34,done:30,late:2,chased:12,onTime:71,avg:5.1,csat:4.1},
          {name:'GLOC Claims',n:29,done:24,late:2,chased:11,onTime:58,avg:8.2,csat:3.7},
          {name:'Health Claims TT',n:21,done:16,late:0,chased:5,onTime:94,avg:2.8,csat:4.8} ],
  agents:[ {name:'Aidan Eugene',n:41,done:38,late:0,chased:4,onTime:95,avg:3.1,csat:4.7},
           {name:'Gary Sookdeo',n:36,done:31,late:3,chased:14,onTime:68,avg:6.2,csat:4.0},
           {name:'Neil Ramnanan',n:28,done:25,late:2,chased:9,onTime:52,avg:7.4,csat:3.6} ],
  types:[ {name:'Bounce Cheque',n:38}, {name:'Surrenders',n:27}, {name:'Change of Address',n:19},
          {name:'Embassy letters',n:14}, {name:'Missing Premiums',n:11} ]
});

const boot = async (page, role='branch', data=null) => {
  await page.route('**/macros/s/**', route => {
    const r = route.request();
    if (r.method() === 'POST')
      return route.fulfill({ status:200, contentType:'application/json',
        body: JSON.stringify({ ok:true, token:'TOK1', code:'AE101', name:'Aidan Eugene', role }) });
    const url = new URL(r.url());
    const days = +(url.searchParams.get('days') || 0);
    const d = data || feed(role);
    return route.fulfill({ status:200, contentType:'application/json',
      body: JSON.stringify({ ...d, days, totals: days ? { ...d.totals, total: 40 } : d.totals }) });
  });
  await page.goto(WALL);
  await page.fill('#gNum','AE101'); await page.fill('#gPwd','pw');
  await page.click('#gGo');
  await page.waitForSelector('.panel', { timeout: 5000 });
};

const browser = await chromium.launch();
let pass=0, fail=0;
const t=(label,got,want)=>{const ok=JSON.stringify(got)===JSON.stringify(want);
  console.log((ok?'  PASS  ':'  FAIL  ')+label+(ok?'':`\n          got  ${JSON.stringify(got)}\n          want ${JSON.stringify(want)}`));
  ok?pass++:fail++;};

const page = await browser.newPage({ viewport:{width:1600,height:1000} });
const errors=[]; page.on('pageerror',e=>errors.push(String(e)));

// gate first
await page.goto(WALL);
t('wall is gated behind sign-in', await page.locator('#wall').isVisible(), false);
t('gate is shown', await page.locator('#gate').isVisible(), true);

await boot(page,'branch');
t('gate hidden after sign-in', await page.locator('#gate').isVisible(), false);
t('seven panels rendered', await page.locator('.panel').count(), 7);

const heads = await page.locator('.panel h2').allInnerTexts();
t('panel titles', heads, ['Branch pulse','Request volume','Open work right now',
  'Department performance','Agent leaderboard','What clients ask for','Client satisfaction']);

// 1 pulse
const kpis = await page.locator('.kpi').allInnerTexts();
t('pulse shows seven measures', kpis.length, 7);
t('total logged', kpis[0].split('\n')[0], '142');
t('on-time percentage', kpis[3].split('\n')[0], '81%');
t('overdue flagged red', await page.locator('.kpi.bad').count() >= 1, true);
t('rating shown with count', kpis[5].includes('★4.4') && kpis[5].includes('63 rated'), true);

// 2 trend
t('twelve weekly bars', await page.locator('.bars .b').count(), 12);
t('current week highlighted', await page.locator('.bars .b.now').count(), 1);
t('trend direction stated',
  (await page.locator('.p-trend .cap').innerText()).match(/Up|Down|Level/) !== null, true);

// 3 ageing
const ageVals = await page.locator('.agerow .val').allInnerTexts();
t('ageing buckets', ageVals, ['9','4','5']);
t('overdue explained',
  (await page.locator('.agenote').innerText()).includes('chased automatically'), true);

// 4 departments
t('departments listed', await page.locator('.p-dept .rank').count(), 4);
t('departments really are ranked by on-time, best first',
  (await page.locator('.p-dept .pc').allInnerTexts()), ['94%','88%','71%','58%']);
t('bars have measurable height (percentage heights resolve)',
  await page.evaluate(() => [...document.querySelectorAll('.bars .b i')]
    .map(i => i.getBoundingClientRect().height).filter(h => h > 10).length >= 10), true);
t('top three get rank medals', await page.locator('.p-dept .rank.t1, .p-dept .rank.t2, .p-dept .rank.t3').count(), 3);

// 5 agents
t('agents listed', await page.locator('.p-agent .rank').count(), 3);
t('best agent first',
  (await page.locator('.p-agent .rank b').first().innerText()), 'Aidan Eugene');

// 6 mix
t('request types listed', await page.locator('.mixrow').count(), 5);
t('headline insight names the top request',
  (await page.locator('.p-mix .cap').innerText()).includes('Bounce Cheque'), true);

// 7 satisfaction
t('average rating shown big',
  (await page.locator('.csatbig').innerText()).startsWith('4.4'), true);
t('five star rows', await page.locator('.starrow').count(), 5);
t('client comments quoted', await page.locator('.quote').count(), 2);

// interactivity
await page.click('.rng button[data-d="30"]');
await page.waitForFunction(() => document.querySelector('.kpi .n').textContent === '40', null, { timeout: 5000 });
t('range switch reloads the numbers',
  await page.locator('.kpi .n').first().innerText(), '40');
t('active range highlighted',
  await page.locator('.rng button.on').getAttribute('data-d'), '30');
t('footer states the period',
  (await page.locator('#foot').innerText()).includes('last 30 days'), true);

// agent role must not see other staff
const page2 = await browser.newPage({ viewport:{width:1200,height:900} });
await boot(page2,'agent');
t('agent gets a personal scorecard',
  (await page2.locator('.p-agent h2').innerText()), 'Your scorecard');
t('agent sees no other staff names',
  (await page2.locator('#grid').innerText()).includes('Gary Sookdeo'), false);

// empty state
const page3 = await browser.newPage();
await boot(page3,'branch',{ ok:true, role:'branch', name:'X', empty:true });
t('empty period explained',
  (await page3.locator('.empty').innerText()).includes('No requests logged'), true);

t('no page errors', errors, []);

await page.click('.rng button[data-d="0"]');
await page.waitForTimeout(600);
await page.screenshot({ path: path.join(HERE,'wall.png'), fullPage:true });
await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
