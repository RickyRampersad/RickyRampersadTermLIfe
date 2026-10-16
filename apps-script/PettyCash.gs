/**
 * PettyCash.gs — the branch's petty cash: the float each person holds, what
 * was spent from it and on what, what topped it up, and whether the cash in
 * hand agrees with the book.
 *
 * Asked for on 15 October 2026: "build now the petty cash management and add
 * many other fields and categorize … this was a Jotform now being built in
 * the RR Operations", then "deep research and build a proper petty cash
 * management system with deep analytics and weekly reporting".
 *
 * What the Jotform book showed (eleven entries, August to October 2026):
 *   - spends had no category, so branch spend and the branch manager's own
 *     errands (a teacher paid, household supplies) sat in one column;
 *   - the "balance at hand" typed at each top-up never matched the entries
 *     before it: between two top-ups the cash fell by far more than the
 *     spends logged, and nothing said so;
 *   - two spends had no receipt and no reason, and "Request Amount" was
 *     never used.
 *
 * ── THE MODEL: AN IMPREST FLOAT ──────────────────────────────────────────
 * The standard control for petty cash (state controller and audit guidance
 * on imprest funds): each person who holds cash holds a fixed float. At any
 * moment the cash in hand plus the receipts since the last top-up equal the
 * float. A top-up is a replenishment: the holder counts the cash first, the
 * count is compared with what the book says should be there, and the top-up
 * brings it back to the float. Management counts by surprise too. So:
 *   - every entry is one of five types: spent, received, request, count,
 *     returned;
 *   - the book keeps a running balance per holder; a count (on its own or
 *     before a top-up) resets it to the cash actually there, and the
 *     difference is recorded as a shortage or a surplus, never lost;
 *   - a spend paid from the holder's own pocket is not taken from the float;
 *     it is owed back to them, and a "repayment" top-up clears it;
 *   - a spend over the limit, and every request, waits for a reviewer;
 *   - nothing is edited: a reviewer marks an entry reviewed, queries it (the
 *     holder answers in the app) or voids it with a reason.
 *
 * ── RED FLAGS THE ANALYTICS LOOK FOR ─────────────────────────────────────
 *   split purchases (one vendor, one day, each under the limit, together
 *   over it); no receipt; logged days after the spend; a round amount with no
 *   receipt; the float going below zero (a top-up or an own-money spend not
 *   recorded); a shortage at a count; a count overdue; a receipt number used
 *   twice; spends on a weekend. Facts only: a flag asks a question, it does
 *   not answer it.
 *
 * ── WHERE IT LIVES ───────────────────────────────────────────────────────
 * The same RR Operations Apps Script project as DeliveryBook.gs, which owns
 * the sign-in, the Access tab and doPost; every action here is "pc.*" and is
 * refused to anyone whose Access row does not carry petty-cash. The ledger is
 * kept in the Petty Cash Transactions Google Sheet beside the Jotform's own
 * "Form responses" tab, opened by the PC_SHEET_ID Script property (set from
 * the menu: "Petty cash: connect the Petty Cash sheet"). Without it, the
 * ledger goes in the bound sheet.
 *
 * ── SCRIPT PROPERTIES (all optional) ─────────────────────────────────────
 *   PC_SHEET_ID      the Petty Cash Transactions sheet (never in this file:
 *                    the repository is public)
 *   PC_FLOAT         the float each holder is kept at, TT$ (default 500)
 *   PC_SPEND_LIMIT   a spend above this waits for a reviewer (default 300)
 *   PC_VARIANCE      a count this far off is flagged, TT$ (default 5)
 *   PC_COUNT_DAYS    a float not counted in this many days is overdue (14)
 *   PC_REVIEWERS     names who review besides any "Manager" role, comma-
 *                    separated (e.g. the branch management assistant)
 *   PC_ALERT_TO      extra addresses for alerts and the weekly report
 *   PC_VEHICLES      the branch vehicles, comma-separated, offered as a list
 *   PC_FOLDER_ID     made on first use: the Drive folder for receipts
 *
 * Nothing here is client data, and nothing identifying may be added: the
 * repository is public.
 */

var PC = {
  TABS: { LEDGER: 'Petty Cash Ledger', OLD: 'Form responses', WEEKLY: 'Petty Cash Weekly' },
  TYPES: { spend: 'Cash spent', topup: 'Cash received', request: 'Cash request', count: 'Cash count', 'return': 'Cash returned' },

  /* The categories, each with the words that suggest it. The page suggests a
     category from what is typed; the import guesses one and says it guessed. */
  CATEGORIES: [
    { name: 'Office supplies', subs: ['Stationery & printing', 'Cleaning supplies', 'Furnishings & decor', 'Small equipment', 'Kitchen supplies'],
      words: ['paper', 'ink', 'toner', 'pen', 'stationery', 'print', 'file', 'folder', 'stapler', 'cleaning', 'bucket', 'mop',
              'detergent', 'bleach', 'garbage', 'bags', 'cloth', 'curtain', 'decor', 'kitchen', 'cups', 'plates', 'batteries'] },
    { name: 'Refreshments & meals', subs: ['Staff meals', 'Meeting refreshments', 'Client hospitality', 'Water & drinks'],
      words: ['doubles', 'lunch', 'breakfast', 'food', 'meal', 'snack', 'drinks', 'water', 'coffee', 'tea', 'juice', 'roti', 'cake', 'pizza'] },
    { name: 'Vehicle', subs: ['Repairs & parts', 'Fuel', 'Car wash', 'Parking & tolls', 'Licence & inspection', 'Tyres'],
      words: ['car', 'vehicle', 'rover', 'tyre', 'tire', 'mechanic', 'parts', 'oil', 'battery', 'wash', 'parking', 'inspection',
              'glue', 'wiper', 'fuel', 'gas', 'diesel'] },
    { name: 'Courier & transport', subs: ['Courier', 'Postage', 'Taxi & maxi', 'Delivery'],
      words: ['courier', 'post', 'postage', 'stamp', 'taxi', 'maxi', 'fare', 'delivery', 'shipping'] },
    { name: 'Client service', subs: ['Client gifts', 'Condolence & celebration', 'Document fees'],
      words: ['client', 'gift', 'wreath', 'flowers', 'condolence', 'hamper', 'certified copy'] },
    { name: 'Branch events & meetings', subs: ['Venue & decor', 'Prizes & recognition', 'Event supplies'],
      words: ['event', 'meeting', 'blast off', 'prize', 'trophy', 'award', 'banner', 'balloons', 'venue'] },
    { name: 'Repairs & maintenance', subs: ['Building', 'Electrical & plumbing', 'IT & phones', 'Air conditioning'],
      words: ['repair', 'plumber', 'electrician', 'bulb', 'ac', 'air condition', 'lock', 'key', 'phone repair', 'cable', 'charger'] },
    { name: 'Phone & internet', subs: ['Phone credit', 'Internet', 'Subscriptions'],
      words: ['credit', 'top up', 'topup', 'digicel', 'bmobile', 'internet', 'data plan', 'subscription'] },
    { name: 'Fees & government', subs: ['Stamp duty & licences', 'Bank charges', 'Government fees'],
      words: ['stamp duty', 'licence', 'license', 'bank charge', 'ministry', 'registry', 'board of inland revenue', 'fee'] },
    { name: 'Personal (Branch Manager)', subs: ['Household', 'School & tuition', 'Personal errands'],
      words: ['household', 'home', 'house', 'teacher', 'tuition', 'school', 'personal', 'mrs'] },
    { name: 'Other', subs: [], words: [] },
  ],
  PERSONAL: 'Personal (Branch Manager)',
  CHARGED: ['Branch', 'Branch Manager (personal)', 'Recover from someone'],
  PAYMENT: ['From the float', 'Own money (to be repaid)'],
  METHODS: ['Cash', 'Bank transfer', 'Cheque'],
  FOR: ['Float top-up', 'Repayment of own money'],
  NO_RECEIPT: ['Vendor gave none', 'Street vendor', 'Receipt lost', 'Paid to a person', 'Other'],
  DENOMS: [100, 50, 20, 10, 5, 1, 0.25, 0.1, 0.05, 0.01],
  MAX_PHOTO_KB: 6000,
  BACKDATE_DAYS: 45,     // staff may record a spend this far back; a reviewer any date
  LATE_DAYS: 2,          // logged more than this after the spend: flagged
  MAX_AMOUNT: 20000,
};

