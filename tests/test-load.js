// The load review: who is carrying what, what has stopped moving, and the
// moves that follow from both.
//
// Run: node tests/test-load.js
const { makeEnv } = require('./harness');
const vm = require('vm'), fs = require('fs');
const env = makeEnv();
new vm.Script(fs.readFileSync(__dirname + '/../apps-script/KPI-Write.gs', 'utf8'), { filename: 'KPI-Write.gs' })
  .runInContext(vm.createContext(env));

let fails = 0;
const ok = (what, cond, extra) => { console.log((cond ? '  ok   ' : '  FAIL ') + what + (cond ? '' : '  — ' + (extra === undefined ? '' : JSON.stringify(extra)))); if (!cond) fails++; };

env.__mkSheet('Access', 1, ['Name', 'StaffId', 'Email', 'Password', 'Role', 'Unit', 'Active'],
  [['Ada Quill', 'ada', 'ada@example.com', '1', 'Sales Support Assistant', 'Support', 'Yes'],
   ['Bram Quill', 'bram', 'bram@example.com', '1', 'Sales Support Assistant', 'Support', 'Yes'],
   ['Cleo Quill', 'cleo', 'cleo@example.com', '1', 'Sales Support Assistant', 'Support', 'Yes'],
   ['Ricky Rampersad', 'ricky', 'ricky@example.com', '1', 'Branch Manager', 'Branch', 'Yes']]);
env.__mkSheet('KPI Log', 2, env.LOG_HEADERS.slice(), []);

const mgr = { staffId: 'ricky', name: 'Ricky Rampersad', manager: true };
const ada = { staffId: 'ada', name: 'Ada Quill', manager: false };

env.sfkConfigured_ = () => true;
env.sfkUsers_ = () => ({
  ada:  { id: '005A', name: 'Ada Quill', active: true },
  bram: { id: '005B', name: 'Bram Quill', active: true },
  cleo: { id: '005C', name: 'Cleo Quill', active: true } });

// Ada is buried: 120 open against a rate of two a day. Bram closes the same
// kind of work and holds almost nothing. Cleo has closed nothing at all, so
// she has no rate and must never be handed work on the strength of a guess.
const id = n => '00T' + String(n).padStart(12, '0') + 'AAA';
const open   = { '005A': 120, '005B': 12, '005C': 9 };
const overdue = { '005A': 30, '005B': 1, '005C': 4 };
const quiet  = { '005A': 12, '005B': 0, '005C': 3 };
const aged   = { '005A': 8, '005B': 0, '005C': 1 };
const closedByType = {
  '005A': { 'Renewa/PDl/Bill': 100, 'Servicing': 20 },
  '005B': { 'Renewa/PDl/Bill': 40, 'Pendings': 8 },
  '005C': {} };
const stalledRows = [
  { Id: id(1), Subject: 'Premium dues - one client', OwnerId: '005A', Task_Type__c: 'Renewa/PDl/Bill', Status: 'In Progress', ActivityDate: '2026-08-01', LastModifiedDate: '2026-08-18T12:00:00.000+0000' },
  { Id: id(2), Subject: 'Portfolio to review - another client', OwnerId: '005A', Task_Type__c: 'Servicing', Status: 'In Progress', ActivityDate: '2026-07-01', LastModifiedDate: '2026-08-01T12:00:00.000+0000' },
  { Id: id(3), Subject: 'A quiet one of Cleo\'s', OwnerId: '005C', Task_Type__c: 'Renewa/PDl/Bill', Status: 'In Progress', ActivityDate: '', LastModifiedDate: '2026-08-20T12:00:00.000+0000' }
];
const asked = [];
env.sfkQuery_ = soql => {
  asked.push(soql);
  if (/SELECT Id, Subject, OwnerId/.test(soql)) return stalledRows.slice();
  if (/GROUP BY OwnerId, Task_Type__c/.test(soql)) {
    const out = [];
    Object.keys(closedByType).forEach(o => Object.keys(closedByType[o]).forEach(t =>
      out.push({ OwnerId: o, Task_Type__c: t, n: closedByType[o][t] })));
    return out;
  }
  const pick = /LastModifiedDate < LAST_N_DAYS/.test(soql) ? quiet
    : /ActivityDate < LAST_N_DAYS:60/.test(soql) ? aged
    : /ActivityDate < TODAY/.test(soql) ? overdue : open;
  return Object.keys(pick).map(o => ({ OwnerId: o, n: pick[o] }));
};

console.log('\nWho may look:\n');
ok('a support assistant may not', env.loadReview_(ada).ok === false);
ok('and is told whose screen it is', /Branch Manager only/.test(env.loadReview_(ada).error));

console.log('\nWhat each desk is holding, in its own currency:\n');
const r = env.loadReview_(mgr);
ok('it answers', r.ok === true, r);
const by = sid => r.people.filter(p => p.staffId === sid)[0];
ok('no query asks Salesforce for a birthday', asked.every(q => /Happy Birthday/.test(q)) , asked.length);
ok('the heaviest desk is first', r.people[0].staffId === 'ada', r.people.map(p => p.staffId));
ok('a hundred and twenty open at two a day is sixty days in hand',
   by('ada').open === 120 && by('ada').perDay === 2 && by('ada').days === 60, by('ada'));
