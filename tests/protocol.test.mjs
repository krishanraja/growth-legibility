import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { sha256, canonical, validateEngineEnvelope, validateEngineReport, validateAttempt } from '../src/guards/wire.mjs';
import { buildReport, engineReport, heldEngineReport, protocolRunId } from '../src/orchestrator.mjs';
import { Outbox } from '../src/outbox.mjs';
import { controlCenter } from '../src/transport.mjs';
import { operate, matchDecisions } from '../src/operate.mjs';
import { standIn, schemaErrors, REPORT_SCHEMA, TOKEN, DIRECTIVE } from './standin.mjs';

const json = path => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const fixture = () => json('../fixtures/snapshot.json');
const policy = () => json('../config/policy.json');
const AT = '2026-10-18T12:00:00Z';
const journal = () => join(mkdtempSync(join(tmpdir(), 'growth-legibility-')), 'outbox.sqlite');
const privateReport = (p = policy()) => buildReport(fixture(), p, AT, 'a'.repeat(64));
const envelope = (p = policy()) => { const r = privateReport(p); return engineReport(r, { runId:protocolRunId('run', r.observed_at, r.run_id.slice(3, 19)) }); };

test('the canonical digest reproduces the protocol worked example', () => {
  const example = json('../docs/control-center/engine-report.example.json');
  const { payload_sha256, ...body } = example;
  assert.equal(sha256(body), 'f4351324e84aa1baf6afd1bc4d2ffadb3039ab6399b2309c2717b89a26a0a517');
  assert.equal(payload_sha256, sha256(body));
  assert.doesNotThrow(() => validateEngineEnvelope(example));
  // Keys sorted at every depth, no whitespace, whole numbers written as JavaScript writes them.
  assert.equal(canonical({ b:[{ z:1, a:0.5 }], a:'é' }), '{"a":"é","b":[{"a":0.5,"z":1}]}');
});

test('the envelope from a full snapshot is schema-valid, closed and honest about what is unknown', () => {
  const e = envelope();
  assert.deepEqual(schemaErrors(e, REPORT_SCHEMA), []);
  validateEngineReport(e);
  assert.deepEqual(e.objectives.map(o => o.key), ['activated', 'returning', 'net']);
  // The campaign clock is not activated, so no objective is guessed: null with a reason, never zero.
  for (const o of e.objectives) { assert.equal(o.value, null); assert.equal(o.availability, 'missing'); assert.ok(o.reason.length > 10); }
  const send = e.proposals.find(p => p.wall === 'send');
  const packet = privateReport().actions.find(a => a.status === 'pending_human');
  assert.equal(send.exact_payload, packet.exact_text);
  assert.equal(send.payload_sha256, packet.text_sha256);
  assert.equal(send.payload_sha256, sha256(send.exact_payload));
  assert.equal(send.expires_at, packet.expires_at);
  assert.ok(send.proposal_id.endsWith(':manual-email'));
  assert.ok(e.proposals.every(p => p.kind !== 'autonomous'));
  assert.equal(envelope().payload_sha256, e.payload_sha256);
  // Proposal ids are stable when only the clock moves.
  const later = buildReport(fixture(), policy(), '2026-10-18T13:00:00Z', 'a'.repeat(64));
  assert.deepEqual(engineReport(later, { runId:'legibility:2026-10-18:run:x' }).proposals.map(p => p.proposal_id), e.proposals.map(p => p.proposal_id));
  // Activity lines carry no private company, project or URL.
  const activity = JSON.stringify(e.activity);
  for (const secret of ['Synthetic Commerce Lab', 'procurement agent', 'example.org', 'candidate-example']) assert.ok(!activity.includes(secret), secret);
});

test('an activated campaign is measured as counts in the campaign window, and a measured zero stays zero', () => {
  const p = policy(); p.campaign.activated_at = '2026-10-01T00:00:00Z';
  const e = envelope(p);
  const byKey = Object.fromEntries(e.objectives.map(o => [o.key, o]));
  assert.equal(byKey.activated.value, 1); assert.equal(byKey.returning.value, 1); assert.equal(byKey.net.value, 2);
  for (const o of e.objectives) { assert.equal(o.availability, 'measured'); assert.equal(o.reason, null); assert.equal(o.window_start, '2026-10-01T00:00:00Z'); assert.equal(o.timezone, 'UTC'); }
  const f = fixture(); f.reads = []; f.feedback = [];
  const r = buildReport(f, p, AT, 'a'.repeat(64));
  const zero = engineReport(r, { runId:'legibility:2026-10-18:run:zero' });
  assert.equal(zero.objectives.find(o => o.key === 'activated').value, 0);
  const partial = fixture(); partial.coverage.reads = false;
  const unknown = engineReport(buildReport(partial, p, AT, 'a'.repeat(64)), { runId:'legibility:2026-10-18:run:partial' });
  const activated = unknown.objectives.find(o => o.key === 'activated');
  assert.equal(activated.value, null); assert.equal(activated.availability, 'missing'); assert.match(activated.reason, /reads/);
});

