/* Section 8e of QueryPalPatch.gs: the company leaver run, and the guard that
   closes the anonymous GET action=terminate. Code.gs collaborators stubbed,
   same fabric as portal.backend.test.js. */
const fs=require('fs'), path=require('path'), crypto=require('crypto');
const patch=fs.readFileSync(path.join(__dirname,'..','QueryPalPatch.gs'),'utf8');

const cache=new Map(), props=new Map();
global.CacheService={getScriptCache:()=>({get:k=>cache.get(k)??null,put:(k,v)=>cache.set(k,v)})};
global.PropertiesService={getScriptProperties:()=>({getProperty:k=>props.get(k)??null,setProperty:(k,v)=>props.set(k,v)})};
global.Utilities={getUuid:()=>crypto.randomUUID(),
  base64Encode:b=>Buffer.from(b).toString('base64'),
  newBlob:(bytes,mime,name)=>({bytes,mime,name}),
  computeDigest:(_a,s)=>crypto.createHash('sha256').update(s).digest(),
  DigestAlgorithm:{SHA_256:'sha256'},
  formatDate:(d,tz,pat)=>{
    if(pat.includes('HHmmss'))return '2026/0812/101010';
    if(pat==='dd/MM/yyyy'){const p=n=>String(n).padStart(2,'0');
      return p(d.getDate())+'/'+p(d.getMonth()+1)+'/'+d.getFullYear();}
    return '12 Aug 2026';}};
global.Session={getScriptTimeZone:()=>'America/Port_of_Spain'};
global.Logger={log:()=>{}};

function sheet(rows,headers){
  const all=[headers||[],...rows];
  return {getLastRow:()=>all.length,getMaxColumns:()=>29,
    getRange:(r,c,n,w)=>({getValues:()=>all.slice(r-1,r-1+n).map(row=>{
      const o=row.slice(c-1,c-1+(w||1));while(o.length<(w||1))o.push('');return o;})}),
    appendRow:r=>all.push(r),_all:all};
}

let QUERIES,CODES,COMMENTS,sentMail=[],routed=[],OUT=null,AGENTBYCODE=null,TOKENOK=null;
global.SpreadsheetApp={getActiveSpreadsheet:()=>({
  getSheetByName:n=>n==='Queries'?QUERIES:(n==='Client Codes'?CODES:(n==='Comments'?COMMENTS:null))})};
global.MailApp={sendEmail:m=>sentMail.push(m)};

global.SHEET_NAME='Queries';
global.TERM_DEPT_TO=['GIA.TaskRequest@myguardiangroup.com'];
global.TERM_DEPT_NAME='Group Insurance Administration';
global.TERM_TAT_DAYS=5; global.TERM_ASSIGNEE='Sasha Lalla Jagassar';
global.tz_=()=>'America/Port_of_Spain';
global.qpLogoInline_=()=>null;
global.cmtSheet_=()=>COMMENTS;
global.findAgent_=c=>AGENTBYCODE&&c===AGENTBYCODE?{name:'An Agent',code:c}:null;
global.qpAgentFromToken_=t=>TOKENOK&&t===TOKENOK?{name:'An Agent'}:null;
global.resolveClientCode_=code=>{
  const rows=CODES?CODES._all.slice(1):[];
  for(const r of rows) if(String(r[0]).toLowerCase()===String(code||'').toLowerCase())
    return {code:String(r[0]),type:String(r[1]||'individual').toLowerCase(),
            name:String(r[2]||''),scope:String(r[3]||'')};
  return null;};
global.sendRoutedEmail=d=>routed.push(d);
global.json=o=>{OUT=o;return o;};

/* pull the pieces under test out of the patch */
const grab=re=>{const m=patch.match(re); if(!m) throw new Error('not found: '+re); return m[0];};
eval(grab(/var QP_LEAVER_MAX[\s\S]*?\n/).replace(/^var /,'global.').replace(/;[\s\S]*$/,';'));
eval(grab(/var QP_CONVERSION_DAYS[\s\S]*?\n/).replace(/^var /,'global.').replace(/;[\s\S]*$/,';'));
eval(grab(/var QP_BLOCK_GET_TERMINATE = [\s\S]*?;/).replace(/^var /,'global.'));
eval(grab(/var QP_LEAVER_REASONS = \{[\s\S]*?\n\};/).replace(/^var /,'global.'));
eval(['qpRateLimit_','qpGetTerminateOk_','qpDateParse_','qpDaysBetween_','qpFmtDate_',
      'qpLeavers_','qpConversionNotice_','qpEsc_']
  .map(fn=>grab(new RegExp('function '+fn+'\\([\\s\\S]*?\\n\\}'))).join('\n'));

let pass=0,fail=0;
const t=(l,got,want)=>{const ok=JSON.stringify(got)===JSON.stringify(want);
  console.log((ok?'  PASS  ':'  FAIL  ')+l+(ok?'':`\n          got  ${JSON.stringify(got)}\n          want ${JSON.stringify(want)}`));
  ok?pass++:fail++;};
