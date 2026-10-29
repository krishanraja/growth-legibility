// The held activation state (Ruling, Krish, 2026-10-29): not ready means held. Held by this repository's own flag or by
// Control Center, a run measures inside the walls, proposes nothing, puts no ask on his list and reports exactly one hold
// naming what readiness needs. Offline: every receiver is the loopback stand-in (tests/standin.mjs). Synthetic only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, readdirSync, rmSync, writeFileSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { HOLD_REASON, heldBy, heldReport, readActivation, readinessNeeds } from '../src/lib/hold.mjs';
import { buildReport, engineReport, protocolRunId } from '../src/orchestrator.mjs';
import { validateEngineReport } from '../src/guards/wire.mjs';
import { Outbox } from '../src/outbox.mjs';
import { controlCenter, deliver } from '../src/transport.mjs';
import { operate } from '../src/operate.mjs';
import { standIn, schemaErrors, REPORT_SCHEMA, DIRECTIVE } from './standin.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const json = path => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const policy = () => json('../config/policy.json');
const AT = '2026-10-18T12:00:00Z';
const ACTIVE = Object.freeze({ state:'active', reason:null });
const HELD = Object.freeze({ state:'held', reason:'local_flag_held' });
// Control Center's held rule, word for word (HELD_RULE in its src/lib/growthEngines.ts).
const HELD_RULE = 'Krish has held this engine until it is ready. Propose nothing and ask him nothing. Report one hold that names what stops you being ready and what would clear it.';
const ccHeld = cap => ({ ...cap, activation:{ state:'held', activated_on:'2026-10-18' } });

function tempDir(t) {
  const dir = mkdtempSync(join(tmpdir(), 'growth-legibility-hold-'));
  t.after(() => { try { rmSync(dir, { recursive:true, force:true, maxRetries:5, retryDelay:100 }); } catch {} });
  return dir;
}
async function run(t, env, extra = {}) {
  const db = new Outbox(join(tempDir(t), 'outbox.sqlite'));
  t.after(() => { try { db.close(); } catch {} });
  const result = await operate({ client:controlCenter({ token:env.token, base:env.base, testMode:true }), outbox:db, policy:policy(), corpusSha:'a'.repeat(64), at:AT,
    invocation:'local0hold', synthetic:true, revision:'f'.repeat(40), clock:() => AT, loadSnapshot:() => json('../fixtures/snapshot.json'), ...extra });
  return { ...result, stored:env.reports.get(result.summary.run_id) };
}
function assertHeld(report) {
  assert.deepEqual(schemaErrors(report, REPORT_SCHEMA), []);
  assert.doesNotThrow(() => validateEngineReport(report));
  assert.equal(report.status, 'held');
  assert.deepEqual(report.proposals, [], 'no ask reaches his list');
  assert.deepEqual(report.holds.map(h => h.reason), [HOLD_REASON], 'exactly one hold');
  assert.match(report.holds[0].detail, /Ruling, Krish, 2026-10-29/);
  assert.match(report.holds[0].detail, /Ready needs: /);
  assert.ok(!report.activity.some(a => /^Prepared \d+ named invitation|^Recommended constraint:/.test(a.line)), 'no activity line describes an ask');
}

test('the local flag reads held unless a readable file says active, and the repository ships held', t => {
  const dir = tempDir(t);
  const at = (name, body) => { const p = join(dir, name); if (body !== undefined) writeFileSync(p, body); return readActivation(p); };
  assert.deepEqual(at('missing.json'), { state:'held', reason:'local_flag_unreadable' });
  assert.deepEqual(at('broken.json', '{'), { state:'held', reason:'local_flag_unreadable' });
  assert.deepEqual(at('other.json', '{"state":"paused"}'), { state:'held', reason:'local_flag_unknown' });
  assert.deepEqual(at('held.json', '{"state":"held"}'), { state:'held', reason:'local_flag_held' });
  assert.deepEqual(at('active.json', '{"state":"active"}'), { state:'active', reason:null });
  assert.equal(readActivation(new URL('../config/activation.json', import.meta.url)).state, 'held', 'held by Krish on 2026-10-29');
});

