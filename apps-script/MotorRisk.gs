/**
 * MotorRisk.gs — "type your registration number and we'll pull up your vehicle".
 *
 * WHAT THIS IS FOR
 * ----------------
 * A client in the renewal portal types the registration number of a vehicle on
 * their policy. We find every record we hold for that plate, show them what we
 * have, tell them what is missing or stale, and take their corrections.
 *
 * It works because the registration number is one of the few motor fields that
 * is actually populated. Across the 230 motor risks renewing in the twelve
 * months from October 2026:
 *
 *   Vehicle__c  (registration)      225 / 230   98%   <- the lookup key
 *   Year_of_Manufacture__c          211 / 230   92%
 *   Chassis__c                      177 / 230   77%
 *   Engine__c                       167 / 230   73%
 *   Cover1__c   (sum insured)        77 / 230   33%
 *   CC__c       (engine capacity)    73 / 230   32%
 *   Drivers_Permit__c                69 / 230   30%
 *   Drivers_Permit_Expiry__c         62 / 230   27%
 *   NCD__c      (no claim discount)   1 / 230    0%
 *   Deductible__c (excess)            0 / 230    0%
 *
 * So the plate gets us in, and almost everything else is worth asking about.
 *
 * THE PERMIT DATES WE HOLD ARE WORSE THAN MISSING
 * ----------------------------------------------
 * Of the 62 records carrying a permit expiry, the dates are stale AND copied:
 * 2013-04-12 sits on fourteen Russell Rampersad Hardware vehicles,
 * 2015-11-19 on four at Solo's Auto Garage, 2016-06-28 on two at Duke's
 * Jewellry. One permit date has been pasted across every vehicle on an
 * account, and the newest of them expired years ago.
 *
 * So this file NEVER tells a client their permit has expired. We do not know
 * that. It says we do not hold a current permit and asks them to confirm it.
 * Telling a client a fact about themselves that is ten years out of date is
 * worse than asking.
 *
 * TWO RULES THAT ARE NOT NEGOTIABLE
 * ---------------------------------
 * 1. EVERY LOOKUP IS SCOPED TO THE CALLER'S OWN TOKEN. There is no bare
 *    "find me plate X" path. Without that scoping, anyone with the portal URL
 *    could type plates until they found a stranger's vehicle, make, model,
 *    chassis, driver's permit number and home address. The token is the
 *    authorisation; the plate only narrows down what the token can already see.
 *
 * 2. A CLIENT'S TYPING DOES NOT OVERWRITE THE CARRIER'S RECORD. Where a field
 *    is EMPTY we fill it, because the client knows their own chassis number
 *    better than we do. Where a field already holds a value we do not touch
 *    it — the change goes to Guardian General as a proposed amendment, the
 *    same way the rest of the portal works. A typo in a web form must not
 *    silently become the policy record.
 */

var MR = {
  // Fields a client may fill in when ours is empty. Order is display order.
  // maxLen comes from the Salesforce field definition — Model__c really is
  // only ten characters, and CC__c six, so both must be truncated rather than
  // rejected by the API after the client has already pressed save.
  FILLABLE: [
    { f: 'Chassis__c',               label: 'Chassis number',       type: 'text', maxLen: 50 },
    { f: 'Engine__c',                label: 'Engine number',        type: 'text', maxLen: 30 },
    { f: 'CC__c',                    label: 'Engine size (cc)',     type: 'text', maxLen: 6  },
    { f: 'Drivers_Permit__c',        label: "Driver's permit number", type: 'text', maxLen: 1300 },
    { f: 'Drivers_Permit_Expiry__c', label: "Driver's permit expiry", type: 'date' },
    { f: 'Year_of_Manufacture__c',   label: 'Year of manufacture',  type: 'year' },
    { f: 'Vehicle_Make__c',          label: 'Make',                 type: 'text', maxLen: 255 },
    { f: 'Model__c',                 label: 'Model',                type: 'text', maxLen: 10 },
  ],

  // Anything here is a PROPOSAL, never a direct write — it changes cover or
  // price, which is the carrier's call and not a web form's.
  PROPOSE_ONLY: ['Cover1__c', 'Motor_Vehicle_Coverage_Type__c', 'Windscreen__c'],

  TASK_TAG: 'Auto-reminder',      // shared with RenewalsSF.gs / PortalSF.gs
  MAX_RISKS: 400,
};

