/* QueryPalPatch.gs — routing, attachments, manager lookup, passwords, tokens.
   Apps Script services stubbed; AGENT_ACCESS / AGENT_MANAGER read from the
   real v10.2 values pasted into fixtures below. */
const fs = require('fs'), path = require('path'), crypto = require('crypto');
const patch = fs.readFileSync(path.join(__dirname, '..', 'QueryPalPatch.gs'), 'utf8');

const cache = new Map(), props = new Map();
global.CacheService = { getScriptCache: () => ({ get: k => cache.get(k) ?? null, put: (k,v) => cache.set(k,v) }) };
global.PropertiesService = { getScriptProperties: () => ({ getProperty: k => props.get(k) ?? null, setProperty: (k,v) => props.set(k,v) }) };
global.Utilities = {
  getUuid: () => crypto.randomUUID(),
  base64Encode: b => Buffer.from(b).toString('base64'),
  base64Decode: s => { if (!/^[A-Za-z0-9+/]*={0,2}$/.test(s)) throw new Error('bad base64'); return Buffer.from(s,'base64'); },
  newBlob: (bytes, mime, name) => ({ bytes, mime, name }),
  computeDigest: (_a,s) => crypto.createHash('sha256').update(s).digest(),
  DigestAlgorithm: { SHA_256: 'sha256' }
};
global.Logger = { log: () => {} };

// --- real tables from the live v10.2 script ---
global.DEFAULT_MANAGER = 'ricky.rampersad@myguardiangroup.com';
global.AGENT_MANAGER = {
  "john boodhoo":"gary.sookdeo@myguardiangroup.com","chris badaloo":"gary.sookdeo@myguardiangroup.com",
  "naila samuel":"gary.sookdeo@myguardiangroup.com","felicia rampersad":"gary.sookdeo@myguardiangroup.com",
  "gary sookdeo":"gary.sookdeo@myguardiangroup.com","tricia baksh":"gary.sookdeo@myguardiangroup.com",
  "alyssa joseph":"gary.sookdeo@myguardiangroup.com","jesus boodhoo":"gary.sookdeo@myguardiangroup.com",
  "anthony simmons":"kerwyn.ramroach@myguardiangroup.com","dhalina heeraman":"kerwyn.ramroach@myguardiangroup.com",
  "aidan eugene":"kerwyn.ramroach@myguardiangroup.com","kerwyn ramroach":"kerwyn.ramroach@myguardiangroup.com",
  "crystal fraser":"kerwyn.ramroach@myguardiangroup.com","aleema mohammed ali":"ricky.rampersad@myguardiangroup.com",
  "premchand dookran":"ricky.rampersad@myguardiangroup.com","joy barbara sammah":"ricky.rampersad@myguardiangroup.com",
  "narissa mohammed":"ricky.rampersad@myguardiangroup.com","faizal mohamed":"ricky.rampersad@myguardiangroup.com",
  "javid ali":"ricky.rampersad@myguardiangroup.com","ricky rampersad":"ricky.rampersad@myguardiangroup.com",
  "meera persad khan":"ricky.rampersad@myguardiangroup.com","randolph gonzales":"ricky.rampersad@myguardiangroup.com",
  "neil ramnanan":"ricky.rampersad@myguardiangroup.com","varun seegolam":"ricky.rampersad@myguardiangroup.com",
  "jamil khan":"ricky.rampersad@myguardiangroup.com","darryl manick":"Akaash.Kalladeen@myguardiangroup.com",
  "stephanie rajkumar":"Akaash.Kalladeen@myguardiangroup.com","akaash kalladeen":"Akaash.Kalladeen@myguardiangroup.com",
  "malcolm sooknanan":"Akaash.Kalladeen@myguardiangroup.com","fawwaz mohamed":"Akaash.Kalladeen@myguardiangroup.com",
  "daniel bhagwandas":"Akaash.Kalladeen@myguardiangroup.com"
};
global.AGENT_ACCESS = {
  '260026':['Ricky Rampersad','ricky.rampersad@myguardiangroup.com','branch'],'RRB2026':['Rampersad Branch','','branch'],
  'AE101':["Aidan Eugene",""],'AJ102':["Alyssa Joseph",""],'AK103':["Akaash Kalladeen",""],'AS104':["Anthony Simmons",""],
  'CB105':["Chris Badaloo",""],'CF106':["Crystal Fraser",""],'DB107':["Daniel Bhagwandas",""],'DM108':["Darryl Manick",""],
  'DH109':["Dhalina Heeraman",""],'DL110':["Diane Lutchman statham",""],'FM111':["Faizal Mohammed",""],
  'FM112':["Fawwaz Mohamed",""],'FR113':["Felicia Rampersad2",""],'GK114':["Ganesh Khodai",""],'GS115':["Gary Sookdeo",""],
  'JB116':["Jesus Boodhoo",""],'JP117':["Jonathan Pantin",""],'JP118':["Janice Phillip",""],'JK119':["Jamil Khan",""],
  'JB120':["John Boodoo",""],'JS121':["Joy Sammah",""],'KD122':["Kamla Dookran",""],'KR123':["Kerwyn Ramroach",""],
  'MS124':["Malcolm Sooknanan",""],'MP125':["Meera Persad khan",""],'NS126':["Naila Samuel",""],'NM127':["Narissa Mohammed",""],
  'NR128':["Neil Ramnanan",""],'PD129':["Premchand Dookran",""],'RG130':["Randolph Gonzales",""],'RL131':["Roberta Laltoo",""],
  'SR132':["Stephanie Rajkumar",""],'TB133':["Tricia Baksh",""],'VS134':["Varun Seegolam",""]
};
eval(patch.replace(/^const /gm, 'var '));

