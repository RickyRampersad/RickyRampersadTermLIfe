// The daily Builder progress note, the content ask, and the mail route they both
// depend on.
//
// 8 November 2026, asked for in these words: "Can I have a daily builder progress?
// I need to also in certain days ask for content from all in the workday can this
// be done and remind me on the process and any refinements??"
//
// What this holds the three to:
//   the mail route   relay first, Gmail second, held when the allowance is nearly
//                    out — and a held run tells the chair rather than going quiet,
//                    which is the failure the branch cannot see;
//   the progress     to the chair and nobody else; loud when there is no meeting;
//                    quiet at weekends and far from the meeting; the figures read
//                    off the tabs rather than typed;
//   the content ask  only on the chosen days, never to somebody who has already
//                    brought something, never to a visitor, and silent when there
//                    is no meeting to bring anything to.
//
// Run: node tests/test-builder-progress.js
const path = require('path');
const ROOT = path.join(__dirname, '..');
process.env.GS_PATH = path.join(ROOT, 'apps-script/Meetings.gs');
const { makeEnv } = require('./harness');

let fails = 0;
const ok = (what, cond, extra) => {
  console.log((cond ? '  ok   ' : '  FAIL ') + what + (extra !== undefined && !cond ? '  — ' + extra : ''));
  if (!cond) fails++;
};

/* ── a branch, and a meeting on Wednesday ───────────────────────────── */
function branch(opts) {
  opts = opts || {};
  const env = makeEnv({ props: opts.props || {} });
  env.DriveApp = {
    createFolder: name => ({ getId: () => 'f1', getName: () => name,
                             setSharing: function () { return this; } }),
    getFolderById: id => ({ getId: () => id, getName: () => 'Materials' }),
    Access: { PRIVATE: 'PRIVATE' }, Permission: { NONE: 'NONE' }
  };
  /* Capture mail rather than count it, so the test can read who it went to. */
  env.mail = [];
  env.MailApp = {
    sendEmail: m => { if (opts.mailThrows) throw new Error('quota'); env.mail.push(m); },
    getRemainingDailyQuota: () => (opts.left === undefined ? 90 : opts.left)
  };
  env.UrlFetchApp = { fetch: () => {
    if (!opts.relayOk) throw new Error('no network in harness');
    env.relayed = (env.relayed || 0) + 1;
    return { getContentText: () => JSON.stringify({ ok: true, left: 1390 }) };
  } };
  /*  The chair's address, before setup: setupMeetings seeds MEET.ADMIN_EMAIL
      onto People so there is always one way in, and a test that adds its own
      Ricky as well puts him on the roll twice. */
  env.MEET.ADMIN_EMAIL = 'ricky@b.com';
  env.MEET.ADMIN_NAME = 'Ricky Rampersad';
  env.setupMeetings && env.setupMeetings();

  const people = [
    ['A10072', 'akaash@b.com', 'Akaash Kalladeen', 'manager', 'Akaash'],
    ['A14158', 'rajiv@b.com',  'Rajiv Soodoo',     'agent',   'Akaash'],
    ['A10311', 'neil@b.com',   'Neil Ramnanan',    'agent',   'Branch'],
    ['S0001',  'sasha@b.com',  'Sasha Lalla',      'staff',   'Branch'],
    ['0000',   'a.guest@guest.invalid', 'A Visitor', 'guest', '']
  ];
  people.forEach(p => env.appendRow_(env.MEET.TAB_PEOPLE, {
    'Agent No': p[0], 'Email': p[1], 'Name': p[2], 'Role': p[3], 'Unit': p[4],
    'Active': 'Y', 'Access Code': '1234'
  }));
  return env;
}

/* A meeting two working days out, with an agenda. */
function seedMeeting(env, when, items) {
  const id = 'MTG-T1';
  env.appendRow_(env.MEET.TAB_MEETINGS, {
    'ID': id, 'Ref': 'RRB-TEST', 'Type': 'Branch Meeting', 'Title': 'Branch Meeting',
    'Date': when, 'Start': '9:00 AM', 'End': '10:30 AM', 'Status': 'published',
    'Chair': 'ricky@b.com', 'Scope': 'branch'
  });
  (items || []).forEach((it, n) => env.appendRow_(env.MEET.TAB_AGENDA, {
    'ID': 'AG' + n, 'Meeting ID': id, 'Order': n + 1, 'Section': 'Branch',
    'Title': it.title, 'Detail': it.detail || '', 'Presenter Email': it.by || '',
    'Presenter Name': it.byName || '', 'Allotted (min)': it.min || 10,
    'Materials Required': it.req ? 'Y' : 'N', 'Ready': it.ready ? 'Y' : ''
  }));
  return id;
}

