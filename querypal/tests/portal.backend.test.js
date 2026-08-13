/* Section 8 of QueryPalPatch.gs: request-a-code, enrollment, client history,
   client stats. Code.gs collaborators stubbed with realistic behaviour. */
const fs=require('fs'), path=require('path'), crypto=require('crypto');
const patch=fs.readFileSync(path.join(__dirname,'..','QueryPalPatch.gs'),'utf8');

const cache=new Map(), props=new Map();
global.CacheService={getScriptCache:()=>({get:k=>cache.get(k)??null,put:(k,v)=>cache.set(k,v)})};
global.PropertiesService={getScriptProperties:()=>({getProperty:k=>props.get(k)??null,setProperty:(k,v)=>props.set(k,v)})};
global.Utilities={getUuid:()=>crypto.randomUUID(),
  base64Encode:b=>Buffer.from(b).toString('base64'),
  base64Decode:s=>{if(!/^[A-Za-z0-9+/]*={0,2}$/.test(s))throw 0;return Buffer.from(s,'base64');},
  newBlob:(bytes,mime,name)=>({bytes,mime,name}),
  computeDigest:(_a,s)=>crypto.createHash('sha256').update(s).digest(),
  DigestAlgorithm:{SHA_256:'sha256'},
  formatDate:(d,tz,pat)=>pat.includes('HHmmss')?'2026/0812/101010':(pat.includes('h:mm')?'12 Aug · 10:00 AM':'12 Aug 2026')};
global.Session={getScriptTimeZone:()=>'America/Port_of_Spain'};
global.Logger={log:()=>{}};

// sheet fabric
function sheet(rows, headers){
  const all=[headers||[], ...rows];
  return {
    getLastRow:()=>all.length, getLastColumn:()=>Math.max(4,(all[0]||[]).length), getMaxColumns:()=>29,
    getRange:(r,c,n,w)=>({
      getValues:()=>all.slice(r-1,r-1+n).map(row=>{const o=row.slice(c-1,c-1+(w||1));while(o.length<(w||1))o.push('');return o;}),
      setValues:()=>({setFontWeight:()=>({setBackground:()=>({setFontColor:()=>({})})})})}),
    setFrozenRows:()=>{}, appendRow:r=>all.push(r), _all:all };
}
const ago=d=>new Date(Date.now()-d*864e5);
const qrow=o=>{const r=new Array(29).fill('');
  r[0]=o.ref;r[2]=o.ts||ago(5);r[3]=o.status||'Open';r[5]=o.client||'';r[6]=o.email||'';r[7]=o.company||'';
  r[13]=o.dept||'GIA';r[15]=o.tat||'5';r[20]=o.closedAt||'';r[21]=o.days??'';r[22]=o.fu||0;r[23]=o.lastFu||'';
  r[25]=o.score||0;r[27]=o.replied||'';return r;};

let QUERIES, CODES, COMMENTS, GROUP, sentMail=[];
global.SpreadsheetApp={getActiveSpreadsheet:()=>({
  getSheetByName:n=>n==='Queries'?QUERIES:(n==='Client Codes'?CODES:(n==='Comments'?COMMENTS:(n==='Group Clients 1'?GROUP:null))),
  insertSheet:n=>{const s=sheet([],['Code','Type','Name','Scope Value']);if(n==='Client Codes')CODES=s;return s;}})};
global.MailApp={sendEmail:m=>sentMail.push(m)};

// Code.gs collaborators
global.SHEET_NAME='Queries'; global.CLIENT_CODES_TAB='Client Codes';
global.TEST_MODE=false; global.TEST_EMAIL='t@t.t';
global.BRANCH_SUPPORT='support@rickyrampersadbranch.com';
global.TERM_DEPT_TO=['GIA.TaskRequest@myguardiangroup.com','Ricardo.Seereeram@myguardiangroup.com'];
global.TERM_DEPT_NAME='Group Insurance Administration'; global.TERM_TAT_DAYS=5;
global.TERM_ASSIGNEE='Sasha Lalla Jagassar';
global.DEFAULT_MANAGER='ricky.rampersad@myguardiangroup.com'; global.AGENT_MANAGER={};
global.AGENT_ACCESS={};
global.esc=s=>String(s==null?'':s).replace(/&/g,'&amp;').replace(/</g,'&lt;');
global.tz_=()=>'America/Port_of_Spain';
global.badgeHeader_=()=>'<hdr>'; global.badgeFooter_=()=>'</hdr>'; global.qpLogoInline_=()=>null;
global.normName_=s=>String(s||'').toLowerCase().replace(/[^a-z]/g,'');
global.roleWord_=()=>null; global.codeTable_=()=>[]; global.findAgent_=()=>null;
global.deadlineAt_=(s,t)=>{const n=parseInt(t)||5;const d=new Date(s.getTime());let a=0;
  while(a<n){d.setDate(d.getDate()+1);const w=d.getDay();if(w!==0&&w!==6)a++;}return d;};
