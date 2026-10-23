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
 * The bag (17 October 2026): one bag a day, in and out at the bag exchange at
 * 1:00 pm (LB.BAG.AT). It comes in, is cleared and the mail distributed, and
 * goes back down with the day's transmittals. Papers in the branch's hands
 * before 12:00 noon (LB.BAG.CUTOFF) are checked, put on a transmittal and go
 * on that day's bag; anything after 12:00, or on a weekend, goes on the next
 * working day's bag. One staff member has the bag each week (the Bag Rota
 * tab, else the staff in turn). At 11:00 an agent with papers logged and not
 * handed in is told there is an hour to catch the bag; at 12:00 the person on
 * the bag gets the list to prepare; and once the bag has gone, every received
 * line that missed it is asked about, while everyone is still in (the staff
 * leave from 2:00 pm), with sales support and the agent copied. The reason is
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
 *   LB_BAG_CUTOFF      the hour papers must be in to catch that day's bag (12).
 *   LB_BAG_HOUR        the hour of the bag exchange (13).
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
  CUTOFF_HOUR: 12,
  BAG: { CUTOFF: 12, AT: 13, NUDGE: 11, GRACE_MIN: 60, ROTA_FROM: '2026-10-19',
         /* The branch's rota (17 October 2026): the three who do transmittals, one week each, Azariah first
            from 19 October. Kamla does not do transmittals and is never on it. A Bag Rota tab overrides this.
            Elizabeth goes home at 4 from 23 October 2026 (her day is now 8 to 4). */
         ROTA: [{ who: 'Azariah', leaves: '4:00 pm' }, { who: 'Elizabeth', also: 'Liz', leaves: '4:00 pm' }, { who: 'Sasha', leaves: '2:00 pm' }] },
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
  CONFIRM_DAYS: 3,
  COMPANION_PCT: 70,              // a document that travels with another this often is asked about when missing
  DIGEST_HOUR: 17,                // the branch manager's daily digest
  NEVER_IN_DAYS: 3,               // logged and not handed in after this many working days: counted against the agent                // working days after a transmittal, the department is asked "did you get it"
  SUPPORT_FROM: 'support@rickyrampersadbranch.com',
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
  'Alerts', 'Flags', 'Source', 'Salesforce Task',
];
var LB_TRANS_COLUMNS = ['Transmittal', 'Department', 'Attention', 'Sent At', 'Sent By', 'Lines', 'Documents',
                        'Tracking #', 'Late Lines', 'Status', 'Line Ids',
                        'Confirm Sent At', 'Received By Dept', 'Answered At', 'Dept Note', 'Follow-up'];
var LB_AGENT_COLUMNS = ['Agent No', 'Name', 'Email', 'Unit', 'Code', 'Active'];
var LB_DEPT_COLUMNS = ['Department', 'Attention', 'Email', 'Active'];
var LB_ROTA_COLUMNS = ['Staff', 'Order', 'Leaves At', 'Active'];
var LB_BAGLOG_COLUMNS = ['Day', 'On The Bag', 'Bag In At', 'In By', 'Distributed', 'Bag Out At', 'Out By',
                         'Transmittals', 'Documents', 'Missed', 'Note'];

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
      if (name && act !== 'no' && act !== 'false') out.push({ name: name, attn: 'Attention' in hm.map ? String(r[hm.map['Attention']] || '').trim() : '',
                                                             email: 'Email' in hm.map ? String(r[hm.map['Email']] || '').trim() : '' });
    });
  }
  if (!out.length) out = LB_DEPTS.map(function (d) { return { name: d[0], attn: '', email: '' }; });
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
      policy: String(g(r, 'Policy #')), recordType: String(g(r, 'Record Type')), plan: String(g(r, 'Plan')), portfolioId: String(g(r, 'Portfolio Id')),
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
      sfTask: String(g(r, 'Salesforce Task')),
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
function lbHourProp_(name, def, lo, hi) {
  var h = parseInt(dbProp_(name, def), 10);
  return isFinite(h) && h >= lo && h <= hi ? h : def;
}
/* The hour papers must be in to catch that day's bag. */
var LB_HOURS_ = null;
function lbCutoff_() {
  if (!LB_HOURS_) LB_HOURS_ = { cut: lbHourProp_('LB_BAG_CUTOFF', LB.BAG.CUTOFF, 8, 16), at: lbHourProp_('LB_BAG_HOUR', LB.BAG.AT, 9, 17) };
  return LB_HOURS_.cut;
}
/* The hour of the bag exchange. */
function lbBagHour_() { lbCutoff_(); return Math.max(LB_HOURS_.cut + 1, LB_HOURS_.at); }

/* ============================== the bag ============================== */

function lbIsWorkDay_(day) { var w = new Date(day + 'T12:00:00Z').getUTCDay(); return w !== 0 && w !== 6; }
function lbNextWorkDay_(day) {
  var x = new Date(day + 'T12:00:00Z');
  do { x = new Date(x.getTime() + 86400000); } while (x.getUTCDay() === 0 || x.getUTCDay() === 6);
  return Utilities.formatDate(x, 'UTC', 'yyyy-MM-dd');
}
/* A moment on a day, in the branch's time. */
function lbAt_(day, hour, min) {
  return Utilities.parseDate(day + ' ' + (hour < 10 ? '0' : '') + hour + ':' + (min < 10 ? '0' : '') + (min || 0), dbTz_(), 'yyyy-MM-dd HH:mm');
}
/* The bag that papers in the branch's hands at t catch: that day's when it is
   a working day before the cut-off, else the next working day's. */
function lbBagDay_(t) {
  var day = lbDay_(t);
  return lbIsWorkDay_(day) && lbHour_(t) < lbCutoff_() ? day : lbNextWorkDay_(day);
}
function lbBagTime_(day) { return lbAt_(day, lbBagHour_(), 0); }
/* A sent line made its bag when its transmittal was done by the bag (with
   LB.BAG.GRACE_MIN of slack). The old book kept only the date sent, so for an
   imported line the day is enough. */
function lbOnBag_(r) {
  if (!r.sentAt || !r.receivedAt) return null;
  var bag = lbBagDay_(r.receivedAt), sd = lbDay_(r.sentAt);
  var dateOnly = Utilities.formatDate(r.sentAt, dbTz_(), 'HH:mm') === '00:00';
  if (sd < bag) return true;
  if (sd > bag) return false;
  return dateOnly || r.sentAt.getTime() <= lbBagTime_(bag).getTime() + LB.BAG.GRACE_MIN * 60000;
}
/* Bags missed: 0 when it is on its bag, 1 when it went on the next one, and so on. */
function lbBagsLate_(r) {
  if (!r.sentAt || !r.receivedAt) return null;
  if (lbOnBag_(r)) return 0;
  var n = lbWorkDays_(lbAt_(lbBagDay_(r.receivedAt), 12, 0), r.sentAt);
  return Math.max(1, n);
}

/* Received and not sent once its bag has gone. */
function lbIsLate_(r, now) {
  if (r.status !== 'Received' || !r.receivedAt) return false;
  return now.getTime() >= lbBagTime_(lbBagDay_(r.receivedAt)).getTime();
}

/* Who has the bag this week: the Bag Rota tab in its order, else LB.BAG.ROTA
   (Azariah, Elizabeth, Sasha), one week each from LB.BAG.ROTA_FROM.
   "Leaves At" is the hour they go home. */
function lbRota_() {
  var sh = dbSheet_('Bag Rota', LB_ROTA_COLUMNS);
  var hm = dbHeaderMap_(sh), last = sh.getLastRow(), out = [];
  if (last > 1) sh.getRange(2, 1, last - 1, hm.head.length).getValues().forEach(function (r, i) {
    var name = String(r[hm.map['Staff']] || '').trim();
    if (!name || /^(no|false|not active)/i.test(String(r[hm.map['Active']] || ''))) return;
    out.push({ name: name, order: Number(r[hm.map['Order']]) || i + 1, leaves: lbLeaves_(r[hm.map['Leaves At']]) });
  });
  if (out.length) return out.sort(function (a, b) { return a.order - b.order; });
  /* No tab: LB.BAG.ROTA, each first name read as the full name on the sign-in list (so the e-mail finds them). */
  var staff = lbAgents_().filter(function (a) { return a.active && lbIsStaffRole_(a.role); });
  return LB.BAG.ROTA.map(function (r, i) {
    var first = function (n) { return String(n || '').trim().split(/\s+/)[0].toLowerCase(); };
    var hit = staff.filter(function (a) { var f = first(a.name); return f === r.who.toLowerCase() || (r.also && f === r.also.toLowerCase()); })[0];
    return { name: hit ? lbTitle_(hit.name) : r.who, order: i + 1, leaves: r.leaves };
  });
}
function lbLeaves_(v) {
  if (v instanceof Date) return Utilities.formatDate(v, dbTz_(), 'h:mm a');
  var s = String(v || '').trim();
  if (/^\d{1,2}$/.test(s)) { var h = Number(s); return (h > 12 ? h - 12 : h) + ':00 ' + (h >= 12 || h < 7 ? 'pm' : 'am'); }
  return s;
}
function lbTitle_(n) { return String(n || '').toLowerCase().replace(/\b[a-z]/g, function (c) { return c.toUpperCase(); }); }
function lbDuty_(day) {
  var rota = lbRota_();
  if (!rota.length) return null;
  var mon = function (d) { var x = new Date(d + 'T12:00:00Z'); var w = (x.getUTCDay() + 6) % 7; return new Date(x.getTime() - w * 86400000); };
  var weeks = Math.round((mon(day) - mon(LB.BAG.ROTA_FROM)) / (7 * 86400000));
  var i = ((weeks % rota.length) + rota.length) % rota.length;
  return { name: rota[i].name, leaves: rota[i].leaves, next: rota[(i + 1) % rota.length].name, week: Utilities.formatDate(mon(day), 'UTC', 'd MMM') };
}
function lbBagLogTab_() { return dbSheet_('Bag Log', LB_BAGLOG_COLUMNS); }
function lbBagLog_(day) {
  var sh = lbBagLogTab_(), hm = dbHeaderMap_(sh), last = sh.getLastRow();
  if (last < 2) return null;
  var vals = sh.getRange(2, 1, last - 1, hm.head.length).getValues();
  for (var i = vals.length - 1; i >= 0; i--) {
    var d = vals[i][hm.map['Day']];
    if ((d instanceof Date ? lbDay_(d) : String(d)) === day) {
      var g = function (c) { var v = vals[i][hm.map[c]]; return v instanceof Date ? v.toISOString() : v; };
      return { row: i + 2, inAt: g('Bag In At'), inBy: g('In By'), distributed: g('Distributed'), outAt: g('Bag Out At'), outBy: g('Out By'),
               transmittals: g('Transmittals'), documents: g('Documents'), missed: g('Missed'), note: g('Note') };
    }
  }
  return null;
}

/** Everything a screen needs about the bag, now. */
function lbBagInfo_(now) {
  var today = lbDay_(now), cut = lbCutoff_(), at = lbBagHour_();
  var work = lbIsWorkDay_(today);
  var next = lbBagDay_(now);
  var duty = lbDuty_(work ? today : next);
  var o = {
    cutoff: cut, at: at, today: today, workDay: work,
    open: next === today,
    bagDay: next, bagDayLabel: Utilities.formatDate(lbAt_(next, 12, 0), dbTz_(), 'EEEE d MMMM'),
    closesAt: lbAt_(next, cut, 0).toISOString(), bagAt: lbBagTime_(next).toISOString(),
    todayBagAt: work ? lbBagTime_(today).toISOString() : '',
    gone: work && now.getTime() >= lbBagTime_(today).getTime(),
    duty: duty, rota: lbRota_().map(function (r) { return { name: r.name, leaves: r.leaves }; }),
  };
  try { o.log = work ? lbBagLog_(today) : null; } catch (e) { o.log = null; }
  return o;
}

/** Staff: the bag came in (cleared and the mail given out), or went out. */
function lbBag_(b, who) {
  var now = new Date(), today = lbDay_(now);
  var step = String(b.step || '');
  if (['in', 'out'].indexOf(step) < 0) throw new Error('Bag in or bag out?');
  var sh = lbBagLogTab_();
  var lock = LockService.getScriptLock(); lock.waitLock(20000);
  try {
    var log = lbBagLog_(today);
    var duty = lbDuty_(today);
    if (!log) {
      sh.appendRow(dbRowFor_(sh, { 'Day': today, 'On The Bag': duty ? duty.name : '' }));
      log = lbBagLog_(today);
    }
    var hm = dbHeaderMap_(sh);
    var set = function (c, v) { sh.getRange(log.row, hm.map[c] + 1).setValue(v); };
    var note = dbClean_(b.note, 300);
    if (step === 'in') {
      set('Bag In At', now); set('In By', who.name); set('Distributed', b.distributed === false ? 'Not yet' : 'Yes');
    } else {
      var trans = lbTransRows_().filter(function (t) { return t.sentAt && lbDay_(t.sentAt) === today && t.status !== 'Cancelled'; });
      var missed = lbRows_().filter(function (r) { return r.source !== 'Imported' && r.status === 'Received' && r.receivedAt && lbBagDay_(r.receivedAt) <= today; });
      set('Bag Out At', now); set('Out By', who.name); set('Transmittals', trans.length);
      set('Documents', trans.reduce(function (s, t) { return s + (Number(t.documents) || 0); }, 0)); set('Missed', missed.length);
    }
    if (note) set('Note', (log.note ? log.note + ' | ' : '') + Utilities.formatDate(now, dbTz_(), 'h:mm a') + ' ' + who.name + ': ' + note);
  } finally { lock.releaseLock(); }
  return { ok: true, bag: lbBagInfo_(now) };
}

