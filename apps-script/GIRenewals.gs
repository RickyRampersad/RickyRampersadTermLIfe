/**
 * ============================================================================
 * THE RENEWAL DESK — general insurance renewals, from last year to delivery
 * ============================================================================
 * Asked for on 29 October 2026: "on next month renewals … when Pawan logs in and selects the month and year, he can
 * select the risks, motor, home, pl etc … so any person can help him, then it pulls up last year and guides the renewal
 * process … build a renewal letter based on intelligence and guidance … the task is always opened on the last year
 * renewal … client … approves the cover seeing also the history since inception … comments … channelled through the
 * chatter … once proceed to renew, a new transaction is created for the current year as well the risk created with the
 * confirmed values and an open task on the transaction to follow up, the email is sent to ggrenewals team and copy
 * support and the salessupport team … if they do not respond 2 days turnaround, you are to again follow up with the
 * trail and update the chatter, also a future event is created for a document delivery to pawan".
 * The branch manager's four decisions the same day:
 *   - never renew without the client's yes: reminders at 14 and 10 days, a call at 7, then it goes to him to decide;
 *   - the branch manager or the Branch Manager's Assistant approves every letter, because its recommendations are advice;
 *   - the letter goes once Guardian General's notice gives the premium, and at least 21 days before the renewal;
 *   - the client signs in with a code to their e-mail, and a group sees its renewals on its own page as well.
 *
 * WHERE IT LIVES. This file is in the Service Questionnaire project, beside GroupClients.gs, whose gcm.* routes hand it
 * the gcm.ren* actions (so Service.gs needs no paste). The staff desk is /renewaldesk/, the client's page /myrenewal/,
 * and a group's own page carries a Renewals tab. Salesforce is the record: last year's cover terms (Risk_Details__c)
 * and billing records (TRANSACTIONS__c) are read live. The desk's own workings (the notice read, the letter, the
 * approvals, the client's answer, the instruction, the chases) are one row a renewal on the GI Renewals tab of the
 * group sheet, and every step is a row on the GI Renewal Log.
 *
 * TEST MODE until girGoLive(): the letter, the client's reminders and the instruction to Guardian General go to the
 * person who pressed and to the test inbox, marked TEST. Salesforce is written only on a person's Proceed press, and in
 * test mode only when they tick that the renewal is really going ahead.
 */

var GIR = {
  TAB: 'GI Renewals',
  LOG: 'GI Renewal Log',
  LIVE_PROP: 'GIR_LIVE',                       // set by girGoLive(); until then client and Guardian General mail is TEST
  TEST_TO_PROP: 'GIR_TEST_TO',                 // test copies also go here (comma-separated); default TEST_TO
  TEST_TO: ['Ricky.Rampersad@myguardiangroup.com'],
  /* Guardian General's renewal desks, as the branch addresses them: personal motor and home through CRMS SAL Support,
     commercial through CRMS Commercial, every renewal to CRMS Renewals. The GIR_GG_TO property (JSON) overrides. */
  GG_TO: { personal: ['CRMSRenewals@myguardiangroup.com', 'CRMSSALSupport@myguardiangroup.com'],
           commercial: ['CRMSRenewals@myguardiangroup.com', 'CRMSCommercial@myguardiangroup.com'] },
  CC: ['support@rickyrampersadbranch.com', 'rickyrampersadsalessupport@myguardiangroup.com'],
  CHASE_WD: 2,                                 // no reply from Guardian General in two working days: follow up with the trail
  CHASE_MAX: 4,                                // after this many, the branch manager is told
  LETTER_BY: 21,                               // the letter goes at least this many days before the renewal
  VALUE_DAYS: 45,                              // a value check is due from this many days before
  REMIND: [14, 10],                            // the client's reminders, days before the renewal
  CALL_AT: 7,                                  // no answer this close: a call task, and the branch manager decides
  DELIVER: 'Pawan',                            // the first name of the Salesforce user the delivery appointment goes to (GIR_DELIVERY overrides)
  DESK: 'https://rickyrampersadbranch.com/renewaldesk/',
  SITE: 'https://rickyrampersadbranch.com/myrenewal/',
  LOGO: 'https://rickyrampersadbranch.com/logo-mark.png',
  CODE_TRIES: 5,                               // wrong codes before the e-mail must ask for a new one
  CODE_MIN: 15,                                // a code is good for this many minutes
  SESSION_S: 21600,                            // a client's sign-in lasts six hours
  BRANCH_TELS: '(868) 226-6461, 226-6464 or 226-6465',
  DIRECT_TEL: '(868) 226-MYGG (226-6944)',
  TAX: 0.06
};
var GIR_HEAD = {
  'GI Renewals': ['Key', 'Policy', 'Line', 'Client', 'Account', 'Contact', 'E-mail', 'Renewal', 'Stage', 'Holder', 'Holder e-mail',
    'Last trans', 'Notice', 'Values', 'Letter', 'Submitted by', 'Approved by', 'Approved at', 'Sent at', 'Sent to', 'Test', 'Task',
    'Client view', 'Client answer', 'Reminders', 'Proceed by', 'Proceed at', 'GG to', 'GG subject', 'GG sent at', 'GG mail',
    'New trans', 'New risks', 'Follow task', 'Event', 'Chases', 'GG reply', 'Delivered', 'Paid', 'Outcome', 'Updated'],
  'GI Renewal Log': ['When', 'Key', 'Policy', 'Client', 'Step', 'By', 'Detail']
};
/* The lines, in the order the desk shows them. pre: the policy number's middle letters; rt: Salesforce's cover-term
   record type; trt: its billing record type; personal: which Guardian General desk. */
var GIR_LINES = {
  motor:     { label: 'Motor', noun: 'vehicle',                  rt: 'Motor',                trt: 'T-MOTOR', pre: /^(APG|APC|APU|AOG|ACF|APF|AST|ACC|AMC|AMP|APM)$/, personal: true },
  home:      { label: 'Home', noun: 'home',                   rt: 'Property',             trt: 'T-PROPERTY', pre: /^(FHO|FHC)$/, personal: true },
  property:  { label: 'Commercial property', noun: 'business property',    rt: 'Property',             trt: 'T-PROPERTY', pre: /^(FAR|FCP|FBP|FSB)$/ },
  liability: { label: 'Liability', noun: 'liability cover',              rt: 'Public Liability',     trt: 'T - PUBLIC LIABILITY', pre: /^(CPL|CLC|CPI|CEO|CGL)$/ },
  wc:        { label: 'Workers’ compensation', noun: 'workers’ compensation cover',  rt: 'Workers Compensation', trt: 'T- WORKMEN COMPENSATION & EMP. LIABILITY', pre: /^(CEL|CWC)$/ },
  machinery: { label: 'Machinery and plant', noun: 'machinery and plant',    rt: 'Machinery',            trt: 'T-MACHINERY', pre: /^(FSP|EAR|CAR|EMB|EEI)$/ },
  bond:      { label: 'Bond', noun: 'bond',                   rt: 'Bond',                 trt: 'Bond', pre: /^(BON|BND)$/ },
  marine:    { label: 'Marine', noun: 'marine cover',                 rt: 'MARINE',               trt: 'T - MARINE', pre: /^(MCA|MAR|MCG|MHL)$/ }
};
var GIR_LINE_ORDER = ['motor', 'home', 'property', 'liability', 'wc', 'machinery', 'bond', 'marine'];
/* Where a renewal stands, in order. */
var GIR_STAGES = {
  due:       { n: 1, label: 'Due' },
  notice:    { n: 2, label: 'Notice in' },
  drafted:   { n: 3, label: 'Letter drafted' },
  approval:  { n: 4, label: 'Waiting for approval' },
  sent:      { n: 5, label: 'Letter sent' },
  changes:   { n: 6, label: 'Client asked for changes' },
  approved:  { n: 7, label: 'Client approved' },
  instructed:{ n: 8, label: 'With Guardian General' },
  confirmed: { n: 9, label: 'Documents ready' },
  delivered: { n: 10, label: 'Delivered' },
  done:      { n: 11, label: 'Renewed and paid' },
  renewed:   { n: 11, label: 'Renewed in Salesforce' },
  lost:      { n: 12, label: 'Not renewing' }
};
var GIR_RISK_FIELDS = ['Id', 'Name', 'RecordTypeId', 'RecordType.Name', 'Policy__c', 'Vehicle__c', 'Vehicle_Make__c', 'Model__c', 'Year_of_Manufacture__c',
  'Engine__c', 'Chassis__c', 'CC__c', 'Cover1__c', 'Total_Cover__c', 'NCD__c', 'Windscreen__c', 'Asignee__c', 'Vehicle_Status__c',
  'Motor_Vehicle_Coverage_Type__c', 'Property_Coverage_Type__c', 'Property_Type__c', 'Risk_Location__c', 'Occupancy__c',
  'Stock__c', 'Improvement_Betterment__c', 'Plant_Equipment_Machinery__c', 'General_Contents__c', 'Electronic_Equipment__c',
  'Category_1__c', 'Category_2__c', 'Category_3__c', 'Category_4__c', 'Category_1_Value__c', 'Category_2_Value__c', 'Category_3_Value__c', 'Category_4_Value__c',
  'Make_Model_Category_1__c', 'Make_Model_Category_2__c', 'Make_Model_Category_3__c', 'Make_Model_Category_4__c', 'Serial_1__c', 'Serial_2__c', 'Serial_3__c', 'Serial_4__c',
  'Premium_01_Cover_01__c', 'Total_Premiums_Gov_t_Inclusive__c', 'Carrier__c', 'From__c', 'To__c', 'Next_Renewal_Date__c', 'Risk_Classification__c',
  'TRANSACTIONS__c', 'TRANSACTIONS__r.Name', 'TRANSACTIONS__r.Renewal_Date__c', 'CreatedDate', 'Client_Portfolio_Look_Up__c', 'Insured__c', 'Insured__r.Name', 'Insured__r.FirstName', 'Insured__r.Email', 'Insured__r.MobilePhone',
  'Client_Portfolio_Look_Up__r.Account__c', 'Client_Portfolio_Look_Up__r.Account__r.Name', 'Client_Portfolio_Look_Up__r.Account__r.RecordType.Name',
  'Client_Portfolio_Look_Up__r.Account__r.OwnerId', 'Client_Portfolio_Look_Up__r.Account__r.Owner.Name', 'Client_Portfolio_Look_Up__r.Account__r.Owner.Email',
  'Client_Portfolio_Look_Up__r.Account__r.Owner.IsActive', 'Client_Portfolio_Look_Up__r.Contact__c', 'Client_Portfolio_Look_Up__r.Contact__r.Name',
  'Client_Portfolio_Look_Up__r.Contact__r.FirstName', 'Client_Portfolio_Look_Up__r.Contact__r.Email', 'Client_Portfolio_Look_Up__r.Contact__r.MobilePhone'];
/* The fields a new term copies from last year's, as they were. */
var GIR_COPY = ['Vehicle__c', 'Vehicle_Make__c', 'Model__c', 'Year_of_Manufacture__c', 'Engine__c', 'Chassis__c', 'CC__c', 'Windscreen__c', 'Asignee__c',
  'Motor_Vehicle_Coverage_Type__c', 'Property_Coverage_Type__c', 'Property_Type__c', 'Risk_Location__c', 'Occupancy__c',
  'Stock__c', 'Improvement_Betterment__c', 'Plant_Equipment_Machinery__c', 'General_Contents__c', 'Electronic_Equipment__c',
  'Category_1__c', 'Category_2__c', 'Category_3__c', 'Category_4__c', 'Category_1_Value__c', 'Category_2_Value__c', 'Category_3_Value__c', 'Category_4_Value__c',
  'Make_Model_Category_1__c', 'Make_Model_Category_2__c', 'Make_Model_Category_3__c', 'Make_Model_Category_4__c', 'Serial_1__c', 'Serial_2__c', 'Serial_3__c', 'Serial_4__c', 'Cover1__c'];

