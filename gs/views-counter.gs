/**
 * RRB Site View Counter — logs one row per page view.
 *
 * Deploy (one time, ~2 minutes, desktop browser):
 *   1. script.google.com → New project → delete the sample code
 *   2. Paste this whole file → save (name it "RRB Views")
 *   3. Deploy → New deployment → type: Web app
 *      - Execute as: Me
 *      - Who has access: Anyone
 *   4. Authorize when asked, then copy the Web app URL (ends in /exec)
 *      and send it to Claude, who wires it into the site pages.
 *
 * Rows land in the "RRB Site View Counter" spreadsheet in Drive.
 * No client data is collected — only page path, referrer and time.
 */
var SHEET_ID = '1R9P_kJAvrsV2vbEwwnhk1v5ma3FWF3JCrMcehzz8bfg';

function doGet(e) {
  try {
    var p = String((e && e.parameter && e.parameter.p) || '').slice(0, 200);
    var r = String((e && e.parameter && e.parameter.r) || '').slice(0, 300);
    if (p) {
      var sh = SpreadsheetApp.openById(SHEET_ID).getSheets()[0];
      if (sh.getLastRow() === 0) sh.appendRow(['time', 'page', 'referrer']);
      sh.appendRow([new Date(), p, r]);
    }
  } catch (err) {}
  return ContentService.createTextOutput('ok');
}
