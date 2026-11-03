/* What the claim says, checked against what we already hold.
 *
 * Asked for on 3 November 2026: "should not you build intelligence into this to ensure the
 * answers are correct and guide the claims process".
 *
 * These are deterministic checks, not a language model, and that is the point. Whether a
 * permit had expired on the day of the accident is arithmetic; whether the loss falls
 * inside the cover period is arithmetic. Arithmetic can be shown to the client, shown to
 * the assessor, and argued with. A model guessing at it can do none of those things. The
 * model's turn comes after, on the one thing it is actually better at: reading the
 * client's own account of the accident for what is missing or contradicts itself.
 *
 * Every finding names what it compared. "There may be a problem with your dates" helps
 * nobody; "the loss is 12 days after cover ended on 16 Oct 2026" can be acted on.
 *
 * Three levels:
 *   stop  - this cannot be right as it stands. The client must correct it, or say why it
 *           is right anyway; their answer travels with the claim. It never blocks filing.
 *           A register can be stale and a real claim must never be turned away by us.
 *   check - probably wrong. Shown, not blocking.
 *   note  - true, and the assessor should know. Never shown to the client.
 *
 * The policy half comes from the lookup, which already fetches the cover period, the
 * carrier, the insured value and the windscreen limit from Salesforce - and which, until
 * now, threw all four away.
 *
 * Browser (window.ClaimChecks) and Node (module.exports).
 */