/* One line's place against the bag, for the screens. */
function lbBagOf_(r, now) {
  if (r.type !== LB.TYPES[0]) return null;
  if (r.status === 'Logged') {
    var d = lbBagDay_(now);
    return { state: 'waiting', bagDay: d, label: d === lbDay_(now) ? 'Hand in by ' + lbCutoff_() + ':00 for today\'s bag' : 'Next bag ' + Utilities.formatDate(lbAt_(d, 12, 0), dbTz_(), 'EEE d MMM') };
  }
  if (!r.receivedAt) return null;
  var bd = lbBagDay_(r.receivedAt);
  var lbl = Utilities.formatDate(lbAt_(bd, 12, 0), dbTz_(), 'EEE d MMM');
  if (r.status === 'Received') {
    var late = lbIsLate_(r, now);
    return { state: late ? 'missed' : 'for', bagDay: bd, label: late ? 'Missed the ' + lbl + ' bag' : 'For the ' + lbl + ' bag' };
  }
  if (r.status === 'Sent') {
    var on = lbOnBag_(r);
    return { state: on ? 'on' : 'after', bagDay: bd, label: on ? 'Went on the ' + lbl + ' bag' : 'Missed the ' + lbl + ' bag, went ' + Utilities.formatDate(r.sentAt, dbTz_(), 'EEE d MMM') };
  }
  return null;
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
  /* A unit manager logs their own papers like
     an agent and also sees their team's: the agents whose Unit names them, as
     the fact find's Access tab writes it ("unit manager can see his team", 17
     October 2026). */
  who.isLead = /^unit manager$/i.test(String(who.role).trim());
  who.isAgent = /^agent$/i.test(who.role) || who.isLead;
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
   2026. Agents and unit managers log their own documents. The branch has no
   assistant branch manager (17 October 2026); a row still carrying that role
   signs in as an agent. */
function lbIsStaffRole_(role) {
  var r = String(role || '').trim();
  return /staff|support|admin/i.test(r) || /^branch manager$/i.test(r);
}

/* A person's name for matching a Unit cell: letters only, any case. */
function lbNameKey_(n) { return String(n || '').toLowerCase().replace(/\([^)]*\)/g, ' ').replace(/[^a-z]+/g, ' ').trim(); }

/* The team a unit manager sees: themselves, and every active agent whose Unit
   is the manager's name. Anyone else sees only themselves. */
function lbTeam_(who) {
  var own = lbAgentKey_(who.agentNo);
  var out = [{ agentNo: who.agentNo, name: who.name, key: own, self: true }];
  if (!who.isLead) return out;
  var me = lbNameKey_(who.name);
  lbAgents_().forEach(function (a) {
    if (!a.active || a.key === own || lbIsStaffRole_(a.role)) return;
    if (me && lbNameKey_(a.unit) === me) out.push({ agentNo: a.agentNo, name: a.name, key: a.key });
  });
  return out;
}

function lbFindAgent_(no) {
  var k = lbAgentKey_(no);
  return k ? lbAgents_().filter(function (a) { return a.key === k; })[0] || null : null;
}

/* Who staff may log documents for (the "Choose the agent" list on Documents
   and Contract for delivery). 23 October 2026, from the counter: "Aleema nor
   Javid name is not listed on the contract delivery or yours Ricky Rampersad".
   The sign-in lists hold only the agents who use the fact find, and the
   Branch Manager was filtered out as staff. So the list is:
   1. everyone active on the sign-in lists who is not pure staff (the Branch
      Manager stays: he writes business too);
   2. every agent Salesforce shows as Active, with the number read off the
      AgentName__c of a policy written in the last three years ("A04020 -
      Javid Ali"); kept six hours. Anyone the sign-in lists mark inactive
      (a former agent) is never added back from Salesforce.
   Signing in is unchanged: only the sign-in lists open the Log Book. */
var LB_PICK_EXTRA = ['Mala Balkaran'];
var LB_PICK_READ_ = null;
function lbPickAgents_() {
  if (LB_PICK_READ_) return LB_PICK_READ_;
  var all = lbAgents_(), out = [], seen = {}, off = {};
  all.forEach(function (a) {
    if (!a.active) { off[a.key] = 1; var nk = lbNameKey_(a.name); if (nk) off['n:' + nk] = 1; return; }
    if (lbIsDriverRole_(a.role)) return;
    if (seen[a.key]) return;
    seen[a.key] = 1; out.push(a);
  });
  /* The staff hand papers in too (23 October 2026: "use her name alone as she is
     a sales support, also ensure all my staff is also added"). Staff with no
     agent number go in by name: the RR Operations Access tab, then the
     LB_PICK_EXTRA Script property and LB_PICK_EXTRA below (comma-separated names). */
  var byName = function (name, role, email) {
    name = String(name || '').replace(/\s+/g, ' ').trim();
    var nk = lbNameKey_(name), k = lbAgentKey_(name);
    if (!nk || !k || off['n:' + nk]) return;
    if (out.some(function (x) { return lbNameKey_(x.name) === nk; })) return;
    seen[k] = 1;
    out.push({ agentNo: name, name: name, email: email || '', unit: '', role: role || 'Staff', active: true, key: k, staff: true });
  };
  try {
    var sh = dbSheet_(DB.TABS.ACCESS, DB_ACCESS_COLUMNS), hm = dbHeaderMap_(sh), last = sh.getLastRow();
    if (last > 1) sh.getRange(2, 1, last - 1, hm.head.length).getValues().forEach(function (r) {
      var act = String(r[hm.map['Active']] == null ? 'yes' : r[hm.map['Active']]).trim();
      var role = String(r[hm.map['Role']] || 'Staff').trim() || 'Staff';
      if (/^(no|false|not active|inactive|resigned|terminated)/i.test(act) || lbIsDriverRole_(role)) return;
      byName(r[hm.map['Name']], role, 'Email' in hm.map ? String(r[hm.map['Email']] || '').trim() : '');
    });
  } catch (e) { Logger.log('pick list access tab: ' + e); }
  String(dbProp_('LB_PICK_EXTRA', '')).split(',').concat(LB_PICK_EXTRA).forEach(function (n) { byName(n, 'Sales Support'); });
  lbSfActiveAgents_().forEach(function (a) {
    var k = lbAgentKey_(a.agentNo);
    if (!k || seen[k] || off[k] || off['n:' + lbNameKey_(a.name)]) return;
    seen[k] = 1; out.push({ agentNo: a.agentNo, name: a.name, email: a.email, unit: '', role: 'Agent', active: true, key: k, sf: true });
  });
  out.sort(function (x, y) { return String(x.name).localeCompare(String(y.name)); });
  LB_PICK_READ_ = out;
  return out;
}

/* Salesforce's active agents with their numbers: [{agentNo, name, email}]. */
function lbSfActiveAgents_() {
  var cache = null, key = 'lb_sf_agents_v2';
  try { cache = CacheService.getScriptCache(); var hit = cache.get(key); if (hit) return JSON.parse(hit); } catch (e) {}
  if (typeof dbSfConfigured_ !== 'function' || !dbSfConfigured_()) return [];
  var out = [];
  try {
    var people = {};
    dbSoql_("SELECT Name, Email FROM Contact WHERE RecordType.Name = 'AGENT' AND Employment_Status__c = 'Active' LIMIT 500")
      .forEach(function (r) {
        var nk = lbNameKey_(r.Name);
        if (nk) people[nk] = { name: String(r.Name || '').replace(/\([^)]*\)/g, ' ').replace(/\s+/g, ' ').trim(), email: String(r.Email || '').trim() };
      });
    /* One small read per agent: a single read of every recent policy came
       back one page (2,000 of 5,886 on 23 Oct 2026) and missed Aleema. */
    Object.keys(people).forEach(function (nk) {
      var p = people[nk];
      var r = dbSoql_('SELECT AgentName__c FROM CLIENT_PORTFOLIO__c WHERE AgentName__c LIKE ' +
                      dbQuote_('% - ' + p.name.replace(/[%_]/g, '')) + ' ORDER BY CreatedDate DESC LIMIT 1')[0];
      var m = r && String(r.AgentName__c || '').match(/^\s*(A?\d+)\s*-\s*(.+?)\s*$/i);
      if (m && lbNameKey_(m[2]) === nk) out.push({ agentNo: m[1].toUpperCase(), name: p.name, email: p.email });
    });
    try { if (cache) cache.put(key, JSON.stringify(out), 6 * 3600); } catch (e) {}
  } catch (e) { Logger.log('Salesforce agents: ' + e); }
  return out;
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

/* People with no agent number (21 October 2026: Pawan, the driver, "see pawan from the access link", the Access tab of
   the Branch Portfolio workbook, which the tracker and the Premium Due Desk sign in from). Sign-in takes a name or an
   e-mail in the number box: first a name only one person on the agent lists carries, then the Branch Portfolio's
   access tabs (any tab with a name, an e-mail and an Access Code or Password column), name, e-mail or agent number
   with that tab's own code. LB_INTEL_SHEET_ID overrides the workbook. */
var LB_INTEL_ID = '1T1SG3mgs5QV5LuF3JTpmn1zFldhGjOQNoe0YCMhWxjs';
/* The secret's column, whatever the tab calls it ("Access Number" on the Branch Portfolio's, 21 October 2026). */
var LB_INTEL_CODE_COLS = ['access code', 'access number', 'access no', 'access #', 'password', 'pass', 'pw', 'pin'];

/** Run from the editor: lbCheckSignIn('Pawan'). Says whether this script is the new one, which tabs of the Branch
 *  Portfolio it reads as access lists, and whether the person is on one, with their role, Active and whether a code
 *  is filled in. It never prints a code. */
function lbCheckSignIn(who) {
  who = String(who || 'Pawan');
  var out = ['Sign-in check for "' + who + '" (LogBook.gs with name sign-in is in this project).'];
  var a = lbFindAgent_(who) || lbFindByName_(who);
  out.push(a ? 'On the fact find / agent lists as ' + a.name + ' (' + (a.role || 'no role') + ', ' + (a.active ? 'active' : 'NOT active') + ', code ' + (a.code ? 'set' : 'EMPTY') + ').'
             : 'Not on the fact find / agent lists.');
  var book;
  try { book = SpreadsheetApp.openById(String(dbProp_('LB_INTEL_SHEET_ID', LB_INTEL_ID)).trim()); }
  catch (e) { out.push('Could not open the Branch Portfolio: ' + e); Logger.log(out.join('\n')); return out.join('\n'); }
  book.getSheets().forEach(function (sh) {
    var lc = sh.getLastColumn(), lr = sh.getLastRow();
    if (lr < 2 || lc < 2 || lc > 40) return;
    var head = sh.getRange(1, 1, 1, lc).getValues()[0].map(function (h) { return String(h || '').trim(); });
    var low = head.map(function (h) { return h.toLowerCase(); });
    var has = function (names) { return low.some(function (h) { return names.some(function (n) { return h === n || h.indexOf(n) === 0; }); }); };
    if (!has(['name'])) return;
    if (!has(LB_INTEL_CODE_COLS)) { out.push('Tab "' + sh.getName() + '": has names but no code column I know. Headers: ' + head.join(' | ')); return; }
    if (lr > 2000) { out.push('Tab "' + sh.getName() + '": too long to be an access list (' + lr + ' rows).'); return; }
    var vals = sh.getRange(2, 1, lr - 1, lc).getValues();
    var k = lbNameKey_(who), hit = vals.filter(function (r) {
      return r.some(function (c) { var v = lbNameKey_(c); return v && (v === k || v.split(' ')[0] === k) || lbAgentKey_(c) === lbAgentKey_(who); });
    });
    out.push('Tab "' + sh.getName() + '" (headers: ' + head.join(' | ') + '): ' + (hit.length ? hit.length + ' row(s) for "' + who + '".' : 'no row for "' + who + '".'));
  });
  Logger.log(out.join('\n'));
  return out.join('\n');
}

function lbFindByName_(who) {
  var k = lbNameKey_(who);
  if (!k || /\d/.test(String(who))) return null;
  var hits = lbAgents_().filter(function (a) {
    var n = lbNameKey_(a.name);
    return n && (n === k || (k.indexOf(' ') < 0 && n.split(' ')[0] === k));
  });
  return hits.length === 1 ? hits[0] : null;
}

/* A driver delivers: the Delivery Book, nothing else. */
function lbIsDriverRole_(role) { return /driver|courier|messenger|runner|dispatch/i.test(String(role || '')); }

function lbIntelPerson_(who, code) {
  who = String(who || '').trim().toLowerCase();
  code = String(code || '').trim();
  if (!who || !code) return null;
  var book;
  try { book = SpreadsheetApp.openById(String(dbProp_('LB_INTEL_SHEET_ID', LB_INTEL_ID)).trim()); }
  catch (e) { Logger.log('branch portfolio access: ' + e); return null; }
  var inactive = /^(no|false|not active|inactive|resigned|terminated|disabled|off)/i;
  var sheets = book.getSheets();
  for (var t = 0; t < sheets.length; t++) {
    var sh = sheets[t], lc = sh.getLastColumn(), lr = sh.getLastRow();
    if (lr < 2 || lc < 2 || lc > 40) continue;
    var head = sh.getRange(1, 1, 1, lc).getValues()[0].map(function (h) { return String(h || '').trim().toLowerCase(); });
    var col = function (names) {
      for (var i = 0; i < names.length; i++) for (var j = 0; j < head.length; j++)
        if (head[j] === names[i] || head[j].indexOf(names[i]) === 0) return j;
      return -1;
    };
    var cName = col(['name']), cMail = col(['email', 'e-mail']), cCode = col(LB_INTEL_CODE_COLS);
    if (cName < 0 || cCode < 0 || lr > 2000) continue;
    var cNo = col(['agent number', 'agent no', 'agent id']), cAgent = col(['agent name']);
    var cRole = col(['role']), cUnit = col(['unit']), cAct = col(['active']);
    var vals = sh.getRange(2, 1, lr - 1, lc).getValues();
    for (var r = 0; r < vals.length; r++) {
      var row = vals[r];
      var name = String(row[cName] || '').trim(), mail = cMail >= 0 ? String(row[cMail] || '').trim() : '';
      var no = cNo >= 0 ? String(row[cNo] || '').trim() : '', agent = cAgent >= 0 ? String(row[cAgent] || '').trim() : '';
      var match = (mail && mail.toLowerCase() === who) || (name && lbNameKey_(name) === lbNameKey_(who)) ||
                  (agent && lbNameKey_(agent) === lbNameKey_(who)) || (no && lbAgentKey_(no) === lbAgentKey_(who)) ||
                  (name && who.indexOf(' ') < 0 && lbNameKey_(name).split(' ')[0] === lbNameKey_(who));
      if (!match) continue;
      var pw = String(row[cCode] == null ? '' : row[cCode]).trim();
      if (!pw || pw.toUpperCase() !== code.toUpperCase()) continue;
      return { agentNo: no || name, name: name || agent, email: mail, unit: cUnit >= 0 ? String(row[cUnit] || '').trim() : '',
               code: pw, role: cRole >= 0 ? String(row[cRole] || '').trim() : '',
               active: !(cAct >= 0 && inactive.test(String(row[cAct] || '').trim())), key: lbAgentKey_(no || name) };
    }
  }
  return null;
}

