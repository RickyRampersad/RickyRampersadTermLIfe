// The standing order, and the two steps that used to be a press nobody made.
//
// 10 November 2026, the branch manager: "I'm not seeing the staff being held
// accountable ... Kamla is the BMA, she's responsible for training ... Also the
// three staff, Azariah, Liz, every morning we send things ... Akaash is the
// manager for his unit, and he makes a contribution ... I'm not seeing go back,
// deep dive into what we agreed on."
//
// What it holds the script to:
//   the rota      fourteen items, ninety minutes exactly, nobody over a third;
//                 every item either named, rotating, or the room's — and the four
//                 people he named each carrying their own;
//                 no e-mail address written into a published file.
//   the agenda    writes the rota itself when there is none, rather than
//                 returning an error that names a menu item.
//   Wednesday     carries last week's still-open actions forward by itself, and
//                 still builds the meeting when that cannot be done.
//
// Run: node tests/test-standing-order.js
const path = require('path');
const ROOT = path.join(__dirname, '..');
process.env.GS_PATH = path.join(ROOT, 'apps-script/Meetings.gs');
const { makeEnv } = require('./harness');
const env = makeEnv();
let fails = 0;
const ok = (what, cond, extra) => {
  console.log((cond ? '  ok   ' : '  FAIL ') + what + (extra !== undefined && !cond ? '  — ' + extra : ''));
  if (!cond) fails++;
};
env.DriveApp = {
  createFolder: name => ({ getId: () => 'folder-1', getName: () => name,
                           setSharing: function () { return this; } }),
  getFolderById: id => ({ getId: () => id, getName: () => 'Materials' }),
  Access: { PRIVATE: 'PRIVATE' }, Permission: { NONE: 'NONE' }
};
env.setupMeetings();

/* ── the rota ──────────────────────────────────────────────────────────── */
console.log('\nthe standing order');
env.seedRota();
const rota = env.readTab_(env.MEET.TAB_ROTA);
const mins = rota.reduce((t, r) => t + Number(r['Minutes'] || 0), 0);
ok('fourteen items', rota.length === 14, String(rota.length));
ok('ninety minutes exactly, which the wall template depends on', mins === 90, String(mins));

const by = {};
rota.forEach(r => {
  const k = String(r['Owner'] || '').trim() ||
            (String(r['Cadence']) === 'chair' ? '(chair)' : '(' + r['Cadence'] + ')');
  by[k] = (by[k] || 0) + Number(r['Minutes'] || 0);
});
ok('nobody holds more than a third of it',
  Math.max(...Object.values(by)) / mins <= 0.34, JSON.stringify(by));
ok('the chair holds twenty of the ninety', by['(chair)'] === 20, String(by['(chair)']));

const owner = t => (rota.filter(r => new RegExp(t).test(String(r['Item'])))[0] || {})['Owner'];
ok('the unit manager owns the call list', /Akaash/.test(owner('call list')), owner('call list'));
ok('the BMA owns training and staffing, in her own name',
  /Kamla/.test(owner('Training and staffing')), owner('Training and staffing'));
ok('and that item is not the rotating lesson',
  /Not the manager, and not the BMA/.test(
    String((rota.filter(r => /one point/.test(String(r['Item'])))[0] || {})['Detail'])));
const desks = rota.filter(r => String(r['Visibility']) === 'staff');
ok('the one staff report is three, one a desk', desks.length === 3, String(desks.length));
ok('each desk is named, and they are three different people',
  new Set(desks.map(d => String(d['Owner']))).size === 3,
  JSON.stringify(desks.map(d => d['Owner'])));
ok('and the three together cost what the one report cost',
  desks.reduce((t, d) => t + Number(d['Minutes']), 0) === 8);
ok('the open floor is the room\'s, so it is asked of nobody',
  /^Everyone$/.test(String(owner('Open floor'))), owner('Open floor'));
ok('two items still come round the room',
  rota.filter(r => String(r['Cadence']) === 'rotate').length === 2);
ok('every item is somebody\'s, rotates, or is the room\'s, except the two the branch decides',
  rota.filter(r => !String(r['Owner']).trim() && String(r['Cadence']) === 'fixed').length === 2,
  JSON.stringify(rota.filter(r => !String(r['Owner']).trim() &&
    String(r['Cadence']) === 'fixed').map(r => r['Item'])));
ok('NO E-MAIL ADDRESS IS WRITTEN INTO A PUBLISHED FILE',
  rota.every(r => !String(r['Owner Email']).trim() && !String(r['Backup Email']).trim()));
/*  The refusal names how many rows it found, so match on what it means
    rather than on its wording — and check the tab really is untouched,
    which is the thing being guarded. */
(() => {
  const before = JSON.stringify(env.readTab_(env.MEET.TAB_ROTA));
  const said = env.seedRota();
  ok('running it again leaves the tab alone',
    /already has .*row/.test(said) &&
    JSON.stringify(env.readTab_(env.MEET.TAB_ROTA)) === before, said);
  /*  Only a replace asked for in so many words gets past it, and it
      replaces rather than appending: found on the live sheet on 10
      November 2026 with eleven items from an earlier seeding and every
      Owner cell blank, which is the accountability panel's whole input. */
  env.seedRota({ replace: true });
  const after = env.readTab_(env.MEET.TAB_ROTA);
  ok('a replace writes the rota afresh instead of appending',
    after.length === rota.length, after.length + ' vs ' + rota.length);
  ok('and the owners are there again',
    after.filter(r => String(r['Owner']).trim()).length ===
      rota.filter(r => String(r['Owner']).trim()).length);
})();

