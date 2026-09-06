// The S.E.A. practice app, at /sea/.
//
// The mock paper is the part that has to be right. A student who sits it is
// spending seventy-five minutes on the strength of a claim — that this is the
// shape of the real Mathematics paper. The Assessment Framework fixes that
// shape: 40 items, 75 marks, sections of 20/16/4 items worth 20/39/16 marks,
// and 19/6/9/6 items across Number, Geometry, Measurement and Statistics.
// The generator shuffles and swaps to hit those numbers, so it is checked here
// on real papers rather than on the blueprint it was written from.
//
// The rest is the promise the page makes to a child working alone: a paper
// answered correctly scores full marks, a blank one scores nothing and hands
// back every worked explanation, and nothing typed is lost on reload.
//
// Run: node tests/e2e-sea.js   (needs playwright + a chromium on disk)
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const TYPES = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css',
                '.json':'application/json', '.png':'image/png', '.svg':'image/svg+xml' };
const PORT = 8797;

const server = http.createServer((req, res) => {
  let f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('no'); }
  res.writeHead(200, { 'Content-Type': TYPES[path.extname(f)] || 'application/octet-stream' });
  fs.createReadStream(f).pipe(res);
});

let fails = 0;
const ok = (what, cond, extra) => {
  console.log((cond ? '  ok   ' : '  FAIL ') + what + (extra && !cond ? '  — ' + extra : ''));
  if (!cond) fails++;
};