/** Sign-in by agent number and password, both. A refusal never says which
 *  was wrong. Ten wrong tries on one number close it for fifteen minutes. */
function lbLogin_(b) {
  LB_AGENTS_READ_ = null; LB_PICK_READ_ = null;
  var no = dbClean_(b.agentNo, 20), code = dbClean_(b.code, 40);
  if (!no || !code) throw new Error('Enter your agent number and your password.');
  var key = 'lb_fail_' + lbAgentKey_(no);
  var cache = CacheService.getScriptCache();
  var fails = Number(cache.get(key) || 0);
  if (fails >= 10) throw new Error('Too many tries on that number. Try again in fifteen minutes.');
  var a = lbFindAgent_(no) || lbFindByName_(no);
  if (!a || !a.active || !a.code || a.code.toUpperCase() !== code.toUpperCase()) a = lbIntelPerson_(no, code) || a;
  if (!a || !a.active || !a.code || a.code.toUpperCase() !== code.toUpperCase()) {
    cache.put(key, String(fails + 1), 900);
    throw new Error('That agent number and password do not match.');
  }
  var driver = lbIsDriverRole_(a.role);
  var staff = !driver && lbIsStaffRole_(a.role);
  var role = driver ? 'Driver' : staff ? a.role : /^unit manager$/i.test(String(a.role).trim()) ? 'Unit Manager' : 'Agent';
  var name = a.name || ('Agent ' + a.agentNo);
  var appsCell = driver ? 'delivery-book' : lbLoginApps_(staff);
  var token = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '').slice(0, 8);
  var now = new Date();
  var exp = new Date(now.getTime() + DB.SESSION_HOURS * 3600000);
  var sh = dbSheet_(DB.TABS.SESS, DB_SESS_COLUMNS);
  var hm = dbHeaderMap_(sh);
  var need = LB_SESS_EXTRA.filter(function (c) { return !(c in hm.map); });
  if (need.length) { sh.getRange(1, hm.head.length + 1, 1, need.length).setValues([need]); hm = dbHeaderMap_(sh); }
  sh.appendRow(dbRowFor_(sh, { 'Token': token, 'Name': name, 'Role': role,
    'Salesforce User Id': '', 'Issued': now, 'Expires': exp, 'Apps': appsCell,
    'Agent No': a.agentNo, 'Email': a.email, 'Unit': a.unit }));
  dbPruneSessions_(sh);
  return { ok: true, token: token, name: name, role: role, mode: dbMode_(),
           agentNo: a.agentNo, apps: opsAppsFor_(appsCell),
           docTypes: DB.DOC_TYPES, relationships: DB.RELATIONSHIPS, methods: DB.METHODS };
}

/* What one sign-in by agent number opens in RR Operations (18 October 2026: "an
   app where a person log in … and they see log book etc"). Agents and unit
   managers get the Log Book; staff and the branch manager the Log Book and the
   Delivery Book, so the branch app's one sign-in reaches both. */
function lbLoginApps_(staff) { return staff ? 'logbook,delivery-book' : 'logbook'; }


/* ============================== the web seam ============================== */

/* Called by DeliveryBook.gs's doPost for every action that starts "lb.". */
function lbHandle_(b) {
  LB_READ_ = null; LB_AGENTS_READ_ = null; LB_PICK_READ_ = null; LB_HOURS_ = null;
  if (b.action === 'lb.login') return lbLogin_(b);
  var who = lbSession_(b.token);
  if (!who) return { ok: false, error: 'signed-out' };
  /* The branch app's one sign-in (18 October 2026: "when they log in they should not have to log back into all the
     apps"). The clients board, group clients and the Premium Due Desk run in other projects; they ask here who a token
     belongs to and open as that person. Name, role and number only: never a password. */
  if (b.action === 'lb.whoami') return { ok: true, name: who.name, role: who.role, agentNo: who.agentNo || '', unit: who.unit || '', email: who.email || '' };
  if (!who.isAgent && !opsCanUse_(who, 'logbook')) return { ok: false, error: 'The Log Book is not on your access. Ask the branch to add it.' };
  var staff = !who.isAgent;
  var STAFF_ONLY = { 'lb.queue': 1, 'lb.receive': 1, 'lb.return': 1, 'lb.transmittal': 1, 'lb.unsend': 1,
                     'lb.transmittals': 1, 'lb.reason': 1, 'lb.delivered': 1, 'lb.stats': 1, 'lb.agents': 1, 'lb.bag': 1 };
  if (STAFF_ONLY[b.action] && !staff) return { ok: false, error: 'That is for the branch staff.' };
  switch (b.action) {
    case 'lb.config':       return lbConfig_(who);
    case 'lb.lookup':       return lbLookup_(b, who);
    case 'lb.policies':     return lbPolicies_(b, who);
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
    case 'lb.bag':          return lbBag_(b, who);
    case 'lb.train':        return lbTrain_(b, who);
    case 'lb.trainSubmit':  return lbTrainSubmit_(b, who);
    case 'lb.trainView':    return lbTrainView_(b, who);
    case 'lb.baginfo':      return { ok: true, bag: lbBagInfo_(new Date()) };
    case 'lb.agents':       return { ok: true, agents: lbPickAgents_().map(function (a) { return { agentNo: a.agentNo, name: a.name, unit: a.unit, staff: !!a.staff || lbIsStaffRole_(a.role), role: a.role || '' }; }) };
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
  return { ok: true, name: who.name, role: who.role, agent: who.isAgent, manager: !!who.isManager, lead: !!who.isLead,
           team: who.isLead ? lbTeam_(who).map(function (t) { return { agentNo: t.agentNo, name: t.name, self: !!t.self }; }) : [],
           agentNo: who.agentNo || '', mode: dbMode_(), types: LB.TYPES, departments: depts, documents: docs,
           cutoff: lbCutoff_(), bag: lbBagInfo_(new Date()), oft: LB.OFT, declareDocs: LB.DECLARE_DOCS, declareContract: LB.DECLARE_CONTRACT,
           salesforce: dbSfConfigured_() };
}


/* ============================== finding the client ============================== */

/** A policy number, a name or an e-mail address. The e-mail is matched on the
 *  contact's own address or their preferred one. An agent sees only their own
 *  clients ("you don't want persons pulling up other agents' clients", 16
 *  October 2026); staff and the branch manager see everyone. */
function lbLookup_(b, who) {
  var q = dbClean_(b.q, 80);
  if (!q) throw new Error('Type the client\'s name, e-mail or a policy number.');
  if (!dbSfConfigured_()) return { ok: true, via: 'none', clients: [], note: 'Salesforce is not connected yet: type the client and the policy.' };
  var out;
  if (/@/.test(q)) {
    var e = q.toLowerCase();
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(e)) throw new Error('That e-mail address does not look complete.');
    var cs = dbSoql_('SELECT ' + DB_CONTACT_FIELDS + ' FROM Contact WHERE Email = ' + dbQuote_(e) +
                     ' OR Preferred_Email__c = ' + dbQuote_(e) + ' LIMIT 10').map(dbContactOut_);
    out = { ok: true, via: 'email', clients: dbMarkDuplicates_(cs) };
  } else if (/\d{5,}/.test(q.replace(/\s/g, ''))) {
    out = dbLookup_({ policy: q }, who);
  } else {
    out = dbLookup_({ name: q }, who);
  }
  if (who.isAgent) {
    var mine = lbAgentScope_(who, (out.clients || []).map(function (c) { return c.id; }));
    var before = (out.clients || []).length;
    out.clients = (out.clients || []).filter(function (c) { return mine.contacts[c.id]; });
    if (before && !out.clients.length) out.note = 'No client of yours matches. You can only look up your own clients.';
  }
  return out;
}

/* The agent's number as Salesforce writes it at the head of AgentName__c:
   "A10024 - Neil Ramnanan". */
function lbSfAgentNo_(no) {
  var k = lbAgentKey_(no);
  return /^\d+$/.test(k) ? 'A' + ('00000' + k).slice(-5) : String(no || '').toUpperCase();
}

/* Which of these contacts, and which of their policies, belong to the agent:
   the policies whose AgentName__c starts with the agent's number. */
function lbAgentScope_(who, contactIds) {
  var ids = (contactIds || []).filter(dbIsSfId_).slice(0, 20);
  var out = { contacts: {}, portfolios: {} };
  if (!ids.length || !who.agentNo) return out;
  var inList = ids.map(dbQuote_).join(',');
  dbSoql_('SELECT Id, Contact__c, Contact_Person__c FROM CLIENT_PORTFOLIO__c WHERE (Contact__c IN (' + inList +
          ') OR Contact_Person__c IN (' + inList + ')) AND AgentName__c LIKE ' + dbQuote_(lbSfAgentNo_(who.agentNo) + '%') + ' LIMIT 200')
    .forEach(function (r) {
      out.portfolios[r.Id] = 1;
      if (r.Contact__c) out.contacts[r.Contact__c] = 1;
      if (r.Contact_Person__c) out.contacts[r.Contact_Person__c] = 1;
    });
  return out;
}

/* Their policies, grouped as the Delivery Book groups them; for an agent, only
   the ones that are theirs. */
function lbPolicies_(b, who) {
  var out = dbPolicies_(b, who);
  if (!who.isAgent || !out.groups) return out;
  var ids = [].concat(b.contactIds || b.contactId || []);
  var mine = lbAgentScope_(who, ids);
  if (!ids.some(function (id) { return mine.contacts[id]; })) throw new Error('That client is not one of yours.');
  out.groups = out.groups.map(function (g) {
    return { type: g.type, policies: g.policies.filter(function (p) { return mine.portfolios[p.portfolioId]; }) };
  }).filter(function (g) { return g.policies.length; });
  return out;
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
    var k = lbAgentKey_(d.agentNo);
    var a = k ? lbPickAgents_().filter(function (x) { return x.key === k; })[0] : null;
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
  /* What usually travels with these and is not here: a surrender without the
     Proof of ID that comes with it three times in four, ACH without the bank
     statement. Asked about, never refused. */
  out.missing = [];
  if (!contract) {
    var have = {};
    items.forEach(function (it) { have[it.document] = 1; });
    var seenMiss = {};
    items.forEach(function (it) {
      var row = LB_DOCS.filter(function (d) { return d[0] === it.document; })[0];
      (row ? row[3] : []).forEach(function (w) {
        if (w[1] >= LB.COMPANION_PCT && !have[w[0]] && !seenMiss[w[0]]) {
          seenMiss[w[0]] = 1;
          out.missing.push({ document: w[0], with: it.document, pct: w[1] });
        }
      });
    });
  }
  /* An agent logs only for their own clients: the client picked, and every
     policy picked, must be theirs in Salesforce. */
  if (who.isAgent && out.contactId && dbSfConfigured_()) {
    var mine = lbAgentScope_(who, [out.contactId]);
    if (!mine.contacts[out.contactId]) throw new Error('That client is not one of yours.');
    items.forEach(function (it) {
      if (it.portfolioId && !mine.portfolios[it.portfolioId]) throw new Error('Policy ' + it.policy + ' is not one of yours.');
    });
  }
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
  var askDup = dups.length && b.confirmDuplicates !== true;
  var askMiss = d.missing.length && b.confirmMissing !== true;
  if (askDup || askMiss) {
    return { ok: true, needsConfirm: true, duplicates: askDup ? dups : [], missing: askMiss ? d.missing : [] };
  }
  d.missing.forEach(function (m) { d.flags.push('Usually comes with ' + m.document + ' (' + m.pct + '% with ' + m.with + '): not included'); });
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
           flags: d.flags, mail: mail, bag: contract ? null : lbBagInfo_(now),
           due: contract ? Utilities.formatDate(new Date(now.getTime() + LB.CONTRACT_DAYS * 86400000), dbTz_(), 'EEEE d MMMM yyyy') : '' };
}

/* What the bag means for papers logged now, in one sentence. */
function lbBagLine_(now) {
  var d = lbBagDay_(now), cut = lbCutoff_(), at = lbBagHour_();
  var h12 = function (h) { return (h > 12 ? h - 12 : h) + ':00 ' + (h >= 12 ? 'pm' : 'am'); };
  if (d === lbDay_(now)) return 'In the branch\'s hands by ' + h12(cut) + ' today, they go on today\'s ' + h12(at) + ' bag.';
  return 'Today\'s bag has closed (' + h12(cut) + '). In the branch\'s hands by ' + h12(cut) + ' on ' +
    Utilities.formatDate(lbAt_(d, 12, 0), dbTz_(), 'EEEE d MMMM') + ', they go on that day\'s ' + h12(at) + ' bag.';
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
      : 'These are logged for ' + d.client + '. Hand the papers to the branch with this reference. ' + lbBagLine_(now)) + '</p>',
    ['Document', 'Policy', contract ? 'Next' : 'Department'], rows,
    '<p style="color:#5b6b7f;font-size:13px">Reference <b>' + dbEsc_(ref) + '</b> · logged by ' + dbEsc_(who.name) + '</p>',
    { tone: contract ? 'info' : 'ok', kicker: contract ? '20 days start today' : 'Logged · hand them in',
      tiles: [['Reference', ref, 'info'], ['Documents', d.items.reduce(function (s, it) { return s + it.quantity; }, 0), 'ok'],
              contract ? ['Deliver by', Utilities.formatDate(new Date(now.getTime() + LB.CONTRACT_DAYS * 86400000), dbTz_(), 'd MMM'), 'warn']
                       : ['Departments', Object.keys(d.items.reduce(function (o, it) { o[it.department] = 1; return o; }, {})).length, 'info']] });
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
    late: lbIsLate_(r, now), reasonFresh: lbReasonFresh_(r, now), bag: lbBagOf_(r, now),
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

