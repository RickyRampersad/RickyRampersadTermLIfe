// Sasha's close-out notice at 1:30pm while she is on 7 to 3 with lunch at 2 (23 Nov to 4 Dec 2026).
// Mr Rampersad, 23 Nov 2:30pm: "you need to have Sasha's closeout notice at 1:30".
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };
const env = makeEnv();
let TODAY = '2026-11-23'; env.todayISO_ = () => TODAY;
ok('23 Nov: Sasha 1:30pm', env.closeoutAt_('sasha') === 13 * 60 + 30, env.closeoutAt_('sasha'));
TODAY = '2026-12-04'; ok('4 Dec: still 1:30pm', env.closeoutAt_('sasha') === 13 * 60 + 30);
TODAY = '2026-12-07'; ok('7 Dec (rota, 8 to 4): back to 3:15', env.closeoutAt_('sasha') === 15 * 60 + 15, env.closeoutAt_('sasha'));
TODAY = '2026-11-23'; ok('Liz unchanged 3:15', env.closeoutAt_('elizabeth') === 15 * 60 + 15);
ok('her morning: start 7am', env.startFor_('sasha', '2026-11-23') === 7 * 60, env.startFor_('sasha', '2026-11-23'));
ok('version 2026-11-23f', env.SCRIPT_VERSION === '2026-11-23f');
console.log(fails ? fails + ' FAILED' : 'all passed'); process.exit(fails ? 1 : 0);
