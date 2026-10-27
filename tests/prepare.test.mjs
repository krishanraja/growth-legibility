import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { prepare, mindmakeHolds, mindmakeProblems, draftProblems, MINDMAKE_COPY } from '../src/stages/prepare.mjs';

const AT = '2026-10-18T12:00:00.000Z';
// Control Center's Mindmake record for a synthetic person who was never reached for Mindmake (Ruling, Krish, 2026-10-27).
const RECORD = 'https://example.com/cc/person/builder-1';
const NONE = { state: 'none', by: null, state_at: null, last_touch_at: null, record_url: RECORD };

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
    draft: { text: 'Your Shop Agent at Example Commerce looks relevant to the Legibility testbench. Would you like to test five inputs? Coverage has limits and some inputs return no trusted result.', source_refs: ['https://example.com/launch', RECORD] },
    contact: { status: 'clear', last_sent_at: null, followups: 0, prior_mindmake: NONE },
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
    contact: { ...base.contact, credentials: { api_key: 'SYNTHETIC_CONTACT_AUTH_CANARY' }, prior_mindmake: { ...NONE, exporter_note: 'SYNTHETIC_MINDMAKE_AUTH_CANARY' } },
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
  assert.deepEqual(Object.keys(result.actions[0].candidate.contact).sort(), ['followups', 'last_sent_at', 'prior_mindmake', 'status']);
  assert.deepEqual(Object.keys(result.actions[0].candidate.contact.prior_mindmake).sort(), ['by', 'last_touch_at', 'record_url', 'state', 'state_at']);
  assert.deepEqual(result.actions[0].candidate.contact.prior_mindmake, NONE);
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
    draft: { text: 'Would you be comfortable forwarding one relevant invitation for Shop Agent?', source_refs: ['https://example.com/launch', 'https://example.com/path', RECORD] },
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
    { text: candidate().draft.text, source_refs: [RECORD] },
    { text: `${candidate().draft.text} As discussed, we worked together.`, source_refs: ['https://example.com/launch', RECORD] },
    { text: candidate().draft.text, source_refs: ['https://example.com/launch', 'file:///private', RECORD] },
    { text: 'Hi [first name], test Shop Agent at Example Commerce.', source_refs: ['https://example.com/launch', RECORD] },
    { text: 'You might like our tool.', source_refs: ['https://example.com/launch', RECORD] },
  ]) {
    const result = prepare(snapshot({ candidates: [candidate('draft-source', { draft })] }), AT);
    assert.equal(result.actions[0].status, 'work_required');
  }
  const warm = candidate('warm', {
    relationship: { kind: 'warm', evidence: 'A prior conversation was confirmed.', url: 'https://example.com/conversation' },
    draft: { text: 'Following up on our conversation about Shop Agent.', source_refs: ['https://example.com/launch', RECORD] },
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
  const sent = { status: 'clear', last_sent_at: '2026-10-01T12:00:00.000Z', followups: 0, prior_mindmake: NONE };
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

// Ruling (Krish, 2026-10-27): someone already reached for Mindmake hears of Legibility as a Mindmake product, only in words
// Krish approves; everyone else never sees the name. These are synthetic words that exercise the lint. They are not approved
// copy: MINDMAKE_COPY stays null until Krish approves the real words.
const COPY = {
  bridge: { sent: 'I wrote to you in {month} about Mindmake.', replied: 'Thanks for your reply in {month} about Mindmake.', met: 'Thanks for talking with me in {month} about Mindmake.' },
  shared: 'This is a separate note about Legibility, one of the products we build at Mindmake.',
  intro: ["I'm Krish.", 'Legibility is one of the products we build at Mindmake.'],
};
const DAY = 86_400_000;
const touched = (state, by, stateAt = '2026-09-10T09:00:00.000Z', lastTouchAt = '2026-09-12T09:00:00.000Z') => ({ state, by, state_at: stateAt, last_touch_at: lastTouchAt, record_url: RECORD });
const TOUCHED = [['sent', 'krish'], ['replied', 'krish'], ['met', 'krish'], ['drafted', null], ['sent', 'other'], ['replied', 'other']];
const linesFor = (record, month) => record.by === 'krish' ? [COPY.bridge[record.state].replace('{month}', month), COPY.shared] : COPY.intro;
// The 21 October template, filled for the synthetic company, with room for an extra sentence before the sign-off.
const letter = (opening, extra = '') => `Subject: 30-day free beta trial of Legibility for Example Commerce

Hi there,

${opening} It gives AI shopping agents product information they can work with: send it a supported product-page URL or barcode, and it returns details such as the product name, price and stock availability, with confidence scores and timestamps.

For Example Commerce, it could sit alongside your existing product data to help cover the Shopify product pages your agent compares. If it performs better on particular sites, it could also replace that part of your page-reading process. Shop Agent would still handle the comparison and recommendation.

The aim is less work extracting product details and a clearer view of which data your agent can trust. The pilot would test coverage, accuracy and cost against what you use today.

Legibility is in pilot mode, and I'm looking for beta testers for a 30-day free trial in exchange for feedback. Would you be interested in trying it on a few of Example Commerce's Shopify product URLs?${extra ? ` ${extra}` : ''}

Krish
https://legibility.io`;
const TEMPLATE = letter("I'm Krish, building Legibility.");
function reached(prior, text = TEMPLATE, contact = {}, refs = ['https://example.com/launch', RECORD]) {
  return candidate('reached', { contact: { status: 'clear', last_sent_at: null, followups: 0, prior_mindmake: prior, ...contact }, draft: { text, source_refs: refs } });
}
const codes = result => result.holds.map(hold => hold.code);

test('an absent or unknown Mindmake record holds the invitation as mindmake_history_unknown and is never read as none', () => {
  const bridged = letter(`${COPY.bridge.sent.replace('{month}', 'September')} ${COPY.shared}`);
  const missingKey = { ...NONE };
  delete missingKey.by;
  for (const prior of [undefined, null, [], 'none', { ...NONE, state: 'unknown', record_url: null }, { ...NONE, state: 'unknown' }, { ...NONE, by: 7 }, missingKey, { ...NONE, state: 'pending' },
    { ...NONE, record_url: 'http://example.com/cc/person/builder-1' }, { ...NONE, record_url: 'https://user:pass@example.com/cc/person/builder-1' }, { ...NONE, state_at: '2026-09-10T09:00:00.000Z' },
    touched('sent', null), touched('met', 'other'), touched('drafted', 'krish'), touched('sent', 'krish', '2026-10-19T00:00:00.000Z', '2026-10-19T00:00:00.000Z'),
    touched('sent', 'krish', '2026-09-12T09:00:00.000Z', '2026-09-10T09:00:00.000Z'), touched('sent', 'krish', null, null), { ...touched('open', null), state_at: 'not a date' }]) {
    const contact = { status: 'clear', last_sent_at: null, followups: 0 };
    if (prior !== undefined) contact.prior_mindmake = prior;
    for (const text of [TEMPLATE, bridged]) {
      const result = prepare(snapshot({ candidates: [candidate('unknown-history', { contact, draft: { text, source_refs: ['https://example.com/launch', RECORD] } })] }), AT);
      assert.equal(result.actions.length, 0, JSON.stringify(prior));
      assert.deepEqual(codes(result), ['mindmake_history_unknown'], JSON.stringify(prior));
      assert.equal(JSON.stringify(result).includes('pilot mode'), false);
    }
    assert.deepEqual(mindmakeHolds({ contact }, AT), ['mindmake_history_unknown']);
  }
  // The control: the same words to a person whose record says none reach Krish.
  assert.equal(prepare(snapshot({ candidates: [reached(NONE)] }), AT).actions[0].status, 'pending_human');
});

test('an open Mindmake item or a Mindmake client holds the invitation and prepares nothing', () => {
  for (const [prior, code] of [[{ ...NONE, state: 'open' }, 'mindmake_thread_open'], [touched('open', null), 'mindmake_thread_open'], [touched('client', null), 'mindmake_client'], [{ ...NONE, state: 'client' }, 'mindmake_client']]) {
    const result = prepare(snapshot({ candidates: [reached(prior)] }), AT);
    assert.equal(result.actions.length, 0, code);
    assert.deepEqual(codes(result), [code]);
    assert.deepEqual(mindmakeHolds(reached(prior), AT), [code]);
  }
});

test('a Mindmake touch under 14 days old holds as mindmake_touch_too_recent and one exactly 14 days old does not', () => {
  const edge = Date.parse(AT) - 14 * DAY;
  for (const [state, by] of TOUCHED) {
    const record = lastTouch => touched(state, by, '2026-09-01T09:00:00.000Z', new Date(lastTouch).toISOString());
    const recent = prepare(snapshot({ candidates: [reached(record(edge + 1))] }), AT);
    assert.equal(recent.actions.length, 0, state);
    assert.deepEqual(codes(recent), ['mindmake_touch_too_recent'], state);
    const rested = prepare(snapshot({ candidates: [reached(record(edge))] }), AT);
    assert.equal(codes(rested).includes('mindmake_touch_too_recent'), false, state);
    assert.ok(codes(rested).includes('partner_framing_missing'), state);
    assert.deepEqual(mindmakeHolds(reached(record(edge)), AT), []);
  }
});

test('while the Mindmake variant words await Krish, everyone reached for Mindmake is held as partner_framing_missing', () => {
  assert.equal(MINDMAKE_COPY, null);
  for (const [state, by] of TOUCHED) {
    const record = touched(state, by);
    for (const text of [TEMPLATE, letter(linesFor(record, 'September').join(' ')), letter(COPY.intro.join(' '))]) {
      const result = prepare(snapshot({ candidates: [reached(record, text)] }), AT);
      assert.equal(result.actions.length, 1, `${state} ${by}`);
      const [task] = result.actions;
      assert.equal(task.type, 'draft_direct_invitation');
      assert.equal(task.status, 'work_required');
      assert.ok(task.risk_flags.includes('partner_framing_missing') && task.risk_flags.includes('prior_mindmake_outreach'));
      assert.ok(codes(result).includes('partner_framing_missing'));
      assert.equal('exact_text' in task, false);
      assert.equal(JSON.stringify(result).includes('pilot mode'), false);
    }
  }
  const none = prepare(snapshot({ candidates: [reached(NONE)] }), AT);
  assert.equal(none.actions[0].status, 'pending_human');
  assert.equal(none.actions[0].exact_text, TEMPLATE);
  assert.equal(none.actions[0].risk_flags.includes('prior_mindmake_outreach'), false);
});

test('the opening must be the lines for the record state, in order, with the record month and year', () => {
  for (const [state, by] of TOUCHED) {
    const record = touched(state, by);
    const lines = linesFor(record, 'September');
    assert.deepEqual(mindmakeProblems(reached(record, letter(lines.join(' '))), AT, COPY), [], `${state} ${by}`);
    assert.deepEqual(mindmakeProblems(reached(record, TEMPLATE), AT, COPY), ['partner_framing_missing'], `${state} ${by}`);
    assert.ok(mindmakeProblems(reached(record, letter([...lines].reverse().join(' '))), AT, COPY).includes('partner_framing_missing'), `${state} ${by}`);
    // A curly apostrophe reads as a straight one.
    assert.deepEqual(mindmakeProblems(reached(record, letter(lines.join(' ').replaceAll("'", String.fromCharCode(0x2019)))), AT, COPY), [], `${state} ${by} curly`);
    // A Legibility follow-up is not a first touch, so it needs no opening lines.
    assert.deepEqual(mindmakeProblems(reached(record, TEMPLATE, { last_sent_at: '2026-10-01T12:00:00.000Z' }), AT, COPY), [], `${state} ${by}`);
    if (by !== 'krish') continue;
    for (const month of ['August', 'September 2025', 'september']) {
      assert.ok(mindmakeProblems(reached(record, letter(linesFor(record, month).join(' '))), AT, COPY).includes('mindmake_claim_unsupported'), `${state} ${month}`);
    }
    const lastYear = touched(state, by, '2025-09-10T09:00:00.000Z', '2025-09-12T09:00:00.000Z');
    assert.deepEqual(mindmakeProblems(reached(lastYear, letter(linesFor(lastYear, 'September 2025').join(' '))), AT, COPY), [], state);
    assert.ok(mindmakeProblems(reached(lastYear, letter(linesFor(lastYear, 'September').join(' '))), AT, COPY).includes('mindmake_claim_unsupported'), state);
  }
});

test('a sentence naming Mindmake that the record does not support is held, and a person never reached for Mindmake never sees the name', () => {
  const sent = touched('sent', 'krish');
  const opening = linesFor(sent, 'September').join(' ');
  for (const extra of [COPY.bridge.met.replace('{month}', 'September'), COPY.shared, 'Legibility is Mindmake-backed.', 'Read more at mindmake.co today.',
    'Legibility is a Mindmaker LLC company.', 'I reached out about Mindmake last week.', 'We work in partnership with MINDMAKE.', 'The mind/make team built it.']) {
    assert.ok(mindmakeProblems(reached(sent, letter(opening, extra)), AT, COPY).includes('mindmake_claim_unsupported'), extra);
  }
  const other = touched('sent', 'other');
  assert.ok(mindmakeProblems(reached(other, letter(COPY.intro.join(' '), COPY.bridge.sent.replace('{month}', 'September'))), AT, COPY).includes('mindmake_claim_unsupported'));
  assert.ok(mindmakeProblems(reached(other, letter(opening)), AT, COPY).includes('mindmake_claim_unsupported'));
  for (const text of [letter("I'm Krish, building Legibility.", COPY.shared), letter("I'm Krish, building Legibility.", 'Legibility comes from the MindMake team.'), letter(COPY.intro.join(' '))]) {
    assert.ok(mindmakeProblems(reached(NONE, text), AT, COPY).includes('mindmake_named_without_touch'), text.slice(0, 120));
  }
  assert.deepEqual(mindmakeProblems(reached(NONE, TEMPLATE), AT, COPY), []);
  assert.deepEqual(mindmakeProblems(reached(NONE, letter("I'm Krish, building Legibility.", 'It would remind makers of a test harness.')), AT, COPY), []);
});

test('a first invitation may claim earlier contact only through the approved line for the record', () => {
  const sent = touched('sent', 'krish');
  const opening = linesFor(sent, 'September').join(' ');
  for (const claim of ['I wrote to you last week about your agent.', 'Thanks for your reply.', 'In case you missed my last note, here it is again.', 'I reached out in the spring.', 'This is circling back on my earlier email.']) {
    assert.ok(mindmakeProblems(reached(NONE, letter("I'm Krish, building Legibility.", claim)), AT, COPY).includes('prior_contact_claim_unsupported'), claim);
    assert.deepEqual(mindmakeProblems(reached(NONE, letter("I'm Krish, building Legibility.", claim), { last_sent_at: '2026-10-01T12:00:00.000Z' }), AT, COPY), [], claim);
  }
  assert.ok(mindmakeProblems(reached(sent, letter(opening, 'Just following up.')), AT, COPY).includes('prior_contact_claim_unsupported'));
  assert.deepEqual(mindmakeProblems(reached(sent, letter(opening)), AT, COPY), []);
  assert.deepEqual(mindmakeProblems(reached(NONE, letter("I'm Krish, building Legibility.", 'I wrote a test harness for your catalogue.')), AT, COPY), []);
  const warm = candidate('warm', {
    relationship: { kind: 'warm', evidence: 'A prior conversation was confirmed.', url: 'https://example.com/conversation' },
    draft: { text: 'Following up on our conversation about Shop Agent.', source_refs: ['https://example.com/launch', RECORD] },
  });
  assert.deepEqual(draftProblems(warm, AT), ['prior_contact_claim_unsupported', 'relationship_source_not_cited']);
});

test('a Legibility draft never carries Mindmake offer words', () => {
  const sent = touched('sent', 'krish');
  const opening = linesFor(sent, 'September').join(' ');
  for (const offer of ['It comes with a thirty-day proof.', 'It comes with a 30-day proof.', 'It comes with a 30 day paid proof.', 'Think of it as a paid pilot.', 'Think of it as a paid proof.',
    'It feeds your AI brain.', 'It is part of the AI GTM work.', 'See mindmake.co for the offer.']) {
    assert.ok(mindmakeProblems(reached(NONE, letter("I'm Krish, building Legibility.", offer)), AT, COPY).includes('mindmake_offer_mentioned'), offer);
    assert.ok(mindmakeProblems(reached(sent, letter(opening, offer)), AT, COPY).includes('mindmake_offer_mentioned'), offer);
  }
  assert.deepEqual(mindmakeProblems(reached(NONE, TEMPLATE), AT, COPY), []);
  assert.deepEqual(mindmakeProblems(reached(sent, letter(opening)), AT, COPY), []);
});

test('every invitation cites the person record in Control Center', () => {
  const uncited = ['https://example.com/launch'];
  for (const prior of [NONE, touched('drafted', null)]) {
    const result = prepare(snapshot({ candidates: [reached(prior, TEMPLATE, {}, uncited)] }), AT);
    assert.equal(result.actions[0].status, 'work_required', prior.state);
    assert.ok(codes(result).includes('mindmake_record_not_cited'), prior.state);
  }
  assert.deepEqual(mindmakeProblems(reached(touched('drafted', null), letter(COPY.intro.join(' ')), {}, uncited), AT, COPY), ['mindmake_record_not_cited']);
  assert.deepEqual(mindmakeProblems(reached(NONE, TEMPLATE, {}, uncited), AT, COPY), ['mindmake_record_not_cited']);
  const cited = prepare(snapshot({ candidates: [reached(NONE)] }), AT).actions[0];
  assert.equal(cited.status, 'pending_human');
  assert.ok(cited.source_refs.includes(RECORD));
});

test('a Mindmake note never turns a first Legibility invitation into a follow-up', () => {
  const record = touched('sent', 'krish', '2026-09-18T12:00:00.000Z', '2026-09-18T12:00:00.000Z');
  const result = prepare(snapshot({ candidates: [reached(record)] }), AT);
  assert.equal(result.actions[0].type, 'draft_direct_invitation');
  assert.equal(result.actions[0].risk_flags.includes('single_followup_only'), false);
  assert.equal(codes(result).includes('followup_limit_or_invalid_history'), false);
  assert.equal(result.actions[0].candidate.contact.last_sent_at, null);
  assert.equal(result.actions[0].candidate.contact.followups, 0);
  assert.deepEqual(mindmakeProblems(reached(record, letter(linesFor(record, 'September').join(' '))), AT, COPY), []);
});

test('the approval binds the Mindmake record, so a changed record changes the approval', () => {
  const other = 'https://example.com/cc/person/builder-1-merged';
  const refs = ['https://example.com/launch', RECORD, other];
  const first = prepare(snapshot({ candidates: [reached(NONE, TEMPLATE, {}, refs)] }), AT).actions[0];
  const again = prepare(snapshot({ candidates: [reached(NONE, TEMPLATE, {}, refs)] }), AT).actions[0];
  const moved = prepare(snapshot({ candidates: [reached({ ...NONE, record_url: other }, TEMPLATE, {}, refs)] }), AT).actions[0];
  assert.equal(first.status, 'pending_human');
  assert.equal(moved.status, 'pending_human');
  assert.equal(first.id, again.id);
  assert.notEqual(first.lineage.candidate_sha256, moved.lineage.candidate_sha256);
  assert.notEqual(first.payload_sha256, moved.payload_sha256);
  assert.notEqual(first.id, moved.id);
  assert.equal(first.text_sha256, moved.text_sha256);
  // A touched record that only moved its last touch, both at least 14 days old, is a different task too.
  const early = prepare(snapshot({ candidates: [reached(touched('sent', 'krish', '2026-09-01T09:00:00.000Z', '2026-09-02T09:00:00.000Z'))] }), AT).actions[0];
  const later = prepare(snapshot({ candidates: [reached(touched('sent', 'krish', '2026-09-01T09:00:00.000Z', '2026-09-20T09:00:00.000Z'))] }), AT).actions[0];
  assert.notEqual(early.lineage.candidate_sha256, later.lineage.candidate_sha256);
  assert.notEqual(early.id, later.id);
});