/* ===================== registration numbers ===================== */

/**
 * A plate reduced to something two spellings of it agree on.
 *
 * The same plate is written "TBC 1313", "PDJ-3899" and "PCY2903" across live
 * records — space, hyphen, neither. A client typing "TBC1313" must find
 * "TBC 1313" or the feature is useless on the first try.
 *
 * Deliberately NOT folding 0/O or 1/I. It is tempting, because plates get
 * mistyped that way, but a wrong fold returns a DIFFERENT CLIENT'S VEHICLE.
 * A lookup that politely fails is recoverable; one that confidently shows
 * someone else's chassis number is not.
 */
function mrNormReg_(reg) {
  return String(reg || '').replace(/[^A-Za-z0-9]/g, '').toUpperCase();
}

/* ===================== the lookup ===================== */

/**
 * Every record we hold for one plate, for the client holding this token.
 *
 * Returns { ok, reg, current, history[], insights[], missing[], onPolicy[] }.
 * `current` is the newest record — "what we have on file"; `history` is the
 * same plate across previous renewals, which is what makes the sum-insured
 * trend meaningful.
 */
function mrLookupVehicle(token, reg) {
  token = String(token || '').trim();
  var want = mrNormReg_(reg);

  if (!token) return { ok: false, why: 'no-token' };
  if (typeof PSF !== 'undefined' && !PSF.TOKEN_RE.test(token)) return { ok: false, why: 'no-token' };
  if (want.length < 3) return { ok: false, why: 'short-reg' };
  if (typeof rsfQ_ !== 'function') return { ok: false, why: 'offline' };

  var rows;
  try {
    rows = rsfQ_(
      'SELECT Id, Vehicle__c, Vehicle_Make__c, Model__c, Year_of_Manufacture__c, ' +
      'Age_of_Vehicle__c, Chassis__c, Engine__c, CC__c, Drivers_Permit__c, ' +
      'Drivers_Permit_Expiry__c, Drivers_Permit_Issue_Date__c, Occupation__c, ' +
      'Motor_Vehicle_Coverage_Type__c, Cover1__c, CY_Cover__c, Total_Premiums__c, ' +
      'Renewal_PremiUM_cy__c, NCD__c, Deductible__c, Windscreen__c, Waiver_of_Excess__c, ' +
      'Policy__c, Next_Renewal_Date__c, Renewal_Date__c, Vehicle_Status__c, ' +
      'TRANSACTIONS__c, Payments_Made__c, Premium_Due__c, ' +
      'Account__c, Email__c, Portal_Token__c ' +
      'FROM Risk_Details__c ' +
      // The token is the authorisation. The plate only filters what this token
      // may already see — it is never a lookup key on its own.
      "WHERE Portal_Token__c = '" + token + "' " +
      'AND Vehicle__c != null ' +
      'ORDER BY Next_Renewal_Date__c DESC NULLS LAST LIMIT ' + MR.MAX_RISKS
    );
  } catch (err) {
    return { ok: false, why: 'offline' };
  }
  if (!rows || !rows.length) return { ok: false, why: 'no-vehicles' };

  // Belt and braces on both of the query's guarantees, because the cost of
  // either one silently changing is high and the check is free.
  //
  // The token filter is re-asserted here so that editing the SOQL, or putting
  // any cache in front of it, cannot turn this into a bare plate lookup that
  // hands a stranger's chassis number and driver's permit to whoever typed
  // the plate. Authorisation should not rest on one WHERE clause.
  //
  // The sort is redone here so `current` cannot silently become an old record
  // if the ORDER BY is ever dropped — showing a client last year's cover as
  // today's is the kind of error nobody catches until it is in a complaint.
  var mine = rows.filter(function (r) {
    return String(r.Portal_Token__c || '').trim() === token &&
           mrNormReg_(r.Vehicle__c) === want;
  }).sort(function (a, b) {
    return String(b.Next_Renewal_Date__c || '').localeCompare(String(a.Next_Renewal_Date__c || ''));
  });

  if (!mine.length) {
    // Help rather than stonewall: offer the plates this token does cover.
    var seen = {}, list = [];
    rows.forEach(function (r) {
      if (String(r.Portal_Token__c || '').trim() !== token) return;
      var k = mrNormReg_(r.Vehicle__c);
      if (k && !seen[k]) { seen[k] = 1; list.push(r.Vehicle__c); }
    });
    return { ok: false, why: 'not-on-policy', onPolicy: list.slice(0, 25) };
  }

  var current = mine[0];
  var history = mrHistory_(mine);

  // `rows` is every risk this token covers, which lets mrYears_ work out how
  // many vehicles share a transaction without a second query — a payment sits
  // on the transaction, so on a fleet policy it covers all of them at once.
  var years = mrYears_(mine, rows);

  return {
    ok: true,
    reg: current.Vehicle__c,
    riskId: current.Id,
    current: mrView_(current),
    history: history,
    years: years,
    missing: mrMissing_(current),
    insights: mrInsights_(current, history, years),
    records: mine.length,
  };
}

