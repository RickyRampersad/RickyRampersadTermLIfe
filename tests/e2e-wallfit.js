// The wall is one screen, and nothing may fall off the bottom of it.
//
// Every wall page is body{overflow:hidden}, which is right — a television is
// not scrolled. The consequence is that anything past the fold is not "below,
// scroll down", it is gone, and nothing on screen says so. The conversions
// slide shipped with five rows of tiles and six paragraphs of instruction in
// one column; at 1366x768 half of it was simply missing, and at 1920x1080 the
// last line of the call was cut through the middle.
//
// And the rail: eleven stops fitted on one row, the twelfth wrapped it to two
// and pushed Pause and Narrate onto a third, over the foot of the story. The
// branch's word for that was "jumbled". Then the fix put the controls into the
// timer instead, because the gutter reserved for the timer was a fixed width
// against a timer as wide as its own text.
//
// So this file measures, at the sizes a branch actually has: nothing below the
// fold, nothing cut through it, no sideways scroll, and a rail of at most two
// rows that never lands on the timer.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT = 8861;
const TYPES = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css',
                '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml', '.mp3':'audio/mpeg' };
const server = http.createServer((req, res) => {
  let f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('no'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
let fails = 0;
const ok = (what, cond, extra) => { console.log((cond ? '  ok   ' : '  FAIL ') + what + (extra && !cond ? '  — ' + extra : '')); if (!cond) fails++; };

// Every story in the rotation. index.html is served from the directory.
const PAGES = [
  ['The day so far',    '/intelligence/wall/day.html'],
  ['The day in blocks', '/intelligence/wall/blocks.html'],
  ['Pending · policies',     '/intelligence/wall/pending.html'],
  ['Pending · requirements', '/intelligence/wall/reqs.html'],
  ['Pending · increases & group', '/intelligence/wall/increases.html'],
  ['Premium dues',      '/intelligence/wall/'],
  ['Lapses',            '/intelligence/wall/lapses.html'],
  ['In our possession', '/intelligence/wall/possession.html'],
  ['With the agent',    '/intelligence/wall/delivery.html'],
  ['The licence year',  '/intelligence/wall/licence.html'],
  ['Birthdays today',   '/intelligence/wall/book.html'],
  ['Conversions',       '/intelligence/wall/conversion.html'],
  ['Riders on a clock', '/intelligence/wall/riders.html']
];

// What a leaf element that carries words looks like, and where it sits. The
// feeds answer {ok:false} throughout, so this measures the empty state — which
// is the state a wall is in when the sheet is slow, and the one nobody checks.
const MEASURE = `(() => {
  const leaves = [...document.querySelectorAll('body *')].filter(el => {
    if (el.children.length) return false;
    const t = (el.textContent || '').trim();
    if (t.length < 4) return false;
    const s = getComputedStyle(el);
    if (s.display === 'none' || s.visibility === 'hidden' || +s.opacity === 0) return false;
    return true;
  });
  const words = el => (el.textContent || '').trim().slice(0, 44);
  return {
    overflow: document.documentElement.scrollHeight - innerHeight,
    sideways: document.documentElement.scrollWidth - innerWidth,
    below: leaves.filter(el => el.getBoundingClientRect().top >= innerHeight).map(words),
    through: leaves.filter(el => {
      const r = el.getBoundingClientRect();
      return r.top < innerHeight && r.bottom > innerHeight + 2;
    }).map(words)
  };
})()`;

/* A month's worth of conversions, invented. Fourteen agents is what the feed
   caps at, which is more than fits on a 720-high screen — so this is the
   fixture that proves the trimming, and an empty feed would prove nothing. */
const CONV = { ok: true, data: {
  configured: true, generatedAt: '2026-09-12', month: 'September', day: 12, years: 10, duesRead: true,
  head: { cases: 21, cover: 49900000, prem: 27400, unnamed: 1,
          ahead: { n: 13, cover: 26300000 }, passed: { n: 8, cover: 23600000 },
          expSoon: { n: 2, cover: 1900000 }, noDate: 1 },
  /* A month with birthdays on both sides of today, so the strip has gold
     cells, struck-through grey ones, and a ring on the 12th. */
  days: [{ day: 3, derived: 1, n: 2, cover: 4100000, past: true },
         { day: 8, n: 3, cover: 9200000, past: true },
         { day: 11, n: 3, cover: 10300000, past: true },
         { day: 12, n: 1, cover: 2400000, past: false },
         { day: 15, n: 4, cover: 8800000, past: false },
         { day: 19, n: 2, cover: 3600000, past: false },
         { day: 23, n: 3, cover: 6200000, past: false },
         { day: 30, n: 3, cover: 5300000, past: false }],
  daysInMonth: 30,
  state: { ready: { n: 13, cover: 31200000, prem: 16900 },
           collect: { n: 8, cover: 18700000, prem: 10500 },
           gone: { n: 5, cover: 24100000, prem: 9800 } },
  agentCount: 14,
  /* Ordered the way the feed orders them: soonest birthday first, the days
     already gone at the foot. The ages are what the client turns on the day. */
  agents: 'Ada Bram Cleo Dev Esme Finn Gale Hana Iris Jude Kit Lena Mo Nell'.split(' ')
    .map((nm, i) => {
      const day = [12, 15, 15, 19, 19, 23, 23, 23, 30, 30, 30, 3, 8, 11][i];
      const past = i >= 11;
      return { name: nm + ' Quill', n: 14 - i, cover: (14 - i) * 1000000,
               prem: (14 - i) * 300, top: (14 - i) * 400000, collect: i % 3 ? 1 : 0,
               day: day, past: past, turning: 34 + i * 2,
               rank: past ? day + 100 : day };
    }),
  mix: [{ code: 'FCT', label: 'Revised Flexi Term (convertible)', n: 20, cover: 49400000 }],
  pool: { conv: { n: 304, cover: 493437000, prem: 229284 },
          nonconv: { n: 237, cover: 158053000, prem: 207000 },
          unsettled: { n: 1221, cover: 1194000000 },
          live: { ready: { n: 263, cover: 343092500, prem: 323227 },
                  collect: { n: 335, cover: 451412000, prem: 402000 },
                  gone: { n: 840, cover: 0, prem: 0 } } },
  soon: [2029, 2032, 2033, 2034, 2035, 2036, 2037, 2038, 2039, 2040]
    .map((y, i) => ({ yr: y, n: i + 1, cover: (i + 1) * 500000 })),
  soonTotal: { n: 55, cover: 27500000 },
  notes: ['5 of this month\u2019s birthdays are on policies the dues tab says have lapsed.']
} };

/* A rider month, invented. Two days with something on them — one gone, one
   still to come — plus the two piles that are never empty, because it is
   those the screen has to hold when the month is thin. */
const RID = { ok: true, data: {
  derived: { n: 5, cover: 250000, prem: 1200, gone: { n: 12, prem: 4400, cover: 0 }, rule: 'WP at the anniversary at 59, ADD at 65' },
  configured: true, generatedAt: '2026-09-12', month: 'September', day: 12,
  daysInMonth: 30, window: 12, duesRead: true,
  head: { n: 1306, cover: 642083002, prem: 497952 },
  book: { n: 5924, dated: 2644, blank: 3280, cover: 1540686000, prem: 1586000 },
  gone: { n: 74, cover: 26125856, prem: 24040 },
  thisMonth: { n: 3, cover: 350000, prem: 200 },
  ahead: { n: 9, cover: 2100000, prem: 1400 },
  days: [{ day: 5, n: 1, cover: 250000, past: true, kinds: { ci: 1 } },
         { day: 24, n: 2, cover: 100000, past: false, kinds: { ad: 1, wp: 1 } }],
  months: [{ ym: '2026-09', lab: 'September 2026', n: 3, cover: 350000 },
           { ym: '2026-11', lab: 'November 2026', n: 2, cover: 750000 },
           { ym: '2027-02', lab: 'February 2027', n: 4, cover: 1000000 }],
  kinds: [
    { key: 'ci', lab: 'Critical illness', does: 'pays on diagnosis', have: 2958, dated: 1615,
      blank: 1343, cover: 1277983100, prem: 1370913, gone: { n: 51, cover: 23166342, prem: 23457 },
      month: { n: 1 }, ahead: { n: 5 }, forever: { n: 1092, cover: 601071002, prem: 488772 } },
    { key: 'ad', lab: 'Accidental death', does: 'accident only', have: 1320, dated: 517,
      blank: 803, cover: 262587454, prem: 36254, gone: { n: 15, cover: 2955514, prem: 30 },
      month: { n: 1 }, ahead: { n: 1 }, forever: { n: 210, cover: 41000000, prem: 9000 } },
    { key: 'wp', lab: 'Waiver of premium', does: 'pays the premium if they cannot', have: 1616,
      dated: 483, blank: 1133, cover: null, prem: 177222, gone: { n: 7, cover: 0, prem: 508 },
      month: { n: 1 }, ahead: { n: 2 }, forever: { n: 0, cover: 0, prem: 0 } },
    { key: 'di', lab: 'Disability income', does: 'a monthly benefit', have: 30, dated: 29,
      blank: 1, cover: 115429, prem: 1802, gone: { n: 1, cover: 3000, prem: 45 },
      month: { n: 0 }, ahead: { n: 1 }, forever: { n: 4, cover: 12000, prem: 180 } }
  ],
  agents: 'Ada Bram Cleo Dev Esme Finn Gale Hana Iris Jude Kit Lena'.split(' ')
    .map((nm, i) => ({ name: nm + ' Quill', n: 12 - i, collect: i % 3 ? 1 : 0,
                       oldest: 2015 + i, cover: (12 - i) * 400000, prem: (12 - i) * 300 })),
  agentCount: 18,
  notes: ['3,280 of the 5,924 riders in force carry no expiry date at all, so no screen can tell you when they end.']
} };

/* LAPSES, with July standing up. The month strip is the point of this screen
   — one column three times the rest is the thing the room is meant to see —
   and the agent list is the part allowed to give way on a short screen. Twelve
   agents in the year, nineteen on the count, so the fold has something to
   trim. */
// The day feed with everything the 17a tracker sends: tiers, the week, month
// and year per desk, the task-type mix, and four blocks per desk — one of them
// past its window with nothing filed. Names invented.
const DAY = {"ok":true,"data":{"generatedAt":"2026-09-16","at":"11:10","configured":true,"error":"","branch":{"closed":47,"open":333,"overdue":75,"needs":53,"done":10,"of":32,"in":7,"out":0,"absent":1,"periods":{"week":164,"month":646,"ytd":5337}},"pace":{"perDay":55,"share":85},"blocks":[{"id":"KPI1","label":"HR, SA, RECR, CB","time":"5 \u2013 10am","done":4,"of":10},{"id":"KPI2","label":"BM Client Mgt / RR Oper","time":"10 \u2013 12pm","done":3,"of":10},{"id":"PM1","label":"Escalations / Training","time":"1 \u2013 3pm","done":2,"of":10},{"id":"PM2","label":"Task Mgmt / Reports","time":"3 \u2013 4pm","done":1,"of":10}],"desks":[{"name":"Ricky Rampersad","role":"bm","tier":"management","tierLabel":"Management","tierOrder":1,"reportsTo":"","manager":true,"closed":9,"open":41,"overdue":6,"needs":9,"byType":{"Servicing":{"closed":6,"open":36,"overdue":6,"needs":9,"touched":9},"Pendings":{"closed":3,"open":5,"overdue":0,"needs":0,"touched":4}},"periods":{"week":31,"month":120,"ytd":980},"blocksPeriods":{"week":{"filed":6,"of":12},"month":{"filed":20,"of":48},"ytd":{"filed":300,"of":740}},"blocks":["done","due","due","due"],"bx":[{"id":"KPI1","state":"closed","kpi":"Lic/Staffing/SA/HR","focus":"Lic/Staffing/SA/HR","time":"5 \u2013 10am","due":10,"moved":0,"closed":3,"stuck":false,"type":"Lic/Staffing/SA/HR","sf":{"closed":3,"open":4,"overdue":1,"needs":1,"touched":2}},{"id":"KPI2","state":"late","kpi":"Servicing","focus":"Servicing","time":"10 \u2013 12pm","due":12,"moved":0,"closed":0,"stuck":false,"type":"Servicing","sf":{"closed":0,"open":5,"overdue":1,"needs":1,"touched":2}},{"id":"PM1","state":"pending","kpi":"Pendings","focus":"Pendings","time":"1 \u2013 3pm","due":15,"moved":0,"closed":0,"stuck":false,"type":"Pendings","sf":{"closed":0,"open":6,"overdue":1,"needs":1,"touched":0}},{"id":"PM2","state":"pending","kpi":"RR Operations","focus":"RR Operations","time":"3 \u2013 4pm","due":16,"moved":0,"closed":0,"stuck":false,"type":"RR Operations","sf":{"closed":0,"open":7,"overdue":1,"needs":1,"touched":0}},{"id":"EVE","after":true,"state":"closed","kpi":"After hours","focus":"What was done after four","time":"4pm \u2013 12am","due":24,"moved":0,"closed":0,"stuck":false,"type":"","sf":{"closed":2,"touched":3,"open":41}}],"in":"06:12","out":"","late":0,"absent":false},{"name":"Anand Pretend","role":"um","tier":"management","tierLabel":"Management","tierOrder":1,"reportsTo":"","manager":true,"closed":6,"open":33,"overdue":9,"needs":4,"byType":{"Servicing":{"closed":3,"open":28,"overdue":9,"needs":4,"touched":9},"Pendings":{"closed":3,"open":5,"overdue":0,"needs":0,"touched":4}},"periods":{"week":22,"month":90,"ytd":700},"blocksPeriods":{"week":{"filed":6,"of":12},"month":{"filed":20,"of":48},"ytd":{"filed":300,"of":740}},"blocks":["done","done","due","due"],"bx":[{"id":"KPI1","state":"moved","kpi":"Lic/Staffing/SA/HR","focus":"Lic/Staffing/SA/HR","time":"5 \u2013 10am","due":10,"moved":2,"closed":0,"stuck":false,"type":"Lic/Staffing/SA/HR","sf":{"closed":0,"open":4,"overdue":1,"needs":1,"touched":2}},{"id":"KPI2","state":"moved","kpi":"Servicing","focus":"Servicing","time":"10 \u2013 12pm","due":12,"moved":2,"closed":0,"stuck":false,"type":"Servicing","sf":{"closed":0,"open":5,"overdue":1,"needs":1,"touched":2}},{"id":"PM1","state":"pending","kpi":"Pendings","focus":"Pendings","time":"1 \u2013 3pm","due":15,"moved":0,"closed":0,"stuck":false,"type":"Pendings","sf":{"closed":0,"open":6,"overdue":1,"needs":1,"touched":0}},{"id":"PM2","state":"pending","kpi":"RR Operations","focus":"RR Operations","time":"3 \u2013 4pm","due":16,"moved":0,"closed":0,"stuck":false,"type":"RR Operations","sf":{"closed":0,"open":7,"overdue":1,"needs":1,"touched":0}},{"id":"EVE","after":true,"state":"moved","kpi":"After hours","focus":"What was done after four","time":"4pm \u2013 12am","due":24,"moved":0,"closed":0,"stuck":false,"type":"","sf":{"closed":0,"touched":3,"open":33}}],"in":"07:58","out":"","late":0,"absent":false},{"name":"Beena Sample","role":"um","tier":"management","tierLabel":"Management","tierOrder":1,"reportsTo":"","manager":true,"closed":3,"open":58,"overdue":21,"needs":11,"byType":{"Servicing":{"closed":0,"open":53,"overdue":21,"needs":11,"touched":9},"Pendings":{"closed":3,"open":5,"overdue":0,"needs":0,"touched":4}},"periods":{"week":12,"month":60,"ytd":500},"blocksPeriods":{"week":{"filed":6,"of":12},"month":{"filed":20,"of":48},"ytd":{"filed":300,"of":740}},"blocks":["due","due","due","due"],"bx":[{"id":"KPI1","state":"late","kpi":"Lic/Staffing/SA/HR","focus":"Lic/Staffing/SA/HR","time":"5 \u2013 10am","due":10,"moved":0,"closed":0,"stuck":false,"type":"Lic/Staffing/SA/HR","sf":{"closed":0,"open":4,"overdue":1,"needs":1,"touched":2}},{"id":"KPI2","state":"late","kpi":"Servicing","focus":"Servicing","time":"10 \u2013 12pm","due":12,"moved":0,"closed":0,"stuck":false,"type":"Servicing","sf":{"closed":0,"open":5,"overdue":1,"needs":1,"touched":2}},{"id":"PM1","state":"pending","kpi":"Pendings","focus":"Pendings","time":"1 \u2013 3pm","due":15,"moved":0,"closed":0,"stuck":false,"type":"Pendings","sf":{"closed":0,"open":6,"overdue":1,"needs":1,"touched":0}},{"id":"PM2","state":"pending","kpi":"RR Operations","focus":"RR Operations","time":"3 \u2013 4pm","due":16,"moved":0,"closed":0,"stuck":false,"type":"RR Operations","sf":{"closed":0,"open":7,"overdue":1,"needs":1,"touched":0}},{"id":"EVE","after":true,"state":"idle","kpi":"After hours","focus":"What was done after four","time":"4pm \u2013 12am","due":24,"moved":0,"closed":0,"stuck":false,"type":"","sf":{"closed":0,"touched":0,"open":58}}],"in":"","out":"","late":0,"absent":true},{"name":"Carl Fictitious","role":"bma","tier":"bma","tierLabel":"Branch Manager's Assistant","tierOrder":2,"reportsTo":"","manager":false,"closed":4,"open":69,"overdue":16,"needs":6,"byType":{"Servicing":{"closed":1,"open":64,"overdue":16,"needs":6,"touched":9},"Pendings":{"closed":3,"open":5,"overdue":0,"needs":0,"touched":4}},"periods":{"week":18,"month":70,"ytd":610},"blocksPeriods":{"week":{"filed":6,"of":12},"month":{"filed":20,"of":48},"ytd":{"filed":300,"of":740}},"blocks":["done","done","due","due"],"bx":[{"id":"KPI1","state":"closed","kpi":"Lic/Staffing/SA/HR","focus":"Lic/Staffing/SA/HR","time":"5 \u2013 10am","due":10,"moved":0,"closed":3,"stuck":false,"type":"Lic/Staffing/SA/HR","sf":{"closed":3,"open":4,"overdue":1,"needs":1,"touched":2}},{"id":"KPI2","state":"moved","kpi":"Servicing","focus":"Servicing","time":"10 \u2013 12pm","due":12,"moved":2,"closed":0,"stuck":false,"type":"Servicing","sf":{"closed":0,"open":5,"overdue":1,"needs":1,"touched":2}},{"id":"PM1","state":"pending","kpi":"Pendings","focus":"Pendings","time":"1 \u2013 3pm","due":15,"moved":0,"closed":0,"stuck":false,"type":"Pendings","sf":{"closed":0,"open":6,"overdue":1,"needs":1,"touched":0}},{"id":"PM2","state":"pending","kpi":"RR Operations","focus":"RR Operations","time":"3 \u2013 4pm","due":16,"moved":0,"closed":0,"stuck":false,"type":"RR Operations","sf":{"closed":0,"open":7,"overdue":1,"needs":1,"touched":0}},{"id":"EVE","after":true,"state":"pending","kpi":"After hours","focus":"What was done after four","time":"4pm \u2013 12am","due":24,"moved":0,"closed":0,"stuck":false,"type":"","sf":{"closed":0,"touched":0,"open":69}}],"in":"07:58","out":"","late":0,"absent":false},{"name":"Dina Example","role":"ssa","tier":"support","tierLabel":"Sales Support","tierOrder":4,"reportsTo":"","manager":false,"closed":14,"open":41,"overdue":0,"needs":9,"byType":{"Servicing":{"closed":11,"open":36,"overdue":0,"needs":9,"touched":9},"Pendings":{"closed":3,"open":5,"overdue":0,"needs":0,"touched":4}},"periods":{"week":41,"month":150,"ytd":1200},"blocksPeriods":{"week":{"filed":6,"of":12},"month":{"filed":20,"of":48},"ytd":{"filed":300,"of":740}},"blocks":["done","done","due","due"],"bx":[{"id":"KPI1","state":"closed","kpi":"Lic/Staffing/SA/HR","focus":"Lic/Staffing/SA/HR","time":"5 \u2013 10am","due":10,"moved":0,"closed":3,"stuck":false,"type":"Lic/Staffing/SA/HR","sf":{"closed":3,"open":4,"overdue":1,"needs":1,"touched":2}},{"id":"KPI2","state":"closed","kpi":"Servicing","focus":"Servicing","time":"10 \u2013 12pm","due":12,"moved":0,"closed":3,"stuck":false,"type":"Servicing","sf":{"closed":3,"open":5,"overdue":1,"needs":1,"touched":2}},{"id":"PM1","state":"pending","kpi":"Pendings","focus":"Pendings","time":"1 \u2013 3pm","due":15,"moved":0,"closed":0,"stuck":false,"type":"Pendings","sf":{"closed":0,"open":6,"overdue":1,"needs":1,"touched":0}},{"id":"PM2","state":"pending","kpi":"RR Operations","focus":"RR Operations","time":"3 \u2013 4pm","due":16,"moved":0,"closed":0,"stuck":false,"type":"RR Operations","sf":{"closed":0,"open":7,"overdue":1,"needs":1,"touched":0}},{"id":"EVE","after":true,"state":"closed","kpi":"After hours","focus":"What was done after four","time":"4pm \u2013 12am","due":24,"moved":0,"closed":0,"stuck":false,"type":"","sf":{"closed":2,"touched":3,"open":41}}],"in":"07:58","out":"","late":0,"absent":false},{"name":"Errol Placeholder","role":"ssa","tier":"support","tierLabel":"Sales Support","tierOrder":4,"reportsTo":"","manager":false,"closed":8,"open":52,"overdue":14,"needs":7,"byType":{"Servicing":{"closed":5,"open":47,"overdue":14,"needs":7,"touched":9},"Pendings":{"closed":3,"open":5,"overdue":0,"needs":0,"touched":4}},"periods":{"week":20,"month":88,"ytd":640},"blocksPeriods":{"week":{"filed":6,"of":12},"month":{"filed":20,"of":48},"ytd":{"filed":300,"of":740}},"blocks":["done","due","due","due"],"bx":[{"id":"KPI1","state":"closed","kpi":"Lic/Staffing/SA/HR","focus":"Lic/Staffing/SA/HR","time":"5 \u2013 10am","due":10,"moved":0,"closed":3,"stuck":false,"type":"Lic/Staffing/SA/HR","sf":{"closed":3,"open":4,"overdue":1,"needs":1,"touched":2}},{"id":"KPI2","state":"late","kpi":"Servicing","focus":"Servicing","time":"10 \u2013 12pm","due":12,"moved":0,"closed":0,"stuck":false,"type":"Servicing","sf":{"closed":0,"open":5,"overdue":1,"needs":1,"touched":2}},{"id":"PM1","state":"pending","kpi":"Pendings","focus":"Pendings","time":"1 \u2013 3pm","due":15,"moved":0,"closed":0,"stuck":false,"type":"Pendings","sf":{"closed":0,"open":6,"overdue":1,"needs":1,"touched":0}},{"id":"PM2","state":"pending","kpi":"RR Operations","focus":"RR Operations","time":"3 \u2013 4pm","due":16,"moved":0,"closed":0,"stuck":false,"type":"RR Operations","sf":{"closed":0,"open":7,"overdue":1,"needs":1,"touched":0}},{"id":"EVE","after":true,"state":"moved","kpi":"After hours","focus":"What was done after four","time":"4pm \u2013 12am","due":24,"moved":0,"closed":0,"stuck":false,"type":"","sf":{"closed":0,"touched":3,"open":52}}],"in":"07:58","out":"","late":0,"absent":false},{"name":"Fay Specimen","role":"ssa","tier":"support","tierLabel":"Sales Support","tierOrder":4,"reportsTo":"","manager":false,"closed":2,"open":11,"overdue":1,"needs":2,"byType":{"Servicing":{"closed":0,"open":6,"overdue":1,"needs":2,"touched":9},"Pendings":{"closed":2,"open":5,"overdue":0,"needs":0,"touched":4}},"periods":{"week":9,"month":38,"ytd":300},"blocksPeriods":{"week":{"filed":6,"of":12},"month":{"filed":20,"of":48},"ytd":{"filed":300,"of":740}},"blocks":["done","due","due","due"],"bx":[{"id":"KPI1","state":"moved","kpi":"Lic/Staffing/SA/HR","focus":"Lic/Staffing/SA/HR","time":"5 \u2013 10am","due":10,"moved":2,"closed":0,"stuck":false,"type":"Lic/Staffing/SA/HR","sf":{"closed":0,"open":4,"overdue":1,"needs":1,"touched":2}},{"id":"KPI2","state":"late","kpi":"Servicing","focus":"Servicing","time":"10 \u2013 12pm","due":12,"moved":0,"closed":0,"stuck":false,"type":"Servicing","sf":{"closed":0,"open":5,"overdue":1,"needs":1,"touched":2}},{"id":"PM1","state":"pending","kpi":"Pendings","focus":"Pendings","time":"1 \u2013 3pm","due":15,"moved":0,"closed":0,"stuck":false,"type":"Pendings","sf":{"closed":0,"open":6,"overdue":1,"needs":1,"touched":0}},{"id":"PM2","state":"pending","kpi":"RR Operations","focus":"RR Operations","time":"3 \u2013 4pm","due":16,"moved":0,"closed":0,"stuck":false,"type":"RR Operations","sf":{"closed":0,"open":7,"overdue":1,"needs":1,"touched":0}},{"id":"EVE","after":true,"state":"idle","kpi":"After hours","focus":"What was done after four","time":"4pm \u2013 12am","due":24,"moved":0,"closed":0,"stuck":false,"type":"","sf":{"closed":0,"touched":0,"open":11}}],"in":"07:58","out":"","late":0,"absent":false},{"name":"Gus Stand-in","role":"ssa","tier":"support","tierLabel":"Sales Support","tierOrder":4,"reportsTo":"","manager":false,"closed":1,"open":28,"overdue":8,"needs":5,"byType":{"Servicing":{"closed":0,"open":23,"overdue":8,"needs":5,"touched":9},"Pendings":{"closed":1,"open":5,"overdue":0,"needs":0,"touched":4}},"periods":{"week":11,"month":30,"ytd":407},"blocksPeriods":{"week":{"filed":6,"of":12},"month":{"filed":20,"of":48},"ytd":{"filed":300,"of":740}},"blocks":["due","due","due","due"],"bx":[{"id":"KPI1","state":"late","kpi":"Lic/Staffing/SA/HR","focus":"Lic/Staffing/SA/HR","time":"5 \u2013 10am","due":10,"moved":0,"closed":0,"stuck":false,"type":"Lic/Staffing/SA/HR","sf":{"closed":0,"open":4,"overdue":1,"needs":1,"touched":2}},{"id":"KPI2","state":"late","kpi":"Servicing","focus":"Servicing","time":"10 \u2013 12pm","due":12,"moved":0,"closed":0,"stuck":false,"type":"Servicing","sf":{"closed":0,"open":5,"overdue":1,"needs":1,"touched":2}},{"id":"PM1","state":"pending","kpi":"Pendings","focus":"Pendings","time":"1 \u2013 3pm","due":15,"moved":0,"closed":0,"stuck":false,"type":"Pendings","sf":{"closed":0,"open":6,"overdue":1,"needs":1,"touched":0}},{"id":"PM2","state":"pending","kpi":"RR Operations","focus":"RR Operations","time":"3 \u2013 4pm","due":16,"moved":0,"closed":0,"stuck":false,"type":"RR Operations","sf":{"closed":0,"open":7,"overdue":1,"needs":1,"touched":0}},{"id":"EVE","after":true,"state":"idle","kpi":"After hours","focus":"What was done after four","time":"4pm \u2013 12am","due":24,"moved":0,"closed":0,"stuck":false,"type":"","sf":{"closed":0,"touched":0,"open":28}}],"in":"07:58","out":"","late":0,"absent":false}]}};
const LAP = { ok: true, data: {
  configured: true, generatedAt: '2026-09-17', year: 2026, month: 'September', monthIndex: 8, quarter: 'Q3',
  windows: {
    month:   { lab:'September', policies:17, modal:5100, annualised:61200, medianYears:2.1, under1y:5, under2y:8, bands:[{key:'lt1',lab:'under a year',n:5},{key:'y1',lab:'1–2 years',n:3},{key:'y2',lab:'2–5 years',n:5},{key:'y5',lab:'5–10 years',n:1},{key:'y10',lab:'10 years and more',n:3}], agents:[{ agent:'Anand Pretend', policies:31, modal:9800, annualised:117600, medianYears:2.4, under1y:9, under2y:14, month:5, quarter:10 }, { agent:'Beena Sample', policies:27, modal:8100, annualised:97200, medianYears:1.1, under1y:12, under2y:18, month:4, quarter:9 }, { agent:'Carl Fictitious', policies:22, modal:6600, annualised:79200, medianYears:4.8, under1y:3, under2y:6, month:3, quarter:7 }, { agent:'Dev Desk', policies:19, modal:5700, annualised:68400, medianYears:0.9, under1y:11, under2y:15, month:3, quarter:6 }, { agent:'Eve Example', policies:16, modal:4800, annualised:57600, medianYears:3.2, under1y:4, under2y:7, month:2, quarter:5 }, { agent:'Fay Pretend', policies:14, modal:4200, annualised:50400, medianYears:6.5, under1y:2, under2y:3, month:2, quarter:4 }] },
    quarter: { lab:'Q3', policies:171, modal:51300, annualised:615600, medianYears:1.9, under1y:54, under2y:80, bands:[{key:'lt1',lab:'under a year',n:51},{key:'y1',lab:'1–2 years',n:34},{key:'y2',lab:'2–5 years',n:51},{key:'y5',lab:'5–10 years',n:17},{key:'y10',lab:'10 years and more',n:18}], agents:[{ agent:'Anand Pretend', policies:31, modal:9800, annualised:117600, medianYears:2.4, under1y:9, under2y:14, month:5, quarter:10 }, { agent:'Beena Sample', policies:27, modal:8100, annualised:97200, medianYears:1.1, under1y:12, under2y:18, month:4, quarter:9 }, { agent:'Carl Fictitious', policies:22, modal:6600, annualised:79200, medianYears:4.8, under1y:3, under2y:6, month:3, quarter:7 }, { agent:'Dev Desk', policies:19, modal:5700, annualised:68400, medianYears:0.9, under1y:11, under2y:15, month:3, quarter:6 }, { agent:'Eve Example', policies:16, modal:4800, annualised:57600, medianYears:3.2, under1y:4, under2y:7, month:2, quarter:5 }, { agent:'Fay Pretend', policies:14, modal:4200, annualised:50400, medianYears:6.5, under1y:2, under2y:3, month:2, quarter:4 }] },
    year:    { lab:'2026 to date', policies:321, modal:96300, annualised:1155600, medianYears:2.4, under1y:96, under2y:148, bands:[{key:'lt1',lab:'under a year',n:96},{key:'y1',lab:'1–2 years',n:64},{key:'y2',lab:'2–5 years',n:96},{key:'y5',lab:'5–10 years',n:32},{key:'y10',lab:'10 years and more',n:33}], agents:[{ agent:'Anand Pretend', policies:31, modal:9800, annualised:117600, medianYears:2.4, under1y:9, under2y:14, month:5, quarter:10 }, { agent:'Beena Sample', policies:27, modal:8100, annualised:97200, medianYears:1.1, under1y:12, under2y:18, month:4, quarter:9 }, { agent:'Carl Fictitious', policies:22, modal:6600, annualised:79200, medianYears:4.8, under1y:3, under2y:6, month:3, quarter:7 }, { agent:'Dev Desk', policies:19, modal:5700, annualised:68400, medianYears:0.9, under1y:11, under2y:15, month:3, quarter:6 }, { agent:'Eve Example', policies:16, modal:4800, annualised:57600, medianYears:3.2, under1y:4, under2y:7, month:2, quarter:5 }, { agent:'Fay Pretend', policies:14, modal:4200, annualised:50400, medianYears:6.5, under1y:2, under2y:3, month:2, quarter:4 }] }
  },
  byMonth: [{ ym:'2026-01', lab:'Jan', policies:27, modal:8100 , agents:6, top:[{k:'Anand Pretend',n:9,pct:33},{k:'Beena Sample',n:5,pct:19}] }, { ym:'2026-02', lab:'Feb', policies:19, modal:5700 , agents:6, top:[{k:'Anand Pretend',n:6,pct:32},{k:'Beena Sample',n:4,pct:21}] }, { ym:'2026-03', lab:'Mar', policies:22, modal:6600 , agents:6, top:[{k:'Anand Pretend',n:7,pct:32},{k:'Beena Sample',n:4,pct:18}] }, { ym:'2026-04', lab:'Apr', policies:23, modal:6900 , agents:6, top:[{k:'Anand Pretend',n:8,pct:35},{k:'Beena Sample',n:5,pct:22}] }, { ym:'2026-05', lab:'May', policies:19, modal:5700 , agents:6, top:[{k:'Anand Pretend',n:6,pct:32},{k:'Beena Sample',n:4,pct:21}] }, { ym:'2026-06', lab:'Jun', policies:40, modal:12000 , agents:6, top:[{k:'Anand Pretend',n:14,pct:35},{k:'Beena Sample',n:8,pct:20}] }, { ym:'2026-07', lab:'Jul', policies:118, modal:35400 , agents:6, top:[{k:'Anand Pretend',n:40,pct:34},{k:'Beena Sample',n:24,pct:20}] }, { ym:'2026-08', lab:'Aug', policies:36, modal:10800 , agents:6, top:[{k:'Anand Pretend',n:12,pct:33},{k:'Beena Sample',n:7,pct:19}] }, { ym:'2026-09', lab:'Sep', policies:17, modal:5100 , agents:6, top:[{k:'Anand Pretend',n:6,pct:35},{k:'Beena Sample',n:3,pct:18}] }, { ym:'2026-10', lab:'Oct', policies:0, modal:0 }, { ym:'2026-11', lab:'Nov', policies:0, modal:0 }, { ym:'2026-12', lab:'Dec', policies:0, modal:0 }],
  agents: [{ agent:'Anand Pretend', policies:31, modal:9800, annualised:117600, medianYears:2.4, under1y:9, under2y:14, month:5, quarter:10 }, { agent:'Beena Sample', policies:27, modal:8100, annualised:97200, medianYears:1.1, under1y:12, under2y:18, month:4, quarter:9 }, { agent:'Carl Fictitious', policies:22, modal:6600, annualised:79200, medianYears:4.8, under1y:3, under2y:6, month:3, quarter:7 }, { agent:'Dev Desk', policies:19, modal:5700, annualised:68400, medianYears:0.9, under1y:11, under2y:15, month:3, quarter:6 }, { agent:'Eve Example', policies:16, modal:4800, annualised:57600, medianYears:3.2, under1y:4, under2y:7, month:2, quarter:5 }, { agent:'Fay Pretend', policies:14, modal:4200, annualised:50400, medianYears:6.5, under1y:2, under2y:3, month:2, quarter:4 }, { agent:'Gale Quill', policies:12, modal:3600, annualised:43200, medianYears:1.7, under1y:5, under2y:8, month:2, quarter:4 }, { agent:'Hal Sample', policies:11, modal:3300, annualised:39600, medianYears:2.9, under1y:3, under2y:5, month:1, quarter:3 }, { agent:'Ira Fictitious', policies:9, modal:2700, annualised:32400, medianYears:8.1, under1y:1, under2y:2, month:1, quarter:3 }, { agent:'Jo Desk', policies:8, modal:2400, annualised:28800, medianYears:1.3, under1y:4, under2y:6, month:1, quarter:2 }, { agent:'Kit Example', policies:7, modal:2100, annualised:25200, medianYears:5.0, under1y:1, under2y:2, month:1, quarter:2 }, { agent:'Lee Pretend', policies:6, modal:1800, annualised:21600, medianYears:2.2, under1y:2, under2y:3, month:1, quarter:2 }],
  agentCount: 19,
  lapsed: { total: 321, earlier: 14 },
  excluded: { policies: 6, modal: 1800, annualised: 21600, agents: 1 },
  defects: { noLapseDate: 3, noIssueDate: 9, futureLapseDate: 0 },
  notes: ['3 lapsed policies carry no usable lapse date, so nothing on this screen can place them.']
} };


async function fresh(b, w, h, feed) {
  const ctx = await b.newContext({ viewport: { width: w, height: h } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.message)));
  await page.route(u => u.hostname !== 'localhost', r => {
    const host = new URL(r.request().url()).hostname;
    if (/script\.google\.com$/.test(host))
      return r.fulfill({ status: 200, contentType: 'application/json',
                         body: JSON.stringify(feed || { ok: false }) });
    return r.fulfill({ status: 200, contentType: 'text/css', body: '' });
  });
  return { ctx, page, errors };
}

(async () => {
  server.listen(PORT);
  const b = await chromium.launch({ executablePath: CHROME });

  /* ── Every story, at the branch's own screen ──────────────────────────────
     1080 is the television on the wall in Chaguanas. Two of the older stories
     — premium dues and birthdays — only fit at this height and not below it,
     so this asserts the height the branch has rather than a height it does
     not, and says which two would need the same treatment if that changes. */
  console.log('\nEvery story fits the television, with nothing past the fold:\n');
  for (const [name, url] of PAGES) {
    const s = await fresh(b, 1920, 1080);
    await s.page.goto(`http://localhost:${PORT}${url}`, { waitUntil: 'domcontentloaded' });
    await s.page.waitForTimeout(1200);
    const m = await s.page.evaluate(MEASURE);
    ok(name.padEnd(21) + ' fits, and nothing is cut off',
       m.overflow <= 2 && m.sideways <= 2 && !m.below.length && !m.through.length,
       'overflow ' + m.overflow + 'px, sideways ' + m.sideways +
       ', below: ' + JSON.stringify(m.below.slice(0, 2)) +
       ', cut through: ' + JSON.stringify(m.through.slice(0, 2)));
    await s.ctx.close();
  }

  /* ── The conversions slide, at every size a branch might use ──────────────
     This is the one that broke, and it is the one that scales: the hero, the
     tiles and the rows are all clamped to the viewport, and both lists are
     trimmed to the rows that actually fit. */
  console.log('\nAnd conversions scales, from a laptop to a 4K panel:\n');
  for (const [w, h, tag] of [[3840,2160,'4K panel'],[1920,1080,'the branch television'],
                             [1600,900,'1600 x 900'],[1366,768,'a laptop'],[1280,720,'720p']]) {
    const s = await fresh(b, w, h, CONV);
    await s.page.goto(`http://localhost:${PORT}/intelligence/wall/conversion.html`, { waitUntil: 'domcontentloaded' });
    await s.page.waitForTimeout(1300);
    const m = await s.page.evaluate(MEASURE);
    ok(tag.padEnd(22) + ' nothing below the fold, nothing cut through it',
       m.overflow <= 2 && m.sideways <= 2 && !m.below.length && !m.through.length,
       'overflow ' + m.overflow + 'px, below ' + JSON.stringify(m.below.slice(0, 2)) +
       ', through ' + JSON.stringify(m.through.slice(0, 2)));
    /* A trimmed list has to SAY it is trimmed. A wall that quietly drops the
       last agent is worse than one that shows nine and admits to three more. */
    const t = await s.page.evaluate(() => ({
      rows: document.querySelectorAll('#cList .crow').length,
      owns: /more agents below the fold/.test(document.getElementById('cMix').textContent || '')
    }));
    ok(tag.padEnd(22) + ' draws ' + t.rows + ' of fourteen agent rows' +
       (t.owns ? ', and owns up to the rest' : ''),
       t.rows >= 3 && (t.rows === 14 || t.owns),
       t.rows + ' rows, admits to the remainder: ' + t.owns);
    /* The day strip is the whole point of the screen: a cell for every day of
       the month, gold for a birthday still to come, grey for one already gone,
       and a ring on today. It must survive every one of these sizes intact —
       there is nothing to trim here, and a month missing its last week would
       send an agent past a client without a call. */
    const c = await s.page.evaluate(() => {
      const cells = [...document.querySelectorAll('#cCal b')];
      return {
        cells: cells.length,
        marked: cells.filter(el => el.classList.contains('has')).length,
        gone: cells.filter(el => el.classList.contains('past')).length,
        today: cells.filter(el => el.classList.contains('today')).length,
        square: cells.length ? Math.abs(cells[0].getBoundingClientRect().width -
                                        cells[0].getBoundingClientRect().height) : 99,
        first: (document.querySelector('#cList .crow .v') || {}).textContent || ''
      };
    });
    ok(tag.padEnd(22) + ' the month is whole: thirty cells, eight with a birthday, three gone, today ringed',
       c.cells === 30 && c.marked === 8 && c.gone === 3 && c.today === 1 && c.square < 2,
       JSON.stringify(c));
    ok(tag.padEnd(22) + ' the agent at the top is the one whose birthday is soonest',
       /12th/.test(c.first), 'top row reads ' + JSON.stringify(c.first));
    await s.ctx.close();
  }

  /* ── Lapses, at every size ──────────────────────────────────────────────
     July is three times any other month and the strip has to say so on a
     laptop as loudly as on the television. The three windows and the tenure
     bands are fixed content; the agent list is what gives way. */
  /* ── The day and the blocks, fed ────────────────────────────────────────
     Nine columns on the day table since 16 September (week, month and year
     per desk beside today's), a "who" line under each window on the strip,
     the task-type mix, and on the blocks screen a block past its window
     with nothing filed painted red across the cell. */
  console.log('\nAnd the day and the blocks hold with a full feed:\n');
  for (const [w, h, tag] of [[1920,1080,'the branch television'],[1366,768,'a laptop'],[1280,720,'720p']]) {
    let s = await fresh(b, w, h, DAY);
    await s.page.goto(`http://localhost:${PORT}/intelligence/wall/day.html`, { waitUntil: 'domcontentloaded' });
    await s.page.waitForTimeout(1300);
    let m = await s.page.evaluate(MEASURE);
    ok(tag.padEnd(22) + ' day: nothing below the fold, nothing cut through it',
       m.overflow <= 2 && m.sideways <= 2 && !m.below.length && !m.through.length,
       'overflow ' + m.overflow + 'px, below ' + JSON.stringify(m.below.slice(0, 2)) + ', through ' + JSON.stringify(m.through.slice(0, 2)));
    const d = await s.page.evaluate(() => ({
      heads: [...document.querySelectorAll('.dhead > div')].map(e => e.textContent.trim()),
      rows: document.querySelectorAll('.drow').length,
      per: document.querySelectorAll('.drow .v.per').length,
      who: [...document.querySelectorAll('#hTrend .w')].map(e => e.textContent.trim()),
      mix: (document.getElementById('hMix') || {}).textContent || '',
      mixHidden: (document.getElementById('hMix') || {}).hidden,
      big: (document.getElementById('hClosed') || {}).textContent
    }));
    ok(tag.padEnd(22) + ' the table carries week, month and year',
       d.heads.join('|') === 'Desk|Closed|Open|Late|Quiet|Week|Month|Year|Blocks · after 4' && d.per === d.rows * 3, d.heads.join('|') + ' · ' + d.per + '/' + d.rows);
    ok(tag.padEnd(22) + ' each window names who closed the most',
       d.who.length === 4 && /Dina\s*14/.test(d.who[0]) && /Dina\s*41/.test(d.who[1]) && /Dina\s*150/.test(d.who[2]) && /Dina\s*1,?200/.test(d.who[3]), JSON.stringify(d.who));
    ok(tag.padEnd(22) + " and today's closing is shown by task type", !d.mixHidden && /Servicing/.test(d.mix) && /Pendings/.test(d.mix), d.mix.slice(0, 80));
    const pills = await s.page.evaluate(() => ({ late: document.querySelectorAll('.blk i.late').length, done: document.querySelectorAll('.blk i.done').length,
      red: getComputedStyle(document.querySelector('.blk i.late') || document.body).backgroundColor }));
    ok(tag.padEnd(22) + ' the day pills read the block state — seven missed blocks deep red', pills.late === 7 && /rgba?\(198, 40, 40/.test(pills.red), JSON.stringify(pills));
    const five = await s.page.evaluate(() => ({ rows: document.querySelectorAll('.drow').length, pills: document.querySelectorAll('.drow .blk i').length, idle: document.querySelectorAll('.drow .blk i.idle').length }));
    ok(tag.padEnd(22) + ' and five pills a desk, the fifth for after four', five.pills === five.rows * 5 && five.idle === 3, JSON.stringify(five));
    ok(tag.padEnd(22) + ' no javascript errors on the day', s.errors.length === 0, s.errors.join(' | '));
    await s.ctx.close();

    s = await fresh(b, w, h, DAY);
    await s.page.goto(`http://localhost:${PORT}/intelligence/wall/blocks.html`, { waitUntil: 'domcontentloaded' });
    await s.page.waitForTimeout(1300);
    m = await s.page.evaluate(MEASURE);
    ok(tag.padEnd(22) + ' blocks: nothing below the fold, nothing cut through it',
       m.overflow <= 2 && m.sideways <= 2 && !m.below.length && !m.through.length,
       'overflow ' + m.overflow + 'px, below ' + JSON.stringify(m.below.slice(0, 2)) + ', through ' + JSON.stringify(m.through.slice(0, 2)));
    const bl = await s.page.evaluate(() => {
      const late = [...document.querySelectorAll('.cell.late')];
      const bg = late.length ? getComputedStyle(late[0]).backgroundColor : '';
      return { late: late.length, red: /rgba?\(150, 20, 20/.test(bg), bg, caption: late.length ? late[0].textContent.trim().slice(0, 60) : '' };
    });
    ok(tag.padEnd(22) + ' an unfiled block past its window is deep red across the cell', bl.late === 7 && bl.red, JSON.stringify(bl));
    const bands = await s.page.evaluate(() => ({ axis: document.querySelectorAll('.axis .ab').length, eve: [...document.querySelectorAll('.axis .ab')].map(e => e.textContent).join('|'), idle: document.querySelectorAll('.cell .dot.idle').length }));
    ok(tag.padEnd(22) + ' five bands on the clock, the fifth from four to midnight', bands.axis === 5 && /4pm – 12am/.test(bands.eve) && bands.idle === 3, JSON.stringify(bands));
    ok(tag.padEnd(22) + '   and says so', /not filed/.test(bl.caption), bl.caption);
    ok(tag.padEnd(22) + ' no javascript errors on the blocks', s.errors.length === 0, s.errors.join(' | '));
    await s.ctx.close();
  }

  console.log('\nAnd the lapses screen holds at every size:\n');
  for (const [w, h, tag] of [[3840,2160,'4K panel'],[1920,1080,'the branch television'],
                             [1600,900,'1600 x 900'],[1366,768,'a laptop'],[1280,720,'720p']]) {
    const s = await fresh(b, w, h, LAP);
    await s.page.goto(`http://localhost:${PORT}/intelligence/wall/lapses.html`, { waitUntil: 'domcontentloaded' });
    await s.page.waitForTimeout(1300);
    const m = await s.page.evaluate(MEASURE);
    ok(tag.padEnd(22) + ' nothing below the fold, nothing cut through it',
       m.overflow <= 2 && m.sideways <= 2 && !m.below.length && !m.through.length,
       'overflow ' + m.overflow + 'px, below ' + JSON.stringify(m.below.slice(0, 2)) +
       ', through ' + JSON.stringify(m.through.slice(0, 2)));
    const r = await s.page.evaluate(() => {
      const cols = [...document.querySelectorAll('#lStrip [data-ym], #lStrip .col, #lStrip > div')];
      const hs = cols.map(c => c.getBoundingClientRect().height);
      const jul = cols.find(c => /jul/i.test(c.textContent || ''));
      return { months: cols.length,
               julTallest: jul ? jul.getBoundingClientRect().height >= Math.max(...hs) - 1 : null,
               wins: document.querySelectorAll('#lWins > *').length,
               bands: document.querySelectorAll('#lBands > *').length,
               agents: document.querySelectorAll('#lList .crow, #lList tr, #lList > div').length,
               note: (document.getElementById('lNote') || {}).textContent || '' };
    });
    ok(tag.padEnd(22) + ' twelve months on the strip', r.months === 12, String(r.months));
    ok(tag.padEnd(22) + '   and July is the tallest column', r.julTallest !== false, String(r.julTallest));
    ok(tag.padEnd(22) + ' the three windows are drawn', r.wins >= 3, String(r.wins));
    ok(tag.padEnd(22) + ' some agents are drawn', r.agents >= 1, String(r.agents));
    ok(tag.padEnd(22) + ' no javascript errors', s.errors.length === 0, s.errors.join(' | '));
    await s.ctx.close();
  }

  /* ── The riders screen, at every size ────────────────────────────────────
     The month is the thin part of this screen and the two piles are the thick
     part, so what has to survive a short screen is the strip and the four
     riders — not the agent list, which is the one allowed to give way. */
  console.log('\nAnd riders on a clock holds at every size:\n');
  for (const [w, h, tag] of [[3840,2160,'4K panel'],[1920,1080,'the branch television'],
                             [1600,900,'1600 x 900'],[1366,768,'a laptop'],[1280,720,'720p']]) {
    const s = await fresh(b, w, h, RID);
    await s.page.goto(`http://localhost:${PORT}/intelligence/wall/riders.html`, { waitUntil: 'domcontentloaded' });
    await s.page.waitForTimeout(1300);
    const m = await s.page.evaluate(MEASURE);
    ok(tag.padEnd(22) + ' nothing below the fold, nothing cut through it',
       m.overflow <= 2 && m.sideways <= 2 && !m.below.length && !m.through.length,
       'overflow ' + m.overflow + 'px, below ' + JSON.stringify(m.below.slice(0, 2)) +
       ', through ' + JSON.stringify(m.through.slice(0, 2)));
    const r = await s.page.evaluate(() => ({
      cells: document.querySelectorAll('#rCalCells b').length,
      marked: document.querySelectorAll('#rCalCells b.has').length,
      today: document.querySelectorAll('#rCalCells b.today').length,
      days: document.querySelectorAll('#rDays div').length,
      kinds: document.querySelectorAll('#rKinds .crow').length,
      agents: document.querySelectorAll('#rList .crow').length,
      owns: /more agents below the fold/.test(document.getElementById('rNote').textContent || ''),
      named: (document.getElementById('rDays').textContent || '')
    }));
    /* All four riders, always. A screen that exists to show the four of them
       and quietly drops one is worse than no screen. */
    ok(tag.padEnd(22) + ' all four riders are drawn, and the month is whole',
       r.kinds === 4 && r.cells === 30 && r.marked === 2 && r.today === 1,
       JSON.stringify(r));
    /* And each day says WHICH rider, because "something expires on the 24th"
       is not a call anybody can make. */
    ok(tag.padEnd(22) + ' each day names the rider that ends on it',
       r.days === 2 && /Critical illness/.test(r.named) && /Accidental death/.test(r.named),
       JSON.stringify(r.named.slice(0, 80)));
    ok(tag.padEnd(22) + ' draws ' + r.agents + ' of twelve agent rows' +
       (r.owns ? ', and owns up to the rest' : ''),
       r.agents >= 3 && (r.agents === 12 || r.owns),
       r.agents + ' rows, admits to the remainder: ' + r.owns);
    await s.ctx.close();
  }


  /* ── The rail ─────────────────────────────────────────────────────────────
     Two rows of stops at most, the controls beside them and not underneath,
     and the timer clear of both. */
  console.log('\nThe chrome line, with every stop on it:\n');
  /* IT IS ONE LINE ACROSS THE TOP NOW, AND IT OWNS ITS OWN STRIP. It used to be
     three things stacked over the foot of the slide — the rail, the timer pill
     and the stale-code bar — and the note back was that it was blocking the
     bottom. Moving it to the top was not enough by itself: laid over a slide it
     covered the headline instead, so .stage starts underneath it. Fourteen
     names never fit a line, so the stops are numbers and the name of the one
     you are on is spelled out beside them. */
  for (const [w, h, tag] of [[3840,2160,'4K panel'],[1920,1080,'the branch television'],
                             [1600,900,'1600 x 900'],[1366,768,'a laptop'],[1280,720,'720p']]) {
    const s = await fresh(b, w, h);
    await s.page.goto(`http://localhost:${PORT}/intelligence/wall/all.html?secs=600`, { waitUntil: 'domcontentloaded' });
    await s.page.waitForTimeout(2500);
    const m = await s.page.evaluate(() => {
      const box = el => el.getBoundingClientRect();
      const hits = (a, t) => !(a.right < t.left || a.left > t.right || a.bottom < t.top || a.top > t.bottom);
      const chrome = box(document.getElementById('chrome'));
      const stage = box(document.getElementById('stage'));
      const state = box(document.getElementById('state'));
      const dots = [...document.querySelectorAll('#dots .dot')];
      const phone = window.innerWidth <= 760;
      return {
        stops: dots.length,
        rows: dots.length ? new Set(dots.map(d => Math.round(box(d).top))).size : 1,
        numbersOnly: dots.every(d => /^\d+$/.test(d.textContent.trim())),
        named: dots.every(d => (d.getAttribute('title') || '').length > 2),
        onState: dots.filter(d => hits(box(d), state)).map(d => d.textContent.trim()),
        ctlOnState: hits(box(document.querySelector('.ctl')), state),
        ctlLeftOfDots: dots.length ? box(document.querySelector('.ctl')).left < box(dots[0]).left : true,
        chromeTop: Math.round(chrome.top), chromeH: Math.round(chrome.height),
        stageTop: Math.round(stage.top),
        overflowsLine: document.getElementById('chrome').scrollWidth
                     - document.getElementById('chrome').clientWidth,
        sideways: document.documentElement.scrollWidth - window.innerWidth,
        phone: phone
      };
    });
    ok(tag.padEnd(22) + ' every stop on ONE row', m.rows === 1 && m.stops === PAGES.length,
       m.stops + ' stops on ' + m.rows + ' rows (running order has ' + PAGES.length + ')');
    ok(tag.padEnd(22) + ' the stops are numbers, not names', m.numbersOnly);
    ok(tag.padEnd(22) + '   with the name on the hover', m.named);
    ok(tag.padEnd(22) + ' no stop lands on the position text', !m.onState.length, JSON.stringify(m.onState));
    ok(tag.padEnd(22) + ' nor do Pause and Narrate', !m.ctlOnState);
    ok(tag.padEnd(22) + ' the controls lead the line rather than trail it', m.ctlLeftOfDots);
    ok(tag.padEnd(22) + ' the line is at the top', m.chromeTop === 0, 'top ' + m.chromeTop);
    ok(tag.padEnd(22) + ' the slide starts below it, not under it',
       m.stageTop >= m.chromeH, 'stage ' + m.stageTop + ' vs line ' + m.chromeH);
    ok(tag.padEnd(22) + ' nothing on the line leaves the screen',
       m.overflowsLine === 0 && m.sideways === 0, JSON.stringify(m));
    ok(tag.padEnd(22) + ' no javascript errors', s.errors.length === 0, s.errors.join(' | '));
    await s.ctx.close();
  }

  await b.close();
  server.close();
  console.log(fails ? '\n' + fails + ' FAILED\n' : '\n  all good\n');
  process.exit(fails ? 1 : 0);
})();