/* An agent: their own lines. A unit manager: their own, or their team's
   (b.scope 'team', or one agent's number in b.agentNo, which must be on the
   team). Staff: what they logged for agents. Never anyone else's. */
function lbMine_(b, who) {
  var days = Math.max(7, Math.min(400, parseInt(b.days, 10) || 90));
  var since = new Date(Date.now() - days * 86400000), now = new Date();
  var keys = {};
  if (who.isAgent) {
    var team = lbTeam_(who);
    var pick = b.agentNo ? lbAgentKey_(b.agentNo) : '';
    if (pick && !team.some(function (t) { return t.key === pick; })) throw new Error('That agent is not on your team.');
    team.forEach(function (t) {
      if (pick ? t.key === pick : (b.scope === 'team' && who.isLead) || t.self) keys[t.key] = 1;
    });
  }
  var mine = lbRows_().filter(function (r) {
    return r.source !== 'Imported' && r.loggedAt && r.loggedAt >= since &&
      (who.isAgent ? !!keys[lbAgentKey_(r.agentNo)] : r.loggedBy === who.name);
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
  return { ok: true, now: now.toISOString(), cutoff: lbCutoff_(), bag: lbBagInfo_(now), lines: out, today: trans, departments: lbDeptRows_() };
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
      ['Client', 'Document', 'Policy'], list.map(function (r) { return [r.client, r.document, r.policy || '—']; }), '',
      { tone: 'bad', kicker: 'Put right and log again' });
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

function lbTransTab_() {
  var sh = dbSheet_(LB.TABS.TRANS, LB_TRANS_COLUMNS);
  var hm = dbHeaderMap_(sh);
  var missing = LB_TRANS_COLUMNS.filter(function (c) { return !(c in hm.map); });
  if (missing.length) sh.getRange(1, hm.head.length + 1, 1, missing.length).setValues([missing]);
  return sh;
}

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
             status: String(g('Status')), ids: String(g('Line Ids')).split(',').filter(String),
             askedAt: lbDate_(g('Confirm Sent At')), answer: String(g('Received By Dept')), answeredAt: lbDate_(g('Answered At')),
             deptNote: String(g('Dept Note')), followUp: String(g('Follow-up')) };
  });
}

function lbTransPublic_(t) {
  return { no: t.no, department: t.department, attn: t.attn, sentAt: t.sentAt ? t.sentAt.toISOString() : '',
           sentBy: t.sentBy, lines: t.lines, documents: t.documents, tracking: t.tracking, late: t.late, status: t.status,
           askedAt: t.askedAt ? t.askedAt.toISOString() : '', answer: t.answer, answeredAt: t.answeredAt ? t.answeredAt.toISOString() : '',
           deptNote: t.deptNote, followUp: t.followUp };
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
  var printed = lbTransmittalPrint_(no);
  try { printed.salesforce = lbSfSentTasks_(no, who); } catch (e) { printed.salesforce = 'Not logged: ' + e.message; }
  return printed;
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



/* ============================== the client's service record ============================== */
/*
 * Every document sent becomes a completed Servicing task on the client in
 * Salesforce, so the client's record shows what the branch did for them, as the
 * Delivery Book does for a delivery: one task per client per transmittal, on
 * their policy, owned by the person who sent it. Test mode, or no Salesforce:
 * nothing is written, and the line says so.
 */
function lbSfSentTasks_(no, who) {
  var lines = lbTransLines_(no);
  if (dbMode_() !== 'live') { lbSet_(lines, { 'Salesforce Task': 'Skipped (test mode)' }); return 'Skipped (test mode)'; }
  if (!dbSfConfigured_()) { lbSet_(lines, { 'Salesforce Task': 'Salesforce not connected' }); return 'Salesforce not connected'; }
  var by = {};
  lines.forEach(function (r) { var k = dbIsSfId_(r.contactId) ? r.contactId : ''; if (k) (by[k] = by[k] || []).push(r); });
  var owner = '';
  try { owner = lbSfUserId_(who.name); } catch (e) {}
  var made = 0, failed = 0, tz = dbTz_();
  Object.keys(by).forEach(function (cid) {
    var ls = by[cid], t = ls[0];
    var docs = ls.map(function (r) { return r.document; }).filter(function (v, i, a) { return a.indexOf(v) === i; });
    var body = {
      WhoId: cid, Status: 'Completed', Priority: 'Normal', Task_Type__c: 'Servicing',
      Subject: ('Documents sent to ' + t.department + ': ' + docs.join(', ') + ' (' + no + ')').slice(0, 255),
      ActivityDate: Utilities.formatDate(new Date(), tz, 'yyyy-MM-dd'),
      Description: [
        'Sent to ' + t.department + ' on transmittal ' + no + ' by ' + who.name + '.',
        '',
        ls.map(function (r) {
          return '- ' + r.document + (r.quantity > 1 ? ' x' + r.quantity : '') + ' · ' + (r.policy || 'no policy') +
            ' · collected ' + (r.receivedAt ? Utilities.formatDate(r.receivedAt, tz, 'd MMM') : '?') + ' by ' + r.receivedBy +
            (r.reason ? ' · not sent the same day: ' + r.reason : '');
        }).join('\n'),
        '',
        'Logged by ' + t.agent + ' (' + t.ref + '). Log Book.',
      ].join('\n').slice(0, 31000),
    };
    var pf = ls.filter(function (r) { return dbIsSfId_(r.portfolioId); })[0];
    if (pf) body.WhatId = pf.portfolioId;
    if (owner) body.OwnerId = owner;
    try {
      var id = dbSfFetch_('/sobjects/Task', { method: 'post', body: body }).id;
      lbSet_(ls, { 'Salesforce Task': id }); made++;
    } catch (e) { lbSet_(ls, { 'Salesforce Task': 'Failed: ' + e.message }); failed++; }
  });
  var none = lines.filter(function (r) { return !dbIsSfId_(r.contactId); });
  if (none.length) lbSet_(none, { 'Salesforce Task': 'Typed client: no Salesforce record' });
  return made + ' logged in Salesforce' + (failed ? ', ' + failed + ' failed' : '') + (none.length ? ', ' + none.length + ' typed' : '');
}


/* ============================== the 5:00 pm digest ============================== */
/*
 * One e-mail to the branch manager each working day at LB.DIGEST_HOUR, sales
 * support copied: the day in figures, then what needs someone: late lines with
 * no reason, departments that have not confirmed or said No, contracts near
 * day 20, papers logged and not handed in. Facts only. lbDigestNow() sends it
 * at once from the editor.
 */
function lbDigestRun_(now) {
  if (lbHour_(now) < LB.DIGEST_HOUR) return 'digest: not yet';
  var day = lbDay_(now);
  if (dbProp_('lb_digest_day') === day) return 'digest: sent today';
  var res = lbDigestSend_(now);
  if (/sent/i.test(res)) dbProps_().setProperty('lb_digest_day', day);
  return 'digest: ' + res;
}
function lbDigestNow() { LB_READ_ = null; return lbDigestSend_(new Date()); }

function lbDigestSend_(now) {
  var today = lbDay_(now), tz = dbTz_();
  var rows = lbRows_().filter(function (r) { return r.source !== 'Imported' && r.status !== 'Cancelled'; });
  var logged = rows.filter(function (r) { return lbDay_(r.loggedAt) === today; });
  var recvd = rows.filter(function (r) { return lbDay_(r.receivedAt) === today; });
  var sent = rows.filter(function (r) { return lbDay_(r.sentAt) === today; });
  var same = sent.filter(function (r) { return lbDay_(r.receivedAt) === today; });
  var late = rows.filter(function (r) { return lbIsLate_(r, now); });
  var lateNo = late.filter(function (r) { return !lbReasonFresh_(r, now); });
  var notIn = rows.filter(function (r) { return r.status === 'Logged' && lbWorkDays_(r.loggedAt, now) >= 1; });
  var contracts = rows.filter(function (r) { return r.status === 'With agent' && r.loggedAt && lbCalDays_(r.loggedAt, now) >= LB.CONTRACT_WARN[0]; });
  var trans = lbTransRows_();
  var noAns = trans.filter(function (t) { return t.status === 'Sent' && t.askedAt && /^Awaiting/.test(t.answer) && lbWorkDays_(t.askedAt, now) >= 2; });
  var saidNo = trans.filter(function (t) { return t.answer === 'No' && t.answeredAt && lbCalDays_(t.answeredAt, now) <= 14; });
  var rerouted = rows.filter(function (r) { return r.routingChanged && lbDay_(r.receivedAt) === today; });

  var sec = function (title, head, list, note) {
    if (!list.length) return '';
    return '<h3 style="font-size:15px;margin:22px 0 2px;color:#070F26">' + dbEsc_(title) + '</h3>' +
      (note ? '<div style="font-size:13px;color:#5b6b7f">' + note + '</div>' : '') + lbTable_(head, list.slice(0, 15)) +
      (list.length > 15 ? '<div style="font-size:12px;color:#5b6b7f">and ' + (list.length - 15) + ' more in the Log Book.</div>' : '');
  };
  var calm = !lateNo.length && !noAns.length && !saidNo.length && !contracts.length && !notIn.length;
  var html = lbMailHtml_('The Log Book today',
    '<p>' + dbEsc_(Utilities.formatDate(now, tz, 'EEEE d MMMM')) + '. ' + (calm ? 'Nothing is waiting on anyone.' : 'What needs someone is below, most pressing first.') + '</p>',
    [], [],
    sec('Received and not sent, no reason given', ['Client', 'Document', 'Department', 'Received', 'By'],
        lateNo.map(function (r) { return [r.client, r.document, r.department, Utilities.formatDate(r.receivedAt, tz, 'EEE d MMM'), r.receivedBy]; }),
        'The person who received them has been asked.') +
    sec('Departments that said No', ['Transmittal', 'Department', 'Answered', 'What they said', 'Follow-up'],
        saidNo.map(function (t) { return [t.no, t.department, Utilities.formatDate(t.answeredAt, tz, 'd MMM'), t.deptNote || '—', t.followUp || '—']; })) +
    sec('Departments that have not answered in 2 working days', ['Transmittal', 'Department', 'Sent', 'Asked'],
        noAns.map(function (t) { return [t.no, t.department, Utilities.formatDate(t.sentAt, tz, 'd MMM'), Utilities.formatDate(t.askedAt, tz, 'd MMM')]; })) +
    sec('Contracts with agents, day 15 or more', ['Client', 'Policy', 'Agent', 'Day'],
        contracts.sort(function (a, b) { return a.loggedAt - b.loggedAt; })
          .map(function (r) { return [r.client, r.policy || '—', r.agent, lbCalDays_(r.loggedAt, now) + ' of 20']; })) +
    sec('Logged and not yet handed in', ['Agent', 'Client', 'Document', 'Logged'],
        notIn.map(function (r) { return [r.agent, r.client, r.document, Utilities.formatDate(r.loggedAt, tz, 'EEE d MMM')]; })) +
    (rerouted.length ? '<p style="font-size:13px;color:#5b6b7f;margin-top:18px">Staff corrected the department on ' + rerouted.length +
      ' line' + (rerouted.length === 1 ? '' : 's') + ' today; the suggestions learn from it.</p>' : ''),
    { tone: calm ? 'ok' : lateNo.length || saidNo.length ? 'bad' : 'warn', kicker: 'Daily digest · ' + Utilities.formatDate(now, tz, 'd MMM'),
      tiles: [['Logged today', logged.length, 'info'], ['Received', recvd.length, 'info'], ['Sent', sent.length, 'ok'],
              ['On their bag', sent.length ? Math.round(sent.filter(function (r) { return lbOnBag_(r); }).length * 100 / sent.length) + '%' : '—', sent.every(function (r) { return lbOnBag_(r); }) ? 'ok' : 'warn'],
              ['Late, no reason', lateNo.length, lateNo.length ? 'bad' : 'ok']] });
  return lbSupportMail_({ to: [dbProp_('LB_MANAGER', LB.MANAGER)], cc: [lbSalesSupport_()],
                          subject: 'Log Book · ' + Utilities.formatDate(now, tz, 'EEE d MMM') + ': ' + sent.length + ' sent, ' +
                                   lateNo.length + ' late with no reason', html: html });
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
  if (h >= lbBagHour_()) out.push(lbChaseLate_(now));
  if (h >= LB.BAG.NUDGE && h < lbCutoff_()) out.push(lbNudgeAgents_(now));
  if (h >= lbCutoff_()) out.push(lbBagPrep_(now));
  if (h >= 9) { out.push(lbChaseContracts_(now)); out.push(lbConfirmRun_(now)); out.push(lbDigestRun_(now)); }
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
    var html = lbMailHtml_('Missed the bag: the reason, please',
      '<p>' + dbEsc_(staff.split(' ')[0] || staff) + ', the documents below were in the branch\'s hands in time for their bag and did not go on it. ' +
      'The branch standard: in by 12:00 noon, on that day\'s 1:00 pm bag. The transmittal prints the date collected and the date sent, and the reason beside them.</p>' +
      (link ? '<div style="margin:18px 0 6px">' + lbBtn_(link, 'Give the reason &rarr;', '#1D5BC4', '#ffffff') + '</div>' : '') +
      '<p style="color:#5b6b7f;font-size:13px">Then put them on tomorrow\'s bag from the Log Book. You will be asked again each working day until they go or a reason is given.</p>',
      ['Client', 'Document', 'Policy', 'Department', 'Received', 'Working days'], rows,
      '<p style="color:#5b6b7f;font-size:13px">Agent: ' + dbEsc_(list[0].agent) + '. Sales support and the agent are copied.</p>',
      { tone: 'warn', kicker: 'Missed the ' + (lbBagHour_() - 12) + ':00 pm bag',
        tiles: [['Documents waiting', list.length, 'warn'],
                ['Oldest, working days', list.reduce(function (m, r) { return Math.max(m, lbWorkDays_(r.receivedAt, now)); }, 0), 'bad'],
                ['Departments', Object.keys(list.reduce(function (o, r) { o[r.department] = 1; return o; }, {})).length, 'info']] });
    var duty = lbDuty_(today), dutyMail = duty ? lbStaffEmail_(duty.name) : '';
    var res = lbMail_({ to: [staffMail || lbSalesSupport_()], cc: [lbSalesSupport_(), list[0].agentEmail].concat(dutyMail && dutyMail !== staffMail ? [dutyMail] : []),
                        subject: 'Reason needed: ' + list.length + ' document' + (list.length > 1 ? 's' : '') + ' received and not sent (' + list[0].client + (list.length > 1 && list.some(function (r) { return r.client !== list[0].client; }) ? ' and others' : '') + ')',
                        html: html });
    if (/sent/i.test(res)) { lbMarkAlert_(list, 'asked ' + today); sent++; }
  });
  return 'late: ' + due.length + ' lines, ' + sent + ' e-mails';
}

