// The block that closes itself.
//
// "At the end of the time block the system should automatically log, as it
// reads the Salesforce environment, and send the email at the end of the time
// block with the % achieved — what I selected to have completed and what was
// achieved. If not achieved, in the email I am to respond to each as to why,
// and the responses stored." (17 September 2026.)
//
// Three rules carry the whole thing, and each is pinned here. A block closes
// on its own clock, read off the person's own schedule. Salesforce is the
// judge of a picked task — not the person, not the closer. And the e-mail
// goes out only when something was missed: a clean block passes in silence,
// a day that was never opened is not written to, and a Salesforce that did
// not answer is not a verdict.
const { makeEnv } = require('./harness');
const env = makeEnv();
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };

const realDate = env.Date;
let NOW = new Date('2026-09-17T10:20:00');
const setNow = iso => { NOW = new Date(iso); };
env.Date = new Proxy(realDate, { construct(t, a) { return a.length ? new realDate(...a) : new realDate(NOW.getTime()); },
                                 get(t, k) { return k === 'now' ? () => NOW.getTime() : t[k]; } });
const TODAY = '2026-09-17';

/* ── 1. The block's own clock ───────────────────────────────────────────── */
console.log('\nEvery block time the schedule writes reads as a window:\n');
[['8 – 10am', 480, 600], ['10 – 12pm', 600, 720], ['1 – 3pm', 780, 900], ['3 – 4pm', 900, 960],
 ['3:30 – 5pm', 930, 1020], ['3 – 4:30pm', 900, 990], ['2 – 3:30pm', 840, 930], ['9 – 11am', 540, 660],
 ['9 – 10am', 540, 600], ['8 – 9am', 480, 540], ['5 – 10am', 300, 600], ['4pm – 12am', 960, 1440],
 ['3 – 5pm', 900, 1020], ['2:30 – 4pm', 870, 960], ['11 – 1pm', 660, 780], ['10 – 1pm', 600, 780],
 ['1 – 2:30pm', 780, 870]].forEach(([t, s, e]) => {
  const sp = env.parseSpan_(t);
  ok(t + ' → ' + env.mmText_(s) + '–' + env.mmText_(e), !!sp && sp.start === s && sp.end === e, JSON.stringify(sp));
});
ok('an end with no am/pm is not guessed at', env.parseSpan_('8 – 10') === null);
ok('rubbish is not a window', env.parseSpan_('all day') === null && env.parseSpan_('') === null);
let unparsed = [];
Object.keys(env.SCHEDULE).forEach(sid => Object.keys(env.SCHEDULE[sid].blocks).forEach(b => {
  if (!env.blockSpan_(sid, b)) unparsed.push(sid + '.' + b);
}));
ok('every scheduled block of every desk has a window', !unparsed.length, unparsed.join(', '));
ok('a desk not on the schedule gets the default four', env.blockSpan_('nobody', 'KPI1').end === 600 && !env.blockSpan_('nobody', 'EVE'));
ok('local eight is 12:00Z — Port of Spain is four behind, all year', env.sfkUtcAt_(TODAY, 480) === '2026-09-17T12:00:00Z');
ok('local midnight is 04:00Z the next day', env.sfkUtcAt_(TODAY, 1440) === '2026-09-18T04:00:00Z');

/* ── 2. The fixture: a branch, a day, a Salesforce ──────────────────────── */
env.__mkSheet('Access', 1, ['Name', 'StaffId', 'Email', 'Password', 'Role', 'Unit', 'Active'],
  [['Ada Quill', 'ada', 'ada@example.com', '1', 'Sales Support Assistant', 'Support', 'Yes'],
   ['Bram Quill', 'bram', 'bram@example.com', '1', 'Unit Manager', 'Unit', 'Yes'],
   ['Cleo Quill', 'cleo', 'cleo@example.com', '1', 'Sales Support Assistant', 'Support', 'Yes'],
   ['Dev Quill', 'dev', 'dev@example.com', '1', 'Sales Support Assistant', 'Support', 'Yes'],
   ['Ricky Rampersad', 'ricky', 'ricky@example.com', '1', 'Branch Manager', 'Branch', 'Yes']]);
