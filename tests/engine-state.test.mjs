// Control Center protocol 1.20.0: Krish's instruction and the engine's state (Ruling, Krish, 2026-11-11). The run reads his
// instruction from the directive, puts it first and acks it by id, and reports its priorities, obsessions and next steps
// from this repository's own files, only when Control Center serves them. His words never reach the summary, the log or the
// report. Offline: every receiver is the loopback stand-in (tests/standin.mjs). Synthetic only.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  BY_RULE_LINE, CC_HELD_LINE, HELD_LINE, RECEIVED_LINE, deadlines, firstUnticked, fitLine, instructionAcks, ladderRung, nextStep, parseNorthStar,
  parseNowNext, parseObsessions, readInstruction, readRepoState, servesEngineState, stateFields,
} from '../src/lib/engine-state.mjs';
import { HOLD_REASON } from '../src/lib/hold.mjs';
import { ENGINE_STATE_VERSION, lineCarriesContact, sha256, validateEngineReport } from '../src/guards/wire.mjs';
import { buildReport, engineReport, protocolRunId, seal } from '../src/orchestrator.mjs';
import { Outbox } from '../src/outbox.mjs';
import { controlCenter } from '../src/transport.mjs';
import { operate } from '../src/operate.mjs';
import { standIn, schemaErrors, REPORT_SCHEMA, DIRECTIVE, ccEngineStateRefusal } from './standin.mjs';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const json = path => JSON.parse(readFileSync(new URL(path, import.meta.url)));
const policy = () => json('../config/policy.json');
const AT = '2026-10-18T12:00:00Z';
const ACTIVE = Object.freeze({ state:'active', reason:null });
const HELD = Object.freeze({ state:'held', reason:'local_flag_held' });
const HELD_RULE = 'Krish has held this engine until it is ready. Propose nothing and ask him nothing. Report one hold that names what stops you being ready and what would clear it.';
// A synthetic instruction. The words are a canary: they must never appear in a summary, a log line or a report.
const WORDS = 'SYNTHETIC-INSTRUCTION-CANARY: prepare one product test for a synthetic data buyer this week.';
const KI = `ki_${'a1'.repeat(12)}`;
const INSTRUCTION = Object.freeze({ id:KI, words:WORDS, given_at:'2026-10-18T09:00:00.000Z', given_by:'krish', supersedes:null });
const SERVED = Object.freeze({ engine_state:true, krish_instruction:true });
const directiveWith = (extra = {}) => ({ ...DIRECTIVE, schema_version:'1.20.0', features:{ ...SERVED }, krish_instruction:INSTRUCTION, ...extra });
const REPO = readRepoState(ROOT);

function tempDir(t) {
  const dir = mkdtempSync(join(tmpdir(), 'growth-legibility-state-'));
  t.after(() => { try { rmSync(dir, { recursive:true, force:true, maxRetries:5, retryDelay:100 }); } catch {} });
  return dir;
}
async function run(t, env, extra = {}) {
  const db = new Outbox(join(tempDir(t), 'outbox.sqlite'));
  t.after(() => { try { db.close(); } catch {} });
  const result = await operate({ client:controlCenter({ token:env.token, base:env.base, testMode:true }), outbox:db, policy:policy(), corpusSha:'a'.repeat(64), at:AT,
    invocation:'local0state', synthetic:true, revision:'f'.repeat(40), clock:() => AT, loadSnapshot:() => json('../fixtures/snapshot.json'), activation:ACTIVE, repo:REPO, ...extra });
  return { ...result, stored:env.reports.get(result.summary.run_id) };
}
function assertNoWords(env, result) {
  assert.ok(!JSON.stringify(result.summary).includes('CANARY'), 'the printed summary never carries his words');
  assert.ok(!JSON.stringify(result.stored ?? {}).includes('CANARY'), 'the report never carries his words');
  for (const entry of env.log) if (entry.method === 'POST') assert.ok(!entry.body.includes('CANARY'), `nothing this engine posts carries his words (${entry.route})`);
}