test("either switch holds: the local flag, Control Center's activation state, or its held rule in the directive", () => {
  assert.deepEqual(heldBy({ local:ACTIVE, activation:'active', directive:DIRECTIVE }), []);
  assert.deepEqual(heldBy({ local:HELD, activation:'active', directive:DIRECTIVE }), ['krish_local']);
  assert.deepEqual(heldBy({ local:ACTIVE, activation:'held' }), ['control_center']);
  assert.deepEqual(heldBy({ local:ACTIVE, activation:null, directive:{ ...DIRECTIVE, next_action:{ ...DIRECTIVE.next_action, instruction:HELD_RULE } } }), ['control_center']);
  assert.deepEqual(heldBy({ local:HELD, activation:'held' }), ['krish_local', 'control_center']);
  assert.deepEqual(heldBy(), ['krish_local'], 'no flag given is held');
});

test('a held report keeps what was measured, drops every proposal and names what readiness needs', () => {
  const r = buildReport(json('../fixtures/snapshot.json'), policy(), AT, 'a'.repeat(64));
  const live = engineReport(r, { runId:protocolRunId('run', r.observed_at, r.run_id.slice(3, 19)), directive:DIRECTIVE });
  assert.ok(live.proposals.length > 0);
  const held = heldReport(live, { by:['krish_local'], policy:policy() });
  assertHeld(held);
  assert.deepEqual(held.objectives, live.objectives, 'measurement is untouched');
  assert.equal(held.schema_version, '1.0.0');
  assert.deepEqual(readinessNeeds(live, policy()), [...new Set(live.holds.map(h => h.reason)), 'campaign_clock_not_activated']);
  for (const need of readinessNeeds(live, policy())) assert.ok(held.holds[0].detail.includes(need), need);
  assert.match(held.holds[0].detail, /config\/activation\.json/);
  assert.match(heldReport(live, { by:['control_center'], policy:policy() }).holds[0].detail, /Growth > Engines/);
});

test('held by the local flag, a run with a full snapshot proposes nothing, reads no Mindmake record and reports one hold', async t => {
  const env = await standIn(t, { priorOutreach:{} });
  const { summary, stored } = await run(t, env, { activation:HELD });
  assert.equal(summary.status, 'succeeded');
  assert.deepEqual(summary.activation, { state:'held', by:['krish_local'], local:'held', control_center:'active' });
  assertHeld(stored);
  assert.deepEqual(env.priorOutreachReads, [], 'nothing is prepared, so no one is looked up');
  assert.equal(summary.prior_outreach, undefined);
  assert.equal(summary.report.proposals, 0);
  assert.deepEqual(summary.report.holds, [HOLD_REASON]);
});

test('held by Control Center, by its activation state or by its held rule, an active local flag still holds', async t => {
  const byState = await run(t, await standIn(t, { capabilities:ccHeld }), { activation:ACTIVE });
  assert.deepEqual(byState.summary.activation.by, ['control_center']);
  assertHeld(byState.stored);
  assert.match(byState.stored.holds[0].detail, /Growth > Engines in Control Center\./);

  const byRule = await run(t, await standIn(t, { directive:{ ...DIRECTIVE, next_action:{ proposal_id:null, instruction:HELD_RULE, why:'Krish held it: it is not ready yet.', close_condition:null } } }), { activation:ACTIVE });
  assert.deepEqual(byRule.summary.activation.by, ['control_center']);
  assertHeld(byRule.stored);
});

test('held with no snapshot, the one hold names the missing source; released in both places, the run proposes as before', async t => {
  const empty = await run(t, await standIn(t), { activation:HELD, loadSnapshot:null });
  assertHeld(empty.stored);
  assert.match(empty.stored.holds[0].detail, /source_snapshot_missing/);

  const released = await run(t, await standIn(t), { activation:ACTIVE });
  assert.equal(released.summary.activation.state, 'active');
  assert.ok(released.stored.proposals.length > 0);
  assert.ok(!released.stored.holds.some(h => h.reason === HOLD_REASON));
});

