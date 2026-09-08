#!/usr/bin/env node
/**
 * board-fit.js — does every wall slide clear the footer?
 *
 * The board is read from across a room, so a row hidden behind the footer is
 * a row that does not exist. The renewals slide shipped with ten rows because
 * ten fitted the monitor it was built on; on a 720p screen the last two sat
 * under the footer, and the two furthest-out renewals were the ones nobody
 * saw. This walks every slide at both wall sizes and fails loudly.
 *
 *   node tools/board-fit.js            # expects a server on :8891
 *   (cd . && python3 -m http.server 8891 &)
 *
 * Exits non-zero if anything is clipped, so it can gate a deploy.
 */
const { chromium } = require('/opt/node22/lib/node_modules/playwright');

const URL = process.env.BOARD_URL || 'http://127.0.0.1:8891/board/';
const SIZES = [{ width: 1280, height: 720 }, { width: 1920, height: 1080 }];

(async () => {
  const browser = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
  let bad = 0;

  for (const vp of SIZES) {
    const page = await browser.newPage({ viewport: vp });
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.goto(URL);
    await page.waitForTimeout(1200);

    const count = await page.evaluate(() => document.querySelectorAll('.slide').length);
    console.log(`\n${vp.width}x${vp.height} — ${count} slides`);

    for (let i = 0; i < count; i++) {
      const r = await page.evaluate(() => {
        const s = document.querySelector('.slide.on');
        if (!s) return null;
        const foot = document.querySelector('footer') || document.querySelector('#src');
        const footTop = foot ? foot.getBoundingClientRect().top : window.innerHeight;
        // The lowest thing the slide actually draws.
        let low = 0, label = '';
        s.querySelectorAll('*').forEach(el => {
          const b = el.getBoundingClientRect();
          if (b.height && b.bottom > low) { low = b.bottom; label = el.className || el.tagName; }
        });
        const head = s.querySelector('h2');
        return {
          title: (s.querySelector('.kick') || {}).textContent || '(slide)',
          headTop: head ? Math.round(head.getBoundingClientRect().top) : null,
          low: Math.round(low), lowest: String(label).slice(0, 28), footTop: Math.round(footTop)
        };
      });
      if (r) {
        // 76px is the fixed masthead; a headline above it is overlapping.
        const overFoot = r.low - r.footTop;
        const underHead = r.headTop !== null && r.headTop < 76;
        const ok = overFoot <= 0 && !underHead;
        if (!ok) bad++;
        console.log(
          `  ${ok ? 'ok  ' : 'FAIL'} ${String(r.title).trim().padEnd(22)}` +
          `bottom ${String(r.low).padStart(4)} / footer ${r.footTop}` +
          (overFoot > 0 ? `  ← clipped by ${overFoot}px (${r.lowest})` : '') +
          (underHead ? `  ← headline under the masthead` : '')
        );
      }
      await page.keyboard.press('ArrowRight');
      await page.waitForTimeout(260);
    }
    if (errors.length) { bad++; console.log('  page errors: ' + errors.join(' | ')); }
    await page.close();
  }

  await browser.close();
  console.log(bad ? `\n${bad} problem(s).` : '\nEvery slide fits at both sizes.');
  process.exit(bad ? 1 : 0);
})();
