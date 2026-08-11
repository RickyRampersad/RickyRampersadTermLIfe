/* wallStats_ aggregation, with the Spreadsheet/Cache/Utilities services stubbed
   and a seeded sheet. Verifies the numbers the wall panels are drawn from. */
const _fs = require('fs'), _p = require('path');
const _gs = _p.join(__dirname, '..', 'QueryPal_Backend_v10.gs');
if (!_fs.existsSync(_gs)) {
  console.log('  SKIPPED — needs QueryPal_Backend_v10.gs in querypal/.');
  console.log('  The archive this repo started from carried v6.9; production runs v10.2.');
  console.log('  Export the live script from the Apps Script editor to run this suite.');
  process.exit(0);
}

const fs=require('fs'), path=require('path'), crypto=require('crypto');
const gs=fs.readFileSync(path.join(__dirname,'..','QueryPal_Backend_v10.gs'),'utf8');

const TZ='America/Port_of_Spain';
let SHEET=[];
global.SpreadsheetApp={getActiveSpreadsheet:()=>({getSheetByName:()=>({
  getLastRow:()=>SHEET.length+1, getLastColumn:()=>27,
  getRange:(r,c,n,w)=>({getValues:()=>SHEET.slice(r-2,r-2+n).map(row=>row.slice(c-1,c-1+w))})
})})};
global.Session={getScriptTimeZone:()=>TZ};
global.Utilities={formatDate:()=>'1 Jan 2026 · 9:00 AM',
  getUuid:()=>crypto.randomUUID(),
  base64Encode:b=>Buffer.from(b).toString('base64'),
  computeDigest:(_a,s)=>crypto.createHash('sha256').update(s).digest(),
  DigestAlgorithm:{SHA_256:'sha256'}};
const cache=new Map();
global.CacheService={getScriptCache:()=>({get:k=>cache.get(k)??null,put:(k,v)=>cache.set(k,v)})};
global.PropertiesService={getScriptProperties:()=>({getProperty:()=>null,setProperty:()=>{}})};
let OUT=null;
global.json=o=>{OUT=o;return o;};

const take=re=>gs.match(re)[0].replace(/^const /,'var ');
eval(take(/const SHEET_NAME   = [^\n]*/));
eval(take(/const REQUIRE_AGENT_PASSWORD = [^\n]*/));
eval(take(/const AGENT_MANAGER = \{[\s\S]*?\n\};/));
eval(['normName_','roleWord_','deadlineAt_','scopeKeys_','wallStats_','agentFromToken_','findAgent_']
  .map(fn=>{const m=gs.match(new RegExp('function '+fn+'\\([\\s\\S]*?\\n\\}'));return m?m[0]:'';})
  .filter(Boolean).join('\n'));
// stand in for the code lookup so the test does not depend on the agent tables
findAgent_ = code => code ? { code, name:'Branch', email:'', role:'branch', cells:['Branch'] } : null;
agentFromToken_ = () => null;
codeRows_ = () => []; codeTable_ = () => [];

let pass=0, fail=0;
const t=(label,got,want)=>{const ok=JSON.stringify(got)===JSON.stringify(want);
  console.log((ok?'  PASS  ':'  FAIL  ')+label+(ok?'':`\n          got  ${JSON.stringify(got)}\n          want ${JSON.stringify(want)}`));
  ok?pass++:fail++;};

const ago=d=>new Date(Date.now()-d*86400000);
// [ref,run,ts,status,by,client,email,phone,policy,agent,aMail,cat,type,dept,dMail,tat,pri,subj,desc,cc,closed,days,fu,lastfu,survey,score,fb]
const row=(o)=>{const r=new Array(27).fill('');
  r[0]=o.ref; r[2]=o.ts; r[3]=o.status; r[5]='Client'; r[9]=o.agent; r[10]='';
  r[12]=o.type; r[13]=o.dept; r[15]=String(o.tat); r[21]=o.days===undefined?'':o.days;
  r[22]=o.fu||0; r[25]=o.score||0; r[26]=o.fb||''; return r;};

