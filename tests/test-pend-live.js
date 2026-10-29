// The pending wall from the newest pending report (27 October 2026).
//
// Ricky, 2:16pm: "a barchart to show which agents has first premium outstanding, and remove the oldest and middle and
// only have a number ... who are they chasing and whats done today". Pinned here: the newest "Branch Pendings_" tab is
// read; requirements awaiting receipt are counted (closed ones not); policies, new this week, red/amber/green, the age
// bands, each requirement by name, who acts next; first premiums by agent with policies counted once and the modal
// premium; today's chasing per desk from Salesforce (notes on Pendings tasks, Pendings closed) mapped to the agents; a
// unit named for someone who has left folds into Orphans; intel.pending carries it as `live`.
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };
const env = makeEnv();
env.todayISO_ = () => '2026-10-27';
const H = ['Branch', 'BranchName', 'AGENT_ID', 'Agent Name', 'POLICY', 'REQUIREMENT_CODE', 'requirement_name', 'WHO_ACTS_NEXT', 'RAG_STATUS', 'AGEING_BUCKET', 'NEW_THIS_WEEK', 'mode_premium', 'REQUIREMENT_STATUS',
           'application_number', 'REQUIREMENT_CATEGORY', 'DAYS_SINCE_SUBMISSION', 'SUSPENDED_AMOUNT', 'DecisionType'];
const R = (agent, pol, code, name, who, rag, age, nw, prem, st, x) => { x = x || {};
  return ['26000', 'X', 'A1', agent, pol, code, name, who, rag, age, nw, prem, st || 'Ordered - awaiting receipt', x.app || '', x.cat || '', x.days || 0, x.susp || 0, x.dec || '']; };
const rows = [H,
  R('Varun Seegolam', '5000000001', 'FUTPY', 'Future Premium Payment', 'Agent', 'Green', '0-30 days', 'Yes', 500, '', { app: '1000000001', cat: 'Payment', days: 20, dec: 'Standard' }),
  R('Varun Seegolam', '5000000001', 'FUTPY', 'Future Premium Payment', 'Agent', 'Green', '0-30 days', 'Yes', 500, '', { app: '1000000001', cat: 'Payment', days: 20, dec: 'Standard' }),
  R('Varun Seegolam', '5000000001', 'PRADD', 'Proof of Address', 'Agent', 'Amber', '31-60 days', 'No', 500, '', { app: '1000000001', cat: 'KYC - Identity & Address', days: 20, dec: 'Standard' }),
  R('Varun Seegolam', '5000000002', 'FUTPY', 'Future Premium Payment', 'Agent', 'Red', '90+ days', 'No', 250, '', { cat: 'Payment', days: 100, susp: 250, dec: 'Loaded' }),
  R('Aidan Eugene', '5000000003', 'FUTPY', 'Future Premium Payment', 'Agent', 'Amber', '61-90 days', 'No', 300, '', { cat: 'Payment', days: 70, dec: 'Additional Information' }),
  R('Tricia Baksh', '5000000004', 'FUTPY', 'Future Premium Payment', 'Agent', 'Amber', '31-60 days', 'No', 200, '', { cat: 'Payment', days: 40, dec: 'Referred' }),
  R('Fawwaz Mohamed', '5000000005', 'MDMED', 'Full Doctors Examination', 'Client (attend exam)', 'Green', '0-30 days', 'Yes', 100, '', { cat: 'Medical - Exam / Lab Test', days: 10, susp: 300, dec: 'Additional Information' }),
  R('Fawwaz Mohamed', '5000000005', 'DECLF', 'Declaration Form - Life', 'Client / Agent', 'Green', '0-30 days', 'Yes', 100, 'Received', { cat: 'Forms & Declarations', days: 10, susp: 300, dec: 'Additional Information' })];
