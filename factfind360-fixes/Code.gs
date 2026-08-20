// ════════════════════════════════════════════════════════════════
// RR BRANCH OS — Apps Script Backend  (Dashboard + FF Routing v2.0)
// Deploy as Web App, Execute as: Me, Anyone
//
// Merged 03 May 2026:
//   - Original 13 actions preserved verbatim (POP7, Production, etc.)
//   - NEW: doPost() handles Fact Find submissions to ffRevised tab
//   - NEW: ?action=ff_load returns a single FF for manager-review hydrate
//   - NEW: 3-stage FF routing — agent submits → manager reviews → agent prints
// ════════════════════════════════════════════════════════════════

var POP7_SHEET_ID       = "1ZTRhiVwFCAVOBLl09hhiGQS2aWHrA9yAt4gyXFek6MI";
var PRODUCTION_SHEET_ID = "1K65acMFFhmHt17hRozATnYda9t_BB63absPLeLx53h0";
var PENDING_SHEET_ID    = "1K65acMFFhmHt17hRozATnYda9t_BB63absPLeLx53h0";
var COACHING_LOG_SHEET_ID = "1uIlVx6yWBxLUw5tgtBbk1HukwlopWIxrShIqCpopSSk";

// FF storage — same workbook as JotForm legacy, new tab "ffRevised"
var FF_SHEET_ID = "1iytBbnETQFRmkveDSxadjsAfN07aMTW9E2slcA5qaWI";
var FF_REVISED_TAB = "ffRevised";

// FF V2 routing
var APP_URL = "https://factfinds.netlify.app/FFPROJECT.html";
var MAIL_CONFIG = {
  managers: {
    ricky:   { name: "Ricky Rampersad",   email: "ricky.rampersad@myguardiangroup.com"   },
    kerwyn:  { name: "Kerwyn Ramroach",   email: "kerwyn.ramroach@myguardiangroup.com"   },
    gary:    { name: "Gary Sookdeo",      email: "gary.sookdeo@myguardiangroup.com"      },
    akaash:  { name: "Akaash Kalladeen",  email: "akaash.kalladeen@myguardiangroup.com"  }
  },
  support:       "rickyrampersadsalessupport@myguardiangroup.com",
  branchManager: "ricky.rampersad@myguardiangroup.com"
};
var FF_SIG_FOLDER = "RR Branch FF Signatures";

// FY26 = Jan 1 – Sept 30, 2026
var FY_START = "2026-01-01";
var FY_END   = "2026-09-30";

var BRANCH_QUOTA_2026  = 13365000;
var BRANCH_QUOTA_ORIG  = 17820000;
var ABM_QUOTA_2026     = 4500000;
var UM_AKAASH_QUOTA    = 1987500;
var UM_GARY_QUOTA      = 2212500;

var AGENT_QUOTA_REP    = 300000;
var AGENT_QUOTA_EXEC   = 562500;
var AGENT_QUOTA_SSC    = 750000;

var AWARD_TOP_PRODUCER_FYC = 375000;
var AWARD_RUBY_FYC         = 1125000;
var AWARD_PALLADIUM_FYC    = 750000;
var AWARD_PLATINUM_FYC     = 450000;
var AWARD_DIAMOND_FYC      = 300000;
var AWARD_GOLD_FYC         = 247500;
var AWARD_SILVER_FYC       = 206250;
var AWARD_BRONZE_FYC       = 165000;

// ────────────────────────────────────────────────────────────────
// MAIN GET ROUTER
// ────────────────────────────────────────────────────────────────
function doGet(e) {
  var action = (e && e.parameter && e.parameter.action) || "";

  // A manager tapping Approve / Request changes in their email. These render
  // a page rather than JSON, so they return before the serialiser below.
  // These render a page rather than JSON, so they return before the
  // serialiser below — which also puts them outside its error handling, so
  // they carry their own. A manager who taps Approve must never land on
  // Google's raw error page.
  if (action === "decide" || action === "decide_note" || action === "decide_sign" ||
      action === "cconfirm" || action === "crate" || action === "crate_note" ||
      action === "outcome" || action === "agent_fix") {
    try {
      if (action === "cconfirm")   return rrbClientConfirm(e);
      if (action === "crate")      return rrbClientRate(e);
      if (action === "crate_note") return rrbClientRateNote(e);
      if (action === "outcome")    return rrbCaseOutcome(e);
      if (action === "agent_fix")  return rrbAgentFix(e);
      if (action === "decide_sign") return rrbDecideSign(e);
      return action === "decide" ? rrbDecide(e) : rrbDecideNote(e);
    } catch (err) {
      Logger.log('%s failed: %s', action, (err && err.stack) || err);
      var msg = '<div style="font-size:19px;font-weight:800;margin-bottom:8px">That did not go through</div>' +
        '<p style="color:#475569;margin:0 0 14px">Your decision was <strong>not</strong> recorded, so ' +
        'nothing has changed on the case.</p>' +
        '<p style="color:#64748B;font-size:13.5px;margin:0">Please open the dashboard and review it ' +
        'there, and tell the branch office this link failed.</p>';
      // rrbPage_ lives in RRBranchEmails.gs. If that file is missing, the
      // pretty page is the least of the problems — still say something.
      try { return rrbPage_('Something went wrong', msg, 'err'); }
      catch (e2) {
        return HtmlService.createHtmlOutput(
          '<meta name="viewport" content="width=device-width,initial-scale=1">' +
          '<div style="font:16px/1.5 -apple-system,Segoe UI,Arial,sans-serif;padding:26px;max-width:520px">' +
          msg + '</div>');
      }
    }
  }

  var nocache = (e && e.parameter && e.parameter.nocache) === "1";
  var out;
  try {
    var cacheableActions = {
      "production": 600,
      "settled_pbi": 600,
      "portfolio_pbi": 600,
      "submitted": 600,
      "lapses": 600,
      "overdues": 600,
      "premium_due_emails": 600,
      "portfolio": 600,
      "pending_lapses": 600,
      "pop7": 1800,
      "ff": 300
      // ff_load NOT cached — always fresh per submissionId
    };
    var ttl = cacheableActions[action];
    if (ttl && !nocache) {
      var cache = CacheService.getScriptCache();
      var cacheKey = "rrb_" + action + (e.parameter.code || "") + (e.parameter.year || "");
      var cached = cache.get(cacheKey);
      if (cached) {
        return ContentService
          .createTextOutput(cached)
          .setMimeType(ContentService.MimeType.JSON);
      }
    }

    if (action === "pop7")               out = getPop7();
    else if (action === "production")    out = getProduction();
    else if (action === "production_v2") out = getProductionV2();
    else if (action === "settled_pbi")   out = getSettledPBI(e.parameter);
    else if (action === "portfolio_pbi") out = getBranchPortfolioPBI();
    else if (action === "submitted")     out = getSubmitted();
    else if (action === "lapses")        out = getLapses();
    else if (action === "overdues")      out = getOverdues();
    else if (action === "premium_due_emails") out = getPremiumDueEmails();
    else if (action === "pending_lapses")out = getPortfolio();
    else if (action === "portfolio")     out = getPortfolio();
    else if (action === "ff")            out = getFactFinds(e.parameter);
    // ─── NEW V2 FF actions ──────────────────────────────────────
    else if (action === "ff_load")       out = ffLoadById(e.parameter);
    else if (action === "ff_revised")    out = getFactFindsRevised();
    else if (action === "ff_insights")   out = getFFInsights(e.parameter);
    // ────────────────────────────────────────────────────────────
    else if (action === "coaching")      out = getCoachingLog(e.parameter);
    else if (action === "login")        out = rrbLogin(e);
else if (action === "data")         out = rrbData(e);
// A decision from the dashboard queue. Session-token auth, never cached
// (absent from cacheableActions), and it writes the identical record to the
// email tap-to-approve path.
else if (action === "qdecide")      out = rrbQueueDecide(e);
else if (action === "roster")       out = rrbRoster(e);
// access_names is retired. It published every active agent's name and code
// with no authentication — the username half of every account — to populate a
// sign-in dropdown that no longer exists. Nothing calls it now.

    else if (action === "post_coaching") out = postCoachingEntry(e.parameter);
    else if (action === "diag")          out = diagnoseTabs();
    else if (action === "wall")          out = rrbWall(e);
    else if (action === "clear_cache")   out = clearAllCache();
    else if (action === "ping")          out = { success: true, message: "alive", time: new Date().toISOString(), fy_end: FY_END };
    else {
      out = {
        success: false,
        message: "Unknown action. GET: pop7 | production | settled_pbi | portfolio_pbi | submitted | lapses | overdues | premium_due_emails | portfolio | ff | ff_load&id=... | ff_revised | coaching | diag | ping | clear_cache · POST: {stage:agent_submit|manager_review, ...}",
        received_action: action
      };
    }

    if (ttl && !nocache && out && out.success !== false) {
      try {
        var serialized = JSON.stringify(out);
        if (serialized.length < 100000) {
          var cache2 = CacheService.getScriptCache();
          var cacheKey2 = "rrb_" + action + (e.parameter.code || "") + (e.parameter.year || "");
          cache2.put(cacheKey2, serialized, ttl);
        }
      } catch (cacheErr) {}
    }
  } catch (err) {
    out = { success: false, message: String(err && err.message || err), stack: String(err && err.stack || "") };
  }
  return ContentService
    .createTextOutput(JSON.stringify(out))
    .setMimeType(ContentService.MimeType.JSON);
}

