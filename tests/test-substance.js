// Does the entry actually say anything?
//
// The cost of getting this wrong is asymmetric. Missing a thin entry costs a
// nudge. Calling a real afternoon's work thin insults somebody who did the
// job — and they stop trusting the tracker. So the FULL cases below matter
// more than the THIN ones, and they are real entries from the branch.
const { makeEnv } = require('./harness');
const env = makeEnv();
let fails = 0;
const check = (label, d, want, others) => {
  const got = env.readSubstance_(d, others);
  const pass = got.level === want;
  if (!pass) fails++;
  console.log((pass ? '  PASS  ' : '  FAIL  ') + want.toUpperCase().padEnd(5) + ' ' +
    label.padEnd(52) + (got.reason || 'reads full'));
};

console.log('\nReal entries from the branch — these must all read FULL:\n');
check('"Three contracts Recieved and Macro sent"',
  { actioned: 'Three contracts Recieved and Macro sent',
    resolved: 'Macro sent and contracts logged and placed in agent dip' }, 'full');
check('"Premium dues — 14 processed, 2 returned"',
  { actioned: 'Premium dues, 14 processed', resolved: '2 returned to advisor' }, 'full');
check('"Called on POL-88213, lapse reinstated"',
  { actioned: 'Called on the POL-88213 lapse', resolved: 'Reinstated' }, 'full');
check('"Billing recon for a group scheme, 3 corrected"',
  { actioned: 'Billing recon, Group Health scheme', resolved: '3 mismatches corrected' }, 'full');
check('worked all morning, nothing closed yet (honest)',
  { actioned: 'Chased head office on 4 outstanding transmittals', resolved: 'None today' }, 'full');
check('a policy number and an action',
  { actioned: 'Followed up POL-88213 with underwriting', resolved: 'Awaiting medical' }, 'full');
check('long narrative, no digits',
  { actioned: 'Sent the renewal pack to Head Office and collected the signed forms from the advisor',
    resolved: 'Filed' }, 'full');

console.log('\nThe entries that started this — these must read THIN:\n');
check('"Actioned remaining tasks" / "3 tasks" / "2"',
  { actioned: 'Actioned remaining tasks', resolved: '3 tasks', openOwned: '2' }, 'thin');
check('a bare name and nothing else',
  { actioned: 'Sasha Lalla', resolved: '' }, 'thin');
check('two bare names',
  { actioned: 'Kamla, Azariah', resolved: '' }, 'thin');
check('"tasks"',            { actioned: 'tasks', resolved: '' }, 'thin');
check('"done"',             { actioned: 'done', resolved: 'done' }, 'thin');
check('"same as above"',    { actioned: 'same as above', resolved: '' }, 'thin');
check('empty',              { actioned: '', resolved: '' }, 'thin');
check('"work"',             { actioned: 'work', resolved: 'none' }, 'thin');
check('"Task Management"',  { actioned: 'Task Management', resolved: '' }, 'thin');
check('copied from the block before',
  { actioned: 'Chased head office on 4 outstanding transmittals', resolved: '' }, 'thin',
  ['Chased head office on 4 outstanding transmittals ']);

console.log('\nThe branch standards, checked rather than printed:\n');
const st = (label, d, wantSome) => {
  const got = env.readStandards_(d, {});
  const pass = wantSome ? got.length > 0 : got.length === 0;
  if (!pass) fails++;
  console.log((pass ? '  PASS  ' : '  FAIL  ') + label.padEnd(52) + (got[0] || 'nothing to raise'));
};
st('waiting on a name with no date', { blockerOwner: 'Head Office' }, true);
st('waiting on a name WITH a date',  { blockerOwner: 'Head Office 28/08' }, false);
st('carrying 3 forward, no blocker', { openOwned: '3 still with me' }, true);
st('carrying 3 forward, blocker named',
   { openOwned: '3 still with me', blocker: 'Underwriting has not returned them' }, false);
st('nothing carried forward',        { openOwned: '', blocker: '' }, false);

console.log('\nAnd it is written into the sheet, in words, next to the block:\n');
{
  const LOGH = ['Timestamp','Date','StaffId','Name','Grade','Status']
    .concat(['KPI1','KPI2','PM1','PM2'].reduce((a,p)=>a.concat([p,p+'_Actioned',p+'_Resolved',p+'_Open',p+'_Blocker']),[]))
    .concat(['Closed','Overdue','Aged60','ValueAdded','Innovation','SystemFlags','Notes','UpdatedAt','Revision'])
    .concat(['KPI1_At','KPI2_At','PM1_At','PM2_At'])
    .concat(['KPI1_Quality','KPI2_Quality','PM1_Quality','PM2_Quality']);
  const TRH = ['TrainingDate','StaffId','Trainer','Block','Trainee','Topic','Objectives','Achieved','Test','Result','Followup','LoggedAt'];
  const e2 = makeEnv();
  e2.__mkSheet('Access', 1, ['Name','StaffId','Email','Password','Role','Unit','Active'],
    [['Sasha Lalla','sasha','sasha@example.com','1','Sales Support Assistant','Support','Yes']]);
  e2.__mkSheet('KPI Log', 2, LOGH, []);
  e2.__mkSheet('KPI Training', 3, TRH, []);

  const thin = e2.saveBlock_({ date:'2026-09-03', block:'PM2', name:'Sasha Lalla',
    data:{ kpi:'Task Management', actioned:'Actioned remaining tasks', resolved:'3 tasks', openOwned:'2' } },
    { staffId:'sasha', name:'Sasha Lalla', manager:false });
  const cell = e2.__sheets['KPI Log']._grid[1][LOGH.indexOf('PM2_Quality')];
  const okc = (l,c,x='') => { console.log((c?'  PASS  ':'  FAIL  ')+l+(x?'  '+x:'')); if(!c) fails++; };
  okc('the thin block is recorded as thin', String(cell).indexOf('thin') === 0, String(cell));
  okc('with the reason in plain words', /count, but nothing named/.test(String(cell)));
  okc('and it still saved', thin.ok === true);
  okc('the reading comes back to the tracker', thin.quality && thin.quality.level === 'thin');

  const full = e2.saveBlock_({ date:'2026-09-03', block:'KPI1', name:'Sasha Lalla',
    data:{ kpi:'Premium Dues', actioned:'Premium dues, 14 processed', resolved:'2 returned to advisor' } },
    { staffId:'sasha', name:'Sasha Lalla', manager:false });
  okc('a real entry is recorded as full',
    String(e2.__sheets['KPI Log']._grid[1][LOGH.indexOf('KPI1_Quality')]) === 'full');
  okc('and the tracker is told so', full.quality && full.quality.level === 'full');
}

