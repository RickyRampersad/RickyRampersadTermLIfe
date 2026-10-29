// The scoreboard on every role's page, and the register at both ends (19 October 2026).
//
// Ricky: "the metrics on top should really drive the analytics ... some little
// charts" and "they are logging on as soon as they click, and then in the
// afternoon, 30 minutes before they leave, they have to do it ... they need to
// log out, as this is the new register, and they need to commit to what they
// have to do before the evening ends."
//
// Pinned here: the little charts draw to scale; each role's page opens with its
// numbers and every number opens the detail behind it; past days' closed counts
// are read once and kept; Before you leave is the sign-out, with a reason and a
// new date for every task not done (the date goes on the task, the reason on
// Chatter); at the finish no one is signed out by the tracker any more: a
// reminder, then "Did not close the day" (absent only if NO_CLOSE_MARK says so);
// the next morning opens with yesterday first.
const { makeEnv } = require('./harness');
const env = makeEnv();
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };
const DAY = '2026-10-19', D2 = '2026-10-20';
let TODAY = DAY;
env.todayISO_ = () => TODAY;
env.SCHEDULE.sasha = Object.assign({}, env.SCHEDULE.sasha, { hours: '7am – 2pm' });   // the hours this was written on (7 to 3 from 2 November 2026)
let NOW = new Date(DAY + 'T10:40:00');
const realDate = env.Date;
env.Date = new Proxy(realDate, { construct(t, a) { return a.length ? new realDate(...a) : new realDate(NOW.getTime()); }, get(t, k) { return k === 'now' ? () => NOW.getTime() : t[k]; } });
const at = (s, d) => { NOW = new Date((d || DAY) + 'T' + s + ':00'); env.resetRequestMemo_ && env.resetRequestMemo_(); };
env.__mkSheet('Access', 1, ['Name', 'StaffId', 'Email', 'Password', 'Role', 'Unit', 'Active'],
  [['Ricky Rampersad', 'ricky', 'ricky@example.com', '1', 'Branch Manager', 'Branch', 'Yes'],
   ['Kamla Dookran', 'kamla', 'kamla@example.com', '1', 'BMA', 'Support', 'Yes'],
   ['Sasha Lalla-Jagassar', 'sasha', 'sasha@example.com', '1', 'Sales Support', 'Support', 'Yes'],
   ['Azariah Griffith', 'azariah', 'azariah@example.com', '1', 'Sales Support', 'Support', 'Yes'],
   ['Pawan Probhu', 'pawan', 'pawan@example.com', '1', 'Personal Assistant', 'Branch', 'Yes']]);
env.managerEmails_ = () => ['ricky@example.com'];
env.sfkUsers_ = () => ({ ricky: { id: '005R' }, kamla: { id: '005K' }, sasha: { id: '005S' }, azariah: { id: '005A' }, pawan: { id: '005P' } });
env.bmSfId_ = () => '005R';
env.sfkToken_ = () => ({ instance_url: 'https://sf.example', access_token: 't' });
const mails = [];
env.MailApp = { sendEmail: m => mails.push(m), getRemainingDailyQuota: () => 90 };
const writes = [], patches = [];
env.sfkInsert_ = (o, b) => { writes.push([o, b]); return 'FEED'; };
env.sfkPatchTask_ = (id, b) => patches.push([id, b]);
env.cmdChatter_ = () => ({});
const P = env.PropertiesService.getScriptProperties();
const q = s => Object.fromEntries(new URL(s).searchParams);

console.log('\nThe little charts:\n');
ok('the last five working days skip the weekend', env.workDays_(DAY, 5).join(',') === '2026-10-13,2026-10-14,2026-10-15,2026-10-16,2026-10-19', env.workDays_(DAY, 5).join(','));
const bars = env.sbBars_([{ d: '2026-10-15', v: 10 }, { d: '2026-10-16', v: null }, { d: DAY, v: 5 }], DAY);
const rects = [...bars.matchAll(/<rect x="[^"]+" y="(\d+)" width="[^"]+" height="(\d+)"[^>]*fill="([^"]+)"/g)].map(m => ({ y: +m[1], h: +m[2], fill: m[3] }));
ok('bars to scale: the biggest fills the room, half is half', rects.length === 2 && rects[0].h === 22 && rects[1].h === 11, JSON.stringify(rects));
ok('today solid navy, the rest soft; a day with no record shows a dot', rects[1].fill === env.SB.NAVY && rects[0].fill === env.SB.SOFT && />·</.test(bars));
ok('every value it labels is one it drew', />10</.test(bars) && />5</.test(bars) && !/>11</.test(bars));
ok('a meter is the share of its target, never past it', /width="60"/.test(env.sbMeter_(3, 6)) && /width="120" height="8" rx="4" fill="#141C4A"/.test(env.sbMeter_(9, 6)) && !/fill="#141C4A"/.test(env.sbMeter_(0, 6)));
const sp = env.sbSplit_([{ n: 1, c: '#f00' }, { n: 3, c: '#00f' }]);
ok('a split bar in proportion', /x="0.0" y="2" width="28.5"/.test(sp) && /x="30.0" y="2" width="90.0"/.test(sp), sp.slice(0, 260));