let pass = 0, fail = 0;
const t = (l, got, want) => { const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log((ok?'  PASS  ':'  FAIL  ')+l+(ok?'':`\n          got  ${JSON.stringify(got)}\n          want ${JSON.stringify(want)}`)); ok?pass++:fail++; };

// routing
t('60 routes loaded', Object.keys(QP_ROUTES).length, 60);
t('Bounce Cheque -> Premium Query', qpRouteFor_('Bounce Cheque').email, 'gloc.premiumquery@myguardiangroup.com');
t('new type: Quote - Life Insurance routes', qpRouteFor_('Quote - Life Insurance').email, 'rickyrampersadsalessupport@myguardiangroup.com');
t('Statements goes to GLOC Customer Service (branch decision, 18 Aug)', qpRouteFor_('Statements – tax and csv').email, 'gloccustomerservicechaguanassrsc@myguardiangroup.com');
t('Motor claim department has a name', qpRouteFor_('Motor or Home Claim - Follow-up').dept, 'GGIL P&C Claims');
t('turnaround from the catalog', qpRouteFor_('Surrenders').tat, '10 days');
t('single day reads naturally', qpRouteFor_('Embassy letters').tat, '1 day');
t('case drift tolerated', qpRouteFor_('bounce cheque').email, 'gloc.premiumquery@myguardiangroup.com');
t('unknown type refused', qpRouteFor_('Pay attacker@evil.com'), null);
t('group terminations pass through untouched', qpRouteFor_('Group Life & Health Termination'), null);

const d1 = { queryType:'Surrenders', departmentEmail:'attacker@evil.com', department:'Evil', turnaround:'99 days', category:'x' };
t('apply overwrites a spoofed department', [qpApplyRoute_(d1), d1.departmentEmail],
  [true, 'gloccustomerservicechaguanassrsc@myguardiangroup.com']);
t('  and the turnaround', d1.turnaround, '10 days');
t('  and the category', d1.category, 'My Money & Payouts');
const d2 = { queryType:'Group Life Termination', departmentEmail:'GIA.TaskRequest@myguardiangroup.com' };
t('termination keeps its own department', [qpApplyRoute_(d2), d2.departmentEmail],
  [true, 'GIA.TaskRequest@myguardiangroup.com']);
t('unroutable type is rejected', qpApplyRoute_({ queryType:'Nonsense' }), false);

// attachments
const b64 = n => Buffer.alloc(n,'A').toString('base64');
let a = qpBuildAttachments_({ files:[
  {name:'Receipt.pdf', mime:'application/pdf', data:b64(500)},
  {name:'Form.docx', mime:'application/vnd.openxmlformats-officedocument.wordprocessingml.document', data:b64(300)},
  {name:'photo.jpg', mime:'image/jpeg', data:b64(200)}]});
