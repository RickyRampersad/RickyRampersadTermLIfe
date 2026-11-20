/* ─────────────── Advice on one need, asked for on WhatsApp (HELP 868) ───────────────
 *  Built 20 November 2026. Asked for by Ricky: "can a fact find be done on the WhatsApp", then, on being told the whole fact
 *  find belongs to the advisor's own conversation, "what about with just only product advise" and "yes".
 *
 *  The fact find already has that path: "Specific Need Only" (appType = advice). It skips the data-gathering sections and asks
 *  the client's name, phone, e-mail and the need. That much is gathered on WhatsApp by the respond.io workflow
 *  "HELP 868 — Advice on one need", after the client has read the Insurance Act notice and chosen advice on one need over a
 *  full review. The advice itself (the recommendation, the client's decision, the replacement question) is never given on
 *  WhatsApp: a licensed advisor does it in the fact find, and the PDF, the client's draft e-mail, the confirm-and-sign page and
 *  the manager's review follow exactly as for any fact find.
 *
 *  Two actions, under the q. prefix the live Service.gs already routes to Quotes.gs, so this file is the only paste:
 *    q.advice     POST from respond.io, carrying `key` (the HELP868_KEY Script property, the key the HELP 868 workflows send).
 *                 Files a row on the "Advice Intake" tab with a reference (ADV-yyMMdd-nnn), e-mails the owner (HELP868_OWNER,
 *                 else the first TRANSITION.CC address) a link that opens the fact find already filled in, and answers {ok, ref}.
 *    q.adviceget  GET from the fact find (factfind360.com/ffproject?intake=<ref>&s=<sig>). The signature is the only key: it is
 *                 an HMAC of the reference under ADVICE_LINK_SECRET, which this file makes itself the first time. It answers the
 *                 client's details for that one request, and nothing for any other reference, a wrong signature, a request older
 *                 than LINK_DAYS, or one marked Closed.
 *
 *  It takes no health detail and no figure beyond the cover the client has in mind, chosen from bands.
 *  Rows are found by reference, never by row number. A value starting = + - @ is written as text. */
var ADV = {
  TAB: 'Advice Intake',
  HEAD: ['Reference', 'When', 'Status', 'Choice', 'Client', 'WhatsApp', 'E-mail', 'Need', 'Cover in mind', 'Best time',
         'Advisor named', 'Notice accepted', 'respond.io contact', 'Owner told', 'Opened in fact find'],
  NEEDS: ['Life cover for my family', 'Cover for my mortgage', 'Critical illness cover', 'Retirement or pension',
          "Children's education", 'Health cover', 'Personal accident', 'Savings or investment', 'Something else'],
  COVERS: ['Under TT$250,000', 'TT$250,000 to TT$500,000', 'TT$500,000 to TT$1m', 'Over TT$1m', 'Not sure yet'],  // WhatsApp list rows hold 24 characters
  TIMES: ['Morning', 'Afternoon', 'Evening'],
  FF: 'https://factfind360.com/ffproject',
  PER_DAY: 4, DUPE_MIN: 15, LINK_DAYS: 60, VERSION: '2026-11-20a'
};

/* Plug into Quotes.gs's two routes. This file must load after Quotes.gs: a new file in the editor does. */
quoteDoPost_ = (function (base) {
  if (base && base.__adv) return base;
  var f = function (body) { var a = String((body && body.action) || ''); if (a === 'q.advice') return adviceIntake_(body); return base(body); };
  f.__adv = true; return f;
})(typeof quoteDoPost_ === 'function' ? quoteDoPost_ : function () { return { ok: false, error: 'Unknown action' }; });
quoteDoGet_ = (function (base) {
  if (base && base.__adv) return base;
  var f = function (p) {
    var a = String((p && p.action) || '');
    if (a === 'q.adviceget') return adviceGet_(p);
    if (a === 'q.adviceping') return { ok: true, advice: ADV.VERSION, keySet: adviceProp_('HELP868_KEY').length >= 16, owner: !!adviceOwner_() };
    return base(p);
  };
  f.__adv = true; return f;
})(typeof quoteDoGet_ === 'function' ? quoteDoGet_ : function () { return { ok: false, error: 'Unknown action' }; });

