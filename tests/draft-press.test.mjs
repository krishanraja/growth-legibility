// Control Center's Draft press (protocol 1.12.0; Ruling, Krish, 2026-10-27: "Legibility drafts land in Krish's mindmake.co
// mailbox, and the press re-reads the Mindmake record first"): each approved invitation travels as a version 2 email action
// when, and only when, Control Center serves the press. Offline: every receiver is the loopback stand-in (tests/standin.mjs),
// whose report reading and press checks are ported from Control Center. Synthetic only: no real person, address or id.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { sha256, canonical, validateEngineEnvelope, validateEngineReport, DRAFT_PRESS_VERSION, VERSION } from '../src/guards/wire.mjs';
import { buildReport, engineReport, protocolRunId } from '../src/orchestrator.mjs';
import { Outbox } from '../src/outbox.mjs';
import { controlCenter, deliver } from '../src/transport.mjs';
import { operate } from '../src/operate.mjs';
import { emailAction, gitBlobSha, splitSubject, templateRevision, TEMPLATE_SOURCE } from '../src/lib/draft-press.mjs';
import { standIn, schemaErrors, REPORT_SCHEMA, DIRECTIVE, ccPress, ccProposalRefusal, CC_VERSIONS } from './standin.mjs';

const json = path => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const policy = () => json('../config/policy.json');
const AT = '2026-10-18T12:00:00Z';
const SUBJECT = '30-day free beta trial of Legibility for Synthetic Commerce Lab';
const TEMPLATE = fileURLToPath(new URL(`../${TEMPLATE_SOURCE.path}`, import.meta.url));
// The fixture's approved words under the template's subject line, as a drafted invitation carries them.
function fixture({ subject = true } = {}) {
  const s = json('../fixtures/snapshot.json');
  if (subject) s.candidates[0].draft.text = `Subject: ${SUBJECT}\n\n${s.candidates[0].draft.text}\n`;
  return s;
}
const [{ contact:CONTACT }] = json('../fixtures/snapshot.json').candidates;
const ID = CONTACT.contact_id;

// Windows will not delete a file that is still open, and a throwing after() hook skips the rest (F27): the journal closes
// first, and removal retries and never throws.
function outbox(t) {
  const dir = mkdtempSync(join(tmpdir(), 'growth-legibility-press-'));
  const db = new Outbox(join(dir, 'outbox.sqlite'));
  t.after(() => { try { db.close(); } catch {} try { rmSync(dir, { recursive:true, force:true, maxRetries:5, retryDelay:100 }); } catch {} });
  return db;
}
const client = env => controlCenter({ token:env.token, base:env.base, testMode:true });
async function run(t, env, snapshot = fixture(), at = '2026-10-19T05:10:00Z') {
  const db = outbox(t);
  const result = await operate({ client:client(env), outbox:db, policy:policy(), corpusSha:'a'.repeat(64), at, invocation:'local0press',
    revision:'f'.repeat(40), clock:() => at, loadSnapshot:() => structuredClone(snapshot) });
  return { ...result, stored:env.reports.get(result.summary.run_id), db };
}
const sendOf = report => report.proposals.find(p => p.wall === 'send');
const shas = () => Object.fromEntries(templateRevision().map(r => [`${r.repo.toLowerCase()}:${r.path}`, r.sha]));
// A version 2 envelope built directly, and a way to change it and seal it again, to probe the wire.
const v2Envelope = (s = fixture()) => {
  const r = buildReport(s, policy(), AT, 'a'.repeat(64));
  return engineReport(r, { runId:protocolRunId('run', r.observed_at, r.run_id.slice(3, 19)), draftPress:{ source_revision:templateRevision() } });
};
function reseal(envelope, change) {
  const e = structuredClone(envelope); const p = sendOf(e);
  change(e, p);
  if (typeof p.exact_payload === 'string') p.payload_sha256 = sha256(p.exact_payload);
  const { payload_sha256:_old, ...body } = e;
  return { ...body, payload_sha256:sha256(body) };
}
const withAction = change => (e, p) => { const a = JSON.parse(p.exact_payload); change(a); p.exact_payload = canonical(a); };

