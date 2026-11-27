/**
 * Earthling and Angel 2026 — the branch's Christmas gift exchange.
 *
 * Its own Apps Script project, bound to its own Google Sheet ("Earthling and Angel 2026"). The page is
 * rickyrampersadbranch.com/angels/ and talks to this script's /exec address (CONFIG.API in angels/index.html).
 *
 * How it runs
 *   Sign up      to Fri 20 Nov 2026, 12:00 noon. Sign in with an agent number (or a name for staff) plus the team passcode, then add a wish list.
 *   The draw     Fri 20 Nov, 2:00 pm (a trigger, or "Run the draw now" on the page). One random circle: everyone gives to
 *                the next, so nobody draws themselves and no two people draw each other. Each Angel is e-mailed their Earthling.
 *   Angel notes  After the draw an Angel may send their Earthling anonymous notes from the page. The Earthling gets an e-mail
 *                saying a note is waiting; the Angel's name is never in it. The Branch Manager sees every note.
 *   The luncheon Fri 11 Dec 2026, the Christmas luncheon. Gifts are exchanged and Angels revealed. "Reveal the Angels" on
 *                the page (Branch Manager) shows each person who their Angel was.
 *   Limit        TT$300 a gift.
 *
 * Setup
 *   1. Make a Google Sheet "Earthling and Angel 2026" under the support@ Workspace account, Extensions → Apps Script,
 *      paste this file.
 *   2. Script property TEAM_SHEET_ID = the Service Questionnaire sheet's ID (it holds the Agent Skill Bank).
 *   3. Run setupAngels(): makes the tabs, copies everyone active on the Agent Skill Bank to People, installs the draw trigger.
 *      Check People: set Include to N for anyone who should not take part, add anyone missing.
 *   4. Deploy → New deployment → Web app, Execute as Me, Anyone. Put the /exec address in angels/index.html (CONFIG.API).
 *   4b. Script properties ANGELS_CODE (the team passcode, shared in the branch group) and ANGELS_ADMIN_CODE (the Branch Manager's own).
       Until ANGELS_CODE is set nobody can sign in.
   5. ?action=ping from a browser answers with the phase and the counts.
 *
 * Nothing about a person is ever sent to a browser except: their own wish list, their Earthling's name and wish list after the
 * draw, the notes sent to them, and (after the reveal) their Angel's name.
 */

var ANG = {
  VERSION: '2026-11-26a',
  YEAR: 2026,
  LIMIT: 'TT$300',
  CLOSE: '2026-11-20T12:00:00-04:00',   // sign-up closes
  DRAW: '2026-11-20T14:00:00-04:00',    // the draw
  LUNCH: '2026-12-11',                  // Friday, Christmas luncheon
  LUNCH_WORDS: 'Friday 11 December 2026',
  VENUE: 'The venue is to be advised.',   // replace with the venue once it is booked
  PAGE: 'https://rickyrampersadbranch.com/angels/',
  LOGO: 'https://rickyrampersadbranch.com/logo-mark.png',
  TABS: {
    PEOPLE: ['Key', 'Name', 'Agent No', 'E-mail', 'Role', 'Include'],
    ENTRIES: ['Key', 'Name', 'Joined', 'Wish 1', 'Wish 2', 'Wish 3', 'Likes', 'Avoid', 'Sizes', 'Updated'],
    PAIRS: ['Angel key', 'Angel', 'Earthling key', 'Earthling', 'Drawn', 'E-mailed'],
    NOTES: ['When', 'From key', 'From', 'To key', 'To', 'Note', 'E-mailed'],
    LOG: ['When', 'Who', 'What']
  },
  NOTE_MAX: 500,
  NOTES_A_DAY: 6,
  TOKEN_HOURS: 6,
  MAX_TRIES: 5,      // wrong sign-ins per person before a lock
  MAX_ALL: 40,       // wrong sign-ins across the whole page before a lock
  LOCK_MIN: 15,
  ADMIN_ROLES: /branch manager|assistant branch manager|bma/i
};

// ---------- sheet ----------

function angSS_() { return SpreadsheetApp.getActiveSpreadsheet(); }

