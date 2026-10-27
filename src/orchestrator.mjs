import { readFileSync } from 'node:fs';
import { validateReport, validateEngineReport, sha256, VERSION, DRAFT_PRESS_VERSION } from './guards/wire.mjs';
import { emailAction } from './lib/draft-press.mjs';
import { siteActivity } from './lib/cc-signals.mjs';
import { isoWeek } from './stages/measure.mjs';
import { capture } from './capture.mjs';
import { measure } from './stages/measure.mjs';
import { icpCurrent, prepare } from './stages/prepare.mjs';

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

// Control Center protocol 1.0.0: the private report above is flattened into the one envelope every growth engine sends.
// The private report stays in the ignored runtime spool; only this envelope travels.
const OBJECTIVES = [
  { key:'activated', metric:'first_trusted_reads', target:'activated', unit:'builders' },
  { key:'returning', metric:'seven_day_returning', target:'returning', unit:'builders' },
  { key:'net', metric:'qualified_enrolments', target:'net', unit:'founding_members' },
];
const clip = (text, max) => text.length <= max ? text : `${text.slice(0, max - 3).trimEnd()}...`;
const short = value => sha256(String(value)).slice(0, 16);
const httpsEvidence = refs => [...new Set(refs ?? [])].filter(u => /^https:\/\/\S+$/.test(u)).slice(0, 12).map(url => ({ label:'Cited source', url }));
const objectiveFor = code => /enrol|referral|report_to/.test(code) ? 'net' : /return/.test(code) ? 'returning' : 'activated';
// What Control Center's Mindmake record says about the person, in plain words for Krish (Ruling, Krish, 2026-10-27).
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const MINDMAKE_STAGE = { drafted:() => 'a note drafted, not shown as sent', sent:by => by === 'krish' ? 'a note Krish sent' : 'a note sent for Krish',
  replied:by => by === 'krish' ? 'a reply to a note Krish sent' : 'a reply to a note sent for Krish', met:() => 'a conversation with Krish' };
function mindmakeWhy(m) {
  if (m?.state === 'none') return 'Control Center has no Mindmake note to them on record, so the note does not name Mindmake; the record is linked in the evidence.';
  if (!MINDMAKE_STAGE[m?.state] || !Number.isFinite(Date.parse(m.state_at))) return '';
  const at = new Date(m.state_at);
  return `Control Center records Mindmake contact with them (${MINDMAKE_STAGE[m.state](m.by)}, ${MONTHS[at.getUTCMonth()]} ${at.getUTCFullYear()}), so the note opens with the approved Mindmake lines; the record is linked in the evidence.`;
}
function invitationEvidence(refs, m) {
  const record = /^https:\/\/\S+$/.test(m?.record_url ?? '') ? m.record_url : null;
  return [...(record ? [{ label:'Their Mindmake record in Control Center', url:record }] : []), ...httpsEvidence((refs ?? []).filter(u => u !== record))].slice(0, 12);
}

export function protocolRunId(command, at, discriminator) {
  const id = `legibility:${new Date(at).toISOString().slice(0, 10)}:${command}:${discriminator}`;
  if (!/^[A-Za-z0-9][A-Za-z0-9:._-]{0,119}$/.test(id)) throw new Error('run_id_invalid');
  return id;
}

export function directiveActivity(directive) {
  if (!directive) return null;
  const next = directive.next_action?.proposal_id ? `next action ${directive.next_action.proposal_id}` : 'no named proposal as the next action';
  return { line: clip(`Pulled directive ${directive.directive_id} for ${directive.for_date}, with ${next}. Worked inside the walls: nothing was sent, posted, spent or deleted.`, 500), evidence_url: null };
}

function seal(body) { return validateEngineReport({ ...body, payload_sha256: sha256(body) }); }

function constraintProposal(rec) {
  const strategy = rec.code === 'activate_campaign';
  return {
    proposal_id:`legibility:constraint:${rec.code}`, title:clip(rec.action, 160), why:clip(`${rec.reason}. ${rec.action}.`, 1000),
    kind:'advice', wall:strategy ? 'strategy' : 'none', amount_usd:null, channel:null, objective_key:objectiveFor(rec.code),
    exact_payload:null, payload_sha256:sha256({ code:rec.code, action:rec.action, reason:rec.reason }), evidence:[],
    close_condition:{ event:'constraint_resolved', reference:rec.code }, expires_at:null,
  };
}