SHEET=[
  row({ref:'A1',ts:ago(3), status:'Closed', agent:'Aidan', dept:'Chaguanas', type:'Bounce Cheque', tat:5,  days:2, score:5, fu:0, fb:'Very fast, thank you'}),
  row({ref:'A2',ts:ago(5), status:'Closed', agent:'Aidan', dept:'Chaguanas', type:'Bounce Cheque', tat:5,  days:4, score:4, fu:0}),
  row({ref:'A3',ts:ago(9), status:'Closed', agent:'Aidan', dept:'Claims',    type:'Surrenders',    tat:10, days:6, score:5, fu:1}),
  row({ref:'G1',ts:ago(20),status:'Closed', agent:'Gary',  dept:'Chaguanas', type:'Bounce Cheque', tat:5,  days:9, score:2, fu:2, fb:'Took too long'}),
  row({ref:'G2',ts:ago(25),status:'Closed', agent:'Gary',  dept:'Claims',    type:'Surrenders',    tat:10, days:14,score:3, fu:3}),
  row({ref:'G3',ts:ago(60),status:'Open',   agent:'Gary',  dept:'Claims',    type:'Surrenders',    tat:1,  fu:4}),   // long overdue
  row({ref:'N1',ts:ago(0), status:'Open',   agent:'Neil',  dept:'Premium',   type:'Bounce Cheque', tat:5,  fu:0}),   // on track
  row({ref:'N2',ts:ago(4), status:'In Progress', agent:'Neil', dept:'Premium', type:'Bounce Cheque', tat:5, fu:1}),  // due soon-ish
  row({ref:'N3',ts:ago(100),status:'Open',  agent:'Neil',  dept:'Premium',   type:'Embassy letters',tat:1,  fu:2}),  // overdue, outside 90d
];

wallStats_('BRANCH','',0); let d=OUT;
t('all rows counted', d.totals.total, 9);
t('open vs resolved', [d.totals.open, d.totals.done], [4, 5]);
t('on-time = 3 of 5 closed', d.totals.onTime, 60);
t('average close', d.totals.avg, 7);
t('client rating averaged', d.totals.csat, 3.8);
t('ratings counted', d.totals.rated, 5);
t('auto follow-ups summed', d.totals.chased, 13);
t('overdue matches the ageing panel', d.totals.overdue, d.age.late);
t('ageing buckets add up to open', d.age.ok + d.age.soon + d.age.late, d.totals.open);
t('two are past deadline', d.age.late, 2);
t('12 week buckets returned', d.weeks.length, 12);
t('newest bucket is last (4 rows fall in the current week)', d.weeks[11], 4);
t('rating distribution', [d.scoreDist[5], d.scoreDist[4], d.scoreDist[3], d.scoreDist[2]], [2,1,1,1]);
t('feedback quotes captured', d.notes.map(n=>n.text), ['Very fast, thank you','Took too long']);

const dept=Object.fromEntries(d.depts.map(x=>[x.name,x]));
// Claims and Chaguanas tie on 3, so assert the counts rather than a tie-break order
t('departments ranked by volume', d.depts.map(x=>x.name+':'+x.n).sort(),
  ['Chaguanas:3','Claims:3','Premium:3'].sort());
t('busiest department first', d.depts[0].n >= d.depts[d.depts.length-1].n, true);
t('Chaguanas: 3 in, 3 closed, 2 on time', [dept.Chaguanas.n, dept.Chaguanas.done, dept.Chaguanas.onTime], [3,3,67]);
t('Claims carries the overdue one', dept.Claims.late, 1);
t('Premium has nothing closed yet', dept.Premium.onTime, null);

const ag=Object.fromEntries(d.agents.map(x=>[x.name,x]));
t('Aidan is 100% on time', ag.Aidan.onTime, 100);
t('Gary is 0% on time', ag.Gary.onTime, 0);
t('Neil has no closed work', [ag.Neil.n, ag.Neil.done, ag.Neil.onTime], [3,0,null]);
t('per-agent rating', ag.Aidan.csat, 4.7);

t('request mix ranked', d.types.map(x=>x.name+':'+x.n), ['Bounce Cheque:5','Surrenders:3','Embassy letters:1']);

// time window
wallStats_('BRANCH','',7); const w7=OUT;
t('7-day window narrows the set', w7.totals.total, 4);
t('window is reported back', w7.days, 7);
wallStats_('BRANCH','',90); const w90=OUT;
t('90-day window excludes the 100-day row', w90.totals.total, 8);

// no rows in range
SHEET=[]; wallStats_('BRANCH','',0);
t('empty sheet handled', OUT.empty, true);

// unauthenticated
SHEET=[row({ref:'X',ts:ago(1),status:'Open',agent:'A',dept:'D',type:'T',tat:5})];
wallStats_('','',0);
t('no code, no data', OUT.ok, false);

// aggregates only — no client detail should ever leave
wallStats_('BRANCH','',0);
t('payload carries no client names or references',
  /Client|A1|G1|N1/.test(JSON.stringify(OUT)), false);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
