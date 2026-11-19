/**
 * Query Pal: two small routes for HELP 868 (19 November 2026).
 *
 * Paste into the Query Pal Apps Script project (the logger the HELP 868 assistant posts to),
 * then add these two lines inside doGet(), above the final "return ContentService..." line:
 *
 *   if (p.action === 'h868close'  && p.ref) return h868Close_(p.ref, p.score, p.key);
 *   if (p.action === 'h868reopen' && p.ref) return h868Reopen_(p.ref, p.key);
 *
 * Then Deploy > Manage deployments > pencil > New version (never New deployment: the address must not change).
 *
 * Why: when the client taps "Yes, close it" on WhatsApp, respond.io calls h868close, so the ticket reads Closed
 * on the Query Pal sheet with its closing date, days to close and (when given) the 1 to 5 rating in column Z.
 * "No, not yet" calls h868reopen. The existing survey route already records a rating the same way; this adds the
 * closing.
 *
 * Set a Script property HELP868_KEY (the same key the assistant sends) so only HELP 868 can call these.
 * If the property is not set the routes are open, so set it before going live.
 *
 * Uses findRowByRef_ and json() which already exist in this project.
 */

function h868KeyOk_(key) {
  var want = PropertiesService.getScriptProperties().getProperty('HELP868_KEY');
  return !want || String(key || '') === String(want);
}

function h868Close_(ref, score, key) {
  if (!h868KeyOk_(key)) return json({ ok: false, error: 'refused' });
  var hit = h868Find_(ref);
  if (!hit) return json({ ok: false, error: 'reference not found' });
  var sh = hit.sh, r = hit.r, now = new Date();
  var opened = sh.getRange(r, 3).getValue();
  sh.getRange(r, 4).setValue('Closed');          // Status
  sh.getRange(r, 21).setValue(now);              // Date Closed
  if (opened instanceof Date) sh.getRange(r, 22).setValue(Math.round((now - opened) / 864e5 * 10) / 10); // Days to Close
  var n = Number(score) || 0;
  if (n >= 1 && n <= 5) sh.getRange(r, 26).setValue(n); // rating, as the survey route does
  return json({ ok: true, ref: String(ref), status: 'Closed' });
}

function h868Reopen_(ref, key) {
  if (!h868KeyOk_(key)) return json({ ok: false, error: 'refused' });
  var hit = h868Find_(ref);
  if (!hit) return json({ ok: false, error: 'reference not found' });
  hit.sh.getRange(hit.r, 4).setValue('Open');
  hit.sh.getRange(hit.r, 21).clearContent();
  hit.sh.getRange(hit.r, 22).clearContent();
  return json({ ok: true, ref: String(ref), status: 'Open' });
}

/* A reference can arrive with its subject shortened or re-spaced by WhatsApp, so match on the first three parts
   (RRB/year/number) instead of the whole string. Row is returned without its values: callers use sh and r only. */
function h868Find_(ref) {
  var parts = String(ref || '').split('/');
  if (parts.length < 3) return findRowByRef_(ref);
  var key = parts.slice(0, 3).join('/').toUpperCase();
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET_NAME);
  if (!sh || sh.getLastRow() < 2) return null;
  var col = sh.getRange(2, 1, sh.getLastRow() - 1, 1).getValues();
  for (var i = 0; i < col.length; i++) {
    var v = String(col[i][0] || '').trim().toUpperCase();
    if (v === key || v.indexOf(key + '/') === 0) return { sh: sh, r: i + 2, row: null };
  }
  return null;
}

/* ONE-LINE CHANGE IN doPost (29 Nov 2026 design, HELP 868 agent routing):
   The HELP 868 assistant now sends "assignedTo": the first name of the agent's support person (their Salesforce
   owner) when the sender is an agent, and "" for a client. In doPost, replace
       const asg = assignFor_(d.queryType, d.category, d.department);
   with
       const asg = d.assignedTo ? { name: clean(d.assignedTo) } : assignFor_(d.queryType, d.category, d.department);
   so "Assigned To" is the agent's support person, and the query-type pick from "KPI Assignments" still applies to
   clients. The departments' automated e-mails are unchanged. The mapping lives in respond.io only: no lookup tab here. */
