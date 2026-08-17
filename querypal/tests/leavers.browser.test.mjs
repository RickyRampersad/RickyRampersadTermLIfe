/* The company leaver run in Chromium with the webhook intercepted: the door
   only opens for a company, the roster is searchable and multi-select, a past
   date warns, a death is stopped, and the submitted payload is well formed. */
import { createRequire } from 'module';
import path from 'path';
const { chromium } = createRequire(import.meta.url)('/opt/node22/lib/node_modules/playwright');
const HERE = path.dirname(new URL(import.meta.url).pathname);

const ROSTER = [
  { name:'Jane Ramlogan',  hasLife:true,  hasHealth:true  },
  { name:'Ravi Persad',    hasLife:true,  hasHealth:false },
  { name:'Kim Boodoo',     hasLife:false, hasHealth:true  },
  { name:'Anand Maharaj',  hasLife:true,  hasHealth:true  }
];
const LOOKUP = {
  'Jane Ramlogan': { ok:true, first:'Jane', last:'Ramlogan', hasLife:true, hasHealth:true,
                     lifePolicy:'GL-1', healthPolicy:'GH-1', email:'jane@acme.com' },
  'Ravi Persad':   { ok:true, first:'Ravi', last:'Persad',   hasLife:true, hasHealth:false,
                     lifePolicy:'GL-2', healthPolicy:'',     email:'ravi@acme.com' }
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport:{width:760,height:1100} });
const errors = []; page.on('pageerror', e => errors.push(String(e)));
const calls = [];
await page.route('**/macros/s/**', async route => {
  const req = route.request(); const url = new URL(req.url());
  const body = req.postData() || null;
  const a = url.searchParams.get('action') || (body||'').match(/"action":"(\w+)"/)?.[1] || 'post';
  calls.push({ a, url: req.url(), body });
  const ok = b => route.fulfill({ status:200, contentType:'application/json', body: JSON.stringify(b) });
  if (a==='clientcases')  return ok({ ok:true, type:'company', name:'Acme Manufacturing Ltd', cases:[] });
  if (a==='clientstats')  return ok({ ok:true, total:4, resolutionRate:75, responseRate:90, avgClose:4, onTime:88 });
  if (a==='grouproster')  return ok({ ok:true, rows: ROSTER });
  if (a==='grouplookup')  return ok(LOOKUP[url.searchParams.get('name')] || { ok:false });
  if (a==='leavers') {
    const d = JSON.parse(body);
    return ok({ ok:true, count:d.members.length,
      results: d.members.map((m,i) => ({ ref:'RRB/2026/0812/1010'+i+'/TERM', member:(m.first+' '+m.last).trim(),
        plans:[m.life&&'Group Life', m.health&&'Group Health'].filter(Boolean).join(' & '),
        effective:'26/08/2026', backdated:false, noticeSent:!!m.memberEmail })),
      errors: [] });
  }
  return ok({ ok:true });
});
await page.goto('file://' + path.join(HERE, '..', 'index.html'));

let pass=0, fail=0;
const t=(l,got,want)=>{const ok=JSON.stringify(got)===JSON.stringify(want);
  console.log((ok?'  PASS  ':'  FAIL  ')+l+(ok?'':`\n          got  ${JSON.stringify(got)}\n          want ${JSON.stringify(want)}`)); ok?pass++:fail++;};
const iso = off => { const d=new Date(); d.setDate(d.getDate()+off);
  const p=n=>String(n).padStart(2,'0');
  return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate()); };

// ── the door ──
console.log('\n— the door —');
await page.evaluate(() => { clientAuth = { code:'IND4471', type:'client', name:'Tom' }; ccShow(); });
t('an individual sees no leaver button',
  await page.locator('#ccEnrollRow button', { hasText:'Report leavers' }).count(), 0);
t('leaversOpen refuses an individual', await page.evaluate(() => {
  leaversOpen(); return document.getElementById('leaversModal').classList.contains('show'); }), false);

await page.evaluate(() => ccAuth('CO-ACME'));
await page.waitForTimeout(300);
t('a company sees Enroll', await page.locator('#ccEnrollRow button', { hasText:'Enroll a new member' }).count(), 1);
t('a company sees Report leavers', await page.locator('#ccEnrollRow button', { hasText:'Report leavers' }).count(), 1);

// ── roster ──
console.log('\n— the roster —');
await page.locator('#ccEnrollRow button', { hasText:'Report leavers' }).click();
await page.waitForTimeout(300);
t('modal open', await page.locator('#leaversModal.show').count(), 1);
t('roster asked for with the company code',
  /action=grouproster.*code=CO-ACME/.test(calls.filter(c=>c.a==='grouproster').pop().url), true);
t('everyone listed', await page.locator('#lvList .lvrow').count(), 4);
t('name shown in normal casing, not the form-label uppercase',
  (await page.locator('#lvList .lvrow .lvn').first().innerText()), 'Jane Ramlogan');
