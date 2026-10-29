// Protocol 1.16.0, the prepaid credits: this engine's share of each pool is read from the directive, held or unknown spends
// nothing, a spend past the share is refused before it runs, and a report carrying credits_spent says 1.16.0 and only then.
// Offline: every receiver is the loopback stand-in (tests/standin.mjs). Synthetic amounts only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { creditsActivity, readCredits, reserveCredit } from '../src/lib/cc-signals.mjs';
import { CREDITS_VERSION, sha256, validateEngineEnvelope, VERSION } from '../src/guards/wire.mjs';
import { engineReport, heldEngineReport, buildReport, seal } from '../src/orchestrator.mjs';
import { heldReport } from '../src/lib/hold.mjs';
import { Outbox } from '../src/outbox.mjs';
import { controlCenter, deliver } from '../src/transport.mjs';
import { operate } from '../src/operate.mjs';
import { standIn, CC_VERSIONS, DIRECTIVE } from './standin.mjs';

const json = path => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const policy = () => json('../config/policy.json');
const AT = '2026-10-19T05:10:00Z';
const POOL = Object.freeze({ pool:'apify', tool:'Apify', unit:'usd', share:'main', share_amount:5.8, spent_this_cycle:1.3, remaining_for_you:4.5,
  pool_balance:10, balance_as_of:'2026-10-18T09:00:00Z', use_by:'2026-11-20', resets_on:'2026-11-21', days_left:32, unit_costs:[] });
const CREDITS = Object.freeze({ rule:'Spend within remaining_for_you on work that moves your objectives.', pools:[POOL] });
const SERVES_CREDITS = cap => ({ ...cap, schema_version:'1.16.0', schema_versions:[...CC_VERSIONS], features:{ ...cap.features, credits:true } });

function outbox(t) {
  const dir = mkdtempSync(join(tmpdir(), 'growth-legibility-credits-'));
  const db = new Outbox(join(dir, 'outbox.sqlite'));
  t.after(() => { try { db.close(); } catch {} try { rmSync(dir, { recursive:true, force:true, maxRetries:5, retryDelay:100 }); } catch {} });
  return db;
}
async function run(t, env, extra = {}) {
  const result = await operate({ client:controlCenter({ token:env.token, base:env.base, testMode:true }), outbox:outbox(t), policy:policy(), corpusSha:'a'.repeat(64), at:AT,
    invocation:'local0credits', synthetic:true, revision:'f'.repeat(40), clock:() => '2026-10-19T05:11:00Z', ...extra });
  return { ...result, stored:env.reports.get(result.summary.run_id) };
}

test('the credits are read only when served; left out is unknown, never a share of zero', () => {
  assert.deepEqual(readCredits({ credits:CREDITS }, { credits:false }), { credits:null, state:'not_served', reason:'credits_not_served' });
  assert.deepEqual(readCredits({}, { credits:true }), { credits:null, state:'unread', reason:'credits_unread' });
  const ok = readCredits({ credits:CREDITS }, { credits:true });
  assert.equal(ok.state, 'ok');
  assert.deepEqual(ok.credits.pools.map(p => [p.pool, p.remaining_for_you, p.use_by]), [['apify', 4.5, '2026-11-20']]);
  for (const [why, pool] of [['a bad key', { ...POOL, pool:'Apify!' }], ['a negative amount', { ...POOL, remaining_for_you:-1 }],
    ['more left than the share', { ...POOL, remaining_for_you:6 }], ['no use-by day', { ...POOL, use_by:null }], ['an unknown share', { ...POOL, share:'all' }]])
    assert.equal(readCredits({ credits:{ ...CREDITS, pools:[pool] } }, { credits:true }).state, 'refused', why);
  assert.deepEqual(creditsActivity(readCredits({}, { credits:false })), [], 'not served adds no line');
  assert.match(creditsActivity(readCredits({}, { credits:true }))[0].line, /unknown today \(credits_unread\), so nothing was spent/);
});

test('a spend past the share, while held or with the block unknown, is refused before it runs', () => {
  const { credits } = readCredits({ credits:CREDITS }, { credits:true });
  assert.deepEqual(reserveCredit({ credits, held:false }, 'apify', 2), { ok:true, remaining_after:2.5 });
  assert.deepEqual(reserveCredit({ credits, held:false, spent:[{ pool:'apify', amount:3 }] }, 'apify', 2), { ok:false, error:'credits_over_share', remaining_for_you:1.5 });
  assert.deepEqual(reserveCredit({ credits, held:false }, 'apify', 4.51), { ok:false, error:'credits_over_share', remaining_for_you:4.5 });
  assert.deepEqual(reserveCredit({ credits, held:false }, '21st-dev', 1), { ok:false, error:'credits_no_pool' });
  assert.deepEqual(reserveCredit({ credits, held:true }, 'apify', 1), { ok:false, error:'credits_held' });
  assert.deepEqual(reserveCredit({ credits:null, held:false }, 'apify', 1), { ok:false, error:'credits_unknown' });
});

