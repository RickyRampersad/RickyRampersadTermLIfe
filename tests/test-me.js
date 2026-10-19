// My day (18 October 2026).
//
// "I need to ensure I can action on the fly and account for my day as well.
// I need to always plan and know what I am doing, and I forget at times and
// need constant reminders."
//
// Pinned here: one link that works every day and only with its own signature;
// plan first when the day is not planned; what is waiting, answered or closed
// (never closed without a note); capture as a task for me, for a desk, or done
// already; the account saved as the day goes; and the check-ins that say plan
// first, then what is next.
const { makeEnv } = require('./harness');
const env = makeEnv();
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };
const DAY = '2026-10-19';
env.todayISO_ = () => DAY;
env.__mkSheet('Access', 1, ['Name', 'StaffId', 'Email', 'Password', 'Role', 'Unit', 'Active'],
  [['Ricky Rampersad', 'ricky', 'ricky@example.com', '1', 'Branch Manager', 'Branch', 'Yes'],
   ['Kamla Dookran', 'kamla', 'kamla@example.com', '1', 'BMA', 'Support', 'Yes']]);
env.managerEmails_ = () => ['ricky@example.com'];
env.sfkUsers_ = () => ({ ricky: { id: '005R' }, kamla: { id: '005K' } });
env.bmSfId_ = () => '005R';
env.sfkToken_ = () => ({ instance_url: 'https://sf.example', access_token: 't' });
env.bmWaiting_ = () => ({
  ask: [{ id: '00TA', subject: 'Agent school list', by: 'Kamla Dookran', said: 'Mr Rampersad, do we run agent school this month?', at: '2026-10-16T14:00:00Z' }],
  mine: [{ id: '00TM', subject: 'New application for Ann Client', due: '2026-10-15', late: true, ty: 'Pendings' }, { id: '00TN', subject: 'Branch meeting notes', due: DAY, late: false, ty: '' }],
  ignored: [{ id: '00TI', subject: 'Call the Smith group', due: '2026-10-14', late: true, owner: 'Kamla Dookran' }], byOwner: {} });
env.deskToday_ = () => ({ ricky: { closed: 3, noted: 3, notes: 5, list: ['Orphan callback: Bo Client', 'Licence pack signed', 'Quote sent'] } });
const writes = [];
env.sfkInsert_ = (o, b) => { writes.push(['insert', o, b]); return o === 'Task' ? '00TNEW' + writes.length : 'FEED'; };
env.sfkPatchTask_ = (id, b) => { writes.push(['patch', id, b]); };
const mails = [];
env.MailApp = { sendEmail: m => mails.push(m), getRemainingDailyQuota: () => 90 };
const q = s => Object.fromEntries(new URL(s).searchParams);

console.log('\nOne link, every day:\n');
const url = env.meUrl_('ricky');
ok('the link names the page and is signed, with no date in it', /f=me/.test(url) && /k=/.test(url) && !/d=/.test(url), url);
let page = env.replyClick_({ parameter: q(url) }).getContent();
ok('it opens My day', /My day · /.test(page) && /Keep this link on your home screen/.test(page));
ok('a wrong signature opens nothing', /That link is not right/.test(env.replyClick_({ parameter: Object.assign(q(url), { k: 'forged' }) }).getContent()));
env.todayISO_ = () => '2026-10-20';
ok('the same link tomorrow opens tomorrow', /Tuesday 20 October 2026/.test(env.replyClick_({ parameter: q(url) }).getContent()));
env.todayISO_ = () => DAY;

console.log('\nPlan first, then what is next:\n');
ok('not planned: the page says so first, with the plan button', /Plan first/.test(page) && /Plan my day now/.test(page) && /f=um/.test(page) && /class="badge r">Not planned/.test(page));
ok('the day so far: closed and notes', /3 closed today/.test(page) && /5 notes written/.test(page) && /Licence pack signed/.test(page));
ok('next up: the question asking you comes first', page.indexOf('Kamla asks you: Agent school list') > -1 && page.indexOf('Kamla asks you') < page.indexOf('New application for Ann Client'));
ok('your own tasks, new business first, with a close', /New business · overdue since Thu 15 Oct/.test(page) && /name="done" value="00TM"/.test(page));
ok('your instructions with no note, to chase', /No note from Kamla: Call the Smith group/.test(page));
ok('capture: for me, for a desk, done already', /name="cap"/.test(page) && /value="me" checked/.test(page) && /value="desk"/.test(page) && /value="done"/.test(page));
ok('the account against the plan', /Account for your day · against your plan/.test(page) && /name="a_recruit"/.test(page));

