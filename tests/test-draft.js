const fs = require('fs'), vm = require('vm');
const html = fs.readFileSync(__dirname + '/../kpi/index.html', 'utf8');
const start = html.indexOf('const draftKey =');
const end = html.indexOf('\n}\n', html.indexOf('function overlayDraft')) + 3;
const src = html.slice(start, end)
  + '\nglobalThis.writeDraft=writeDraft; globalThis.readDraft=readDraft;'
  + 'globalThis.clearDraftBlock=clearDraftBlock; globalThis.pruneDrafts=pruneDrafts;'
  + 'globalThis.overlayDraft=overlayDraft; globalThis.draftKey=draftKey;';

// a localStorage that behaves like the real one, including the index
function mkStore() {
  const m = new Map();
  return {
    get length() { return m.size; },
    key: i => Array.from(m.keys())[i],
    getItem: k => (m.has(k) ? m.get(k) : null),
    setItem: (k, v) => { m.set(k, String(v)); },
    removeItem: k => { m.delete(k); },
    _map: m
  };
}

const ctx = { console, JSON, Date, String, Object, localStorage: mkStore() };
vm.createContext(ctx);
new vm.Script(src, { filename: 'draft.js' }).runInContext(ctx);

let fails = 0;
const ok = (l, c, x='') => { console.log((c?'  PASS  ':'  FAIL  ')+l+(x?'  '+x:'')); if(!c) fails++; };

const blank = { blocks: { PM2: { kpi:'', actioned:'', resolved:'' } }, valueAdded:'', innovation:'', systemFlags:'', notes:'', metrics:{} };

console.log('\nSasha types her last block, and the sheet refuses it:\n');
const typed = { ...blank, blocks: { PM2: { kpi:'Task Management', actioned:'Actioned remaining tasks', resolved:'3 tasks', openOwned:'2' } }, valueAdded:'Caught a misrouted contract' };
ctx.writeDraft('sasha', '2026-09-02', typed);

// she closes the page; it reloads with nothing from the sheet
const fromSheet = JSON.parse(JSON.stringify(blank));
const restored = ctx.overlayDraft(fromSheet, ctx.readDraft('sasha', '2026-09-02'));
ok('her words come back', restored.blocks.PM2.actioned === 'Actioned remaining tasks', restored.blocks.PM2.actioned);
ok('resolved comes back', restored.blocks.PM2.resolved === '3 tasks');
ok('value added comes back', restored.valueAdded === 'Caught a misrouted contract');

console.log('\nThe sheet is the record — a saved block beats a stale draft:\n');
const sheetHas = { ...blank, blocks: { PM2: { kpi:'Task Management', actioned:'WHAT THE SHEET HOLDS', resolved:'3 tasks' } } };
const merged = ctx.overlayDraft(sheetHas, ctx.readDraft('sasha', '2026-09-02'));
ok('sheet text wins', merged.blocks.PM2.actioned === 'WHAT THE SHEET HOLDS', merged.blocks.PM2.actioned);

console.log('\nA block that lands is dropped; the rest of the day stays:\n');
ctx.writeDraft('sasha', '2026-09-02', { ...typed, blocks: { ...typed.blocks, KPI1: { actioned:'morning work' } } });
ctx.clearDraftBlock('sasha', '2026-09-02', 'PM2');
const after = ctx.readDraft('sasha', '2026-09-02');
ok('PM2 forgotten', !after.blocks.PM2);
ok('KPI1 kept', after.blocks.KPI1 && after.blocks.KPI1.actioned === 'morning work');
ok('day fields kept', after.valueAdded === 'Caught a misrouted contract');

console.log('\nOne person’s draft is not another’s, and old ones go:\n');
ctx.writeDraft('elizabeth', '2026-09-02', { ...blank, blocks: { PM2: { actioned:'Elizabeth only' } } });
ok('drafts are per person', ctx.readDraft('sasha','2026-09-02').blocks.KPI1.actioned === 'morning work'
   && ctx.readDraft('elizabeth','2026-09-02').blocks.PM2.actioned === 'Elizabeth only');

const stale = JSON.parse(ctx.localStorage.getItem('rrb_kpi_draft_elizabeth_2026-09-02'));
stale.savedAt = Date.now() - 20 * 864e5;
ctx.localStorage.setItem('rrb_kpi_draft_elizabeth_2026-09-02', JSON.stringify(stale));
ctx.localStorage.setItem('rrb_kpi_token', 'not-a-draft-do-not-touch');
ctx.pruneDrafts();
ok('a fortnight-old draft is cleared', ctx.readDraft('elizabeth','2026-09-02') === null);
ok('today’s draft survives', ctx.readDraft('sasha','2026-09-02') !== null);
ok('the token is left alone', ctx.localStorage.getItem('rrb_kpi_token') === 'not-a-draft-do-not-touch');

console.log('\nA browser with storage switched off must not crash the page:\n');
const ctx2 = { console, JSON, Date, String, Object,
  localStorage: { get length(){throw new Error('blocked');}, key(){throw new Error('blocked');},
                  getItem(){throw new Error('blocked');}, setItem(){throw new Error('blocked');}, removeItem(){throw new Error('blocked');} } };
vm.createContext(ctx2);
new vm.Script(src, { filename: 'draft.js' }).runInContext(ctx2);
let threw = false;
try { ctx2.writeDraft('s','2026-09-02',typed); ctx2.readDraft('s','2026-09-02'); ctx2.clearDraftBlock('s','2026-09-02','PM2'); ctx2.pruneDrafts(); } catch(e) { threw = true; }
ok('all four survive a blocked localStorage', !threw);
ok('overlay with no draft is a no-op', ctx2.overlayDraft(blank, null) === blank);


// The schedule's KPI is a guess at what a block is for. What the person picked
// is not. overlayDraft keeps a non-empty server value over a draft, so filling
// the guess in before the overlay made the guess win — pick a different KPI,
// come back, and the schedule's answer was silently back. The fix is ordering,
// which is easy to undo by accident, so it is pinned here.
console.log('\nThe schedule fills blanks; it does not overrule a choice:\n');
{
  const schedule = { blocks: { PM2: { kpi: 'Servicing', actioned: '', resolved: '' } },
                     valueAdded:'', innovation:'', systemFlags:'', notes:'', metrics:{} };
  const chose = { blocks: { PM2: { kpi: 'Servicing, Claims/ Mat' } } };

  // Wrong order: the guess is already in place, so it outranks the choice.
  const wrong = ctx.overlayDraft(schedule, chose);
  ok('the old order loses the choice', wrong.blocks.PM2.kpi === 'Servicing',
     wrong.blocks.PM2.kpi);

  // Right order: overlay the draft onto the real row, then fill what is blank.
  const empty = { blocks: { PM2: { kpi: '', actioned: '', resolved: '' } },
                  valueAdded:'', innovation:'', systemFlags:'', notes:'', metrics:{} };
  const right = ctx.overlayDraft(empty, chose);
  ok('the draft survives when the blank comes first',
     right.blocks.PM2.kpi === 'Servicing, Claims/ Mat', right.blocks.PM2.kpi);
  ok('and a block the person never touched is still free to be prefilled',
     ctx.overlayDraft(empty, { blocks: {} }).blocks.PM2.kpi === '');
}

console.log('\n' + (fails ? fails + ' FAILED' : 'all green') + '\n');
process.exit(fails ? 1 : 0);
