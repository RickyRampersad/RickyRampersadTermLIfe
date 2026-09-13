/**
 * ============================================================
 *  RRB ACADEMY — sign-in and progress backend
 *  Ricky Rampersad Branch · rickyrampersadbranch.com/sea/
 * ============================================================
 *
 *  Until this is deployed, /sea/ is gated by the three codes in the page.
 *  Once it is, the page signs people in by e-mail and password against
 *  the Users tab, and a child's progress follows them between devices —
 *  and their parent can see it from their own phone.
 *
 *  ── HOW A FAMILY GETS IN ────────────────────────────────────────────
 *  A parent registers their own child from the sign-in screen: their
 *  name and e-mail, the child's first name and class, and the school if
 *  they care to give it. That writes two rows — the parent and the
 *  child — and the parent chooses a password on the spot. Nobody e-mails
 *  a password to anybody, and no child registers themselves.
 *
 *  You can still add a row by hand; the first time that e-mail is typed
 *  into /sea/ it is asked to choose a password.
 *
 *  ── WHAT IS ASKED FOR, AND WHY ──────────────────────────────────────
 *  Only what the app itself needs to work:
 *      the child's FIRST NAME      to greet them and to label progress
 *      the child's CLASS           to serve the right questions, and to
 *                                  move them up every September
 *      the SCHOOL (optional)       so a teacher can find their class and
 *                                  the parent sees it on their own screen
 *      the parent's NAME, E-MAIL   to sign in, and to reach them
 *
 *  NOT asked for, and deliberately: the child's surname, date of birth,
 *  address, or photograph; the parent's occupation, employer, income or
 *  address. A free practice app has no business holding those, and an
 *  agency that collected them here would be collecting them under false
 *  pretences. The fact find is where that conversation belongs, after a
 *  parent has asked for it.
 *
 *  ── THE OPT-IN ──────────────────────────────────────────────────────
 *  Registration carries ONE unticked box: may the branch tell them about
 *  education savings plans. Ticking it writes "yes" and a timestamp to
 *  the Consent columns, and puts them on the Academy dashboard's
 *  interest list. Leaving it alone writes nothing and is the default.
 *  Nobody who left it alone may be contacted about insurance, ever —
 *  that is the whole bargain that makes the app free and trusted.
 *
 *  To reset a password: clear the Salt and Hash cells on their row.
 *  Next time they sign in they will be asked to choose a new one.
 *  To switch someone off: put "disabled" in Status.
 *  To sell a season: put a date in Paid Until. After that date they are
 *  refused with a message that says so and names the Academy.
 *
 *  ── DEPLOY (once, ~5 minutes) ───────────────────────────────────────
 *  1. Make a NEW Google Sheet for the Academy. Not the branch sheet —
 *     that one holds client data and this one holds children's names.
 *  2. Extensions → Apps Script → paste this file in as Academy.gs.
 *     This is its own project with its own doGet/doPost; do not put it
 *     in the same project as the branch engine.
 *  3. Run academySetup() once from the editor (authorise when asked).
 *     It creates the three tabs and generates the signing secret.
 *  4. Deploy → New deployment → Web app:
 *        Execute as: Me        Who has access: Anyone
 *     Copy the /exec URL.
 *  5. Paste it into  const ACADEMY_API = ""  near the top of the script
 *     in sea/index.html. Commit, push, merge to main.
 *  6. Add yourself to Users as a teacher and sign in.
 *
 *  ── TABS (academySetup creates them) ────────────────────────────────
 *  Users    : Email | Name | Role | Student Email | Status | Paid Until |
 *             Salt | Hash | Created | Last Sign-in | Note | SEA Year |
 *             School | Consent | Consent At | Registered By
 *             Role is student, parent, teacher or academy. A parent's
 *             Student Email links them to one child. Leave Salt and Hash
 *             blank. SEA Year is the year the child will sit the S.E.A.
 *             — one number that never needs updating: the app works out
 *             the class from it and moves the child up every September.
 *             A child registered by a parent has no password of its own
 *             and an id beginning "child:" — the parent practises with
 *             them from their own account. Give a child a real e-mail
 *             instead and they can sign in on their own.
 *  Progress : Email | Updated | JSON        ← one row per person
 *  Activity : At | Email | Did | Note
 *
 *  ── WHAT IS AND IS NOT PROTECTED ────────────────────────────────────
 *  Passwords are never stored: a random salt and 5 000 rounds of salted
 *  SHA-256 are, which is the strongest hash Apps Script can run inside a
 *  request. Sign-in is limited to five wrong tries per e-mail per fifteen
 *  minutes. A sign-in hands back a token signed with a secret that lives
 *  only in Script Properties; the token carries the e-mail and role, is
 *  good for 30 days, and is checked — signature, expiry, and whether the
 *  person is still on the list and still paid up — on every call.
 *
 *  The web app runs as you with access "Anyone", so the endpoints are
 *  public; the token is what makes a call somebody's. Nothing here can
 *  read the branch sheet.
 *
 *  A parent may read and write only their own record and their own
 *  child's. The dashboard is aggregate — counts by class, by school, by
 *  month — and is refused to everybody except the academy role. The one
 *  place names appear is the interest list, and only parents who ticked
 *  the box are on it.
 */