test('a served Draft press sends the invitation as a version 2 email action that Control Center takes and its press drafts', async t => {
  const env = await standIn(t, { priorOutreach:{ [ID]:CONTACT.prior_mindmake }, draftPress:true });
  assert.deepEqual(await client(env).capabilities(), { activation:'active', features:{ prior_outreach:true, draft_press:true } });
  const { summary, stored } = await run(t, env);
  assert.equal(summary.status, 'succeeded');
  assert.deepEqual(summary.draft_press, { state:'served', reason:null, actions:1 });
  assert.equal(stored.schema_version, DRAFT_PRESS_VERSION);
  assert.deepEqual(schemaErrors(stored, REPORT_SCHEMA), []);
  validateEngineReport(stored);
  assert.equal(stored.proposals.filter(p => ccProposalRefusal(p, stored.schema_version)).length, 0);
  const send = sendOf(stored);
  const action = JSON.parse(send.exact_payload);
  // Exactly the shape the protocol names, the record copied unchanged from Control Center's reader.
  assert.deepEqual(Object.keys(action).sort(), ['body', 'channel', 'form', 'mailbox', 'prior_mindmake', 'recipient_contact_id', 'subject', 'version']);
  assert.deepEqual(action, { version:2, channel:'email', recipient_contact_id:ID, subject:SUBJECT, body:fixture({ subject:false }).candidates[0].draft.text,
    form:null, mailbox:'krish', prior_mindmake:CONTACT.prior_mindmake });
  // The approved words, unchanged: the subject line and the note, split at the first line.
  assert.equal(`Subject: ${action.subject}\n\n${action.body}\n`, fixture().candidates[0].draft.text);
  assert.equal(send.subject_ref, `contact:${ID}`);
  assert.equal(send.channel, 'email');
  assert.deepEqual(send.source_revision, [{ repo:'krishanraja/growth-legibility', path:'docs/OUTREACH-TEMPLATE.md', sha:gitBlobSha(readFileSync(TEMPLATE)) }]);
  assert.equal(send.payload_sha256, sha256(send.exact_payload));
  assert.equal(send.payload_sha256, sha256(action), 'the digest binds the whole action: recipient, subject, words, box and record');
  assert.match(send.why, /Control Center drafts these exact words into his own Gmail/);
  // Control Center's press, as ported: nothing held, one draft of exactly these words in his own box.
  assert.deepEqual(ccPress(send, { record:CONTACT.prior_mindmake, shas:shas() }), { draft:{ to:ID, subject:SUBJECT, body:action.body, mailbox:'krish' } });
  // Every other proposal is the same as at 1.0.0.
  const plain = engineReport(buildReport(fixture(), policy(), '2026-10-19T05:10:00.000Z', 'a'.repeat(64)), { runId:summary.run_id, directive:DIRECTIVE });
  assert.deepEqual(stored.proposals.filter(p => p.wall !== 'send'), plain.proposals.filter(p => p.wall !== 'send'));
});

