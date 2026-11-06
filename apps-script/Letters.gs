/**
 * Letters.gs: Guardian Life's own letter, put on the client's reply before it goes (5 November 2026).
 *
 * Ricky, 5 Nov 2026: "once who are saying the agents are there ... you need to attach the letters. So visibility of the
 * letters and the ability to print the letters is very important."
 *
 * Claude drafts each reply in support@ Drafts through the Microsoft 365 connector, which cannot attach a file. So the
 * draft carries one line, in its own paragraph:
 *
 *     [[letter: <former agent> | <page> | <client> | <staff e-mail>]]      e.g. [[letter: <agent> | 95,96 | <client> | x@y]]
 *
 * the former agent's book, the page (or pages, "95,96"), the client's name, and the staff member who follows up.
 * Every ten minutes this file looks at support@ Drafts, and for each draft carrying a line like that it:
 *   1. finds the agent's book (one PDF per former agent, one page per client) in the Drive folder that holds
 *      Guardian Life's 6 October letters (LETTERS.FOLDER, a zip or the PDFs themselves);
 *   2. cuts the client's page(s) into "<Client> - Guardian Life letter 6 Oct 2026.pdf" with pdf-lib (the copy
 *      GroupBilling.gs already loads);
 *   3. attaches it to the draft through Microsoft Graph and takes the line out of the body, so the draft is ready to
 *      send with the letter on it;
 *   4. keeps a copy in the "Letters attached" folder beside the books, and e-mails a print copy to the staff member
 *      and Ricky (internal, never the client), so the letter can be printed for the file or posted by hand;
 *   5. logs the row on the Letters Attached tab.
 * Nothing is ever sent to the client from here: the draft waits for Ricky.
 *
 * Needs, once: the Entra app behind MS_TENANT / MS_CLIENT / MS_SECRET must hold Mail.ReadWrite (application) with
 * admin consent, beside the Mail.Send and Mail.Read it already holds, because a draft is changed, not sent. Then run
 * lettersSetup() from the editor; it installs the ten-minute trigger. lettersAttachNow() runs it at once.
 */

var LETTERS = {
  FOLDER: '1wk35YtWIrJEKUFJnWsssCSy2XJQEWVEU',   // Ricky's Drive folder "ORPHAN LETTERS - KR TEAM" (not client data in code: an id)
  FOLDER_PROP: 'LETTERS_FOLDER_ID',              // a Script property of this name wins over FOLDER
  BOOKS: 'Books (unzipped)',                     // made beside the zips the first time a book is needed
  KEPT: 'Letters attached',                      // every letter attached, kept for printing
  SUFFIX: ' - Guardian Life letter 6 Oct 2026.pdf',
  TAB: 'Letters Attached',
  DRAFTS: 50,                                    // the newest drafts looked at a run
  EVERY_MIN: 10,
  MARK: /\[\[\s*letter\s*:\s*([^\]|]+?)\s*\|\s*([0-9 ,\-]+?)\s*(?:\|\s*([^\]|]+?)\s*)?(?:\|\s*([^\]|]+?)\s*)?\]\]/i,
};

/** Run once from the editor: the ten-minute trigger, never two of them. */
function lettersSetup() {
  ScriptApp.getProjectTriggers().forEach(function (t) { if (t.getHandlerFunction() === 'lettersAttachTick') ScriptApp.deleteTrigger(t); });
  ScriptApp.newTrigger('lettersAttachTick').timeBased().everyMinutes(LETTERS.EVERY_MIN).create();
  return 'Letters: checking support@ Drafts every ' + LETTERS.EVERY_MIN + ' minutes.';
}
function lettersAttachTick() { return lettersAttachRun_(false); }
function lettersAttachNow() { var r = lettersAttachRun_(true); Logger.log(JSON.stringify(r)); return r; }