var ACADEMY = {
  USERS: 'Users', PROGRESS: 'Progress', ACTIVITY: 'Activity',
  ITER: 5000,             // hash rounds — about a second inside a request
  TOKEN_DAYS: 30,
  MAX_FAILS: 5, FAIL_WINDOW_S: 900,
  MIN_PASSWORD: 8,
  MAX_PROGRESS: 45000,    // a Sheets cell holds 50 000 characters
  ACTIVE_DAYS: 30,        // "active" on the dashboard means signed in this recently
  MAX_NAME: 60, MAX_SCHOOL: 120
};
var ACADEMY_ROLES = { student: 1, parent: 1, teacher: 1, academy: 1 };

/* ============================ setup ============================ */

function academySetup() {
  var ss = SpreadsheetApp.getActive();
  var want = {};
  want[ACADEMY.USERS]    = ['Email','Name','Role','Student Email','Status','Paid Until','Salt','Hash','Created','Last Sign-in','Note','SEA Year','School','Consent','Consent At','Registered By'];
  want[ACADEMY.PROGRESS] = ['Email','Updated','JSON'];
  want[ACADEMY.ACTIVITY] = ['At','Email','Did','Note'];
  Object.keys(want).forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (!sh) {
      sh = ss.insertSheet(name);
      var head = sh.getRange(1, 1, 1, want[name].length);
      head.setValues([want[name]]);
      head.setFontWeight('bold');
      sh.setFrozenRows(1);
    }
  });
  var p = PropertiesService.getScriptProperties();
  if (!p.getProperty('ACADEMY_SECRET')) p.setProperty('ACADEMY_SECRET', Utilities.getUuid() + Utilities.getUuid());
  if (!p.getProperty('ACADEMY_NAME'))   p.setProperty('ACADEMY_NAME', 'RRB Academy');
}

/* ============================ entry points ============================ */

function doGet() {
  return ContentService.createTextOutput('RRB Academy engine is running.');
}

function doPost(e) {
  try {
    var b = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    if (b.action === 'lookup')      return academyLookup_(b);
    if (b.action === 'setpassword') return academySetPassword_(b);
    if (b.action === 'signin')      return academySignin_(b);
    if (b.action === 'load')        return academyLoad_(b);
    if (b.action === 'save')        return academySave_(b);
    if (b.action === 'register')    return academyRegister_(b);
    if (b.action === 'dashboard')   return academyDashboard_(b);
    return aerr_('Unknown action.');
  } catch (err) { return aerr_(String(err && err.message || err)); }
}

/* ============================ lookup ============================ */

/* The first thing the page asks: is this e-mail on the list, and has it
   chosen a password yet? That does tell a caller whether an address is
   on the Academy's list — acceptable for an invitation-only sheet the
   Academy fills in by hand, and it is what lets a child sign up without
   anyone e-mailing them a password. */
function academyLookup_(b) {
  var email = anorm_(b.email);
  if (!aemail_(email)) return aerr_('That does not look like an e-mail address.');
  var u = auser_(email);
  var s = astate_(u);
  return aok_({ state: s, name: u ? u.name : '', role: u ? u.role : '' });
}

/* ============================ register ============================ */

/* A parent registers their own child. Two rows, one password, one
   unticked box. The child gets no login of its own unless the parent
   gives a real e-mail for it; otherwise the parent practises with them
   from their own account, which is what an Infant 1 needs anyway. */