// ────────────────────────────────────────────────────────────────
// MAIN POST ROUTER  (V2 FF submissions)
// Body: JSON  with stage in:
//   "agent_submit"            → routes to Direct Manager (or Branch Manager if same)
//   "direct_manager_review"   → routes to Branch Manager
//   "branch_manager_review"   → final approval, routes back to agent
//   "manager_review"          → back-compat: treated as branch_manager_review
// Content-Type: text/plain accepted (avoids CORS preflight)
// ────────────────────────────────────────────────────────────────
function doPost(e) {
  try {
    // A signature is far too big for a query string, so anything that carries
    // one arrives here instead of through doGet. Two shapes reach this door:
    // a browser form post (e.parameter.action — the signature page in the
    // review email) and a JSON body (the dashboard queue).
    var act = _str(e && e.parameter && e.parameter.action);
    if (act === "decide" || act === "decide_note" || act === "decide_sign" ||
        act === "cconfirm" || act === "crate" || act === "crate_note" ||
        act === "outcome" || act === "agent_fix") {
      try {
        if (act === "cconfirm")    return rrbClientConfirm(e);
        if (act === "crate")       return rrbClientRate(e);
        if (act === "crate_note")  return rrbClientRateNote(e);
        if (act === "outcome")     return rrbCaseOutcome(e);
        if (act === "agent_fix")   return rrbAgentFix(e);
        if (act === "decide_sign") return rrbDecideSign(e);
        return act === "decide" ? rrbDecide(e) : rrbDecideNote(e);
      } catch (perr) {
        Logger.log('doPost %s failed: %s', act, (perr && perr.stack) || perr);
        return rrbPage_('Something went wrong',
          '<div style="font-size:19px;font-weight:800;margin-bottom:8px">That did not go through</div>' +
          '<p style="color:#475569;margin:0">Your decision was <strong>not</strong> recorded. ' +
          'Please open the dashboard and decide it there.</p>', 'err');
      }
    }

    if (!e || !e.postData || !e.postData.contents) {
      return _ffJson({ ok: false, error: "No payload" });
    }
    var data = JSON.parse(e.postData.contents);
    var stage = data.stage || "agent_submit";
    // The dashboard queue posts its decision here so the drawn signature can
    // travel in a body rather than a URL. Same handler as the GET path.
    if (stage === "queue_decide") return _ffJson(rrbQueueDecide({ parameter: data }));
    if (stage === "client_response") return ffProcessClientResponse(data);
    if (stage === "agent_log") return ffProcessAgentLog(data);
    if (stage === "manager_review" ||
        stage === "direct_manager_review" ||
        stage === "branch_manager_review") return ffProcessManagerReview(data);
    return ffProcessAgentSubmit(data);
  } catch (err) {
    return _ffJson({ ok: false, error: "Server error: " + (err && err.message || err) });
  }
}function _ffJson(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

function clearAllCache() {
  var cache = CacheService.getScriptCache();
  cache.removeAll([
    "rrb_production", "rrb_settled_pbi", "rrb_portfolio_pbi",
    "rrb_submitted", "rrb_lapses", "rrb_overdues",
    "rrb_premium_due_emails", "rrb_portfolio", "rrb_pending_lapses",
    "rrb_pop7", "rrb_ff"
  ]);
  return { success: true, message: "Cache cleared. Next request will re-read sheets." };
}

// ════════════════════════════════════════════════════════════════
//                   F F   V 2   ROUTING  ── start
// ════════════════════════════════════════════════════════════════

// ── FF Schema ──────────────────────────────────────────────────
// Drives column order on first write to ffRevised. Adding new fields here
// auto-extends headers on next submit (existing rows unaffected).
function ffBuildSchema() {
  var s = [
    ["submissionId",        "Submission ID"],
    ["status",              "Status"],
    ["submittedAt",         "Submitted At"],
    ["lastUpdated",         "Last Updated"],
    ["approvedAt",          "Approved At"],

    ["appType",             "App Type"],
    ["clientName",          "Client Name"],
    ["advisorName",         "Advisor Name"],
    ["agentCode",           "Agent Code"],
    ["agentEmail",          "Agent Email"],
    ["adviceClientName",    "Advice Client Name"],
    ["adviceClientPhone",   "Advice Client Phone"],
    ["adviceClientEmail",   "Advice Client Email"],
    ["adviceClientNeed",    "Advice Client Need"],
    ["interviewDate",       "Interview Date"],

    ["reviewerKey",         "Reviewer Key"],
    ["reviewerName",        "Reviewer Name"],
    ["reviewerEmail",       "Reviewer Email"],

    ["fullName",            "Full Name"],
    ["idNumber",            "ID/DP/PP"],
    ["dob",                 "DOB"],
    ["maritalStatus",       "Marital Status"],
    ["email",               "Email"],
    ["phone",               "Phone"],
    ["address",             "Address"],
    ["smoker",              "Smoker/Vaper"],
    ["smokerDetails",       "Smoker Details"],

    ["empStatus",           "Emp Status"],
    ["occupation",          "Occupation"],
    ["monthlyIncome",       "Monthly Income"],
    ["employer",            "Employer"],
    ["tenure",              "Tenure"]
  ];
  for (var i = 1; i <= 3; i++) {
    s.push(["otherInc" + i + "Amt", "Other Inc " + i + " Amt"]);
    s.push(["otherInc" + i + "Src", "Other Inc " + i + " Src"]);
  }
  s.push(["spouseName","Spouse Name"]);
  s.push(["spouseDob","Spouse DOB"]);
  s.push(["spouseGender","Spouse Gender"]);
  s.push(["spouseOccupation","Spouse Occupation"]);
  s.push(["spouseEmployer","Spouse Employer"]);
  s.push(["spouseTenure","Spouse Tenure"]);
  s.push(["spouseEmpStatus","Spouse Emp Status"]);
  s.push(["spouseIncome","Spouse Income Range"]);
  for (var i2 = 1; i2 <= 3; i2++) {
    s.push(["child" + i2 + "Name",   "Child " + i2 + " Name"]);
    s.push(["child" + i2 + "Dob",    "Child " + i2 + " DOB"]);
    s.push(["child" + i2 + "Gender", "Child " + i2 + " Gender"]);
    s.push(["child" + i2 + "Occ",    "Child " + i2 + " Occ"]);
  }
  for (var i3 = 1; i3 <= 4; i3++) {
    s.push(["ins" + i3 + "Co",     "Ins " + i3 + " Co"]);
    s.push(["ins" + i3 + "Type",   "Ins " + i3 + " Type"]);
    s.push(["ins" + i3 + "Sum",    "Ins " + i3 + " Sum"]);
    s.push(["ins" + i3 + "Prem",   "Ins " + i3 + " Prem"]);
    s.push(["ins" + i3 + "Mode",   "Ins " + i3 + " Mode"]);
    s.push(["ins" + i3 + "Year",   "Ins " + i3 + " Year Issued"]);
    s.push(["ins" + i3 + "Status", "Ins " + i3 + " Status"]);
  }
  s.push(["fi_riaCover",          "RAI Suggested Cover"]);
  s.push(["fi_riaCover_band",     "RAI Cover Band"]);
  s.push(["fi_replacementRisk",   "FI Replacement Risk"]);
  s.push(["fi_replacementRisk_band","FI Replacement Band"]);
  s.push(["repDetected",          "Replacement Detected (V6)"]);
  s.push(["repDeclConfirm",       "Replacement Declaration Confirmed"]);
  s.push(["naqScore",             "Needs Analysis Quality Score"]);
  s.push(["productFit",           "RAI Product Fit"]);
  s.push(["lapseRisk",            "RAI Lapse Risk"]);
  s.push(["lapseRiskFactors",     "RAI Lapse Risk Factors"]);
  s.push(["fi_hlv",               "RAI Human Life Value"]);
  s.push(["fi_capitalization",    "RAI Capitalization Cover"]);
  s.push(["fi_jointClientShare",  "Joint: Client Income Share %"]);
  s.push(["fi_jointSpouseShare",  "Joint: Spouse Income Share %"]);
  s.push(["fi_uwMaxLife",         "UW Max Life (affordability)"]);
  s.push(["fi_uwMaxCI",           "UW Max CI (affordability)"]);
  s.push(["fi_praesidiaDI",       "Praesidia DI Benefit (mo)"]);
  s.push(["fi_praesidiaPrem",     "Praesidia Est Premium (mo)"]);
  s.push(["fi_uwEvidence",        "UW Evidence Required"]);
  s.push(["eduTier",              "Education Tier"]);
  s.push(["eduField",             "Education Field of Study"]);
  s.push(["ownsBusiness",         "Owns Business"]);
  s.push(["bizOwnPct",            "Business Ownership %"]);
  s.push(["bizRevenue",           "Business Annual Revenue"]);
  s.push(["bizEmployees",         "Business Employees/Partners"]);
  s.push(["bizLoan",              "Business Loan in Name"]);
  s.push(["bizLoanAmt",           "Business Loan Amount"]);
  s.push(["fi_keypersonValue",    "RAI Keyperson Need"]);
  s.push(["ffScope",              "Fact Find Scope"]);
  s.push(["addressArea",          "Address Area"]);
  s.push(["ins1Owner",            "Policy 1 Owner"]);
  s.push(["ins2Owner",            "Policy 2 Owner"]);
  s.push(["ins3Owner",            "Policy 3 Owner"]);
  s.push(["ins4Owner",            "Policy 4 Owner"]);
  s.push(["fi_coverClient",       "Existing Cover — Client"]);
  s.push(["fi_coverSpouse",       "Existing Cover — Spouse"]);
  s.push(["spouseMonthlyIncome",  "Spouse Monthly Income"]);
  s.push(["spouseOtherInc1Src",   "Spouse Other Income 1 Source"]);
  s.push(["spouseOtherInc1Amt",   "Spouse Other Income 1 Amount"]);
  s.push(["spouseOtherInc2Src",   "Spouse Other Income 2 Source"]);
  s.push(["spouseOtherInc2Amt",   "Spouse Other Income 2 Amount"]);
  s.push(["fi_spouseInsNeed",     "RAI Spouse Insurance Need"]);
  s.push(["fi_packageTotal",      "RAI Package Total Cover"]);
  s.push(["fi_packageLines",      "RAI Package Item Count"]);
  s.push(["dep1Rel",     "Dependant 1 Relationship"]);
  s.push(["dep1Name",    "Dependant 1 Name"]);
  s.push(["dep1Age",     "Dependant 1 Age"]);
  s.push(["dep1Gender",  "Dependant 1 Gender"]);
  s.push(["dep1Income",  "Dependant 1 Annual Income Provided"]);
  s.push(["dep2Rel",     "Dependant 2 Relationship"]);
  s.push(["dep2Name",    "Dependant 2 Name"]);
  s.push(["dep2Age",     "Dependant 2 Age"]);
  s.push(["dep2Gender",  "Dependant 2 Gender"]);
  s.push(["dep2Income",  "Dependant 2 Annual Income Provided"]);
  s.push(["dep3Rel",     "Dependant 3 Relationship"]);
  s.push(["dep3Name",    "Dependant 3 Name"]);
  s.push(["dep3Age",     "Dependant 3 Age"]);
  s.push(["dep3Gender",  "Dependant 3 Gender"]);
  s.push(["dep3Income",  "Dependant 3 Annual Income Provided"]);
  s.push(["propIncome",        "Property Earns Income"]);
  s.push(["propIncomeType",    "Property Income Type"]);
  s.push(["propIncomeAmt",     "Property Income Monthly"]);
  s.push(["propIncomeMortgage","Property Income Mortgaged"]);
  s.push(["otherInc1Src",  "Other Income 1 Source"]);
  s.push(["otherInc1Amt",  "Other Income 1 Monthly"]);
  s.push(["otherInc2Src",  "Other Income 2 Source"]);
  s.push(["otherInc2Amt",  "Other Income 2 Monthly"]);
  s.push(["otherInc3Src",  "Other Income 3 Source"]);
  s.push(["otherInc3Amt",  "Other Income 3 Monthly"]);
  s.push(["otherInc1Type", "Other Income 1 Type"]);
  s.push(["otherInc1Cont", "Other Income 1 Continues if Gone"]);
  s.push(["otherInc2Type", "Other Income 2 Type"]);
  s.push(["otherInc2Cont", "Other Income 2 Continues if Gone"]);
  s.push(["otherInc3Type", "Other Income 3 Type"]);
  s.push(["otherInc3Cont", "Other Income 3 Continues if Gone"]);
  // The REASON is the compliance artefact. Schedule 11 asks that the advice
  // suit the need found, and the reason on file is the only thing that shows
  // it did — yet these six had no column, so every reason an advisor typed
  // was dropped by ffWriteRow_ on the way to the sheet. The checks then
  // re-raised "no reason given" on a case that had just been fixed, which is
  // exactly what it looked like from the manager's side: an approval screen
  // that would not stop asking for something already supplied.
  s.push(["rec1Pri",  "Rec 1 Priority"]);
  s.push(["rec1Who",  "Rec 1 Who"]);
  s.push(["rec1Need", "Rec 1 Need"]);
  s.push(["rec1Rec",  "Rec 1 Plan"]);
  s.push(["rec1Amt",  "Rec 1 Amount Needed"]);
  s.push(["rec1Gap",  "Rec 1 Gap"]);
  s.push(["rec1Prem", "Rec 1 Premium"]);
  s.push(["rec1Mode", "Rec 1 Premium Mode"]);
  s.push(["rec1Reason","Rec 1 Reason"]);
  s.push(["rec2Pri",  "Rec 2 Priority"]);
  s.push(["rec2Who",  "Rec 2 Who"]);
  s.push(["rec2Need", "Rec 2 Need"]);
  s.push(["rec2Rec",  "Rec 2 Plan"]);
  s.push(["rec2Amt",  "Rec 2 Amount Needed"]);
  s.push(["rec2Gap",  "Rec 2 Gap"]);
  s.push(["rec2Prem", "Rec 2 Premium"]);
  s.push(["rec2Mode", "Rec 2 Premium Mode"]);
  s.push(["rec2Reason","Rec 2 Reason"]);
  s.push(["rec3Pri",  "Rec 3 Priority"]);
  s.push(["rec3Who",  "Rec 3 Who"]);
  s.push(["rec3Need", "Rec 3 Need"]);
  s.push(["rec3Rec",  "Rec 3 Plan"]);
  s.push(["rec3Amt",  "Rec 3 Amount Needed"]);
  s.push(["rec3Gap",  "Rec 3 Gap"]);
  s.push(["rec3Prem", "Rec 3 Premium"]);
  s.push(["rec3Mode", "Rec 3 Premium Mode"]);
  s.push(["rec3Reason","Rec 3 Reason"]);
  s.push(["rec4Pri",  "Rec 4 Priority"]);
  s.push(["rec4Who",  "Rec 4 Who"]);
  s.push(["rec4Need", "Rec 4 Need"]);
  s.push(["rec4Rec",  "Rec 4 Plan"]);
  s.push(["rec4Amt",  "Rec 4 Amount Needed"]);
  s.push(["rec4Gap",  "Rec 4 Gap"]);
  s.push(["rec4Prem", "Rec 4 Premium"]);
  s.push(["rec4Mode", "Rec 4 Premium Mode"]);
  s.push(["rec4Reason","Rec 4 Reason"]);
  s.push(["rec5Pri",  "Rec 5 Priority"]);
  s.push(["rec5Who",  "Rec 5 Who"]);
  s.push(["rec5Need", "Rec 5 Need"]);
  s.push(["rec5Rec",  "Rec 5 Plan"]);
  s.push(["rec5Amt",  "Rec 5 Amount Needed"]);
  s.push(["rec5Gap",  "Rec 5 Gap"]);
  s.push(["rec5Prem", "Rec 5 Premium"]);
  s.push(["rec5Mode", "Rec 5 Premium Mode"]);
  s.push(["rec5Reason","Rec 5 Reason"]);
  s.push(["rec6Pri",  "Rec 6 Priority"]);
  s.push(["rec6Who",  "Rec 6 Who"]);
  s.push(["rec6Need", "Rec 6 Need"]);
  s.push(["rec6Rec",  "Rec 6 Plan"]);
  s.push(["rec6Amt",  "Rec 6 Amount Needed"]);
  s.push(["rec6Gap",  "Rec 6 Gap"]);
  s.push(["rec6Prem", "Rec 6 Premium"]);
  s.push(["rec6Mode", "Rec 6 Premium Mode"]);
  s.push(["rec6Reason","Rec 6 Reason"]);
  s.push(["dec1Pri",  "Decision 1 Priority"]);
  s.push(["dec1Who",  "Decision 1 Who"]);
  s.push(["dec1Need", "Decision 1 Need"]);
  s.push(["dec1Plan", "Decision 1 Plan"]);
  s.push(["dec1Amt",  "Decision 1 Amount Taken"]);
  s.push(["dec1Prem", "Decision 1 Premium"]);
  s.push(["dec1Go",   "Decision 1 Go"]);
  s.push(["dec2Pri",  "Decision 2 Priority"]);
  s.push(["dec2Who",  "Decision 2 Who"]);
  s.push(["dec2Need", "Decision 2 Need"]);
  s.push(["dec2Plan", "Decision 2 Plan"]);
  s.push(["dec2Amt",  "Decision 2 Amount Taken"]);
  s.push(["dec2Prem", "Decision 2 Premium"]);
  s.push(["dec2Go",   "Decision 2 Go"]);
  s.push(["dec3Pri",  "Decision 3 Priority"]);
  s.push(["dec3Who",  "Decision 3 Who"]);
  s.push(["dec3Need", "Decision 3 Need"]);
  s.push(["dec3Plan", "Decision 3 Plan"]);
  s.push(["dec3Amt",  "Decision 3 Amount Taken"]);
  s.push(["dec3Prem", "Decision 3 Premium"]);
  s.push(["dec3Go",   "Decision 3 Go"]);
  s.push(["dec4Pri",  "Decision 4 Priority"]);
  s.push(["dec4Who",  "Decision 4 Who"]);
  s.push(["dec4Need", "Decision 4 Need"]);
  s.push(["dec4Plan", "Decision 4 Plan"]);
  s.push(["dec4Amt",  "Decision 4 Amount Taken"]);
  s.push(["dec4Prem", "Decision 4 Premium"]);
  s.push(["dec4Go",   "Decision 4 Go"]);
  s.push(["dec5Pri",  "Decision 5 Priority"]);
  s.push(["dec5Who",  "Decision 5 Who"]);
  s.push(["dec5Need", "Decision 5 Need"]);
  s.push(["dec5Plan", "Decision 5 Plan"]);
  s.push(["dec5Amt",  "Decision 5 Amount Taken"]);
  s.push(["dec5Prem", "Decision 5 Premium"]);
  s.push(["dec5Go",   "Decision 5 Go"]);
  s.push(["dec6Pri",  "Decision 6 Priority"]);
  s.push(["dec6Who",  "Decision 6 Who"]);
  s.push(["dec6Need", "Decision 6 Need"]);
  s.push(["dec6Plan", "Decision 6 Plan"]);
  s.push(["dec6Amt",  "Decision 6 Amount Taken"]);
  s.push(["dec6Prem", "Decision 6 Premium"]);
  s.push(["dec6Go",   "Decision 6 Go"]);
  s.push(["fi_bizLoan",           "RAI Business Loan Cover"]);
  s.push(["totalCoverage_calc","Total Coverage (calc)"]);
  s.push(["monthlyIncomeTotal","Monthly Income Total"]);
  s.push(["monthlyExpenses","Monthly Expenses"]);
  s.push(["cashSurplus_calc","Cash Surplus (calc)"]);
  s.push(["futureFactors","Future Factors"]);
  s.push(["futureFactorsRemarks","Future Factors Remarks"]);
  // Future Needs / Goals (4 rows: need, description, value, timeframe)
  for (var gi = 1; gi <= 4; gi++) {
    s.push(["goal" + gi + "Need", "Goal " + gi + " Need"]);
    s.push(["goal" + gi + "Desc", "Goal " + gi + " Description"]);
    s.push(["goal" + gi + "Val",  "Goal " + gi + " Value"]);
    s.push(["goal" + gi + "Tf",   "Goal " + gi + " Timeframe"]);
  }
  s.push(["budgetAnnual","Budget Annual"]);
  s.push(["budgetAnnualSrc","Budget Annual Src"]);
  s.push(["budgetSingle","Budget Single"]);
  s.push(["budgetSingleSrc","Budget Single Src"]);
  s.push(["budgetSubstantial","Budget Substantial"]);
  s.push(["includeAssets","Include Assets"]);
  s.push(["excludeAssetsReason","Exclude Assets Reason"]);
  ["house","cars","otherProp","cashBank","mutualFund","investments","other1","other2"].forEach(function(k){
    s.push([k+"Val", k+" Val"]); s.push([k+"Mo", k+" Mo"]); s.push([k+"KS", k+" K/S"]);
  });
  s.push(["totalAssets_calc","Total Assets (calc)"]);
  s.push(["cashFromAssets_calc","Cash from Sell-Assets (calc)"]);
  ["mortgage","bankLoan","creditUnion","creditCard","debtOther1","debtOther2"].forEach(function(k){
    s.push([k+"Bal", k+" Bal"]); s.push([k+"Mo", k+" Mo"]); s.push([k+"Ins", k+" Insured?"]);
  });
  s.push(["totalDebts_calc","Total Debts (calc)"]);
  s.push(["needIncome","Need Income"]);
  s.push(["needEducation","Need Education"]);
  s.push(["needSpouse","Need Spouse"]);
  s.push(["needLastExpenses","Need Last Expenses"]);
  s.push(["needOther","Need Other"]);
  s.push(["totalNeed_calc","Total Need (calc)"]);
  s.push(["insuranceNeed_calc","Insurance Need (calc)"]);
  s.push(["retCurrentIncome","Ret Current Income"]);
  s.push(["retPctIncome","Ret % Income"]);
  s.push(["retYears","Ret Years"]);
  s.push(["retInflRate","Ret Infl Rate"]);
  s.push(["retRoi","Ret ROI"]);
  s.push(["retSavings","Ret Savings"]);
  s.push(["retNis","Ret NIS"]);
  s.push(["retInflFactor_calc","Ret Infl Factor (calc)"]);
  s.push(["retFutureEarnings_calc","Ret Future Earnings (calc)"]);
  s.push(["retPensionRequired_calc","Ret Pension Required (calc)"]);
  s.push(["retLumpsum_calc","Ret Lumpsum (calc)"]);
  s.push(["retGap_calc","Ret Gap (calc)"]);
  for (var i4 = 1; i4 <= 4; i4++) {
    s.push(["goal" + i4 + "Need", "Goal " + i4 + " Need"]);
    s.push(["goal" + i4 + "Desc", "Goal " + i4 + " Desc"]);
    s.push(["goal" + i4 + "Val",  "Goal " + i4 + " Val"]);
    s.push(["goal" + i4 + "Tf",   "Goal " + i4 + " TF"]);
  }
  s.push(["medical","Medical"]);
  for (var i5 = 1; i5 <= 3; i5++) {
    s.push(["med" + i5 + "Person","Med " + i5 + " Person"]);
    s.push(["med" + i5 + "Condition","Med " + i5 + " Condition"]);
    s.push(["med" + i5 + "Treatment","Med " + i5 + " Treatment"]);
  }
  for (var i6 = 1; i6 <= 4; i6++) {
    s.push(["rec" + i6 + "Pri","Rec " + i6 + " Pri"]);
    s.push(["rec" + i6 + "Need","Rec " + i6 + " Need"]);
    s.push(["rec" + i6 + "Rec","Rec " + i6 + " Rec"]);
  }
  for (var i7 = 1; i7 <= 3; i7++) {
    s.push(["dec" + i7 + "Opt","Dec " + i7 + " Opt"]);
    s.push(["dec" + i7 + "Reason","Dec " + i7 + " Reason"]);
  }
  s.push(["replaceCover","Replace Cover"]);
  s.push(["notes","Notes"]);
  s.push(["finalDecide","Final Decision"]);
  // Financial Intelligence metrics (computed client-side at submit)
  s.push(["fi_surplusRatio",       "FI Surplus Ratio"]);
  s.push(["fi_surplusRatio_band",  "FI Surplus Band"]);
  s.push(["fi_dti",                "FI Debt-to-Income"]);
  s.push(["fi_dti_band",           "FI DTI Band"]);
  s.push(["fi_dta",                "FI Debt-to-Asset"]);
  s.push(["fi_dta_band",           "FI DTA Band"]);
  s.push(["fi_emergencyMonths",    "FI Emergency Fund"]);
  s.push(["fi_emergencyMonths_band","FI Emergency Band"]);
  s.push(["fi_coverageGap",        "FI Coverage Gap"]);
  s.push(["fi_coverageGap_band",   "FI Coverage Band"]);
  s.push(["fi_protectionMultiple", "FI Protection Multiple"]);
  s.push(["fi_protectionMultiple_band","FI Protection Band"]);
  s.push(["fi_premiumBurden",      "FI Premium Burden"]);
  s.push(["fi_premiumBurden_band", "FI Premium Band"]);
  s.push(["fi_insSpend",           "FI Insurance Spend"]);
  s.push(["fi_insSpend_band",      "FI Ins Spend Band"]);
  s.push(["fi_retReadiness",       "FI Retirement Readiness"]);
  s.push(["fi_retReadiness_band",  "FI Retirement Band"]);
  s.push(["advisorSigDate","Advisor Sig Date"]);
  s.push(["advisorSigUrl","Advisor Sig URL"]);
  // Manager review fields
  s.push(["mgrName","Mgr Name"]);
  s.push(["mgrEmail","Mgr Email"]);
  s.push(["mgrAgree","Mgr Agree"]);
  s.push(["mgrComments","Mgr Comments"]);
  s.push(["mgrRemedial","Mgr Remedial"]);
  s.push(["dmGuidance","Direct Manager Guidance to Agent"]);
  s.push(["dmResponded","Direct Manager Responded"]);
  s.push(["agentResponse","Agent Response to BM Intelligence"]);
  s.push(["notesExtra","Notes Extra"]);
  s.push(["q_why","Rationale Why Products"]);
  s.push(["q_need","Rationale Priority Need"]);
  s.push(["q_disability","Rationale Disability"]);
  s.push(["q_spouse","Rationale Spouse Income"]);
  s.push(["q_replace","Rationale Replacement"]);
  s.push(["q_gap","Rationale Gap"]);
  s.push(["ackReadBM","Agent Acknowledged BM Comments"]);
  s.push(["mgrSigDate","Mgr Sig Date"]);
  s.push(["managerSigUrl","Manager Sig URL"]);
  // The fact find has a sign-off box for the direct manager and another for the
  // branch manager, and the form reads exactly these keys to fill them. Neither
  // had a column, so the signature reached Drive, was written to a key nothing
  // stored, and the box came back empty on a case that had genuinely been
  // signed. managerSigUrl above is the legacy single field and kept working,
  // which is why this looked like a signature that half-saved.
  s.push(["dmSigUrl","Direct Mgr Sig URL"]);
  s.push(["bmSigUrl","Branch Mgr Sig URL"]);
  s.push(["bmSigDate","Branch Mgr Sig Date"]);
  s.push(["dmName","Direct Manager Name"]);
  // The four things a manager attests to when they sign. These ARE the review —
  // without them the record says a case was approved but not what was checked.
  s.push(["mgrVerData","Mgr Verified Data"]);
  s.push(["mgrVerRatios","Mgr Verified Affordability"]);
  s.push(["mgrVerSuit","Mgr Verified Suitability"]);
  s.push(["mgrVerCompliance","Mgr Verified Compliance"]);
  s.push(["mgrChecklist","Mgr AI Checklist"]);
  s.push(["mgrReviewedAt","Mgr Reviewed At"]);
  // How the manager signed off, and against which single-use token. A one-tap
  // email approval collects no drawn signature, so the record has to say that
  // plainly rather than leave a blank that reads like a missing signature.
  // The case outcome. A client saying yes at the kitchen table is an intention,
  // not a sale — the application still has to be written, underwritten, issued
  // and paid. Until an advisor confirms that, the premium is pipeline.
  s.push(["caseOutcome","Case Outcome"]);
  s.push(["caseOutcomeAt","Case Outcome At"]);
  s.push(["caseOutcomeBy","Case Outcome By"]);
  s.push(["policyNumber","Policy Number"]);
  s.push(["caseChasedAt","Last Chased At"]);
  s.push(["caseChaseCount","Times Chased"]);
  // A hold is a manager decision too: "seen it, not signing yet, here is why".
  // Status stays pending — a held case is still an open case everywhere it is
  // counted — but the queue shows who parked it and what they are waiting on.
  s.push(["caseHoldAt","On Hold Since"]);
  s.push(["caseHoldBy","On Hold By"]);
  s.push(["caseHoldNote","On Hold Reason"]);
  // What the client themselves confirmed, and what they thought of the service.
  s.push(["clientConfirmed","Client Confirmed"]);
  s.push(["clientConfirmedAt","Client Confirmed At"]);
  s.push(["clientChangeNote","Client Change Request"]);
  s.push(["clientRating","Client Rating"]);
  s.push(["clientRatingAt","Client Rated At"]);
  s.push(["clientFeedback","Client Feedback"]);
  s.push(["mgrSignatureMethod","Mgr Signature Method"]);
  s.push(["mgrSignatureRef","Mgr Signature Ref"]);
  // The name under the signature, and — where the manager did NOT approve —
  // the signature they drew against that refusal. A declined case must not
  // put a manager's mark in the fact find's sign-off spot: the form is not
  // signed off, it is going back. The mark still belongs on the record.
  s.push(["mgrSignName","Mgr Signed As"]);
  s.push(["mgrDecisionSigUrl","Mgr Decision Sig URL"]);
  // The round trip. A case the manager sent back and the advisor then fixed is
  // NOT a new case — but it used to arrive looking like one, with the same
  // checklist of concerns and no sign that anything had been answered. These
  // six carry what was asked for, what changed, and when, so the manager reads
  // the difference instead of re-reading the case.
  s.push(["sentBackAt","Sent Back At"]);
  s.push(["sentBackBy","Sent Back By"]);
  s.push(["sentBackNote","Sent Back Reason"]);
  s.push(["fixedAt","Fixed At"]);
  s.push(["fixedBy","Fixed By"]);
  s.push(["fixedWhat","What Was Fixed"]);
  s.push(["fixRound","Fix Round"]);
  s.push(["_sigFolderUrl","Signatures Folder"]);
  return s;
}

// Build schema lookup once on cold start
function _ffSchemaMaps() {
  var SCHEMA = ffBuildSchema();
  var k2l = {}, l2k = {};
  SCHEMA.forEach(function(p){ k2l[p[0]] = p[1]; l2k[p[1]] = p[0]; });
  return { schema: SCHEMA, k2l: k2l, l2k: l2k };
}

// ── Roster lookup (live from the Agent Roster tab in the Google Sheet) ──
// Reads the consolidated workbook's roster tab. Cached for 30 min.
// Returns: { "A12001": { name, email, unit }, ... }
function ffLoadRoster_() {
  // Reads the Access tab in this workbook — see RRBranchOS.gs. The old body
  // read a Salesforce export in a second workbook and always returned {}.
  return rrbRosterFromAccess_();
}

// ── Helper: determine Direct Manager from agent code via Roster unit ─
// Returns key from MAIL_CONFIG.managers ('akaash'/'gary'/'kerwyn'/'ricky')
function ffLookupDirectManager_(agentCode) {
  // Direct unit → manager mapping
  // 26000 = Ricky Branch Direct → Ricky is direct manager
  // 26001 = Kerwyn ABM cluster   → Kerwyn
  // 26002 = Akaash UM           → Akaash
  // 26003 = Gary UM              → Gary
  // NOTE: numeric unit codes are NOT reliable for routing — 26000 contains both
  // Ricky's directs AND Akaash's cluster (per branch report). Manager NAME is the truth.
  var ROSTER_UNIT_TO_KEY = {
    "Ricky Rampersad":            "ricky",
    "Kerwyn Ramroach":            "kerwyn",
    "Akaash Kalladeen":           "akaash",
    "Gary Sookdeo":               "gary",
    "Branch Direct (Ricky)":      "ricky",
    "Kerwyn Ramroach (ABM)":      "kerwyn",
    "Akaash Kalladeen (UM)":      "akaash",
    "Gary Sookdeo (UM)":          "gary"
  };
  // Static fallback by agent code for non-26000 units (matches getProduction logic)
  var AGENT_TO_KEY = {
    "A00427":"ricky",
    "A01066":"ricky",
    "A01363":"kerwyn",
    "A01452":"ricky",
    "A03522":"ricky",
    "A04020":"ricky",
    "A04028":"ricky",
    "A06869":"akaash",
    "A07347":"ricky",
    "A07350":"ricky",
    "A08413":"ricky",
    "A09088":"ricky",
    "A09281":"gary",
    "A09311":"ricky",
    "A10024":"ricky",
    "A10338":"kerwyn",
    "A10428":"ricky",
    "A10934":"kerwyn",
    "A11238":"akaash",
    "A11801":"gary",
    "A12001":"akaash",
    "A12173":"gary",
    "A12397":"akaash",
    "A12408":"akaash",
    "A12530":"gary",
    "A12663":"ricky",
    "A12749":"kerwyn",
    "A13063":"kerwyn",
    "A13064":"kerwyn",
    "A13088":"gary",
    "A13617":"gary",
    "A13682":"akaash",
    "A13710":"ricky"
  };
  var code = String(agentCode || "").toUpperCase().trim();
  // Static map from the branch report is authoritative; roster manager-name match is backup
  if (AGENT_TO_KEY[code]) return AGENT_TO_KEY[code];
  var roster = ffLoadRoster_();
  var ag = roster[code];
  if (ag && ag.unit && ROSTER_UNIT_TO_KEY[ag.unit]) return ROSTER_UNIT_TO_KEY[ag.unit];
  return "ricky"; // default fallback (Branch Direct)
}

// ── Stage 1: Agent submit → auto-routes to Direct Manager (or Branch if same) ─
function ffProcessAgentSubmit(data) {
  if (!data.agentCode) return _ffJson({ ok:false, error:"Agent code required" });

  // Lookup agent — auto-fill name + email if missing
  var roster = ffLoadRoster_();
  var code = String(data.agentCode).trim().toUpperCase();
  var agent = roster[code];
  if (agent) {
    if (!data.agentEmail)  data.agentEmail  = agent.email;
    if (!data.advisorName) data.advisorName = agent.name;
  }
  if (!data.agentEmail) {
    return _ffJson({ ok:false, error:"Agent email unknown — type it manually or update the Roster tab" });
  }

  // Determine Direct Manager from agent's unit
  var dmKey = ffLookupDirectManager_(code);
  var directMgr = MAIL_CONFIG.managers[dmKey];
  var branchMgr = MAIL_CONFIG.managers["ricky"];
  data.directManagerKey  = dmKey;
  data.directManagerName = directMgr.name;
  data.directManagerEmail = directMgr.email;
  // Back-compat: also write reviewerKey/Name/Email (legacy field)
  data.reviewerKey  = dmKey;
  data.reviewerName = directMgr.name;
  data.reviewerEmail = directMgr.email;

  data.submissionId = (data.submissionId && String(data.submissionId).length >= 8)
    ? String(data.submissionId)
    : Utilities.getUuid();
  data.lastUpdated = new Date().toISOString();
  if (!data.submittedAt) data.submittedAt = data.lastUpdated;

  // Single-stage review: the agent's direct manager is THE reviewer
  var skipsDirectStage = false;
  data.status = "pending_review";

  // Save advisor signature (only — no client digital sig in this flow)
  if (data._signatures && data._signatures.advisor) {
    ffSaveSigs_(data, ["advisor"]);
    delete data._signatures;
  }

  var sheet = ffGetOrCreateRevisedTab_();
  var headers = ffEnsureHeaders_(sheet);
  var targetRow = ffFindRowBySubmissionId_(sheet, headers, data.submissionId);

  // A resubmission is not a new case. Read what is already on the row FIRST:
  // if the manager sent this back, stamp the return trip so the review email
  // and the queue card both lead with what changed instead of presenting the
  // case cold for a second time. Without this the manager re-read a file they
  // had already read, saw the same list of concerns, and had no way to tell
  // whether their own instruction had been carried out.
  //
  // Only the handful of fields the return trip needs are lifted off the old
  // row. Re-reading the whole row back over `data` was the tempting version
  // and the wrong one — anything the payload carries that is not a schema
  // column (the PDF, the signatures, the routing fields set just above) would
  // vanish on the way through.
  var wasSentBack = false;
  if (targetRow > 0) {
    try {
      var prev = ffReadRow_(sheet, headers, targetRow);
      wasSentBack = _str(prev.status).toLowerCase().indexOf("changes") > -1;
      if (wasSentBack) {
        data.fixedAt   = data.lastUpdated;
        data.fixedBy   = data.advisorName || _str(prev.advisorName);
        data.fixedWhat = "Reopened the fact find and resubmitted it";
        data.fixRound  = (parseInt(_str(prev.fixRound), 10) || 0) + 1;
        // What the manager actually asked for, carried onto the new payload so
        // the email can print it back to them beside what changed.
        data.sentBackAt   = _str(prev.sentBackAt);
        data.sentBackBy   = _str(prev.sentBackBy);
        data.sentBackNote = _str(prev.sentBackNote) || _str(prev.dmGuidance);
        // submittedAt stays the ORIGINAL date. The queue ages a case from the
        // day the client was seen, not from the day it was patched — resetting
        // it would let a case that has been round twice look brand new.
        data.submittedAt = _str(prev.submittedAt) || data.submittedAt;
      }
    } catch (errPrev) { Logger.log("resubmit check failed: " + errPrev); }
  }

  ffWriteRow_(sheet, headers, data, targetRow);
  var finalRow = targetRow > 0 ? targetRow : sheet.getLastRow();

  // Single reviewer: the direct manager (Ricky for unit 26000 agents)
  var nextReviewer = directMgr;
  var role = "manager";

  // Email next reviewer (sales support + branch manager CC'd)
  try { ffSendReviewEmail_(data, nextReviewer, role); }
  catch (err) { Logger.log("Email failed: " + err); }

  // Agent's own copy — instant confirmation with view link + FI snapshot
  try { ffSendAgentCopyEmail_(data, nextReviewer, skipsDirectStage); }
  catch (err) { Logger.log("Agent copy email failed: " + err); }

  // The client's draft acknowledgement. rrbSendClientDraft() and its template
  // were written long ago; the wiring was left as a comment and never
  // connected, so clients heard nothing at submission.
  try { rrbSendClientDraftNow_(data); }
  catch (err) { Logger.log("Client draft email failed: " + err); }

  // Diagnostic: did the PDF reach the server, and could we build the attachment?
  var pdfLen = (data.pdfBase64 ? String(data.pdfBase64).length : 0);
  var pdfAtt = ffBuildPdfAttachment_(data);

  return _ffJson({
    ok: true,
    stage: "agent_submit",
    row: finalRow,
    submissionId: data.submissionId,
    skippedDirectStage: skipsDirectStage,
    nextReviewerName: nextReviewer.name,
    nextReviewerEmail: nextReviewer.email,
    nextStage: role,
    pdfReceivedChars: pdfLen,
    pdfAttachmentBuilt: pdfAtt ? true : false
  });
}

// ── Manager review — single stage, with AI checklist record ──
function ffProcessManagerReview(data) {
  if (!data.submissionId) return _ffJson({ ok:false, error:"Submission ID required" });

  var sheet = ffGetOrCreateRevisedTab_();
  var headers = ffEnsureHeaders_(sheet);
  var targetRow = ffFindRowBySubmissionId_(sheet, headers, data.submissionId);
  if (targetRow < 0) return _ffJson({ ok:false, error:"Submission not found" });

  var existing = ffReadRow_(sheet, headers, targetRow);

  // Save manager signature
  if (data._signatures && (data._signatures.manager || data._signatures.directManager || data._signatures.branchManager)) {
    data._signatures = { manager: data._signatures.manager || data._signatures.directManager || data._signatures.branchManager };
    data.clientName = existing.clientName;
    ffSaveSigs_(data, ["manager"]);
    delete data._signatures;
  }

  // Whitelist what the manager can change — includes the AI checklist record
  var ALLOWED = ["mgrAgree", "mgrComments", "mgrRemedial", "mgrSigDate", "managerSigUrl", "mgrChecklist", "dmGuidance", "dmResponded"];
  var update = {};
  ALLOWED.forEach(function(k){ if (data[k] !== undefined) update[k] = data[k]; });
  // Stamp reviewer identity from routing set at agent submit
  var dmKey = existing.directManagerKey || existing.reviewerKey;
  var rev = dmKey ? MAIL_CONFIG.managers[dmKey] : null;
  if (rev) { update.mgrName = rev.name; update.mgrEmail = rev.email; }
  update.mgrReviewedAt = new Date().toISOString();
   // A case the manager disagreed with is not approved. Marking it so put it
  // in the approved column on the dashboard, stopped the reminders chasing
  // it, and read as a finished case to anyone looking at the sheet.
  var mgrAgreed = /^agree/i.test(String(update.mgrAgree || ""));
  // A case the manager disagreed with is not approved. Marking it so put it
  // in the approved column on the dashboard, stopped the reminders chasing
  // it, and read as a finished case to anyone looking at the sheet.
  var mgrAgreed = /^agree/i.test(String(update.mgrAgree || ""));
  update.status     = mgrAgreed ? "approved" : "changes_requested";
  update.approvedAt = mgrAgreed ? update.mgrReviewedAt : "";

  update.lastUpdated  = update.mgrReviewedAt;

  var merged = {};
  Object.keys(existing).forEach(function(k){ merged[k] = existing[k]; });
  Object.keys(update).forEach(function(k){ merged[k] = update[k]; });
  ffWriteRow_(sheet, headers, merged, targetRow);

  try { ffSendApprovalEmail_(merged); }
  catch (err) { Logger.log("Approval email failed: " + err); }

  return _ffJson({
    ok: true,
    stage: "manager_review",
    row: targetRow,
    submissionId: data.submissionId,
    status: update.status
  });
}

// ── GET load by id (for manager-review hydrate) ────────────────
function ffLoadById(params) {
  var id = params && params.id;
  if (!id) return { ok:false, error:"Missing id parameter" };

  var sheet = ffGetOrCreateRevisedTab_();
  var headers = ffEnsureHeaders_(sheet);
  var targetRow = ffFindRowBySubmissionId_(sheet, headers, id);
  if (targetRow < 0) return { ok:false, error:"Submission not found" };
  return { ok:true, row:targetRow, data: ffReadRow_(sheet, headers, targetRow) };
}

// ── Sheet helpers ──────────────────────────────────────────────
function ffGetOrCreateRevisedTab_() {
  var ss = SpreadsheetApp.openById(FF_SHEET_ID);
  return ss.getSheetByName(FF_REVISED_TAB) || ss.insertSheet(FF_REVISED_TAB);
}

function ffEnsureHeaders_(sheet) {
  var maps = _ffSchemaMaps();
  var headers = [];
  if (sheet.getLastColumn() > 0) {
    headers = sheet.getRange(1, 1, 1, sheet.getLastColumn())
      .getValues()[0].map(String).filter(function(h){ return h !== ""; });
  }
  if (headers.length === 0) {
    headers = maps.schema.map(function(p){ return p[1]; });
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    ffFormatHeader_(sheet, 1, headers.length);
    sheet.setFrozenRows(1);
  } else {
    var expected = maps.schema.map(function(p){ return p[1]; });
    expected.forEach(function(lbl){
      if (headers.indexOf(lbl) === -1) {
        headers.push(lbl);
        sheet.getRange(1, headers.length).setValue(lbl);
        ffFormatHeader_(sheet, headers.length, headers.length);
      }
    });
  }
  return headers;
}

function ffFormatHeader_(sheet, fromCol, toCol) {
  var n = toCol - fromCol + 1;
  if (n < 1) return;
  sheet.getRange(1, fromCol, 1, n)
    .setFontWeight("bold")
    .setBackground("#0E1F4D")
    .setFontColor("#FFFFFF")
    .setVerticalAlignment("middle");
}

function ffFindRowBySubmissionId_(sheet, headers, submissionId) {
  var maps = _ffSchemaMaps();
  var subIdLabel = maps.k2l["submissionId"];
  var subIdCol = headers.indexOf(subIdLabel) + 1;
  if (subIdCol < 1 || sheet.getLastRow() < 2) return -1;
  var ids = sheet.getRange(2, subIdCol, sheet.getLastRow() - 1, 1)
    .getValues().flat().map(String);
  var idx = ids.indexOf(submissionId);
  return idx >= 0 ? idx + 2 : -1;
}

function ffReadRow_(sheet, headers, rowNum) {
  var maps = _ffSchemaMaps();
  var vals = sheet.getRange(rowNum, 1, 1, headers.length).getValues()[0];
  var out = {};
  headers.forEach(function(label, i){
    var key = maps.l2k[label] || label;
    var v = vals[i];
    if (v !== "" && v !== null && v !== undefined) out[key] = v;
  });
  return out;
}

function ffWriteRow_(sheet, headers, data, targetRow) {
  var maps = _ffSchemaMaps();
  var rowVals = headers.map(function(label){
    var key = maps.l2k[label] || label;
    var v = data[key];
    if (v === undefined || v === null) return null;  // sentinel
    if (v instanceof Date) return v;
    if (typeof v === "object") return JSON.stringify(v);
    return v;
  });
  if (targetRow > 0) {
    var existing = sheet.getRange(targetRow, 1, 1, headers.length).getValues()[0];
    var merged = rowVals.map(function(v, i){ return v === null ? existing[i] : v; });
    sheet.getRange(targetRow, 1, 1, headers.length).setValues([merged]);
  } else {
    var final = rowVals.map(function(v){ return v === null ? "" : v; });
    sheet.appendRow(final);
  }
}

// ── Signatures ─────────────────────────────────────────────────
// Maps role → URL field on the row:
//   advisor       → advisorSigUrl
//   directManager → dmSigUrl
//   branchManager → bmSigUrl
//   manager       → managerSigUrl  (legacy)
function ffSaveSigs_(data, roles) {
  var sigs = data._signatures || {};
  var root = ffGetOrCreateFolder_(FF_SIG_FOLDER);
  var safeName = String(data.clientName || "unknown")
    .replace(/[^a-z0-9]/gi, "_").slice(0, 30) || "unknown";
  var folderName = String(data.submissionId).slice(0, 8) + "_" + safeName;
  var sub = ffGetOrCreateSubfolder_(root, folderName);

  var URL_FIELD = {
    advisor: "advisorSigUrl",
    directManager: "dmSigUrl",
    branchManager: "bmSigUrl",
    manager: "managerSigUrl"  // legacy
  };

  roles.forEach(function(role){
    var dataUrl = sigs[role];
    if (!dataUrl || typeof dataUrl !== "string" || dataUrl.indexOf("data:image/") !== 0) return;
    try {
      var b64 = dataUrl.split(",")[1];
      if (!b64) return;
      var blob = Utilities.newBlob(
        Utilities.base64Decode(b64),
        "image/png",
        role + "_signature.png"
      );
      var existing = sub.getFilesByName(role + "_signature.png");
      while (existing.hasNext()) existing.next().setTrashed(true);
      var f = sub.createFile(blob);
      // Make readable by link so the form can display it
      try { f.setSharing(DriveApp.Access.ANYONE_WITH_LINK, DriveApp.Permission.VIEW); } catch(_){}
      var url = f.getUrl();
      var field = URL_FIELD[role] || (role + "SigUrl");
      data[field] = url;
    } catch (err) {
      Logger.log("Failed to save " + role + " sig: " + err);
    }
  });
  data._sigFolderUrl = sub.getUrl();
  return sub;
}

function ffGetOrCreateFolder_(name) {
  var it = DriveApp.getFoldersByName(name);
  return it.hasNext() ? it.next() : DriveApp.createFolder(name);
}
function ffGetOrCreateSubfolder_(parent, name) {
  var it = parent.getFoldersByName(name);
  return it.hasNext() ? it.next() : parent.createFolder(name);
}

// ── Email ──────────────────────────────────────────────────────
function ffReviewLink_(submissionId, role) {
  var r = role || "branch_manager";
  return APP_URL + "?id=" + encodeURIComponent(submissionId) + "&role=" + r;
}
function ffViewLink_(submissionId) {
  return APP_URL + "?id=" + encodeURIComponent(submissionId);
}
function ffFmtCurrency_(v) {
  var n = parseFloat(v);
  if (isNaN(n)) return String(v || "—");
  return "TT$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

// Send the right review email for the right stage.
// reviewer  = MAIL_CONFIG.managers entry (the recipient)
// role      = 'direct_manager' | 'branch_manager' (controls URL + subject)
// dmInfo    = (optional) MAIL_CONFIG.managers entry for the Direct Manager who already
//             reviewed. Adds them to CC so they see the handoff to Branch Manager.
// Compact FI ratio block for email bodies
function ffFiBlock_(d) {
  var rows = [];
  function add(label, key) {
    if (d[key] !== undefined && d[key] !== "") {
      var flag = d[key + "_band"] === "bad" ? "  ⚠ ATTENTION" : (d[key + "_band"] === "warn" ? "  ⚠" : "");
      rows.push("  " + label + ": " + d[key] + flag);
    }
  }
  add("Surplus Ratio        ", "fi_surplusRatio");
  add("Debt-to-Income       ", "fi_dti");
  add("Debt-to-Asset        ", "fi_dta");
  add("Emergency Fund       ", "fi_emergencyMonths");
  add("Coverage Gap         ", "fi_coverageGap");
  add("Protection Multiple  ", "fi_protectionMultiple");
  add("Premium Burden       ", "fi_premiumBurden");
  add("Retirement Readiness ", "fi_retReadiness");
  if (!rows.length) return "";
  return "\nFINANCIAL INTELLIGENCE\n" + rows.join("\n") + "\n";
}

// Agent confirmation copy — sent immediately on submission
function ffSendAgentCopyEmail_(d, nextReviewer, skipped) {
  // Branded HTML in the same shell as every other message — see
  // RRBranchEmails.gs. This was the only email sent as plain text.
  return rrbSendAgentCopy_(d, nextReviewer, skipped);
}

// Build a Gmail PDF attachment from a base64 string the frontend supplies.
// The fact-find PDF is generated client-side (buildPrintLayout), so the form
// posts it as data.pdfBase64. If absent (older client), no attachment is added.
function ffBuildPdfAttachment_(d) {
  try {
    var b64 = d.pdfBase64 || d.pdf_base64 || "";
    if (!b64) return null;
    // strip a data-URL prefix if present
    var comma = b64.indexOf(",");
    if (b64.lastIndexOf("data:", 0) === 0 && comma > -1) b64 = b64.substring(comma + 1);
    if (b64.length < 100) return null; // not a real document
    var bytes = Utilities.base64Decode(b64);
    var safeName = String(d.clientName || "Client").replace(/[^A-Za-z0-9 _-]/g, "").trim() || "Client";
    var fileName = "Fact Find - " + safeName + ".pdf";
    return Utilities.newBlob(bytes, "application/pdf", fileName);
  } catch (e) {
    return null; // never let attachment failure block the email
  }
}

function ffSendReviewEmail_(d, reviewer, role, dmInfo) {
  reviewer = reviewer || MAIL_CONFIG.managers[d.reviewerKey || "ricky"];
  // Scope-aware: a Specific Need Only case is a different question, and the
  // manager should be able to tell which one it is from the inbox.
  var subject = rrbReviewSubject_(d);
  var link = ffReviewLink_(d.submissionId, "manager");
  var html = rrbWithDraft_(rrbManagerReviewHtml_(d, link));
  var ccArr = [d.agentEmail, MAIL_CONFIG.support, MAIL_CONFIG.branchManager, RRB_ALWAYS_CC];
  var seen = {};
  var ccs = ccArr.filter(function (x) {
    if (!x || x === reviewer.email || seen[x]) return false;
    seen[x] = 1; return true;
  });
  var opts = {
    to: reviewer.email,
    cc: ccs.join(","),
    subject: subject,
    htmlBody: html,
    name: "RR Branch Fact Find"
  };
  // Keep the PDF where it fits. If Gmail refuses it, the review must still
  // reach the manager — the link opens the case in full either way.
  var att = ffBuildPdfAttachment_(d);
  if (att) {
    try {
      opts.attachments = [att];
      MailApp.sendEmail(opts);
      return;
    } catch (e) {
      Logger.log("Review email with attachment failed, retrying without: " + e);
      delete opts.attachments;
      opts.subject = subject + " (PDF too large to attach — open the link)";
    }
  }
  MailApp.sendEmail(opts);
}


function ffSendApprovalEmail_(d) {
  var agreed = /^agree/i.test(String(d.mgrAgree || ""));
  var name   = d.clientName || "client";
  // 1. The agent, either way — but two different messages.
  if (d.agentEmail) {
    var ccArr = [MAIL_CONFIG.support, MAIL_CONFIG.branchManager, RRB_ALWAYS_CC, d.mgrEmail];
    var seen = {};
    var ccs = ccArr.filter(function (x) {
      if (!x || x === d.agentEmail || seen[x]) return false;
      seen[x] = 1; return true;
    });
    MailApp.sendEmail({
      to: d.agentEmail,
      cc: ccs.join(","),
      subject: agreed
        ? "Approved — " + name + ", ready for the client"
        : "Sent back — " + name + " needs changes before the client sees it",
      htmlBody: agreed ? rrbAgentApprovedHtml_(d) : rrbAgentDeclinedHtml_(d),
      name: "RR Branch Fact Find"
    });
  }
  // 2. The client, ONLY where the manager agreed.
  //    Telling a client their plan is approved and then walking it back is the
  //    one mistake here that cannot be undone.
  // Same trap as the draft email: a Specific Need Only case holds the address
  // in adviceClientEmail, so reading only these two meant a limited-scope
  // client was never told their plan had been approved either.
  var clientEmail = rrbClientEmail_(d);
  if (agreed && clientEmail) {
    MailApp.sendEmail({
      to: clientEmail,
      cc: RRB_ALWAYS_CC,
      subject: "Your plan has been reviewed and approved",
      // The one moment a client is pleased and paying attention — the only
      // honest time to ask what they thought of the service.
      htmlBody: rrbClientApprovedHtml_(d) + rrbClientRateBlock_(d),
      name: d.advisorName || "RR Branch"
    });
  } else if (!agreed) {
    Logger.log("Manager did not agree — nothing sent to the client, by design.");
  }
}


function getFactFindsRevised() {
  var ss = SpreadsheetApp.openById(FF_SHEET_ID);
  var sh = ss.getSheetByName(FF_REVISED_TAB);
  if (!sh || sh.getLastRow() < 2) {
    return {
      success: true,
      sheet_id: FF_SHEET_ID,
      tab: FF_REVISED_TAB,
      total_rows: 0,
      total_submissions: 0,
      branch_total: 0,
      by_agent: {},
      submissions: []
    };
  }
  var values = sh.getDataRange().getValues();
  var headers = values[0].map(function(h){ return _str(h); });
  var maps = _ffSchemaMaps();

  function colIdx(key) {
    var lbl = maps.k2l[key];
    return lbl ? headers.indexOf(lbl) : -1;
  }
  var iEmail   = colIdx("agentEmail");
  var iCode    = colIdx("agentCode");
  var iName    = colIdx("advisorName");
  var iClient  = colIdx("clientName");
  var iStatus  = colIdx("status");
  var iSubAt   = colIdx("submittedAt");
  var iAppAt   = colIdx("approvedAt");
  var iNeed    = colIdx("insuranceNeed_calc");
  var iTotNeed = colIdx("totalNeed_calc");
  var iSubId   = colIdx("submissionId");
  var iProduct = colIdx("rec1Rec");
  var iDecision = colIdx("finalDecide");

  var byAgent = {}, byStatus = {}, byCode = {};
  var subs = [];
  var now = new Date();
  var ms30 = 30 * 24 * 60 * 60 * 1000;
  var byAgent30d = {};

  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var email = iEmail >= 0 ? _str(row[iEmail]).toLowerCase() : "";
    var code  = iCode  >= 0 ? _str(row[iCode]).toUpperCase() : "";
    var name  = iName  >= 0 ? _str(row[iName]) : "";
    var client = iClient >= 0 ? _str(row[iClient]) : "";
    var status = iStatus >= 0 ? _str(row[iStatus]) : "";
    var subAt = iSubAt >= 0 ? row[iSubAt] : "";
    var subDate = (subAt instanceof Date) ? subAt : (subAt ? new Date(subAt) : null);

    if (!email && !code) continue;
    if (email) byAgent[email] = (byAgent[email] || 0) + 1;
    if (code)  byCode[code]   = (byCode[code]   || 0) + 1;
    byStatus[status || "(blank)"] = (byStatus[status || "(blank)"] || 0) + 1;
    if (subDate && !isNaN(subDate.getTime()) && (now - subDate) <= ms30) {
      if (email) byAgent30d[email] = (byAgent30d[email] || 0) + 1;
    }
    subs.push({
      submission_id: iSubId  >= 0 ? _str(row[iSubId]) : "",
      agent_email:   email,
      agent_code:    code,
      advisor_name:  name,
      client:        client,
      status:        status,
      submitted_at:  subDate && !isNaN(subDate.getTime()) ? subDate.toISOString().substring(0,10) : "",
      approved_at:   iAppAt >= 0 && row[iAppAt] ? String(row[iAppAt]).substring(0,10) : "",
      insurance_need: iNeed >= 0 ? _moneyToNum(row[iNeed]) : 0,
      total_need:    iTotNeed >= 0 ? _moneyToNum(row[iTotNeed]) : 0,
      product:       iProduct >= 0 ? _str(row[iProduct]) : "",
      decision:      iDecision >= 0 ? _str(row[iDecision]) : ""
    });
  }

  return {
    success: true,
    last_refreshed: new Date().toISOString().substring(0,10),
    sheet_id: FF_SHEET_ID,
    tab: FF_REVISED_TAB,
    total_rows: values.length - 1,
    total_submissions: subs.length,
    branch_total: subs.length,
    by_status: byStatus,
    by_agent: byAgent,
    by_agent_30d: byAgent30d,
    by_agent_code: byCode,
    submissions: subs
  };
}

// ── Reviewer insights — agent stats for the review panel ─────
// Called from frontend with ?action=ff_insights&code=A12001
// Returns a flat object the panel renders into tiles.
function getFFInsights(params) {
  var code = String((params && params.code) || "").toUpperCase().trim();
  if (!/^A\d{4,6}$/.test(code)) return { success: false, error: "Invalid agent code" };

  var year = new Date().getFullYear();
  var now = new Date();
  var ms30 = 30 * 24 * 60 * 60 * 1000;

  // FF counts from ffRevised + legacy combined
  var ffYear = 0, ff30d = 0, lastSubmissionDate = "";
  try {
    var revised = getFactFindsRevised();
    (revised.submissions || []).forEach(function(s){
      if (s.agent_code === code || (s.agent_email && code === code)) {
        var d = s.submitted_at ? new Date(s.submitted_at) : null;
        if (d && d.getFullYear() === year) ffYear++;
        if (d && (now - d) <= ms30) ff30d++;
        if (d && (!lastSubmissionDate || s.submitted_at > lastSubmissionDate)) lastSubmissionDate = s.submitted_at;
      }
    });
  } catch (e) {}

  // Legacy FF count (JotForm) — match by email lookup since legacy doesn't have agent_code
  try {
    var roster = ffLoadRoster_();
    var agentEmail = (roster[code] && roster[code].email || "").toLowerCase();
    if (agentEmail) {
      var legacy = getFactFinds({});
      ffYear += legacy.by_agent[agentEmail] || 0;
      ff30d  += legacy.by_agent_30d[agentEmail] || 0;
    }
  } catch (e) {}

  // Lapse stats
  var lapseCount = 0, earlyLapses = 0;
  try {
    var lapses = getLapses();
    Object.keys(lapses.agents || {}).forEach(function(k){
      var a = lapses.agents[k];
      if (a.agent_code === code) {
        lapseCount += a.count || 0;
        earlyLapses += (a.by_band && a.by_band["<1yr"]) || 0;
      }
    });
  } catch (e) {}

  // Compliance flag — based on FF activity + lapse rate
  var flag = "OK", note = "";
  if (ffYear === 0) {
    flag = "CRITICAL"; note = "No FF submissions this year";
  } else if (earlyLapses >= 3) {
    flag = "FOLLOW-UP"; note = earlyLapses + " early lapses (<1yr)";
  } else if (lapseCount > 10) {
    flag = "FOLLOW-UP"; note = "High lapse volume";
  }

  return {
    success: true,
    agent_code: code,
    agent_name: (ffLoadRoster_()[code] || {}).name || "",
    ff_year: ffYear,
    ff_30d: ff30d,
    last_submission: lastSubmissionDate,
    lapses: lapseCount,
    early_lapses: earlyLapses,
    compliance_flag: flag,
    compliance_note: note
  };
}

// ── Dev tests ──────────────────────────────────────────────────
function _ffTestAgentSubmit() {
  var fakeReq = { postData: { contents: JSON.stringify({
    stage: "agent_submit",
    submissionId: "test-" + Date.now(),
    clientName: "Test Client",
    agentCode: "A12001",
    reviewerKey: "akaash",
    appType: "full",
    monthlyIncomeTotal: 18500,
    finalDecide: "proceed",
    insuranceNeed_calc: 1500000
  }) } };
  Logger.log(doPost(fakeReq).getContent());
}
function _ffTestManagerReview() {
  var SUBMISSION_ID = "PASTE_HERE";  // copy from ffRevised tab after running _ffTestAgentSubmit
  var fakeReq = { postData: { contents: JSON.stringify({
    stage: "manager_review",
    submissionId: SUBMISSION_ID,
    mgrAgree: "agree",
    mgrComments: "Approved as recommended",
    mgrSigDate: new Date().toISOString().slice(0, 10)
  }) } };
  Logger.log(doPost(fakeReq).getContent());
}
function _ffShowRoster() {
  var r = ffLoadRoster_();
  Logger.log(Object.keys(r).length + " active agents in roster");
  Object.keys(r).sort().forEach(function(c){ Logger.log(c + "  " + r[c].name + "  " + r[c].email + "  unit=" + r[c].unit); });
}

// ════════════════════════════════════════════════════════════════
//                   F F   V 2   ROUTING  ── end
// ════════════════════════════════════════════════════════════════

// ════════════════════════════════════════════════════════════════
//          O R I G I N A L   D A S H B O A R D   C O D E
//          (preserved verbatim from prior Code.gs)
// ════════════════════════════════════════════════════════════════

// ────────────────────────────────────────────────────────────────
// HELPERS
// ────────────────────────────────────────────────────────────────
function _moneyToNum(v) {
  if (v === null || v === undefined || v === "") return 0;
  if (typeof v === "number") return v;
  var s = String(v).replace(/[$,\s]/g, "").replace(/^\((.*)\)$/, "-$1");
  var n = parseFloat(s);
  return isNaN(n) ? 0 : n;
}
function _str(v) { return v === null || v === undefined ? "" : String(v).trim(); }
function _int(v) { var n = parseInt(v, 10); return isNaN(n) ? 0 : n; }
function _firstSheet(id) {
  var ss = SpreadsheetApp.openById(id);
  return ss.getSheets()[0];
}

// ────────────────────────────────────────────────────────────────
// DIAGNOSTIC
// ────────────────────────────────────────────────────────────────
function diagnoseTabs() {
  var ss = SpreadsheetApp.openById(PENDING_SHEET_ID);
  var allSheets = ss.getSheets();
  var report = [];
  for (var i = 0; i < allSheets.length; i++) {
    var sheet = allSheets[i];
    var tabName = sheet.getName();
    var lastCol = sheet.getLastColumn() || 1;
    var lastRow = sheet.getLastRow() || 0;
    var hdr = lastRow > 0 ? sheet.getRange(1, 1, 1, lastCol).getValues()[0] : [];
    var detected = _identifyTab(hdr);
    report.push({
      index: i,
      tab_name: tabName,
      detected_as: detected,
      row_count: lastRow,
      col_count: lastCol,
      header_first_15: hdr.slice(0, 15).map(function(h){ return _str(h); })
    });
  }
  return {
    success: true,
    sheet_id: PENDING_SHEET_ID,
    tabs_found: allSheets.length,
    tabs: report
  };
}

// ────────────────────────────────────────────────────────────────
// TAB IDENTIFIER
// ────────────────────────────────────────────────────────────────
function _identifyTab(headerRow) {
  if (!headerRow || !headerRow.length) return "unknown";
  var hdr = headerRow.map(function(h){ return _str(h).toLowerCase(); });
  var hset = {};
  hdr.forEach(function(h){ hset[h] = true; });

  if ((hset["product density"] || hset["years_band"]) && hset["agt_id"] && hset["api"] && hset["year"]) {
    return "settled_pbi";
  }
  if ((hset["months_paid bands"] || hset["years_in_forcee"] || hset["years_in_force"]) &&
      hset["policy status"] && hset["pol_id"] && hset["serv_agt_id"]) {
    return "portfolio_pbi";
  }
  if (hset["effective_dt"] && hset["api_amt"] && hset["count"] && hset["agt_id"]) return "settled";
  if (hset["agentname&#"] || hset["agent #"] || (hset["agent type"] && hset["employment status"])) return "roster";
  if (hset["production picked up date"] && hset["total api"] && hset["app count"]) return "pickup";
  if (hset["api increase"] && (hset["policy increases name"] || hset["policy increases: insurance portfolio name"])) return "increases";
  if (hset["month opened"] && hset["agent"] && (hset["completed date/time"] || hset["completed month #"])) {
    return "premium_due_emails";
  }
  if (hset["agent"] && hset["premium"] && (hset["app received date"] || hset["status(2)"])) return "pending";
  return "unknown";
}

// ────────────────────────────────────────────────────────────────
// ACTION 1: POP7
// ────────────────────────────────────────────────────────────────
function getPop7() {
  var sh = _firstSheet(POP7_SHEET_ID);
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return { success: true, agents: {} };

  var COL = {
    PS: 0, PS_RATING: 1, PROB: 2,
    FIRST: 4, LAST: 6, AGENT_FULL: 8,
    DATE: 9, POP7_ID: 10,
    EP: 11, AP: 12, IP: 13,
    RATING: 18,
    PO: 22, IO: 23,
    SD: 25, LM: 26, CR: 27, LISTEN: 28, UC: 29,
    UNIT: 35, AGENT_CODE: 36
  };

  var agents = {};
  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var code = _str(row[COL.AGENT_CODE]);
    if (!code || code.length < 4) continue;

    var first = _str(row[COL.FIRST]);
    var last  = _str(row[COL.LAST]);
    var name  = (first + " " + last).trim();
    if (!name) {
      var full = _str(row[COL.AGENT_FULL]);
      var m = full.match(/^A\d+\s*-\s*(.+)$/);
      if (m) name = m[1].trim();
    }

    var dateRaw = row[COL.DATE];
    var dateStr = "";
    if (dateRaw instanceof Date) {
      dateStr = (dateRaw.getMonth()+1) + "/" + dateRaw.getDate() + "/" + dateRaw.getFullYear();
    } else {
      dateStr = _str(dateRaw);
    }

    agents[code] = {
      agent_code:    code,
      name:          name,
      pop7_id:       _str(row[COL.POP7_ID]),
      date:          dateStr,
      unit:          _str(row[COL.UNIT]),
      ps:            _int(row[COL.PS]),
      ps_rating:     _int(row[COL.PS_RATING]),
      prob_success:  _int(row[COL.PROB]),
      ep:            _int(row[COL.EP]),
      ap:            _int(row[COL.AP]),
      ip:            _int(row[COL.IP]),
      po:            _int(row[COL.PO]),
      io:            _int(row[COL.IO]),
      sd:            _int(row[COL.SD]),
      lm:            _int(row[COL.LM]),
      cr:            _int(row[COL.CR]),
      listen:        _int(row[COL.LISTEN]),
      uncertainty:   _int(row[COL.UC]),
      career_rating: _str(row[COL.RATING])
    };
  }

  return {
    success: true,
    count: Object.keys(agents).length,
    last_updated: new Date().toISOString().substring(0, 10),
    agents: agents
  };
}