test('without the Draft press served at 1.12.0, the engine sends 1.0.0 exactly as before', async t => {
  const unserved = [
    ['no feature', { priorOutreach:{ [ID]:CONTACT.prior_mindmake } }],
    ['feature off', { priorOutreach:{ [ID]:CONTACT.prior_mindmake }, draftPress:true, capabilities:c => ({ ...c, features:{ ...c.features, draft_press:false } }) }],
    ['served below 1.12.0', { priorOutreach:{ [ID]:CONTACT.prior_mindmake }, draftPress:true, capabilities:c => ({ ...c, schema_version:'1.11.0', schema_versions:CC_VERSIONS.slice(0, -1) }) }],
    ['1.12.0 not taken', { priorOutreach:{ [ID]:CONTACT.prior_mindmake }, draftPress:true, capabilities:c => ({ ...c, schema_versions:CC_VERSIONS.filter(v => v !== '1.12.0') }) }],
  ];
  for (const [name, options] of unserved) {
    const env = await standIn(t, options);
    assert.equal((await client(env).capabilities()).features.draft_press, false, name);
    const { summary, stored, privateReport } = await run(t, env);
    assert.equal(summary.status, 'succeeded', name);
    assert.deepEqual(summary.draft_press, { state:'not_served', reason:'draft_press_not_served', actions:1 }, name);
    // Byte for byte the envelope the engine built before the Draft press existed.
    assert.deepEqual(stored, engineReport(privateReport, { runId:summary.run_id, directive:DIRECTIVE }), name);
    assert.equal(stored.schema_version, VERSION, name);
    const send = sendOf(stored);
    assert.equal(send.exact_payload, fixture().candidates[0].draft.text, name);
    assert.equal(send.payload_sha256, sha256(send.exact_payload), name);
    assert.equal(Object.hasOwn(send, 'subject_ref') || Object.hasOwn(send, 'source_revision'), false, name);
  }
  // Served, but no invitation can be an email action (no subject line): 1.0.0, and nothing more is asked.
  const env = await standIn(t, { priorOutreach:{ [ID]:CONTACT.prior_mindmake }, draftPress:true });
  const plain = await run(t, env, fixture({ subject:false }));
  assert.deepEqual(plain.summary.draft_press, { state:'not_needed', reason:null, actions:0 });
  assert.equal(plain.stored.schema_version, VERSION);
  assert.equal(sendOf(plain.stored).exact_payload, fixture({ subject:false }).candidates[0].draft.text);
  // A 1.12.0 report never reaches a receiver that no longer takes it: refused before any write.
  const gone = await standIn(t, { priorOutreach:{ [ID]:CONTACT.prior_mindmake } });
  const db = outbox(t);
  const envelope = v2Envelope();
  db.put(envelope);
  await assert.rejects(deliver(db, envelope.run_id, { client:client(gone) }), { code:'receiver_contract_mismatch' });
  assert.equal(gone.posts(), 0);
});

