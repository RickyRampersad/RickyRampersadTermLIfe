// The pending wall, deeper, and the clawback wall (24 Nov 2026). Made-up agents, policies and staff ids throughout.
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };
const env = makeEnv();
const DAY = '2026-11-24';
env.todayISO_ = () => DAY;
const H = ['Agent Name', 'POLICY', 'REQUIREMENT_CODE', 'requirement_name', 'WHO_ACTS_NEXT', 'RAG_STATUS', 'AGEING_BUCKET', 'NEW_THIS_WEEK', 'mode_premium', 'REQUIREMENT_STATUS',
  'application_number', 'REQUIREMENT_CATEGORY', 'DAYS_SINCE_SUBMISSION', 'SUSPENDED_AMOUNT', 'DecisionType', 'LAST_REQT_TO_SETTLE', 'underwriter_id', 'service_associate_id', 'NEXT_FOLLOWUP_DATE', 'requirement_comment', 'REQUIREMENT_DATE'];
const R = (agent, pol, code, name, who, rag, cat, x) => { x = x || {};
  return [agent, pol, code, name, who, rag, '0-30 days', 'No', 100, 'Ordered - awaiting receipt', '', cat, x.days || 10, x.susp || 0, x.dec || '', x.last || 'N', x.uw || 'UW01', x.so || 'SO01', x.nf || '', x.cmt || '', x.rd || '']; };
const rows = [H,
  R('Pat Sample', '5100000001', 'FUTPY', 'Future Premium Payment', 'Agent', 'Green', 'Payment', { dec: 'Standard', susp: 300, last: 'Y' }),
  R('Pat Sample', '5100000002', 'MDMED', 'Medical exam', 'Client (attend exam)', 'Red', 'Medical - Exam / Lab Test', { days: 120, dec: 'Additional Information', nf: '2026-11-20', cmt: 'Please book', rd: '2026-11-22', uw: 'UW02' }),
  R('Pat Sample', '5100000002', 'FUTPY', 'Future Premium Payment', 'Agent', 'Green', 'Payment', { days: 120, dec: 'Additional Information', uw: 'UW02' }),
  R('Lee Sample', '5100000003', 'DECLF', 'Declaration form', 'Client / Agent', 'Amber', 'Forms & Declarations', { dec: 'Referred', nf: '2026-11-26' }),
  R('Gone Agent', '5100000004', 'FUTPY', 'Future Premium Payment', 'Agent', 'Green', 'Payment', {})];
const CH = ['POLICY_ID', 'GIVEN_NAME', 'SURNAME', 'AGENT_NAME', 'PLAN', 'ISSUE_DATE', 'DISPATCH_DATE', 'ACK_DATE', 'ACK_STATUS', 'CLAWBACK_DATE', 'REASON_CODES', 'CLAWED_BACK_AMT', 'STATUS'];
const claw = [CH,
  ['5200000001', 'A', 'Client', 'Pat Sample', 'Econo Life', '2026-03-01', '2026-03-10', '2026-03-20', 'Y', '2026-10-01', 'NTU', 400, 'NOT REVERSED'],   // ack'd, no task -> red
  ['5200000002', 'B', 'Client', 'Pat Sample', 'Econo Life', '2026-04-01', '', '', '', '2026-11-01', 'NTU', 300, 'NOT REVERSED'],                      // nothing submitted -> red
  ['5200000003', 'C', 'Client', 'Lee Sample', 'Evolution', '2026-05-01', '', '', '', '2026-11-10', 'LAPSE', 250, 'NOT REVERSED'],                     // with us in Log Book, task open
  ['5200000004', 'D', 'Client', 'Lee Sample', 'Evolution', '2026-05-01', '', '', '', '2026-11-10', 'LAPSE', 900, 'NOT REVERSED'],                     // replacement
  ['5200000005', 'E', 'Client', 'Lee Sample', 'Evolution', '2026-05-01', '', '', '', '2026-11-10', 'LAPSE', 100, 'REVERSED']];
const LB = [['Policy #', 'Document', 'Status', 'Logged At', 'Received At', 'Received By', 'Transmittal', 'Sent At'],
  ['5100000002', 'Medical report', 'Received', '2026-11-18', '2026-11-18', 'Sasha Lalla', '', ''],
  ['5100000003', 'Declaration form', 'Sent', '2026-11-20', '2026-11-20', 'Azariah Griffith', 'T1', '2026-11-21'],
  ['5200000003', 'Acknowledgement letter', 'Received', '2026-11-19', '2026-11-19', 'Sasha Lalla', '', '']];
