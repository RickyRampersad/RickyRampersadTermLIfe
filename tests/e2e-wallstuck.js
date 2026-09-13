// A wall that has stopped turning is a wall nobody trusts again.
//
// On 10 September the branch reported the wall "static". Everything on it was
// healthy — every story loaded, every feed was fresh — and it was sitting on
// one screen. Two ways in, and both of them were mine:
//
//   1. A story tells the player when its voice starts and stops, and the
//      player holds that story while it speaks. Nothing capped the hold. One
//      line of audio that errors or stalls, and `ended` never fires, so the
//      story never says it stopped, and the wall holds it for ever.
//   2. Pause had no way back. Somebody setting the screen up — or a remote
//      with a space bar on it — pauses the wall and walks away, and it is
//      paused until a person returns to that keyboard.
//
// So: whatever holds a story, the hold ends. This proves it, and it proves
// the story's own voice gives up on a line that will not play.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT = 8813;
const TYPES = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.png':'image/png' };
const server = http.createServer((req, res) => {
  let f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('no'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
let fails = 0;
const ok = (what, cond, extra) => { console.log((cond ? '  ok   ' : '  FAIL ') + what + (extra && !cond ? '  — ' + extra : '')); if (!cond) fails++; };

async function open(b, query) {
  const ctx = await b.newContext({ viewport:{ width:1280, height:720 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.message)));
  await page.route(u => u.hostname !== 'localhost', r => {
    const h = new URL(r.request().url()).hostname;
    if (/script\.google\.com$/.test(h)) return r.fulfill({ status:200, contentType:'application/json', body:'{"ok":false}' });
    return r.fulfill({ status:200, contentType:'text/css', body:'' });
  });
  await page.goto(`http://localhost:${PORT}/intelligence/wall/all.html${query || ''}`, { waitUntil:'domcontentloaded' });
  return { page, ctx, errors };
}
const at = page => page.evaluate(() => [...document.querySelectorAll('iframe.slide')].findIndex(f => f.classList.contains('on')));
// Turning is what is being tested, so watch for a turn rather than sleeping
// through the worst case: a wall that heals in four seconds should not cost
// the suite twenty.
async function turnsWithin(page, ms) {
  const from = await at(page), until = Date.now() + ms;
  while (Date.now() < until) {
    await page.waitForTimeout(500);
    if (await at(page) !== from) return true;
  }
  return false;
}

(async () => {
  server.listen(PORT);
  const b = await chromium.launch({ executablePath: CHROME });

  console.log('\nA story that says it is speaking and never says it stopped:\n');
  {
    const s = await open(b, '?secs=4&narcap=6');
    await s.page.waitForTimeout(2500);
    // Exactly what a stalled line of audio leaves behind: the "voice on"
    // message, and then silence.
    await s.page.evaluate(() => window.postMessage({ rrb:'narration', on:true }, '*'));
    await s.page.waitForTimeout(600);
    ok('the wall is holding the story while it speaks',
       await s.page.evaluate(() => narrating) === true);
    ok('and it turns anyway once the voice has outstayed every honest length',
       await turnsWithin(s.page, 20000));
    ok('the hold is let go, not merely stepped over',
       await s.page.evaluate(() => narrating) === false);
    ok('no javascript errors', s.errors.length === 0, s.errors.join(' | '));
    await s.ctx.close();
  }

  console.log('\nA pause nobody comes back to lift:\n');
  {
    const s = await open(b, '?secs=4&resume=6');
    await s.page.waitForTimeout(2500);
    await s.page.keyboard.press(' ');
    await s.page.waitForTimeout(600);
    ok('space holds the wall', await s.page.evaluate(() => paused) === true);
    ok('and the wall goes again on its own', await turnsWithin(s.page, 20000));
    ok('the pause is lifted, and the rail says so',
       await s.page.evaluate(() => paused) === false &&
       /next in/.test(await s.page.locator('#state').innerText()));
    await s.ctx.close();
  }

  console.log('\nA line of audio that will not play, inside the story:\n');
  {
    // The player's own cap is put far out of reach, so only the story's own
    // giving-up can end this.
    const s = await open(b, '?secs=600&narcap=600');
    await s.page.waitForTimeout(4000);
    const frame = s.page.frames().find(f => f.url().indexOf('/day.html') > -1);
    ok('the day story is mounted', !!frame);
    if (frame) {
      await frame.evaluate(() => {
        NARRATION.length = 1;                       // one line is enough to prove it
        window.Audio = function () {                // plays, and then never ends
          this.play = function () { return Promise.resolve(); };
          this.pause = function () {};
        };
      });
      await s.page.keyboard.press('n');
      await s.page.waitForTimeout(800);
      ok('the story says it is speaking', await s.page.evaluate(() => narrating) === true);
      const until = Date.now() + 25000;
      let freed = false;
      while (Date.now() < until && !freed) {
        await s.page.waitForTimeout(500);
        freed = await s.page.evaluate(() => narrating) === false;
      }
      ok('and the story gives up on the line and says the voice stopped', freed);
      ok('its own button is back to Narrate',
         await frame.evaluate(() => document.querySelector('#sound').textContent.indexOf('Narrate') > -1));
    }
    ok('no javascript errors', s.errors.length === 0, s.errors.join(' | '));
    await s.ctx.close();
  }

  console.log('\nOne story loaded and no other — a wall that cannot turn says so:\n');
  {
    // Turning to a frame that has not painted would put a blank screen on the
    // branch floor, so the wall rightly holds the one story it has. What it
    // must not do is look identical to a wall that has died.
    const s = await open(b, '?secs=4');
    // Past the boot stagger — the stories are asked for 2.5s apart, and one
    // arriving after the flags are set is a second story, not a park.
    await s.page.waitForTimeout(18000);
    await s.page.evaluate(() => { SLIDES.forEach(function (x, i) { x.ready = i === at; x.dead = false; }); });
    await s.page.waitForTimeout(600);
    ok('it holds the only story it has', await turnsWithin(s.page, 6000) === false);
    ok('and the timer says why, rather than counting down to nothing',
       /only this story has loaded/.test(await s.page.locator('#state').innerText()),
       await s.page.locator('#state').innerText());
    // And the moment a second story paints, it turns again.
    await s.page.evaluate(() => { SLIDES.forEach(function (x) { x.ready = true; }); });
    ok('and turns again the moment a second one paints', await turnsWithin(s.page, 12000));
    await s.ctx.close();
  }

  await b.close();
  server.close();
  console.log();
  console.log(fails ? `  ${fails} FAILED` : '  all good');
  process.exit(fails ? 1 : 0);
})();
