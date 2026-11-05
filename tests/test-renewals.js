// Renewals and premiums owed, on Mr Rampersad's My branch (20 October 2026).
//
// Ricky: "also built into my module, the branch managers module, the renewals
// that are coming for the week, tomorrow, and for the month, and year-to-date
// analytics, as well as the open tasks associated with renewals, the ability
// to move forward the task, comment on the task, and premiums that are owed
// for the month and year-to-date, and what is happening with it."
//
// Pinned here: a term renews the day after its cover ends (property on the
// day itself); it is renewed when the next term is on file, under the same
// policy or the same vehicle; duplicate rows count once; tomorrow, the next 7
// days, the month and the year so far are counted with what is renewed; each
// coming renewal shows the renewal on file, or its task and last note, or
// that nothing is on it; the year month by month; the open renewal tasks, his
// own left on My tasks, each with a note and a date (a move needs a note, a
// past date is refused, every move logged with before and after); life
// premiums owed now, in the last 30 days and since 1 January, lapses this
// month and year, and what is happening on each policy; the two things that
// cannot wait go to the top of Do these first; Akaash's page has no such tab.
//
// EVERY CLIENT, POLICY NUMBER, REGISTRATION AND ADDRESS HERE IS INVENTED,
// and has to stay that way: GitHub Pages serves this repository from its
// root, so `tests/` is on the open web. Real ones were in this file until
// 5 November 2026. When adding a case, invent the client — the fixture is
// about the arithmetic, and a real name adds nothing to it.
const { makeEnv } = require('./harness');
const env = makeEnv();
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };
env.__mkSheet('Access', 1, ['Email', 'Name', 'Agent Number', 'Password', 'Role', 'Unit', 'Active'],
  [['ricky@example.com', 'Ricky Rampersad', 'A00427', '1', 'Branch Manager', 'Ricky Rampersad', 'Active'],
   ['akaash@example.com', 'Akaash Kalladeen', 'A06869', '1', 'Unit Manager', 'Akaash Kalladeen', 'Active']]);
env.todayISO_ = () => '2026-10-20';
env.sfkUsers_ = () => ({ ricky: { id: '005R', active: true }, pawan: { id: '005P', active: true }, azariah: { id: '005A', active: true } });
env.sfkToken_ = () => ({ instance_url: 'https://sf.example', access_token: 't' });
env.MailApp = { sendEmail: () => {}, getRemainingDailyQuota: () => 90 };
env.skillBank_ = () => ({ 'darryl manick': { name: 'Darryl Manick', isAgent: true, active: true, unit: 'Akaash Kalladeen' },
  'javid ali': { name: 'Javid Ali', isAgent: true, active: true, unit: 'Ricky Rampersad' } });
env.openQueries_ = () => []; env.ff360Feed_ = () => null; env.goalFor_ = () => null; env.agentDaySummary_ = () => []; env.ppmLetters_ = () => []; env.signedInAt_ = () => '';
const posts = []; env.sfkInsert_ = (o, b) => { posts.push([o, b]); return 'FEED'; };
const patches = []; env.sfkPatchTask_ = (id, b) => { patches.push([id, b]); return true; };

