// The S.E.A. question bank, at /sea/.
//
// A wrong answer here is not a broken page — it is a child taught the wrong
// thing and marked right for it, and nobody finds out until the paper comes
// back. So the bank is not trusted to check itself: every numeric answer below
// is recomputed from the question's own numbers, in this file, and compared.
// If the two ever disagree the bank is wrong, not the arithmetic.
//
// It also holds the mock paper to the Ministry's blueprint. The Assessment
// Framework for SEA 2025-2028 fixes 40 items and 75 marks split 20/39/16
// across three sections and 19/6/9/6 items across the four strands. A mock
// that drifts off those numbers is practice for an examination that does not
// exist.
//
// Run: node tests/test-sea.js   (needs nothing but node)
const fs = require('fs'), path = require('path'), vm = require('vm');

const FILE = path.join(__dirname, '..', 'sea', 'index.html');
const html = fs.readFileSync(FILE, 'utf8');

// The page is one file, so the data lives inside its <script>. Take everything
// up to the first DOM-touching line and run that much.
const script = html.slice(html.indexOf('<script>') + 8, html.lastIndexOf('</script>'));
const cut = script.indexOf('/* ============================================================\n   Storage —');
if (cut < 0) { console.error('  FAIL could not find the data/behaviour boundary in sea/index.html'); process.exit(1); }
// isRight lives below the boundary now, so bring a copy of the marker up with the data.
const markerStart = script.indexOf('function norm(s){');
const markerEnd   = script.indexOf('/* ============================================================\n   Helpers');
if (markerStart < 0 || markerEnd < 0) { console.error('  FAIL could not find the marker in sea/index.html'); process.exit(1); }

const sandbox = { localStorage: { getItem: () => null, setItem: () => {} } };
vm.createContext(sandbox);
// The file is in strict mode, so its top-level const bindings never reach the
// sandbox global on their own — hand them over explicitly.
vm.runInContext(script.slice(0, cut) + script.slice(markerStart, markerEnd) +
  '\nglobalThis.__bank = { QUESTIONS, PAPERS, HINTS, ROLES, SVG, SPONSORS, SPONSOR_SLOTS, isRight };', sandbox);
const { QUESTIONS, PAPERS, HINTS, ROLES, SVG, SPONSORS, SPONSOR_SLOTS, isRight } = sandbox.__bank;

let fails = 0;
const ok = (what, cond, extra) => {
  console.log((cond ? '  ok   ' : '  FAIL ') + what + (extra && !cond ? '  — ' + extra : ''));
  if (!cond) fails++;
};

const STRANDS = ['Number', 'Geometry', 'Measurement', 'Statistics'];
const PROCS   = ['Knowing', 'Applying', 'Reasoning'];

// ---- every item well formed, and self-consistent ----------------------------
const seen = new Set();
const problems = [];
for (const q of QUESTIONS) {
  const p = m => problems.push(q.id + ': ' + m);
  if (seen.has(q.id)) p('duplicate id');
  seen.add(q.id);
  if (!STRANDS.includes(q.strand)) p('unknown strand ' + q.strand);
  if (!PROCS.includes(q.proc))     p('unknown thinking process ' + q.proc);
  if (![1, 2, 3].includes(q.sec))  p('section must be 1, 2 or 3');
  // Section marks are fixed by the framework, not by taste.
  if (q.sec === 1 && q.marks !== 1)            p('Section I items are 1 mark, this is ' + q.marks);
  if (q.sec === 2 && ![2, 3].includes(q.marks)) p('Section II items are 2 or 3 marks, this is ' + q.marks);
  if (q.sec === 3 && q.marks !== 4)            p('Section III items are 4 marks, this is ' + q.marks);
  if (!q.q || !q.exp) p('a question needs both a stem and a worked explanation');
  if (!Array.isArray(q.a) || !q.a.length) p('no accepted answer');
  // Anything the bank offers as an answer must be accepted by the marker.
  for (const alt of q.a || []) if (!isRight(q, alt)) p(`its own answer "${alt}" would be marked wrong`);
}
ok(`${QUESTIONS.length} questions are well formed and self-marking`, problems.length === 0, problems.join(' | '));

