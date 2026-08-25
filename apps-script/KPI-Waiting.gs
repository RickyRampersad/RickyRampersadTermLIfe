/**
 * RRB · Daily KPI Tracker — who the branch is waiting on
 * =============================================================================
 * "Waiting on someone else" is the largest status in the open book: 141 of 252
 * tasks, carrying 9,775 days between them. As a status it is honest. As a
 * report it is useless, because it does not say who.
 *
 * This turns the status into a list of names. For every open task that is
 * waiting or escalated it takes the counterparty — the Agent on the task, or
 * failing that the Contact — and groups by that person. What comes back is not
 * "141 tasks are blocked" but "these eleven people are holding this much of the
 * branch's work, and this is how long since anyone chased them."
 *
 * Three things it deliberately surfaces:
 *
 *   · Days quiet, from Days_Since_Last_Activity__c. A task waiting three weeks
 *     that was chased yesterday is fine. One waiting three weeks that nobody
 *     has touched in a month is not, and the age alone cannot tell them apart.
 *
 *   · Tasks naming nobody at all. A task cannot be chased if the person to
 *     chase was never recorded, so those are counted separately rather than
 *     hidden in the totals.
 *
 *   · Whether a reason was ever written. Waiting with a reason is a position.
 *     Waiting without one is a gap.
 *
 * Read-only. Paste alongside KPI.gs.
 * =============================================================================
 */

var WAITING_STATUSES = ['Waiting on someone else', 'Escalated'];

/** Everything the branch is waiting on, grouped by who it is waiting on. */
function sfkWaiting_(date) {
  var day = date || todayISO_();
  var cache = CacheService.getScriptCache();
  var key = 'sfk_wait_' + day;
  var hit = cache.get(key);
  if (hit) return JSON.parse(hit);

  var users = sfkUsers_();
  var ids = Object.keys(users).map(function (k) { return "'" + users[k].id + "'"; });
  if (!ids.length) return { ok: false, error: 'No branch staff matched a Salesforce user.' };
  var byId = {};
  Object.keys(users).forEach(function (k) { byId[users[k].id] = k; });

  var statuses = WAITING_STATUSES.map(function (s) { return "'" + s + "'"; }).join(',');
  var recs = sfkQuery_(
    'SELECT Id, OwnerId, Subject, Status, Task_Type__c, ActivityDate, Days_O_S__c, ' +
    'Days_Since_Last_Activity__c, Task_Update_Reason_c__c, Agent__r.Name, Who.Name ' +
    'FROM Task WHERE OwnerId IN (' + ids.join(',') + ') AND Status IN (' + statuses + ') ' +
    'ORDER BY Days_O_S__c DESC NULLS LAST LIMIT 500');

  var groups = {}, unnamed = [], totalDays = 0;

  recs.forEach(function (r) {
    var sid = byId[r.OwnerId];
    if (!sid) return;
    var agent = r.Agent__r ? r.Agent__r.Name : '';
    var contact = r.Who ? r.Who.Name : '';
    var name = agent || contact;
    var age = Number(r.Days_O_S__c || 0);
    var quiet = r.Days_Since_Last_Activity__c == null ? null : Number(r.Days_Since_Last_Activity__c);
    totalDays += age;

    var item = {
      id: r.Id, subject: r.Subject, status: r.Status,
      type: r.Task_Type__c || 'No type', due: r.ActivityDate,
      age: age, quiet: quiet, owner: sid,
      via: agent ? 'agent' : (contact ? 'contact' : ''),
      hasReason: !!(r.Task_Update_Reason_c__c || '').trim()
    };

    if (!name) { unnamed.push(item); return; }
    if (!groups[name]) groups[name] = { name: name, tasks: [], days: 0, oldest: 0, noReason: 0, stale: 0 };
    var gr = groups[name];
    gr.tasks.push(item);
    gr.days += age;
    if (age > gr.oldest) gr.oldest = age;
    if (!item.hasReason) gr.noReason++;
    if (quiet != null && quiet > 30) gr.stale++;      // a month with nobody chasing
  });

  var list = Object.keys(groups).map(function (k) {
    var gr = groups[k];
    gr.tasks.sort(function (a, b) { return b.age - a.age; });
    gr.count = gr.tasks.length;
    gr.owners = uniq_(gr.tasks.map(function (t) { return t.owner; }));
    return gr;
  }).sort(function (a, b) { return b.days - a.days; });

  var res = {
    ok: true, date: day,
    total: recs.length, totalDays: totalDays,
    named: list,
    unnamed: { count: unnamed.length,
               days: unnamed.reduce(function (s, t) { return s + t.age; }, 0),
               tasks: unnamed.slice(0, 40) }
  };
  cache.put(key, JSON.stringify(res), SFK.CACHE_MIN * 60);
  return res;
}

