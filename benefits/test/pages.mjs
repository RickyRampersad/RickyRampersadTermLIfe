/* Every interface page: does it load, does it carry the branch, and does
   it hold together at phone, tablet and desktop.

   The cheapest bench in the set and the one that catches the most — a
   page with a script error renders half of itself and looks fine in a
   screenshot. */
import { createRequire } from 'module';
const { chromium } = createRequire(import.meta.url)('/opt/node22/lib/node_modules/playwright');
const B = 'http://localhost:8955/benefits/';
let pass = 0, fail = 0;
const t = (l, g, w) => { const ok = JSON.stringify(g) === JSON.stringify(w); ok ? pass++ : fail++;
  console.log((ok ? '  ✅ ' : '  ❌ ') + l + (ok ? '' : `  got ${JSON.stringify(g)}`)); };

const PAGES = ['index','group','present','enroll','movement','upload','review','pendings','compare','feedback'];
const SIZES = [['phone',390,844],['tablet',820,1180],['desktop',1440,900]];

const b = await chromium.launch();
const ctx = await b.newContext();

console.log('\nEVERY PAGE LOADS CLEAN');
for (const n of PAGES) {
  const p = await ctx.newPage();
  const errs = [];
  p.on('pageerror', e => errs.push(String(e).slice(0, 110)));
  p.on('console', m => { if (m.type() === 'error' && !/favicon|RRB_VIEWS/.test(m.text())) errs.push('console: ' + m.text().slice(0, 110)); });
  await p.goto(B + n + '.html'); await p.waitForTimeout(650);
  t(n + ' has no script errors', errs, []);
  await p.close();
}

console.log('\nONE DESIGN SYSTEM, ONE MARK');
for (const n of PAGES) {
  const p = await ctx.newPage();
  await p.goto(B + n + '.html'); await p.waitForTimeout(500);
  const css = await p.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--navy').trim());
  t(n + ' resolves branch.css', css, '#07131f');
  /* Nothing draws its own shield. The house rule, asserted rather than
     remembered — it has been broken twice. */
  const drawn = await p.evaluate(() =>
    [...document.querySelectorAll('svg')].filter(s => (s.getAttribute('viewBox') || '') === '0 0 64 64').length);
  t(n + ' draws no substitute logo', drawn, 0);
  await p.close();
}

console.log('\nNOTHING OVERFLOWS, AT ANY SIZE');
for (const [label, w, h] of SIZES) {
  const p = await ctx.newPage({ viewport: { width: w, height: h } });
  for (const n of PAGES) {
    await p.goto(B + n + '.html'); await p.waitForTimeout(450);
    const over = await p.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
    t(`${n} fits ${label}`, over <= 1, true);
  }
  await p.close();
}

console.log(`\n${pass} passed, ${fail} failed`);
await b.close();
process.exit(fail ? 1 : 0);
