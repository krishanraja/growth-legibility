import { PROTOCOL, receiverTakes, SERVED, validateAttempt, validateDecision, validateDirective, validateEngineReport } from './guards/wire.mjs';

// The one Control Center client for this engine: protocol 1.0.0 (ADR-038, docs/control-center/ENGINE-PROTOCOL.md).
// HTTPS to the approved origin only, no redirects, bounded timeouts, JSON only. The bearer is read by the caller at run
// time and is never logged, echoed, stored or written into an error. Every failure leaves as a lower_snake code.
export const APPROVED_ORIGIN = 'https://controlcenter.krishraja.com';
const PREFIX = `/api/growth/engines/${PROTOCOL.slug}`;
const TIMEOUT_MS = 20000;

export class ControlCenterError extends Error {
  constructor(message, code = message) { super(message); this.code = code; }
}
const fault = (code) => new ControlCenterError(code);

async function jsonResponse(response) {
  const text = await response.text();
  if (text.length > 20*1024*1024) throw fault('receiver_response_too_large');
  try { return JSON.parse(text); } catch { throw fault('receiver_non_json'); }
}
async function discard(response) { try { await response.body?.cancel(); } catch { /* nothing to release */ } }

export function controlCenter({ token, base = APPROVED_ORIGIN, fetcher = fetch, testMode = false } = {}) {
  let origin;
  try { origin = new URL(base); } catch { throw fault('receiver_origin_invalid'); }
  if (origin.username || origin.password || origin.search || origin.hash || !['', '/'].includes(origin.pathname)) throw fault('receiver_origin_invalid');
  // A loopback stand-in is reachable only from tests that ask for it; nothing else but the approved HTTPS origin.
  const local = testMode && ['127.0.0.1', 'localhost'].includes(origin.hostname) && origin.protocol === 'http:';
  if (origin.origin !== APPROVED_ORIGIN && !local) throw fault('receiver_origin_not_approved');
  if (typeof token !== 'string' || !token || /\s/.test(token)) throw fault('receiver_credential_missing');
  const root = origin.origin;

  async function request(path, { method = 'GET', body, headers = {} } = {}) {
    let response;
    try {
      response = await fetcher(`${root}${PREFIX}${path}`, {
        method, body, redirect:'error', signal:AbortSignal.timeout(TIMEOUT_MS),
        headers:{ authorization:`Bearer ${token}`, accept:'application/json', ...(body === undefined ? {} : { 'content-type':'application/json' }), ...headers },
      });
    } catch { throw fault('receiver_transport_uncertain'); }
    if (response.status === 401) { await discard(response); throw fault('receiver_unauthorized'); }
    return response;
  }

  async function capabilities() {
    const res = await request('/capabilities');
    if (!res.ok) { await discard(res); throw fault('receiver_not_ready'); }
    const cap = await jsonResponse(res);
    // The response also carries activation and features; only the identity, and that the
    // receiver still takes the 1.0.0 reports this engine sends, are compared.
    if (!SERVED.test(cap?.schema_version ?? '') || !receiverTakes(cap) || cap.engine_id !== PROTOCOL.engine_id || cap.product_slug !== PROTOCOL.product_slug) throw fault('receiver_contract_mismatch');
    return { activation:cap.activation?.state ?? null };
  }

  async function readAttempt(attemptId) {
    const res = await request(`/attempts/${encodeURIComponent(attemptId)}`);
    if (res.status === 404) { await discard(res); return null; }
    if (!res.ok) { await discard(res); throw fault('attempt_readback_unavailable'); }
    const body = await jsonResponse(res);
    return body?.ok === true && body.attempt && typeof body.attempt === 'object' ? body.attempt : null;
  }

  // Journal one attempt record. A write is never repeated blindly: an unclear answer is read back first, then written at most once more.
  async function postAttempt(attempt) {
    validateAttempt(attempt);
    const body = JSON.stringify(attempt);
    const confirmed = (stored) => stored?.attempt_id === attempt.attempt_id && stored.status === attempt.status;
    const write = async () => {
      let res;
      try { res = await request('/attempts', { method:'POST', body }); }
      catch (e) { if (e.code === 'receiver_unauthorized') throw e; return { status:0 }; }
      if (!res.ok) { await discard(res); return { status:res.status }; }
      const reply = await jsonResponse(res).catch(() => null);
      return { status:res.status, ok:reply?.ok === true && confirmed(reply.attempt), replayed:reply?.replayed === true };
    };
    const first = await write();
    if (first.ok) return { replayed:first.replayed };
    if (first.status === 400) throw fault('attempt_rejected');
    const stored = await readAttempt(attempt.attempt_id);
    if (confirmed(stored)) return { replayed:true };
    if (first.status === 409 || (stored && stored.status !== 'started')) throw fault('attempt_conflict');
    const second = await write();
    if (second.ok) return { replayed:second.replayed };
    throw fault(second.status === 409 ? 'attempt_conflict' : 'attempt_unconfirmed');
  }

  async function directive(date = null) {
    const query = date ? `?date=${encodeURIComponent(date)}` : '';
    const res = await request(`/directive${query}`);
    if (!res.ok) { await discard(res); throw fault('directive_unavailable'); }
    const body = await jsonResponse(res);
    if (body?.ok !== true || !['rule', 'krish'].includes(body.chosen_by)) throw fault('directive_invalid');
    try { validateDirective(body.directive); } catch { throw fault('directive_invalid'); }
    return { chosen_by:body.chosen_by, directive:body.directive };
  }

  async function decisions(since) {
    const res = await request(`/decisions?since=${encodeURIComponent(since)}`);
    if (!res.ok) { await discard(res); throw fault('decisions_unavailable'); }
    const body = await jsonResponse(res);
    if (body?.ok !== true || !Array.isArray(body.decisions)) throw fault('decisions_invalid');
    try { return body.decisions.map(validateDecision).map(({ proposal_id, decision, decided_at, payload_sha256 }) => ({ proposal_id, decision, decided_at, payload_sha256:payload_sha256 ?? null })); }
    catch { throw fault('decisions_invalid'); }
  }

  async function readReport(runId) {
    const res = await request(`/reports/${encodeURIComponent(runId)}`);
    if (res.status === 404) { await discard(res); return null; }
    if (!res.ok) { await discard(res); throw fault('receiver_readback_unavailable'); }
    const body = await jsonResponse(res);
    if (body?.accepted !== true || body.run_id !== runId || typeof body.payload_sha256 !== 'string') throw fault('receiver_readback_invalid');
    // Only these three fields leave this function: no receiver metadata reaches logs or disk.
    return { accepted:true, run_id:body.run_id, payload_sha256:body.payload_sha256 };
  }

  async function postReport(runId, payload) {
    return request('/reports', { method:'POST', body:payload, headers:{ 'idempotency-key':runId } });
  }

  return { local, capabilities, postAttempt, readAttempt, directive, decisions, readReport, postReport };
}

