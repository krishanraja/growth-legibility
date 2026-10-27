// The runner's read of each person's Mindmake record from Control Center (protocol 1.11.0, src/lib/prior-outreach.mjs).
// Offline: every receiver is the loopback stand-in (tests/standin.mjs), and each journal lives under the OS temp directory.
// Synthetic only: no real person, address or contact id. Contact ids here are made-up uuids of zeros and a counter.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validateCandidate, validateDirective, capturedBy } from '../src/guards/wire.mjs';
import { Outbox } from '../src/outbox.mjs';
import { controlCenter } from '../src/transport.mjs';
import { operate } from '../src/operate.mjs';
import { readPriorMindmake, personLink, MAX_PRIOR_OUTREACH_BATCHES } from '../src/lib/prior-outreach.mjs';
import { standIn, TOKEN, DIRECTIVE, UNKNOWN_RECORD, personLink as standInLink } from './standin.mjs';

const json = path => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const fixture = () => json('../fixtures/snapshot.json');
const policy = () => json('../config/policy.json');
const contactId = n => `00000000-0000-4000-8000-${n.toString(16).padStart(12, '0')}`;
const NONE = id => ({ state:'none', by:null, state_at:null, last_touch_at:null, record_url:personLink(id) });
const SENT = id => ({ state:'sent', by:'krish', state_at:'2026-09-01T10:00:00.000Z', last_touch_at:'2026-09-02T10:00:00.000Z', record_url:personLink(id) });

// Windows will not delete a file that is still open, and a throwing after() hook skips the rest (F27): the journal closes
// first, and removal retries and never throws.
function outbox(t) {
  const dir = mkdtempSync(join(tmpdir(), 'growth-legibility-prior-'));
  const db = new Outbox(join(dir, 'outbox.sqlite'));
  t.after(() => { try { db.close(); } catch {} try { rmSync(dir, { recursive:true, force:true, maxRetries:5, retryDelay:100 }); } catch {} });
  return db;
}
const client = env => controlCenter({ token:env.token, base:env.base, testMode:true });
async function run(t, env, snapshot = fixture()) {
  return operate({ client:client(env), outbox:outbox(t), policy:policy(), corpusSha:'a'.repeat(64), at:'2026-10-19T05:10:00Z',
    invocation:'local0prior', revision:'f'.repeat(40), clock:() => '2026-10-19T05:11:00Z', loadSnapshot:() => snapshot });
}
// A snapshot of n candidates, each the fixture's candidate under its own id and contact id, citing its own record.
function many(n) {
  const s = fixture(), [base] = s.candidates;
  s.candidates = Array.from({ length:n }, (_, i) => {
    const c = structuredClone(base), id = contactId(i + 1);
    c.id = `candidate-${i + 1}`; c.contact.contact_id = id; c.contact.prior_mindmake = NONE(id);
    c.draft.source_refs = [c.current_signal.url, personLink(id)];
    return c;
  });
  return s;
}
const send = report => report.actions.filter(a => a.status === 'pending_human');
const holdCodes = report => report.holds.map(h => h.code);

test('the record Control Center serves is copied unchanged, and the invitation reaches Krish with it', async t => {
  const [{ contact }] = fixture().candidates;
  const id = contact.contact_id;
  assert.equal(standInLink(id), personLink(id));
  const env = await standIn(t, { priorOutreach:{ [id]:NONE(id) } });
  // Control Center serves 1.11.0, and this engine, which sends 1.0.0, takes it.
  assert.deepEqual(await client(env).capabilities(), { activation:'active', features:{ prior_outreach:true } });
  assert.doesNotThrow(() => validateDirective({ ...DIRECTIVE, schema_version:'1.11.0' }));
  const input = fixture();
  delete input.candidates[0].contact.prior_mindmake;
  const before = structuredClone(input);
  const { snapshot, summary } = await readPriorMindmake(client(env), input);
  assert.deepEqual(input, before, 'the input is never changed');
  assert.deepEqual(snapshot.candidates[0].contact.prior_mindmake, NONE(id));
  assert.deepEqual(env.priorOutreachReads, [[id]]);
  assert.deepEqual(summary, { state:'read', reason:null, candidates:1, unlinked:0, contacts:1, copied:1, refused:0, unread:0 });
  // End to end: the run reads the record, prepares the invitation with it and binds the contact id into the approval.
  const none = await standIn(t, { priorOutreach:{ [id]:NONE(id) } });
  const { summary:plain, privateReport:report } = await run(t, none, input);
  assert.equal(plain.status, 'succeeded'); assert.equal(plain.prior_outreach.state, 'read');
  const [packet] = send(report);
  assert.deepEqual(packet.candidate.contact.prior_mindmake, NONE(id));
  assert.equal(packet.candidate.contact.contact_id, id);
  assert.equal(none.reports.get(plain.run_id).proposals.find(p => p.wall === 'send').evidence[0].url, personLink(id));
  // The printed summary carries counts and codes only: no contact id, record link or bearer.
  const printed = JSON.stringify(plain);
  for (const secret of [id, 'controlcenter.krishraja.com', TOKEN]) assert.ok(!printed.includes(secret), secret);
});