var PC_COLUMNS = [
  'Reference', 'Type', 'When', 'Logged At', 'Entered By', 'Held By', 'Amount',
  'Category', 'Subcategory', 'Charged To', 'Recover From', 'Paid To', 'Purpose', 'Vehicle', 'Odometer', 'Client / Policy',
  'Payment', 'Receipt #', 'Receipt', 'No Receipt Reason',
  'Received From', 'Method', 'For', 'Counted', 'Expected', 'Variance', 'Denominations',
  'Request Ref', 'Needed By', 'Status', 'Approved By', 'Approved At',
  'Review', 'Review Note', 'Reviewed By', 'Reviewed At', 'Answer', 'Flags', 'Source', 'Notes',
];

var PC_WEEKLY_COLUMNS = ['Week', 'Sent At', 'To', 'Spent', 'Branch', 'Personal', 'Received', 'Shortages', 'Flags', 'Status'];


/* ============================== settings ============================== */

function pcNum_(k, d) { var v = Number(dbProp_(k, '')); return isFinite(v) && v > 0 ? v : d; }
function pcFloat_() { return pcNum_('PC_FLOAT', 500); }
function pcLimit_() { return pcNum_('PC_SPEND_LIMIT', 300); }
function pcVarLimit_() { return pcNum_('PC_VARIANCE', 5); }
function pcCountDays_() { return pcNum_('PC_COUNT_DAYS', 14); }
function pcRound_(n) { return Math.round((Number(n) || 0) * 100) / 100; }
function pcName_(s) { return String(s || '').trim().toLowerCase().replace(/\s+/g, ' '); }
function pcMoney_(n) {
  var v = pcRound_(n), neg = v < 0; v = Math.abs(v);
  var s = v.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return (neg ? '-' : '') + 'TT$' + s;
}

function pcSS_() {
  var id = dbProp_('PC_SHEET_ID');
  if (id) { try { return SpreadsheetApp.openById(id); } catch (e) { Logger.log('PC_SHEET_ID: ' + e); } }
  return SpreadsheetApp.getActive();
}

function pcSheet_(name, headers) {
  var ss = pcSS_();
  var sh = ss.getSheetByName(name);
  if (!sh) { sh = ss.insertSheet(name); sh.appendRow(headers); sh.setFrozenRows(1); }
  var hm = dbHeaderMap_(sh);
  var missing = headers.filter(function (c) { return !(c in hm.map); });
  if (missing.length) sh.getRange(1, hm.head.length + 1, 1, missing.length).setValues([missing]);
  return sh;
}

function pcLedgerTab_() { return pcSheet_(PC.TABS.LEDGER, PC_COLUMNS); }

function pcTypeKey_(label) {
  var l = String(label || '').toLowerCase();
  for (var k in PC.TYPES) if (PC.TYPES[k].toLowerCase() === l || k === l) return k;
  if (/recie?ved/.test(l)) return 'topup';
  if (/spent|spend/.test(l)) return 'spend';
  if (/request/.test(l)) return 'request';
  if (/count/.test(l)) return 'count';
  if (/return/.test(l)) return 'return';
  return '';
}

/* Who is on the Access tab with petty cash, and who reviews. */
function pcPeople_() {
  var sh = dbSheet_(DB.TABS.ACCESS, DB_ACCESS_COLUMNS);
  var hm = dbHeaderMap_(sh);
  var last = sh.getLastRow();
  var rows = last > 1 ? sh.getRange(2, 1, last - 1, hm.head.length).getValues() : [];
  var extra = String(dbProp_('PC_REVIEWERS', '')).split(',').map(pcName_).filter(String);
  return rows.map(function (r) {
    var g = function (k) { return k in hm.map ? r[hm.map[k]] : ''; };
    var active = String(g('Active') === '' ? 'yes' : g('Active')).trim().toLowerCase();
    var name = String(g('Name') || '').trim();
    var role = String(g('Role') || 'Staff').trim();
    var apps = opsAppsFor_(g('Apps'));
    return {
      name: name, email: String(g('Email') || '').trim(), role: role,
      active: active !== 'no' && active !== 'false',
      cash: apps.some(function (a) { return a.id === 'petty-cash'; }),
      reviewer: /manager/i.test(role) || extra.indexOf(pcName_(name)) >= 0,
    };
  }).filter(function (p) { return p.name && p.active; });
}

function pcIsReviewer_(who, people) {
  if (/manager/i.test(who.role)) return true;
  var extra = String(dbProp_('PC_REVIEWERS', '')).split(',').map(pcName_).filter(String);
  return extra.indexOf(pcName_(who.name)) >= 0;
}

/* A name as written on the Jotform ("Pawan Probho") to the Access tab's
   ("Pawan Probhu"): exact, else the one active person with that first name. */
function pcMatchPerson_(name, people) {
  var n = pcName_(name);
  if (!n) return '';
  var exact = people.filter(function (p) { return pcName_(p.name) === n; })[0];
  if (exact) return exact.name;
  var first = n.split(' ')[0];
  var hits = people.filter(function (p) { return pcName_(p.name).split(' ')[0] === first; });
  return hits.length === 1 ? hits[0].name : String(name).trim();
}

function pcGuessCategory_(text) {
  var t = ' ' + String(text || '').toLowerCase().replace(/[^a-z0-9& ]/g, ' ') + ' ';
  var best = null, score = 0;
  PC.CATEGORIES.forEach(function (c) {
    var s = 0;
    c.words.forEach(function (w) { if (t.indexOf(' ' + w + ' ') >= 0 || (w.length > 4 && t.indexOf(' ' + w) >= 0)) s += w.length > 4 ? 2 : 1; });
    // A personal marker outweighs the thing bought: a mop for the house is household.
    if (c.name === PC.PERSONAL && s) s += 3;
    if (s > score) { score = s; best = c.name; }
  });
  return best || 'Other';
}


/* ============================== routing ============================== */

/* Called from doPost in DeliveryBook.gs for every "pc.*" action, after the
   session and the petty-cash access have been checked there. */
function pcRoute_(b, who) {
  var people = pcPeople_();
  who.reviewer = pcIsReviewer_(who, people);
  switch (b.action) {
    case 'pc.init':   return pcInit_(who, people);
    case 'pc.submit': return pcSubmit_(b, who, people);
    case 'pc.ledger': return pcLedger_(b, who, people);
    case 'pc.review': return pcReview_(b, who, people);
    case 'pc.answer': return pcAnswer_(b, who, people);
    default:          return { ok: false, error: 'Unknown action' };
  }
}

function pcInit_(who, people) {
  var rows = pcRows_();
  var vendors = {}, vehicles = {};
  String(dbProp_('PC_VEHICLES', '')).split(',').forEach(function (v) { v = v.trim(); if (v) vehicles[v] = 1; });
  rows.forEach(function (r) {
    if (r['Paid To']) vendors[String(r['Paid To']).trim()] = 1;
    if (r['Vehicle']) vehicles[String(r['Vehicle']).trim()] = 1;
  });
  return {
    ok: true, mode: dbMode_(),
    me: { name: who.name, role: who.role, reviewer: who.reviewer },
    types: PC.TYPES, categories: PC.CATEGORIES, personal: PC.PERSONAL, charged: PC.CHARGED, payment: PC.PAYMENT,
    methods: PC.METHODS, forWhat: PC.FOR, noReceipt: PC.NO_RECEIPT, denoms: PC.DENOMS,
    float: pcFloat_(), limit: pcLimit_(), variance: pcVarLimit_(), countDays: pcCountDays_(), lateDays: PC.LATE_DAYS,
    holders: people.filter(function (p) { return p.cash; }).map(function (p) { return p.name; }),
    givers: people.filter(function (p) { return p.reviewer; }).map(function (p) { return p.name; }),
    vendors: Object.keys(vendors).sort().slice(0, 200), vehicles: Object.keys(vehicles).sort(),
  };
}


/* ============================== reading the ledger ============================== */

function pcRows_() {
  var sh = pcLedgerTab_();
  var hm = dbHeaderMap_(sh);
  var last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, hm.head.length).getValues().map(function (r, i) {
    var o = { _row: i + 2, _i: i };
    PC_COLUMNS.forEach(function (c) { o[c] = c in hm.map ? r[hm.map[c]] : ''; });
    return o;
  });
}

