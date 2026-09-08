// The "what changed" film, at /update/.
//
// The film is the thing being sent to nine people on WhatsApp, and the page is
// where anyone who loses the message goes to watch it again. Two ways it could
// be quietly broken: the video source 404s (the film is committed, but a moved
// folder would not show on screen), or the chapter marks drift away from the
// audio they were read off.
//
// Run: node tests/e2e-update.js   (needs playwright + a chromium on disk)
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const TYPES = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css',
                '.json':'application/json', '.mp4':'video/mp4', '.png':'image/png' };
const PORT = 8796;

// Range requests matter here: a browser will not read an MP4's duration from
// a server that cannot serve a byte range, so without this the film looks like
// it has no metadata and the test fails for a reason the real host does not
// have. GitHub Pages serves ranges; so does this.
const server = http.createServer((req, res) => {
  let f = path.join(ROOT, decodeURIComponent(req.url.split('?')[0]));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { res.writeHead(404); return res.end('no'); }
  const type = TYPES[path.extname(f)] || 'application/octet-stream';
  const size = fs.statSync(f).size;
  const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
  if (m) {
    const start = m[1] ? parseInt(m[1], 10) : 0;
    const end   = m[2] ? parseInt(m[2], 10) : size - 1;
    res.writeHead(206, { 'Content-Type': type, 'Accept-Ranges': 'bytes',
      'Content-Range': `bytes ${start}-${end}/${size}`, 'Content-Length': end - start + 1 });
    return fs.createReadStream(f, { start, end }).pipe(res);
  }
  res.writeHead(200, { 'Content-Type': type, 'Accept-Ranges': 'bytes', 'Content-Length': size });
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
  page.on('response', r => { if (r.status() >= 400) bad.push(r.status() + ' ' + r.url()); });

  await page.goto(`http://localhost:${PORT}/update/`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(600);

  console.log('\nThe page:\n');
  ok('nothing on it 404s', bad.length === 0, bad.join(', '));
  ok('the film is there', await page.locator('video').count() === 1);

  const src = await page.locator('video').getAttribute('src');
  const head = await fetch(`http://localhost:${PORT}${src}`, { method: 'GET' });
  ok('the film itself loads', head.status === 200, 'got ' + head.status);

  const chapters = await page.locator('.ch').count();
  ok('chapter marks rendered', chapters > 0, chapters + ' found');

  console.log('\nThe marks match the film:\n');
  const marks = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'kpi/film/update/chapters.json'), 'utf8'));
  const lines = JSON.parse(fs.readFileSync(
    path.join(ROOT, 'kpi/film/update/lines.json'), 'utf8'));
  ok('one mark per line', marks.length === lines.length,
     marks.length + ' marks vs ' + lines.length + ' lines');
  ok('they run forwards', marks.every((m, i) => i === 0 || m.start > marks[i - 1].start));

  // The film's own length is read with ffmpeg, not from the video element.
  // The chromium on this box is built without H.264, so it cannot decode an
  // MP4 and reports a duration of zero — while every phone, every browser and
  // WhatsApp itself play it. H.264 is the right codec for where this is going;
  // do not swap it to satisfy a test runner that cannot watch films.
  const film = path.join(ROOT, 'kpi/film/update/whats-changed.mp4');
  const out = require('child_process')
    .spawnSync('ffmpeg', ['-hide_banner', '-i', film], { encoding: 'utf8' }).stderr || '';
  const mm = /Duration: 00:0(\d):([0-9.]+)/.exec(out);
  const dur = mm ? Number(mm[1]) * 60 + Number(mm[2]) : 0;
  ok('the film has a length', dur > 30, dur + 's');
  ok('the last mark falls inside it', dur > 0 && marks[marks.length - 1].start < dur,
     'last mark ' + marks[marks.length - 1].start + 's, film ' + dur + 's');
  ok('and the film runs as long as the narration does',
     Math.abs(dur - (marks[marks.length - 1].start + 2.5)) < 6,
     'film ' + dur + 's, last mark ' + marks[marks.length - 1].start + 's');

  console.log('\nA mark seeks:\n');
  // Wiring only — with no decoder there is nothing to play, but the handler
  // still has to put the film where the mark says.
  const target = marks.filter(m => [1, 2, 4, 6, 9, 10, 14].includes(m.n))[2].start;
  await page.locator('.ch').nth(2).click();
  await page.waitForTimeout(400);
  const at = await page.evaluate(() => document.querySelector('video').currentTime);
  ok('clicking one moves the film to that mark', Math.abs(at - target) < 0.6,
     'wanted ' + target + 's, got ' + at + 's');

  console.log('\nNo colleague is named in a frame or on the page:\n');
  const html = fs.readFileSync(path.join(ROOT, 'update/index.html'), 'utf8') +
               fs.readFileSync(path.join(ROOT, 'kpi/film/update/lines.json'), 'utf8') +
               fs.readFileSync(path.join(ROOT, 'kpi/film/update/capture.js'), 'utf8');
  ok('the film uses a demo account', !/sasha|kamla|elizabeth|azariah|pawan/i.test(html));

  await b.close(); server.close();
  console.log('\n' + (fails ? fails + ' FAILED' : 'all green') + '\n');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
