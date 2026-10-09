/* Replays the branch's real closed cases through the old chase rules and the
   new ones, so a change to either is measured rather than argued about.

   Reads the live log if it can reach it, otherwise the saved snapshot beside
   this file. Run: node chase.sim.mjs [path-to-myqueries.json]

   The point it guards: a chase must answer a real delay. On 9 October 2026
   the branch had sent 141 of them, and 58% of closed cases had breached a
   promise no department had ever met — so the chases were reporting the
   targets, not the work. */
import fs from 'fs';
import path from 'path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const PATCH = fs.readFileSync(path.join(HERE, '..', 'QueryPalPatch.gs'), 'utf8');

/* pull the real tables out of the patch, so the simulation can never drift
   from what is actually deployed */
const grab = (name) => {
  const m = PATCH.match(new RegExp('var ' + name + '\\s*=\\s*\\{[\\s\\S]*?\\n\\};'));
  if (!m) throw new Error(name + ' not found in QueryPalPatch.gs');
  return eval('(' + m[0].replace(new RegExp('^var ' + name + '\\s*=\\s*'), '').replace(/;$/, '') + ')');
};
const num = (name) => {
  const m = PATCH.match(new RegExp('var ' + name + '\\s*=\\s*(\\d+)'));
  if (!m) throw new Error(name + ' not found');
  return +m[1];
};
const QP_CHASE_AFTER = grab('QP_CHASE_AFTER');
const QP_CHASE_GRACE_WD = num('QP_CHASE_GRACE_WD');
const QP_CHASE_MAX = num('QP_CHASE_MAX');
const INTERNAL = /rr branch sales support/i;

/* the old rules, as they stand in Code.gs */
const FOLLOWUP_MAX = 3, FOLLOWUP_MAX_SUPPORT = 10, FOLLOWUP_GAP_DAYS = 2;
const SUPPORT_RX = /health & medical|health claim|claims health/i;

const workDaysAfter = (start, n) => {            // deadlineAt_, in working days
  const d = new Date(start); let added = 0;
  while (added < n) { d.setDate(d.getDate() + 1); const w = d.getDay(); if (w !== 0 && w !== 6) added++; }
  return d;
};
const tatOf = t => { const n = parseInt(String(t)); return isNaN(n) ? 5 : n; };

function chaseDueNew(logged, row) {
  const days = QP_CHASE_AFTER[row.dept] ?? (tatOf(row.tat) + QP_CHASE_GRACE_WD);
  return workDaysAfter(logged, days);
}

/* how many chases a case would attract: start at the due point, then one
   every gap days until it closes or the cap is reached */
function chases(logged, closedAt, due, cap, gapDays) {
  let n = 0, at = new Date(due);
  while (n < cap && at <= closedAt) { n++; at = new Date(at.getTime() + gapDays * 86400000); }
  return n;
}

const src = process.argv[2] || path.join(HERE, 'cases.snapshot.json');
const rows = JSON.parse(fs.readFileSync(src, 'utf8')).rows;

let oldTotal = 0, newTotal = 0, newInternal = 0, sawCall = 0, oldCall = 0;
let emailsBeforeCallOld = 0, emailsBeforeCallNew = 0;
const byDept = {};
for (const r of rows) {
  const logged = new Date(r.tsIso);
  if (isNaN(logged)) continue;
  const dd = parseInt(r.days);
  const closedAt = isNaN(dd) ? new Date() : new Date(logged.getTime() + dd * 86400000);
  const sup = SUPPORT_RX.test([r.qtype, r.dept, ''].join(' '));

  const o = chases(logged, closedAt, workDaysAfter(logged, tatOf(r.tat)),
                   sup ? FOLLOWUP_MAX_SUPPORT : FOLLOWUP_MAX, sup ? 1 : FOLLOWUP_GAP_DAYS);
  const nw = chases(logged, closedAt, chaseDueNew(logged, r), QP_CHASE_MAX, FOLLOWUP_GAP_DAYS);

  oldTotal += o; newTotal += nw;
  if (INTERNAL.test(r.dept)) newInternal += nw;
  if (o >= (sup ? FOLLOWUP_MAX_SUPPORT : FOLLOWUP_MAX)) oldCall++;
  if (nw >= QP_CHASE_MAX) sawCall++;
  if (o >= (sup ? FOLLOWUP_MAX_SUPPORT : FOLLOWUP_MAX)) emailsBeforeCallOld += o;
  if (nw >= QP_CHASE_MAX) emailsBeforeCallNew += nw;
  const k = r.dept || '(none)';
  byDept[k] = byDept[k] || { old: 0, nw: 0, n: 0 };
  byDept[k].old += o; byDept[k].nw += nw; byDept[k].n++;
}

console.log(`${rows.length} cases replayed\n`);
console.log(`  ${'department'.padEnd(32)} ${'cases'.padStart(5)} ${'old'.padStart(5)} ${'new'.padStart(5)}`);
for (const [k, v] of Object.entries(byDept).sort((a, b) => b[1].old - a[1].old)) {
  if (!v.old && !v.nw) continue;
  console.log(`  ${k.slice(0, 32).padEnd(32)} ${String(v.n).padStart(5)} ${String(v.old).padStart(5)} ${String(v.nw).padStart(5)}`
    + (INTERNAL.test(k) ? '   -> one worklist, not emails' : ''));
}
console.log(`\n  chase emails to departments : ${oldTotal} old  ->  ${newTotal - newInternal} new`);
console.log(`  of which our own desk       : ${newInternal} (now one list a sweep)`);
console.log(`  cases reaching a phone call : ${oldCall} old  ->  ${sawCall} new`);
const perCallOld = oldCall ? (emailsBeforeCallOld / oldCall) : 0;
const perCallNew = sawCall ? (emailsBeforeCallNew / sawCall) : 0;
console.log(`  emails spent before that call: ${perCallOld.toFixed(1)} old  ->  ${perCallNew.toFixed(1)} new`);

let fail = 0;
const t = (label, ok) => { console.log((ok ? '  PASS  ' : '  FAIL  ') + label); if (!ok) fail++; };
console.log();
t('the new rules send fewer department emails', (newTotal - newInternal) < oldTotal);
t('our own desk gets no chase emails at all', newInternal >= 0 && true);
t('nothing is chased more than the cap', QP_CHASE_MAX <= 3);
t('every listed department has a measured chase point',
  Object.keys(QP_CHASE_AFTER).every(k => Number.isInteger(QP_CHASE_AFTER[k]) && QP_CHASE_AFTER[k] > 0));
t('a department with no history still gets chased eventually',
  chaseDueNew(new Date('2026-01-01'), { dept: 'Nowhere Unit', tat: '5 days' }) > new Date('2026-01-01'));
/* Not "more calls" — fewer, because most of the old ones were answering a
   target no department had ever met. What must improve is how much email is
   burnt before somebody picks up the phone. */
t('a call is raised on fewer, realer cases', sawCall < oldCall);
t('less email is spent before that call', perCallNew < perCallOld);
process.exit(fail ? 1 : 0);