(async () => {
  server.listen(PORT);
  const b = await chromium.launch({ executablePath: CHROME });
  const page = await b.newPage({ viewport: { width: 1180, height: 900 } });

  const errs = [];
  page.on('pageerror', e => errs.push('page error: ' + e.message));
  page.on('console', m => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
  page.on('response', r => { if (r.status() >= 400) errs.push(r.status() + ' ' + r.url()); });

  const URL = `http://localhost:${PORT}/sea/`;
  await page.goto(URL, { waitUntil: 'networkidle' });

  // ---- every section opens -------------------------------------------------
  for (const v of ['practice', 'exam', 'writing', 'papers', 'syllabus', 'home']) {
    await page.click(`#nav button[data-view="${v}"]`);
    ok(`the ${v} section opens`, await page.isVisible(`#v-${v}`));
  }

  // ---- the mock paper keeps the Ministry's shape, three papers running ------
  page.on('dialog', d => d.accept());
  const shapes = [];
  for (let run = 0; run < 3; run++) {
    await page.click('#nav button[data-view="exam"]');
    if (await page.isVisible('#examAgain')) await page.click('#examAgain');
    await page.check('#examUntimed');
    await page.click('#examStart');
    await page.waitForSelector('#examHost .examq');
    shapes.push(await page.evaluate(() => {
      const by = {}, sec = { 1:0, 2:0, 3:0 }, secMarks = { 1:0, 2:0, 3:0 };
      let marks = 0;
      for (const q of exam.items) {
        by[q.strand] = (by[q.strand] || 0) + 1;
        sec[q.sec]++; secMarks[q.sec] += q.marks; marks += q.marks;
      }
      return { n: exam.items.length, marks, by, sec, secMarks,
               onPage: document.querySelectorAll('#examHost .examq').length,
               ids: exam.items.map(q => q.id) };
    }));
    if (run < 2) await page.click('#examSubmit');
  }
  const shaped = s =>
    s.n === 40 && s.onPage === 40 && s.marks === 75 &&
    s.sec[1] === 20 && s.sec[2] === 16 && s.sec[3] === 4 &&
    s.secMarks[1] === 20 && s.secMarks[2] === 39 && s.secMarks[3] === 16 &&
    s.by.Number === 19 && s.by.Geometry === 6 && s.by.Measurement === 9 && s.by.Statistics === 6;
  ok('three generated papers each hold 40 items and 75 marks in the right split',
     shapes.every(shaped),
     shapes.map(s => `${s.n}i/${s.marks}m ${s.sec[1]}-${s.sec[2]}-${s.sec[3]} ` +
                     `(${s.secMarks[1]}-${s.secMarks[2]}-${s.secMarks[3]})`).join(' | '));
  ok('no paper repeats a question', shapes.every(s => new Set(s.ids).size === s.ids.length));
  ok('two papers are not the same paper', shapes[0].ids.join() !== shapes[1].ids.join());

  // ---- a correct paper scores full marks -----------------------------------
  await page.evaluate(() => exam.items.forEach((q, i) => {
    const el = document.getElementById('ea' + (i + 1));
    el.value = q.a[0]; el.dispatchEvent(new Event('input', { bubbles: true }));
  }));
  ok('the progress counter follows the answers', (await page.textContent('#examProg')) === '40 / 40');
  await page.click('#examSubmit');
  await page.waitForSelector('#examResult h1');
  ok('a paper answered from the bank scores 75 out of 75',
     (await page.textContent('#examResult h1')).trim() === '75 out of 75');

  // ---- a blank paper scores nothing and explains all forty ------------------
  await page.click('#examAgain');
  await page.click('#examStart');
  await page.waitForSelector('#examHost .examq');
  await page.click('#examSubmit');
  await page.waitForSelector('#examResult h1');
  ok('a blank paper scores 0 out of 75',
     (await page.textContent('#examResult h1')).trim() === '0 out of 75');
  ok('every missed question comes back with its worked explanation',
     (await page.$$eval('#examResult .verdict.no .exp', n => n.length)) === 40);

  // ---- practice marks, and remembers ---------------------------------------
  await page.click('#nav button[data-view="practice"]');
  await page.fill('#pAns', 'definitely not the answer');
  await page.click('#pCheck');
  ok('a wrong answer in practice is marked wrong', await page.isVisible('#pVerdict .verdict.no'));
  await page.click('#pShow');
  ok('“Show me” gives the answer and the working',
     /Answer:/.test(await page.textContent('#pVerdict')) &&
     (await page.$('#pVerdict .exp')) !== null);
  await page.click('#pStrand .chip[data-s="Geometry"]');
  ok('the strand filter narrows the set',
     /of \d+ in this set/.test(await page.textContent('#pCount')) &&
     await page.$$eval('#pStrand .chip[aria-pressed="true"]', n => n.length) === 1);

  // ---- the essay is not lost -----------------------------------------------
  await page.click('#nav button[data-view="writing"]');
  await page.fill('#wEssay', 'The lights went out just as the music started.');
  ok('the word count is live', (await page.textContent('#wWords')) === '9');
  await page.click('#wType .chip[data-k="expository"]');
  ok('an expository set offers three prompts',
     (await page.$$eval('#wPrompts .prompt', n => n.length)) === 3);
  await page.reload({ waitUntil: 'networkidle' });
  ok('the essay survives a reload',
     (await page.inputValue('#wEssay')) === 'The lights went out just as the music started.');

  // ---- the papers are linked, never re-hosted ------------------------------
  await page.click('#nav button[data-view="papers"]');
  const links = await page.$$eval('#paperList a.dl', a => a.map(x => x.href));
  ok(`${links.length} past papers are listed`, links.length === 23);
  ok('every past paper link leaves for the Ministry',
     links.every(u => /moe\.gov\.tt|wpuploadstorageaccount\.blob\.core\.windows\.net/.test(u)),
     links.filter(u => !/moe\.gov\.tt|wpuploadstorageaccount/.test(u)).join(' '));

  // ---- a phone has to be able to use it ------------------------------------
  await page.setViewportSize({ width: 390, height: 844 });
  await page.click('#nav button[data-view="home"]');
  const spill = await page.evaluate(() =>
    document.documentElement.scrollWidth - document.documentElement.clientWidth);
  ok('nothing spills sideways at 390px', spill <= 1, spill + 'px');

  ok('no errors in the console', errs.length === 0, errs.join(' | '));

  await b.close();
  server.close();
  console.log();
  console.log(fails ? `  ${fails} failed` : '  all good');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