// Alias
function getPendingLapses() { return getPortfolio(); }
// ────────────────────────────────────────────────────────────────
// ACTION 2: PRODUCTION (settled — legacy, raw SETTLED tab)
// ────────────────────────────────────────────────────────────────
function getProduction() {
  var ss = SpreadsheetApp.openById(PRODUCTION_SHEET_ID);
  var allSheets = ss.getSheets();
  var sh = null;
  for (var i = 0; i < allSheets.length; i++) {
    var firstRow = allSheets[i].getRange(1, 1, 1, allSheets[i].getLastColumn() || 1).getValues()[0];
    if (_identifyTab(firstRow) === "settled") { sh = allSheets[i]; break; }
  }
  if (!sh) {
    return { success: false, message: "Branch Settled Production tab not found in workbook " + PRODUCTION_SHEET_ID };
  }
  var values = sh.getDataRange().getValues();
  if (values.length < 2) return { success: true, agents: {}, units: {}, summary: {} };

  var COL = {
    EFF:0, BRANCH:1, AGT_ID:2, CSTAT:3, POL_ID:4, CVG_ID:5,
    PLAN:6, FACE:7, STATUS:8, RECV_DT:9, COUNT:10, API:11,
    YEAR:12, MONTH:13, CLI_ID:14, CLI_FIRST:15, CLI_LAST:16
  };

  var agents = {};
  var units = {};
  var monthly = {};
  var products = {};
  var branchByYear = {};
  var totalAPI = 0, totalApps = 0;

  var ROSTER_UNIT = {
    "A06869":"26002","A11238":"26002","A12001":"26002","A12397":"26002",
    "A12408":"26002","A13682":"26002",
    "A09281":"26003","A11801":"26003","A12173":"26003","A12530":"26003",
    "A13088":"26003","A13617":"26003","A13710":"26003",
    "A01363":"26001","A10338":"26001","A10934":"26001","A12749":"26001",
    "A13063":"26001","A13064":"26001"
  };
  var UNIT_DISPLAY = {
    "26000":"Branch Direct (Ricky)",
    "26001":"Kerwyn Ramroach (ABM)",
    "26002":"Akaash Kalladeen (UM)",
    "26003":"Gary Sookdeo (UM)"
  };
  var UNIT_MGR = {
    "26000":"Ricky Rampersad",
    "26001":"Kerwyn Ramroach",
    "26002":"Akaash Kalladeen",
    "26003":"Gary Sookdeo"
  };

  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var agtId = _str(row[COL.AGT_ID]).toUpperCase().trim();
    if (/^U\d{4,6}$/.test(agtId)) agtId = "A" + agtId.substring(1);
    if (!agtId || !/^A\d{4,6}$/.test(agtId)) continue;

    var api = _moneyToNum(row[COL.API]);
    var count = _int(row[COL.COUNT]);
    var face = _moneyToNum(row[COL.FACE]);
    var plan = _str(row[COL.PLAN]);
    var month = _int(row[COL.MONTH]);
    var rowYear = _int(row[COL.YEAR]) || 2026;
    var cliId = _str(row[COL.CLI_ID]);

    var unitCode = ROSTER_UNIT[agtId] || "26000";
    var unitDisplay = UNIT_DISPLAY[unitCode];
    var unitManager = UNIT_MGR[unitCode];

    if (!agents[agtId]) {
      agents[agtId] = {
        code: agtId, name: agtId, unit_manager: unitManager,
        primary_branch: unitCode, unit_name: unitDisplay,
        total_records: 0, total_api: 0, new_apps: 0, new_apps_api: 0, face: 0,
        clients: {}, plans: {}, by_year: {}, status: "Active"
      };
    }
    var ag = agents[agtId];
    ag.total_records++;
    ag.total_api += api;
    if (cliId) ag.clients[cliId] = true;

    if (!ag.by_year[rowYear]) ag.by_year[rowYear] = { total_api: 0, new_apps: 0, new_apps_api: 0, face: 0 };
    ag.by_year[rowYear].total_api += api;

    if (count === 1) {
      ag.new_apps++; ag.new_apps_api += api; ag.face += face; totalApps++;
      ag.by_year[rowYear].new_apps++;
      ag.by_year[rowYear].new_apps_api += api;
      ag.by_year[rowYear].face += face;
      if (plan) ag.plans[plan] = (ag.plans[plan] || 0) + 1;
      if (plan) {
        if (!products[plan]) products[plan] = { count: 0, api: 0 };
        products[plan].count++;
        products[plan].api += api;
      }
    }

    if (!units[unitCode]) {
      units[unitCode] = {
        code: unitCode, name: unitDisplay, manager: unitManager,
        total_records: 0, new_apps: 0, total_api: 0, new_apps_api: 0, face: 0, by_year: {}
      };
    }
    var u = units[unitCode];
    u.total_records++;
    u.total_api += api;
    if (!u.by_year[rowYear]) u.by_year[rowYear] = { total_api: 0, new_apps: 0, new_apps_api: 0, face: 0 };
    u.by_year[rowYear].total_api += api;
    if (count === 1) {
      u.new_apps++; u.new_apps_api += api; u.face += face;
      u.by_year[rowYear].new_apps++;
      u.by_year[rowYear].new_apps_api += api;
      u.by_year[rowYear].face += face;
    }

    if (rowYear && month && count === 1) {
      var key = rowYear + "-" + (month < 10 ? "0"+month : month);
      monthly[key] = (monthly[key] || 0) + api;
    }

    if (!branchByYear[rowYear]) branchByYear[rowYear] = { total_api: 0, new_apps: 0, new_apps_api: 0, face: 0 };
    branchByYear[rowYear].total_api += api;
    if (count === 1) {
      branchByYear[rowYear].new_apps++;
      branchByYear[rowYear].new_apps_api += api;
      branchByYear[rowYear].face += face;
    }
    totalAPI += api;
  }

  for (var ac in agents) {
    var a = agents[ac];
    a.clients = Object.keys(a.clients).length;
    var planArr = [];
    for (var p in a.plans) planArr.push([p, a.plans[p]]);
    planArr.sort(function(x,y){ return y[1] - x[1]; });
    a.top_plans = planArr.slice(0, 5);
    a.products = a.plans;
    a.product_density = Object.keys(a.plans).length;
    a.distinct_products = a.product_density;
    delete a.plans;
    a.csm_pct = a.total_api > 0 ? Math.round((a.new_apps_api / a.total_api) * 1000) / 10 : 0;
  }
  for (var uc in units) {
    var uu = units[uc];
    uu.csm_pct = uu.total_api > 0 ? Math.round((uu.new_apps_api / uu.total_api) * 1000) / 10 : 0;
  }

  for (var uc2 in units) {
    var u2 = units[uc2];
    u2.quota_reduced = Math.round((u2.total_api / Math.max(totalAPI, 1)) * BRANCH_QUOTA_2026);
    u2.quota_original = Math.round((u2.total_api / Math.max(totalAPI, 1)) * BRANCH_QUOTA_ORIG);
    var fy26ApiUnit = (u2.by_year && u2.by_year[2026] && u2.by_year[2026].total_api) || 0;
    u2.pct_to_quota = u2.quota_reduced > 0 ? Math.round((fy26ApiUnit / u2.quota_reduced) * 1000) / 10 : 0;
  }

  var newAppsAPI = 0;
  for (var ag1 in agents) newAppsAPI += agents[ag1].new_apps_api;
  var csmRichPct = totalAPI > 0 ? Math.round((newAppsAPI / totalAPI) * 1000) / 10 : 0;
  var bonusBand = (csmRichPct >= 75) ? {band:"75%+", points:6}
                : (csmRichPct >= 70) ? {band:"70-74%", points:5}
                : (csmRichPct >= 65) ? {band:"65-69%", points:4}
                : (csmRichPct >= 60) ? {band:"60-64%", points:2}
                : {band:"<60%", points:0};

  var fyEnd = new Date(FY_END);
  var today = new Date();
  var daysRemaining = Math.max(0, Math.floor((fyEnd - today) / (1000*60*60*24)));

  var fy26Api = (branchByYear[2026] && branchByYear[2026].total_api) || 0;
  var ytdPct = BRANCH_QUOTA_2026 > 0 ? Math.round((fy26Api / BRANCH_QUOTA_2026) * 1000) / 10 : 0;
  var qualGate = BRANCH_QUOTA_2026 * 0.8;

  var topProducts = [];
  for (var pp in products) topProducts.push({ plan: pp, count: products[pp].count, api: products[pp].api });
  topProducts.sort(function(x,y){ return y.api - x.api; });
  topProducts = topProducts.slice(0, 10);

  var monthlyArr = [];
  for (var mk in monthly) monthlyArr.push({ month: mk, api: monthly[mk] });
  monthlyArr.sort(function(x,y){ return x.month.localeCompare(y.month); });

  return {
    success: true,
    last_refreshed: new Date().toISOString().substring(0, 10),
    data_source: "live_sheet",
    summary: {
      total_records: values.length - 1,
      total_api: totalAPI,
      new_apps: totalApps,
      new_apps_api: newAppsAPI,
      csm_rich_pct: csmRichPct,
      csm_rich_count: totalApps,
      bonus_band: bonusBand
    },
    quota: {
      original: BRANCH_QUOTA_ORIG,
      reduced: BRANCH_QUOTA_2026,
      ytd_api: fy26Api,
      ytd_pct: ytdPct,
      qualification_gate: qualGate,
      gap_to_gate: Math.max(0, qualGate - fy26Api),
      days_remaining: daysRemaining,
      year_end: FY_END
    },
    by_year: branchByYear,
    years_available: Object.keys(branchByYear).map(function(y){ return parseInt(y, 10); }).sort(function(a,b){ return b-a; }),
    units: units,
    agents: agents,
    monthly: monthlyArr,
    top_products: topProducts
  };
}
// ════════════════════════════════════════════════════════════════
// ACTION: getSettledPBI()
// ════════════════════════════════════════════════════════════════
function getSettledPBI(params) {
  var year_filter = params && params.year ? _int(params.year) : null;

  var ss = SpreadsheetApp.openById(PENDING_SHEET_ID);
  var allSheets = ss.getSheets();
  var sh = null;
  for (var i = 0; i < allSheets.length; i++) {
    var firstRow = allSheets[i].getRange(1, 1, 1, allSheets[i].getLastColumn()).getValues()[0];
    if (_identifyTab(firstRow) === "settled_pbi") { sh = allSheets[i]; break; }
  }
  if (!sh) return { success: false, message: "SETTLEDPBI tab not found" };

  var values = sh.getDataRange().getValues();
  if (values.length < 2) return { success: false, message: "SETTLEDPBI tab is empty" };

  var hdr = values[0].map(function(h){ return _str(h).toLowerCase(); });
  var COL = {
    YEAR: hdr.indexOf("year"),
    HIER: hdr.indexOf("hierachy"),
    UNIT: hdr.indexOf("units"),
    FNAME: hdr.indexOf("first name"),
    YBAND: hdr.indexOf("years_band"),
    AGT_ID: hdr.indexOf("agt_id"),
    AGENT_NUM: hdr.indexOf("agent #"),
    PSRT: hdr.indexOf("agnt_psrt_rate_id"),
    POL_ID: hdr.indexOf("pol_id"),
    PLAN: hdr.indexOf("plan_id_base"),
    MONTH: hdr.indexOf("month"),
    A: hdr.indexOf("a"),
    API: hdr.indexOf("api"),
    EFF_MONTH: hdr.indexOf("effectivedate_clean - month"),
    FACE: hdr.indexOf("face_amt"),
    PRODUCT: hdr.indexOf("product density")
  };

  var branch_api = 0, branch_apps = 0;
  var byYearBranch = {}, byProductBranch = {}, units = {}, agents = {}, monthly = {};

  var UNIT_NAMES = {
    "26000": "Branch Direct (Ricky)",
    "26001": "Kerwyn Ramroach (ABM)",
    "26002": "Akaash Kalladeen (UM)",
    "26003": "Gary Sookdeo (UM)"
  };
  Object.keys(UNIT_NAMES).forEach(function(uc){
    units[uc] = { code: uc, name: UNIT_NAMES[uc], settled_api: 0, settled_apps: 0,
                  by_year: {}, by_product: {}, agent_count: 0 };
  });

  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var year = _int(row[COL.YEAR]);
    if (year_filter && year !== year_filter) continue;

    var agtId = _str(row[COL.AGT_ID]).toUpperCase().trim();
    if (/^U\d{4,6}$/.test(agtId)) agtId = "A" + agtId.substring(1);
    if (!agtId || !/^A\d{4,6}$/.test(agtId)) continue;

    var psrt = _str(row[COL.PSRT]).toUpperCase().trim();
    if (/^U\d{4,6}$/.test(psrt)) psrt = "A" + psrt.substring(1);

    var api = _moneyToNum(row[COL.API]);
    var apps = _int(row[COL.A]);
    var monthLabel = _str(row[COL.EFF_MONTH]);
    var product = _str(row[COL.PRODUCT]) || "Other";
    var unit = _str(row[COL.UNIT]);
    var fname = _str(row[COL.FNAME]);
    var yband = _str(row[COL.YBAND]);
    var hier = _str(row[COL.HIER]);

    branch_api += api;
    branch_apps += apps;
    if (!byYearBranch[year]) byYearBranch[year] = { api: 0, apps: 0 };
    byYearBranch[year].api += api;
    byYearBranch[year].apps += apps;
    if (!byProductBranch[product]) byProductBranch[product] = { api: 0, apps: 0 };
    byProductBranch[product].api += api;
    byProductBranch[product].apps += apps;

    var ucode = unit;
    if (unit.indexOf("Akaash") >= 0) ucode = "26002";
    else if (unit.indexOf("Kerwyn") >= 0) ucode = "26001";
    else if (unit.indexOf("Gary") >= 0) ucode = "26003";
    else if (unit.indexOf("Ricky") >= 0) ucode = "26000";
    if (units[ucode]) {
      units[ucode].settled_api += api;
      units[ucode].settled_apps += apps;
      if (!units[ucode].by_year[year]) units[ucode].by_year[year] = { api: 0, apps: 0 };
      units[ucode].by_year[year].api += api;
      units[ucode].by_year[year].apps += apps;
      if (!units[ucode].by_product[product]) units[ucode].by_product[product] = { api: 0, apps: 0 };
      units[ucode].by_product[product].api += api;
      units[ucode].by_product[product].apps += apps;
    }

    if (!agents[agtId]) {
      agents[agtId] = {
        code: agtId, name: fname, unit: unit,
        years_band: yband, hierarchy: hier,
        settled_api: 0, settled_apps: 0,
        by_year: {}, by_product: {}, by_month: {}
      };
    }
    var ag = agents[agtId];
    ag.settled_api += api;
    ag.settled_apps += apps;
    if (!ag.by_year[year]) ag.by_year[year] = { api: 0, apps: 0 };
    ag.by_year[year].api += api;
    ag.by_year[year].apps += apps;
    if (!ag.by_product[product]) ag.by_product[product] = { api: 0, apps: 0 };
    ag.by_product[product].api += api;
    ag.by_product[product].apps += apps;

    if (monthLabel) {
      var monthMap = {january:1,february:2,march:3,april:4,may:5,june:6,
                      july:7,august:8,september:9,october:10,november:11,december:12};
      var mNum = monthMap[monthLabel.toLowerCase()];
      if (mNum) {
        var mKey = year + "-" + (mNum < 10 ? "0" + mNum : mNum);
        ag.by_month[mKey] = (ag.by_month[mKey] || 0) + api;
        if (!monthly[mKey]) monthly[mKey] = { api: 0, apps: 0 };
        monthly[mKey].api += api;
        monthly[mKey].apps += apps;
      }
    }
  }

  var monthlyArr = Object.keys(monthly).sort().map(function(k){
    return { month: k, api: monthly[k].api, apps: monthly[k].apps };
  });

  return {
    success: true,
    last_refreshed: new Date().toISOString().slice(0,10),
    source: "SETTLEDPBI tab",
    filter_year: year_filter,
    branch: { settled_api: branch_api, settled_apps: branch_apps,
              by_year: byYearBranch, by_product: byProductBranch },
    units: units,
    agents: agents,
    monthly: monthlyArr,
    products: byProductBranch
  };
}
// ════════════════════════════════════════════════════════════════
// ACTION: getBranchPortfolioPBI()
// ════════════════════════════════════════════════════════════════
function getBranchPortfolioPBI() {
  var ss = SpreadsheetApp.openById(PENDING_SHEET_ID);
  var allSheets = ss.getSheets();
  var sh = null;
  for (var i = 0; i < allSheets.length; i++) {
    var firstRow = allSheets[i].getRange(1, 1, 1, allSheets[i].getLastColumn()).getValues()[0];
    if (_identifyTab(firstRow) === "portfolio_pbi") { sh = allSheets[i]; break; }
  }
  if (!sh) return { success: false, message: "Branch Portfolio PBI tab not found" };

  var values = sh.getDataRange().getValues();
  if (values.length < 2) return { success: false, message: "Portfolio PBI is empty" };

  var hdr = values[0].map(function(h){ return _str(h).toLowerCase(); });
  var COL = {
    BAND: hdr.indexOf("months_paid bands"),
    AGENT: hdr.indexOf("agent"),
    DAYS_PREM_OS: hdr.indexOf("days_premium_outstanding"),
    DAYS_SCRIPT_OS: hdr.indexOf("days_policy_script_outstanding"),
    MO_PAID: hdr.indexOf("months_paid"),
    PLAN: hdr.indexOf("plan_id"),
    POL_ID: hdr.indexOf("pol_id"),
    YMP: hdr.indexOf("yearsmonthspaid"),
    YIF: hdr.indexOf("years_in_forcee") >= 0 ? hdr.indexOf("years_in_forcee") : hdr.indexOf("years_in_force"),
    WRIT_AGT: hdr.indexOf("writ_agt_id"),
    UNIT: hdr.indexOf("units"),
    STATUS: hdr.indexOf("policy status"),
    SUSP: hdr.indexOf("premium suspense"),
    SERV_AGT: hdr.indexOf("serv_agt_id"),
    SERV_BR: hdr.indexOf("serv_br_id"),
    FACE: hdr.indexOf("cvg_face_amt"),
    FE_PREM: hdr.indexOf("cvg_fe_prem_amt"),
    APP_RECV: hdr.indexOf("pol_app_recv_dt"),
    BILL_MODE: hdr.indexOf("pol_bill_mode_cd"),
    DISP_DT: hdr.indexOf("pol_disp_dt")
  };

  var policyMap = {}, bands = {}, agents = {};
  var units = {
    "26000": { code: "26000", name: "Branch Direct (Ricky)", total:0, lapsed:0, in_force:0, suspense:0, policies:0 },
    "26001": { code: "26001", name: "Kerwyn Ramroach (ABM)", total:0, lapsed:0, in_force:0, suspense:0, policies:0 },
    "26002": { code: "26002", name: "Akaash Kalladeen (UM)", total:0, lapsed:0, in_force:0, suspense:0, policies:0 },
    "26003": { code: "26003", name: "Gary Sookdeo (UM)", total:0, lapsed:0, in_force:0, suspense:0, policies:0 }
  };

  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var pol_id = _str(row[COL.POL_ID]);
    if (!pol_id) continue;

    var band = _str(row[COL.BAND]) || "(Blank)";
    var agent = _str(row[COL.AGENT]);
    var status = _str(row[COL.STATUS]);
    var unit = _str(row[COL.UNIT]);
    var serv_agt = _str(row[COL.SERV_AGT]).toUpperCase().trim();
    if (/^U\d{4,6}$/.test(serv_agt)) serv_agt = "A" + serv_agt.substring(1);
    var writ_agt = _str(row[COL.WRIT_AGT]).toUpperCase().trim();
    if (/^U\d{4,6}$/.test(writ_agt)) writ_agt = "A" + writ_agt.substring(1);
    var serv_br = _str(row[COL.SERV_BR]);
    var face = _moneyToNum(row[COL.FACE]);
    var fe_prem = _moneyToNum(row[COL.FE_PREM]);
    var susp = _moneyToNum(row[COL.SUSP]);
    var days_prem_os = _int(row[COL.DAYS_PREM_OS]);
    var mo_paid = _int(row[COL.MO_PAID]);
    var ymp = _str(row[COL.YMP]);
    var yif = _str(row[COL.YIF]);
    var plan = _str(row[COL.PLAN]);
    var bill_mode = _str(row[COL.BILL_MODE]);
    var app_recv = _str(row[COL.APP_RECV]);
    var disp_dt = _str(row[COL.DISP_DT]);

    if (!policyMap[pol_id]) {
      policyMap[pol_id] = {
        pol_id: pol_id, agent: agent, status: status, unit: unit,
        band: band, serv_agt: serv_agt, writ_agt: writ_agt, serv_br: serv_br,
        face: 0, fe_prem: 0, suspense: susp,
        days_prem_os: days_prem_os, mo_paid: mo_paid, ymp: ymp, yif: yif,
        plan: plan, bill_mode: bill_mode, app_recv: app_recv, disp_dt: disp_dt,
        coverages: 0
      };
    }
    policyMap[pol_id].face += face;
    policyMap[pol_id].fe_prem += fe_prem;
    policyMap[pol_id].coverages += 1;
  }

  var summary = {
    total_policies: Object.keys(policyMap).length,
    lapsed: 0, in_force: 0, converted: 0, death: 0, reinstated: 0, rejected: 0,
    early_lapses_under_12mo: 0, suspense_total: 0, face_total: 0
  };

  Object.keys(policyMap).forEach(function(pid){
    var p = policyMap[pid];
    summary.face_total += p.face;
    summary.suspense_total += p.suspense;

    var statusLower = p.status.toLowerCase();
    if (statusLower.indexOf("lapsed") >= 0) summary.lapsed += 1;
    else if (statusLower.indexOf("in force") >= 0 || statusLower.indexOf("active") >= 0) summary.in_force += 1;
    else if (statusLower.indexOf("converted") >= 0) summary.converted += 1;
    else if (statusLower.indexOf("death") >= 0) summary.death += 1;
    else if (statusLower.indexOf("reinstated") >= 0) summary.reinstated += 1;
    else if (statusLower.indexOf("rejected") >= 0 || statusLower.indexOf("closed") >= 0) summary.rejected += 1;

    if (p.band.indexOf("0-Under 12 Months") >= 0 && statusLower.indexOf("lapsed") >= 0) {
      summary.early_lapses_under_12mo += 1;
    }

    if (!bands[p.band]) bands[p.band] = { count:0, lapsed:0, in_force:0, suspense:0, face:0 };
    bands[p.band].count += 1;
    bands[p.band].face += p.face;
    bands[p.band].suspense += p.suspense;
    if (statusLower.indexOf("lapsed") >= 0) bands[p.band].lapsed += 1;
    if (statusLower.indexOf("in force") >= 0) bands[p.band].in_force += 1;

    if (p.serv_agt && /^A\d{4,6}$/.test(p.serv_agt)) {
      if (!agents[p.serv_agt]) {
        agents[p.serv_agt] = {
          code: p.serv_agt, name: p.agent, unit: p.unit,
          total: 0, lapsed: 0, in_force: 0, converted: 0, death: 0,
          early_lapses: 0, suspense: 0, face: 0, policies: []
        };
      }
      var ag = agents[p.serv_agt];
      ag.total += 1;
      ag.face += p.face;
      ag.suspense += p.suspense;
      if (statusLower.indexOf("lapsed") >= 0) ag.lapsed += 1;
      if (statusLower.indexOf("in force") >= 0) ag.in_force += 1;
      if (statusLower.indexOf("converted") >= 0) ag.converted += 1;
      if (statusLower.indexOf("death") >= 0) ag.death += 1;
      if (p.band.indexOf("0-Under 12 Months") >= 0 && statusLower.indexOf("lapsed") >= 0) ag.early_lapses += 1;
      ag.policies.push(p);
    }

    if (units[p.serv_br]) {
      var u = units[p.serv_br];
      u.policies += 1;
      u.total += p.face;
      u.suspense += p.suspense;
      if (statusLower.indexOf("lapsed") >= 0) u.lapsed += 1;
      if (statusLower.indexOf("in force") >= 0) u.in_force += 1;
    }
  });

  return {
    success: true,
    last_refreshed: new Date().toISOString().slice(0,10),
    source: "Branch Portfolio PBI tab",
    summary: summary,
    bands: bands,
    agents: agents,
    units: units,
    policies: Object.keys(policyMap).map(function(k){ return policyMap[k]; })
  };
}
// ════════════════════════════════════════════════════════════════
// ACTION: getPortfolio() (pending/lapse/overdue/settled split)
// ════════════════════════════════════════════════════════════════
function getPortfolio() {
  var ss = SpreadsheetApp.openById(PENDING_SHEET_ID);
  var sheets = ss.getSheets();
  var pending = [], lapses = [], overdue = [], settled = [];

  var COL = {
    AGENT: 0, NUMBER: 1, CLIENT_NUM: 2, CLIENT: 3, PREMIUM: 4, ISSUE_DATE_RAW: 5,
    STATUS: 6, STATUS2: 7, DAYS: 8, INSURANCE_TYPE: 9, PAID_TO: 10, APP_RECV: 11,
    SUM_ASSURED: 12, PLAN_CODE: 13, BILLING: 14, MODE: 15, APL: 16,
    STATUS_DESC: 17, PROJECTED_LAPSE: 18, AMOUNT_BILLED: 19,
    ADDRESS: 20, PHONE: 21, EMAIL: 22,
    ISSUE_DATE_CLEAN: 23, API: 24, FYC: 25
  };

  for (var s = 0; s < sheets.length; s++) {
    var sheet = sheets[s];
    var values = sheet.getDataRange().getValues();
    if (values.length < 2) continue;
    var tabKind = _identifyTab(values[0]);
    if (tabKind !== "pending") continue;
    for (var r = 1; r < values.length; r++) {
      var row = values[r];
      var agent = _str(row[COL.AGENT]);
      if (!agent) continue;
      var status2 = _str(row[COL.STATUS2]).toLowerCase();
      var premium = _moneyToNum(row[COL.PREMIUM]);
      var days = _int(row[COL.DAYS]);
      var client = _str(row[COL.CLIENT]);
      var planCode = _str(row[COL.PLAN_CODE]);
      var statusDesc = _str(row[COL.STATUS_DESC]);
      var sumAssured = _moneyToNum(row[COL.SUM_ASSURED]);
      var api = _moneyToNum(row[COL.API]);
      if (!api && premium) api = premium * 12;
      var fyc = _moneyToNum(row[COL.FYC]);
      if (!fyc && api) fyc = api * 0.40;

      var issueDateRaw = row[COL.ISSUE_DATE_CLEAN] || row[COL.ISSUE_DATE_RAW];
      var issueDate = null;
      if (issueDateRaw instanceof Date) issueDate = issueDateRaw;
      else if (issueDateRaw && String(issueDateRaw).match(/\d{4}/)) {
        var parsed = new Date(issueDateRaw);
        if (!isNaN(parsed.getTime())) issueDate = parsed;
      }

      var record = {
        agent: agent,
        number: _str(row[COL.NUMBER]),
        client_number: _str(row[COL.CLIENT_NUM]),
        client: client,
        premium: premium,
        issue_date: issueDate ? issueDate.toISOString().substring(0,10) : "",
        days: days,
        plan_code: planCode,
        status_desc: statusDesc,
        sum_assured: sumAssured,
        api: api,
        _fyc: fyc
      };

      if (status2 === "pending") {
        pending.push(record);
      } else if (status2 === "lapse" || status2 === "lapsed") {
        if (days > 0 && days <= 730) lapses.push(record);
      } else if (status2 === "overdue") {
        if (days > 0 && days <= 730) overdue.push(record);
      } else if (status2 === "settled") {
        settled.push(record);
      }
    }
  }

  return {
    success: true,
    last_refreshed: new Date().toISOString().substring(0, 10),
    cutoff_months: 24,
    pending_count: pending.length,
    lapses_count: lapses.length,
    overdue_count: overdue.length,
    settled_count: settled.length,
    pending: pending,
    lapses: lapses,
    overdue: overdue,
    settled: settled
  };
}
// ════════════════════════════════════════════════════════════════
// ACTION 5: PRODUCTION V2
// ════════════════════════════════════════════════════════════════
function getProductionV2() {
  var ss = SpreadsheetApp.openById(PENDING_SHEET_ID);
  var sheets = ss.getSheets();

  var COL = {
    AGENT: 0, NUMBER: 1, CLIENT_NUM: 2, CLIENT: 3, PREMIUM: 4, ISSUE_DATE_RAW: 5,
    STATUS: 6, STATUS2: 7, DAYS: 8, INSURANCE_TYPE: 9, PAID_TO: 10, APP_RECV: 11,
    SUM_ASSURED: 12, PLAN_CODE: 13, BILLING: 14, MODE: 15, APL: 16,
    STATUS_DESC: 17, PROJECTED_LAPSE: 18, AMOUNT_BILLED: 19,
    ADDRESS: 20, PHONE: 21, EMAIL: 22,
    ISSUE_DATE_CLEAN: 23, API: 24, FYC: 25
  };

  function categorize(statusDesc) {
    var s = (statusDesc || "").toString().toLowerCase().trim();
    if (s.indexOf("underwriting") === 0) return "pending";
    if (s === "awaiting settlement") return "pending";
    if (s === "premium paying") return "settled";
    if (s === "lapsed") return "lapsed";
    if (s === "not proceeded with" || s === "not taken") return "npw";
    if (s === "declined" || s.indexOf("rejected") === 0) return "declined";
    if (s === "file closed") return "closed";
    if (s === "expired") return "expired";
    if (s === "death" || s === "surrendered") return "death_surrender";
    if (s === "matured" || s === "vested annuity" || s === "paid up") return "matured";
    if (s === "converted") return "converted";
    if (s === "postponed") return "postponed";
    if (s === "waiver of prem") return "waiver";
    return "other";
  }

  var FY_START_DATE = new Date(2026, 0, 1);
  var FY_END_DATE = new Date(2026, 8, 30);
  var TODAY = new Date();
  var MTD_START = new Date(TODAY.getFullYear(), TODAY.getMonth(), 1);
  var WEEKS_BACK = 12;

  function weekKey(d) {
    if (!d || isNaN(d.getTime())) return null;
    var dt = new Date(d.getFullYear(), d.getMonth(), d.getDate());
    var day = dt.getDay();
    var diff = dt.getDate() - day + (day === 0 ? -6 : 1);
    var monday = new Date(dt.setDate(diff));
    return Utilities.formatDate(monday, "GMT", "yyyy-MM-dd");
  }

  var byAgent = {}, byStatus = {}, byCategory = {}, byWeek = {}, byMonth = {};
  var fyTotals = { count: 0, api: 0, fyc: 0, settled_api: 0, pending_api: 0 };
  var mtdTotals = { count: 0, api: 0, fyc: 0 };
  var DRILL_CAP = 200;
  var drillByCategory = {};

  for (var s = 0; s < sheets.length; s++) {
    var sheet = sheets[s];
    var values = sheet.getDataRange().getValues();
    if (values.length < 2) continue;
    var tabKind = _identifyTab(values[0]);
    if (tabKind !== "pending") continue;
    for (var r = 1; r < values.length; r++) {
      var row = values[r];
      var agent = _str(row[COL.AGENT]);
      if (!agent) continue;

      var premium = _moneyToNum(row[COL.PREMIUM]);
      var api = _moneyToNum(row[COL.API]);
      if (!api && premium) api = premium * 12;
      var fyc = _moneyToNum(row[COL.FYC]);
      if (!fyc && api) fyc = api * 0.40;

      var statusDesc = _str(row[COL.STATUS_DESC]);
      var category = categorize(statusDesc);

      var appRecvRaw = row[COL.APP_RECV];
      var appRecv = null;
      if (appRecvRaw instanceof Date) appRecv = appRecvRaw;
      else if (appRecvRaw && String(appRecvRaw).match(/\d{4}/)) {
        var p = new Date(appRecvRaw);
        if (!isNaN(p.getTime())) appRecv = p;
      }

      if (!appRecv && !statusDesc) continue;

      var inFY = appRecv && appRecv >= FY_START_DATE && appRecv <= FY_END_DATE;
      var inMTD = appRecv && appRecv >= MTD_START && appRecv <= TODAY;

      if (!byAgent[agent]) {
        byAgent[agent] = {
          agent: agent, fy_count: 0, fy_api: 0, fy_fyc: 0,
          mtd_count: 0, mtd_api: 0, settled_api: 0, pending_api: 0,
          by_status: {}, by_category: {}
        };
      }
      var a = byAgent[agent];

      if (!byStatus[statusDesc || "(blank)"]) {
        byStatus[statusDesc || "(blank)"] = { count: 0, api: 0, fyc: 0, category: category };
      }
      byStatus[statusDesc || "(blank)"].count++;
      byStatus[statusDesc || "(blank)"].api += api;
      byStatus[statusDesc || "(blank)"].fyc += fyc;

      if (!byCategory[category]) byCategory[category] = { count: 0, api: 0, fyc: 0 };
      byCategory[category].count++;
      byCategory[category].api += api;
      byCategory[category].fyc += fyc;

      if (!a.by_status[statusDesc || "(blank)"]) a.by_status[statusDesc || "(blank)"] = { count: 0, api: 0 };
      a.by_status[statusDesc || "(blank)"].count++;
      a.by_status[statusDesc || "(blank)"].api += api;
      if (!a.by_category[category]) a.by_category[category] = { count: 0, api: 0 };
      a.by_category[category].count++;
      a.by_category[category].api += api;

      if (category === "settled") a.settled_api += api;
      if (category === "pending") a.pending_api += api;

      if (inFY) {
        a.fy_count++; a.fy_api += api; a.fy_fyc += fyc;
        fyTotals.count++; fyTotals.api += api; fyTotals.fyc += fyc;
        if (category === "settled") fyTotals.settled_api += api;
        if (category === "pending") fyTotals.pending_api += api;

        var wk = weekKey(appRecv);
        if (wk) {
          if (!byWeek[wk]) byWeek[wk] = { count: 0, api: 0, fyc: 0 };
          byWeek[wk].count++; byWeek[wk].api += api; byWeek[wk].fyc += fyc;
        }
        var mk = appRecv.getFullYear() + "-" + String(appRecv.getMonth()+1).padStart(2,"0");
        if (!byMonth[mk]) byMonth[mk] = { count: 0, api: 0, fyc: 0 };
        byMonth[mk].count++; byMonth[mk].api += api; byMonth[mk].fyc += fyc;
      }

      if (inMTD) {
        a.mtd_count++; a.mtd_api += api;
        mtdTotals.count++; mtdTotals.api += api; mtdTotals.fyc += fyc;
      }

      if (!drillByCategory[category]) drillByCategory[category] = [];
      if (drillByCategory[category].length < DRILL_CAP) {
        drillByCategory[category].push({
          agent: agent, policy: _str(row[COL.NUMBER]), client: _str(row[COL.CLIENT]),
          premium: premium, api: api, fyc: fyc, status_desc: statusDesc,
          app_received: appRecv ? Utilities.formatDate(appRecv, "GMT", "yyyy-MM-dd") : "",
          days: _int(row[COL.DAYS]), plan_code: _str(row[COL.PLAN_CODE]),
          sum_assured: _moneyToNum(row[COL.SUM_ASSURED])
        });
      }
    }
  }

  var weekKeys = Object.keys(byWeek).sort();
  if (weekKeys.length > WEEKS_BACK) weekKeys = weekKeys.slice(-WEEKS_BACK);
  var weeklySeries = weekKeys.map(function(k){
    return { week: k, count: byWeek[k].count, api: byWeek[k].api, fyc: byWeek[k].fyc };
  });

  var msInDay = 1000 * 60 * 60 * 24;
  var daysRemaining = Math.max(0, Math.ceil((FY_END_DATE - TODAY) / msInDay));

  return {
    success: true,
    last_refreshed: new Date().toISOString().substring(0, 10),
    fy_start: "2026-01-01",
    fy_end: "2026-09-30",
    days_remaining: daysRemaining,
    branch_quota_2026: BRANCH_QUOTA_2026,
    branch_quota_orig: BRANCH_QUOTA_ORIG,
    fy_totals: fyTotals,
    mtd_totals: mtdTotals,
    by_agent: byAgent,
    by_status: byStatus,
    by_category: byCategory,
    weekly: weeklySeries,
    monthly: byMonth,
    drilldowns: drillByCategory,
    pct_to_quota: BRANCH_QUOTA_2026 > 0 ? Math.round((fyTotals.settled_api / BRANCH_QUOTA_2026) * 1000) / 10 : 0
  };
}
// ════════════════════════════════════════════════════════════════
// ACTION 6: SUBMITTED YTD
// ════════════════════════════════════════════════════════════════
function getSubmitted() {
  var ss = SpreadsheetApp.openById(PENDING_SHEET_ID);
  var allSheets = ss.getSheets();

  var ROSTER_UNIT = {
    "A06869":"26002","A11238":"26002","A12001":"26002","A12397":"26002",
    "A12408":"26002","A13682":"26002",
    "A09281":"26003","A11801":"26003","A12173":"26003","A12530":"26003",
    "A13088":"26003","A13617":"26003","A13710":"26003",
    "A01363":"26001","A10338":"26001","A10934":"26001","A12749":"26001",
    "A13063":"26001","A13064":"26001"
  };

  var NAME_TO_CODE = {};
  var FIRSTNAME_TO_CODE = {};
  for (var t = 0; t < allSheets.length; t++) {
    var hdr = allSheets[t].getRange(1, 1, 1, allSheets[t].getLastColumn() || 1).getValues()[0];
    if (_identifyTab(hdr) !== "roster") continue;
    var rosterVals = allSheets[t].getDataRange().getValues();
    var nameCol = -1, codeCol = -1, firstCol = -1, lastCol = -1, statusCol = -1;
    for (var c = 0; c < rosterVals[0].length; c++) {
      var h = _str(rosterVals[0][c]).toLowerCase();
      if (h === "agent #") codeCol = c;
      if (h === "first name") firstCol = c;
      if (h === "last name") lastCol = c;
      if (h === "agentname&#") nameCol = c;
      if (h === "employment status") statusCol = c;
    }
    for (var rr = 1; rr < rosterVals.length; rr++) {
      var rrow = rosterVals[rr];
      var code = codeCol >= 0 ? _str(rrow[codeCol]).toUpperCase() : "";
      if (!/^A\d{4,6}$/.test(code)) continue;
      var emp = statusCol >= 0 ? _str(rrow[statusCol]).toLowerCase() : "";
      if (firstCol >= 0 && lastCol >= 0) {
        var firstName = _str(rrow[firstCol]).trim().toLowerCase();
        var lastName = _str(rrow[lastCol]).trim().toLowerCase();
        var fullName = (firstName + " " + lastName).trim();
        if (fullName) NAME_TO_CODE[fullName] = code;
        if (firstName && emp === "active" && !FIRSTNAME_TO_CODE[firstName]) {
          FIRSTNAME_TO_CODE[firstName] = code;
        }
      }
      if (nameCol >= 0) {
        var combo = _str(rrow[nameCol]);
        var m = combo.match(/^A\d+\s*-\s*(.+)$/);
        if (m) NAME_TO_CODE[m[1].trim().toLowerCase()] = code;
      }
    }
  }
  NAME_TO_CODE["ricky rampersad"] = "A00427";
  NAME_TO_CODE["meera persad-khan"] = "A08413";
  NAME_TO_CODE["meera persad khan"] = "A08413";
  NAME_TO_CODE["joy sammah"] = "A07347";
  NAME_TO_CODE["joy barbara sammah"] = "A07347";
  NAME_TO_CODE["narissa (agent) mohammed"] = "A01066";
  NAME_TO_CODE["jamil sean khan"] = "A12663";
  NAME_TO_CODE["jamil khan"] = "A12663";
  FIRSTNAME_TO_CODE["meera"] = "A08413";
  FIRSTNAME_TO_CODE["narissa"] = "A01066";
  FIRSTNAME_TO_CODE["joy"] = "A07347";
  FIRSTNAME_TO_CODE["joy barbara"] = "A07347";
  FIRSTNAME_TO_CODE["javid"] = "A04020";
  FIRSTNAME_TO_CODE["aleema"] = "A04028";
  FIRSTNAME_TO_CODE["faizal"] = "A07350";
  FIRSTNAME_TO_CODE["finbar"] = "A01097";
  FIRSTNAME_TO_CODE["ricky"] = "A00427";

  var FY_START_DATE = new Date(2026, 0, 1);
  var FY_END_DATE = new Date(2026, 8, 30, 23, 59, 59);

  var byAgent = {};
  var byUnit = { "26000":{api:0,apps:0,new_api:0,new_apps:0,inc_api:0,inc_apps:0},
                 "26001":{api:0,apps:0,new_api:0,new_apps:0,inc_api:0,inc_apps:0},
                 "26002":{api:0,apps:0,new_api:0,new_apps:0,inc_api:0,inc_apps:0},
                 "26003":{api:0,apps:0,new_api:0,new_apps:0,inc_api:0,inc_apps:0} };
  var totalAPI = 0, totalApps = 0;
  var totalNewAPI = 0, totalNewApps = 0;
  var totalIncAPI = 0, totalIncApps = 0;
  var byMonth = {};

  function ensureAgent(code, name, unit) {
    var key = code || name;
    if (!byAgent[key]) {
      byAgent[key] = {
        agent_code: code || "", agent_name: name, unit: unit || "26000",
        submitted_api: 0, submitted_apps: 0,
        new_api: 0, new_apps: 0, inc_api: 0, inc_apps: 0,
        by_month: {}, by_month_new: {}, by_month_inc: {}
      };
    }
    return byAgent[key];
  }

  function ensureMonth(monthKey) {
    if (!byMonth[monthKey]) {
      byMonth[monthKey] = { api: 0, apps: 0, new_api: 0, new_apps: 0, inc_api: 0, inc_apps: 0 };
    }
    return byMonth[monthKey];
  }

  function parseDate(raw) {
    if (raw instanceof Date) return raw;
    if (raw && String(raw).match(/\d{4}/)) {
      var p = new Date(raw);
      if (!isNaN(p.getTime())) return p;
    }
    return null;
  }

  for (var s = 0; s < allSheets.length; s++) {
    var sheet = allSheets[s];
    var values = sheet.getDataRange().getValues();
    if (values.length < 2) continue;
    if (_identifyTab(values[0]) !== "pickup") continue;

    var P_COL = { PICKUP_DT: 0, RECV_DT: 1, AGENT_NAME: 2, UNIT: 3, MONTH: 4,
                  PREMIUMS: 5, APP_COUNT: 6, API: 7 };

    for (var r = 1; r < values.length; r++) {
      var row = values[r];
      var agentName = _str(row[P_COL.AGENT_NAME]);
      if (!agentName || agentName.toLowerCase() === "total") continue;

      var pickupDate = parseDate(row[P_COL.PICKUP_DT]);
      if (!pickupDate) continue;
      if (pickupDate < FY_START_DATE || pickupDate > FY_END_DATE) continue;

      var apiVal = _moneyToNum(row[P_COL.API]);
      var appCount = _int(row[P_COL.APP_COUNT]);
      if (!apiVal && !appCount) continue;

      var nameKey = agentName.toLowerCase().replace(/\s+/g, " ").trim();
      var agentCode = NAME_TO_CODE[nameKey] || "";
      var unitCode = agentCode ? (ROSTER_UNIT[agentCode] || "26000") : "26000";

      var ag = ensureAgent(agentCode, agentName, unitCode);
      ag.new_api += apiVal;
      ag.new_apps += appCount;
      ag.submitted_api += apiVal;
      ag.submitted_apps += appCount;

      var month = pickupDate.getMonth() + 1;
      var monthKey = "2026-" + (month < 10 ? "0"+month : month);
      ag.by_month[monthKey] = (ag.by_month[monthKey] || 0) + apiVal;
      ag.by_month_new[monthKey] = (ag.by_month_new[monthKey] || 0) + apiVal;

      var u = byUnit[unitCode];
      if (u) { u.api += apiVal; u.apps += appCount; u.new_api += apiVal; u.new_apps += appCount; }

      var mb = ensureMonth(monthKey);
      mb.api += apiVal; mb.apps += appCount;
      mb.new_api += apiVal; mb.new_apps += appCount;

      totalAPI += apiVal; totalApps += appCount;
      totalNewAPI += apiVal; totalNewApps += appCount;
    }
  }

  for (var s2 = 0; s2 < allSheets.length; s2++) {
    var isheet = allSheets[s2];
    var ivalues = isheet.getDataRange().getValues();
    if (ivalues.length < 2) continue;
    if (_identifyTab(ivalues[0]) !== "increases") continue;

    var I_COL = { UNIT: 0, AGENT_FIRST: 1, RECORD_TYPE: 2, CLIENT_PORTFOLIO: 3,
                  INCREASE_NAME: 4, INSURED: 5, POLICY_STATUS: 6, POLICY_NUM: 7,
                  LAST_ACTIVITY: 8, APP_COUNT: 9, API_INCREASE: 10 };

    for (var ir = 1; ir < ivalues.length; ir++) {
      var irow = ivalues[ir];
      var agentFirst = _str(irow[I_COL.AGENT_FIRST]);
      if (!agentFirst || agentFirst.toLowerCase() === "total") continue;

      var apiInc = _moneyToNum(irow[I_COL.API_INCREASE]);
      var appCount = _int(irow[I_COL.APP_COUNT]);
      if (!apiInc) continue;

      var actDate = parseDate(irow[I_COL.LAST_ACTIVITY]);
      var monthKey;
      if (actDate) {
        if (actDate < FY_START_DATE || actDate > FY_END_DATE) continue;
        var month = actDate.getMonth() + 1;
        monthKey = "2026-" + (month < 10 ? "0"+month : month);
      } else {
        monthKey = "2026-XX";
      }

      var firstKey = agentFirst.toLowerCase().trim();
      var agentCode = FIRSTNAME_TO_CODE[firstKey] || "";
      var unitFromTab = _str(irow[I_COL.UNIT]);
      var unitCode = "26000";
      if (agentCode && ROSTER_UNIT[agentCode]) {
        unitCode = ROSTER_UNIT[agentCode];
      } else if (unitFromTab.indexOf("Akaash") >= 0) unitCode = "26002";
      else if (unitFromTab.indexOf("Gary") >= 0) unitCode = "26003";
      else if (unitFromTab.indexOf("Kerwyn") >= 0) unitCode = "26001";

      var ag = ensureAgent(agentCode, agentFirst, unitCode);
      ag.inc_api += apiInc;
      ag.inc_apps += appCount;
      ag.submitted_api += apiInc;
      ag.submitted_apps += appCount;

      if (monthKey !== "2026-XX") {
        ag.by_month[monthKey] = (ag.by_month[monthKey] || 0) + apiInc;
        ag.by_month_inc[monthKey] = (ag.by_month_inc[monthKey] || 0) + apiInc;
        var mb2 = ensureMonth(monthKey);
        mb2.api += apiInc; mb2.apps += appCount;
        mb2.inc_api += apiInc; mb2.inc_apps += appCount;
      }

      var u2 = byUnit[unitCode];
      if (u2) { u2.api += apiInc; u2.apps += appCount; u2.inc_api += apiInc; u2.inc_apps += appCount; }

      totalAPI += apiInc; totalApps += appCount;
      totalIncAPI += apiInc; totalIncApps += appCount;
    }
  }

  return {
    success: true,
    last_refreshed: new Date().toISOString().substring(0, 10),
    fy_start: "2026-01-01",
    fy_end: "2026-09-30",
    rules: {
      sources: ["Branch Production Pick Up Date This Year", "Increases Picked Up This Year"],
      new_business: { api_col: "H (Total API)", apps_col: "G (App Count)", date_col: "A (Production Picked up Date)" },
      increases: { api_col: "K (API Increase)", apps_col: "J (App Count)", date_col: "I (Last Activity Date)" }
    },
    branch: { submitted_api: totalAPI, submitted_apps: totalApps,
              new_api: totalNewAPI, new_apps: totalNewApps,
              inc_api: totalIncAPI, inc_apps: totalIncApps },
    units: byUnit,
    agents: byAgent,
    monthly: byMonth
  };
}
// ════════════════════════════════════════════════════════════════
// ACTION 4: FACT FINDS — LEGACY (reads JotForm responses tab)
// Kept for dashboard back-compat. ffRevised data is via getFactFindsRevised().
// ════════════════════════════════════════════════════════════════
function getFactFinds(params) {
  params = params || {};

  var sh = _firstSheet(FF_SHEET_ID);
  var values = sh.getDataRange().getValues();
  if (values.length < 2) {
    return { success: true, by_agent: {}, by_agent_30d: {}, submissions: [], total_submissions: 0, last_refreshed: new Date().toISOString().substring(0,10) };
  }

  var COL = {
    DATE: 0, FIRST: 1, LAST: 2, AGENT: 3, AGENT_NUM: 4, UNIT: 5,
    FULL_NAME: 7, PHONE: 10
  };

  var byAgent = {}, byAgent30d = {}, byAgentByUnit = {};
  var submissions = [];
  var skipped = { tests: 0, no_agent: 0, no_client: 0 };

  var now = new Date();
  var ms30 = 30 * 24 * 60 * 60 * 1000;

  for (var r = 1; r < values.length; r++) {
    var row = values[r];
    var agentEmail = _str(row[COL.AGENT]).toLowerCase();
    if (!agentEmail || agentEmail.indexOf("@") < 0) { skipped.no_agent++; continue; }

    var fname = _str(row[COL.FIRST]).toLowerCase();
    var lname = _str(row[COL.LAST]).toLowerCase();
    var fullName = _str(row[COL.FULL_NAME]).toLowerCase();
    var phone = _str(row[COL.PHONE]);
    var unitMgr = _str(row[COL.UNIT]).toLowerCase();

    if (fname === "test" || fname === "" || fname === "hdhhd") { skipped.tests++; continue; }
    if (fname === "john" && lname === "doe") { skipped.tests++; continue; }
    if (fullName === "ricky rampersad" && agentEmail.indexOf("ricky") === 0) { skipped.tests++; continue; }
    if (phone.indexOf("111-1111") >= 0) { skipped.tests++; continue; }
    if (fname === "s" && lname === "s") { skipped.tests++; continue; }
    if (fname === "m" && lname === "m") { skipped.tests++; continue; }
    if (fname === "ddd" || fname === "dcdd" || fname === "kamla testing") { skipped.tests++; continue; }
    if (fname === "kamla testing" || fullName === "kamla testing") { skipped.tests++; continue; }
    if (fname === "james" && lname === "doe") { skipped.tests++; continue; }
    if (fname === "larry" && lname === "henry") { skipped.tests++; continue; }
    if (fname === "ddd" && lname === "dd") { skipped.tests++; continue; }
    if (fname === "dcdd" && lname === "dd") { skipped.tests++; continue; }

    var subDateRaw = row[COL.DATE];
    var subDate = null;
    if (subDateRaw instanceof Date) subDate = subDateRaw;
    else if (subDateRaw && String(subDateRaw).match(/\d{4}/)) {
      var parsed = new Date(subDateRaw);
      if (!isNaN(parsed.getTime())) subDate = parsed;
    }

    byAgent[agentEmail] = (byAgent[agentEmail] || 0) + 1;
    if (subDate && (now - subDate) <= ms30) {
      byAgent30d[agentEmail] = (byAgent30d[agentEmail] || 0) + 1;
    }
    if (unitMgr) {
      if (!byAgentByUnit[unitMgr]) byAgentByUnit[unitMgr] = {};
      byAgentByUnit[unitMgr][agentEmail] = (byAgentByUnit[unitMgr][agentEmail] || 0) + 1;
    }

    submissions.push({
      agent_email: agentEmail,
      unit_manager: unitMgr,
      client: _str(row[COL.FULL_NAME]) || ((_str(row[COL.FIRST]) + " " + _str(row[COL.LAST])).trim()),
      first: _str(row[COL.FIRST]),
      last: _str(row[COL.LAST]),
      submission_date: subDate ? subDate.toISOString().substring(0, 10) : ""
    });
  }

  var branchTotal = 0, branchTotal30d = 0;
  Object.keys(byAgent).forEach(function(e){ branchTotal += byAgent[e]; });
  Object.keys(byAgent30d).forEach(function(e){ branchTotal30d += byAgent30d[e]; });

  return {
    success: true,
    last_refreshed: new Date().toISOString().substring(0, 10),
    sheet_id: FF_SHEET_ID,
    total_rows: values.length - 1,
    total_submissions: submissions.length,
    branch_total: branchTotal,
    branch_total_30d: branchTotal30d,
    skipped: skipped,
    by_agent: byAgent,
    by_agent_30d: byAgent30d,
    by_agent_by_unit: byAgentByUnit,
    submissions: submissions
  };
}
// ════════════════════════════════════════════════════════════════
// COACHING LOG
// ════════════════════════════════════════════════════════════════
function getCoachingLog(params) {
  params = params || {};
  var agentCode = (params.agent || "").toUpperCase().trim();
  try {
    var ss = SpreadsheetApp.openById(COACHING_LOG_SHEET_ID);
    var sh = ss.getSheets()[0];
    var values = sh.getDataRange().getValues();
    if (values.length < 2) return { success: true, entries: [], total: 0 };
    var headers = values[0].map(function(h){ return String(h).toLowerCase().trim(); });
    var idx = {
      timestamp: headers.indexOf("timestamp"),
      agent_code: headers.indexOf("agent code"),
      agent_name: headers.indexOf("agent name"),
      author: headers.indexOf("author"),
      author_role: headers.indexOf("author role"),
      type: headers.indexOf("type"),
      text: headers.indexOf("text"),
      response: headers.indexOf("response"),
      status: headers.indexOf("status")
    };

    var entries = [];
    for (var i = 1; i < values.length; i++) {
      var row = values[i];
      var ac = String(row[idx.agent_code] || "").toUpperCase().trim();
      if (agentCode && ac !== agentCode) continue;
      entries.push({
        timestamp: row[idx.timestamp] instanceof Date ? row[idx.timestamp].toISOString() : String(row[idx.timestamp]),
        agent_code: ac,
        agent_name: String(row[idx.agent_name] || ""),
        author: String(row[idx.author] || ""),
        author_role: String(row[idx.author_role] || ""),
        type: String(row[idx.type] || ""),
        text: String(row[idx.text] || ""),
        response: String(row[idx.response] || ""),
        status: String(row[idx.status] || "open")
      });
    }
    entries.sort(function(a,b){ return (b.timestamp || "").localeCompare(a.timestamp || ""); });
    return { success: true, entries: entries, total: entries.length };
  } catch (err) {
    return { success: false, message: "Coaching log error: " + (err.message || err), entries: [] };
  }
}

