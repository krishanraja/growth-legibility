import { capturedBy, utcInstant, validateIcp } from '../guards/wire.mjs';

// What Control Center's directive carries for this engine (protocol 1.13.0, ENGINE-PROTOCOL.md "The buyer, the site and
// the research desk, for growth-legibility"): Legibility's buyer from product_icp, legibility.io's readings, and whether
// the research desk is open. It reads; it never writes, sends or posts, and it fills nothing in from anywhere else.
// Everything is gated on the capabilities, so against a Control Center that does not serve 1.13.0 the run is unchanged.
// Only codes and counts leave in the run summary: never the buyer's words, a measurement id or a page.

const SNAKE = /^[a-z][a-z0-9_]{0,63}$/;
const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
const DAY = 86_400_000;
const clip = (text, max) => text.length <= max ? text : `${text.slice(0, max - 3).trimEnd()}...`;
const codeOf = e => { const m = /^invalid_contract:([a-z0-9_]+)$/.exec(e?.message ?? ''); return m ? `icp_${m[1]}`.replace(/^icp_icp/, 'icp') : 'icp_refused'; };

/**
 * The buyer the directive carries, judged by the same wire rule as snapshot.icp (validateIcp), its review no later than
 * the run clock. Returns { icp, state, reason }: state is not_served (the capabilities do not say features.icp), unread
 * (served, but Control Center could not read product_icp today, so the directive left it out), refused (it broke the
 * wire rule), or the buyer's own status (approved or missing). Only an approved or missing buyer is returned.
 */
export function readIcp(directive, features, at) {
  if (features?.icp !== true) return { icp:null, state:'not_served', reason:'icp_not_served' };
  const raw = directive?.icp;
  if (raw === undefined || raw === null) return { icp:null, state:'unread', reason:'icp_unread' };
  let icp;
  try {
    icp = validateIcp(structuredClone(raw), utcInstant(at) ? capturedBy(at) : () => false);
    // Stricter than the snapshot rule: whatever its status, it is Legibility's own row from product_icp, all six keys.
    if (icp.product_slug !== 'legibility' || icp.source !== 'control-center:product_icp' || !['approved', 'missing'].includes(icp.status)) throw new Error('invalid_contract:icp_product_source');
    if (Object.keys(icp).length !== 6) throw new Error('invalid_contract:icp_shape');
  } catch (e) { return { icp:null, state:'refused', reason:codeOf(e) }; }
  return { icp, state:icp.status, reason:null };
}

/**
 * The snapshot with Control Center's buyer as its icp. Control Center is the one source of the buyer, so a served one
 * replaces whatever the snapshot carried. A buyer reviewed after the snapshot was captured cannot be bound to it: the
 * snapshot then carries a missing buyer, which holds, and the next run reads both again.
 */
export function applyIcp(snapshot, icp) {
  const next = structuredClone(snapshot);
  try { validateIcp(structuredClone(icp), capturedBy(next.captured_at)); next.icp = structuredClone(icp); return { snapshot:next, reason:null }; }
  catch { next.icp = { status:'missing' }; return { snapshot:next, reason:'icp_reviewed_after_capture' }; }
}

/** Whether the capabilities open the research desk to this engine, and how much a day: availability only, nothing asked. */
export function researchAvailability(features, research) {
  if (features?.research !== true || !research || typeof research !== 'object') return { state:'not_served', kinds:[], per_day:{} };
  const kinds = (Array.isArray(research.kinds) ? research.kinds : []).filter(k => SNAKE.test(k)).slice(0, 10);
  const per_day = Object.fromEntries(kinds.map(k => [k, Number.isInteger(research.per_day?.[k]) && research.per_day[k] >= 0 ? research.per_day[k] : null]));
  return { state:'served', kinds, per_day };
}

const sessionsIn = (days, from, to) => {
  const inside = days.filter(d => d.date > from && d.date <= to);
  const read = inside.filter(d => typeof d.sessions === 'number' && Number.isFinite(d.sessions) && d.sessions >= 0);
  return { total:read.reduce((n, d) => n + d.sessions, 0), days:read.length };
};
const shift = (day, n) => new Date(Date.parse(`${day}T00:00:00Z`) + n * DAY).toISOString().slice(0, 10);

/**
 * One activity line on legibility.io's traffic, from the directive's web_analytics (1.10.0 block, 1.13.0 daily and
 * health): sessions over the last 7 days on file against the 7 before, each said with how many days had a reading, and
 * the site check in its own words. Unknown is said, never a zero. Nothing when the directive carries no legibility.io
 * block. Counts only: no measurement id, page or source name.
 */
export function siteActivity(web) {
  if (!web || typeof web !== 'object' || web.property !== 'legibility') return [];
  const health = web.health && typeof web.health === 'object' && typeof web.health.line === 'string' && DAY_RE.test(web.health.as_of ?? '')
    ? ` Site check ${web.health.as_of}: ${clip(web.health.line.replace(/\s+/g, ' ').trim(), 200)}` : '';
  const days = (Array.isArray(web.daily) ? web.daily : []).filter(d => d && typeof d === 'object' && DAY_RE.test(d.date ?? ''));
  if (!days.length) {
    const why = !Array.isArray(web.daily) ? 'Control Center did not send the daily totals today.' : 'No daily totals are on file for the site.';
    return [{ line:clip(`legibility.io traffic, from Google Analytics through Control Center: unknown. ${why}${health}`, 500), evidence_url:null }];
  }
  const last = days.map(d => d.date).sort().at(-1);
  const now = sessionsIn(days, shift(last, -7), last), before = sessionsIn(days, shift(last, -14), shift(last, -7));
  const said = (s, n) => s.days ? `${s.total} session${s.total === 1 ? '' : 's'} (${s.days} of ${n} days read)` : 'unknown (no day read)';
  return [{ line:clip(`legibility.io traffic, from Google Analytics through Control Center: ${said(now, 7)} in the 7 days to ${last}, against ${said(before, 7)} the 7 days before.${health}`, 500), evidence_url:null }];
}
