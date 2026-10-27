import { validateSnapshot, utcInstant } from '../guards/wire.mjs';
import { isoWeek } from '../stages/measure.mjs';

// The one reader of the Legibility app's row-level export (docs/handoff/APP-PHASE-1.md, A4). It reads; it never
// writes, sends or posts. HTTPS to the pinned origin only, no redirects, a 20 second limit, a size cap, JSON only.
// The bearer comes from the runtime environment, and is never logged, echoed, stored or written into an error.
// What the export does not say stays unknown: this client composes the snapshot the pipeline already takes and runs
// it through the existing wire validator, so every guard in capture and measure still applies. Every failure leaves
// as a lower_snake code.
export const EXPORT_ORIGIN = 'https://legibility.io';
export const EXPORT_ENV = Object.freeze({ url:'LEGIBILITY_EXPORT_URL', token:'LEGIBILITY_EXPORT_TOKEN' });
export const EXPORT_VERSION = '1.0.0';
const TIMEOUT_MS = 20000;
const MAX_BYTES = 20 * 1024 * 1024;
const MAX_WINDOW_DAYS = 92;
// The app's clock may run a little ahead of the runner's; more than this and the capture time is not trusted.
const CLOCK_SKEW_MS = 5 * 60 * 1000;
const DAY = 86_400_000;

export class ExportError extends Error {
  constructor(code, detail = null) { super(code); this.code = code; this.detail = detail; }
}
const fault = (code, detail) => new ExportError(code, detail);

// The export URL is pinned to the app's origin; only its path is configurable, because the app names the final route.
export function exportUrl(value, { testMode = false } = {}) {
  let url;
  try { url = new URL(value); } catch { throw fault('export_url_invalid'); }
  if (url.username || url.password || url.search || url.hash || url.pathname === '/' || url.pathname === '') throw fault('export_url_invalid');
  // A loopback stand-in is reachable only from tests that ask for it; nothing else but the pinned HTTPS origin.
  const local = testMode && url.protocol === 'http:' && ['127.0.0.1', 'localhost'].includes(url.hostname);
  if (url.origin !== EXPORT_ORIGIN && !local) throw fault('export_origin_not_approved');
  return { url, local };
}

export function exportClient({ url, token, fetcher = fetch, testMode = false, timeoutMs = TIMEOUT_MS, maxBytes = MAX_BYTES } = {}) {
  const pinned = exportUrl(url, { testMode });
  if (typeof token !== 'string' || !token || /\s/.test(token)) throw fault('export_credential_missing');

  async function read(response) {
    const type = response.headers.get('content-type') ?? '';
    if (!/^application\/json\s*(?:;|$)/i.test(type)) { await discard(response); throw fault('export_non_json'); }
    const declared = Number(response.headers.get('content-length'));
    if (Number.isFinite(declared) && declared > maxBytes) { await discard(response); throw fault('export_response_too_large'); }
    const chunks = []; let size = 0;
    const reader = response.body?.getReader();
    if (reader) {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > maxBytes) { try { await reader.cancel(); } catch { /* nothing to release */ } throw fault('export_response_too_large'); }
        chunks.push(value);
      }
    }
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw fault('export_non_json'); }
  }

  // GET the export for [start, end). Only codes leave this function, never a body, a URL or the bearer.
  async function fetchExport({ start, end }) {
    if (!utcInstant(start) || !utcInstant(end) || Date.parse(start) >= Date.parse(end)) throw fault('export_window_invalid');
    const target = new URL(pinned.url);
    target.search = new URLSearchParams({ start, end }).toString();
    try {
      const response = await fetcher(target.href, {
        method:'GET', redirect:'error', signal:AbortSignal.timeout(timeoutMs),
        headers:{ authorization:`Bearer ${token}`, accept:'application/json' },
      });
      if (response.redirected || (response.status >= 300 && response.status < 400)) { await discard(response); throw fault('export_redirect_refused'); }
      if (response.status === 401 || response.status === 403) { await discard(response); throw fault('export_unauthorized'); }
      if (response.status === 413) { await discard(response); throw fault('export_window_too_large'); }
      if (response.status === 400) { await discard(response); throw fault('export_window_refused'); }
      if (!response.ok) { await discard(response); throw fault('export_unavailable'); }
      return await read(response);
    } catch (e) {
      if (e instanceof ExportError) throw e;
      if (e?.name === 'TimeoutError' || e?.cause?.name === 'TimeoutError') throw fault('export_timeout');
      if (/redirect/i.test(String(e?.cause?.message ?? ''))) throw fault('export_redirect_refused');
      throw fault('export_transport_failed');
    }
  }

  return { local:pinned.local, fetchExport };
}
async function discard(response) { try { await response.body?.cancel(); } catch { /* nothing to release */ } }

// The window the engine asks for: the campaign to date (when the clock is activated) plus the trailing seven days and
// the ISO week to date, ending at the run clock, never longer than the app serves.
export function exportWindow(at, policy) {
  const end = Date.parse(at);
  if (!Number.isFinite(end)) throw fault('export_window_invalid');
  const starts = [end - 7 * DAY, isoWeek(end).start];
  const activated = Date.parse(policy?.campaign?.activated_at ?? '');
  if (Number.isFinite(activated) && activated < end) starts.push(activated);
  const start = Math.max(Math.min(...starts), end - MAX_WINDOW_DAYS * DAY);
  return { start:new Date(start).toISOString(), end:new Date(end).toISOString() };
}

const EXPORT_KEYS = ['export_version', 'mode', 'captured_at', 'app_revision', 'window', 'coverage', 'reconciliation', 'accounts', 'reads', 'events', 'settlements'];
const closed = (v, permitted) => v !== null && typeof v === 'object' && !Array.isArray(v)
  && Object.keys(v).every(k => permitted.includes(k)) && permitted.every(k => Object.hasOwn(v, k));