const R = (id, acct, pol, veh, from, to, next, prem) => ({ Id: id, Account__c: acct, Policy__c: pol, Vehicle__c: veh, Carrier__c: 'Guardian General', From__c: from, To__c: to, Next_Renewal_Date__c: next, Premium_Due__c: prem });
const RISKS = [
  R('a0G1', 'Pretend, Neilla HH', 'TT APG 0000001', 'TAA1111', '2025-11-20', '2026-10-20', null, 4173.94),            // renews tomorrow, nothing on it
  R('a0G2', 'INVENTED COURT LIMITED', 'TT APG 0000002', 'TAA2222', '2025-10-24', '2026-10-23', '2026-10-24', 15890.76), // renews Sat 24, renewed
  R('a0G2n', 'INVENTED COURT LIMITED', 'TT APG 0000002', 'TAA2222', '2026-10-24', '2027-10-23', '2027-10-24', 11937.21),
  R('a0G3', 'MADEUP, MICHAEL HH', 'TT APU 0000003', 'TAA3333', '2025-10-28', '2026-10-27', '2026-10-28', 5280.28),       // renews 28 Oct, a task on it
  R('a0G4', 'SAMPLE METALS UNLIMITED', 'TT AST 0000004', null, '2025-11-01', '2026-11-01', '2026-11-01', 2733.49),            // four copies of one row
  R('a0G4b', 'SAMPLE METALS UNLIMITED', 'TT AST 0000004', null, '2025-11-01', '2026-11-01', '2026-11-01', 2733.49),
  R('a0G4c', 'SAMPLE METALS UNLIMITED', 'TT AST 0000004', null, '2025-11-01', '2026-11-01', '2026-11-01', 2733.49),
  R('a0G4d', 'SAMPLE METALS UNLIMITED', 'TT AST 0000004', null, '2025-11-01', '2026-11-01', '2026-11-01', 2733.49),
  R('a0G5', 'Josiah Client', 'TT APG 0000005', 'TAA4444', '2025-09-23', '2026-09-22', '2026-09-23', 6100),             // September, not renewed
  R('a0G6', 'FICTION, NIGEL Household', 'TTFHO0000006', null, '2025-10-04', '2026-10-04', '2026-10-04', 3900),        // property, due 4 Oct, not renewed
  R('a0G7', 'NOTIONAL, SUNIL HH', 'TT AOG 0000007', 'TBB555', '2025-03-09', '2026-03-08', '2026-03-09', 2070.69),       // March, renewed
  R('a0G7n', 'NOTIONAL, SUNIL HH', 'TT AOG 0000007', 'TBB555', '2026-03-09', '2027-03-08', '2027-03-09', 2100),
  R('a0G8', 'IMAGINED Household', 'OLD 100200', 'TBB6666', '2025-05-11', '2026-05-10', '2026-05-11', 1512.84),       // renewed under a new number
  R('a0G8n', 'IMAGINED Household', 'NEW 300400', 'TBB 6666', '2026-05-11', '2027-05-10', '2027-05-11', 1600)];
const TK = (id, subj, ty, due, status, owner, whatId, what) => ({ Id: id, Subject: subj, Task_Type__c: ty, ActivityDate: due, Status: status, CreatedDate: '2026-10-01T12:00:00.000+0000',
  LastModifiedDate: '2026-10-16T12:00:00.000+0000', Owner: { Name: owner }, Agent__r: { Name: 'Ricky Rampersad' }, What: { Name: what || '' }, WhatId: whatId || '' });
