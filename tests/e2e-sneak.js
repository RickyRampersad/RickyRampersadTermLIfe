// The sneak-peek film, at /sneak/.
//
// Same shape as e2e-update.js and for the same reasons: the page must not
// quietly lose its film, and the chapter marks must stay where the audio says
// they are. One thing is added here. This film was cut from a stub built the
// same afternoon the real book was read, and the real book is full of client
// names. None of them may be in a frame, a caption or the capture script — the
// repository is public and the film goes out on WhatsApp.
//
// Run: node tests/e2e-sneak.js   (needs playwright + a chromium on disk)
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');

const ROOT = path.join(__dirname, '..');
const CHROME = process.env.CHROME_PATH || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome';
const TYPES = { '.html':'text/html', '.js':'application/javascript', '.css':'text/css',
                '.json':'application/json', '.mp4':'video/mp4', '.png':'image/png' };
const PORT = 8795;
const FILM = 'kpi/film/sneak';

// Byte ranges, as in e2e-update.js — a browser will not read an MP4's
// duration from a server that cannot serve one.
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

  await page.goto(`http://localhost:${PORT}/sneak/`, { waitUntil: 'networkidle' });
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
  const marks = JSON.parse(fs.readFileSync(path.join(ROOT, FILM, 'chapters.json'), 'utf8'));
  const lines = JSON.parse(fs.readFileSync(path.join(ROOT, FILM, 'lines.json'), 'utf8'));
  ok('one mark per line', marks.length === lines.length,
     marks.length + ' marks vs ' + lines.length + ' lines');
  ok('they run forwards', marks.every((m, i) => i === 0 || m.start > marks[i - 1].start));

  // Duration with ffmpeg, never from the video element: this chromium has no
  // H.264 decoder and reports zero for a film every phone plays.
  const film = path.join(ROOT, FILM, 'sneak-peek.mp4');
  const out = require('child_process')
    .spawnSync('ffmpeg', ['-hide_banner', '-i', film], { encoding: 'utf8' }).stderr || '';
  const mm = /Duration: 00:0(\d):([0-9.]+)/.exec(out);
  const dur = mm ? Number(mm[1]) * 60 + Number(mm[2]) : 0;
  ok('the film has a length', dur > 60, dur + 's');
  ok('the last mark falls inside it', dur > 0 && marks[marks.length - 1].start < dur,
     'last mark ' + marks[marks.length - 1].start + 's, film ' + dur + 's');
  ok('and the film runs as long as the narration does',
     Math.abs(dur - (marks[marks.length - 1].start + 2.5)) < 6,
     'film ' + dur + 's, last mark ' + marks[marks.length - 1].start + 's');

  console.log('\nA mark seeks:\n');
  const keep = [1, 2, 6, 9, 11, 14, 17];
  const target = marks.filter(m => keep.includes(m.n))[2].start;
  await page.locator('.ch').nth(2).click();
  await page.waitForTimeout(400);
  const at = await page.evaluate(() => document.querySelector('video').currentTime);
  ok('clicking one moves the film to that mark', Math.abs(at - target) < 0.6,
     'wanted ' + target + 's, got ' + at + 's');

  console.log('\nNobody real is named in a frame, a caption or the script:\n');
  const text = fs.readFileSync(path.join(ROOT, 'sneak/index.html'), 'utf8') +
               fs.readFileSync(path.join(ROOT, FILM, 'lines.json'), 'utf8') +
               fs.readFileSync(path.join(ROOT, FILM, 'capture.js'), 'utf8');
  ok('the film uses a demo account', !/sasha|kamla|elizabeth|azariah|pawan|kerwyn|akaash|gary\b/i.test(text));
  // The stub was written the same afternoon the live book was read. These are
  // surnames that were on screen that day; none of them belongs in a public
  // repository or a WhatsApp group.
  ok('and no client or agent from the live book',
     !/ramlakhan|kissoonchan|afoon|balroop|jagmohan|talleh|rondon|simmons\b|mason\b/i.test(text));

  await b.close(); server.close();
  console.log('\n' + (fails ? fails + ' FAILED' : 'all green') + '\n');
  process.exit(fails ? 1 : 0);
})().catch(e => { console.error(e); process.exit(1); });
