const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l,c,x='') => { console.log((c?'  PASS  ':'  FAIL  ')+l+(x?'  '+x:'')); if(!c) fails++; };

const TRH = ['TrainingDate','StaffId','Trainer','Block','Trainee','Topic','Objectives','Achieved','Test','Result','Followup','LoggedAt'];

// An older log that predates UpdatedAt / Revision / the _At stamps.
const OLD = ['Timestamp','Date','StaffId','Name','Grade','Status']
  .concat(['KPI1','KPI2','PM1','PM2'].reduce((a,p)=>a.concat([p,p+'_Actioned',p+'_Resolved',p+'_Open',p+'_Blocker']),[]))
  .concat(['Closed','Overdue','Aged60','ValueAdded','Innovation','SystemFlags','Notes']);

console.log('\nA workbook from before the newer columns existed:\n');
const env = makeEnv();
env.__mkSheet('Access', 1, ['Name','StaffId','Email','Password','Role','Unit','Active'],
  [['Sasha Lalla','sasha','sasha@example.com','1','Sales Support Assistant','Support','Yes'],
   ['Ricky Rampersad','ricky','ricky@example.com','1','Branch Manager','Branch','Yes']]);
env.__mkSheet('KPI Log', 2, OLD, []);
env.__mkSheet('KPI Training', 3, TRH, []);

const res = env.saveBlock_({ date:'2026-09-03', block:'PM2', name:'Sasha Lalla',
  data:{ kpi:'Task Management', actioned:'Actioned remaining tasks', resolved:'3 tasks' } },
  { staffId:'sasha', name:'Sasha Lalla', manager:false });
ok('the save works on an old log', res.ok, JSON.stringify(res.ok?'':res));

const head = env.__sheets['KPI Log']._grid[0];
['UpdatedAt','Revision','KPI1_At','KPI2_At','PM1_At','PM2_At'].forEach(c =>
  ok('column added: ' + c, head.indexOf(c) > -1));
const row = env.__sheets['KPI Log']._grid[1];
ok('and the text landed in the right column', row[head.indexOf('PM2_Actioned')] === 'Actioned remaining tasks');
ok('the new PM2_At was stamped', row[head.indexOf('PM2_At')] instanceof Date);

console.log('\nSigning in still works with the header remembered:\n');
env.resetRequestMemo_();
const login = env.login_('sasha@example.com', '1');
ok('sasha signs in', login.ok, JSON.stringify(login.ok?'':login));
ok('she is not a manager', login.profile && login.profile.manager === false);
ok('the roster came back', (login.roster||[]).length === 2);

env.resetRequestMemo_();
const boss = env.login_('ricky@example.com', '1');
ok('the branch manager signs in', boss.ok);
ok('and he sees the branch', boss.profile && boss.profile.manager === true);

env.resetRequestMemo_();
const rows = env.allEntries_();
ok('the day reads back', rows.length === 1 && rows[0].StaffId === 'sasha', JSON.stringify(rows.length));
ok('with the block text intact', rows[0].PM2_Actioned === 'Actioned remaining tasks');

console.log('\n' + (fails ? fails + ' FAILED' : 'all green') + '\n');
process.exit(fails ? 1 : 0);
