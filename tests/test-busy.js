/* THE SHEET DID NOT ANSWER — 17 September 2026.
 *
 * A member of staff filed the eleven-to-one block, got no answer after four
 * tries over about two minutes, and resubmitted after lunch. The tracker kept
 * her words, so nothing was lost, but the branch group got a message asking
 * whether the tracker was broken.
 *
 * Two causes, both fixed, both pinned here:
 *
 *   1. every write path read the WHOLE KPI Log — every row, every column —
 *      inside the one script lock the whole branch queues on, to find the one
 *      row it was about to patch.
 *   2. the wall's hourly pending rebuild reads the requirements extract for
 *      about two minutes, six times inside the working day, at whatever
 *      minute Apps Script picks. A submission landing on top of one waits on
 *      the same document.
 *
 * So: a save reads three columns and one row, and the rebuild stands down
 * while anybody is filing. */
const fs = require('fs'), path = require('path'), os = require('os');
const ROOT = path.join(__dirname, '..');
const both = path.join(os.tmpdir(), 'kpi-busy-' + process.pid + '.gs');
fs.writeFileSync(both, fs.readFileSync(path.join(ROOT, 'apps-script/KPI.gs'), 'utf8') + '\n' +
                       fs.readFileSync(path.join(ROOT, 'apps-script/Intelligence.gs'), 'utf8'));
process.env.GS_PATH = both;
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };

const BLOCKS = ['KPI1','KPI2','PM1','PM2'];
const HEAD = ['Timestamp','Date','StaffId','Name','Grade','Status']
  .concat(BLOCKS.reduce((a,p)=>a.concat([p,p+'_Actioned',p+'_Resolved',p+'_Open',p+'_Plan',p+'_Met',p+'_Blocker',p+'_At']),[]))
  .concat(['Closed','Overdue','Aged60','ValueAdded','Innovation','SystemFlags','Notes','UpdatedAt','Revision']);

/* A LOG WITH A TERM'S WORTH OF DAYS IN IT. The row the save wants is the one
   appended most recently, which is the worst case for a scan from the top. */
const DAYS = 90, PEOPLE = ['sasha','azaria','liz','kamla'];
const body = [];
for (let d = 0; d < DAYS; d++) {
  const day = new Date(Date.UTC(2026, 5, 1) + d * 86400000).toISOString().slice(0, 10);
  PEOPLE.forEach(who => {
    const r = new Array(HEAD.length).fill('');
    r[HEAD.indexOf('Date')] = day;
    r[HEAD.indexOf('StaffId')] = who;
    r[HEAD.indexOf('Revision')] = 3;
    body.push(r);
  });
}
const TODAY = '2026-09-17';
const mine = new Array(HEAD.length).fill('');
mine[HEAD.indexOf('Date')] = TODAY;
mine[HEAD.indexOf('StaffId')] = 'liz';
mine[HEAD.indexOf('KPI1')] = 'Pendings';
mine[HEAD.indexOf('Revision')] = 2;
body.push(mine);

console.log('\nA save must not read the whole log to find one row:\n');
const env = makeEnv();
env.__mkSheet('Access', 1, ['Name','StaffId','Email','Password','Role','Unit','Active'],
  [['Beena Sample','liz','liz@example.com','1','Sales Support Assistant','Support','Yes']]);
env.__mkSheet('KPI Log', 2, HEAD, body);
env.__mkSheet('KPI Training', 3, ['TrainingDate','StaffId','Trainer','Block','Trainee','Topic','Objectives','Achieved','Test','Result','Followup','LoggedAt'], []);

/* Cells, not calls: three narrow reads are the point, and counting calls
   alone would pass just as happily on one enormous one. */
const sh = env.__sheets['KPI Log'];
const realGetRange = sh.getRange.bind(sh);
let cells = 0, widest = 0, blocks = [];
sh.getRange = (r, c, nr = 1, nc = 1) => {
  const range = realGetRange(r, c, nr, nc);
  const gv = range.getValues.bind(range);
  range.getValues = () => {
    cells += nr * nc;
    widest = Math.max(widest, nc);
    /* The key columns are read as one narrow rectangle — three of them, or
       four on the training sheet. A WIDE rectangle over the body is the thing
       that must never happen again: that is the whole log. */
    if (nr > 1 && nc > 4) blocks.push(nr + ' rows x ' + nc + ' columns');
    return gv();
  };
  return range;
};

