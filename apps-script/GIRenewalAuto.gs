/**
 * GIRenewalAuto.gs — the automatic renewal messages for general insurance (written 22 November 2026).
 * An eighth file in the Service Questionnaire project, beside GIRenewals.gs. It adds two client messages and one
 * internal notice to the renewal desk's hourly run (girTick_ calls giaTick_), with no Service.gs paste.
 *
 *   14 days before the renewal  → "Your renewal is due in two weeks": the vehicle, registration and current value.
 *                                 For motor, the value options (as it is, 5%, 10%, 15% lower) with the trade-off in
 *                                 plain words. A link opens the client's renewal page with the chosen value filled in.
 *   7 days before, notice read  → "Your renewal premium is ready": the premium from Guardian General's notice, and Yes /
 *                                 No links. A yes goes through the desk's own answer (girTakeAnswer_), so nothing is
 *                                 renewed without the client's yes.
 *   7 days before, notice NOT read → the staff are told once, to read it.
 *
 * Every message is copied to the branch manager, the Branch Manager's Assistant and Pawan (GIA_NOTIFY adds more).
 * TEST MODE is the desk's own (girLive_): until girGoLive, client mail goes to the test addresses on the row, marked TEST.
 * The premium is NEVER worked out here: it is whatever the notice says. A value the client picks that differs from the
 * notice is shown as "we will confirm the premium for that value" and a staff member is told.
 *
 * Test client: run giaSeedEthan() (needs the GIA_ETHAN_EMAIL Script property), then giaTickNow(). Invented car, invented
 * figures, Test = Y, so nothing real is read or written.
 */
var GIA = {
  VALUE_DAYS: 14,
  PREMIUM_DAYS: 7,
  OPTIONS: [0, 5, 10, 15],      // per cent lower than the current value
  RECOMMEND: 10,                // the option shown as "most clients choose this" for comprehensive motor; the approver may change it
  NOTIFY_PROP: 'GIA_NOTIFY',
  ETHAN_PROP: 'GIA_ETHAN_EMAIL'
};

function giaNotify_() {
  var out = [], seen = {};
  function add(a) { a = String(a || '').trim(); var k = a.toLowerCase(); if (/@/.test(a) && !seen[k]) { seen[k] = 1; out.push(a); } }
  try { girApprovers_().forEach(function (a) { add(a.email); }); } catch (e) {}
  try { var d = girDeliverer_(); if (d && /@/.test(d.name)) add(d.name); } catch (e2) {}
  try { String(PropertiesService.getScriptProperties().getProperty(GIA.NOTIFY_PROP) || '').split(/[,;\s]+/).forEach(add); } catch (e3) {}
  return out;
}

/** The value options for one figure: 0, 5, 10, 15 per cent lower, rounded to the nearest TT$100. */
function giaOptions_(value) {
  value = Number(value) || 0;
  return GIA.OPTIONS.map(function (p) { return { pct: p, value: Math.round(value * (1 - p / 100) / 100) * 100 }; });
}

/** What MotorGuard (private motor) gives, from Guardian General's policy wording GG-MOT-POL-APV-10/09 and its MotorGuard
 *  value-proposition sheet. Every line says "if it is on your schedule" where it is an option; the client's own schedule
 *  holds the exact limits. COMPLIANCE SIGNS OFF THIS WORDING before it goes live. */