/* 12:00: the person on the bag gets what is going down today, by department,
   and what agents logged and have not handed in. Once a day. */
function lbBagPrep_(now) {
  var today = lbDay_(now);
  if (!lbIsWorkDay_(today)) return 'bag: not a working day';
  if (dbProp_('lb_bag_prep_day') === today) return 'bag: prep sent today';
  var duty = lbDuty_(today);
  var rows = lbRows_().filter(function (r) { return r.source !== 'Imported' && r.type === LB.TYPES[0]; });
  var ready = rows.filter(function (r) { return r.status === 'Received' && r.receivedAt && lbBagDay_(r.receivedAt) <= today; });
  var notIn = rows.filter(function (r) { return r.status === 'Logged'; });
  var depts = {};
  ready.forEach(function (r) { depts[r.department] = (depts[r.department] || 0) + r.quantity; });
  var html = lbMailHtml_('Today\'s bag: ' + ready.length + ' line' + (ready.length === 1 ? '' : 's') + ' to prepare',
    '<p>' + dbEsc_(duty ? duty.name.split(' ')[0] : 'Team') + ', the bag closes now. Check these, put them on their transmittals and seal the bag for the ' +
    (lbBagHour_() - 12) + ':00 pm exchange. Anything received after 12:00 goes on tomorrow\'s bag.</p>',
    ['Department', 'Documents'], Object.keys(depts).sort().map(function (k) { return [k, String(depts[k])]; }),
    (notIn.length ? '<p style="font-size:13px;color:#5b6b7f">Logged by agents and not handed in yet: ' + notIn.length + '. They miss today\'s bag.</p>' : ''),
    { tone: ready.length ? 'info' : 'ok', kicker: 'Bag closes ' + lbCutoff_() + ':00 · exchange ' + (lbBagHour_() - 12) + ':00 pm',
      tiles: [['To prepare', ready.length, ready.length ? 'warn' : 'ok'], ['Departments', Object.keys(depts).length, 'info'], ['Not handed in', notIn.length, notIn.length ? 'warn' : 'ok']] });
  var to = duty ? lbStaffEmail_(duty.name) : '';
  var res = lbMail_({ to: [to || lbSalesSupport_()], cc: [lbSalesSupport_()], subject: 'Today\'s bag: ' + ready.length + ' to prepare by ' + (lbBagHour_() - 12) + ':00 pm', html: html });
  if (/sent/i.test(res)) dbProps_().setProperty('lb_bag_prep_day', today);
  return 'bag: ' + res;
}

