/**
 * AgentDrafts.gs: put ready-made e-mails into support@ Drafts with their layout and attachments intact (8 Nov 2026).
 *
 * Ricky, 8 Nov 2026: the agents' orphan e-mails must go from support@rickyrampersadbranch.com "so it's recorded",
 * and they must keep their tables and layout. The Microsoft 365 connector Claude drafts with strips every style, so
 * Claude builds each e-mail as a complete .eml file (HTML, plain-text fallback, Guardian Life's letter pages attached)
 * and leaves it in a Drive folder. This file hands each one to Microsoft Graph as MIME, which creates the draft in
 * support@ Drafts exactly as built. Nothing is sent from here: Ricky opens each draft, checks it and presses Send, and
 * the sent copy stays in support@ Sent Items as the record.
 *
 * Run from the editor:   agentDraftsNow()       makes a draft from every .eml in the folder not drafted before
 *                        agentDraftsCheck()     says what is waiting, without making anything
 * A file that has become a draft is renamed "DRAFTED <date> · <name>", so a second run never makes it twice.
 *
 * Needs: the Entra app behind MS_TENANT / MS_CLIENT / MS_SECRET with Mail.ReadWrite (application), which Letters.gs
 * already needs; tMsToken_ and TRANSITION.MS_FROM from Transition.gs.
 */

var AGENT_DRAFTS = {
  FOLDER: '1cfOSrSI2WBnLB5AAADqMdBm1F7MkSciv',   // "Agent e-mails to draft (support@)" in Ricky's Drive (an id, no client data)
  FOLDER_PROP: 'AGENT_DRAFTS_FOLDER_ID',          // a Script property of this name wins over FOLDER
  DONE: 'DRAFTED ',
  MAX_MB: 3.5,                                     // Graph takes a request of up to 4 MB; base64 adds a third
};

function agentDraftsCheck() {
  var out = agentDraftsFiles_().map(function (f) { return f.getName() + ' (' + Math.round(f.getSize() / 1024) + ' KB)'; });
  var msg = out.length ? 'Waiting to become drafts: ' + out.join(', ') : 'Nothing waiting: every e-mail in the folder is already a draft.';
  Logger.log(msg);
  return msg;
}

function agentDraftsNow() {
  var res = { made: [], failed: [] };
  if (typeof tMsCreds_ !== 'function' || !tMsCreds_()) throw new Error('Microsoft 365 is not set up (MS_TENANT, MS_CLIENT, MS_SECRET).');
  agentDraftsFiles_().forEach(function (f) {
    var name = f.getName();
    try {
      var bytes = f.getBlob().getBytes();
      if (bytes.length * 4 / 3 > AGENT_DRAFTS.MAX_MB * 1024 * 1024) throw new Error('too large for one request');
      var r = UrlFetchApp.fetch('https://graph.microsoft.com/v1.0/users/' + encodeURIComponent(TRANSITION.MS_FROM) + '/messages', {
        method: 'post', contentType: 'text/plain', payload: Utilities.base64Encode(bytes), muteHttpExceptions: true,
        headers: { Authorization: 'Bearer ' + tMsToken_() } });
      var code = r.getResponseCode();
      if (code < 200 || code >= 300) {
        var why = 'HTTP ' + code;
        try { var e = JSON.parse(r.getContentText()).error; if (e) why = (e.code ? e.code + ': ' : '') + (e.message || ''); } catch (x) {}
        if (code === 403) why += ' (the Entra app needs Mail.ReadWrite with admin consent)';
        throw new Error(why.slice(0, 220));
      }
      var m = JSON.parse(r.getContentText() || '{}');
      f.setName(AGENT_DRAFTS.DONE + Utilities.formatDate(new Date(), Session.getScriptTimeZone(), 'd MMM HH:mm') + ' · ' + name);
      res.made.push(name.replace(/\.eml$/i, '') + ': "' + (m.subject || '') + '"' + (m.hasAttachments ? ', attachments on' : ''));
    } catch (err) {
      res.failed.push(name + ': ' + err.message);
    }
  });
  var msg = 'Drafts made in support@: ' + res.made.length + (res.made.length ? '\n  ' + res.made.join('\n  ') : '') +
            (res.failed.length ? '\nNot made: ' + res.failed.length + '\n  ' + res.failed.join('\n  ') : '');
  Logger.log(msg);
  return msg;
}

function agentDraftsFiles_() {
  var id = '';
  try { id = PropertiesService.getScriptProperties().getProperty(AGENT_DRAFTS.FOLDER_PROP) || ''; } catch (e) {}
  var it = DriveApp.getFolderById(id || AGENT_DRAFTS.FOLDER).getFiles(), out = [];
  while (it.hasNext()) {
    var f = it.next(), n = f.getName();
    if (/\.eml$/i.test(n) && n.indexOf(AGENT_DRAFTS.DONE) !== 0) out.push(f);
  }
  return out.sort(function (a, b) { return a.getName() < b.getName() ? -1 : 1; });
}
