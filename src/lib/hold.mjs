import { readFileSync } from 'node:fs';
import { seal } from '../orchestrator.mjs';
import { VERSION } from '../guards/wire.mjs';

// Ruling (Krish, 2026-10-29): Not ready means a held activation state: no wake, no asks on his list, no growth council
// move, and the bearer stays valid. A held run still measures, inside the walls, so the North Star number stays read; it
// proposes nothing, asks him nothing, and reports exactly one hold naming what readiness needs.
//
// Two switches hold the engine, and either is enough:
//   - this repository's own flag, config/activation.json `{ "state": "held" | "active" }`. Missing, unreadable or any
//     other value reads as held: only a file that says `active` releases it;
//   - Control Center: capabilities `activation.state` is `held`, or the directive's next action is its held rule
//     (HELD_RULE in Control Center's src/lib/growthEngines.ts).
export const HOLD_REASON = 'engine_held';
const CC_HELD_RULE = /^Krish has held this engine/;
const clip = (text, max) => text.length <= max ? text : `${text.slice(0, max - 3).trimEnd()}...`;

/** The local flag. Never throws: anything but a readable `{ "state": "active" }` is held. */
export function readActivation(path) {
  try {
    const body = JSON.parse(readFileSync(path, 'utf8'));
    if (body?.state === 'active') return { state:'active', reason:null };
    if (body?.state === 'held') return { state:'held', reason:'local_flag_held' };
    return { state:'held', reason:'local_flag_unknown' };
  } catch { return { state:'held', reason:'local_flag_unreadable' }; }
}

/** Who holds the engine this run: [] means it runs; otherwise 'krish_local' and/or 'control_center'. */
export function heldBy({ local = { state:'held' }, activation = null, directive = null } = {}) {
  const by = [];
  if (local?.state !== 'active') by.push('krish_local');
  if (activation === 'held' || CC_HELD_RULE.test(directive?.next_action?.instruction ?? '')) by.push('control_center');
  return by;
}

// What readiness needs, in plain words: every hold the run would otherwise have carried, then the standing items.
export function readinessNeeds(envelope, policy) {
  const open = (envelope.holds ?? []).map(h => h.reason).filter(r => r !== HOLD_REASON);
  const needs = [...new Set(open)];
  if (!policy?.campaign?.activated_at) needs.push('campaign_clock_not_activated');
  return needs;
}

// Activity lines that describe asks: never on a held report, whose only output for Krish is the hold.
const ASK_LINES = /^(?:Prepared \d+ named invitation|Recommended constraint:)/;

/** The one report a held run sends: measured objectives kept, no proposals, one hold. Sealed again. */
export function heldReport(envelope, { by, policy }) {
  const needs = readinessNeeds(envelope, policy);
  const who = by.includes('control_center') && by.includes('krish_local') ? 'on Growth > Engines in Control Center and in config/activation.json'
    : by.includes('control_center') ? 'on Growth > Engines in Control Center' : 'in config/activation.json';
  const detail = clip(`Krish has held this engine until it is ready (Ruling, Krish, 2026-10-29), ${who}. Ready needs: ${needs.length ? needs.join(', ') : 'nothing open in this run'}. It clears when each of those is cleared and Krish releases the engine in both places. Nothing was proposed and nothing was sent.`, 1000);
  // A held run spends no credits, so it carries no credits_spent and says 1.0.0.
  const { payload_sha256, credits_spent, ...body } = envelope;
  return seal({
    ...body,
    schema_version:VERSION,
    status:'held',
    activity:[...body.activity.filter(a => !ASK_LINES.test(a.line)),
      { line:clip(`Held by Krish: measured inside the walls, proposed nothing and put no ask on his list. Ready needs ${needs.length} item${needs.length === 1 ? '' : 's'}.`, 500), evidence_url:null }].slice(0, 40),
    proposals:[],
    holds:[{ reason:HOLD_REASON, detail }],
  });
}