ok('twelve open at four-fifths a day is fifteen days, in his currency not hers',
   by('bram').perDay === 0.8 && by('bram').days === 15, by('bram'));
ok('somebody who has closed nothing gets no estimate, not a zero',
   by('cleo').days === null && by('cleo').perDay === 0, by('cleo'));
ok('what is not moving is counted per desk', by('ada').quiet === 12 && by('bram').quiet === 0, [by('ada').quiet, by('bram').quiet]);

console.log('\nWhat has stopped moving:\n');
ok('the oldest silence is listed first', r.stalled[0].id === id(1), r.stalled.map(t => t.id));
ok('with the owner, the type and how long it has been quiet',
   r.stalled[0].ownerName === 'Ada Quill' && r.stalled[0].type === 'Renewa/PDl/Bill' && r.stalled[0].quiet > 20,
   r.stalled[0]);
ok('and a task with no due date says so rather than showing a blank', r.stalled[2].due === '', r.stalled[2]);

console.log('\nThe moves it proposes:\n');
ok('only from the buried desk', r.moves.length >= 1 && r.moves.every(m => m.from === 'ada'), r.moves.map(m => m.from + '->' + m.to));
ok('to somebody lighter who closes that kind of work',
   r.moves[0].to === 'bram' && r.moves[0].type === 'Renewa/PDl/Bill', r.moves[0]);
ok('the servicing one is not offered to him — he has never closed one',
   !r.moves.some(m => m.type === 'Servicing'), r.moves.map(m => m.type));
ok('nothing is proposed off Cleo, who is not overloaded', !r.moves.some(m => m.from === 'cleo'));
ok('and the reason carries all three numbers',
   /Nothing has happened to it in \d+ days/.test(r.moves[0].why) && /Ada Quill is holding 60 days/.test(r.moves[0].why) &&
   /closed 40 of this type/.test(r.moves[0].why), r.moves[0].why);

console.log('\nMoving one:\n');
const patched = [], posts = [];
env.sfkPatch_ = (taskId, body) => { patched.push({ taskId, body }); return true; };
env.sfkToken_ = () => ({ instance_url: 'https://example.my.salesforce.com', access_token: 'tok' });
env.UrlFetchApp = { fetch: (url, o) => { posts.push({ url, body: JSON.parse(o.payload) });
  return { getResponseCode: () => 201, getContentText: () => '{}' }; } };
let m = env.reassignTask_({ taskId: id(1), to: 'bram', note: 'Quiet three weeks; Bram has room this week.' }, mgr);
ok('it moves', m.ok === true, m);
ok('the owner is patched, and only the owner',
   patched.length === 1 && patched[0].taskId === id(1) && JSON.stringify(patched[0].body) === '{"OwnerId":"005B"}', patched[0]);
ok('the new owner is told on the task itself',
   posts.length === 1 && /chatter\/feed-elements/.test(posts[0].url) && posts[0].body.subjectId === id(1), posts[0] && posts[0].url);
ok('mentioning them, and carrying the reason',
   posts[0].body.body.messageSegments[0].id === '005B' &&
   /Quiet three weeks/.test(posts[0].body.body.messageSegments[1].text) &&
   /Ricky Rampersad/.test(posts[0].body.body.messageSegments[1].text), posts[0].body.body.messageSegments[1].text);
ok('and it says whose it is now',
   /It is yours from now/.test(posts[0].body.body.messageSegments[1].text));
const audit = env.__sheets['KPI Salesforce Writes'];
ok('the move is on the audit tab', !!audit && String(audit._grid[1][4]) === 'owner' && String(audit._grid[1][7]) === 'OK', audit && audit._grid[1]);

console.log('\nWhat it refuses:\n');
ok('a move with no reason', env.reassignTask_({ taskId: id(1), to: 'bram', note: 'no' }, mgr).ok === false);
ok('and says the new owner reads it', /four words/.test(env.reassignTask_({ taskId: id(1), to: 'bram', note: 'no' }, mgr).error));
ok('somebody with no Salesforce user', env.reassignTask_({ taskId: id(1), to: 'nobody', note: 'Four words at least here' }, mgr).ok === false);
ok('a task id that is not one', env.reassignTask_({ taskId: 'x', to: 'bram', note: 'Four words at least here' }, mgr).ok === false);
ok('and anybody but the Branch Manager', env.reassignTask_({ taskId: id(1), to: 'bram', note: 'Four words at least here' }, ada).ok === false);

console.log('\nWhen Salesforce will not play:\n');
env.sfkPatch_ = () => { throw new Error('INSUFFICIENT_ACCESS_ON_CROSS_REFERENCE_ENTITY'); };
m = env.reassignTask_({ taskId: id(1), to: 'bram', note: 'Quiet three weeks, moving it on' }, mgr);
ok('the refusal is passed on and nothing is claimed', m.ok === false && /refused the move/.test(m.error), m);
env.sfkQuery_ = () => { throw new Error('503'); };
ok('and a dead org leaves the screen honest', env.loadReviewSafe_(mgr).ok === false);

console.log('\n' + (fails ? fails + ' FAILED' : 'all green') + '\n');
process.exit(fails ? 1 : 0);
