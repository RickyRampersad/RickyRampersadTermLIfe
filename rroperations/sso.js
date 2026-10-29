/* The branch app's one sign-in, carried into every tool (18 October 2026: "when they log in they should not have to log
 * back into all the apps").
 *
 * The branch app (/app, /rroperations/) keeps its sign-in under "rrb-ops-session". The clients board, its test, the
 * walls and group clients each keep their own code under their own key. Loaded in a tool page's <head>, before the
 * page's own script, this writes the app's sign-in into those keys as "OPS:<token>" with the agent number, so the tool
 * opens already signed in. The tool's backend asks RR Operations who the token belongs to; it never sees a password.
 *
 * A code the person typed into a tool themselves is left alone. When the app is signed out, every key this wrote is
 * cleared, so signing out of the app signs out of every tool on the phone.
 */
(function () {
  'use strict';
  var PAIRS = [['rrb-transition-code', 'rrb-assign-who'], ['rrb-gcm-code', 'rrb-gcm-who']];
  var s = null;
  try { s = JSON.parse(localStorage.getItem('rrb-ops-session') || 'null'); } catch (e) {}
  window.RRB_OPS_SESSION = s && s.token ? s : null;
  try {
    PAIRS.forEach(function (k) {
      var code = localStorage.getItem(k[0]) || '';
      var ours = /^OPS:/i.test(code);
      if (s && s.token) {
        if (!code || ours) {
          localStorage.setItem(k[0], 'OPS:' + s.token);
          localStorage.setItem(k[1], s.agentNo || s.name || '');
        }
      } else if (ours) {
        localStorage.removeItem(k[0]); localStorage.removeItem(k[1]);
      }
    });
  } catch (e) {}
})();