function angTab_(name) {
  var ss = angSS_(), sh = ss.getSheetByName(name), head = ANG.TABS[name.toUpperCase()];
  if (!sh) { sh = ss.insertSheet(name); sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold'); sh.setFrozenRows(1); }
  return sh;
}

function angRows_(name) {
  var sh = angTab_(name), v = sh.getDataRange().getValues(), head = v.shift() || [];
  return v.filter(function (r) { return r.join('') !== ''; }).map(function (r, i) {
    var o = { _row: i + 2 };
    head.forEach(function (h, j) { o[h] = r[j] instanceof Date ? r[j] : (r[j] === null || r[j] === undefined ? '' : String(r[j]).trim()); });
    return o;
  });
}

function angAppend_(name, obj) {
  var sh = angTab_(name), head = ANG.TABS[name.toUpperCase()];
  var row = head.map(function (h) { var v = obj[h]; return v === undefined ? '' : v; });
  sh.getRange(sh.getLastRow() + 1, 1, 1, row.length).setValues([row.map(function (x) { return x instanceof Date ? x : String(x); })]);
}

function angLog_(who, what) { try { angAppend_('Log', { When: new Date(), Who: who || '', What: what }); } catch (e) {} }

// ---------- people ----------

function angKey_(s) { return String(s || '').toLowerCase().replace(/^[a-z]?\d+\s*-\s*/i, '').replace(/\([^)]*\)/g, ' ').replace(/[^a-z ]/g, ' ').replace(/\s+/g, ' ').trim(); }
function angNo_(s) { var x = String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); var m = x.match(/^[A-Z]{1,2}(\d+)$/); return (m ? m[1] : x).replace(/^0+/, ''); }
function angFirst_(n) { return String(n || '').trim().split(/\s+/)[0] || ''; }
function angNice_(n) { return String(n || '').toLowerCase().replace(/\b[a-z]/g, function (c) { return c.toUpperCase(); }); }

function angPeople_() {
  return angRows_('People').filter(function (p) { return p.Name && !/^n/i.test(p.Include); })
    .map(function (p) { return { key: p.Key || angKey_(p.Name), name: p.Name, no: p['Agent No'], email: p['E-mail'], role: p.Role || '' }; });
}

/** Sign in: an agent number, or a full name, or a first name only one person carries. */
function angFind_(typed) {
  var t = String(typed || '').trim(); if (!t) return null;
  var ppl = angPeople_(), n = angNo_(t), k = angKey_(t);
  if (/\d/.test(t) && n) { var byNo = ppl.filter(function (p) { return p.no && angNo_(p.no) === n; }); if (byNo.length === 1) return byNo[0]; }
  var full = ppl.filter(function (p) { return angKey_(p.name) === k; }); if (full.length === 1) return full[0];
  if (k && k.indexOf(' ') < 0) { var first = ppl.filter(function (p) { return angKey_(p.name).split(' ')[0] === k; }); if (first.length === 1) return first[0]; }
  // first name and surname, with a middle name or a married name either side
  var parts = k.split(' ');
  if (parts.length >= 2) { var loose = ppl.filter(function (p) { var q = angKey_(p.name).split(' '); return q[0] === parts[0] && parts.slice(1).every(function (w) { return q.indexOf(w) > 0; }); }); if (loose.length === 1) return loose[0]; }
  return null;
}

function angIsAdmin_(p) {
  if (!p) return false;
  var extra = String(PropertiesService.getScriptProperties().getProperty('ANGELS_ADMINS') || 'ricky rampersad').toLowerCase().split(/\s*,\s*/);
  return ANG.ADMIN_ROLES.test(p.role) || extra.indexOf(angKey_(p.name)) >= 0;
}

// ---------- tokens ----------

function angToken_(p) {
  var tok = Utilities.getUuid().replace(/-/g, '');
  CacheService.getScriptCache().put('ang_' + tok, p.key, ANG.TOKEN_HOURS * 3600);
  return tok;
}
function angWho_(tok) {
  if (!tok) return null;
  var key = CacheService.getScriptCache().get('ang_' + String(tok).replace(/[^a-f0-9]/gi, ''));
  if (!key) return null;
  return angPeople_().filter(function (p) { return p.key === key; })[0] || null;
}

// ---------- phase ----------

