import { createHash } from 'node:crypto';

export const VERSION = '1.0.0';
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
