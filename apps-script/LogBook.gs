/**
 * LogBook.gs — the branch's Log Book: every document an agent hands in, routed
 * to the right Guardian Life department, signed for, sent on a transmittal,
 * and chased the same day when it is not.
 *
 * Asked for on 15 October 2026: "when an agent submits a document, they select
 * the department … they log the client name and email it searches which policy
 * number … rickyrampersadbranch/logbook and the agent puts their agent number
 * and code, the staff signs etc and intelligence built in … when staff collect
 * the documents the transmittal is built so it's for them to just print and send
 * off … if the document is received and not sent an email is triggered to the
 * staff and copying sales support and the agent asking for a reason, as this
 * will read date collected and date sent on the transmittal". Then: "1 day or
 * same day turnaround as the time and date stamped … you have the current
 * department listing so … you should know where to route".
 *
 * What the old book showed (the Log Book Digital workbook, BU and MAIL PREP
 * tabs, November 2025 to October 2026, about 3,600 document lines):
 *   - 41% went on the day they were logged, 72% within one working day, and
 *     12% took six working days or more; 13% have no date sent at all.
 *   - About 25 departments were typed some 90 ways ("RECORDS MANAGEMENT DEPT",
 *     "RECORDS MANAGEMENT", "RECORDS MANAGEME" …), and 237 spellings of some
 *     70 documents. Nothing could be counted by department.
 *   - 6.5% of lines had no policy number, and the client's name was typed more
 *     than one way on 61 policies.
 * So: the department and the document are picked from one list, and the list
 * carries where each document has gone before (LB_DOCS); the client and the
 * policy come from Salesforce; every line carries four stamps (logged,
 * received, sent, and the reason when the last two are not the same day).
 *
 * ── THE FLOW ───────────────────────────────────────────────────────────────
 *   Logged    the agent (agent number and code) or a staff member for them
 *             logs the client, the policy and each document, with the
 *             department suggested from the history. Nothing is in the
 *             branch's hands yet.
 *   Received  a staff member takes the papers, checks them against the lines,
 *             can correct a department, and signs. This is the date collected.
 *   Sent      the staff member builds the transmittal for a department, prints
 *             it and sends it. This is the date sent.
 *   Returned  the papers went back to the agent, with the reason.
 * The rule (LB.SAME_DAY): what is received is sent the same working day. After
 * LB_CUTOFF_HOUR (16:00) on that day, and every working day after while it is
 * still not sent and no fresh reason is on it, the person who received it is
 * e-mailed, with sales support and the agent copied, asking why. The reason is
 * kept on the line and printed on the transmittal beside the two dates.
 *
 * A contract collected by an agent to deliver to the client is the other kind
 * of line ("Contract for delivery"): the 20-day turnaround under s.155(6) of
 * the Insurance (Amendment) Act 2020 counts from the day it was collected,
 * with a reminder at day 15 and day 18 and the branch manager told at day 20.
 * It closes when the Delivery Book records a Policy Contract handed over on that
 * policy, or when staff mark it delivered.
 *
 * ── SAME PROJECT AS THE DELIVERY BOOK ─────────────────────────────────────
 * This file goes into the RR Operations project beside DeliveryBook.gs and
 * uses its sign-in, Sessions tab, Salesforce connection, Drive folder, test
 * mode and secret. DeliveryBook.gs hands every "lb.*" action and the "lbr"
 * reason link to this file.
 *
 * ── SCRIPT PROPERTIES (besides the Delivery Book's) ───────────────────────
 *   LB_CUTOFF_HOUR     the hour after which a document received today and not
 *                      sent is late (default 16).
 *   LB_MANAGER         the branch manager's address, told of a contract past
 *                      20 days (default the branch manager's Guardian address).
 *   LB_SALES_SUPPORT   copied on every chase (default sales support).
 *   LB_AGENTS_SHEET_ID the workbooks whose Access (or Agent Skill Bank) tab
 *                      holds Agent Number and Password, comma-separated.
 *                      Default: the Confidential Fact Find Form, so everyone
 *                      signs in with the number and password the fact find
 *                      uses. The Agents tab here is read first.
 *   LB_HISTORY_ID      the Log Book Digital workbook, for lbImportHistory().
 *
 * Mail follows DB_MODE: in test (the default) every e-mail goes to
 * DB_TEST_INBOX with a banner naming who it was for.
 *
 * Nothing here is client data, and nothing client-identifying may be added to
 * this file: the repository is public. The tables below are names of
 * departments and forms, and counts.
 */

var LB = {
  TABS: { LINES: 'Log Book', TRANS: 'Transmittals', AGENTS: 'Agents', DEPTS: 'Departments' },
  TYPES: ['Documents for Guardian', 'Contract for delivery'],
  CUTOFF_HOUR: 16,
  CONTRACT_DAYS: 20, CONTRACT_WARN: [15, 18],
  NUDGE_DAYS: [1, 3],             // logged and not handed in: the agent is reminded on these working days
  REASON_COVERS: 1,               // a reason given covers the rest of that working day and the next
  DUP_DAYS: 14,
  MAX_ITEMS: 30,
  SALES_SUPPORT: 'rickyrampersadsalessupport@myguardiangroup.com',
  MANAGER: 'Ricky.Rampersad@myguardiangroup.com',
  // The Confidential Fact Find Form workbook: its Access tab is the sign-in list.
  FACTFIND_ID: '1iytBbnETQFRmkveDSxadjsAfN07aMTW9E2slcA5qaWI',
  FROM: 'RICKY RAMPERSAD BRANCH',
  BRANCH_LINE: 'Ricky Rampersad Branch · 26000 · GLOC Chaguanas',
  // Forms that are not about one policy.
  NO_POLICY: ['Agent Contract', 'Licence Renewal', 'CBTT Receipt', 'CPD Certificate', 'Company Documents', 'Other'],
  OFT: 'OFT (FEDEX)',
  DECLARE_DOCS: 'I confirm these are the documents I am handing to the branch, complete and signed where they must be.',
  DECLARE_CONTRACT: 'I, the agent listed on the insurance policy contract, confirm that I have received the contract for my ' +
    'client and reviewed it for accuracy, and that it is to be delivered to the client within 20 days as required ' +
    'under Section 155(6) of the Insurance (Amendment) Act 2020.',
};

var LB_COLUMNS = [
  'Line Id', 'Ref', 'Line', 'Type', 'Status', 'Logged At', 'Logged By',
  'Agent No', 'Agent', 'Agent Email', 'Unit',
  'Client', 'Salesforce Contact', 'Client Email', 'Policy #', 'Record Type', 'Plan', 'Portfolio Id',
  'Document', 'Quantity', 'Item Note', 'Department', 'Suggested Department', 'Notes', 'Declaration',
  'Received At', 'Received By', 'Receipt Signature', 'Routing Changed',
  'Transmittal', 'Sent At', 'Sent By', 'Tracking #',
  'Late Reason', 'Reason At', 'Reason By',
  'Returned At', 'Returned By', 'Return Reason', 'Delivered At',
  'Alerts', 'Flags', 'Source',
];
var LB_TRANS_COLUMNS = ['Transmittal', 'Department', 'Attention', 'Sent At', 'Sent By', 'Lines', 'Documents',
                        'Tracking #', 'Late Lines', 'Status', 'Line Ids'];
var LB_AGENT_COLUMNS = ['Agent No', 'Name', 'Email', 'Unit', 'Code', 'Active'];
var LB_DEPT_COLUMNS = ['Department', 'Attention', 'Active'];

/* ── What the history says ─────────────────────────────────────────────────
 * Built from the Log Book Digital workbook (BU and MAIL PREP, 3,634 lines,
 * 3,527 matched) on 15 October 2026, outside the repository. Each document's
 * usual department, how often, and what usually travels with it (the share of
 * hand-ins of that document that carried the other one). The alias patterns
 * fold the old spellings into one name, for the import and for anything typed.
 * The live book adds to these counts as lines are sent (lbRouting_).        */
var LB_DEPTS = [  // [name, documents routed there in the history, alias pattern]
  ["RECORDS MANAGEMENT DEPT", 1794, "RECORDS ?MANAGE|ROUTI?I?NG: RECORDS"],
  ["GLOC CS RSC - CHAGUANAS", 842, "CS RSC - CHAGUANAS?$|CHAGUANAS RSC|CHAG RSC|CUSTOMER SERVICE RSC CHAGUANAS|^CUSTOMER SERVICEE?$|^GLOC CUSTOMER SERVICEE?$"],
  ["GLOC CS RSC - HEAD OFFICE", 1, "HEAD OFFICE"],
  ["GLOC CS RSC - ST. AUGUSTINE", 2, "ST\\.? AUGUSTINE"],
  ["GLOC CS RSC - WEST MOORINGS", 1, "CS RSC - WEST MOORINGS"],
  ["GLOC CS RSC - ONE WOODBROOK PLACE", 1, "WOODBROOK"],
  ["GLOC BIR DEPARTMENT", 218, "\\bGLO[CB] BIR"],
  ["GLOC CLAIMS - CUSTOMER SUPPORT", 99, "GLOC CLAIMS|INDIVIDUAL LIFE CLAIMS|^CUSTOMER SUPPORT"],
  ["CGU - GLOC CORPORATE GROUP UNIT", 73, "CORPORATE GROUP UNIT"],
  ["GLOC FINANCIAL CONTROL", 77, "FINANCIAL CONTR"],
  ["MAIL TEAM QUERY", 64, "^MAIL TEAM"],
  ["GLOC SALES ADMINISTRATION DEPARTMENT", 56, "SALES ADMIN"],
  ["PREMIUMS APPLICATION UNIT", 42, "PREMIUMS APPLICATION"],
  ["GLOC PREMIUM ACCOUNTING DEPT", 19, "^GLOC PREMIUM"],
  ["CLIENT ACQUISITION DEPARTMENT", 58, "CLIENT ACQU"],
  ["GLOC ANNUITY PAYMENTS QUERIES", 49, "ANNUIT"],
  ["EBD HEALTH CLAIMS", 28, "EBD HEALTH CLAIMS"],
  ["EBD CUSTOMER CARE", 13, "EBD? CUSTOMER ?CARE"],
  ["GLOC REDATES, REINSTATEMENTS & INCREASES", 40, "REDATE|REINSTATE"],
  ["DELTA FORCE QUERY", 23, "DELTA FORCE"],
  ["GIA TASK REQUEST", 11, "GIA TASK"],
  ["GLOC ALTERATIONS", 3, "ALTERATION"],
  ["GAM - WEST MOORINGS", 5, "^GAM"],
  ["HEALTH UNDERWRITING", 1, "HEALTH UNDERWRITING"],
  ["SCANNING TEAM", 2, "SCANNING"],
  ["DISPATCH QUERIES", 1, "DISPATCH"],
  ["OFT (FEDEX)", 4, "^OFT$|FEDEX"],
];