t('cover shown per person', (await page.locator('#lvList .lvrow .lvp').first().innerText()).toUpperCase(), 'LIFE · HEALTH');
t('nothing selected yet', await page.locator('#lvCount').innerText(), 'None selected');

await page.fill('#lvSearch','rav');
await page.waitForTimeout(120);
t('search narrows', await page.locator('#lvList .lvrow').count(), 1);
await page.fill('#lvSearch','zzz');
await page.waitForTimeout(120);
t('no match says so', (await page.locator('#lvList').innerText()).includes('Nobody on your list matches'), true);
await page.fill('#lvSearch','');
await page.waitForTimeout(120);

await page.locator('#lvList .lvrow input').nth(0).check();
await page.locator('#lvList .lvrow input').nth(1).check();
t('count tracks selection', await page.locator('#lvCount').innerText(), '2 selected');
t('selection survives a search', await (async()=>{ await page.fill('#lvSearch','jane'); await page.waitForTimeout(120);
  const c = await page.locator('#lvList .lvrow input').first().isChecked(); await page.fill('#lvSearch',''); await page.waitForTimeout(120); return c; })(), true);
await page.click('#lvCount + button');
t('clear empties it', await page.locator('#lvCount').innerText(), 'None selected');

// ── guards ──
console.log('\n— guards —');
await page.fill('#lvEff', iso(-30));
await page.waitForTimeout(120);
t('a past date warns', await page.locator('#lvBackdate.show').count(), 1);
t('  and says how far back', (await page.locator('#lvBackdate').innerText()).includes('30 days in the past'), true);
t('  mentions premium', (await page.locator('#lvBackdate').innerText()).toLowerCase().includes('premium'), true);
await page.fill('#lvEff', iso(14));
await page.waitForTimeout(120);
t('a future date does not warn', await page.locator('#lvBackdate.show').count(), 0);

await page.selectOption('#lvReason','death');
await page.waitForTimeout(120);
t('death shows the claims notice', await page.locator('#lvDeath.show').count(), 1);
t('  and points at Claims', (await page.locator('#lvDeath').innerText()).includes('Claims'), true);
t('  submit disabled', await page.locator('#lvGo').isDisabled(), true);
await page.selectOption('#lvReason','redundancy');
await page.waitForTimeout(120);
t('another reason re-enables submit', await page.locator('#lvGo').isDisabled(), false);
t('  and hides the notice', await page.locator('#lvDeath.show').count(), 0);

const before = calls.filter(c=>c.a==='leavers').length;
await page.click('#lvGo');
await page.waitForTimeout(250);
t('nothing submitted with no one selected', calls.filter(c=>c.a==='leavers').length, before);
t('  and it says why', (await page.locator('#lvOut').innerText()).includes('Pick at least one person'), true);

// ── submit ──
console.log('\n— submitting —');
await page.locator('#lvList .lvrow input').nth(0).check();
await page.locator('#lvList .lvrow input').nth(1).check();
await page.fill('#lvNote','Contract cycle ended.');
await page.click('#lvGo');
await page.waitForTimeout(600);

const sent = JSON.parse(calls.filter(c=>c.a==='leavers').pop().body);
t('posted, not put in a URL', calls.filter(c=>c.a==='leavers').pop().url.includes('action=leavers'), false);
t('action', sent.action, 'leavers');
t('company code travels with it', sent.code, 'CO-ACME');
t('two members', sent.members.length, 2);
t('names split into first and last', [sent.members[0].first, sent.members[0].last], ['Jane','Ramlogan']);
t('policy numbers filled in from the lookup', sent.members[0].lifepol, 'GL-1');
t('member email filled in, so the notice can be sent', sent.members[0].memberEmail, 'jane@acme.com');
t('reason carried', sent.members[0].reason, 'redundancy');
t('date carried', sent.members[0].effdate, iso(14));
t('note carried', sent.note, 'Contract cycle ended.');
t('a member without health cover is not terminated from it', sent.members[1].health, false);
t('  but keeps life', sent.members[1].life, true);

const out = await page.locator('#lvOut').innerText();
t('receipt confirms the count', out.includes('2 terminations submitted'), true);
t('  lists each member', out.includes('Jane Ramlogan') && out.includes('Ravi Persad'), true);
t('  shows the reference', out.includes('/TERM'), true);
t('  says the notice went out', out.includes('notice sent'), true);
t('selection cleared after submitting', await page.locator('#lvCount').innerText(), 'None selected');

// ── the agent path still carries its code (edit 13) ──
console.log('\n— agent path —');
t('agent termination sends a code', await page.evaluate(() =>
  /\+'&code='\+encodeURIComponent\(\(agentAuth&&agentAuth\.code\)/.test(termSubmit.toString())), true);

console.log('\n— page errors —');
t('no uncaught errors', errors, []);

console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail?1:0);
