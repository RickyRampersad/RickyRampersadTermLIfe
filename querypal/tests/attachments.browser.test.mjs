import { createRequire } from 'module';
import path from 'path';
const { chromium } = createRequire(import.meta.url)('/opt/node22/lib/node_modules/playwright');

import fs from 'fs';
import zlib from 'zlib';
const HERE = path.dirname(new URL(import.meta.url).pathname);
const DIR = path.join(HERE, 'fixtures');
const FIX = f => path.join(DIR, f);

/* Fixtures are generated rather than committed — keeps binaries (and a .exe) out of the repo. */
function makeFixtures() {
  fs.mkdirSync(DIR, { recursive: true });
  fs.writeFileSync(FIX('Bank Receipt.pdf'), Buffer.from(
    '%PDF-1.4\n1 0 obj<</Type/Catalog/Pages 2 0 R>>endobj\n2 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj\n'
    + '3 0 obj<</Type/Page/Parent 2 0 R/MediaBox[0 0 200 200]>>endobj\ntrailer<</Root 1 0 R>>\n%%EOF\n'));
  // a .docx is just a zip; a stored-entry zip is enough for MIME/extension handling
  const entry = (name, body) => {
    const d = Buffer.from(body), crc = zlib.crc32 ? zlib.crc32(d) : 0;
    const n = Buffer.from(name);
    const lf = Buffer.alloc(30); lf.write('PK\x03\x04', 0, 'binary');
    lf.writeUInt32LE(crc >>> 0, 14); lf.writeUInt32LE(d.length, 18);
    lf.writeUInt32LE(d.length, 22); lf.writeUInt16LE(n.length, 26);
    return { lf: Buffer.concat([lf, n, d]), name: n, crc: crc >>> 0, size: d.length };
  };
  const e = entry('word/document.xml', '<?xml version="1.0"?><document/>');
  const cd = Buffer.alloc(46); cd.write('PK\x01\x02', 0, 'binary');
  cd.writeUInt32LE(e.crc, 16); cd.writeUInt32LE(e.size, 20); cd.writeUInt32LE(e.size, 24);
  cd.writeUInt16LE(e.name.length, 28);
  const cdr = Buffer.concat([cd, e.name]);
  const eocd = Buffer.alloc(22); eocd.write('PK\x05\x06', 0, 'binary');
  eocd.writeUInt16LE(1, 8); eocd.writeUInt16LE(1, 10);
  eocd.writeUInt32LE(cdr.length, 12); eocd.writeUInt32LE(e.lf.length, 16);
  fs.writeFileSync(FIX('Claim Form.docx'), Buffer.concat([e.lf, cdr, eocd]));
  // a real 2x2 PNG so the canvas compression path runs for real
  const chunk = (t, d) => { const c = Buffer.concat([Buffer.from(t), d]);
    const len = Buffer.alloc(4); len.writeUInt32BE(d.length);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(c) >>> 0);
    return Buffer.concat([len, c, crc]); };
  const ihdr = Buffer.alloc(13); ihdr.writeUInt32BE(2, 0); ihdr.writeUInt32BE(2, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  const raw = Buffer.from([0, 255,0,0, 255,0,0, 0, 0,0,255, 0,0,255]);
  fs.writeFileSync(FIX('policy photo.png'), Buffer.concat([
    Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]));
  fs.writeFileSync(FIX('malware.exe'), Buffer.concat([Buffer.from('MZ'), Buffer.alloc(500)]));
  fs.writeFileSync(FIX('toobig.pdf'), Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(9 * 1024 * 1024, 0x41)]));
}
makeFixtures();
const page = await (await chromium.launch()).newPage();
const errors = [];
page.on('pageerror', e => errors.push(String(e)));
await page.goto('file://' + path.join(HERE, '..', 'index.html'));

let pass = 0, fail = 0;
const t = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log((ok?'  PASS  ':'  FAIL  ')+label+(ok?'':`\n          got  ${JSON.stringify(got)}\n          want ${JSON.stringify(want)}`));
  ok ? pass++ : fail++;
};

// walk the real user path: Client -> category -> query, so renderGenAttach runs for real
await page.evaluate(() => pickWho('Client'));
await page.evaluate(() => { pickGroup('Payments & Premiums'); });
await page.evaluate(() => { const i = DATA.findIndex(d => d.type === 'Bounce Cheque'); pickQ(i); });

t('attach box rendered on the form', await page.locator('#gen_file').count(), 1);
t('accepts documents, not just images',
  (await page.locator('#gen_file').getAttribute('accept')).includes('.pdf'), true);