var LB_DOCS = [  // [name, times in the history, [[department, times]...], [[sent with, % of visits]...], alias pattern]
  ["Signed Script", 1114, [["RECORDS MANAGEMENT DEPT", 1100], ["GLOC CS RSC - CHAGUANAS", 10], ["SCANNING TEAM", 2]], [], "^SIO?GNED SCRIPTS?$|^SCRIPTS?$"],
  ["Proof of ID", 413, [["GLOC CS RSC - CHAGUANAS", 225], ["GLOC BIR DEPARTMENT", 74], ["RECORDS MANAGEMENT DEPT", 48]], [["Policy Contract", 58], ["Surrender Documents", 45]], "^(PROOF OF )?ID,?$|^IDENTIFICATION$|^PROOF OF ID|^POLICY OWNER ID|^ID CARD"],
  ["Beneficiary ID", 5, [["GLOC CLAIMS - CUSTOMER SUPPORT", 3], ["GLOC CS RSC - CHAGUANAS", 2]], [], "BENEFICIARY ID"],
  ["Surrender Documents", 193, [["GLOC CS RSC - CHAGUANAS", 182], ["RECORDS MANAGEMENT DEPT", 7], ["CLIENT ACQUISITION DEPARTMENT", 3]], [["Proof of ID", 76], ["Policy Contract", 58]], "^SURRENDER (DOCS?|DOCUMENTS?)$"],
  ["Surrender Form", 25, [["GLOC CS RSC - CHAGUANAS", 21], ["GLOC BIR DEPARTMENT", 3], ["CLIENT ACQUISITION DEPARTMENT", 1]], [["Proof of ID", 84], ["Policy Contract", 79]], "^SURRENDER FORM"],
  ["Partial Surrender Form", 13, [["RECORDS MANAGEMENT DEPT", 7], ["GLOC CS RSC - CHAGUANAS", 6]], [["Proof of ID", 50]], "PARTIAL SURRENDER"],
  ["Policy Contract", 244, [["GLOC CS RSC - CHAGUANAS", 148], ["GLOC BIR DEPARTMENT", 47], ["CLIENT ACQUISITION DEPARTMENT", 17]], [["Proof of ID", 78], ["Surrender Documents", 47]], "^(POLICY )?CONTRACT$"],
  ["OAS Declaration", 146, [["RECORDS MANAGEMENT DEPT", 141], ["CGU - GLOC CORPORATE GROUP UNIT", 4], ["GLOC BIR DEPARTMENT", 1]], [["Change of Beneficiary", 35]], "^OAS"],
  ["Change of Beneficiary", 145, [["RECORDS MANAGEMENT DEPT", 108], ["GLOC BIR DEPARTMENT", 30], ["GLOC CS RSC - CHAGUANAS", 7]], [["Signed Script", 38], ["OAS Declaration", 34]], "CHANGE OF BENEFICIARY|^COB"],
  ["Acknowledgement Letter", 130, [["RECORDS MANAGEMENT DEPT", 112], ["CLIENT ACQUISITION DEPARTMENT", 8], ["GLOC CLAIMS - CUSTOMER SUPPORT", 6]], [["Signed Script", 42]], "ACKNOWLEDG?EMENT LETTER|^ACK"],
  ["ACH Form", 81, [["GLOC CS RSC - CHAGUANAS", 57], ["RECORDS MANAGEMENT DEPT", 10], ["GLOC FINANCIAL CONTROL", 5]], [["Proof of ID", 79], ["Bank Statement", 73], ["Surrender Documents", 54]], "^ACH"],
  ["Bank Statement", 81, [["GLOC CS RSC - CHAGUANAS", 53], ["GLOC ANNUITY PAYMENTS QUERIES", 8], ["GLOC CLAIMS - CUSTOMER SUPPORT", 6]], [["Proof of ID", 84], ["ACH Form", 71], ["Surrender Documents", 46]], "BANK STATEMENT"],
  ["Client Letter", 53, [["RECORDS MANAGEMENT DEPT", 27], ["GLOC CS RSC - CHAGUANAS", 7], ["GLOC BIR DEPARTMENT", 6]], [["Proof of ID", 32]], "^CLIENT LETTER|^LETTERS?$"],
  ["Cheque - Premium Payment", 83, [["PREMIUMS APPLICATION UNIT", 42], ["GLOC FINANCIAL CONTROL", 26], ["CLIENT ACQUISITION DEPARTMENT", 4]], [["Writeback Form", 31]], "^CHEQUE (- )?(BILLING )?PAYMENT|^CHEQUE PAYMENT|^CHEQUE$"],
  ["Cheque - PDCs", 20, [["GLOC PREMIUM ACCOUNTING DEPT", 19], ["GAM - WEST MOORINGS", 1]], [], "PDC"],
  ["PMAR", 46, [["MAIL TEAM QUERY", 45], ["GLOC CS RSC - CHAGUANAS", 1]], [], "^PMAR"],
  ["Discharge C Form", 105, [["GLOC CS RSC - CHAGUANAS", 76], ["GLOC CLAIMS - CUSTOMER SUPPORT", 12], ["GLOC BIR DEPARTMENT", 8]], [["Proof of ID", 45], ["Surrender Documents", 33]], "DISCHAR+GE (C )?FORM|DISCHAR+GE FORM C|^CLAIM DISCHARGE"],
  ["De-Registration Form", 28, [["GLOC CS RSC - CHAGUANAS", 22], ["GLOC BIR DEPARTMENT", 3], ["CLIENT ACQUISITION DEPARTMENT", 2]], [["Proof of ID", 91], ["Surrender Documents", 74], ["Policy Contract", 65]], "DE-?REGISTRATION"],
  ["Future Premium Payment Form", 43, [["RECORDS MANAGEMENT DEPT", 39], ["CGU - GLOC CORPORATE GROUP UNIT", 2], ["GLOC BIR DEPARTMENT", 1]], [["OAS Declaration", 67], ["Change of Beneficiary", 42], ["Signed Script", 31]], "FUTURE (PAYMENT|PREMIUM)"],
  ["MPOS", 23, [["GLOC SALES ADMINISTRATION DEPARTMENT", 22], ["GLOC CS RSC - CHAGUANAS", 1]], [], "^MPOS"],
  ["Proof of Address", 24, [["RECORDS MANAGEMENT DEPT", 14], ["GLOC BIR DEPARTMENT", 4], ["CGU - GLOC CORPORATE GROUP UNIT", 4]], [["OAS Declaration", 74], ["Proof of ID", 39], ["Change of Beneficiary", 35]], "PROOF OF ADDRESS"],
  ["Medical Reports", 25, [["MAIL TEAM QUERY", 17], ["GLOC CLAIMS - CUSTOMER SUPPORT", 6], ["RECORDS MANAGEMENT DEPT", 2]], [], "MEDICAL (REPORT|HISTORY)"],
  ["Health Claim Form", 31, [["EBD HEALTH CLAIMS", 19], ["EBD CUSTOMER CARE", 12]], [], "HEALTH CLAIM|CLAIM FORM HEAL+TH"],
  ["Direct Debit Form", 23, [["RECORDS MANAGEMENT DEPT", 23]], [["OAS Declaration", 91], ["Signed Script", 55], ["Change of Beneficiary", 45]], "DIRECT DEBIT"],
  ["Change of Address", 20, [["RECORDS MANAGEMENT DEPT", 15], ["GLOC BIR DEPARTMENT", 4], ["GLOC CS RSC - CHAGUANAS", 1]], [["OAS Declaration", 71], ["Change of Beneficiary", 43], ["Future Premium Payment Form", 36]], "CHANGE OF ADDRESS"],
  ["Amendment Form", 20, [["RECORDS MANAGEMENT DEPT", 15], ["GLOC REDATES, REINSTATEMENTS & INCREASES", 4], ["CLIENT ACQUISITION DEPARTMENT", 1]], [["OAS Declaration", 71], ["Change of Beneficiary", 41]], "AMENDMENT"],
  ["Writeback Form", 39, [["GLOC FINANCIAL CONTROL", 33], ["EBD HEALTH CLAIMS", 3], ["CLIENT ACQUISITION DEPARTMENT", 2]], [["Cheque - Premium Payment", 67]], "WRITE ?BACK"],
  ["Claim Submission Form - Life & CI", 23, [["GLOC CLAIMS - CUSTOMER SUPPORT", 17], ["RECORDS MANAGEMENT DEPT", 4], ["GIA TASK REQUEST", 1]], [["Proof of ID", 82], ["Policy Contract", 53], ["Death Certificate", 41]], "CLAIM SUBMISSION"],
  ["Service Questionnaire", 30, [["RECORDS MANAGEMENT DEPT", 30]], [["OAS Declaration", 46]], "SERVIC(E|ING) QUESTIONNAIRE|^QUESTIONNAIRE$"],
  ["Declaration of Insurability", 15, [["RECORDS MANAGEMENT DEPT", 10], ["DELTA FORCE QUERY", 3], ["GLOC REDATES, REINSTATEMENTS & INCREASES", 2]], [["Quotation", 33]], "DECLARATION OF INSURABILITY|^DOI$"],
  ["Quotation", 14, [["GLOC REDATES, REINSTATEMENTS & INCREASES", 6], ["RECORDS MANAGEMENT DEPT", 3], ["DELTA FORCE QUERY", 3]], [["Proof of ID", 67], ["FATCA Form", 50], ["Conversion Form", 50]], "^QUOTATION"],
  ["Rollover Letter", 14, [["GLOC BIR DEPARTMENT", 12], ["GLOC CS RSC - CHAGUANAS", 1], ["RECORDS MANAGEMENT DEPT", 1]], [["Proof of ID", 71], ["Policy Contract", 71]], "ROLLOVER"],
  ["NPW Letter", 13, [["CLIENT ACQUISITION DEPARTMENT", 7], ["RECORDS MANAGEMENT DEPT", 5], ["CGU - GLOC CORPORATE GROUP UNIT", 1]], [["Policy Contract", 46], ["Proof of ID", 31]], "^NPW"],
  ["BIR Form", 13, [["CGU - GLOC CORPORATE GROUP UNIT", 10], ["CLIENT ACQUISITION DEPARTMENT", 2], ["GLOC BIR DEPARTMENT", 1]], [["Recent Pay Slip", 67], ["Proof of ID", 44], ["OAS Declaration", 44]], "^BIR FORM"],
  ["Certificate of Identity", 11, [["CGU - GLOC CORPORATE GROUP UNIT", 6], ["GLOC CLAIMS - CUSTOMER SUPPORT", 3], ["GIA TASK REQUEST", 1]], [["Proof of ID", 45], ["Claim Submission Form - Life & CI", 45], ["Death Certificate", 36]], "CERTIFICATE OF IDENTITY"],
  ["FATCA Form", 13, [["RECORDS MANAGEMENT DEPT", 4], ["GLOC REDATES, REINSTATEMENTS & INCREASES", 3], ["DELTA FORCE QUERY", 3]], [["Proof of ID", 54], ["Quotation", 46], ["Conversion Form", 46]], "FATCA|FACTA"],
  ["Receipt", 12, [["GLOC SALES ADMINISTRATION DEPARTMENT", 5], ["GLOC BIR DEPARTMENT", 2], ["RECORDS MANAGEMENT DEPT", 2]], [["Discharge C Form", 40], ["Proof of ID", 40]], "^RECEIPT"],
  ["Conversion Form", 9, [["GLOC REDATES, REINSTATEMENTS & INCREASES", 5], ["DELTA FORCE QUERY", 3], ["RECORDS MANAGEMENT DEPT", 1]], [["Non-Smoker Declaration", 78], ["FATCA Form", 67], ["Quotation", 67]], "CONVERSION"],
  ["Letter Authorizing Transaction", 9, [["CGU - GLOC CORPORATE GROUP UNIT", 7], ["GLOC CS RSC - CHAGUANAS", 2]], [["Proof of ID", 80], ["Recent Pay Slip", 80], ["BIR Form", 80]], "LETTER AUTHORI[SZ]ING"],
  ["Increment Form", 8, [["GLOC BIR DEPARTMENT", 6], ["RECORDS MANAGEMENT DEPT", 1], ["CLIENT ACQUISITION DEPARTMENT", 1]], [["Proof of ID", 57]], "INCREMENT"],
  ["Mandate Form", 8, [["GLOC ANNUITY PAYMENTS QUERIES", 8]], [["Bank Statement", 86], ["Proof of ID", 86], ["TD1", 43]], "MANDATE"],
  ["Non-Smoker Declaration", 13, [["GLOC REDATES, REINSTATEMENTS & INCREASES", 5], ["RECORDS MANAGEMENT DEPT", 5], ["DELTA FORCE QUERY", 3]], [["Conversion Form", 54], ["FATCA Form", 46], ["Quotation", 38]], "NON[- ]?SMOKER"],
  ["Death Certificate", 13, [["GLOC CLAIMS - CUSTOMER SUPPORT", 11], ["GIA TASK REQUEST", 2]], [["Claim Submission Form - Life & CI", 100], ["Proof of ID", 86], ["Policy Contract", 57]], "CERTIFICATE OF DEATH|DEATH CERTIFICATE"],
  ["OFT Form", 17, [["RECORDS MANAGEMENT DEPT", 12], ["OFT (FEDEX)", 4], ["MAIL TEAM QUERY", 1]], [["OAS Declaration", 53], ["Change of Beneficiary", 35]], "^OFT"],
  ["Recent Pay Slip", 7, [["CGU - GLOC CORPORATE GROUP UNIT", 6], ["RECORDS MANAGEMENT DEPT", 1]], [["BIR Form", 86], ["OAS Declaration", 57], ["Proof of Address", 57]], "PAY ?SLIP"],
  ["Birth Certificate", 6, [["GLOC ANNUITY PAYMENTS QUERIES", 3], ["GLOC CS RSC - CHAGUANAS", 2], ["GLOC BIR DEPARTMENT", 1]], [], "BIRTH CERTIFICATE"],
  ["Marriage Certificate", 4, [["GLOC BIR DEPARTMENT", 3], ["GLOC CS RSC - CHAGUANAS", 1]], [], "MARRIAGE CERTIFICATE"],
  ["Change of Name", 8, [["GLOC CS RSC - CHAGUANAS", 5], ["GLOC BIR DEPARTMENT", 3]], [["Proof of ID", 80], ["Policy Contract", 60], ["Bank Statement", 40]], "CHANGE OF NAME"],
  ["TD1", 5, [["GLOC ANNUITY PAYMENTS QUERIES", 4], ["GLOC BIR DEPARTMENT", 1]], [["Proof of ID", 100], ["Bank Statement", 60], ["Mandate Form", 60]], "^TD1"],
  ["Certificate of Existence", 4, [["GLOC ANNUITY PAYMENTS QUERIES", 4]], [], "CERTIFICATE OF EXISTENCE"],
  ["Certificate of Incorporation", 4, [["CGU - GLOC CORPORATE GROUP UNIT", 3], ["RECORDS MANAGEMENT DEPT", 1]], [], "CERTIFICATE OF INCORPORATION"],
  ["Health Application", 4, [["DELTA FORCE QUERY", 1], ["GLOC CS RSC - ONE WOODBROOK PLACE", 1], ["RECORDS MANAGEMENT DEPT", 1]], [], "HEALTH APPLICATION"],
  ["Agent Contract", 6, [["GLOC SALES ADMINISTRATION DEPARTMENT", 6]], [], "AGENT CONTRACT"],
  ["Endorsement", 3, [["GLOC CLAIMS - CUSTOMER SUPPORT", 1], ["GLOC CS RSC - CHAGUANAS", 1], ["CLIENT ACQUISITION DEPARTMENT", 1]], [], "^ENDORSEMENT"],
  ["Product Charges Acknowledgement", 4, [["RECORDS MANAGEMENT DEPT", 3], ["GLOC CS RSC - CHAGUANAS", 1]], [], "PRODUCT CHARGES"],
  ["Stop Payment Form", 4, [["RECORDS MANAGEMENT DEPT", 3], ["GLOC CS RSC - CHAGUANAS", 1]], [], "STOP PAYMENT"],
  ["DCI", 3, [["RECORDS MANAGEMENT DEPT", 3]], [], "^DCI"],
  ["Licence Renewal", 10, [["GLOC SALES ADMINISTRATION DEPARTMENT", 10]], [["CBTT Receipt", 56], ["CPD Certificate", 44]], "LICEN[CS]E RENEWAL"],
  ["CBTT Receipt", 7, [["GLOC SALES ADMINISTRATION DEPARTMENT", 7]], [["Licence Renewal", 83]], "CBTT"],
  ["Application Form", 0, [], [], "^APPLICATION"],
  ["Reinstatement / Redate Form", 4, [["RECORDS MANAGEMENT DEPT", 4]], [], "REINSTATEMENT|REDATE"],
  ["Increase / Decrease Form", 7, [["RECORDS MANAGEMENT DEPT", 4], ["GLOC BIR DEPARTMENT", 3]], [["OAS Declaration", 50], ["Change of Beneficiary", 50], ["Policy Contract", 50]], "INCREASE|DECREASE"],
  ["Medical Evidence Request", 3, [["RECORDS MANAGEMENT DEPT", 3]], [], "MEDICAL EVIDENCE"],
  ["Stale-Dated Cheque", 5, [["GLOC FINANCIAL CONTROL", 5]], [["Writeback Form", 60]], "STALE"],
  ["Credit Card Form (RCC)", 2, [["RECORDS MANAGEMENT DEPT", 2]], [], "CREDIT CARD|\\bRCC\\b"],
  ["List Bill Form", 2, [["RECORDS MANAGEMENT DEPT", 2]], [], "LIST ?BILL"],
  ["Company Documents", 7, [["CGU - GLOC CORPORATE GROUP UNIT", 7]], [], "ARTICLES OF INC|LIST OF DIRECTORS|ANNUAL RETURN"],
  ["CPD Certificate", 4, [["GLOC SALES ADMINISTRATION DEPARTMENT", 4]], [], "\\bCPD\\b"],
  ["Confirmation of Funds", 2, [["GLOC CS RSC - CHAGUANAS", 2]], [], "CONFIRMATION OF FUNDS"],
  ["Other", 4, [["GIA TASK REQUEST", 1], ["RECORDS MANAGEMENT DEPT", 1], ["GLOC CLAIMS - CUSTOMER SUPPORT", 1]], [], "^MISC|^OTHER"],
];


