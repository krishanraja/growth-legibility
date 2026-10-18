import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { prepare } from '../src/stages/prepare.mjs';

const AT = '2026-10-18T12:00:00.000Z';

function candidate(id = 'builder-1', overrides = {}) {
  return {
    id,
    account_id: 'account-1',
    pool: 'builder',
    company: 'Example Commerce',
    project: 'Shop Agent',
    channel: 'email',
    current_signal: { text: 'Released a shopping agent prototype.', url: 'https://example.com/launch', observed_at: '2026-10-17T12:00:00.000Z' },
    relationship: { kind: 'cold', evidence: null, url: null },
    scores: { fit: 1, project: 1, relationship: 0, distribution: 1, timing: 1 },
    draft: { text: 'Your Shop Agent at Example Commerce looks relevant to the Legibility testbench. Would you like to test five inputs? Coverage has limits and some inputs return no trusted result.', source_refs: ['https://example.com/launch'] },
    contact: { status: 'clear', last_sent_at: null, followups: 0 },
    ...overrides,
  };
}

function snapshot(overrides = {}) {
  return {
    snapshot_id: 'snapshot-1',
    captured_at: AT,
    app_revision: 'app-revision-1',
    icp: { product_slug: 'legibility', source: 'control-center:product_icp', status: 'approved', buyer_definition: 'Developers building commerce and procurement agents.', revision: 'icp-1', reviewed_at: '2026-10-17T12:00:00.000Z' },
    suppressions: [],
    candidates: [candidate()],
    opportunities: [],
    coverage: { candidates: true, opportunities: true },
    ...overrides,
  };
}

function opportunity(id, overrides = {}) {
  return { id, kind: 'registry', title: 'Relevant tool registry', url: 'https://example.com/registry', evidence_url: 'https://example.com/rules', observed_at: '2026-10-17T00:00:00.000Z', status: 'uncovered', effort_minutes: 20, ...overrides };
}

test('uses the corpus 30/20/20/20/10 weights and permits rich named cold drafts at 70+', () => {
  const result = prepare(snapshot(), AT);
  assert.equal(result.actions.length, 1);
  const action = result.actions[0];
  assert.equal(action.score, 80);
  assert.equal(action.type, 'direct_invitation');
  assert.equal(action.status, 'pending_human');
  assert.equal(action.visibility, 'private');
  assert.equal(action.approval_required, true);
  assert.equal(action.expires_at, '2026-10-20T12:00:00.000Z');
  assert.equal(action.lineage.icp_revision, 'icp-1');
  assert.equal(action.lineage.app_revision, 'app-revision-1');
  assert.equal(action.text_sha256, createHash('sha256').update(action.exact_text).digest('hex'));
  assert.ok(action.risk_flags.includes('named_cold_requires_human_review'));
});

test('threshold scoring is exact and does not round a below-70 candidate up', () => {
  const draft = candidate().draft;
  const result = prepare(snapshot({ candidates: [candidate('edge', { scores: { fit: 1, project: 1, relationship: 0, distribution: 0.499999, timing: 1 }, draft })] }), AT);
  assert.equal(result.actions[0].score, 69.99998);
  assert.equal(result.actions[0].status, 'work_required');
  assert.ok(result.holds.some(hold => hold.code === 'introduction_path_required'));
});

test('requires approved current ICP revision and complete candidate coverage', () => {
  for (const change of [
    { status: 'proposed', revision: 'icp-1', reviewed_at: AT },
    { status: 'approved', revision: null, reviewed_at: AT },
    { status: 'approved', revision: 'icp-1', reviewed_at: '2026-09-17T12:00:00.000Z' },
    { status: 'approved', revision: 'icp-1', reviewed_at: '2026-10-19T12:00:00.000Z' },
  ]) {
    const result = prepare(snapshot({ icp: { ...snapshot().icp, ...change } }), AT);
    assert.equal(result.actions.length, 0);
    assert.ok(result.holds.some(hold => hold.code === 'icp_not_current_approved'));
  }
  const result = prepare(snapshot({ coverage: { candidates: false, opportunities: true } }), AT);
  assert.equal(result.actions.length, 0);
  assert.ok(result.holds.some(hold => hold.code === 'candidate_coverage_unknown'));
});