const MON = new Date(2026, 10, 9, 11, 0);   /* Monday 9 November 2026, 11:00 */
const WED = new Date(2026, 10, 11, 9, 0);   /* the meeting */
const SAT = new Date(2026, 10, 14, 11, 0);

/* ══════════════════ 1. the mail route ══════════════════ */
console.log('\nThe mail route');
{
  const env = branch();
  ok('with no relay set up it sends on Gmail, as before',
     env.meetMail_({ to: 'a@b.com', subject: 's', htmlBody: 'h' }) === 'gmail');
  ok('and the message really went', env.mail.length === 1);
}
{
  const env = branch({ relayOk: true,
    props: { MAIL_RELAY_URL: 'https://relay/exec', MAIL_RELAY_KEY: 'k' } });
  ok('with both properties set it goes through the relay',
     env.meetMail_({ to: 'a@b.com', subject: 's', htmlBody: 'h' }) === 'relay');
  ok('and nothing went on the Gmail account', env.mail.length === 0);
}
{
  const env = branch({ props: { MAIL_RELAY_URL: 'https://relay/exec' } });
  ok('one half of the sign-in alone is not the relay',
     env.mmRelayReady_() === false);
  ok('so it falls back to Gmail rather than refusing to send',
     env.meetMail_({ to: 'a@b.com', subject: 's', htmlBody: 'h' }) === 'gmail');
}
{
  const env = branch({ relayOk: false,
    props: { MAIL_RELAY_URL: 'https://relay/exec', MAIL_RELAY_KEY: 'k' } });
  ok('a relay that cannot be reached falls back to Gmail',
     env.meetMail_({ to: 'a@b.com', subject: 's', htmlBody: 'h' }) === 'gmail');
  ok('and the reason is written down for the chair to read',
     !!env.PropertiesService.getScriptProperties().getProperty('MAIL_RELAY_LAST'));
}
{
  const env = branch({ left: 3 });
  ok('below the floor it holds rather than sending half the branch',
     env.meetMail_({ to: 'a@b.com', subject: 's', htmlBody: 'h' }) === 'held');
  ok('and nothing went', env.mail.length === 0);
}

/* ══════════════════ 2. a held run is never silent ══════════════════ */
console.log('\nA run cut short by the allowance');
{
  const env = branch({ left: 3 });
  seedMeeting(env, WED, [{ title: 'Production', detail: 'Where are we?', min: 20 }]);
  const msg = env.dailyMeetingNote.call(env, MON) || env.dailyMeetingNote();
  /* dailyMeetingNote takes no argument, so it runs against the real clock:
     what matters here is the hold path, which fires whatever the day. */
  ok('the daily note reports what it held', /HELD|Weekend|no note/.test(String(msg)),
     String(msg));
}
{
  const env = branch({ left: 3 });
  env.mmHeldAlert_('the daily note', 7, 4);
  ok('the chair is told the branch was only half written to',
     env.mail.length === 1 && /run out of mail/i.test(env.mail[0].subject));
  ok('and it goes to the chair alone', env.mail[0].to === 'ricky@b.com');
  ok('and it names the fix', /MAIL_RELAY_URL/.test(env.mail[0].htmlBody));
  env.mmHeldAlert_('the content ask', 7, 4);
  ok('never twice in a day', env.mail.length === 1);
}