/* ============================== routing intelligence ============================== */

function lbUpper_(s) {
  return String(s == null ? '' : s).toUpperCase().replace(/[–—]/g, '-').replace(/\s+/g, ' ').replace(/^[\s.,]+|[\s.,]+$/g, '');
}

/* An old spelling, or anything typed, to one department name; '' when none fits. */
function lbCanonDept_(s) {
  var u = lbUpper_(s).replace(/^ROUTI?I?NG\s*:\s*/, '');
  if (!u || u === 'PLEASE SELECT') return '';
  var list = lbDeptNames_();
  for (var i = 0; i < list.length; i++) if (lbUpper_(list[i]) === u) return list[i];
  for (var j = 0; j < LB_DEPTS.length; j++) if (new RegExp(LB_DEPTS[j][2]).test(u)) return LB_DEPTS[j][0];
  return '';
}

function lbCanonDoc_(s) {
  var u = lbUpper_(s).replace(/^DOCUMENT\s*:\s*/, '');
  if (!u || u === 'PLEASE SELECT') return '';
  for (var i = 0; i < LB_DOCS.length; i++) if (lbUpper_(LB_DOCS[i][0]) === u) return LB_DOCS[i][0];
  for (var j = 0; j < LB_DOCS.length; j++) if (new RegExp(LB_DOCS[j][4]).test(u)) return LB_DOCS[j][0];
  return '';
}

/* The departments a line may go to: the Departments tab when it has rows
   (staff add, rename or switch one off there), else the history's list. */
function lbDeptRows_() {
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(LB.TABS.DEPTS);
  var out = [];
  if (sh && sh.getLastRow() > 1) {
    var hm = dbHeaderMap_(sh);
    sh.getRange(2, 1, sh.getLastRow() - 1, hm.head.length).getValues().forEach(function (r) {
      var name = String(r[hm.map['Department']] || '').trim();
      var act = String('Active' in hm.map ? r[hm.map['Active']] : 'Yes').trim().toLowerCase();
      if (name && act !== 'no' && act !== 'false') out.push({ name: name, attn: 'Attention' in hm.map ? String(r[hm.map['Attention']] || '').trim() : '' });
    });
  }
  if (!out.length) out = LB_DEPTS.map(function (d) { return { name: d[0], attn: '' }; });
  return out;
}
function lbDeptNames_() { return lbDeptRows_().map(function (d) { return d.name; }); }
function lbDocNames_() { return LB_DOCS.map(function (d) { return d[0]; }); }

/* Where each document goes: the history's counts plus every line this book has
   sent since. A staff member correcting a department teaches it. Kept ten
   minutes, because every agent's form asks for it. */
function lbRouting_() {
  var cache = CacheService.getScriptCache();
  var c = cache.get('lb_routing');
  if (c) { try { return JSON.parse(c); } catch (e) {} }
  var to = {}, n = {}, deptN = {};
  LB_DOCS.forEach(function (d) {
    to[d[0]] = {}; n[d[0]] = d[1];
    d[2].forEach(function (p) { to[d[0]][p[0]] = p[1]; deptN[p[0]] = (deptN[p[0]] || 0) + p[1]; });
  });
  lbRows_().forEach(function (r) {
    if (r.source === 'Imported' || r.status !== 'Sent' || !r.document || !r.department) return;
    var t = to[r.document] = to[r.document] || {};
    t[r.department] = (t[r.department] || 0) + 1;
    n[r.document] = (n[r.document] || 0) + 1;
    deptN[r.department] = (deptN[r.department] || 0) + 1;
  });
  var docs = {};
  LB_DOCS.forEach(function (d) {
    var dests = Object.keys(to[d[0]]).map(function (k) { return [k, to[d[0]][k]]; })
      .sort(function (a, b) { return b[1] - a[1]; });
    var tot = dests.reduce(function (s, x) { return s + x[1]; }, 0);
    docs[d[0]] = { n: n[d[0]] || 0, to: dests.slice(0, 3).map(function (x) { return [x[0], x[1], tot ? Math.round(x[1] * 100 / tot) : 0]; }),
                   with: d[3] };
  });
  var out = { docs: docs, deptN: deptN };
  try { cache.put('lb_routing', JSON.stringify(out), 600); } catch (e) {}
  return out;
}

/* The department a document should go to, and how sure the history is. */
function lbSuggest_(doc) {
  var r = lbRouting_().docs[doc];
  if (!r || !r.to.length) return { department: '', share: 0, n: 0 };
  return { department: r.to[0][0], share: r.to[0][2], n: r.n, also: r.to.slice(1) };
}


/* ============================== the book on the sheet ============================== */

function lbLinesTab_() {
  var sh = dbSheet_(LB.TABS.LINES, LB_COLUMNS);
  var hm = dbHeaderMap_(sh);
  var missing = LB_COLUMNS.filter(function (c) { return !(c in hm.map); });
  if (missing.length) sh.getRange(1, hm.head.length + 1, 1, missing.length).setValues([missing]);
  return sh;
}

/* Every line as an object, with its row number. Read once per request. */
var LB_READ_ = null;
function lbRows_() {
  if (LB_READ_) return LB_READ_;
  var sh = lbLinesTab_();
  var hm = dbHeaderMap_(sh);
  var last = sh.getLastRow();
  var vals = last > 1 ? sh.getRange(2, 1, last - 1, hm.head.length).getValues() : [];
  var g = function (r, k) { return k in hm.map ? r[hm.map[k]] : ''; };
  LB_READ_ = vals.map(function (r, i) {
    return {
      row: i + 2, id: String(g(r, 'Line Id')), ref: String(g(r, 'Ref')), line: Number(g(r, 'Line')) || 1,
      type: String(g(r, 'Type') || LB.TYPES[0]), status: String(g(r, 'Status')),
      loggedAt: lbDate_(g(r, 'Logged At')), loggedBy: String(g(r, 'Logged By')),
      agentNo: String(g(r, 'Agent No')), agent: String(g(r, 'Agent')), agentEmail: String(g(r, 'Agent Email')), unit: String(g(r, 'Unit')),
      client: String(g(r, 'Client')), contactId: String(g(r, 'Salesforce Contact')), clientEmail: String(g(r, 'Client Email')),
      policy: String(g(r, 'Policy #')), recordType: String(g(r, 'Record Type')), plan: String(g(r, 'Plan')),
      document: String(g(r, 'Document')), quantity: Number(g(r, 'Quantity')) || 1, itemNote: String(g(r, 'Item Note')),
      department: String(g(r, 'Department')), suggested: String(g(r, 'Suggested Department')), notes: String(g(r, 'Notes')),
      receivedAt: lbDate_(g(r, 'Received At')), receivedBy: String(g(r, 'Received By')), signed: !!g(r, 'Receipt Signature'),
      routingChanged: String(g(r, 'Routing Changed')),
      transmittal: String(g(r, 'Transmittal')), sentAt: lbDate_(g(r, 'Sent At')), sentBy: String(g(r, 'Sent By')),
      tracking: String(g(r, 'Tracking #')),
      reason: String(g(r, 'Late Reason')), reasonAt: lbDate_(g(r, 'Reason At')), reasonBy: String(g(r, 'Reason By')),
      returnedAt: lbDate_(g(r, 'Returned At')), returnedBy: String(g(r, 'Returned By')), returnReason: String(g(r, 'Return Reason')),
      deliveredAt: lbDate_(g(r, 'Delivered At')),
      alerts: String(g(r, 'Alerts')), flags: String(g(r, 'Flags')), source: String(g(r, 'Source')),
    };
  });
  return LB_READ_;
}

function lbDate_(v) {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  if (v === '' || v == null) return null;
  var d = new Date(v);
  return isNaN(d.getTime()) ? null : d;
}

/* Writes the named cells of each row, re-reading nothing. */
function lbSet_(rows, obj) {
  var sh = lbLinesTab_();
  var hm = dbHeaderMap_(sh);
  rows.forEach(function (r) {
    Object.keys(obj).forEach(function (k) {
      if (!(k in hm.map)) return;
      var v = typeof obj[k] === 'function' ? obj[k](r) : obj[k];
      sh.getRange(r.row, hm.map[k] + 1).setValue(v);
    });
  });
  LB_READ_ = null;
}

function lbDay_(d) { return d ? Utilities.formatDate(d, dbTz_(), 'yyyy-MM-dd') : ''; }
function lbHour_(d) { return Number(Utilities.formatDate(d, dbTz_(), 'HH:mm').split(':')[0]); }
function lbWeekend_(d) { var w = new Date(lbDay_(d) + 'T12:00:00Z').getUTCDay(); return w === 0 || w === 6; }

/* Working days from one day to another: the same day is 0, Friday to Monday 1.
   Public holidays are not known to the script and count as working days. */
function lbWorkDays_(a, b) {
  if (!a || !b) return null;
  var x = new Date(lbDay_(a) + 'T12:00:00Z'), y = new Date(lbDay_(b) + 'T12:00:00Z');
  if (y < x) return -lbWorkDays_(b, a);
  var n = 0;
  while (x < y) { x = new Date(x.getTime() + 86400000); var w = x.getUTCDay(); if (w !== 0 && w !== 6) n++; }
  return n;
}
function lbCalDays_(a, b) {
  return Math.round((new Date(lbDay_(b) + 'T12:00:00Z') - new Date(lbDay_(a) + 'T12:00:00Z')) / 86400000);
}
function lbCutoff_() {
  var h = parseInt(dbProp_('LB_CUTOFF_HOUR', LB.CUTOFF_HOUR), 10);
  return isFinite(h) && h >= 8 && h <= 23 ? h : LB.CUTOFF_HOUR;
}

/* Received and not sent past the rule: received on an earlier day, or today
   after the cut-off. */
function lbIsLate_(r, now) {
  if (r.status !== 'Received' || !r.receivedAt) return false;
  var d = lbWorkDays_(r.receivedAt, now);
  return d > 0 || (lbDay_(r.receivedAt) === lbDay_(now) && lbHour_(now) >= lbCutoff_());
}