test('prospecting binds the approved ICP to Legibility and canonical product_icp buyer definition', () => {
  for (const change of [
    { product_slug: 'another-product' },
    { product_slug: null },
    { source: 'corpus:proposed-icp' },
    { source: null },
    { buyer_definition: '' },
    { buyer_definition: '   ' },
    { buyer_definition: null },
  ]) {
    const result = prepare(snapshot({ icp: { ...snapshot().icp, ...change } }), AT);
    assert.equal(result.actions.length, 0);
    assert.ok(result.holds.some(hold => hold.code === 'icp_not_current_approved'));
  }
});

test('candidate and opportunity projections exclude unknown nested export metadata', () => {
  const base = candidate();
  const decorated = candidate('builder-1', {
    current_signal: { ...base.current_signal, request_headers: { Authorization: 'SYNTHETIC_SIGNAL_AUTH_CANARY' } },
    relationship: { ...base.relationship, auth_token: 'SYNTHETIC_RELATION_AUTH_CANARY' },
    contact: { ...base.contact, credentials: { api_key: 'SYNTHETIC_CONTACT_AUTH_CANARY' } },
    exporter_session: 'SYNTHETIC_CANDIDATE_AUTH_CANARY',
  });
  const plainOpportunity = opportunity('registry-1');
  const decoratedOpportunity = { ...plainOpportunity, request_headers: { Authorization: 'SYNTHETIC_OPPORTUNITY_AUTH_CANARY' } };
  const plain = prepare(snapshot({ candidates: [base], opportunities: [plainOpportunity] }), AT);
  const result = prepare(snapshot({ candidates: [decorated], opportunities: [decoratedOpportunity] }), AT);
  assert.deepEqual(result, plain);
  assert.equal(JSON.stringify(result).includes('AUTH_CANARY'), false);
  assert.deepEqual(Object.keys(result.actions[0].candidate.current_signal).sort(), ['observed_at', 'text', 'url']);
  assert.deepEqual(Object.keys(result.actions[0].candidate.relationship).sort(), ['evidence', 'kind', 'url']);
  assert.deepEqual(Object.keys(result.actions[0].candidate.contact).sort(), ['followups', 'last_sent_at', 'status']);
  assert.equal('request_headers' in result.opportunities[0], false);
  assert.equal('exporter_session' in result.actions[0].candidate, false);
  const malformed = prepare(snapshot({ candidates: [candidate('malformed', { current_signal: { ...base.current_signal, text: { private_metadata: 'SYNTHETIC_NESTED_AUTH_CANARY' } } })] }), AT);
  assert.equal(malformed.actions[0].candidate.current_signal.text, null);
  assert.equal(JSON.stringify(malformed).includes('AUTH_CANARY'), false);
});

test('rejects missing company/project and stale, future, or invalid signal evidence', () => {
  for (const overrides of [
    { company: '' },
    { project: '' },
    { current_signal: { text: 'Launch', url: 'https://example.com/launch', observed_at: '2026-09-17T12:00:00.000Z' } },
    { current_signal: { text: 'Launch', url: 'https://example.com/launch', observed_at: '2026-10-18T12:00:00.001Z' } },
    { current_signal: { text: 'Launch', url: 'javascript:alert(1)', observed_at: AT } },
    { current_signal: { text: '', url: 'https://example.com/launch', observed_at: AT } },
  ]) {
    const result = prepare(snapshot({ candidates: [candidate('incomplete', overrides)] }), AT);
    assert.equal(result.actions.filter(action => action.status === 'pending_human').length, 0);
    assert.ok(result.actions.every(action => !('exact_text' in action)));
    assert.equal(result.actions[0]?.type, 'research_candidate');
  }
});

test('pending approval requires fresh snapshot identity and app revision lineage', () => {
  for (const change of [
    { snapshot_id: null },
    { app_revision: null },
    { captured_at: '2026-09-01T00:00:00Z' },
    { captured_at: '2026-10-19T00:00:00Z' },
  ]) {
    const result = prepare(snapshot(change), AT);
    assert.equal(result.actions[0].type, 'verify_source_lineage');
    assert.equal(result.actions[0].status, 'work_required');
    assert.ok(result.holds.some(hold => hold.code === 'source_lineage_missing_or_stale'));
  }
});

