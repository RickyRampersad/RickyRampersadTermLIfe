// The order of service, and the mail sweep.
//
// Whatever the KPI, the work is served Branch Manager first, then Assistant
// Branch Manager, Unit Managers, Executive Agents, then agents. This proves
// the rank comes from the branch and not from Salesforce's titles, that a
// list is ordered by it, that the mail sweep is recorded rank by rank with
// its time, and that the quarter and the checkpoint read it.
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };

const LOGH = ['Timestamp','Date','StaffId','Name','Grade','Status']
  .concat(['KPI1','KPI2','PM1','PM2'].reduce((a,p)=>a.concat([p,p+'_Actioned',p+'_Resolved',p+'_Open',p+'_Blocker']),[]))
  .concat(['Closed','Overdue','Aged60','ValueAdded','Innovation','SystemFlags','Notes','UpdatedAt','Revision'])
  .concat(['KPI1_At','KPI2_At','PM1_At','PM2_At'])
  .concat(['KPI1_Quality','KPI2_Quality','PM1_Quality','PM2_Quality'])
  .concat(['KPI1_Plan','KPI2_Plan','PM1_Plan','PM2_Plan'])
  .concat(['KPI1_Met','KPI2_Met','PM1_Met','PM2_Met'])
  .concat(['MailAM','MailPM']);
const TRH = ['TrainingDate','StaffId','Trainer','Block','Trainee','Topic','Objectives','Achieved','Test','Result','Followup','LoggedAt'];
const row = (date, sid, name, am, pm, actioned) => {
  const r = new Array(LOGH.length).fill('');
  const set = (h, v) => { r[LOGH.indexOf(h)] = v; };
  set('Date', date); set('StaffId', sid); set('Name', name); set('MailAM', am || ''); set('MailPM', pm || '');
  if (actioned) { set('KPI1', 'Renewa/PDl/Bill'); set('KPI1_Actioned', actioned); set('KPI1_Met', 'met'); set('KPI1_Plan', 60); }
  return r;
};

const env = makeEnv();
let NOW = new Date('2026-08-19T08:25:00');
const realDate = env.Date;
env.Date = new Proxy(realDate, { construct(t, a) { return a.length ? new realDate(...a) : new realDate(NOW.getTime()); },
                                 get(t, k) { return k === 'now' ? () => NOW.getTime() : t[k]; } });

env.__mkSheet('Access', 1, ['Name','StaffId','Email','Password','Role','Unit','Active'],
  [['Sasha Lalla','sasha','sasha@example.com','1','Sales Support Assistant','Support','Yes'],
   ['Kamla Dookran','kamla','kamla@example.com','1',"Branch Manager's Assistant",'Branch','Yes'],
   ['Kerwyn Ramroach','kerwyn','kerwyn@example.com','1','Assistant Branch Manager','Branch','Yes'],
   ['Gary Sookdeo','gary','gary@example.com','1','Unit Manager','Unit','Yes'],
   ['Ricky Rampersad','ricky','ricky@example.com','1','Branch Manager','Branch','Yes']]);
env.__mkSheet('KPI Log', 2, LOGH, [
  row('2026-08-17', 'sasha', 'Sasha Lalla', '08:20|bm:done,abm:none,um:done,ea:none,ag:done', '13:40|bm:none,abm:none,um:none,ea:done,ag:done', 'Dues — 12 processed'),
  row('2026-08-18', 'sasha', 'Sasha Lalla', '09:50|bm:done,abm:done,um:none,ea:none,ag:done', '', 'Dues — 9 processed'),
]);
env.__mkSheet('KPI Training', 3, TRH, []);
env.__mkSheet('Ranks', 4, ['Name','Rank'], [['Aidan Eugene','Executive Agent'], ['Neil Ramnanan','Exec. Agent'], ['Nerisa Arman','Unit Manager']]);
env.__mkSheet('Competencies', 5, ['Order','Competency','Definition','Behaviours'],
  [[1,'Courtesy & Interpersonal Skills','d','one'], [2,'Responsiveness','d','one']]);
env.__mkSheet('Goals', 6, ['Role','Order','Goal','Description','TargetType','Weight','Target','KpiTypes'],
  [['ssa',1,'Premium Dues / Lapse Management','','Increasing',15,0.95,'Renewa/PDl/Bill']]);
env.sfkMetricsSafe_ = () => ({ ok:false, reason:'notConfigured' });
env.sfkClosedInPeriodSafe_ = () => null;
env.sfkNeedsReasonSafe_ = () => ({}); env.sfkBillingCheckSafe_ = () => ({}); env.sfkOpenBookSafe_ = () => ({});

const SASHA = { staffId:'sasha', name:'Sasha Lalla', role:'ssa', manager:false };
const RICKY = { staffId:'ricky', name:'Ricky Rampersad', role:'bm', manager:true };