function pcDate_(v) {
  if (v instanceof Date) return v;
  if (v === '' || v == null) return null;
  var d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

function pcNumOrNull_(v) { return v === '' || v == null || !isFinite(Number(v)) ? null : Number(v); }

/**
 * The running balance, per holder, in the order things happened. Adds to
 * each row: _before, _after, _var (a count's shortage or surplus), _owed (own
 * money owed back after it), _flags (what the analytics see). Void rows are
 * kept out of the arithmetic and keep their place in the list.
 */
function pcCompute_(rows, now) {
  now = now || new Date();
  var limit = pcLimit_(), vlim = pcVarLimit_();
  var live = rows.filter(function (r) { return String(r.Status) !== 'Void'; });
  live.forEach(function (r) { r._when = pcDate_(r.When) || pcDate_(r['Logged At']) || now; r._logged = pcDate_(r['Logged At']) || r._when; });
  live.sort(function (a, b) {
    return a._when - b._when || a._logged - b._logged || a._i - b._i;
  });
  var st = {};
  var receipts = {};
  live.forEach(function (r) {
    var key = pcName_(r['Held By']);
    var s = st[key] || (st[key] = { holder: String(r['Held By']).trim(), bal: 0, owed: 0, started: false,
      shortage: 0, surplus: 0, lastCount: null, lastActivity: null, sinceTopup: 0 });
    var t = pcTypeKey_(r.Type), amt = pcRound_(r.Amount), counted = pcNumOrNull_(r.Counted);
    /* Only the flags written at import stay from the sheet; the rest are
       worked out again every time, so a top-up recorded late clears a
       "below zero" it explains. */
    var flags = String(r.Flags || '').split(';').map(function (x) { return x.trim(); })
      .filter(function (f) { return /imported|guessed/i.test(f); });
    r._t = t; r._before = pcRound_(s.bal); r._var = null;
    if (t === 'spend') {
      if (/own/i.test(r.Payment)) s.owed = pcRound_(s.owed + amt);
      else s.bal = pcRound_(s.bal - amt);
      s.sinceTopup = pcRound_(s.sinceTopup + amt);
      if (!/own/i.test(r.Payment) && s.bal < -0.004) flags.push('Float below zero after this');
      if (!r.Receipt && !r['Receipt #']) flags.push('No receipt');
      if (amt > limit) flags.push('Over the ' + pcMoney_(limit) + ' limit');
      if (amt >= 50 && amt % 50 === 0 && !r.Receipt) flags.push('Round amount, no receipt');
      if (r._logged - r._when > PC.LATE_DAYS * 86400000 + 3600000) flags.push('Logged ' + Math.round((r._logged - r._when) / 86400000) + ' days after');
      var dow = r._when.getDay();
      if (dow === 0 || dow === 6) flags.push('Weekend');
      var rk = String(r['Receipt #'] || '').trim().toUpperCase();
      if (rk) {
        var vk = rk + '|' + pcName_(r['Paid To']);
        if (receipts[vk]) flags.push('Receipt # also on ' + receipts[vk]);
        else receipts[vk] = r.Reference;
      }
    } else if (t === 'topup') {
      if (/repay/i.test(r.For)) {
        s.owed = pcRound_(Math.max(0, s.owed - amt));
      } else {
        if (counted != null) {
          if (s.started) {
            r._var = pcRound_(counted - s.bal);
            if (r._var < 0) s.shortage = pcRound_(s.shortage - r._var); else s.surplus = pcRound_(s.surplus + r._var);
          }
          s.bal = pcRound_(counted);
          s.lastCount = { when: r._when, counted: counted, variance: r._var, ref: r.Reference };
        }
        s.bal = pcRound_(s.bal + amt);
        s.sinceTopup = 0;
      }
    } else if (t === 'count') {
      if (counted != null) {
        if (s.started) {
          r._var = pcRound_(counted - s.bal);
          if (r._var < 0) s.shortage = pcRound_(s.shortage - r._var); else s.surplus = pcRound_(s.surplus + r._var);
        }
        s.bal = pcRound_(counted);
        s.lastCount = { when: r._when, counted: counted, variance: r._var, ref: r.Reference };
      }
    } else if (t === 'return') {
      s.bal = pcRound_(s.bal - amt);
    }
    if (r._var != null && Math.abs(r._var) >= vlim) flags.push(r._var < 0 ? 'Short ' + pcMoney_(-r._var) + ' at the count' : 'Over ' + pcMoney_(r._var) + ' at the count');
    if (t !== 'request') s.started = true;
    s.lastActivity = r._when;
    r._after = pcRound_(s.bal); r._owed = pcRound_(s.owed);
    r._flags = flags.filter(function (f, i, a) { return a.indexOf(f) === i; });
  });

  /* Split purchases: one holder, one vendor, one day, every spend under the
     limit and together over it. */
  var byDay = {};
  live.forEach(function (r) {
    if (r._t !== 'spend' || !r['Paid To']) return;
    var k = pcName_(r['Held By']) + '|' + pcName_(r['Paid To']) + '|' + Utilities.formatDate(r._when, dbTz_(), 'yyyy-MM-dd');
    (byDay[k] = byDay[k] || []).push(r);
  });
  Object.keys(byDay).forEach(function (k) {
    var g = byDay[k];
    if (g.length < 2) return;
    var sum = g.reduce(function (a, r) { return a + pcRound_(r.Amount); }, 0);
    if (sum > limit && g.every(function (r) { return pcRound_(r.Amount) <= limit; })) {
      g.forEach(function (r) { r._flags.push('Possible split: ' + g.length + ' spends at one vendor that day, ' + pcMoney_(sum) + ' together'); });
    }
  });

  rows.forEach(function (r) {
    if (String(r.Status) === 'Void') { r._t = pcTypeKey_(r.Type); r._when = pcDate_(r.When) || now; r._flags = ['Void']; }
  });

  var float = pcFloat_(), cd = pcCountDays_();
  var floats = Object.keys(st).map(function (k) {
    var s = st[k];
    var days = s.lastCount ? Math.floor((now - s.lastCount.when) / 86400000) : null;
    return {
      holder: s.holder, balance: s.bal, owed: s.owed, float: float,
      topUp: pcRound_(Math.max(0, float - s.bal)),            // what brings it back to the float
      receiptsSinceTopup: s.sinceTopup,
      shortage: s.shortage, surplus: s.surplus,
      lastCount: s.lastCount ? { when: s.lastCount.when.toISOString(), counted: s.lastCount.counted, variance: s.lastCount.variance, ref: s.lastCount.ref } : null,
      daysSinceCount: days, countOverdue: days == null || days > cd,
      lastActivity: s.lastActivity ? s.lastActivity.toISOString() : '',
    };
  });
  return { rows: rows, floats: floats };
}

/* One row as the page sees it. The receipt link is for a reviewer and for
   the person whose float it is. */
function pcOut_(r, who) {
  var mine = pcName_(r['Held By']) === pcName_(who.name) || pcName_(r['Entered By']) === pcName_(who.name);
  var iso = function (v) { var d = pcDate_(v); return d ? d.toISOString() : ''; };
  return {
    ref: String(r.Reference), type: r._t || pcTypeKey_(r.Type), when: iso(r._when || r.When), logged: iso(r['Logged At']),
    by: String(r['Entered By'] || ''), holder: String(r['Held By'] || ''), amount: pcRound_(r.Amount),
    cat: String(r.Category || ''), sub: String(r.Subcategory || ''), charged: String(r['Charged To'] || ''),
    recover: String(r['Recover From'] || ''), paidTo: String(r['Paid To'] || ''), purpose: String(r.Purpose || ''),
    vehicle: String(r.Vehicle || ''), odometer: String(r.Odometer || ''), client: String(r['Client / Policy'] || ''),
    payment: String(r.Payment || ''), receiptNo: String(r['Receipt #'] || ''),
    receipt: (who.reviewer || mine) ? String(r.Receipt || '') : '', hasReceipt: !!r.Receipt,
    noReceipt: String(r['No Receipt Reason'] || ''), from: String(r['Received From'] || ''), method: String(r.Method || ''),
    forWhat: String(r.For || ''), counted: pcNumOrNull_(r.Counted), denoms: String(r.Denominations || ''),
    requestRef: String(r['Request Ref'] || ''), neededBy: iso(r['Needed By']),
    status: String(r.Status || ''), approvedBy: String(r['Approved By'] || ''),
    review: String(r.Review || ''), reviewNote: String(r['Review Note'] || ''), reviewedBy: String(r['Reviewed By'] || ''),
    answer: String(r.Answer || ''), source: String(r.Source || ''), notes: String(r.Notes || ''),
    before: r._before == null ? null : r._before, after: r._after == null ? null : r._after,
    variance: r._var == null ? null : r._var, owed: r._owed == null ? null : r._owed,
    flags: r._flags || [], mine: mine,
  };
}

function pcLedger_(b, who, people) {
  var c = pcCompute_(pcRows_());
  var me = pcName_(who.name);
  var see = function (r) { return who.reviewer || pcName_(r['Held By']) === me || pcName_(r['Entered By']) === me; };
  var entries = c.rows.filter(see).map(function (r) { return pcOut_(r, who); })
    .sort(function (a, z) { return a.when < z.when ? 1 : a.when > z.when ? -1 : (a.logged < z.logged ? 1 : -1); });
  var floats = c.floats.filter(function (f) { return who.reviewer || pcName_(f.holder) === me; });
  /* A holder with no entries yet still has a float card. */
  people.filter(function (p) { return p.cash && (who.reviewer || pcName_(p.name) === me); }).forEach(function (p) {
    if (!floats.some(function (f) { return pcName_(f.holder) === pcName_(p.name); })) {
      floats.push({ holder: p.name, balance: 0, owed: 0, float: pcFloat_(), topUp: pcFloat_(), receiptsSinceTopup: 0,
                    shortage: 0, surplus: 0, lastCount: null, daysSinceCount: null, countOverdue: true, lastActivity: '' });
    }
  });
  return { ok: true, entries: entries, floats: floats, reviewer: who.reviewer, limit: pcLimit_(), float: pcFloat_() };
}


/* ============================== recording ============================== */

function pcRef_() {
  var day = Utilities.formatDate(new Date(), dbTz_(), 'yyyy-MM-dd').replace(/-/g, '').slice(2);
  return 'PC-' + day + '-' + Utilities.getUuid().replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase();
}

function pcAmount_(v, what) {
  var n = Number(String(v == null ? '' : v).replace(/[, $]|TT/gi, ''));
  if (!isFinite(n) || n <= 0) throw new Error('Enter the ' + (what || 'amount') + ' in TT$.');
  if (n > PC.MAX_AMOUNT) throw new Error('That amount is too large for petty cash.');
  return pcRound_(n);
}

/* Everything is checked before anything is written: an entry is refused
   whole or recorded whole. */
function pcValidate_(e, who, people) {
  var t = pcTypeKey_(e.type);
  if (!t) throw new Error('Choose what you are recording.');
  var o = { type: t, flags: [] };
  var now = new Date();
  var when = e.when ? new Date(e.when) : now;
  if (isNaN(when.getTime())) when = now;
  if (when.getTime() > now.getTime() + 10 * 60000) throw new Error('That date is in the future.');
  if (!who.reviewer && now - when > PC.BACKDATE_DAYS * 86400000) {
    throw new Error('That is more than ' + PC.BACKDATE_DAYS + ' days ago. Ask a reviewer to record it.');
  }
  o.when = when;

  /* Whose float. Staff: their own. A reviewer may record for anyone on the
     petty cash list (a top-up they hand over, a surprise count). */
  var holder = who.name;
  if (who.reviewer && e.holder) {
    var p = people.filter(function (x) { return pcName_(x.name) === pcName_(e.holder); })[0];
    if (!p) throw new Error('Choose whose float this is.');
    holder = p.name;
  }
  o.holder = holder;
  o.notes = dbClean_(e.notes, 500);

  if (t === 'spend') {
    o.amount = pcAmount_(e.amount);
    var cat = PC.CATEGORIES.filter(function (c) { return c.name === e.category; })[0];
    if (!cat) throw new Error('Choose a category.');
    o.category = cat.name;
    o.sub = cat.subs.indexOf(e.sub) >= 0 ? e.sub : '';
    if (cat.subs.length && !o.sub) throw new Error('Choose what kind of ' + cat.name.toLowerCase() + ' it was.');
    o.paidTo = dbClean_(e.paidTo, 80);
    if (!o.paidTo) throw new Error('Say who was paid (the shop or person).');
    o.purpose = dbClean_(e.purpose, 300);
    if (o.purpose.length < 5) throw new Error('Say what it was for, in a few words.');
    o.charged = cat.name === PC.PERSONAL ? PC.CHARGED[1] : (PC.CHARGED.indexOf(e.charged) >= 0 ? e.charged : PC.CHARGED[0]);
    if (cat.name === 'Other' && o.purpose.length < 12) throw new Error('For "Other", describe it fully.');
    o.recover = o.charged === PC.CHARGED[2] ? dbClean_(e.recover, 80) : '';
    if (o.charged === PC.CHARGED[2] && !o.recover) throw new Error('Say who it is to be recovered from.');
    o.vehicle = dbClean_(e.vehicle, 60);
    if (cat.name === 'Vehicle' && !o.vehicle) throw new Error('Say which vehicle.');
    o.odometer = dbClean_(e.odometer, 12).replace(/[^\d]/g, '');
    o.client = dbClean_(e.client, 80);
    o.payment = PC.PAYMENT.indexOf(e.payment) >= 0 ? e.payment : PC.PAYMENT[0];
    o.receiptNo = dbClean_(e.receiptNo, 40);
    o.photo = /^data:image\//.test(String(e.receipt || '')) ? e.receipt : '';
    o.noReceipt = '';
    if (!o.photo) {
      var why = PC.NO_RECEIPT.indexOf(e.noReceipt) >= 0 ? e.noReceipt : '';
      if (!why) throw new Error('Take a photo of the receipt, or say why there is none.');
      o.noReceipt = why + (e.noReceiptNote ? ': ' + dbClean_(e.noReceiptNote, 120) : '');
      if (why === 'Other' && !e.noReceiptNote) throw new Error('Say why there is no receipt.');
    }
  } else if (t === 'topup') {
    o.amount = pcAmount_(e.amount, 'amount received');
    o.forWhat = PC.FOR.indexOf(e.forWhat) >= 0 ? e.forWhat : PC.FOR[0];
    o.from = dbClean_(e.from, 80);
    if (!o.from) throw new Error('Say who gave it.');
    o.method = PC.METHODS.indexOf(e.method) >= 0 ? e.method : 'Cash';
    o.requestRef = dbClean_(e.requestRef, 30);
    if (o.forWhat === PC.FOR[0]) {
      o.counted = pcNumOrNull_(e.counted);
      if (o.counted == null || o.counted < 0) throw new Error('Count the cash in hand first, before adding the new money.');
      o.counted = pcRound_(o.counted);
      o.denoms = pcDenoms_(e.denoms);
    }
  } else if (t === 'request') {
    o.amount = pcAmount_(e.amount, 'amount requested');
    o.purpose = dbClean_(e.purpose, 300);
    if (o.purpose.length < 5) throw new Error('Say what the money is needed for.');
    o.category = PC.CATEGORIES.some(function (c) { return c.name === e.category; }) ? e.category : '';
    var nb = e.neededBy ? new Date(e.neededBy) : null;
    o.neededBy = nb && !isNaN(nb.getTime()) ? nb : '';
  } else if (t === 'count') {
    o.counted = pcNumOrNull_(e.counted);
    if (o.counted == null || o.counted < 0) throw new Error('Enter the cash counted.');
    o.counted = pcRound_(o.counted);
    o.denoms = pcDenoms_(e.denoms);
    o.amount = 0;
  } else if (t === 'return') {
    o.amount = pcAmount_(e.amount, 'amount returned');
    o.from = dbClean_(e.returnedTo, 80);
    if (!o.from) throw new Error('Say who it was returned to.');
    o.purpose = dbClean_(e.purpose, 300);
  }
  return o;
}

/* "100x3, 20x2, 1x5" kept as typed by the counter, so a count can be
   checked note by note. */
function pcDenoms_(d) {
  if (!d || typeof d !== 'object') return '';
  return PC.DENOMS.map(function (v) {
    var n = parseInt(d[String(v)], 10);
    return n > 0 ? (v >= 1 ? v : v.toFixed(2)) + 'x' + n : '';
  }).filter(String).join(', ');
}

function pcFolder_() {
  var id = dbProp_('PC_FOLDER_ID');
  if (id) { try { return DriveApp.getFolderById(id); } catch (e) {} }
  var f = DriveApp.createFolder('Petty Cash — receipts');
  dbProps_().setProperty('PC_FOLDER_ID', f.getId());
  return f;
}

function pcSaveReceipt_(dataUrl, name) {
  var m = String(dataUrl || '').match(/^data:(image\/(png|jpeg|jpg|webp));base64,([A-Za-z0-9+\/=]+)$/);
  if (!m) throw new Error('That receipt photo could not be read. Take it again.');
  var bytes = Utilities.base64Decode(m[3]);
  if (bytes.length > PC.MAX_PHOTO_KB * 1024) throw new Error('That photo is too large. Take it again.');
  return pcFolder_().createFile(Utilities.newBlob(bytes, m[1], name + '.' + (m[2] === 'jpeg' ? 'jpg' : m[2]))).getUrl();
}

function pcSubmit_(b, who, people) {
  var o = pcValidate_(b.entry || {}, who, people);
  var ref = pcRef_();
  var limit = pcLimit_();

  /* The photo goes to Drive first: a failure there refuses the entry whole. */
  var receiptUrl = o.photo ? pcSaveReceipt_(o.photo, ref + '-receipt') : '';

  var status = 'Recorded';
  if (o.type === 'request') status = 'Awaiting approval';
  if (o.type === 'spend' && o.amount > limit) status = 'Awaiting approval';

  var row = {
    'Reference': ref, 'Type': PC.TYPES[o.type], 'When': o.when, 'Logged At': new Date(),
    'Entered By': who.name, 'Held By': o.holder, 'Amount': o.amount,
    'Category': o.category || '', 'Subcategory': o.sub || '', 'Charged To': o.charged || '', 'Recover From': o.recover || '',
    'Paid To': o.paidTo || '', 'Purpose': o.purpose || '', 'Vehicle': o.vehicle || '', 'Odometer': o.odometer || '',
    'Client / Policy': o.client || '', 'Payment': o.payment || '', 'Receipt #': o.receiptNo || '', 'Receipt': receiptUrl,
    'No Receipt Reason': o.noReceipt || '', 'Received From': o.from || '', 'Method': o.method || '', 'For': o.forWhat || '',
    'Counted': o.counted == null ? '' : o.counted, 'Denominations': o.denoms || '',
    'Request Ref': o.requestRef || '', 'Needed By': o.neededBy || '', 'Status': status,
    'Source': 'App' + (dbMode_() === 'live' ? '' : ' (test)'), 'Notes': o.notes || '',
  };

  var sh = pcLedgerTab_();
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  var computed, newRow;
  try {
    var rows = pcRows_();
    /* The same receipt from the same shop twice is the same spend. */
    if (o.type === 'spend' && o.receiptNo) {
      var dup = rows.filter(function (r) {
        return String(r.Status) !== 'Void' && pcTypeKey_(r.Type) === 'spend' &&
          String(r['Receipt #']).trim().toUpperCase() === o.receiptNo.toUpperCase() && pcName_(r['Paid To']) === pcName_(o.paidTo);
      })[0];
      if (dup) throw new Error('Receipt ' + o.receiptNo + ' from ' + o.paidTo + ' is already on the ledger (' + dup.Reference + ').');
    }
    var cand = Object.assign({ _i: rows.length, _row: 0 }, row);
    computed = pcCompute_(rows.concat([cand]));
    row['Expected'] = (o.type === 'count' || (o.type === 'topup' && o.counted != null)) ? cand._before : '';
    row['Variance'] = cand._var == null ? '' : cand._var;
    row['Flags'] = (cand._flags || []).join('; ');
    newRow = sh.getLastRow() + 1;
    sh.getRange(newRow, 1, 1, dbHeaderMap_(sh).head.length).setValues([dbRowFor_(sh, row)]);

    /* A top-up against an approved request closes it. */
    if (o.type === 'topup' && o.requestRef) {
      var req = rows.filter(function (r) { return String(r.Reference) === o.requestRef && pcTypeKey_(r.Type) === 'request'; })[0];
      if (req) pcSet_(sh, req._row, { 'Status': 'Topped up', 'Notes': pcAppend_(req.Notes, 'Topped up by ' + ref) });
    }
  } finally {
    lock.releaseLock();
  }

  var mine = computed.rows.filter(function (r) { return r.Reference === ref; })[0];
  var fl = computed.floats.filter(function (f) { return pcName_(f.holder) === pcName_(o.holder); })[0];
  try { pcAlertFor_(mine, who, people, fl); } catch (e) { Logger.log('petty cash alert: ' + e); }
  return { ok: true, ref: ref, status: status, entry: pcOut_(mine, who), float: fl };
}

function pcSet_(sh, rowNum, obj) {
  var hm = dbHeaderMap_(sh);
  Object.keys(obj).forEach(function (k) { if (k in hm.map) sh.getRange(rowNum, hm.map[k] + 1).setValue(obj[k]); });
}

function pcAppend_(old, line) {
  var stamp = Utilities.formatDate(new Date(), dbTz_(), 'd MMM');
  return (old ? String(old) + '\n' : '') + '[' + stamp + '] ' + line;
}


/* ============================== review ============================== */

function pcFind_(ref) {
  var rows = pcRows_();
  var r = rows.filter(function (x) { return String(x.Reference) === String(ref || ''); })[0];
  if (!r) throw new Error('That entry is not on the ledger.');
  return r;
}

/** A reviewer: approve or decline (requests, over-limit spends), mark
 *  reviewed, query (the holder answers in the app) or void (with a reason). */
function pcReview_(b, who, people) {
  if (!who.reviewer) throw new Error('Only a reviewer can do that.');
  var act = String(b.act || '');
  var note = dbClean_(b.note, 400);
  var sh = pcLedgerTab_();
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  var r;
  try {
    r = pcFind_(b.ref);
    if (String(r.Status) === 'Void') throw new Error('That entry is void.');
    var now = new Date(), set = {};
    if (act === 'approve' || act === 'decline') {
      if (String(r.Status) !== 'Awaiting approval') throw new Error('That entry is not waiting for approval.');
      if (act === 'decline' && !note) throw new Error('Say why it is declined.');
      set = { 'Status': act === 'approve' ? 'Approved' : 'Declined', 'Approved By': who.name, 'Approved At': now };
      if (note) set['Review Note'] = note;
    } else if (act === 'reviewed') {
      set = { 'Review': 'Reviewed', 'Reviewed By': who.name, 'Reviewed At': now };
      if (note) set['Review Note'] = note;
    } else if (act === 'query') {
      if (!note) throw new Error('Write the question.');
      set = { 'Review': 'Queried', 'Review Note': note, 'Reviewed By': who.name, 'Reviewed At': now };
    } else if (act === 'void') {
      if (!note) throw new Error('Say why it is void.');
      set = { 'Status': 'Void', 'Review': 'Void', 'Review Note': note, 'Reviewed By': who.name, 'Reviewed At': now };
    } else {
      throw new Error('Unknown review action.');
    }
    pcSet_(sh, r._row, set);
    Object.keys(set).forEach(function (k) { r[k] = set[k]; });
  } finally {
    lock.releaseLock();
  }
  /* The holder hears about a decision on their entry. */
  if (act === 'approve' || act === 'decline' || act === 'query') {
    var p = people.filter(function (x) { return pcName_(x.name) === pcName_(r['Held By']); })[0];
    if (p && p.email && pcName_(p.name) !== pcName_(who.name)) {
      var verb = act === 'approve' ? 'approved' : act === 'decline' ? 'declined' : 'queried';
      pcMail_([p.email], 'Petty cash: ' + r.Reference + ' ' + verb,
        '<p>' + dbEsc_(who.name) + ' ' + verb + ' your ' + dbEsc_(String(r.Type).toLowerCase()) + ' of <b>' +
        pcMoney_(r.Amount) + '</b>' + (r.Purpose ? ' (' + dbEsc_(r.Purpose) + ')' : '') + '.</p>' +
        (note ? '<p><i>' + dbEsc_(note) + '</i></p>' : '') +
        (act === 'query' ? '<p>Answer it in RR Operations → Petty Cash → Float.</p>' : ''));
    }
  }
  return { ok: true, ref: r.Reference, status: String(r.Status), review: String(r.Review || '') };
}

/** The holder (or whoever entered it) answers a query. */
function pcAnswer_(b, who, people) {
  var note = dbClean_(b.note, 400);
  if (!note) throw new Error('Write your answer.');
  var sh = pcLedgerTab_();
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  var r;
  try {
    r = pcFind_(b.ref);
    var mine = pcName_(r['Held By']) === pcName_(who.name) || pcName_(r['Entered By']) === pcName_(who.name);
    if (!mine && !who.reviewer) throw new Error('That entry is not yours.');
    pcSet_(sh, r._row, { 'Answer': pcAppend_(r.Answer, who.name + ': ' + note), 'Review': 'Answered' });
  } finally {
    lock.releaseLock();
  }
  var to = pcReviewerMails_(people);
  if (to.length) pcMail_(to, 'Petty cash: ' + r.Reference + ' answered',
    '<p>' + dbEsc_(who.name) + ' answered your query on ' + dbEsc_(r.Reference) + ' (' + pcMoney_(r.Amount) + ').</p>' +
    '<p><b>Your question:</b> ' + dbEsc_(r['Review Note']) + '</p><p><b>Answer:</b> ' + dbEsc_(note) + '</p>');
  return { ok: true, ref: r.Reference, review: 'Answered' };
}


/* ============================== mail ============================== */

function pcReviewerMails_(people) {
  var out = {};
  people.forEach(function (p) { if (p.reviewer && p.email) out[p.email.toLowerCase()] = 1; });
  String(dbProp_('PC_ALERT_TO', '')).split(',').forEach(function (e) { e = e.trim().toLowerCase(); if (e) out[e] = 1; });
  return Object.keys(out);
}

function pcMail_(to, subject, inner) {
  if (!to || !to.length) return 'No one to tell';
  try {
    if (MailApp.getRemainingDailyQuota && MailApp.getRemainingDailyQuota() < to.length) return 'Held: daily mail limit reached';
    MailApp.sendEmail({ to: to.join(','), subject: subject, name: DB.BRAND + ' · Petty Cash', htmlBody: pcShell_(inner) });
    return 'Sent';
  } catch (e) { return 'Failed: ' + e.message; }
}

function pcShell_(inner) {
  return '<div style="background:#f3f5f8;padding:20px 10px;font-family:Arial,Helvetica,sans-serif;color:#13202e">' +
    '<div style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden">' +
    '<div style="background:#07131f;padding:16px 20px"><img src="' + DB.LOGO + '" width="36" height="36" alt="" ' +
    'style="vertical-align:middle;border-radius:8px"><span style="color:#efc24b;font-weight:bold;font-size:15px;margin-left:10px;' +
    'vertical-align:middle">Petty Cash · ' + DB.BRAND + '</span></div>' +
    '<div style="padding:20px;font-size:14px;line-height:1.55">' + inner + '</div>' +
    '<div style="padding:10px 20px;background:#f6f8fb;color:#5b6b7f;font-size:12px">Internal. Do not forward outside the branch.</div>' +
    '</div></div>';
}

/* What a reviewer is told the moment it happens. Everything else waits for
   the weekly report. */
function pcAlertFor_(r, who, people, fl) {
  if (!r) return;
  var lines = [];
  if (r._t === 'request') lines.push(dbEsc_(r['Held By']) + ' asks for <b>' + pcMoney_(r.Amount) + '</b>: ' + dbEsc_(r.Purpose) + '.');
  if (r._t === 'spend' && String(r.Status) === 'Awaiting approval') lines.push('A spend over the limit waits for approval: <b>' +
    pcMoney_(r.Amount) + '</b> to ' + dbEsc_(r['Paid To']) + ' (' + dbEsc_(r.Category) + ').');
  if (r._var != null && Math.abs(r._var) >= pcVarLimit_()) lines.push('The cash counted was <b>' + pcMoney_(r.Counted) +
    '</b>; the book expected ' + pcMoney_(r._before) + '. ' + (r._var < 0 ? 'Short ' + pcMoney_(-r._var) : 'Over ' + pcMoney_(r._var)) + '.');
  if (r._flags.some(function (f) { return /below zero/.test(f); })) lines.push('The float is now ' + pcMoney_(r._after) +
    ': more was spent than the book shows was there. A top-up or an own-money spend may be missing.');
  if (r._flags.some(function (f) { return /split/i.test(f); })) lines.push('Possible split purchase at ' + dbEsc_(r['Paid To']) + '.');
  if (!lines.length) return;
  var to = pcReviewerMails_(people).filter(function (e) {
    return !people.some(function (p) { return p.email.toLowerCase() === e && pcName_(p.name) === pcName_(who.name); });
  });
  pcMail_(to, 'Petty cash: ' + r.Reference + ' needs a look (' + String(r['Held By']) + ')',
    '<p>' + lines.join('</p><p>') + '</p><p style="color:#5b6b7f">Recorded by ' + dbEsc_(who.name) + ' · ' + dbEsc_(r.Reference) +
    (fl ? ' · float now ' + pcMoney_(fl.balance) : '') + '</p><p>Open RR Operations → Petty Cash to approve, query or review it.</p>');
}


/* ============================== analytics ============================== */

/**
 * The numbers for one period, for the weekly report and the Insights tab
 * alike (the page computes the same from the same rows). `from` inclusive,
 * `to` exclusive.
 */
function pcAnalyze_(c, from, to) {
  var inP = function (r) { return r._when >= from && r._when < to && String(r.Status) !== 'Void'; };
  var rows = c.rows.filter(inP);
  var spends = rows.filter(function (r) { return r._t === 'spend'; });
  var sum = function (list) { return pcRound_(list.reduce(function (a, r) { return a + pcRound_(r.Amount); }, 0)); };
  var group = function (list, key) {
    var m = {};
    list.forEach(function (r) { var k = key(r) || '(none)'; m[k] = m[k] || { name: k, amount: 0, n: 0 }; m[k].amount = pcRound_(m[k].amount + pcRound_(r.Amount)); m[k].n++; });
    return Object.keys(m).map(function (k) { return m[k]; }).sort(function (a, b) { return b.amount - a.amount; });
  };
  var personal = spends.filter(function (r) { return /personal/i.test(r['Charged To']) || r.Category === PC.PERSONAL; });
  var noRec = spends.filter(function (r) { return !r.Receipt && !r['Receipt #']; });
  var counts = rows.filter(function (r) { return r._var != null; });
  var flagged = rows.filter(function (r) { return (r._flags || []).some(function (f) { return f !== 'Weekend'; }); });
  return {
    spent: sum(spends), n: spends.length,
    branch: pcRound_(sum(spends) - sum(personal)), personal: sum(personal),
    received: sum(rows.filter(function (r) { return r._t === 'topup' && !/repay/i.test(r.For); })),
    repaid: sum(rows.filter(function (r) { return r._t === 'topup' && /repay/i.test(r.For); })),
    returned: sum(rows.filter(function (r) { return r._t === 'return'; })),
    shortage: pcRound_(counts.reduce(function (a, r) { return a + (r._var < 0 ? -r._var : 0); }, 0)),
    surplus: pcRound_(counts.reduce(function (a, r) { return a + (r._var > 0 ? r._var : 0); }, 0)),
    counts: counts.length,
    noReceipt: { n: noRec.length, amount: sum(noRec) },
    receiptRate: spends.length ? Math.round((spends.length - noRec.length) / spends.length * 100) : null,
    avg: spends.length ? pcRound_(sum(spends) / spends.length) : 0,
    largest: spends.slice().sort(function (a, b) { return pcRound_(b.Amount) - pcRound_(a.Amount); })[0] || null,
    byCategory: group(spends, function (r) { return r.Category; }),
    bySub: group(spends, function (r) { return r.Category + ' · ' + (r.Subcategory || '—'); }),
    byVendor: group(spends, function (r) { return String(r['Paid To']).trim(); }).slice(0, 8),
    byHolder: group(spends, function (r) { return String(r['Held By']).trim(); }),
    byVehicle: group(spends.filter(function (r) { return r.Vehicle; }), function (r) { return String(r.Vehicle).trim(); }),
    flagged: flagged,
    requests: rows.filter(function (r) { return r._t === 'request'; }),
  };
}

function pcWeekStart_(d) {
  var x = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  var dow = x.getDay();
  x.setDate(x.getDate() - (dow === 0 ? 6 : dow - 1));     // Monday
  return x;
}


/* ============================== the weekly report ============================== */

/**
 * Monday morning: last week (Monday to Sunday), against the four weeks
 * before. To every reviewer and PC_ALERT_TO. Installed by "Petty cash:
 * switch on the weekly report"; run by hand with pcWeeklyNow.
 */
function pcWeeklyReport() { return pcWeeklySend_(new Date(), false); }
function pcWeeklyNow() { return pcWeeklySend_(new Date(), false); }
function pcWeeklyPreview() {
  var me = Session.getEffectiveUser().getEmail();
  return pcWeeklySend_(new Date(), me ? [me] : null);
}

function pcWeeklySend_(now, onlyTo) {
  var people = pcPeople_();
  var to = onlyTo || pcReviewerMails_(people);
  if (!to.length) to = [Session.getEffectiveUser().getEmail()];
  var rep = pcWeeklyBuild_(now, people);
  var status = pcMail_(to, (onlyTo ? '[PREVIEW] ' : '') + rep.subject, rep.html);
  if (!onlyTo) {
    try {
      pcSheet_(PC.TABS.WEEKLY, PC_WEEKLY_COLUMNS).appendRow([rep.week, new Date(), to.join(', '), rep.a.spent, rep.a.branch,
        rep.a.personal, rep.a.received, rep.a.shortage, rep.a.flagged.length, status]);
    } catch (e) { Logger.log('weekly log: ' + e); }
  }
  return status + ' to ' + to.join(', ') + ': ' + rep.subject;
}

function pcWeeklyBuild_(now, people) {
  var c = pcCompute_(pcRows_(), now);
  var thisMon = pcWeekStart_(now);
  var from = new Date(thisMon.getTime() - 7 * 86400000), to = thisMon;
  var a = pcAnalyze_(c, from, to);
  var prev = pcAnalyze_(c, new Date(from.getTime() - 28 * 86400000), from);
  var avg4 = pcRound_(prev.spent / 4);
  var tz = dbTz_();
  var week = Utilities.formatDate(from, tz, 'd MMM') + ' – ' + Utilities.formatDate(new Date(to.getTime() - 86400000), tz, 'd MMM yyyy');
  var E = dbEsc_, M = pcMoney_;
  var td = 'padding:7px 9px;border-bottom:1px solid #e6ebf1';
  var th = 'padding:7px 9px;text-align:left;background:#f6f8fb;font-size:12px;color:#5b6b7f';
  var tile = function (label, val, sub, bad) {
    return '<td style="padding:10px;border:1px solid #e6ebf1;border-radius:8px;width:25%;vertical-align:top">' +
      '<div style="font-size:11px;color:#5b6b7f;text-transform:uppercase;letter-spacing:.5px">' + label + '</div>' +
      '<div style="font-size:19px;font-weight:bold;color:' + (bad ? '#b42318' : '#13202e') + '">' + val + '</div>' +
      (sub ? '<div style="font-size:12px;color:#5b6b7f">' + sub + '</div>' : '') + '</td>';
  };
  var bars = function (list, total) {
    if (!list.length) return '<p style="color:#5b6b7f">Nothing spent.</p>';
    return '<table style="width:100%;border-collapse:collapse;font-size:13px">' + list.map(function (g) {
      var pct = total ? Math.round(g.amount / total * 100) : 0;
      return '<tr><td style="' + td + ';width:42%">' + E(g.name) + '</td><td style="' + td + '">' +
        '<div style="background:#e9eef5;border-radius:4px;height:10px"><div style="background:#c9942c;height:10px;border-radius:4px;width:' +
        Math.max(2, pct) + '%"></div></div></td><td style="' + td + ';text-align:right;white-space:nowrap">' + M(g.amount) +
        ' <span style="color:#5b6b7f">· ' + pct + '% · ' + g.n + '</span></td></tr>';
    }).join('') + '</table>';
  };

  /* What stands out: sentences of fact, most important first. */
  var stand = [];
  if (a.shortage >= pcVarLimit_()) stand.push('Counts came up <b>' + M(a.shortage) + ' short</b> of the book. Ask the holder to account for it.');
  if (a.noReceipt.n) stand.push(a.noReceipt.n + ' spend' + (a.noReceipt.n > 1 ? 's' : '') + ' (' + M(a.noReceipt.amount) + ') had no receipt.');
  if (a.personal) stand.push(M(a.personal) + ' (' + Math.round(a.personal / Math.max(a.spent, 0.01) * 100) + '%) was personal spend, kept apart from branch spend.');
  if (avg4 > 0 && a.spent > avg4 * 1.5) stand.push('Spend was ' + Math.round(a.spent / avg4 * 100) + '% of the four-week average (' + M(avg4) + ' a week).');
  if (avg4 > 0 && a.spent < avg4 * 0.5 && a.spent > 0) stand.push('Spend was well under the four-week average (' + M(avg4) + ' a week).');
  if (a.byCategory[0] && a.spent) stand.push('Most went on ' + E(a.byCategory[0].name.toLowerCase()) + ' (' + M(a.byCategory[0].amount) + ').');
  var splits = a.flagged.filter(function (r) { return r._flags.some(function (f) { return /split/i.test(f); }); });
  if (splits.length) stand.push('Possible split purchases: ' + splits.length + ' spends.');
  if (!stand.length) stand.push('Nothing out of the ordinary.');

  /* Each float, reconciled: cash the book expects, receipts since the last
     top-up, what brings it back to the float. */
  var floatRows = c.floats.map(function (f) {
    var bad = f.balance < 0 || f.shortage > 0 || f.countOverdue;
    return '<tr><td style="' + td + '"><b>' + E(f.holder) + '</b></td><td style="' + td + ';text-align:right">' + M(f.balance) +
      '</td><td style="' + td + ';text-align:right">' + M(f.receiptsSinceTopup) + '</td><td style="' + td + ';text-align:right">' +
      (f.topUp ? M(f.topUp) : '—') + '</td><td style="' + td + ';text-align:right">' + (f.owed ? M(f.owed) : '—') + '</td><td style="' + td +
      ';color:' + (bad ? '#b42318' : '#13202e') + '">' +
      (f.lastCount ? 'Counted ' + f.daysSinceCount + ' day' + (f.daysSinceCount === 1 ? '' : 's') + ' ago' +
        (f.lastCount.variance ? ' (' + (f.lastCount.variance < 0 ? 'short ' : 'over ') + M(Math.abs(f.lastCount.variance)) + ')' : '') : 'Never counted') +
      (f.countOverdue ? ' · <b>count due</b>' : '') + '</td></tr>';
  }).join('');

  var flagRows = a.flagged.slice(0, 25).map(function (r) {
    return '<tr><td style="' + td + ';white-space:nowrap">' + Utilities.formatDate(r._when, tz, 'EEE d MMM') + '</td><td style="' + td + '">' +
      E(r['Held By']) + '</td><td style="' + td + '">' + E(PC.TYPES[r._t] || r.Type) + (r['Paid To'] ? ' · ' + E(r['Paid To']) : '') +
      '</td><td style="' + td + ';text-align:right">' + M(r._t === 'count' ? r.Counted : r.Amount) + '</td><td style="' + td + ';color:#b42318">' +
      E(r._flags.filter(function (f) { return f !== 'Weekend'; }).join('; ')) + '</td></tr>';
  }).join('');

  var waiting = c.rows.filter(function (r) { return String(r.Status) === 'Awaiting approval'; });
  var queried = c.rows.filter(function (r) { return String(r.Review) === 'Queried'; });
  var unreviewed = c.rows.filter(function (r) { return String(r.Status) !== 'Void' && !r.Review && r._t !== 'request'; });

  var html =
    '<h2 style="margin:0 0 4px;font-size:18px">Petty cash: the week of ' + E(week) + '</h2>' +
    '<p style="margin:0 0 14px;color:#5b6b7f">Every float, reconciled; what was spent and on what; and what needs a look.</p>' +
    '<table style="width:100%;border-collapse:separate;border-spacing:6px;margin:0 -6px 8px"><tr>' +
    tile('Spent', M(a.spent), a.n + ' spend' + (a.n === 1 ? '' : 's') + (avg4 ? ' · 4-wk avg ' + M(avg4) : '')) +
    tile('Branch / personal', M(a.branch), M(a.personal) + ' personal') +
    tile('Topped up', M(a.received), a.repaid ? M(a.repaid) + ' repaid to staff' : '') +
    tile('Short at counts', M(a.shortage), a.counts + ' count' + (a.counts === 1 ? '' : 's'), a.shortage >= pcVarLimit_()) +
    '</tr></table>' +
    '<h3 style="font-size:15px;margin:18px 0 6px">What stands out</h3><ul style="margin:0;padding-left:18px">' +
    stand.map(function (s) { return '<li style="margin:3px 0">' + s + '</li>'; }).join('') + '</ul>' +
    '<h3 style="font-size:15px;margin:18px 0 6px">Each float now</h3>' +
    '<table style="width:100%;border-collapse:collapse;font-size:13px"><tr><th style="' + th + '">Held by</th><th style="' + th +
    ';text-align:right">Cash per book</th><th style="' + th + ';text-align:right">Receipts since top-up</th><th style="' + th +
    ';text-align:right">Top up by</th><th style="' + th + ';text-align:right">Owed to them</th><th style="' + th + '">Last count</th></tr>' +
    (floatRows || '<tr><td style="' + td + '" colspan="6">No floats yet.</td></tr>') + '</table>' +
    '<p style="font-size:12px;color:#5b6b7f;margin:6px 0 0">Each float is kept at ' + M(pcFloat_()) + '. Cash per book plus receipts since the last top-up should equal what the float held after it; a count says whether it does.</p>' +
    '<h3 style="font-size:15px;margin:18px 0 6px">Where it went</h3>' + bars(a.byCategory, a.spent) +
    (a.byVendor.length ? '<h3 style="font-size:15px;margin:18px 0 6px">Paid to</h3>' + bars(a.byVendor, a.spent) : '') +
    (a.byVehicle.length ? '<h3 style="font-size:15px;margin:18px 0 6px">By vehicle</h3>' + bars(a.byVehicle, a.spent) : '') +
    '<h3 style="font-size:15px;margin:18px 0 6px">Needs a look</h3>' +
    (flagRows ? '<table style="width:100%;border-collapse:collapse;font-size:13px"><tr><th style="' + th + '">Day</th><th style="' + th +
      '">Who</th><th style="' + th + '">What</th><th style="' + th + ';text-align:right">TT$</th><th style="' + th + '">Why</th></tr>' + flagRows + '</table>'
      : '<p style="color:#5b6b7f">Nothing flagged.</p>') +
    '<p style="margin:14px 0 0"><b>' + waiting.length + '</b> waiting for approval · <b>' + queried.length + '</b> queried, not yet answered · <b>' +
    unreviewed.length + '</b> not yet reviewed.</p>' +
    '<p style="margin:10px 0 0">Open <a href="https://rickyrampersadbranch.com/rroperations/petty-cash/">RR Operations → Petty Cash</a> to approve, query or review.</p>';

  return { week: week, a: a, subject: 'Petty cash weekly: ' + week + ' · ' + M(a.spent) + ' spent' +
    (a.shortage >= pcVarLimit_() ? ' · ' + M(a.shortage) + ' short' : ''), html: html };
}

/* Monday 7:00 to 8:00. Made once; run again to replace it, never to add a
   second. */
function pcWeeklyOn() {
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'pcWeeklyReport') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('pcWeeklyReport').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY).atHour(7).create();
  var msg = 'The petty cash weekly report goes every Monday between 7 and 8 to: ' + (pcReviewerMails_(pcPeople_()).join(', ') || 'the script owner');
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) {}
  return msg;
}

