// Guards on the app export client (src/lib/export-client.mjs) and how operate uses it.
// Offline: every export server here is a loopback server in this process. Synthetic only: no real person, address,
// account or credential. The two bearers are synthetic canaries and are never printed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateSnapshot } from '../src/guards/wire.mjs';
import { heldEngineReport, protocolRunId } from '../src/orchestrator.mjs';
import { Outbox } from '../src/outbox.mjs';
import { controlCenter } from '../src/transport.mjs';
import { operate } from '../src/operate.mjs';
import { EXPORT_ORIGIN, ExportError, captureExport, composeSnapshot, exportClient, exportFromEnv, exportWindow } from '../src/lib/export-client.mjs';
import { standIn, TOKEN, DIRECTIVE } from './standin.mjs';

const json = path => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const policy = () => json('../config/policy.json');
const EXPORT_TOKEN = 'synthetic-export-bearer-canary';
const AT = '2026-10-19T05:10:00Z';
const CAPTURED = '2026-10-19T05:10:01.000Z';

// Windows will not delete a file that is still open, and once one after() hook throws node:test skips the rest
// (docs/FAILURES.md F27). So the journal closes before its folder is removed, and removal never throws.
function removeQuietly(dir) { try { rmSync(dir, { recursive:true, force:true, maxRetries:5, retryDelay:100 }); } catch {} }
function outbox(t) {
  const dir = mkdtempSync(join(tmpdir(), 'growth-legibility-export-'));
  const db = new Outbox(join(dir, 'outbox.sqlite'));
  t.after(() => { try { db.close(); } catch {} removeQuietly(dir); });
  return db;
}

// A synthetic export in the brief's A4 shape, from the fixture's rows, filtered to the window asked for. Two reads land in
// ISO week 2026-W43: a trusted one from an external builder, and one from the internal account, which never counts.
function syntheticExport({ start, end }, extra = {}) {
  const f = json('../fixtures/snapshot.json');
  const inside = r => Date.parse(r.occurred_at) >= Date.parse(start) && Date.parse(r.occurred_at) < Date.parse(end);
  const reads = [...f.reads,
    { id:'read-w43-a', account_id:'builder-a', occurred_at:'2026-10-19T02:00:00Z', interface:'api', product_present:true, confidence:0.91, calibration_version:'synthetic-v1', cost_usd:0.001, method:'jsonld', failure_reason:null, session_id:'session-a4' },
    { id:'read-w43-internal', account_id:'qa-bot', occurred_at:'2026-10-19T03:00:00Z', interface:'mcp', product_present:true, confidence:1, calibration_version:'synthetic-v1', cost_usd:0.001, method:'jsonld', failure_reason:null, session_id:'session-q2' },
    { id:'read-w43-testbench', account_id:'builder-b', occurred_at:'2026-10-19T04:00:00Z', interface:'testbench', product_present:true, confidence:0.95, calibration_version:'synthetic-v1', cost_usd:0, method:'jsonld', failure_reason:null, session_id:'session-b2' },
  ].filter(inside);
  return {
    export_version:'1.0.0', mode:'synthetic', captured_at:CAPTURED, app_revision:'synthetic-app-revision',
    window:{ start, end, complete:true }, coverage:{ accounts:true, reads:true, events:true, settlements:false },
    reconciliation:{ reads_metered:reads.length, reads_exported:reads.length },
    accounts:f.accounts, reads, events:f.events.filter(inside), settlements:[], ...extra,
  };
}