(function (root) {

  /* ---- dates -------------------------------------------------------------
     The register holds yyyy-MM-dd but a sheet may hand back a Date, and a
     person may type dd/MM/yyyy. Anything unparseable returns null and every
     check that needs it simply does not run: a check that fires on a date it
     did not understand is worse than no check. */
  function day(value) {
    if (value === null || value === undefined || value === '') return null;
    if (value instanceof Date && !isNaN(value)) return utc(value.getFullYear(), value.getMonth() + 1, value.getDate());
    var s = String(value).trim();
    var m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);                    // yyyy-MM-dd
    if (m) return utc(+m[1], +m[2], +m[3]);
    m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{4})$/);             // dd/MM/yyyy
    if (m) return utc(+m[3], +m[2], +m[1]);
    var d = new Date(s);                                                 // a Date's own toString
    return isNaN(d) ? null : utc(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }
  function utc(y, m, d) { return Date.UTC(y, m - 1, d); }
  function days(a, b) { return Math.round((a - b) / 86400000); }
  function show(ms) {
    if (ms === null) return '';
    var d = new Date(ms);
    var M = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
    return d.getUTCDate() + ' ' + M[d.getUTCMonth()] + ' ' + d.getUTCFullYear();
  }

  /* letters and digits only, so "PDL 4471" and "pdl-4471" are one registration */
  function key(s) { return String(s || '').toUpperCase().replace(/[^A-Z0-9]/g, ''); }
  function money(s) {
    var n = parseFloat(String(s === null || s === undefined ? '' : s).replace(/[^0-9.]/g, ''));
    return isFinite(n) && n > 0 ? n : null;
  }
  /* "Anselm Boodoosingh" and "BOODOOSINGH, Anselm" are the same person */
  function nameKey(s) {
    return String(s || '').toLowerCase().replace(/[^a-z ]/g, ' ').split(/\s+/)
      .filter(function (w) { return w.length > 1; }).sort().join(' ');
  }
  function yes(v) { return /^(y|yes|true|1)$/i.test(String(v || '').trim()); }

  /* ---- the checks -------------------------------------------------------- */

  /* a: the client's answers. p: the policy as the lookup returned it. now: for tests. */
  function run(a, p, now) {
    a = a || {}; p = p || {};
    var out = [];
    var add = function (level, id, title, detail, fields) {
      out.push({ id: id, level: level, title: title, detail: detail, fields: fields || [] });
    };

    var today = day(now || new Date());
    var loss = day(a.incidentDate);
    var from = day(p.coverFrom), to = day(p.coverTo);
    var issue = day(a.permitIssue), expiry = day(a.permitExpiry);

    /* --- the date of loss against the cover period ----------------------- */
    if (loss !== null && today !== null && loss > today) {
      add('stop', 'loss-future', 'The date of loss is in the future',
        'You entered ' + show(loss) + ', which has not happened yet.', ['incidentDate']);
    }
    if (loss !== null && from !== null && loss < from) {
      add('stop', 'loss-before-cover', 'The loss is before this policy started',
        'Cover on ' + (p.policy || 'this policy') + ' starts ' + show(from) +
        '. The loss is ' + show(loss) + ', ' + Math.abs(days(loss, from)) + ' days earlier.',
        ['incidentDate']);
    }
    if (loss !== null && to !== null && loss > to) {
      add('stop', 'loss-after-cover', 'The loss is after cover ended',
        'Cover on ' + (p.policy || 'this policy') + ' ran to ' + show(to) +
        '. The loss is ' + show(loss) + ', ' + days(loss, to) + ' days later. ' +
        'If the policy was renewed, say so and we will check the renewal.',
        ['incidentDate']);
    }
    /* inside cover but close to the end: worth the assessor knowing, not the client */
    if (loss !== null && to !== null && loss <= to && days(to, loss) <= 7) {
      var gap = days(to, loss);
      add('note', 'loss-near-expiry', 'Loss near the end of cover',
        (gap === 0 ? 'On the last day of cover, ' + show(to) + '.'
                   : gap + ' day' + (gap === 1 ? '' : 's') + ' before cover ended on ' + show(to) + '.'), []);
    }

    /* --- late notification ------------------------------------------------ */
    if (loss !== null && today !== null && days(today, loss) > 90) {
      add('check', 'loss-old', 'This happened some time ago',
        show(loss) + ' is ' + days(today, loss) + ' days back. Late notice can affect a claim, ' +
        'so tell us in your account why it is being reported now.', ['incidentDate', 'description']);
    }

    /* --- the permit ------------------------------------------------------- */
    if (loss !== null && expiry !== null && expiry < loss) {
      add('stop', 'permit-expired', "The driver's permit had expired",
        'The permit expired ' + show(expiry) + ', ' + days(loss, expiry) +
        ' days before the accident on ' + show(loss) + '. This is material, so it has to be right.',
        ['permitExpiry', 'incidentDate']);
    }
    if (loss !== null && issue !== null && issue > loss) {
      add('stop', 'permit-after-loss', 'The permit was issued after the accident',
        'First issue reads ' + show(issue) + ', which is after the loss on ' + show(loss) + '.',
        ['permitIssue', 'incidentDate']);
    }
    if (issue !== null && expiry !== null && expiry < issue) {
      add('stop', 'permit-dates-reversed', 'The permit dates are the wrong way round',
        'First issue ' + show(issue) + ' is after expiry ' + show(expiry) + '.',
        ['permitIssue', 'permitExpiry']);
    }
    if (loss !== null && expiry !== null && expiry >= loss && days(expiry, loss) <= 30) {
      add('note', 'permit-near-expiry', 'Permit close to expiry at the date of loss',
        'It expired ' + show(expiry) + ', ' + days(expiry, loss) + ' days after the accident.', []);
    }
    if (a.driverPermit && p.permitOnFile && key(a.driverPermit) !== key(p.permitOnFile)) {
      add('check', 'permit-mismatch', 'That permit number is not the one we hold',
        'We have ' + p.permitOnFile + ' on file. If the driver is someone else, that is fine — ' +
        'say so under who was driving.', ['driverPermit', 'driverName']);
    }

    /* --- the vehicle ------------------------------------------------------ */
    if (a.vehicleReg && p.vehicleReg && key(a.vehicleReg) !== key(p.vehicleReg)) {
      add('stop', 'reg-mismatch', 'This registration is not the one on the policy',
        'The policy covers ' + p.vehicleReg + '. You entered ' + a.vehicleReg +
        '. A claim has to be made on the policy that covers the vehicle.', ['vehicleReg']);
    }

    /* --- money ------------------------------------------------------------ */
    var est = money(a.amount), insured = money(p.insuredValue);
    if (est !== null && insured !== null && est > insured) {
      add('note', 'estimate-over-value', 'Estimate above the insured value',
        'Estimate TT$' + est.toLocaleString() + ' against an insured value of TT$' +
        insured.toLocaleString() + '. This may be a total loss.', []);
    }

    /* --- the carrier ------------------------------------------------------
       The branch places business with Tatil, Sagicor, Colfire, Beacon and others.
       Guardian's accident report form is Guardian's, and Guardian's desk is
       Guardian's. A claim on another carrier's policy must not be filed as if it
       were theirs. */
    if (p.carrier && !/guardian/i.test(p.carrier)) {
      add('check', 'carrier-not-guardian', 'This policy is underwritten by ' + p.carrier,
        'The claim form and the desk here are Guardian General\'s. We will file it with ' +
        p.carrier + ' and tell you who is handling it.', []);
    }

    /* --- what the form will ask ------------------------------------------- */
    if (a.incidentTime) {
      var t = String(a.incidentTime).match(/^(\d{1,2}):(\d{2})/);
      if (t && (+t[1] >= 18 || +t[1] < 6)) {
        add('note', 'after-dark', 'After dark',
          'Guardian\'s form asks whether the headlights were on when the accident happened ' +
          'after 6 p.m. Worth asking before it goes.', []);
      }
    }

    /* --- the claim's own consistency -------------------------------------- */
    if (yes(a.driverSame) && a.driverName && a.name && nameKey(a.driverName) !== nameKey(a.name)) {
      add('check', 'driver-same-but-different', 'The driver is named as someone else',
        'You said the driver was the same person as the insured, but gave "' + a.driverName +
        '" where the policy is in the name of "' + a.name + '".', ['driverName', 'driverSame']);
    }
    if (a.policeReport && !a.policeStation) {
      add('check', 'report-without-station', 'A report number with no station',
        'You gave a report number but not the station it was made at. Guardian\'s form asks for both.',
        ['policeStation']);
    }
    if (yes(a.thirdparty) && !a.tpName && !a.tpVehicle) {
      add('check', 'third-party-no-details', 'Someone is claiming, but we have no details of them',
        'Give their name or their vehicle if you have either — it is what lets us answer them.',
        ['tpName', 'tpVehicle']);
    }
    if (yes(a.injuries)) {
      add('note', 'injuries', 'Someone was injured',
        'Guardian\'s form has a section for each injured person. The desk will need their names, ' +
        'dates of birth and the treating physician.', []);
    }

    return out;
  }

  /* convenience: the worst level present, and whether anything must be resolved */
  function summary(findings) {
    var n = { stop: 0, check: 0, note: 0 };
    (findings || []).forEach(function (f) { n[f.level] = (n[f.level] || 0) + 1; });
    return { stop: n.stop, check: n.check, note: n.note, mustResolve: n.stop > 0 };
  }

  var api = { run: run, summary: summary, _day: day, _nameKey: nameKey, _key: key };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ClaimChecks = api;
})(typeof window !== 'undefined' ? window : this);
