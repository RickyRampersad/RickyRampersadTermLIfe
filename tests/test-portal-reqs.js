// The Branch Portal's requirements view on Guardian's pending report (27 October 2026).
//
// apps-script/branch-portal/Code.gs is the Branch Portfolio's own bound script ("BRANCH INTELLIGENCE AUTOMATION"),
// pasted by hand. Pinned here: the view reads the newest "Branch Pendings_" tab (one entry a policy, received rows not
// outstanding), the Salesforce chase from the tracker's "Pendings Chase" tab, Portal comments already posted are not shown
// twice, an agent sees only theirs however the name is written, and a comment is logged for the tracker to post.
const vm = require('vm'), fs = require('fs');
let fails = 0; const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };
function sheet(name, rows) { const s = { rows }; return { getName: () => name, getLastRow: () => s.rows.length, getLastColumn: () => Math.max(...s.rows.map(r => r.length)),
  getDataRange: () => ({ getValues: () => s.rows.map(r => r.slice()) }), appendRow: r => s.rows.push(r),
  getRange: (r, c, nr, nc) => ({ getValues: () => s.rows.slice(r - 1, r - 1 + nr).map(x => Array.from({ length: nc }, (_, j) => x[c - 1 + j] == null ? '' : x[c - 1 + j])) }), _s: s }; }
const H = ['POLICY','application_number','ClientID','Client Name','Agent Name','APPLICATION_RECEIVED_DATE','DAYS_SINCE_SUBMISSION','annual_premium_amount','mode_premium','SUSPENDED_AMOUNT','DecisionType','requirement_name','REQUIREMENT_CODE','REQUIREMENT_CATEGORY','WHO_ACTS_NEXT','RAG_STATUS','DAYS_OUTSTANDING','REQUIREMENT_STATUS'];
const rep = sheet('Branch Pendings_2026-10-27-1336', [H,
  ['5000000001','1000000001','C1','JANE DOE','Varun Seegolam',new Date('2026-09-01'),56,6000,500,0,'Standard','Declaration','DECLF','Forms & Declarations','Agent','Amber',20,'Ordered - awaiting receipt'],
  ['5000000001','1000000001','C1','JANE DOE','Varun Seegolam',new Date('2026-09-01'),56,6000,500,0,'Standard','Proof of address','PRADD','KYC - Identity & Address','Agent','Red',56,'Ordered - awaiting receipt'],
  ['5000000001','1000000001','C1','JANE DOE','Varun Seegolam',new Date('2026-09-01'),56,6000,500,0,'Standard','Declaration 2','DECL2','Forms & Declarations','Agent','Green',5,'Ordered - awaiting receipt'],
  ['5000000002','','C2','JOHN ROE','Fawwaz Mohamed',new Date('2026-07-01'),118,3000,250,503.18,'Referred','Full exam','MDMED','Medical - Exam / Lab Test','Client (attend exam)','Green',10,'Ordered - awaiting receipt'],
  ['5000000002','','C2','JOHN ROE','Fawwaz Mohamed',new Date('2026-07-01'),118,3000,250,503.18,'Referred','Old form','X','Forms & Declarations','Agent','Green',10,'Received']]);
const chase = sheet('Pendings Chase', [['Policy','Agent','Task','Owner','Due','Open tasks','Overdue','Last note at','Last note by','Last note','Earlier notes','Updated'],
  ['5000000001','Varun Seegolam','Settlement- 1000000001','Sasha Lalla-Jagassar','2026-10-30',2,1,'27 Oct, 10:00 AM','Sasha Lalla-Jagassar','Called agent','[{"at":"21 Oct, 10:00 AM","by":"Azariah Griffith","text":"Forms requested"}]','27 Oct 2026, 3:30 PM']]);
const log = sheet('Requirements Log', [['Timestamp','Policy','Client No','Client','Agent','Author','Comment','New Status','Salesforce'],
  [new Date('2026-10-27T10:00:00'),'5000000001','C1','JANE DOE','Varun Seegolam','Kamla <k@x>','Posted one','','Posted to "Settlement" · 27 Oct'],
  [new Date('2026-10-27T11:00:00'),'5000000002','C2','JOHN ROE','Fawwaz Mohamed','Neil <n@x>','Booked exam','Escalated','No open Pendings task in Salesforce on 5000000002 · 27 Oct']]);
