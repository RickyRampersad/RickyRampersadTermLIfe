/**
 * ServiceSalesforce.gs — trace a review against CLIENT_PORTFOLIO__c.
 *
 * The review asks a client for their name, date of birth and email, and
 * promises "you do the easy part, we trace it". Until now a person did that
 * tracing by hand. This does it the moment the review lands.
 *
 * ── THE ONE RULE ─────────────────────────────────────────────────────────
 * What this finds NEVER goes back to the browser. The review page is public
 * and has no login, by design — asking an orphan to log in is what kills the
 * response rate. A name, a date of birth and an email address are three
 * things a stranger can know or guess, so they are not proof of identity. If
 * the page answered them with a policy record, anyone who could name one of
 * our clients could pull their cover, their premium and their beneficiary.
 *
 * So the match runs server-side and its results go to exactly three places:
 * the worklist row, the agent's brief, and the Customer Service email. The
 * client is told only that a record was found.
 *
 * `svcRedactForClient_` is the boundary, and tools/tests/sf-match.js fails
 * the build if a policy field ever appears in a client-bound payload.
 * ─────────────────────────────────────────────────────────────────────────
 *
 * Setup, once, in this project's Script Properties (Project Settings →
 * Script Properties). These are the same four the KPI tracker uses, but this
 * is a separate Apps Script project so it needs its own copy:
 *
 *   SF_KEY     Connected App consumer key
 *   SF_SECRET  Connected App consumer secret
 *   SF_USER    integration username
 *   SF_PASS    that user's password with the security token appended, no space
 *
 * Optional: SF_LOGIN_URL (defaults to the production login host).
 *
 * With none of them set, every function here returns "not configured" and the
 * review carries on exactly as it does today. Nothing breaks; the policy
 * number simply stays "being traced by support".
 */

var SVCSF = {
  LOGIN:  'https://login.salesforce.com',
  API:    'v60.0',
  OBJECT: 'CLIENT_PORTFOLIO__c',
  LIMIT:  25,                       // a person with more than 25 policies needs a human anyway

  /* The fields worth carrying. Of 428 on the object, these are the ones a
     servicing agent actually needs before they pick up the phone. */
  FIELDS: [
    'Id', 'Name', 'POLICY__c', 'Policy_ID__c', 'Client_ID__c',
    'PLAN_NAME__c', 'Product_Name__c', 'Plan_Description__c',
    'Life_Coverage__c', 'Critical_Illness_Coverage__c', 'ADDAP_Coverage__c',
    'Life_Premium__c', 'BILLING_PREMIUM__c', 'PREMIUM_OWING__c', 'Premium_Mode__c',
    'ISSUE_DATE__c', 'Maturity_Date__c', 'Life_Coverage_Expiry__c',
    'Writing_Agent__c', 'Assigned_Agent__c',
    'FIRST_NAME__c', 'LAST_NAME__c', 'Email__c', 'Mobile__c', 'Date_Of_Birth__c',
    /* The household: the Account the policy hangs off, and the address, so a
       worklist can be sorted by who lives together before it is split between
       agents. Read only — see the household note below. */
    'Account__c', 'Street__c', 'City__c', 'Contact__c',
  ],

  /* A household with more members than this is not a household. One of the
     policies in the book we analysed hangs off "ScotiaBank Trinidad and
     Tobago Limited", a BUSINESS ACCOUNT carrying 15,422 contacts — group
     naively by Account and that one client appears to live with fifteen
     thousand people. The record-type check below is the real guard; this is
     the belt to its braces. */
  HH_MAX: 12,
};

