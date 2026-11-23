// Sasha's three-week rota (23 November 2026). Kamla's schedule "01-Oct-26 & Thereafter":
// Week 1 office only, 7am to 2pm, lunch at 2 ends the day; Weeks 2 and 3, 8 to 4, lunch 2 to 3,
// online 3 to 4. Week 1 is the week of 1 Oct 2026. Applied from 23 Nov; earlier days unchanged.
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };
const env = makeEnv();
let TODAY = '2026-11-23';
env.todayISO_ = () => TODAY;
const t = m => m == null ? null : env.twelve_(env.mmText_(m));
const at = d => { TODAY = d; const s = env.scheduleFor_('sasha'); return { h: s.hours, w: s.week || '', co: t(env.closeoutAt_('sasha')), lu: t(env.lunchOffAt_('sasha')), st: t(env.startFor_('sasha', d)) }; };

let x = at('2026-11-23');
ok('Mon 23 Nov: Sasha, in her own words, 7 to 2, her lunch at 2 ends the day (wins over the rota)', x.h === '7am – 2pm' && !x.w, x.h + ' ' + x.w);
ok('  start 7, close-out 1:30, no lunch e-mail', x.st === '7:00am' && x.co === '1:30pm' && x.lu == null, [x.st, x.co, x.lu].join(' '));
x = at('2026-11-30');
ok('Mon 30 Nov still 7 to 2', x.h === '7am – 2pm' && !x.w);
x = at('2026-12-04');
ok('Fri 4 Dec still 7 to 2', x.h === '7am – 2pm' && !x.w);
x = at('2026-12-07'); ok('Mon 7 Dec Week 2: 8 to 4', x.h === '8am – 4pm' && /Week 2/.test(x.w));
x = at('2026-12-14'); ok('Mon 14 Dec Week 3', /Week 3/.test(x.w));
x = at('2026-12-21'); ok('Mon 21 Dec Week 1 again', /Week 1/.test(x.w) && x.h === '7am – 2pm');
x = at('2027-01-11'); ok('Mon 11 Jan 2027 Week 1', /Week 1/.test(x.w));
x = at('2026-11-10'); ok('a past day keeps its recorded hours (10 Nov 7 to 3)', x.h === '7am – 3pm' && !x.w, x.h);
x = at('2026-11-19'); ok('19 Nov (before the rota) stays 8 to 4', x.h === '8am – 4pm' && !x.w, x.h);
TODAY = '2026-11-23';
ok('the other desks are unchanged', env.scheduleFor_('elizabeth', '2026-11-30').hours === env.SCHEDULE.elizabeth.hours && !env.scheduleFor_('azariah', '2026-11-30').week);
ok('the day block follows the week', env.scheduleFor_('sasha', '2026-12-21').blocks.KPI1.time === '7am – 2pm');
console.log(fails ? '\n' + fails + ' FAILED' : '\nAll passed'); process.exit(fails ? 1 : 0);