const POST_REFUSALS = { 400:'receiver_report_refused', 403:'receiver_identity_refused', 413:'receiver_report_too_large', 429:'receiver_rate_limited' };

// Deliver one sealed envelope from the outbox: reconcile first, write once per reservation, then read the stored digest back.
export async function deliver(outbox, runId, options = {}) {
  const client = options.client ?? controlCenter(options);
  const row = outbox.get(runId);
  if (!row) throw fault('outbox_report_missing');
  const report = validateEngineReport(JSON.parse(row.payload));
  if (report.mode !== 'live' && !client.local) throw fault('synthetic_delivery_prohibited');
  await client.capabilities();
  const ours = (receipt) => receipt?.payload_sha256 === report.payload_sha256;
  // Reconcile before any POST, especially after an ambiguous response or a restart.
  const existing = await client.readReport(runId);
  if (existing && !ours(existing)) throw fault('receiver_readback_mismatch');
  if (existing) { outbox.delivered(runId, existing); return { ...existing, replayed:true }; }
  if (row.status === 'delivered') throw fault('receiver_lost_delivered_report');
  const generation = outbox.reserve(runId);
  try {
    const res = await client.postReport(runId, row.payload);
    let replayed = false;
    if (res.status === 409) {
      // Same run_id, different payload, or an inactive engine. Never write again: read back and stop.
      const reply = await jsonResponse(res).catch(() => null);
      const stored = await client.readReport(runId);
      if (!ours(stored)) throw fault(stored ? 'receiver_report_conflict' : JSON.stringify(reply ?? '').includes('engine_inactive') ? 'receiver_engine_inactive' : 'receiver_report_conflict');
      replayed = true;
    } else if (!res.ok) {
      await discard(res);
      throw fault(POST_REFUSALS[res.status] ?? 'receiver_rejected_report');
    } else {
      const ack = await jsonResponse(res);
      if (ack?.accepted !== true || ack.run_id !== runId || !ours(ack)) throw fault('receiver_ack_mismatch');
      replayed = ack.replayed === true;
    }
    const receipt = await client.readReport(runId);
    if (!receipt) throw fault('receiver_did_not_persist');
    if (!ours(receipt)) throw fault('receiver_readback_mismatch');
    if (!outbox.delivered(runId, receipt, generation)) throw fault('receiver_reservation_superseded');
    return { ...receipt, replayed };
  } catch (e) {
    // No response body, URL, credential or private payload is logged; the journal keeps a code only.
    const code = /^receiver_[a-z_]+$/.test(e.code ?? '') ? e.code : 'receiver_transport_uncertain';
    outbox.error(runId, code, generation);
    throw new ControlCenterError('delivery_unverified_reconcile_before_retry', code);
  }
}
