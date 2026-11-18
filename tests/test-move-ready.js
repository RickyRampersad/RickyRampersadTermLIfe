// Is the Builder ready to run — and, after the move to the Workspace, did the move take?
//
// 10 November 2026: "Move the Builder to support@". The sheet is owned by the personal
// Gmail, and File > Make a copy carries the tabs and the code and NOTHING else: not one
// Script property, not one trigger. Both are invisible from outside, and both have
// already cost this branch days of work nobody could see going wrong —
//
//   a blank branch code locks every person out of the page, and the refusal reads as
//   the agent's own fault;
//   the week cycle left uninstalled meant NINE DAYS with no meeting at all, and the
//   only trace was a ping saying there was one meeting, from 30 October.
//
// So ?action=ping now answers which settings are filled in and which timed jobs are
// installed. What this suite holds it to:
//
//   it never throws, whatever is missing — a ping that fails is indistinguishable from
//                a backend that is down, which is the one thing it exists to tell apart;
//   a fresh copy reads as a fresh copy: every setting false, every job false;
//   NOT ONE VALUE IS IN THE ANSWER. This endpoint needs no sign-in and the /exec sits
//                in a public repository. One of these settings is the branch code.
//   the two folder ids read false on a copy and that is CORRECT, because a value
//                carried over by hand files the minutes back into the old Drive.
//
// Run: node tests/test-move-ready.js
const path = require('path');
const ROOT = path.join(__dirname, '..');
process.env.GS_PATH = path.join(ROOT, 'apps-script/Meetings.gs');
const { makeEnv } = require('./harness');
const env = makeEnv();
let fails = 0;
const ok = (what, cond, extra) => {
  console.log((cond ? '  ok   ' : '  FAIL ') + what + (extra !== undefined && !cond ? '  — ' + extra : ''));
  if (!cond) fails++;
};

env.DriveApp = {
  createFolder: name => ({ getId: () => 'folder-1', getName: () => name,
                           setSharing: function () { return this; } }),
  getFolderById: id => ({ getId: () => id, getName: () => 'Branch Meeting Materials' }),
  Access: { PRIVATE: 'PRIVATE' }, Permission: { NONE: 'NONE' }
};

const SETTINGS = ['branchCode', 'rosterSheet', 'trackerUrl', 'bridgeKey', 'relayUrl',
                  'relayKey', 'portfolioSheet', 'serviceSheets', 'factFindWall',
                  'meetingsFolder', 'archiveFolder'];
const JOBS = ['buildWednesday', 'weekClose', 'dailyMeetingNote', 'mondayBrief',
              'builderProgress', 'contentAsk', 'activityMorning', 'activityAfternoon'];

/* ── 1. A FRESH COPY: nothing stored, nothing installed ───────────────── */
console.log('\nA FRESH COPY, STRAIGHT AFTER File > Make a copy');
let p = env.apiPing_();
ok('the ping answers at all', !!p && p.ok === true);
ok('and says which build is live', /^\d{4}-\d{2}-\d{2}/.test(String(p.version || '')), p.version);
ok('settings are reported', !!p.settings);
ok('jobs are reported', !!p.jobs);
ok('every setting reads as not set', SETTINGS.every(k => p.settings[k] === false),
   JSON.stringify(p.settings));
ok('every timed job reads as not installed', JOBS.every(k => p.jobs[k] === false),
   JSON.stringify(p.jobs));
ok('the branch code is named as missing', p.settings.branchCode === false);
ok('and the week cycle too, which is why there would be no meeting',
   p.jobs.buildWednesday === false && p.jobs.weekClose === false);
ok('branch mail starts HELD on a copy, so the branch hears nothing by accident',
   p.branchMail === 'held', p.branchMail);
ok('the two folder ids read false, which is correct on a copy',
   p.settings.meetingsFolder === false && p.settings.archiveFolder === false);

