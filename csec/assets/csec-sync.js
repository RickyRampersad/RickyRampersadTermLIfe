/* CSEC Study Hub — cross-device sync client
 *
 * Talks to the Apps Script in gs/csec-sync.gs. A group has a code; anyone
 * holding the code reads and writes that group. The code is the credential —
 * there is no account and no password, which is stated plainly wherever a code
 * is shown.
 *
 * Until the Apps Script is deployed, SYNC_URL is the literal placeholder and
 * every call returns {ok:false, error:'not_configured'}. The hub then behaves
 * exactly as it did before sync existed, so an undeployed endpoint degrades to
 * device-local rather than to a broken screen.
 */
(function (global) {
  'use strict';

  /* The deployed /exec URL. Set it in ONE place — csec/assets/csec-config.js —
     rather than editing this file, so an upgrade to the sync client never loses
     the endpoint. See gs/csec-sync.gs step 6. */
  var SYNC_URL = global.CSEC_SYNC_URL || 'RRB_CSEC_SYNC_URL';

  var NS = 'csec.';
  var K_GROUP = 'sync.group';
  var K_STATE = 'sync.state';

  function read(k, d) {
    try { var v = localStorage.getItem(NS + k); return v ? JSON.parse(v) : d; }
    catch (e) { return d; }
  }
  function write(k, v) {
    try { localStorage.setItem(NS + k, JSON.stringify(v)); return true; }
    catch (e) { return false; }
  }

  function configured() { return SYNC_URL.indexOf('http') === 0; }

  /* Test hook. Production pages never call this — the URL is baked in above. */
  function setEndpoint(u) { SYNC_URL = String(u || ''); }

  function group()      { return read(K_GROUP, null); }
  function setGroup(g)  { write(K_GROUP, g); }
  function state()      { return read(K_STATE, { lastSync: 0, lastError: '', lastResult: '' }); }
  function setState(s)  { write(K_STATE, s); }

  function note(result, error) {
    var s = state();
    s.lastResult = result || '';
    s.lastError = error || '';
    if (!error) s.lastSync = Date.now();
    setState(s);
  }

  /* ------------------------------ transport ------------------------------ */

  function get(params, cb) {
    if (!configured()) return cb({ ok: false, error: 'not_configured' });
    var qs = Object.keys(params).map(function (k) {
      return encodeURIComponent(k) + '=' + encodeURIComponent(params[k]);
    }).join('&');
    fetch(SYNC_URL + '?' + qs, { method: 'GET' })
      .then(function (r) { return r.json(); })
      .then(function (j) { cb(j); })
      .catch(function (e) { cb({ ok: false, error: 'network', detail: String(e && e.message || e) }); });
  }

  /* text/plain keeps this a simple request, so no CORS preflight is needed —
     Apps Script cannot answer a preflight. */
  function post(body, cb) {
    if (!configured()) return cb({ ok: false, error: 'not_configured' });
    fetch(SYNC_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(body)
    })
      .then(function (r) { return r.json(); })
      .then(function (j) { cb(j); })
      .catch(function (e) { cb({ ok: false, error: 'network', detail: String(e && e.message || e) }); });
  }

  /* ------------------------------ timestamps ----------------------------- */

  /* A profile's version is the later of its own edit and its progress save, so
     a night of practice counts as a change even though the profile row did not
     move. */
  function localStamp(id) {
    var C = global.CSEC;
    var p = C.profile(id) || {};
    var g = C.progress(id) || {};
    return Math.max(p.updatedAt || 0, g._t || 0, p.created || 0);
  }

  /* ------------------------------ operations ----------------------------- */

  function createGroup(label, kind, cb) {
    post({ action: 'create', label: label, kind: kind }, function (r) {
      if (r.ok) {
        setGroup({ code: r.code, label: label, kind: kind, joined: Date.now() });
        note('Group created');
      } else { note('', r.error); }
      cb(r);
    });
  }

  function joinGroup(code, cb) {
    get({ action: 'pull', code: code }, function (r) {
      if (!r.ok) { note('', r.error); return cb(r); }
      setGroup({ code: r.code, label: r.label, kind: r.kind, joined: Date.now() });
      var n = merge(r.records || []);
      note('Joined — ' + n.applied + ' profile' + (n.applied === 1 ? '' : 's') + ' received');
      cb({ ok: true, code: r.code, label: r.label, kind: r.kind, applied: n.applied });
    });
  }

  function leaveGroup() {
    try { localStorage.removeItem(NS + K_GROUP); } catch (e) {}
    note('Left the group');
  }

  /* Records come off a shared server that any group member can write to, so
     they are treated as untrusted input, not as our own data coming home.
     Anything that fails this shape check is dropped rather than stored — a
     malformed or hostile push must not be able to corrupt a device. */
  var ROLES = { student: 1, parent: 1, teacher: 1 };

  function cleanProfile(raw) {
    if (!raw || typeof raw !== 'object') return null;
    var id = String(raw.id || '');
    if (!/^[A-Za-z0-9_-]{4,64}$/.test(id)) return null;
    if (!ROLES[raw.role]) return null;

    var subjects = Array.isArray(raw.subjects) ? raw.subjects.filter(function (sid) {
      return typeof sid === 'string' && global.CSEC.curriculum.subjects[sid];
    }).slice(0, 40) : [];

    var form = parseInt(raw.form, 10);
    if (!(form >= 1 && form <= 5)) form = 3;

    return {
      id: id,
      name: String(raw.name == null ? '' : raw.name).slice(0, 60) || 'Unnamed',
      role: raw.role,
      form: form,
      school: String(raw.school == null ? '' : raw.school).slice(0, 120),
      pin: /^\d{4,6}$/.test(String(raw.pin || '')) ? String(raw.pin) : '',
      recovery: /^[A-Z0-9]{4,10}$/.test(String(raw.recovery || '')) ? String(raw.recovery) : '',
      subjects: subjects,
      linked: Array.isArray(raw.linked) ? raw.linked.slice(0, 40) : [],
      created: Number(raw.created) || Date.now(),
      updatedAt: Number(raw.updatedAt) || 0
    };
  }

  function cleanProgress(raw) {
    if (!raw || typeof raw !== 'object') return null;
    return {
      strands:  (raw.strands  && typeof raw.strands  === 'object') ? raw.strands  : {},
      sessions: Array.isArray(raw.sessions) ? raw.sessions.slice(-400) : [],
      days:     Array.isArray(raw.days)     ? raw.days.slice(-1200)    : [],
      tests:    Array.isArray(raw.tests)    ? raw.tests.slice(-200)    : [],
      history:  Array.isArray(raw.history)  ? raw.history.slice(-40)   : [],
      terms:    (raw.terms && typeof raw.terms === 'object') ? raw.terms : {},
      notes:    (raw.notes && typeof raw.notes === 'object') ? raw.notes : {},
      goals:    (raw.goals && typeof raw.goals === 'object') ? raw.goals : {},
      _t:       Number(raw._t) || 0,
      _v:       Number(raw._v) || 0   /* carried, or a round-trip re-migrates */
    };
  }

  /* Remote wins only when it is genuinely newer. A stale tab must never be able
     to roll back a night's work on another device. */
  function merge(records) {
    var C = global.CSEC, applied = 0, skipped = 0, rejected = 0;
    records.forEach(function (rec) {
      if (!rec) return;
      var prof = cleanProfile(rec.profile);
      if (!prof) { rejected++; return; }
      rec = { profile: prof, progress: cleanProgress(rec.progress), updatedAt: rec.updatedAt };
      var id = prof.id;
      var mine = C.profile(id);
      if (mine && localStamp(id) >= (rec.updatedAt || 0)) { skipped++; return; }

      var all = C.profiles();
      var i = -1;
      for (var k = 0; k < all.length; k++) if (all[k].id === id) { i = k; break; }
      if (i >= 0) all[i] = rec.profile; else all.push(rec.profile);
      write('profiles', all);
      if (rec.progress) write('progress.' + id, rec.progress);
      applied++;
    });
    return { applied: applied, skipped: skipped, rejected: rejected };
  }

  function pushOne(id, cb) {
    var C = global.CSEC;
    var g = group();
    if (!g) return cb({ ok: false, error: 'no_group' });
    var p = C.profile(id);
    if (!p) return cb({ ok: false, error: 'no_profile' });
    post({ action: 'push', code: g.code, profile: p, progress: C.progress(id) }, cb);
  }

  /* PULL FIRST, then push only what is genuinely newer here.
   *
   * Pushing first looks simpler and is wrong: a laptop that has been closed for
   * a week would upload its stale copy over the teacher's update, and the pull
   * that followed would hand that stale copy straight back. The merge guard
   * protects the local side; this ordering protects the remote side.
   */
  function syncNow(cb) {
    var C = global.CSEC;
    var g = group();
    if (!g) return cb({ ok: false, error: 'no_group' });
    if (!configured()) return cb({ ok: false, error: 'not_configured' });

    get({ action: 'pull', code: g.code }, function (r) {
      if (!r.ok) { note('', r.error); return cb(r); }

      var serverStamp = {};
      (r.records || []).forEach(function (rec) {
        if (rec && rec.profileId) serverStamp[rec.profileId] = rec.updatedAt || 0;
      });

      var merged = merge(r.records || []);

      /* After merging, anything still newer locally is a real local change. */
      var ids = C.profiles().map(function (p) { return p.id; }).filter(function (id) {
        return localStamp(id) > (serverStamp[id] || 0);
      });

      if (!ids.length) {
        note('Up to date — received ' + merged.applied);
        return cb({ ok: true, pushed: 0, failed: 0, applied: merged.applied, skipped: merged.skipped });
      }

      var pending = ids.length, pushed = 0, failed = 0;
      ids.forEach(function (id) {
        pushOne(id, function (pr) {
          if (pr && pr.ok) pushed++; else failed++;
          if (--pending === 0) {
            var msg = 'Sent ' + pushed + ', received ' + merged.applied;
            if (failed) msg += ' (' + failed + ' failed)';
            note(failed ? '' : msg, failed ? 'some_pushes_failed' : '');
            cb({ ok: !failed, pushed: pushed, failed: failed,
                 applied: merged.applied, skipped: merged.skipped });
          }
        });
      });
    });
  }

  function pullAll(cb) {
    var g = group();
    if (!g) return cb({ ok: false, error: 'no_group' });
    get({ action: 'pull', code: g.code }, function (r) {
      if (!r.ok) { note('', r.error); return cb(r); }
      var n = merge(r.records || []);
      cb({ ok: true, applied: n.applied, skipped: n.skipped, records: (r.records || []).length });
    });
  }

  function forgetMe(profileId, cb) {
    var g = group();
    if (!g) return cb({ ok: false, error: 'no_group' });
    post({ action: 'forget', code: g.code, profileId: profileId }, cb);
  }

  function forgetGroup(cb) {
    var g = group();
    if (!g) return cb({ ok: false, error: 'no_group' });
    post({ action: 'forgetGroup', code: g.code }, function (r) {
      if (r.ok) leaveGroup();
      cb(r);
    });
  }

  function ping(cb) { get({ action: 'ping' }, cb); }

  /* Called after a practice session or a test. Quiet: never blocks the page,
     never shows an error to a student mid-flow. */
  function autoSync() {
    if (!configured() || !group()) return;
    var s = state();
    if (Date.now() - (s.lastSync || 0) < 60000) return;   // at most once a minute
    try { syncNow(function () {}); } catch (e) {}
  }

  global.CSEC_SYNC = {
    configured: configured, setEndpoint: setEndpoint,
    group: group, setGroup: setGroup, leaveGroup: leaveGroup,
    state: state, ping: ping,
    createGroup: createGroup, joinGroup: joinGroup,
    syncNow: syncNow, pullAll: pullAll, pushOne: pushOne,
    forgetMe: forgetMe, forgetGroup: forgetGroup,
    autoSync: autoSync, merge: merge
  };
})(window);