function uniq_(a) {
  var seen = {}, out = [];
  a.forEach(function (x) { if (!seen[x]) { seen[x] = 1; out.push(x); } });
  return out;
}

function sfkWaitingSafe_(date) {
  if (typeof sfkConfigured_ !== 'function' || !sfkConfigured_()) return { ok: false, reason: 'notConfigured' };
  try { return sfkWaiting_(date); }
  catch (e) { return { ok: false, reason: 'error', error: String(e && e.message || e) }; }
}

/** A person's own view: only the tasks they own, still grouped by who they
 *  are waiting on, so the answer to "what am I chasing" is a list of names. */
function sfkWaitingFor_(staffId, date) {
  var all = sfkWaitingSafe_(date);
  if (!all.ok) return all;
  var named = [];
  all.named.forEach(function (gr) {
    var mine = gr.tasks.filter(function (t) { return t.owner === staffId; });
    if (!mine.length) return;
    named.push({
      name: gr.name, tasks: mine, count: mine.length,
      days: mine.reduce(function (s, t) { return s + t.age; }, 0),
      oldest: Math.max.apply(null, mine.map(function (t) { return t.age; })),
      noReason: mine.filter(function (t) { return !t.hasReason; }).length,
      stale: mine.filter(function (t) { return t.quiet != null && t.quiet > 30; }).length,
      owners: [staffId]
    });
  });
  named.sort(function (a, b) { return b.days - a.days; });
  var un = all.unnamed.tasks.filter(function (t) { return t.owner === staffId; });
  return {
    ok: true, date: all.date,
    total: named.reduce(function (s, g) { return s + g.count; }, 0) + un.length,
    totalDays: named.reduce(function (s, g) { return s + g.days; }, 0),
    named: named,
    unnamed: { count: un.length, days: un.reduce(function (s, t) { return s + t.age; }, 0), tasks: un }
  };
}

/** Run from the editor for the branch picture in plain text. */
function waitingReport() {
  var w = sfkWaitingSafe_();
  if (!w.ok) { Logger.log('Salesforce not available: ' + (w.error || w.reason)); return; }

  var out = ['The branch is waiting on ' + w.named.length + ' named people across ' +
             w.total + ' tasks, carrying ' + w.totalDays + ' days.', ''];
  w.named.slice(0, 15).forEach(function (g) {
    out.push(pad_(g.name, 30) + pad_(g.count + ' tasks', 11) + pad_(g.days + ' days', 12) +
             'oldest ' + g.oldest + 'd' +
             (g.noReason ? ', ' + g.noReason + ' with no reason' : '') +
             (g.stale ? ', ' + g.stale + ' unchased over a month' : ''));
  });
  if (w.unnamed.count) {
    out.push('', w.unnamed.count + ' waiting task(s) name nobody at all (' +
             w.unnamed.days + ' days). A task cannot be chased if the person to ' +
             'chase was never recorded.');
  }
  var msg = out.join('\n');
  Logger.log(msg);
  return msg;
}

function pad_(s, n) {
  s = String(s);
  while (s.length < n) s += ' ';
  return s;
}
