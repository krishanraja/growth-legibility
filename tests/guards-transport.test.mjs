// Guards on the one Control Center client (src/transport.mjs) and the delivery journal (src/outbox.mjs).
// Offline: every receiver here is a loopback server in this process, and each journal lives under the OS temp directory.
// Synthetic only: no real person, address or credential. The bearer is the stand-in's synthetic canary and is never printed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Outbox } from '../src/outbox.mjs';
import { controlCenter, deliver } from '../src/transport.mjs';
import { buildReport, engineReport, protocolRunId } from '../src/orchestrator.mjs';
import { standIn, PREFIX, TOKEN } from './standin.mjs';

const json = path => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const CAP = 20 * 1024 * 1024;
const CAPABILITIES = { schema_version:'1.2.0', schema_versions:['1.0.0', '1.1.0', '1.2.0'], engine_id:'growth-legibility', product_slug:'legibility', idempotency:true, activation:{ state:'active', activated_on:'2026-10-18' }, features:{ directive:true } };
const AT = '2026-10-19T05:10:00Z';
const ATTEMPT_ID = 'legibility:2026-10-19:operate:guardtest';
const started = () => ({ attempt_id:ATTEMPT_ID, command:'operate', run_id:null, status:'started', phase:'start', error_code:null, started_at:AT });
const finished = status => ({ ...started(), status, phase:'report', error_code:status === 'failed' ? 'receiver_unauthorized' : null, finished_at:AT });

// Windows will not delete a file that is still open, and once one after() hook throws node:test skips the rest, so a
// loopback server is left listening and the test process never exits. So the journal closes before its folder is
// removed, and removal retries and never throws: a temp folder left behind is harmless, a hung suite is not.
function removeQuietly(dir) {
  try { rmSync(dir, { recursive:true, force:true, maxRetries:5, retryDelay:100 }); } catch {}
}
function outbox(t) {
  const dir = mkdtempSync(join(tmpdir(), 'growth-legibility-guards-'));
  const db = new Outbox(join(dir, 'outbox.sqlite'));
  t.after(() => { try { db.close(); } catch {} removeQuietly(dir); });
  return db;
}
function report() {
  const r = buildReport(json('../fixtures/snapshot.json'), json('../config/policy.json'), '2026-10-18T12:00:00Z', 'a'.repeat(64));
  return engineReport(r, { runId:protocolRunId('run', r.observed_at, r.run_id.slice(3, 19)) });
}

// A scripted loopback receiver. respond() returns { status, body, type, headers }, { drop:true } to cut the
// connection without an answer, or nothing to leave the request hanging until the test ends.
async function scripted(t, respond) {
  const log = [];
  const server = createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    const route = req.url.startsWith(PREFIX) ? req.url.slice(PREFIX.length) : req.url;
    const entry = { method:req.method, route, body };
    log.push(entry);
    const out = await respond(entry, log);
    if (!out) return;
    if (out.drop) { req.socket.destroy(); return; }
    res.statusCode = out.status;
    res.setHeader('content-type', out.type ?? 'application/json');
    for (const [k, v] of Object.entries(out.headers ?? {})) res.setHeader(k, v);
    res.end(typeof out.body === 'string' ? out.body : JSON.stringify(out.body ?? {}));
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => { server.closeAllConnections(); return new Promise(resolve => server.close(resolve)); });
  return { base:`http://127.0.0.1:${server.address().port}`, token:TOKEN, testMode:true, log };
}
const steps = log => log.map(x => `${x.method} ${x.route.replace(/^\/(attempts|reports)\/.+$/, '/$1/:id')}`);
const client = env => controlCenter({ token:env.token, base:env.base, testMode:true });
const codeOf = promise => promise.then(() => 'resolved', e => e.code);

// Settles to what the promise gave, or to 'hung' after ms, and clears its own timer.
function within(promise, ms) {
  let timer;
  const late = new Promise(resolve => { timer = setTimeout(resolve, ms, 'hung'); });
  return Promise.race([promise, late]).finally(() => clearTimeout(timer));
}

// ---- 1. The attempt journal (src/transport.mjs:62-84): read back at :78 before the one more write at :81.

// src/transport.mjs:70 and :78-79: a write whose answer is lost is read back, and a stored copy counts as written.
test('an attempt write whose answer is lost is read back, and a stored copy is taken as written with no second write', async t => {
  let stored = null;
  const env = await scripted(t, ({ method, body }) => {
    if (method === 'POST') { stored = JSON.parse(body); return { drop:true }; }
    return stored ? { status:200, body:{ ok:true, attempt:stored } } : { status:404, body:{ error:'not_found' } };
  });
  const result = await client(env).postAttempt(started());
  assert.deepEqual(result, { replayed:true });
  assert.deepEqual(steps(env.log), ['POST /attempts', 'GET /attempts/:id']);
});

