// Before you leave.
//
// The register said a person was here. It never said what they left behind
// them, and on 10 September the branch asked for exactly that: gauge what was
// actually done, and ask while the person is still at the desk.
//
// Two things make the list worth answering, and both are tested here. It
// never asks what the sheet can already see — blocks, the afternoon sweep,
// anything written to you today tick themselves and show the evidence they
// read. And the list belongs to the branch, on its own tab, so a line can be
// added the morning after the fourth reminder without a deployment.
//
// The quarter-to-four e-mail carries a link per unticked line, and a link
// has to work from a phone with nobody signed in — so it is signed, it is
// good for one person on one day, and a forged one records nothing.
const { makeEnv } = require('./harness');
const env = makeEnv();
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };

const NOW = new Date('2026-09-10T15:47:00');
const realDate = env.Date;
env.Date = new Proxy(realDate, { construct(t, a) { return a.length ? new realDate(...a) : new realDate(NOW.getTime()); },
                                 get(t, k) { return k === 'now' ? () => NOW.getTime() : t[k]; } });
const TODAY = '2026-09-10';

// The log's real shape — blocksSubmittedOn_ reads the block's own column and
// its _Actioned, not a KPI/Quality pair, so a made-up header proves nothing.
const LOGH = ['Timestamp', 'Date', 'StaffId', 'Name', 'Grade', 'Status']
  .concat(['KPI1', 'KPI2', 'PM1', 'PM2'].reduce((a, p) => a.concat([p, p + '_Actioned', p + '_Resolved', p + '_Open', p + '_Blocker']), []))
  .concat(['Closed', 'Overdue', 'Aged60', 'ValueAdded', 'Innovation', 'SystemFlags', 'Notes', 'UpdatedAt', 'Revision'])
  .concat(['KPI1_At', 'KPI2_At', 'PM1_At', 'PM2_At'])
  .concat(['KPI1_Quality', 'KPI2_Quality', 'PM1_Quality', 'PM2_Quality'])
  .concat(['KPI1_Plan', 'KPI2_Plan', 'PM1_Plan', 'PM2_Plan'])
  .concat(['KPI1_Met', 'KPI2_Met', 'PM1_Met', 'PM2_Met'])
  .concat(['MailAM', 'MailPM']);
const logRow = (date, sid, name, fields) => {
  const r = new Array(LOGH.length).fill('');
  Object.keys(fields || {}).forEach(h => { r[LOGH.indexOf(h)] = fields[h]; });
  r[LOGH.indexOf('Date')] = date; r[LOGH.indexOf('StaffId')] = sid; r[LOGH.indexOf('Name')] = name;
  return r;
};

env.__mkSheet('Access', 1, ['Name', 'StaffId', 'Email', 'Password', 'Role', 'Unit', 'Active'],
  [['Ada Quill', 'ada', 'ada@example.com', '1', 'Sales Support Assistant', 'Support', 'Yes'],
   ['Bram Quill', 'bram', 'bram@example.com', '1', 'Unit Manager', 'Unit', 'Yes'],
   ['Cleo Quill', 'cleo', 'cleo@example.com', '1', 'Sales Support Assistant', 'Support', 'Yes'],
   ['Dev Quill', 'dev', 'dev@example.com', '1', 'Sales Support Assistant', 'Support', 'Yes']]);
env.__mkSheet('KPI Log', 2, LOGH, []);
env.__mkSheet('KPI Training', 3, ['Date', 'StaffId', 'Kind', 'What'], []);
env.__mkSheet('Attendance', 4, ['Date', 'StaffId', 'Name', 'FirstSignIn', 'LastSeen', 'SignedOut',
                                'Status', 'Reason', 'MarkedBy', 'UpdatedAt'],
  [[TODAY, 'ada', 'Ada Quill', '08:01', '15:30', '', 'in', '', 'ada', ''],
   [TODAY, 'bram', 'Bram Quill', '07:52', '15:30', '', 'in', '', 'bram', ''],
   [TODAY, 'cleo', 'Cleo Quill', '', '', '', 'absent', 'Sick', 'cleo', '']]);
   // dev has no row at all: a day nobody opened.