/* ── the agenda writes the rota itself ─────────────────────────────────── */
console.log('\nthe agenda, with no rota');
(() => {
  const sh = env.tab_(env.MEET.TAB_ROTA);
  while (sh.getLastRow() > 1) sh.deleteRow(2);
  ok('the rota is empty to start with', env.rotaRows_().length === 0);
  env.appendRow_(env.MEET.TAB_MEETINGS, {
    'ID': 'MTG-A', 'Ref': 'RRB-2026-11-11', 'Type': 'Branch Meeting', 'Title': 'Branch Meeting',
    'Date': new Date(2026, 10, 11), 'Start': '9:00 AM', 'End': '10:30 AM',
    'Chair': env.MEET.ADMIN_EMAIL, 'Status': 'scheduled', 'Scope': 'branch'
  });
  const out = env.seedAgendaInto_(env.findMeeting_('MTG-A'), env.MEET.ADMIN_EMAIL);
  ok('it seeds one and carries on, rather than naming a menu item',
    out.ok && out.added === 14, JSON.stringify(out));
  const ag = env.readTab_(env.MEET.TAB_AGENDA).filter(a => String(a['Meeting ID']) === 'MTG-A');
  ok('and the agenda arrives already named',
    ag.filter(a => String(a['Presenter Name']).trim()).length >= 10,
    String(ag.filter(a => String(a['Presenter Name']).trim()).length) + ' of ' + ag.length);
  ok('the BMA is on it by name', ag.some(a => /Kamla/.test(String(a['Presenter Name']))));
  const load = env.loadOf_(env.findMeeting_('MTG-A'), ag);
  ok('and no one person is over a third of the room\'s time',
    load.people.every(x => x.shareMinutes <= 34),
    JSON.stringify(load.people.map(x => x.name + ' ' + x.shareMinutes + '%')));
})();

/* ── Wednesday carries last week's actions forward ─────────────────────── */
console.log('\nlast week\'s agreed actions');
(() => {
  env.appendRow_(env.MEET.TAB_ACTIONS, {
    'ID': 'ACT-1', 'Meeting ID': 'MTG-OLD', 'Item': 'Bring the lapsed names',
    'Owner': 'A Unit Manager', 'Status': 'Open', 'Origin Meeting': 'MTG-OLD'
  });
  env.appendRow_(env.MEET.TAB_ACTIONS, {
    'ID': 'ACT-2', 'Meeting ID': 'MTG-OLD', 'Item': 'A thing already done',
    'Owner': 'Support One', 'Status': 'Complete', 'Origin Meeting': 'MTG-OLD'
  });
  const out = env.carryForwardInto_(env.findMeeting_('MTG-A'));
  ok('every still-open action comes over', out.carried === 1, JSON.stringify(out));
  const here = env.readTab_(env.MEET.TAB_ACTIONS).filter(a => String(a['Meeting ID']) === 'MTG-A');
  ok('with the meeting it was first raised in kept',
    here.length === 1 && String(here[0]['Origin Meeting']) === 'MTG-OLD',
    JSON.stringify(here.map(a => a['Origin Meeting'])));
  ok('what was finished is left behind', !here.some(a => /already done/.test(String(a['Item']))));
  ok('and running it twice does not double them',
    env.carryForwardInto_(env.findMeeting_('MTG-A')).carried === 0);
})();

console.log('\nthe Wednesday builder');
(() => {
  /*  A carry-forward that throws must never be the reason the branch has no
      meeting to sign in to. */
  /*  Today is whatever day it is, so the builder is told that today is the
      meeting day — otherwise this whole block passes by not running. */
  const day = env.MEET.MEETING_DAY;
  env.MEET.MEETING_DAY = new Date().getDay();
  env.appendRow_(env.MEET.TAB_ACTIONS, {
    'ID': 'ACT-3', 'Meeting ID': 'MTG-OLD', 'Item': 'Still open from last week',
    'Owner': 'Support Two', 'Status': 'Open', 'Origin Meeting': 'MTG-OLD'
  });
  const good = env.buildWednesday();
  ok('it writes the meeting, the agenda and the open actions in one run',
    /meeting created/.test(good) && /items written from the rota/.test(good) &&
    /carried forward/.test(good), good);

  const real = env.carryForwardInto_;
  env.carryForwardInto_ = () => { throw new Error('the tab is at its cell limit'); };
  const bad = env.buildWednesday();
  env.carryForwardInto_ = real;
  env.MEET.MEETING_DAY = day;
  ok('a meeting is still there when the actions will not copy', /meeting/.test(bad), bad);
  ok('and the log says so rather than going quiet', /did not carry/.test(bad), bad);
})();

console.log(fails ? '\n' + fails + ' FAILED' : '\nall passing');
process.exit(fails ? 1 : 0);