function pcWeeklyOff() {
  var n = 0;
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'pcWeeklyReport') { ScriptApp.deleteTrigger(t); n++; }
  });
  return n ? 'Weekly report switched off.' : 'It was not on.';
}


/* ============================== the Jotform history ============================== */

/**
 * Copies the Jotform's rows into the ledger once, so the book starts from
 * the first entry. Categories are guessed from the purpose and flagged as
 * guessed; the balance at hand typed at a top-up becomes that top-up's
 * count, so the shortages show. Safe to run again. No e-mail.
 */
function pcImportJotform() {
  var ss = pcSS_();
  var old = ss.getSheetByName(PC.TABS.OLD);
  if (!old) return 'No "' + PC.TABS.OLD + '" tab in the petty cash sheet. Connect the Petty Cash sheet first.';
  var hm = dbHeaderMap_(old);
  var norm = {};
  hm.head.forEach(function (h, i) { var k = String(h).toLowerCase().replace(/[^a-z0-9]/g, ''); if (!(k in norm)) norm[k] = i; });
  var last = old.getLastRow();
  if (last < 2) return 'Nothing to import.';
  var vals = old.getRange(2, 1, last - 1, hm.head.length).getValues();
  var sh = pcLedgerTab_();
  var have = {};
  pcRows_().forEach(function (r) { have[String(r.Reference)] = 1; });
  var people = pcPeople_();
  var g = function (r, k) { return k in norm ? r[norm[k]] : ''; };
  var out = [];
  vals.forEach(function (r) {
    var id = String(g(r, 'submissionid') || '').trim();
    if (!id || have['JF-' + id]) return;
    var t = pcTypeKey_(g(r, 'requesttype'));
    if (!t) return;
    var sub = pcDate_(g(r, 'submissiondate'));
    var when = pcJotDate_(g(r, 'date'), sub) || sub || new Date();
    var flags = ['Imported from the Jotform'];
    var row = { 'Reference': 'JF-' + id, 'Type': PC.TYPES[t], 'When': when, 'Logged At': sub || when, 'Source': 'Jotform', 'Status': 'Recorded' };
    if (t === 'spend') {
      var purpose = String(g(r, 'purposeoftransaction') || '').trim();
      var paid = String(g(r, 'paidto') || '').trim();
      var cat = pcGuessCategory_(purpose + ' ' + paid);
      var holder = pcMatchPerson_(g(r, 'staffspendingcash'), people);
      row['Entered By'] = holder; row['Held By'] = holder;
      row['Amount'] = pcRound_(g(r, 'amountspent'));
      row['Category'] = cat; row['Charged To'] = cat === PC.PERSONAL ? PC.CHARGED[1] : PC.CHARGED[0];
      row['Paid To'] = paid; row['Purpose'] = purpose; row['Vehicle'] = String(g(r, 'vehicle') || '').trim();
      row['Payment'] = PC.PAYMENT[0];
      row['Receipt #'] = String(g(r, 'receiptorreferenceid') || '').trim();
      row['Receipt'] = String(g(r, 'copyofreceiptupload') || '').trim();
      if (!row['Receipt']) row['No Receipt Reason'] = 'Not given on the Jotform';
      flags.push('Category guessed: check it');
    } else if (t === 'topup') {
      var rec = pcMatchPerson_(g(r, 'receivedby'), people);
      row['Entered By'] = rec; row['Held By'] = rec;
      row['Amount'] = pcRound_(g(r, 'amountreceived'));
      row['Received From'] = String(g(r, 'receivedfrom') || '').trim();
      row['Method'] = 'Cash'; row['For'] = PC.FOR[0];
      var bal = pcNumOrNull_(g(r, 'cashbalanceathand'));
      row['Counted'] = bal == null ? '' : bal;
    } else if (t === 'request') {
      var by = pcMatchPerson_(g(r, 'requestby') || g(r, 'staffspendingcash'), people);
      row['Entered By'] = by; row['Held By'] = by;
      row['Amount'] = pcRound_(g(r, 'requestamount'));
      row['Purpose'] = String(g(r, 'purposeoftransaction') || '').trim();
      row['Status'] = 'Recorded';
    }
    if (!(row['Amount'] > 0) && t !== 'count') return;
    row['Flags'] = flags.join('; ');
    out.push(dbRowFor_(sh, row));
  });
  if (out.length) sh.getRange(sh.getLastRow() + 1, 1, out.length, out[0].length).setValues(out);
  var msg = 'Imported ' + out.length + ' Jotform entr' + (out.length === 1 ? 'y' : 'ies') + '. Check the guessed categories on the Ledger.';
  try { SpreadsheetApp.getUi().alert(msg); } catch (e) {}
  return msg;
}

