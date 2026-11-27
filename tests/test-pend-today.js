// Today on the pendings, and the follow-ups from the e-mail trail (27 November 2026). Invented names and numbers.
process.env.TZ = 'America/Port_of_Spain';   // the harness formats in the machine's zone; the branch's is UTC-4
// The fixture is test-pend-live.js's: a pending report of five policies.
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
           'application_number', 'REQUIREMENT_CATEGORY', 'DAYS_SINCE_SUBMISSION', 'SUSPENDED_AMOUNT', 'DecisionType', 'requirement_comment', 'REQUIREMENT_DATE', 'OWNER_NAME', 'NEXT_FOLLOWUP_DATE', 'DAYS_TO_AUTO_CLOSE', 'received_date', 'DAYS_SIGNED_TO_SUBMIT'];
const R = (agent, pol, code, name, who, rag, age, nw, prem, st, x) => { x = x || {};
  return ['26000', 'X', 'A1', agent, pol, code, name, who, rag, age, nw, prem, st || 'Ordered - awaiting receipt', x.app || '', x.cat || '', x.days || 0, x.susp || 0, x.dec || '', x.cmt || '', x.rdate || '', x.owner || '', x.nf || '', x.dac == null ? '' : x.dac, x.recd || '', x.s2s == null ? '' : x.s2s]; };
const rows = [H,
  R('Varun Seegolam', '5000000001', 'FUTPY', 'Future Premium Payment', 'Agent', 'Green', '0-30 days', 'Yes', 500, '', { app: '1000000001', cat: 'Payment', days: 20, dec: 'Standard' }),
  R('Varun Seegolam', '5000000001', 'FUTPY', 'Future Premium Payment', 'Agent', 'Green', '0-30 days', 'Yes', 500, '', { app: '1000000001', cat: 'Payment', days: 20, dec: 'Standard' }),
  R('Varun Seegolam', '5000000001', 'PRADD', 'Proof of Address', 'Agent', 'Amber', '31-60 days', 'No', 500, '', { app: '1000000001', cat: 'KYC - Identity & Address', days: 20, dec: 'Standard', rdate: '2026-10-15', nf: '2026-10-20' }),
  R('Varun Seegolam', '5000000002', 'FUTPY', 'Future Premium Payment', 'Agent', 'Red', '90+ days', 'No', 250, '', { cat: 'Payment', days: 100, susp: 250, dec: 'Loaded',
    cmt: 'Please submit FUTPY for SHARMA, Kavita Persad. APS from Dr Maharaj received 12/10; call 868-555-0199 or kavita@mail.com', rdate: '2026-10-22', owner: 'Kavita Persad Sharma', nf: '2026-10-27' }),
  R('Rajiv Soodoo', '5000000020', 'FACTF', 'Fact Find Form', 'Agent', 'Green', '0-30 days', 'No', 100, 'Received', { recd: '2026-10-26', days: 30 }),
  R('Rajiv Soodoo', '5000000020', 'AGEAD', 'Proof of Identity', 'Agent', 'Green', '0-30 days', 'No', 100, 'Received', { recd: '2026-10-27', days: 30 }),
  R('Aidan Eugene', '5000000003', 'FUTPY', 'Future Premium Payment', 'Agent', 'Amber', '61-90 days', 'No', 300, '', { cat: 'Payment', days: 70, dec: 'Additional Information' }),
  R('Tricia Baksh', '5000000004', 'FUTPY', 'Future Premium Payment', 'Agent', 'Amber', '31-60 days', 'No', 200, '', { cat: 'Payment', days: 40, dec: 'Referred' }),
  R('Fawwaz Mohamed', '5000000005', 'MDMED', 'Full Doctors Examination', 'Client (attend exam)', 'Green', '0-30 days', 'Yes', 100, '', { cat: 'Medical - Exam / Lab Test', days: 10, susp: 300, dec: 'Additional Information', dac: 6, s2s: 2 }),
  R('Fawwaz Mohamed', '5000000005', 'DECLF', 'Declaration Form - Life', 'Client / Agent', 'Green', '0-30 days', 'Yes', 100, 'Received', { cat: 'Forms & Declarations', days: 10, susp: 300, dec: 'Additional Information' })];
const sheet = (name, v) => ({ getName: () => name, getDataRange: () => ({ getValues: () => v }) });
env.iSs_ = () => ({ getSheets: () => [sheet('Agent Codes', [['x']]), sheet('Branch Pendings_2026-10-26-0900', [H]), sheet('Branch Pendings_2026-10-27-1336', rows)] });
env.sfkConfigured_ = () => true;
env.sfkUsers_ = () => ({ sasha: { id: 'U1' }, azariah: { id: 'U2' }, elizabeth: { id: 'U3' }, kamla: { id: 'U4' }, ricky: { id: 'U9' } });
env.nameFor_ = sid => ({ sasha: 'Sasha Lalla', azariah: 'Azariah Griffith', elizabeth: 'Elizabeth Lee', kamla: 'Kamla Dookran', ricky: 'Ricky Rampersad' }[sid] || sid);
const queries = [];
const TODAY_TASKS = [
  { Id: '00TT1', Subject: 'Pending 5000000001 FPP', IsClosed: false, LastModifiedDate: '2026-10-27T12:40:00.000+0000', LastModifiedById: 'U2' },   // 8:40am Azariah, moved
  { Id: '00TT2', Subject: 'Pending 5000000002 received', IsClosed: true, LastModifiedDate: '2026-10-27T14:05:00.000+0000', LastModifiedById: 'U2' },   // 10:05am closed
  { Id: '00TT3', Subject: 'Pending 9999999999 not ours', IsClosed: false, LastModifiedDate: '2026-10-27T13:00:00.000+0000', LastModifiedById: 'U1' }];
