/*
 * Recruit Tracker — Ricky Rampersad's Branch
 * =============================================================================
 * The app. Served from rickyrampersadbranch.com/recruiting by GitHub Pages,
 * which is public, so this file holds no candidate, no agent and no figure —
 * see "Talking to the branch workbook" below for where those live and how they
 * arrive.
 *
 * This is the v5.5-B3 build that came across from the Project on 6 September
 * 2026, run through Prettier so it can be read and worked on. JSX was compiled
 * away before it got here; components are React.createElement calls, and the
 * component names survived.
 * =============================================================================
 */
const { useState: useState, useEffect: useEffect, useCallback: useCallback, useMemo: useMemo } = React,
  _FallbackIcon = (e) =>
    React.createElement(
      "svg",
      {
        width: 14,
        height: 14,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 2,
        ...e,
      },
      React.createElement("circle", { cx: 12, cy: 12, r: 9 }),
    ),
  _iconLib = new Proxy(window.LucideReact || window.lucideReact || {}, {
    get: (e, t) => {
      const a = e && e[t];
      return "function" == typeof a || (a && a.$$typeof) ? a : _FallbackIcon;
    },
  }),
  {
    User: User,
    Briefcase: Briefcase,
    FileText: FileText,
    Search: Search,
    ShieldCheck: ShieldCheck,
    CheckCircle2: CheckCircle2,
    Circle: Circle,
    AlertTriangle: AlertTriangle,
    ChevronDown: ChevronDown,
    ChevronRight: ChevronRight,
    Save: Save,
    RotateCcw: RotateCcw,
    FileSpreadsheet: FileSpreadsheet,
    Plus: Plus,
    Trash2: Trash2,
    Download: Download,
    Award: Award,
    Building2: Building2,
    Users: Users,
    Layers: Layers,
    Phone: Phone,
    Mail: Mail,
    Calendar: Calendar,
    Eye: Eye,
    Send: Send,
    Copy: Copy,
    ArrowLeft: ArrowLeft,
    ArrowRight: ArrowRight,
    Clock: Clock,
    Target: Target,
    MessageSquare: MessageSquare,
    ListChecks: ListChecks,
    GraduationCap: GraduationCap,
    Coffee: Coffee,
    TrendingUp: TrendingUp,
    AlertCircle: AlertCircle,
    MapPin: MapPin,
    X: X,
    Filter: Filter,
    ClipboardCheck: ClipboardCheck,
    FolderOpen: FolderOpen,
  } = _iconLib,
  _memCache = new Map();

// ---------------------------------------------------------------------------
//  Talking to the branch workbook
//
//  Nothing personal lives in this file. Candidates, their files, the
//  production figures and the POP cohort all sit in the RRB Recruit Tracker
//  workbook and a private Drive folder, behind apps-script/Recruiting.gs, and
//  come down only to somebody who has signed in against its Access tab.
//
//  The rest of the app never learned that. It still talks to a key/value
//  store — get, set, delete on keys like "recruit-tracker:candidate:<id>" —
//  exactly as it did when the store was IndexedDB. The object below is that
//  store, answered by the sheet.
// ---------------------------------------------------------------------------

// Deploy > New deployment > Web app > Execute as Me > Access: Anyone, then
// paste the URL here. See RECRUITING-SETUP.md.
const APPS_SCRIPT_URL = "PASTE_THE_WEB_APP_URL_HERE";
const TOKEN_KEY = "rrb_recruit_token";
const APP_VERSION = "v6.0";

const configured = () => APPS_SCRIPT_URL && APPS_SCRIPT_URL.indexOf("PASTE_") !== 0;
const SESSION = { token: "", profile: null, roster: [], aiEnabled: false, serverVersion: "" };

function readStoredToken() {
  try { return localStorage.getItem(TOKEN_KEY) || ""; } catch { return ""; }
}
function storeToken(tok) {
  try { tok ? localStorage.setItem(TOKEN_KEY, tok) : localStorage.removeItem(TOKEN_KEY); } catch {}
}

// Everything goes through POST so the reply can be read. Apps Script answers a
// POST with a 302 to a one-shot result URL; when the script is busy that
// result is not always there yet and the browser sees a 404 — "not ready",
// not "no such endpoint". 404, 429 and 5xx get another go, quietly.
async function apiOnce(action, payload) {
  const res = await fetch(APPS_SCRIPT_URL, {
    method: "POST",
    headers: { "Content-Type": "text/plain;charset=utf-8" },
    body: JSON.stringify({ action, token: SESSION.token, ...payload }),
  });
  if (!res.ok) {
    const again = res.status === 404 || res.status === 429 || res.status >= 500;
    return { ok: false, error: again ? "The workbook is busy." : "Server returned " + res.status + ".", _retry: again };
  }
  const text = await res.text();
  try { return JSON.parse(text); }
  catch { return { ok: false, error: "Unreadable reply from the workbook. Re-deploy the Apps Script with access set to Anyone." }; }
}

async function api(action, payload = {}, onAttempt) {
  if (!configured()) return { ok: false, error: "No Apps Script URL set in recruiting/app.js." };
  let last = null;
  for (let attempt = 1; attempt <= 3; attempt++) {
    onAttempt && onAttempt(attempt);
    try { last = await apiOnce(action, payload); }
    catch (e) { last = { ok: false, error: "Could not reach the workbook.", _retry: true }; }
    if (last.ok || !last._retry) break;
    await new Promise((r) => setTimeout(r, 900 * attempt));
  }
  if (last && last.authRequired) {
    storeToken("");
    SESSION.token = "";
  }
  if (last && last.authRequired && SESSION.profile) {
    alert("Your sign-in has expired. The page will reload so you can sign in again.");
    location.reload();
  }
  return last || { ok: false, error: "The workbook did not answer." };
}

/* Keys the app reads and writes. State is the page's own business (which
   candidate is open, which view) and stays on the device. Everything else is
   answered by the sheet. */
const SK = {
  state: "recruit-tracker:state",
  candidateList: "recruit-tracker:candidate-list",
  candidate: (e) => `recruit-tracker:candidate:${e}`,
  docBlob: (e, t) => `recruit-tracker:blob:${e}:${t}`,
  popBlob: (e) => `recruit-tracker:popblob:${e}`,
};

const _serverBackend = (() => {
  const cache = new Map();          // candidate id -> JSON string, primed by `list`
  const pending = new Map();        // candidate id -> { timer, resolvers }
  const SAVE_DELAY = 1200;          // ms of quiet before a record is written

  function parseKey(key) {
    if (key === SK.state) return { kind: "state" };
    if (key === SK.candidateList) return { kind: "list" };
    let m;
    if ((m = /^recruit-tracker:candidate:(.+)$/.exec(key))) return { kind: "candidate", id: m[1] };
    if ((m = /^recruit-tracker:popblob:(.+)$/.exec(key))) return { kind: "blob", id: m[1], docKey: "pop" };
    if ((m = /^recruit-tracker:blob:([^:]+):(.+)$/.exec(key))) return { kind: "blob", id: m[1], docKey: m[2] };
    return { kind: "unknown" };
  }

  // A keystroke used to be an IndexedDB write, which is free. A round trip
  // to Apps Script is a second or more. So a record is written once the
  // typing has stopped, and the promise resolves only when the sheet has it —
  // the "Saved" mark in the header means what it says.
  function scheduleSave(id) {
    return new Promise((resolve) => {
      let p = pending.get(id);
      if (!p) { p = { timer: null, resolvers: [], inFlight: false, dirty: false }; pending.set(id, p); }
      p.resolvers.push(resolve);
      p.dirty = true;
      clearTimeout(p.timer);
      p.timer = setTimeout(() => flush(id), SAVE_DELAY);
    });
  }
  async function flush(id) {
    const p = pending.get(id);
    if (!p || p.inFlight) return;
    p.inFlight = true; p.dirty = false;
    const resolvers = p.resolvers.splice(0);
    const r = await api("save", { id, json: cache.get(id) });
    p.inFlight = false;
    if (!r.ok) alert("Could not save to the branch workbook: " + (r.error || "unknown error"));
    resolvers.forEach((f) => f(!!r.ok));
    if (p.dirty) flush(id); else if (!p.resolvers.length) pending.delete(id);
  }
  // Leaving the page mid-quiet-period must not lose the last edit.
  function flushAllNow() {
    for (const [id, p] of pending) {
      if (!p.dirty && !p.resolvers.length) continue;
      clearTimeout(p.timer);
      const body = JSON.stringify({ action: "save", token: SESSION.token, id, json: cache.get(id) });
      try {
        if (body.length < 60000) fetch(APPS_SCRIPT_URL, { method: "POST", keepalive: true,
          headers: { "Content-Type": "text/plain;charset=utf-8" }, body });
        else flush(id);
      } catch {}
    }
  }
  window.addEventListener("pagehide", flushAllNow);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") flushAllNow(); });

  return {
    pendingCount: () => pending.size,
    async get(key) {
      const k = parseKey(key);
      if (k.kind === "state") {
        try { const v = localStorage.getItem(key); return v == null ? null : { key, value: v }; } catch { return null; }
      }
      if (k.kind === "list") {
        const r = await api("list");
        if (!r.ok) { if (r.error) console.warn("list:", r.error); return null; }
        cache.clear();
        for (const id of Object.keys(r.candidates || {})) cache.set(id, r.candidates[id]);
        return { key, value: JSON.stringify(r.list || []) };
      }
      if (k.kind === "candidate") {
        if (cache.has(k.id)) return { key, value: cache.get(k.id) };
        const r = await api("get", { id: k.id });
        if (!r.ok) return null;
        cache.set(k.id, r.json);
        return { key, value: r.json };
      }
      if (k.kind === "blob") {
        const r = await api("docGet", { candidateId: k.id, docKey: k.docKey });
        if (!r.ok) return null;
        return { key, value: JSON.stringify({ base64: r.base64, mediaType: r.mediaType }) };
      }
      return null;
    },
    async set(key, value) {
      const k = parseKey(key);
      if (k.kind === "state") { try { localStorage.setItem(key, value); } catch {} return true; }
      if (k.kind === "list") return true;                 // the sheet derives the list itself
      if (k.kind === "candidate") { cache.set(k.id, value); return scheduleSave(k.id); }
      if (k.kind === "blob") {
        let blob = {};
        try { blob = JSON.parse(value) || {}; } catch {}
        if (!blob.base64) return true;
        const r = await api("docPut", { candidateId: k.id, docKey: k.docKey, base64: blob.base64,
                                        mediaType: blob.mediaType, filename: blob.filename });
        if (!r.ok) { alert("Could not store the file in Drive: " + (r.error || "unknown error")); throw new Error(r.error); }
        return true;
      }
      return false;
    },
    async delete(key) {
      const k = parseKey(key);
      if (k.kind === "state") { try { localStorage.removeItem(key); } catch {} return true; }
      if (k.kind === "candidate") {
        const r = await api("delete", { id: k.id });
        if (!r.ok) { alert(r.error || "Could not delete."); throw new Error(r.error); }
        cache.delete(k.id);
        return true;
      }
      if (k.kind === "blob") { await api("docDelete", { candidateId: k.id, docKey: k.docKey }); return true; }
      return true;
    },
  };
})();
const _backend = _serverBackend,
  _hasStorage = true;
async function _safeGet(e) {
  if (!_backend) return _memCache.has(e) ? { value: _memCache.get(e) } : null;
  try {
    return await _backend.get(e);
  } catch {
    return null;
  }
}
async function _safeSet(e, t) {
  if ((_memCache.set(e, t), !_backend)) return !0;
  try {
    return (await _backend.set(e, t), !0);
  } catch (t) {
    return (console.error("Storage set failed for", e, t), !1);
  }
}
async function _safeDelete(e) {
  if ((_memCache.delete(e), !_backend)) return !0;
  try {
    return (await _backend.delete(e), !0);
  } catch {
    return !1;
  }
}
async function loadState() {
  const e = await _safeGet(SK.state);
  if (e?.value)
    try {
      return roleForSession(JSON.parse(e.value));
    } catch {}
  return roleForSession({ activeCandidate: null, activeRole: "BM", view: "pipeline" });
}
/* The role picker was the only thing standing between a reader and every
   candidate. Now the sheet decides what comes down, and the picker only
   changes which queue the page shows. Everyone but the Branch Manager sees
   their own. */
function roleForSession(state) {
  const p = SESSION.profile;
  if (!p || p.role === "BM") return state;
  return { ...state, activeRole: p.role, activeUser: p.name };
}
async function saveState(e) {
  return _safeSet(SK.state, JSON.stringify(e));
}
async function loadCandidateList() {
  const e = await _safeGet(SK.candidateList);
  if (e?.value)
    try {
      return JSON.parse(e.value);
    } catch {}
  return [];
}
async function saveCandidateList(e) {
  return _safeSet(SK.candidateList, JSON.stringify(e));
}
/* A record written by an earlier build is missing whatever sections were
   added since — the seeded candidate has no interviewingReports, no
   spouseInterview, no inspectionReport, no letters — and a stage view that
   reaches into one of those took the whole page down with it. Every loaded
   record is laid over a blank one first, so a section that was never written
   reads as empty rather than as undefined. The record's own values always win;
   only what it does not have is filled in. */
function withDefaults(rec) {
  if (!rec || typeof rec !== "object") return rec;
  const merge = (base, over) => {
    if (over === undefined) return base;
    if (over === null) return base && typeof base === "object" ? base : over;
    if (Array.isArray(base) || Array.isArray(over)) return over;
    if (base && typeof base === "object" && typeof over === "object") {
      const out = { ...base };
      for (const k of Object.keys(over)) out[k] = merge(base[k], over[k]);
      return out;
    }
    return over;
  };
  const out = merge(blankCandidate(rec.meta?.name || ""), rec);
  out.id = rec.id;
  return out;
}
async function loadCandidate(e) {
  const t = await _safeGet(SK.candidate(e));
  if (t?.value)
    try {
      return withDefaults(JSON.parse(t.value));
    } catch {}
  return null;
}
async function saveCandidate(e) {
  const t = JSON.parse(JSON.stringify(e)),
    a = t.stages?.selectionFile?.documentUploads || {};
  for (const t of Object.keys(a)) {
    const n = a[t];
    n?.base64 &&
      (await _safeSet(SK.docBlob(e.id, t), JSON.stringify({ base64: n.base64, mediaType: n.mediaType, filename: n.filename })),
      (n.base64 = ""),
      (n.hasBlob = !0));
  }
  const n = t.stages?.pop7Review?.uploadedReport;
  return (
    n?.base64 &&
      (await _safeSet(SK.popBlob(e.id), JSON.stringify({ base64: n.base64, mediaType: n.mediaType, filename: n.filename })),
      (n.base64 = ""),
      (n.hasBlob = !0)),
    _safeSet(SK.candidate(e.id), JSON.stringify(t))
  );
}
async function loadDocBlob(e, t) {
  const a = await _safeGet(SK.docBlob(e, t));
  if (a?.value)
    try {
      return JSON.parse(a.value);
    } catch {}
  return null;
}
async function loadPopBlob(e) {
  const t = await _safeGet(SK.popBlob(e));
  if (t?.value)
    try {
      return JSON.parse(t.value);
    } catch {}
  return null;
}
async function deleteCandidate(e) {
  return _safeDelete(SK.candidate(e));
}
function mergeImportedCandidate(e, t) {
  const a = JSON.parse(JSON.stringify(e));
  ((a.meta = { ...(a.meta || {}), ...(t.meta || {}) }), (a.updated = t.updated || a.updated));
  const n = t.stages || {};
  a.stages = a.stages || {};
  for (const e of Object.keys(n))
    if ("selectionFile" === e) {
      const e = a.stages.selectionFile || {},
        t = n.selectionFile || {};
      a.stages.selectionFile = {
        ...e,
        ...t,
        documentUploads: { ...(e.documentUploads || {}), ...(t.documentUploads || {}) },
        filePrepChecklist: { ...(e.filePrepChecklist || {}), ...(t.filePrepChecklist || {}) },
      };
    } else if ("pop7Review" === e) {
      const e = a.stages.pop7Review || {},
        t = n.pop7Review || {},
        r = e.uploadedReport || {},
        s = t.uploadedReport || {},
        o = { ...r, ...s };
      (s.base64 ||
        s.hasBlob ||
        (!r.base64 && !r.hasBlob) ||
        ((o.base64 = r.base64 || ""), (o.hasBlob = !!r.hasBlob)),
        (a.stages.pop7Review = { ...e, ...t, uploadedReport: o }));
    } else a.stages[e] = { ...(a.stages[e] || {}), ...(n[e] || {}) };
  return a;
}
const setPath = (e, t, a) => {
    if (0 === t.length) return a;
    const [n, ...r] = t,
      s = e && "object" == typeof e ? e : "number" == typeof n ? [] : {};
    if (Array.isArray(s)) {
      const e = s.slice();
      return ((e[n] = setPath(s[n], r, a)), e);
    }
    return { ...s, [n]: setPath(s?.[n], r, a) };
  },
  getPath = (e, t) => t.reduce((e, t) => e?.[t], e),
  newId = (e) => e + "_" + Math.random().toString(36).slice(2, 10);
function blankCandidate(e = "") {
  return {
    id: newId("cand"),
    created: new Date().toISOString(),
    updated: new Date().toISOString(),
    meta: {
      name: e,
      phone: "",
      email: "",
      address: "",
      sourceType: "",
      sourceDetail: "",
      branch: "",
      recruitingManager: "",
      branchManager: "",
      internalCandidate: "",
      currentStage: "firstInterview",
    },
    stages: {
      firstInterview: blankFirstInterview(),
      bmApproval: blankBmApproval(),
      pop7Review: blankPop7Review(),
      discovery: blankDiscovery(),
      selectionFile: blankSelectionFile(),
      approval: blankApproval(),
      onboarding: blankOnboarding(),
      induction: blankInduction(),
    },
  };
}
function blankFirstInterview() {
  return {
    status: "not_started",
    interviewer: "",
    interviewerRole: "",
    date: "",
    location: "In person",
    personalObservation: {
      presentation: 0,
      energy: 0,
      articulation: 0,
      listening: 0,
      likeability: 0,
      notes: "",
      proceedAfterPo: "",
    },
    sourceBackground: {
      referralPath: "",
      referralSource: "",
      familySituation: "",
      currentEmployment: "",
      compensationExpectation: "",
      whyNow: "",
    },
    experienceBranch: "",
    inexperienced: {
      motivation: { score: 0, notes: "" },
      careerCoherence: { score: 0, notes: "" },
      incomeRunway: { score: 0, notes: "" },
      networkStrength: { score: 0, notes: "" },
      coachability: { score: 0, notes: "" },
      selfManagement: { score: 0, notes: "" },
      familyBuyIn: { score: 0, notes: "" },
    },
    experienced: {
      productionHistory: { score: 0, notes: "" },
      persistency: { score: 0, notes: "" },
      reasonLeaving: { score: 0, notes: "" },
      bookPortability: { score: 0, notes: "" },
      professionalDev: { score: 0, notes: "" },
      incomeAlignment: { score: 0, notes: "" },
      familyBuyIn: { score: 0, notes: "" },
      redFlags: {},
    },
    closing: { candidateQuestions: "", expectationsSet: !1, candidateConcerns: "" },
    outcome: "",
    outcomeNotes: "",
    nextStepDate: "",
    rmComments: "",
    rmRecommendation: "",
    rmSubmittedAt: "",
    bmReview: { reviewed: !1, bmComments: "", bmDecision: "", bmReviewedAt: "", bmReviewer: "" },
    bmEmailGenerated: "",
  };
}
function blankBmApproval() {
  return {
    status: "not_started",
    meetingDate: "",
    present: "",
    bmFollowUpScores: {
      executivePresence: 0,
      coachabilityResponse: 0,
      financialClarity: 0,
      networkSpecificity: 0,
      driveDepth: 0,
    },
    bmFollowUpNotes: {
      executivePresence: "",
      coachabilityResponse: "",
      financialClarity: "",
      networkSpecificity: "",
      driveDepth: "",
    },
    bmObservations: "",
    bmConcerns: "",
    bmRedFlagsConfirmed: "",
    bmDecision: "",
    bmDecisionDate: "",
    bmDecisionRationale: "",
    bmAcknowledged: !1,
    bmAcknowledgedDate: "",
    overrideBy: "",
    overrideReason: "",
    pop7SentDate: "",
    pop7CompletedDate: "",
    pop7ReportCode: "",
    pop7CandidateLink: "",
    pop7Administered: !1,
  };
}
function blankPop7Review() {
  return {
    status: "not_started",
    reviewer: "",
    date: "",
    probability: "",
    scores: { ps: "", ep: "", ap: "", ip: "", sd: "", lm: "", cr: "" },
    snapshot: "",
    managementPreview: "",
    selectionConsiderations: "",
    trainingCoaching: "",
    retentionProspects: "",
    review: { strengths: "", concerns: "", coachingRecs: "" },
    interviewAnswers: {},
    rmFinalRecommendation: "",
    rmFinalRationale: "",
    uploadedReport: { filename: "", uploadedAt: "", sizeKB: 0 },
    aiAnalysis: {
      generatedAt: "",
      summary: "",
      dimensions: {},
      overallVerdict: "",
      coachingPriorities: [],
      raw: "",
    },
  };
}
function blankDiscovery() {
  return {
    status: "not_started",
    ggldcEnrolled: !1,
    ggldcEmail: "",
    enrolledDate: "",
    expectedComplete: "",
    modules: {
      m1: { sessions: {}, notes: "" },
      m2: { sessions: {}, notes: "" },
      m3: { sessions: {}, notes: "" },
      m4: { sessions: {}, notes: "" },
      m5: { sessions: {}, notes: "" },
      m6: { sessions: {}, notes: "" },
    },
    moduleProgress: {
      m1: { assigned: "", completed: "", notes: "" },
      m2: { assigned: "", completed: "", notes: "" },
      m3: { assigned: "", completed: "", notes: "" },
      m4: { assigned: "", completed: "", notes: "" },
      m5: { assigned: "", completed: "", notes: "" },
      m6: { assigned: "", completed: "", notes: "" },
    },
    marketSurveys: [],
    orientationClasses: 0,
    discoverySummaryEval: {
      ratings: { i1: "", i2: "", i3: "", i4: "", i5: "", i6: "", i7: "", i8: "", i9: "", i10: "" },
      comments: { i1: "", i2: "", i3: "", i4: "", i5: "", i6: "", i7: "", i8: "", i9: "", i10: "" },
      trainerName: "",
      date: "",
    },
  };
}
function blankSelectionFile() {
  return {
    status: "not_started",
    formA: {
      age: "",
      education: "",
      discoverySummary: "",
      employment: "",
      unemployedYears: 0,
      maritalStatus: "",
      carOwnership: "",
      pop7: "",
      pop7Probability: "",
      incomePotential: "",
      notes: {
        age: "",
        education: "",
        discoverySummary: "",
        employment: "",
        maritalStatus: "",
        carOwnership: "",
        pop7: "",
        incomePotential: "",
      },
    },
    selectionRejection: {
      tdDiscussed: "",
      careerPath: "",
      carOwnership: "",
      carNotes: "",
      carType: "",
      carYear: "",
      byod: "",
      docPresence: {},
      project100Monthly: "",
      checklist: {},
      awardsMDRT: "",
      orientationClasses: 0,
      marketSurveys: 0,
      financingAmount: "",
      spouseInterviewComment: "",
      additionalNotes: "",
    },
    confidentialReport1: blankConfidential(),
    confidentialReport2: blankConfidential(),
    interviewingReport1: blankInterviewing(),
    interviewingReport2: blankInterviewing(),
    spouseInterview: blankSpouse(),
    incomePotential: {
      quantities: {},
      approach: { easily: 0, fairlyEasily: 0, withDifficulty: 0, probablyNot: 0 },
    },
    initialApplication: {
      address: {
        current: { addr: "", years: "", months: "" },
        previous: { addr: "", years: "", months: "" },
      },
      education: [],
      educationNotes: "",
      employment: [],
      organisationalActivities: [],
      awards: [],
      references: [],
      signature: { date: "", signed: !1 },
    },
    documents: {},
    documentUploads: {},
    inspectionReport: blankInspection(),
    recommendationLetter: { date: "", body: "", authorRole: "", authorName: "" },
    circulationMemo: { date: "", from: "", to: "", body: "", issuedBy: "" },
    supportingLetter: { date: "", officer: "", body: "", authorRole: "" },
  };
}
function blankConfidential() {
  return {
    intervieweeName: "",
    interviewerName: "",
    dateCompleted: "",
    known: { howKnown: "", howLong: "", seeOften: "", workEnv: "", why: "", recommend: "" },
    formerEmployee: {
      position: "",
      threeWords: "",
      winningAttitude: "",
      accomplishments: "",
      supervision: "",
      challenges: "",
      stressful: "",
      rehire: "",
    },
    ratings: { q1: "", q2: "", q3: "", q4: "", q5: "", q6: "", q7: "", q8: "" },
    open: { advice: "", trust: "", strengths: "", obstacles: "", other: "" },
  };
}
function blankInterviewing() {
  return {
    candidateRef: "",
    intervieweeName: "",
    occupation: "",
    age: "",
    knownBefore: "",
    relationship: "",
    otherRelationship: "",
    duration: "",
    method: "",
    infoFreely: "",
    objectiveSubjective: "",
    summary: "",
    positives: "",
    negatives: "",
  };
}
function blankSpouse() {
  return {
    name: "",
    relationship: "",
    insurance: "",
    impressionAgent: "",
    publicView: "",
    familyReact: "",
    personalFeel: "",
    preferAnother: "",
    longHours: "",
  };
}
function blankInspection() {
  return {
    request: { type: "", branchManager: "", unitManager: "", assistant: "", dateInterview: "", invoice: "" },
    personal: {
      name: "",
      sex: "",
      age: "",
      dob: "",
      id: "",
      dp: "",
      dpExp: "",
      pp: "",
      ppExp: "",
      addressOnDp: "",
      currentAddress: "",
      phones: "",
      marital: "",
      companion: "",
      companionContact: "",
      companionEmployer: "",
      employer: "",
    },
    family: [],
    medical: {
      height: "",
      weight: "",
      allergies: "",
      cigarettes: "",
      marijuana: "",
      otherDrugs: "",
      alcohol: "",
      gambling: "",
      health: "",
    },
    employment: {
      employer: "",
      address: "",
      duration: "",
      position: "",
      supervisor: "",
      supervisorContact: "",
      agent: "",
      agentContact: "",
      comments: "",
    },
    references: [],
    referencesComments: "",
    financial: { vehicleInsurance: "", assets: "", liabilities: "" },
    hobbies: "",
    criminal: { neverCharged: !1, neverConvicted: !1, noPending: !1, noRTA: !1, ttpsCheck: "" },
    remarks: "",
    investigator: "",
    investigatorContact: "",
    date: "",
  };
}
function blankApproval() {
  return {
    status: "not_started",
    route: "",
    submittedDate: "",
    submittedTo: "",
    decision: "",
    decidedBy: "",
    decidedByRole: "",
    decisionDate: "",
    approvalMemoRef: "",
    selectionPanel: { date: "", members: "", outcome: "", notes: "" },
    conditions: "",
    comments: "",
  };
}
function blankOnboarding() {
  return {
    status: "not_started",
    cbtt: { applied: "", received: "", expiry: "" },
    agentNumber: "",
    glocEmail: "",
    aml: { started: "", completed: "" },
    oft: { completed: "", certSubmitted: "" },
    bootCamp: { started: "", completed: "" },
    induction: { started: "", completed: "", certSubmitted: "" },
    contract: { signed: "", returned: "" },
    notes: "",
  };
}
function blankInduction() {
  return {
    status: "not_started",
    contract: {
      issued: !1,
      issueDate: "",
      candidateAddress: "",
      probationStart: "",
      probationEnd: "",
      extended: !1,
      extensionEnd: "",
      branchLocation: "Chaguanas Regional Centre",
      issuedBy: "Marina Whiteman",
      issuedByTitle: "Senior Manager, Sales Administration Department",
      candidateAccepted: !1,
      candidateSignedDate: "",
    },
    quotas: { apiTarget: 105e3, commissionsTarget: 42e3, settledAppsTarget: 25, persistencyTarget: 90 },
    yearOne: { apiTarget: 25e4, commissionsTarget: 1e5, milestoneDate: "" },
    submissions: {
      td1Form: { submitted: !1, date: "" },
      birthCertificate: { submitted: !1, date: "" },
      nis: { submitted: !1, date: "" },
      stateLicense: { applied: !1, sat: !1, passed: !1, certNumber: "", date: "" },
    },
    coachingNotes: "",
    weeklyCheckIns: [],
    terminated: !1,
    terminationDate: "",
    terminationReason: "",
    terminationClause: "",
  };
}
function blankMarketSurvey() {
  return {
    id: newId("ms"),
    submitted: new Date().toISOString(),
    prospectFirstName: "",
    prospectLastName: "",
    source: "",
    email: "",
    incomeRange: "",
    ageBand: "",
    occupation: "",
    maritalStatus: "",
    timeKnown: "",
    howWellKnown: "",
    howOftenSeen: "",
    couldApproach: "",
    abilityRefer: "",
  };
}
const MS_SOURCES = [
    ["A", "School friends"],
    ["B", "Friends of family"],
    ["C", "Neighbours"],
    ["D", "Known through spouse"],
    ["E", "Known through children"],
    ["F", "Known through hobbies"],
    ["G", "Known through church"],
    ["H", "Known through social groups"],
    ["I", "Known through community activities"],
    ["J", "Known from past employment"],
    ["K", "Newly married persons"],
    ["L", "New parents"],
    ["M", "New homeowners"],
    ["N", "New job or job location"],
    ["O", "People with whom you do business"],
  ],
  MS_INCOME = [
    ["under_25", "Under $25,000", 12500],
    ["25_50", "$25,001 – $50,000", 37500],
    ["50_85", "$50,001 – $85,000", 67500],
    ["85_120", "$85,001 – $120,000", 102500],
    ["over_120", "Over $120,000", 15e4],
  ],
  MS_AGE = ["Under 25", "25–34 years", "35–44 years", "Over 45"],
  MS_OCC = [
    "Student",
    "Homemaker",
    "Professional, Technical",
    "Prop., Mgr., Executive",
    "Clerical, Kindred Workers",
    "Sales Workers",
    "Crafts, Operatives, Laborers",
    "Military Service",
    "Services, Farmers",
    "Retired",
  ],
  MS_MARITAL = ["Single, Divorced or Widowed", "Married", "Children"],
  MS_TIME = ["More than 5 years", "2 – 5 years", "Less than 2 years"],
  MS_KNOWN = ["Close friend", "Casual friend", "Speaking acquaintance"],
  MS_SEEN = ["More than 5 times", "3 – 5 times", "1 – 2 times", "Not at all"],
  MS_APPROACH = ["Easily", "Fairly easily", "With difficulty", "Probably not"],
  MS_REFER = ["Excellent", "Good", "Fair", "Poor"],
  FORM_A = {
    age: [
      ["Less than 25 yrs", 0],
      ["25 – 44 yrs", 10],
      ["45 – 54 yrs", 5],
      ["55 – 59 yrs", 3],
      ["Over 60 yrs", 0],
    ],
    education: [
      ["Less than 5 O'Levels", 0],
      ["Less than 5 O'Levels + short cert.", 3],
      ["5 O'Levels (Math OR English)", 3],
      ["5 O'Levels (Math AND English)", 5],
      ["A'Levels / Diploma", 6],
      ["BSc / BA Degree", 8],
      ["MBA / EMBA", 10],
    ],
    discoverySummary: [
      ["Less than 4 points", 0],
      ["5 points", 5],
      ["6 points", 6],
      ["7 points", 8],
    ],
    employment: Array.from({ length: 11 }, (e, t) =>
      10 === t
        ? ["10+ years", 10]
        : ["" + (0 === t ? "Less than 1 year" : t + " year" + (t > 1 ? "s" : "")), t],
    ),
    maritalStatus: [
      ["Single", 0],
      ["Common Law <5 yrs, no children", 3],
      ["Common Law <5 yrs, with children", 5],
      ["Single Parent", 5],
      ["Common Law 5+ yrs, no children", 7],
      ["Married, no children", 7],
      ["Common Law 5+ yrs, with children", 10],
      ["Married, with children", 10],
    ],
    carOwnership: [
      ["Yes", 10],
      ["No", 0],
    ],
    pop7: [
      ["41 – 60% (Average)", 6],
      ["61 – 80% (Above average)", 8],
      ["81 – 100% (Excellent)", 10],
    ],
    incomePotential: [
      ["Less than $7,000", 0],
      ["$7,000 – $8,999", 2],
      ["$9,000 – $11,999", 5],
      ["$12,000 – $14,999", 10],
      ["$15,000+", 12],
    ],
  };
function scoreFormA(e) {
  const t = e || {},
    a = (e) => {
      const a = t[e];
      if (!a && 0 !== a) return 0;
      const n = FORM_A[e]?.find(([e]) => e === a);
      return n ? n[1] : 0;
    },
    n = Math.max(0, parseInt(t.unemployedYears) || 0),
    r = Math.max(0, a("employment") - n),
    s =
      a("age") +
      a("education") +
      a("discoverySummary") +
      r +
      a("maritalStatus") +
      a("carOwnership") +
      a("pop7") +
      a("incomePotential");
  let o = "";
  s >= 60
    ? (o = "Hired on BM recommendation (60–80)")
    : s >= 50
      ? (o = "VP – Sales decision; possible Selection Panel (50–59)")
      : s > 0 && (o = "Selection Panel convened — final decision (Less than 50)");
  const c = [],
    i = t.education;
  (!i ||
    (i !== FORM_A.education[0][0] && i !== FORM_A.education[1][0]) ||
    c.push("Minimum education standard not achieved"),
    ("Less than 25 yrs" !== t.age && "55 – 59 yrs" !== t.age && "Over 60 yrs" !== t.age) ||
      c.push("Candidate less than 25 or over 55 years"));
  const l = parseFloat(t.pop7Probability);
  return (
    !isNaN(l) && l < 21 && c.push("POP 7 score is less than 21"),
    {
      total: s,
      action: o,
      flags: c,
      breakdown: {
        age: a("age"),
        education: a("education"),
        discoverySummary: a("discoverySummary"),
        employment: r,
        maritalStatus: a("maritalStatus"),
        carOwnership: a("carOwnership"),
        pop7: a("pop7"),
        incomePotential: a("incomePotential"),
      },
    }
  );
}
const INE_DIMS = [
    ["motivation", 'Motivation depth ("the why")', 3],
    ["careerCoherence", "Career history coherence", 2],
    ["incomeRunway", "Income expectations vs runway", 3],
    ["networkStrength", "Network strength", 2],
    ["coachability", "Coachability and learning agility", 3],
    ["selfManagement", "Self-management", 2],
    ["familyBuyIn", "Family / spouse buy-in", 1],
  ],
  EXP_DIMS = [
    ["productionHistory", "Production history (verifiable)", 3],
    ["persistency", "Persistency record", 3],
    ["reasonLeaving", "Reason for leaving (red flag scan)", 3],
    ["bookPortability", "Book portability and contract clarity", 2],
    ["professionalDev", "Professional development engagement", 2],
    ["incomeAlignment", "Income expectations alignment", 2],
    ["familyBuyIn", "Family / spouse buy-in", 1],
  ],
  PO_DIMS = [
    ["presentation", "Presentation", "Dress, grooming, posture, professional bearing"],
    ["energy", "Energy", "Engagement, animation, vocal energy"],
    ["articulation", "Articulation", "Speech clarity, vocabulary, structured thought"],
    ["listening", "Listening", "Hears the question, doesn't interrupt, asks clarifying"],
    ["likeability", "Likeability", "Would walk into a stranger's home and be welcomed?"],
  ];
function scorePersonalObservation(e) {
  if (!e) return { total: 0, band: "" };
  const t = PO_DIMS.reduce((t, [a]) => t + (Number(e[a]) || 0), 0);
  let a = "";
  return (
    t >= 16 ? (a = "proceed") : t >= 12 ? (a = "cautious") : t > 0 && (a = "terminate"),
    { total: t, band: a }
  );
}
function scoreFirstInterview(e) {
  if (!e) return { po: 0, structured: 0, total: 0, branch: "", recommendation: "" };
  const t = scorePersonalObservation(e.personalObservation),
    a = e.experienceBranch,
    n = "experienced" === a ? EXP_DIMS : INE_DIMS,
    r = "experienced" === a ? e.experienced : e.inexperienced;
  let s = 0;
  r &&
    n.forEach(([e, t, a]) => {
      const n = Number(r[e]?.score) || 0;
      s += n * a;
    });
  const o = t.total + s;
  let c = "";
  return (
    "inexperienced" === a
      ? o >= 80
        ? (c = "Strong proceed — administer POP 7.0")
        : o >= 65
          ? (c = "Proceed with notes")
          : o >= 50
            ? (c = "Hold — second meeting required")
            : o > 0 && (c = "Decline")
      : "experienced" === a &&
        (o >= 85
          ? (c = "Strong proceed — verify production with prior BM")
          : o >= 70
            ? (c = "Proceed with notes")
            : o >= 55
              ? (c = "Hold — second meeting with BM present")
              : o > 0 && (c = "Decline")),
    { po: t.total, poBand: t.band, structured: s, total: o, branch: a, recommendation: c }
  );
}
function normaliseDate(e) {
  if (!e) return "";
  const t = String(e).trim().toLowerCase(),
    a = t.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (a) return `${a[1]}-${a[2]}-${a[3]}`;
  const n = t.match(/^(\d{1,2})[\/\-\.](\d{1,2})[\/\-\.](\d{4})$/);
  if (n) return `${n[3]}-${String(n[2]).padStart(2, "0")}-${String(n[1]).padStart(2, "0")}`;
  const r = {
      jan: "01",
      feb: "02",
      mar: "03",
      apr: "04",
      may: "05",
      jun: "06",
      jul: "07",
      aug: "08",
      sep: "09",
      oct: "10",
      nov: "11",
      dec: "12",
    },
    s = t.match(/(\d{1,2})\D+([a-z]{3,9})\D+(\d{4})/);
  if (s) {
    const e = r[s[2].slice(0, 3)];
    if (e) return `${s[3]}-${e}-${String(s[1]).padStart(2, "0")}`;
  }
  return t;
}
const normalisePhone = (e) =>
    e
      ? String(e)
          .replace(/\D/g, "")
          .replace(/^1?868/, "")
      : "",
  normaliseText = (e) =>
    String(e || "")
      .toLowerCase()
      .replace(/\s+/g, " ")
      .trim(),
  dobFromIdNumber = (e) => {
    if (!e) return "";
    const t = String(e)
      .replace(/\D/g, "")
      .match(/^(\d{4})(\d{2})(\d{2})/);
    return t ? `${t[1]}-${t[2]}-${t[3]}` : "";
  };
function runValidation(e) {
  const t = [];
  if (!e) return t;
  const a = e.meta || {},
    n = e.stages?.selectionFile?.inspectionReport?.personal || {},
    r = [
      ["Personal/Meta", a.dob],
      ["Inspection Report", n.dob],
      ["ID-derived", dobFromIdNumber(n.id)],
    ]
      .map(([e, t]) => [e, normaliseDate(t)])
      .filter(([e, t]) => t);
  r.length > 1 &&
    new Set(r.map(([e, t]) => t)).size > 1 &&
    t.push({ severity: "high", field: "Date of Birth", detail: r.map(([e, t]) => `${e}: ${t}`).join(" · ") });
  const s = [
    ["Meta", a.phone],
    ["Inspection", n.phones],
  ]
    .map(([e, t]) => [e, normalisePhone(t)])
    .filter(([e, t]) => t);
  s.length > 1 &&
    new Set(s.map(([e, t]) => t)).size > 1 &&
    t.push({ severity: "medium", field: "Phone", detail: s.map(([e, t]) => `${e}: ${t}`).join(" · ") });
  const o = normaliseText(n.addressOnDp),
    c = normaliseText(n.currentAddress);
  o &&
    c &&
    o !== c &&
    t.push({
      severity: "low",
      field: "DP address vs current",
      detail: "DP shows different address than current. Update DP if applicable.",
    });
  const i = [
    ["Meta", a.name],
    ["Inspection", n.name],
  ]
    .map(([e, t]) => [e, normaliseText(t)])
    .filter(([e, t]) => t);
  return (
    i.length > 1 &&
      new Set(i.map(([e, t]) => t)).size > 1 &&
      t.push({ severity: "low", field: "Name", detail: i.map(([e, t]) => `${e}: ${t}`).join(" · ") }),
    t
  );
}
const STAGES = [
    { key: "firstInterview", label: "First Interview", short: "Interview", icon: MessageSquare, role: "RM" },
    { key: "bmApproval", label: "BM Approval & POP Admin", short: "BM + POP", icon: ShieldCheck, role: "BM" },
    { key: "pop7Review", label: "POP 7.0 Review", short: "POP Review", icon: ListChecks, role: "RM" },
    {
      key: "discovery",
      label: "Discovery / Orientation",
      short: "Discovery",
      icon: GraduationCap,
      role: "RM",
    },
    { key: "selectionFile", label: "Selection File", short: "File", icon: FileText, role: "BMA" },
    { key: "approval", label: "Approval Routing", short: "Approval", icon: ShieldCheck, role: "BM" },
    { key: "onboarding", label: "Onboarding", short: "Onboard", icon: Award, role: "BMA" },
    {
      key: "induction",
      label: "Induction (Probation Period)",
      short: "Induction",
      icon: TrendingUp,
      role: "BM",
    },
  ],
  BRANCH_ROSTER = {
    branchManager: [{ name: "Ricky Rampersad", role: "Branch Manager" }],
    bma: [{ name: "Kamla", role: "Branch Manager Assistant" }],
    recruitingManagers: [
      { name: "Kerwyn Ramroach", role: "Asst. Branch Manager (formerly Unit Manager)" },
      { name: "Gary Sookdeo", role: "Unit Manager" },
      { name: "Akaash Kalladeen", role: "Unit Manager" },
      { name: "Ricky Rampersad", role: "Branch Manager (acting RM)" },
      { name: "Other / external", role: "Other" },
    ],
  },
  ALL_MANAGER_NAMES = [
    ...BRANCH_ROSTER.branchManager.map((e) => e.name),
    ...BRANCH_ROSTER.bma.map((e) => e.name),
    ...BRANCH_ROSTER.recruitingManagers
      .map((e) => e.name)
      .filter((e) => !BRANCH_ROSTER.branchManager.some((t) => t.name === e)),
  ],
  RECRUITING_MANAGER_OPTIONS = BRANCH_ROSTER.recruitingManagers.map((e) => [
    e.name,
    e.name,
    `${e.name} (${e.role})`,
  ]),
  POP_QUESTION_BANK = {
    EP: {
      label: "Enterprising Potential",
      description: "Predicts daily activity and survival in commission sales",
      bands: [
        {
          min: 40,
          max: 999,
          tone: "strong",
          label: "Strong (40+)",
          narrative: "High self-management potential. Should manage their own activity well.",
          questions: [
            "Walk me through your typical week — how do you structure your time when no one is watching?",
            "Give me an example where you set a target for yourself and held yourself accountable to it without anyone checking.",
            "What's the most demanding self-imposed routine you've maintained for more than 6 months?",
          ],
        },
        {
          min: 30,
          max: 40,
          tone: "average",
          label: "Average (30-40)",
          narrative: "Adequate self-management. Will benefit from structure and accountability.",
          questions: [
            "How do you organize your week today? Walk me through a typical Monday-to-Friday.",
            "Tell me about a time you had to drive your own activity — what worked, what didn't?",
            "How do you respond when no one's checking on your progress?",
          ],
        },
        {
          min: -999,
          max: 30,
          tone: "caution",
          label: "Caution (<30)",
          narrative:
            "Low self-management. Will likely struggle with the autonomy of commission sales. Needs heavy structure and accountability or will drift.",
          questions: [
            "In your last role, who set your daily activity targets — you, or someone else?",
            "What happens when you have a free day with no fixed schedule?",
            "Tell me about a time you missed a target. What had broken down?",
            "How do you feel about being measured weekly on activity numbers — calls, appointments, sales?",
          ],
        },
      ],
    },
    AP: {
      label: "Achievement Potential",
      description: "Motivational orientation: money/challenge vs people/service vs safety",
      bands: [
        {
          min: 25,
          max: 999,
          tone: "caution",
          label: "Very Strong $ (>25)",
          narrative:
            "Money may be the only thing that matters. Strongly task and goal oriented. Aggressive closer — may not be suited for relationship-based selling.",
          questions: [
            "Walk me through a deal where you closed hard. How did the customer feel afterwards?",
            "What's more important to you — the size of the commission cheque, or the longevity of the relationship?",
            "Tell me about a client you walked away from because the sale wasn't right for them.",
          ],
        },
        {
          min: -5,
          max: 25,
          tone: "strong",
          label: "Balanced (-5 to 25)",
          narrative: "Money-motivated with healthy balance. Good for most commission sales roles.",
          questions: [
            "What are your income goals for year 1? How did you arrive at that number?",
            "Tell me about your most rewarding sale — what made it rewarding?",
          ],
        },
        {
          min: -20,
          max: -5,
          tone: "average",
          label: "Service-leaning (-5 to -20)",
          narrative:
            "Softer closer. Suited for relationship selling over a long arc but may struggle with bottom-line urgency.",
          questions: [
            "What's harder for you — asking for the sale, or asking for the referral?",
            "Tell me about a deal you should have closed but didn't. What stopped you?",
            'How do you balance "helping the client" with "earning your keep"?',
          ],
        },
        {
          min: -999,
          max: -20,
          tone: "caution",
          label: "Decline-risk (<-20)",
          narrative:
            "Generally unwilling to close. Typically unsuited for commission sales. Needs significant coaching or a different role.",
          questions: [
            "When was the last time you asked someone directly for money or a commitment?",
            'What does "selling" mean to you, in your own words?',
            "How would you feel if your monthly income was 100% commission with no salary floor?",
            "Tell me about a time you failed to ask for the sale because you didn't want to be pushy.",
          ],
        },
      ],
    },
    IP: {
      label: "Independence Potential",
      description: "Comfort with autonomy vs need for structure",
      bands: [
        {
          min: 40,
          max: 999,
          tone: "caution",
          label: "Very Independent (>40)",
          narrative:
            "May break rules, create own structure. Not a team player. Difficult to coach inside an organization.",
          questions: [
            "How do you respond when a manager asks you to use a process you disagree with?",
            "Tell me about a rule you broke at work. Why?",
          ],
        },
        {
          min: -10,
          max: 40,
          tone: "strong",
          label: "Independence-Oriented (-10 to 40)",
          narrative: "Healthy autonomy. Will operate inside structure but takes initiative.",
          questions: [
            "Tell me about a time you took initiative without being asked.",
            "When do you ask for help, and when do you push through alone?",
          ],
        },
        {
          min: -25,
          max: -10,
          tone: "average",
          label: "Team-Oriented (-10 to -25)",
          narrative: "Will benefit from a team environment, supervision, structured pipeline.",
          questions: [
            "How do you feel about working alone for long stretches?",
            "How often do you check in with managers / colleagues?",
          ],
        },
        {
          min: -999,
          max: -25,
          tone: "caution",
          label: "Very Dependent (<-25)",
          narrative:
            "Requires structure and may become dependent on it. Typically unsuited for many commission sales roles.",
          questions: [
            "What kind of supervision do you do best under?",
            "How do you handle a day with no scheduled appointments and no one to ask?",
            "Tell me about a project you led from start to finish on your own.",
            "What do you need from your manager to feel confident enough to act?",
          ],
        },
      ],
    },
    CR: {
      label: "Call Reluctance",
      description: "Attitude towards prospecting, rejection, and sales as a career",
      bands: [
        {
          min: 60,
          max: 999,
          tone: "caution",
          label: "Inflated (>60)",
          narrative:
            "Possibly too high — may indicate inflated self-image or unrealistic confidence. Probe for grounded self-assessment.",
          questions: [
            "What's your weakest area as a salesperson today?",
            "Tell me about a time you were turned down hard. How did it actually feel?",
            "When was the last time you felt out of your depth in front of a prospect?",
          ],
        },
        {
          min: 40,
          max: 60,
          tone: "strong",
          label: "Comfortable (40-60)",
          narrative: "Comfortable prospecting and managing rejection. Genuinely sees sales as a career.",
          questions: [
            "Tell me about your best week of prospecting ever. What did you do?",
            'How do you reset after a string of "no"s?',
          ],
        },
        {
          min: 25,
          max: 40,
          tone: "average",
          label: "Some hesitation (25-40)",
          narrative: "Will benefit from coaching on prospecting habits and rejection handling.",
          questions: [
            "What part of prospecting do you find hardest?",
            'How many cold outreaches per week feels comfortable for you? How many would feel "too many"?',
          ],
        },
        {
          min: -999,
          max: 25,
          tone: "caution",
          label: "Reluctant (<25)",
          narrative:
            "Significant prospecting reluctance. Will avoid the activity that drives the role unless heavily coached.",
          questions: [
            "How do you feel about asking strangers for their time?",
            "When was the last time you reached out to someone you didn't know well to ask for business?",
            "What would have to change for you to feel good about cold prospecting?",
          ],
        },
      ],
    },
    PS: {
      label: "Predictor Score",
      description: "Composite predicting success at year two in sales",
      bands: [
        {
          min: 45,
          max: 999,
          tone: "strong",
          label: "Strong (45+)",
          narrative: "Above-average overall fit for commission sales.",
          questions: ["What aspects of this career are you most confident about?"],
        },
        {
          min: 30,
          max: 45,
          tone: "average",
          label: "Average (30-45)",
          narrative: "Acceptable composite — but check the underlying scales for specific weaknesses.",
          questions: [
            "Of the dimensions we've discussed, which feels most natural to you, which feels hardest?",
          ],
        },
        {
          min: -999,
          max: 30,
          tone: "caution",
          label: "Below threshold (<30)",
          narrative: "Strong caution. Would need exceptional natural market and strong coaching to succeed.",
          questions: [
            "Walk me through your prospect list — who are the first 20 people you'll call?",
            "How will you replace your current income while building this business?",
          ],
        },
      ],
    },
  },
  POP_SCALES = [
    { key: "PS", label: "Predictor Score (PS)", hint: "Composite — predicts year-2 survival" },
    { key: "EP", label: "Enterprising Potential (EP)", hint: "<30 = penalty trigger" },
    { key: "AP", label: "Achievement Potential (AP)", hint: "Money vs service motivation" },
    { key: "IP", label: "Independence Potential (IP)", hint: "<-25 = dependency penalty" },
    { key: "SD", label: "Self Directed (SD)", hint: "<25 = penalty trigger" },
    { key: "LM", label: "Lifestyle Management (LM)", hint: "<25 = penalty trigger" },
    { key: "CR", label: "Call Reluctance (CR)", hint: "<25 = penalty; >60 = inflated" },
  ];
function bandForScore(e, t) {
  const a = POP_QUESTION_BANK[e];
  if (!a) return null;
  const n = Number(t);
  return Number.isNaN(n) ? null : a.bands.find((e) => n >= e.min && n < e.max) || a.bands[a.bands.length - 1];
}
// Filled from the workbook after sign-in — see loadDatasets(). Empty until then.
let PRODUCTION_DATA = {},
  MARKET_SURVEYS = {},
  MANAGER_PULSE_SUMMARY = {},
  AGENT_MONTHLY_VARIANCE = {};
const FILE_PREP_INEXPERIENCED = [
    {
      num: "0",
      item: "Index for Inexperienced Agents",
      mandatory: !0,
      source: "master template",
      owner: "BMA",
    },
    {
      num: "1",
      item: "Selection Rejection Training Process",
      mandatory: !0,
      source: "master template",
      owner: "BMA",
    },
    { num: "2", item: "New Recruit Memo (RM signed)", mandatory: !0, source: "RM-prepared", owner: "RM" },
    {
      num: "3",
      item: "Agent Selection Criteria Form A",
      mandatory: !0,
      source: "master template",
      owner: "RM",
    },
    {
      num: "4",
      item: "Selection Rejection Training Process Form (signed)",
      mandatory: !0,
      source: "master template",
      owner: "RM",
    },
    { num: "5", item: "Resume", mandatory: !0, source: "candidate", owner: "Candidate" },
    {
      num: "6.a",
      item: "Copies of Academic Qualifications",
      mandatory: !0,
      source: "candidate",
      owner: "Candidate",
    },
    { num: "6.b", item: "Recommendations (×2)", mandatory: !0, source: "candidate", owner: "Candidate" },
    {
      num: "7",
      item: "Personal Questionnaire and Declaration Form",
      mandatory: !0,
      source: "master template",
      owner: "Candidate",
    },
    {
      num: "8",
      item: "Initial Selection and Personal Financial Statement",
      mandatory: !0,
      source: "master template",
      owner: "Candidate",
    },
    {
      num: "9",
      item: "New Candidate Discovery Report (GGLDC)",
      mandatory: !0,
      source: "GGLDC system",
      owner: "RM",
    },
    {
      num: "10",
      item: "POP 7.0 Predictor of Potential",
      mandatory: !0,
      source: "POP 7.0 instrument",
      owner: "RM",
    },
    {
      num: "11",
      item: "Discovery Summary Evaluation",
      mandatory: !0,
      source: "master template",
      owner: "RM",
    },
    { num: "12", item: "Inspection Report", mandatory: !0, source: "master template", owner: "BM" },
    {
      num: "13",
      item: "Confidential Reports (×2 from each referee)",
      mandatory: !0,
      source: "master template",
      owner: "RM",
    },
    {
      num: "14",
      item: "Interviewing Reports (×2 from each referee)",
      mandatory: !0,
      source: "master template",
      owner: "RM",
    },
    { num: "15", item: "Spouse-Partner-Parent Form", mandatory: !0, source: "master template", owner: "RM" },
    {
      num: "16",
      item: "Income Potential Summary of Project",
      mandatory: !0,
      source: "xlsx template",
      owner: "RM",
    },
    { num: "17", item: "Income Potential Analysis", mandatory: !0, source: "xlsx template", owner: "RM" },
    {
      num: "18",
      item: "18-pack: ID, address, certificate of character, bank statement, NIS, BIR, vehicle docs",
      mandatory: !0,
      source: "candidate",
      owner: "Candidate",
    },
  ],
  FILE_PREP_EXPERIENCED = [
    {
      num: "0",
      item: "Index for Experienced Agents",
      mandatory: !0,
      source: "master template",
      owner: "BMA",
    },
    {
      num: "1",
      item: "Selection Rejection Training Process",
      mandatory: !0,
      source: "master template",
      owner: "BMA",
    },
    { num: "2", item: "New Recruit Memo (RM signed)", mandatory: !0, source: "RM-prepared", owner: "RM" },
    {
      num: "3",
      item: "Agent Selection Criteria Form B (Experienced)",
      mandatory: !0,
      source: "master template",
      owner: "RM",
    },
    {
      num: "4",
      item: "Experienced Agents Interview Guide",
      mandatory: !0,
      source: "master template",
      owner: "RM",
    },
    {
      num: "5",
      item: "Initial and Advanced Selection Interview Guide",
      mandatory: !0,
      source: "master template",
      owner: "RM",
    },
    {
      num: "6",
      item: "Resume + qualifications + recommendations",
      mandatory: !0,
      source: "candidate",
      owner: "Candidate",
    },
    {
      num: "7",
      item: "Personal Questionnaire and Declaration Form",
      mandatory: !0,
      source: "master template",
      owner: "Candidate",
    },
    {
      num: "8",
      item: "Personal and Financial Statement",
      mandatory: !0,
      source: "master template",
      owner: "Candidate",
    },
    { num: "9", item: "Confidential Report", mandatory: !0, source: "master template", owner: "RM" },
    { num: "10", item: "Interviewing Report", mandatory: !0, source: "master template", owner: "RM" },
    {
      num: "11",
      item: "POP 7.0 Predictor of Potential",
      mandatory: !0,
      source: "POP 7.0 instrument",
      owner: "RM",
    },
    { num: "12", item: "Spouse-Partner-Parent Form", mandatory: !0, source: "master template", owner: "RM" },
    { num: "13", item: "Summary of Project 100", mandatory: !0, source: "master template", owner: "RM" },
    {
      num: "14",
      item: "18-pack: ID, address, certificate of character, bank statement, NIS, BIR, vehicle docs",
      mandatory: !0,
      source: "candidate",
      owner: "Candidate",
    },
    {
      num: "15",
      item: "Prior production records (last 24 months)",
      mandatory: !0,
      source: "prior carrier",
      owner: "Candidate",
    },
    {
      num: "16",
      item: "License standing letter from regulator",
      mandatory: !0,
      source: "regulator",
      owner: "BM",
    },
  ];
let COHORT_DATA = [];
const ROLES = [
    { key: "BM", label: "Branch Manager" },
    { key: "BMA", label: "BM Assistant" },
    { key: "RM", label: "Recruiting Manager" },
    { key: "INV", label: "Investigator" },
  ];
function stageStatus(e, t) {
  const a = e?.stages?.[t];
  return a && a.status ? a.status : "not_started";
}
function computeStageCompletion(e, t) {
  const a = e?.stages?.[t];
  if (!a) return 0;
  if ("firstInterview" === t) {
    const e = scoreFirstInterview(a);
    return a.outcome ? 100 : e.total > 0 ? 60 : a.experienceBranch ? 30 : e.po > 0 ? 15 : 0;
  }
  if ("bmApproval" === t) {
    const t = e?.stages?.firstInterview,
      n = fiTier(t || {}, t ? scoreFirstInterview(t) : { total: 0 });
    if (!n) return 0;
    if ("strong" === n) {
      const e = a.bmAcknowledged ? 30 : 0,
        t = a.pop7CompletedDate ? 70 : a.pop7SentDate ? 35 : 0;
      return Math.min(100, e + t);
    }
    if ("marginal" === n) {
      const e = (Object.values(a.bmFollowUpScores || {}).filter((e) => Number(e) > 0).length / 5) * 30,
        t = a.bmDecision ? 20 : 0,
        n = a.pop7CompletedDate ? 50 : a.pop7SentDate ? 25 : 0;
      return Math.min(100, Math.round(e + t + n));
    }
    if (!a.bmDecision) return 10;
    if ("decline" === a.bmDecision || "second_meeting" === a.bmDecision) return 100;
    const r = a.overrideBy && a.overrideReason ? 40 : 20,
      s = a.pop7CompletedDate ? 60 : a.pop7SentDate ? 30 : 0;
    return Math.min(100, r + s);
  }
  if ("pop7Review" === t) {
    const e = [a.probability, a.review?.strengths, a.review?.coachingRecs, a.rmFinalRecommendation].filter(
        Boolean,
      ).length,
      t = Object.values(a.interviewAnswers || {}).filter((e) => e?.answer).length;
    return Math.min(100, Math.round((e / 4) * 60) + Math.min(40, 5 * t));
  }
  if ("discovery" === t) {
    const e = a.marketSurveys?.length || 0,
      t = Number(a.orientationClasses) || 0,
      n = Object.values(a.discoverySummaryEval?.ratings || {}).filter(Boolean).length,
      r = (Math.min(e, 100) / 100) * 50 + (Math.min(t, 9) / 9) * 25 + (n / 10) * 25;
    return Math.round(r);
  }
  if ("selectionFile" === t) {
    const e = scoreFormA(a.formA).total > 0 ? 30 : 0,
      t =
        (a.confidentialReport1?.intervieweeName ? 15 : 0) + (a.confidentialReport2?.intervieweeName ? 15 : 0),
      n =
        (a.interviewingReport1?.intervieweeName ? 10 : 0) + (a.interviewingReport2?.intervieweeName ? 10 : 0),
      r = a.inspectionReport?.remarks ? 20 : 0;
    return Math.min(100, e + t + n + r);
  }
  if ("approval" === t) return a.decision ? 100 : a.submittedDate ? 50 : a.route ? 20 : 0;
  if ("onboarding" === t) {
    const e = [
      a.cbtt?.received,
      a.agentNumber,
      a.glocEmail,
      a.aml?.completed,
      a.oft?.completed,
      a.bootCamp?.completed,
      a.induction?.completed,
      a.contract?.signed,
    ].filter(Boolean).length;
    return Math.round((e / 8) * 100);
  }
  if ("induction" === t) {
    if (a.terminated) return 100;
    const e = a.contract?.issued || a.contract?.issueDate ? 15 : 0,
      t = a.contract?.probationStart && a.contract?.probationEnd ? 15 : 0,
      n = a.contract?.candidateAccepted ? 10 : 0,
      r =
        (a.submissions?.td1Form?.submitted ? 5 : 0) +
        (a.submissions?.birthCertificate?.submitted ? 5 : 0) +
        (a.submissions?.nis?.submitted ? 5 : 0),
      s = a.submissions?.stateLicense?.passed ? 15 : 0,
      o = a.contract?.probationEnd,
      c = o && new Date(o) < new Date() ? 30 : 0;
    return Math.min(100, e + t + n + r + s + c);
  }
  return 0;
}
const Label = ({ children: e, hint: t }) =>
    React.createElement(
      "label",
      { className: "block" },
      React.createElement(
        "span",
        { className: "block text-[11px] uppercase tracking-[0.14em] text-stone-500 font-medium mb-1.5" },
        e,
      ),
      t && React.createElement("span", { className: "block text-[11px] text-stone-400 italic mb-1" }, t),
    ),
  inputCls =
    "w-full px-3 py-2 bg-white border border-stone-300 rounded-sm text-stone-900 placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-emerald-800/20 focus:border-emerald-800 transition-colors text-sm";
function TextInput({ label: e, value: t, onChange: a, type: n = "text", placeholder: r = "", hint: s }) {
  return React.createElement(
    "div",
    null,
    e && React.createElement(Label, { hint: s }, e),
    React.createElement("input", {
      type: n,
      className: inputCls,
      value: t || "",
      placeholder: r,
      onChange: (e) => a(e.target.value),
    }),
  );
}
function NumberInput({ label: e, value: t, onChange: a, min: n, max: r, step: s = 1, hint: o }) {
  return React.createElement(
    "div",
    null,
    e && React.createElement(Label, { hint: o }, e),
    React.createElement("input", {
      type: "number",
      className: inputCls,
      value: 0 === t || t ? t : "",
      min: n,
      max: r,
      step: s,
      onChange: (e) => a("" === e.target.value ? "" : Number(e.target.value)),
    }),
  );
}
function TextArea({ label: e, value: t, onChange: a, rows: n = 4, placeholder: r = "", hint: s }) {
  return React.createElement(
    "div",
    null,
    e && React.createElement(Label, { hint: s }, e),
    React.createElement("textarea", {
      rows: n,
      className: inputCls + " font-serif leading-relaxed",
      value: t || "",
      placeholder: r,
      onChange: (e) => a(e.target.value),
    }),
  );
}
function Select({ label: e, value: t, onChange: a, options: n, hint: r, placeholder: s = "Select…" }) {
  return React.createElement(
    "div",
    null,
    e && React.createElement(Label, { hint: r }, e),
    React.createElement(
      "select",
      {
        className: inputCls + " appearance-none pr-8 cursor-pointer",
        value: t || "",
        style: {
          backgroundImage:
            'url("data:image/svg+xml;utf8,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%2212%22 height=%2212%22 viewBox=%220 0 24 24%22 fill=%22none%22 stroke=%22%23999%22 stroke-width=%222%22><polyline points=%226 9 12 15 18 9%22/></svg>")',
          backgroundPosition: "right 0.75rem center",
          backgroundRepeat: "no-repeat",
        },
        onChange: (e) => a(e.target.value),
      },
      React.createElement("option", { value: "" }, s),
      n.map((e) => {
        const [t, a] = Array.isArray(e) ? [e[0], e[2] || e[1] || e[0]] : [e, e];
        return React.createElement("option", { key: t, value: t }, a);
      }),
    ),
  );
}
function ButtonGroup({ label: e, value: t, onChange: a, options: n, hint: r }) {
  return React.createElement(
    "div",
    null,
    e && React.createElement(Label, { hint: r }, e),
    React.createElement(
      "div",
      { className: "flex gap-1.5 flex-wrap" },
      n.map((e) => {
        const [n, r] = Array.isArray(e) ? e : [e, e],
          s = t === n;
        return React.createElement(
          "button",
          {
            key: n,
            type: "button",
            onClick: () => a(s ? "" : n),
            className:
              "px-3 py-1.5 text-xs uppercase tracking-wider border rounded-sm transition-all " +
              (s
                ? "bg-stone-900 text-stone-50 border-stone-900"
                : "bg-white text-stone-700 border-stone-300 hover:border-stone-500"),
          },
          r,
        );
      }),
    ),
  );
}
function Checkbox({ label: e, checked: t, onChange: a, note: n }) {
  const r = !!t;
  return React.createElement(
    "label",
    { className: "flex items-start gap-2.5 cursor-pointer group py-1" },
    React.createElement(
      "span",
      { className: "relative flex-shrink-0 mt-0.5 inline-block w-4 h-4" },
      React.createElement("input", {
        type: "checkbox",
        className: "absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10",
        checked: r,
        onChange: (e) => a(e.target.checked),
      }),
      React.createElement("span", {
        className: "absolute inset-0 block border rounded-sm transition-colors",
        style: { backgroundColor: r ? "#065f46" : "#ffffff", borderColor: r ? "#065f46" : "#a8a29e" },
      }),
      r &&
        React.createElement(CheckCircle2, {
          className: "absolute inset-0 w-4 h-4 text-stone-50 pointer-events-none",
          strokeWidth: 3,
        }),
    ),
    React.createElement(
      "span",
      { className: "text-sm text-stone-700 leading-snug select-none" },
      e,
      n && React.createElement("span", { className: "block text-xs text-stone-500 italic mt-0.5" }, n),
    ),
  );
}
function ScoreSelect({ value: e, onChange: t, max: a = 5, labels: n }) {
  const r = Array.from({ length: a }, (e, t) => t + 1);
  return React.createElement(
    "div",
    { className: "flex gap-1" },
    r.map((a) => {
      const r = Number(e) === a,
        s = r
          ? a >= 4
            ? "bg-emerald-700 text-white border-emerald-700"
            : 3 === a
              ? "bg-amber-600 text-white border-amber-600"
              : "bg-rose-700 text-white border-rose-700"
          : "bg-white text-stone-500 border-stone-300 hover:border-stone-700";
      return React.createElement(
        "button",
        {
          key: a,
          type: "button",
          onClick: () => t(r ? 0 : a),
          className: `w-9 h-9 text-xs font-bold border rounded-sm transition-all ${s}`,
          title: n?.[a - 1] || `Score ${a}`,
        },
        a,
      );
    }),
  );
}
function RatingEGF({ label: e, value: t, onChange: a }) {
  return React.createElement(
    "div",
    {
      className:
        "flex items-center justify-between gap-3 py-2.5 border-b border-stone-200/70 last:border-b-0",
    },
    React.createElement("span", { className: "text-sm text-stone-700 leading-snug flex-1" }, e),
    React.createElement(
      "div",
      { className: "flex gap-1" },
      [
        ["E", "Excellent"],
        ["G", "Good"],
        ["F", "Fair"],
      ].map(([e, n]) => {
        const r = t === e,
          s =
            "E" === e
              ? "bg-emerald-800 text-stone-50 border-emerald-800"
              : "G" === e
                ? "bg-amber-700 text-stone-50 border-amber-700"
                : "bg-rose-700 text-stone-50 border-rose-700";
        return React.createElement(
          "button",
          {
            key: e,
            type: "button",
            onClick: () => a(r ? "" : e),
            title: n,
            className:
              "w-9 h-9 text-xs font-bold border rounded-sm transition-all " +
              (r ? s : "bg-white text-stone-500 border-stone-300 hover:border-stone-500"),
          },
          e,
        );
      }),
    ),
  );
}
const Grid = ({ children: e, cols: t = 2 }) =>
    React.createElement(
      "div",
      {
        className:
          "grid gap-4 " +
          (1 === t ? "grid-cols-1" : 3 === t ? "grid-cols-1 md:grid-cols-3" : "grid-cols-1 md:grid-cols-2"),
      },
      e,
    ),
  Divider = ({ label: e }) =>
    React.createElement(
      "div",
      { className: "flex items-center gap-3 my-5 first:mt-0" },
      React.createElement("span", { className: "h-px bg-stone-300 flex-1" }),
      e &&
        React.createElement(
          "span",
          { className: "text-[10px] uppercase tracking-[0.2em] text-stone-500 font-medium" },
          e,
        ),
      e && React.createElement("span", { className: "h-px bg-stone-300 flex-1" }),
    );
function ReadoutBox({ label: e, value: t, warn: a, large: n, accent: r, trend: s }) {
  const o =
    "emerald" === r
      ? "#15803d"
      : "amber" === r
        ? "#b45309"
        : "rose" === r
          ? "#9f1239"
          : "navy" === r
            ? "#07131f"
            : "#1A1A1A";
  return React.createElement(
    "div",
    {
      className:
        "relative px-4 py-3 border rounded-sm bg-white overflow-hidden " +
        (a ? "border-amber-400" : "border-stone-300"),
    },
    r &&
      React.createElement("div", {
        className: "absolute left-0 top-0 bottom-0 w-1",
        style: { backgroundColor: o },
      }),
    React.createElement(
      "div",
      { className: "text-[11px] uppercase tracking-[0.14em] text-stone-500 mb-1" },
      e,
    ),
    React.createElement(
      "div",
      { className: "flex items-baseline gap-2" },
      React.createElement(
        "div",
        { className: "font-mono " + (n ? "text-3xl" : "text-lg"), style: { color: o } },
        t,
      ),
      s && React.createElement("div", { className: "text-[11px] text-stone-500" }, s),
    ),
    a && React.createElement("div", { className: "text-[11px] text-amber-700 mt-1" }, a),
  );
}
function LinearBar({
  value: e,
  max: t = 100,
  height: a = 6,
  tone: n = "stone",
  striped: r,
  animate: s,
  showLabel: o,
}) {
  const c = Math.max(0, Math.min(100, (Number(e) / t) * 100)),
    i =
      "emerald" === n
        ? "#15803d"
        : "amber" === n
          ? "#d97706"
          : "rose" === n
            ? "#9f1239"
            : "navy" === n
              ? "#07131f"
              : "#44403c";
  return React.createElement(
    "div",
    { className: "w-full" },
    o &&
      React.createElement(
        "div",
        { className: "flex justify-between text-[10px] uppercase tracking-wider text-stone-500 mb-1" },
        React.createElement("span", null, o),
        React.createElement("span", { className: "font-mono" }, Math.round(c), "%"),
      ),
    React.createElement(
      "div",
      { className: "w-full bg-stone-200 rounded-full overflow-hidden", style: { height: a } },
      React.createElement("div", {
        className:
          "h-full transition-all duration-700 ease-out rounded-full " +
          (r ? "bg-stripes" : "") +
          (s ? " animate-pulse" : ""),
        style: { width: c + "%", backgroundColor: i },
      }),
    ),
  );
}
function RadialProgress({
  value: e,
  max: t = 100,
  size: a = 56,
  stroke: n = 5,
  tone: r = "stone",
  label: s,
  sublabel: o,
}) {
  const c = Math.max(0, Math.min(100, (Number(e) / t) * 100)),
    i = (a - n) / 2,
    l = 2 * Math.PI * i,
    m = l - (c / 100) * l,
    d =
      "emerald" === r
        ? "#15803d"
        : "amber" === r
          ? "#d97706"
          : "rose" === r
            ? "#9f1239"
            : "navy" === r
              ? "#07131f"
              : "#44403c";
  return React.createElement(
    "div",
    { className: "inline-flex flex-col items-center gap-1" },
    React.createElement(
      "div",
      { className: "relative", style: { width: a, height: a } },
      React.createElement(
        "svg",
        { width: a, height: a, className: "-rotate-90" },
        React.createElement("circle", {
          cx: a / 2,
          cy: a / 2,
          r: i,
          fill: "none",
          stroke: "#e7e5e4",
          strokeWidth: n,
        }),
        React.createElement("circle", {
          cx: a / 2,
          cy: a / 2,
          r: i,
          fill: "none",
          stroke: d,
          strokeWidth: n,
          strokeDasharray: l,
          strokeDashoffset: m,
          strokeLinecap: "round",
          style: { transition: "stroke-dashoffset 0.7s ease-out" },
        }),
      ),
      React.createElement(
        "div",
        { className: "absolute inset-0 flex items-center justify-center" },
        React.createElement(
          "span",
          { className: "font-mono text-xs font-semibold", style: { color: d } },
          Math.round(c),
          "%",
        ),
      ),
    ),
    s &&
      React.createElement(
        "div",
        { className: "text-[10px] uppercase tracking-wider text-stone-500 font-medium" },
        s,
      ),
    o && React.createElement("div", { className: "text-[10px] text-stone-400" }, o),
  );
}
function StepIndicator({ steps: e, currentIdx: t, getCompletion: a }) {
  return React.createElement(
    "div",
    { className: "flex items-center w-full overflow-x-auto pb-1" },
    e.map((n, r) => {
      const s = a ? a(n) >= 100 : r < t,
        o = r === t,
        c = n.icon || Circle;
      return React.createElement(
        React.Fragment,
        { key: n.key },
        React.createElement(
          "div",
          { className: "flex flex-col items-center min-w-[70px]" },
          React.createElement(
            "div",
            {
              className:
                "w-9 h-9 rounded-full flex items-center justify-center border-2 transition-all flex-shrink-0 " +
                (s
                  ? "bg-emerald-700 border-emerald-700 text-white"
                  : o
                    ? "bg-stone-900 border-stone-900 text-stone-50"
                    : "bg-white border-stone-300 text-stone-400"),
            },
            s
              ? React.createElement(CheckCircle2, { className: "w-4 h-4", strokeWidth: 2.5 })
              : React.createElement(c, { className: "w-4 h-4" }),
          ),
          React.createElement(
            "div",
            {
              className: "text-[9px] uppercase tracking-wider mt-1.5 text-center px-1 leading-tight",
              style: { color: o ? "#1A1A1A" : "#78716c", fontWeight: o ? 600 : 400 },
            },
            n.short || n.label,
          ),
        ),
        r < e.length - 1 &&
          React.createElement("div", {
            className: "flex-1 h-0.5 min-w-[20px] -mt-5 mx-1",
            style: { backgroundColor: s ? "#15803d" : "#d6d3d1" },
          }),
      );
    }),
  );
}
function ScoreGauge({ value: e, max: t = 100, size: a = 140, label: n, recommendation: r }) {
  const s = Math.max(0, Math.min(100, (Number(e) / t) * 100)),
    o = a / 2 - 12,
    c = Math.PI * o,
    i = c - (s / 100) * c,
    l = s >= 80 ? "emerald" : s >= 65 ? "amber" : s > 0 ? "rose" : "stone",
    m = "emerald" === l ? "#15803d" : "amber" === l ? "#d97706" : "rose" === l ? "#9f1239" : "#a8a29e";
  return React.createElement(
    "div",
    { className: "inline-flex flex-col items-center" },
    React.createElement(
      "div",
      { className: "relative", style: { width: a, height: a / 2 + 16 } },
      React.createElement(
        "svg",
        { width: a, height: a / 2 + 16 },
        React.createElement("path", {
          d: `M 12 ${a / 2} A ${o} ${o} 0 0 1 ${a - 12} ${a / 2}`,
          fill: "none",
          stroke: "#e7e5e4",
          strokeWidth: 10,
          strokeLinecap: "round",
        }),
        React.createElement("path", {
          d: `M 12 ${a / 2} A ${o} ${o} 0 0 1 ${a - 12} ${a / 2}`,
          fill: "none",
          stroke: m,
          strokeWidth: 10,
          strokeLinecap: "round",
          strokeDasharray: c,
          strokeDashoffset: i,
          style: { transition: "stroke-dashoffset 1s ease-out" },
        }),
      ),
      React.createElement(
        "div",
        { className: "absolute inset-0 flex flex-col items-center justify-end pb-0.5" },
        React.createElement(
          "div",
          { className: "font-serif text-3xl font-semibold", style: { color: m } },
          e,
        ),
        React.createElement(
          "div",
          { className: "text-[10px] uppercase tracking-wider text-stone-500" },
          "/ ",
          t,
        ),
      ),
    ),
    n &&
      React.createElement(
        "div",
        { className: "text-[11px] uppercase tracking-[0.14em] text-stone-600 mt-1 font-medium" },
        n,
      ),
    r &&
      React.createElement(
        "div",
        {
          className:
            "text-xs mt-2 px-3 py-1 rounded-full font-medium " +
            ("emerald" === l
              ? "bg-emerald-50 text-emerald-800 border border-emerald-200"
              : "amber" === l
                ? "bg-amber-50 text-amber-800 border border-amber-200"
                : "rose" === l
                  ? "bg-rose-50 text-rose-800 border border-rose-200"
                  : "bg-stone-50 text-stone-600 border border-stone-200"),
        },
        r,
      ),
  );
}
function StatBlock({ icon: e, label: t, value: a, sublabel: n, tone: r = "stone" }) {
  const s = {
    stone: { bg: "#FAFAF9", border: "#e7e5e4", text: "#1A1A1A", accent: "#78716c" },
    emerald: { bg: "#ECFDF5", border: "#A7F3D0", text: "#064E3B", accent: "#15803d" },
    amber: { bg: "#FFFBEB", border: "#FDE68A", text: "#78350F", accent: "#d97706" },
    rose: { bg: "#FFF1F2", border: "#FECDD3", text: "#881337", accent: "#9f1239" },
    navy: { bg: "#F0F4F8", border: "#CBD5E1", text: "#07131f", accent: "#07131f" },
  }[r] || { bg: "#FAFAF9", border: "#e7e5e4", text: "#1A1A1A", accent: "#78716c" };
  return React.createElement(
    "div",
    {
      className: "relative rounded-sm border p-4 overflow-hidden",
      style: { backgroundColor: s.bg, borderColor: s.border },
    },
    e &&
      React.createElement(
        "div",
        { className: "absolute top-3 right-3 opacity-20" },
        React.createElement(e, { className: "w-10 h-10", style: { color: s.accent }, strokeWidth: 1.5 }),
      ),
    React.createElement(
      "div",
      { className: "text-[10px] uppercase tracking-[0.14em] font-medium mb-1", style: { color: s.accent } },
      t,
    ),
    React.createElement(
      "div",
      { className: "font-serif text-2xl font-semibold", style: { color: s.text } },
      a,
    ),
    n && React.createElement("div", { className: "text-[11px] mt-0.5", style: { color: s.accent } }, n),
  );
}
function Section({ title: e, subtitle: t, children: a, defaultOpen: n = !0, complete: r }) {
  const [s, o] = useState(n),
    c = s ? ChevronDown : ChevronRight;
  return React.createElement(
    "section",
    { className: "bg-white border border-stone-200 rounded-sm overflow-hidden" },
    React.createElement(
      "button",
      {
        type: "button",
        onClick: () => o(!s),
        className: "w-full flex items-center gap-3 px-4 py-3 hover:bg-stone-50 transition-colors text-left",
      },
      React.createElement(c, { className: "w-4 h-4 text-stone-400 flex-shrink-0", strokeWidth: 2.5 }),
      React.createElement(
        "div",
        { className: "flex-1 min-w-0" },
        React.createElement("h3", { className: "font-serif text-base text-stone-900 leading-tight" }, e),
        t && React.createElement("p", { className: "text-xs text-stone-500 mt-0.5" }, t),
      ),
      void 0 !== r &&
        r > 0 &&
        r < 100 &&
        React.createElement(
          "div",
          { className: "flex items-center gap-2 flex-shrink-0" },
          React.createElement(
            "div",
            { className: "w-20 hidden md:block" },
            React.createElement(LinearBar, {
              value: r,
              height: 4,
              tone: r >= 75 ? "emerald" : r >= 40 ? "amber" : "stone",
            }),
          ),
          React.createElement(
            "span",
            { className: "text-[11px] font-mono text-stone-500 tabular-nums" },
            r,
            "%",
          ),
        ),
      r >= 100 &&
        React.createElement(
          "div",
          { className: "flex items-center gap-1.5 flex-shrink-0" },
          React.createElement(CheckCircle2, { className: "w-5 h-5 text-emerald-700" }),
          React.createElement(
            "span",
            { className: "text-[10px] uppercase tracking-wider text-emerald-700 font-semibold" },
            "Complete",
          ),
        ),
    ),
    s &&
      React.createElement("div", { className: "px-5 pb-6 pt-2 border-t border-stone-100 bg-stone-50/30" }, a),
  );
}
function RowList({ rows: e = [], onChange: t, template: a, fields: n, addLabel: r = "Add row" }) {
  return React.createElement(
    "div",
    { className: "space-y-3" },
    (e || []).map((a, r) =>
      React.createElement(
        "div",
        { key: a.id || r, className: "flex gap-3 items-end flex-wrap" },
        n.map((n) =>
          React.createElement(
            "div",
            { key: n.key, className: "flex-1 min-w-[140px]" },
            React.createElement(TextInput, {
              label: n.label,
              value: a[n.key],
              placeholder: n.placeholder,
              onChange: (a) =>
                ((a, n, r) => t(e.map((e, t) => (t === a ? { ...e, [n]: r } : e))))(r, n.key, a),
            }),
          ),
        ),
        React.createElement(
          "button",
          {
            type: "button",
            onClick: () => ((a) => t(e.filter((e, t) => t !== a)))(r),
            className:
              "h-10 px-3 text-stone-400 hover:text-rose-700 transition-colors flex items-center justify-center flex-shrink-0",
            title: "Remove",
          },
          React.createElement(Trash2, { className: "w-4 h-4" }),
        ),
      ),
    ),
    React.createElement(
      "button",
      {
        type: "button",
        onClick: () => t([...(e || []), a()]),
        className:
          "inline-flex items-center gap-1.5 px-3 py-1.5 text-xs uppercase tracking-wider text-stone-700 border border-stone-300 hover:border-stone-900 hover:bg-stone-900 hover:text-stone-50 transition-colors rounded-sm",
      },
      React.createElement(Plus, { className: "w-3.5 h-3.5" }),
      " ",
      r,
    ),
  );
}
function FirstInterviewStage({ candidate: e, persist: t }) {
  const a = e.stages.firstInterview,
    n = (e, a) => t((t) => setPath(t, ["stages", "firstInterview", ...e], a)),
    r = useMemo(() => scoreFirstInterview(a), [a]);
  return React.createElement(
    "div",
    { className: "space-y-3" },
    React.createElement(
      Section,
      { title: "Interview meta", defaultOpen: !0 },
      React.createElement(
        Grid,
        { cols: 3 },
        React.createElement(Select, {
          label: "Interviewer",
          value: a.interviewer,
          onChange: (e) => n(["interviewer"], e),
          options: RECRUITING_MANAGER_OPTIONS,
        }),
        React.createElement(Select, {
          label: "Interviewer role",
          value: a.interviewerRole,
          onChange: (e) => n(["interviewerRole"], e),
          options: [
            "Branch Manager",
            "Asst. Branch Manager",
            "Unit Manager",
            "Trainee Manager",
            "Recruiting Manager",
          ],
        }),
        React.createElement(TextInput, {
          label: "Date",
          type: "date",
          value: a.date,
          onChange: (e) => n(["date"], e),
        }),
        React.createElement(Select, {
          label: "Format",
          value: a.location,
          onChange: (e) => n(["location"], e),
          options: ["In person", "Virtual", "On the phone"],
        }),
      ),
    ),
    React.createElement(PersonalObservationCard, {
      data: a.personalObservation,
      upd: (e, t) => n(["personalObservation", ...e], t),
      score: r,
    }),
    ("proceed" === r.poBand || "cautious" === r.poBand) &&
      React.createElement(SourceBackgroundCard, {
        data: a.sourceBackground,
        upd: (e, t) => n(["sourceBackground", ...e], t),
      }),
    ("proceed" === r.poBand || "cautious" === r.poBand) &&
      React.createElement(
        Section,
        {
          title: "Branch point — experience",
          subtitle: "Has the candidate previously held a contract or licence to sell life insurance?",
          defaultOpen: !0,
        },
        React.createElement(ButtonGroup, {
          value: a.experienceBranch,
          onChange: (e) => n(["experienceBranch"], e),
          options: [
            ["inexperienced", "No prior insurance sales experience"],
            ["experienced", "Prior insurance sales experience"],
          ],
        }),
        React.createElement(
          "p",
          { className: "mt-3 text-xs text-stone-500 italic" },
          '"Have you previously held a contract or licence to sell life insurance, with this company or any other? This includes provisional licences and any role where you earned commission from insurance product sales."',
        ),
      ),
    "inexperienced" === a.experienceBranch &&
      React.createElement(InexperiencedTrackCard, {
        data: a.inexperienced,
        upd: (e, t) => n(["inexperienced", ...e], t),
      }),
    "experienced" === a.experienceBranch &&
      React.createElement(ExperiencedTrackCard, {
        data: a.experienced,
        upd: (e, t) => n(["experienced", ...e], t),
      }),
    a.experienceBranch &&
      React.createElement(ClosingCard, { data: a.closing, upd: (e, t) => n(["closing", ...e], t) }),
    a.experienceBranch && React.createElement(OutcomeCard, { fi: a, score: r, candidate: e, upd: n }),
  );
}
function PersonalObservationCard({ data: e, upd: t, score: a }) {
  const n = ["Decline", "Concerning", "Acceptable", "Strong"];
  return React.createElement(
    Section,
    {
      title: "Personal observation",
      subtitle: "First 15-20 minutes · Hard filter before structured questions",
      defaultOpen: !0,
    },
    React.createElement(
      "div",
      { className: "text-xs text-stone-600 italic mb-4 px-3 py-2 bg-stone-100 rounded-sm" },
      "Open with rapport. Let the candidate talk about themselves. Score continuously.",
    ),
    React.createElement(
      "div",
      { className: "border border-stone-200 rounded-sm bg-white p-4 space-y-3" },
      PO_DIMS.map(([a, r, s]) =>
        React.createElement(
          "div",
          {
            key: a,
            className:
              "flex items-center justify-between gap-3 py-2 border-b border-stone-200/70 last:border-b-0",
          },
          React.createElement(
            "div",
            { className: "flex-1 min-w-0" },
            React.createElement("div", { className: "text-sm text-stone-800 font-medium" }, r),
            React.createElement("div", { className: "text-xs text-stone-500 mt-0.5" }, s),
          ),
          React.createElement(ScoreSelect, { value: e[a], onChange: (e) => t([a], e), max: 4, labels: n }),
        ),
      ),
    ),
    React.createElement(
      "div",
      { className: "mt-4" },
      React.createElement(TextArea, {
        label: "Observation notes",
        value: e.notes,
        onChange: (e) => t(["notes"], e),
        rows: 3,
        placeholder: "What stood out? What was concerning? Specific quotes or moments.",
      }),
    ),
    React.createElement(
      "div",
      { className: "mt-4 grid gap-3 md:grid-cols-3" },
      React.createElement(
        "div",
        { className: "px-4 py-3 border-2 rounded-sm bg-white border-stone-900" },
        React.createElement(
          "div",
          { className: "text-[11px] uppercase tracking-[0.14em] text-stone-500 mb-1" },
          "PO total",
        ),
        React.createElement(
          "div",
          { className: "flex items-baseline gap-2 mb-2" },
          React.createElement("div", { className: "font-serif text-3xl text-stone-900" }, a.po),
          React.createElement(
            "div",
            { className: "text-[10px] uppercase tracking-wider text-stone-400" },
            "/ 20",
          ),
        ),
        React.createElement(LinearBar, {
          value: a.po,
          max: 20,
          height: 5,
          tone: a.po >= 16 ? "emerald" : a.po >= 12 ? "amber" : a.po > 0 ? "rose" : "stone",
        }),
      ),
      React.createElement(
        "div",
        { className: "md:col-span-2 px-4 py-3 border rounded-sm bg-white border-stone-300" },
        React.createElement(
          "div",
          { className: "text-[11px] uppercase tracking-[0.14em] text-stone-500 mb-1" },
          "Decision rule",
        ),
        "proceed" === a.poBand &&
          React.createElement(
            "div",
            { className: "text-sm text-emerald-800" },
            React.createElement("strong", null, "Proceed"),
            " to structured interview. Strong personal observation.",
          ),
        "cautious" === a.poBand &&
          React.createElement(
            "div",
            { className: "text-sm text-amber-800" },
            React.createElement("strong", null, "Proceed cautiously."),
            " Note what concerned you and probe in structured section.",
          ),
        "terminate" === a.poBand &&
          React.createElement(
            "div",
            { className: "text-sm text-rose-800" },
            React.createElement("strong", null, "Terminate respectfully."),
            " Below threshold (12). Use the closing script.",
          ),
        !a.poBand &&
          React.createElement(
            "div",
            { className: "text-sm text-stone-500" },
            "Score the dimensions above to surface a recommendation.",
          ),
        React.createElement(
          "div",
          { className: "mt-3 pt-3 border-t border-stone-200" },
          React.createElement(
            "div",
            { className: "flex justify-between text-[10px] uppercase tracking-wider text-stone-500 mb-1" },
            React.createElement("span", null, "Termination"),
            React.createElement("span", null, "Cautious"),
            React.createElement("span", null, "Proceed"),
          ),
          React.createElement(
            "div",
            { className: "relative h-3 bg-stone-200 rounded-full overflow-hidden" },
            React.createElement("div", {
              className: "absolute inset-y-0 left-0 bg-rose-300",
              style: { width: "60%" },
            }),
            React.createElement("div", {
              className: "absolute inset-y-0 bg-amber-300",
              style: { left: "60%", width: "20%" },
            }),
            React.createElement("div", {
              className: "absolute inset-y-0 bg-emerald-300",
              style: { left: "80%", width: "20%" },
            }),
            a.po > 0 &&
              React.createElement("div", {
                className:
                  "absolute top-0 bottom-0 w-1 bg-stone-900 rounded-full transition-all duration-700",
                style: { left: (a.po / 20) * 100 + "%" },
              }),
          ),
        ),
      ),
    ),
    "terminate" === a.poBand &&
      React.createElement(
        "div",
        { className: "mt-3 px-4 py-3 border border-rose-300 bg-rose-50 rounded-sm" },
        React.createElement(
          "div",
          { className: "text-[11px] uppercase tracking-wider font-semibold text-rose-900 mb-1" },
          "Termination script",
        ),
        React.createElement(
          "div",
          { className: "text-sm text-rose-900 italic leading-relaxed" },
          "\"Thank you for coming in and sharing with me today. I appreciate the time you've taken. Our process at this stage involves matching candidates to opportunities that suit their background and goals. I'll be in touch within a week if there's a fit. In the meantime, I wish you the very best.\"",
        ),
      ),
  );
}
function SourceBackgroundCard({ data: e, upd: t }) {
  return React.createElement(
    Section,
    { title: "Source and background", subtitle: "Universal · 5 minutes · Confirm and probe" },
    React.createElement(
      Grid,
      { cols: 2 },
      React.createElement(Select, {
        label: "Referral path",
        value: e.referralPath,
        onChange: (e) => t(["referralPath"], e),
        options: [
          "Agent referral",
          "Walk-in",
          "Social media",
          "Centre of Influence",
          "Internal employee",
          "Advertisement",
          "Recruiting agency",
          "Other",
        ],
      }),
      React.createElement(TextInput, {
        label: "Referral source name",
        value: e.referralSource,
        onChange: (e) => t(["referralSource"], e),
        placeholder: "Who referred them?",
      }),
      React.createElement(TextInput, {
        label: "Current employment status",
        value: e.currentEmployment,
        onChange: (e) => t(["currentEmployment"], e),
        placeholder: "Employed at X / between roles / etc.",
      }),
      React.createElement(TextInput, {
        label: "Compensation expectation",
        value: e.compensationExpectation,
        onChange: (e) => t(["compensationExpectation"], e),
        placeholder: "Year 1 expected income",
      }),
    ),
    React.createElement(
      "div",
      { className: "mt-4 space-y-3" },
      React.createElement(TextArea, {
        label: "Family situation",
        value: e.familySituation,
        onChange: (e) => t(["familySituation"], e),
        rows: 2,
        placeholder: "Spouse, children, dependents, financial decision-makers",
      }),
      React.createElement(TextArea, {
        label: "Why now? — their decision in their own words",
        value: e.whyNow,
        onChange: (e) => t(["whyNow"], e),
        rows: 3,
        placeholder: "What brought them to consider this career at this point in their life?",
      }),
    ),
  );
}
const INE_QUESTIONS = {
    motivation: {
      title: 'Motivation depth ("the why")',
      weight: 3,
      primary:
        '"Why insurance sales, and why now? Walk me through the decision that brought you to consider this career."',
      followUp:
        '"Five years from now, if this career has gone well, what does your life look like that it doesn\'t look like today?"',
      listenFor:
        'A personal "why" with emotional weight — the hugot. Specific stories score high. Generic answers ("I like helping people") score low. Probe one level deeper than the first answer.',
    },
    careerCoherence: {
      title: "Career history coherence",
      weight: 2,
      primary:
        '"Walk me through your career so far. For each role: why you took it, what you learned, why you left."',
      listenFor:
        "A coherent narrative. Each move makes sense in retrospect. Watch for job-jumping, unexplained gaps, or a pattern of leaving when things got difficult. Cannot describe a single failure → red flag.",
    },
    incomeRunway: {
      title: "Income vs financial runway",
      weight: 3,
      primary:
        '"What do you currently spend each month to live? How long can your household run without your income before pressure begins?"',
      followUp:
        '"Are you comfortable with a commission-only structure, where what you earn is directly tied to what you produce, with no salary floor?"',
      listenFor:
        "Concrete numbers and honest engagement. Vague reassurance (\"oh I'll be fine\") is the answer of someone who hasn't done the math. Three months of runway with dependents = flag.",
    },
    networkStrength: {
      title: "Network strength (Project 100 quick-read)",
      weight: 2,
      primary:
        '"How many people in your phone right now would take your call if you rang them tomorrow morning?"',
      followUp:
        '"In your circle — family, friends, colleagues — how many adults earn over fifty thousand a year?"',
      listenFor:
        'Social influence indicators. Concrete numbers and named names matter. Vague references to "a lot of friends" do not.',
    },
    coachability: {
      title: "Coachability and learning agility",
      weight: 3,
      primary:
        '"Tell me about a time you received feedback that was hard to hear. What was it, what did you do with it, and would the person who gave it to you say you actually changed?"',
      followUp:
        '"Tell me about a time you had to learn something completely new — a skill, a topic, a system — quickly. How did you approach it?"',
      listenFor:
        "Specific stories with named people, concrete actions, visible outcomes. Watch for defensiveness or stories where the candidate is always the hero.",
    },
    selfManagement: {
      title: "Self-management and structure",
      weight: 2,
      primary:
        '"This career has no boss telling you what to do each morning. How do you currently structure your week when no one is watching?"',
      listenFor:
        'Evidence of self-imposed structure — calendar habit, planning ritual, existing routine. "I work best under pressure" = absence of system.',
    },
    familyBuyIn: {
      title: "Family / spouse buy-in",
      weight: 1,
      primary: '"Have you discussed this career change with your spouse or partner? What did they say?"',
      followUp:
        '"This career involves evening and weekend appointments. How does that fit with your family situation?"',
      listenFor:
        "Whether the conversation has happened. A partner who is anxious or unconvinced is a major attrition risk.",
    },
  },
  EXP_QUESTIONS = {
    productionHistory: {
      title: "Production history",
      weight: 3,
      primary:
        '"What was your settled annualised premium income for each of the last three years? How does it break down — number of cases, average case size, lapsed vs settled?"',
      followUp: '"If I called your previous Branch Manager today, what would they say your production was?"',
      listenFor:
        'Precise numbers, recalled without notes. A producer who genuinely produced will know their numbers. Hesitation, round numbers, or "I\'d have to check" = concerning.',
    },
    persistency: {
      title: "Persistency record",
      weight: 3,
      primary: '"What was your 13-month persistency rate at your last company? Your 25-month?"',
      followUp: '"If your persistency was below the company target in any year, what was the reason?"',
      listenFor:
        "An agent who knows their persistency cold. Ignorance of persistency = transactional rather than relational producer. Industry benchmark: 85%+ at 13 months.",
    },
    reasonLeaving: {
      title: "Reason for leaving",
      weight: 3,
      primary: '"Why are you leaving your current company? Or if you\'ve already left, why did you?"',
      followUp: '"What was missing there that you\'re hoping to find here?"',
      listenFor: "Coherent, professional reason. Use the red flag checklist below to flag patterns.",
    },
    bookPortability: {
      title: "Book portability and contract",
      weight: 2,
      primary:
        '"What does your current contract say about taking clients with you? Non-compete, non-solicit, or any restriction?"',
      followUp: '"Of the clients you\'ve served, realistically how many would follow you?"',
      listenFor:
        "Awareness of their own contractual obligations. An agent who shrugs off non-compete language exposes the branch to legal risk.",
    },
    professionalDev: {
      title: "Professional development",
      weight: 2,
      primary: '"What\'s the last industry course, conference, or designation you completed? When?"',
      followUp: '"What\'s your relationship with MDRT — qualified, working towards, not interested?"',
      listenFor:
        "Continuous engagement. No PD in two years = plateaued. MDRT trajectory = strong positive indicator.",
    },
    incomeAlignment: {
      title: "Income expectations alignment",
      weight: 2,
      primary: '"What do you need to earn here in year one, and what production would that translate to?"',
      listenFor:
        "Arithmetic that lines up. They should be able to back-calculate APIs, commission rates, overrides. Quoting a needed income they've never produced = red flag.",
    },
    familyBuyIn: {
      title: "Family / spouse buy-in",
      weight: 1,
      primary: '"How does your family feel about this career move?"',
      listenFor: "Whether the conversation has happened and what the partner said.",
    },
  },
  RED_FLAGS = [
    ["disparagesFormer", "Disparages former Branch Manager or company by name", "high"],
    ["vagueReasons", "Vague reasons for leaving with no specifics", "high"],
    ["demandingPerks", "Demanding specific perks day one", "high"],
    ["multipleCompanies", "3+ companies in 5 years", "high"],
    ["bookClaim", "Claims to bring whole book without contract clarity", "high"],
    ["cantArticulateLearning", "Cannot articulate what they learned at last company", "medium"],
    ["recentRelocation", "Recent geographic relocation", "medium"],
    ["wasLetGoMutual", 'Was let go but says it was "mutual"', "medium"],
  ];
function InexperiencedTrackCard({ data: e, upd: t }) {
  const a = ["", "Poor", "Below avg", "Average", "Above avg", "Excellent"];
  return React.createElement(
    Section,
    {
      title: "Inexperienced track",
      subtitle: "Career changer · 30-40 minutes · Score 1-5 per dimension",
      defaultOpen: !0,
    },
    React.createElement(
      "div",
      { className: "space-y-3" },
      INE_DIMS.map(([n, r, s]) => {
        const o = INE_QUESTIONS[n],
          c = e[n] || { score: 0, notes: "" };
        return React.createElement(
          "div",
          { key: n, className: "border border-stone-200 rounded-sm bg-white p-4" },
          React.createElement(
            "div",
            { className: "flex items-baseline justify-between gap-3 mb-2" },
            React.createElement("h4", { className: "font-serif text-base text-stone-900" }, o.title),
            React.createElement(
              "span",
              { className: "text-[11px] uppercase tracking-wider text-stone-500 font-mono flex-shrink-0" },
              "×",
              s,
            ),
          ),
          React.createElement("div", { className: "text-xs text-stone-600 italic mb-2" }, o.primary),
          o.followUp &&
            React.createElement(
              "div",
              { className: "text-xs text-stone-500 italic mb-2" },
              "Follow-up: ",
              o.followUp,
            ),
          React.createElement(
            "div",
            { className: "text-[11px] text-stone-500 mb-3 leading-relaxed" },
            React.createElement("span", { className: "uppercase tracking-wider mr-1" }, "Listen for:"),
            o.listenFor,
          ),
          React.createElement(
            "div",
            { className: "flex items-center gap-3 mb-3" },
            React.createElement(
              "span",
              { className: "text-[11px] uppercase tracking-wider text-stone-500" },
              "Score",
            ),
            React.createElement(ScoreSelect, {
              value: c.score,
              onChange: (e) => t([n, "score"], e),
              max: 5,
              labels: a.slice(1),
            }),
            c.score > 0 &&
              React.createElement(
                "span",
                { className: "text-xs text-stone-600 font-mono" },
                "contributes ",
                c.score * s,
                " pts",
              ),
          ),
          React.createElement(TextArea, {
            value: c.notes,
            onChange: (e) => t([n, "notes"], e),
            rows: 2,
            placeholder: "Specific quotes, evidence, or concerns from this dimension",
          }),
        );
      }),
    ),
  );
}
function ExperiencedTrackCard({ data: e, upd: t }) {
  const a = ["", "Poor", "Below avg", "Average", "Above avg", "Excellent"];
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(
      Section,
      {
        title: "Experienced track",
        subtitle: "Prior insurance sales experience · 30-45 minutes · Red flag focus",
        defaultOpen: !0,
      },
      React.createElement(
        "div",
        { className: "space-y-3" },
        EXP_DIMS.map(([n, r, s]) => {
          const o = EXP_QUESTIONS[n],
            c = e[n] || { score: 0, notes: "" };
          return React.createElement(
            "div",
            { key: n, className: "border border-stone-200 rounded-sm bg-white p-4" },
            React.createElement(
              "div",
              { className: "flex items-baseline justify-between gap-3 mb-2" },
              React.createElement("h4", { className: "font-serif text-base text-stone-900" }, o.title),
              React.createElement(
                "span",
                { className: "text-[11px] uppercase tracking-wider text-stone-500 font-mono flex-shrink-0" },
                "×",
                s,
              ),
            ),
            React.createElement("div", { className: "text-xs text-stone-600 italic mb-2" }, o.primary),
            o.followUp &&
              React.createElement(
                "div",
                { className: "text-xs text-stone-500 italic mb-2" },
                "Follow-up: ",
                o.followUp,
              ),
            React.createElement(
              "div",
              { className: "text-[11px] text-stone-500 mb-3 leading-relaxed" },
              React.createElement("span", { className: "uppercase tracking-wider mr-1" }, "Listen for:"),
              o.listenFor,
            ),
            React.createElement(
              "div",
              { className: "flex items-center gap-3 mb-3" },
              React.createElement(
                "span",
                { className: "text-[11px] uppercase tracking-wider text-stone-500" },
                "Score",
              ),
              React.createElement(ScoreSelect, {
                value: c.score,
                onChange: (e) => t([n, "score"], e),
                max: 5,
                labels: a.slice(1),
              }),
              c.score > 0 &&
                React.createElement(
                  "span",
                  { className: "text-xs text-stone-600 font-mono" },
                  "contributes ",
                  c.score * s,
                  " pts",
                ),
            ),
            React.createElement(TextArea, {
              value: c.notes,
              onChange: (e) => t([n, "notes"], e),
              rows: 2,
              placeholder: "Specific quotes, evidence, numbers",
            }),
          );
        }),
      ),
    ),
    React.createElement(
      Section,
      {
        title: "Red flag detection",
        subtitle: "Tick any that apply during the conversation",
        defaultOpen: !0,
      },
      React.createElement(
        "div",
        { className: "space-y-1.5" },
        RED_FLAGS.map(([a, n, r]) =>
          React.createElement(
            "div",
            {
              key: a,
              className:
                "flex items-center justify-between gap-3 py-2 border-b border-stone-200/70 last:border-b-0",
            },
            React.createElement(Checkbox, {
              label: n,
              checked: e.redFlags?.[a],
              onChange: (e) => t(["redFlags", a], e),
            }),
            React.createElement(
              "span",
              {
                className:
                  "text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm flex-shrink-0 " +
                  ("high" === r ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"),
              },
              r,
            ),
          ),
        ),
      ),
      Object.values(e.redFlags || {}).filter(Boolean).length > 0 &&
        React.createElement(
          "div",
          { className: "mt-3 px-4 py-3 border border-rose-300 bg-rose-50 rounded-sm text-sm text-rose-900" },
          React.createElement(AlertTriangle, { className: "inline w-4 h-4 mr-1" }),
          Object.values(e.redFlags || {}).filter(Boolean).length,
          " red flag(s) checked. Any high-severity flag = decline regardless of score.",
        ),
    ),
  );
}
function ClosingCard({ data: e, upd: t }) {
  return React.createElement(
    Section,
    { title: "Closing the interview", subtitle: "Universal · 5-10 minutes · Two-way evaluation" },
    React.createElement(
      Grid,
      { cols: 1 },
      React.createElement(TextArea, {
        label: "Candidate's questions for you",
        value: e.candidateQuestions,
        onChange: (e) => t(["candidateQuestions"], e),
        rows: 3,
        placeholder: "What did they ask? Note thoughtful vs surface questions.",
      }),
      React.createElement(TextArea, {
        label: "Candidate's concerns surfaced",
        value: e.candidateConcerns,
        onChange: (e) => t(["candidateConcerns"], e),
        rows: 2,
      }),
      React.createElement(Checkbox, {
        label: "Realistic expectations set (commission income, rejection, runway)",
        checked: e.expectationsSet,
        onChange: (e) => t(["expectationsSet"], e),
      }),
    ),
    React.createElement(
      "div",
      { className: "mt-3 px-4 py-3 border border-stone-300 bg-stone-50 rounded-sm" },
      React.createElement(
        "div",
        { className: "text-[11px] uppercase tracking-wider text-stone-600 mb-1" },
        "No-commitment script",
      ),
      React.createElement(
        "div",
        { className: "text-xs text-stone-700 italic leading-relaxed" },
        "\"Thank you for your time today. I take this decision seriously and want to consider what we discussed. I'll be in touch within 3-5 business days with the next step or with feedback. Either way, you'll hear from me.\"",
      ),
    ),
  );
}
function OutcomeCard({ fi: e, score: t, candidate: a, upd: n }) {
  const r = useMemo(
      () =>
        (() => {
          const n = "experienced" === e.experienceBranch ? "Experienced" : "Inexperienced",
            r = "experienced" === e.experienceBranch ? EXP_DIMS : INE_DIMS,
            s = "experienced" === e.experienceBranch ? e.experienced : e.inexperienced,
            o = r
              .filter(([e]) => Number(s[e]?.score) >= 4)
              .slice(0, 3)
              .map(([e, t]) => `• ${t} (${s[e].score}/5)${s[e].notes ? ": " + s[e].notes : ""}`),
            c = r
              .filter(([e]) => Number(s[e]?.score) > 0 && Number(s[e]?.score) <= 2)
              .slice(0, 3)
              .map(([e, t]) => `• ${t} (${s[e].score}/5)${s[e].notes ? ": " + s[e].notes : ""}`),
            i =
              "experienced" === e.experienceBranch
                ? RED_FLAGS.filter(([t]) => e.experienced.redFlags?.[t]).map(([e, t]) => `• ${t}`)
                : [];
          return `Subject: New recruit profile — ${a.meta.name || "Candidate"} — ${n} — Score ${t.total}/100\n\nCandidate: ${a.meta.name || ""}\nSource: ${e.sourceBackground.referralPath}${e.sourceBackground.referralSource ? " (" + e.sourceBackground.referralSource + ")" : ""}\nTrack: ${n}\nInterviewer: ${e.interviewer || ""} · ${e.date || ""}\n\nSCORES\nPersonal Observation: ${t.po}/20\nStructured: ${t.structured}/80\nCombined total: ${t.total}/100\nRecommendation: ${t.recommendation}\n\nWHY NOW (their words)\n${e.sourceBackground.whyNow || "—"}\n\nTOP STRENGTHS (from interview)\n${o.length ? o.join("\n") : "—"}\n\nCONCERNS TO PROBE (in POP review and references)\n${c.length ? c.join("\n") : "—"}\n${i.length ? "\nRED FLAGS:\n" + i.join("\n") : ""}\n\nNEXT STEP\n${"proceed" === e.outcome ? "Administer POP 7.0 within 24 hours." : "proceed_conditions" === e.outcome ? "Administer POP 7.0; conditions noted above." : "hold" === e.outcome ? "Schedule second meeting within 2 weeks." : "decline" === e.outcome ? "Send respectful decline." : "Pending outcome decision."}\n\nCLOSING NOTES\n${e.outcomeNotes || ""}\n`;
        })(),
      [e, t, a],
    ),
    [s, o] = useState(!1);
  return React.createElement(
    Section,
    { title: "Outcome and BM email profile", subtitle: "Final decision and notification", defaultOpen: !0 },
    React.createElement(
      Grid,
      { cols: 2 },
      React.createElement(Select, {
        label: "Outcome",
        value: e.outcome,
        onChange: (e) => n(["outcome"], e),
        options: [
          ["proceed", "Proceed — administer POP 7.0"],
          ["proceed_conditions", "Proceed with conditions"],
          ["hold", "Hold — second meeting"],
          ["decline", "Decline"],
        ],
      }),
      React.createElement(TextInput, {
        label: "Next step date",
        type: "date",
        value: e.nextStepDate,
        onChange: (e) => n(["nextStepDate"], e),
      }),
    ),
    React.createElement(
      "div",
      { className: "mt-4" },
      React.createElement(TextArea, {
        label: "Outcome notes",
        value: e.outcomeNotes,
        onChange: (e) => n(["outcomeNotes"], e),
        rows: 3,
        placeholder: "Final reasoning. What POP review and references should specifically probe.",
      }),
    ),
    React.createElement(
      "div",
      { className: "mt-5 grid gap-4 md:grid-cols-3 items-center" },
      React.createElement(
        "div",
        { className: "md:col-span-1 flex justify-center" },
        React.createElement(ScoreGauge, {
          value: t.total,
          max: 100,
          size: 160,
          label: "Combined score",
          recommendation: t.recommendation,
        }),
      ),
      React.createElement(
        "div",
        { className: "md:col-span-2 grid gap-3 grid-cols-2" },
        React.createElement(ReadoutBox, {
          label: "Personal Observation",
          value: `${t.po}/20`,
          accent: "navy",
        }),
        React.createElement(ReadoutBox, { label: "Structured", value: `${t.structured}/80`, accent: "navy" }),
        React.createElement(
          "div",
          { className: "col-span-2 px-4 py-3 border border-stone-300 rounded-sm bg-white" },
          React.createElement(
            "div",
            { className: "text-[11px] uppercase tracking-[0.14em] text-stone-500 mb-2" },
            "Score breakdown",
          ),
          React.createElement(
            "div",
            { className: "space-y-1.5" },
            React.createElement(
              "div",
              null,
              React.createElement(LinearBar, {
                value: t.po,
                max: 20,
                height: 5,
                tone: "navy",
                showLabel: "PO",
              }),
            ),
            React.createElement(
              "div",
              null,
              React.createElement(LinearBar, {
                value: t.structured,
                max: 80,
                height: 5,
                tone: "navy",
                showLabel: "Structured",
              }),
            ),
            React.createElement(
              "div",
              { className: "pt-1 border-t border-stone-200" },
              React.createElement(LinearBar, {
                value: t.total,
                max: 100,
                height: 6,
                tone: t.total >= 80 ? "emerald" : t.total >= 65 ? "amber" : t.total > 0 ? "rose" : "stone",
                showLabel: "Total",
              }),
            ),
          ),
        ),
      ),
    ),
    e.outcome &&
      React.createElement(
        React.Fragment,
        null,
        React.createElement(Divider, { label: "RM → BM handoff" }),
        React.createElement(
          "div",
          { className: "border-2 border-amber-300 rounded-sm bg-amber-50/50 p-4 space-y-3" },
          React.createElement(
            "div",
            { className: "flex items-center justify-between flex-wrap gap-2" },
            React.createElement(
              "div",
              null,
              React.createElement(
                "div",
                { className: "text-[11px] uppercase tracking-[0.14em] text-amber-900 font-semibold" },
                "RM comments for BM review",
              ),
              React.createElement(
                "div",
                { className: "text-xs text-stone-600 mt-0.5" },
                "Plain-language notes the BM will read before POP Review or BM Approval. Keep candid.",
              ),
            ),
            e.rmSubmittedAt &&
              React.createElement(
                "span",
                { className: "text-[10px] font-mono px-2 py-1 bg-emerald-100 text-emerald-800 rounded-sm" },
                "Submitted ",
                new Date(e.rmSubmittedAt).toLocaleDateString(),
                " ",
                new Date(e.rmSubmittedAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
              ),
          ),
          React.createElement(TextArea, {
            label: "What the BM should know (gut, references, concerns, hidden context)",
            value: e.rmComments || "",
            onChange: (e) => n(["rmComments"], e),
            rows: 4,
            placeholder:
              "e.g. 'Strong on paper but Network Strength score didn't match the conversation — most named contacts are family. Recommend BM probe specifically on independent professional network during POP Review.'",
          }),
          React.createElement(
            Grid,
            { cols: 2 },
            React.createElement(Select, {
              label: "RM recommendation to BM",
              value: e.rmRecommendation || "",
              onChange: (e) => n(["rmRecommendation"], e),
              options: [
                ["recommend_proceed", "Recommend proceed"],
                ["recommend_conditions", "Proceed with specific conditions"],
                ["needs_bm_input", "Need BM judgment call"],
                ["recommend_decline", "Recommend decline"],
              ],
            }),
            React.createElement(
              "div",
              { className: "flex items-end" },
              React.createElement(
                "button",
                {
                  onClick: () => n(["rmSubmittedAt"], new Date().toISOString()),
                  disabled: !e.rmComments || !e.rmRecommendation,
                  className:
                    "w-full text-sm px-3 py-2 bg-stone-900 text-stone-50 rounded-sm hover:bg-stone-700 transition-colors disabled:bg-stone-300 disabled:cursor-not-allowed",
                },
                e.rmSubmittedAt ? "Re-submit to BM" : "Submit to BM for review",
              ),
            ),
          ),
        ),
        e.rmSubmittedAt &&
          React.createElement(
            "div",
            { className: "mt-4 border-2 border-stone-900 rounded-sm bg-white overflow-hidden" },
            React.createElement(
              "div",
              {
                className: "px-4 py-3 border-b border-stone-200",
                style: { backgroundColor: "#07131f", color: "white" },
              },
              React.createElement(
                "div",
                { className: "flex items-center justify-between flex-wrap gap-2" },
                React.createElement(
                  "div",
                  null,
                  React.createElement(
                    "div",
                    { className: "text-[11px] uppercase tracking-[0.14em] font-semibold" },
                    "BM review",
                  ),
                  React.createElement(
                    "div",
                    { className: "text-xs text-stone-300 mt-0.5" },
                    "For Branch Manager only. Reviews RM comments, scores, and adds decision.",
                  ),
                ),
                e.bmReview?.bmReviewedAt &&
                  React.createElement(
                    "span",
                    {
                      className: "text-[10px] font-mono px-2 py-1 bg-emerald-100 text-emerald-800 rounded-sm",
                    },
                    "BM reviewed ",
                    new Date(e.bmReview.bmReviewedAt).toLocaleDateString(),
                  ),
              ),
            ),
            React.createElement(
              "div",
              { className: "p-4 space-y-3" },
              React.createElement(
                "div",
                { className: "px-3 py-2 bg-stone-50 border-l-2 border-amber-400 rounded-sm" },
                React.createElement(
                  "div",
                  { className: "text-[10px] uppercase tracking-wider text-stone-500 mb-1" },
                  "RM said",
                ),
                React.createElement(
                  "div",
                  { className: "text-xs text-stone-800 italic whitespace-pre-wrap" },
                  e.rmComments,
                ),
                React.createElement(
                  "div",
                  { className: "text-[10px] text-stone-500 mt-2" },
                  "RM recommendation: ",
                  React.createElement(
                    "span",
                    { className: "font-semibold text-stone-800" },
                    e.rmRecommendation?.replace(/_/g, " ") || "—",
                  ),
                ),
              ),
              React.createElement(TextArea, {
                label: "BM comments (Ricky)",
                value: e.bmReview?.bmComments || "",
                onChange: (e) => n(["bmReview", "bmComments"], e),
                rows: 3,
                placeholder:
                  "What you saw / what you want POP Review to specifically test / any override reasoning.",
              }),
              React.createElement(
                Grid,
                { cols: 2 },
                React.createElement(Select, {
                  label: "BM decision",
                  value: e.bmReview?.bmDecision || "",
                  onChange: (e) => n(["bmReview", "bmDecision"], e),
                  options: [
                    ["concur_proceed", "Concur with RM — proceed"],
                    ["concur_decline", "Concur with RM — decline"],
                    ["override_proceed", "Override RM — proceed (paper trail required)"],
                    ["override_decline", "Override RM — decline (paper trail required)"],
                    ["request_more_info", "Request more info from RM"],
                  ],
                }),
                React.createElement(
                  "div",
                  { className: "flex items-end" },
                  React.createElement(
                    "button",
                    {
                      onClick: () => {
                        (n(["bmReview", "reviewed"], !0),
                          n(["bmReview", "bmReviewedAt"], new Date().toISOString()),
                          n(["bmReview", "bmReviewer"], "Ricky Rampersad"));
                      },
                      disabled: !e.bmReview?.bmDecision,
                      className:
                        "w-full text-sm px-3 py-2 bg-stone-900 text-stone-50 rounded-sm hover:bg-stone-700 transition-colors disabled:bg-stone-300 disabled:cursor-not-allowed",
                    },
                    e.bmReview?.bmReviewedAt ? "Update BM review" : "Lock BM review",
                  ),
                ),
              ),
            ),
          ),
        React.createElement(Divider, { label: "BM email profile (auto-generated)" }),
        React.createElement(
          "div",
          { className: "border-2 border-stone-900 rounded-sm bg-white overflow-hidden shadow-sm" },
          React.createElement(
            "div",
            {
              className: "px-5 py-3 flex items-center justify-between",
              style: { background: "linear-gradient(90deg, #07131f 0%, #2c4d7a 100%)", color: "white" },
            },
            React.createElement(
              "div",
              { className: "flex items-center gap-2" },
              React.createElement(Mail, { className: "w-4 h-4" }),
              React.createElement(
                "span",
                { className: "text-[11px] uppercase tracking-[0.18em] font-semibold" },
                "First Interview Profile · BM Brief",
              ),
            ),
            React.createElement(
              "button",
              {
                onClick: async () => {
                  try {
                    (await navigator.clipboard.writeText(r), o(!0), setTimeout(() => o(!1), 2e3));
                  } catch {}
                },
                className:
                  "inline-flex items-center gap-1.5 text-xs px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-sm transition-colors",
              },
              React.createElement(Copy, { className: "w-3 h-3" }),
              " ",
              s ? "Copied" : "Copy as text",
            ),
          ),
          React.createElement(
            "div",
            { className: "p-5 space-y-4", style: { fontFamily: "Newsreader, Georgia, serif" } },
            React.createElement(
              "div",
              {
                className:
                  "flex items-baseline justify-between flex-wrap gap-2 pb-3 border-b-2 border-stone-900",
              },
              React.createElement(
                "div",
                null,
                React.createElement(
                  "div",
                  {
                    className: "text-[10px] uppercase tracking-[0.18em] text-stone-500 font-semibold mb-0.5",
                  },
                  "Candidate",
                ),
                React.createElement(
                  "h4",
                  { className: "font-serif text-2xl text-stone-900 leading-tight" },
                  a.meta.name || "[name]",
                ),
                a.meta.phone &&
                  React.createElement(
                    "div",
                    { className: "text-xs text-stone-500 font-mono mt-0.5" },
                    a.meta.phone,
                  ),
              ),
              React.createElement(
                "div",
                { className: "text-right" },
                React.createElement(
                  "div",
                  { className: "text-[10px] uppercase tracking-wider text-stone-500" },
                  "FI Total",
                ),
                React.createElement(
                  "div",
                  {
                    className: "font-serif text-3xl font-bold leading-none",
                    style: { color: t.total >= 80 ? "#059669" : t.total >= 65 ? "#d97706" : "#dc2626" },
                  },
                  t.total,
                  React.createElement("span", { className: "text-stone-300 text-xl" }, "/100"),
                ),
              ),
            ),
            React.createElement(
              "div",
              { className: "flex items-center gap-3" },
              React.createElement(
                "div",
                { className: "text-[10px] uppercase tracking-wider text-stone-500 font-semibold" },
                "Outcome",
              ),
              React.createElement(
                "div",
                {
                  className: "px-3 py-1.5 rounded-sm font-serif text-base font-bold",
                  style: {
                    backgroundColor:
                      "proceed" === e.outcome ? "#d1fae5" : "decline" === e.outcome ? "#fee2e2" : "#fef3c7",
                    color:
                      "proceed" === e.outcome ? "#065f46" : "decline" === e.outcome ? "#991b1b" : "#92400e",
                  },
                },
                "proceed" === e.outcome
                  ? "→ Proceed to POP 7.0"
                  : "proceed_conditions" === e.outcome
                    ? "→ Proceed with conditions"
                    : "hold" === e.outcome
                      ? "⏸ Hold for second meeting"
                      : "decline" === e.outcome
                        ? "× Decline"
                        : e.outcome,
              ),
            ),
            React.createElement(
              "div",
              { className: "grid gap-3 md:grid-cols-3" },
              React.createElement(
                "div",
                { className: "px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-sm" },
                React.createElement(
                  "div",
                  { className: "text-[10px] uppercase tracking-wider text-stone-500 mb-1" },
                  "Personal Observation",
                ),
                React.createElement(
                  "div",
                  { className: "font-serif text-xl font-bold text-stone-900" },
                  t.po,
                  React.createElement("span", { className: "text-stone-400 text-sm" }, "/20"),
                ),
                React.createElement(
                  "div",
                  { className: "mt-1.5 h-1 bg-stone-200 rounded-full overflow-hidden" },
                  React.createElement("div", {
                    className: "h-full bg-stone-700",
                    style: { width: (t.po / 20) * 100 + "%" },
                  }),
                ),
              ),
              React.createElement(
                "div",
                { className: "px-3 py-2.5 bg-stone-50 border border-stone-200 rounded-sm" },
                React.createElement(
                  "div",
                  { className: "text-[10px] uppercase tracking-wider text-stone-500 mb-1" },
                  "Structured Areas",
                ),
                React.createElement(
                  "div",
                  { className: "font-serif text-xl font-bold text-stone-900" },
                  t.structured,
                  React.createElement("span", { className: "text-stone-400 text-sm" }, "/80"),
                ),
                React.createElement(
                  "div",
                  { className: "mt-1.5 h-1 bg-stone-200 rounded-full overflow-hidden" },
                  React.createElement("div", {
                    className: "h-full bg-stone-700",
                    style: { width: (t.structured / 80) * 100 + "%" },
                  }),
                ),
              ),
              React.createElement(
                "div",
                {
                  className: "px-3 py-2.5 rounded-sm border-2",
                  style: {
                    backgroundColor: t.total >= 80 ? "#ecfdf5" : t.total >= 65 ? "#fffbeb" : "#fef2f2",
                    borderColor: t.total >= 80 ? "#10b981" : t.total >= 65 ? "#f59e0b" : "#ef4444",
                  },
                },
                React.createElement(
                  "div",
                  {
                    className: "text-[10px] uppercase tracking-wider font-semibold mb-1",
                    style: { color: t.total >= 80 ? "#065f46" : t.total >= 65 ? "#92400e" : "#991b1b" },
                  },
                  "Recommendation",
                ),
                React.createElement(
                  "div",
                  {
                    className: "text-sm font-bold leading-tight",
                    style: { color: t.total >= 80 ? "#065f46" : t.total >= 65 ? "#92400e" : "#991b1b" },
                  },
                  t.recommendation,
                ),
              ),
            ),
            e.outcomeNotes &&
              React.createElement(
                "div",
                { className: "border-l-4 border-stone-900 pl-4 py-2 bg-stone-50/50" },
                React.createElement(
                  "div",
                  { className: "text-[10px] uppercase tracking-wider text-stone-500 font-semibold mb-1" },
                  "RM Notes",
                ),
                React.createElement(
                  "p",
                  { className: "text-sm text-stone-800 leading-relaxed italic" },
                  '"',
                  e.outcomeNotes,
                  '"',
                ),
              ),
            (e.sourceBackground?.referralPath || e.sourceBackground?.whyNow) &&
              React.createElement(
                "div",
                { className: "grid gap-3 md:grid-cols-2 text-sm" },
                e.sourceBackground.referralPath &&
                  React.createElement(
                    "div",
                    null,
                    React.createElement(
                      "div",
                      { className: "text-[10px] uppercase tracking-wider text-stone-500 font-semibold mb-1" },
                      "Source",
                    ),
                    React.createElement(
                      "div",
                      { className: "text-stone-800" },
                      React.createElement("strong", null, e.sourceBackground.referralPath),
                      e.sourceBackground.referralSource ? ` — ${e.sourceBackground.referralSource}` : "",
                    ),
                  ),
                e.sourceBackground.whyNow &&
                  React.createElement(
                    "div",
                    null,
                    React.createElement(
                      "div",
                      { className: "text-[10px] uppercase tracking-wider text-stone-500 font-semibold mb-1" },
                      "Why now",
                    ),
                    React.createElement("div", { className: "text-stone-800" }, e.sourceBackground.whyNow),
                  ),
              ),
            e.nextStepDate &&
              React.createElement(
                "div",
                { className: "flex items-center gap-2 pt-3 border-t border-stone-200 text-xs" },
                React.createElement(Calendar, { className: "w-3.5 h-3.5 text-stone-500" }),
                React.createElement("span", { className: "text-stone-500" }, "Next step:"),
                React.createElement(
                  "span",
                  { className: "font-mono font-bold text-stone-900" },
                  e.nextStepDate,
                ),
              ),
            React.createElement(
              "details",
              { className: "text-xs" },
              React.createElement(
                "summary",
                { className: "cursor-pointer text-stone-500 hover:text-stone-700 select-none" },
                "View as plain text email",
              ),
              React.createElement(
                "pre",
                {
                  className:
                    "mt-2 p-3 bg-stone-50 border border-stone-200 rounded-sm font-mono text-stone-700 whitespace-pre-wrap leading-relaxed max-h-64 overflow-auto",
                },
                r,
              ),
            ),
          ),
        ),
      ),
  );
}
function fiTier(e, t) {
  if (!e.experienceBranch || !t.total) return null;
  const a = "experienced" === e.experienceBranch,
    n = a ? 85 : 80,
    r = a ? 55 : 50;
  return t.total >= n ? "strong" : t.total >= r ? "marginal" : "weak";
}
function BmApprovalStage({ candidate: e, persist: t, currentRole: a }) {
  const n = e.stages.bmApproval,
    r = e.stages.firstInterview,
    s = (e, a) => t((t) => setPath(t, ["stages", "bmApproval", ...e], a)),
    o = useMemo(() => scoreFirstInterview(r), [r]),
    c = fiTier(r, o),
    i = ("marginal" === c || "weak" === c) && "BM" !== a;
  return r.experienceBranch
    ? i
      ? React.createElement(
          "div",
          { className: "bg-amber-50 border border-amber-300 rounded-sm p-6 text-center" },
          React.createElement(ShieldCheck, { className: "w-10 h-10 text-amber-700 mx-auto mb-3" }),
          React.createElement(
            "h3",
            { className: "font-serif text-lg text-amber-900 mb-1" },
            "Branch Manager only",
          ),
          React.createElement(
            "p",
            { className: "text-sm text-amber-800 max-w-md mx-auto mb-3" },
            "This candidate's First Interview score is in the marginal/weak band (",
            o.total,
            "/100), which triggers Branch Manager review before POP 7.0 can be administered. Switch to the BM role using the chip in the header.",
          ),
          React.createElement(
            "p",
            { className: "text-xs text-amber-700/80 max-w-md mx-auto italic" },
            "Strong-FI candidates (≥80 inexperienced / ≥85 experienced) bypass this gate — the RM administers POP directly. The BM gate is reserved for the marginal cases where historical failures have occurred.",
          ),
        )
      : React.createElement(
          "div",
          { className: "space-y-3" },
          React.createElement(TierBanner, { tier: c, fiScore: o, fi: r }),
          React.createElement(
            Section,
            {
              title: "Recruiting Manager's briefing",
              subtitle: "The First Interview profile",
              defaultOpen: "strong" !== c,
            },
            React.createElement(BriefingFromRm, { fi: r, score: o, candidate: e }),
          ),
          "strong" === c &&
            React.createElement(
              Section,
              {
                title: "POP 7.0 administration",
                subtitle: "Strong FI score — RM administers directly. BM acknowledges asynchronously.",
                defaultOpen: !0,
              },
              React.createElement(Pop7AdminFields, { s: n, upd: s }),
              React.createElement(Divider, { label: "BM acknowledgement (light sign-off)" }),
              React.createElement(
                "div",
                { className: "px-4 py-3 bg-emerald-50 border border-emerald-200 rounded-sm mb-3" },
                React.createElement(
                  "div",
                  { className: "text-xs text-emerald-900 leading-relaxed" },
                  "FI score of ",
                  React.createElement("strong", null, o.total, "/100"),
                  " meets the strong-proceed threshold. The BM is notified but not required to gate this candidate. POP can be administered immediately.",
                ),
              ),
              "BM" === a
                ? React.createElement(
                    "div",
                    { className: "space-y-3" },
                    React.createElement(Checkbox, {
                      label: "BM acknowledges the strong FI and POP administration",
                      checked: n.bmAcknowledged,
                      onChange: (e) => {
                        (s(["bmAcknowledged"], e),
                          e &&
                            !n.bmAcknowledgedDate &&
                            s(["bmAcknowledgedDate"], new Date().toISOString().slice(0, 10)),
                          s(["bmDecision"], "approve_pop"));
                      },
                    }),
                    n.bmAcknowledged &&
                      React.createElement(
                        "div",
                        { className: "text-xs text-stone-500 italic" },
                        "Acknowledged by BM on ",
                        n.bmAcknowledgedDate,
                      ),
                  )
                : React.createElement(
                    "div",
                    {
                      className:
                        "px-4 py-3 bg-stone-50 border border-stone-200 rounded-sm text-xs text-stone-600 italic",
                    },
                    n.bmAcknowledged
                      ? `BM acknowledged on ${n.bmAcknowledgedDate}.`
                      : "BM acknowledgement pending. Not blocking — RM may administer POP.",
                  ),
            ),
          "marginal" === c &&
            React.createElement(
              React.Fragment,
              null,
              React.createElement(
                Section,
                {
                  title: "BM follow-up — your own scoring",
                  subtitle: "Marginal FI — pressure-test the candidate before investing in POP",
                  defaultOpen: !0,
                },
                React.createElement(
                  "div",
                  {
                    className:
                      "text-xs text-stone-700 italic mb-4 px-3 py-2 bg-amber-50 border border-amber-200 rounded-sm",
                  },
                  React.createElement(AlertTriangle, { className: "inline w-3.5 h-3.5 mr-1 text-amber-700" }),
                  "FI score of ",
                  React.createElement("strong", null, o.total, "/100"),
                  " is in the marginal band. This is where three past hires were pushed through despite structural concerns. Your dimensional scoring is the circuit breaker.",
                ),
                React.createElement(BmFollowUpScoring, { s: n, fi: r, upd: s }),
              ),
              React.createElement(
                Section,
                { title: "Meeting log" },
                React.createElement(
                  Grid,
                  { cols: 2 },
                  React.createElement(TextInput, {
                    label: "Meeting date",
                    type: "date",
                    value: n.meetingDate,
                    onChange: (e) => s(["meetingDate"], e),
                  }),
                  React.createElement(TextInput, {
                    label: "Present",
                    value: n.present,
                    onChange: (e) => s(["present"], e),
                    placeholder: "BM, RM, candidate",
                  }),
                ),
                React.createElement(
                  "div",
                  { className: "mt-4 space-y-3" },
                  React.createElement(TextArea, {
                    label: "BM observations",
                    value: n.bmObservations,
                    onChange: (e) => s(["bmObservations"], e),
                    rows: 4,
                    placeholder:
                      "What stood out that the RM didn't capture? Where did you agree / disagree with the RM read?",
                  }),
                  React.createElement(TextArea, {
                    label: "Concerns to test in POP and references",
                    value: n.bmConcerns,
                    onChange: (e) => s(["bmConcerns"], e),
                    rows: 3,
                  }),
                  React.createElement(TextArea, {
                    label: "Red flags raised by RM — confirmed / dismissed",
                    value: n.bmRedFlagsConfirmed,
                    onChange: (e) => s(["bmRedFlagsConfirmed"], e),
                    rows: 2,
                  }),
                ),
              ),
              React.createElement(
                Section,
                { title: "BM decision — gate before POP 7", defaultOpen: !0 },
                React.createElement(
                  Grid,
                  { cols: 2 },
                  React.createElement(Select, {
                    label: "Decision",
                    value: n.bmDecision,
                    onChange: (e) => s(["bmDecision"], e),
                    options: [
                      ["approve_pop", "Approve — administer POP 7.0"],
                      ["second_meeting", "Hold — second meeting required"],
                      ["decline", "Decline — do not proceed"],
                    ],
                  }),
                  React.createElement(TextInput, {
                    label: "Decision date",
                    type: "date",
                    value: n.bmDecisionDate,
                    onChange: (e) => s(["bmDecisionDate"], e),
                  }),
                ),
                React.createElement(
                  "div",
                  { className: "mt-4" },
                  React.createElement(TextArea, {
                    label: "Decision rationale (visible to RM)",
                    value: n.bmDecisionRationale,
                    onChange: (e) => s(["bmDecisionRationale"], e),
                    rows: 4,
                    placeholder: "Why this decision. The RM will see this when they review the POP results.",
                  }),
                ),
                "approve_pop" === n.bmDecision &&
                  React.createElement(
                    "div",
                    {
                      className:
                        "mt-4 px-4 py-3 border border-emerald-300 bg-emerald-50 rounded-sm text-sm text-emerald-900",
                    },
                    React.createElement(CheckCircle2, { className: "inline w-4 h-4 mr-1" }),
                    "Approved. Administer POP 7.0 below, then RM picks up at Stage 3.",
                  ),
              ),
              "approve_pop" === n.bmDecision &&
                React.createElement(
                  Section,
                  {
                    title: "POP 7.0 administration",
                    subtitle: "Send the link, supervise the test, log completion",
                    defaultOpen: !0,
                  },
                  React.createElement(Pop7AdminFields, { s: n, upd: s }),
                ),
            ),
          "weak" === c &&
            React.createElement(
              Section,
              { title: "Decline expected — BM override required to proceed", defaultOpen: !0 },
              React.createElement(
                "div",
                { className: "px-4 py-4 border border-rose-300 bg-rose-50 rounded-sm mb-4" },
                React.createElement(
                  "div",
                  { className: "flex items-start gap-3" },
                  React.createElement(AlertTriangle, {
                    className: "w-5 h-5 text-rose-700 flex-shrink-0 mt-0.5",
                  }),
                  React.createElement(
                    "div",
                    null,
                    React.createElement(
                      "div",
                      { className: "font-serif text-base text-rose-900 mb-1" },
                      "FI score below proceed threshold",
                    ),
                    React.createElement(
                      "div",
                      { className: "text-sm text-rose-800 leading-relaxed" },
                      "This candidate's FI score is ",
                      React.createElement("strong", null, o.total, "/100"),
                      ", which is below the framework's decline threshold (",
                      "experienced" === r.experienceBranch ? 55 : 50,
                      "). Recommendation: ",
                      React.createElement("strong", null, "decline"),
                      ". Do not invest POP testing time on a candidate the FI process already filtered out.",
                    ),
                    React.createElement(
                      "div",
                      { className: "text-xs text-rose-700/80 mt-2 italic" },
                      "Pushing weak FIs through is the historical pattern this Tracker is built to stop. If you choose to override, the system will record who, when, and why.",
                    ),
                  ),
                ),
              ),
              React.createElement(
                Grid,
                { cols: 2 },
                React.createElement(Select, {
                  label: "Decision",
                  value: n.bmDecision,
                  onChange: (e) => s(["bmDecision"], e),
                  options: [
                    ["decline", "Decline (recommended)"],
                    ["second_meeting", "Hold — second FI meeting required"],
                    ["override_proceed", "Override — proceed to POP despite weak FI"],
                  ],
                }),
                React.createElement(TextInput, {
                  label: "Decision date",
                  type: "date",
                  value: n.bmDecisionDate,
                  onChange: (e) => s(["bmDecisionDate"], e),
                }),
              ),
              "override_proceed" === n.bmDecision &&
                React.createElement(
                  "div",
                  { className: "mt-4 px-4 py-3 border border-amber-400 bg-amber-50 rounded-sm" },
                  React.createElement(
                    "div",
                    { className: "text-xs uppercase tracking-wider font-semibold text-amber-900 mb-1" },
                    "Override paper trail",
                  ),
                  React.createElement(
                    "div",
                    { className: "text-xs text-amber-800 mb-3" },
                    "Required: name and signed reason. This is logged and visible in the candidate's record permanently.",
                  ),
                  React.createElement(
                    Grid,
                    { cols: 1 },
                    React.createElement(Select, {
                      label: "Overriding manager",
                      value: n.overrideBy,
                      onChange: (e) => s(["overrideBy"], e),
                      options: ALL_MANAGER_NAMES,
                    }),
                    React.createElement(TextArea, {
                      label: "Reason for override",
                      value: n.overrideReason,
                      onChange: (e) => s(["overrideReason"], e),
                      rows: 4,
                      placeholder:
                        "What specific evidence justifies overriding the FI score? What conditions or coaching plan accompanies this?",
                    }),
                  ),
                ),
              React.createElement(
                "div",
                { className: "mt-4" },
                React.createElement(TextArea, {
                  label: "Decision rationale",
                  value: n.bmDecisionRationale,
                  onChange: (e) => s(["bmDecisionRationale"], e),
                  rows: 3,
                }),
              ),
              "override_proceed" === n.bmDecision &&
                n.overrideReason &&
                React.createElement(
                  "div",
                  { className: "mt-4" },
                  React.createElement(
                    Section,
                    { title: "POP 7.0 administration (under override)", defaultOpen: !0 },
                    React.createElement(Pop7AdminFields, { s: n, upd: s }),
                  ),
                ),
            ),
        )
    : React.createElement(
        "div",
        { className: "bg-stone-50 border border-stone-300 rounded-sm p-6 text-center" },
        React.createElement(MessageSquare, { className: "w-10 h-10 text-stone-400 mx-auto mb-3" }),
        React.createElement(
          "h3",
          { className: "font-serif text-lg text-stone-900 mb-1" },
          "First interview required",
        ),
        React.createElement(
          "p",
          { className: "text-sm text-stone-600 max-w-md mx-auto" },
          "Complete Stage 1 — First Interview — before this stage can proceed. The FI score determines whether this stage is a fast pass-through (strong) or requires BM dimensional gating (marginal/weak).",
        ),
      );
}
function TierBanner({ tier: e, fiScore: t, fi: a }) {
  if (!e) return null;
  const n = "experienced" === a.experienceBranch ? "Experienced" : "Inexperienced";
  return "strong" === e
    ? React.createElement(
        "div",
        { className: "bg-emerald-50 border border-emerald-300 rounded-sm px-4 py-3" },
        React.createElement(
          "div",
          { className: "flex items-start gap-3" },
          React.createElement(CheckCircle2, { className: "w-5 h-5 text-emerald-700 flex-shrink-0 mt-0.5" }),
          React.createElement(
            "div",
            { className: "flex-1" },
            React.createElement(
              "div",
              { className: "text-[11px] uppercase tracking-[0.14em] text-emerald-700 font-semibold mb-1" },
              "Strong FI · fast track",
            ),
            React.createElement(
              "div",
              { className: "text-sm text-emerald-900 leading-relaxed" },
              "FI score ",
              React.createElement("strong", null, t.total, "/100"),
              " (",
              n,
              " track) clears the strong-proceed threshold. RM administers POP directly. No BM dimensional gate required — BM acknowledges asynchronously.",
            ),
          ),
        ),
      )
    : "marginal" === e
      ? React.createElement(
          "div",
          { className: "bg-amber-50 border border-amber-300 rounded-sm px-4 py-3" },
          React.createElement(
            "div",
            { className: "flex items-start gap-3" },
            React.createElement(AlertTriangle, { className: "w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" }),
            React.createElement(
              "div",
              { className: "flex-1" },
              React.createElement(
                "div",
                { className: "text-[11px] uppercase tracking-[0.14em] text-amber-800 font-semibold mb-1" },
                "Marginal FI · BM gate triggered",
              ),
              React.createElement(
                "div",
                { className: "text-sm text-amber-900 leading-relaxed" },
                "FI score ",
                React.createElement("strong", null, t.total, "/100"),
                " (",
                n,
                " track) is in the marginal band. BM dimensional scoring is required before POP. This is the historical failure-pattern band — the gate exists to catch it.",
              ),
            ),
          ),
        )
      : React.createElement(
          "div",
          { className: "bg-rose-50 border border-rose-300 rounded-sm px-4 py-3" },
          React.createElement(
            "div",
            { className: "flex items-start gap-3" },
            React.createElement(X, { className: "w-5 h-5 text-rose-700 flex-shrink-0 mt-0.5" }),
            React.createElement(
              "div",
              { className: "flex-1" },
              React.createElement(
                "div",
                { className: "text-[11px] uppercase tracking-[0.14em] text-rose-800 font-semibold mb-1" },
                "Weak FI · decline expected",
              ),
              React.createElement(
                "div",
                { className: "text-sm text-rose-900 leading-relaxed" },
                "FI score ",
                React.createElement("strong", null, t.total, "/100"),
                " (",
                n,
                " track) is below the proceed threshold. Decline recommended. Override requires BM signature with a documented reason.",
              ),
            ),
          ),
        );
}
function Pop7AdminFields({ s: e, upd: t }) {
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(
      Grid,
      { cols: 2 },
      React.createElement(TextInput, {
        label: "Date sent",
        type: "date",
        value: e.pop7SentDate,
        onChange: (e) => t(["pop7SentDate"], e),
      }),
      React.createElement(TextInput, {
        label: "Date completed",
        type: "date",
        value: e.pop7CompletedDate,
        onChange: (e) => t(["pop7CompletedDate"], e),
      }),
      React.createElement(TextInput, {
        label: "Report code",
        value: e.pop7ReportCode,
        onChange: (e) => t(["pop7ReportCode"], e),
        placeholder: "#CYSI…",
      }),
      React.createElement(TextInput, {
        label: "Candidate link / reference",
        value: e.pop7CandidateLink,
        onChange: (e) => t(["pop7CandidateLink"], e),
      }),
    ),
    React.createElement(
      "div",
      { className: "mt-4" },
      React.createElement(Checkbox, {
        label: "Manager-supervised version completed in 30-45 mins (per POP 7 protocol)",
        checked: e.pop7Administered,
        onChange: (e) => t(["pop7Administered"], e),
      }),
    ),
  );
}
function BriefingFromRm({ fi: e, score: t, candidate: a }) {
  const n = "experienced" === e.experienceBranch ? EXP_DIMS : INE_DIMS,
    r = "experienced" === e.experienceBranch ? e.experienced : e.inexperienced,
    s = n
      .map(([e, t, a]) => ({
        k: e,
        lbl: t,
        w: a,
        score: Number(r?.[e]?.score) || 0,
        notes: r?.[e]?.notes || "",
      }))
      .filter((e) => e.score > 0)
      .sort((e, t) => t.score - e.score),
    o = s.filter((e) => e.score >= 4).slice(0, 3),
    c = s.filter((e) => e.score <= 2).slice(0, 3);
  return React.createElement(
    "div",
    { className: "space-y-3" },
    React.createElement(
      "div",
      { className: "grid gap-3 md:grid-cols-4" },
      React.createElement(StatBlock, {
        icon: User,
        label: "Candidate",
        value: a.meta.name || "Unnamed",
        sublabel: "experienced" === e.experienceBranch ? "Experienced track" : "Inexperienced track",
        tone: "navy",
      }),
      React.createElement(StatBlock, {
        icon: MessageSquare,
        label: "Interviewer",
        value: e.interviewer || "unknown",
        sublabel: e.interviewerRole || "",
        tone: "stone",
      }),
      React.createElement(StatBlock, {
        icon: Target,
        label: "FI score",
        value: `${t.total}/100`,
        sublabel: `PO ${t.po} + Struct ${t.structured}`,
        tone: t.total >= 80 ? "emerald" : t.total >= 65 ? "amber" : "rose",
      }),
      React.createElement(StatBlock, {
        icon: ShieldCheck,
        label: "Recommendation",
        value: (t.recommendation || "—").split("—")[0].trim(),
        sublabel: "From the framework",
        tone: "amber",
      }),
    ),
    e.sourceBackground?.whyNow &&
      React.createElement(
        "div",
        { className: "border border-stone-200 rounded-sm p-4 bg-white" },
        React.createElement(
          "div",
          { className: "text-[11px] uppercase tracking-[0.14em] text-stone-500 mb-2 font-medium" },
          'The candidate\'s "why" (their words)',
        ),
        React.createElement(
          "div",
          { className: "text-sm text-stone-800 italic leading-relaxed" },
          '"',
          e.sourceBackground.whyNow,
          '"',
        ),
      ),
    React.createElement(
      "div",
      { className: "grid gap-3 md:grid-cols-2" },
      React.createElement(
        "div",
        { className: "border border-emerald-200 rounded-sm p-4 bg-emerald-50/50" },
        React.createElement(
          "div",
          {
            className:
              "text-[11px] uppercase tracking-[0.14em] text-emerald-800 mb-2 font-semibold flex items-center gap-1",
          },
          React.createElement(TrendingUp, { className: "w-3 h-3" }),
          " RM's top strengths",
        ),
        0 === o.length
          ? React.createElement(
              "div",
              { className: "text-sm text-emerald-700/70 italic" },
              "No strong dimensions scored yet.",
            )
          : React.createElement(
              "ul",
              { className: "space-y-2" },
              o.map((e) =>
                React.createElement(
                  "li",
                  { key: e.k, className: "text-sm" },
                  React.createElement(
                    "div",
                    { className: "font-semibold text-emerald-900" },
                    e.lbl,
                    " ",
                    React.createElement("span", { className: "font-mono text-xs" }, "(", e.score, "/5)"),
                  ),
                  e.notes &&
                    React.createElement("div", { className: "text-xs text-emerald-800/80 mt-0.5" }, e.notes),
                ),
              ),
            ),
      ),
      React.createElement(
        "div",
        { className: "border border-rose-200 rounded-sm p-4 bg-rose-50/50" },
        React.createElement(
          "div",
          {
            className:
              "text-[11px] uppercase tracking-[0.14em] text-rose-800 mb-2 font-semibold flex items-center gap-1",
          },
          React.createElement(AlertTriangle, { className: "w-3 h-3" }),
          " RM's concerns to probe",
        ),
        0 === c.length
          ? React.createElement(
              "div",
              { className: "text-sm text-rose-700/70 italic" },
              "No specific concerns flagged below 3/5.",
            )
          : React.createElement(
              "ul",
              { className: "space-y-2" },
              c.map((e) =>
                React.createElement(
                  "li",
                  { key: e.k, className: "text-sm" },
                  React.createElement(
                    "div",
                    { className: "font-semibold text-rose-900" },
                    e.lbl,
                    " ",
                    React.createElement("span", { className: "font-mono text-xs" }, "(", e.score, "/5)"),
                  ),
                  e.notes &&
                    React.createElement("div", { className: "text-xs text-rose-800/80 mt-0.5" }, e.notes),
                ),
              ),
            ),
      ),
    ),
    "experienced" === e.experienceBranch &&
      Object.values(e.experienced?.redFlags || {}).filter(Boolean).length > 0 &&
      React.createElement(
        "div",
        { className: "border border-rose-300 rounded-sm p-4 bg-rose-50" },
        React.createElement(
          "div",
          { className: "text-[11px] uppercase tracking-[0.14em] text-rose-900 mb-2 font-semibold" },
          "Red flags flagged by RM",
        ),
        React.createElement(
          "ul",
          { className: "space-y-1 text-sm text-rose-900" },
          RED_FLAGS.filter(([t]) => e.experienced.redFlags?.[t]).map(([e, t]) =>
            React.createElement("li", { key: e }, "• ", t),
          ),
        ),
      ),
    React.createElement(
      "div",
      { className: "border border-stone-300 rounded-sm p-4 bg-white" },
      React.createElement(
        "div",
        { className: "text-[11px] uppercase tracking-[0.14em] text-stone-500 mb-1" },
        "RM's recommendation",
      ),
      React.createElement(
        "div",
        { className: "text-sm text-stone-800 mb-2" },
        React.createElement(
          "strong",
          null,
          "proceed" === e.outcome
            ? "Proceed"
            : "proceed_conditions" === e.outcome
              ? "Proceed with conditions"
              : "hold" === e.outcome
                ? "Hold for second meeting"
                : "decline" === e.outcome
                  ? "Decline"
                  : "—",
        ),
      ),
      e.outcomeNotes &&
        React.createElement("div", { className: "text-xs text-stone-600 italic" }, e.outcomeNotes),
    ),
  );
}
const BM_FOLLOW_UP_DIMS = [
  {
    key: "executivePresence",
    label: "Executive presence",
    primary: "Can you see this person walking into a client's living room and being taken seriously?",
    listenFor:
      'Bearing, attire, vocal weight, eye contact under direct questions. Not "polished" — credible.',
  },
  {
    key: "coachabilityResponse",
    label: "In-the-moment coachability",
    primary:
      "Give a piece of direct feedback in the room. How do they respond? Defensive, curious, dismissive?",
    listenFor: "Real coachability shows up under live correction, not in stories about past feedback.",
  },
  {
    key: "financialClarity",
    label: "Financial clarity",
    primary: "Re-ask the runway question. Get specific numbers. What do they need monthly to survive?",
    listenFor:
      'Concrete numbers, no hedging. The candidate who says "I\'ll be fine" without numbers will be in trouble in month 3.',
  },
  {
    key: "networkSpecificity",
    label: "Network specificity",
    primary:
      "Names. Ask for ten people they would call this Saturday with names, occupations, and approachability.",
    listenFor: 'Vague "I know lots of people" is a fail. Specific names with context is a pass.',
  },
  {
    key: "driveDepth",
    label: 'Drive depth ("the why")',
    primary:
      'Probe their motivation one level deeper than the RM did. Ask the same "why" question and see if the answer is consistent.',
    listenFor:
      "Stories with weight. If the answer drifts or contradicts what they told the RM, that's a signal.",
  },
];
function BmFollowUpScoring({ s: e, fi: t, upd: a }) {
  const n = ["", "Concerning", "Below avg", "Average", "Above avg", "Strong"];
  return React.createElement(
    "div",
    { className: "space-y-3" },
    BM_FOLLOW_UP_DIMS.map((t) => {
      const r = Number(e.bmFollowUpScores?.[t.key]) || 0,
        s = e.bmFollowUpNotes?.[t.key] || "";
      return React.createElement(
        "div",
        { key: t.key, className: "border border-stone-200 rounded-sm bg-white p-4" },
        React.createElement("div", { className: "font-serif text-base text-stone-900 mb-1" }, t.label),
        React.createElement("div", { className: "text-xs text-stone-600 italic mb-2" }, t.primary),
        React.createElement(
          "div",
          { className: "text-[11px] text-stone-500 mb-3 leading-relaxed" },
          React.createElement("span", { className: "uppercase tracking-wider mr-1" }, "Listen for:"),
          t.listenFor,
        ),
        React.createElement(
          "div",
          { className: "flex items-center gap-3 mb-3" },
          React.createElement(
            "span",
            { className: "text-[11px] uppercase tracking-wider text-stone-500" },
            "Score",
          ),
          React.createElement(ScoreSelect, {
            value: r,
            onChange: (e) => a(["bmFollowUpScores", t.key], e),
            max: 5,
            labels: n.slice(1),
          }),
        ),
        React.createElement(TextArea, {
          value: s,
          onChange: (e) => a(["bmFollowUpNotes", t.key], e),
          rows: 2,
          placeholder: "Specific quotes, observations, evidence",
        }),
      );
    }),
    React.createElement(
      "div",
      { className: "border-2 border-stone-900 rounded-sm bg-stone-900 text-stone-50 p-4" },
      React.createElement(
        "div",
        { className: "flex items-baseline justify-between" },
        React.createElement(
          "span",
          { className: "text-[11px] uppercase tracking-[0.14em] text-stone-400" },
          "BM follow-up total",
        ),
        React.createElement(
          "span",
          { className: "font-serif text-3xl" },
          Object.values(e.bmFollowUpScores || {}).reduce((e, t) => e + (Number(t) || 0), 0),
          React.createElement("span", { className: "text-stone-500 text-base" }, "/25"),
        ),
      ),
      React.createElement(
        "div",
        { className: "mt-3" },
        React.createElement(LinearBar, {
          value: Object.values(e.bmFollowUpScores || {}).reduce((e, t) => e + (Number(t) || 0), 0),
          max: 25,
          height: 5,
          tone: "emerald",
        }),
      ),
    ),
  );
}
function Pop7UploadAnalyzer({ candidate: e, s: t, upd: a }) {
  const [n, r] = useState(!1),
    [s, o] = useState(!1),
    [c, i] = useState(""),
    [l, m] = useState(""),
    [d, p] = useState(!1),
    [u, h] = useState(!0),
    [g, b] = useState(null),
    [f, x] = useState(!1),
    [v, y] = useState(""),
    R = !(!t.uploadedReport?.filename && !t.aiAnalysis?.generatedAt),
    E = !(!t.aiAnalysis?.summary && !t.aiAnalysis?.raw),
    w = !(!t.uploadedReport?.base64 && !t.uploadedReport?.hasBlob),
    N = async () => {
      if (!t.uploadedReport) return;
      let a = t.uploadedReport.base64,
        n = t.uploadedReport.mediaType;
      if (!a && t.uploadedReport.hasBlob) {
        const t = await loadPopBlob(e.id);
        t?.base64 && ((a = t.base64), (n = t.mediaType || n));
      }
      if (a)
        try {
          const e = atob(a),
            t = new Uint8Array(e.length);
          for (let a = 0; a < e.length; a++) t[a] = e.charCodeAt(a);
          const r = new Blob([t], { type: n || "application/pdf" }),
            s = URL.createObjectURL(r);
          (y(s), x(!0));
        } catch (e) {
          i("Could not build preview: " + e.message);
        }
      else i("PDF not found in storage. Re-upload required.");
    },
    k = () => {
      (v && URL.revokeObjectURL(v), y(""), x(!1));
    };
  useEffect(
    () => () => {
      v && URL.revokeObjectURL(v);
    },
    [v],
  );
  const C = async (t) => {
      const n = t.target.files?.[0];
      if (n) {
        (i(""), r(!0));
        try {
          const t = await new Promise((e, t) => {
              const a = new FileReader();
              ((a.onload = () => {
                const t = a.result,
                  n = t.indexOf(",");
                e(n >= 0 ? t.slice(n + 1) : t);
              }),
                (a.onerror = () => t(new Error("File read failed"))),
                a.readAsDataURL(n));
            }),
            s = "application/pdf" === n.type ? "application/pdf" : n.type || "application/pdf";
          (a(["uploadedReport"], {
            filename: n.name,
            uploadedAt: new Date().toISOString(),
            sizeKB: Math.round((0.75 * t.length) / 1024),
            base64: t.length < 47e5 ? t : "",
            mediaType: s,
          }),
            r(!1),
            await (async (t, n, r) => {
              (o(!0), i(""));
              try {
                const o = await api("ai", { kind: "popPdf", base64: t, mediaType: r, candidateName: e.meta?.name || "", recruitingManager: e.meta?.recruitingManager || "" });
                if (!o.ok) throw new Error(o.error || "AI request failed");
                const c = String(o.text || "").trim(),
                  i = c
                    .replace(/^```json\s*/i, "")
                    .replace(/```\s*$/, "")
                    .trim();
                let l = null;
                try {
                  l = JSON.parse(i);
                } catch (e) {}
                (a(["uploadedReport"], {
                  filename: n,
                  uploadedAt: new Date().toISOString(),
                  sizeKB: Math.round((0.75 * t.length) / 1024),
                  base64: t.length < 47e5 ? t : "",
                  mediaType: r || "application/pdf",
                }),
                  a(["aiAnalysis"], {
                    generatedAt: new Date().toISOString(),
                    summary: l?.summary || "",
                    overallVerdict: l?.overallVerdict || "",
                    verdictRationale: l?.verdictRationale || "",
                    dimensions: l?.dimensions || {},
                    coachingPriorities: l?.coachingPriorities || [],
                    interviewerProbes: l?.interviewerProbes || [],
                    raw: c,
                  }));
              } catch (e) {
                i(e.message || String(e));
              } finally {
                o(!1);
              }
            })(t, n.name, s));
        } catch (e) {
          (i(e.message || String(e)), r(!1));
        }
        t.target.value = "";
      }
    },
    S = {
      STRONG_PROCEED: { bg: "#d1fae5", fg: "#065f46", label: "Strong proceed" },
      PROCEED_WITH_COACHING: { bg: "#dbeafe", fg: "#1e40af", label: "Proceed with coaching" },
      PROCEED_WITH_RESERVATIONS: { bg: "#fef3c7", fg: "#92400e", label: "Proceed with reservations" },
      HOLD: { bg: "#ffedd5", fg: "#9a3412", label: "Hold" },
      DECLINE: { bg: "#fee2e2", fg: "#991b1b", label: "Decline" },
    }[t.aiAnalysis?.overallVerdict] || { bg: "#f5f5f4", fg: "#57534e", label: "—" },
    P = { STRONG: "#059669", ADEQUATE: "#0891b2", WEAK: "#d97706", CONCERNING: "#dc2626" },
    A = {
      EP: "Enterprising Potential",
      AP: "Achievement Potential",
      IP: "Independence Potential",
      PO: "People Orientation",
      AO: "Analytical Orientation",
      MR: "Managing Rejection",
      CR: "Call Reluctance",
      CSC: "Commitment to Sales Career",
    };
  return React.createElement(
    "div",
    {
      className: "bg-white border-2 rounded-sm overflow-hidden",
      style: { borderColor: E ? "#7c3aed" : "#07131f" },
    },
    React.createElement(
      "div",
      {
        className: "px-4 py-3 flex items-center justify-between flex-wrap gap-2",
        style: {
          background: E ? "linear-gradient(90deg, #07131f 0%, #7c3aed 100%)" : "#07131f",
          color: "white",
        },
      },
      React.createElement(
        "div",
        { className: "flex items-center gap-2" },
        React.createElement("span", { className: "text-base" }, "✦"),
        React.createElement(
          "div",
          null,
          React.createElement(
            "div",
            { className: "text-[10px] uppercase tracking-[0.18em] text-stone-300 font-semibold" },
            "POP 7.0 — Drill-down analysis",
          ),
          React.createElement(
            "div",
            { className: "text-sm font-semibold" },
            "Upload report & let AI analyse the questioning",
          ),
        ),
      ),
      React.createElement(
        "div",
        { className: "flex items-center gap-2" },
        w &&
          React.createElement(
            "button",
            {
              onClick: N,
              className:
                "inline-flex items-center gap-1.5 text-xs px-3 py-1.5 bg-white text-stone-900 hover:bg-stone-100 rounded-sm transition-colors font-semibold",
              title: "Preview the uploaded POP 7 PDF",
            },
            React.createElement(Eye, { className: "w-3.5 h-3.5" }),
            " Preview PDF",
          ),
        E &&
          React.createElement(
            "button",
            {
              onClick: () => h(!u),
              className:
                "text-[10px] uppercase tracking-wider px-2 py-1 bg-white/10 hover:bg-white/20 rounded-sm transition-colors",
            },
            u ? "Collapse" : "Expand",
          ),
      ),
    ),
    !R &&
      !n &&
      !s &&
      React.createElement(
        "div",
        { className: "p-4 space-y-3" },
        React.createElement(
          "div",
          { className: "text-sm text-stone-700 leading-relaxed" },
          "Upload the candidate's POP 7.0 PDF (or paste the text). The AI will analyse the candidate's actual written responses dimension-by-dimension (EP, AP, IP, PO, AO, MR, CR, CSC), flag hedge words, vague answers, school-vs-professional examples, and dependency signals, and produce a coaching-priority brief.",
        ),
        React.createElement(
          "div",
          { className: "flex items-center gap-2 flex-wrap" },
          React.createElement(
            "label",
            {
              className:
                "inline-flex items-center gap-1.5 text-sm px-3 py-2 bg-stone-900 text-stone-50 rounded-sm hover:bg-stone-700 cursor-pointer transition-colors",
            },
            React.createElement(FileText, { className: "w-4 h-4" }),
            " Upload POP 7 PDF",
            React.createElement("input", {
              type: "file",
              accept: "application/pdf,image/*",
              className: "hidden",
              onChange: C,
            }),
          ),
          React.createElement(
            "button",
            {
              onClick: () => p(!d),
              className:
                "inline-flex items-center gap-1.5 text-sm px-3 py-2 border border-stone-300 text-stone-700 rounded-sm hover:bg-stone-50 transition-colors",
            },
            React.createElement(Copy, { className: "w-3.5 h-3.5" }),
            " Paste text instead",
          ),
          React.createElement(
            "span",
            { className: "text-[10px] text-stone-500 italic" },
            "PDF up to ~10MB · stays on your device, sent only to Claude for analysis",
          ),
        ),
        d &&
          React.createElement(
            "div",
            { className: "space-y-2" },
            React.createElement("textarea", {
              value: l,
              onChange: (e) => m(e.target.value),
              placeholder:
                "Paste the POP 7 report text (interview questions and responses are the most valuable part)…",
              className: "w-full text-xs px-3 py-2 border border-stone-300 rounded-sm bg-white font-mono",
              rows: 6,
            }),
            React.createElement(
              "button",
              {
                onClick: async () => {
                  if (l.trim()) {
                    (o(!0), i(""));
                    try {
                      const n = await api("ai", { kind: "popText", text: l.slice(0, 8e4), candidateName: e.meta?.name || "" });
                      if (!n.ok) throw new Error(n.error || "AI request failed");
                      const r = String(n.text || "").trim(),
                        s = r
                          .replace(/^```json\s*/i, "")
                          .replace(/```\s*$/, "")
                          .trim();
                      let o = null;
                      try {
                        o = JSON.parse(s);
                      } catch {}
                      (a(["uploadedReport"], {
                        filename: "pasted-text",
                        uploadedAt: new Date().toISOString(),
                        sizeKB: Math.round(l.length / 1024),
                      }),
                        a(["aiAnalysis"], {
                          generatedAt: new Date().toISOString(),
                          summary: o?.summary || "",
                          overallVerdict: o?.overallVerdict || "",
                          verdictRationale: o?.verdictRationale || "",
                          dimensions: o?.dimensions || {},
                          coachingPriorities: o?.coachingPriorities || [],
                          interviewerProbes: o?.interviewerProbes || [],
                          raw: r,
                        }),
                        p(!1),
                        m(""));
                    } catch (e) {
                      i(e.message || String(e));
                    } finally {
                      o(!1);
                    }
                  }
                },
                disabled: !l.trim(),
                className:
                  "text-sm px-3 py-1.5 bg-stone-900 text-stone-50 rounded-sm hover:bg-stone-700 transition-colors disabled:bg-stone-300",
              },
              "Analyse pasted text",
            ),
          ),
      ),
    (n || s) &&
      React.createElement(
        "div",
        { className: "p-4 space-y-3" },
        React.createElement(
          "div",
          { className: "flex items-center gap-3 text-stone-700" },
          React.createElement("div", {
            className: "w-5 h-5 border-2 border-stone-300 border-t-purple-700 rounded-full animate-spin",
          }),
          React.createElement(
            "div",
            { className: "flex-1" },
            React.createElement(
              "div",
              { className: "text-sm font-medium" },
              n ? "Reading file…" : "Claude is analysing the POP 7…",
            ),
            React.createElement(
              "div",
              { className: "text-xs text-stone-500" },
              s ? "Drilling into each dimension. ~20–40 seconds. You can preview the PDF while we wait." : "",
            ),
          ),
        ),
        w &&
          React.createElement(
            "div",
            {
              className:
                "flex items-center justify-between bg-stone-50 border border-stone-200 rounded-sm px-3 py-2",
            },
            React.createElement(
              "div",
              { className: "flex items-center gap-2 text-xs text-stone-700" },
              React.createElement(FileText, { className: "w-3.5 h-3.5" }),
              React.createElement("span", { className: "font-mono" }, t.uploadedReport?.filename),
              React.createElement("span", { className: "text-stone-400" }, "·"),
              React.createElement("span", null, t.uploadedReport?.sizeKB, " KB"),
            ),
            React.createElement(
              "button",
              {
                onClick: N,
                className:
                  "inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-stone-900 text-white rounded-sm hover:bg-stone-700 transition-colors",
              },
              React.createElement(Eye, { className: "w-3 h-3" }),
              " Preview PDF",
            ),
          ),
      ),
    c &&
      w &&
      React.createElement(
        "div",
        { className: "px-4 pt-3" },
        React.createElement(
          "div",
          {
            className:
              "flex items-center justify-between bg-stone-50 border border-stone-200 rounded-sm px-3 py-2",
          },
          React.createElement(
            "div",
            { className: "flex items-center gap-2 text-xs text-stone-700" },
            React.createElement(FileText, { className: "w-3.5 h-3.5" }),
            React.createElement("span", { className: "font-mono" }, t.uploadedReport?.filename),
            React.createElement("span", { className: "text-stone-400" }, "·"),
            React.createElement("span", null, t.uploadedReport?.sizeKB, " KB · uploaded but analysis failed"),
          ),
          React.createElement(
            "button",
            {
              onClick: N,
              className:
                "inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-stone-900 text-white rounded-sm hover:bg-stone-700 transition-colors",
            },
            React.createElement(Eye, { className: "w-3 h-3" }),
            " Preview PDF",
          ),
        ),
      ),
    c &&
      React.createElement(
        "div",
        { className: "px-4 py-3 bg-rose-50 border-t-2 border-rose-300 text-sm text-rose-900" },
        React.createElement("strong", null, "Error:"),
        " ",
        c,
        React.createElement(
          "div",
          { className: "text-xs mt-1 text-rose-700" },
          "Try uploading again or paste the text. Very large PDFs may exceed API limits.",
        ),
      ),
    E &&
      u &&
      React.createElement(
        "div",
        { className: "p-4 space-y-3 border-t border-stone-200", style: { backgroundColor: "#fafaf9" } },
        React.createElement(
          "div",
          {
            className:
              "flex items-center justify-between flex-wrap gap-2 bg-white border border-stone-200 rounded-sm px-3 py-2",
          },
          React.createElement(
            "div",
            { className: "flex items-center gap-3 text-xs text-stone-600" },
            React.createElement(FileText, { className: "w-3.5 h-3.5" }),
            React.createElement("span", { className: "font-mono" }, t.uploadedReport?.filename || "—"),
            React.createElement("span", { className: "text-stone-400" }, "·"),
            React.createElement("span", null, t.uploadedReport?.sizeKB || 0, " KB"),
            React.createElement("span", { className: "text-stone-400" }, "·"),
            React.createElement(
              "span",
              null,
              "Analysed ",
              t.aiAnalysis?.generatedAt ? new Date(t.aiAnalysis.generatedAt).toLocaleDateString() : "—",
            ),
          ),
          React.createElement(
            "div",
            { className: "flex items-center gap-2" },
            w &&
              React.createElement(
                "button",
                {
                  onClick: N,
                  className:
                    "inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-1 bg-stone-900 text-white rounded-sm hover:bg-stone-700 transition-colors",
                  title: "Preview the uploaded POP 7 PDF",
                },
                React.createElement(Eye, { className: "w-3 h-3" }),
                " Preview PDF",
              ),
            !w &&
              t.uploadedReport?.filename &&
              "pasted-text" !== t.uploadedReport.filename &&
              React.createElement(
                "span",
                {
                  className:
                    "inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-1 bg-stone-100 text-stone-500 rounded-sm",
                  title: "PDF was too large to store. Re-upload to enable preview.",
                },
                "Preview unavailable",
              ),
            React.createElement(
              "button",
              {
                onClick: () => {
                  confirm("Clear the uploaded report and AI analysis?") &&
                    (a(["uploadedReport"], {
                      filename: "",
                      uploadedAt: "",
                      sizeKB: 0,
                      base64: "",
                      mediaType: "",
                    }),
                    a(["aiAnalysis"], {
                      generatedAt: "",
                      summary: "",
                      overallVerdict: "",
                      verdictRationale: "",
                      dimensions: {},
                      coachingPriorities: [],
                      interviewerProbes: [],
                      raw: "",
                    }),
                    b(null));
                },
                className:
                  "text-[10px] uppercase tracking-wider text-stone-500 hover:text-rose-700 transition-colors",
              },
              "Clear & re-upload",
            ),
          ),
        ),
        t.aiAnalysis?.overallVerdict &&
          React.createElement(
            "div",
            { className: "border-2 rounded-sm overflow-hidden", style: { borderColor: S.fg } },
            React.createElement(
              "div",
              { className: "px-4 py-3", style: { backgroundColor: S.bg } },
              React.createElement(
                "div",
                { className: "flex items-baseline justify-between flex-wrap gap-2" },
                React.createElement(
                  "div",
                  { className: "text-[10px] uppercase tracking-[0.18em] font-bold", style: { color: S.fg } },
                  "AI Verdict",
                ),
                React.createElement(
                  "div",
                  { className: "font-serif text-xl font-bold", style: { color: S.fg } },
                  S.label,
                ),
              ),
              t.aiAnalysis?.summary &&
                React.createElement(
                  "p",
                  {
                    className: "text-sm mt-2 leading-relaxed",
                    style: { color: S.fg, fontFamily: "Newsreader, Georgia, serif" },
                  },
                  t.aiAnalysis.summary,
                ),
              t.aiAnalysis?.verdictRationale &&
                React.createElement(
                  "p",
                  { className: "text-xs mt-2 leading-relaxed italic", style: { color: S.fg } },
                  t.aiAnalysis.verdictRationale,
                ),
            ),
          ),
        t.aiAnalysis?.dimensions &&
          Object.keys(t.aiAnalysis.dimensions).length > 0 &&
          React.createElement(
            "div",
            { className: "bg-white border border-stone-200 rounded-sm overflow-hidden" },
            React.createElement(
              "div",
              { className: "px-3 py-2 border-b border-stone-200 bg-stone-50" },
              React.createElement(
                "div",
                { className: "text-[10px] uppercase tracking-[0.14em] font-bold text-stone-700" },
                "Dimension drill-down",
              ),
            ),
            React.createElement(
              "div",
              { className: "divide-y divide-stone-100" },
              Object.entries(t.aiAnalysis.dimensions).map(([e, t]) => {
                if (!t) return null;
                const a = g === e,
                  n = P[t.responseQuality] || "#78716c";
                return React.createElement(
                  "div",
                  { key: e },
                  React.createElement(
                    "button",
                    {
                      onClick: () => b(a ? null : e),
                      className:
                        "w-full px-3 py-2.5 flex items-center gap-3 hover:bg-stone-50 transition-colors text-left",
                    },
                    React.createElement(
                      "div",
                      {
                        className:
                          "w-12 h-12 rounded-sm flex flex-col items-center justify-center flex-shrink-0",
                        style: { backgroundColor: n + "15", border: `1px solid ${n}40` },
                      },
                      React.createElement("span", { className: "text-xs font-bold", style: { color: n } }, e),
                    ),
                    React.createElement(
                      "div",
                      { className: "flex-1 min-w-0" },
                      React.createElement(
                        "div",
                        { className: "text-sm font-semibold text-stone-900" },
                        A[e] || e,
                      ),
                      React.createElement(
                        "div",
                        { className: "text-[11px] text-stone-500 leading-tight" },
                        t.scoreInterpretation || "—",
                      ),
                    ),
                    React.createElement(
                      "span",
                      {
                        className:
                          "text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm font-bold flex-shrink-0",
                        style: { backgroundColor: n + "15", color: n },
                      },
                      t.responseQuality || "—",
                    ),
                    React.createElement(ChevronDown, {
                      className:
                        "w-4 h-4 text-stone-400 transition-transform flex-shrink-0 " +
                        (a ? "rotate-180" : ""),
                    }),
                  ),
                  a &&
                    React.createElement(
                      "div",
                      { className: "px-3 pb-3 pt-1 bg-stone-50/50 space-y-2.5" },
                      t.drillDown &&
                        React.createElement(
                          "div",
                          null,
                          React.createElement(
                            "div",
                            {
                              className:
                                "text-[10px] uppercase tracking-wider text-stone-500 font-semibold mb-1",
                            },
                            "Analysis",
                          ),
                          React.createElement(
                            "p",
                            { className: "text-xs text-stone-800 leading-relaxed" },
                            t.drillDown,
                          ),
                        ),
                      t.tellingPhrases &&
                        t.tellingPhrases.length > 0 &&
                        React.createElement(
                          "div",
                          null,
                          React.createElement(
                            "div",
                            {
                              className:
                                "text-[10px] uppercase tracking-wider text-stone-500 font-semibold mb-1",
                            },
                            "Telling phrases from the response",
                          ),
                          React.createElement(
                            "div",
                            { className: "space-y-1" },
                            t.tellingPhrases.map((e, t) =>
                              React.createElement(
                                "div",
                                {
                                  key: t,
                                  className:
                                    "text-xs italic text-stone-700 pl-2 border-l-2 border-stone-400 bg-white px-2 py-1",
                                },
                                '"',
                                e,
                                '"',
                              ),
                            ),
                          ),
                        ),
                      t.redFlags &&
                        t.redFlags.length > 0 &&
                        React.createElement(
                          "div",
                          { className: "border-l-2 border-rose-400 bg-rose-50/60 px-2 py-1.5 rounded-r-sm" },
                          React.createElement(
                            "div",
                            {
                              className:
                                "text-[10px] uppercase tracking-wider text-rose-800 font-semibold mb-0.5",
                            },
                            "Red flags",
                          ),
                          React.createElement(
                            "ul",
                            { className: "space-y-0.5" },
                            t.redFlags.map((e, t) =>
                              React.createElement(
                                "li",
                                { key: t, className: "text-xs text-rose-900 flex items-start gap-1" },
                                React.createElement("span", { className: "text-rose-500" }, "▸"),
                                React.createElement("span", null, e),
                              ),
                            ),
                          ),
                        ),
                    ),
                );
              }),
            ),
          ),
        t.aiAnalysis?.coachingPriorities &&
          t.aiAnalysis.coachingPriorities.length > 0 &&
          React.createElement(
            "div",
            { className: "bg-white border border-stone-200 rounded-sm" },
            React.createElement(
              "div",
              { className: "px-3 py-2 border-b border-stone-200 bg-stone-50" },
              React.createElement(
                "div",
                { className: "text-[10px] uppercase tracking-[0.14em] font-bold text-stone-700" },
                "Top coaching priorities for first 90 days",
              ),
            ),
            React.createElement(
              "div",
              { className: "p-3 space-y-2" },
              t.aiAnalysis.coachingPriorities.map((e, t) =>
                React.createElement(
                  "div",
                  {
                    key: t,
                    className: "flex items-start gap-2 p-2 border border-stone-200 rounded-sm bg-stone-50/50",
                  },
                  React.createElement(
                    "div",
                    {
                      className:
                        "w-6 h-6 rounded-full bg-stone-900 text-stone-50 flex items-center justify-center text-xs font-bold flex-shrink-0",
                    },
                    e.priority || t + 1,
                  ),
                  React.createElement(
                    "div",
                    { className: "flex-1 text-xs space-y-1" },
                    React.createElement("div", { className: "font-semibold text-stone-900" }, e.area),
                    React.createElement(
                      "div",
                      { className: "text-stone-700" },
                      React.createElement("strong", null, "Action:"),
                      " ",
                      e.specificAction,
                    ),
                    e.watchPoint &&
                      React.createElement(
                        "div",
                        { className: "text-stone-600 italic" },
                        React.createElement("strong", null, "Watch:"),
                        " ",
                        e.watchPoint,
                      ),
                  ),
                ),
              ),
            ),
          ),
        t.aiAnalysis?.interviewerProbes &&
          t.aiAnalysis.interviewerProbes.length > 0 &&
          React.createElement(
            "div",
            { className: "bg-amber-50/50 border-l-4 border-amber-400 rounded-r-sm px-3 py-2.5" },
            React.createElement(
              "div",
              { className: "text-[10px] uppercase tracking-wider text-amber-900 font-bold mb-1.5" },
              "Probes to use in your follow-up conversation",
            ),
            React.createElement(
              "ul",
              { className: "space-y-1" },
              t.aiAnalysis.interviewerProbes.map((e, t) =>
                React.createElement(
                  "li",
                  { key: t, className: "text-xs text-stone-800 flex items-start gap-1.5" },
                  React.createElement("span", { className: "text-amber-600" }, "›"),
                  React.createElement("span", { className: "italic" }, '"', e, '"'),
                ),
              ),
            ),
          ),
        React.createElement(
          "div",
          { className: "flex items-center gap-2 pt-2 border-t border-stone-200" },
          React.createElement(
            "label",
            {
              className:
                "inline-flex items-center gap-1.5 text-xs px-2.5 py-1.5 border border-stone-300 text-stone-700 rounded-sm hover:bg-stone-100 cursor-pointer transition-colors",
            },
            React.createElement(FileText, { className: "w-3 h-3" }),
            " Upload different POP",
            React.createElement("input", {
              type: "file",
              accept: "application/pdf,image/*",
              className: "hidden",
              onChange: C,
            }),
          ),
          t.aiAnalysis?.raw &&
            !t.aiAnalysis?.summary &&
            React.createElement(
              "details",
              { className: "text-xs" },
              React.createElement(
                "summary",
                { className: "cursor-pointer text-stone-500" },
                "Show raw AI output (JSON parse fallback)",
              ),
              React.createElement(
                "pre",
                {
                  className:
                    "mt-1 p-2 bg-stone-100 border border-stone-200 rounded-sm font-mono text-stone-700 whitespace-pre-wrap max-h-64 overflow-auto",
                },
                t.aiAnalysis.raw,
              ),
            ),
        ),
      ),
    w &&
      !u &&
      React.createElement(
        "div",
        {
          className:
            "px-4 py-2 border-t border-stone-200 bg-stone-50 flex items-center justify-between text-xs",
        },
        React.createElement(
          "div",
          { className: "flex items-center gap-2 text-stone-600" },
          React.createElement(FileText, { className: "w-3.5 h-3.5" }),
          React.createElement("span", { className: "font-mono" }, t.uploadedReport?.filename),
        ),
        React.createElement(
          "button",
          {
            onClick: N,
            className:
              "inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-1 bg-stone-900 text-white rounded-sm hover:bg-stone-700 transition-colors",
          },
          React.createElement(Eye, { className: "w-3 h-3" }),
          " Preview PDF",
        ),
      ),
    f &&
      v &&
      React.createElement(
        "div",
        {
          className: "fixed inset-0 z-50 flex items-center justify-center p-4",
          style: { backgroundColor: "rgba(0,0,0,0.7)" },
          onClick: k,
        },
        React.createElement(
          "div",
          {
            className: "bg-white rounded-sm overflow-hidden flex flex-col w-full max-w-5xl",
            style: { height: "90vh" },
            onClick: (e) => e.stopPropagation(),
          },
          React.createElement(
            "div",
            {
              className: "px-4 py-3 flex items-center justify-between flex-shrink-0",
              style: { background: "linear-gradient(90deg, #07131f 0%, #2c4d7a 100%)", color: "white" },
            },
            React.createElement(
              "div",
              { className: "flex items-center gap-2" },
              React.createElement(FileText, { className: "w-4 h-4" }),
              React.createElement(
                "div",
                null,
                React.createElement(
                  "div",
                  { className: "text-[10px] uppercase tracking-[0.18em] text-stone-300" },
                  "POP 7.0 PDF Preview",
                ),
                React.createElement(
                  "div",
                  { className: "text-sm font-semibold" },
                  t.uploadedReport?.filename,
                ),
              ),
            ),
            React.createElement(
              "div",
              { className: "flex items-center gap-2" },
              React.createElement(
                "a",
                {
                  href: v,
                  download: t.uploadedReport?.filename || "pop7.pdf",
                  className:
                    "inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-sm transition-colors",
                },
                React.createElement(Download, { className: "w-3 h-3" }),
                " Download",
              ),
              React.createElement(
                "a",
                {
                  href: v,
                  target: "_blank",
                  rel: "noopener noreferrer",
                  className:
                    "inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-sm transition-colors",
                },
                "Open in new tab",
              ),
              React.createElement(
                "button",
                { onClick: k, className: "text-white/80 hover:text-white" },
                React.createElement(X, { className: "w-5 h-5" }),
              ),
            ),
          ),
          React.createElement(
            "div",
            { className: "flex-1 bg-stone-100 overflow-hidden" },
            React.createElement("iframe", {
              src: v,
              title: "POP 7 PDF preview",
              className: "w-full h-full border-0",
            }),
          ),
        ),
      ),
  );
}
function Pop7ReviewStage({ candidate: e, persist: t, currentRole: a }) {
  const n = e.stages.pop7Review,
    r = e.stages.bmApproval,
    s = (e, a) => t((t) => setPath(t, ["stages", "pop7Review", ...e], a));
  return React.createElement(
    "div",
    { className: "space-y-3" },
    React.createElement(Pop7UploadAnalyzer, { candidate: e, s: n, upd: s }),
    r.bmDecision &&
      React.createElement(
        "div",
        { className: "bg-white border border-stone-200 rounded-sm p-4" },
        React.createElement(
          "div",
          { className: "text-[11px] uppercase tracking-[0.14em] text-stone-500 mb-2 font-medium" },
          "Branch Manager handed off",
        ),
        React.createElement(
          "div",
          { className: "grid gap-3 md:grid-cols-3" },
          React.createElement(
            "div",
            null,
            React.createElement(
              "div",
              { className: "text-[10px] uppercase tracking-wider text-stone-400" },
              "BM Decision",
            ),
            React.createElement(
              "div",
              { className: "text-sm text-stone-900 font-medium" },
              "approve_pop" === r.bmDecision
                ? "Approved POP administration"
                : "second_meeting" === r.bmDecision
                  ? "Second meeting requested"
                  : "decline" === r.bmDecision
                    ? "Declined"
                    : "—",
            ),
          ),
          React.createElement(
            "div",
            null,
            React.createElement(
              "div",
              { className: "text-[10px] uppercase tracking-wider text-stone-400" },
              "BM Score",
            ),
            React.createElement(
              "div",
              { className: "text-sm text-stone-900 font-mono" },
              Object.values(r.bmFollowUpScores || {}).reduce((e, t) => e + (Number(t) || 0), 0),
              "/25",
            ),
          ),
          React.createElement(
            "div",
            null,
            React.createElement(
              "div",
              { className: "text-[10px] uppercase tracking-wider text-stone-400" },
              "POP completed",
            ),
            React.createElement("div", { className: "text-sm text-stone-900" }, r.pop7CompletedDate || "—"),
          ),
        ),
        r.bmDecisionRationale &&
          React.createElement(
            "div",
            { className: "mt-3 pt-3 border-t border-stone-100" },
            React.createElement(
              "div",
              { className: "text-[10px] uppercase tracking-wider text-stone-400 mb-1" },
              "BM rationale",
            ),
            React.createElement(
              "div",
              { className: "text-xs text-stone-700 italic" },
              '"',
              r.bmDecisionRationale,
              '"',
            ),
          ),
        r.bmConcerns &&
          React.createElement(
            "div",
            { className: "mt-3 pt-3 border-t border-stone-100" },
            React.createElement(
              "div",
              { className: "text-[10px] uppercase tracking-wider text-stone-400 mb-1" },
              "BM concerns to test",
            ),
            React.createElement("div", { className: "text-xs text-stone-700" }, r.bmConcerns),
          ),
      ),
    React.createElement(
      Section,
      {
        title: "POP 7.0 — score capture",
        subtitle: "Enter the scale scores from the candidate's report",
        defaultOpen: !0,
      },
      React.createElement(
        Grid,
        { cols: 3 },
        React.createElement(Select, {
          label: "Reviewer",
          value: n.reviewer,
          onChange: (e) => s(["reviewer"], e),
          options: RECRUITING_MANAGER_OPTIONS,
        }),
        React.createElement(TextInput, {
          label: "Date reviewed",
          type: "date",
          value: n.date,
          onChange: (e) => s(["date"], e),
        }),
        React.createElement(TextInput, {
          label: "Probability of Success (%)",
          value: n.probability,
          onChange: (e) => s(["probability"], e),
          placeholder: "From page 2",
        }),
      ),
      React.createElement(Divider, { label: "Scale scores" }),
      React.createElement(
        Grid,
        { cols: 3 },
        POP_SCALES.map(({ key: e, label: t, hint: a }) =>
          React.createElement(TextInput, {
            key: e,
            label: t,
            value: n.scores[e.toLowerCase()],
            onChange: (t) => s(["scores", e.toLowerCase()], t),
            hint: a,
          }),
        ),
      ),
    ),
    React.createElement(Pop7QuestionPrompts, { s: n, upd: s }),
    React.createElement(
      Section,
      { title: "Report narrative sections", defaultOpen: !1 },
      React.createElement(
        Grid,
        { cols: 1 },
        React.createElement(TextArea, {
          label: "Snapshot of Sales Potential",
          value: n.snapshot,
          onChange: (e) => s(["snapshot"], e),
          rows: 3,
        }),
        React.createElement(TextArea, {
          label: "Management Preview",
          value: n.managementPreview,
          onChange: (e) => s(["managementPreview"], e),
          rows: 3,
        }),
        React.createElement(TextArea, {
          label: "Selection Considerations",
          value: n.selectionConsiderations,
          onChange: (e) => s(["selectionConsiderations"], e),
          rows: 3,
        }),
        React.createElement(TextArea, {
          label: "Training & Coaching Suggestions",
          value: n.trainingCoaching,
          onChange: (e) => s(["trainingCoaching"], e),
          rows: 3,
        }),
        React.createElement(TextArea, {
          label: "Retention Prospects",
          value: n.retentionProspects,
          onChange: (e) => s(["retentionProspects"], e),
          rows: 3,
        }),
      ),
    ),
    React.createElement(
      Section,
      { title: "RM synthesis — strengths · concerns · coaching", defaultOpen: !0 },
      React.createElement(
        Grid,
        { cols: 1 },
        React.createElement(TextArea, {
          label: "Strengths surfaced by the assessment + interview",
          value: n.review.strengths,
          onChange: (e) => s(["review", "strengths"], e),
          rows: 3,
        }),
        React.createElement(TextArea, {
          label: "Structural concerns / risk factors",
          value: n.review.concerns,
          onChange: (e) => s(["review", "concerns"], e),
          rows: 3,
        }),
        React.createElement(TextArea, {
          label: "Coaching recommendations for receiving manager",
          value: n.review.coachingRecs,
          onChange: (e) => s(["review", "coachingRecs"], e),
          rows: 4,
        }),
      ),
      React.createElement(Divider, null),
      React.createElement(
        Grid,
        { cols: 2 },
        React.createElement(Select, {
          label: "RM final recommendation",
          value: n.rmFinalRecommendation,
          onChange: (e) => s(["rmFinalRecommendation"], e),
          options: [
            ["proceed_discovery", "Proceed to Discovery"],
            ["proceed_with_coaching", "Proceed with specific coaching plan"],
            ["hold_panel", "Refer to Selection Panel"],
            ["decline", "Decline"],
          ],
        }),
      ),
      React.createElement(
        "div",
        { className: "mt-3" },
        React.createElement(TextArea, {
          label: "Rationale (visible to BM for approval)",
          value: n.rmFinalRationale,
          onChange: (e) => s(["rmFinalRationale"], e),
          rows: 3,
        }),
      ),
    ),
  );
}
function Pop7QuestionPrompts({ s: e, upd: t }) {
  const a = POP_SCALES.filter(
    (t) => "" !== e.scores[t.key.toLowerCase()] && void 0 !== e.scores[t.key.toLowerCase()],
  );
  return 0 === a.length
    ? React.createElement(
        Section,
        {
          title: "Score-driven interview questions",
          subtitle: "Enter scale scores above to surface the right questions",
          defaultOpen: !0,
        },
        React.createElement(
          "div",
          {
            className:
              "px-6 py-12 text-center text-stone-500 border border-dashed border-stone-300 rounded-sm",
          },
          React.createElement(ListChecks, { className: "w-8 h-8 mx-auto mb-3 opacity-50" }),
          React.createElement(
            "div",
            { className: "text-sm" },
            "Score-triggered questions will appear here once you enter at least one POP scale score.",
          ),
        ),
      )
    : React.createElement(
        Section,
        {
          title: "Score-driven interview questions",
          subtitle: "The POP report ships with these questions — score the candidate's answers as you go",
          defaultOpen: !0,
        },
        React.createElement(
          "div",
          { className: "text-xs text-stone-600 italic mb-4 px-3 py-2 bg-stone-100 rounded-sm" },
          "These questions are surfaced based on the candidate's POP scores. Ask them, capture the candidate's answer, then score how well they validated or undermined the POP prediction.",
        ),
        React.createElement(
          "div",
          { className: "space-y-3" },
          a.map((a) => {
            const n = e.scores[a.key.toLowerCase()],
              r = bandForScore(a.key, n);
            if (!r) return null;
            const s = "caution" === r.tone ? "rose" : "average" === r.tone ? "amber" : "emerald",
              o = "rose" === s ? "#9f1239" : "amber" === s ? "#b45309" : "#15803d";
            return React.createElement(
              "div",
              { key: a.key, className: "border border-stone-200 rounded-sm bg-white overflow-hidden" },
              React.createElement(
                "div",
                { className: "px-4 py-3 border-b border-stone-200", style: { backgroundColor: "#FAFAF9" } },
                React.createElement(
                  "div",
                  { className: "flex items-baseline justify-between gap-3 flex-wrap" },
                  React.createElement(
                    "div",
                    null,
                    React.createElement(
                      "div",
                      { className: "font-serif text-base text-stone-900" },
                      a.label,
                      " ",
                      React.createElement("span", { className: "font-mono text-sm text-stone-500" }, "= ", n),
                    ),
                    React.createElement(
                      "div",
                      { className: "text-xs text-stone-500 mt-0.5" },
                      POP_QUESTION_BANK[a.key].description,
                    ),
                  ),
                  React.createElement(
                    "div",
                    {
                      className: "text-xs px-2.5 py-1 rounded-full font-medium",
                      style: {
                        backgroundColor: "rose" === s ? "#FFE4E6" : "amber" === s ? "#FEF3C7" : "#D1FAE5",
                        color: o,
                      },
                    },
                    r.label,
                  ),
                ),
                React.createElement(
                  "div",
                  { className: "text-xs text-stone-700 mt-2 leading-relaxed" },
                  r.narrative,
                ),
              ),
              React.createElement(
                "div",
                { className: "p-4 space-y-3" },
                r.questions.map((n, r) => {
                  const s = `${a.key}_${r}`,
                    o = e.interviewAnswers?.[s] || { answer: "", rmScore: 0, rmNote: "" };
                  return React.createElement(
                    "div",
                    { key: r, className: "border border-stone-200 rounded-sm p-3" },
                    React.createElement(
                      "div",
                      { className: "text-xs text-stone-700 italic mb-2 leading-relaxed" },
                      n,
                    ),
                    React.createElement(TextArea, {
                      value: o.answer,
                      onChange: (e) => t(["interviewAnswers", s], { ...o, answer: e }),
                      rows: 2,
                      placeholder: "Candidate's answer in their words",
                    }),
                    React.createElement(
                      "div",
                      { className: "mt-2 flex items-center gap-3" },
                      React.createElement(
                        "span",
                        { className: "text-[10px] uppercase tracking-wider text-stone-500" },
                        "Validates POP?",
                      ),
                      React.createElement(ButtonGroup, {
                        value: o.rmScore,
                        onChange: (e) => t(["interviewAnswers", s], { ...o, rmScore: e }),
                        options: [
                          ["confirms", "Confirms POP"],
                          ["neutral", "Neutral"],
                          ["contradicts", "Contradicts POP"],
                        ],
                      }),
                    ),
                  );
                }),
              ),
            );
          }),
        ),
      );
}
function DiscoveryStage({ candidate: e, persist: t }) {
  const a = e.stages.discovery,
    n = (e, a) => t((t) => setPath(t, ["stages", "discovery", ...e], a)),
    r = useMemo(() => {
      let e = 0,
        t = 0,
        n = 0,
        r = 0,
        s = 0,
        o = 0;
      for (const c of DISCOVERY_MODULES) {
        const i = a.modules?.[c.id],
          l = moduleProgress(i, c);
        ((e += l.totalItems),
          (t += l.doneItems),
          (n += l.totalSessions),
          (r += l.sessionsComplete),
          l.doneItems > 0 && s++,
          100 === l.pct && o++);
      }
      return {
        totalItems: e,
        doneItems: t,
        itemPct: e > 0 ? Math.round((t / e) * 100) : 0,
        totalSessions: n,
        doneSessions: r,
        modulesStarted: s,
        modulesComplete: o,
        totalModules: DISCOVERY_MODULES.length,
      };
    }, [a.modules]);
  return React.createElement(
    "div",
    { className: "space-y-3" },
    React.createElement(
      "div",
      {
        className:
          "bg-gradient-to-br from-stone-50 via-amber-50/30 to-emerald-50/30 border border-stone-300 rounded-sm overflow-hidden",
      },
      React.createElement(
        "div",
        {
          className: "px-4 py-3 border-b border-stone-200",
          style: { backgroundColor: "#07131f", color: "white" },
        },
        React.createElement(
          "div",
          { className: "flex items-center justify-between flex-wrap gap-3" },
          React.createElement(
            "div",
            null,
            React.createElement(
              "div",
              { className: "text-[10px] uppercase tracking-[0.18em] text-stone-300 font-semibold mb-0.5" },
              "GSAP V4 Discovery Program",
            ),
            React.createElement("h3", { className: "font-serif text-xl text-white" }, "Orientation Sessions"),
          ),
          React.createElement(
            "div",
            { className: "flex items-center gap-4" },
            React.createElement(
              "div",
              { className: "relative w-20 h-20" },
              React.createElement(
                "svg",
                { className: "w-20 h-20 -rotate-90" },
                React.createElement("circle", {
                  cx: "40",
                  cy: "40",
                  r: "34",
                  stroke: "rgba(255,255,255,0.15)",
                  strokeWidth: "6",
                  fill: "none",
                }),
                React.createElement("circle", {
                  cx: "40",
                  cy: "40",
                  r: "34",
                  stroke: 100 === r.itemPct ? "#10b981" : r.itemPct > 0 ? "#fbbf24" : "rgba(255,255,255,0.3)",
                  strokeWidth: "6",
                  fill: "none",
                  strokeLinecap: "round",
                  strokeDasharray: (r.itemPct / 100) * 213.6 + " 213.6",
                  style: { transition: "stroke-dasharray 0.5s" },
                }),
              ),
              React.createElement(
                "div",
                { className: "absolute inset-0 flex flex-col items-center justify-center" },
                React.createElement(
                  "span",
                  { className: "font-serif text-2xl font-bold text-white leading-none" },
                  r.itemPct,
                  "%",
                ),
              ),
            ),
          ),
        ),
      ),
      React.createElement(
        "div",
        { className: "grid gap-0 md:grid-cols-4 divide-x divide-stone-200" },
        React.createElement(
          "div",
          { className: "px-4 py-3 text-center" },
          React.createElement(
            "div",
            { className: "text-[10px] uppercase tracking-wider text-stone-500 mb-1" },
            "Modules",
          ),
          React.createElement(
            "div",
            { className: "font-serif text-2xl text-stone-900 leading-none" },
            r.modulesComplete,
            React.createElement("span", { className: "text-stone-400 text-lg" }, "/", r.totalModules),
          ),
          React.createElement(
            "div",
            { className: "text-[10px] text-stone-500 mt-1" },
            r.modulesStarted,
            " in progress",
          ),
        ),
        React.createElement(
          "div",
          { className: "px-4 py-3 text-center" },
          React.createElement(
            "div",
            { className: "text-[10px] uppercase tracking-wider text-stone-500 mb-1" },
            "Sessions",
          ),
          React.createElement(
            "div",
            { className: "font-serif text-2xl text-stone-900 leading-none" },
            r.doneSessions,
            React.createElement("span", { className: "text-stone-400 text-lg" }, "/", r.totalSessions),
          ),
          React.createElement("div", { className: "text-[10px] text-stone-500 mt-1" }, "complete"),
        ),
        React.createElement(
          "div",
          { className: "px-4 py-3 text-center" },
          React.createElement(
            "div",
            { className: "text-[10px] uppercase tracking-wider text-stone-500 mb-1" },
            "Checklist items",
          ),
          React.createElement(
            "div",
            { className: "font-serif text-2xl text-stone-900 leading-none" },
            r.doneItems,
            React.createElement("span", { className: "text-stone-400 text-lg" }, "/", r.totalItems),
          ),
          React.createElement("div", { className: "text-[10px] text-stone-500 mt-1" }, "ticked"),
        ),
        React.createElement(
          "div",
          { className: "px-4 py-3 text-center" },
          React.createElement(
            "div",
            { className: "text-[10px] uppercase tracking-wider text-stone-500 mb-1" },
            "Market surveys",
          ),
          React.createElement(
            "div",
            { className: "font-serif text-2xl text-stone-900 leading-none" },
            (a.marketSurveys || []).length,
          ),
          React.createElement("div", { className: "text-[10px] text-stone-500 mt-1" }, "submitted"),
        ),
      ),
    ),
    React.createElement(
      Section,
      { title: "GGLDC enrollment & meta", defaultOpen: !0 },
      React.createElement(
        Grid,
        { cols: 2 },
        React.createElement(Checkbox, {
          label: "Candidate enrolled on GGLDC (7-week limited access)",
          checked: a.ggldcEnrolled,
          onChange: (e) => n(["ggldcEnrolled"], e),
        }),
        React.createElement(TextInput, {
          label: "GGLDC email used",
          value: a.ggldcEmail,
          onChange: (e) => n(["ggldcEmail"], e),
        }),
        React.createElement(TextInput, {
          label: "Enrolled date",
          type: "date",
          value: a.enrolledDate,
          onChange: (e) => n(["enrolledDate"], e),
        }),
        React.createElement(TextInput, {
          label: "Expected completion",
          type: "date",
          value: a.expectedComplete,
          onChange: (e) => n(["expectedComplete"], e),
        }),
      ),
    ),
    React.createElement(
      "div",
      { className: "space-y-3" },
      DISCOVERY_MODULES.map((e, t) =>
        React.createElement(ModuleCard, {
          key: e.id,
          index: t + 1,
          modSpec: e,
          modData: a.modules?.[e.id],
          upd: (t, a) => n(["modules", e.id, ...t], a),
        }),
      ),
    ),
    React.createElement(MarketSurveysCard, {
      surveys: a.marketSurveys || [],
      upd: (e) => n(["marketSurveys"], e),
    }),
    React.createElement(DiscoverySummaryEvalCard, {
      data: a.discoverySummaryEval,
      upd: (e, t) => n(["discoverySummaryEval", ...e], t),
    }),
  );
}
function ModuleCard({ index: e, modSpec: t, modData: a, upd: n }) {
  const [r, s] = useState(!1),
    [o, c] = useState(!1),
    i = moduleProgress(a, t),
    l = 100 === i.pct,
    m = i.doneItems > 0,
    d = t.accent + "15",
    p = t.accent + "40";
  return React.createElement(
    "div",
    {
      className: "bg-white border rounded-sm overflow-hidden transition-shadow hover:shadow-sm",
      style: { borderColor: m ? t.accent : "#d6d3d1" },
    },
    React.createElement(
      "button",
      {
        onClick: () => s(!r),
        className: "w-full px-4 py-3 flex items-center gap-3 text-left transition-colors",
        style: { backgroundColor: r ? d : "white" },
      },
      React.createElement(
        "div",
        {
          className:
            "flex-shrink-0 w-10 h-10 rounded-sm flex items-center justify-center font-serif text-base font-bold",
          style: { backgroundColor: t.accent, color: "white" },
        },
        "M",
        e,
      ),
      React.createElement(
        "div",
        { className: "flex-1 min-w-0" },
        React.createElement(
          "div",
          { className: "flex items-baseline gap-2 flex-wrap" },
          React.createElement("h4", { className: "font-serif text-base text-stone-900" }, t.title),
          React.createElement("span", { className: "text-[10px] text-stone-400 italic" }, t.pages),
        ),
        React.createElement(
          "div",
          { className: "flex items-center gap-2 text-[11px] text-stone-600 mt-0.5" },
          React.createElement("span", null, i.sessionsComplete, "/", i.totalSessions, " sessions"),
          React.createElement("span", { className: "text-stone-300" }, "·"),
          React.createElement("span", null, i.doneItems, "/", i.totalItems, " items"),
          l &&
            React.createElement(
              React.Fragment,
              null,
              React.createElement("span", { className: "text-stone-300" }, "·"),
              React.createElement("span", { className: "text-emerald-700 font-semibold" }, "Complete"),
            ),
        ),
      ),
      React.createElement(
        "div",
        { className: "hidden sm:flex flex-col items-end gap-1 w-32" },
        React.createElement("div", { className: "text-[10px] font-mono text-stone-600" }, i.pct, "%"),
        React.createElement(
          "div",
          { className: "w-full h-1.5 bg-stone-200 rounded-full overflow-hidden" },
          React.createElement("div", {
            className: "h-full transition-all duration-300",
            style: { width: `${i.pct}%`, backgroundColor: l ? "#10b981" : t.accent },
          }),
        ),
      ),
      React.createElement(ChevronDown, {
        className: "w-4 h-4 text-stone-400 flex-shrink-0 transition-transform " + (r ? "rotate-180" : ""),
      }),
    ),
    r &&
      React.createElement(
        "div",
        { className: "border-t", style: { borderColor: p } },
        React.createElement(
          "div",
          { className: "px-4 py-3 bg-stone-50/50 border-b border-stone-200" },
          React.createElement(
            "button",
            { onClick: () => c(!o), className: "w-full flex items-center justify-between text-left" },
            React.createElement(
              "span",
              { className: "text-[10px] uppercase tracking-[0.14em] font-semibold text-stone-700" },
              "Manager's Guide — objectives & preparation",
            ),
            React.createElement(ChevronDown, {
              className: "w-3 h-3 text-stone-400 transition-transform " + (o ? "rotate-180" : ""),
            }),
          ),
          o &&
            React.createElement(
              "div",
              { className: "mt-3 space-y-3" },
              React.createElement(
                "div",
                null,
                React.createElement(
                  "div",
                  { className: "text-[10px] uppercase tracking-wider text-stone-500 mb-1" },
                  "Objective",
                ),
                React.createElement(
                  "p",
                  { className: "text-xs text-stone-700 italic leading-relaxed" },
                  t.objective,
                ),
              ),
              React.createElement(
                "div",
                null,
                React.createElement(
                  "div",
                  { className: "text-[10px] uppercase tracking-wider text-stone-500 mb-1" },
                  "Manager's preparation",
                ),
                React.createElement(
                  "ul",
                  { className: "text-xs text-stone-700 space-y-0.5 leading-relaxed" },
                  t.managerPrep.map((e, t) =>
                    React.createElement(
                      "li",
                      { key: t, className: "flex items-start gap-1.5" },
                      React.createElement("span", { className: "text-stone-400 mt-0.5" }, "•"),
                      React.createElement("span", null, e),
                    ),
                  ),
                ),
              ),
            ),
        ),
        React.createElement(
          "div",
          { className: "px-4 py-3 space-y-3" },
          t.sessions.map((r, s) =>
            React.createElement(SessionBlock, {
              key: r.id,
              modIdx: e,
              sIdx: s + 1,
              sessSpec: r,
              sessData: a?.sessions?.[r.id],
              accent: t.accent,
              upd: (e, t) => n(["sessions", r.id, ...e], t),
            }),
          ),
        ),
        React.createElement(
          "div",
          { className: "px-4 py-3 border-t border-stone-200 bg-stone-50/50" },
          React.createElement(TextArea, {
            label: "Module-level notes",
            value: a?.notes || "",
            onChange: (e) => n(["notes"], e),
            rows: 2,
            placeholder: "Overall observations on how the candidate is performing in this module.",
          }),
        ),
      ),
  );
}
function SessionBlock({ modIdx: e, sIdx: t, sessSpec: a, sessData: n, accent: r, upd: s }) {
  const o = n?.completedItems || [],
    c = 100 === (a.items.length > 0 ? Math.round((o.length / a.items.length) * 100) : 0),
    i = MG_TEACHING_NOTES[a.id],
    [l, m] = useState(!1),
    [d, p] = useState(!1);
  return React.createElement(
    "div",
    {
      className: "border rounded-sm overflow-hidden",
      style: { borderColor: c ? "#86efac" : "#e7e5e4", backgroundColor: c ? "#f0fdf4" : "white" },
    },
    React.createElement(
      "div",
      {
        className: "px-3 py-2 flex items-center gap-2 border-b",
        style: { borderColor: c ? "#bbf7d0" : "#e7e5e4" },
      },
      React.createElement(
        "div",
        {
          className:
            "flex-shrink-0 w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold",
          style: { backgroundColor: c ? "#10b981" : r + "20", color: c ? "white" : r },
        },
        c ? "✓" : `${e}.${t}`,
      ),
      React.createElement(
        "div",
        { className: "flex-1 min-w-0" },
        React.createElement(
          "div",
          { className: "flex items-baseline gap-2 flex-wrap" },
          React.createElement("span", { className: "text-sm font-medium text-stone-900" }, a.title),
          React.createElement("span", { className: "text-[10px] text-stone-400 italic" }, a.duration),
        ),
      ),
      React.createElement(
        "span",
        { className: "text-[10px] font-mono text-stone-500" },
        o.length,
        "/",
        a.items.length,
      ),
    ),
    i &&
      React.createElement(
        "div",
        {
          className: "px-3 pt-3 pb-2 space-y-2 border-b",
          style: { borderColor: "#e7e5e4", backgroundColor: "#fafaf9" },
        },
        React.createElement(
          "div",
          { className: "rounded-sm overflow-hidden border-l-4", style: { borderLeftColor: r } },
          React.createElement(
            "button",
            {
              onClick: () => m(!l),
              className:
                "w-full px-2.5 py-1.5 flex items-center justify-between text-left bg-white hover:bg-stone-50 transition-colors",
            },
            React.createElement(
              "span",
              { className: "text-[10px] uppercase tracking-[0.14em] font-bold", style: { color: r } },
              "▸ Manager's playbook for this session",
            ),
            React.createElement(ChevronDown, {
              className: "w-3 h-3 text-stone-400 transition-transform " + (l ? "rotate-180" : ""),
            }),
          ),
          l &&
            React.createElement(
              "div",
              { className: "px-3 py-2.5 bg-white space-y-2.5 text-xs text-stone-800 leading-relaxed" },
              React.createElement("p", null, i.managerScript),
              i.coachingPrompts &&
                React.createElement(
                  "div",
                  null,
                  React.createElement(
                    "div",
                    {
                      className:
                        "text-[10px] uppercase tracking-wider text-stone-500 font-semibold mt-2 mb-1",
                    },
                    "Ask the recruit",
                  ),
                  React.createElement(
                    "ul",
                    { className: "space-y-0.5" },
                    i.coachingPrompts.map((e, t) =>
                      React.createElement(
                        "li",
                        { key: t, className: "flex items-start gap-1.5" },
                        React.createElement("span", { className: "text-stone-400" }, "›"),
                        React.createElement("span", { className: "italic" }, '"', e, '"'),
                      ),
                    ),
                  ),
                ),
              i.watchFor &&
                React.createElement(
                  "div",
                  { className: "px-2.5 py-1.5 rounded-sm bg-rose-50 border-l-2 border-rose-400 mt-2" },
                  React.createElement(
                    "div",
                    { className: "text-[10px] uppercase tracking-wider text-rose-800 font-semibold mb-0.5" },
                    "Watch for",
                  ),
                  React.createElement("p", { className: "text-xs text-rose-900" }, i.watchFor),
                ),
            ),
        ),
        i.recruitContent &&
          React.createElement(
            "div",
            { className: "rounded-sm overflow-hidden border-l-4 border-stone-400" },
            React.createElement(
              "button",
              {
                onClick: () => p(!d),
                className:
                  "w-full px-2.5 py-1.5 flex items-center justify-between text-left bg-white hover:bg-stone-50 transition-colors",
              },
              React.createElement(
                "span",
                { className: "text-[10px] uppercase tracking-[0.14em] font-bold text-stone-700" },
                "▸ What the recruit reads",
              ),
              React.createElement(ChevronDown, {
                className: "w-3 h-3 text-stone-400 transition-transform " + (d ? "rotate-180" : ""),
              }),
            ),
            d &&
              React.createElement(
                "div",
                {
                  className: "px-3 py-2.5 bg-stone-50/70 text-xs text-stone-700 leading-relaxed italic",
                  style: { fontFamily: "Newsreader, Georgia, serif" },
                },
                i.recruitContent,
              ),
          ),
      ),
    React.createElement(
      "div",
      { className: "px-3 py-2 space-y-1" },
      a.items.map((e, t) => {
        const c = `i${t}`,
          i = o.includes(c);
        return React.createElement(
          "label",
          {
            key: c,
            className:
              "flex items-start gap-2 py-1 cursor-pointer hover:bg-stone-50 rounded-sm px-1 -mx-1 transition-colors",
          },
          React.createElement("input", {
            type: "checkbox",
            checked: i,
            onChange: () =>
              ((e) => {
                const t = `i${e}`,
                  r = o.includes(t) ? o.filter((e) => e !== t) : [...o, t];
                (s(["completedItems"], r),
                  r.length !== a.items.length ||
                    n?.completed ||
                    s(["completed"], new Date().toISOString().slice(0, 10)),
                  r.length > 0 && !n?.assigned && s(["assigned"], new Date().toISOString().slice(0, 10)));
              })(t),
            className: "mt-0.5 flex-shrink-0",
            style: { accentColor: r },
          }),
          React.createElement(
            "span",
            {
              className: "text-xs leading-relaxed " + (i ? "text-stone-500 line-through" : "text-stone-800"),
            },
            e,
          ),
        );
      }),
    ),
    React.createElement(
      "div",
      {
        className: "px-3 py-2 grid grid-cols-3 gap-2 border-t bg-stone-50/50",
        style: { borderColor: "#e7e5e4" },
      },
      React.createElement(
        "div",
        null,
        React.createElement(
          "label",
          { className: "block text-[9px] uppercase tracking-wider text-stone-500 mb-0.5" },
          "Date assigned",
        ),
        React.createElement("input", {
          type: "date",
          value: n?.assigned || "",
          onChange: (e) => s(["assigned"], e.target.value),
          className: "w-full text-[10px] px-1.5 py-1 border border-stone-300 rounded-sm bg-white",
        }),
      ),
      React.createElement(
        "div",
        null,
        React.createElement(
          "label",
          { className: "block text-[9px] uppercase tracking-wider text-stone-500 mb-0.5" },
          "Date completed",
        ),
        React.createElement("input", {
          type: "date",
          value: n?.completed || "",
          onChange: (e) => s(["completed"], e.target.value),
          className: "w-full text-[10px] px-1.5 py-1 border border-stone-300 rounded-sm bg-white",
        }),
      ),
      React.createElement(
        "div",
        null,
        React.createElement(
          "label",
          { className: "block text-[9px] uppercase tracking-wider text-stone-500 mb-0.5" },
          "Recruit Pal updated",
        ),
        React.createElement("input", {
          type: "date",
          value: n?.recruitPalUpdated || "",
          onChange: (e) => s(["recruitPalUpdated"], e.target.value),
          className: "w-full text-[10px] px-1.5 py-1 border border-stone-300 rounded-sm bg-white",
        }),
      ),
    ),
    (o.length > 0 || n?.notes) &&
      React.createElement(
        "div",
        { className: "px-3 py-2 border-t", style: { borderColor: "#e7e5e4" } },
        React.createElement("input", {
          type: "text",
          value: n?.notes || "",
          onChange: (e) => s(["notes"], e.target.value),
          placeholder: "Session notes (what stood out, what needs follow-up)",
          className:
            "w-full text-xs px-2 py-1.5 border border-stone-200 rounded-sm bg-white focus:outline-none focus:border-stone-400",
        }),
      ),
  );
}
const DISCOVERY_MODULES = [
    {
      id: "m1",
      title: "A Sales Representative's Week",
      accent: "#2563eb",
      pages: "Manager's Guide pp. 5–13",
      objective:
        "Introduce the candidate to the sales representative role. They observe and discuss what an agent's week actually looks like — including the not-so-enjoyable parts. By the end the candidate can articulate the 7 activities and 9 skills required.",
      managerPrep: [
        "Have Candidate Module Part 1 ready",
        "Have Discussion Conference Guide ready",
        "Block 60 minutes for the kickoff conversation",
        "Bring your own diary / week-at-a-glance to share",
      ],
      sessions: [
        {
          id: "s1_1",
          title: "Discovery kickoff & program orientation",
          duration: "45 min",
          items: [
            "Walk through what Discovery is and how long it takes",
            "Set expectations on candidate time commitment (10–15 hrs/week)",
            "Confirm candidate has GGLDC access",
            "Confirm meeting cadence (weekly minimum)",
            "Set first review date",
          ],
        },
        {
          id: "s1_2",
          title: 'Read & discuss "A Sales Representative\'s Week"',
          duration: "45 min",
          items: [
            "Candidate has read Part 1 of Candidate Module",
            "Discussed daily activity rhythm",
            "Discussed working evenings and weekends",
            "Discussed self-management requirements",
            "Discussed income variability in early months",
          ],
        },
        {
          id: "s1_3",
          title: 'Activity: "Is This Career for You?" Check Yourself',
          duration: "30 min",
          items: [
            "Candidate completed self-assessment",
            "Reviewed answers together",
            "Discussed any red flags or hesitations",
            "Documented candidate's honest reaction",
          ],
        },
        {
          id: "s1_4",
          title: "7 Activities / 9 Skills review",
          duration: "30 min",
          items: [
            "Walked through the 7 core activities",
            "Walked through the 9 required skills",
            "Asked candidate to rate own confidence per skill",
            "Identified top 2 skill gaps",
          ],
        },
      ],
    },
    {
      id: "m2",
      title: "Identifying Markets",
      accent: "#7c3aed",
      pages: "Manager's Guide pp. 14–18",
      objective:
        "Candidate learns that markets are people, not abstract segments. They begin building their natural market list and start Project 100.",
      managerPrep: [
        "Have Candidate Module Part 2 ready",
        "Have a blank Project 100 form available",
        "Bring examples of your own Project 100 from when you started",
      ],
      sessions: [
        {
          id: "s2_1",
          title: 'Read "Markets Are People"',
          duration: "30 min",
          items: [
            "Candidate read Part 2 of Candidate Module",
            "Discussed the concept of natural market",
            "Discussed centers of influence",
            "Discussed why people buy from people they know",
          ],
        },
        {
          id: "s2_2",
          title: "Market Identification activity",
          duration: "60 min",
          items: [
            "Candidate listed 15 source categories",
            "Identified at least 50 potential names",
            "Categorised each name by relationship type",
            "Reviewed list together for completeness",
          ],
        },
        {
          id: "s2_3",
          title: "Begin Project 100",
          duration: "60 min",
          items: [
            "Candidate started Project 100 form",
            "At least 50 names entered",
            "Each name has age band, occupation, marital status",
            "Each name has approachability assessment",
            "Discussed how Project 100 feeds Source Market Surveys",
          ],
        },
        {
          id: "s2_4",
          title: "Discussion Conference: questions/observations",
          duration: "30 min",
          items: [
            "Candidate raised questions on prospecting",
            "Addressed any objections from candidate's family",
            "Confirmed comfort with using personal network",
            "Set Project 100 completion date",
          ],
        },
      ],
    },
    {
      id: "m3",
      title: "Meeting Your Marketplace",
      accent: "#0891b2",
      pages: "Manager's Guide pp. 19–24",
      objective:
        "Candidate moves from theory to action. They contact prospects from their list and run Source Market Surveys — the first real test of their willingness to do the work.",
      managerPrep: [
        "Have Candidate Module Part 3 ready",
        "Have Source Market Survey form digital link ready",
        "Have Meeting Your Marketplace Interview Guide ready",
        "Schedule role-play time",
      ],
      sessions: [
        {
          id: "s3_1",
          title: 'Read "The Business and the Customer"',
          duration: "30 min",
          items: [
            "Candidate read Part 3 of Candidate Module",
            "Discussed customer perspective",
            "Discussed why people resist insurance conversations",
            "Discussed how to neutralise resistance",
          ],
        },
        {
          id: "s3_2",
          title: "Telephone approach role-play",
          duration: "60 min",
          items: [
            "Manager demonstrated phone approach",
            "Candidate practiced 5+ times",
            "Recorded one practice for review",
            "Identified specific phrasing improvements",
          ],
        },
        {
          id: "s3_3",
          title: "Source Market Surveys — execute",
          duration: "Self-paced over 1–2 weeks",
          items: [
            "Candidate completed 10+ surveys",
            "Surveys averaged 50+ score (quality threshold)",
            "No more than 2 surveys with score < 20",
            "All surveys submitted via Jotform",
            "RM reviewed each survey for completeness",
          ],
        },
        {
          id: "s3_4",
          title: "Discussion Conference: what we learned",
          duration: "45 min",
          items: [
            "Reviewed survey patterns together",
            "Identified strongest segments",
            "Identified candidate's natural style",
            "Captured the 5 best prospects for follow-up",
          ],
        },
      ],
    },
    {
      id: "m4",
      title: "Making a Sales Presentation",
      accent: "#059669",
      pages: "Manager's Guide pp. 25–33",
      objective:
        "Candidate observes and then performs basic sales presentations. This is the critical reality test — does the candidate freeze, perform, or thrive?",
      managerPrep: [
        "Have Candidate Module Part 4 ready",
        "Schedule 2+ joint field calls",
        "Have a junior product to use for demo (life coverage)",
        "Have feedback rubric ready",
      ],
      sessions: [
        {
          id: "s4_1",
          title: 'Read "What Do I Say? What Do I Do?"',
          duration: "45 min",
          items: [
            "Candidate read Part 4 of Candidate Module",
            "Discussed the basic sales talk",
            "Discussed handling common objections",
            "Discussed closing language",
          ],
        },
        {
          id: "s4_2",
          title: "Sales talk practice (role-play)",
          duration: "90 min",
          items: [
            "Candidate practiced opening 5+ times",
            "Candidate practiced needs analysis 5+ times",
            "Candidate practiced closing 5+ times",
            "Manager scored each practice",
            "Captured specific coaching points",
          ],
        },
        {
          id: "s4_3",
          title: "Joint field calls (observation)",
          duration: "2–3 hours total",
          items: [
            "Joint call #1 completed (candidate observed)",
            "Joint call #2 completed (candidate observed)",
            "Joint call #3 completed (candidate participated)",
            "Debrief held after each call",
            "Candidate captured their own observations",
          ],
        },
        {
          id: "s4_4",
          title: "Discussion Conference: career decision",
          duration: "60 min",
          items: [
            "Candidate reflected on field call experience",
            "Discussed energy level after each call",
            "Discussed reaction to rejection",
            "Discussed reaction to closed sale",
            "Confirmed candidate's career intent",
          ],
        },
      ],
    },
    {
      id: "m5",
      title: "Making a Career Decision",
      accent: "#d97706",
      pages: "Manager's Guide p. 34",
      objective:
        "Candidate makes a deliberate, informed decision: pursue this career or step away. The Income Potential Analysis is the financial reality check.",
      managerPrep: [
        "Have Income Potential Analysis spreadsheet ready",
        "Have candidate's Personal & Financial Statement",
        "Block 90 minutes for this conversation — do not rush",
      ],
      sessions: [
        {
          id: "s5_1",
          title: "Income Potential Analysis review",
          duration: "60 min",
          items: [
            "Candidate completed Income Potential Analysis",
            "Reviewed Year 1 / Year 2 / Year 3 projections",
            "Discussed income runway needed (6 months minimum)",
            "Discussed family financial obligations",
            "Confirmed runway is in place or has plan",
          ],
        },
        {
          id: "s5_2",
          title: "Career decision conversation",
          duration: "60 min",
          items: [
            "Candidate stated decision (proceed / decline / hold)",
            "Decision documented in writing",
            "If proceed — set Selection File timeline",
            "If decline — captured reason for branch records",
            "If hold — set re-engagement date",
          ],
        },
      ],
    },
    {
      id: "m6",
      title: "Discovery Marketing Plan",
      accent: "#dc2626",
      pages: "Manager's Guide p. 35",
      objective:
        "Candidate produces their Discovery Marketing Plan — the document the BM uses to evaluate readiness for selection.",
      managerPrep: [
        "Have Discovery Marketing Plan template ready",
        "Have Discovery Summary Evaluation form ready",
        "Schedule BM presentation slot",
      ],
      sessions: [
        {
          id: "s6_1",
          title: "Build Discovery Marketing Plan",
          duration: "90 min",
          items: [
            "Source markets ranked by quality",
            "Project 100 finalised",
            "First 30-day prospecting plan written",
            "First 30-day income target set",
            "Joint field call schedule for first 60 days",
          ],
        },
        {
          id: "s6_2",
          title: "Discovery Summary Evaluation (Form 11)",
          duration: "45 min",
          items: [
            "RM completed all 10 evaluation items",
            "Scores discussed with candidate",
            "Strengths and gaps documented",
            "Coaching plan for first 90 days drafted",
            "Form signed and dated",
          ],
        },
        {
          id: "s6_3",
          title: "BM review meeting",
          duration: "45 min",
          items: [
            "BM reviewed Marketing Plan",
            "BM reviewed Discovery Summary Evaluation",
            "BM met candidate (if not done already)",
            "BM decision: proceed to Selection File / Hold / Decline",
            "Decision documented",
          ],
        },
      ],
    },
  ],
  MG_TEACHING_NOTES = {
    s1_1: {
      managerScript:
        "Open by reframing what Discovery is. Most candidates think it's training — it isn't. Discovery is a structured \"test drive\" of the sales career so they can decide whether it suits them, and so you can decide whether they suit it. Tell them: \"Over the next 4–6 weeks you will observe, read, practice, and produce. Some of what you do you will enjoy. Some you won't. Both reactions are useful information.\" Set the cadence: weekly minimum, more often during prospecting and presentation modules. Confirm GGLDC access today — if it isn't working, fix it before they leave the room. Set the first three meeting dates on their calendar before this session ends.",
      recruitContent:
        'You\'re embarking on a short program of Discovery that will make your decision about becoming a sales representative for insurance and other financial products much easier. Research reveals that when candidates have a good understanding of what the sales representative career entails, they have a much better chance of making the right career decision — and if they choose to become sales representatives, they have a much greater likelihood of success. Discovery allows you to "test drive" the career through readings and activities. You will learn about, observe, and actually perform both enjoyable and not-so-enjoyable aspects of the role. By the time you complete Discovery you will know whether this is the right career for you. Good luck.',
      coachingPrompts: [
        "What concerns do you have walking in today?",
        "Who in your life have you discussed this opportunity with?",
        "What do you currently believe a sales representative's week looks like?",
      ],
      watchFor:
        "Candidate hesitates on time commitment. If they cannot block 10–15 hrs/week for Discovery, they cannot do the job. End the conversation respectfully and rebook only if life circumstances change.",
    },
    s1_2: {
      managerScript:
        "Have them read Part 1 of the Candidate Module before the session and bring questions. Walk through the seven activities and nine skills. Show your own diary or week-at-a-glance — the real one, with the messy parts. Talk honestly about working evenings, working weekends, and the income gap before commissions stabilize (typically 4–6 months). The goal of this session is not to sell them on the job — it is to make sure they have an accurate picture before they invest more time. If they look surprised by anything you say, that's the signal to slow down and explore.",
      recruitContent:
        "A sales representative's week is not what most people imagine. The job has seven core activities: prospecting (finding people to talk to), approaching (making contact), fact-finding (understanding need), planning (designing solutions), presenting (showing the recommendation), closing (asking for the decision), and servicing (keeping clients). It demands nine skills: communication, empathy, organization, resilience, numeracy, technology fluency, listening, persuasion, and self-management. The week mixes scheduled appointments with unscheduled prospecting, paperwork, training, and client servicing. Income is commission-based — your effort directly drives your pay, but pay is variable, especially in months one through six.",
      coachingPrompts: [
        "What part of this week sounds hardest for you?",
        "What part sounds most appealing?",
        "How would your family react to evening and weekend work for the first 12 months?",
      ],
      watchFor:
        "Candidate fixates on the appealing parts and skips over the hard parts. If they do not engage with the hard parts honestly in this session, they will not engage with them on the road.",
    },
    s1_3: {
      managerScript:
        'This is the "Is This Career for You?" Check Yourself activity. Have the candidate complete it alone, then review answers together. Pay attention to body language as they answer — a candidate who hesitates on "Are you comfortable approaching strangers?" is telling you something the page doesn\'t capture. If they tick "agree" on every statement, probe — that\'s either disengagement or telling-you-what-you-want-to-hear. Either is a red flag.',
      recruitContent:
        "This activity is for you, not for me. Answer honestly — there are no right answers. Each question maps to a real demand of the job. If you find yourself uncomfortable with several items, that is information worth taking seriously. The questions cover comfort with rejection, persistence under pressure, willingness to ask for the close, comfort with discussing money openly, willingness to learn product detail, and tolerance for variable income. Trust your gut on these. Your honest answers protect both of us from a wrong-fit decision.",
      coachingPrompts: [
        "Which question made you pause longest?",
        "Which answer surprised you?",
        "Is there anything you wrote here you would not say to your spouse?",
      ],
      watchFor:
        'Mismatched answers (e.g. "comfortable with rejection" + "Why now: financial pressure") indicate the candidate is performing rather than reflecting. Push them to be honest.',
    },
    s1_4: {
      managerScript:
        'Walk through the 7 Activities and 9 Skills explicitly. Ask the candidate to rate themselves 1–5 on each skill. Capture the bottom two — these are their development priorities for Discovery and beyond. Be specific. "Communication" is too vague; their gap is probably "asking the close" or "active listening" or "explaining product to non-technical buyer." Identify the two specific gaps and write them down. These will form the spine of the Discovery Marketing Plan in Module 6.',
      recruitContent:
        "The 7 Activities every sales representative must do every week: prospect, approach, fact-find, plan, present, close, service. The 9 Skills required: communication (verbal + written), empathy (reading the room), organization (managing many cases), resilience (handling no), numeracy (math without a calculator), technology (CRM, illustration tools), listening (true listening, not waiting to talk), persuasion (moving someone past hesitation), and self-management (no boss tells you when to start). Rate yourself on each. Be honest. Your weakest two are where Discovery focuses next.",
      coachingPrompts: [
        "Which skill are you strongest in and how do you know?",
        "Which two skills are weakest?",
        "What would have to happen this month for those two to improve?",
      ],
      watchFor:
        "Candidate rates themselves 4–5 on every skill. Either rare genuine strength (verify with examples) or inflated self-image (probe for grounded evidence).",
    },
    s2_1: {
      managerScript:
        'Open by saying "Markets are people" — and then prove it. Tell them: forget industry segments and demographics for a moment. Your first market is the people who would take your phone call. Walk through how relationships of trust become first sales, and how first sales become referrals. The next concept is Centers of Influence (COIs) — people who influence others to buy. A pharmacist, a clergy leader, a respected school principal can each refer dozens. Ask the candidate who they know who fits this profile. Capture the names.',
      recruitContent:
        "Markets Are People. The most common reason new sales representatives fail is not lack of skill — it is lack of people to talk to. Your natural market is the network you already have: family, friends, former colleagues, neighbors, sports teammates, fellow alumni, members of your religious community, your hairdresser, your mechanic. These people already know and trust you, which is the single hardest thing to build from scratch. Centers of Influence (COIs) are individuals whose opinions move others — pharmacists, principals, accountants, religious leaders, doctors. One COI relationship can produce 20+ referrals over a year. Your job in this module is to inventory who you know and identify your top three COIs.",
      coachingPrompts: [
        "List five people you would feel comfortable calling tomorrow.",
        "List five people you know who influence others.",
        "Who in your network have you NEVER thought of as a prospect?",
      ],
      watchFor:
        'Candidate insists they "do not know enough people." Almost always wrong. Push back gently — list family, neighbors, university friends, former colleagues. Most candidates have 200+ names available; they just have not thought about them as prospects.',
    },
    s2_2: {
      managerScript:
        "Hand them the Project 100 form. Their job is 50 names today, 100 by next week. Sit with them for the first 15 names — show them how to mine their phone, their LinkedIn, their address book, their wedding guest list. Each name needs: relationship type, age band (rough), occupation, marital status, approachability rating. The rating is a 1–5 gut check. Don't worry about whether the person needs insurance — almost everyone does. Worry about whether the candidate would feel comfortable starting the conversation.",
      recruitContent:
        "Project 100 is your launchpad. Start with everyone you know and work outward in concentric circles: immediate family, extended family, close friends, casual friends, former classmates, current colleagues, former colleagues, neighbors, service providers (hairdresser, mechanic, doctor), members of any club or organization, parents of your children's friends. For each name capture: name, phone, relationship to you, rough age, occupation if you know it, marital status if you know it. Then rate 1–5 how comfortable you would be calling them tomorrow about your new career. The list of 100 is your inventory of opportunity. You will not call all 100 — but you cannot identify which 30 to call without seeing all 100.",
      coachingPrompts: [
        "Who are you avoiding adding to this list, and why?",
        "Who is on this list whose situation you genuinely do not know (e.g. don't know if married, working, etc)?",
        "Who is the highest-net-worth person on this list?",
      ],
      watchFor:
        "Candidate adds only family. Push for professional contacts, COIs, neighbors. If 80%+ are immediate family, the candidate has not built an independent network and will run out of prospects in 60 days.",
    },
    s2_3: {
      managerScript:
        "Today you finalize Project 100 and explain how it feeds the next module. Tell them: Project 100 is your inventory; Source Market Surveys are how you turn inventory into appointments. Surveys tell us which segments are responding. Each survey gives a 1–100 quality score; the candidate's first 10 surveys must average above 50, with no more than 2 below 20. Any candidate whose first 10 surveys average below 30 will struggle in field — that is the signal we use to course-correct.",
      recruitContent:
        "From Project 100 you will choose your first 30 prospects to approach. The Source Market Survey is the structured way you do that — a script you follow that captures their basic situation while practicing your conversational flow. Each survey scores 0–100 based on completeness and quality of information gathered. Your first 10 surveys must average above 50. This is not arbitrary: candidates who cannot produce 50+ scoring surveys are not yet ready to handle live presentations. The good news: most candidates double their score from survey 1 to survey 5. Practice matters more than natural talent here.",
      coachingPrompts: [
        "Of your top 30 names, which 5 would you call first and why?",
        "Which name are you dreading? What does that tell you?",
      ],
      watchFor:
        "Candidate has Project 100 ranked but cannot articulate WHY a particular name is at the top. Ranking without reasoning means they will not learn from results.",
    },
    s2_4: {
      managerScript:
        'This is the family conversation session. Many promising candidates derail here because their spouse, partner, or parent did not understand what they were getting into. Ask: "Have you discussed this with your spouse? What did they say?" Listen for unease. If the family is not on board with the income variability, the evening calls, the persistence required, the candidate will not last 6 months. If concerns surface, schedule a second meeting that includes the spouse. This is not optional in an insurance career — it is mandatory due diligence.',
      recruitContent:
        "Your family is going to feel this career change before they see the rewards. The first six months will involve: studying for the licensing exam, building Project 100, making prospecting calls (often in the evening), attending training, and earning variable commissions. If the people who depend on you do not understand and support what you are doing, the friction will accumulate and you will quit before the income stabilizes. Have the conversation. Be specific about hours, about money, about what you need from them. If they have concerns, your manager will meet with them too.",
      coachingPrompts: [
        "When did you last talk to your spouse/partner about this career?",
        "What is their biggest concern?",
        "Are they prepared for 4-6 months of variable income?",
      ],
      watchFor:
        'Vague answers about family support. "They\'re fine with it" without specifics often means the conversation has not really happened. Push for detail.',
    },
    s3_1: {
      managerScript:
        "This module shifts from theory to action. Read \"The Business and the Customer\" together with the candidate. The core idea: customers don't buy insurance; they buy what insurance does for them. Walk through the four classic customer concerns: protecting income if they die, protecting income if they get sick, replacing income at retirement, and growing wealth. Every product they will sell maps to one of these four. Today's job is to make sure the candidate can articulate each concern in the customer's language, not in product jargon.",
      recruitContent:
        'The Business and the Customer. Customers do not buy insurance products. They buy peace of mind, income protection, and the ability to provide for the people they love when they cannot. The four core customer concerns: (1) "What if I die before I finish providing for my family?" — life insurance. (2) "What if I get sick and cannot work?" — critical illness, disability income. (3) "What if I outlive my savings?" — retirement income, annuities. (4) "How do I grow wealth steadily?" — investment-linked products. Your job is not to sell features. Your job is to listen for which concern is alive in the customer\'s life and offer the solution that addresses it. The product is the answer to a worry the customer already has.',
      coachingPrompts: [
        "Pick one of the four concerns. Explain it in plain language as if to your aunt.",
        "Which of the four concerns is alive in your own life right now?",
        "Why does explaining product features rarely close a sale?",
      ],
      watchFor:
        'Candidate uses product jargon ("term to 65", "WPB rider") in conversation. Brand new candidates do this to feel competent — but it loses customers. Coach them out of it.',
    },
    s3_2: {
      managerScript:
        "Demonstrate the phone approach yourself first. Use a real prospect from your own pipeline (or simulate one). Show how to: open warmly, state purpose simply, ask permission to ask, close on a meeting time. Then have the candidate practice 5 times. Record one practice on your phone and play it back together. Most candidates' first three attempts are awful — that is normal. By attempt 5 they should be measurably tighter. Capture the exact phrasing improvements that worked.",
      recruitContent:
        'The Phone Approach. The phone call is the first test of whether you can move someone from "passive contact" to "scheduled appointment." It is a 90-second conversation: greeting (10s), purpose (20s), permission to ask (10s), benefit statement (15s), appointment ask (15s), confirmation (20s). Practice this until it sounds natural, not scripted. The most common failure modes: rushing through the purpose, apologizing for calling, asking yes/no questions ("Can I meet with you?" — answer is usually no) instead of choice questions ("Would Tuesday at 3 or Thursday at 5 work better?"). The choice question converts at 3–4x the rate of the yes/no question.',
      coachingPrompts: [
        "What did you hear when you played back the recording?",
        "Which sentence in your approach felt most natural? Most awkward?",
        "How will you adjust on your next call?",
      ],
      watchFor:
        "Candidate refuses to record themselves. Almost always means they know they are not yet good and are afraid to confront it. Insist gently — the recording is the fastest learning tool available.",
    },
    s3_3: {
      managerScript:
        "The candidate now executes Source Market Surveys at pace. Goal: 10+ surveys in 1–2 weeks, average score 50+. Review every survey within 24 hours. Surveys with score <20 are a coaching opportunity — go through what was missing and have them re-do it. Patterns matter more than individual scores: if their surveys cluster in one segment (e.g. all family, all young professionals), they are not yet diversifying their pipeline.",
      recruitContent:
        "Survey execution week. Run the structured Source Market Survey on at least 10 prospects. Submit each via Jotform. Your manager will review and score. The score is not a grade — it is feedback on how complete and useful the conversation was. A 70+ score means you gathered enough to design a recommendation. A score below 30 means the prospect is not yet a real prospect; you need more information. Track which segments respond well to you and which do not — this is your actual market emerging from the data.",
      coachingPrompts: [
        "Which survey was your best? What made it work?",
        "Which segment is responding best to your style?",
        "Where in the script are prospects pushing back?",
      ],
      watchFor:
        "14+ days pass with fewer than 5 surveys submitted. This is the single highest-correlation predictor of failure in Year 1. Intervene immediately.",
    },
    s3_4: {
      managerScript:
        "Aggregate the survey results with the candidate. Look for patterns: which segments scored highest, which questions consistently got the best responses, which prospects asked for follow-up. From this discussion, identify the 5 strongest follow-up prospects — these become the candidates for the first sales presentations in Module 4. The candidate should leave this session with appointments booked, not just a list.",
      recruitContent:
        'What did the surveys teach you? Look at your scores together. Look for which segments engaged most. Look for the prospects who asked questions about products, who expressed concerns, who asked you to "come back when you know more" — those last ones are real prospects in waiting. Identify the 5 you will book for a sales presentation. Book the appointments before you leave this session — momentum dies quickly between Discovery and first presentation.',
      coachingPrompts: [
        "Of your 10 surveys, which 5 are most likely to buy in the next 60 days?",
        "Of those 5, which appointment have you not yet booked? Why?",
      ],
      watchFor:
        "Candidate has good surveys but no booked follow-ups. They are afraid of the next conversation. This is the same fear that kills careers in months 4–6.",
    },
    s4_1: {
      managerScript:
        'Read Part 4 of the Candidate Module — "What Do I Say? What Do I Do?" — together. The basic Sales Talk has four stages: warm opener, needs analysis (questions, lots of them), recommendation (only after needs are clear), close (asking for the decision). Walk the candidate through each stage. Then the harder topic: handling objections. Most objections are not objections; they are concerns that the customer hasn\'t seen addressed. Teach the candidate to repeat the concern back ("What I am hearing is you\'re worried about..."), validate it, and then offer the specific addressing. Objections are signals of engagement, not rejection.',
      recruitContent:
        "What Do I Say? What Do I Do? The Sales Talk has four parts: (1) Warm opener — re-establish rapport, state purpose, ask permission to proceed. (2) Needs analysis — ask questions until you genuinely understand the customer's situation. Most new representatives skip this and lose the sale. (3) Recommendation — only after needs are clear, offer the solution, in plain language, anchored to a benefit they already told you they care about. (4) Close — ask for the decision. The most common close: \"Based on what you've told me, this looks like a good fit. Are you ready to start the protection?\" Objections are not rejections — they are signals the customer is engaged but unsure. Address them by listening, summarizing, then answering specifically.",
      coachingPrompts: [
        "Which of the four stages will be hardest for you?",
        "What objection scares you most? Let's practice it.",
      ],
      watchFor:
        "Candidate wants to skip needs analysis and go straight to product. Most common rookie mistake. Drill this until it changes.",
    },
    s4_2: {
      managerScript:
        "Role-play time. You play the customer; the candidate plays themselves. Run the full Sales Talk three times: once with an easy customer, once with a customer who has objections, once with a customer who tries to redirect the conversation. After each run, score on: opener (1–5), needs questions asked (count), recommendation clarity (1–5), close attempted (yes/no). Most candidates need 5+ repetitions before the rhythm clicks. Be patient. Be specific in feedback.",
      recruitContent:
        "Today you practice the full Sales Talk with your manager three times. Treat it as serious as live. Your manager will play the customer in three modes: receptive, skeptical, and distracted. After each run you'll get feedback on opener, questioning, recommendation clarity, and whether you actually attempted to close. Most new representatives forget to ask for the decision — they walk out hoping the customer will call back. They almost never do. The close is uncomfortable; do it anyway.",
      coachingPrompts: [
        "Which of the three runs felt most natural?",
        "Where did you freeze? What were you afraid of?",
      ],
      watchFor:
        "Candidate refuses to attempt the close in role-play. Same candidate will refuse to close in field. Coach this hard.",
    },
    s4_3: {
      managerScript:
        "Take the candidate on three live joint calls. First call: candidate observes only. Second: candidate observes and contributes one section (typically the warm opener). Third: candidate runs the bulk of the conversation with you supporting. Debrief immediately after each call — within 15 minutes, while it is fresh. Capture what worked, what didn't, what they would change. The third call is the leading indicator of Year 1 success: candidates who can run 70%+ of a real conversation by their third joint call almost always make it.",
      recruitContent:
        "Joint Field Calls. You will accompany your manager on three real customer meetings. Call 1: you watch and listen. Pay attention to how questions are asked, how silence is used, how objections are met. Call 2: you contribute one section — usually the opener — under your manager's supervision. Call 3: you run the bulk of the conversation with your manager backing you up. Debrief immediately after each call while memory is fresh. These three calls compress months of learning into a week.",
      coachingPrompts: [
        "What surprised you about the first call?",
        "What did you do differently in your section vs how you practiced?",
        "Was the customer's reaction what you expected?",
      ],
      watchFor:
        "Candidate freezes in call 3 and you have to take over fully. Not necessarily disqualifying — but extend Discovery by two weeks and run two more practice rounds before Module 5.",
    },
    s4_4: {
      managerScript:
        'This is the gut-check session. After three joint calls, the candidate has real evidence about whether this work suits them. Ask the hard questions directly: "How did you feel after each call? Energized or drained? Did rejection sting more than the close excited you?" Their answers here matter more than their POP score, more than their resume. If they walk out of three field calls with a fundamentally negative emotional response, the career will not work for them — and it is kinder to surface that now than to have them learn it after 18 months of struggle.',
      recruitContent:
        "Three live calls give you data your inner voice cannot ignore. Reflect on: (1) Energy — did the calls leave you energized or exhausted? Both reactions are normal in the first week, but a pattern of exhaustion across all three is significant. (2) Rejection — when the customer pushed back, what did you feel? Curiosity is good. Defensiveness or hurt are signals to discuss. (3) Closing — when a sale closed, what did you feel? Pride and energy are good. Discomfort or guilt are signals worth understanding. Be honest about your reactions — they are the strongest signal you have about whether this work is right for you.",
      coachingPrompts: [
        "After all three calls, are you more or less interested than when we started?",
        "What part of the work would you want more of?",
        "What part would you want less of?",
      ],
      watchFor:
        "Candidate is enthusiastic in conversation but has not booked any follow-up appointments themselves. Talk does not equal commitment. Look at the calendar.",
    },
    s5_1: {
      managerScript:
        'Run the Income Potential Analysis spreadsheet with the candidate sitting beside you. Use realistic, conservative numbers — Year 1 commissions in the $40–60k range for a strong producer, $20–30k for an average one. Walk through their household budget honestly. The question is not "can you live on Year 1 income" — it is "do you have a runway of 6+ months to cover the gap while production builds?" Many otherwise-capable candidates fail because they underestimate the runway needed. This session prevents that failure.',
      recruitContent:
        'The Income Potential Analysis is your financial reality check. Together with your manager you will project Year 1, Year 2, and Year 3 commission income based on realistic assumptions for your branch and unit. Then you\'ll layer in your actual household expenses. The math will tell you whether you can sustain a 4-6 month runway while production stabilizes. If you cannot, the answer is not "give up" — it is "build the runway first, start the career second." Many of our most successful representatives delayed their start by three months to build savings; almost all of those who skipped that step quit within the first year.',
      coachingPrompts: [
        "What is your monthly minimum spend including all obligations?",
        "How many months can you operate at zero commission income?",
        "What changes in your household if you start in 60 days vs 6 months?",
      ],
      watchFor:
        'Candidate dismisses the analysis as "I will just work harder." Effort doesn\'t change runway math. Runway math is non-negotiable.',
    },
    s5_2: {
      managerScript:
        'The decision conversation. Block 60 minutes — this cannot be rushed. Ask the candidate explicitly: "After everything you have seen and done in Discovery, do you want to proceed?" Three answers: yes, no, "I need more time." Each is legitimate. If yes, set the Selection File timeline. If no, capture the reason — this is data we use to improve recruiting. If "more time," set a re-engagement date and stop the process for now. The worst outcome is a half-yes that becomes a six-month struggle followed by a quit.',
      recruitContent:
        "This is your career decision moment. After observing, reading, practicing, and producing in Discovery, you now have enough information to decide deliberately. The three honest answers: (1) Yes — I want to proceed and build a sales career here. (2) No — this is not the right fit for me. (3) I need more time — I want to consider further before committing. All three are respected. The worst answer is a polite yes that becomes resentment six months in. Be honest with yourself first, then with your manager.",
      coachingPrompts: [
        "On a scale of 1–10, how convinced are you?",
        "What would have to be true for you to be a 9 or 10?",
        "What would have to be true for you to walk away?",
      ],
      watchFor:
        "Hesitant yes. The body language tells the truth even when the words don't. If the yes is hesitant, push for the real answer.",
    },
    s6_1: {
      managerScript:
        "The Discovery Marketing Plan is the candidate's first real business plan. It contains: ranked source markets, finalized Project 100, first 30-day prospecting plan, first 30-day income target, joint field call schedule for first 60 days. Sit with the candidate and build it together. They drive the typing; you challenge the assumptions. By the end of the session, the plan should be specific enough that anyone reading it could execute it on day one.",
      recruitContent:
        "Your Discovery Marketing Plan is your first business plan as a sales representative. It is not a wish list — it is a specific operating plan for your first 30 days post-license. It contains: (1) Your top 3 source markets ranked by quality and accessibility. (2) Your final Project 100 list. (3) Your week-by-week prospecting plan for the first 30 days — how many calls, how many appointments, how many presentations. (4) Your income target — be honest about what is achievable in month 1, month 2, month 3. (5) Your joint call schedule with your manager for the first 60 days — book the dates now while you have momentum.",
      coachingPrompts: [
        "Walk me through week 1 day-by-day.",
        "What happens if your first 10 calls don't book?",
        "Which week is most likely to derail you?",
      ],
      watchFor:
        "Plan is generic and could apply to any candidate. Push for specifics — names, dates, dollar targets. A vague plan is a plan that won't happen.",
    },
    s6_2: {
      managerScript:
        "The Discovery Summary Evaluation (Form 11) is your formal record of how the candidate performed across Discovery. Score all 10 items 1–7. Be honest, not generous. Inflated scores here lead to under-coached representatives in Induction. Discuss each score with the candidate so they understand where they stand. Document the top 2 strengths and top 2 development areas. These feed directly into the first 90-day coaching plan in Induction.",
      recruitContent:
        "The Discovery Summary Evaluation is the formal record of your performance across Discovery. Your manager scores 10 areas on a 1–7 scale. The scores are not grades — they are baselines. Your strengths show where to lead from. Your development areas show where coaching focuses in your first 90 days. Sit with your manager as they walk through the scores. Ask why each was given. Disagree if you genuinely disagree — but understand that the scores represent observed behavior across all of Discovery, not just one moment.",
      coachingPrompts: [
        "Which score surprised you?",
        "Which strength can you build on immediately?",
        "Which development area scares you most?",
      ],
      watchFor:
        "Defensiveness when scores are reviewed. Candidates who cannot accept honest feedback during Discovery will not accept it during Induction either, where stakes are higher.",
    },
    s6_3: {
      managerScript:
        'BM review meeting. The Branch Manager reads the Marketing Plan and the Discovery Summary Evaluation, meets the candidate (if not already), and renders a decision: proceed to Selection File, hold for additional Discovery work, or decline. Document the decision in writing immediately. If "proceed," the BM also confirms which RM will continue as the candidate\'s manager into Induction.',
      recruitContent:
        "Your final Discovery meeting. The Branch Manager reviews your Marketing Plan and Discovery Summary Evaluation. The BM may ask you direct questions about your plans, your concerns, your readiness. The BM's decision is one of three: (1) Proceed — you move into the Selection File and toward contract. (2) Hold — there is one more piece of work to do before proceeding. (3) Decline — the fit is not right at this time. All three outcomes are legitimate. If you proceed, congratulations — your real career begins next.",
      coachingPrompts: [
        "What questions do you have for the BM?",
        "What concerns would you raise in this meeting?",
      ],
      watchFor:
        "BM and RM disagree on readiness. Have that conversation BEFORE the candidate meeting, not after.",
    },
  };
function moduleProgress(e, t) {
  const a = t.sessions.reduce((e, t) => e + t.items.length, 0);
  let n = 0,
    r = 0;
  for (const a of t.sessions) {
    const t = e?.sessions?.[a.id];
    if (!t) continue;
    const s = (t.completedItems || []).length;
    ((n += s), s === a.items.length && a.items.length > 0 && r++);
  }
  return {
    totalItems: a,
    doneItems: n,
    pct: a > 0 ? Math.round((n / a) * 100) : 0,
    sessionsComplete: r,
    totalSessions: t.sessions.length,
  };
}
const DSE_ITEMS = [
  ["i1", "Understanding the sales representative's job"],
  ["i2", "Acceptance of the job requirements"],
  ["i3", "Completion of Project 100"],
  ["i4", "Identification of potential markets"],
  ["i5", "Skill in learning telephone approach"],
  ["i6", "Ability to set up appointments"],
  ["i7", "Skill in asking and securing referred leads"],
  ["i8", "Skill in learning sales talk"],
  ["i9", "Emotional reaction to sales call"],
  ["i10", "Understanding activity level required"],
];
function DiscoverySummaryEvalCard({ data: e, upd: t }) {
  const a = DSE_ITEMS.reduce((t, [a]) => t + (Number(e?.ratings?.[a]) || 0), 0),
    n = DSE_ITEMS.filter(([t]) => e?.ratings?.[t]).length > 0 ? a / 10 : 0;
  return React.createElement(
    Section,
    { title: "Discovery Summary Evaluation", subtitle: "Form #11 · 10 items × 1-7 scale" },
    React.createElement(
      Grid,
      { cols: 2 },
      React.createElement(TextInput, {
        label: "Trainer's name",
        value: e?.trainerName,
        onChange: (e) => t(["trainerName"], e),
      }),
      React.createElement(TextInput, {
        label: "Date",
        type: "date",
        value: e?.date,
        onChange: (e) => t(["date"], e),
      }),
    ),
    React.createElement(
      "div",
      { className: "mt-4 border border-stone-200 rounded-sm p-3 bg-white" },
      DSE_ITEMS.map(([a, n]) => {
        const r = e?.ratings?.[a];
        return React.createElement(
          "div",
          { key: a },
          React.createElement(
            "div",
            {
              className:
                "flex items-center justify-between gap-3 py-2.5 border-b border-stone-200/70 last:border-b-0",
            },
            React.createElement("span", { className: "text-sm text-stone-700 flex-1" }, n),
            React.createElement(
              "select",
              {
                className: "w-44 px-2 py-1.5 text-xs border border-stone-300 rounded-sm bg-white",
                value: r || "",
                onChange: (e) => t(["ratings", a], e.target.value),
              },
              React.createElement("option", { value: "" }, "—"),
              [1, 2, 3, 4, 5, 6, 7].map((e) =>
                React.createElement(
                  "option",
                  { key: e, value: e },
                  e,
                  " — ",
                  ["Unsatisfactory", "Poor", "Below avg", "Average", "Above avg", "Very good", "Excellent"][
                    e - 1
                  ],
                ),
              ),
            ),
          ),
          r &&
            React.createElement(
              "div",
              { className: "pl-2 pr-1 pb-2" },
              React.createElement(TextInput, {
                value: e?.comments?.[a],
                onChange: (e) => t(["comments", a], e),
                placeholder: "Comment",
              }),
            ),
        );
      }),
    ),
    React.createElement(
      "div",
      { className: "mt-4 grid gap-3 md:grid-cols-2" },
      React.createElement(ReadoutBox, { label: "Total rating", value: a }),
      React.createElement(ReadoutBox, { label: "Average (÷ 10)", value: n.toFixed(1) }),
    ),
  );
}
function MarketSurveysCard({ surveys: e, upd: t }) {
  const [a, n] = useState(!1),
    [r, s] = useState(null),
    [o, c] = useState(""),
    i = useMemo(() => {
      const t = { under_25: 0, "25_50": 0, "50_85": 0, "85_120": 0, over_120: 0 },
        a = { Easily: 0, "Fairly easily": 0, "With difficulty": 0, "Probably not": 0 };
      let n = 0,
        r = 0;
      return (
        e.forEach((e) => {
          if (e.incomeRange) {
            t[e.incomeRange] = (t[e.incomeRange] || 0) + 1;
            const a = MS_INCOME.find((t) => t[0] === e.incomeRange);
            a && ((n += a[2]), r++);
          }
          e.couldApproach && (a[e.couldApproach] = (a[e.couldApproach] || 0) + 1);
        }),
        { counts: t, approach: a, totalIncome: n, avg: r > 0 ? n / r : 0, total: e.length }
      );
    }, [e]),
    l = useMemo(() => {
      if (!o) return e;
      const t = o.toLowerCase();
      return e.filter((e) =>
        `${e.prospectFirstName} ${e.prospectLastName} ${e.source} ${e.occupation}`.toLowerCase().includes(t),
      );
    }, [e, o]);
  return React.createElement(
    Section,
    {
      title: "Market Surveys → Project 100",
      subtitle: `${e.length} of 100 prospects · Auto-builds Project 100 from this list`,
      defaultOpen: !0,
    },
    React.createElement(
      "div",
      { className: "mb-4 p-5 border border-stone-300 rounded-sm bg-gradient-to-br from-stone-50 to-white" },
      React.createElement(
        "div",
        { className: "flex items-center gap-5 flex-wrap" },
        React.createElement(
          "div",
          { className: "flex-shrink-0" },
          React.createElement(RadialProgress, {
            value: e.length,
            max: 100,
            size: 90,
            stroke: 7,
            tone: e.length >= 100 ? "emerald" : e.length >= 50 ? "amber" : "navy",
          }),
          React.createElement(
            "div",
            {
              className: "text-[10px] uppercase tracking-wider text-stone-500 text-center mt-1 font-semibold",
            },
            "Project 100",
          ),
        ),
        React.createElement(
          "div",
          { className: "flex-1 min-w-[200px]" },
          React.createElement(
            "div",
            { className: "text-[11px] uppercase tracking-[0.14em] text-stone-500 font-medium" },
            "Build progress",
          ),
          React.createElement(
            "div",
            { className: "font-serif text-3xl text-stone-900 mt-1" },
            e.length,
            " ",
            React.createElement("span", { className: "text-lg text-stone-400" }, "/ 100 prospects"),
          ),
          React.createElement(
            "div",
            { className: "mt-3" },
            React.createElement(LinearBar, {
              value: e.length,
              max: 100,
              height: 6,
              tone: e.length >= 100 ? "emerald" : e.length >= 50 ? "amber" : "navy",
            }),
            React.createElement(
              "div",
              { className: "flex justify-between text-[10px] text-stone-500 mt-1 font-mono" },
              React.createElement("span", null, "0"),
              React.createElement("span", null, "10 (min)"),
              React.createElement("span", null, "50"),
              React.createElement("span", null, "100 (target)"),
            ),
          ),
          e.length < 10 &&
            React.createElement(
              "div",
              { className: "mt-3 text-xs text-amber-700 inline-flex items-center gap-1.5" },
              React.createElement(AlertTriangle, { className: "w-3.5 h-3.5" }),
              " Below 10-prospect minimum to validate Project 100",
            ),
          e.length >= 10 &&
            e.length < 100 &&
            React.createElement(
              "div",
              { className: "mt-3 text-xs text-stone-600" },
              100 - e.length,
              " more prospects needed to complete Project 100",
            ),
          e.length >= 100 &&
            React.createElement(
              "div",
              { className: "mt-3 text-xs text-emerald-700 inline-flex items-center gap-1.5" },
              React.createElement(CheckCircle2, { className: "w-3.5 h-3.5" }),
              " Project 100 target met",
            ),
        ),
      ),
    ),
    React.createElement(
      "div",
      { className: "grid gap-3 md:grid-cols-3 mb-4" },
      React.createElement(StatBlock, {
        icon: TrendingUp,
        label: "Avg annual income",
        value: `$${Math.round(i.avg).toLocaleString()}`,
        sublabel: "per prospect",
        tone: "navy",
      }),
      React.createElement(StatBlock, {
        icon: CheckCircle2,
        label: "Approachable",
        value: (i.approach.Easily || 0) + (i.approach["Fairly easily"] || 0),
        sublabel: "easily + fairly easily",
        tone: "emerald",
      }),
      React.createElement(StatBlock, {
        icon: Target,
        label: "Premium prospects",
        value: (i.counts["85_120"] || 0) + (i.counts.over_120 || 0),
        sublabel: "$85k+ annual income",
        tone: "amber",
      }),
    ),
    React.createElement(
      "div",
      { className: "border border-stone-300 rounded-sm bg-white p-4 mb-4" },
      React.createElement(
        "div",
        { className: "text-[11px] uppercase tracking-[0.14em] text-stone-500 mb-3 font-medium" },
        "Income bracket distribution",
      ),
      React.createElement(
        "div",
        { className: "space-y-2.5" },
        MS_INCOME.map(([t, a]) => {
          const n = i.counts[t] || 0,
            r = Math.max(...Object.values(i.counts), 1),
            s = e.length > 0 ? (n / e.length) * 100 : 0;
          return React.createElement(
            "div",
            { key: t, className: "flex items-center gap-3" },
            React.createElement("div", { className: "w-32 text-xs text-stone-700 flex-shrink-0" }, a),
            React.createElement(
              "div",
              { className: "flex-1 relative h-5 bg-stone-100 rounded-sm overflow-hidden" },
              React.createElement(
                "div",
                {
                  className:
                    "absolute inset-y-0 left-0 transition-all duration-700 rounded-sm flex items-center px-2",
                  style: { width: n > 0 ? (n / r) * 100 + "%" : "0", backgroundColor: "#07131f" },
                },
                n > 0 &&
                  React.createElement(
                    "span",
                    { className: "text-[10px] text-white font-mono font-semibold" },
                    n,
                  ),
              ),
            ),
            React.createElement(
              "div",
              { className: "w-16 text-right text-xs text-stone-500 font-mono flex-shrink-0" },
              s.toFixed(0),
              "%",
            ),
          );
        }),
      ),
    ),
    React.createElement(
      "div",
      { className: "border border-stone-300 rounded-sm bg-white p-4 mb-4" },
      React.createElement(
        "div",
        { className: "text-[11px] uppercase tracking-[0.14em] text-stone-500 mb-3 font-medium" },
        "Approachability",
      ),
      React.createElement(
        "div",
        { className: "grid gap-2 grid-cols-2 md:grid-cols-4" },
        MS_APPROACH.map((e) => {
          const t = i.approach[e] || 0,
            a =
              "Easily" === e
                ? "emerald"
                : "Fairly easily" === e
                  ? "navy"
                  : "With difficulty" === e
                    ? "amber"
                    : "rose";
          return React.createElement(
            "div",
            { key: e, className: "px-3 py-2 border border-stone-200 rounded-sm" },
            React.createElement(
              "div",
              { className: "text-[10px] uppercase tracking-wider text-stone-500" },
              e,
            ),
            React.createElement(
              "div",
              {
                className: "font-serif text-2xl mt-0.5",
                style: {
                  color:
                    "emerald" === a
                      ? "#15803d"
                      : "navy" === a
                        ? "#07131f"
                        : "amber" === a
                          ? "#d97706"
                          : "#9f1239",
                },
              },
              t,
            ),
          );
        }),
      ),
    ),
    React.createElement(
      "div",
      { className: "flex items-center justify-between gap-3 mb-3" },
      React.createElement(
        "div",
        { className: "flex-1 max-w-sm" },
        React.createElement("input", {
          className: inputCls,
          placeholder: "Search prospects…",
          value: o,
          onChange: (e) => c(e.target.value),
        }),
      ),
      React.createElement(
        "button",
        {
          onClick: () => {
            (s(blankMarketSurvey()), n(!0));
          },
          className:
            "inline-flex items-center gap-1.5 px-3 py-2 text-xs uppercase tracking-wider bg-stone-900 text-stone-50 rounded-sm hover:bg-stone-700 transition-colors",
        },
        React.createElement(Plus, { className: "w-3.5 h-3.5" }),
        " Add prospect",
      ),
    ),
    0 === l.length
      ? React.createElement(
          "div",
          {
            className:
              "px-6 py-12 text-center text-stone-500 border border-dashed border-stone-300 rounded-sm",
          },
          0 === e.length
            ? React.createElement(
                React.Fragment,
                null,
                React.createElement(Target, { className: "w-8 h-8 mx-auto mb-3 opacity-50" }),
                React.createElement(
                  "div",
                  { className: "text-sm" },
                  "No prospects yet. Add the first market survey to start building Project 100.",
                ),
              )
            : "No prospects match that search.",
        )
      : React.createElement(
          "div",
          { className: "space-y-1.5" },
          l.map((a) => {
            const r = MS_INCOME.find((e) => e[0] === a.incomeRange);
            return React.createElement(
              "div",
              {
                key: a.id,
                className:
                  "flex items-center gap-3 px-3 py-2 bg-white border border-stone-200 rounded-sm hover:border-stone-400 transition-colors",
              },
              React.createElement(
                "button",
                {
                  onClick: () =>
                    ((e) => {
                      (s(e), n(!0));
                    })(a),
                  className: "flex-1 text-left",
                },
                React.createElement(
                  "div",
                  { className: "font-medium text-stone-900 text-sm" },
                  a.prospectFirstName,
                  " ",
                  a.prospectLastName ||
                    React.createElement("span", { className: "text-stone-400 italic" }, "(no name)"),
                ),
                React.createElement(
                  "div",
                  { className: "text-xs text-stone-500 mt-0.5" },
                  a.source &&
                    React.createElement(
                      "span",
                      { className: "mr-3" },
                      MS_SOURCES.find((e) => e[0] === a.source)?.[1] || a.source,
                    ),
                  r && React.createElement("span", { className: "mr-3" }, r[1]),
                  a.couldApproach && React.createElement("span", { className: "mr-3" }, a.couldApproach),
                ),
              ),
              React.createElement(
                "button",
                {
                  onClick: () => {
                    return ((n = a.id), t(e.filter((e) => e.id !== n)));
                    var n;
                  },
                  className: "text-stone-400 hover:text-rose-700 transition-colors",
                },
                React.createElement(Trash2, { className: "w-4 h-4" }),
              ),
            );
          }),
        ),
    a &&
      r &&
      React.createElement(MarketSurveyDialog, {
        survey: r,
        onSave: (a) => {
          const r = e.find((e) => e.id === a.id);
          (t(r ? e.map((e) => (e.id === a.id ? a : e)) : [...e, a]), n(!1), s(null));
        },
        onCancel: () => {
          (n(!1), s(null));
        },
      }),
  );
}
function MarketSurveyDialog({ survey: e, onSave: t, onCancel: a }) {
  const [n, r] = useState(e),
    s = (e, t) => r({ ...n, [e]: t });
  return React.createElement(
    "div",
    { className: "fixed inset-0 z-50 flex items-center justify-center p-4 bg-stone-900/40 backdrop-blur-sm" },
    React.createElement(
      "div",
      {
        className:
          "bg-white border border-stone-300 rounded-sm shadow-2xl max-w-3xl w-full max-h-[90vh] overflow-auto",
      },
      React.createElement(
        "div",
        {
          className:
            "sticky top-0 bg-white border-b border-stone-200 px-6 py-4 flex items-center justify-between",
        },
        React.createElement(
          "h3",
          { className: "font-serif text-lg text-stone-900" },
          "Market Survey · Prospect",
        ),
        React.createElement(
          "button",
          { onClick: a, className: "text-stone-400 hover:text-stone-700" },
          React.createElement(X, { className: "w-5 h-5" }),
        ),
      ),
      React.createElement(
        "div",
        { className: "p-6 space-y-4" },
        React.createElement(
          Grid,
          { cols: 2 },
          React.createElement(TextInput, {
            label: "First name",
            value: n.prospectFirstName,
            onChange: (e) => s("prospectFirstName", e),
          }),
          React.createElement(TextInput, {
            label: "Last name",
            value: n.prospectLastName,
            onChange: (e) => s("prospectLastName", e),
          }),
          React.createElement(TextInput, {
            label: "Email",
            type: "email",
            value: n.email,
            onChange: (e) => s("email", e),
          }),
          React.createElement(Select, {
            label: "Source of prospect",
            value: n.source,
            onChange: (e) => s("source", e),
            options: MS_SOURCES.map(([e, t]) => [e, t, `${e}. ${t}`]),
          }),
        ),
        React.createElement(Divider, { label: "Demographics" }),
        React.createElement(
          Grid,
          { cols: 2 },
          React.createElement(Select, {
            label: "Yearly income",
            value: n.incomeRange,
            onChange: (e) => s("incomeRange", e),
            options: MS_INCOME.map(([e, t]) => [e, t]),
          }),
          React.createElement(Select, {
            label: "Age band",
            value: n.ageBand,
            onChange: (e) => s("ageBand", e),
            options: MS_AGE,
          }),
          React.createElement(Select, {
            label: "Occupation",
            value: n.occupation,
            onChange: (e) => s("occupation", e),
            options: MS_OCC,
          }),
          React.createElement(Select, {
            label: "Marital status",
            value: n.maritalStatus,
            onChange: (e) => s("maritalStatus", e),
            options: MS_MARITAL,
          }),
        ),
        React.createElement(Divider, { label: "Relationship" }),
        React.createElement(
          Grid,
          { cols: 2 },
          React.createElement(Select, {
            label: "Length of time known",
            value: n.timeKnown,
            onChange: (e) => s("timeKnown", e),
            options: MS_TIME,
          }),
          React.createElement(Select, {
            label: "How well known",
            value: n.howWellKnown,
            onChange: (e) => s("howWellKnown", e),
            options: MS_KNOWN,
          }),
          React.createElement(Select, {
            label: "How often seen in last year",
            value: n.howOftenSeen,
            onChange: (e) => s("howOftenSeen", e),
            options: MS_SEEN,
          }),
          React.createElement(Select, {
            label: "Could be approached on business",
            value: n.couldApproach,
            onChange: (e) => s("couldApproach", e),
            options: MS_APPROACH,
          }),
          React.createElement(Select, {
            label: "Ability to provide referrals",
            value: n.abilityRefer,
            onChange: (e) => s("abilityRefer", e),
            options: MS_REFER,
          }),
        ),
      ),
      React.createElement(
        "div",
        {
          className:
            "sticky bottom-0 bg-white border-t border-stone-200 px-6 py-4 flex items-center justify-end gap-2",
        },
        React.createElement(
          "button",
          { onClick: a, className: "px-4 py-2 text-sm text-stone-700 hover:text-stone-900" },
          "Cancel",
        ),
        React.createElement(
          "button",
          {
            onClick: () => t(n),
            className:
              "px-4 py-2 text-sm bg-stone-900 text-stone-50 rounded-sm hover:bg-stone-700 transition-colors",
          },
          "Save prospect",
        ),
      ),
    ),
  );
}
function SelectionFileStage({ candidate: e, persist: t }) {
  const a = e.stages.selectionFile,
    n = e.stages.discovery,
    r = (e, a) => t((t) => setPath(t, ["stages", "selectionFile", ...e], a));
  return (
    useEffect(() => {
      const e = n.marketSurveys || [];
      e.length > 0 && (!a.selectionRejection.marketSurveys || (a.selectionRejection.marketSurveys, e.length));
    }, [n.marketSurveys?.length]),
    React.createElement(
      "div",
      { className: "space-y-3" },
      React.createElement(DocumentsVault, { candidate: e, sf: a, upd: r }),
      React.createElement(FormASection, { formA: a.formA, upd: (e, t) => r(["formA", ...e], t) }),
      React.createElement(SelectionRejectionSection, {
        data: a.selectionRejection,
        upd: (e, t) => r(["selectionRejection", ...e], t),
        discovery: n,
      }),
      React.createElement(DocumentChecklistSection, {
        docs: a.documents,
        upd: (e, t) => r(["documents", e], t),
      }),
      React.createElement(ConfidentialReportSection, {
        n: 1,
        data: a.confidentialReport1,
        upd: (e, t) => r(["confidentialReport1", ...e], t),
      }),
      React.createElement(ConfidentialReportSection, {
        n: 2,
        data: a.confidentialReport2,
        upd: (e, t) => r(["confidentialReport2", ...e], t),
      }),
      React.createElement(InterviewingReportSection, {
        n: 1,
        data: a.interviewingReport1,
        upd: (e, t) => r(["interviewingReport1", ...e], t),
      }),
      React.createElement(InterviewingReportSection, {
        n: 2,
        data: a.interviewingReport2,
        upd: (e, t) => r(["interviewingReport2", ...e], t),
      }),
      React.createElement(SpouseInterviewSection, {
        data: a.spouseInterview,
        upd: (e, t) => r(["spouseInterview", ...e], t),
      }),
      React.createElement(InspectionReportSection, {
        data: a.inspectionReport,
        upd: (e, t) => r(["inspectionReport", ...e], t),
      }),
      React.createElement(LettersSection, { sf: a, upd: r }),
    )
  );
}
function DocumentsVault({ candidate: e, sf: t, upd: a }) {
  const n =
      "Yes" === e.meta?.internalCandidate ||
      "experienced" === e.stages?.firstInterview?.sourceBackground?.experienceLevel,
    r = n ? FILE_PREP_EXPERIENCED : FILE_PREP_INEXPERIENCED,
    s = t.documentUploads || {},
    o = t.filePrepChecklist || {},
    [c, i] = useState(null),
    [l, m] = useState("all"),
    [d, p] = useState(""),
    [u, h] = useState(!1),
    [g, b] = useState(null);
  useEffect(
    () => () => {
      c?.url && URL.revokeObjectURL(c.url);
    },
    [c],
  );
  const f = () => {
      (c?.url && URL.revokeObjectURL(c.url), i(null));
    },
    x = r.filter(
      (e) =>
        ("all" === l || e.owner === l) &&
        !(d && !e.item.toLowerCase().includes(d.toLowerCase()) && !e.num.includes(d)),
    ),
    v = r.length,
    y = r.filter((e) => s[e.num]?.filename).length,
    R = r.filter((e) => o[e.num]).length,
    E = v > 0 ? Math.round((y / v) * 100) : 0,
    w = v > 0 ? Math.round((R / v) * 100) : 0,
    N = { RM: "#7c3aed", BM: "#07131f", BMA: "#d97706", Candidate: "#0891b2" };
  return React.createElement(
    "div",
    { className: "bg-white border-2 border-stone-900 rounded-sm overflow-hidden" },
    React.createElement(
      "div",
      {
        className: "px-4 py-3 flex items-center justify-between flex-wrap gap-2",
        style: { background: "linear-gradient(90deg, #07131f 0%, #2c4d7a 100%)", color: "white" },
      },
      React.createElement(
        "div",
        { className: "flex items-center gap-2" },
        React.createElement(FolderOpen, { className: "w-4 h-4" }),
        React.createElement(
          "div",
          null,
          React.createElement(
            "div",
            { className: "text-[10px] uppercase tracking-[0.18em] text-stone-300 font-semibold" },
            "Recruit File · Documents Vault",
          ),
          React.createElement(
            "div",
            { className: "text-sm font-semibold" },
            e.meta?.name || "Candidate",
            " · ",
            n ? "Experienced" : "Inexperienced",
            " track",
          ),
        ),
      ),
      React.createElement(
        "div",
        { className: "flex items-center gap-3" },
        React.createElement(
          "div",
          { className: "flex items-center gap-3 text-xs text-stone-200" },
          React.createElement(
            "div",
            null,
            React.createElement(
              "span",
              { className: "text-[10px] uppercase tracking-wider text-stone-300" },
              "Uploaded",
            ),
            React.createElement(
              "div",
              { className: "font-mono font-bold text-white text-base leading-none" },
              y,
              React.createElement("span", { className: "text-stone-400 text-xs" }, "/", v),
            ),
          ),
          React.createElement(
            "div",
            null,
            React.createElement(
              "span",
              { className: "text-[10px] uppercase tracking-wider text-stone-300" },
              "Ticked",
            ),
            React.createElement(
              "div",
              { className: "font-mono font-bold text-white text-base leading-none" },
              R,
              React.createElement("span", { className: "text-stone-400 text-xs" }, "/", v),
            ),
          ),
        ),
        React.createElement(
          "button",
          {
            onClick: () => h(!u),
            className:
              "text-[10px] uppercase tracking-wider px-2 py-1 bg-white/10 hover:bg-white/20 rounded-sm transition-colors",
          },
          u ? "Expand" : "Collapse",
        ),
      ),
    ),
    React.createElement(
      "div",
      { className: "px-4 py-2 grid grid-cols-2 gap-3 border-b border-stone-200 bg-stone-50" },
      React.createElement(
        "div",
        null,
        React.createElement(
          "div",
          {
            className:
              "flex items-center justify-between text-[10px] uppercase tracking-wider text-stone-600 mb-1",
          },
          React.createElement("span", null, "Files uploaded"),
          React.createElement("span", { className: "font-mono" }, E, "%"),
        ),
        React.createElement(
          "div",
          { className: "h-1.5 bg-stone-200 rounded-full overflow-hidden" },
          React.createElement("div", {
            className: "h-full transition-all",
            style: { width: `${E}%`, backgroundColor: 100 === E ? "#10b981" : "#07131f" },
          }),
        ),
      ),
      React.createElement(
        "div",
        null,
        React.createElement(
          "div",
          {
            className:
              "flex items-center justify-between text-[10px] uppercase tracking-wider text-stone-600 mb-1",
          },
          React.createElement("span", null, "Checklist ticked"),
          React.createElement("span", { className: "font-mono" }, w, "%"),
        ),
        React.createElement(
          "div",
          { className: "h-1.5 bg-stone-200 rounded-full overflow-hidden" },
          React.createElement("div", {
            className: "h-full transition-all",
            style: { width: `${w}%`, backgroundColor: 100 === w ? "#10b981" : "#d97706" },
          }),
        ),
      ),
    ),
    !u &&
      React.createElement(
        React.Fragment,
        null,
        React.createElement(
          "div",
          { className: "px-4 py-2 border-b border-stone-200 bg-white flex items-center gap-2 flex-wrap" },
          React.createElement("input", {
            type: "text",
            value: d,
            onChange: (e) => p(e.target.value),
            placeholder: "Search documents…",
            className:
              "text-xs px-2 py-1 border border-stone-300 rounded-sm bg-white focus:outline-none focus:border-stone-700 flex-1 min-w-[120px]",
          }),
          React.createElement(
            "span",
            { className: "text-[10px] uppercase tracking-wider text-stone-500" },
            "Owner",
          ),
          ["all", "RM", "BM", "BMA", "Candidate"].map((e) =>
            React.createElement(
              "button",
              {
                key: e,
                onClick: () => m(e),
                className:
                  "text-[10px] uppercase tracking-wider px-2 py-1 rounded-sm transition-colors " +
                  (l === e ? "bg-stone-900 text-white" : "bg-stone-100 text-stone-600 hover:bg-stone-200"),
              },
              "all" === e ? "All" : e,
            ),
          ),
        ),
        React.createElement(
          "div",
          { className: "divide-y divide-stone-100" },
          x.map((t) => {
            const n = s[t.num],
              r = !!n?.filename,
              c = e.stages?.pop7Review?.uploadedReport,
              l = !(!c?.base64 && !c?.hasBlob),
              m = !!(n?.base64 || n?.hasBlob || ("10" === t.num && l)),
              d = !!o[t.num],
              p = t.owner || "RM";
            return React.createElement(
              "div",
              {
                key: t.num,
                className: "px-4 py-2 flex items-center gap-3 hover:bg-stone-50 transition-colors",
              },
              React.createElement(
                "div",
                { className: "flex-shrink-0 w-12 text-center" },
                React.createElement(
                  "span",
                  { className: "font-mono text-[11px] text-stone-500" },
                  "#",
                  t.num,
                ),
              ),
              React.createElement(
                "button",
                {
                  onClick: () => a(["filePrepChecklist", t.num], !d),
                  className:
                    "flex-shrink-0 w-5 h-5 rounded-sm border-2 flex items-center justify-center transition-colors",
                  style: {
                    backgroundColor: d ? "#065f46" : "#ffffff",
                    borderColor: d ? "#065f46" : "#a8a29e",
                  },
                },
                d && React.createElement(CheckCircle2, { className: "w-4 h-4 text-white", strokeWidth: 3 }),
              ),
              React.createElement(
                "div",
                { className: "flex-1 min-w-0" },
                React.createElement(
                  "div",
                  { className: "text-sm leading-tight " + (d ? "text-stone-500" : "text-stone-900") },
                  t.item,
                ),
                React.createElement(
                  "div",
                  { className: "flex items-center gap-2 mt-0.5 text-[10px] text-stone-500" },
                  React.createElement("span", null, "Source: ", t.source),
                  r &&
                    React.createElement(
                      React.Fragment,
                      null,
                      React.createElement("span", { className: "text-stone-300" }, "·"),
                      React.createElement("span", { className: "font-mono text-emerald-700" }, n.filename),
                      React.createElement("span", { className: "text-stone-300" }, "·"),
                      React.createElement("span", null, n.sizeKB, " KB"),
                      n.uploadedAt &&
                        React.createElement(
                          React.Fragment,
                          null,
                          React.createElement("span", { className: "text-stone-300" }, "·"),
                          React.createElement("span", null, new Date(n.uploadedAt).toLocaleDateString()),
                        ),
                    ),
                ),
              ),
              React.createElement(
                "div",
                { className: "flex-shrink-0" },
                React.createElement(
                  "span",
                  {
                    className: "text-[10px] uppercase tracking-wider px-2 py-0.5 rounded-sm font-bold",
                    style: { backgroundColor: N[p] + "15", color: N[p] },
                  },
                  p,
                ),
              ),
              React.createElement(
                "div",
                { className: "flex-shrink-0 flex items-center gap-1" },
                r &&
                  m &&
                  React.createElement(
                    "button",
                    {
                      onClick: () =>
                        (async (t) => {
                          const a = s[t];
                          if (!a) return;
                          let n = a.base64,
                            r = a.mediaType;
                          if (!n && a.hasBlob) {
                            const s = await loadDocBlob(e.id, t);
                            s?.base64 && ((n = s.base64), (r = s.mediaType || a.mediaType));
                          }
                          if (!n && "10" === t) {
                            const t = e.stages?.pop7Review?.uploadedReport;
                            if (t?.base64) ((n = t.base64), (r = t.mediaType || r));
                            else if (t?.hasBlob) {
                              const t = await loadPopBlob(e.id);
                              t?.base64 && ((n = t.base64), (r = t.mediaType || r));
                            }
                          }
                          if (n)
                            try {
                              const e = atob(n),
                                s = new Uint8Array(e.length);
                              for (let t = 0; t < e.length; t++) s[t] = e.charCodeAt(t);
                              const o = new Blob([s], { type: r || "application/pdf" }),
                                c = URL.createObjectURL(o);
                              i({ num: t, url: c, filename: a.filename, mediaType: r });
                            } catch (e) {
                              alert("Preview failed: " + e.message);
                            }
                          else alert("Document file not found. Re-upload required.");
                        })(t.num),
                      className:
                        "inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-1 bg-stone-900 text-white rounded-sm hover:bg-stone-700 transition-colors",
                      title: "Preview the uploaded file",
                    },
                    React.createElement(Eye, { className: "w-3 h-3" }),
                    " Preview",
                  ),
                r &&
                  !m &&
                  React.createElement(
                    "span",
                    {
                      className:
                        "text-[10px] uppercase tracking-wider px-2 py-1 bg-stone-100 text-stone-500 rounded-sm",
                      title: "File too large to preview",
                    },
                    "No preview",
                  ),
                React.createElement(
                  "label",
                  {
                    className:
                      "inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-1 border rounded-sm cursor-pointer transition-colors " +
                      (r
                        ? "border-stone-300 text-stone-600 hover:bg-stone-100"
                        : "border-stone-900 bg-stone-900 text-white hover:bg-stone-700"),
                    title: r ? "Replace file" : "Upload file",
                  },
                  g === t.num
                    ? React.createElement("div", {
                        className:
                          "w-3 h-3 border border-current border-t-transparent rounded-full animate-spin",
                      })
                    : React.createElement(
                        React.Fragment,
                        null,
                        React.createElement(Plus, { className: "w-3 h-3" }),
                        r ? "Replace" : "Upload",
                      ),
                  React.createElement("input", {
                    type: "file",
                    accept: "application/pdf,image/*,.doc,.docx",
                    className: "hidden",
                    onChange: (n) => {
                      ((async (t, n) => {
                        if (n) {
                          b(t);
                          try {
                            const r = await new Promise((e, t) => {
                                const a = new FileReader();
                                ((a.onload = () => {
                                  const t = a.result,
                                    n = t.indexOf(",");
                                  e(n >= 0 ? t.slice(n + 1) : t);
                                }),
                                  (a.onerror = () => t(new Error("Read failed"))),
                                  a.readAsDataURL(n));
                              }),
                              s = n.type || "application/octet-stream";
                            (a(["documentUploads", t], {
                              filename: n.name,
                              sizeKB: Math.round((0.75 * r.length) / 1024),
                              uploadedAt: new Date().toISOString(),
                              base64: r.length < 47e5 ? r : "",
                              mediaType: s,
                              uploadedBy: e.meta?.recruitingManager || "Unknown",
                            }),
                              a(["filePrepChecklist", t], !0));
                          } catch (e) {
                            alert("Upload failed: " + e.message);
                          } finally {
                            b(null);
                          }
                        }
                      })(t.num, n.target.files?.[0]),
                        (n.target.value = ""));
                    },
                  }),
                ),
                r &&
                  React.createElement(
                    "button",
                    {
                      onClick: () => {
                        return (
                          (e = t.num),
                          void (confirm("Remove this uploaded file?") && a(["documentUploads", e], void 0))
                        );
                        var e;
                      },
                      className: "text-stone-400 hover:text-rose-600 transition-colors",
                      title: "Remove uploaded file",
                    },
                    React.createElement(Trash2, { className: "w-3.5 h-3.5" }),
                  ),
              ),
            );
          }),
          0 === x.length &&
            React.createElement(
              "div",
              { className: "px-4 py-6 text-center text-sm text-stone-500 italic" },
              "No documents match this filter.",
            ),
        ),
      ),
    c &&
      React.createElement(
        "div",
        {
          className: "fixed inset-0 z-50 flex items-center justify-center p-4",
          style: { backgroundColor: "rgba(0,0,0,0.7)" },
          onClick: f,
        },
        React.createElement(
          "div",
          {
            className: "bg-white rounded-sm overflow-hidden flex flex-col w-full max-w-5xl",
            style: { height: "90vh" },
            onClick: (e) => e.stopPropagation(),
          },
          React.createElement(
            "div",
            {
              className: "px-4 py-3 flex items-center justify-between flex-shrink-0",
              style: { background: "linear-gradient(90deg, #07131f 0%, #2c4d7a 100%)", color: "white" },
            },
            React.createElement(
              "div",
              { className: "flex items-center gap-2" },
              React.createElement(FileText, { className: "w-4 h-4" }),
              React.createElement(
                "div",
                null,
                React.createElement(
                  "div",
                  { className: "text-[10px] uppercase tracking-[0.18em] text-stone-300" },
                  "Document #",
                  c.num,
                ),
                React.createElement("div", { className: "text-sm font-semibold" }, c.filename),
              ),
            ),
            React.createElement(
              "div",
              { className: "flex items-center gap-2" },
              React.createElement(
                "a",
                {
                  href: c.url,
                  download: c.filename,
                  className:
                    "inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-sm transition-colors",
                },
                React.createElement(Download, { className: "w-3 h-3" }),
                " Download",
              ),
              React.createElement(
                "a",
                {
                  href: c.url,
                  target: "_blank",
                  rel: "noopener noreferrer",
                  className:
                    "inline-flex items-center gap-1 text-xs px-2.5 py-1 bg-white/10 hover:bg-white/20 rounded-sm transition-colors",
                },
                "Open in new tab",
              ),
              React.createElement(
                "button",
                { onClick: f, className: "text-white/80 hover:text-white" },
                React.createElement(X, { className: "w-5 h-5" }),
              ),
            ),
          ),
          React.createElement(
            "div",
            { className: "flex-1 bg-stone-100 overflow-hidden" },
            c.mediaType?.startsWith("image/")
              ? React.createElement(
                  "div",
                  { className: "w-full h-full flex items-center justify-center overflow-auto p-4" },
                  React.createElement("img", {
                    src: c.url,
                    alt: c.filename,
                    className: "max-w-full max-h-full object-contain",
                  }),
                )
              : React.createElement("iframe", {
                  src: c.url,
                  title: c.filename,
                  className: "w-full h-full border-0",
                }),
          ),
        ),
      ),
  );
}
function FormASection({ formA: e, upd: t }) {
  const a = useMemo(() => scoreFormA(e), [e]);
  return React.createElement(
    Section,
    {
      title: "Agent Selection Criteria — Form A",
      subtitle: "Form #3 · Auto-scored · Triggers Selection Panel where applicable",
      defaultOpen: !0,
    },
    React.createElement(
      "div",
      { className: "space-y-3" },
      [
        ["age", "Age"],
        ["education", "Education"],
        ["discoverySummary", "Discovery Summary Evaluation"],
        ["employment", "Employment"],
        ["maritalStatus", "Marital Status"],
        ["carOwnership", "Car Ownership"],
        ["pop7", "POP7"],
        ["incomePotential", "Income Potential"],
      ].map(([n, r]) =>
        React.createElement(
          "div",
          { key: n, className: "grid gap-3 md:grid-cols-12 items-end" },
          React.createElement(
            "div",
            { className: "md:col-span-5" },
            React.createElement(Select, {
              label: r,
              value: e[n],
              onChange: (e) => t([n], e),
              options: FORM_A[n].map(([e, t]) => [e, e, `${e} · ${t} pts`]),
            }),
          ),
          React.createElement(
            "div",
            { className: "md:col-span-5" },
            React.createElement(TextInput, {
              label: "Notes",
              value: e.notes?.[n],
              onChange: (e) => t(["notes", n], e),
              placeholder: "Specific evidence",
            }),
          ),
          React.createElement(
            "div",
            { className: "md:col-span-2" },
            React.createElement(ReadoutBox, { label: "Pts", value: a.breakdown[n] || 0 }),
          ),
        ),
      ),
      React.createElement(Divider, { label: "Adjustments" }),
      React.createElement(
        Grid,
        { cols: 2 },
        React.createElement(NumberInput, {
          label: "Years unemployed since last employment",
          hint: "−1 point per year",
          value: e.unemployedYears,
          min: 0,
          onChange: (e) => t(["unemployedYears"], e),
        }),
        React.createElement(TextInput, {
          label: "POP7 Probability of Success (%)",
          value: e.pop7Probability,
          onChange: (e) => t(["pop7Probability"], e),
          placeholder: "e.g. 50",
        }),
      ),
      React.createElement(Divider, { label: "Result" }),
      React.createElement(
        "div",
        { className: "grid gap-3 md:grid-cols-3" },
        React.createElement(
          "div",
          {
            className:
              "md:col-span-1 px-4 py-3 border-2 border-stone-900 rounded-sm bg-stone-900 text-stone-50 relative overflow-hidden",
          },
          React.createElement(
            "div",
            { className: "text-[11px] uppercase tracking-[0.14em] text-stone-400 mb-1" },
            "Total points",
          ),
          React.createElement("div", { className: "font-serif text-4xl mb-2" }, a.total),
          React.createElement(
            "div",
            { className: "relative h-1.5 bg-stone-700 rounded-full overflow-hidden" },
            React.createElement("div", {
              className: "h-full transition-all duration-700",
              style: {
                width: `${Math.min(100, (a.total / 80) * 100)}%`,
                backgroundColor: a.total >= 60 ? "#34d399" : a.total >= 50 ? "#fbbf24" : "#fb7185",
              },
            }),
          ),
          React.createElement(
            "div",
            { className: "text-[10px] text-stone-400 mt-1.5 font-mono" },
            "/ 80 max",
          ),
        ),
        React.createElement(
          "div",
          { className: "md:col-span-2 px-4 py-3 border border-stone-300 rounded-sm bg-white" },
          React.createElement(
            "div",
            { className: "text-[11px] uppercase tracking-[0.14em] text-stone-500 mb-1" },
            "Action band",
          ),
          React.createElement(
            "div",
            { className: "text-sm text-stone-900 leading-relaxed mb-3" },
            a.action || "—",
          ),
          React.createElement(
            "div",
            { className: "mt-3 pt-3 border-t border-stone-200" },
            React.createElement(
              "div",
              { className: "flex justify-between text-[10px] uppercase tracking-wider text-stone-500 mb-1" },
              React.createElement("span", null, "Selection Panel"),
              React.createElement("span", null, "VP Decision"),
              React.createElement("span", null, "BM Direct"),
            ),
            React.createElement(
              "div",
              { className: "relative h-3 bg-stone-200 rounded-full overflow-hidden" },
              React.createElement("div", {
                className: "absolute inset-y-0 left-0 bg-rose-300",
                style: { width: "62.5%" },
              }),
              React.createElement("div", {
                className: "absolute inset-y-0 bg-amber-300",
                style: { left: "62.5%", width: "12.5%" },
              }),
              React.createElement("div", {
                className: "absolute inset-y-0 bg-emerald-300",
                style: { left: "75%", width: "25%" },
              }),
              a.total > 0 &&
                React.createElement("div", {
                  className:
                    "absolute top-0 bottom-0 w-1 bg-stone-900 rounded-full transition-all duration-700",
                  style: { left: `${Math.min(100, (a.total / 80) * 100)}%` },
                }),
            ),
            React.createElement(
              "div",
              { className: "flex justify-between text-[10px] text-stone-400 mt-1 font-mono" },
              React.createElement("span", null, "0"),
              React.createElement("span", null, "50"),
              React.createElement("span", null, "60"),
              React.createElement("span", null, "80"),
            ),
          ),
        ),
      ),
      a.flags.length > 0 &&
        React.createElement(
          "div",
          { className: "border border-amber-400 bg-amber-50 rounded-sm p-4" },
          React.createElement(
            "div",
            { className: "flex items-center gap-2 mb-2" },
            React.createElement(AlertTriangle, { className: "w-4 h-4 text-amber-700" }),
            React.createElement(
              "span",
              { className: "text-xs uppercase tracking-wider font-semibold text-amber-900" },
              "Auto Selection Panel Triggers",
            ),
          ),
          React.createElement(
            "ul",
            { className: "space-y-1 text-sm text-amber-900" },
            a.flags.map((e, t) => React.createElement("li", { key: t }, "• ", e)),
          ),
        ),
    ),
  );
}
const SR_CHECKLIST = [
  "Job Description",
  "Sales Contract",
  "Persistency",
  "Rated Sheets",
  "Sales Pipeline",
  "Time Management",
  "Record Keeping / Planning",
  "Code of Ethics",
  "Commissions",
];
function SelectionRejectionSection({ data: e, upd: t, discovery: a }) {
  const n = a?.marketSurveys?.length || 0;
  return React.createElement(
    Section,
    { title: "Selection / Rejection Training Process", subtitle: "Form #4 · RM tracker" },
    React.createElement(
      Grid,
      { cols: 2 },
      React.createElement(ButtonGroup, {
        label: "Training & Development Flow Chart discussed",
        value: e.tdDiscussed,
        onChange: (e) => t(["tdDiscussed"], e),
        options: ["Yes", "No"],
      }),
      React.createElement(ButtonGroup, {
        label: "Career Path discussed",
        value: e.careerPath,
        onChange: (e) => t(["careerPath"], e),
        options: ["Yes", "No"],
      }),
      React.createElement(ButtonGroup, {
        label: "Car Ownership / Availability",
        value: e.carOwnership,
        onChange: (e) => t(["carOwnership"], e),
        options: ["Yes", "No"],
      }),
      React.createElement(TextInput, {
        label: "Car notes",
        value: e.carNotes,
        onChange: (e) => t(["carNotes"], e),
      }),
      React.createElement(ButtonGroup, {
        label: "BYOD",
        value: e.byod,
        onChange: (e) => t(["byod"], e),
        options: ["Laptop", "Tablet", "Both"],
      }),
      React.createElement(ButtonGroup, {
        label: "Awards/MDRT/Convention overview discussed",
        value: e.awardsMDRT,
        onChange: (e) => t(["awardsMDRT"], e),
        options: ["Yes", "No"],
      }),
    ),
    React.createElement(Divider, { label: "Items discussed" }),
    React.createElement(
      "div",
      { className: "space-y-2" },
      SR_CHECKLIST.map((a) => {
        const n = a.replace(/[^a-zA-Z]/g, "_"),
          r = e.checklist?.[n] || {};
        return React.createElement(
          "div",
          {
            key: n,
            className:
              "grid gap-3 md:grid-cols-12 items-center py-1 border-b border-stone-200/70 last:border-b-0",
          },
          React.createElement("div", { className: "md:col-span-4 text-sm text-stone-700" }, a),
          React.createElement(
            "div",
            { className: "md:col-span-3" },
            React.createElement(ButtonGroup, {
              value: r.yn,
              onChange: (e) => t(["checklist", n], { ...r, yn: e }),
              options: ["Yes", "No"],
            }),
          ),
          React.createElement(
            "div",
            { className: "md:col-span-5" },
            React.createElement(TextInput, {
              value: r.comment,
              onChange: (e) => t(["checklist", n], { ...r, comment: e }),
              placeholder: "Comments",
            }),
          ),
        );
      }),
    ),
    React.createElement(Divider, { label: "Activity counts" }),
    React.createElement(
      Grid,
      { cols: 3 },
      React.createElement(NumberInput, {
        label: "Orientation Classes",
        value: e.orientationClasses,
        min: 0,
        onChange: (e) => t(["orientationClasses"], e),
      }),
      React.createElement(
        "div",
        null,
        React.createElement(NumberInput, {
          label: "Market Surveys Completed",
          value: e.marketSurveys || n,
          min: 0,
          onChange: (e) => t(["marketSurveys"], e),
        }),
        n > 0 &&
          React.createElement(
            "div",
            { className: "text-[11px] text-stone-500 mt-1" },
            "Auto-detected: ",
            n,
            " from Discovery stage",
          ),
      ),
      React.createElement(TextInput, {
        label: "Project 100 Income (monthly TT$)",
        value: e.project100Monthly,
        onChange: (e) => t(["project100Monthly"], e),
      }),
    ),
    React.createElement(
      "div",
      { className: "mt-4 space-y-3" },
      React.createElement(TextInput, {
        label: "Financing requested (TT$)",
        value: e.financingAmount,
        onChange: (e) => t(["financingAmount"], e),
      }),
      React.createElement(TextArea, {
        label: "Spouse / Partner / Parent Interview comment",
        value: e.spouseInterviewComment,
        onChange: (e) => t(["spouseInterviewComment"], e),
        rows: 2,
      }),
      React.createElement(TextArea, {
        label: "Additional notes (incl. transition plan if internal candidate)",
        value: e.additionalNotes,
        onChange: (e) => t(["additionalNotes"], e),
        rows: 3,
      }),
    ),
  );
}
const DOC_CHECKLIST = [
  { key: "photos", label: "Two (2) Passport photographs" },
  { key: "proofAddress", label: "Proof of Address" },
  { key: "authLetterAddress", label: "Auth letter (if PoA not in candidate name)" },
  { key: "police", label: "Police Certificate of Character" },
  { key: "cbtt", label: "CBTT Provisional Salesman license" },
  { key: "bank", label: "Bank Statement" },
  { key: "nis", label: "NIS card / number" },
  { key: "bir", label: "BIR card / number" },
  { key: "recruitId", label: "Recruit Identification (ID# / DP#)" },
  { key: "vehicleAuth", label: "Vehicle Authorisation letter" },
  { key: "certifiedCopy", label: "True Certified Copy in parent's name" },
  { key: "academic", label: "Copies of Academic Qualifications" },
  { key: "byod", label: "BYOD device confirmed" },
];
function DocumentChecklistSection({ docs: e, upd: t }) {
  return React.createElement(
    Section,
    { title: "Document checklist", subtitle: "Form #18 · Other Information" },
    React.createElement(
      "div",
      { className: "space-y-1" },
      DOC_CHECKLIST.map((a) =>
        React.createElement(Checkbox, {
          key: a.key,
          label: a.label,
          checked: e?.[a.key],
          onChange: (e) => t(a.key, e),
        }),
      ),
    ),
  );
}
const CR_QUESTIONS = [
  ["q1", "Desire for growth and development"],
  ["q2", "Reliability / Honesty / Sincerity / Integrity"],
  ["q3", "Team player"],
  ["q4", "Ability to cope and be adaptable"],
  ["q5", "Sound decision-making"],
  ["q6", "Long hours / self-discipline"],
  ["q7", "Sense of responsibility"],
  ["q8", "Community contribution"],
];
function ConfidentialReportSection({ n: e, data: t, upd: a }) {
  return React.createElement(
    Section,
    { title: `Confidential Report #${e}`, subtitle: "Form #13 · RM interviews a reference" },
    React.createElement(
      Grid,
      { cols: 3 },
      React.createElement(TextInput, {
        label: "Interviewee",
        value: t.intervieweeName,
        onChange: (e) => a(["intervieweeName"], e),
      }),
      React.createElement(TextInput, {
        label: "Interviewer (RM)",
        value: t.interviewerName,
        onChange: (e) => a(["interviewerName"], e),
      }),
      React.createElement(TextInput, {
        label: "Date completed",
        type: "date",
        value: t.dateCompleted,
        onChange: (e) => a(["dateCompleted"], e),
      }),
    ),
    React.createElement(Divider, { label: "Known by interviewee" }),
    React.createElement(
      Grid,
      { cols: 2 },
      React.createElement(TextInput, {
        label: "How known",
        value: t.known.howKnown,
        onChange: (e) => a(["known", "howKnown"], e),
      }),
      React.createElement(TextInput, {
        label: "How long",
        value: t.known.howLong,
        onChange: (e) => a(["known", "howLong"], e),
      }),
      React.createElement(TextInput, {
        label: "See often",
        value: t.known.seeOften,
        onChange: (e) => a(["known", "seeOften"], e),
      }),
      React.createElement(TextInput, {
        label: "Best work environment",
        value: t.known.workEnv,
        onChange: (e) => a(["known", "workEnv"], e),
      }),
    ),
    React.createElement(
      "div",
      { className: "mt-3 space-y-3" },
      React.createElement(TextArea, {
        label: "Recommend for sales role?",
        value: t.known.recommend,
        onChange: (e) => a(["known", "recommend"], e),
        rows: 2,
      }),
    ),
    React.createElement(Divider, { label: "Rating questions — E / G / F" }),
    React.createElement(
      "div",
      { className: "border border-stone-200 rounded-sm p-3 bg-white" },
      CR_QUESTIONS.map(([e, n], r) =>
        React.createElement(RatingEGF, {
          key: e,
          label: `${r + 1}. ${n}`,
          value: t.ratings[e],
          onChange: (t) => a(["ratings", e], t),
        }),
      ),
    ),
    React.createElement(Divider, { label: "Open-ended" }),
    React.createElement(
      Grid,
      { cols: 1 },
      React.createElement(TextArea, {
        label: "Hesitation accepting insurance advice?",
        value: t.open.advice,
        onChange: (e) => a(["open", "advice"], e),
        rows: 2,
      }),
      React.createElement(TextArea, {
        label: "Strengths most likely to contribute to success",
        value: t.open.strengths,
        onChange: (e) => a(["open", "strengths"], e),
        rows: 2,
      }),
      React.createElement(TextArea, {
        label: "Biggest obstacle",
        value: t.open.obstacles,
        onChange: (e) => a(["open", "obstacles"], e),
        rows: 2,
      }),
      React.createElement(TextArea, {
        label: "Anything else",
        value: t.open.other,
        onChange: (e) => a(["open", "other"], e),
        rows: 2,
      }),
    ),
  );
}
function InterviewingReportSection({ n: e, data: t, upd: a }) {
  return React.createElement(
    Section,
    { title: `Interviewing Report #${e}`, subtitle: "Form #14 · RM interview log" },
    React.createElement(
      Grid,
      { cols: 2 },
      React.createElement(TextInput, {
        label: "Person interviewed",
        value: t.intervieweeName,
        onChange: (e) => a(["intervieweeName"], e),
      }),
      React.createElement(TextInput, {
        label: "Occupation",
        value: t.occupation,
        onChange: (e) => a(["occupation"], e),
      }),
      React.createElement(Select, {
        label: "Relationship",
        value: t.relationship,
        onChange: (e) => a(["relationship"], e),
        options: [
          "Employer (Present or Past)",
          "Fellow Church Member",
          "Business Associate",
          "Neighbour",
          "Fellow Club Member",
          "School Classmate",
          "Business Relationship",
          "Other",
        ],
      }),
      React.createElement(Select, {
        label: "How conducted?",
        value: t.method,
        onChange: (e) => a(["method"], e),
        options: ["Virtually", "On the phone", "In person"],
      }),
    ),
    React.createElement(
      "div",
      { className: "mt-3 space-y-3" },
      React.createElement(TextArea, {
        label: "Summary",
        value: t.summary,
        onChange: (e) => a(["summary"], e),
        rows: 3,
      }),
      React.createElement(
        Grid,
        { cols: 2 },
        React.createElement(TextArea, {
          label: "Positive points",
          value: t.positives,
          onChange: (e) => a(["positives"], e),
          rows: 4,
        }),
        React.createElement(TextArea, {
          label: "Negative points needing further assessment",
          value: t.negatives,
          onChange: (e) => a(["negatives"], e),
          rows: 4,
        }),
      ),
    ),
  );
}
function SpouseInterviewSection({ data: e, upd: t }) {
  return React.createElement(
    Section,
    { title: "Spouse / Partner / Parent Interview", subtitle: "Form #15" },
    React.createElement(
      Grid,
      { cols: 2 },
      React.createElement(TextInput, { label: "Name", value: e.name, onChange: (e) => t(["name"], e) }),
      React.createElement(Select, {
        label: "Relationship",
        value: e.relationship,
        onChange: (e) => t(["relationship"], e),
        options: ["Spouse", "Partner", "Parent"],
      }),
    ),
    React.createElement(
      "div",
      { className: "mt-4 space-y-3" },
      [
        ["insurance", "Do you own any insurance, and how did you get the coverage?"],
        ["impressionAgent", "Your impression of an Insurance Agent?"],
        ["publicView", "How does the public view a Life Insurance Agent?"],
        ["familyReact", "How would family/friends react to the candidate selling Life Insurance?"],
        ["personalFeel", "How do you feel about the candidate selling Life Insurance?"],
        ["preferAnother", "Would you prefer they had another type of job?"],
        ["longHours", "How do you feel about long hours and evenings?"],
      ].map(([a, n]) =>
        React.createElement(TextArea, { key: a, label: n, value: e[a], onChange: (e) => t([a], e), rows: 2 }),
      ),
    ),
  );
}
function InspectionReportSection({ data: e, upd: t }) {
  return React.createElement(
    Section,
    { title: "Inspection Report", subtitle: "Form #12 · Third-party security vetting", defaultOpen: !1 },
    React.createElement(
      Grid,
      { cols: 2 },
      React.createElement(TextInput, {
        label: "Type of Request",
        value: e.request.type,
        onChange: (e) => t(["request", "type"], e),
        placeholder: "Security Vetting for Agent",
      }),
      React.createElement(TextInput, {
        label: "Date of Interview",
        type: "date",
        value: e.request.dateInterview,
        onChange: (e) => t(["request", "dateInterview"], e),
      }),
    ),
    React.createElement(Divider, { label: "Personal profile" }),
    React.createElement(
      Grid,
      { cols: 3 },
      React.createElement(TextInput, {
        label: "Candidate Name",
        value: e.personal.name,
        onChange: (e) => t(["personal", "name"], e),
      }),
      React.createElement(TextInput, {
        label: "DOB",
        type: "date",
        value: e.personal.dob,
        onChange: (e) => t(["personal", "dob"], e),
      }),
      React.createElement(TextInput, {
        label: "ID#",
        value: e.personal.id,
        onChange: (e) => t(["personal", "id"], e),
      }),
    ),
    React.createElement(
      "div",
      { className: "mt-3 grid gap-4 md:grid-cols-2" },
      React.createElement(TextArea, {
        label: "Address on DP",
        value: e.personal.addressOnDp,
        onChange: (e) => t(["personal", "addressOnDp"], e),
        rows: 2,
        hint: "Will flag if different from current",
      }),
      React.createElement(TextArea, {
        label: "Current Address",
        value: e.personal.currentAddress,
        onChange: (e) => t(["personal", "currentAddress"], e),
        rows: 2,
      }),
    ),
    React.createElement(Divider, { label: "Family contacts" }),
    React.createElement(RowList, {
      rows: e.family,
      onChange: (e) => t(["family"], e),
      template: () => ({ relationship: "", name: "", occupation: "", contact: "" }),
      fields: [
        { key: "relationship", label: "Relationship", placeholder: "Mother / Father / Sibling" },
        { key: "name", label: "Name" },
        { key: "occupation", label: "Occupation" },
        { key: "contact", label: "Contact" },
      ],
      addLabel: "Add family member",
    }),
    React.createElement(Divider, { label: "Investigator's remarks" }),
    React.createElement(TextArea, {
      value: e.remarks,
      onChange: (e) => t(["remarks"], e),
      rows: 8,
      placeholder:
        "Summary of all findings; reliability/integrity assessment; pressure/influence assessment…",
    }),
    React.createElement(
      "div",
      { className: "mt-4" },
      React.createElement(
        Grid,
        { cols: 3 },
        React.createElement(TextInput, {
          label: "Investigator name",
          value: e.investigator,
          onChange: (e) => t(["investigator"], e),
        }),
        React.createElement(TextInput, {
          label: "Investigator contact",
          value: e.investigatorContact,
          onChange: (e) => t(["investigatorContact"], e),
        }),
        React.createElement(TextInput, {
          label: "Date",
          type: "date",
          value: e.date,
          onChange: (e) => t(["date"], e),
        }),
      ),
    ),
  );
}
function LettersSection({ sf: e, upd: t }) {
  return React.createElement(
    React.Fragment,
    null,
    React.createElement(
      Section,
      { title: "Recommendation Letter", subtitle: "Form #1a" },
      React.createElement(
        Grid,
        { cols: 2 },
        React.createElement(Select, {
          label: "Author role",
          value: e.recommendationLetter.authorRole,
          onChange: (e) => t(["recommendationLetter", "authorRole"], e),
          options: [
            "Branch Manager",
            "Unit Manager",
            "Recruiting Manager",
            "Asst. Branch Manager",
            "Trainee Manager",
            "Other",
          ],
        }),
        React.createElement(Select, {
          label: "Author name",
          value: e.recommendationLetter.authorName,
          onChange: (e) => t(["recommendationLetter", "authorName"], e),
          options: ALL_MANAGER_NAMES,
        }),
        React.createElement(TextInput, {
          label: "Date",
          type: "date",
          value: e.recommendationLetter.date,
          onChange: (e) => t(["recommendationLetter", "date"], e),
        }),
      ),
      React.createElement(
        "div",
        { className: "mt-4" },
        React.createElement(TextArea, {
          label: "Letter body",
          value: e.recommendationLetter.body,
          onChange: (e) => t(["recommendationLetter", "body"], e),
          rows: 8,
        }),
      ),
    ),
    React.createElement(
      Section,
      { title: "Memo Circulating Recruit's Name", subtitle: "Form #2" },
      React.createElement(
        Grid,
        { cols: 2 },
        React.createElement(TextInput, {
          label: "Date",
          type: "date",
          value: e.circulationMemo.date,
          onChange: (e) => t(["circulationMemo", "date"], e),
        }),
        React.createElement(Select, {
          label: "Issued by",
          value: e.circulationMemo.issuedBy,
          onChange: (e) => t(["circulationMemo", "issuedBy"], e),
          options: ["Genevieve Pierre — Manager, Sales Administration", "Andre Redman", "Other"],
        }),
        React.createElement(Select, {
          label: "From (originator)",
          value: e.circulationMemo.from,
          onChange: (e) => t(["circulationMemo", "from"], e),
          options: ALL_MANAGER_NAMES,
        }),
        React.createElement(TextInput, {
          label: "To",
          value: e.circulationMemo.to,
          onChange: (e) => t(["circulationMemo", "to"], e),
          placeholder: "Sales Managers",
        }),
      ),
      React.createElement(
        "div",
        { className: "mt-4" },
        React.createElement(TextArea, {
          label: "Memo body",
          value: e.circulationMemo.body,
          onChange: (e) => t(["circulationMemo", "body"], e),
          rows: 4,
        }),
      ),
    ),
    React.createElement(
      Section,
      { title: "Supporting Letter", subtitle: "Form #1b · Optional" },
      React.createElement(
        Grid,
        { cols: 2 },
        React.createElement(Select, {
          label: "Author role",
          value: e.supportingLetter.authorRole,
          onChange: (e) => t(["supportingLetter", "authorRole"], e),
          options: ["Recruiting Officer", "Branch Manager", "Unit Manager", "Recruiting Manager"],
        }),
        React.createElement(Select, {
          label: "Author name",
          value: e.supportingLetter.officer,
          onChange: (e) => t(["supportingLetter", "officer"], e),
          options: ALL_MANAGER_NAMES,
        }),
        React.createElement(TextInput, {
          label: "Date",
          type: "date",
          value: e.supportingLetter.date,
          onChange: (e) => t(["supportingLetter", "date"], e),
        }),
      ),
      React.createElement(
        "div",
        { className: "mt-4" },
        React.createElement(TextArea, {
          label: "Letter body",
          value: e.supportingLetter.body,
          onChange: (e) => t(["supportingLetter", "body"], e),
          rows: 6,
        }),
      ),
    ),
  );
}
function ApprovalStage({ candidate: e, persist: t }) {
  const a = e.stages.approval,
    n = e.stages.selectionFile.formA,
    r = useMemo(() => scoreFormA(n).total, [n]),
    s = (e, a) => t((t) => setPath(t, ["stages", "approval", ...e], a)),
    o =
      r >= 60
        ? "BM Direct (60–80)"
        : r >= 50
          ? "VP Sales decision (50–59)"
          : r > 0
            ? "Selection Panel (<50)"
            : "";
  return React.createElement(
    "div",
    { className: "space-y-3" },
    React.createElement(
      Section,
      { title: "Approval Routing & Final Decision", defaultOpen: !0 },
      o &&
        React.createElement(
          "div",
          { className: "px-4 py-3 border border-stone-300 rounded-sm bg-stone-50 mb-4" },
          React.createElement(
            "div",
            { className: "text-[11px] uppercase tracking-[0.14em] text-stone-500 mb-1" },
            "Recommended route based on Form A (",
            r,
            " pts)",
          ),
          React.createElement("div", { className: "text-sm text-stone-900" }, o),
        ),
      React.createElement(
        Grid,
        { cols: 2 },
        React.createElement(Select, {
          label: "Actual route taken",
          value: a.route,
          onChange: (e) => s(["route"], e),
          options: ["BM Direct (60–80)", "VP Sales decision (50–59)", "Selection Panel (<50)"],
        }),
        React.createElement(TextInput, {
          label: "Submitted to",
          value: a.submittedTo,
          onChange: (e) => s(["submittedTo"], e),
          placeholder: "Office of the VP – Sales",
        }),
        React.createElement(TextInput, {
          label: "Date submitted",
          type: "date",
          value: a.submittedDate,
          onChange: (e) => s(["submittedDate"], e),
        }),
        React.createElement(TextInput, {
          label: "Approval Memo reference",
          value: a.approvalMemoRef,
          onChange: (e) => s(["approvalMemoRef"], e),
        }),
      ),
      a.route?.startsWith("Selection Panel") &&
        React.createElement(
          React.Fragment,
          null,
          React.createElement(Divider, { label: "Selection Panel" }),
          React.createElement(
            Grid,
            { cols: 2 },
            React.createElement(TextInput, {
              label: "Panel date",
              type: "date",
              value: a.selectionPanel.date,
              onChange: (e) => s(["selectionPanel", "date"], e),
            }),
            React.createElement(TextInput, {
              label: "Members",
              value: a.selectionPanel.members,
              onChange: (e) => s(["selectionPanel", "members"], e),
              placeholder: "VP Sales · Sr Mgr Sales L&D · HC · Sr Sales Consultant",
            }),
          ),
          React.createElement(
            "div",
            { className: "mt-3" },
            React.createElement(TextArea, {
              label: "Panel notes / outcome",
              value: a.selectionPanel.notes,
              onChange: (e) => s(["selectionPanel", "notes"], e),
              rows: 3,
            }),
          ),
        ),
      React.createElement(Divider, { label: "Decision" }),
      React.createElement(
        Grid,
        { cols: 2 },
        React.createElement(Select, {
          label: "Decision",
          value: a.decision,
          onChange: (e) => s(["decision"], e),
          options: ["Approved", "Approved with conditions", "Rejected"],
        }),
        React.createElement(TextInput, {
          label: "Decided by (name)",
          value: a.decidedBy,
          onChange: (e) => s(["decidedBy"], e),
          placeholder: "Gregg Mannette",
        }),
        React.createElement(TextInput, {
          label: "Role",
          value: a.decidedByRole,
          onChange: (e) => s(["decidedByRole"], e),
          placeholder: "Vice President — Sales",
        }),
        React.createElement(TextInput, {
          label: "Decision date",
          type: "date",
          value: a.decisionDate,
          onChange: (e) => s(["decisionDate"], e),
        }),
      ),
      "Approved with conditions" === a.decision &&
        React.createElement(
          "div",
          { className: "mt-3" },
          React.createElement(TextArea, {
            label: "Conditions",
            value: a.conditions,
            onChange: (e) => s(["conditions"], e),
            rows: 3,
          }),
        ),
      React.createElement(
        "div",
        { className: "mt-3" },
        React.createElement(TextArea, {
          label: "Comments",
          value: a.comments,
          onChange: (e) => s(["comments"], e),
          rows: 3,
        }),
      ),
    ),
  );
}
function OnboardingStage({ candidate: e, persist: t }) {
  const a = e.stages.onboarding,
    n = (e, a) => t((t) => setPath(t, ["stages", "onboarding", ...e], a));
  return React.createElement(
    "div",
    { className: "space-y-3" },
    React.createElement(
      Section,
      { title: "Licensing", defaultOpen: !0 },
      React.createElement(
        Grid,
        { cols: 3 },
        React.createElement(TextInput, {
          label: "CBTT Applied",
          type: "date",
          value: a.cbtt.applied,
          onChange: (e) => n(["cbtt", "applied"], e),
        }),
        React.createElement(TextInput, {
          label: "CBTT Received",
          type: "date",
          value: a.cbtt.received,
          onChange: (e) => n(["cbtt", "received"], e),
        }),
        React.createElement(TextInput, {
          label: "Licence expiry",
          type: "date",
          value: a.cbtt.expiry,
          onChange: (e) => n(["cbtt", "expiry"], e),
        }),
        React.createElement(TextInput, {
          label: "Agent number",
          value: a.agentNumber,
          onChange: (e) => n(["agentNumber"], e),
        }),
        React.createElement(TextInput, {
          label: "Company email",
          value: a.glocEmail,
          onChange: (e) => n(["glocEmail"], e),
        }),
      ),
    ),
    React.createElement(
      Section,
      { title: "Compliance training", defaultOpen: !0 },
      React.createElement(
        Grid,
        { cols: 2 },
        React.createElement(TextInput, {
          label: "AML started",
          type: "date",
          value: a.aml.started,
          onChange: (e) => n(["aml", "started"], e),
        }),
        React.createElement(TextInput, {
          label: "AML completed",
          type: "date",
          value: a.aml.completed,
          onChange: (e) => n(["aml", "completed"], e),
        }),
        React.createElement(TextInput, {
          label: "OFT completed",
          type: "date",
          value: a.oft.completed,
          onChange: (e) => n(["oft", "completed"], e),
        }),
        React.createElement(TextInput, {
          label: "OFT cert submitted",
          type: "date",
          value: a.oft.certSubmitted,
          onChange: (e) => n(["oft", "certSubmitted"], e),
        }),
      ),
    ),
    React.createElement(
      Section,
      { title: "Boot Camp & Induction", defaultOpen: !0 },
      React.createElement(
        Grid,
        { cols: 2 },
        React.createElement(TextInput, {
          label: "Boot Camp started",
          type: "date",
          value: a.bootCamp.started,
          onChange: (e) => n(["bootCamp", "started"], e),
        }),
        React.createElement(TextInput, {
          label: "Boot Camp completed",
          type: "date",
          value: a.bootCamp.completed,
          onChange: (e) => n(["bootCamp", "completed"], e),
        }),
        React.createElement(TextInput, {
          label: "Induction started",
          type: "date",
          value: a.induction.started,
          onChange: (e) => n(["induction", "started"], e),
        }),
        React.createElement(TextInput, {
          label: "Induction completed",
          type: "date",
          value: a.induction.completed,
          onChange: (e) => n(["induction", "completed"], e),
        }),
        React.createElement(TextInput, {
          label: "Induction cert submitted",
          type: "date",
          value: a.induction.certSubmitted,
          onChange: (e) => n(["induction", "certSubmitted"], e),
        }),
      ),
    ),
    React.createElement(
      Section,
      { title: "Contract" },
      React.createElement(
        Grid,
        { cols: 2 },
        React.createElement(TextInput, {
          label: "Contract signed",
          type: "date",
          value: a.contract.signed,
          onChange: (e) => n(["contract", "signed"], e),
        }),
        React.createElement(TextInput, {
          label: "Returned to Sales Admin",
          type: "date",
          value: a.contract.returned,
          onChange: (e) => n(["contract", "returned"], e),
        }),
      ),
    ),
    React.createElement(
      Section,
      { title: "Notes" },
      React.createElement(TextArea, { value: a.notes, onChange: (e) => n(["notes"], e), rows: 4 }),
    ),
  );
}
function InductionStage({ candidate: e, persist: t }) {
  const a = e.stages.induction,
    n = (e, a) => t((t) => setPath(t, ["stages", "induction", ...e], a)),
    r = e.stages.onboarding?.agentNumber || "",
    s = PRODUCTION_DATA[r] || null,
    o = e.stages.firstInterview?.date,
    c = o ? Math.floor((Date.now() - new Date(o).getTime()) / 864e5) : null,
    i = a.contract?.probationEnd,
    l = i ? Math.floor((new Date(i).getTime() - Date.now()) / 864e5) : null,
    m =
      a.contract?.probationStart && i
        ? Math.floor((new Date(i).getTime() - new Date(a.contract.probationStart).getTime()) / 864e5)
        : 210,
    d = m - (l || 0),
    p = m > 0 ? Math.max(0, Math.min(100, Math.round((d / m) * 100))) : 0,
    u = s?.settledAPI || 0,
    h = s?.apps || 0,
    g = Math.round(0.4 * u),
    b = a.quotas.apiTarget > 0 ? Math.min(150, Math.round((u / a.quotas.apiTarget) * 100)) : 0,
    f =
      a.quotas.settledAppsTarget > 0 ? Math.min(150, Math.round((h / a.quotas.settledAppsTarget) * 100)) : 0,
    x =
      a.quotas.commissionsTarget > 0 ? Math.min(150, Math.round((g / a.quotas.commissionsTarget) * 100)) : 0,
    v = p,
    y = b >= v - 10 && f >= v - 10,
    R = e.meta.name || "[Candidate Name]",
    E = e.meta.branchManager || "Ricky Rampersad",
    w = e.meta.recruitingManager || "[Unit Manager]",
    N = a.contract.candidateAddress || e.meta.address || "[Address]";
  return React.createElement(
    "div",
    { className: "space-y-3" },
    React.createElement(
      "div",
      { className: "rounded-sm overflow-hidden border-2", style: { borderColor: y ? "#10b981" : "#dc2626" } },
      React.createElement(
        "div",
        {
          className: "px-4 py-3",
          style: { background: "linear-gradient(135deg, #07131f 0%, #2c4d7a 100%)", color: "white" },
        },
        React.createElement(
          "div",
          { className: "flex items-center justify-between flex-wrap gap-3" },
          React.createElement(
            "div",
            null,
            React.createElement(
              "div",
              { className: "text-[10px] uppercase tracking-[0.18em] text-stone-300 font-semibold mb-0.5" },
              "Probation Period · Active Induction",
            ),
            React.createElement("h3", { className: "font-serif text-xl text-white" }, R),
            r &&
              React.createElement(
                "div",
                { className: "text-xs text-stone-300 font-mono mt-1" },
                "Agent #",
                r,
                " · ",
                w,
                "'s Unit",
              ),
          ),
          React.createElement(
            "div",
            { className: "flex items-center gap-6" },
            React.createElement(
              "div",
              { className: "text-center" },
              React.createElement(
                "div",
                { className: "relative w-20 h-20" },
                React.createElement(
                  "svg",
                  { className: "w-20 h-20 -rotate-90" },
                  React.createElement("circle", {
                    cx: "40",
                    cy: "40",
                    r: "34",
                    stroke: "rgba(255,255,255,0.15)",
                    strokeWidth: "6",
                    fill: "none",
                  }),
                  React.createElement("circle", {
                    cx: "40",
                    cy: "40",
                    r: "34",
                    stroke: null !== l && l < 60 ? "#fbbf24" : "#10b981",
                    strokeWidth: "6",
                    fill: "none",
                    strokeLinecap: "round",
                    strokeDasharray: (p / 100) * 213.6 + " 213.6",
                    style: { transition: "stroke-dasharray 0.5s" },
                  }),
                ),
                React.createElement(
                  "div",
                  { className: "absolute inset-0 flex flex-col items-center justify-center" },
                  React.createElement(
                    "span",
                    { className: "font-serif text-xl font-bold text-white leading-none" },
                    p,
                    "%",
                  ),
                ),
              ),
              React.createElement(
                "div",
                { className: "text-[10px] text-stone-300 mt-1 uppercase tracking-wider" },
                "Elapsed",
              ),
            ),
            null !== l &&
              React.createElement(
                "div",
                { className: "text-center" },
                React.createElement("div", { className: "font-serif text-3xl text-white leading-none" }, l),
                React.createElement(
                  "div",
                  { className: "text-[10px] text-stone-300 mt-1 uppercase tracking-wider" },
                  "Days remaining",
                ),
              ),
            null !== c &&
              React.createElement(
                "div",
                { className: "text-center" },
                React.createElement("div", { className: "font-serif text-3xl text-white leading-none" }, c),
                React.createElement(
                  "div",
                  { className: "text-[10px] text-stone-300 mt-1 uppercase tracking-wider" },
                  "Days since FI",
                ),
              ),
          ),
        ),
      ),
      React.createElement(
        "div",
        {
          className: "px-5 py-3 flex items-center gap-3",
          style: { backgroundColor: y ? "#ecfdf5" : "#fef2f2" },
        },
        React.createElement("div", {
          className: "w-2 h-2 rounded-full " + (y ? "bg-emerald-500" : "bg-rose-500"),
        }),
        React.createElement(
          "div",
          { className: "text-sm font-semibold", style: { color: y ? "#065f46" : "#991b1b" } },
          y ? "On pace for probation quotas" : "Behind probation pace — coaching intervention required",
        ),
        React.createElement(
          "span",
          { className: "text-[10px] text-stone-500 font-mono ml-auto" },
          "Expected by today: ",
          v,
          "% · API: ",
          b,
          "% · Apps: ",
          f,
          "%",
        ),
      ),
    ),
    React.createElement(
      Section,
      { title: "Production vs probation quotas", subtitle: "Live data from BRANCH SETTLED", defaultOpen: !0 },
      !s &&
        React.createElement(
          "div",
          {
            className: "px-3 py-3 mb-3 bg-amber-50 border border-amber-200 rounded-sm text-xs text-amber-900",
          },
          React.createElement("strong", null, "No production data yet."),
          " Set the agent number in Onboarding stage to enable live tracking.",
        ),
      React.createElement(
        "div",
        { className: "space-y-3" },
        React.createElement(ProductionBar, {
          label: "Annualized Premium Income",
          actual: u,
          target: a.quotas.apiTarget,
          pct: b,
          expectedPct: v,
          format: "money",
        }),
        React.createElement(ProductionBar, {
          label: "Settled applications",
          actual: h,
          target: a.quotas.settledAppsTarget,
          pct: f,
          expectedPct: v,
          format: "count",
        }),
        React.createElement(ProductionBar, {
          label: "Commissions earned (estimated)",
          actual: g,
          target: a.quotas.commissionsTarget,
          pct: x,
          expectedPct: v,
          format: "money",
          note: "Estimated as 40% of API. Live commissions data not available.",
        }),
      ),
      React.createElement(
        "div",
        { className: "mt-5 px-4 py-3 border-l-4 border-rose-500 bg-rose-50/40 rounded-r-sm" },
        React.createElement(
          "div",
          { className: "flex items-center justify-between mb-2 flex-wrap gap-2" },
          React.createElement(
            "div",
            null,
            React.createElement(
              "div",
              { className: "text-[10px] uppercase tracking-wider text-rose-900 font-semibold" },
              "12-month milestone (Clause 3d)",
            ),
            React.createElement(
              "div",
              { className: "text-xs text-stone-700 mt-0.5" },
              "If $250,000 API + $100,000 commissions not met by month 12 → contract terminates.",
            ),
          ),
          React.createElement(
            "span",
            { className: "text-[10px] font-mono text-stone-500" },
            a.yearOne.milestoneDate ? `Due ${a.yearOne.milestoneDate}` : "Set milestone date",
          ),
        ),
        React.createElement(
          "div",
          { className: "grid gap-3 md:grid-cols-2" },
          React.createElement(
            "div",
            null,
            React.createElement(
              "div",
              { className: "flex items-center justify-between text-xs mb-1" },
              React.createElement("span", { className: "text-stone-700" }, "$250k API target"),
              React.createElement("span", { className: "font-mono text-stone-600" }, "$", u.toLocaleString()),
            ),
            React.createElement(
              "div",
              { className: "h-2 bg-stone-200 rounded-full overflow-hidden" },
              React.createElement("div", {
                className: "h-full bg-rose-600",
                style: { width: `${Math.min(100, (u / 25e4) * 100)}%` },
              }),
            ),
          ),
          React.createElement(
            "div",
            null,
            React.createElement(
              "div",
              { className: "flex items-center justify-between text-xs mb-1" },
              React.createElement("span", { className: "text-stone-700" }, "$100k commissions"),
              React.createElement("span", { className: "font-mono text-stone-600" }, "$", g.toLocaleString()),
            ),
            React.createElement(
              "div",
              { className: "h-2 bg-stone-200 rounded-full overflow-hidden" },
              React.createElement("div", {
                className: "h-full bg-rose-600",
                style: { width: `${Math.min(100, (g / 1e5) * 100)}%` },
              }),
            ),
          ),
        ),
      ),
    ),
    React.createElement(ContractCard, {
      candidateName: R,
      candidateAddress: N,
      branchManager: E,
      unitManager: w,
      agentNumber: r,
      ind: a,
      upd: n,
    }),
    React.createElement(MarketSurveyIntelCard, { surveys: e.stages.discovery?.marketSurveys || [] }),
    React.createElement(
      Section,
      { title: "Coaching reports & weekly check-ins", defaultOpen: !0 },
      React.createElement(
        "div",
        {
          className:
            "px-3 py-3 mb-3 bg-stone-50 border-l-4 border-stone-400 rounded-r-sm text-xs text-stone-700",
        },
        "Coaching during probation is the BM's responsibility. Weekly check-ins are required by Clause 4a (Sales Activity Tool turned over to Sales Manager every Monday).",
      ),
      React.createElement(WeeklyCheckInsList, {
        items: a.weeklyCheckIns || [],
        upd: (e) => n(["weeklyCheckIns"], e),
      }),
      React.createElement(
        "div",
        { className: "mt-3" },
        React.createElement(TextArea, {
          label: "Overall coaching notes (running record)",
          value: a.coachingNotes || "",
          onChange: (e) => n(["coachingNotes"], e),
          rows: 3,
          placeholder: "Patterns, breakthroughs, repeat issues, escalation triggers.",
        }),
      ),
    ),
    a.terminated
      ? React.createElement(
          "div",
          { className: "border-2 border-rose-400 bg-rose-50 rounded-sm p-4" },
          React.createElement(
            "div",
            { className: "flex items-center gap-2 mb-2" },
            React.createElement(X, { className: "w-5 h-5 text-rose-700" }),
            React.createElement(
              "h4",
              { className: "font-serif text-base text-rose-900" },
              "Probation terminated",
            ),
          ),
          React.createElement(
            Grid,
            { cols: 2 },
            React.createElement(TextInput, {
              label: "Termination date",
              type: "date",
              value: a.terminationDate,
              onChange: (e) => n(["terminationDate"], e),
            }),
            React.createElement(Select, {
              label: "Clause invoked",
              value: a.terminationClause,
              onChange: (e) => n(["terminationClause"], e),
              options: [
                ["3a", "3a — quota unlikely"],
                ["3b", "3b — quota not met"],
                ["3d", "3d — 12-month threshold"],
                ["3e", "3e — summary termination"],
              ],
            }),
            React.createElement(
              "div",
              { className: "md:col-span-2" },
              React.createElement(TextArea, {
                label: "Reason / context",
                value: a.terminationReason,
                onChange: (e) => n(["terminationReason"], e),
                rows: 2,
              }),
            ),
          ),
        )
      : React.createElement(
          Section,
          { title: "Termination triggers", subtitle: "Clause 3 of contract", defaultOpen: !1 },
          React.createElement(
            "div",
            { className: "space-y-2 text-xs text-stone-700" },
            React.createElement(
              "div",
              { className: "flex items-start gap-2 px-3 py-2 bg-stone-50 rounded-sm" },
              React.createElement("span", { className: "font-mono text-stone-400" }, "3a"),
              React.createElement(
                "span",
                null,
                "Company opinion that quotas unlikely to be met → terminate at any time",
              ),
            ),
            React.createElement(
              "div",
              { className: "flex items-start gap-2 px-3 py-2 bg-stone-50 rounded-sm" },
              React.createElement("span", { className: "font-mono text-stone-400" }, "3b"),
              React.createElement(
                "span",
                null,
                "Failure to meet 7-month quotas + no extension granted → terminate at probation end",
              ),
            ),
            React.createElement(
              "div",
              { className: "flex items-start gap-2 px-3 py-2 bg-rose-50 rounded-sm" },
              React.createElement("span", { className: "font-mono text-rose-700 font-bold" }, "3d"),
              React.createElement(
                "span",
                { className: "text-rose-900" },
                React.createElement(
                  "strong",
                  null,
                  "$250k API + $100k commissions not met by month 12 → immediate termination",
                ),
              ),
            ),
            React.createElement(
              "div",
              { className: "flex items-start gap-2 px-3 py-2 bg-stone-50 rounded-sm" },
              React.createElement("span", { className: "font-mono text-stone-400" }, "3e"),
              React.createElement(
                "span",
                null,
                "Fraud / failure to attend 1+ months / loss of registration / regulatory non-compliance → summary termination",
              ),
            ),
          ),
          React.createElement(
            "div",
            { className: "mt-4 flex items-center gap-2" },
            React.createElement(
              "button",
              {
                onClick: () => {
                  confirm(`Confirm termination for ${R}?`) &&
                    (n(["terminated"], !0), n(["terminationDate"], new Date().toISOString().slice(0, 10)));
                },
                className:
                  "text-xs px-3 py-1.5 bg-rose-600 text-white rounded-sm hover:bg-rose-700 transition-colors",
              },
              "Mark as terminated",
            ),
          ),
        ),
  );
}
function ProductionBar({ label: e, actual: t, target: a, pct: n, expectedPct: r, format: s, note: o }) {
  const c = (e) => ("money" === s ? `$${(e || 0).toLocaleString()}` : (e || 0).toString()),
    i = n >= r - 10;
  return React.createElement(
    "div",
    null,
    React.createElement(
      "div",
      { className: "flex items-baseline justify-between mb-1.5 flex-wrap gap-1" },
      React.createElement("div", { className: "text-sm font-medium text-stone-800" }, e),
      React.createElement(
        "div",
        { className: "flex items-baseline gap-2" },
        React.createElement(
          "span",
          { className: "font-serif text-lg font-bold", style: { color: i ? "#059669" : "#dc2626" } },
          c(t),
        ),
        React.createElement("span", { className: "text-stone-400 text-sm" }, "of ", c(a)),
        React.createElement(
          "span",
          {
            className: "text-[10px] font-mono px-1.5 py-0.5 rounded-sm",
            style: { backgroundColor: i ? "#d1fae5" : "#fee2e2", color: i ? "#065f46" : "#991b1b" },
          },
          n,
          "%",
        ),
      ),
    ),
    React.createElement(
      "div",
      { className: "relative h-3 bg-stone-200 rounded-full overflow-hidden" },
      React.createElement("div", {
        className: "absolute top-0 bottom-0 w-0.5 bg-stone-700 z-10",
        style: { left: `${Math.min(100, r)}%` },
        title: `Expected pace: ${r}%`,
      }),
      React.createElement("div", {
        className: "h-full transition-all duration-500",
        style: { width: `${Math.min(100, n)}%`, backgroundColor: i ? "#10b981" : "#dc2626" },
      }),
    ),
    o && React.createElement("div", { className: "text-[10px] text-stone-500 italic mt-1" }, o),
  );
}
function ContractCard({
  candidateName: e,
  candidateAddress: t,
  branchManager: a,
  unitManager: n,
  agentNumber: r,
  ind: s,
  upd: o,
}) {
  const [c, i] = useState(!1),
    l = s.contract,
    m =
      s.submissions.td1Form.submitted &&
      s.submissions.birthCertificate.submitted &&
      s.submissions.nis.submitted,
    d = s.submissions.stateLicense.passed;
  return React.createElement(
    "div",
    { className: "border-2 border-stone-900 rounded-sm overflow-hidden bg-white" },
    React.createElement(
      "div",
      {
        className: "px-5 py-3 flex items-center justify-between",
        style: { background: "linear-gradient(90deg, #07131f 0%, #2c4d7a 100%)", color: "white" },
      },
      React.createElement(
        "div",
        { className: "flex items-center gap-3" },
        React.createElement(FileText, { className: "w-5 h-5" }),
        React.createElement(
          "div",
          null,
          React.createElement(
            "div",
            { className: "text-[10px] uppercase tracking-[0.18em] text-stone-300 font-semibold" },
            "Probation Contract",
          ),
          React.createElement(
            "div",
            { className: "font-serif text-base" },
            "Standard GLOC Sales Representative Agreement",
          ),
        ),
      ),
      React.createElement(
        "button",
        {
          onClick: () => i(!c),
          className:
            "text-xs px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-sm transition-colors flex items-center gap-1.5",
        },
        c ? "Collapse" : "View letter",
        React.createElement(ChevronDown, {
          className: "w-3 h-3 transition-transform " + (c ? "rotate-180" : ""),
        }),
      ),
    ),
    React.createElement(
      "div",
      { className: "px-4 py-3 bg-stone-50 border-b border-stone-200 grid gap-3 md:grid-cols-3" },
      React.createElement(
        "div",
        null,
        React.createElement(
          "label",
          { className: "block text-[10px] uppercase tracking-wider text-stone-500 mb-1" },
          "Issue date",
        ),
        React.createElement("input", {
          type: "date",
          value: l.issueDate || "",
          onChange: (e) => o(["contract", "issueDate"], e.target.value),
          className: "w-full text-xs px-2 py-1.5 border border-stone-300 rounded-sm bg-white",
        }),
      ),
      React.createElement(
        "div",
        null,
        React.createElement(
          "label",
          { className: "block text-[10px] uppercase tracking-wider text-stone-500 mb-1" },
          "Probation start",
        ),
        React.createElement("input", {
          type: "date",
          value: l.probationStart || "",
          onChange: (e) => {
            if ((o(["contract", "probationStart"], e.target.value), e.target.value)) {
              const t = new Date(e.target.value),
                a = new Date(t);
              (a.setMonth(a.getMonth() + 7),
                a.setDate(a.getDate() - 1),
                o(["contract", "probationEnd"], a.toISOString().slice(0, 10)));
              const n = new Date(t);
              (n.setFullYear(n.getFullYear() + 1),
                o(["yearOne", "milestoneDate"], n.toISOString().slice(0, 10)));
            }
          },
          className: "w-full text-xs px-2 py-1.5 border border-stone-300 rounded-sm bg-white",
        }),
      ),
      React.createElement(
        "div",
        null,
        React.createElement(
          "label",
          { className: "block text-[10px] uppercase tracking-wider text-stone-500 mb-1" },
          "Probation end (auto)",
        ),
        React.createElement("input", {
          type: "date",
          value: l.probationEnd || "",
          onChange: (e) => o(["contract", "probationEnd"], e.target.value),
          className: "w-full text-xs px-2 py-1.5 border border-stone-300 rounded-sm bg-stone-100",
        }),
      ),
    ),
    React.createElement(
      "div",
      { className: "px-4 py-3 border-b border-stone-200" },
      React.createElement(
        "div",
        { className: "text-[10px] uppercase tracking-[0.14em] text-stone-700 font-semibold mb-3" },
        "Required submissions",
      ),
      React.createElement(
        "div",
        { className: "grid gap-2 md:grid-cols-2" },
        React.createElement(DocCheck, {
          label: "TD1 Form (BIR)",
          obj: s.submissions.td1Form,
          onChange: (e) => o(["submissions", "td1Form"], e),
        }),
        React.createElement(DocCheck, {
          label: "Birth Certificate",
          obj: s.submissions.birthCertificate,
          onChange: (e) => o(["submissions", "birthCertificate"], e),
        }),
        React.createElement(DocCheck, {
          label: "NIS Number",
          obj: s.submissions.nis,
          onChange: (e) => o(["submissions", "nis"], e),
        }),
        React.createElement(
          "div",
          { className: "px-3 py-2 border border-stone-200 rounded-sm bg-stone-50" },
          React.createElement(
            "div",
            { className: "flex items-center justify-between mb-1.5" },
            React.createElement(
              "span",
              { className: "text-xs font-medium text-stone-800" },
              "State Licensing Exam (T&T Insurance Institute)",
            ),
            d && React.createElement(CheckCircle2, { className: "w-4 h-4 text-emerald-600" }),
          ),
          React.createElement(
            "div",
            { className: "grid grid-cols-3 gap-1.5 text-[10px]" },
            React.createElement(
              "label",
              { className: "inline-flex items-center gap-1" },
              React.createElement("input", {
                type: "checkbox",
                checked: s.submissions.stateLicense.applied,
                onChange: (e) => o(["submissions", "stateLicense", "applied"], e.target.checked),
              }),
              "Applied",
            ),
            React.createElement(
              "label",
              { className: "inline-flex items-center gap-1" },
              React.createElement("input", {
                type: "checkbox",
                checked: s.submissions.stateLicense.sat,
                onChange: (e) => o(["submissions", "stateLicense", "sat"], e.target.checked),
              }),
              "Sat exam",
            ),
            React.createElement(
              "label",
              { className: "inline-flex items-center gap-1" },
              React.createElement("input", {
                type: "checkbox",
                checked: s.submissions.stateLicense.passed,
                onChange: (e) => o(["submissions", "stateLicense", "passed"], e.target.checked),
              }),
              "Passed",
            ),
          ),
        ),
      ),
      React.createElement(
        "div",
        { className: "mt-3 text-[10px] text-stone-500 italic" },
        m
          ? "✓ All required docs received"
          : "Outstanding submissions. Failure to license within 12 months voids contract.",
      ),
    ),
    c &&
      React.createElement(
        "div",
        {
          className: "px-5 py-5 bg-white border-b border-stone-200",
          style: { fontFamily: "Newsreader, Georgia, serif" },
        },
        React.createElement(
          "div",
          { className: "max-w-2xl mx-auto space-y-4" },
          React.createElement(
            "div",
            { className: "text-right text-xs text-stone-500 font-mono" },
            l.issueDate
              ? new Date(l.issueDate).toLocaleDateString("en-GB", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })
              : "[Issue date]",
          ),
          React.createElement(
            "div",
            null,
            React.createElement("div", { className: "text-base font-semibold text-stone-900" }, e),
            React.createElement("div", { className: "text-sm text-stone-700 whitespace-pre-line" }, t),
          ),
          React.createElement(
            "div",
            { className: "font-medium text-stone-900" },
            "Dear ",
            e.split(" ")[0],
            ",",
          ),
          React.createElement(
            "p",
            { className: "text-sm text-stone-800 leading-relaxed" },
            "Further to your application for the position of ",
            React.createElement("strong", null, "Sales Representative"),
            ", the Company is pleased to offer you a contract on standard terms, subject to a ",
            React.createElement("strong", { className: "text-rose-700" }, "7-month probationary period"),
            " commencing ",
            React.createElement("strong", { className: "font-mono" }, l.probationStart || "[start date]"),
            " and expiring ",
            React.createElement("strong", { className: "font-mono" }, l.probationEnd || "[end date]"),
            ".",
          ),
          React.createElement(
            "div",
            { className: "border-l-4 border-stone-900 pl-4 py-2 bg-stone-50/50" },
            React.createElement(
              "div",
              { className: "text-[10px] uppercase tracking-wider text-stone-500 font-semibold mb-1" },
              "Branch Assignment",
            ),
            React.createElement(
              "div",
              { className: "text-sm text-stone-900" },
              "Assigned to ",
              React.createElement("strong", null, a, "'s Branch"),
              " under ",
              React.createElement("strong", null, n, "'s Unit"),
              ".",
            ),
            React.createElement(
              "div",
              { className: "text-sm text-stone-900" },
              "Branch location: ",
              React.createElement("strong", null, l.branchLocation),
            ),
            r &&
              React.createElement(
                "div",
                { className: "text-sm text-stone-900" },
                "Agent Number: ",
                React.createElement(
                  "strong",
                  { className: "font-mono text-stone-900 bg-amber-100 px-1.5 py-0.5 rounded-sm" },
                  r,
                ),
              ),
          ),
          React.createElement(
            "div",
            null,
            React.createElement(
              "div",
              { className: "text-[10px] uppercase tracking-wider text-stone-500 font-semibold mb-2" },
              "Probation Quotas (Clause 2b)",
            ),
            React.createElement(
              "div",
              { className: "grid gap-2" },
              React.createElement(QuotaLine, {
                label: "Annualized Premium Income",
                value: `$${s.quotas.apiTarget.toLocaleString()}`,
              }),
              React.createElement(QuotaLine, {
                label: "Commissions",
                value: `$${s.quotas.commissionsTarget.toLocaleString()}`,
              }),
              React.createElement(QuotaLine, {
                label: "Settled Applications",
                value: `${s.quotas.settledAppsTarget}`,
              }),
              React.createElement(QuotaLine, {
                label: "Persistency",
                value: `≥ ${s.quotas.persistencyTarget}%`,
              }),
            ),
            React.createElement(
              "div",
              { className: "mt-2 text-xs text-stone-600 italic" },
              "Policies on own/immediate family lives are excluded. Settling considerably in excess is expected.",
            ),
          ),
          React.createElement(
            "div",
            { className: "border-2 border-rose-300 bg-rose-50/40 px-4 py-3 rounded-sm" },
            React.createElement(
              "div",
              { className: "text-[10px] uppercase tracking-wider text-rose-900 font-semibold mb-1" },
              "12-Month Milestone (Clause 3d)",
            ),
            React.createElement(
              "p",
              { className: "text-sm text-stone-800" },
              "If ",
              React.createElement("strong", null, "$250,000 API"),
              " + ",
              React.createElement("strong", null, "$100,000 commissions"),
              " are not met after 12 months, this contract ",
              React.createElement("strong", { className: "text-rose-700" }, "terminates immediately"),
              ".",
            ),
          ),
          React.createElement(
            "p",
            { className: "text-sm text-stone-700 leading-relaxed" },
            "During probation there is ",
            React.createElement("strong", null, "no financing"),
            "; payment is strictly on commissions earned. The ",
            React.createElement("strong", null, "Sales Activity Tool"),
            " must be completed daily and turned over to your Unit Manager every Monday.",
          ),
          React.createElement(
            "p",
            { className: "text-sm text-stone-700 leading-relaxed" },
            "You will be required to sit and pass the ",
            React.createElement("strong", null, "State Licensing Examination"),
            " (T&T Insurance Institute) within your first year. You must submit ",
            React.createElement("strong", null, "TD1, Birth Certificate, and NIS"),
            " immediately upon acceptance.",
          ),
          React.createElement(
            "div",
            { className: "pt-4 border-t border-stone-300" },
            React.createElement("div", { className: "text-sm text-stone-700" }, "Yours sincerely,"),
            React.createElement(
              "div",
              { className: "mt-3 text-base font-medium text-stone-900" },
              l.issuedBy,
            ),
            React.createElement("div", { className: "text-xs text-stone-600" }, l.issuedByTitle),
            React.createElement(
              "div",
              { className: "text-[10px] text-stone-500 mt-3" },
              "cc: ",
              a,
              ", Branch Manager · ",
              n,
              ", Unit Manager",
            ),
          ),
          React.createElement(
            "div",
            { className: "mt-6 pt-4 border-t-2 border-stone-900" },
            React.createElement(
              "div",
              { className: "text-[10px] uppercase tracking-wider text-stone-700 font-semibold mb-2" },
              "Acceptance by Candidate",
            ),
            React.createElement(
              "div",
              { className: "grid gap-2 md:grid-cols-2" },
              React.createElement(
                "label",
                { className: "inline-flex items-center gap-2 text-sm text-stone-800" },
                React.createElement("input", {
                  type: "checkbox",
                  checked: l.candidateAccepted,
                  onChange: (e) => o(["contract", "candidateAccepted"], e.target.checked),
                }),
                "Candidate accepted & signed",
              ),
              React.createElement("input", {
                type: "date",
                value: l.candidateSignedDate || "",
                onChange: (e) => o(["contract", "candidateSignedDate"], e.target.value),
                className: "text-xs px-2 py-1.5 border border-stone-300 rounded-sm",
              }),
            ),
          ),
        ),
      ),
  );
}
function QuotaLine({ label: e, value: t }) {
  return React.createElement(
    "div",
    {
      className:
        "flex items-center justify-between py-1.5 px-3 bg-stone-50 rounded-sm border border-stone-200",
    },
    React.createElement("span", { className: "text-sm text-stone-700" }, e),
    React.createElement("span", { className: "font-mono text-sm font-bold text-stone-900" }, t),
  );
}
function DocCheck({ label: e, obj: t, onChange: a }) {
  return React.createElement(
    "div",
    {
      className:
        "px-3 py-2 border border-stone-200 rounded-sm bg-stone-50 flex items-center justify-between gap-3",
    },
    React.createElement(
      "label",
      { className: "inline-flex items-center gap-2 text-xs flex-1 cursor-pointer" },
      React.createElement("input", {
        type: "checkbox",
        checked: t.submitted,
        onChange: (e) =>
          a({
            ...t,
            submitted: e.target.checked,
            date: e.target.checked && !t.date ? new Date().toISOString().slice(0, 10) : t.date,
          }),
      }),
      React.createElement(
        "span",
        { className: t.submitted ? "text-stone-500 line-through" : "text-stone-800 font-medium" },
        e,
      ),
    ),
    t.submitted &&
      t.date &&
      React.createElement("span", { className: "text-[10px] font-mono text-emerald-700" }, t.date),
  );
}
function MarketSurveyIntelCard({ surveys: e }) {
  if (!e || 0 === e.length)
    return React.createElement(
      Section,
      { title: "Market survey pipeline", subtitle: "Carried forward from Discovery", defaultOpen: !1 },
      React.createElement(
        "div",
        { className: "text-xs text-stone-500 italic" },
        "No market surveys captured during Discovery.",
      ),
    );
  const t = e.length,
    a = {},
    n = {},
    r = { yes: 0, maybe: 0, no: 0 };
  let s = 0;
  e.forEach((e) => {
    (e.source && (a[e.source] = (a[e.source] || 0) + 1),
      e.incomeRange && (n[e.incomeRange] = (n[e.incomeRange] || 0) + 1),
      "yes" === e.couldApproach
        ? r.yes++
        : "maybe" === e.couldApproach
          ? r.maybe++
          : "no" === e.couldApproach && r.no++);
    const t = MS_INCOME.find((t) => t[0] === e.incomeRange);
    t && (s += t[2]);
  });
  const o = Object.entries(a)
    .sort((e, t) => t[1] - e[1])
    .slice(0, 5);
  (r.yes, r.maybe);
  return React.createElement(
    Section,
    {
      title: "Market survey intel",
      subtitle: `${t} prospects from Discovery, rolled into Induction pipeline`,
      defaultOpen: !0,
    },
    React.createElement(
      "div",
      { className: "grid gap-3 md:grid-cols-4 mb-4" },
      React.createElement(
        "div",
        {
          className:
            "px-4 py-3 bg-gradient-to-br from-emerald-50 to-emerald-100/50 border border-emerald-200 rounded-sm",
        },
        React.createElement(
          "div",
          { className: "text-[10px] uppercase tracking-wider text-emerald-700 mb-1" },
          "Approachable now",
        ),
        React.createElement("div", { className: "font-serif text-2xl text-emerald-900" }, r.yes),
        React.createElement("div", { className: "text-[10px] text-emerald-700 mt-0.5" }, '"Yes" responses'),
      ),
      React.createElement(
        "div",
        {
          className:
            "px-4 py-3 bg-gradient-to-br from-amber-50 to-amber-100/50 border border-amber-200 rounded-sm",
        },
        React.createElement(
          "div",
          { className: "text-[10px] uppercase tracking-wider text-amber-700 mb-1" },
          "Possibles",
        ),
        React.createElement("div", { className: "font-serif text-2xl text-amber-900" }, r.maybe),
        React.createElement("div", { className: "text-[10px] text-amber-700 mt-0.5" }, '"Maybe" responses'),
      ),
      React.createElement(
        "div",
        {
          className:
            "px-4 py-3 bg-gradient-to-br from-stone-50 to-stone-100 border border-stone-200 rounded-sm",
        },
        React.createElement(
          "div",
          { className: "text-[10px] uppercase tracking-wider text-stone-600 mb-1" },
          "Total prospects",
        ),
        React.createElement("div", { className: "font-serif text-2xl text-stone-900" }, t),
        React.createElement("div", { className: "text-[10px] text-stone-600 mt-0.5" }, "In pipeline"),
      ),
      React.createElement(
        "div",
        {
          className:
            "px-4 py-3 bg-gradient-to-br from-blue-50 to-blue-100/50 border border-blue-200 rounded-sm",
        },
        React.createElement(
          "div",
          { className: "text-[10px] uppercase tracking-wider text-blue-700 mb-1" },
          "Est. market value",
        ),
        React.createElement(
          "div",
          { className: "font-serif text-2xl text-blue-900" },
          "$",
          (s / 1e3).toFixed(0),
          "k",
        ),
        React.createElement(
          "div",
          { className: "text-[10px] text-blue-700 mt-0.5" },
          "Aggregate annual income",
        ),
      ),
    ),
    o.length > 0 &&
      React.createElement(
        "div",
        null,
        React.createElement(
          "div",
          { className: "text-[10px] uppercase tracking-[0.14em] text-stone-700 font-semibold mb-2" },
          "Top source segments",
        ),
        React.createElement(
          "div",
          { className: "space-y-1.5" },
          o.map(([e, a]) => {
            const n = MS_SOURCES.find((t) => t[0] === e)?.[1] || e,
              r = Math.round((a / t) * 100);
            return React.createElement(
              "div",
              { key: e, className: "flex items-center gap-3" },
              React.createElement("div", { className: "text-xs font-mono text-stone-500 w-6" }, e),
              React.createElement("div", { className: "flex-1 text-xs text-stone-700" }, n),
              React.createElement(
                "div",
                { className: "w-32 h-1.5 bg-stone-200 rounded-full overflow-hidden" },
                React.createElement("div", { className: "h-full bg-stone-700", style: { width: `${r}%` } }),
              ),
              React.createElement("div", { className: "text-xs font-mono text-stone-600 w-8 text-right" }, a),
            );
          }),
        ),
      ),
    React.createElement(
      "div",
      {
        className:
          "mt-3 px-3 py-2 bg-stone-50 border-l-2 border-stone-700 rounded-r-sm text-xs text-stone-700",
      },
      React.createElement("strong", null, "Coaching priority:"),
      " Convert the ",
      r.yes,
      ' "approachable now" prospects in the first 30 days. They are the warmest pipeline this recruit will ever have.',
    ),
  );
}
function WeeklyCheckInsList({ items: e, upd: t }) {
  const a = (a, n) => {
    t(e.map((e, t) => (t === a ? { ...e, ...n } : e)));
  };
  return React.createElement(
    "div",
    { className: "space-y-2" },
    e.map((n, r) =>
      React.createElement(
        "div",
        { key: n.id, className: "border border-stone-200 rounded-sm bg-white" },
        React.createElement(
          "div",
          { className: "px-3 py-2 flex items-center gap-2 border-b border-stone-200 bg-stone-50" },
          React.createElement(Calendar, { className: "w-3.5 h-3.5 text-stone-500" }),
          React.createElement("input", {
            type: "date",
            value: n.date,
            onChange: (e) => a(r, { date: e.target.value }),
            className: "text-xs px-2 py-1 border border-stone-300 rounded-sm bg-white",
          }),
          React.createElement(
            "select",
            {
              value: n.attendance,
              onChange: (e) => a(r, { attendance: e.target.value }),
              className: "text-xs px-2 py-1 border border-stone-300 rounded-sm bg-white",
            },
            React.createElement("option", { value: "" }, "Attendance…"),
            React.createElement("option", { value: "present" }, "Present"),
            React.createElement("option", { value: "late" }, "Late"),
            React.createElement("option", { value: "missed" }, "Missed"),
          ),
          React.createElement(
            "button",
            {
              onClick: () => ((a) => t(e.filter((e, t) => t !== a)))(r),
              className: "ml-auto text-stone-400 hover:text-rose-600",
            },
            React.createElement(Trash2, { className: "w-3.5 h-3.5" }),
          ),
        ),
        React.createElement(
          "div",
          { className: "px-3 py-2 grid gap-2 md:grid-cols-2" },
          React.createElement("textarea", {
            value: n.observations,
            onChange: (e) => a(r, { observations: e.target.value }),
            placeholder: "What was observed (production, mood, blockers)…",
            rows: 2,
            className:
              "text-xs px-2 py-1.5 border border-stone-200 rounded-sm bg-white resize-none focus:outline-none focus:border-stone-400",
          }),
          React.createElement("textarea", {
            value: n.actionItems,
            onChange: (e) => a(r, { actionItems: e.target.value }),
            placeholder: "Action items for the week…",
            rows: 2,
            className:
              "text-xs px-2 py-1.5 border border-stone-200 rounded-sm bg-white resize-none focus:outline-none focus:border-stone-400",
          }),
        ),
      ),
    ),
    React.createElement(
      "button",
      {
        onClick: () => {
          t([
            ...e,
            {
              id: "wk_" + Math.random().toString(36).slice(2, 8),
              date: new Date().toISOString().slice(0, 10),
              attendance: "",
              observations: "",
              actionItems: "",
            },
          ]);
        },
        className:
          "w-full text-xs px-3 py-2 border-2 border-dashed border-stone-300 rounded-sm text-stone-600 hover:border-stone-500 hover:text-stone-900 hover:bg-stone-50 transition-colors flex items-center justify-center gap-1.5",
      },
      React.createElement(Plus, { className: "w-3.5 h-3.5" }),
      " Add weekly check-in",
    ),
  );
}
function AccountabilityMatrix({ candidates: e, activeUser: t, expanded: a, onToggle: n }) {
  const r = useMemo(() => {
      const t = e.filter((e) => "induction" !== e.meta.currentStage || !e.stages.induction?.terminated),
        a = {
          RM: { total: 0, done: 0, candidates: new Set(), items: [] },
          BM: { total: 0, done: 0, candidates: new Set(), items: [] },
          BMA: { total: 0, done: 0, candidates: new Set(), items: [] },
          Candidate: { total: 0, done: 0, candidates: new Set(), items: [] },
        };
      t.forEach((e) => {
        const t =
            "Yes" === e.meta?.internalCandidate || e.stages?.firstInterview?.experienceBranch
              ? FILE_PREP_EXPERIENCED
              : FILE_PREP_INEXPERIENCED,
          n = e.stages?.selectionFile?.filePrepChecklist || {};
        t.forEach((t) => {
          const r = t.owner || "RM";
          if (!a[r]) return;
          (a[r].total++, a[r].candidates.add(e.id));
          !!n[t.num]
            ? a[r].done++
            : a[r].items.push({
                candidate: e.meta.name || "Unnamed",
                candidateId: e.id,
                item: t.item,
                num: t.num,
                stage: e.meta.currentStage,
              });
        });
      });
      const n = {};
      return (
        t.forEach((e) => {
          const t = e.meta?.recruitingManager || "— unassigned —";
          n[t] || (n[t] = { total: 0, done: 0, candidates: new Set(), items: [] });
          const a = "Yes" === e.meta?.internalCandidate ? FILE_PREP_EXPERIENCED : FILE_PREP_INEXPERIENCED,
            r = e.stages?.selectionFile?.filePrepChecklist || {};
          a.forEach((a) => {
            if ("RM" !== a.owner) return;
            (n[t].total++, n[t].candidates.add(e.id));
            !!r[a.num]
              ? n[t].done++
              : n[t].items.push({
                  candidate: e.meta.name || "Unnamed",
                  candidateId: e.id,
                  item: a.item,
                  num: a.num,
                });
          });
        }),
        { ownerStats: a, rmAgg: n }
      );
    }, [e]),
    s = { RM: "#7c3aed", BM: "#07131f", BMA: "#d97706", Candidate: "#0891b2" };
  return React.createElement(
    "div",
    { className: "bg-white border border-stone-200 rounded-sm overflow-hidden" },
    React.createElement(
      "button",
      {
        onClick: n,
        className: "w-full px-4 py-3 flex items-center justify-between hover:bg-stone-50 transition-colors",
      },
      React.createElement(
        "div",
        { className: "flex items-center gap-3" },
        React.createElement(ClipboardCheck, { className: "w-4 h-4 text-stone-700" }),
        React.createElement(
          "div",
          { className: "text-left" },
          React.createElement(
            "div",
            { className: "font-medium text-sm text-stone-900" },
            "File completion accountability",
          ),
          React.createElement(
            "div",
            { className: "text-[11px] text-stone-500" },
            "Who owes what across all active candidates",
          ),
        ),
      ),
      React.createElement(
        "div",
        { className: "flex items-center gap-3" },
        Object.entries(r.ownerStats).map(([e, t]) => {
          if (0 === t.total) return null;
          const a = t.total > 0 ? Math.round((t.done / t.total) * 100) : 0,
            n = t.total - t.done;
          return React.createElement(
            "div",
            { key: e, className: "text-right" },
            React.createElement(
              "div",
              { className: "text-[10px] uppercase tracking-wider text-stone-500 leading-none" },
              e,
            ),
            React.createElement(
              "div",
              { className: "flex items-center gap-1.5 mt-0.5" },
              React.createElement(
                "span",
                {
                  className: "font-mono font-bold text-sm",
                  style: { color: a >= 80 ? "#059669" : a >= 50 ? "#d97706" : "#dc2626" },
                },
                a,
                "%",
              ),
              n > 0 &&
                React.createElement(
                  "span",
                  { className: "text-[10px] font-mono px-1.5 py-0.5 bg-rose-100 text-rose-800 rounded-sm" },
                  n,
                  " open",
                ),
            ),
          );
        }),
        React.createElement(ChevronDown, {
          className: "w-4 h-4 text-stone-400 transition-transform " + (a ? "rotate-180" : ""),
        }),
      ),
    ),
    a &&
      React.createElement(
        "div",
        { className: "border-t border-stone-200 bg-stone-50/50" },
        React.createElement(
          "div",
          { className: "grid gap-3 md:grid-cols-4 p-3" },
          Object.entries(r.ownerStats).map(([e, t]) => {
            if (0 === t.total) return null;
            const a = t.total > 0 ? Math.round((t.done / t.total) * 100) : 0,
              n = t.total - t.done;
            return React.createElement(
              "div",
              {
                key: e,
                className: "bg-white border rounded-sm overflow-hidden",
                style: { borderColor: s[e] + "60" },
              },
              React.createElement(
                "div",
                {
                  className: "px-3 py-2 border-b",
                  style: { backgroundColor: s[e] + "15", borderColor: s[e] + "40" },
                },
                React.createElement(
                  "div",
                  { className: "flex items-center justify-between" },
                  React.createElement(
                    "span",
                    { className: "text-xs font-bold uppercase tracking-wider", style: { color: s[e] } },
                    e,
                  ),
                  React.createElement(
                    "span",
                    { className: "font-serif text-lg font-bold", style: { color: s[e] } },
                    a,
                    "%",
                  ),
                ),
                React.createElement(
                  "div",
                  { className: "text-[10px] text-stone-600 mt-0.5" },
                  t.done,
                  "/",
                  t.total,
                  " items · ",
                  t.candidates.size,
                  " candidate",
                  1 !== t.candidates.size ? "s" : "",
                ),
              ),
              React.createElement(
                "div",
                { className: "h-1.5 bg-stone-200" },
                React.createElement("div", {
                  className: "h-full transition-all",
                  style: { width: `${a}%`, backgroundColor: s[e] },
                }),
              ),
              n > 0 &&
                React.createElement(
                  "div",
                  { className: "px-3 py-2 max-h-40 overflow-y-auto" },
                  React.createElement(
                    "div",
                    { className: "text-[10px] uppercase tracking-wider text-stone-500 mb-1.5" },
                    "Outstanding",
                  ),
                  React.createElement(
                    "div",
                    { className: "space-y-1" },
                    t.items
                      .slice(0, 6)
                      .map((e, t) =>
                        React.createElement(
                          "div",
                          { key: t, className: "text-[11px] text-stone-700 leading-tight" },
                          React.createElement("span", { className: "font-mono text-stone-400" }, "#", e.num),
                          " ",
                          React.createElement("span", { className: "font-semibold" }, e.candidate),
                          " ",
                          React.createElement(
                            "span",
                            { className: "text-stone-500" },
                            "— ",
                            e.item.length > 40 ? e.item.slice(0, 40) + "…" : e.item,
                          ),
                        ),
                      ),
                    t.items.length > 6 &&
                      React.createElement(
                        "div",
                        { className: "text-[10px] text-stone-400 italic" },
                        "+ ",
                        t.items.length - 6,
                        " more",
                      ),
                  ),
                ),
            );
          }),
        ),
        Object.keys(r.rmAgg).length > 0 &&
          React.createElement(
            "div",
            { className: "px-3 pb-3" },
            React.createElement(
              "div",
              { className: "text-[10px] uppercase tracking-[0.14em] text-stone-700 font-semibold mb-2" },
              "By Recruiting Manager",
            ),
            React.createElement(
              "div",
              { className: "bg-white border border-stone-200 rounded-sm divide-y divide-stone-100" },
              Object.entries(r.rmAgg)
                .sort((e, t) => t[1].total - t[1].done - (e[1].total - e[1].done))
                .map(([e, t]) => {
                  const a = t.total > 0 ? Math.round((t.done / t.total) * 100) : 0,
                    n = t.total - t.done;
                  return React.createElement(
                    "div",
                    { key: e, className: "flex items-center gap-3 px-3 py-2" },
                    React.createElement(
                      "div",
                      { className: "flex-1 min-w-0" },
                      React.createElement(
                        "div",
                        { className: "text-sm font-medium text-stone-900 truncate" },
                        e,
                      ),
                      React.createElement(
                        "div",
                        { className: "text-[10px] text-stone-500" },
                        t.candidates.size,
                        " recruit",
                        1 !== t.candidates.size ? "s" : "",
                        " · ",
                        t.total,
                        " RM-owned items",
                      ),
                    ),
                    React.createElement(
                      "div",
                      { className: "w-32 h-1.5 bg-stone-200 rounded-full overflow-hidden" },
                      React.createElement("div", {
                        className: "h-full",
                        style: {
                          width: `${a}%`,
                          backgroundColor: a >= 80 ? "#10b981" : a >= 50 ? "#f59e0b" : "#dc2626",
                        },
                      }),
                    ),
                    React.createElement(
                      "div",
                      {
                        className: "text-xs font-mono w-12 text-right",
                        style: { color: a >= 80 ? "#059669" : a >= 50 ? "#d97706" : "#dc2626" },
                      },
                      a,
                      "%",
                    ),
                    n > 0 &&
                      React.createElement(
                        "span",
                        {
                          className:
                            "text-[10px] font-mono px-1.5 py-0.5 bg-rose-100 text-rose-800 rounded-sm w-16 text-center",
                        },
                        n,
                        " open",
                      ),
                  );
                }),
            ),
          ),
      ),
  );
}
function PipelineBoard({
  candidates: e,
  onSelect: t,
  onCreate: a,
  onDelete: n,
  activeRole: r,
  activeUser: s,
}) {
  const [o, c] = useState(""),
    [i, l] = useState("all"),
    [m, d] = useState(!1),
    p = e.filter(
      (e) =>
        !(o && !`${e.meta.name}`.toLowerCase().includes(o.toLowerCase())) &&
        ("all" === i || e.meta.currentStage === i),
    ),
    u = useMemo(
      () => ({
        total: e.length,
        active: e.filter(
          (e) => "onboarding" !== e.meta.currentStage || computeStageCompletion(e, "onboarding") < 100,
        ).length,
        approved: e.filter(
          (e) =>
            "Approved" === e.stages.approval?.decision ||
            "Approved with conditions" === e.stages.approval?.decision,
        ).length,
        contracted: e.filter((e) => e.stages.onboarding?.contract?.signed).length,
        inFirstInterview: e.filter((e) => "firstInterview" === e.meta.currentStage).length,
        inDiscovery: e.filter((e) => "discovery" === e.meta.currentStage).length,
      }),
      [e],
    ),
    h = {};
  return (
    STAGES.forEach((e) => (h[e.key] = [])),
    p.forEach((e) => {
      const t = e.meta.currentStage || "firstInterview";
      h[t] && h[t].push(e);
    }),
    React.createElement(
      "div",
      { className: "space-y-3" },
      e.length > 0 &&
        React.createElement(
          "div",
          { className: "grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-6" },
          React.createElement(StatBlock, {
            icon: Users,
            label: "Total",
            value: u.total,
            sublabel: "all candidates",
            tone: "navy",
          }),
          React.createElement(StatBlock, {
            icon: TrendingUp,
            label: "Active",
            value: u.active,
            sublabel: "in pipeline",
            tone: "stone",
          }),
          React.createElement(StatBlock, {
            icon: MessageSquare,
            label: "Interviewing",
            value: u.inFirstInterview,
            sublabel: "first interview",
            tone: "amber",
          }),
          React.createElement(StatBlock, {
            icon: GraduationCap,
            label: "Discovery",
            value: u.inDiscovery,
            sublabel: "orientation",
            tone: "amber",
          }),
          React.createElement(StatBlock, {
            icon: ShieldCheck,
            label: "Approved",
            value: u.approved,
            sublabel: "passed approval",
            tone: "emerald",
          }),
          React.createElement(StatBlock, {
            icon: Award,
            label: "Contracted",
            value: u.contracted,
            sublabel: "under contract",
            tone: "emerald",
          }),
        ),
      e.length > 0 &&
        React.createElement(AccountabilityMatrix, {
          candidates: e,
          activeUser: s,
          expanded: m,
          onToggle: () => d(!m),
        }),
      React.createElement(
        "div",
        { className: "flex items-center gap-3 flex-wrap" },
        React.createElement(
          "div",
          { className: "flex-1 min-w-[240px]" },
          React.createElement("input", {
            className: inputCls,
            placeholder: "Search candidates…",
            value: o,
            onChange: (e) => c(e.target.value),
          }),
        ),
        React.createElement(
          "button",
          {
            onClick: a,
            className:
              "inline-flex items-center gap-1.5 px-4 py-2 text-sm bg-stone-900 text-stone-50 rounded-sm hover:bg-stone-700 transition-colors",
          },
          React.createElement(Plus, { className: "w-4 h-4" }),
          " New candidate",
        ),
      ),
      0 === e.length
        ? React.createElement(
            "div",
            {
              className:
                "px-6 py-16 text-center text-stone-500 border border-dashed border-stone-300 rounded-sm bg-white",
            },
            React.createElement(Users, { className: "w-10 h-10 mx-auto mb-3 opacity-50" }),
            React.createElement("div", { className: "text-sm mb-3" }, "No candidates yet."),
            React.createElement(
              "button",
              { onClick: a, className: "text-sm text-stone-700 hover:text-stone-900 underline" },
              "Create the first one",
            ),
          )
        : React.createElement(
            "div",
            { className: "space-y-3" },
            STAGES.map((e) => {
              const a = h[e.key];
              if (0 === a.length) return null;
              const r = e.icon;
              return React.createElement(
                "div",
                { key: e.key, className: "bg-white border border-stone-200 rounded-sm overflow-hidden" },
                React.createElement(
                  "div",
                  {
                    className: "px-4 py-3 bg-stone-100/60 border-b border-stone-200 flex items-center gap-2",
                  },
                  React.createElement(
                    "div",
                    {
                      className:
                        "w-7 h-7 rounded-sm bg-white border border-stone-300 flex items-center justify-center flex-shrink-0",
                    },
                    React.createElement(r, { className: "w-3.5 h-3.5 text-stone-700" }),
                  ),
                  React.createElement("span", { className: "font-medium text-sm text-stone-900" }, e.label),
                  React.createElement(
                    "span",
                    {
                      className:
                        "text-[10px] uppercase tracking-wider text-stone-500 ml-1 px-1.5 py-0.5 bg-white rounded-sm border border-stone-200",
                    },
                    a.length,
                  ),
                ),
                React.createElement(
                  "div",
                  { className: "divide-y divide-stone-100" },
                  a.map((e) =>
                    React.createElement(CandidateRow, {
                      key: e.id,
                      candidate: e,
                      onClick: () => t(e.id),
                      onDelete: () => n(e.id),
                    }),
                  ),
                ),
              );
            }),
          ),
    )
  );
}
function CandidateRow({ candidate: e, onClick: t, onDelete: a }) {
  const [n, r] = useState(!1),
    s = useMemo(() => scoreFirstInterview(e.stages.firstInterview), [e.stages.firstInterview]),
    o = useMemo(() => scoreFormA(e.stages.selectionFile.formA).total, [e.stages.selectionFile.formA]),
    c = (STAGES.find((t) => t.key === e.meta.currentStage), computeStageCompletion(e, e.meta.currentStage)),
    i = useMemo(
      () => Math.round(STAGES.reduce((t, a) => t + computeStageCompletion(e, a.key), 0) / STAGES.length),
      [e],
    ),
    l = e.stages.firstInterview?.date,
    m = l ? Math.floor((Date.now() - new Date(l).getTime()) / 864e5) : null,
    d = useMemo(() => {
      let t = 0;
      for (const a of STAGES) {
        const n = computeStageCompletion(e, a.key);
        n > 0 && n < 100 && t++;
      }
      return t;
    }, [e]),
    p = null !== m && m > 60 && i < 50,
    u = null !== m && m > 90 && i < 75;
  return React.createElement(
    "div",
    { className: "flex items-center gap-3 px-4 py-3 hover:bg-stone-50 transition-colors group" },
    React.createElement(
      "button",
      { onClick: t, className: "flex-1 text-left flex items-center gap-3 min-w-0" },
      React.createElement(
        "div",
        {
          className:
            "w-9 h-9 rounded-full bg-stone-200 flex items-center justify-center text-stone-700 font-semibold text-sm flex-shrink-0 relative",
        },
        (e.meta.name || "?").charAt(0).toUpperCase(),
        u &&
          React.createElement("span", {
            className: "absolute -top-1 -right-1 w-3 h-3 rounded-full bg-rose-500 border-2 border-white",
            title: `Stalling: ${m} days since First Interview`,
          }),
      ),
      React.createElement(
        "div",
        { className: "flex-1 min-w-0" },
        React.createElement(
          "div",
          { className: "flex items-center gap-2 flex-wrap" },
          React.createElement(
            "div",
            { className: "font-medium text-stone-900 text-sm truncate" },
            e.meta.name || React.createElement("span", { className: "italic text-stone-400" }, "Unnamed"),
          ),
          "Yes" === e.meta.internalCandidate &&
            React.createElement(
              "span",
              { className: "px-1.5 py-0.5 bg-stone-200 rounded-sm text-[10px] uppercase tracking-wider" },
              "Internal",
            ),
        ),
        React.createElement(
          "div",
          { className: "text-xs text-stone-500 mt-0.5 flex items-center gap-3 flex-wrap" },
          e.meta.phone &&
            React.createElement(
              "span",
              { className: "inline-flex items-center gap-0.5" },
              React.createElement(Phone, { className: "w-3 h-3" }),
              e.meta.phone,
            ),
          s.total > 0 && React.createElement("span", { className: "font-mono" }, "FI ", s.total, "/100"),
          o > 0 && React.createElement("span", { className: "font-mono" }, "FA ", o, "/80"),
          null !== m &&
            React.createElement(
              "span",
              {
                className:
                  "inline-flex items-center gap-0.5 font-mono " +
                  (u ? "text-rose-700 font-bold" : p ? "text-amber-700 font-bold" : "text-stone-500"),
                title: "Days since First Interview",
              },
              React.createElement(Clock, { className: "w-3 h-3" }),
              m,
              "d",
            ),
          d > 0 &&
            React.createElement(
              "span",
              {
                className:
                  "inline-flex items-center gap-0.5 px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded-sm text-[10px] font-mono",
                title: `${d} stage(s) started but not complete`,
              },
              d,
              " open",
            ),
        ),
      ),
      React.createElement(
        "div",
        { className: "hidden md:flex items-center gap-2 flex-shrink-0" },
        React.createElement(
          "div",
          { className: "w-24" },
          React.createElement(LinearBar, {
            value: i,
            height: 4,
            tone: i >= 75 ? "emerald" : i >= 40 ? "amber" : "stone",
            showLabel: "Pipeline",
          }),
        ),
      ),
      React.createElement(
        "div",
        { className: "flex items-center gap-1.5 flex-shrink-0" },
        React.createElement(RadialProgress, {
          value: c,
          max: 100,
          size: 36,
          stroke: 3,
          tone: c >= 100 ? "emerald" : c > 0 ? "amber" : "stone",
        }),
      ),
    ),
    n
      ? React.createElement(
          "div",
          { className: "flex items-center gap-2 flex-shrink-0" },
          React.createElement(
            "button",
            { onClick: a, className: "text-xs text-rose-700 underline" },
            "Delete",
          ),
          React.createElement(
            "button",
            { onClick: () => r(!1), className: "text-xs text-stone-500 underline" },
            "Cancel",
          ),
        )
      : React.createElement(
          "button",
          {
            onClick: () => r(!0),
            className:
              "opacity-0 group-hover:opacity-100 text-stone-400 hover:text-rose-700 transition-all flex-shrink-0",
          },
          React.createElement(Trash2, { className: "w-4 h-4" }),
        ),
  );
}
function CandidateDetail({ candidate: e, persist: t, onBack: a, activeRole: n, onSetStage: r }) {
  const [s, o] = useState(e.meta.currentStage || "firstInterview"),
    c = useMemo(() => runValidation(e), [e]),
    [i, l] = useState(!1),
    [m, d] = useState(!1),
    [p, u] = useState(""),
    [h, g] = useState(""),
    b = (e, a) => t((t) => setPath(t, ["meta", e], a)),
    f = async () => {
      (d(!0), g(""), u(""));
      try {
        const t = e.stages.firstInterview || {},
          a = e.stages.pop7Review || {},
          n = scoreFirstInterview(t),
          r = {
            name: e.meta.name,
            currentStage: e.meta.currentStage,
            recruitingManager: e.meta.recruitingManager,
            firstInterviewScore: n.total,
            firstInterviewRecommendation: n.recommendation,
            firstInterviewOutcome: t.outcome,
            firstInterviewNotes: t.outcomeNotes,
            rmComments: t.rmComments,
            popScores: a.scores
              ? {
                  PS: a.scores.PS,
                  EP: a.scores.EP,
                  AP: a.scores.AP,
                  IP: a.scores.IP,
                  SD: a.scores.SD,
                  LM: a.scores.LM,
                  CR: a.scores.CR,
                }
              : null,
            popRating: a.finalRating,
          },
          o = await api("ai", { kind: "brief", profile: r, candidateName: e.meta?.name || "" });
        if (!o.ok) throw new Error(o.error || "AI request failed");
        const c = String(o.text || "").trim();
        u(c || "No response from AI.");
      } catch (e) {
        g(e.message || String(e));
      } finally {
        d(!1);
      }
    },
    x = useMemo(
      () =>
        STAGES.map((t) => ({
          key: t.key,
          label: t.label,
          short: t.short,
          icon: t.icon,
          completion: computeStageCompletion(e, t.key),
        })),
      [e],
    ),
    v = useMemo(() => Math.round(x.reduce((e, t) => e + t.completion, 0) / STAGES.length), [x]),
    y = STAGES.findIndex((e) => e.key === s),
    R = useMemo(() => scoreFirstInterview(e.stages.firstInterview), [e.stages.firstInterview]),
    E = useMemo(() => scoreFormA(e.stages.selectionFile.formA), [e.stages.selectionFile.formA]),
    w = {
      firstInterview: FirstInterviewStage,
      bmApproval: BmApprovalStage,
      pop7Review: Pop7ReviewStage,
      discovery: DiscoveryStage,
      selectionFile: SelectionFileStage,
      approval: ApprovalStage,
      onboarding: OnboardingStage,
      induction: InductionStage,
    }[s];
  return React.createElement(
    "div",
    { className: "space-y-3" },
    React.createElement(
      "div",
      { className: "bg-white border border-stone-200 rounded-sm overflow-hidden" },
      React.createElement(
        "div",
        { className: "px-4 py-3 border-b border-stone-100", style: { backgroundColor: "#F5EFE0" } },
        React.createElement(
          "button",
          {
            onClick: a,
            className:
              "inline-flex items-center gap-1 text-xs text-stone-500 hover:text-stone-900 mb-3 transition-colors",
          },
          React.createElement(ArrowLeft, { className: "w-3.5 h-3.5" }),
          " Pipeline",
        ),
        React.createElement(
          "div",
          { className: "flex items-start gap-4 flex-wrap" },
          React.createElement(
            "div",
            { className: "flex items-center gap-3 flex-1 min-w-[200px]" },
            React.createElement(
              "div",
              {
                className:
                  "w-14 h-14 rounded-full bg-stone-900 text-stone-50 flex items-center justify-center font-serif text-xl font-semibold flex-shrink-0",
              },
              (e.meta.name || "?").charAt(0).toUpperCase(),
            ),
            React.createElement(
              "div",
              null,
              React.createElement(
                "div",
                { className: "font-serif text-2xl text-stone-900 leading-tight" },
                e.meta.name ||
                  React.createElement(
                    "span",
                    { className: "italic text-stone-400 font-normal" },
                    "Unnamed candidate",
                  ),
              ),
              React.createElement(
                "div",
                { className: "text-xs text-stone-500 mt-1 flex items-center gap-3 flex-wrap" },
                e.meta.phone &&
                  React.createElement(
                    "span",
                    { className: "inline-flex items-center gap-1" },
                    React.createElement(Phone, { className: "w-3 h-3" }),
                    e.meta.phone,
                  ),
                e.meta.email &&
                  React.createElement(
                    "span",
                    { className: "inline-flex items-center gap-1" },
                    React.createElement(Mail, { className: "w-3 h-3" }),
                    e.meta.email,
                  ),
                "Yes" === e.meta.internalCandidate &&
                  React.createElement(
                    "span",
                    {
                      className:
                        "px-1.5 py-0.5 bg-stone-200 rounded-sm text-[10px] uppercase tracking-wider font-medium",
                    },
                    "Internal",
                  ),
              ),
              React.createElement(
                "button",
                {
                  onClick: () => {
                    (l(!0), p || f());
                  },
                  className:
                    "mt-2 inline-flex items-center gap-1.5 text-xs px-2.5 py-1 rounded-sm transition-colors",
                  style: { background: "linear-gradient(90deg, #07131f 0%, #7c3aed 100%)", color: "white" },
                },
                React.createElement("span", { className: "text-[10px]" }, "✦"),
                " Ask AI coach",
              ),
            ),
          ),
          React.createElement(
            "div",
            { className: "flex items-center gap-4" },
            R.total > 0 &&
              React.createElement(
                "div",
                { className: "flex flex-col items-center" },
                React.createElement(RadialProgress, {
                  value: R.total,
                  max: 100,
                  size: 48,
                  stroke: 4,
                  tone: R.total >= 80 ? "emerald" : R.total >= 65 ? "amber" : "rose",
                }),
                React.createElement(
                  "div",
                  { className: "text-[10px] uppercase tracking-wider text-stone-500 mt-1" },
                  "FI score",
                ),
              ),
            E.total > 0 &&
              React.createElement(
                "div",
                { className: "flex flex-col items-center" },
                React.createElement(RadialProgress, {
                  value: E.total,
                  max: 80,
                  size: 48,
                  stroke: 4,
                  tone: E.total >= 60 ? "emerald" : E.total >= 50 ? "amber" : "rose",
                }),
                React.createElement(
                  "div",
                  { className: "text-[10px] uppercase tracking-wider text-stone-500 mt-1" },
                  "Form A",
                ),
              ),
            React.createElement(
              "div",
              { className: "flex flex-col items-center" },
              React.createElement(RadialProgress, { value: v, max: 100, size: 64, stroke: 5, tone: "navy" }),
              React.createElement(
                "div",
                { className: "text-[10px] uppercase tracking-wider text-stone-500 mt-1 font-semibold" },
                "Pipeline",
              ),
            ),
          ),
        ),
      ),
      React.createElement(
        "div",
        { className: "px-4 py-3 bg-white border-b border-stone-100" },
        React.createElement(StepIndicator, {
          steps: STAGES,
          currentIdx: y,
          getCompletion: (t) => computeStageCompletion(e, t.key),
        }),
      ),
      React.createElement(
        "div",
        { className: "px-4 py-3 grid gap-3 md:grid-cols-5" },
        React.createElement(TextInput, {
          label: "Recruit Name",
          value: e.meta.name,
          onChange: (e) => b("name", e),
        }),
        React.createElement(TextInput, {
          label: "Phone",
          value: e.meta.phone,
          onChange: (e) => b("phone", e),
        }),
        React.createElement(TextInput, {
          label: "Email",
          type: "email",
          value: e.meta.email,
          onChange: (e) => b("email", e),
        }),
        React.createElement(Select, {
          label: "Recruiting Manager",
          value: e.meta.recruitingManager,
          onChange: (e) => b("recruitingManager", e),
          options: RECRUITING_MANAGER_OPTIONS,
        }),
        React.createElement(Select, {
          label: "Internal candidate?",
          value: e.meta.internalCandidate,
          onChange: (e) => b("internalCandidate", e),
          options: ["Yes", "No"],
        }),
      ),
    ),
    React.createElement(
      "div",
      { className: "bg-white border border-stone-200 rounded-sm overflow-x-auto" },
      React.createElement(
        "div",
        { className: "flex" },
        STAGES.map((t, a) => {
          const n = computeStageCompletion(e, t.key),
            c = t.icon,
            i = s === t.key,
            l = n >= 100;
          return React.createElement(
            "button",
            {
              key: t.key,
              onClick: () => {
                (o(t.key), r(t.key));
              },
              className:
                "flex-1 min-w-[120px] flex flex-col items-center px-3 py-3 border-b-2 transition-all relative " +
                (i ? "border-stone-900 bg-stone-50" : "border-transparent hover:bg-stone-50"),
            },
            React.createElement(
              "div",
              { className: "flex items-center gap-1.5 mb-1" },
              React.createElement(
                "span",
                { className: "text-[10px] uppercase tracking-wider text-stone-500 font-semibold" },
                "Stage ",
                a + 1,
              ),
              l && React.createElement(CheckCircle2, { className: "w-3 h-3 text-emerald-700" }),
            ),
            React.createElement(c, {
              className: "w-4 h-4 mb-1 " + (i ? "text-stone-900" : l ? "text-emerald-700" : "text-stone-500"),
            }),
            React.createElement(
              "div",
              { className: "text-xs " + (i ? "font-semibold text-stone-900" : "text-stone-600") },
              t.short,
            ),
            React.createElement(
              "div",
              { className: "w-full mt-2 px-2" },
              React.createElement(LinearBar, {
                value: n,
                height: 3,
                tone: l ? "emerald" : n > 0 ? (i ? "navy" : "amber") : "stone",
              }),
            ),
          );
        }),
      ),
    ),
    c.length > 0 &&
      React.createElement(
        "div",
        { className: "bg-amber-50 border border-amber-300 rounded-sm px-4 py-3" },
        React.createElement(
          "div",
          { className: "flex items-center gap-2 mb-1" },
          React.createElement(AlertTriangle, { className: "w-4 h-4 text-amber-700" }),
          React.createElement(
            "span",
            { className: "text-xs uppercase tracking-wider font-semibold text-amber-900" },
            "Data integrity",
          ),
          React.createElement(
            "span",
            { className: "text-xs text-amber-700" },
            "· ",
            c.length,
            " issue(s) across forms",
          ),
        ),
        React.createElement(
          "div",
          { className: "text-xs text-amber-800 leading-relaxed" },
          c
            .slice(0, 2)
            .map((e, t) =>
              React.createElement(
                "span",
                { key: t },
                e.field,
                ": ",
                e.detail,
                t < Math.min(c.length - 1, 1) ? " · " : "",
              ),
            ),
          c.length > 2 && React.createElement("span", null, " · +", c.length - 2, " more"),
        ),
      ),
    i &&
      React.createElement(
        "div",
        { className: "bg-white border-2 rounded-sm overflow-hidden", style: { borderColor: "#7c3aed" } },
        React.createElement(
          "div",
          {
            className: "px-4 py-3 flex items-center justify-between",
            style: { background: "linear-gradient(90deg, #07131f 0%, #7c3aed 100%)", color: "white" },
          },
          React.createElement(
            "div",
            { className: "flex items-center gap-2" },
            React.createElement("span", null, "✦"),
            React.createElement(
              "span",
              { className: "text-sm font-semibold" },
              "AI Coach Brief — ",
              e.meta.name,
            ),
          ),
          React.createElement(
            "div",
            { className: "flex items-center gap-2" },
            !m &&
              p &&
              React.createElement(
                "button",
                {
                  onClick: f,
                  className:
                    "text-[10px] uppercase tracking-wider px-2 py-1 bg-white/10 hover:bg-white/20 rounded-sm transition-colors",
                },
                "Refresh",
              ),
            React.createElement(
              "button",
              { onClick: () => l(!1), className: "text-white/70 hover:text-white" },
              React.createElement(X, { className: "w-4 h-4" }),
            ),
          ),
        ),
        React.createElement(
          "div",
          { className: "p-4" },
          m &&
            React.createElement(
              "div",
              { className: "flex items-center gap-2 text-sm text-stone-600" },
              React.createElement("div", {
                className: "w-4 h-4 border-2 border-stone-300 border-t-stone-900 rounded-full animate-spin",
              }),
              React.createElement("span", null, "Analysing candidate profile…"),
            ),
          h &&
            React.createElement(
              "div",
              { className: "text-sm text-rose-700 bg-rose-50 border border-rose-200 rounded-sm p-3" },
              React.createElement("strong", null, "AI coach unavailable:"),
              " ",
              h,
              React.createElement(
                "div",
                { className: "text-xs mt-1 text-rose-600" },
                "The AI coach uses Claude via Anthropic's API. If this persists, the API may be temporarily unreachable from this artifact runtime.",
              ),
            ),
          p &&
            React.createElement(
              "div",
              {
                className: "prose prose-sm max-w-none text-stone-800 leading-relaxed whitespace-pre-wrap",
                style: { fontFamily: "Newsreader, Georgia, serif" },
              },
              p,
            ),
        ),
      ),
    w && React.createElement(w, { candidate: e, persist: t, currentRole: n }),
  );
}
function RoleDashboard({ candidates: e, onSelect: t, role: a }) {
  const n =
      {
        BMA: e.flatMap((e) => {
          const t = [],
            a = e.stages.selectionFile,
            n = a?.documents || {},
            r = DOC_CHECKLIST.filter(
              (e) =>
                [
                  "photos",
                  "proofAddress",
                  "police",
                  "cbtt",
                  "bank",
                  "nis",
                  "bir",
                  "recruitId",
                  "academic",
                ].includes(e.key) && !n[e.key],
            );
          r.length > 0 &&
            t.push({
              candidate: e,
              type: "docs",
              label: `${r.length} document(s) outstanding`,
              severity: "med",
            });
          const s = e.stages.onboarding;
          ("Approved" !== e.stages.approval?.decision ||
            s?.cbtt?.received ||
            t.push({ candidate: e, type: "cbtt", label: "CBTT not yet received", severity: "med" }),
            "Approved" !== e.stages.approval?.decision ||
              s?.aml?.completed ||
              t.push({ candidate: e, type: "aml", label: "AML training pending", severity: "med" }));
          const o = e.stages.discovery;
          return (
            e.stages.bmApproval?.pop7CompletedDate &&
              !o?.ggldcEnrolled &&
              t.push({
                candidate: e,
                type: "ggldc",
                label: "POP complete — GGLDC enrollment pending",
                severity: "high",
              }),
            t
          );
        }),
        BM: e.flatMap((e) => {
          const t = [],
            a = e.stages.firstInterview,
            n = scoreFirstInterview(a),
            r = fiTier(a, n);
          return (
            "proceed" !== a.outcome ||
              ("marginal" !== r && "weak" !== r) ||
              e.stages.bmApproval?.bmDecision ||
              t.push({
                candidate: e,
                type: "bm-gate",
                label:
                  "weak" === r
                    ? `Weak FI (${n.total}/100) — decline or override required`
                    : `Marginal FI (${n.total}/100) — BM dimensional review needed`,
                severity: "high",
              }),
            "proceed" !== a.outcome ||
              "strong" !== r ||
              e.stages.bmApproval?.bmAcknowledged ||
              t.push({
                candidate: e,
                type: "bm-ack",
                label: `Strong FI (${n.total}/100) — light BM acknowledgement pending`,
                severity: "med",
              }),
            e.stages.pop7Review?.rmFinalRecommendation &&
              !e.stages.approval?.decision &&
              t.push({
                candidate: e,
                type: "decision",
                label: "POP review complete — final approval needed",
                severity: "high",
              }),
            e.stages.selectionFile?.formA?.age &&
              !e.stages.approval?.decision &&
              t.push({
                candidate: e,
                type: "approval",
                label: "File assembled — sign-off needed",
                severity: "high",
              }),
            t
          );
        }),
        RM: e.flatMap((e) => {
          const t = [],
            a = e.stages.firstInterview,
            n = fiTier(a, scoreFirstInterview(a));
          (a.experienceBranch
            ? a.outcome ||
              t.push({
                candidate: e,
                type: "fi-outcome",
                label: "First interview pending outcome",
                severity: "high",
              })
            : t.push({ candidate: e, type: "fi", label: "First interview not started", severity: "med" }),
            "proceed" !== a.outcome ||
              "strong" !== n ||
              e.stages.bmApproval?.pop7CompletedDate ||
              t.push({
                candidate: e,
                type: "pop-admin",
                label: e.stages.bmApproval?.pop7SentDate
                  ? "POP 7 sent — awaiting completion"
                  : "Strong FI — administer POP 7",
                severity: "high",
              }),
            e.stages.bmApproval?.pop7CompletedDate &&
              !e.stages.pop7Review?.rmFinalRecommendation &&
              t.push({
                candidate: e,
                type: "pop-review",
                label: "POP completed — RM review pending",
                severity: "high",
              }));
          const r = e.stages.selectionFile?.confidentialReport1?.intervieweeName,
            s = e.stages.selectionFile?.confidentialReport2?.intervieweeName;
          return (
            !e.stages.discovery?.ggldcEnrolled ||
              (r && s) ||
              t.push({
                candidate: e,
                type: "cr",
                label: (r ? 0 : 1) + (s ? 0 : 1) + " Confidential Report(s) outstanding",
                severity: "med",
              }),
            t
          );
        }),
        INV: e.flatMap((e) => {
          const t = [],
            a = e.stages.selectionFile?.inspectionReport;
          return (
            e.stages.discovery?.ggldcEnrolled &&
              !a?.remarks &&
              t.push({
                candidate: e,
                type: "inspect",
                label: "Inspection Report not yet completed",
                severity: "high",
              }),
            t
          );
        }),
      }[a] || [],
    r = n.reduce((e, t) => {
      const a = t.candidate.id;
      return (e[a] || (e[a] = { candidate: t.candidate, items: [] }), e[a].items.push(t), e);
    }, {}),
    s = n.filter((e) => "high" === e.severity).length,
    o = n.filter((e) => "med" === e.severity || "medium" === e.severity).length;
  return React.createElement(
    "div",
    { className: "space-y-3" },
    React.createElement(
      "div",
      { className: "bg-white border border-stone-200 rounded-sm overflow-hidden" },
      React.createElement(
        "div",
        { className: "px-4 py-3 border-b border-stone-100", style: { backgroundColor: "#F5EFE0" } },
        React.createElement(
          "h2",
          { className: "font-serif text-2xl text-stone-900 mb-1" },
          ROLES.find((e) => e.key === a)?.label,
          " Queue",
        ),
        React.createElement(
          "p",
          { className: "text-sm text-stone-500" },
          0 === n.length
            ? "Nothing pending. All candidates current."
            : `${n.length} action${1 === n.length ? "" : "s"} across ${Object.keys(r).length} candidate${1 === Object.keys(r).length ? "" : "s"}`,
        ),
      ),
      n.length > 0 &&
        React.createElement(
          "div",
          { className: "grid grid-cols-3 divide-x divide-stone-200" },
          React.createElement(
            "div",
            { className: "px-4 py-3" },
            React.createElement(
              "div",
              { className: "text-[10px] uppercase tracking-wider text-stone-500 font-medium mb-1" },
              "Total open",
            ),
            React.createElement("div", { className: "font-serif text-3xl text-stone-900" }, n.length),
          ),
          React.createElement(
            "div",
            { className: "px-4 py-3" },
            React.createElement(
              "div",
              { className: "text-[10px] uppercase tracking-wider text-rose-700 font-medium mb-1" },
              "High priority",
            ),
            React.createElement("div", { className: "font-serif text-3xl", style: { color: "#9f1239" } }, s),
          ),
          React.createElement(
            "div",
            { className: "px-4 py-3" },
            React.createElement(
              "div",
              { className: "text-[10px] uppercase tracking-wider text-amber-700 font-medium mb-1" },
              "Medium",
            ),
            React.createElement("div", { className: "font-serif text-3xl", style: { color: "#b45309" } }, o),
          ),
        ),
    ),
    Object.values(r).map(({ candidate: e, items: a }) => {
      const n = Math.round(STAGES.reduce((t, a) => t + computeStageCompletion(e, a.key), 0) / STAGES.length);
      return React.createElement(
        "div",
        { key: e.id, className: "bg-white border border-stone-200 rounded-sm overflow-hidden" },
        React.createElement(
          "button",
          {
            onClick: () => t(e.id),
            className:
              "w-full text-left px-4 py-3 hover:bg-stone-50 transition-colors flex items-center gap-3",
          },
          React.createElement(
            "div",
            {
              className:
                "w-9 h-9 rounded-full bg-stone-200 flex items-center justify-center text-stone-700 font-semibold text-sm",
            },
            (e.meta.name || "?").charAt(0).toUpperCase(),
          ),
          React.createElement(
            "div",
            { className: "flex-1 min-w-0" },
            React.createElement(
              "div",
              { className: "font-medium text-stone-900 text-sm" },
              e.meta.name || "Unnamed",
            ),
            React.createElement(
              "div",
              { className: "text-xs text-stone-500" },
              a.length,
              " item(s) outstanding",
            ),
          ),
          React.createElement(
            "div",
            { className: "hidden md:block w-24 flex-shrink-0" },
            React.createElement(LinearBar, {
              value: n,
              height: 4,
              tone: n >= 75 ? "emerald" : n >= 40 ? "amber" : "stone",
              showLabel: "Pipeline",
            }),
          ),
          React.createElement(ChevronRight, { className: "w-4 h-4 text-stone-400" }),
        ),
        React.createElement(
          "div",
          { className: "border-t border-stone-100 bg-stone-50/30" },
          a.map((e, t) =>
            React.createElement(
              "div",
              {
                key: t,
                className: "px-4 py-2.5 flex items-center gap-2 border-b border-stone-100 last:border-b-0",
              },
              React.createElement("span", {
                className:
                  "w-1.5 h-1.5 rounded-full flex-shrink-0 " +
                  ("high" === e.severity ? "bg-rose-500" : "bg-amber-500"),
              }),
              React.createElement("span", { className: "text-sm text-stone-700 flex-1" }, e.label),
              React.createElement(
                "span",
                {
                  className:
                    "text-[9px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm flex-shrink-0 " +
                    ("high" === e.severity ? "bg-rose-100 text-rose-800" : "bg-amber-100 text-amber-800"),
                },
                "high" === e.severity ? "High" : "Med",
              ),
            ),
          ),
        ),
      );
    }),
  );
}
function TrendsDashboard() {
  const e = COHORT_DATA,
    t = useMemo(() => {
      const t = e.length,
        a = e.filter((e) => "contracted_failed" === e.decision).length,
        n = e.filter((e) => "completed_no_show" === e.decision).length,
        r = e.filter((e) => "contracted_struggling" === e.decision).length,
        s = e.filter((e) => "partial_file_dropped" === e.decision).length;
      return {
        total: t,
        contractedFailed: a,
        completedNoShow: n,
        contractedStruggling: r,
        partialDropped: s,
        inProgress: e.filter((e) => "in_progress" === e.decision).length,
        noContract: e.filter((e) => "no_contract" === e.outcome).length,
        avgPS:
          e.filter((e) => null !== e.PS).reduce((e, t) => e + t.PS, 0) /
          e.filter((e) => null !== e.PS).length,
        investmentLost: a + n + r + s,
        cohortProduction: e.reduce(
          (e, t) => {
            const a = t.agentId ? PRODUCTION_DATA[t.agentId] : null;
            return (
              a &&
                ((e.totalApps += a.apps),
                (e.totalAPI += a.settledAPI),
                (e.totalLapsedAPI += a.lapsedAPI),
                a.apps > 0 && e.producingCount++,
                0 !== a.apps || a.preContract || e.zeroProductionCount++),
              e
            );
          },
          { totalApps: 0, totalAPI: 0, totalLapsedAPI: 0, producingCount: 0, zeroProductionCount: 0 },
        ),
      };
    }, [e]),
    a = useMemo(() => {
      const t = {};
      return (
        e.forEach((e) => {
          const a = e.rm || "unknown";
          (t[a] ||
            (t[a] = {
              name: a,
              total: 0,
              contractedFailed: 0,
              completedNoShow: 0,
              contractedStruggling: 0,
              partialDropped: 0,
              inProgress: 0,
              avgPS: 0,
              candidates: [],
            }),
            t[a].total++,
            t[a].candidates.push(e),
            "contracted_failed" === e.decision && t[a].contractedFailed++,
            "completed_no_show" === e.decision && t[a].completedNoShow++,
            "contracted_struggling" === e.decision && t[a].contractedStruggling++,
            "partial_file_dropped" === e.decision && t[a].partialDropped++,
            "in_progress" === e.decision && t[a].inProgress++);
        }),
        Object.values(t).forEach((e) => {
          const t = e.candidates.filter((e) => null !== e.PS);
          e.avgPS = t.length > 0 ? t.reduce((e, t) => e + t.PS, 0) / t.length : 0;
        }),
        Object.values(t).sort((e, t) => t.total - e.total)
      );
    }, [e]);
  return React.createElement(
    "div",
    { className: "space-y-3" },
    React.createElement(
      "div",
      { className: "bg-white border border-stone-200 rounded-sm overflow-hidden" },
      React.createElement(
        "div",
        { className: "px-4 py-3 border-b border-stone-100", style: { backgroundColor: "#F5EFE0" } },
        React.createElement(
          "h2",
          { className: "font-serif text-2xl text-stone-900 mb-1" },
          "Branch Cohort — Quality of Recruits Analysis",
        ),
        React.createElement(
          "p",
          { className: "text-sm text-stone-600 leading-relaxed max-w-3xl" },
          "Five years of recruiting data, organized by what actually happened to each candidate after the branch invested in them. Each category below represents a different cost profile — from full investment lost in the field, to full file built then no-show, to currently struggling agents on the books.",
        ),
      ),
    ),
    React.createElement(
      "div",
      { className: "grid gap-3 grid-cols-2 md:grid-cols-4 lg:grid-cols-6" },
      React.createElement(StatBlock, {
        icon: Users,
        label: "Total candidates",
        value: t.total,
        sublabel: "2021–2026",
        tone: "navy",
      }),
      React.createElement(StatBlock, {
        icon: X,
        label: "Contracted, failed",
        value: t.contractedFailed,
        sublabel: "full investment lost",
        tone: "rose",
      }),
      React.createElement(StatBlock, {
        icon: AlertTriangle,
        label: "Completed, no-show",
        value: t.completedNoShow,
        sublabel: "file done, never on board",
        tone: "rose",
      }),
      React.createElement(StatBlock, {
        icon: TrendingUp,
        label: "Contracted, struggling",
        value: t.contractedStruggling,
        sublabel: "lapsing / ill / average",
        tone: "amber",
      }),
      React.createElement(StatBlock, {
        icon: Target,
        label: "Avg PS score",
        value: t.avgPS.toFixed(1),
        sublabel: "across cohort",
        tone: "stone",
      }),
      React.createElement(StatBlock, {
        icon: CheckCircle2,
        label: "In progress",
        value: t.inProgress,
        sublabel: "current pipeline",
        tone: "emerald",
      }),
    ),
    React.createElement(
      "div",
      { className: "grid gap-3 lg:grid-cols-2" },
      React.createElement(
        "div",
        {
          className: "bg-gradient-to-r from-rose-50 to-amber-50 border border-rose-300 rounded-sm px-4 py-3",
        },
        React.createElement(
          "div",
          { className: "flex items-start gap-3 flex-wrap" },
          React.createElement(X, { className: "w-6 h-6 text-rose-700 flex-shrink-0 mt-1" }),
          React.createElement(
            "div",
            { className: "flex-1 min-w-[280px]" },
            React.createElement(
              "div",
              { className: "text-[11px] uppercase tracking-[0.14em] text-rose-800 font-semibold mb-1" },
              "Cumulative branch investment with no return on contract",
            ),
            React.createElement(
              "div",
              { className: "font-serif text-3xl text-stone-900" },
              t.investmentLost,
              " ",
              React.createElement(
                "span",
                { className: "text-base text-stone-500" },
                "of ",
                t.total,
                " candidates (",
                Math.round((t.investmentLost / t.total) * 100),
                "%)",
              ),
            ),
            React.createElement(
              "div",
              { className: "text-xs text-stone-700 leading-relaxed mt-2" },
              "Includes: contracted-then-failed, completed-then-no-show, currently-contracted-struggling, and partial-file-dropped. Excludes only candidates currently in pipeline.",
            ),
          ),
        ),
      ),
      React.createElement(
        "div",
        {
          className:
            "bg-gradient-to-r from-emerald-50 to-stone-50 border border-emerald-300 rounded-sm px-4 py-3",
        },
        React.createElement(
          "div",
          { className: "flex items-start gap-3 flex-wrap" },
          React.createElement(TrendingUp, { className: "w-6 h-6 text-emerald-700 flex-shrink-0 mt-1" }),
          React.createElement(
            "div",
            { className: "flex-1 min-w-[280px]" },
            React.createElement(
              "div",
              { className: "text-[11px] uppercase tracking-[0.14em] text-emerald-800 font-semibold mb-1" },
              "Cohort production (from BRANCH SETTLED)",
            ),
            React.createElement(
              "div",
              { className: "font-serif text-3xl text-stone-900" },
              "$",
              t.cohortProduction.totalAPI.toLocaleString(),
              " ",
              React.createElement(
                "span",
                { className: "text-base text-stone-500" },
                "API · ",
                t.cohortProduction.totalApps,
                " apps",
              ),
            ),
            React.createElement(
              "div",
              { className: "text-xs text-stone-700 leading-relaxed mt-2" },
              "Across all cohort recruits with agent IDs: ",
              React.createElement("strong", null, t.cohortProduction.producingCount),
              " producing, ",
              React.createElement("strong", null, t.cohortProduction.zeroProductionCount),
              " zero-production. Refreshes from Google Sheets settled report.",
            ),
          ),
        ),
      ),
    ),
    React.createElement(
      "div",
      { className: "grid gap-3 lg:grid-cols-2" },
      React.createElement(
        "div",
        { className: "bg-white border-2 border-rose-500 rounded-sm overflow-hidden lg:col-span-2" },
        React.createElement(
          "div",
          { className: "px-4 py-3 border-b border-rose-300", style: { backgroundColor: "#FEE2E2" } },
          React.createElement(
            "div",
            { className: "flex items-center gap-2 mb-1" },
            React.createElement(X, { className: "w-4 h-4 text-rose-800" }),
            React.createElement(
              "h3",
              { className: "font-serif text-lg text-rose-900" },
              "Contracted, failed in field",
            ),
            React.createElement(
              "span",
              {
                className:
                  "ml-auto text-[10px] uppercase tracking-wider px-2 py-0.5 bg-rose-200 text-rose-900 rounded-sm font-semibold",
              },
              "Highest cost",
            ),
          ),
          React.createElement(
            "p",
            { className: "text-sm text-rose-900 leading-relaxed font-medium" },
            "The most expensive failure. Full Discovery + Selection Panel + contract issued + onboarding investment + branch resources committed — then loss. The pattern across these candidates: dependency-leaning POP scores (IP) and activity-risk POP scores (EP) that recruiting managers chose not to act on.",
          ),
        ),
        React.createElement(
          "div",
          { className: "divide-y divide-stone-100" },
          e
            .filter((e) => "contracted_failed" === e.decision)
            .sort((e, t) => (t.year || 0) - (e.year || 0))
            .map((e) => React.createElement(CohortRow, { key: e.name, c: e, pattern: "contracted_failed" })),
        ),
        React.createElement(
          "div",
          { className: "px-5 py-3 bg-stone-50 border-t border-stone-200" },
          React.createElement(
            "div",
            { className: "text-[11px] uppercase tracking-[0.14em] text-stone-600 mb-1 font-semibold" },
            "Common signals — what should have been caught",
          ),
          React.createElement(
            "ul",
            { className: "text-xs text-stone-700 space-y-1 leading-relaxed" },
            React.createElement(
              "li",
              null,
              "• ",
              React.createElement("strong", null, "Case 1 (PS=58, 5/5):"),
              " Hired Jan 2025, terminated Jul 2025 — 7 months. Clean POP but post-contract retention failed. Onboarding/coaching question, not selection.",
            ),
            React.createElement(
              "li",
              null,
              "• ",
              React.createElement("strong", null, "Case 2 (IP=-26, penalty):"),
              " Hired Aug 2025, terminated Dec 2025 — 3.5 months. Dependency caution flagged in POP, ignored at selection.",
            ),
            React.createElement(
              "li",
              null,
              "• ",
              React.createElement("strong", null, "Case 3 (EP=25, penalty):"),
              " Hired Jul 2025, terminated Sep 2025 — 2 months. Below the 30 cutoff for daily activity capacity.",
            ),
            React.createElement(
              "li",
              null,
              "• ",
              React.createElement("strong", null, "Case 4 (EP=30, exact cutoff):"),
              " Marginal pass, voluntary resignation. Not in current branch roster.",
            ),
            React.createElement(
              "li",
              null,
              "• ",
              React.createElement("strong", null, "Case 5 (SD=37, LM=38):"),
              " 2021 hire, terminated Sep 2021 — recruit status LOST. Borderline self-management scores bore out.",
            ),
          ),
        ),
      ),
      React.createElement(
        "div",
        { className: "bg-white border-2 border-rose-400 rounded-sm overflow-hidden" },
        React.createElement(
          "div",
          { className: "px-4 py-3 border-b border-rose-200", style: { backgroundColor: "#FEF2F2" } },
          React.createElement(
            "div",
            { className: "flex items-center gap-2" },
            React.createElement(AlertTriangle, { className: "w-4 h-4 text-rose-700" }),
            React.createElement(
              "h3",
              { className: "font-serif text-base text-rose-900" },
              "Process completed — never came on board",
            ),
          ),
          React.createElement(
            "p",
            { className: "text-xs text-rose-800 mt-1 leading-relaxed" },
            "Full file built. All sessions completed. Market surveys done. Then disappeared before signing the contract. Resource burn comparable to a contracted candidate who walks.",
          ),
        ),
        React.createElement(
          "div",
          { className: "divide-y divide-stone-100" },
          e
            .filter((e) => "completed_no_show" === e.decision)
            .sort((e, t) => (e.year || 0) - (t.year || 0))
            .map((e) => React.createElement(CohortRow, { key: e.name, c: e, pattern: "no_show" })),
        ),
      ),
      React.createElement(
        "div",
        { className: "bg-white border-2 border-amber-400 rounded-sm overflow-hidden" },
        React.createElement(
          "div",
          { className: "px-4 py-3 border-b border-amber-200", style: { backgroundColor: "#FFFBEB" } },
          React.createElement(
            "div",
            { className: "flex items-center gap-2" },
            React.createElement(TrendingUp, { className: "w-4 h-4 text-amber-700" }),
            React.createElement(
              "h3",
              { className: "font-serif text-base text-amber-900" },
              "Currently contracted — lapsing / underperforming",
            ),
          ),
          React.createElement(
            "p",
            { className: "text-xs text-amber-800 mt-1 leading-relaxed" },
            "On the books today, but performance is average at best. Coaching and retention pressure point. POP signals largely confirmed.",
          ),
        ),
        React.createElement(
          "div",
          { className: "divide-y divide-stone-100" },
          e
            .filter((e) => "contracted_struggling" === e.decision)
            .sort((e, t) => (e.PS || 0) - (t.PS || 0))
            .map((e) => React.createElement(CohortRow, { key: e.name, c: e, pattern: "struggling" })),
        ),
      ),
      React.createElement(
        "div",
        { className: "bg-white border border-stone-300 rounded-sm overflow-hidden" },
        React.createElement(
          "div",
          { className: "px-4 py-3 border-b border-stone-200 bg-stone-50" },
          React.createElement(
            "div",
            { className: "flex items-center gap-2" },
            React.createElement(X, { className: "w-4 h-4 text-stone-600" }),
            React.createElement(
              "h3",
              { className: "font-serif text-base text-stone-900" },
              "Partial file — never went through",
            ),
          ),
          React.createElement(
            "p",
            { className: "text-xs text-stone-600 mt-1 leading-relaxed" },
            "Some preparation work done, file never fully assembled. Candidate didn't proceed.",
          ),
        ),
        React.createElement(
          "div",
          { className: "divide-y divide-stone-100" },
          e
            .filter((e) => "partial_file_dropped" === e.decision)
            .sort((e, t) => (e.year || 0) - (t.year || 0))
            .map((e) => React.createElement(CohortRow, { key: e.name, c: e, pattern: "partial" })),
        ),
      ),
      React.createElement(
        "div",
        { className: "bg-white border border-emerald-300 rounded-sm overflow-hidden" },
        React.createElement(
          "div",
          { className: "px-4 py-3 border-b border-emerald-200", style: { backgroundColor: "#ECFDF5" } },
          React.createElement(
            "div",
            { className: "flex items-center gap-2" },
            React.createElement(CheckCircle2, { className: "w-4 h-4 text-emerald-700" }),
            React.createElement(
              "h3",
              { className: "font-serif text-base text-emerald-900" },
              "Currently in pipeline",
            ),
          ),
          React.createElement(
            "p",
            { className: "text-xs text-emerald-800 mt-1 leading-relaxed" },
            "Active candidates being evaluated under the new framework. Each is a test case for whether the gates work.",
          ),
        ),
        React.createElement(
          "div",
          { className: "divide-y divide-stone-100" },
          e
            .filter((e) => "in_progress" === e.decision)
            .sort((e, t) => (e.year || 0) - (t.year || 0))
            .map((e) => React.createElement(CohortRow, { key: e.name, c: e, pattern: "in_progress" })),
        ),
      ),
    ),
    React.createElement(
      "div",
      { className: "bg-white border border-stone-200 rounded-sm overflow-hidden" },
      React.createElement(
        "div",
        { className: "px-4 py-3 border-b border-stone-200 bg-stone-50" },
        React.createElement(
          "h3",
          { className: "font-serif text-base text-stone-900" },
          "Recruiting Manager accountability",
        ),
        React.createElement(
          "p",
          { className: "text-xs text-stone-500 mt-1" },
          "Volume and outcome by manager. Surfacing patterns of decisions, not blame.",
        ),
      ),
      React.createElement(
        "div",
        { className: "divide-y divide-stone-100" },
        a.map((e) =>
          React.createElement(
            "div",
            { key: e.name, className: "px-4 py-3" },
            React.createElement(
              "div",
              { className: "flex items-baseline justify-between gap-3 flex-wrap mb-2" },
              React.createElement(
                "div",
                null,
                React.createElement(
                  "div",
                  { className: "font-serif text-sm font-semibold text-stone-900" },
                  "unknown" === e.name ? "Unknown / unassigned" : e.name,
                ),
                React.createElement(
                  "div",
                  { className: "text-xs text-stone-500" },
                  e.total,
                  " candidate",
                  1 === e.total ? "" : "s",
                ),
              ),
              React.createElement(
                "div",
                { className: "flex gap-2 text-xs flex-wrap" },
                e.contractedFailed > 0 &&
                  React.createElement(
                    "span",
                    {
                      className: "px-2 py-0.5 rounded-sm font-semibold",
                      style: { backgroundColor: "#FEE2E2", color: "#7f1d1d" },
                    },
                    e.contractedFailed,
                    " contracted, failed",
                  ),
                e.completedNoShow > 0 &&
                  React.createElement(
                    "span",
                    {
                      className: "px-2 py-0.5 rounded-sm font-medium",
                      style: { backgroundColor: "#FEE2E2", color: "#9f1239" },
                    },
                    e.completedNoShow,
                    " no-show",
                  ),
                e.contractedStruggling > 0 &&
                  React.createElement(
                    "span",
                    { className: "px-2 py-0.5 bg-amber-100 text-amber-800 rounded-sm font-medium" },
                    e.contractedStruggling,
                    " struggling",
                  ),
                e.partialDropped > 0 &&
                  React.createElement(
                    "span",
                    { className: "px-2 py-0.5 bg-stone-100 text-stone-700 rounded-sm font-medium" },
                    e.partialDropped,
                    " dropped",
                  ),
                e.inProgress > 0 &&
                  React.createElement(
                    "span",
                    {
                      className: "px-2 py-0.5 rounded-sm font-medium",
                      style: { backgroundColor: "#D1FAE5", color: "#065F46" },
                    },
                    e.inProgress,
                    " in progress",
                  ),
                e.avgPS > 0 &&
                  React.createElement(
                    "span",
                    { className: "px-2 py-0.5 bg-stone-100 text-stone-700 rounded-sm font-mono" },
                    "avg PS ",
                    e.avgPS.toFixed(0),
                  ),
              ),
            ),
            React.createElement(
              "div",
              { className: "flex flex-wrap gap-1.5 mt-2" },
              e.candidates.map((e) => React.createElement(CohortChip, { key: e.name, c: e })),
            ),
          ),
        ),
      ),
    ),
    React.createElement(
      "div",
      { className: "bg-white border border-stone-300 rounded-sm overflow-hidden" },
      React.createElement(
        "div",
        { className: "px-4 py-3 border-b border-stone-200", style: { backgroundColor: "#F5EFE0" } },
        React.createElement(
          "div",
          { className: "flex items-baseline justify-between gap-3 flex-wrap" },
          React.createElement(
            "h3",
            { className: "font-serif text-base text-stone-900" },
            "Coaching evidence & manager accountability",
          ),
          React.createElement(
            "span",
            { className: "text-[10px] uppercase tracking-wider text-stone-500" },
            "Weekly Pulse · Market Surveys · Monthly Review",
          ),
        ),
        React.createElement(
          "p",
          { className: "text-xs text-stone-600 mt-1 leading-relaxed" },
          'Pulse reporting started January 13, 2026 in response to lack of forthcoming reports. Each manager\'s submission consistency, "On pace" rate, and the agents they name in coaching lists tell us where the gaps are.',
        ),
      ),
      React.createElement(
        "div",
        { className: "px-4 py-3 border-b border-stone-200" },
        React.createElement(
          "div",
          { className: "text-[11px] uppercase tracking-[0.14em] text-stone-700 font-semibold mb-3" },
          "Weekly Pulse — submission consistency & pace reporting",
        ),
        React.createElement(
          "div",
          { className: "grid gap-3 md:grid-cols-2 lg:grid-cols-4" },
          Object.entries(MANAGER_PULSE_SUMMARY).map(([e, t]) => {
            const a = t.submissions,
              n = a > 0 ? Math.round((t.on_pace / a) * 100) : 0,
              r = t.missed_weeks <= 2 ? "green" : t.missed_weeks <= 4 ? "amber" : "red",
              s = "green" === r ? "#15803d" : "amber" === r ? "#d97706" : "#9f1239",
              o = "green" === r ? "#D1FAE5" : "amber" === r ? "#FEF3C7" : "#FFE4E6";
            return React.createElement(
              "div",
              { key: e, className: "border border-stone-300 rounded-sm p-3 bg-stone-50" },
              React.createElement(
                "div",
                { className: "flex items-baseline justify-between gap-2 mb-2" },
                React.createElement(
                  "div",
                  { className: "font-semibold text-sm text-stone-900" },
                  e.split(" ")[0],
                ),
                React.createElement(
                  "span",
                  {
                    className: "text-[10px] font-mono px-1.5 py-0.5 rounded-sm",
                    style: { backgroundColor: o, color: s },
                  },
                  t.missed_weeks,
                  " missed wks",
                ),
              ),
              React.createElement(
                "div",
                { className: "grid grid-cols-3 gap-1 text-[10px] mb-2" },
                React.createElement(
                  "div",
                  { className: "text-center" },
                  React.createElement("div", { className: "text-stone-400 uppercase" }, "Subs"),
                  React.createElement("div", { className: "font-mono font-bold text-stone-900" }, a),
                ),
                React.createElement(
                  "div",
                  { className: "text-center" },
                  React.createElement("div", { className: "text-stone-400 uppercase" }, "On pace"),
                  React.createElement(
                    "div",
                    { className: "font-mono font-bold", style: { color: n >= 50 ? "#15803d" : "#9f1239" } },
                    n,
                    "%",
                  ),
                ),
                React.createElement(
                  "div",
                  { className: "text-center" },
                  React.createElement("div", { className: "text-stone-400 uppercase" }, "Behind"),
                  React.createElement("div", { className: "font-mono font-bold text-rose-700" }, t.behind),
                ),
              ),
              React.createElement(
                "div",
                { className: "text-[10px] text-stone-600 mb-1.5" },
                React.createElement(
                  "span",
                  { className: "text-stone-400 uppercase tracking-wider" },
                  "Coaching: ",
                ),
                React.createElement(
                  "span",
                  {
                    className: "font-medium",
                    style: { color: t.coaching_method.includes("Online") ? "#9f1239" : "#15803d" },
                  },
                  t.coaching_method,
                ),
              ),
              t.repeat_offenders.length > 0 &&
                React.createElement(
                  "div",
                  { className: "text-[10px] text-stone-700 mb-1.5" },
                  React.createElement(
                    "span",
                    { className: "text-stone-400 uppercase tracking-wider" },
                    "Repeat names: ",
                  ),
                  React.createElement("span", { className: "italic" }, t.repeat_offenders.join(", ")),
                ),
              React.createElement(
                "div",
                {
                  className:
                    "text-[10px] text-stone-600 leading-snug italic mt-2 pt-2 border-t border-stone-200",
                },
                t.pattern,
              ),
            );
          }),
        ),
      ),
      React.createElement(
        "div",
        { className: "px-4 py-3 border-b border-stone-200", style: { backgroundColor: "#FAFAF9" } },
        React.createElement(
          "div",
          { className: "text-[11px] uppercase tracking-[0.14em] text-stone-700 font-semibold mb-3" },
          "Market Survey quality — by recruit during file build",
        ),
        React.createElement(
          "div",
          { className: "grid gap-2 md:grid-cols-2" },
          Object.entries(MARKET_SURVEYS).map(([e, t]) => {
            const a = "red" === t.flag ? "#9f1239" : "amber" === t.flag ? "#d97706" : "#15803d",
              n = "red" === t.flag ? "#FFE4E6" : "amber" === t.flag ? "#FEF3C7" : "#ECFDF5";
            return React.createElement(
              "div",
              { key: e, className: "border-l-2 px-3 py-2 bg-white", style: { borderLeftColor: a } },
              React.createElement(
                "div",
                { className: "flex items-baseline justify-between gap-2 flex-wrap mb-1" },
                React.createElement("div", { className: "font-medium text-xs text-stone-900" }, e),
                React.createElement(
                  "div",
                  { className: "flex items-center gap-1.5 text-[10px]" },
                  React.createElement(
                    "span",
                    {
                      className: "font-mono px-1.5 py-0.5 rounded-sm",
                      style: { backgroundColor: n, color: a },
                    },
                    "avg ",
                    t.avg,
                  ),
                  React.createElement("span", { className: "text-stone-500" }, t.count, " surveys"),
                  React.createElement("span", { className: "text-stone-400" }, "via ", t.manager),
                ),
              ),
              React.createElement(
                "div",
                { className: "text-[10px] text-stone-600 italic leading-snug" },
                t.note,
              ),
            );
          }),
        ),
        React.createElement(
          "div",
          { className: "text-[10px] text-stone-500 italic mt-2 leading-relaxed" },
          "Survey quality during file build predicts post-contract behavior. One agent's 25 surveys averaging 6/100 (14 zeros) is volume without effort — and his manager's coaching method is \"Online GGLDC\" (group, generic). The two patterns reinforce each other.",
        ),
      ),
      React.createElement(
        "div",
        { className: "px-4 py-3 border-b border-stone-200" },
        React.createElement(
          "div",
          { className: "text-[11px] uppercase tracking-[0.14em] text-stone-700 font-semibold mb-3" },
          "Agent Monthly Review — projection vs achieved variance",
        ),
        React.createElement(
          "div",
          { className: "space-y-2" },
          Object.entries(AGENT_MONTHLY_VARIANCE).map(([e, t]) => {
            const a = t.income_var_pct < -30;
            return React.createElement(
              "div",
              { key: e, className: "border border-stone-200 rounded-sm px-3 py-2 bg-white" },
              React.createElement(
                "div",
                { className: "flex items-baseline justify-between gap-2 flex-wrap mb-1" },
                React.createElement(
                  "div",
                  { className: "font-medium text-xs text-stone-900" },
                  t.agent,
                  " ",
                  React.createElement("span", { className: "text-stone-500 font-normal" }, "— ", t.month),
                  React.createElement("span", { className: "text-stone-400 ml-2 italic" }, "via ", t.rm),
                ),
                React.createElement(
                  "span",
                  {
                    className: "text-[10px] font-mono px-1.5 py-0.5 rounded-sm font-semibold",
                    style: { backgroundColor: a ? "#FFE4E6" : "#ECFDF5", color: a ? "#9f1239" : "#15803d" },
                  },
                  "Income ",
                  t.income_var_pct > 0 ? "+" : "",
                  t.income_var_pct,
                  "%",
                ),
              ),
              React.createElement(
                "div",
                { className: "grid grid-cols-4 gap-1 text-[10px] font-mono" },
                [
                  ["Leads", t.leads_var_pct],
                  ["FF", t.ff_var_pct],
                  ["Close", t.close_var_pct],
                  [
                    "Apps",
                    t.apps_proj > 0 ? Math.round(((t.apps_actual - t.apps_proj) / t.apps_proj) * 100) : 0,
                  ],
                ].map(([e, t]) =>
                  React.createElement(
                    "div",
                    { key: e, className: "text-center" },
                    React.createElement("div", { className: "text-stone-400 uppercase tracking-wider" }, e),
                    React.createElement(
                      "div",
                      {
                        className:
                          "font-bold " +
                          (t < -30 ? "text-rose-700" : t < 0 ? "text-amber-700" : "text-emerald-700"),
                      },
                      t > 0 ? "+" : "",
                      t,
                      "%",
                    ),
                  ),
                ),
              ),
              React.createElement(
                "div",
                { className: "text-[10px] text-stone-600 italic leading-snug mt-1.5" },
                '"',
                t.note,
                '"',
              ),
            );
          }),
        ),
      ),
      React.createElement(
        "div",
        { className: "px-4 py-3 bg-stone-50 border-t border-stone-200" },
        React.createElement(
          "div",
          { className: "text-[11px] uppercase tracking-[0.14em] text-stone-700 font-semibold mb-2" },
          "What the data converges on",
        ),
        React.createElement(
          "ul",
          { className: "text-xs text-stone-700 space-y-1.5 leading-relaxed" },
          React.createElement(
            "li",
            null,
            "• ",
            React.createElement("strong", null, "One agent"),
            " appears on a manager's coaching list 4+ weeks running (Mar 10, 17, 23, Apr 18) — POP scores predicted dependency (IP=-32) and inflated CR (=76) bear out pre-license. The pattern is visible NOW, not 18 months later.",
          ),
          React.createElement(
            "li",
            null,
            "• ",
            React.createElement("strong", null, "A second agent"),
            ' noted "is unwell" in Feb 24 pulse. POP flagged AP=-20 + IP=-28 + CR=78 (triple caution). Currently zero production.',
          ),
          React.createElement(
            "li",
            null,
            "• ",
            React.createElement("strong", null, "A third agent"),
            ': 25 market surveys averaging 6/100 with 14 outright zeros. Manager\'s coaching method is "Online GGLDC" (generic). Volume without quality is volume without coaching.',
          ),
          React.createElement(
            "li",
            null,
            "• ",
            React.createElement("strong", null, "Akaash's unit"),
            ' shows "Behind (needs intervention)" 4 of 7 pulse submissions — highest of any RM. Same agent list named every week with same coaching method (Online GGLDC).',
          ),
          React.createElement(
            "li",
            null,
            "• ",
            React.createElement("strong", null, "Reporting started January 2026"),
            ' in response to "no reports forthcoming." Ricky\'s own unit: 1 submission across 16 weeks. Setting the example matters.',
          ),
        ),
      ),
    ),
    React.createElement(
      "div",
      { className: "bg-white border-2 border-amber-300 rounded-sm overflow-hidden" },
      React.createElement(
        "div",
        { className: "px-4 py-3 border-b border-amber-300", style: { backgroundColor: "#FEF3C7" } },
        React.createElement(
          "div",
          { className: "flex items-baseline justify-between gap-3 flex-wrap" },
          React.createElement(
            "h3",
            { className: "font-serif text-base text-stone-900" },
            "BMA file preparation — Kamla's accountability stage",
          ),
          React.createElement(
            "span",
            { className: "text-[10px] uppercase tracking-wider text-amber-800 font-semibold" },
            "Selection File · Onboarding",
          ),
        ),
        React.createElement(
          "p",
          { className: "text-xs text-stone-700 mt-1 leading-relaxed" },
          "Every recruit file moves through a single owner: the BMA. Master templates exist for both inexperienced and experienced tracks. The checklist below is what gets signed off before a candidate proceeds to Approval Routing. No exceptions, no missing items.",
        ),
      ),
      React.createElement(
        "div",
        { className: "grid md:grid-cols-2" },
        React.createElement(
          "div",
          { className: "px-4 py-3 border-r border-amber-200" },
          React.createElement(
            "div",
            { className: "text-[11px] uppercase tracking-[0.14em] text-amber-900 font-semibold mb-3" },
            "Inexperienced agent — file checklist",
          ),
          React.createElement(
            "div",
            { className: "space-y-1 text-[11px]" },
            FILE_PREP_INEXPERIENCED.map((e) =>
              React.createElement(
                "div",
                { key: e.num, className: "flex items-baseline gap-2 py-1 border-b border-stone-100" },
                React.createElement(
                  "span",
                  { className: "font-mono text-stone-400 w-8 text-right" },
                  e.num,
                  ".",
                ),
                React.createElement("span", { className: "flex-1 text-stone-800" }, e.item),
                React.createElement(
                  "span",
                  { className: "text-[9px] text-stone-400 italic whitespace-nowrap" },
                  e.source,
                ),
              ),
            ),
          ),
          React.createElement(
            "div",
            { className: "text-[10px] text-stone-500 italic mt-3" },
            "19 items. The seeded reference file is the template-compliance reference point.",
          ),
        ),
        React.createElement(
          "div",
          { className: "px-4 py-3" },
          React.createElement(
            "div",
            { className: "text-[11px] uppercase tracking-[0.14em] text-amber-900 font-semibold mb-3" },
            "Experienced agent — file checklist",
          ),
          React.createElement(
            "div",
            { className: "space-y-1 text-[11px]" },
            FILE_PREP_EXPERIENCED.map((e) =>
              React.createElement(
                "div",
                { key: e.num, className: "flex items-baseline gap-2 py-1 border-b border-stone-100" },
                React.createElement(
                  "span",
                  { className: "font-mono text-stone-400 w-8 text-right" },
                  e.num,
                  ".",
                ),
                React.createElement("span", { className: "flex-1 text-stone-800" }, e.item),
                React.createElement(
                  "span",
                  { className: "text-[9px] text-stone-400 italic whitespace-nowrap" },
                  e.source,
                ),
              ),
            ),
          ),
          React.createElement(
            "div",
            { className: "text-[10px] text-stone-500 italic mt-3" },
            "17 items. Form B replaces Form A. Adds prior production records and license standing.",
          ),
        ),
      ),
      React.createElement(
        "div",
        { className: "px-5 py-3 bg-stone-50 border-t border-amber-300" },
        React.createElement(
          "div",
          { className: "text-[11px] uppercase tracking-[0.14em] text-stone-700 font-semibold mb-1" },
          "What gets captured here",
        ),
        React.createElement(
          "ul",
          { className: "text-xs text-stone-700 space-y-1 leading-relaxed" },
          React.createElement(
            "li",
            null,
            "• Each item has a checkbox tied to the BMA. Missing items block stage-advance to Approval Routing.",
          ),
          React.createElement(
            "li",
            null,
            "• File-prep timeline is logged: days from POP completion to file complete. Targets: 14 days inexperienced, 7 days experienced.",
          ),
          React.createElement(
            "li",
            null,
            "• Onboarding sessions (post-contract) are also Kamla's domain — the new framework adds a 5-session minimum first 30 days for inexperienced contracts.",
          ),
          React.createElement(
            "li",
            null,
            "• Every contracted-failed agent in the cohort above had a complete file at Selection. The failure was not file prep — it was what came after. Both fall under the BMA when the new framework is in place.",
          ),
        ),
      ),
    ),
    React.createElement(
      "div",
      { className: "bg-white border-2 border-stone-900 rounded-sm overflow-hidden" },
      React.createElement(
        "div",
        {
          className: "px-4 py-3 border-b border-stone-200",
          style: { backgroundColor: "#07131f", color: "white" },
        },
        React.createElement(
          "h3",
          { className: "font-serif text-lg" },
          "Accountability — what this Tracker stops",
        ),
        React.createElement(
          "p",
          { className: "text-xs text-stone-300 mt-1 leading-relaxed" },
          "Every category above represents a specific failure mode. Each gate in the new framework targets one of them.",
        ),
      ),
      React.createElement(
        "div",
        { className: "p-5 space-y-4 text-sm text-stone-800 leading-relaxed" },
        React.createElement(
          "div",
          { className: "flex gap-3" },
          React.createElement(
            "span",
            {
              className: "font-serif text-2xl font-bold leading-none flex-shrink-0",
              style: { color: "#7f1d1d" },
            },
            "1.",
          ),
          React.createElement(
            "div",
            null,
            React.createElement("strong", null, "Contracting candidates who fail in the field."),
            " Jonathan, Terrell, Ganesh, Pradeep, Rondell — five contracts lost across the cohort, four of them in the last 18 months. POP scores looked acceptable on the surface but underlying scales (especially IP and EP) flagged dependency or activity risk that recruiting managers chose not to address. Production data confirms: every contracted-failed agent left with zero settled API. The new POP Review stage forces the RM to score each candidate's interview answers against the POP prediction (confirms / neutral / contradicts). The coaching plan that emerges becomes the agent's first 90-day scaffold — and the pattern across multiple candidates is visible in this dashboard, not surfaced 18 months later in a hindsight conversation.",
          ),
        ),
        React.createElement(
          "div",
          { className: "flex gap-3" },
          React.createElement(
            "span",
            {
              className: "font-serif text-2xl font-bold leading-none flex-shrink-0",
              style: { color: "#9f1239" },
            },
            "2.",
          ),
          React.createElement(
            "div",
            null,
            React.createElement(
              "strong",
              null,
              "Building full files for candidates who never come on board.",
            ),
            " Three candidates — three completed pipelines, three no-shows. Hours of session time. Market surveys. Confidential reports. Inspection reports. Then nothing. The Tracker now requires explicit candidate commitment milestones (signed Letter of Application + initial financial statement + spouse interview signature) before the BMA invests time on the formal file. No more building 18-document files for candidates who haven't proven they're going to sign.",
          ),
        ),
        React.createElement(
          "div",
          { className: "flex gap-3" },
          React.createElement(
            "span",
            {
              className: "font-serif text-2xl font-bold leading-none flex-shrink-0",
              style: { color: "#b45309" },
            },
            "3.",
          ),
          React.createElement(
            "div",
            null,
            React.createElement("strong", null, 'Approving candidates whose POP screams "decline".'),
            " Three past hires (AP=-20, IP=-28, CR=78; IP=-29; PS=18). Multiple structural cautions present in the POP, all approved anyway. The BM Approval gate's marginal-tier dimensional scoring catches this; the weak-tier override paper trail surfaces it. RMs cannot rubber-stamp a 1/5 POP again.",
          ),
        ),
        React.createElement(
          "div",
          { className: "flex gap-3" },
          React.createElement(
            "span",
            {
              className: "font-serif text-2xl font-bold leading-none flex-shrink-0",
              style: { color: "#07131f" },
            },
            "4.",
          ),
          React.createElement(
            "div",
            null,
            React.createElement("strong", null, "Letting good candidates slip after POP."),
            ' The "My Queue" view surfaces every candidate whose POP has completed but Discovery enrollment is pending. No more strong-PS candidates lost in inboxes — the pipeline board makes the orphan stage visible at a glance. Kamla and the recruiting managers see the same queue.',
          ),
        ),
      ),
    ),
  );
}
function CohortRow({ c: e, pattern: t }) {
  const a = null === e.PS ? "—" : e.PS,
    n = null === e.finalRating ? "—" : `${e.finalRating}/5`,
    r = "extreme_caution" === e.light ? "rose" : "caution" === e.light ? "amber" : "emerald",
    s = "rose" === r ? "#9f1239" : "amber" === r ? "#d97706" : "#15803d",
    o = e.agentId ? PRODUCTION_DATA[e.agentId] : null,
    c = (e) => {
      if (!e) return "";
      const t = new Date(e);
      return isNaN(t) ? e : t.toLocaleDateString("en-US", { month: "short", year: "numeric" });
    },
    i =
      e.hireDate &&
      (e.termDate || e.employmentStatus?.includes("Active") || "SELECTION" === e.employmentStatus)
        ? (() => {
            const t = new Date(e.hireDate),
              a = e.termDate ? new Date(e.termDate) : new Date();
            return isNaN(t) || isNaN(a) ? null : Math.round((a - t) / 2630016e3);
          })()
        : null;
  return React.createElement(
    "div",
    { className: "px-4 py-3 hover:bg-stone-50 transition-colors" },
    React.createElement(
      "div",
      { className: "flex items-baseline justify-between gap-3 flex-wrap mb-1" },
      React.createElement(
        "div",
        null,
        React.createElement("span", { className: "font-medium text-sm text-stone-900" }, e.name),
        React.createElement("span", { className: "text-xs text-stone-500 ml-2" }, e.year || ""),
        e.rm &&
          "unknown" !== e.rm &&
          React.createElement("span", { className: "text-xs text-stone-500 ml-2 italic" }, "via ", e.rm),
        e.agentId &&
          React.createElement("span", { className: "text-[10px] font-mono text-stone-400 ml-2" }, e.agentId),
      ),
      React.createElement(
        "div",
        { className: "flex items-center gap-2 text-xs" },
        null !== e.PS &&
          React.createElement(
            "span",
            { className: "font-mono px-1.5 py-0.5 bg-stone-100 text-stone-800 rounded-sm" },
            "PS ",
            a,
          ),
        null !== e.finalRating &&
          React.createElement(
            "span",
            {
              className: "font-mono px-1.5 py-0.5 rounded-sm font-semibold",
              style: {
                backgroundColor: "rose" === r ? "#FFE4E6" : "amber" === r ? "#FEF3C7" : "#D1FAE5",
                color: s,
              },
            },
            n,
          ),
      ),
    ),
    (e.hireDate || e.termDate) &&
      React.createElement(
        "div",
        { className: "text-[10px] text-stone-500 mb-1.5 flex items-center gap-2 flex-wrap" },
        e.hireDate &&
          React.createElement(
            "span",
            null,
            "Hired ",
            React.createElement("span", { className: "font-mono text-stone-700" }, c(e.hireDate)),
          ),
        e.termDate &&
          React.createElement(
            "span",
            { className: "text-rose-700" },
            "Terminated ",
            React.createElement("span", { className: "font-mono" }, c(e.termDate)),
          ),
        null !== i &&
          React.createElement(
            "span",
            { className: "font-mono text-stone-600" },
            i,
            " mo ",
            e.termDate ? "(tenure)" : "(active)",
          ),
        e.employmentStatus &&
          !e.employmentStatus.includes("never") &&
          !e.employmentStatus.includes("pipeline") &&
          React.createElement(
            "span",
            {
              className: "px-1.5 py-0.5 rounded-sm font-medium",
              style: {
                backgroundColor: e.termDate ? "#FEE2E2" : "#ECFDF5",
                color: e.termDate ? "#7f1d1d" : "#065F46",
              },
            },
            e.employmentStatus,
          ),
      ),
    React.createElement("div", { className: "text-xs text-stone-700 italic leading-relaxed" }, e.flag),
    null !== e.PS &&
      React.createElement(
        "div",
        { className: "mt-2 grid gap-1 grid-cols-7 text-[10px] font-mono" },
        [
          ["PS", e.PS, 30, 45],
          ["EP", e.EP, 30, 45],
          ["AP", e.AP, -20, 25],
          ["IP", e.IP, -25, 30],
          ["SD", e.SD, 25, 60],
          ["LM", e.LM, 25, 60],
          ["CR", e.CR, 25, 60],
        ].map(([e, t, a, n]) => {
          const r = null !== t && (t < a || ("CR" === e && t > n) || ("IP" === e && t > 40));
          return React.createElement(
            "div",
            { key: e, className: "text-center" },
            React.createElement("div", { className: "text-stone-400" }, e),
            React.createElement(
              "div",
              { className: r ? "text-rose-700 font-bold" : "text-stone-700" },
              null === t ? "—" : t,
            ),
          );
        }),
      ),
    o &&
      React.createElement(
        "div",
        {
          className: "mt-2 px-2.5 py-2 rounded-sm flex items-center gap-3 flex-wrap",
          style: {
            backgroundColor: "#FAFAF9",
            borderLeft: "3px solid " + (o.apps > 0 ? "#15803d" : "#9f1239"),
          },
        },
        React.createElement(
          "span",
          { className: "text-[10px] uppercase tracking-wider text-stone-500 font-semibold" },
          "Latest production",
        ),
        React.createElement(
          "span",
          { className: "text-xs" },
          React.createElement("span", { className: "font-mono font-bold text-stone-900" }, o.apps),
          React.createElement("span", { className: "text-stone-500 ml-0.5" }, "apps"),
        ),
        React.createElement(
          "span",
          { className: "text-xs" },
          React.createElement(
            "span",
            { className: "font-mono font-bold text-stone-900" },
            "$",
            o.settledAPI.toLocaleString(),
          ),
          React.createElement("span", { className: "text-stone-500 ml-0.5" }, "API"),
        ),
        o.lapsedCount > 0 &&
          React.createElement(
            "span",
            { className: "text-xs text-rose-700" },
            React.createElement("span", { className: "font-mono font-bold" }, o.lapsedCount),
            React.createElement(
              "span",
              { className: "ml-0.5" },
              "lapsed ($",
              o.lapsedAPI.toLocaleString(),
              ")",
            ),
          ),
        o.terminated &&
          React.createElement(
            "span",
            { className: "text-[10px] px-1.5 py-0.5 bg-rose-100 text-rose-800 rounded-sm font-medium" },
            "terminated before producing",
          ),
        o.preContract &&
          React.createElement(
            "span",
            { className: "text-[10px] px-1.5 py-0.5 bg-stone-100 text-stone-700 rounded-sm font-medium" },
            "pre-license",
          ),
        !o.terminated &&
          !o.preContract &&
          0 === o.apps &&
          React.createElement(
            "span",
            { className: "text-[10px] px-1.5 py-0.5 bg-amber-100 text-amber-800 rounded-sm font-medium" },
            "zero production",
          ),
      ),
  );
}
function CohortChip({ c: e }) {
  const t = {
    deep_rose: { bg: "#FECACA", text: "#7f1d1d" },
    rose: { bg: "#FFE4E6", text: "#9f1239" },
    amber: { bg: "#FEF3C7", text: "#b45309" },
    stone: { bg: "#F5F5F4", text: "#57534e" },
    emerald: { bg: "#D1FAE5", text: "#065F46" },
  }[
    "contracted_failed" === e.decision
      ? "deep_rose"
      : "completed_no_show" === e.decision
        ? "rose"
        : "contracted_struggling" === e.decision
          ? "amber"
          : "partial_file_dropped" === e.decision
            ? "stone"
            : "in_progress" === e.decision
              ? "emerald"
              : "stone"
  ];
  return React.createElement(
    "span",
    {
      className: "px-2 py-0.5 text-[11px] rounded-sm font-medium",
      style: { backgroundColor: t.bg, color: t.text },
      title: e.flag,
    },
    e.name,
    null !== e.PS && React.createElement("span", { className: "font-mono ml-1.5 opacity-70" }, e.PS),
  );
}
function App() {
  const [e, t] = useState({ activeCandidate: null, activeRole: "BM", view: "pipeline" }),
    [a, n] = useState([]),
    [r, s] = useState(null),
    [o, c] = useState(!1),
    [i, l] = useState(null);
  useEffect(() => {
    (async () => {
      const e = await loadState(),
        a = await loadCandidateList();
      if ((t(e), n(a), e.activeCandidate)) {
        const t = await loadCandidate(e.activeCandidate);
        t && s(t);
      }
      c(!0);
    })();
  }, []);
  const m = useCallback((e) => {
      t((t) => {
        const a = "function" == typeof e ? e(t) : e;
        return (saveState(a), a);
      });
    }, []),
    d = useCallback((e) => {
      s((t) => {
        if (!t) return t;
        const a = "function" == typeof e ? e(t) : e;
        return (
          (a.updated = new Date().toISOString()),
          saveCandidate(a).then(() => l(new Date())),
          n((e) => {
            const t = e.find((e) => e.id === a.id),
              n = { id: a.id, name: a.meta.name, currentStage: a.meta.currentStage, updated: a.updated },
              r = t ? e.map((e) => (e.id === a.id ? n : e)) : [...e, n];
            return (saveCandidateList(r), r);
          }),
          a
        );
      });
    }, []),
    [p, u] = useState([]);
  useEffect(() => {
    (async () => {
      if (!o || "pipeline" !== e.view) return;
      const t = await Promise.all(a.map((e) => loadCandidate(e.id)));
      u(t.filter(Boolean));
    })();
  }, [o, a, e.view]);
  const h = useCallback(async () => {
      const e = blankCandidate("");
      await saveCandidate(e);
      const t = [
        ...a,
        { id: e.id, name: e.meta.name, currentStage: e.meta.currentStage, updated: e.updated },
      ];
      (n(t), await saveCandidateList(t), s(e), m((t) => ({ ...t, activeCandidate: e.id, view: "detail" })));
    }, [a, m]),
    g = useCallback(
      async (e) => {
        const t = await loadCandidate(e);
        t && (s(t), m((t) => ({ ...t, activeCandidate: e, view: "detail" })));
      },
      [m],
    ),
    b = useCallback(
      async (t) => {
        if (!(await deleteCandidate(t))) return;
        const r = a.filter((e) => e.id !== t);
        (n(r),
          await saveCandidateList(r),
          u((e) => e.filter((e) => e.id !== t)),
          e.activeCandidate === t &&
            (s(null), m((e) => ({ ...e, activeCandidate: null, view: "pipeline" }))));
      },
      [a, e.activeCandidate, m],
    ),
    f = useCallback(() => {
      (m((e) => ({ ...e, view: "pipeline", activeCandidate: null })), s(null));
    }, [m]),
    x = (e) =>
      m((t) => ({
        ...t,
        view: e,
        activeCandidate: "pipeline" === e || "role" === e ? null : t.activeCandidate,
      })),
    v = useMemo(() => {
      const t = e.activeUser;
      return t && "ALL" !== t
        ? "Ricky Rampersad" === t
          ? p
          : p.filter((e) => e.meta?.recruitingManager === t)
        : p;
    }, [p, e.activeUser]);
  return o
    ? React.createElement(
        "div",
        { className: "min-h-screen font-sans", style: { backgroundColor: "#FAF6EE", color: "#1A1A1A" } },
        React.createElement(
          "style",
          null,
          "\n        @import url('https://fonts.googleapis.com/css2?family=Newsreader:ital,wght@0,400;0,500;0,600;0,700;1,400&family=Public+Sans:wght@400;500;600&display=swap');\n        body, .font-sans { font-family: 'Public Sans', system-ui, -apple-system, sans-serif; }\n        .font-serif { font-family: 'Newsreader', Georgia, serif; font-feature-settings: 'kern','liga'; }\n        .font-mono { font-family: ui-monospace, 'SF Mono', Menlo, monospace; }\n        @keyframes fadeUp {\n          from { opacity: 0; transform: translateY(8px); }\n          to { opacity: 1; transform: translateY(0); }\n        }\n        section, .stat-card { animation: fadeUp 0.4s ease-out backwards; }\n        .tabular-nums { font-variant-numeric: tabular-nums; }\n      ",
        ),
        React.createElement(
          "header",
          { className: "border-b border-stone-300/60", style: { backgroundColor: "#F5EFE0" } },
          React.createElement(
            "div",
            { className: "max-w-6xl mx-auto px-6 py-5" },
            React.createElement(
              "div",
              { className: "flex items-baseline justify-between gap-4 flex-wrap" },
              React.createElement(
                "div",
                { className: "flex items-center gap-3" },
                React.createElement(
                  "div",
                  { className: "mark w-12 h-12 flex-shrink-0" },
                  React.createElement("img", { src: "../logo-mark.png", alt: "" }),
                ),
                React.createElement(
                  "div",
                  null,
                  React.createElement(
                    "div",
                    { className: "text-[10px] uppercase tracking-[0.3em] text-stone-500 font-medium mb-1" },
                    "Ricky Rampersad · Branch",
                  ),
                  React.createElement(
                    "h1",
                    { className: "font-serif text-2xl text-stone-900 leading-tight" },
                    "Recruit Tracker ",
                    React.createElement("span", { className: "text-stone-400 italic font-normal" }, APP_VERSION),
                  ),
                ),
              ),
              React.createElement(
                "div",
                { className: "flex items-center gap-3 text-xs text-stone-500 flex-wrap" },
                React.createElement(
                  "span",
                  { className: "inline-flex items-center gap-1.5" },
                  React.createElement(Save, { className: "w-3.5 h-3.5" }),
                  React.createElement(
                    "span",
                    null,
                    i
                      ? `Saved ${i.toLocaleTimeString()}`
                      : _hasStorage
                        ? "Auto-saves on change"
                        : "⚠ In-memory only",
                  ),
                ),
                SESSION.profile &&
                  React.createElement(
                    "span",
                    { className: "inline-flex items-center gap-2" },
                    React.createElement("span", { className: "text-stone-700" }, SESSION.profile.name),
                    React.createElement("span", { className: "text-[10px] uppercase tracking-wider px-1.5 py-0.5 rounded-sm", style: { background: "#E2F6FA", color: "#0A6675" } }, SESSION.profile.title || SESSION.profile.role),
                    React.createElement("button", { onClick: signOut, className: "text-xs underline text-stone-500 hover:text-stone-900" }, "Sign out"),
                  ),
                React.createElement(
                  "button",
                  {
                    onClick: () =>
                      alert(
                        "Data storage:\n\n" +
                          (_hasStorage
                            ? "✓ Persistent storage active.\nData stored in this browser (IndexedDB) under keys:\n  • recruit-tracker:state\n  • recruit-tracker:candidate-list\n  • recruit-tracker:candidate:{id}\n\n"
                            : "⚠ window.storage unavailable. Using in-memory cache (data lost on refresh).\n\n") +
                          `Active candidates: ${a.length}\n` +
                          `Last save: ${i ? i.toLocaleString() : "no saves yet"}\n\nUse Export to download a JSON backup. Use Import to restore.`,
                      ),
                    className:
                      "inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-1 border border-stone-300 rounded-sm hover:bg-stone-100 transition-colors text-stone-700",
                    title: "Where is the data stored?",
                  },
                  "Data",
                ),
                React.createElement(
                  "button",
                  {
                    onClick: async () => {
                      const e = await Promise.all(a.map((e) => loadCandidate(e.id))),
                        t = new Blob(
                          [
                            JSON.stringify(
                              { exportedAt: new Date().toISOString(), candidates: e.filter(Boolean) },
                              null,
                              2,
                            ),
                          ],
                          { type: "application/json" },
                        ),
                        n = URL.createObjectURL(t),
                        r = document.createElement("a");
                      ((r.href = n),
                        (r.download = `recruit-tracker-backup-${new Date().toISOString().slice(0, 10)}.json`),
                        r.click(),
                        URL.revokeObjectURL(n));
                    },
                    className:
                      "inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-1 border border-stone-300 rounded-sm hover:bg-stone-100 transition-colors text-stone-700",
                    title: "Download all candidates as JSON backup",
                  },
                  "Export",
                ),
                React.createElement(
                  "label",
                  {
                    className:
                      "inline-flex items-center gap-1 text-[10px] uppercase tracking-wider px-2 py-1 border border-stone-300 rounded-sm hover:bg-stone-100 transition-colors text-stone-700 cursor-pointer",
                  },
                  "Import",
                  React.createElement("input", {
                    type: "file",
                    accept: "application/json",
                    className: "hidden",
                    onChange: async (e) => {
                      const t = e.target.files?.[0];
                      if (t) {
                        try {
                          const e = await t.text(),
                            r = JSON.parse(e),
                            s = r.candidates || [];
                          let o = 0,
                            c = 0,
                            i = 0;
                          for (const e of s) {
                            const t = await loadCandidate(e.id),
                              a = t ? mergeImportedCandidate(t, e) : e;
                            (t ? c++ : o++,
                              (i += Object.keys(e.stages?.selectionFile?.documentUploads || {}).length),
                              e.stages?.pop7Review?.uploadedReport?.base64 && i++,
                              await saveCandidate(a));
                          }
                          const l = (e) => ({
                              id: e.id,
                              name: e.meta?.name || "Unnamed",
                              currentStage: e.meta?.currentStage || "firstInterview",
                              updated: e.updated,
                            }),
                            m = [...a.filter((e) => !s.some((t) => t.id === e.id)), ...s.map(l)];
                          (n(m), await saveCandidateList(m));
                          const d = r.seedPart
                            ? `\n\nSeed part ${r.seedPart} of ${r.seedParts} loaded${r.seedPart < r.seedParts ? " — import the next part now." : " — all parts done!"}`
                            : "";
                          alert(
                            `Import complete.\n${o} candidate(s) created, ${c} merged.\n${i} document file(s) loaded.${d}`,
                          );
                        } catch (e) {
                          alert("Import failed: " + e.message);
                        }
                        e.target.value = "";
                      }
                    },
                  }),
                ),
              ),
            ),
            React.createElement(
              "div",
              { className: "mt-4 flex items-center gap-2 flex-wrap" },
              React.createElement(
                "div",
                { className: "flex border border-stone-300 rounded-sm overflow-hidden" },
                React.createElement(
                  "button",
                  {
                    onClick: () => x("pipeline"),
                    className:
                      "px-3 py-1.5 text-xs uppercase tracking-wider transition-colors " +
                      ("pipeline" === e.view
                        ? "bg-stone-900 text-stone-50"
                        : "bg-white text-stone-700 hover:bg-stone-100"),
                  },
                  React.createElement(Layers, { className: "w-3 h-3 inline-block mr-1.5" }),
                  " Pipeline",
                ),
                React.createElement(
                  "button",
                  {
                    onClick: () => x("role"),
                    className:
                      "px-3 py-1.5 text-xs uppercase tracking-wider transition-colors border-l border-stone-300 " +
                      ("role" === e.view
                        ? "bg-stone-900 text-stone-50"
                        : "bg-white text-stone-700 hover:bg-stone-100"),
                  },
                  React.createElement(ClipboardCheck, { className: "w-3 h-3 inline-block mr-1.5" }),
                  " My queue",
                ),
                React.createElement(
                  "button",
                  {
                    onClick: () => x("trends"),
                    className:
                      "px-3 py-1.5 text-xs uppercase tracking-wider transition-colors border-l border-stone-300 " +
                      ("trends" === e.view
                        ? "bg-stone-900 text-stone-50"
                        : "bg-white text-stone-700 hover:bg-stone-100"),
                  },
                  React.createElement(TrendingUp, { className: "w-3 h-3 inline-block mr-1.5" }),
                  " Trends",
                ),
              ),
              React.createElement("div", { className: "text-xs text-stone-400" }, "·"),
              React.createElement(
                "div",
                { className: "flex items-center gap-1.5 flex-wrap" },
                React.createElement(
                  "span",
                  {
                    className:
                      "text-[10px] uppercase tracking-wider text-stone-500 mr-0.5 inline-flex items-center gap-1",
                  },
                  React.createElement(User, { className: "w-3 h-3" }),
                  " Viewing as",
                ),
                React.createElement(
                  "select",
                  {
                    value: e.activeUser || "Ricky Rampersad",
                    disabled: !!(SESSION.profile && SESSION.profile.role !== "BM"),
                    title: SESSION.profile && SESSION.profile.role !== "BM" ? "The sheet shows you your own unit" : "",
                    onChange: (e) => {
                      return ((t = e.target.value), m((e) => ({ ...e, activeUser: t })));
                      var t;
                    },
                    className:
                      "text-[11px] px-2 py-1 border border-stone-300 rounded-sm bg-white text-stone-900 hover:border-stone-700 transition-colors font-medium",
                  },
                  // Whoever is on the workbook's Access tab. Change a job there and this follows.
                  ...(SESSION.roster.length ? SESSION.roster : [{ name: "Ricky Rampersad", title: "Branch Manager", scope: "all" }]).map((p) =>
                    React.createElement("option", { key: p.name, value: p.name },
                      `${p.name} — ${p.title || p.role}${p.scope === "all" ? " (sees all)" : ""}`),
                  ),
                ),
                e.activeUser &&
                  "Ricky Rampersad" !== e.activeUser &&
                  React.createElement(
                    "span",
                    {
                      className: "text-[10px] font-mono px-2 py-1 bg-amber-100 text-amber-800 rounded-sm",
                      title: "Filtered to this user's assigned recruits only",
                    },
                    v.length,
                    " of ",
                    p.length,
                  ),
              ),
            ),
          ),
        ),
        React.createElement(
          "main",
          { className: "max-w-6xl mx-auto px-6 py-6" },
          "pipeline" === e.view &&
            React.createElement(PipelineBoard, {
              candidates: v,
              onSelect: g,
              onCreate: h,
              onDelete: b,
              activeRole: e.activeRole,
              activeUser: e.activeUser,
            }),
          "role" === e.view &&
            React.createElement(RoleDashboard, { candidates: v, onSelect: g, role: e.activeRole }),
          "trends" === e.view && React.createElement(TrendsDashboard, null),
          "detail" === e.view &&
            r &&
            React.createElement(CandidateDetail, {
              candidate: r,
              persist: d,
              onBack: f,
              activeRole: e.activeRole,
              onSetStage: (e) => d((t) => setPath(t, ["meta", "currentStage"], e)),
            }),
        ),
        React.createElement(
          "footer",
          {
            className: "border-t border-stone-300/60 mt-10 py-6 text-center text-xs text-stone-400",
            style: { backgroundColor: "#F5EFE0" },
          },
          `Ricky Rampersad · Recruit Tracker · ${APP_VERSION} · rickyrampersadbranch.com/recruiting · candidates, files and figures held in the branch workbook, never in this page · sign-in from the Access tab · files in Drive · Claude via Apps Script${SESSION.serverVersion ? " · backend " + SESSION.serverVersion : ""}`,
        ),
      )
    : React.createElement(
        "div",
        { className: "min-h-screen flex items-center justify-center", style: { backgroundColor: "#FAF6EE" } },
        React.createElement(
          "div",
          { className: "text-stone-500 text-sm tracking-wider uppercase" },
          "Loading…",
        ),
      );
}
const _rootEl = document.getElementById("root");

function _paint(msg) {
  if (_rootEl) _rootEl.innerHTML =
    '<div style="font-family:Georgia,serif;padding:60px;text-align:center;color:#57534e"><div style="font-size:22px;color:#07131f;margin-bottom:8px">Recruit Tracker</div>' + msg + "</div>";
}

// What the sheet sends after sign-in becomes the module-level datasets the
// components were written against. Same shapes, different source.
function applySession(r) {
  SESSION.profile = r.profile || null;
  SESSION.roster = r.roster || [];
  SESSION.aiEnabled = !!r.aiEnabled;
  SESSION.serverVersion = r.version || "";
  const d = r.datasets || {};
  PRODUCTION_DATA = d.production || {};
  COHORT_DATA = d.cohort || [];
  MANAGER_PULSE_SUMMARY = d.managerPulse || {};
  AGENT_MONTHLY_VARIANCE = d.variance || {};
  MARKET_SURVEYS = d.marketSurveys || {};
}

function clearUiState() {
  try { localStorage.removeItem(SK.state); } catch {}
}
function signOut() {
  storeToken("");
  SESSION.token = "";
  clearUiState();
  location.reload();
}

// ---------------------------------------------------------------------------
//  Sign in
//  Name and password as they stand on the workbook's Access tab. The check
//  happens on the server; the page only ever sees a token.
// ---------------------------------------------------------------------------
function Login({ onDone }) {
  const [who, setWho] = useState("");
  const [pw, setPw] = useState("");
  const [busy, setBusy] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [err, setErr] = useState(configured() ? "" : "No Apps Script URL is set in recruiting/app.js yet.");
  const go = async (ev) => {
    ev && ev.preventDefault();
    if (busy) return;
    setBusy(true); setErr("");
    const r = await api("login", { who: who.trim(), password: pw }, setAttempt);
    setBusy(false);
    if (!r.ok) { setErr(r.error || "Could not sign in."); return; }
    SESSION.token = r.token;
    storeToken(r.token);
    clearUiState();
    applySession(r);
    onDone();
  };
  return React.createElement(
    "div",
    { className: "min-h-screen flex items-center justify-center p-6", style: { background: "radial-gradient(1100px 620px at 50% -10%, #12293d 0%, #07131f 62%)" } },
    React.createElement(
      "form",
      { onSubmit: go, className: "w-full max-w-sm text-center" },
      React.createElement("div", { className: "mark mx-auto mb-4", style: { width: 74, height: 74, boxShadow: "0 10px 34px rgba(0,0,0,.42)" } },
        React.createElement("img", { src: "../logo-mark.png", alt: "" })),
      React.createElement("div", { className: "text-[11px] uppercase tracking-[0.28em] font-bold mb-2", style: { color: "#efc24b" } }, "Ricky Rampersad · Branch"),
      React.createElement("h1", { className: "font-serif text-3xl text-white mb-1" }, "Recruit Tracker"),
      React.createElement("p", { className: "text-sm mb-7", style: { color: "#9FB3C4" } }, "Sign in with your name as it stands on the Access tab."),
      React.createElement("input", {
        value: who, onChange: (e) => setWho(e.target.value), placeholder: "Your name", autoComplete: "username", autoFocus: true,
        className: "block w-full mb-3 px-4 py-3 rounded-lg text-white text-center text-base outline-none",
        style: { background: "rgba(255,255,255,.07)", border: "1.5px solid rgba(255,255,255,.2)" },
      }),
      React.createElement("input", {
        value: pw, onChange: (e) => setPw(e.target.value), placeholder: "Password", type: "password", autoComplete: "current-password",
        className: "block w-full mb-4 px-4 py-3 rounded-lg text-white text-center text-base outline-none",
        style: { background: "rgba(255,255,255,.07)", border: "1.5px solid rgba(255,255,255,.2)" },
      }),
      React.createElement("button", {
        type: "submit", disabled: busy || !configured(),
        className: "w-full py-3 rounded-lg font-extrabold text-base tracking-wide disabled:opacity-50",
        style: { background: "linear-gradient(180deg,#efc24b,#c9942c)", color: "#07131f" },
      }, busy ? (attempt > 1 ? `Still trying (${attempt})…` : "Signing in…") : "Sign in"),
      React.createElement("p", { className: "text-sm mt-4 min-h-[1.5em]", style: { color: "#F0A79B" } }, err),
      React.createElement("p", { className: "text-xs mt-8 leading-relaxed", style: { color: "#6E8497" } },
        "Nothing about a candidate is kept in this page or on this device. It all lives in the branch workbook and comes down only to somebody signed in."),
    ),
  );
}

async function _boot() {
  _paint("Checking your sign-in…");
  SESSION.token = readStoredToken();
  let ready = false;
  if (SESSION.token && configured()) {
    const r = await api("me");
    if (r.ok) { applySession(r); ready = true; }
    else { SESSION.token = ""; storeToken(""); }
  }
  if (!ready) {
    await new Promise((resolve) => {
      ReactDOM.createRoot(_rootEl).render(React.createElement(Login, { onDone: resolve }));
    });
    // A fresh root for the app: React will not re-root a container that already has one.
    _rootEl.replaceWith(_rootEl.cloneNode(false));
  }
  const root = document.getElementById("root");
  ReactDOM.createRoot(root).render(React.createElement(App));
}
_boot();