function adviceProp_(k) { try { return String(PropertiesService.getScriptProperties().getProperty(k) || '').trim(); } catch (e) { return ''; } }
function adviceTz_() { try { return Session.getScriptTimeZone() || 'America/Port_of_Spain'; } catch (e) { return 'America/Port_of_Spain'; } }
function adviceEsc_(s) { return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function adviceText_(s, max) {
  var t = String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max || 120);
  if (/^\{\{.*\}\}$/.test(t)) t = '';                 // a respond.io placeholder that was never filled
  return /^[=+\-@]/.test(t) ? "'" + t : t;
}
function advicePick_(s, list) { var t = adviceText_(s, 80); for (var i = 0; i < list.length; i++) if (list[i].toLowerCase() === t.toLowerCase()) return list[i]; return ''; }
function adviceDigits_(s) { var d = String(s == null ? '' : s).replace(/\D/g, ''); return d.length >= 7 ? d.slice(-10) : ''; }
function adviceEmail_(s) { var t = adviceText_(s, 120).toLowerCase(); return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/.test(t) ? t : ''; }
function adviceKeyOk_(key) {
  var want = adviceProp_('HELP868_KEY'), got = String(key || '');
  if (want.length < 16 || want.length !== got.length) return false;
  var d = 0; for (var i = 0; i < want.length; i++) d |= want.charCodeAt(i) ^ got.charCodeAt(i);
  return d === 0;
}
function adviceOwner_() {
  var o = adviceProp_('HELP868_OWNER'); if (o) return o;
  try { return String((TRANSITION.CC || [])[0] || ''); } catch (e) { return ''; }
}
function adviceSecret_() {
  var p = PropertiesService.getScriptProperties(), s = p.getProperty('ADVICE_LINK_SECRET');
  if (!s) { s = Utilities.getUuid() + Utilities.getUuid(); p.setProperty('ADVICE_LINK_SECRET', s); }
  return s;
}
function adviceSig_(ref) {
  var b = Utilities.computeHmacSha256Signature(String(ref), adviceSecret_());
  return Utilities.base64EncodeWebSafe(b).replace(/=+$/, '').slice(0, 32);
}
function adviceSheet_() {
  var ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getSheetByName(ADV.TAB);
  if (!sh) { sh = ss.insertSheet(ADV.TAB); sh.appendRow(ADV.HEAD); sh.setFrozenRows(1); sh.getRange(1, 1, 1, ADV.HEAD.length).setFontWeight('bold'); }
  return sh;
}
function adviceRate_(digits) {
  try {
    var c = CacheService.getScriptCache(), k = 'adv_' + digits, n = Number(c.get(k) || 0) + 1;
    if (n > ADV.PER_DAY) return false;
    c.put(k, String(n), 21600); return true;
  } catch (e) { return true; }
}