function postCoachingEntry(params) {
  params = params || {};
  try {
    var ss = SpreadsheetApp.openById(COACHING_LOG_SHEET_ID);
    var sh = ss.getSheets()[0];
    if (sh.getLastRow() === 0) {
      sh.appendRow(["Timestamp","Agent Code","Agent Name","Author","Author Role","Type","Text","Response","Status"]);
    }
    sh.appendRow([
      new Date(),
      String(params.agent_code || "").toUpperCase().trim(),
      String(params.agent_name || ""),
      String(params.author || ""),
      String(params.author_role || ""),
      String(params.type || "comment"),
      String(params.text || ""),
      String(params.response || ""),
      String(params.status || "open")
    ]);
    return { success: true, message: "Entry logged", timestamp: new Date().toISOString() };
  } catch (err) {
    return { success: false, message: "Post error: " + (err.message || err) };
  }
}
// ════════════════════════════════════════════════════════════════
// ACTION 7: LAPSES
// ════════════════════════════════════════════════════════════════
function getLapses() {
  var ss = SpreadsheetApp.openById(PENDING_SHEET_ID);
  var allSheets = ss.getSheets();

  var COL = {
    AGENT: 0, NUMBER: 1, CLIENT_NUM: 2, CLIENT: 3, PREMIUM: 4,
    ISSUE_DATE_RAW: 5, STATUS: 6, STATUS2: 7, DAYS: 8,
    INSURANCE_TYPE: 9, PAID_TO: 10, APP_RECV: 11,
    SUM_ASSURED: 12, PLAN_CODE: 13, BILLING: 14, MODE: 15, APL: 16,
    STATUS_DESC: 17, PROJECTED_LAPSE: 18, AMOUNT_BILLED: 19,
    ADDRESS: 20, PHONE: 21, EMAIL: 22,
    ISSUE_DATE_CLEAN: 23, API: 24, FYC: 25
  };

  var ROSTER_UNIT = {
    "A06869":"26002","A11238":"26002","A12001":"26002","A12397":"26002",
    "A12408":"26002","A13682":"26002",
    "A09281":"26003","A11801":"26003","A12173":"26003","A12530":"26003",
    "A13088":"26003","A13617":"26003","A13710":"26003",
    "A01363":"26001","A10338":"26001","A10934":"26001","A12749":"26001",
    "A13063":"26001","A13064":"26001"
  };
  var NAME_TO_CODE = {};
  for (var t = 0; t < allSheets.length; t++) {
    var hdr0 = allSheets[t].getRange(1, 1, 1, allSheets[t].getLastColumn() || 1).getValues()[0];
    if (_identifyTab(hdr0) !== "roster") continue;
    var rv = allSheets[t].getDataRange().getValues();
    var codeCol = -1, firstCol = -1, lastCol = -1;
    for (var c = 0; c < rv[0].length; c++) {
      var hh = _str(rv[0][c]).toLowerCase();
      if (hh === "agent #") codeCol = c;
      if (hh === "first name") firstCol = c;
      if (hh === "last name") lastCol = c;
    }
    for (var rr = 1; rr < rv.length; rr++) {
      var rrow = rv[rr];
      var code = codeCol >= 0 ? _str(rrow[codeCol]).toUpperCase() : "";
      if (!/^A\d{4,6}$/.test(code)) continue;
      if (firstCol >= 0 && lastCol >= 0) {
        var fn = (_str(rrow[firstCol]) + " " + _str(rrow[lastCol])).trim().toLowerCase();
        if (fn) NAME_TO_CODE[fn] = code;
      }
    }
  }
  NAME_TO_CODE["ricky rampersad"] = "A00427";
  NAME_TO_CODE["meera persad-khan"] = "A08413";
  NAME_TO_CODE["meera persad khan"] = "A08413";

  function parseDate(raw) {
    if (raw instanceof Date) return raw;
    if (raw && String(raw).match(/\d{4}/)) {
      var p = new Date(raw);
      if (!isNaN(p.getTime())) return p;
    }
    return null;
  }

  var lapses = [];
  var byAgent = {};
  var byUnit = { "26000":{count:0,api:0,premium:0}, "26001":{count:0,api:0,premium:0},
                 "26002":{count:0,api:0,premium:0}, "26003":{count:0,api:0,premium:0} };
  var byMonth = {}, byYear = {};
  var byBand = {
    "<1yr": {count:0, api:0}, "1-2yr": {count:0, api:0}, "2-3yr": {count:0, api:0},
    "3-5yr": {count:0, api:0}, "5+yr": {count:0, api:0}
  };
  var totalCount = 0, totalAPI = 0, totalPremium = 0;

  for (var s = 0; s < allSheets.length; s++) {
    var sheet = allSheets[s];
    var values = sheet.getDataRange().getValues();
    if (values.length < 2) continue;
    if (_identifyTab(values[0]) !== "pending") continue;

    for (var r = 1; r < values.length; r++) {
      var row = values[r];
      var statusDesc = _str(row[COL.STATUS_DESC]).toLowerCase();
      if (statusDesc !== "lapsed") continue;

      var agentName = _str(row[COL.AGENT]);
      if (!agentName) continue;

      var premium = _moneyToNum(row[COL.PREMIUM]);
      var api = _moneyToNum(row[COL.API]);
      if (!api && premium) api = premium * 12;
      var sumAssured = _moneyToNum(row[COL.SUM_ASSURED]);

      var issueDate = parseDate(row[COL.ISSUE_DATE_CLEAN]) || parseDate(row[COL.ISSUE_DATE_RAW]);
      var lapseDate = parseDate(row[COL.PROJECTED_LAPSE]);
      var paidToDate = parseDate(row[COL.PAID_TO]);

      var ageBand = "<1yr";
      if (issueDate && lapseDate) {
        var ageYears = (lapseDate - issueDate) / (1000 * 60 * 60 * 24 * 365.25);
        if (ageYears >= 5) ageBand = "5+yr";
        else if (ageYears >= 3) ageBand = "3-5yr";
        else if (ageYears >= 2) ageBand = "2-3yr";
        else if (ageYears >= 1) ageBand = "1-2yr";
      }

      var nameKey = agentName.toLowerCase();
      var agentCode = NAME_TO_CODE[nameKey] || "";
      var unitCode = agentCode ? (ROSTER_UNIT[agentCode] || "26000") : "26000";

      var rec = {
        agent: agentName, agent_code: agentCode, unit: unitCode,
        client: _str(row[COL.CLIENT]), policy_num: _str(row[COL.NUMBER]),
        plan_code: _str(row[COL.PLAN_CODE]), premium: premium, api: api, sum_assured: sumAssured,
        issue_date: issueDate ? issueDate.toISOString().substring(0,10) : "",
        projected_lapse: lapseDate ? lapseDate.toISOString().substring(0,10) : "",
        paid_to: paidToDate ? paidToDate.toISOString().substring(0,10) : "",
        days_since_lapse: lapseDate ? Math.floor((new Date() - lapseDate) / 86400000) : 0,
        age_band: ageBand
      };
      lapses.push(rec);

      var key = agentCode || agentName;
      if (!byAgent[key]) {
        byAgent[key] = { agent_code: agentCode, agent_name: agentName, unit: unitCode,
                         count:0, api:0, premium:0, by_year:{}, by_band:{} };
      }
      byAgent[key].count++;
      byAgent[key].api += api;
      byAgent[key].premium += premium;

      if (byUnit[unitCode]) {
        byUnit[unitCode].count++;
        byUnit[unitCode].api += api;
        byUnit[unitCode].premium += premium;
      }

      if (lapseDate) {
        var ly = lapseDate.getFullYear();
        var lm = lapseDate.getMonth() + 1;
        var mk = ly + "-" + (lm < 10 ? "0"+lm : lm);
        if (!byYear[ly]) byYear[ly] = { count:0, api:0, premium:0 };
        byYear[ly].count++; byYear[ly].api += api; byYear[ly].premium += premium;
        if (!byMonth[mk]) byMonth[mk] = { count:0, api:0, premium:0 };
        byMonth[mk].count++; byMonth[mk].api += api; byMonth[mk].premium += premium;
        if (!byAgent[key].by_year[ly]) byAgent[key].by_year[ly] = { count:0, api:0 };
        byAgent[key].by_year[ly].count++; byAgent[key].by_year[ly].api += api;
      }

      byBand[ageBand].count++;
      byBand[ageBand].api += api;
      byAgent[key].by_band[ageBand] = (byAgent[key].by_band[ageBand] || 0) + 1;

      totalCount++; totalAPI += api; totalPremium += premium;
    }
  }

  var leaderboard = Object.keys(byAgent).map(function(k){
    var a = byAgent[k];
    return {
      agent_code: a.agent_code, agent_name: a.agent_name, unit: a.unit,
      count: a.count, api: a.api, premium: a.premium,
      this_year: a.by_year[2026] ? a.by_year[2026].count : 0,
      last_year: a.by_year[2025] ? a.by_year[2025].count : 0
    };
  }).sort(function(a,b){ return b.count - a.count; });

  return {
    success: true,
    last_refreshed: new Date().toISOString().substring(0,10),
    branch: { count: totalCount, api: totalAPI, premium: totalPremium },
    units: byUnit,
    by_year: byYear,
    by_month: byMonth,
    by_band: byBand,
    leaderboard: leaderboard,
    agents: byAgent,
    lapses_sample: lapses.slice(0, 500)
  };
}
// ════════════════════════════════════════════════════════════════
// ACTION 8: OVERDUES
// ════════════════════════════════════════════════════════════════
function getOverdues() {
  var ss = SpreadsheetApp.openById(PENDING_SHEET_ID);
  var allSheets = ss.getSheets();

  var COL = {
    AGENT:0, NUMBER:1, CLIENT_NUM:2, CLIENT:3, PREMIUM:4,
    ISSUE_DATE_RAW:5, STATUS:6, STATUS2:7, DAYS:8,
    INSURANCE_TYPE:9, PAID_TO:10, APP_RECV:11,
    SUM_ASSURED:12, PLAN_CODE:13, BILLING:14, MODE:15, APL:16,
    STATUS_DESC:17, PROJECTED_LAPSE:18, AMOUNT_BILLED:19,
    ADDRESS:20, PHONE:21, EMAIL:22,
    ISSUE_DATE_CLEAN:23, API:24, FYC:25
  };

  var ROSTER_UNIT = {
    "A06869":"26002","A11238":"26002","A12001":"26002","A12397":"26002",
    "A12408":"26002","A13682":"26002",
    "A09281":"26003","A11801":"26003","A12173":"26003","A12530":"26003",
    "A13088":"26003","A13617":"26003","A13710":"26003",
    "A01363":"26001","A10338":"26001","A10934":"26001","A12749":"26001",
    "A13063":"26001","A13064":"26001"
  };
  var NAME_TO_CODE = {};
  for (var t = 0; t < allSheets.length; t++) {
    var hdr0 = allSheets[t].getRange(1, 1, 1, allSheets[t].getLastColumn() || 1).getValues()[0];
    if (_identifyTab(hdr0) !== "roster") continue;
    var rv = allSheets[t].getDataRange().getValues();
    var codeCol = -1, firstCol = -1, lastCol = -1;
    for (var c = 0; c < rv[0].length; c++) {
      var hh = _str(rv[0][c]).toLowerCase();
      if (hh === "agent #") codeCol = c;
      if (hh === "first name") firstCol = c;
      if (hh === "last name") lastCol = c;
    }
    for (var rr = 1; rr < rv.length; rr++) {
      var rrow = rv[rr];
      var code = codeCol >= 0 ? _str(rrow[codeCol]).toUpperCase() : "";
      if (!/^A\d{4,6}$/.test(code)) continue;
      if (firstCol >= 0 && lastCol >= 0) {
        var fn = (_str(rrow[firstCol]) + " " + _str(rrow[lastCol])).trim().toLowerCase();
        if (fn) NAME_TO_CODE[fn] = code;
      }
    }
  }
  NAME_TO_CODE["ricky rampersad"] = "A00427";
  NAME_TO_CODE["meera persad-khan"] = "A08413";
  NAME_TO_CODE["meera persad khan"] = "A08413";

  function parseDate(raw) {
    if (raw instanceof Date) return raw;
    if (raw && String(raw).match(/\d{4}/)) {
      var p = new Date(raw);
      if (!isNaN(p.getTime())) return p;
    }
    return null;
  }

  function bucket(days) {
    if (days >= 90) return "90+";
    if (days >= 85) return "85-89";
    if (days >= 75) return "75-84";
    if (days >= 60) return "60-74";
    if (days >= 45) return "45-59";
    return "<45";
  }

  var TODAY = new Date();
  var overdues = [];
  var byAgent = {};
  var byUnit = { "26000":{count:0,api:0,premium:0}, "26001":{count:0,api:0,premium:0},
                 "26002":{count:0,api:0,premium:0}, "26003":{count:0,api:0,premium:0} };
  var byBucket = {
    "<45":{count:0,api:0,premium:0},
    "45-59":{count:0,api:0,premium:0},
    "60-74":{count:0,api:0,premium:0},
    "75-84":{count:0,api:0,premium:0},
    "85-89":{count:0,api:0,premium:0},
    "90+":{count:0,api:0,premium:0}
  };
  var byAgeBand = {
    "<1yr":{count:0,api:0}, "1-2yr":{count:0,api:0}, "2-3yr":{count:0,api:0},
    "3-5yr":{count:0,api:0}, "5+yr":{count:0,api:0}
  };
  var earlyOverdueCount = 0, earlyOverdueAPI = 0;
  var totalCount = 0, totalAPI = 0, totalPremium = 0;

  for (var s = 0; s < allSheets.length; s++) {
    var sheet = allSheets[s];
    var values = sheet.getDataRange().getValues();
    if (values.length < 2) continue;
    if (_identifyTab(values[0]) !== "pending") continue;

    for (var r = 1; r < values.length; r++) {
      var row = values[r];
      var status2 = _str(row[COL.STATUS2]).toLowerCase();
      if (status2 !== "overdue") continue;

      var agentName = _str(row[COL.AGENT]);
      if (!agentName) continue;

      var premium = _moneyToNum(row[COL.PREMIUM]);
      var api = _moneyToNum(row[COL.API]);
      if (!api && premium) api = premium * 12;
      var sumAssured = _moneyToNum(row[COL.SUM_ASSURED]);

      var issueDate = parseDate(row[COL.ISSUE_DATE_CLEAN]) || parseDate(row[COL.ISSUE_DATE_RAW]);
      var paidToDate = parseDate(row[COL.PAID_TO]);
      var daysOverdue = _int(row[COL.DAYS]);

      var ageBand = "<1yr";
      if (issueDate) {
        var ageYears = (TODAY - issueDate) / (1000 * 60 * 60 * 24 * 365.25);
        if (ageYears >= 5) ageBand = "5+yr";
        else if (ageYears >= 3) ageBand = "3-5yr";
        else if (ageYears >= 2) ageBand = "2-3yr";
        else if (ageYears >= 1) ageBand = "1-2yr";
      }

      var bk = bucket(daysOverdue);

      var nameKey = agentName.toLowerCase();
      var agentCode = NAME_TO_CODE[nameKey] || "";
      var unitCode = agentCode ? (ROSTER_UNIT[agentCode] || "26000") : "26000";

      var rec = {
        agent: agentName, agent_code: agentCode, unit: unitCode,
        client: _str(row[COL.CLIENT]), policy_num: _str(row[COL.NUMBER]),
        plan_code: _str(row[COL.PLAN_CODE]),
        premium: premium, api: api, sum_assured: sumAssured,
        issue_date: issueDate ? issueDate.toISOString().substring(0,10) : "",
        paid_to: paidToDate ? paidToDate.toISOString().substring(0,10) : "",
        days_overdue: daysOverdue, bucket: bk, age_band: ageBand,
        status_desc: _str(row[COL.STATUS_DESC])
      };
      overdues.push(rec);

      var key = agentCode || agentName;
      if (!byAgent[key]) {
        byAgent[key] = { agent_code: agentCode, agent_name: agentName, unit: unitCode,
                         count:0, api:0, premium:0, by_bucket:{}, by_age_band:{},
                         early_count:0, early_api:0 };
      }
      byAgent[key].count++;
      byAgent[key].api += api;
      byAgent[key].premium += premium;
      byAgent[key].by_bucket[bk] = (byAgent[key].by_bucket[bk] || 0) + 1;
      byAgent[key].by_age_band[ageBand] = (byAgent[key].by_age_band[ageBand] || 0) + 1;
      if (ageBand === "<1yr") {
        byAgent[key].early_count++;
        byAgent[key].early_api += api;
      }

      if (byUnit[unitCode]) {
        byUnit[unitCode].count++;
        byUnit[unitCode].api += api;
        byUnit[unitCode].premium += premium;
      }
      byBucket[bk].count++;
      byBucket[bk].api += api;
      byBucket[bk].premium += premium;
      byAgeBand[ageBand].count++;
      byAgeBand[ageBand].api += api;

      if (ageBand === "<1yr") {
        earlyOverdueCount++;
        earlyOverdueAPI += api;
      }

      totalCount++; totalAPI += api; totalPremium += premium;
    }
  }

  var leaderboard = Object.keys(byAgent).map(function(k){
    var a = byAgent[k];
    return {
      agent_code: a.agent_code, agent_name: a.agent_name, unit: a.unit,
      count: a.count, api: a.api, premium: a.premium,
      early_count: a.early_count, early_api: a.early_api,
      _90_plus: a.by_bucket["90+"] || 0,
      _85_89: a.by_bucket["85-89"] || 0,
      _75_84: a.by_bucket["75-84"] || 0,
      _60_74: a.by_bucket["60-74"] || 0,
      _45_59: a.by_bucket["45-59"] || 0
    };
  }).sort(function(a,b){ return b.count - a.count; });

  return {
    success: true,
    last_refreshed: new Date().toISOString().substring(0,10),
    branch: {
      count: totalCount, api: totalAPI, premium: totalPremium,
      early_count: earlyOverdueCount, early_api: earlyOverdueAPI,
      early_pct: totalCount > 0 ? Math.round((earlyOverdueCount/totalCount)*1000)/10 : 0
    },
    units: byUnit,
    by_bucket: byBucket,
    by_age_band: byAgeBand,
    leaderboard: leaderboard,
    agents: byAgent,
    overdues_sample: overdues.slice(0, 500)
  };
}
// ════════════════════════════════════════════════════════════════
// ACTION 9: PREMIUM DUE EMAILS — Sasha's workload
// ════════════════════════════════════════════════════════════════
function getPremiumDueEmails() {
  var ss = SpreadsheetApp.openById(PENDING_SHEET_ID);
  var allSheets = ss.getSheets();

  var emails = [];
  var byAgent = {};
  var byMonth = {};
  var byUnit = { "26000":0, "26001":0, "26002":0, "26003":0 };
  var totalEmails = 0;

  function parseDate(raw) {
    if (raw instanceof Date) return raw;
    if (raw && String(raw).match(/\d{4}/)) {
      var p = new Date(raw);
      if (!isNaN(p.getTime())) return p;
    }
    return null;
  }

  var ROSTER_UNIT = {
    "A06869":"26002","A11238":"26002","A12001":"26002","A12397":"26002",
    "A12408":"26002","A13682":"26002",
    "A09281":"26003","A11801":"26003","A12173":"26003","A12530":"26003",
    "A13088":"26003","A13617":"26003","A13710":"26003",
    "A01363":"26001","A10338":"26001","A10934":"26001","A12749":"26001",
    "A13063":"26001","A13064":"26001"
  };
  var NAME_TO_CODE = {};
  for (var tt = 0; tt < allSheets.length; tt++) {
    var hdr0 = allSheets[tt].getRange(1, 1, 1, allSheets[tt].getLastColumn() || 1).getValues()[0];
    if (_identifyTab(hdr0) !== "roster") continue;
    var rv = allSheets[tt].getDataRange().getValues();
    var codeCol = -1, firstCol = -1, lastCol = -1;
    for (var c = 0; c < rv[0].length; c++) {
      var hh = _str(rv[0][c]).toLowerCase();
      if (hh === "agent #") codeCol = c;
      if (hh === "first name") firstCol = c;
      if (hh === "last name") lastCol = c;
    }
    for (var rr = 1; rr < rv.length; rr++) {
      var rrow = rv[rr];
      var code = codeCol >= 0 ? _str(rrow[codeCol]).toUpperCase() : "";
      if (!/^A\d{4,6}$/.test(code)) continue;
      if (firstCol >= 0 && lastCol >= 0) {
        var fn = (_str(rrow[firstCol]) + " " + _str(rrow[lastCol])).trim().toLowerCase();
        if (fn) NAME_TO_CODE[fn] = code;
      }
    }
  }

  for (var s = 0; s < allSheets.length; s++) {
    var sheet = allSheets[s];
    var values = sheet.getDataRange().getValues();
    if (values.length < 2) continue;
    if (_identifyTab(values[0]) !== "premium_due_emails") continue;

    var hdr = values[0];
    var DATE_COL = -1, CLIENT_COL = -1, AGENT_COL = -1, STATUS_COL = -1, UNIT_COL = -1, MONTH_OPENED_COL = -1, COMPLETED_COL = -1;
    for (var ci = 0; ci < hdr.length; ci++) {
      var hh2 = _str(hdr[ci]).toLowerCase();
      if (hh2 === "date" || hh2 === "date sent") DATE_COL = ci;
      if (hh2 === "contact" || hh2 === "client" || hh2 === "client name") CLIENT_COL = ci;
      if (hh2 === "agent") AGENT_COL = ci;
      if (hh2 === "status") STATUS_COL = ci;
      if (hh2 === "unit") UNIT_COL = ci;
      if (hh2 === "month opened") MONTH_OPENED_COL = ci;
      if (hh2.indexOf("completed date") >= 0) COMPLETED_COL = ci;
    }

    for (var r = 1; r < values.length; r++) {
      var row = values[r];
      var dateSent = DATE_COL >= 0 ? parseDate(row[DATE_COL]) : null;
      var clientName = CLIENT_COL >= 0 ? _str(row[CLIENT_COL]) : "";
      var agentName = AGENT_COL >= 0 ? _str(row[AGENT_COL]) : "";
      var emailStatus = STATUS_COL >= 0 ? _str(row[STATUS_COL]) : "";
      var monthOpened = MONTH_OPENED_COL >= 0 ? _str(row[MONTH_OPENED_COL]) : "";
      var completedDate = COMPLETED_COL >= 0 ? parseDate(row[COMPLETED_COL]) : null;

      if (!agentName) continue;

      var nameKey = agentName.toLowerCase();
      var agentCode = NAME_TO_CODE[nameKey] || "";
      var unitCode = agentCode ? (ROSTER_UNIT[agentCode] || "26000") : "26000";

      var daysToComplete = 0;
      if (dateSent && completedDate) {
        daysToComplete = Math.max(0, Math.floor((completedDate - dateSent) / 86400000));
      }

      var rec = {
        date_sent: dateSent ? dateSent.toISOString().substring(0,10) : "",
        client: clientName, agent: agentName, agent_code: agentCode, unit: unitCode,
        status: emailStatus, month_opened: monthOpened,
        completed_date: completedDate ? completedDate.toISOString().substring(0,10) : "",
        days_to_complete: daysToComplete
      };
      emails.push(rec);

      var key = agentCode || agentName;
      if (!byAgent[key]) {
        byAgent[key] = { agent_code: agentCode, agent_name: agentName, unit: unitCode,
                         count: 0, completed: 0, open: 0, by_month: {} };
      }
      byAgent[key].count++;
      var statusLower = emailStatus.toLowerCase();
      if (statusLower.indexOf("complet") >= 0 || statusLower.indexOf("closed") >= 0 || statusLower === "done") {
        byAgent[key].completed++;
      } else if (statusLower.indexOf("open") >= 0 || statusLower.indexOf("pending") >= 0) {
        byAgent[key].open++;
      }

      var ym = "";
      if (dateSent) {
        ym = dateSent.getFullYear() + "-" + (dateSent.getMonth()+1 < 10 ? "0" : "") + (dateSent.getMonth()+1);
      } else if (monthOpened) {
        ym = monthOpened;
      }
      if (ym) {
        byAgent[key].by_month[ym] = (byAgent[key].by_month[ym] || 0) + 1;
        byMonth[ym] = (byMonth[ym] || 0) + 1;
      }

      if (byUnit[unitCode] !== undefined) byUnit[unitCode]++;
      totalEmails++;
    }
  }

  var leaderboard = Object.keys(byAgent).map(function(k){ return byAgent[k]; })
    .sort(function(a,b){ return b.count - a.count; });

  var totalCompleted = 0, totalOpen = 0;
  Object.keys(byAgent).forEach(function(k){
    totalCompleted += byAgent[k].completed || 0;
    totalOpen += byAgent[k].open || 0;
  });

  return {
    success: true,
    last_refreshed: new Date().toISOString().substring(0,10),
    total_emails: totalEmails,
    total_completed: totalCompleted,
    total_open: totalOpen,
    completion_rate: totalEmails > 0 ? Math.round((totalCompleted / totalEmails) * 100) : 0,
    by_agent_count: Object.keys(byAgent).length,
    by_month: byMonth,
    by_unit: byUnit,
    leaderboard: leaderboard,
    emails_sample: emails.slice(0, 500)
  };
}
// ════════════════════════════════════════════════════════════════
// SELF-TESTS (run from Apps Script editor for sanity check)
// ════════════════════════════════════════════════════════════════
function testPop7() {
  var r = getPop7();
  Logger.log("POP7: " + Object.keys(r.agents).length + " agents");
}
function testProduction() {
  var r = getProduction();
  Logger.log("Prod: " + Object.keys(r.agents).length + " agents, $" + r.summary.total_api + " API");
}
function testPending() {
  var r = getPendingLapses();
  Logger.log("Pending: " + r.pending_count + ", Lapses (24mo): " + r.lapses_count + ", Overdue (24mo): " + r.overdue_count);
}
function testSubmitted() {
  var r = getSubmitted();
  Logger.log("Submitted YTD: $" + r.branch.submitted_api + " across " + r.branch.submitted_apps + " apps");
  Logger.log("Agents: " + Object.keys(r.agents).length);
}
function testFF() {
  var r = getFactFinds({});
  Logger.log("FF (legacy): " + r.total_submissions + " valid (skipped " + r.skipped.tests + " tests)");
  Logger.log("Branch total: " + r.branch_total + " (last 30d: " + r.branch_total_30d + ")");
}
function testFFRevised() {
  var r = getFactFindsRevised();
  Logger.log("FF (revised): " + r.total_submissions + " on ffRevised tab");
  Logger.log("By status: " + JSON.stringify(r.by_status));
}
function testLapses() {
  var r = getLapses();
  Logger.log("Lapses: " + r.branch.count + " policies, $" + r.branch.api + " API");
}
function testOverdues() {
  var r = getOverdues();
  Logger.log("Overdues: " + r.branch.count + " policies, " + r.branch.early_count + " early (<1yr)");
}
function testPDE() {
  var r = getPremiumDueEmails();
  Logger.log("Premium Due Emails: " + r.total_emails + " emails");
}

