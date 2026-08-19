/**
 * RR Branch — additions to the live "RR Branch FF System" script.
 *
 * Written against the real Code.gs, so it reuses what is already there
 * (ffLoadRoster_, ffLookupDirectManager_, MAIL_CONFIG, ffReadRow_, ffWriteRow_,
 * ffFindRowBySubmissionId_, _ffJson, _str) rather than duplicating it.
 *
 * WHAT THIS ADDS, AND WHY
 *
 *  1. action=login   — does not exist today. Its absence is why the dashboard
 *                      had a client-side fallback that accepted any password
 *                      for any roster email. That fallback is now removed, so
 *                      until this ships NOBODY CAN SIGN IN. This is the urgent
 *                      one.
 *  2. action=data    — dashboard rows, scoped server-side to the caller.
 *  3. action=roster  — staff list, scoped. Without it the "quiet agents" panel
 *                      cannot see an agent who has submitted nothing, which is
 *                      exactly who it exists to surface.
 *  4. Review tokens  — signed, single-use, role and identity inside the
 *                      signature, so ?role=manager can no longer be typed into
 *                      a URL to sign off your own case.
 *  5. Real reminders — replacing ReviewReminders_TEST.gs, which only ever sent
 *                      two samples to one inbox. The knowledge check tells
 *                      agents this runs. It does not.
 *
 * ── INSTALL ──────────────────────────────────────────────────────────────────
 *  1. Take a copy of the script project first (File ▸ Make a copy). This edits
 *     production routing for real client data.
 *  2. Add this file. It defines no doGet/doPost of its own — it cannot collide.
 *  3. Make the FOUR small edits to Code.gs listed at the foot of this file.
 *  4. Run  rrbSelfTest()          — reads only, sends nothing. Fix what it flags.
 *  5. Run  rrbInitSecret()        — once, generates the token signing key.
 *  6. Run  rrbSetAllPasswords()   — generates passwords and emails YOU the list.
 *  7. Run  rrbPreviewReminders()  — logs who would be chased. Sends nothing.
 *  8. Set RRB_DRY_RUN = false, run rrbInstallTriggers() once.
 *  9. Redeploy: Manage deployments ▸ Edit ▸ New version, SAME URL. A new URL
 *     breaks both pages, whose endpoint is deliberately locked.
 */

// ── settings ─────────────────────────────────────────────────────────────────

/**
 * true = log what would be sent, send nothing.
 *
 * This was left on after testing, and it is why clients reported never getting
 * their fact-find correspondence. Everything routed through rrbMail_ — the
 * client draft, the "client asked for changes" notice, the progress reminders,
 * the manager chase — was written to the log and thrown away. The manager
 * review and the approval emails go out through MailApp directly, so those
 * always worked, which is exactly what made this hard to spot: mail was
 * plainly arriving, just never the client's.
 *
 * Before turning this back on for a test, run rrbSuppressBacklog() when you
 * turn it off again, or every open case chases at once.
 */
var RRB_DRY_RUN = false;

/**
 * While testing, every message lands here instead of the real recipient.
 * Empty = send to the real recipient. Setting this also drops the CC, so a
 * non-empty value here silently changes who is copied as well as who receives.
 */
var RRB_REDIRECT_MAIL_TO = '';

var RRB_TOKEN_DAYS = 14;
var RRB_REMINDER_HOUR = 15;          // 3pm, as the knowledge check states
var RRB_ESCALATE_AFTER = 3;          // 3rd unanswered reminder -> Branch Manager
var RRB_TOKEN_TAB = 'Review Tokens';

/**
 * false — a legacy ?id= link with no token still loads (read-only), so links
 *         already in managers' inboxes keep working during rollout.
 * true  — a valid token is required. Flip once the queue has drained.
 */
var RRB_TOKENS_REQUIRED = false;

var RRB_PROP_SECRET = 'RRB_REVIEW_SECRET';
var RRB_PROP_PW     = 'RRB_PW_';       // + lowercased email


// ═════════════════════════════════════════════════════════════════════════════
//  1. LOGIN
// ═════════════════════════════════════════════════════════════════════════════

/**
 * GET ?action=login&email=…&pw=…
 * Returns the shape Index.html expects: {ok, name, role, code, unitKey, unit, scope}
 */
function rrbLogin(e) {
  var pw    = String((e && e.parameter && e.parameter.pw) || '');
  var email = _str(e && e.parameter && e.parameter.email).toLowerCase();
  var code  = _str(e && e.parameter && e.parameter.code).toUpperCase();

  // The sign-in page sends an agent code chosen from a dropdown; older links
  // may still send an email. Resolve either through the Access tab, which is
  // the branch's own record of who may sign in and whether they are still
  // active. A person removed from that tab stops being able to sign in without
  // anyone having to touch this script.
  if (code) {
    var row = null;
    try { row = rrbFindByCode_(code, ''); } catch (err) { row = null; }
    if (!row) return { ok: false, error: 'Incorrect name or password.' };
    email = row.email;
  }
  if (!email) return { ok: false, error: 'Incorrect name or password.' };

  // Rate limit per email. Sign-in failure and unknown user are deliberately
  // indistinguishable, so this endpoint cannot be used to enumerate staff.
  var cache = CacheService.getScriptCache();
  var key = 'rrb_pwtry_' + email;
  var LOCK_SECONDS = 3600;
  var tries = parseInt(cache.get(key) || '0', 10);
  if (tries >= 5) {
    // Sign-in is an agent number plus an access code, and the number is
    // printed on every fact find — so the code is the only secret. Where that
    // code is a digit or two, this limiter is the whole defence. Five tries an
    // hour turns a 34-value guessing space from under two hours into most of a
    // working day, and leaves a trail while it happens.
    Logger.log('rrbLogin: lockout on %s after %s failed attempts', email, tries);
    return { ok: false, error: 'Too many attempts. Try again in an hour.' };
  }

  // Identity comes from the roster where it exists, and from the Access tab
  // otherwise. The Access tab is the branch's record of who may sign in; a
  // person listed there and given a password must be able to use it. Requiring
  // them ALSO to appear in the older roster meant only the managers in
  // MAIL_CONFIG could get in, and everyone else was told their password was
  // wrong when the password was never the problem.
  var person = rrbFindPerson_(email);
  if (!person) {
    try {
      var acc = rrbFindByCode_(code, email);
      if (acc) {
        var role = acc.role || 'Agent';
        person = {
          name: acc.name, code: acc.code, unit: acc.unit, role: role,
          // Own unit from the NAME for a manager — the Unit column is their
          // parent, and reading it here would inherit the parent's visibility.
          unitKey: rrbOwnUnitKey_(acc.name, acc.unit, role),
          scope: rrbScopeForRole_(role, rrbOwnUnitKey_(acc.name, acc.unit, role), acc.code)
        };
      }
    } catch (err) {}
  }
  var ok = person && rrbCheckPassword_(email, pw);
  if (!ok) {
    cache.put(key, String(tries + 1), LOCK_SECONDS);
    return { ok: false, error: 'Incorrect name or password.' };
  }
  cache.remove(key);

  return {
    ok: true,
    // Proof this browser passed the password check. Every later call presents
    // this instead of an agent code, which is public.
    token:   rrbMintSession_(email, person),
    email:   email,          // the page signs in by code and has no other way
                             // to learn this; without it every later call
                             // arrives with a blank email and is refused.
    name:    person.name,
    role:    person.role,
    code:    person.code,
    unitKey: person.unitKey,
    unit:    person.unit,
    scope:   person.scope
  };
}


/** Access-tab Unit names are people; MAIL_CONFIG is keyed by first name. */
function rrbUnitKeyForName_(unitName) {
  var want = _str(unitName).toLowerCase().trim();
  if (!want) return '';
  for (var k in MAIL_CONFIG.managers) {
    var m = MAIL_CONFIG.managers[k];
    if (_str(m.name).toLowerCase().trim() === want) return k;
    if (want.indexOf(k.toLowerCase()) > -1) return k;
  }
  return '';
}

/**
 * Resolves an email to {name, code, role, unitKey, unit, scope}.
 * Managers come from MAIL_CONFIG; everyone else from the live roster.
 */
function rrbFindPerson_(email) {
  email = _str(email).toLowerCase();
  if (!email) return null;

  // Managers first — MAIL_CONFIG is the authority on who manages what.
  for (var k in MAIL_CONFIG.managers) {
    var m = MAIL_CONFIG.managers[k];
    if (_str(m.email).toLowerCase() === email) {
      // An Assistant Branch Manager is NOT branch-wide: they see their own
      // unit and the units beneath them. See RRB_UNIT_PARENT in RRBranchOS.gs.
      var theRole = k === 'ricky' ? 'Branch Manager'
                  : k === 'kerwyn' ? 'Assistant Branch Manager' : 'Unit Manager';
      return {
        name: m.name, code: rrbCodeForEmail_(email), unitKey: k, unit: m.name,
        role: theRole,
        scope: rrbScopeForRole_(theRole, k, rrbCodeForEmail_(email))
      };
    }
  }

  var roster = ffLoadRoster_();
  for (var code in roster) {
    if (_str(roster[code].email).toLowerCase() !== email) continue;
    var mgrKey = ffLookupDirectManager_(code);
    return {
      name: roster[code].name, code: code, unitKey: mgrKey,
      unit: (MAIL_CONFIG.managers[mgrKey] || {}).name || '',
      role: 'Agent',
      scope: { kind: 'agent', code: code }         // an agent sees only their own
    };
  }
  return null;
}

function rrbCodeForEmail_(email) {
  var roster = ffLoadRoster_();
  for (var c in roster) if (_str(roster[c].email).toLowerCase() === _str(email).toLowerCase()) return c;
  return '';
}

// ── passwords ────────────────────────────────────────────────────────────────
// Stored as a per-user salted SHA-256 in Script Properties. Plaintext is never
// written anywhere, including the sheet and the logs.

function rrbHashPassword_(salt, plain) {
  var raw = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, salt + '|' + plain,
                                    Utilities.Charset.UTF_8);
  return Utilities.base64Encode(raw);
}

function rrbCheckPassword_(email, plain) {
  var rec = PropertiesService.getScriptProperties().getProperty(RRB_PROP_PW + _str(email).toLowerCase());
  if (!rec) return false;
  var parts = rec.split(':');            // salt:hash
  if (parts.length !== 2) return false;
  var expected = parts[1];
  var actual = rrbHashPassword_(parts[0], plain);
  if (expected.length !== actual.length) return false;
  var diff = 0;
  for (var i = 0; i < expected.length; i++) diff |= (expected.charCodeAt(i) ^ actual.charCodeAt(i));
  return diff === 0;
}

/** Set one person's password. Run from the editor. */
function rrbSetPassword(email, plain) {
  if (!email || !plain) throw new Error('rrbSetPassword("email","password")');
  var salt = Utilities.getUuid();
  PropertiesService.getScriptProperties()
    .setProperty(RRB_PROP_PW + _str(email).toLowerCase(), salt + ':' + rrbHashPassword_(salt, plain));
  Logger.log('Password set for %s', email);
}

/**
 * Generates a password for every manager and rostered agent, stores the hashes,
 * and emails YOU the list to distribute. Existing passwords are left alone, so
 * this is safe to re-run when someone joins.
 */
function rrbSetAllPasswords() {
  var props = PropertiesService.getScriptProperties();
  var people = [], made = 0;

  for (var k in MAIL_CONFIG.managers) people.push(MAIL_CONFIG.managers[k]);
  var roster = ffLoadRoster_();
  for (var c in roster) if (roster[c].email) people.push({ name: roster[c].name, email: roster[c].email });

  var rows = [];
  people.forEach(function (p) {
    var email = _str(p.email).toLowerCase();
    if (!email) return;
    if (props.getProperty(RRB_PROP_PW + email)) { rows.push([p.name, email, '(unchanged)']); return; }
    var pw = rrbMakePassword_();
    rrbSetPassword(email, pw);
    rows.push([p.name, email, pw]);
    made++;
  });

  var html = '<p>Passwords for the Fact Find Insights dashboard. Send each person their own line, ' +
             'then delete this email.</p><table style="border-collapse:collapse;font:13px sans-serif">' +
             rows.map(function (r) {
               return '<tr><td style="padding:3px 14px 3px 0">' + r[0] + '</td>' +
                      '<td style="padding:3px 14px 3px 0;color:#64748b">' + r[1] + '</td>' +
                      '<td style="padding:3px 0"><code>' + r[2] + '</code></td></tr>';
             }).join('') + '</table>';

  MailApp.sendEmail({ to: RRB_REDIRECT_MAIL_TO, name: 'RR Branch Fact Find',
                      subject: 'Dashboard passwords (' + made + ' new)', htmlBody: html });
  Logger.log('%s new password(s); list emailed to %s', made, RRB_REDIRECT_MAIL_TO);
}

function rrbMakePassword_() {
  var words = ['harbour','savannah','cocoa','maracas','tobago','flambeau','poui','samaan',
               'chaconia','arima','caroni','manzanilla','bamboo','calypso'];
  var a = words[Math.floor(Math.random() * words.length)];
  var b = words[Math.floor(Math.random() * words.length)];
  return a + '-' + b + '-' + (100 + Math.floor(Math.random() * 900));
}


// ═════════════════════════════════════════════════════════════════════════════
//  2. DASHBOARD DATA  (action=data)
// ═════════════════════════════════════════════════════════════════════════════

/**
 * Rows for Index.html, SCOPED SERVER-SIDE. The page re-filters as a second line
 * of defence, but this is the control: an agent must not receive another
 * agent's rows at all.
 */
function rrbData(e) {
  // Authorises on a signed session token, not on a published agent code.
  // See RRBranchOS.gs PART 5.
  return rrbDataSecure_(e);
}

/** action=roster — scoped staff list, name/code/role/unit only. */
function rrbRoster(e) {
  return rrbRosterSecure_(e);
}


// ═════════════════════════════════════════════════════════════════════════════
//  3. SIGNED SINGLE-USE REVIEW LINKS
// ═════════════════════════════════════════════════════════════════════════════

function rrbInitSecret() {
  var props = PropertiesService.getScriptProperties();
  if (props.getProperty(RRB_PROP_SECRET)) {
    Logger.log('Secret already set. Rotating it invalidates every outstanding review link.');
    return;
  }
  var bytes = [];
  for (var i = 0; i < 32; i++) bytes.push(Math.floor(Math.random() * 256));
  props.setProperty(RRB_PROP_SECRET, Utilities.base64EncodeWebSafe(bytes));
  Logger.log('Signing secret generated.');
}