// src/transport.mjs:71 and :78-82: an unconfirmed failure (503) is read back first, and only then written once more.
test('an attempt write the receiver did not take is read back before the one more write it is allowed', async t => {
  let posts = 0;
  const env = await scripted(t, ({ method, body }) => {
    if (method === 'POST') return ++posts === 1 ? { status:503, body:{ error:'busy' } } : { status:200, body:{ ok:true, attempt:JSON.parse(body) } };
    return { status:404, body:{ error:'not_found' } };
  });
  const result = await client(env).postAttempt(started());
  assert.deepEqual(result, { replayed:false });
  assert.deepEqual(steps(env.log), ['POST /attempts', 'GET /attempts/:id', 'POST /attempts']);
});

// src/transport.mjs:80, with the stand-in's 409 for a different terminal record (tests/standin.mjs:67):
// a 409 is read back, and when the stored record is not ours it stops as a conflict with no second write.
test('a 409 on the attempt route is read back and stops as attempt_conflict without writing again', async t => {
  const env = await standIn(t);
  const c = controlCenter({ token:env.token, base:env.base, testMode:true });
  await c.postAttempt(started());
  await c.postAttempt(finished('failed'));
  const before = env.log.length;
  assert.equal(await codeOf(c.postAttempt(finished('succeeded'))), 'attempt_conflict');
  const after = steps(env.log.slice(before));
  assert.deepEqual(after, ['POST /attempts', 'GET /attempts/:id']);
  assert.equal(env.attempts.get(ATTEMPT_ID).status, 'failed');
});

// src/transport.mjs:80 (first.status === 409): a 409 stops even when the readback finds nothing to compare.
test('a 409 on the attempt route stops as a conflict even when the readback finds no record', async t => {
  const env = await scripted(t, ({ method }) => method === 'POST' ? { status:409, body:{ error:'attempt_conflict' } } : { status:404, body:{ error:'not_found' } });
  assert.equal(await codeOf(client(env).postAttempt(finished('succeeded'))), 'attempt_conflict');
  assert.deepEqual(steps(env.log), ['POST /attempts', 'GET /attempts/:id']);
});

// src/transport.mjs:66, :73, :76 and :83: a 200 that does not echo this attempt is not confirmation; after one
// readback and one more write that is still unconfirmed, the attempt fails as attempt_unconfirmed.
test('a green answer that does not echo the attempt is unconfirmed, read back, written once more and then refused', async t => {
  const env = await scripted(t, ({ method, body }) => {
    if (method === 'POST') { const a = JSON.parse(body); return { status:200, body:{ ok:true, attempt:{ ...a, status:'unknown' } } }; }
    return { status:404, body:{ error:'not_found' } };
  });
  assert.equal(await codeOf(client(env).postAttempt(finished('succeeded'))), 'attempt_unconfirmed');
  assert.deepEqual(steps(env.log), ['POST /attempts', 'GET /attempts/:id', 'POST /attempts']);
});

// ---- 2. Redirects, the size cap and JSON only (src/transport.mjs:8-18, :36).

// src/transport.mjs:36 (redirect:'error') and :39: a redirect is never followed; it fails as transport uncertain.
test('a redirect from the receiver is refused and never followed', async t => {
  const env = await scripted(t, ({ route }) => route === '/capabilities'
    ? { status:302, headers:{ location:`${PREFIX}/moved` }, body:'' }
    : { status:200, body:CAPABILITIES });
  assert.equal(await codeOf(client(env).capabilities()), 'receiver_transport_uncertain');
  assert.deepEqual(steps(env.log), ['GET /capabilities']);
});

// src/transport.mjs:17: a body over 20 MiB fails closed as receiver_response_too_large; one at exactly 20 MiB is read.
test('a response body over the 20 MiB cap fails closed, and one at the cap is still read', async t => {
  const padded = size => {
    const head = JSON.stringify({ ...CAPABILITIES, pad:'' });
    return `${head.slice(0, -2)}${'x'.repeat(size - head.length)}"}`;
  };
  let size = CAP + 1;
  const env = await scripted(t, () => ({ status:200, body:padded(size) }));
  assert.equal(await codeOf(client(env).capabilities()), 'receiver_response_too_large');
  size = CAP;
  assert.deepEqual(await client(env).capabilities(), { activation:'active', features:{ prior_outreach:false, draft_press:false, icp:false, research:false }, research:null });
});

// src/transport.mjs:18: a green answer that is not JSON fails closed as receiver_non_json.
test('a green answer that is not JSON fails closed as receiver_non_json', async t => {
  const env = await scripted(t, () => ({ status:200, type:'text/html', body:'<html>all good</html>' }));
  assert.equal(await codeOf(client(env).capabilities()), 'receiver_non_json');
});