test('a candidate without its contact id or Mindmake record never becomes a version 2 action, and the wire refuses one', async t => {
  const packet = buildReport(fixture(), policy(), AT, 'a'.repeat(64)).actions.find(a => a.status === 'pending_human');
  assert.equal(emailAction(packet).ok, true);
  const refused = change => { const p = structuredClone(packet); change(p); return emailAction(p).reason; };
  assert.equal(refused(p => { delete p.candidate.contact.contact_id; }), 'contact_id_missing');
  assert.equal(refused(p => { p.candidate.contact.contact_id = null; }), 'contact_id_missing');
  assert.equal(refused(p => { p.candidate.contact.prior_mindmake = null; }), 'prior_mindmake_missing');
  assert.equal(refused(p => { p.candidate.channel = 'linkedin'; }), 'not_email');
  assert.equal(refused(p => { p.exact_text = fixture({ subject:false }).candidates[0].draft.text; }), 'subject_missing');
  assert.equal(refused(p => { p.status = 'work_required'; }), 'not_an_invitation');
  assert.equal(refused(p => { p.candidate.contact.prior_mindmake = { ...p.candidate.contact.prior_mindmake, record_url:'https://controlcenter.krishraja.com/#/people?person=00000000-0000-4000-8000-000000000999' }; }), 'action_refused');
  assert.deepEqual(splitSubject('Subject:   \n\nWords.'), null);
  assert.deepEqual(splitSubject('Subject: One line\r\n\r\nThe words.\r\n'), { subject:'One line', body:'The words.' });
  // Through the runner: no contact id means no record is read, the invitation holds, and nothing travels at 1.12.0.
  const env = await standIn(t, { priorOutreach:{ [ID]:CONTACT.prior_mindmake }, draftPress:true });
  const s = fixture(); delete s.candidates[0].contact.contact_id;
  const { summary, stored, privateReport } = await run(t, env, s);
  assert.equal(summary.prior_outreach.state, 'unlinked');
  assert.ok(privateReport.holds.some(h => h.code === 'mindmake_history_unknown'));
  assert.equal(stored.proposals.some(p => p.wall === 'send'), false);
  assert.equal(stored.schema_version, VERSION);
  assert.deepEqual(summary.draft_press, { state:'not_needed', reason:null, actions:0 });
  // The wire refuses every action Control Center would hold as undeclared, unlinked or not his box, before it is posted.
  const e = v2Envelope();
  assert.doesNotThrow(() => validateEngineEnvelope(e));
  const cases = [
    ['no record', withAction(a => { delete a.prior_mindmake; }), /unknown_fields_action_v2|action_v2_shape/],
    ['a null record', withAction(a => { a.prior_mindmake = null; }), /unknown_fields_candidate_prior_mindmake/],
    ['no contact', withAction(a => { a.recipient_contact_id = null; }), /action_v2_recipient/],
    ['an unknown record', withAction(a => { a.prior_mindmake = { state:'unknown', by:null, state_at:null, last_touch_at:null, record_url:null }; }), /action_v2_basis/],
    ["Jonny's box", withAction(a => { a.mailbox = 'jonny'; }), /action_v2_mailbox/],
    ['no subject', withAction(a => { a.subject = null; }), /action_v2_subject/],
    ['an extra key', withAction(a => { a.to = 'someone'; }), /unknown_fields_action_v2/],
    ['another person', (_e, p) => { p.subject_ref = 'contact:00000000-0000-4000-8000-000000000999'; }, /engine_proposal_action_v2_subject/],
    ['no files', (_e, p) => { delete p.source_revision; }, /source_revision_count/],
    ['a Windows path', (_e, p) => { p.source_revision = [{ ...p.source_revision[0], path:'docs\\OUTREACH-TEMPLATE.md' }]; }, /source_revision_entry/],
    ['a short sha', (_e, p) => { p.source_revision = [{ ...p.source_revision[0], sha:'abc' }]; }, /source_revision_entry/],
    ['at 1.0.0', e2 => { e2.schema_version = VERSION; }, /engine_proposal_action_v2_needs_1_12_0|unknown_fields_engine_proposal/],
    ['as a work task', (_e, p) => { p.wall = 'none'; }, /engine_proposal_action_v2_send/],
  ];
  for (const [name, change, code] of cases) assert.throws(() => validateEngineEnvelope(reseal(e, change)), code, name);
  // A digest that does not bind the action, plain words carrying the 1.12.0 fields, and 1.12.0 for no action are refused too.
  const loose = structuredClone(e); sendOf(loose).payload_sha256 = sha256('other words');
  const { payload_sha256:_l, ...looseBody } = loose;
  assert.throws(() => validateEngineEnvelope({ ...looseBody, payload_sha256:sha256(looseBody) }), /engine_proposal_action_v2_digest/);
  assert.throws(() => validateEngineEnvelope(reseal(e, (_e, p) => { p.exact_payload = 'Plain words.'; })), /engine_proposal_v2_fields_without_action|engine_report_1_12_0_without_action_v2/);
  assert.throws(() => validateEngineEnvelope(reseal(e, (_e, p) => { p.exact_payload = 'Plain words.'; delete p.subject_ref; delete p.source_revision; })), /engine_report_1_12_0_without_action_v2/);
  // Control Center's own reading, as ported, refuses the malformed ones at the report too.
  assert.equal(ccProposalRefusal(sendOf(reseal(e, withAction(a => { a.subject = null; }))), DRAFT_PRESS_VERSION), 'action_subject');
  assert.equal(ccProposalRefusal(sendOf(e), '1.11.0'), 'basis_needs_1_12_0');
});