const sheet = (name, v) => ({ getName: () => name, getDataRange: () => ({ getValues: () => v }) });
env.iSs_ = () => ({ getSheets: () => [sheet('Agent Codes', [['x']]), sheet('Branch Pendings_2026-10-26-0900', [H]), sheet('Branch Pendings_2026-10-27-1336', rows)] });
env.sfkConfigured_ = () => true;
env.sfkUsers_ = () => ({ sasha: { id: 'U1' }, azariah: { id: 'U2' }, elizabeth: { id: 'U3' }, kamla: { id: 'U4' }, ricky: { id: 'U9' } });
env.nameFor_ = sid => ({ sasha: 'Sasha Lalla', azariah: 'Azariah Griffith', elizabeth: 'Elizabeth Lee', kamla: 'Kamla Dookran', ricky: 'Ricky Rampersad' }[sid] || sid);
const queries = [];
env.sfkQuery_ = q => {
  queries.push(q);
  if (/IsClosed = false OR/.test(q)) return [
    { Subject: 'Pending - 5000000001 chase FPP', IsClosed: false, ActivityDate: '2026-10-20', CreatedDate: '2026-10-01T12:00:00.000+0000', LastModifiedDate: '2026-10-10T12:00:00.000+0000' },
    { Subject: 'Follow up 1000000001 / 5000000003', IsClosed: false, ActivityDate: '2026-10-30', CreatedDate: '2026-10-27T15:00:00.000+0000', LastModifiedDate: '2026-10-27T15:00:00.000+0000' },
    { Subject: 'Pending 5000000002 received', IsClosed: true, ActivityDate: '2026-10-01', CreatedDate: '2026-09-01T12:00:00.000+0000', LastModifiedDate: '2026-10-27T13:00:00.000+0000' }];
  if (/FROM FeedItem/.test(q)) return [{ ParentId: '00TA', CreatedById: 'U1' }, { ParentId: '00TB', CreatedById: 'U1' }, { ParentId: '00TC', CreatedById: 'U2' }, { ParentId: '001X', CreatedById: 'U2' }];
  if (/WHERE Id IN/.test(q)) return [{ Id: '00TA', Subject: 'Pending - 5000000001 chase FPP', Task_Type__c: 'Pendings' }, { Id: '00TB', Subject: 'Pending 5000000003', Task_Type__c: 'Pendings' },
                                     { Id: '00TC', Subject: 'Servicing 5000000005', Task_Type__c: 'Servicing' }];
  if (/IsClosed = true/.test(q)) return [{ Id: '00TD', Subject: 'Pending 5000000002 received', OwnerId: 'U2' }];
  return [];
};
const L = env.wallPendLive_('2026-10-27');
ok('the newest pending tab is read', L.tab === 'Branch Pendings_2026-10-27-1336' && /Tuesday 27 October, 1:36pm/.test(L.asOf), L.asOf);
ok('requirements awaiting receipt counted, a received one not', L.reqs === 7 && L.policies === 5 && L.newWeek === 3, JSON.stringify([L.reqs, L.policies, L.newWeek]));
ok('red, amber, green and the age bands', L.rag.Red === 1 && L.rag.Amber === 3 && L.rag.Green === 3 && L.ages.map(a => a.k + ':' + a.n).join(' ') === '0-30:3 31-60:2 61-90:1 90+:1', JSON.stringify([L.rag, L.ages]));
ok('each requirement by name, a number only', L.byReq[0].k === 'Future Premium Payment' && L.byReq[0].n === 5 && !('oldest' in L.byReq[0]) && !('median' in L.byReq[0]));
ok('who acts next', L.who[0].k === 'Agent' && L.who[0].n === 6);
const V = L.first.agents.find(a => a.k === 'Varun Seegolam');
ok('first premiums by agent: policies counted once, the modal premium summed', L.first.policies === 4 && V.n === 2 && V.prem === 750 && L.first.prem === 1250, JSON.stringify(L.first));
const T = L.today;
const S = T.desks.find(d => d.name === 'Sasha'), A = T.desks.find(d => d.name === 'Azariah');
ok('today: Sasha\'s notes on Pendings tasks, and whose policies', S.notes === 2 && S.agents.map(a => a.k).sort().join() === 'Aidan Eugene,Varun Seegolam', JSON.stringify(S));
ok('Azariah closed one; a note on a Servicing task is not a chase', A.notes === 0 && A.closed === 1 && A.agents[0].k === 'Varun Seegolam', JSON.stringify(A));
ok('every desk shows, quiet ones too, in the register\'s order', T.desks.map(d => d.name).join() === 'Sasha,Elizabeth,Azariah,Kamla,Ricky' && T.notes === 2 && T.closed === 1 && T.policies === 3, T.desks.map(d => d.name).join());