test('a run with no snapshot or ICP reports held, with every objective missing and both gaps named', () => {
  const e = heldEngineReport({ runId:'legibility:2026-10-19:operate:local1', at:'2026-10-19T05:10:00Z', revision:'f'.repeat(40), policy:policy() });
  assert.deepEqual(schemaErrors(e, REPORT_SCHEMA), []);
  assert.equal(e.status, 'held'); assert.equal(e.mode, 'live');
  for (const o of e.objectives) { assert.equal(o.value, null); assert.equal(o.availability, 'missing'); assert.match(o.reason, /No source snapshot/); }
  assert.deepEqual(e.holds.map(h => h.reason), ['source_snapshot_missing', 'icp_not_current_approved']);
  assert.ok(e.proposals.every(p => p.wall === 'none' && p.exact_payload === null));
});

test('the validator refuses unknown fields, walled proposals without their payload and bad digests', () => {
  const e = envelope();
  const reseal = r => { const { payload_sha256, ...body } = r; return { ...body, payload_sha256:sha256(body) }; };
  assert.throws(() => validateEngineReport(reseal({ ...e, scorecard:{} })), /unknown_fields/);
  assert.throws(() => validateEngineReport(reseal({ ...e, proposals:[{ ...e.proposals[0], send_now:true }] })), /unknown_fields/);
  assert.throws(() => validateEngineReport(reseal({ ...e, proposals:[{ ...e.proposals[0], exact_payload:null }] })), /exact_payload_required/);
  assert.throws(() => validateEngineReport(reseal({ ...e, proposals:[{ ...e.proposals[0], kind:'autonomous' }] })), /autonomous_behind_wall/);
  assert.throws(() => validateEngineReport(reseal({ ...e, objectives:[{ ...e.objectives[0], reason:null }] })), /unknown_needs_reason/);
  assert.throws(() => validateEngineReport({ ...e, status:'degraded' }), /digest/);
  assert.throws(() => validateAttempt({ attempt_id:'a', command:'operate', run_id:null, status:'failed', phase:'report', error_code:'Bad message', started_at:AT, finished_at:AT }), /error_code/);
  assert.throws(() => validateAttempt({ attempt_id:'a', command:'operate', run_id:null, status:'started', phase:'start', error_code:null, started_at:AT, finished_at:AT }), /times/);
});

async function run(t, env, extra = {}) {
  const outbox = new Outbox(journal()); t.after(() => outbox.close());
  const lines = [];
  const result = await operate({ client:controlCenter(env), outbox, policy:policy(), corpusSha:'a'.repeat(64), at:'2026-10-19T05:10:00Z',
    invocation:'local0test', synthetic:true, revision:'f'.repeat(40), clock:() => '2026-10-19T05:11:00Z', ...extra });
  lines.push(JSON.stringify(result.summary));
  return { ...result, outbox, lines };
}

test('one dispatch with no snapshot: attempt started first, directive, held report read back, decisions, attempt closed', async t => {
  const env = await standIn(t);
  const { summary, outbox } = await run(t, env);
  assert.equal(summary.status, 'succeeded'); assert.equal(summary.journal, 'closed'); assert.equal(summary.error_code, null);
  const order = env.log.map(x => `${x.method} ${x.route.split('?')[0].replace(/\/(attempts|reports)\/.+$/, '/$1/:id')}`);
  assert.equal(order[0], 'POST /attempts');
  assert.equal(order[1], 'GET /directive');
  assert.equal(order.at(-1), 'POST /attempts');
  assert.ok(order.indexOf('POST /reports') < order.lastIndexOf('GET /reports/:id'));
  assert.ok(order.indexOf('GET /decisions') > order.indexOf('POST /reports'));
  const attempts = env.log.filter(x => x.method === 'POST' && x.route === '/attempts').map(x => JSON.parse(x.body));
  assert.equal(attempts.length, 2);
  assert.equal(attempts[0].status, 'started'); assert.ok(!('finished_at' in attempts[0]));
  assert.equal(attempts[1].status, 'succeeded'); assert.equal(attempts[1].attempt_id, attempts[0].attempt_id); assert.ok(attempts[1].finished_at);
  const stored = env.reports.get(summary.run_id);
  assert.equal(stored.status, 'held'); assert.equal(stored.mode, 'synthetic');
  assert.equal(summary.report.readback, 'matched'); assert.equal(summary.report.payload_sha256, stored.payload_sha256);
  assert.deepEqual(summary.report.holds, ['source_snapshot_missing', 'icp_not_current_approved']);
  assert.match(stored.activity[0].line, /legibility:2026-10-19/);
  assert.equal(outbox.get(summary.run_id).status, 'delivered');
});