env.__mkSheet('Competencies', 5, ['Order', 'Competency', 'Definition', 'Behaviours'],
  [[1, 'Reliability', 'Does what was agreed', 'one']]);
env.__mkSheet('Moments', 6, ['MomentId', 'StaffId', 'Date', 'Competency', 'What',
                             'Kind', 'Source', 'About', 'By', 'UpdatedAt'], []);
env.sfkMetricsSafe_ = () => ({ ok: false, reason: 'notConfigured' });

const one = () => env.rosterPerson_('ada');
const forget = () => { env.forgetHr_(env.CLO); env.forgetHr_(env.CLOG); env.forgetHr_(env.MOM);
                       env.forgetHr_(env.ATT); env._entryMemo = null; };

console.log('\nThe list makes itself the first time it is asked for:\n');
env.closeoutSheet_();
const tab = env.__sheets['Closeout Items'];
ok('the tab exists, with a header', !!tab && tab._grid[0].join() === env.CLO.head.join(), tab && tab._grid[0].join());
ok('and four lines are seeded', tab._grid.length === 5, String(tab._grid.length - 1));
const items = env.closeoutItems_(one());
ok('three are live', items.length === 3, JSON.stringify(items.map(i => i.id)));
ok('and all three check themselves', items.every(i => i.auto), JSON.stringify(items));
ok('the fourth ships switched off, so nobody is told to do something nobody asked',
   !items.some(i => i.id === 'portfolio'));

console.log('\nWho a line is for, read the way the person editing it would write it:\n');
const t1 = one(), t2 = env.rosterPerson_('bram');
ok('blank is everybody', env.closeoutApplies_('', t1) && env.closeoutApplies_('', t2));
ok('"All" is everybody', env.closeoutApplies_('All', t1) && env.closeoutApplies_('all', t2));
ok('a role key picks one desk', env.closeoutApplies_('um', t2) && !env.closeoutApplies_('um', t1));
ok('a staff id picks one person', env.closeoutApplies_('ada', t1) && !env.closeoutApplies_('ada', t2));
ok('a name does too', env.closeoutApplies_('Bram Quill', t2) && !env.closeoutApplies_('Bram Quill', t1));
ok('and a list of them', env.closeoutApplies_('zed, um', t2) && !env.closeoutApplies_('zed, um', t1));

console.log('\nIt never asks what the sheet can already see:\n');
let st = env.closeoutFor_(one(), TODAY);
ok('nothing is in, so nothing is ticked', st.left === 3 && !st.complete, JSON.stringify(st.items.map(i => i.done)));
ok('and each line says what it read', st.items.every(i => i.detail), JSON.stringify(st.items.map(i => i.detail)));
ok('the blocks line counts them', /0 of 4 reported/.test(st.items.filter(i => i.auto === 'blocks')[0].detail));

// A full day's work lands on the sheet: four blocks and the afternoon sweep.
env.__sheets['KPI Log'].appendRow(logRow(TODAY, 'ada', 'Ada Quill', {
  MailAM: '08:30|bm:done', MailPM: '14:10|bm:done',
  KPI1: 'Renewa/PDl/Bill', KPI1_Actioned: 12, KPI2: 'Renewa/PDl/Bill', KPI2_Actioned: 9,
  PM1: 'Renewa/PDl/Bill', PM1_Actioned: 7, PM2: 'Renewa/PDl/Bill', PM2_Actioned: 4 }));
forget();
st = env.closeoutFor_(one(), TODAY);
const byId = {}; st.items.forEach(i => { byId[i.id] = i; });
ok('four blocks in ticks the blocks line by itself', byId.blocks.done && /4 of 4/.test(byId.blocks.detail), JSON.stringify(byId.blocks));
ok('the afternoon sweep ticks itself, with the time', byId.mail.done && /14:10/.test(byId.mail.detail), JSON.stringify(byId.mail));
ok('nothing written to today is still an open question', !byId.written.done, JSON.stringify(byId.written));
ok('and it says so rather than pretending', /nothing noted today/.test(byId.written.detail), byId.written.detail);