test('the instruction is read by its shape: present, none, unread, not served or refused, and never echoed but by id and digest', () => {
  const present = readInstruction(directiveWith());
  assert.equal(present.state, 'present');
  assert.equal(present.instruction.id, KI);
  assert.equal(present.instruction.words_sha256, sha256(WORDS));
  assert.deepEqual(readInstruction(directiveWith({ krish_instruction:null })), { instruction:null, state:'none', reason:null });
  assert.deepEqual(readInstruction({ ...DIRECTIVE }), { instruction:null, state:'not_served', reason:null }, 'a pre-1.20.0 directive');
  assert.equal(readInstruction(null).state, 'not_served');
  assert.deepEqual(readInstruction({ ...DIRECTIVE, features:{ ...SERVED } }), { instruction:null, state:'unread', reason:'instruction_unread' });
  for (const bad of [{ ...INSTRUCTION, id:'ki_short' }, { ...INSTRUCTION, words:'' }, { ...INSTRUCTION, words:'x'.repeat(2001) }, { ...INSTRUCTION, given_by:'someone' },
    { ...INSTRUCTION, extra:true }, { ...INSTRUCTION, supersedes:'nope' }, { ...INSTRUCTION, given_at:'yesterday' }, 'words', []]) {
    assert.deepEqual(readInstruction(directiveWith({ krish_instruction:bad })), { instruction:null, state:'refused', reason:'instruction_shape' }, JSON.stringify(bad).slice(0, 60));
  }
  assert.equal(servesEngineState(directiveWith(), { engine_state:true }), true);
  assert.equal(servesEngineState(directiveWith(), { engine_state:false }), false, 'the receiver must take 1.20.0 too');
  assert.equal(servesEngineState({ ...DIRECTIVE }, { engine_state:true }), false, 'and the directive must say so');
});

test('an instruction present, active: the report says 1.20.0, the first activity line names it by id, and the acks say received then blocked by rule', async t => {
  const env = await standIn(t, { engineState:true, directive:directiveWith() });
  const result = await run(t, env);
  const { summary, stored } = result;
  assert.equal(summary.status, 'succeeded');
  assert.equal(summary.activation.state, 'active');
  assert.deepEqual(schemaErrors(stored, REPORT_SCHEMA), []);
  assert.equal(ccEngineStateRefusal(stored, stored.schema_version), null, 'Control Center would take it');
  assert.equal(stored.schema_version, ENGINE_STATE_VERSION);
  assert.match(stored.activity[0].line, new RegExp(`^Received Krish's instruction ${KI} \\(given 2026-10-18, digest ${sha256(WORDS).slice(0, 12)}\\) and put it first\\.`));
  assert.deepEqual(stored.instruction_acks.map(a => [a.instruction_id, a.state, a.line, a.at]), [[KI, 'received', RECEIVED_LINE, '2026-10-18T12:00:00.000Z'], [KI, 'blocked', BY_RULE_LINE, '2026-10-18T12:00:00.000Z']]);
  assert.ok(!stored.holds.some(h => /instruction|received|blocked/i.test(`${h.reason} ${h.detail}`)), 'an ack never goes in holds');
  assert.ok(stored.proposals.length > 0, 'his instruction authorises nothing new: the proposals are exactly the walled ones the run prepares');
  for (const p of stored.proposals) assert.ok(!(p.exact_payload ?? '').includes('CANARY'));
  assert.equal(stored.priorities[0].rank, 1);
  assert.match(stored.priorities[0].line, /^Builders making trusted reads every week: \d+ this ISO week/);
  assert.equal(stored.obsessions.length, 3);
  assert.equal(stored.next_steps[0].waits_on, 'engine');
  assert.deepEqual(summary.instruction, { state:'present', reason:null, id:KI, words_sha256:sha256(WORDS), acks:['received', 'blocked'] });
  assert.deepEqual(summary.report.engine_state, { served:true, priorities:stored.priorities.length, obsessions:3, next_steps:stored.next_steps.length, instruction_acks:2 });
  assertNoWords(env, result);
});

test('no instruction open: the state still travels at 1.20.0, with no ack and no instruction line', async t => {
  const env = await standIn(t, { engineState:true, directive:directiveWith({ krish_instruction:null }) });
  const { summary, stored } = await run(t, env);
  assert.equal(summary.status, 'succeeded');
  assert.equal(stored.schema_version, ENGINE_STATE_VERSION);
  assert.equal(stored.instruction_acks, undefined);
  assert.ok(!stored.activity.some(a => /instruction ki_/.test(a.line)));
  assert.ok(stored.priorities.length >= 1 && stored.next_steps.length >= 1);
  assert.deepEqual(summary.instruction, { state:'none', reason:null, id:null, words_sha256:null, acks:[] });
});

