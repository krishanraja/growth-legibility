import test from 'node:test';
import assert from 'node:assert/strict';
import { measure, isoWeek } from '../src/stages/measure.mjs';

const AT = '2026-10-18T12:00:00.000Z';
const policy = {
  trust_gate: 0.7,
  campaign: {
    activated_at: '2026-10-01T12:00:00.000Z',
    duration_days: 30,
    targets: { gross: 225, net: 200, keys: 120, activated: 75, returning: 30, feedback: 15, partners: 5 },
  },
};
const account = (id, extra = {}) => ({
  id, email_verified: true, use_case: 'Procurement integration', relevant_context: true,
  is_internal: false, enrolled_at: '2026-10-02T12:00:00.000Z',
  api_key_created_at: '2026-10-03T12:00:00.000Z', acquisition_source: 'partner', production_agent: false, ...extra,
});
const read = (id, account_id, occurred_at, extra = {}) => ({
  id, account_id, occurred_at, interface: 'api', product_present: true, confidence: 0.8,
  calibration_version: 'v1', cost_usd: 0.001, method: 'jsonld', failure_reason: null, session_id: `session-${id}`, ...extra,
});
const snapshot = (extra = {}) => ({
  mode: 'synthetic', window: { start: '2026-10-01T00:00:00.000Z', end: '2026-10-18T12:00:01.000Z', complete: true },
  coverage: { events: true, accounts: true, reads: true, settlements: true, partners: true, spend: true, feedback: true, billing: true },
  accounts: [], reads: [], events: [], settlements: [], billing: [], partners: [], spend: { paid_media_usd: 0 }, feedback: [],
  benchmark: { selection_method: 'Frozen stratified sample', consented: false }, ...extra,
});
const value = (result, key) => result.metrics[key].value;

test('deduplicates aliases and records while distinguishing verified from qualified enrolments', () => {
  const result = measure(snapshot({
    accounts: [
      account('a'), account('alias', { canonical_id: 'a' }),
      account('b', { use_case: '   ' }), account('c', { email_verified: false }),
      account('internal', { is_internal: true }), account('d', { relevant_context: false }),
    ],
    reads: [read('r1', 'alias', '2026-10-04T12:00:00Z'), read('r1', 'alias', '2026-10-04T12:00:00Z')],
    feedback: [
      { id: 'f1', account_id: 'alias', occurred_at: '2026-10-05T12:00:00Z' },
      { id: 'f1', account_id: 'alias', occurred_at: '2026-10-05T12:00:00Z' },
      { id: 'f2', account_id: 'internal', occurred_at: '2026-10-05T12:00:00Z' },
    ],
  }), AT, policy);
  assert.equal(value(result, 'verified_enrolments'), 3);
  assert.equal(value(result, 'qualified_enrolments'), 1);
  assert.equal(value(result, 'api_keys_created'), 1);
  assert.equal(value(result, 'first_trusted_reads'), 1);
  assert.equal(value(result, 'feedback_submissions'), 1);
  assert.equal(value(result, 'feedback_contributors'), 1);
  assert.equal(result.channels.length, 1);
  assert.equal(result.channels[0].qualified_enrolments.value, 1);
});

test('activation requires actual trusted API or MCP evidence, never a testbench or event assertion', () => {
  const result = measure(snapshot({
    accounts: ['testbench', 'null', 'low', 'uncalibrated', 'gate', 'mcp'].map((id) => account(id)),
    reads: [
      read('t', 'testbench', '2026-10-04T12:00:00Z', { interface: 'testbench' }),
      read('n', 'null', '2026-10-04T12:00:00Z', { product_present: false, confidence: 1 }),
      read('l', 'low', '2026-10-04T12:00:00Z', { confidence: 0.699999 }),
      read('u', 'uncalibrated', '2026-10-04T12:00:00Z', { calibration_version: '' }),
      read('g', 'gate', '2026-10-04T12:00:00Z', { confidence: 0.7 }),
      read('m', 'mcp', '2026-10-04T12:00:00Z', { interface: 'mcp' }),
    ],
    events: [{ id: 'assertion', type: 'first_trusted_read', account_id: 'testbench', occurred_at: '2026-10-04T12:00:00Z', source: 'partner' }],
  }), AT, policy);
  assert.equal(value(result, 'first_trusted_reads'), 2);
  assert.equal(value(result, 'first_calls'), 5);
  assert.equal(result.funnel.key_to_trusted_read_rate.value, 0.33333333);
});

