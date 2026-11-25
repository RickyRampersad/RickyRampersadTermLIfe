// Salesforce says they are here (25 November 2026).
// Sasha signed in at 7:00 and logged in to Salesforce at 7:09; at 7:38 the clock still marked her absent and ran the
// cover, because the register it read had no sign-in. Pinned: the clock does not mark a desk absent that Salesforce
// shows at work today, it writes the register "in" at that time instead, and the cover re-reads the register and asks
// Salesforce before anybody's work moves. A desk Salesforce does not show is marked absent as before.
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };
const DAY = '2026-11-25';
const env = makeEnv();
env.todayISO_ = () => DAY;
env.__mkSheet('Access', 1, ['Name', 'StaffId', 'Email', 'Password', 'Role', 'Unit', 'Active'],
  [['Sasha Lalla', 'sasha', 'sasha@example.com', '1', 'Sales Support Assistant', 'Support', 'Yes'],
   ['Elizabeth Lee', 'elizabeth', 'liz@example.com', '1', 'Sales Support Assistant', 'Support', 'Yes']]);
env.__mkSheet('Attendance', 2, env.ATT.head, []);
env.sfkConfigured_ = () => true;
env.sfkUsers_ = () => ({ sasha: { id: '005S' }, elizabeth: { id: '005E' } });
env.sfkUtcAt_ = () => '2026-11-25T04:00:00Z';
env.sfkQuery_ = q => /LoginHistory/.test(q) && /005S/.test(q) ? [{ LoginTime: '2026-11-25T11:09:43.000+0000' }] : [];
env.sfkNotes_ = () => [];
env.runlog_ = () => {};
// Every desk's morning e-mail went at 6:30.
const P = env.PropertiesService.getScriptProperties();
['sasha', 'elizabeth'].forEach(s => P.setProperty('daystart_first_' + s + '_' + DAY, '06:30'));
env.autoAbsentOn_ = () => true;
const present = {}, absent = {};
const marked = env.autoAbsentTick_(DAY, 9 * 60, present, absent);
const rows = env.hrRows_(env.ATT, true).filter(r => env.isoDay_(r.Date) === DAY);
const sasha = rows.find(r => r.StaffId === 'sasha');
ok('Sasha, at work in Salesforce, is not marked absent', marked.indexOf('sasha') < 0 && !absent.sasha, JSON.stringify(marked));
ok('her register reads in, from Salesforce', sasha && sasha.Status === 'in' && /Salesforce/.test(sasha.Reason || ''), JSON.stringify(sasha));
ok('the time is her Salesforce log-in, 7:09', sasha && env.timeStr_(sasha.FirstSignIn) === '07:09', sasha && String(sasha.FirstSignIn));
ok('a desk Salesforce does not show is still marked absent', marked.indexOf('elizabeth') > -1);
// The cover: an absence that a later sign-in has answered moves nothing.
env.__mkSheet('Attendance', 2, env.ATT.head, [[DAY, 'sasha', 'Sasha Lalla', '07:00', '07:00', 'in', '', 'sasha', '', '']]);
env.forgetHr_(env.ATT);
let ran = 0; env.coverRun_ = () => { ran++; return { plan: { first: 'Sasha', kept: [] }, ok: [] }; };
const out = env.coverTick_(DAY, 8 * 60, { }, { sasha: 1 });
ok('the cover reads the register again and moves nothing for someone signed in', ran === 0 && /not covered/.test(out.join(' ')), out.join(' | '));
console.log(fails ? '\n' + fails + ' FAILED' : '\nall green');
process.exit(fails ? 1 : 0);
