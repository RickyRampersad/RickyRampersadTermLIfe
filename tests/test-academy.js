// The Academy sign-in backend, apps-script/Academy.gs, run under the fake
// Sheets with real SHA-256 and HMAC patched in.
//
// This is the code that decides who gets in and what a parent can see. A
// mistake here is not a broken page — it is a child's password stored in
// the clear, a token that still works after a family is switched off, or a
// parent shown the wrong child. So the file is run end to end: a row is
// added to Users the way the Academy would, the password is chosen, the
// sign-in is refused five times and then locked, the token is tampered
// with, expired, disabled, and finally the parent asks for the child.
//
// It also holds the line the product is sold on: a free practice app asks
// for what it needs to teach and nothing it could sell. Registration must
// refuse to store an occupation or an employer, the marketing box must be
// off unless a parent turns it on, and the dashboard must count children
// rather than name them.
//
// Run: node tests/test-academy.js   (needs nothing but node)
const crypto = require('crypto');
process.env.GS_PATH = __dirname + '/../apps-script/Academy.gs';
const { makeEnv } = require('./harness');
const env = makeEnv();

// What the harness has no answer for, Apps Script does. Real ones here.
env.Utilities.DigestAlgorithm = { SHA_256: 'SHA_256' };
env.Utilities.computeDigest = (alg, input) => [...crypto.createHash('sha256').update(String(input), 'utf8').digest()];
env.Utilities.computeHmacSha256Signature = (value, key) => [...crypto.createHmac('sha256', String(key)).update(String(value), 'utf8').digest()];
env.Utilities.base64EncodeWebSafe = s => Buffer.from(String(s), 'utf8').toString('base64url');
env.Utilities.base64DecodeWebSafe = s => [...Buffer.from(String(s), 'base64url')];
env.Utilities.getUuid = () => crypto.randomUUID();   // the harness's is 16 characters; a real one is 36
const props = {};
env.PropertiesService = { getScriptProperties: () => ({ getProperty: k => (k in props ? props[k] : null), setProperty: (k, v) => { props[k] = String(v); } }) };
env.ContentService = { MimeType: { JSON: 'json' },
  createTextOutput: s => ({ _s: s, setMimeType() { return this; }, getContent() { return this._s; } }) };

let fails = 0;
const ok = (what, cond, extra) => {
  console.log((cond ? '  ok   ' : '  FAIL ') + what + (extra && !cond ? '  — ' + extra : ''));
  if (!cond) fails++;
};
const post = body => JSON.parse(env.doPost({ postData: { contents: JSON.stringify(body) } }).getContent());
const cell = (sheet, row, col) => env.__sheets[sheet]._grid[row - 1][col - 1];
const setCell = (sheet, row, col, v) => { env.__sheets[sheet]._grid[row - 1][col - 1] = v; };

// ---- setup -------------------------------------------------------------------
env.academySetup();
ok('setup makes the three tabs with their headers in row 1',
   ['Users', 'Progress', 'Activity'].every(n => env.__sheets[n] && env.__sheets[n]._grid.length === 1) &&
   cell('Users', 1, 1) === 'Email' && cell('Users', 1, 8) === 'Hash' && cell('Users', 1, 12) === 'SEA Year' &&
   cell('Users', 1, 13) === 'School' && cell('Users', 1, 14) === 'Consent');
ok('setup generates a signing secret', (props.ACADEMY_SECRET || '').length > 40);
ok('the engine answers a GET', /running/.test(env.doGet().getContent()));