console.log('\nCode by code (slide 6, 28 Oct):\n');
const CF = L.codes.find(x => x.k === 'Future Premium Payment');
ok('each requirement with its count, red and amber, its policies, who acts and whose', CF && CF.n === 5 && CF.red === 1 && CF.amber === 2 && CF.policies === 4 && CF.who === 'Agent' && CF.code === 'FUTPY' && CF.kind === 'First premium', JSON.stringify(CF));
ok('the agents holding it, biggest first', CF.agents[0].k === 'Varun Seegolam' && CF.agents[0].n === 3 && CF.agents.length === 3, JSON.stringify(CF.agents));
ok('biggest code first; a received one is not there', L.codes[0].k === 'Future Premium Payment' && !L.codes.find(x => /Declaration/.test(x.k)) && L.codeCount === 3, L.codes.map(x => x.k + ':' + x.n).join());
ok('who acts next counts policies too', L.who[0].k === 'Agent' && L.who[0].n === 6 && L.who[0].p === 4, JSON.stringify(L.who[0]));
console.log('\nThe policies stop (27h):\n');
const PO = L.pol;
ok('policies by days since submission, five bands', PO.ages.map(a => a.k + ':' + a.n).join(' ') === '0-30:2 31-60:1 61-90:1 91-180:1 180+:0', PO.ages.map(a => a.k + ':' + a.n).join(' '));
ok('past ninety days, one item from issue, ready (only the premium left)', PO.past90 === 1 && PO.oneLeft === 4 && PO.ready === 3, JSON.stringify([PO.past90, PO.oneLeft, PO.ready]));
ok('suspense held once a policy', PO.held === 550 && PO.heldPolicies === 2 && PO.newWeek === 2, JSON.stringify([PO.held, PO.heldPolicies, PO.newWeek]));
ok('no money paid (28 Oct): three policies wait on a first premium with nothing in suspense, the oldest 70 days, two past a month', PO.unpaid === 3 && PO.unpaidOldest === 70 && PO.unpaid30 === 2, JSON.stringify([PO.unpaid, PO.unpaidOldest, PO.unpaid30]));
ok('the decision as states: approved 2, more information 2, with underwriting 1, declined 0',
  PO.states.map(s => s.key + ':' + s.n).join(' ') === 'settle:2 info:2 uw:1 decl:0', PO.states.map(s => s.key + ':' + s.n).join(' '));
const C = L.chase;
ok('Salesforce tasks matched by policy or application number', C.tasked === 3 && C.never === 2 && C.live === 2 && C.closedOnly === 1 && C.open === 3 && C.overdue === 1 && C.quiet === 1 && C.today === 3, JSON.stringify(C));
const B = L.board, BV = B.agents.find(a => a.agent === 'Varun Seegolam'), BF = B.agents.find(a => a.agent === 'Fawwaz Mohamed');
ok('and on each agent\'s row: Varun one unpaid, 20 days out; the branch three, the oldest 70', BV.unpaid === 1 && BV.unpaidDays === 20 && B.total.unpaid === 3 && B.total.unpaidDays === 70, JSON.stringify([BV.unpaid, BV.unpaidDays, B.total.unpaid, B.total.unpaidDays]));
ok('Varun\'s row: 2 policies, 4 requirements, 1 document, 2 first premiums, 1 ready, 1 red, $250 held',
  BV.policies === 2 && BV.reqs === 4 && BV.docs === 1 && BV.medical === 0 && BV.cash === 2 && BV.ready === 1 && BV.red === 1 && BV.held === 250, JSON.stringify(BV));
ok('and his tasks: 2 open, 1 overdue, 1 quiet, 2 today, none never raised, the oldest 100 days',
  BV.open === 2 && BV.overdue === 1 && BV.quiet === 1 && BV.today === 2 && BV.never === 0 && BV.oldest === 100, JSON.stringify(BV));