const T1 = TK('00TR1', 'Payment follow up Renewal Date -10/4/2025 Policy # TTFHO0000006 - FICTION, NIGEL Household', 'Renewa/PDl/Bill', '2026-10-19', 'Waiting on someone else', 'Pawan Probhu', 'a0G6', 'RiskDetails-00001');
const T2 = TK('00TR2', 'Orphan premium due: Paid, not showing - 1000000001 SAMPLE CLIENT', 'Renewa/PDl/Bill', '2026-10-22', 'In Progress', 'Azariah Griffith', 'a02X', 'CLIENT-0000003');
const T3 = TK('00TR3', 'Email: Renewal Due -9/23/2026 Policy #TT APG 0000005- Vehicle # - TAA4444', 'Renewa/PDl/Bill', '2026-09-18', 'Escalated', 'Ricky Rampersad', 'a0G5', 'RiskDetails-00002');
const T4 = TK('00TW4', 'Motor value adjustment before renewal', 'Servicing', '2026-10-26', 'In Progress', 'Pawan Probhu', 'a0G3', 'RiskDetails-00003');
const CLOSED = [{ Id: '00TC1', Subject: 'Orphan response: wrote to us - 5000000002 SAMPLE CLAIMANT', Status: 'Completed', CompletedDateTime: '2026-10-15T15:00:00.000+0000', Owner: { Name: 'Azariah Griffith' } }];
const queries = [];
env.sfkQuery_ = q => {
  queries.push(q);
  if (/FROM Risk_Details__c/.test(q)) return RISKS;
  if (/FROM Task/.test(q) && /OwnerId = '005R'/.test(q)) return [Object.assign({}, T3)];
  if (/FROM Task/.test(q) && /IsClosed = true/.test(q) && /Subject LIKE/.test(q)) return CLOSED;
  if (/FROM Task/.test(q) && /Task_Type__c = 'Renewa\/PDl\/Bill'/.test(q)) return [T1, T2, T3];
  if (/FROM Task/.test(q) && /WhatId IN/.test(q)) return /'a0G3'/.test(q) ? [T4] : [];
  if (/FROM Task/.test(q) && /Subject LIKE '%1000000001%'/.test(q)) return [T2];
  return [];
};
env.cmdChatter_ = ids => (ids.indexOf('00TR1') > -1 ? { '00TR1': [{ day: '2026-10-16', by: 'Pawan Probhu', text: 'Client to pay on Friday.' }] } : {});
env.unitBook_ = () => ({ agents: env.unitAgents_('ricky'), closedYday: 0, closedToday: [], open: [
  { id: '00TR1', subject: 'Payment follow up Renewal Date -10/4/2025', agent: 'Ricky Rampersad', owner: 'Pawan Probhu', due: '2026-10-19', late: true, ty: 'Renewa/PDl/Bill', touched: 4, status: 'Waiting on someone else', account: 'X', created: '2026-10-01' },
  { id: '00TR9', subject: 'Health renewal courtesy reminder', agent: 'Ricky Rampersad', owner: 'Pawan Probhu', due: '2026-10-01', late: true, ty: 'Renewa/PDl/Bill', touched: 4, status: 'In Progress', account: 'Y', created: '2026-09-01' },
  { id: '00TP1', subject: 'Medical outstanding', agent: 'Darryl Manick', owner: 'Elizabeth Lee', due: '2026-10-16', late: true, ty: 'Pendings', touched: 9, status: 'In Progress', account: 'Z', created: '2026-10-01' }] });
let cacheLoads = 0;
env.iLoadCache_ = () => { cacheLoads++; return { asOf: '2026-10-20', dues: {
  counts: { total: 4000, overdue: 120, lapsed: 30, pending: 5, clean: 3800 }, modalOverdue: 50000,
  buckets: ['0-30', '31-60', '61-90', '91-180', '181-365', '365+'],
  ageing: { '0-30': { policies: 30, modal: 9000 }, '31-60': { policies: 40, modal: 15000 }, '61-90': { policies: 20, modal: 9000 }, '91-180': { policies: 15, modal: 8000 }, '181-365': { policies: 10, modal: 6000 }, '365+': { policies: 5, modal: 3000 } },
  chase: [{ agent: 'Javid Ali', policy: '1000000001', client: 'SAMPLE CLIENT', modal: 450, days: 75, paidTo: '2026-08-06', lapseOn: '2026-10-24' },
          { agent: 'Darryl Manick', policy: '5000000009', client: 'NOBODY ON IT', modal: 800, days: 60, paidTo: '2026-08-21', lapseOn: '2026-10-23' },
          { agent: 'Javid Ali', policy: '5000000002', client: 'SAMPLE CLAIMANT', modal: 300, days: 40, paidTo: '2026-09-10', lapseOn: '2026-11-30' },
          { agent: 'Javid Ali', policy: '8000000001', client: 'OLD DEBT', modal: 1000, days: 400, paidTo: '2025-09-15', lapseOn: '2025-12-01' }],
  lapsedRecent: [{ agent: 'Javid Ali', policy: '7000000001', client: 'LAPSED IN OCTOBER', modal: 600, lapsedOn: '2026-10-05', daysAgo: 15 },
                 { agent: 'Darryl Manick', policy: '7000000002', client: 'LAPSED IN MARCH', modal: 200, lapsedOn: '2026-03-01', daysAgo: 233 }],
  byAgent: [{ agent: 'Javid Ali', book: 50, overdue: 4, chase: 3, modal: 1750 }, { agent: 'Darryl Manick', book: 40, overdue: 1, chase: 1, modal: 800 }],
  basis: 'Premium is the modal instalment.' } }; };

