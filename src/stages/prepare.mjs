import { createHash } from 'node:crypto';

const DAY = 86_400_000;
const WEIGHTS = Object.freeze({ fit: 30, project: 20, relationship: 20, distribution: 20, timing: 10 });
const POOLS = new Set(['builder', 'buyer', 'multiplier', 'amplifier', 'introducer', 'subject']);
const OPPORTUNITY_KINDS = new Set(['registry', 'community', 'integration', 'benchmark', 'partner']);
const BANNED_CLAIMS = [
  ['universal_coverage', /\b(?:any|every|all)\s+(?:(?:product|online|e-commerce)\s+)?(?:urls?|websites?|sites?|retailers?|domains?|stores?|pages?)\b/i],
  ['universal_coverage', /\b(?:works? everywhere|universal coverage|100\s*%\s+(?:coverage|accuracy|success)|zero failures?)\b/i],
  ['mainnet_claim', /\bmainnet\s+(?:(?:is|are|payments?|commerce)\s+)*(?:live|ready|enabled|available|launched)\b|\b(?:live|works?|available|launched)\s+(?:on\s+)?(?:Base\s+)?mainnet\b|\bproduction[- ]ready\s+x402\b/i],
  ['unsupported_hype', /\b(?:revolutionary|game[- ]changing)\b/i],
];
const WARMTH_CLAIM = /\b(?:you know|we (?:met|spoke|worked|discussed)|we['’]ve (?:met|spoken|worked)|worked together|our (?:conversation|meeting|shared history|time at)|as discussed|following up on our|I remember|when we|great (?:meeting|speaking|talking))\b/i;
// Ruling (Krish, 2026-10-27): someone already reached for Mindmake hears of Legibility as a Mindmake product, only in the
// words Krish approves for their record (docs/OUTREACH-TEMPLATE.md). Until he approves them this stays null, so every such
// person is held as partner_framing_missing. Shape: { bridge: { sent, replied, met }, shared, intro: [two sentences] },
// with {month} in each bridge line.
export const MINDMAKE_COPY = null;
const MINDMAKE_RECORD = ['state', 'by', 'state_at', 'last_touch_at', 'record_url'];
const MINDMAKE_STATES = new Set(['none', 'unknown', 'open', 'client', 'drafted', 'sent', 'replied', 'met']);
const MINDMAKE_TOUCHED = new Set(['drafted', 'sent', 'replied', 'met']);
const MINDMAKE_GAP_DAYS = 14;
const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const ANY_MINDMAKE = /\bmind\s*[/-]?\s*make(?:rs?)?\b/i;
const OFFER = /\bmindmake\.co\b|\b(?:thirty|30)[- ]day (?:paid )?proof\b|\bpaid (?:pilot|proof)\b|\bAI (?:brain|GTM)\b/i;
const PRIOR_CONTACT_CLAIM = /\b(?:I (?:wrote|sent|emailed|messaged) (?:to )?you|I (?:reached out|got in touch)|(?:my|our) (?:last|earlier|previous|recent|first) (?:note|email|message|call)|following up|circling back|in case (?:my|you missed)|thanks? (?:you )?for (?:coming back|getting back|your reply|replying|talking|speaking|meeting|making time))\b/i;
const MINDMAKE_HOLD_ACTIONS = {
  mindmake_history_unknown: 'Link the person to one Control Center contact and read their Mindmake record from Control Center, then re-run. Unknown is never read as none.',
  mindmake_thread_open: 'Leave the person to the open Mindmake item; re-read the record once it is at rest.',
  mindmake_client: 'Prepare nothing for a Mindmake client; Krish raises Legibility with a client himself, if at all.',
  mindmake_touch_too_recent: 'Wait until 14 full days after the last Mindmake touch, then re-read the record.',
};
const DRAFT_HOLD_ACTIONS = {
  partner_framing_missing: MINDMAKE_COPY ? 'Open with the sentences docs/OUTREACH-TEMPLATE.md gives for this Mindmake record and keep the rest of the template word for word.' : 'Held until Krish approves the opening words for someone already reached for Mindmake (docs/OUTREACH-TEMPLATE.md).',
  mindmake_claim_unsupported: 'Remove the sentence that names Mindmake, or use the approved line with the month (and year) from the record.',
  mindmake_named_without_touch: 'Keep the 21 October opening unchanged; Mindmake is named only to someone the record shows was reached for it.',
  prior_contact_claim_unsupported: 'Remove the claim of earlier contact; the only one allowed is the approved line for the record.',
  mindmake_offer_mentioned: 'Keep the one offer: the 30-day free trial of Legibility in exchange for feedback.',
  mindmake_record_not_cited: 'Cite the person record in Control Center in the draft sources.',
};

function compare(a, b) {
  return a < b ? -1 : a > b ? 1 : 0;
}

function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  }
  return JSON.stringify(value ?? null);
}