// ════════════════════════════════════════════════════════════════
// DAILY FACT FIND DIGEST  —  emailed to BM at 5pm
//   Windows: Today + Week-to-date + Month-to-date
//   Per unit: count, per-agent, approved/pending, total TT$ need, top products
//   Reuses: getFactFindsRevised(), ffLookupDirectManager_(), MAIL_CONFIG
//   Setup once: run setupDailyDigest()  (installs a 5pm time trigger)
// ════════════════════════════════════════════════════════════════

var DIGEST_TZ = "America/Port_of_Spain"; // T&T, UTC-4 no DST
var DIGEST_UNITS = [
  { key:"ricky",  label:"Branch Direct (Ricky)" },
  { key:"kerwyn", label:"Kerwyn Ramroach (ABM)" },
  { key:"akaash", label:"Akaash Kalladeen (UM)" },
  { key:"gary",   label:"Gary Sookdeo (UM)" }
];

// ── Main: build + send the digest ─────────────────────────────────
function sendDailyFactFindDigest() {
  var data = getFactFindsRevised();
  var subs = (data && data.submissions) ? data.submissions : [];

  var now = new Date();
  var todayStr = _digestDateStr(now);
  var monthStart = todayStr.substring(0,8) + "01";        // YYYY-MM-01
  var weekStartStr = _digestDateStr(_digestWeekStart(now)); // Monday of this week

  // Filter helpers (submitted_at is "YYYY-MM-DD")
  function inWindow(s, startStr) {
    var d = s.submitted_at || "";
    return d && d >= startStr && d <= todayStr;
  }
  var today = subs.filter(function(s){ return s.submitted_at === todayStr; });
  var week  = subs.filter(function(s){ return inWindow(s, weekStartStr); });
  var month = subs.filter(function(s){ return inWindow(s, monthStart); });

  // `all`, not `month`: the oldest case waiting on a manager is 54 days old and
  // would fall outside every window the digest reports on. A backlog that ages
  // out of the report is exactly the backlog that never gets cleared.
  var html = _digestBuildHtml({
    today: today, week: week, month: month, all: subs,
    todayStr: todayStr, weekStartStr: weekStartStr, monthStart: monthStart
  });

  // A subject line is read in a list of forty others, so it leads with the part
  // that decides whether the mail gets opened tonight or Thursday. The old one
  // opened with the branch name and the word "digest", which is true of every
  // one of these ever sent.
  var waitingNow = _digestWaiting_(subs);
  var overdue = waitingNow.filter(function (w) { return w.days >= 14; }).length;
  var subject = today.length + " fact find" + (today.length === 1 ? "" : "s") + " today";
  if (waitingNow.length) {
    subject += " · " + waitingNow.length + " waiting on you";
    if (overdue) subject += " (" + overdue + " over 14 days)";
  } else {
    subject += " · nothing waiting";
  }
  subject += " — RR Branch " + todayStr;

  MailApp.sendEmail({
    to: MAIL_CONFIG.branchManager,
    subject: subject,
    htmlBody: html
  });
  Logger.log("Digest sent to " + MAIL_CONFIG.branchManager + " — today:" + today.length +
             " week:" + week.length + " month:" + month.length);
  return { ok:true, today:today.length, week:week.length, month:month.length };
}

