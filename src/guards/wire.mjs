import { createHash } from 'node:crypto';

export const VERSION = '1.0.0';
// Control Center only ever adds within 1.x (ENGINE-PROTOCOL.md, "Versions"), so what it
// serves may be any 1.x while this engine sends 1.0.0. On 2026-10-19 it began serving 1.1.0
// and an exact match here stopped every run with receiver_contract_mismatch.
export const SERVED = /^1\.\d+\.\d+$/;
/** Whether Control Center takes the version this engine sends. */
export function receiverTakes(cap) {
  return Array.isArray(cap?.schema_versions) ? cap.schema_versions.includes(VERSION) : cap?.schema_version === VERSION;
}
export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object') {
    return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
  }
  if (value === undefined || (typeof value === 'number' && !Number.isFinite(value))) throw new Error('non_json_value');
  return JSON.stringify(value);
}
export const sha256 = value => createHash('sha256').update(typeof value === 'string' ? value : canonical(value)).digest('hex');
export const fail = (condition, label) => { if (!condition) throw new Error(`invalid_contract:${label}`); };
const text = (v, max = 2000) => typeof v === 'string' && v.length > 0 && v.length <= max;
const date = v => {
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(v) || !Number.isFinite(Date.parse(v))) return false;
  return new Date(v).toISOString() === (v.includes('.') ? v : v.replace('Z','.000Z'));
};
const num = v => typeof v === 'number' && Number.isFinite(v) && v >= 0;
const id = v => typeof v === 'string' && /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,159}$/.test(v);
const bool = v => typeof v === 'boolean';
const allowed = (v, items) => items.includes(v);
function keys(v, permitted, label) {
  fail(v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).every(k=>permitted.includes(k)), `unknown_fields_${label}`);
}
export function validatePolicy(p) {
  keys(p,['schema_version','trust_gate','max_actions','max_candidate_age_days','max_followups','max_snapshot_age_hours','source_review_due','campaign'],'policy');
  fail(p?.schema_version === VERSION, 'policy_version');
  fail(p.trust_gate === 0.7, 'trust_gate_locked');
  fail(Number.isInteger(p.max_actions) && p.max_actions > 0 && p.max_actions <= 5, 'action_cap');
  fail(p.max_followups === 1 && p.max_candidate_age_days > 0 && p.max_candidate_age_days <= 30, 'contact_limits');
  fail(p.max_snapshot_age_hours > 0 && p.max_snapshot_age_hours <= 24, 'snapshot_freshness');
  fail(date(p.source_review_due), 'source_review_due');
  fail(p.campaign && (p.campaign.activated_at === null || date(p.campaign.activated_at)), 'activation');
  fail(p.campaign.duration_days === 30, 'campaign_duration');
  for (const k of ['gross','net','keys','activated','returning','feedback','partners']) fail(Number.isInteger(p.campaign.targets?.[k]) && p.campaign.targets[k]>0, `target_${k}`);
  return p;
}
export function validateSnapshot(s, at) {
  keys(s,['schema_version','snapshot_id','mode','captured_at','app_revision','window','coverage','icp','accounts','reads','events','settlements','billing','partners','spend','feedback','benchmark','suppressions','candidates','opportunities'],'snapshot');
  fail(date(at), 'run_clock');
  fail(s?.schema_version === VERSION && id(s.snapshot_id), 'snapshot_version_id');
  fail(allowed(s.mode, ['synthetic','live']) && date(s.captured_at), 'mode_capture');
  fail(Date.parse(s.captured_at) <= Date.parse(at), 'future_capture');
  fail(text(s.app_revision, 100), 'app_revision');
  fail(s.window && date(s.window.start) && date(s.window.end) && bool(s.window.complete), 'window');
  keys(s.window,['start','end','complete'],'window');
  fail(Date.parse(s.window.start) < Date.parse(s.window.end) && Date.parse(s.window.end) <= Date.parse(s.captured_at), 'window_order');
  fail(s.coverage && typeof s.coverage === 'object', 'coverage');
  for (const k of ['events','accounts','reads','settlements','billing','partners','spend','feedback','candidates','opportunities']) fail(bool(s.coverage[k]), `coverage_${k}`);
  for (const k of ['accounts','reads','events','settlements','billing','partners','feedback','candidates','opportunities','suppressions']) {
    fail(Array.isArray(s[k]) && s[k].length <= 100000, k);
    if (k !== 'suppressions') {
      const seen = new Map();
      for (const row of s[k]) {
        fail(row && id(row.id), `${k}_id`);
        if (seen.has(row.id)) fail(canonical(seen.get(row.id)) === canonical(row), `${k}_conflicting_duplicate`);
        seen.set(row.id, row);
      }
      s[k] = [...seen.values()];
    }
  }
  const before = v => date(v) && Date.parse(v) <= Date.parse(s.captured_at);
  for (const a of s.accounts) {
    keys(a,['id','canonical_id','email_verified','use_case','relevant_context','is_internal','enrolled_at','api_key_created_at','acquisition_source','production_agent'],'account');
    fail(bool(a.email_verified) && bool(a.relevant_context) && bool(a.is_internal) && bool(a.production_agent), 'account_flags');
    fail(typeof a.use_case === 'string' && a.use_case.length <= 2000 && text(a.acquisition_source, 120), 'account_context');
    fail(before(a.enrolled_at) && (a.api_key_created_at === null || before(a.api_key_created_at)), 'account_dates');
    fail(a.canonical_id === undefined || id(a.canonical_id), 'canonical_identity');
  }
  const accountIds = new Set(s.accounts.map(a => a.id));
  const byId = new Map(s.accounts.map(a => [a.id,a]));
  for (const a of s.accounts) {
    const seen = new Set(); let current = a;
    while (current.canonical_id && current.canonical_id !== current.id) {
      fail(accountIds.has(current.canonical_id), 'dangling_canonical_identity');
      fail(!seen.has(current.id), 'cyclic_canonical_identity');
      seen.add(current.id); current=byId.get(current.canonical_id);
    }
  }
  for (const r of s.reads) {
    keys(r,['id','account_id','occurred_at','interface','product_present','confidence','calibration_version','cost_usd','method','failure_reason','session_id'],'read');
    fail(accountIds.has(r.account_id) && before(r.occurred_at), 'read_identity_date');
    fail(allowed(r.interface, ['api','mcp','testbench']) && bool(r.product_present), 'read_type');
    fail(num(r.confidence) && r.confidence <= 1 && num(r.cost_usd), 'read_numbers');
    fail(typeof r.calibration_version === 'string' && text(r.method, 100) && text(r.session_id, 160), 'read_provenance');
    fail(r.failure_reason === null || text(r.failure_reason, 200), 'read_failure');
  }
  for (const e of s.events) {keys(e,['id','type','account_id','occurred_at','source'],'event');fail(before(e.occurred_at) && text(e.type, 100) && text(e.source, 120) && (e.account_id === null || accountIds.has(e.account_id)), 'event');}
  for (const b of s.billing) {keys(b,['id','occurred_at','status','amount_usd','source'],'billing');fail(before(b.occurred_at) && allowed(b.status,['settled','refunded','failed']) && num(b.amount_usd) && b.source === 'human_signup', 'billing');}
  for (const x of s.settlements) {keys(x,['id','occurred_at','network','status','payer','amount_usd'],'settlement');fail(before(x.occurred_at) && allowed(x.network,['base-mainnet','base-sepolia']) && allowed(x.status,['settled','failed']) && allowed(x.payer,['agent','human']) && num(x.amount_usd), 'settlement');}
  for (const p of s.partners) {keys(p,['id','distributed_at'],'partner');fail(p.distributed_at === null || before(p.distributed_at), 'partner');}
  for (const f of s.feedback) {keys(f,['id','account_id','occurred_at'],'feedback');fail(accountIds.has(f.account_id) && before(f.occurred_at), 'feedback');}
  keys(s.spend,['paid_media_usd'],'spend');
  fail(num(s.spend?.paid_media_usd), 'spend');
  fail(s.icp && allowed(s.icp.status,['approved','proposed','missing']), 'icp');
  keys(s.icp,['product_slug','source','buyer_definition','status','revision','reviewed_at'],'icp');
  if (s.icp.status === 'approved') {
    fail(s.icp.product_slug === 'legibility' && s.icp.source === 'control-center:product_icp', 'icp_product_source');
    fail(text(s.icp.revision,200) && before(s.icp.reviewed_at) && text(s.icp.buyer_definition,4000), 'icp_definition_provenance');
  }
  fail(s.benchmark && typeof s.benchmark.selection_method === 'string' && bool(s.benchmark.consented), 'benchmark');
  keys(s.benchmark,['selection_method','consented'],'benchmark');
  for(const c of s.candidates) {
    keys(c,['id','account_id','pool','company','project','channel','current_signal','relationship','scores','draft','contact','partner_id'],'candidate');
    keys(c.current_signal,['text','url','observed_at'],'candidate_signal');
    keys(c.relationship,['kind','evidence','url'],'candidate_relationship');
    keys(c.scores,['fit','project','relationship','distribution','timing'],'candidate_scores');
    keys(c.contact,['status','last_sent_at','followups'],'candidate_contact');
    if(c.draft!==null)keys(c.draft,['text','source_refs'],'candidate_draft');
    fail(date(c.current_signal.observed_at) && (c.contact.last_sent_at===null||before(c.contact.last_sent_at)), 'candidate_dates');
  }
  for(const o of s.opportunities) {keys(o,['id','kind','title','url','evidence_url','observed_at','status','effort_minutes'],'opportunity');fail(date(o.observed_at),'opportunity_date');}
  for(const x of s.suppressions) {keys(x,['candidate_id','reason'],'suppression');fail(id(x.candidate_id)&&text(x.reason,500),'suppression');}
  return s;
}
export function validateReport(r) {
  keys(r,['schema_version','engine_id','product_slug','run_id','mode','observed_at','source','status','scorecard','actions','holds','opportunities','payload_sha256'],'report');
  fail(r?.schema_version === VERSION && r.engine_id === 'growth-legibility' && r.product_slug === 'legibility', 'report_identity');
  fail(/^gl_[a-f0-9]{64}$/.test(r.run_id) && date(r.observed_at), 'report_run');
  fail(allowed(r.mode,['live','synthetic']) && allowed(r.status,['ready','held','degraded']), 'report_status');
  fail(r.source && text(r.source.snapshot_id) && /^[a-f0-9]{64}$/.test(r.source.snapshot_sha256) && date(r.source.captured_at) && text(r.source.app_revision) && /^[a-f0-9]{64}$/.test(r.source.corpus_sha256), 'report_source');
  keys(r.source,['snapshot_id','snapshot_sha256','captured_at','app_revision','corpus_sha256'],'report_source');
  fail(r.scorecard?.metrics && r.scorecard?.recommendation && Array.isArray(r.scorecard.tripwires), 'report_scorecard');
  fail(Array.isArray(r.actions) && r.actions.length <= 5 && Array.isArray(r.holds) && Array.isArray(r.opportunities), 'report_work');
  for (const a of r.actions) fail(['pending_human','work_required'].includes(a.status), 'action_authority');
  const { payload_sha256, ...body } = r;
  fail(payload_sha256 === sha256(body), 'report_digest');
  return r;
}

