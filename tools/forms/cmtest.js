/* The underwriter's file: does it tick, does it fit a phone, does it keep its
   answers to itself, and does what the Branch Manager receives say what the
   candidate actually did with it? */
const { chromium } = require('playwright');
const http = require('http'), fs = require('fs'), path = require('path');
const ROOT = '/home/user/RickyRampersadTermLIfe';
const T = { '.html': 'text/html', '.css': 'text/css', '.js': 'text/javascript', '.jpg': 'image/jpeg',
            '.png': 'image/png', '.svg': 'image/svg+xml', '.mp4': 'video/mp4', '.webmanifest': 'application/json' };
let pass = 0, fail = 0;
const ok = (c, m) => { c ? pass++ : (fail++, console.log('  FAIL ' + m)); };

(async () => {
const srv = http.createServer((rq, rs) => {
  let f = path.join(ROOT, decodeURIComponent(rq.url.split('?')[0]));
  if (fs.existsSync(f) && fs.statSync(f).isDirectory()) f = path.join(f, 'index.html');
  if (!fs.existsSync(f)) { rs.writeHead(404); return rs.end(); }
  rs.writeHead(200, { 'Content-Type': T[path.extname(f)] || 'application/octet-stream' });
  rs.end(fs.readFileSync(f));
}).listen(0);
const port = srv.address().port;
const br = await chromium.launch({ args: ['--no-sandbox'] });

for (const vp of [{ width: 1366, height: 900, n: 'laptop' }, { width: 390, height: 844, n: 'phone' }]) {
  const pg = await br.newPage({ viewport: vp });
  const errs = []; pg.on('pageerror', e => errs.push(String(e)));
  await pg.goto(`http://localhost:${port}/clientmanager/`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('#fileg:not([hidden])', { timeout: 10000 });
  ok(errs.length === 0, vp.n + ' no page errors: ' + errs[0]);

  const f = await pg.$$('#file .fnd');
  ok(f.length === 9, vp.n + ' nine findings, got ' + f.length);

  // the page must never print which ones matter, or it is a quiz with the
  // answers at the bottom
  // the page may SAY there is no score (it does); what it must never do is
  // show which findings we think matter — that is the answer sheet
  const shown = await pg.$eval('#file', e => e.innerText);
  ok(!/\b(you (got|missed)|\d+ of 9|correct|incorrect)\b/i.test(shown), vp.n + ' no verdict on the page');

  await f[2].click(); await f[0].click(); await f[5].click();
  ok(await pg.$eval('#fileCount', e => /3 things, in that order/.test(e.innerText)), vp.n + ' counts what was ticked');
  ok(await pg.$eval('#file .fnd[data-f=claims] .fno', e => e.getAttribute('data-n') === '1'), vp.n + ' first tick is numbered 1');
  ok(await pg.$eval('#file .fnd[data-f=sums] .fno', e => e.getAttribute('data-n') === '2'), vp.n + ' second tick is numbered 2');

  await f[0].click();  // untick
  ok(await pg.$eval('#fileCount', e => /2 things/.test(e.innerText)), vp.n + ' unticking works');
  ok(await pg.$eval('#file .fnd[data-f=paid] .fno', e => e.getAttribute('data-n') === '2'), vp.n + ' the order closes up after an untick');
  await f[0].click();

  await pg.fill('#fAsk', 'A current valuation, the open claim file, and the machinery schedule with serials.');
  await pg.click('#fPrem input[value="Refer it"]');

  const got = await pg.evaluate(() => window.__rrbFile());
  ok(got.n === 3, vp.n + ' three ticks reach the payload, got ' + got.n);
  ok(/^1\. Two claims/.test(got.picked), vp.n + ' the order is preserved: ' + got.picked.split('\n')[0]);
  ok(/valuation/.test(got.ask), vp.n + ' what they would ask travels');
  ok(got.prem === 'Refer it', vp.n + ' the premium decision travels');
  ok(/machinery item with no end date/.test(got.missed), vp.n + ' what they walked past is recorded');
  ok(!/Sums insured unchanged/.test(got.missed), vp.n + ' a ticked finding is not also "missed"');

  // the marks survive a reload, like the administrator's form
  await pg.reload({ waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('#fileg:not([hidden])');
  const after = await pg.evaluate(() => window.__rrbFile());
  ok(after.n === 3 && after.prem === 'Refer it' && /valuation/.test(after.ask), vp.n + ' the file survives a reload');

  // nothing may push the page sideways
  const over = await pg.evaluate(() => { const b = document.body; window.scrollTo(100, 0); const x = window.scrollX; window.scrollTo(0, 0); return x; });
  ok(over === 0, vp.n + ' no sideways scroll, scrollX ' + over);

  // the qualification is asked for, and it is required
  ok(await pg.$('input[name=uw_qstatus][required]'), vp.n + ' the qualification status is required');
  const lines = await pg.$$eval('#lines .lineg li b', e => e.map(x => x.textContent));
  ok(lines.length === 10 && lines.includes('Workers compensation'), vp.n + ' the classes are named, got ' + lines.length);

  await pg.close();
}

// what the Branch Manager actually receives
{
  const pg = await br.newPage({ viewport: { width: 1366, height: 900 } });
  let body = null;
  await pg.route('**/exec*', async r => {
    body = JSON.parse(r.request().postData() || '{}');
    await r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ ok: true, ref: 'QU-261107-001' }) });
  });
  await pg.goto(`http://localhost:${port}/clientmanager/`, { waitUntil: 'domcontentloaded' });
  await pg.waitForSelector('#fileg:not([hidden])');
  const fs2 = await pg.$$('#file .fnd');
  await fs2[0].click(); await fs2[1].click();
  await pg.fill('#fAsk', 'A valuation no older than two years.');
  await pg.click('#fPrem input[value="Load it"]');

  const put = async (sel, v) => { const e = await pg.$(sel); if (!e) return;
    const tag = await e.evaluate(x => x.tagName);
    const type = await e.evaluate(x => x.type || '');
    if (tag === 'SELECT') await e.selectOption({ index: 1 });
    else if (type === 'radio' || type === 'checkbox') await e.check();
    else await e.fill(v || ''); };
  await put('#uName', 'A Candidate'); await put('#uPhone', '868 555 0100');
  await put('#uMail', 'candidate@example.com'); await put('#uTown', 'Couva');
  await put('input[name=uw_years][value="6 to 10 years"]');
  await put('input[name=cls][value="Commercial property and fire"]');
  await put('input[name=cls][value="Engineering and machinery"]');
  await put('input[name=uw_auth][value="A limit I could bind within"]');
  await put('#uSys', 'Premia, and a lot of spreadsheets');
  await put('input[name=uw_qstatus][value="Diploma"]');
  await put('#uQual', 'CII Diploma, M93 outstanding');
  await put('#uCo', 'A general insurer'); await put('#uRole', 'Senior underwriter');
  await put('#uPayNow'); await put('#uPayWant');
  await put('input[name=start]');
  await put('#u1', 'A timber-frame warehouse with no hydrant within a kilometre.');
  await put('#u2', 'A haulier with a bad year but a new fleet policy and telematics.');
  await put('#u3', 'Send the renewal thirty days out with the claims history on it.');
  await pg.setInputFiles('#uCv', { name: 'cv.pdf', mimeType: 'application/pdf', buffer: Buffer.from('%PDF-1.4 test') });
  await pg.click('#uSend');
  await pg.waitForFunction(() => document.getElementById('uDone').textContent.length > 0, { timeout: 15000 });

  ok(!!body, 'the application posted');
  const by = k => (body.fields.find(x => x.k === k) || {}).value;
  ok(body.form === 'underwriter' && body.code === 'QU', 'filed as QU');
  ok(/^1\. Sums insured unchanged/.test(by('file_order')), 'the file order reaches him: ' + String(by('file_order')).split('\n')[0]);
  ok(by('file_prem') === 'Load it', 'the premium decision reaches him');
  ok(/valuation/.test(by('file_ask')), 'what they would ask reaches him');
  ok(/claims in the last term/.test(by('file_missed')), 'what they walked past reaches him');
  ok(by('uw_qstatus') === 'Diploma', 'the qualification status reaches him');
  console.log('\n— what the Branch Manager reads —');
  ['uw_qstatus','uw_quals','file_order','file_ask','file_prem','file_missed']
    .forEach(k => console.log('  ' + k + ': ' + String(by(k)).replace(/\n/g, '\n      ')));
  await pg.close();
}

// and with JavaScript off the file simply is not there, rather than broken
{
  const ctx = await br.newContext({ javaScriptEnabled: false, viewport: { width: 1366, height: 900 } });
  const pg = await ctx.newPage();
  await pg.goto(`http://localhost:${port}/clientmanager/`, { waitUntil: 'domcontentloaded' });
  ok(await pg.$eval('#fileg', e => e.hasAttribute('hidden')), 'no JS: the file is hidden, not broken');
  ok(await pg.$eval('#file noscript', e => /question four/.test(e.textContent)), 'no JS: it says where the same question lives');
  ok(await pg.$('#uf'), 'no JS: the application is still there');
  await ctx.close();
}

await br.close(); srv.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
})();
