// Plates for the "what changed" film.
//
// Every screen here is the real tracker, driven by a real browser. The person
// signed in is a demo account, not a member of staff — the film goes out on
// WhatsApp and the repository is public, so no colleague's name is baked into
// a frame.
//
//   node kpi/film/update/capture.js
//
// Writes shots/*.png at phone size. compose.js turns them into 1080x1920.
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const ROOT  = path.join(__dirname, '..', '..', '..');
const OUT   = path.join(__dirname, 'shots');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const PORT  = 8801;
const TYPES = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css',
                '.png':'image/png', '.jpg':'image/jpeg', '.mp3':'audio/mpeg', '.mp4':'video/mp4' };

const server = http.createServer((req, res) => {
  let f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('no'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

const P = { staffId:'demo', name:'Demo Account', email:'demo@example.com', agentNumber:'D0',
            unit:'Support', grade:'Sales Support Assistant · G3', role:'ssa',
            tier:'support', tierLabel:'Sales Support', tierOrder:4, reportsTo:'demo', manager:false };
const SCH = { demo: { start:'08:00', end:'16:00', lunch:'12:30-13:30',
  blocks: { KPI1:{time:'8 – 10am', focus:'Premium Dues / Surveys'},
            KPI2:{time:'10 – 12pm', focus:'Ind. Health Billing Recon'},
            PM1: {time:'1 – 3pm',   focus:'Adopt an Orphan'},
            PM2: {time:'3 – 4pm',   focus:'Task Mgmt / Branch Meeting Reports'} } } };

const shot = async (page, name) => {
  fs.mkdirSync(OUT, { recursive: true });
  await page.screenshot({ path: path.join(OUT, name + '.png') });
  console.log('  ' + name);
};

// A plate wants the thing being talked about, not the whole page. Scroll the
// element in, then clip a little air around it.
const shotOf = async (page, name, sel, pad = 14) => {
  fs.mkdirSync(OUT, { recursive: true });
  const el = page.locator(sel).first();
  await el.scrollIntoViewIfNeeded();
  await page.waitForTimeout(350);
  const b = await el.boundingBox();
  if (!b) { console.log('  ' + name + '  (no box — full page)'); return shot(page, name); }
  const vp = page.viewportSize();
  const clip = { x: Math.max(0, b.x - pad), y: Math.max(0, b.y - pad),
                 width:  Math.min(vp.width,  b.width  + pad * 2),
                 height: Math.min(vp.height, b.height + pad * 2) };
  clip.width  = Math.min(clip.width,  vp.width  - clip.x);
  clip.height = Math.min(clip.height, vp.height - clip.y);
  await page.screenshot({ path: path.join(OUT, name + '.png'), clip });
  console.log('  ' + name);
};

// Two fields read as a pair — what was done, and what came of it. Clip both.
const shotSpan = async (page, name, sel, a, b, pad = 34) => {
  fs.mkdirSync(OUT, { recursive: true });
  const all = page.locator(sel);
  await all.nth(b).scrollIntoViewIfNeeded();
  await page.waitForTimeout(350);
  const top = await all.nth(a).boundingBox(), bot = await all.nth(b).boundingBox();
  if (!top || !bot) return shotOf(page, name, sel, pad);
  const vp = page.viewportSize();
  const y = Math.max(0, top.y - pad * 1.4);
  const clip = { x: Math.max(0, top.x - pad), y,
                 width:  Math.min(vp.width  - Math.max(0, top.x - pad), top.width + pad * 2),
                 height: Math.min(vp.height - y, (bot.y + bot.height + pad) - y) };
  await page.screenshot({ path: path.join(OUT, name + '.png'), clip });
  console.log('  ' + name);
};

(async () => {
  server.listen(PORT);
  const b = await chromium.launch({ executablePath: CHROME });
  const ctx = await b.newContext({ viewport:{ width:390, height:844 }, deviceScaleFactor:3,
                                   isMobile:true, hasTouch:true });
  const page = await ctx.newPage();

  let stall = 0, sent = 0;
  await page.route('**/macros/s/**', async r => {
    const body = JSON.parse(r.request().postData() || '{}');
    const j = o => r.fulfill({ status:200, contentType:'application/json', body:JSON.stringify(o) });
    if (stall > 0 && body.action === 'login') {   // make the retry banner visible
      stall--; return r.fulfill({ status:404, contentType:'text/html', body:'<html>404</html>' });
    }
    if (body.action==='login' || body.action==='me')
      return j({ ok:true, token:'t', profile:P, roster:[P], schedule:SCH, kpis:{} });
    if (body.action==='rows')     return j({ ok:true, rows:[] });
    if (body.action==='training') return j({ ok:true, training:[] });
    if (body.action==='saveBlock') { sent++;
      return j({ ok:true, block:body.block, at:'15:25', blocksDone:1, submitted:[body.block] }); }
    return j({ ok:true });
  });

  console.log('Plates');
  await page.goto(`http://localhost:${PORT}/kpi/`, { waitUntil:'networkidle' });
  await page.waitForTimeout(600);
  await shot(page, 'signin');

  // The retry banner: refuse the first two logins so the counter shows.
  stall = 2;
  let inputs = await page.$$('input');
  await inputs[0].fill('demo@example.com'); await inputs[1].fill('1');
  await page.click('button:has-text("Sign in")');
  await page.waitForTimeout(1200);
  await shotOf(page, 'retry', 'button:has-text("trying"), button:has-text("Sign in")', 26);
  await page.waitForTimeout(6000);

  // Signed in — the day.
  await page.waitForTimeout(800);
  await shot(page, 'day');

  // A thin entry, questioned once.
  await page.locator('text=Afternoon 2').first().click();
  await page.waitForTimeout(500);
  let t = await page.locator('textarea:visible').all();
  await t[0].fill('Actioned remaining tasks');
  await t[1].fill('3 tasks');
  await page.waitForTimeout(400);
  await shotSpan(page, 'typed', 'textarea:visible', 0, 1);
  await page.click('button:has-text("Submit block")');
  await page.waitForTimeout(1000);
  await shotOf(page, 'askonce', 'text=/reads thin/', 22);
  await shotOf(page, 'anyway', 'button:has-text("Send it anyway")', 26);

  // A real entry in a fresh block, never questioned.
  await page.locator('text=KPI 2').first().click();
  await page.waitForTimeout(600);
  t = await page.locator('textarea:visible').all();
  await t[0].fill('Premium dues — 14 processed, 2 returned to the advisor for a missing signature');
  await t[1].fill('12 cleared, 2 back with the advisor');
  await page.waitForTimeout(400);
  await shotSpan(page, 'good', 'textarea:visible', 0, 1);
  await page.click('button:has-text("Submit block")');
  await page.waitForTimeout(2600);
  await shotOf(page, 'sent', 'text=/Sent 15:25/', 30);

  // The draft: type, then close the page and come back.
  await page.locator('text=KPI 1').first().click();
  await page.waitForTimeout(500);
  t = await page.locator('textarea:visible').all();
  await t[0].fill('Surveys — called 9 clients, 6 reached, 3 to try again after 4pm');
  await page.waitForTimeout(1200);
  await page.reload({ waitUntil:'networkidle' });
  await page.waitForTimeout(2500);
  const k1 = page.locator('text=KPI 1').first();
  if (await k1.count()) { await k1.click(); await page.waitForTimeout(700); }
  await shotOf(page, 'draft', 'textarea:visible', 40);

  await b.close(); server.close();
  console.log('\nshots/ written\n');
})().catch(e => { console.error(e); process.exit(1); });
