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

  /* letters and digits only, so "TAA 1234" and "taa-1234" are one registration */
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

  /* ---- cover terms ------------------------------------------------------
     A vehicle has one term per year of cover, newest first. The term in force
     on a given day is the one that brackets it; a term missing one end counts
     as open at that end, because a renewal in progress has no To date yet and
     refusing a claim over that would be our record's fault, not the client's. */
  function termAt(terms, loss) {
    if (!terms || !terms.length || loss === null) return null;
    for (var i = 0; i < terms.length; i++) {
      var f = day(terms[i].coverFrom), t = day(terms[i].coverTo);
      if (f === null && t === null) continue;
      if (f !== null && loss < f) continue;
      if (t !== null && loss > t) continue;
      return terms[i];
    }
    return null;
  }

  /* The earliest start and the latest end across every term, so "before cover"
     and "after cover" mean before the FIRST and after the LAST, never before
     whichever term happened to be newest. */
  function termSpan(terms) {
    var first = null, last = null;
    (terms || []).forEach(function (t) {
      var f = day(t.coverFrom), e = day(t.coverTo);
      if (f !== null && (first === null || f < first)) first = f;
      if (e !== null && (last === null || e > last)) last = e;
    });
    return { first: first, last: last };
  }

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

    /* --- the date of loss against the cover period -----------------------

       EVERY TERM, not only this year's. Until 5 November 2026 the register
       collapsed a vehicle's terms into one row, so a claim for an accident in
       last year's term — filed after the renewal, which is routine — came back
       "the loss is before this policy started". The client was right and we
       were wrong, and that is the worst kind of finding to show somebody.

       p.terms is every term on file, newest first; termAt picks the one in
       force on the date of loss. With no terms (a policy typed by hand, or a
       page cached from before this) it falls back to p.coverFrom/coverTo and
       behaves exactly as it used to. */
    var terms = Array.isArray(p.terms) ? p.terms : [];
    var cover = termAt(terms, loss);
    if (cover) { from = day(cover.coverFrom); to = day(cover.coverTo); }

    if (loss !== null && today !== null && loss > today) {
      add('stop', 'loss-future', 'The date of loss is in the future',
        'You entered ' + show(loss) + ', which has not happened yet.', ['incidentDate']);
    }

    if (loss !== null && terms.length && !cover) {
      /* Outside every term we hold. Which of the three it is matters, because
         the client can act on only one of them. */
      var span = termSpan(terms);
      if (span.first !== null && loss < span.first) {
        add('stop', 'loss-before-cover', 'The loss is before this policy started',
          'The earliest cover we hold on ' + (p.vehicleReg || 'this policy') + ' starts ' +
          show(span.first) + '. The loss is ' + show(loss) + ', ' +
          Math.abs(days(loss, span.first)) + ' days earlier.', ['incidentDate']);
      } else if (span.last !== null && loss > span.last) {
        add('stop', 'loss-after-cover', 'The loss is after cover ended',
          'The latest cover we hold ran to ' + show(span.last) + '. The loss is ' +
          show(loss) + ', ' + days(loss, span.last) + ' days later. ' +
          'If the policy was renewed, say so and we will check the renewal.',
          ['incidentDate']);
      } else {
        /* A gap BETWEEN two terms. Materially the same as no cover, and the
           client has to be told plainly — but our own record can be
           incomplete, so it is a stop they can answer and not a refusal. */
        add('stop', 'cover-gap', 'We hold no cover on that date',
          'Our record has cover on ' + (p.vehicleReg || 'this policy') + ' before and after ' +
          show(loss) + ' but not on the day itself. If the policy was in force then, ' +
          'say so and we will check it.', ['incidentDate']);
      }
    } else if (loss !== null && !terms.length) {
      // One term only: the behaviour this check has always had.
      if (from !== null && loss < from) {
        add('stop', 'loss-before-cover', 'The loss is before this policy started',
          'Cover on ' + (p.policy || 'this policy') + ' starts ' + show(from) +
          '. The loss is ' + show(loss) + ', ' + Math.abs(days(loss, from)) + ' days earlier.',
          ['incidentDate']);
      }
      if (to !== null && loss > to) {
        add('stop', 'loss-after-cover', 'The loss is after cover ended',
          'Cover on ' + (p.policy || 'this policy') + ' ran to ' + show(to) +
          '. The loss is ' + show(loss) + ', ' + days(loss, to) + ' days later. ' +
          'If the policy was renewed, say so and we will check the renewal.',
          ['incidentDate']);
      }
    }

    /* Matched a term that is not the current one: the assessor has to know
       which year's cover and which policy number this is being assessed
       against, because the client's own policy number has moved on since. */
    if (cover && terms.length > 1 && cover !== terms[0]) {
      add('note', 'prior-term', 'Assessed against an earlier year of cover',
        'The loss on ' + show(loss) + ' falls in the term ' + show(day(cover.coverFrom)) +
        ' to ' + show(day(cover.coverTo)) +
        (cover.policy ? ', policy ' + cover.policy : '') +
        (cover.insuredValue ? ', sum insured ' + cover.insuredValue : '') +
        '. The current term is ' + show(day(terms[0].coverFrom)) + ' to ' +
        show(day(terms[0].coverTo)) + '.', []);
    }
    /* inside cover but close to the end: worth the assessor knowing, not the client */
    if (loss !== null && to !== null && loss <= to && days(to, loss) <= 7) {
      var gap = days(to, loss);
      add('note', 'loss-near-expiry', 'Loss near the end of cover',
        (gap === 0 ? 'On the last day of cover, ' + show(to) + '.'
                   : gap + ' day' + (gap === 1 ? '' : 's') + ' before cover ended on ' + show(to) + '.'), []);
    }

    /* --- late notification ------------------------------------------------
       Health has its own ninety-day finding below, which names Guardian's own
       rule and the days left; two findings saying the same thing is noise, so
       the general one stands down for that line. */
    if (a.type !== 'health' && loss !== null && today !== null && days(today, loss) > 90) {
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

    /* --- health: Guardian gives ninety days from the date of treatment ----
       Their own claim checklist asks the member "have 90 days or less passed
       since your claim date?", and the branch has been asking it on paper for
       years. We hold the date, so it is arithmetic rather than a question —
       and the client is told while they can still do something about it.

       Never a 'stop'. A late claim may still be considered, and a register or
       a typed date can be wrong; turning a real claim away at our own door is
       the one failure this page must not have. */
    if (a.type === 'health' && loss !== null && today !== null && loss <= today) {
      var age = days(today, loss);
      if (age > 90) {
        add('check', 'health-90', 'This treatment was more than ninety days ago',
          'It was ' + show(loss) + ', ' + age + ' days ago. Guardian\'s health claim form asks ' +
          'whether ninety days or less have passed. Send it anyway — we will put the reason ' +
          'to the claims desk with it — but tell us below why it is only being claimed now.',
          ['incidentDate']);
      } else if (age > 75) {
        add('check', 'health-90-soon', 'You have ' + (90 - age) + ' day' + (90 - age === 1 ? '' : 's') +
          ' of the ninety left',
          'The treatment was ' + show(loss) + ', ' + age + ' days ago. Guardian allows ninety days ' +
          'from the date of treatment, so this one should go today.', []);
      }
    }

    return out;
  }

  /* convenience: the worst level present, and whether anything must be resolved */
  function summary(findings) {
    var n = { stop: 0, check: 0, note: 0 };
    (findings || []).forEach(function (f) { n[f.level] = (n[f.level] || 0) + 1; });
    return { stop: n.stop, check: n.check, note: n.note, mustResolve: n.stop > 0 };
  }

  /* termAt is exported because the page needs the same answer the checks got:
     it refills the cover fields from the term the loss falls in, and two
     different ideas of which term that is would be worse than none. */
  var api = { run: run, summary: summary, termAt: termAt, termSpan: termSpan,
    _day: day, _nameKey: nameKey, _key: key };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.ClaimChecks = api;
})(typeof window !== 'undefined' ? window : this);