/* ===================== last year, and what was paid ===================== */

/**
 * One row per TERM for this vehicle: what it was insured for, what it cost,
 * and what actually reached us.
 *
 * KEYED ON Renewal_Date__c, NOT Next_Renewal_Date__c. Renewal_Date__c is the
 * term's START; Next_Renewal_Date__c is its END. Keying on the end date puts
 * two terms in one bucket — TDY459 carries two rows both ending 2024-11-29,
 * written a year apart — and silently drops one of them from the history.
 *
 * WHAT WAS PAID IS A POLICY FIGURE, NEVER A VEHICLE ONE. Payments__c hangs off
 * TRANSACTIONS__c, and one transaction can cover a whole fleet. So each row
 * says how many vehicles the payment covered, and `paidIsPolicyWide` is set
 * when that is more than one. Showing a fleet's payment beside one van as if
 * it were that van's would overstate what the client paid for it several times
 * over.
 *
 * Premium_Billed__c REPEATS THE WHOLE INVOICE ON EVERY INSTALMENT ROW. The
 * 2019 term on TDY459 has two payment rows, each carrying 8,635.94 as the
 * billed figure. So billed takes max() and paid takes sum(); adding the billed
 * column up would double the policy.
 */
function mrYears_(mine, allRows) {
  // How many of this client's risks sit on each transaction.
  var share = {};
  (allRows || mine).forEach(function (r) {
    var t = r.TRANSACTIONS__c;
    if (t) share[t] = (share[t] || 0) + 1;
  });

  // One bucket per term start, newest first. Where two rows share a term, the
  // one carrying a sum insured wins — a blank Cover1__c is a thinner record,
  // not a different term.
  var byTerm = {}, order = [];
  mine.forEach(function (r) {
    var term = r.Renewal_Date__c || r.Next_Renewal_Date__c || '';
    if (!term) return;
    if (!byTerm[term]) { byTerm[term] = r; order.push(term); }
    else if (!byTerm[term].Cover1__c && r.Cover1__c) byTerm[term] = r;
  });
  order.sort().reverse();

  var txIds = [];
  order.forEach(function (t) {
    var id = byTerm[t].TRANSACTIONS__c;
    if (id && txIds.indexOf(id) < 0) txIds.push(id);
  });

  var pay = mrPayments_(txIds);

  return order.map(function (term) {
    var r = byTerm[term];
    var tx = r.TRANSACTIONS__c;
    var p = (tx && pay[tx]) || null;
    var covers = (tx && share[tx]) || 1;

    var status;
    if (!p)                                   status = 'not-recorded';
    else if (p.paid <= 0)                     status = 'not-recorded';
    else if (p.billed && p.paid >= p.billed - 1) status = 'paid-full';
    else if (!p.billed)                       status = 'paid-some';
    else                                      status = 'part-paid';

    return {
      term: term,
      year: String(term).slice(0, 4),
      sumInsured: r.Cover1__c || r.CY_Cover__c || 0,
      premium: r.Total_Premiums__c || r.Renewal_PremiUM_cy__c || 0,
      policyBilled: p ? p.billed : 0,
      policyPaid: p ? p.paid : 0,
      policyOwing: p ? Math.max(0, (p.billed || 0) - p.paid) : 0,
      paidStatus: status,
      paidOn: p ? p.first : '',
      lastPaidOn: p ? p.last : '',
      instalments: p ? p.n : 0,
      how: p ? p.how.join(', ') : '',
      where: p ? p.where.join(', ') : '',
      paidIsPolicyWide: covers > 1,
      vehiclesOnPolicy: covers,
      coverage: r.Motor_Vehicle_Coverage_Type__c || '',
    };
  });
}