test('retention uses a distinct session strictly after 24h and through seven days, with mature denominator', () => {
  const result = measure(snapshot({
    accounts: ['mature', 'same', 'boundary', 'late', 'young'].map((id) => account(id)),
    reads: [
      read('m1', 'mature', '2026-10-08T12:00:00Z', { session_id: 'first' }),
      read('m2', 'mature', '2026-10-10T12:00:00Z', { session_id: 'second', product_present: false }),
      read('s1', 'same', '2026-10-08T12:00:00Z', { session_id: 'same' }),
      read('s2', 'same', '2026-10-10T12:00:00Z', { session_id: 'same' }),
      read('b1', 'boundary', '2026-10-08T12:00:00Z'),
      read('b2', 'boundary', '2026-10-09T12:00:00Z'),
      read('b3', 'boundary', '2026-10-15T12:00:00Z'),
      read('l1', 'late', '2026-10-08T12:00:00Z'),
      read('l2', 'late', '2026-10-15T12:00:01Z'),
      read('y1', 'young', '2026-10-16T12:00:00Z'),
      read('y2', 'young', '2026-10-17T12:00:01Z'),
    ],
  }), AT, policy);
  assert.equal(value(result, 'seven_day_returning'), 3);
  assert.equal(value(result, 'seven_day_eligible'), 4);
  assert.equal(value(result, 'seven_day_mature_returning'), 2);
  assert.equal(value(result, 'seven_day_return_rate'), 0.5);
});

test('weekly usage excludes testbench and internal activity, deduplicates accounts and requires trusted output for production dependency', () => {
  const result = measure(snapshot({
    accounts: [account('a', { production_agent: true }), account('alias', { canonical_id: 'a' }), account('b'), account('zero'), account('internal', { is_internal: true, production_agent: true })],
    reads: [
      read('a1', 'a', '2026-10-12T12:00:00Z'), read('a2', 'alias', '2026-10-13T12:00:00Z'),
      read('a3', 'a', '2026-10-14T12:00:00Z', { product_present: false }),
      read('b1', 'b', '2026-10-14T12:00:00Z'),
      read('z1', 'zero', '2026-10-14T12:00:00Z', { product_present: false }),
      read('t1', 'b', '2026-10-14T12:00:00Z', { interface: 'testbench' }),
      read('i1', 'internal', '2026-10-14T12:00:00Z'),
      read('old', 'a', '2026-10-10T12:00:00Z'),
    ],
  }), AT, policy);
  assert.equal(value(result, 'weekly_reads'), 5);
  assert.equal(value(result, 'weekly_trusted_reads'), 3);
  assert.equal(value(result, 'weekly_active_accounts'), 3);
  assert.equal(value(result, 'weekly_reads_per_active_account'), 1.66666667);
  assert.equal(value(result, 'weekly_median_reads_per_active_account'), 1);
  assert.equal(value(result, 'weekly_trusted_reads_per_active_account'), 1);
  assert.equal(value(result, 'weekly_median_trusted_reads_per_active_account'), 1);
  assert.equal(value(result, 'production_agents_weekly'), 1);
  assert.equal(result.north_star.targets.weekly_median_trusted_reads_per_active_account, 7);
  assert.equal(result.north_star.targets.production_agents_weekly, 100);
  assert.ok(!result.tripwires.some((wire) => wire.code === 'kill'));
});

test('unknown source coverage and partial windows stay null while observed empty complete sources are zero', () => {
  const complete = snapshot();
  const empty = measure(complete, AT, policy);
  assert.equal(value(empty, 'qualified_enrolments'), 0);
  assert.equal(value(empty, 'paid_media_usd'), 0);
  assert.equal(value(empty, 'seven_day_return_rate'), null);
  assert.equal(empty.funnel.testbench_start_rate.value, null);
  const missing = measure({ ...complete, coverage: { ...complete.coverage, accounts: false, billing: false } }, AT, policy);
  assert.equal(value(missing, 'qualified_enrolments'), null);
  assert.equal(value(missing, 'weekly_reads'), null);
  assert.equal(value(missing, 'beta_page_views'), null);
  assert.equal(value(missing, 'human_signup_revenue_usd'), null);
  assert.equal(value(missing, 'agent_revenue_share'), null);
  assert.equal(value(missing, 'paid_media_usd'), 0);
  assert.match(missing.metrics.qualified_enrolments.reason, /accounts/);
  assert.equal(missing.recommendation.code, 'restore_measurement');
  const partial = measure({ ...complete, window: { ...complete.window, complete: false } }, AT, policy);
  assert.equal(value(partial, 'paid_media_usd'), null);
  assert.equal(value(partial, 'verified_enrolments'), null);
});