/* ── 2. NO VALUE IS EVER IN THE ANSWER ────────────────────────────────── */
console.log('\nTHE ANSWER IS PUBLIC');
const SECRETS = {
  'JOIN_CODE': '81724409',
  'ROSTER_SHEET_ID': '1RosterSheetIdAbCdEf',
  'TRACKER_URL': 'https://script.example/tracker/exec',
  'MEET_BRIDGE_KEY': 'bridge-secret-0123456789',
  'MAIL_RELAY_URL': 'https://script.example/relay/exec',
  'MAIL_RELAY_KEY': 'relay-secret-9876543210',
  'PORTFOLIO_SHEET_ID': '1PortfolioIdZyXwVu',
  'SERVICE_SHEET_IDS': '1ServiceA,1ServiceB',
  'FACTFIND_WALL_URL': 'https://script.example/ff/exec',
  'MEETINGS_FOLDER_ID': 'folder-old-drive-1',
  'ARCHIVE_FOLDER_ID': 'folder-old-drive-2'
};
const props = env.PropertiesService.getScriptProperties();
Object.keys(SECRETS).forEach(k => props.setProperty(k, SECRETS[k]));
p = env.apiPing_();
ok('every setting now reads as set', SETTINGS.every(k => p.settings[k] === true),
   JSON.stringify(p.settings));
const json = JSON.stringify(p);
Object.keys(SECRETS).forEach(k => ok('the value of ' + k + ' is not in the answer',
                                     json.indexOf(SECRETS[k]) === -1));
ok('nor is the branch code, by any route', json.indexOf('81724409') === -1);
ok('every setting is a plain true or false, never a value',
   SETTINGS.every(k => typeof p.settings[k] === 'boolean'));

/* ── 3. ONE JOB AT A TIME, so a half-finished move is visible ─────────── */
console.log('\nINSTALLING THE JOBS');
env.installWeekCycle && env.installWeekCycle();
p = env.apiPing_();
ok('the week cycle shows up once it is installed',
   p.jobs.buildWednesday === true && p.jobs.weekClose === true, JSON.stringify(p.jobs));
ok('and the ones still to do are still false',
   p.jobs.builderProgress === false && p.jobs.contentAsk === false);
env.installBuilderProgress && env.installBuilderProgress();
p = env.apiPing_();
ok('the daily progress note shows up', p.jobs.builderProgress === true);
ok('without claiming anything else was installed',
   p.jobs.contentAsk === false && p.jobs.mondayBrief === false);

/* ── 4. IT NEVER THROWS ───────────────────────────────────────────────── */
console.log('\nNOTHING HERE MAY THROW');
const realProps = env.PropertiesService;
env.PropertiesService = { getScriptProperties: () => { throw new Error('no store'); } };
let threw = false, out = null;
try { out = env.apiPing_(); } catch (e) { threw = true; }
ok('a store that will not answer does not take the ping down', !threw);
ok('and settings reads null rather than a half-truth', out && out.settings === null,
   out && JSON.stringify(out.settings));
env.PropertiesService = realProps;

const realApp = env.ScriptApp;
env.ScriptApp = { getProjectTriggers: () => { throw new Error('no triggers'); } };
threw = false; out = null;
try { out = env.apiPing_(); } catch (e) { threw = true; }
ok('nor does a trigger list that will not answer', !threw);
ok('and jobs reads null', out && out.jobs === null);
env.ScriptApp = realApp;

/* ── 5. WHICH ACCOUNT, which is the whole point of the move ──────────── */
console.log('\nWHICH ACCOUNT IT RUNS ON');
const realSession = env.Session;
env.Session = { getScriptTimeZone: () => 'America/Port_of_Spain',
                getEffectiveUser: () => ({ getEmail: () => 'ricky@gmail.com' }) };
p = env.apiPing_();
ok('still on the personal Gmail is named as such', p.runsAs === 'gmail.com', p.runsAs);
ok('and onWorkspace is false', p.onWorkspace === false);
env.Session = { getScriptTimeZone: () => 'America/Port_of_Spain',
                getEffectiveUser: () => ({ getEmail: () => 'support@rickyrampersadbranch.com' }) };
p = env.apiPing_();
ok('moved to the Workspace is named as such',
   p.runsAs === 'rickyrampersadbranch.com', p.runsAs);
ok('and onWorkspace is true', p.onWorkspace === true);
ok('the DOMAIN only, never the address', JSON.stringify(p).indexOf('support@') === -1);
env.Session = { getScriptTimeZone: () => 'America/Port_of_Spain',
                getEffectiveUser: () => { throw new Error('not Execute as Me'); } };
p = env.apiPing_();
ok('a deployment that is not Execute as: Me reads empty, not wrong',
   p.runsAs === '' && p.onWorkspace === false, p.runsAs);
env.Session = realSession;

console.log(fails ? '\n' + fails + ' failing' : '\nall passing');
process.exit(fails ? 1 : 0);
