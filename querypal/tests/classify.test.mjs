/* What the department actually said.

   RRB/2026/105 went to Customer Service on 29 October 2026. The routed email
   never sent — the trail carries section 13's NOT EMAILED flag — the 31
   October chase reached them as a fresh email, and on 2 November Nakesha
   Gill-Long replied with the statement attached. The case stayed Open, no
   survey went to the client, and the chasers carried on.

   classifyReply_ reads the whole plain body. On a corporate reply that is two
   words of answer followed by the quoted trail and the footers. Run against
   that reply it finds three blocker words, none of them hers:

     'need '          "do you really NEED to print this email?"
     'incomplete'     "not be liable for the INCOMPLETE transmission"
     'please provide' "Good Day Team, PLEASE PROVIDE the statement" — our own
                      request, quoted back at us

   Every Guardian reply carries that disclaimer and most quote the request, so
   REPLY_AUTOCLOSE_ON could never fire. The loop was built to close itself and
   had no way to.

   Run: node classify.test.mjs
*/
import fs from 'fs';
import path from 'path';

const HERE = path.dirname(new URL(import.meta.url).pathname);
const PATCH = fs.readFileSync(path.join(HERE, '..', 'QueryPalPatch.gs'), 'utf8');

let fail = 0;
const t = (label, ok, detail) => {
  console.log((ok ? '  PASS  ' : '  FAIL  ') + label + (!ok && detail ? '\n          ' + detail : ''));
  if (!ok) fail++;
};

/* Code.gs's classifier, verbatim, so the patch is judged against the real one. */
function classifyReply_(text) {
  var t = String(text || '').toLowerCase().replace(/\s+/g, ' ');
  if (!t) return 'unclear';
  var blockers = ['require', 'need ', 'cannot locate', 'can not locate', 'unable to locate', 'pending', 'awaiting', 'not able', 'outstanding', 'missing', 'incomplete', 'kindly provide', 'please provide', 'please send', 'we need', 'further information', 'more information', 'clarif', 'on hold', 'in progress', 'being processed', 'will process', 'follow up', 'revert'];
  for (var b = 0; b < blockers.length; b++) if (t.indexOf(blockers[b]) > -1) return 'blocked';
  var done = ['has been completed', 'now completed', 'is completed', 'completed', 'has been processed', 'now processed', 'is processed', 'processed', 'has been resolved', 'resolved', 'has been actioned', 'actioned', 'has been done', 'done', 'settled', 'paid', 'posted', 'updated successfully', 'effected', 'finalized', 'finalised', 'approved', 'attached is', 'please find attached', 'kindly find attached', 'has been issued', 'dispatched'];
  for (var d = 0; d < done.length; d++) if (t.indexOf(done[d]) > -1) return 'resolved';
  return 'unclear';
}

function load() {
  const sandbox = {
    SHEET_NAME: 'Queries', Logger: { log() {} }, classifyReply_,
    SpreadsheetApp: { getActiveSpreadsheet: () => ({ getSheetByName: () => null }) },
    GmailApp: { search: () => [] },
    Session: { getEffectiveUser: () => ({ getEmail: () => 'x@y.com' }) },
  };
  const names = Object.keys(sandbox);
  const want = ['qpReplyBody_', 'qpClassifyReply_', 'QP_DONE_EXTRA'];
  return new Function(...names, PATCH + '\n;return {' + want.join(',') + '};')(
    ...names.map(n => sandbox[n]));
}
const api = load();

/* Nakesha's reply, as Gmail hands it over. */
const REAL = `Good Morning,

See attached.

Warm Regards,

Nakesha Gill-Long | Team Leader
Chaguanas Regional Centre - Ground Floor
t: 868-226-3344 | nakesha.gill-long@myguardiangroup.com
________________________________________
From: RR Branch Query Pal <rampersadricky@gmail.com>
Sent: Saturday, October 31, 2026 2:31 PM
Subject: Re: Rakesh Lochan - Tax Statement

**EXTERNAL EMAIL**

Following up on the request below - our records still show it open.
Original request - system record
Good Day Team, Please provide the statement for 2025
Help Save Paper! Do you really need to print this email?
This message (and any attachments) contains information that may be confidential and protected from disclosure.
Guardian Holdings Limited shall not be liable for the incomplete transmission of this message.`;

