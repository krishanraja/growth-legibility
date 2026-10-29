// The source review's early warning in `npm run check` (scripts/review-due.mjs; docs/FAILURES.md F47). A stubbed clock
// (CHECK_NOW) stands in for the day; the warning never fails the check.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { checkClock, formatWarning, sourceReviewWarning, WARN_DAYS } from '../scripts/review-due.mjs';

const DUE = '2026-11-26T00:00:00Z';
const at = iso => Date.parse(iso);
const check = env => spawnSync(process.execPath, [fileURLToPath(new URL('../scripts/check.mjs', import.meta.url))], { encoding:'utf8', env:{ ...process.env, GITHUB_ACTIONS:'', ...env } });

test('the source review warns once the lock is under 10 days away, names the review-by date, and keeps warning after it', () => {
  assert.equal(WARN_DAYS, 10);
  assert.equal(sourceReviewWarning(DUE, at('2026-10-29T12:00:00Z')), null, 'four weeks away: quiet');
  assert.equal(sourceReviewWarning(DUE, at('2026-11-16T00:00:00Z')), null, 'exactly 10 days away: quiet');
  const near = sourceReviewWarning(DUE, at('2026-11-16T00:00:01Z'));
  assert.match(near, /10 days away \(2026-11-26\): review the source register by 2026-11-19/);
  assert.match(sourceReviewWarning(DUE, at('2026-11-25T12:00:00Z')), /1 day away/);
  assert.match(sourceReviewWarning(DUE, at('2026-11-26T00:00:00Z')), /passed on 2026-11-26: every run holds/);
  assert.throws(() => sourceReviewWarning('not a date', at('2026-11-20T00:00:00Z')), /source_review_clock_invalid/);
});

test('the check clock is CHECK_NOW when given, refuses a malformed one, and the warning is an Actions annotation only in CI', () => {
  assert.equal(checkClock({ CHECK_NOW:'2026-11-17T09:00:00Z' }), at('2026-11-17T09:00:00Z'));
  assert.ok(Math.abs(checkClock({}) - Date.now()) < 5000);
  assert.throws(() => checkClock({ CHECK_NOW:'tomorrow' }), /check_now_invalid/);
  assert.equal(formatWarning('x', { GITHUB_ACTIONS:'true' }), '::warning title=Source review::x');
  assert.equal(formatWarning('x', {}), 'WARN: x');
});

test('npm run check prints the warning with a stubbed date near the lock and still passes; far from it, it prints none', () => {
  const policy = JSON.parse(readFileSync(new URL('../config/policy.json', import.meta.url)));
  const lock = Date.parse(policy.source_review_due);
  const near = check({ CHECK_NOW:new Date(lock - 9 * 86_400_000).toISOString() });
  assert.equal(near.status, 0, near.stderr);
  assert.match(near.stdout, /^WARN: source_review_due is 9 days away/m);
  assert.match(near.stdout, /^PASS: /m);
  const far = check({ CHECK_NOW:new Date(lock - 20 * 86_400_000).toISOString() });
  assert.equal(far.status, 0, far.stderr);
  assert.doesNotMatch(far.stdout, /WARN|::warning/);
  const ci = check({ CHECK_NOW:new Date(lock - 1 * 86_400_000).toISOString(), GITHUB_ACTIONS:'true' });
  assert.equal(ci.status, 0, ci.stderr);
  assert.match(ci.stdout, /^::warning title=Source review::source_review_due is 1 day away/m);
});