console.log('\nA line the sheet cannot see is asked, and the answer is recorded:\n');
let r = env.tickCloseout_({ itemId: 'written' }, { staffId: 'ada', name: 'Ada Quill' });
ok('ticking it closes the day out', r.ok && r.complete && r.left === 0, JSON.stringify({ ok: r.ok, left: r.left }));
const log = env.__sheets['Closeout Log'];
ok('one row on the log', log._grid.length === 2, String(log._grid.length - 1));
ok('with the date, the desk, the wording and the minute',
   log._grid[1][0] === TODAY && log._grid[1][1] === 'ada' &&
   /written to about/.test(log._grid[1][4]) && log._grid[1][5] === 'Done' && log._grid[1][7] === '15:47',
   JSON.stringify(log._grid[1]));
env.tickCloseout_({ itemId: 'written' }, { staffId: 'ada', name: 'Ada Quill' });
ok('ticking again writes in place, it does not stack rows', log._grid.length === 2, String(log._grid.length - 1));
ok('a line that is not on your list is refused',
   !env.tickCloseout_({ itemId: 'portfolio' }, { staffId: 'ada', name: 'Ada Quill' }).ok);
ok('"not done" has to say what stopped it',
   !env.tickCloseout_({ itemId: 'written', status: 'Not done' }, { staffId: 'ada' }).ok);

console.log('\nA moment filed today answers the same line, without a tick:\n');
env.__sheets['Moments'].appendRow(['m1', 'bram', TODAY, 'Reliability', 'Reminded about the upload',
                                   'Asked', 'Branch Manager', 'Branch portfolio', 'ricky', '']);
forget();
const s2 = env.closeoutFor_(env.rosterPerson_('bram'), TODAY);
ok('it ticks itself and counts them', s2.items.filter(i => i.auto === 'written')[0].done &&
   /1 noted today/.test(s2.items.filter(i => i.auto === 'written')[0].detail),
   JSON.stringify(s2.items.filter(i => i.auto === 'written')[0]));

console.log('\nThe link in the e-mail is good for one person, on one day:\n');
const key = env.closeoutSig_('ada', TODAY);
ok('a signature is issued', !!key && key.length > 10, key);
ok('the same person and day signs the same', env.closeoutSig_('ada', TODAY) === key);
ok('another person does not', env.closeoutSig_('bram', TODAY) !== key);
ok('and neither does another day', env.closeoutSig_('ada', '2026-09-11') !== key);
const url = env.closeoutUrl_('ada', TODAY, 'written');
ok('the link carries the desk, the day, the key and the line',
   /co=ada/.test(url) && /d=2026-09-10/.test(url) && url.indexOf('k=') > -1 && /i=written/.test(url), url);

console.log('\nAnd a tick from that link records, from a phone with nobody signed in:\n');
forget();
let page = env.closeoutClick_({ parameter: { co: 'bram', d: TODAY, k: env.closeoutSig_('bram', TODAY), i: 'blocks' } });
ok('the page comes back', !!page && page.getContent().indexOf('Recorded') > -1);
forget();
const s2b = env.closeoutFor_(env.rosterPerson_('bram'), TODAY);
ok('and the line is ticked, marked as coming from the mail',
   s2b.items.filter(i => i.id === 'blocks')[0].done, JSON.stringify(s2b.items.filter(i => i.id === 'blocks')[0]));
ok('the log says where the tick came from',
   env.__sheets['Closeout Log']._grid.some(r => r[1] === 'bram' && r[3] === 'blocks' && r[8] === 'email'),
   JSON.stringify(env.__sheets['Closeout Log']._grid));
ok('what is still open is listed on the page, each one a link',
   page.getContent().indexOf('Tap to mark it done') > -1);

const forged = env.closeoutClick_({ parameter: { co: 'ada', d: TODAY, k: 'not-the-key', i: 'blocks' } });
ok('a forged key is turned away', !!forged && /expired/.test(forged.getContent()));
const before = env.__sheets['Closeout Log']._grid.length;
env.closeoutClick_({ parameter: { co: 'ada', d: TODAY, k: 'not-the-key', i: 'mail' } });
ok('and records nothing', env.__sheets['Closeout Log']._grid.length === before);
ok('a GET that is not ours is left alone', env.closeoutClick_({ parameter: { action: 'rows' } }) === null);