function angProp_(k, v) { var P = PropertiesService.getScriptProperties(); if (v === undefined) return P.getProperty(k); if (v === null) P.deleteProperty(k); else P.setProperty(k, v); }
function angPhase_() {
  if (angProp_('ANGELS_REVEALED')) return 'revealed';
  if (angProp_('ANGELS_DRAWN')) return 'drawn';
  return new Date() >= new Date(ANG.CLOSE) ? 'closed' : 'open';
}

// ---------- the draw ----------

/** One random circle: each Angel gives to the next person, the last to the first. Nobody draws themselves and,
 *  with three or more, no two people draw each other. */
function angCircle_(keys) {
  var a = keys.slice();
  for (var i = a.length - 1; i > 0; i--) { var j = Math.floor(Math.random() * (i + 1)); var t = a[i]; a[i] = a[j]; a[j] = t; }
  return a.map(function (k, i) { return [k, a[(i + 1) % a.length]]; });
}

function angDraw_(by) {
  var lock = LockService.getScriptLock(); if (!lock.tryLock(20000)) return { ok: false, error: 'Busy. Try again in a minute.' };
  try {
    if (angProp_('ANGELS_DRAWN')) return { ok: false, error: 'The draw has already been run.' };
    var ppl = angPeople_(), byKey = {}; ppl.forEach(function (p) { byKey[p.key] = p; });
    var joined = angRows_('Entries').filter(function (e) { return /^y/i.test(e.Joined) && byKey[e.Key]; }).map(function (e) { return e.Key; });
    if (joined.length < 3) return { ok: false, error: 'Only ' + joined.length + ' have joined. The draw needs at least 3.' };
    var pairs = angCircle_(joined), now = new Date();
    pairs.forEach(function (pr) { angAppend_('Pairs', { 'Angel key': pr[0], Angel: byKey[pr[0]].name, 'Earthling key': pr[1], Earthling: byKey[pr[1]].name, Drawn: now, 'E-mailed': '' }); });
    angProp_('ANGELS_DRAWN', now.toISOString());
    angLog_(by || 'trigger', 'draw: ' + pairs.length + ' Angels');
    var sent = angDrawMails_();
    return { ok: true, angels: pairs.length, mailed: sent };
  } finally { lock.releaseLock(); }
}

function angDrawMails_() {
  var ppl = {}; angPeople_().forEach(function (p) { ppl[p.key] = p; });
  var wishes = angWishes_(), sh = angTab_('Pairs'), n = 0;
  angRows_('Pairs').forEach(function (r) {
    if (r['E-mailed']) return;
    var me = ppl[r['Angel key']], them = ppl[r['Earthling key']]; if (!me || !me.email || !them) return;
    try {
      MailApp.sendEmail({ to: me.email, subject: 'Your Earthling for ' + ANG.YEAR + ' (keep it secret)', name: 'Ricky Rampersad Branch',
        htmlBody: angMail_('Your Earthling is ' + angEsc_(them.name),
          '<p>Dear ' + angEsc_(angFirst_(me.name)) + ',</p><p>The draw is done. You are the Angel for <b>' + angEsc_(them.name) + '</b>. Keep it to yourself until the luncheon.</p>' +
          angWishHtml_(wishes[them.key]) +
          '<p>Gift limit: <b>' + ANG.LIMIT + '</b>. Bring it, wrapped and labelled with your Earthling\'s name, to the Christmas luncheon on <b>' + ANG.LUNCH_WORDS + '</b>. ' + ANG.VENUE + '</p>' +
          '<p>Between now and then you can send ' + angEsc_(angFirst_(them.name)) + ' anonymous notes from the page. They will not know it is you.</p>',
          'Open my page', ANG.PAGE) });
      sh.getRange(r._row, 6).setValue(new Date()); n++;
    } catch (e) { angLog_('mail', 'draw mail failed for ' + r.Angel + ': ' + e); }
  });
  return n;
}

function angWishes_() {
  var out = {}; angRows_('Entries').forEach(function (e) { out[e.Key] = e; }); return out;
}

// ---------- mail ----------

