/**
 * ===================================================================
 *  THE DESK — the branch's daily accountability engine
 *  A second file in the Branch Meeting Builder project, beside
 *  Meetings.gs. It needs every helper in that file (readTab_,
 *  requireUser_, factFindFeed_, goalFeed_, people_), so it is pasted
 *  into the same project and never stands alone.
 * ===================================================================
 *
 *  WHY IT EXISTS. Asked for on 17 October 2026, in these words: the
 *  branch already has a daily KPI tracker that pulls tasks from
 *  Salesforce, a fact find system that holds every advisor's goals and
 *  every client's reminders, and a meeting app. What it did not have
 *  was anything that read all of them together and said what needed to
 *  be heard. "The agents actually account for the day where it's
 *  automatically logged into the FactFind 360 degrees because no one is
 *  logging, no one is saying anything, yet these things are piled up
 *  there." And: "each of them, we single out what topic they are going
 *  to talk for the meeting on."
 *
 *  So this file does four things and nothing else:
 *
 *   1. READS the five sources, each one allowed to be absent.
 *   2. ROUTES what cannot wait to the person whose work it is.
 *   3. SINGLES OUT one topic per person for the Wednesday meeting,
 *      with the evidence under it, so nobody arrives wondering what
 *      they are being asked about.
 *   4. REPORTS, daily and at the end of the week, what the numbers
 *      actually say — including when they say nothing happened.
 *
 *  WHAT WAS MEASURED BEFORE IT WAS WRITTEN (17 October 2026, live):
 *
 *   Salesforce  399 open tasks across six staff; 123 overdue; only 17
 *               with no due date at all. 116 applications have sat in
 *               the pipeline over 120 days — 41 underwriting
 *               incomplete, 30 missing requirements.
 *   Fact finds  21 in the review queue, 18 of them past the three-day
 *               standard, the oldest 37 days. 131 filed this year.
 *   The gap     API recommended this year 3.17m; API actually picked
 *               up 152.6k. That is 4.8%. Nothing else the branch
 *               reports puts those two numbers side by side, and it is
 *               the single most important figure in this file.
 *   Logging     The fact find day feed read 0 for every role on the
 *               afternoon this was written: advisor 0, manager 0,
 *               BMA 0. That is the "no one is logging" in a number.
 *
 *  THE ONE STRUCTURAL FACT THAT SHAPES EVERYTHING HERE: no agent owns
 *  a single Salesforce task. Every task owner in the branch is staff.
 *  So staff accountability can be read off Salesforce and an agent's
 *  cannot — an agent's day is in the fact find system and in their
 *  production, and if this file asked Salesforce about an agent it
 *  would report an empty desk for someone who had worked all week.
 *  Never route an agent a task count.
 *
 *  WHAT IT WILL NOT DO. It does not score people against each other.
 *  A topic is a question with its working shown, never a rank, because
 *  the point is that the person can answer it. Personal time logged in
 *  ACTIVITY.PRIVATE_GROUPS is counted for the branch and stripped from
 *  every per-person figure, exactly as activityStats_ does it — take
 *  that out and the honest logging stops.
 *
 *  INSTALL
 *   1. Paste this file into the Branch Meeting Builder project.
 *   2. Script Properties:
 *        FACTFIND_WALL_URL    the fact find /exec (already public in
 *                             factfind360.com/wall)
 *        FACTFIND_WALL_KEY    the wall key (likewise public there)
 *        FACTFIND_GOAL_TOKEN  a branch sign-in token — the flight
 *                             plans are gated, there is no public key
 *        SF_KEY, SF_SECRET, SF_LOGIN_URL   copied from the KPI Tracker
 *        DESK_TO              who the manager's report goes to
 *   3. Run accSetup() once. It builds the tabs and installs the
 *      triggers.
 *   4. Deploy -> Manage deployments -> pencil -> New version.
 *
 *  Each source is optional. With none of them set the desk still opens
 *  and says, source by source, what is missing and what to paste —
 *  which is better than a screen of zeros that reads like a quiet week.
 * =================================================================== */

var ACC = {
  TAB_ROUTE: 'Routed Items',
  TAB_BLOCKS: 'Day Blocks',
  TAB_CLOSE: 'Close Offs',
  TAB_TOPIC: 'Meeting Topics',
  TAB_FIND:  'Findings',

  /*  Who the manager's report goes to. Blank = the script owner, so a
   *  fresh install mails itself rather than nobody. */
  PROP_TO: 'DESK_TO',

  /*  An agent who has filed no fact find in this many days is asked
   *  why. Five working days is a week of selling with nothing to show
   *  for it, and the flight plan assumes more than one a week, so this
   *  is already generous. */
  QUIET_DAYS: 5,

  /*  The fact find review standard the branch set itself. 18 of the 21
   *  in the queue were past it when this was written. */
  REVIEW_DAYS: 3,

  /*  A reviewer holding this many is routed whatever their median says.
   *  Five is a day's reading, and an advisor cannot sell a case that is
   *  sitting in a queue. */
  QUEUE_ROUTE: 5,

  /*  An application older than this is stuck, not pending. 116 of them
   *  on 17 October 2026. */
  STUCK_DAYS: 120,

  /*  A task nobody has touched in this long is not being worked. */
  UNTOUCHED_DAYS: 14,

  /*  The morning routing note and the evening close-off ask. Working
   *  days only: a note on a Saturday teaches people to ignore notes. */
  MORNING_HOUR: 7,
  EVENING_HOUR: 16,

  /*  THE MANAGER'S REPORT GOES AT FIVE IN THE MORNING, because that is
   *  when his day starts: his KPI1 block on the tracker runs 5 to 10am,
   *  recruitment, licensing and staffing. A report at the end of the
   *  previous day is a report read the next morning anyway, and one
   *  written for five is one that opens the day it is about.
   *
   *  Apps Script fires a time trigger within the hour, so this is the
   *  five o'clock hour and not five exactly. */
  REPORT_HOUR: 5,

  /*  The long one on Monday, an hour before the first desk comes in. */
  WEEKLY_DAY: 1,
  WEEKLY_HOUR: 5,

  /*  A finding already sent is not news. The Findings tab remembers
   *  what went and on which day, so the report leads on what changed.*/
  FIND_REPEAT_DAYS: 7,

  CACHE_SEC: 600,

  /*  Nothing client-facing here, but the routing e-mails carry client
   *  names and policy numbers, so every one of them says so. */
  INTERNAL: 'Internal — do not forward outside the branch.'
};

/*  The desk's four tabs. They are registered into SCHEMA — the meeting
 *  app's own table — at load, so tab_() and readTab_() can build them on
 *  first use and there is exactly one tab maker in the project. Without
 *  this, every read of a desk tab before accSetup() has been run throws,
 *  which is precisely what a trigger does at seven in the morning after
 *  a paste somebody forgot to follow with a setup. */
var ACC_HEAD = {};
ACC_HEAD[ACC.TAB_ROUTE] = ['When', 'Day', 'Kind', 'Ref', 'What', 'Why now',
                           'Age days', 'To', 'To email', 'Role', 'Source',
                           'Status', 'Closed on', 'Note'];
ACC_HEAD[ACC.TAB_CLOSE] = ['When', 'Day', 'Week', 'Period', 'Email', 'Name',
                           'Role', 'Unit', 'Done', 'Blocked', 'Help needed',
                           'Numbers', 'Device'];
ACC_HEAD[ACC.TAB_TOPIC] = ['When', 'Meeting ID', 'Email', 'Name', 'Role', 'Unit',
                           'Topic', 'Question', 'Evidence', 'Figure', 'Source',
                           'Rank', 'Spoke', 'Note'];
ACC_HEAD[ACC.TAB_FIND] = ['When', 'Day', 'Key', 'Severity', 'Heading', 'Finding',
                          'Figure', 'Source', 'Who', 'Sent', 'Note'];
ACC_HEAD[ACC.TAB_BLOCKS] = ['Staff Id', 'Name', 'Hours', 'Lunch', 'Block', 'Time',
                            'Focus', 'KPI', 'Due by', 'Task type', 'Active'];

(function () {
  if (typeof SCHEMA === 'undefined') return;        /* pasted alone: nothing to do */
  Object.keys(ACC_HEAD).forEach(function (name) {
    if (!SCHEMA[name]) SCHEMA[name] = ACC_HEAD[name];
  });
})();

/* ===================================================================
 *  SALESFORCE
 *
 *  The same connected app the KPI Tracker uses. Client credentials:
 *  the org retired the username-password flow, so SF_PASS is not set
 *  and must not be. Modelled on ServiceSalesforce.gs, with its own
 *  property names for the cached token so two projects in two
 *  containers never fight over one cache entry.
 * =================================================================== */

var ACCSF = { API: 'v61.0', LOGIN: 'https://login.salesforce.com', TOKEN_MIN: 50 };

function accSfReady_() {
  var p = PropertiesService.getScriptProperties();
  return !!(p.getProperty('SF_KEY') && p.getProperty('SF_SECRET'));
}

function accSfToken_() {
  var p = PropertiesService.getScriptProperties();
  var cached = p.getProperty('ACC_SF_TOKEN'), when = Number(p.getProperty('ACC_SF_TOKEN_AT') || 0);
  if (cached && (new Date().getTime() - when) < ACCSF.TOKEN_MIN * 60 * 1000) {
    try { return JSON.parse(cached); } catch (e) { /* fall through and re-login */ }
  }
  var login = String(p.getProperty('SF_LOGIN_URL') || ACCSF.LOGIN).trim().replace(/\/+$/, '');
  var res = UrlFetchApp.fetch(login + '/services/oauth2/token', {
    method: 'post', muteHttpExceptions: true,
    payload: { grant_type: 'client_credentials',
               client_id: p.getProperty('SF_KEY'),
               client_secret: p.getProperty('SF_SECRET') }
  });
  if (res.getResponseCode() !== 200) {
    throw new Error('Salesforce login failed: ' + res.getContentText());
  }
  var tok = JSON.parse(res.getContentText());
  p.setProperty('ACC_SF_TOKEN', JSON.stringify(tok));
  p.setProperty('ACC_SF_TOKEN_AT', String(new Date().getTime()));
  return tok;
}

/** One SOQL query, every page of it. Returns [] on anything that is
 *  not a clean answer: a desk that cannot reach Salesforce must still
 *  open and say so, not throw into a trigger nobody is watching. */
function accSfQuery_(soql) {
  var tok = accSfToken_(), out = [], url =
    tok.instance_url + '/services/data/' + ACCSF.API + '/query?q=' + encodeURIComponent(soql);
  for (var guard = 0; guard < 25 && url; guard++) {
    var res = UrlFetchApp.fetch(url, {
      muteHttpExceptions: true, headers: { Authorization: 'Bearer ' + tok.access_token } });
    if (res.getResponseCode() === 401 && guard === 0) {
      PropertiesService.getScriptProperties().deleteProperty('ACC_SF_TOKEN');
      tok = accSfToken_();
      continue;
    }
    if (res.getResponseCode() !== 200) {
      throw new Error('Salesforce query failed: ' + res.getContentText().slice(0, 400));
    }
    var d = JSON.parse(res.getContentText());
    out = out.concat(d.records || []);
    url = d.nextRecordsUrl ? tok.instance_url + d.nextRecordsUrl : '';
  }
  return out;
}

/* ===================================================================
 *  THE FIVE SOURCES
 *
 *  Each one returns { live: true, ... } or { live: false, why: '...' }
 *  and NEVER throws. A desk that falls over because one source is down
 *  is a desk nobody opens on the morning it matters. The `why` is
 *  written for the branch manager to act on — it names the property to
 *  set, not the exception.
 *
 *  Each is cached for ten minutes. The morning note, the evening ask,
 *  the manager's report and the meeting agenda all read the same
 *  snapshot, so three screens never disagree about the same morning.
 * =================================================================== */

function accCached_(key, build) {
  var cache = CacheService.getScriptCache();
  var hit = cache.get('acc.' + key);
  if (hit) { try { return JSON.parse(hit); } catch (e) { /* rebuild */ } }
  var out = build();
  try { cache.put('acc.' + key, JSON.stringify(out), ACC.CACHE_SEC); }
  catch (e) { /* over 100 KB: serve it uncached rather than lose it */ }
  return out;
}

/* ----------------------------- 1. TASKS ----------------------------- */

/*  THE DESK, FROM SALESFORCE. Staff only, and the file says why in its
 *  header: no agent owns a task in this org, so an agent's task count
 *  is always zero and reporting it would libel a working week.
 *
 *  Four states worth separating, measured 17 October 2026:
 *    open      399
 *    overdue   123, and 56 of them on one desk
 *    waiting   133 "Waiting on someone else" — a third of every open
 *              task in the branch, and nothing anywhere says who is
 *              being waited on or since when. That is the finding the
 *              branch has never seen.
 *    no date   17. Low, and worth keeping low: a task with no due date
 *              cannot be overdue, so it is the one way work leaves the
 *              system quietly.                                        */
function accTasks_() {
  return accCached_('tasks', function () {
    if (!accSfReady_()) {
      return { live: false, why: 'Salesforce is not linked. Copy SF_KEY, SF_SECRET and ' +
                                 'SF_LOGIN_URL from the KPI Tracker into this project.' };
    }
    try {
      var rows = accSfQuery_(
        'SELECT Id, Subject, Status, Priority, ActivityDate, LastModifiedDate, CreatedDate, ' +
        'Owner.Name, Task_Type__c, WhatId, WhoId ' +
        'FROM Task WHERE IsClosed = false LIMIT 2000');

      /*  What each desk CLOSED today, by the branch's own task type, so
       *  a day block for pendings can say how many pendings moved
       *  without anybody typing a number. Task_Type__c is the branch's
       *  field and it is what the KPI tracker's blocks are keyed on. */
      var closedToday = [];
      try {
        closedToday = accSfQuery_(
          'SELECT Owner.Name, Task_Type__c, COUNT(Id) n FROM Task ' +
          'WHERE IsClosed = true AND LastModifiedDate = TODAY ' +
          'GROUP BY Owner.Name, Task_Type__c');
      } catch (e) { closedToday = []; }           /* a nice-to-have, never a blocker */

      var byTypeFor = {};
      closedToday.forEach(function (r) {
        var who = accLow_((r.Owner || {}).Name);
        var ty = accStr_(r.Task_Type__c);
        if (!who || !ty) return;
        if (!byTypeFor[who]) byTypeFor[who] = {};
        byTypeFor[who][ty] = accNum_(r.n || r.expr0);
      });

      var today = accDayKey_(new Date()), by = {};
      var tot = { open: 0, overdue: 0, waiting: 0, nodate: 0, untouched: 0, escalated: 0 };

      rows.forEach(function (t) {
        var who = accStr_((t.Owner || {}).Name) || 'Unassigned';
        if (!by[who]) {
          by[who] = { name: who, open: 0, overdue: 0, waiting: 0, nodate: 0,
                      untouched: 0, escalated: 0, oldestDays: 0, oldestSubject: '' };
        }
        var P = by[who], due = accStr_(t.ActivityDate), st = accStr_(t.Status);
        P.open++; tot.open++;

        if (!due) { P.nodate++; tot.nodate++; }
        else if (due < today) {
          P.overdue++; tot.overdue++;
          var age = accDaysBetween_(due, today);
          if (age > P.oldestDays) { P.oldestDays = age; P.oldestSubject = accStr_(t.Subject); }
        }
        if (/waiting on someone/i.test(st)) { P.waiting++; tot.waiting++; }
        if (/escalat/i.test(st)) { P.escalated++; tot.escalated++; }

        var touched = accDaysBetween_(accDayKey_(new Date(t.LastModifiedDate)), today);
        if (touched >= ACC.UNTOUCHED_DAYS) { P.untouched++; tot.untouched++; }
      });

      var people = Object.keys(by).map(function (k) { return by[k]; })
        .sort(function (a, b) { return b.overdue - a.overdue || b.open - a.open; });

      return { live: true, total: tot, people: people, counted: rows.length,
               byTypeFor: byTypeFor };
    } catch (err) {
      return { live: false, why: 'Salesforce would not answer: ' + accShortErr_(err) };
    }
  });
}

