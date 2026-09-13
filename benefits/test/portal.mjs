/* The employer's own account — overview, ledger, the renewals Guardian
   holds, and a query they can actually talk on.

   The thing being replaced is a spreadsheet whose variance cell reads
   #REF!, so the assertions that matter are about arithmetic being visible
   and a conversation having two sides.

   Every name here is invented; see the note at the top of mockapi.mjs. */
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

console.log('\nTHE ADMINISTRATOR SIGNS IN');
await p.goto(B + 'group.html'); await p.waitForTimeout(500);
await p.fill('#code', 'MH001'); await p.fill('#pw', '1');
await p.click('[data-signin]'); await p.waitForTimeout(1800);
t('the demo switcher is hidden', await p.locator('#demobar').isVisible(), false);
has('her company leads the page', await p.locator('#acctband').innerText(), 'MERIDIAN HARDWARE');

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

console.log('\nTHE ACCOUNT — GUARDIAN\'S OWN RENEWAL RECORDS');
has('there is an Account tab', await p.locator('nav').innerText(), 'Account');
await p.click('[data-go="account"]'); await p.waitForTimeout(1200);
d = await p.locator('main').innerText();
t('the year is offered as a filter', await p.locator('[data-accyear="2026"]').count(), 1);
t('and so is every month that has something in it', await p.locator('[data-accmonth]').count(), 4);
has('the whole year is the default', d, 'Whole year');
has('it counts the renewals', d, 'Renewals in 2026');
has('the money that actually arrived', d, '56,717.56');   // 40814.46 + 15903.10

console.log('\nIT WILL NOT PRINT A BILLED FIGURE SALESFORCE DOES NOT HOLD');
has('it says where the figure is missing from', d, 'does not hold a billed figure');
no('and never shows a group renewal billed at zero', d, 'Billed\n$0.00');

console.log('\nEACH RENEWAL, WITH WHAT WAS PAID AGAINST IT');
has('the life scheme is named', d, 'Group life');
has('with its list bill', d, 'TGM 4400');
has('the renewal date', d, 'Renews 2026-09-01');
has('the policy status Guardian holds', d, 'Premium Paying');
has('the record type', d, 'life group');
has('a payment carries how it was made', d, 'Cheque · Republic');
has('and its reference', d, 'RC-9002');
has('a renewal with nothing against it says so', d, 'No payment applied to this renewal yet');

console.log('\nTWO CLOCKS, NEVER CALLED THE SAME THING');
has('work still open is aged', d, 'open 16 days');
has('work finished says how long it took', d, 'closed in ');
has('and who it is with', d, 'Branch service desk');

console.log('\nTHE FILTER IS INTERACTIVE');
await p.click('[data-accmonth="7"]'); await p.waitForTimeout(1000);
d = await p.locator('main').innerText();
has('July narrows to July', d, 'Renewals in July 2026');
has('the pension renewal is there', d, 'Pension');
no('and September is not', d, 'Renews 2026-09-01');
await p.click('[data-accmonth="0"]'); await p.waitForTimeout(1000);
has('and the whole year comes back', await p.locator('main').innerText(), 'Renewals in 2026');

console.log('\nA COMMENT GOES INTO CHATTER, ON THE RECORD ITSELF');
await p.click('[data-qopen="00TA1"]'); await p.waitForTimeout(400);
t('a box opens', await p.locator('#qtext').isVisible(), true);
await p.fill('#qtext', 'Alleyne finished on 31 July — payroll can confirm.');
await p.click('[data-qsend="00TA1"]'); await p.waitForTimeout(900);
d = await p.locator('main').innerText();
has('what she wrote is on the thread', d, 'payroll can confirm');
has('over her own name', d, 'Anisa');
const st = await state();
t('and it reached Guardian\'s record', st.feed.filter(f => f.subjectId === '00TA1').length, 1);
t('the box closes after sending', await p.locator('#qtext').count(), 0);

console.log('\nAND IT SAYS SO WHEN IT DOES NOT REACH GUARDIAN');
await p.click('[data-qopen="00TA3"]'); await p.waitForTimeout(400);
await p.fill('#qtext', 'Please confirm the September health billing.');
await p.click('[data-qsend="00TA3"]'); await p.waitForTimeout(900);
has('the employer is told, not left guessing', await p.locator('#qerr').innerText(), 'did not reach Guardian');
t('nothing was posted for it', (await state()).feed.filter(f => f.subjectId === '00TA3').length, 0);
t('and the branch still has it', (await state()).comments.filter(c => c.thread === '00TA3').length, 1);

console.log('\nTHE QUERY HAS TWO SIDES TOO');
await p.click('[data-go="queries"]'); await p.waitForTimeout(800);
has('her query is there', await p.locator('main').innerText(), 'Query on the August 2026 billing');
t('and it can be commented on', await p.locator('[data-qopen="S1"]').count(), 1);
await p.click('[data-qopen="S1"]'); await p.waitForTimeout(400);
await p.fill('#qtext', 'The July invoice still shows him.');
await p.click('[data-qsend="S1"]'); await p.waitForTimeout(900);
d = await p.locator('main').innerText();
has('it lands on the thread', d, 'still shows him');
t('the branch was told', (await state()).mails.filter(m => /Query comment/.test(m.subject)).length, 3);
t('a billing query of ours posts nowhere', (await state()).feed.filter(f => f.subjectId === 'S1').length, 0);
has('the count shows on the query', d, '1 message');

console.log('\nONE BOX AT A TIME');
await p.click('[data-qopen="00T1"]'); await p.waitForTimeout(400);
t('opening another closes the first', await p.locator('#qtext').count(), 1);

console.log('\nAN EMPTY COMMENT IS REFUSED');
await p.fill('#qtext', '   ');
await p.click('[data-qsend="00T1"]'); await p.waitForTimeout(500);
has('it says so', await p.locator('#qerr').innerText(), 'Nothing to send');
t('and nothing was stored', (await state()).comments.length, 3);

console.log('\nSTILL NOTHING INTERNAL, AND STILL ONLY HER COMPANY');
const whole = await p.locator('body').innerText();
no('no keyperson cover', whole, 'keyperson');
no('no other client', whole, 'Northgate');
no('no broken merge fields', whole, '$Record');

console.log('\nSIGNING OUT TAKES THE ACCOUNT WITH IT');
await p.click('[data-signout]'); await p.waitForTimeout(500);
no('the renewals are gone', await p.locator('body').innerText(), 'TGM 4400');
no('and so is the company', await p.locator('body').innerText(), 'MERIDIAN HARDWARE');

console.log('\nAND IT HOLDS ON A PHONE');
await p.setViewportSize({ width: 390, height: 900 });
await p.fill('#code', 'MH001'); await p.fill('#pw', '1');
await p.click('[data-signin]'); await p.waitForTimeout(1800);
await p.click('[data-go="account"]'); await p.waitForTimeout(1200);
t('nothing overflows', await p.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), true);

console.log(`\n${pass} passed, ${fail} failed`);
console.log('errors:', errs.length ? errs : 'none');
await b.close();
process.exit(fail || errs.length ? 1 : 0);