function angEsc_(s) { return String(s === undefined || s === null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

function angWishHtml_(e) {
  if (!e) return '<p style="color:#5b6670">Their wish list is not in yet. It will show on your page when it is.</p>';
  var w = [e['Wish 1'], e['Wish 2'], e['Wish 3']].filter(String);
  return '<table role="presentation" style="width:100%;border-collapse:collapse;background:#f4f8f6;border-left:4px solid #1f5f4a;margin:12px 0"><tr><td style="padding:12px 16px;font-size:14px;line-height:1.6">' +
    '<b style="color:#1f5f4a">Their wish list</b><br>' + (w.length ? w.map(function (x, i) { return (i + 1) + '. ' + angEsc_(x); }).join('<br>') : 'Nothing listed yet.') +
    (e.Likes ? '<br><b>Likes:</b> ' + angEsc_(e.Likes) : '') + (e.Avoid ? '<br><b>Please avoid:</b> ' + angEsc_(e.Avoid) : '') + (e.Sizes ? '<br><b>Sizes:</b> ' + angEsc_(e.Sizes) : '') +
    '</td></tr></table>';
}

function angMail_(title, body, btn, url) {
  return '<div style="background:#faf9f2;padding:24px 0;font-family:Arial,Helvetica,sans-serif"><table role="presentation" align="center" style="width:600px;max-width:100%;background:#fff;border:1px solid #e4e0d4;border-collapse:collapse">' +
    '<tr><td style="background:#0d3f5e;padding:18px 24px"><img src="' + ANG.LOGO + '" width="40" height="40" alt="" style="vertical-align:middle;border-radius:6px"> ' +
    '<span style="color:#fff;font-size:15px;font-weight:bold;vertical-align:middle;margin-left:8px">Ricky Rampersad Branch · Earthling and Angel ' + ANG.YEAR + '</span></td></tr>' +
    '<tr><td style="height:4px;background:#a4243b"></td></tr>' +
    '<tr><td style="padding:24px;color:#2b3b47;font-size:15px;line-height:1.6"><h1 style="margin:0 0 12px;font-size:22px;color:#0d3f5e">' + title + '</h1>' + body +
    (btn ? '<p style="margin:20px 0 4px"><a href="' + url + '" style="background:#1f5f4a;color:#fff;text-decoration:none;padding:12px 22px;border-radius:6px;font-weight:bold;display:inline-block">' + btn + '</a></p>' : '') +
    '</td></tr><tr><td style="padding:14px 24px;background:#f7f6f0;color:#5b6670;font-size:12px">Internal to the Ricky Rampersad Branch, Guardian Life of the Caribbean. Christmas luncheon, ' + ANG.LUNCH_WORDS + '.</td></tr></table></div>';
}

// ---------- the API ----------

function doGet(e) { return angOut_(angRoute_((e && e.parameter) || {})); }
function doPost(e) {
  var p = {}; try { p = JSON.parse((e && e.postData && e.postData.contents) || '{}'); } catch (x) {}
  return angOut_(angRoute_(p));
}
function angOut_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }

function angRoute_(p) {
  try {
    var a = String(p.action || 'ping');
    if (a === 'ping') return angPing_();
    if (a === 'login') return angLogin_(p);
    var me = angWho_(p.t); if (!me) return { ok: false, signin: true, error: 'Please sign in again.' };
    if (a === 'me') return angMe_(me);
    if (a === 'join') return angJoin_(me, p);
    if (a === 'note') return angNote_(me, p);
    if (!angIsAdmin_(me)) return { ok: false, error: 'That is for the Branch Manager.' };
    if (a === 'admin') return angAdmin_(me);
    if (a === 'draw') return angDraw_(me.name);
    if (a === 'reveal') { if (!angProp_('ANGELS_DRAWN')) return { ok: false, error: 'Run the draw first.' }; angProp_('ANGELS_REVEALED', new Date().toISOString()); angLog_(me.name, 'reveal'); return angAdmin_(me); }
    if (a === 'remind') return angRemind_(me);
    return { ok: false, error: 'Unknown action.' };
  } catch (err) { return { ok: false, error: String(err && err.message || err) }; }
}

function angPing_() {
  var ppl = angPeople_(), joined = angRows_('Entries').filter(function (e) { return /^y/i.test(e.Joined); }).length;
  return { ok: true, service: 'earthling-angel', version: ANG.VERSION, phase: angPhase_(), people: ppl.length, joined: joined,
    close: ANG.CLOSE, draw: ANG.DRAW, lunch: ANG.LUNCH, limit: ANG.LIMIT };
}

/**
 * Sign-in needs two things: who you are (an agent number or a name) AND the team passcode (script property ANGELS_CODE).
 * The Branch Manager's account also needs ANGELS_ADMIN_CODE, because it can run the draw and see every note.
 * Names are not secrets, so a name alone never opens anything. With no code set, nobody signs in (fail closed).
 * Wrong tries are counted per person and for the whole page, and lock for ANG.LOCK_MIN minutes.
 * Every refusal reads the same, so the page never says whether a name exists.
 */
function angSame_(a, b) {
  a = String(a || ''); b = String(b || ''); var d = a.length ^ b.length;
  for (var i = 0; i < Math.max(a.length, b.length); i++) d |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  return d === 0;
}
function angTries_(k) { return Number(CacheService.getScriptCache().get('angt_' + k) || 0); }
function angFail_(k) { var c = CacheService.getScriptCache(); c.put('angt_' + k, String(angTries_(k) + 1), ANG.LOCK_MIN * 60); }
function angLogin_(p) {
  var typed = String(p.id || '').slice(0, 80), code = String(p.code || '').slice(0, 80);
  var P = PropertiesService.getScriptProperties(), team = P.getProperty('ANGELS_CODE'), adm = P.getProperty('ANGELS_ADMIN_CODE');
  if (!team) return { ok: false, error: 'Sign-in is not switched on yet. Speak to the Branch Manager.' };
  var ident = angKey_(typed) + '|' + angNo_(typed);
  if (angTries_('all') >= ANG.MAX_ALL || angTries_(ident) >= ANG.MAX_TRIES)
    return { ok: false, error: 'Too many tries. Wait ' + ANG.LOCK_MIN + ' minutes and try again.' };
  var who = angFind_(typed), bad = { ok: false, error: 'That did not match. Check your agent number or name and the passcode.' };
  var need = who && angIsAdmin_(who) ? adm : team;   // the manager's account needs the manager passcode, everyone else the team one
  if (!who || !need || !angSame_(code, need)) { angFail_('all'); angFail_(ident); angLog_(who ? who.name : (typed ? 'unknown' : ''), 'sign-in refused'); return bad; }
  angLog_(who.name, 'sign-in');
  return angMe_(who, angToken_(who));
}

function angMe_(me, tok) {
  var phase = angPhase_(), wishes = angWishes_(), mine = wishes[me.key] || null;
  var out = { ok: true, t: tok || undefined, phase: phase, name: me.name, first: angFirst_(me.name), admin: angIsAdmin_(me),
    limit: ANG.LIMIT, close: ANG.CLOSE, draw: ANG.DRAW, lunch: ANG.LUNCH, lunchWords: ANG.LUNCH_WORDS,
    joined: !!(mine && /^y/i.test(mine.Joined)),
    wish: mine ? { w1: mine['Wish 1'], w2: mine['Wish 2'], w3: mine['Wish 3'], likes: mine.Likes, avoid: mine.Avoid, sizes: mine.Sizes } : null,
    counts: angPing_() };
  if (phase === 'drawn' || phase === 'revealed') {
    var pairs = angRows_('Pairs'), mineP = pairs.filter(function (r) { return r['Angel key'] === me.key; })[0], myAngel = pairs.filter(function (r) { return r['Earthling key'] === me.key; })[0];
    if (mineP) { var w = wishes[mineP['Earthling key']]; out.earthling = { name: mineP.Earthling, wish: w ? { w1: w['Wish 1'], w2: w['Wish 2'], w3: w['Wish 3'], likes: w.Likes, avoid: w.Avoid, sizes: w.Sizes } : null }; }
    var notes = angRows_('Notes');
    out.notesIn = notes.filter(function (n) { return n['To key'] === me.key; }).map(function (n) { return { at: angWhen_(n.When), text: n.Note }; });
    out.notesOut = notes.filter(function (n) { return n['From key'] === me.key; }).map(function (n) { return { at: angWhen_(n.When), text: n.Note }; });
    if (phase === 'revealed' && myAngel) out.angel = myAngel.Angel;
  }
  return out;
}

function angWhen_(d) { try { return Utilities.formatDate(d instanceof Date ? d : new Date(d), 'America/Port_of_Spain', 'EEE d MMM, h:mm a'); } catch (e) { return ''; } }

function angClean_(s, n) { return String(s || '').replace(/[\u0000-\u001f]+/g, ' ').replace(/^[=+\-@]/, "'$&").trim().slice(0, n || 120); }

function angJoin_(me, p) {
  if (angPhase_() !== 'open' && !angIsAdmin_(me)) return { ok: false, error: 'Sign-up closed at 12 noon on Friday 20 November.' };
  var w1 = angClean_(p.w1), w2 = angClean_(p.w2), w3 = angClean_(p.w3);
  if (!w1) return { ok: false, error: 'Please give at least one wish.' };
  var lock = LockService.getScriptLock(); lock.waitLock(15000);
  try {
    var sh = angTab_('Entries'), ex = angRows_('Entries').filter(function (e) { return e.Key === me.key; })[0];
    var row = [me.key, me.name, 'Yes', w1, w2, w3, angClean_(p.likes, 200), angClean_(p.avoid, 200), angClean_(p.sizes, 120), new Date()];
    if (ex) sh.getRange(ex._row, 1, 1, row.length).setValues([row]);
    else sh.getRange(sh.getLastRow() + 1, 1, 1, row.length).setValues([row]);
  } finally { lock.releaseLock(); }
  angLog_(me.name, 'joined / wish list saved');
  return angMe_(me);
}

function angNote_(me, p) {
  var ph = angPhase_(); if (ph !== 'drawn' && ph !== 'revealed') return { ok: false, error: 'Notes open after the draw.' };
  var text = angClean_(p.text, ANG.NOTE_MAX); if (text.length < 3) return { ok: false, error: 'Write a note first.' };
  var mineP = angRows_('Pairs').filter(function (r) { return r['Angel key'] === me.key; })[0]; if (!mineP) return { ok: false, error: 'You are not in the draw.' };
  var today = Utilities.formatDate(new Date(), 'America/Port_of_Spain', 'yyyy-MM-dd');
  var sentToday = angRows_('Notes').filter(function (n) { return n['From key'] === me.key && Utilities.formatDate(n.When instanceof Date ? n.When : new Date(n.When), 'America/Port_of_Spain', 'yyyy-MM-dd') === today; }).length;
  if (sentToday >= ANG.NOTES_A_DAY) return { ok: false, error: 'That is ' + ANG.NOTES_A_DAY + ' notes today. Save the rest for tomorrow.' };
  var to = angPeople_().filter(function (x) { return x.key === mineP['Earthling key']; })[0];
  var mailed = '';
  if (to && to.email) {
    try {
      MailApp.sendEmail({ to: to.email, subject: 'A note from your Angel', name: 'Your Angel',
        htmlBody: angMail_('Your Angel has written to you', '<p>Dear ' + angEsc_(angFirst_(to.name)) + ',</p><p>Someone in the branch is your Angel this Christmas, and they have left you a note:</p>' +
          '<blockquote style="margin:14px 0;padding:12px 16px;background:#fbf1f3;border-left:4px solid #a4243b;font-size:16px">' + angEsc_(text) + '</blockquote>' +
          '<p>Who is it? You will find out at the Christmas luncheon on ' + ANG.LUNCH_WORDS + '.</p>', 'See my notes', ANG.PAGE) });
      mailed = new Date();
    } catch (e) { angLog_('mail', 'note mail failed: ' + e); }
  }
  angAppend_('Notes', { When: new Date(), 'From key': me.key, From: me.name, 'To key': mineP['Earthling key'], To: mineP.Earthling, Note: text, 'E-mailed': mailed });
  return angMe_(me);
}

function angAdmin_(me) {
  var ppl = angPeople_(), entries = angWishes_(), out = angMe_(me);
  out.roster = ppl.map(function (p) { var e = entries[p.key]; return { name: p.name, joined: !!(e && /^y/i.test(e.Joined)), email: !!p.email }; })
    .sort(function (a, b) { return (a.joined - b.joined) || a.name.localeCompare(b.name); });
  out.notes = angRows_('Notes').map(function (n) { return { at: angWhen_(n.When), from: n.From, to: n.To, text: n.Note }; }).reverse().slice(0, 100);
  out.drawnAt = angProp_('ANGELS_DRAWN') || ''; out.revealedAt = angProp_('ANGELS_REVEALED') || '';
  return out;
}

function angRemind_(me) {
  var entries = angWishes_(), n = 0;
  angPeople_().forEach(function (p) {
    var e = entries[p.key]; if ((e && /^y/i.test(e.Joined)) || !p.email) return;
    try {
      MailApp.sendEmail({ to: p.email, subject: 'Earthling and Angel ' + ANG.YEAR + ': join by 12 noon on Friday', name: 'Ricky Rampersad Branch',
        htmlBody: angMail_('Join the Earthling and Angel exchange', '<p>Dear ' + angEsc_(angFirst_(p.name)) + ',</p><p>Our Christmas luncheon is on <b>' + ANG.LUNCH_WORDS + '</b>, with the Earthling and Angel gift exchange. ' + ANG.VENUE + ' Sign-up closes at <b>12 noon on Friday 20 November</b>, and the draw is at 2:00 pm.</p><p>It takes a minute: sign in with your agent number (staff: your name) and list three gift ideas. Gift limit ' + ANG.LIMIT + '.</p>', 'Join now', ANG.PAGE) });
      n++;
    } catch (x) {}
  });
  angLog_(me.name, 'reminder to ' + n);
  var o = angAdmin_(me); o.reminded = n; return o;
}

// ---------- setup and triggers ----------

/** Run once from the editor. */
function setupAngels() {
  Object.keys(ANG.TABS).forEach(function (k) { angTab_(k.charAt(0) + k.slice(1).toLowerCase()); });
  var added = angPullRoster_();
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'angelsAutoDraw') ScriptApp.deleteTrigger(t); });
  if (new Date(ANG.DRAW) > new Date()) ScriptApp.newTrigger('angelsAutoDraw').timeBased().at(new Date(ANG.DRAW)).create();
  var msg = 'Tabs ready. ' + added + ' people added from the Agent Skill Bank. Draw trigger set for Fri 20 Nov, 2:00 pm. Check the People tab.';
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) {}
  return msg;
}