const has=(l,hay,needle)=>t(l,String(hay).indexOf(needle)>-1,true);

function reset(){
  cache.clear(); sentMail=[]; routed=[]; OUT=null; AGENTBYCODE=null; TOKENOK=null;
  CODES=sheet([['CO-ACME','company','Acme Ltd','acme manufacturing'],
               ['IND4471','individual','Tom Sooknanan','tom@x.com']],['Code','Type','Name','Scope']);
  COMMENTS=sheet([],['When','Reference','Author','Role','Comment','Mode']);
  QUERIES=sheet([],['h']);
}
const iso=off=>{const d=new Date();d.setDate(d.getDate()+off);
  const p=n=>String(n).padStart(2,'0');
  return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate());};
const M=(first,last,extra)=>Object.assign(
  {first,last,life:true,health:true,memberEmail:(first+'@acme.com').toLowerCase(),reason:'resignation'},extra||{});

console.log('\n— access control —');
reset();
qpLeavers_({code:'',members:[M('Jane','Ramlogan')],effdate:iso(7)});
t('no code refused', OUT.ok, false);
has('  and says why', OUT.error, 'Company sign-in required');
reset();
qpLeavers_({code:'IND4471',members:[M('Jane','Ramlogan')],effdate:iso(7)});
t('individual code refused — an employee cannot end their colleagues’ cover', OUT.ok, false);
reset();
qpLeavers_({code:'NOPE',members:[M('Jane','Ramlogan')],effdate:iso(7)});
t('unknown code refused', OUT.ok, false);
t('  nothing was emailed to the department', routed.length, 0);
t('  nothing was logged', QUERIES._all.length, 1);

console.log('\n— the GET guard (edit 10) —');
reset();
t('flag is armed by default', QP_BLOCK_GET_TERMINATE, true);
t('anonymous call refused', qpGetTerminateOk_({}), false);
t('empty code refused', qpGetTerminateOk_({code:''}), false);
t('junk code refused', qpGetTerminateOk_({code:'GUESS123'}), false);
t('individual code refused', qpGetTerminateOk_({code:'IND4471'}), false);
t('company code accepted', qpGetTerminateOk_({code:'CO-ACME'}), true);
AGENTBYCODE='AG-77';
t('agent code accepted', qpGetTerminateOk_({code:'AG-77'}), true);
TOKENOK='tok-abc';
t('agent session token accepted', qpGetTerminateOk_({token:'tok-abc'}), true);
t('wrong token refused', qpGetTerminateOk_({token:'tok-xyz'}), false);

console.log('\n— death in service is not a leaver —');
reset();
qpLeavers_({code:'CO-ACME',members:[M('Jane','Ramlogan',{reason:'death'})],effdate:iso(7)});
t('refused', OUT.ok, false);
has('  points at Claims', OUT.error, 'Claims');
t('  nothing routed to the termination queue', routed.length, 0);
t('  no conversion notice sent to the deceased', sentMail.length, 0);
t('death is absent from the reason list', QP_LEAVER_REASONS.death, undefined);
reset();
qpLeavers_({code:'CO-ACME',members:[M('Jane','R',{reason:'death'}),M('Ravi','P')],effdate:iso(7)});
t('the rest of the batch still goes through', OUT.ok, true);
t('  one submitted', OUT.count, 1);
t('  one reported back as a problem', OUT.errors.length, 1);

console.log('\n— a normal leaver run —');
reset();
qpLeavers_({code:'CO-ACME',effdate:iso(14),note:'End of the contract cycle.',
  members:[M('Jane','Ramlogan'),M('Ravi','Persad'),M('Kim','Boodoo',{memberEmail:''})]});
t('ok', OUT.ok, true);
t('three submitted', OUT.count, 3);
t('three routed to the department', routed.length, 3);
t('three cases logged', QUERIES._all.length-1, 3);
t('three trail comments', COMMENTS._all.length-1, 3);
t('references are unique', new Set(OUT.results.map(r=>r.ref)).size, 3);
has('  reference marks it a termination', OUT.results[0].ref, '/TERM');
t('conversion notices only to those with an email', sentMail.length, 2);
t('  and the run reports who was notified', OUT.results.map(r=>r.noticeSent), [true,true,false]);
t('routed to Group Insurance Administration', routed[0].department, 'Group Insurance Administration');
t('assigned', routed[0].assignedStaff, 'Sasha Lalla Jagassar');
t('category', routed[0].category, 'Group Terminations');
t('priority normal for a future date', routed[0].priority, 'Normal');
has('  the company is named as the source', routed[0].description, 'Acme Ltd');
has('  the reason is stated', routed[0].description, 'Resignation');
has('  the note is carried', routed[0].description, 'End of the contract cycle.');
t('logged under the company scope so it shows in their portal', QUERIES._all[1][7], 'acme manufacturing');
t('  status open', QUERIES._all[1][3], 'Open');
t('  category column', QUERIES._all[1][11], 'Group Terminations');

