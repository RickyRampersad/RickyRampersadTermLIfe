/**
 * ============================================================================
 * WHO CAN OPEN THE RENEWAL BOARD
 * ============================================================================
 * Paste into the SAME Apps Script project as Code.gs and RenewalBoard.gs.
 * It owns no data: it fills in the Staff tab that Code.gs already reads.
 *
 * Signing in is three things, and all three are already built:
 *
 *   1. the board link, which carries the shared staff key;
 *   2. a row on the Staff tab carrying the person's e-mail and role;
 *   3. a personal access code in that row's fifth column.
 *
 * The link on its own is not a sign-in. Whoever has it still has to be on the
 * Staff tab and still has to know their own code. That is why a code is
 * generated onto the sheet and never written in this file: the repository is
 * published on the branch website, so a credential written here is a
 * credential given away. That has already happened once to the staff key.
 *
 * WHAT EACH PERSON SEES is decided by the Role cell and nothing else, read by
 * rbScope_ in RenewalBoard.gs:
 *
 *   admin, manager   the branch — every renewal, every figure, who carries what
 *   staff            every renewal to work, every figure, no agent's ratings
 *   agent            their own clients and nobody else's
 *
 * So changing what somebody sees is changing one cell, not editing code. That
 * matters more than it looks: the orphan board's two-pages-drift-apart problem
 * came from the alternative.
 */

var RTEAM = {
  /**
   * The three people this was asked for, and the role each is set up with.
   *
   * Kamla is set up as 'manager', which on this board means she sees the whole
   * branch and every figure on it, because she runs the support desk and the
   * queue Pawan works is hers to see. Note that the ORPHAN board treats the
   * BMA as staff rather than as the branch manager — the two boards disagree
   * on purpose, because there what is at stake is naming agents and writing to
   * clients in Mr Rampersad's name, and here it is reading a renewal ladder.
   * If she should see less, change her Role cell to 'staff'. Nothing else
   * needs to move.
   */
  PEOPLE: [
    { first: 'Ricky',  role: 'admin',
      sees: 'the whole branch — every renewal, every figure, and who is carrying what' },
    { first: 'Kamla',  role: 'manager',
      sees: 'the whole branch, the same as Mr Rampersad' },
    { first: 'Pawan',  role: 'staff',
      sees: 'every renewal to work, with the figures, ordered by what is most pressing' },
  ],

  /**
   * Codes are six digits and never begin with a zero. Not style: the Staff tab
   * stores them in an ordinary cell, Sheets reads "012345" as the number 12345,
   * and normPin_ in Code.gs rounds a numeric cell back to a string — so a code
   * with a leading zero would be typed in correctly and refused.
   */
  CODE_MIN: 100000,
  CODE_MAX: 999999,
};

/* ================================ the menu ================================ */

function renewalTeamMenu_(ui) {
  return ui.createMenu('👥 Who can sign in')
    .addItem('Set up Ricky, Kamla and Pawan', 'renewalTeamSetup')
    .addItem('Show each person their sign-in card', 'renewalTeamCards')
    .addItem('Issue somebody a new access code', 'renewalTeamNewCode')
    .addItem('Check who can actually sign in', 'renewalTeamCheck');
}

/* ================================ the sheet ================================ */

/**
 * The Staff tab with its fifth column present.
 *
 * Code.gs creates the tab with four headers and reads the code from the fifth
 * column, which nothing ever creates — so until this runs, every row has a
 * blank code, and requireStaff_ treats a blank code as "no code required".
 * That is the quiet failure this fixes: the board would open for anybody
 * holding the link whose e-mail happened to be on the tab.
 */
function rteamSheet_() {
  var sh = staffSheet_();
  var map = headerMap_(sh);
  if (col_(map, 'access code') < 0 && col_(map, 'password') < 0 && col_(map, 'pin') < 0) {
    var c = Math.max(5, sh.getLastColumn() + 1);
    sh.getRange(1, c).setValue('Access code');
  }
  return sh;
}

/** The column the code lives in, whatever this branch has called it. */
function rteamCodeCol_(sh) {
  var map = headerMap_(sh);
  var names = ['access code', 'password', 'pin'];
  for (var i = 0; i < names.length; i++) {
    var c = col_(map, names[i]);
    if (c >= 0) return c + 1;
  }
  return 5;
}

function rteamCode_() {
  return String(RTEAM.CODE_MIN +
    Math.floor(Math.random() * (RTEAM.CODE_MAX - RTEAM.CODE_MIN + 1)));
}

/** The row this person is already on, by e-mail, else by first name. */
function rteamFind_(sh, email, first) {
  if (sh.getLastRow() < 2) return 0;
  var rows = sh.getRange(2, 1, sh.getLastRow() - 1, Math.max(2, sh.getLastColumn())).getValues();
  var want = String(email || '').trim().toLowerCase();
  for (var i = 0; i < rows.length; i++)
    if (String(rows[i][0]).trim().toLowerCase() === want && want) return i + 2;
  if (first) {
    var f = String(first).trim().toLowerCase();
    for (var j = 0; j < rows.length; j++) {
      var name = String(rows[j][1] || '').trim().toLowerCase();
      if (name === f || name.indexOf(f + ' ') === 0) return j + 2;
    }
  }
  return 0;
}