// ── Aggregate one window into per-unit stats ──────────────────────
function _digestAggregate(list) {
  var units = {};
  DIGEST_UNITS.forEach(function(u){
    units[u.key] = { label:u.label, count:0, approved:0, pending:0, need:0, agents:{}, products:{} };
  });
  var grand = { count:0, approved:0, pending:0, need:0 };

  list.forEach(function(s){
    var key = ffLookupDirectManager_(s.agent_code) || "ricky";
    if (!units[key]) units[key] = { label:key, count:0, approved:0, pending:0, need:0, agents:{}, products:{} };
    var u = units[key];
    u.count++; grand.count++;
    var st = (s.status||"").toLowerCase();
    if (st.indexOf("approv")>=0){ u.approved++; grand.approved++; }
    else if (st.indexOf("pend")>=0 || st.indexOf("submit")>=0){ u.pending++; grand.pending++; }
    var need = Number(s.insurance_need)||0;
    u.need += need; grand.need += need;
    // per-agent
    var an = s.advisor_name || s.agent_code || "Unknown";
    u.agents[an] = (u.agents[an]||0) + 1;
    // products
    var p = (s.product||"").trim();
    if (p) u.products[p] = (u.products[p]||0) + 1;
  });
  return { units:units, grand:grand };
}

// ── Build the full HTML email ─────────────────────────────────────
function _digestPalette_() {
  return { navy:'#0E1F4D', gold:'#F5B324', teal:'#0D9488', amber:'#B45309',
           red:'#B91C1C', ink:'#1E293B', muted:'#64748B', faint:'#94A3B8',
           line:'#E2E8F0', wash:'#F8FAFC' };
}

