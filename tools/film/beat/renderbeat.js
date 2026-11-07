/* Render one film in one shape, frame by frame, straight into an MP4.
   Every frame is a pure function of t, so there is no capture drift to undo.

     node render2.js <film-key> <v|f|w> [fps]

   The frames are piped to ffmpeg rather than written to disk: nine renders of
   1,500 frames each is about 3 GB of JPEGs, and this session's writable disk is
   a fixed allowance.                                                          */
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const { spawn } = require('child_process');

const HERE = __dirname;
const FILM = process.argv[2] || 'bwadmin';
const SHAPE = process.argv[3] || 'w';
const FPS = +(process.argv[4] || 30);
const SZ = { v: { width: 1080, height: 1920 },
             f: { width: 1080, height: 1350 },
             w: { width: 1920, height: 1080 } }[SHAPE];
const OUT = path.join(HERE, `bsilent-${FILM}-${SHAPE}.mp4`);
const T = { '.html':'text/html', '.svg':'image/svg+xml', '.js':'text/javascript',
            '.jpg':'image/jpeg', '.png':'image/png', '.b64':'text/plain' };

(async () => {
  const srv = http.createServer((rq, rs) => {
    const f = path.join(HERE, decodeURIComponent(rq.url.split('?')[0]));
    if (!f.startsWith(HERE) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) { rs.writeHead(404); return rs.end(); }
    rs.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream' });
    rs.end(fs.readFileSync(f));
  }).listen(0);

  const br = await chromium.launch({ args: ['--no-sandbox', '--force-device-scale-factor=1'] });
  const pg = await br.newPage({ viewport: SZ, deviceScaleFactor: 1 });
  const errs = [];
  pg.on('pageerror', e => errs.push(String(e)));
  /* the film's own config has to be in place before the engine's IIFE runs */
  await pg.route('**/beat.js', async r => {
    const cfg = fs.readFileSync(path.join(HERE, 'bt-' + FILM + '.js'), 'utf8');
    const eng = fs.readFileSync(path.join(HERE, 'beat.js'), 'utf8');
    await r.fulfill({ status: 200, contentType: 'text/javascript', body: cfg + '\n' + eng });
  });
  await pg.goto(`http://localhost:${srv.address().port}/beat.html?film=${FILM}&shape=${SHAPE}`,
                { waitUntil: 'domcontentloaded' });
  await pg.waitForFunction(() => window.FILM_READY === true, null, { timeout: 60000 });

  const dur = await pg.evaluate(() => window.FILM_DUR);
  const fits = await pg.evaluate(() => (window.FILM_FIT ? window.FILM_FIT() : []));
  const n = Math.round(dur * FPS);
  console.log(`${FILM} ${SHAPE}: ${SZ.width}x${SZ.height}  ${dur.toFixed(2)}s  ${n} frames @ ${FPS}fps`);
  const shrunk = fits.map((f, i) => [i + 1, f]).filter(([, f]) => f < 1);
  if (shrunk.length) console.log('  scenes shrunk to fit: ' +
    shrunk.map(([i, f]) => `${i} → ${Math.round(f * 100)}%`).join(', '));
  if (fits.some(f => f < 0.62)) console.log('  WARNING: a scene is under 62% — the line is too long for this frame');

  const ff = spawn('ffmpeg', ['-y', '-hide_banner', '-loglevel', 'error',
    '-f', 'image2pipe', '-framerate', String(FPS), '-i', 'pipe:0',
    /* CRF 22, not 19. The moving ground is a blurred gradient under a pulsing
       dot grid, which is the most expensive thing an encoder can be given: at
       19 the upright cut came out at 25 MB, over the 20 MiB an artifact asset
       takes and far more than nine of these should add to the repository. At
       22 the same frames are about 15 MB and nothing is visible at the ~400px
       a feed actually plays them at. */
    '-c:v', 'libx264', '-preset', 'medium', '-crf', '22',
    '-pix_fmt', 'yuv420p', OUT]);
  ff.stderr.on('data', d => process.stderr.write(d));
  const done = new Promise((res, rej) => {
    ff.on('close', c => c === 0 ? res() : rej(new Error('ffmpeg exit ' + c)));
  });

  for (let i = 0; i < n; i++) {
    await pg.evaluate(t => window.SEEK(t), i / FPS);
    const buf = await pg.screenshot({ type: 'jpeg', quality: 92 });
    if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
    if (i % 150 === 0) process.stdout.write(`  ${i}/${n}\r`);
  }
  ff.stdin.end();
  await done;
  console.log(`  ${n}/${n} -> ${path.basename(OUT)}`);
  if (errs.length) console.log('  PAGE ERRORS:', errs.slice(0, 3));
  await br.close(); srv.close();
})();
