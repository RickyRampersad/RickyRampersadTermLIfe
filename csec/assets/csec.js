/* CSEC Study Hub — core engine
 *
 * Profiles, storage, the mastery model, spaced repetition and the daily plan.
 * Everything lives in this browser. There is no server behind this site, so a
 * login here is a profile lock on this device, not an account — see README.
 */
(function (global) {
  'use strict';

  var NS = 'csec.';
  var C = global.CSEC_CURRICULUM || { subjects: {}, defaultSelection: [], roadmap: [], resources: {} };
  var Q = global.CSEC_QUESTIONS || [];

  /* ------------------------------ storage ------------------------------ */
  function read(key, fallback) {
    try { var v = localStorage.getItem(NS + key); return v ? JSON.parse(v) : fallback; }
    catch (e) { return fallback; }
  }
  function write(key, val) {
    try { localStorage.setItem(NS + key, JSON.stringify(val)); return true; }
    catch (e) { return false; }
  }

  /* ------------------------------ profiles ----------------------------- */
  /* profile = {id, name, role, form, school, pin, subjects[], linked[]} */
  /* Profiles written before the ladder went to ten levels stored `form` 1-5.
     Migrate on read: Form N is level N + 5. Done here rather than in a one-off
     script so a device that has been offline for a month still upgrades itself. */
  function migrateLevel(p) {
    if (p && p.level == null && p.form != null) {
      p.level = Number(p.form) + 5;
      delete p.form;
    }
    return p;
  }

  function profiles() {
    var list = read('profiles', []);
    var changed = false;
    list.forEach(function (p) {
      if (p && p.level == null && p.form != null) { migrateLevel(p); changed = true; }
    });
    if (changed) write('profiles', list);
    return list;
  }
  function saveProfiles(list) { write('profiles', list); }
  function profile(id) {
    var all = profiles();
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return null;
  }
  function students() { return profiles().filter(function (p) { return p.role === 'student'; }); }

  /* A forgotten PIN is the commonest support call there is, so every profile
     gets a recovery code at creation. It is stored beside the PIN, which means
     it protects against forgetfulness, not against somebody holding the device
     — exactly what it is described as doing in the interface. */
  function newRecovery() {
    var abc = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789', s = '';
    for (var i = 0; i < 6; i++) s += abc.charAt(Math.floor(Math.random() * abc.length));
    return s;
  }

  /* A Standard 3 should not open the app to a fourteen-subject CSEC timetable. */
  function defaultsFor(level) {
    return level <= 5 ? (C.defaultPrimary || []).slice() : (C.defaultSelection || []).slice();
  }

  function createProfile(o) {
    var all = profiles();
    var p = {
      id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: (o.name || '').trim() || 'Unnamed',
      role: o.role || 'student',
      level: o.level || 8,
      school: o.school || '',
      pin: String(o.pin || '').trim(),
      subjects: o.subjects || defaultsFor(o.level || 8),
      linked: o.linked || [],
      created: Date.now(),
      updatedAt: Date.now(),
      recovery: newRecovery()
    };
    all.push(p); saveProfiles(all); return p;
  }
  function updateProfile(id, patch) {
    var all = profiles();
    for (var i = 0; i < all.length; i++) {
      if (all[i].id === id) {
        for (var k in patch) all[i][k] = patch[k];
        all[i].updatedAt = Date.now();
        saveProfiles(all); return all[i];
      }
    }
    return null;
  }
  function deleteProfile(id) {
    saveProfiles(profiles().filter(function (p) { return p.id !== id; }));
    try { localStorage.removeItem(NS + 'progress.' + id); } catch (e) {}
  }

  /* Reset by somebody already signed in on this device — a parent or teacher
     helping a child back in. */
  function resetPin(profileId, newPin) {
    if (!/^\d{4,6}$/.test(String(newPin || ''))) return { ok: false, msg: 'PIN must be 4 to 6 digits.' };
    var p = profile(profileId);
    if (!p) return { ok: false, msg: 'Profile not found.' };
    updateProfile(profileId, { pin: String(newPin) });
    return { ok: true };
  }

  /* Reset by the person themselves, using the code they were shown at sign-up.
     Older profiles created before recovery codes existed get one on first use
     rather than being locked out. */
  function recoverWithCode(profileId, code, newPin) {
    var p = profile(profileId);
    if (!p) return { ok: false, msg: 'Profile not found.' };
    if (!p.recovery) return { ok: false, msg: 'This profile has no recovery code. Ask a parent or teacher signed in on this device to reset it.' };
    if (String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '') !== p.recovery) {
      return { ok: false, msg: 'That recovery code does not match.' };
    }
    if (!/^\d{4,6}$/.test(String(newPin || ''))) return { ok: false, msg: 'New PIN must be 4 to 6 digits.' };
    updateProfile(profileId, { pin: String(newPin), recovery: newRecovery() });
    return { ok: true, recovery: profile(profileId).recovery };
  }

  /* ------------------------------- session ----------------------------- */
  function signIn(id, pin) {
    var p = profile(id);
    if (!p) return { ok: false, msg: 'Profile not found.' };
    if (p.pin && String(pin || '') !== p.pin) return { ok: false, msg: 'That PIN does not match.' };
    try { sessionStorage.setItem(NS + 'session', JSON.stringify({ id: id, at: Date.now() })); } catch (e) {}
    return { ok: true, profile: p };
  }
  function current() {
    try {
      var s = JSON.parse(sessionStorage.getItem(NS + 'session') || 'null');
      return s ? profile(s.id) : null;
    } catch (e) { return null; }
  }
  function signOut() { try { sessionStorage.removeItem(NS + 'session'); } catch (e) {} }

  /* Send an unauthenticated visitor back to the front door. */
  function requireRole(roles, redirect) {
    var p = current();
    if (!p || (roles && roles.indexOf(p.role) === -1)) {
      location.href = redirect || 'index.html';
      return null;
    }
    return p;
  }

  /* ------------------------------ progress ----------------------------- */
  /* progress = {strands:{id:{seen,correct,run,ease,interval,due,last}},
                 sessions:[...], days:[iso], notes:{}, goals:{}}          */
  function blankProgress() {
    return { strands: {}, sessions: [], days: [], notes: {}, goals: {},
             history: [], tests: [], terms: {}, _v: 2 };
  }

  /* The same lazy upgrade the profiles get, applied to the record underneath.
     Term snapshots, timed tests and promotion rows all stamped `form` 1-5
     before the ladder went to ten levels, and the KPI chart reads that stamp
     to band the timeline. Left alone it renders "Level undefined" against a
     real child's five terms of work.

     Terms and tests are safe to convert on sight: nothing written after the
     ladder change sets `form` at all. Promotion rows are not — `from: 1, to: 2`
     is a genuine Standard 1 to Standard 2 move as well as an old Form 1 to
     Form 2 one. So new rows carry `v: 2`, and an unmarked row is only treated
     as old when the same record still holds a `form`-stamped term or test.
     That evidence is reliable because promote() snapshots the term before it
     writes the row, so the two are always written together. */
  function migrateProgress(p) {
    if (!p || typeof p !== 'object' || p._v >= 2) return false;
    var sawForm = false;

    Object.keys(p.terms || {}).forEach(function (k) {
      var t = p.terms[k];
      if (t && t.level == null && t.form != null) {
        t.level = Number(t.form) + 5; delete t.form; sawForm = true;
      }
    });
    (p.tests || []).forEach(function (t) {
      if (t && t.level == null && t.form != null) {
        t.level = Number(t.form) + 5; delete t.form; sawForm = true;
      }
    });
    if (sawForm) {
      (p.history || []).forEach(function (h) {
        if (h && h.v == null && h.from != null && h.to != null) {
          h.from = Number(h.from) + 5; h.to = Number(h.to) + 5; h.v = 2;
        }
      });
    }
    p._v = 2;
    return true;
  }

  function progress(studentId) {
    var p = read('progress.' + studentId, blankProgress());
    if (migrateProgress(p)) write('progress.' + studentId, p);
    return p;
  }
  function saveProgress(studentId, p) {
    p._t = Date.now();          /* version stamp the sync merge compares on */
    write('progress.' + studentId, p);
  }

  function today() { return new Date().toISOString().slice(0, 10); }
  function daysBetween(a, b) { return Math.round((new Date(b) - new Date(a)) / 86400000); }

  /* Record one answered question. Drives both mastery and scheduling. */
  function recordAnswer(studentId, question, wasCorrect) {
    var p = progress(studentId);
    var s = p.strands[question.strand] || { seen: 0, correct: 0, run: 0, ease: 2.2, interval: 0, due: 0, last: 0 };

    s.seen++;
    if (wasCorrect) {
      s.correct++; s.run++;
      s.ease = Math.min(2.8, s.ease + 0.08);
      /* SM-2 lite: first correct comes back tomorrow, then the gap widens. */
      s.interval = s.interval < 1 ? 1 : Math.min(30, Math.round(s.interval * s.ease));
    } else {
      s.run = 0;
      s.ease = Math.max(1.3, s.ease - 0.2);
      s.interval = 0;                      /* a miss is due again immediately */
    }
    if (!s.first) s.first = Date.now();
    s.last = Date.now();
    s.due = Date.now() + s.interval * 86400000;
    /* Attempt log. Retention — can she still do it a week later? — is the
       single best predictor of an examination grade, and it cannot be
       computed from running totals alone. Capped so storage stays small. */
    s.log = (s.log || []).concat([{ t: s.last, c: wasCorrect ? 1 : 0 }]).slice(-24);
    p.strands[question.strand] = s;
    saveProgress(studentId, p);
    return s;
  }

  /* Close out a practice run and update the streak. */
  function recordSession(studentId, info) {
    var p = progress(studentId);
    p.sessions.push({
      date: today(), at: Date.now(), subj: info.subj || 'mixed',
      n: info.n || 0, correct: info.correct || 0, secs: info.secs || 0
    });
    if (p.sessions.length > 400) p.sessions = p.sessions.slice(-400);
    if (p.days.indexOf(today()) === -1) p.days.push(today());
    saveProgress(studentId, p);
    snapshotTerm(studentId);
    if (global.CSEC_SYNC) global.CSEC_SYNC.autoSync();
    return p;
  }

  /* Trinidad and Tobago school year: Term 1 Sept-Dec, Term 2 Jan-Mar,
     Term 3 Apr-Jul. Returns e.g. {key:'2026/27 T1', year:'2026/27', term:1}. */
  function termOf(d) {
    d = d || new Date();
    var m = d.getMonth(), y = d.getFullYear(), term, startYear;
    if (m >= 8)      { term = 1; startYear = y; }
    else if (m <= 3) { term = 2; startYear = y - 1; }
    else             { term = 3; startYear = y - 1; }
    var label = startYear + '/' + String((startYear + 1) % 100).padStart(2, '0');
    return { key: label + ' T' + term, year: label, term: term, startYear: startYear };
  }

  /* One snapshot per term, overwritten as the term goes on, so the timeline
     always shows where each term actually finished. */
  function snapshotTerm(studentId) {
    var prof = profile(studentId); if (!prof) return;
    var p = progress(studentId), t = termOf();
    var subs = {};
    (prof.subjects || []).forEach(function (id) {
      var st = subjectStat(studentId, id);
      if (st.seen) subs[id] = { pct: st.pct, seen: st.seen };
    });
    var ov = overallStat(studentId);
    p.terms = p.terms || {};
    p.terms[t.key] = {
      key: t.key, year: t.year, term: t.term, level: prof.level,
      at: Date.now(), pct: ov.pct, seen: ov.seen,
      coverage: coverage(studentId).pct, subjects: subs
    };
    saveProgress(studentId, p);
  }

  /* Ordered oldest-first, which is how the timeline reads. */
  function termHistory(studentId) {
    var p = progress(studentId);
    return Object.keys(p.terms || {})
      .map(function (k) { return p.terms[k]; })
      .sort(function (a, b) { return a.at - b.at; });
  }

  /* Moving up a form. Mastery carries forward — she has not forgotten Form 2
     maths — but the year is stamped into the record so the history survives. */
  function promote(studentId, toLevel) {
    var prof = profile(studentId); if (!prof) return null;
    var from = prof.level, to = toLevel || Math.min(10, from + 1);
    if (to === from || to < 1 || to > 10) return null;
    snapshotTerm(studentId);
    var p = progress(studentId), ov = overallStat(studentId);
    p.history = p.history || [];
    p.history.push({
      at: Date.now(), date: today(), from: from, to: to, v: 2,
      pct: ov.pct, seen: ov.seen, coverage: coverage(studentId).pct,
      term: termOf().key
    });
    saveProgress(studentId, p);

    /* Crossing out of primary: a child arriving in Form 1 still ticked for
       Standard-level Mathematics and ELA Writing would get a daily plan full of
       subjects that no longer exist for them. Swap the ticks once, and only when
       every subject they hold belongs to the stage they are leaving. */
    var patch = { level: to };
    var crossing = from <= 5 && to >= 6;
    var backwards = from >= 6 && to <= 5;
    if (crossing || backwards) {
      var leaving = crossing ? 'primary' : 'secondary';
      var allFromOldStage = (prof.subjects || []).length && (prof.subjects || []).every(function (id) {
        var subj = C.subjects[id];
        if (!subj) return false;
        return (subj.stage === 'primary') === (leaving === 'primary');
      });
      if (allFromOldStage) patch.subjects = defaultsFor(to);
    }
    updateProfile(studentId, patch);
    return { from: from, to: to, crossedSEA: crossing, subjectsReset: !!patch.subjects };
  }

  /* ---------------------------- the journey ---------------------------- */
  function levelInfo(level) {
    var l = (C.levels || []).filter(function (x) { return x.n === level; });
    return l[0] || null;
  }
  /* The one place a level number becomes words. Everything on screen uses it,
     so "Standard 3" and "Form 2" never have to be spelled out in a template. */
  function levelLabel(level) {
    var l = levelInfo(level);
    if (l) return l.label;
    /* An old record with no level at all must read as absent, not as the
       words "Level undefined" printed across a chart. */
    return (level == null || isNaN(Number(level))) ? '\u2014' : ('Level ' + level);
  }
  /* Short form for the chart bands and table columns, with the same
     absent-means-dash rule as levelLabel. */
  function levelShort(level) {
    var l = levelInfo(level);
    if (l) return l.short;
    return (level == null || isNaN(Number(level))) ? '\u2014' : ('L' + level);
  }
  function stageOf(level) {
    var st = (C.stages || []).filter(function (s) {
      return s.levels && s.levels.indexOf(level) > -1;
    });
    return st[0] || null;
  }
  function roadmapFor(level) {
    var r = (C.roadmap || []).filter(function (x) { return x.level === level; });
    return r[0] || null;
  }

  /* Where the student is standing right now: form, term, what the term is for,
     and what is coming. This is what makes the year guided rather than a list. */
  function journeyNow(studentId) {
    var prof = profile(studentId); if (!prof) return null;
    var t = termOf(), year = roadmapFor(prof.level);
    if (!year) return null;
    var term = year.terms.filter(function (x) { return x.n === t.term; })[0] || year.terms[0];

    /* Milestones still ahead, nearest first, across the rest of the ladder —
       SEA and CSEC both, so a Standard 3 can see what is coming in Form 5. */
    var ahead = [];
    (C.roadmap || []).forEach(function (r) {
      if (r.level < prof.level) return;
      (r.milestones || []).forEach(function (m) {
        if (r.level === prof.level && m.term < t.term) return;
        ahead.push({ level: r.level, term: m.term, what: m.what, why: m.why,
                     when: levelLabel(r.level) + ', Term ' + m.term,
                     now: r.level === prof.level && m.term === t.term });
      });
    });
    ahead.sort(function (a, b) { return (a.level - b.level) || (a.term - b.term); });

    return {
      level: prof.level, label: levelLabel(prof.level), stage: stageOf(prof.level), year: year,
      term: term, termNo: t.term, termKey: t.key, schoolYear: t.year,
      milestones: ahead, exam: countdown(prof.level)
    };
  }

  /* Strands that are NEW to the student this year — taught in this form but not
     in the one below. This is "pull in what is relevant for the year she is in". */
  function newThisYear(studentId) {
    var prof = profile(studentId); if (!prof) return [];
    var out = [];
    (prof.subjects || []).forEach(function (id) {
      var subj = C.subjects[id]; if (!subj) return;
      subj.strands.forEach(function (t) {
        var now = t.levels.indexOf(prof.level) > -1;
        var before = prof.level > 1 && t.levels.indexOf(prof.level - 1) > -1;
        if (now && !before) {
          out.push({ subj: id, subjName: subj.name, icon: subj.icon,
                     strand: t.id, strandName: t.name, note: t.note,
                     stat: strandStat(studentId, t.id) });
        }
      });
    });
    return out;
  }

  /* Strands from earlier forms that are still weak — the debt carried into
     this year, which is what actually sinks a Form 4. */
  function carriedForward(studentId, maxPct) {
    var prof = profile(studentId); if (!prof) return [];
    var cap = maxPct == null ? 60 : maxPct, out = [];
    (prof.subjects || []).forEach(function (id) {
      var subj = C.subjects[id]; if (!subj) return;
      subj.strands.forEach(function (t) {
        var earlier = t.levels.some(function (f) { return f < prof.level; });
        if (!earlier) return;
        var st = strandStat(studentId, t.id);
        if (st.pct != null && st.pct < cap && st.seen >= 2) {
          out.push({ subj: id, subjName: subj.name, icon: subj.icon,
                     strand: t.id, strandName: t.name, note: t.note, stat: st });
        }
      });
    });
    out.sort(function (a, b) { return a.stat.pct - b.stat.pct; });
    return out;
  }

  /* ------------------------------- KPIs -------------------------------- */
  /* Syllabus coverage: strands attempted, against those taught up to the
     student's current form. Judging a Form 2 against the Form 5 syllabus
     would be meaningless. */
  function coverage(studentId, subjId) {
    var prof = profile(studentId); if (!prof) return { pct: 0, done: 0, total: 0 };
    var p = progress(studentId), done = 0, total = 0;
    var list = subjId ? [subjId] : (prof.subjects || []);
    list.forEach(function (id) {
      var subj = C.subjects[id]; if (!subj) return;
      subj.strands.forEach(function (t) {
        var taught = t.levels.some(function (f) { return f <= prof.level; });
        if (!taught) return;
        total++;
        var st = p.strands[t.id];
        if (st && st.seen) done++;
      });
    });
    return { pct: total ? Math.round(100 * done / total) : 0, done: done, total: total };
  }

  /* Retention: accuracy on attempts made at least 7 days after a strand was
     first seen. This is what separates a student who has revised from one who
     has crammed, and it is the number worth arguing about. */
  function retention(studentId, subjId) {
    var prof = profile(studentId); if (!prof) return { pct: null, n: 0 };
    var p = progress(studentId), n = 0, ok = 0;
    var list = subjId ? [subjId] : (prof.subjects || []);
    list.forEach(function (id) {
      var subj = C.subjects[id]; if (!subj) return;
      subj.strands.forEach(function (t) {
        var st = p.strands[t.id];
        if (!st || !st.first || !st.log) return;
        st.log.forEach(function (a) {
          if (a.t - st.first >= 7 * 86400000) { n++; ok += a.c; }
        });
      });
    });
    return { pct: n ? Math.round(100 * ok / n) : null, n: n };
  }

  /* Timed-test performance, overall or for one subject. */
  function testStat(studentId, subjId) {
    var p = progress(studentId);
    var list = (p.tests || []).filter(function (t) { return !subjId || t.subj === subjId; });
    if (!list.length) return { pct: null, n: 0, best: null, last: null };
    var sum = 0, best = 0;
    list.forEach(function (t) { sum += t.pct; if (t.pct > best) best = t.pct; });
    return { pct: Math.round(sum / list.length), n: list.length, best: best, last: list[list.length - 1] };
  }

  function recordTest(studentId, result) {
    var p = progress(studentId);
    p.tests = p.tests || [];
    p.tests.push({
      at: Date.now(), date: today(), subj: result.subj || 'mixed',
      subjName: result.subjName || 'Mixed', n: result.n || 0,
      correct: result.correct || 0, pct: result.pct || 0,
      secs: result.secs || 0, limit: result.limit || 0,
      level: (profile(studentId) || {}).level, strands: result.strands || {},
      /* Which SEA paper this was, when it was one. The papers index reads it
         to show "already sat"; without it every paper looks untouched. */
      sea: result.sea || null
    });
    if (p.tests.length > 200) p.tests = p.tests.slice(-200);
    if (p.days.indexOf(today()) === -1) p.days.push(today());
    saveProgress(studentId, p);
    snapshotTerm(studentId);
    if (global.CSEC_SYNC) global.CSEC_SYNC.autoSync();
    return p;
  }

  /* Readiness Index 0-100.
   *
   * This is an INTERNAL indicator built from practice inside this hub. It is
   * not a CXC prediction and must never be presented as one. Practice accuracy
   * flatters — multiple choice, no time pressure, feedback on every question —
   * so retention and timed tests carry weight, and coverage caps the score
   * because you cannot be ready for a paper you have only seen a third of.
   *
   *   accuracy   40%   can she do it at all
   *   coverage   25%   has she met the syllabus
   *   retention  20%   can she still do it a week later
   *   timed      15%   can she do it against the clock
   *
   * Where retention or timed data is missing, a discounted proxy stands in and
   * the result is flagged provisional rather than quietly inflated.
   */
  function readiness(studentId, subjId) {
    var acc = subjId ? subjectStat(studentId, subjId) : overallStat(studentId);
    if (!acc.seen) return { score: null, provisional: true, thin: true, band: null, parts: null, seen: 0 };

    var cov = coverage(studentId, subjId);
    var ret = retention(studentId, subjId);
    var tst = testStat(studentId, subjId);
    var provisional = acc.seen < 10 || ret.pct === null || tst.pct === null;

    var retVal = ret.pct === null ? acc.pct * 0.85 : ret.pct;
    var tstVal = tst.pct === null ? acc.pct * 0.80 : tst.pct;

    var score = Math.round(acc.pct * 0.40 + cov.pct * 0.25 + retVal * 0.20 + tstVal * 0.15);
    score = Math.max(0, Math.min(100, score));

    /* Below this much evidence a band would be noise. One lucky answer must not
       read as "Grade II track", and ten questions must not read as a crisis. */
    var floor = subjId ? 5 : 15;
    var thin = acc.seen < floor;

    return {
      score: score, provisional: provisional, thin: thin, need: floor - acc.seen,
      band: thin ? null : band(score), seen: acc.seen,
      parts: {
        accuracy:  { v: acc.pct, w: 40 },
        coverage:  { v: cov.pct, w: 25, done: cov.done, total: cov.total },
        retention: { v: ret.pct, w: 20, n: ret.n, proxy: ret.pct === null },
        timed:     { v: tst.pct, w: 15, n: tst.n, proxy: tst.pct === null }
      }
    };
  }

  /* Bands are named for the CSEC grade they track towards, never stated as the
     grade itself. CSEC awards Grades I to VI; I, II and III are passes. */
  function band(score) {
    if (score == null)  return null;
    if (score >= 80)    return { key: 'I',   label: 'Grade I track',  tone: 'good', note: 'Distinction territory. Hold it with timed papers.' };
    if (score >= 65)    return { key: 'II',  label: 'Grade II track', tone: 'good', note: 'A strong pass. Coverage and timed work close the gap to Grade I.' };
    if (score >= 50)    return { key: 'III', label: 'Grade III track',tone: 'gold', note: 'A pass, but not a comfortable one. Target the weakest strands.' };
    if (score >= 35)    return { key: 'IV',  label: 'Below pass',     tone: 'bad',  note: 'Not yet at a passing standard. This subject needs regular time.' };
    return                     { key: 'V',   label: 'Serious gap',    tone: 'bad',  note: 'Start from the syllabus and rebuild this one strand at a time.' };
  }

  /* How many subjects are tracking towards Grade I, and which are furthest off. */
  function distinctionBoard(studentId) {
    var prof = profile(studentId); if (!prof) return { onTrack: 0, total: 0, rows: [] };
    var rows = (prof.subjects || []).map(function (id) {
      var r = readiness(studentId, id);
      return { subj: id, name: (C.subjects[id] || {}).name || id,
               icon: (C.subjects[id] || {}).icon || '📘', r: r };
    });
    /* Rank on evidence, not just on score — a thin 75 is not better than a
       well-practised 68, and sorting it above would send her to the wrong subject. */
    function tier(x) { return x.r.score == null ? 2 : x.r.thin ? 1 : 0; }
    rows.sort(function (a, b) {
      if (tier(a) !== tier(b)) return tier(a) - tier(b);
      if (a.r.score == null) return 0;
      return b.r.score - a.r.score;
    });
    return {
      onTrack: rows.filter(function (x) { return !x.r.thin && x.r.score >= 80; }).length,
      started: rows.filter(function (x) { return x.r.score != null; }).length,
      total: rows.length, rows: rows
    };
  }



  /* Consecutive days ending today or yesterday. */
  function streak(studentId) {
    var days = progress(studentId).days.slice().sort();
    if (!days.length) return { current: 0, best: 0, days: days };
    var best = 1, run = 1;
    for (var i = 1; i < days.length; i++) {
      run = daysBetween(days[i - 1], days[i]) === 1 ? run + 1 : 1;
      if (run > best) best = run;
    }
    var gap = daysBetween(days[days.length - 1], today());
    var cur = 0;
    if (gap <= 1) {
      cur = 1;
      for (var j = days.length - 1; j > 0; j--) {
        if (daysBetween(days[j - 1], days[j]) === 1) cur++; else break;
      }
    }
    return { current: cur, best: best, days: days };
  }

  /* ------------------------------- mastery ----------------------------- */
  function strandStat(studentId, strandId) {
    var s = progress(studentId).strands[strandId];
    if (!s || !s.seen) return { seen: 0, correct: 0, pct: null, due: true, thin: true };
    return {
      seen: s.seen, correct: s.correct,
      pct: Math.round(100 * s.correct / s.seen),
      due: Date.now() >= (s.due || 0),
      thin: s.seen < 3
    };
  }

  function subjectStat(studentId, subjId) {
    var subj = C.subjects[subjId];
    if (!subj) return { seen: 0, correct: 0, pct: null, strands: 0, touched: 0 };
    var pr = progress(studentId), seen = 0, correct = 0, touched = 0;
    subj.strands.forEach(function (t) {
      var s = pr.strands[t.id];
      if (s && s.seen) { seen += s.seen; correct += s.correct; touched++; }
    });
    return {
      seen: seen, correct: correct,
      pct: seen ? Math.round(100 * correct / seen) : null,
      strands: subj.strands.length, touched: touched
    };
  }

  function overallStat(studentId) {
    var p = profile(studentId) || { subjects: [] };
    var seen = 0, correct = 0, subs = 0;
    (p.subjects || []).forEach(function (id) {
      var st = subjectStat(studentId, id);
      seen += st.seen; correct += st.correct; if (st.seen) subs++;
    });
    return { seen: seen, correct: correct, pct: seen ? Math.round(100 * correct / seen) : null, subjectsStarted: subs };
  }

  /* ------------------------------ questions ---------------------------- */
  function questionsFor(subjIds, level, strandIds) {
    return Q.filter(function (q) {
      if (subjIds && subjIds.length && subjIds.indexOf(q.subj) === -1) return false;
      if (strandIds && strandIds.length && strandIds.indexOf(q.strand) === -1) return false;
      /* One level ahead is stretch; more than that is somebody else's year. */
      if (level && q.level > level + 1) return false;
      return true;
    });
  }

  function shuffle(a) {
    var arr = a.slice();
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
    }
    return arr;
  }

  /* Stable within a day, different tomorrow. Without this, a student who has
     not practised yet gets the identical six strands every morning, because
     every untouched strand carries the same score. */
  function daySeed(str) {
    var h = 0, key = str + '|' + today();
    for (var i = 0; i < key.length; i++) { h = ((h << 5) - h + key.charCodeAt(i)) | 0; }
    return Math.abs(h % 1000) / 1000;
  }

  /* ----------------------------- daily plan ---------------------------- */
  /* Ranks every strand the student is carrying, then returns the ones that
     most need work today: overdue first, then weakest, then least practised. */
  function planFor(studentId, howMany) {
    var p = profile(studentId);
    if (!p) return [];
    var pr = progress(studentId);
    var rows = [];

    (p.subjects || []).forEach(function (subjId) {
      var subj = C.subjects[subjId];
      if (!subj) return;
      subj.strands.forEach(function (t) {
        if (t.levels.indexOf(p.level) === -1) return;      /* not taught this year */
        if (!questionsFor([subjId], p.level, [t.id]).length) return;  /* nothing to ask yet */
        var s = pr.strands[t.id];
        var score;
        if (!s || !s.seen) {
          score = 70;                                     /* untouched — worth starting */
        } else {
          var acc = s.correct / s.seen;
          var overdue = Math.max(0, (Date.now() - (s.due || 0)) / 86400000);
          score = (1 - acc) * 100 + Math.min(30, overdue * 6) + Math.max(0, 10 - s.seen);
        }
        score += daySeed(t.id) * 9;                       /* rotate ties day to day */
        rows.push({
          subj: subjId, subjName: subj.name, icon: subj.icon,
          strand: t.id, strandName: t.name, note: t.note,
          stat: strandStat(studentId, t.id), score: score
        });
      });
    });

    rows.sort(function (a, b) { return b.score - a.score; });

    /* Spread the plan across subjects rather than stacking one subject. */
    var out = [], used = {};
    rows.forEach(function (r) {
      if (out.length >= (howMany || 6)) return;
      if ((used[r.subj] || 0) >= 2) return;
      used[r.subj] = (used[r.subj] || 0) + 1;
      out.push(r);
    });
    for (var i = 0; out.length < (howMany || 6) && i < rows.length; i++) {
      if (out.indexOf(rows[i]) === -1) out.push(rows[i]);
    }
    return out;
  }

  /* Weakest strands with enough evidence to be worth naming. */
  function weakSpots(studentId, howMany) {
    var p = profile(studentId); if (!p) return [];
    var pr = progress(studentId), rows = [];
    (p.subjects || []).forEach(function (subjId) {
      var subj = C.subjects[subjId]; if (!subj) return;
      subj.strands.forEach(function (t) {
        var s = pr.strands[t.id];
        if (s && s.seen >= 3) {
          rows.push({ subj: subjId, subjName: subj.name, icon: subj.icon,
                      strand: t.id, strandName: t.name,
                      pct: Math.round(100 * s.correct / s.seen), seen: s.seen });
        }
      });
    });
    rows.sort(function (a, b) { return a.pct - b.pct; });
    return rows.slice(0, howMany || 5);
  }

  /* --------------------------- exam countdown -------------------------- */
  /* CSEC sits in May/June. A Form 2 student in 2026 reaches Form 5 in 2029. */
  /* Which examination is next, and when.
   *
   * Two now, not one: SEA at the end of Standard 5 (written in March) and CSEC
   * at the end of Form 5 (May and June). A Standard 3 gets a countdown to SEA,
   * not to an examination six years away that would mean nothing to them.
   */
  function nextExam(level) {
    var stages = (C.stages || []).filter(function (st) { return st.examLevel; })
      .sort(function (a, b) { return a.examLevel - b.examLevel; });
    for (var i = 0; i < stages.length; i++) {
      if (level <= stages[i].examLevel) return stages[i];
    }
    return stages[stages.length - 1] || null;
  }

  /* The calendar year in which that examination is sat. The school year rolls in
     September, so from September onwards we are already working towards the
     following calendar year. */
  function examYear(level) {
    var st = nextExam(level);
    if (!st) return null;
    var now = new Date();
    var base = now.getMonth() >= 8 ? now.getFullYear() + 1 : now.getFullYear();
    return base + (st.examLevel - level);
  }

  function countdown(level) {
    var st = nextExam(level);
    if (!st) return { exam: null, year: null, days: 0, months: 0 };
    var y = examYear(level);
    var exam = new Date(y, st.examMonth, st.examDay || 1);
    var days = Math.max(0, Math.ceil((exam - new Date()) / 86400000));
    return {
      exam: st.exam,            /* 'SEA' or 'CSEC' */
      stage: st.key,
      year: y,
      days: days,
      months: Math.round(days / 30.4)
    };
  }

  /* ------------------------- export / import --------------------------- */
  /* No server means no sync. This is how progress moves between devices. */
  function exportAll() {
    var dump = { app: 'csec-study-hub', version: 1, at: new Date().toISOString(), profiles: profiles(), progress: {} };
    profiles().forEach(function (p) { dump.progress[p.id] = progress(p.id); });
    return dump;
  }
  function importAll(dump, mode) {
    if (!dump || dump.app !== 'csec-study-hub') return { ok: false, msg: 'That file is not a Study Hub backup.' };
    if (mode === 'replace') {
      profiles().forEach(function (p) { try { localStorage.removeItem(NS + 'progress.' + p.id); } catch (e) {} });
      saveProfiles(dump.profiles || []);
    } else {
      var have = {}; profiles().forEach(function (p) { have[p.id] = true; });
      var merged = profiles();
      (dump.profiles || []).forEach(function (p) { if (!have[p.id]) merged.push(p); });
      saveProfiles(merged);
    }
    for (var id in (dump.progress || {})) write('progress.' + id, dump.progress[id]);
    return { ok: true, msg: 'Backup restored.' };
  }

  /* ------------------------------ helpers ------------------------------ */
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  /* Donut ring used for every mastery figure on the site. */
  function ring(pct, size, label) {
    var r = 42, circ = 2 * Math.PI * r;
    var val = pct == null ? 0 : Math.max(0, Math.min(100, pct));
    var dash = circ * val / 100;
    var col = pct == null ? '#3d5a78' : (pct >= 75 ? '#4ade80' : pct >= 50 ? '#efc24b' : '#f87171');
    return '<svg class="ring" viewBox="0 0 100 100" width="' + (size || 84) + '" height="' + (size || 84) + '" role="img" ' +
      'aria-label="' + esc(label || ('Mastery ' + (pct == null ? 'not started' : pct + ' percent'))) + '">' +
      '<circle cx="50" cy="50" r="' + r + '" fill="none" stroke="rgba(255,255,255,.10)" stroke-width="9"/>' +
      '<circle cx="50" cy="50" r="' + r + '" fill="none" stroke="' + col + '" stroke-width="9" stroke-linecap="round" ' +
      'stroke-dasharray="' + dash.toFixed(1) + ' ' + circ.toFixed(1) + '" transform="rotate(-90 50 50)"/>' +
      '<text x="50" y="50" text-anchor="middle" dominant-baseline="central" fill="#edf4fb" ' +
      'font-size="' + (pct == null ? 20 : 26) + '" font-weight="700" font-family="Montserrat,sans-serif">' +
      (pct == null ? '—' : val + '%') + '</text></svg>';
  }

  /* 28-day practice grid. */
  function streakGrid(studentId) {
    var days = progress(studentId).days, set = {};
    days.forEach(function (d) { set[d] = true; });
    var html = '<div class="streak-grid" role="img" aria-label="Practice over the last 28 days">';
    for (var i = 27; i >= 0; i--) {
      var d = new Date(); d.setDate(d.getDate() - i);
      var iso = d.toISOString().slice(0, 10);
      html += '<span class="sq' + (set[iso] ? ' on' : '') + '" title="' + iso + (set[iso] ? ' — practised' : '') + '"></span>';
    }
    return html + '</div>';
  }

  /* ------------------------- SEA practice papers ------------------------ *
   * Twelve practice papers and two mocks per paper type, each assembled to the
   * Ministry's published blueprint (data/sea-papers.js).
   *
   * Two rules make these usable as practice papers rather than as another
   * shuffle of the bank:
   *
   *   Repeatable. Paper 7 is the same paper every time it is opened, on any
   *   device, so a mark can be compared with last month's. The deal is seeded
   *   by strand only, never by the clock or the child.
   *
   *   Maximally distinct. Items are DEALT across papers, not sampled for each.
   *   Each strand's pool is ordered once, then paper n takes the next slice.
   *   Papers stay completely distinct until the pool runs out, and only then
   *   wrap - rather than colliding on paper two, which random sampling does.
   * ---------------------------------------------------------------------- */

  /* A small deterministic PRNG. Same seed, same order, everywhere. */
  function seeded(seed) {
    var x = seed >>> 0 || 1;
    return function () {
      x ^= x << 13; x >>>= 0; x ^= x >> 17; x ^= x << 5; x >>>= 0;
      return x / 4294967296;
    };
  }
  function hashStr(str) {
    var h = 2166136261, i;
    for (i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = (h * 16777619) >>> 0; }
    return h >>> 0;
  }
  function orderedPool(strandIds) {
    var pool = (global.CSEC_QUESTIONS || []).filter(function (q) {
      return strandIds.indexOf(q.strand) > -1;
    });
    /* Ordered once, by a seed derived from the strand list - so the order is
       stable across devices and releases, and does not shift when a question
       is appended to the end of the bank. */
    var rnd = seeded(hashStr(strandIds.join('|')));
    return pool.map(function (q) { return { q: q, k: rnd() }; })
               .sort(function (a, b) { return a.k - b.k; })
               .map(function (x) { return x.q; });
  }

  function seaSpec() { return (global.CSEC_SEA || {}).blueprint || null; }

  /* How many fully distinct papers the bank currently supports for a subject,
     and the tightest strand holding that number down. Surfaced in the UI
     rather than hidden - a family should know when papers start to repeat. */
  function seaDepth(subjId) {
    var B = seaSpec(); if (!B || !B[subjId] || !B[subjId].strands) return null;
    var worst = null;
    B[subjId].strands.forEach(function (st) {
      var have = orderedPool(st.from).length;
      var papers = st.items ? Math.floor(have / st.items) : 0;
      if (!worst || papers < worst.papers) worst = { papers: papers, strand: st.key, have: have, need: st.items };
    });
    return worst;
  }

  /* Build one paper. n is 1-based across the whole set: 1..12 are practice,
     13..14 are the mocks. */
  function seaPaper(subjId, n) {
    var B = seaSpec(); if (!B || !B[subjId]) return null;
    var spec = B[subjId];
    var S = global.CSEC_SEA;
    var practice = S.practiceCount, total = practice + S.mockCount;
    n = Math.max(1, Math.min(total, Number(n) || 1));
    var isMock = n > practice;

    if (subjId === 'p-ela-writing') {
      var w = (S.writing || []).filter(function (x) { return x.paper === n; })[0] || null;
      return { subj: subjId, name: spec.name, n: n, mock: isMock, minutes: spec.minutes,
               writing: true, kind: w && w.kind, prompts: (w && w.prompts) || [],
               criteria: spec.criteria, note: spec.note, items: spec.items, answer: spec.answer };
    }

    var picked = [], short = [];
    spec.strands.forEach(function (st) {
      var pool = orderedPool(st.from), want = st.items;
      if (!pool.length) { short.push(st.key + ' (none)'); return; }
      var start = ((n - 1) * want) % pool.length, i, taken = [];
      for (i = 0; i < want; i++) taken.push(pool[(start + i) % pool.length]);
      /* Within ONE paper a repeat is never acceptable, even when the pool is
         smaller than the quota - fall back to what exists and report it. */
      var seen = {}, uniq = [];
      taken.forEach(function (q) { if (!seen[q.id]) { seen[q.id] = 1; uniq.push(q); } });
      if (uniq.length < want) short.push(st.key + ' ' + uniq.length + '/' + want);
      uniq.forEach(function (q) { picked.push({ q: q, strand: st.key, marks: st.marks / st.items }); });
    });

    /* Order the paper by section: the easy one-markers first, exactly as the
       real paper is laid out, so the pacing practice is honest. */
    var rnd = seeded(hashStr(subjId + '#' + n));
    picked = picked.map(function (x) { return { x: x, k: rnd() }; })
                   .sort(function (a, b) { return a.k - b.k; })
                   .map(function (o) { return o.x; });
    var order = { 1: 0, 2: 1, 3: 2 };
    picked.sort(function (a, b) { return (order[a.q.diff] || 1) - (order[b.q.diff] || 1); });

    var cursor = 0;
    var sections = (spec.sections || []).map(function (sec) {
      var take = picked.slice(cursor, cursor + sec.items);
      cursor += sec.items;
      return { n: sec.n, note: sec.note, perItem: sec.perItem, marks: sec.marks,
               questions: take.map(function (t) { return t.q; }) };
    });

    return {
      subj: subjId, name: spec.name, n: n, mock: isMock, minutes: spec.minutes,
      items: spec.items, marks: spec.marks, sections: sections,
      questions: picked.map(function (t) { return t.q; }),
      strands: spec.strands, thinking: spec.thinking,
      short: short, complete: !short.length, depth: seaDepth(subjId)
    };
  }

  /* The index the SEA page lists. */
  function seaPapers(subjId) {
    var S = global.CSEC_SEA; if (!S) return [];
    var out = [], i, total = S.practiceCount + S.mockCount;
    for (i = 1; i <= total; i++) {
      var mock = i > S.practiceCount;
      out.push({ n: i, subj: subjId, mock: mock,
                 label: mock ? ('Mock ' + (i - S.practiceCount)) : ('Practice ' + i) });
    }
    return out;
  }

  global.CSEC = {
    curriculum: C, questions: Q,
    profiles: profiles, profile: profile, students: students,
    createProfile: createProfile, updateProfile: updateProfile, deleteProfile: deleteProfile,
    signIn: signIn, current: current, signOut: signOut, requireRole: requireRole,
    resetPin: resetPin, recoverWithCode: recoverWithCode, newRecovery: newRecovery,
    progress: progress, saveProgress: saveProgress, recordAnswer: recordAnswer,
    recordSession: recordSession, streak: streak,
    strandStat: strandStat, subjectStat: subjectStat, overallStat: overallStat,
    questionsFor: questionsFor, shuffle: shuffle,
    planFor: planFor, weakSpots: weakSpots,
    examYear: examYear, countdown: countdown,
    termOf: termOf, snapshotTerm: snapshotTerm, termHistory: termHistory, promote: promote,
    stageOf: stageOf, roadmapFor: roadmapFor, journeyNow: journeyNow,
    levels: C.levels, levelInfo: levelInfo, levelLabel: levelLabel, levelShort: levelShort, nextExam: nextExam,
    defaultsFor: defaultsFor, migrateLevel: migrateLevel,
    newThisYear: newThisYear, carriedForward: carriedForward,
    coverage: coverage, retention: retention, testStat: testStat, recordTest: recordTest,
    readiness: readiness, band: band, distinctionBoard: distinctionBoard,
    exportAll: exportAll, importAll: importAll,
    seaPaper: seaPaper, seaPapers: seaPapers, seaDepth: seaDepth, seaSpec: seaSpec,
    esc: esc, ring: ring, streakGrid: streakGrid, today: today
  };
})(window);