test('a failed read, a missing route or no capability leaves the record unknown, and the invitation is held', async t => {
  for (const [options, reason, asked] of [
    [{ priorOutreach:{}, priorOutreachStatus:500 }, 'prior_outreach_unavailable', 1],
    [{ priorOutreach:{}, priorOutreachStatus:404 }, 'prior_outreach_not_supported', 1],
    [{ priorOutreach:{}, priorOutreachStatus:429 }, 'receiver_rate_limited', 1],
    [{ priorOutreach:() => ({ ok:true, schema_version:'1.11.0', prior_outreach:[] }) }, 'prior_outreach_invalid', 1],
    [{ priorOutreach:() => ({ ok:false }) }, 'prior_outreach_invalid', 1],
    [{ priorOutreach:() => ({ ok:true, schema_version:'2.0.0', prior_outreach:{} }) }, 'prior_outreach_invalid', 1],
    [{}, 'prior_outreach_not_served', 0],
  ]) {
    const env = await standIn(t, options);
    // The fixture already carries a `none` record. Only the reader may say none, so a failed read drops it.
    const { summary, privateReport } = await run(t, env);
    assert.equal(summary.status, 'succeeded', reason);
    assert.equal(summary.prior_outreach.state, 'unavailable', reason);
    assert.equal(summary.prior_outreach.reason, reason);
    assert.equal(env.priorOutreachReads.length, asked, reason);
    assert.equal(send(privateReport).length, 0, reason);
    assert.ok(holdCodes(privateReport).includes('mindmake_history_unknown'), reason);
    assert.ok(!JSON.stringify(privateReport.actions).includes('"state":"none"'), reason);
    assert.ok(!env.reports.get(summary.run_id).proposals.some(p => p.wall === 'send'), reason);
  }
});

test('a malformed record is refused and stays unknown, while a good record in the same read is copied', async t => {
  const s = many(8);
  const ids = s.candidates.map(c => c.contact.contact_id);
  const bad = [
    { ...NONE(ids[1]), note:'extra key' },
    { ...SENT(ids[2]), by:null },
    null,
    { ...SENT(ids[4]), state_at:'2026-10-18T12:00:01.000Z', last_touch_at:'2026-10-18T12:00:01.000Z' },
    NONE(ids[0]),
    { ...NONE(ids[6]), record_url:`http://controlcenter.krishraja.com/#/people?person=${ids[6]}` },
    { ...NONE(ids[7]), state:'reached' },
  ];
  const served = Object.fromEntries([[ids[0], NONE(ids[0])], ...bad.map((record, i) => [ids[i + 1], record])]);
  const env = await standIn(t, { priorOutreach:asked => ({ ok:true, schema_version:'1.11.0', read_at:'2026-10-19T05:10:30.000Z', prior_outreach:Object.fromEntries(asked.map(id => [id, served[id]])) }) });
  const { snapshot, summary } = await readPriorMindmake(client(env), s);
  assert.deepEqual(snapshot.candidates[0].contact.prior_mindmake, NONE(ids[0]));
  // Extra key, a sent note with no sender, null, dated after capture, another person's link, plain http, an unknown state.
  for (const c of snapshot.candidates.slice(1)) assert.equal(Object.hasOwn(c.contact, 'prior_mindmake'), false, c.id);
  assert.deepEqual({ state:summary.state, reason:summary.reason, copied:summary.copied, refused:summary.refused }, { state:'partial', reason:'prior_outreach_record_refused', copied:1, refused:7 });
  // What is copied always passes the wire, so a refused record can never take the whole snapshot down.
  for (const c of snapshot.candidates) assert.doesNotThrow(() => validateCandidate(c, capturedBy(snapshot.captured_at)));
  // An id Control Center leaves out of its answer is unread, never none.
  const partial = await standIn(t, { priorOutreach:asked => ({ ok:true, schema_version:'1.11.0', read_at:'2026-10-19T05:10:30.000Z', prior_outreach:{ [asked[0]]:NONE(asked[0]) } }) });
  const out = await readPriorMindmake(client(partial), many(3));
  assert.deepEqual(out.snapshot.candidates.map(c => c.contact.prior_mindmake?.state ?? 'absent'), ['none', 'absent', 'absent']);
  assert.equal(out.summary.unread, 2);
  // Control Center's own unknown is copied as it is, and prepare holds it.
  const unknown = await standIn(t, { priorOutreach:{} });
  const { summary:ran, privateReport } = await run(t, unknown);
  assert.equal(ran.prior_outreach.state, 'read');
  assert.ok(holdCodes(privateReport).includes('mindmake_history_unknown'));
  assert.equal(send(privateReport).length, 0);
  assert.deepEqual(UNKNOWN_RECORD, { state:'unknown', by:null, state_at:null, last_touch_at:null, record_url:null });
});