/** Copies everyone active on the Agent Skill Bank onto People, leaving rows already there as they are. */
function angPullRoster_() {
  var id = angProp_('TEAM_SHEET_ID'); if (!id) return 0;
  var sh = SpreadsheetApp.openById(id).getSheetByName(angProp_('TEAM_SHEET_TAB') || 'Agent Skill Bank'); if (!sh) return 0;
  var v = sh.getDataRange().getValues(), head = v.shift().map(function (h) { return String(h).trim().toLowerCase(); });
  var col = function (r, names) { for (var i = 0; i < head.length; i++) if (names.indexOf(head[i]) >= 0 && String(r[i]).trim()) return String(r[i]).trim(); return ''; };
  var actives = function (r) { return head.every(function (h, i) { return h !== 'active' || !/^(no|not active|inactive|resigned|terminated)$/i.test(String(r[i]).trim()); }); };
  var have = {}; angRows_('People').forEach(function (p) { have[p.Key || angKey_(p.Name)] = 1; });
  var n = 0;
  v.forEach(function (r) {
    var name = col(r, ['agent', 'name']).replace(/^[A-Z]?\d+\s*-\s*/i, ''); if (!name || !actives(r)) return;
    name = /[a-z]/.test(name) ? name : angNice_(name);
    var key = angKey_(name); if (have[key]) return; have[key] = 1;
    angAppend_('People', { Key: key, Name: name, 'Agent No': col(r, ['agent no.', 'agent number', 'agent no']), 'E-mail': col(r, ['email', 'e-mail']), Role: col(r, ['role']) || 'Agent', Include: 'Y' });
    n++;
  });
  return n;
}

function angelsAutoDraw() { var r = angDraw_('trigger'); angLog_('trigger', JSON.stringify(r)); }

function onOpen() {
  try { SpreadsheetApp.getUi().createMenu('Earthling and Angel').addItem('Set up / refresh the roster', 'setupAngels').addItem('Run the draw now', 'angelsDrawNow').addItem('Reveal the Angels', 'angelsRevealNow').addToUi(); } catch (e) {}
}
function angelsDrawNow() { var r = angDraw_('menu'); try { SpreadsheetApp.getUi().alert(JSON.stringify(r)); } catch (e) {} return r; }
function angelsRevealNow() { angProp_('ANGELS_REVEALED', new Date().toISOString()); angLog_('menu', 'reveal'); }