// The Academy adds rows by hand: e-mail, name, role, and for a parent the
// child's e-mail. Everything else stays blank.
const U = env.__sheets.Users;
U.appendRow(['Aisha@Example.com ', 'Aisha Ali', 'Student', '', '', '', '', '', '', '', '', 2029, '', '', '', '']);   // row 2 — S.E.A. in 2029
U.appendRow(['dad@example.com', 'Imran Ali', 'parent', 'aisha@example.com', '', '', '', '', '', '', '', '', '', '', '']); // row 3
U.appendRow(['miss@example.com', 'Ms Ramlal', 'teacher', '', '', '', '', '', '', '', '', '', '', '', '']);        // row 4
U.appendRow(['off@example.com', 'Switched Off', 'student', '', 'disabled', '', '', '', '', '', '', '', '', '', '']); // row 5
U.appendRow(['late@example.com', 'Season Over', 'student', '', '', '2020-01-01', '', '', '', '', '', '', '', '', '']); // row 6
U.appendRow(['blank@example.com', 'No Role', '', '', '', '', '', '', '', '', '', '', '', '', '']);                 // row 7

// ---- lookup ------------------------------------------------------------------
ok('an e-mail nobody added is unknown', post({ action: 'lookup', email: 'who@example.com' }).state === 'unknown');
ok('a fresh row is "new" — whatever the case and spacing of the e-mail typed',
   post({ action: 'lookup', email: '  AISHA@example.COM ' }).state === 'new');
ok('a disabled row says so', post({ action: 'lookup', email: 'off@example.com' }).state === 'disabled');
ok('a row whose Paid Until has passed is expired', post({ action: 'lookup', email: 'late@example.com' }).state === 'expired');
ok('a row with no role is flagged, not let through', post({ action: 'lookup', email: 'blank@example.com' }).state === 'norole');
ok('something that is not an e-mail is refused', post({ action: 'lookup', email: 'aisha' }).ok === false);

// ---- choosing a password ------------------------------------------------------
ok('signing in before a password exists is refused with the reason',
   /not chosen a password/.test(post({ action: 'signin', email: 'aisha@example.com', password: 'anything1' }).error));
ok('a short password is refused', post({ action: 'setpassword', email: 'aisha@example.com', password: 'short' }).ok === false);
const first = post({ action: 'setpassword', email: 'aisha@example.com', password: 'mango-tree-2027' });
ok('choosing a password signs the student straight in',
   first.ok && typeof first.token === 'string' && first.user.role === 'student' && first.user.name === 'Aisha Ali');
ok('the sign-in carries the year of the S.E.A., so the app can place the child', first.user.seaYear === 2029);
ok('a row with no S.E.A. year hands back null, not zero', post({ action: 'lookup', email: 'miss@example.com' }).ok &&
   env.auser_('miss@example.com').seaYear === null);
ok('the sheet now holds a salt and a 64-character hash, never the password',
   /^[0-9a-f]{64}$/.test(cell('Users', 2, 8)) && cell('Users', 2, 7).length > 20 &&
   !JSON.stringify(U._grid).includes('mango-tree-2027'));
ok('the row is marked active', cell('Users', 2, 5) === 'active');
ok('the same e-mail is now "active" on lookup', post({ action: 'lookup', email: 'aisha@example.com' }).state === 'active');
ok('a second attempt to set a password on that row is refused',
   /already has a password/.test(post({ action: 'setpassword', email: 'aisha@example.com', password: 'someone-else-1' }).error));
ok('a disabled row cannot choose a password', post({ action: 'setpassword', email: 'off@example.com', password: 'whatever-99' }).ok === false);
ok('an expired row cannot choose a password', post({ action: 'setpassword', email: 'late@example.com', password: 'whatever-99' }).ok === false);

// ---- signing in, and being locked out ------------------------------------------
let r;
for (let i = 1; i <= 5; i++) r = post({ action: 'signin', email: 'aisha@example.com', password: 'wrong-' + i });
ok('five wrong passwords are each refused', r.ok === false && /not right/.test(r.error));
r = post({ action: 'signin', email: 'aisha@example.com', password: 'mango-tree-2027' });
ok('the sixth try is locked out even with the RIGHT password', r.ok === false && /fifteen minutes/.test(r.error));
env.CacheService.getScriptCache().remove('fail:aisha@example.com');   // the fifteen minutes pass
const login = post({ action: 'signin', email: 'aisha@example.com', password: 'mango-tree-2027' });
ok('the right password signs in once the wait is over', login.ok && login.user.email === 'aisha@example.com');
ok('a fresh sign-in has no progress yet', login.progress === null && login.child === null);
ok('Last Sign-in is stamped', cell('Users', 2, 10) instanceof Date);