t('allows multiple files', await page.locator('#gen_file').getAttribute('multiple'), '');
t('prompt mentions documents',
  (await page.locator('#genAttach .dt').innerText()).toLowerCase().includes('document'), true);

// attach a PDF, a Word doc and a photo together
await page.setInputFiles('#gen_file', [FIX('Bank Receipt.pdf'), FIX('Claim Form.docx'), FIX('policy photo.png')]);
await page.waitForFunction(() => formState.gen.length === 3, null, { timeout: 5000 });
t('3 mixed files held in state',
  await page.evaluate(() => formState.gen.map(f => f.mime)),
  ['application/pdf','application/vnd.openxmlformats-officedocument.wordprocessingml.document','image/jpeg']);
t('photo was compressed to jpeg',
  await page.evaluate(() => formState.gen[2].data.startsWith('data:image/jpeg')), true);
t('pdf kept as pdf data uri',
  await page.evaluate(() => formState.gen[0].data.startsWith('data:application/pdf')), true);
t('3 chips shown to the user', await page.locator('.filechip').count(), 3);
t('doc shows an icon, photo shows a thumbnail',
  await page.evaluate(() => [!!document.querySelectorAll('.filechip')[0].querySelector('.fi'),
                             !!document.querySelectorAll('.filechip')[2].querySelector('img')]), [true, true]);
t('file name visible in the UI',
  (await page.locator('.filechip .fn').first().innerText()), 'Bank Receipt.pdf');

// payload the backend will receive
const payload = await page.evaluate(() => { document.getElementById('f_client').value = 'John Doe'; return genAttachResult(); });
t('payload carries 3 files', payload.attach.files.length, 3);
t('names are sanitised + client-prefixed',
  payload.attach.files.map(f => f.name),
  ['John_Doe_Bank_Receipt.pdf','John_Doe_Claim_Form.docx','John_Doe_policy_photo.png']);
t('base64 has no data-uri prefix', payload.attach.files[0].data.startsWith('JVBER'), true);
t('description notes the attachments', payload.attach.formExtra.startsWith('3 attachments:'), true);
t('legacy slot still filled for un-redeployed backend', !!payload.attach.attachId, true);
t('attachments kept out of Salesforce', payload.attach.noSalesforceAttach, true);

// rejections
await page.evaluate(() => genClear());
await page.setInputFiles('#gen_file', [FIX('malware.exe')]);
await page.waitForFunction(() => document.querySelector('.attwarn') !== null, null, { timeout: 5000 });
t('executable rejected', await page.evaluate(() => formState.gen.length), 0);
t('user told why', (await page.locator('.attwarn').innerText()).includes("isn't accepted"), true);

await page.evaluate(() => genClear());
await page.setInputFiles('#gen_file', [FIX('toobig.pdf'), FIX('Bank Receipt.pdf')]);
await page.waitForFunction(() => formState.gen.length === 1, null, { timeout: 8000 });
t('9 MB file blocked, small one kept',
  await page.evaluate(() => formState.gen.map(f => f.name)), ['Bank Receipt.pdf']);
t('size limit explained', (await page.locator('.attwarn').innerText()).includes('8 MB'), true);

// remove one of several
await page.evaluate(() => genClear());
await page.setInputFiles('#gen_file', [FIX('Bank Receipt.pdf'), FIX('Claim Form.docx')]);
await page.waitForFunction(() => formState.gen.length === 2, null, { timeout: 5000 });
await page.locator('.filechip .rm').first().click();
t('remove drops just that file',
  await page.evaluate(() => formState.gen.map(f => f.name)), ['Claim Form.docx']);
t('chip count follows', await page.locator('.filechip').count(), 1);

// re-picking the same file after removing it must work (input.value reset)
await page.setInputFiles('#gen_file', [FIX('Bank Receipt.pdf')]);
await page.waitForFunction(() => formState.gen.length === 2, null, { timeout: 5000 });
t('same file can be re-attached after removal',
  await page.evaluate(() => formState.gen.length), 2);

// switching query type must not leak attachments between requests
await page.evaluate(() => { const i = DATA.findIndex(d => d.type === 'Embassy letters'); pickQ(i); });
t('attachments cleared when query changes', await page.evaluate(() => formState.gen.length), 0);
t('empty payload when nothing attached', await page.evaluate(() => genAttachResult()), { ok: true, attach: {} });

t('no JavaScript errors on the page', errors, []);
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
