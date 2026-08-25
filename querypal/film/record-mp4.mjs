/* Record the story film to video, portrait, for people who just want an MP4.
   Playwright captures no audio, so the film paints a sync patch (?rec=1) that
   build-mp4-audio.py reads back to align the narration and score.          */
import { createRequire } from 'module';
import path from 'path';
import fs from 'fs';
const { chromium } = createRequire(import.meta.url)('/opt/node22/lib/node_modules/playwright');
const HERE = path.dirname(new URL(import.meta.url).pathname);
const OUT = path.join(HERE, 'mp4');
fs.mkdirSync(OUT, { recursive: true });

const W = 720, H = 1280;                       // portrait, the way it will be watched
const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({
  viewport: { width: W, height: H },
  recordVideo: { dir: OUT, size: { width: W, height: H } },
  deviceScaleFactor: 2,
});
const page = await ctx.newPage();
page.on('pageerror', e => console.log('page error:', String(e).slice(0, 120)));
await page.goto('file://' + path.join(HERE, 'story-film.html') + '?rec=1');
await page.waitForTimeout(1200);
await page.click('#play');

// run until the film puts itself away
await page.waitForFunction(() => running === false, null, { timeout: 260000 }).catch(() => {});
await page.waitForTimeout(4000);

await ctx.close();
const files = fs.readdirSync(OUT).filter(f => f.endsWith('.webm'));
if (files.length) {
  const src = path.join(OUT, files[0]), dst = path.join(OUT, 'story-video.webm');
  if (src !== dst) fs.renameSync(src, dst);
  console.log('recorded:', dst, Math.round(fs.statSync(dst).size / 1024) + ' KB');
}
await browser.close();