console.log('\n— the conversion notice —');
t('goes to the member', sentMail[0].to, 'jane@acme.com');
has('  subject is about their cover ending', sentMail[0].subject, 'cover is ending');
has('  names the company', sentMail[0].htmlBody, 'Acme Ltd');
has('  states the window', sentMail[0].htmlBody, String(QP_CONVERSION_DAYS)+' days');
has('  says no new medical questions', sentMail[0].htmlBody, 'without new medical questions');
has('  mentions claims incurred before the end', sentMail[0].htmlBody, 'before');
has('  makes clear it is not a bill', sentMail[0].htmlBody, 'request for payment');
reset();
qpLeavers_({code:'CO-ACME',effdate:iso(7),members:[M('A<b>','X&Co')]});
has('member name is escaped in the notice', sentMail[0].htmlBody, '&lt;b&gt;');

console.log('\n— backdating —');
reset();
qpLeavers_({code:'CO-ACME',effdate:iso(-45),members:[M('Jane','Ramlogan')]});
t('accepted', OUT.ok, true);
t('  flagged on the result', OUT.results[0].backdated, true);
t('  raised to high priority', routed[0].priority, 'High');
has('  warns the department', routed[0].description, 'BACKDATED');
has('  says how far back', routed[0].description, '45 day');
has('  asks about premium collected past it', routed[0].description, 'premium already collected');
has('  asks about claims paid after it', routed[0].description, 'claim');
t('  sheet priority follows', QUERIES._all[1][16], 'High');
reset();
qpLeavers_({code:'CO-ACME',effdate:iso(0),members:[M('Jane','Ramlogan')]});
t('today is not backdated', OUT.results[0].backdated, false);
t('  stays normal priority', routed[0].priority, 'Normal');

console.log('\n— validation —');
reset();
qpLeavers_({code:'CO-ACME',members:[],effdate:iso(7)});
t('empty member list refused', OUT.ok, false);
reset();
qpLeavers_({code:'CO-ACME',effdate:iso(7),
  members:Array.from({length:QP_LEAVER_MAX+1},(_,i)=>M('P'+i,'Q'+i))});
t('over the cap refused', OUT.ok, false);
has('  says the cap', OUT.error, String(QP_LEAVER_MAX));
t('  nothing sent', routed.length, 0);
reset();
qpLeavers_({code:'CO-ACME',effdate:iso(7),members:[M('Jane','R',{life:false,health:false})]});
t('no cover chosen refused', OUT.ok, false);
reset();
qpLeavers_({code:'CO-ACME',members:[M('Jane','R')]});
t('missing date refused', OUT.ok, false);
reset();
qpLeavers_({code:'CO-ACME',effdate:'not-a-date',members:[M('Jane','R')]});
t('unparseable date refused', OUT.ok, false);
reset();
qpLeavers_({code:'CO-ACME',effdate:iso(7),members:[M('','')]});
t('nameless row refused', OUT.ok, false);
reset();
qpLeavers_({code:'CO-ACME',effdate:iso(7),
  members:[M('Jane','R'),M('Ravi','P',{life:false,health:false})]});
t('one bad row does not sink the batch', OUT.count, 1);
t('  and the problem is reported back', OUT.errors.length, 1);

console.log('\n— per-member overrides —');
reset();
qpLeavers_({code:'CO-ACME',effdate:iso(30),
  members:[M('Jane','R',{effdate:iso(3)}),M('Ravi','P')]});
t('a member can leave on their own date', OUT.results[0].effective!==OUT.results[1].effective, true);
reset();
qpLeavers_({code:'CO-ACME',effdate:iso(7),members:[M('Jane','R',{health:false})]});
t('life only', OUT.results[0].plans, 'Group Life');
has('  and the subject says so', routed[0].subject, 'Group Life Termination');
reset();
qpLeavers_({code:'CO-ACME',effdate:iso(7),members:[M('Jane','R',{life:false})]});
t('health only', OUT.results[0].plans, 'Group Health');

console.log('\n— dates —');
t('ISO parsed', qpFmtDate_(qpDateParse_('2026-03-09')), '09/03/2026');
t('dd/mm/yyyy parsed (the agent path format)', qpFmtDate_(qpDateParse_('09/03/2026')), '09/03/2026');
t('rubbish rejected', qpDateParse_('tomorrow-ish'), null);
t('empty rejected', qpDateParse_(''), null);

console.log('\n— rate limiting —');
reset();
for(let i=0;i<10;i++) qpLeavers_({code:'CO-ACME',effdate:iso(7),members:[M('P'+i,'Q'+i)]});
t('tenth still allowed', OUT.ok, true);
qpLeavers_({code:'CO-ACME',effdate:iso(7),members:[M('One','More')]});
t('eleventh throttled', OUT.ok, false);
has('  and says so', OUT.error, 'Too many');

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