test('weekly rates require the full trailing seven days even when the reporting interval is complete', () => {
  const pending = structuredClone(policy);
  pending.campaign.activated_at = null;
  const result = measure(snapshot({ window: { start: '2026-10-15T00:00:00Z', end: '2026-10-19T00:00:00Z', complete: true } }), AT, pending);
  assert.equal(value(result, 'qualified_enrolments'), 0);
  assert.equal(value(result, 'weekly_reads'), null);
  assert.match(result.metrics.weekly_reads.reason, /full trailing seven days/);
});

test('mainnet agent revenue uses settled actual payments, human signup is net of refunds, and testnet is not revenue', () => {
  const settlement = (id, network, payer, amount_usd, status = 'settled') => ({ id, occurred_at: '2026-10-10T00:00:00Z', network, payer, amount_usd, status });
  const billing = (id, amount_usd, status = 'settled') => ({ id, occurred_at: '2026-10-10T00:00:00Z', amount_usd, status, source: 'human_signup' });
  const result = measure(snapshot({
    settlements: [settlement('agent', 'base-mainnet', 'agent', 60), settlement('human', 'base-mainnet', 'human', 5), settlement('failed', 'base-mainnet', 'agent', 500, 'failed'), settlement('test', 'base-sepolia', 'agent', 999)],
    billing: [billing('sale', 100), billing('refund', 20, 'refunded'), billing('failed', 500, 'failed')],
  }), AT, policy);
  assert.equal(value(result, 'mainnet_agent_revenue_usd'), 60);
  assert.equal(value(result, 'mainnet_human_revenue_usd'), 5);
  assert.equal(value(result, 'human_signup_revenue_usd'), 80);
  assert.equal(value(result, 'testnet_settlement_volume_usd'), 999);
  assert.equal(value(result, 'agent_revenue_share'), 0.42857143);
});

test('excess in-window refunds do not create a revenue share greater than 100 percent', () => {
  const result = measure(snapshot({
    settlements: [{ id: 'a', network: 'base-mainnet', payer: 'agent', amount_usd: 50, status: 'settled', occurred_at: '2026-10-10T00:00:00Z' }],
    billing: [{ id: 'r', source: 'human_signup', amount_usd: 20, status: 'refunded', occurred_at: '2026-10-10T00:00:00Z' }],
  }), AT, policy);
  assert.equal(value(result, 'human_signup_revenue_usd'), -20);
  assert.equal(value(result, 'agent_revenue_share'), null);
  assert.match(result.metrics.agent_revenue_share.reason, /refunds/);
});

test('public benchmark requires explicit consent and preserves independent calibration strata without private strings', () => {
  const privateMarker = 'private.person@example.test';
  const source = snapshot({
    accounts: [account('private-account', { acquisition_source: privateMarker })],
    reads: [
      read('private-read', 'private-account', '2026-10-10T00:00:00Z', { calibration_version: 'v1', method: `https://private.test/${privateMarker}` }),
      read('r2', 'private-account', '2026-10-11T00:00:00Z', { calibration_version: 'v2', confidence: 0.4, failure_reason: privateMarker }),
      read('r3', 'private-account', '2026-10-12T00:00:00Z', { calibration_version: privateMarker, product_present: false, failure_reason: `403 ${privateMarker}` }),
    ],
    benchmark: { selection_method: `Frozen sample for ${privateMarker}`, consented: false },
  });
  const blocked = measure(source, AT, policy);
  assert.equal(blocked.benchmark.publishable, false);
  assert.equal(blocked.benchmark.sample_size, null);
  assert.deepEqual(blocked.benchmark.calibration_strata, []);
  source.benchmark.consented = true;
  const result = measure(source, AT, policy);
  assert.equal(result.benchmark.publishable, true);
  assert.equal(result.benchmark.sample_size, 3);
  assert.equal(result.benchmark.calibration_strata.length, 3);
  assert.deepEqual(result.benchmark.calibration_strata.map((row) => row.trusted_read_rate).sort(), [0, 0, 1]);
  assert.ok(result.benchmark.calibration_strata.every((row) => /^sha256:[a-f0-9]{64}$/.test(row.calibration_version)));
  assert.ok(!JSON.stringify(result).includes(privateMarker));
  assert.ok(!JSON.stringify(result).includes('https://private.test'));
  assert.ok(!JSON.stringify(result).includes('private-account'));
  assert.ok(!JSON.stringify(result).includes('private-read'));
});