// ---- the bank can actually fill a paper -------------------------------------
const BLUEPRINT = { 1: { Number:10, Geometry:3, Measurement:4, Statistics:3 },
                    2: { Number:8,  Geometry:2, Measurement:4, Statistics:2 },
                    3: { Number:1,  Geometry:1, Measurement:1, Statistics:1 } };
const thin = [];
for (const sec of [1, 2, 3]) for (const st of STRANDS) {
  const have = QUESTIONS.filter(q => q.sec === sec && q.strand === st).length;
  if (have < BLUEPRINT[sec][st]) thin.push(`Section ${sec} ${st}: ${have} of ${BLUEPRINT[sec][st]}`);
}
ok('the bank can fill every slot in the Ministry blueprint', thin.length === 0, thin.join('; '));

// Section II must be able to reach its official 39 marks, which needs both
// 2-mark and 3-mark items to swap between.
const s2 = QUESTIONS.filter(q => q.sec === 2);
ok('Section II has both 2-mark and 3-mark items to tune with',
   s2.some(q => q.marks === 2) && s2.some(q => q.marks === 3));

// ---- the arithmetic, recomputed here ----------------------------------------
// Written from the question stems, not copied from the bank. If a stem changes,
// this number must be changed by hand — that is the point of it.
const RECOMPUTED = {
  N01: 503156, N02: 40000, N03: 3, N04: 15 / 60 * 4, N05: 600 / 6, N06: 48000,
  N07: 200009, N08: 4079, N10: 29, N11: 9 * 9, N15: 45 / 5 * 3,
  N16: 60 - (60 / 5 * 2), N17: 0.7 * 0.4, N19: 0.06, N21: 400 * 0.15,
  N22: 250 * 1.125, N23: (52 - 40) / 40 * 100, N24: 32.50 / 5 * 8, N25: 6 * 6,
  N26: 23 * 2 + 1, N27: 1800 / 3 * 2, N28: 84 * 7.5 * 5,
  N29: 350 - 24 * Math.floor(350 / 24), N30: 5000 + 3000,
  G01: 24 / 2, G03: 6, G04: 6 + 3, G06: 4, G08: 180 - 65 - 40, G09: 90,
  G10: 5, G11: 5 * 2 + 5, G13: 8,
  M01: 4 * 3, M03: 7500 / 1000, M04: 12 / 0.5, M05: 2.4 * 100, M06: 45 / 10,
  M07: 2 * (9 + 5), M08: (36 / 4) ** 2, M09: 10 * 6 - 4 * 3, M10: 6 * 4 * 3,
  M11: 5 ** 3, M12: 2.5 * 1000, M13: (250 + 1500 + 800) / 1000, M15: 3 * 60 + 15,
  M16: 45 / 3, M17: 2 * (12 + 8) * 35,
  S01: 3, S02: (4 + 7 + 9 + 12) / 4, S03: (12 + 15 + 18 + 11 + 14) / 5,
  S04: 15 - 8, S05: 12 + 8 + 15 + 5, S07: 5 * 2 + 2,
  S08: 20 * 5 - (18 + 22 + 15 + 25), S09: (6 + 8 + 8 + 9 + 14) / 5,
  S10: 60 * 0.25, S11: 7 * 4
};
const drift = [];
let checked = 0;
for (const [id, want] of Object.entries(RECOMPUTED)) {
  const q = QUESTIONS.find(x => x.id === id);
  if (!q) { drift.push(id + ' is no longer in the bank'); continue; }
  const stated = parseFloat(String(q.a[0]).replace(/[^0-9.\-]/g, ''));
  if (isNaN(stated)) { drift.push(id + ' answer is not numeric: ' + q.a[0]); continue; }
  if (Math.abs(stated - want) > 1e-9) drift.push(`${id} says ${q.a[0]}, recomputed ${want}`);
  else checked++;
}
ok(`${checked} numeric answers agree with an independent recomputation`, drift.length === 0, drift.join('; '));