/* ── small helpers ─────────────────────────────────────────────────────────────────────── */
function girJ_(x, fb) { try { var v = JSON.parse(gcmText_(x) || 'null'); return v === null ? fb : v; } catch (e) { return fb; } }
function girNum_(x) { var n = Number(String(x === null || x === undefined ? '' : x).replace(/[^0-9.\-]/g, '')); return isNaN(n) ? 0 : n; }
function girR_(x) { return Math.round((Number(x) || 0) * 100) / 100; }
function girMoney_(x) { var v = girR_(x); return 'TT$' + v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
function girWhole_(x) { return 'TT$' + Math.round(Number(x) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
function girPolKey_(p) { var m = /([A-Z]{2})\s*([A-Z]{3})\s*0*(\d+)/i.exec(String(p || '')); return m ? (m[1] + m[2] + m[3]).toUpperCase() : String(p || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
function girPolShow_(p) { var m = /([A-Z]{2})\s*([A-Z]{3})\s*(\d+)/i.exec(String(p || '')); return m ? (m[1] + ' ' + m[2] + ' ' + m[3]).toUpperCase() : String(p || '').trim(); }
function girPolPre_(p) { var m = /[A-Z]{2}\s*([A-Z]{3})\s*\d/i.exec(String(p || '')); return m ? m[1].toUpperCase() : ''; }
function girDigits_(p) { var m = /([A-Z]{2})\s*([A-Z]{3})\s*0*(\d+)/i.exec(String(p || '')); return m ? m[3] : ''; }
function girAddYears_(ymd, n) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd || ''); if (!m) return ''; var d = new Date(Date.UTC(+m[1] + n, +m[2] - 1, +m[3])); return d.toISOString().slice(0, 10); }
function girMdy_(ymd) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(ymd || ''); return m ? Number(m[2]) + '/' + Number(m[3]) + '/' + m[1] : ''; }
function girTitle_(s) { s = String(s || '').trim(); return s === s.toUpperCase() ? s.toLowerCase().replace(/(^|[\s'&(-])([a-z])/g, function (m, p, c) { return p + c.toUpperCase(); }).replace(/\b(Ltd|Hh)\b/g, function (w) { return w === 'Hh' ? 'Household' : 'Ltd'; }) : s; }
/** The client as a person reads it: a household account "SMITH, JANE HH" is "Jane Smith"; a company keeps its name. */
function girClientName_(acct, rt, contactName) {
  var a = String(acct || '').trim();
  if (/\s+HH$/i.test(a) || /household/i.test(String(rt || ''))) {
    var b = a.replace(/\s+HH$/i, ''), m = /^([^,]+),\s*(.+)$/.exec(b);
    return girTitle_(m ? m[2] + ' ' + m[1] : b) || girTitle_(contactName);
  }
  return girTitle_(a) || girTitle_(contactName);
}
function girFirst_(s) { return String(s || '').trim().split(/\s+/)[0] || ''; }
function girStage_(k) { return GIR_STAGES[k] || GIR_STAGES.due; }
function girLive_() { try { return String(PropertiesService.getScriptProperties().getProperty(GIR.LIVE_PROP) || '') === 'on'; } catch (e) { return false; } }
function girTestTo_(who, more) {
  var extra = [];
  try { extra = String(PropertiesService.getScriptProperties().getProperty(GIR.TEST_TO_PROP) || '').split(/[,;\s]+/).filter(String); } catch (e) {}
  var list = [String(who && who.email || '')].concat(more || [], extra.length ? extra : GIR.TEST_TO), seen = {}, out = [];
  list.forEach(function (a) { a = String(a || '').trim(); var k = a.toLowerCase(); if (a && !seen[k] && /@/.test(a)) { seen[k] = 1; out.push(a); } });
  return out;
}
/** Every address a letter went to: one in live mode, the list a test letter went to in test mode. */
function girSentTo_(st) { return gcmText_(st && st['Sent to']).split(/[,;\s]+/).filter(function (a) { return /@/.test(a); }); }
function girWorking_(ymd) { return typeof gblWorkingDay_ === 'function' ? gblWorkingDay_(ymd) : gcmDow_(ymd) <= 5; }
function girNextWorking_(ymd) { var d = gcmAddDays_(ymd, 1); while (!girWorking_(d)) d = gcmAddDays_(d, 1); return d; }
function girPrevWorking_(ymd) { var d = gcmAddDays_(ymd, -1); while (!girWorking_(d)) d = gcmAddDays_(d, -1); return d; }
function girAddWorking_(ymd, n) { var d = ymd; for (var i = 0; i < n; i++) d = girNextWorking_(d); return d; }
/** Working days after a, up to and including b. */
function girWdBetween_(a, b) { if (!a || !b || b <= a) return 0; var n = 0, d = a; while (d < b) { d = gcmAddDays_(d, 1); if (girWorking_(d)) n++; } return n; }
function girMonthOk_(ym) { return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(ym || '')); }
function girMonthEnd_(ym) { var m = /^(\d{4})-(\d{2})$/.exec(ym); var d = new Date(Date.UTC(+m[1], +m[2], 0)); return d.toISOString().slice(0, 10); }
function girMonthLabel_(ym) { var m = /^(\d{4})-(\d{2})$/.exec(ym || ''); return m ? GIR_MONTHS[Number(m[2]) - 1] + ' ' + m[1] : ym; }
var GIR_MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
function girEsc_(s) { return tEsc_(s); }
function girJsonOf_(text) {
  var t = String(text || '').trim().replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/, '');
  var a = t.indexOf('{'), b = t.lastIndexOf('}');
  if (a < 0 || b < a) return null;
  try { return JSON.parse(t.slice(a, b + 1)); } catch (e) { return null; }
}

/* ── the desk's own tabs ───────────────────────────────────────────────────────────────── */
function girSheet_(name) {
  var ss = gcmSS_(), sh = ss.getSheetByName(name), head = GIR_HEAD[name];
  if (!sh) {
    sh = ss.insertSheet(name);
    sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold');
    sh.setFrozenRows(1);
  } else if (sh.getLastColumn() < head.length) {
    var have = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0].map(function (h) { return String(h).trim(); });
    if (have.every(function (h, i) { return !h || h === head[i]; })) sh.getRange(1, have.length + 1, 1, head.length - have.length).setValues([head.slice(have.length)]).setFontWeight('bold');
  }
  return sh;
}
function girRows_(name) { return gcmSS_().getSheetByName(name) ? gcmRows_(name) : []; }
/** Every renewal the desk has worked, by key. */
function girState_() {
  var out = {};
  girRows_(GIR.TAB).forEach(function (r) { var k = gcmText_(r.Key); if (k) out[k] = r; });
  return out;
}
function girCell_(v) {
  if (v === undefined || v === null) return '';
  if (typeof v === 'object' && !(v instanceof Date)) { var s = JSON.stringify(v); return s.length > 49000 ? s.slice(0, 49000) : s; }
  if (typeof v === 'string' && v.length > 49000) return v.slice(0, 49000);
  return v;
}
/** Write fields onto a renewal's row, making it the first time. Whole rows never move: the row is found by its key. */
function girSave_(key, patch) {
  var sh = girSheet_(GIR.TAB), head = GIR_HEAD[GIR.TAB], rows = girRows_(GIR.TAB), at = 0;
  rows.forEach(function (r) { if (gcmText_(r.Key) === key) at = r._n; });
  patch = Object.assign({}, patch, { Key: key, Updated: new Date() });
  if (!at) {
    at = sh.getLastRow() + 1;
    sh.getRange(at, 1, 1, head.length).setValues([head.map(function (h) { return girCell_(patch[h]); })]);
    return;
  }
  head.forEach(function (h, i) { if (Object.prototype.hasOwnProperty.call(patch, h)) sh.getRange(at, i + 1).setValue(girCell_(patch[h])); });
}
function girLog_(key, r, step, by, detail) {
  try {
    var sh = girSheet_(GIR.LOG), head = GIR_HEAD[GIR.LOG];
    var row = { When: new Date(), Key: key, Policy: r ? r.policy || gcmText_(r.Policy) : '', Client: r ? r.client || gcmText_(r.Client) : '', Step: step, By: by || 'the desk', Detail: String(detail || '').slice(0, 2000) };
    sh.getRange(sh.getLastRow() + 1, 1, 1, head.length).setValues([head.map(function (h) { return girCell_(row[h]); })]);
  } catch (e) {}
}

/* ── the month's renewals, from Salesforce ─────────────────────────────────────────────── */
/** Which line a cover term is: by its policy number's letters when they are known, else by its record type. */
function girLineOf_(rt, policy, propType, acctRt) {
  var pre = girPolPre_(policy);
  for (var i = 0; i < GIR_LINE_ORDER.length; i++) { var k = GIR_LINE_ORDER[i]; if (pre && GIR_LINES[k].pre.test(pre)) return k; }
  rt = String(rt || '');
  if (/^Motor$/i.test(rt)) return 'motor';
  if (/^Property$/i.test(rt)) return /private/i.test(propType || '') || /household/i.test(acctRt || '') ? 'home' : 'property';
  if (/Public Liability/i.test(rt)) return 'liability';
  if (/Workers/i.test(rt)) return 'wc';
  if (/Machinery/i.test(rt)) return 'machinery';
  if (/^Bond$/i.test(rt)) return 'bond';
  if (/MARINE/i.test(rt)) return 'marine';
  return '';
}
/** When a term renews: the day after its cover ends (Salesforce's Next Renewal Date when it is within three days of the end,
 *  as the tracker reads it), or a year after it began when the end date was never entered. */
function girRenOf_(r) {
  if (r.To__c) {
    var nx = gcmYmd_(r.Next_Renewal_Date__c);
    return nx && nx >= r.To__c && gcmDays_(r.To__c, nx) <= 3 ? nx : gcmAddDays_(r.To__c, 1);
  }
  return r.From__c ? girAddYears_(r.From__c, 1) : '';
}
function girPath_(o, path) { return path.split('.').reduce(function (v, k) { return v && typeof v === 'object' ? v[k] : undefined; }, o); }
/** One cover term as the desk reads it. */
function girItem_(r) {
  var g = function (p) { var v = girPath_(r, p); return v === undefined || v === null ? '' : v; };
  var cats = [1, 2, 3, 4].map(function (i) { return { cat: g('Category_' + i + '__c'), model: g('Make_Model_Category_' + i + '__c'), serial: g('Serial_' + i + '__c'), value: girNum_(g('Category_' + i + '_Value__c')) }; })
    .filter(function (c) { return c.cat || c.model || c.value; });
  var sums = [['Stock', g('Stock__c')], ['Improvements and betterments', g('Improvement_Betterment__c')], ['Plant, machinery and equipment', g('Plant_Equipment_Machinery__c')],
    ['General contents', g('General_Contents__c')], ['Electronic equipment', g('Electronic_Equipment__c')]].filter(function (s) { return girNum_(s[1]) > 0; }).map(function (s) { return { label: s[0], value: girNum_(s[1]) }; });
  var vehicle = String(g('Vehicle__c')).trim();
  return { id: String(r.Id), name: g('Name'), rt: g('RecordType.Name'), rtId: g('RecordTypeId'), policy: girPolShow_(g('Policy__c')), vehicle: vehicle,
    make: g('Vehicle_Make__c'), model: g('Model__c'), year: g('Year_of_Manufacture__c') || '', engine: g('Engine__c'), chassis: g('Chassis__c'), cc: g('CC__c'),
    value: girNum_(g('Cover1__c')), cover: girNum_(g('Total_Cover__c')), ncd: g('NCD__c'), windscreen: girNum_(g('Windscreen__c')),
    assignee: /^(none|n\/a|-)?$/i.test(String(g('Asignee__c')).trim()) ? '' : String(g('Asignee__c')).trim(), status: g('Vehicle_Status__c'),
    coverage: g('Motor_Vehicle_Coverage_Type__c') || g('Property_Coverage_Type__c'), propType: g('Property_Type__c'), location: String(g('Risk_Location__c')).trim(), occupancy: g('Occupancy__c'),
    sums: sums, cats: cats, premium: girNum_(g('Premium_01_Cover_01__c')), total: girNum_(g('Total_Premiums_Gov_t_Inclusive__c')),
    carrier: g('Carrier__c'), from: gcmYmd_(g('From__c')), to: gcmYmd_(g('To__c')), ren: girRenOf_(r), noEnd: !g('To__c'), cls: g('Risk_Classification__c'),
    trans: g('TRANSACTIONS__c'), transName: g('TRANSACTIONS__r.Name'), transRen: gcmYmd_(g('TRANSACTIONS__r.Renewal_Date__c')), created: String(g('CreatedDate')),
    shell: g('Client_Portfolio_Look_Up__c'),
    account: g('Client_Portfolio_Look_Up__r.Account__c'), client: girClientName_(g('Client_Portfolio_Look_Up__r.Account__r.Name'), g('Client_Portfolio_Look_Up__r.Account__r.RecordType.Name'), g('Client_Portfolio_Look_Up__r.Contact__r.Name') || g('Insured__r.Name')), acctRt: g('Client_Portfolio_Look_Up__r.Account__r.RecordType.Name'),
    owner: { id: g('Client_Portfolio_Look_Up__r.Account__r.OwnerId'), name: g('Client_Portfolio_Look_Up__r.Account__r.Owner.Name'), email: String(g('Client_Portfolio_Look_Up__r.Account__r.Owner.Email')).toLowerCase(),
             active: g('Client_Portfolio_Look_Up__r.Account__r.Owner.IsActive') !== false },
    contact: { id: g('Client_Portfolio_Look_Up__r.Contact__c') || g('Insured__c'), name: g('Client_Portfolio_Look_Up__r.Contact__r.Name') || g('Insured__r.Name'),
               first: g('Client_Portfolio_Look_Up__r.Contact__r.FirstName') || g('Insured__r.FirstName'),
               email: String(g('Client_Portfolio_Look_Up__r.Contact__r.Email') || g('Insured__r.Email')).trim(),
               mobile: g('Client_Portfolio_Look_Up__r.Contact__r.MobilePhone') || g('Insured__r.MobilePhone') } };
}
/** The cover terms renewing in a month (and those with no end date that began a year before it). */
function girMonthRisks_(ym) {
  var a = ym + '-01', z = girMonthEnd_(ym), types = GIR_LINE_ORDER.map(function (k) { return GIR_LINES[k].rt; }).filter(function (v, i, arr) { return arr.indexOf(v) === i; });
  var soql = 'SELECT ' + GIR_RISK_FIELDS.join(', ') + ' FROM Risk_Details__c WHERE RecordType.Name IN (' + gcmIn_(types) + ') AND ' +
    '((To__c >= ' + gcmAddDays_(a, -4) + ' AND To__c <= ' + z + ') OR (To__c = null AND From__c >= ' + gcmAddDays_(girAddYears_(a, -1), -4) + ' AND From__c <= ' + girAddYears_(z, -1) + '))';
  return gcmQuery_(soql).map(girItem_).filter(function (x) {
    return x.ren >= a && x.ren <= z && (!x.carrier || /guardian/i.test(x.carrier)) && !/sold|cancel|remov|inactive|deleted/i.test(String(x.status || ''));
  });
}
/** One renewal a policy and month: its items, last year's premium and cover, who the client is. */
function girBundle_(items, ym) {
  var by = {}, transKey = {};
  /* an item with no policy number joins the policy whose billing record it is on (a machine added to a plant policy and
     filed without the number), rather than reading as a renewal of its own; a billing record shared by two policies joins
     it to neither */
  items.slice().sort(function (a, b) { return (girPolKey_(a.policy) ? 0 : 1) - (girPolKey_(b.policy) ? 0 : 1); }).forEach(function (x) {
    var line = girLineOf_(x.rt, x.policy, x.propType, x.acctRt), joined = false;
    if (!line) return;
    var pk = girPolKey_(x.policy);
    var tk = x.trans ? transKey[gcmId15_(x.trans)] : null;
    if (!pk && tk && tk.length === 1) { pk = tk[0]; joined = true; }
    pk = pk || ('NOPOL-' + (x.shell || x.id));
    var key = pk + '|' + ym;
    var r = by[key] || (by[key] = { key: key, pk: pk, month: ym, policy: x.policy, line: line, lineLabel: GIR_LINES[line].label, items: [], trans: [], shells: [], ren: x.ren,
      client: x.client, account: x.account, acctRt: x.acctRt, owner: x.owner, contact: x.contact, noEnd: false, lastPremium: 0, lastCover: 0, assignees: [] });
    if (joined) { (r.noPol = r.noPol || []).push({ label: girIdent_(x) ? girIdent_(x).label : ([x.cats[0] && x.cats[0].model, x.make, x.model].filter(Boolean).join(' ') || 'An item'), trans: x.transName || '' }); }
    if (girPolKey_(x.policy) && x.trans) { var t15 = gcmId15_(x.trans); transKey[t15] = transKey[t15] || []; if (transKey[t15].indexOf(pk) < 0) transKey[t15].push(pk); }
    if (!r.policy && x.policy) r.policy = x.policy;
    if (x.ren < r.ren) r.ren = x.ren;
    if (!r.contact.email && x.contact.email) r.contact = x.contact;
    r.items.push(x);
    if (x.shell && r.shells.indexOf(x.shell) < 0) r.shells.push(x.shell);
    if (x.assignee && r.assignees.indexOf(x.assignee) < 0) r.assignees.push(x.assignee);
  });
  return Object.keys(by).map(function (k) {
    var r = by[k], d = girDedupe_(r.items);
    r.allIds = r.items.map(function (x) { return x.id; });
    r.items = d.keep;
    r.fixes = d.notes;
    r.items.forEach(function (x) {
      if (x.trans && r.trans.indexOf(x.trans) < 0) r.trans.push(x.trans);
      if (x.noEnd) r.noEnd = true;
      r.lastPremium = girR_(r.lastPremium + x.total);
      r.lastCover += x.cover || x.value || 0;
    });
    return r;
  });
}

/* ── one item, one term: Salesforce's double entries ───────────────────────────────────────
   Read on the real November 2026 renewals: the same vehicle entered twice for one term (one copy on last year's billing
   record), a mid-term change kept as a term of its own, and two different terms for one vehicle in one year. Each was
   counted, so last year's premium came out at twice or three times what was billed. Rows are merged only when they share
   an identity: a registration, a chassis, a serial, or an address with the same cover. Rows with none are never merged:
   four loaders that differ only by serial are four loaders, and four rows with nothing to tell them apart may be four
   people on a travel policy (the billing record then says four times the premium). Nothing in Salesforce is changed:
   each merge is named in the insights, so staff correct the record. */
var GIR_DUP = { MATCH_DAYS: 45, MID_MIN: 30, MID_END: 5, FULL: 300, OVERLAP: 180 };
function girIdent_(x) {
  var n = function (s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); };
  if (n(x.vehicle)) return { k: 'v:' + n(x.vehicle), strong: true, label: String(x.vehicle).trim() };
  if (n(x.chassis)) return { k: 'c:' + n(x.chassis), strong: true, label: 'Chassis ' + String(x.chassis).trim() };
  var ser = (x.cats || []).map(function (c) { return n(c.serial); }).filter(String);
  if (ser.length) return { k: 's:' + ser.join('|'), strong: true, label: ((x.cats[0].model || x.cats[0].cat || 'Item') + ' (serial ' + x.cats[0].serial + ')').trim() };
  if (n(x.location)) return { k: 'l:' + n(x.location) + '|' + n(x.coverage) + '|' + n(x.propType) + '|' + Math.round(x.cover || x.value || 0), strong: false, label: String(x.location).trim().slice(0, 60) };
  return null;
}
/** Whether a term sits on the billing record of its own year (the record's renewal date within MATCH_DAYS of the term's start). */
function girTransOk_(x) { var d = x.from && x.transRen ? gcmDays_(x.from, x.transRen) : null; return d !== null && Math.abs(d) <= GIR_DUP.MATCH_DAYS; }
function girSpan_(x) { return x.from && x.to ? gcmDays_(x.from, x.to) : null; }
/** One row an item and term. Returns { keep, notes }: keep in the order given; notes say what was merged and why. */
function girDedupe_(items) {
  var groups = {}, notes = [], drop = {};
  items.forEach(function (x) { var id = girIdent_(x); if (!id) return; x._ident = id; (groups[id.k] = groups[id.k] || []).push(x); });
  var better = function (a, b) { return (girTransOk_(b) ? 1 : 0) - (girTransOk_(a) ? 1 : 0) || String(a.created || '').localeCompare(String(b.created || '')); };
  Object.keys(groups).forEach(function (k) {
    var g = groups[k], label = g[0]._ident.label;
    /* 1. the same term entered more than once */
    var same = {};
    g.forEach(function (x) { var b = (x.from || '') + '|' + (x.to || '') + '|' + Math.round(girNum_(x.total) * 100); (same[b] = same[b] || []).push(x); });
    Object.keys(same).forEach(function (b) {
      var s = same[b]; if (s.length < 2) return;
      s.sort(better);
      s.slice(1).forEach(function (x) { drop[x.id] = 1; });
      notes.push({ kind: 'dup', label: label, n: s.length, total: s[0].total, from: s[0].from, to: s[0].to, kept: s[0].transName || '',
        extra: s.slice(1).map(function (x) { return x.transName || ''; }).filter(function (v, i, a) { return v && v !== s[0].transName && a.indexOf(v) === i; }) });
    });
    var live = g.filter(function (x) { return !drop[x.id]; });
    /* 2. two different full terms for one vehicle in one year: the one on its own year's billing record wins */
    if (g[0]._ident.strong) {
      var full = live.filter(function (x) { var sp = girSpan_(x); return sp !== null && sp >= GIR_DUP.FULL; }).sort(function (a, b) { return String(a.from).localeCompare(String(b.from)); });
      var used = {};
      full.forEach(function (a, i) {
        if (used[a.id]) return;
        var cl = [a];
        full.slice(i + 1).forEach(function (b) {
          if (used[b.id]) return;
          var lo = a.from > b.from ? a.from : b.from, hi = a.to < b.to ? a.to : b.to, ov = gcmDays_(lo, hi);
          if (ov !== null && ov >= GIR_DUP.OVERLAP) cl.push(b);
        });
        if (cl.length < 2) return;
        cl.forEach(function (x) { used[x.id] = 1; });
        var ok = cl.filter(girTransOk_), pool = (ok.length ? ok : cl).slice().sort(better), win = pool[0];
        cl.forEach(function (x) { if (x !== win) drop[x.id] = 1; });
        notes.push({ kind: ok.length === 1 ? 'wrong' : 'conflict', label: label, kept: { total: win.total, from: win.from, to: win.to, trans: win.transName || '' },
          others: cl.filter(function (x) { return x !== win; }).map(function (x) { return { total: x.total, from: x.from, to: x.to, trans: x.transName || '', transYear: (x.transRen || '').slice(0, 4) }; }) });
      });
      live = g.filter(function (x) { return !drop[x.id]; });
    }
    /* 3. a mid-term change kept as a term of its own: folded into the term it changed */
    var mains = live.filter(function (x) { var sp = girSpan_(x); return sp !== null && sp >= GIR_DUP.FULL; });
    live.forEach(function (t) {
      var sp = girSpan_(t); if (sp === null || sp >= GIR_DUP.FULL) return;
      var m = mains.filter(function (x) {
        if (x === t || !t.from || !x.from) return false;
        var into = gcmDays_(x.from, t.from), end = gcmDays_(x.to, t.to);
        return into !== null && into >= GIR_DUP.MID_MIN && t.from < x.to && end !== null && Math.abs(end) <= GIR_DUP.MID_END;
      }).sort(function (a, b) { return (b.trans === t.trans ? 1 : 0) - (a.trans === t.trans ? 1 : 0); })[0];
      if (!m) return;
      drop[t.id] = 1;
      if (m.base === undefined) m.base = m.total;
      (m.mid = m.mid || []).push({ from: t.from, to: t.to, total: t.total });
      m.total = girR_(m.total + girNum_(t.total));
      notes.push({ kind: 'mid', label: label, base: m.base, add: t.total, from: t.from, total: m.total });
    });
  });
  items.forEach(function (x) { delete x._ident; });
  return { keep: items.filter(function (x) { return !drop[x.id]; }), notes: notes };
}
/** Whether a newer term is already in Salesforce for each renewal (same policy, or the same vehicle, from about the renewal). */
function girMarkRenewed_(list) {
  var shells = [], vehicles = [];
  list.forEach(function (r) { r.shells.forEach(function (s) { if (shells.indexOf(s) < 0) shells.push(s); }); r.items.forEach(function (x) { if (x.vehicle && vehicles.indexOf(x.vehicle) < 0) vehicles.push(x.vehicle); }); });
  if (!shells.length) return list;
  var since = list.reduce(function (m, r) { return !m || r.ren < m ? r.ren : m; }, '');
  var newer = [];
  try {
    for (var i = 0; i < shells.length; i += 150) {
      newer = newer.concat(gcmQuery_('SELECT Id, Policy__c, Vehicle__c, From__c, To__c, TRANSACTIONS__c, Client_Portfolio_Look_Up__c FROM Risk_Details__c WHERE Client_Portfolio_Look_Up__c IN (' +
        gcmIn_(shells.slice(i, i + 150)) + ') AND From__c >= ' + gcmAddDays_(since, -40)));
    }
  } catch (e) { return list; }
  list.forEach(function (r) {
    var mine = r.allIds || r.items.map(function (x) { return x.id; });
    var hit = newer.filter(function (n) {
      if (mine.indexOf(n.Id) >= 0 || !n.From__c) return false;
      var d = gcmDays_(r.ren, gcmYmd_(n.From__c));
      return d !== null && d >= -40 && d <= 60 && (girPolKey_(n.Policy__c) === r.pk || r.items.some(function (x) { return x.vehicle && x.vehicle === String(n.Vehicle__c || '').trim(); }));
    });
    if (hit.length) r.newer = { n: hit.length, trans: hit[0].TRANSACTIONS__c || '', from: gcmYmd_(hit[0].From__c) };
  });
  return list;
}

/* ── who is asking ─────────────────────────────────────────────────────────────────────── */
/** Staff, the Branch Manager's Assistant and the branch manager, signed in as group client management signs them in. */
function girWho_(p) {
  var w = gcmWho_(p);
  if (!w.ok) return w;
  w.approver = w.role === 'branch' || w.role === 'deputy';
  return w;
}

/* ── the month: the desk's list ─────────────────────────────────────────────────────────── */
/** gcm.renList: every renewal in a month, with where each stands, the line counts and the tiles. */
function girList_(p) {
  var who = girWho_(p);
  if (!who.ok) return who;
  if (!tSfOn_()) return { ok: false, error: 'Salesforce is not linked to this project yet, so the renewals cannot be read.' };
  var today = gcmToday_(), ym = girMonthOk_(p.month) ? String(p.month) : girAddYears_(today, 0).slice(0, 7);
  var list;
  try { list = girMarkRenewed_(girBundle_(girMonthRisks_(ym), ym)); } catch (e) { return { ok: false, error: String(e && e.message ? e.message : e).slice(0, 300) }; }
  var st = girState_(), lines = {}, tiles = { all: 0, mine: 0, noLetter: 0, waiting: 0, approved: 0, instructed: 0, done: 0, late: 0, noEmail: 0 };
  var rows = list.map(function (r) {
    var s = st[r.key] || null, stage = girStageOf_(r, s), days = gcmDays_(today, r.ren);
    var holder = s ? gcmText_(s.Holder) : '', notice = s ? girJ_(s.Notice, null) : null, answer = s ? girJ_(s['Client answer'], null) : null;
    var email = (s && gcmText_(s['E-mail'])) || r.contact.email;
    var late = ['due', 'notice', 'drafted', 'approval'].indexOf(stage) >= 0 && days !== null && days < GIR.LETTER_BY ||
      ['sent', 'changes'].indexOf(stage) >= 0 && days !== null && days <= GIR.CALL_AT;
    var row = { key: r.key, policy: r.policy, line: r.line, lineLabel: r.lineLabel, client: r.client, ren: r.ren, days: days, n: r.items.length,
      what: girWhatShort_(r), lastPremium: r.lastPremium, newTotal: notice ? notice.total || 0 : 0, stage: stage, stageLabel: girStage_(stage).label,
      holder: holder, owner: r.owner.name || '', ownerActive: r.owner.active, email: email ? 1 : 0, noEnd: r.noEnd, late: !!late,
      mine: !!(holder && gcmSameName_(holder, who.name)) || (!holder && !!who.email && r.owner.email === String(who.email).toLowerCase()),
      answer: answer ? answer.decision : '', renewedInSf: !!r.newer };
    lines[r.line] = (lines[r.line] || 0) + 1;
    tiles.all++;
    if (row.mine) tiles.mine++;
    if (['due', 'notice', 'drafted', 'approval'].indexOf(stage) >= 0) tiles.noLetter++;
    if (['sent', 'changes'].indexOf(stage) >= 0) tiles.waiting++;
    if (stage === 'approved') tiles.approved++;
    if (stage === 'instructed' || stage === 'confirmed') tiles.instructed++;
    if (['delivered', 'done', 'renewed'].indexOf(stage) >= 0) tiles.done++;
    if (row.late) tiles.late++;
    if (!email) tiles.noEmail++;
    return row;
  }).sort(function (a, b) { return String(a.ren).localeCompare(String(b.ren)) || String(a.client).localeCompare(String(b.client)); });
  return { ok: true, month: ym, monthLabel: girMonthLabel_(ym), today: today, rows: rows, lines: GIR_LINE_ORDER.map(function (k) { return { k: k, label: GIR_LINES[k].label, n: lines[k] || 0 }; }),
    tiles: tiles, me: { name: who.name, role: who.role, title: who.title, approver: who.approver }, live: girLive_(), mail: !!tMsCreds_(), ai: !!gcmAiKey_() };
}
/** What renews, in a few words: "PEE6927 Kia Sportage", "3 vehicles", "LP 451 Southern Main Road". */
function girWhatShort_(r) {
  var x = r.items[0] || {};
  if (r.items.length > 1) return r.items.length + (r.line === 'motor' ? ' vehicles' : r.line === 'home' || r.line === 'property' ? ' locations or items' : ' items');
  if (x.vehicle) return [x.vehicle, x.make, x.model].filter(String).join(' ');
  if (x.location) return x.location.slice(0, 60);
  if (x.cats && x.cats[0]) return [x.cats[0].cat, x.cats[0].model].filter(String).join(' ').slice(0, 60);
  return r.lineLabel;
}
/** Where a renewal stands: the desk's own stage, or "renewed" when a newer term is already in Salesforce. */
function girStageOf_(r, s) {
  var k = s ? gcmText_(s.Stage) : '';
  if (k && GIR_STAGES[k]) return k;
  return r.newer ? 'renewed' : 'due';
}

/* ── one renewal, opened ───────────────────────────────────────────────────────────────── */
/** The renewal as the month reads it, found again by its key. */
function girFind_(key) {
  var m = /^(.+)\|(\d{4}-\d{2})$/.exec(String(key || ''));
  if (!m) return null;
  var list = girMarkRenewed_(girBundle_(girMonthRisks_(m[2]), m[2]));
  return list.filter(function (r) { return r.key === key; })[0] || null;
}
/** gcm.renOne: everything the desk shows for one renewal. */
function girOne_(p) {
  var who = girWho_(p);
  if (!who.ok) return who;
  if (!tSfOn_()) return { ok: false, error: 'Salesforce is not linked to this project yet.' };
  var r = girFind_(p.key);
  if (!r) return { ok: false, error: 'That renewal is not in Salesforce for that month any more. Refresh the list.' };
  var s = girState_()[r.key] || null, today = gcmToday_();
  var claims = girClaims_(r), hist = girHistory_(r, { staff: true, claims: claims }), bills = girBills_(r), tasks = girTasks_(r);
  var notice = s ? girJ_(s.Notice, null) : null, letter = s ? girJ_(s.Letter, null) : null, answer = s ? girJ_(s['Client answer'], null) : null;
  var stage = girStageOf_(r, s), insights = girInsights_(r, hist, claims, bills, notice, today);
  var log = girRows_(GIR.LOG).filter(function (x) { return gcmText_(x.Key) === r.key; }).map(function (x) { return { at: gcmWhen_(x.When), step: gcmText_(x.Step), by: gcmText_(x.By), detail: gcmText_(x.Detail) }; }).reverse();
  return { ok: true, today: today, me: { name: who.name, role: who.role, title: who.title, approver: who.approver }, live: girLive_(), mail: !!tMsCreds_(), ai: !!gcmAiKey_(),
    r: girPublic_(r), stage: stage, stageLabel: girStage_(stage).label, days: gcmDays_(today, r.ren),
    holder: s ? gcmText_(s.Holder) : '', email: (s && gcmText_(s['E-mail'])) || r.contact.email || '',
    history: hist, claims: claims, bills: bills, tasks: tasks, insights: insights, notice: notice, values: s ? girJ_(s.Values, {}) : {},
    letter: letter, submittedBy: s ? gcmText_(s['Submitted by']) : '', approvedBy: s ? gcmText_(s['Approved by']) : '', approvedAt: s ? gcmWhen_(s['Approved at']) : '',
    sentAt: s && s['Sent at'] ? gcmWhen_(s['Sent at']) : '', sentTo: s ? gcmText_(s['Sent to']) : '', test: s ? gcmText_(s.Test) === 'Y' : false,
    task: s ? gcmText_(s.Task) : '', answer: answer, reminders: s ? girJ_(s.Reminders, {}) : {},
    proceed: s && s['Proceed at'] ? { by: gcmText_(s['Proceed by']), at: gcmWhen_(s['Proceed at']), to: gcmText_(s['GG to']), subject: gcmText_(s['GG subject']),
      trans: gcmText_(s['New trans']), risks: girJ_(s['New risks'], []), follow: gcmText_(s['Follow task']), event: gcmText_(s.Event) } : null,
    chases: s ? girJ_(s.Chases, []) : [], ggReply: s ? girJ_(s['GG reply'], null) : null, delivered: s ? gcmText_(s.Delivered) : '', paid: s ? gcmText_(s.Paid) : '',
    outcome: s ? gcmText_(s.Outcome) : '', log: log, sfUrl: girSfBase_(), practice: girPracticeFor_(who, s) };
}
function girSfBase_() { try { return svcSfToken_().instance_url + '/'; } catch (e) { return ''; } }
/** The renewal without Salesforce's raw shape: what the pages and the letter need. */
function girPublic_(r) {
  return { key: r.key, policy: r.policy, line: r.line, lineLabel: r.lineLabel, client: r.client, account: r.account, ren: r.ren, month: r.month,
    owner: r.owner, contact: r.contact, noEnd: r.noEnd, lastPremium: r.lastPremium, lastCover: r.lastCover, assignees: r.assignees, trans: r.trans, newer: r.newer || null,
    items: r.items.map(function (x) {
      return { id: x.id, name: x.name, vehicle: x.vehicle, make: x.make, model: x.model, year: x.year, value: x.value, cover: x.cover, windscreen: x.windscreen,
        ncd: x.ncd, assignee: x.assignee, coverage: x.coverage, location: x.location, occupancy: x.occupancy, sums: x.sums, cats: x.cats,
        premium: x.premium, total: x.total, base: x.base === undefined ? null : x.base, mid: x.mid || null, from: x.from, to: x.to, noEnd: x.noEnd, policy: x.policy, trans: x.trans };
    }) };
}

/* ── last year, and every year before it ───────────────────────────────────────────────── */
/** The policy's whole history since inception, one entry a term, oldest first: the term's dates and policy number, what
 *  was insured and at what value, the premium and its change, what was billed and paid and when, the claims in the term,
 *  the desk's own renewal of that year, and, for staff only (opt.staff), that year's tasks with their last notes.
 *  opt.claims: the claims already read (girClaims_), so they are not read twice. A part Salesforce refuses is left out
 *  and named in `gaps`; the rest still comes. */
var GIR_HIST = { TASKS: 200, NOTES: 400, NOTE_LEN: 320, BILL_SLACK: 45 };
function girHistory_(r, opt) {
  opt = opt || {};
  var vehicles = r.items.map(function (x) { return x.vehicle; }).filter(String), where = [];
  if (r.shells.length) where.push('Client_Portfolio_Look_Up__c IN (' + gcmIn_(r.shells) + ')');
  if (vehicles.length) where.push('Vehicle__c IN (' + gcmIn_(vehicles) + ')');
  var empty = { years: [], vehicles: [], since: '', summary: null, gaps: [] };
  if (!where.length) return empty;
  var rows = [];
  try { rows = gcmQuery_('SELECT Id, Policy__c, Vehicle__c, Vehicle_Make__c, Model__c, Chassis__c, Serial_1__c, Serial_2__c, Serial_3__c, Serial_4__c, Make_Model_Category_1__c, ' +
    'Cover1__c, Total_Cover__c, Premium_01_Cover_01__c, Total_Premiums_Gov_t_Inclusive__c, Motor_Vehicle_Coverage_Type__c, Property_Coverage_Type__c, Property_Type__c, ' +
    'From__c, To__c, Risk_Location__c, TRANSACTIONS__c, TRANSACTIONS__r.Name, TRANSACTIONS__r.Renewal_Date__c, CreatedDate, Client_Portfolio_Look_Up__c FROM Risk_Details__c WHERE ' + where.join(' OR ') + ' ORDER BY From__c ASC'); } catch (e) { empty.error = String(e.message || e).slice(0, 200); return empty; }
  var mineV = {}; vehicles.forEach(function (v) { mineV[v] = 1; });
  rows = rows.filter(function (x) { return girPolKey_(x.Policy__c) === r.pk || (x.Vehicle__c && mineV[String(x.Vehicle__c).trim()]); });
  /* one row an item and term, as the month reads them (girDedupe_): a double entry is counted once, a mid-term change is
     added to the term it changed */
  rows = girDedupe_(rows.map(function (x) {
    var tr = x.TRANSACTIONS__r || {}, to = gcmYmd_(x.To__c);
    return { id: String(x.Id), raw: x, vehicle: String(x.Vehicle__c || '').trim(), chassis: String(x.Chassis__c || '').trim(), location: String(x.Risk_Location__c || '').trim(),
      cats: [1, 2, 3, 4].map(function (i) { return { serial: x['Serial_' + i + '__c'] || '', model: i === 1 ? x.Make_Model_Category_1__c || '' : '' }; }).filter(function (c) { return c.serial; }),
      coverage: x.Motor_Vehicle_Coverage_Type__c || x.Property_Coverage_Type__c || '', propType: x.Property_Type__c || '', cover: girNum_(x.Total_Cover__c), value: girNum_(x.Cover1__c),
      from: gcmYmd_(x.From__c) || (to ? girAddYears_(to, -1) : ''), to: to, total: girNum_(x.Total_Premiums_Gov_t_Inclusive__c),
      trans: x.TRANSACTIONS__c || '', transName: tr.Name || '', transRen: gcmYmd_(tr.Renewal_Date__c), created: String(x.CreatedDate || '') };
  })).keep;
  var years = {}, veh = {}, since = '', gaps = [], fullT = {};
  rows.forEach(function (row) {
    var x = row.raw, from = row.from;
    if (!from) return;
    if (!since || from < since) since = from;
    var y = from.slice(0, 4), t = years[y] || (years[y] = { year: y, from: from, to: '', premium: 0, cover: 0, items: 0, policies: [], risks: [], trans: [], bills: [], claims: [], tasks: [] });
    if (from < t.from) t.from = from;
    var to = gcmYmd_(x.To__c); if (to && to > t.to) t.to = to;
    var prem = girR_(row.total), val = girNum_(x.Cover1__c) || girNum_(x.Total_Cover__c);
    t.premium = girR_(t.premium + prem);
    t.cover += girNum_(x.Total_Cover__c) || girNum_(x.Cover1__c);
    t.items++;
    var pol = girPolShow_(x.Policy__c); if (pol && t.policies.indexOf(pol) < 0) t.policies.push(pol);
    var v = String(x.Vehicle__c || '').trim();
    t.risks.push({ kind: v ? 'vehicle' : x.Risk_Location__c ? 'location' : 'cover', label: v ? [x.Vehicle_Make__c, x.Model__c].filter(Boolean).join(' ') + ' (' + v + ')' : (x.Risk_Location__c || 'Cover'),
      value: val, premium: prem });
    if (x.TRANSACTIONS__c && t.trans.indexOf(gcmId15_(x.TRANSACTIONS__c)) < 0) { t.trans.push(gcmId15_(x.TRANSACTIONS__c)); fullT[gcmId15_(x.TRANSACTIONS__c)] = String(x.TRANSACTIONS__c); }
    if (v && mineV[v]) {
      var vv = veh[v] || (veh[v] = { reg: v, desc: [x.Vehicle_Make__c, x.Model__c].filter(Boolean).join(' '), years: [] });
      vv.years.push({ year: y, value: girNum_(x.Cover1__c), premium: prem });
    }
  });
  var list = Object.keys(years).sort().map(function (k) { return years[k]; });
  list.forEach(function (t, i) {
    var prev = list[i - 1];
    t.change = prev && prev.premium ? Math.round((t.premium - prev.premium) / prev.premium * 1000) / 10 : null;
    if (!t.to) t.to = gcmAddDays_(girAddYears_(t.from, 1), -1);
  });
  var yearOf = function (ymd) { if (!ymd) return null; for (var i = list.length - 1; i >= 0; i--) if (ymd >= list[i].from && ymd <= list[i].to) return list[i]; return null; };

  /* billing and payments, every year: the records the terms point to, and any billing record on the policy record */
  var tids = [], bills = {};
  list.forEach(function (t) { t.trans.forEach(function (id) { if (tids.indexOf(fullT[id]) < 0) tids.push(fullT[id]); }); });
  if (tids.length || r.shells.length) {
    var tw = []; if (tids.length) tw.push('Id IN (' + gcmIn_(tids) + ')'); if (r.shells.length) tw.push('INSURANCE_PORTFOLIO__c IN (' + gcmIn_(r.shells) + ')');
    var tsel = 'SELECT Id, Name, Renewal_Date__c, Billing_Premiums__c, Payments_Made__c, Premium_Owed__c, Policy_Renewed__c FROM TRANSACTIONS__c WHERE ';
    var trows = null;
    try { trows = gcmQuery_(tsel + tw.join(' OR ')); } catch (e) { try { trows = tids.length ? gcmQuery_(tsel + 'Id IN (' + gcmIn_(tids) + ')') : []; } catch (e2) { trows = null; } }
    if (trows === null) gaps.push('billing');
    (trows || []).forEach(function (b) {
      bills[gcmId15_(b.Id)] = { id: b.Id, name: b.Name || '', ren: gcmYmd_(b.Renewal_Date__c), billed: girNum_(b.Billing_Premiums__c), paid: girNum_(b.Payments_Made__c),
        owed: girNum_(b.Premium_Owed__c), renewed: b.Policy_Renewed__c || '', pays: [], firstPaid: '', lateDays: null };
    });
    var bids = Object.keys(bills);
    if (bids.length) {
      try {
        gcmQuery_('SELECT PMTS__c, Payment_Made__c, Date_Paid__c, Payment_Type__c FROM Payments__c WHERE PMTS__c IN (' + gcmIn_(bids.map(function (k) { return bills[k].id; })) + ')').forEach(function (x) {
          var b = bills[gcmId15_(x.PMTS__c)]; if (b) b.pays.push({ amount: girNum_(x.Payment_Made__c), on: gcmYmd_(x.Date_Paid__c), how: x.Payment_Type__c || '' });
        });
      } catch (e) { gaps.push('payments'); }
    }
    bids.forEach(function (id) {
      var b = bills[id];
      b.pays.sort(function (a, c) { return String(a.on).localeCompare(String(c.on)); });
      b.firstPaid = b.pays.length ? b.pays[0].on : '';
      b.lateDays = b.firstPaid && b.ren ? gcmDays_(b.ren, b.firstPaid) : null;
      var t = list.filter(function (y) { return y.trans.indexOf(id) >= 0; })[0];
      if (!t && b.ren) t = list.filter(function (y) { return Math.abs(gcmDays_(y.from, b.ren)) <= GIR_HIST.BILL_SLACK; })[0] || yearOf(b.ren);
      if (t) { if (!t.bills.some(function (z) { return gcmId15_(z.id) === id; })) t.bills.push(b); }
    });
  }

  /* claims, by the term they fell in */
  var claims = opt.claims || girClaims_(r), before = 0;
  claims.forEach(function (c) { var t = yearOf(c.on); if (t) t.claims.push({ on: c.on, type: c.type, status: c.status, paid: c.paid, vehicle: c.vehicle }); else before++; });

  /* the desk's own renewals of earlier years */
  var desk = {};
  try {
    girRows_(GIR.TAB).forEach(function (st) {
      var k = gcmText_(st.Key); if (k.indexOf(r.pk + '|') !== 0 || k === r.key) return;
      var a = girJ_(st['Client answer'], null);
      desk[k.split('|')[1]] = { month: k.split('|')[1], stage: gcmText_(st.Stage), sentAt: st['Sent at'] ? gcmWhen_(st['Sent at']) : '', answer: a ? a.decision : '',
        outcome: gcmText_(st.Outcome), proceedAt: st['Proceed at'] ? gcmWhen_(st['Proceed at']) : '', test: gcmText_(st.Test) === 'Y' };
    });
  } catch (e) {}
  list.forEach(function (t) { t.desk = desk[t.from.slice(0, 7)] || null; });

  /* staff: each year's tasks on its billing records, with their last notes */
  if (opt.staff) {
    var allB = Object.keys(bills);
    if (allB.length) {
      var tasks = [];
      try { tasks = gcmQuery_('SELECT Id, Subject, Status, IsClosed, CreatedDate, LastModifiedDate, ActivityDate, Owner.Name, WhatId FROM Task WHERE WhatId IN (' + gcmIn_(allB.map(function (k) { return bills[k].id; })) +
        ') ORDER BY CreatedDate ASC LIMIT ' + GIR_HIST.TASKS); } catch (e) { gaps.push('tasks'); }
      var notes = {};
      if (tasks.length) {
        try {
          gcmQuery_('SELECT ParentId, Body, CreatedDate, CreatedBy.Name FROM FeedItem WHERE ParentId IN (' + gcmIn_(tasks.map(function (t) { return t.Id; })) + ') ORDER BY CreatedDate DESC LIMIT ' + GIR_HIST.NOTES)
            .forEach(function (f) {
              var text = String(f.Body || '').replace(/<[^>]+>/g, ' ').replace(/&nbsp;/g, ' ').replace(/&amp;/g, '&').replace(/\s+/g, ' ').trim();
              if (!text) return;
              var k2 = gcmId15_(f.ParentId), n2 = notes[k2] || (notes[k2] = []);
              n2.push({ on: gcmYmd_(f.CreatedDate), by: f.CreatedBy ? f.CreatedBy.Name || '' : '', text: text.slice(0, GIR_HIST.NOTE_LEN) });
            });
        } catch (e) { gaps.push('notes'); }
      }
      tasks.forEach(function (x) {
        var b = bills[gcmId15_(x.WhatId)]; if (!b) return;
        var t = list.filter(function (y) { return y.bills.indexOf(b) >= 0; })[0]; if (!t) return;
        var n3 = notes[gcmId15_(x.Id)] || [];
        t.tasks.push({ id: x.Id, subject: x.Subject || '', status: x.Status || '', closed: !!x.IsClosed, opened: gcmYmd_(x.CreatedDate), closedOn: x.IsClosed ? gcmYmd_(x.LastModifiedDate) : '',
          due: gcmYmd_(x.ActivityDate), owner: x.Owner ? x.Owner.Name || '' : '', renewal: /risk to renew|renew/i.test(String(x.Subject || '')), notes: n3.length, last: n3.slice(0, 3) });
      });
    }
  }
  list.forEach(function (t) { if (!opt.staff) delete t.tasks; delete t.trans; });

  /* the whole history in a line or two */
  var billed = 0, paid = 0, owed = 0, late = [], cp = 0, nClaims = 0;
  list.forEach(function (t) { t.bills.forEach(function (b) { billed += b.billed; paid += b.paid; owed += b.owed; if (b.lateDays !== null) late.push(b.lateDays); }); t.claims.forEach(function (c) { nClaims++; cp += c.paid || 0; }); });
  late.sort(function (a, b) { return a - b; });
  var summary = list.length ? { terms: list.length, since: since, first: list[0].premium, last: list[list.length - 1].premium, billed: girR_(billed), paid: girR_(paid), owed: girR_(owed),
    claims: nClaims, claimsPaid: girR_(cp), claimsBefore: before, clean: list.filter(function (t) { return !t.claims.length; }).length,
    payDays: late.length ? late[Math.floor((late.length - 1) / 2)] : null, paidLate: late.filter(function (d) { return d > GIR_INS.LATE_PAY; }).length } : null;
  return { years: list, vehicles: Object.keys(veh).map(function (k) { return veh[k]; }), since: since, summary: summary, gaps: gaps };
}
/** Claims on the policy's records or its vehicles (Claims Revised, the branch's claims object). */
function girClaims_(r) {
  var vehicles = r.items.map(function (x) { return String(x.vehicle || '').slice(0, 7); }).filter(String), where = [];
  if (r.shells.length) where.push('CLIENT_PORTFOLIO__c IN (' + gcmIn_(r.shells) + ')');
  if (vehicles.length) where.push('Vehicle__c IN (' + gcmIn_(vehicles) + ')');
  if (!where.length) return [];
  try {
    return gcmQuery_('SELECT Id, Name, Claim_Type__c, Claim_Status__c, Date_Claim_Submitted__c, Date_Closed__c, Claims_Paid__c, Submitted_Charges__c, Vehicle__c FROM Claims_Revised__c WHERE ' +
      where.join(' OR ') + ' ORDER BY Date_Claim_Submitted__c DESC').filter(function (c) { return !/health|life|critical|accidental death|maturity/i.test(String(c.Claim_Type__c || '')); })
      .map(function (c) { return { id: c.Id, type: c.Claim_Type__c || '', status: c.Claim_Status__c || '', on: gcmYmd_(c.Date_Claim_Submitted__c), closed: gcmYmd_(c.Date_Closed__c),
        paid: girNum_(c.Claims_Paid__c), asked: girNum_(c.Submitted_Charges__c), vehicle: c.Vehicle__c || '' }; });
  } catch (e) { return []; }
}
/** Last year's billing records, and what was paid on them and when. */
function girBills_(r) {
  if (!r.trans.length) return [];
  var out = [];
  try {
    var pays = {};
    try { gcmQuery_('SELECT PMTS__c, Payment_Made__c, Date_Paid__c, Payment_Type__c FROM Payments__c WHERE PMTS__c IN (' + gcmIn_(r.trans) + ')').forEach(function (x) {
      (pays[gcmId15_(x.PMTS__c)] = pays[gcmId15_(x.PMTS__c)] || []).push({ amount: girNum_(x.Payment_Made__c), on: gcmYmd_(x.Date_Paid__c), how: x.Payment_Type__c || '' }); }); } catch (e) {}
    gcmQuery_('SELECT Id, Name, Renewal_Date__c, Billing_Premiums__c, Payments_Made__c, Premium_Owed__c, Days_O_S__c, Policy_Renewed__c FROM TRANSACTIONS__c WHERE Id IN (' + gcmIn_(r.trans) + ')').forEach(function (t) {
      var p = (pays[gcmId15_(t.Id)] || []).sort(function (a, b) { return String(a.on).localeCompare(String(b.on)); });
      var first = p[0] ? p[0].on : '', ren = gcmYmd_(t.Renewal_Date__c);
      out.push({ id: t.Id, name: t.Name, ren: ren, billed: girNum_(t.Billing_Premiums__c), paid: girNum_(t.Payments_Made__c), owed: girNum_(t.Premium_Owed__c),
        renewed: t.Policy_Renewed__c || '', pays: p, firstPaid: first, lateDays: first && ren ? gcmDays_(ren, first) : null });
    });
  } catch (e) {}
  return out;
}
/** The open tasks on the client's renewal: on last year's billing records, the policy records, or naming the policy. */
function girTasks_(r) {
  var ids = r.trans.concat(r.shells), out = [], seen = {};
  var add = function (t) {
    if (seen[t.Id]) return; seen[t.Id] = 1;
    out.push({ id: t.Id, subject: t.Subject || '', status: t.Status || '', due: gcmYmd_(t.ActivityDate), owner: t.Owner ? t.Owner.Name || '' : '', ownerId: t.OwnerId || '',
      opened: gcmYmd_(t.CreatedDate), renewal: /risk to renew|renewal/i.test(String(t.Subject || '')) });
  };
  var sel = 'SELECT Id, Subject, Status, ActivityDate, OwnerId, Owner.Name, CreatedDate, WhatId FROM Task WHERE IsClosed = false AND ';
  try { if (ids.length) gcmQuery_(sel + 'WhatId IN (' + gcmIn_(ids) + ') ORDER BY CreatedDate DESC LIMIT 50').forEach(add); } catch (e) {}
  var d = girDigits_(r.policy);
  try { if (d && d.length >= 5) gcmQuery_(sel + "Subject LIKE '%" + svcSoqlLit_(d) + "%' ORDER BY CreatedDate DESC LIMIT 20").forEach(add); } catch (e) {}
  return out;
}

/* ── what the record says: the insights the desk opens on ───────────────────────────────── */
/* Facts off the record, most pressing first. level: act (do this), check (look at this), good (in the client's favour),
   note. Never advice to the client: a recommendation reaches a client only in a letter the branch manager or the Branch
   Manager's Assistant has approved. The value guide is the rule RenewalLines.gs uses: a vehicle loses about 6 to 12 per
   cent a year, rebuilding costs rise about 5 per cent a year; a guide range, never a figure filed for the client. */
var GIR_INS = { DEP_LOW: 0.06, DEP_HIGH: 0.12, DRIFT: 0.05, STALE_YEARS: 2, LATE_PAY: 30, BIG_RISE: 10 };
function girInsights_(r, hist, claims, bills, notice, today) {
  var out = [], add = function (level, title, text) { out.push({ level: level, title: title, text: text }); };
  var days = gcmDays_(today, r.ren), comp = r.items.some(function (x) { return /comprehensive|fire and theft|tpft/i.test(String(x.coverage || '')); });
  (r.noPol || []).forEach(function (f) {
    add('check', f.label + ' has no policy number in Salesforce', 'It is on the same billing record' + (f.trans ? ' (' + f.trans + ')' : '') + ' as ' + r.policy + ', so the desk counts it with this renewal. Add the policy number to its record.');
  });
  (r.fixes || []).forEach(function (f) {
    var term = function (t) { return tDmy_(t.from) + ' to ' + tDmy_(t.to); };
    if (f.kind === 'conflict') add('act', f.label + ': two different terms for one year', 'Salesforce has ' + [f.kept].concat(f.others).map(function (t) { return girMoney_(t.total) + ' (' + term(t) + ')'; }).join(' and ') +
      ' for the same ' + (/^Chassis|serial/.test(f.label) ? 'item' : 'vehicle') + '. The desk counts ' + girMoney_(f.kept.total) + ', the first entered. Check which is right before the letter goes, and correct the other in Salesforce.');
    if (f.kind === 'wrong') add('check', f.label + ': a second term in Salesforce for this year', f.others.map(function (t) { return girMoney_(t.total) + ' (' + term(t) + ')' + (t.trans ? ' on ' + t.trans : '') + (t.transYear ? ', a billing record for ' + t.transYear : ''); }).join('; ') +
      '. The desk counts ' + girMoney_(f.kept.total) + ', the term on this year\'s billing record' + (f.kept.trans ? ' (' + f.kept.trans + ')' : '') + '. Correct or remove the other in Salesforce.');
    if (f.kind === 'dup') add('check', f.label + ' is in Salesforce ' + f.n + ' times for one term', 'The same term (' + term(f) + ', ' + girMoney_(f.total) + ') is entered ' + f.n + ' times. The desk counts it once' +
      (f.extra.length ? '; the extra is on ' + f.extra.join(', ') + (f.kept ? ', not ' + f.kept : '') : '') + '. Remove the extra in Salesforce so reports count it once too.');
    if (f.kind === 'mid') add('note', f.label + ': a mid-term change is in last year\'s premium', girMoney_(f.add) + ' from ' + tDmy_(f.from) + ', kept in Salesforce as a term of its own, is added to the term: ' +
      girMoney_(f.base) + ' + ' + girMoney_(f.add) + ' = ' + girMoney_(f.total) + '.');
  });
  if (!r.contact.email) add('act', 'No e-mail for the client', 'Salesforce has no e-mail for ' + (r.contact.name || 'the client') + '. Add it (or type it on the letter step) before the letter can go.');
  if (!notice && days !== null && days <= 35) add('act', 'Guardian General’s notice is not read yet', 'The renewal is in ' + days + ' days. Find the notice in support@ (step 2), or ask CRMS Renewals for it.');
  if (days !== null && days < GIR.LETTER_BY && days >= 0) add('act', 'The letter is due now', 'The letter should go at least ' + GIR.LETTER_BY + ' days before the renewal; there are ' + days + '.');
  if (notice && notice.total && r.lastPremium) {
    var pct = Math.round((notice.total - r.lastPremium) / r.lastPremium * 1000) / 10;
    if (pct >= GIR_INS.BIG_RISE) add('check', 'The premium rises ' + pct + '%', 'From ' + girMoney_(r.lastPremium) + ' last year to ' + girMoney_(notice.total) + '. Explain why in the letter (rates, values, claims) before the client asks.');
    else if (pct <= -1) add('good', 'The premium falls ' + Math.abs(pct) + '%', 'From ' + girMoney_(r.lastPremium) + ' to ' + girMoney_(notice.total) + '.');
    else if (pct >= 1) add('note', 'The premium rises ' + pct + '%', 'From ' + girMoney_(r.lastPremium) + ' last year to ' + girMoney_(notice.total) + '.');
    else add('note', 'The premium is about the same', girMoney_(r.lastPremium) + ' last year, ' + girMoney_(notice.total) + ' this year (' + (pct > 0 ? '+' : '') + pct + '%).');
  }
  if (hist && hist.years && hist.years.length > 1) {
    var f = hist.years[0], l = hist.years[hist.years.length - 1];
    add('note', 'With us since ' + f.year, hist.years.length + ' terms on record. The premium went from ' + girMoney_(f.premium) + ' (' + f.year + ') to ' + girMoney_(l.premium) + ' (' + l.year + ').');
  }
  /* each vehicle's value over the years, and the guide */
  (hist && hist.vehicles || []).forEach(function (v) {
    var ys = v.years.filter(function (y) { return y.value; });
    if (ys.length < 2) return;
    var last = ys[ys.length - 1], same = 0;
    for (var i = ys.length - 2; i >= 0 && ys[i].value === last.value; i--) same++;
    if (same >= GIR_INS.STALE_YEARS - 1) add('check', v.reg + ': the value has not moved since ' + ys[ys.length - 1 - same].year, 'Carried at ' + girWhole_(last.value) + ' for ' + (same + 1) + ' terms. A vehicle usually loses ' +
      Math.round(GIR_INS.DEP_LOW * 100) + '–' + Math.round(GIR_INS.DEP_HIGH * 100) + '% a year: a fair figure now might be ' + girWhole_(last.value * (1 - GIR_INS.DEP_HIGH)) + ' to ' + girWhole_(last.value * (1 - GIR_INS.DEP_LOW)) +
      '. The client confirms their own figure: an over-valued vehicle pays premium for value a claim will not pay.');
  });
  if (notice && notice.items) notice.items.forEach(function (n) {
    if (n.kind !== 'vehicle' || !n.value) return;
    var was = r.items.filter(function (x) { return x.vehicle && x.vehicle.replace(/\W/g, '') === String(n.reg || '').replace(/\W/g, ''); })[0];
    if (was && was.value && n.value !== was.value) add('note', n.reg + ': Guardian General has the value at ' + girWhole_(n.value), Math.round((was.value - n.value) / was.value * 100) + '% below last year’s ' + girWhole_(was.value) + '.');
  });
  if (r.line === 'home' || r.line === 'property') {
    var ys2 = (hist && hist.years || []).filter(function (y) { return y.cover; });
    if (ys2.length >= GIR_INS.STALE_YEARS) {
      var lastC = ys2[ys2.length - 1].cover, sameC = 0;
      for (var j = ys2.length - 2; j >= 0 && Math.abs(ys2[j].cover - lastC) < 1; j--) sameC++;
      if (sameC >= GIR_INS.STALE_YEARS - 1) {
        var yrs = sameC + 1, now = lastC * Math.pow(1 + GIR_INS.DRIFT, yrs), share = Math.round(lastC / now * 100);
        add('check', 'The sums insured have not changed since ' + ys2[ys2.length - 1 - sameC].year, girWhole_(lastC) + ' for ' + yrs + ' terms. If rebuilding costs rose about ' + Math.round(GIR_INS.DRIFT * 100) +
          '% a year, the cover is now about ' + share + '% of the cost, and under average a TT$100,000 loss would pay about ' + girWhole_(100000 * share / 100) + '. Ask the client to confirm the sums.');
      }
    }
    if (notice && notice.adequacy) add('note', 'Guardian General asks for the sums to be reviewed', 'The notice asks the client to check that the sums insured reflect the current replacement cost.');
  }
  if (notice && notice.declaration) add('act', 'Declarations are needed', 'This cover is written on a declaration basis: the actual figures for last year and the estimate for next year must go with the instruction.');
  if (notice && notice.reqs && notice.reqs.length) add('act', 'Guardian General needs ' + notice.reqs.length + ' document' + (notice.reqs.length === 1 ? '' : 's'), notice.reqs.join('; '));
  var recent = (claims || []).filter(function (c) { return c.on && c.on >= girAddYears_(today, -3); }), open = (claims || []).filter(function (c) { return /open/i.test(c.status); });
  if (open.length) add('check', open.length + ' claim' + (open.length === 1 ? '' : 's') + ' still open', open.map(function (c) { return c.type + (c.vehicle ? ' ' + c.vehicle : '') + ' (' + tDmy_(c.on) + ')'; }).join('; ') + '. An open claim may change the renewal terms.');
  if (recent.length) add('note', recent.length + ' claim' + (recent.length === 1 ? '' : 's') + ' in three years', recent.map(function (c) { return tDmy_(c.on) + ' ' + c.type + (c.paid ? ', paid ' + girMoney_(c.paid) : ''); }).join('; ') + '.');
  else if (claims) add('good', 'No claims on record in three years', 'Nothing in Claims Revised on this policy or its vehicles since ' + tDmy_(girAddYears_(today, -3)) + '.');
  (bills || []).forEach(function (b) {
    if (b.owed > 1) add('act', girMoney_(b.owed) + ' still owed on last year', b.name + ' (' + tDmy_(b.ren) + '): billed ' + girMoney_(b.billed) + ', paid ' + girMoney_(b.paid) + '. Settle it before the renewal goes to Guardian General.');
    if (b.lateDays !== null && b.lateDays > GIR_INS.LATE_PAY) add('check', 'Last year was paid ' + b.lateDays + ' days after the renewal', 'Send the letter early and offer the ways to pay (Solis Credit financing included).');
  });
  if (r.assignees.length) add('act', r.assignees.join(', ') + ' on the policy', 'A bank or financier is named on the policy: it needs the renewal certificate once the schedule is ready.');
  if (r.noEnd) add('check', 'An end date is missing in Salesforce', 'At least one item has no To date, so it does not show on a renewals list. The new term will carry its dates.');
  if (r.owner && r.owner.name && !r.owner.active) add('check', 'The account owner has left', r.owner.name + ' is no longer an active Salesforce user: ask the branch manager to reassign the account.');
  if (/household/i.test(r.acctRt || '') && /\b(ltd|limited|inc|company|co\.)\b/i.test(r.client || '')) add('note', 'A company filed as a household', r.client + ' is a HOUSEHOLD account in Salesforce. Change it to Commercial Client.');
  if (days !== null && days <= GIR.VALUE_DAYS && (comp || r.line === 'home' || r.line === 'property')) add('check', 'Value check due', 'Ask the client to confirm ' + (r.line === 'motor' ? 'each vehicle’s value' : 'the sums insured') + ' (and anything sold or added) before the letter goes.');
  var rank = { act: 0, check: 1, good: 2, note: 3 };
  out.sort(function (a, b) { return rank[a.level] - rank[b.level]; });
  return out;
}

/* ── Guardian General's notice, from the support@ inbox ────────────────────────────────── */
/** A Graph request on the support@ mailbox. Needs Mail.Read on the Entra app (the inbox reader already uses it). */
function girGraph_(path) {
  var res = UrlFetchApp.fetch('https://graph.microsoft.com/v1.0/users/' + encodeURIComponent(TRANSITION.MS_FROM) + path,
    { muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + tMsToken_() } });
  var code = res.getResponseCode();
  if (code !== 200) throw new Error('The support@ inbox could not be read (HTTP ' + code + (code === 403 ? ': the Entra app needs the Graph permission Mail.Read' : '') + ').');
  return JSON.parse(res.getContentText());
}
/** Messages in support@ that mention a policy number's digits, newest first. */
function girSearch_(digits) {
  var j = girGraph_('/messages?$search=' + encodeURIComponent('"' + digits + '"') + '&$select=id,subject,from,receivedDateTime,hasAttachments,bodyPreview&$top=40');
  return (j.value || []).map(function (m) {
    return { id: m.id, subject: String(m.subject || ''), from: String(((m.from || {}).emailAddress || {}).address || '').toLowerCase(), name: String(((m.from || {}).emailAddress || {}).name || ''),
      at: m.receivedDateTime, ts: new Date(m.receivedDateTime).getTime(), att: !!m.hasAttachments, preview: String(m.bodyPreview || '').slice(0, 400) };
  }).sort(function (a, b) { return b.ts - a.ts; });
}
/** Messages in support@ about a policy, searched every way the number is written: "TTCPL0100001", "0100001" and "100001"
 *  (Outlook's search matches whole words, so a number without its leading zeros never finds "TTCPL0100001"). */
function girSearchPol_(policy) {
  var m = /([A-Z]{2})\s*([A-Z]{3})\s*(\d+)/i.exec(String(policy || ''));
  if (!m) return [];
  var full = m[3], bare = full.replace(/^0+/, ''), qs = [(m[1] + m[2] + full).toUpperCase(), full, bare].filter(function (q, i, a) { return q && a.indexOf(q) === i; });
  var seen = {}, out = [];
  qs.forEach(function (q) { girSearch_(q).forEach(function (x) { if (!seen[x.id]) { seen[x.id] = 1; out.push(x); } }); });
  return out.sort(function (a, b) { return b.ts - a.ts; });
}
/** gcm.renNoticeFind: the renewal notices for this policy in support@ (Guardian General's IFORM PDFs). */
function girNoticeFind_(p) {
  var who = girWho_(p);
  if (!who.ok) return who;
  if (!tMsCreds_()) return { ok: false, error: 'Microsoft 365 is not set up in this project, so the support@ inbox cannot be read. Type the figures from the notice instead.' };
  var m = /^(.+)\|(\d{4}-\d{2})$/.exec(String(p.key || ''));
  var digits = m ? (/(\d{5,})$/.exec(m[1]) || [])[1] : '';
  if (!digits) return { ok: false, error: 'That renewal has no policy number to search for.' };
  /* the policy as written (the page sends it), else rebuilt from the key with its number padded to seven digits */
  var pol = p.policy && girPolKey_(p.policy) === m[1] ? String(p.policy) : m[1].slice(0, 2) + ' ' + m[1].slice(2, 5) + ' ' + ('0000000' + digits).slice(-Math.max(7, digits.length));
  var out = [];
  try {
    girSearchPol_(pol).filter(function (x) { return x.att; }).slice(0, 12).forEach(function (x) {
      var atts = girGraph_('/messages/' + encodeURIComponent(x.id) + '/attachments?$select=id,name,contentType,size').value || [];
      atts.forEach(function (a) {
        var n = String(a.name || ''), flat = n.toUpperCase().replace(/[^A-Z0-9]/g, '');
        if (!/pdf/i.test(String(a.contentType || '') + n) || flat.indexOf(digits) < 0) return;
        out.push({ msg: x.id, att: a.id, name: n, size: a.size || 0, at: gcmWhen_(x.at), ts: x.ts, subject: x.subject, from: x.name || x.from, notice: /IFORM|RENEWAL/i.test(n) });
      });
    });
  } catch (e) { return { ok: false, error: String(e && e.message ? e.message : e).slice(0, 300) }; }
  out.sort(function (a, b) { return (b.notice - a.notice) || (b.ts - a.ts); });
  return { ok: true, found: out.slice(0, 10) };
}
/** gcm.renNoticePdf: one attachment's bytes, for the desk to read in the browser. */
function girNoticePdf_(p) {
  var who = girWho_(p);
  if (!who.ok) return who;
  if (!tMsCreds_()) return { ok: false, error: 'Microsoft 365 is not set up in this project.' };
  try {
    var a = girGraph_('/messages/' + encodeURIComponent(p.msg) + '/attachments/' + encodeURIComponent(p.att));
    if (!a.contentBytes) return { ok: false, error: 'That attachment could not be read.' };
    if (a.size > 4000000) return { ok: false, error: 'That attachment is too large to read here.' };
    return { ok: true, name: a.name, b64: a.contentBytes };
  } catch (e) { return { ok: false, error: String(e && e.message ? e.message : e).slice(0, 300) }; }
}

/* ── the letter ────────────────────────────────────────────────────────────────────────── */
var GIR_DRAFT_SYSTEM = [
  'You draft the personal part of a renewal letter from the Ricky Rampersad Branch of Guardian Life of the Caribbean, in Trinidad and Tobago, to a client whose general insurance policy (motor, home, commercial property, liability, workers\' compensation, machinery, bond or marine) with Guardian General Insurance renews soon.',
  'The letter already carries, in tables, what renews, the premium this year and last, the history since inception, the documents needed and how to approve. You write only three parts:',
  '  opening: two or three warm, plain sentences to the client: thank them, say the renewal date, and say in one sentence what changed this year (the premium up or down, a value, nothing).',
  '  points: up to four things worth the client\'s attention before they approve, each a short title and one or two sentences, drawn ONLY from the facts given (a value that has not changed in years, sums insured that may be low, a bank that needs the certificate, documents Guardian General needs, a payment still owed, no claims). Phrase each as something for the client to consider or confirm, never as an instruction or a promise.',
  '  closing: one sentence inviting them to approve, or to tell us what has changed, on their renewal page.',
  'A licensed manager reads and approves everything before it goes. Rules:',
  '- Use only the facts given. Never invent a figure, a date, a discount, a benefit or a reason. Never quote a premium that is not in the facts.',
  '- No pressure, no fear, no "act now". No advice to cancel, to replace, or to buy anything; a suggestion to review a value or sums insured is fine.',
  '- Do not mention internal matters: Salesforce, data errors, account owners, other clients.',
  '- Write "we" for the branch. No greeting line and no sign-off: the letter adds them.',
  'Answer with JSON only: {"opening": "...", "points": [{"title": "...", "text": "..."}], "closing": "..."}'
].join('\n');
/** The facts a letter may use, in plain words. */
function girFacts_(r, hist, claims, bills, notice, insights, values) {
  var f = ['Client: ' + r.client + (r.contact.first ? ' (contact first name ' + r.contact.first + ')' : ''), 'Cover: ' + r.lineLabel + ', policy ' + r.policy,
    'Renewal date: ' + tDmy_(r.ren), 'Last year\'s premium, tax included: ' + girMoney_(r.lastPremium)];
  if (notice) f.push('This year\'s premium on Guardian General\'s notice: ' + girMoney_(notice.premium) + ' + tax ' + girMoney_(notice.tax) + ' = ' + girMoney_(notice.total) + ', for ' + tDmy_(notice.from) + ' to ' + tDmy_(notice.to));
  r.items.forEach(function (x) {
    var nv = values && values[x.id] ? values[x.id].value : 0;
    f.push('Item: ' + girItemLabel_(x) + (x.value ? ', value or sum insured ' + girWhole_(nv || x.value) + (nv && nv !== x.value ? ' (client\'s new figure; was ' + girWhole_(x.value) + ')' : '') : '') + (x.assignee ? ', bank on the policy ' + x.assignee : ''));
  });
  if (hist && hist.years && hist.years.length) f.push('History: ' + hist.years.map(function (y) { return y.year + ' ' + girMoney_(y.premium); }).join('; '));
  if (claims) f.push('Claims in three years: ' + (claims.filter(function (c) { return c.on >= girAddYears_(gcmToday_(), -3); }).length || 'none'));
  (bills || []).forEach(function (b) { if (b.owed > 1) f.push('Still owed on last year: ' + girMoney_(b.owed)); });
  if (notice && notice.reqs && notice.reqs.length) f.push('Documents Guardian General needs: ' + notice.reqs.join('; '));
  (insights || []).filter(function (i) { return i.level === 'check' || i.level === 'good'; }).forEach(function (i) { f.push('Observation: ' + i.title + '. ' + i.text); });
  return f;
}
function girItemLabel_(x) {
  if (x.vehicle) return [x.year, x.make, x.model].filter(String).join(' ') + ' (' + x.vehicle + ')' + (x.coverage ? ', ' + x.coverage : '');
  if (x.location) return x.location + (x.sums && x.sums.length ? ': ' + x.sums.map(function (s) { return s.label + ' ' + girWhole_(s.value); }).join(', ') : '');
  if (x.cats && x.cats.length) return x.cats.map(function (c) { return [c.cat, c.model, c.serial ? 'serial ' + c.serial : ''].filter(String).join(' ') + (c.value ? ' ' + girWhole_(c.value) : ''); }).join('; ');
  return x.coverage || x.name || 'Cover';
}
/** The letter's own words without the AI: plain, from the facts. */
function girTemplate_(r, notice) {
  var first = r.contact.first || '', up = notice && r.lastPremium ? Math.round((notice.total - r.lastPremium) / r.lastPremium * 1000) / 10 : null;
  var noun = (GIR_LINES[r.line] && GIR_LINES[r.line].noun) || r.lineLabel.toLowerCase();
  if (r.line === 'motor' && r.items.length > 1) noun = 'vehicles';
  return { opening: 'Thank you for insuring your ' + noun + ' with us. Your policy ' + r.policy + ' renews on ' + tDmy_(r.ren) + '. ' +
      (up === null ? 'The details are below.' : up > 0.5 ? 'This year\'s premium is ' + girMoney_(notice.total) + ', ' + up + '% more than last year.' : up < -0.5 ? 'This year\'s premium is ' + girMoney_(notice.total) + ', ' + Math.abs(up) + '% less than last year.' : 'This year\'s premium is ' + girMoney_(notice.total) + ', about the same as last year.'),
    points: [], closing: 'Please approve your renewal, or tell us what has changed, on your renewal page.', ai: false };
}
/** Draft with AI: the three personal parts, from the facts. A person edits and an approver approves before anything goes. */
function girDraftAi_(r, facts) {
  if (!gcmAiKey_()) return null;
  try {
    var j = girJsonOf_(gcmClaude_(GIR_DRAFT_SYSTEM, 'Write the three parts for this renewal.\n\nFacts:\n- ' + facts.join('\n- ')));
    if (!j || !j.opening) return null;
    return { opening: String(j.opening).slice(0, 900), points: (Array.isArray(j.points) ? j.points : []).slice(0, 4).map(function (x) { return { title: String(x.title || '').slice(0, 120), text: String(x.text || '').slice(0, 500) }; })
      .filter(function (x) { return x.title || x.text; }), closing: String(j.closing || '').slice(0, 400), ai: true };
  } catch (e) { return null; }
}
/** The letter as the client reads it. o.test: a banner naming who it would have gone to. */
function girLetterHtml_(r, st, o) {
  o = o || {};
  var notice = st.notice || {}, L = st.letter || girTemplate_(r, notice), values = st.values || {}, hist = st.hist || { years: [] };
  var first = girFirst_(r.contact.first || r.contact.name) || 'there', link = GIR.SITE + '?e=' + encodeURIComponent(st.email || '') + '&k=' + encodeURIComponent(r.key);
  var holder = st.holder || 'our renewals team';
  var td = 'padding:8px 10px;border-bottom:1px solid #e7ebf2;font:14px/1.4 Arial,sans-serif;color:#1d2b3a', th = td + ';font-weight:700;background:#f4f6fa';
  var items = r.items.map(function (x) {
    var nv = values[x.id] ? values[x.id].value : 0, nn = (notice.items || []).filter(function (n) { return n.reg && x.vehicle && n.reg.replace(/\W/g, '') === x.vehicle.replace(/\W/g, ''); })[0];
    var val = nv || (nn && nn.value) || x.value || x.cover;
    return '<tr><td style="' + td + '">' + girEsc_(girItemLabel_(x)) + '</td><td style="' + td + ';text-align:right">' + (val ? girWhole_(val) : '') + '</td></tr>';
  }).join('');
  var change = notice.total && r.lastPremium ? Math.round((notice.total - r.lastPremium) / r.lastPremium * 1000) / 10 : null;
  /* every year since the policy began, oldest first; a year with a claim says so */
  var hy = hist.years || [], hmax = Math.max.apply(null, hy.map(function (z) { return z.premium || 1; }).concat([1]));
  var histRows = hy.map(function (y) {
    var w = Math.max(4, Math.round((y.premium || 0) / hmax * 150)), nc = (y.claims || []).length;
    return '<tr><td style="' + td + ';white-space:nowrap">' + y.year + (nc ? '<br><span style="font-size:12px;color:#8a5a00">' + nc + ' claim' + (nc === 1 ? '' : 's') + '</span>' : '') + '</td>' +
      '<td style="' + td + '"><span style="display:inline-block;height:10px;width:' + w + 'px;background:#2D5BB9;border-radius:3px"></span></td>' +
      '<td style="' + td + ';text-align:right;white-space:nowrap">' + girMoney_(y.premium) + (y.change !== null && y.change !== undefined ? '<br><span style="font-size:12px;color:#5b6670">' + (y.change > 0 ? '+' : '') + y.change + '%</span>' : '') + '</td></tr>';
  }).join('');
  var hs = hist.summary, histLine = hs ? 'With us since ' + tDmy_(hs.since) + ': ' + hs.terms + ' term' + (hs.terms === 1 ? '' : 's') +
    (hs.claims ? ', ' + hs.claims + ' claim' + (hs.claims === 1 ? '' : 's') + ' in that time' : ', and no claims in that time') + '. Your page shows every year in full.' : '';
  var points = (L.points || []).map(function (x) { return '<tr><td style="padding:10px 0;border-bottom:1px solid #eee;font:14px/1.5 Arial,sans-serif;color:#1d2b3a"><b>' + girEsc_(x.title) + '</b><br>' + girEsc_(x.text) + '</td></tr>'; }).join('');
  var reqs = (notice.reqs || []).map(function (q) { return '<li style="margin:3px 0">' + girEsc_(q) + '</li>'; }).join('');
  var btn = '<a href="' + link + '" style="display:inline-block;background:#0d1f33;color:#fff;text-decoration:none;font:700 15px Arial,sans-serif;padding:13px 22px;border-radius:9px">Review and approve your renewal</a>';
  var html = (o.banner ? '<div style="background:#fff4d6;border:1px solid #e3c25b;padding:10px 14px;font:13px Arial,sans-serif;margin-bottom:12px">' + o.banner + '</div>' : '') +
    '<div style="max-width:640px;margin:0 auto;background:#fff;border:1px solid #e3e7ee;border-radius:12px;overflow:hidden">' +
    '<div style="background:#0d1f33;padding:18px 22px;color:#fff;font:700 18px Arial,sans-serif"><img src="' + GIR.LOGO + '" alt="" width="40" height="40" style="vertical-align:middle;border-radius:8px;margin-right:10px">Your ' + girEsc_(r.lineLabel.toLowerCase()) + ' renewal · ' + girEsc_(tDmy_(r.ren)) + '</div>' +
    '<div style="padding:20px 22px;font:15px/1.6 Arial,sans-serif;color:#1d2b3a">' +
    '<p>Dear ' + girEsc_(first) + ',</p><p>' + girEsc_(L.opening || '') + '</p>' +
    '<p style="margin:18px 0 6px;font-weight:700">What renews · policy ' + girEsc_(r.policy) + '</p><table style="width:100%;border-collapse:collapse"><tr><td style="' + th + '">Item</td><td style="' + th + ';text-align:right">Value or sum insured</td></tr>' + items + '</table>' +
    (notice.total ? '<table style="width:100%;border-collapse:collapse;margin-top:14px"><tr><td style="' + th + '">Premium, tax included</td><td style="' + th + ';text-align:right">Amount</td></tr>' +
      '<tr><td style="' + td + '">Last year</td><td style="' + td + ';text-align:right">' + girMoney_(r.lastPremium) + '</td></tr>' +
      '<tr><td style="' + td + '"><b>This year</b>, ' + girEsc_(tDmy_(notice.from)) + ' to ' + girEsc_(tDmy_(notice.to)) + '</td><td style="' + td + ';text-align:right"><b>' + girMoney_(notice.total) + '</b>' + (change !== null ? '<br><span style="color:#5b6670;font-size:12px">' + (change > 0 ? '+' : '') + change + '%</span>' : '') + '</td></tr></table>' : '') +
    (histRows ? '<p style="margin:18px 0 6px;font-weight:700">Every year since ' + girEsc_(hy[0].year) + '</p><table style="width:100%;border-collapse:collapse">' + histRows + '</table>' +
      (histLine ? '<p style="margin:6px 0 0;font-size:13px;color:#5b6670">' + girEsc_(histLine) + '</p>' : '') : '') +
    (points ? '<p style="margin:18px 0 6px;font-weight:700">Worth a look before you approve</p><table style="width:100%;border-collapse:collapse">' + points + '</table>' : '') +
    (reqs ? '<p style="margin:18px 0 6px;font-weight:700">Guardian General needs these with your renewal</p><ul style="margin:0;padding-left:20px">' + reqs + '</ul>' : '') +
    '<p style="margin-top:18px">' + girEsc_(L.closing || '') + '</p><p style="margin:16px 0">' + btn + '</p>' +
    '<p style="font-size:13px;color:#5b6670">Sign in with this e-mail address; we send you a code. Nothing is renewed until you say yes.</p>' +
    '<p style="font-size:14px"><b>Ways to pay</b> once it is renewed: at the branch (card, Linx, cash, cheque), card by phone, online bank transfer, or Solis Credit financing.</p>' +
    '<p>Warm regards,<br><b>' + girEsc_(holder) + '</b><br>Ricky Rampersad Branch · Guardian Life of the Caribbean<br>Branch ' + GIR.BRANCH_TELS + ' · Guardian Direct ' + GIR.DIRECT_TEL + '</p>' +
    '</div><div style="padding:14px 22px;background:#f7f8fb;font:11px/1.5 Arial,sans-serif;color:#6b7785">' + tLegal_(null) + '</div></div>';
  return { subject: 'Your ' + r.lineLabel.toLowerCase() + ' renewal, ' + tDmy_(r.ren) + ' · policy ' + r.policy, html: html };
}
/** What the client's page shows, kept on the row when the letter goes, so the page never waits on Salesforce. */
function girClientView_(r, notice, letter, hist, claims, values) {
  var RISKS = 12;
  return { key: r.key, policy: r.policy, line: r.lineLabel, client: r.client, ren: r.ren, lastPremium: r.lastPremium,
    premium: notice ? notice.premium : 0, tax: notice ? notice.tax : 0, total: notice ? notice.total : 0, from: notice ? notice.from : '', to: notice ? notice.to : '',
    items: r.items.map(function (x) { var nn = (notice && notice.items || []).filter(function (n) { return n.reg && x.vehicle && n.reg.replace(/\W/g, '') === x.vehicle.replace(/\W/g, ''); })[0];
      return { id: x.id, label: girItemLabel_(x), vehicle: x.vehicle, value: (values && values[x.id] && values[x.id].value) || (nn && nn.value) || x.value || x.cover || 0, lastValue: x.value || x.cover || 0,
        kind: x.vehicle ? 'vehicle' : x.location ? 'location' : 'item', bank: x.assignee || '' }; }),
    /* the client's own history: every term since the policy began, what it covered, what was billed and paid, and the claims.
       Never a task, a note or anything internal. */
    years: (hist && hist.years || []).map(function (y) {
      var billed = 0, paid = 0, owed = 0, paidOn = '';
      (y.bills || []).forEach(function (b) { billed += b.billed; paid += b.paid; owed += b.owed; if (b.firstPaid && (!paidOn || b.firstPaid < paidOn)) paidOn = b.firstPaid; });
      return { year: y.year, from: y.from, to: y.to, policies: y.policies || [], premium: y.premium, change: y.change === undefined ? null : y.change, cover: y.cover,
        risks: (y.risks || []).slice(0, RISKS).map(function (k) { return { label: k.label, value: k.value }; }), more: Math.max(0, (y.risks || []).length - RISKS),
        billed: girR_(billed), paid: girR_(paid), owed: girR_(owed), paidOn: paidOn, hasBill: !!(y.bills || []).length,
        claims: (y.claims || []).map(function (c) { return { on: c.on, type: c.type, status: c.status }; }) };
    }),
    since: hist ? hist.since : '',
    summary: hist && hist.summary ? { terms: hist.summary.terms, since: hist.summary.since, claims: hist.summary.claims, clean: hist.summary.clean } : null,
    claims: (claims || []).map(function (c) { return { on: c.on, type: c.type, status: c.status }; }),
    points: letter ? letter.points || [] : [], opening: letter ? letter.opening : '', reqs: notice ? notice.reqs || [] : [] };
}

/* ── Salesforce helpers ────────────────────────────────────────────────────────────────── */
/** An active, standard Salesforce user by e-mail (never a site guest), else ''. */
function girUserId_(email) {
  email = String(email || '').trim().toLowerCase();
  if (!email || !tSfOn_()) return '';
  if (typeof gblUsersByEmail_ === 'function') { var u = gblUsersByEmail_([email])[email]; return u ? u.id : ''; }
  try { var x = gcmQuery_("SELECT Id FROM User WHERE IsActive = true AND UserType = 'Standard' AND Email = '" + svcSoqlLit_(email) + "' LIMIT 1")[0]; return x ? String(x.Id) : ''; } catch (e) { return ''; }
}
var GIR_RT = {};
function girRtId_(sobject, name) {
  var k = sobject + '|' + name;
  if (GIR_RT[k] !== undefined) return GIR_RT[k];
  try { var r = gcmQuery_("SELECT Id FROM RecordType WHERE SobjectType = '" + svcSoqlLit_(sobject) + "' AND Name = '" + svcSoqlLit_(name) + "' LIMIT 1")[0]; GIR_RT[k] = r ? String(r.Id) : ''; } catch (e) { GIR_RT[k] = ''; }
  return GIR_RT[k];
}
/** Who delivers the documents: the GIR_DELIVERY Script property (an e-mail or a user id), else the active user named GIR.DELIVER. */
function girDeliverer_() {
  var p = '';
  try { p = String(PropertiesService.getScriptProperties().getProperty('GIR_DELIVERY') || '').trim(); } catch (e) {}
  if (/^005[A-Za-z0-9]{12,15}$/.test(p)) return { id: p, name: 'the driver' };
  if (/@/.test(p)) { var id = girUserId_(p); if (id) return { id: id, name: p }; }
  try { var u = gcmQuery_("SELECT Id, Name FROM User WHERE IsActive = true AND UserType = 'Standard' AND FirstName = '" + svcSoqlLit_(GIR.DELIVER) + "' LIMIT 1")[0]; if (u) return { id: String(u.Id), name: String(u.Name) }; } catch (e) {}
  return null;
}
/** A Chatter post on a record, with its owner mentioned so Salesforce tells them; a plain post when the mention is refused. */
function girFeed_(parentId, text, mentionId) {
  if (!parentId || !tSfOn_()) return '';
  if (mentionId) {
    try { var r = tSfSend_('post', '/chatter/feed-elements', { feedElementType: 'FeedItem', subjectId: parentId, body: { messageSegments: [{ type: 'Text', text: text + '\n' }, { type: 'Mention', id: mentionId }] } }); if (r.id) return String(r.id); } catch (e) {}
  }
  try { var p = tSfSend_('post', '/sobjects/FeedItem', { ParentId: parentId, Body: text }); return String(p.id || ''); } catch (e2) { return ''; }
}
/** The staff and managers who approve a letter: the branch manager and the Branch Manager's Assistant on the Agent Skill Bank. */
function girApprovers_() {
  var out = [];
  try { tTeam_().people.forEach(function (p) { if (p.active && p.email && (p.role === 'bm' || p.role === 'abm' || gcmIsBma_({ title: p.roleText }))) out.push({ name: p.name, email: p.email }); }); } catch (e) {}
  if (!out.length) out.push({ name: 'Ricky Rampersad', email: 'Ricky.Rampersad@myguardiangroup.com' });
  return out;
}
/** An e-mail from support@ (Microsoft 365). Client and Guardian General mail never goes from anywhere else. */
function girMail_(to, subject, html, o) {
  if (!tMsCreds_()) throw new Error('Microsoft 365 is not set up in this project (MS_TENANT, MS_CLIENT, MS_SECRET), so nothing can go from support@.');
  tMsSend_(to, subject, html, Object.assign({ replyTo: TRANSITION.MS_FROM }, o || {}));
}
function girInternal_(to, subject, html) {
  if (!girLive_() && !/^\[TEST\]/.test(subject)) subject = '[TEST] ' + subject;
  if (typeof gblInternalMail_ === 'function') return gblInternalMail_(to, subject, html + '<p style="color:#777;font-size:12px">' + tEsc_(tInternal_(null)) + '</p>');
  try { MailApp.sendEmail({ to: to, subject: subject, htmlBody: html, name: 'Ricky Rampersad Branch' }); return true; } catch (e) { return false; }
}
/** The renewal task on last year's billing record: the one already open for this policy, else a new one in the branch's
 *  pattern ("Risk to Renew for -<CLIENT> <Line> Renewal Date <m/d/yyyy> Policy # <n>"). */
function girRenewalTask_(r, st, who) {
  var have = gcmText_(st && st.Task);
  if (have) return have;
  var d = girDigits_(r.policy), open = girTasks_(r).filter(function (t) { return /risk to renew/i.test(t.subject) && d && t.subject.replace(/\s+/g, '').indexOf(d) >= 0; })[0];
  if (open) return open.id;
  var owner = girUserId_(st && st['Holder e-mail']) || girUserId_(who.email) || (r.owner.active ? r.owner.id : '');
  var due = gcmAddDays_(r.ren, -GIR.CALL_AT); if (due <= gcmToday_()) due = girAddWorking_(gcmToday_(), 2);
  var rec = { Subject: 'Risk to Renew for -' + String(r.client).toUpperCase() + ' ' + r.lineLabel + ' Renewal Date ' + girMdy_(r.ren) + ' Policy # ' + r.policy,
    WhatId: r.trans[0] || r.shells[0] || r.account, WhoId: r.contact.id || null, OwnerId: owner || undefined, ActivityDate: due, Priority: 'High', Status: 'In Progress', Task_Type__c: 'Renewa/PDl/Bill',
    Description: 'Opened by the renewal desk when the renewal letter went (' + who.name + ').\nThe client approves on their renewal page; their answer and comments come onto this task\'s Chatter. ' +
      'No answer by ' + tDmy_(gcmAddDays_(r.ren, -GIR.CALL_AT)) + ': call them, and tell the branch manager. Nothing goes to Guardian General without the client\'s yes.\nThe desk: ' + GIR.DESK };
  if (!rec.WhoId) delete rec.WhoId;
  if (!rec.OwnerId) delete rec.OwnerId;
  var res = typeof gblSfwSave_ === 'function' ? gblSfwSave_('post', '/sobjects/Task', rec).res : tSfSend_('post', '/sobjects/Task', rec);
  return String(res.id || '');
}

/* ── the desk's presses ────────────────────────────────────────────────────────────────── */
/** gcm.renAct: one press on the desk. */
function girAct_(b) {
  var who = girWho_(b);
  if (!who.ok) return who;
  var act = String(b.act || ''), key = String(b.key || '');
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(20000)) return { ok: false, error: 'Someone else is saving on the desk. Try again in a moment.' };
  try {
    var r = girFind_(key);
    if (!r) return { ok: false, error: 'That renewal is not in Salesforce for that month any more. Refresh the list.' };
    var st = girState_()[key] || null, stage = girStageOf_(r, st), base = { Policy: r.policy, Line: r.lineLabel, Client: r.client, Account: r.account, Contact: r.contact.id || '', Renewal: r.ren,
      'Last trans': r.trans.join(' ') };
    if (!st) base.Stage = stage;
    var save = function (patch) { girSave_(key, Object.assign({}, st ? {} : base, patch)); };
    switch (act) {
      case 'take':
        save({ Holder: who.name, 'Holder e-mail': who.email || '' });
        girLog_(key, r, 'took it', who.name, '');
        return { ok: true, said: 'It is yours: ' + r.client + ' · ' + r.policy + '.' };
      case 'email': {
        var em = String(b.email || '').trim();
        if (!gcmEmailOk_(em)) return { ok: false, error: 'That does not look like an e-mail address.' };
        if (girOurAddress_(em)) return { ok: false, error: 'That is one of our own addresses: the letter is for the client.' + (girLive_() ? '' : ' In test mode it already goes to you, the person who has the renewal and the test inbox.') };
        save({ 'E-mail': em });
        girLog_(key, r, 'e-mail set', who.name, em);
        return { ok: true, said: 'The letter will go to ' + em + '. Put it in Salesforce too, on the client\'s contact.' };
      }
      case 'notice': {
        var n = girJ_(b.notice, null) || b.notice;
        if (!n || typeof n !== 'object') return { ok: false, error: 'Read the notice, or type its figures, first.' };
        n.total = girR_(n.total); n.premium = girR_(n.premium); n.tax = girR_(n.tax);
        if (!n.total) return { ok: false, error: 'The total, tax included, is needed.' };
        if (!/^\d{4}-\d{2}-\d{2}$/.test(String(n.from || '')) || !/^\d{4}-\d{2}-\d{2}$/.test(String(n.to || ''))) return { ok: false, error: 'The period of insurance (from and to) is needed.' };
        var other = n.key && n.key !== r.pk && girPolKey_(n.replaces || '') !== r.pk && !gcmYes_(b.confirmOther);
        if (other) return { ok: false, needConfirm: true, error: 'This notice is for ' + n.policy + ', not ' + r.policy + '. Tick that it replaces the old number, then save again.' };
        n.by = who.name; n.at = gcmWhen_(new Date());
        save({ Notice: n, Stage: GIR_STAGES[stage].n < GIR_STAGES.notice.n ? 'notice' : stage });
        girLog_(key, r, 'notice read', who.name, girMoney_(n.total) + ' for ' + tDmy_(n.from) + ' to ' + tDmy_(n.to) + (n.source && n.source.name ? ' (' + n.source.name + ')' : ''));
        return { ok: true, said: 'Notice saved: ' + girMoney_(n.total) + '.' };
      }
      case 'values': {
        var v = girJ_(st && st.Values, {}), got = girJ_(b.values, null) || b.values || {};
        Object.keys(got).forEach(function (id) { var x = girNum_(got[id]); if (x > 0) v[id] = { value: x, by: who.name, at: gcmWhen_(new Date()), src: 'staff' }; });
        save({ Values: v });
        girLog_(key, r, 'values', who.name, Object.keys(got).length + ' value(s) confirmed');
        return { ok: true, said: 'Values saved.' };
      }
      case 'draft': {
        var notice = girJ_(st && st.Notice, null);
        var claims = girClaims_(r), hist = girHistory_(r, { claims: claims }), bills = girBills_(r), ins = girInsights_(r, hist, claims, bills, notice, gcmToday_());
        var L = gcmYes_(b.ai) ? girDraftAi_(r, girFacts_(r, hist, claims, bills, notice, ins, girJ_(st && st.Values, {}))) : null;
        if (gcmYes_(b.ai) && !L) return { ok: false, error: gcmAiKey_() ? 'The AI did not give a draft this time. Start from the plain letter and write it yourself.' : 'AI drafts are not set up (ANTHROPIC_API_KEY).' };
        L = L || girTemplate_(r, notice);
        L.by = who.name; L.at = gcmWhen_(new Date());
        save({ Letter: L, Stage: GIR_STAGES[stage].n < GIR_STAGES.drafted.n ? 'drafted' : stage });
        girLog_(key, r, L.ai ? 'letter drafted with AI' : 'letter started', who.name, '');
        return { ok: true, letter: L, said: L.ai ? 'Drafted. Read every word, change what you need, then send it for approval.' : 'The plain letter is ready to edit.' };
      }
      case 'letter': {
        var L2 = girJ_(b.letter, null) || b.letter;
        if (!L2 || !String(L2.opening || '').trim()) return { ok: false, error: 'The letter needs its opening.' };
        var old = girJ_(st && st.Letter, {}) || {};
        L2 = { opening: String(L2.opening).slice(0, 1500), points: (L2.points || []).slice(0, 6).map(function (x) { return { title: String(x.title || '').slice(0, 150), text: String(x.text || '').slice(0, 700) }; }).filter(function (x) { return x.title || x.text; }),
          closing: String(L2.closing || '').slice(0, 500), ai: !!old.ai, by: who.name, at: gcmWhen_(new Date()) };
        if (/\[[^\]]{1,40}\]/.test(JSON.stringify(L2))) return { ok: false, error: 'Fill in every [blank] first.' };
        save({ Letter: L2, Stage: GIR_STAGES[stage].n < GIR_STAGES.drafted.n ? 'drafted' : stage === 'approval' ? 'drafted' : stage });
        girLog_(key, r, 'letter edited', who.name, '');
        return { ok: true, said: 'Letter saved.' + (stage === 'approval' ? ' It needs approving again.' : '') };
      }
      case 'submit': {
        if (!girJ_(st && st.Notice, null)) return { ok: false, error: 'Read Guardian General\'s notice first: the letter states the new premium.' };
        if (!girJ_(st && st.Letter, null)) return { ok: false, error: 'Draft the letter first.' };
        save({ Stage: 'approval', 'Submitted by': who.name });
        girLog_(key, r, 'sent for approval', who.name, '');
        var link = GIR.DESK + '#' + encodeURIComponent(key);
        girApprovers_().forEach(function (a) { if (String(a.email).toLowerCase() !== String(who.email || '').toLowerCase()) girInternal_(a.email, 'Renewal letter to approve · ' + r.client + ' · ' + r.policy,
          '<p>' + tEsc_(who.name) + ' has a renewal letter ready for you to approve: <b>' + tEsc_(r.client) + '</b>, ' + tEsc_(r.lineLabel) + ' ' + tEsc_(r.policy) + ', renewing ' + tEsc_(tDmy_(r.ren)) + '.</p><p><a href="' + link + '">Open it on the renewal desk</a></p>'); });
        return { ok: true, said: 'Sent for approval to the branch manager and the Branch Manager\'s Assistant.' };
      }
      case 'reject': {
        if (!who.approver) return { ok: false, error: 'Only the branch manager or the Branch Manager\'s Assistant approves a letter.' };
        var why = String(b.text || '').trim();
        if (why.length < 5) return { ok: false, error: 'Say what to change.' };
        save({ Stage: 'drafted' });
        girLog_(key, r, 'sent back', who.name, why);
        var subm = gcmText_(st && st['Submitted by']), sp = null;
        try { sp = tTeam_().people.filter(function (p) { return gcmSameName_(p.name, subm); })[0]; } catch (e) {}
        if (sp && sp.email) girInternal_(sp.email, 'Renewal letter sent back · ' + r.client, '<p>' + tEsc_(who.name) + ' sent back the renewal letter for <b>' + tEsc_(r.client) + '</b> (' + tEsc_(r.policy) + '):</p><blockquote>' + tEsc_(why) + '</blockquote><p><a href="' + GIR.DESK + '#' + encodeURIComponent(key) + '">Open it</a></p>');
        return { ok: true, said: 'Sent back with your note.' };
      }
      case 'approve': return girApproveSend_(who, r, st, b, save);
      case 'phoneYes': {
        var how = String(b.text || '').trim();
        if (how.length < 10) return { ok: false, error: 'Say who said yes, how (call, e-mail, in person) and when.' };
        var ans = { decision: 'approve', name: 'recorded by ' + who.name, at: gcmWhen_(new Date()), comment: how, via: 'staff' };
        save({ 'Client answer': ans, Stage: 'approved' });
        girLog_(key, r, 'client said yes (recorded by staff)', who.name, how);
        if (st && gcmText_(st.Task)) girFeed_(gcmText_(st.Task), 'Renewal desk · the client\'s yes, recorded by ' + who.name + ': ' + how);
        return { ok: true, said: 'The client\'s yes is recorded. You can proceed to renew.' };
      }
      case 'comment': {
        var tx = String(b.text || '').trim();
        if (tx.length < 3) return { ok: false, error: 'Write the comment first.' };
        if (!girLive_() && !gcmText_(st && st.Task)) {
          girLog_(key, r, 'comment (test)', who.name, tx);
          return { ok: true, said: 'Test mode: kept on the desk\'s log. Live, it goes on the renewal task\'s Chatter.' };
        }
        var tid = gcmText_(st && st.Task) || (girTasks_(r).filter(function (t) { return t.renewal; })[0] || {}).id || '';
        if (!tid) return { ok: false, error: 'There is no renewal task yet: it opens when the letter goes.' };
        var fid = girFeed_(tid, 'Renewal desk · ' + who.name + ': ' + tx);
        girLog_(key, r, 'comment', who.name, tx);
        return { ok: !!fid, said: fid ? 'Posted on the renewal task\'s Chatter.' : 'Salesforce did not take the post.' };
      }
      case 'proceed': return girProceed_(who, r, st, b, save);
      case 'reset': {
        var pr = girPracticeFor_(who, st);
        if (!pr.can) return { ok: false, error: pr.why };
        var from = b.from === 'start' ? 'start' : 'letter';
        save(girPracticePatch_(st, from));
        girLog_(key, r, 'practice: started again ' + (from === 'start' ? 'from the beginning' : 'from the letter'), who.name, from === 'start' ? 'everything cleared' : 'the notice, values and letter kept; the letter needs approving again');
        return { ok: true, said: from === 'start' ? 'Started again from the beginning: take it, read the notice and draft the letter.' : 'Started again from the letter: send it for approval when it reads right.' };
      }
      case 'ggReply': {
        var gr = { at: gcmWhen_(new Date()), subject: String(b.text || 'marked by ' + who.name).slice(0, 200), by: who.name, ready: gcmYes_(b.ready) };
        save({ 'GG reply': gr, Stage: gr.ready ? 'confirmed' : stage });
        girLog_(key, r, 'Guardian General replied (marked)', who.name, gr.subject);
        if (st && gcmText_(st['Follow task'])) girFeed_(gcmText_(st['Follow task']), 'Renewal desk · Guardian General replied (' + who.name + '): ' + gr.subject);
        return { ok: true, said: 'Noted. The follow-ups stop.' };
      }
      case 'chase': return girChaseOne_(r, st, who, true);
      case 'delivered': {
        var dn = String(b.text || '').trim();
        save({ Delivered: gcmWhen_(new Date()) + ' · ' + who.name + (dn ? ' · ' + dn : ''), Stage: gcmText_(st && st.Paid) ? 'done' : 'delivered' });
        girLog_(key, r, 'delivered', who.name, dn);
        if (st && gcmText_(st['Follow task'])) girFeed_(gcmText_(st['Follow task']), 'Renewal desk · documents delivered to the client (' + who.name + ')' + (dn ? ': ' + dn : '') + '.');
        return { ok: true, said: 'Delivered.' };
      }
      case 'paid': {
        var pn = String(b.text || '').trim();
        if (pn.length < 3) return { ok: false, error: 'Give the receipt number or how it was paid.' };
        save({ Paid: gcmWhen_(new Date()) + ' · ' + who.name + ' · ' + pn, Stage: gcmText_(st && st.Delivered) ? 'done' : stage });
        girLog_(key, r, 'paid', who.name, pn);
        if (st && gcmText_(st['Follow task'])) girFeed_(gcmText_(st['Follow task']), 'Renewal desk · payment received: ' + pn + ' (' + who.name + ').');
        return { ok: true, said: 'Payment noted.' };
      }
      case 'lost': {
        var reason = String(b.text || '').trim();
        if (reason.length < 10) return { ok: false, error: 'Say why the client is not renewing, in their words if you have them.' };
        save({ Outcome: 'not renewing: ' + reason, Stage: 'lost' });
        girLog_(key, r, 'not renewing', who.name, reason);
        if (st && gcmText_(st.Task)) girFeed_(gcmText_(st.Task), 'Renewal desk · the client is not renewing (' + who.name + '): ' + reason);
        girApprovers_().forEach(function (a) { girInternal_(a.email, 'Not renewing · ' + r.client + ' · ' + r.policy, '<p>' + tEsc_(who.name) + ' recorded that <b>' + tEsc_(r.client) + '</b> is not renewing ' + tEsc_(r.lineLabel) + ' ' + tEsc_(r.policy) + ' (' + tEsc_(tDmy_(r.ren)) + '):</p><blockquote>' + tEsc_(reason) + '</blockquote>'); });
        return { ok: true, said: 'Recorded, and the branch manager is told.' };
      }
    }
    return { ok: false, error: 'Unknown step.' };
  } catch (e) {
    return { ok: false, error: String(e && e.message ? e.message : e).slice(0, 300) };
  } finally { try { lock.releaseLock(); } catch (e) {} }
}

