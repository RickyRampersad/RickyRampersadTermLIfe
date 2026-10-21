/**
 * MotorValueReview.gs — somebody has to say why a car is insured for the same
 * figure three years running.
 *
 * WHY THIS EXISTS
 * ---------------
 * Measured across the comprehensive motor book, 21 October 2026:
 *
 *   107  vehicles with two or more terms on file
 *    32  carry an UNCHANGED sum insured across 2+ consecutive terms  (30%)
 *    75  moved properly
 *
 *   TT$9,591,493  of sum insured sitting flat
 *   TT$232,082.54 of premium on those 32
 *
 *   1 vehicle flat for 5 terms, 2 for 4, 4 for 3, 25 for 2.
 *
 * The clearest cases are not the expensive ones. A 10-year-old Toyota Aqua
 * insured at TT$64,800 for four terms running, and a 9-year-old Nissan Note at
 * TT$90,000 for four. Neither is worth that, and the policy pays the market
 * value or the sum insured, WHICHEVER IS LESS (GG-MOT-POL-APV-10/09 s2.4.1).
 * So the client pays premium on value that cannot be collected, and finds out
 * at the worst possible moment.
 *
 * The discipline plainly exists — a Porsche Cayenne came down 1,795,000 to
 * 1,525,750, a BMW M3 1,128,000 to 750,000 over six terms. It is just not
 * applied evenly, and nothing in the system has ever asked why.
 *
 * WHAT THIS DOES
 * --------------
 * It does not block the client's reminder: a client should always be told
 * their policy is renewing. It puts the renewal on a staff worklist that
 * stays outstanding until somebody picks a reason and signs it. The reason is
 * written as a Task against the risk, so it carries a name and a date — which
 * is the whole point. "Staff has to account and comment."
 *
 * A reason given last year does not excuse this year. Accountability is only
 * counted when the Task was created after the current term began.
 *
 * NO VALUE IS EVER CHANGED HERE. This module reads, reports and records a
 * reason. Re-rating is Guardian General's to do.
 */

var MVR = {
  // Shares RSF.TASK_TAG's prefix so rsfAlreadySent_ parses it back with no
  // extra query, exactly as the [instructed] marker does in PortalSF.gs.
  MARKER: 'value-reviewed',

  // Two consecutive terms at the same figure is worth a question; one is not.
  MIN_RUN: 2,

  // How far ahead to pull. A reason is wanted before the renewal, not after.
  LOOKAHEAD: 120,

  MAX_RISKS: 600,

  /**
   * Why a flat value can be perfectly correct. The list matters: without
   * legitimate options this becomes a box-tick, and a box-tick teaches staff
   * to click past it. Four of these five are good answers.
   */
  REASONS: {
    valuation:  { label: 'Written valuation on file supports this figure',
                  ok: true,
                  note: 'Agreed Value needs one at every renewal anyway (W OEB 5).' },
    agreed:     { label: 'Agreed Value in force — depreciation is pre-agreed at 15%/yr',
                  ok: true,
                  note: 'The figure is contractual, not an estimate.' },
    declined:   { label: 'Client was asked and chose to keep the figure',
                  ok: true,
                  note: 'Record when they were asked. The advice was given and declined.' },
    appreciating: { label: 'Vehicle is genuinely holding or gaining value',
                  ok: true,
                  note: 'Classic, limited or a market that has moved up. Say which.' },
    notasked:   { label: 'Nobody has reviewed it with the client',
                  ok: false,
                  note: 'An honest answer, and the one that puts it on the call list.' },
    other:      { label: 'Other — explain',
                  ok: null,
                  note: 'A note is required.' },
  },
};

/* ===================== detection ===================== */