env.__mkSheet('KPI Log', 2, env.LOG_HEADERS.slice(), []);
env.__mkSheet('KPI Training', 3, ['TrainingDate', 'StaffId', 'Trainer', 'Block', 'Trainee', 'Topic'], []);
env.__mkSheet('Attendance', 4, env.ATT.head.slice(),
  [[TODAY, 'ada', 'Ada Quill', '08:01', '10:10', '', 'in', '', 'ada', ''],
   [TODAY, 'bram', 'Bram Quill', '', '', '', 'absent', 'Sick', 'bram', ''],
   [TODAY, 'cleo', 'Cleo Quill', '11:00', '11:00', '', 'in', '', 'cleo', ''],     // in late: her first block ended before she arrived
   [TODAY, 'ricky', 'Ricky Rampersad', '05:10', '10:10', '', 'in', '', 'ricky', '']]);
   // dev has no row at all: a day nobody opened.

const id = n => '00T' + String(n).padStart(12, '0') + 'AAA';     // 18 characters, like the real thing
const sent = [];
env.MailApp = { sendEmail: m => { sent.push(m); } };
env.sfkConfigured_ = () => true;
env.sfkUsers_ = () => ({ ada: { id: '005A', name: 'Ada Quill', active: true },
                         ricky: { id: '005R', name: 'Ricky Rampersad', active: true } });
const asked = [];
let sfDown = false;
// What Salesforce holds: A closed in the block, B moved in it, C never touched, D closed but never planned.
const tasks = { [id(1)]: 'Completed', [id(2)]: 'In Progress', [id(3)]: 'Not Started', [id(4)]: 'Completed' };
const activity = { '005A': [
  { Id: id(1), Subject: 'Send the renewal notice — Pretend Ltd', Status: 'Completed', Task_Type__c: 'Renewa/PDl/Bill' },
  { Id: id(2), Subject: 'Chase the premium due — Sample', Status: 'In Progress', Task_Type__c: 'Renewa/PDl/Bill' },
  { Id: id(4), Subject: 'Bill the group scheme — Fictitious & Co', Status: 'Completed', Task_Type__c: 'Renewa/PDl/Bill' }
] };
env.sfkQuery_ = soql => {
  asked.push(soql);
  if (sfDown) throw new Error('Salesforce query failed: 503');
  if (/FROM Task WHERE Id IN/.test(soql)) {
    return Object.keys(tasks).filter(k => soql.indexOf(k) > -1).map(k => ({ Id: k, Status: tasks[k] }));
  }
  const m = soql.match(/OwnerId = '([^']+)'/);
  return (m && activity[m[1]]) || [];
};
const ada = { staffId: 'ada', name: 'Ada Quill', manager: false };
const mgr = { staffId: 'ricky', name: 'Ricky Rampersad', manager: true };

/* ── 3. The plan ────────────────────────────────────────────────────────── */
console.log('\nSaying what a block is for:\n');
let r = env.savePlan_({ date: TODAY, block: 'kpi1', items: [
  { k: 'sf', id: id(1), subject: 'Send the renewal notice — Pretend Ltd', type: 'Renewa/PDl/Bill' },
  { k: 'sf', id: id(2), subject: 'Chase the premium due — Sample', type: 'Renewa/PDl/Bill' },
  { k: 'sf', id: id(2), subject: 'the same one twice' },
  { k: 'own', label: '  Interview   two recruits ' },
  { k: 'own', label: '' },
  { k: 'nonsense', id: 'x' },
  { k: 'sf', id: 'not-an-id' }
] }, ada);
ok('a plan saves', r.ok, JSON.stringify(r));
ok('three things on it — the repeat, the blank and the rubbish are dropped', r.ok && r.plan.items.length === 3, JSON.stringify(r.plan && r.plan.items));
ok('the person\'s own line is tidied', r.ok && r.plan.items[2].label === 'Interview two recruits');
ok('the block\'s window comes back with it', r.ok && r.plan.span && r.plan.span.endText === '10:00', JSON.stringify(r.plan && r.plan.span));
ok('the block id is upper-cased', r.ok && r.plan.block === 'KPI1');
ok('an unknown block is refused', !env.savePlan_({ date: TODAY, block: 'lunch', items: [] }, ada).ok);
ok('thirty-one things is refused', /week/.test(env.savePlan_({ date: TODAY, block: 'KPI2',
   items: Array.from({ length: 31 }, (_, i) => ({ k: 'own', label: 'thing ' + i })) }, ada).error || ''));