/** The approver approves and the letter goes (test mode: to the approver and the test inbox). The renewal task opens on
 *  last year's billing record, and the client's page is filled. */
function girApproveSend_(who, r, st, b, save) {
  if (!who.approver) return { ok: false, error: 'Only the branch manager or the Branch Manager\'s Assistant approves a letter.' };
  var notice = girJ_(st && st.Notice, null), letter = girJ_(st && st.Letter, null);
  if (!notice) return { ok: false, error: 'Guardian General\'s notice has not been read: the letter needs the new premium.' };
  if (!letter) return { ok: false, error: 'There is no letter to approve.' };
  var email = gcmText_(st && st['E-mail']) || r.contact.email;
  if (!gcmEmailOk_(email)) return { ok: false, error: 'There is no e-mail for the client. Add one first.' };
  var live = girLive_(), claims = girClaims_(r), hist = girHistory_(r, { claims: claims }), values = girJ_(st && st.Values, {});
  var holder = gcmText_(st && st.Holder) || who.name;
  var test = !live, to = test ? girTestTo_(who, [gcmText_(st && st['Holder e-mail'])]) : [email];
  var m = girLetterHtml_(r, { notice: notice, letter: letter, values: values, hist: hist, email: test ? to[0] : email, holder: girTitle_(holder) },
    { banner: test ? '<b>TEST</b> · the renewal desk is in test mode. Live, this goes to <b>' + tEsc_(email) + '</b> with sales support copied.' : '' });
  girMail_(to[0], (test ? '[TEST] ' : '') + m.subject, m.html, { cc: test ? to.slice(1) : GCM.COPY });
  var task = '', wrote = test ? gcmYes_(b.writeSf) : true;
  if (wrote && tSfOn_()) { try { task = girRenewalTask_(r, st, who); } catch (e) { task = ''; } }
  if (task) girFeed_(task, 'Renewal desk · renewal letter ' + (test ? '(TEST) ' : '') + 'sent to ' + (test ? to[0] : email) + ', approved by ' + who.name + '. New premium ' + girMoney_(notice.total) + ' (last year ' + girMoney_(r.lastPremium) + '). The client approves on their renewal page; their answer comes here.');
  save({ Stage: 'sent', 'Approved by': who.name, 'Approved at': new Date(), 'Sent at': new Date(), 'Sent to': test ? to.join(', ') : email, Test: test ? 'Y' : '', Task: task || gcmText_(st && st.Task),
    'Client view': girClientView_(r, notice, letter, hist, claims, values) });
  girLog_(r.key, r, test ? 'letter sent (TEST)' : 'letter sent', who.name, (test ? to.join(', ') : email) + (task ? '; renewal task ' + task : ''));
  return { ok: true, said: test ? 'Approved. TEST: the letter went to ' + to.join(', ') + ' (not the client). Any of you can sign in at ' + GIR.SITE + ' with your own e-mail and answer it as the client.' + (task ? ' The renewal task is open.' : '') : 'Approved and sent to ' + email + '. The renewal task is open on last year\'s record.' };
}