// ---- the token -----------------------------------------------------------------
const tok = login.token;
ok('a token resumes the session', post({ action: 'load', token: tok }).user.name === 'Aisha Ali');
const bent = tok.slice(0, -1) + (tok.slice(-1) === 'a' ? 'b' : 'a');
ok('a token with one character changed is refused', /Sign in again/.test(post({ action: 'load', token: bent }).error));
const sig = p => crypto.createHmac('sha256', props.ACADEMY_SECRET).update(p).digest('hex');
const forge = (email, role, exp) => Buffer.from(`${email}|${role}|${exp}`).toString('base64url') + '.' + sig(`${email}|${role}|${exp}`);
ok('an expired token is refused', /expired/.test(post({ action: 'load', token: forge('aisha@example.com', 'student', Date.now() - 1000) }).error));
ok('a token whose role no longer matches the sheet is refused',
   /role has changed/.test(post({ action: 'load', token: forge('aisha@example.com', 'teacher', Date.now() + 1e7) }).error));
ok('a token for an e-mail not on the sheet is refused', post({ action: 'load', token: forge('ghost@example.com', 'student', Date.now() + 1e7) }).ok === false);

// ---- progress ------------------------------------------------------------------
const P1 = { seen: { N01: { att: 1, right: true, clean: true } }, exams: [{ score: 51, max: 75 }], syl: {}, essay: '' };
ok('progress saves', post({ action: 'save', token: tok, progress: P1 }).ok);
ok('and comes back on load', post({ action: 'load', token: tok }).progress.exams[0].score === 51);
post({ action: 'save', token: tok, progress: Object.assign({}, P1, { exams: [{ score: 51 }, { score: 60 }] }) });
ok('a second save updates the same row rather than adding one',
   env.__sheets.Progress._grid.length === 2 && post({ action: 'load', token: tok }).progress.exams.length === 2);
ok('a save too big for a cell is refused with a reason',
   /Too much/.test(post({ action: 'save', token: tok, progress: { essay: 'x'.repeat(46000) } }).error));
ok('saving without a token is refused', post({ action: 'save', progress: P1 }).ok === false);

// ---- the parent ----------------------------------------------------------------
const dad = post({ action: 'setpassword', email: 'dad@example.com', password: 'doubles-and-chutney' });
ok('the parent chooses a password and is in', dad.ok && dad.user.role === 'parent');
ok('the parent is told which child is linked', dad.user.student && dad.user.student.email === 'aisha@example.com' && dad.user.student.name === 'Aisha Ali');
ok("the parent is handed the child's progress, by the child's name",
   dad.child && dad.child.name === 'Aisha Ali' && dad.child.progress.exams.length === 2);
ok("and the child's S.E.A. year, so the parent is placed where the child is", dad.child.seaYear === 2029);
ok('the parent has no progress of their own yet', dad.progress === null);
const miss = post({ action: 'setpassword', email: 'miss@example.com', password: 'chalk-and-talk-5' });
ok('a teacher is never handed a child', miss.ok && miss.user.role === 'teacher' && miss.child === null);

// ---- being switched off, and the season ending ------------------------------------
setCell('Users', 2, 5, 'disabled');
ok('a valid token stops working the moment the row is disabled',
   /switched off/.test(post({ action: 'load', token: tok }).error));
setCell('Users', 2, 5, 'active');
setCell('Users', 2, 6, new Date(Date.now() - 86400000 * 2));
ok('a valid token stops working when Paid Until has passed',
   /access has ended/.test(post({ action: 'load', token: tok }).error));