function lbNudgeAgents_(now) {
  var today = lbDay_(now);
  var due = lbRows_().filter(function (r) {
    if (r.source === 'Imported' || r.status !== 'Logged' || !r.loggedAt || !r.agentEmail) return false;
    var d = lbWorkDays_(r.loggedAt, now);
    return (d === 0 || LB.NUDGE_DAYS.indexOf(d) >= 0) && !lbAlerted_(r, 'nudged ' + today);
  });
  var byAgent = {};
  due.forEach(function (r) { (byAgent[r.agentEmail] = byAgent[r.agentEmail] || []).push(r); });
  Object.keys(byAgent).forEach(function (k) {
    var list = byAgent[k];
    var html = lbMailHtml_('One hour to catch today\'s bag',
      '<p>You logged these and the branch does not have the papers yet. The bag goes down at ' + (lbBagHour_() - 12) + ':00 pm, and papers in the branch\'s hands by ' +
      lbCutoff_() + ':00 noon go on it. After that they wait for tomorrow\'s bag. If they are not coming, withdraw the entry in the Log Book.</p>',
      ['Reference', 'Client', 'Document', 'Logged'],
      list.map(function (r) { return [r.ref, r.client, r.document, Utilities.formatDate(r.loggedAt, dbTz_(), 'EEE d MMM')]; }), '',
      { tone: 'warn', kicker: 'Hand them in by ' + lbCutoff_() + ':00', tiles: [['Not yet handed in', list.length, 'warn'], ['Bag closes', lbCutoff_() + ':00 noon', 'warn']] });
    var res = lbMail_({ to: [k], cc: [lbSalesSupport_()], subject: 'Log Book: hand in by ' + lbCutoff_() + ':00 for today\'s bag (' + list.length + ')', html: html });
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
      [[r.client, r.policy || '—', Utilities.formatDate(r.loggedAt, dbTz_(), 'EEE d MMM'), String(day)]], '',
      { tone: manager ? 'bad' : 'warn', kicker: manager ? 'Section 155(6): 20 days passed' : 'Section 155(6): 20-day delivery',
        tiles: [['Day', day + ' of 20', manager ? 'bad' : 'warn'], ['Due', due, 'info']] });
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


/* ============================== did the department get it ============================== */
/*
 * Asked for on 16 October 2026: "an email should trigger after 3 working days
 * to ensure the department gets the documents, sent from support copying sales
 * support as well as the agent and the respective manager … a checkmark saying
 * yes or no … if no then it's routed to sales support for a response copying
 * all and a task is logged on Salesforce accordingly to the person who
 * collected".
 *
 * So: three working days after a transmittal is sent (LB.CONFIRM_DAYS), one
 * e-mail goes from support@ to the department (the Email on the Departments
 * tab; sales support when there is none), copied to sales support, every agent
 * on it and each agent's manager. Two buttons: Yes, received / No. A Yes is
 * recorded on the transmittal. A No (with what is missing, if they say) goes to
 * sales support for a response, everyone copied again, and a Salesforce task
 * is opened for each staff member who collected the papers. In test mode the
 * mail goes to the test inbox and no task is written.
 */

/* Every lb* link from DeliveryBook.gs's doGet. */
function lbGet_(p) {
  if (p.lbc) return lbConfirmPage_(p);
  return lbReasonPage_(p);
}

function lbConfirmSign_(no) {
  return Utilities.base64EncodeWebSafe(Utilities.computeHmacSha256Signature('lbc|' + no, dbSecret_())).replace(/=+$/, '').slice(0, 22);
}
function lbConfirmLink_(no, answer) {
  var u = dbExecUrl_();
  return u ? u + '?lbc=' + encodeURIComponent(no) + '&a=' + answer + '&k=' + lbConfirmSign_(no) : '';
}

/* The agent's manager: the person the agent's Unit names, else the branch manager. */
function lbManagerEmail_(agentNo, agentName) {
  var people = lbAgents_();
  var a = lbFindAgent_(agentNo) || people.filter(function (x) { return x.name.toLowerCase() === String(agentName || '').toLowerCase(); })[0];
  var unit = a ? String(a.unit || '').trim().toLowerCase() : '';
  if (unit) {
    var m = people.filter(function (x) {
      return x.email && x.active && /manager/i.test(x.role) && (x.name.toLowerCase() === unit || x.name.toLowerCase().indexOf(unit) >= 0 || unit.indexOf(x.name.toLowerCase()) >= 0);
    })[0];
    if (m) return m.email;
  }
  return dbProp_('LB_MANAGER', LB.MANAGER);
}

function lbPeopleOn_(lines) {
  var agents = {}, managers = {}, collectors = {};
  lines.forEach(function (r) {
    var em = r.agentEmail || (lbFindAgent_(r.agentNo) || {}).email;
    if (em) agents[em.toLowerCase()] = em;
    var mg = lbManagerEmail_(r.agentNo, r.agent);
    if (mg) managers[mg.toLowerCase()] = mg;
    if (r.receivedBy) collectors[r.receivedBy] = lbStaffEmail_(r.receivedBy);
  });
  var vals = function (o) { return Object.keys(o).map(function (k) { return o[k]; }).filter(String); };
  return { agents: vals(agents), managers: vals(managers), collectors: collectors };
}

function lbTransLines_(no) { return lbRows_().filter(function (r) { return r.transmittal === no; }); }

function lbSetTrans_(t, obj) {
  var sh = lbTransTab_(), hm = dbHeaderMap_(sh);
  Object.keys(obj).forEach(function (k) { if (k in hm.map) sh.getRange(t.row, hm.map[k] + 1).setValue(obj[k]); });
}

/** Run from the hourly chase: every transmittal sent three working days ago
 *  or more and not yet asked about. */
function lbConfirmRun_(now) {
  var due = lbTransRows_().filter(function (t) {
    return t.status === 'Sent' && t.sentAt && !t.askedAt && lbWorkDays_(t.sentAt, now) >= LB.CONFIRM_DAYS;
  });
  var n = 0;
  due.forEach(function (t) { if (/sent/i.test(lbConfirmAsk_(t))) n++; });
  return 'confirmations: ' + n + ' of ' + due.length;
}

function lbConfirmAsk_(t) {
  var lines = lbTransLines_(t.no);
  if (!lines.length) return 'No lines';
  var dept = lbDeptRows_().filter(function (d) { return d.name === t.department; })[0] || {};
  var ppl = lbPeopleOn_(lines);
  var yes = lbConfirmLink_(t.no, 'yes'), no = lbConfirmLink_(t.no, 'no');
  var btn = lbBtn_;
  var html = lbMailHtml_('Did you receive these documents?',
    '<p>Good day' + (t.attn ? ' ' + dbEsc_(t.attn) : '') + ',</p>' +
    '<p>On <b>' + dbEsc_(Utilities.formatDate(t.sentAt, dbTz_(), 'EEEE d MMMM yyyy')) + '</b> the Ricky Rampersad Branch sent ' +
    dbEsc_(t.department) + ' the documents below on transmittal <b>' + dbEsc_(t.no) + '</b>' + (t.tracking ? ' (tracking ' + dbEsc_(t.tracking) + ')' : '') +
    '. Please confirm they reached you. One tap is enough.</p>' +
    (yes ? '<p style="margin:18px 0 10px">' + btn(yes, '&#10003; Yes, received', '#15803d', '#ffffff') + btn(no, '&#10007; No, not received', '#b91c1c', '#ffffff') + '</p>' : ''),
    ['Client', 'Policy', 'Document', 'Copies', 'Agent'],
    lines.map(function (r) { return [r.client, r.policy || '—', r.document + (r.itemNote ? ' (' + r.itemNote + ')' : ''), String(r.quantity), r.agent]; }),
    '<p style="color:#5b6b7f;font-size:13px">Sent by ' + dbEsc_(t.sentBy) + '. Sales support, the agents and their managers are copied.</p>',
    { tone: 'info', kicker: 'One tap: Yes or No',
      tiles: [['Transmittal', t.no, 'info'], ['Documents', lines.reduce(function (s, r) { return s + r.quantity; }, 0), 'ok'],
              ['Sent', Utilities.formatDate(t.sentAt, dbTz_(), 'd MMM'), 'info']] });
  var to = dept.email ? [dept.email] : [lbSalesSupport_()];
  var res = lbSupportMail_({ to: to, cc: [lbSalesSupport_()].concat(ppl.agents, ppl.managers),
                             subject: 'Please confirm receipt: transmittal ' + t.no + ' (' + t.department + ')', html: html });
  if (/sent/i.test(res)) lbSetTrans_(t, { 'Confirm Sent At': new Date(), 'Received By Dept': 'Awaiting' + (dept.email ? '' : ' (no department e-mail: sent to sales support)') });
  return res;
}

/* The department's tap. Yes is recorded at once. No asks what is missing
   (optional), then goes to sales support and opens the Salesforce tasks. */
function lbConfirmPage_(p) {
  LB_READ_ = null; LB_AGENTS_READ_ = null; LB_PICK_READ_ = null;
  var no = dbClean_(p.lbc, 20);
  if (!no || String(p.k || '') !== lbConfirmSign_(no)) return dbHtml_('<h1>This link has expired</h1><p>Reply to the e-mail instead and we will follow up.</p>');
  var t = lbTransRows_().filter(function (x) { return x.no === no; })[0];
  if (!t) return dbHtml_('<h1>Not found</h1><p>Reply to the e-mail and we will follow up.</p>');
  if (/^(Yes|No)/.test(t.answer)) {
    return dbHtml_('<h1>Already recorded</h1><p>Transmittal ' + dbEsc_(no) + ' is marked <b>' + dbEsc_(t.answer) + '</b>' +
      (t.answeredAt ? ' on ' + dbEsc_(Utilities.formatDate(t.answeredAt, dbTz_(), 'd MMM yyyy')) : '') + '. Reply to the e-mail if that is not right.</p>');
  }
  if (p.a === 'yes') {
    lbSetTrans_(t, { 'Received By Dept': 'Yes', 'Answered At': new Date() });
    return dbHtml_('<h1>Thank you</h1><p>Transmittal ' + dbEsc_(no) + ' is marked received by ' + dbEsc_(t.department) + '.</p>');
  }
  if (p.a === 'no') {
    if (p.note == null) {
      return dbHtml_('<h1>Not received</h1><p>Transmittal ' + dbEsc_(no) + ' to ' + dbEsc_(t.department) + '. Tell us what is missing, if you can, and send.</p>' +
        '<form method="get" action="' + dbEsc_(dbExecUrl_()) + '" target="_top">' +
        '<input type="hidden" name="lbc" value="' + dbEsc_(no) + '"><input type="hidden" name="a" value="no"><input type="hidden" name="k" value="' + dbEsc_(String(p.k)) + '">' +
        '<textarea name="note" maxlength="500" placeholder="e.g. Nothing arrived / the ID for one client is missing"></textarea>' +
        '<button type="submit">Send to the branch</button></form>');
    }
    var note = dbClean_(p.note, 500);
    lbSetTrans_(t, { 'Received By Dept': 'No', 'Answered At': new Date(), 'Dept Note': note });
    var follow = lbNotReceived_(t, note);
    lbSetTrans_(t, { 'Follow-up': follow });
    return dbHtml_('<h1>Thank you</h1><p>The branch\'s sales support team has it and will respond. Everyone on the transmittal is copied.</p>');
  }
  return dbHtml_('<h1>Choose Yes or No</h1><p>Use the buttons in the e-mail.</p>');
}

/** A "No": sales support is asked to respond, everyone copied, and a task is
 *  opened in Salesforce for each person who collected the papers. */
function lbNotReceived_(t, note) {
  var lines = lbTransLines_(t.no);
  var ppl = lbPeopleOn_(lines);
  var dept = lbDeptRows_().filter(function (d) { return d.name === t.department; })[0] || {};
  var collectorMails = Object.keys(ppl.collectors).map(function (k) { return ppl.collectors[k]; }).filter(String);
  var html = lbMailHtml_('Not received: transmittal ' + t.no,
    '<p><b>' + dbEsc_(t.department) + '</b> says the documents on transmittal <b>' + dbEsc_(t.no) + '</b>, sent ' +
    dbEsc_(Utilities.formatDate(t.sentAt, dbTz_(), 'EEEE d MMMM')) + ' by ' + dbEsc_(t.sentBy) + ', did not reach them.</p>' +
    (note ? '<p style="background:#fff3f0;border-left:4px solid #b91c1c;padding:10px 12px">' + dbEsc_(note) + '</p>' : '') +
    '<p><b>Sales support: please respond to all</b> with where the documents are and when they will reach the department. ' +
    'A task is open in Salesforce for ' + dbEsc_(Object.keys(ppl.collectors).join(', ') || 'the branch') + '.</p>',
    ['Client', 'Policy', 'Document', 'Collected', 'By'],
    lines.map(function (r) { return [r.client, r.policy || '—', r.document, r.receivedAt ? Utilities.formatDate(r.receivedAt, dbTz_(), 'd MMM') : '—', r.receivedBy]; }), '',
    { tone: 'bad', kicker: 'Department says: not received', tiles: [['Transmittal', t.no, 'bad'], ['Documents', lines.length, 'warn']] });
  var mail = lbSupportMail_({ to: [lbSalesSupport_()], cc: [dept.email].concat(ppl.agents, ppl.managers, collectorMails, [lbStaffEmail_(t.sentBy)]),
                              subject: 'NOT RECEIVED: transmittal ' + t.no + ' (' + t.department + '): response needed', html: html });
  var tasks = Object.keys(ppl.collectors).map(function (who) {
    return who + ': ' + lbSfFollowTask_(t, lines.filter(function (r) { return r.receivedBy === who; }), who, note);
  });
  return 'Mail: ' + mail + (tasks.length ? '; tasks: ' + tasks.join('; ') : '');
}

/* The Salesforce user behind a staff name: the Access tab's Salesforce User
   Id, else an active user of that name. */
function lbSfUserId_(name) {
  var sh = dbSheet_(DB.TABS.ACCESS, DB_ACCESS_COLUMNS), hm = dbHeaderMap_(sh), last = sh.getLastRow();
  if (last > 1 && 'Salesforce User Id' in hm.map) {
    var hit = sh.getRange(2, 1, last - 1, hm.head.length).getValues().filter(function (r) {
      return String(r[hm.map['Name']] || '').trim().toLowerCase() === String(name).trim().toLowerCase() && dbIsSfId_(r[hm.map['Salesforce User Id']]);
    })[0];
    if (hit) return String(hit[hm.map['Salesforce User Id']]);
  }
  var parts = String(name || '').trim().split(/\s+/);
  if (parts.length < 2) return '';
  var u = dbSoql_('SELECT Id FROM User WHERE IsActive = true AND FirstName = ' + dbQuote_(parts[0]) +
                  ' AND LastName LIKE ' + dbQuote_(parts[parts.length - 1] + '%') + ' LIMIT 1');
  return u.length ? u[0].Id : '';
}

function lbSfFollowTask_(t, lines, collector, note) {
  if (dbMode_() !== 'live') return 'Skipped (test mode)';
  if (!dbSfConfigured_()) return 'Salesforce not connected';
  try {
    var first = lines.filter(function (r) { return dbIsSfId_(r.contactId); })[0] || lines[0];
    var due = new Date(); do { due = new Date(due.getTime() + 86400000); } while (lbWeekend_(due));
    var body = {
      Subject: 'Documents not received by ' + t.department + ': ' + t.no,
      Status: 'Not Started', Priority: 'High', Task_Type__c: 'Servicing',
      ActivityDate: Utilities.formatDate(due, dbTz_(), 'yyyy-MM-dd'),
      Description: [
        t.department + ' says the documents on transmittal ' + t.no + ' (sent ' + Utilities.formatDate(t.sentAt, dbTz_(), 'd MMM yyyy') +
          ' by ' + t.sentBy + ') did not reach them.',
        note ? 'Their note: ' + note : '',
        '',
        lines.map(function (r) { return '- ' + r.document + ' · ' + r.client + ' · ' + (r.policy || 'no policy') + ' (' + r.ref + ')'; }).join('\n'),
        '',
        'Collected by ' + collector + '. Find the documents, send them again or confirm where they are, and update this task.',
      ].filter(function (x, i, a) { return x !== '' || a[i - 1] !== ''; }).join('\n').slice(0, 31000),
    };
    if (first && dbIsSfId_(first.contactId)) body.WhoId = first.contactId;
    if (first && dbIsSfId_(first.portfolioId)) body.WhatId = first.portfolioId;
    var owner = lbSfUserId_(collector);
    if (owner) body.OwnerId = owner;
    var id = dbSfFetch_('/sobjects/Task', { method: 'post', body: body }).id;
    return id + (owner ? '' : ' (owner not found: assigned to the integration user)');
  } catch (e) { return 'Failed: ' + e.message; }
}


/* ── mail from support@ ────────────────────────────────────────────────────
 * Through Microsoft 365 (Graph, Mail.Send) when the three properties the
 * Service Questionnaire project uses are copied here: MS_TENANT, MS_CLIENT,
 * MS_SECRET. Otherwise from this script's account, named "Ricky Rampersad
 * Branch Support" with support@ as the reply address. Test mode: the test inbox. */
function lbGraphReady_() { return !!(dbProp_('MS_TENANT') && dbProp_('MS_CLIENT') && dbProp_('MS_SECRET')); }

function lbGraphToken_() {
  var cache = CacheService.getScriptCache();
  var c = cache.get('lb_ms_tok');
  if (c) return c;
  var res = UrlFetchApp.fetch('https://login.microsoftonline.com/' + dbProp_('MS_TENANT') + '/oauth2/v2.0/token', {
    method: 'post', muteHttpExceptions: true,
    payload: { grant_type: 'client_credentials', client_id: dbProp_('MS_CLIENT'), client_secret: dbProp_('MS_SECRET'),
               scope: 'https://graph.microsoft.com/.default' } });
  var j = JSON.parse(res.getContentText() || '{}');
  if (!j.access_token) throw new Error('Microsoft sign-in failed: ' + (j.error_description || j.error || res.getResponseCode()));
  cache.put('lb_ms_tok', j.access_token, 50 * 60);
  return j.access_token;
}

/* The second way out (18 October 2026: "i do have the gmail account support@rickyrampersadbranch.com"): when
   Microsoft 365 is not set up, the e-mail goes from this script's Google account, and as support@ when that
   account is support@ itself or has it as a "Send mail as" address in Gmail. Otherwise as before, with
   support@ or sales support as the reply address. */
var LB_ALIAS_ = null;
function lbGmailFrom_() {
  if (LB_ALIAS_ !== null) return LB_ALIAS_;
  LB_ALIAS_ = '';
  var want = lbSupportFrom_().toLowerCase();
  try {
    if (String(Session.getEffectiveUser().getEmail()).toLowerCase() === want) return LB_ALIAS_ = 'self';
  } catch (e) {}
  try {
    if (GmailApp.getAliases().some(function (a) { return String(a).toLowerCase() === want; })) LB_ALIAS_ = lbSupportFrom_();
  } catch (e) { Logger.log('gmail aliases: ' + e); }
  return LB_ALIAS_;
}
function lbAppMail_(o) {
  var alias = lbGmailFrom_();
  if (alias && alias !== 'self') {
    var opt = { htmlBody: o.htmlBody, name: o.name, replyTo: o.replyTo, from: alias };
    if (o.cc) opt.cc = o.cc;
    GmailApp.sendEmail(o.to, o.subject, '', opt);
    return 'from ' + alias;
  }
  MailApp.sendEmail(o);
  return alias === 'self' ? 'from ' + lbSupportFrom_() : '';
}

/* One way out for every RR Operations e-mail (18 October 2026: "would like this coming from
   rickyrampersadbranch.com … any other emails with communications"): Microsoft Graph, as
   support@rickyrampersadbranch.com, saved in its Sent Items, when MS_TENANT, MS_CLIENT and MS_SECRET are in
   this project's Script properties. Returns true when Microsoft took it; false sends the caller to Gmail. */
function lbGraphSend_(to, cc, subject, html, replyTo) {
  if (!lbGraphReady_() || !to.length) return false;
  try {
    var addr = function (l) { return l.map(function (a) { return { emailAddress: { address: a } }; }); };
    var res = UrlFetchApp.fetch('https://graph.microsoft.com/v1.0/users/' + encodeURIComponent(lbSupportFrom_()) + '/sendMail', {
      method: 'post', muteHttpExceptions: true, contentType: 'application/json',
      headers: { Authorization: 'Bearer ' + lbGraphToken_() },
      payload: JSON.stringify({ message: { subject: subject, body: { contentType: 'HTML', content: html },
        toRecipients: addr(to), ccRecipients: addr(cc || []), replyTo: addr([replyTo || lbSupportFrom_()]) }, saveToSentItems: true }) });
    if (res.getResponseCode() === 202) return true;
    Logger.log('graph send: ' + res.getResponseCode() + ' ' + res.getContentText());
  } catch (e) { Logger.log('graph send: ' + e); }
  return false;
}

function lbSupportMail_(m) {
  if (dbMode_() !== 'live') return lbMail_(m);
  var clean = function (l) {
    var seen = {};
    return (l || []).map(function (x) { return String(x || '').trim(); })
      .filter(function (x) { var k = x.toLowerCase(); if (!/@/.test(x) || seen[k]) return false; seen[k] = 1; return true; });
  };
  var to = clean(m.to);
  var cc = clean(m.cc).filter(function (x) { return to.map(function (y) { return y.toLowerCase(); }).indexOf(x.toLowerCase()) < 0; });
  if (!to.length) return 'No address';
  if (lbGraphSend_(to, cc, m.subject, m.html, lbSupportFrom_())) return 'Sent from ' + lbSupportFrom_();
  try {
    var o = { to: to.join(','), subject: m.subject, htmlBody: m.html, name: DB.BRAND + ' Support', replyTo: lbSupportFrom_() };
    if (cc.length) o.cc = cc.join(',');
    var via = lbAppMail_(o);
    return via ? 'Sent ' + via : 'Sent (reply to ' + lbSupportFrom_() + ')';
  } catch (e2) { return 'Failed: ' + e2.message; }
}


/* ============================== mail ============================== */

function lbSalesSupport_() { return dbProp_('LB_SALES_SUPPORT', LB.SALES_SUPPORT); }
function lbSupportFrom_() { return dbProp_('LB_SUPPORT_FROM', LB.SUPPORT_FROM); }

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
    html = '<div style="background:#eef4ff;border:1px solid #6FA8FF;padding:10px 14px;font-family:Arial;font-size:13px">' +
      'TEST — in live mode this would go to <b>' + dbEsc_(to.join(', ')) + '</b>' + (cc.length ? ', copied to ' + dbEsc_(cc.join(', ')) : '') + '.</div>' + html;
    to = [dbProp_('DB_TEST_INBOX') || Session.getEffectiveUser().getEmail()];
    cc = dbTestCc_(to);
    subject = '[TEST] ' + subject;
  }
  if (lbGraphSend_(to, cc, subject, html, lbSalesSupport_())) return (dbMode_() === 'live' ? 'Sent' : 'Test copy sent') + ' from ' + lbSupportFrom_();
  try {
    if (MailApp.getRemainingDailyQuota && MailApp.getRemainingDailyQuota() < 1 + cc.length) return 'Held: daily mail limit reached';
    var o = { to: to.join(','), subject: subject, htmlBody: html, name: DB.BRAND, replyTo: lbSalesSupport_() };
    if (cc.length) o.cc = cc.join(',');
    var via = lbAppMail_(o);
    return (dbMode_() === 'live' ? 'Sent' : 'Test copy sent') + (via ? ' ' + via : '');
  } catch (e) { return 'Failed: ' + e.message; }
}