/* --------------------------- 2. THE PIPELINE --------------------------- */

/*  WHAT IS STUCK, AND WHAT IT IS WORTH. This is the number the branch
 *  has never had in one place. On 17 October 2026: 197 applications
 *  older than 120 days, carrying TT$3,448,693 of API between them —
 *  against API actually picked up this year of TT$152,626. The whole
 *  year's shortfall is sitting in a queue.
 *
 *  AgentName__c and Agent_Support_Owner__c are formula fields, so
 *  Salesforce refuses to GROUP BY them: the grouping is done here,
 *  over the rows. Agent_Support_Owner__c is the routing key — every
 *  pending case already names the staff member supporting it, which is
 *  how an item reaches the right desk without anyone deciding.
 *
 *  Client names and policy numbers come back in these rows. They are
 *  written to the Routed Items tab and into one internal e-mail, and
 *  they appear nowhere else — never in a count, never in a finding,
 *  never in this file.                                                 */
var ACC_PENDING = ['%nderwriting%', '%Reqt%', '%ostpone%', '%waiting Settlement%', 'Pending%'];

function accPipeline_() {
  return accCached_('pipe', function () {
    if (!accSfReady_()) {
      return { live: false, why: 'Salesforce is not linked, so the pipeline cannot be read.' };
    }
    try {
      var where = ACC_PENDING.map(function (p) {
        return "Policy_Status_Description__c LIKE '" + p + "'";
      }).join(' OR ');

      var rows = accSfQuery_(
        'SELECT Id, POLICY__c, FIRST_NAME__c, LAST_NAME__c, Policy_Status_Description__c, ' +
        'App_Received_Date__c, Date_Submitted__c, Total_API__c, AgentName__c, Agent_First_Name__c, ' +
        'Agent_Support_Owner__c, Requirements_O_S__c, Days_O_S__c, PLAN_NAME__c ' +
        'FROM CLIENT_PORTFOLIO__c WHERE (' + where + ') ' +
        'AND App_Received_Date__c != null ORDER BY App_Received_Date__c ASC LIMIT 2000');

      var today = accDayKey_(new Date());
      var stuck = [], byAgent = {}, bySupport = {}, byStatus = {};
      var tot = { all: 0, stuck: 0, api: 0, stuckApi: 0 };

      rows.forEach(function (r) {
        var days = accDaysBetween_(accStr_(r.App_Received_Date__c), today);
        var api = accNum_(r.Total_API__c);
        tot.all++; tot.api += api;
        if (days < ACC.STUCK_DAYS) return;

        tot.stuck++; tot.stuckApi += api;
        var agent = accAgentName_(r.AgentName__c);
        var sup = accStr_(r.Agent_Support_Owner__c) || 'nobody named';
        var st = accStr_(r.Policy_Status_Description__c) || 'no status';

        accBump_(byAgent, agent, days, api);
        accBump_(bySupport, sup, days, api);
        accBump_(byStatus, st, days, api);

        stuck.push({
          policy: accStr_(r.POLICY__c),
          client: accStr_(r.FIRST_NAME__c) + ' ' + accStr_(r.LAST_NAME__c),
          status: st, days: days, api: api, agent: agent, support: sup,
          reqs: accStr_(r.Requirements_O_S__c), plan: accStr_(r.PLAN_NAME__c)
        });
      });

      return {
        live: true, total: tot,
        stuck: stuck.sort(function (a, b) { return b.days - a.days; }),
        byAgent: accRank_(byAgent), bySupport: accRank_(bySupport),
        byStatus: accRank_(byStatus),
        oldestDays: stuck.length ? stuck[0].days : 0
      };
    } catch (err) {
      return { live: false, why: 'Salesforce would not answer: ' + accShortErr_(err) };
    }
  });
}

function accBump_(map, key, days, api) {
  if (!map[key]) map[key] = { name: key, n: 0, api: 0, oldest: 0 };
  map[key].n++; map[key].api += api;
  if (days > map[key].oldest) map[key].oldest = days;
}

function accRank_(map) {
  return Object.keys(map).map(function (k) { return map[k]; })
    .sort(function (a, b) { return b.api - a.api || b.n - a.n; });
}

/*  "A00000 - Firstname Surname" is how AgentName__c is written. The number is
 *  the join to the Agent Skill Bank; the name is what a person reads.
 *  Both are kept, because an agent who has left still owns old rows and
 *  the number is the only thing that tells them apart. */
function accAgentName_(v) {
  var s = accStr_(v);
  if (!s) return 'no agent on the record';
  return s.replace(/^A?\d+\s*[-–]\s*/, '').trim() || s;
}
function accAgentNo_(v) {
  var m = accStr_(v).match(/^(A?\d+)/);
  return m ? m[1] : '';
}

/* ------------------------- 3. THE FACT FINDS ------------------------- */

/*  The wall, reshaped for the desk. factFindFeed_ lives in Meetings.gs
 *  and is already cached there; this adds the three readings the desk
 *  needs and nothing the meeting app already shows.
 *
 *  THE CONVERSION IS THE POINT. apiRec against pickedUp — recommended
 *  against actually written — was 3,168,518 against 152,626 on 17
 *  October 2026. 4.8%. Every other board in the branch reports one of
 *  those two numbers without the other.                                */
function accFactFind_() {
  return accCached_('ff', function () {
    var d = null;
    try { d = factFindFeed_(); } catch (e) { d = null; }
    if (!d) {
      return { live: false, why: 'The fact find wall needs FACTFIND_WALL_URL and ' +
                                 'FACTFIND_WALL_KEY in Script Properties. Both are already ' +
                                 'public inside factfind360.com/wall.' };
    }
    var y = d.year || {}, rec = accNum_(y.api), got = accNum_(y.pickedUp);
    var q = d.queue || {};

    /*  Who filed what, and when each last filed. The wall gives this
     *  year, this month and this week separately; the desk wants the
     *  last filing date per person, which is what "quiet for five days"
     *  is measured from. series carries the branch's days, not a
     *  person's, so a person's quiet is read off their own counts. */
    var last = {};
    (d.yearLeaders || []).forEach(function (a) {
      last[accStr_(a.name)] = { year: accNum_(a.count), apiRec: accNum_(a.apiRec),
                                pickedUp: accNum_(a.pickedUp), apps: accNum_(a.apps),
                                pipeline: accNum_(a.pipeline), month: 0, week: 0 };
    });
    (d.monthLeaders || []).forEach(function (a) {
      var k = accStr_(a.name);
      if (!last[k]) last[k] = { year: 0, apiRec: 0, pickedUp: 0, apps: 0, pipeline: 0, month: 0, week: 0 };
      last[k].month = accNum_(a.count);
    });
    (d.leaders || []).forEach(function (a) {
      var k = accStr_(a.name);
      if (!last[k]) last[k] = { year: 0, apiRec: 0, pickedUp: 0, apps: 0, pipeline: 0, month: 0, week: 0 };
      last[k].week = accNum_(a.count);
    });

    var agents = Object.keys(last).map(function (k) {
      var a = last[k];
      a.name = k;
      a.conversion = a.apiRec ? Math.round(a.pickedUp / a.apiRec * 1000) / 10 : null;
      return a;
    }).sort(function (a, b) { return b.year - a.year; });

    /*  The day's logging, by role. This is the "no one is logging" the
     *  request named, as a number: on the afternoon this was written it
     *  read 0 for advisors, 0 for managers and 0 for the BMA. */
    var day = d.day || {}, roles = day.roles || {};

    return {
      live: true,
      asOf: accStr_(d.asOf),
      today: d.today || {}, week: d.week || {}, month: d.month || {},
      year: { submitted: accNum_(y.submitted), need: accNum_(y.need), cover: accNum_(y.cover),
              apiRec: rec, pickedUp: got,
              conversion: rec ? Math.round(got / rec * 1000) / 10 : null },
      queue: { pending: accNum_(q.pending), breaching: accNum_(q.breaching),
               oldestDays: accNum_(q.oldestDays), oldestWho: accStr_(q.oldestWho) },
      reviewers: (d.managerPerf || []).map(function (m) {
        return { name: accStr_(m.name), pending: accNum_(m.pending),
                 approved: accNum_(m.approved), returned: accNum_(m.returned),
                 medianDays: accNum_(m.medianDays), returnRate: accNum_(m.returnRate) };
      }),
      agents: agents,
      logging: { total: accNum_(day.total), advisor: accNum_(roles.advisor),
                 manager: accNum_(roles.manager), bma: accNum_(roles.bma),
                 client: accNum_(roles.client), clock: accStr_(day.clock) },
      production: d.production || {},
      series: d.series || [],
      weekend: d.weekend || {},
      justIn: d.justIn || null
    };
  });
}

/* --------------------------- 4. THE GOALS --------------------------- */

/*  The flight plans: income need -> FYC -> API -> apps a year -> apps a
 *  week -> FACT FINDS a week -> appointments -> contacts. So "you owe
 *  four fact finds this week" is arithmetic off what that person said
 *  their own year has to pay for, which is the only version of a target
 *  anybody argues with less than once.
 *
 *  This is the one source with no public key: every goal action on the
 *  fact find backend refuses a session it does not know, which is
 *  correct — the plans carry what each advisor says they need to earn.
 *  So it needs FACTFIND_GOAL_TOKEN, and until that is set the desk says
 *  so rather than guessing a target.                                   */
function accGoals_() {
  return accCached_('goals', function () {
    var d = null;
    try { d = goalFeed_(); } catch (e) { d = null; }
    if (!d) {
      return { live: false, why: 'The flight plans need FACTFIND_GOAL_TOKEN in Script ' +
                                 'Properties — a branch sign-in token. The goal wall has no ' +
                                 'public key, by design.' };
    }
    var lanes = (d.lanes || []).map(function (p) {
      return { name: accStr_(p.name), pct: accNum_(p.pct), done: !!p.done,
               streak: accNum_(p.streak), rank: accNum_(p.rank),
               owed: accNum_(p.owed || p.target), filed: accNum_(p.filed || p.actual) };
    });
    return {
      live: true,
      week: d.week || {}, filed: accNum_((d.week || {}).filed),
      lanes: lanes,
      firstOff: d.firstOff || [],
      finishers: d.finishers || [],
      noPlan: (d.noPlan || []).map(function (p) { return accStr_(p.name || p); })
    };
  });
}

/* ------------------------- 5. THE REMINDERS ------------------------- */

/*  HOW MANY REMINDERS WENT OUT. Asked for in those words. The fact find
 *  backend holds the client journey behind a session token, but the
 *  flags that drive the reminders are on the policy record itself, so
 *  Salesforce answers this one without a session:
 *
 *    Send_Email_Premium_Due_Reminder__c   the standing reminder flag
 *    Send_Auto_Email_Premium_Due__c       the automatic one
 *    Of_Premiums_Due__c                   how many are owed
 *    Days_Premium_Outstanding__c          how long
 *
 *  Which also answers the harder question underneath it: how many
 *  clients are behind and have NO reminder set at all. A reminder count
 *  on its own flatters; the gap is the finding.                        */
function accReminders_() {
  return accCached_('rem', function () {
    if (!accSfReady_()) {
      return { live: false, why: 'Salesforce is not linked, so the reminders cannot be counted.' };
    }
    try {
      var on = accSfQuery_(
        'SELECT COUNT(Id) n FROM CLIENT_PORTFOLIO__c ' +
        'WHERE (Send_Email_Premium_Due_Reminder__c = true OR Send_Auto_Email_Premium_Due__c = true)');
      var due = accSfQuery_(
        'SELECT COUNT(Id) n FROM CLIENT_PORTFOLIO__c ' +
        'WHERE Of_Premiums_Due__c > 0 AND Policy_Status_Description__c LIKE \'%remium%aying%\'');
      var quiet = accSfQuery_(
        'SELECT COUNT(Id) n FROM CLIENT_PORTFOLIO__c ' +
        'WHERE Of_Premiums_Due__c > 0 AND Policy_Status_Description__c LIKE \'%remium%aying%\' ' +
        'AND Send_Email_Premium_Due_Reminder__c = false AND Send_Auto_Email_Premium_Due__c = false');

      var n = function (r) { return r && r.length ? accNum_(r[0].n || r[0].expr0) : 0; };
      return { live: true, set: n(on), behind: n(due), noReminder: n(quiet),
               note: 'The Premium Due Desk sends the letters; these are the flags on the record.' };
    } catch (err) {
      return { live: false, why: 'Salesforce would not answer: ' + accShortErr_(err) };
    }
  });
}

/* ------------------------ small helpers ------------------------ */

/*  Deliberately its own set, prefixed acc*. Meetings.gs has str_ and
 *  num_ and this file is pasted beside it, but a harness runs this file
 *  alone and a second definition of a one-line helper is cheaper than a
 *  load order nobody can see. */
function accStr_(v) { return v === undefined || v === null ? '' : String(v).trim(); }
function accNum_(v) { var n = Number(v); return isNaN(n) ? 0 : n; }
function accLow_(v) { return accStr_(v).toLowerCase(); }

/*  tz_() is Meetings.gs's, so the desk and the meeting app can never
 *  disagree about which day it is — which they would on a date near
 *  midnight if this file carried its own idea of the timezone. */
function accTz_() {
  try { return tz_(); } catch (e) { return 'America/Port_of_Spain'; }
}

function accDayKey_(d) {
  if (!d || isNaN(d.getTime && d.getTime())) return '';
  return Utilities.formatDate(d, accTz_(), 'yyyy-MM-dd');
}

/** Whole days between two yyyy-MM-dd keys. Dates, not timestamps, so a
 *  figure never moves because a query ran at a different hour. */
function accDaysBetween_(from, to) {
  if (!from || !to) return 0;
  var a = new Date(from + 'T00:00:00'), b = new Date(to + 'T00:00:00');
  if (isNaN(a.getTime()) || isNaN(b.getTime())) return 0;
  return Math.round((b - a) / 86400000);
}

function accShortErr_(err) {
  var s = accStr_(err && err.message ? err.message : err);
  return s.length > 180 ? s.slice(0, 180) + '…' : s;
}

