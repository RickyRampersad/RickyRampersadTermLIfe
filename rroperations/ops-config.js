/* RR Operations — the one setting every app under /rroperations/ shares.
 *
 * The RR Operations Apps Script web app's /exec address. Paste it here once
 * after deploying (Deploy → Manage deployments → the /exec URL); the
 * launcher and every app read it from this file. Re-deploy with "New
 * version", never "New deployment", or this address changes.
 *
 * The sign-in is shared too: it is kept on the phone under "rrb-ops-session",
 * so signing in on the launcher signs you in to every app.
 */
window.RR_OPS = {
  API_URL: 'https://script.google.com/macros/s/AKfycbyRPFW_RdQItCeSMHvP2HYEN69Zv2HQMrLxw9IUWUlnUlkzjqaVFPdvjFcg_-b-zX78/exec',
  SESSION_KEY: 'rrb-ops-session',
};
(function () {
  try {
    var o = new URLSearchParams(location.search).get('api');
    if (o && /^https:\/\//.test(o)) { window.RR_OPS.API_URL = o; sessionStorage.setItem('rrb-ops-api', o); }
    else { var s = sessionStorage.getItem('rrb-ops-api'); if (s) window.RR_OPS.API_URL = s; }
  } catch (e) {}
})();
