/* The advisor's presentation builder.

   The risk on this page is a confident wrong number. It reads figures out
   of a Guardian illustration and puts them on a slide a client reads in a
   boardroom, so the assertions that matter are the ones about a figure it
   could NOT find: it must say so rather than print a zero. */
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('/opt/node22/lib/node_modules/playwright');
const B = 'http://localhost:8955/benefits/';
let pass = 0, fail = 0;
const t = (l, g, w) => { const ok = JSON.stringify(g) === JSON.stringify(w); ok ? pass++ : fail++;
  console.log((ok ? '  ✅ ' : '  ❌ ') + l + (ok ? '' : `  got ${JSON.stringify(g)}`)); };
const has = (l, hay, n) => { const ok = String(hay).toLowerCase().includes(String(n).toLowerCase());
  ok ? pass++ : fail++;
  console.log((ok ? '  ✅ ' : '  ❌ ') + l + (ok ? '' : `\n        not in: ${String(hay).slice(0, 300)}`)); };
const no = (l, hay, n) => { const ok = !String(hay).toLowerCase().includes(String(n).toLowerCase());
  ok ? pass++ : fail++;
  console.log((ok ? '  ✅ ' : '  ❌ ') + l + (ok ? '' : `\n        WAS in: ${String(hay).slice(0, 300)}`)); };

const b = await chromium.launch();
const p = await (await b.newContext()).newPage({ viewport: { width: 1280, height: 1400 } });
const errs = []; p.on('pageerror', e => errs.push(String(e)));

/* Sign-in goes to the live Apps Script, which is not this bench's job.
   Stub it and drive the page. */
await p.route('**script.google.com/**', r => r.fulfill({
  status: 200, contentType: 'application/json',
  body: JSON.stringify({ ok: true, name: 'Kerwyn Ramroach', role: 'agent', title: 'Agent' })
}));

console.log('\nTHE ADVISOR SIGNS IN');
await p.goto(B + 'present.html'); await p.waitForTimeout(500);
has('the gate names the role', await p.locator('.gate').innerText(), 'Advisor sign in');
has('and says nothing is uploaded', await p.locator('.gate').innerText(), 'stays in this browser');
t('it carries the real mark', await p.locator('.gate .mark img').count(), 1);
await p.fill('#code', 'A01363'); await p.fill('#pw', 'x');
await p.click('[data-signin]'); await p.waitForTimeout(700);
has('the advisor is named', await p.locator('#me').innerText(), 'Kerwyn');

console.log('\nWHO IT IS FOR');
await p.fill('#cname', 'Xtra Foods Supermarkets');
await p.fill('#ccontact', 'Lorna Samaroo-Paul, Payroll Manager');
await p.fill('#clives', '158');
await p.fill('#cpayroll', '96000');
await p.click('[data-line="life"]'); await p.waitForTimeout(400);
const band = await p.locator('#band').innerText();
has('the band names the client', band, 'Xtra Foods');
has('and who it is presented to', band, 'Lorna');
has('with the headcount', band, '158');

console.log('\nTHE DECK BUILDS WITH NO ILLUSTRATIONS AT ALL');
await p.click('[data-build]'); await p.waitForTimeout(700);
let d = await p.locator('#deck').innerText();
has('a cover with the client on it', d, 'Xtra Foods Supermarkets');
has('the advisor is credited', d, 'Kerwyn Ramroach');
has('the lines are argued, not listed', d, 'Pays you a lump sum while you are still alive');
has('critical illness is distinguished from life', d, 'Critical illness pays you while you are recovering');
has('and the closing slide exists', d, 'What happens next');
has('with the branch number', d, '678-5921');

console.log('\nTHE SLIDE THAT MAKES THE CASE');
has('five times salary is on it', d, 'five years of salary');
has('and with no sum assured read, it says so', d, 'has not been filled in yet');
has('naming why it matters', d, 'the whole conversation turns on');
no('it does not print a zero cover figure', d, '$0');
no('and does not claim the plan covers anything', d, 'This plan covers');

console.log('\nPRODUCTS ARE NAMED, AND CLASSIFIED FROM THE CONTRACT');
has('the pension plans are named', d, 'TopHat Special Edition');
has('critical illness is the Rejuvenator', d, 'Life Evolution Rejuvenator');
has('and it is called a living benefit', d, 'not payable on death');
has('the PA riders are listed', d, 'Hospital Cash');
has('group life names its plans', d, 'Xpress Life');

console.log('\nA COST SLIDE ONLY APPEARS WHEN A PRICE WAS READ');
no('no costs slide without an illustration', d, 'What it costs');

console.log('\nBACK TO EDIT, AND THE DECK IS NOT LOST');
await p.click('[data-back]'); await p.waitForTimeout(500);
t('the client name survived', await p.inputValue('#cname'), 'Xtra Foods Supermarkets');
t('and the headcount', await p.inputValue('#clives'), '158');

console.log('\nA LINE CAN BE TAKEN OFF THE DECK');
await p.click('[data-line="pa"]'); await p.waitForTimeout(400);
await p.click('[data-build]'); await p.waitForTimeout(600);
d = await p.locator('#deck').innerText();
no('personal accident is gone', d, 'Pays on an accident');
has('but the others remain', d, 'Replaces your salary when it stops');

console.log('\nSIGNING OUT CLEARS THE CLIENT');
await p.click('[data-signout]'); await p.waitForTimeout(500);
t('the gate is back', await p.locator('.gate').count(), 1);
no('and the client is gone', await p.locator('body').innerText(), 'Xtra Foods');

console.log(`\n${pass} passed, ${fail} failed`);
console.log('errors:', errs.length ? errs : 'none');
await b.close();
process.exit(fail || errs.length ? 1 : 0);