test('tripwires require their predeclared sample and never fire from absent observations', () => {
  const events = (n) => Array.from({ length: n }, (_, i) => ({ id: `view-${i}`, type: 'beta_page_viewed', account_id: null, source: 'partner', occurred_at: '2026-10-10T00:00:00Z' }));
  assert.equal(measure(snapshot({ events: events(199) }), AT, policy).tripwires.length, 0);
  const result = measure(snapshot({ events: events(200) }), AT, policy);
  assert.equal(result.tripwires[0].code, 'testbench_start_rate');
  assert.equal(result.tripwires[0].sample_size, 200);
  assert.equal(result.recommendation.code, 'testbench_start_rate');
  const unknown = snapshot({ events: events(200) });
  unknown.coverage.events = false;
  assert.equal(measure(unknown, AT, policy).tripwires.length, 0);
});

test('complaint and paid-media guardrails take priority over funnel optimisation', () => {
  const result = measure(snapshot({
    spend: { paid_media_usd: 1 },
    events: [{ id: 'complaint', type: 'complaint', occurred_at: '2026-10-10T00:00:00Z', account_id: null, source: 'partner' }],
  }), AT, policy);
  assert.equal(result.tripwires.length, 2);
  assert.equal(result.recommendation.code, 'complaints');
  assert.ok(result.tripwires.every((wire) => wire.severity === 'blocking'));
});

test('future, pre-enrolment and end-exclusive records cannot inflate the measurement', () => {
  const result = measure(snapshot({
    accounts: [account('a'), account('future', { enrolled_at: '2026-10-19T00:00:00Z' })],
    reads: [
      read('early', 'a', '2026-10-01T12:00:00Z'),
      read('future', 'a', '2026-10-19T00:00:00Z'),
      read('edge', 'a', '2026-10-18T12:00:01.000Z'),
    ],
  }), AT, policy);
  assert.equal(value(result, 'qualified_enrolments'), 1);
  assert.equal(value(result, 'first_trusted_reads'), 0);
  assert.equal(value(result, 'weekly_reads'), 0);
});

test('campaign clock stays unstarted until explicit activation and run rate reflects the configured target', () => {
  const pending = structuredClone(policy);
  pending.campaign.activated_at = null;
  const result = measure(snapshot(), AT, pending);
  assert.equal(value(result, 'required_daily_qualified'), null);
  assert.equal(value(result, 'campaign_days_remaining'), null);
  assert.equal(result.recommendation.code, 'activate_campaign');
  assert.equal(result.campaign.status, 'inactive');
  assert.equal(result.campaign.target_progress.net.value, null);
  const active = measure(snapshot(), AT, policy);
  assert.equal(value(active, 'campaign_days_remaining'), 13);
  assert.equal(value(active, 'required_daily_qualified'), 15.38461538);
});

test('campaign targets exclude preactivation and postcampaign enrolments and require complete capture since activation', () => {
  const configured = structuredClone(policy);
  configured.campaign.activated_at = '2026-10-05T00:00:00Z';
  configured.campaign.duration_days = 5;
  const result = measure(snapshot({ accounts: [
    account('pre', { enrolled_at: '2026-10-04T23:59:59Z' }),
    account('start', { enrolled_at: '2026-10-05T00:00:00Z', api_key_created_at: '2026-10-06T00:00:00Z' }),
    account('end', { enrolled_at: '2026-10-10T00:00:00Z' }),
  ], reads: [
    read('pre-r', 'pre', '2026-10-06T00:00:00Z'),
    read('start-r', 'start', '2026-10-07T00:00:00Z'),
    read('late-return', 'start', '2026-10-10T00:00:00Z'),
  ] }), AT, configured);
  assert.equal(value(result, 'qualified_enrolments'), 1);
  assert.equal(value(result, 'first_trusted_reads'), 1);
  assert.equal(value(result, 'seven_day_returning'), 0);
  assert.equal(result.campaign.status, 'ended');
  assert.equal(result.campaign.target_progress.net.value, 0.005);
  const partial = snapshot({ window: { start: '2026-10-06T00:00:00Z', end: '2026-10-18T12:00:01Z', complete: true } });
  const unavailable = measure(partial, AT, configured);
  assert.equal(value(unavailable, 'qualified_enrolments'), null);
  assert.match(unavailable.metrics.qualified_enrolments.reason, /campaign to date/);
});

test('funnel event counters exclude known internal accounts including aliases', () => {
  const result = measure(snapshot({
    accounts: [account('internal', { is_internal: true }), account('alias', { canonical_id: 'internal' })],
    events: [
      { id: 'external', type: 'beta_page_viewed', account_id: null, source: 'partner', occurred_at: '2026-10-10T00:00:00Z' },
      { id: 'internal', type: 'beta_page_viewed', account_id: 'alias', source: 'partner', occurred_at: '2026-10-10T00:00:00Z' },
    ],
  }), AT, policy);
  assert.equal(value(result, 'beta_page_views'), 1);
});