function rrbSecret_() {
  var props = PropertiesService.getScriptProperties();
  var s = props.getProperty(RRB_PROP_SECRET);
  if (s) return s;

  // Nothing here should depend on somebody having remembered to run a setup
  // function. When this threw, a wrong password returned a tidy "incorrect
  // password" and a RIGHT one threw — so sign-in was dead for everyone while
  // every cheap test of the endpoint looked healthy. Create it on first use.
  var lock = LockService.getScriptLock();
  try { lock.waitLock(10000); } catch (e) {}
  try {
    s = props.getProperty(RRB_PROP_SECRET);          // re-read inside the lock
    if (!s) {
      var bytes = [];
      for (var i = 0; i < 32; i++) bytes.push(Math.floor(Math.random() * 256));
      s = Utilities.base64EncodeWebSafe(bytes);
      props.setProperty(RRB_PROP_SECRET, s);
      Logger.log('rrbSecret_: no signing secret existed — generated one.');
    }
  } finally {
    try { lock.releaseLock(); } catch (e) {}
  }
  return s;
}

function rrbSign_(body) {
  return Utilities.base64EncodeWebSafe(
    Utilities.computeHmacSha256Signature(body, rrbSecret_())).replace(/=+$/, '');
}

/** @param role 'manager' | 'branch_manager' | 'view' */
function rrbMintToken(submissionId, role, person) {
  var payload = {
    id: String(submissionId), role: String(role),
    em: _str(person && person.email).toLowerCase(), nm: _str(person && person.name),
    exp: Date.now() + RRB_TOKEN_DAYS * 86400000, jti: Utilities.getUuid()
  };
  var body = Utilities.base64EncodeWebSafe(JSON.stringify(payload)).replace(/=+$/, '');
  rrbTokenSheet_().appendRow([payload.jti, payload.id, payload.role, payload.em, payload.nm,
                              new Date(), new Date(payload.exp), '', '']);
  return body + '.' + rrbSign_(body);
}

function rrbVerifyToken(token) {
  if (!token) return { ok: false, error: 'This review link is missing its security token.' };
  var parts = String(token).split('.');
  if (parts.length !== 2) return { ok: false, error: 'This review link is malformed.' };

  var expected = rrbSign_(parts[0]);
  if (parts[1].length !== expected.length) return { ok: false, error: 'This review link is not valid.' };
  var diff = 0;
  for (var i = 0; i < expected.length; i++) diff |= (parts[1].charCodeAt(i) ^ expected.charCodeAt(i));
  if (diff !== 0) return { ok: false, error: 'This review link has been altered and is not valid.' };

  var payload;
  try {
    payload = JSON.parse(Utilities.newBlob(Utilities.base64DecodeWebSafe(parts[0])).getDataAsString());
  } catch (err) { return { ok: false, error: 'This review link is unreadable.' }; }

  if (!payload.exp || Date.now() > payload.exp)
    return { ok: false, error: 'This review link has expired. Ask for a fresh one.' };

  var rec = rrbFindToken_(payload.jti);
  if (!rec) return { ok: false, error: 'This review link is not on record.' };
  if (rec.revokedAt) return { ok: false, error: 'This review link has been revoked.' };
  if (rec.usedAt) return { ok: false, error: 'This case has already been reviewed and signed. ' +
                                             'The link cannot be used again.' };
  return { ok: true, payload: payload, row: rec.row };
}

function rrbConsumeToken(token) {
  var v = rrbVerifyToken(token);
  if (!v.ok) return v;
  rrbTokenSheet_().getRange(v.row, 8).setValue(new Date());
  return { ok: true };
}

function rrbTokenSheet_() {
  var ss = SpreadsheetApp.openById(FF_SHEET_ID);
  var sh = ss.getSheetByName(RRB_TOKEN_TAB);
  if (!sh) {
    sh = ss.insertSheet(RRB_TOKEN_TAB);
    sh.appendRow(['JTI','Submission ID','Role','Reviewer Email','Reviewer Name',
                  'Issued At','Expires At','Used At','Revoked At']);
    sh.setFrozenRows(1);
    sh.hideSheet();
  }
  return sh;
}

function rrbFindToken_(jti) {
  var vals = rrbTokenSheet_().getDataRange().getValues();
  for (var i = 1; i < vals.length; i++) {
    if (String(vals[i][0]) === String(jti))
      return { row: i + 1, usedAt: vals[i][7], revokedAt: vals[i][8] };
  }
  return null;
}

/** Signed replacement for ffReviewLink_. Emits NO role= — role is in the signature. */
function rrbReviewLink(submissionId, role, person) {
  return APP_URL + '?id=' + encodeURIComponent(submissionId) +
         '&t=' + encodeURIComponent(rrbMintToken(submissionId, role, person));
}

/** Secure ff_load. Returns the row plus the role this link is allowed to act in. */
function rrbLoadById(params) {
  var id = _str(params && params.id);
  var t  = _str(params && params.t);
  if (!id) return { ok: false, error: 'Missing id parameter' };

  var role = 'view', reviewer = null;
  if (t) {
    var v = rrbVerifyToken(t);
    if (!v.ok) return { ok: false, error: v.error };
    if (String(v.payload.id) !== id)
      return { ok: false, error: 'This link does not belong to that submission.' };
    role = v.payload.role;
    reviewer = { email: v.payload.em, name: v.payload.nm };
  } else if (RRB_TOKENS_REQUIRED) {
    return { ok: false, error: 'This link is missing its security token. Review links now ' +
                               'expire and are single-use — ask for a fresh one.' };
  }

  var base = ffLoadById(params);              // reuse the existing reader
  if (!base.ok) return base;

  // Already signed off: read-only, never a second overwriting review.
  if (_str(base.data.status).toLowerCase().indexOf('approved') > -1 && role !== 'view') role = 'view';

  base.role = role;
  base.reviewerName  = reviewer ? reviewer.name  : '';
  base.reviewerEmail = reviewer ? reviewer.email : '';
  return base;
}

/** Call at the top of ffProcessManagerReview. Refuse the write if !ok. */
function rrbAuthoriseReview(data) {
  if (!data.reviewToken) {
    return RRB_TOKENS_REQUIRED ? { ok: false, error: 'Missing review token.' }
                               : { ok: true, legacy: true };
  }
  var v = rrbVerifyToken(data.reviewToken);
  if (!v.ok) return v;
  if (String(v.payload.id) !== String(data.submissionId))
    return { ok: false, error: 'Token does not match this submission.' };

  var agent = _str(data.agentEmail || data.advisorEmail).toLowerCase();
  if (agent && v.payload.em && agent === v.payload.em)
    return { ok: false, error: 'A case cannot be reviewed by the agent who submitted it.' };

  return { ok: true, reviewer: { email: v.payload.em, name: v.payload.nm },
           token: data.reviewToken };
}


// ═════════════════════════════════════════════════════════════════════════════
//  4. REAL REMINDERS + ESCALATION
//     Replaces ReviewReminders_TEST.gs, which sent two samples to one inbox and
//     had no trigger, no sheet reading and no state. The knowledge check tells
//     agents this runs; until now it did not.
// ═════════════════════════════════════════════════════════════════════════════

function rrbSendReviewReminders() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30000)) { Logger.log('Another run holds the lock; skipping.'); return; }
  try {
    var sheet = ffGetOrCreateRevisedTab_();
    var headers = ffEnsureHeaders_(sheet);
    var last = sheet.getLastRow();
    var today = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'yyyy-MM-dd');
    var chased = 0, escalated = 0, skipped = 0;

    for (var r = 2; r <= last; r++) {
      var d = ffReadRow_(sheet, headers, r);
      if (!d || !d.submissionId) continue;

      var status = _str(d.status).toLowerCase();
      var settled = status.indexOf('approved') > -1 || status.indexOf('declin') > -1 ||
                    status.indexOf('cancel') > -1;
      if (settled) {
        if (_int(d.remindersSent) > 0) rrbWriteCell_(sheet, headers, r, 'remindersSent', 0);
        continue;
      }

      // One chase per case per day, even if this runs twice.
      var lastAt = d.lastReminderAt ? Utilities.formatDate(new Date(d.lastReminderAt),
                     Session.getScriptTimeZone(), 'yyyy-MM-dd') : '';
      if (lastAt === today) { skipped++; continue; }

      var n = _int(d.remindersSent) + 1;
      var age = d.submittedAt ? Math.floor((Date.now() - new Date(d.submittedAt).getTime()) / 86400000) : 0;
      var mgrKey = d.directManagerKey || d.reviewerKey || ffLookupDirectManager_(d.agentCode);
      var mgr = MAIL_CONFIG.managers[mgrKey] || MAIL_CONFIG.managers.ricky;

      var ctx = { client: _str(d.clientName) || '(client)', advisor: _str(d.advisorName) || '(advisor)',
                  ref: d.submissionId, age: age, n: n, mgr: mgr.name };

      if (n >= RRB_ESCALATE_AFTER) {
        rrbMail_(MAIL_CONFIG.branchManager,
          'ESCALATION — unsigned after ' + RRB_ESCALATE_AFTER + ' reminders: ' + ctx.client,
          rrbEscalationHtml_(ctx, d),
          [d.agentEmail, mgr.email, MAIL_CONFIG.support].filter(String).join(','));
        escalated++;
      } else {
        rrbMail_(mgr.email,
          'Reminder ' + n + ' of ' + RRB_ESCALATE_AFTER + ' — awaiting your sign-off: ' + ctx.client,
          rrbReminderHtml_(ctx, d),
          [d.agentEmail, MAIL_CONFIG.support].filter(String).join(','));
        chased++;
      }

      rrbWriteCell_(sheet, headers, r, 'remindersSent', n);
      rrbWriteCell_(sheet, headers, r, 'lastReminderAt', new Date().toISOString());
    }
    Logger.log('Reminders: %s chased, %s escalated, %s already done today.%s',
               chased, escalated, skipped, RRB_DRY_RUN ? '  [DRY RUN — nothing sent]' : '');
  } finally { lock.releaseLock(); }
}

function rrbWriteCell_(sheet, headers, row, field, value) {
  var i = headers.indexOf(field);
  if (i < 0) return;                       // column absent — see rrbSelfTest()
  sheet.getRange(row, i + 1).setValue(value);
}

function rrbMail_(to, subject, html, cc) {
  if (RRB_DRY_RUN) { Logger.log('[DRY RUN] to=%s cc=%s subj=%s', to, cc || '', subject); return; }
  MailApp.sendEmail({ to: RRB_REDIRECT_MAIL_TO || to, cc: RRB_REDIRECT_MAIL_TO ? undefined : cc,
                      subject: subject, htmlBody: html, name: 'RR Branch Fact Find' });
}

function rrbShell_(title, accent, inner) {
  return '<div style="font:14px/1.6 Arial,Helvetica,sans-serif;color:#1E293B;max-width:620px">' +
    '<div style="background:' + accent + ';color:#fff;padding:13px 16px;border-radius:10px 10px 0 0;font-weight:700">' +
    title + '</div><div style="border:1px solid #E2E8F0;border-top:none;border-radius:0 0 10px 10px;padding:16px">' +
    inner + '<p style="color:#94a3b8;font-size:11px;margin-top:16px">Automated · RR Branch Fact Find. ' +
    'Replying will not clear the case — sign it off in the fact find.</p></div></div>';
}

function rrbFacts_(rows) {
  return '<table style="border-collapse:collapse;font-size:13px;margin:8px 0">' + rows.map(function (r) {
    return '<tr><td style="padding:3px 12px 3px 0;color:#64748b">' + r[0] +
           '</td><td style="padding:3px 0;font-weight:600">' + r[1] + '</td></tr>';
  }).join('') + '</table>';
}

function rrbReminderHtml_(c, d) {
  var mgrKey = d.directManagerKey || d.reviewerKey || ffLookupDirectManager_(d.agentCode);
  var mgr = MAIL_CONFIG.managers[mgrKey] || MAIL_CONFIG.managers.ricky;
  var link = rrbReviewLink(d.submissionId, 'manager', mgr);
  return rrbShell_('Fact Find awaiting your sign-off', '#0D9488',
    '<p>Hi ' + String(c.mgr).split(' ')[0] + ',</p>' +
    '<p>Reminder <strong>' + c.n + ' of ' + RRB_ESCALATE_AFTER + '</strong> — this case is waiting on you.</p>' +
    rrbFacts_([['Client', c.client], ['Advisor', c.advisor], ['Waiting', c.age + ' day(s)'], ['Reference', c.ref]]) +
    '<p style="margin-top:10px"><a href="' + link + '" style="background:#0D9488;color:#fff;padding:11px 20px;' +
    'border-radius:8px;text-decoration:none;font-weight:700">Review &amp; sign this Fact Find &rarr;</a></p>' +
    '<p style="font-size:12.5px;color:#475569">This link is personal to you, expires in ' + RRB_TOKEN_DAYS +
    ' days and stops working once signed. After ' + RRB_ESCALATE_AFTER +
    ' reminders it escalates to the Branch Manager.</p>');
}

function rrbEscalationHtml_(c, d) {
  var link = rrbReviewLink(d.submissionId, 'branch_manager', MAIL_CONFIG.managers.ricky);
  return rrbShell_('Escalation — no manager response', '#B45309',
    '<p>Hi Ricky,</p><p>Not signed off by <strong>' + c.mgr + '</strong> after ' +
    RRB_ESCALATE_AFTER + ' daily reminders.</p>' +
    rrbFacts_([['Client', c.client], ['Advisor', c.advisor], ['Direct Manager', c.mgr],
               ['Waiting', c.age + ' day(s)'], ['Reference', c.ref]]) +
    '<p style="font-size:12.5px;color:#475569">This opens your Branch Manager Override view — support the ' +
    'Direct Manager’s pending decision or override it, with your own signature.</p>' +
    '<p style="margin-top:12px"><a href="' + link + '" style="background:#B45309;color:#fff;padding:11px 20px;' +
    'border-radius:8px;text-decoration:none;font-weight:700">Open &amp; action this Fact Find &rarr;</a></p>' +
    '<p style="font-size:12px;color:#94a3b8">The agent cannot reach the client wet-signature stage until this is signed.</p>');
}

function rrbInstallTriggers() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'rrbSendReviewReminders') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('rrbSendReviewReminders').timeBased()
           .atHour(RRB_REMINDER_HOUR).everyDays(1).create();
  Logger.log('Reminder trigger installed for %s:00. RRB_DRY_RUN=%s', RRB_REMINDER_HOUR, RRB_DRY_RUN);
}

