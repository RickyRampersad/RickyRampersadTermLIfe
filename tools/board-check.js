#!/usr/bin/env node
/**
 * board-check.js — is the committed wall snapshot internally honest?
 *
 * Every figure in WALL_DATA is supposed to come from one pass over Salesforce.
 * When a refresh is half-applied the totals quietly stop agreeing and there is
 * no way to tell from the wall which half is stale — that is how a 132 got
 * shown against a 144. These assertions catch it before it is committed.
 *
 *   node tools/board-check.js
 *
 * Exits non-zero on any failure.
 */
const fs = require('fs');
const path = require('path');

const file = path.join(__dirname, '..', 'board', 'index.html');
const src = fs.readFileSync(file, 'utf8');

const start = src.indexOf('var WALL_DATA =');
if (start < 0) { console.error('WALL_DATA not found in board/index.html'); process.exit(1); }
const end = src.indexOf('\n};', start) + 3;
const D = eval('(' + src.slice(start + 'var WALL_DATA ='.length, end - 1) + ')');

// Keep in step with STALE_DAYS in board/index.html, which decides when the
// board itself stops presenting the snapshot as today's book.
const STALE_DAYS = 3;

const sum = (a, f) => a.reduce((x, y) => x + (y[f] || 0), 0);
const fails = [];
const check = (ok, label, detail) => {
  console.log(`  ${ok ? 'ok  ' : 'FAIL'} ${label}${detail ? '   ' + detail : ''}`);
  if (!ok) fails.push(label);
};

console.log(`\nwall snapshot as of ${D.generatedAt}\n`);

const mn = sum(D.monthly, 'n'), mp = sum(D.monthly, 'prem');
check(mn === D.ytd.risks, 'months sum to ytd.risks', `${mn} vs ${D.ytd.risks}`);
check(mp === D.ytd.premium, 'months sum to ytd.premium', `${mp} vs ${D.ytd.premium}`);
check(sum(D.claimTypes, 'n') === D.ytd.openClaims, 'claim types sum to openClaims',
  `${sum(D.claimTypes, 'n')} vs ${D.ytd.openClaims}`);
check(sum(D.classification, 'n') === D.ytd.risks, 'classification sums to ytd.risks',
  `${sum(D.classification, 'n')} vs ${D.ytd.risks}`);

// A renewal already past is the failure the wall cannot survive: it tells the
// room a call is still to make on a policy that has already lapsed or renewed.
const asOf = D.generatedAt.slice(0, 10);
const past = D.renewals.filter(r => r.when < asOf);
check(past.length === 0, 'no renewal listed that is already past',
  past.length ? past.map(r => r.who + ' ' + r.when).join(', ') : '');

check(D.renewals.length >= 8, 'enough renewals to fill the slide', `${D.renewals.length}`);
check(D.oldestClaims.length > 0 && D.topOpps.length > 0, 'claims and pipeline slides have rows');

// Nothing that identifies a client may sit in a public file.
const blob = JSON.stringify(D);
check(!/TT\s?[A-Z]{2,3}\s?\d{6,}/.test(blob), 'no policy numbers in the snapshot');
check(!/@/.test(blob), 'no email addresses in the snapshot');
const longRef = (D.oldestClaims || []).filter(c => /\d{6,}/.test(c.ref));
check(longRef.length === 0, 'claim references are masked',
  longRef.map(c => c.ref).join(', '));

// The check above proves the snapshot was coherent on the day it was taken.
// It says nothing about today, and that is the gap that let the board run six
// weeks out of date: every row stayed consistent with a date in the past.
// These two measure it against now.
const days = Math.round((Date.now() - Date.parse(D.generatedAt)) / 864e5);
const today = new Date().toISOString().slice(0, 10);
const pastNow = D.renewals.filter(r => r.when < today);
console.log(`\n  snapshot is ${days} day(s) old`);
check(pastNow.length < D.renewals.length,
  'at least one renewal is still ahead of us',
  pastNow.length ? `${pastNow.length} of ${D.renewals.length} have fallen due since it was taken` : '');
check(days <= STALE_DAYS, `snapshot is no more than ${STALE_DAYS} days old`,
  days > STALE_DAYS ? 'refresh it, or switch the live feed on — tools/wall-refresh.md' : '');

console.log(fails.length ? `\n${fails.length} failure(s).\n` : '\nSnapshot is consistent.\n');
process.exit(fails.length ? 1 : 0);
