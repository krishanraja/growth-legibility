// What Control Center's directive carries for this engine (protocol 1.13.0): Legibility's buyer from product_icp, legibility.io's
// readings, the registered objectives and the research desk's availability. Offline: every receiver is the loopback stand-in
// (tests/standin.mjs). Synthetic only: no real buyer, person, address or measurement.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { applyIcp, readIcp, researchAvailability, siteActivity } from '../src/lib/cc-signals.mjs';
import { exportUrl, EXPORT_ORIGIN } from '../src/lib/export-client.mjs';
import { buildReport, engineReport, heldEngineReport, protocolRunId, registeredObjectives } from '../src/orchestrator.mjs';
import { Outbox } from '../src/outbox.mjs';
import { controlCenter } from '../src/transport.mjs';
import { operate } from '../src/operate.mjs';
import { standIn, DIRECTIVE } from './standin.mjs';

const json = path => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const policy = () => json('../config/policy.json');
const AT = '2026-10-19T05:10:00Z';
// A synthetic buyer in exactly the shape Control Center serves (icpBlock in its api/_growthEngines.ts).
const ICP = Object.freeze({
  product_slug:'legibility', source:'control-center:product_icp', status:'approved',
  buyer_definition:'Who: Synthetic commercial leaders at companies that buy product data for their own agents.\nBuyer titles: Synthetic Head of Data.',
  revision:`sha256:${'c'.repeat(64)}`, reviewed_at:'2026-10-18T09:00:00.000Z',
});
const MISSING = Object.freeze({ product_slug:'legibility', source:'control-center:product_icp', status:'missing', buyer_definition:null, revision:null, reviewed_at:null });
const SERVES_ICP = cap => ({ ...cap, schema_version:'1.13.0', schema_versions:[...(cap.schema_versions ?? []), '1.13.0'], features:{ ...cap.features, icp:true, research:true }, research:{ kinds:['search','question'], per_day:{ search:10, question:5 } } });
const REGISTERED = [...DIRECTIVE.objectives,
  { key:'weekly_builders', label:'Builders making trusted reads this week', target:300, unit:'builders', window:'week', timezone:'UTC', latest:null, availability:'unreported' },
  { key:'conversations_held', label:'Conversations held with commercial leaders', target:4, unit:'conversations', window:'fortnight', timezone:'UTC', latest:null, availability:'unreported' }];
const WEB = Object.freeze({
  property:'legibility', measurement_id:'G-SYNTHETIC1', through:'2026-10-18', days:28, events:null, rows:[], coverage:{ complete:false, reason:'synthetic', dates:null },
  daily:[{ date:'2026-10-05', sessions:4, users:3, pageviews:6, key_events:0 }, { date:'2026-10-12', sessions:2, users:2, pageviews:2, key_events:0 },
    { date:'2026-10-17', sessions:5, users:4, pageviews:9, key_events:1 }, { date:'2026-10-18', sessions:1, users:null, pageviews:null, key_events:null }],
  health:{ as_of:'2026-10-18', verdict:'ok', flags:['admin_unverified'], line:'Reading fine. Wiring not checked, because the Admin API is off.' },
});

function outbox(t) {
  const dir = mkdtempSync(join(tmpdir(), 'growth-legibility-signals-'));
  const db = new Outbox(join(dir, 'outbox.sqlite'));
  t.after(() => { try { db.close(); } catch {} try { rmSync(dir, { recursive:true, force:true, maxRetries:5, retryDelay:100 }); } catch {} });
  return db;
}
async function run(t, env, extra = {}) {
  const result = await operate({ client:controlCenter({ token:env.token, base:env.base, testMode:true }), outbox:outbox(t), policy:policy(), corpusSha:'a'.repeat(64), at:AT,
    invocation:'local0signals', synthetic:true, revision:'f'.repeat(40), clock:() => '2026-10-19T05:11:00Z', ...extra });
  return { ...result, stored:env.reports.get(result.summary.run_id) };
}
const reasons = report => report.holds.map(h => h.reason);

test("the buyer is read only when served, judged by the snapshot rule, and only ever as Legibility's own", () => {
  assert.deepEqual(readIcp({ icp:ICP }, { icp:false }, AT), { icp:null, state:'not_served', reason:'icp_not_served' });
  assert.deepEqual(readIcp({}, { icp:true }, AT), { icp:null, state:'unread', reason:'icp_unread' }, 'left out of the directive is unknown, never missing');
  assert.equal(readIcp({ icp:ICP }, { icp:true }, AT).state, 'approved');
  assert.equal(readIcp({ icp:MISSING }, { icp:true }, AT).state, 'missing');
  for (const [why, icp] of [
    ['another product', { ...ICP, product_slug:'mindmake' }], ['another source', { ...ICP, source:'corpus' }], ['a missing one for another product', { ...MISSING, product_slug:'heartside' }],
    ['an unknown field', { ...ICP, extra:1 }], ['a field left out', (({ revision, ...rest }) => rest)(ICP)], ['reviewed after the run clock', { ...ICP, reviewed_at:'2026-10-20T00:00:00.000Z' }],
    ['an approved one with no words', { ...ICP, buyer_definition:null }], ['a proposed one', { ...ICP, status:'proposed' }],
  ]) assert.equal(readIcp({ icp }, { icp:true }, AT).state, 'refused', why);
  // Bound to a snapshot only when reviewed by its capture; otherwise the snapshot carries a missing buyer, which holds.
  const snap = json('../fixtures/snapshot.json');
  const bound = applyIcp(snap, ICP);
  assert.deepEqual([bound.snapshot.icp, bound.reason], [ICP, null]);
  assert.notEqual(bound.snapshot, snap, 'the input is not changed');
  const late = applyIcp(snap, { ...ICP, reviewed_at:'2026-10-18T13:00:00.000Z' });
  assert.deepEqual([late.snapshot.icp, late.reason], [{ status:'missing' }, 'icp_reviewed_after_capture']);
});