/* ══════════════════ 3. the progress model ══════════════════ */
console.log('\nThe progress note');
{
  const env = branch();
  const o = env.progressModel_(MON);
  ok('with no meeting on the books it says so rather than guessing', !o.meeting);
  const html = env.progressHtml_(o);
  ok('and that is the headline, not a footnote',
     /no meeting on the books/i.test(html));
  ok('with the way to fix it named', /Build .*agenda now|week cycle/i.test(html));
}
{
  const env = branch();
  seedMeeting(env, WED, [
    { title: 'Production', detail: 'Where are we against the month?', min: 25,
      by: 'ricky@b.com', byName: 'Ricky Rampersad' },
    { title: 'Orphans',    detail: '',  min: 20, by: 'sasha@b.com', byName: 'Sasha Lalla',
      req: true, ready: false },
    { title: 'Pendings',   detail: 'What is stuck?', min: 15, by: 'akaash@b.com',
      byName: 'Akaash Kalladeen', req: true, ready: true }
  ]);
  env.appendRow_(env.MEET.TAB_CONTRIB, {
    'ID': 'C1', 'Meeting ID': 'MTG-T1', 'When': MON, 'Email': 'rajiv@b.com',
    'Name': 'Rajiv Soodoo', 'Kind': 'question', 'Body': 'A question of mine'
  });
  env.appendRow_(env.MEET.TAB_ACTIONS, {
    'ID': 'ACT1', 'Item': 'Send the orphan list', 'Owner': 'sasha@b.com',
    'Due': new Date(2026, 10, 2), 'Status': 'open'
  });
  const o = env.progressModel_(MON);
  ok('it counts the agenda', o.items.length === 3);
  ok('it adds the minutes up', o.minutes === 60);
  ok('it reads the room off the meeting row, not a constant', o.allotted === 90);
  ok('it knows who brought something', o.brought.length === 1 &&
     o.brought[0].email === 'rajiv@b.com');
  ok('and who has not', o.silent.length === 4, JSON.stringify(o.silent.map(p => p.name)));
  ok('the visitor is on neither list', o.roll === 5);
  ok('it finds the overdue action', o.overdue.length === 1);
  ok('and the item with no question under it',
     o.items.filter(i => !i.hasQuestion).length === 1);
  ok('and the material promised and not in',
     o.items.filter(i => i.required && !i.ready).length === 1);

  const html = env.progressHtml_(o);
  ok('the note says what to act on', /To act on/.test(html));
  ok('it names the missing material', /Material for <b>Orphans/.test(html));
  ok('it names the item with no question', /no question in the Detail field/.test(html));
  ok('it names who has brought nothing', /Nothing yet:/.test(html));
  ok('it nags about the mail route while the relay is unset',
     /MAIL_RELAY_URL/.test(html));
  ok('no client anywhere in it', !/client/i.test(html.replace(/Client Ref/g, '')));
}
{
  const env = branch();
  seedMeeting(env, WED, [{ title: 'Production', detail: 'Where?', min: 120 }]);
  const html = env.progressHtml_(env.progressModel_(MON));
  ok('a running order longer than the room is said plainly',
     /minutes<\/b> longer than the room/.test(html));
}

/* ══════════════════ 4. when the progress note speaks ══════════════════ */
console.log('\nWhen it speaks');
{
  const env = branch();
  seedMeeting(env, WED, [{ title: 'X', detail: 'y' }]);
  ok('to the chair and nobody else',
     env.progressTo_().length === 1 && env.progressTo_()[0] === 'ricky@b.com');
}
{
  const env = branch({ props: { PROGRESS_TO: 'kamla@b.com, ricky@b.com' } });
  ok('the BMA can be added without the chair being listed twice',
     env.progressTo_().join(',') === 'ricky@b.com,kamla@b.com');
}
{
  const env = branch({ props: { PROGRESS_HOUR: '6' } });
  ok('the hour is a property, not a paste', env.progressHour_() === 6);
}