/* ── proceed to renew ──────────────────────────────────────────────────────────────────── */
/** The client said yes: the new year's billing record and cover terms (with the confirmed values) go into Salesforce, a
 *  follow-up task opens on the new record, the instruction goes to Guardian General's renewals desk with support@ and
 *  sales support copied, and the delivery is put in the deliverer's calendar. Test mode: the instruction goes to the
 *  person and the test inbox, and Salesforce is written only when they tick that this renewal is really going ahead. */
function girProceed_(who, r, st, b, save) {
  var stage = girStageOf_(r, st), notice = girJ_(st && st.Notice, null), answer = girJ_(st && st['Client answer'], null);
  if (['instructed', 'confirmed', 'delivered', 'done'].indexOf(stage) >= 0) return { ok: false, error: 'This renewal was already instructed on ' + gcmWhen_(st['Proceed at']) + '.' };
  if (!answer || answer.decision !== 'approve') return { ok: false, error: 'Never without the client\'s yes: they approve on their renewal page, or record their yes (call, e-mail) first.' };
  if (!notice) return { ok: false, error: 'Guardian General\'s notice has not been read.' };
  var live = girLive_(), test = !live, writeSf = live || gcmYes_(b.writeSf);
  if (writeSf && !tSfOn_()) return { ok: false, error: 'Salesforce is not linked to this project.' };
  var values = Object.assign({}, girJ_(st && st.Values, {}));
  Object.keys(answer.values || {}).forEach(function (id) { var v = girNum_(answer.values[id]); if (v > 0) values[id] = { value: v, by: 'the client', src: 'client' }; });
  var today = gcmToday_(), holderEmail = gcmText_(st && st['Holder e-mail']), holder = girTitle_(gcmText_(st && st.Holder) || who.name);
  var match = function (x) {
    var ni = notice.items || [];
    if (x.vehicle) return ni.filter(function (n) { return n.reg && n.reg.replace(/\W/g, '') === x.vehicle.replace(/\W/g, ''); })[0] || null;
    if (r.items.length === 1 && ni.length === 1) return ni[0];
    return null;
  };
  var changes = [];
  r.items.forEach(function (x) { var v = values[x.id] ? values[x.id].value : 0; if (v && x.value && Math.abs(v - x.value) >= 1) changes.push({ x: x, from: x.value, to: v, by: values[x.id].src }); });
  var out = { trans: '', risks: [], follow: '', event: '', dropped: [], deliverer: '' };
  if (writeSf) {
    var raw = {};
    try { gcmQuery_('SELECT Id, ' + GIR_COPY.join(', ') + ' FROM Risk_Details__c WHERE Id IN (' + gcmIn_(r.items.map(function (x) { return x.id; })) + ')').forEach(function (x) { raw[gcmId15_(x.Id)] = x; }); } catch (e) {}
    var ownerId = girUserId_(holderEmail) || (r.owner.active ? r.owner.id : '') || girUserId_(who.email);
    var tr = { RecordTypeId: girRtId_('TRANSACTIONS__c', GIR_LINES[r.line].trt), INSURANCE_PORTFOLIO__c: r.items[0].shell, Account__c: r.account, Renewal_Date__c: notice.from || r.ren };
    if (r.contact.id) tr.Contact__c = r.contact.id;
    if (ownerId) tr.Owner__c = ownerId;
    if (!tr.RecordTypeId) delete tr.RecordTypeId;
    var tres = gblSfwSave_('post', '/sobjects/TRANSACTIONS__c', tr);
    out.trans = String(tres.res.id || ''); out.dropped = out.dropped.concat(tres.dropped);
    var perItem = r.items.some(function (x) { return match(x) && match(x).premium; }), first = true;
    r.items.forEach(function (x) {
      var n = match(x), rw = raw[gcmId15_(x.id)] || {}, body = {};
      GIR_COPY.forEach(function (f) { if (rw[f] !== undefined && rw[f] !== null && rw[f] !== '') body[f] = rw[f]; });
      var prem = n && n.premium ? n.premium : perItem ? 0 : (first ? notice.premium : 0);
      Object.assign(body, { RecordTypeId: x.rtId, TRANSACTIONS__c: out.trans, Client_Portfolio_Look_Up__c: x.shell, Account_Relation__c: r.account, Policy__c: notice.policy || x.policy,
        Carrier__c: 'Guardian General', From__c: notice.from, To__c: notice.to, Premium_01_Cover_01__c: girR_(prem), Risk_Classification__c: 'Renewal',
        Asset_Description__c: 'Renewed through the renewal desk on ' + tDmy_(today) + ' by ' + who.name + ', on the client\'s yes (' + (answer.via === 'staff' ? answer.comment : 'their renewal page, ' + answer.at) + '). ' +
          'Guardian General notice' + (notice.tranId ? ' Tran Id ' + notice.tranId : '') + ': ' + girMoney_(notice.total) + ' tax included.' + (!perItem && r.items.length > 1 ? ' The notice gives one premium for the policy: it is on the first item.' : '') });
      if (r.contact.id) body.Insured__c = r.contact.id;
      var v = values[x.id] ? values[x.id].value : (n && n.value ? n.value : 0);
      if (v) body.Cover1__c = v;
      if (n && n.windscreen) body.Windscreen__c = n.windscreen;
      if (!body.RecordTypeId) delete body.RecordTypeId;
      var rr = gblSfwSave_('post', '/sobjects/Risk_Details__c', body);
      out.risks.push(String(rr.res.id || '')); out.dropped = out.dropped.concat(rr.dropped);
      first = false;
    });
    var due = girAddWorking_(today, GIR.CHASE_WD);
    var task = { Subject: 'Renewal follow up: ' + String(r.client).toUpperCase() + ' ' + r.lineLabel + ' Policy # ' + (notice.policy || r.policy) + ' renewal ' + girMdy_(r.ren) + ' (instructed ' + girMdy_(today) + ')',
      WhatId: out.trans, ActivityDate: due, Priority: 'High', Status: 'In Progress', Task_Type__c: 'Renewa/PDl/Bill',
      Description: 'Instructed to Guardian General by the renewal desk on ' + tDmy_(today) + ' (' + who.name + ').\nIf Guardian General does not reply in ' + GIR.CHASE_WD + ' working days the desk follows up with the trail and posts it here.\n' +
        'Then: collect the schedule and certificates at Endeavour, deliver them (the delivery is in the calendar), and follow the payment until Guardian General confirms the receipt.' + (r.assignees.length ? '\nThe certificate also goes to ' + r.assignees.join(', ') + '.' : '') };
    if (r.contact.id) task.WhoId = r.contact.id;
    if (ownerId) task.OwnerId = ownerId;
    try { out.follow = String(gblSfwSave_('post', '/sobjects/Task', task).res.id || ''); } catch (e) { out.dropped.push('the follow-up task (' + String(e.message || e).slice(0, 80) + ')'); }
    var dv = girDeliverer_();
    if (dv) {
      var day = girPrevWorking_(r.ren), soonest = girAddWorking_(today, 2);
      if (day < soonest) day = soonest;
      var start = Utilities.parseDate(day + ' 10:00', tTz_(), 'yyyy-MM-dd HH:mm'), end = new Date(start.getTime() + 3600000);
      var ev = { Subject: 'Deliver renewal documents: ' + r.client + ' · ' + (notice.policy || r.policy), OwnerId: dv.id, WhatId: out.trans, StartDateTime: start.toISOString(), EndDateTime: end.toISOString(),
        Location: (r.items[0].location || r.client).slice(0, 255),
        Description: 'Collect the renewal schedule and certificates for ' + (notice.policy || r.policy) + ' at Endeavour once Guardian General says they are ready (the desk moves this appointment when they reply), and deliver them to ' + r.client +
          (r.contact.name ? ' (' + r.contact.name + (r.contact.mobile ? ', ' + r.contact.mobile : '') + ')' : '') + '.\nPremium ' + girMoney_(notice.total) + ', tax included. Ways to pay: branch (card, Linx, cash, cheque), card by phone, bank transfer, Solis Credit.' +
          (r.assignees.length ? '\nA copy of the certificate goes to ' + r.assignees.join(', ') + '.' : '') };
      if (r.contact.id) ev.WhoId = r.contact.id;
      try { out.event = String(gblSfwSave_('post', '/sobjects/Event', ev).res.id || ''); out.deliverer = dv.name; } catch (e) { out.dropped.push('the delivery appointment (' + String(e.message || e).slice(0, 80) + ')'); }
    }
  }
  /* the instruction */
  var regs = r.items.map(function (x) { return x.vehicle; }).filter(String);
  var subject = r.line === 'motor' ? 'Renewal Due -' + girMdy_(r.ren) + ' Policy #' + (notice.policy || r.policy) + '- Vehicle # - ' + (regs.length > 3 ? regs.length + ' vehicles' : regs.join(', ')) + ' - Insured - ' + r.client
    : 'Proceed to Renew: ' + r.client + ' ' + r.lineLabel + ' Policy # ' + (notice.policy || r.policy) + ' due ' + girMdy_(r.ren);
  var lines = ['<p>Dear Team,</p>',
    '<p>Please proceed to renew <b>' + tEsc_(notice.policy || r.policy) + '</b> for <b>' + tEsc_(r.client) + '</b>, due <b>' + tEsc_(tDmy_(r.ren)) + '</b>, on the terms of your renewal notice' +
      (notice.preparedOn ? ' of ' + tEsc_(tDmy_(notice.preparedOn)) : '') + (notice.tranId ? ' (Tran Id ' + tEsc_(notice.tranId) + ')' : '') + ': ' + tEsc_(girMoney_(notice.total)) + ', tax included.</p>',
    changes.length ? '<p><b>With these changes, confirmed by the client:</b></p><ul>' + changes.map(function (c) { return '<li>' + tEsc_(girItemLabel_(c.x)) + ': value ' + tEsc_(girWhole_(c.to)) + ' (was ' + tEsc_(girWhole_(c.from)) + ')</li>'; }).join('') + '</ul>' : '<p>No changes.</p>',
    answer.comment && answer.via !== 'staff' ? '<p>The client noted: “' + tEsc_(answer.comment) + '”</p>' : '',
    notice.reqs && notice.reqs.length ? '<p>Documents you asked for:</p><ul>' + notice.reqs.map(function (q) { return '<li>' + tEsc_(q) + '</li>'; }).join('') + '</ul><p>We will send any not already with you as the client provides them.</p>' : '',
    r.assignees.length ? '<p>' + tEsc_(r.assignees.join(', ')) + ' is noted on the policy: please issue its copy of the certificate.</p>' : '',
    '<p>Please confirm when the schedule and certificates are ready for collection at Endeavour.</p>',
    '<p>Regards,<br><b>' + tEsc_(holder) + '</b><br>Renewal Support · Ricky Rampersad Branch</p>'];
  var html = lines.join('');
  var to = test ? girTestTo_(who) : girGgTo_(r.line), cc = test ? [] : GIR.CC.slice();
  var banner = test ? '<div style="background:#fff4d6;border:1px solid #e3c25b;padding:10px 14px;font:13px Arial,sans-serif;margin-bottom:12px"><b>TEST</b> · live, this goes to ' + tEsc_(girGgTo_(r.line).join(', ')) + ' with ' + tEsc_(GIR.CC.join(', ')) + ' copied.' + (writeSf ? ' Salesforce WAS written.' : ' Salesforce was not written.') + '</div>' : '';
  girMail_(to[0], (test ? '[TEST] ' : '') + subject, banner + html, { cc: to.slice(1).concat(cc) });
  var task0 = gcmText_(st && st.Task);
  if (task0) girFeed_(task0, 'Renewal desk · proceed to renew sent to Guardian General ' + (test ? '(TEST) ' : '') + 'by ' + who.name + (out.trans ? '. New billing record and ' + out.risks.length + ' cover term(s) made; follow-up task ' + out.follow + '.' : '.'));
  if (out.follow) girFeed_(out.follow, 'Renewal desk · instruction sent to ' + to.join(', ') + ' on ' + tDmy_(today) + ': "' + subject + '". The desk follows up after ' + GIR.CHASE_WD + ' working days without a reply.');
  save({ Stage: 'instructed', 'Proceed by': who.name, 'Proceed at': new Date(), 'GG to': to.join(', '), 'GG subject': subject, 'GG sent at': new Date(), 'GG mail': html,
    'New trans': out.trans, 'New risks': out.risks, 'Follow task': out.follow, Event: out.event, Chases: [] });
  girLog_(r.key, r, test ? 'proceed to renew (TEST)' : 'proceed to renew', who.name, to.join(', ') + (out.trans ? '; Salesforce: ' + out.trans + ', ' + out.risks.length + ' term(s), task ' + out.follow + (out.event ? ', delivery ' + out.event : '') : '; Salesforce not written') +
    (out.dropped.length ? '; left out: ' + out.dropped.join(', ') : ''));
  return { ok: true, sf: out, said: (test ? 'TEST: the instruction went to ' + to.join(', ') + '. ' : 'Instructed: ' + to.join(', ') + ', copied ' + GIR.CC.join(', ') + '. ') +
    (out.trans ? 'Salesforce: a new billing record, ' + out.risks.length + ' cover term(s), a follow-up task' + (out.event ? ' and the delivery in ' + out.deliverer + '\'s calendar' : '') + '.' : 'Salesforce was not written.') };
}
function girGgTo_(line) {
  var o = null;
  try { o = JSON.parse(PropertiesService.getScriptProperties().getProperty('GIR_GG_TO') || 'null'); } catch (e) {}
  var map = o || GIR.GG_TO;
  return (GIR_LINES[line] && GIR_LINES[line].personal ? map.personal : map.commercial) || GIR.GG_TO.commercial;
}