console.log('\nWhich terms renew when, and which are renewed:\n');
const risks = env.rnRisks_('2026-10-20');
const by = id => risks.find(k => k.id === id);
ok('a term renews the day after its cover ends', by('a0G1').ren === '2026-10-21' && by('a0G2').ren === '2026-10-24', by('a0G1').ren + ' ' + by('a0G2').ren);
ok('a property term on its renewal date', by('a0G6').ren === '2026-10-04');
ok('four copies of one row count once', risks.filter(k => k.policy === 'TT AST 0000004').length === 1);
ok('renewed when the next term is on file', by('a0G2').renewed && by('a0G2').next.to === '2027-10-23' && by('a0G7').renewed && !by('a0G1').renewed && !by('a0G5').renewed);
ok('and when the vehicle renewed under a new policy number', by('a0G8').renewed && by('a0G8').next.policy === 'NEW 300400');
ok('the next terms themselves are not counted as this year\'s', !by('a0G2n') && !by('a0G7n'));

console.log('\nThe Renewals tab:\n');
const U = Object.fromEntries(new URL(env.unitUrl_('ricky')).searchParams);
const page = env.replyClick_({ parameter: U }).getContent();
const rs = page.slice(page.indexOf('data-sec="renew"'), page.indexOf('data-sec="work"'));
const txt = s => s.replace(/<[^>]+>/g, ' ').replace(/&middot;/g, '·').replace(/\s+/g, ' ');
ok('a Renewals tab after My tasks, before Branch work', /data-tab="renew">Renewals/.test(page) && page.indexOf('data-tab="mine"') < page.indexOf('data-tab="renew"') && page.indexOf('data-tab="renew"') < page.indexOf('data-tab="work"'));
ok('its badge counts the overdue renewal tasks', /data-tab="renew">Renewals<i>1<\/i>/.test(page), (page.match(/data-tab="renew">[^/]*/) || [''])[0]);
ok('tomorrow: one, $4k, one to renew', /1 renewing tomorrow · \$4k · 1 to renew/.test(txt(rs)), (txt(rs).match(/[^.]{0,40}renewing tomorrow[^.]{0,40}/) || [''])[0]);
ok('the next 7 days: two, one to renew', /2 in the next 7 days · \$20k · 1 to renew/.test(txt(rs)), (txt(rs).match(/[^.]{0,20}in the next 7 days[^.]{0,40}/) || [''])[0]);
ok('the month: four renewing in October, three to renew', /4 renewing in Oct · \$29k · 3 to renew/.test(txt(rs)), (txt(rs).match(/[^.]{0,20}renewing in Oct[^.]{0,40}/) || [''])[0]);
ok('the year so far: 2 of 4 renewed, 50%', /50% renewed so far this year · 2 of 4/.test(txt(rs)), (txt(rs).match(/[^.]{0,20}renewed so far this year[^.]{0,60}/) || [''])[0]);
const soon = rs.slice(rs.indexOf('id="rn-soon"'), rs.indexOf('id="rn-year"'));
ok('tomorrow\'s, with nothing on it, said so', /Tomorrow · Wed 21 Oct \(1\)/.test(txt(soon)) && /Pretend, Neilla HH · TT APG 0000001 · TAA1111/.test(txt(soon)) && /not renewed yet · no task/.test(soon));
ok('a renewed one shows the renewal on file', /INVENTED COURT LIMITED/.test(soon) && /renewal on file · to 23 Oct 2027 · \$11,937/.test(soon));
ok('one with a task shows who has it, its status and a link to note or move it', /MADEUP, MICHAEL HH/.test(soon) && /Pawan · In Progress · due Mon 26 Oct/.test(soon) && /data-go="r00TW4"/.test(soon));
ok('one due earlier this month with no renewal: its task and last note', /Due earlier in Oct, no renewal on file \(1\)/.test(txt(soon)) && /FICTION/.test(soon) && /overdue since Mon 19 Oct/.test(soon) && /Client to pay on Friday\./.test(soon));
const yr = rs.slice(rs.indexOf('id="rn-year"'), rs.indexOf('id="rn-tasks"'));
ok('the year: due, renewed, not renewed, premium', /Due 1 Jan to today: 4 · \$13,584 premium\. Renewed 2 \(50%\) · \$3,584\. No renewal on file 2 · \$10,000\./.test(txt(yr)), txt(yr).slice(0, 220));
ok('month by month, as bars and a table', /<svg viewBox="0 0 300 92"/.test(yr) && /<td[^>]*>Sep<\/td><td[^>]*>1<\/td><td[^>]*>0<\/td><td[^>]*>1<\/td>/.test(yr));
ok('the ones with no renewal on file, largest first', /No renewal on file this year \(2\), largest first/.test(yr) && yr.indexOf('Josiah Client') < yr.indexOf('FICTION'));
const tk = rs.slice(rs.indexOf('id="rn-tasks"'), rs.indexOf('id="rn-life"'));
ok('the open renewal and premium tasks, grouped by when they are due', /Open renewal and premium tasks \(3 · 1 overdue\)/.test(txt(tk)) && /Overdue \(1\)/.test(txt(tk)) && /Due this week, to Tue 27 Oct \(2\)/.test(txt(tk)));
ok('each with a date and a note', ['00TR1', '00TR2', '00TW4'].every(id => new RegExp('name="rmv_' + id + '"').test(tk) && new RegExp('name="rc_' + id + '"').test(tk)));
ok('his own is left on My tasks, and said so', !/00TR3/.test(tk) && /1 of your own is on My tasks/.test(tk) && /name="done_00TR3"/.test(page));
const work = page.slice(page.indexOf('data-sec="work"'), page.indexOf('data-sec="agents"'));
ok('Branch work no longer repeats the renewal tasks', !/00TR1|00TR9/.test(work) && /00TP1/.test(work));
const life = rs.slice(rs.indexOf('id="rn-life"'));
ok('premiums owed now, in the last 30 days, since 1 January; lapses this month and year', /120 policies behind now · \$50k in premiums owed/.test(txt(life)) && /30 fell due in the last 30 days, unpaid · \$9k/.test(txt(life)) &&
  /33 fell due since 1 Jan, unpaid · \$11k/.test(txt(life)) && /1 lapsed in Oct · 2 this year, \$800/.test(txt(life)), txt(life).slice(0, 400));