function accMoney_(n) {
  n = Math.round(accNum_(n));
  return 'TT$' + String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** Monday-of-week key, so a week close-off lands in one bucket. */
function accWeekKey_(d) {
  var x = new Date(d.getTime());
  x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
  return accDayKey_(x);
}

function accIsWorkingDay_(d) { var w = d.getDay(); return w >= 1 && w <= 5; }

/* ===================================================================
 *  ROUTING — what cannot wait, to the desk whose work it is
 *
 *  The rule that makes this safe to run unattended: AN ITEM IS ROUTED
 *  ONCE, EVER. The Routed Items tab is keyed on Kind + Ref, and a run
 *  that finds a key already there writes nothing. Without that, a
 *  trigger every morning would mail the same desk the same hundred
 *  applications every day for a month, which is how a branch learns to
 *  filter the engine into a folder.
 *
 *  An item CLOSES when the condition behind it clears — the application
 *  settles, the fact find leaves the queue, the reminder is set. It is
 *  closed by the next run, not by anyone remembering, and the closing
 *  run stamps the day so the report can say how long it took.
 *
 *  WHO GETS WHAT
 *    a stuck application   -> the support person already named on the
 *                             case (Agent_Support_Owner__c), because
 *                             the record knows and nobody has to decide
 *    a fact find past the
 *    review standard       -> the reviewer holding it
 *    a client behind with
 *    no reminder set       -> sales support
 *    a fact find returned  -> the agent it went back to
 *
 *  An overdue Salesforce task is NOT routed. It already has an owner,
 *  and routing a task to the person who owns it is how an engine
 *  teaches people it is not reading anything.
 * =================================================================== */

var ACC_KINDS = {
  stuck:   { label: 'Application stuck', role: 'staff' },
  review:  { label: 'Fact find waiting on review', role: 'manager' },
  noremind:{ label: 'Behind with no reminder set', role: 'staff' },
  returned:{ label: 'Fact find returned', role: 'agent' },
  quiet:   { label: 'No fact find filed', role: 'agent' }
};

/** Everything already routed, as { 'kind|ref': row }. One read. */
function accRouted_() {
  var out = {};
  readTab_(ACC.TAB_ROUTE).forEach(function (r) {
    out[accStr_(r['Kind']) + '|' + accStr_(r['Ref'])] = r;
  });
  return out;
}

/*  Who in the branch does this kind of work. Read off the People tab,
 *  so adding a person to the meeting app is the only place anybody has
 *  to be named. A kind with nobody behind it goes to the manager, with
 *  the gap said out loud in the report — never dropped. */
function accDeskFor_(kind, people, hint) {
  var want = (ACC_KINDS[kind] || {}).role || 'staff';
  var h = accLow_(hint);

  /*  A name on the record wins over a role. Agent_Support_Owner__c
   *  holds a bare first name, which is how the branch
   *  writes it, so a first name that exactly one active person carries
   *  is that person. Two people with one first name and neither is
   *  taken: the role decides instead, and the report says so. */
  if (h) {
    var hits = people.filter(function (p) {
      return p.active && (accLow_(p.name) === h ||
             accLow_(p.name).split(/\s+/)[0] === h || accLow_(p.email) === h);
    });
    if (hits.length === 1) return hits[0];
  }
  var role = people.filter(function (p) { return p.active && p.role === want; });
  if (role.length === 1) return role[0];
  if (role.length > 1) {
    /*  More than one desk does this work, so it goes to the lightest
     *  list — counted as the pass goes, exactly as the assignment board
     *  spreads what is left round the roster. */
    role.sort(function (a, b) { return (a._routed || 0) - (b._routed || 0); });
    return role[0];
  }
  return people.filter(function (p) { return p.active && p.role === 'manager'; })[0] || null;
}

/** The whole routing pass. Returns what it did, for the report. */
function accRoute_(S) {
  S = S || accSnapshot_();
  var people = readPeople_().map(function (p) { p._routed = 0; return p; });
  var done = accRouted_(), now = new Date(), day = accDayKey_(now);
  var add = [], closed = 0, open = {};

  function want(kind, ref, what, why, age, hint) {
    var key = kind + '|' + ref;
    open[key] = true;
    if (done[key]) return;
    var to = accDeskFor_(kind, people, hint);
    if (to) to._routed = (to._routed || 0) + 1;
    add.push({
      'When': now, 'Day': day, 'Kind': kind, 'Ref': ref,
      'What': what, 'Why now': why, 'Age days': age,
      'To': to ? to.name : '', 'To email': to ? to.email : '',
      'Role': (ACC_KINDS[kind] || {}).role || '',
      'Source': kind === 'review' || kind === 'returned' || kind === 'quiet'
                ? 'Fact finds' : 'Salesforce',
      'Status': 'Open', 'Closed on': '', 'Note': ''
    });
  }

  /*  1. The stuck applications, worth the most API first. Only the top
   *  of the list is routed in any one pass: 197 items in one morning is
   *  not a worklist, it is a wall. ROUTE_MAX a run, oldest money first,
   *  and the rest are named as a count in the report so nothing hides. */
  if (S.pipe.live) {
    S.pipe.stuck.slice(0, 40).forEach(function (a) {
      want('stuck', a.policy || (a.client + '|' + a.days),
           a.client + ' — ' + (a.plan || 'policy') + ' ' + (a.policy || ''),
           a.status + ', ' + accMoney_(a.api) + ' API' +
             (a.reqs ? ', outstanding: ' + a.reqs : ''),
           a.days, a.support);
    });
  }

  /*  2. The review queue. The wall gives the holder and the oldest; a
   *  queue past the branch's own three-day standard is the reviewer's
   *  item, and on 17 October 2026 eighteen of twenty-one were. */
  if (S.ff.live) {
    /*  ROUTED ON THE QUEUE, NOT ON THE MEDIAN. Both reviewers' medians
     *  read better than the three-day standard on 17 October 2026 —
     *  2.2 days and 1.4 days — while twenty-one fact finds sat waiting
     *  and the oldest had waited thirty-seven. A median that good with
     *  a tail that long is a median hiding a queue, so a median test
     *  alone would have routed nothing on the worst day the queue has
     *  had. The count is what routes it; the median goes in the reason
     *  so the reviewer can see both. */
    S.ff.reviewers.forEach(function (m) {
      if (m.pending < ACC.QUEUE_ROUTE && m.medianDays < ACC.REVIEW_DAYS) return;
      want('review', m.name,
           m.pending + ' fact find' + (m.pending === 1 ? '' : 's') + ' waiting on ' + m.name,
           'Median ' + m.medianDays + ' days against our ' + ACC.REVIEW_DAYS +
             '-day standard' +
             (S.ff.queue.oldestDays ? ', and the branch\'s oldest has waited ' +
              S.ff.queue.oldestDays + ' days' : ''),
           m.pending, m.name);
    });
  }

  /*  3. Clients behind with nothing set to chase them. A count, not a
   *  list: the Premium Due Desk owns the letters and the names, and two
   *  systems writing to one client is how a branch sends two letters. */
  if (S.rem.live && S.rem.noReminder > 0) {
    want('noremind', 'week-' + accWeekKey_(now),
         S.rem.noReminder + ' policies behind with no reminder set',
         'Of ' + S.rem.behind + ' behind, ' + S.rem.noReminder + ' have neither flag on',
         0, '');
  }

  /*  4. Agents who have filed nothing. The question is the point: not
   *  "you are behind" but "what is the plan for the week", which is
   *  what was asked for. */
  accQuietAgents_(S).forEach(function (a) {
    want('quiet', a.name + '|' + accWeekKey_(now),
         a.name + ' has filed no fact find',
         a.why, a.days, a.name);
  });

  if (add.length) appendRows_(ACC.TAB_ROUTE, add);

  /*  Close what has cleared. A row whose key is no longer wanted is
   *  done: the application settled, the queue drained, the flag went
   *  on. Stamped, never deleted — the report reads how long each took
   *  off these two dates. */
  readTab_(ACC.TAB_ROUTE).forEach(function (r) {
    if (accStr_(r['Status']) !== 'Open') return;
    var key = accStr_(r['Kind']) + '|' + accStr_(r['Ref']);
    if (open[key]) return;
    setCell_(ACC.TAB_ROUTE, r._row, 'Status', 'Cleared');
    setCell_(ACC.TAB_ROUTE, r._row, 'Closed on', day);
    closed++;
  });

  return { routed: add.length, cleared: closed, open: Object.keys(open).length,
           stuckTotal: S.pipe.live ? S.pipe.total.stuck : 0 };
}

/*  THE QUIET AGENTS. Asked for in these words: "If the agents have not
 *  done a fact find in days, what is the plan for more or less their
 *  days?"
 *
 *  Counted off the wall's own per-person counts rather than a date,
 *  because the wall gives the week, the month and the year per advisor
 *  and a filing date per advisor only for the newest one. So: nothing
 *  this week is quiet, nothing this month is quieter, and nothing this
 *  year is the one that needs a conversation rather than a nudge.
 *
 *  An agent with a flight plan is measured against their own number.
 *  An agent with none is measured against having filed at all, and the
 *  report names them as having no plan — which is its own finding, and
 *  the one the goal gate in GoalPlans.gs already acts on. */
function accQuietAgents_(S) {
  S = S || accSnapshot_();
  if (!S.ff.live) return [];

  var owed = {};
  if (S.goals.live) {
    S.goals.lanes.forEach(function (l) { owed[accStr_(l.name)] = l; });
  }
  var out = [];

  readPeople_().forEach(function (p) {
    if (!p.active || p.role !== 'agent') return;
    var a = null;
    for (var i = 0; i < S.ff.agents.length; i++) {
      if (accSameName_(S.ff.agents[i].name, p.name)) { a = S.ff.agents[i]; break; }
    }
    var week = a ? a.week : 0, month = a ? a.month : 0, year = a ? a.year : 0;
    if (week > 0) return;                         /* filed this week: not quiet */

    var lane = owed[p.name] || null;
    var why;
    if (!year) {
      why = 'Nothing filed this year.';
    } else if (!month) {
      why = 'Nothing this month. ' + year + ' fact find' + (year === 1 ? '' : 's') +
            ' this year, the last of them before this month began.';
    } else {
      why = 'Nothing this week. ' + month + ' fact find' + (month === 1 ? '' : 's') +
            ' this month.';
    }
    if (lane && lane.owed) {
      why += ' The flight plan asks for ' + lane.owed + ' a week.';
    } else if (S.goals.live) {
      why += ' No flight plan on file, so there is no number to measure against.';
    }
    out.push({ name: p.name, email: p.email, unit: p.unit,
               week: week, month: month, year: year,
               owed: lane ? lane.owed : 0, why: why,
               days: month ? 7 : (year ? 30 : 90) });
  });

  return out.sort(function (a, b) { return b.days - a.days; });
}

/*  Two spellings of one person. The fact find wall writes a name as the
 *  advisor typed it, the People tab as the branch typed it, and on this
 *  branch that is enough to miss a match: a married surname, a hyphen,
 *  a middle name. Same first name and a surname in common is the rule
 *  the assignment board already uses, so the two agree. */
function accSameName_(a, b) {
  var x = accLow_(a).replace(/[^a-z ]/g, ' ').split(/\s+/).filter(String);
  var y = accLow_(b).replace(/[^a-z ]/g, ' ').split(/\s+/).filter(String);
  if (!x.length || !y.length) return false;
  if (x.join(' ') === y.join(' ')) return true;
  if (x[0] !== y[0]) return false;
  for (var i = 1; i < x.length; i++) {
    if (y.indexOf(x[i]) > 0) return true;
  }
  return false;
}

/* ===================================================================
 *  CLOSING OFF THE DAY, AND THE WEEK
 *
 *  Three questions, because three is what gets answered. They are the
 *  same three the weekly check-in already asks on the flight plans, so
 *  a person answers one set of questions in one voice all week:
 *
 *      What got done?   What is in the way?   What help do you need?
 *
 *  WHAT MAKES THIS DIFFERENT FROM THE FORM NOBODY FILLED IN: the
 *  numbers are already in the box. A staff member closing off their day
 *  sees what Salesforce says they closed and what is still overdue; an
 *  agent sees what the fact find system logged for them. They are not
 *  asked to report a number the branch already has — they are asked
 *  what it means. That was the whole complaint behind "no one is
 *  logging": people will not retype what a system can see.
 *
 *  A day not closed off is a fact, recorded, and it appears in the
 *  manager's report as a count and never as a telling-off. The point is
 *  the Wednesday meeting: a week of closed-off days IS that person's
 *  agenda item, written by them, a line at a time.
 * =================================================================== */

/** What the box already knows about this person, so they do not type
 *  it. Numbers only — no opinion, nothing to agree or disagree with. */
function accNumbersFor_(person, S) {
  S = S || accSnapshot_();
  var out = [];

  if (person.role === 'agent') {
    if (S.ff.live) {
      var a = null;
      for (var i = 0; i < S.ff.agents.length; i++) {
        if (accSameName_(S.ff.agents[i].name, person.name)) { a = S.ff.agents[i]; break; }
      }
      out.push({ label: 'Fact finds this week', value: a ? a.week : 0 });
      out.push({ label: 'This month', value: a ? a.month : 0 });
      if (a && a.apiRec) {
        out.push({ label: 'API recommended this year', value: accMoney_(a.apiRec) });
        out.push({ label: 'API picked up', value: accMoney_(a.pickedUp) });
        out.push({ label: 'Of what you recommended',
                   value: (a.conversion === null ? '—' : a.conversion + '%') });
      }
    }
    if (S.goals.live) {
      for (var g = 0; g < S.goals.lanes.length; g++) {
        if (accSameName_(S.goals.lanes[g].name, person.name)) {
          out.push({ label: 'Your plan asks for, a week', value: S.goals.lanes[g].owed || '—' });
          break;
        }
      }
    }
    if (S.pipe.live) {
      var mine = S.pipe.byAgent.filter(function (r) { return accSameName_(r.name, person.name); })[0];
      if (mine) {
        out.push({ label: 'Your applications over ' + ACC.STUCK_DAYS + ' days', value: mine.n });
        out.push({ label: 'API waiting in them', value: accMoney_(mine.api) });
      }
    }
  } else {
    if (S.tasks.live) {
      var t = null;
      for (var k = 0; k < S.tasks.people.length; k++) {
        if (accSameName_(S.tasks.people[k].name, person.name)) { t = S.tasks.people[k]; break; }
      }
      if (t) {
        out.push({ label: 'Open tasks', value: t.open });
        out.push({ label: 'Overdue', value: t.overdue });
        out.push({ label: 'Waiting on someone else', value: t.waiting });
        if (t.untouched) out.push({ label: 'Not touched in ' + ACC.UNTOUCHED_DAYS + ' days', value: t.untouched });
        if (t.oldestDays) out.push({ label: 'Oldest overdue, days', value: t.oldestDays });
      }
    }
    if (S.pipe.live) {
      var sup = S.pipe.bySupport.filter(function (r) { return accSameName_(r.name, person.name) ||
        accLow_(r.name) === accLow_(person.name).split(/\s+/)[0]; })[0];
      if (sup) {
        out.push({ label: 'Applications you support, over ' + ACC.STUCK_DAYS + ' days', value: sup.n });
        out.push({ label: 'API waiting in them', value: accMoney_(sup.api) });
      }
    }
    if (person.role === 'manager' || person.role === 'unitmgr') {
      if (S.ff.live) {
        var r = S.ff.reviewers.filter(function (x) { return accSameName_(x.name, person.name); })[0];
        if (r) {
          out.push({ label: 'Fact finds waiting on you', value: r.pending });
          out.push({ label: 'Your median days to review', value: r.medianDays });
          out.push({ label: 'Returned to the advisor', value: r.returnRate + '%' });
        }
      }
    }
  }
  return out;
}

/** Record one close-off. Idempotent per person per period. */
function apiCloseOff_(body) {
  var me = requireUser_(body.token);
  var now = new Date();
  var period = accLow_(body.period) === 'week' ? 'week' : 'day';
  var key = period === 'week' ? accWeekKey_(now) : accDayKey_(now);

  var already = readTab_(ACC.TAB_CLOSE).filter(function (r) {
    return accLow_(r['Email']) === accLow_(me.email) &&
           accStr_(r['Period']) === period &&
           accStr_(period === 'week' ? r['Week'] : r['Day']) === key;
  })[0];

  var S = accSnapshot_();
  var nums = accNumbersFor_(me, S).map(function (n) { return n.label + ': ' + n.value; }).join(' · ');

  var row = {
    'When': now, 'Day': accDayKey_(now), 'Week': accWeekKey_(now), 'Period': period,
    'Email': me.email, 'Name': me.name, 'Role': me.role, 'Unit': me.unit || '',
    'Done': accStr_(body.done), 'Blocked': accStr_(body.blocked),
    'Help needed': accStr_(body.help), 'Numbers': nums,
    'Device': accStr_(body.device)
  };

  if (already) {
    ['Done', 'Blocked', 'Help needed', 'Numbers', 'When'].forEach(function (h) {
      setCell_(ACC.TAB_CLOSE, already._row, h, row[h]);
    });
    log_('close-off-again', me.email, me.role, period, key);
    return { ok: true, saved: true, replaced: true };
  }
  appendRow_(ACC.TAB_CLOSE, row);
  log_('close-off', me.email, me.role, period, key);
  return { ok: true, saved: true, replaced: false };
}

/** Who closed off and who did not, over a window. The report's input. */
function accCloseStats_(days) {
  days = accNum_(days) || 7;
  var cut = new Date(); cut.setDate(cut.getDate() - days);
  var cutKey = accDayKey_(cut);
  var rows = readTab_(ACC.TAB_CLOSE).filter(function (r) {
    return accStr_(r['Day']) >= cutKey && accStr_(r['Period']) === 'day';
  });

  var by = {};
  rows.forEach(function (r) {
    var e = accLow_(r['Email']);
    if (!by[e]) by[e] = { email: e, name: accStr_(r['Name']), role: accStr_(r['Role']),
                          unit: accStr_(r['Unit']), days: 0, blocked: [], help: [] };
    by[e].days++;
    if (accStr_(r['Blocked'])) by[e].blocked.push({ day: accStr_(r['Day']), text: accStr_(r['Blocked']) });
    if (accStr_(r['Help needed'])) by[e].help.push({ day: accStr_(r['Day']), text: accStr_(r['Help needed']) });
  });

  var expected = 0, silent = [];
  readPeople_().forEach(function (p) {
    if (!p.active || p.role === 'guest') return;
    expected++;
    if (!by[accLow_(p.email)]) {
      silent.push({ name: p.name, email: p.email, role: p.role, unit: p.unit || '' });
    }
  });

  var closed = Object.keys(by).map(function (k) { return by[k]; })
    .sort(function (a, b) { return b.days - a.days; });

  return { days: days, expected: expected, closed: closed, silent: silent,
           filed: rows.length,
           /*  Of the working days in the window, how many did the branch
            *  close off between them. A share, because the count on its
            *  own says nothing about a week with a holiday in it. */
           rate: expected ? Math.round(closed.length / expected * 100) : 0 };
}

/* ===================================================================
 *  THE TOPIC — one question each, with its working shown
 *
 *  THE REQUEST, in the manager's words: "each of them, we single out
 *  what topic they are going to talk for the meeting on. Because you do
 *  have their goals. You do have their production from Salesforce. You
 *  do have the tasks open from them."
 *
 *  So every person walks into Wednesday with ONE topic that is theirs,
 *  chosen by the numbers rather than by the chair, and they can see it
 *  before the meeting with the figure underneath it.
 *
 *  HOW A TOPIC IS CHOSEN. Each role has a ranked list of candidates.
 *  The first one whose condition is true wins. The ranking is by what
 *  it costs the branch to leave alone, which is why the API sitting in
 *  a stuck pipeline outranks a tidy desk, and why a person with nothing
 *  wrong is asked about their best case rather than being skipped —
 *  "I want a contribution from all" was the ask, and a skipped person
 *  is a person who learns the meeting is not about them.
 *
 *  EVERY TOPIC IS A QUESTION. Not "your conversion is 4%" but "which of
 *  the cases you recommended do you re-open first?". A statement is
 *  something to sit through; a question is something to answer, and the
 *  minute taker has somewhere to write.
 *
 *  NOTHING HERE RANKS PEOPLE AGAINST EACH OTHER. There is no league
 *  table in this file, and the figure beside a topic is always that
 *  person's own.
 * =================================================================== */

function accTopicFor_(person, S) {
  S = S || accSnapshot_();
  var name = person.name, first = name.split(/\s+/)[0];

  /* ------------------------------ agents ------------------------------ */
  if (person.role === 'agent') {
    var a = null, lane = null, mine = null;
    if (S.ff.live) {
      for (var i = 0; i < S.ff.agents.length; i++) {
        if (accSameName_(S.ff.agents[i].name, name)) { a = S.ff.agents[i]; break; }
      }
    }
    if (S.goals.live) {
      for (var g = 0; g < S.goals.lanes.length; g++) {
        if (accSameName_(S.goals.lanes[g].name, name)) { lane = S.goals.lanes[g]; break; }
      }
    }
    if (S.pipe.live) {
      mine = S.pipe.byAgent.filter(function (r) { return accSameName_(r.name, name); })[0] || null;
    }

    /*  1. Nothing at all this year. Not a nudge: a conversation about
     *  whether the plan is the plan. */
    if (a && !a.year) {
      return accTopic_('Your week ahead',
        'What does your week look like, and what is the first fact find in it?',
        'No fact find filed this year.', '', 'Fact finds', 100);
    }
    /*  2. Quiet this month, having filed before. Something changed and
     *  the person knows what. */
    if (a && a.year && !a.month) {
      return accTopic_('What changed',
        'You filed ' + a.year + ' this year and none this month. What changed, and ' +
        'what would get the next one in this week?',
        a.year + ' fact finds this year, none this month.', a.year, 'Fact finds', 95);
    }
    /*  3. The gap between what was recommended and what was written.
     *  The branch's own number is 4.8%; a person's own is the only
     *  version of it they can act on. */
    if (a && a.apiRec > 0 && a.conversion !== null && a.conversion < 50) {
      return accTopic_('Recommended against written',
        'You recommended ' + accMoney_(a.apiRec) + ' and ' + accMoney_(a.pickedUp) +
        ' was written. Which case do you re-open first, and what stopped it?',
        'Conversion ' + a.conversion + '% of what you recommended.',
        a.conversion, 'Fact finds', 90);
    }
    /*  4. Their own applications stuck. The money is theirs too. */
    if (mine && mine.n > 0) {
      return accTopic_('Your pipeline',
        mine.n + ' of your applications' + (mine.oldest ? ', the oldest ' + mine.oldest +
        ' days old,' : '') + ' are carrying ' + accMoney_(mine.api) + '. Which one closes ' +
        'this week, and what does it need?',
        mine.n + ' applications over ' + ACC.STUCK_DAYS + ' days, ' + accMoney_(mine.api) + ' API.',
        mine.api, 'Pipeline', 85);
    }
    /*  5. Behind their own plan — their arithmetic, not the branch's. */
    if (lane && lane.owed && lane.filed < lane.owed) {
      return accTopic_('Your flight plan',
        'Your plan asks for ' + lane.owed + ' fact finds a week and ' + lane.filed +
        ' came in. What is in the way of the other ' + (lane.owed - lane.filed) + '?',
        lane.filed + ' of ' + lane.owed + ' filed this week.', lane.filed, 'Goals', 80);
    }
    /*  6. No plan on file. The goal gate already stops the fact find,
     *  so this is a blocker, not an admin note. */
    if (S.goals.live && !lane) {
      return accTopic_('Your plan for the year',
        'There is no flight plan on file for you. What does your year have to pay for, ' +
        'and shall we work it back on screen?',
        'No flight plan filed.', '', 'Goals', 75);
    }
    /*  7. Nothing wrong. Still presents — and the branch learns from
     *  the person who is doing it, which is the only item on the agenda
     *  that makes anybody better at the job. */
    if (a && a.week > 0) {
      return accTopic_('Your best case this week',
        'Take us through the best fact find you filed this week: what you asked, ' +
        'and what they bought.',
        a.week + ' filed this week' + (a.pickedUp ? ', ' + accMoney_(a.pickedUp) +
        ' picked up this year' : '') + '.', a.week, 'Fact finds', 40);
    }
    return accTopic_('Your week ahead',
      'What is in your diary this week, and where do the fact finds come from?',
      'No figures on the wall for you yet.', '', 'Fact finds', 50);
  }

  /* ------------------------- unit managers ------------------------- */
  if (person.role === 'unitmgr') {
    var r = null;
    if (S.ff.live) r = S.ff.reviewers.filter(function (x) { return accSameName_(x.name, name); })[0] || null;

    /*  1. The queue he is holding. On 17 October 2026 one reviewer held
     *  thirteen with the oldest at thirty-seven days, and an advisor
     *  cannot sell a case that is sitting in a review queue. */
    if (r && r.pending > 0 && (r.medianDays >= ACC.REVIEW_DAYS || r.pending >= 5)) {
      return accTopic_('Your review queue',
        r.pending + ' fact finds are waiting on you, median ' + r.medianDays + ' days ' +
        'against our three-day standard. When are they cleared, and what is slowing them?',
        r.pending + ' waiting, median ' + r.medianDays + ' days.', r.pending, 'Fact finds', 95);
    }
    /*  2. His own people who filed nothing. He accounts for the team —
     *  which is the whole reason the unit round exists. */
    var quiet = accQuietAgents_(S).filter(function (q) {
      return accLow_(q.unit) === accLow_(person.unit || person.name) ||
             accLow_(q.unit) === accLow_(name);
    });
    if (quiet.length) {
      return accTopic_('Your unit, person by person',
        quiet.length + ' in your unit filed no fact find this week' +
        (quiet.length <= 3 ? ' — ' + quiet.map(function (q) { return q.name.split(/\s+/)[0]; }).join(', ') : '') +
        '. What is each of them doing this week?',
        quiet.length + ' filed nothing this week.', quiet.length, 'Fact finds', 90);
    }
    /*  3. The return rate. A low one can mean a reviewer who is not
     *  reading; a high one can mean advisors who were never shown.
     *  Either way it is his to explain, and the figure is his. */
    if (r && r.returnRate >= 25) {
      return accTopic_('What keeps coming back',
        r.returnRate + '% of what you review goes back to the advisor. What is the ' +
        'commonest reason, and what would stop it at the front end?',
        r.returnRate + '% returned.', r.returnRate, 'Fact finds', 70);
    }
    return accTopic_('Your unit this week',
      'What did your unit put on the board this week, and who are you working with next?',
      r ? r.approved + ' approved, median ' + r.medianDays + ' days.' : '',
      r ? r.approved : '', 'Fact finds', 45);
  }

  /* ------------------------------ staff ------------------------------ */
  if (person.role === 'staff') {
    var t = null, sup = null;
    if (S.tasks.live) {
      for (var k = 0; k < S.tasks.people.length; k++) {
        if (accSameName_(S.tasks.people[k].name, name)) { t = S.tasks.people[k]; break; }
      }
    }
    if (S.pipe.live) {
      sup = S.pipe.bySupport.filter(function (x) {
        return accSameName_(x.name, name) || accLow_(x.name) === accLow_(first);
      })[0] || null;
    }

    /*  1. The applications on her desk and what they are worth. This is
     *  the item that connects a support desk to the branch's money, and
     *  nothing before this read the two together. */
    if (sup && sup.n > 0) {
      return accTopic_('The applications on your desk',
        sup.n + ' applications you support have been open over ' + ACC.STUCK_DAYS +
        ' days, carrying ' + accMoney_(sup.api) + '. Which three clear this week, and ' +
        'what is each one waiting on?',
        sup.n + ' over ' + ACC.STUCK_DAYS + ' days, ' + accMoney_(sup.api) + ' API.',
        sup.api, 'Pipeline', 95);
    }
    /*  2. Overdue. The oldest is named, because a count of fifty-six
     *  invites a shrug and one task with a date on it invites an
     *  answer. */
    if (t && t.overdue >= 10) {
      return accTopic_('Your overdue list',
        t.overdue + ' of your ' + t.open + ' tasks are past their date, the oldest by ' +
        t.oldestDays + ' days. What is the plan to clear them, and what needs taking off you?',
        t.overdue + ' overdue, oldest ' + t.oldestDays + ' days.', t.overdue, 'Salesforce', 90);
    }
    /*  3. Waiting on someone else. A third of the branch's open tasks
     *  say this and nothing anywhere says WHO. That is the question. */
    if (t && t.waiting >= 15) {
      return accTopic_('Who you are waiting on',
        t.waiting + ' of your tasks say "waiting on someone else". Who, and since when? ' +
        'Name the three that need chasing from this room.',
        t.waiting + ' waiting on someone else.', t.waiting, 'Salesforce', 85);
    }
    if (t && t.untouched >= 10) {
      return accTopic_('The quiet half of your list',
        t.untouched + ' of your tasks have not been touched in ' + ACC.UNTOUCHED_DAYS +
        ' days. Are they live work, or do they need closing?',
        t.untouched + ' untouched.', t.untouched, 'Salesforce', 70);
    }
    /*  4. The process she now owns. New apps have landed on this desk
     *  all quarter and the training is the job nobody schedules. */
    return accTopic_('The new process you are carrying',
      'Which of the new processes is taking the most of your week, and who still ' +
      'needs showing how to do it?',
      t ? t.open + ' open, ' + t.overdue + ' overdue.' : '', t ? t.open : '',
      'Salesforce', 50);
  }

  /* --------------------------- the chair --------------------------- */
  if (person.role === 'manager') {
    if (S.ff.live && S.ff.year.conversion !== null && S.ff.year.conversion < 25) {
      return accTopic_('Recommended against written, for the branch',
        'We recommended ' + accMoney_(S.ff.year.apiRec) + ' this year and wrote ' +
        accMoney_(S.ff.year.pickedUp) + '. What are we changing about the week between ' +
        'the fact find and the application?',
        S.ff.year.conversion + '% of recommended API written.',
        S.ff.year.conversion, 'Fact finds', 100);
    }
    if (S.pipe.live && S.pipe.total.stuck > 0) {
      return accTopic_('What the pipeline is holding',
        S.pipe.total.stuck + ' applications over ' + ACC.STUCK_DAYS + ' days are holding ' +
        accMoney_(S.pipe.total.stuckApi) + '. Who owns clearing them by when?',
        S.pipe.total.stuck + ' stuck, ' + accMoney_(S.pipe.total.stuckApi) + '.',
        S.pipe.total.stuckApi, 'Pipeline', 95);
    }
    return accTopic_('Where the branch is', 'The week, read back.', '', '', 'Branch', 40);
  }

  return accTopic_('Your week', 'What are you working on this week?', '', '', '', 10);
}

function accTopic_(topic, question, evidence, figure, source, rank) {
  return { topic: topic, question: question, evidence: evidence,
           figure: figure, source: source, rank: rank };
}

/** A topic for everyone who should speak, highest rank first. */
function accTopics_(S) {
  S = S || accSnapshot_();
  var out = [];
  readPeople_().forEach(function (p) {
    if (!p.active || p.role === 'guest') return;
    var t = accTopicFor_(p, S);
    t.name = p.name; t.email = p.email; t.role = p.role; t.unit = p.unit || '';
    out.push(t);
  });
  return out.sort(function (a, b) { return b.rank - a.rank; });
}

/** Write the topics onto the tab for a meeting, so the agenda, the room
 *  screen and the minutes all read the same words — and so a topic can
 *  be looked back at next week against what the person said. */
function accSaveTopics_(meetingId, S) {
  S = S || accSnapshot_();
  var topics = accTopics_(S), now = new Date();
  var have = {};
  readTab_(ACC.TAB_TOPIC).forEach(function (r) {
    if (accStr_(r['Meeting ID']) === accStr_(meetingId)) have[accLow_(r['Email'])] = r;
  });
  var add = [];
  topics.forEach(function (t) {
    if (have[accLow_(t.email)]) return;
    add.push({ 'When': now, 'Meeting ID': meetingId, 'Email': t.email, 'Name': t.name,
               'Role': t.role, 'Unit': t.unit, 'Topic': t.topic, 'Question': t.question,
               'Evidence': t.evidence, 'Figure': t.figure, 'Source': t.source,
               'Rank': t.rank, 'Spoke': '', 'Note': '' });
  });
  if (add.length) appendRows_(ACC.TAB_TOPIC, add);
  return { written: add.length, total: topics.length };
}

/* ===================================================================
 *  THE SNAPSHOT — one read of everything, shared by every caller
 *
 *  The morning routing, the evening ask, the manager's report, the
 *  agenda seeder and the room screen all read this. One snapshot means
 *  three screens never disagree about the same morning, and it means
 *  Salesforce is asked twice an hour rather than twice a minute.
 * =================================================================== */
function accSnapshot_() {
  return {
    at: new Date(),
    tasks: accTasks_(),
    pipe: accPipeline_(),
    ff: accFactFind_(),
    goals: accGoals_(),
    rem: accReminders_()
  };
}

/** Source by source: what is live, and what to paste if it is not. */
function accSources_(S) {
  S = S || accSnapshot_();
  return [
    { key: 'tasks',    label: 'Salesforce tasks',     live: S.tasks.live, why: S.tasks.why || '' },
    { key: 'pipeline', label: 'The pipeline',          live: S.pipe.live,  why: S.pipe.why || '' },
    { key: 'factfind', label: 'Fact finds',            live: S.ff.live,    why: S.ff.why || '' },
    { key: 'goals',    label: 'Flight plans and goals', live: S.goals.live, why: S.goals.why || '' },
    { key: 'reminders',label: 'Client reminders',       live: S.rem.live,   why: S.rem.why || '' }
  ];
}

/* ===================================================================
 *  THE FINDINGS — what we need to hear, not what is easy to count
 *
 *  "Business intelligence tell us what we need to hear daily at the end
 *  of the week."
 *
 *  THE RULE THIS FILE KEEPS: a finding is a sentence with a number in
 *  it and a source beside it, and it is only written when the data
 *  supports it. Nothing here interpolates, estimates or rounds a figure
 *  up into a headline. A source that is down produces no findings at
 *  all, and the report says which source is down — because a quiet
 *  report that is quiet for the wrong reason is the single most
 *  expensive thing an engine like this can do.
 *
 *  Severity is what it costs to leave alone, not how dramatic it reads:
 *    3  money or a client is exposed now
 *    2  the week will be worse for it
 *    1  worth knowing
 *
 *  Each finding carries a stable key. The Findings tab remembers the
 *  key and the day, so the daily report can lead on what is NEW and
 *  the weekly one can say what has been true all week — which is the
 *  difference between a report people read and a report people learn
 *  the shape of and stop reading.
 * =================================================================== */

function accFindings_(S) {
  S = S || accSnapshot_();
  var F = [];
  function f(key, sev, heading, text, figure, source, who) {
    F.push({ key: key, severity: sev, heading: heading, finding: text,
             figure: figure === undefined ? '' : figure, source: source,
             who: who || '' });
  }

  /* ---------------------- the money in the queue ---------------------- */
  if (S.pipe.live && S.pipe.total.stuck > 0) {
    f('pipe.stuck', 3, 'The pipeline is holding the year',
      S.pipe.total.stuck + ' applications have been open more than ' + ACC.STUCK_DAYS +
      ' days, carrying ' + accMoney_(S.pipe.total.stuckApi) + ' of API between them. ' +
      'The oldest is ' + S.pipe.oldestDays + ' days old.',
      S.pipe.total.stuckApi, 'Salesforce');

    /*  The comparison nothing else in the branch makes. If what is
     *  stuck is worth more than what has been written all year, that is
     *  the finding — and on 17 October 2026 it was more than twenty
     *  times as much. */
    if (S.ff.live && S.ff.year.pickedUp > 0) {
      var mult = S.pipe.total.stuckApi / S.ff.year.pickedUp;
      if (mult >= 2) {
        f('pipe.vs.written', 3, 'More is stuck than has been written',
          'The API waiting in the stuck pipeline is ' + (Math.round(mult * 10) / 10) +
          ' times the API written all year (' + accMoney_(S.ff.year.pickedUp) + ').',
          Math.round(mult * 10) / 10, 'Salesforce + fact finds');
      }
    }
    var worst = S.pipe.bySupport[0];
    if (worst && worst.n >= 5) {
      f('pipe.desk', 2, 'One desk is carrying most of it',
        worst.name + ' supports ' + worst.n + ' of them, worth ' + accMoney_(worst.api) +
        ', the oldest ' + worst.oldest + ' days.', worst.api, 'Salesforce', worst.name);
    }
    var st = S.pipe.byStatus[0];
    if (st && st.n >= 5) {
      f('pipe.reason', 2, 'Most of them are stuck for one reason',
        st.n + ' of the ' + S.pipe.total.stuck + ' read "' + st.name + '", holding ' +
        accMoney_(st.api) + '.', st.n, 'Salesforce');
    }
  }

  /* ------------------- recommended against written ------------------- */
  if (S.ff.live && S.ff.year.apiRec > 0 && S.ff.year.conversion !== null) {
    var c = S.ff.year.conversion;
    f('ff.conversion', c < 25 ? 3 : 2,
      c < 25 ? 'We are recommending far more than we write' : 'Recommended against written',
      'This year we recommended ' + accMoney_(S.ff.year.apiRec) + ' of API across ' +
      S.ff.year.submitted + ' fact finds and wrote ' + accMoney_(S.ff.year.pickedUp) +
      '. That is ' + c + '%.', c, 'Fact finds');
  }

  /* -------------------------- the review queue -------------------------- */
  if (S.ff.live && S.ff.queue.pending > 0) {
    var q = S.ff.queue;
    if (q.breaching > 0) {
      f('ff.queue', q.breaching >= 10 ? 3 : 2, 'Fact finds are waiting on us, not on clients',
        q.pending + ' fact finds are in the review queue and ' + q.breaching +
        ' are past our own ' + ACC.REVIEW_DAYS + '-day standard. The oldest has waited ' +
        q.oldestDays + ' days' + (q.oldestWho ? ', with ' + q.oldestWho : '') + '.',
        q.breaching, 'Fact finds', q.oldestWho);
    }
    /*  A median that looks good with a tail that long is a median
     *  hiding a queue. queueCard_ in Meetings.gs makes the same point;
     *  this says it in a sentence a meeting can act on. */
    S.ff.reviewers.forEach(function (m) {
      if (m.pending >= 8) {
        f('ff.rev.' + accLow_(m.name).replace(/\W+/g, ''), 2, 'A reviewer is holding a queue',
          m.name + ' has ' + m.pending + ' waiting, median ' + m.medianDays +
          ' days, and returns ' + m.returnRate + '% to the advisor.',
          m.pending, 'Fact finds', m.name);
      }
    });
  }

  /* ---------------------------- the desk ---------------------------- */
  if (S.tasks.live) {
    var t = S.tasks.total;
    if (t.overdue > 0) {
      f('task.overdue', t.overdue >= 100 ? 3 : 2, 'Overdue work',
        t.overdue + ' of ' + t.open + ' open tasks are past their date.',
        t.overdue, 'Salesforce');
      var top = S.tasks.people[0];
      if (top && top.overdue >= 20) {
        f('task.onedesk', 2, 'The overdue work is not spread evenly',
          top.name + ' holds ' + top.overdue + ' of them, the oldest ' + top.oldestDays +
          ' days past its date.', top.overdue, 'Salesforce', top.name);
      }
    }
    /*  THE ONE NOBODY HAS SEEN. A third of every open task in the
     *  branch says "waiting on someone else" and no field anywhere says
     *  who is being waited on or since when. Until that is recorded,
     *  a third of the branch's work cannot be chased by anybody. */
    if (t.waiting > 0 && t.open > 0) {
      var share = Math.round(t.waiting / t.open * 100);
      if (share >= 20) {
        f('task.waiting', 3, 'A third of the work is waiting on somebody unnamed',
          t.waiting + ' open tasks (' + share + '% of them) read "waiting on someone else". ' +
          'Nothing records who is being waited on, so none of them can be chased from here.',
          t.waiting, 'Salesforce');
      }
    }
    if (t.untouched >= 30) {
      f('task.untouched', 2, 'Work nobody has touched',
        t.untouched + ' open tasks have not been changed in ' + ACC.UNTOUCHED_DAYS +
        ' days.', t.untouched, 'Salesforce');
    }
    if (t.nodate > 0 && t.nodate <= 25) {
      f('task.nodate', 1, 'Almost everything has a date on it',
        'Only ' + t.nodate + ' open tasks have no due date, so very little can go quiet. ' +
        'Worth keeping.', t.nodate, 'Salesforce');
    } else if (t.nodate > 25) {
      f('task.nodate', 2, 'Work with no date cannot be overdue',
        t.nodate + ' open tasks have no due date at all.', t.nodate, 'Salesforce');
    }
  }

  /* --------------------------- the logging --------------------------- */
  if (S.ff.live) {
    var lg = S.ff.logging;
    if (lg.total === 0) {
      f('log.none', 2, 'Nothing has been logged today',
        'The fact find day feed read nothing at all today: no advisor, no manager, no ' +
        'support. Either it was a quiet day or the logging is not happening, and the ' +
        'board cannot tell the difference.', 0, 'Fact finds');
    } else if (lg.advisor === 0) {
      f('log.noadvisor', 2, 'No advisor logged anything today',
        lg.total + ' entries today and none of them from an advisor.', lg.advisor, 'Fact finds');
    }
    if (S.ff.week.submitted === 0) {
      f('ff.week.none', 3, 'No fact find has been filed this week',
        'Nothing has come in this week.', 0, 'Fact finds');
    } else if (accNum_(S.ff.week.lastWeek) > 0) {
      var now = accNum_(S.ff.week.submitted), was = accNum_(S.ff.week.lastWeek);
      if (now < was) {
        f('ff.week.down', 2, 'Fewer fact finds than last week',
          now + ' filed this week against ' + was + ' last week.', now, 'Fact finds');
      } else if (now > was) {
        f('ff.week.up', 1, 'More fact finds than last week',
          now + ' filed this week against ' + was + ' last week.', now, 'Fact finds');
      }
    }
  }

  /* ---------------------------- the quiet ---------------------------- */
  var quiet = accQuietAgents_(S);
  if (quiet.length) {
    var nothingAll = quiet.filter(function (q) { return !q.year; }).length;
    f('agents.quiet', quiet.length >= 5 ? 3 : 2, 'Advisors with nothing filed',
      quiet.length + ' active advisors have filed no fact find this week' +
      (nothingAll ? ', and ' + nothingAll + ' have filed none all year' : '') + '.',
      quiet.length, 'Fact finds');
  }

  /* --------------------------- the plans --------------------------- */
  if (S.goals.live) {
    if (S.goals.noPlan && S.goals.noPlan.length) {
      f('goals.noplan', 2, 'Advisors with no flight plan',
        S.goals.noPlan.length + ' have no plan on file, so there is no weekly number to ' +
        'hold them to — and the goal gate stops them filing a fact find.',
        S.goals.noPlan.length, 'Flight plans');
    }
    var off = (S.goals.lanes || []).filter(function (l) { return l.owed && l.filed < l.owed; });
    if (off.length) {
      f('goals.behind', 2, 'Behind their own plan',
        off.length + ' of ' + S.goals.lanes.length + ' are short of the weekly number ' +
        'they set themselves.', off.length, 'Flight plans');
    }
  }

  /* -------------------------- the reminders -------------------------- */
  if (S.rem.live) {
    if (S.rem.noReminder > 0) {
      f('rem.gap', S.rem.noReminder >= 100 ? 3 : 2, 'Clients behind with nothing chasing them',
        S.rem.behind + ' policies are behind on premium and ' + S.rem.noReminder +
        ' of them have no reminder flag set at all.', S.rem.noReminder, 'Salesforce');
    }
    if (S.rem.set > 0) {
      f('rem.on', 1, 'Reminders set', S.rem.set + ' policies have a premium reminder set.',
        S.rem.set, 'Salesforce');
    }
  }

  /* ------------------------- closing off -------------------------- */
  var cs = accCloseStats_(7);
  if (cs.expected > 0) {
    if (cs.closed.length === 0) {
      f('close.none', 2, 'Nobody has closed off a day this week',
        'None of the ' + cs.expected + ' people on the app have closed off a day in the ' +
        'last seven. So the only account of the week is what the systems saw.',
        0, 'The desk');
    } else if (cs.silent.length) {
      f('close.silent', 2, 'Days not accounted for',
        cs.closed.length + ' of ' + cs.expected + ' closed off at least one day this week; ' +
        cs.silent.length + ' have closed off none.', cs.silent.length, 'The desk');
    }
    /*  What people SAID was in the way. The most valuable rows in the
     *  whole file, because nothing else in the branch records them. */
    var blocks = [];
    cs.closed.forEach(function (p) {
      p.blocked.forEach(function (b) { blocks.push(p.name + ': ' + b.text); });
    });
    if (blocks.length) {
      f('close.blocked', 2, 'What people said was in the way',
        blocks.length + ' blockers were written down this week. They are listed in full ' +
        'below, in the words they were written in.', blocks.length, 'The desk');
    }
  }

  /* --------------------- what the sources cannot say --------------------- */
  accSources_(S).forEach(function (s) {
    if (!s.live) {
      f('src.' + s.key, 2, 'A source is not reporting',
        s.label + ' is not reporting, so nothing below counts it. ' + s.why, '', 'Setup');
    }
  });

  return F.sort(function (a, b) { return b.severity - a.severity; });
}

/*  WHAT IS NEW SINCE LAST TIME. The daily report leads on this, because
 *  the second week of a report that opens on the same three findings is
 *  the week people stop opening it. A key not seen in FIND_REPEAT_DAYS
 *  is new again — a problem that went away and came back is news. */
function accMarkFindings_(F) {
  var now = new Date(), day = accDayKey_(now);
  var cut = new Date(); cut.setDate(cut.getDate() - ACC.FIND_REPEAT_DAYS);
  var cutKey = accDayKey_(cut);

  var seen = {};
  readTab_(ACC.TAB_FIND).forEach(function (r) {
    var k = accStr_(r['Key']);
    if (accStr_(r['Day']) >= cutKey) {
      if (!seen[k] || accStr_(r['Day']) > seen[k]) seen[k] = accStr_(r['Day']);
    }
  });

  var add = [];
  F.forEach(function (x) {
    x.first = !seen[x.key];
    x.since = seen[x.key] || day;
    if (seen[x.key] === day) return;            /* already written today */
    add.push({ 'When': now, 'Day': day, 'Key': x.key, 'Severity': x.severity,
               'Heading': x.heading, 'Finding': x.finding, 'Figure': x.figure,
               'Source': x.source, 'Who': x.who, 'Sent': '', 'Note': '' });
  });
  if (add.length) appendRows_(ACC.TAB_FIND, add);
  return F;
}

/* ===================================================================
 *  THE E-MAILS
 *
 *  Tables and inline styles only, the hosted gold shield at the top —
 *  the house rule: every screen and every letter uses that one file,
 *  and nothing here draws a substitute. These are internal mail, so
 *  they go through MailApp like the rest of the meeting app's notes and
 *  every one of them says it is internal, because they carry client
 *  names and policy numbers.
 * =================================================================== */

var ACC_INK = '#07131f', ACC_GOLD = '#efc24b', ACC_BLUE = '#1D5BC4',
    ACC_STOP = '#D9663B', ACC_MUTE = '#7C8BA3', ACC_LINE = '#E3E9F2';

function accLogo_() {
  try { return IBRAND_LOGO_(); }
  catch (e) { return 'https://rickyrampersadbranch.com/logo-mark.png'; }
}

function accShell_(title, sub, body) {
  return '' +
  '<div style="margin:0;padding:0;background:#f4f6fa">' +
  '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" ' +
         'style="background:#f4f6fa;padding:18px 0"><tr><td align="center">' +
  '<table role="presentation" width="640" cellpadding="0" cellspacing="0" ' +
         'style="width:640px;max-width:100%;background:#ffffff;border-radius:14px;overflow:hidden;' +
         'font-family:-apple-system,BlinkMacSystemFont,\'Segoe UI\',Roboto,Arial,sans-serif">' +
  '<tr><td style="background:' + ACC_INK + ';padding:22px 26px">' +
  '<img src="' + accLogo_() + '" width="38" height="38" alt="" ' +
       'style="border-radius:11px;display:block;margin-bottom:12px">' +
  '<div style="color:#fff;font-size:21px;font-weight:700;line-height:1.25">' + accEsc_(title) + '</div>' +
  (sub ? '<div style="color:' + ACC_GOLD + ';font-size:13px;margin-top:5px">' + accEsc_(sub) + '</div>' : '') +
  '</td></tr>' +
  '<tr><td style="padding:24px 26px;color:#14202e;font-size:15px;line-height:1.6">' + body + '</td></tr>' +
  '<tr><td style="padding:14px 26px 20px;border-top:1px solid ' + ACC_LINE + ';' +
                 'color:' + ACC_MUTE + ';font-size:11.5px;line-height:1.5">' +
  accEsc_(ACC.INTERNAL) + '</td></tr>' +
  '</table></td></tr></table></div>';
}

function accEsc_(v) {
  return accStr_(v).replace(/&/g, '&amp;').replace(/</g, '&lt;')
                   .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function accH_(text) {
  return '<div style="font-size:12px;letter-spacing:.07em;text-transform:uppercase;' +
         'color:' + ACC_MUTE + ';font-weight:700;margin:22px 0 9px">' + accEsc_(text) + '</div>';
}

/*  Figure tiles. Three to a row on a desk and they stack on a phone,
 *  because an inline-block in a table cell is the only thing every mail
 *  client agrees to reflow. */
function accTiles_(items) {
  if (!items || !items.length) return '';
  return '<div style="margin:4px 0 2px">' + items.map(function (t) {
    return '<span style="display:inline-block;width:186px;vertical-align:top;' +
           'background:#f6f8fc;border:1px solid ' + ACC_LINE + ';border-radius:10px;' +
           'padding:11px 13px;margin:0 6px 8px 0">' +
           '<span style="display:block;font-size:11.5px;color:' + ACC_MUTE + ';' +
           'text-transform:uppercase;letter-spacing:.05em">' + accEsc_(t.label) + '</span>' +
           '<span style="display:block;font-size:22px;font-weight:700;color:' + ACC_INK + ';' +
           'margin-top:3px">' + accEsc_(t.value) + '</span></span>';
  }).join('') + '</div>';
}

/*  A finding, with its severity shown as a word and a tinted label —
 *  never by colour alone, which is the branch's standing rule for every
 *  status anywhere. */
var ACC_SEV = { 3: ['Act now', '#fdeae4', ACC_STOP],
                2: ['This week', '#eaf1fd', ACC_BLUE],
                1: ['Worth knowing', '#eef2f7', ACC_MUTE] };

function accFindingHtml_(F, limit) {
  if (!F || !F.length) {
    return '<p style="color:' + ACC_MUTE + '">Nothing to report from the sources that are ' +
           'live. That is a finding in itself — check the sources below.</p>';
  }
  return F.slice(0, limit || 40).map(function (x) {
    var s = ACC_SEV[x.severity] || ACC_SEV[1];
    return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" ' +
           'style="margin:0 0 12px"><tr>' +
      '<td style="width:4px;background:' + s[2] + ';border-radius:3px"></td>' +
      '<td style="padding:0 0 0 13px">' +
      '<span style="display:inline-block;background:' + s[1] + ';color:' + s[2] + ';' +
      'font-size:11px;font-weight:700;border-radius:20px;padding:3px 10px;' +
      'text-transform:uppercase;letter-spacing:.05em">' + s[0] + '</span>' +
      (x.first ? '<span style="display:inline-block;background:#eef7ee;color:#2f7d32;' +
                 'font-size:11px;font-weight:700;border-radius:20px;padding:3px 10px;' +
                 'margin-left:6px;text-transform:uppercase;letter-spacing:.05em">New</span>' : '') +
      '<div style="font-size:16px;font-weight:700;color:' + ACC_INK + ';margin:7px 0 3px">' +
      accEsc_(x.heading) + '</div>' +
      '<div style="font-size:14.5px;line-height:1.55">' + accEsc_(x.finding) + '</div>' +
      '<div style="font-size:11.5px;color:' + ACC_MUTE + ';margin-top:4px">' +
      accEsc_(x.source) + (x.who ? ' · ' + accEsc_(x.who) : '') +
      (!x.first && x.since ? ' · first seen ' + accEsc_(x.since) : '') + '</div>' +
      '</td></tr></table>';
  }).join('');
}

function accRows_(head, rows) {
  if (!rows || !rows.length) return '';
  var th = head.map(function (h, i) {
    return '<th style="text-align:' + (i ? 'right' : 'left') + ';padding:7px 9px;' +
           'font-size:11.5px;text-transform:uppercase;letter-spacing:.05em;' +
           'color:' + ACC_MUTE + ';border-bottom:1px solid ' + ACC_LINE + '">' +
           accEsc_(h) + '</th>';
  }).join('');
  var tr = rows.map(function (r, n) {
    return '<tr' + (n % 2 ? ' style="background:#fafbfd"' : '') + '>' + r.map(function (c, i) {
      return '<td style="text-align:' + (i ? 'right' : 'left') + ';padding:7px 9px;' +
             'font-size:14px;border-bottom:1px solid ' + ACC_LINE + '">' + accEsc_(c) + '</td>';
    }).join('') + '</tr>';
  }).join('');
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" ' +
         'style="border-collapse:collapse;margin:2px 0 6px"><tr>' + th + '</tr>' + tr + '</table>';
}

/* ------------------------- the morning note ------------------------- */

/*  Each person, their own items, their own numbers, and their topic for
 *  Wednesday. Sent on working mornings. A person with nothing routed to
 *  them and nothing quiet about their week gets no e-mail at all — an
 *  engine that mails everybody every morning regardless is an engine
 *  people filter. */
function accMorningFor_(person, S, routedRows) {
  var mine = (routedRows || []).filter(function (r) {
    return accLow_(r['To email']) === accLow_(person.email) &&
           accStr_(r['Status']) === 'Open';
  });
  var nums = accNumbersFor_(person, S);
  var topic = accTopicFor_(person, S);

  if (!mine.length && !nums.length) return null;

  var b = '<p>Good morning ' + accEsc_(person.name.split(/\s+/)[0]) + '.</p>';

  if (mine.length) {
    b += accH_(mine.length === 1 ? 'One thing for you today' : mine.length + ' things for you today');
    b += accRows_(['What', 'Why now', 'Days'], mine.slice(0, 25).map(function (r) {
      return [accStr_(r['What']), accStr_(r['Why now']), accStr_(r['Age days'])];
    }));
    if (mine.length > 25) {
      b += '<p style="color:' + ACC_MUTE + ';font-size:13px">And ' + (mine.length - 25) +
           ' more on the Routed Items tab.</p>';
    }
  }

  if (nums.length) {
    b += accH_('Where you stand');
    b += accTiles_(nums);
  }

  b += accH_('Your topic for Wednesday');
  b += '<div style="background:#f6f8fc;border-left:4px solid ' + ACC_BLUE + ';' +
       'border-radius:0 10px 10px 0;padding:14px 16px">' +
       '<div style="font-size:16px;font-weight:700;color:' + ACC_INK + '">' +
       accEsc_(topic.topic) + '</div>' +
       '<div style="margin-top:6px;font-size:14.5px;line-height:1.55">' +
       accEsc_(topic.question) + '</div>' +
       (topic.evidence ? '<div style="margin-top:7px;font-size:12px;color:' + ACC_MUTE + '">' +
        accEsc_(topic.evidence) + '</div>' : '') +
       '</div>';

  b += '<p style="margin-top:20px;font-size:13.5px;color:' + ACC_MUTE + '">' +
       'Close off your day on the app before you leave, in three lines: what got done, ' +
       'what is in the way, what help you need. The numbers above are already filled in ' +
       'for you — you are not being asked to retype them.</p>';

  return { subject: 'Your day · ' + Utilities.formatDate(new Date(),
             accTz_(), 'EEE d MMM'),
           html: accShell_('Your day', MEET.BRANCH, b) };
}

/** The morning run: route, then tell each desk its own items. */
function accMorning() {
  var now = new Date();
  if (!accIsWorkingDay_(now)) return { ok: true, skipped: 'not a working day' };

  var S = accSnapshot_();
  var did = accRoute_(S);
  var rows = readTab_(ACC.TAB_ROUTE);
  var sent = 0;

  readPeople_().forEach(function (p) {
    if (!p.active || p.role === 'guest' || !p.email) return;
    var mail = accMorningFor_(p, S, rows);
    if (!mail) return;
    try {
      MailApp.sendEmail({ to: p.email, subject: mail.subject, htmlBody: mail.html,
                          name: MEET.BRANCH });
      sent++;
    } catch (err) { /* one bad address must not stop the round */ }
  });

  log_('desk-morning', 'system', 'manager', 'Routed Items',
       did.routed + ' routed, ' + did.cleared + ' cleared, ' + sent + ' notes');
  return { ok: true, routed: did.routed, cleared: did.cleared, sent: sent };
}

/* ------------------------- the evening ask ------------------------- */

/*  Short, and it already knows the answer to the question it is not
 *  asking. Only to people who have not closed off today. */
function accEvening() {
  var now = new Date();
  if (!accIsWorkingDay_(now)) return { ok: true, skipped: 'not a working day' };

  var day = accDayKey_(now), S = accSnapshot_();
  var closed = {};
  readTab_(ACC.TAB_CLOSE).forEach(function (r) {
    if (accStr_(r['Day']) === day && accStr_(r['Period']) === 'day') {
      closed[accLow_(r['Email'])] = true;
    }
  });

  var sent = 0;
  readPeople_().forEach(function (p) {
    if (!p.active || p.role === 'guest' || !p.email) return;
    if (closed[accLow_(p.email)]) return;

    var nums = accNumbersFor_(p, S);
    var b = '<p>' + accEsc_(p.name.split(/\s+/)[0]) + ', three lines before you go.</p>' +
      '<ol style="padding-left:20px;line-height:1.75"><li>What got done today?</li>' +
      '<li>What is in the way?</li><li>What help do you need?</li></ol>';
    if (nums.length) {
      b += accH_('Already filled in for you');
      b += accTiles_(nums);
      b += '<p style="font-size:13.5px;color:' + ACC_MUTE + '">You do not need to type any ' +
           'of these. Tell us what they mean.</p>';
    }
    b += '<p style="margin-top:18px">Open the meeting app and press <b>Close off my day</b>.</p>';

    try {
      MailApp.sendEmail({ to: p.email,
        subject: 'Close off your day · ' + Utilities.formatDate(now, accTz_(), 'EEE d MMM'),
        htmlBody: accShell_('Close off your day', MEET.BRANCH, b), name: MEET.BRANCH });
      sent++;
    } catch (err) { /* keep going */ }
  });

  log_('desk-evening', 'system', 'manager', 'Close Offs', sent + ' asked');
  return { ok: true, asked: sent };
}

/* ---------------------- the manager's report ---------------------- */

function accReportHtml_(S, F, span) {
  var cs = accCloseStats_(span === 'week' ? 7 : 1);
  var b = '';

  /*  The five figures the branch is actually run on. Nothing decorative
   *  — each one is either a source's headline or the gap between two. */
  var tiles = [];
  if (S.ff.live) {
    tiles.push({ label: 'Fact finds this week', value: accNum_(S.ff.week.submitted) });
    tiles.push({ label: 'Review queue', value: S.ff.queue.pending });
    if (S.ff.year.conversion !== null) {
      tiles.push({ label: 'Recommended written', value: S.ff.year.conversion + '%' });
    }
  }
  if (S.pipe.live) {
    tiles.push({ label: 'Stuck over ' + ACC.STUCK_DAYS + ' days', value: S.pipe.total.stuck });
    tiles.push({ label: 'API waiting in them', value: accMoney_(S.pipe.total.stuckApi) });
  }
  if (S.tasks.live) {
    tiles.push({ label: 'Overdue tasks', value: S.tasks.total.overdue });
    tiles.push({ label: 'Waiting on someone', value: S.tasks.total.waiting });
  }
  tiles.push({ label: 'Closed off their day', value: cs.closed.length + ' of ' + cs.expected });
  b += accTiles_(tiles);

  var fresh = F.filter(function (x) { return x.first; });
  if (span !== 'week' && fresh.length) {
    b += accH_('New since yesterday');
    b += accFindingHtml_(fresh, 12);
    b += accH_('Still true');
    b += accFindingHtml_(F.filter(function (x) { return !x.first; }), 12);
  } else {
    b += accH_(span === 'week' ? 'What the week says' : 'What today says');
    b += accFindingHtml_(F, 20);
  }

  /* ------- what people said, in their own words ------- */
  var said = [];
  cs.closed.forEach(function (p) {
    p.blocked.forEach(function (x) { said.push([p.name, x.text]); });
  });
  if (said.length) {
    b += accH_('What people said was in the way');
    b += accRows_(['Who', 'In their words'], said.slice(0, 20).map(function (r) {
      return [r[0], r[1]];
    }));
  }
  var helps = [];
  cs.closed.forEach(function (p) {
    p.help.forEach(function (x) { helps.push([p.name, x.text]); });
  });
  if (helps.length) {
    b += accH_('Help asked for');
    b += accRows_(['Who', 'What they asked for'], helps.slice(0, 20).map(function (r) {
      return [r[0], r[1]];
    }));
  }
  if (cs.silent.length) {
    b += accH_('Closed off nothing');
    b += '<p style="font-size:14px">' + accEsc_(cs.silent.map(function (p) {
      return p.name;
    }).join(', ')) + '</p>';
  }

  /* ------- the desks ------- */
  if (S.tasks.live && S.tasks.people.length) {
    b += accH_('The desks');
    b += accRows_(['Who', 'Open', 'Overdue', 'Waiting', 'Oldest days'],
      S.tasks.people.map(function (p) {
        return [p.name, p.open, p.overdue, p.waiting, p.oldestDays || ''];
      }));
  }

  /* ------- the pipeline, two ways ------- */
  if (S.pipe.live && S.pipe.total.stuck) {
    b += accH_('What is stuck, by the desk supporting it');
    b += accRows_(['Who', 'Cases', 'API', 'Oldest days'],
      S.pipe.bySupport.slice(0, 12).map(function (r) {
        return [r.name, r.n, accMoney_(r.api), r.oldest];
      }));
    b += accH_('What is stuck, by advisor');
    b += accRows_(['Advisor', 'Cases', 'API', 'Oldest days'],
      S.pipe.byAgent.slice(0, 12).map(function (r) {
        return [r.name, r.n, accMoney_(r.api), r.oldest];
      }));
  }

  /* ------- the quiet ------- */
  var quiet = accQuietAgents_(S);
  if (quiet.length) {
    b += accH_('Advisors with nothing filed this week');
    b += accRows_(['Advisor', 'This month', 'This year', 'Plan asks'],
      quiet.slice(0, 20).map(function (q) {
        return [q.name, q.month, q.year, q.owed || '—'];
      }));
  }

  /* ------- the topics ------- */
  if (span === 'week') {
    var topics = accTopics_(S);
    b += accH_('Wednesday — one topic each');
    b += accRows_(['Who', 'Topic'], topics.map(function (t) {
      return [t.name + ' (' + t.role + ')', t.topic];
    }));
    b += '<p style="font-size:13.5px;color:' + ACC_MUTE + '">Each person has had their own ' +
         'question and the figure behind it. Nobody arrives wondering what they are being ' +
         'asked about.</p>';
  }

  /* ------- the sources ------- */
  b += accH_('Where these came from');
  b += accRows_(['Source', 'Reporting'], accSources_(S).map(function (s) {
    return [s.label, s.live ? 'Yes' : 'No — ' + s.why];
  }));

  return b;
}

function accReportTo_() {
  var to = accStr_(PropertiesService.getScriptProperties().getProperty(ACC.PROP_TO));
  return to || Session.getEffectiveUser().getEmail();
}

function accManagerDaily() {
  var now = new Date();
  if (!accIsWorkingDay_(now)) return { ok: true, skipped: 'not a working day' };
  var S = accSnapshot_();
  var F = accMarkFindings_(accFindings_(S));
  var html = accShell_('The branch, today',
    Utilities.formatDate(now, accTz_(), 'EEEE d MMMM yyyy'),
    accReportHtml_(S, F, 'day'));
  MailApp.sendEmail({ to: accReportTo_(),
    subject: 'The branch today · ' + F.filter(function (x) { return x.severity === 3; }).length +
             ' to act on',
    htmlBody: html, name: MEET.BRANCH });
  log_('desk-report', 'system', 'manager', 'Findings', F.length + ' findings');
  return { ok: true, findings: F.length };
}

function accWeekly() {
  var S = accSnapshot_();
  var F = accMarkFindings_(accFindings_(S));
  var html = accShell_('The week, and what it means',
    'Week to ' + Utilities.formatDate(new Date(), accTz_(), 'd MMMM yyyy'),
    accReportHtml_(S, F, 'week'));
  MailApp.sendEmail({ to: accReportTo_(),
    subject: 'The week, and what it means · ' + MEET.BRANCH,
    htmlBody: html, name: MEET.BRANCH });
  log_('desk-weekly', 'system', 'manager', 'Findings', F.length + ' findings');
  return { ok: true, findings: F.length };
}

/* ===================================================================
 *  THE ROUTES
 *
 *  Two lines in Meetings.gs's doGet and doPost reach these, the way
 *  Service.gs reaches GroupClients.gs by prefix. Everything else about
 *  the desk is in this file, so a change here is a paste of one file.
 *
 *  WHO SEES WHAT. A person always sees their own items, their own
 *  numbers and their own topic. Staff and the manager see the branch.
 *  A unit manager sees his own unit — not the branch's findings, which
 *  carry every desk's overdue work and every advisor's conversion.
 *  An agent sees no other agent's figures at all: there is no league
 *  table in this file and a route must not make one.
 * =================================================================== */

function apiDesk_(token) {
  var me = requireUser_(token);
  var S = accSnapshot_();

  var mine = readTab_(ACC.TAB_ROUTE).filter(function (r) {
    return accStr_(r['Status']) === 'Open' &&
           accLow_(r['To email']) === accLow_(me.email);
  }).map(function (r) {
    return { kind: accStr_(r['Kind']), what: accStr_(r['What']),
             why: accStr_(r['Why now']), days: accNum_(r['Age days']),
             source: accStr_(r['Source']), day: accStr_(r['Day']) };
  }).sort(function (a, b) { return b.days - a.days; });

  var day = accDayKey_(new Date()), week = accWeekKey_(new Date());
  var closes = readTab_(ACC.TAB_CLOSE).filter(function (r) {
    return accLow_(r['Email']) === accLow_(me.email);
  });

  var out = {
    ok: true,
    me: { name: me.name, role: me.role, unit: me.unit || '' },
    asOf: S.at,
    items: mine,
    numbers: accNumbersFor_(me, S),
    day: accDayFor_(me, S),
    topic: accTopicFor_(me, S),
    closedToday: closes.some(function (r) {
      return accStr_(r['Day']) === day && accStr_(r['Period']) === 'day'; }),
    closedWeek: closes.some(function (r) {
      return accStr_(r['Week']) === week && accStr_(r['Period']) === 'week'; }),
    sources: accSources_(S),
    ask: ['What got done?', 'What is in the way?', 'What help do you need?']
  };

  /*  The branch picture, for the people whose job it is. A unit manager
   *  gets his unit's people and his own queue, never the branch's
   *  findings. */
  if (isStaff_(me)) {
    out.branch = {
      findings: accFindings_(S),
      close: accCloseStats_(7),
      tasks: S.tasks.live ? S.tasks : null,
      pipeline: S.pipe.live ? { total: S.pipe.total, bySupport: S.pipe.bySupport,
                                byAgent: S.pipe.byAgent, byStatus: S.pipe.byStatus,
                                oldestDays: S.pipe.oldestDays } : null,
      factfind: S.ff.live ? { year: S.ff.year, week: S.ff.week, month: S.ff.month,
                              queue: S.ff.queue, reviewers: S.ff.reviewers,
                              logging: S.ff.logging, series: S.ff.series } : null,
      reminders: S.rem.live ? S.rem : null,
      quiet: accQuietAgents_(S),
      topics: accTopics_(S),
      days: accDayAll_(S)
    };
  } else if (isUnitMgr_(me)) {
    var unit = accLow_(me.unit || me.name);
    out.unit = {
      name: me.unit || me.name,
      days: accDayAll_(S).filter(function (d) {
        return accLow_(d.unit) === unit || accSameName_(d.name, me.name); }),
      quiet: accQuietAgents_(S).filter(function (q) {
        return accLow_(q.unit) === unit || accLow_(q.unit) === accLow_(me.name); }),
      review: S.ff.live ? S.ff.reviewers.filter(function (r) {
        return accSameName_(r.name, me.name); })[0] || null : null,
      people: readPeople_().filter(function (p) {
        return p.active && p.role === 'agent' &&
               (accLow_(p.unit) === unit || accLow_(p.unit) === accLow_(me.name));
      }).map(function (p) {
        var t = accTopicFor_(p, S);
        return { name: p.name, topic: t.topic, evidence: t.evidence };
      })
    };
  }

  return out;
}

/** The topics for one meeting, for the chair's screen and the agenda. */
function apiDeskTopics_(token, meetingId) {
  var me = requireUser_(token);
  var S = accSnapshot_();
  if (!isStaff_(me) && !isUnitMgr_(me)) {
    /*  An agent gets their own, and nobody else's. */
    var t = accTopicFor_(me, S);
    t.name = me.name; t.role = me.role;
    return { ok: true, mine: t, topics: [] };
  }
  var all = accTopics_(S);
  if (isUnitMgr_(me)) {
    var unit = accLow_(me.unit || me.name);
    all = all.filter(function (t) {
      return accLow_(t.unit) === unit || accSameName_(t.name, me.name); });
  }
  var saved = meetingId ? readTab_(ACC.TAB_TOPIC).filter(function (r) {
    return accStr_(r['Meeting ID']) === accStr_(meetingId); }) : [];
  return { ok: true, topics: all, saved: saved.length,
           mine: accTopicFor_(me, S) };
}

/** Write them onto a meeting. The chair's press, not a trigger's. */
function apiDeskSeedTopics_(body) {
  var me = requireUser_(body.token);
  if (!isStaff_(me)) return { ok: false, error: 'Only the branch may seed the topics.' };
  var out = accSaveTopics_(accStr_(body.meetingId));
  log_('desk-topics', me.email, me.role, accStr_(body.meetingId),
       out.written + ' of ' + out.total);
  return { ok: true, written: out.written, total: out.total };
}

/* ===================================================================
 *  SETUP AND TRIGGERS
 * =================================================================== */

function accSetup() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  Object.keys(ACC_HEAD).forEach(function (name) {
    var sh = ss.getSheetByName(name);
    if (!sh) {
      sh = ss.insertSheet(name);
      sh.appendRow(ACC_HEAD[name]);
      sh.setFrozenRows(1);
      sh.getRange(1, 1, 1, ACC_HEAD[name].length).setFontWeight('bold');
    } else {
      /*  An older tab gains any missing column by name, never by
       *  position: a tab somebody has sorted or added a note column to
       *  must keep working. */
      var head = sh.getRange(1, 1, 1, Math.max(1, sh.getLastColumn())).getValues()[0]
        .map(function (h) { return String(h).trim(); });
      ACC_HEAD[name].forEach(function (h) {
        if (head.indexOf(h) === -1) {
          sh.getRange(1, sh.getLastColumn() + 1).setValue(h).setFontWeight('bold');
        }
      });
    }
  });

  var seeded = accSeedBlocks_();
  accTriggers_();

  var S = accSnapshot_();
  var lines = accSources_(S).map(function (s) {
    return (s.live ? '✓ ' : '✗ ') + s.label + (s.live ? '' : ' — ' + s.why);
  }).join('\n');

  try {
    SpreadsheetApp.getUi().alert('The desk is set up',
      'Tabs built and triggers installed.\n\n' + lines +
      '\n\nThe report goes to ' + accReportTo_() + '.', SpreadsheetApp.getUi().ButtonSet.OK);
  } catch (e) { Logger.log(lines); }
  return lines;
}

/*  Torn down and rebuilt every time, so changing an hour is running
 *  this again — never a second trigger beside the first. */
function accTriggers_() {
  var names = ['accMorning', 'accEvening', 'accManagerDaily', 'accWeekly'];
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (names.indexOf(t.getHandlerFunction()) > -1) ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('accMorning').timeBased().atHour(ACC.MORNING_HOUR).everyDays(1).create();
  ScriptApp.newTrigger('accEvening').timeBased().atHour(ACC.EVENING_HOUR).everyDays(1).create();
  ScriptApp.newTrigger('accManagerDaily').timeBased().atHour(ACC.REPORT_HOUR).everyDays(1).create();
  ScriptApp.newTrigger('accWeekly').timeBased().onWeekDay(ScriptApp.WeekDay.MONDAY)
    .atHour(ACC.WEEKLY_HOUR).create();
}

/* ------------------------- by hand, from the editor ------------------------- */

/** Everything the desk can see right now, in the log. Read this first
 *  when a figure looks wrong: it says which sources answered. */
function accStatus() {
  var S = accSnapshot_();
  var out = accSources_(S).map(function (s) {
    return (s.live ? 'LIVE  ' : 'DOWN  ') + s.label + (s.live ? '' : ' — ' + s.why);
  });
  if (S.pipe.live) {
    out.push('pipeline: ' + S.pipe.total.stuck + ' over ' + ACC.STUCK_DAYS + ' days, ' +
             accMoney_(S.pipe.total.stuckApi));
  }
  if (S.tasks.live) {
    out.push('tasks: ' + S.tasks.total.open + ' open, ' + S.tasks.total.overdue +
             ' overdue, ' + S.tasks.total.waiting + ' waiting on someone');
  }
  if (S.ff.live) {
    out.push('fact finds: ' + S.ff.week.submitted + ' this week, queue ' + S.ff.queue.pending +
             ' (' + S.ff.queue.breaching + ' breaching), conversion ' +
             S.ff.year.conversion + '%');
  }
  Logger.log(out.join('\n'));
  return out.join('\n');
}

/** The report to me alone, marking nothing. */
function accPreview() {
  var S = accSnapshot_();
  var F = accFindings_(S);                        /* not marked: a preview is not a send */
  MailApp.sendEmail({ to: Session.getEffectiveUser().getEmail(),
    subject: '[Preview] The branch today',
    htmlBody: accShell_('The branch, today', '[Preview] ' + MEET.BRANCH,
                        accReportHtml_(S, F, 'day')), name: MEET.BRANCH });
  return F.length + ' findings';
}

/** The routing pass alone, no e-mail. Safe to run any time. */
function accRouteNow() {
  var out = accRoute_();
  Logger.log(JSON.stringify(out));
  return out;
}

/** Every topic, in the log, so the chair can read them before Wednesday. */
function accTopicsNow() {
  var t = accTopics_();
  var s = t.map(function (x) {
    return x.name + ' (' + x.role + ')\n    ' + x.topic + '\n    ' + x.question +
           (x.evidence ? '\n    [' + x.evidence + ']' : '');
  }).join('\n\n');
  Logger.log(s);
  return s;
}

/* ===================================================================
 *  THE DAY — each person's own blocks, read from the tracker's log
 *
 *  "We have built several KPIs and persons are just supposed to click
 *  and log, pulling in the data."
 *
 *  They are, and it is already built: the daily KPI tracker holds every
 *  desk's day as blocks — KPI1, KPI2, PM1, PM2 and the evening — each
 *  with its hours, the work it is for, the Salesforce task type that
 *  work lands in, and the hour it is due by. A person files a block and
 *  the tracker writes KPI1, KPI1_Actioned, KPI1_Resolved, KPI1_Open and
 *  KPI1_Blocker onto their row for that day.
 *
 *  SO THE DESK DOES NOT LOG A BLOCK. It reads the tracker's own log and
 *  presents it. Two systems writing one person's day is how a branch
 *  ends up with two answers to "did she file", and the tracker's answer
 *  is the one the KPIs are graded on. A block the tracker has not got
 *  shows here as a button that opens the tracker at it — one click, one
 *  record.
 *
 *  WHAT THE DESK ADDS is the part the tracker does not ask: the three
 *  narrative lines, the routed items, and the Wednesday topic. A block
 *  is a count; "what is in the way" is a sentence, and a meeting runs
 *  on sentences.
 *
 *  THE BLOCKS LIVE ON A TAB, not in this file. The tracker carries them
 *  in code (SCHEDULE in KPI.gs) and this project cannot see that code,
 *  so accSetup() seeds the Day Blocks tab from the copy below and the
 *  branch edits the tab from then on — which also means changing
 *  somebody's hours is typing, never a paste. accDayCheck() says who on
 *  the People tab has no blocks, so a new desk cannot sit there
 *  unmeasured.
 * =================================================================== */

var ACC_DAY = {
  /*  The tracker's workbook. The same ID Intelligence.gs already
   *  carries, so nothing new is public; the Script Property overrides
   *  it, which is what a test or a second branch uses. */
  PROP_BOOK: 'KPI_SHEET_ID',
  BOOK: '1T1SG3mgs5QV5LuF3JTpmn1zFldhGjOQNoe0YCMhWxjs',

  /*  The log tab is found by its headers, never by its name, because
   *  that is how the tracker itself finds it. */
  FIND: ['StaffId', 'KPI1_Actioned'],

  IDS: ['KPI1', 'KPI2', 'PM1', 'PM2', 'EVE'],
  LABEL: { KPI1: 'KPI 1', KPI2: 'KPI 2', PM1: 'Afternoon 1', PM2: 'Afternoon 2',
           EVE: 'After four' },

  /*  Where a person goes to file one. The tracker's own front door. */
  TRACKER_URL: 'https://rickyrampersadbranch.com/kpi/'
};

/*  The seed, copied from the tracker's SCHEDULE on 17 October 2026.
 *  IT IS A SEED AND NOT THE TRUTH: once the tab exists, the tab wins,
 *  and accSetup() never writes over a tab that has rows. Hours here
 *  that have since changed in the tracker are a tab edit, not a paste.
 *  Staff Id is the lowercase first name, which is what the tracker's
 *  log keys on. */
var ACC_SEED_BLOCKS = [
  ['sasha', '8am – 4pm', '12:30 – 1:30pm', [
    ['KPI1', '8 – 10am',  'Premium Dues / Surveys',                      'Renewa/PDl/Bill', 10],
    ['KPI2', '10 – 12pm', 'Ind. Health Billing Recon / Send Off',        'Renewa/PDl/Bill', 12],
    ['PM1',  '1 – 3pm',   'Adopt an Orphan / Service Quest. / Quotations','Orphan Adoption Listing', 15],
    ['PM2',  '3 – 4pm',   'Task Mgmt / Branch Meeting Reports',          'Reporting', 16]]],
  ['azariah', '8am – 4pm', '12:00 – 1:00pm', [
    ['KPI1', '8 – 10am',  'Pendings, Increases, Group Apps / Production', 'Pendings', 10],
    ['KPI2', '10 – 12pm', 'Reinstatements / Lapse Mgmt / Reporting',      'Renewa/PDl/Bill', 12],
    ['PM1',  '1 – 3pm',   'Query Pal Management / Survey Mgmt',           'Surveys / Query Pal', 15],
    ['PM2',  '3 – 4pm',   'Task Mgmt / Branch Meeting Reports',           'Reporting', 16]]],
  ['kamla', '8am – 4pm', 'Flexible', [
    ['KPI1', '8 – 9am',   'HR, SA, RECR, CB',                             'Lic/Staffing/SA/HR', 10],
    ['KPI2', '10 – 12pm', 'BM Client Mgt / RR Oper / General lines',       'Administrative Support', 12],
    ['PM1',  '1 – 3pm',   'Escalations / New Recruit Training',            'Escalations', 15],
    ['PM2',  '3 – 4pm',   'Task Mgmt / Branch Meeting Reports',           'Reporting (Production / RDAR)', 16]]],
  ['pawan', '8am – 4pm', 'Flexible', [
    ['KPI1', '8 – 10am',  'Mail in, contracts logged',                    'Mail Management / Contracts', 10],
    ['KPI2', '10 – 12pm', 'Document delivery & collection',               'Document delivery & collection', 12],
    ['PM1',  '1 – 3pm',   'Scripts & transmittals',                       'Scripts & transmittals', 15],
    ['PM2',  '3 – 4pm',   'Branch Manager support',                       'Branch Manager support', 16]]],
  ['ashley', '9am – 5pm', 'Flexible', [
    ['KPI1', '9 – 10am',  'Client Portfolio creation / Macros / Surveys',  'Client Portfolios / Macros', 10],
    ['KPI2', '10 – 12pm', 'New Application Process',                      'New Application Process', 12],
    ['PM1',  '1 – 3pm',   'Quotations & Proposals',                       'Quotations & Proposals', 15],
    ['PM2',  '3 – 5pm',   'Administrative Support',                       'Administrative Support', 16]]],
  ['elizabeth', '9am – 5pm', 'Flexible', [
    ['KPI1', '9 – 11am',  'Branch Intelligence / Query Pal testing',      'Surveys / Query Pal', 10],
    ['KPI2', '11 – 12pm', 'Reporting',                                    'Reporting', 12],
    ['PM1',  '1 – 3pm',   'Task Management',                              'Task Management', 15],
    ['PM2',  '3 – 5pm',   'Administrative Support',                       'Administrative Support', 16]]],
  /*  The branch manager's day is the one that runs the wall's full
   *  envelope, because it is the one that does: five in the morning to
   *  midnight. That is why his report is written for five. */
  ['ricky', '5am – 12am', 'Flexible', [
    ['KPI1', '5 – 10am',  'Recruitment, licensing and staffing',          'Lic/Staffing/SA/HR', 10],
    ['KPI2', '10 – 12pm', 'Production, pipeline and own book',            'Opportunity', 12],
    ['PM1',  '1 – 3pm',   'Agent development and field training',         'Training', 15],
    ['PM2',  '3 – 4pm',   'Escalations, reporting and branch team',       'Reporting (Production / RDAR / Branch Meeting)', 16],
    ['EVE',  '4pm – 12am','After four: what is still being moved',        'Opportunity', 24]]],
  ['kerwyn', '8am – 5pm', 'Flexible', [
    ['KPI1', '8 – 10am',  'Recruitment intake and agent school',          'Lic/Staffing/SA/HR', 10],
    ['KPI2', '10 – 12pm', 'Unit manager supervision',                     'Unit Manager Supervision', 12],
    ['PM1',  '1 – 3pm',   'Joint field work and pipeline',                'Opportunity', 15],
    ['PM2',  '3 – 5pm',   'Persistency and reporting',                    'Reporting (Production / RDAR)', 16]]],
  ['akaash', '8am – 4:30pm', 'Flexible', [
    ['KPI1', '8 – 10am',  'Unit activity and pipeline',                   'Opportunity', 10],
    ['KPI2', '10 – 12pm', 'Joint field work',                             'Joint Field Work', 12],
    ['PM1',  '1 – 3pm',   'Recruitment and agent licensing',              'Lic/Staffing/SA/HR', 15],
    ['PM2',  '3 – 4:30pm','Unit persistency and own book',                'Pendings', 16]]],
  ['gary', '8am – 4:30pm', 'Flexible', [
    ['KPI1', '8 – 10am',  'Unit activity and pipeline',                   'Opportunity', 10],
    ['KPI2', '10 – 12pm', 'Joint field work',                             'Joint Field Work', 12],
    ['PM1',  '1 – 3pm',   'Recruitment and agent licensing',              'Lic/Staffing/SA/HR', 15],
    ['PM2',  '3 – 4:30pm','Unit persistency and own book',                'Pendings', 16]]]
];

/*  Which Salesforce task type a block's work lands in, so "closed four
 *  pendings" can sit beside the block that was for pendings. Copied
 *  from BLOCK_TYPE in KPI.gs: six labels are task types letter for
 *  letter and every other label is work Salesforce does not type, which
 *  maps to nothing rather than to a guess. */
var ACC_BLOCK_TYPE = {
  'Renewa/PDl/Bill': 'Renewa/PDl/Bill', 'Pendings': 'Pendings',
  'Scripts/CB': 'Scripts/CB', 'Lic/Staffing/SA/HR': 'Lic/Staffing/SA/HR',
  'Opportunity': 'Opportunity', 'Training': 'Training'
};

function accSeedBlocks_() {
  var sh = tab_(ACC.TAB_BLOCKS);
  if (sh.getLastRow() > 1) return 0;              /* the tab wins, always */
  var rows = [];
  ACC_SEED_BLOCKS.forEach(function (p) {
    p[3].forEach(function (b) {
      rows.push({ 'Staff Id': p[0], 'Name': '', 'Hours': p[1], 'Lunch': p[2],
                  'Block': b[0], 'Time': b[1], 'Focus': b[2], 'KPI': b[3],
                  'Due by': b[4], 'Task type': ACC_BLOCK_TYPE[b[3]] || '',
                  'Active': 'Yes' });
    });
  });
  appendRows_(ACC.TAB_BLOCKS, rows);
  return rows.length;
}

/** The whole tab, as { staffId: { hours, lunch, blocks: [...] } }. */
function accBlockTab_() {
  var out = {};
  readTab_(ACC.TAB_BLOCKS).forEach(function (r) {
    if (accLow_(r['Active']) === 'no') return;
    var id = accLow_(r['Staff Id']);
    if (!id) return;
    if (!out[id]) out[id] = { staffId: id, name: accStr_(r['Name']),
                              hours: accStr_(r['Hours']), lunch: accStr_(r['Lunch']),
                              blocks: [] };
    out[id].blocks.push({ id: accStr_(r['Block']).toUpperCase(),
                          time: accStr_(r['Time']), focus: accStr_(r['Focus']),
                          kpi: accStr_(r['KPI']), due: accNum_(r['Due by']),
                          type: accStr_(r['Task type']) });
  });
  Object.keys(out).forEach(function (k) {
    out[k].blocks.sort(function (a, b) {
      return ACC_DAY.IDS.indexOf(a.id) - ACC_DAY.IDS.indexOf(b.id); });
  });
  return out;
}

/*  A person's Staff Id. The tracker keys its log on the lowercase first
 *  name, so that is what this returns — and a person whose first name
 *  is not on the Day Blocks tab has no blocks rather than somebody
 *  else's. */
function accStaffId_(person) {
  return accLow_(person.name).split(/\s+/)[0];
}

/* ------------------- the tracker's log, read only ------------------- */

function accTrackerBook_() {
  var id = accStr_(PropertiesService.getScriptProperties().getProperty(ACC_DAY.PROP_BOOK))
           || ACC_DAY.BOOK;
  return SpreadsheetApp.openById(id);
}

/** Today's filed blocks, as { staffId: { KPI1: {kpi, actioned, resolved,
 *  open, blocker}, ... } }. Cached, and never throws: the tracker being
 *  unreachable must leave the day view standing. */
function accFiled_(dayKey) {
  return accCached_('filed.' + dayKey, function () {
    try {
      var ss = accTrackerBook_(), sh = null;
      var want = ACC_DAY.FIND.map(function (h) { return h.toLowerCase(); });
      ss.getSheets().forEach(function (s) {
        if (sh) return;
        if (s.getLastRow() < 1) return;
        var head = s.getRange(1, 1, 1, Math.max(1, s.getLastColumn())).getValues()[0]
          .map(function (h) { return String(h).trim().toLowerCase(); });
        if (want.every(function (w) { return head.indexOf(w) > -1; })) sh = s;
      });
      if (!sh) {
        return { live: false, why: 'No KPI Log tab in the tracker workbook (it is the tab ' +
                                   'with StaffId and KPI1_Actioned columns).', rows: {} };
      }
      var head = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0]
        .map(function (h) { return String(h).trim(); });
      var ix = {};
      head.forEach(function (h, i) { ix[h] = i; });
      if (!('Date' in ix) || !('StaffId' in ix)) {
        return { live: false, why: 'The tracker log has no Date or StaffId column.', rows: {} };
      }

      /*  Read the tail only. The log is unbounded — it is a row per
       *  person per day, for ever — and the desk wants one day of it. */
      var last = sh.getLastRow();
      if (last < 2) return { live: true, rows: {} };
      var from = Math.max(2, last - 400);
      var vals = sh.getRange(from, 1, last - from + 1, head.length).getValues();

      var rows = {};
      vals.forEach(function (r) {
        var d = r[ix['Date']];
        var key = (d instanceof Date) ? accDayKey_(d) : accStr_(d).slice(0, 10);
        if (key !== dayKey) return;
        var id = accLow_(r[ix['StaffId']]);
        if (!id) return;
        var one = {};
        ACC_DAY.IDS.forEach(function (b) {
          one[b] = {
            kpi:      (b in ix) ? accStr_(r[ix[b]]) : '',
            actioned: ((b + '_Actioned') in ix) ? accStr_(r[ix[b + '_Actioned']]) : '',
            resolved: ((b + '_Resolved') in ix) ? accStr_(r[ix[b + '_Resolved']]) : '',
            open:     ((b + '_Open') in ix) ? accStr_(r[ix[b + '_Open']]) : '',
            blocker:  ((b + '_Blocker') in ix) ? accStr_(r[ix[b + '_Blocker']]) : ''
          };
        });
        rows[id] = one;                          /* a later row wins */
      });
      return { live: true, rows: rows };
    } catch (err) {
      return { live: false, rows: {},
               why: 'The tracker workbook would not open: ' + accShortErr_(err) +
                    ' Set ' + ACC_DAY.PROP_BOOK + ' if it has moved.' };
    }
  });
}

