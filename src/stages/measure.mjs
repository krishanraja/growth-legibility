import { createHash } from 'node:crypto';

const DAY = 86_400_000;
const metric = (value, unit = 'count', reason) => ({ value, unit, ...(reason ? { reason } : {}) });
const round = (value) => Math.round((value + Number.EPSILON) * 1e8) / 1e8;
const sum = (rows, field) => round(rows.reduce((total, row) => total + row[field], 0));
const median = (values) => {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2;
};
const unique = (rows) => [...new Map(rows.map((row) => [row.id, row])).values()];
const safeSource = (source) => /^[a-z0-9][a-z0-9._:-]{0,79}$/i.test(source ?? '') ? source : 'unattributed';

function calibrationLabel(version) {
  return `sha256:${createHash('sha256').update(String(version ?? '')).digest('hex')}`;
}

function methodBucket(method) {
  const value = String(method).toLowerCase();
  if (/shopify/.test(value)) return 'shopify';
  if (/json.?ld|schema/.test(value)) return 'structured_data';
  if (/barcode|gtin/.test(value)) return 'barcode';
  if (/open.?graph/.test(value)) return 'opengraph';
  if (/name|resolve|exa/.test(value)) return 'name_resolution';
  return 'other';
}

function failureBucket(read, trustGate) {
  const value = String(read.failure_reason ?? '').toLowerCase();
  if (/block|forbidden|bot|403|captcha/.test(value)) return 'access_blocked';
  if (/timeout|timed.out/.test(value)) return 'timeout';
  if (/non.?product|not.a.product/.test(value)) return 'not_product';
  if (!read.product_present) return 'unresolved';
  if (read.confidence < trustGate) return 'below_gate';
  return 'other';
}

function identityIndex(accounts) {
  const byId = new Map(accounts.map((account) => [account.id, account]));
  const resolve = (id) => {
    const seen = new Set();
    let current = id;
    while (byId.get(current)?.canonical_id && byId.get(current).canonical_id !== current) {
      if (seen.has(current)) throw new Error('Cyclic canonical account identity');
      seen.add(current);
      current = byId.get(current).canonical_id;
    }
    return current;
  };
  const groups = new Map();
  for (const account of accounts) {
    const key = resolve(account.id);
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(account);
  }
  const entities = [...groups.entries()].map(([id, rows]) => {
    const ordered = [...rows].sort((a, b) => Date.parse(a.enrolled_at) - Date.parse(b.enrolled_at) || a.id.localeCompare(b.id));
    const keys = rows.map((row) => row.api_key_created_at).filter(Boolean).sort();
    return {
      id,
      internal: rows.some((row) => row.is_internal),
      verified: rows.some((row) => row.email_verified),
      qualified: rows.some((row) => row.use_case?.trim()) && rows.some((row) => row.relevant_context),
      enrolled: Date.parse(ordered[0].enrolled_at),
      keyCreated: keys.length ? Math.min(...keys.map(Date.parse)) : null,
      source: safeSource(ordered[0].acquisition_source),
      productionAgent: rows.some((row) => row.production_agent),
    };
  });
  return { resolve, entities, byCanonical: new Map(entities.map((entity) => [entity.id, entity])) };
}

/**
 * Pure measurement of a validated snapshot. Window boundaries are [start, end);
 * records after `at` never count. Missing coverage produces null, including zero.
 * Funnel event rates are event-count proxies, not unique-visitor experiments.
 */