test('held, a Mindmake record the snapshot brought is never trusted: the hold names it unknown and prepares no more than an active run', async t => {
  const snap = json('../fixtures/snapshot.json');
  assert.ok(snap.candidates.some(c => c.contact?.prior_mindmake), 'the fixture carries a record of its own');
  const held = await run(t, await standIn(t, { priorOutreach:{} }), { activation:HELD });
  const active = await run(t, await standIn(t, { priorOutreach:{} }), { activation:ACTIVE });
  assert.ok(active.stored.holds.some(h => h.reason === 'mindmake_history_unknown'), 'active, an empty answer holds as unknown');
  assert.match(held.stored.holds[0].detail, /mindmake_history_unknown/, 'held, the one hold names it among what readiness needs');
  for (const reason of new Set(active.stored.holds.map(h => h.reason))) assert.ok(held.stored.holds[0].detail.includes(reason), reason);
  assert.ok(held.privateReport.actions.length <= active.privateReport.actions.length, 'held prepares nothing an active run would not');
});

function outboxWith(t, envelope) {
  const db = new Outbox(join(tempDir(t), 'outbox.sqlite'));
  t.after(() => { try { db.close(); } catch {} });
  db.put(envelope);
  return db;
}
function syntheticEnvelope() {
  const r = buildReport(json('../fixtures/snapshot.json'), policy(), AT, 'a'.repeat(64));
  return engineReport(r, { runId:protocolRunId('run', r.observed_at, r.run_id.slice(3, 19)), directive:DIRECTIVE });
}

test('deliver by hand refuses a row with proposals while either switch holds, and still sends a held report', async t => {
  const live = syntheticEnvelope();
  assert.ok(live.proposals.length > 0);

  const local = await standIn(t);
  await assert.rejects(deliver(outboxWith(t, live), live.run_id, { client:controlCenter({ token:local.token, base:local.base, testMode:true }), activation:HELD }), { code:'engine_held_proposals_refused' });
  await assert.rejects(deliver(outboxWith(t, live), live.run_id, { client:controlCenter({ token:local.token, base:local.base, testMode:true }), activation:{ state:'held', reason:'local_flag_unreadable' } }), { code:'engine_held_proposals_refused' });
  assert.equal(local.reports.size, 0, 'nothing reached his list');

  const cc = await standIn(t, { capabilities:ccHeld });
  await assert.rejects(deliver(outboxWith(t, live), live.run_id, { client:controlCenter({ token:cc.token, base:cc.base, testMode:true }), activation:ACTIVE }), { code:'engine_held_proposals_refused' });
  assert.equal(cc.reports.size, 0, 'nothing reached his list');

  const held = heldReport(live, { by:['krish_local'], policy:policy() });
  const ok = await standIn(t);
  await deliver(outboxWith(t, held), held.run_id, { client:controlCenter({ token:ok.token, base:ok.base, testMode:true }), activation:HELD });
  assertHeld(ok.reports.get(held.run_id));
});

test('the run command, held by the shipped flag, keeps only a held envelope in its outbox', t => {
  const out = join(ROOT, 'runtime', `test-hold-${process.pid}-${Date.now()}`);
  t.after(() => { try { rmSync(out, { recursive:true, force:true, maxRetries:5, retryDelay:100 }); } catch {} });
  const res = spawnSync(process.execPath, ['src/cli.mjs', 'run', '--snapshot', 'fixtures/snapshot.json', '--at', AT, '--out', out], { cwd:ROOT, encoding:'utf8' });
  assert.equal(res.status, 0, res.stderr);
  const file = readdirSync(out).find(f => f.endsWith('.envelope.json'));
  assert.ok(file, 'an envelope was written');
  const envelope = JSON.parse(readFileSync(join(out, file), 'utf8'));
  assertHeld(envelope);
  assert.match(envelope.holds[0].detail, /mindmake_history_unknown/);
  const db = new Outbox(join(out, 'outbox.sqlite'));
  try { assert.equal(JSON.parse(db.get(envelope.run_id).payload).proposals.length, 0, 'the outbox row carries no proposal'); } finally { db.close(); }
});