console.log('\nthe reply that stalled case 105\n');

t('the old classifier calls it blocked',
  classifyReply_(REAL) === 'blocked',
  'got ' + classifyReply_(REAL) + ' — this is the bug, not the fix');

t('the trimmed body is only what Nakesha typed',
  /See attached/.test(api.qpReplyBody_(REAL))
  && !/please provide|incomplete|Help Save Paper|EXTERNAL/i.test(api.qpReplyBody_(REAL)),
  JSON.stringify(api.qpReplyBody_(REAL)));

t('and it now reads as resolved',
  api.qpClassifyReply_(REAL) === 'resolved',
  'got ' + api.qpClassifyReply_(REAL));

console.log('\nwhere the quote gets cut\n');
for (const [what, body] of [
  ['an Outlook rule',        'Done, posted today.\n________________________________\nFrom: someone'],
  ['a From: header',         'Done, posted today.\nFrom: someone <a@b.com>'],
  ['an "On ... wrote:" line', 'Done, posted today.\nOn Mon, 2 Nov 2026 at 09:00, Query Pal wrote:'],
  ['plain-text quoting',     'Done, posted today.\n> Following up on the request'],
  ['the Help Save Paper line', 'Done, posted today.\nHelp Save Paper! Do you really need to print this?'],
  ['the confidentiality block', 'Done, posted today.\nThis message contains information that may be confidential'],
  ['a phone signature',       'Done, posted today.\nSent from my iPhone'],
]) t('cut at ' + what, api.qpReplyBody_(body).trim() === 'Done, posted today.',
     JSON.stringify(api.qpReplyBody_(body)));

console.log('\nwhat still counts as what\n');

t('a real blocker above the quote is still a blocker',
  api.qpClassifyReply_('We need the signed mandate before we can action this.\n________\nFrom: x')
    === 'blocked');

t('a plain completion is still resolved',
  api.qpClassifyReply_('This has been processed.\n________\nFrom: x') === 'resolved');

t('"see attached" is understood, which it was not before',
  classifyReply_('See attached.') === 'unclear'
  && api.qpClassifyReply_('See attached.') === 'resolved',
  'this is how a department answers a request for a document');

t('a bare acknowledgement is still unclear',
  api.qpClassifyReply_('Good morning, noted with thanks.\n________\nFrom: x') === 'unclear',
  'an acknowledgement is not a completion and must not auto-close');

t('a top-post with nothing above the quote is unclear',
  api.qpClassifyReply_('________________________________\nFrom: someone\nThis has been processed')
    === 'unclear',
  'quoting a completion is not writing one');

t('an empty reply is unclear', api.qpClassifyReply_('') === 'unclear');

t('the blocker wins when both appear in what they wrote',
  api.qpClassifyReply_('Statement attached, but we still need the ID.\n________\nFrom: x')
    === 'blocked',
  'half-done is not done');

console.log('\nthe shape of section 17\n');

/* A section runs from its banner to the next one. Slicing to the end of the
   file instead folds every later section into this audit — which is how this
   assertion went red twice as new sections landed. */
const section = (name) => {
  const a = PATCH.indexOf(name);
  if (a < 0) return '';
  const rest = PATCH.slice(a + name.length);
  const next = rest.search(/\n\/\* [\u2550=]{10,}/);
  return next > -1 ? PATCH.slice(a, a + name.length + next) : PATCH.slice(a);
};

const S17 = section('17. CLASSIFY WHAT THE PERSON WROTE');
t('section 17 exists', S17.length > 1000);
t('it never sends, closes or writes',
  !/MailApp|GmailApp|\.setValue\(|appendRow/.test(S17),
  'it decides a verdict — acting on it stays in autoSweep');
t('the existing vocabulary is reused, not replaced',
  /classifyReply_\(body\)/.test(S17) && !/^var blockers/m.test(S17),
  'the branch\'s own words for done and blocked stay the branch\'s');
t('the extra completions are only checked after the real list says unclear',
  S17.indexOf('classifyReply_(body)') < S17.indexOf('QP_DONE_EXTRA[i]'),
  'nothing already understood may change meaning');

console.log();
process.exit(fail ? 1 : 0);