/** Logs who would be chased or escalated today. Sends nothing, writes nothing. */
function rrbPreviewReminders() {
  var sheet = ffGetOrCreateRevisedTab_();
  var headers = ffEnsureHeaders_(sheet);
  var out = [];
  for (var r = 2; r <= sheet.getLastRow(); r++) {
    var d = ffReadRow_(sheet, headers, r);
    if (!d || !d.submissionId) continue;
    var st = _str(d.status).toLowerCase();
    if (st.indexOf('approved') > -1 || st.indexOf('declin') > -1) continue;
    var n = _int(d.remindersSent) + 1;
    var age = d.submittedAt ? Math.floor((Date.now() - new Date(d.submittedAt).getTime()) / 86400000) : 0;
    var mgrKey = d.directManagerKey || d.reviewerKey || ffLookupDirectManager_(d.agentCode);
    out.push(_str(d.clientName) + ' | ' + _str(d.advisorName) + ' | ' + age + 'd | ' +
             (n >= RRB_ESCALATE_AFTER ? 'ESCALATE to Ricky' :
              'remind ' + ((MAIL_CONFIG.managers[mgrKey] || {}).name || '?') + ' (' + n + ')'));
  }
  Logger.log('Would act on %s case(s):\n%s', out.length, out.join('\n'));
  return out;
}


// ═════════════════════════════════════════════════════════════════════════════
//  5. SELF-TEST — reads only, sends nothing, writes nothing
// ═════════════════════════════════════════════════════════════════════════════

function rrbSelfTest() {
  var notes = [], problems = [];

  var sheet = ffGetOrCreateRevisedTab_();
  var headers = ffEnsureHeaders_(sheet);
  notes.push('ffRevised rows: ' + Math.max(0, sheet.getLastRow() - 1));

  ['remindersSent', 'lastReminderAt'].forEach(function (c) {
    if (headers.indexOf(c) < 0)
      problems.push('Missing column "' + c + '" in ffRevised — the reminder count lives ' +
                    'there, so without it a re-run would chase the same case twice.');
  });

  var roster = ffLoadRoster_();
  notes.push('Roster entries: ' + Object.keys(roster).length);
  if (!Object.keys(roster).length) problems.push('Roster empty — login and routing cannot resolve anyone.');

  var withPw = 0, props = PropertiesService.getScriptProperties();
  for (var c in roster) if (roster[c].email && props.getProperty(RRB_PROP_PW + _str(roster[c].email).toLowerCase())) withPw++;
  notes.push('Agents with a dashboard password set: ' + withPw + ' of ' + Object.keys(roster).length);
  if (!withPw) problems.push('No passwords set — nobody can sign into the dashboard. Run rrbSetAllPasswords().');

  notes.push('Token signing secret: ' + (props.getProperty(RRB_PROP_SECRET) ? 'set' : 'NOT SET — run rrbInitSecret()'));
  notes.push('RRB_TOKENS_REQUIRED = ' + RRB_TOKENS_REQUIRED + (RRB_TOKENS_REQUIRED ? '' : '  (legacy ?id= links still load)'));
  notes.push('RRB_DRY_RUN = ' + RRB_DRY_RUN);
  notes.push('Mail redirect: ' + (RRB_REDIRECT_MAIL_TO || 'none — real recipients'));
  notes.push('Gmail quota remaining today: ' + MailApp.getRemainingDailyQuota());

  var awaiting = 0;
  for (var r = 2; r <= sheet.getLastRow(); r++) {
    var d = ffReadRow_(sheet, headers, r);
    if (d && d.submissionId && _str(d.status).toLowerCase().indexOf('approved') < 0) awaiting++;
  }
  notes.push('Cases currently awaiting review: ' + awaiting);

  Logger.log('===== NOTES =====\n' + notes.join('\n'));
  Logger.log('===== PROBLEMS (' + problems.length + ') =====\n' + (problems.join('\n') || 'none'));
  return { notes: notes, problems: problems };
}


/**
 * ═════════════════════════════════════════════════════════════════════════════
 *  THE FOUR EDITS TO Code.gs
 * ═════════════════════════════════════════════════════════════════════════════
 *
 * ── 1. doGet — add three actions. Put these with the other else-ifs (~line 105):
 *
 *      else if (action === "login")        out = rrbLogin(e);
 *      else if (action === "data")         out = rrbData(e);
 *      else if (action === "roster")       out = rrbRoster(e);
 *      else if (action === "access_names") out = rrbAccessNames(e);
 *
 *    and CHANGE the existing ff_load line to the secure loader:
 *
 *      else if (action === "ff_load") out = rrbLoadById(e.parameter);
 *
 *    Do NOT let "login" or "data" into `cacheableActions` — a cached login
 *    response would serve one person's session to the next caller.
 *    "access_names" IS safe to cache: it is the same public list of names for
 *    everyone, and it must answer before anyone has signed in.
 *
 * ── 2. ffProcessManagerReview — authorise before writing. After the
 *    `if (!data.submissionId)` guard at the top, insert:
 *
 *      var auth = rrbAuthoriseReview(data);
 *      if (!auth.ok) return _ffJson({ ok:false, error: auth.error });
 *
 *    and just before `return _ffJson({ ok:true, stage:"manager_review", …})`:
 *
 *      if (auth.token) rrbConsumeToken(auth.token);
 *      if (auth.reviewer && auth.reviewer.name) {
 *        update.mgrName = auth.reviewer.name;      // the TOKEN's identity,
 *        update.mgrEmail = auth.reviewer.email;    // not what the form typed
 *      }
 *
 *    (set those before ffWriteRow_ so they persist).
 *
 * ── 3. ffReviewLink_ — sign it. Replace the body with:
 *
 *      function ffReviewLink_(submissionId, role) {
 *        var r = role || "branch_manager";
 *        var key = (r === "branch_manager") ? "ricky" : null;
 *        var person = key ? MAIL_CONFIG.managers[key] : null;
 *        return rrbReviewLink(submissionId, r, person || {});
 *      }
 *
 *    Better still, pass the real reviewer where the caller knows it — see how
 *    rrbReminderHtml_ does it.
 *
 * ── 4. ffProcessManagerReview response — tell the page the agent was emailed,
 *    so the manager's confirmation screen stops warning about a mail that did
 *    send. ffSendApprovalEmail_ already emails d.agentEmail; capture it:
 *
 *      var agentSent = false;
 *      try { ffSendApprovalEmail_(merged); agentSent = true; }
 *      catch (err) { Logger.log("Approval email failed: " + err); }
 *
 *    then add to the returned object:  agentReviewSent: agentSent,
 *                                      clientReviewSent: agentSent
 *
 * ── AND: delete ReviewReminders_TEST.gs once rrbPreviewReminders() looks right.
 *    Leaving it invites someone to run sendTestReminderEmails() and think the
 *    automation is live.
 */


// ═════════════════════════════════════════════════════════════════════════════
//  6. THE ACCESS SHEET — who may sign in
// ═════════════════════════════════════════════════════════════════════════════
//
// The branch keeps its people in one tab, "Access", with the columns:
//
//     Email | Name | Agent Number | Password | Role | Unit | Active
//
// That tab is the authority on who exists. It is NOT the authority on
// passwords: what is stored and compared is a salted SHA-256 held in Script
// Properties, so the sheet never has to be trusted at sign-in time and a person
// who can read the sheet still cannot read anyone's password back out of the
// system. rrbSyncAccessPasswords() below is what moves column D into that form.

var RRB_ACCESS_SHEET_ID = '1iytBbnETQFRmkveDSxadjsAfN07aMTW9E2slcA5qaWI';
var RRB_ACCESS_TAB      = 'Access';

/** Reads the Access tab. Returns [{email, name, code, pw, role, unit, active}]. */
function rrbAccessSheet_() {
  var sh = SpreadsheetApp.openById(RRB_ACCESS_SHEET_ID).getSheetByName(RRB_ACCESS_TAB);
  if (!sh) throw new Error('No "' + RRB_ACCESS_TAB + '" tab in the access sheet.');
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return [];

  // Resolve columns by header rather than position, so inserting a column in
  // the sheet does not silently start reading the wrong field.
  var head = values[0].map(function (h) { return _str(h).toLowerCase().trim(); });
  var col = function (name) { return head.indexOf(name); };
  var iEmail = col('email'), iName = col('name'), iCode = col('agent number'),
      iPw = col('password'), iRole = col('role'), iUnit = col('unit'), iAct = col('active');
  if (iEmail < 0 || iName < 0) throw new Error('Access tab needs at least Email and Name columns.');

  // No Active column means the filter cannot run and everybody appears in the
  // sign-in dropdown. Failing open is right — failing closed would lock the
  // branch out — but it must not do so silently, because from outside it looks
  // exactly like every row being marked Yes. Run rrbAccessAudit() for detail.
  if (iAct < 0) {
    Logger.log('rrbAccessSheet_: no column headed "Active" — every row is being ' +
               'treated as active, so the sign-in dropdown shows everyone. ' +
               'Add or rename that column, then run rrbAccessAudit().');
  }

  var out = [];
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var email = _str(row[iEmail]).toLowerCase().trim();
    if (!email) continue;
    // "Name" reads "A10024 - Neil Ramnanan"; show the person, not the code.
    var name = _str(row[iName]).replace(/^\s*[A-Z]\d+\s*-\s*/, '').trim();
    out.push({
      email:  email,
      name:   name || _str(row[iName]).trim(),
      code:   iCode >= 0 ? _str(row[iCode]).trim().toUpperCase() : '',
      pw:     iPw   >= 0 ? String(row[iPw]) : '',
      role:   iRole >= 0 ? _str(row[iRole]).trim() : 'Agent',
      unit:   iUnit >= 0 ? _str(row[iUnit]).trim() : '',
      active: iAct  <  0 || /^active$|^yes$|^true$/i.test(_str(row[iAct]).trim())
    });
  }
  return out;
}

/**
 * Names for the sign-in dropdown. Unauthenticated by necessity — it is what
 * populates the list before anyone has signed in.
 *
 * Returns names and agent codes ONLY. No email addresses, no roles, no units:
 * the branch's staff emails were removed from the published page once already
 * and must not come back through this door. A name on a dropdown is not a
 * credential; an address book is.
 */
function rrbAccessNames(e) {
  var people = rrbAccessSheet_()
    .filter(function (p) { return p.active; })
    .map(function (p) { return { code: p.code, name: p.name }; })
    .sort(function (a, b) { return a.name.localeCompare(b.name); });
  return { ok: true, people: people };
}

/** Access-sheet lookup by agent code, falling back to email. */
function rrbFindByCode_(code, email) {
  var want = _str(code).trim().toUpperCase();
  var mail = _str(email).toLowerCase().trim();
  var rows = rrbAccessSheet_();
  for (var i = 0; i < rows.length; i++) {
    if (!rows[i].active) continue;
    if (want && rows[i].code === want) return rows[i];
    if (mail && rows[i].email === mail) return rows[i];
  }
  return null;
}

/**
 * Copies column D into hashed storage, once, for everyone on the Access tab.
 *
 * Run it after editing passwords in the sheet. It reports any password it
 * considers guessable rather than quietly accepting it — a two-character or
 * all-digit password on an account that is listed by name on the sign-in page
 * is not a password, and the log says so plainly.
 */
function rrbSyncAccessPasswords() {
  var props = PropertiesService.getScriptProperties();
  var set = 0, skipped = 0, weak = [];

  rrbAccessSheet_().forEach(function (p) {
    if (!p.active || !p.email) return;
    var plain = String(p.pw == null ? '' : p.pw).trim();
    if (!plain) { skipped++; return; }
    if (plain.length < 8 || /^\d+$/.test(plain)) weak.push(p.name + ' (' + p.code + ')');
    var salt = Utilities.getUuid().replace(/-/g, '').slice(0, 16);
    props.setProperty(RRB_PROP_PW + p.email, salt + ':' + rrbHashPassword_(salt, plain));
    set++;
  });

  Logger.log('Access sync: %s password(s) stored, %s row(s) had no password.', set, skipped);
  if (weak.length) {
    Logger.log('');
    Logger.log('WEAK — these are all digits or under 8 characters:');
    weak.forEach(function (n) { Logger.log('   ' + n); });
    Logger.log('');
    Logger.log('The sign-in page lists every name, so the name is not a secret.');
    Logger.log('With a one-digit password the account has no protection at all.');
    Logger.log('Either put real passwords in column D and run this again, or run');
    Logger.log('rrbSetAllPasswords() to generate them and email you the list.');
  }
  return { set: set, skipped: skipped, weak: weak.length };
}


// ═════════════════════════════════════════════════════════════════════════════
//  7. THE MANAGER'S REVIEW EMAIL
// ═════════════════════════════════════════════════════════════════════════════
//
// The old one was a monospace dump: a label, a colon, a number, and a bare URL
// pointing at a Netlify site that no longer exists. A manager opening it on a
// phone had no way to tell whether the case needed ten seconds or ten minutes.
//
// This one is built around the decision the manager actually has to make:
//
//   who and what        client, advisor, when it landed, when it is due back
//   what is proposed    the recommendation and the shortfall it answers
//   can they afford it  income, expenses, surplus - the affordability basis
//   what to look at     only the measures that are outside tolerance, in words
//   one button          opens the fact find with the case already loaded
//
// Measures that are fine are summarised in a single line rather than listed.
// A manager does not need to read seven green rows to find the one red one.

/** The live site. Set here so the link is right even if Code.gs's APP_URL is stale. */
var RRB_APP_URL = 'https://factfinds.netlify.app/ffproject';

/** Everything outbound is copied here. */
var RRB_ALWAYS_CC = 'ricky.rampersad@myguardiangroup.com';

var RRB_MEASURES = [
  { k:'fi_dti',                label:'Debt to income',       why:'Debt is high against what the household earns. Protecting the debt should lead the recommendation.' },
  { k:'fi_dta',                label:'Debt to assets',       why:'Debt is large against what the family owns, so the liability would pass to them.' },
  { k:'fi_coverageGap',        label:'Coverage gap',         why:'Most of the assessed need is uncovered.' },
  { k:'fi_protectionMultiple', label:'Protection multiple',  why:'Cover in force is low as a multiple of income.' },
  { k:'fi_emergencyMonths',    label:'Emergency fund',       why:'Little or nothing set aside, so the first setback puts the premium at risk.' },
  { k:'fi_retReadiness',       label:'Retirement readiness', why:'Nothing meaningful is provided for retirement yet.' },
  { k:'fi_surplusRatio',       label:'Surplus ratio',        why:'Share of income left after expenses.' },
  { k:'fi_insSpend',           label:'Spend on insurance',   why:'Share of income already committed to premiums.' }
];

