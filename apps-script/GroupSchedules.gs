/* ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════
 * GroupSchedules.gs: each group's Schedule of Benefits, for its own employees, on a page and on WhatsApp.
 * (23 November 2026: "can the schedule of benefits be available to the employee and any question they ask online as
 * we have integrated what's app and our benefits assistant is the 24/7 to answer any questions")
 *
 * A file in the Service Questionnaire project beside GroupClients.gs and GroupBilling.gs. GroupClients.gs hands it every
 * action it does not know (gsbRoute_), so a change here never needs GroupClients.gs pasted again.
 *
 *  · STAFF upload a group's schedule on the group's page (the PDF Guardian sends with the renewal). The browser reads
 *    its text with pdf.js; staff check it, then press Publish. Until then employees see nothing. One published schedule
 *    a group and line; publishing a new one replaces the old.            gcm.sobList (GET) · gcm.sobAct (POST)
 *  · EMPLOYEES open /mybenefits/?k=<code> from the link HR shares. The code is the group's alone (an HMAC of its key),
 *    so the address names no employer and no other group can be reached from it.   gcm.sobView · gcm.sobPdf (GET)
 *  · WHATSAPP: the HELP 868 assistant (respond.io) calls gcm.planLookup with the shared key, the member number on the
 *    employee's health card (or the plan code the page put in their message) and their question. The answer is the
 *    lines of THAT group's schedule that bear on the question, nothing else, never a member's own record. The assistant
 *    answers from those lines and says Guardian Life decides every claim.                   gcm.planLookup (POST)
 *
 * Facts, not advice: nothing here says a claim will be paid. A member's own claims, balances or limits used are never
 * looked up here: those are a ticket for a person.
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════════════════ */
var GSB = {
  VERSION: '2026-11-23a',
  TAB: 'Group Schedules', LOG: 'Plan Questions',
  HEAD: ['When', 'Ref', 'Group', 'Line', 'Title', 'Effective', 'Status', 'Text', 'File', 'File name', 'Uploaded by', 'Published by', 'Published at', 'Note'],
  LOG_HEAD: ['When', 'Group', 'Via', 'Phone', 'Question', 'Lines matched', 'Lines'],
  LINES: { health: 'Group Health', life: 'Group Life', dental: 'Dental and vision', other: 'Other benefits' },
  MAX_TEXT: 48000, MAX_PDF_B64: 9000000, FOLDER: 'Schedules of benefits',
  SITE: 'https://rickyrampersadbranch.com/mybenefits/',
  KEY_PROP: 'PLAN_LOOKUP_KEY', SECRET_PROP: 'GSB_SECRET',
  DAY_MAX: 40,        // look-ups one WhatsApp number may make a day
  TRY_MAX: 8,         // member numbers not found, one WhatsApp number, fifteen minutes
  MATCH_CHARS: 4500, FULL_CHARS: 12000,
  HELP868: '18684357868',
  STOP: { the: 1, and: 1, for: 1, are: 1, does: 1, what: 1, how: 1, much: 1, can: 1, will: 1, plan: 1, cover: 1, covered: 1, coverage: 1, pay: 1, pays: 1,
    with: 1, from: 1, this: 1, that: 1, have: 1, has: 1, any: 1, our: 1, your: 1, you: 1, get: 1, is: 1, my: 1, me: 1, do: 1, i: 1, it: 1, of: 1, in: 1, on: 1, to: 1, a: 1, an: 1,
    benefit: 1, benefits: 1, insurance: 1, health: 1, policy: 1, group: 1, please: 1, hi: 1, hello: 1, know: 1, want: 1, would: 1, like: 1, about: 1 },
  SYN: {
    dentist: ['dental'], teeth: ['dental'], tooth: ['dental'], braces: ['orthodontic', 'dental'], filling: ['dental'],
    eye: ['vision', 'optical', 'eye'], eyes: ['vision', 'optical'], glasses: ['vision', 'optical', 'lenses', 'frames'], spectacles: ['vision', 'optical', 'lenses'], contacts: ['contact', 'lenses', 'vision'],
    pregnant: ['maternity', 'pregnancy'], pregnancy: ['maternity'], baby: ['maternity', 'newborn', 'well'], delivery: ['maternity'], birth: ['maternity'],
    doctor: ['physician', 'consultation', 'doctor', 'visit'], gp: ['physician', 'consultation'], visit: ['consultation', 'visit'], specialist: ['specialist', 'consultation'],
    hospital: ['hospital', 'room', 'board', 'inpatient', 'confinement'], admitted: ['hospital', 'inpatient', 'room'], surgery: ['surgical', 'surgery', 'surgeon', 'operating'], operation: ['surgical', 'surgery'],
    medicine: ['prescription', 'drug', 'drugs', 'pharmacy'], medication: ['prescription', 'drug', 'drugs'], drugs: ['prescription', 'drug'], pharmacy: ['prescription', 'drug', 'pharmacy'], prescriptions: ['prescription', 'drug'],
    therapy: ['physiotherapy', 'therapy', 'physical'], physio: ['physiotherapy', 'physical', 'therapy'], ambulance: ['ambulance'], xray: ['x-ray', 'diagnostic', 'radiology'], scan: ['diagnostic', 'mri', 'ct', 'scan'],
    lab: ['laboratory', 'diagnostic', 'lab'], blood: ['laboratory', 'diagnostic'], test: ['diagnostic', 'laboratory'], tests: ['diagnostic', 'laboratory'],
    copay: ['co-pay', 'copay', 'coinsurance'], percentage: ['coinsurance', '%'], abroad: ['overseas', 'out-of-country', 'international', 'emergency'], overseas: ['overseas', 'out-of-country', 'international'],
    mental: ['psychiatric', 'mental', 'nervous'], counselling: ['psychiatric', 'mental'], cancer: ['cancer', 'oncology', 'chemotherapy'], dialysis: ['dialysis', 'kidney'],
    life: ['life', 'death', 'sum'], death: ['death', 'life', 'funeral'], funeral: ['funeral', 'death'], accident: ['accidental', 'ad&d', 'dismemberment'],
    limit: ['maximum', 'limit', 'max'], maximum: ['maximum', 'limit'], deductible: ['deductible'], excess: ['deductible'], dependants: ['dependent', 'dependant', 'child', 'spouse'], children: ['child', 'dependent'],
    wellness: ['preventive', 'wellness', 'check-up', 'physical'], checkup: ['preventive', 'wellness', 'check-up'], vaccine: ['immunization', 'vaccination', 'preventive']
  }
};

