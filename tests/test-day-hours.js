// The day, hour by hour (28 October 2026, 2026-10-28d): the feed behind slide 2.
//
// Ricky, 1:15pm: "it shows task closed off as the day goes by for what task type and agent and what was touched but not
// closed and aging? ... bring in me as i automated and show the tasks by me as servicing as its birthdays, the timeblocks are
// important". wallDayHours_ reads today's tasks and notes from Salesforce. Pinned here:
//   - a close counts for the desk that owns it, in the hour it was closed, by its Task Type; an e-mail logged is an e-mail;
//   - the Branch Manager's logged e-mails (the birthdays) are "automated", by type, in their hour, out of the desks' totals;
//   - worked on, not closed: the desk itself last changed it, or wrote a note on it today; once a task; never what the
//     Branch Manager's automation touched; with how old each is;
//   - the agents whose work was closed, through the scrub (anyone who has left reads Orphans); no subject, no client.
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x && !c ? '  ' + x : '')); if (!c) fails++; };
const env = makeEnv();
env.todayISO_ = () => '2026-10-28';
// Apps Script formats a time in the branch's zone; the harness in the machine's. Port of Spain is UTC-4 all year.
const realFmt = env.Utilities.formatDate;
env.Utilities.formatDate = (d, tz, f) => { if (f === 'HH:mm') { const x = new Date(d.getTime() - 4 * 3600000); return String(x.getUTCHours()).padStart(2, '0') + ':' + String(x.getUTCMinutes()).padStart(2, '0'); } return realFmt(d, tz, f); };
const ID = { sasha: 'U_SASHA', elizabeth: 'U_LIZ', azariah: 'U_AZ', kamla: 'U_KAM', pawan: 'U_PAW' }, RICKY = 'U_RICKY';
env.sfkUsers_ = () => Object.fromEntries(Object.entries(ID).map(([k, v]) => [k, { id: v }]));
env.bmSfId_ = () => RICKY;
const NM = { sasha: 'Sasha Lalla-Jagassar', elizabeth: 'Elizabeth Lee', azariah: 'Azariah Griffith', kamla: 'Kamla Dookran', pawan: 'Pawan Probhu', ricky: 'Ricky Rampersad' };
env.nameFor_ = s => NM[s] || s;
// Port of Spain is UTC-4 all year: 9:15am there is 13:15Z.
const at = (hh, mm) => '2026-10-28T' + String(hh + 4).padStart(2, '0') + ':' + String(mm || 0).padStart(2, '0') + ':00.000Z';
let n = 0; const T = (o) => Object.assign({ Id: 'T' + (++n), IsClosed: false, CreatedDate: '2026-10-20T12:00:00.000Z', LastModifiedDate: at(9), Subject: 'Client Name task', Task_Type__c: 'Servicing' }, o);
const TASKS = [
  T({ OwnerId: ID.sasha, IsClosed: true, CompletedDateTime: at(9, 15), Task_Type__c: 'Pendings', Agent__r: { Name: 'Rajiv Soodoo' } }),
  T({ OwnerId: ID.sasha, IsClosed: true, CompletedDateTime: at(9, 40), Task_Type__c: 'Pendings', Agent__r: { Name: 'Rajiv Soodoo' } }),
  T({ OwnerId: ID.sasha, IsClosed: true, CompletedDateTime: at(11, 5), Task_Type__c: null, Agent__r: { Name: 'Gary Sookdeo' } }),
  T({ OwnerId: ID.sasha, IsClosed: true, CompletedDateTime: at(11, 20), Subject: 'Email: Payment Received - R&C' }),
  T({ OwnerId: ID.sasha, LastModifiedById: ID.sasha, LastModifiedDate: at(10, 2), CreatedDate: '2026-10-27T12:00:00.000Z' }),          // worked, a day old
  T({ OwnerId: ID.sasha, LastModifiedById: ID.sasha, LastModifiedDate: at(10, 30), CreatedDate: '2026-02-01T12:00:00.000Z' }),          // worked, 269 days
  T({ OwnerId: ID.sasha, LastModifiedById: RICKY, LastModifiedDate: at(7, 5) }),                                                         // the automation: nobody's
  T({ Id: 'TN1', OwnerId: ID.azariah, LastModifiedById: RICKY, LastModifiedDate: at(7, 5), CreatedDate: '2026-09-28T12:00:00.000Z' }),   // Azariah's note on it today: hers
  T({ OwnerId: ID.azariah, IsClosed: true, CompletedDateTime: at(8, 10), Task_Type__c: 'Servicing', Agent__r: { Name: 'Stephanie Rajkumar' } }),
  T({ OwnerId: ID.pawan, IsClosed: true, CompletedDateTime: at(6, 30), Task_Type__c: 'Renewa/PDl/Bill' }),                                 // before 7: the first hour
  T({ OwnerId: ID.kamla, IsClosed: true, CompletedDateTime: '2026-10-27T20:00:00.000Z', LastModifiedDate: at(9) }),                     // closed yesterday, edited today
  ...Array.from({ length: 3 }, () => T({ OwnerId: RICKY, IsClosed: true, CompletedDateTime: at(7, 1), Subject: '<p>"Email: Happy Birthday " &amp; $Record.FirstName</p>' })),
  T({ OwnerId: RICKY, IsClosed: true, CompletedDateTime: at(12, 0), Task_Type__c: 'Opportunity', Agent__r: { Name: 'Ricky Rampersad' } }),
];
const NOTES = [{ ParentId: 'TN1', CreatedById: ID.azariah, CreatedDate: at(11, 45) }, { ParentId: 'TN1', CreatedById: ID.azariah, CreatedDate: at(12, 5) },
               { ParentId: 'TX', CreatedById: RICKY, CreatedDate: at(8, 0) }, { ParentId: 'T5', CreatedById: RICKY, CreatedDate: at(8, 30) }];
