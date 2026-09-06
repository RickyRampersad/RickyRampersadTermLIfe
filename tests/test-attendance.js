// Attendance: signing in is the register.
//
// The first sign-in of the day is the time the person started; a second one
// refreshes "last seen" and nothing else. Somebody not in signs in anyway and
// says why, or their People Leader says it for them. Start time is read
// against the person's own hours. And the register is scoped like every
// other read: your own, the people you lead, everyone for the Branch Manager.
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };

const LOGH = ['Timestamp','Date','StaffId','Name','Grade','Status']
  .concat(['KPI1','KPI2','PM1','PM2'].reduce((a,p)=>a.concat([p,p+'_Actioned',p+'_Resolved',p+'_Open',p+'_Blocker']),[]))
  .concat(['Closed','Overdue','Aged60','ValueAdded','Innovation','SystemFlags','Notes','UpdatedAt','Revision']);
const TRH = ['TrainingDate','StaffId','Trainer','Block','Trainee','Topic','Objectives','Achieved','Test','Result','Followup','LoggedAt'];

const env = makeEnv();
env.__mkSheet('Access', 1, ['Name','StaffId','Email','Password','Role','Unit','Active'],
  [['Sasha Lalla','sasha','sasha@example.com','1','Sales Support Assistant','Support','Yes'],
   ['Elizabeth Lee','elizabeth','liz@example.com','1','Sales Support Assistant','Support','Yes'],
   ['Kamla Dookran','kamla','kamla@example.com','1',"Branch Manager's Assistant",'Branch','Yes'],
   ['Pawan Probhu','pawan','pawan@example.com','1','Personal Assistant','Branch','Yes'],
   ['Ricky Rampersad','ricky','ricky@example.com','1','Branch Manager','Branch','Yes']]);
env.__mkSheet('KPI Log', 2, LOGH, []);
env.__mkSheet('KPI Training', 3, TRH, []);
env.sfkMetricsSafe_ = () => ({ ok:false, reason:'notConfigured' });
env.sfkNeedsReasonSafe_ = () => ({}); env.sfkBillingCheckSafe_ = () => ({}); env.sfkOpenBookSafe_ = () => ({});

// The clock is ours: 08:07 on a Monday. The harness formats HH:mm in the
// VM's local time, so the clock is set in local time too.
let NOW = new Date('2026-09-07T08:07:00');
const realDate = env.Date;
// The script memoises a day's answer for half an hour; the harness cache
// never expires, so the test expires it by hand between sign-ins.
const expire = () => env.CacheService.getScriptCache().remove('att_sasha_' + env.todayISO_());
env.Date = new Proxy(realDate, { construct(t, a) { return a.length ? new realDate(...a) : new realDate(NOW.getTime()); },
                                 get(t, k) { return k === 'now' ? () => NOW.getTime() : t[k]; } });
const TODAY = env.todayISO_();

const SASHA = { staffId:'sasha', name:'Sasha Lalla', role:'ssa', manager:false };
const LIZ   = { staffId:'elizabeth', name:'Elizabeth Lee', role:'ssa', manager:false };
const KAMLA = { staffId:'kamla', name:'Kamla Dookran', role:'bma', manager:false };
const PAWAN = { staffId:'pawan', name:'Pawan Probhu', role:'pa', manager:false };
const RICKY = { staffId:'ricky', name:'Ricky Rampersad', role:'bm', manager:true };

console.log('\nEach person is measured against their own start:\n');
ok('an eight o\'clock desk starts at 480', env.startFor_('sasha') === 480);
ok('a nine o\'clock desk starts at 540', env.startFor_('elizabeth') === 540);
ok('a stranger to the schedule defaults to eight', env.startFor_('nobody') === 480);
ok('08:07 is on time for an eight o\'clock start', env.lateBy_('sasha', '08:07') === 0);
ok('08:25 is fifteen minutes over the grace', env.lateBy_('sasha', '08:25') === 25);
ok('and 09:05 is on time for a nine o\'clock start', env.lateBy_('elizabeth', '09:05') === 0);