ok('how long behind, by band', /0–30 days/.test(life) && /365\+ days/.test(life) && /40 · \$15k/.test(life));
ok('lapsing next, soonest first', life.indexOf('NOBODY ON IT') < life.indexOf('SAMPLE CLIENT') && life.indexOf('SAMPLE CLIENT') < life.indexOf('SAMPLE CLAIMANT') && !/OLD DEBT/.test(life.slice(0, life.indexOf('Owed 31+'))));
ok('what is happening: the open task naming the policy', /SAMPLE CLIENT/.test(life) && /Azariah · In Progress · due Thu 22 Oct/.test(life) && /data-go="r00TR2"/.test(life));
ok('or the last task closed on it', /SAMPLE CLAIMANT[\s\S]*no task open<\/span> last: Azariah closed Thu 15 Oct/.test(life));
ok('or that no one is on it', /NOBODY ON IT[\s\S]*no one is on it/.test(life));
ok('lapsed this month', /Lapsed in Oct \(1 · \$600\)/.test(txt(life)) && /LAPSED IN OCTOBER/.test(life) && !/LAPSED IN MARCH/.test(life));
ok('owed 31+ days by agent', /Owed 31\+ days, by agent/.test(life) && /Javid Ali/.test(life));
ok('the dues are read once and kept', cacheLoads === 1 && (env.rnLife_('2026-10-20'), cacheLoads === 1));
const top = page.slice(page.indexOf('Do these first'), page.indexOf('data-tab="today"'));
ok('Do these first: the renewal tomorrow with nothing on file', /1 renewal due by tomorrow with nothing on file/.test(top) && /Pretend/.test(top) && /data-go="rn-soon"/.test(top));
ok('and the life policy lapsing within a week with no one on it', /1 life policy lapses within a week, with no one on it/.test(top) && /NOBODY ON IT \$800/.test(top) && /data-go="rn-life"/.test(top));