ok('each kind a number with a colour, never an age', BV.top[0].k === 'First premium' && BV.top[0].n === 3 && BV.top[0].tone === 'red' && BV.top[1].k === 'ID & address' && BV.top[1].tone === 'amber' && !('oldest' in BV.top[0]), JSON.stringify(BV.top));
ok('Fawwaz: a medical, $300 held, never raised', BF.medical === 1 && BF.held === 300 && BF.never === 1 && BF.top[0].k === 'Medical exam', JSON.stringify(BF));
ok('ordered by the call to make first: cash, then medicals', B.agents[0].agent === 'Varun Seegolam' && B.agents[B.agents.length - 1].agent === 'Fawwaz Mohamed', B.agents.map(a => a.agent).join());
ok('the branch total row', B.total.policies === 5 && B.total.cash === 4 && B.total.ready === 3 && B.total.never === 2 && B.total.held === 550 && B.tasks === true, JSON.stringify(B.total));
ok('no Salesforce query longer than Apps Script will fetch', queries.every(q => encodeURIComponent(q).length < 1900), Math.max.apply(null, queries.map(q => encodeURIComponent(q).length)));
// A busy afternoon: 120 tasks noted today. 150 Ids in one query was "Limit Exceeded: URLFetch URL Length" (27g, 3pm).
(() => {
  const keep = env.sfkQuery_, seen = [];
  env.sfkQuery_ = q => { seen.push(q); if (/FROM FeedItem/.test(q)) return Array.from({ length: 120 }, (_, i) => ({ ParentId: '00TUl00000pYq' + String(i).padStart(3, '0') + 'MAC', CreatedById: 'U1' })); return []; };
  env.wallPendToday_('2026-10-27', {}, {});
  env.sfkQuery_ = keep;
  const longest = Math.max.apply(null, seen.map(q => encodeURIComponent(q).length));
  ok('120 tasks noted today: looked up forty at a time, every query short enough', seen.filter(q => /WHERE Id IN/.test(q)).length === 3 && longest < 1900, longest);
})();
console.log('\nThrough the wall feed:\n');
env.CacheService.getScriptCache().removeAll && env.CacheService.getScriptCache().removeAll(['wall_pend_2026-10-27']);
env.intelRoute_ = b => env.ContentService.createTextOutput(JSON.stringify({ ok: true, data: { units: [{ name: 'KERWYN RAMROACH UNIT-CHAGUANAS REG CEN', n: 30 }, { name: 'AKAASH KALLADEEN UNIT - R RAMPERSAD BRCH', n: 8 }] } }));
const j = JSON.parse(env.doPost({ postData: { contents: JSON.stringify({ action: 'intel.pending' }) }, parameter: {} }).getContent());
ok('intel.pending carries the live report', j.data.live && j.data.live.reqs === 7);
ok('the departed fold: first premiums of Aidan and Tricia are one Orphans bar', (() => { const o = j.data.live.first.agents.find(a => a.k === env.WALL_ORPHANS); return o && o.n === 2 && o.prem === 500; })(), JSON.stringify(j.data.live.first.agents));
ok('a unit named for someone who has left reads Orphans', j.data.units[0].name === env.WALL_ORPHANS && /AKAASH/.test(j.data.units[1].name), JSON.stringify(j.data.units));
ok('the departed fold on the board too: Aidan and Tricia are one Orphans row', (() => { const o = j.data.live.board.agents.find(a => a.agent === env.WALL_ORPHANS); return o && o.policies === 2 && o.cash === 2 && o.ready === 2 && o.never === 1 && o.oldest === 70; })(), JSON.stringify(j.data.live.board.agents.map(a => a.agent)));
ok('on a code, the departed agents fold into one Orphans count', (() => { const c = j.data.live.codes.find(x => x.k === 'Future Premium Payment'); const o = c.agents.find(a => a.k === env.WALL_ORPHANS); return o && o.n === 2 && c.agents.length === 2; })(), JSON.stringify(j.data.live.codes[0].agents));
ok('nobody who has left is named', !/Aidan|Baksh|KERWYN/i.test(JSON.stringify(j.data)));
console.log(fails ? '\n' + fails + ' FAILED' : '\nAll passed');
process.exit(fails ? 1 : 0);
