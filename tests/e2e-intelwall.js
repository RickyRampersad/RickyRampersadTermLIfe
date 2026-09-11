// The Branch Intelligence Wall streams all five screens from one address.
//
// The five stories were built as five standing pages, and on the branch floor
// only ever one of them was seen. /intelligence/wall/all.html mounts all five
// once and turns between them; /intelwall forwards to it. This proves the
// player holds five frames, shows them one at a time in the film's order,
// moves on by itself, answers the keys, skips a story that never loads, and
// that the short link lands on it — against the real story pages, with their
// Salesforce feed stubbed silent.
//
// And what a person on the floor asked for on 8 September: the timer and the
// line on every slide, not just the first; play and pause throughout — a
// voice on every screen, and the wall holding a screen while it speaks.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT = 8808;
const TYPES = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css', '.png':'image/png', '.jpg':'image/jpeg', '.svg':'image/svg+xml' };
let hung = null, hungAsks = 0;                     // a story made to never answer
const server = http.createServer((req, res) => {
  let f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (hung && f.endsWith(hung)) { hungAsks++; return; }   // never answers: the wall must cope
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('no'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});
let fails = 0;
const ok = (what, cond, extra) => { console.log((cond ? '  ok   ' : '  FAIL ') + what + (extra && !cond ? '  — ' + extra : '')); if (!cond) fails++; };
const ORDER = ['day.html', 'blocks.html', 'pending.html', 'ready.html', 'triage.html', 'culprits.html',
               'index.html', 'possession.html', 'delivery.html', 'licence.html', 'book.html'];

async function open(b, query) {
  const ctx = await b.newContext({ viewport:{ width:1920, height:1080 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(String(e.message)));
  // Nothing leaves the machine. Every story's feed is silenced so they settle
  // on "no feed" and the wall turns anyway; the fonts come back empty so a
  // slow CDN cannot hold a frame's load event, which is what held the first
  // run of this test for twenty seconds while the wall turned four times.
  await page.route(u => u.hostname !== 'localhost', r => {
    const h = new URL(r.request().url()).hostname;
    if (/script\.google\.com$/.test(h)) return r.fulfill({ status:200, contentType:'application/json', body:'{"ok":false}' });
    return r.fulfill({ status:200, contentType:'text/css', body:'' });
  });
  // The document, not the frames: the player starts turning the moment the
  // script runs, so the clock for these checks starts there too.
  await page.goto(`http://localhost:${PORT}/intelligence/wall/all.html${query || ''}`, { waitUntil:'domcontentloaded' });
  return { page, ctx, errors };
}
// Derived, never typed: the order above is the only place a stop's number
// lives, so adding a screen does not silently rewrite every index below.
const at = file => ORDER.indexOf(file);
const LAST = () => ORDER.length - 1;
const visible = page => page.evaluate(() => [...document.querySelectorAll('iframe.slide')].map((f, i) => f.classList.contains('on') ? i : -1).filter(i => i > -1));
const srcs = page => page.evaluate(() => [...document.querySelectorAll('iframe.slide')].map(f => (f.getAttribute('src') || '').split('/').pop()));

(async () => {
  server.listen(PORT);
  const b = await chromium.launch({ executablePath: CHROME });

  console.log('\nFive stories, one at a time:\n');
  let s = await open(b, '?secs=5');
  await s.page.waitForTimeout(1200);
  ok('eleven frames on the stage', await s.page.locator('iframe.slide').count() === 11);
  ok('the first is showing and only the first', JSON.stringify(await visible(s.page)) === '[0]', JSON.stringify(await visible(s.page)));
  ok('and the boot card has cleared', await s.page.evaluate(() => document.getElementById('boot').classList.contains('gone')));
  const t0 = await s.page.locator('body').innerText();
  ok('eleven named stops on the rail, the branch\'s own day first', /1\. The day so far/.test(t0) && /4\. Ready to settle/.test(t0) && /11\. Birthdays today/.test(t0));
  await s.page.waitForTimeout(18000);          // stagger is 1.5s apart: all eleven assigned by 15s
  ok('every story is loaded in its own frame, in the film\'s order', JSON.stringify(await srcs(s.page)) === JSON.stringify(ORDER), JSON.stringify(await srcs(s.page)));
  const first = await s.page.frames().filter(f => f.url().endsWith('/day.html')).length;
  ok('the first story really rendered inside its frame', first === 1);
  ok('it has moved on by itself within the dwell', (await visible(s.page))[0] >= 1, JSON.stringify(await visible(s.page)));
  await s.page.screenshot({ path: '/tmp/intelwall-slide.png' });

  console.log('\nThe first turn comes early:\n');
  const e = await open(b, '');                    // the real dwells: 26s for the first story
  await e.page.waitForTimeout(14000);
  ok('with no dwell given, the wall has moved off the first story inside fifteen seconds', (await visible(e.page))[0] === 1, JSON.stringify(await visible(e.page)));
  ok('no javascript errors', e.errors.length === 0, e.errors.join(' | '));
  await e.ctx.close();

  console.log('\nThe keys:\n');
  await s.page.keyboard.press('8');  await s.page.waitForTimeout(300);
  ok('a number jumps to that story', JSON.stringify(await visible(s.page)) === '[7]',
     JSON.stringify(await visible(s.page)));
  // Past nine screens a single keypress cannot reach the rest, and the rail
  // is how anybody gets there — so that is how the wrap is tested.
  await s.page.mouse.move(600, 600);
  await s.page.locator('.dot', { hasText: 'Birthdays today' }).click(); await s.page.waitForTimeout(300);
  ok('the rail reaches a stop no key can', JSON.stringify(await visible(s.page)) === '[' + LAST() + ']',
     JSON.stringify(await visible(s.page)));
  await s.page.keyboard.press('ArrowRight'); await s.page.waitForTimeout(300);
  ok('right from the last wraps to the first', JSON.stringify(await visible(s.page)) === '[0]');
  await s.page.keyboard.press('ArrowLeft'); await s.page.waitForTimeout(300);
  ok('left from the first wraps to the last', JSON.stringify(await visible(s.page)) === '[' + LAST() + ']');
  await s.page.keyboard.press(' ');
  const before = (await visible(s.page))[0];
  await s.page.waitForTimeout(6500);
  ok('space holds the story past its dwell', (await visible(s.page))[0] === before && /paused/.test(await s.page.locator('#state').innerText()));
  await s.page.keyboard.press(' ');
  await s.page.mouse.move(600, 600);
  await s.page.locator('.dot', { hasText: 'With the agent' }).click(); await s.page.waitForTimeout(300);
  ok('a stop on the rail goes there', JSON.stringify(await visible(s.page)) === '[' + at('delivery.html') + ']',
     JSON.stringify(await visible(s.page)));

  console.log('\nThe timer is on every slide, and so is the line:\n');
  const hudBox = () => s.page.evaluate(() => { const r = document.getElementById('hud').getBoundingClientRect();
    const cs = getComputedStyle(document.getElementById('hud'));
    return { in: r.right <= innerWidth && r.bottom <= innerHeight && r.width > 80, op: cs.opacity, vis: cs.visibility }; });
  await s.page.mouse.move(5, 5); await s.page.waitForTimeout(4600);        // the rail has faded by now
  ok('the rail has faded', await s.page.evaluate(() => document.getElementById('rail').classList.contains('hide')));
  let hb = await hudBox();
  ok('but the timer is still on screen', hb.in && hb.op === '1' && hb.vis === 'visible', JSON.stringify(hb));
  const hudText = () => s.page.locator('#state').innerText();
  const SLIDE_NAMES = ['The day so far', 'The day in blocks', 'What is pending', 'Ready to settle',
                       'Whose move is it', 'Who is holding it up', 'Premium dues',
                       'In our possession', 'With the agent', 'The licence year', 'Birthdays today'];
  // Not pinned to one slide: the rail takes four seconds to fade and the dwell
  // here is five, so the wall may legitimately have turned by now. What must
  // hold is the shape — which story of how many, named, and the seconds left.
  const hudNow = await hudText();
  ok('it says which story and how long is left',
     new RegExp('\\b([1-9]|1[01]) of ' + ORDER.length + '\\b').test(await hudText()) && /next in \d+s/.test(await hudText()) &&
     SLIDE_NAMES.some(nm => (hudNow || '').indexOf(nm) > -1), await hudText());
  const barH = await s.page.evaluate(() => parseFloat(getComputedStyle(document.getElementById('bar')).height));
  ok('the line across the top is thick enough to see', barH >= 5, barH + 'px');
  await s.page.keyboard.press('4'); await s.page.waitForTimeout(300);     // a fresh turn, so the line is near its start
  const w1 = await s.page.evaluate(() => parseFloat(document.getElementById('bar').style.width));
  await s.page.waitForTimeout(1000);
  const w2 = await s.page.evaluate(() => parseFloat(document.getElementById('bar').style.width));
  const f2 = await s.page.evaluate(() => parseFloat(document.getElementById('fill').style.width));
  ok('and it runs, in step with the timer\'s own track', w2 > w1 && Math.abs(w2 - f2) < 2, w1 + ' -> ' + w2 + ' / ' + f2);
  // No key reaches past the ninth stop, so the rail is how the last one is
  // reached — which is also how a person on the floor would do it.
  await s.page.mouse.move(600, 600);
  await s.page.locator('.dot', { hasText: 'Birthdays today' }).click(); await s.page.waitForTimeout(300);
  ok('on the last story it still shows',
     new RegExp(ORDER.length + ' of ' + ORDER.length).test(await hudText()) &&
     /Birthdays today/.test(await hudText()) && (await hudBox()).in, await hudText());

  console.log('\nPlay and pause, on the rail, on every slide:\n');
  await s.page.mouse.move(600, 600); await s.page.waitForTimeout(200);
  ok('the rail carries pause, previous, next and narrate', await s.page.evaluate(() => ['pp','prev','next','nar'].every(id => !!document.getElementById(id))));
  await s.page.locator('#pp').click();
  const held = (await visible(s.page))[0];
  await s.page.waitForTimeout(6500);
  ok('pause holds the story past its dwell', (await visible(s.page))[0] === held && /paused/.test(await hudText()), await hudText());
  ok('and the rail stays while paused', !(await s.page.evaluate(() => document.getElementById('rail').classList.contains('hide'))));
  ok('the button now offers play', /Play/.test(await s.page.locator('#pp').innerText()));
  await s.page.locator('#pp').click(); await s.page.waitForTimeout(200);
  ok('play goes on', !/paused/.test(await hudText()) && /Pause/.test(await s.page.locator('#pp').innerText()));
  await s.page.locator('#next').click(); await s.page.waitForTimeout(300);
  ok('next moves on', JSON.stringify(await visible(s.page)) === '[0]', JSON.stringify(await visible(s.page)));
  await s.page.locator('#prev').click(); await s.page.waitForTimeout(300);
  ok('previous goes back', JSON.stringify(await visible(s.page)) === '[' + LAST() + ']', JSON.stringify(await visible(s.page)));

  console.log('\nA story that speaks holds the wall:\n');
  await s.page.keyboard.press('1'); await s.page.waitForTimeout(300);
  const story = s.page.frames().find(f => f.url().endsWith('/day.html'));
  ok('the first story is up and reachable', !!story && JSON.stringify(await visible(s.page)) === '[0]');
  await story.evaluate(() => { window.__nar = 0; window.__hush = 0; window.toggleSound = () => { window.__nar++; };
    window.addEventListener('message', e => { if (e.data && e.data.rrb === 'hush') window.__hush++; }); });
  await s.page.locator('#nar').click(); await s.page.waitForTimeout(300);
  ok('the rail\'s Narrate asks the story on screen to speak', await story.evaluate(() => window.__nar) === 1);
  await story.evaluate(() => parent.postMessage({ rrb:'narration', on:true }, '*'));
  await s.page.waitForTimeout(6500);                                        // well past the 5s dwell
  ok('while it speaks the wall holds it', JSON.stringify(await visible(s.page)) === '[0]' && /narrating/.test(await hudText()), await hudText());
  ok('and the rail says so', /Stop/.test(await s.page.locator('#nar').innerText()));
  await story.evaluate(() => parent.postMessage({ rrb:'narration', on:false }, '*'));
  await s.page.waitForTimeout(1500);
  ok('when the voice stops the story keeps the screen a moment', JSON.stringify(await visible(s.page)) === '[0]');
  await s.page.waitForTimeout(6000);
  ok('then the wall goes on', (await visible(s.page))[0] === 1, JSON.stringify(await visible(s.page)));
  await s.page.keyboard.press('1'); await s.page.waitForTimeout(300);
  await story.evaluate(() => parent.postMessage({ rrb:'narration', on:true }, '*'));
  await s.page.keyboard.press('ArrowRight'); await s.page.waitForTimeout(300);
  ok('turning away asks the story to hush', await story.evaluate(() => window.__hush) === 1 && !/narrating/.test(await hudText()));

  console.log('\nA birthday on the branch rides every slide:\n');
  await story.evaluate(() => parent.postMessage({ rrb:'celebrate', names:['Pat Example', 'Kim Support'] }, '*'));
  await s.page.waitForTimeout(300);
  const cakeText = () => s.page.evaluate(() => { const c = document.getElementById('cake'); return c.hidden ? '' : c.innerText; });
  ok('the wish appears, first names only', /Pat and Kim/.test(await cakeText()) && !/Example/.test(await cakeText()), await cakeText());
  await s.page.keyboard.press('3'); await s.page.waitForTimeout(300);
  ok('and stays up on another slide', /Pat and Kim/.test(await cakeText()));
  await story.evaluate(() => parent.postMessage({ rrb:'celebrate', names:[] }, '*'));
  await s.page.waitForTimeout(200);
  ok('and goes when there is nobody', (await cakeText()) === '');

  console.log('\nThe keys reach the wall from inside a story:\n');
  // Whichever stop possession is now — the number is read off the order.
  await s.page.locator('.dot', { hasText: 'In our possession' }).click(); await s.page.waitForTimeout(300);
  const inside = s.page.frames().find(f => f.url().endsWith('/possession.html'));
  await inside.locator('body').click({ position: { x: 300, y: 500 } });       // focus is now inside the frame
  await s.page.keyboard.press('ArrowRight'); await s.page.waitForTimeout(300);
  ok('a key pressed inside a story still turns the wall',
     JSON.stringify(await visible(s.page)) === '[' + (at('possession.html') + 1) + ']', JSON.stringify(await visible(s.page)));
  ok('and a mouse inside a story wakes the rail', !(await s.page.evaluate(() => document.getElementById('rail').classList.contains('hide'))));
  ok('no javascript errors', s.errors.length === 0, s.errors.join(' | '));
  await s.ctx.close();

  console.log('\nA story that never loads:\n');
  hung = '/intelligence/wall/licence.html';
  s = await open(b, '?secs=2&grace=1&retry=4');
  await s.page.waitForTimeout(13500);          // past its grace, and a few turns
  // sampled well inside the dwell, or the samples alias to the turning and see the same story every time
  const seen = new Set();
  for (let i = 0; i < 30; i++) { seen.add((await visible(s.page))[0]); await s.page.waitForTimeout(500); }
  // Wherever licence.html sits in the order, that stop is the silent one and
  // every other stop has to keep going round it.
  const dead = at('licence.html');
  /* The strict half is the one that matters: the silent story is NEVER put
     on the wall. The other half is deliberately loose — this run sets the
     grace to one second, so every screen that has not painted inside a
     second is struck through and asked for again, and which of them happen
     to be ready during any thirty seconds of that is not a fact about the
     player. What has to hold is that it keeps turning through most of them. */
  ok('the silent one is never shown', !seen.has(dead),
     'saw ' + [...seen].sort((a, b) => a - b).join(',') + ' · silent is ' + dead);
  ok('and the wall keeps turning through the rest', seen.size >= 6,
     seen.size + ' of ' + (ORDER.length - 1) + ' seen');
  ok('and it is struck through on the rail', await s.page.locator('.dot.dead').count() === 1);
  ok('and asked for again rather than given up on for the day', hungAsks >= 2, 'asked ' + hungAsks + ' time(s)');
  ok('no javascript errors', s.errors.length === 0, s.errors.join(' | '));
  await s.ctx.close();
  hung = null;

  console.log('\nThe short link:\n');
  const ctx = await b.newContext(); const page = await ctx.newPage();
  await page.route(u => u.hostname !== 'localhost', r => r.fulfill({ status:200, contentType:'text/css', body:'' }));
  await page.goto(`http://localhost:${PORT}/intelwall/`, { waitUntil:'domcontentloaded' });
  await page.waitForTimeout(800);
  ok('/intelwall lands on the player', /\/intelligence\/wall\/all\.html$/.test(page.url()), page.url());
  await ctx.close();

  console.log('\nThe page itself:\n');
  const html = fs.readFileSync(path.join(ROOT, 'intelligence/wall/all.html'), 'utf8');
  ok('carries the view beacon', /<!-- rrb-views -->/.test(html));
  ok('uses the branch mark, not a substitute', /logo-mark\.png/.test(html) && !/RR<\/|>RR</.test(html));
  ok('names no colleague and no client', !/sasha|kamla|elizabeth|azariah|pawan|kerwyn|akaash|gary/i.test(html));

  console.log('\nEvery story narrates, in the one voice:\n');
  for (const f of ORDER) {
    const h = fs.readFileSync(path.join(ROOT, 'intelligence/wall', f), 'utf8');
    const block = (h.match(/var NARRATION = \[([\s\S]*?)\n\];/) || ['', ''])[1];
    const lines = (block.match(/\{t:"/g) || []).length;
    ok(f + ' has the Narrate button, ' + lines + ' spoken lines folded in, and tells the wall when it speaks',
       /id="sound"/.test(h) && lines >= 6 && /rrb:"narration"/.test(h) && /d\.rrb==="narrate"/.test(h) && /<!-- rrb-views -->/.test(h));
  }
  const voice = fs.readFileSync(path.join(ROOT, 'intelligence/wall/audio/lines.py'), 'utf8');
  ok('the voice is the branch\'s, not the Multilingual one', /VOICE = 'en-US-AndrewNeural'/.test(voice) && !/Multilingual'/.test(voice) && /RATE = '-12%'/.test(voice));
  const spoken = [...voice.matchAll(/^\s+"([^"]+)",\s*$/gm)].map(m => m[1]);
  ok('no figure is spoken — the screen carries the numbers', spoken.length >= 40 && spoken.every(l => !/\d/.test(l)), spoken.filter(l => /\d/.test(l)).join(' | '));
  console.log('\n  screenshot: /tmp/intelwall-slide.png');

  await b.close(); server.close();
  console.log('\n' + (fails ? fails + ' FAILED' : 'all green') + '\n');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