/** One pass over support@ Drafts. Returns what was attached and what was not. */
function lettersAttachRun_(verbose) {
  var out = { attached: [], failed: [] };
  if (typeof tMsCreds_ !== 'function' || !tMsCreds_()) { out.failed.push('Microsoft 365 is not set up (MS_TENANT, MS_CLIENT, MS_SECRET)'); return out; }
  var drafts = lettersDrafts_();
  drafts.forEach(function (d) {
    var html = (d.body && d.body.content) || '';
    var m = html.replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').match(LETTERS.MARK);
    if (!m) return;
    var spec = { agent: m[1].trim(), pages: lettersPages_(m[2]), client: (m[3] || '').trim(), staff: (m[4] || '').trim() };
    try {
      var blob = lettersCut_(spec);
      lettersAttach_(d.id, blob);
      lettersStrip_(d.id, html);
      var kept = lettersKeep_(blob);
      lettersPrintCopy_(spec, blob, d.subject, kept);
      lettersLog_(spec, d.subject, blob.getName(), kept ? kept.getUrl() : '', 'attached');
      out.attached.push(blob.getName());
    } catch (e) {
      var why = String(e && e.message ? e.message : e).slice(0, 200);
      lettersLog_(spec, d.subject, '', '', 'failed: ' + why);
      out.failed.push((spec.client || spec.agent) + ': ' + why);
    }
  });
  if (verbose) Logger.log('Letters: ' + out.attached.length + ' attached, ' + out.failed.length + ' failed');
  return out;
}

function lettersPages_(s) {
  var pages = [];
  String(s).split(',').forEach(function (part) {
    var r = part.trim().split('-').map(function (x) { return parseInt(x, 10); });
    if (r.length === 2 && r[0] && r[1]) { for (var p = r[0]; p <= r[1]; p++) pages.push(p); }
    else if (r[0]) pages.push(r[0]);
  });
  return pages;
}

/* ── Microsoft Graph: the drafts, an attachment, the body ──────────────────────────────────────── */
function lettersGraph_(method, path, payload) {
  var opt = { method: method, muteHttpExceptions: true, contentType: 'application/json', headers: { Authorization: 'Bearer ' + tMsToken_() } };
  if (payload) opt.payload = JSON.stringify(payload);
  var res = UrlFetchApp.fetch('https://graph.microsoft.com/v1.0/users/' + encodeURIComponent(TRANSITION.MS_FROM) + path, opt);
  var code = res.getResponseCode();
  if (code >= 200 && code < 300) { try { return JSON.parse(res.getContentText() || '{}'); } catch (e) { return {}; } }
  var why = 'HTTP ' + code;
  try { var err = JSON.parse(res.getContentText()).error; if (err) why = (err.code ? err.code + ': ' : '') + (err.message || ''); } catch (e) {}
  if (code === 403) why += ' (the Entra app needs Mail.ReadWrite with admin consent)';
  throw new Error('Microsoft 365: ' + why.slice(0, 220));
}
function lettersDrafts_() {
  var r = lettersGraph_('get', '/mailFolders/drafts/messages?$top=' + LETTERS.DRAFTS + '&$select=id,subject,body,hasAttachments&$orderby=lastModifiedDateTime desc');
  return r.value || [];
}
function lettersAttach_(id, blob) {
  /* a run that attached and then failed to clean the body must not attach twice */
  var have = lettersGraph_('get', '/messages/' + encodeURIComponent(id) + '/attachments?$select=name');
  if ((have.value || []).some(function (a) { return a.name === blob.getName(); })) return;
  lettersGraph_('post', '/messages/' + encodeURIComponent(id) + '/attachments', {
    '@odata.type': '#microsoft.graph.fileAttachment', name: blob.getName(), contentType: 'application/pdf',
    contentBytes: Utilities.base64Encode(blob.getBytes()) });
}
/** The marker line out of the body, whether it sits in its own paragraph or inside one. */
function lettersStrip_(id, html) {
  var clean = html.replace(/<p[^>]*>\s*\[\[\s*letter\s*:[^\]]*\]\]\s*<\/p>/i, '').replace(/\[\[\s*letter\s*:[^\]]*\]\]/i, '');
  lettersGraph_('patch', '/messages/' + encodeURIComponent(id), { body: { contentType: 'HTML', content: clean } });
}

/* ── Drive: the books, the cut page, the kept copy ─────────────────────────────────────────────── */
function lettersFolder_() {
  var id = '';
  try { id = PropertiesService.getScriptProperties().getProperty(LETTERS.FOLDER_PROP) || ''; } catch (e) {}
  return DriveApp.getFolderById(id || LETTERS.FOLDER);
}
function lettersSub_(name) {
  var f = lettersFolder_(), it = f.getFoldersByName(name);
  return it.hasNext() ? it.next() : f.createFolder(name);
}
function lettersKey_(s) { return String(s || '').toLowerCase().replace(/[^a-z]/g, ''); }