t('documents attach with their own type', a.names, ['Receipt.pdf','Form.docx','photo.jpg']);
t('  docx mime preserved', a.blobs[1].mime, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
a = qpBuildAttachments_({ files:[{name:'ok.pdf',mime:'application/pdf',data:b64(50)},
                                 {name:'virus.exe',mime:'application/x-msdownload',data:b64(50)},
                                 {name:'x.html',mime:'text/html',data:b64(50)}]});
t('executables and html refused', [a.names, a.skipped], [['ok.pdf'], 2]);
a = qpBuildAttachments_({ files:[{name:'huge.pdf',mime:'application/pdf',data:b64(21*1024*1024)},
                                 {name:'small.pdf',mime:'application/pdf',data:b64(40)}]});
t('oversize dropped, rest kept', a.names, ['small.pdf']);
t('path traversal neutralised',
  qpBuildAttachments_({files:[{name:'../../etc/passwd\r\n.pdf',mime:'application/pdf',data:b64(40)}]}).names,
  ['.. .. etc passwd .pdf']);
a = qpBuildAttachments_({ attachPdf:b64(90), attachPdfName:'Beneficiary.pdf', attachId:b64(60), attachIdMime:'image/heic', attachIdName:'ID.heic' });
t('guided form: PDF + ID still work', a.names, ['Beneficiary.pdf','ID.heic']);
t('  legacy honours the real mime', a.blobs[1].mime, 'image/heic');
t('files[] wins over the legacy slot',
  qpBuildAttachments_({ files:[{name:'a.pdf',mime:'application/pdf',data:b64(10)}], attachId:b64(10), attachIdName:'dupe.jpg' }).names,
  ['a.pdf']);
t('malformed base64 survives', qpBuildAttachments_({files:[{name:'x.pdf',mime:'application/pdf',data:'!!!!'}]}).blobs.length, 0);

// manager lookup — the ten that were silently wrong
t('John Boodoo -> Gary', qpManagerFor_('John Boodoo'), 'gary.sookdeo@myguardiangroup.com');
t('Felicia Rampersad2 -> Gary', qpManagerFor_('Felicia Rampersad2'), 'gary.sookdeo@myguardiangroup.com');
t('Faizal Mohammed resolves', qpManagerLookup_('Faizal Mohammed').how !== 'default', true);
t('Joy Sammah resolves', qpManagerLookup_('Joy Sammah').how !== 'default', true);
t('exact match unchanged', qpManagerLookup_('Kerwyn Ramroach'), {email:'kerwyn.ramroach@myguardiangroup.com', how:'exact'});
t('Narissa not mistaken for Faizal', qpManagerFor_('Faizal Mohammed'), 'ricky.rampersad@myguardiangroup.com');
t('unknown agent falls back', qpManagerLookup_('Nobody Here').how, 'default');
// exclude the shared branch master logins — they are not people and have no manager
const unresolved = Object.values(AGENT_ACCESS).filter(v=>v[0] && v[2]!=='branch')
  .map(v=>v[0]).filter(n=>qpManagerLookup_(n).how==='default');
t('only the 6 genuinely unlisted fall back', unresolved.length, 6);
console.log('         (' + unresolved.join(', ') + ')');

// passwords + tokens
props.clear();
setAgentPassword('AE101','Sunshine1');
t('password never stored in clear', JSON.stringify(qpPwStore_()).includes('Sunshine1'), false);
t('right password accepted', qpCheckPassword_({code:'AE101'}, 'Sunshine1'), null);
t('wrong password refused', qpCheckPassword_({code:'AE101'}, 'nope'), 'pwd');
t('no password + rollout mode = allowed', qpCheckPassword_({code:'ZZ999'}, ''), null);
t('sheet-tab rows keep their own check', qpCheckPassword_({code:'X', src:'tab'}, ''), null);
props.clear();
const printed = bootstrapAgentPasswords();
const rows = printed.split('\n').filter(l => /^[A-Z0-9]+\t/.test(l) && !l.startsWith('CODE\t'));
t('bootstrap covers every code', rows.length, Object.keys(AGENT_ACCESS).length);
t('generated passwords unique', new Set(rows.map(r=>r.split('\t')[2])).size, rows.length);
t('no ambiguous 0/O/1/I', rows.some(r=>/[01OI]/.test(r.split('\t')[2])), false);
t('printed passwords match the stored hashes',
  rows.every(r=>{const[c,,p]=r.split('\t');return qpPwStore_()[c.toUpperCase()]===qpHash_(c,p);}), true);
cache.clear();
const tok = qpIssueToken_({code:'AE101',name:'Aidan',email:'a@b.c',role:'agent'});
t('token is long and random', tok.length >= 32, true);
t('token carries no agent code', tok.toUpperCase().includes('AE101'), false);
t('two sign-ins differ', tok === qpIssueToken_({code:'AE101',name:'A',email:'',role:'agent'}), false);

// rate limiting
cache.clear();
t('5 allowed then blocked', Array.from({length:7},()=>qpRateLimit_('k',5,600)),
  [true,true,true,true,true,false,false]);
t('separate keys independent', qpRateLimit_('other',5,600), true);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