setCell('Users', 2, 6, new Date(Date.now() + 86400000 * 200));
const stillIn = post({ action: 'load', token: tok });
ok('and works again with a future Paid Until, which the page is told about',
   stillIn.ok && /^\d{4}-\d{2}-\d{2}$/.test(stillIn.user.paidUntil));
setCell('Users', 2, 6, 'not a date at all');
ok('an unreadable Paid Until locks nobody out', post({ action: 'load', token: tok }).ok);

// ---- the record --------------------------------------------------------------
const acts = env.__sheets.Activity._grid.slice(1).map(r => r[2]);
ok('sign-ins, refusals and password choices are all logged',
   acts.includes('sign-in') && acts.includes('sign-in-refused') && acts.includes('set-password'));
ok('the log never contains a password',
   !JSON.stringify(env.__sheets.Activity._grid).match(/mango-tree|doubles-and|chalk-and/));

// ---- a parent registers their own child --------------------------------------
const REG = { action: 'register', parentEmail: 'nalini@example.com', parentName: 'Nalini Baksh',
              childName: 'Rohan', seaYear: 2031, school: 'St Joseph Boys RC',
              password: 'pommerac-season' };
let reg = post(Object.assign({}, REG, { seaYear: 0 }));
ok('registration insists on a class for the child', reg.ok === false && /class/.test(reg.error));
reg = post(Object.assign({}, REG, { childName: '' }));
ok("registration insists on the child's first name", reg.ok === false && /first name/.test(reg.error));
reg = post(Object.assign({}, REG, { password: 'short' }));
ok('registration insists on a real password', reg.ok === false && /8 characters/.test(reg.error));
reg = post(Object.assign({}, REG, { parentEmail: 'aisha@example.com' }));
ok('an e-mail already on the list cannot be registered again', reg.ok === false && /already registered/.test(reg.error));

reg = post(REG);
ok('a parent registers and is signed in on the spot', reg.ok && reg.token && reg.user.role === 'parent' && reg.user.name === 'Nalini Baksh');
ok('the child is created with a first name, a class and a school, and no login of its own',
   reg.child && reg.child.name === 'Rohan' && reg.child.seaYear === 2031 &&
   reg.child.school === 'St Joseph Boys RC' && /^child:/.test(reg.child.email));
const rohanRow = env.__sheets.Users._grid.find(r => String(r[0]).startsWith('child:'));
ok('the child has no salt and no hash, so nobody can sign in as them', !rohanRow[6] && !rohanRow[7]);
ok('the child row records which parent registered it', rohanRow[15] === 'nalini@example.com');

// ---- the opt-in is off unless a parent turns it on ---------------------------
const nalRow = env.__sheets.Users._grid.find(r => r[0] === 'nalini@example.com');
ok('a registration that did not tick the box stores no consent', nalRow[13] === '' && nalRow[14] === '');
ok('and the session says so', reg.user.consent === false);
const opted = post(Object.assign({}, REG, { parentEmail: 'dev@example.com', parentName: 'Dev Persad',
  childName: 'Anya', seaYear: 2033, school: 'Chaguanas Government', consent: true, password: 'sorrel-and-ginger' }));
ok('a parent who ticks the box is recorded as consenting, with the date', opted.ok && opted.user.consent === true);
const devRow = env.__sheets.Users._grid.find(r => r[0] === 'dev@example.com');
ok('consent is written as a plain yes and a timestamp', devRow[13] === 'yes' && devRow[14] instanceof Date);

// ---- what registration refuses to keep ---------------------------------------
// The whole bargain: a practice app asks for what it needs to teach, and
// nothing it could sell. Anything else sent is dropped on the floor.
post(Object.assign({}, REG, { parentEmail: 'nosy@example.com', parentName: 'Nosy Parker',
  childName: 'Kiran', seaYear: 2030, password: 'never-mind-that',
  occupation: 'Engineer', employer: 'Petrotrin', income: '18000', dob: '2015-04-02',
  address: '12 Endeavour Road', childSurname: 'Parker', phone: '868-555-0101' }));