test('a held run with the approved buyer served no longer holds icp_not_current_approved; served nothing, it is byte for byte as before', async t => {
  const plain = await run(t, await standIn(t, { directive:{ ...DIRECTIVE, icp:ICP } }));
  assert.deepEqual(reasons(plain.stored), ['source_snapshot_missing', 'icp_not_current_approved'], 'not served: the buyer in the directive is never read');
  assert.equal(plain.summary.icp.state, 'not_served');
  const baseline = heldEngineReport({ runId:plain.summary.run_id, at:new Date(AT).toISOString(), revision:'f'.repeat(40), mode:'synthetic', policy:policy(), directive:{ ...DIRECTIVE, icp:ICP } });
  assert.deepEqual(plain.stored, baseline, 'the report a Control Center without 1.13.0 gets is the one sent before');

  const env = await standIn(t, { directive:{ ...DIRECTIVE, icp:ICP }, capabilities:SERVES_ICP });
  const served = await run(t, env);
  assert.deepEqual(reasons(served.stored), ['source_snapshot_missing']);
  assert.match(served.stored.activity.map(a => a.line).join(' '), /The approved buyer did, from Control Center product_icp \(revision cccccccccccc, reviewed 2026-10-18T09:00:00\.000Z\)/);
  assert.equal(served.stored.proposals[0].title, 'Connect the app snapshot export to this runner');
  assert.deepEqual(served.summary.icp, { state:'approved', reason:null, revision:ICP.revision });
  // Its words never reach the printed summary.
  assert.doesNotMatch(JSON.stringify(served.summary), /Synthetic commercial leaders|Head of Data/);

  // An approved buyer reviewed long ago is still the buyer (Ruling, Krish, 2026-10-28).
  const old = await run(t, await standIn(t, { directive:{ ...DIRECTIVE, icp:{ ...ICP, reviewed_at:'2025-01-01T00:00:00.000Z' } }, capabilities:SERVES_ICP }));
  assert.ok(!reasons(old.stored).includes('icp_not_current_approved'));
  for (const icp of [MISSING, { ...ICP, product_slug:'mindmake' }]) {
    const held = await run(t, await standIn(t, { directive:{ ...DIRECTIVE, icp }, capabilities:SERVES_ICP }));
    assert.ok(reasons(held.stored).includes('icp_not_current_approved'), `${icp.status} ${icp.reviewed_at} ${icp.product_slug}: missing, or another product's buyer, still holds`);
  }
  const unread = await run(t, await standIn(t, { capabilities:SERVES_ICP }));
  assert.ok(reasons(unread.stored).includes('icp_not_current_approved'));
  assert.equal(unread.summary.icp.state, 'unread');
});

test("with a snapshot, Control Center's buyer replaces the snapshot's: a missing one holds prospecting even over an approved fixture", async t => {
  const snapshot = json('../fixtures/snapshot.json');
  const asIs = await run(t, await standIn(t), { loadSnapshot:() => structuredClone(snapshot), at:'2026-10-18T12:00:00Z', clock:() => '2026-10-18T12:00:00Z' });
  assert.ok(!reasons(asIs.stored).includes('icp_not_current_approved'), 'not served: the snapshot keeps its own buyer, as before');
  const missing = await run(t, await standIn(t, { directive:{ ...DIRECTIVE, icp:MISSING }, capabilities:SERVES_ICP }),
    { loadSnapshot:() => structuredClone(snapshot), at:'2026-10-18T12:00:00Z', clock:() => '2026-10-18T12:00:00Z' });
  assert.ok(reasons(missing.stored).includes('icp_not_current_approved'));
  assert.equal(missing.privateReport.actions.filter(a => a.status === 'pending_human').length, 0, 'no invitation without the buyer');
  const approved = await run(t, await standIn(t, { directive:{ ...DIRECTIVE, icp:{ ...ICP, reviewed_at:'2026-10-18T09:00:00.000Z' } }, capabilities:SERVES_ICP }),
    { loadSnapshot:() => structuredClone(snapshot), at:'2026-10-18T12:00:00Z', clock:() => '2026-10-18T12:00:00Z' });
  assert.ok(!reasons(approved.stored).includes('icp_not_current_approved'));
});