/** Payments folded per transaction. Empty object if we cannot reach them. */
function mrPayments_(txIds) {
  var out = {};
  if (!txIds || !txIds.length || typeof rsfQ_ !== 'function') return out;

  var safe = txIds.filter(function (x) { return /^[a-zA-Z0-9]{15,18}$/.test(x); })
                  .slice(0, 60);
  if (!safe.length) return out;

  var rows;
  try {
    rows = rsfQ_(
      'SELECT PMTS__c, Premium_Billed__c, Payment_Made__c, Date_Paid__c, ' +
      'Payment_Type__c, Payment_Location__c, Bank__c, Receipt__c ' +
      "FROM Payments__c WHERE PMTS__c IN ('" + safe.join("','") + "') " +
      'ORDER BY Date_Paid__c'
    );
  } catch (err) {
    return out;   // no payment history is a gap in the page, not an error
  }

  (rows || []).forEach(function (p) {
    var k = p.PMTS__c;
    if (!k) return;
    var d = out[k] || (out[k] = { billed: 0, paid: 0, n: 0, first: '', last: '',
                                  how: [], where: [] });
    // max, not sum — the billed figure is the whole invoice on every row
    d.billed = Math.max(d.billed, Number(p.Premium_Billed__c) || 0);
    d.paid  += Number(p.Payment_Made__c) || 0;
    d.n     += 1;
    if (p.Date_Paid__c) {
      if (!d.first || p.Date_Paid__c < d.first) d.first = p.Date_Paid__c;
      if (!d.last  || p.Date_Paid__c > d.last)  d.last  = p.Date_Paid__c;
    }
    if (p.Payment_Type__c && d.how.indexOf(p.Payment_Type__c) < 0) d.how.push(p.Payment_Type__c);
    var w = p.Payment_Location__c || p.Bank__c;
    if (w && d.where.indexOf(w) < 0) d.where.push(w);
  });
  return out;
}

/** The newest record, shaped for the page. */
function mrView_(r) {
  return {
    reg: r.Vehicle__c || '',
    make: r.Vehicle_Make__c || '',
    model: r.Model__c || '',
    year: r.Year_of_Manufacture__c || null,
    age: (r.Age_of_Vehicle__c != null) ? r.Age_of_Vehicle__c
       : (r.Year_of_Manufacture__c ? (new Date().getFullYear() - r.Year_of_Manufacture__c) : null),
    chassis: r.Chassis__c || '',
    engine: r.Engine__c || '',
    cc: r.CC__c || '',
    permit: r.Drivers_Permit__c || '',
    permitExpiry: r.Drivers_Permit_Expiry__c || '',
    coverage: r.Motor_Vehicle_Coverage_Type__c || '',
    comp: /comprehensive/i.test(r.Motor_Vehicle_Coverage_Type__c || ''),
    sumInsured: r.Cover1__c || r.CY_Cover__c || 0,
    premium: r.Total_Premiums__c || r.Renewal_PremiUM_cy__c || 0,
    policy: r.Policy__c || '',
    nextDue: r.Next_Renewal_Date__c || '',
    status: r.Vehicle_Status__c || '',
  };
}

/**
 * The same plate across renewals, oldest first, for the trend.
 *
 * Keyed on Renewal_Date__c — the term's START — and de-duplicated, for the
 * reason set out on mrYears_: TDY459 carries two rows both ending 2024-11-29,
 * written a year apart. Sorting on the END date buckets two terms together and
 * drops one, which then feeds a wrong answer into the flat-value and
 * premium-trend insights.
 */
function mrHistory_(mine) {
  var byTerm = {}, order = [];
  mine.forEach(function (r) {
    var term = r.Renewal_Date__c || r.Next_Renewal_Date__c || '';
    if (!term) return;
    if (!byTerm[term]) { byTerm[term] = r; order.push(term); }
    else if (!byTerm[term].Cover1__c && r.Cover1__c) byTerm[term] = r;
  });
  return order.sort().map(function (term) {
    var r = byTerm[term];
    return {
      when: term,
      year: String(term).slice(0, 4),
      sumInsured: r.Cover1__c || r.CY_Cover__c || 0,
      premium: r.Total_Premiums__c || r.Renewal_PremiUM_cy__c || 0,
      coverage: r.Motor_Vehicle_Coverage_Type__c || '',
    };
  });
}