function giaBenefits_(agreed) {
  var b = [
    { t: 'Your schedule', x: 'Your policy schedule and policy document set out your exact limits, excesses and extras. This is a summary.' },
    { t: 'Total loss', x: agreed
        ? 'You have Agreed Value: we pay the sum insured regardless of market value, less 15% depreciation a year (pro rata) and your excess. The sum insured must come from a written valuation by an approved valuator each year.'
        : 'We pay the market value or the value insured, whichever is less. A higher value does not raise what is paid, and a lower one can leave you short.' },
    { t: 'Windscreen', x: 'A claim for windscreen or glass damage alone has no excess and does not affect your no-claim discount. If the glass is replaced, the cover is reinstated free once a year for up to $2,500. It can also be added to third-party policies. Confirm the replacement cost with us first; our windscreen providers are Double Zee, TWC (The Windshield Company) and Bills Windshield Replacement.' },
    { t: 'Excess (what you pay on a claim)', x: 'Insured and spouse: 3% (minimum $1,000). Any other authorised driver: 4% ($1,500). Under 25, a learner\'s permit, or a licence held under 2 years: 7.5% ($3,500). Fire, explosion, lightning, burglary, theft: 5% ($2,500). Where none of these apply: 3% ($2,000). Your schedule shows the exact figure for your policy.' },
    { t: 'Waiver of Excess (if on your schedule)', x: 'Removes the excess for collisions with vehicles and objects, any driver you give permission to (including declared young and inexperienced drivers), and partial losses. It is an optional extra, priced at about 0.35% of the sum insured (0.5% where young drivers are covered).' },
    { t: 'Courtesy car or hospitalisation (if on your schedule)', x: 'Either a courtesy car for up to 10 days, to a maximum of $2,750, or a hospitalisation benefit of up to $15,000 a year. The days apply while the vehicle is being repaired.' },
    { t: 'Mechanical Repair Cover (optional)', x: 'Three levels: $3,000 cover with a $300 deductible, $5,000 with $500, or $8,000 with $800, each at its own premium.' },
    { t: 'Survivor\'s Benefit (optional, comprehensive private cars)', x: 'A cash benefit if the insured dies, with premiums by age (17 to 49, 50 to 60, 61 to 64). It has exclusions, so ask us for the details.' },
    { t: 'Personal accident (if on your schedule)', x: 'Up to $10,000 per person and $40,000 in total per policy year.' },
    { t: 'Hospitalisation (if on your schedule)', x: 'A maximum benefit of $15,000 per 12-month period.' },
    { t: 'Other benefits', x: 'Damage to your garage by fire, replacement of car keys, damage to a child car seat, no-claim-discount protection and a six-month policy option, where they apply to your policy.' },
    { t: 'No-claim discount (comprehensive)', x: '30% after one claim-free year, 40% after two, 50% after three and 60% after four. A claim can reduce it, even if you are not at fault.' },
    { t: 'Who may drive', x: 'The persons in your schedule, or any drivers you have declared to us. Tell us if anyone else will drive.' },
    { t: 'Your duties', x: 'Keep the vehicle road-worthy, give us accurate information, tell us of changes to the vehicle, and report a claim within 30 days.' }
  ];
  return b;
}
function giaBenefitsHtml_(agreed) {
  return '<h3>Your Guardian MotorGuard benefits, in brief</h3><ul>' + giaBenefits_(agreed).map(function (x) { return '<li><b>' + tEsc_(x.t) + ':</b> ' + tEsc_(x.x) + '</li>'; }).join('') + '</ul>';
}

function giaLink_(email, key, extra) {
  return GIR.SITE + '?e=' + encodeURIComponent(email) + '&k=' + encodeURIComponent(key) + (extra || '');
}
function giaShell_(inner) {
  return '<div style="max-width:600px;font:15px/1.6 Arial,sans-serif;color:#1d2b3a">' + inner +
    '<p>Warm regards,<br>Ricky Rampersad Branch · Guardian Life of the Caribbean<br>' + tEsc_(GIR.BRANCH_TELS) + '</p><div style="font-size:11px;color:#6b7785">' + tLegal_(null) + '</div></div>';
}
function giaBtn_(href, text, bg) {
  return '<a href="' + href + '" style="display:inline-block;background:' + (bg || '#0d1f33') + ';color:#fff;text-decoration:none;font-weight:700;padding:11px 18px;border-radius:9px;margin:4px 6px 4px 0">' + tEsc_(text) + '</a>';
}