global.gcSheet_=()=>GROUP;
global.gcIdx_=()=>({code:0,rtype:1,name:2,pol:3,email:4,agentName:5,agentEmail:6});
global.cmtSheet_=()=>COMMENTS;
global.resolveClientCode_=code=>{
  const rows=CODES?CODES._all.slice(1):[];
  for(const r of rows) if(String(r[0]).toLowerCase()===String(code||'').toLowerCase())
    return {code:String(r[0]),type:String(r[1]||'individual').toLowerCase(),name:String(r[2]||''),scope:String(r[3]||'')};
  return null;};
global.clientCases_=e=>{
  const c=resolveClientCode_(e.parameter.code); const out=[];
  if(c) for(const r of QUERIES._all.slice(1)){
    if(!r[0])continue;
    const sc=c.scope.toLowerCase();
    const hit=v=>v&&v.length>=4&&(v===sc||v.indexOf(sc)>-1||sc.indexOf(v)>-1);
    const m=c.type==='company'?(hit(String(r[7]||'').toLowerCase())||hit(String(r[5]||'').toLowerCase()))
                              :String(r[6]||'').toLowerCase()===sc;
    if(m)out.push({ref:String(r[0])});
  }
  return {getContent:()=>JSON.stringify({ok:true,cases:out})};};
let routed=[]; global.sendRoutedEmail=d=>routed.push(d);
let OUT=null; global.json=o=>{OUT=o;return o;};

const take=re=>patch.match(re)[0].replace(/^const /gm,'var ');
eval(take(/const QP_MANAGER_ALIAS[\s\S]*?\n\};/));
eval(['qpRateLimit_','qpClientCodesSheet_','qpRequestCode_','qpSendCodeEmail_','qpEnroll_','qpClientHistory_','qpClientStats_']
  .map(fn=>patch.match(new RegExp('function '+fn+'\\([\\s\\S]*?\\n\\}'))[0]).join('\n'));

let pass=0,fail=0;
const t=(l,got,want)=>{const ok=JSON.stringify(got)===JSON.stringify(want);
  console.log((ok?'  PASS  ':'  FAIL  ')+l+(ok?'':`\n          got  ${JSON.stringify(got)}\n          want ${JSON.stringify(want)}`)); ok?pass++:fail++;};

function reset(){
  cache.clear(); sentMail=[]; routed=[]; OUT=null;
  CODES=sheet([['CO-ACME','company','Acme Ltd','acme manufacturing'],
               ['IND4471','individual','Tom Sooknanan','tom@x.com']],['Code','Type','Name','Scope Value']);
  GROUP=sheet([['acme manufacturing','LIFE(GROUP)','Jane Ramlogan','GL-1','jane@acme.com','',''],
               ['acme manufacturing','HEALTH (GROUP)','Ravi Persad','GH-2','ravi@acme.com','','']],
              ['Account Name','Record Type','Contact: Full Name','POLICY #','Email','AGENT: Full Name','Agent Email']);
  COMMENTS=sheet([[ago(3),'RRB/2026/101/Jane','Sasha','staff','internal-only note about the client','internal'],
                  [ago(2),'RRB/2026/101/Jane','Branch Desk','staff','We have escalated this for you','trail'],
                  [ago(1),'RRB/2026/101/Jane','Acme Ltd (Company)','client','Please expedite','trail']],
                 ['When','Reference','Author','Role','Comment','Mode']);
  QUERIES=sheet([
    qrow({ref:'RRB/2026/101/Jane', company:'acme manufacturing', client:'Jane Ramlogan', email:'jane@acme.com',
          ts:ago(6), fu:2, lastFu:ago(2), replied:ago(1), tat:'5'}),
    qrow({ref:'RRB/2026/090/Tom', company:'acme manufacturing', client:'Tom Sooknanan', email:'tom@x.com',
          ts:ago(12), status:'Closed', closedAt:ago(8), days:4, score:5, replied:ago(9), tat:'5'}),
    qrow({ref:'RRB/2026/044/Meera', company:'other co', client:'Meera', email:'meera@other.com', ts:ago(4)}),
  ],['h']);
}