function academyRegister_(b) {
  var pEmail = anorm_(b.parentEmail), pName = aclean_(b.parentName, ACADEMY.MAX_NAME);
  var cName  = aclean_(b.childName, ACADEMY.MAX_NAME);
  var cEmail = anorm_(b.childEmail);
  var school = aclean_(b.school, ACADEMY.MAX_SCHOOL);
  var seaYear = Number(b.seaYear) || 0;
  var pw = String(b.password || '');
  var consent = b.consent === true || String(b.consent).toLowerCase() === 'yes';

  if (!aemail_(pEmail))  return aerr_('That does not look like an e-mail address.');
  if (!pName)            return aerr_('Give the name the Academy should call you by.');
  if (!cName)            return aerr_("Give the child's first name.");
  if (!seaYear || seaYear < 2000 || seaYear > 2100) return aerr_('Choose the class the child is in.');
  if (pw.length < ACADEMY.MIN_PASSWORD) return aerr_('Choose a password of at least ' + ACADEMY.MIN_PASSWORD + ' characters.');
  if (cEmail && !aemail_(cEmail)) return aerr_("That does not look like the child's e-mail address.");

  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    if (auser_(pEmail)) return aerr_('That e-mail is already registered. Sign in instead, or ask the Academy for a reset.');
    if (cEmail && auser_(cEmail)) return aerr_("That child's e-mail is already registered.");

    var childId = cEmail || ('child:' + Utilities.getUuid().slice(0, 12));
    var now = new Date();
    var sh = asheet_(ACADEMY.USERS), col = acols_(sh);
    var width = sh.getLastColumn();

    // the child first, so the parent's row can point at a row that exists
    var child = new Array(width).fill('');
    child[col['email'] - 1] = childId;
    child[col['name'] - 1] = cName;
    child[col['role'] - 1] = 'student';
    child[col['status'] - 1] = 'active';
    child[col['sea year'] - 1] = seaYear;
    child[col['created'] - 1] = now;
    if (school) child[col['school'] - 1] = school;
    child[col['registered by'] - 1] = pEmail;
    sh.appendRow(child);

    var parent = new Array(width).fill('');
    parent[col['email'] - 1] = pEmail;
    parent[col['name'] - 1] = pName;
    parent[col['role'] - 1] = 'parent';
    parent[col['student email'] - 1] = childId;
    parent[col['status'] - 1] = 'active';
    parent[col['created'] - 1] = now;
    parent[col['last sign-in'] - 1] = now;
    if (school) parent[col['school'] - 1] = school;
    if (consent) { parent[col['consent'] - 1] = 'yes'; parent[col['consent at'] - 1] = now; }
    parent[col['salt'] - 1] = Utilities.getUuid();
    parent[col['hash'] - 1] = ahash_(pw, parent[col['salt'] - 1]);
    sh.appendRow(parent);

    alog_(pEmail, 'registered', 'child ' + childId + (consent ? ' · interested in savings plans' : ''));
    return aok_(asession_(auser_(pEmail)));
  } finally { lock.releaseLock(); }
}

/* ============================ set password ============================ */

function academySetPassword_(b) {
  var email = anorm_(b.email), pw = String(b.password || '');
  if (!aemail_(email)) return aerr_('That does not look like an e-mail address.');
  if (pw.length < ACADEMY.MIN_PASSWORD) return aerr_('Choose a password of at least ' + ACADEMY.MIN_PASSWORD + ' characters.');
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var u = auser_(email);
    var s = astate_(u);
    if (s !== 'new') return aerr_(astateMsg_(s, 'This account already has a password. Sign in with it, or ask the Academy to reset it.'));
    var salt = Utilities.getUuid();
    var hash = ahash_(pw, salt);
    var sh = asheet_(ACADEMY.USERS), col = acols_(sh);
    sh.getRange(u._row, col['salt']).setValue(salt);
    sh.getRange(u._row, col['hash']).setValue(hash);
    sh.getRange(u._row, col['status']).setValue('active');
    sh.getRange(u._row, col['created']).setValue(new Date());
    sh.getRange(u._row, col['last sign-in']).setValue(new Date());
    alog_(email, 'set-password', u.role);
    u = auser_(email);
    return aok_(asession_(u));
  } finally { lock.releaseLock(); }
}

/* ============================ sign in ============================ */