/* ── routing: GroupClients.gs hands over any action it does not know ─────────────────────────────────────────── */
function gsbRoute_(p, method) {
  var a = String(p && p.action || '');
  try {
    if (method === 'get') {
      if (a === 'gcm.sobList') return gsbList_(p);
      if (a === 'gcm.sobView') return gsbView_(p);
      if (a === 'gcm.sobPdf') return gsbPdf_(p);
      if (a === 'gcm.planPing') return gsbPing_();
    } else {
      if (a === 'gcm.sobAct') return gsbAct_(p);
      if (a === 'gcm.planLookup') return gsbLookup_(p);
    }
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e).slice(0, 300) };
  }
  return null;
}
function gsbPing_() {
  var pub = 0;
  try { pub = gsbAll_().filter(function (s) { return s.status === 'published'; }).length; } catch (e) {}
  return { ok: true, plans: 1, build: GSB.VERSION, published: pub, whatsapp: !!gsbProp_(GSB.KEY_PROP) };
}

/* ── the tabs ─────────────────────────────────────────────────────────────────────────────────────────────────── */
function gsbSheet_(name, head) {
  var ss = gcmSS_(), sh = ss.getSheetByName(name);
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold');
    sh.setFrozenRows(1);
  }
  return sh;
}
function gsbAppend_(name, head, o) {
  var sh = gsbSheet_(name, head);
  sh.getRange(sh.getLastRow() + 1, 1, 1, head.length).setValues([head.map(function (h) {
    var v = o[h]; if (v === undefined || v === null) return '';
    /* text the sheet would otherwise parse (a date, a number, a formula) is kept as written */
    return typeof v === 'string' && (/^[=+\-@]/.test(v) || /^\d{4}-\d{2}(-\d{2})?$/.test(v) || /^\d+(\.\d+)?$/.test(v)) ? "'" + v : v;
  })]);
}
function gsbSet_(row, fields) {
  var sh = gsbSheet_(GSB.TAB, GSB.HEAD);
  Object.keys(fields).forEach(function (h) {
    var c = GSB.HEAD.indexOf(h); if (c < 0) return;
    var v = fields[h]; if (typeof v === 'string' && /^[=+\-@]/.test(v)) v = "'" + v;
    sh.getRange(row, c + 1).setValue(v);
  });
}
function gsbAll_() {
  return gcmRows_(GSB.TAB).map(function (r) {
    return { _n: r._n, ref: gcmText_(r.Ref), group: gcmCodeKey_(r.Group), groupName: gcmText_(r.Group), line: gcmText_(r.Line) || 'health',
      title: gcmText_(r.Title), effective: gcmText_(r.Effective), status: gcmText_(r.Status) || 'draft', text: gcmText_(r.Text),
      file: gcmText_(r.File), fileName: gcmText_(r['File name']), by: gcmText_(r['Uploaded by']), pubBy: gcmText_(r['Published by']),
      pubAt: gcmText_(r['Published at']), when: r.When instanceof Date ? gcmWhen_(r.When) : gcmText_(r.When), note: gcmText_(r.Note) };
  }).filter(function (s) { return s.ref && s.group; });
}
/** What employees see: the newest published schedule for each line of the group. */
function gsbPublished_(gkey) {
  var by = {};
  gsbAll_().forEach(function (s) { if (s.group === gkey && s.status === 'published') by[s.line] = s; });
  return Object.keys(GSB.LINES).filter(function (l) { return by[l]; }).map(function (l) { return by[l]; });
}
function gsbProp_(k) { try { return String(PropertiesService.getScriptProperties().getProperty(k) || '').trim(); } catch (e) { return ''; } }