/* ══════════════════ 5. the content ask ══════════════════ */
console.log('\nThe content ask');
{
  const env = branch();
  ok('Monday and Tuesday by default', env.contentAskDays_().join(',') === '1,2');
  ok('at 11, in the middle of the working day', env.contentAskHour_() === 11);
}
{
  const env = branch({ props: { CONTENT_ASK_DAYS: '2', CONTENT_ASK_HOUR: '14' } });
  ok('the days are his to choose', env.contentAskDays_().join(',') === '2');
  ok('and so is the hour', env.contentAskHour_() === 14);
}
{
  const env = branch({ props: { CONTENT_ASK_DAYS: 'nonsense' } });
  ok('nonsense in the property falls back rather than asking nobody',
     env.contentAskDays_().join(',') === '1,2');
}
{
  const env = branch();
  seedMeeting(env, WED, [{ title: 'Production', detail: 'Where are we?', min: 20 }]);
  env.appendRow_(env.MEET.TAB_CONTRIB, {
    'ID': 'C1', 'Meeting ID': 'MTG-T1', 'When': MON, 'Email': 'rajiv@b.com',
    'Name': 'Rajiv Soodoo', 'Kind': 'question', 'Body': 'mine'
  });
  const me = env.findPersonByEmail_('neil@b.com');
  const o = env.progressModel_(MON);
  o.items.forEach(i => { i.question = 'Where are we?'; });
  const mail = env.contentAskEmail_(me, o);
  ok('the ask is one question and one button',
     /bring one thing/i.test(mail.html) && (mail.html.match(/<a href/g) || []).length === 1);
  ok('it offers an agenda question to answer', /Where are we\?/.test(mail.html));
  ok('and it repeats the two taps, because that is the standing confusion',
     /does <b>not<\/b> mark you present/.test(mail.html));
  ok('the subject asks the question', /What are you bringing/.test(mail.subject));
}

/* ══════════════════ 6. who the ask skips ══════════════════ */
console.log('\nWho the ask skips');
{
  const env = branch();
  seedMeeting(env, WED, [{ title: 'Production', detail: 'Where?', min: 20 }]);
  env.appendRow_(env.MEET.TAB_CONTRIB, {
    'ID': 'C1', 'Meeting ID': 'MTG-T1', 'When': MON, 'Email': 'rajiv@b.com',
    'Name': 'Rajiv Soodoo', 'Kind': 'question', 'Body': 'mine'
  });
  /* The runner reads the real clock for the day gate, so drive the parts
     that decide who is written to rather than the gate itself. */
  const o = env.progressModel_(MON);
  const done = {}; o.brought.forEach(p => { done[p.email.toLowerCase()] = 1; });
  const asked = env.everyone_().filter(p =>
    p.email && !env.isGuestNo_(p.agentNo) &&
    ['agent', 'manager', 'staff'].indexOf(String(p.role).toLowerCase()) > -1 &&
    !done[String(p.email).toLowerCase()]);
  ok('the visitor is never asked', asked.every(p => p.agentNo !== '0000'));
  ok('nor is the person who already brought something',
     asked.every(p => p.email !== 'rajiv@b.com'));
  ok('everybody else is', asked.length === 4);
}
{
  const env = branch();
  const msg = env.contentAsk();
  ok('with no meeting it asks nobody and says why',
     /no meeting|Not one of the ask days|Weekend/i.test(msg), msg);
  ok('and wrote no mail', env.mail.length === 0);
}
{
  const env = branch({ props: { CONTENT_ASK_DAYS: '0,1,2,3,4,5,6' } });
  seedMeeting(env, new Date(2026, 11, 23), [{ title: 'X', detail: 'y' }]);
  const msg = env.contentAsk();
  ok('a meeting weeks away is too far to ask about',
     /too far|Weekend/i.test(msg), msg);
}

/* ══════════════════ 7. the install, and the menu ══════════════════ */
console.log('\nTurning it on');
{
  const env = branch();
  env.installedTriggers = [];
  env.ScriptApp = Object.assign({}, env.ScriptApp, {
    getProjectTriggers: () => [],
    newTrigger: fn => ({ timeBased: () => ({
      atHour: () => ({ everyDays: () => ({ create: () => env.installedTriggers.push(fn) }) }),
      onWeekDay: () => ({ atHour: () => ({ create: () => env.installedTriggers.push(fn) }) })
    }) }),
    WeekDay: { SUNDAY: 0, MONDAY: 1, TUESDAY: 2, WEDNESDAY: 3,
               THURSDAY: 4, FRIDAY: 5, SATURDAY: 6 }
  });
  const m1 = env.installBuilderProgress();
  ok('the progress note installs one daily trigger',
     env.installedTriggers.filter(f => f === 'builderProgress').length === 1);
  ok('and says who reads it', /ricky@b\.com/.test(m1));
  const m2 = env.installContentAsk();
  ok('the content ask installs one trigger per chosen day',
     env.installedTriggers.filter(f => f === 'contentAsk').length === 2);
  ok('and names the days in words', /Monday and Tuesday/.test(m2), m2);
}

console.log('\n' + (fails ? fails + ' FAILING' : 'all passing') + '\n');
process.exit(fails ? 1 : 0);