function academySignin_(b) {
  var email = anorm_(b.email), pw = String(b.password || '');
  if (!aemail_(email)) return aerr_('That does not look like an e-mail address.');
  var fails = afails_(email);
  if (fails >= ACADEMY.MAX_FAILS) return aerr_('Too many wrong tries. Wait fifteen minutes and try again.');
  var u = auser_(email);
  var s = astate_(u);
  if (s !== 'active') return aerr_(astateMsg_(s, ''));
  if (!asame_(ahash_(pw, u.salt), u.hash)) {
    afailed_(email, fails + 1);
    alog_(email, 'sign-in-refused', 'wrong password, try ' + (fails + 1));
    return aerr_('That password is not right.' + (fails + 1 >= ACADEMY.MAX_FAILS - 1 ? ' One more try before a fifteen-minute wait.' : ''));
  }
  aclear_(email);
  var sh = asheet_(ACADEMY.USERS), col = acols_(sh);
  sh.getRange(u._row, col['last sign-in']).setValue(new Date());
  alog_(email, 'sign-in', u.role);
  return aok_(asession_(u));
}

/* ============================ load / save ============================ */

function academyLoad_(b) {
  var u = awho_(b.token);
  return aok_(asession_(u));
}

function academySave_(b) {
  var u = awho_(b.token);
  /* A parent practising alongside a young child saves to the child's
     record, not their own. Nobody may write to anybody else's. */
  var target = u.email;
  if (b['for'] && anorm_(b['for']) !== u.email) {
    if (u.role !== 'parent' || anorm_(b['for']) !== u.student) return aerr_('That is not your record to save.');
    target = anorm_(b['for']);
  }
  var json = JSON.stringify(b.progress || {});
  if (json.length > ACADEMY.MAX_PROGRESS) return aerr_('Too much progress to save in one go — clear an old essay.');
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var sh = asheet_(ACADEMY.PROGRESS);
    var rows = arows_(sh), hit = null;
    for (var i = 0; i < rows.length; i++) if (anorm_(rows[i].email) === target) { hit = rows[i]; break; }
    var now = new Date();
    if (hit) sh.getRange(hit._row, 1, 1, 3).setValues([[target, now, json]]);
    else sh.appendRow([target, now, json]);
    return aok_({ updated: now.toISOString() });
  } finally { lock.releaseLock(); }
}

/* What every successful sign-in or resume hands back: who you are, your
   own progress, and — for a parent — the child's, with the child's name. */
function asession_(u) {
  var out = {
    token: atoken_(u),
    user: { email: u.email, name: u.name, role: u.role, seaYear: u.seaYear,
            school: u.school, consent: u.consent,
            student: null, paidUntil: u.paidUntil ? adate_(u.paidUntil) : '' },
    progress: aprogress_(u.email),
    child: null
  };
  if (u.role === 'parent' && u.student) {
    var c = auser_(u.student);
    out.user.student = { email: u.student, name: c ? c.name : '' };
    out.child = { name: c ? c.name : '', email: u.student, seaYear: c ? c.seaYear : null,
                  school: c ? c.school : '', progress: aprogress_(u.student) };
  }
  return out;
}

function aprogress_(email) {
  var rows = arows_(asheet_(ACADEMY.PROGRESS));
  for (var i = 0; i < rows.length; i++) {
    if (anorm_(rows[i].email) !== anorm_(email)) continue;
    try { return JSON.parse(String(rows[i].json || '{}')); } catch (e) { return {}; }
  }
  return null;
}

/* ============================ dashboard ============================ */

/* Counts, not children. Who is using it, in which class, at which school,
   and how much practice is happening — the numbers a sponsor is shown and
   the numbers that say whether this is working. The only names here are
   parents who ticked the box asking to hear about savings plans. */