/* ── the group's own code for its page ──────────────────────────────────────────────────────────────────────── */
function gsbSecret_() {
  var s = gsbProp_(GSB.SECRET_PROP);
  if (!s) { s = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, ''); PropertiesService.getScriptProperties().setProperty(GSB.SECRET_PROP, s); }
  return s;
}
function gsbToken_(gkey) {
  var sig = Utilities.computeHmacSha256Signature('plan|' + gkey, gsbSecret_());
  return sig.map(function (b) { return ('0' + (b & 255).toString(16)).slice(-2); }).join('').slice(0, 20);
}
function gsbLink_(g) { return GSB.SITE + '?k=' + gsbToken_(g.key); }
function gsbGroupByToken_(k) {
  k = String(k || '').toLowerCase().replace(/[^0-9a-f]/g, '');
  if (k.length !== 20) return null;
  var reg = gcmRegister_(), hit = null;
  reg.forEach(function (g) { if (!hit && gsbToken_(g.key) === k) hit = g; });
  return hit;
}
function gsbGroup_(key) {
  var k = gcmCodeKey_(key), g = null;
  gcmRegister_().forEach(function (x) { if (x.key === k) g = x; });
  return g;
}

/* ── staff: the group's schedules ───────────────────────────────────────────────────────────────────────────── */
function gsbList_(p) {
  var who = gcmWho_(p); if (!who.ok) return who;
  var g = gsbGroup_(p.group); if (!g) return { ok: false, error: 'That group is not on the Group Register.' };
  var mine = gsbAll_().filter(function (s) { return s.group === g.key; }).reverse();
  var pub = gsbPublished_(g.key);
  return { ok: true, build: GSB.VERSION, canAct: gcmMine_(who, g), lines: GSB.LINES, drive: !!(typeof gblFolderId_ === 'function' && gblFolderId_()),
    whatsapp: !!gsbProp_(GSB.KEY_PROP), link: pub.length ? gsbLink_(g) : '', group: { key: g.key, name: g.name },
    schedules: mine.map(function (s) { return { ref: s.ref, line: s.line, label: GSB.LINES[s.line] || s.line, title: s.title, effective: s.effective, status: s.status,
      text: s.text, hasPdf: !!s.file, fileName: s.fileName, by: s.by, when: s.when, pubBy: s.pubBy, pubAt: s.pubAt }; }),
    questions: gsbQuestions_(g.key, 15) };
}
/** The latest questions employees asked about this group's plan, for the staff (never a full number). */
function gsbQuestions_(gkey, n) {
  try {
    return gcmRows_(GSB.LOG).filter(function (r) { return gcmCodeKey_(r.Group) === gkey; }).slice(-n).reverse().map(function (r) {
      return { when: r.When instanceof Date ? gcmWhen_(r.When) : gcmText_(r.When), via: gcmText_(r.Via), q: gcmText_(r.Question), matched: Number(r['Lines matched']) || 0 };
    });
  } catch (e) { return []; }
}
function gsbAct_(b) {
  var who = gcmWho_(b); if (!who.ok) return who;
  var g = gsbGroup_(b.group); if (!g) return { ok: false, error: 'That group is not on the Group Register.' };
  if (!gcmMine_(who, g)) return { ok: false, error: 'Only ' + (g.assigned ? g.assigned + ', ' : '') + 'the assistant branch manager or the branch manager can change this group’s schedule.' };
  var act = String(b.act || ''), all = gsbAll_();
  var one = function () { return all.filter(function (s) { return s.ref === String(b.ref || '') && s.group === g.key; })[0]; };
  if (act === 'save') {
    var line = GSB.LINES[b.line] ? String(b.line) : '';
    if (!line) return { ok: false, error: 'Which plan is this schedule for?' };
    var text = gsbClean_(b.text);
    if (text.replace(/\s/g, '').length < 80) return { ok: false, error: 'There is hardly any text to show. Read the PDF again, or type or paste the schedule in.' };
    if (text.length > GSB.MAX_TEXT) return { ok: false, error: 'The schedule is longer than a page can hold (' + text.length + ' characters, at most ' + GSB.MAX_TEXT + '). Take out the pages that are not the schedule, such as the policy wording.' };
    var title = String(b.title || '').replace(/\s+/g, ' ').trim().slice(0, 120) || (GSB.LINES[line] + ' · Schedule of Benefits');
    var eff = /^\d{4}-\d{2}-\d{2}$/.test(String(b.effective || '')) ? String(b.effective) : '';
    var prev = b.ref ? one() : null;
    if (prev && prev.status !== 'draft') return { ok: false, error: 'A published schedule is not edited: save the changes as a new draft and publish that.' };
    var fileId = prev ? prev.file : '', fileName = prev ? prev.fileName : '';
    if (b.pdf) {
      var b64 = String(b.pdf).replace(/^data:[^,]+,/, '');
      if (b64.length > GSB.MAX_PDF_B64) return { ok: false, error: 'The PDF is too large to keep (over 6 MB). The text is saved without it if you take the file off.' };
      var folder = typeof gblSubfolder_ === 'function' ? gblSubfolder_(GSB.FOLDER) : null;
      if (folder) {
        var nm = String(b.fileName || 'schedule.pdf').replace(/[^\w .()-]/g, '_').slice(0, 80);
        var f = folder.createFile(Utilities.newBlob(Utilities.base64Decode(b64), 'application/pdf', nm));
        f.setName(g.name + ' · ' + GSB.LINES[line] + ' · ' + nm);
        fileId = f.getId(); fileName = nm;
      }
    }
    if (prev) {
      gsbSet_(prev._n, { Line: line, Title: title, Effective: eff, Text: text, File: fileId, 'File name': fileName, 'Uploaded by': who.name });
      return { ok: true, ref: prev.ref, said: 'Draft saved. Employees see nothing until it is published.', kept: !!fileId };
    }
    var ref = 'SB-' + Utilities.formatDate(new Date(), tTz_(), 'yyMMdd') + '-' + ('00' + (all.length + 1)).slice(-3);
    gsbAppend_(GSB.TAB, GSB.HEAD, { When: new Date(), Ref: ref, Group: g.name, Line: line, Title: title, Effective: eff, Status: 'draft', Text: text,
      File: fileId, 'File name': fileName, 'Uploaded by': who.name, Note: b.pdf && !fileId ? 'PDF not kept: set GCM_FORMS_FOLDER' : '' });
    return { ok: true, ref: ref, kept: !!fileId, said: 'Draft saved. Read it as employees will, then press Publish.' +
      (b.pdf && !fileId ? ' The PDF itself was not kept: the GCM_FORMS_FOLDER Script property names no Drive folder, so employees get the text without a download.' : '') };
  }
  if (act === 'publish') {
    var s = one(); if (!s) return { ok: false, error: 'That schedule is not on this group.' };
    if (s.status === 'published') return { ok: true, said: 'It is already published.', link: gsbLink_(g) };
    var stamp = gcmWhen_(new Date());
    all.forEach(function (x) { if (x.group === g.key && x.line === s.line && x.status === 'published') gsbSet_(x._n, { Status: 'replaced', Note: 'replaced by ' + s.ref + ' · ' + stamp }); });
    gsbSet_(s._n, { Status: 'published', 'Published by': who.name, 'Published at': stamp });
    return { ok: true, said: GSB.LINES[s.line] + ' schedule published. Employees with the link see it now, and HELP 868 answers from it.', link: gsbLink_(g) };
  }
  if (act === 'retire') {
    var r = one(); if (!r) return { ok: false, error: 'That schedule is not on this group.' };
    gsbSet_(r._n, { Status: 'retired', Note: 'taken down by ' + who.name + ' · ' + gcmWhen_(new Date()) });
    return { ok: true, said: 'Taken down. Employees no longer see it.' };
  }
  if (act === 'link') return { ok: true, link: gsbLink_(g), published: gsbPublished_(g.key).length };
  return { ok: false, error: 'Unknown action' };
}
/** The text as employees read it: one line a row, columns split by " | ", no runs of blanks, no control characters. */
function gsbClean_(t) {
  return String(t || '').replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '')
    .split('\n').map(function (l) { return l.replace(/\t/g, ' | ').replace(/[  ]+/g, ' ').replace(/(\s*\|\s*)+/g, ' | ').replace(/^\s*\|\s*|\s*\|\s*$/g, '').trim(); })
    .join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