/* The Jotform's own date ("08-27-2026" or a Date) at the time it was
   submitted when that was the same day, else midday: so a spend and a top-up
   on one afternoon stay in the order they were sent. */
function pcJotDate_(v, sub) {
  var d = null;
  if (v instanceof Date) d = new Date(v.getFullYear(), v.getMonth(), v.getDate());
  else {
    var m = String(v || '').match(/^(\d{1,2})[-\/](\d{1,2})[-\/](\d{4})/);
    if (m) d = new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]));
  }
  if (!d) return null;
  if (sub && sub.getFullYear() === d.getFullYear() && sub.getMonth() === d.getMonth() && sub.getDate() === d.getDate()) return sub;
  d.setHours(12);
  return d;
}


/* ============================== editor ============================== */

/** Asks for the Petty Cash sheet's link and keeps its ID as PC_SHEET_ID. */
function pcConnectSheet() {
  var ui = SpreadsheetApp.getUi();
  var res = ui.prompt('Petty cash', 'Paste the link to the Petty Cash Transactions Google Sheet:', ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return 'Cancelled.';
  var m = String(res.getResponseText()).match(/\/d\/([a-zA-Z0-9_-]{20,})/) || String(res.getResponseText()).match(/^([a-zA-Z0-9_-]{20,})$/);
  if (!m) { ui.alert('That does not look like a Google Sheets link.'); return 'No ID.'; }
  dbProps_().setProperty('PC_SHEET_ID', m[1]);
  var name = SpreadsheetApp.openById(m[1]).getName();
  pcLedgerTab_();
  ui.alert('Connected to "' + name + '". The Petty Cash Ledger tab is ready.');
  return 'Connected: ' + name;
}

/** Makes the ledger and says what is set. */
function pcSetupCheck() {
  pcLedgerTab_();
  var ss = pcSS_();
  var people = pcPeople_();
  var notes = [
    'Sheet: ' + ss.getName() + (dbProp_('PC_SHEET_ID') ? '' : ' (the bound sheet: run "Petty cash: connect the Petty Cash sheet")'),
    'Jotform tab: ' + (ss.getSheetByName(PC.TABS.OLD) ? 'found' : 'not in this sheet'),
    'Float: ' + pcMoney_(pcFloat_()) + ' · approval above ' + pcMoney_(pcLimit_()) + ' · count variance flagged at ' + pcMoney_(pcVarLimit_()),
    'Holders (Access tab, petty-cash): ' + (people.filter(function (p) { return p.cash; }).map(function (p) { return p.name; }).join(', ') || 'none'),
    'Reviewers: ' + (people.filter(function (p) { return p.reviewer; }).map(function (p) { return p.name; }).join(', ') || 'none'),
    'Report and alerts go to: ' + (pcReviewerMails_(people).join(', ') || 'no one yet: add e-mails on the Access tab'),
    'Weekly report: ' + (ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'pcWeeklyReport'; }) ? 'on (Monday 7–8)' : 'off'),
  ];
  var msg = notes.join('\n');
  try { SpreadsheetApp.getUi().alert('Petty Cash\n\n' + msg); } catch (e) {}
  return msg;
}