console.log('\nOn the fly:\n');
const post = form => env.replyPost_({ parameter: Object.assign(q(url), form), parameters: { done: [].concat(form.done || []) } }).getContent();
writes.length = 0;
page = post({ done: '00TM' });
ok('closing without a note is refused', /a closed task without a note is not closed/.test(page) && !writes.some(w => w[0] === 'patch'));
writes.length = 0;
page = post({ c_00TA: 'Yes, Thursday at 9.', c_00TM: 'Application submitted today.', done: '00TM' });
ok('an answer goes on Chatter', writes.some(w => w[1] === 'FeedItem' && w[2].ParentId === '00TA' && /Yes, Thursday at 9\./.test(w[2].Body)));
ok('a close: the note first, then the close', (() => { const i = writes.findIndex(w => w[1] === 'FeedItem' && w[2].ParentId === '00TM'), j = writes.findIndex(w => w[0] === 'patch' && w[1] === '00TM'); return i > -1 && j > i && writes[j][2].Status === 'Completed'; })());
writes.length = 0;
page = post({ cap: 'Call Ann Client about her surrender\nAgent school list to Kamla', capm: 'me' });
ok('captured lines become your tasks, due today', writes.filter(w => w[1] === 'Task').length === 2 && writes.every(w => w[1] !== 'Task' || (w[2].OwnerId === '005R' && w[2].ActivityDate === DAY && w[2].Status === 'Not Started')) && /task for you, due today/.test(page));
writes.length = 0;
page = post({ cap: 'Pull the lapse list', capm: 'desk' });
ok('for a desk, the desk must be chosen', /choose which desk/.test(page) && !writes.length);
page = post({ cap: 'Pull the lapse list', capm: 'desk', capto: 'kamla', capd: '2026-10-21' });
ok('for a desk: her task, her date, a note on it', writes.some(w => w[1] === 'Task' && w[2].OwnerId === '005K' && w[2].ActivityDate === '2026-10-21') && writes.some(w => w[1] === 'FeedItem' && /Pull the lapse list/.test(w[2].Body)) && /task for Kamla, due Wed 21 Oct/.test(page));
writes.length = 0;
page = post({ cap: 'Met the Dansteel HR manager', capm: 'done' });
ok('done already: logged as a completed task, so it counts', writes.length === 1 && writes[0][2].Status === 'Completed' && /logged as done/.test(page));
page = post({ a_recruit: '2', an_recruit: 'Two names from the seminar', summary: 'Good morning on recruitment.' });
ok('the account is saved as the day goes', /Your account · <b>2 lines saved/.test(page));
const eve = env.mgrRows_('ricky', DAY, 'eve');
ok('and reads back on the page', eve.recruit && String(eve.recruit.Done) === '2' && /value="2"/.test(page) && /Good morning on recruitment\./.test(page));

console.log('\nThe check-ins:\n');
ok('7, 9 and 1 by default; a Script Property changes them', env.meNudgeTimes_().join() === '420,540,780' && (env.PropertiesService.getScriptProperties().setProperty('BM_NUDGES', '7:30, 10,13'), env.meNudgeTimes_().join() === '450,600,780'));
mails.length = 0;
env.sendMeNudge_('ricky', DAY, 7 * 60);
ok('not planned: it says plan first', mails.length === 1 && /7:00am check-in · plan your day/.test(mails[0].subject) && /Your day is not planned yet/.test(mails[0].htmlBody) && /Plan my day now/.test(mails[0].htmlBody), mails[0] && mails[0].subject);
ok('with the next three and the link, to Ricky alone', /Kamla asks you: Agent school list/.test(mails[0].htmlBody) && /f=me/.test(mails[0].htmlBody) && !mails[0].cc);
env.mgrWrite_('ricky', DAY, 'plan', [{ Item: 'recruit', Question: 'Recruitment', Planned: '3', Note: '' }]);
mails.length = 0;
env.sendMeNudge_('ricky', DAY, 9 * 60);
ok('planned: it leads with what is next', /9:00am check-in · next: Kamla asks you: Agent school list/.test(mails[0].subject) && !/not planned/.test(mails[0].htmlBody), mails[0].subject);