// Control Center growth engine protocol 1.0.0 (ADR-038). docs/control-center/engine-report.schema.json is the wire shape.
// Every object is closed: the server refuses an unknown field, so this boundary refuses it first.
export const PROTOCOL = Object.freeze({ slug:'legibility', engine_id:'growth-legibility', product_slug:'legibility' });
const protocolId = v => typeof v === 'string' && /^[A-Za-z0-9][A-Za-z0-9:._-]{0,119}$/.test(v);
const snake = v => typeof v === 'string' && /^[a-z][a-z0-9_]{0,63}$/.test(v);
const hex64 = v => typeof v === 'string' && /^[0-9a-f]{64}$/.test(v);
const dateTime = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(v) && Number.isFinite(Date.parse(v));
const str = (v, max) => typeof v === 'string' && v.length <= max;
const line = (v, max) => str(v, max) && v.length > 0;
const orNull = (v, test) => v === null || v === undefined || test(v);
const https = v => typeof v === 'string' && /^https:\/\/\S+$/.test(v);
const list = (v, max, label) => fail(v === undefined || (Array.isArray(v) && v.length <= max), label);
export function validateEngineEnvelope(r) {
  keys(r,['schema_version','engine_id','product_slug','run_id','mode','observed_at','source','status','objectives','activity','proposals','events','holds','payload_sha256'],'engine_report');
  fail(r.schema_version === VERSION && line(r.engine_id, 64) && line(r.product_slug, 64), 'engine_report_identity');
  fail(protocolId(r.run_id) && allowed(r.mode,['live','synthetic']) && dateTime(r.observed_at), 'engine_report_run');
  fail(allowed(r.status,['ready','held','degraded']), 'engine_report_status');
  keys(r.source,['revision','captured_at'],'engine_report_source');
  fail(str(r.source.revision, 128) && dateTime(r.source.captured_at), 'engine_report_source');
  list(r.objectives, 20, 'engine_report_objectives');
  for (const o of r.objectives ?? []) {
    keys(o,['key','value','unit','window_start','window_end','timezone','availability','reason'],'engine_objective');
    fail(snake(o.key) && (o.value === null || (typeof o.value === 'number' && Number.isFinite(o.value))) && str(o.unit, 40), 'engine_objective_value');
    fail(allowed(o.availability,['measured','missing','stale']) && orNull(o.reason, v => str(v, 500)), 'engine_objective_availability');
    fail(o.availability === 'measured' ? o.value !== null : line(o.reason ?? '', 500), 'engine_objective_unknown_needs_reason');
    fail(orNull(o.window_start, dateTime) && orNull(o.window_end, dateTime) && orNull(o.timezone, v => str(v, 64)), 'engine_objective_window');
  }
  list(r.activity, 40, 'engine_report_activity');
  for (const a of r.activity ?? []) { keys(a,['line','evidence_url'],'engine_activity'); fail(line(a.line, 500) && orNull(a.evidence_url, https), 'engine_activity'); }
  list(r.proposals, 10, 'engine_report_proposals');
  const proposalIds = new Set();
  for (const p of r.proposals ?? []) {
    keys(p,['proposal_id','title','why','kind','wall','amount_usd','channel','objective_key','exact_payload','payload_sha256','evidence','close_condition','expires_at'],'engine_proposal');
    fail(protocolId(p.proposal_id) && !proposalIds.has(p.proposal_id), 'engine_proposal_id'); proposalIds.add(p.proposal_id);
    fail(line(p.title, 160) && line(p.why, 1000) && allowed(p.kind,['advice','prepared','autonomous']) && allowed(p.wall,['none','spend','send','post','strategy']), 'engine_proposal_shape');
    fail(orNull(p.amount_usd, v => typeof v === 'number' && Number.isFinite(v) && v >= 0) && orNull(p.channel, v => str(v, 60)) && orNull(p.objective_key, snake) && orNull(p.exact_payload, v => str(v, 8000)), 'engine_proposal_fields');
    fail(hex64(p.payload_sha256) && orNull(p.expires_at, dateTime), 'engine_proposal_digest');
    fail(!(p.kind === 'autonomous' && p.wall !== 'none'), 'engine_proposal_autonomous_behind_wall');
    fail(!['send','post'].includes(p.wall) || line(p.exact_payload ?? '', 8000), 'engine_proposal_exact_payload_required');
    fail(p.wall !== 'spend' || typeof p.amount_usd === 'number', 'engine_proposal_amount_required');
    list(p.evidence, 12, 'engine_proposal_evidence');
    for (const e of p.evidence ?? []) { keys(e,['label','url'],'engine_evidence'); fail(line(e.label, 500) && orNull(e.url, https), 'engine_evidence'); }
    keys(p.close_condition,['event','reference'],'engine_close_condition');
    fail(snake(p.close_condition.event) && orNull(p.close_condition.reference, v => str(v, 500)), 'engine_close_condition');
  }
  list(r.events, 40, 'engine_report_events');
  for (const e of r.events ?? []) { keys(e,['event','proposal_id','at','evidence_url'],'engine_event'); fail(snake(e.event) && orNull(e.proposal_id, v => typeof v === 'string') && dateTime(e.at) && orNull(e.evidence_url, https), 'engine_event'); }
  list(r.holds, 40, 'engine_report_holds');
  for (const h of r.holds ?? []) { keys(h,['reason','detail'],'engine_hold'); fail(line(h.reason, 200) && orNull(h.detail, v => str(v, 1000)), 'engine_hold'); }
  const { payload_sha256, ...body } = r;
  fail(hex64(payload_sha256) && payload_sha256 === sha256(body), 'engine_report_digest');
  return r;
}
// The envelope this engine may send: bound to its own registry row and carrying every collection.
export function validateEngineReport(r) {
  validateEngineEnvelope(r);
  fail(r.engine_id === PROTOCOL.engine_id && r.product_slug === PROTOCOL.product_slug, 'engine_report_binding');
  for (const k of ['objectives','activity','proposals','events','holds']) fail(Array.isArray(r[k]), `engine_report_${k}_required`);
  return r;
}
const ATTEMPT_STATES = ['started','succeeded','failed','unknown'];
export function validateAttempt(a) {
  keys(a,['attempt_id','command','run_id','status','phase','error_code','started_at','finished_at'],'engine_attempt');
  fail(protocolId(a.attempt_id) && snake(a.command) && orNull(a.run_id, protocolId) && allowed(a.status, ATTEMPT_STATES) && snake(a.phase), 'engine_attempt_shape');
  fail(dateTime(a.started_at) && (a.status === 'started' ? a.finished_at === undefined : dateTime(a.finished_at)), 'engine_attempt_times');
  fail(a.status === 'failed' ? snake(a.error_code) : orNull(a.error_code, snake), 'engine_attempt_error_code');
  return a;
}
export function validateDirective(d) {
  fail(d && typeof d === 'object' && SERVED.test(d.schema_version ?? '') && typeof d.directive_id === 'string' && d.directive_id.startsWith(`${PROTOCOL.slug}:`), 'directive_identity');
  fail(d.engine_id === PROTOCOL.engine_id && /^\d{4}-\d{2}-\d{2}$/.test(d.for_date ?? ''), 'directive_engine');
  fail(Array.isArray(d.objectives) && Array.isArray(d.decisions_since) && d.constraints && typeof d.constraints.walls === 'string', 'directive_shape');
  const n = d.next_action;
  fail(n && typeof n === 'object' && orNull(n.proposal_id, v => typeof v === 'string') && typeof n.instruction === 'string', 'directive_next_action');
  return d;
}
export function validateDecision(x) {
  fail(x && typeof x === 'object' && typeof x.proposal_id === 'string' && allowed(x.decision,['approved','declined','done']) && dateTime(x.decided_at) && orNull(x.payload_sha256, hex64), 'decision_shape');
  return x;
}
