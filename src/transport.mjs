import { validateReport } from './guards/wire.mjs';

const PREFIX = '/api/growth/engines/legibility';
async function jsonResponse(response) {
  const text = await response.text();
  if (text.length > 20*1024*1024) throw new Error('receiver_response_too_large');
  try { return JSON.parse(text); } catch { throw new Error('receiver_non_json'); }
}
export async function deliver(outbox, runId, {token, base='https://controlcenter.krishraja.com', fetcher=fetch, testMode=false}={}) {
  const origin = new URL(base);
  const localTest = testMode && ['127.0.0.1','localhost'].includes(origin.hostname) && origin.protocol==='http:';
  if (origin.origin !== base || origin.username || origin.password) throw new Error('receiver_origin_invalid');
  if (base !== 'https://controlcenter.krishraja.com' && !localTest) throw new Error('receiver_origin_not_approved');
  const row = outbox.get(runId);
  if (!row) throw new Error('outbox_report_missing');
  const report = validateReport(JSON.parse(row.payload));
  if (report.mode !== 'live' && !localTest) throw new Error('synthetic_delivery_prohibited');
  if (!token || /[\r\n]/.test(token)) throw new Error('receiver_credential_missing');
  const headers = {authorization:`Bearer ${token}`,'content-type':'application/json'};
  const request = async (path, options={}) => fetcher(`${base}${PREFIX}${path}`,{headers,signal:AbortSignal.timeout(15000),redirect:'error',...options});
  const capRes = await request('/capabilities');
  if (!capRes.ok) throw new Error('receiver_not_ready');
  const cap = await jsonResponse(capRes);
  if (cap.schema_version!=='1.0.0'||cap.engine_id!=='growth-legibility'||cap.product_slug!=='legibility'||cap.idempotency!==true) throw new Error('receiver_contract_mismatch');
  const matches = r => r?.accepted === true && r.run_id === runId && r.payload_sha256 === report.payload_sha256;
  async function readback() {
    const res = await request(`/reports/${encodeURIComponent(runId)}`);
    if (res.status===404) return null;
    if (!res.ok) throw new Error('receiver_readback_unavailable');
    const receipt = await jsonResponse(res);
    if (!matches(receipt)) throw new Error('receiver_readback_mismatch');
    return {accepted:true,run_id:receipt.run_id,payload_sha256:receipt.payload_sha256};
  }
  // Reconcile before any POST, especially after an ambiguous response or a restart.
  const existing = await readback();
  if (existing) { outbox.delivered(runId,existing); return existing; }
  if (row.status==='delivered') throw new Error('receiver_lost_delivered_report');
  const generation=outbox.reserve(runId);
  try {
    const res = await request('/reports',{method:'POST',headers:{...headers,'idempotency-key':runId},body:row.payload});
    if (!res.ok) throw new Error('receiver_rejected_report');
    if (!matches(await jsonResponse(res))) throw new Error('receiver_ack_mismatch');
    const receipt = await readback();
    if (!receipt) throw new Error('receiver_did_not_persist');
    if(!outbox.delivered(runId,receipt,generation)) throw new Error('receiver_reservation_superseded');
    return receipt;
  } catch (e) {
    // No response body, URL, credential or private payload is logged.
    outbox.error(runId,/^receiver_[a-z_]+$/.test(e.message)?e.message:'receiver_transport_uncertain',generation);
    throw new Error('delivery_unverified_reconcile_before_retry');
  }
}