/* ── employees: the page ─────────────────────────────────────────────────────────────────────────────────────── */
function gsbView_(p) {
  var g = gsbGroupByToken_(p.k);
  if (!g) return { ok: false, error: 'This link is not right. Ask your HR department for your plan’s link, or message HELP 868 on WhatsApp.' };
  var pub = gsbPublished_(g.key);
  /* one line on Plan Questions an hour a group, so staff can see the page is being opened without a row per visit */
  try { var c = CacheService.getScriptCache(), ck = 'gsb-pv-' + g.key.slice(0, 40); if (!c.get(ck)) { gsbLog_(g, 'page opened', '', '', 0, ''); c.put(ck, '1', 3600); } } catch (e) {}
  return { ok: true, group: g.name, code: gsbToken_(g.key), help868: GSB.HELP868,
    plans: pub.map(function (s) { return { ref: s.ref, line: s.line, label: GSB.LINES[s.line] || s.line, title: s.title, effective: s.effective, text: s.text, hasPdf: !!s.file, updated: s.pubAt }; }),
    note: pub.length ? '' : 'Your employer’s schedule of benefits is not on this page yet. Ask your HR department, or message HELP 868 on WhatsApp.' };
}
function gsbPdf_(p) {
  var g = gsbGroupByToken_(p.k); if (!g) return { ok: false, error: 'This link is not right.' };
  var s = gsbPublished_(g.key).filter(function (x) { return x.ref === String(p.ref || ''); })[0];
  if (!s || !s.file) return { ok: false, error: 'There is no PDF for this schedule.' };
  var f = DriveApp.getFileById(s.file), blob = f.getBlob();
  return { ok: true, name: (s.fileName || 'schedule.pdf'), b64: Utilities.base64Encode(blob.getBytes()) };
}

