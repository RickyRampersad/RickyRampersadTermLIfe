// Pages open at once (21 October 2026, 2026-10-21a).
//
// Ricky, 6:21am: "when I click my day to start my day ... It's not opening ... it's
// opening the script, but it's taking very long." Pinned here: the link answers with
// a light page and builds nothing; the light page's openPage() builds the same page the
// link used to, with the same checks; his day built ahead between 5 and 8:30 is handed
// over once, with when it was prepared, and every open after that is live; it stops
// building ahead once he has opened it; check-in from the page records without
// rebuilding it, his day and a staff day page alike; a wrong key is refused.
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };

const DAY = '2026-10-21';
const env = makeEnv();
env.todayISO_ = () => DAY;
let NOW = '06:10';
env.hhmm_ = () => NOW;
env.nothingToReport_ = () => false;
const built = [];
env.unitPage_ = (person, day) => { built.push(person.staffId + ' ' + day); return env.HtmlService.createHtmlOutput('<!doctype html><div class="w"><h1>My branch</h1><p>built ' + built.length + '</p></div>'); };
env.sdPage_ = (person, day) => env.HtmlService.createHtmlOutput('<div class="w">Your day · ' + person.staffId + '</div>');
env.replyPerson_ = (sid) => ({ staffId: sid, name: sid });
env.systemDayOn_ = () => true;
const signed = [], logged = [], sdIns = [];
env.signInFromPage_ = person => { signed.push(person.staffId); return { at: '06:12', first: signed.length === 1 }; };
env.dayLogMany_ = (day, acts) => logged.push(...acts);
env.sdCheckin_ = (person, day) => { sdIns.push(person.staffId); return { at: '07:01', first: true }; };
env.runlog_ = () => {};

const K = env.unitSig_('ricky');
const shell = env.doGet({ parameter: { rs: 'ricky', f: 'unit', k: K } }).getContent();
ok('the link answers at once, with a light page that builds nothing', /Opening your day/.test(shell) && /openPage\(P\)/.test(shell) && built.length === 0);
ok('the full page still opens from the link with full=1 (a phone with no script support)', /My branch/.test(env.doGet({ parameter: { rs: 'ricky', f: 'unit', k: K, full: '1' } }).getContent()));
built.length = 0;
ok('the light page carries only the link\'s own fields, safely', /"rs":"ricky"/.test(shell) && /"f":"unit"/.test(shell) && !/<\/script><script>alert/.test(env.doGet({ parameter: { rs: 'ricky', f: 'unit', k: '</script><script>alert(1)' } }).getContent()));
const full = env.openPage({ rs: 'ricky', f: 'unit', k: K });
ok('openPage builds the page the link used to', /My branch/.test(full) && built.length === 1);
ok('a wrong key is refused, nothing built', /That link is not right/.test(env.openPage({ rs: 'ricky', f: 'unit', k: 'nope' })) && built.length === 1);

// Built ahead: at 5:30, once per 40 minutes, handed over once.
env.PropertiesService.getScriptProperties().deleteProperty('fastpg_opened_ricky_' + DAY);
NOW = '04:50'; ok('not before 5am', env.fastPrebuildTick_() === '' && built.length === 1);
NOW = '05:30'; ok('at 5:30 his day is built ahead', /built in/.test(env.fastPrebuildTick_()) && built.length === 2);
NOW = '05:50'; ok('not again within 40 minutes', env.fastPrebuildTick_() === '' && built.length === 2);
NOW = '06:15'; ok('again after 40 minutes', /built in/.test(env.fastPrebuildTick_()) && built.length === 3);
NOW = '06:18';
const first = env.openPage({ rs: 'ricky', f: 'unit', k: K });
ok('his first tap gets it at once, saying when it was prepared', /Prepared at 6:15am|Prepared at 6:15/.test(first) && /built 3/.test(first) && built.length === 3, first.slice(0, 160));
ok('with a way to bring it up to date', /Bring it up to date/.test(first) && /"fresh":"1"/.test(first));
const second = env.openPage({ rs: 'ricky', f: 'unit', k: K });
ok('every open after that is live', /built 4/.test(second) && built.length === 4);
NOW = '07:00'; ok('once he has opened it, nothing more is built ahead', env.fastPrebuildTick_() === '' && built.length === 4);
NOW = '09:00'; env.PropertiesService.getScriptProperties().deleteProperty('fastpg_opened_ricky_' + DAY);
ok('not after 8:30', env.fastPrebuildTick_() === '');

// Check in from the page.
const r1 = env.checkInNow({ rs: 'ricky', f: 'unit', k: K });
ok('his check-in records there and then, on his day\'s log', r1.ok && r1.first && signed.join() === 'ricky' && logged.some(a => a.kind === 'checkin' && a.ref === 'ci:' + DAY) && built.length === 4);
ok('a wrong key: nothing recorded', env.checkInNow({ rs: 'ricky', f: 'unit', k: 'x' }).ok === false && signed.length === 1);
const kIn = env.replySig_('elizabeth', DAY, 'in');
const r2 = env.checkInNow({ rs: 'elizabeth', f: 'in', d: DAY, k: kIn });
ok('a staff check-in from her day page sets her day, no rebuild', r2.ok && sdIns.join() === 'elizabeth');
ok('yesterday\'s page cannot check in today', env.checkInNow({ rs: 'elizabeth', f: 'in', d: '2026-10-20', k: env.replySig_('elizabeth', '2026-10-20', 'in') }).ok === false);

// A staff day link opens the same way.
const kPlan = env.replySig_('elizabeth', DAY, 'plan');
ok('a staff day link: the light page, then her day', /Opening your day/.test(env.doGet({ parameter: { rs: 'elizabeth', d: DAY, f: 'plan', k: kPlan } }).getContent()) &&
  /Your day · elizabeth/.test(env.openPage({ rs: 'elizabeth', d: DAY, f: 'plan', k: kPlan })));

console.log(fails ? '\n' + fails + ' FAILED\n' : '\nall green\n');
process.exit(fails ? 1 : 0);
