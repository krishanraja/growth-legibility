import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { mkdtemp, writeFile, readFile, readdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { selectDrafts, briefFor, validAnswer, tally, tallyLine, ledgerEntry, mergeLedger, outcomeOf, calibrate, calibrationLine, validOutcomes, roleOf, readerFacts, CALIBRATION } from '../src/lib/reader.mjs';

// The Reader Check (Ruling, Krish, 2026-11-10). Synthetic companies and ids only.
const root = fileURLToPath(new URL('../', import.meta.url));
const AT = '2026-11-10T09:00:00Z';
const DAY = 86400000;
const iso = ms => new Date(ms).toISOString();
const candidate = (n, over = {}) => ({
  id: `candidate-${n}`, pool: 'buyer', company: 'Synthetic Commerce Lab', project: 'Synthetic procurement agent',
  current_signal: { text: 'Published an integration experiment comparing typed catalogue inputs.', url: 'https://example.org/x', observed_at: '2026-11-01T00:00:00Z' },
  relationship: { kind: 'cold', evidence: null, url: null },
  draft: { text: 'I read your typed catalogue experiment. Would a five-input compatibility test help?', impact: 'trust_risk', source_refs: [] }, ...over
});
const answer = (id, over = {}) => ({ id, replies: true, reply: 'Send the test.', would_test: true, weakest_link: 'none', why: '"Would a five-input compatibility test help?" It is about my work.', feels: 'remembered', ...over });

test('readers come from the record only, by pool, and a candidate with too little is not read', () => {
  assert.equal(roleOf({ pool: 'buyer' }), 'commercial_leader');
  assert.equal(roleOf({ pool: 'builder' }), 'builder');
  assert.equal(roleOf({ pool: 'multiplier' }), 'recipient');
  assert.equal(readerFacts(candidate(1)).length, 4);
  const items = selectDrafts([candidate(1), candidate(2, { draft: { text: '' } }), { id: 'candidate-3', draft: { text: 'Hi' } }, candidate(4, { draft: { text: 'x y z', impact: 'made_up' } })]);
  assert.deepEqual(items.map(i => i.id), ['candidate-1', 'candidate-4']);
  assert.equal(items[0].impact, 'trust_risk');
  assert.equal(items[1].impact, null, 'an unknown angle is no angle');
  assert.equal(selectDrafts(Array.from({ length: 30 }, (_, i) => candidate(i)), 99).length, 20);
});

test('the brief carries the exact draft, the record facts and the test question, and asks for a no over a polite yes', () => {
  const [item] = selectDrafts([candidate(1)]);
  const b = briefFor(item, '/x/01.json');
  assert.ok(b.includes(candidate(1).draft.text));
  for (const f of item.facts) assert.ok(b.includes(f));
  assert.match(b, /would_test/);
  assert.match(b, /Do not be agreeable/);
  assert.equal(/[\u2013\u2014]/.test(b), false);
});

test('an answer is read by fixed rules and nothing is filled in', () => {
  assert.equal(validAnswer(answer('candidate-1'), 'candidate-1').ok, true);
  for (const [a, reason] of [[answer('candidate-2'), 'wrong_id'], ['{', 'not_json'], [answer('candidate-1', { would_test: 'yes' }), 'would_test'], [answer('candidate-1', { weakest_link: 'price' }), 'weakest_link'], [answer('candidate-1', { reply: '' }), 'reply']]) {
    assert.deepEqual(validAnswer(a, 'candidate-1'), { ok: false, reason });
  }
});

test('the tally is counts by impact angle, never words', () => {
  const items = selectDrafts([candidate(1), candidate(2, { draft: { text: 'Another draft for a test.', impact: 'cost_speed' } })]);
  const got = new Map([['candidate-1', answer('candidate-1')], ['candidate-2', answer('candidate-2', { replies: false, reply: '', would_test: false, weakest_link: 'belief', feels: 'worked' })]]);
  const line = tallyLine(tally(items, got));
  assert.match(line, /would reply 1 of 2, would test 1 of 2; weakest links: belief 1; feels: remembered 1, worked 1; by impact angle: cost_speed:silent 1, trust_risk:reply 1\./);
  assert.match(line, /never a Learning Judge verdict/);
  assert.equal(line.includes('five-input'), false);
  const e = ledgerEntry(items[0], got.get('candidate-1'), AT);
  assert.equal(JSON.stringify(e).includes('five-input'), false);
  assert.equal(mergeLedger([e], [e]).length, 1);
});

/** A world of sends 10 days before AT, each predicted and answered (or not) as given. */
function world(cases) {
  const sent = Date.parse(AT) - 10 * DAY, ledger = [], outcomes = [];
  cases.forEach(([predicted, replied, read = false], i) => {
    ledger.push({ id: `c-${i}`, role: 'commercial_leader', impact: null, brief_sha: 's', briefed_at: iso(sent - DAY), replies: predicted, would_test: predicted, weakest_link: 'none', feels: 'neither' });
    outcomes.push({ id: `c-${i}`, sent_at: iso(sent), replied_at: replied ? iso(sent + DAY) : null, first_read_at: read ? iso(sent + 2 * DAY) : null });
  });
  return { ledger, outcomes };
}

test('outcomes are unsent, pending, replied or silent, and the outcomes file is typed', () => {
  const { ledger, outcomes } = world([[true, true, true], [false, false]]);
  assert.deepEqual(outcomeOf(ledger[0], outcomes, AT), { state: 'replied', read: true });
  assert.deepEqual(outcomeOf(ledger[1], outcomes, AT), { state: 'silent', read: false });
  assert.equal(outcomeOf(ledger[0], [], AT).state, 'unsent');
  assert.equal(outcomeOf(ledger[0], outcomes, iso(Date.parse(AT) - 5 * DAY)).state, 'pending');
  assert.throws(() => validOutcomes({ captured_at: AT, outcomes: [{ id: 'x', sent_at: 'soon', replied_at: null, first_read_at: null }] }), /invalid_outcomes/);
  assert.equal(validOutcomes({ captured_at: AT, outcomes }).outcomes.length, 2);
});

test('the stop rule: too early under its sample, earns weight when it predicts, retired when it agrees with everything', () => {
  const small = world(Array.from({ length: CALIBRATION.min_matured - 1 }, () => [true, true]));
  assert.equal(calibrate(small.ledger, small.outcomes, AT).standing, 'too_early');
  const good = world([...Array(5).fill([true, true, true]), ...Array(3).fill([true, false]), [false, true], ...Array(11).fill([false, false])]);
  const c = calibrate(good.ledger, good.outcomes, AT);
  assert.equal(c.standing, 'earns_weight');
  assert.equal(c.first_reads, 5);
  assert.match(calibrationLine(c), /^Reader calibration: 20 predictions; 20 sent 7\+ days ago \(6 replied, 5 first trusted reads\).*standing earns_weight\.$/);
  const yes = world([...Array(6).fill([true, true]), ...Array(14).fill([true, false])]);
  assert.equal(calibrate(yes.ledger, yes.outcomes, AT).standing, 'retire');
});

test('the CLI writes briefs, refuses a bad answer, tallies, keeps the ledger and calibrates from a typed outcomes file', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'reader-'));
  const env = { ...process.env, READER_DIR: join(dir, 'reader') };
  const node = (args, input) => new Promise((ok, no) => {
    const child = execFile(process.execPath, [join(root, 'scripts/reader.mjs'), ...args], { env, cwd: root }, (e, stdout, stderr) => (e ? no(Object.assign(e, { stdout, stderr })) : ok({ stdout, stderr })));
    if (input !== undefined) child.stdin.write(input);
    child.stdin.end();
  });
  const input = join(dir, 'input.json');
  await writeFile(input, JSON.stringify({ captured_at: AT, candidates: [candidate(1), candidate(2)] }));
  const b = await node(['brief', '--input', input, '--at', AT]);
  assert.match(b.stdout, /Wrote 2 reader briefs \(2 sub-agent calls\)/);
  assert.equal(b.stdout.includes('five-input'), false);
  assert.deepEqual((await readdir(join(dir, 'reader', 'briefs'))).sort(), ['01.md', '02.md']);
  await assert.rejects(node(['save', 'candidate-1'], '{"id":"candidate-1"}'), /Refused/);
  await node(['save', 'candidate-1'], JSON.stringify(answer('candidate-1')));
  assert.match((await node(['tally'])).stdout, /read 2 drafts, 1 answered, 1 missing/);
  await node(['brief', '--input', input, '--at', AT]);
  assert.equal(JSON.parse(await readFile(join(dir, 'reader', 'ledger.json'), 'utf8')).length, 1);
  const outcomes = join(dir, 'outcomes.json');
  await writeFile(outcomes, JSON.stringify({ captured_at: AT, outcomes: [] }));
  assert.match((await node(['calibrate', '--outcomes', outcomes, '--at', AT])).stdout, /1 never sent.*standing too_early\./);
  await writeFile(outcomes, '{"outcomes":"no"}');
  await assert.rejects(node(['calibrate', '--outcomes', outcomes]), /invalid_outcomes/);
});