test('a dispatch with a synthetic snapshot reports the measured envelope and matches decisions only on the exact digest', async t => {
  const e = envelope();
  const send = e.proposals.find(p => p.wall === 'send');
  const decisions = [
    { proposal_id:send.proposal_id, decision:'approved', decided_at:'2026-10-18T20:00:00Z', payload_sha256:send.payload_sha256 },
    { proposal_id:'legibility:constraint:activate_campaign', decision:'approved', decided_at:'2026-10-18T20:00:00Z', payload_sha256:'0'.repeat(64) },
    { proposal_id:'legibility:old', decision:'declined', decided_at:'2026-10-18T20:00:00Z', payload_sha256:null },
  ];
  const env = await standIn(t, { decisions });
  const { summary, privateReport: report } = await run(t, env, { loadSnapshot:fixture });
  assert.equal(summary.status, 'succeeded');
  assert.equal(report.mode, 'synthetic');
  assert.deepEqual(summary.decisions, { approved_exact:1, approved_changed:1, approved_elsewhere:0, declined:1, done:0 });
  assert.ok(env.reports.get(summary.run_id).proposals.some(p => p.payload_sha256 === send.payload_sha256));
  // The engine has no send path: nothing but the protocol routes was called.
  assert.ok(env.log.every(x => ['/attempts', '/directive', '/reports', '/decisions', '/capabilities'].some(r => x.route.startsWith(r))));
});

test('a synthetic snapshot can never reach the live origin', async t => {
  let calls = 0;
  const client = controlCenter({ token:TOKEN, fetcher:async () => { calls++; return new Response(JSON.stringify({ ok:true, attempt:{ attempt_id:'legibility:2026-10-19:operate:local0test', status:calls === 1 ? 'started' : 'failed' } }), { status:200 }); } });
  const outbox = new Outbox(journal()); t.after(() => outbox.close());
  const { summary } = await operate({ client, outbox, policy:policy(), corpusSha:'a'.repeat(64), at:'2026-10-19T05:10:00Z', invocation:'local0test', loadSnapshot:fixture });
  assert.equal(summary.status, 'failed'); assert.equal(summary.error_code, 'synthetic_snapshot_refused');
  assert.equal(outbox.get(summary.run_id), undefined);
});

test('a missing directive degrades the run but still reports and closes the attempt', async t => {
  const env = await standIn(t, { directiveStatus:503 });
  const { summary } = await run(t, env);
  assert.equal(summary.status, 'succeeded');
  assert.ok(summary.report.holds.includes('directive_unavailable'));
});

test('a 401 surfaces as a failed attempt with a lower_snake code, and the bearer never reaches any output', async t => {
  const env = await standIn(t, { unauthorized:['reports'] });
  const { summary, lines, outbox } = await run(t, env);
  assert.equal(summary.status, 'failed'); assert.equal(summary.error_code, 'receiver_unauthorized'); assert.equal(summary.phase, 'report');
  const terminal = env.log.filter(x => x.method === 'POST' && x.route === '/attempts').map(x => JSON.parse(x.body)).at(-1);
  assert.equal(terminal.status, 'failed'); assert.equal(terminal.error_code, 'receiver_unauthorized'); assert.match(terminal.error_code, /^[a-z][a-z0-9_]*$/);
  const everything = env.log.filter(x => x.body).map(x => x.body).join('\n') + lines.join('\n') + JSON.stringify(outbox.get(summary.run_id));
  assert.ok(!everything.includes(TOKEN));
  // Fully refused: the attempt cannot even be journaled, so the run stops before reading any source.
  const refused = await standIn(t, { unauthorized:['all'] });
  let read = false;
  const r = await run(t, refused, { loadSnapshot:() => { read = true; return fixture(); } });
  assert.equal(r.summary.error_code, 'receiver_unauthorized'); assert.equal(r.summary.journal, 'not_started'); assert.equal(read, false);
});