/** Message 1: due in two weeks, with the value options for a motor policy. */
function giaValueHtml_(st, view, days, email) {
  var key = gcmText_(st.Key), line = gcmText_(st.Line), isMotor = /motor/i.test(line);
  var items = (view.items || []).filter(function (x) { return x.value; });
  var html = '<p>Hello,</p><p>Your ' + tEsc_(line.toLowerCase()) + ' policy <b>' + tEsc_(gcmText_(st.Policy)) + '</b> renews on <b>' + tEsc_(tDmy_(gcmYmd_(st.Renewal))) + '</b>, in ' + days + ' days.</p>';
  items.forEach(function (x) {
    html += '<p style="margin:14px 0 4px"><b>' + tEsc_(x.label) + '</b> · currently insured for <b>' + tEsc_(girMoney_(x.value)) + '</b></p>';
    if (isMotor && x.kind === 'vehicle' && view.agreed) {
      html += '<p>Your policy has <b>Agreed Value</b>, so the value insured should come from a written valuation report by one of Guardian General\'s approved valuators. Please arrange one before your renewal and send it to us; we will set the value from it. Lowering the value by a percentage is not the right step for you.</p>';
    } else if (isMotor && x.kind === 'vehicle') {
      html += '<table style="border-collapse:collapse;width:100%;font-size:14px"><tr style="background:#eef3f8"><td style="padding:6px 8px">Insure it for</td><td style="padding:6px 8px">Value</td><td></td></tr>';
      giaOptions_(x.value).forEach(function (o) {
        html += '<tr style="border-top:1px solid #dde5ee"><td style="padding:6px 8px">' + (o.pct ? o.pct + '% lower' : 'The same as now') + (o.pct === GIA.RECOMMEND ? ' <b>(most clients choose this)</b>' : '') + '</td><td style="padding:6px 8px">' + tEsc_(girMoney_(o.value)) +
          '</td><td style="padding:6px 8px">' + '<a href="' + giaLink_(email, key, '&pct=' + o.pct) + '">Choose</a></td></tr>';
      });
      html += '</table><p style="font-size:13px;color:#4b5a6a">A vehicle usually loses value each year, so many comprehensive policyholders lower the value by about ' + GIA.RECOMMEND + '%, which lowers the premium. The trade-off: on a total loss we pay the market value or the value insured, whichever is less, so too low a figure can leave you short. Pick what you think the vehicle is worth today.</p>';
    }
  });
  if (isMotor) html += giaBenefitsHtml_(!!view.agreed) + '<p>You will be asked to confirm that you have read these benefits when you answer.</p>';
  html += '<p>We will send your renewal premium as soon as Guardian General confirms it. We renew only once you say yes.</p><p>' + giaBtn_(giaLink_(email, key), 'Review my renewal') + '</p>';
  return giaShell_(html);
}

/** Message 2: the premium is ready, proceed yes or no. */
function giaPremiumHtml_(st, view, days, email) {
  var key = gcmText_(st.Key), ans = girJ_(st['Client answer'], null) || {}, vals = ans.values || {};
  var html = '<p>Hello,</p><p>Your renewal premium is ready. Your ' + tEsc_(gcmText_(st.Line).toLowerCase()) + ' policy <b>' + tEsc_(gcmText_(st.Policy)) + '</b> renews on <b>' + tEsc_(tDmy_(gcmYmd_(st.Renewal))) + '</b>, in ' + days + ' days.</p>';
  (view.items || []).forEach(function (x) { html += '<p style="margin:4px 0">' + tEsc_(x.label) + ': insured for <b>' + tEsc_(girMoney_(vals[x.id] || x.value)) + '</b></p>'; });
  html += '<p style="font-size:18px">Premium: <b>' + tEsc_(girMoney_(view.total)) + '</b> <span style="font-size:13px;color:#4b5a6a">tax included</span></p>';
  if (Object.keys(vals).length) html += '<p style="font-size:13px;color:#4b5a6a">You chose a different value from last year. If the premium above was worked out on the old value, we will confirm the new one before anything is renewed.</p>';
  html += '<p><b>Would you like us to go ahead and renew?</b></p><p>' + giaBtn_(giaLink_(email, key, '&go=yes'), 'Yes, renew it', '#107f78') + giaBtn_(giaLink_(email, key, '&go=no'), 'No, talk to me first', '#5b6670') + '</p>' +
    '<p>You can also reply to this e-mail or call the branch. We renew only on your yes.</p>';
  return giaShell_(html);
}

