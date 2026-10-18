import { readFileSync } from 'node:fs';
import { validateReport, sha256, VERSION } from './guards/wire.mjs';
import { capture } from './capture.mjs';
import { measure } from './stages/measure.mjs';
import { prepare } from './stages/prepare.mjs';

export function buildReport(raw, rawPolicy, at, corpusSha) {
  const {policy,snapshot,sourceHash}=capture(raw,rawPolicy,at);
  const scorecard = measure(snapshot, at, policy);
  const prepared = prepare(snapshot, at, policy);
  const holds = [...prepared.holds];
  if (!snapshot.window.complete) holds.push({code:'incomplete_window', reason:'Pagination/export coverage is incomplete; counts cannot represent the population.'});
  if (snapshot.mode === 'live' && Date.parse(at)-Date.parse(snapshot.captured_at) > policy.max_snapshot_age_hours*3600000) holds.push({code:'stale_snapshot',reason:'Refresh the source export before preparing or reporting live work.'});
  if (Date.parse(at) >= Date.parse(policy.source_review_due)) holds.push({code:'source_review_due',reason:'Review pinned product and operating claims; changing the date alone does not renew review.'});
  if (snapshot.spend.paid_media_usd > 0) holds.push({code:'paid_media_detected',reason:'The acquisition test is configured for zero paid media; review the source before any further work.'});
  const blocked = holds.some(h => ['incomplete_window','stale_snapshot','source_review_due','paid_media_detected'].includes(h.code));
  const body = {
    schema_version: VERSION, engine_id:'growth-legibility', product_slug:'legibility',
    run_id:`gl_${sha256({snapshot:sourceHash,policy,at,corpusSha})}`, mode:snapshot.mode, observed_at:at,
    source:{snapshot_id:snapshot.snapshot_id,snapshot_sha256:sourceHash,captured_at:snapshot.captured_at,app_revision:snapshot.app_revision,corpus_sha256:corpusSha},
    status:blocked?'held':holds.length?'degraded':'ready', scorecard,
    actions:blocked?[]:prepared.actions, holds, opportunities:prepared.opportunities,
  };
  return validateReport({...body,payload_sha256:sha256(body)});
}

export function publicSummary(report) {
  validateReport(report);
  // Explicit allowlist. No raw actions, candidates, account IDs, evidence URLs or product inputs.
  return {schema_version:VERSION,engine_id:report.engine_id,mode:report.mode,run_id:report.run_id,status:report.status,
    observed_at:report.observed_at,metrics:report.scorecard.metrics,funnel:report.scorecard.funnel,
    benchmark:report.scorecard.benchmark,tripwires:report.scorecard.tripwires,campaign:report.scorecard.campaign,north_star:report.scorecard.north_star,
    next_action:report.scorecard.recommendation,approval_items:report.actions.filter(a=>a.status==='pending_human').length,
    holds:report.holds.map(h=>({code:h.code??'held'}))};
}

export function loadJson(path) {
  const bytes = readFileSync(path);
  if (bytes.length > 20*1024*1024) throw new Error('input_size_limit');
  return JSON.parse(bytes.toString('utf8'));
}