/*  ONE PERSON'S DAY. Each block with where it stands, and the Salesforce
 *  figure for the work it is for, pulled in rather than asked for.
 *
 *  The states, and why each one is its own word rather than a colour:
 *    filed    the tracker has it
 *    late     the hour it was due by has gone and it is not filed
 *    now      this is the block the clock is in
 *    ahead    still to come
 *  Nothing here grades anybody. A block is late or it is not; what it
 *  means is the sentence the person writes beside it.                 */
function accDayFor_(person, S) {
  S = S || accSnapshot_();
  var now = new Date(), hour = now.getHours();
  var id = accStaffId_(person);
  var tab = accBlockTab_(), mine = tab[id];
  var filed = accFiled_(accDayKey_(now));
  var got = (filed.rows || {})[id] || null;

  if (!mine) {
    return { live: filed.live, why: filed.why || '',
             staffId: id, hours: '', lunch: '', blocks: [],
             none: 'No day blocks on file for ' + person.name.split(/\s+/)[0] +
                   '. Add them on the Day Blocks tab and this fills itself.' };
  }

  /*  The desk's own Salesforce counts for this person today, by task
   *  type, so a block for pendings can say how many pendings moved.
   *  Only what this project can see: the task owner's name has to match
   *  the person, which is true for staff and never for an agent. */
  var byType = (S.tasks.live && (S.tasks.byTypeFor || {})[accLow_(person.name)]) || {};

  var blocks = mine.blocks.map(function (b) {
    var f = got ? got[b.id] : null;
    var isFiled = !!(f && (f.actioned || f.kpi));
    var state = isFiled ? 'filed'
              : (b.due && hour >= b.due) ? 'late'
              : accBlockNow_(b, hour) ? 'now' : 'ahead';
    return {
      id: b.id, label: ACC_DAY.LABEL[b.id] || b.id,
      time: b.time, focus: b.focus, kpi: b.kpi, due: b.due, type: b.type,
      state: state, filed: isFiled,
      actioned: f ? f.actioned : '', resolved: f ? f.resolved : '',
      open: f ? f.open : '', blocker: f ? f.blocker : '',
      /*  What Salesforce says moved in this block's own kind of work
       *  today. Null, not zero, when the type is work Salesforce does
       *  not type — a zero there would read as a wasted morning. */
      sf: b.type && byType[b.type] !== undefined ? byType[b.type] : null
    };
  });

  var owed = blocks.length, inHand = blocks.filter(function (b) { return b.filed; }).length;
  return {
    live: filed.live, why: filed.why || '',
    staffId: id, hours: mine.hours, lunch: mine.lunch,
    blocks: blocks, owed: owed, filed: inHand,
    late: blocks.filter(function (b) { return b.state === 'late'; }).length,
    trackerUrl: ACC_DAY.TRACKER_URL
  };
}

