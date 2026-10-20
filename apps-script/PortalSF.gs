/**
 * PortalSF.gs — the renewal portal, reading Salesforce as well as the sheet.
 *
 * WHY THIS FILE EXISTS
 * --------------------
 * The portal resolved a token against ONE place: the Renewals tab of the
 * spreadsheet, via rowsForToken_ -> allRenewals_ -> renewalsSheet_. That tab
 * holds 122 rows. Salesforce holds every renewal on Risk_Details__c, and that
 * is where motor lives — 32 motor policies across 108 risk rows renewing in
 * October and November 2026 alone, TT$453,197 of premium.
 *
 * So a motor client could be sent a renewal email by RenewalsSF.gs, click the
 * link in it, and land on "We couldn't find your policy" — because the ladder
 * reads Salesforce and the portal did not. The email and the page it points at
 * were looking at different books.
 *
 * This adds Salesforce as a FALLBACK, not a replacement. rowsForToken_ still
 * checks the sheet first, so all 122 rows that work today behave exactly as
 * they do now; only a token the sheet has never heard of reaches Salesforce.
 * The sheet can be retired later, once Salesforce has run a clean month.
 *
 * WHAT IT GROUPS, AND WHY THAT MATTERS
 * ------------------------------------
 * Risk_Details__c holds one row per insured THING, not per policy. RPM
 * Technical Services carries about sixty vehicles on one fleet policy
 * (TTACF1362841, renewing 12-14 November). One card per row would hand that
 * client sixty identical renewal cards to work through. So rows are folded by
 * normalised policy number — one card per policy, premiums summed, the earliest
 * renewal date leading, and every vehicle listed on it.
 *
 * This mirrors rsfPlan_ in RenewalsSF.gs, which groups the same way for the
 * same reason. Both use rsfPolKey_ so the two agree on what one policy is.
 *
 * DEPENDENCIES
 * ------------
 * Salesforce auth, query and insert are rsfToken_ / rsfQ_ / rsfCreate_ in
 * RenewalsSF.gs. They are reused rather than duplicated so there is one place
 * where the credentials live. Every call is guarded with typeof, so if this
 * file is ever deployed without RenewalsSF.gs the portal falls back to
 * sheet-only behaviour instead of throwing at a client.
 */

var PSF = {
  // A token is 8 characters of url-safe base64 as minted by TokenMigration.gs.
  // It arrives from a query string on a public endpoint and is interpolated
  // into SOQL, so it is whitelisted rather than escaped — anything carrying a
  // quote, a space or a backslash is not a token we issued and is refused
  // before it can reach a query.
  TOKEN_RE: /^[A-Za-z0-9_-]{4,64}$/,

  // Marker written to Salesforce when a client sends an instruction. It shares
  // RSF.TASK_TAG's prefix so rsfAlreadySent_ parses it back with no extra
  // query, and rsfPlan_ reads it to stop the ladder chasing someone who has
  // already renewed.
  INSTRUCTED: 'instructed',

  MAX_RISKS: 400,   // one client's policies; a fleet is large, not unbounded
};

/* ========================= reading ========================= */

/**
 * Rows for a token, from Salesforce, in the shape rowObj_ returns.
 *
 * Returns [] rather than throwing on every failure path — a client holding a
 * good link must never see a stack trace because an access token expired.
 */