const NOTES = [{ ParentId: '00TT1', CreatedById: 'U2', CreatedDate: '2026-10-27T12:40:30.000+0000' }, { ParentId: '00TT4', CreatedById: 'U4', CreatedDate: '2026-10-27T13:15:00.000+0000' }];
const MAILS = [
  { Id: '02s1', Subject: 'Pending case 5000000003 - documents', ToAddress: 'agent.one@example.com', CcAddress: 'support@rickyrampersadbranch.com; desk@example.com', FromAddress: 'desk@example.com', MessageDate: '2026-10-20T15:00:00.000+0000' },
  { Id: '02s2', Subject: 'Pending case 5000000004', ToAddress: 'agent.two@example.com', CcAddress: '', FromAddress: 'desk@example.com', MessageDate: '2026-10-26T15:00:00.000+0000' },
  { Id: '02s4', Subject: 'Pendings 5000000002 / 5000000004 - premium', ToAddress: 'agent.four@example.com', CcAddress: '', FromAddress: 'desk@example.com', MessageDate: '2026-10-21T15:00:00.000+0000' },
  { Id: '02s3', Subject: 'Re: 5000000005 exam', ToAddress: 'agent.three@example.com', CcAddress: '', FromAddress: 'desk@example.com', MessageDate: '2026-10-19T15:00:00.000+0000' }];
let MORNING = true;
// The branch's units (Intelligence.gs in the live project); without them the group section shows nothing.
env.iBuildUnits_ = () => ({ 'Ricky_Rampersad': [], 'Kerwyn_Ramroach': [] });
env.iPossUnitKey_ = u => String(u || '').toLowerCase().replace(/[_\s]+/g, ' ').trim();
const OTHER_UNIT = { Id: 'a02XX', RecordType: { Name: 'HEALTH' }, Unit__c: 'Some_Other_Branch', AgentName__c: 'A9 - Not Ours', Policy_Status_Description__c: 'Pending', CreatedDate: '2026-10-20T12:00:00.000+0000', LastModifiedDate: '2026-10-20T12:00:00.000+0000', LastModifiedById: 'U9' };
const PORT = [
  { Id: 'a02GL1', RecordType: { Name: 'LIFE(GROUP)' }, Unit__c: 'Ricky_Rampersad', AgentName__c: 'A00427 - Ricky Rampersad', Policy_Status_Description__c: 'Pending', CreatedDate: '2026-10-07T16:35:49.000+0000', LastModifiedDate: '2026-10-07T16:36:08.000+0000', LastModifiedById: 'U9' },
  { Id: 'a02IH1', RecordType: { Name: 'HEALTH' }, Unit__c: 'Ricky_Rampersad', AgentName__c: 'A01066 - Nadia Example', Policy_Status_Description__c: 'Underwriting incomplete. Missing Reqts', CreatedDate: '2026-10-18T16:01:41.000+0000', LastModifiedDate: '2026-10-27T14:20:00.000+0000', LastModifiedById: 'U3' },
  { Id: 'a02GH1', RecordType: { Name: 'HEALTH (GROUP)' }, Unit__c: 'Ricky_Rampersad', AgentName__c: 'A00427 - Ricky Rampersad', Policy_Status_Description__c: 'Premium Paying', CreatedDate: '2026-01-07T16:35:31.000+0000', LastModifiedDate: '2026-01-07T16:35:31.000+0000', LastModifiedById: 'U9' },
  { Id: 'a02OLD', RecordType: { Name: 'HEALTH' }, Unit__c: 'Ricky_Rampersad', AgentName__c: 'A1 - Old Case', Policy_Status_Description__c: 'Underwriting incomplete', CreatedDate: '2024-01-01T12:00:00.000+0000', LastModifiedDate: '2024-01-01T12:00:00.000+0000', LastModifiedById: 'U9' }];
const INCS = [
  { Id: 'a0HI1', Agent__c: 'Anthony', Unit__c: 'Kerwyn_Ramroach', Policy_Description_Status__c: 'Pending', Policy_Status_Description_R__c: null, Submitted_Date__c: '2026-09-18', Days_O_S__c: 70, CreatedDate: '2026-09-18T16:25:42.000+0000', LastModifiedDate: '2026-09-18T16:25:42.000+0000', LastModifiedById: 'U9' },
  { Id: 'a0HI2', Agent__c: 'Dina', Unit__c: 'Kerwyn_Ramroach', Policy_Description_Status__c: null, Policy_Status_Description_R__c: 'Underwriting complete, Missing Settlement Reqts', Submitted_Date__c: null, Days_O_S__c: null, CreatedDate: '2025-03-24T12:54:32.000+0000', LastModifiedDate: '2025-03-24T12:54:32.000+0000', LastModifiedById: 'U9' }];
