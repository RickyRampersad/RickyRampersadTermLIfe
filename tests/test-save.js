const { makeEnv } = require('./harness');

const LOGH = ['Timestamp','Date','StaffId','Name','Grade','Status']
  .concat(['KPI1','KPI2','PM1','PM2'].reduce((a,p)=>a.concat([p,p+'_Actioned',p+'_Resolved',p+'_Open',p+'_Blocker']),[]))
  .concat(['Closed','Overdue','Aged60','ValueAdded','Innovation','SystemFlags','Notes','UpdatedAt','Revision'])
  .concat(['KPI1_At','KPI2_At','PM1_At','PM2_At'])
  .concat(['KPI1_Quality','KPI2_Quality','PM1_Quality','PM2_Quality'])
  // Where ensureLogColumns_ puts them on the branch's existing sheet: appended
  // at the end, grouped by field. This is the shape from the first save after
  // a deploy onwards, so it is the one worth measuring — the migration write
  // happens once and the bench covers it.
  .concat(['KPI1_Plan','KPI2_Plan','PM1_Plan','PM2_Plan'])
  .concat(['KPI1_Met','KPI2_Met','PM1_Met','PM2_Met'])
  .concat(['MailAM','MailPM']);
const TRH = ['TrainingDate','StaffId','Trainer','Block','Trainee','Topic','Objectives','Achieved','Test','Result','Followup','LoggedAt'];

function seed(env, existingRow) {
  env.__mkSheet('Access', 1, ['Name','StaffId','Email','Password','Role','Unit','Active'],
    [['Sasha Lalla','sasha','sasha@example.com','1','Sales Support Assistant','Support','Yes']]);
  env.__mkSheet('KPI Log', 2, LOGH, existingRow ? [existingRow] : []);
  env.__mkSheet('KPI Training', 3, TRH, []);
}

function blankRow() {
  const r = new Array(LOGH.length).fill('');
  r[LOGH.indexOf('Date')] = '2026-09-03';
  r[LOGH.indexOf('StaffId')] = 'sasha';
  r[LOGH.indexOf('Name')] = 'Sasha Lalla';
  return r;
}

let fails = 0;
const ok = (label, cond, extra='') => { console.log((cond?'  PASS  ':'  FAIL  ')+label+(extra?'  '+extra:'')); if(!cond) fails++; };

// ---- 1. Round trips for the last block of the day -------------------------
{
  const env = makeEnv();
  const row = blankRow();
  // three blocks already in
  ['KPI1','KPI2','PM1'].forEach(p => {
    row[LOGH.indexOf(p)] = 'Task Management';
    row[LOGH.indexOf(p+'_Actioned')] = 'did things';
    row[LOGH.indexOf(p+'_At')] = new Date('2026-09-03T11:00:00');
  });
  seed(env, row);
  const before = JSON.parse(JSON.stringify(env.__calls));
  const res = env.saveBlock_({
    date: '2026-09-03', block: 'PM2', name: 'Sasha Lalla',
    data: { kpi: 'Task Management', actioned: 'Actioned remaining tasks', resolved: '3 tasks', openOwned: '2', blocker: 'None', blockerOwner: 'None' },
    valueAdded: 'Caught a misrouted contract', innovation: '', systemFlags: '', notes: '',
    metrics: { closed: 3, overdue: 2, aged60: 0 }
  }, { staffId: 'sasha', name: 'Sasha Lalla', manager: false });

  const c = env.__calls;
  const writes = c.setValue - before.setValue + (c.setValues - before.setValues);
  const reads  = c.getValues - before.getValues;
  console.log('\n  PM2 save — writes: ' + writes + '   grid reads: ' + reads + '   mails: ' + c.mail);
  ok('save succeeded', res.ok, JSON.stringify(res.ok ? {at:res.at, blocksDone:res.blocksDone} : res));
  ok('all four blocks counted in', res.blocksDone === 4, 'got ' + res.blocksDone);
  // Seven, not five, since the block gained a planned-minutes and an
  // objective-met column. Both land in their own field-grouped runs at the end
  // of the branch's existing sheet, so each costs one write that cannot be
  // merged with the block's contiguous run. Two fields, two writes — if this
  // climbs again without a field to show for it, something has stopped
  // batching.
  ok('block writes batched under 8', writes < 8, 'writes=' + writes);
  ok('log not re-read to count the day', reads <= 5, 'reads=' + reads);

  const g = env.__sheets['KPI Log']._grid[1];
  ok('PM2 text landed', g[LOGH.indexOf('PM2_Actioned')] === 'Actioned remaining tasks');
  ok('PM2 resolved landed', g[LOGH.indexOf('PM2_Resolved')] === '3 tasks');
  ok('PM2 open landed', String(g[LOGH.indexOf('PM2_Open')]) === '2');
  ok('value added landed', g[LOGH.indexOf('ValueAdded')] === 'Caught a misrouted contract');
  ok('metrics landed', String(g[LOGH.indexOf('Closed')]) === '3' && String(g[LOGH.indexOf('Overdue')]) === '2');
  ok('status set', g[LOGH.indexOf('Status')] === 'Submitted');
  ok('revision bumped', Number(g[LOGH.indexOf('Revision')]) === 1);
  ok('KPI1 untouched', g[LOGH.indexOf('KPI1_Actioned')] === 'did things');
  ok('PM2_At stamped', g[LOGH.indexOf('PM2_At')] instanceof Date);
}

