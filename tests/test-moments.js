// What a person was written to about, and what they were thanked for.
//
// A moment used to be one line against a competency. On 8 September the branch
// asked the sharper question: Elizabeth had been reminded four times that
// morning about the same spreadsheet, and nothing in the record could say so.
// So a moment now carries who it came from, whether it was an ask or a
// thank-you, and what it was about — and the repeat is COUNTED rather than
// self-reported, because nobody ever writes "this is the fourth reminder".
const { makeEnv } = require('./harness');
const env = makeEnv();
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };

env.__mkSheet('Competencies', 1, ['Competency', 'Definition', 'Behaviours'],
  [['Reliability', 'Does what was agreed', ''], ['Customer Service', 'Looks after the client', '']]);
// The tab as it stood before today: no Kind, no Source, no About.
env.__mkSheet('Moments', 2, ['MomentId', 'StaffId', 'Date', 'Competency', 'What', 'By', 'UpdatedAt'],
  [['old-1', 'liz', '2026-09-01', 'Reliability', 'Covered the desk at lunch', 'ricky', '']]);
const sh = env.__sheets['Moments'];
const me = { staffId: 'liz', role: 'Sales Support', manager: false, leads: [] };
const note = d => env.noteMoment_(d, me);

console.log('\nThe columns are added to the tab that is already there:\n');
const head = env.ensureMomentColumns_(sh);
ok('Kind, Source and About go on the end', head.join() === 'MomentId,StaffId,Date,Competency,What,By,UpdatedAt,Kind,Source,About', head.join());
ok('and nothing already in it moved', sh._grid[1][0] === 'old-1' && sh._grid[1][4] === 'Covered the desk at lunch');
ok('adding them twice does not double them', env.ensureMomentColumns_(sh).length === head.length);

console.log('\nAn ask has to say what it was about, because that is what counts the repeat:\n');
let r = note({ competency: 'Reliability', what: 'Reminded to update the morning spreadsheet', kind: 'Asked' });
ok('an ask with no subject is refused', !r.ok && /what it was about/.test(r.error), r.error);
r = note({ competency: 'Reliability', what: 'Reminded again about it', kind: 'Asked', about: 'Morning spreadsheet', source: 'Branch Manager' });
ok('with one, it is written', r.ok && r.kind === 'Asked' && r.about === 'Morning spreadsheet' && r.source === 'Branch Manager', JSON.stringify(r));
ok('a thank-you needs no subject', note({ competency: 'Customer Service', what: 'Client wrote in to say thank you', kind: 'Thanked', source: 'A client' }).ok);
ok('an unknown kind is refused', !note({ competency: 'Reliability', what: 'Something happened here', kind: 'Shouted' }).ok);
ok('an unknown source is refused', !note({ competency: 'Reliability', what: 'Something happened here', kind: 'Noted', source: 'The postman' }).ok);
ok('the plain note still works, and defaults to Noted', (() => { const x = note({ competency: 'Reliability', what: 'Stayed to finish the file' }); return x.ok && x.kind === 'Noted'; })());

console.log('\nWritten by the header, so a reordered tab still lands right:\n');
const cols = env.ensureMomentColumns_(sh);
const last = sh._grid[sh._grid.length - 1];
ok('every value is under its own column',
   last[cols.indexOf('Kind')] === 'Noted' && last[cols.indexOf('StaffId')] === 'liz' &&
   last[cols.indexOf('What')] === 'Stayed to finish the file', JSON.stringify(last));

console.log('\nThe fourth reminder counts itself:\n');
env.forgetHr_(env.MOM);
['Morning spreadsheet', 'morning spreadsheet.', 'Morning  Spreadsheet'].forEach((a, i) =>
  note({ competency: 'Reliability', what: 'Asked about it again, time ' + (i + 3), kind: 'Asked', about: a, source: 'Branch Manager' }));
env.forgetHr_(env.MOM);
const mine = env.momentsFor_('liz', '2026-09-01', '2026-12-31');
const asks = env.momentAsks_(mine);
ok('four asks about the one thing read as one line', asks.length === 1 && asks[0].n === 4, JSON.stringify(asks.map(a => a.about + '×' + a.n)));
ok('however it was spelt each time', /morning spreadsheet/i.test(asks[0].about), asks[0].about);
ok('and it names who kept asking', asks[0].from.join() === 'Branch Manager', asks[0].from.join());
ok('with the day it was last asked', asks[0].last === env.todayISO_(), asks[0].last);
ok('a thank-you is not counted as an ask', !asks.some(a => /thank/i.test(a.about)));

console.log('\nWhat a person says they fell short on, before anybody writes to them:\n');
// The branch asked for this by name: a record that only holds what other
// people noticed is a record of supervision, not of somebody's quarter.
ok('a shortfall needs a subject too, for the same reason an ask does',
   !note({ competency: 'Reliability', what: 'Did not get to the upload today', kind: 'Short' }).ok);
let sr = note({ competency: 'Reliability', what: 'Forgot the upload again, will set an alarm', kind: 'Short', about: 'Branch portfolio upload', source: 'Myself' });
ok('with one, it is written and owned', sr.ok && sr.kind === 'Short' && sr.source === 'Myself', JSON.stringify(sr));
note({ competency: 'Reliability', what: 'Missed it a second time', kind: 'Short', about: 'branch portfolio upload.', source: 'Myself' });
env.forgetHr_(env.MOM);
const mine2 = env.momentsFor_('liz', '2026-09-01', '2026-12-31');
const shorts = env.momentAsks_(mine2, 'Short');
ok('two shortfalls on the one thing count as one line, twice', shorts.length === 1 && shorts[0].n === 2, JSON.stringify(shorts.map(x => x.about + '×' + x.n)));
ok('and a shortfall is not counted as an ask', !env.momentAsks_(mine2).some(a => /branch portfolio/i.test(a.about)),
   env.momentAsks_(mine2).map(a => a.about).join(' | '));

console.log('\nRows written before today read as what they were:\n');
const old = mine.filter(m => m.id === 'old-1')[0];
ok('a moment from before the change is a plain note', old && old.kind === 'Noted' && old.about === '' && old.source === '', JSON.stringify(old));

console.log('\nAnd the form is told what it may offer:\n');
ok('four kinds, the ask first and the shortfall second', env.MOMENT_KINDS.map(k => k.v).join() === 'Asked,Short,Thanked,Noted', env.MOMENT_KINDS.map(k => k.v).join());
ok('each with words a person would use', env.MOMENT_KINDS.every(k => /\s/.test(k.label)), JSON.stringify(env.MOMENT_KINDS.map(k => k.label)));
ok('and the sources include the ones that write to this branch',
   env.MOMENT_SOURCES.indexOf('Branch Manager') > -1 && env.MOMENT_SOURCES.indexOf('Head office') > -1 && env.MOMENT_SOURCES.indexOf('A client') > -1);

console.log(fails ? '\n' + fails + ' FAILED\n' : '\nall green\n');
process.exit(fails ? 1 : 0);