test('a 409 on the report fails the attempt without a second write', async t => {
  // The receiver already holds a different payload under this run's id; the first readback misses, so the client writes once.
  const runId = protocolRunId('operate', '2026-10-19T05:10:00Z', 'local0test');
  const other = heldEngineReport({ runId, at:'2026-10-19T05:00:00Z', revision:'e'.repeat(40), mode:'synthetic', policy:policy() });
  const env = await standIn(t, { conflictWith:other, hideReadbacks:1 });
  const { summary } = await run(t, env);
  assert.equal(summary.status, 'failed'); assert.equal(summary.error_code, 'receiver_report_conflict'); assert.equal(summary.phase, 'report');
  assert.equal(env.posts(), 1);
  assert.equal(env.attempts.get(runId).error_code, 'receiver_report_conflict');
  assert.equal(env.reports.get(runId).payload_sha256, other.payload_sha256);
});

test('the CLI says which secret is missing, exits non-zero and prints no credential', () => {
  const cli = fileURLToPath(new URL('../src/cli.mjs', import.meta.url));
  const base = { ...process.env, CONTROL_CENTER_ENGINE_TOKEN:'', CONTROL_CENTER_URL:'', GITHUB_RUN_ID:'', GITHUB_RUN_ATTEMPT:'' };
  const missing = spawnSync(process.execPath, [cli, 'operate'], { env:base, encoding:'utf8' });
  assert.equal(missing.status, 1); assert.match(missing.stderr, /control_center_engine_token_missing/);
  const elsewhere = spawnSync(process.execPath, [cli, 'operate'], { env:{ ...base, CONTROL_CENTER_ENGINE_TOKEN:TOKEN, CONTROL_CENTER_URL:'https://example.org' }, encoding:'utf8' });
  assert.equal(elsewhere.status, 1); assert.match(elsewhere.stderr, /receiver_origin_not_approved/);
  const wrongEngine = spawnSync(process.execPath, [cli, 'operate'], { env:{ ...base, CONTROL_CENTER_ENGINE_TOKEN:TOKEN, CC_ENGINE_ID:'growth-heartside' }, encoding:'utf8' });
  assert.equal(wrongEngine.status, 1); assert.match(wrongEngine.stderr, /dispatch_engine_mismatch/);
  for (const r of [missing, elsewhere, wrongEngine]) assert.ok(!`${r.stdout}${r.stderr}`.includes(TOKEN));
});

test('decisions match by proposal and exact payload digest only', () => {
  const e = envelope();
  assert.deepEqual(matchDecisions([], e), { approved_exact:0, approved_changed:0, approved_elsewhere:0, declined:0, done:0 });
  assert.equal(DIRECTIVE.engine_id, 'growth-legibility');
  assert.ok(readdirSync(new URL('../.github/workflows', import.meta.url)).includes('operate.yml'));
});

test('Control Center may serve any 1.x: a directive and capabilities are taken while it still takes our 1.0.0, and nothing else', async () => {
  const { receiverTakes, SERVED, validateDirective } = await import('../src/guards/wire.mjs');
  const { DIRECTIVE } = await import('./standin.mjs');
  for (const v of ['1.0.0', '1.1.0', '1.2.0']) assert.doesNotThrow(() => validateDirective({ ...DIRECTIVE, schema_version: v }), v);
  for (const v of ['2.0.0', '1.2', '', undefined]) assert.throws(() => validateDirective({ ...DIRECTIVE, schema_version: v }), /directive_identity/, String(v));
  assert.equal(SERVED.test('1.2.0'), true);
  assert.equal(receiverTakes({ schema_version: '1.2.0', schema_versions: ['1.0.0', '1.1.0', '1.2.0'] }), true);
  assert.equal(receiverTakes({ schema_version: '1.2.0', schema_versions: ['1.1.0', '1.2.0'] }), false, 'a receiver that stopped taking 1.0.0 is a mismatch');
  assert.equal(receiverTakes({ schema_version: '1.0.0' }), true, 'an older receiver with no list is taken on its one version');
});