test('60-69 requires an evidenced introducer path and below 60 creates research work', () => {
  const intro = candidate('intro', {
    scores: { fit: 1, project: 1, relationship: 0.75, distribution: 0, timing: 0 },
    relationship: { kind: 'introducer', evidence: 'Explicit introduction offer recorded by the relationship owner.', url: 'https://example.com/path' },
    draft: { text: 'Would you be comfortable forwarding one relevant invitation for Shop Agent?', source_refs: ['https://example.com/launch', 'https://example.com/path'] },
  });
  const result = prepare(snapshot({ candidates: [intro] }), AT);
  assert.equal(result.actions[0].score, 65);
  assert.equal(result.actions[0].type, 'introduction_request');
  assert.equal(result.actions[0].status, 'pending_human');
  const low = prepare(snapshot({ candidates: [candidate('low', { scores: { fit: 0.5, project: 0.5, relationship: 0.5, distribution: 0.5, timing: 0.5 } })] }), AT);
  assert.equal(low.actions[0].type, 'research_candidate');
  assert.ok(low.holds.some(hold => hold.code === 'research_below_threshold'));
});

test('suppression overrides a complete draft and any prior approval-like input', () => {
  const previous = candidate('suppressed', { approved: true, approval_status: 'approved' });
  for (const changes of [
    { suppressions: [{ candidate_id: 'suppressed', reason: 'Objection' }], candidates: [previous] },
    ...['opt_out', 'bounced', 'complaint'].map(status => ({ candidates: [{ ...previous, contact: { ...previous.contact, status } }] })),
  ]) {
    const result = prepare(snapshot(changes), AT);
    assert.equal(result.actions.length, 0);
    assert.ok(result.holds.some(hold => hold.code === 'suppressed'));
    assert.equal(JSON.stringify(result).includes(previous.draft.text), false);
  }
});

test('claim guard rejects universality, mainnet and unsupported hype without inventing replacement copy', () => {
  for (const claim of ['Works with any URL.', 'Works on every retailer.', 'We have universal coverage.', 'Mainnet is live.', 'x402 now works on Base mainnet.', 'Mainnet payments are available.', 'x402 is production-ready x402.', 'A revolutionary tool.']) {
    const value = candidate('claim', { draft: { ...candidate().draft, text: `${candidate().draft.text} ${claim}` } });
    const result = prepare(snapshot({ candidates: [value] }), AT);
    assert.equal(result.actions[0].status, 'work_required', claim);
    assert.ok(result.actions[0].risk_flags.some(flag => ['universal_coverage', 'mainnet_claim', 'unsupported_hype'].includes(flag)), claim);
    assert.equal('exact_text' in result.actions[0], false);
  }
});

test('binds source references and relationship claims to the supplied evidence', () => {
  for (const draft of [
    { text: candidate().draft.text, source_refs: [] },
    { text: `${candidate().draft.text} As discussed, we worked together.`, source_refs: ['https://example.com/launch'] },
    { text: candidate().draft.text, source_refs: ['https://example.com/launch', 'file:///private'] },
    { text: 'Hi [first name], test Shop Agent at Example Commerce.', source_refs: ['https://example.com/launch'] },
    { text: 'You might like our tool.', source_refs: ['https://example.com/launch'] },
  ]) {
    const result = prepare(snapshot({ candidates: [candidate('draft-source', { draft })] }), AT);
    assert.equal(result.actions[0].status, 'work_required');
  }
  const warm = candidate('warm', {
    relationship: { kind: 'warm', evidence: 'A prior conversation was confirmed.', url: 'https://example.com/conversation' },
    draft: { text: 'Following up on our conversation about Shop Agent.', source_refs: ['https://example.com/launch'] },
  });
  assert.ok(prepare(snapshot({ candidates: [warm] }), AT).holds.some(hold => hold.code === 'relationship_source_not_cited'));
});

test('missing draft produces one actionable task without fabricated message text', () => {
  const result = prepare(snapshot({ candidates: [candidate('needs-draft', { draft: null })] }), AT);
  assert.equal(result.actions[0].type, 'draft_direct_invitation');
  assert.equal(result.actions[0].status, 'work_required');
  assert.ok(result.actions[0].requested_work.length > 0);
  assert.equal('exact_text' in result.actions[0], false);
  assert.equal('expires_at' in result.actions[0], false);
});