let asked = [];
env.sfkQuery_ = q => { asked.push(q); return /FROM Task/.test(q) ? TASKS : /FROM FeedItem/.test(q) ? NOTES : []; };

const d = env.wallDayHours_('2026-10-28');
const desk = sid => d.desks.find(x => x.sid === sid);
const hr = h => d.hours.find(x => x.h === h);
console.log('\nClosed, by type and hour:\n');
ok('one query for the day\'s tasks, one for its notes, both from midnight here', asked.length === 2 && asked.every(q => /2026-10-28T04:00:00Z/.test(q)), asked.join(' / '));
ok('Sasha: three closed, two Pendings at 9 and one not typed at 11', desk('sasha').closed === 3 && hr(9).closed.Pendings === 2 && hr(11).closed['Not typed'] === 1, JSON.stringify(desk('sasha').byType));
ok('her logged e-mail is an e-mail, not a close', desk('sasha').emails === 1);
ok('a close before seven sits in the first hour', hr(7).closed['Renewa/PDl/Bill'] === 1);
ok('a task closed yesterday and edited today is neither', desk('kamla').closed === 0 && desk('kamla').worked === 0);
ok('the desks closed five', d.totals.closed === 5, JSON.stringify(d.totals));

console.log('\nWorked on, not closed, and how old:\n');
ok('Sasha worked on two; the one the automation touched is nobody\'s', desk('sasha').worked === 2 && hr(10).worked === 2, JSON.stringify(desk('sasha').hours));
ok('their ages: one this week, one past ninety days, the oldest 269 days', desk('sasha').ages.join() === '1,0,0,1' && desk('sasha').oldest === 269, JSON.stringify(desk('sasha').ages));
ok('Azariah\'s two notes on a task the automation last touched: one task worked, in the hour of her last note', desk('azariah').worked === 1 && desk('azariah').hours[12 - 7].w === 1 && desk('azariah').noted === 2 && desk('azariah').ages[1] === 1, JSON.stringify(desk('azariah')));

console.log('\nThe Branch Manager, automated:\n');
const r = desk('ricky');
ok('his three birthday e-mails are automated, Servicing, at seven', r.automated === 3 && r.hours[0].a === 3 && hr(7).auto === 3 && r.autoTypes[0].k === 'Servicing' && r.autoTypes[0].n === 3, JSON.stringify(r));
ok('his own close counts as his, not the desks\'', r.closed === 1 && d.totals.closed === 5 && d.totals.mine === 1 && d.totals.automated === 3);
ok('his notes are counted as notes, and are nobody\'s worked-on', r.noted === 2 && r.worked === 0 && desk('sasha').worked === 2);
ok('his row is last, marked automated', d.desks[d.desks.length - 1].sid === 'ricky' && r.auto === true && d.desks.slice(0, -1).every(x => !x.auto));

console.log('\nAgents, and what never shows:\n');
const s = env.wallScrub_(d);
ok('the agents whose work was closed, Gary reading Orphans', s.agents.find(a => a.k === 'Rajiv Soodoo').n === 2 && s.agents.some(a => a.k === env.WALL_ORPHANS) && !/Gary/.test(JSON.stringify(s)), JSON.stringify(s.agents));
const raj = d.agents.find(a => a.k === 'Rajiv Soodoo');
ok('the agents served, in name order, each with closes, worked-on and the desks that served them', raj.c === 2 && raj.w === 0 && raj.by[0].k === 'Sasha' && raj.by[0].n === 2 && d.agents.map(a => a.k).join('|') === [...d.agents.map(a => a.k)].sort((x, y) => x.toLowerCase() < y.toLowerCase() ? -1 : 1).join('|'), JSON.stringify(d.agents));
ok('no subject and no client anywhere in the feed', !/Client Name|Payment Received|Happy Birthday/.test(JSON.stringify(d)));
ok('ten hour columns, seven to four', d.hours.length === 10 && d.hours[0].h === 7 && d.hours[9].h === 16);
ok('it is kept four minutes', env.CacheService.getScriptCache().get('wall_hours_2026-10-28') != null);
asked = []; env.wallDayHours_('2026-10-28');
ok('and read from the copy in that time', asked.length === 0);
ok('intel.day carries it as hours', /j\.data\.hours = wallDayHours_\(todayISO_\(\)\)/.test(env.wallFeedOut_.toString()));

console.log(fails ? '\n' + fails + ' FAILED' : '\nall green');
process.exit(fails ? 1 : 0);
