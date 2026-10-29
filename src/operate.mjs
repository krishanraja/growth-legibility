import { deliver } from './transport.mjs';
import { buildReport, engineReport, heldEngineReport, protocolRunId } from './orchestrator.mjs';
import { captureExport, exportHold } from './lib/export-client.mjs';
import { readPriorMindmake } from './lib/prior-outreach.mjs';
import { emailAction, templateRevision } from './lib/draft-press.mjs';
import { applyIcp, readIcp, researchAvailability } from './lib/cc-signals.mjs';
import { heldBy, heldReport } from './lib/hold.mjs';

// One Control Center run, in the protocol's order: journal the attempt, pull the directive, do the engine's own work
// inside the walls, report and read back, read Krish's decisions, close the attempt. Nothing here sends, posts,
// publishes, spends or deletes: an approval only means Krish said yes to exactly that payload, and he acts himself.
const DAY = 86_400_000;
const SNAKE = /^[a-z][a-z0-9_]{0,63}$/;
// Only a lost response leaves the outcome open; every other failure is definite.
const UNCERTAIN = new Set(['receiver_transport_uncertain']);

export function errorCode(e) {
  if (SNAKE.test(e?.code ?? '')) return e.code;
  const head = String(e?.message ?? '').split(':')[0];
  return SNAKE.test(head) ? head : 'engine_failed';
}

// Compare decisions with what this run proposed. A yes counts only on the exact payload digest it was made on.
export function matchDecisions(decisions, envelope) {
  const proposals = new Map(envelope.proposals.map(p => [p.proposal_id, p]));
  const tally = { approved_exact:0, approved_changed:0, approved_elsewhere:0, declined:0, done:0 };
  for (const d of decisions) {
    if (d.decision === 'declined') tally.declined++;
    else if (d.decision === 'done') tally.done++;
    else {
      const p = proposals.get(d.proposal_id);
      if (!p) tally.approved_elsewhere++;
      else if (p.payload_sha256 === d.payload_sha256) tally.approved_exact++;
      else tally.approved_changed++;
    }
  }
  return tally;
}