// ---- 2. A failing mail server must not lose a saved block -----------------
{
  const env = makeEnv({ mailThrows: true });
  seed(env, blankRow());
  const res = env.saveBlock_({
    date: '2026-09-03', block: 'KPI1', name: 'Sasha Lalla',
    data: { kpi: 'Premium Dues', actioned: 'worked the list', resolved: '4', openOwned: '' }
  }, { staffId: 'sasha', name: 'Sasha Lalla', manager: false });
  console.log('');
  ok('mail failure still reports saved', res.ok === true, JSON.stringify(res));
  ok('and says the receipt did not go', !!res.warning, res.warning || '(none)');
  const g = env.__sheets['KPI Log']._grid[1];
  ok('the text is in the sheet anyway', g[LOGH.indexOf('KPI1_Actioned')] === 'worked the list');
}

// ---- 3. A brand new day still appends correctly ---------------------------
{
  const env = makeEnv();
  seed(env, null);
  const res = env.saveBlock_({
    date: '2026-09-03', block: 'KPI2', name: 'Sasha Lalla',
    data: { kpi: 'New applications', actioned: 'three in', resolved: 'all three' }
  }, { staffId: 'sasha', name: 'Sasha Lalla', manager: false });
  console.log('');
  ok('new row created', res.ok && env.__sheets['KPI Log']._grid.length === 2);
  const g = env.__sheets['KPI Log']._grid[1];
  ok('staff and date written', g[LOGH.indexOf('StaffId')] === 'sasha' && env.isoDay_(g[LOGH.indexOf('Date')]) === '2026-09-03');
  ok('only that block counted', res.blocksDone === 1, 'got ' + res.blocksDone);
  ok('KPI2 text landed', g[LOGH.indexOf('KPI2_Actioned')] === 'three in');
}

// ---- 4. The four o'clock queue ------------------------------------------
{
  const env = makeEnv({ lockBusy: true });
  seed(env, blankRow());
  const res = env.saveBlock_({ date:'2026-09-03', block:'PM2', name:'Sasha Lalla',
    data:{ kpi:'Task Management', actioned:'Actioned remaining tasks' } },
    { staffId:'sasha', name:'Sasha Lalla', manager:false });
  console.log('');
  ok('a busy branch does not throw a Google error at staff', res && res.ok === false && !!res.error);
  ok('and the browser is told to come back', res._retry === true);
  ok('the wording is plain English', !/lock/i.test(res.error), res.error);
}

console.log('\n' + (fails ? fails + ' FAILED' : 'all green'));
process.exit(fails ? 1 : 0);