// A scripted loopback export route. respond() returns { status, body, type, headers, chunks }, or nothing to hang.
async function exportServer(t, respond) {
  const log = [];
  const server = createServer(async (req, res) => {
    for await (const _ of req) { /* drain */ }
    const url = new URL(req.url, 'http://127.0.0.1');
    log.push({ method:req.method, path:url.pathname, query:Object.fromEntries(url.searchParams), authorization:req.headers.authorization });
    const out = await respond(url, log);
    if (!out) return;
    res.statusCode = out.status ?? 200;
    res.setHeader('content-type', out.type ?? 'application/json');
    for (const [k, v] of Object.entries(out.headers ?? {})) res.setHeader(k, v);
    if (out.chunks) { for (const c of out.chunks) res.write(c); return res.end(); }
    if (out.stall) { res.write('{"accounts":['); return; }
    res.end(typeof out.body === 'string' ? out.body : JSON.stringify(out.body ?? {}));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  return { url:`http://127.0.0.1:${server.address().port}/api/internal/growth/export`, log };
}
const serveExport = (t, extra) => exportServer(t, url => ({ body:syntheticExport({ start:url.searchParams.get('start'), end:url.searchParams.get('end') }, extra) }));
const client = (url, options = {}) => exportClient({ url, token:EXPORT_TOKEN, testMode:true, ...options });
const codeOf = async promise => { try { await promise; return 'no_error'; } catch (e) { assert.ok(e instanceof ExportError, String(e)); assert.ok(!String(e.message).includes(EXPORT_TOKEN)); return e.code; } };
const WINDOW = { start:'2026-10-12T05:10:00.000Z', end:'2026-10-19T05:10:00.000Z' };

async function runOperate(t, env, appExport, extra = {}) {
  const db = outbox(t);
  const result = await operate({ client:controlCenter(env), outbox:db, policy:policy(), corpusSha:'a'.repeat(64), at:AT,
    invocation:'local0export', synthetic:true, revision:'f'.repeat(40), clock:() => '2026-10-19T05:11:00Z', appExport, ...extra });
  return { ...result, outbox:db };
}

test('the export origin is pinned: another host, plain http, a query or a credential in the URL is refused before any request', async () => {
  let calls = 0;
  const fetcher = async () => { calls++; return new Response('{}', { status:200, headers:{ 'content-type':'application/json' } }); };
  for (const url of ['https://legibility.example.org/api/internal/growth/export', 'https://evil.example/api/internal/growth/export',
    'http://legibility.io/api/internal/growth/export', 'https://legibility.io.example.com/api/internal/growth/export']) {
    assert.throws(() => exportClient({ url, token:EXPORT_TOKEN, fetcher }), e => e.code === 'export_origin_not_approved', url);
  }
  for (const url of [`https://user:pw${'@'}legibility.io/api/internal/growth/export`, 'https://legibility.io/api/internal/growth/export?start=x', 'https://legibility.io/', 'not a url']) {
    assert.throws(() => exportClient({ url, token:EXPORT_TOKEN, fetcher }), e => e.code === 'export_url_invalid', url);
  }
  // A loopback stand-in is taken only when a test asks for it.
  assert.throws(() => exportClient({ url:'http://127.0.0.1:9/api/internal/growth/export', token:EXPORT_TOKEN, fetcher }), e => e.code === 'export_origin_not_approved');
  assert.throws(() => exportClient({ url:`${EXPORT_ORIGIN}/api/internal/growth/export`, token:'two words', fetcher }), e => e.code === 'export_credential_missing');
  const pinned = exportClient({ url:`${EXPORT_ORIGIN}/api/internal/growth/export`, token:EXPORT_TOKEN, fetcher });
  assert.equal(pinned.local, false);
  // From the environment the same refusal becomes a named state, and the value is never echoed.
  const refused = exportFromEnv({ LEGIBILITY_EXPORT_URL:'https://evil.example/export', LEGIBILITY_EXPORT_TOKEN:EXPORT_TOKEN });
  assert.deepEqual(refused, { state:'refused', code:'export_origin_not_approved' });
  assert.equal(calls, 0);
  // The request that does go out goes to the pinned origin, with no redirect followed and a time limit.
  let seen = null;
  const spy = exportClient({ url:`${EXPORT_ORIGIN}/api/internal/growth/export`, token:EXPORT_TOKEN, fetcher:async (href, init) => { seen = { href, init }; return new Response(JSON.stringify({}), { status:200, headers:{ 'content-type':'application/json' } }); } });
  await spy.fetchExport(WINDOW);
  assert.equal(new URL(seen.href).origin, EXPORT_ORIGIN);
  assert.equal(seen.init.redirect, 'error'); assert.equal(seen.init.method, 'GET'); assert.ok(seen.init.signal instanceof AbortSignal);
  assert.deepEqual(Object.fromEntries(new URL(seen.href).searchParams), WINDOW);
});

test('a redirect from the export route is refused and never followed', async t => {
  const server = await exportServer(t, url => url.pathname.endsWith('/elsewhere')
    ? { body:syntheticExport(WINDOW) } : { status:302, headers:{ location:'/elsewhere' }, body:'' });
  assert.equal(await codeOf(client(server.url).fetchExport(WINDOW)), 'export_redirect_refused');
  assert.deepEqual(server.log.map(x => x.path), ['/api/internal/growth/export']);
  // A fetcher that reports a redirect it followed, or answers 3xx, is refused the same way.
  const followed = exportClient({ url:`${EXPORT_ORIGIN}/x`, token:EXPORT_TOKEN, fetcher:async () => ({ redirected:true, status:200, ok:true, headers:new Headers({ 'content-type':'application/json' }), body:null }) });
  assert.equal(await codeOf(followed.fetchExport(WINDOW)), 'export_redirect_refused');
  const moved = exportClient({ url:`${EXPORT_ORIGIN}/x`, token:EXPORT_TOKEN, fetcher:async () => new Response(null, { status:307 }) });
  assert.equal(await codeOf(moved.fetchExport(WINDOW)), 'export_redirect_refused');
});

test('an export that does not answer in time is refused as export_timeout', async t => {
  const hanging = await exportServer(t, () => null);
  assert.equal(await codeOf(client(hanging.url, { timeoutMs:150 }).fetchExport(WINDOW)), 'export_timeout');
  // A body that starts and then stalls is cut off by the same limit.
  const stalled = await exportServer(t, () => ({ stall:true }));
  assert.equal(await codeOf(client(stalled.url, { timeoutMs:150 }).fetchExport(WINDOW)), 'export_timeout');
});

test('an export over the size cap is refused, whether its length is declared or streamed', async t => {
  const declared = await exportServer(t, () => ({ body:JSON.stringify({ pad:'x'.repeat(500) }) }));
  assert.equal(await codeOf(client(declared.url, { maxBytes:64 }).fetchExport(WINDOW)), 'export_response_too_large');
  const streamed = await exportServer(t, () => ({ chunks:['{"pad":"', 'x'.repeat(200), '"}'] }));
  assert.equal(await codeOf(client(streamed.url, { maxBytes:64 }).fetchExport(WINDOW)), 'export_response_too_large');
  assert.equal(await codeOf(client(streamed.url, { maxBytes:4096 }).fetchExport(WINDOW)), 'no_error');
});

test('an answer that is not JSON is refused as export_non_json', async t => {
  const html = await exportServer(t, () => ({ type:'text/html', body:'<html>sign in</html>' }));
  assert.equal(await codeOf(client(html.url).fetchExport(WINDOW)), 'export_non_json');
  const broken = await exportServer(t, () => ({ body:'{"accounts":[' }));
  assert.equal(await codeOf(client(broken.url).fetchExport(WINDOW)), 'export_non_json');
  const refusals = await exportServer(t, url => ({ status:Number(url.searchParams.get('start').slice(0, 4)) === 2025 ? 413 : 400, body:{ error:'window' } }));
  assert.equal(await codeOf(client(refusals.url).fetchExport({ start:'2025-10-12T00:00:00.000Z', end:WINDOW.end })), 'export_window_too_large');
  assert.equal(await codeOf(client(refusals.url).fetchExport(WINDOW)), 'export_window_refused');
  assert.equal(await codeOf(client(refusals.url).fetchExport({ start:WINDOW.end, end:WINDOW.start })), 'export_window_invalid');
});

test('the export bearer never appears in any output, error, journal or report', async t => {
  const refusing = await exportServer(t, () => ({ status:401, body:{ error:'unauthorized', echo:EXPORT_TOKEN } }));
  const env = await standIn(t);
  const { summary, outbox:db } = await runOperate(t, env, { state:'ready', client:client(refusing.url) });
  assert.equal(summary.status, 'succeeded');
  assert.deepEqual(summary.export, { state:'held', reason:'export_unauthorized' });
  assert.equal(refusing.log[0].authorization, `Bearer ${EXPORT_TOKEN}`);
  const stored = env.reports.get(summary.run_id);
  assert.ok(stored.holds.some(h => h.reason === 'export_unauthorized'));
  const everything = [JSON.stringify(summary), JSON.stringify(stored), JSON.stringify(db.get(summary.run_id)), ...env.log.map(x => `${x.body}${JSON.stringify(x.headers)}`)].join('\n');
  assert.ok(!everything.includes(EXPORT_TOKEN));
  // The Control Center bearer never travels to the app either.
  assert.ok(refusing.log.every(x => !String(x.authorization).includes(TOKEN)));
});

test('a valid synthetic export is measured end to end, and weekly_builders travels in activity beside the three objectives', async t => {
  const server = await serveExport(t);
  const env = await standIn(t);
  const { summary, privateReport } = await runOperate(t, env, { state:'ready', client:client(server.url) });
  assert.equal(summary.status, 'succeeded'); assert.equal(summary.journal, 'closed');
  assert.deepEqual(summary.export, { state:'read', reason:null });
  // The engine asked for the trailing seven days and the ISO week to date, ending at the run clock.
  assert.deepEqual(server.log[0].query, exportWindow(AT, policy()));
  assert.deepEqual(server.log[0].query, WINDOW);
  const stored = env.reports.get(summary.run_id);
  assert.equal(stored.mode, 'synthetic');
  assert.deepEqual(stored.objectives.map(o => o.key), ['activated', 'returning', 'net']);
  // The campaign clock is not activated, so the three objectives stay unknown with their reason, never zero.
  for (const o of stored.objectives) { assert.equal(o.value, null); assert.equal(o.availability, 'missing'); assert.ok(o.reason); }
  const line = stored.activity.find(a => a.line.startsWith('weekly_builders:'));
  assert.ok(line, 'weekly_builders is reported in activity');
  // One external builder with a trusted read in 2026-W43; the internal account and the testbench read never count.
  assert.match(line.line, /^weekly_builders: 1 builder with at least one trusted read in ISO week 2026-W43 to 2026-10-19T05:10:00\.000Z/);
  assert.equal(privateReport.scorecard.metrics.weekly_builders.value, 1);
  assert.equal(privateReport.observed_at, CAPTURED);
  assert.equal(privateReport.source.app_revision, 'synthetic-app-revision');
  // Sections the app does not own read as unknown, never as zero.
  assert.equal(privateReport.scorecard.metrics.paid_media_usd.value, null);
  assert.equal(privateReport.scorecard.metrics.mainnet_agent_revenue_usd.value, null);
  // Every guard of the existing pipeline applied: prospecting with no approved ICP stays held.
  assert.ok(stored.proposals.every(p => p.wall !== 'send'));
});

test('an export the contract refuses is held with its label and never measured, and unreconciled reads read as unknown', async () => {
  const body = syntheticExport(WINDOW);
  const local = { local:true, fetchExport:async () => structuredClone(body) };
  const ok = await captureExport(local, { at:AT, policy:policy(), clock:() => '2026-10-19T05:11:00Z' });
  assert.doesNotThrow(() => validateSnapshot(structuredClone(ok.snapshot), ok.at));
  const refused = async (change, code, detail) => {
    const e = structuredClone(body); change(e);
    try { await captureExport({ local:true, fetchExport:async () => e }, { at:AT, policy:policy(), clock:() => '2026-10-19T05:11:00Z' }); assert.fail('accepted'); }
    catch (err) { assert.equal(err.code, code); if (detail) assert.equal(err.detail, detail); }
  };
  await refused(e => { e.accounts[0].email = 'synthetic'; }, 'export_contract_refused', 'invalid_contract:unknown_fields_account');
  await refused(e => { e.reads[0].occurred_at = '2026-10-17T11:00:00.123456Z'; }, 'export_contract_refused', 'invalid_contract:read_identity_date');
  await refused(e => { e.debug = true; }, 'export_shape_refused');
  await refused(e => { delete e.reconciliation; }, 'export_shape_refused');
  await refused(e => { e.export_version = '2.0.0'; }, 'export_version_unsupported');
  await refused(e => { e.captured_at = '2026-10-19T06:00:00.000Z'; }, 'export_clock_ahead');
  // Metering that does not reconcile turns read coverage off, whatever the app's flag says: reads become unknown.
  const off = composeSnapshot({ ...body, reconciliation:{ reads_metered:body.reads.length + 1, reads_exported:body.reads.length } }, { testMode:true });
  assert.equal(off.coverage.reads, false);
  assert.equal(composeSnapshot(body, { testMode:true }).coverage.reads, true);
  for (const k of ['billing', 'partners', 'spend', 'feedback', 'candidates', 'opportunities']) assert.equal(off.coverage[k], false, k);
  assert.equal(off.icp.status, 'missing');
});

test('with no export configured the run holds exactly as before and names attribution_export_missing', async t => {
  const env = await standIn(t);
  const { summary } = await runOperate(t, env, exportFromEnv({}));
  assert.equal(summary.status, 'succeeded');
  assert.deepEqual(summary.export, { state:'absent', reason:'attribution_export_missing' });
  assert.deepEqual(summary.report.holds, ['source_snapshot_missing', 'icp_not_current_approved']);
  // Byte for byte the report the engine sent before the export client existed.
  const before = heldEngineReport({ runId:protocolRunId('operate', AT, 'local0export'), at:new Date(AT).toISOString(), revision:'f'.repeat(40), mode:'synthetic', policy:policy(), directive:DIRECTIVE });
  const stored = env.reports.get(summary.run_id);
  assert.deepEqual(stored, before);
  assert.equal(stored.activity.some(a => a.line.startsWith('weekly_builders')), false);
  // One of the two set is named, and the value of the one that is set never appears.
  const half = await runOperate(t, await standIn(t), exportFromEnv({ LEGIBILITY_EXPORT_TOKEN:EXPORT_TOKEN }), { invocation:'local1export' });
  assert.deepEqual(half.summary.export, { state:'held', reason:'attribution_export_incomplete' });
  assert.ok(!JSON.stringify(half.summary).includes(EXPORT_TOKEN));
});

test('a synthetic export never reaches the live origin', async t => {
  const server = await serveExport(t);
  let posts = 0;
  const live = controlCenter({ token:TOKEN, fetcher:async (href, init) => {
    if (/\/reports$/.test(new URL(href).pathname) && init.method === 'POST') posts++;
    const attempt = JSON.parse(init.body ?? '{}');
    return new Response(JSON.stringify({ ok:true, attempt:{ attempt_id:attempt.attempt_id, status:attempt.status } }), { status:200 });
  } });
  assert.equal(live.local, false);
  const db = outbox(t);
  const { summary } = await operate({ client:live, outbox:db, policy:policy(), corpusSha:'a'.repeat(64), at:AT, invocation:'local0export',
    appExport:{ state:'ready', client:client(server.url) } });
  assert.equal(summary.status, 'failed'); assert.equal(summary.error_code, 'synthetic_export_refused');
  assert.equal(server.log.length, 0, 'the loopback export is never even read');
  assert.equal(posts, 0);
  assert.equal(db.get(summary.run_id), undefined);
  // And an export that is not marked live is refused from the app's own origin too.
  assert.throws(() => composeSnapshot(syntheticExport(WINDOW)), e => e.code === 'export_not_live');
});