/**
 * A candidate address key: house number plus the first real word of the street.
 *
 * Guardian's addresses are typed freehand into one field and the same house is
 * never spelled the same way twice. In one agent's book of 246 clients, exact
 * matching on the street found 3 shared addresses; this rule finds 14. The
 * variants it is built to survive, all real:
 *
 *     "# 8 RAPHIA DRIVE\r\nROYSTONIA"   "#8 Raphia Drive Roystonia"
 *     "#64 LAPWING  EDINBURGH 50"       "#64 LAPWING CRESENT EDINB"
 *     "22 SEVENTH ST"                   "22 SEVENTH STREET"
 *     "LP 53 POPE AVE\r\nTUMPUNA RD"    "LP53 POPE AVENUE\r\nTUMPUNA ROAD"
 *
 * It keeps the number and one street word and throws the rest away, because
 * everything after that — the district, the second line, the estate name — is
 * where the spelling goes wrong. "LP" and "LOT" are dropped as prefixes but
 * the number after them is kept: in Trinidad the light-pole number IS the
 * house number.
 *
 * It is a CANDIDATE, never an automatic merge. It cannot see through a
 * truncated field ("FOSTER ROA", "EDINB"), and two different houses on one
 * short street will collide. Sorting a worklist by it puts likely neighbours
 * next to each other for a person to confirm — that is all it is for.
 */
function svcAddrKey_(street) {
  var s = String(street == null ? '' : street).toUpperCase();
  /* The slash survives: "LP 22/2" and "LP 4/32" are whole house numbers here,
     and splitting them on the slash threw the street name out of the key. */
  s = s.replace(/[\r\n]+/g, ' ').replace(/[^A-Z0-9/ ]+/g, ' ');
  /* The lookahead rather than a closing \b is deliberate: "LP53 POPE AVENUE"
     is written without a space as often as "LP 53", and \bLP\b does not match
     the first one — which left the whole address unkeyed. */
  s = s.replace(/\b(?:L\s*P|E\s*P|LOT|LT|NO|POLE|PO\s*BX|APT|BLDG|BUILDING|UNIT)(?=\s|\d|$)/g, ' ');
  s = s.replace(/\bN\s+A\b/g, ' ');                       // the "N/A" filler line
  s = s.replace(/\s+/g, ' ').trim();
  var m = s.match(/^(\d+[A-Z]?(?:\s*\/\s*\d+[A-Z]?)?)\s+(.*)$/);
  if (!m) return '';                                       // no house number, no key
  var num = m[1].replace(/\s*\/\s*/g, '/');
  var words = m[2].split(' ').filter(Boolean);
  if (!words.length) return '';
  /* Keep taking words until one of them is long enough to actually be the
     street's name. A short leading token is never the name — it is a prefix
     ("MT HOPE", "ST JOHN", "SAN JUAN") or a unit letter ("12 C GUARACARA").
     Stopping at the first word instead put a Gasparillo house and a Point
     Fortin apartment under the same key, "12 C", which is exactly the false
     merge this key must not make. */
  var name = [], i;
  for (i = 0; i < words.length && i < 3; i++) {
    name.push(words[i]);
    if (words[i].length >= 4) break;
  }
  if (!name.length) return '';
  return num + ' ' + name.join(' ');
}

/**
 * The household this policy's Account represents, if it really is one.
 *
 * The branch has built these deliberately — 14,041 Account records on the
 * HOUSEHOLD record type, named "SURNAME, FIRSTNAME HH" — so this reads what
 * is already there rather than inferring anything. Two guards, both needed:
 * the record type must be HOUSEHOLD (ScotiaBank is a BUSINESS ACCOUNT), and
 * the membership must be plausible.
 *
 * Read only. Nothing here writes to Salesforce, and nothing here goes to the
 * browser — the household reaches the agent's brief and the worklist, never
 * the client. Telling whoever holds an unauthenticated link who else lives at
 * an address would be the worst thing this file could do.
 */
