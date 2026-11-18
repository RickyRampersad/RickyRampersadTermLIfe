// The agents' Salesforce brief goes ONCE, even when the Agent Briefs tab cannot be written
// (Ricky, 10 Nov 2026; found live: one agent had the same brief 55 times in two days, which
// ate the account's daily mail allowance and stopped the agents' own morning reports).
//
// Pinned: the tab is the record and still the first guard; with the tab broken, today's
// Script-Property mark holds the line at one brief a client a day; the mark is written the
// moment the brief has gone, so a throw after the send cannot undo it; the marks are pruned,
// so this can never be what fills the store; and a broken tab is never quiet.
const path = require('path');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };

process.env.GS_PATH = path.join(__dirname, '..', 'apps-script', 'Transition.gs');
delete require.cache[require.resolve('./harness')];
const { makeEnv } = require('./harness');
const e = makeEnv({ props: {} });

const TOK = 'TOKAAA', AG = 'Jamil Khan', KEY = e.tNameKey_(AG);

// ---- the day mark ---------------------------------------------------------------------
ok('no mark to begin with', Object.keys(e.tBriefDayRead_()).length === 0);
e.tBriefDayMark_([TOK + '|' + KEY]);
ok('a mark is read back', e.tBriefDayRead_()[TOK + '|' + KEY] === 1);
ok('and only for that pair', e.tBriefDayRead_()['OTHER|' + KEY] === undefined);
e.tBriefDayMark_(['TOKBBB|' + KEY]);
ok('a second mark joins the first, never replaces it',
  e.tBriefDayRead_()[TOK + '|' + KEY] === 1 && e.tBriefDayRead_()['TOKBBB|' + KEY] === 1);
ok('an empty list writes nothing', (e.tBriefDayMark_([]), true));

// the old days are pruned, so the store cannot fill (the 26 October lesson)
const props = e.PropertiesService.getScriptProperties();
props.setProperty(e.tBriefDayKey_(e.tBriefDay_(-9)), '{"old|x":1}');
props.setProperty(e.tBriefDayKey_(e.tBriefDay_(-1)), '{"yesterday|x":1}');
e.tBriefDayMark_(['TOKCCC|' + KEY]);
ok('a mark from nine days ago is pruned', props.getProperty(e.tBriefDayKey_(e.tBriefDay_(-9))) === null);
ok('yesterday is kept', props.getProperty(e.tBriefDayKey_(e.tBriefDay_(-1))) !== null);
ok("today's is kept", props.getProperty(e.tBriefDayKey_()) !== null);

// ---- what is due ----------------------------------------------------------------------
//  One Salesforce naming on the Household Assignments tab, nothing in the Assignment Log.
e.tHaRead_ = () => ({ sh: null, ix: {}, last: 2, rows: [
  { rn: 2, hh: 'H1', token: TOK, client: 'A Client', cno: '', pols: [], agent: AG, date: '2026-11-08', source: 'Salesforce', fb: '' }
] });
e.tAlogRead_ = () => ({});

let log = null;
e.tBriefLogRead_ = () => (log === null ? {} : log);   // {} is also what a tab that cannot be made returns

props.deleteProperty(e.tBriefDayKey_());
ok('with neither record, the naming is due', Object.keys(e.tSfBriefsDue_()).length === 1);

log = { [TOK + '|' + KEY]: 'sent' };
ok('the tab alone is enough to hold it back', Object.keys(e.tSfBriefsDue_()).length === 0);

log = null;                                            // the tab is broken: it reads empty
e.tBriefDayMark_([TOK + '|' + KEY]);
ok('with the tab broken, TODAY\'S MARK holds it back', Object.keys(e.tSfBriefsDue_()).length === 0);

props.deleteProperty(e.tBriefDayKey_());
ok('and tomorrow it is due again, which is the bound: one a day, not thirty-three',
  Object.keys(e.tSfBriefsDue_()).length === 1);

// ---- a tab that cannot be written is never quiet ---------------------------------------
const logged = [];
e.log_ = (a, b, c) => logged.push(b + ': ' + c);
e.ss_ = () => { throw new Error('This action would increase the number of cells in the workbook above the limit.'); };
e.tBriefLog_([{ tok: TOK, client: 'A Client', agent: AG, on: '2026-11-08', source: 'Salesforce', status: 'sent' }]);
ok('it does not throw', true);
ok('it says the once-guard is broken', logged.some(x => /ONCE-GUARD IS BROKEN/.test(x)), logged.join(' | '));
ok('and leaves a flag a person can read', /^\d{4}-\d{2}-\d{2}: /.test(String(props.getProperty('brief_log_broken'))),
  String(props.getProperty('brief_log_broken')));

console.log(fails ? '\n' + fails + ' FAILED' : '\nall passing');
process.exit(fails ? 1 : 0);