console.log('\nQuarter to four, to the desks whose day is open:\n');
forget();
env.__calls.mail = 0;
const sent = [];
env.MailApp.sendEmail = m => { env.__calls.mail++; sent.push(m); };
const msg = env.sendCloseout();
ok('the absent desk is not written to', !sent.some(m => /cleo@/.test(m.to)), JSON.stringify(sent.map(m => m.to)));
ok('nor is the desk that never signed in', !sent.some(m => /dev@/.test(m.to)), JSON.stringify(sent.map(m => m.to)));
ok('the desk that is already clear is not written to either',
   !sent.some(m => /ada@/.test(m.to)), JSON.stringify(sent.map(m => m.to)));
ok('the one with something left is', sent.some(m => /bram@/.test(m.to)), JSON.stringify(sent.map(m => m.to)));
ok('the subject says how much is left', sent.length === 1 && /Before you leave/.test(sent[0].subject) &&
   /\d+ thing/.test(sent[0].subject), sent.length ? sent[0].subject : '(none sent)');
ok('every open line carries its own link', sent.length === 1 &&
   (sent[0].htmlBody.match(/Mark it done/g) || []).length === 1, sent.length ? String((sent[0].htmlBody.match(/Mark it done/g) || []).length) : '');
ok('what is already in is shown as read rather than asked again',
   sent.length === 1 && /1 noted today/.test(sent[0].htmlBody) && /&#10003;/.test(sent[0].htmlBody));
ok('and a line somebody said was done reads as their word, not as the count that disagrees',
   sent.length === 1 && /said done at 15:47/.test(sent[0].htmlBody) && !/0 of 4 reported/.test(sent[0].htmlBody),
   sent.length ? (sent[0].htmlBody.match(/said done[^<]*/) || ['(not there)'])[0] : '');
ok('it says who it wrote to', /bram|Bram/.test(msg), msg);

console.log('\nAnd the branch can add a line without a deployment:\n');
forget();
const added = env.closeoutAdd('Upload the branch portfolio', 'ada');
ok('it says what it did', /branch portfolio/i.test(added) && /ada/.test(added), added);
forget();
const mine = env.closeoutItems_(env.rosterPerson_('ada')).map(i => i.id);
ok('it is on that desk\'s list tonight', mine.indexOf('upload-the-branch-portfolio') > -1, JSON.stringify(mine));
ok('and on nobody else\'s',
   env.closeoutItems_(env.rosterPerson_('bram')).every(i => i.id !== 'upload-the-branch-portfolio'));
forget();
ok('a second line with the same words gets its own id',
   /portfolio-2/.test(JSON.stringify(env.closeoutAdd('Upload the branch portfolio', 'bram'))) ||
   env.__sheets['Closeout Items']._grid.some(r => r[0] === 'upload-the-branch-portfolio-2'),
   JSON.stringify(env.__sheets['Closeout Items']._grid.map(r => r[0])));
ok('an empty one is refused', (() => { try { env.closeoutAdd(''); return false; } catch (e) { return true; } })());

console.log('\nThe clock that sends it:\n');
env.installTriggers();
const t = env.ScriptApp.getProjectTriggers().filter(x => x.getHandlerFunction() === 'sendCloseout');
ok('one trigger, once a day', t.length === 1 && t[0].chain.some(c => c === 'everyDays(1)'), JSON.stringify(t.map(x => x.chain)));
ok('at a quarter to four', t.length === 1 && t[0].chain.some(c => c === 'atHour(15)') &&
   t[0].chain.some(c => c === 'nearMinute(45)'), t.length ? JSON.stringify(t[0].chain) : '');
ok('and reinstalling does not double it',
   (env.installTriggers(), env.ScriptApp.getProjectTriggers().filter(x => x.getHandlerFunction() === 'sendCloseout').length === 1));

console.log(fails ? '\n' + fails + ' FAILED\n' : '\nall green\n');
process.exit(fails ? 1 : 0);