/* ── Guardian General's reply, and the follow-up with the trail ─────────────────────────── */
var GIR_READY = /ready for (collection|pick\s*-?up)|ready at endeavour|(have|has) been (renewed|prepared)|renewed (and|&) prepared|documents (are )?ready|prepared and at/i;
var GIR_OURS = /@(rickyrampersadbranch\.com)$|^(ricky\.rampersad|rickyrampersadsalessupport|kamla\.dookran)@/i;
/** Whether Guardian General has written about this policy since the instruction: { at, subject, from, ready } or null. */
function girGgReplied_(r, st) {
  var sv = st['GG sent at'], sent = sv && typeof sv.getTime === 'function' ? sv.getTime() : new Date(gcmText_(sv)).getTime();
  if (!girDigits_(r.policy) || !sent || !tMsCreds_()) return null;
  var team = {};
  try { tTeam_().people.forEach(function (p) { if (p.email) team[String(p.email).toLowerCase()] = 1; }); } catch (e) {}
  var hit = girSearchPol_(r.policy).filter(function (m) { return m.ts > sent && /@myguardiangroup\.com$/i.test(m.from) && !GIR_OURS.test(m.from) && !team[m.from]; })[0];
  return hit ? { at: gcmWhen_(new Date(hit.ts)), subject: hit.subject.slice(0, 200), from: hit.name || hit.from, ready: GIR_READY.test(hit.subject + ' ' + hit.preview) } : null;
}
/** One follow-up to Guardian General, with the original instruction and every earlier follow-up below it. */
function girChaseOne_(r, st, who, manual) {
  if (!st || !st['GG sent at']) return { ok: false, error: 'Nothing has gone to Guardian General yet.' };
  var chases = girJ_(st.Chases, []), n = chases.length + 1, today = gcmToday_();
  var last = chases.length ? chases[chases.length - 1].ymd : gcmYmd_(st['GG sent at']);
  if (!manual && girWdBetween_(last, today) < GIR.CHASE_WD) return { ok: true, skipped: true };
  var to = gcmText_(st['GG to']).split(/\s*,\s*/).filter(String), test = gcmText_(st.Test) === 'Y' || !girLive_();
  if (!to.length) return { ok: false, error: 'There is no address on file for the instruction.' };
  var subject = 'Follow up' + (n > 1 ? ' ' + n : '') + ': ' + gcmText_(st['GG subject']);
  var trail = chases.slice().reverse().map(function (c) { return '<p style="color:#555">— Follow-up ' + c.n + ' sent ' + tEsc_(c.at) + '</p>'; }).join('');
  var html = '<p>Dear Team,</p><p>We have not had a reply to our instruction of ' + tEsc_(gcmWhen_(st['GG sent at'])) + ' (below) for <b>' + tEsc_(r.client) + '</b>, policy <b>' + tEsc_(r.policy) + '</b>, renewing <b>' + tEsc_(tDmy_(r.ren)) +
    '</b>. Please confirm where it stands and when the schedule and certificates will be ready at Endeavour.</p><p>Regards,<br>Renewal Support · Ricky Rampersad Branch</p>' +
    '<hr>' + trail + '<p style="color:#555">— Our instruction, ' + tEsc_(gcmWhen_(st['GG sent at'])) + ', to ' + tEsc_(gcmText_(st['GG to'])) + '<br>Subject: ' + tEsc_(gcmText_(st['GG subject'])) + '</p><blockquote style="border-left:3px solid #ccc;margin:0;padding-left:12px">' + gcmText_(st['GG mail']) + '</blockquote>';
  girMail_(to[0], (test && !/^\[TEST\]/.test(subject) ? '[TEST] ' : '') + subject, html, { cc: to.slice(1).concat(test ? [] : GIR.CC) });
  chases.push({ n: n, at: gcmWhen_(new Date()), ymd: today, by: who ? who.name : 'the desk' });
  girSave_(r.key, { Chases: chases });
  if (gcmText_(st['Follow task'])) girFeed_(gcmText_(st['Follow task']), 'Renewal desk · ' + (manual ? 'follow-up sent by ' + who.name : 'no reply from Guardian General in ' + GIR.CHASE_WD + ' working days: follow-up ' + n + ' sent') + ' to ' + to.join(', ') + ', with the trail.');
  girLog_(r.key, r, 'follow-up ' + n + ' to Guardian General', who ? who.name : 'the desk', to.join(', '));
  if (n === GIR.CHASE_MAX) girApprovers_().forEach(function (a) { girInternal_(a.email, 'Guardian General has not answered · ' + r.client + ' · ' + r.policy,
    '<p>Guardian General has not answered ' + n + ' follow-ups on the renewal instruction for <b>' + tEsc_(r.client) + '</b> (' + tEsc_(r.policy) + ', renewing ' + tEsc_(tDmy_(r.ren)) + '), first sent ' + tEsc_(gcmWhen_(st['GG sent at'])) + '.</p><p><a href="' + GIR.DESK + '#' + encodeURIComponent(r.key) + '">Open it on the renewal desk</a></p>'); });
  return { ok: true, said: 'Follow-up ' + n + ' sent to ' + to.join(', ') + ' with the trail.' };
}