// Two answers are lists rather than single numbers. Build them from scratch too.
const factorsOf = n => { const f = []; for (let i = 1; i <= n; i++) if (n % i === 0) f.push(i); return f; };
const RECOMPUTED_LISTS = {
  N09: factorsOf(24),
  N20: [0.5, 0.45, 0.505, 0.4].slice().sort((a, b) => a - b)
};
const listDrift = [];
for (const [id, want] of Object.entries(RECOMPUTED_LISTS)) {
  const q = QUESTIONS.find(x => x.id === id);
  if (!q) { listDrift.push(id + ' is no longer in the bank'); continue; }
  const stated = String(q.a[0]).split(',').map(v => parseFloat(v.trim()));
  if (stated.length !== want.length || stated.some((v, i) => Math.abs(v - want[i]) > 1e-9))
    listDrift.push(`${id} says [${q.a[0]}], recomputed [${want.join(', ')}]`);
}
ok(`${Object.keys(RECOMPUTED_LISTS).length} list answers agree with an independent recomputation`,
   listDrift.length === 0, listDrift.join('; '));

// Every numeric question must be covered above — a new one with no recomputation
// is a number nobody has checked.
const uncovered = QUESTIONS.filter(q =>
  !(q.id in RECOMPUTED) && !(q.id in RECOMPUTED_LISTS) && /^[0-9.\s,$]+$/.test(String(q.a[0])) ).map(q => q.id);
ok('every plain-numeric answer is covered by a recomputation', uncovered.length === 0,
   'unchecked: ' + uncovered.join(', '));

// ---- the marker is forgiving in the right ways, strict in the rest ----------
const CASES = [
  ['N01', '503 156', true],  ['N01', '503,156', true],  ['N01', '503157', false],
  ['M01', '12 m²',   true],  ['M01', '12',      true],  ['M01', '13',     false],
  ['N21', '$60',     true],  ['N21', '60',      true],  ['N21', '6',      false],
  ['N12', '2/3',     true],  ['N12', '2 / 3',   true],  ['N12', '4/6',    false],
  ['M02', '4:45',    true],  ['M02', '4.45',    true],  ['M02', '16:45',  false],
  ['G02', 'square-based pyramid', true], ['G02', 'Square Based Pyramid', true],
  ['G02', 'cube', false],
  ['M03', '7.5 kg',  true],  ['M13', '2.55 kg', true],
  ['N03', '3%',      true],  ['N03', '3',       true],
  ['S01', '3',       true],  ['S01', '',        false], ['S01', '   ',    false],
  ['N17', '0.28',    true],  ['N17', '.28',     true]
];
const misjudged = [];
for (const [id, typed, want] of CASES) {
  const q = QUESTIONS.find(x => x.id === id);
  if (!q) { misjudged.push(id + ' missing'); continue; }
  if (isRight(q, typed) !== want) misjudged.push(`${id} "${typed}" judged ${!want}`);
}
ok(`${CASES.length} marking cases judged correctly`, misjudged.length === 0, misjudged.join('; '));

// ---- the hint ladder ---------------------------------------------------------
// The whole premise is that a practice test helps before it tells. A question
// with no ladder hands the answer straight over, which is the thing this app
// exists not to do.
const noLadder = QUESTIONS.filter(q => !q.ask || !q.step).map(q => q.id);
ok('every question has a pointer and a first step before its working', noLadder.length === 0,
   'missing: ' + noLadder.join(', '));
const orphanHint = Object.keys(HINTS).filter(id => !QUESTIONS.some(q => q.id === id));
ok('no hint is written for a question that is not in the bank', orphanHint.length === 0, orphanHint.join(', '));

