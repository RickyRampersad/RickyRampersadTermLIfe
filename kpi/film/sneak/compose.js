// Turn the captured screens into 1080x1920 plates.
//
//   node kpi/film/update/compose.js
//
// Vertical, because this goes out on WhatsApp and is watched on a phone —
// the same shape as the thing it is showing. A landscape frame in a chat
// window puts the tracker's own text below the size anyone will read.
//
// Branch colours: navy ground, cream type, gold rule. No webfonts — the
// browser here has no internet, and a missing font is a silent fallback.
const { chromium } = require('playwright');
const fs = require('fs'), path = require('path');

const HERE  = __dirname;
const LINES = JSON.parse(fs.readFileSync(path.join(HERE, 'lines.json'), 'utf8'));
const OUT   = path.join(HERE, 'plates');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';

const NAVY = '#0D1838', CREAM = '#E7D9AE', GOLD = '#C7A34A';
const esc = s => String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const br  = s => esc(s).replace(/\n/g, '<br>');

const plate = (L, dataUri) => `<!doctype html><meta charset="utf-8"><style>
  *{margin:0;padding:0;box-sizing:border-box}
  html,body{width:1080px;height:1920px;background:${NAVY};overflow:hidden}
  body{font-family:'Liberation Sans',Arial,sans-serif;color:${CREAM};
       display:flex;flex-direction:column;padding:96px 84px 78px}
  .kicker{font-size:34px;letter-spacing:.22em;text-transform:uppercase;
          color:${GOLD};font-weight:700;margin-bottom:26px}
  .cap{font-size:${L.shot ? 68 : 86}px;line-height:1.16;font-weight:700;letter-spacing:-.015em}
  .sub{font-size:44px;line-height:1.42;margin-top:34px;color:${CREAM};opacity:.72}
  .stage{display:flex;align-items:center;justify-content:center;margin-top:60px}
  .shot{border-radius:26px;box-shadow:0 34px 90px rgba(0,0,0,.55);display:block}
  .mid{flex:1;display:flex;flex-direction:column;justify-content:center}
  .rule{height:3px;background:${GOLD};opacity:.55;margin:0 0 22px}
  .mark{font-size:28px;letter-spacing:.16em;text-transform:uppercase;opacity:.55}
  footer{margin-top:56px}
</style>
${L.shot ? `
  <div class="mid">
    ${L.kicker ? `<div class="kicker">${esc(L.kicker)}</div>` : ''}
    <div class="cap">${br(L.cap)}</div>
    <div class="stage"><img class="shot" src="${dataUri}"></div>
  </div>`
: `
  <div class="mid">
    ${L.kicker ? `<div class="kicker">${esc(L.kicker)}</div>` : ''}
    <div class="cap">${br(L.cap)}</div>
    ${L.sub ? `<div class="sub">${br(L.sub)}</div>` : ''}
  </div>`}
<footer><div class="rule"></div><div class="mark">Ricky Rampersad Branch</div></footer>
<script>
  // Fit the screen to the stage, growing as well as shrinking. The shots are
  // captured at 3x, so filling the frame costs nothing in sharpness; the cap
  // stops a small crop being blown up past where it still reads clean.
  (function(){
    var img = document.querySelector('.shot'); if (!img) return;
    var fit = function(){
      var st = document.querySelector('.stage').getBoundingClientRect();
      var room = document.querySelector('footer').getBoundingClientRect().top - st.top - 40;
      var k = Math.min(st.width / img.naturalWidth, room / img.naturalHeight, 2.2);
      img.style.width  = Math.round(img.naturalWidth  * k) + 'px';
      img.style.height = Math.round(img.naturalHeight * k) + 'px';
    };
    if (img.complete) fit(); else img.onload = fit;
  })();
</script>`;

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch({ executablePath: CHROME });
  const page = await b.newPage({ viewport: { width: 1080, height: 1920 }, deviceScaleFactor: 1 });

  for (const L of LINES) {
    let uri = '';
    if (L.shot) {
      const f = path.join(HERE, 'shots', L.shot);
      if (!fs.existsSync(f)) { console.log(`  ${L.n}  missing ${L.shot} — text only`); L.shot = null; }
      else uri = 'data:image/png;base64,' + fs.readFileSync(f).toString('base64');
    }
    await page.setContent(plate(L, uri), { waitUntil: 'load' });
    await page.waitForTimeout(120);
    const out = path.join(OUT, String(L.n).padStart(2, '0') + '.png');
    await page.screenshot({ path: out });
    console.log(`  ${String(L.n).padStart(2, '0')}  ${L.cap.split('\n')[0]}`);
  }
  await b.close();
  console.log(`\n${LINES.length} plates in plates/\n`);
})().catch(e => { console.error(e); process.exit(1); });