/* ── WhatsApp: the HELP 868 assistant asks about one member's plan ──────────────────────────────────────────── */
function gsbLookup_(b) {
  var key = gsbProp_(GSB.KEY_PROP);
  if (!key) return { ok: false, found: false, error: 'Plan look-ups are not switched on (PLAN_LOOKUP_KEY).' };
  if (String(b.key || '') !== key) return { ok: false, found: false, error: 'Not allowed.' };
  var phone = String(b.phone || '').replace(/\D/g, '').slice(-12), cache = CacheService.getScriptCache();
  var dayKey = 'gsb-day-' + phone + '-' + gcmToday_(), tryKey = 'gsb-try-' + phone;
  var used = Number(cache.get(dayKey) || 0), tries = Number(cache.get(tryKey) || 0);
  if (phone && used >= GSB.DAY_MAX) return { ok: true, found: false, reason: 'limit', say: 'You have asked a lot of questions today. A member of our team will help you: log a request for a call.' };
  if (phone && tries >= GSB.TRY_MAX) return { ok: true, found: false, reason: 'tries', say: 'That member number could not be found several times. Please check the number on your health card, or ask your HR department for your plan’s link.' };
  var q = String(b.question || b.q || '').replace(/\s+/g, ' ').trim().slice(0, 400);
  var g = null, via = '';
  var code = String(b.planCode || b.code || '').toLowerCase().replace(/[^0-9a-f]/g, '');
  if (code.length === 20) { g = gsbGroupByToken_(code); via = g ? 'plan code' : ''; }
  var card = gsbCard_(b.card || b.member || '');
  var live = true;
  if (!g && card) { var hit = gsbGroupByCard_(card); g = hit.group; live = hit.live; via = g ? 'card' : ''; }
  if (!g) {
    if (phone) cache.put(tryKey, String(tries + 1), 900);
    return { ok: true, found: false, reason: card || code ? 'not found' : 'no number',
      say: card || code ? 'That number does not match a group plan we look after. Please check the member number on your health card (it looks like ABC1234-00012-00), or ask your HR department for your plan’s link.'
        : 'Please send the member number on your health card (it looks like ABC1234-00012-00).' };
  }
  if (!live) return { ok: true, found: false, reason: 'not active', group: g.name,
    say: 'That card no longer shows as active on ' + g.name + '’s plan with us. If that is not right, we will check it for you: log a request.' };
  var pub = gsbPublished_(g.key);
  if (phone) cache.put(dayKey, String(used + 1), 21600);
  if (!pub.length) {
    gsbLog_(g, via, phone, q, 0, '');
    return { ok: true, found: true, group: g.name, schedule: false, link: gsbLink_(g),
      say: g.name + '’s schedule of benefits is not online with us yet. Log a request and the person who looks after the plan will answer your question.' };
  }
  var plans = pub.map(function (s) {
    var m = q ? gsbMatch_(s.text, q, GSB.MATCH_CHARS) : { text: s.text.slice(0, GSB.FULL_CHARS), hits: 0 };
    return { line: GSB.LINES[s.line] || s.line, title: s.title, effective: s.effective, matched: m.hits, lines: m.text };
  });
  var hits = plans.reduce(function (n, x) { return n + x.matched; }, 0);
  gsbLog_(g, via, phone, q, hits, plans.map(function (x) { return x.line; }).join(', '));
  return { ok: true, found: true, group: g.name, schedule: true, link: gsbLink_(g), plans: plans, matched: hits,
    rule: 'Answer only from these lines of ' + g.name + '’s schedule. Quote the amount or percentage exactly as written. Say what the schedule says, not whether a claim will be paid: Guardian Life assesses every claim. If the lines do not answer the question, say so and offer to log a request.' };
}
/** A member number as typed: capitals, no spaces; "TPI 4784-00001-00" and "tpi4784-00001-00" are one number. */
function gsbCard_(s) { return String(s || '').toUpperCase().replace(/[\s.]+/g, '').replace(/[–—]/g, '-').replace(/[^A-Z0-9\-\/]/g, '').slice(0, 30); }
/** The group a member number belongs to: its policy record on the group's account or list bill, Group Health or Life. */
function gsbGroupByCard_(card) {
  var out = { group: null, live: true };
  if (card.replace(/[^A-Z0-9]/g, '').length < 6 || typeof tSfOn_ !== 'function' || !tSfOn_()) return out;
  var forms = [card, card.replace(/[-\/]/g, '')].filter(function (x, i, a) { return a.indexOf(x) === i; });
  var rows = gcmQuery_('SELECT Id, POLICY__c, Certificate__c, Account__c, List_Bill__c, Policy_Status_Description__c FROM CLIENT_PORTFOLIO__c WHERE (POLICY__c IN (' + gcmIn_(forms) +
    ') OR Certificate__c IN (' + gcmIn_(forms) + ")) AND RecordType.Name IN ('HEALTH (GROUP)', 'LIFE(GROUP)') LIMIT 5");
  if (!rows.length) return out;
  var reg = gcmRegister_();
  rows.some(function (r) {
    var acct = gcmId15_(String(r.Account__c || '')), bill = typeof gcmBillKey_ === 'function' ? gcmBillKey_(r.List_Bill__c) : String(r.List_Bill__c || '').toUpperCase().replace(/\s+/g, '');
    var g = reg.filter(function (x) { return (acct && x.accts.indexOf(acct) >= 0) || (bill && (x.billKeys || []).indexOf(bill) >= 0); })[0];
    if (!g) return false;
    out.group = g;
    out.live = !/terminat|lapse|cancel|surrender|not taken|declin|withdraw|expire/i.test(String(r.Policy_Status_Description__c || ''));
    return true;
  });
  return out;
}
/** The lines of a schedule that bear on a question, each under its own heading, in the schedule's own order. */
function gsbMatch_(text, q, max) {
  var words = String(q || '').toLowerCase().replace(/[^a-z0-9&%\- ]/g, ' ').split(/\s+/).filter(function (w) { return w.length > 1 && !GSB.STOP[w]; });
  var want = [];
  words.forEach(function (w) {
    var base = w.replace(/(ies)$/, 'y').replace(/s$/, '');
    [w, base].concat(GSB.SYN[w] || GSB.SYN[base] || []).forEach(function (x) { if (x && x.length > 1 && want.indexOf(x) < 0) want.push(x); });
  });
  var lines = String(text || '').split('\n'), head = '', heads = [], scored = [];
  lines.forEach(function (l, i) {
    var t = l.trim(); heads[i] = head;
    if (!t) return;
    if (gsbIsHead_(t)) { head = t.replace(/^#+\s*/, '').replace(/:$/, ''); heads[i] = head; return; }
    if (!want.length) return;
    var low = (t + ' ').toLowerCase(), hl = head.toLowerCase(), s = 0;
    want.forEach(function (w) { if (low.indexOf(w) >= 0) s += 2; else if (hl.indexOf(w) >= 0) s += 1; });
    if (s) scored.push({ i: i, s: s });
  });
  if (!scored.length) {
    /* nothing bears on it: the opening of the schedule (the maximum, the deductible, the co-insurance usually lead) */
    var top = []; for (var k = 0; k < lines.length && top.join('\n').length < 1500; k++) if (lines[k].trim()) top.push(lines[k].trim());
    return { hits: 0, text: top.join('\n') };
  }
  var best = scored.sort(function (a, b) { return b.s - a.s || a.i - b.i; }), keep = {}, size = 0;
  best.some(function (x) { if (size > max) return true; keep[x.i] = true; size += lines[x.i].length + 1; return false; });
  var out = [], lastHead = null;
  Object.keys(keep).map(Number).sort(function (a, b) { return a - b; }).forEach(function (i) {
    if (heads[i] && heads[i] !== lastHead) { out.push('## ' + heads[i]); lastHead = heads[i]; }
    out.push(lines[i].trim());
  });
  return { hits: Object.keys(keep).length, text: out.join('\n').slice(0, max + 400) };
}
/** A heading: "# Dental", a line ending in a colon, or a short line in capitals with no amount in it. */
function gsbIsHead_(t) {
  if (/^#/.test(t)) return true;
  if (t.indexOf('|') >= 0 || t.length > 70) return false;
  if (/:$/.test(t)) return true;
  return /[A-Z]{3}/.test(t) && t === t.toUpperCase() && !/\d/.test(t.replace(/\b(I|II|III|IV)\b/g, ''));
}
function gsbLog_(g, via, phone, q, hits, lines) {
  gsbAppend_(GSB.LOG, GSB.LOG_HEAD, { When: new Date(), Group: g.name, Via: via || '', Phone: phone ? '…' + String(phone).slice(-4) : '',
    Question: String(q || '').slice(0, 400), 'Lines matched': hits || 0, Lines: lines || '' });
}

/* ── the editor: switch WhatsApp look-ups on ─────────────────────────────────────────────────────────────────── */
/** Run once from the editor: makes the key the HELP 868 assistant sends, and shows it once. Paste it into the
 *  assistant's "Look up the member's plan" request in respond.io. Running it again makes a new key (the old one stops). */
function gsbMakeLookupKey() {
  var k = Utilities.getUuid().replace(/-/g, '');
  PropertiesService.getScriptProperties().setProperty(GSB.KEY_PROP, k);
  Logger.log('PLAN_LOOKUP_KEY set. Put this in the respond.io request body as "key": ' + k);
  return 'PLAN_LOOKUP_KEY set (see the log for the value to paste into respond.io).';
}