/** The agent's book as a Blob: from the unzipped copy, else the PDF in the folder, else out of a zip (kept unzipped). */
function lettersBook_(agent) {
  var want = lettersKey_(agent);
  var match = function (name) { var b = lettersKey_(String(name).replace(/\.pdf$/i, '').split('-').pop()); return b === want || lettersKey_(name).indexOf(want) >= 0; };
  var books = lettersSub_(LETTERS.BOOKS), it = books.getFiles();
  while (it.hasNext()) { var f = it.next(); if (/\.pdf$/i.test(f.getName()) && match(f.getName())) return f.getBlob(); }
  var all = lettersFolder_().getFiles(), zips = [];
  while (all.hasNext()) {
    var g = all.next(), n = g.getName();
    if (/\.pdf$/i.test(n) && match(n)) return g.getBlob();
    if (/\.zip$/i.test(n)) zips.push(g);
  }
  for (var i = 0; i < zips.length; i++) {
    var parts = Utilities.unzip(zips[i].getBlob().setContentType('application/zip'));
    var hit = null;
    parts.forEach(function (p) {
      if (!/\.pdf$/i.test(p.getName())) return;
      var name = p.getName().split('/').pop();
      if (!books.getFilesByName(name).hasNext()) books.createFile(p.setName(name).setContentType('application/pdf'));
      if (!hit && match(name)) hit = p;
    });
    if (hit) return hit;
  }
  throw new Error('No book for ' + agent + ' in the letters folder');
}

/* pdf-lib for a whole book. GroupBilling.gs's loader (gblSyncPromise_) runs every callback inside the one before it,
   which is fine for a two-page form and overflows the stack on a 447-page book: pdf-lib awaits once per object, the
   overflow is swallowed, and the load never settles. This Promise queues its callbacks and lettersDrain_ runs the queue
   in a flat loop, the way a browser runs microtasks, so a book of any length loads inside the call. */
var LETTERS_Q_ = [], LETTERS_LIB_ = null;
function lettersDrain_() { var guard = 0; while (LETTERS_Q_.length) { if (++guard > 50000000) throw new Error('pdf-lib did not settle'); LETTERS_Q_.shift()(); } }
function lettersPromise_() {
  function P(executor) {
    var self = this; self.s = 0; self.v = undefined; self.q = [];
    function settle(state, value) {
      if (self.s) return;
      if (state === 1 && value && typeof value.then === 'function') { var once = false; try { value.then(function (v) { if (!once) { once = true; self.s = 0; settle(1, v); } }, function (e) { if (!once) { once = true; settle(2, e); } }); } catch (e) { if (!once) { once = true; settle(2, e); } } return; }
      self.s = state; self.v = value; var q = self.q; self.q = []; q.forEach(function (f) { LETTERS_Q_.push(f); });
    }
    try { executor(function (v) { settle(1, v); }, function (e) { settle(2, e); }); } catch (e) { settle(2, e); }
  }
  P.prototype.then = function (onF, onR) {
    var self = this;
    return new P(function (resolve, reject) {
      function run() {
        try {
          if (self.s === 1) resolve(typeof onF === 'function' ? onF(self.v) : self.v);
          else if (typeof onR === 'function') resolve(onR(self.v)); else reject(self.v);
        } catch (e) { reject(e); }
      }
      if (self.s) LETTERS_Q_.push(run); else self.q.push(run);
    });
  };
  P.prototype['catch'] = function (onR) { return this.then(undefined, onR); };
  P.prototype['finally'] = function (f) { return this.then(function (v) { f(); return v; }, function (e) { f(); throw e; }); };
  P.resolve = function (v) { return (v instanceof P) ? v : new P(function (r) { r(v); }); };
  P.reject = function (e) { return new P(function (r, j) { j(e); }); };
  P.all = function (arr) { return new P(function (resolve, reject) { var list = Array.prototype.slice.call(arr), out = [], n = 0; if (!list.length) return resolve(out); list.forEach(function (p, i) { P.resolve(p).then(function (v) { out[i] = v; if (++n === list.length) resolve(out); }, reject); }); }); };
  P.race = function (arr) { return new P(function (resolve, reject) { Array.prototype.slice.call(arr).forEach(function (p) { P.resolve(p).then(resolve, reject); }); }); };
  return P;
}
function lettersPdfLib_() {
  if (LETTERS_LIB_) return LETTERS_LIB_;
  var res = UrlFetchApp.fetch(GBL_PDF.LIB, { muteHttpExceptions: true });
  if (res.getResponseCode() !== 200) throw new Error('pdf-lib could not be fetched (HTTP ' + res.getResponseCode() + ')');
  var P = lettersPromise_();
  var lib = (new Function('Promise', 'setTimeout', 'self', 'window', 'exports', 'module', 'define', res.getContentText() + '\n;return (typeof PDFLib !== "undefined" ? PDFLib : this.PDFLib);'))(P, function (f) { LETTERS_Q_.push(f); }, undefined, undefined, undefined, undefined, undefined);
  if (!lib || !lib.PDFDocument) throw new Error('pdf-lib did not load');
  LETTERS_LIB_ = lib;
  return lib;
}
function lettersSync_(promise, what) {
  var out = { done: false, value: null, error: null };
  promise.then(function (v) { out.done = true; out.value = v; }, function (e) { out.done = true; out.error = e; });
  lettersDrain_();
  if (!out.done) throw new Error(what + ' did not finish inside the call');
  if (out.error) throw new Error(what + ': ' + String(out.error && out.error.message ? out.error.message : out.error).slice(0, 200));
  return out.value;
}

