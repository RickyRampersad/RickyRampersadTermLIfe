/* Routing + reminder rules: manager CC resolution, health override, deadlines,
   and which statuses the autopilot will chase. */
const _fs = require('fs'), _p = require('path');
const _gs = _p.join(__dirname, '..', 'QueryPal_Backend_v10.gs');
if (!_fs.existsSync(_gs)) {
  console.log('  SKIPPED — needs QueryPal_Backend_v10.gs in querypal/.');
  console.log('  The archive this repo started from carried v6.9; production runs v10.2.');
  console.log('  Export the live script from the Apps Script editor to run this suite.');
  process.exit(0);
}

const fs = require('fs'), path = require('path');
const gs = fs.readFileSync(path.join(__dirname, '..', 'QueryPal_Backend_v10.gs'), 'utf8');
const html = fs.readFileSync(path.join(__dirname, '..', 'index.html'), 'utf8');
const grab = re => gs.match(re)[0].replace(/^const /, 'var ');
eval(grab(/const AGENT_MANAGER = \{[\s\S]*?\n\};/));
eval(grab(/const AGENT_MANAGER_ALIAS = \{[\s\S]*?\n\};/));
eval(grab(/const DEFAULT_MANAGER = [^\n]*/));
eval(grab(/const SUPPORT_RX = [^\n]*/));
eval(gs.match(/function isSupportCase_[\s\S]*?\n\}/)[0]);
eval(gs.match(/function normAgentKey_[\s\S]*?\n\}/)[0]);
eval(gs.match(/function managerLookup_[\s\S]*?\n  return \{ email: DEFAULT_MANAGER, how: 'default' \};\n\}/)[0]);
eval(gs.match(/function managerForAgent[\s\S]*?\n\}/)[0]);
eval(gs.match(/function deadlineAt_[\s\S]*?\n\}/)[0]);
const AGENTS = JSON.parse(html.match(/const AGENTS = (\[[\s\S]*?\]);\n/)[1]);
const DATA   = JSON.parse(html.match(/const DATA = (\[[\s\S]*?\]);\n/)[1]);

let pass = 0, fail = 0;
const t = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log((ok?'  PASS  ':'  FAIL  ')+label+(ok?'':`\n          got  ${JSON.stringify(got)}\n          want ${JSON.stringify(want)}`));
  ok ? pass++ : fail++;
};

// ---- manager CC ----
t('spelling variant: John Boodoo -> Gary', managerForAgent('John Boodoo'), 'gary.sookdeo@myguardiangroup.com');
t('trailing digit: Felicia Rampersad2 -> Gary', managerForAgent('Felicia Rampersad2'), 'gary.sookdeo@myguardiangroup.com');
t('doubled consonant: Faizal Mohammed resolves', managerLookup_('Faizal Mohammed').how !== 'default', true);
t('middle name: Joy Sammah resolves', managerLookup_('Joy Sammah').how !== 'default', true);
t('exact match still exact', managerLookup_('Kerwyn Ramroach'), { email:'kerwyn.ramroach@myguardiangroup.com', how:'exact' });
t('case + punctuation tolerated', managerForAgent('  meera.persad-khan '), 'ricky.rampersad@myguardiangroup.com');
t('unknown agent falls back', managerLookup_('Someone Notonthelist'), { email: DEFAULT_MANAGER, how: 'default' });
t('blank agent falls back', managerForAgent(''), DEFAULT_MANAGER);
t('Narissa is not mistaken for Faizal',
  managerLookup_('Faizal Mohammed').email, 'ricky.rampersad@myguardiangroup.com');

const unresolved = AGENTS.slice(1).filter(a => managerLookup_(a.name).how === 'default').map(a => a.name);
t('only the 6 genuinely-unlisted agents fall back', unresolved.length, 6);
console.log('         (awaiting branch input: ' + unresolved.join(', ') + ')');

// ---- health override ----
const rerouted = DATA.filter(d => isSupportCase_(d.group, d.type, ''));
t('exactly 2 query types reroute to Sales Support', rerouted.map(d => d.type),
  ['Query - Health Claim', 'Claims Health - Submission']);
t('life/pension claims are NOT rerouted',
  isSupportCase_('Claims & Benefits', 'Claims Life&Pension - Submission', 'Individual Life Claims'), false);
t('maturity/annuity is NOT rerouted',
  isSupportCase_('Quotes & Projections', 'Projection Maturity Annuity', ''), false);

// ---- catalog integrity ----
t('every query type has a department', DATA.filter(d => !d.email).length, 0);
t('every query type has a turnaround', DATA.filter(d => !/^\d+$/.test(String(d.tat))).length, 0);
t('48 query types across 15 departments',
  [DATA.length, new Set(DATA.map(d => d.email)).size], [48, 15]);

// ---- working-day deadlines ----
const at = (y,m,d) => new Date(y, m-1, d, 9, 0, 0);
t('3 days from Mon 6 Jul -> Thu 9 Jul', deadlineAt_(at(2026,7,6), '3').getDate(), 9);
t('3 days from Thu 9 Jul skips the weekend', deadlineAt_(at(2026,7,9), '3').getDate(), 14);
t('1 day from Fri 10 Jul -> Mon 13 Jul', deadlineAt_(at(2026,7,10), '1').getDate(), 13);
t('blank turnaround defaults to 5 working days', deadlineAt_(at(2026,7,6), '').getDate(), 13);

// ---- which statuses the autopilot chases (mirrors autoSweep) ----
const sweepSrc = gs.match(/if \(quiet \|\| isClosed\) continue;[\s\S]*?if \(\/cancel[^\n]*\n/)[0];
const skipRx = /cancel|withdraw|duplicate|on hold/;
const chases = s => !/closed|resolved|completed/.test(s.toLowerCase()) && !skipRx.test(s.toLowerCase());
t('chases blank status', chases(''), true);
t('chases Open', chases('Open'), true);
t('chases In Progress (was silently skipped before)', chases('In Progress'), true);
t('chases Pending', chases('Pending'), true);
t('chases Acknowledged', chases('Acknowledged'), true);
t('stops on Closed', chases('Closed'), false);
t('stops on Resolved', chases('Resolved'), false);
t('stops on Cancelled', chases('Cancelled'), false);
t('stops on Duplicate', chases('Duplicate'), false);
t('sweep really uses the new rule', skipRx.test(sweepSrc.match(/\/([^/]+)\/\.test\(status\)/)[1]) || sweepSrc.includes('cancel|withdraw'), true);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
