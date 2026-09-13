/* The employer's own account — overview, ledger, and a query they can
   actually talk on.

   The thing being replaced is a spreadsheet whose variance cell reads
   #REF!, so the assertions that matter are about arithmetic being visible
   and a conversation having two sides. */
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('/opt/node22/lib/node_modules/playwright');
const B = 'http://localhost:8955/benefits/test/live/';
let pass = 0, fail = 0;
const t = (l, g, w) => { const ok = JSON.stringify(g) === JSON.stringify(w); ok ? pass++ : fail++;
  console.log((ok ? '  ✅ ' : '  ❌ ') + l + (ok ? '' : `  got ${JSON.stringify(g)}`)); };
const has = (l, hay, n) => { const ok = String(hay).toLowerCase().includes(String(n).toLowerCase());
  ok ? pass++ : fail++;
  console.log((ok ? '  ✅ ' : '  ❌ ') + l + (ok ? '' : `\n        not in: ${String(hay).slice(0, 400)}`)); };
const no = (l, hay, n) => { const ok = !String(hay).toLowerCase().includes(String(n).toLowerCase());
  ok ? pass++ : fail++;
  console.log((ok ? '  ✅ ' : '  ❌ ') + l + (ok ? '' : `\n        WAS in: ${String(hay).slice(0, 400)}`)); };
const state = () => fetch('http://localhost:8944').then(r => r.json());

const b = await chromium.launch();
const p = await (await b.newContext()).newPage({ viewport: { width: 1280, height: 1500 } });
const errs = []; p.on('pageerror', e => errs.push(String(e)));

console.log('\nVEENA SIGNS IN');
await p.goto(B + 'group.html'); await p.waitForTimeout(500);
await p.fill('#code', 'VK001'); await p.fill('#pw', '1');
await p.click('[data-signin]'); await p.waitForTimeout(1800);
t('the demo switcher is hidden', await p.locator('#demobar').isVisible(), false);
has('her company leads the page', await p.locator('#acctband').innerText(), 'D RAMPERSAD');

console.log('\nTHE OVERVIEW ANSWERS "ARE WE SQUARE?"');
has('there is an Overview tab', await p.locator('nav').innerText(), 'Overview');
await p.click('[data-go="dash"]'); await p.waitForTimeout(900);
let d = await p.locator('main').innerText();
has('billed to date', d, 'Billed to date');
has('with the total', d, '86,026.00');          // 28813 + 28813 + 28400
has('what has actually reached us', d, 'Received');
has('and the figure', d, '42,813.00');          // 28813 + 14000
has('what is still open', d, 'Still open');
has('the arithmetic is shown, not asserted', d, '43,213.00');   // 86026 - 42813
has('a month reads settled only when applied here', d, 'not when it left you');

console.log('\nEVERY MONTH, BILLED AND RECEIVED');
has('September is outstanding', d, 'outstanding');
has('August is settled', d, 'settled');
has('July is part paid', d, 'part paid');
has('and the unpaid total is called out', d, 'is showing as unpaid');
has('with what to do about it', d, 'give us the payment reference');

console.log('\nTHE QUERY HAS TWO SIDES NOW');
await p.click('[data-go="queries"]'); await p.waitForTimeout(800);
has('her query is there', await p.locator('main').innerText(), 'Query on the August 2026 billing');
t('and it can be commented on', await p.locator('[data-qopen="S1"]').count(), 1);
await p.click('[data-qopen="S1"]'); await p.waitForTimeout(400);
t('a box opens', await p.locator('#qtext').isVisible(), true);
await p.fill('#qtext', 'Ramdath finished on 31 July — payroll can confirm.');
await p.click('[data-qsend="S1"]'); await p.waitForTimeout(900);
d = await p.locator('main').innerText();
has('what she wrote is on the thread', d, 'payroll can confirm');
has('over her own name', d, 'Veena');
t('and the branch was told', (await state()).mails.filter(m => /Query comment/.test(m.subject)).length, 1);
t('the box closes after sending', await p.locator('#qtext').count(), 0);
has('the count shows on the query', d, '1 message');

console.log('\nONE BOX AT A TIME');
await p.click('[data-qopen="00T1"]'); await p.waitForTimeout(400);
t('opening another closes the first', await p.locator('#qtext').count(), 1);

console.log('\nAN EMPTY COMMENT IS REFUSED');
await p.fill('#qtext', '   ');
await p.click('[data-qsend="00T1"]'); await p.waitForTimeout(500);
has('it says so', await p.locator('#qerr').innerText(), 'Nothing to send');
t('and nothing was stored', (await state()).comments.length, 1);

console.log('\nSTILL NOTHING INTERNAL, AND STILL ONLY HER COMPANY');
const whole = await p.locator('body').innerText();
no('no keyperson cover', whole, 'keyperson');
no('no other client', whole, 'Xtra Foods');
no('no broken merge fields', whole, '$Record');

console.log('\nAND IT HOLDS ON A PHONE');
await p.setViewportSize({ width: 390, height: 900 });
await p.click('[data-go="dash"]'); await p.waitForTimeout(700);
t('nothing overflows', await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true);

console.log(`\n${pass} passed, ${fail} failed`);
console.log('errors:', errs.length ? errs : 'none');
await b.close();
process.exit(fail || errs.length ? 1 : 0);