const tabs = [sheet('Branch Portfolio', [['x']]), rep, chase, log];
const src = fs.readFileSync(require('path').join(__dirname, '..', 'apps-script', 'branch-portal', 'Code.gs'), 'utf8');
const mails = [];
const ctx = { console, Date, JSON, Math, Number, String, Object, Array, RegExp, isNaN,
  SpreadsheetApp: { openById: () => ({ getSheets: () => tabs, getSheetByName: n => tabs.find(t => t.getName() === n) || null }) },
  CacheService: { getScriptCache: () => ({ get: () => null, put: () => {}, removeAll: () => {} }) },
  MailApp: { sendEmail: m => mails.push(m) }, Session: { getScriptTimeZone: () => 'America/Port_of_Spain' }, PropertiesService: { getScriptProperties: () => ({ getProperty: () => null }) } };
vm.createContext(ctx); vm.runInContext(src, ctx);
ctx.auth_ = (t) => t === 'agent' ? { role: 'agent', agentName: 'SEEGOLAM, VARUN', name: 'Varun', email: 'v@x' } : { role: 'staff', name: 'Kamla Dookran', email: 'k@x' };
ctx.getBook_ = () => [];
const R = ctx.apiRequirements('staff');
ok('reads the newest Branch Pendings tab', R.ok && R.source === 'Branch Pendings_2026-10-27-1336' && R.cases.length === 2, JSON.stringify(R).slice(0, 200));
const A = R.cases.find(c => c.policy === '5000000001'), B = R.cases.find(c => c.policy === '5000000002');
ok('the longest waiting first', R.cases[0].policy === '5000000002');
ok('outstanding by kind, days, red at Guardian', /^Outstanding: Forms & Declarations ×2 · KYC - Identity & Address · 56 days since submission · 1 overdue at Guardian/.test(A.statusDesc), A.statusDesc);
ok('Salesforce chase on the line', /Salesforce: 2 open Pendings tasks · Sasha Lalla-Jagassar · due 2026-10-30 · 1 overdue$/.test(A.statusDesc), A.statusDesc);
ok('the received row is not outstanding; suspense shown', /Outstanding: Medical - Exam \/ Lab Test · 118 days/.test(B.statusDesc) && /\$503\.18 held in suspense/.test(B.statusDesc) && /No Pendings task in Salesforce|not read yet/.test(B.statusDesc), B.statusDesc);
ok('notes: Salesforce first, a posted Portal comment not twice', A.comments.length === 2 && A.comments[0].text === 'Called agent' && A.comments[1].text === 'Forms requested', JSON.stringify(A.comments));
ok('a comment with no open task shows here, saying so', B.comments.length === 1 && /Booked exam \(No open Pendings task/.test(B.comments[0].text) && B.localStatus === 'Escalated', JSON.stringify(B.comments));
ok('client name title-cased, premium as money, underwriting decision', A.client === 'Jane Doe' && A.premium === '$6,000.00' && A.plan === 'Underwriting: Standard');
const G = ctx.apiRequirements('agent');
ok('an agent sees only theirs, however the name is written', G.cases.length === 1 && G.cases[0].policy === '5000000001', JSON.stringify(G.cases.map(c => c.policy)));
const W = ctx.apiReqComment('staff', '5000000002', 'Chased the client', 'Escalated');
const last = log._s.rows[log._s.rows.length - 1];
ok('a comment goes to the log, client and agent from the report, column I left for the tracker', W.ok && last[1] === '5000000002' && last[3] === 'JOHN ROE' && last[4] === 'Fawwaz Mohamed' && last.length === 8, JSON.stringify(last));
ok('escalation still mails (test mode to the test address)', mails.length === 1 && /ESCALATED/.test(mails[0].subject));
console.log(fails ? fails + ' FAILED' : 'All passed'); process.exit(fails ? 1 : 0);
