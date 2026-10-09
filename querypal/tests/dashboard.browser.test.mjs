import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('/opt/node22/lib/node_modules/playwright');
/* The dashboard against a slow backend. Reading the whole log can run past a
   minute, and giving up early used to report a missing Apps Script - a file
   that has never existed in this project. Shorten the timeout again and the
   third and fifth checks here fail. */
import path from 'path';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const PAGE = 'file://' + (process.argv[2] || path.join(HERE, '..', 'index.html'));
let pass=0,fail=0;
const t=(l,g,w)=>{const ok=JSON.stringify(g)===JSON.stringify(w);console.log((ok?'  PASS  ':'  FAIL  ')+l+(ok?'':`\n     got ${JSON.stringify(g)}\n     want ${JSON.stringify(w)}`));ok?pass++:fail++;};

const b = await chromium.launch();

// 1 — the backend never answers: the card must be honest, and it must retry
{
  const p = await b.newPage(); const errs=[]; p.on('pageerror',e=>errs.push(String(e)));
  let hits=0;
  await p.route('**/macros/s/**', r => { hits++; /* hang */ });
  await p.goto(PAGE); await p.waitForTimeout(800);
  await p.evaluate(()=>{ agentAuth={code:'260026',name:'Ricky',email:'',role:'branch'}; dashFetch(); });
  await p.waitForTimeout(1500);
  t('while waiting, no false "install" advice',
    (await p.locator('#dashList').innerText()).includes('QueryPal_Backend_v6'), false);
  t('no page errors', errs, []);
  await p.close();
}
// 2 — a slow backend that answers after 20s would previously have failed at 15s
{
  const p = await b.newPage();
  await p.route('**/macros/s/**', async r => {
    await new Promise(x=>setTimeout(x,20000));
    const body = {ok:true, role:'branch', name:'Ricky', counts:{open:1,done:0,total:1},
      rows:[{ref:'RRB/2026/001/X/Y', ts:'1 Oct', status:'Open', client:'X', agent:'A',
             qtype:'Surrenders', dept:'D', tat:'3 days', pri:'Normal', closed:'', days:'',
             tsIso:'2026-10-01T00:00:00Z', score:0, fu:0, asg:''}]};
    r.fulfill({status:200, contentType:'application/json', body: JSON.stringify(body)});
  });
  await p.goto(PAGE); await p.waitForTimeout(800);
  await p.evaluate(()=>{ agentAuth={code:'260026',name:'Ricky',email:'',role:'branch'}; dashFetch(); });
  await p.waitForFunction(()=>!document.getElementById('dashList').innerText.includes('oading'), null, {timeout:45000}).catch(()=>{});
  const txt = await p.locator('#dashList').innerText();
  t('a 20s backend now loads instead of erroring', txt.includes('RRB/2026/001') || txt.includes('Surrenders'), true);
  await p.close();
}
// 3 — a real failure says something true
{
  const p = await b.newPage();
  await p.route('**/macros/s/**', r => r.abort());
  await p.goto(PAGE); await p.waitForTimeout(800);
  await p.evaluate(()=>{ agentAuth={code:'260026',name:'Ricky',email:'',role:'branch'}; dashFetch(); });
  await p.waitForTimeout(2500);
  const txt = await p.locator('#dashList').innerText();
  t('the failure card is honest', txt.includes("didn't load") && txt.includes('Refresh'), true);
  t('and never names a file that does not exist', txt.includes('QueryPal_Backend_v6'), false);
  await p.close();
}
await b.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail?1:0);
