// The operating manual, at /kpi/manual/ and its short link /howwework.
//
// Three things this guards. The two film pages pointed at /manual/ for a week,
// which is the fact-find manual — a staff member who followed the link got
// advice about approval letters. The manual is written by role and the
// repository is public, so no colleague's name and no client's name may be
// in it. And every role the branch has must actually be covered, or the
// person who is not will assume the model is not for them.
//
// Run: node tests/e2e-manual.js   (needs playwright + a chromium on disk)
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const TYPES = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css',
                '.json':'application/json', '.png':'image/png', '.svg':'image/svg+xml' };
const PORT = 8794;

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
  const page = await b.newPage({ viewport: { width: 420, height: 900 } });
  const bad = [];
  page.on('response', r => {
    const u = r.url();
    if (r.status() >= 400 && !/fonts\.g(oogleapis|static)\.com/.test(u)) bad.push(r.status() + ' ' + u);
  });

  console.log('\nThe short link:\n');
  await page.goto(`http://localhost:${PORT}/howwework/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(500);
  ok('/howwework lands on the tracker manual', /\/kpi\/manual\/?$/.test(page.url()), page.url());

  console.log('\nThe manual:\n');
  const text = await page.locator('body').innerText();
  ok('nothing on it 404s (fonts aside)', bad.length === 0, bad.join(', '));
  ok('it carries the branch mark', await page.locator('.mark img[src="/logo-mark.png"]').count() === 1);
  ok('it opens on the model in one line', /Plan the day before it starts\. Work what needs you\. Say whether it landed\./.test(text));

  // The role headings are uppercased by CSS, so innerText comes back in
  // capitals; compare the heading elements themselves, case-folded, rather
  // than searching the body — "Branch Manager" alone would pass on the body
  // text of five other sections.
  const who = (await page.locator('.who').allInnerTexts()).map(t => t.trim().toUpperCase());
  ['Sales Support Assistant', 'Personal Assistant to the Branch Manager',
   "Branch Manager's Assistant", 'Unit Manager', 'Assistant Branch Manager', 'Branch Manager']
    .forEach(role => ok('a section for: ' + role, who.includes(role.toUpperCase()), who.join(' | ')));
  ok('and exactly six roles, no more', who.length === 6, String(who.length));

  ok('it explains "need you"', /untouched|touched in seven days|seven days/i.test(text));
  ok('it states the standard', /How many, or which one/.test(text));
  ok('it says what the system does itself', /Reads your open book from Salesforce/.test(text));
  ok('it is honest that the branch view is one person’s', /That reach is yours alone/.test(text));

  console.log('\nNo person is named — colleague or client:\n');
  const html = fs.readFileSync(path.join(ROOT, 'kpi/manual/index.html'), 'utf8');
  ok('no colleague', !/sasha|kamla|elizabeth|azariah|pawan|kerwyn|akaash|\bgary\b|rondon/i.test(html));
  ok('no client or agent from the live book',
     !/ramlakhan|kissoonchan|afoon|balroop|jagmohan|talleh|simmons\b|mason\b|xtra foods/i.test(html));

  console.log('\nThe film pages point here, not at the fact-find manual:\n');
  for (const p of ['update', 'sneak']) {
    const h = fs.readFileSync(path.join(ROOT, p, 'index.html'), 'utf8');
    ok('/' + p + ' links /howwework', /href="\/howwework\/"/.test(h));
    ok('/' + p + ' no longer links /manual/', !/href="\/manual\/"/.test(h));
  }

  await b.close(); server.close();
  console.log('\n' + (fails ? fails + ' FAILED' : 'all green') + '\n');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