/*  Whether the clock is inside a block. The tab's times are written for
 *  people — "8 – 10am", "3 – 4:30pm" — so the hour is read off the
 *  front of the range and the block runs until the next one starts. */
function accBlockNow_(b, hour) {
  var m = accStr_(b.time).match(/^(\d+)/);
  if (!m) return false;
  var start = Number(m[1]);
  var pm = /pm/i.test(accStr_(b.time)) && start < 12;
  if (pm && b.id !== 'KPI1') start += 12;
  if (/^(PM1|PM2|EVE)$/.test(b.id) && start < 12) start += 12;
  return hour >= start && (!b.due || hour < b.due);
}

/** Every desk's day, for the branch and for a unit manager's team. */
function accDayAll_(S) {
  S = S || accSnapshot_();
  var out = [];
  readPeople_().forEach(function (p) {
    if (!p.active || p.role === 'guest' || p.role === 'agent') return;
    var d = accDayFor_(p, S);
    if (!d.blocks.length) return;
    out.push({ name: p.name, role: p.role, unit: p.unit || '',
               hours: d.hours, owed: d.owed, filed: d.filed, late: d.late,
               blocks: d.blocks });
  });
  return out.sort(function (a, b) { return b.late - a.late || a.name.localeCompare(b.name); });
}

/** Who on the People tab has no blocks. Run after adding a desk. */
function accDayCheck() {
  var tab = accBlockTab_(), missing = [], extra = [];
  var have = {};
  readPeople_().forEach(function (p) {
    if (!p.active || p.role === 'guest' || p.role === 'agent') return;
    var id = accStaffId_(p);
    have[id] = true;
    if (!tab[id]) missing.push(p.name + ' (' + id + ')');
  });
  Object.keys(tab).forEach(function (id) {
    if (!have[id]) extra.push(id);
  });
  var msg = (missing.length ? 'No blocks on file for: ' + missing.join(', ') + '\n'
                            : 'Every desk on the People tab has blocks.\n') +
            (extra.length ? 'Blocks for nobody active: ' + extra.join(', ') : '');
  Logger.log(msg);
  return msg;
}