function svcHouseholdFor_(accountId) {
  if (!accountId) return null;
  var soql = 'SELECT Id, Name, RecordType.Name, (SELECT Id FROM Contacts LIMIT ' +
             (SVCSF.HH_MAX + 1) + ') FROM Account WHERE Id = \'' + svcSoqlLit_(accountId) + '\'';
  var rows = svcSfQuery_(soql);
  if (!rows || !rows.length) return null;
  var a = rows[0];
  var type = (a.RecordType && a.RecordType.Name) || '';
  if (type !== 'HOUSEHOLD') return { name: '', members: 0, why: 'not a household account: ' + type };
  var members = (a.Contacts && a.Contacts.totalSize) ||
                (a.Contacts && a.Contacts.records && a.Contacts.records.length) || 0;
  if (members > SVCSF.HH_MAX) return { name: '', members: 0, why: 'implausible household of ' + members };
  return { name: a.Name || '', members: members };
}

function svcSfProps_() { return PropertiesService.getScriptProperties(); }

/** Is the connection set up at all? Used to keep everything else quiet. */
function svcSfReady_() {
  var p = svcSfProps_();
  return !!(p.getProperty('SF_KEY') && p.getProperty('SF_SECRET') &&
            p.getProperty('SF_USER') && p.getProperty('SF_PASS'));
}

/**
 * A SOQL string literal. Backslash first, then the quote — the other order
 * double-escapes and lets a quote back out. This is the only thing standing
 * between a client's typed surname and our query, so it is not optional.
 */
function svcSoqlLit_(s) {
  return String(s == null ? '' : s).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

/** A SOQL date literal, or null if it is not a real date. YYYY-MM-DD, unquoted. */
function svcSoqlDate_(d) {
  if (!d) return null;
  var m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return m[1] + '-' + m[2] + '-' + m[3];
  var t = new Date(d);
  if (isNaN(t.getTime())) return null;
  return Utilities.formatDate(t, 'UTC', 'yyyy-MM-dd');
}

function svcSfToken_() {
  var p = svcSfProps_();
  var cached = p.getProperty('SVC_SF_TOKEN'), when = Number(p.getProperty('SVC_SF_TOKEN_AT') || 0);
  if (cached && (new Date().getTime() - when) < 50 * 60 * 1000) return JSON.parse(cached);

  var res = UrlFetchApp.fetch((p.getProperty('SF_LOGIN_URL') || SVCSF.LOGIN) + '/services/oauth2/token', {
    method: 'post', muteHttpExceptions: true,
    payload: {
      grant_type: 'password',
      client_id: p.getProperty('SF_KEY'), client_secret: p.getProperty('SF_SECRET'),
      username: p.getProperty('SF_USER'), password: p.getProperty('SF_PASS'),
    },
  });
  var body = res.getContentText();
  if (res.getResponseCode() !== 200) {
    var hint = body.indexOf('invalid_grant') > -1
      ? '\n\nUsually: SF_PASS must be the password with the security token stuck on the end, no space.' : '';
    throw new Error('Salesforce login failed: ' + body + hint);
  }
  var tok = JSON.parse(body);
  p.setProperty('SVC_SF_TOKEN', JSON.stringify(tok));
  p.setProperty('SVC_SF_TOKEN_AT', String(new Date().getTime()));
  return tok;
}

function svcSfQuery_(soql) {
  var tok = svcSfToken_();
  var url = tok.instance_url + '/services/data/' + SVCSF.API + '/query?q=' + encodeURIComponent(soql);
  var res = UrlFetchApp.fetch(url, {
    muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + tok.access_token },
  });
  if (res.getResponseCode() === 401) {                 // token died mid-flight
    svcSfProps_().deleteProperty('SVC_SF_TOKEN');
    tok = svcSfToken_();
    res = UrlFetchApp.fetch(tok.instance_url + '/services/data/' + SVCSF.API +
      '/query?q=' + encodeURIComponent(soql), {
      muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + tok.access_token },
    });
  }
  if (res.getResponseCode() !== 200) throw new Error('Salesforce query failed: ' + res.getContentText());
  return JSON.parse(res.getContentText()).records || [];
}

/**
 * The match, in order of how much it proves.
 *
 * Never on a name alone, and never on an email alone. Two signals minimum,
 * and a date of birth has to be one of them: a shared mailbox or a common
 * surname would otherwise hand one client another client's file.
 *
 * The object carries two date-of-birth fields, so both are tried.
 */