/* A reason stands for the rest of its working day and the next one. */
function lbReasonFresh_(r, now) {
  return !!(r.reason && r.reasonAt && lbWorkDays_(r.reasonAt, now) <= LB.REASON_COVERS &&
            (!r.receivedAt || r.reasonAt >= r.receivedAt));
}


/* ============================== who is signed in ============================== */

/* Sessions sit on the Delivery Book's Sessions tab with three more columns,
   so one sign-out, one expiry and one prune serve both. */
var LB_SESS_EXTRA = ['Agent No', 'Email', 'Unit'];

function lbSession_(token) {
  var who = dbSession_(token);
  if (!who) return null;
  var sh = dbSheet_(DB.TABS.SESS, DB_SESS_COLUMNS);
  var hm = dbHeaderMap_(sh);
  who.isAgent = /^agent$/i.test(who.role);
  who.isManager = /^branch manager$/i.test(String(who.role).trim());
  if ('Agent No' in hm.map) {
    var last = sh.getLastRow();
    var vals = sh.getRange(2, 1, last - 1, hm.head.length).getValues();
    for (var i = 0; i < vals.length; i++) {
      if (String(vals[i][0]) !== String(token)) continue;
      who.agentNo = String(vals[i][hm.map['Agent No']] || '');
      who.email = String(vals[i][hm.map['Email']] || '');
      who.unit = String(vals[i][hm.map['Unit']] || '');
    }
  }
  if (!who.isAgent && !who.email) who.email = lbStaffEmail_(who.name);
  return who;
}

function lbAgentKey_(v) {
  var s = String(v || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  var d = s.replace(/^A/, '');
  return /^\d+$/.test(d) ? String(Number(d)) : s;
}

/* Where people sign in from, in order:
     1. the Agents tab in this sheet (anyone added by hand);
     2. the Access tab of the Confidential Fact Find Form workbook: Agent Number
        and Password, the same sign-in the fact find uses (asked for on 15
        October 2026: "it should use the code that are on the fact find
        sheet"). Its Role says who is staff;
     3. the Agent Skill Bank, when LB_AGENTS_SHEET_ID also names that workbook.
   LB_AGENTS_SHEET_ID lists workbook IDs, comma-separated, and replaces the
   default (the fact find workbook). The first row found for a number wins.
   Read once per request. */
var LB_AGENTS_READ_ = null;
function lbAgents_() {
  if (LB_AGENTS_READ_) return LB_AGENTS_READ_;
  var out = [], seen = {};
  var inactive = /^(no|false|not active|inactive|resigned|terminated)/i;
  var add = function (a) {
    var k = lbAgentKey_(a.agentNo);
    if (!k || seen[k]) return;
    seen[k] = 1; a.key = k; out.push(a);
  };
  var tab = dbSheet_(LB.TABS.AGENTS, LB_AGENT_COLUMNS);
  var hm = dbHeaderMap_(tab);
  var last = tab.getLastRow();
  if (last > 1) tab.getRange(2, 1, last - 1, hm.head.length).getValues().forEach(function (r) {
    add({ agentNo: String(r[hm.map['Agent No']] || '').trim(), name: String(r[hm.map['Name']] || '').trim(),
          email: String(r[hm.map['Email']] || '').trim(), unit: String(r[hm.map['Unit']] || '').trim(),
          code: String(r[hm.map['Code']] || '').trim(), role: 'Role' in hm.map ? String(r[hm.map['Role']] || '').trim() : '',
          active: !inactive.test(String(r[hm.map['Active']] || '')) });
  });
  var ids = String(dbProp_('LB_AGENTS_SHEET_ID', LB.FACTFIND_ID)).split(',').map(function (x) { return x.trim(); }).filter(String);
  ids.forEach(function (id) {
    var book;
    try { book = SpreadsheetApp.openById(id); } catch (e) { Logger.log('agent list ' + id + ': ' + e); return; }
    ['Access', 'Agent Skill Bank'].forEach(function (name) {
      var sh = book.getSheetByName(name);
      if (!sh || sh.getLastRow() < 2) return;
      var bh = dbHeaderMap_(sh);
      var col = function (names) { for (var i = 0; i < names.length; i++) if (names[i] in bh.map) return bh.map[names[i]]; return -1; };
      var cNo = col(['Agent Number', 'Agent no.', 'Agent No', 'Agent no']), cPw = col(['Password', 'Portal code']);
      if (cNo < 0 || cPw < 0) return;
      var cName = col(['Name', 'Agent']), cMail = col(['Email', 'E-mail', 'Agent Email']), cUnit = col(['Unit']);
      var cAct = col(['Active']), cRole = col(['Role']);
      sh.getRange(2, 1, sh.getLastRow() - 1, bh.head.length).getValues().forEach(function (r) {
        add({ agentNo: String(r[cNo] || '').trim(), name: String(cName >= 0 ? r[cName] : '').replace(/^\s*A?\d+\s*-\s*/, '').trim(),
              email: String(cMail >= 0 ? r[cMail] : '').trim(), unit: String(cUnit >= 0 ? r[cUnit] : '').trim(),
              code: String(r[cPw] == null ? '' : r[cPw]).trim(), role: String(cRole >= 0 ? r[cRole] : '').trim(),
              active: !inactive.test(String(cAct >= 0 ? r[cAct] : '')) });
      });
    });
  });
  LB_AGENTS_READ_ = out;
  return out;
}

/* Staff and the branch manager get the staff side (receiving, transmittals,
   insights): "only staff and the branch manager can access this", 15 October
   2026. Agents, unit managers and the assistant branch manager log their own
   documents. */
function lbIsStaffRole_(role) {
  var r = String(role || '').trim();
  return /staff|support|admin/i.test(r) || /^branch manager$/i.test(r);
}

function lbFindAgent_(no) {
  var k = lbAgentKey_(no);
  return k ? lbAgents_().filter(function (a) { return a.key === k; })[0] || null : null;
}

/* A staff member's address: the RR Operations Access tab, else the fact find's. */
function lbStaffEmail_(name) {
  var want = String(name || '').trim().toLowerCase();
  if (!want) return '';
  var sh = dbSheet_(DB.TABS.ACCESS, DB_ACCESS_COLUMNS);
  var hm = dbHeaderMap_(sh);
  var last = sh.getLastRow();
  if (last > 1 && 'Email' in hm.map) {
    var hit = sh.getRange(2, 1, last - 1, hm.head.length).getValues().filter(function (r) {
      return String(r[hm.map['Name']] || '').trim().toLowerCase() === want && r[hm.map['Email']];
    })[0];
    if (hit) return String(hit[hm.map['Email']]).trim();
  }
  var a = lbAgents_().filter(function (x) { return x.name.toLowerCase() === want && x.email; })[0];
  return a ? a.email : '';
}

/** Sign-in by agent number and password, both. A refusal never says which
 *  was wrong. Ten wrong tries on one number close it for fifteen minutes. */
function lbLogin_(b) {
  LB_AGENTS_READ_ = null;
  var no = dbClean_(b.agentNo, 20), code = dbClean_(b.code, 40);
  if (!no || !code) throw new Error('Enter your agent number and your password.');
  var key = 'lb_fail_' + lbAgentKey_(no);
  var cache = CacheService.getScriptCache();
  var fails = Number(cache.get(key) || 0);
  if (fails >= 10) throw new Error('Too many tries on that number. Try again in fifteen minutes.');
  var a = lbFindAgent_(no);
  if (!a || !a.active || !a.code || a.code.toUpperCase() !== code.toUpperCase()) {
    cache.put(key, String(fails + 1), 900);
    throw new Error('That agent number and password do not match.');
  }
  var staff = lbIsStaffRole_(a.role);
  var role = staff ? a.role : 'Agent';
  var name = a.name || ('Agent ' + a.agentNo);
  var token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 8);
  var now = new Date();
  var exp = new Date(now.getTime() + DB.SESSION_HOURS * 3600000);
  var sh = dbSheet_(DB.TABS.SESS, DB_SESS_COLUMNS);
  var hm = dbHeaderMap_(sh);
  var need = LB_SESS_EXTRA.filter(function (c) { return !(c in hm.map); });
  if (need.length) { sh.getRange(1, hm.head.length + 1, 1, need.length).setValues([need]); hm = dbHeaderMap_(sh); }
  sh.appendRow(dbRowFor_(sh, { 'Token': token, 'Name': name, 'Role': role,
    'Salesforce User Id': '', 'Issued': now, 'Expires': exp, 'Apps': 'logbook',
    'Agent No': a.agentNo, 'Email': a.email, 'Unit': a.unit }));
  dbPruneSessions_(sh);
  return { ok: true, token: token, name: name, role: role, mode: dbMode_(),
           agentNo: a.agentNo, apps: opsAppsFor_('logbook') };
}


/* ============================== the web seam ============================== */

/* Called by DeliveryBook.gs's doPost for every action that starts "lb.". */
function lbHandle_(b) {
  LB_READ_ = null; LB_AGENTS_READ_ = null;
  if (b.action === 'lb.login') return lbLogin_(b);
  var who = lbSession_(b.token);
  if (!who) return { ok: false, error: 'signed-out' };
  if (!who.isAgent && !opsCanUse_(who, 'logbook')) return { ok: false, error: 'The Log Book is not on your access. Ask the branch to add it.' };
  var staff = !who.isAgent;
  var STAFF_ONLY = { 'lb.queue': 1, 'lb.receive': 1, 'lb.return': 1, 'lb.transmittal': 1, 'lb.unsend': 1,
                     'lb.transmittals': 1, 'lb.reason': 1, 'lb.delivered': 1, 'lb.stats': 1, 'lb.agents': 1 };
  if (STAFF_ONLY[b.action] && !staff) return { ok: false, error: 'That is for the branch staff.' };
  switch (b.action) {
    case 'lb.config':       return lbConfig_(who);
    case 'lb.lookup':       return lbLookup_(b, who);
    case 'lb.policies':     return dbPolicies_(b, who);
    case 'lb.submit':       return lbSubmit_(b, who);
    case 'lb.mine':         return lbMine_(b, who);
    case 'lb.cancel':       return lbCancel_(b, who);
    case 'lb.queue':        return lbQueue_(b, who);
    case 'lb.receive':      return lbReceive_(b, who);
    case 'lb.return':       return lbReturn_(b, who);
    case 'lb.transmittal':  return lbTransmittal_(b, who);
    case 'lb.unsend':       return lbUnsend_(b, who);
    case 'lb.transmittals': return lbTransmittals_(b, who);
    case 'lb.reason':       return lbReason_(b, who);
    case 'lb.delivered':    return lbDelivered_(b, who);
    case 'lb.stats':        return lbStats_(b, who);
    case 'lb.agents':       return { ok: true, agents: lbAgents_().filter(function (a) { return a.active && !lbIsStaffRole_(a.role); })
                                       .map(function (a) { return { agentNo: a.agentNo, name: a.name, unit: a.unit }; }) };
    default:                return { ok: false, error: 'Unknown action' };
  }
}

function lbConfig_(who) {
  var routing = lbRouting_();
  var depts = lbDeptRows_().map(function (d) { return { name: d.name, attn: d.attn, n: routing.deptN[d.name] || 0 }; });
  var docs = LB_DOCS.map(function (d) {
    var r = routing.docs[d[0]] || { n: 0, to: [], with: [] };
    return { name: d[0], n: r.n, to: r.to, with: r.with, noPolicy: LB.NO_POLICY.indexOf(d[0]) >= 0 };
  });
  return { ok: true, name: who.name, role: who.role, agent: who.isAgent, manager: !!who.isManager,
           agentNo: who.agentNo || '', mode: dbMode_(), types: LB.TYPES, departments: depts, documents: docs,
           cutoff: lbCutoff_(), oft: LB.OFT, declareDocs: LB.DECLARE_DOCS, declareContract: LB.DECLARE_CONTRACT,
           salesforce: dbSfConfigured_() };
}


/* ============================== finding the client ============================== */

/** A policy number, a name or an e-mail address. The e-mail is matched on the
 *  contact's own address or their preferred one. */