const sheet = (name, v) => ({ getName: () => name, getDataRange: () => ({ getValues: () => v }) });
env.iSs_ = () => ({ getSheets: () => [sheet('Branch Pendings_2026-11-19-0900', [H]), sheet('Branch Pending 2026 11 23rd 1336', rows), sheet('Clawback_2026-11-20', claw), sheet('Pendings Chase', [['x']])] });
env.SpreadsheetApp.openById = () => ({ getSheetByName: n => n === 'Log Book' ? sheet('Log Book', LB) : null });
env.skillBank_ = () => ({ 'pat sample': { name: 'Pat Sample', unit: 'Akaash Kalladeen', isAgent: true, active: true }, 'lee sample': { name: 'Lee Sample', unit: 'Ricky Rampersad', isAgent: true, active: true },
  'akaash kalladeen': { name: 'Akaash Kalladeen', isUM: true, active: true } });
env.wallLeft_ = () => ({ 'gone agent': 1 });
env.wallIsLeft_ = (n, left) => !!left[String(n).toLowerCase()];
env.sfkConfigured_ = () => true;
env.sfkUsers_ = () => ({});
env.sfkQuery_ = q => {
  if (/FROM CLIENT_PORTFOLIO__c WHERE POLICY__c IN/.test(q)) return [
    { Id: 'P1', POLICY__c: '5200000001', Contact__c: 'C1' }, { Id: 'P2', POLICY__c: '5200000002', Contact__c: 'C2' },
    { Id: 'P3', POLICY__c: '5200000003', Contact__c: 'C3' }, { Id: 'P4', POLICY__c: '5200000004', Contact__c: 'C4' }];
  if (/WhatId IN/.test(q)) return [{ WhatId: 'P3', WhoId: null }];
  if (/Subject LIKE/.test(q)) return [];
  if (/Contact__c IN/.test(q)) return [{ POLICY__c: '5299999999', Contact__c: 'C4', Paid_To_Date__c: '2026-06-01' }];
  return [];
};
const L = env.wallPendLive_(DAY);
ok('reads the tab named "Branch Pending 2026 11 23rd 1336"', L.tab === 'Branch Pending 2026 11 23rd 1336' && /23 November, 1:36pm/.test(L.asOf), L.tab + ' / ' + L.asOf);
const u = n => (L.units || []).find(x => x.k === n);
ok('units from the Skill Bank, anyone who left folds to Orphans', u('Akaash’s unit') && u('Akaash’s unit').policies === 2 && u('Ricky’s unit').policies === 1 && u('Orphans · to reassign').policies === 1, JSON.stringify((L.units || []).map(x => x.k + ':' + x.policies)));
ok('Orphans sort after the units', /Orphans/.test(L.units[L.units.length - 1].k));
ok('holding settlement: one item left, what it is and who moves it', L.hold.oneLeft === 3 && L.hold.ready === 2 && L.hold.readyHeld === 1 && L.hold.kinds[0].k === 'First premium', JSON.stringify(L.hold));
ok('underwriting: decisions, follow-up passed, wrote this week, by underwriter', L.uw.followOver === 1 && L.uw.followSoon === 1 && L.uw.wroteWeek === 1 && L.uw.approvedWaiting === 1 && L.uw.byUw.find(w => w.k === 'UW02').followOver === 1, JSON.stringify(L.uw));
ok('the team: papers signed for and not sent, by who holds them', L.team.waiting === 1 && L.team.sentWeek === 1 && L.team.by[0].k === 'Sasha' && L.team.oldest === 6, JSON.stringify(L.team));
ok('no policy number anywhere in the deeper blocks', !/51000000/.test(JSON.stringify({ u: L.units, h: L.hold, w: L.uw, t: L.team })));

const C = env.wallClawLive_(DAY);
ok('clawback: reversed left off, replacement taken off', C.total === 3 && C.reversed === 1 && C.replacements === 1 && C.replAmount === 900, JSON.stringify([C.total, C.reversed, C.replacements]));
ok('acknowledged and still clawed back = submitted; nothing on file = none; Log Book = with us', C.submitted === 1 && C.none === 1 && C.withUs === 1, JSON.stringify([C.submitted, C.none, C.withUs]));
ok('open task yes/no, no task is red', C.task === 1 && C.noTask === 2 && C.red === 2, JSON.stringify([C.task, C.noTask, C.red]));
ok('the branch total in dollars; per agent counts only', C.amount === 950 && C.agents[0].agent === 'Pat Sample' && C.agents[0].red === 2 && !('amount' in C.agents[0]));
ok('the list: last four digits, red first, no client name', C.list[0].red && C.list.every(x => x.last4.length === 4) && !/5200000|Client"/.test(JSON.stringify(C.list)), JSON.stringify(C.list[0]));
console.log(fails ? '\n' + fails + ' failed' : '\nAll passed'); process.exit(fails ? 1 : 0);