function svcMatchQueries_(core) {
  var dob   = svcSoqlDate_(core && core.dob);
  var email = String((core && core.email) || '').trim();
  var first = String((core && core.firstName) || '').trim();
  var last  = String((core && core.lastName) || '').trim();
  if (!dob) return [];                                  // no date of birth, no match

  var sel = 'SELECT ' + SVCSF.FIELDS.join(', ') + ' FROM ' + SVCSF.OBJECT + ' WHERE ';
  var tail = ' LIMIT ' + SVCSF.LIMIT;
  var dobClause = '(Date_Of_Birth__c = ' + dob + ' OR Birthdate__c = ' + dob + ')';
  var out = [];

  if (email) {
    out.push({
      how: 'email and date of birth',
      soql: sel + "Email__c = '" + svcSoqlLit_(email) + "' AND " + dobClause + tail,
    });
  }
  if (first && last) {
    out.push({
      how: 'name and date of birth',
      soql: sel + "FIRST_NAME__c = '" + svcSoqlLit_(first) + "' AND LAST_NAME__c = '" +
            svcSoqlLit_(last) + "' AND " + dobClause + tail,
    });
  }
  if (last && !first) {
    out.push({
      how: 'surname and date of birth',
      soql: sel + "LAST_NAME__c = '" + svcSoqlLit_(last) + "' AND " + dobClause + tail,
    });
  }
  return out;
}