function lbLookup_(b, who) {
  var q = dbClean_(b.q, 80);
  if (!q) throw new Error('Type the client\'s name, e-mail or a policy number.');
  if (!dbSfConfigured_()) return { ok: true, via: 'none', clients: [], note: 'Salesforce is not connected yet: type the client and the policy.' };
  if (/@/.test(q)) {
    var e = q.toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new Error('That e-mail address does not look complete.');
    var cs = dbSoql_('SELECT ' + DB_CONTACT_FIELDS + ' FROM Contact WHERE Email = ' + dbQuote_(e) +
                     ' OR Preferred_Email__c = ' + dbQuote_(e) + ' LIMIT 10').map(dbContactOut_);
    return { ok: true, via: 'email', clients: dbMarkDuplicates_(cs) };
  }
  if (/\d{5,}/.test(q.replace(/\s/g, '')) && !/^[a-z .'-]+$/i.test(q)) return dbLookup_({ policy: q }, who);
  return dbLookup_({ name: q }, who);
}


/* ============================== logging ============================== */

function lbRef_() {
  var day = Utilities.formatDate(new Date(), dbTz_(), 'yyyy-MM-dd').replace(/-/g, '').slice(2);
  return 'LB-' + day + '-' + Utilities.getUuid().replace(/[^a-zA-Z0-9]/g, '').slice(-4).toUpperCase();
}

function lbValidate_(b, who) {
  var d = b.entry || {};
  var out = { flags: [] };
  out.type = LB.TYPES.indexOf(d.type) >= 0 ? d.type : LB.TYPES[0];
  var contract = out.type === LB.TYPES[1];

  /* Whose documents. An agent logs their own; staff log for an agent. */
  if (who.isAgent) {
    out.agent = { agentNo: who.agentNo, name: who.name, email: who.email, unit: who.unit };
  } else {
    var a = lbFindAgent_(d.agentNo);
    if (!a) throw new Error('Choose the agent these documents are from.');
    out.agent = { agentNo: a.agentNo, name: a.name, email: a.email, unit: a.unit };
  }

  out.contactId = dbIsSfId_(d.contactId) ? d.contactId : '';
  out.client = dbClean_(d.client, 120);
  if (!out.client) throw new Error('Find the client first, or type their name.');
  if (!out.contactId) out.flags.push('Client typed, not picked from Salesforce');
  out.clientEmail = dbClean_(d.clientEmail, 80).toLowerCase();

  var docNames = lbDocNames_(), depts = lbDeptNames_();
  var items = (d.items || []).slice(0, LB.MAX_ITEMS).map(function (it) {
    var doc = contract ? 'Policy Contract' : (docNames.indexOf(it.document) >= 0 ? it.document : lbCanonDoc_(it.document));
    if (!doc) throw new Error('Choose each document from the list ("Other" is there, with a note).');
    var note = dbClean_(it.note, 120);
    if (doc === 'Other' && !note) throw new Error('Say what the "Other" document is.');
    var dept = contract ? 'AGENT DELIVERY' : (depts.indexOf(it.department) >= 0 ? it.department : lbCanonDept_(it.department));
    if (!dept) throw new Error('Choose the department for the ' + doc.toLowerCase() + '.');
    var pol = dbClean_(it.policy, 60);
    if (!pol && LB.NO_POLICY.indexOf(doc) < 0) throw new Error('The ' + doc.toLowerCase() + ' needs its policy number.');
    var sug = contract ? { department: '' } : lbSuggest_(doc);
    return {
      document: doc, note: note, department: dept, suggested: sug.department || '',
      policy: pol, recordType: dbClean_(it.type, 40).toUpperCase(), plan: dbClean_(it.plan, 80),
      portfolioId: dbIsSfId_(it.portfolioId) ? it.portfolioId : '',
      quantity: Math.max(1, Math.min(50, parseInt(it.quantity, 10) || 1)),
    };
  });
  if (!items.length) throw new Error('Add at least one document.');
  items.forEach(function (it) {
    if (it.policy && !it.portfolioId) out.flags.push('Policy ' + it.policy + ' not picked from Salesforce');
    if (it.suggested && it.department !== it.suggested) out.flags.push(it.document + ' to ' + it.department + ' (usually ' + it.suggested + ')');
  });
  out.items = items;
  if (d.declared !== true) throw new Error('Tick the declaration.');
  out.declaration = contract ? LB.DECLARE_CONTRACT : LB.DECLARE_DOCS;
  out.notes = dbClean_(d.notes, 500);
  return out;
}

/* The same document for the same policy, logged in the last fortnight and not
   yet sent, is probably the same paper twice. Flagged, never refused: the
   agent is told and goes on if it is not. */
function lbDuplicates_(items) {
  var since = new Date(Date.now() - LB.DUP_DAYS * 86400000);
  var open = lbRows_().filter(function (r) {
    return (r.status === 'Logged' || r.status === 'Received') && r.loggedAt && r.loggedAt >= since;
  });
  var out = [];
  items.forEach(function (it, i) {
    if (!it.policy) return;
    var k = dbKey_(it.policy);
    var hit = open.filter(function (r) { return dbKey_(r.policy) === k && r.document === it.document; })[0];
    if (hit) out.push({ item: i, ref: hit.ref, status: hit.status, document: it.document, policy: it.policy });
  });
  return out;
}

function lbSubmit_(b, who) {
  var d = lbValidate_(b, who);
  var dups = lbDuplicates_(d.items);
  if (dups.length && b.confirmDuplicates !== true) {
    return { ok: true, needsConfirm: true, duplicates: dups };
  }
  dups.forEach(function (x) { d.flags.push('Possible repeat of ' + x.ref + ' (' + x.document + ', ' + x.status.toLowerCase() + ')'); });

  var contract = d.type === LB.TYPES[1];
  var ref = lbRef_(), now = new Date();
  var sh = lbLinesTab_();
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    var first = sh.getLastRow() + 1;
    var rows = d.items.map(function (it, i) {
      return dbRowFor_(sh, {
        'Line Id': ref + '-' + (i + 1), 'Ref': ref, 'Line': i + 1, 'Type': d.type,
        'Status': contract ? 'With agent' : 'Logged', 'Logged At': now, 'Logged By': who.name,
        'Agent No': d.agent.agentNo, 'Agent': d.agent.name, 'Agent Email': d.agent.email, 'Unit': d.agent.unit,
        'Client': d.client, 'Salesforce Contact': d.contactId, 'Client Email': d.clientEmail,
        'Policy #': it.policy, 'Record Type': it.recordType, 'Plan': it.plan, 'Portfolio Id': it.portfolioId,
        'Document': it.document, 'Quantity': it.quantity, 'Item Note': it.note,
        'Department': it.department, 'Suggested Department': it.suggested, 'Notes': d.notes,
        'Declaration': d.declaration, 'Flags': d.flags.join('; '), 'Source': 'App' + (dbMode_() === 'live' ? '' : ' (test)'),
      });
    });
    sh.getRange(first, 1, rows.length, rows[0].length).setValues(rows);
  } finally { lock.releaseLock(); }
  LB_READ_ = null;
  CacheService.getScriptCache().remove('lb_routing');

  var mail = lbReceiptMail_(ref, d, who, now);
  return { ok: true, ref: ref, lines: d.items.length, status: contract ? 'With agent' : 'Logged',
           flags: d.flags, mail: mail,
           due: contract ? Utilities.formatDate(new Date(now.getTime() + LB.CONTRACT_DAYS * 86400000), dbTz_(), 'EEEE d MMMM yyyy') : '' };
}

/* The agent's copy of what they logged, so the hand-in has a reference. */
function lbReceiptMail_(ref, d, who, now) {
  if (!d.agent.email) return 'No agent e-mail on file';
  var contract = d.type === LB.TYPES[1];
  var rows = d.items.map(function (it) {
    return [it.document + (it.quantity > 1 ? ' × ' + it.quantity : '') + (it.note ? ' (' + it.note + ')' : ''),
            it.policy || '—', contract ? 'Deliver to the client' : it.department];
  });
  var html = lbMailHtml_(
    contract ? 'Contract collected for delivery' : 'Documents logged',
    '<p>' + dbEsc_(contract
      ? 'You collected the contract below on ' + Utilities.formatDate(now, dbTz_(), 'EEEE d MMMM yyyy') +
        '. It is to reach the client within 20 days. Record the handover in the Delivery Book.'
      : 'These are logged for ' + d.client + '. Hand the papers to the branch with this reference; they are sent on the day they are received.') + '</p>',
    ['Document', 'Policy', contract ? 'Next' : 'Department'], rows,
    '<p style="color:#5b6b7f;font-size:13px">Reference <b>' + dbEsc_(ref) + '</b> · logged by ' + dbEsc_(who.name) + '</p>');
  return lbMail_({ to: [d.agent.email], subject: (contract ? 'Contract for delivery' : 'Log Book') + ': ' + d.client + ' (' + ref + ')', html: html });
}


/* ============================== the agent's own list ============================== */

function lbPublic_(r, now, staff) {
  var o = {
    id: r.id, ref: r.ref, line: r.line, type: r.type, status: r.status,
    loggedAt: r.loggedAt ? r.loggedAt.toISOString() : '', loggedBy: r.loggedBy,
    agentNo: r.agentNo, agent: r.agent, unit: r.unit, client: r.client, policy: r.policy, recordType: r.recordType,
    document: r.document, quantity: r.quantity, itemNote: r.itemNote, department: r.department, suggested: r.suggested,
    receivedAt: r.receivedAt ? r.receivedAt.toISOString() : '', receivedBy: r.receivedBy,
    transmittal: r.transmittal, sentAt: r.sentAt ? r.sentAt.toISOString() : '', sentBy: r.sentBy, tracking: r.tracking,
    reason: r.reason, reasonAt: r.reasonAt ? r.reasonAt.toISOString() : '', reasonBy: r.reasonBy,
    returnedAt: r.returnedAt ? r.returnedAt.toISOString() : '', returnReason: r.returnReason,
    deliveredAt: r.deliveredAt ? r.deliveredAt.toISOString() : '', flags: r.flags, notes: r.notes,
    late: lbIsLate_(r, now), reasonFresh: lbReasonFresh_(r, now),
  };
  if (r.status === 'Received') o.daysHeld = lbWorkDays_(r.receivedAt, now);
  if (r.status === 'Logged') o.daysWaiting = lbWorkDays_(r.loggedAt, now);
  if (r.type === LB.TYPES[1] && r.loggedAt) {
    o.contractDay = lbCalDays_(r.loggedAt, r.deliveredAt || now);
    o.contractDue = new Date(r.loggedAt.getTime() + LB.CONTRACT_DAYS * 86400000).toISOString();
  }
  if (staff) { o.routingChanged = r.routingChanged; o.signed = r.signed; o.source = r.source; }
  return o;
}

function lbMine_(b, who) {
  var days = Math.max(7, Math.min(400, parseInt(b.days, 10) || 90));
  var since = new Date(Date.now() - days * 86400000), now = new Date();
  var mine = lbRows_().filter(function (r) {
    return r.source !== 'Imported' && r.loggedAt && r.loggedAt >= since &&
      (who.isAgent ? lbAgentKey_(r.agentNo) === lbAgentKey_(who.agentNo) : r.loggedBy === who.name);
  });
  lbContractsClose_(mine.filter(function (r) { return r.status === 'With agent'; }));
  return { ok: true, lines: mine.map(function (r) { return lbPublic_(r, now, false); })
    .sort(function (a, c) { return a.loggedAt < c.loggedAt ? 1 : -1; }) };
}

/* An agent may withdraw what they logged until the branch has the papers. */
function lbCancel_(b, who) {
  var ref = dbClean_(b.ref, 30);
  var rows = lbRows_().filter(function (r) { return r.ref === ref; });
  if (!rows.length) throw new Error('No such entry.');
  if (who.isAgent && lbAgentKey_(rows[0].agentNo) !== lbAgentKey_(who.agentNo)) throw new Error('That entry is not yours.');
  if (rows.some(function (r) { return r.status !== 'Logged' && r.status !== 'With agent'; })) {
    throw new Error('The branch already has these papers. Ask the branch to return them.');
  }
  lbSet_(rows, { 'Status': 'Cancelled', 'Flags': function (r) { return lbAddFlag_(r.flags, 'Withdrawn by ' + who.name); } });
  return { ok: true };
}

function lbAddFlag_(flags, f) { return flags ? flags + '; ' + f : f; }


/* ============================== the staff side ============================== */

function lbPick_(ids, statuses) {
  var want = {};
  [].concat(ids || []).forEach(function (i) { want[String(i)] = 1; });
  var rows = lbRows_().filter(function (r) { return want[r.id]; });
  if (!rows.length) throw new Error('Choose the lines first.');
  if (rows.length !== Object.keys(want).length) throw new Error('Some of those lines are no longer in the book. Refresh.');
  var bad = rows.filter(function (r) { return statuses.indexOf(r.status) < 0; });
  if (bad.length) throw new Error(bad[0].document + ' for ' + bad[0].client + ' is ' + bad[0].status.toLowerCase() + ' already. Refresh.');
  return rows;
}

/** What is waiting: logged and not handed in, received and not sent (by
 *  department, the late first), returned this week, and what went today. */
function lbQueue_(b, who) {
  var now = new Date(), today = lbDay_(now);
  var weekAgo = new Date(now.getTime() - 7 * 86400000);
  var rows = lbRows_().filter(function (r) {
    if (r.source === 'Imported') return false;
    if (r.status === 'Logged' || r.status === 'Received' || r.status === 'With agent') return true;
    if (r.status === 'Sent') return lbDay_(r.sentAt) === today;
    if (r.status === 'Returned') return r.returnedAt && r.returnedAt >= weekAgo;
    return false;
  });
  lbContractsClose_(rows.filter(function (r) { return r.status === 'With agent'; }));
  var out = rows.map(function (r) { return lbPublic_(r, now, true); });
  var trans = lbTransRows_().filter(function (t) { return t.sentAt && lbDay_(t.sentAt) === today && t.status !== 'Cancelled'; })
    .map(lbTransPublic_);
  return { ok: true, now: now.toISOString(), cutoff: lbCutoff_(), lines: out, today: trans, departments: lbDeptRows_() };
}

/** The staff member has the papers in hand and signs for them. A department
 *  can be corrected on the way in; the correction is kept and teaches the
 *  suggestions. */
function lbReceive_(b, who) {
  var rows = lbPick_(b.ids, ['Logged']);
  if (!/^data:image\/png;base64,/.test(String(b.signature || ''))) throw new Error('Sign for the documents.');
  var changes = {};
  var depts = lbDeptNames_();
  Object.keys(b.departments || {}).forEach(function (id) {
    var v = String(b.departments[id] || '');
    if (v && depts.indexOf(v) < 0) throw new Error('Choose the department from the list.');
    if (v) changes[id] = v;
  });
  var now = new Date();
  var sig = dbSaveImage_(b.signature, 'LB-receipt-' + Utilities.formatDate(now, dbTz_(), 'yyyy-MM-dd') + '-' +
                         who.name.replace(/[^A-Za-z]/g, ''), DB.MAX_SIG_KB);
  var note = dbClean_(b.note, 300);
  lbSet_(rows, {
    'Status': 'Received', 'Received At': now, 'Received By': who.name, 'Receipt Signature': sig,
    'Department': function (r) { return changes[r.id] || r.department; },
    'Routing Changed': function (r) {
      return changes[r.id] && changes[r.id] !== r.department ? r.department + ' → ' + changes[r.id] + ' by ' + who.name : r.routingChanged;
    },
    'Flags': function (r) { return note ? lbAddFlag_(r.flags, 'At receipt: ' + note) : r.flags; },
  });
  CacheService.getScriptCache().remove('lb_routing');
  return { ok: true, received: rows.length, at: now.toISOString() };
}

/** The papers go back to the agent: incomplete, unsigned, the wrong form. */
function lbReturn_(b, who) {
  var rows = lbPick_(b.ids, ['Logged', 'Received']);
  var reason = dbClean_(b.reason, 300);
  if (!reason) throw new Error('Say why they are going back.');
  var now = new Date();
  lbSet_(rows, { 'Status': 'Returned', 'Returned At': now, 'Returned By': who.name, 'Return Reason': reason });
  var byAgent = {};
  rows.forEach(function (r) { (byAgent[r.agentEmail || r.agent] = byAgent[r.agentEmail || r.agent] || []).push(r); });
  Object.keys(byAgent).forEach(function (k) {
    var list = byAgent[k];
    var html = lbMailHtml_('Documents returned to you',
      '<p>' + dbEsc_(who.name) + ' has returned these to you: <b>' + dbEsc_(reason) + '</b></p><p>Put them right and log them again.</p>',
      ['Client', 'Document', 'Policy'], list.map(function (r) { return [r.client, r.document, r.policy || '—']; }), '');
    lbMail_({ to: [list[0].agentEmail], cc: [lbSalesSupport_()], subject: 'Log Book: documents returned (' + list[0].client + ')', html: html });
  });
  return { ok: true, returned: rows.length };
}

/** The staff member's reason a document has not gone, from the page or from
 *  the link in the chase. It stays on the line and prints on the transmittal. */
function lbReason_(b, who) {
  var rows = lbPick_(b.ids, ['Received', 'Logged']);
  var reason = dbClean_(b.reason, 300);
  if (reason.length < 4) throw new Error('Give the reason in a few words.');
  lbSaveReason_(rows, reason, who.name);
  return { ok: true, saved: rows.length };
}

function lbSaveReason_(rows, reason, by) {
  var now = new Date();
  var stamp = Utilities.formatDate(now, dbTz_(), 'd MMM');
  lbSet_(rows, {
    'Late Reason': function (r) { return r.reason ? r.reason + ' | ' + stamp + ': ' + reason : stamp + ': ' + reason; },
    'Reason At': now, 'Reason By': by,
  });
}


/* ============================== the transmittal ============================== */

function lbTransTab_() { return dbSheet_(LB.TABS.TRANS, LB_TRANS_COLUMNS); }

function lbTransRows_() {
  var sh = lbTransTab_();
  var hm = dbHeaderMap_(sh);
  var last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, hm.head.length).getValues().map(function (r, i) {
    var g = function (k) { return k in hm.map ? r[hm.map[k]] : ''; };
    return { row: i + 2, no: String(g('Transmittal')), department: String(g('Department')), attn: String(g('Attention')),
             sentAt: lbDate_(g('Sent At')), sentBy: String(g('Sent By')), lines: Number(g('Lines')) || 0,
             documents: Number(g('Documents')) || 0, tracking: String(g('Tracking #')), late: Number(g('Late Lines')) || 0,
             status: String(g('Status')), ids: String(g('Line Ids')).split(',').filter(String) };
  });
}