/** A plate reduced to something two spellings agree on. */
function mvrVehKey_(v) {
  return String(v || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

/**
 * Comprehensive motor vehicles whose sum insured has not moved.
 *
 * Returns rows with `run` — how many consecutive terms end at the same figure,
 * counted backwards from the most recent. The run is what makes this
 * defensible: a value that fell and then held for two years is a different
 * conversation from one that has never moved at all.
 */
function mvrFlat_() {
  if (typeof rsfQ_ !== 'function') return [];
  var rows;
  try {
    rows = rsfQ_(
      'SELECT Id, Vehicle__c, Policy__c, Account__c, Renewal_Date__c, Next_Renewal_Date__c, ' +
      'Cover1__c, Total_Premiums__c, Motor_Vehicle_Coverage_Type__c, Year_of_Manufacture__c, ' +
      'Vehicle_Make__c, Model__c, Email__c, Portal_Token__c, Vehicle_Status__c ' +
      'FROM Risk_Details__c ' +
      "WHERE (Policy__c LIKE 'TTA%' OR Policy__c LIKE 'TT A%') " +
      'AND Vehicle__c != null AND Cover1__c > 0 ' +
      "AND Motor_Vehicle_Coverage_Type__c LIKE '%Comprehensive%' " +
      "AND (Vehicle_Status__c = null OR Vehicle_Status__c != 'Sold') " +
      'ORDER BY Vehicle__c, Renewal_Date__c LIMIT ' + MVR.MAX_RISKS
    );
  } catch (err) {
    return [];
  }
  if (!rows || !rows.length) return [];

  // One row per vehicle per TERM START. Keyed on Renewal_Date__c for the same
  // reason as mrYears_: two rows can share an end date a year apart, and
  // bucketing on the end date silently merges two terms into one.
  var byVeh = {};
  rows.forEach(function (r) {
    var v = mvrVehKey_(r.Vehicle__c);
    var t = r.Renewal_Date__c || r.Next_Renewal_Date__c;
    if (!v || !t) return;
    var terms = byVeh[v] || (byVeh[v] = {});
    if (!terms[t] || (!terms[t].Cover1__c && r.Cover1__c)) terms[t] = r;
  });

  var out = [];
  Object.keys(byVeh).forEach(function (v) {
    var terms = byVeh[v];
    var keys = Object.keys(terms).sort();
    if (keys.length < 2) return;                      // nothing to compare yet

    var vals = keys.map(function (k) { return Number(terms[k].Cover1__c) || 0; });
    var run = 1;
    for (var i = vals.length - 1; i > 0; i--) {
      if (vals[i] === vals[i - 1]) run++; else break;
    }
    if (run < MVR.MIN_RUN) return;

    var last = terms[keys[keys.length - 1]];
    var yr = Number(last.Year_of_Manufacture__c) || 0;
    out.push({
      riskId: last.Id,
      vehicle: last.Vehicle__c,
      vehicleKey: v,
      make: [last.Vehicle_Make__c, last.Model__c].filter(function (x) { return x; }).join(' '),
      year: yr || null,
      age: yr ? (new Date().getFullYear() - yr) : null,
      policy: last.Policy__c || '',
      account: last.Account__c || '',
      sumInsured: vals[vals.length - 1],
      firstSeen: vals[0],
      premium: Number(last.Total_Premiums__c) || 0,
      run: run,
      terms: keys.length,
      termStart: keys[keys.length - 1],
      nextDue: last.Next_Renewal_Date__c || '',
      email: String(last.Email__c || '').trim(),
      hasToken: !!String(last.Portal_Token__c || '').trim(),
      // What the product's own rate says it should be worth by now. Not a
      // valuation — a reference point to argue against. 15% a year, OEB 5.
      guide: mvrGuide_(vals[vals.length - 1], run),
    });
  });

  // Biggest question first: longest run, then most cover at stake.
  out.sort(function (a, b) { return (b.run - a.run) || (b.sumInsured - a.sumInsured); });
  return out;
}

/**
 * What 15% a year would have made of this figure over the flat run.
 *
 * Deliberately conservative: it depreciates only across the terms we KNOW
 * were flat, not the vehicle's whole life, so it cannot be dismissed as a
 * guess about a car nobody has looked at.
 */
function mvrGuide_(current, run) {
  var v = Number(current) || 0;
  if (!v || !run) return null;
  var years = Math.max(0, run - 1);
  var est = v * Math.pow(0.85, years);
  return {
    years: years,
    rate: '15% a year (W OEB 5)',
    estimate: Math.round(est / 1000) * 1000,
    overstated: Math.max(0, Math.round((v - est) / 1000) * 1000),
  };
}

/* ===================== who has accounted for what ===================== */

/**
 * Reasons already recorded, by risk id, for the CURRENT term only.
 *
 * A reason given against last year's term does not carry forward. The whole
 * point is that somebody looks at it again this year.
 */
function mvrReasons_(riskIds) {
  var out = {};
  if (!riskIds || !riskIds.length || typeof rsfQ_ !== 'function') return out;
  var tag = (typeof RSF !== 'undefined' && RSF.TASK_TAG) ? RSF.TASK_TAG : 'Auto-reminder';
  var safe = riskIds.filter(function (x) { return /^[a-zA-Z0-9]{15,18}$/.test(x); }).slice(0, 120);
  if (!safe.length) return out;

  var rows;
  try {
    rows = rsfQ_(
      'SELECT WhatId, Subject, Description, CreatedDate, Owner.Name FROM Task ' +
      "WHERE Subject LIKE '" + tag + " [" + MVR.MARKER + "]%' " +
      "AND WhatId IN ('" + safe.join("','") + "') " +
      'ORDER BY CreatedDate DESC'
    );
  } catch (err) {
    return out;
  }
  (rows || []).forEach(function (t) {
    var k = t.WhatId;
    if (!k || out[k]) return;                 // newest wins
    out[k] = {
      when: String(t.CreatedDate || '').slice(0, 10),
      by: (t.Owner && t.Owner.Name) || '',
      subject: t.Subject || '',
      detail: t.Description || '',
    };
  });
  return out;
}

/* ===================== the worklist ===================== */

/**
 * What staff see. Reads only — writes nothing, sends nothing.
 *
 * Splits into what still needs a reason and what has one, because the first
 * list is a job and the second is an audit trail.
 */
function mvrWorklist() {
  var flat = mvrFlat_();
  if (!flat.length) {
    var none = 'MOTOR VALUE REVIEW\n\nNo comprehensive vehicle is carrying an unchanged ' +
               'sum insured across two or more terms. Nothing to account for.';
    Logger.log(none);
    try { SpreadsheetApp.getUi().alert(none); } catch (e) {}
    return none;
  }

  var reasons = mvrReasons_(flat.map(function (f) { return f.riskId; }));
  var open = [], done = [];
  flat.forEach(function (f) {
    var r = reasons[f.riskId];
    // Only a reason recorded since this term began counts.
    if (r && (!f.termStart || r.when >= f.termStart)) { f.reason = r; done.push(f); }
    else { f.staleReason = r || null; open.push(f); }
  });

  var money = function (n) {
    return 'TT$' + (Number(n) || 0).toLocaleString('en-US', { maximumFractionDigits: 0 });
  };
  var L = ['MOTOR VALUE REVIEW — ' + new Date().toDateString(), ''];
  L.push('Comprehensive vehicles carrying an unchanged sum insured for ' +
         MVR.MIN_RUN + '+ terms: ' + flat.length);
  L.push('  Sum insured sitting flat: ' + money(flat.reduce(function (a, f) { return a + f.sumInsured; }, 0)));
  L.push('  Premium on those policies: ' + money(flat.reduce(function (a, f) { return a + f.premium; }, 0)));
  L.push('');
  L.push('A claim pays the market value or the sum insured, whichever is LESS');
  L.push('(GG-MOT-POL-APV-10/09 s2.4.1). A figure left too high is premium the');
  L.push('client can never collect on.');
  L.push('');
  L.push('=== NEEDS A REASON (' + open.length + ') ===');
  if (!open.length) L.push('  Nothing outstanding. Every flat value has been accounted for this term.');
  open.forEach(function (f) {
    L.push('');
    L.push('  ' + f.vehicle + '  ' + (f.make || '(make not recorded)') +
           (f.age !== null ? '  ' + f.age + ' yrs old' : ''));
    L.push('     ' + f.account);
    L.push('     Insured ' + money(f.sumInsured) + ' — unchanged ' + f.run +
           ' terms running. Premium ' + money(f.premium) + '.');
    if (f.guide && f.guide.overstated > 0) {
      L.push('     At 15% a year that is nearer ' + money(f.guide.estimate) +
             ' — about ' + money(f.guide.overstated) + ' of cover that cannot pay out.');
    }
    L.push('     Renews ' + (f.nextDue || '?') + (f.hasToken ? '' : '   [no portal token]'));
    if (f.staleReason) {
      L.push('     Last accounted for ' + f.staleReason.when + ' by ' + f.staleReason.by +
             ' — before this term, so it needs looking at again.');
    }
    L.push('     mvrRecordReason(\'' + f.riskId + '\', \'<reason>\', \'<note>\')');
  });

  L.push('');
  L.push('=== ACCOUNTED FOR THIS TERM (' + done.length + ') ===');
  done.forEach(function (f) {
    L.push('  ' + f.vehicle + '  ' + money(f.sumInsured) + '  — ' +
           f.reason.by + ', ' + f.reason.when);
  });

  L.push('');
  L.push('Reason codes for mvrRecordReason:');
  Object.keys(MVR.REASONS).forEach(function (k) {
    var r = MVR.REASONS[k];
    L.push('  ' + k + (r.ok === false ? '  (flags it for a call)' : r.ok === null ? '  (note required)' : '') +
           '\n      ' + r.label);
  });

  var out = L.join('\n');
  Logger.log(out);
  try { SpreadsheetApp.getUi().alert(out.slice(0, 1400) + '\n\n(full list in the execution log)'); } catch (e) {}
  return out;
}

/* ===================== recording a reason ===================== */

/**
 * Sign off one flat value, with a name against it.
 *
 * The Task is the audit trail: Salesforce stamps who created it and when, and
 * that is exactly what was missing. Nothing about the policy is changed.
 */
function mvrRecordReason(riskId, reasonKey, note) {
  riskId = String(riskId || '').trim();
  reasonKey = String(reasonKey || '').trim();
  note = String(note || '').trim();

  if (!/^[a-zA-Z0-9]{15,18}$/.test(riskId)) return 'Not a risk id: ' + riskId;
  var reason = MVR.REASONS[reasonKey];
  if (!reason) {
    return 'Unknown reason "' + reasonKey + '". Use one of: ' +
           Object.keys(MVR.REASONS).join(', ');
  }
  // 'other' without an explanation is the box-tick this is meant to prevent.
  if (reason.ok === null && note.length < 10) {
    return 'Reason "other" needs a note of at least 10 characters saying why.';
  }
  if (typeof rsfQ_ !== 'function' || typeof rsfCreate_ !== 'function') {
    return 'Salesforce is not reachable from here.';
  }

  var risk;
  try {
    risk = rsfQ_('SELECT Id, Vehicle__c, Policy__c, Account__c, Cover1__c, Renewal_Date__c ' +
                 "FROM Risk_Details__c WHERE Id = '" + riskId + "' LIMIT 1");
  } catch (err) { return 'Could not read that risk: ' + err.message; }
  if (!risk || !risk.length) return 'No risk with id ' + riskId;
  var r = risk[0];

  var tag = (typeof RSF !== 'undefined' && RSF.TASK_TAG) ? RSF.TASK_TAG : 'Auto-reminder';
  var tm = (typeof testMode_ === 'function') && testMode_();

  var body = [];
  if (tm) body.push('*** TEST MODE — rehearsal, safe to delete. ***', '');
  body.push('SUM INSURED REVIEW — why this vehicle stays at the same figure.', '');
  body.push('Vehicle:      ' + (r.Vehicle__c || '(none)'));
  body.push('Policy:       ' + (r.Policy__c || '(none)'));
  body.push('Account:      ' + (r.Account__c || '(none)'));
  body.push('Sum insured:  TT$' + (Number(r.Cover1__c) || 0).toLocaleString('en-US'));
  body.push('Term began:   ' + (r.Renewal_Date__c || '(not recorded)'));
  body.push('');
  body.push('REASON: ' + reason.label);
  if (note) body.push('', 'Note: ' + note);
  if (reason.ok === false) {
    body.push('', 'This reason flags the policy for a call — the value has not been ' +
                  'reviewed with the client, so the advice has not yet been given.');
  }
  body.push('');
  body.push('A claim pays the market value or the sum insured, whichever is less');
  body.push('(GG-MOT-POL-APV-10/09 s2.4.1). Recorded through the motor value review.');

  try {
    rsfCreate_('Task', {
      Subject: (tm ? '[TEST] ' : '') + tag + ' [' + MVR.MARKER + '] ' +
               (r.Vehicle__c || 'vehicle') + ' — ' + reasonKey,
      WhatId: r.Id,
      Status: (reason.ok === false) ? 'Not Started' : 'Completed',
      Priority: (reason.ok === false) ? 'High' : 'Normal',
      ActivityDate: (typeof rsfIso_ === 'function') ? rsfIso_(new Date())
                  : Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd'),
      Description: body.join('\n'),
    });
  } catch (err) {
    return 'Could not record it: ' + err.message;
  }

  return 'Recorded against ' + (r.Vehicle__c || riskId) + ': ' + reason.label +
         (reason.ok === false ? '  (left open for a call)' : '') +
         (tm ? '\n(test mode — the task is marked [TEST])' : '');
}

/**
 * Has this vehicle's flat value been accounted for this term?
 *
 * Reads the map rsfAlreadySent_ already builds, so it costs no extra query —
 * the same trick psfInstructed_ uses.
 */
function mvrReviewed_(sentMap, ids) {
  if (!sentMap || !ids || !ids.length) return false;
  for (var i = 0; i < ids.length; i++) {
    var s = sentMap[ids[i]];
    if (s && s[MVR.MARKER]) return true;
  }
  return false;
}