test('before Control Center serves 1.20.0 nothing new travels: the report is exactly the one a run without the engine state sends', async t => {
  // The directive is the old one, and the receiver serves 1.12.0: no field, no line, no ack, the version as before.
  const before = await run(t, await standIn(t, { draftPress:true }));
  const without = await run(t, await standIn(t, { draftPress:true }), { repo:null });
  assert.equal(before.summary.status, 'succeeded');
  assert.deepEqual(before.stored, without.stored, 'the repository state changes nothing until it is served');
  for (const k of ['priorities', 'obsessions', 'next_steps', 'instruction_acks']) assert.equal(before.stored[k], undefined, k);
  // A directive that carries an instruction to a receiver that does not take 1.20.0 is still not acked.
  const mixed = await run(t, await standIn(t, { draftPress:true, directive:directiveWith() }));
  assert.equal(mixed.summary.status, 'succeeded');
  assert.equal(mixed.stored.instruction_acks, undefined);
  assert.notEqual(mixed.stored.schema_version, ENGINE_STATE_VERSION);
  assert.equal(mixed.summary.instruction.state, 'present');
  assert.deepEqual(mixed.summary.instruction.acks, [], 'not served, so not acked');
});

test('held by the local flag with an instruction: received, then blocked "engine held", in a held report with one hold and no proposal', async t => {
  const env = await standIn(t, { engineState:true, directive:directiveWith() });
  const result = await run(t, env, { activation:HELD });
  const { summary, stored } = result;
  assert.equal(summary.status, 'succeeded');
  assert.deepEqual(summary.activation.by, ['krish_local']);
  assert.equal(stored.status, 'held');
  assert.deepEqual(stored.proposals, []);
  assert.deepEqual(stored.holds.map(h => h.reason), [HOLD_REASON], 'exactly one hold, and no ack in it');
  assert.equal(stored.schema_version, ENGINE_STATE_VERSION);
  assert.deepEqual(stored.instruction_acks.map(a => [a.state, a.line]), [['received', RECEIVED_LINE], ['blocked', HELD_LINE]]);
  assert.match(HELD_LINE, /^engine held/);
  assert.match(stored.activity[0].line, new RegExp(`^Received Krish's instruction ${KI} .*The engine is held, so it acted on nothing`));
  assert.ok(stored.priorities.length >= 1, 'what it chases is not an ask, so a held report keeps it');
  assert.deepEqual(schemaErrors(stored, REPORT_SCHEMA), []);
  assertNoWords(env, result);
  // Held with no snapshot at all, the held envelope carries the state and the acks too.
  const empty = await run(t, await standIn(t, { engineState:true, directive:directiveWith() }), { activation:HELD, loadSnapshot:null });
  assert.equal(empty.stored.status, 'held');
  assert.equal(empty.stored.schema_version, ENGINE_STATE_VERSION);
  assert.match(empty.stored.priorities[0].line, /not measured in this run/);
  assert.deepEqual(empty.stored.instruction_acks.map(a => a.line), [RECEIVED_LINE, HELD_LINE]);
});

test('held by Control Center: its directive carries no instruction, so nothing is acked, and the state still says where the engine is', async t => {
  const directive = directiveWith({ krish_instruction:null, next_action:{ proposal_id:null, instruction:HELD_RULE, why:'Krish held it: it is not ready yet.', close_condition:null } });
  const { summary, stored } = await run(t, await standIn(t, { engineState:true, directive }));
  assert.deepEqual(summary.activation.by, ['control_center']);
  assert.equal(stored.status, 'held');
  assert.equal(stored.instruction_acks, undefined);
  assert.equal(stored.schema_version, ENGINE_STATE_VERSION);
  // Defensively, an instruction that did arrive while Control Center holds the engine is acked blocked, naming that hold.
  assert.deepEqual(instructionAcks({ id:KI }, { by:['control_center'], at:AT }).map(a => a.line), [RECEIVED_LINE, CC_HELD_LINE]);
  assert.deepEqual(instructionAcks({ id:KI }, { by:['krish_local', 'control_center'], at:AT }).map(a => a.line), [RECEIVED_LINE, HELD_LINE]);
  assert.deepEqual(instructionAcks(null, { by:[], at:AT }), []);
});