/** q.advice: one request from WhatsApp. */
function adviceIntake_(b) {
  if (!adviceKeyOk_(b.key)) return { ok: false, error: 'Not allowed.' };
  var digits = adviceDigits_(b.phone);
  if (!digits) return { ok: false, error: 'No WhatsApp number was sent.' };
  if (!adviceRate_(digits)) return { ok: false, error: 'Too many requests from this number today. A person will follow up.' };
  var choice = /^full/i.test(String(b.choice || '')) ? 'Full review' : 'Advice on one need';
  var name = adviceText_(b.name, 80), need = advicePick_(b.need, ADV.NEEDS) || adviceText_(b.need, 80);
  if (!name) return { ok: false, error: 'No name was given.' };
  var row = {
    choice: choice, name: name, email: adviceEmail_(b.email), need: choice === 'Full review' ? '' : need,
    cover: advicePick_(b.cover, ADV.COVERS), time: advicePick_(b.time, ADV.TIMES), advisor: adviceText_(b.advisor, 60),
    notice: /^(yes|true|accepted|1)$/i.test(String(b.notice || '')) ? 'Yes' : 'No', contact: adviceText_(b.rcontact, 30)
  };
  if (/^(no|none|n\/a|-)$/i.test(row.advisor)) row.advisor = '';
  if (choice !== 'Full review' && row.notice !== 'Yes') return { ok: false, error: 'The notice was not accepted.' };

  var sh = adviceSheet_(), now = new Date(), tz = adviceTz_(), stamp = Utilities.formatDate(now, tz, 'yyyy-MM-dd HH:mm');
  var last = sh.getLastRow(), from = Math.max(2, last - 59);
  var recent = last >= 2 ? sh.getRange(from, 1, last - from + 1, ADV.HEAD.length).getValues() : [];
  // Compared as branch-time stamps, never re-parsed into dates: a stamp read back through new Date() takes whatever zone the
  // runtime is in, which is how a duplicate check silently stops matching.
  var since = Utilities.formatDate(new Date(now.getTime() - ADV.DUPE_MIN * 60000), tz, 'yyyy-MM-dd HH:mm');
  for (var i = recent.length - 1; i >= 0; i--) {
    var r = recent[i];
    if (adviceDigits_(r[5]) === digits && String(r[7]) === row.need && String(r[1]) >= since && !/^ADV-TMP/.test(String(r[0])))
      return { ok: true, ref: String(r[0]), repeat: true };
  }
  // The row goes on first under a temporary mark; its number is its place among today's rows (the HELP 868 enquiry rule),
  // so two requests at once cannot share a reference, and no script lock is held.
  var tmp = 'ADV-TMP-' + Utilities.getUuid();
  sh.appendRow([tmp, stamp, 'New', row.choice, row.name, "'+" + digits, row.email, row.need, row.cover, row.time, row.advisor, row.notice === 'Yes' ? 'Yes, ' + stamp : 'No', row.contact, '', '']);
  var top = sh.getLastRow(), start = Math.max(2, top - 59), scan = sh.getRange(start, 1, top - start + 1, 2).getValues(), at2 = -1;
  for (var k = 0; k < scan.length; k++) if (String(scan[k][0]) === tmp) at2 = start + k;
  if (at2 < 0) return { ok: false, error: 'The request could not be filed. A person will follow up.' };
  var today = Utilities.formatDate(now, tz, 'yyyy-MM-dd'), seen = sh.getRange(2, 2, at2 - 1, 1).getValues(), n = 0;
  for (var q = 0; q < seen.length; q++) if (String(seen[q][0]).slice(0, 10) === today) n++;
  var ref = 'ADV-' + Utilities.formatDate(now, tz, 'yyMMdd') + '-' + ('00' + n).slice(-3);
  sh.getRange(at2, 1).setValue(ref);

  var owner = adviceOwner_(), told = '';
  if (owner) {
    var link = ADV.FF + '?ui=next&intake=' + encodeURIComponent(ref) + '&s=' + adviceSig_(ref);
    var html = '<div style="font:14px/1.55 Arial,sans-serif;color:#1f2933">' +
      '<p><b>' + adviceEsc_(ref) + '</b> · ' + adviceEsc_(row.choice) + ', asked for on WhatsApp (HELP 868)</p>' +
      '<table style="border-collapse:collapse">' +
      [['Client', row.name], ['WhatsApp', 'number ending ' + digits.slice(-4)], ['E-mail', row.email || 'not given'], ['Need', row.need || 'a full review'],
       ['Cover in mind', row.cover || 'not given'], ['Best time to call', row.time || 'not given'], ['Advisor they named', row.advisor || 'none']]
        .map(function (x) { return '<tr><td style="padding:3px 14px 3px 0;color:#5c6670">' + x[0] + '</td><td style="padding:3px 0"><b>' + adviceEsc_(x[1]) + '</b></td></tr>'; }).join('') +
      '</table>' +
      (row.choice === 'Full review'
        ? '<p>They asked for a full review. Name an advisor to arrange the meeting; the full fact find is done with them in person.</p>'
        : '<p>They read the Insurance Act notice and chose advice on this one need (' + adviceEsc_(stamp) + '). Name an advisor and send them this link: it opens a Specific Need Only fact find with these details filled in. The advisor checks every detail with the client, makes the recommendation and submits as usual.</p>' +
          '<p><a href="' + link + '" style="background:#1F5FD6;color:#fff;padding:10px 16px;border-radius:8px;text-decoration:none;font-weight:bold">Open the fact find for ' + adviceEsc_(row.name) + '</a></p>' +
          '<p style="color:#5c6670;font-size:12px">The link works for ' + ADV.LINK_DAYS + ' days, for this request only. Mark the row Closed on the Advice Intake tab to stop it sooner.</p>') +
      '<p style="color:#777;font-size:12px">Internal. Do not forward outside the branch.</p></div>';
    var subj = 'WhatsApp advice request ' + ref + ' · ' + (row.need || 'full review');
    try {
      if (typeof tMsSend_ === 'function') tMsSend_(owner, subj, html);
      else MailApp.sendEmail({ to: owner, subject: subj, htmlBody: html, name: 'RRB Support Team' });
      told = stamp;
    } catch (e) {
      try { MailApp.sendEmail({ to: owner, subject: subj, htmlBody: html, name: 'RRB Support Team' }); told = stamp; } catch (e2) { told = 'not sent: ' + String(e2 && e2.message || e2).slice(0, 80); }
    }
  } else told = 'no owner set';
  sh.getRange(at2, 14).setValue(told);
  return { ok: true, ref: ref, choice: row.choice };
}

