/* ═══════════════════════════════════════════════════════════════════════════
   READY TO SUBMIT — live completeness and quality, for the agent
   ───────────────────────────────────────────────────────────────────────────
   The manager already gets an RAI checklist with severity bands. The agent got
   nothing until they pressed Submit, then a wall of "Cannot submit. Missing:".
   This surfaces the same rules continuously while the fact find is being filled
   in, so nothing is a surprise at the end.

   rrbReadiness() is the ONLY implementation of the agent gate — submitForm()
   calls it too. Two copies of these rules would drift, and a panel that says
   "ready" while the button refuses is worse than no panel.
   ═══════════════════════════════════════════════════════════════════════════ */

function rrbNum_(v) {
  var n = parseFloat(String(v == null ? '' : v).replace(/[^0-9.\-]/g, ''));
  return isNaN(n) ? 0 : n;
}

function rrbReadiness() {
  var blocking = [], advisory = [], done = [];
  var adviceOnly = !!window.__adviceOnly;
  var S = (typeof state === 'object' && state) ? state : {};
  var sigs = (typeof signatures === 'object' && signatures) ? signatures : {};

  function need(cond, msg) { if (cond) blocking.push(msg); else done.push(msg); }

  // ── the gate: identical rules to the ones submitForm used to hold inline ──
  need(!S.appType, 'Application Type (Section 1)');
  if (adviceOnly) need(!S.adviceClientName, 'Client Full Name (Section 1)');
  else            need(!S.clientName,       'Client Name (Section 1)');
  need(!S.agentCode,    'Agent Code (Section 1)');
  need(!S.advisorName,  'Advisor Name (Section 1)');
  need(!S.agentEmail,   'Advisor Email (Section 1)');

  var cEmail = (adviceOnly ? S.adviceClientEmail : S.email) || '';
  need(!cEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(cEmail),
       'Client Email (Section ' + (adviceOnly ? '1' : '2') +
       ') — required so the client receives their fact-find draft & review notice');

  if (!adviceOnly) {
    need(!S.fullName, 'Full Name (Section 2)');
    need(!S.idNumber, 'ID/DP/PP # (Section 2)');
  }
  need(!S.finalDecide, 'Final Decision (Section 11)');

  if (typeof REP_DETECTED !== 'undefined' && REP_DETECTED) {
    need(S.repDeclConfirm !== 'Yes',
         'Replacement Declaration Form confirmation — required per GLOC Replacement Guidelines V6 §9');
  }
  for (var ri = 1; ri <= 6; ri++) {
    var rec = S['rec' + ri + 'Rec'];
    if (rec && String(rec).trim()) {
      need(!(S['rec' + ri + 'Reason'] && String(S['rec' + ri + 'Reason']).trim()),
           'Advisor’s Reason for Recommendation, row ' + ri + ' (Section 10)');
    }
  }
  need(!sigs.advisor, 'Advisor signature');

  // ── quality: never blocks, but it is what the manager will ask about ──────
  function note(cond, title, detail) { if (cond) advisory.push({ title: title, detail: detail }); }

  var recCount = 0, premTotal = 0, unlinked = 0;
  for (var i = 1; i <= 6; i++) {
    if (S['rec' + i + 'Rec'] && String(S['rec' + i + 'Rec']).trim()) {
      recCount++;
      premTotal += rrbNum_(S['rec' + i + 'Prem']);
      if (!S['rec' + i + 'Need'] || !String(S['rec' + i + 'Need']).trim()) unlinked++;
    }
  }
  var surplus = rrbNum_(S.cashSurplus_calc);

  note(unlinked > 0, 'Each concept should link to an identified need',
       unlinked + ' recommendation' + (unlinked === 1 ? '' : 's') +
       ' has no need attached. A plan without a need behind it is the first thing a review questions.');

  if (premTotal > 0 && surplus > 0) {
    var ratio = premTotal / surplus;
    note(ratio >= 0.8, 'Affordability — premium is ' + Math.round(ratio * 100) + '% of stated surplus',
         'Above 80% these rarely persist. Revisit the amount, or record why the client is comfortable.');
    note(ratio >= 0.5 && ratio < 0.8, 'Affordability — premium is ' + Math.round(ratio * 100) + '% of stated surplus',
         'Workable, but fragile on any income shock. Worth an explicit note that the client confirmed it.');
  } else if (recCount > 0 && premTotal > 0 && surplus <= 0) {
    note(true, 'No cash surplus recorded',
         'Affordability cannot be checked without it. Confirm whether each figure is monthly or annual.');
  }

  note(!S.goal1Need, 'Client priorities not stated in their own terms',
       'Section 7 is empty. The client’s own wording is what makes the recommendation defensible later.');

  note(S.rec1Need && S.goal1Need && S.rec1Need !== S.goal1Need,
       'Priority order may not match the client’s',
       'Their stated first goal is "' + (S.goal1Need || '') + '" but the first recommendation targets "' +
       (S.rec1Need || '') + '". Confirm the order reflects what they asked for.');

  var naq = rrbNum_(S.naqScore);
  note(naq > 0 && naq < 55, 'Needs analysis quality is ' + naq + '/100',
       'Gaps in portfolio depth, quantified needs or retirement. Below 55 a manager is likely to send it back.');

  var totalChecks = blocking.length + done.length;
  return {
    blocking: blocking,
    advisory: advisory,
    done: done,
    pct: totalChecks ? Math.round(100 * done.length / totalChecks) : 0
  };
}

