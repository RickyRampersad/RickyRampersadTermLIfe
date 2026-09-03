// How many times does one block submission talk to Sheets?
//
// This is the number that decided whether the branch could file its last block
// at four o'clock. Every round trip happens while the script lock is held, so
// it is not one person's wait — it is everybody's, one after another.
//
// It was 82. Two people lost an afternoon's typing to it on 2 September.
// The ceiling below is a regression guard: if a change pushes it back up,
// this fails before anybody's staff finds out.
const { makeEnv } = require('./harness');
const CEILING = 35;

const LOGH = ['Timestamp','Date','StaffId','Name','Grade','Status']
  .concat(['KPI1','KPI2','PM1','PM2'].reduce((a,p)=>a.concat([p,p+'_Actioned',p+'_Resolved',p+'_Open',p+'_Blocker']),[]))
  .concat(['Closed','Overdue','Aged60','ValueAdded','Innovation','SystemFlags','Notes','UpdatedAt','Revision'])
  .concat(['KPI1_At','KPI2_At','PM1_At','PM2_At']);
const TRH = ['TrainingDate','StaffId','Trainer','Block','Trainee','Topic','Objectives','Achieved','Test','Result','Followup','LoggedAt'];

const env = makeEnv();
env.__mkSheet('Access', 1, ['Name','StaffId','Email','Password','Role','Unit','Active'],
  [['Sasha Lalla','sasha','sasha@example.com','1','Sales Support Assistant','Support','Yes']]);
const row = new Array(LOGH.length).fill('');
row[LOGH.indexOf('Date')]='2026-09-03'; row[LOGH.indexOf('StaffId')]='sasha'; row[LOGH.indexOf('Name')]='Sasha Lalla';
['KPI1','KPI2','PM1'].forEach(p => {
  row[LOGH.indexOf(p)]='Task Management';
  row[LOGH.indexOf(p+'_Actioned')]='did things';
  row[LOGH.indexOf(p+'_At')]=new Date('2026-09-03T11:00:00');
});
env.__mkSheet('KPI Log', 2, LOGH, [row]);
env.__mkSheet('KPI Training', 3, TRH, []);

const c = env.__calls;
Object.keys(c).forEach(k => c[k] = 0);
env.saveBlock_({
  date:'2026-09-03', block:'PM2', name:'Sasha Lalla',
  data:{kpi:'Task Management',actioned:'Actioned remaining tasks',resolved:'3 tasks',openOwned:'2',blocker:'None',blockerOwner:'None'},
  valueAdded:'Caught a misrouted contract', metrics:{closed:3,overdue:2,aged60:0}
}, { staffId:'sasha', name:'Sasha Lalla', manager:false });

const trips = c.getValues + c.setValue + c.setValues + c.getLastRow + c.getLastColumn + c.appendRow + c.deleteRow;
console.log('\n  Last block of the day — ' + trips + ' Sheets round trips'
  + '\n    reads ' + c.getValues + ' · cell-writes ' + c.setValue + ' · batch-writes ' + c.setValues
  + ' · lastRow/lastCol ' + (c.getLastRow + c.getLastColumn)
  + '\n    was 82 before the September fix; ceiling ' + CEILING + '\n');

if (c.setValue > 0) { console.log('  FAIL  cells are being written one at a time again\n'); process.exit(1); }
if (trips > CEILING) { console.log('  FAIL  over the ceiling\n'); process.exit(1); }
console.log('  PASS  under the ceiling\n');
