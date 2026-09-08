// The film player, end to end, on a clip headless Chromium can actually decode.
// (Playwright's Chromium has no H.264, so the MP4s themselves cannot be used
// here — the 8-second VP9 clip is cut from the client film on the fly.)
//
//   node tools/tests/player.js
const { chromium } = require('/opt/node22/lib/node_modules/playwright');
const { execSync } = require('child_process');
const fs = require('fs'), path = require('path'), os = require('os');
const ROOT = path.resolve(__dirname, '..', '..', 'donthaveanagent');
let pass = 0, fail = 0;
const ok = (c, m, e) => { c ? pass++ : fail++; console.log(`   ${c ? 'PASS' : '** FAIL **'}  ${m}${!c && e ? '  -> ' + e : ''}`); };

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'dhaa-player-'));
  execSync(`ffmpeg -y -loglevel error -ss 50 -t 8 -i "${ROOT}/dhaa-film.mp4" -vf scale=640:-2 -c:v libvpx-vp9 -b:v 400k -an "${dir}/clip.webm"`);
  fs.writeFileSync(`${dir}/t.html`, `<!DOCTYPE html><meta charset="utf-8"><style>
    .vwrap{position:relative;width:640px;aspect-ratio:16/9;background:#000}.vwrap video{width:100%;height:100%;display:block}
    .vcover{position:absolute;inset:0;border:none;background:rgba(0,0,0,.4);color:#fff}.vcover.gone{display:none}</style>
    <div class="vwrap"><video playsinline preload="metadata" data-scenes="2,2,2,2" data-chapters="One|Two|Three|Four"><source src="clip.webm" type="video/webm"></video>
    <button class="vcover" id="cover" type="button">Play</button></div>
    <script src="${ROOT}/player.js" defer></script>`);
  const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium', args: ['--autoplay-policy=no-user-gesture-required', '--mute-audio'] });
  const p = await (await b.newContext({ viewport: { width: 700, height: 500 } })).newPage();
  const errs = []; p.on('pageerror', e => errs.push(String(e)));
  await p.goto('file://' + dir + '/t.html'); await p.waitForTimeout(600);
  const S = () => p.evaluate(() => { const v = document.querySelector('video'), w = document.querySelector('.vwrap');
    return { paused: v.paused, t: v.currentTime, cls: w.className, chap: document.querySelector('.dp-chap').textContent,
      time: document.querySelector('.dp-time').textContent, dots: document.querySelectorAll('.dp-dots i').length,
      now: (document.querySelector('.dp-dots i.now') || {}).title, cover: getComputedStyle(document.querySelector('.vcover')).display }; });

  console.log('=== it starts on the cover, and only once ===');
  let s = await S();
  ok(s.dots === 4 && s.chap === 'One' && s.time === '0:00 / 0:08', 'four scene dots, the first chapter named, the length read', JSON.stringify(s));
  await p.click('#cover'); await p.waitForTimeout(1200); s = await S();
  ok(!s.paused && s.t > 0.5 && s.cover === 'none', 'the cover tap plays it and the cover goes', JSON.stringify(s));

  console.log('\n=== the bar folds away while it plays, the thin line stays ===');
  await p.mouse.move(2, 2); await p.waitForTimeout(3200); s = await S();
  ok(/dp-idle/.test(s.cls) && !s.paused, 'idle after three seconds without a hand on it', s.cls);
  const slim = await p.evaluate(() => getComputedStyle(document.querySelector('.dp-slim')).opacity);
  ok(slim === '1', 'the thin progress line is showing while idle', 'opacity ' + slim);
  ok(s.chap === 'Three' && s.now === 'Three', 'the chapter follows the scene the film is in', s.chap + '/' + s.now);

  console.log('\n=== a tap on the picture pauses, another resumes ===');
  const box = await p.locator('.vwrap').boundingBox();
  await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2); await p.waitForTimeout(300); s = await S();
  ok(s.paused && !/dp-idle/.test(s.cls), 'paused, and the bar came back', s.cls);
  const flashed = await p.evaluate(() => document.querySelector('.dp-flash').classList.contains('go'));
  ok(flashed, 'the glyph flashed');
  await p.mouse.click(box.x + box.width / 2, box.y + box.height / 2); await p.waitForTimeout(500); s = await S();
  ok(!s.paused, 'resumed');

  console.log('\n=== the rail seeks ===');
  const rail = await p.locator('.dp-rail').boundingBox();
  await p.mouse.click(rail.x + rail.width * 0.8, rail.y + rail.height / 2); await p.waitForTimeout(400); s = await S();
  ok(s.t > 6 && s.chap === 'Four', 'a click at 80% lands in the last scene', JSON.stringify({ t: s.t, chap: s.chap }));

  console.log('\n=== the end brings the cover back, and it replays ===');
  await p.waitForTimeout(2800); s = await S();
  ok(s.paused && s.t === 0 && s.cover !== 'none' && !/dp-on/.test(s.cls), 'ended: cover back, time reset', JSON.stringify(s));
  await p.click('#cover'); await p.waitForTimeout(800); s = await S();
  ok(!s.paused && s.t > 0.2, 'plays again from the cover', JSON.stringify(s));

  ok(errs.length === 0, 'no page errors', errs.join(' | '));
  await b.close(); fs.rmSync(dir, { recursive: true, force: true });
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