function actionProposal(a, draftPress) {
  if (a.status === 'pending_human') {
    // Krish approves these exact words for this target on this channel; the id binds target and channel, the digest binds the words.
    const target = short(a.candidate_id);
    const channel = String(a.candidate.channel).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'channel';
    const mindmake = a.candidate.contact?.prior_mindmake;
    const base = {
      proposal_id:`legibility:invite:${target}:${channel}`,
      title:clip(`Send a researched ${a.candidate.relationship?.kind ?? 'named'} invitation to a ${a.candidate.pool} prospect`, 160),
      why:clip([`Scored ${a.score} of 100 against the approved buyer definition, from a signal observed ${a.lineage.signal_observed_at}.`, mindmakeWhy(mindmake), 'If Krish approves these exact words he sends them himself; the engine never sends.'].filter(Boolean).join(' '), 1000),
      kind:'prepared', wall:'send', amount_usd:null, channel:clip(String(a.candidate.channel), 60), objective_key:'activated',
      exact_payload:a.exact_text, payload_sha256:a.text_sha256, evidence:invitationEvidence(a.source_refs, mindmake),
      close_condition:{ event:'invitation_sent', reference:`candidate:${target}` }, expires_at:a.expires_at,
    };
    // 1.12.0, only when Control Center serves the Draft press: the same approved words as a version 2 email action, so his
    // Clear drafts them into his own Gmail. The proposal keeps its id; the digest binds the whole action. Anything that cannot
    // be one (no contact id or record, not an email, no subject line) stays plain words, exactly as before.
    const v2 = draftPress ? emailAction(a) : null;
    if (!v2?.ok) return base;
    return {
      ...base,
      why:clip([`Scored ${a.score} of 100 against the approved buyer definition, from a signal observed ${a.lineage.signal_observed_at}.`, mindmakeWhy(mindmake), 'If Krish approves, Control Center drafts these exact words into his own Gmail and he sends them himself; the engine never sends.'].filter(Boolean).join(' '), 1000),
      channel:'email', exact_payload:v2.exact_payload, payload_sha256:sha256(v2.exact_payload),
      subject_ref:`contact:${v2.action.recipient_contact_id}`, source_revision:structuredClone(draftPress.source_revision),
    };
  }
  const subject = a.opportunity_id ? `opportunity:${short(a.opportunity_id)}` : `candidate:${short(a.candidate_id)}`;
  const kindWord = a.opportunity_id ? `${a.kind} distribution` : `${a.candidate?.pool ?? 'candidate'} prospect`;
  return {
    proposal_id:`legibility:work:${subject.replace(':', '-')}:${a.type}`.slice(0, 120),
    title:clip(`${a.type.replace(/_/g, ' ').replace(/^./, c => c.toUpperCase())} for one ${kindWord} lead`, 160),
    why:clip(`${a.requested_work}${a.effort_minutes !== undefined ? ` About ${a.effort_minutes} minutes.` : ''}`, 1000),
    kind:'advice', wall:'none', amount_usd:null, channel:null, objective_key:'activated', exact_payload:null,
    payload_sha256:sha256(a), evidence:httpsEvidence(a.source_refs),
    close_condition:{ event:a.opportunity_id ? 'distribution_asset_prepared' : 'prospect_work_done', reference:subject }, expires_at:null,
  };
}

function protocolHolds(holds) {
  const byCode = new Map();
  for (const h of holds) {
    const entry = byCode.get(h.code) ?? { detail:h.reason ?? h.next_action ?? null, count:0 };
    entry.count++; byCode.set(h.code, entry);
  }
  return [...byCode].slice(0, 40).map(([code, { detail, count }]) => ({
    reason:clip(String(code), 200), detail:detail ? clip(count > 1 ? `${detail} (${count} items)` : detail, 1000) : null,
  }));
}

function fmt(m) { return m?.value === null || m?.value === undefined ? `unknown (${m?.reason ?? 'not measured'})` : `${m.value}`; }

// The North Star number always travels as an activity line. Since protocol 1.13.0 Control Center may register
// weekly_builders and conversations_held as objectives (migration 20261112150000); the directive's objectives say which
// are registered, and only those are reported as objectives (registeredObjectives below), so against a registry
// without them the report is unchanged.
function weeklyBuildersLine(metric, window) {
  const scope = window ? `in ISO week ${window.iso_week} to ${window.as_of}` : 'this ISO week';
  const value = metric?.value === null || metric?.value === undefined ? `unknown (${metric?.reason ?? 'not measured'})`
    : `${metric.value} builder${metric.value === 1 ? '' : 's'} with at least one trusted read`;
  return { line:clip(`weekly_builders: ${value} ${scope}, internal accounts excluded, counted per account until the export carries key ids.`, 500), evidence_url:null };
}