test('channel quality ranks actual activation before enrolment volume', () => {
  const result = measure(snapshot({
    accounts: [account('a', { acquisition_source: 'large' }), account('b', { acquisition_source: 'large' }), account('c', { acquisition_source: 'small' })],
    reads: [read('c1', 'c', '2026-10-10T00:00:00Z')],
  }), AT, policy);
  assert.deepEqual(result.channels.map((row) => row.source), ['small', 'large']);
});

test('the stage is deterministic, side-effect free and rejects invalid time boundaries', () => {
  const input = snapshot({ accounts: [account('a')], reads: [read('r1', 'a', '2026-10-10T00:00:00Z')] });
  const before = structuredClone(input);
  assert.deepEqual(measure(input, AT, policy), measure(input, AT, policy));
  assert.deepEqual(input, before);
  assert.throws(() => measure(input, 'not-a-date', policy), /valid/);
  assert.throws(() => measure(snapshot({ accounts: [account('a', { canonical_id: 'b' }), account('b', { canonical_id: 'a' })] }), AT, policy), /Cyclic canonical/);
});

test('weekly builders count trusted reads in the ISO week to date, excluding internal, testbench and below-gate reads', () => {
  // ISO weeks start Monday 00:00:00 UTC; 2026 has 53, and the ladder's last rung (28 December) opens 2026-W53.
  assert.deepEqual(isoWeek(Date.parse('2026-10-25T23:59:59.999Z')), { start: Date.parse('2026-10-19T00:00:00Z'), label: '2026-W43' });
  assert.deepEqual(isoWeek(Date.parse('2026-10-26T00:00:00.000Z')), { start: Date.parse('2026-10-26T00:00:00Z'), label: '2026-W44' });
  assert.equal(isoWeek(Date.parse('2026-12-28T12:00:00Z')).label, '2026-W53');
  assert.equal(isoWeek(Date.parse('2027-01-03T12:00:00Z')).label, '2026-W53');
  assert.equal(isoWeek(Date.parse('2027-01-04T00:00:00Z')).label, '2027-W01');
  assert.equal(isoWeek(Date.parse('2026-01-01T00:00:00Z')).label, '2026-W01');
  const at = '2026-10-21T12:00:00.000Z';
  const window = { start: '2026-10-01T00:00:00.000Z', end: at, complete: true };
  const result = measure(snapshot({
    window,
    accounts: [account('a'), account('b'), account('c'), account('late'), account('internal', { is_internal: true }), account('alias', { canonical_id: 'a' })],
    reads: [
      read('r1', 'a', '2026-10-19T00:00:00.000Z'),
      read('r2', 'alias', '2026-10-20T09:00:00.000Z'),
      read('r3', 'b', '2026-10-18T23:59:59.999Z'),
      read('r4', 'c', '2026-10-20T09:00:00.000Z', { confidence: 0.69 }),
      read('r5', 'c', '2026-10-20T10:00:00.000Z', { interface: 'testbench' }),
      read('r6', 'internal', '2026-10-20T09:00:00.000Z'),
      read('r7', 'late', '2026-10-20T09:00:00.000Z', { calibration_version: '' }),
    ],
  }), at, policy);
  // One builder: 'a' and its alias are one person; 'b' read last week; the rest never pass the trusted-read rule.
  assert.equal(value(result, 'weekly_builders'), 1);
  assert.deepEqual(result.north_star.weekly_builders_window, { iso_week: '2026-W43', week_start: '2026-10-19T00:00:00.000Z', as_of: at, counted_per: 'account' });
  // Measured before the campaign clock starts: the number runs on its own weekly ladder.
  const inactive = { ...policy, campaign: { ...policy.campaign, activated_at: null } };
  assert.equal(value(measure(snapshot({ window, accounts: [account('a')], reads: [read('r1', 'a', '2026-10-20T00:00:00.000Z')] }), at, inactive), 'weekly_builders'), 1);
  // Unknown stays unknown: a window that starts after Monday, or incomplete read coverage, is null with its reason.
  const late = measure(snapshot({ window: { start: '2026-10-20T00:00:00.000Z', end: at, complete: true } }), at, policy);
  assert.equal(value(late, 'weekly_builders'), null);
  assert.match(late.metrics.weekly_builders.reason, /ISO week/);
  const partial = measure(snapshot({ window, coverage: { ...snapshot().coverage, reads: false } }), at, policy);
  assert.equal(value(partial, 'weekly_builders'), null);
  assert.match(partial.metrics.weekly_builders.reason, /reads/);
});