export function measure(snapshot, at, policy) {
  const now = Date.parse(at);
  const start = Date.parse(snapshot.window.start);
  const end = Date.parse(snapshot.window.end);
  if (![now, start, end].every(Number.isFinite) || end <= start) throw new Error('Measurement requires valid at and window timestamps');
  const through = Math.min(now, end);
  const activated = policy.campaign.activated_at ? Date.parse(policy.campaign.activated_at) : null;
  const campaignEnd = activated === null ? null : activated + policy.campaign.duration_days * DAY;
  const inWindow = (value) => {
    const time = typeof value === 'number' ? value : Date.parse(value);
    return Number.isFinite(time) && time >= start && time < end && time <= now;
  };
  const missing = (...sources) => {
    if (!snapshot.window.complete) return 'Reporting window is incomplete';
    const unavailable = sources.filter((source) => snapshot.coverage[source] !== true);
    return unavailable.length ? `Missing complete coverage: ${unavailable.join(', ')}` : null;
  };
  const campaignMissing = (...sources) => missing(...sources) ?? (activated !== null && now < activated ? 'Campaign has not started' : null)
    ?? (activated !== null && (start > activated || end < Math.min(now, campaignEnd)) ? 'Reporting window does not cover the campaign to date' : null);
  const inCampaign = (value) => {
    const time = typeof value === 'number' ? value : Date.parse(value);
    return inWindow(time) && (activated === null || time >= activated && time < campaignEnd);
  };
  const counted = (value, sources, unit = 'count') => {
    const reason = missing(...sources);
    return reason ? metric(null, unit, reason) : metric(value, unit);
  };
  const campaignCounted = (value, sources, unit = 'count') => {
    const reason = campaignMissing(...sources);
    return reason ? metric(null, unit, reason) : metric(value, unit);
  };
  const ratio = (numerator, denominator) => {
    if (numerator.value === null || denominator.value === null) return metric(null, 'ratio', numerator.reason ?? denominator.reason);
    if (!denominator.value) return metric(null, 'ratio', 'No eligible denominator');
    if (numerator.value > denominator.value) return metric(null, 'ratio', 'Numerator exceeds denominator; reconcile funnel cohorts');
    return metric(round(numerator.value / denominator.value), 'ratio');
  };
  const index = identityIndex(unique(snapshot.accounts));
  const entities = index.entities.filter((entity) => !entity.internal);
  const cohort = entities.filter((entity) => inCampaign(entity.enrolled));
  const verified = cohort.filter((entity) => entity.verified);
  const qualified = verified.filter((entity) => entity.qualified);
  const qualifiedIds = new Set(qualified.map((entity) => entity.id));
  const apiReads = unique(snapshot.reads).filter((read) => inWindow(read.occurred_at) && ['api', 'mcp'].includes(read.interface))
    .map((read) => ({ ...read, canonical: index.resolve(read.account_id) }))
    .filter((read) => {
      const entity = index.byCanonical.get(read.canonical);
      return entity && !entity.internal && Date.parse(read.occurred_at) >= entity.enrolled;
    }).sort((a, b) => Date.parse(a.occurred_at) - Date.parse(b.occurred_at) || a.id.localeCompare(b.id));
  const trusted = (read) => read.product_present && Number.isFinite(read.confidence)
    && read.confidence >= policy.trust_gate && Boolean(read.calibration_version?.trim());
  const firstTrusted = new Map();
  for (const read of apiReads) {
    if (qualifiedIds.has(read.canonical) && inCampaign(read.occurred_at) && trusted(read) && !firstTrusted.has(read.canonical)) firstTrusted.set(read.canonical, read);
  }
  const keys = qualified.filter((entity) => entity.keyCreated !== null && inCampaign(entity.keyCreated) && entity.keyCreated >= entity.enrolled);
  const keyedActivated = keys.filter((entity) => apiReads.some((read) => read.canonical === entity.id && inCampaign(read.occurred_at) && trusted(read) && Date.parse(read.occurred_at) >= entity.keyCreated));
  const returning = new Set();
  const mature = new Set();
  for (const [id, first] of firstTrusted) {
    const firstAt = Date.parse(first.occurred_at);
    if (firstAt + 7 * DAY <= Math.min(through, campaignEnd ?? Infinity)) mature.add(id);
    if (apiReads.some((read) => read.canonical === id && inCampaign(read.occurred_at) && read.session_id && first.session_id && read.session_id !== first.session_id
      && Date.parse(read.occurred_at) > firstAt + DAY && Date.parse(read.occurred_at) <= firstAt + 7 * DAY)) returning.add(id);
  }
  const events = unique(snapshot.events).filter((event) => inCampaign(event.occurred_at)
    && (!event.account_id || !index.byCanonical.get(index.resolve(event.account_id))?.internal));
  const eventCount = (...types) => events.filter((event) => types.includes(event.type)).length;
  const feedback = unique(snapshot.feedback).filter((item) => inCampaign(item.occurred_at) && qualifiedIds.has(index.resolve(item.account_id)));
  const activePartners = unique(snapshot.partners).filter((partner) => partner.distributed_at && inCampaign(partner.distributed_at));
  const settlements = unique(snapshot.settlements).filter((item) => inWindow(item.occurred_at) && item.status === 'settled');
  const billing = unique(snapshot.billing ?? []).filter((item) => inWindow(item.occurred_at) && item.source === 'human_signup');
  const humanRevenue = round(sum(billing.filter((item) => item.status === 'settled'), 'amount_usd') - sum(billing.filter((item) => item.status === 'refunded'), 'amount_usd'));
  const mainnet = settlements.filter((item) => item.network === 'base-mainnet');
  const metrics = {
    verified_enrolments: campaignCounted(verified.length, ['accounts']),
    qualified_enrolments: campaignCounted(qualified.length, ['accounts']),
    api_keys_created: campaignCounted(keys.length, ['accounts']),
    first_calls: campaignCounted(new Set(apiReads.filter((read) => qualifiedIds.has(read.canonical) && inCampaign(read.occurred_at)).map((read) => read.canonical)).size, ['accounts', 'reads']),
    first_trusted_reads: campaignCounted(firstTrusted.size, ['accounts', 'reads']),
    seven_day_returning: campaignCounted(returning.size, ['accounts', 'reads']),
    seven_day_eligible: campaignCounted(mature.size, ['accounts', 'reads']),
    seven_day_mature_returning: campaignCounted([...returning].filter((id) => mature.has(id)).length, ['accounts', 'reads']),
    feedback_submissions: campaignCounted(feedback.length, ['accounts', 'feedback']),
    feedback_contributors: campaignCounted(new Set(feedback.map((item) => index.resolve(item.account_id))).size, ['accounts', 'feedback']),
    active_partners: campaignCounted(activePartners.length, ['partners']),
    paid_media_usd: counted(snapshot.spend?.paid_media_usd ?? 0, ['spend'], 'USD'),
    mainnet_agent_revenue_usd: counted(sum(mainnet.filter((item) => item.payer === 'agent'), 'amount_usd'), ['settlements'], 'USD'),
    mainnet_human_revenue_usd: counted(sum(mainnet.filter((item) => item.payer === 'human'), 'amount_usd'), ['settlements'], 'USD'),
    human_signup_revenue_usd: counted(humanRevenue, ['billing'], 'USD'),
    testnet_settlement_volume_usd: counted(sum(settlements.filter((item) => item.network === 'base-sepolia'), 'amount_usd'), ['settlements'], 'testnet_USD_equivalent'),
    beta_page_views: campaignCounted(eventCount('beta_page_viewed'), ['events', 'accounts'], 'events'),
    testbench_starts: campaignCounted(eventCount('testbench_started'), ['events', 'accounts'], 'events'),
    testbench_completions: campaignCounted(eventCount('testbench_completed'), ['events', 'accounts'], 'events'),
    complaints: campaignCounted(eventCount('complaint', 'complaint_reported'), ['events', 'accounts']),
    bounces: campaignCounted(eventCount('bounce', 'email_bounced'), ['events', 'accounts']),
    opt_outs: campaignCounted(eventCount('opt_out', 'unsubscribed'), ['events', 'accounts']),
    referral_enrolments: campaignCounted(new Set(events.filter((event) => event.type === 'referral_enrolled' && event.account_id)
      .map((event) => index.resolve(event.account_id)).filter((id) => qualifiedIds.has(id))).size, ['accounts', 'events']),
  };
  metrics.seven_day_return_rate = ratio(metrics.seven_day_mature_returning, metrics.seven_day_eligible);
  const agentRevenue = metrics.mainnet_agent_revenue_usd;
  const humanSignupRevenue = metrics.human_signup_revenue_usd;
  metrics.agent_revenue_share = agentRevenue.value === null || humanSignupRevenue.value === null
    ? metric(null, 'ratio', agentRevenue.reason ?? humanSignupRevenue.reason)
    : agentRevenue.value + humanSignupRevenue.value <= 0
      ? metric(null, 'ratio', 'No positive combined mainnet-agent and human-signup revenue')
      : humanSignupRevenue.value < 0
        ? metric(null, 'ratio', 'Net human-signup refunds exceed settled revenue in this window')
        : metric(round(agentRevenue.value / (agentRevenue.value + humanSignupRevenue.value)), 'ratio');

  const weekStart = now - 7 * DAY;
  const weekMissing = missing('accounts', 'reads') ?? (start > weekStart || end < now ? 'Reporting window does not cover the full trailing seven days' : null);
  const weekReads = apiReads.filter((read) => Date.parse(read.occurred_at) >= weekStart);
  const weeklyCounts = new Map();
  const weeklyTrustedCounts = new Map();
  for (const read of weekReads) weeklyCounts.set(read.canonical, (weeklyCounts.get(read.canonical) ?? 0) + 1);
  for (const id of weeklyCounts.keys()) weeklyTrustedCounts.set(id, 0);
  for (const read of weekReads.filter(trusted)) weeklyTrustedCounts.set(read.canonical, weeklyTrustedCounts.get(read.canonical) + 1);
  const weekMetric = (value, unit = 'count', reason) => weekMissing ? metric(null, unit, weekMissing) : metric(value, unit, reason);
  metrics.weekly_reads = weekMetric(weekReads.length);
  metrics.weekly_trusted_reads = weekMetric(weekReads.filter(trusted).length);
  metrics.weekly_active_accounts = weekMetric(weeklyCounts.size);
  metrics.weekly_reads_per_active_account = weekMetric(weeklyCounts.size ? round(weekReads.length / weeklyCounts.size) : null, 'reads/account', weeklyCounts.size ? undefined : 'No active accounts');
  metrics.weekly_median_reads_per_active_account = weekMetric(median([...weeklyCounts.values()]), 'reads/account', weeklyCounts.size ? undefined : 'No active accounts');
  metrics.weekly_trusted_reads_per_active_account = weekMetric(weeklyCounts.size ? round(weekReads.filter(trusted).length / weeklyCounts.size) : null, 'trusted_reads/account', weeklyCounts.size ? undefined : 'No active accounts');
  metrics.weekly_median_trusted_reads_per_active_account = weekMetric(median([...weeklyTrustedCounts.values()]), 'trusted_reads/account', weeklyCounts.size ? undefined : 'No active accounts');
  metrics.production_agents_weekly = weekMetric(new Set(weekReads.filter((read) => trusted(read) && index.byCanonical.get(read.canonical).productionAgent).map((read) => read.canonical)).size);

  const remaining = activated === null ? null : Math.max(0, policy.campaign.duration_days - Math.max(0, (now - activated) / DAY));
  metrics.campaign_days_remaining = remaining === null ? metric(null, 'days', 'Campaign has not been activated') : metric(round(remaining), 'days');
  const need = metrics.qualified_enrolments.value === null ? null : Math.max(0, policy.campaign.targets.net - metrics.qualified_enrolments.value);
  metrics.required_daily_qualified = activated === null || now < activated ? metric(null, 'users/day', 'Campaign has not started')
    : need === null ? metric(null, 'users/day', metrics.qualified_enrolments.reason)
      : need === 0 ? metric(0, 'users/day')
        : remaining === 0 ? metric(null, 'users/day', 'Campaign window has ended below target')
          : metric(round(need / remaining), 'users/day');

  const funnel = {
    basis: 'Event-count proxies for testbench rates; deduplicated qualified accounts for activation; mature seven-day cohort for retention',
    testbench_start_rate: ratio(metrics.testbench_starts, metrics.beta_page_views),
    testbench_completion_rate: ratio(metrics.testbench_completions, metrics.testbench_starts),
    report_to_enrolment_rate: ratio(metrics.verified_enrolments, metrics.testbench_completions),
    enrolment_to_key_rate: ratio(metrics.api_keys_created, metrics.qualified_enrolments),
    key_to_trusted_read_rate: ratio(campaignCounted(keyedActivated.length, ['accounts', 'reads']), metrics.api_keys_created),
    seven_day_return_rate: metrics.seven_day_return_rate,
  };
  for (const key of ['testbench_start_rate', 'testbench_completion_rate', 'report_to_enrolment_rate']) {
    if (funnel[key].value !== null) funnel[key].reason = 'Event-count proxy; unique relevant visitors and causal effects are not established';
  }
  const channelSources = snapshot.coverage.accounts ? [...new Set(cohort.map((entity) => entity.source))].sort() : [];
  const channels = channelSources.map((source) => {
    const members = qualified.filter((entity) => entity.source === source);
    const ids = new Set(members.map((entity) => entity.id));
    return {
      source,
      verified_enrolments: campaignCounted(verified.filter((entity) => entity.source === source).length, ['accounts']),
      qualified_enrolments: campaignCounted(members.length, ['accounts']),
      api_keys_created: campaignCounted(keys.filter((entity) => ids.has(entity.id)).length, ['accounts']),
      first_trusted_reads: campaignCounted([...firstTrusted.keys()].filter((id) => ids.has(id)).length, ['accounts', 'reads']),
      seven_day_returning: campaignCounted([...returning].filter((id) => ids.has(id)).length, ['accounts', 'reads']),
    };
  }).sort((a, b) => (b.first_trusted_reads.value ?? -1) - (a.first_trusted_reads.value ?? -1)
    || (b.seven_day_returning.value ?? -1) - (a.seven_day_returning.value ?? -1)
    || (b.qualified_enrolments.value ?? -1) - (a.qualified_enrolments.value ?? -1) || a.source.localeCompare(b.source));

  const benchmarkReason = missing('reads') ?? (!snapshot.benchmark?.consented ? 'Explicit benchmark publication consent is absent' : null)
    ?? (!snapshot.benchmark?.selection_method?.trim() ? 'Frozen benchmark selection method is absent' : null);
  const benchmark = { publishable: !benchmarkReason, ...(benchmarkReason ? { reason: benchmarkReason } : {}), sample_size: null, calibration_strata: [] };
  if (!benchmarkReason) {
    const sample = unique(snapshot.reads).filter((read) => inWindow(read.occurred_at));
    const strata = new Map();
    for (const read of sample) {
      const version = calibrationLabel(read.calibration_version);
      if (!strata.has(version)) strata.set(version, []);
      strata.get(version).push(read);
    }
    benchmark.sample_size = sample.length;
    benchmark.tested_window = { start: snapshot.window.start, end: new Date(through).toISOString() };
    benchmark.selection_method_recorded = true;
    benchmark.selection_method_sha256 = createHash('sha256').update(snapshot.benchmark.selection_method).digest('hex');
    benchmark.limitation = 'Selected snapshot sample; not a claim about coverage of the entire web. No price-band availability field is supplied.';
    benchmark.calibration_strata = [...strata.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([calibration_version, rows]) => {
      const failures = {};
      const methods = {};
      for (const read of rows) {
        const method = methodBucket(read.method);
        methods[method] = (methods[method] ?? 0) + 1;
        if (!trusted(read)) {
          const failure = failureBucket(read, policy.trust_gate);
          failures[failure] = (failures[failure] ?? 0) + 1;
        }
      }
      return {
        calibration_version,
        sample_size: rows.length,
        trusted_read_rate: round(rows.filter(trusted).length / rows.length),
        null_rate: round(rows.filter((read) => !read.product_present).length / rows.length),
        below_gate_count: rows.filter((read) => read.product_present && read.confidence < policy.trust_gate).length,
        method_distribution: methods,
        failure_distribution: failures,
      };
    });
  }

  const tripwires = [];
  const threshold = (code, rate, denominator, minimum, lowerBound, action) => {
    if (rate.value !== null && denominator.value !== null && denominator.value >= minimum && rate.value < lowerBound) {
      tripwires.push({ code, severity: 'warning', action, observed: rate.value, threshold: lowerBound, sample_size: denominator.value });
    }
  };
  if (metrics.complaints.value > 0) tripwires.push({ code: 'complaints', severity: 'blocking', action: 'Pause the responsible acquisition motion and review the complaint evidence', observed: metrics.complaints.value });
  if (metrics.paid_media_usd.value > 0) tripwires.push({ code: 'paid_media_spend', severity: 'blocking', action: 'Stop paid media and reconcile spend against the zero-paid-media constraint', observed: metrics.paid_media_usd.value });
  threshold('testbench_start_rate', funnel.testbench_start_rate, metrics.beta_page_views, 200, 0.2, 'Inspect traffic relevance and test the promise or report presentation; event counts do not establish the cause');
  threshold('testbench_completion_rate', funnel.testbench_completion_rate, metrics.testbench_starts, 100, 0.6, 'Inspect input burden, latency and test failures before choosing one intervention');
  threshold('report_to_enrolment_rate', funnel.report_to_enrolment_rate, metrics.testbench_completions, 100, 0.35, 'Inspect saved-report value and verification delivery before choosing one intervention');
  threshold('enrolment_to_key_rate', funnel.enrolment_to_key_rate, metrics.qualified_enrolments, 75, 0.4, 'Remove onboarding friction and use the submitted input in a first-call recipe');
  threshold('key_to_trusted_read_rate', funnel.key_to_trusted_read_rate, metrics.api_keys_created, 50, 0.5, 'Improve first-call examples and source selection using actual failures');
  if (metrics.qualified_enrolments.value >= 100 && metrics.referral_enrolments.value !== null && metrics.referral_enrolments.value < 10) {
    tripwires.push({ code: 'referral_enrolments', severity: 'warning', action: 'Replace the referral proposition with a useful collaborative report', observed: metrics.referral_enrolments.value, threshold: 10, sample_size: metrics.qualified_enrolments.value });
  }
  const firstTripwire = tripwires[0];
  const unavailable = Object.values(snapshot.coverage).some((available) => !available) || !snapshot.window.complete || Boolean(campaignMissing());
  const recommendation = firstTripwire ? { code: firstTripwire.code, action: firstTripwire.action, reason: 'A predeclared operational tripwire has been crossed' }
    : unavailable ? { code: 'restore_measurement', action: 'Complete source capture and reconcile missing coverage before selecting a growth intervention', reason: 'Unknown observations cannot establish funnel performance' }
      : activated === null ? { code: 'activate_campaign', action: 'Verify the live test-to-API path and record the campaign activation time', reason: 'The campaign clock has not started' }
        : { code: 'collect_evidence', action: 'Continue the current approved experiment; assess weekly trusted reads per active account and mainnet agent revenue alongside acquisition', reason: 'No adequately sampled operational tripwire is crossed; the beta usage target does not authorize an automatic thesis or kill decision' };
  const targetMetric = { gross: 'verified_enrolments', net: 'qualified_enrolments', keys: 'api_keys_created', activated: 'first_trusted_reads', returning: 'seven_day_returning', feedback: 'feedback_submissions', partners: 'active_partners' };
  const campaign = {
    status: activated === null ? 'inactive' : now < activated ? 'scheduled' : now >= campaignEnd ? 'ended' : 'active',
    activated_at: policy.campaign.activated_at,
    ends_at: campaignEnd === null ? null : new Date(campaignEnd).toISOString(),
    targets: { ...policy.campaign.targets },
    target_progress: Object.fromEntries(Object.entries(targetMetric).map(([target, key]) => [target,
      activated === null ? metric(null, 'ratio', 'Campaign has not been activated; observations are baseline only')
        : metrics[key].value === null ? metric(null, 'ratio', metrics[key].reason)
          : metric(round(metrics[key].value / policy.campaign.targets[target]), 'ratio'),
    ])),
  };
  const north_star = {
    targets: { weekly_median_trusted_reads_per_active_account: 7, production_agents_weekly: 100, agent_revenue_share_strictly_greater_than: 0.5 },
    observation: 'Usage includes zero-trust active accounts; testnet volume is excluded from revenue. Targets require human interpretation and never trigger automatic retirement.',
  };
  return { mode: snapshot.mode, measured_at: new Date(now).toISOString(), campaign, north_star, metrics, funnel, channels, benchmark, tripwires, recommendation };
}
