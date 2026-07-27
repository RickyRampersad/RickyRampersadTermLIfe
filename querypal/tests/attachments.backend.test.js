// Stub the Apps Script globals buildAttachments_ touches
global.Utilities = {
  // Apps Script throws on malformed base64; Buffer.from silently ignores junk, so be strict
  base64Decode: s => { if (!/^[A-Za-z0-9+/]*={0,2}$/.test(s)) throw new Error('bad base64'); return Buffer.from(s, 'base64'); },
  newBlob: (bytes, mime, name) => ({ bytes, mime, name, getName: () => name })
};
const src = require('fs').readFileSync(require('path').join(__dirname, '..', 'QueryPal_Backend_v6.gs'), 'utf8');
// pull out just the helpers we want to test
eval(src.slice(src.indexOf('var ATTACH_OK_RX'), src.indexOf('function sendRoutedEmail')));

const b64 = (n, ch='A') => Buffer.alloc(n, ch).toString('base64');
let pass = 0, fail = 0;
const t = (label, got, want) => {
  const ok = JSON.stringify(got) === JSON.stringify(want);
  console.log((ok ? '  PASS  ' : '  FAIL  ') + label + (ok ? '' : `\n          got ${JSON.stringify(got)}\n          want ${JSON.stringify(want)}`));
  ok ? pass++ : fail++;
};

let r = buildAttachments_({ files: [
  { name: 'Receipt scan.pdf', mime: 'application/pdf', data: b64(1000) },
  { name: 'Claim Form.docx', mime: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document', data: b64(500) },
  { name: 'Statement.xlsx', mime: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', data: b64(400) },
  { name: 'photo.jpg', mime: 'image/jpeg', data: b64(300) }
]});
t('4 mixed docs attach', r.names, ['Receipt scan.pdf','Claim Form.docx','Statement.xlsx','photo.jpg']);
t('  none skipped', r.skipped, 0);
t('  mime preserved on docx', r.blobs[1].mime, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');

r = buildAttachments_({ files: [
  { name: 'ok.pdf', mime: 'application/pdf', data: b64(100) },
  { name: 'virus.exe', mime: 'application/x-msdownload', data: b64(100) },
  { name: 'script.html', mime: 'text/html', data: b64(100) }
]});
t('executable + html rejected', r.names, ['ok.pdf']);
t('  counted as skipped', r.skipped, 2);

r = buildAttachments_({ files: [
  { name: 'huge.pdf', mime: 'application/pdf', data: b64(21 * 1024 * 1024) },
  { name: 'small.pdf', mime: 'application/pdf', data: b64(50) }
]});
t('oversize dropped, small kept', r.names, ['small.pdf']);

r = buildAttachments_({ files: [{ name: '../../etc/passwd\r\n.pdf', mime: 'application/pdf', data: b64(50) }]});
t('path traversal + CRLF neutralised', r.names, ['.. .. etc passwd .pdf']);

r = buildAttachments_({ attachId: b64(80), attachIdMime: 'image/heic', attachIdName: 'ID_John.heic' });
t('legacy single-file still works', r.names, ['ID_John.heic']);
t('  legacy honours real mime', r.blobs[0].mime, 'image/heic');

r = buildAttachments_({ attachPdf: b64(90), attachPdfName: 'Change_of_Beneficiary.pdf',
                        attachId: b64(70), attachIdMime: 'image/jpeg', attachIdName: 'ID_Jane.jpg' });
t('guided form: PDF + ID', r.names, ['Change_of_Beneficiary.pdf','ID_Jane.jpg']);

r = buildAttachments_({ attachPdf: b64(90), attachPdfName: 'form.pdf',
                        files: [{ name: 'a.pdf', mime: 'application/pdf', data: b64(10) }],
                        attachId: b64(70), attachIdName: 'dupe.jpg' });
t('files[] wins over legacy (no dupe)', r.names, ['form.pdf','a.pdf']);

r = buildAttachments_({ files: Array.from({length: 9}, (_, i) => ({ name: `f${i}.pdf`, mime: 'application/pdf', data: b64(20) })) });
t('caps at 6 files', r.names.length, 6);
t('  overflow counted', r.skipped, 3);

t('no attachments', buildAttachments_({}).names, []);
t('corrupt base64 survives', buildAttachments_({ files: [{ name:'x.pdf', mime:'application/pdf', data:'!!!not base64!!!' }]}).blobs.length, 0);

console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);