console.log('\nPast days, read once and kept:\n');
let queries = [];
env.sfkQuery_ = soql => { queries.push(soql); return /FROM Task/.test(soql) ? [{ OwnerId: '005S' }, { OwnerId: '005S' }, { OwnerId: '005A' }] : []; };
const fri = env.deskClosedOn_('2026-10-16');
ok('closed per desk that day, between midnight and midnight', fri.sasha === 2 && fri.azariah === 1 && /CompletedDateTime >= 2026-10-16T04:00:00Z AND CompletedDateTime < 2026-10-17T04:00:00Z/.test(queries[0]), queries[0].slice(0, 200));
queries = []; env.deskClosedOn_('2026-10-16');
ok('and kept: the second read asks Salesforce nothing', !queries.length && !!P.getProperty('dk_2026-10-16'));
queries = []; env.deskClosedOn_(DAY); env.deskClosedOn_(DAY);
ok('today is not kept: it is still moving', queries.length === 2 && !P.getProperty('dk_' + DAY));

// The pages read these
env.deskClosedOn_ = d => ({ '2026-10-13': { sasha: 9, ricky: 3, pawan: 2 }, '2026-10-14': { sasha: 7, ricky: 2, pawan: 1 }, '2026-10-15': { sasha: 11, ricky: 4 }, '2026-10-16': { sasha: 8, ricky: 1 } })[d] || {};
let desk = { ricky: { closed: 2, noted: 2, notes: 4, list: ['Licence pack signed'] }, sasha: { closed: 5, noted: 4, notes: 6, list: ['A', 'B', 'C', 'D', 'E'] }, azariah: { closed: 6, noted: 6, notes: 8, list: [] }, kamla: { closed: 1, noted: 1, notes: 2, list: [] }, pawan: { closed: 1, noted: 0, notes: 1, list: ['Bank deposit made'] } };
env.deskToday_ = () => JSON.parse(JSON.stringify(desk));
const goTargets = h => [...h.matchAll(/data-go="([^"]+)"/g)].map(m => m[1]);
const allThere = h => goTargets(h).every(id => new RegExp('id="' + id + '"').test(h));

console.log('\nThe Branch Manager · My day:\n');
env.bmWaiting_ = () => ({ ask: [{ id: '00TA', subject: 'Orphan response', by: 'Elizabeth Lee', said: 'Please advise', at: '2026-10-18T14:00:00Z' }],
  mine: [{ id: '00TM', subject: 'New application', due: '2026-10-16', late: true, ty: 'Opportunity' }, { id: '00TO', subject: 'Agenda', due: DAY, late: false, ty: '' }], ignored: [], byOwner: {} });
env.mgrWrite_('ricky', DAY, 'plan', [{ Item: 'recruit', Question: 'Recruitment', Planned: '3', Note: '' }, { Item: 'coach', Question: 'Coaching', Planned: '2', Note: '' }]);
env.mgrWrite_('ricky', DAY, 'eve', [{ Item: 'recruit', Question: 'Recruitment', Done: '3', Note: '' }]);
const me = env.replyClick_({ parameter: q(env.meUrl_('ricky')) }).getContent();
ok('four numbers on top: the branch, waiting on you, your plan, you', /closed in the branch today/.test(me) && /1 asking you · 2 to do · 0 to chase/.test(me) && /numbers met · 3 of 5 done/.test(me) && /closed by you · last 5 days/.test(me));
ok('the branch is today across every desk (15) beside the last four days', /<div class="v">15<\/div>/.test(me) && />14</.test(me) && />10</.test(me) && />9</.test(me), (me.match(/closed in the branch[^]{0,40}/) || [''])[0]);
ok('every number opens what is behind it', goTargets(me).length >= 4 && allThere(me), goTargets(me).join(','));
ok('the branch desk by desk is on the page', /The branch today, desk by desk/.test(me) && /Azariah<\/span>/.test(me));