/** The hourly step (girTick_ calls it). Returns counts. */
function giaTick_(rows, o) {
  var out = { value: 0, premium: 0, waiting: 0 }, today = gcmToday_(), now = new Date();
  girRows_(GIR.TAB).forEach(function (st) {
    var stage = gcmText_(st.Stage), key = gcmText_(st.Key);
    if (stage !== 'sent' && stage !== 'changes' && stage !== 'approved') return;
    var ren = gcmYmd_(st.Renewal); if (!ren) return;
    var days = gcmDays_(today, ren), test = gcmText_(st.Test) === 'Y';
    if (days < 0 || days > GIA.VALUE_DAYS) return;
    if (!test && !girLive_()) return;
    var rem = girJ_(st.Reminders, {}), view = girJ_(st['Client view'], null) || {}, sentTo = girSentTo_(st), email = sentTo[0] || gcmText_(st['E-mail']);
    if (!gcmEmailOk_(email)) return;
    var r = { key: key, policy: gcmText_(st.Policy), client: gcmText_(st.Client) }, tag = test ? '[TEST] ' : '', cc = test ? sentTo.slice(1) : GCM.COPY;
    var notify = giaNotify_(), changed = false;
    try {
      if (!rem.a14 && stage !== 'approved') {
        girMail_(email, tag + 'Your renewal is due in ' + days + ' days · policy ' + r.policy, giaValueHtml_(st, view, days, email), { cc: cc });
        rem.a14 = { at: gcmWhen_(now) }; changed = true; out.value++;
        notify.forEach(function (a) { girInternal_(a, tag + 'Two-week renewal notice sent · ' + r.client + ' · ' + r.policy, '<p>The two-week renewal message (with value options) went to <b>' + tEsc_(r.client) + '</b> for ' + tEsc_(r.policy) + ', renewing ' + tEsc_(tDmy_(ren)) + '.</p><p><a href="' + GIR.DESK + '#' + encodeURIComponent(key) + '">Open it on the renewal desk</a></p>'); });
        girLog_(key, r, 'two-week notice sent (value options)', 'the desk', days + ' days');
      }
      if (days <= GIA.PREMIUM_DAYS && !rem.a7 && stage !== 'approved') {
        if (view.total > 0) {
          girMail_(email, tag + 'Your renewal premium is ready · policy ' + r.policy, giaPremiumHtml_(st, view, days, email), { cc: cc });
          rem.a7 = { at: gcmWhen_(now) }; changed = true; out.premium++;
          notify.forEach(function (a) { girInternal_(a, tag + 'Premium-ready notice sent · ' + r.client + ' · ' + r.policy, '<p>The premium (' + tEsc_(girMoney_(view.total)) + ') and the Yes / No question went to <b>' + tEsc_(r.client) + '</b> for ' + tEsc_(r.policy) + '. Their answer reaches the renewal task and your e-mail.</p>'); });
          girLog_(key, r, 'premium-ready notice sent', 'the desk', girMoney_(view.total));
        } else if (!rem.a7wait) {
          rem.a7wait = { at: gcmWhen_(now) }; changed = true; out.waiting++;
          notify.forEach(function (a) { girInternal_(a, tag + 'Renewal notice not read yet · ' + r.client + ' · ' + r.policy, '<p>' + tEsc_(r.client) + ' renews on ' + tEsc_(tDmy_(ren)) + ' (' + days + ' days) and Guardian General\'s notice has not been read on the desk, so there is no premium to send. Please read the notice.</p><p><a href="' + GIR.DESK + '#' + encodeURIComponent(key) + '">Open it on the renewal desk</a></p>'); });
          girLog_(key, r, 'premium notice waiting: the renewal notice is not read', 'the desk', days + ' days');
        }
      }
    } catch (e) { girLog_(key, r, 'automatic renewal message failed', 'the desk', String(e && e.message ? e.message : e).slice(0, 200)); }
    if (changed) girSave_(key, { Reminders: rem });
  });
  return out;
}