r = env.savePlan_({ date: TODAY, block: 'KPI2', staffId: 'ricky', items: [{ k: 'own', label: 'Sneak onto his plan' }] }, ada);
ok('staff cannot plan somebody else\'s block — it lands on their own', r.ok && !env.planRows_('ricky', TODAY).KPI2 && !!env.planRows_('ada', TODAY).KPI2);
r = env.savePlan_({ date: TODAY, block: 'KPI2', staffId: 'ada', items: [{ k: 'own', label: 'Reconcile the group bill', done: true }] }, mgr);
ok('the manager can plan a block for a desk', r.ok && r.plan.items[0].label === 'Reconcile the group bill');
r = env.plansFor_(ada, { date: TODAY });
ok('the day\'s plans read back with every window', r.ok && r.plans.KPI1.items.length === 3 && Object.keys(r.spans).length === 4, JSON.stringify(r.spans));
ok('nothing is closed yet', !r.plans.KPI1.closedAt && r.plans.KPI1.pct === null);

/* ── 4. Twenty past ten: the morning block has ended ───────────────────── */
console.log('\nAt 10:20 the eight-to-ten block closes itself:\n');
const before = sent.length;
let said = env.closeBlocks({ triggerUid: 'x' });
console.log('  ' + said.split('\n').join('\n  '));
const plan = env.planRows_('ada', TODAY).KPI1;
ok('ada\'s KPI 1 is closed', !!plan && env.timeStr_(plan.ClosedAt) === '10:20', plan && String(plan.ClosedAt));
ok('one of three done — Salesforce says A is complete, B was moved, the interviews were never ticked',
   plan && Number(plan.Achieved) === 1 && Number(plan.Of) === 3 && Number(plan.Pct) === 33, plan && [plan.Achieved, plan.Of, plan.Pct].join('/'));
const items = env.planItemsOf_(plan.Items);
ok('and each line says which', items.map(i => i.state).join(',') === 'done,moved,unconfirmed', items.map(i => i.state).join(','));
ok('Salesforce was asked for the block\'s own window, in UTC',
   asked.some(q => /OwnerId = '005A'/.test(q) && /LastModifiedDate >= 2026-09-17T12:00:00Z AND LastModifiedDate < 2026-09-17T14:00:00Z/.test(q)),
   asked.filter(q => /005A/.test(q)).join(' | ').slice(0, 200));
ok('what Salesforce saw is on the record: 2 closed, 1 moved', Number(plan.SFClosed) === 2 && Number(plan.SFMoved) === 1);
ok('ada\'s KPI 2 is still running and untouched', !env.planRows_('ada', TODAY).KPI2.ClosedAt);

const log = env.__sheets['KPI Log']._grid, H = log[0];
const adaRow = log.slice(1).find(x => x[H.indexOf('StaffId')] === 'ada');
ok('the block was filed for her, because she had not', !!adaRow && /^Closed automatically at 10:20 from Salesforce: 2 closed, 1 moved · planned 3, done 1\.$/.test(String(adaRow[H.indexOf('KPI1_Actioned')])),
   adaRow && String(adaRow[H.indexOf('KPI1_Actioned')]));
