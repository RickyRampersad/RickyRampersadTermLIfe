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
  function profiles() { return read('profiles', []); }
  function saveProfiles(list) { write('profiles', list); }
  function profile(id) {
    var all = profiles();
    for (var i = 0; i < all.length; i++) if (all[i].id === id) return all[i];
    return null;
  }
  function students() { return profiles().filter(function (p) { return p.role === 'student'; }); }

  function createProfile(o) {
    var all = profiles();
    var p = {
      id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
      name: (o.name || '').trim() || 'Unnamed',
      role: o.role || 'student',
      form: o.form || 2,
      school: o.school || 'Lakshmi Girls’ Hindu College',
      pin: String(o.pin || '').trim(),
      subjects: o.subjects || C.defaultSelection.slice(),
      linked: o.linked || [],
      created: Date.now()
    };
    all.push(p); saveProfiles(all); return p;
  }
  function updateProfile(id, patch) {
    var all = profiles();
    for (var i = 0; i < all.length; i++) {
      if (all[i].id === id) { for (var k in patch) all[i][k] = patch[k]; saveProfiles(all); return all[i]; }
    }
    return null;
  }
  function deleteProfile(id) {
    saveProfiles(profiles().filter(function (p) { return p.id !== id; }));
    try { localStorage.removeItem(NS + 'progress.' + id); } catch (e) {}
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
  function blankProgress() { return { strands: {}, sessions: [], days: [], notes: {}, goals: {} }; }
  function progress(studentId) { return read('progress.' + studentId, blankProgress()); }
  function saveProgress(studentId, p) { write('progress.' + studentId, p); }

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
    s.last = Date.now();
    s.due = Date.now() + s.interval * 86400000;
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
    return p;
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
  function questionsFor(subjIds, form, strandIds) {
    return Q.filter(function (q) {
      if (subjIds && subjIds.length && subjIds.indexOf(q.subj) === -1) return false;
      if (strandIds && strandIds.length && strandIds.indexOf(q.strand) === -1) return false;
      /* Show material up to one form ahead — stretch, but not Form 5 in Form 2. */
      if (form && q.form > form + 1) return false;
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
        if (t.forms.indexOf(p.form) === -1) return;      /* not taught this year */
        if (!questionsFor([subjId], p.form, [t.id]).length) return;  /* nothing to ask yet */
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
  function examYear(form) {
    var now = new Date(), y = now.getFullYear();
    /* School year rolls in September, so Sept-Dec is already the next year's cohort. */
    var base = now.getMonth() >= 8 ? y + 1 : y;
    return base + (5 - form);
  }
  function countdown(form) {
    var y = examYear(form);
    var exam = new Date(y + '-05-01T00:00:00');
    var days = Math.max(0, Math.ceil((exam - new Date()) / 86400000));
    return { year: y, days: days, months: Math.round(days / 30.4) };
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

  global.CSEC = {
    curriculum: C, questions: Q,
    profiles: profiles, profile: profile, students: students,
    createProfile: createProfile, updateProfile: updateProfile, deleteProfile: deleteProfile,
    signIn: signIn, current: current, signOut: signOut, requireRole: requireRole,
    progress: progress, saveProgress: saveProgress, recordAnswer: recordAnswer,
    recordSession: recordSession, streak: streak,
    strandStat: strandStat, subjectStat: subjectStat, overallStat: overallStat,
    questionsFor: questionsFor, shuffle: shuffle,
    planFor: planFor, weakSpots: weakSpots,
    examYear: examYear, countdown: countdown,
    exportAll: exportAll, importAll: importAll,
    esc: esc, ring: ring, streakGrid: streakGrid, today: today
  };
})(window);