console.log('\nThe first sign-in of the day is the start of the day:\n');
env.resetRequestMemo_();
const a1 = env.recordAttendance_(SASHA);
ok('recorded, and it is the first', a1.first === true && a1.at === '08:07' && a1.status === 'in', JSON.stringify(a1));
NOW = new Date('2026-09-07T09:40:00');
env.resetRequestMemo_(); expire();
const a2 = env.recordAttendance_(SASHA);
ok('a second sign-in is not the first', a2.first === false, JSON.stringify(a2));
ok('and the start time did not move', a2.at === '08:07');
env.resetRequestMemo_();
const reg = env.attendanceFor_(RICKY, TODAY, env.shiftDays_(TODAY, 1));
ok('one row for the day', reg.length === 1 && reg[0].staffId === 'sasha');
ok('with last seen refreshed', reg[0].lastSeen === '09:40', reg[0].lastSeen);

console.log('\nNot in today, and why:\n');
ok('a reason is required', /why/.test(env.markAbsent_({ reason:'' }, LIZ).error || ''));
ok('a colleague cannot mark somebody else', env.markAbsent_({ staffId:'elizabeth', reason:'sick' }, PAWAN).ok === false);
ok('the person can', env.markAbsent_({ reason:'sick' }, LIZ).ok);
env.resetRequestMemo_();
let today = env.attendanceToday_(RICKY);
ok('the register says so', today.elizabeth && today.elizabeth.status === 'absent' && today.elizabeth.reason === 'sick');
ok('and marked by them', today.elizabeth.markedBy === 'elizabeth');
ok('their People Leader can mark a report who phoned in', env.markAbsent_({ staffId:'sasha', reason:'on leave' }, KAMLA).ok);
env.resetRequestMemo_();
today = env.attendanceToday_(RICKY);
ok('which keeps the sign-in time they had', today.sasha.status === 'absent' && today.sasha.at === '08:07' && today.sasha.markedBy === 'kamla');

console.log('\nWho sees the register:\n');
env.resetRequestMemo_();
ok('a support desk sees only their own row', Object.keys(env.attendanceToday_(LIZ)).join() === 'elizabeth');
ok('the BMA sees herself and the desks she leads', Object.keys(env.attendanceToday_(KAMLA)).sort().join() === 'elizabeth,sasha');
ok('the Branch Manager sees everyone', Object.keys(env.attendanceToday_(RICKY)).sort().join() === 'elizabeth,sasha');
ok('and the PA sees nobody else', Object.keys(env.attendanceToday_(PAWAN)).length === 0);

console.log('\nIt rides on sign-in, and the checkpoint reads it:\n');
env.resetRequestMemo_();
const login = env.login_('kamla@example.com', '1');
ok('sign-in carries today\'s attendance', login.ok && login.profile.attendance && login.profile.attendance.first === true, JSON.stringify(login.profile && login.profile.attendance));
ok('and who they lead', Array.isArray(login.profile.leads) && login.profile.leads.sort().join() === 'elizabeth,sasha');
env.resetRequestMemo_();
const cp = env.checkpointReport_(TODAY);
const line = id => cp.lines.find(l => l.staffId === id);
ok('the checkpoint says who is in', line('kamla').signedIn === '09:40');
ok('who is not, and why', line('elizabeth').absent === 'sick');
ok('and who never signed in', line('pawan').signedIn === '' && line('pawan').absent === '');
const html = env.checkpointHtml_(cp);
ok('in words, in the email', /In at 09:40/.test(html) && /Not in — sick/.test(html) && /No sign-in today/.test(html));

console.log(fails ? '\n' + fails + ' FAILED\n' : '\nall green\n');
process.exit(fails ? 1 : 0);