function rrbPct_(v) {
  var n = Number(v);
  if (!isFinite(n)) return _str(v);
  return (n <= 1 ? Math.round(n * 100) : Math.round(n)) + '%';
}

function rrbShow_(key, raw) {
  var v = _str(raw);
  if (!v) return '';
  // dti and protectionMultiple already arrive as "8.3x"; the ratios as decimals.
  if (v.indexOf('x') > -1 || v.indexOf('mo') > -1 || v.indexOf('%') > -1) return v;
  if (key === 'fi_coverageGap' || key === 'fi_dta' || key === 'fi_surplusRatio' ||
      key === 'fi_insSpend' || key === 'fi_retReadiness') return rrbPct_(v);
  return v;
}

function rrbMoney_(v) {
  var n = Number(String(v == null ? '' : v).replace(/[^0-9.\-]/g, ''));
  if (!isFinite(n) || !n) return '';
  return 'TT$' + Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function rrbWhen_(v) {
  if (!v) return '';
  try {
    return Utilities.formatDate(new Date(v), Session.getScriptTimeZone(), 'd MMMM, h:mm a');
  } catch (err) { return _str(v); }
}

/** Next business day - the branch's stated turnaround. */
function rrbDueDate_(from) {
  var d = from ? new Date(from) : new Date();
  if (isNaN(d.getTime())) d = new Date();
  do { d.setDate(d.getDate() + 1); } while (d.getDay() === 0 || d.getDay() === 6);
  return Utilities.formatDate(d, Session.getScriptTimeZone(), 'EEEE d MMMM');
}

// ── the manager's decision, in four dials ───────────────────────────────────
//
// Eight ratios in a list is a report. A manager reading it on a phone between
// two other things needs to know one thing: is this case sound, and if not,
// where. So the email leads with the four measures that actually change a
// sign-off decision, each as a figure with a bar behind it, and everything
// else is either folded into a sentence or left off.
//
// The four are chosen because each maps to a different way a case goes wrong:
//
//   Cover vs need      the recommendation does not answer the analysis
//   Affordability      the premium will not survive the year
//   Debt protection    the family inherits the liability
//   Retirement         nothing is being built for later
//
// Bars are nested tables with percentage widths. Every mail client renders
// those. Rounded corners degrade to square in old Outlook, which is fine.

function rrbBar_(pct, colour) {
  var p = Math.max(0, Math.min(100, Math.round(pct)));
  return '<table role="presentation" cellpadding="0" cellspacing="0" border="0" width="100%" ' +
         'style="border-collapse:collapse;margin-top:6px"><tr>' +
         '<td width="' + p + '%" style="height:6px;background:' + colour + ';border-radius:3px 0 0 3px;font-size:0;line-height:0">&nbsp;</td>' +
         '<td width="' + (100 - p) + '%" style="height:6px;background:#E2E8F0;border-radius:0 3px 3px 0;font-size:0;line-height:0">&nbsp;</td>' +
         '</tr></table>';
}

function rrbDial_(label, value, pct, band, note) {
  var c = band === 'bad' ? '#DC2626' : band === 'warn' ? '#B45309' : '#0D9488';
  return '<td width="50%" valign="top" style="padding:0 6px 12px 0">' +
    '<div style="border:1px solid #E2E8F0;border-radius:10px;padding:11px 13px;background:#fff">' +
      '<div style="font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;color:#94A3B8;font-weight:700">' + label + '</div>' +
      '<div style="font-size:22px;font-weight:800;color:' + c + ';line-height:1.15;margin-top:2px">' + value + '</div>' +
      rrbBar_(pct, c) +
      (note ? '<div style="font-size:11.5px;color:#64748b;margin-top:6px;line-height:1.45">' + note + '</div>' : '') +
    '</div></td>';
}

function rrbNum_(v) {
  var n = Number(String(v == null ? '' : v).replace(/[^0-9.\-]/g, ''));
  return isFinite(n) ? n : 0;
}

// ═════════════════════════════════════════════════════════════════════════════
//  8. SHARED LETTERHEAD
// ═════════════════════════════════════════════════════════════════════════════
// The shield is a hosted PNG rather than inline SVG: Gmail strips SVG entirely
// and blocks data: URIs on images, so a file on the site is the only mark that
// renders everywhere. It sits beside the site so it deploys with it.

var RRB_SHIELD_URL   = 'https://factfinds.netlify.app/shield.png';
var RRB_GUARDIAN_URL = 'https://factfinds.netlify.app/guardian-logo.png';

/**
 * The letterhead.
 *
 * It is the sign-in card's lockup, because that is the identity the branch
 * already has and it should not change between the screen someone signs into
 * and the message that lands in their inbox: the shield, "Fact Find Insights",
 * and the RR Branch line. The Guardian Group mark sits on the right, where a
 * letterhead puts the company.
 *
 * The wordmark is live text rather than part of an image, so it stays sharp on
 * every screen and still reads if a mail client blocks images. Both marks are
 * hosted PNGs: Gmail strips inline SVG and blocks data: URIs on images.
 */
function rrbHead_(title, sub, accent) {
  return '<div style="font:15px/1.6 -apple-system,BlinkMacSystemFont,Segoe UI,Arial,sans-serif;' +
         'color:#0F172A;max-width:640px;margin:0 auto;border:1px solid #E2E8F0;' +
         'border-radius:14px;overflow:hidden;background:#fff">' +

    // white letterhead: the BRANCH lockup only — this is branch material,
    // so the branch's shield carries it; no company mark.
    '<table role="presentation" width="100%" style="border-collapse:collapse;background:#fff">' +
      '<tr>' +
        '<td valign="middle" style="padding:18px 0 16px 22px" width="46">' +
          '<img src="' + RRB_SHIELD_URL + '" width="38" height="48" alt="" style="display:block;border:0">' +
        '</td>' +
        '<td valign="middle" style="padding:18px 22px 16px 12px">' +
          '<div style="font-family:Georgia,\'Times New Roman\',serif;font-size:19px;font-weight:700;' +
            'color:#0F172A;line-height:1.1;letter-spacing:-.01em">Fact Find Insights</div>' +
          '<div style="font-size:9.5px;letter-spacing:.15em;text-transform:uppercase;color:#64748B;' +
            'font-weight:700;margin-top:3px">Ricky Rampersad Branch</div>' +
        '</td>' +
      '</tr></table>' +

    // teal rule, then the navy subject band
    '<div style="height:3px;background:#0D9488;font-size:0;line-height:0">&nbsp;</div>' +
    '<table role="presentation" width="100%" style="border-collapse:collapse;background:#0E1F4D">' +
      '<tr><td style="padding:17px 22px;color:#fff">' +
        '<div style="font-size:19px;font-weight:800;line-height:1.28">' + title + '</div>' +
        (sub ? '<div style="font-size:13.5px;opacity:.85;margin-top:5px">' + sub + '</div>' : '') +
      '</td></tr></table>' +

    '<div style="padding:20px 22px;background:' + (accent || '#F8FAFC') + '">';
}

function rrbFoot_(ref) {
  return '<p style="color:#94a3b8;font-size:11.5px;margin-top:20px;line-height:1.55;border-top:1px solid #E2E8F0;padding-top:12px">' +
    (ref ? 'Reference ' + ref + '. ' : '') +
    'Ricky Rampersad Branch \u00b7 Guardian Life of the Caribbean Limited. This message contains confidential information ' +
    'intended only for the named recipient.</p></div></div>';
}

/** The advisor's recommendation, with cover, premium and the reason given. */
function rrbRecTable_(d, forClient) {
  var rows = '', totalCover = 0, totalPrem = 0, n = 0;
  for (var i = 1; i <= 6; i++) {
    var plan = _str(d['rec' + i + 'Rec']);
    if (!plan) continue;
    n++;
    var amt = rrbNum_(d['rec' + i + 'Amt']), pr = rrbNum_(d['rec' + i + 'Prem']);
    var why = _str(d['rec' + i + 'Reason']);
    totalCover += amt; totalPrem += pr;
    rows += '<tr><td style="padding:11px 13px;border:1px solid #E2E8F0;background:#fff">' +
      '<div style="font-weight:700;color:#0F766E;font-size:14px">' + plan + '</div>' +
      '<div style="font-size:12.5px;color:#64748b;margin-top:3px">' + _str(d['rec' + i + 'Need']) + '</div>' +
      '<table style="border-collapse:collapse;margin-top:7px"><tr>' +
        '<td style="padding-right:22px"><div style="font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;color:#94A3B8;font-weight:700">Cover</div>' +
        '<div style="font-size:15px;font-weight:800;color:#0F172A">' + (amt ? rrbMoney_(amt) : 'not set') + '</div></td>' +
        '<td><div style="font-size:10.5px;text-transform:uppercase;letter-spacing:.05em;color:#94A3B8;font-weight:700">Premium</div>' +
        '<div style="font-size:15px;font-weight:800;color:#0F172A">' + (pr ? rrbMoney_(pr) + '/mo' : 'not set') + '</div></td>' +
      '</tr></table>' +
      (why ? '<div style="font-size:12.5px;color:#475569;margin-top:8px;padding-top:8px;border-top:1px dashed #E2E8F0;line-height:1.55">' +
             '<strong style="color:#0F766E">Why:</strong> ' + why + '</div>'
           : (forClient ? '' : '<div style="font-size:12.5px;color:#B45309;margin-top:8px">No reason recorded for this recommendation.</div>')) +
      '</td></tr>';
  }
  if (!n) return { html: '', cover: 0, prem: 0, count: 0 };
  return {
    html: '<table style="border-collapse:collapse;width:100%;margin-bottom:6px">' + rows + '</table>' +
          (n > 1 ? '<div style="font-size:13px;color:#334155;margin:8px 0 16px">Total &mdash; <strong>' +
                   rrbMoney_(totalCover) + '</strong> of cover' + (totalPrem ? ' for <strong>' + rrbMoney_(totalPrem) + ' a month</strong>' : '') + '</div>'
                 : '<div style="height:12px"></div>'),
    cover: totalCover, prem: totalPrem, count: n
  };
}

// ── the gap the analysis does not size ──────────────────────────────────────
//
// A fact find sizes what happens if the client DIES. For a working-age earner
// the larger exposure is usually that they cannot work: the income stops, the
// costs carry on, and unlike death there is no lump sum and no end date.
//
// This block only appears when the case argues for it on its own figures - an
// earned income, no income protection among the recommendations - and it makes
// the argument out of the client's own numbers rather than a claim. The
// sharpest of those numbers is usually the mortgage: mortgage protection pays
// on death, not on disability, so a disabled borrower keeps the debt and loses
// the means to service it.
function rrbIncomeProtectionBlock_(d) {
  var income = rrbNum_(d.monthlyIncomeTotal || d.monthlyIncome);
  if (income <= 0) return '';

  // Already covered? Then there is nothing to raise.
  var hasIP = false;
  for (var i = 1; i <= 6; i++) {
    var p = _str(d['rec' + i + 'Rec']) + ' ' + _str(d['rec' + i + 'Need']);
    if (/praesidia|disability|income protection|provisor|personal accident/i.test(p)) hasIP = true;
  }
  if (hasIP) return '';

  var expenses = rrbNum_(d.monthlyExpenses);
  var liquid   = rrbNum_(d.cashBankVal) + rrbNum_(d.mutualFundVal) + rrbNum_(d.investmentsVal);
  var runway   = expenses > 0 ? (liquid / expenses) : 0;
  var mortMo   = rrbNum_(d.mortgageMo);
  var mortBal  = rrbNum_(d.mortgageBal);
  var mortIns  = /^y/i.test(_str(d.mortgageIns));
  var married  = /married/i.test(_str(d.maritalStatus));
  var spouseWorks = _str(d.spouseEmpStatus) !== '' &&
                    !/not employed|unemployed|homemaker|not working/i.test(_str(d.spouseEmpStatus));
  var sole = married && !spouseWorks;

  // Praesidia replaces 75% of earnings. Illustrative - the quote is the
  // authority, and occupational class moves the premium.
  var benefit = Math.round(income * 0.75);
  var covers  = expenses > 0 && benefit >= expenses;

  var age = 0;
  try {
    var dob = new Date(d.dob);
    if (!isNaN(dob.getTime())) age = Math.floor((Date.now() - dob.getTime()) / 31557600000);
  } catch (err) {}
  var eligible = age >= 18 && age <= 60;

  var line = function (a, b) {
    return '<tr><td style="padding:3px 14px 3px 0;font-size:12.5px;color:#7C2D12;opacity:.8;white-space:nowrap">' + a +
           '</td><td style="padding:3px 0;font-size:13px;font-weight:700;color:#9A3412">' + b + '</td></tr>';
  };

  // Deliberately short. It is one point, and the point is the mortgage line.
  var h = '<div style="background:#FFF7ED;border-left:4px solid #EA580C;border-radius:0 10px 10px 0;padding:13px 16px;margin-bottom:14px">';
  h += '<div style="font-size:14.5px;font-weight:800;color:#9A3412;line-height:1.3">Nothing protects the income itself</div>';
  h += '<div style="font-size:13px;color:#7C2D12;line-height:1.55;margin-top:5px">' +
       (sole ? 'One salary carries this household. ' : '') +
       'The cover answers death. Nothing answers being unable to work.</div>';

  h += '<table style="border-collapse:collapse;margin-top:8px">';
  if (expenses > 0) h += line('Savings would last', runway < 0.1 ? 'no time at all' : runway.toFixed(1) + ' months');
  if (mortMo > 0 && mortIns) h += line('Mortgage protection', 'pays on death, not disability &mdash; ' + rrbMoney_(mortMo) + '/mo keeps falling due');
  else if (mortMo > 0) h += line('Mortgage still due', rrbMoney_(mortMo) + ' a month');
  if (eligible) h += line('Praesidia would replace', rrbMoney_(benefit) + '/mo' + (expenses > 0 ? ' against ' + rrbMoney_(expenses) + ' of expenses' : ''));
  h += '</table>';

  h += '<div style="font-size:12px;color:#9A3412;opacity:.8;margin-top:8px;line-height:1.5">' +
       (eligible ? 'Illustrative at 75% of earnings. ' : 'Outside the 18&ndash;60 issue window. ') +
       'If it was discussed and declined, the reason belongs on the file.</div>';
  h += '</div>';
  return h;
}

function rrbManagerReviewHtml_(d, link) {
  // Specific Need Only overrides everything below. There is no disclosed
  // financial position, so the needs-analysis blocks would render zeroes and
  // read as failings by the advisor. See rrbAdviceReviewHtml_.
  if (rrbIsAdviceOnly_(d)) return rrbAdviceReviewHtml_(d, link);

  var mgrFirst = _str(d.reviewerName).split(' ')[0] || 'there';
  var client   = _str(d.clientName) || _str(d.fullName) || '(client)';
  var advisor  = _str(d.advisorName) || '(advisor)';
  var advFirst = advisor.split(' ')[0];

  var need    = rrbNum_(d.insuranceNeed_calc);
  var totNeed = rrbNum_(d.totalNeed_calc);
  var cover   = rrbNum_(d.totalCoverage_calc);
  var income  = rrbNum_(d.monthlyIncomeTotal || d.monthlyIncome);
  var expense = rrbNum_(d.monthlyExpenses);
  var surplus = rrbNum_(d.cashSurplus_calc);
  var debts   = rrbNum_(d.totalDebts_calc);

  // What is being recommended, and for how much.
  var recs = [], recTotal = 0, premTotal = 0;
  for (var i = 1; i <= 6; i++) {
    var plan = _str(d['rec' + i + 'Rec']);
    if (!plan) continue;
    var amt = rrbNum_(d['rec' + i + 'Amt']), pr = rrbNum_(d['rec' + i + 'Prem']);
    recTotal += amt; premTotal += pr;
    recs.push({ need: _str(d['rec' + i + 'Need']), plan: plan, amt: amt, prem: pr });
  }

  var row = function (a, b) {
    return '<tr><td style="padding:5px 16px 5px 0;color:#64748b;font-size:13px;white-space:nowrap">' + a +
           '</td><td style="padding:5px 0;font-size:13px;font-weight:600;color:#0F172A">' + b + '</td></tr>';
  };

  var chk = rrbChecks_(d);

  var h = rrbHead_(client + ' &mdash; ready for your sign-off',
                   'From ' + advisor + ' &middot; due back by ' + rrbDueDate_(d.submittedAt));
  h += '<p style="margin:0 0 16px">Hi ' + mgrFirst + ',</p>';

  // Decide first, read second. Everything below this line is the reasoning
  // behind the two buttons, not a prerequisite for pressing one.
  h += rrbDecisionBlock_(d, { name: d.reviewerName, email: d.reviewerEmail });
  h += '<div style="height:1px;background:#E2E8F0;margin:20px 0 16px"></div>';
  h += rrbBioBlock_(chk);
  h += rrbConcernsBlock_(chk);

  // ── 1. THE HEADLINE QUESTION: does the recommendation answer the analysis?
  var recPct = need > 0 ? Math.round((recTotal / need) * 100) : 0;
  var recBand = recTotal <= 0 ? 'bad' : (recPct < 80 ? 'warn' : recPct > 125 ? 'warn' : 'good');
  h += '<div style="background:#fff;border:1px solid #E2E8F0;border-radius:11px;padding:14px 16px;margin-bottom:14px">' +
       '<div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#94A3B8;font-weight:700;margin-bottom:9px">The recommendation against the analysis</div>' +
       '<table role="presentation" width="100%" style="border-collapse:collapse"><tr>' +
       '<td width="33%" style="font-size:12px;color:#64748b">Assessed shortfall<div style="font-size:17px;font-weight:800;color:#0F172A;margin-top:2px">' + (rrbMoney_(need) || '&mdash;') + '</div></td>' +
       '<td width="33%" style="font-size:12px;color:#64748b">Being recommended<div style="font-size:17px;font-weight:800;color:' + (recBand === 'good' ? '#0F766E' : '#B45309') + ';margin-top:2px">' + (rrbMoney_(recTotal) || 'not sized') + '</div></td>' +
       '<td width="33%" style="font-size:12px;color:#64748b">Already in force<div style="font-size:17px;font-weight:800;color:#0F172A;margin-top:2px">' + (rrbMoney_(cover) || 'none') + '</div></td>' +
       '</tr></table>';
  if (recTotal <= 0) {
    h += '<div style="font-size:12.5px;color:#991B1B;margin-top:9px">No sums assured have been entered against the recommended plans, so the cover cannot be checked against the need. Worth asking ' + advFirst + ' before signing.</div>';
  } else if (recPct < 80) {
    h += '<div style="font-size:12.5px;color:#B45309;margin-top:9px">The recommendation covers <strong>' + recPct + '%</strong> of the assessed shortfall. If that is deliberate &mdash; budget, or a staged plan &mdash; it should be written on the file.</div>';
  } else if (recPct > 125) {
    h += '<div style="font-size:12.5px;color:#B45309;margin-top:9px">The recommendation is <strong>' + recPct + '%</strong> of the assessed shortfall. Worth confirming what justifies the extra.</div>';
  } else {
    h += '<div style="font-size:12.5px;color:#0F766E;margin-top:9px">The recommendation is <strong>' + recPct + '%</strong> of the assessed shortfall &mdash; in line with the analysis.</div>';
  }
  h += '</div>';

  // ── 2. WHO DEPENDS ON THIS INCOME — the thing a manager should guide on
  var married = /married/i.test(_str(d.maritalStatus));
  var spouseWorks = !/not employed|unemployed|homemaker|not working/i.test(_str(d.spouseEmpStatus)) && _str(d.spouseEmpStatus) !== '';
  var deps = [];
  for (var c = 1; c <= 4; c++) if (_str(d['child' + c + 'Name'])) deps.push(_str(d['child' + c + 'Name']));
  var depLine;
  if (married && !spouseWorks) {
    depLine = '<strong>Sole earner.</strong> ' + client + ' is married and the spouse is recorded as ' +
              (_str(d.spouseEmpStatus).toLowerCase() || 'not employed') + ', so the household depends entirely on this one income' +
              (deps.length ? ', with ' + deps.length + ' dependant' + (deps.length === 1 ? '' : 's') : '') + '.';
  } else if (married && spouseWorks) {
    depLine = 'Dual income household' + (deps.length ? ' with ' + deps.length + ' dependant' + (deps.length === 1 ? '' : 's') : '') +
              '. Both lives carry the household &mdash; check whether the spouse has cover of their own.';
  } else {
    depLine = _str(d.maritalStatus) || 'Marital status not recorded' +
              (deps.length ? ', ' + deps.length + ' dependant(s)' : '') + '.';
  }
  h += '<div style="background:#fff;border-left:4px solid #0D9488;border-radius:0 10px 10px 0;padding:12px 15px;margin-bottom:14px;font-size:13.5px;color:#134E4A;line-height:1.6">' +
       depLine +
       (income ? ' Occupation: ' + (_str(d.occupation) || 'not recorded') + ', ' + rrbMoney_(income) + ' a month.' : '') +
       '</div>';

  // ── 2b. THE GAP THE ANALYSIS DOES NOT SIZE
  h += rrbIncomeProtectionBlock_(d);

  // ── 3. FOUR DIALS
  var gapPct = need > 0 && totNeed > 0 ? Math.round((need / totNeed) * 100) : rrbNum_(d.fi_coverageGap) * 100;
  var premPct = income > 0 && premTotal > 0 ? (premTotal / income) * 100 : 0;
  var debtCovered = /^y/i.test(_str(d.mortgageIns));
  var retPct = rrbNum_(d.fi_retReadiness) * 100;

  h += '<table role="presentation" width="100%" style="border-collapse:collapse;margin-bottom:6px"><tr>';
  h += rrbDial_('Need still uncovered', Math.round(gapPct) + '%', gapPct,
                gapPct > 60 ? 'bad' : gapPct > 30 ? 'warn' : 'good',
                rrbMoney_(need) + ' of the family&rsquo;s need has nothing behind it.');
  h += rrbDial_('Premium vs income', premTotal > 0 ? premPct.toFixed(1) + '%' : 'not set',
                premTotal > 0 ? premPct * 6 : 0,
                premTotal <= 0 ? 'warn' : premPct > 12 ? 'bad' : premPct > 7 ? 'warn' : 'good',
                premTotal > 0 ? rrbMoney_(premTotal) + ' a month against ' + rrbMoney_(income) + '.'
                              : 'No premium entered yet, so affordability cannot be judged.');
  h += '</tr><tr>';
  h += rrbDial_('Debt exposure', rrbMoney_(debts) || 'none', debts > 0 && income > 0 ? Math.min(100, (debts / (income * 12)) * 12) : 0,
                debts > income * 12 * 3 ? 'bad' : debts > 0 ? 'warn' : 'good',
                debts > 0 ? (debtCovered ? 'Mortgage is insured. Confirm the other debts.'
                                         : 'Would pass to the family. Debt protection should lead.') : 'No debt recorded.');
  h += rrbDial_('Retirement provision', Math.round(retPct) + '%', retPct,
                retPct < 25 ? 'bad' : retPct < 60 ? 'warn' : 'good',
                retPct < 25 ? 'Little or nothing being built for later.' : 'On the way.');
  h += '</tr></table>';

  // ── 4. WHAT THE ADVISOR RECOMMENDED, AND WHY
  var rt = rrbRecTable_(d, false);
  if (rt.count) {
    h += '<div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#94A3B8;font-weight:700;margin:8px 0 7px">What ' +
         advFirst + ' recommended, and why</div>' + rt.html;
  }

  // ── 5. THE ASK
  h += '<div style="text-align:center;margin:20px 0 14px">' +
       '<a href="' + link + '" style="display:inline-block;background:#0D9488;color:#fff;padding:15px 30px;' +
       'border-radius:10px;text-decoration:none;font-weight:800;font-size:16px">Open and review this fact find &rarr;</a>' +
       '<div style="font-size:12.5px;color:#64748b;margin-top:9px">Opens on your phone. The case is already loaded.</div>' +
       '</div>';

  h += '<div style="background:#fff;border:1px solid #E2E8F0;border-radius:10px;padding:13px 16px;font-size:13px;color:#334155;line-height:1.65">' +
       '<strong>You can change anything you disagree with.</strong> Corrections are recorded against your name ' +
       'and printed on the fact find, so the file shows what you changed and why. Add your comments, sign, and ' +
       'submit &mdash; ' + advFirst + ' is notified straight away and the client is told the review is complete.' +
       '</div>';

  h += rrbFoot_(_str(d.submissionId));
  return h;
}

/**
 * Sends the review email for one submission. Honours RRB_DRY_RUN, and always
 * copies RRB_ALWAYS_CC.
 */
function rrbSendManagerReview(submissionId, roleOverride) {
  var sheet = ffGetOrCreateRevisedTab_();
  var headers = ffEnsureHeaders_(sheet);
  var row = ffFindRowBySubmissionId_(sheet, headers, submissionId);
  if (!row) throw new Error('No submission ' + submissionId);
  var d = ffReadRow_(sheet, headers, row);

  var mgrKey = d.reviewerKey || ffLookupDirectManager_(d.agentCode);
  var mgr = MAIL_CONFIG.managers[mgrKey] || MAIL_CONFIG.managers.ricky;
  var to = _str(d.reviewerEmail) || _str(mgr.email);

  // A signed link where the secret exists; the legacy form otherwise, so this
  // works before rrbInitSecret() has been run.
  var link;
  try {
    link = RRB_APP_URL + '?id=' + encodeURIComponent(submissionId) +
           '&t=' + encodeURIComponent(rrbMintToken(submissionId, roleOverride || 'manager', mgr));
  } catch (err) {
    link = RRB_APP_URL + '?id=' + encodeURIComponent(submissionId) + '&role=manager';
  }

  var subject = rrbReviewSubject_(d);
  var html = rrbManagerReviewHtml_(d, link);
  var cc = [RRB_ALWAYS_CC, _str(d.agentEmail)].filter(String).join(',');

  if (RRB_DRY_RUN) {
    Logger.log('[DRY RUN] to=%s cc=%s subject=%s', to, cc, subject);
    Logger.log('link: %s', link);
    return { ok: true, dryRun: true, to: to, link: link };
  }
  MailApp.sendEmail({ to: to, cc: cc, subject: subject, htmlBody: html,
                      name: 'RR Branch Fact Find' });
  return { ok: true, to: to, link: link };
}

/**
 * Sends the new template to you alone, for the most recent pending case, so it
 * can be read on a phone before it goes to anyone else. Ignores RRB_DRY_RUN.
 */
function rrbPreviewManagerEmail() {
  var sheet = ffGetOrCreateRevisedTab_();
  var headers = ffEnsureHeaders_(sheet);
  var found = null;
  for (var r = sheet.getLastRow(); r >= 2; r--) {
    var d = ffReadRow_(sheet, headers, r);
    if (d && d.submissionId) { found = d; break; }
  }
  if (!found) { Logger.log('No submissions to preview.'); return; }

  var link = RRB_APP_URL + '?id=' + encodeURIComponent(found.submissionId) + '&role=manager';
  MailApp.sendEmail({
    to: RRB_ALWAYS_CC,
    subject: '[PREVIEW] Fact find for review — ' + _str(found.clientName),
    htmlBody: rrbManagerReviewHtml_(found, link),
    name: 'RR Branch Fact Find'
  });
  Logger.log('Preview of "%s" sent to %s', _str(found.clientName), RRB_ALWAYS_CC);
  Logger.log('Link in the email: %s', link);
}


// ═════════════════════════════════════════════════════════════════════════════
//  9. AFTER THE MANAGER SIGNS
// ═════════════════════════════════════════════════════════════════════════════
// Three messages leave at the moment of sign-off, and they are not variations
// of one another. The agent needs to know what to do next and what was raised.
// The client needs to understand what has been approved for them and why. And
// a case the manager did NOT agree with must not reach the client at all -
// that is a different message, to the agent alone.

function rrbConcerns_(d) {
  var out = [];
  for (var i = 1; i <= 8; i++) {
    var t = _str(d['revAck' + i + 'Note']) || _str(d['revNote' + i]);
    if (t) out.push(t);
  }
  ['mgrComments', 'mgrRemedial', 'dmGuidance'].forEach(function (k) {
    var v = _str(d[k]);
    if (v && out.indexOf(v) < 0) out.push(v);
  });
  return out;
}

/** Manager AGREED — to the agent. */
function rrbAgentApprovedHtml_(d) {
  var advFirst = _str(d.advisorName).split(' ')[0] || 'there';
  var mgr = _str(d.mgrName) || _str(d.reviewerName) || 'your manager';
  var client = _str(d.clientName) || 'your client';
  var notes = rrbConcerns_(d);
  var rt = rrbRecTable_(d, false);

  var h = rrbHead_('Approved &mdash; ' + client, mgr + ' has signed off. Over to you.');
  h += '<p style="margin:0 0 14px">Hi ' + advFirst + ',</p>';
  h += '<div style="background:#F0FDFA;border:1.5px solid #0D9488;border-radius:10px;padding:13px 16px;margin-bottom:16px">' +
       '<div style="font-size:15px;font-weight:800;color:#0F766E">&#10003; ' + mgr + ' agrees with your recommendation</div>' +
       '<div style="font-size:13px;color:#134E4A;margin-top:4px">' + client +
       ' has been told the review is complete and that you will be in touch.</div></div>';

  if (notes.length) {
    h += '<div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#94A3B8;font-weight:700;margin-bottom:7px">' +
         'Points ' + mgr.split(' ')[0] + ' raised</div>';
    h += '<div style="background:#FFFBEB;border:1px solid #F59E0B;border-radius:10px;padding:12px 15px;margin-bottom:16px">' +
         '<ol style="margin:0;padding-left:18px;font-size:13px;color:#92400E;line-height:1.7">' +
         notes.map(function (n) { return '<li>' + n + '</li>'; }).join('') + '</ol>' +
         '<div style="font-size:12.5px;color:#92400E;margin-top:8px">Approved, but deal with these before you see the client.</div></div>';
  }

  if (rt.count) h += '<div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#94A3B8;font-weight:700;margin-bottom:7px">Approved as recommended</div>' + rt.html;

  h += '<div style="background:#fff;border-left:4px solid #0D9488;border-radius:0 10px 10px 0;padding:13px 16px">' +
       '<div style="font-size:13.5px;font-weight:800;color:#0F766E;margin-bottom:6px">What you do next</div>' +
       '<ol style="margin:0;padding-left:18px;font-size:13px;color:#334155;line-height:1.75">' +
       '<li>Call ' + client + ' and walk through the approved recommendation.</li>' +
       '<li><strong>Print the fact find and take the client&rsquo;s wet signature.</strong> Digital alone is not enough.</li>' +
       '<li>Submit the application with the signed pack.</li>' +
       '<li>Upload the signed document to M-Files.</li>' +
       '</ol></div>';
  return h + rrbFoot_(_str(d.submissionId));
}

/** Manager did NOT agree — to the agent only. The client hears nothing. */
function rrbAgentDeclinedHtml_(d) {
  var advFirst = _str(d.advisorName).split(' ')[0] || 'there';
  var mgr = _str(d.mgrName) || _str(d.reviewerName) || 'your manager';
  var client = _str(d.clientName) || 'your client';
  var notes = rrbConcerns_(d);

  var h = rrbHead_('Sent back &mdash; ' + client,
                   mgr + ' has asked for changes before this goes to the client.', '#FFFBEB');
  h += '<p style="margin:0 0 14px">Hi ' + advFirst + ',</p>';
  h += '<div style="background:#fff;border:1.5px solid #B45309;border-radius:10px;padding:13px 16px;margin-bottom:16px">' +
       '<div style="font-size:15px;font-weight:800;color:#92400E">This one is not approved yet</div>' +
       '<div style="font-size:13px;color:#7C2D12;margin-top:4px">' +
       '<strong>The client has not been told anything.</strong> Nothing goes to ' + client +
       ' until this is resolved and signed off.</div></div>';

  if (notes.length) {
    h += '<div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#94A3B8;font-weight:700;margin-bottom:7px">What needs to change</div>';
    h += '<ol style="margin:0 0 16px;padding-left:20px;font-size:13.5px;color:#334155;line-height:1.8">' +
         notes.map(function (n) { return '<li>' + n + '</li>'; }).join('') + '</ol>';
  } else {
    h += '<p style="font-size:13px;color:#B45309;margin-bottom:16px">No written reason was recorded. Speak to ' +
         mgr.split(' ')[0] + ' before you change anything &mdash; and ask for it in writing.</p>';
  }

  h += rrbFixBlock_(d, mgr);

  h += '<div style="background:#fff;border-left:4px solid #B45309;border-radius:0 10px 10px 0;padding:13px 16px;font-size:13px;color:#334155;line-height:1.7">' +
       '<strong>For anything beyond the quick fixes above:</strong> reopen the fact find, make the changes, and send it again. ' +
       'It goes back to ' + mgr.split(' ')[0] + ' for a fresh review. Being sent back is a normal part of ' +
       'the process &mdash; it is how a weak case gets caught before the client sees it, not a mark against you.</div>';
  return h + rrbFoot_(_str(d.submissionId));
}

/**
 * The fix-it-in-the-email form on a sent-back case.
 *
 * The most common send-back is a missing reason or a missing premium mode —
 * gaps of one sentence and one dropdown. Making the advisor reopen the whole
 * fact find for those meant the fix waited days; this form writes them
 * straight onto the record from the email, and the case goes back into the
 * manager's queue by itself. Same single-use signed token as every other
 * email action.
 */
function rrbFixBlock_(d, mgr) {
  var rows = [];
  for (var i = 1; i <= 6; i++) {
    var plan = _str(d['rec' + i + 'Rec']);
    var prem = rrbNum_(d['rec' + i + 'Prem']);
    if (!plan && !prem) continue;
    var noReason = plan && !_str(d['rec' + i + 'Reason']);
    var noMode   = prem > 0 && !_str(d['rec' + i + 'Mode']);
    if (noReason || noMode) rows.push({ i: i, plan: plan || ('Recommendation ' + i),
                                        noReason: noReason, noMode: noMode });
  }
  if (!rows.length) return '';

  var tok = '';
  try { tok = rrbMintToken(_str(d.submissionId), 'fix',
                           { name: _str(d.advisorName), email: _str(d.agentEmail) }); }
  catch (err) { return ''; }
  var url = '';
  try { url = rrbAppUrl_(); } catch (err2) {}
  if (!url) return '';

  var h = '<div style="background:#F0FDFA;border:1.5px solid #0D9488;border-radius:10px;padding:14px 16px;margin:0 0 16px">' +
    '<div style="font-size:14px;font-weight:800;color:#0F766E;margin-bottom:2px">Fix it right here &mdash; no need to reopen the form</div>' +
    '<div style="font-size:12.5px;color:#115E59;margin-bottom:11px">What you type below goes straight onto the fact find, ' +
      'and the case goes back to ' + rrbEsc_(mgr.split(' ')[0]) + ' for review automatically.</div>' +
    '<form action="' + url + '" method="get" style="margin:0">' +
    '<input type="hidden" name="action" value="agent_fix">' +
    '<input type="hidden" name="t" value="' + rrbEsc_(tok) + '">';

  rows.forEach(function (r) {
    h += '<div style="background:#fff;border:1px solid #CCFBF1;border-radius:8px;padding:10px 12px;margin-bottom:9px">' +
         '<div style="font-size:13px;font-weight:800;color:#134E4A;margin-bottom:6px">' + rrbEsc_(r.plan) + '</div>';
    if (r.noReason) {
      h += '<label style="display:block;font-size:11.5px;font-weight:700;color:#475569;margin-bottom:4px">' +
           'Why did you recommend this? One or two sentences, in the client&rsquo;s terms.</label>' +
           '<textarea name="r' + r.i + '" rows="2" style="width:100%;box-sizing:border-box;border:1px solid #CBD5E1;' +
           'border-radius:7px;padding:9px;font:13.5px/1.5 inherit;resize:vertical" ' +
           'placeholder="e.g. Covers the mortgage so the family keeps the house if anything happens to her"></textarea>';
    }
    if (r.noMode) {
      h += '<label style="display:block;font-size:11.5px;font-weight:700;color:#475569;margin:8px 0 4px">' +
           'How is the premium paid?</label>' +
           '<select name="m' + r.i + '" style="width:100%;box-sizing:border-box;border:1px solid #CBD5E1;' +
           'border-radius:7px;padding:9px;font:13.5px inherit;background:#fff">' +
           '<option value="">&mdash; choose &mdash;</option>' +
           '<option value="Monthly">Monthly</option><option value="Quarterly">Quarterly</option>' +
           '<option value="Semi-Annual">Semi-Annual</option><option value="Annual">Annual</option></select>';
    }
    h += '</div>';
  });

  h += '<button type="submit" style="width:100%;background:#0D9488;color:#fff;border:0;border-radius:8px;' +
       'padding:13px;font-size:14px;font-weight:800;cursor:pointer">Save these onto the fact find &rarr;</button>' +
       '</form></div>';
  return h;
}

/** Manager AGREED — to the client. Plain language, no jargon, no pressure. */
function rrbClientApprovedHtml_(d) {
  var first = (_str(d.clientName) || 'there').split(' ')[0];
  var adv = _str(d.advisorName) || 'your adviser';
  var mgr = _str(d.mgrName) || _str(d.reviewerName) || 'their direct manager';
  var rt = rrbRecTable_(d, true);

  var need = rrbNum_(d.insuranceNeed_calc);
  var income = rrbNum_(d.monthlyIncomeTotal || d.monthlyIncome);
  var debts = rrbNum_(d.totalDebts_calc);
  var retGap = rrbNum_(d.retGap_calc);

  var h = rrbHead_('Your plan has been reviewed and approved',
                   'Checked independently by ' + mgr + ' at RR Branch');
  h += '<p style="margin:0 0 14px">Hi ' + first + ',</p>';
  h += '<p style="margin:0 0 16px">Good news. The recommendation ' + adv + ' put together for you has been ' +
       'independently reviewed by the advisor\u2019s direct manager and <strong>approved as suitable for your circumstances</strong>. ' +
       'That review is a check on your behalf &mdash; a second person confirming the advice fits what you told us.</p>';

  // What we found, in their words.
  var findings = [];
  if (need > 0) findings.push('If something happened to you tomorrow, your family would be short by about <strong>' +
    rrbMoney_(need) + '</strong> of what they would need.');
  if (debts > 0) findings.push('You have <strong>' + rrbMoney_(debts) + '</strong> of borrowing that would not simply disappear.');
  if (retGap > 0) findings.push('To retire on the income you described, you would need about <strong>' +
    rrbMoney_(retGap) + '</strong> put aside by then.');
  if (findings.length) {
    h += '<div style="background:#fff;border:1px solid #E2E8F0;border-radius:11px;padding:14px 16px;margin-bottom:16px">' +
         '<div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#94A3B8;font-weight:700;margin-bottom:8px">What we found</div>' +
         '<ul style="margin:0;padding-left:18px;font-size:13.5px;color:#334155;line-height:1.8">' +
         findings.map(function (f) { return '<li>' + f + '</li>'; }).join('') + '</ul></div>';
  }

  if (rt.count) {
    h += '<div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#94A3B8;font-weight:700;margin-bottom:7px">What has been approved for you</div>' + rt.html;
  }

  // Worth discussing. Framed as what a full review covers, not as a pitch.
  var more = [];
  var hasIP = false;
  for (var i = 1; i <= 6; i++) if (/praesidia|disability|income protection|personal accident/i.test(_str(d['rec' + i + 'Rec']))) hasIP = true;
  if (!hasIP && income > 0) more.push('<strong>Protecting your income.</strong> Your cover protects your family if you die. It is worth also asking ' + adv.split(' ')[0] + ' what would happen to the household if you were unable to work for a period.');
  if (retGap > 0) more.push('<strong>Retirement.</strong> On the figures you gave us there is a shortfall against the income you said you wanted. Starting earlier makes it considerably cheaper.');
  if (rrbNum_(d.needEducation) > 0) more.push('<strong>Education costs.</strong> You mentioned education plans &mdash; these have a fixed date, so they are usually funded separately.');
  if (!_str(d.medical) || _str(d.medical) === 'No') more.push('<strong>Health cover.</strong> Worth reviewing what happens to the family budget if a major medical bill arrives.');
  if (more.length) {
    h += '<div style="background:#F8FAFC;border:1px solid #E2E8F0;border-radius:11px;padding:14px 16px;margin-bottom:16px">' +
         '<div style="font-size:13.5px;font-weight:800;color:#0F766E;margin-bottom:7px">Worth discussing at your next review</div>' +
         '<div style="font-size:12.5px;color:#64748b;margin-bottom:9px">Not part of what has been approved &mdash; just the things a full review would normally look at next.</div>' +
         '<ul style="margin:0;padding-left:18px;font-size:13px;color:#334155;line-height:1.8">' +
         more.slice(0, 3).map(function (m) { return '<li>' + m + '</li>'; }).join('') + '</ul></div>';
  }

  h += '<div style="background:#fff;border-left:4px solid #0D9488;border-radius:0 10px 10px 0;padding:13px 16px;font-size:13.5px;color:#334155;line-height:1.7">' +
       '<strong>What happens next.</strong> ' + adv + ' will contact you to go through everything and answer your ' +
       'questions. <strong>Nothing is final until you have read it and signed it yourself</strong> &mdash; and you are free ' +
       'to take any part of it, or none of it.</div>';

  h += '<p style="font-size:12px;color:#94a3b8;margin-top:16px;line-height:1.6">This summary is for your information and is not a contract or an offer of insurance. ' +
       'Figures are based on what you told us and are illustrative until an application is accepted.</p>';
  return h + rrbFoot_('');
}


/**
 * Call this once the manager's review has been written to the sheet.
 *
 * The branching matters more than the templates: a case the manager did NOT
 * agree with goes to the agent alone. Telling a client their plan is "approved"
 * and then walking it back is the one mistake here that cannot be undone.
 */
function rrbSendDecisionEmails(submissionId) {
  var sheet = ffGetOrCreateRevisedTab_();
  var headers = ffEnsureHeaders_(sheet);
  var row = ffFindRowBySubmissionId_(sheet, headers, submissionId);
  if (!row) throw new Error('No submission ' + submissionId);
  var d = ffReadRow_(sheet, headers, row);

  var agreed = /^agree/i.test(_str(d.mgrAgree));
  var agent  = _str(d.agentEmail);
  var client = _str(d.email) || _str(d.clientEmail);
  var name   = _str(d.clientName) || 'client';
  var sent   = { agent: false, client: false, agreed: agreed };

  // 1. The agent, either way.
  if (agent) {
    var subj = agreed ? 'Approved — ' + name + ', ready for the client'
                      : 'Sent back — ' + name + ' needs changes before the client sees it';
    var body = agreed ? rrbAgentApprovedHtml_(d) : rrbAgentDeclinedHtml_(d);
    if (RRB_DRY_RUN) Logger.log('[DRY RUN] agent <- %s | %s', agent, subj);
    else {
      MailApp.sendEmail({ to: agent, cc: RRB_ALWAYS_CC, subject: subj,
                          htmlBody: body, name: 'RR Branch Fact Find' });
    }
    sent.agent = true;
  }

  // 2. The client, ONLY where the manager agreed.
  if (agreed && client) {
    if (RRB_DRY_RUN) Logger.log('[DRY RUN] client <- %s | Your plan has been reviewed and approved', client);
    else {
      MailApp.sendEmail({ to: client, cc: RRB_ALWAYS_CC,
                          subject: 'Your plan has been reviewed and approved',
                          htmlBody: rrbClientApprovedHtml_(d), name: adv_(d) });
    }
    sent.client = true;
  } else if (!agreed) {
    Logger.log('Not agreed — nothing sent to the client, by design.');
  }

  Logger.log('Decision emails: agent=%s client=%s agreed=%s%s',
             sent.agent, sent.client, agreed, RRB_DRY_RUN ? '  [DRY RUN]' : '');
  return sent;
}

function adv_(d) { return _str(d.advisorName) || 'RR Branch'; }

/** Sends all three templates to you alone, so they can be read before use. */
function rrbPreviewAllEmails() {
  var sheet = ffGetOrCreateRevisedTab_();
  var headers = ffEnsureHeaders_(sheet);
  var d = null;
  for (var r = sheet.getLastRow(); r >= 2; r--) {
    var x = ffReadRow_(sheet, headers, r);
    if (x && x.submissionId) { d = x; break; }
  }
  if (!d) { Logger.log('No submissions to preview.'); return; }

  var link = RRB_APP_URL + '?id=' + encodeURIComponent(d.submissionId) + '&role=manager';
  var set = [
    ['1 of 4 — MANAGER: review request',      rrbManagerReviewHtml_(d, link)],
    ['2 of 4 — AGENT: approved',              rrbAgentApprovedHtml_(d)],
    ['3 of 4 — AGENT: sent back',             rrbAgentDeclinedHtml_(d)],
    ['4 of 4 — CLIENT: approved',             rrbClientApprovedHtml_(d)]
  ];
  set.forEach(function (s) {
    MailApp.sendEmail({ to: RRB_ALWAYS_CC, subject: '[PREVIEW] ' + s[0],
                        htmlBody: s[1], name: 'RR Branch Fact Find' });
  });
  Logger.log('Four preview emails sent to %s using "%s".', RRB_ALWAYS_CC, _str(d.clientName));
}


// ═════════════════════════════════════════════════════════════════════════════
//  WHY WON'T THIS PERSON SIGN IN?
// ═════════════════════════════════════════════════════════════════════════════
//
// rrbLogin deliberately returns the same message whether the person is unknown
// or the password is wrong, so the endpoint cannot be used to find out who
// works here. That is right for the web, and useless when you are the branch
// manager trying to work out why one of your own agents cannot get in.
//
// This runs in the editor, where you are already trusted, and names the exact
// step that fails. It prints no password and stores nothing.
//
//   1. Edit the two values below.
//   2. Run rrbWhyNot.
//   3. Read View > Logs.
function rrbWhyNot() {
  var CODE = 'A13710';        // <- the agent number
  var PW   = '32';            // <- the password being typed

  Logger.log('Checking %s', CODE);
  Logger.log('');

  // 1. Is the deployed code the current code?
  Logger.log('1. Is this script the one you just pasted?');
  Logger.log('   rrbUnitKeyForName_ exists: %s',
             (typeof rrbUnitKeyForName_ === 'function') ? 'YES' : 'NO  <- an OLD version is running');
  Logger.log('');

  // 2. Is the person on the Access tab, and active?
  var acc = null;
  try { acc = rrbFindByCode_(CODE, ''); } catch (err) { Logger.log('   Access tab error: %s', err.message); }
  Logger.log('2. On the Access tab?');
  if (!acc) {
    Logger.log('   NO — no active row with agent number %s.', CODE);
    Logger.log('   Check the Agent Number cell and that Active says Active.');
    return;
  }
  Logger.log('   YES — %s <%s>, role "%s", unit "%s"', acc.name, acc.email, acc.role, acc.unit);
  Logger.log('');

  // 3. Is a password stored for that email?
  var key = RRB_PROP_PW + String(acc.email).toLowerCase();
  var rec = PropertiesService.getScriptProperties().getProperty(key);
  Logger.log('3. Password stored for %s?', acc.email);
  Logger.log('   %s', rec ? 'YES' : 'NO  <- run rrbSyncAccessPasswords()');
  if (!rec) return;
  Logger.log('');

  // 4. Does the password being typed match the stored hash?
  var match = rrbCheckPassword_(acc.email, PW);
  Logger.log('4. Does the typed password match?');
  Logger.log('   %s', match ? 'YES' : 'NO');
  if (!match) {
    Logger.log('   The sheet holds "%s" for this person.', String(acc.pw));
    Logger.log('   If that is what you typed, run rrbSyncAccessPasswords() again —');
    Logger.log('   the stored copy is older than the sheet.');
    return;
  }
  Logger.log('');

  // 5. And would rrbLogin actually let them through?
  var out = rrbLogin({ parameter: { code: CODE, pw: PW } });
  Logger.log('5. rrbLogin says:');
  Logger.log('   ok=%s  role=%s  scope=%s', out.ok, out.role,
             out.scope ? out.scope.kind : '-');
  if (!out.ok) Logger.log('   error: %s', out.error);
  else Logger.log('   THIS PERSON CAN SIGN IN. If the page still refuses, the');
  if (out.ok) Logger.log('   deployment serving your site is not this version.');
}


// ═════════════════════════════════════════════════════════════════════════════
//  10. REAL PASSWORDS FOR EVERYONE ON THE ACCESS TAB
// ═════════════════════════════════════════════════════════════════════════════
//
// rrbSetAllPasswords() works off the older roster and MAIL_CONFIG, so it misses
// most of the branch. This one works off the Access tab - the same list the
// sign-in dropdown is built from - and does three things in one pass:
//
//   1. generates a strong, readable password for each active person
//   2. writes it back into column D, so the sheet stays the place you look
//   3. stores the salted hash, which is what sign-in actually compares
//
// Only people whose current password is weak are touched, so anyone already
// given a real one keeps it. Nothing is printed to the log: the log is visible
// to anyone who can open the script, and 33 passwords in it would be worse
// than the digits they replace.
function rrbSetAccessPasswords() {
  var sh = SpreadsheetApp.openById(RRB_ACCESS_SHEET_ID).getSheetByName(RRB_ACCESS_TAB);
  if (!sh) throw new Error('No "' + RRB_ACCESS_TAB + '" tab.');

  var values = sh.getDataRange().getValues();
  var head = values[0].map(function (h) { return _str(h).toLowerCase().trim(); });
  var iEmail = head.indexOf('email'), iName = head.indexOf('name'),
      iCode = head.indexOf('agent number'), iPw = head.indexOf('password'),
      iAct = head.indexOf('active');
  if (iPw < 0) throw new Error('No "Password" column on the Access tab.');

  var props = PropertiesService.getScriptProperties();
  var rows = [], changed = 0, kept = 0;

  for (var r = 1; r < values.length; r++) {
    var email = _str(values[r][iEmail]).toLowerCase().trim();
    if (!email) continue;
    if (iAct >= 0 && !/^active$|^yes$|^true$/i.test(_str(values[r][iAct]).trim())) continue;

    var name = _str(values[r][iName]).replace(/^\s*[A-Z]\d+\s*-\s*/, '').trim();
    var code = iCode >= 0 ? _str(values[r][iCode]).trim() : '';
    var cur  = String(values[r][iPw] == null ? '' : values[r][iPw]).trim();

    // Leave a real password alone. Replace anything guessable.
    var weak = !cur || cur.length < 8 || /^\d+$/.test(cur);
    if (!weak) { kept++; continue; }

    var pw = rrbMakePassword_();
    sh.getRange(r + 1, iPw + 1).setValue(pw);          // back into the sheet
    var salt = Utilities.getUuid().replace(/-/g, '').slice(0, 16);
    props.setProperty(RRB_PROP_PW + email, salt + ':' + rrbHashPassword_(salt, pw));
    rows.push([name, code, pw]);
    changed++;
  }

  if (!rows.length) {
    Logger.log('Nothing to change - every active person already has a real password.');
    return { changed: 0, kept: kept };
  }

  var html =
    '<div style="font:14px/1.6 -apple-system,Arial,sans-serif;color:#0F172A">' +
    '<p>New dashboard passwords for RR Branch. <strong>Send each person their own line, ' +
    'then delete this email.</strong></p>' +
    '<table style="border-collapse:collapse;font-size:13px">' +
    '<tr><th align="left" style="padding:4px 16px 4px 0;color:#64748b;font-weight:600">Name</th>' +
    '<th align="left" style="padding:4px 16px 4px 0;color:#64748b;font-weight:600">Agent no.</th>' +
    '<th align="left" style="padding:4px 0;color:#64748b;font-weight:600">Password</th></tr>' +
    rows.map(function (x) {
      return '<tr><td style="padding:4px 16px 4px 0">' + x[0] + '</td>' +
             '<td style="padding:4px 16px 4px 0;color:#64748b">' + x[1] + '</td>' +
             '<td style="padding:4px 0"><code style="font-size:13.5px">' + x[2] + '</code></td></tr>';
    }).join('') + '</table>' +
    '<p style="font-size:12.5px;color:#64748b;margin-top:14px">Column D of the Access tab has been ' +
    'updated to match, so the sheet stays the place you look. ' + kept + ' person(s) already had a ' +
    'real password and were left alone.</p></div>';

  MailApp.sendEmail({ to: RRB_ALWAYS_CC, name: 'RR Branch Fact Find',
                      subject: 'New dashboard passwords (' + changed + ')', htmlBody: html });

  Logger.log('%s password(s) replaced, %s left alone. The list has been emailed to %s.',
             changed, kept, RRB_ALWAYS_CC);
  Logger.log('Deliberately not logged here - anyone who can open this script can read the log.');
  return { changed: changed, kept: kept };
}

// ═════════════════════════════════════════════════════════════════════════════
// SECTION 11 — THE CLIENT PORTAL
//
// The client is inside the loop, not at the end of it. On submit they get a
// thank-you with their draft and a personal portal link (client.html?id=…);
// on the portal they answer once — "looks right" or "I'd like changes" — and
// that answer lands on the case AND in the advisor's and direct manager's
// inboxes BEFORE the sign-off. Hesitation reaches the reviewer, not the
// after-sales file.
//
// Wire-up (two lines in Code.gs — see WORKFLOW.md):
//   doPost:              if (stage === 'client_response') return ffProcessClientResponse(data);
//   ffProcessAgentSubmit: try { rrbSendClientDraft(data); } catch (err) { Logger.log('Client draft failed: ' + err); }
// ═════════════════════════════════════════════════════════════════════════════

// The public site root — the portal, the form and the dashboard all live here.
var RRB_SITE = 'https://factfind360.com';

// rrbClientLink_(submissionId) used to live here, pointing at a client.html
// page that was never built. Worse, RRBranchEmails.gs defines a DIFFERENT
// rrbClientLink_(d, action) — and in Apps Script the later file silently wins,
// so callers here were minting tokens for the id "undefined" with the action
// "undefined". One global namespace: never give two functions the same name.

// The thank-you + draft that goes to the client the moment the agent submits.
function rrbClientDraftHtml_(d) {
  var first = _str(d.clientName || d.fullName).split(' ')[0] || 'there';
  var adv   = _str(d.advisorName) || 'your adviser';
  var mgr   = _str(d.directManagerName) || _str(d.reviewerName) || 'their direct manager';

  var h = rrbHead_('Thank you, ' + first,
                   'Your fact find is in — and being independently checked');
  h += '<p style="margin:0 0 14px">Hi ' + first + ',</p>';
  h += '<p style="margin:0 0 14px;font-size:13.5px;color:#334155;line-height:1.6">' +
       'Thank you for taking the time to meet with ' + adv + '. Everything you discussed has been written up, ' +
       'and the recommendation is now with <strong>' + mgr + '</strong> — ' +
       adv.split(' ')[0] + '’s direct manager — who independently checks that it truly fits your needs. ' +
       'You will hear from us within <strong>one business day</strong>, and <strong>nothing is final</strong> ' +
       'until you sign the printed form in person.</p>';

  h += rrbClientProgressBar_(d);

  // The draft, client-safe (no internal figures) — the same table the
  // approval letter uses, in client mode.
  var rt = rrbRecTable_(d, true);
  if (rt.count) {
    h += '<div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#94A3B8;font-weight:700;margin:8px 0 7px">' +
         'What ' + adv.split(' ')[0] + ' recommended — a draft for your records</div>' + rt.html;
  }

  // No button here. The confirm block appended right after this HTML carries
  // the two working token buttons ("Yes, that's correct" / "Something needs
  // changing") — the button that used to sit here pointed at a client page
  // that was never built.
  h += '<div style="font-size:12.5px;color:#64748b;margin:16px 0 6px;text-align:center">' +
       'Check the summary above, then use the buttons below — if anything looks off it reaches ' +
       adv.split(' ')[0] + ' <strong>and their manager</strong> before anything is signed off.</div>';

  h += rrbFoot_(_str(d.submissionId));
  return h;
}

function rrbSendClientDraft(d) {
  var to = _str(d.email) || _str(d.clientEmail);
  if (!to || to.indexOf('@') < 0) { Logger.log('No client email on %s - draft not sent.', d.submissionId); return; }
  rrbMail_(to, 'Thank you for meeting ' + (_str(d.advisorName).split(' ')[0] || 'us') +
               ' — your plan is being reviewed', rrbClientDraftHtml_(d), RRB_ALWAYS_CC);
}

// ── The client's answer, recorded on the case and pushed to the humans ──────
// Headers are ensured here, self-contained, so this works without touching
// the Code.gs schema: three columns appended once, then reused.
var RRB_CLIENT_COLS = ['Client Response', 'Client Comments', 'Client Responded At'];

function rrbEnsureClientCols_(sheet) {
  var lastCol = sheet.getLastColumn();
  var headers = lastCol ? sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(String) : [];
  var idx = {};
  RRB_CLIENT_COLS.forEach(function (label) {
    var i = headers.indexOf(label);
    if (i < 0) {
      headers.push(label);
      sheet.getRange(1, headers.length).setValue(label)
           .setFontWeight('bold').setBackground('#0E1F4D').setFontColor('#FFFFFF');
      i = headers.length - 1;
    }
    idx[label] = i + 1;   // 1-based column
  });
  return idx;
}

// rrbEsc_ lives in RRBranchEmails.gs. There used to be a second copy here that
// did not escape quotes, and in Apps Script's single global namespace whichever
// file parsed last silently won — the same collision that once made the client
// link mint a token for id "undefined". One definition, and it is the strict one.

function ffProcessClientResponse(data) {
  var id = _str(data.submissionId);
  if (!id) return _ffJson({ ok: false, error: 'Submission ID required' });
  var resp = _str(data.clientResponse);
  if (resp !== 'looks_right' && resp !== 'wants_changes') {
    return _ffJson({ ok: false, error: 'Response must be looks_right or wants_changes' });
  }
  var comments = _str(data.clientComments).slice(0, 2000);

  var sheet = ffGetOrCreateRevisedTab_();
  var headers = ffEnsureHeaders_(sheet);
  var row = ffFindRowBySubmissionId_(sheet, headers, id);
  if (row < 0) return _ffJson({ ok: false, error: 'Submission not found' });

  var existing = ffReadRow_(sheet, headers, row);
  var cols = rrbEnsureClientCols_(sheet);
  var when = new Date().toISOString();
  sheet.getRange(row, cols['Client Response']).setValue(resp);
  sheet.getRange(row, cols['Client Comments']).setValue(comments);
  sheet.getRange(row, cols['Client Responded At']).setValue(when);

  // Straight to the humans — the advisor AND the direct manager, before sign-off.
  var client = _str(existing.clientName) || _str(existing.fullName) || 'The client';
  var wants  = (resp === 'wants_changes');
  var subject = wants
    ? 'CLIENT REQUESTS CHANGES — ' + client + ' — read before signing off'
    : 'Client confirmed — ' + client + ' says the draft looks right';

  var h = rrbHead_(wants ? client + ' would like changes' : client + ' — draft confirmed',
                   'Client responded ' + when.slice(0, 10));
  h += '<p style="margin:0 0 12px;font-size:13.5px;color:#334155;line-height:1.6">' +
       (wants
         ? '<strong>' + client + ' has asked for changes on the draft recommendations.</strong> ' +
           'This arrived <strong>before the sign-off</strong> — address it before the case moves.'
         : client + ' reviewed the draft on their portal and confirmed it looks right so far.') + '</p>';
  if (comments) {
    h += '<div style="background:' + (wants ? '#FFFBEB' : '#F0FDFA') + ';border:1.5px solid ' +
         (wants ? '#FCD34D' : '#99F6E4') + ';border-radius:10px;padding:12px 15px;margin:0 0 12px;' +
         'font-size:13.5px;color:#334155;line-height:1.6"><strong>In their words:</strong><br>' +
         rrbEsc_(comments) + '</div>';
  }
  h += rrbFoot_(id);

  var agentEmail = _str(existing.agentEmail);
  var dmKey = _str(existing.directManagerKey) || _str(existing.reviewerKey);
  var dm = dmKey && MAIL_CONFIG.managers[dmKey] ? MAIL_CONFIG.managers[dmKey] : null;
  var ccs = [dm ? dm.email : '', RRB_ALWAYS_CC].filter(function (x) { return x && x !== agentEmail; });
  if (agentEmail) rrbMail_(agentEmail, subject, h, ccs.join(','));
  else if (dm)    rrbMail_(dm.email, subject, h, RRB_ALWAYS_CC);

  return _ffJson({ ok: true, stage: 'client_response', response: resp, row: row });
}

// ── The client's six-stage journey — due diligence they can SEE ─────────────
// Advisor's review → client checks the draft → manager review → plan
// implementation → policy delivery → service reviews. Shown identically on
// the portal and in every client email, so expectations are managed by the
// same picture everywhere.
function rrbClientStages_(d) {
  var status = _str(d.status).toLowerCase();
  var responded = !!_str(d.clientResponse || d['Client Response']);
  var steps = [
    ['Advisor’s review',   'Your advisor captured and checked everything you discussed.'],
    ['You check the draft',     'Your own copy, in plain language — tell us if anything needs changing.'],
    ['Manager review',          'The advisor’s direct manager independently confirms the recommendation fits.'],
    ['Plan implementation',     'You sign in person and the application is submitted.'],
    ['Policy delivery',         'Your policy documents are delivered and explained to you.'],
    ['Service reviews',         'We check in as life changes, so the plan keeps fitting.']
  ];
  var now = 1;                                     // default: draft with the client
  if (status.indexOf('changes') >= 0) now = 0;     // back with the advisor
  else if (status.indexOf('approv') >= 0) now = 3; // implementation next
  else if (responded) now = 2;                     // client answered; manager reviewing
  return { steps: steps, now: now };
}

// Email-safe progress bar (tables and solid cells only — no flexbox, no CSS
// classes; it must survive Gmail and Outlook).
function rrbClientProgressBar_(d) {
  var j = rrbClientStages_(d);
  var h = '<div style="background:#fff;border:1px solid #E2E8F0;border-radius:11px;padding:14px 16px;margin:0 0 14px">';
  h += '<div style="font-size:11px;text-transform:uppercase;letter-spacing:.06em;color:#94A3B8;font-weight:700;margin-bottom:8px">' +
       'Where your plan is — step ' + (j.now + 1) + ' of ' + j.steps.length + '</div>';
  h += '<table role="presentation" width="100%" style="border-collapse:separate;border-spacing:3px 0;margin-bottom:10px"><tr>';
  for (var b = 0; b < j.steps.length; b++) {
    var col = b < j.now ? '#0D9488' : (b === j.now ? '#F5B324' : '#E2E8F0');
    h += '<td style="height:7px;background:' + col + ';border-radius:4px" width="' + Math.floor(100 / j.steps.length) + '%"></td>';
  }
  h += '</tr></table>';
  for (var i = 0; i < j.steps.length; i++) {
    var done = i < j.now, nowStep = i === j.now;
    h += '<table role="presentation" width="100%" style="border-collapse:collapse"><tr>' +
      '<td width="24" valign="top" style="padding:3px 8px 3px 0">' +
        '<div style="width:20px;height:20px;border-radius:50%;text-align:center;font-size:11px;font-weight:800;line-height:20px;' +
        (done ? 'background:#0D9488;color:#fff' : nowStep ? 'background:#F5B324;color:#0E1F4D' : 'background:#EEF2F7;color:#94A3B8') +
        '">' + (done ? '&#10003;' : (i + 1)) + '</div></td>' +
      '<td style="padding:3px 0;font-size:13px;line-height:1.45">' +
        '<strong style="color:' + (nowStep ? '#92400E' : done ? '#0F172A' : '#94A3B8') + '">' +
        j.steps[i][0] + (nowStep ? ' — now' : '') + '</strong>' +
        (nowStep || done ? '<br><span style="color:#64748B;font-size:12px">' + j.steps[i][1] + '</span>' : '') +
      '</td></tr></table>';
  }
  h += '</div>';
  return h;
}

// ── 3-day progress reminders to the client, until approval ──────────────────
// Managed expectations beat chased expectations: every third day until the
// manager approves, the client gets the same six-stage picture with a short
// note on what is happening now. Stamped per case so it never double-sends;
// capped so a stuck case cannot mail a client forever.
var RRB_CLIENT_REMINDER_EVERY_DAYS = 3;
var RRB_CLIENT_REMINDER_MAX = 8;
var RRB_CLIENT_TRACK_COLS = ['Client Last Reminded', 'Client Reminder Count'];

function rrbClientProgressHtml_(d) {
  var first = _str(d.clientName || d.fullName).split(' ')[0] || 'there';
  var adv = _str(d.advisorName).split(' ')[0] || 'your advisor';
  var j = rrbClientStages_(d);
  var nowLine = {
    0: adv + ' is refining the recommendation following the review — you will see an updated draft.',
    1: 'Your draft is ready for your eyes — one minute on your page tells us if anything needs changing.',
    2: 'The direct manager is completing the independent review of your recommendation.',
    3: 'Approved — ' + adv + ' will arrange to meet you, walk through everything, and take your signature on paper.'
  }[j.now] || 'Your plan is moving — your advisor will be in touch at each step.';

  var h = rrbHead_('Your plan is moving, ' + first,
                   'A quick progress note — nothing is needed from you unless you want changes');
  h += '<p style="margin:0 0 12px">Hi ' + first + ',</p>';
  h += '<p style="margin:0 0 14px;font-size:13.5px;color:#334155;line-height:1.6">' +
       'A quick update on your Confidential Fact Find — here is exactly where things are:</p>';
  h += rrbClientProgressBar_(d);
  h += '<p style="margin:0 0 16px;font-size:13.5px;color:#334155;line-height:1.6"><strong>Right now:</strong> ' + nowLine + '</p>';
  // A progress note whose own subtitle says "nothing is needed from you"
  // should not end in a call-to-action button — and the one that was here
  // led to a page that never existed. Reply reaches the branch directly.
  h += '<p style="margin:0 0 10px;font-size:13px;color:#64748b;text-align:center">' +
       'Want something changed at this stage? Just reply to this email &mdash; it reaches the branch directly.</p>';
  h += rrbFoot_(_str(d.submissionId));
  return h;
}

function rrbSendClientProgressReminders() {
  var sheet = ffGetOrCreateRevisedTab_();
  if (sheet.getLastRow() < 2) { Logger.log('No cases.'); return { sent: 0 }; }
  var values = sheet.getDataRange().getValues();
  var headers = values[0].map(String);
  function col(label) { return headers.indexOf(label); }   // -1 if absent

  // ensure the tracking columns exist (idempotent)
  var track = {};
  RRB_CLIENT_TRACK_COLS.forEach(function (label) {
    var i = headers.indexOf(label);
    if (i < 0) {
      headers.push(label);
      sheet.getRange(1, headers.length).setValue(label)
           .setFontWeight('bold').setBackground('#0E1F4D').setFontColor('#FFFFFF');
      i = headers.length - 1;
    }
    track[label] = i;
  });

  var iStatus = col('Status'), iEmail = col('Email'), iSub = col('Submitted At'),
      iId = col('Submission ID'), iClient = col('Client Name'), iAdv = col('Advisor Name'),
      iResp = col('Client Response');
  var now = new Date(), msDay = 86400000, sent = 0;

  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var status = String(row[iStatus] || '').toLowerCase();
    if (status !== 'pending_review' && status.indexOf('changes') < 0) continue;   // stop at approval
    var email = String(iEmail >= 0 ? row[iEmail] : '').trim();
    if (!email || email.indexOf('@') < 0) continue;

    var subAt = row[iSub] instanceof Date ? row[iSub] : new Date(row[iSub]);
    if (isNaN(subAt.getTime())) continue;
    if ((now - subAt) / msDay < RRB_CLIENT_REMINDER_EVERY_DAYS) continue;

    var lastRaw = row[track['Client Last Reminded']];
    var last = lastRaw ? new Date(lastRaw) : null;
    if (last && !isNaN(last.getTime()) && (now - last) / msDay < RRB_CLIENT_REMINDER_EVERY_DAYS) continue;

    var count = Number(row[track['Client Reminder Count']]) || 0;
    if (count >= RRB_CLIENT_REMINDER_MAX) continue;

    var d = {
      submissionId: row[iId], status: row[iStatus], email: email,
      clientName: iClient >= 0 ? row[iClient] : '', advisorName: iAdv >= 0 ? row[iAdv] : '',
      clientResponse: iResp >= 0 ? row[iResp] : ''
    };
    rrbMail_(email, 'Your plan is moving — step ' + (rrbClientStages_(d).now + 1) + ' of 6',
             rrbClientProgressHtml_(d), RRB_ALWAYS_CC);
    sheet.getRange(r + 1, track['Client Last Reminded'] + 1).setValue(now.toISOString());
    sheet.getRange(r + 1, track['Client Reminder Count'] + 1).setValue(count + 1);
    sent++;
  }
  Logger.log('Client progress reminders: %s sent.%s', sent, RRB_DRY_RUN ? ' [DRY RUN]' : '');
  return { sent: sent };
}