// ── request a code ──
reset();
qpRequestCode_({parameter:{email:'tom@x.com'}});
t('existing code is resent, not duplicated', sentMail.length, 1);
t('  goes only to the email on file', sentMail[0].to, 'tom@x.com');
t('  contains the existing code', sentMail[0].body.includes('IND4471'), true);
t('  neutral reply', OUT.msg.includes('on its way'), true);

reset();
qpRequestCode_({parameter:{email:'jane@acme.com'}});
t('roster email gets a new code issued', sentMail.length, 1);
const issued=CODES._all[CODES._all.length-1];
t('  new row appended to Client Codes', [issued[1],issued[2],issued[3]], ['individual','Jane Ramlogan','jane@acme.com']);
t('  code shape IND####', /^IND\d{4}$/.test(issued[0]), true);

reset();
qpRequestCode_({parameter:{email:'stranger@nowhere.com'}});
t('unknown email: no mail sent', sentMail.length, 0);
t('  but the SAME neutral reply (no probing)', OUT.msg.includes('on its way'), true);
t('invalid email rejected', (qpRequestCode_({parameter:{email:'not-an-email'}}), OUT.ok), false);
reset();
for(let i=0;i<5;i++) qpRequestCode_({parameter:{email:'tom@x.com'}});
t('per-email rate limit: 3 sends max', sentMail.length, 3);

// ── enrollment ──
reset();
qpEnroll_({code:'IND4471', first:'A', last:'B', effdate:'2026-09-01', life:true});
t('individual code cannot enroll', OUT.ok, false);
reset();
qpEnroll_({code:'CO-ACME', first:'Jane', last:'Ramlogan', effdate:'', life:true});
t('missing effective date refused', OUT.ok, false);
reset();
qpEnroll_({code:'CO-ACME', first:'Jane', last:'Ramlogan', dob:'1990-05-04', memberEmail:'jane.r@acme.com',
           life:true, health:true, lifepol:'GL-5501', effdate:'2026-09-01', note:'Starts Monday',
           files:[{name:'Enroll_Jane.pdf', mime:'application/pdf', data:Buffer.from('x').toString('base64')}]});
t('enrollment accepted with a reference', [OUT.ok, /\/ENRL$/.test(OUT.ref)], [true, true]);
t('  routed to GIA', routed[0].departmentEmail, 'GIA.TaskRequest@myguardiangroup.com,Ricardo.Seereeram@myguardiangroup.com');
t('  files pass through to the routed email', routed[0].files.length, 1);
t('  assigned to the digital desk', routed[0].assignedStaff, 'Sasha Lalla Jagassar');
const logged=QUERIES._all[QUERIES._all.length-1];
t('  case logged under the company scope', logged[7], 'acme manufacturing');
t('  case type', logged[12], 'Group Life & Group Health Enrollment');
t('  NOT marked TERM (no conversion reminders)', logged[16], 'Normal');
t('  trail comment written', COMMENTS._all[COMMENTS._all.length-1][4].includes('Enrollment submitted'), true);

// ── client history ──
reset();
qpClientHistory_({parameter:{code:'CO-ACME', ref:'RRB/2026/101/Jane'}});
t('history returns items', OUT.ok, true);
const texts=OUT.items.map(i=>i.text).join(' | ');
t('  milestones present', texts.includes('Request logged') && texts.includes('The department responded'), true);
t('  follow-ups shown in client language', texts.includes('followed up with the department'), true);
t('  trail + client comments included', texts.includes('We have escalated this for you') && texts.includes('Please expedite'), true);
t('  INTERNAL notes never leak', texts.includes('internal-only'), false);
reset();
qpClientHistory_({parameter:{code:'CO-ACME', ref:'RRB/2026/044/Meera'}});
t('another company\'s case is refused', OUT.ok, false);
reset();
qpClientHistory_({parameter:{code:'NOPE', ref:'RRB/2026/101/Jane'}});
t('bad code refused', OUT.ok, false);

// ── client stats ──
reset();
qpClientStats_({parameter:{code:'CO-ACME'}});
t('stats scoped to the company: 2 of 3 rows', OUT.total, 2);
t('  resolution rate 1/2', OUT.resolutionRate, 50);
t('  response rate 2/2 (one replied, one closed)', OUT.responseRate, 100);
t('  avg close from the closed case', OUT.avgClose, 4);
t('  on-time 100% (4d vs 5d TAT)', OUT.onTime, 100);
reset();
qpClientStats_({parameter:{code:'IND4471'}});
t('individual scoped by email: 1 case', OUT.total, 1);
t('bad code refused for stats', (qpClientStats_({parameter:{code:'NOPE'}}), OUT.ok), false);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