function lbTransPublic_(t) {
  return { no: t.no, department: t.department, attn: t.attn, sentAt: t.sentAt ? t.sentAt.toISOString() : '',
           sentBy: t.sentBy, lines: t.lines, documents: t.documents, tracking: t.tracking, late: t.late, status: t.status };
}

/** Builds the transmittal for one department from the lines received, stamps
 *  them sent, and hands back everything the page prints. A line received on an
 *  earlier day, or today past the cut-off, goes only with a reason. */
function lbTransmittal_(b, who) {
  var rows = lbPick_(b.ids, ['Received']);
  var dept = rows[0].department;
  if (rows.some(function (r) { return r.department !== dept; })) throw new Error('A transmittal is for one department. Choose lines for one.');
  var tracking = dbClean_(b.tracking, 40);
  if (dept === LB.OFT && !tracking) throw new Error('Enter the FedEx tracking number.');
  var now = new Date();
  var reasons = b.reasons || {};
  var need = rows.filter(function (r) {
    return lbIsLate_(r, now) && !lbReasonFresh_(r, now) && !dbClean_(reasons[r.id], 300);
  });
  if (need.length) {
    return { ok: true, needsReasons: need.map(function (r) { return { id: r.id, client: r.client, document: r.document,
      receivedAt: r.receivedAt.toISOString(), days: lbWorkDays_(r.receivedAt, now) }; }) };
  }
  rows.forEach(function (r) {
    var why = dbClean_(reasons[r.id], 300);
    if (why) lbSaveReason_([r], why, who.name);
  });
  LB_READ_ = null;

  var attnRow = lbDeptRows_().filter(function (d) { return d.name === dept; })[0];
  var attn = dbClean_(b.attn, 80) || (attnRow ? attnRow.attn : '');
  var sh = lbTransTab_();
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  var no;
  try {
    var day = Utilities.formatDate(now, dbTz_(), 'yyyy-MM-dd').replace(/-/g, '').slice(2);
    var n = lbTransRows_().filter(function (t) { return t.no.indexOf('TR-' + day + '-') === 0; }).length + 1;
    no = 'TR-' + day + '-' + (n < 10 ? '0' : '') + n;
    var ids = rows.map(function (r) { return r.id; });
    var late = rows.filter(function (r) { return lbIsLate_(r, now); }).length;
    sh.appendRow(dbRowFor_(sh, { 'Transmittal': no, 'Department': dept, 'Attention': attn, 'Sent At': now, 'Sent By': who.name,
      'Lines': rows.length, 'Documents': rows.reduce(function (s, r) { return s + r.quantity; }, 0), 'Tracking #': tracking,
      'Late Lines': late, 'Status': 'Sent', 'Line Ids': ids.join(',') }));
    var fresh = lbRows_().filter(function (r) { return ids.indexOf(r.id) >= 0; });
    lbSet_(fresh, { 'Status': 'Sent', 'Transmittal': no, 'Sent At': now, 'Sent By': who.name, 'Tracking #': tracking });
  } finally { lock.releaseLock(); }
  CacheService.getScriptCache().remove('lb_routing');
  return lbTransmittalPrint_(no);
}

/* Everything one transmittal prints, from the sheet, so a reprint is the same
   page as the first. */
function lbTransmittalPrint_(no) {
  var t = lbTransRows_().filter(function (x) { return x.no === no; })[0];
  if (!t) throw new Error('No such transmittal.');
  var now = new Date();
  var lines = lbRows_().filter(function (r) { return r.transmittal === no || (t.status === 'Cancelled' && t.ids.indexOf(r.id) >= 0); })
    .sort(function (a, c) { return (a.receivedAt || 0) - (c.receivedAt || 0) || (a.ref < c.ref ? -1 : 1) || a.line - c.line; })
    .map(function (r) {
      var o = lbPublic_(r, now, true);
      o.sameDay = r.receivedAt && r.sentAt ? lbDay_(r.receivedAt) === lbDay_(r.sentAt) : null;
      o.daysToSend = r.receivedAt && r.sentAt ? lbWorkDays_(r.receivedAt, r.sentAt) : null;
      return o;
    });
  return { ok: true, transmittal: lbTransPublic_(t), lines: lines, from: LB.FROM, branch: LB.BRANCH_LINE };
}

function lbTransmittals_(b, who) {
  if (b.no) return lbTransmittalPrint_(dbClean_(b.no, 20));
  var days = Math.max(1, Math.min(400, parseInt(b.days, 10) || 30));
  var since = new Date(Date.now() - days * 86400000);
  return { ok: true, transmittals: lbTransRows_().filter(function (t) { return t.sentAt && t.sentAt >= since; })
    .map(lbTransPublic_).sort(function (a, c) { return a.sentAt < c.sentAt ? 1 : -1; }) };
}

/* A transmittal printed in error can be taken back the same day, by the
   person who sent it or the branch manager. The lines go back to received. */
function lbUnsend_(b, who) {
  var no = dbClean_(b.no, 20);
  var t = lbTransRows_().filter(function (x) { return x.no === no; })[0];
  if (!t || t.status === 'Cancelled') throw new Error('No such transmittal.');
  if (lbDay_(t.sentAt) !== lbDay_(new Date())) throw new Error('Only today\'s transmittals can be taken back.');
  if (t.sentBy !== who.name && !who.isManager) throw new Error('Only ' + t.sentBy + ' or the branch manager can take this back.');
  var rows = lbRows_().filter(function (r) { return r.transmittal === no; });
  lbSet_(rows, { 'Status': 'Received', 'Transmittal': '', 'Sent At': '', 'Sent By': '', 'Tracking #': '' });
  var sh = lbTransTab_(), hm = dbHeaderMap_(sh);
  sh.getRange(t.row, hm.map['Status'] + 1).setValue('Cancelled by ' + who.name);
  return { ok: true, back: rows.length };
}


/* ============================== contracts with the agent ============================== */

/* A contract is delivered when the Delivery Book has a Policy Contract handed
   over on that policy since it was collected. Same spreadsheet, so no call. */
function lbContractsClose_(open) {
  if (!open.length) return;
  var ss = SpreadsheetApp.getActive();
  var sh = ss.getSheetByName(DB.TABS.DELIV);
  if (!sh || sh.getLastRow() < 2) return;
  var hm = dbHeaderMap_(sh);
  if (!('Policy #' in hm.map) || !('Document' in hm.map)) return;
  var vals = sh.getRange(2, 1, sh.getLastRow() - 1, hm.head.length).getValues();
  var by = {};
  vals.forEach(function (r) {
    if (String(r[hm.map['Document']]) !== 'Policy Contract') return;
    var when = r[hm.map['Delivered At']];
    if (!(when instanceof Date)) return;
    var k = dbKey_(r[hm.map['Policy #']]);
    if (!by[k] || when > by[k]) by[k] = when;
  });
  open.forEach(function (r) {
    var when = by[dbKey_(r.policy)];
    if (when && r.loggedAt && when >= new Date(r.loggedAt.getTime() - 3600000)) {
      lbSet_([r], { 'Status': 'Delivered', 'Delivered At': when });
      r.status = 'Delivered'; r.deliveredAt = when;
    }
  });
}

function lbDelivered_(b, who) {
  var rows = lbPick_(b.ids, ['With agent']);
  var when = b.at ? new Date(b.at) : new Date();
  if (isNaN(when.getTime()) || when > new Date(Date.now() + 600000)) throw new Error('That date is not right.');
  lbSet_(rows, { 'Status': 'Delivered', 'Delivered At': when,
                 'Flags': function (r) { return lbAddFlag_(r.flags, 'Marked delivered by ' + who.name); } });
  return { ok: true };
}


/* ============================== the chase ============================== */

/** Every hour on a working day (lbSetup installs it). Three things:
 *   - received and not sent past the rule, with no fresh reason: the person
 *     who received it is asked why, sales support and the agent copied, once a
 *     working day per line, until it goes;
 *   - logged and not handed in: the agent is reminded on working days 1 and 3;
 *   - a contract with the agent: reminded at day 15 and 18, and the branch
 *     manager told at day 20 and after, once a day. */
function lbHourly() {
  var now = new Date();
  if (lbWeekend_(now)) return 'weekend';
  var h = lbHour_(now);
  if (h < 8 || h > 19) return 'out of hours';
  LB_READ_ = null;
  var out = [];
  out.push(lbChaseLate_(now));
  if (h >= 9) { out.push(lbNudgeAgents_(now)); out.push(lbChaseContracts_(now)); }
  return out.join('; ');
}