/* ── the hourly run ────────────────────────────────────────────────────────────────────── */
/** From gcmRefreshTick: once an hour on working days, 8:00 to 17:00. Guardian General's replies and the follow-ups; the
 *  client's reminders at 14 and 10 days; at 7 days with no answer, a call task and the branch manager told. */
function girTick_(o) {
  o = o || {};
  var tz = tTz_(), now = new Date(), h = Number(Utilities.formatDate(now, tz, 'H')), today = gcmToday_();
  if (!o.force && (!girWorking_(today) || h < 8 || h > 17)) return { ok: true, skipped: 'outside hours' };
  var props = PropertiesService.getScriptProperties(), slot = today + 'T' + h;
  if (!o.force && props.getProperty('GIR_TICK_LAST') === slot) return { ok: true, skipped: 'ran this hour' };
  props.setProperty('GIR_TICK_LAST', slot);
  var rows = girRows_(GIR.TAB), done = { replies: 0, chases: 0, reminders: 0, calls: 0 }, t0 = Date.now();
  rows.forEach(function (st) {
    if (Date.now() - t0 > 240000) return;
    var stage = gcmText_(st.Stage), key = gcmText_(st.Key);
    var r = { key: key, policy: gcmText_(st.Policy), client: gcmText_(st.Client), ren: gcmYmd_(st.Renewal), lineLabel: gcmText_(st.Line), trans: gcmText_(st['Last trans']).split(/\s+/).filter(String) };
    try {
      if (stage === 'instructed') {
        /* a practice instruction (test mode, Salesforce not written) never went to Guardian General: their mail about the
           real policy is not its reply */
        var rep = gcmText_(st.Test) === 'Y' && !gcmText_(st['New trans']) ? null : girGgReplied_(r, st);
        if (rep) {
          girSave_(key, { 'GG reply': rep, Stage: rep.ready ? 'confirmed' : stage });
          if (gcmText_(st['Follow task'])) girFeed_(gcmText_(st['Follow task']), 'Renewal desk · Guardian General replied ' + rep.at + ' (' + rep.from + '): "' + rep.subject + '"' + (rep.ready ? '. The documents look ready: the delivery is moved to the next working day.' : '.'));
          if (rep.ready && gcmText_(st.Event)) girMoveEvent_(gcmText_(st.Event), girNextWorking_(today));
          girLog_(key, r, 'Guardian General replied', 'the desk', rep.subject);
          done.replies++;
        } else {
          var c = girChaseOne_(r, st, null, false);
          if (c.ok && !c.skipped) done.chases++;
        }
      } else if (stage === 'sent' || stage === 'changes') {
        var days = gcmDays_(today, r.ren), rem = girJ_(st.Reminders, {}), sentTo = girSentTo_(st), email = sentTo[0] || '';
        var step = days <= GIR.CALL_AT ? 'call' : days <= GIR.REMIND[1] ? 'r' + GIR.REMIND[1] : days <= GIR.REMIND[0] ? 'r' + GIR.REMIND[0] : '';
        if (!step || rem[step]) return;
        /* a letter that went late gets two working days before the first reminder follows it */
        if (step !== 'call' && girWdBetween_(gcmYmd_(st['Sent at']), today) < 2) return;
        if (step === 'call') {
          var tid = '';
          try {
            if (tSfOn_() && gcmText_(st.Test) !== 'Y') {
              var owner = girUserId_(gcmText_(st['Holder e-mail']));
              var tk = { Subject: 'Call the client: renewal ' + girMdy_(r.ren) + ' Policy # ' + r.policy + ' - ' + r.client + ' has not answered the renewal letter', WhatId: r.trans[0] || undefined,
                ActivityDate: today, Priority: 'High', Status: 'Not Started', Task_Type__c: 'Renewa/PDl/Bill', Description: 'The renewal letter went ' + gcmWhen_(st['Sent at']) + ' and the client has not answered. Call them today. Nothing goes to Guardian General without their yes; the branch manager decides what happens if there is none.' };
              if (owner) tk.OwnerId = owner;
              if (!tk.WhatId) delete tk.WhatId;
              tid = String(gblSfwSave_('post', '/sobjects/Task', tk).res.id || '');
            }
          } catch (e) {}
          girApprovers_().forEach(function (a) { girInternal_(a.email, (gcmText_(st.Test) === 'Y' ? '[TEST] ' : '') + 'No answer, ' + days + ' days to go · ' + r.client + ' · ' + r.policy,
            '<p><b>' + tEsc_(r.client) + '</b> has not answered the renewal letter for ' + tEsc_(r.lineLabel) + ' ' + tEsc_(r.policy) + ', which renews on <b>' + tEsc_(tDmy_(r.ren)) + '</b>. A call task is open' + (gcmText_(st.Holder) ? ' for ' + tEsc_(gcmText_(st.Holder)) : '') +
            '. Nothing goes to Guardian General without their yes: please decide what happens if they cannot be reached.</p><p><a href="' + GIR.DESK + '#' + encodeURIComponent(key) + '">Open it on the renewal desk</a></p>'); });
          rem.call = { at: gcmWhen_(now), task: tid };
          done.calls++;
        } else {
          if (!gcmEmailOk_(email)) return;
          var view = girJ_(st['Client view'], null) || {}, test = gcmText_(st.Test) === 'Y';
          var link = GIR.SITE + '?e=' + encodeURIComponent(email) + '&k=' + encodeURIComponent(key);
          var html = '<div style="max-width:600px;font:15px/1.6 Arial,sans-serif;color:#1d2b3a"><p>Hello,</p><p>A reminder that your ' + tEsc_(String(r.lineLabel).toLowerCase()) + ' policy <b>' + tEsc_(r.policy) + '</b> renews on <b>' + tEsc_(tDmy_(r.ren)) +
            '</b>, in ' + days + ' days' + (view.total ? ', at ' + tEsc_(girMoney_(view.total)) + ' tax included' : '') + '. We renew only once you say yes.</p><p><a href="' + link + '" style="display:inline-block;background:#0d1f33;color:#fff;text-decoration:none;font-weight:700;padding:12px 20px;border-radius:9px">Review and approve your renewal</a></p>' +
            '<p>Or simply reply to this e-mail, or call the branch on ' + GIR.BRANCH_TELS + '.</p><p>Warm regards,<br>Ricky Rampersad Branch · Guardian Life of the Caribbean</p><div style="font-size:11px;color:#6b7785">' + tLegal_(null) + '</div></div>';
          girMail_(email, (test ? '[TEST] ' : '') + 'Reminder: your renewal on ' + tDmy_(r.ren) + ' · policy ' + r.policy, html, { cc: test ? sentTo.slice(1) : GCM.COPY });
          rem[step] = { at: gcmWhen_(now) };
          done.reminders++;
        }
        girSave_(key, { Reminders: rem });
        girLog_(key, r, step === 'call' ? 'no answer: call task, branch manager told' : 'reminder to the client', 'the desk', step);
      }
    } catch (e) { girLog_(key, r, 'hourly run failed', 'the desk', String(e && e.message ? e.message : e).slice(0, 200)); }
  });
  return { ok: true, done: done };
}
function girMoveEvent_(id, day) {
  try { var s = Utilities.parseDate(day + ' 10:00', tTz_(), 'yyyy-MM-dd HH:mm'); tSfSend_('patch', '/sobjects/Event/' + id, { StartDateTime: s.toISOString(), EndDateTime: new Date(s.getTime() + 3600000).toISOString() }); return true; } catch (e) { return false; }
}