console.log('\nAn agent · Your day:\n');
const A = { key: 'a-marcus', name: 'Marcus Baptiste', email: 'marcus@example.com' };
env.skillBank_ = () => ({ 'marcus baptiste': { code: 'A1', name: 'Marcus Baptiste' } });
env.goalFor_ = () => ({ api: 120000, apps: 24, paceApi: 6923, weeksIn: 3, last: null });
env.ff360Feed_ = () => ({ leaders: [], monthLeaders: [{ name: 'Marcus Baptiste', count: 3, pickedUp: 2000 }], yearLeaders: [{ name: 'Marcus Baptiste', count: 3, pickedUp: 2000 }] });
env.agRows_ = (k, d, kind) => kind === 'close' ? ({ '2026-10-16': { calls: { Done: 10 }, ff: { Done: 1 } } })[d] || {} : d === DAY ? { calls: { Planned: 6 }, ff: { Planned: 1 } } : {};
env.bigPut_('ag_items_a-marcus_' + DAY, [{ id: '00TA1', s: 'Medical outstanding', o: 'Elizabeth Lee', due: '2026-10-09', late: true }, { id: '00TA2', s: 'Application submitted', o: 'Elizabeth Lee', due: '2026-10-20', late: false }]);
const ag = env.agReplyPage_({ agent: A }, DAY, 'ag').getContent();
ok('his API pace, fact finds, plan and work being done for him', /\$2k of \$7k API pace/.test(ag) && /fact finds this week · 3 this month/.test(ag) && /<div class="v">7<\/div>/.test(ag) && /1 overdue · 1 on time/.test(ag));
ok('the last five close-offs drawn, today the plan', />11</.test(ag) && /Your year · FY27/.test(ag) && allThere(ag), goTargets(ag).join(','));

console.log('\nPawan · Your errands:\n');
env.sfkEventsFor_ = () => [{ id: '00U1', s: 'Bank deposit', start: 540, allDay: false, where: 'Chaguanas' }, { id: '00U2', s: 'Head office', start: 720, allDay: false, where: 'Port of Spain' }];
env.sfkOpenBook_ = () => ({ pawan: { Servicing: [{ id: '00W1', subject: 'Collect cheque', due: DAY, late: false }, { id: '00W2', subject: 'Deliver documents', due: '2026-10-16', late: true }] },
  sasha: { 'Renewa/PDl/Bill': [{ id: '00B1', subject: 'Group renewal', due: '2026-10-21', late: false }, { id: '00B2', subject: 'Premium dues list', due: '2026-10-16', late: true }] } });
const pw = env.replyClick_({ parameter: q(env.replyUrl_('pawan', DAY, 'errand')) }).getContent();
ok('a dot for each thing on his calendar, done so far, tasks, closed', /on the calendar today · a dot each/.test(pw) && /<circle/.test(pw) && /answered done so far/.test(pw) && /1 overdue · 1 due today/.test(pw) && /Closed today · 1/.test(pw));
ok('every number opens its card', allThere(pw), goTargets(pw).join(','));

console.log('\nSales support · Before you leave is the sign-out:\n');
env.recordAttendance_(env.rosterPerson_('sasha'));
env.dayTasks_ = (sid, d) => sid === 'sasha' && d === DAY ? [{ id: '00B1', s: 'Group renewal', due: '2026-10-21', late: false, planned: true, closed: false },
  { id: '00B2', s: 'Premium dues list', due: '2026-10-16', late: true, planned: true, closed: false }, { id: '00B3', s: 'Billing reconciliation', due: DAY, planned: true, closed: true }] : [];
