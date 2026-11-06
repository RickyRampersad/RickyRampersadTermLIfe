// The big day copies in the '_store' tab, not Script Properties (6 November 2026).
//
// Ricky, 3:04pm: "The tracker's storage is nearly full": 490 KB of 500 in 1,658 entries, almost all day
// copies (unit_inbox_, intel_model_, sd_list_, cmd_items_, ix_deep_, bm_deep_, lead_) in 7.8 KB chunks.
// Pinned here:
//   - put/get round trip through the tab, nothing left in Script Properties
//   - a value over one cell (>50,000 chars) split across columns and read back whole
//   - a key still in the old property chunks is read, moved into the tab and the chunks deleted
//   - the daily trim drops old days from the tab and keeps the window
//   - storeCleanupNow empties the old copies out of Script Properties and says so
//   - cmdStore_/cmdLoad_ go through the tab too
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };

const DAY = '2026-11-06';
const env = makeEnv();
env.todayISO_ = () => DAY;
const P = env.PropertiesService.getScriptProperties();
const fresh = () => env.bigStoreForget_();

console.log('\nRound trip:\n');
env.bigPut_('unit_inbox_ricky_' + DAY, [{ id: 'a', s: 'one' }]);
fresh();
ok('read back from the tab', env.bigGet_('unit_inbox_ricky_' + DAY, [])[0].s === 'one');
ok('nothing in Script Properties', P.getProperty('unit_inbox_ricky_' + DAY) == null);
ok('the tab exists with a header', env.__sheets._store && env.__sheets._store._grid[0][0] === 'key');
env.bigPut_('unit_inbox_ricky_' + DAY, [{ id: 'b', s: 'two' }]);
fresh();
ok('a second put updates the same row', env.bigGet_('unit_inbox_ricky_' + DAY, [])[0].s === 'two' &&
   env.__sheets._store._grid.filter(r => r[0] === 'unit_inbox_ricky_' + DAY).length === 1);
ok('a missing key gives the default', env.bigGet_('nope_' + DAY, 'D') === 'D');

console.log('\nA value bigger than one cell:\n');
const huge = { t: 'z'.repeat(120000) };
env.bigPut_('intel_model_kamla_' + DAY, huge);
fresh();
const row = env.__sheets._store._grid.find(r => r[0] === 'intel_model_kamla_' + DAY);
ok('split across columns', Number(row[2]) === 3, row && row[2]);
ok('read back whole', env.bigGet_('intel_model_kamla_' + DAY, {}).t.length === 120000);

console.log('\nThe old property chunks, moved on read:\n');
const old = JSON.stringify(Array.from({ length: 30 }, (_, i) => ({ id: i, s: 'x'.repeat(500) })));
P.setProperty('sd_list_azariah_' + DAY, old.slice(0, 8000));
P.setProperty('sd_list_azariah_' + DAY + '_1', old.slice(8000, 16000));
P.setProperty('sd_list_azariah_' + DAY + '_n', '2');
fresh();
ok('read from the old chunks', env.bigGet_('sd_list_azariah_' + DAY, []).length === 30);
ok('the chunks deleted', P.getProperty('sd_list_azariah_' + DAY) == null && P.getProperty('sd_list_azariah_' + DAY + '_1') == null && P.getProperty('sd_list_azariah_' + DAY + '_n') == null);
fresh();
ok('and now read from the tab', env.bigGet_('sd_list_azariah_' + DAY, []).length === 30);

console.log('\nThe daily trim:\n');
env.bigPut_('lead_2026-11-01', { a: 1 });            // past three days
env.bigPut_('ix_deep_2026-11-05', { a: 1 });         // an AI review from yesterday
env.bigPut_('lead_2026-11-04', { a: 1 });            // inside the window
env.bigPut_('ix_deep_' + DAY, { a: 1 });             // today's review
const n = env.bigStoreTrim_(DAY);
fresh();
const keys = env.__sheets._store._grid.slice(1).map(r => r[0]);
ok('old days gone', keys.indexOf('lead_2026-11-01') < 0 && keys.indexOf('ix_deep_2026-11-05') < 0, n);
ok('inside the window kept', keys.indexOf('lead_2026-11-04') > -1 && keys.indexOf('ix_deep_' + DAY) > -1);
ok('values still read after the trim', env.bigGet_('unit_inbox_ricky_' + DAY, [])[0].s === 'two');

console.log('\nstoreCleanupNow:\n');
const piece = 'q'.repeat(7900);
['unit_mine_ricky_2026-10-20', 'unit_mine_ricky_' + DAY, 'bm_deep_2026-11-02', 'cmd_items_kamla_' + DAY].forEach(k => {
  P.setProperty(k, JSON.stringify({ p: piece }));
});
P.setProperty('cover_back_sasha', '{}');
P.setProperty('daystart_first_kamla_' + DAY, '07:31');
const msg = env.storeCleanupNow();
ok('says before and after', /KB before, \d+ KB after/.test(msg), msg);
ok('old copies deleted', P.getProperty('unit_mine_ricky_2026-10-20') == null && P.getProperty('bm_deep_2026-11-02') == null);
ok('current copies moved out of properties', P.getProperty('unit_mine_ricky_' + DAY) == null && P.getProperty('cmd_items_kamla_' + DAY) == null);
fresh();
ok('and readable from the tab', env.bigGet_('unit_mine_ricky_' + DAY, {}).p === piece);
ok('small marks and settings untouched', P.getProperty('cover_back_sasha') === '{}' && P.getProperty('daystart_first_kamla_' + DAY) === '07:31');

console.log('\nThe command page items:\n');
env.cmdStore_('ricky', DAY, [{ id: '00T1' }, { id: '00T2' }]);
fresh();
ok('cmdLoad_ reads them back', env.cmdLoad_('ricky', DAY).length === 2 && P.getProperty('cmd_items_ricky_' + DAY) == null);

console.log(fails ? '\n' + fails + ' FAILED' : '\nAll passed');
process.exit(fails ? 1 : 0);
