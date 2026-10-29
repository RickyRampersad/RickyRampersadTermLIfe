// Render a film page frame by frame, at exactly the moment each frame stands for, instead of recording it in real time.
//
//   node render.js <page.html> <capture-dir> [fps] [poster.jpg]
//
// 14 October 2026: the board films' motion (the camera, the floating screens, the wipes) made Playwright's real-time
// capture uneven, and its timeline stopped being a straight line, so mixany.py could no longer fit it and refused it.
// Here every animation on the page is paused and set to the frame's own moment, the scene that is handing over stays
// on screen until the band has crossed it, and each frame is a screenshot. Nothing runs against the clock, so the
// picture cannot drift from the voice. The frames become <capture-dir>/rendered.mp4, and rendered.json says the
// timeline is exact (lead 0, stretch 1), which mixany.py then uses in place of measuring one.
//
// The page must be a board film (build-boardfilm.py): its script leaves the counters and the hand-over to this file
// when window.__RENDER is set.
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const fs = require('fs'), path = require('path'), { execFileSync } = require('child_process');
(async () => {
  const [page, cap, fpsArg, poster] = process.argv.slice(2);
  const FPS = +(fpsArg || 30);
  const dir = path.join(cap, 'frames');
  fs.rmSync(cap, { recursive: true, force: true }); fs.mkdirSync(dir, { recursive: true });
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--force-device-scale-factor=1'] });
  // 1280x720 unless the film asks for another frame (RENDER_W / RENDER_H): the social cut of the recruiting film is 1080x1920.
  const p = await b.newPage({ viewport: { width: +(process.env.RENDER_W || 1280), height: +(process.env.RENDER_H || 720) } });
  const errs = []; p.on('pageerror', e => errs.push(String(e).slice(0, 160)));
  await p.addInitScript(() => { window.__RENDER = true; });
  await p.goto('file://' + path.resolve(page));
  await p.waitForTimeout(800);
  await p.addStyleTag({ content: '#ctrl{display:none!important}#poster{display:none!important}' });
  await p.evaluate(() => { document.body.classList.add('rolling'); paused = true; });
  const D = await p.evaluate(() => SC.map(s => +s.dataset.d));
  const START = D.reduce((a, d, i) => (a.push(i ? a[i - 1] + D[i - 1] : 0), a), []);
  const TOTAL = D.reduce((a, d) => a + d, 0);
  const N = Math.ceil(TOTAL / 1000 * FPS);
  let scene = -1;
  const t0 = Date.now();
  for (let f = 0; f < N; f++) {
    const T = f * 1000 / FPS;
    let n = 0; while (n + 1 < D.length && START[n + 1] <= T) n++;
    const t = T - START[n];
    if (n !== scene) { await p.evaluate((n) => { paused = true; clearTimeout(timer); go(n); clearTimeout(timer); }, n); scene = n; }
    await p.evaluate(({ n, t, T, D }) => {
      const sc = SC[n], prev = n > 0 ? SC[n - 1] : null;
      if (prev && t >= 720) { prev.classList.remove('act'); prev.classList.remove('out'); }   // the hand-over is over: the outgoing scene has zoomed away
      document.getAnimations().forEach(a => {
        const el = a.effect && a.effect.target; if (!el) return;
        let ct = null;
        if (prev && el === prev) ct = t;                   // the hand-over's own transition, on the outgoing section itself
        else if (sc.contains(el)) ct = t;
        else if (prev && prev.contains(el)) ct = D[n - 1] + t;
        else if (el.closest && el.closest('#bars')) ct = t;
        else if (el.classList && el.classList.contains('grain')) ct = T;
        if (ct !== null) { a.pause(); a.currentTime = ct; }
      });
      sc.querySelectorAll('.cnt').forEach(el => {
        const at = +(el.dataset.at || 0), to = +el.dataset.to, k = Math.max(0, Math.min(1, (t - at) / 1000));
        el.textContent = (el.dataset.pre || '') + (to * (1 - Math.pow(1 - k, 3))).toFixed(+(el.dataset.dec || 0)) + (el.dataset.suf || '');
      });
    }, { n, t, T, D });
    await p.screenshot({ path: path.join(dir, String(f).padStart(6, '0') + '.jpg'), type: 'jpeg', quality: 93 });
    if (poster && Math.abs(T - 2400) < 500 / FPS) fs.copyFileSync(path.join(dir, String(f).padStart(6, '0') + '.jpg'), poster);
    if (f % (FPS * 10) === 0) process.stdout.write(`  ${(T / 1000).toFixed(0)}s of ${(TOTAL / 1000).toFixed(0)}s (${((Date.now() - t0) / 1000).toFixed(0)}s)\n`);
  }
  await b.close();
  execFileSync('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', '-framerate', String(FPS), '-i', path.join(dir, '%06d.jpg'),
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '14', '-pix_fmt', 'yuv420p', path.join(cap, 'rendered.mp4')]);
  fs.writeFileSync(path.join(cap, 'rendered.json'), JSON.stringify({ lead: 0, stretch: 1, fps: FPS, frames: N, ms: TOTAL }));
  fs.rmSync(dir, { recursive: true, force: true });
  console.log('rendered', page, N, 'frames at', FPS, 'fps ·', ((Date.now() - t0) / 1000).toFixed(0), 's · errors:', errs.length ? errs : 'none');
})();