/** Which fillable fields we are missing on the newest record. */
function mrMissing_(r) {
  return MR.FILLABLE.filter(function (d) {
    var v = r[d.f];
    return v === null || v === undefined || String(v).trim() === '';
  }).map(function (d) {
    return { field: d.f, label: d.label, type: d.type, maxLen: d.maxLen || null };
  });
}

/* ===================== the insights ===================== */

/**
 * What to tell the client, in the order it matters to them.
 *
 * Each insight is { kind, tone, title, body, asks }. `tone` drives the colour;
 * `asks` names the field the page should scroll them to, so an insight is
 * never a dead end — it always points at the thing that resolves it.
 */
function mrInsights_(r, history, years) {
  var out = [];
  var now = new Date(); now.setHours(0, 0, 0, 0);
  var yr = now.getFullYear();

  /* ---- last year's money, where we can evidence it ---- */

  if (years && years.length >= 2) {
    // years[0] is the term being renewed; years[1] is the one just finishing.
    var last = years[1];
    var pol = last.paidIsPolicyWide
      ? ' across the ' + last.vehiclesOnPolicy + ' vehicles on the policy'
      : '';
    if (last.paidStatus === 'paid-full') {
      out.push({
        kind: 'paid', tone: 'good', asks: null,
        title: 'Last year you paid ' + mrMoney2_(last.policyPaid) + ' in full',
        body: 'Settled ' + mrNiceDate_(last.lastPaidOn || last.paidOn) +
              (last.how ? ' by ' + last.how.toLowerCase() : '') + pol +
              (last.instalments > 1 ? ', over ' + last.instalments + ' payments' : '') +
              '. Thank you — nothing is outstanding on that term.',
      });
    } else if (last.paidStatus === 'part-paid') {
      out.push({
        kind: 'paid', tone: 'warn', asks: null,
        title: mrMoney2_(last.policyOwing) + ' still shows as outstanding on last year',
        body: mrMoney2_(last.policyPaid) + ' of ' + mrMoney2_(last.policyBilled) +
              ' reached us' + pol + ', last on ' + mrNiceDate_(last.lastPaidOn) +
              '. If you have settled it since, say so below and we will chase the ' +
              'receipt rather than you.',
      });
    } else if (last.paidStatus === 'not-recorded') {
      // Our payment records are thin, not the client's conduct. Of the seven
      // terms on TDY459 only five carry a payment row, and the two most recent
      // carry none. So this is never phrased as "you did not pay".
      out.push({
        kind: 'paid', tone: 'info', asks: null,
        title: 'We cannot see last year’s payment on our side',
        body: 'Your cover ran, so it was almost certainly settled — our payment ' +
              'records simply do not go back reliably. Nothing for you to do; we ' +
              'are mentioning it so the figures below make sense.',
      });
    }
  }

  /* ---- the certificate blockers, first, because they stop a renewal ---- */

  if (!String(r.Chassis__c || '').trim()) {
    out.push({
      kind: 'chassis', tone: 'warn', asks: 'Chassis__c',
      title: 'We do not have your chassis number',
      body: 'It is stamped on your certificate of insurance, and we cannot issue ' +
            'the new one without it. It is on your old certificate, on the vehicle ' +
            'registration, and usually on a plate inside the driver\'s door frame.',
    });
  }

  /* ---- the permit. Never assert an expiry we do not trust. ---- */

  var pExp = String(r.Drivers_Permit_Expiry__c || '').trim();
  var pNum = String(r.Drivers_Permit__c || '').trim();

  if (!pNum && !pExp) {
    out.push({
      kind: 'permit', tone: 'warn', asks: 'Drivers_Permit__c',
      title: "We do not have your driver's permit on file",
      body: 'Adding it now means we are not chasing you for it at claim time, ' +
            'when it matters most.',
    });
  } else if (pExp) {
    var d = new Date(pExp + 'T00:00:00');
    var days = isNaN(d.getTime()) ? null : Math.round((d - now) / 86400000);
    if (days === null) {
      out.push({
        kind: 'permit', tone: 'warn', asks: 'Drivers_Permit_Expiry__c',
        title: "Please confirm your driver's permit expiry",
        body: 'The date we hold is not readable. One moment to set it right.',
      });
    } else if (days < 0) {
      // The date is in the past — and ours are a decade old and copied across
      // an account's whole fleet, so we ASK. We do not announce.
      out.push({
        kind: 'permit', tone: 'warn', asks: 'Drivers_Permit_Expiry__c',
        title: "Is your driver's permit still current?",
        body: 'The expiry we hold is ' + mrNiceDate_(pExp) + ', which has passed — ' +
              'our records on this have not been kept up, so it is very likely out ' +
              'of date rather than your permit. Put the current expiry in and we ' +
              'will correct it.',
      });
    } else if (days <= 90) {
      out.push({
        kind: 'permit', tone: 'info', asks: 'Drivers_Permit_Expiry__c',
        title: "Your driver's permit expires in " + days + ' day' + (days === 1 ? '' : 's'),
        body: 'On ' + mrNiceDate_(pExp) + '. Worth renewing it alongside the policy ' +
              'so the two do not drift apart.',
      });
    }
  }

  /* ---- the sum insured: the one with real money in it ---- */

  if (/comprehensive/i.test(r.Motor_Vehicle_Coverage_Type__c || '')) {
    var cur = Number(r.Cover1__c || r.CY_Cover__c || 0);
    var vals = history.map(function (h) { return Number(h.sumInsured) || 0; })
                      .filter(function (v) { return v > 0; });
    var distinct = {};
    vals.forEach(function (v) { distinct[v] = 1; });

    if (!cur) {
      out.push({
        kind: 'value', tone: 'warn', asks: 'Cover1__c',
        title: 'We do not hold a sum insured for this vehicle',
        body: 'On a comprehensive policy that figure is the most you can be paid ' +
              'if the vehicle is written off, so it is worth getting right. Tell us ' +
              'what you believe it is worth today.',
      });
    } else if (vals.length >= 2 && Object.keys(distinct).length === 1) {
      out.push({
        kind: 'value', tone: 'warn', asks: 'Cover1__c',
        title: 'Insured for the same figure ' + vals.length + ' years running',
        body: 'Still ' + mrMoney_(cur) + '. A vehicle is worth less every year, and ' +
              'you cannot be paid more than it is worth — so holding the figure ' +
              'steady usually means paying premium on value that has already gone.',
      });
    } else if (r.Year_of_Manufacture__c) {
      var age = yr - Number(r.Year_of_Manufacture__c);
      if (age >= 1 && cur) {
        // 15% a year is the product's OWN figure, not an invented one: it is
        // the pre-agreed depreciation under Agreed Value (OEB 5 of
        // GG-MOT-POL-APV-10/09). The range brackets it so the client has room
        // either side; their own figure always wins. A banded guide at 80-92%
        // was here before and had no basis in the policy at all.
        var lo = Math.round(cur * 0.80 / 1000) * 1000;   // ~20% off
        var hi = Math.round(cur * 0.90 / 1000) * 1000;   // ~10% off, 15% mid
        out.push({
          kind: 'value', tone: 'info', asks: 'Cover1__c',
          title: 'A year on, ' + mrMoney_(lo) + ' – ' + mrMoney_(hi) + ' is the usual range',
          body: 'You are insured for ' + mrMoney_(cur) + ' now. Your ' +
                (age + 1) + '-year-old ' + (r.Vehicle_Make__c || 'vehicle') +
                ' has depreciated since — Guardian\u2019s own pre-agreed rate is 15% a year. ' +
                'The figure you give us is the one we use, and on a claim you are paid the ' +
                'market value or the sum insured, whichever is lower.',
        });
      }
    }
  } else if (r.Motor_Vehicle_Coverage_Type__c) {
    out.push({
      kind: 'upgrade', tone: 'info', asks: null,
      title: 'You are on ' + r.Motor_Vehicle_Coverage_Type__c.toLowerCase(),
      body: 'Third party covers the damage you do to others — not your own ' +
            'vehicle. If it were stolen or written off tomorrow, that is yours to ' +
            'carry. We will quote comprehensive with your renewal, no obligation.',
    });
  }

  /* ---- premium trend, only when there is a real trend to show ---- */

  if (history.length >= 2) {
    var a = Number(history[history.length - 2].premium) || 0;
    var b = Number(history[history.length - 1].premium) || 0;
    if (a > 0 && b > 0 && Math.abs(b - a) / a >= 0.05) {
      var up = b > a;
      out.push({
        kind: 'premium', tone: up ? 'info' : 'good', asks: null,
        title: 'Your premium went ' + (up ? 'up' : 'down') + ' ' +
               Math.round(Math.abs(b - a) / a * 100) + '% last renewal',
        body: mrMoney_(a) + ' to ' + mrMoney_(b) + '. If your cover or the vehicle ' +
              'value has changed since, this is the moment to say so.',
      });
    }
  }

  /* ---- the things we hold for nobody ---- */

  if (!String(r.Engine__c || '').trim()) {
    out.push({
      kind: 'engine', tone: 'info', asks: 'Engine__c',
      title: 'Engine number missing',
      body: 'It sits beside the chassis number on your certificate. Quick to add ' +
            'while you are here.',
    });
  }

  if (r.Vehicle_Status__c === 'Sold') {
    out.unshift({
      kind: 'sold', tone: 'warn', asks: null,
      title: 'Our records show this vehicle as sold',
      body: 'If you still own it, tell us in the notes and we will put it right ' +
            'before the renewal goes through.',
    });
  }

  return out;
}