function hash(value) {
  return createHash('sha256').update(typeof value === 'string' ? value : canonical(value)).digest('hex');
}

function present(value) {
  return typeof value === 'string' && value.trim().length > 0;
}

function stringOrNull(value) {
  return typeof value === 'string' ? value : null;
}

function validUrl(value) {
  if (!present(value)) return false;
  try {
    const url = new URL(value);
    return ['https:', 'http:'].includes(url.protocol) && !url.username && !url.password;
  } catch {
    return false;
  }
}

function timestamp(value) {
  return typeof value === 'string' && /T.*(?:Z|[+-]\d{2}:\d{2})$/.test(value) ? Date.parse(value) : NaN;
}

function fresh(value, now, ageDays) {
  const time = timestamp(value);
  return Number.isFinite(time) && time <= now && now - time <= ageDays * DAY;
}

function clockOf(now) {
  const clock = typeof now === 'number' ? now : timestamp(now);
  if (!Number.isFinite(clock)) throw new TypeError('at must be an ISO timestamp with an explicit timezone.');
  return clock;
}

function isRecord(value) {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function recordLink(value) {
  if (!present(value) || value.length > 2000 || !/^https:\/\/\S+$/.test(value)) return false;
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}

// Control Center's Mindmake record for the person, re-checked here because prepare can be reached without the wire.
// Absent or malformed is null: unknown, which holds and is never read as none. Extra keys are not projected.
function priorMindmake(contact, now) {
  const record = contact?.prior_mindmake;
  if (!isRecord(record) || MINDMAKE_RECORD.some(key => !Object.hasOwn(record, key))) return null;
  const { state, by, state_at: stateAt, last_touch_at: lastTouchAt, record_url: recordUrl } = record;
  if (!MINDMAKE_STATES.has(state) || state === 'unknown' || !recordLink(recordUrl)) return null;
  const dated = value => Number.isFinite(timestamp(value)) && timestamp(value) <= now;
  const sender = state === 'met' ? by === 'krish' : ['sent', 'replied'].includes(state) ? ['krish', 'other'].includes(by) : by === null;
  const dates = state === 'none' ? stateAt === null && lastTouchAt === null
    : MINDMAKE_TOUCHED.has(state) ? dated(stateAt) && dated(lastTouchAt)
      : (stateAt === null || dated(stateAt)) && (lastTouchAt === null || dated(lastTouchAt));
  if (!sender || !dates || (stateAt !== null && lastTouchAt !== null && timestamp(lastTouchAt) < timestamp(stateAt))) return null;
  return { state, by, state_at: stateAt, last_touch_at: lastTouchAt, record_url: recordUrl };
}

/** The hold, if any, that the person's Mindmake record puts on a Legibility invitation, in this order. */
export function mindmakeHolds(candidate, now) {
  const clock = clockOf(now);
  const record = priorMindmake(candidate?.contact, clock);
  if (!record) return ['mindmake_history_unknown'];
  if (record.state === 'open') return ['mindmake_thread_open'];
  if (record.state === 'client') return ['mindmake_client'];
  if (MINDMAKE_TOUCHED.has(record.state) && clock - timestamp(record.last_touch_at) < MINDMAKE_GAP_DAYS * DAY) return ['mindmake_touch_too_recent'];
  return [];
}

// The subject and greeting lines are linted but are never the opening; the body is split into sentences.
function sentences(text) {
  const lines = text.replace(/[‘’]/g, "'").replace(/[ \t]+/g, ' ').split(/\r?\n/).map(line => line.trim());
  const head = [];
  while (lines.length && !lines[0]) lines.shift();
  if (/^Subject:/.test(lines[0] ?? '')) head.push(lines.shift());
  while (lines.length && !lines[0]) lines.shift();
  if (/^(?:Hi|Hello|Dear)\b.{0,80},$/.test(lines[0] ?? '')) head.push(lines.shift());
  return { head, body: lines.filter(Boolean).join(' ').split(/(?<=[.!?])\s+/).filter(Boolean) };
}

function expectedOpening(record, now, copy) {
  if (!copy || !MINDMAKE_TOUCHED.has(record.state)) return [];
  const at = new Date(timestamp(record.state_at));
  const month = `${MONTHS[at.getUTCMonth()]}${at.getUTCFullYear() === new Date(now).getUTCFullYear() ? '' : ` ${at.getUTCFullYear()}`}`;
  return record.by === 'krish' && ['sent', 'replied', 'met'].includes(record.state) ? [copy.bridge[record.state].replaceAll('{month}', month), copy.shared] : [...copy.intro];
}

/** Deterministic checks of a draft against the person's Mindmake record. A record that holds returns its hold. */
export function mindmakeProblems(candidate, now, copy = MINDMAKE_COPY) {
  const clock = clockOf(now);
  const held = mindmakeHolds(candidate, clock);
  if (held.length) return held;
  const record = priorMindmake(candidate.contact, clock);
  const draft = candidate.draft;
  if (!draft || !present(draft.text)) return ['missing_draft'];
  const touched = MINDMAKE_TOUCHED.has(record.state);
  const firstTouch = candidate.contact.last_sent_at === null;
  const expected = expectedOpening(record, clock, copy);
  const { head, body } = sentences(draft.text);
  const all = [...head, ...body];
  const named = all.filter(sentence => ANY_MINDMAKE.test(sentence));
  const problems = [];
  if (touched && firstTouch && (expected.length === 0 || expected.some((line, index) => body[index] !== line))) problems.push('partner_framing_missing');
  if (touched && (named.some(sentence => !expected.includes(sentence)) || new Set(named).size !== named.length)) problems.push('mindmake_claim_unsupported');
  if (record.state === 'none' && named.length) problems.push('mindmake_named_without_touch');
  if (firstTouch && all.some(sentence => !expected.includes(sentence) && PRIOR_CONTACT_CLAIM.test(sentence))) problems.push('prior_contact_claim_unsupported');
  if (OFFER.test(all.join(' '))) problems.push('mindmake_offer_mentioned');
  if (!Array.isArray(draft.source_refs) || !draft.source_refs.includes(record.record_url)) problems.push('mindmake_record_not_cited');
  return [...new Set(problems)].sort();
}

function weightScore(scores) {
  if (!scores || Object.keys(WEIGHTS).some(key => !Number.isFinite(scores[key]) || scores[key] < 0 || scores[key] > 1)) return null;
  return Math.round(Object.entries(WEIGHTS).reduce((total, [key, weight]) => total + scores[key] * weight, 0) * 1e6) / 1e6;
}

function boundedInteger(value, fallback, maximum, minimum = 0) {
  if (value === undefined) return fallback;
  if (!Number.isInteger(value) || value < minimum) throw new TypeError('Policy limits must be non-negative integers.');
  return Math.min(value, maximum);
}

function makeHold(code, target, nextAction, details = {}) {
  return { code, ...target, next_action: nextAction, visibility: 'private', ...details };
}

function lineageFor(snapshot, candidate) {
  return {
    snapshot_id: stringOrNull(snapshot.snapshot_id),
    captured_at: stringOrNull(snapshot.captured_at),
    app_revision: stringOrNull(snapshot.app_revision),
    icp_revision: stringOrNull(snapshot.icp?.revision),
    signal_observed_at: stringOrNull(candidate.current_signal?.observed_at),
    candidate_sha256: hash(candidateIdentity(candidate)),
  };
}

function candidatePacket(candidate) {
  return {
    id: candidate.id,
    account_id: stringOrNull(candidate.account_id),
    pool: candidate.pool,
    company: stringOrNull(candidate.company),
    project: stringOrNull(candidate.project),
    channel: stringOrNull(candidate.channel),
    current_signal: candidate.current_signal == null ? null : {
      text: stringOrNull(candidate.current_signal.text),
      url: stringOrNull(candidate.current_signal.url),
      observed_at: stringOrNull(candidate.current_signal.observed_at),
    },
    relationship: candidate.relationship == null ? null : {
      kind: stringOrNull(candidate.relationship.kind),
      evidence: stringOrNull(candidate.relationship.evidence),
      url: stringOrNull(candidate.relationship.url),
    },
    contact: candidate.contact == null ? null : {
      status: stringOrNull(candidate.contact.status),
      last_sent_at: stringOrNull(candidate.contact.last_sent_at),
      followups: Number.isInteger(candidate.contact.followups) ? candidate.contact.followups : null,
      prior_mindmake: isRecord(candidate.contact.prior_mindmake) ? Object.fromEntries(MINDMAKE_RECORD.map(key => [key, stringOrNull(candidate.contact.prior_mindmake[key])])) : null,
    },
    partner_id: stringOrNull(candidate.partner_id),
  };
}

function candidateIdentity(candidate) {
  return {
    ...candidatePacket(candidate),
    scores: Object.fromEntries(Object.keys(WEIGHTS).map(key => [key, Number.isFinite(candidate.scores?.[key]) ? candidate.scores[key] : null])),
    draft: candidate.draft == null ? null : {
      text: stringOrNull(candidate.draft.text),
      source_refs: Array.isArray(candidate.draft.source_refs) ? candidate.draft.source_refs.filter(ref => typeof ref === 'string') : [],
    },
  };
}

function opportunityPacket(opportunity) {
  return {
    id: opportunity.id,
    kind: opportunity.kind,
    title: opportunity.title,
    url: opportunity.url,
    evidence_url: opportunity.evidence_url,
    observed_at: opportunity.observed_at,
    status: opportunity.status,
    effort_minutes: opportunity.effort_minutes,
    visibility: 'private',
  };
}

function sourceRefs(candidate) {
  return [...new Set([candidate.current_signal?.url, candidate.relationship?.url].filter(validUrl))].sort();
}

function candidateTask(snapshot, candidate, score, type, requestedWork, flags = []) {
  const content = {
    type,
    status: 'work_required',
    visibility: 'private',
    approval_required: false,
    candidate_id: candidate.id,
    candidate: candidatePacket(candidate),
    score,
    lineage: lineageFor(snapshot, candidate),
    source_refs: sourceRefs(candidate),
    risk_flags: [...new Set(flags)].sort(),
    requested_work: requestedWork,
  };
  return { id: `task_${hash(content).slice(0, 24)}`, ...content };
}

function approvalAction(snapshot, candidate, score, type, at, flags) {
  const content = {
    type,
    status: 'pending_human',
    visibility: 'private',
    approval_required: true,
    candidate_id: candidate.id,
    candidate: candidatePacket(candidate),
    score,
    lineage: lineageFor(snapshot, candidate),
    source_refs: [...new Set(candidate.draft.source_refs)].sort(),
    exact_text: candidate.draft.text,
    text_sha256: hash(candidate.draft.text),
    risk_flags: [...new Set(flags)].sort(),
  };
  const payloadSha256 = hash(content);
  return {
    id: `approval_${payloadSha256.slice(0, 24)}`,
    ...content,
    payload_sha256: payloadSha256,
    created_at: new Date(at).toISOString(),
    expires_at: new Date(at + 2 * DAY).toISOString(),
  };
}

/** Every check of the exact draft: sources, claims, placeholders, specificity and the person's Mindmake record. */
export function draftProblems(candidate, now) {
  const draft = candidate.draft;
  const problems = [];
  if (!draft || !present(draft.text)) return ['missing_draft'];
  if (!Array.isArray(draft.source_refs) || draft.source_refs.some(ref => !validUrl(ref))) problems.push('invalid_source_refs');
  const refs = Array.isArray(draft.source_refs) ? draft.source_refs : [];
  if (!refs.includes(candidate.current_signal?.url)) problems.push('signal_source_not_cited');
  const hasPath = present(candidate.relationship?.evidence) && validUrl(candidate.relationship?.url);
  const claimsWarmth = WARMTH_CLAIM.test(draft.text);
  if (claimsWarmth && (candidate.relationship?.kind === 'cold' || !hasPath)) problems.push('invented_relationship');
  if ((claimsWarmth || candidate.relationship?.kind !== 'cold') && !refs.includes(candidate.relationship?.url)) problems.push('relationship_source_not_cited');
  for (const [code, pattern] of BANNED_CLAIMS) if (pattern.test(draft.text)) problems.push(code);
  if (/\[[^\]]+\]|\{\{[^}]+\}\}/.test(draft.text)) problems.push('unresolved_placeholder');
  if (candidate.relationship?.kind === 'cold' && (!present(candidate.company) || !present(candidate.project) || !draft.text.toLowerCase().includes(candidate.company.toLowerCase()) || !draft.text.toLowerCase().includes(candidate.project.toLowerCase()))) problems.push('cold_draft_not_specific');
  problems.push(...mindmakeProblems(candidate, now));
  return [...new Set(problems)].sort();
}