// A hint that contains the answer is not a hint. This is the check that keeps
// the ladder honest as questions get edited.
const leaks = [];
for (const q of QUESTIONS) {
  const answer = String(q.a[0]).trim();
  if (!/^[0-9][0-9.]*$/.test(answer)) continue;      // numeric answers only
  const pattern = new RegExp('(^|[^0-9.])' + answer.replace('.', '[.\u00b7]') + '([^0-9.]|$)');
  for (const rung of ['ask', 'step']) {
    const text = String(q[rung] || '').replace(/&#8201;|&nbsp;/g, ' ');
    if (pattern.test(text)) leaks.push(`${q.id}.${rung} contains its own answer ${answer}`);
  }
}
ok('no pointer or first step gives the answer away', leaks.length === 0, leaks.join('; '));

// ---- figures -----------------------------------------------------------------
const badFig = [];
for (const q of QUESTIONS) {
  if (q.fig  && !(q.fig  in SVG)) badFig.push(`${q.id} fig ${q.fig}`);
  if (q.hfig && !(q.hfig in SVG)) badFig.push(`${q.id} hfig ${q.hfig}`);
}
ok('every figure a question names actually exists', badFig.length === 0, badFig.join('; '));
const usedFigs = new Set(QUESTIONS.flatMap(q => [q.fig, q.hfig]).filter(Boolean));
ok(`${usedFigs.size} of ${Object.keys(SVG).length} figures are in use`,
   usedFigs.size === Object.keys(SVG).length,
   'unused: ' + Object.keys(SVG).filter(k => !usedFigs.has(k)).join(', '));

// ---- roles -------------------------------------------------------------------
const roleNames = Object.keys(ROLES);
ok('three roles are defined', roleNames.length === 3 &&
   ['student','parent','teacher'].every(r => roleNames.includes(r)), roleNames.join(', '));
const codes = roleNames.map(r => ROLES[r].code);
ok('each role has its own distinct code', new Set(codes).size === 3 && codes.every(c => c && c.length >= 6));

// ---- the branch mark ---------------------------------------------------------
// CLAUDE.md: every screen uses logo-mark.png. Twice a screen has shipped with an
// invented monogram beside three screens carrying the real mark.
const page = html;
const markRefs = (page.match(/logo-mark\.png/g) || []).length;
ok(`the branch mark is used on the gate, the header and the footer (${markRefs} references)`, markRefs >= 3);
ok('no substitute mark is drawn in place of it',
   !/<text[^>]*>\s*RR\s*</.test(page) && !/<text[^>]*>\s*RD\s*</.test(page));
ok('the mark is styled the way CLAUDE.md sets out',
   /\.mark\{[^}]*border-radius:13px/.test(page) && /\.mark img\{[^}]*width:100%/.test(page));

// ---- sponsors ------------------------------------------------------------------
const spBad = [];
for (const sp of SPONSORS) {
  if (!SPONSOR_SLOTS.includes(sp.slot)) spBad.push(`${sp.name}: unknown slot ${sp.slot}`);
  if (!sp.name) spBad.push('a sponsor with no name');
  if (sp.url && !/^https:\/\//.test(sp.url)) spBad.push(`${sp.name}: url must be https`);
  if (sp.logo && !/^(https:\/\/|data:image\/)/.test(sp.logo)) spBad.push(`${sp.name}: logo must be hosted over https or inline`);
}
const slotsUsed = SPONSORS.map(sp => sp.slot);
if (new Set(slotsUsed).size !== slotsUsed.length) spBad.push('two sponsors in one slot');
ok(`sponsor entries are well formed, one per slot (${SPONSORS.length} configured)`, spBad.length === 0, spBad.join('; '));

// A children's app that takes sponsors is one careless afternoon away from an
// ad network. There is none, and the page loads no script from anywhere.
ok('no ad network or tracker anywhere in the page',
   !/adsbygoogle|doubleclick|googletagmanager|googlesyndication|facebook\.net|connect\.facebook|hotjar|adsense|taboola|outbrain/i.test(page));
ok('the page loads no external script', !/<script[^>]+src=/i.test(page));

// ---- the past-paper links ---------------------------------------------------
// These are somebody else's files. If one is ever re-hosted here instead of
// linked, that is a copyright decision nobody made on purpose.
const linkTrouble = [];
const urls = new Set();
for (const p of PAPERS) {
  if (!/^https:\/\//.test(p.u)) linkTrouble.push(p.t + ' is not https');
  if (!/(^|\.)moe\.gov\.tt|wpuploadstorageaccount\.blob\.core\.windows\.net/.test(p.u))
    linkTrouble.push(p.t + ' does not point at the Ministry');
  if (urls.has(p.u)) linkTrouble.push('duplicate link: ' + p.u);
  urls.add(p.u);
}
ok(`${PAPERS.length} past papers all link to the Ministry over https`, linkTrouble.length === 0, linkTrouble.join('; '));
ok('no past paper PDF is committed to this repository',
   !fs.readdirSync(path.join(__dirname, '..', 'sea')).some(f => /\.pdf$/i.test(f)));

console.log();
console.log(fails ? `  ${fails} failed` : '  all good');
process.exit(fails ? 1 : 0);