/* ===================== saving ===================== */

/**
 * Take the client's corrections.
 *
 * Fills only what was EMPTY. Everything else — and anything touching cover or
 * price — is recorded as a proposal for Guardian General, because a value
 * typed into a web form must not quietly replace the carrier's own record.
 *
 * Returns { ok, filled[], proposed[], why }.
 */
function mrSaveVehicle(token, riskId, changes) {
  token = String(token || '').trim();
  riskId = String(riskId || '').trim();
  changes = changes || {};

  if (!token || (typeof PSF !== 'undefined' && !PSF.TOKEN_RE.test(token)))
    return { ok: false, why: 'no-token' };
  if (!/^[a-zA-Z0-9]{15,18}$/.test(riskId)) return { ok: false, why: 'bad-risk' };
  if (typeof rsfQ_ !== 'function') return { ok: false, why: 'offline' };

  // Re-read the record under the token. Never trust a risk id from the client
  // without checking it belongs to them — the id travels through the browser.
  var own;
  try {
    own = rsfQ_(
      'SELECT Id, Vehicle__c, Chassis__c, Engine__c, CC__c, Drivers_Permit__c, ' +
      'Drivers_Permit_Expiry__c, Year_of_Manufacture__c, Vehicle_Make__c, Model__c, ' +
      'Cover1__c, Policy__c, Account__c, Portal_Token__c ' +
      'FROM Risk_Details__c ' +
      "WHERE Portal_Token__c = '" + token + "' AND Id = '" + riskId.replace(/[^a-zA-Z0-9]/g, '') + "' LIMIT 1"
    );
  } catch (err) {
    return { ok: false, why: 'offline' };
  }
  if (!own || !own.length) return { ok: false, why: 'not-yours' };
  var r = own[0];
  // Re-assert the token, same reasoning as in mrLookupVehicle: a risk id
  // arrives from the browser and must never be enough on its own to write to
  // a record. If the WHERE is ever loosened, this still refuses.
  if (String(r.Portal_Token__c || '').trim() !== token) return { ok: false, why: 'not-yours' };

  var fill = {}, filled = [], proposed = [];

  MR.FILLABLE.forEach(function (d) {
    if (!(d.f in changes)) return;
    var raw = changes[d.f];
    if (raw === null || raw === undefined || String(raw).trim() === '') return;

    var clean = mrClean_(d, raw);
    if (clean === null) return;                    // unparseable — ignore quietly

    var have = r[d.f];
    var isEmpty = (have === null || have === undefined || String(have).trim() === '');

    if (isEmpty) {
      fill[d.f] = clean;
      filled.push({ field: d.f, label: d.label, value: clean });
    } else if (String(have).trim() !== String(clean).trim()) {
      // We already hold something different. Do not overwrite the carrier.
      proposed.push({ field: d.f, label: d.label, from: have, to: clean });
    }
  });

  MR.PROPOSE_ONLY.forEach(function (f) {
    if (f in changes && String(changes[f] || '').trim() !== '') {
      proposed.push({ field: f, label: f.replace(/__c$/, '').replace(/_/g, ' '),
                      from: r[f] || '', to: changes[f] });
    }
  });

  var wrote = false;
  if (Object.keys(fill).length && typeof rsfUpdate_ === 'function' &&
      !(typeof testMode_ === 'function' && testMode_())) {
    try { rsfUpdate_('Risk_Details__c', r.Id, fill); wrote = true; } catch (err) {}
  }

  // One task carrying the lot, so a human sees it even if the write failed.
  if (typeof rsfCreate_ === 'function') {
    try {
      rsfCreate_('Task', {
        Subject: MR.TASK_TAG + ' [vehicle] ' + (r.Vehicle__c || 'vehicle') +
                 ' — client updated ' + (filled.length + proposed.length) + ' detail(s)',
        WhatId: r.Id,
        Status: proposed.length ? 'Not Started' : 'Completed',
        Priority: proposed.length ? 'High' : 'Normal',
        ActivityDate: (typeof rsfIso_ === 'function') ? rsfIso_(new Date())
                    : Utilities.formatDate(new Date(), 'UTC', 'yyyy-MM-dd'),
        Description: mrSaveBody_(r, filled, proposed, wrote),
      });
    } catch (err) {}
  }

  return { ok: true, filled: filled, proposed: proposed, wrote: wrote };
}