const count = v => Number.isInteger(v) && v >= 0;

// Compose the full snapshot from the app-owned sections, exactly as the brief's acceptance test does. Sections the app
// does not own are empty with their coverage false, so they read as unknown, never as zero. Every row passes through
// unchanged: the wire validator refuses an extra or a missing key.
export function composeSnapshot(e, { testMode = false } = {}) {
  if (!closed(e, EXPORT_KEYS)) throw fault('export_shape_refused', 'unknown_or_missing_fields_export');
  if (e.export_version !== EXPORT_VERSION) throw fault('export_version_unsupported');
  // F4: only a live export may come from the app's origin. A synthetic one belongs to a loopback stand-in in a test.
  if (e.mode !== 'live' && !(testMode && e.mode === 'synthetic')) throw fault('export_not_live');
  if (!closed(e.coverage, ['accounts', 'reads', 'events', 'settlements'])) throw fault('export_shape_refused', 'unknown_or_missing_fields_coverage');
  if (!closed(e.reconciliation, ['reads_metered', 'reads_exported']) || !count(e.reconciliation.reads_metered) || !count(e.reconciliation.reads_exported)) {
    throw fault('export_shape_refused', 'reconciliation');
  }
  // Metering is best effort: when the counts disagree the reads are not complete, whatever the app's flag says.
  const reconciled = e.reconciliation.reads_metered === e.reconciliation.reads_exported;
  return {
    schema_version:'1.0.0', snapshot_id:`app-export-${e.captured_at}`, mode:e.mode,
    captured_at:e.captured_at, app_revision:e.app_revision, window:e.window,
    coverage:{ ...e.coverage, reads:e.coverage.reads === true && reconciled, billing:false, partners:false, spend:false, feedback:false, candidates:false, opportunities:false },
    icp:{ status:'missing' }, accounts:e.accounts, reads:e.reads, events:e.events, settlements:e.settlements,
    billing:[], partners:[], spend:{ paid_media_usd:0 }, feedback:[],
    benchmark:{ selection_method:'none', consented:false }, suppressions:[], candidates:[], opportunities:[],
  };
}

// Fetch, compose and validate. Returns the snapshot and the clock to measure it at: the later of the run clock and the
// app's capture time, so a capture a moment after the run started is not refused as future.
export async function captureExport(client, { at, policy, clock = () => new Date().toISOString() }) {
  const window = exportWindow(at, policy);
  const body = await client.fetchExport(window);
  const snapshot = composeSnapshot(body, { testMode:client.local });
  const captured = Date.parse(snapshot.captured_at);
  const now = Date.parse(clock());
  if (!utcInstant(snapshot.captured_at) || !Number.isFinite(now)) throw fault('export_contract_refused', 'invalid_contract:mode_capture');
  if (captured > now + CLOCK_SKEW_MS) throw fault('export_clock_ahead');
  const measuredAt = new Date(Math.max(Date.parse(at), captured)).toISOString();
  try { validateSnapshot(structuredClone(snapshot), measuredAt); }
  catch (e) {
    const label = /^invalid_contract:[a-z0-9_]+$/.test(e?.message ?? '') ? e.message : 'invalid_contract';
    throw fault('export_contract_refused', label);
  }
  return { snapshot, at:measuredAt };
}

// What the runtime environment says about the export: absent (neither variable, the run holds exactly as before this
// client existed), incomplete (one of the two), refused (set but unusable) or ready. Values never leave this function.
export function exportFromEnv(env = process.env, options = {}) {
  const url = env[EXPORT_ENV.url] || '', token = env[EXPORT_ENV.token] || '';
  if (!url && !token) return { state:'absent' };
  if (!url || !token) return { state:'incomplete', missing:!url ? EXPORT_ENV.url : EXPORT_ENV.token };
  try { return { state:'ready', client:exportClient({ ...options, url, token }) }; }
  catch (e) { return { state:'refused', code:e instanceof ExportError ? e.code : 'export_client_invalid' }; }
}

const HOLD_DETAIL = {
  export_unauthorized:'The app refused the export bearer. Krish checks that the Actions secret matches the token the app holds.',
  export_timeout:'The app did not answer the export within 20 seconds.',
  export_redirect_refused:'The export route answered with a redirect, which this engine never follows.',
  export_response_too_large:'The export was larger than the 20 MB this engine reads.',
  export_non_json:'The export route did not answer with JSON.',
  export_window_too_large:'The app said the export window was too large.',
  export_window_refused:'The app refused the export window this engine asked for.',
  export_origin_not_approved:'The export URL is not on the pinned app origin, so it was never called.',
  export_url_invalid:'The export URL is not a plain HTTPS route on the app origin, so it was never called.',
  export_credential_missing:'The export bearer is empty or malformed, so the export was never called.',
  export_not_live:'The app sent an export that is not marked live, so none of it was measured.',
  export_version_unsupported:'The app sent an export version this engine does not read yet.',
  export_clock_ahead:'The export was stamped more than five minutes ahead of this runner, so its capture time was not trusted.',
};

// A protocol hold naming why a configured export did not arrive. Codes and fixed words only.
export function exportHold(state) {
  if (state.state === 'incomplete') return { reason:'attribution_export_incomplete', detail:`${state.missing} is not set, so the app export was not read. Both ${EXPORT_ENV.url} and ${EXPORT_ENV.token} are needed.` };
  const code = state.code ?? 'export_transport_failed';
  const detail = HOLD_DETAIL[code] ?? (state.detail ? `The app export was refused (${state.detail}); nothing from it was measured.` : 'The app export could not be read; nothing from it was measured.');
  return { reason:code, detail };
}