function rrbRenderReadiness() {
  var el = document.getElementById('rrbReady');
  if (!el) return;
  if (typeof MODE !== 'undefined' && MODE !== 'agent') { el.innerHTML = ''; return; }

  var r = rrbReadiness();
  var ready = r.blocking.length === 0;
  var esc = function (s) {
    return String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  };

  var h = '<div style="border:1px solid ' + (ready ? '#A7F3D0' : '#E2E8F0') +
          ';background:' + (ready ? '#F0FDF4' : '#fff') + ';border-radius:12px;padding:14px 16px">';

  h += '<div style="display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap">' +
       '<div style="font-weight:800;font-size:14px;color:#0F172A">' +
         (ready ? '✓ Ready to submit' : 'Ready to submit?') + '</div>' +
       '<div style="font-size:12px;color:#64748B">' + r.done.length + ' of ' +
         (r.done.length + r.blocking.length) + ' complete</div>' +
       '</div>';

  h += '<div style="height:6px;background:#E2E8F0;border-radius:99px;overflow:hidden;margin:10px 0 4px">' +
       '<div style="height:100%;width:' + r.pct + '%;background:' + (ready ? '#059669' : '#0D9488') + '"></div>' +
       '</div>';

  if (r.blocking.length) {
    h += '<div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;font-weight:800;' +
         'color:#B91C1C;margin:12px 0 6px">Needed before you can submit</div>' +
         '<ul style="margin:0 0 2px 18px;padding:0;font-size:13px;color:#334155;line-height:1.6">' +
         r.blocking.map(function (m) { return '<li style="margin:3px 0">' + esc(m) + '</li>'; }).join('') +
         '</ul>';
  } else {
    h += '<div style="font-size:13px;color:#065F46;margin:8px 0 2px">' +
         'Everything required is in place. Check the notes below, then submit.</div>';
  }

  if (r.advisory.length) {
    h += '<div style="font-size:11px;letter-spacing:.12em;text-transform:uppercase;font-weight:800;' +
         'color:#B45309;margin:14px 0 6px">Worth checking — will not stop you submitting</div>';
    h += r.advisory.map(function (a) {
      return '<div style="background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;padding:9px 11px;margin:0 0 6px">' +
             '<div style="font-size:13px;font-weight:700;color:#78350F">' + esc(a.title) + '</div>' +
             '<div style="font-size:12.5px;color:#92400E;margin-top:2px;line-height:1.5">' + esc(a.detail) + '</div>' +
             '</div>';
    }).join('');
    h += '<div style="font-size:11.5px;color:#94A3B8;line-height:1.5;margin-top:8px">' +
         'These are prompts from RAI, not rules. RAI advises &mdash; the recommendation, ' +
         'and the accountability for it, remain yours.</div>';
  }

  h += '</div>';
  el.innerHTML = h;
}

// Keep it live. saveState() already runs on every debounced input, so wrapping
// it is the one hook that catches every change without touching field handlers.
(function () {
  if (typeof saveState !== 'function' || window.__rrbReadyHooked) return;
  window.__rrbReadyHooked = true;
  var _origSave = saveState;
  saveState = function () {
    var out = _origSave.apply(this, arguments);
    try { rrbRenderReadiness(); } catch (e) {}
    return out;
  };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () { try { rrbRenderReadiness(); } catch (e) {} });
  } else {
    try { rrbRenderReadiness(); } catch (e) {}
  }
})();
