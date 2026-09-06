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
   cell('Users', 1, 1) === 'Email' && cell('Users', 1, 8) === 'Hash');
ok('setup generates a signing secret', (props.ACADEMY_SECRET || '').length > 40);
ok('the engine answers a GET', /running/.test(env.doGet().getContent()));

// The Academy adds rows by hand: e-mail, name, role, and for a parent the
// child's e-mail. Everything else stays blank.
const U = env.__sheets.Users;
U.appendRow(['Aisha@Example.com ', 'Aisha Ali', 'Student', '', '', '', '', '', '', '', '']);       // row 2
U.appendRow(['dad@example.com', 'Imran Ali', 'parent', 'aisha@example.com', '', '', '', '', '', '', '']); // row 3
U.appendRow(['miss@example.com', 'Ms Ramlal', 'teacher', '', '', '', '', '', '', '', '']);        // row 4
U.appendRow(['off@example.com', 'Switched Off', 'student', '', 'disabled', '', '', '', '', '', '']); // row 5
U.appendRow(['late@example.com', 'Season Over', 'student', '', '', '2020-01-01', '', '', '', '', '']); // row 6
U.appendRow(['blank@example.com', 'No Role', '', '', '', '', '', '', '', '', '']);                 // row 7

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

console.log();
console.log(fails ? `  ${fails} failed` : '  all good');
process.exit(fails ? 1 : 0);