test('weekly_builders and conversations_held are objectives only once the directive lists them registered, in the window the reader checks', async t => {
  assert.deepEqual(registeredObjectives(DIRECTIVE), { weekly_builders:false, conversations_held:false });
  const r = buildReport(json('../fixtures/snapshot.json'), policy(), '2026-10-18T12:00:00Z', 'a'.repeat(64));
  const runId = protocolRunId('run', r.observed_at, r.run_id.slice(3, 19));
  const before = engineReport(r, { runId, directive:DIRECTIVE });
  assert.deepEqual(before.objectives.map(o => o.key), ['activated', 'returning', 'net'], 'unregistered: exactly the three, as before');
  const after = engineReport(r, { runId, directive:{ ...DIRECTIVE, objectives:REGISTERED } });
  assert.deepEqual(after.objectives.map(o => o.key), ['activated', 'returning', 'net', 'weekly_builders', 'conversations_held']);
  const wb = after.objectives.find(o => o.key === 'weekly_builders');
  assert.equal(wb.value, r.scorecard.metrics.weekly_builders.value);
  assert.equal(wb.window_start, r.scorecard.north_star.weekly_builders_window.week_start);
  assert.equal(wb.window_start, '2026-10-12T00:00:00.000Z', 'Monday 00:00 UTC of the ISO week');
  assert.equal(wb.availability, wb.value === null ? 'missing' : 'measured');
  const held = after.objectives.find(o => o.key === 'conversations_held');
  assert.deepEqual([held.value, held.availability], [null, 'missing']);
  assert.match(held.reason, /^calendar_read_missing/);
  // A held run reports both too, unknown with the reason, never zero.
  const run1 = await run(t, await standIn(t, { directive:{ ...DIRECTIVE, objectives:REGISTERED } }));
  const objs = Object.fromEntries(run1.stored.objectives.map(o => [o.key, o]));
  assert.deepEqual([objs.weekly_builders.value, objs.weekly_builders.availability, objs.weekly_builders.window_start], [null, 'missing', '2026-10-19T00:00:00.000Z']);
  assert.equal(objs.conversations_held.value, null);
});

test('legibility.io traffic reads from the directive, with each figure said with the days read, and unknown said as unknown', () => {
  assert.deepEqual(siteActivity(undefined), []);
  assert.deepEqual(siteActivity({ ...WEB, property:'site' }), [], 'only its own site');
  const [line] = siteActivity(WEB);
  assert.equal(line.line, 'legibility.io traffic, from Google Analytics through Control Center: 8 sessions (3 of 7 days read) in the 7 days to 2026-10-18, against 4 sessions (1 of 7 days read) the 7 days before. Site check 2026-10-18: Reading fine. Wiring not checked, because the Admin API is off.');
  assert.doesNotMatch(line.line, /G-SYNTHETIC1/, 'the measurement id is never printed');
  assert.match(siteActivity({ ...WEB, daily:null })[0].line, /unknown\. Control Center did not send the daily totals today\./);
  assert.match(siteActivity({ ...WEB, daily:[] })[0].line, /unknown\. No daily totals are on file/);
  assert.match(siteActivity({ ...WEB, daily:[{ date:'2026-10-18', sessions:null }] })[0].line, /unknown \(no day read\) in the 7 days/);
});

test('the research desk is recorded as available and never asked: no research step runs before Phase 2', async t => {
  assert.deepEqual(researchAvailability({ research:false }, { kinds:['search'] }), { state:'not_served', kinds:[], per_day:{} });
  const env = await standIn(t, { directive:{ ...DIRECTIVE, web_analytics:WEB }, capabilities:SERVES_ICP });
  const { summary, stored } = await run(t, env);
  assert.deepEqual(summary.research, { state:'served', kinds:['search', 'question'], per_day:{ search:10, question:5 } });
  assert.equal(env.log.filter(l => l.route?.startsWith('/research')).length, 0, 'nothing is asked of the desk');
  assert.ok(stored.activity.some(a => a.line.startsWith('legibility.io traffic')), 'the site line rides in a held run too');
});

test("the workflow's export default is the app's A4 route on the pinned origin, and the engine's bearer is only the fallback", () => {
  const operateYml = readFileSync(new URL('../.github/workflows/operate.yml', import.meta.url), 'utf8');
  const url = /LEGIBILITY_EXPORT_URL: \$\{\{ vars\.LEGIBILITY_EXPORT_URL \|\| '([^']+)' \}\}/.exec(operateYml)?.[1];
  assert.equal(url, 'https://legibility.io/api/internal/growth/export');
  const pinned = exportUrl(url);
  assert.deepEqual([pinned.url.origin, pinned.local], [EXPORT_ORIGIN, false]);
  assert.match(operateYml, /LEGIBILITY_EXPORT_TOKEN: \$\{\{ secrets\.LEGIBILITY_EXPORT_TOKEN \|\| secrets\.CONTROL_CENTER_ENGINE_TOKEN \}\}/, 'a dedicated secret wins when Krish adds one');
});