const HELD_REASON = 'calendar_read_missing: held conversations are counted from Krish\'s calendar, read only, and that read does not exist yet; a booking never counts as held';
/** The keys the directive says the registry holds for this engine (its objectives[].key), beyond the original three. */
export function registeredObjectives(directive) {
  const keys = new Set((Array.isArray(directive?.objectives) ? directive.objectives : []).map(o => o?.key).filter(k => typeof k === 'string'));
  return { weekly_builders:keys.has('weekly_builders'), conversations_held:keys.has('conversations_held') };
}
/** weekly_builders and conversations_held as objectives, where registered. `wb` is { value, reason, week_start, as_of, stale }. */
function numberObjectives(registered, wb) {
  const out = [];
  if (registered.weekly_builders) {
    const base = { key:'weekly_builders', unit:'builders', window_start:wb.week_start, window_end:wb.as_of, timezone:'UTC' };
    if (wb.value === null || wb.value === undefined) out.push({ ...base, value:null, availability:'missing', reason:clip(wb.reason ?? 'Not measured', 500) });
    else if (wb.stale) out.push({ ...base, value:wb.value, availability:'stale', reason:'The source snapshot is older than the policy freshness limit' });
    else out.push({ ...base, value:wb.value, availability:'measured', reason:null });
  }
  if (registered.conversations_held) out.push({ key:'conversations_held', value:null, unit:'conversations', window_start:null, window_end:null, timezone:'UTC', availability:'missing', reason:HELD_REASON });
  return out;
}

// Flatten a sealed private report into the protocol envelope. Unknown stays null with its reason, never zero.
// draftPress is { source_revision } only when Control Center's capabilities serve the Draft press (features.draft_press at
// 1.12.0 or later); then each invitation that can be a version 2 email action travels as one, and the report says 1.12.0.
// Without it, or with no invitation that can be one, the envelope is exactly the 1.0.0 one.
export function engineReport(report, { runId, directive = null, directiveHold = null, draftPress = null }) {
  validateReport(report);
  const { campaign, metrics, recommendation } = report.scorecard;
  const stale = report.holds.some(h => h.code === 'stale_snapshot');
  const windowEnd = campaign.activated_at ? new Date(Math.min(Date.parse(report.observed_at), Date.parse(campaign.ends_at))).toISOString() : null;
  const objectives = OBJECTIVES.map(({ key, metric, unit }) => {
    const m = metrics[metric];
    const base = { key, unit, window_start:campaign.activated_at, window_end:windowEnd, timezone:'UTC' };
    if (!campaign.activated_at) return { ...base, value:null, availability:'missing', reason:'The Founding 200 campaign clock has not been activated, so there is no campaign window to count in; observations are baseline only' };
    if (m.value === null) return { ...base, value:null, availability:'missing', reason:clip(m.reason ?? 'Not measured', 500) };
    if (stale) return { ...base, value:m.value, availability:'stale', reason:'The source snapshot is older than the policy freshness limit' };
    return { ...base, value:m.value, availability:'measured', reason:null };
  });
  const wbWindow = report.scorecard.north_star?.weekly_builders_window;
  objectives.push(...numberObjectives(registeredObjectives(directive), {
    value:metrics.weekly_builders?.value ?? null, reason:metrics.weekly_builders?.reason ?? null,
    week_start:wbWindow?.week_start ?? null, as_of:wbWindow?.as_of ?? null, stale,
  }));
  const pending = report.actions.filter(a => a.status === 'pending_human').length;
  const activity = [
    directiveActivity(directive),
    { line:clip(`Measured the Founding 200 funnel from a ${report.mode} source snapshot captured ${report.source.captured_at} (digest ${report.source.snapshot_sha256.slice(0, 12)}).`, 500), evidence_url:null },
    weeklyBuildersLine(metrics.weekly_builders, report.scorecard.north_star?.weekly_builders_window),
    { line:clip(`Recommended constraint: ${recommendation.action}.`, 500), evidence_url:null },
    { line:`Prepared ${pending} named invitation${pending === 1 ? '' : 's'} for Krish to review and ${report.actions.length - pending} work task${report.actions.length - pending === 1 ? '' : 's'}. Nothing was sent or published.`, evidence_url:null },
    { line:clip(`Weekly production agents: ${fmt(metrics.production_agents_weekly)}. Weekly median trusted reads per active account: ${fmt(metrics.weekly_median_trusted_reads_per_active_account)}. Mainnet agent revenue USD: ${fmt(metrics.mainnet_agent_revenue_usd)}; testnet volume is never counted as revenue.`, 500), evidence_url:null },
    { line:`Distribution inventory holds ${report.opportunities.length} verified opportunit${report.opportunities.length === 1 ? 'y' : 'ies'}, ${report.opportunities.filter(o => o.status === 'uncovered').length} uncovered.`, evidence_url:null },
    ...siteActivity(directive?.web_analytics),
  ].filter(Boolean);
  const proposals = [...report.actions.map(a => actionProposal(a, draftPress)), constraintProposal(recommendation)].slice(0, 10);
  const holds = protocolHolds(report.holds);
  if (directiveHold) holds.push(directiveHold);
  const status = report.status === 'ready' && directiveHold ? 'degraded' : report.status;
  return seal({
    schema_version:proposals.some(p => p.source_revision) ? DRAFT_PRESS_VERSION : VERSION, engine_id:'growth-legibility', product_slug:'legibility', run_id:runId, mode:report.mode,
    observed_at:report.observed_at, source:{ revision:report.source.snapshot_sha256, captured_at:report.source.captured_at },
    status, objectives, activity, proposals, events:[], holds,
  });
}

