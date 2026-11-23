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

/** A loyalty line for the top of the messages: how long they have been with us and, when we hold it, their no-claim discount. */
function giaLoyaltyHtml_(view) {
  var out = '', since = gcmText_(view && view.since), y = /^\d{4}/.test(since) ? Number(gcmToday_().slice(0, 4)) - Number(since.slice(0, 4)) : 0;
  if (y >= 1) out += 'You have been with us since ' + since.slice(0, 4) + ', ' + y + (y === 1 ? ' year' : ' years') + '. Thank you. ';
  if (Number(view && view.ncd) > 0) out += 'Your no-claim discount is ' + Number(view.ncd) + '%. ';
  return out ? '<p><b>' + tEsc_(out.trim()) + '</b></p>' : '';
}

/** Message 1: due in two weeks, with the value options for a motor policy. */
function giaValueHtml_(st, view, days, email) {
  var key = gcmText_(st.Key), line = gcmText_(st.Line), isMotor = /motor/i.test(line);
  var items = (view.items || []).filter(function (x) { return x.value; });
  var html = '<p>Hello,</p><p>Your ' + tEsc_(line.toLowerCase()) + ' policy <b>' + tEsc_(gcmText_(st.Policy)) + '</b> renews on <b>' + tEsc_(tDmy_(gcmYmd_(st.Renewal))) + '</b>, in ' + days + ' days.</p>' + giaLoyaltyHtml_(view);
  items.forEach(function (x) {
    html += '<p style="margin:14px 0 4px"><b>' + tEsc_(x.label) + '</b> · currently insured for <b>' + tEsc_(girMoney_(x.value)) + '</b></p>';
    if (isMotor && x.kind === 'vehicle' && view.agreed) {
      html += '<p>Your policy has <b>Agreed Value</b>, so the value insured should come from a written valuation report by one of Guardian General\'s approved valuators. Please arrange one before your renewal and send it to us; we will set the value from it. Lowering the value by a percentage is not the right step for you.</p>';
    } else if (isMotor && x.kind === 'vehicle') {
      html += '<table style="border-collapse:collapse;width:100%;font-size:14px"><tr style="background:#eef3f8"><td style="padding:6px 8px">Insure it for</td><td style="padding:6px 8px">Value</td><td></td></tr>';
      giaOptions_(x.value).forEach(function (o) {
        html += '<tr style="border-top:1px solid #dde5ee"><td style="padding:6px 8px">' + (o.pct ? o.pct + '% lower' : 'The same as now') + (o.pct === GIA.RECOMMEND ? ' <b>(a common choice)</b>' : '') + '</td><td style="padding:6px 8px">' + tEsc_(girMoney_(o.value)) +
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
  var html = '<p>Hello,</p><p>Your renewal premium is ready. Your ' + tEsc_(gcmText_(st.Line).toLowerCase()) + ' policy <b>' + tEsc_(gcmText_(st.Policy)) + '</b> renews on <b>' + tEsc_(tDmy_(gcmYmd_(st.Renewal))) + '</b>, in ' + days + ' days.</p>' + giaLoyaltyHtml_(view);
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
  try { out.reports = giaReports_(); } catch (e) {}
  return out;
}

/* ── the daily reports: one short list a person, an hour before they finish; one page for the branch manager at 4:00 ──
 * Staff: GIA_REPORT_STAFF (Script property, JSON [{"email":"","name":"","finish":16}]) overrides the defaults below; finish is
 * the hour they leave (24-hour). They hold renewals by the desk's Holder e-mail; the Branch Manager's Assistant sees every one.
 * Agents are not in the renewal desk's rows, so an agent's morning list is a later step. Nothing is sent when a list is empty. */
var GIA_STAFF = [
  { email: 'elizabeth.lee@myguardiangroup.com', name: 'Elizabeth', finish: 16 },
  { email: 'azariah.griffith@myguardiangroup.com', name: 'Azariah', finish: 16 },
  { email: 'sasha.lalla-jagassar@myguardiangroup.com', name: 'Sasha', finish: 15 },
  { email: 'kamla.dookran@myguardiangroup.com', name: 'Kamla', finish: 17, all: true }
];
var GIA_BOSS = { email: 'ricky.rampersad@myguardiangroup.com', name: 'Ricky', at: 16 };

function giaStaff_() {
  try { var j = JSON.parse(PropertiesService.getScriptProperties().getProperty('GIA_REPORT_STAFF') || 'null'); if (j && j.length) return j; } catch (e) {}
  return GIA_STAFF;
}
/** Renewals that need a person, from the desk's rows. kind: yes (client said yes, proceed), reply (asked for a change or a question), quiet (no answer yet). */
function giaItems_() {
  var today = gcmToday_(), live = girLive_(), out = [];
  girRows_(GIR.TAB).forEach(function (st) {
    var stage = gcmText_(st.Stage), ren = gcmYmd_(st.Renewal);
    if (!ren || ['sent', 'changes', 'approved'].indexOf(stage) < 0) return;
    var test = gcmText_(st.Test) === 'Y'; if (test && live) return;
    var days = gcmDays_(today, ren); if (days < -3 || days > 21) return;
    var rem = girJ_(st.Reminders, {}), kind = stage === 'approved' ? 'yes' : stage === 'changes' ? 'reply' : 'quiet';
    if (kind === 'quiet' && !st['Sent at']) return;
    out.push({ key: gcmText_(st.Key), client: gcmText_(st.Client), policy: gcmText_(st.Policy), line: gcmText_(st.Line), days: days, kind: kind, test: test,
      holder: gcmText_(st['Holder e-mail']).toLowerCase(), sentDays: st['Sent at'] ? gcmDays_(gcmYmd_(st['Sent at']), today) : 0, call: !!rem.call });
  });
  var rank = { yes: 0, reply: 1, quiet: 2 };
  out.sort(function (a, b) { return rank[a.kind] - rank[b.kind] || a.days - b.days; });
  return out;
}
function giaItemHtml_(it) {
  var what = it.kind === 'yes' ? 'said YES: proceed to renew' : it.kind === 'reply' ? 'asked a question or a change: reply' : 'no answer yet' + (it.sentDays ? ' (' + it.sentDays + ' days since we wrote)' : '') + (it.call ? ', call task open' : '');
  return '<li><b>' + tEsc_(it.client) + '</b> · ' + tEsc_(it.line) + ' ' + tEsc_(it.policy) + ' · renews ' + (it.days < 0 ? Math.abs(it.days) + ' days ago' : it.days === 0 ? 'today' : 'in ' + it.days + ' days') + ' · ' + tEsc_(what) +
    ' · <a href="' + GIR.DESK + '#' + encodeURIComponent(it.key) + '">open</a></li>';
}
function giaTop_(list, n) {
  if (!list.length) return '<p>Nothing waiting. 👍</p>';
  var more = list.length > n ? '<p>and ' + (list.length - n) + ' more on the desk.</p>' : '';
  return '<ol>' + list.slice(0, n).map(giaItemHtml_).join('') + '</ol>' + more;
}
function giaFirstLine_(list) {
  var y = list.filter(function (i) { return i.kind === 'yes'; })[0], r = list.filter(function (i) { return i.kind === 'reply'; })[0], q = list.filter(function (i) { return i.kind === 'quiet' && i.days <= 7; })[0];
  return y ? 'Proceed to renew ' + y.client + ' first: they said yes.' : r ? 'Reply to ' + r.client + ' first: they asked a question or a change.' : q ? 'Call ' + q.client + ': renews in ' + q.days + ' days with no answer.' : 'Nothing urgent. Well done.';
}
/** Called from giaTick_ every working hour. Sends each person's list inside the hour before they finish, once a day. */
function giaReports_() {
  var tz = tTz_(), now = new Date(), h = Number(Utilities.formatDate(now, tz, 'H')), today = gcmToday_(), props = PropertiesService.getScriptProperties(), sent = [], items = null;
  function once(k) { var key = 'GIA_RPT_' + k + '_' + today; if (props.getProperty(key)) return false; props.setProperty(key, '1'); return true; }
  giaStaff_().forEach(function (p) {
    if (h !== p.finish - 1) return;
    items = items || giaItems_();
    var mine = items.filter(function (i) { return p.all || i.holder === String(p.email).toLowerCase(); });
    if (!mine.length || !once(p.email)) return;
    girInternal_(p.email, 'Your renewals before you finish · ' + mine.length + ' waiting',
      '<p>Hi ' + tEsc_(p.name) + ', here is what is waiting on you, most urgent first.</p><p><b>Start with:</b> ' + tEsc_(giaFirstLine_(mine)) + '</p>' + giaTop_(mine, 10));
    sent.push(p.name);
  });
  if (h === GIA_BOSS.at) {
    items = items || giaItems_();
    if (items.length && once(GIA_BOSS.email)) {
      var c = { yes: 0, reply: 0, quiet: 0 }, byHolder = {};
      items.forEach(function (i) { c[i.kind]++; var k = i.holder || 'nobody holds it'; byHolder[k] = (byHolder[k] || 0) + 1; });
      girInternal_(GIA_BOSS.email, 'Renewals today · ' + items.length + ' need a person',
        '<p><b>' + c.yes + '</b> said yes and are waiting to be renewed · <b>' + c.reply + '</b> asked a question or a change · <b>' + c.quiet + '</b> have not answered.</p>' +
        '<p>Held by: ' + Object.keys(byHolder).map(function (k) { return tEsc_(k) + ' (' + byHolder[k] + ')'; }).join(', ') + '.</p>' + giaTop_(items, 10));
      sent.push(GIA_BOSS.name);
    }
  }
  return sent;
}
function giaReportsNow() { var p = PropertiesService.getScriptProperties(); Object.keys(p.getProperties()).forEach(function (k) { if (/^GIA_RPT_/.test(k)) p.deleteProperty(k); }); return tSay_('Sent to: ' + giaReports_().join(', ') + ' (only people whose hour has come).'); }

/* ── the WhatsApp taps: respond.io's workflow POSTs each button tap here (gcm.renTap) ───────────────────────────────────
 * Body: { secret, key | email, tap }  tap = keep | lower | pct5 | pct10 | pct15 | call | notyet | yes | read
 * The secret is the GIA_TAP_KEY Script property (the workflow sends it; never put it in a page). Every tap goes through the
 * desk's own answer (girTakeAnswer_), so it reaches the renewal task's Chatter and the people who hold the renewal, and a
 * "call me" opens a call task. A Yes is accepted only after the client has tapped that they read their benefits. */
function giaTap_(b) {
  var want = String(PropertiesService.getScriptProperties().getProperty('GIA_TAP_KEY') || '');
  if (!want || String(b.secret || '') !== want) return { ok: false, error: 'Not allowed.' };
  var tap = String(b.tap || '').toLowerCase(), key = String(b.key || ''), email = String(b.email || '').trim().toLowerCase();
  var rows = girRows_(GIR.TAB).filter(function (st) {
    if (['sent', 'changes', 'approved'].indexOf(gcmText_(st.Stage)) < 0) return false;
    return key ? gcmText_(st.Key) === key : email && (gcmText_(st['E-mail']).toLowerCase() === email || girSentTo_(st).some(function (a) { return a.toLowerCase() === email; }));
  }).sort(function (a, b2) { return gcmText_(a.Renewal) < gcmText_(b2.Renewal) ? -1 : 1; });
  var st = rows[0];
  if (!st) return { ok: false, error: 'No open renewal found for that client.' };
  var k = gcmText_(st.Key), view = girJ_(st['Client view'], null) || {}, rem = girJ_(st.Reminders, {}), who = gcmText_(st.Client) || 'the client';
  var item = (view.items || []).filter(function (x) { return x.value; })[0];
  function logTap(detail) { girLog_(k, { policy: gcmText_(st.Policy), client: who }, 'WhatsApp tap: ' + tap, who, detail || ''); }
  if (tap === 'keep') { logTap('keep the value as it is'); return { ok: true, next: 'thanks' }; }
  if (tap === 'lower') { logTap('asked to see the value options'); return { ok: true, next: 'send_options', options: item ? giaOptions_(item.value) : [] }; }
  if (/^pct(5|10|15)$/.test(tap)) {
    if (!item) return { ok: false, error: 'No vehicle value on file.' };
    var pct = Number(tap.slice(3)), v = giaOptions_(item.value).filter(function (o) { return o.pct === pct; })[0].value, vals = {}; vals[item.id] = v;
    var r = girTakeAnswer_(st, { decision: 'changes', comment: 'Chose a value ' + pct + '% lower on WhatsApp: ' + girMoney_(v) + '. Please confirm the premium for this value.', values: vals }, who, 'WhatsApp');
    return Object.assign({ next: 'confirm_value', value: v }, r);
  }
  if (tap === 'call' || tap === 'notyet') {
    var r2 = girTakeAnswer_(st, { decision: 'question', comment: 'Asked for a call on WhatsApp' + (tap === 'notyet' ? ' (not ready to renew yet)' : '') + '.' }, who, 'WhatsApp');
    var tid = '';
    try {
      if (tSfOn_() && gcmText_(st.Test) !== 'Y') {
        var owner = girUserId_(gcmText_(st['Holder e-mail']));
        var tk = { Subject: 'Call the client: renewal ' + girMdy_(gcmYmd_(st.Renewal)) + ' Policy # ' + gcmText_(st.Policy) + ' - ' + who + ' asked for a call on WhatsApp', ActivityDate: gcmToday_(), Priority: 'High', Status: 'Not Started', Task_Type__c: 'Renewa/PDl/Bill',
          Description: 'The client tapped "' + (tap === 'notyet' ? 'Not yet, call me' : 'Call me') + '" on the WhatsApp renewal message. Call them today. Nothing is renewed without their yes.' };
        if (owner) tk.OwnerId = owner;
        tid = String(gblSfwSave_('post', '/sobjects/Task', tk).res.id || '');
      }
    } catch (e) {}
    rem.call = { at: gcmWhen_(new Date()), task: tid, via: 'WhatsApp' }; girSave_(k, { Reminders: rem }); logTap('call task ' + (tid || '(none: test mode)'));
    return Object.assign({ next: 'call_booked', task: tid }, r2);
  }
  if (tap === 'read') { rem.read = { at: gcmWhen_(new Date()), via: 'WhatsApp' }; girSave_(k, { Reminders: rem }); logTap('client confirmed they read their benefits'); return { ok: true, next: 'thanks' }; }
  if (tap === 'yes') {
    if (view.benefits && !rem.read) return { ok: true, needRead: true, next: 'send_benefits' };
    var r3 = girTakeAnswer_(st, { decision: 'approve', comment: 'Said yes on WhatsApp.', read: 'Y' }, who, 'WhatsApp');
    return Object.assign({ next: 'confirmed' }, r3);
  }
  return { ok: false, error: 'Unknown tap.' };
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
    since: '2014-03-01', ncd: 50, agreed: agreed === true, benefits: giaBenefits_(agreed === true),
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