/** Split "Marcia Anne Baptiste" into a first and a last. */
function svcSplitName_(full) {
  var parts = String(full || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return { firstName: '', lastName: '' };
  if (parts.length === 1) return { firstName: '', lastName: parts[0] };
  return { firstName: parts[0], lastName: parts[parts.length - 1] };
}

/**
 * Trace one review. Returns a summary for the branch — never for the client.
 * Any failure is swallowed into { ok:false, why } because a Salesforce outage
 * must never stop a client's review from being filed.
 */
function svcTraceReview_(core) {
  if (!svcSfReady_()) return { ok: false, configured: false, why: 'Salesforce is not set up in this project' };
  try {
    var tries = svcMatchQueries_(core);
    if (!tries.length) return { ok: false, configured: true, why: 'no date of birth to match on' };
    for (var i = 0; i < tries.length; i++) {
      var rows = svcSfQuery_(tries[i].soql);
      if (rows && rows.length) {
        var out = svcSummarise_(rows, tries[i].how);
        /* The household is a second read, and an optional one: if it fails the
           review still files with everything else intact. */
        try {
          var hh = svcHouseholdFor_(rows[0].Account__c);
          if (hh && hh.name) { out.householdName = hh.name; out.householdMembers = hh.members; }
        } catch (e) {}
        return out;
      }
    }
    return { ok: true, configured: true, found: 0, how: 'no record matched' };
  } catch (e) {
    return { ok: false, configured: true, why: String(e && e.message || e).slice(0, 300) };
  }
}

/** Condense the records into the handful of lines a servicing agent needs. */
function svcSummarise_(rows, how) {
  var money = function (n) {
    return (n === null || n === undefined || n === '') ? '' :
      '$' + Number(n).toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
  };
  var policies = [], cover = 0, owing = 0, billing = 0, agents = {};
  rows.forEach(function (r) {
    var num = r.POLICY__c || r.Policy_ID__c || '';
    var plan = r.PLAN_NAME__c || r.Product_Name__c || '';
    if (num || plan) policies.push((num ? num : '(no number)') + (plan ? ' · ' + plan : ''));
    cover   += Number(r.Life_Coverage__c || 0) + Number(r.Critical_Illness_Coverage__c || 0);
    owing   += Number(r.PREMIUM_OWING__c || 0);
    billing += Number(r.BILLING_PREMIUM__c || 0);
    var a = r.Writing_Agent__c || '';
    if (a) agents[a] = (agents[a] || 0) + 1;
  });
  return {
    ok: true, configured: true, found: rows.length, how: how,
    policyNumbers: policies.join('; '),
    coverTraced:   cover ? money(cover) : '',
    premiumOwing:  owing ? money(owing) : '',
    premiumBilled: billing ? money(billing) : '',
    agentOnRecord: Object.keys(agents).join(', '),
    clientId:      (rows[0] && rows[0].Client_ID__c) || '',
    /* Sort a worklist by this and likely neighbours land next to each other.
       A candidate for a person to confirm, never an automatic merge. */
    addressKey:    svcAddrKey_((rows[0] && rows[0].Street__c) || ''),
    householdName: '', householdMembers: 0,   // filled by svcTraceReview_ if the account is a real household
    /* The raw records stay available inside the script for the CS form, but
       nothing here is ever handed to a browser — see svcRedactForClient_. */
    records: rows,
  };
}

/**
 * The boundary. Anything travelling back to the client passes through here.
 * It answers one question — did we find you — and carries no policy detail,
 * no cover, no premium, no agent name, and no Salesforce identifiers.
 */
function svcRedactForClient_(trace) {
  if (!trace || !trace.ok) return { traced: false };
  return { traced: trace.found > 0, count: trace.found > 0 ? 1 : 0 };
}

/**
 * A departed agent's whole book, for building a reassignment list.
 * Branch-side only — call it from the editor or a menu, never from doGet.
 * Returns the fields needed to write to the client and nothing more.
 */
function svcBlockForAgent_(agentName) {
  if (!svcSfReady_()) throw new Error('Salesforce is not set up in this project.');
  var soql = 'SELECT Id, FIRST_NAME__c, LAST_NAME__c, Email__c, Mobile__c, Date_Of_Birth__c, ' +
             'POLICY__c, PLAN_NAME__c, Writing_Agent__c FROM ' + SVCSF.OBJECT +
             " WHERE Writing_Agent__c = '" + svcSoqlLit_(agentName) + "' LIMIT 2000";
  return svcSfQuery_(soql);
}

/** Menu-safe check: proves the connection without printing a single client. */
function svcSalesforceSelfTest() {
  var ui = SpreadsheetApp.getUi();
  if (!svcSfReady_()) {
    ui.alert('Salesforce trace', 'Not set up yet.\n\nAdd SF_KEY, SF_SECRET, SF_USER and SF_PASS in ' +
      'Project Settings → Script Properties. Until then reviews are filed exactly as they are today, ' +
      'with the policy number left for support to trace by hand.', ui.ButtonSet.OK);
    return;
  }
  try {
    var n = svcSfQuery_('SELECT COUNT(Id) c FROM ' + SVCSF.OBJECT);
    var total = (n[0] && (n[0].c !== undefined ? n[0].c : n[0].expr0)) || 0;
    ui.alert('Salesforce trace', 'Connected.\n\n' + SVCSF.OBJECT + ' holds ' + total +
      ' records.\n\nNothing found by a trace is ever sent back to the client — it goes to the ' +
      'worklist, the agent brief and the Customer Service email only.', ui.ButtonSet.OK);
  } catch (e) {
    ui.alert('Salesforce trace', 'Connection failed:\n\n' + (e && e.message || e), ui.ButtonSet.OK);
  }
}

/* Exposed for the Node test harness; ignored by Apps Script. */
if (typeof module !== 'undefined') module.exports = {
  SVCSF: SVCSF, svcSoqlLit_: svcSoqlLit_, svcSplitName_: svcSplitName_,
  svcMatchQueries_: svcMatchQueries_, svcSummarise_: svcSummarise_,
  svcRedactForClient_: svcRedactForClient_,
  svcSoqlDate_: function (d) {                         // Utilities is Apps-Script-only
    if (!d) return null;
    var m = String(d).match(/^(\d{4})-(\d{2})-(\d{2})/);
    if (m) return m[1] + '-' + m[2] + '-' + m[3];
    var t = new Date(d);
    return isNaN(t.getTime()) ? null : t.toISOString().slice(0, 10);
  },
};