/**
 * Prepare private work and approval packets from a supplied, validated evidence snapshot.
 * This pure stage never fetches, drafts copy, approves, publishes, or sends anything.
 * A source reference proves lineage to the snapshot, not independent source verification.
 */
export function prepare(snapshot, at, policy = {}) {
  const now = timestamp(at);
  if (!Number.isFinite(now)) throw new TypeError('at must be an ISO timestamp with an explicit timezone.');
  if (!snapshot || typeof snapshot !== 'object') throw new TypeError('snapshot must be an object.');
  const maxActions = boundedInteger(policy.max_actions, 5, 5);
  const maxAge = boundedInteger(policy.max_candidate_age_days, 30, 30, 1);
  const maxFollowups = boundedInteger(policy.max_followups, 1, 1);
  const actions = [];
  const holds = [];
  const opportunities = [];
  const candidateActions = [];
  const distributionActions = [];
  const icpReady = snapshot.icp?.product_slug === 'legibility' && snapshot.icp?.source === 'control-center:product_icp' && snapshot.icp?.status === 'approved' && present(snapshot.icp?.buyer_definition) && present(snapshot.icp?.revision) && fresh(snapshot.icp?.reviewed_at, now, 30);
  const lineageReady = present(snapshot.snapshot_id) && fresh(snapshot.captured_at, now, maxAge) && present(snapshot.app_revision);
  const suppressed = new Set((snapshot.suppressions ?? []).map(item => item.candidate_id));
  if (!icpReady) holds.push(makeHold('icp_not_current_approved', {}, 'Obtain a current approved Legibility buyer definition from Control Center product_icp, with its product binding, source and revision, before preparing prospecting.'));
  if (!lineageReady) holds.push(makeHold('source_lineage_missing_or_stale', {}, 'Resolve the current app revision and timestamped snapshot provenance before requesting human approval.'));
  if (snapshot.coverage?.candidates !== true) holds.push(makeHold('candidate_coverage_unknown', {}, 'Complete candidate-source pagination and confirm coverage before prospecting.'));
  if (snapshot.coverage?.opportunities !== true) holds.push(makeHold('opportunity_coverage_unknown', {}, 'Complete distribution-source coverage before treating the opportunity inventory as complete.'));

  const grouped = new Map();
  for (const candidate of snapshot.candidates ?? []) {
    if (!present(candidate?.id)) {
      holds.push(makeHold('invalid_candidate_id', {}, 'Assign a stable candidate ID before research or approval.'));
      continue;
    }
    const entries = grouped.get(candidate.id) ?? [];
    entries.push(candidate);
    grouped.set(candidate.id, entries);
  }
  for (const [id, entries] of [...grouped].sort(([a], [b]) => compare(a, b))) {
    const target = { candidate_id: id };
    if (suppressed.has(id) || entries.some(candidate => ['opt_out', 'bounced', 'complaint'].includes(candidate.contact?.status))) {
      holds.push(makeHold('suppressed', target, 'Keep this candidate excluded from preparation and recheck the authoritative suppression source at any later execution boundary.'));
      continue;
    }
    if (new Set(entries.map(candidate => hash(candidateIdentity(candidate)))).size > 1) {
      holds.push(makeHold('conflicting_candidate', target, 'Reconcile duplicate candidate records against the authoritative source.'));
      continue;
    }
    const candidate = entries[0];
    const score = weightScore(candidate.scores);
    if (score === null || !POOLS.has(candidate.pool) || !['warm', 'cold', 'introducer'].includes(candidate.relationship?.kind)) {
      holds.push(makeHold('invalid_candidate', target, 'Supply a valid pool, relationship classification, and five factor scores between 0 and 1.'));
      continue;
    }
    if (!icpReady || snapshot.coverage?.candidates !== true) continue;
    if (candidate.contact?.status !== 'clear') {
      holds.push(makeHold('contact_status_unknown', target, 'Resolve contact eligibility in the authoritative contact source before preparing any invitation.'));
      continue;
    }
    if (!Number.isInteger(candidate.contact.followups) || candidate.contact.followups < 0 || (candidate.contact.followups >= maxFollowups && candidate.contact.last_sent_at !== null) || (candidate.contact.last_sent_at === null && candidate.contact.followups !== 0)) {
      holds.push(makeHold('followup_limit_or_invalid_history', target, 'Review contact history; the engine permits at most one follow-up and never schedules a sequence.'));
      continue;
    }
    if (candidate.contact.last_sent_at !== null && (!Number.isFinite(timestamp(candidate.contact.last_sent_at)) || timestamp(candidate.contact.last_sent_at) > now)) {
      holds.push(makeHold('invalid_contact_history', target, 'Correct the missing, invalid, or future last-contact timestamp.'));
      continue;
    }
    const [mindmakeHold] = mindmakeHolds(candidate, now);
    if (mindmakeHold) {
      holds.push(makeHold(mindmakeHold, target, MINDMAKE_HOLD_ACTIONS[mindmakeHold]));
      continue;
    }
    if (!present(candidate.current_signal?.text) || !validUrl(candidate.current_signal?.url) || !fresh(candidate.current_signal?.observed_at, now, maxAge)) {
      holds.push(makeHold('signal_not_current_verified_reference', target, 'Research a relevant signal with an HTTP(S) source URL and a non-future observation inside the configured freshness window.'));
      candidateActions.push(candidateTask(snapshot, candidate, score, 'research_candidate', 'Replace missing, stale, invalid, or future relevance evidence with a current sourced signal.', ['evidence_required']));
      continue;
    }
    if (!present(candidate.channel)) {
      holds.push(makeHold('missing_channel', target, 'Name the proposed contact channel before drafting.'));
      continue;
    }
    const hasPath = present(candidate.relationship.evidence) && validUrl(candidate.relationship.url);
    if (candidate.relationship.kind !== 'cold' && !hasPath) {
      holds.push(makeHold('relationship_not_evidenced', target, 'Verify the relationship or introduction path; names and shared employment do not prove familiarity.'));
      candidateActions.push(candidateTask(snapshot, candidate, score, 'research_candidate', 'Verify the claimed warm relationship or introduction path with a source.', ['relationship_evidence_required']));
      continue;
    }
    if (candidate.relationship.kind === 'cold' && (!present(candidate.company) || !present(candidate.project))) {
      holds.push(makeHold('cold_context_incomplete', target, 'Research the named company and current relevant project before preparing a cold invitation.'));
      candidateActions.push(candidateTask(snapshot, candidate, score, 'research_candidate', 'Establish a named company, a relevant current project, and a specific reason for an individual invitation.', ['cold_context_required']));
      continue;
    }
    if (score < 60 || (score < 70 && (candidate.relationship.kind !== 'introducer' || !hasPath))) {
      const code = score < 60 ? 'research_below_threshold' : 'introduction_path_required';
      holds.push(makeHold(code, target, score < 60 ? 'Research fit and relevance; the score is below 60.' : 'Find an evidence-backed introduction path; scores from 60 to below 70 do not qualify for direct invitations.', { score }));
      candidateActions.push(candidateTask(snapshot, candidate, score, 'research_candidate', score < 60 ? 'Research the lowest-scoring fit factors before proposing outreach.' : 'Find and source a credible introduction path before drafting an introducer request.'));
      continue;
    }
    const intro = score < 70 || candidate.relationship.kind === 'introducer';
    const type = intro ? 'introduction_request' : candidate.contact.last_sent_at !== null ? 'single_followup' : 'direct_invitation';
    const flags = [candidate.relationship.kind === 'cold' ? 'named_cold_requires_human_review' : 'private_relationship_evidence', 'source_facts_require_human_review'];
    if (candidate.contact.last_sent_at !== null) flags.push('single_followup_only');
    if (MINDMAKE_TOUCHED.has(priorMindmake(candidate.contact, now).state)) flags.push('prior_mindmake_outreach');
    const problems = draftProblems(candidate, now);
    if (problems.length) {
      for (const code of problems) holds.push(makeHold(code, target, DRAFT_HOLD_ACTIONS[code] ?? (code === 'missing_draft' ? 'Prepare an individual draft from the cited evidence for human review.' : 'Revise the exact draft and its source references before requesting approval.')));
      candidateActions.push(candidateTask(snapshot, candidate, score, intro ? 'draft_introduction_request' : type === 'single_followup' ? 'draft_single_followup' : 'draft_direct_invitation', 'Write or repair a single evidence-backed message, preserving product limitations and citing the relevance signal and any relationship claim.', [...flags, ...problems]));
      continue;
    }
    if (!lineageReady) {
      candidateActions.push(candidateTask(snapshot, candidate, score, 'verify_source_lineage', 'Resolve a current app revision and a fresh, timestamped snapshot ID before presenting the supplied draft for approval.', ['source_lineage_required']));
      continue;
    }
    candidateActions.push(approvalAction(snapshot, candidate, score, type, now, flags));
  }

  const opportunityGroups = new Map();
  for (const opportunity of snapshot.opportunities ?? []) {
    if (!present(opportunity?.id)) {
      holds.push(makeHold('invalid_opportunity_id', {}, 'Assign a stable distribution opportunity ID.'));
      continue;
    }
    const group = opportunityGroups.get(opportunity.id) ?? [];
    group.push(opportunity);
    opportunityGroups.set(opportunity.id, group);
  }
  for (const [id, entries] of [...opportunityGroups].sort(([a], [b]) => compare(a, b))) {
    const opportunity = entries[0];
    if (new Set(entries.map(hash)).size > 1 || !OPPORTUNITY_KINDS.has(opportunity.kind) || !['uncovered', 'drafted', 'covered'].includes(opportunity.status) || !present(opportunity.title) || !validUrl(opportunity.url) || !validUrl(opportunity.evidence_url) || !fresh(opportunity.observed_at, now, maxAge) || !Number.isFinite(opportunity.effort_minutes) || opportunity.effort_minutes < 0) {
      holds.push(makeHold('invalid_or_stale_opportunity', { opportunity_id: id }, 'Verify the distribution opportunity, current source evidence, and effort before preparing an asset.'));
      continue;
    }
    const entry = opportunityPacket(opportunity);
    opportunities.push(entry);
    if (opportunity.status === 'covered' || snapshot.coverage?.opportunities !== true) continue;
    const content = {
      type: opportunity.status === 'drafted' ? 'review_distribution_asset' : 'prepare_distribution_asset',
      status: 'work_required',
      visibility: 'private',
      approval_required: false,
      opportunity_id: id,
      kind: opportunity.kind,
      effort_minutes: opportunity.effort_minutes,
      source_refs: [...new Set([opportunity.url, opportunity.evidence_url])].sort(),
      lineage: { snapshot_id: stringOrNull(snapshot.snapshot_id), captured_at: stringOrNull(snapshot.captured_at), app_revision: stringOrNull(snapshot.app_revision), opportunity_sha256: hash(entry) },
      risk_flags: ['publication_requires_separate_approval'],
      requested_work: opportunity.status === 'drafted' ? 'Review the exact asset, source evidence, destination rules, and product claims before requesting publication approval.' : 'Prepare a sourced distribution asset after checking the destination rules; obtain separate approval before publication.',
    };
    distributionActions.push({ id: `task_${hash(content).slice(0, 24)}`, ...content });
  }
  candidateActions.sort((a, b) => b.score - a.score || compare(a.candidate_id, b.candidate_id));
  distributionActions.sort((a, b) => a.effort_minutes - b.effort_minutes || compare(a.opportunity_id, b.opportunity_id));
  opportunities.sort((a, b) => a.effort_minutes - b.effort_minutes || compare(a.id, b.id));
  const eligible = [...candidateActions, ...distributionActions];
  actions.push(...eligible.slice(0, maxActions));
  if (eligible.length > maxActions) holds.push(makeHold('action_cap', {}, 'Finish or explicitly replace the current bounded action batch before preparing the remaining work.', { deferred_count: eligible.length - maxActions }));
  holds.sort((a, b) => compare(`${a.candidate_id ?? ''}:${a.opportunity_id ?? ''}:${a.code}`, `${b.candidate_id ?? ''}:${b.opportunity_id ?? ''}:${b.code}`));
  return { actions, holds, opportunities };
}