/* ── the look of every Log Book e-mail ─────────────────────────────────────
 * 16 October 2026: "ensure the email templates pop". Tables and inline styles
 * only, so Gmail and Outlook show it as built; the shield is the hosted PNG.
 * A navy masthead with the blue shield, a coloured status band (its colour and
 * a word say the same thing, never the colour alone), the headline, optional
 * figure tiles, the lines as a striped table under a navy head, any buttons,
 * and the internal footer.
 *   opt.tone    ok | info | warn | bad   (else read from the title)
 *   opt.kicker  the small line above the headline
 *   opt.tiles   [[label, value, tone], ...]
 */
var LB_TONES = {
  ok:   { c: '#15803d', bg: '#e8f6ee', icon: '&#10003;', word: 'Done' },
  info: { c: '#0e7490', bg: '#e6f6fa', icon: 'i',        word: 'For you' },
  warn: { c: '#b45309', bg: '#fdf3e2', icon: '!',        word: 'Needs you' },
  bad:  { c: '#b91c1c', bg: '#fdecec', icon: '&#10007;', word: 'Action needed' },
};

function lbToneOf_(title) {
  var t = String(title || '');
  if (/not received|past the 20|reason|returned/i.test(t)) return /reason/i.test(t) ? 'warn' : 'bad';
  if (/day \d+|not yet with|due|confirm|receive these/i.test(t)) return /receive these/i.test(t) ? 'info' : 'warn';
  return 'ok';
}

function lbMailHtml_(title, intro, head, rows, foot, opt) {
  opt = opt || {};
  var tone = LB_TONES[opt.tone || lbToneOf_(title)] || LB_TONES.info;
  var kicker = opt.kicker || tone.word;
  var F = "font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;";
  var tiles = (opt.tiles || []).filter(function (x) { return x && x[1] !== '' && x[1] != null; });
  /* Tiles are inline blocks, three to a row at most, so they wrap on a phone
     instead of pushing the e-mail wider than the screen. */
  var per = Math.min(tiles.length, 3);
  var tileHtml = tiles.length ? '<div style="margin:18px -4px 6px;font-size:0;text-align:center">' +
    tiles.map(function (t) {
      var tc = (LB_TONES[t[2]] || { c: '#070F26', bg: '#f3f6fa' });
      return '<div style="display:inline-block;vertical-align:top;box-sizing:border-box;width:' + (Math.floor(1000 / per) / 10 - 0.1) + '%;min-width:92px;padding:4px">' +
        '<div style="background:' + (tc.bg || '#f3f6fa') + ';border-radius:12px;padding:14px 6px;text-align:center;' + F + '">' +
        '<div style="font-size:' + (String(t[1]).length > 8 ? 16 : String(t[1]).length > 5 ? 20 : 26) + 'px;line-height:1.15;font-weight:800;color:' + tc.c + ';white-space:nowrap">' + dbEsc_(t[1]) + '</div>' +
        '<div style="font-size:11px;color:#5b6b7f;margin-top:6px;letter-spacing:.3px;text-transform:uppercase">' + dbEsc_(t[0]) + '</div></div></div>';
    }).join('') + '</div>' : '';
  var table = lbTable_(head, rows);
  return '<div style="background:#eef1f5;padding:20px 6px;' + F + 'color:#13202e">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:660px;margin:0 auto;background:#ffffff;border-radius:16px;overflow:hidden;box-shadow:0 6px 24px rgba(7,19,31,.10)">' +
    // masthead
    '<tr><td style="background:#070F26;padding:18px 22px">' +
      '<table role="presentation" cellpadding="0" cellspacing="0"><tr>' +
      '<td style="vertical-align:middle"><img src="' + DB.LOGO + '" width="46" height="46" alt="" style="display:block;border-radius:11px"></td>' +
      '<td style="vertical-align:middle;padding-left:14px">' +
        '<div style="' + F + 'color:#8FBBFF;font-size:11px;font-weight:700;letter-spacing:1.6px;text-transform:uppercase">Ricky Rampersad Branch</div>' +
        '<div style="' + F + 'color:#ffffff;font-size:20px;font-weight:800;margin-top:2px">Log Book</div></td></tr></table></td></tr>' +
    '<tr><td style="height:4px;line-height:4px;font-size:0;background:#2A6DE0;background-image:linear-gradient(90deg,#2A6DE0,#00CFEA)">&nbsp;</td></tr>' +
    // status band
    '<tr><td style="padding:20px 18px 4px">' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:' + tone.bg + ';border-left:5px solid ' + tone.c + ';border-radius:12px"><tr>' +
      '<td width="54" style="padding:16px 0 16px 16px;vertical-align:top"><div style="width:38px;height:38px;line-height:38px;border-radius:50%;background:' + tone.c +
        ';color:#ffffff;text-align:center;font-weight:800;font-size:18px;' + F + '">' + tone.icon + '</div></td>' +
      '<td style="padding:14px 16px 14px 12px;vertical-align:middle">' +
        '<div style="' + F + 'font-size:11px;font-weight:800;letter-spacing:1.2px;text-transform:uppercase;color:' + tone.c + '">' + dbEsc_(kicker) + '</div>' +
        '<div style="' + F + 'font-size:21px;font-weight:800;line-height:1.25;color:#070F26;margin-top:3px">' + dbEsc_(title) + '</div></td></tr></table></td></tr>' +
    // body
    '<tr><td style="padding:10px 18px 22px;' + F + 'font-size:15px;line-height:1.6;color:#2a3a4c;word-break:break-word">' + intro + tileHtml + table + (foot || '') + '</td></tr>' +
    // footer
    '<tr><td style="background:#f6f8fb;border-top:1px solid #e6ebf1;padding:14px 22px;' + F + 'font-size:12px;line-height:1.5;color:#5b6b7f">' +
      '<b style="color:#070F26">' + dbEsc_(LB.BRANCH_LINE) + '</b><br>' +
      'Internal: for the branch team, our agents and Guardian Life departments. Please do not forward outside them.</td></tr>' +
    '</table></div>';
}

/* The lines in a Log Book e-mail. Up to three columns: a striped table under a
   navy head. More than that cannot fit a phone, so each line is a card: the
   first value as its title, the rest as labelled facts that wrap two or three
   to a row on a desk and one under another on a phone. */
function lbTable_(head, rows) {
  if (!rows || !rows.length) return '';
  var F = "font-family:'Segoe UI',Roboto,Helvetica,Arial,sans-serif;";
  if (head.length > 3) {
    return '<div style="margin:16px 0">' + rows.map(function (r, i) {
      return '<div style="border:1px solid #dfe5ee;border-left:4px solid ' + (i % 2 ? '#13408F' : '#2A6DE0') +
        ';border-radius:12px;padding:12px 14px 6px;margin:0 0 10px;background:#ffffff;' + F + '">' +
        '<div style="font-size:15px;font-weight:800;color:#070F26;margin-bottom:6px">' + dbEsc_(r[0]) + '</div>' +
        '<div style="font-size:0">' + r.slice(1).map(function (c, j) {
          return '<div style="display:inline-block;vertical-align:top;width:33%;min-width:132px;box-sizing:border-box;padding:0 10px 8px 0">' +
            '<div style="font-size:10px;letter-spacing:.5px;text-transform:uppercase;color:#8a97a8;font-weight:700">' + dbEsc_(head[j + 1]) + '</div>' +
            '<div style="font-size:14px;color:#13202e;margin-top:2px">' + dbEsc_(c) + '</div></div>';
        }).join('') + '</div></div>';
    }).join('') + '</div>';
  }
  var th = head.map(function (h) {
    return '<th align="left" style="background:#070F26;color:#8FBBFF;' + F + 'font-size:10px;letter-spacing:.4px;text-transform:uppercase;padding:10px 10px;font-weight:700">' + dbEsc_(h) + '</th>';
  }).join('');
  var trs = rows.map(function (r, i) {
    return '<tr>' + r.map(function (c, j) {
      return '<td style="' + F + 'padding:10px 10px;font-size:13px;color:#13202e;background:' + (i % 2 ? '#f6f8fb' : '#ffffff') +
        ';border-top:1px solid #e6ebf1;overflow-wrap:break-word' + (j === 0 ? ';font-weight:600' : '') + '">' + dbEsc_(c) + '</td>';
    }).join('') + '</tr>';
  }).join('');
  return '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-collapse:separate;border:1px solid #dfe5ee;border-radius:12px;overflow:hidden;margin:16px 0">' +
    '<tr>' + th + '</tr>' + trs + '</table>';
}