/* ================================ setting up ================================ */

/**
 * Walks the three people, asks for the e-mail each will sign in with, and
 * writes the row. An address already on the tab is offered back so running
 * this twice changes nothing it does not have to.
 *
 * It asks rather than carrying the addresses in code, for the reason at the
 * top of this file, and because guessing a colleague's work address wrong
 * means a sign-in that fails with "your email is not on the Staff sheet" and
 * nothing to say why.
 */
function renewalTeamSetup() {
  var ui = SpreadsheetApp.getUi();
  var sh = rteamSheet_();
  var codeCol = rteamCodeCol_(sh);
  var done = [], skipped = [];

  for (var i = 0; i < RTEAM.PEOPLE.length; i++) {
    var p = RTEAM.PEOPLE[i];
    var at = rteamFind_(sh, '', p.first);
    var had = at ? String(sh.getRange(at, 1).getValue() || '').trim() : '';
    var hadName = at ? String(sh.getRange(at, 2).getValue() || '').trim() : '';

    var res = ui.prompt(p.first + ' — which e-mail will they sign in with?',
      (had ? 'On the Staff tab now: ' + had + '\n\n' : '') +
      'This is the address they type on the board, so it has to be one they\n' +
      'know. Role: ' + p.role + ' (' + p.sees + ').\n\n' +
      'Leave it empty to skip ' + p.first + '.',
      ui.ButtonSet.OK_CANCEL);
    if (res.getSelectedButton() !== ui.Button.OK) { skipped.push(p.first + ' (cancelled)'); continue; }

    var email = String(res.getResponseText() || had).trim().toLowerCase();
    if (email.indexOf('@') < 1) { skipped.push(p.first + ' (no e-mail given)'); continue; }

    var nameRes = ui.prompt(p.first + " — what is their full name?",
      'It is what the board greets them by, and what a note they write is\n' +
      'signed with.\n\nLeave it empty to use "' + (hadName || p.first) + '".',
      ui.ButtonSet.OK_CANCEL);
    var name = String((nameRes.getSelectedButton() === ui.Button.OK ? nameRes.getResponseText() : '')
      || hadName || p.first).trim();

    var row = rteamFind_(sh, email, p.first);
    if (!row) { sh.appendRow([email, name, p.role, 'Y']); row = sh.getLastRow(); }
    else {
      sh.getRange(row, 1).setValue(email);
      sh.getRange(row, 2).setValue(name);
      sh.getRange(row, 3).setValue(p.role);
      sh.getRange(row, 4).setValue('Y');
    }

    // An existing code is kept: re-running this must not lock out somebody who
    // already has their card.
    var code = normPin_(sh.getRange(row, codeCol).getValue());
    if (!code) { code = rteamCode_(); sh.getRange(row, codeCol).setValue(code); }

    done.push({ first: p.first, name: name, email: email, role: p.role, code: code, sees: p.sees });
  }

  logActivity_('', 'system', 'team-setup', Session.getActiveUser().getEmail() || 'admin',
    'Renewal board sign-ins set up for: ' + done.map(function (d) { return d.first; }).join(', '));

  var out = [];
  if (done.length) {
    out.push('Set up and ready to sign in:', '');
    done.forEach(function (d) {
      out.push(d.name + '  ·  ' + d.role);
      out.push('   ' + d.email);
      out.push('   access code ' + d.code);
      out.push('   sees ' + d.sees);
      out.push('');
    });
    out.push('Run "Show each person their sign-in card" to get the message to send');
    out.push('each of them. Send the code separately from the link, not in the');
    out.push('same message — together they are the whole sign-in.');
  } else out.push('Nothing was set up.');
  if (skipped.length) out.push('', 'Skipped: ' + skipped.join(', '));

  ui.alert('Renewal board sign-ins', out.join('\n'), ui.ButtonSet.OK);
}

/* ============================== the sign-in card ============================== */

/**
 * The message to send each person. The link and the code are shown apart,
 * with the reason, because a single message carrying both is one forward away
 * from being somebody else's sign-in.
 */
