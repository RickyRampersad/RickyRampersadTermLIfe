// No AI for the staff (27 October 2026).
//
// Ricky, 7:28am: "Also do not give the staff any AI features". Pinned here: the
// day page's task card has no "Draft with Claude" and its wording does not
// offer Claude; the card refuses a draft even if asked; Kamla's "What is not
// getting attention" does not call Claude, while Mr Rampersad's still does;
// the week's Best Note is the longest note, never Claude's pick; and the
// Script Property STAFF_AI = on brings it back.
const { makeEnv } = require('./harness');
let fails = 0;
const ok = (l, c, x = '') => { console.log((c ? '  PASS  ' : '  FAIL  ') + l + (x ? '  ' + x : '')); if (!c) fails++; };

const DAY = '2026-10-27';
const env = makeEnv();
env.todayISO_ = () => DAY;
env.__mkSheet('Access', 1, ['Name', 'StaffId', 'Email', 'Password', 'Role', 'Unit', 'Active'],
  [['Ricky Rampersad', 'ricky', 'ricky@example.com', '1', 'Branch Manager', 'Branch', 'Yes'],
   ['Sasha Lalla-Jagassar', 'sasha', 'sasha@example.com', '1', 'Sales Support Assistant', 'Support', 'Yes'],
   ['Kamla Dookran', 'kamla', 'kamla@example.com', '1', "Branch Manager's Assistant", 'Branch', 'Yes']]);
const props = env.PropertiesService.getScriptProperties();
props.setProperty('ANTHROPIC_API_KEY', 'test-key-not-real');
let fetched = 0; env.UrlFetchApp = { fetch: () => { fetched++; throw new Error('no network in tests'); }, fetchAll: () => { fetched++; throw new Error('no network'); } };

console.log('\nThe task card:\n');
const t = { id: '00T1', s: 'Change of address - 8001234567', due: DAY };
const card = env.tcardHtml_(t, env.tcardPlaybook_ ? null : null, DAY);
ok('no "Draft with Claude" on a staff task card', !/Draft with Claude/.test(card) && !/Claude/.test(card), (card.match(/Claude[^<]{0,40}/) || [''])[0]);
ok('it offers templates and their own note', /Tap a template, or write your own note/.test(card));
const sig = env.replySig_('sasha', DAY, 'card');
env.bigPut_('sd_list_sasha_' + DAY, [t]);
env.rosterPerson_ = sid => ({ staffId: sid, name: 'Sasha Lalla-Jagassar' });
env.replyPerson_ = sid => ({ staffId: sid, name: 'Sasha Lalla-Jagassar' });
env.cmdChatter_ = () => ({});
fetched = 0;
const r = env.cardAct_({ rs: 'sasha', d: DAY, k: sig, act: 'draft', id: '00T1', note: 'called client updated address' });
ok('the card refuses a draft, and Claude is never called', r && r.ok === false && /yourself|template/i.test(r.error) && fetched === 0, JSON.stringify(r));

console.log('\nWhat is not getting attention:\n');
let reads = []; env.cmdClaudeRead_ = (items, ctx) => { reads.push(1); return {}; };
env.cmdItems_ = () => []; env.cmdTargets_ = () => [];
try { env.cmdReplyPage_({ staffId: 'kamla', name: 'Kamla Dookran' }, DAY, '', ''); } catch (e) { console.log('    (page: ' + e.message + ')'); }
ok('Kamla\'s page does not ask Claude', reads.length === 0);
try { env.cmdReplyPage_({ staffId: 'ricky', name: 'Ricky Rampersad' }, DAY, '', ''); } catch (e) { console.log('    (page: ' + e.message + ')'); }
ok('Mr Rampersad\'s still does', reads.length === 1);

console.log('\nThe Best Note:\n');
fetched = 0;
const bn = env.gameBestNote_([{ sid: 'sasha', s: 'A', n: 'Short note' }, { sid: 'elizabeth', s: 'B', n: 'A much longer note with the outcome and the next step' }], DAY, '2026-10-21');
ok('the longest proper note, Claude not asked', bn && bn.sid === 'elizabeth' && fetched === 0, JSON.stringify(bn));

console.log('\nThe switch:\n');
props.setProperty('STAFF_AI', 'on');
ok('STAFF_AI = on brings the button back', /Draft with Claude/.test(env.tcardHtml_(t, null, DAY)));
reads = []; try { env.cmdReplyPage_({ staffId: 'kamla', name: 'Kamla Dookran' }, DAY, '', ''); } catch (e) { console.log('    (page: ' + e.message + ')'); }
ok('and Kamla\'s read', reads.length === 1);
props.deleteProperty('STAFF_AI');
ok('off again without it', !/Draft with Claude/.test(env.tcardHtml_(t, null, DAY)) && env.staffAi_() === false);
ok('the desks are staff; Mr Rampersad and the Unit Managers are not', env.staffDesk_('sasha') && env.staffDesk_('kamla') && env.staffDesk_('pawan') && !env.staffDesk_('ricky') && !env.staffDesk_(env.UM_DESKS[0]));

console.log(fails ? '\n' + fails + ' FAILED' : '\nAll passed');
process.exit(fails ? 1 : 0);