// A run with no source snapshot still reports, honestly: held, nothing measured, and the missing inputs named.
// extraHolds name why an export that was configured did not arrive; with none, the report is exactly the one sent
// before the export client existed.
// icp is the buyer Control Center's directive carried (src/lib/cc-signals.mjs readIcp), or null. Only a current approved
// one (prepare's own rule, icpCurrent) clears icp_not_current_approved; with none, the report is exactly the one sent
// before the directive carried a buyer.
export function heldEngineReport({ runId, at, revision, mode = 'live', policy, directive = null, directiveHold = null, extraHolds = [], icp = null }) {
  const inactive = !policy?.campaign?.activated_at;
  const reason = `No source snapshot from the Legibility app reached this run, so nothing was measured.${inactive ? ' The campaign clock has not been activated either.' : ''}`;
  const objectives = OBJECTIVES.map(({ key, unit }) => ({ key, value:null, unit, window_start:policy?.campaign?.activated_at ?? null, window_end:null, timezone:'UTC', availability:'missing', reason }));
  objectives.push(...numberObjectives(registeredObjectives(directive), { value:null, reason, week_start:new Date(isoWeek(Date.parse(at)).start).toISOString(), as_of:at, stale:false }));
  const buyer = icpCurrent(icp, at);
  const holds = [
    { reason:'source_snapshot_missing', detail:'The runner has no authenticated export from the app (accounts, server-metered reads, events, settlements). Measurement and preparation stay held until the source owner supplies one with --snapshot.' },
    ...(buyer ? [] : [{ reason:'icp_not_current_approved', detail:'No current approved Legibility buyer definition from Control Center product_icp reached this run, so prospecting stays held. Control Center still owes the narrow product_icp read path.' }]),
    ...extraHolds,
  ];
  if (directiveHold) holds.push(directiveHold);
  const rec = buyer
    ? { code:'restore_measurement', action:'Connect the app snapshot export to this runner', reason:'Unknown observations cannot establish funnel performance or justify outreach' }
    : { code:'restore_measurement', action:'Connect the app snapshot export and the product_icp read path to this runner', reason:'Unknown observations cannot establish funnel performance or justify outreach' };
  const held = buyer
    ? { line:`Held measurement and preparation: no source snapshot reached the runner. The approved buyer did, from Control Center product_icp (revision ${String(icp.revision).replace(/^sha256:/, '').slice(0, 12)}, reviewed ${icp.reviewed_at}). No objective was guessed and nothing was sent.`, evidence_url:null }
    : { line:'Held measurement and preparation: no source snapshot or canonical ICP reached the runner. No objective was guessed and nothing was sent.', evidence_url:null };
  return seal({
    schema_version:VERSION, engine_id:'growth-legibility', product_slug:'legibility', run_id:runId, mode, observed_at:at,
    source:{ revision:String(revision).slice(0, 128), captured_at:at }, status:'held', objectives,
    activity:[directiveActivity(directive), held, ...siteActivity(directive?.web_analytics)].filter(Boolean),
    proposals:[constraintProposal(rec)], events:[], holds,
  });
}