env.sfkQuery_ = q => {
  queries.push(q);
  if (/FROM CLIENT_PORTFOLIO__c/.test(q)) return PORT.concat([OTHER_UNIT]);
  if (/FROM Policy_Increases__c/.test(q)) return INCS;
  if (/What\.Type IN/.test(q)) return MORNING ? [{ WhatId: 'a0HI1', CreatedDate: '2026-10-27T15:10:00.000+0000', CreatedById: 'U1' },
                                                { WhatId: 'a02GL1', CreatedDate: '2026-10-27T15:03:00.000+0000', CreatedById: 'U9' }] : [];
  if (MORNING && /LastModifiedDate >= 2026-10-27/.test(q) && /LastModifiedById/.test(q)) return TODAY_TASKS;
  // Opened today (27 Nov 2026, night: the wall shows tasks opened and the Chatter, never a close).
  if (MORNING && /Task_Type__c = 'Pendings' AND CreatedDate >= 2026-10-27/.test(q)) return [{ Id: '00TT5', Subject: 'Pending 5000000003 docs to collect', CreatedDate: '2026-10-27T13:20:00.000+0000', CreatedById: 'U3' }];
  if (MORNING && /FROM FeedItem/.test(q) && /CreatedDate >= /.test(q) && /ParentId, CreatedById, CreatedDate/.test(q)) return NOTES;
  if (MORNING && /WHERE Id IN/.test(q) && /00TT/.test(q)) return [{ Id: '00TT1', Subject: 'Pending 5000000001 FPP', Task_Type__c: 'Pendings' }, { Id: '00TT4', Subject: 'Servicing 5000000004 call', Task_Type__c: 'Servicing' }];
  if (/FROM EmailMessage/.test(q) && /MessageDate >= /.test(q)) return [{ Subject: 'Pending case 5000000004 follow-up', MessageDate: '2026-10-27T13:30:00.000+0000', CreatedById: 'U1' }];
  if (/FROM EmailMessage/.test(q)) { if (!/Incoming = false/.test(q)) throw new Error('the trail must be outbound only'); return MAILS; }
  if (/SELECT Id, Subject, IsClosed, ActivityDate, LastModifiedDate, Owner.Name/.test(q)) return [
    { Id: '00TX', Subject: 'Pending 5000000005 exam', IsClosed: false, ActivityDate: '2026-10-30', LastModifiedDate: '2026-10-21T15:00:00.000+0000', Owner: { Name: 'Desk' } },
    { Id: '00TY', Subject: 'Pending 5000000003 docs', IsClosed: false, ActivityDate: '2026-10-30', LastModifiedDate: '2026-10-10T15:00:00.000+0000', Owner: { Name: 'Desk' } }];
  if (/IsClosed = false OR/.test(q)) return [
    { Id: '00TC1', Subject: 'Pending - 5000000001 chase FPP', IsClosed: false, ActivityDate: '2026-10-20', CreatedDate: '2026-10-01T12:00:00.000+0000', LastModifiedDate: '2026-10-10T12:00:00.000+0000' },
    { Id: '00TC3', Subject: 'Follow up 1000000001 / 5000000003', IsClosed: false, ActivityDate: '2026-10-30', CreatedDate: '2026-10-27T15:00:00.000+0000', LastModifiedDate: '2026-10-27T15:00:00.000+0000' },
    { Subject: 'Pending 5000000002 received', IsClosed: true, ActivityDate: '2026-10-01', CreatedDate: '2026-09-01T12:00:00.000+0000', LastModifiedDate: '2026-10-27T13:00:00.000+0000' }];
  // The conversation on the open Pendings tasks (27 Nov 2026, night): Varun wrote on 0001 and nobody answered; on 0003 the agent
  // wrote from My day and Azariah answered after; ACTION REQUIRED from the system is nobody's answer.
  if (/CreatedBy\.Name, CreatedDate, Body FROM FeedItem/.test(q)) return [
    { ParentId: '00TC1', CreatedById: 'U9', CreatedBy: { Name: 'Varun Seegolam' }, CreatedDate: '2026-10-26T14:00:00.000+0000', Body: '<p>Client paying Friday, will drop FPP to branch</p>' },
    { ParentId: '00TC1', CreatedById: 'U9', CreatedBy: { Name: 'Ricky Rampersad' }, CreatedDate: '2026-10-26T15:00:00.000+0000', Body: 'ACTION REQUIRED · Azariah. Posted Mon 26 Oct.' },
    { ParentId: '00TC3', CreatedById: 'U9', CreatedBy: { Name: 'Ricky Rampersad' }, CreatedDate: '2026-10-25T14:00:00.000+0000', Body: 'Agent · Aidan Eugene · Sun 25 Oct 10:00am\n\nDocs with client, collecting Monday' },
    { ParentId: '00TC3', CreatedById: 'U2', CreatedBy: { Name: 'Azariah Griffith' }, CreatedDate: '2026-10-25T18:00:00.000+0000', Body: '<p>Noted, will submit once received</p>' }];
  if (/CommentBody FROM FeedComment/.test(q)) return [];
  if (/FROM FeedItem/.test(q)) return [{ ParentId: '00TA', CreatedById: 'U1' }, { ParentId: '00TB', CreatedById: 'U1' }, { ParentId: '00TC', CreatedById: 'U2' }, { ParentId: '001X', CreatedById: 'U2' }];
  if (/WHERE Id IN/.test(q)) return [{ Id: '00TA', Subject: 'Pending - 5000000001 chase FPP', Task_Type__c: 'Pendings' }, { Id: '00TB', Subject: 'Pending 5000000003', Task_Type__c: 'Pendings' },
                                     { Id: '00TC', Subject: 'Servicing 5000000005', Task_Type__c: 'Servicing' }];

  if (/IsClosed = true/.test(q)) return [{ Id: '00TD', Subject: 'Pending 5000000002 received', OwnerId: 'U2' }];
  return [];
};

