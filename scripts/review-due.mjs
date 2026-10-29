// The source review's early warning (docs/GET-GOING.md, "1E again"). From config/policy.json source_review_due every run
// holds and prepares nothing, so `npm run check` warns once the lock is under WARN_DAYS away, and keeps warning after it.
// A warning never fails the check: the daily run must not stop for it (docs/FAILURES.md F21). The review itself is due a
// week before the lock (REVIEW_LEAD_DAYS), and moving the date without reviewing the sources does not renew it.
export const WARN_DAYS = 10;
export const REVIEW_LEAD_DAYS = 7;
const DAY = 86_400_000;

/** null while the lock is WARN_DAYS or more away; otherwise one plain line saying when the review is due. */
export function sourceReviewWarning(due, now, { warnDays = WARN_DAYS, leadDays = REVIEW_LEAD_DAYS } = {}) {
  const lock = Date.parse(due);
  if (!Number.isFinite(lock) || !Number.isFinite(now)) throw new Error('source_review_clock_invalid');
  const left = lock - now;
  if (left >= warnDays * DAY) return null;
  const reviewBy = new Date(lock - leadDays * DAY).toISOString().slice(0, 10);
  const lockDay = new Date(lock).toISOString().slice(0, 10);
  if (left <= 0) return `source_review_due passed on ${lockDay}: every run holds and prepares nothing until the source register is reviewed (docs/SOURCE-REGISTER.md; docs/GET-GOING.md, "1E again").`;
  const days = Math.ceil(left / DAY);
  return `source_review_due is ${days} day${days === 1 ? '' : 's'} away (${lockDay}): review the source register by ${reviewBy}, or every run holds from ${lockDay} (docs/SOURCE-REGISTER.md; docs/GET-GOING.md, "1E again").`;
}

/** The check's clock: CHECK_NOW (an ISO instant, for tests) or now. */
export function checkClock(env = process.env) {
  if (env.CHECK_NOW === undefined || env.CHECK_NOW === '') return Date.now();
  const at = Date.parse(env.CHECK_NOW);
  if (!/^\d{4}-\d{2}-\d{2}T/.test(env.CHECK_NOW) || !Number.isFinite(at)) throw new Error('check_now_invalid');
  return at;
}

/** As a GitHub Actions annotation in CI, a plain line elsewhere. */
export function formatWarning(text, env = process.env) {
  return env.GITHUB_ACTIONS === 'true' ? `::warning title=Source review::${text}` : `WARN: ${text}`;
}