function academyDashboard_(b) {
  var u = awho_(b.token);
  if (u.role !== 'academy') return aerr_('The dashboard is for the Academy.');

  var rows = arows_(asheet_(ACADEMY.USERS));
  var prog = {}, pr = arows_(asheet_(ACADEMY.PROGRESS));
  for (var i = 0; i < pr.length; i++) {
    try { prog[anorm_(pr[i].email)] = JSON.parse(String(pr[i].json || '{}')); } catch (e) {}
  }

  var now = Date.now(), activeCut = now - ACADEMY.ACTIVE_DAYS * 86400000;
  var out = {
    families: 0, children: 0, activeFamilies: 0, teachers: 0,
    byClass: {}, bySchool: {}, byMonth: {},
    attempted: 0, papers: 0, bestPaper: 0, practising: 0,
    interested: [], interestedCount: 0, schoolsGiven: 0
  };

  for (var j = 0; j < rows.length; j++) {
    var r = rows[j], role = String(r.role || '').trim().toLowerCase();
    if (anorm_(r.status) === 'disabled') continue;
    var created = r.created instanceof Date ? r.created : null;

    if (role === 'teacher') out.teachers++;

    if (role === 'parent') {
      out.families++;
      var seen = r['last sign-in'] instanceof Date ? r['last sign-in'].getTime() : 0;
      if (seen >= activeCut) out.activeFamilies++;
      if (created) {
        var key = created.getFullYear() + '-' + ('0' + (created.getMonth() + 1)).slice(-2);
        out.byMonth[key] = (out.byMonth[key] || 0) + 1;
      }
      if (anorm_(r.consent) === 'yes') {
        out.interestedCount++;
        out.interested.push({
          name: String(r.name || '').trim(), email: anorm_(r.email),
          school: String(r.school || '').trim(),
          seaYear: Number((auser_(anorm_(r['student email'])) || {}).seaYear) || null,
          at: r['consent at'] instanceof Date ? adate_(r['consent at']) : ''
        });
      }
    }

    if (role === 'student') {
      out.children++;
      var y = Number(r['sea year']) || 0;
      if (y) { var k = String(y); out.byClass[k] = (out.byClass[k] || 0) + 1; }
      var school = String(r.school || '').trim();
      if (school) { out.schoolsGiven++; out.bySchool[school] = (out.bySchool[school] || 0) + 1; }
      var p = prog[anorm_(r.email)];
      if (p) {
        var seenN = p.seen ? Object.keys(p.seen).length : 0;
        if (seenN) { out.attempted += seenN; out.practising++; }
        var ex = p.exams || [];
        out.papers += ex.length;
        for (var e = 0; e < ex.length; e++) if (Number(ex[e].score) > out.bestPaper) out.bestPaper = Number(ex[e].score);
      }
    }
  }
  out.interested.sort(function (a, c) { return String(c.at).localeCompare(String(a.at)); });
  return aok_({ stats: out, activeDays: ACADEMY.ACTIVE_DAYS });
}

/* ============================ users ============================ */

function auser_(email) {
  email = anorm_(email);
  var rows = arows_(asheet_(ACADEMY.USERS));
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (anorm_(r.email) !== email) continue;
    return {
      _row: r._row,
      email: email,
      name: String(r.name || '').trim(),
      role: String(r.role || '').trim().toLowerCase(),
      student: anorm_(r['student email']),
      status: String(r.status || '').trim().toLowerCase(),
      paidUntil: r['paid until'] || '',
      salt: String(r.salt || ''),
      hash: String(r.hash || ''),
      seaYear: Number(r['sea year']) || null,
      school: String(r.school || '').trim(),
      consent: anorm_(r.consent) === 'yes',
      lastSignin: r['last sign-in'] || ''
    };
  }
  return null;
}

/* unknown → disabled → no role → expired → new → active, in that order,
   so a family whose season has ended cannot set a fresh password. */
function astate_(u) {
  if (!u) return 'unknown';
  if (u.status === 'disabled') return 'disabled';
  if (!ACADEMY_ROLES[u.role]) return 'norole';
  if (u.paidUntil && aexpired_(u.paidUntil)) return 'expired';
  if (!u.hash) return 'new';
  return 'active';
}
function astateMsg_(s, activeMsg) {
  if (s === 'unknown')  return 'That e-mail is not on the Academy list. Ask the Academy to add you.';
  if (s === 'disabled') return 'This account has been switched off. Contact the Academy.';
  if (s === 'norole')   return 'This account has no role set. Ask the Academy to fix the Role column.';
  if (s === 'expired')  return 'Your access has ended. Contact the Academy to renew.';
  if (s === 'new')      return 'This account has not chosen a password yet. Go back and choose one.';
  return activeMsg || 'Sign in again.';
}

/* Paid Until may be a real date cell or typed text. Expired means the
   day has passed — access runs to the end of the date given. */
function aexpired_(v) {
  var d = v instanceof Date ? v : new Date(String(v));
  if (isNaN(d.getTime())) return false;   // unreadable → do not lock anyone out
  var end = new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59);
  return end.getTime() < Date.now();
}
function adate_(v) {
  var d = v instanceof Date ? v : new Date(String(v));
  return isNaN(d.getTime()) ? String(v) : Utilities.formatDate(d, 'America/Port_of_Spain', 'yyyy-MM-dd');
}

/* ============================ tokens ============================ */

function atoken_(u) {
  var exp = Date.now() + ACADEMY.TOKEN_DAYS * 86400000;
  var payload = u.email + '|' + u.role + '|' + exp;
  return Utilities.base64EncodeWebSafe(payload) + '.' + ahex_(ahmac_(payload));
}