/** A made-up renewal for the test client, 14 days out, with an invented car. Set GIA_ETHAN_EMAIL first. */
/** Other people who may sign in as the test client (the GIA_TEST_VIEWERS Script property, comma-separated). */
function giaViewers_() { try { return String(PropertiesService.getScriptProperties().getProperty('GIA_TEST_VIEWERS') || '').split(/[,;\s]+/).filter(function (a) { return /@/.test(a); }); } catch (e) { return []; } }
function giaSeedEthanAgreed() { return giaSeedEthan(true); }
function giaSeedEthan(agreed) {
  var p = PropertiesService.getScriptProperties(), email = String(p.getProperty(GIA.ETHAN_PROP) || '').trim();
  if (!gcmEmailOk_(email)) return tSay_('Set the GIA_ETHAN_EMAIL Script property to the test client\'s address, then run this again.');
  var today = gcmToday_(), ren = gcmAddDays_(today, GIA.VALUE_DAYS), key = 'TEST-ETHAN-' + (agreed === true ? 'AV-' : '') + ren;
  var view = { key: key, policy: 'TTAPG0000001', line: 'Motor', client: 'Ethan Test', ren: ren, lastPremium: 4800, premium: 0, tax: 0, total: 0,
    agreed: agreed === true, benefits: giaBenefits_(agreed === true),
    items: [{ id: 'TEST1', label: 'Toyota Aqua PDF 1234', vehicle: 'PDF 1234', value: 120000, lastValue: 120000, kind: 'vehicle', bank: '' }], years: [], points: [], reqs: [] };
  girSave_(key, { Policy: 'TTAPG0000001', Line: 'Motor', Client: 'Ethan Test', 'E-mail': email, Renewal: ren, Stage: 'sent', Holder: 'Ricky Rampersad', 'Holder e-mail': GIR.TEST_TO[0],
    'Client view': view, 'Sent at': new Date(), 'Sent to': [email].concat(giaViewers_(), giaNotify_()).join(', '), Test: 'Y', Reminders: {}, 'Client answer': '' });
  return tSay_('Test renewal created for ' + email + ' (renews ' + ren + '). Run giaTickNow to send the two-week message; giaSetEthanPremium then giaTickNow sends the premium message.');
}
/** Pretend the notice was read: a made-up premium, and the date moved to 7 days out so the premium message is due. */
function giaSetEthanPremium() {
  var rows = girRows_(GIR.TAB).filter(function (s) { return /^TEST-ETHAN-/.test(gcmText_(s.Key)); }), st = rows[rows.length - 1];
  if (!st) return tSay_('Run giaSeedEthan first.');
  var view = girJ_(st['Client view'], {}), ren = gcmAddDays_(gcmToday_(), GIA.PREMIUM_DAYS);
  view.premium = 4900; view.tax = 294; view.total = 5194; view.ren = ren;
  girSave_(gcmText_(st.Key), { 'Client view': view, Renewal: ren });
  return tSay_('Made-up premium TT$5,194.00 set; renewal now ' + ren + '. Run giaTickNow.');
}
function giaTickNow() { var r = girTick_({ force: true }); return tSay_(JSON.stringify(r.done || r)); }