/* A big button that survives Outlook: a padded table cell, not a styled link alone. */
function lbBtn_(href, label, bg, fg) {
  return '<table role="presentation" cellpadding="0" cellspacing="0" style="display:inline-table;margin:4px 8px 8px 0"><tr>' +
    '<td style="background:' + bg + ';border-radius:12px">' +
    '<a href="' + dbEsc_(href) + '" style="display:inline-block;padding:15px 26px;font-family:\'Segoe UI\',Roboto,Helvetica,Arial,sans-serif;' +
    'font-size:16px;font-weight:800;color:' + fg + ';text-decoration:none;border-radius:12px">' + label + '</a></td></tr></table>';
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
  var withCancelled = all.filter(function (r) { return r.loggedAt && r.loggedAt >= since && r.type === LB.TYPES[0] && r.source !== 'Imported'; });
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
      var o = m[k] = m[k] || { name: k, lines: 0, docs: 0, sent: 0, sameDay: 0, within1: 0, late: 0, waiting: 0, returned: 0, changed: 0, noPolicy: 0, neverIn: 0 };
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
      if (r.status === 'Cancelled' || (r.status === 'Logged' && lbWorkDays_(r.loggedAt, now) >= LB.NEVER_IN_DAYS)) o.neverIn++;
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

  var bagRows = sent.filter(function (r) { return r.receivedAt; });
  var byHour = {};
  rows.forEach(function (r) {
    if (!r.receivedAt) return;
    var h = Math.max(7, Math.min(18, lbHour_(r.receivedAt)));
    var o = byHour[h] = byHour[h] || { hour: h, lines: 0, sent: 0, onBag: 0, late1: 0, late2: 0, never: 0 };
    o.lines++;
    var n = lbBagsLate_(r);
    if (n == null) { if (r.status !== 'Received') o.never++; return; }
    o.sent++; if (n === 0) o.onBag++; else if (n === 1) o.late1++; else o.late2++;
  });
  var before = rows.filter(function (r) { return r.receivedAt && lbIsWorkDay_(lbDay_(r.receivedAt)) && lbHour_(r.receivedAt) < lbCutoff_(); });
  var bag = {
    cutoff: lbCutoff_(), at: lbBagHour_(),
    sent: bagRows.length, onBag: bagRows.filter(function (r) { return lbOnBag_(r); }).length,
    beforeCutoff: before.length, afterCutoff: rows.filter(function (r) { return r.receivedAt; }).length - before.length,
    beforeOnBag: before.filter(function (r) { return lbOnBag_(r) === true; }).length,
    byHour: Object.keys(byHour).map(function (k) { return byHour[k]; }).sort(function (a, c) { return a.hour - c.hour; }),
    log: (function () {
      var sh = lbBagLogTab_(), hm = dbHeaderMap_(sh), last = sh.getLastRow();
      if (last < 2) return [];
      return sh.getRange(Math.max(2, last - 14), 1, Math.min(15, last - 1), hm.head.length).getValues().map(function (r) {
        var g = function (c) { var v = r[hm.map[c]]; return v instanceof Date ? v.toISOString() : v; };
        return { day: g('Day'), duty: g('On The Bag'), inAt: g('Bag In At'), outAt: g('Bag Out At'), transmittals: g('Transmittals'), documents: g('Documents'), missed: g('Missed') };
      });
    })(),
  };
  bag.onBagPct = pct(bag.onBag, bag.sent);
  bag.beforeOnBagPct = pct(bag.beforeOnBag, bag.beforeCutoff);
  bag.afterPct = pct(bag.afterCutoff, bag.beforeCutoff + bag.afterCutoff);

  return {
    ok: true, days: days, since: since.toISOString(), now: now.toISOString(), cutoff: lbCutoff_(), bag: bag,
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
    byAgent: (function () {
      var b = bucket(function (r) { return r.agent; });
      var cx = {};
      withCancelled.forEach(function (r) { if (r.status === 'Cancelled') cx[r.agent] = (cx[r.agent] || 0) + 1; });
      b.forEach(function (o) { o.neverIn += cx[o.name] || 0; o.quality = o.lines ? Math.max(0, Math.round(100 - (o.returned * 3 + o.noPolicy * 2 + o.changed + o.neverIn * 2) * 100 / (o.lines * 3))) : null; });
      return b.slice(0, 40);
    })(),
    deptScore: (function () {
      var m = {};
      lbTransRows_().filter(function (t) { return t.status === 'Sent' && t.sentAt && t.sentAt >= since; }).forEach(function (t) {
        var o = m[t.department] = m[t.department] || { name: t.department, transmittals: 0, asked: 0, yes: 0, no: 0, waiting: 0, days: [] };
        o.transmittals++;
        if (t.askedAt) o.asked++;
        if (t.answer === 'Yes') o.yes++;
        else if (t.answer === 'No') o.no++;
        else if (t.askedAt) o.waiting++;
        if (t.askedAt && t.answeredAt) o.days.push(lbWorkDays_(t.askedAt, t.answeredAt));
      });
      return Object.keys(m).map(function (k) {
        var o = m[k]; o.answerDays = median(o.days); delete o.days;
        o.confirmedPct = o.yes + o.no ? Math.round(o.yes * 100 / (o.yes + o.no)) : null;
        return o;
      }).sort(function (a, c) { return c.transmittals - a.transmittals; });
    })(),
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
  var dhm = dbHeaderMap_(dsh);
  var dmiss = LB_DEPT_COLUMNS.filter(function (c) { return !(c in dhm.map); });
  if (dmiss.length) dsh.getRange(1, dhm.head.length + 1, 1, dmiss.length).setValues([dmiss]);
  if (dsh.getLastRow() < 2) {
    var rows = LB_DEPTS.map(function (d) { return dbRowFor_(dsh, { 'Department': d[0], 'Active': 'Yes' }); });
    dsh.getRange(2, 1, rows.length, rows[0].length).setValues(rows);
  }
  var noMail = lbDeptRows_().filter(function (d) { return !d.email; }).length;
  var have = ScriptApp.getProjectTriggers().some(function (t) { return t.getHandlerFunction() === 'lbHourly'; });
  if (!have) ScriptApp.newTrigger('lbHourly').timeBased().everyHours(1).create();
  var agents = lbAgents_();
  var notes = [
    'Mode: ' + dbMode_() + (dbMode_() === 'live' ? '' : ' (every Log Book e-mail goes to ' + (dbProp_('DB_TEST_INBOX') || 'the script owner') + ')'),
    'Hourly chase: ' + (have ? 'already on' : 'installed'),
    'The bag: in by ' + lbCutoff_() + ':00, exchange at ' + lbBagHour_() + ':00; this week ' + ((lbDuty_(lbDay_(new Date())) || {}).name || 'nobody: add the Bag Rota tab'),
    'People who can sign in: ' + agents.filter(function (a) { return a.active && a.code; }).length +
      ' (the Agents tab and the fact find\'s Access tab' + (agents.length ? '' : ': none found, check the script owner can open the fact find workbook') + ')',
    'Departments: ' + lbDeptNames_().length + (noMail ? ' (' + noMail + ' with no Email: their 3-day check goes to sales support)' : ''),
    'E-mail from support@: ' + (lbGraphReady_() ? 'Microsoft 365 connected' : 'not connected (set MS_TENANT, MS_CLIENT, MS_SECRET); sent from this account with support@ as the reply address'),
    'Reason links: ' + (dbExecUrl_() ? 'on' : 'off until the web app is deployed'),
    'History: ' + (dbProp_('LB_HISTORY_ID') ? 'run lbImportHistory() once' : 'set LB_HISTORY_ID, then run lbImportHistory()'),
  ];
  var msg = notes.join('\n');
  try { SpreadsheetApp.getUi().alert('Log Book\n\n' + msg); } catch (e) {}
  return msg;
}


/* ============================== training ============================== */

/* The Log Book training (17 October 2026: "a training manual for both the
 * agent and staff so they can log in and do the questions and get scores so
 * they understand how to use"). The manual is public on the page
 * (/logbook/training); the questions, their answers and the reasons are not,
 * because this file is on the website: they live on the "Log Book Questions"
 * tab of this sheet, or of the sheet LB_TRAIN_SHEET_ID names. Columns: Id,
 * Roles (agent, staff or all), Section, Question, A, B, C, D, Answer, Why,
 * Points, Critical (Y). Agents and unit managers take the agent questions;
 * staff and the branch manager the staff questions; "all" goes to everyone.
 * A pass is LB_TRAIN.PASS per cent with every critical question right. Every
 * attempt is a row on "Log Book Training" and an e-mail to the person, the
 * branch manager copied. After an attempt the page shows each answer, right
 * or wrong, with the reason: this is a test to learn the book, so it teaches.
 */
var LB_TRAIN = { TAB: 'Log Book Questions', RESULTS: 'Log Book Training', PASS: 80,
  // The private "Log Book Questions (private)" sheet in the branch manager's Drive (18 October 2026). Only its
  // owner and whoever it is shared with can open it, so the ID here shows nothing. LB_TRAIN_SHEET_ID overrides it.
  SHEET: '1o3RdA0BMtGfZvP3mBIrHxrIXjXvXoYz1ZdoHRrmvsIA' };
var LB_TRAIN_COLUMNS = ['When', 'Name', 'Agent No', 'Role', 'Unit', 'Course', 'Score', 'Out Of', 'Percent', 'Pass',
                        'Critical Missed', 'Wrong', 'Answers', 'Seconds'];

function lbTrainRole_(who) { return who.isAgent ? 'agent' : 'staff'; }

function lbTrainBank_() {
  /* A tab named "Log Book Questions" in this sheet wins; else the private sheet (any tab with an Id column). */
  var sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(LB_TRAIN.TAB);
  if (!sh || sh.getLastRow() < 2) {
    sh = null;
    try {
      var book = SpreadsheetApp.openById(dbProp_('LB_TRAIN_SHEET_ID', LB_TRAIN.SHEET));
      sh = book.getSheetByName(LB_TRAIN.TAB) || book.getSheets().filter(function (t) {
        return t.getLastRow() > 1 && String(t.getRange(1, 1).getValue()).trim() === 'Id';
      })[0] || null;
    } catch (e) { Logger.log('training questions: ' + e); }
  }
  if (!sh || sh.getLastRow() < 2) return null;
  var hm = dbHeaderMap_(sh);
  var g = function (r, c) {
    if (!(c in hm.map)) return '';
    var v = r[hm.map[c]];
    if (v && typeof v.getTime === 'function') return Utilities.formatDate(v, dbTz_(), 'h a').toLowerCase();  // "1 pm" read by Sheets as a time
    return String(v == null ? '' : v).trim();
  };
  return sh.getRange(2, 1, sh.getLastRow() - 1, hm.head.length).getValues().map(function (r) {
    return { id: g(r, 'Id'), roles: g(r, 'Roles').toLowerCase(), section: g(r, 'Section'), q: g(r, 'Question'),
             opts: ['A', 'B', 'C', 'D'].map(function (k) { return g(r, k); }), ans: g(r, 'Answer').toUpperCase(),
             why: g(r, 'Why'), pts: Number(g(r, 'Points')) || 1, crit: /^y/i.test(g(r, 'Critical')) };
  }).filter(function (x) { return x.id && x.q && /^[ABCD]$/.test(x.ans); });
}

function lbTrainFor_(who) {
  var role = lbTrainRole_(who), bank = lbTrainBank_();
  if (!bank) return null;
  return bank.filter(function (x) { return x.roles === 'all' || x.roles.split(/[ ,]+/).indexOf(role) >= 0; });
}

function lbTrainTab_() { return dbSheet_(LB_TRAIN.RESULTS, LB_TRAIN_COLUMNS); }

function lbTrainRows_() {
  var sh = lbTrainTab_(), hm = dbHeaderMap_(sh), last = sh.getLastRow();
  if (last < 2) return [];
  return sh.getRange(2, 1, last - 1, hm.head.length).getValues().map(function (r) {
    var g = function (c) { return r[hm.map[c]]; };
    var when = g('When');
    return { when: when instanceof Date ? when.toISOString() : String(when || ''), name: String(g('Name') || ''),
             agentNo: String(g('Agent No') || ''), role: String(g('Role') || ''), unit: String(g('Unit') || ''),
             course: String(g('Course') || ''), score: Number(g('Score')) || 0, outOf: Number(g('Out Of')) || 0,
             pct: Number(g('Percent')) || 0, pass: /^y/i.test(String(g('Pass'))), critMissed: String(g('Critical Missed') || ''),
             wrong: String(g('Wrong') || ''), seconds: Number(g('Seconds')) || 0 };
  });
}

/* Whose attempts someone may read: staff and the branch manager everyone's; a
   unit manager their team's; an agent their own. */
function lbTrainMine_(who, rows) {
  if (!who.isAgent) return rows;
  var keys = {};
  lbTeam_(who).forEach(function (t) { keys[t.key] = 1; });
  var me = lbNameKey_(who.name);
  return rows.filter(function (r) { return keys[lbAgentKey_(r.agentNo)] || (!r.agentNo && lbNameKey_(r.name) === me); });
}

function lbTrain_(b, who) {
  var qs = lbTrainFor_(who);
  var mine = lbTrainMine_(who, lbTrainRows_()).filter(function (r) {
    return who.isAgent ? lbAgentKey_(r.agentNo) === lbAgentKey_(who.agentNo) : lbNameKey_(r.name) === lbNameKey_(who.name);
  });
  if (!qs || !qs.length) return { ok: true, linked: false, role: lbTrainRole_(who), mine: mine };
  return { ok: true, linked: true, role: lbTrainRole_(who), pass: LB_TRAIN.PASS, name: who.name,
           lead: !!who.isLead, staff: !who.isAgent, manager: !!who.isManager,
           questions: qs.map(function (x) { return { id: x.id, section: x.section, q: x.q, opts: x.opts, pts: x.pts, crit: x.crit }; }),
           mine: mine };
}

function lbTrainSubmit_(b, who) {
  var qs = lbTrainFor_(who);
  if (!qs || !qs.length) throw new Error('The questions are not set up yet. Ask the branch.');
  var ans = b.answers || {};
  var missing = qs.filter(function (x) { return !/^[ABCD]$/.test(String(ans[x.id] || '')); });
  if (missing.length) throw new Error('Answer every question first (' + missing.length + ' left).');
  var score = 0, outOf = 0, wrong = [], critMissed = [];
  var marked = qs.map(function (x) {
    var given = String(ans[x.id]).toUpperCase(), right = given === x.ans;
    outOf += x.pts;
    if (right) score += x.pts; else { wrong.push(x.id); if (x.crit) critMissed.push(x.id); }
    return { id: x.id, given: given, ans: x.ans, right: right, why: x.why, crit: x.crit, section: x.section };
  });
  var pct = outOf ? Math.round(score * 1000 / outOf) / 10 : 0;
  var pass = pct >= LB_TRAIN.PASS && !critMissed.length;
  var now = new Date();
  var secs = Math.max(0, Math.min(36000, parseInt(b.seconds, 10) || 0));
  var sh = lbTrainTab_();
  sh.appendRow(dbRowFor_(sh, { 'When': now, 'Name': who.name, 'Agent No': who.agentNo || '', 'Role': who.role, 'Unit': who.unit || '',
    'Course': lbTrainRole_(who), 'Score': score, 'Out Of': outOf, 'Percent': pct, 'Pass': pass ? 'Yes' : 'No',
    'Critical Missed': critMissed.join(', '), 'Wrong': wrong.join(', '),
    'Answers': qs.map(function (x) { return x.id + ':' + String(ans[x.id]).toUpperCase(); }).join(' '), 'Seconds': secs }));
  var mail = '';
  try {
    var to = who.email || (who.isAgent ? '' : lbStaffEmail_(who.name));
    var byQ = {}; qs.forEach(function (x) { byQ[x.id] = x; });
    var html = lbMailHtml_(pass ? 'Log Book training: passed' : 'Log Book training: not yet',
      '<p>' + dbEsc_(who.name) + ' scored <b>' + score + ' of ' + outOf + ' (' + pct + '%)</b> on the ' + lbTrainRole_(who) +
      ' questions. A pass is ' + LB_TRAIN.PASS + '% with every one of the three rules right.</p>' +
      (pass ? '' : '<p>Read the sections below again and take the test once more at rickyrampersadbranch.com/logbook/training.</p>'),
      ['Question', 'Section', 'Answered'],
      wrong.map(function (id) { return [byQ[id].q + (byQ[id].crit ? ' (one of the three rules)' : ''), byQ[id].section, 'Not right']; }),
      '', { tone: pass ? 'ok' : 'warn', kicker: 'Training result',
            tiles: [['Score', score + '/' + outOf], ['Percent', pct + '%', pass ? 'ok' : 'warn'], ['Result', pass ? 'Pass' : 'Not yet', pass ? 'ok' : 'warn']] });
    mail = lbMail_({ to: [to || LB.MANAGER], cc: to ? [LB.MANAGER] : [], subject: 'Log Book training: ' + who.name + ' ' + pct + '% (' + (pass ? 'pass' : 'not yet') + ')', html: html });
  } catch (e) { mail = 'Failed: ' + e.message; }
  return { ok: true, score: score, outOf: outOf, pct: pct, pass: pass, passMark: LB_TRAIN.PASS, critMissed: critMissed, marked: marked, mail: mail };
}

/** Results to read: one line a person (their best and last), and how each
 *  question went, for the branch to see what the team has not understood. */
function lbTrainView_(b, who) {
  var rows = lbTrainMine_(who, lbTrainRows_());
  var people = {};
  rows.forEach(function (r) {
    var k = r.agentNo ? 'n' + lbAgentKey_(r.agentNo) : 'm' + lbNameKey_(r.name);
    var p = people[k] = people[k] || { name: r.name, agentNo: r.agentNo, role: r.role, unit: r.unit, tries: 0, best: 0, last: null, passed: false };
    p.tries++; p.best = Math.max(p.best, r.pct); if (r.pass) p.passed = true;
    if (!p.last || r.when > p.last.when) p.last = r;
  });
  var bank = lbTrainBank_() || [], qmap = {};
  bank.forEach(function (x) { qmap[x.id] = { id: x.id, q: x.q, section: x.section, roles: x.roles, crit: x.crit, asked: 0, wrong: 0 }; });
  rows.forEach(function (r) {
    var w = r.wrong ? r.wrong.split(/,\s*/) : [];
    bank.forEach(function (x) {
      if (!(x.roles === 'all' || x.roles.split(/[ ,]+/).indexOf(r.course) >= 0)) return;
      qmap[x.id].asked++; if (w.indexOf(x.id) >= 0) qmap[x.id].wrong++;
    });
  });
  var notYet = [];
  if (!who.isAgent || who.isLead) {
    var seen = {};
    Object.keys(people).forEach(function (k) { seen[k] = 1; });
    var pool = !who.isAgent ? lbAgents_().filter(function (a) { return a.active && a.code; })
                            : lbTeam_(who).map(function (t) { return lbFindAgent_(t.agentNo) || { agentNo: t.agentNo, name: t.name, role: 'Agent' }; });
    pool.forEach(function (a) { if (!seen['n' + lbAgentKey_(a.agentNo)]) notYet.push({ name: a.name, agentNo: a.agentNo, role: a.role || '' }); });
  }
  return { ok: true, people: Object.keys(people).map(function (k) { return people[k]; }),
           questions: Object.keys(qmap).map(function (k) { return qmap[k]; }).filter(function (x) { return x.asked; }),
           notYet: notYet, passMark: LB_TRAIN.PASS, scope: !who.isAgent ? 'branch' : who.isLead ? 'team' : 'me' };
}