const sheetText = JSON.stringify(env.__sheets.Users._grid);
ok('an occupation, an employer, an income or an address sent at registration is never stored',
   !/Engineer|Petrotrin|18000|Endeavour|555-0101|2015-04-02/.test(sheetText));
ok('and the activity log never holds them either', !/Engineer|Petrotrin|Endeavour/.test(JSON.stringify(env.__sheets.Activity._grid)));

// ---- a parent saves their own child's practice, and nobody else's -------------
const nalToken = reg.token;
ok("a parent may save their own child's progress",
   post({ action: 'save', token: nalToken, for: reg.child.email, progress: { seen: { 'N01': { att: 1 } } } }).ok);
ok('and it lands on the child, not on the parent',
   post({ action: 'load', token: nalToken }).child.progress.seen.N01.att === 1 &&
   post({ action: 'load', token: nalToken }).progress === null);
ok("a parent may not save to another family's child",
   post({ action: 'save', token: nalToken, for: 'aisha@example.com', progress: { seen: {} } }).ok === false);

// ---- the dashboard ------------------------------------------------------------
ok('a parent is refused the dashboard', /for the Academy/.test(post({ action: 'dashboard', token: nalToken }).error));
ok('a teacher is refused the dashboard too', /for the Academy/.test(post({ action: 'dashboard', token: miss.token }).error));
U.appendRow(['boss@example.com', 'Ricky Rampersad', 'academy', '', '', '', '', '', '', '', '', '', '', '', '', '']);
const boss = post({ action: 'setpassword', email: 'boss@example.com', password: 'branch-and-shield' });
const dash = post({ action: 'dashboard', token: boss.token });
ok('the Academy gets the dashboard', dash.ok && dash.stats);
ok('it counts families, children and teachers',
   dash.stats.families === 4 && dash.stats.children === 5 && dash.stats.teachers === 1);
ok('a switched-off child is counted nowhere', dash.stats.children === env.__sheets.Users._grid.slice(1)
   .filter(r => String(r[2]).toLowerCase() === 'student' && String(r[4]).toLowerCase() !== 'disabled').length);
ok('it counts children by class', dash.stats.byClass['2031'] === 1 && dash.stats.byClass['2033'] === 1);
ok('it counts children by school, and how many gave one',
   dash.stats.bySchool['St Joseph Boys RC'] === 2 && dash.stats.bySchool['Chaguanas Government'] === 1 &&
   dash.stats.schoolsGiven === 3);
ok('a child whose parent gave no school is simply absent from the school counts',
   Object.values(dash.stats.bySchool).reduce((a, b) => a + b, 0) === dash.stats.schoolsGiven &&
   dash.stats.schoolsGiven < dash.stats.children);
ok('it counts practice rather than listing it, and papers sat',
   dash.stats.attempted === 2 && dash.stats.practising === 2 && dash.stats.papers === 2);
ok('it counts registrations by month, one entry per family',
   Object.values(dash.stats.byMonth).reduce((a, b) => a + b, 0) === dash.stats.families);
ok('the interest list holds only the parent who ticked the box',
   dash.stats.interestedCount === 1 && dash.stats.interested.length === 1 &&
   dash.stats.interested[0].email === 'dev@example.com' && dash.stats.interested[0].name === 'Dev Persad');
ok('a parent who did not tick is nowhere in it',
   !JSON.stringify(dash.stats.interested).includes('nalini@example.com'));
ok("no child's name appears anywhere in the dashboard",
   !/Rohan|Anya|Kiran|Aisha/.test(JSON.stringify(dash.stats)));

console.log();
console.log(fails ? `  ${fails} failed` : '  all good');
process.exit(fails ? 1 : 0);