ok('marked as the closer\'s filing, not her words', adaRow && adaRow[H.indexOf('KPI1_Quality')] === 'auto');
ok('what closed is in Resolved', adaRow && /Pretend Ltd; Bill the group scheme/.test(String(adaRow[H.indexOf('KPI1_Resolved')])));
ok('what did not is in Open', adaRow && /Chase the premium due — Sample; Interview two recruits/.test(String(adaRow[H.indexOf('KPI1_Open')])));
ok('a third done is "partly"', adaRow && adaRow[H.indexOf('KPI1_Met')] === 'partly');
ok('the block carries the schedule\'s KPI', adaRow && adaRow[H.indexOf('KPI1')] === '');   // the default schedule names none
ok('the day is marked submitted, with a timestamp on the block', adaRow && adaRow[H.indexOf('Status')] === 'Submitted' && !!adaRow[H.indexOf('KPI1_At')]);
ok('plan row says who filed', plan.Filed === 'auto');

const adaMail = sent.find(m => m.to === 'ada@example.com');
ok('ada is e-mailed, because two things were missed', !!adaMail, sent.map(m => m.to).join(','));
ok('the subject says the score', adaMail && /KPI 1 closed · Thu 17 Sep · 1 of 3 done/.test(adaMail.subject), adaMail && adaMail.subject);
ok('the body says the percentage', adaMail && /1 of 3 done — <b>33%<\/b>/.test(adaMail.htmlBody));
ok('the done one is ticked', adaMail && /&#10003;<\/span> Send the renewal notice/.test(adaMail.htmlBody));
ok('the moved one says so, and how it would count', adaMail && /moved, not closed/.test(adaMail.htmlBody) && /close it in Salesforce and it counts/.test(adaMail.htmlBody));
ok('her own line offers Done and Say why', adaMail && /a=done/.test(adaMail.htmlBody) && (adaMail.htmlBody.match(/a=why/g) || []).length === 2);
ok('a Salesforce task offers only Say why', adaMail && (adaMail.htmlBody.match(/a=done/g) || []).length === 1);
ok('and it says what Salesforce saw', adaMail && /2 closed · 1 moved/.test(adaMail.htmlBody) && /Bill the group scheme/.test(adaMail.htmlBody));

const rickyPlan = env.planRows_('ricky', TODAY).KPI1;
ok('the branch manager\'s five-to-ten closed too', !!rickyPlan && !!String(rickyPlan.ClosedAt).trim());
ok('with nothing planned, filed or seen it says so', rickyPlan && /nothing planned, filed, closed or moved/.test(String(rickyPlan.Note)), rickyPlan && rickyPlan.Note);
ok('and nothing was filed for him — there was nothing to file', rickyPlan && rickyPlan.Filed === '' && !log.slice(1).some(x => x[H.indexOf('StaffId')] === 'ricky'));
const rickyMail = sent.find(m => m.to === 'ricky@example.com');
ok('he is asked what he was on', !!rickyMail && /nothing recorded/.test(rickyMail.subject) && /Say what you were on/.test(rickyMail.htmlBody), rickyMail && rickyMail.subject);
ok('his after-four block is not closed at twenty past ten', !env.planRows_('ricky', TODAY).EVE);

const cleoPlan = env.planRows_('cleo', TODAY).KPI1;
ok('cleo\'s eight-to-ten closed silently — it ended before she signed in at eleven',
   !!cleoPlan && /ended before sign-in at 11:00/.test(String(cleoPlan.Note)) && !sent.some(m => m.to === 'cleo@example.com'), cleoPlan && cleoPlan.Note);
ok('bram was absent and is not written to; dev never opened the day',
   !env.planRows_('bram', TODAY).KPI1 && !env.planRows_('dev', TODAY).KPI1 && !sent.some(m => /bram|dev/.test(m.to)));
ok('two e-mails in all', sent.length - before === 2, String(sent.length - before));

console.log('\nAnd an hour later nothing happens twice:\n');
const mails = sent.length, asks = asked.length;
said = env.closeBlocks({ triggerUid: 'x' });
ok('the closer finds nothing to do', /Nothing to close/.test(said), said);
ok('no second e-mail, no second read', sent.length === mails && asked.length === asks);

/* ── 5. The links in the e-mail ─────────────────────────────────────────── */
console.log('\nThe links in the e-mail:\n');
const q = u => { const o = {}; u.split('?')[1].split('&').forEach(kv => { const [k, v] = kv.split('='); o[k] = decodeURIComponent(v); }); return o; };
let page = env.blockClick_({ parameter: q(env.blockUrl_('ada', TODAY, 'KPI1', 1, 'why')) });
ok('"say why" opens a form', !!page && /<form method="post"/.test(page.getContent()) && /Chase the premium due/.test(page.getContent()));
page = env.blockReasonPost_({ parameter: Object.assign(q(env.blockUrl_('ada', TODAY, 'KPI1', 1, 'why')), { why: 'Client not reachable, tried twice' }) });
ok('the reason is taken', !!page && /on the record/.test(page.getContent()), page && page.getContent().slice(0, 120));
let after = env.planItemsOf_(env.planRows_('ada', TODAY).KPI1.Items);
ok('and kept against the line', after[1].state === 'explained' && after[1].reason === 'Client not reachable, tried twice', JSON.stringify(after[1]));
const reasons = env.__sheets['Block Reasons'];
ok('and on its own tab, with the day, the block and the line', !!reasons && reasons._grid.length === 2 &&
   reasons._grid[1][env.BREASON.head.indexOf('Reason')] === 'Client not reachable, tried twice' &&
   reasons._grid[1][env.BREASON.head.indexOf('Block')] === 'KPI1' && reasons._grid[1][env.BREASON.head.indexOf('Source')] === 'email');
page = env.blockClick_({ parameter: q(env.blockUrl_('ada', TODAY, 'KPI1', 2, 'done')) });
ok('"done" on her own line records it', !!page && /Recorded as done/.test(page.getContent()));
after = env.planItemsOf_(env.planRows_('ada', TODAY).KPI1.Items);
ok('and the score moves: two of three', after[2].state === 'done' && Number(env.planRows_('ada', TODAY).KPI1.Achieved) === 2 && Number(env.planRows_('ada', TODAY).KPI1.Pct) === 67);
page = env.blockClick_({ parameter: q(env.blockUrl_('ada', TODAY, 'KPI1', 0, 'done')) });
ok('"done" on a Salesforce task is refused — Salesforce decides those', !!page && /counts when it is closed in Salesforce/.test(page.getContent()));
const forged = env.blockClick_({ parameter: Object.assign(q(env.blockUrl_('ada', TODAY, 'KPI1', 2, 'done')), { k: 'not-the-key' }) });
ok('a forged key is turned away', !!forged && /expired/.test(forged.getContent()));
const other = env.blockClick_({ parameter: Object.assign(q(env.blockUrl_('ada', TODAY, 'KPI1', 2, 'done')), { bk: 'ricky' }) });
ok('and a key does not open another desk', !!other && /expired/.test(other.getContent()));
page = env.blockReasonPost_({ parameter: Object.assign(q(env.blockUrl_('ricky', TODAY, 'KPI1', 'block', 'why')), { why: 'Two recruit interviews at the office' }) });
ok('a block with nothing on it takes a reason for the block', !!page && /on the record/.test(page.getContent()) &&
   env.planRows_('ricky', TODAY).KPI1.Note === 'Two recruit interviews at the office');
r = env.blockReason_({ date: TODAY, block: 'KPI1', item: 1, reason: 'Second try, still no answer' }, ada);
ok('the same answer can be given from the tracker', r.ok && r.plan.items[1].state === 'explained' && r.plan.items[1].reason === 'Second try, still no answer');
r = env.blockReason_({ date: TODAY, block: 'KPI1', item: 0, reason: 'Sent, and confirmed by the client' }, ada);
ok('a note on a line that landed does not un-land it', r.ok && r.plan.items[0].state === 'done' && r.plan.items[0].reason === 'Sent, and confirmed by the client' && r.plan.pct === 67);
ok('the tracker is told the block is closed, and the score', r.ok && r.plan.closedAt === '10:20' && r.plan.pct === 67 && r.plan.filed === 'auto');
ok('re-planning a closed block is refused', /has closed/.test(env.savePlan_({ date: TODAY, block: 'KPI1', items: [] }, ada).error || ''));

/* ── 6. A block the person filed, and one Salesforce would not judge ────── */
console.log('\nA block filed by the person is left alone; a clean one is silent:\n');
setNow('2026-09-17T12:30:00');
adaRow[H.indexOf('KPI2_Actioned')] = 'Reconciled 14 group bills, sent 3 queries';
adaRow[H.indexOf('KPI2_At')] = new Date('2026-09-17T11:58:00');
env._entryMemo = null;
const m2 = sent.length;
said = env.closeBlocks({ triggerUid: 'x' });
const k2 = env.planRows_('ada', TODAY).KPI2;
ok('ada\'s ten-to-twelve closed', !!k2 && env.timeStr_(k2.ClosedAt) === '12:30', k2 && String(k2.ClosedAt));
ok('her own words stand — the closer filed nothing over them', k2.Filed === 'person' && adaRow[H.indexOf('KPI2_Actioned')] === 'Reconciled 14 group bills, sent 3 queries' && adaRow[H.indexOf('KPI2_Quality')] !== 'auto');
ok('one of one done, ticked in the morning: 100%', Number(k2.Pct) === 100);
ok('and no e-mail, because nothing was missed', !sent.slice(m2).some(m => m.to === 'ada@example.com'), sent.slice(m2).map(m => m.to).join(','));

console.log('\nWhen Salesforce does not answer, nothing is decided:\n');
setNow('2026-09-17T15:30:00');
sfDown = true;
const m3 = sent.length;
said = env.closeBlocks({ triggerUid: 'x' });
ok('the closer says so and leaves the block open', /did not answer/.test(said) && !env.planRows_('ada', TODAY).PM1, said.split('\n')[0]);
ok('she is not e-mailed about it', !sent.slice(m3).some(m => m.to === 'ada@example.com'), sent.slice(m3).map(m => m.to).join(','));
sfDown = false;
said = env.closeBlocks({ triggerUid: 'x' });
ok('the next hour picks it up', !!env.planRows_('ada', TODAY).PM1 && !!String(env.planRows_('ada', TODAY).PM1.ClosedAt).trim());

/* ── 7. After midnight, yesterday's after-four block ────────────────────── */
console.log('\nThe after-four block closes in the small hours:\n');
setNow('2026-09-18T00:40:00');
env.__sheets['Attendance']._grid.push(['2026-09-18', 'ricky', 'Ricky Rampersad', '00:05', '00:05', '', 'in', '', 'ricky', '']);
env.forgetHr_(env.ATT);
said = env.closeBlocks({ triggerUid: 'x' });
const eve = env.planRows_('ricky', TODAY).EVE;
ok('yesterday\'s four-to-midnight is closed', !!eve && !!String(eve.ClosedAt).trim(), said.split('\n').filter(l => /EVE/.test(l)).join(' | '));
ok('read from Salesforce across the local midnight, in UTC',
   asked.some(q => /OwnerId = '005R'/.test(q) && /LastModifiedDate >= 2026-09-17T20:00:00Z AND LastModifiedDate < 2026-09-18T04:00:00Z/.test(q)));
ok('today\'s blocks are not closed at twenty to one', !env.planRows_('ricky', '2026-09-18').KPI1);

/* ── 8. The closer's filing is nobody's words ───────────────────────────── */
console.log('\nAn auto-filed block is neither full nor thin:\n');
const idx = {}; H.forEach((h, i) => { idx[h] = i; });
const ds = env.daySubstance_(adaRow, idx);
ok('KPI 1 (auto) is not counted as written; KPI 2 has no quality mark yet', ds.written === 0, JSON.stringify(ds));

console.log('\nThe trigger is installed with the rest:\n');
env.installTriggers();
ok('closeBlocks runs hourly', env.ScriptApp.getProjectTriggers().some(t => t.getHandlerFunction() === 'closeBlocks'));
ok('it is one of the tracker\'s own, so a re-install replaces it', env.MY_TRIGGERS.indexOf('closeBlocks') > -1);

console.log(fails ? '\n' + fails + ' FAILED' : '\nall good');
process.exitCode = fails ? 1 : 0;