function renewalTeamCards() {
  var ui = SpreadsheetApp.getUi();
  var key = staffKey_();
  if (!key) {
    ui.alert('No staff key is set, so the board cannot be opened by anybody.\n\n' +
      'Run "Issue a new staff key" from the Guardian Renewals menu first.');
    return;
  }
  var url = CONFIG.WEBAPP_URL + '?board=' + encodeURIComponent(key);
  var sh = rteamSheet_();
  var codeCol = rteamCodeCol_(sh);
  if (sh.getLastRow() < 2) { ui.alert('Nobody is on the Staff tab yet — run "Set up Ricky, Kamla and Pawan".'); return; }

  var rows = sh.getRange(2, 1, sh.getLastRow() - 1, Math.max(codeCol, sh.getLastColumn())).getValues();
  var out = ['THE LINK — the same one for everybody:', '', url, '',
    'Send this in one message. Then send each person their own code in a',
    'separate message. A renewal ladder carries every client\'s premium, so',
    'the two halves do not travel together.', ''];

  rows.forEach(function (r) {
    var email = String(r[0] || '').trim();
    if (email.indexOf('@') < 1) return;
    if (String(r[3]).toUpperCase() === 'N') return;
    var code = normPin_(r[codeCol - 1]);
    out.push('— ' + String(r[1] || email) + ' (' + String(r[2] || 'staff') + ')');
    out.push('   signs in as ' + email.toLowerCase());
    out.push('   ' + (code ? 'code ' + code
      : 'NO CODE — the link alone opens their board. Issue one.'));
  });

  ui.alert('Sign-in cards', out.join('\n'), ui.ButtonSet.OK);
}

/** A fresh code for one person, when theirs has gone astray. */
function renewalTeamNewCode() {
  var ui = SpreadsheetApp.getUi();
  var sh = rteamSheet_();
  var res = ui.prompt('Whose code?', 'Their e-mail or first name.', ui.ButtonSet.OK_CANCEL);
  if (res.getSelectedButton() !== ui.Button.OK) return;
  var who = String(res.getResponseText() || '').trim();
  var row = rteamFind_(sh, who, who);
  if (!row) { ui.alert('Nobody on the Staff tab matches "' + who + '".'); return; }

  var codeCol = rteamCodeCol_(sh);
  var code = rteamCode_();
  sh.getRange(row, codeCol).setValue(code);
  var name = String(sh.getRange(row, 2).getValue() || sh.getRange(row, 1).getValue());
  logActivity_('', 'system', 'team-code', Session.getActiveUser().getEmail() || 'admin',
    'New renewal board access code issued to ' + name);
  ui.alert('New code for ' + name, name + "'s code is now " + code +
    '\n\nTheir old code stopped working the moment this was issued.', ui.ButtonSet.OK);
}

/* ============================== is it working ============================== */

/**
 * Answers "can these three actually sign in" before any of them tries.
 *
 * Each of the four things below fails silently on its own, and the person is
 * told only "invalid staff link" or "your email is not on the Staff sheet",
 * which does not say which.
 */
function renewalTeamCheck() {
  var ui = SpreadsheetApp.getUi();
  var out = [];

  var key = staffKey_();
  out.push((key ? '✅' : '❌') + '  Staff key ' +
    (key ? 'is set — the board link works' : 'is NOT set — nobody can open the board at all'));

  var url = String(CONFIG.WEBAPP_URL || '');
  out.push((/\/exec$/.test(url) ? '✅' : '❌') + '  Web app URL ' +
    (/\/exec$/.test(url) ? 'looks deployed' : 'is not a deployed /exec URL — the link will not open'));

  var sh = rteamSheet_();
  var codeCol = rteamCodeCol_(sh);
  var people = staffList_();
  out.push((people.length ? '✅' : '❌') + '  ' + people.length + ' active on the Staff tab');

  var noCode = people.filter(function (p) { return !p.pin; });
  out.push((noCode.length ? '⚠️' : '✅') + '  ' + noCode.length + ' of them have no access code' +
    (noCode.length ? ' — the link alone opens their board' : ''));

  out.push('', 'The three asked for:');
  RTEAM.PEOPLE.forEach(function (p) {
    var row = rteamFind_(sh, '', p.first);
    if (!row) { out.push('   ❌ ' + p.first + ' — not on the Staff tab'); return; }
    var email = String(sh.getRange(row, 1).getValue() || '').trim().toLowerCase();
    var role = String(sh.getRange(row, 3).getValue() || '').trim();
    var live = String(sh.getRange(row, 4).getValue() || '').toUpperCase() !== 'N';
    var code = normPin_(sh.getRange(row, codeCol).getValue());
    var bad = [];
    if (email.indexOf('@') < 1) bad.push('no e-mail');
    if (!live) bad.push('marked not active');
    if (!code) bad.push('no access code');
    if (role.toLowerCase() !== p.role) bad.push('role is "' + role + '", expected "' + p.role + '"');
    out.push('   ' + (bad.length ? '⚠️' : '✅') + ' ' + p.first + ' — ' + (email || '(no e-mail)') +
      ' · ' + (role || '(no role)') + (bad.length ? '  [' + bad.join('; ') + ']' : ''));
  });

  // What they would find when they got there.
  var rows = (typeof rbAll_ === 'function') ? rbAll_() : [];
  out.push('', (rows.length ? '✅' : '❌') + '  ' + rows.length +
    ' renewals on the board' + (rows.length ? '' : ' — nothing to work; run the Salesforce sync'));

  ui.alert('Can they sign in?', out.join('\n'), ui.ButtonSet.OK);
}
