// how-we-work.html — the page still works after the design pass.
//   node tools/tests/how-we-work.js
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const path = require('path');
const URL = 'file://' + path.resolve(__dirname, '..', '..', 'donthaveanagent', 'how-we-work.html');
let pass = 0, fail = 0;
const ok = (c, m, e) => { c ? pass++ : fail++; console.log(`   ${c ? 'PASS' : '** FAIL **'}  ${m}${!c && e ? '  -> ' + e : ''}`); };

(async () => {
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--mute-audio'] });
  const ctx = await b.newContext({ viewport: { width: 1440, height: 900 } });
  const p = await ctx.newPage(); const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto(URL + '?a=Fawaaz'); await p.waitForTimeout(900);

  console.log('=== the brand is Ink & Coral, and the mark is The Knot ===');
  const brand = await p.evaluate(() => {
    const cs = getComputedStyle(document.documentElement);
    const head = document.querySelector('.top svg');
    return { ink: cs.getPropertyValue('--ink').trim(), muted: cs.getPropertyValue('--muted').trim(),
      head: cs.getPropertyValue('--head').trim(), line: cs.getPropertyValue('--line').trim(),
      knotRects: head ? head.querySelectorAll('rect[rx="12.5"]').length : 0,
      chkFont: getComputedStyle(document.querySelector('.chk h3')).fontFamily.split(',')[0],
      knots: document.querySelectorAll('.knot').length };
  });
  ok(brand.ink === '#0F1A2B' && brand.muted === '#6B7C96', 'ink and muted are the documented values, not the oxblood browns', JSON.stringify(brand));
  ok(!/E4D6C6/i.test(brand.line), 'the card rule is no longer the sand colour', brand.line);
  ok(brand.knotRects === 3, 'the header mark is The Knot — three rounded links', 'rects ' + brand.knotRects);
  ok(brand.knots === 2, 'the mark also carries the hero and the closing band', 'knots ' + brand.knots);
  ok(brand.chkFont === 'Montserrat', 'the check panel heading renders in the display face', brand.chkFont);

  console.log('\n=== it scales without breaking ===');
  for (const [w, h] of [[1728, 1080], [1280, 800], [820, 1180], [390, 844], [320, 640]]) {
    await p.setViewportSize({ width: w, height: h }); await p.waitForTimeout(350);
    const bad = await p.evaluate(() => document.documentElement.scrollWidth > window.innerWidth + 1);
    ok(!bad, `no sideways scroll at ${w}px`);
  }
  await p.setViewportSize({ width: 1440, height: 900 }); await p.waitForTimeout(300);

  console.log('\n=== the agent’s name travels with the link ===');
  const bar = await p.evaluate(() => ({ on: document.querySelector('.agentbar').classList.contains('on'),
    name: document.getElementById('aname').textContent.trim() }));
  ok(bar.on && /Fawaaz/.test(bar.name), 'the agent bar names whoever sent the link', JSON.stringify(bar));

  console.log('\n=== the thirty-second check still answers ===');
  for (const q of [0, 1, 2]) await p.click(`.opts[data-q="${q}"] button:last-child`);
  await p.waitForTimeout(500);
  const res = await p.evaluate(() => { const e = document.getElementById('cres');
    return { on: e.classList.contains('on'), warn: e.classList.contains('warn'), text: e.textContent.slice(0, 40) }; });
  ok(res.on && res.warn, 'three worrying answers produce the warning result', JSON.stringify(res));

  console.log('\n=== the prompt waits for the film, then arrives ===');
  await p.evaluate(() => window.scrollTo(0, 0)); await p.waitForTimeout(700);
  const top = await p.evaluate(() => document.querySelector('.stickycta').classList.contains('on'));
  ok(!top, 'it is out of the way while the film is on screen');
  await p.evaluate(() => window.scrollTo(0, 2200)); await p.waitForTimeout(900);
  const down = await p.evaluate(() => document.querySelector('.stickycta').classList.contains('on'));
  ok(down, 'it arrives once the film has scrolled past');

  console.log('\n=== an anchor jump clears the sticky masthead ===');
  await p.evaluate(() => { location.hash = '#talk'; }); await p.waitForTimeout(1200);
  const clear = await p.evaluate(() => {
    const t = document.querySelector('#talk .eyebrow').getBoundingClientRect().top;
    const bar = document.querySelector('.top').getBoundingClientRect().bottom;
    return { eyebrowTop: Math.round(t), barBottom: Math.round(bar) };
  });
  ok(clear.eyebrowTop >= clear.barBottom - 2, 'the section heading lands below the header, not under it', JSON.stringify(clear));

  console.log('\n=== the film and the callback form are still wired ===');
  const wired = await p.evaluate(() => ({
    player: !!document.querySelector('.vwrap.dp'),
    scenes: (document.querySelector('#v').getAttribute('data-scenes') || '').split(',').length,
    form: !!document.getElementById('cbForm'), start: !!document.getElementById('startB'),
    api: /script\.google\.com/.test(document.body.innerHTML) }));
  ok(wired.player && wired.scenes === 13, 'the film runs through the shared player, with its scene dots', JSON.stringify(wired));
  ok(wired.form && wired.start && wired.api, 'the callback form and the review link are intact');

  ok(errs.length === 0, 'no page errors', errs.join(' | '));
  await b.close();
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