function lbAlerted_(r, key) { return r.alerts.indexOf(key) >= 0; }
function lbMarkAlert_(rows, key) {
  lbSet_(rows, { 'Alerts': function (r) { return r.alerts ? r.alerts + '; ' + key : key; } });
}

function lbChaseLate_(now) {
  var today = lbDay_(now);
  var due = lbRows_().filter(function (r) {
    return r.source !== 'Imported' && lbIsLate_(r, now) && !lbReasonFresh_(r, now) && !lbAlerted_(r, 'asked ' + today);
  });
  if (!due.length) return 'late: none';
  var groups = {};
  due.forEach(function (r) {
    var k = r.receivedBy + '|' + (r.agentEmail || r.agent);
    (groups[k] = groups[k] || []).push(r);
  });
  var sent = 0;
  Object.keys(groups).forEach(function (k) {
    var list = groups[k];
    var staff = list[0].receivedBy;
    var staffMail = lbStaffEmail_(staff);
    var link = lbReasonLink_(list.map(function (r) { return r.id; }));
    var rows = list.map(function (r) {
      return [r.client, r.document + (r.quantity > 1 ? ' × ' + r.quantity : ''), r.policy || '—', r.department,
              Utilities.formatDate(r.receivedAt, dbTz_(), 'EEE d MMM, h:mm a'), String(lbWorkDays_(r.receivedAt, now))];
    });
    var html = lbMailHtml_('Received and not sent: the reason, please',
      '<p>' + dbEsc_(staff.split(' ')[0] || staff) + ', the documents below were received and have not gone to Guardian Life. ' +
      'The branch standard is the same working day. The transmittal prints the date collected and the date sent, and the reason beside them.</p>' +
      (link ? '<p style="margin:18px 0"><a href="' + dbEsc_(link) + '" style="background:#07131f;color:#efc24b;padding:12px 18px;border-radius:10px;text-decoration:none;font-weight:bold">Give the reason</a></p>' : '') +
      '<p style="color:#5b6b7f;font-size:13px">Or send them on today\'s transmittal from the Log Book. You will be asked again each working day until they go or a reason is given.</p>',
      ['Client', 'Document', 'Policy', 'Department', 'Received', 'Working days'], rows,
      '<p style="color:#5b6b7f;font-size:13px">Agent: ' + dbEsc_(list[0].agent) + '. Sales support and the agent are copied.</p>');
    var res = lbMail_({ to: [staffMail || lbSalesSupport_()], cc: [lbSalesSupport_(), list[0].agentEmail],
                        subject: 'Reason needed: ' + list.length + ' document' + (list.length > 1 ? 's' : '') + ' received and not sent (' + list[0].client + (list.length > 1 && list.some(function (r) { return r.client !== list[0].client; }) ? ' and others' : '') + ')',
                        html: html });
    if (/sent/i.test(res)) { lbMarkAlert_(list, 'asked ' + today); sent++; }
  });
  return 'late: ' + due.length + ' lines, ' + sent + ' e-mails';
}

function lbNudgeAgents_(now) {
  var today = lbDay_(now);
  var due = lbRows_().filter(function (r) {
    if (r.source === 'Imported' || r.status !== 'Logged' || !r.loggedAt || !r.agentEmail) return false;
    var d = lbWorkDays_(r.loggedAt, now);
    return LB.NUDGE_DAYS.indexOf(d) >= 0 && !lbAlerted_(r, 'nudged ' + today);
  });
  var byAgent = {};
  due.forEach(function (r) { (byAgent[r.agentEmail] = byAgent[r.agentEmail] || []).push(r); });
  Object.keys(byAgent).forEach(function (k) {
    var list = byAgent[k];
    var html = lbMailHtml_('Logged, not yet with the branch',
      '<p>You logged these and the branch has not received the papers. Hand them in today, or withdraw the entry in the Log Book if they are not coming.</p>',
      ['Reference', 'Client', 'Document', 'Logged'],
      list.map(function (r) { return [r.ref, r.client, r.document, Utilities.formatDate(r.loggedAt, dbTz_(), 'EEE d MMM')]; }), '');
    var res = lbMail_({ to: [k], cc: [lbSalesSupport_()], subject: 'Log Book: papers not yet handed in (' + list.length + ')', html: html });
    if (/sent/i.test(res)) lbMarkAlert_(list, 'nudged ' + today);
  });
  return 'nudged: ' + Object.keys(byAgent).length;
}

function lbChaseContracts_(now) {
  var today = lbDay_(now);
  var open = lbRows_().filter(function (r) { return r.status === 'With agent' && r.loggedAt; });
  lbContractsClose_(open);
  open = open.filter(function (r) { return r.status === 'With agent'; });
  var n = 0;
  open.forEach(function (r) {
    var day = lbCalDays_(r.loggedAt, now);
    var key, manager = false;
    if (day >= LB.CONTRACT_DAYS) { key = 'breach ' + today; manager = true; }
    else if (LB.CONTRACT_WARN.indexOf(day) >= 0) key = 'day ' + day;
    else return;
    if (lbAlerted_(r, key)) return;
    var due = Utilities.formatDate(new Date(r.loggedAt.getTime() + LB.CONTRACT_DAYS * 86400000), dbTz_(), 'EEEE d MMMM');
    var html = lbMailHtml_(manager ? 'Contract past the 20 days' : 'Contract to deliver: day ' + day,
      '<p>' + dbEsc_(manager
        ? r.agent + ' collected this contract ' + day + ' days ago and no delivery is recorded. The Act allows 20 days.'
        : 'This contract is due to the client by ' + due + '. Record the handover in the Delivery Book when it is done.') + '</p>',
      ['Client', 'Policy', 'Collected', 'Day'],
      [[r.client, r.policy || '—', Utilities.formatDate(r.loggedAt, dbTz_(), 'EEE d MMM'), String(day)]], '');
    var to = manager ? [dbProp_('LB_MANAGER', LB.MANAGER)] : [r.agentEmail || lbSalesSupport_()];
    var cc = manager ? [lbSalesSupport_(), r.agentEmail] : [lbSalesSupport_()];
    var res = lbMail_({ to: to, cc: cc, subject: (manager ? 'Past 20 days: ' : 'Contract due ' + due + ': ') + r.client + ' (' + (r.policy || r.ref) + ')', html: html });
    if (/sent/i.test(res)) { lbMarkAlert_([r], key); n++; }
  });
  return 'contracts: ' + n;
}


/* ============================== the reason link ============================== */

function lbSignIds_(ids) {
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature('lbr|' + ids, dbSecret_())).replace(/=+$/, '').slice(0, 22);
}
function lbReasonLink_(ids) {
  var u = dbExecUrl_();
  var s = ids.join(',');
  return u ? u + '?lbr=' + encodeURIComponent(s) + '&k=' + lbSignIds_(s) : '';
}

/* Called by DeliveryBook.gs's doGet for "?lbr=". The link names the lines and
   is signed, so it cannot be edited into someone else's. */
function lbReasonPage_(p) {
  LB_READ_ = null;
  var ids = String(p.lbr || '').slice(0, 2000);
  if (!ids || String(p.k || '') !== lbSignIds_(ids)) return dbHtml_('<h1>This link has expired</h1><p>Give the reason in the Log Book instead.</p>');
  var want = ids.split(',');
  var rows = lbRows_().filter(function (r) { return want.indexOf(r.id) >= 0; });
  var open = rows.filter(function (r) { return r.status === 'Received' || r.status === 'Logged'; });
  var list = '<ul style="padding-left:18px">' + rows.map(function (r) {
    return '<li>' + dbEsc_(r.document) + ' · ' + dbEsc_(r.client) + ' <span class="muted">(' + dbEsc_(r.status.toLowerCase()) + ')</span></li>';
  }).join('') + '</ul>';
  if (!open.length) return dbHtml_('<h1>Nothing to explain</h1><p>These have gone on a transmittal or are no longer waiting.</p>' + list);
  var text = p.reason != null ? dbClean_(p.reason, 300) : null;
  if (text != null && text.length >= 4) {
    lbSaveReason_(open, text, open[0].receivedBy || 'by e-mail link');
    return dbHtml_('<h1>Thank you</h1><p>The reason is on the line and will print on the transmittal.</p>' + list);
  }
  var exec = dbExecUrl_();
  return dbHtml_('<h1>Why have these not gone?</h1>' + list +
    '<form method="get" action="' + dbEsc_(exec) + '" target="_top">' +
    '<input type="hidden" name="lbr" value="' + dbEsc_(ids) + '"><input type="hidden" name="k" value="' + dbEsc_(String(p.k)) + '">' +
    '<textarea name="reason" maxlength="300" required minlength="4" placeholder="e.g. Waiting on the client\'s ID; mailbag missed"></textarea>' +
    (text != null ? '<p style="color:#c0392b;font-size:13px">A few words, please.</p>' : '') +
    '<button type="submit">Save the reason</button></form>');
}


/* ============================== mail ============================== */

function lbSalesSupport_() { return dbProp_('LB_SALES_SUPPORT', LB.SALES_SUPPORT); }

/* Every Log Book e-mail is internal: to staff, agents, sales support and the
   manager, never a client. In test mode it goes to the test inbox with a
   banner naming who it was for. */
function lbMail_(m) {
  var clean = function (l) {
    var seen = {};
    return (l || []).map(function (x) { return String(x || '').trim(); })
      .filter(function (x) { var k = x.toLowerCase(); if (!/@/.test(x) || seen[k]) return false; seen[k] = 1; return true; });
  };
  var to = clean(m.to), cc = clean(m.cc).filter(function (x) { return to.map(function (t) { return t.toLowerCase(); }).indexOf(x.toLowerCase()) < 0; });
  if (!to.length) return 'No address';
  var html = m.html, subject = m.subject;
  if (dbMode_() !== 'live') {
    html = '<div style="background:#fff4d6;border:1px solid #efc24b;padding:10px 14px;font-family:Arial;font-size:13px">' +
      'TEST — in live mode this would go to <b>' + dbEsc_(to.join(', ')) + '</b>' + (cc.length ? ', copied to ' + dbEsc_(cc.join(', ')) : '') + '.</div>' + html;
    to = [dbProp_('DB_TEST_INBOX') || Session.getEffectiveUser().getEmail()];
    cc = [];
    subject = '[TEST] ' + subject;
  }
  try {
    if (MailApp.getRemainingDailyQuota && MailApp.getRemainingDailyQuota() < 1 + cc.length) return 'Held: daily mail limit reached';
    var o = { to: to.join(','), subject: subject, htmlBody: html, name: DB.BRAND + ' Log Book', replyTo: lbSalesSupport_() };
    if (cc.length) o.cc = cc.join(',');
    MailApp.sendEmail(o);
    return dbMode_() === 'live' ? 'Sent' : 'Test copy sent';
  } catch (e) { return 'Failed: ' + e.message; }
}

function lbMailHtml_(title, intro, head, rows, foot) {
  var th = head.map(function (h) { return '<th align="left" style="padding:7px 9px;font-size:12px;color:#5b6b7f">' + dbEsc_(h) + '</th>'; }).join('');
  var trs = rows.map(function (r) {
    return '<tr>' + r.map(function (c) { return '<td style="padding:7px 9px;border-top:1px solid #e6ebf1;font-size:13px">' + dbEsc_(c) + '</td>'; }).join('') + '</tr>';
  }).join('');
  return '<div style="background:#f3f5f8;padding:20px 10px;font-family:Arial,Helvetica,sans-serif;color:#13202e">' +
    '<div style="max-width:640px;margin:0 auto;background:#fff;border-radius:12px;overflow:hidden">' +
    '<div style="background:#07131f;padding:14px 18px"><img src="' + DB.LOGO + '" width="34" height="34" alt="" style="vertical-align:middle;border-radius:8px">' +
    '<span style="color:#efc24b;font-weight:bold;font-size:15px;margin-left:10px;vertical-align:middle">Log Book</span></div>' +
    '<div style="padding:18px;font-size:14px;line-height:1.55"><h2 style="font-size:17px;margin:0 0 10px">' + dbEsc_(title) + '</h2>' + intro +
    (rows.length ? '<table style="width:100%;border-collapse:collapse;margin:12px 0"><tr style="background:#f6f8fb">' + th + '</tr>' + trs + '</table>' : '') +
    (foot || '') + '</div>' +
    '<div style="padding:10px 18px;background:#f6f8fb;color:#5b6b7f;font-size:12px">Internal: for the branch team. Do not forward outside the branch.</div></div></div>';
}


/* ============================== insights ============================== */

/** The numbers the manager and staff read: turnaround, where the papers go,
 *  who is holding what, which documents come back, and how often the
 *  suggested department was right. Imported history counts (marked) unless
 *  the period starts after it. */