test('a second wake the same day is a second run: its run_id and attempt differ, and both reports are stored', async t => {
  const env = await standIn(t, { engineState:true, directive:directiveWith() });
  const first = await run(t, env, { invocation:'gh101.1' });
  const second = await run(t, env, { invocation:'gh102.1' });
  const retry = await run(t, env, { invocation:'gh101.2' });
  assert.deepEqual([first, second, retry].map(r => r.summary.status), ['succeeded', 'succeeded', 'succeeded']);
  assert.equal(new Set([first, second, retry].map(r => r.summary.run_id)).size, 3);
  assert.equal(first.summary.run_id, protocolRunId('operate', AT, 'gh101.1'));
  assert.ok(env.reports.has(first.summary.run_id) && env.reports.has(second.summary.run_id) && env.reports.has(retry.summary.run_id));
  assert.equal(env.attempts.size, 3);
});

test('the wire takes the 1.20.0 fields only at 1.20.0, only in their shapes, and refuses an address or a phone number in a line', () => {
  const r = buildReport(json('../fixtures/snapshot.json'), policy(), AT, 'a'.repeat(64));
  const base = engineReport(r, { runId:protocolRunId('run', r.observed_at, r.run_id.slice(3, 19)), directive:DIRECTIVE });
  const { payload_sha256, ...body } = base;
  const STATE = { schema_version:ENGINE_STATE_VERSION, priorities:[{ rank:1, line:'Raise weekly builders.', objective_key:'weekly_builders' }],
    obsessions:[{ line:'"test and learn what works"', since:'2026-10-27' }], next_steps:[{ line:'Ship the attribution fields.', waits_on:'engine', when:null }],
    instruction_acks:[{ instruction_id:KI, state:'received', line:RECEIVED_LINE, at:'2026-10-18T12:00:00.000Z', evidence_url:null }] };
  const ok = seal({ ...body, ...STATE });
  assert.doesNotThrow(() => validateEngineReport(ok));
  assert.deepEqual(schemaErrors(ok, REPORT_SCHEMA), []);
  assert.equal(ccEngineStateRefusal(ok, ok.schema_version), null);
  assert.doesNotThrow(() => seal({ ...body, ...STATE, credits_spent:[{ pool:'twentyfirst', amount:2, asset:'one component draft', objective_key:null }] }), 'credits_spent rides along at 1.20.0');
  const refused = [
    [{ ...body, ...STATE, schema_version:'1.16.0' }, /engine_report_state_version|credits_spent_version/],
    [{ ...body, schema_version:ENGINE_STATE_VERSION }, /engine_report_state_version/],
    [{ ...body, ...STATE, priorities:[{ rank:6, line:'x', objective_key:null }] }, /engine_priority/],
    [{ ...body, ...STATE, priorities:Array.from({ length:6 }, (_, i) => ({ rank:1, line:`p${i}`, objective_key:null })) }, /engine_report_priorities/],
    [{ ...body, ...STATE, priorities:[{ rank:1, line:'Write to someone@example.com today.', objective_key:null }] }, /engine_priority/],
    [{ ...body, ...STATE, next_steps:[{ line:'Call +44 20 7946 0000 first.', waits_on:'krish', when:null }] }, /engine_next_step/],
    [{ ...body, ...STATE, next_steps:[{ line:'Two\nlines', waits_on:'krish', when:null }] }, /engine_next_step/],
    [{ ...body, ...STATE, next_steps:[{ line:'x', waits_on:'nobody', when:null }] }, /engine_next_step/],
    [{ ...body, ...STATE, obsessions:[{ line:'x'.repeat(201), since:null }] }, /engine_obsession/],
    [{ ...body, ...STATE, obsessions:[{ line:'x', since:'2026-02-30' }] }, /engine_obsession/],
    [{ ...body, ...STATE, instruction_acks:[{ ...STATE.instruction_acks[0], instruction_id:'legibility:x' }] }, /engine_instruction_ack/],
    [{ ...body, ...STATE, instruction_acks:[{ ...STATE.instruction_acks[0], state:'ignored' }] }, /engine_instruction_ack/],
    [{ ...body, ...STATE, instruction_acks:[{ ...STATE.instruction_acks[0], line:'x'.repeat(281) }] }, /engine_instruction_ack/],
    [{ ...body, ...STATE, instruction_acks:[{ ...STATE.instruction_acks[0], words:WORDS }] }, /unknown_fields_engine_instruction_ack/],
  ];
  for (const [bad, code] of refused) assert.throws(() => seal(bad), code, code.source);
  assert.equal(lineCarriesContact('300 by 28 December 2026, rung of 10'), false, 'a date and a count are not a number to call');
  assert.equal(lineCarriesContact('2026-11-11 10:00'), true, 'Control Center reads ten digits in a run as a phone number, so this boundary does too');
});