test('the digest is stable: the same approved words and record make the same action and digest on every run', async () => {
  const at = clock => { const r = buildReport(fixture(), policy(), clock, 'a'.repeat(64)); return sendOf(engineReport(r, { runId:'legibility:2026-10-18:run:x', draftPress:{ source_revision:templateRevision() } })); };
  const first = at('2026-10-18T12:00:00Z'), later = at('2026-10-18T13:00:00Z');
  assert.equal(later.exact_payload, first.exact_payload);
  assert.equal(later.payload_sha256, first.payload_sha256);
  assert.equal(later.proposal_id, first.proposal_id);
  // The order Control Center happens to send the record's keys in never moves the digest.
  const s = fixture(); const m = s.candidates[0].contact.prior_mindmake;
  s.candidates[0].contact.prior_mindmake = Object.fromEntries(Object.entries(m).reverse());
  assert.equal(sendOf(v2Envelope(s)).payload_sha256, first.payload_sha256);
  // The 1.0.0 form keeps its id and its digest: the frozen example is unchanged.
  const frozen = sendOf(json('../contracts/example-engine-report.json'));
  const plain = sendOf(engineReport(buildReport(fixture({ subject:false }), policy(), AT, json('../_corpus/manifest.json').sha256), { runId:'legibility:2026-10-18:run:y' }));
  assert.equal(plain.payload_sha256, frozen.payload_sha256);
  assert.equal(first.proposal_id, frozen.proposal_id, 'the same invitation keeps its id when it becomes an email action');
  // A changed word, or a changed record, is a new approval.
  const words = fixture(); words.candidates[0].draft.text = words.candidates[0].draft.text.replace('five-input', 'six-input');
  assert.notEqual(sendOf(v2Envelope(words)).payload_sha256, first.payload_sha256);
  const touched = fixture();
  touched.candidates[0].contact.prior_mindmake = { ...m, state:'sent', by:'krish', state_at:'2026-09-10T09:00:00Z', last_touch_at:'2026-09-12T09:00:00Z' };
  touched.candidates[0].draft.text = touched.candidates[0].draft.text.replace(`${SUBJECT}\n\n`, `${SUBJECT}\n\nI wrote to you in September about Mindmake. This is a separate note about Legibility, one of the products we build at Mindmake. `);
  const reached = sendOf(v2Envelope(touched));
  assert.notEqual(reached.payload_sha256, first.payload_sha256);
  assert.deepEqual(JSON.parse(reached.exact_payload).prior_mindmake, touched.candidates[0].contact.prior_mindmake);
  assert.deepEqual(ccPress(reached, { record:touched.candidates[0].contact.prior_mindmake, shas:shas() }).draft?.mailbox, 'krish');
});

test('source_revision is the git blob SHA of the template as GitHub serves it, on a forward-slash path, so a correct value is never unreadable', () => {
  // git hash-object vectors.
  assert.equal(gitBlobSha(Buffer.from('')), 'e69de29bb2d1d6434b8b29ae775ad8c2e48c5391');
  assert.equal(gitBlobSha(Buffer.from('hello world\n')), '3b18e512dba79e4c8300dd08aeb37f8e728b8dad');
  // .gitattributes stores text with LF, so a Windows checkout with CRLF hashes as git stored it; binary bytes stay as they are.
  assert.equal(gitBlobSha(Buffer.from('hello world\r\n')), '3b18e512dba79e4c8300dd08aeb37f8e728b8dad');
  assert.notEqual(gitBlobSha(Buffer.from('a\r\n\0')), gitBlobSha(Buffer.from('a\n\0')));
  const [rev] = templateRevision();
  assert.deepEqual(Object.keys(rev), ['repo', 'path', 'sha']);
  assert.equal(rev.repo, 'krishanraja/growth-legibility');
  assert.equal(rev.path, 'docs/OUTREACH-TEMPLATE.md');
  assert.ok(!rev.path.includes('\\'));
  assert.equal(rev.sha, gitBlobSha(readFileSync(TEMPLATE)));
  assert.equal(templateRevision(() => Buffer.from('hello world\r\n'))[0].sha, '3b18e512dba79e4c8300dd08aeb37f8e728b8dad');
  // Control Center's press, as ported: the same SHA is current; another is stale; a file it cannot read is unreadable.
  const send = sendOf(v2Envelope());
  assert.ok(ccPress(send, { record:CONTACT.prior_mindmake, shas:shas() }).draft);
  assert.deepEqual(ccPress(send, { record:CONTACT.prior_mindmake, shas:{ 'krishanraja/growth-legibility:docs/OUTREACH-TEMPLATE.md':'0'.repeat(40) } }), { hold:'stale' });
  assert.deepEqual(ccPress(send, { record:CONTACT.prior_mindmake, shas:{} }), { hold:'source_unreadable' });
  // And its record checks: a record that moved since the words were written holds, so the next run writes them again.
  assert.deepEqual(ccPress(send, { record:{ ...CONTACT.prior_mindmake, state:'open' }, shas:shas() }), { hold:'mindmake_thread_open' });
  assert.deepEqual(ccPress(send, { record:{ ...CONTACT.prior_mindmake, state:'sent', by:'krish', state_at:'2026-10-01T00:00:00Z', last_touch_at:'2026-10-01T00:00:00Z' }, shas:shas() }), { hold:'prior_outreach_changed' });
});