function mrSaveBody_(r, filled, proposed, wrote) {
  var L = ['Client updated vehicle details through the renewal portal.', ''];
  L.push('Vehicle: ' + (r.Vehicle__c || '(none)') + '   Policy: ' + (r.Policy__c || '(none)'));
  L.push('');
  if (filled.length) {
    L.push(wrote ? 'FILLED IN (these were blank on the record, now saved):'
                 : 'FILLED IN (these were blank — NOT saved, see note below):');
    filled.forEach(function (x) { L.push('  ' + x.label + ': ' + x.value); });
    L.push('');
  }
  if (proposed.length) {
    L.push('PROPOSED CHANGES — need someone to action these with Guardian General.');
    L.push('Not written to the record, because we already hold a different value:');
    proposed.forEach(function (x) {
      L.push('  ' + x.label + ': ' + (x.from || '(blank)') + '  ->  ' + x.to);
    });
    L.push('');
  }
  if (!wrote && filled.length) {
    L.push('NOTE: the record was not updated — test mode is on, or the write failed.');
    L.push('Please key the filled-in values above by hand.');
    L.push('');
  }
  L.push('Raised by the motor renewal portal.');
  return L.join('\n');
}

/** Coerce and bound one value to what its Salesforce field will accept. */
function mrClean_(d, raw) {
  var s = String(raw).trim();
  if (d.type === 'date') {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
    if (!m) return null;
    var dt = new Date(s + 'T00:00:00');
    if (isNaN(dt.getTime())) return null;
    // isNaN is not enough. JavaScript rolls an impossible date over rather
    // than rejecting it: new Date('2029-02-31') is 3 March 2029. Left alone,
    // a client typing 31 February would have the date quietly moved, or the
    // API would reject it after they had already pressed save. So require it
    // to round-trip to exactly what was typed.
    if (dt.getFullYear() !== Number(m[1]) ||
        dt.getMonth() + 1 !== Number(m[2]) ||
        dt.getDate()      !== Number(m[3])) return null;
    // A permit expiry decades out is a typo, not a permit.
    var y = Number(m[1]), now = new Date().getFullYear();
    if (y < now - 30 || y > now + 30) return null;
    return s;
  }
  if (d.type === 'year') {
    var n = parseInt(s.replace(/[^0-9]/g, ''), 10);
    if (!n) return null;
    var yy = new Date().getFullYear();
    if (n < 1950 || n > yy + 1) return null;
    return n;
  }
  if (!s) return null;
  return d.maxLen ? s.slice(0, d.maxLen) : s;
}

/* ===================== small helpers ===================== */

/**
 * Rounded, for figures a client is being asked to think about rather than pay
 * — a sum insured, a depreciation range. Cents there are noise.
 */
function mrMoney_(n) {
  n = Number(n) || 0;
  return 'TT$' + n.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 0 });
}

/**
 * Exact, for money that has moved or is owed.
 *
 * A balance must carry its cents. "TT$3,186 outstanding" against a bill of
 * TT$3,185.97 reads as a different number from the one on the invoice, and the
 * client who notices rings up to ask which is right.
 */
function mrMoney2_(n) {
  n = Number(n) || 0;
  return 'TT$' + n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function mrNiceDate_(iso) {
  var d = new Date(String(iso) + 'T00:00:00');
  if (isNaN(d.getTime())) return String(iso);
  var mo = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return d.getDate() + ' ' + mo[d.getMonth()] + ' ' + d.getFullYear();
}