/* ── the client's page ─────────────────────────────────────────────────────────────────── */
function girHash_(s) { return Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, String(s || '').trim().toLowerCase()).map(function (b) { return ('0' + ((b + 256) % 256).toString(16)).slice(-2); }).join('').slice(0, 32); }
/** The renewals whose letter went to this address. */
function girRowsFor_(email) {
  email = String(email || '').trim().toLowerCase();
  if (!email) return [];
  return girRows_(GIR.TAB).filter(function (st) {
    if (!st['Sent at'] || gcmText_(st.Stage) === 'lost') return false;
    if (gcmText_(st.Test) === 'Y') return girSentTo_(st).some(function (a) { return a.toLowerCase() === email; });
    return gcmText_(st['Sent to']).toLowerCase() === email || gcmText_(st['E-mail']).toLowerCase() === email;
  });
}
/** gcm.renCode: a six-digit code to the address, when we have a renewal for it. The answer is the same either way. */
function girCode_(b) {
  var email = String(b.email || '').trim().toLowerCase(), said = 'If we have a renewal for that address, a code is on its way. It is good for ' + GIR.CODE_MIN + ' minutes.';
  if (!gcmEmailOk_(email)) return { ok: false, error: 'Enter the e-mail address our letter came to.' };
  var cache = CacheService.getScriptCache(), k = 'gir-c-' + girHash_(email);
  if (!girRowsFor_(email).length) return { ok: true, said: said };
  var have = girJ_(cache.get(k), null);
  if (have && Date.now() - have.ts < 60000) return { ok: true, said: said };
  var code = String(100000 + Math.floor(Math.random() * 900000));
  cache.put(k, JSON.stringify({ code: code, tries: 0, ts: Date.now() }), GIR.CODE_MIN * 60);
  try {
    girMail_(email, 'Your renewal sign-in code: ' + code, '<div style="font:15px/1.6 Arial,sans-serif;color:#1d2b3a"><p>Your code to see your renewal is</p><p style="font:700 28px Arial,sans-serif;letter-spacing:4px">' + code +
      '</p><p>It is good for ' + GIR.CODE_MIN + ' minutes. If you did not ask for it, you can ignore this e-mail.</p><p>Ricky Rampersad Branch · Guardian Life of the Caribbean</p></div>');
  } catch (e) { return { ok: false, error: 'We could not send the code just now. Please call the branch on ' + GIR.BRANCH_TELS + '.' }; }
  return { ok: true, said: said };
}
/** gcm.renIn: the code, for a sign-in that lasts six hours. */
function girIn_(b) {
  var email = String(b.email || '').trim().toLowerCase(), code = String(b.code || '').replace(/\D/g, '');
  var cache = CacheService.getScriptCache(), k = 'gir-c-' + girHash_(email), have = girJ_(cache.get(k), null);
  if (!have) return { ok: false, error: 'That code has expired. Ask for a new one.' };
  if (have.tries >= GIR.CODE_TRIES) return { ok: false, error: 'Too many tries. Ask for a new code.' };
  if (code !== have.code) { have.tries++; cache.put(k, JSON.stringify(have), GIR.CODE_MIN * 60); return { ok: false, error: 'That code is not right. Check the latest e-mail from us.' }; }
  cache.remove(k);
  var token = Utilities.getUuid().replace(/-/g, '');
  cache.put('gir-s-' + token, email, GIR.SESSION_S);
  return { ok: true, token: token };
}
function girSession_(token) { var e = token ? CacheService.getScriptCache().get('gir-s-' + String(token).replace(/[^a-f0-9]/gi, '')) : null; return e ? String(e) : ''; }
/** One renewal as the client sees it: what renews, the premium, the history, what we suggest, and where it stands. */
function girView_(st) {
  var v = girJ_(st['Client view'], null) || {}, stage = gcmText_(st.Stage), a = girJ_(st['Client answer'], null);
  var steps = [['sent', 'Letter sent'], ['approved', 'You approved'], ['instructed', 'With Guardian General'], ['confirmed', 'Documents ready'], ['delivered', 'Delivered']];
  var at = (GIR_STAGES[stage] || GIR_STAGES.sent).n;
  return Object.assign({}, v, { stage: stage, stageLabel: stage === 'changes' ? 'You asked for changes: we are on it' : stage === 'lost' ? 'Not renewing' : girStage_(stage).label,
    steps: steps.map(function (s) { return { k: s[0], label: s[1], done: at >= GIR_STAGES[s[0]].n && !(s[0] === 'approved' && stage === 'changes') }; }),
    answer: a ? { decision: a.decision, at: a.at, comment: a.comment, values: a.values || {}, name: a.name } : null,
    comments: (a && a.history || []).concat(a && a.comment ? [{ at: a.at, text: a.comment, name: a.name }] : []).slice(-8),
    open: ['sent', 'changes', 'approved'].indexOf(stage) >= 0, holder: girTitle_(gcmText_(st.Holder)) || 'our renewals team', practice: gcmText_(st.Test) === 'Y' });
}
/** gcm.renMine: the client's renewals. */
function girMine_(p) {
  var email = girSession_(p.token);
  if (!email) return { ok: false, expired: true, error: 'Please sign in again.' };
  var rows = girRowsFor_(email).map(girView_).sort(function (a, b) { return String(a.ren).localeCompare(String(b.ren)); });
  return { ok: true, email: email, renewals: rows, tels: GIR.BRANCH_TELS, direct: GIR.DIRECT_TEL };
}
/** The client's answer: approve, ask for changes (their own values), or a question. It goes onto the renewal task's
 *  Chatter with the task's owner mentioned, and the person working it and the approvers are told. */