const whole = body.length * HEAD.length;
const res = env.saveBlock_({ date: TODAY, block: 'KPI2',
  data: { kpi: 'Scripts / Clawbacks', actioned: 'Three scripts reviewed', met: 'Met' } },
  { staffId: 'liz', name: 'Beena Sample', manager: false });
ok('the block saves', res.ok, JSON.stringify(res.ok ? '' : res));
ok('it did not pull the whole log', cells < whole / 4,
   cells + ' cells of ' + whole + ' (' + body.length + ' rows x ' + HEAD.length + ' columns)');
const grid = env.__sheets['KPI Log']._grid, hd = grid[0];
/* One full-width read is the row it matched. Nothing reads a rectangle of
   the body, which is what took two minutes in the branch. */
ok('nothing read a wide rectangle of the log', blocks.length === 0, blocks.join(', '));
ok('the widest read is one row of the header\'s width', widest === hd.length,
   'widest ' + widest + ' of ' + hd.length + ' columns');
const row = grid[grid.length - 1];
ok('it patched the row that was already there', grid.length === body.length + 1,
   grid.length + ' rows');
ok('the text landed in the right column', row[hd.indexOf('KPI2_Actioned')] === 'Three scripts reviewed');
ok('the day\'s earlier block was left alone', row[hd.indexOf('KPI1')] === 'Pendings');
ok('the revision moved on from what was there', Number(row[hd.indexOf('Revision')]) === 3);

console.log('\nA duplicate day row keeps its first-match rule:\n');
/* dedupeLog exists because the log can carry two rows for one person and one
   day. The first is the keeper — a faster search must not quietly start
   writing to the second. */
const dup = new Array(HEAD.length).fill('');
dup[HEAD.indexOf('Date')] = TODAY;
dup[HEAD.indexOf('StaffId')] = 'liz';
dup[HEAD.indexOf('Revision')] = 9;
const env2 = makeEnv();
env2.__mkSheet('Access', 1, ['Name','StaffId','Email','Password','Role','Unit','Active'],
  [['Beena Sample','liz','liz@example.com','1','Sales Support Assistant','Support','Yes']]);
env2.__mkSheet('KPI Log', 2, HEAD, [mine.slice(), dup]);
env2.__mkSheet('KPI Training', 3, ['TrainingDate','StaffId','Trainer','Block'], []);
const r2 = env2.saveBlock_({ date: TODAY, block: 'PM1', data: { kpi: 'Claims/ Mat', actioned: 'Two claims' } },
  { staffId: 'liz', name: 'Beena Sample', manager: false });
const g2 = env2.__sheets['KPI Log']._grid;
ok('the save works with a duplicate present', r2.ok, JSON.stringify(r2.ok ? '' : r2));
ok('the first row took the block', g2[1][hd.indexOf('PM1_Actioned')] === 'Two claims');
ok('and the second was not touched', g2[2][hd.indexOf('PM1_Actioned')] === '');

console.log('\nThe wall stands down while anybody is filing:\n');
/* A fresh project, because the saves above have already filed something. */
const env3 = makeEnv();
env3.__mkSheet('Access', 1, ['Name','StaffId','Email','Password','Role','Unit','Active'], []);
ok('nothing filed yet, so nothing to stand down for', env3.staffWroteWithin_(60000) === false);
env3.markStaffWrite_();
ok('a submission is remembered', env3.staffWroteWithin_(60000) === true);
ok('and it is forgotten again', env3.staffWroteWithin_(0) === false);

/* The gate is the hour AND whether the branch is mid-submission. Past the
   gate it goes on to rebuild, and in a test workbook with no pending extract
   that throws — which is itself the proof that the gate let it through, so
   the error is caught and read as the answer. */
const said = h => {
  try { return String(env.intelPendingRefresh(null, h) || ''); }
  catch (e) { return 'went on to rebuild: ' + (e && e.message || e); }
};
ok('mid-morning it stands down', /standing down/.test(said(11)), said(11));
ok('and says when it will come back', /13:00/.test(said(11)), said(11));
ok('mid-afternoon too', /standing down/.test(said(15)), said(15));
/* Five in the morning and seven at night are the night copies. Nobody is
   filing then, and if this ever stood down for them the wall would have no
   stored copy at all the next morning. */
ok('five in the morning does not stand down', /went on to rebuild/.test(said(5)), said(5));
ok('nor does seven at night', /went on to rebuild/.test(said(19)), said(19));
ok('an even hour is still not its hour', /not this hour/.test(said(10)), said(10));

console.log(fails ? '\n' + fails + ' failed\n' : '\nall green\n');
process.exit(fails ? 1 : 0);