function lbStats_(b, who) {
  var days = Math.max(1, Math.min(800, parseInt(b.days, 10) || 30));
  var now = new Date(), since = new Date(now.getTime() - days * 86400000);
  var all = lbRows_();
  var rows = all.filter(function (r) { return r.loggedAt && r.loggedAt >= since && r.status !== 'Cancelled' && r.type === LB.TYPES[0]; });
  var sent = rows.filter(function (r) { return r.status === 'Sent' && r.receivedAt && r.sentAt; });
  var wd = sent.map(function (r) { return lbWorkDays_(r.receivedAt, r.sentAt); }).filter(function (x) { return x != null && x >= 0; });
  var pct = function (a, n) { return n ? Math.round(a * 1000 / n) / 10 : null; };
  var median = function (xs) { if (!xs.length) return null; var s = xs.slice().sort(function (a, c) { return a - c; }); var m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; };
  var hours = rows.filter(function (r) { return r.receivedAt && r.loggedAt && r.source !== 'Imported'; })
    .map(function (r) { return (r.receivedAt - r.loggedAt) / 3600000; }).filter(function (x) { return x >= 0; });

  var bucket = function (key) {
    var m = {};
    rows.forEach(function (r) {
      var k = key(r) || '(none)';
      var o = m[k] = m[k] || { name: k, lines: 0, docs: 0, sent: 0, sameDay: 0, within1: 0, late: 0, waiting: 0, returned: 0, changed: 0, noPolicy: 0 };
      o.lines++; o.docs += r.quantity;
      if (r.status === 'Sent' && r.receivedAt && r.sentAt) {
        o.sent++;
        var d = lbWorkDays_(r.receivedAt, r.sentAt);
        if (d === 0) o.sameDay++;
        if (d <= 1) o.within1++;
      }
      if (lbIsLate_(r, now)) o.late++;
      if (r.status === 'Received' || r.status === 'Logged') o.waiting++;
      if (r.status === 'Returned') o.returned++;
      if (r.routingChanged) o.changed++;
      if (!r.policy && LB.NO_POLICY.indexOf(r.document) < 0) o.noPolicy++;
    });
    return Object.keys(m).map(function (k) {
      var o = m[k]; o.sameDayPct = pct(o.sameDay, o.sent); o.within1Pct = pct(o.within1, o.sent); return o;
    }).sort(function (a, c) { return c.lines - a.lines; });
  };

  var daily = {};
  rows.forEach(function (r) {
    var k = lbDay_(r.loggedAt);
    var o = daily[k] = daily[k] || { day: k, logged: 0, sent: 0, sameDay: 0 };
    o.logged++;
  });
  sent.forEach(function (r) {
    var k = lbDay_(r.sentAt);
    if (!daily[k]) return;
    daily[k].sent++;
    if (lbDay_(r.receivedAt) === k) daily[k].sameDay++;
  });

  var suggested = rows.filter(function (r) { return r.suggested && r.source !== 'Imported'; });
  var backlog = all.filter(function (r) { return r.source !== 'Imported' && (r.status === 'Logged' || r.status === 'Received'); });
  var contracts = all.filter(function (r) { return r.type === LB.TYPES[1] && r.status !== 'Cancelled' && r.loggedAt && r.loggedAt >= since; });
  var reasons = {};
  rows.forEach(function (r) {
    if (!r.reason) return;
    r.reason.split(' | ').forEach(function (x) {
      var t = x.replace(/^\d{1,2} \w{3}: /, '').trim().toLowerCase();
      if (t) reasons[t] = (reasons[t] || 0) + 1;
    });
  });

  return {
    ok: true, days: days, since: since.toISOString(), now: now.toISOString(), cutoff: lbCutoff_(),
    imported: rows.filter(function (r) { return r.source === 'Imported'; }).length,
    totals: {
      lines: rows.length, documents: rows.reduce(function (s, r) { return s + r.quantity; }, 0),
      sent: sent.length, sameDay: wd.filter(function (x) { return x === 0; }).length,
      within1: wd.filter(function (x) { return x <= 1; }).length, over5: wd.filter(function (x) { return x > 5; }).length,
      sameDayPct: pct(wd.filter(function (x) { return x === 0; }).length, wd.length),
      within1Pct: pct(wd.filter(function (x) { return x <= 1; }).length, wd.length),
      medianHoursToReceive: hours.length ? Math.round(median(hours) * 10) / 10 : null,
      returned: rows.filter(function (r) { return r.status === 'Returned'; }).length,
      noSentDate: rows.filter(function (r) { return r.source === 'Imported' && r.status !== 'Sent'; }).length,
      noPolicy: rows.filter(function (r) { return !r.policy && LB.NO_POLICY.indexOf(r.document) < 0; }).length,
      suggestedRight: suggested.filter(function (r) { return r.department === r.suggested; }).length,
      suggestedAll: suggested.length,
    },
    backlog: {
      logged: backlog.filter(function (r) { return r.status === 'Logged'; }).length,
      received: backlog.filter(function (r) { return r.status === 'Received'; }).length,
      late: backlog.filter(function (r) { return lbIsLate_(r, now); }).length,
      lateNoReason: backlog.filter(function (r) { return lbIsLate_(r, now) && !lbReasonFresh_(r, now); }).length,
      oldestLoggedDays: backlog.filter(function (r) { return r.status === 'Logged'; })
        .reduce(function (m, r) { return Math.max(m, lbWorkDays_(r.loggedAt, now)); }, 0),
    },
    contracts: {
      open: contracts.filter(function (r) { return r.status === 'With agent'; }).length,
      due5: contracts.filter(function (r) { return r.status === 'With agent' && lbCalDays_(r.loggedAt, now) >= 15 && lbCalDays_(r.loggedAt, now) < 20; }).length,
      past: contracts.filter(function (r) { return r.status === 'With agent' && lbCalDays_(r.loggedAt, now) >= 20; }).length,
      delivered: contracts.filter(function (r) { return r.status === 'Delivered'; }).length,
      deliveredIn20: contracts.filter(function (r) { return r.status === 'Delivered' && r.deliveredAt && lbCalDays_(r.loggedAt, r.deliveredAt) <= 20; }).length,
    },
    byDepartment: bucket(function (r) { return r.department; }),
    byStaff: bucket(function (r) { return r.sentBy || r.receivedBy; }).filter(function (o) { return o.name !== '(none)'; }),
    byAgent: bucket(function (r) { return r.agent; }).slice(0, 40),
    byDocument: bucket(function (r) { return r.document; }).slice(0, 25),
    byWeekday: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'].map(function (n, i) {
      return { day: n, lines: rows.filter(function (r) { return new Date(lbDay_(r.loggedAt) + 'T12:00:00Z').getUTCDay() === i + 1; }).length };
    }),
    daily: Object.keys(daily).sort().map(function (k) { return daily[k]; }),
    reasons: Object.keys(reasons).map(function (k) { return { reason: k, n: reasons[k] }; })
      .sort(function (a, c) { return c.n - a.n; }).slice(0, 12),
  };
}


/* ============================== history ============================== */

/**
 * Copies the old Log Book Digital workbook's BU and MAIL PREP tabs in once
 * (LB_HISTORY_ID), so the insights start from the book's first page. Each old
 * line keeps its dates; its department and document are folded into the one
 * list. Marked "Imported": never chased, never on a transmittal, and not
 * counted twice in the routing (the history table above already holds them).
 * Safe to run again: a line already copied is skipped.
 */
function lbImportHistory() {
  var id = dbProp_('LB_HISTORY_ID');
  if (!id) return 'Set LB_HISTORY_ID to the Log Book Digital workbook first.';
  var book = SpreadsheetApp.openById(id);
  var sh = lbLinesTab_();
  var have = {};
  lbRows_().forEach(function (r) { if (r.source === 'Imported') have[r.id] = 1; });
  var out = [];
  var push = function (tab, i, o) {
    var lid = 'H-' + tab + '-' + i;
    if (have[lid]) return;
    var doc = lbCanonDoc_(o.doc) || 'Other';
    var dept = lbCanonDept_(o.route);
    var sub = lbDate_(o.sub), sentAt = lbParseDay_(o.sent);
    if (!sub) return;
    out.push(dbRowFor_(sh, {
      'Line Id': lid, 'Ref': 'H-' + tab, 'Line': i, 'Type': LB.TYPES[0], 'Status': sentAt ? 'Sent' : 'Not recorded',
      'Logged At': sub, 'Logged By': o.prepared || '', 'Agent': o.agent, 'Client': o.client, 'Policy #': o.policy,
      'Document': doc, 'Quantity': 1, 'Item Note': doc === 'Other' ? String(o.doc || '').slice(0, 120) : '',
      'Department': dept || String(o.route || '').trim().slice(0, 80),
      'Received At': sub, 'Received By': o.prepared || '', 'Sent At': sentAt || '', 'Sent By': o.prepared || '',
      'Source': 'Imported',
    }));
  };
  var bu = book.getSheetByName('BU');
  if (bu && bu.getLastRow() > 1) {
    var bh = dbHeaderMap_(bu);
    bu.getRange(2, 1, bu.getLastRow() - 1, bh.head.length).getValues().forEach(function (r, i) {
      if (!r[5] && !r[6]) return;
      push('BU', i + 2, { sub: r[0], agent: String(r[2] || '').trim(), client: String(r[3] || '').trim(),
        policy: String(r[4] || '').replace(/\.0$/, '').trim(), doc: r[5], route: r[6], prepared: String(r[7] || '').trim(), sent: r[8] });
    });
  }
  var mp = book.getSheetByName('MAIL PREP');
  if (mp && mp.getLastRow() > 1) {
    var mh = dbHeaderMap_(mp);
    var c = function (k) { return mh.map[k]; };
    var strip = function (v, lab) { return String(v || '').replace(new RegExp('^' + lab + '\\s*:\\s*', 'i'), '').trim(); };
    mp.getRange(2, 1, mp.getLastRow() - 1, mh.head.length).getValues().forEach(function (r, i) {
      var doc = r[c('Document')], route = r[c('Routing')];
      if (!doc && !route) return;
      push('MP', i + 2, { sub: r[c('Submitted Date')], agent: String(r[c('Agent Name/Email')] || '').trim(),
        client: strip(r[c('Client Name')], 'Client Name'), policy: strip(r[c('Policy #')], 'Policy\\s*#'),
        doc: strip(doc, 'Document'), route: strip(route, 'Routing'), prepared: String(r[c('Sent by Whom')] || '').trim(), sent: r[c('Date Sent')] });
    });
  }
  if (out.length) {
    for (var i = 0; i < out.length; i += 500) {
      var part = out.slice(i, i + 500);
      sh.getRange(sh.getLastRow() + 1, 1, part.length, part[0].length).setValues(part);
    }
  }
  LB_READ_ = null;
  return 'Imported ' + out.length + ' lines from the old Log Book.';
}

/* "23/03/2026", a Date, or "2026-03-23". Day first, as the branch writes it. */
function lbParseDay_(v) {
  if (v instanceof Date) return isNaN(v.getTime()) ? null : v;
  var s = String(v || '').trim();
  var m = s.match(/^(\d{1,2})[\/.-](\d{1,2})[\/.-](\d{2,4})$/);
  if (m) { var y = Number(m[3]); if (y < 100) y += 2000; return new Date(y, Number(m[2]) - 1, Number(m[1]), 12); }
  m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]), 12) : null;
}


/* ============================== setup ============================== */

/** Makes the tabs, fills the Departments tab once from the history, installs
 *  the hourly chase, and says what is still missing. Run from the editor or
 *  the RR Operations menu. */
function lbSetup() {
  lbLinesTab_(); lbTransTab_();
  dbSheet_(LB.TABS.AGENTS, LB_AGENT_COLUMNS);
  var dsh = dbSheet_(LB.TABS.DEPTS, LB_DEPT_COLUMNS);
  if (dsh.getLastRow() < 2) {
    var rows = LB_DEPTS.map(function (d) { return [d[0], '', 'Yes']; });
    dsh.getRange(2, 1, rows.length, 3).setValues(rows);
  }
  var have = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'lbHourly'; });
  if (!have) ScriptApp.newTrigger('lbHourly').timeBased().everyHours(1).create();
  var agents = lbAgents_();
  var notes = [
    'Mode: ' + dbMode_() + (dbMode_() === 'live' ? '' : ' (every Log Book e-mail goes to ' + (dbProp_('DB_TEST_INBOX') || 'the script owner') + ')'),
    'Hourly chase: ' + (have ? 'already on' : 'installed'),
    'Late after: ' + lbCutoff_() + ':00 on the day received',
    'People who can sign in: ' + agents.filter(function (a) { return a.active && a.code; }).length +
      ' (the Agents tab and the fact find\'s Access tab' + (agents.length ? '' : ': none found, check the script owner can open the fact find workbook') + ')',
    'Departments: ' + lbDeptNames_().length,
    'Reason links: ' + (dbExecUrl_() ? 'on' : 'off until the web app is deployed'),
    'History: ' + (dbProp_('LB_HISTORY_ID') ? 'run lbImportHistory() once' : 'set LB_HISTORY_ID, then run lbImportHistory()'),
  ];
  var msg = notes.join('\n');
  try { SpreadsheetApp.getUi().alert('Log Book\n\n' + msg); } catch (e) {}
  return msg;
}