function girTakeAnswer_(st, b, name, via) {
  var key = gcmText_(st.Key), stage = gcmText_(st.Stage), decision = String(b.decision || '').toLowerCase();
  if (['approve', 'changes', 'question'].indexOf(decision) < 0) return { ok: false, error: 'Choose approve, changes or a question.' };
  if (['sent', 'changes', 'approved'].indexOf(stage) < 0 && decision !== 'question') return { ok: false, error: 'This renewal is already with Guardian General. Send us a question instead.' };
  var comment = String(b.comment || '').trim().slice(0, 1500);
  if (decision !== 'approve' && comment.length < 3) return { ok: false, error: decision === 'changes' ? 'Tell us what has changed.' : 'Write your question.' };
  var vals = {}, got = girJ_(b.values, null) || b.values || {};
  var view = girJ_(st['Client view'], {}) || {};
  (view.items || []).forEach(function (x) { var n = girNum_(got[x.id]); if (n > 0 && Math.abs(n - (x.value || 0)) >= 1) vals[x.id] = n; });
  var old = girJ_(st['Client answer'], null), hist = old ? (old.history || []).concat(old.comment ? [{ at: old.at, text: old.comment, name: old.name, decision: old.decision }] : []) : [];
  /* a question leaves the decision where it was */
  var ans = { decision: decision === 'question' ? (old ? old.decision : '') : decision, at: gcmWhen_(new Date()), name: String(name || '').slice(0, 80), comment: comment,
    values: Object.keys(vals).length ? vals : (old && old.values) || {}, via: via, history: hist.slice(-12) };
  var next = decision === 'approve' ? 'approved' : decision === 'changes' ? 'changes' : stage;
  girSave_(key, { 'Client answer': ans, Stage: next });
  var r = { key: key, policy: gcmText_(st.Policy), client: gcmText_(st.Client) };
  var said = decision === 'approve' ? 'APPROVED the renewal' + (Object.keys(vals).length ? ' with new values: ' + (view.items || []).filter(function (x) { return vals[x.id]; }).map(function (x) { return x.label + ' ' + girWhole_(vals[x.id]); }).join('; ') : '') :
    decision === 'changes' ? 'asked for changes' : 'asked a question';
  girLog_(key, r, 'client ' + (decision === 'approve' ? 'approved' : decision === 'changes' ? 'asked for changes' : 'asked a question'), name || 'the client', comment);
  var task = gcmText_(st.Task), owner = '';
  /* no task recorded (a letter sent in test mode): the renewal task already open on last year's record, if there is one */
  var test = gcmText_(st.Test) === 'Y';
  if (!task && !test && tSfOn_()) {
    try {
      var rr = girFind_(key), dg = girDigits_(r.policy);
      var ot = rr ? girTasks_(rr).filter(function (t) { return /risk to renew/i.test(t.subject) && dg && t.subject.replace(/\s+/g, '').indexOf(dg) >= 0; })[0] : null;
      if (ot) { task = ot.id; owner = ot.ownerId; girSave_(key, { Task: task }); }
    } catch (e) {}
  }
  if (task && !owner && tSfOn_()) { try { var t = gcmQuery_("SELECT OwnerId FROM Task WHERE Id = '" + svcSoqlLit_(task) + "' LIMIT 1")[0]; owner = t ? String(t.OwnerId || '') : ''; } catch (e) {} }
  if (task) girFeed_(task, 'From the client on their renewal page' + (name ? ' (' + name + ')' : '') + ' · ' + via + ': ' + said + (comment ? '\n"' + comment + '"' : '') + '\n', owner);
  var tell = [gcmText_(st['Holder e-mail'])].concat(girApprovers_().map(function (a) { return a.email; })).filter(function (e, i, arr) { return e && arr.indexOf(e) === i; });
  tell.forEach(function (e) { girInternal_(e, (test ? '[TEST] ' : '') + (decision === 'approve' ? 'Approved' : decision === 'changes' ? 'Changes asked' : 'Question') + ' · renewal · ' + r.client + ' · ' + r.policy,
    '<p><b>' + tEsc_(r.client) + '</b> ' + tEsc_(said) + ' on their renewal page' + (name ? ' (' + tEsc_(name) + ')' : '') + '.</p>' + (comment ? '<blockquote>' + tEsc_(comment) + '</blockquote>' : '') +
    '<p>' + (decision === 'approve' ? 'Next: proceed to renew on the desk.' : 'Next: answer them, and adjust before proceeding.') + ' <a href="' + GIR.DESK + '#' + encodeURIComponent(key) + '">Open it on the renewal desk</a></p>'); });
  return { ok: true, said: decision === 'approve' ? 'Thank you. We will instruct Guardian General and let you know when your documents are ready.' : decision === 'changes' ? 'Thank you. We will look at the changes and come back to you before anything is renewed.' : 'Thank you. We will answer you shortly.' };
}
/** gcm.renAnswer: the client's answer from their page. */
function girAnswer_(b) {
  var email = girSession_(b.token);
  if (!email) return { ok: false, expired: true, error: 'Please sign in again.' };
  var st = girRowsFor_(email).filter(function (x) { return gcmText_(x.Key) === String(b.key || ''); })[0];
  if (!st) return { ok: false, error: 'That renewal is not one of yours.' };
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return { ok: false, error: 'Please try again in a moment.' };
  try { return girTakeAnswer_(st, b, String(b.name || '').trim() || email, 'signed in as ' + email); } finally { try { lock.releaseLock(); } catch (e) {} }
}
/** gcm.renGroup: a group's renewals, on its own page (signed in with its list bill and code). */
function girGroupView_(p) {
  var L = gcmLoad_(), a = gcmClientAuth_(L, p.lb, p.code);
  if (!a.ok) return a;
  var accts = a.g.accts.map(gcmId15_);
  var rows = girRows_(GIR.TAB).filter(function (st) { return st['Sent at'] && gcmText_(st.Test) !== 'Y' && accts.indexOf(gcmId15_(gcmText_(st.Account))) >= 0; });
  return { ok: true, group: a.g.name, renewals: rows.map(girView_).sort(function (x, y) { return String(x.ren).localeCompare(String(y.ren)); }) };
}
function girGroupAnswer_(b) {
  var L = gcmLoad_(), a = gcmClientAuth_(L, b.lb, b.code);
  if (!a.ok) return a;
  var name = String(b.name || '').trim();
  if (name.length < 2) return { ok: false, error: 'Give your name, so we know who approved.' };
  var accts = a.g.accts.map(gcmId15_);
  var st = girRows_(GIR.TAB).filter(function (x) { return gcmText_(x.Key) === String(b.key || '') && x['Sent at'] && accts.indexOf(gcmId15_(gcmText_(x.Account))) >= 0; })[0];
  if (!st) return { ok: false, error: 'That renewal is not on your account.' };
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(15000)) return { ok: false, error: 'Please try again in a moment.' };
  try { return girTakeAnswer_(st, b, name + (b.role ? ', ' + String(b.role).slice(0, 60) : ''), 'on ' + a.g.name + '\'s service page'); } finally { try { lock.releaseLock(); } catch (e) {} }
}

/* ── practice runs ─────────────────────────────────────────────────────────────────────── */
/* In test mode staff practise on the month's real renewals: Salesforce is read, nothing is written unless ticked, and every
   e-mail goes to the team. A renewal practised that way is a Test row from its letter on; it can be started again on the
   desk, and girGoLive puts every one back to its letter, so nothing practised reads as sent once the desk is live. */
var GIR_PRACTICE_CLEAR = ['Submitted by', 'Approved by', 'Approved at', 'Sent at', 'Sent to', 'Test', 'Client view', 'Client answer', 'Reminders',
  'Proceed by', 'Proceed at', 'GG to', 'GG subject', 'GG sent at', 'GG mail', 'New risks', 'Follow task', 'Event', 'Chases', 'GG reply', 'Delivered', 'Paid', 'Outcome'];
var GIR_PRACTICE_WORK = ['Notice', 'Values', 'Letter', 'Holder', 'Holder e-mail'];
/** One of ours: support@, the branch's own mailboxes, anyone on the Agent Skill Bank. */
function girOurAddress_(em) {
  em = String(em || '').trim().toLowerCase();
  if (!em) return false;
  if (GIR_OURS.test(em) || GIR.TEST_TO.some(function (a) { return a.toLowerCase() === em; })) return true;
  try { return tTeam_().people.some(function (p) { return String(p.email || '').toLowerCase() === em; }); } catch (e) { return false; }
}
/** Whether this person can start this renewal again: { can, why }. */
function girPracticeFor_(who, st) {
  if (!st) return { can: false, why: 'Nothing has been done on this renewal yet.' };
  if (gcmText_(st['New trans'])) return { can: false, why: 'Salesforce was written for this renewal (a new billing record), so it really went ahead and cannot be started again.' };
  if (girLive_() && gcmText_(st.Test) !== 'Y') return { can: false, why: 'The desk is live: only a renewal practised in test mode can be started again.' };
  var holder = gcmText_(st.Holder).toLowerCase();
  if (!who.approver && (!holder || holder !== String(who.name || '').toLowerCase())) return { can: false, why: 'Only the person who has this renewal, the branch manager or the Branch Manager\'s Assistant can start it again.' };
  return { can: true, why: '' };
}
/** The fields that put a renewal back: to its letter (the notice, values and letter kept), or to the start. */
function girPracticePatch_(st, from) {
  var p = {};
  GIR_PRACTICE_CLEAR.forEach(function (h) { p[h] = ''; });
  if (from === 'start') { GIR_PRACTICE_WORK.forEach(function (h) { p[h] = ''; }); p.Stage = ''; }
  else p.Stage = girJ_(st && st.Letter, null) ? 'drafted' : girJ_(st && st.Notice, null) ? 'notice' : '';
  if (girOurAddress_(gcmText_(st && st['E-mail']))) p['E-mail'] = '';
  return p;
}
/** Every renewal practised in test mode, back to its letter. A renewal Salesforce was written for is left and named. */
function girClearPractice_() {
  var out = { cleared: [], kept: [], emails: [] };
  girRows_(GIR.TAB).forEach(function (st) {
    var key = gcmText_(st.Key), r = { policy: gcmText_(st.Policy), client: gcmText_(st.Client) }, name = r.client + ' · ' + r.policy;
    if (girOurAddress_(gcmText_(st['E-mail'])) && !gcmText_(st['New trans'])) { girSave_(key, { 'E-mail': '' }); out.emails.push(name); }
    if (gcmText_(st.Test) !== 'Y') return;
    if (gcmText_(st['New trans'])) { out.kept.push(name); return; }
    girSave_(key, girPracticePatch_(st, 'letter'));
    girLog_(key, r, 'practice cleared', 'the desk', 'the test letter and everything after it; the notice, values and letter are kept and need approving again');
    out.cleared.push(name);
  });
  return out;
}

/* ── the letter, before it goes; the ping; go live ─────────────────────────────────────── */
/** gcm.renPreview: the letter as the client would read it, for the desk. */
function girPreview_(p) {
  var who = girWho_(p);
  if (!who.ok) return who;
  var r = girFind_(p.key);
  if (!r) return { ok: false, error: 'That renewal is not in Salesforce for that month any more.' };
  var st = girState_()[r.key] || {}, notice = girJ_(st.Notice, null);
  var m = girLetterHtml_(r, { notice: notice || {}, letter: girJ_(st.Letter, null) || girTemplate_(r, notice), values: girJ_(st.Values, {}), hist: girHistory_(r),
    email: gcmText_(st['E-mail']) || r.contact.email, holder: girTitle_(gcmText_(st.Holder) || who.name) }, { banner: '<b>PREVIEW</b> · this is the letter as the client will read it. Nothing has been sent.' });
  return { ok: true, subject: m.subject, html: m.html };
}
function girPing_() {
  var n = 0; try { n = girRows_(GIR.TAB).length; } catch (e) {}
  return { live: girLive_(), rows: n, mail: !!tMsCreds_(), ai: !!gcmAiKey_(), salesforce: tSfOn_() };
}
/** The editor's Run button: the letters, reminders and instructions go to clients and Guardian General from now on. */
function girGoLive() {
  var o = girClearPractice_();
  PropertiesService.getScriptProperties().setProperty(GIR.LIVE_PROP, 'on');
  return tSay_('The renewal desk is live: letters, reminders and instructions now go to clients and to Guardian General.' + girPracticeSaid_(o));
}
/** The editor's Run button: put every practice renewal back to its letter (between training sessions, or before go live). */
function girClearPractice() { return tSay_('Practice cleared.' + girPracticeSaid_(girClearPractice_())); }
function girPracticeSaid_(o) {
  return (o.cleared.length ? ' ' + o.cleared.length + ' practice renewal(s) went back to their letter, which needs approving again before it goes: ' + o.cleared.join('; ') + '.' : ' No practice renewals to clear.') +
    (o.emails.length ? ' A staff address was taken off as the client\'s e-mail on: ' + o.emails.join('; ') + '.' : '') +
    (o.kept.length ? ' Left as they are, because Salesforce was written for them: ' + o.kept.join('; ') + '.' : '');
}
function girTestMode() { PropertiesService.getScriptProperties().deleteProperty(GIR.LIVE_PROP); return tSay_('The renewal desk is in test mode: client and Guardian General mail goes to the person who pressed and to ' + GIR.TEST_TO.join(', ') + ', marked TEST.'); }
function girTickNow() { var r = girTick_({ force: true }); return tSay_(JSON.stringify(r.done || r)); }