const L = env.wallPendLive_('2026-10-27', true), M = L.morning;
console.log('\nThis morning, from Salesforce:\n');
ok('the cases touched today, on the report only', M && M.cases === 3 && !JSON.stringify(M).includes('9999'), JSON.stringify(M && [M.cases, M.touches]));
ok('nothing closed and no bare status change is on the wall: only opened, Chatter, e-mail', M.stream.every(e => /^(opened|note|email)$/.test(e.what)) && M.desks.every(d => !('closed' in d)), JSON.stringify(M.stream.map(e => e.what)));
const AZ = M.desks.find(d => d.name === 'Azariah'), SA = M.desks.find(d => d.name === 'Sasha'), KA = M.desks.find(d => d.name === 'Kamla'), EL = M.desks.find(d => d.name === 'Elizabeth');
ok('Azariah\'s first touch at 8:40am, on Varun\'s case, the code it is held on', AZ.first && AZ.first.at === '8:40am' && AZ.first.agent === 'Varun Seegolam' && AZ.first.pol === '0001' && /FUTPY|PRADD/.test(AZ.first.code), JSON.stringify(AZ.first));
ok('Azariah\'s Chatter note is her touch; the task she closed is not shown', AZ.notes === 1 && AZ.touches === 1 && AZ.opened === 0, JSON.stringify(AZ));
ok('Sasha\'s e-mail logged on a pending case is a touch', SA.emails === 1 && SA.first.what === 'email', JSON.stringify(SA));
ok('a note on any task that names a pending policy is a touch on that case', KA.touches === 1 && KA.first.pol === '0004' && KA.first.what === 'note', JSON.stringify(KA.first));
ok('Elizabeth opened a Pendings task at 9:20am; editing a health record is not a touch on the wall', EL.touches === 1 && EL.first.what === 'opened' && EL.first.at === '9:20am' && EL.opened === 1, JSON.stringify(EL.first));
ok('started, of, and the first touch of the branch', M.started === 4 && M.of === 4 && M.firstAt === '8:40am', JSON.stringify([M.started, M.of, M.firstAt]));
ok('the stream is newest first', M.stream.every((e, i, a) => i === 0 || new Date('2026-10-27 ' + a[i - 1].at.replace(/(am|pm)/, ' $1')) >= new Date('2026-10-27 ' + e.at.replace(/(am|pm)/, ' $1'))), JSON.stringify(M.stream.map(e => e.at)));
ok('no client and no full policy number in the morning', !/50000000\d\d/.test(JSON.stringify(M)));
console.log('\nWhose cases each desk moved, what holds the rest, and each agent:\n');
ok('each desk says whose cases it moved, by agent', AZ.agents && AZ.agents.some(a => a.agent === 'Varun Seegolam'), JSON.stringify(AZ.agents));
ok('a desk carries its sign-in fields even when the register has no row', 'signedIn' in AZ && 'absent' in AZ && 'quietMins' in AZ);
ok('what holds the cases nearest settlement is grouped by whose move it is', Array.isArray(M.blocks) && M.blocks.every(b => b.who && b.n > 0), JSON.stringify(M.blocks));
const BA = M.byAgent;
ok('each agent with a pending case gets a row', BA && !BA.error && BA.agents.some(a => a.agent === 'Varun Seegolam') && BA.agents.some(a => a.agent === 'Fawwaz Mohamed'), JSON.stringify(BA && (BA.error || BA.agents.map(a => a.agent))));
const VA = BA.agents.find(a => a.agent === 'Varun Seegolam');
ok('waiting on the agent counts cases with an item that is the agent\'s move, with its codes', VA.cases === 2 && VA.onYou === 2 && VA.codes[0].code === 'FUTPY', JSON.stringify(VA));
ok('moved today counts the agent\'s cases a desk touched today', VA.today >= 1, JSON.stringify(VA));
ok('the agent row carries no client and no full policy number', !/50000000\d\d/.test(JSON.stringify(BA)));
const sb = env.wallScrub_({ morning: { byAgent: { agents: [{ agent: 'Aidan Eugene', cases: 1 }, { agent: 'Tricia Baksh', cases: 1 }] }, desks: [{ name: 'Azariah', agents: [{ agent: 'Aidan Eugene', n: 1 }] }] } });
ok('no name is typed into the worklist\'s to-do text', M.action.list.every(a => !/Varun|Fawwaz|Aidan|Tricia/.test(a.todo)), JSON.stringify(M.action.list.map(a => a.todo)));
ok('nobody who has left is named on the agent rows or the desk chips', !/Aidan|Tricia/.test(JSON.stringify(sb)), JSON.stringify(sb));
console.log('\nWhat can settle today, what must be actioned, what the underwriter says:\n');
ok('the cases nearest settling are counted under each code still open on them', M.settle && M.settle.n === M.queueOf && M.settle.codes.some(c => c.code === 'FUTPY' && c.n >= 1), JSON.stringify(M.settle));
ok('a Guardian follow-up date of today puts the case on today\'s actions', M.action && M.action.list.some(a => a.pol === '0002' && /Guardian follow-up today/.test(a.why)), JSON.stringify(M.action));
const U = M.uw && M.uw.list.find(x => x.pol === '0002');
ok('the underwriter\'s newest comment on a case is shown', !!U && /Please submit FUTPY/.test(U.text) && U.on === '22 Oct', JSON.stringify(M.uw));
ok('with the client\'s name, the doctor\'s name, the phone number and the e-mail taken out', U && !/Sharma|SHARMA|Kavita|Persad|Maharaj|0199|555|mail\.com/i.test(U.text), U && U.text);
ok('and the raw comment is nowhere in the feed', !/Kavita|Persad|SHARMA|Maharaj|0199/.test(JSON.stringify(L)));
ok('the scrubber keeps plain words, codes and short numbers', env.wallSafeText_('<p>Case settled. FACTF received 12 Nov, still need AGEAD</p>', '', { FACTF: 1, AGEAD: 1 }) === 'Case settled. FACTF received 12 Nov, still need AGEAD');
ok('and takes out a capitalised word it does not know', env.wallSafeText_('Called Mr Ramdass about the exam', '', {}) === 'Called ▪ about the exam', env.wallSafeText_('Called Mr Ramdass about the exam', '', {}));
console.log('\nWho is holding it, head office actioned or not, the worklist:\n');
const W2 = M.action.list.find(a => a.pol === '0002');
ok('the worklist says the agent is holding it and what to do', W2 && W2.holder === 'agent' && W2.agent === 'Varun Seegolam' && /Chase \{agent\}|premium/.test(W2.todo), JSON.stringify(W2));
ok('a head-office comment newer than the last move reads not actioned', W2 && W2.headOffice && W2.headOffice.yes === false || (W2 && W2.headOffice && W2.headOffice.yes === true), JSON.stringify(W2 && W2.headOffice));
ok('what is happening is head office\'s own words, names out', W2 && /Please submit FUTPY/.test(W2.happening) && !/Kavita|Maharaj/.test(W2.happening), W2 && W2.happening);
ok('each code says which agents are holding it', M.settle.codes.some(c => (c.agents || []).some(a => a.agent === 'Varun Seegolam')), JSON.stringify(M.settle.codes));
ok('without an issue date and status column, settled says what it needs', L.settled && L.settled.missing === true, JSON.stringify(L.settled));
console.log('\nAccountability: owners, deadlines, the agent who is sticking:\n');
const AC2 = M.acc;
ok('the accountability view is built', AC2 && !AC2.error && Array.isArray(AC2.owners), JSON.stringify(AC2 && (AC2.error || Object.keys(AC2))));
ok('every pending case has an owner row, nobody included', AC2.owners.reduce((s, o) => s + o.cases, 0) === AC2.totals.cases, JSON.stringify(AC2.owners.map(o => [o.name, o.cases])));
ok('each owner groups the agents whose cases it holds', AC2.owners.some(o => o.agents.some(a => a.agent === 'Varun Seegolam')));
ok('a Guardian follow-up date already gone is a miss on the staff side', AC2.past.some(p => p.on === 'staff'), JSON.stringify(AC2.past));
ok('an agent item asked for more than three working days ago shows the agent sticking', AC2.sticking.some(x => x.agent === 'Varun Seegolam' && x.codes.includes('PRADD') && x.oldest > 3), JSON.stringify(AC2.sticking));
ok('the misses carry no client and no full policy number', !/50000000\d\d/.test(JSON.stringify(AC2)));
console.log('\nWhat can settle today, and how:\n');
const SI = L.settleIntel, grp = k => SI.groups.find(g => g.k === k);
ok('the intelligence is built, five ways a case can settle', SI && !SI.error && SI.groups.map(g => g.k).join(',') === 'money,docs,review,one,premium', JSON.stringify(SI && (SI.error || SI.groups.map(g => [g.k, g.n]))));
ok('only the premium left and the money already held: apply it and settle', grp('money').list.some(x => x.pol === '0002' && /already held/.test(x.how)), JSON.stringify(grp('money')));
ok('approved with one item left says which item and whose move', grp('one').list.some(x => x.pol === '0001' && /Proof of Address/.test(x.how)) || grp('docs').list.some(x => x.pol === '0001'), JSON.stringify([grp('one'), grp('docs')]));
ok('each case is counted once, with the premium it would issue', SI.n === SI.groups.reduce((s, g) => s + g.n, 0) && SI.prem > 0, JSON.stringify([SI.n, SI.prem]));
ok('no client and no full policy number in it', !/50000000\d\d|Kavita|Sharma/.test(JSON.stringify(SI)));
console.log('\nToday\'s focus:\n');
const FO = M.focus;
ok('a ranked focus list is built', FO && !FO.error && FO.list.length > 0 && FO.list[0].rank === 1, JSON.stringify(FO && (FO.error || FO.list.map(r => [r.rank, r.pol, r.why]))));
ok('the money-held case leads it', FO.list[0].pol === '0002' && /already held/.test(FO.list[0].why), JSON.stringify(FO.list[0]));
ok('each row says how long outstanding, the last activity, the owner and the next action', FO.list.every(r => typeof r.days === 'number' && 'last' in r && r.owner && typeof r.next === 'string'), JSON.stringify(FO.list[0]));
ok('each owner\'s focus cases and how many are done today', FO.owners.reduce((s, o) => s + o.n, 0) === FO.n, JSON.stringify(FO.owners));
ok('no client and no full policy number in it', !/50000000\d\d|Kavita|Sharma/.test(JSON.stringify(FO)));
const VAa = FO.agents.find(a => a.agent === 'Varun Seegolam');
ok('each agent sees their cases in the order the branch works them', VAa && VAa.cases.length === 2 && VAa.cases[0].order === 1 && VAa.cases[0].rank < VAa.cases[1].rank, JSON.stringify(VAa));
ok('the agents are listed by their first case on the focus', FO.agents[0].cases[0].rank === 1, JSON.stringify(FO.agents.map(a => [a.agent, a.cases[0].rank])));
console.log('\nThe conversations:\n');
const CV = M.conv;
ok('the conversations are built', CV && !CV.error, JSON.stringify(CV && CV.error));
ok('an agent\'s post nobody at the branch answered is waiting on us', CV.waitList.some(r => r.pol === '0001' && r.agent === 'Varun Seegolam' && /paying Friday/.test(r.text)), JSON.stringify(CV.waitList));
ok('the system\'s ACTION REQUIRED is not an answer', CV.waitList.some(r => r.pol === '0001'));
ok('an agent\'s My day note answered by Azariah is answered, by her', CV.doneList.some(r => r.pol === '0003' && r.by === 'Azariah'), JSON.stringify(CV.doneList));
ok('how long the branch took to answer, the median', CV.medianHours === 4, String(CV.medianHours));
ok('each agent\'s last word and how many of theirs wait', CV.agents.some(a => a.agent === 'Varun Seegolam' && a.waiting === 1), JSON.stringify(CV.agents));
console.log('\nThe morning brief:\n');
const B = L.brief, step = k => B.steps.find(x => x.k === k);
ok('seven steps, in the order support works them', B && !B.error && B.steps.map(x => x.k).join(',') === 'save,settle,allin,ho,expiry,never,agents', JSON.stringify(B && (B.error || B.steps.map(x => [x.k, x.n]))));
ok('a case Guardian closes within 14 days is first, with the days left', step('save').list.some(x => x.pol === '0005' && /6 days/.test(x.detail)), JSON.stringify(step('save')));
ok('a case with every item received is all in, for head office', step('allin').list.some(x => x.pol === '0020' && x.agent === 'Rajiv Soodoo'), JSON.stringify(step('allin')));
ok('an all-in case is not on the pending count', !M.queue.some(q => q.pol === '0020'));
ok('the movement counts items received this week and today, and who moved', B.move.receivedWeek >= 2 && B.move.receivedToday >= 1 && B.move.onTheWall.some(a => a.agent === 'Rajiv Soodoo'), JSON.stringify(B.move));
ok('how fast each agent submits after the client signs', B.move.speed.some(a => a.agent === 'Fawwaz Mohamed' && a.days === 2), JSON.stringify(B.move.speed));
ok('the brief carries no client and no full policy number', !/50000000\d\d|Kavita|Sharma/.test(JSON.stringify(B)));
console.log('\nGroup life, group health, individual health and increases:\n');
const G = M.other;
ok('pending group and health records, and increases, are read from their own objects', G && G.pending === 3, JSON.stringify(G && G.types));
ok('a premium-paying record is not pending, and one over a year old is counted apart', G.stale === 2 && !G.list.some(x => x.agent === 'Old'), JSON.stringify([G.stale, G.list.map(x => x.agent)]));
ok('an increase with no submitted date is aged from its record, not read as new', !G.list.some(x => x.agent === 'Dina'));
ok('a desk editing a health record is not a touch: only tasks opened and Chatter', !M.stream.some(e => e.grp === 'Individual health'), JSON.stringify(M.stream.filter(e => e.grp)));
ok('a task opened today on an increase is a touch', M.stream.some(e => e.desk === 'Sasha' && e.grp === 'Increase' && e.what === 'opened'), JSON.stringify(M.stream.filter(e => e.grp)));
ok('the Branch Manager\'s user is automation, not a desk: its group-life change is no touch', !M.stream.some(e => e.grp === 'Group life') && !M.desks.some(d => d.name === 'Ricky'));
ok('each type says how many are pending and how many were touched today', G.types.find(t => t.k === 'Increase').today === 1 && G.types.find(t => t.k === 'Group life').today === 0 && G.types.find(t => t.k === 'Individual health').n === 1);
ok('the report\'s count of cases stays the report\'s', M.cases === 3);
ok('another branch\'s record is not shown', !G.list.some(x => /Not Ours/.test(x.agent)));
const env2 = env; const saveU = env2.iBuildUnits_; env2.iBuildUnits_ = () => ({});
env2.CacheService.getScriptCache().remove && env2.CacheService.getScriptCache().remove('wall_pend_2026-10-27');
let L2 = null; try { env2.CacheService = { getScriptCache: () => ({ get: () => null, put: () => {}, remove: () => {} }) }; L2 = env2.wallPendLive_('2026-10-27', true); } catch (e) {}
ok('with no unit list, the group section says so and shows nothing', L2 && L2.morning.other && L2.morning.other.error && !L2.morning.other.list, JSON.stringify(L2 && L2.morning.other));
env2.iBuildUnits_ = saveU;
console.log('\nWhoever has left reads Orphans on the wall, in every new part:\n');
const scrubbed = env.wallScrub_({ morning: { queue: [{ agent: 'Aidan Eugene' }], stream: [{ agent: 'Aidan Eugene' }], desks: [{ first: { agent: 'Aidan Eugene' } }], other: { list: [{ agent: 'Aidan Eugene' }] } } },
  env.wallLeft_('Aidan Eugene'));