console.log('\nAccountable:\n');
const P = env.PropertiesService.getScriptProperties();
P.setProperty('BM_NUDGES', '7,9,13');
P.setProperty('me_log_ricky_' + DAY, '07:20');
let self = env.bmSelf_('ricky', DAY, 11 * 60, { closed: 3, noted: 2, notes: 5 });
ok('planned, and the time of the first plan is kept', self.planned && /^\d\d:\d\d$/.test(self.planAt), self.planAt);
ok('by 11: the 7:00 check-in answered, the 9:00 missed, the 1:00 not yet due', self.checks[0].answered && self.checks[1].missed && !self.checks[2].due, JSON.stringify(self.checks));
ok('each planned number against the account', self.items.length === 1 && self.items[0].q === 'New recruits' && self.items[0].planned === 3 && self.items[0].done === 2 && self.met === 0);
ok('the day is accounted', self.accounted);
const said = env.bmVerdict_(self, 'mid').map(x => x.t).join(' ');
ok('the verdict names the missed check-in, the shortfall and the close with no note', /9:00am check-in/.test(said) && /New recruits \(2 of 3\)/.test(said) && /1 of the 3 you closed today carries no note/.test(said), said);
mails.length = 0;
env.sendMeNudge_('ricky', DAY, 13 * 60);
ok('the 1pm check-in says the 9:00 one was missed, and where the plan stands', /Nothing was logged after the 9:00am check-in/.test(mails[0].htmlBody) && /New recruits 2 of 3/.test(mails[0].htmlBody));
mails.length = 0;
env.sendBranchManagerProgress_(DAY, 'eve');
const close = mails.find(m => /close out the day/.test(m.subject));
ok('the 3pm close-out leads with you against your plan, and the week', !!close && /You against your plan/.test(close.htmlBody) && /check-ins answered/.test(close.htmlBody) && /This week: planned 1 of 1 day/.test(close.htmlBody), close && close.subject);
ok('the close-out goes to Ricky alone, nobody copied', !!close && !close.cc);
ok('accounted and planned: the subject carries no flag', !!close && !/not planned|not accounted/.test(close.subject), close && close.subject);
env.todayISO_ = () => '2026-10-20';
mails.length = 0;
env.sendBranchManagerProgress_('2026-10-20', 'eve');
const close2 = mails.find(m => /close out the day/.test(m.subject));
ok('a day with no plan and no account says so in the subject', !!close2 && / · not planned · day not accounted/.test(close2.subject), close2 && close2.subject);
ok('and in red in the body', !!close2 && /You have not planned today/.test(close2.htmlBody) && /Your day is not accounted/.test(close2.htmlBody));
ok('the week reads Monday from what was kept and Tuesday live', !!close2 && /This week: planned 1 of 2 days/.test(close2.htmlBody) && /accounted 1 of 2/.test(close2.htmlBody), close2 && (close2.htmlBody.match(/This week:[^<]*/) || [''])[0]);
ok('the 5am review opens with yesterday, against the plan', /Mon 19 Oct, you against your plan:<\/b> planned/.test(env.bmYesterdayLine_('ricky', '2026-10-20')) && /check-ins 1 of 3/.test(env.bmYesterdayLine_('ricky', '2026-10-20')), env.bmYesterdayLine_('ricky', '2026-10-20'));
page = env.replyClick_({ parameter: q(url) }).getContent();
ok('My day shows the progress checks and the week', /Your progress checks/.test(page) && />WEEK</.test(page) && /This week:/.test(page));
env.todayISO_ = () => DAY;

console.log('\nClosing the performance letters:\n');
const closedL = [];
env.ppmLetters_ = () => [{ 'Letter ID': 'L1', 'Agent Name': 'Agent One', 'Performance Period': 'Q2 2026' }, { 'Letter ID': 'L2', 'Agent Name': 'Agent Two', 'Performance Period': 'Q2 2026' }];
env.ppmSetStatus_ = (id, st, note, who) => { if (id === 'L2') throw new Error('Letter L2 is not on the sheet any more.'); closedL.push([id, st, note, who.role]); };
const lettersSaid = env.closeOpenPerformanceLetters();
ok('each open letter set to Completed with his note, as the Branch Manager', closedL.length === 1 && closedL[0][0] === 'L1' && closedL[0][1] === 'Completed' && /^Closed by the Branch Manager on /.test(closedL[0][2]) && closedL[0][3] === 'Branch Manager', JSON.stringify(closedL));
ok('and it says what closed and what did not', /^Closed 1 of 2 performance letters: Agent One \(Q2 2026\)\. Not closed: Agent Two/.test(lettersSaid), lettersSaid);
console.log(fails ? '\n' + fails + ' FAILED' : '\nAll passed.');
process.exit(fails ? 1 : 0);
