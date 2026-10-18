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

function draftProblems(candidate) {
  const draft = candidate.draft;
  const problems = [];
  if (!draft || !present(draft.text)) return ['missing_draft'];
  if (!Array.isArray(draft.source_refs) || draft.source_refs.some(ref => !validUrl(ref))) problems.push('invalid_source_refs');
  const refs = Array.isArray(draft.source_refs) ? draft.source_refs : [];
  if (!refs.includes(candidate.current_signal.url)) problems.push('signal_source_not_cited');
  const hasPath = present(candidate.relationship?.evidence) && validUrl(candidate.relationship?.url);
  const claimsWarmth = WARMTH_CLAIM.test(draft.text);
  if (claimsWarmth && (candidate.relationship?.kind === 'cold' || !hasPath)) problems.push('invented_relationship');
  if ((claimsWarmth || candidate.relationship?.kind !== 'cold') && !refs.includes(candidate.relationship?.url)) problems.push('relationship_source_not_cited');
  for (const [code, pattern] of BANNED_CLAIMS) if (pattern.test(draft.text)) problems.push(code);
  if (/\[[^\]]+\]|\{\{[^}]+\}\}/.test(draft.text)) problems.push('unresolved_placeholder');
  if (candidate.relationship?.kind === 'cold' && (!draft.text.toLowerCase().includes(candidate.company.toLowerCase()) || !draft.text.toLowerCase().includes(candidate.project.toLowerCase()))) problems.push('cold_draft_not_specific');
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
    const problems = draftProblems(candidate);
    if (problems.length) {
      for (const code of problems) holds.push(makeHold(code, target, code === 'missing_draft' ? 'Prepare an individual draft from the cited evidence for human review.' : 'Revise the exact draft and its source references before requesting approval.'));
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