test('allows only a single human reviewed follow-up and rejects invalid contact history', () => {
  const sent = { status: 'clear', last_sent_at: '2026-10-01T12:00:00.000Z', followups: 0 };
  assert.equal(prepare(snapshot({ candidates: [candidate('followup', { contact: sent })] }), AT).actions[0].type, 'single_followup');
  for (const contact of [
    { ...sent, followups: 1 },
    { ...sent, last_sent_at: '2026-10-19T00:00:00Z' },
    { ...sent, last_sent_at: null, followups: 1 },
    { ...sent, status: 'unknown' },
  ]) assert.equal(prepare(snapshot({ candidates: [candidate('contact', { contact })] }), AT).actions.length, 0);
  assert.equal(prepare(snapshot({ candidates: [candidate('followup', { contact: sent })] }), AT, { max_followups: 0 }).actions.length, 0);
});

test('stable action IDs bind exact content and lineage but do not bind the run clock', () => {
  const first = prepare(snapshot(), AT).actions[0];
  const next = prepare(snapshot(), '2026-10-18T13:00:00.000Z').actions[0];
  assert.equal(first.id, next.id);
  assert.equal(first.payload_sha256, next.payload_sha256);
  assert.notEqual(first.expires_at, next.expires_at);
  const changedDraft = candidate('builder-1', { draft: { ...candidate().draft, text: `${candidate().draft.text} Thank you.` } });
  assert.notEqual(first.id, prepare(snapshot({ candidates: [changedDraft] }), AT).actions[0].id);
  assert.notEqual(first.id, prepare(snapshot({ app_revision: 'new-app-revision' }), AT).actions[0].id);
});

test('ordering is deterministic, capped at five shared actions, and never mutates input', () => {
  const candidates = Array.from({ length: 8 }, (_, index) => candidate(`builder-${index}`, { scores: { fit: 1, project: 1, relationship: 0, distribution: 0.6 + index * 0.05, timing: 1 } }));
  const input = snapshot({ candidates, opportunities: [opportunity('registry-1')] });
  const before = structuredClone(input);
  const first = prepare(input, AT, { max_actions: 500 });
  const second = prepare({ ...input, candidates: [...candidates].reverse() }, AT, { max_actions: 500 });
  assert.equal(first.actions.length, 5);
  assert.deepEqual(first, second);
  assert.deepEqual(input, before);
  assert.equal(first.actions[0].candidate_id, 'builder-7');
  assert.equal(first.holds.find(hold => hold.code === 'action_cap').deferred_count, 4);
  assert.equal(prepare(input, AT, { max_actions: 0 }).actions.length, 0);
});

test('distribution tasks are private and share the cap; covered and stale surfaces do not generate work', () => {
  const input = snapshot({ candidates: [], opportunities: [opportunity('slow', { effort_minutes: 30 }), opportunity('fast', { effort_minutes: 5, status: 'drafted' }), opportunity('done', { status: 'covered' }), opportunity('stale', { observed_at: '2026-01-01T00:00:00Z' })] });
  const result = prepare(input, AT, { max_actions: 1 });
  assert.equal(result.actions.length, 1);
  assert.equal(result.actions[0].opportunity_id, 'fast');
  assert.equal(result.actions[0].type, 'review_distribution_asset');
  assert.equal(result.actions[0].status, 'work_required');
  assert.equal(result.opportunities.length, 3);
  assert.ok(result.holds.some(hold => hold.code === 'invalid_or_stale_opportunity'));
  assert.ok(result.actions.every(action => action.visibility === 'private'));
  assert.ok(result.opportunities.every(item => item.visibility === 'private'));
});

test('duplicate conflicts and invalid numeric scores cannot produce approval packets', () => {
  assert.ok(prepare(snapshot({ candidates: [candidate(), candidate('builder-1', { project: 'Different' })] }), AT).holds.some(hold => hold.code === 'conflicting_candidate'));
  assert.equal(prepare(snapshot({ candidates: [candidate(), candidate()] }), AT).actions.length, 1);
  for (const value of [NaN, Infinity, -1, 1.1, '1']) {
    assert.equal(prepare(snapshot({ candidates: [candidate('invalid', { scores: { ...candidate().scores, fit: value } })] }), AT).actions.length, 0);
  }
});

test('rejects ambiguous clocks and invalid policy limits', () => {
  assert.throws(() => prepare(snapshot(), '2026-10-18'), /explicit timezone/);
  assert.throws(() => prepare(snapshot(), AT, { max_actions: -1 }), /Policy limits/);
  assert.throws(() => prepare(snapshot(), AT, { max_candidate_age_days: 0 }), /Policy limits/);
});
