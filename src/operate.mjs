import { deliver } from './transport.mjs';
import { buildReport, engineReport, heldEngineReport, protocolRunId } from './orchestrator.mjs';

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

export async function operate({ client, outbox, policy, corpusSha, at = new Date().toISOString(), loadSnapshot = null, invocation,
  synthetic = false, revision = 'unversioned-local', directiveDate = null, clock = () => new Date().toISOString() }) {
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
    phase = 'capture';
    const snapshot = loadSnapshot ? loadSnapshot() : null;
    phase = 'plan';
    let envelope;
    if (snapshot) {
      // Synthetic fixtures never count as live: they may only travel to a local stand-in.
      if (snapshot.mode !== 'live' && !client.local) throw Object.assign(new Error('synthetic_snapshot_refused'), { code:'synthetic_snapshot_refused' });
      privateReport = buildReport(snapshot, policy, attempt.started_at, corpusSha);
      envelope = engineReport(privateReport, { runId, directive, directiveHold });
    } else {
      envelope = heldEngineReport({ runId, at:attempt.started_at, revision, mode:synthetic ? 'synthetic' : 'live', policy, directive, directiveHold });
    }
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