// appExport is exportFromEnv()'s answer (src/lib/export-client.mjs). Absent, the run holds exactly as it did before the
// export client existed, and the summary names attribution_export_missing; a --snapshot file takes precedence.
// activation is this repository's own flag (readActivation in src/lib/hold.mjs, from config/activation.json; the CLI always
// passes it, and a missing file reads as held). Held here or by Control Center, the run measures, proposes nothing and
// reports one hold (Ruling, Krish, 2026-10-29).
export async function operate({ client, outbox, policy, corpusSha, at = new Date().toISOString(), loadSnapshot = null, invocation,
  synthetic = false, revision = 'unversioned-local', directiveDate = null, clock = () => new Date().toISOString(), appExport = { state:'absent' },
  sourceRevision = templateRevision, activation = { state:'active', reason:null } }) {
  const command = 'operate';
  const runId = protocolRunId(command, at, invocation);
  const attempt = { attempt_id:runId, command, run_id:runId, status:'started', phase:'start', error_code:null, started_at:new Date(at).toISOString() };
  const summary = { attempt_id:runId, run_id:runId, status:'failed', phase:'start', error_code:null };
  // Written before any source is read, so a failure before the report still shows on Growth > Engines.
  try { await client.postAttempt(attempt); }
  catch (e) { return { summary:{ ...summary, error_code:errorCode(e), journal:'not_started' }, privateReport:null }; }

  let phase = 'directive', status = 'succeeded', error_code = null, privateReport = null;
  try {
    let directive = null, directiveHold = null;
    try { directive = (await client.directive(directiveDate)).directive; }
    catch (e) {
      if (errorCode(e) === 'receiver_unauthorized') throw e;
      directiveHold = { reason:'directive_unavailable', detail:`Control Center did not return a readable directive (${errorCode(e)}); the run continued inside the walls.` };
    }
    summary.directive = directive ? { directive_id:directive.directive_id, next_action:directive.next_action?.proposal_id ?? null } : null;
    // 1.13.0: the buyer from Control Center's product_icp, carried in the directive when the capabilities say so, and
    // whether its research desk is open to this engine (recorded only: no research step runs before Phase 2). Any doubt
    // leaves the buyer absent, which holds exactly as before; it never stops the run.
    phase = 'icp';
    let served = { icp:null, state:'not_served', reason:'icp_not_served' };
    let ccActivation = null;
    try {
      const cap = await client.capabilities();
      ccActivation = cap.activation ?? null;
      served = readIcp(directive, cap.features, attempt.started_at);
      summary.research = researchAvailability(cap.features, cap.research);
    } catch (e) {
      if (errorCode(e) === 'receiver_unauthorized') throw e;
      served = { icp:null, state:'unavailable', reason:errorCode(e) };
      summary.research = { state:'unavailable', kinds:[], per_day:{} };
    }
    summary.icp = { state:served.state, reason:served.reason, revision:served.icp?.revision ?? null };
    const by = heldBy({ local:activation, activation:ccActivation, directive });
    summary.activation = { state:by.length ? 'held' : 'active', by, local:activation?.state === 'active' ? 'active' : 'held', control_center:ccActivation };
    phase = 'capture';
    let snapshot = loadSnapshot ? loadSnapshot() : null;
    let observedAt = attempt.started_at;
    const extraHolds = [];
    if (!snapshot) {
      const source = appExport ?? { state:'absent' };
      if (source.state === 'ready') {
        // F4: a loopback export is synthetic by construction, and never travels to the live origin. Refused before it is read.
        if (source.client.local && !client.local) throw Object.assign(new Error('synthetic_export_refused'), { code:'synthetic_export_refused' });
        try {
          ({ snapshot, at:observedAt } = await captureExport(source.client, { at:attempt.started_at, policy, clock }));
          summary.export = { state:'read', reason:null };
        } catch (e) {
          const hold = exportHold({ state:'failed', code:errorCode(e), detail:e?.detail ?? null });
          extraHolds.push(hold); summary.export = { state:'held', reason:hold.reason };
        }
      } else if (source.state === 'absent') {
        summary.export = { state:'absent', reason:'attribution_export_missing' };
      } else {
        const hold = exportHold(source);
        extraHolds.push(hold); summary.export = { state:'held', reason:hold.reason };
      }
    }
    phase = 'plan';
    let envelope;
    if (snapshot && served.icp) {
      // Control Center is the one source of the buyer: a served one replaces whatever the snapshot carried.
      const applied = applyIcp(snapshot, served.icp);
      snapshot = applied.snapshot;
      if (applied.reason) summary.icp.reason = applied.reason;
    }
    if (snapshot) {
      // Synthetic fixtures never count as live: they may only travel to a local stand-in.
      if (snapshot.mode !== 'live' && !client.local) throw Object.assign(new Error('synthetic_snapshot_refused'), { code:'synthetic_snapshot_refused' });
      // Each person's Mindmake record, from Control Center's reader only (1.11.0). A failed or partial read leaves the
      // record absent, which prepare holds as unknown; it never stops the run.
      // Held, nothing is prepared, so no one's record is read.
      if (!by.length) {
        phase = 'prior_outreach';
        let read;
        ({ snapshot, summary:read } = await readPriorMindmake(client, snapshot));
        summary.prior_outreach = read;
      }
      phase = 'plan';
      privateReport = buildReport(snapshot, policy, observedAt, corpusSha);
      // 1.12.0: an invitation that can be a version 2 email action travels as one only when Control Center serves the Draft
      // press. Any doubt (no such invitation, the feature or the version not served, a failed read, an unreadable template)
      // sends 1.0.0 exactly as before; it never stops the run.
      phase = 'draft_press';
      let draftPress = null;
      const draftable = by.length ? 0 : privateReport.actions.filter(a => emailAction(a).ok).length;
      summary.draft_press = { state:'not_needed', reason:null, actions:draftable };
      if (draftable) {
        let features = null;
        try { ({ features } = await client.capabilities()); }
        catch (e) { Object.assign(summary.draft_press, { state:'unavailable', reason:errorCode(e) }); }
        if (features && features.draft_press !== true) Object.assign(summary.draft_press, { state:'not_served', reason:'draft_press_not_served' });
        if (features?.draft_press === true) {
          try {
            draftPress = { source_revision:sourceRevision() };
            summary.draft_press.state = 'served';
          } catch { Object.assign(summary.draft_press, { state:'unavailable', reason:'source_revision_unreadable' }); }
        }
      }
      phase = 'plan';
      envelope = engineReport(privateReport, { runId, directive, directiveHold, draftPress });
    } else {
      envelope = heldEngineReport({ runId, at:attempt.started_at, revision, mode:synthetic ? 'synthetic' : 'live', policy, directive, directiveHold, extraHolds, icp:served.icp });
    }
    if (by.length) envelope = heldReport(envelope, { by, policy });
    outbox.put(envelope);
    summary.report = { status:envelope.status, mode:envelope.mode, payload_sha256:envelope.payload_sha256,
      objectives:envelope.objectives.map(o => ({ key:o.key, availability:o.availability })), proposals:envelope.proposals.length, holds:envelope.holds.map(h => h.reason) };
    phase = 'report';
    const receipt = await deliver(outbox, runId, { client });
    summary.report.readback = 'matched';
    summary.report.replayed = receipt.replayed;
    phase = 'decisions';
    const decisions = await client.decisions(new Date(Date.parse(attempt.started_at) - 7*DAY).toISOString());
    summary.decisions = matchDecisions(decisions, envelope);
    phase = 'done';
  } catch (e) {
    error_code = errorCode(e);
    status = UNCERTAIN.has(error_code) ? 'unknown' : 'failed';
  }
  const terminal = { ...attempt, status, phase, error_code, finished_at:new Date(Math.max(Date.parse(clock()), Date.parse(attempt.started_at))).toISOString() };
  Object.assign(summary, { status, phase, error_code });
  try { await client.postAttempt(terminal); summary.journal = 'closed'; }
  catch (e) { summary.journal = 'unclosed'; summary.journal_error = errorCode(e); }
  // The private report stays with the caller, for the ignored runtime spool only; the summary is safe to print.
  return { summary, privateReport };
}