test('served credits are said on a held run, which spends none of them and still reports 1.0.0', async t => {
  const env = await standIn(t, { directive:{ ...DIRECTIVE, credits:CREDITS }, capabilities:SERVES_CREDITS });
  const held = await run(t, env, { activation:{ state:'held', reason:'local_flag_held' } });
  assert.equal(held.summary.credits.state, 'ok');
  assert.equal(held.summary.credits.spent, 0);
  assert.equal(held.stored.schema_version, VERSION);
  assert.equal('credits_spent' in held.stored, false);
  assert.match(held.stored.activity.map(a => a.line).join(' '), /Prepaid credits, Apify \(main share\): \$4\.50 left of \$5\.80 this cycle, use by 2026-11-20 \(32 days\)\. Held by Krish, so this run spent none of it\./);
});

test('not served, the run is byte for byte the one sent before 1.16.0', async t => {
  const env = await standIn(t, { directive:{ ...DIRECTIVE, credits:CREDITS } });
  const plain = await run(t, env);
  assert.equal(plain.summary.credits.state, 'not_served');
  const baseline = heldEngineReport({ runId:plain.summary.run_id, at:new Date(AT).toISOString(), revision:'f'.repeat(40), mode:'synthetic', policy:policy(), directive:{ ...DIRECTIVE, credits:CREDITS } });
  assert.deepEqual(plain.stored, baseline);
});

test('a report carrying credits_spent says 1.16.0, and the wire and the stand-in take it; without one it never does', async t => {
  const snap = json('../fixtures/snapshot.json');
  const report = buildReport(snap, policy(), snap.captured_at, 'a'.repeat(64));
  const { credits } = readCredits({ credits:CREDITS }, { credits:true });
  const spent = [{ pool:'apify', amount:0.42, asset:'builder discovery run over synthetic directories', objective_key:'weekly_builders' }];
  const env = await standIn(t, { capabilities:SERVES_CREDITS });
  const withSpend = engineReport(report, { runId:'synthetic-credits-1', credits:{ read:{ credits, state:'ok', reason:null }, held:false, spent } });
  assert.equal(withSpend.schema_version, CREDITS_VERSION);
  assert.deepEqual(withSpend.credits_spent, spent);
  const ob = outbox(t);
  ob.put(withSpend);
  const receipt = await deliver(ob, withSpend.run_id, { client:controlCenter({ token:env.token, base:env.base, testMode:true }) });
  assert.equal(receipt.payload_sha256, withSpend.payload_sha256, 'the stand-in, as Control Center, stored it');

  const none = engineReport(report, { runId:'synthetic-credits-2', credits:{ read:{ credits, state:'ok', reason:null }, held:false, spent:[] } });
  assert.notEqual(none.schema_version, CREDITS_VERSION);
  assert.equal('credits_spent' in none, false);
  const held = engineReport(report, { runId:'synthetic-credits-3', credits:{ read:{ credits, state:'ok', reason:null }, held:true, spent } });
  assert.equal('credits_spent' in held, false, 'a held run never carries spend');
  const reheld = heldReport(withSpend, { by:['krish_local'], policy:policy() });
  assert.equal('credits_spent' in reheld, false);
  assert.equal(reheld.schema_version, VERSION);

  // Raise the version only for its field: 1.16.0 without credits_spent, credits_spent at 1.0.0, or an address in asset fail.
  const { payload_sha256, ...body } = withSpend;
  const resealed = b => ({ ...b, payload_sha256:sha256(b) });
  const { credits_spent, ...bare } = body;
  assert.throws(() => validateEngineEnvelope(resealed({ ...bare })), /credits_spent_version/);
  assert.throws(() => validateEngineEnvelope(resealed({ ...body, schema_version:VERSION })), /credits_spent_version/);
  assert.throws(() => validateEngineEnvelope(resealed({ ...body, credits_spent:[{ ...spent[0], asset:`sent to someone${String.fromCharCode(64)}place.test` }] })), /engine_credit_spent/);
  assert.throws(() => validateEngineEnvelope(resealed({ ...body, credits_spent:Array(41).fill(spent[0]) })), /credits_spent_version/);
  assert.equal(seal(body).payload_sha256, payload_sha256);
});