// -------------------------------------------------------------------------
// The rule lives twice — in KPI.gs where the sheet is written, and in the
// tracker where the prompt has to be instant. Two copies drift. This puts the
// same corpus through both and demands the same answer, every time.
// -------------------------------------------------------------------------
console.log('\nThe sheet, the tracker and the wall must read every entry the same way:\n');
{
  const fs = require('fs'), vm = require('vm'), path = require('path');
  const html = fs.readFileSync(path.join(__dirname, '..', 'kpi', 'index.html'), 'utf8');
  const a = html.indexOf('const FILLER_RE');
  const b = html.indexOf('\n}\n', html.indexOf('function readStandards')) + 3;
  const ctx = { console, String, Number, Object, Array, RegExp };
  vm.createContext(ctx);
  new vm.Script(html.slice(a, b) +
    '\nglobalThis.readSubstance=readSubstance; globalThis.readStandards=readStandards;',
    { filename: 'tracker-rule.js' }).runInContext(ctx);

  // …and the wall's copy, which reads the raw log text so the branch can see
  // how the day is being written without waiting on an Apps Script redeploy.
  const wall = fs.readFileSync(path.join(__dirname, '..', 'wall', 'index.html'), 'utf8');
  const wa = wall.indexOf('const FILLER_RE');
  const wb = wall.indexOf('\n}\n', wall.indexOf('function readStandards')) + 3;
  const wctx = { console, String, Number, Object, Array, RegExp };
  vm.createContext(wctx);
  new vm.Script(wall.slice(wa, wb) +
    '\nglobalThis.readSubstance=readSubstance; globalThis.readStandards=readStandards;',
    { filename: 'wall-rule.js' }).runInContext(wctx);

  const corpus = [
    { actioned: 'Three contracts Recieved and Macro sent', resolved: 'Macro sent and contracts logged' },
    { actioned: 'Premium dues, 14 processed', resolved: '2 returned to advisor' },
    { actioned: 'Called on the POL-88213 lapse', resolved: 'Reinstated' },
    { actioned: 'Billing recon, Group Health scheme', resolved: '3 mismatches corrected' },
    { actioned: 'Chased head office on 4 outstanding transmittals', resolved: 'None today' },
    { actioned: 'Followed up POL-88213 with underwriting', resolved: 'Awaiting medical' },
    { actioned: 'Sent the renewal pack to Head Office and collected the signed forms from the advisor', resolved: 'Filed' },
    { actioned: 'Actioned remaining tasks', resolved: '3 tasks' },
    { actioned: 'Sasha Lalla', resolved: '' },
    { actioned: 'Kamla, Azariah', resolved: '' },
    { actioned: 'tasks', resolved: '' },
    { actioned: 'done', resolved: 'done' },
    { actioned: 'same as above', resolved: '' },
    { actioned: '', resolved: '' },
    { actioned: 'work', resolved: 'none' },
    { actioned: 'Task Management', resolved: '' },
    { actioned: 'Adopt an Orphan calls, 6 made, 2 appointments set', resolved: '2 booked for Thursday' },
    { actioned: 'nothing much', resolved: '' },
    { actioned: 'Quotations prepared for a Group Health enquiry', resolved: 'Two sent' }
  ];
  let drift = 0;
  corpus.forEach(d => {
    const A = env.readSubstance_(d, []), B = ctx.readSubstance(d, []), C = wctx.readSubstance(d, []);
    const same = A.level === B.level && A.reason === B.reason &&
                 A.level === C.level && A.reason === C.reason;
    if (!same) {
      drift++; fails++;
      console.log('  FAIL  disagree on "' + (d.actioned || '(empty)').slice(0, 40) +
                  '"  sheet=' + A.level + '/' + A.reason +
                  '  tracker=' + B.level + '/' + B.reason +
                  '  wall=' + C.level + '/' + C.reason);
    }
  });
  console.log('  ' + (drift ? '' : 'PASS  ') + corpus.length + ' entries, ' +
              (drift ? drift + ' disagreements' : 'all three copies agree on every one'));

  const stds = [{ blockerOwner: 'Head Office' }, { blockerOwner: 'Head Office 28/08' },
                { openOwned: '3 still with me' }, { openOwned: '3', blocker: 'Underwriting' }, {}];
  let sd = 0;
  stds.forEach(d => {
    const a = env.readStandards_(d, {}).length > 0, b2 = ctx.readStandards(d).length > 0,
          c = wctx.readStandards(d).length > 0;
    if (a !== b2 || a !== c) { sd++; fails++; }
  });
  console.log('  ' + (sd ? 'FAIL  ' : 'PASS  ') + 'the standards checks agree too');
}

console.log('\n' + (fails ? fails + ' FAILED' : 'all green') + '\n');
process.exit(fails ? 1 : 0);