/** The client's page(s) as their own PDF. */
function lettersCut_(spec) {
  if (!spec.pages.length) throw new Error('No page given');
  var lib = lettersPdfLib_();
  var src = lettersSync_(lib.PDFDocument.load(gblU8_(lettersBook_(spec.agent).getBytes()), { ignoreEncryption: true, updateMetadata: false }), 'Reading the book');
  var n = src.getPageCount();
  spec.pages.forEach(function (p) { if (p < 1 || p > n) throw new Error('Page ' + p + ' is outside the book (' + n + ' pages)'); });
  var doc = lettersSync_(lib.PDFDocument.create(), 'A new letter');
  var copied = lettersSync_(doc.copyPages(src, spec.pages.map(function (p) { return p - 1; })), 'Copying the page');
  copied.forEach(function (pg) { doc.addPage(pg); });
  var bytes = lettersSync_(doc.save({ useObjectStreams: false }), 'Writing the letter');
  var name = (spec.client || spec.agent + ' p' + spec.pages.join(',')).replace(/[\\\/:*?"<>|]/g, '') + LETTERS.SUFFIX;
  return Utilities.newBlob(gblSigned_(bytes), 'application/pdf', name);
}

function lettersKeep_(blob) {
  try { return lettersSub_(LETTERS.KEPT).createFile(blob.copyBlob().setName(blob.getName())); } catch (e) { return null; }
}

/** A print copy for the person who follows up, and for Ricky: internal, never the client. */
function lettersPrintCopy_(spec, blob, subject, kept) {
  var to = spec.staff && /@/.test(spec.staff) ? spec.staff : TRANSITION.CC[1];
  var cc = TRANSITION.CC.filter(function (a) { return a.toLowerCase() !== String(to).toLowerCase(); });
  var who = spec.client || 'the client';
  var html = '<p>The Guardian Life letter of 6 October 2026 for <b>' + who + '</b> is now attached to the reply in support@ Drafts ("' +
    String(subject || '').replace(/</g, '&lt;') + '"). It goes when Mr Rampersad sends it.</p>' +
    '<p>A copy is attached here to print for the client\'s file, or to post with a short handwritten note if the client prefers paper.' +
    (kept ? ' It is also kept in Drive: <a href="' + kept.getUrl() + '">' + blob.getName() + '</a>.' : '') + '</p>' +
    '<p>Once the reply has gone, call ' + who + ' within one working day to confirm it arrived, and record the call on the Salesforce task.</p>' +
    '<p style="color:#64798e">Internal: do not forward outside the branch.</p>';
  tMsSend_(to, 'Print copy: Guardian Life letter for ' + who, html, { cc: cc, attachments: [blob] });
}

function lettersLog_(spec, subject, file, url, status) {
  try {
    var ss = SpreadsheetApp.getActiveSpreadsheet(), sh = ss.getSheetByName(LETTERS.TAB);
    if (!sh) { sh = ss.insertSheet(LETTERS.TAB); sh.appendRow(['When', 'Client', 'Former agent', 'Pages', 'Staff', 'Draft subject', 'File', 'Kept copy', 'Status']); }
    sh.appendRow([new Date(), spec.client, spec.agent, spec.pages.join(','), spec.staff, String(subject || ''), file, url, status]);
  } catch (e) {}
}
