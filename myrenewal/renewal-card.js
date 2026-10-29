/* One renewal as the client reads it (29 October 2026): what renews, this year's premium against last year's, the history
 * since the policy began, claims, what is worth a look, the documents Guardian General needs, where it stands, and the
 * client's answer (yes, something has changed, a question). Used by /myrenewal/ (signed in with a code to their e-mail)
 * and by a group's own service page (its Renewals tab), so the two always read the same.
 *
 * RenewalCard.html(view, { today, group })   the card's markup; view is what GIRenewals.gs girView_ returns
 * RenewalCard.bind(root, send)               wires the answer form; send(key, body) returns a Promise of { ok, said, error }
 * No client data lives here: everything comes from the backend at request time. */
(function (root) {
  'use strict';
  var MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  var esc = function (s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); };
  var dmy = function (s) { var m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s || ''); return m ? (+m[3]) + ' ' + MON[+m[2] - 1] + ' ' + m[1] : ''; };
  var money = function (n) { return 'TT$' + (Math.round((Number(n) || 0) * 100) / 100).toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
  var whole = function (n) { return 'TT$' + Math.round(Number(n) || 0).toString().replace(/\B(?=(\d{3})+(?!\d))/g, ','); };
  var days = function (a, b) { var x = Date.UTC.apply(null, a.split('-').map(function (v, i) { return i === 1 ? v - 1 : +v; })), y = Date.UTC.apply(null, b.split('-').map(function (v, i) { return i === 1 ? v - 1 : +v; })); return Math.round((y - x) / 864e5); };
  var ICON = {
    car: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 17h14M6 17v2M18 17v2M4 13l2-5a2 2 0 0 1 2-1h8a2 2 0 0 1 2 1l2 5v4H4z"/><circle cx="7.5" cy="14.5" r="1"/><circle cx="16.5" cy="14.5" r="1"/></svg>',
    home: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 11l9-7 9 7"/><path d="M5 10v10h14V10"/><path d="M10 20v-6h4v6"/></svg>',
    shield: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z"/><path d="M8.5 12l2.5 2.5 4.5-5"/></svg>',
    doc: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M14 3H7a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V8z"/><path d="M14 3v5h5M9 13h6M9 17h6"/></svg>',
    check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>'
  };
  var CSS = '.rc{background:#fff;border:1px solid #E3EAF5;border-radius:20px;box-shadow:0 10px 30px rgba(58,123,213,.09);overflow:hidden;margin:0 0 18px;color:#3A4A66;font-size:1rem;line-height:1.55}' +
    '.rc svg{width:22px;height:22px;fill:none;stroke:currentColor;stroke-width:2;stroke-linecap:round;stroke-linejoin:round;flex:none}' +
    '.rc h3,.rc h4{color:#1B2A44;margin:0;line-height:1.25}' +
    '.rc-band{background:linear-gradient(135deg,#3A7BD5 0%,#4C94E6 60%,#62B0EE 120%);color:#fff;padding:20px 20px 18px;position:relative;overflow:clip}' +
    '.rc-band:after{content:"";position:absolute;right:-40px;top:-40px;width:180px;height:180px;border-radius:50%;background:rgba(255,255,255,.08)}' +
    '.rc-band .k{font-size:.78rem;font-weight:700;letter-spacing:.07em;text-transform:uppercase;color:#EAF3FD;display:flex;gap:8px;align-items:center}' +
    '.rc-band h3{color:#fff;font-size:clamp(1.25rem,1rem + 1vw,1.7rem);margin:6px 0 2px}' +
    '.rc-band .when{color:#EAF3FD}' +
    '.rc-fig{display:flex;flex-wrap:wrap;gap:10px 24px;align-items:flex-end;margin-top:14px;position:relative;z-index:1}' +
    '.rc-fig b{font-size:clamp(1.9rem,1.5rem + 1.6vw,2.6rem);line-height:1;color:#fff;font-variant-numeric:tabular-nums}' +
    '.rc-fig span{display:block;font-size:.82rem;color:#EAF3FD}' +
    '.rc-chg{background:rgba(255,255,255,.18);border-radius:99px;padding:4px 12px;font-weight:700;font-size:.88rem}' +
    '.rc-body{padding:18px 20px 20px}' +
    '.rc-prac{background:#FFF7E0;border:1px solid #E8C96A;color:#5A4410;border-radius:12px;padding:10px 12px;margin:0 0 14px;font-size:.92rem}.rc-prac b{color:#3F2F05}' +
    '.rc-track{display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:4px;margin:0 0 16px;list-style:none;padding:0}' +
    '.rc-track li{font-size:.72rem;font-weight:700;color:#6F7F9C;text-align:center;line-height:1.2}' +
    '.rc-track li i{display:block;height:6px;border-radius:99px;background:#E6EDF7;margin-bottom:6px}' +
    '.rc-track li.on{color:#0F7A54}.rc-track li.on i{background:linear-gradient(90deg,#1FA8A0,#0F7A54)}' +
    '.rc-sec{margin:18px 0 0}.rc-sec>h4{font-size:1rem;margin:0 0 8px;display:flex;gap:8px;align-items:center}.rc-sec>h4 svg{color:#3A7BD5}' +
    '.rc-it{display:grid;grid-template-columns:minmax(0,1fr) auto;gap:6px 14px;align-items:center;border:1px solid #E6EDF7;border-radius:14px;padding:10px 12px;margin:0 0 8px}' +
    '.rc-it .lb{font-weight:700;color:#1B2A44;overflow-wrap:anywhere}.rc-it .sm{font-size:.84rem;color:#5E6E8A}' +
    '.rc-it .v{text-align:right;font-weight:800;color:#1B2A44;font-variant-numeric:tabular-nums}' +
    '.rc-it label{grid-column:1/-1;font-size:.84rem;font-weight:700;color:#1B2A44;display:flex;flex-wrap:wrap;gap:6px 10px;align-items:center}' +
    '.rc-it input{font:inherit;font-size:max(16px,1rem);width:min(100%,11rem);min-height:44px;border:1.5px solid #8A99B3;border-radius:10px;padding:8px 10px;color:#1B2A44}' +
    '.rc-hist{display:grid;gap:7px}' +
    '.rc-hb{display:grid;grid-template-columns:3rem minmax(0,1fr) 6.5rem;gap:10px;align-items:center;font-size:.9rem}' +
    '.rc-hb .tr{height:12px;border-radius:6px;background:#E6EDF7;overflow:hidden}.rc-hb .tr i{display:block;height:100%;border-radius:6px;background:linear-gradient(90deg,#3A7BD5,#4C94E6);transform-origin:left}' +
    '.rc-hb.now .tr i{background:linear-gradient(90deg,#1FA8A0,#0F7A54)}' +
    '.rc-hb .v{text-align:right;font-weight:700;color:#1B2A44;font-variant-numeric:tabular-nums}' +
    '@media (prefers-reduced-motion:no-preference){.rc-hb .tr i{animation:rcgrow .9s cubic-bezier(.2,.8,.2,1) both}.rc-track li.on i{animation:rcgrow .7s cubic-bezier(.2,.8,.2,1) both}}' +
    '@keyframes rcgrow{from{transform:scaleX(0)}to{transform:scaleX(1)}}' +
    '.rc-pt{border-left:4px solid #3A7BD5;background:#F3F7FC;border-radius:10px;padding:10px 12px;margin:0 0 8px}.rc-pt b{display:block;color:#1B2A44}' +
    '.rc-q{border-top:1px solid #E6EDF7;margin-top:18px;padding-top:16px}' +
    '.rc-opts{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,11rem),1fr));gap:8px;margin:8px 0 10px}' +
    '.rc-opt{display:flex;gap:10px;align-items:center;border:1.5px solid #B9CCE8;border-radius:14px;padding:12px;min-height:52px;cursor:pointer;font-weight:700;color:#2C5FA8;background:#fff}' +
    '.rc-opt input{width:20px;height:20px;accent-color:#3A7BD5;flex:none}' +
    '.rc-opt:has(input:checked){border-color:#3A7BD5;background:#EAF3FD;box-shadow:0 0 0 3px #CFE0F7}' +
    '.rc textarea,.rc .rc-in{font:inherit;font-size:max(16px,1rem);width:100%;border:1.5px solid #8A99B3;border-radius:10px;padding:10px 12px;color:#1B2A44;min-height:44px}' +
    '.rc textarea{min-height:90px;resize:vertical}' +
    '.rc-l{display:block;font-weight:700;color:#1B2A44;font-size:.92rem;margin:10px 0 5px}' +
    '.rc-go{display:inline-flex;align-items:center;gap:8px;min-height:48px;padding:10px 20px;border:0;border-radius:12px;background:#1FA8A0;color:#fff;font:inherit;font-weight:800;cursor:pointer;margin-top:12px}' +
    '.rc-go:hover{background:#178A83}.rc-go[disabled]{opacity:.55;cursor:not-allowed}' +
    '.rc-go:focus-visible,.rc-opt:focus-within,.rc input:focus-visible,.rc textarea:focus-visible{outline:3px solid #9CC2F2;outline-offset:2px}' +
    '.rc-err{color:#B3261E;font-weight:600;min-height:1.2em;margin-top:8px}' +
    '.rc-ans{background:#E6F7EF;border-radius:14px;padding:12px 14px;color:#0B5A3E;display:flex;gap:10px;align-items:flex-start;margin-top:16px}' +
    '.rc-ans.chg{background:#FFF4DB;color:#5A3A00}' +
    '.rc-cm{font-size:.9rem;border-left:3px solid #DDE6F2;padding:2px 0 2px 10px;margin:6px 0}' +
    '.rc-pay{font-size:.9rem;color:#5E6E8A;margin-top:16px}' +
    '.rc-sum{margin:0 0 10px;font-size:.95rem}.rc-yh{font-weight:800;color:#1B2A44;margin:16px 0 6px}' +
    '.rc-yr{border:1px solid #DDE6F2;border-radius:12px;margin:8px 0;background:#fff}' +
    '.rc-yr>summary{list-style:none;cursor:pointer;padding:10px 34px 10px 12px;display:flex;flex-wrap:wrap;gap:4px 10px;align-items:center;position:relative;min-height:44px}' +
    '.rc-yr>summary::-webkit-details-marker{display:none}' +
    '.rc-yr>summary::after{content:"";position:absolute;right:14px;top:17px;width:8px;height:8px;border-right:2px solid #5E6E8A;border-bottom:2px solid #5E6E8A;transform:rotate(-45deg);transition:transform .15s}' +
    '.rc-yr[open]>summary::after{transform:rotate(45deg)}.rc-yr>summary:focus-visible{outline:3px solid #9CC2F2;outline-offset:2px}' +
    '.rc-yr>summary>b{font-size:1.05rem;color:#1B2A44;min-width:2.8rem}.rc-yr .rc-sm{flex:1 1 11rem}' +
    '.rc-yp{font-weight:800;color:#1B2A44;font-variant-numeric:tabular-nums}.rc-yp .rc-sm{font-weight:600}' +
    '.rc-chips{display:flex;flex-wrap:wrap;gap:4px;flex:1 1 100%}' +
    '.rc-chip{display:inline-block;border-radius:99px;padding:2px 9px;font-size:.78rem;font-weight:700;background:#EEF1F6;color:#5E6E8A}' +
    '.rc-chip.c-ok{background:#E6F7EF;color:#0F7A54}.rc-chip.c-bad{background:#FDECEA;color:#B3261E}.rc-chip.c-warn{background:#FFF4DB;color:#7A4B00}' +
    '.rc-yb{padding:2px 12px 12px;border-top:1px solid #DDE6F2}.rc-yt{font-weight:700;color:#1B2A44;margin:10px 0 4px;font-size:.9rem}' +
    '.rc-yr-it{display:flex;justify-content:space-between;gap:10px;font-size:.92rem;padding:3px 0}.rc-yr-it b{font-variant-numeric:tabular-nums;white-space:nowrap}' +
    '.rc-sm{font-size:.85rem;color:#5E6E8A}' +
    '@media (min-width:700px){.rc-band{padding:24px 26px 22px}.rc-body{padding:22px 26px 24px}}';
  function style() { if (typeof document === 'undefined' || document.getElementById('rc-css')) return; var s = document.createElement('style'); s.id = 'rc-css'; s.textContent = CSS; document.head.appendChild(s); }
  function summaryLine(v) {
    var S = v.summary; if (!S || !S.terms) return '';
    return '<p class="rc-sum">' + S.terms + ' year' + (S.terms === 1 ? '' : 's') + ' with us' + (S.claims ? ', ' + S.claims + ' claim' + (S.claims === 1 ? '' : 's') + ' in that time, ' + S.clean + ' year' + (S.clean === 1 ? '' : 's') + ' without one.' : ', and not one claim in that time.') + '</p>';
  }
  /* one year of the client's own history: the term, what it covered, what was billed and paid, and any claim. Never a task or a note. */
  function yearFold(y, i) {
    var chips = [];
    if (y.hasBill) chips.push(y.owed > 1 ? '<span class="rc-chip c-bad">' + money(y.owed) + ' still owed</span>' : y.paid ? '<span class="rc-chip c-ok">Paid' + (y.paidOn ? ' ' + esc(dmy(y.paidOn)) : '') + '</span>' : '<span class="rc-chip">No payment on our records</span>');
    chips.push((y.claims || []).length ? '<span class="rc-chip c-warn">' + y.claims.length + ' claim' + (y.claims.length === 1 ? '' : 's') + '</span>' : '<span class="rc-chip">No claims</span>');
    var body = ((y.risks || []).length ? '<p class="rc-yt">What it covered</p>' + y.risks.map(function (k) { return '<div class="rc-yr-it"><span>' + esc(k.label) + '</span><b>' + (k.value ? whole(k.value) : '') + '</b></div>'; }).join('') + (y.more ? '<p class="rc-sm">and ' + y.more + ' more</p>' : '') : '') +
      (y.hasBill ? '<p class="rc-yt">Billed and paid</p><div class="rc-yr-it"><span>Billed</span><b>' + money(y.billed) + '</b></div><div class="rc-yr-it"><span>Paid' + (y.paidOn ? ', first on ' + esc(dmy(y.paidOn)) : '') + '</span><b>' + money(y.paid) + '</b></div>' + (y.owed > 1 ? '<div class="rc-yr-it"><span>Still owed</span><b>' + money(y.owed) + '</b></div>' : '') : '') +
      ((y.claims || []).length ? '<p class="rc-yt">Claims</p><ul style="margin:0;padding-left:20px">' + y.claims.map(function (c) { return '<li>' + esc(dmy(c.on)) + ' · ' + esc(c.type) + (c.status ? ' · ' + esc(c.status) : '') + '</li>'; }).join('') + '</ul>' : '');
    return '<details class="rc-yr"' + (i === 0 ? ' open' : '') + '><summary><b>' + esc(y.year) + '</b><span class="rc-sm">' + esc(dmy(y.from)) + ' to ' + esc(dmy(y.to)) + ((y.policies || []).length ? ' · policy ' + esc(y.policies.join(', ')) : '') + '</span>' +
      '<span class="rc-yp">' + money(y.premium) + (y.change !== null && y.change !== undefined ? ' <span class="rc-sm">' + (y.change > 0 ? '+' : '') + y.change + '%</span>' : '') + '</span><span class="rc-chips">' + chips.join(' ') + '</span></summary><div class="rc-yb">' + body + '</div></details>';
  }
  function html(v, o) {
    o = o || {};
    style();
    var today = o.today || new Date().toISOString().slice(0, 10), d = v.ren ? days(today, v.ren) : null;
    var change = v.total && v.lastPremium ? Math.round((v.total - v.lastPremium) / v.lastPremium * 1000) / 10 : null;
    var icon = /motor/i.test(v.line) ? ICON.car : /home|property/i.test(v.line) ? ICON.home : ICON.shield;
    var years = (v.years || []).slice();
    if (v.total) years.push({ year: (v.from || v.ren || '').slice(0, 4) + ' renewal', premium: v.total, now: true });
    var max = Math.max.apply(null, [1].concat(years.map(function (y) { return y.premium || 0; })));
    var a = v.answer, open = v.open;
    var h = '<article class="rc" id="rc-' + esc(v.key) + '" data-key="' + esc(v.key) + '">' +
      '<div class="rc-band"><div class="k">' + icon + esc(v.line) + ' · policy ' + esc(v.policy) + '</div><h3>Your renewal on ' + esc(dmy(v.ren)) + '</h3>' +
      '<div class="when">' + (d === null ? '' : d > 0 ? 'In ' + d + ' day' + (d === 1 ? '' : 's') : d === 0 ? 'Today' : Math.abs(d) + ' days ago') + (v.from ? ' · cover ' + esc(dmy(v.from)) + ' to ' + esc(dmy(v.to)) : '') + '</div>' +
      (v.total ? '<div class="rc-fig"><div><b>' + money(v.total) + '</b><span>this year, tax included</span></div>' + (v.lastPremium ? '<div><span>last year ' + money(v.lastPremium) + '</span>' + (change !== null ? '<span class="rc-chg">' + (change > 0 ? 'up ' : change < 0 ? 'down ' : '') + Math.abs(change) + '%</span>' : '') + '</div>' : '') + '</div>' : '') + '</div>' +
      '<div class="rc-body">' + (v.practice ? '<p class="rc-prac"><b>Practice letter.</b> Sent while the renewal desk is in test mode, to the team only. Your answer stays on the desk: nothing goes to Guardian General or Salesforce.</p>' : '') + '<ol class="rc-track" aria-label="Where your renewal stands">' + (v.steps || []).map(function (s) { return '<li class="' + (s.done ? 'on' : '') + '"><i></i>' + esc(s.label) + '</li>'; }).join('') + '</ol>' +
      (v.opening ? '<p style="margin:0">' + esc(v.opening) + '</p>' : '') +
      '<div class="rc-sec"><h4>' + ICON.doc + 'What renews</h4>' + (v.items || []).map(function (x) {
        var nv = a && a.values && a.values[x.id];
        return '<div class="rc-it"><div><div class="lb">' + esc(x.label) + '</div>' + (x.bank ? '<div class="sm">A copy of the certificate goes to ' + esc(x.bank) + '</div>' : '') + (x.lastValue && x.value && x.lastValue !== x.value ? '<div class="sm">Last year ' + whole(x.lastValue) + '</div>' : '') + '</div>' +
          '<div class="v">' + (x.value ? whole(nv || x.value) : '') + '</div>' +
          (open && x.value ? '<label>' + (x.kind === 'vehicle' ? 'If the vehicle\'s value is different, type it' : 'If the sum insured should change, type it') + ' <input inputmode="decimal" data-rcv="' + esc(x.id) + '" placeholder="' + esc(String(Math.round(x.value))) + '" value="' + (nv ? Math.round(nv) : '') + '" aria-label="New value for ' + esc(x.label) + '"></label>' : '') + '</div>';
      }).join('') + '</div>' +
      (years.length ? '<div class="rc-sec"><h4>' + ICON.shield + 'Your history with us since ' + esc((v.since || years[0].year || '').slice(0, 4)) + '</h4>' + summaryLine(v) + '<div class="rc-hist">' + years.map(function (y) {
        return '<div class="rc-hb' + (y.now ? ' now' : '') + '"><b>' + esc(String(y.year).slice(0, 4)) + '</b><div class="tr"><i style="width:' + Math.max(3, Math.round((y.premium || 0) / max * 100)) + '%"></i></div><div class="v">' + money(y.premium) + '</div></div>'; }).join('') + '</div>' +
        ((v.years || []).some(function (y) { return y.risks; }) ? '<p class="rc-yh">Every year in full</p>' + v.years.slice().reverse().map(yearFold).join('') : '') +
        (v.since ? '<p style="margin:10px 0 0;font-size:.9rem">With us since ' + esc(dmy(v.since)) + '. Thank you.</p>' : '') + '</div>' : '') +
      '<div class="rc-sec"><h4>' + ICON.check + 'Every claim on our records</h4>' + ((v.claims || []).length ? '<ul style="margin:0;padding-left:20px">' + v.claims.map(function (c) { return '<li>' + esc(dmy(c.on)) + ' · ' + esc(c.type) + (c.status ? ' · ' + esc(c.status) : '') + '</li>'; }).join('') + '</ul>' : '<p style="margin:0">None on our records.</p>') + '</div>' +
      ((v.points || []).length ? '<div class="rc-sec"><h4>' + ICON.doc + 'Worth a look before you approve</h4>' + v.points.map(function (p) { return '<div class="rc-pt"><b>' + esc(p.title) + '</b>' + esc(p.text) + '</div>'; }).join('') + '</div>' : '') +
      ((v.reqs || []).length ? '<div class="rc-sec"><h4>' + ICON.doc + 'Guardian General needs these with your renewal</h4><ul style="margin:0;padding-left:20px">' + v.reqs.map(function (q) { return '<li>' + esc(q) + '</li>'; }).join('') + '</ul></div>' : '') +
      (a && a.decision ? '<div class="rc-ans' + (a.decision === 'changes' ? ' chg' : '') + '">' + ICON.check + '<div><b>' + (a.decision === 'approve' ? 'You approved your renewal' : 'You asked for changes') + '</b> · ' + esc(a.at) + (a.name ? ' · ' + esc(a.name) : '') + '<br>' + esc(v.stageLabel || '') + '</div></div>' : '') +
      ((v.comments || []).length ? '<div class="rc-sec"><h4>What you told us</h4>' + v.comments.map(function (c) { return '<div class="rc-cm"><b>' + esc(c.at || '') + '</b>' + (c.name ? ' · ' + esc(c.name) : '') + '<br>' + esc(c.text || '') + '</div>'; }).join('') + '</div>' : '') +
      (open ? '<form class="rc-q" data-rcform="' + esc(v.key) + '"><h4 style="font-size:1.08rem">Your answer</h4><p style="margin:4px 0 0;font-size:.92rem">Nothing is renewed until you say yes. ' + esc(v.holder ? v.holder + ' reads every answer.' : 'A person reads every answer.') + '</p>' +
        '<div class="rc-opts" role="radiogroup" aria-label="Your answer">' +
        '<label class="rc-opt"><input type="radio" name="d-' + esc(v.key) + '" value="approve"' + (a && a.decision === 'approve' ? ' checked' : '') + '>Yes, renew it</label>' +
        '<label class="rc-opt"><input type="radio" name="d-' + esc(v.key) + '" value="changes"' + (a && a.decision === 'changes' ? ' checked' : '') + '>Something has changed</label>' +
        '<label class="rc-opt"><input type="radio" name="d-' + esc(v.key) + '" value="question">I have a question</label></div>' +
        '<label class="rc-l" for="c-' + esc(v.key) + '">Anything to tell us (needed for a change or a question)</label><textarea id="c-' + esc(v.key) + '" data-rcc></textarea>' +
        (o.group ? '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,12rem),1fr));gap:0 12px"><div><label class="rc-l" for="n-' + esc(v.key) + '">Your name</label><input class="rc-in" id="n-' + esc(v.key) + '" data-rcn autocomplete="name"></div><div><label class="rc-l" for="r-' + esc(v.key) + '">Your role</label><input class="rc-in" id="r-' + esc(v.key) + '" data-rcr autocomplete="organization-title"></div></div>' : '') +
        '<button class="rc-go" type="submit">' + ICON.check + 'Send my answer</button><div class="rc-err" role="alert"></div></form>' : '') +
      '<p class="rc-pay"><b>Ways to pay</b> once it is renewed: at the branch (card, Linx, cash, cheque), card by phone, online bank transfer, or Solis Credit financing. Questions: the branch on (868) 226-6461, 226-6464 or 226-6465.</p>' +
      '</div></article>';
    return h;
  }
  function bind(rootEl, send) {
    (rootEl || document).querySelectorAll('form[data-rcform]').forEach(function (f) {
      f.addEventListener('submit', function (e) {
        e.preventDefault();
        var key = f.getAttribute('data-rcform'), card = f.closest('.rc'), err = f.querySelector('.rc-err'), btn = f.querySelector('.rc-go');
        var pick = f.querySelector('input[type=radio]:checked');
        err.textContent = '';
        if (!pick) { err.textContent = 'Choose yes, a change or a question.'; return; }
        var body = { key: key, decision: pick.value, comment: (f.querySelector('[data-rcc]').value || '').trim(), values: {} };
        if (body.decision !== 'approve' && body.comment.length < 3) { err.textContent = body.decision === 'changes' ? 'Tell us what has changed.' : 'Write your question.'; return; }
        card.querySelectorAll('[data-rcv]').forEach(function (i) { var n = Number(String(i.value).replace(/[^0-9.]/g, '')); if (n > 0) body.values[i.getAttribute('data-rcv')] = n; });
        var nm = f.querySelector('[data-rcn]'), rl = f.querySelector('[data-rcr]');
        if (nm) { body.name = nm.value.trim(); body.role = rl ? rl.value.trim() : ''; if (body.name.length < 2) { err.textContent = 'Give your name, so we know who answered.'; return; } }
        btn.disabled = true; btn.lastChild.textContent = 'Sending…';
        Promise.resolve(send(key, body)).then(function (r) {
          if (!r || !r.ok) { err.textContent = (r && r.error) || 'Not sent. Please try again.'; btn.disabled = false; btn.lastChild.textContent = 'Send my answer'; return; }
        }, function () { err.textContent = 'Not sent. Please try again.'; btn.disabled = false; btn.lastChild.textContent = 'Send my answer'; });
      });
    });
  }
  var api = { html: html, bind: bind, dmy: dmy, money: money };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.RenewalCard = api;
})(typeof window !== 'undefined' ? window : this);