console.log('\nNotes and new dates on renewal tasks:\n');
let sv = env.replyPost_({ parameter: Object.assign({}, U, { rmv_00TR1: '2026-10-23' }) }).getContent();
ok('a new date with no reason is refused', /NOT MOVED: say why the date moves/.test(sv) && !patches.length && !posts.length);
sv = env.replyPost_({ parameter: Object.assign({}, U, { rmv_00TR1: '2026-10-10', rc_00TR1: 'Chasing.' }) }).getContent();
ok('a date in the past is refused, the note still goes', /NOT MOVED: pick a date from today on/.test(sv) && !patches.length && posts.some(x => x[1].ParentId === '00TR1' && /Chasing\./.test(x[1].Body)));
posts.length = 0;
sv = env.replyPost_({ parameter: Object.assign({}, U, { rmv_00TR1: '2026-10-23', rc_00TR1: 'Client paying Friday; Pawan collects then.', rc_00TR2: 'Azariah, send me the receipt.' }) }).getContent();
ok('with a reason it moves, and the reason goes on the task signed as Branch Manager', patches.some(x => x[0] === '00TR1' && x[1].ActivityDate === '2026-10-23') &&
  posts.some(x => x[1].ParentId === '00TR1' && /^Branch Manager · Ricky Rampersad/.test(x[1].Body) && /Pawan collects then/.test(x[1].Body)), sv.replace(/<[^>]+>/g, ' ').slice(0, 300));
ok('a note alone goes on its task', posts.some(x => x[1].ParentId === '00TR2' && /send me the receipt/.test(x[1].Body)) && !patches.some(x => x[0] === '00TR2'));
const tc = env.SpreadsheetApp.getActive().getSheetByName('Task Changes');
ok('the move is kept with before and after, to undo', !!tc && tc._grid.some(r => r[2] === '00TR1' && r[4] === 'Due date' && r[5] === '2026-10-19' && r[6] === '2026-10-23'));
const dm = env.SpreadsheetApp.getActive().getSheetByName('Due Moves');
ok('and on Due Moves, under Pawan, noted', !!dm && dm._grid.some(r => r[1] === '00TR1' && r[3] === 'Pawan Probhu' && r[7] === 'yes'), dm && JSON.stringify(dm._grid.slice(1)));

console.log('\nOnly the Branch Manager:\n');
const ap = env.replyClick_({ parameter: Object.fromEntries(new URL(env.unitUrl_('akaash')).searchParams) }).getContent();
ok('Akaash\'s My unit has no Renewals tab', /My unit · /.test(ap) && !/data-tab="renew"/.test(ap));

console.log(fails ? '\n' + fails + ' FAILED' : '\nAll passed');
process.exit(fails ? 1 : 0);