at('13:35');
const hkUrl = env.replyUrl_('sasha', DAY, 'hk');
const hk = env.replyClick_({ parameter: q(hkUrl) }).getContent();
ok('what she set out to do, done and not, and her share of the branch', /What you set out to do this morning/.test(hk) && /1 of 3 you set out to do, done/.test(hk) && /of the branch's 15 closed today/.test(hk) && /&#10007; Group renewal/.test(hk));
ok('a reason and a new date for each not done, both required', (hk.match(/name="r_00B[12]" required/g) || []).length === 2 && (hk.match(/type="date" name="d_00B[12]" required/g) || []).length === 2);
ok('it says this is the sign-out, and when the register will say otherwise', /This is your sign-out/.test(hk) && /Not closed by 2:30pm/.test(hk) && /name="out" value="1" checked/.test(hk) && /Close my day and sign out/.test(hk));
ok('and how much of her day has gone', /% of your day gone/.test(hk));
const base = q(hkUrl);
const noDate = env.replyPost_({ parameter: Object.assign({}, base, { r_00B1: 'Waiting on the agent', r_00B2: 'Calls not finished' }), parameters: {} }).getContent();
ok('without a new date it does not close', /missing/.test(noDate) && /reason and a new date/.test(noDate));
writes.length = 0; patches.length = 0;
const hkPost = Object.assign({}, base, { r_00B1: 'Waiting on the agent for the form', d_00B1: '2026-10-21', r_00B2: 'Calls not finished', d_00B2: '2026-10-20', out: '1' });
env.closeoutFor_ = () => ({ items: [], of: 0, complete: true });
env.mailbagCard_ = () => null;
const closed = env.replyPost_({ parameter: hkPost, parameters: {} }).getContent();
ok('the new date goes on each task in Salesforce', patches.some(p => p[0] === '00B1' && p[1].ActivityDate === '2026-10-21') && patches.some(p => p[0] === '00B2' && p[1].ActivityDate === '2026-10-20'), JSON.stringify(patches));
ok('and the reason on its Chatter, headed as hers', writes.some(w => w[0] === 'FeedItem' && w[1].ParentId === '00B1' && /^Sales Support · Sasha Lalla-Jagassar/.test(w[1].Body) && /Waiting on the agent/.test(w[1].Body) && /New date: Wednesday 21 October/.test(w[1].Body)));
ok('the day is closed and she is signed out', /Your day is closed/.test(closed) && !!env.signedOutAt_('sasha', DAY), env.signedOutAt_('sasha', DAY));

console.log('\nAt the finish, not closed:\n');
env.recordAttendance_(env.rosterPerson_('azariah'));
const AZ = env.rosterPerson_('azariah');
mails.length = 0;
at('16:00');
ok('a reminder at the finish, with the one button', env.notClosedReminder_(AZ, DAY) === true && /Your day is not closed/.test(mails[0].subject) && /Close my day and sign out/.test(mails[0].htmlBody));
ok('which opens My workday at Close my day (29 Oct 2026)', /myworkday\/\?p=azariah&(amp;)?k=[^"&]+&(amp;)?go=close/.test(mails[0].htmlBody), (mails[0].htmlBody.match(/href="[^"]+"/g) || []).join(' '));
ok('nobody who has closed is reminded', env.notClosedReminder_(env.rosterPerson_('sasha'), DAY) === false);
mails.length = 0;
at('16:30');
ok('half an hour later the register says so', env.markNotClosed_('azariah', DAY) === true && !!P.getProperty('notclosed_azariah_' + DAY));
const att = env.sheetObjects_(env.attSheet_()).find(r => String(r.StaffId) === 'azariah');
ok('in, with no sign-out, and not absent', /Did not close the day/.test(att.Reason) && !String(att.SignedOut || '') && String(att.Status || '').toLowerCase() !== 'absent', JSON.stringify({ s: att.Status, r: att.Reason }));
ok('she and Mr Rampersad are told', mails.length === 1 && mails[0].to === 'azariah@example.com' && /ricky@example.com/.test(mails[0].cc) && /Did not close the day/.test(mails[0].subject));
ok('once only', env.markNotClosed_('azariah', DAY) === false && mails.length === 1);
ok('the tracker no longer signs anyone out at the finish', !/autoSignOut_\(/.test(env.housekeepingTick_.toString()));
P.setProperty('NO_CLOSE_MARK', 'absent');
env.recordAttendance_(env.rosterPerson_('kamla'));
env.markNotClosed_('kamla', DAY);
ok('NO_CLOSE_MARK=absent marks the day absent instead', String(env.sheetObjects_(env.attSheet_()).find(r => String(r.StaffId) === 'kamla').Status).toLowerCase() === 'absent');
P.deleteProperty('NO_CLOSE_MARK');

console.log('\nThe next morning, yesterday first:\n');
TODAY = D2; at('07:55', D2);
env.dayTasks_ = (sid, d) => sid === 'azariah' && d === DAY ? [{ id: '00Z1', s: 'Reinstatement form', due: DAY, planned: true, closed: false }] : [];
env.intelModel_ = (sid, d) => ({ b: { KPI1: { sug: [], more: [] } }, loose: [] });
const yo = env.yesterdayOpen_('azariah', D2);
ok('yesterday is open, with what was left', yo && yo.day === DAY && yo.tasks.length === 1, JSON.stringify(yo));
const plan = env.replyClick_({ parameter: q(env.replyUrl_('azariah', D2, 'plan')) }).getContent();
ok('the plan opens with it, a reason and a new date for each', /Yesterday first · Monday 19 October 2026 was not closed/.test(plan) && /name="yr_00Z1" required/.test(plan) && /name="yd_00Z1" required/.test(plan));
const pbase = q(env.replyUrl_('azariah', D2, 'plan'));
const blocked = env.replyPost_({ parameter: Object.assign({}, pbase), parameters: {} }).getContent();
ok('the plan does not save until yesterday is accounted for', /Yesterday first/.test(blocked) && /reason and a new date/.test(blocked));
patches.length = 0;
env.replyPost_({ parameter: Object.assign({}, pbase, { yr_00Z1: 'Client did not bring the form', yd_00Z1: '2026-10-22' }), parameters: {} });
ok('with them it saves, the task moves, and yesterday is accounted for', patches.some(p => p[0] === '00Z1' && p[1].ActivityDate === '2026-10-22') && !!P.getProperty('ncdone_azariah_' + DAY) && env.yesterdayOpen_('azariah', D2) === null);

console.log('\nThe BMA: her page opens on her job:\n');
TODAY = DAY; at('10:00');
env.bmWaiting_ = () => ({ ask: [], mine: [], byOwner: {}, ignored: [{ id: '00TI', subject: 'Call the group client', due: '2026-10-16', late: true, owner: 'Kamla Dookran' },
  { id: '00TK', subject: 'Post the reinstatement outcome', due: '2026-10-15', late: true, owner: 'Azariah Griffith' }, { id: '00TX', subject: 'Not hers', due: DAY, owner: 'Someone Else' }] });
env.cmdItems_ = () => [{ src: 'Salesforce', who: 'azariah', title: 'Medical requirements', why: 'untouched 8 days' }, { src: 'Salesforce', who: 'kamla', title: 'Agent school room', why: 'untouched 6 days' }, { src: 'Query Pal', who: '', title: 'x', why: '' }];
env.openQueries_ = () => [{ ref: 'QP-1', days: 9, subject: 'Surrender value' }, { ref: 'QP-2', days: 4, subject: 'Beneficiary' }, { ref: 'QP-3', days: 1, subject: 'Receipt' }];
const bma = env.bmaScore_('kamla', DAY);
ok('her desks today, a dot each: in, planned, not in', /your desks planned today · a dot each/.test(bma.html) && (bma.html.match(/<circle/g) || []).length === 3, (bma.html.match(/<circle/g) || []).length + ' dots');
ok('Mr Rampersad\'s instructions with no note: hers and her desks\', nobody else\'s', /<div class="v">2<\/div>/.test(bma.html) && /1 yours · 1 on your desks/.test(bma.html) && !/Not hers/.test(bma.closed));
ok('the desks\' work gone quiet, every one counted in the bars, hers included', /gone quiet on the desks/.test(bma.html) && />You</.test(bma.html) && /Agent school room/.test(bma.closed));
ok('Query Pal by age: one older than a week', /1 older than a week · Query Pal open/.test(bma.html) && /QP-1 · Surrender value/.test(bma.closed) && /1 day</.test(bma.closed));
ok('every number opens its card', ['b-desks', 'b-instr', 'b-quiet', 'b-qp'].every(id => new RegExp('data-go="' + id + '"').test(bma.html) && new RegExp('id="' + id + '"').test(bma.closed)));

console.log('\nThe plan, counted before the close:\n');
env.dayTasks_ = () => [{ id: 'a', planned: true, closed: true }, { id: 'b', planned: true, closed: false }, { id: 'c', planned: false, closed: true }];
const tl = env.planTally_('sasha', DAY, { KPI1: { Of: '', Achieved: '' } });
ok('one plan a day: until it closes, read live (1 of 2 planned done)', tl.of === 2 && tl.ach === 1, JSON.stringify(tl));
ok('once the block has its tally, that is what counts', JSON.stringify(env.planTally_('sasha', DAY, { KPI1: { Of: '5', Achieved: '4' } })) === '{"of":5,"ach":4}');
ok('no plan is no plan', JSON.stringify(env.planTally_('sasha', DAY, {})) === '{"of":0,"ach":0}');

console.log(fails ? '\n' + fails + ' FAILED' : '\nAll passed.');
process.exit(fails ? 1 : 0);