/* Signature, expiry, then the person as they are on the sheet right now —
   a token does not outlive being disabled, deleted, or running out of paid time. */
function awho_(token) {
  var parts = String(token || '').split('.');
  if (parts.length !== 2) throw new Error('Sign in again.');
  var payload;
  try { payload = abytes2str_(Utilities.base64DecodeWebSafe(parts[0])); } catch (e) { throw new Error('Sign in again.'); }
  if (!asame_(ahex_(ahmac_(payload)), parts[1])) throw new Error('Sign in again.');
  var f = payload.split('|');
  if (f.length !== 3 || Number(f[2]) < Date.now()) throw new Error('Your sign-in has expired. Sign in again.');
  var u = auser_(f[0]);
  var s = astate_(u);
  if (s !== 'active') throw new Error(astateMsg_(s, 'Sign in again.'));
  if (u.role !== f[1]) throw new Error('Your role has changed. Sign in again.');
  return u;
}

function ahmac_(s) {
  var secret = aprop_('ACADEMY_SECRET');
  if (!secret) throw new Error('Run academySetup() once.');
  return Utilities.computeHmacSha256Signature(s, secret);
}

/* ============================ passwords ============================ */

function ahash_(pw, salt) {
  var h = ahex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + pw));
  for (var i = 0; i < ACADEMY.ITER; i++) {
    h = ahex_(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, h + salt));
  }
  return h;
}
/* Compare every character whatever happens, so timing gives nothing away. */
function asame_(a, b) {
  a = String(a); b = String(b);
  if (a.length !== b.length) return false;
  var d = 0;
  for (var i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}

/* Five wrong passwords in fifteen minutes and the address waits. */
function afails_(email) { return Number(CacheService.getScriptCache().get('fail:' + email) || 0); }
function afailed_(email, n) { CacheService.getScriptCache().put('fail:' + email, String(n), ACADEMY.FAIL_WINDOW_S); }
function aclear_(email) { CacheService.getScriptCache().remove('fail:' + email); }

/* ============================ plumbing ============================ */

function ass_() { return SpreadsheetApp.getActive(); }
function asheet_(name) {
  var sh = ass_().getSheetByName(name);
  if (!sh) throw new Error('Missing tab "' + name + '" — run academySetup() once.');
  return sh;
}
function aprop_(k) { return PropertiesService.getScriptProperties().getProperty(k) || ''; }
function ajson_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function aok_(o) { o = o || {}; o.ok = true; return ajson_(o); }
function aerr_(msg) { return ajson_({ ok: false, error: msg }); }

function anorm_(s) { return String(s || '').trim().toLowerCase(); }
/* One line of text from a form: trimmed, length-capped, no control characters. */
function aclean_(s, max) { return String(s == null ? '' : s).replace(/[\x00-\x1f]/g, ' ').trim().slice(0, max || 120); }
function aemail_(s) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s); }

/* Rows as objects keyed by lower-cased header, and the header positions. */
function arows_(sh) {
  var lr = sh.getLastRow(), lc = sh.getLastColumn();
  if (lr < 2 || lc < 1) return [];
  var v = sh.getRange(1, 1, lr, lc).getValues();
  var head = v[0].map(function (h) { return String(h).trim().toLowerCase(); });
  return v.slice(1).map(function (r, i) {
    var o = { _row: i + 2 };
    head.forEach(function (h, c) { o[h] = r[c]; });
    return o;
  }).filter(function (o) { return anorm_(o.email) !== ''; });
}
function acols_(sh) {
  var lc = sh.getLastColumn();
  var head = sh.getRange(1, 1, 1, lc).getValues()[0];
  var col = {};
  head.forEach(function (h, i) { col[String(h).trim().toLowerCase()] = i + 1; });
  ['salt','hash','status','created','last sign-in'].forEach(function (k) {
    if (!col[k]) throw new Error('Users tab has no "' + k + '" column — run academySetup() once.');
  });
  return col;
}

function alog_(email, did, note) {
  try { asheet_(ACADEMY.ACTIVITY).appendRow([new Date(), email, did, String(note || '')]); } catch (e) {}
}

function ahex_(bytes) {
  var s = '';
  for (var i = 0; i < bytes.length; i++) {
    var b = bytes[i] & 0xff;
    s += (b < 16 ? '0' : '') + b.toString(16);
  }
  return s;
}
function abytes2str_(bytes) {
  var s = '';
  for (var i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i] & 0xff);
  return s;
}
