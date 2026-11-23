/* Schedule of benefits on a group's page (23 November 2026: "can the schedule of benefits be available to the employee
 * and any question they ask online as we have integrated what's app"). Whoever looks after the group, the deputy and the
 * branch manager upload the schedule Guardian sent (its text is read here with pdf.js), check it as employees will read
 * it, and publish it. Then the group's own link (/mybenefits/?k=…) shows it, and HELP 868 answers from it on WhatsApp.
 * Uses the page's own helpers: $, esc, api, post, toast, doCopy, dmy, GROUP. Backend: GroupSchedules.gs. */
const SOB_PDF = { src: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js', worker: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js' };
let SOB = null, SOB_EDIT = null;

function sobHtml(d) {
  return '<section class="drawer lnk sob" id="sob" aria-labelledby="sobh"><h3 id="sobh" style="margin-top:0">Schedule of benefits <span class="muted small">what employees read, and what HELP 868 answers from</span></h3>' +
    '<div id="sobBody"><p class="small muted">Reading the schedules…</p></div></section>';
}
async function loadSob() {
  const box = $('sobBody'); if (!box || !GROUP) return;
  const r = await api({ action: 'gcm.sobList', group: GROUP.group.key });
  if (!$('sobBody')) return;
  SOB = r; drawSob();
}
function sobStatus(s) {
  return { published: '<span class="chip good"><i></i>Employees see this</span>', draft: '<span class="chip warn"><i></i>Draft: employees do not see it</span>',
    replaced: '<span class="chip"><i></i>Replaced</span>', retired: '<span class="chip"><i></i>Taken down</span>' }[s.status] || '';
}
function sobHrText(link) {
  const g = GROUP.group, first = String(g.contact || '').split(' ')[0];
  return 'Hi' + (first ? ' ' + first : '') + ', your employees can now read ' + g.name + '’s schedule of benefits on their phones, any time: ' + link + '\n\n' +
    'They can also ask HELP 868 on WhatsApp, (868) 435-7868, day or night. It answers from your plan’s own schedule, and a member of our team follows up anything it cannot answer. ' +
    'Please share the link with your staff (the WhatsApp group or the notice board is ideal). It shows the plan only, never anyone’s personal details or claims.\n\nRicky Rampersad Branch';
}
function drawSob() {
  const box = $('sobBody'), r = SOB; if (!box) return;
  if (!r || !r.ok) {
    box.innerHTML = '<div class="note bad">' + esc((r && r.error) || 'The schedules could not be read.') + (/Unknown action/i.test((r && r.error) || '') ? ' GroupSchedules.gs and GroupClients.gs need pasting into the Service Questionnaire project, then a New version publishing.' : '') + '</div>';
    return;
  }
  const pub = r.schedules.filter(s => s.status === 'published'), drafts = r.schedules.filter(s => s.status === 'draft'), old = r.schedules.filter(s => s.status === 'replaced' || s.status === 'retired');
  let h = '';
  if (r.link) {
    h += '<div class="lk"><div class="lkt"><b>Employees’ link</b> <span class="muted small">the plan only, never a person’s details</span></div><div class="lkr">' +
      '<input class="field lku" id="sobLink" value="' + esc(r.link) + '" readonly aria-label="Employees’ link"><button class="btn sm" type="button" data-sobcopy="link">Copy link</button>' +
      '<button class="btn ghost sm" type="button" data-sobcopy="hr">Copy message for HR</button><a class="btn ghost sm" href="' + esc(r.link) + '" target="_blank" rel="noopener">See it as employees do</a></div></div>';
  } else {
    h += '<p class="small muted" style="margin:0 0 8px">Nothing is published yet, so employees have no page and HELP 868 cannot answer for this group. Upload the schedule Guardian sent with the renewal, check it, then press Publish.</p>';
  }
  h += '<p class="small muted" style="margin:6px 0">' + (r.whatsapp ? 'HELP 868 answers on WhatsApp from what is published here, for a member who gives the number on their health card.' : 'HELP 868 on WhatsApp is not answering plan questions yet: run gsbMakeLookupKey once in the editor, then the branch puts the key in respond.io.') + '</p>';
  const row = s => '<div class="sobrow"><div><b>' + esc(s.label) + '</b> ' + sobStatus(s) + '<div class="small muted">' + esc(s.title || '') + (s.effective ? ' · from ' + esc(dmy(s.effective)) : '') +
    (s.hasPdf ? ' · PDF kept' : '') + ' · ' + esc(s.status === 'published' && s.pubBy ? 'published by ' + s.pubBy + (s.pubAt ? ', ' + s.pubAt : '') : 'uploaded by ' + (s.by || '?') + (s.when ? ', ' + s.when : '')) + '</div></div>' +
    '<div class="sobact">' + (r.canAct && s.status === 'draft' ? '<button class="btn sm" type="button" data-sobpub="' + esc(s.ref) + '">Publish</button><button class="btn ghost sm" type="button" data-sobedit="' + esc(s.ref) + '">Check and edit</button>' : '') +
    (r.canAct && s.status === 'published' ? '<button class="btn ghost sm" type="button" data-sobnew="' + esc(s.ref) + '">Upload this year’s</button><button class="btn ghost sm" type="button" data-sobret="' + esc(s.ref) + '">Take it down</button>' : '') +
    '<button class="btn ghost sm" type="button" data-sobview="' + esc(s.ref) + '">Read it</button></div>' +
    '<div class="sobview" id="sobv-' + esc(s.ref) + '" hidden></div></div>';
  h += pub.map(row).join('') + drafts.map(row).join('');
  if (old.length) h += '<details class="lkg"><summary>Earlier schedules (' + old.length + ')</summary>' + old.map(row).join('') + '</details>';
  if (r.canAct) h += '<details class="lkg" id="sobAddBox"' + (SOB_EDIT || !r.schedules.length ? ' open' : '') + '><summary>' + (SOB_EDIT && SOB_EDIT.ref ? 'Check and edit the draft' : 'Add a schedule') + '</summary>' + sobForm() + '</details>';
  else h += '<p class="small muted">Uploading and publishing are for ' + esc(GROUP.group.assigned || 'the account owner') + ', the assistant branch manager or the branch manager.</p>';
  if (r.questions && r.questions.length) h += '<details class="lkg"><summary>What employees asked lately (' + r.questions.length + ')</summary><ul class="sobq">' +
    r.questions.map(q => '<li><span class="muted small">' + esc(q.when) + ' · ' + esc(q.via || '') + '</span> ' + (q.q ? esc(q.q) : '<span class="muted">opened the page</span>') + (q.q && !q.matched ? ' <span class="chip warn"><i></i>not in the schedule: a person should answer</span>' : '') + '</li>').join('') + '</ul></details>';
  box.innerHTML = h;
  bindSob();
}
function sobForm() {
  const e = SOB_EDIT || {}, lines = (SOB && SOB.lines) || { health: 'Group Health', life: 'Group Life' };
  return '<form id="sobF" class="mkf" autocomplete="off">' +
    '<div class="g2"><label>Plan<select class="field" name="line">' + Object.keys(lines).map(k => '<option value="' + k + '"' + ((e.line || 'health') === k ? ' selected' : '') + '>' + esc(lines[k]) + '</option>').join('') + '</select></label>' +
    '<label>Effective from<input class="field" type="date" name="effective" value="' + esc(e.effective || '') + '"></label>' +
    '<label style="grid-column:1/-1">Title <span class="muted small">(optional)</span><input class="field" name="title" maxlength="120" value="' + esc(e.title || '') + '" placeholder="Group Health · Schedule of Benefits"></label></div>' +
    (e.ref ? '' : '<label>The schedule Guardian sent (PDF)<input class="field" type="file" id="sobFile" accept="application/pdf,.pdf"></label><p class="small muted" style="margin:4px 0">Its text is read on this device. Or type or paste the schedule into the box.</p>') +
    '<label>The schedule, as employees will read it <span class="muted small">one benefit a line; columns split by | ; a line in CAPITALS or ending in : is a heading</span>' +
    '<textarea class="field" name="text" id="sobText" rows="14" spellcheck="false" style="font-family:ui-monospace,Menlo,Consolas,monospace;font-size:14px">' + esc(e.text || '') + '</textarea></label>' +
    '<div class="small muted" id="sobCount"></div><h4 style="margin:12px 0 4px">How employees will see it</h4><div class="sobprev mb" id="sobPrev"></div>' +
    '<div style="margin-top:10px;display:flex;gap:8px;flex-wrap:wrap"><button class="btn" type="submit" id="sobSave">' + (e.ref ? 'Save the draft' : 'Save as a draft') + '</button>' +
    (e.ref ? '<button class="btn ghost" type="button" id="sobCancel">Cancel</button>' : '') + '</div><p class="small muted">Saving makes a draft. Employees and HELP 868 see nothing until you press Publish.</p></form>';
}
function sobPreview() {
  const t = $('sobText'), p = $('sobPrev'); if (!t || !p) return;
  p.innerHTML = t.value.trim() ? SobRender.html(t.value) : '<p class="muted small">Nothing yet.</p>';
  const n = t.value.split('\n').filter(l => l.indexOf('|') >= 0).length;
  if ($('sobCount')) $('sobCount').textContent = t.value.length.toLocaleString() + ' characters · ' + n + ' benefit row' + (n === 1 ? '' : 's');
}
function sobLoadPdfJs() {
  if (window.pdfjsLib) return Promise.resolve(window.pdfjsLib);
  return new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = SOB_PDF.src;
    s.onload = () => { try { window.pdfjsLib.GlobalWorkerOptions.workerSrc = SOB_PDF.worker; } catch (e) {} res(window.pdfjsLib); };
    s.onerror = () => rej(new Error('The PDF reader did not load. Check the connection, or paste the text in.'));
    document.head.appendChild(s);
  });
}
/* the PDF's text: each row of the page a line, its columns split where the gap is wide */
async function sobReadPdf(buf) {
  const lib = await sobLoadPdfJs(), doc = await lib.getDocument({ data: buf }).promise, out = [];
  for (let n = 1; n <= doc.numPages; n++) {
    const tc = await (await doc.getPage(n)).getTextContent(), rows = [];
    tc.items.forEach(it => {
      if (!it.str || !it.str.trim()) return;
      const x = it.transform[4], y = it.transform[5];
      let r = rows.find(r => Math.abs(r.y - y) < 2.5); if (!r) { r = { y, items: [] }; rows.push(r); }
      r.items.push({ x, s: it.str, w: it.width || 0 });
    });
    rows.sort((a, b) => b.y - a.y).forEach(r => {
      r.items.sort((a, b) => a.x - b.x);
      let line = '', end = null;
      r.items.forEach(it => { if (end !== null) { const gap = it.x - end; line += gap > 14 ? ' | ' : gap > 0.8 ? ' ' : ''; } line += it.s; end = it.x + it.w; });
      out.push(line.replace(/\s+/g, ' ').trim());
    });
    out.push('');
  }
  /* a running header or footer repeated on every page (the insurer's name, "Page 2 of 4") is taken out */
  const seen = {}; out.forEach(l => { if (l) seen[l] = (seen[l] || 0) + 1; });
  return out.filter(l => !(l && doc.numPages > 2 && seen[l] >= doc.numPages) && !/^page \d+( of \d+)?$/i.test(l)).join('\n').replace(/\n{3,}/g, '\n\n').trim();
}
function sobB64(buf) { let s = '', b = new Uint8Array(buf); for (let i = 0; i < b.length; i += 0x8000) s += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000)); return btoa(s); }
function bindSob() {
  const box = $('sobBody'); if (!box) return;
  box.querySelectorAll('[data-sobcopy]').forEach(b => b.onclick = () => doCopy(b.dataset.sobcopy === 'hr' ? sobHrText(SOB.link) : SOB.link, b.dataset.sobcopy === 'hr' ? 'The message' : 'The link'));
  box.querySelectorAll('[data-sobview]').forEach(b => b.onclick = () => {
    const s = SOB.schedules.find(x => x.ref === b.dataset.sobview), v = $('sobv-' + b.dataset.sobview); if (!s || !v) return;
    v.hidden = !v.hidden; if (!v.hidden) v.innerHTML = '<div class="sobprev mb">' + SobRender.html(s.text) + '</div>';
    b.textContent = v.hidden ? 'Read it' : 'Close';
  });
  box.querySelectorAll('[data-sobedit]').forEach(b => b.onclick = () => { SOB_EDIT = Object.assign({}, SOB.schedules.find(x => x.ref === b.dataset.sobedit)); drawSob(); $('sobAddBox').scrollIntoView({ block: 'start' }); });
  box.querySelectorAll('[data-sobnew]').forEach(b => b.onclick = () => { const s = SOB.schedules.find(x => x.ref === b.dataset.sobnew); SOB_EDIT = { line: s.line, text: '', title: '' }; drawSob(); $('sobAddBox').scrollIntoView({ block: 'start' }); });
  box.querySelectorAll('[data-sobpub]').forEach(b => b.onclick = async () => {
    const s = SOB.schedules.find(x => x.ref === b.dataset.sobpub);
    if (!confirm('Publish the ' + s.label + ' schedule? Employees with the link see it at once, and HELP 868 answers from it. Any ' + s.label + ' schedule published before is replaced.')) return;
    b.disabled = true; const r = await post({ action: 'gcm.sobAct', group: GROUP.group.key, act: 'publish', ref: s.ref });
    if (!r.ok) { b.disabled = false; return toast(r.error || 'Not published', true); }
    toast(r.said); loadSob();
  });
  box.querySelectorAll('[data-sobret]').forEach(b => b.onclick = async () => {
    if (!confirm('Take this schedule down? Employees will no longer see it, and HELP 868 will stop answering from it.')) return;
    b.disabled = true; const r = await post({ action: 'gcm.sobAct', group: GROUP.group.key, act: 'retire', ref: b.dataset.sobret });
    if (!r.ok) { b.disabled = false; return toast(r.error || 'Not taken down', true); }
    toast(r.said); loadSob();
  });
  const f = $('sobF'); if (!f) return;
  let pdfB64 = '', pdfName = '';
  $('sobText').oninput = sobPreview; sobPreview();
  if ($('sobCancel')) $('sobCancel').onclick = () => { SOB_EDIT = null; drawSob(); };
  if ($('sobFile')) $('sobFile').onchange = async e => {
    const file = e.target.files[0]; if (!file) return;
    if (file.size > 6 * 1024 * 1024) { pdfB64 = ''; toast('That PDF is over 6 MB: its text is read, but the file itself is not kept.', true); }
    toast('Reading ' + file.name + '…');
    try {
      const buf = await file.arrayBuffer();
      if (file.size <= 6 * 1024 * 1024) { pdfB64 = sobB64(buf); pdfName = file.name; }
      const text = await sobReadPdf(buf.slice(0));
      if (text.replace(/\s/g, '').length < 80) return toast('No text could be read from that PDF (it may be a scan). Type or paste the schedule in instead.', true);
      $('sobText').value = text; sobPreview();
      toast('Read. Check every line against the PDF, put the headings right, then Save as a draft.');
    } catch (err) { toast(String(err.message || err), true); }
  };
  f.onsubmit = async e => {
    e.preventDefault();
    const x = Object.fromEntries(new FormData(f).entries());
    const body = { action: 'gcm.sobAct', group: GROUP.group.key, act: 'save', line: x.line, title: x.title, effective: x.effective, text: x.text };
    if (SOB_EDIT && SOB_EDIT.ref) body.ref = SOB_EDIT.ref;
    if (pdfB64) { body.pdf = pdfB64; body.fileName = pdfName; }
    $('sobSave').disabled = true;
    const r = await post(body);
    $('sobSave').disabled = false;
    if (!r.ok) return toast(r.error || 'Not saved', true);
    SOB_EDIT = null; toast(r.said); loadSob();
  };
}