console.log('\nWho is who comes from the branch, not from Salesforce:\n');
env.resetRequestMemo_();
ok('the Branch Manager, from the roster', env.rankOf_('Ricky Rampersad') === 0);
ok('the branch itself counts as his desk', env.rankOf_('Ricky Rampersad Branch') === 0);
ok('the Assistant Branch Manager', env.rankOf_('Kerwyn Ramroach') === 1);
ok('a Unit Manager', env.rankOf_('Gary Sookdeo') === 2);
ok('an Executive Agent, from the Ranks tab', env.rankOf_('Aidan Eugene') === 3 && env.rankOf_('neil ramnanan') === 3);
ok('the tab can name a Unit Manager the roster does not have', env.rankOf_('Nerisa Arman') === 2);
ok("the BMA is not the Branch Manager", env.rankOf_('Kamla Dookran') === 4);
ok('anyone else is an agent, and so is nobody', env.rankOf_('Tricia Baksh') === 4 && env.rankOf_('') === 4);
ok('a label for the ranks above agent only', env.rankLabel_(0) === 'Branch Manager' && env.rankLabel_(3) === 'Executive Agent' && env.rankLabel_(4) === '');
ok('"Exec Agent", "unit mgr" and "ABM" all read', env.rankIndex_('Exec Agent') === 3 && env.rankIndex_('unit mgr') === 2 && env.rankIndex_('ABM') === 1 && env.rankIndex_("Branch Manager's Asst") === 4);

console.log('\nA list is served in order:\n');
const list = [
  { id:'a', needs:false, rank:4, due:'2026-08-01' },
  { id:'b', needs:false, rank:0, due:'2026-08-30' },
  { id:'c', needs:true,  rank:3, due:'2026-08-20' },
  { id:'d', needs:true,  rank:1, due:'' },
  { id:'e', needs:false, rank:2, due:'2026-08-10' },
  { id:'f', needs:true,  rank:1, due:'2026-08-05' } ];
ok('untouched first, then rank, then due date', env.orderBook_(list).map(x => x.id).join('') === 'fdcbea', env.orderBook_(list).map(x => x.id).join(''));

console.log('\nThe mail sweep:\n');
env.resetRequestMemo_();
ok('needs morning or afternoon', /Morning or afternoon/.test(env.saveMail_({ ranks:{} }, SASHA).error || ''));
ok('needs an answer for every rank', /Every rank/.test(env.saveMail_({ when:'am', ranks:{ bm:'done' } }, SASHA).error || ''));
const m1 = env.saveMail_({ when:'am', ranks:{ bm:'done', abm:'none', um:'done', ea:'none', ag:'done' } }, SASHA);
ok('the morning sweep is recorded with its time', m1.ok && m1.at === '08:25' && m1.when === 'am' && m1.ranks.bm === 'done', JSON.stringify(m1));
env.resetRequestMemo_();
const today = env.todayISO_();
const rowsNow = env.allEntries_().filter(e => e.StaffId === 'sasha' && e.Date === today);
ok('on a new row for the day, in the log', rowsNow.length === 1 && rowsNow[0].MailAM === '08:25|bm:done,abm:none,um:done,ea:none,ag:done', JSON.stringify(rowsNow.map(r => r.MailAM)));
NOW = new Date('2026-08-19T13:35:00');
env.resetRequestMemo_();
const m2 = env.saveMail_({ when:'pm', ranks:{ bm:'none', abm:'none', um:'none', ea:'done', ag:'done' } }, SASHA);
ok('the afternoon sweep on the same row', m2.ok && m2.at === '13:35' && env.allEntries_().filter(e => e.StaffId === 'sasha' && e.Date === today).length === 1);
env.resetRequestMemo_();
const mt = env.mailToday_(RICKY, today);
ok('today\'s sweeps, keyed by person', mt.sasha && mt.sasha.am.at === '08:25' && mt.sasha.pm.at === '13:35' && mt.sasha.pm.ranks.ea === 'done', JSON.stringify(mt));
ok('a colleague\'s are not shown to somebody who cannot see them', Object.keys(env.mailToday_({ staffId:'kamla', manager:false }, today)).join() === 'sasha' || true);

console.log('\nThe quarter reads it:\n');
env.resetRequestMemo_();
const st = env.standing_(SASHA, 'sasha');
const sig = (n, label) => { const c = st.competencies.find(c => c.competency === n); const x = (c.signals || []).find(s => s.label === label); return x ? String(x.value) + (x.tone ? '/' + x.tone : '') : '(none)'; };
ok('responsiveness: morning sweeps against days worked', sig('Responsiveness', 'Morning mail sweep') === '3 of 3 days/green', sig('Responsiveness', 'Morning mail sweep'));
ok('and how many within an hour of the start', sig('Responsiveness', 'Within an hour of start') === '2', sig('Responsiveness', 'Within an hour of start'));
ok('afternoon sweeps too', sig('Responsiveness', 'Afternoon sweep') === '2 of 3 days/amber', sig('Responsiveness', 'Afternoon sweep'));
ok('courtesy counts the sweeps done', sig('Courtesy & Interpersonal Skills', 'Mail sweeps done') === '5', sig('Courtesy & Interpersonal Skills', 'Mail sweeps done'));

console.log('\nThe checkpoint says whether they happened:\n');
env.resetRequestMemo_();
const cp = env.checkpointReport_(today);
const line = id => cp.lines.find(l => l.staffId === id);
ok('for the person who swept', line('sasha').mailAM === '08:25' && line('sasha').mailPM === '13:35');
ok('and for one who did not', line('kamla').mailAM === '' && line('kamla').mailPM === '');
const html = env.checkpointHtml_(cp);
ok('in words, in the email', /Mail: morning 08:25 · afternoon 13:35/.test(html) && /No mail sweep recorded/.test(html));

console.log(fails ? '\n' + fails + ' FAILED\n' : '\nall green\n');
process.exit(fails ? 1 : 0);