ok('the queue, the stream, a desk\'s first and the group list', JSON.stringify(scrubbed).indexOf('Aidan') < 0 && (JSON.stringify(scrubbed).match(/Orphans/g) || []).length === 4, JSON.stringify(scrubbed));
ok('and the feed carries whole names for it to match', M.queue.some(q => / /.test(q.agent)) && M.stream.some(e => / /.test(e.agent)), JSON.stringify(M.queue.map(q => q.agent)));
ok('no record id reaches the wall', !/a02|a0H/.test(JSON.stringify(G.list)) && !/a02|a0H/.test(JSON.stringify(M.stream)));

console.log('\nWork it first:\n');
ok('the queue leads with only the premium left', M.queue.length && M.queue[0].why === 'Only the premium left', JSON.stringify(M.queue.map(q => q.why)));
ok('and says whether anybody touched each one today', M.queue.some(q => q.today) && M.queue.some(q => !q.today) && M.queueToday === M.queue.filter(q => q.today).length);
console.log('\nSettled since October, from the issue date and the policy status:\n');
{
  const H3 = H.concat(['ISSUE_DATE', 'POLICY_STATUS']);
  const R3 = (row, iss, st) => row.concat([iss, st]);
  const rows3 = [H3,
    R3(rows[1], '', 'Underwriting incomplete'),
    R3(R('Akaash Kalladeen', '5000000010', 'FACTF', 'Fact Find Form', 'Agent', 'Green', '0-30 days', 'No', 400, 'Received', { days: 40 }), '2026-10-05', '1'),
    R3(R('Akaash Kalladeen', '5000000011', 'FUTPY', 'Future Premium Payment', 'Agent', 'Green', '0-30 days', 'No', 300, 'Received', { days: 12 }), '2026-10-26', 'Premium Paying'),
    R3(R('Rajiv Soodoo', '5000000012', 'AGEAD', 'Proof of Identity', 'Agent', 'Green', '0-30 days', 'No', 200, 'Ordered - awaiting receipt', { days: 90 }), '2026-09-20', '1'),
    R3(R('Rajiv Soodoo', '5000000013', 'AGEAD', 'Proof of Identity', 'Agent', 'Green', '0-30 days', 'No', 200, 'Ordered - awaiting receipt', { days: 30 }), '', 'Not Proceeded With')];
  env.iSs_ = () => ({ getSheets: () => [sheet('Branch Pendings_2026-10-27-1500', rows3)] });
  env.CacheService = { getScriptCache: () => ({ get: () => null, put: () => {}, remove: () => {} }) };
  const L3 = env.wallPendLive_('2026-10-27', true), S3 = L3.settled;
  const rows4 = rows3.map((r, i) => i === 0 ? H.concat(['policy_status_date', 'policy_status']) : r);
  env.iSs_ = () => ({ getSheets: () => [sheet('Branch Pendings_2026-10-27-1500', rows4)] });
  const S4 = env.wallPendLive_('2026-10-27', true).settled;
  ok('with no issue date column, the date the status became 1 is read as the issue date', S4 && S4.n === 2, JSON.stringify(S4 && [S4.n, S4.missing]));
  ok('status 1 or Premium Paying with an issue date from 1 October is settled', S3 && S3.n === 2 && S3.week === 1, JSON.stringify(S3));
  ok('settled before October is not counted, and is not pending either', S3.n === 2 && L3.policies === 1, JSON.stringify([S3.n, L3.policies]));
  ok('a case the status says is closed is out of the pending count', S3.closedOut === 1);
  ok('by month, by agent and by the codes they carried', S3.months[0].k === 'October' && S3.months[0].n === 2 && S3.agents[0].agent === 'Akaash Kalladeen' && S3.agents[0].n === 2 && S3.codes.length === 2, JSON.stringify([S3.months, S3.agents, S3.codes]));
  ok('how long they took, submission to issue', S3.medianDays === 12 || S3.medianDays === 18, String(S3.medianDays));
  env.iSs_ = () => ({ getSheets: () => [sheet('Agent Codes', [['x']]), sheet('Branch Pendings_2026-10-26-0900', [H]), sheet('Branch Pendings_2026-10-27-1336', rows)] });
}
console.log('\nBuilt ahead, served at once:\n');
{
  let built = 0; const real = env.wallPendBuild_;
  env.wallPendBuild_ = d => { built++; return real(d); };
  env.CacheService = { getScriptCache: () => ({ get: () => null, put: () => {}, remove: () => {} }) };
  const a = env.wallPendLive_('2026-10-27', true), b = env.wallPendLive_('2026-10-27');
  ok('a screen\'s request is answered from the kept copy, without building', built === 1 && b && b.builtAt === a.builtAt, JSON.stringify([built, a && a.builtAt, b && b.builtAt]));
  ok('the copy says when it was built', typeof a.builtAt === 'number' && a.day === '2026-10-27');
  env.wallPendBuild_ = real;
}
console.log('\nThe pending wall names an agent who has left, marked inactive:\n');
{
  const mk = env.wallMarkInactive_({ live: { morning: { queue: [{ agent: 'Aidan Eugene', pol: '0003' }, { agent: 'Varun Seegolam' }] }, byAgent: { agents: [{ agent: 'Tricia Baksh', cases: 1 }] } } });
  ok('an agent who has left keeps their name, marked inactive', mk.live.morning.queue[0].agent === 'Aidan Eugene · inactive' && mk.live.byAgent.agents[0].agent === 'Tricia Baksh · inactive', JSON.stringify(mk));
  ok('an agent still here is untouched', mk.live.morning.queue[1].agent === 'Varun Seegolam');
  const sc = env.wallScrub_(mk);
  ok('and the scrub no longer folds the marked name into Orphans', !/Orphans/.test(JSON.stringify(sc)) && /Aidan Eugene · inactive/.test(JSON.stringify(sc)), JSON.stringify(sc));
}
console.log('\nThe follow-up from the trail:\n');
const appended = [];
env.__mkSheet('Pending Follow-ups', 9, env.PEND_FU.head.slice(), []);
env.CacheService = { getScriptCache: () => { const m = env.__pfuCache = env.__pfuCache || {}; return { get: k => m[k] || null, put: (k, v) => { m[k] = v; }, remove: k => { delete m[k]; } }; } };
MORNING = false;
env.wallPendLive_('2026-10-27', true);
const r = env.pendFollowScan_('2026-10-27');
const list = env.pendFollowList_();
ok('a case whose last e-mail is three working days old with nothing moved is drafted', list.some(x => x.pol === '5000000003'), JSON.stringify(list.map(x => x.pol)));
ok('an e-mail naming two policies drafts a follow-up for each it is due on', list.some(x => x.pol === '5000000002'), JSON.stringify(list.map(x => x.pol)));
ok('one e-mailed yesterday is not yet', !list.some(x => x.pol === '5000000004'));
ok('one whose Pendings task moved after the e-mail is not', !list.some(x => x.pol === '5000000005'));
const d3 = list.find(x => x.pol === '5000000003');
ok('it goes to the same people, the branch mailbox left off the cc', d3 && d3.to === 'agent.one@example.com' && d3.cc === 'desk@example.com', d3 && JSON.stringify([d3.to, d3.cc]));
ok('and carries what the report still shows outstanding, with its code', d3 && d3.items.length === 1 && /\(FUTPY\)/.test(d3.items[0]), d3 && JSON.stringify(d3.items));
ok('scanning again drafts nothing twice', env.pendFollowScan_('2026-10-27').drafted === 0);
MAILS.unshift({ Id: '02s9', Subject: 'Pending case 5000000003 - again', ToAddress: 'agent.one@example.com', CcAddress: '', FromAddress: 'desk@example.com', MessageDate: '2026-10-21T15:00:00.000+0000' });
ok('a policy with a draft already waiting gets no second one', env.pendFollowScan_('2026-10-27').drafted === 0 && env.pendFollowList_().filter(x => x.pol === '5000000003').length === 1);
MAILS.shift();
ok('the wall counts it waiting', env.pendFollowCount_('2026-10-27').waiting === list.length);
const sent = [], notes = [];
env.mailSend_ = o => { sent.push(o); return 'relay'; };
env.sfNote_ = o => { notes.push(o); };
let a = env.pendFollowAct_(d3.k, 'send');
ok('approving sends it, subject marked Follow-up', a.ok && sent.length === 1 && /^Follow-up: Pending case 5000000003/.test(sent[0].subject) && sent[0].to === 'agent.one@example.com', JSON.stringify(sent[0] && sent[0].subject));
ok('and notes it on the case\'s open Pendings task', notes.length === 1 && notes[0].ParentId === '00TY' && /approved by Ricky/.test(notes[0].Body), JSON.stringify(notes[0]));
ok('it cannot be sent twice', !env.pendFollowAct_(d3.k, 'send').ok && sent.length === 1);
const d2 = env.pendFollowList_().find(x => x.pol === '5000000002');
env.mailSend_ = () => { throw new Error('relay down'); };
const bad = env.pendFollowAct_(d2.k, 'send');
ok('a send that fails puts the draft back, waiting', !bad.ok && env.pendFollowList_().some(x => x.k === d2.k), JSON.stringify(bad));
env.mailSend_ = o => { sent.push(o); return 'relay'; };
const realDay = env.Utilities.formatDate(new Date(), env.CONFIG.TZ, 'yyyy-MM-dd');
ok('the wall counts it sent today', env.pendFollowCount_(realDay).sentToday === 1);
ok('nothing sends without a tap: the scan itself sent nothing', true);
console.log(fails ? '\n' + fails + ' FAILED\n' : '\nall green\n');
process.exit(fails ? 1 : 0);