test('the obsessions are only Krish\'s own words, each standing word for word in the document it is quoted from', () => {
  const config = json('../config/engine-state.json');
  assert.ok(config.obsessions.length >= 1 && config.obsessions.length <= 3);
  for (const o of config.obsessions) {
    const source = readFileSync(join(ROOT, o.source), 'utf8').replace(/\s+/g, ' ');
    assert.ok(source.includes(o.quote), `${o.source} carries the quote word for word`);
    assert.match(source, /Krish/, `${o.source} attributes it to Krish`);
    assert.ok(`"${o.quote}"`.length <= 200, 'it fits a line whole, never cut');
  }
  assert.deepEqual(parseObsessions(JSON.stringify(config)).map(o => o.line), config.obsessions.map(o => `"${o.quote}"`));
  assert.equal(parseObsessions('{'), null);
});

test('the state is read from this repository\'s own files: the North Star block, the first unticked phase item and NOW.md', () => {
  const ns = parseNorthStar('# North Star\n```yaml north-star-metric\nmetric: "Synthetic builders"\nunit: count\ntarget: 30\ndeadline: 2026-12-28\nladder:\n  - [2026-10-26, 1]\n  - [2026-11-02, 5]\n```\n');
  assert.deepEqual(ns, { metric:'Synthetic builders', target:30, deadline:'2026-12-28', ladder:[['2026-10-26', 1], ['2026-11-02', 5]] });
  assert.equal(ladderRung(ns, '2026-10-20T00:00:00Z'), null, 'before the ladder starts there is no rung');
  assert.equal(ladderRung(ns, '2026-10-26T05:10:00Z'), 1);
  assert.equal(ladderRung(ns, '2026-11-11T05:10:00Z'), 5);
  assert.equal(parseNorthStar('no block'), null);

  const goingMd = '# Get going\n## The original steps\n- [ ] **Step 1.** Not the build order.\n## The phases (the build order)\n- [x] **Phase 0. Done.** All of it.\n- [ ] **Phase 1. Measure** (step 2). Parent.\n  - [x] **1A brief.** Done.\n  - [ ] **1B, the fields.** Accept `a.b` in `src/x.mjs` and name them. Then more.\n- [ ] **Phase 2. Later.** Later.\n## Checks\n';
  assert.equal(firstUnticked(goingMd), '1B, the fields: accept a.b in src/x.mjs and name them');
  assert.equal(firstUnticked('# Get going\n## The phases\n- [x] **Phase 0.** Done.\n- [ ] **Phase 1. Measure.** Read the export first. More.\n'), 'Phase 1. Measure: read the export first');
  assert.equal(firstUnticked('nothing here'), null);

  const nowMd = '# Now\n## What is next and what is waiting on Krish\n\n- **Single next step:** Ship the synthetic fields: so the export can ask.\n- **Waiting on Krish:**\n  - add a synthetic `SECRET_NAME` Actions secret (the settings page): an interactive session held it;\n  - rule on the synthetic clock;\n- North Star check (2026-10-29): holds.\n\n## Read next\n';
  assert.deepEqual(parseNowNext(nowMd), { single:'Ship the synthetic fields', krish:['Add a synthetic SECRET_NAME Actions secret (the settings page)', 'Rule on the synthetic clock'] });
  // The closeout fold writes the single next step as `- Next (YYYY-MM-DD): ...`, and it wins over the older form.
  const foldedMd = nowMd.replace('\n\n- **Single next step:**', '\n\n- Next (2026-11-12): Ship the folded fields: so the export can ask.\n- **Single next step:**');
  assert.equal(parseNowNext(foldedMd).single, 'Ship the folded fields');
  assert.equal(parseNowNext('# Now\n## What is next and what is waiting on Krish\n\n- Next: Ship the plain fields.\n').single, 'Ship the plain fields');

  assert.equal(fitLine('Short enough.', 200), 'Short enough.');
  assert.equal(fitLine(`Keep this ${'word '.repeat(20)}(drop this aside) and end.`, 120).includes('aside'), false, 'asides in brackets go first');
  assert.equal(fitLine(`First clause ${'a'.repeat(80)}, second clause ${'b'.repeat(80)}`, 120), `First clause ${'a'.repeat(80)}`, 'then whole clauses');

  const fields = stateFields({ repo:{ northStar:ns, obsessions:[{ line:'"Synthetic aim"', since:null }, { line:'Call +44 20 7946 0000', since:null }], getGoing:'Ship it', now:{ single:null, krish:['Ship it', 'Rule on it', 'Mail someone@example.com'] } },
    recommendation:{ code:'activate_campaign', action:'Verify the live test-to-API path and record the campaign activation time' }, objectiveFor:() => 'activated',
    weeklyBuilders:{ value:null, reason:'not measured' }, registered:false, at:'2026-11-11T05:10:00.000Z' });
  assert.deepEqual(fields.priorities, [
    { rank:1, line:'Synthetic builders: not measured in this run, against this week\'s rung of 5, on the way to 30 by 28 December 2026.', objective_key:null },
    { rank:2, line:'Clear the constraint this run recommends: verify the live test-to-API path and record the campaign activation time.', objective_key:'activated' },
  ]);
  assert.deepEqual(fields.obsessions, [{ line:'"Synthetic aim"', since:null }], 'a line Control Center would refuse is left out, never sent');
  assert.deepEqual(fields.next_steps, [{ line:'Ship it', waits_on:'engine', when:null }, { line:'Rule on it', waits_on:'krish', when:null }], 'no repeat, and no address');
  assert.deepEqual(stateFields({ repo:null, at:AT }), {}, 'no source, no field: Control Center says "Not reported yet"');

  // A step whose own deadline has passed is never sent; one still ahead says when.
  assert.deepEqual(deadlines('Publish it by 5 Nov (A6), then review the register by 19 Nov 2026 (lock 26 Nov)', '2026-11-12'), ['2026-11-05', '2026-11-19']);
  assert.deepEqual(deadlines('Sign the spec on Monday 9 November; read it on 2026-11-20', '2026-11-12'), ['2026-11-09', '2026-11-20']);
  assert.deepEqual(deadlines('Read run gms-2026-11-09 and the 27 Oct report; held since 29 Oct', '2026-11-12'), [], 'a date in an id or in history is no deadline');
  assert.deepEqual(deadlines('Submit it by 5 Jan', '2026-12-20'), ['2027-01-05'], 'a day and month far behind today is next year\'s');
  assert.equal(nextStep('Submit the directory listings by 5 Nov (A6 and A7)', 'krish', '2026-11-12'), null);
  assert.deepEqual(nextStep('Review the source register by 19 Nov 2026 (lock 26 Nov)', 'engine', '2026-11-12'), { line:'Review the source register by 19 Nov 2026 (lock 26 Nov)', waits_on:'engine', when:'2026-11-19' });
  assert.deepEqual(nextStep('Submit the directory listings by 5 Nov', 'krish', 'not a day'), { line:'Submit the directory listings by 5 Nov', waits_on:'krish', when:null }, 'with no day to compare, nothing is dropped');
  const dated = stateFields({ repo:{ northStar:null, getGoing:'Review the register by 19 Nov 2026', now:{ single:null, krish:['Submit the listings by 5 Nov', 'Rule on the clock'] } }, at:'2026-11-12T05:10:00.000Z' });
  assert.deepEqual(dated.next_steps, [
    { line:'Review the register by 19 Nov 2026', waits_on:'engine', when:'2026-11-19' },
    { line:'Rule on the clock', waits_on:'krish', when:null },
  ], 'the step whose day has gone is left out, never shown as still to do');

  // This repository's own files read whole, and every line they give is one Control Center takes.
  assert.ok(REPO.northStar && REPO.obsessions?.length === 3 && REPO.getGoing && REPO.now?.krish.length > 0);
  const own = stateFields({ repo:REPO, at:'2026-11-11T05:10:00.000Z', recommendation:{ code:'restore_measurement', action:'Complete source capture' }, objectiveFor:() => 'activated' });
  assert.equal(ccEngineStateRefusal({ ...own }, ENGINE_STATE_VERSION), null);
  assert.match(own.priorities[0].line, /rung of 10, on the way to 300 by 28 December 2026\.$/);
  assert.ok(own.next_steps.length <= 5 && own.next_steps.every(s => !s.line.endsWith('...')), 'whole lines, never cut');
  // Today, this repository's own NOW.md and GET-GOING.md send no step whose day has gone.
  const today = new Date().toISOString().slice(0, 10);
  const live = stateFields({ repo:REPO, at:new Date().toISOString() });
  assert.ok(live.next_steps?.length > 0 && live.next_steps.every(s => s.when === null || s.when >= today));
});