/** q.adviceget: the fact find asks for one request's details by its signed link. */
function adviceGet_(p) {
  var ref = String(p.ref || '').trim(), sig = String(p.s || '').trim();
  if (!/^ADV-\d{6}-\d{3}$/.test(ref) || !sig) return { ok: false, error: 'This link is not complete.' };
  var want = adviceSig_(ref);
  if (want.length !== sig.length) return { ok: false, error: 'This link is not valid.' };
  var d = 0; for (var i = 0; i < want.length; i++) d |= want.charCodeAt(i) ^ sig.charCodeAt(i);
  if (d !== 0) return { ok: false, error: 'This link is not valid.' };
  var sh = adviceSheet_(), last = sh.getLastRow(); if (last < 2) return { ok: false, error: 'Request not found.' };
  var refs = sh.getRange(2, 1, last - 1, 1).getValues(), row = -1;
  for (var r = refs.length - 1; r >= 0; r--) if (String(refs[r][0]) === ref) { row = r + 2; break; }
  if (row < 0) return { ok: false, error: 'Request not found.' };
  var v = sh.getRange(row, 1, 1, ADV.HEAD.length).getValues()[0];
  if (/^closed/i.test(String(v[2]))) return { ok: false, error: 'This request has been closed.' };
  if (String(v[1]) < Utilities.formatDate(new Date(Date.now() - ADV.LINK_DAYS * 86400000), adviceTz_(), 'yyyy-MM-dd HH:mm')) return { ok: false, error: 'This link has expired. Ask for the request to be sent again.' };
  if (!String(v[14])) sh.getRange(row, 15).setValue(Utilities.formatDate(new Date(), adviceTz_(), 'yyyy-MM-dd HH:mm'));
  var unq = function (x) { return String(x == null ? '' : x).replace(/^'/, ''); };
  return { ok: true, ref: ref, choice: unq(v[3]), name: unq(v[4]), phone: unq(v[5]), email: unq(v[6]), need: unq(v[7]),
           cover: unq(v[8]), time: unq(v[9]), advisor: unq(v[10]), notice: unq(v[11]), when: unq(v[1]) };
}
