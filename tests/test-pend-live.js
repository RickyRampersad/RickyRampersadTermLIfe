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
const H = ['Branch', 'BranchName', 'AGENT_ID', 'Agent Name', 'POLICY', 'REQUIREMENT_CODE', 'requirement_name', 'WHO_ACTS_NEXT', 'RAG_STATUS', 'AGEING_BUCKET', 'NEW_THIS_WEEK', 'mode_premium', 'REQUIREMENT_STATUS'];
const R = (agent, pol, code, name, who, rag, age, nw, prem, st) => ['26000', 'X', 'A1', agent, pol, code, name, who, rag, age, nw, prem, st || 'Ordered - awaiting receipt'];
const rows = [H,
  R('Varun Seegolam', '5000000001', 'FUTPY', 'Future Premium Payment', 'Agent', 'Green', '0-30 days', 'Yes', 500),
  R('Varun Seegolam', '5000000001', 'FUTPY', 'Future Premium Payment', 'Agent', 'Green', '0-30 days', 'Yes', 500),
  R('Varun Seegolam', '5000000001', 'PRADD', 'Proof of Address', 'Agent', 'Amber', '31-60 days', 'No', 500),
  R('Varun Seegolam', '5000000002', 'FUTPY', 'Future Premium Payment', 'Agent', 'Red', '90+ days', 'No', 250),
  R('Aidan Eugene', '5000000003', 'FUTPY', 'Future Premium Payment', 'Agent', 'Amber', '61-90 days', 'No', 300),
  R('Tricia Baksh', '5000000004', 'FUTPY', 'Future Premium Payment', 'Agent', 'Amber', '31-60 days', 'No', 200),
  R('Fawwaz Mohamed', '5000000005', 'MDMED', 'Full Doctors Examination', 'Client (attend exam)', 'Green', '0-30 days', 'Yes', 100),
  R('Fawwaz Mohamed', '5000000005', 'DECLF', 'Declaration Form - Life', 'Client / Agent', 'Green', '0-30 days', 'Yes', 100, 'Received')];
const sheet = (name, v) => ({ getName: () => name, getDataRange: () => ({ getValues: () => v }) });
env.iSs_ = () => ({ getSheets: () => [sheet('Agent Codes', [['x']]), sheet('Branch Pendings_2026-10-26-0900', [H]), sheet('Branch Pendings_2026-10-27-1336', rows)] });
env.sfkConfigured_ = () => true;
env.sfkUsers_ = () => ({ sasha: { id: 'U1' }, azariah: { id: 'U2' }, elizabeth: { id: 'U3' }, kamla: { id: 'U4' }, ricky: { id: 'U9' } });
env.nameFor_ = sid => ({ sasha: 'Sasha Lalla', azariah: 'Azariah Griffith', elizabeth: 'Elizabeth Lee', kamla: 'Kamla Dookran', ricky: 'Ricky Rampersad' }[sid] || sid);
env.sfkQuery_ = q => {
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
console.log('\nThrough the wall feed:\n');
env.CacheService.getScriptCache().removeAll && env.CacheService.getScriptCache().removeAll(['wall_pend_2026-10-27']);
env.intelRoute_ = b => env.ContentService.createTextOutput(JSON.stringify({ ok: true, data: { units: [{ name: 'KERWYN RAMROACH UNIT-CHAGUANAS REG CEN', n: 30 }, { name: 'AKAASH KALLADEEN UNIT - R RAMPERSAD BRCH', n: 8 }] } }));
const j = JSON.parse(env.doPost({ postData: { contents: JSON.stringify({ action: 'intel.pending' }) }, parameter: {} }).getContent());
ok('intel.pending carries the live report', j.data.live && j.data.live.reqs === 7);
ok('the departed fold: first premiums of Aidan and Tricia are one Orphans bar', (() => { const o = j.data.live.first.agents.find(a => a.k === env.WALL_ORPHANS); return o && o.n === 2 && o.prem === 500; })(), JSON.stringify(j.data.live.first.agents));
ok('a unit named for someone who has left reads Orphans', j.data.units[0].name === env.WALL_ORPHANS && /AKAASH/.test(j.data.units[1].name), JSON.stringify(j.data.units));
ok('nobody who has left is named', !/Aidan|Baksh|KERWYN/i.test(JSON.stringify(j.data)));
console.log(fails ? '\n' + fails + ' FAILED' : '\nAll passed');
process.exit(fails ? 1 : 0);