test('contact ids are read in batches of at most 50, each id once, up to the batch cap', async t => {
  const records = Object.fromEntries(Array.from({ length:260 }, (_, i) => [contactId(i + 1), NONE(contactId(i + 1))]));
  const env = await standIn(t, { priorOutreach:records });
  const s = many(120);
  // Two candidates naming one contact are asked about once and both get the record.
  s.candidates[119].contact.contact_id = s.candidates[0].contact.contact_id;
  s.candidates[119].contact.prior_mindmake = NONE(s.candidates[0].contact.contact_id);
  const { snapshot, summary } = await readPriorMindmake(client(env), s);
  assert.deepEqual(env.priorOutreachReads.map(b => b.length), [50, 50, 19]);
  assert.equal(new Set(env.priorOutreachReads.flat()).size, 119);
  assert.ok(env.priorOutreachReads.every(b => b.every((id, i) => i === 0 || b[i - 1] < id)));
  assert.equal(summary.state, 'read'); assert.equal(summary.copied, 120); assert.equal(summary.contacts, 119);
  assert.deepEqual(snapshot.candidates[119].contact.prior_mindmake, NONE(s.candidates[0].contact.contact_id));
  // Past the cap the rest stay unknown, named, and never asked.
  const capped = await standIn(t, { priorOutreach:records });
  const big = await readPriorMindmake(client(capped), many(230));
  assert.equal(capped.priorOutreachReads.length, MAX_PRIOR_OUTREACH_BATCHES);
  assert.ok(capped.priorOutreachReads.every(b => b.length <= 50));
  assert.deepEqual({ state:big.summary.state, reason:big.summary.reason, copied:big.summary.copied, unread:big.summary.unread }, { state:'partial', reason:'prior_outreach_batch_cap', copied:200, unread:30 });
  assert.equal(big.snapshot.candidates.filter(c => !c.contact.prior_mindmake).length, 30);
  // The client never sends a read Control Center would refuse.
  const c = client(env);
  for (const ids of [[], Array.from({ length:51 }, (_, i) => contactId(i + 1)), [contactId(1), contactId(1)], ['Not-A-Uuid'], ['abcdef00-0000-4000-8000-000000000001'.toUpperCase()]]) {
    await assert.rejects(c.priorOutreach(ids), { code:'prior_outreach_request_invalid' });
  }
  assert.equal(env.priorOutreachReads.length, 3);
});

test('a candidate without a contact id is never asked about and holds as unknown, whatever record it arrived with', async t => {
  const env = await standIn(t, { priorOutreach:{ [contactId(1)]:NONE(contactId(1)) } });
  const s = fixture();
  delete s.candidates[0].contact.contact_id;
  const { snapshot, summary } = await readPriorMindmake(client(env), s);
  assert.equal(Object.hasOwn(snapshot.candidates[0].contact, 'prior_mindmake'), false);
  assert.deepEqual({ state:summary.state, reason:summary.reason, unlinked:summary.unlinked }, { state:'unlinked', reason:'contact_id_missing', unlinked:1 });
  assert.equal(env.log.filter(x => x.route === '/prior-outreach' || x.route === '/capabilities').length, 0);
  const { summary:ran, privateReport } = await run(t, env, s);
  assert.equal(ran.prior_outreach.state, 'unlinked');
  assert.ok(holdCodes(privateReport).includes('mindmake_history_unknown'));
  assert.equal(send(privateReport).length, 0);
  assert.equal(env.priorOutreachReads.length, 0);
  // Linked and unlinked side by side: only the linked one is read, and only it can reach Krish.
  const mixed = many(2);
  delete mixed.candidates[1].contact.contact_id;
  const both = await readPriorMindmake(client(env), mixed);
  assert.deepEqual(both.snapshot.candidates.map(c => c.contact.prior_mindmake?.state ?? 'absent'), ['none', 'absent']);
  assert.equal(both.summary.unlinked, 1);
});

test('the contact id is a lowercase uuid or absent, never a name, an address, an uppercase id or null', () => {
  const [base] = fixture().candidates;
  const before = capturedBy('2026-10-18T12:00:00Z');
  assert.doesNotThrow(() => validateCandidate(structuredClone(base), before));
  const without = structuredClone(base); delete without.contact.contact_id;
  assert.doesNotThrow(() => validateCandidate(without, before));
  for (const value of [null, '', 'Synthetic Person', 'person@example.com', 'abcdef00-0000-4000-8000-000000000001'.toUpperCase(), `${base.contact.contact_id} `, 42, '00000000-0000-4000-8000-00000000000']) {
    const c = structuredClone(base); c.contact.contact_id = value;
    assert.throws(() => validateCandidate(c, before), /invalid_contract:candidate_contact_id/, String(value));
  }
});
