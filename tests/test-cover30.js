// Thirty minutes after the start, not pressed: the work is reassigned and the
// whole team is told. Pressing later brings back whatever is still open.
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };

const env = makeEnv();
env.__mkSheet('Access', 1, ['Name','StaffId','Email','Password','Role','Unit','Active'],
  [['Kamla Dookran','kamla','kamla@example.com','1',"Branch Manager's Assistant",'Branch','Yes'],
   ['Sasha Lalla','sasha','sasha@example.com','1','Sales Support Assistant','Support','Yes'],
   ['Elizabeth Lee','elizabeth','liz@example.com','1','Sales Support Assistant','Support','Yes'],
   ['Azariah Griffith','azariah','az@example.com','1','Sales Support Assistant','Support','Yes'],
   ['Pawan Probhu','pawan','pawan@example.com','1','Personal Assistant','Branch','Yes'],
   ['Ricky Rampersad','ricky','ricky@example.com','1','Branch Manager','Branch','Yes']]);

const DAY = '2026-10-19';
const users = { kamla: { id: 'K' }, sasha: { id: 'S' }, elizabeth: { id: 'L' }, azariah: { id: 'A' }, ricky: { id: 'R' } };
const tasks = {
  t1: { Id: 't1', OwnerId: 'L', IsClosed: false, subject: 'Pending: medical for Jones', due: '2026-10-16', late: true },
  t2: { Id: 't2', OwnerId: 'L', IsClosed: false, subject: 'Renewal billing query', due: DAY, late: false },
  t3: { Id: 't3', OwnerId: 'R', IsClosed: false, subject: 'Agent licensing follow-up', due: DAY, late: false }
};
env.autoAbsentOn_ = () => true;
env.sfkConfigured_ = () => true;
env.sfkUsers_ = () => users;
env.bmSfId_ = () => 'R';
env.sfkOpenBook_ = () => ({
  elizabeth: { Pendings: [{ id: 't1', subject: tasks.t1.subject, due: tasks.t1.due, late: true }], 'Renewa/PDl/Bill': [{ id: 't2', subject: tasks.t2.subject, due: DAY, late: false }] },
  ricky: { Opportunity: [{ id: 't3', subject: tasks.t3.subject, due: DAY, late: false }] }
});
env.ownerNoted_ = () => ({});
env.intelOrder_ = () => 0;
env.intelModel_ = () => null;
env.sfkForgetDay_ = () => {};
env.moveLog_ = () => {};
env.sfkInsert_ = () => ({});
env.sfkSetOwner_ = (id, owner) => { tasks[id].OwnerId = owner; };
env.sfkQuery_ = (q) => {
  const ids = (q.match(/'(t\d)'/g) || []).map(x => x.replace(/'/g, ''));
  return ids.map(i => ({ Id: i, OwnerId: tasks[i].OwnerId, IsClosed: tasks[i].IsClosed }));
};
const sent = [];
env.MailApp.sendEmail = (m) => { sent.push(m); };

console.log('\nLiz (7am) not pressed at 7:29: nothing moves yet.\n');
env.coverTick_(DAY, 7 * 60 + 29, { sasha: '06:55' }, { elizabeth: 1 });
ok('nothing reassigned before 7:30', tasks.t1.OwnerId === 'L' && sent.length === 0);

console.log('\nAt 7:30, still not pressed: reassigned, and the whole team told.\n');
const out = env.coverTick_(DAY, 7 * 60 + 30, { sasha: '06:55' }, { elizabeth: 1 });
ok('her overdue and due-today work went to whoever is in', tasks.t1.OwnerId === 'S', JSON.stringify(out));
const team = sent.find(m => /is not in today/.test(m.subject));
ok('one e-mail to the whole team', !!team && ['ricky@example.com','kamla@example.com','sasha@example.com','liz@example.com','az@example.com','pawan@example.com'].every(e => team.to.indexOf(e) > -1), team && team.to);
ok('it says Liz is not in and who takes what', team && /Elizabeth Lee is not in today/.test(team.htmlBody) && /Sasha Lalla takes/.test(team.htmlBody));
ok('the subject counts what moved', team && /Elizabeth is not in today · \d+ tasks? reassigned/.test(team.subject), team && team.subject);
const n = sent.length;
env.coverTick_(DAY, 7 * 60 + 45, { sasha: '06:55' }, { elizabeth: 1 });
ok('and it happens once', sent.length === n);

console.log('\nLiz presses at 7:52: what is still open comes back.\n');
tasks.t2.IsClosed = tasks.t2.OwnerId !== 'L' ? false : tasks.t2.IsClosed;
const moved = Object.values(tasks).filter(t => t.OwnerId === 'S' || t.OwnerId === 'K');
if (moved[1]) moved[1].IsClosed = true;   // a colleague already closed one
const back = env.coverReturn_('elizabeth', DAY);
ok('the open ones are back with her', tasks.t1.OwnerId === 'L', JSON.stringify(back));
ok('a closed one stays where it is', back && back.stayed === (moved[1] ? 1 : 0), JSON.stringify(back));
const ret = sent.find(m => /is in · \d+ tasks? returned/.test(m.subject));
ok('and the team is told she is in', !!ret && /pressed ready to start/.test(ret.htmlBody), ret && ret.subject);
ok('a second press returns nothing more', env.coverReturn_('elizabeth', DAY) === null);

console.log('\nThe Branch Manager, not pressed by 5:30: his work goes to the BMA.\n');
sent.length = 0;
env.coverTick_(DAY, 5 * 60 + 30, {}, { ricky: 1 });
ok('his task is with Kamla, though she is not in yet', tasks.t3.OwnerId === 'K');
ok('and the team is told', sent.some(m => /Ricky is not in today/.test(m.subject)), sent.map(m => m.subject).join(' | '));

console.log('\n' + (fails ? fails + ' FAILED' : 'all green') + '\n');
process.exit(fails ? 1 : 0);
