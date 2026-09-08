// Closing a task from the tracker.
//
// The write path was built to change two fields and nothing else. It now
// closes a task too — with a line of what was done, appended to the task's
// description, never replacing what was there; own task or the Branch
// Manager only; audited; and the cached position, including the open book
// the plan reads from, thrown away so the list is honest on the next read.
const fs = require('fs'), path = require('path'), os = require('os');
const ROOT = path.join(__dirname, '..');
// The write path is a second file in the project. The harness loads one, so
// the two are joined for the test the way Apps Script joins them at runtime.
const both = path.join(os.tmpdir(), 'kpi-both-' + process.pid + '.gs');
fs.writeFileSync(both, fs.readFileSync(path.join(ROOT, 'apps-script/KPI.gs'), 'utf8') + '\n' +
                       fs.readFileSync(path.join(ROOT, 'apps-script/KPI-Write.gs'), 'utf8'));
process.env.GS_PATH = both;
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };

const env = makeEnv();
let NOW = new Date('2026-09-07T10:31:00');
const realDate = env.Date;
env.Date = new Proxy(realDate, { construct(t, a) { return a.length ? new realDate(...a) : new realDate(NOW.getTime()); },
                                 get(t, k) { return k === 'now' ? () => NOW.getTime() : t[k]; } });
env.__mkSheet('Access', 1, ['Name','StaffId','Email','Password','Role','Unit','Active'],
  [['Sasha Lalla','sasha','sasha@example.com','1','Sales Support Assistant','Support','Yes'],
   ['Pawan Probhu','pawan','pawan@example.com','1','Personal Assistant','Branch','Yes'],
   ['Ricky Rampersad','ricky','ricky@example.com','1','Branch Manager','Branch','Yes']]);

// Salesforce, stubbed: one task of Sasha's, and a record of every write.
const task = { Id:'00T000000000001AAA', OwnerId:'005A', Subject:'Premium dues — T-LIFE March', ActivityDate:'2026-09-01',
               Task_Update_Reason_c__c:'', Status:'In Progress', Description:'Sent 3 Sep, no reply' };
const patched = [];
env.sfkConfigured_ = () => true;
env.sfkUsers_ = () => ({ sasha: { id:'005A', name:'Sasha Lalla', active:true }, ricky: { id:'005R', name:'Ricky Rampersad', active:true } });
env.sfkQuery_ = soql => /FROM Task WHERE Id/.test(soql) ? [Object.assign({}, task)] : [];
env.sfkPatch_ = (id, body) => { patched.push({ id, body }); return true; };
const cache = env.CacheService.getScriptCache();
const day = env.todayISO_();
['sfk_m_', 'sfk_nr_', 'sfk_bill_', 'sfk_ob_'].forEach(p => cache.put(p + day, '{"stale":true}'));

const SASHA = { staffId:'sasha', name:'Sasha Lalla', role:'ssa', manager:false };
const PAWAN = { staffId:'pawan', name:'Pawan Probhu', role:'pa', manager:false };
const RICKY = { staffId:'ricky', name:'Ricky Rampersad', role:'bm', manager:true };
const id = task.Id;

console.log('\nNo line, no close:\n');
ok('nothing written is refused', /a line, not a word/.test(env.updateTask_({ taskId:id, field:'close', value:'' }, SASHA).error || ''));
ok('so is a word', /a line, not a word/.test(env.updateTask_({ taskId:id, field:'close', value:'done' }, SASHA).error || ''));
ok('and three words', /a line, not a word/.test(env.updateTask_({ taskId:id, field:'close', value:'sent it again' }, SASHA).error || ''));
ok('nothing reached Salesforce', patched.length === 0);

console.log('\nWhose task it is:\n');
ok('a colleague cannot close it', /not your task/i.test(env.updateTask_({ taskId:id, field:'close', value:'Reconciled and sent the corrected statement' }, PAWAN).error || ''));
ok('and still nothing reached Salesforce', patched.length === 0);

console.log('\nThe close itself:\n');
const r = env.updateTask_({ taskId:id, field:'close', value:'Reconciled and sent the corrected statement to the client' }, SASHA);
ok('it went through', r.ok && r.field === 'close' && r.label === 'Closed', JSON.stringify(r));
ok('one write to Salesforce, on that task', patched.length === 1 && patched[0].id === id);
ok('status Completed, and nothing else touched', patched[0].body.Status === 'Completed' && Object.keys(patched[0].body).sort().join() === 'Description,Status', JSON.stringify(patched[0].body));
ok('the line appended to what was there, stamped and signed',
   patched[0].body.Description === 'Sent 3 Sep, no reply\n[2026-09-07 10:31 · Sasha Lalla] Reconciled and sent the corrected statement to the client', patched[0].body.Description);
ok('audited, with what it was and the line', (() => {
  const sh = env.__sheets['KPI Salesforce Writes']; if (!sh) return false;
  const rows = env.sheetObjects_(sh); const a = rows[rows.length - 1];
  return rows.length === 1 && a.StaffId === 'sasha' && a.TaskId === id && a.Field === 'Closed' && a.Was === 'In Progress' && /corrected statement/.test(a.Now) && a.Result === 'ok';
})());
ok('the cached position is thrown away, the open book included', ['sfk_m_', 'sfk_nr_', 'sfk_bill_', 'sfk_ob_'].every(p => cache.get(p + day) === null));

console.log('\nAfter the fact:\n');
task.Status = 'Completed';
ok('a closed task cannot be closed again', /Already closed/.test(env.updateTask_({ taskId:id, field:'close', value:'Closing it a second time by mistake' }, SASHA).error || ''));
task.Status = 'In Progress';
const rm = env.updateTask_({ taskId:id, field:'close', value:'Closed by the Branch Manager after the client confirmed' }, RICKY);
ok('the Branch Manager may close any branch task', rm.ok && patched.length === 2 && /Ricky Rampersad\] Closed by the Branch Manager/.test(patched[1].body.Description));
ok('the reason and due date paths are as they were', env.updateTask_({ taskId:id, field:'reason', value:'Waiting on the agent for the form' }, SASHA).ok && patched[2].body.Task_Update_Reason_c__c === 'Waiting on the agent for the form');
ok('and nothing else can be written', /cannot be edited/.test(env.updateTask_({ taskId:id, field:'status', value:'Completed' }, RICKY).error || ''));

fs.unlinkSync(both);
console.log(fails ? '\n' + fails + ' FAILED\n' : '\nall green\n');
process.exit(fails ? 1 : 0);