function _digestEsc_(v) {
  return String(v === null || v === undefined ? '' : v)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function _digestMoney_(n) {
  n = Math.round(Number(n) || 0);
  if (n >= 1000000) return 'TT$' + (n / 1000000).toFixed(n >= 10000000 ? 0 : 1) + 'M';
  if (n >= 1000)    return 'TT$' + Math.round(n / 1000) + 'k';
  return 'TT$' + n;
}

function _digestDaysOld_(dateStr) {
  if (!dateStr) return 0;
  var d = new Date(dateStr);
  if (isNaN(d.getTime())) return 0;
  return Math.floor((Date.now() - d.getTime()) / 86400000);
}

function _digestIsPending_(s) {
  var st = String(s.status || '').toLowerCase();
  return st.indexOf('approv') < 0 && st.indexOf('declin') < 0 && st.indexOf('cancel') < 0;
}

/**
 * Everything still sitting with a manager, oldest first.
 *
 * This is the only part of the digest that asks anybody to do anything, so it
 * is computed first and printed first. The old layout carried it as "· 3
 * pending" inside a unit header, three screens down.
 */
function _digestWaiting_(all) {
  var out = [];
  (all || []).forEach(function (s) {
    if (!_digestIsPending_(s)) return;
    out.push({
      id: s.submission_id, client: s.client || '(client)',
      advisor: s.advisor_name || s.agent_code || '(advisor)',
      days: _digestDaysOld_(s.submitted_at),
      unit: ffLookupDirectManager_(s.agent_code) || 'ricky',
      need: Number(s.insurance_need) || 0
    });
  });
  out.sort(function (a, b) { return b.days - a.days; });
  return out;
}

function _digestStat_(label, value, sub, colour, P) {
  return '<td width="33.3%" valign="top" style="padding:0 5px">' +
    '<div style="background:#fff;border:1px solid ' + P.line + ';border-top:3px solid ' + colour +
      ';border-radius:10px;padding:13px 14px">' +
      '<div style="font-size:11px;font-weight:800;letter-spacing:.6px;color:' + P.muted +
        ';text-transform:uppercase">' + label + '</div>' +
      '<div style="font-size:31px;font-weight:800;color:' + P.navy + ';line-height:1.1;margin:3px 0 1px">' +
        value + '</div>' +
      '<div style="font-size:12px;color:' + P.muted + '">' + sub + '</div>' +
    '</div></td>';
}

function _digestSection_(txt, P) {
  return '<tr><td style="padding:22px 22px 8px;background:#fff">' +
    '<div style="font-size:13px;font-weight:800;color:' + P.navy +
      ';text-transform:uppercase;letter-spacing:.7px;border-left:3px solid ' + P.gold +
      ';padding-left:9px">' + txt + '</div></td></tr>';
}

/**
 * The block that gives the digest a point: what is waiting on a manager, how
 * long it has been waiting, and a button that opens it.
 *
 * When nothing is waiting it says so rather than disappearing. "Nothing needs
 * you" is worth reading; a section that silently vanishes just makes the reader
 * wonder whether it broke.
 */
function _digestActionBlock_(waiting, P) {
  // The manager drill-down lives on the site, not behind a script action —
  // there is no ?action=insights route, so pointing the button at the web app
  // would have sent every manager to a 404.
  var url = '';
  try { url = (typeof RRB_SITE !== 'undefined' && RRB_SITE) ? RRB_SITE + '/insights.html' : ''; } catch (e) {}
  var breaching = waiting.filter(function (w) { return w.days >= 14; });

  if (!waiting.length) {
    return '<tr><td style="padding:18px 22px;background:#ECFDF5;border-bottom:1px solid ' + P.line + '">' +
      '<div style="font-size:17px;font-weight:800;color:#065F46">Nothing is waiting on a manager.</div>' +
      '<div style="font-size:13px;color:#047857;margin-top:2px">Every fact find submitted has been signed off.</div>' +
      '</td></tr>';
  }

  var tone = breaching.length ? { bg:'#FEF2F2', edge:P.red, head:'#7F1D1D', body:'#991B1B' }
                              : { bg:'#FFFBEB', edge:P.gold, head:'#78350F', body:P.amber };
  var h = '<tr><td style="padding:18px 22px;background:' + tone.bg +
          ';border-bottom:1px solid ' + P.line + ';border-left:4px solid ' + tone.edge + '">';
  h += '<div style="font-size:19px;font-weight:800;color:' + tone.head + ';line-height:1.3">' +
       waiting.length + ' fact find' + (waiting.length === 1 ? '' : 's') + ' waiting on a manager</div>';
  h += '<div style="font-size:13px;color:' + tone.body + ';margin-top:3px">Oldest ' +
       waiting[0].days + ' days' +
       (breaching.length ? ' &middot; <b>' + breaching.length + ' past the 14-day mark</b>' : '') + '</div>';

  // The five that have waited longest. A full list of fourteen is a spreadsheet,
  // and a spreadsheet in an email gets scrolled past.
  h += '<table width="100%" cellpadding="0" cellspacing="0" style="margin-top:11px;border-collapse:collapse">';
  waiting.slice(0, 5).forEach(function (w) {
    var hot = w.days >= 14;
    h += '<tr>' +
      '<td style="padding:6px 0;border-top:1px solid rgba(0,0,0,.07);font-size:13.5px;color:' + P.ink + '">' +
        '<b>' + _digestEsc_(w.client) + '</b> &middot; ' + _digestEsc_(w.advisor) + '</td>' +
      '<td align="right" style="padding:6px 0;border-top:1px solid rgba(0,0,0,.07);' +
        'font-size:13.5px;font-weight:800;white-space:nowrap;color:' +
        (hot ? P.red : P.muted) + '">' + w.days + 'd</td></tr>';
  });
  h += '</table>';
  if (waiting.length > 5) {
    h += '<div style="font-size:12px;color:' + tone.body + ';margin-top:7px">+ ' +
         (waiting.length - 5) + ' more</div>';
  }
  if (url) {
    h += '<div style="margin-top:13px"><a href="' + url + '" ' +
      'style="display:inline-block;background:' + P.navy + ';color:#fff;padding:12px 22px;' +
      'border-radius:9px;text-decoration:none;font-weight:800;font-size:14px">Review them now &rarr;</a></div>';
  }
  return h + '</td></tr>';
}

/**
 * Four units, three windows, one table. The old layout gave each unit its own
 * card with its own sub-headings, which meant a quiet day still ran to eight
 * blocks and a unit with nothing to report got a card to say so. Numbers that
 * are meant to be compared belong in the same table.
 */
function _digestUnitTable_(todayAgg, weekAgg, monthAgg, P) {
  var rows = '';
  var keys = {};
  [todayAgg, weekAgg, monthAgg].forEach(function (a) {
    Object.keys(a.units).forEach(function (k) { keys[k] = 1; });
  });
  var order = Object.keys(keys).sort(function (a, b) {
    return (monthAgg.units[b] ? monthAgg.units[b].count : 0) -
           (monthAgg.units[a] ? monthAgg.units[a].count : 0);
  });
  var num = function (v, bold) {
    return '<td align="right" style="padding:9px 6px;border-top:1px solid ' + P.line +
      ';font-size:14px;font-weight:' + (bold ? '800' : '600') + ';color:' +
      (v ? P.ink : P.faint) + '">' + (v || '&ndash;') + '</td>';
  };
  order.forEach(function (k) {
    var t = todayAgg.units[k] || {}, w = weekAgg.units[k] || {}, m = monthAgg.units[k] || {};
    // "Akaash Kalladeen (UM)" wraps to three lines on a phone. The role is not
    // what the reader is comparing here — the numbers are.
    var label = String(m.label || w.label || t.label || k).replace(/\s*\([^)]*\)\s*$/, '');
    rows += '<tr>' +
      '<td style="padding:9px 6px;border-top:1px solid ' + P.line +
        ';font-size:13.5px;font-weight:700;color:' + P.ink + '">' + _digestEsc_(label) + '</td>' +
      num(t.count, true) + num(w.count) + num(m.count) +
      '<td align="right" style="padding:9px 6px;border-top:1px solid ' + P.line +
        ';font-size:13.5px;font-weight:700;color:' + P.teal + ';white-space:nowrap">' +
        (m.need ? _digestMoney_(m.need) : '&ndash;') + '</td></tr>';
  });
  var hd = function (t, al) {
    return '<td' + (al ? ' align="' + al + '"' : '') + ' style="padding:0 6px 7px;font-size:10.5px;' +
      'font-weight:800;letter-spacing:.6px;text-transform:uppercase;color:' + P.faint + '">' + t + '</td>';
  };
  return '<tr><td style="padding:2px 22px 4px;background:#fff">' +
    '<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">' +
    '<tr>' + hd('Unit') + hd('Today','right') + hd('Week','right') + hd('MTD','right') +
      hd('Need MTD','right') + '</tr>' + rows + '</table></td></tr>';
}