/**
 * Run this ONCE, right after taking RRB_DRY_RUN off.
 *
 * The reminder loops are correctly throttled — one chase per case per day, one
 * client nudge every few days, a hard cap on both. But every throttle reads a
 * stamp written when a message was last sent, and during the dry-run period no
 * message was ever sent, so no stamp was ever written. The first live run would
 * therefore treat every open case as never-contacted and chase all of them at
 * once: a 54-day-old case and one submitted this morning, in the same burst,
 * to real clients.
 *
 * This stamps every currently-open case as contacted today without sending
 * anything. Normal pacing resumes from now, and nothing is backfilled.
 */
function rrbSuppressBacklog() {
  var sheet = ffGetOrCreateRevisedTab_();
  if (sheet.getLastRow() < 2) { Logger.log('No cases — nothing to suppress.'); return { stamped: 0 }; }
  var values = sheet.getDataRange().getValues();
  var headers = values[0].map(String);
  var now = new Date(), stamped = 0, skipped = 0;

  var iStatus   = headers.indexOf('status');
  var cReminded = headers.indexOf('lastReminderAt');
  var cClient   = headers.indexOf('Client Last Reminded');
  if (iStatus < 0) { Logger.log('No status column — aborting rather than guessing.'); return { stamped: 0 }; }

  for (var r = 1; r < values.length; r++) {
    var status = _str(values[r][iStatus]).toLowerCase();
    var settled = status.indexOf('approved') > -1 || status.indexOf('declin') > -1 ||
                  status.indexOf('cancel') > -1;
    if (settled) { skipped++; continue; }
    if (cReminded >= 0) sheet.getRange(r + 1, cReminded + 1).setValue(now.toISOString());
    if (cClient   >= 0) sheet.getRange(r + 1, cClient   + 1).setValue(now.toISOString());
    stamped++;
  }
  Logger.log('Backlog suppressed: %s open case(s) stamped as contacted today, %s already settled. ' +
             'No mail sent. Reminders resume on their normal cadence from here.', stamped, skipped);
  return { stamped: stamped, skipped: skipped };
}

// Run once to install the daily 10am check (it self-paces to every 3 days
// per case via the stamps above).
function rrbInstallClientReminderTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'rrbSendClientProgressReminders') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('rrbSendClientProgressReminders')
    .timeBased().atHour(10).everyDays(1).inTimezone('America/Port_of_Spain').create();
  Logger.log('Client progress reminder trigger installed for 10:00. Every %s days per case, max %s.',
             RRB_CLIENT_REMINDER_EVERY_DAYS, RRB_CLIENT_REMINDER_MAX);
  return 'Installed.';
}