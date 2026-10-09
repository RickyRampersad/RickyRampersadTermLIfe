/* THE BRANCH MANAGER'S LAPTOP.
 *
 * Reported on 17 September 2026: "when I log in as the branch manager on my
 * laptop the interface is not scaled." Every other screen in the app widens on
 * a desktop; the home screen — the one everybody actually lands on — passed no
 * width to Shell, so it fell back to the 560px phone column. On a 1366px
 * laptop that is a narrow ribbon of content down the middle, two thirds of the
 * screen empty, and 1,825px of scrolling to reach the blocks.
 *
 * Pinned here both ways round: the laptop uses its width and puts the sweep
 * beside the quarter, and the phone still stacks them.
 *
 * Run: node tests/e2e-laptop.js   (needs playwright + a chromium on disk)
 */
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const TYPES = { '.html':'text/html','.js':'application/javascript','.css':'text/css','.png':'image/png','.svg':'image/svg+xml' };
const PORT = Number(process.env.PORT) || 8872;
if (!fs.existsSync(CHROME)) { console.log('no chromium on disk — skipped'); process.exit(0); }

const server = http.createServer((req, res) => {
  let f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('no'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

/* Invented people, as every fixture in this repository uses. */
const HAND = { staffId:'demo', name:'Anand Pretend', email:'demo@example.com', agentNumber:'D0', unit:'Support',
  grade:'Sales Support Assistant · G3', role:'ssa', tier:'support', tierLabel:'Sales Support', tierOrder:4, reportsTo:'boss', manager:false, leads:[] };
const BOSS = { staffId:'boss', name:'Carl Fictitious', email:'boss@example.com', agentNumber:'B1', unit:'Branch',
  grade:'Branch Manager', role:'bm', tier:'management', tierLabel:'Management', tierOrder:1, reportsTo:'', manager:true, leads:['demo'] };
const SCH = { boss:{ hours:'8am – 5pm', lunch:'Flexible', blocks:{ KPI1:{time:'8 – 10am',focus:'Recruiting'}, KPI2:{time:'10 – 12pm',focus:'Coaching'}, PM1:{time:'1 – 3pm',focus:'Performance'}, PM2:{time:'3 – 5pm',focus:'Opportunities'} } },
  demo:{ hours:'8am – 4pm', lunch:'12:30 – 1:30pm', blocks:{ KPI1:{time:'8 – 10am',focus:'Premium Dues'}, KPI2:{time:'10 – 12pm',focus:'x'}, PM1:{time:'1 – 3pm',focus:'y'}, PM2:{time:'3 – 4pm',focus:'z'} } } };
const METRICS = { ok:true, date:'2026-09-17', staff:{ boss:{ closed:0, open:39, overdue:0, aged60:0, noDate:1, needs:3,
  byType:{ 'Opportunity':{ closed:0, open:2, overdue:1, needs:1 } }, rateAll:{ closed:12, days:60, enough:true, perDay:0.2, perHour:0.03 } } }, branch:{ byType:{} } };
const STANDING = { ok:true, staffId:'boss', role:'bm', quarter:'2026-Q3', from:'2026-07-01', to:'2026-09-30', today:'2026-09-17', daysIn:78, daysLeft:13,
  goals:[{ goal:'Production & Pipeline Management', weight:20, target:0.9, kpiTypes:['Opportunity'],
    evidence:{ blocks:10, planned:900, met:{met:8,partly:1,no:1}, lines:[], closed:12, open:4, needs:0, late:0 }, landed:0.8 }],
  competencies:[{ competency:'Responsiveness', definition:'', behaviours:[], signals:[], lines:[], moments:[] }],
  salesforce:true, setup:{ goals:true, competencies:true }, side:'self' };

const answer = r => {
  const body = JSON.parse(r.request().postData() || '{}');
  const j = o => r.fulfill({ status:200, contentType:'application/json', body:JSON.stringify(o) });
  if (body.action === 'login' || body.action === 'me')
    return j({ ok:true, token:'t',
      profile: Object.assign({}, BOSS, { attendance:{ first:true, at:'08:02', lastSeen:'08:02', status:'in', reason:'', late:0 } }),
      roster:[HAND, BOSS], schedule:SCH,
      kpis:{ ssa:[{ value:'Renewa/PDl/Bill', label:'Renewals / Premium Dues / Billing', salesforce:true }],
             bm:[{ value:'Opportunity', label:'Opportunities', salesforce:true }] } });
  if (body.action === 'rows') return j({ ok:true, rows:[], metrics:METRICS, openBook:{}, needsReason:{}, billing:{},
    attendance:{ boss:{ at:'08:02', status:'in', reason:'', late:0 } }, mail:{},
    ranks:['Branch Manager','Assistant Branch Manager','Unit Manager','Executive Agent','Agent'] });
  if (body.action === 'standing') return j(STANDING);
  return j({ ok:true });
};

let fails = 0;
const ok = (what, cond, extra) => { console.log((cond ? '  ok   ' : '  FAIL ') + what + (extra && !cond ? '  — ' + extra : '')); if (!cond) fails++; };

async function land(b, w, h, mobile) {
  const ctx = await b.newContext(mobile
    ? { viewport:{ width:w, height:h }, isMobile:true, hasTouch:true }
    : { viewport:{ width:w, height:h } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.message)));
  await page.route('**/macros/s/**', answer);
  await page.clock.setFixedTime(new Date('2026-09-17T10:30:00'));
  await page.goto(`http://localhost:${PORT}/kpi/`, { waitUntil:'networkidle' });
  const i = await page.$$('input');
  await i[0].fill('boss@example.com'); await i[1].fill('1');
  await page.click('button:has-text("Sign in")');
  await page.waitForTimeout(2400);
  /* The two cards are found by what they say, not by a class, because the
     classes are generated. */
  const box = await page.evaluate(() => {
    const find = t => {
      const el = [...document.querySelectorAll('div')].reverse()
        .find(e => e.textContent.trim().startsWith(t) && e.getBoundingClientRect().width > 100);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { x: Math.round(r.left), y: Math.round(r.top), w: Math.round(r.width), bottom: Math.round(r.bottom) };
    };
    const mast = document.querySelector('#root div div');
    return {
      vw: innerWidth,
      sideways: document.documentElement.scrollWidth - innerWidth,
      pageH: document.documentElement.scrollHeight,
      shell: mast ? Math.round(mast.getBoundingClientRect().width) : 0,
      sweep: find('Morning mail'),
      quarter: find('Your quarter')
    };
  });
  await ctx.close();
  return { box, errors };
}

(async () => {
  server.listen(PORT);
  const b = await chromium.launch({ executablePath: CHROME });

  console.log('\nOn the Branch Manager\'s laptop:\n');
  const L = await land(b, 1366, 768, false);
  ok('no script errors', L.errors.length === 0, L.errors[0]);
  ok('the content uses the laptop, not a phone column', L.box.shell > 1000,
     'the shell is ' + L.box.shell + 'px wide on ' + L.box.vw);
  ok('nothing scrolls sideways', L.box.sideways <= 0, L.box.sideways + 'px');
  ok('the morning sweep is on the screen', !!L.box.sweep);
  ok('so is the quarter', !!L.box.quarter);
  if (L.box.sweep && L.box.quarter) {
    /* SIDE BY SIDE IS A HORIZONTAL FACT. The two cards' tops can land on the
       same pixel, so comparing tops to bottoms proves nothing either way —
       what separates the two layouts is that the quarter starts well to the
       right of the sweep here and directly below it on a phone. */
    ok('the quarter sits beside the sweep, not under it',
       L.box.quarter.x > L.box.sweep.x + 200,
       'sweep x=' + L.box.sweep.x + ', quarter x=' + L.box.quarter.x);
    ok('and they start on the same band of the screen',
       Math.abs(L.box.quarter.y - L.box.sweep.y) < 200,
       'sweep y=' + L.box.sweep.y + ', quarter y=' + L.box.quarter.y);
  }

  console.log('\nAnd on a phone, unchanged:\n');
  const P = await land(b, 390, 844, true);
  ok('no script errors', P.errors.length === 0, P.errors[0]);
  ok('nothing scrolls sideways', P.box.sideways <= 0, P.box.sideways + 'px');
  if (P.box.sweep && P.box.quarter) {
    ok('the quarter is under the sweep, not beside it',
       Math.abs(P.box.quarter.x - P.box.sweep.x) < 24 && P.box.quarter.y > P.box.sweep.y,
       'sweep x=' + P.box.sweep.x + ' y=' + P.box.sweep.y +
       ', quarter x=' + P.box.quarter.x + ' y=' + P.box.quarter.y);
    ok('both take the full width of the phone', P.box.sweep.w > 300 && P.box.quarter.w > 300,
       'sweep ' + P.box.sweep.w + ', quarter ' + P.box.quarter.w);
  }

  await b.close(); server.close();
  console.log(fails ? '\n' + fails + ' failed\n' : '\nall green\n');
  process.exit(fails ? 1 : 0);
})();