// src/transport.mjs:18 via :152 and :161-165: a report acknowledgement that is not JSON is a named failure and the
// journal keeps the report undelivered, with the code only.
test('a report acknowledgement that is not JSON is named and leaves the report undelivered', async t => {
  const env = await scripted(t, ({ method, route }) => {
    if (route === '/capabilities') return { status:200, body:CAPABILITIES };
    if (method === 'GET') return { status:404, body:{ error:'not_found' } };
    return { status:200, type:'text/plain', body:'accepted' };
  });
  const db = outbox(t); const r = report(); db.put(r);
  const error = await deliver(db, r.run_id, env).catch(e => e);
  assert.equal(error.message, 'delivery_unverified_reconcile_before_retry');
  assert.equal(error.code, 'receiver_non_json');
  const row = db.get(r.run_id);
  assert.equal(row.status, 'uncertain'); assert.equal(row.receipt, null); assert.equal(row.last_error, 'receiver_non_json');
});

// ---- 3. The 20 second timeout (src/transport.mjs:8 TIMEOUT_MS and :36 signal:AbortSignal.timeout(TIMEOUT_MS)).

// src/transport.mjs:8 and :36: every request asks for a 20000 ms timeout signal and hands it to fetch. The test swaps
// in a 50 ms signal so the timeout fires without a 20 s wait, and the hanging request then fails as transport uncertain.
test('every request carries the 20 second timeout signal, and when it fires the request fails as transport uncertain', async t => {
  const env = await scripted(t, () => undefined);
  const real = AbortSignal.timeout;
  const asked = [];
  AbortSignal.timeout = ms => { asked.push(ms); return real.call(AbortSignal, 50); };
  let outcome;
  try { outcome = await within(codeOf(client(env).capabilities()), 3000); }
  finally { AbortSignal.timeout = real; }
  assert.deepEqual(asked, [20000]);
  assert.equal(outcome, 'receiver_transport_uncertain');
  assert.deepEqual(steps(env.log), ['GET /capabilities']);
});

// ---- 4. Named refusals on the report POST (src/transport.mjs:122 POST_REFUSALS, used at :148-150).

// src/transport.mjs:122 and :148-150, with :161-165: 400, 403, 413 and 429 each leave as their own name, the report
// is written once, and the journal never marks it delivered. Any other refusal is receiver_rejected_report.
test('report refusals 400, 403, 413 and 429 are named failures that never mark the report delivered', async t => {
  let status = 0;
  const env = await scripted(t, ({ method, route }) => {
    if (route === '/capabilities') return { status:200, body:CAPABILITIES };
    if (method === 'GET') return { status:404, body:{ error:'not_found' } };
    return { status, body:{ error:'refused' } };
  });
  const names = { 400:'receiver_report_refused', 403:'receiver_identity_refused', 413:'receiver_report_too_large', 429:'receiver_rate_limited', 500:'receiver_rejected_report' };
  for (const [code, name] of Object.entries(names)) {
    status = Number(code);
    const db = outbox(t); const r = report(); db.put(r);
    const before = env.log.length;
    const error = await deliver(db, r.run_id, env).catch(e => e);
    assert.equal(error.message, 'delivery_unverified_reconcile_before_retry', code);
    assert.equal(error.code, name, code);
    assert.deepEqual(steps(env.log.slice(before)), ['GET /capabilities', 'GET /reports/:id', 'POST /reports'], code);
    const row = db.get(r.run_id);
    assert.notEqual(row.status, 'delivered', code);
    assert.equal(row.status, 'uncertain', code);
    assert.equal(row.receipt, null, code);
    assert.equal(row.last_error, name, code);
    assert.equal(row.attempts, 1, code);
  }
});

// ---- 5. A delivered report the receiver no longer holds (src/transport.mjs:137).

// src/transport.mjs:134-137: the journal says delivered but the readback finds nothing. That is named
// receiver_lost_delivered_report before any reservation or write, and the journal is left as it was.
test('a report the journal marks delivered but the receiver no longer holds is named lost and never written again', async t => {
  const db = outbox(t); const r = report(); db.put(r);
  const first = await standIn(t);
  await deliver(db, r.run_id, first);
  assert.equal(db.get(r.run_id).status, 'delivered');
  const kept = { ...db.get(r.run_id) };
  const lost = await standIn(t);
  const error = await deliver(db, r.run_id, lost).catch(e => e);
  assert.equal(error.code, 'receiver_lost_delivered_report');
  assert.equal(lost.posts(), 0);
  assert.deepEqual(steps(lost.log), ['GET /capabilities', 'GET /reports/:id']);
  assert.deepEqual({ ...db.get(r.run_id) }, kept);
});