/** Today's fact finds, named. On a busy day this is the only list worth having. */
function _digestTodayList_(today, P) {
  if (!today.length) {
    return '<tr><td style="padding:4px 22px 10px;background:#fff">' +
      '<div style="font-size:13.5px;color:' + P.muted + '">No fact finds submitted today.</div>' +
      '</td></tr>';
  }
  var h = '<tr><td style="padding:2px 22px 6px;background:#fff">' +
    '<table width="100%" cellpadding="0" cellspacing="0" style="border-collapse:collapse">';
  today.slice(0, 12).forEach(function (s) {
    var st = String(s.status || '').toLowerCase();
    var ok = st.indexOf('approv') >= 0;
    h += '<tr>' +
      '<td style="padding:8px 6px;border-top:1px solid ' + P.line + ';font-size:13.5px;color:' + P.ink + '">' +
        '<b>' + _digestEsc_(s.client || '(client)') + '</b>' +
        '<span style="color:' + P.muted + '"> &middot; ' + _digestEsc_(s.advisor_name || s.agent_code || '') + '</span></td>' +
      '<td align="right" style="padding:8px 6px;border-top:1px solid ' + P.line +
        ';font-size:13px;font-weight:700;color:' + P.teal + ';white-space:nowrap">' +
        _digestMoney_(s.insurance_need) + '</td>' +
      '<td align="right" style="padding:8px 6px;border-top:1px solid ' + P.line +
        ';font-size:11px;font-weight:800;text-transform:uppercase;white-space:nowrap;color:' +
        (ok ? '#047857' : P.amber) + '">' + (ok ? 'Approved' : 'With manager') + '</td></tr>';
  });
  h += '</table>';
  if (today.length > 12) {
    h += '<div style="font-size:12px;color:' + P.muted + ';margin-top:7px">+ ' +
         (today.length - 12) + ' more today</div>';
  }
  return h + '</td></tr>';
}

/**
 * The daily digest.
 *
 * Rebuilt because the old one was two thousand pixels tall and answered no
 * question. It printed the same four-part block for every unit in two windows,
 * gave a full card to units with nothing to report, listed agents beside a
 * column of 1s, and buried the only actionable number — what is waiting on a
 * manager — inside a header line. A reader had to assemble the point themselves,
 * and at 5pm nobody does.
 *
 * It now opens with what needs the reader, then the three headline numbers,
 * then one table where the units can actually be compared, then today by name.
 */
function _digestBuildHtml(d) {
  var P = _digestPalette_();
  var todayAgg = _digestAggregate(d.today);
  var weekAgg  = _digestAggregate(d.week);
  var monthAgg = _digestAggregate(d.month);
  var waiting  = _digestWaiting_(d.all || d.month);

  var h = '<div style="background:#EEF2F7;padding:18px 10px">' +
    '<table width="100%" cellpadding="0" cellspacing="0" ' +
    'style="max-width:640px;margin:0 auto;border-collapse:collapse;' +
    'font-family:-apple-system,BlinkMacSystemFont,Segoe UI,Arial,Helvetica,sans-serif;color:' + P.ink + '">';

  h += '<tr><td style="background:' + P.navy + ';padding:20px 22px;border-radius:12px 12px 0 0">' +
    '<div style="font-size:21px;font-weight:800;color:#fff;letter-spacing:.8px">RR <span style="color:' +
      P.gold + '">BRANCH</span></div>' +
    '<div style="font-size:13px;color:#CBD5E1;margin-top:2px">Daily fact find digest &middot; ' +
      d.todayStr + '</div></td></tr>';

  h += _digestActionBlock_(waiting, P);

  h += '<tr><td style="padding:16px 17px 6px;background:' + P.wash + '">' +
    '<table width="100%" cellpadding="0" cellspacing="0"><tr>' +
    _digestStat_('Today', d.today.length, _digestMoney_(todayAgg.grand.need) + ' need', P.teal, P) +
    _digestStat_('This week', d.week.length, _digestMoney_(weekAgg.grand.need) + ' need', P.navy, P) +
    _digestStat_('Month to date', d.month.length, _digestMoney_(monthAgg.grand.need) + ' need', P.gold, P) +
    '</tr></table>' +
    '<div style="font-size:11px;color:' + P.faint + ';margin-top:9px;padding:0 5px">Week from ' +
      d.weekStartStr + ' &middot; month from ' + d.monthStart + '</div></td></tr>';

  h += _digestSection_('By unit', P);
  h += _digestUnitTable_(todayAgg, weekAgg, monthAgg, P);

  h += _digestSection_('Today', P);
  h += _digestTodayList_(d.today, P);

  h += '<tr><td style="padding:15px 22px;background:' + P.navy +
    ';border-radius:0 0 12px 12px;color:#94A3B8;font-size:11px;line-height:1.5">' +
    'Automated by RR Branch reporting &middot; reads the live fact find sheet &middot; sent daily at 5:00 PM.' +
    '<br>The full producer board, calendars and API are on the branch wallboard.</td></tr>';

  return h + '</table></div>';
}


// ── Date helpers (timezone-aware) ─────────────────────────────────
function _digestDateStr(d) {
  return Utilities.formatDate(d, DIGEST_TZ, "yyyy-MM-dd");
}
function _digestWeekStart(d) {
  // Monday of the current week, in DIGEST_TZ
  var dowStr = Utilities.formatDate(d, DIGEST_TZ, "u"); // 1=Mon..7=Sun
  var dow = parseInt(dowStr, 10);
  var ms = d.getTime() - (dow - 1) * 24 * 60 * 60 * 1000;
  return new Date(ms);
}

// ── One-time setup: install the 5pm daily trigger ─────────────────
function setupDailyDigest() {
  // remove any existing trigger for this function (avoid duplicates)
  ScriptApp.getProjectTriggers().forEach(function(t){
    if (t.getHandlerFunction() === "sendDailyFactFindDigest") ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger("sendDailyFactFindDigest")
    .timeBased()
    .atHour(17)        // 5 PM
    .everyDays(1)
    .inTimezone(DIGEST_TZ)
    .create();
  Logger.log("Daily digest trigger installed for 17:00 " + DIGEST_TZ);
  return "Daily 5pm digest trigger installed.";
}

// ── Manual test: send the digest right now ────────────────────────
function testDailyDigest() {
  var r = sendDailyFactFindDigest();
  Logger.log("Test digest result: " + JSON.stringify(r));
}

// ════════════════════════════════════════════════════════════════
// AGENT LOG (download-time logging) — writes a Completed Fact Find row
//   Triggered by stage:"agent_log" from the form's Download button.
//   NO manager email, NO review routing. Just logs the row so it shows
//   in reporting + the 5pm digest. Reuses the same roster + write path.
// ════════════════════════════════════════════════════════════════
function ffProcessAgentLog(data) {
  if (!data.agentCode) return _ffJson({ ok:false, error:"Agent code required" });

  // Resolve agent name/email from roster if missing (same as submit path)
  var roster = ffLoadRoster_();
  var code = String(data.agentCode).trim().toUpperCase();
  var agent = roster[code];
  if (agent) {
    if (!data.agentEmail)  data.agentEmail  = agent.email;
    if (!data.advisorName) data.advisorName = agent.name;
  }

  // Tag the unit so reporting/digest group it correctly (no emailing)
  var dmKey = ffLookupDirectManager_(code);
  var dm = MAIL_CONFIG.managers[dmKey];
  if (dm) {
    data.directManagerKey   = dmKey;
    data.directManagerName  = dm.name;
    data.directManagerEmail = dm.email;
  }

  // Stable submission id + timestamps
  data.submissionId = (data.submissionId && String(data.submissionId).length >= 8)
    ? String(data.submissionId)
    : Utilities.getUuid();
  data.lastUpdated = new Date().toISOString();
  if (!data.submittedAt) data.submittedAt = data.lastUpdated;

  // The whole point: a completed, logged Fact Find
  data.status = "Completed";

  // Save advisor signature if present, then strip before writing
  if (data._signatures && data._signatures.advisor) {
    try { ffSaveSigs_(data, ["advisor"]); } catch (e) {}
    delete data._signatures;
  }

  // Write (update existing row by submissionId, else append)
  var sheet = ffGetOrCreateRevisedTab_();
  var headers = ffEnsureHeaders_(sheet);
  var targetRow = ffFindRowBySubmissionId_(sheet, headers, data.submissionId);
  ffWriteRow_(sheet, headers, data, targetRow);
  var finalRow = targetRow > 0 ? targetRow : sheet.getLastRow();

  return _ffJson({
    ok: true,
    logged: true,
    status: "Completed",
    row: finalRow,
    submissionId: data.submissionId
  });
}
function whyNot() {
  var r = rrbFindByCode_('A10024', '');
  Logger.log('1 row: ' + JSON.stringify(r));
  if (!r) return;
  Logger.log('2 pw stored: ' + !!PropertiesService.getScriptProperties().getProperty('RRB_PW_' + r.email));
  Logger.log('3 pw match: ' + rrbCheckPassword_(r.email, '14'));
  Logger.log('4 login: ' + JSON.stringify(rrbLogin({parameter:{code:'A10024', pw:'14'}})));
}
function t1(){ Logger.log(JSON.stringify(rrbFindByCode_('A10024',''))); }