function psfRowsForToken_(token) {
  token = String(token || '').trim();
  if (!token || !PSF.TOKEN_RE.test(token)) return [];
  if (typeof rsfQ_ !== 'function') return [];   // RenewalsSF.gs not deployed

  var risks;
  try {
    risks = rsfQ_(
      'SELECT Id, Policy__c, Next_Renewal_Date__c, Motor_Vehicle_Coverage_Type__c, ' +
      'Property_Coverage_Type__c, Cover1__c, Premium_Due__c, Payments_Made__c, ' +
      'Total_Premiums__c, Windscreen__c, Email__c, Portal_Token__c, Account__c, Contact_First_Name__c, ' +
      'Last_Name__c, Salutation__c, Vehicle_Make__c, Model__c, Vehicle_Status__c ' +
      'FROM Risk_Details__c ' +
      "WHERE Portal_Token__c = '" + token + "' " +
      // A sold vehicle is not renewing. rsfRows_ excludes these too; if the
      // portal showed them the client would be asked to confirm cover on a car
      // they no longer own.
      "AND (Vehicle_Status__c = null OR Vehicle_Status__c != 'Sold') " +
      'ORDER BY Next_Renewal_Date__c LIMIT ' + PSF.MAX_RISKS
    );
  } catch (err) {
    return [];
  }
  if (!risks || !risks.length) return [];

  var byPolicy = {}, order = [];
  risks.forEach(function (r) {
    var key = (typeof rsfPolKey_ === 'function')
      ? rsfPolKey_(r.Policy__c)
      : String(r.Policy__c || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
    // A risk with no policy number cannot be folded with anything safely —
    // give it its own card keyed on the record id rather than merging every
    // unnumbered risk into one bucket.
    if (!key) key = 'ID:' + r.Id;
    if (!byPolicy[key]) { byPolicy[key] = []; order.push(key); }
    byPolicy[key].push(r);
  });

  return order.map(function (key) { return psfGroupRow_(byPolicy[key]); });
}

/** One policy's risks folded into one portal row. */
function psfGroupRow_(rs) {
  var lead = rs[0];

  var premium = 0, paid = 0, due = 0, sumInsured = 0;
  rs.forEach(function (r) {
    premium    += Number(r.Total_Premiums__c) || 0;
    paid       += Number(r.Payments_Made__c)  || 0;
    due        += Number(r.Premium_Due__c)    || 0;
    sumInsured += Number(r.Cover1__c)         || 0;
  });
  // Premium_Due__c is the carrier's own figure where it is populated; where it
  // is not, fall back to what has been billed less what has been paid. Never
  // let it go negative — an overpayment is not a credit the portal should show
  // as a balance, and there are five of those on the books.
  var balance = due || Math.max(0, premium - paid);

  var who = [lead.Salutation__c, lead.Contact_First_Name__c, lead.Last_Name__c]
              .filter(function (x) { return x; }).join(' ').trim();

  var vehicles = rs.map(function (r) {
    return [r.Vehicle_Make__c, r.Model__c].filter(function (x) { return x; }).join(' ');
  }).filter(function (x) { return x; });

  var email = '';
  for (var i = 0; i < rs.length && !email; i++) email = String(rs[i].Email__c || '').trim();

  var iso = lead.Next_Renewal_Date__c || '';

  return {
    // The portal round-trips rowIndex back on submit, and submitInstruction
    // matches on it. A Salesforce id is a string, so it can never collide with
    // a sheet row number and stamp an unrelated client's row.
    rowIndex: lead.Id,
    source: 'sf',
    sfIds: rs.map(function (r) { return r.Id; }),

    client:   lead.Account__c || who || 'Valued client',
    contact:  lead.Contact_First_Name__c || who || '',
    coverage: lead.Motor_Vehicle_Coverage_Type__c || lead.Property_Coverage_Type__c || 'policy',
    nextDue:  iso ? psfFmtDate_(iso) : '',
    nextDueRaw: iso,
    days:     iso ? psfDaysUntil_(iso) : null,
    sumInsured: sumInsured || '',
    premium:  premium,
    paid:     paid,
    balance:  balance,
    payStatus: balance > 0 ? 'Owing' : (paid > 0 ? 'Paid' : ''),
    policy:   lead.Policy__c || '',
    mobile:   '',   // Risk_Details__c carries no phone field; the portal asks
    email:    email,
    renewalStatus: '',
    remindersSent: '',
    renewedDate: '',
    assignedTo: '',
    token: String(lead.Portal_Token__c || '').trim(),

    // Extra, for the schedule block on the card. Harmless to the sheet path.
    vehicles: vehicles,
    riskCount: rs.length,
    // Highest glass limit on the policy. Used only to stop offering a client
    // glass cover they demonstrably already carry.
    windscreen: rs.reduce(function (m, r) {
      return Math.max(m, Number(r.Windscreen__c) || 0); }, 0),
  };
}

function psfFmtDate_(iso) {
  var d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return String(iso);
  var tz = (typeof Session !== 'undefined') ? Session.getScriptTimeZone() : 'America/Port_of_Spain';
  return Utilities.formatDate(d, tz, 'd MMM yyyy');
}

function psfDaysUntil_(iso) {
  var d = new Date(iso + 'T00:00:00');
  if (isNaN(d.getTime())) return null;
  var today = new Date(); today.setHours(0, 0, 0, 0);
  return Math.round((d - today) / 86400000);
}

/* ========================= writing back ========================= */

/**
 * Record a client's instruction against the Salesforce policy.
 *
 * Two jobs. It puts the instruction somewhere a human looking at the record
 * can see it — the sheet path stamps a "Renewal Status" cell, and a Salesforce
 * row has no such cell. And it stops the reminder ladder: rsfPlan_ reads this
 * marker and will not send the remaining stages to a client who has renewed.
 *
 * That second part is the one that matters to the client. Without it, someone
 * who renews 30 days out still receives the 14-day, 7-day and renewal-day
 * emails, each telling them to do a thing they have already done.
 *
 * ONE task per policy, on the lead risk — not one per risk. A sixty-vehicle
 * fleet would otherwise put sixty identical tasks on the record.
 */
function psfStampInstruction_(match, detail) {
  if (typeof rsfCreate_ !== 'function') return;
  var tag = (typeof RSF !== 'undefined' && RSF.TASK_TAG) ? RSF.TASK_TAG : 'Auto-reminder';
  rsfCreate_('Task', {
    Subject: tag + ' [' + PSF.INSTRUCTED + '] ' +
             (match.policy || 'renewal') + ' — ' + String(detail.instruction || '').slice(0, 80),
    WhatId: match.rowIndex,
    Status: 'Completed',
    Priority: 'Normal',
    ActivityDate: (typeof rsfIso_ === 'function') ? rsfIso_(new Date())
                : Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd'),
    Description: psfStampBody_(match, detail),
  });
}

function psfStampBody_(match, d) {
  var L = [];
  L.push('Client renewal instruction received through the portal.');
  L.push('');
  L.push('Instruction:     ' + (d.instruction || ''));
  L.push('Policy:          ' + (match.policy || '(not on file)'));
  L.push('Coverage:        ' + (match.coverage || ''));
  L.push('Renewal due:     ' + (match.nextDue || ''));
  if (match.riskCount > 1) L.push('Risks on policy: ' + match.riskCount);
  if (d.newValue)   L.push('Updated value:   TT$' + Number(d.newValue).toLocaleString('en-US'));
  if (d.waiver)     L.push('Waiver of Excess: REQUESTED — quote and bill the difference');
  if (d.windscreen) L.push('Windscreen:      REQUESTED — quote and bill');
  if (d.wantsComp)  L.push('Upsell:          client wants a COMPREHENSIVE quote');
  if (d.payMethod)  L.push('Payment method:  ' + d.payMethod);
  if (d.payRef)     L.push('Payment ref:     ' + d.payRef);
  if (d.email)      L.push('Client email:    ' + d.email);
  if (d.mobile)     L.push('Client mobile:   ' + d.mobile);
  if (d.notes)      L.push('', 'Client notes:', d.notes);
  L.push('');
  L.push('Emailed to ' + ((typeof CONFIG !== 'undefined' && CONFIG.MAIL_TO) || 'the renewals desk') +
         '. The reminder ladder will not chase this policy again.');
  return L.join('\n');
}

/**
 * Has a client already instructed us on this policy?
 *
 * Reads the same map rsfAlreadySent_ builds, so it costs no extra query.
 */
function psfInstructed_(sentMap, ids) {
  if (!sentMap || !ids || !ids.length) return false;
  for (var i = 0; i < ids.length; i++) {
    var s = sentMap[ids[i]];
    if (s && s[PSF.INSTRUCTED]) return true;
  }
  return false;
}
