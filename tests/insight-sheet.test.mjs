// The insight desk adapter (config/insight-desk.json; src/lib/insight-sheet.mjs). The fixture is the skill's own
// synthetic sample sheet, so the hash here is the one the Python checker computes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { validateSheet, ownerErrors, sheetSha, canonicalJson, sheetAngles, sheetMayAsk, knownMethods, methodsFromAdapter, ANGLE_PREFIX } from '../src/lib/insight-sheet.mjs';
import { selectDrafts, briefSha, impactsWith, IMPACTS } from '../src/lib/reader.mjs';
import { readActivation, heldBy } from '../src/lib/hold.mjs';

const root = resolve(import.meta.dirname, '..');
const sample = () => JSON.parse(readFileSync(join(root, 'fixtures/insight-sheet.json'), 'utf8'));
const resealed = s => ({ ...s, sheet_sha256: sheetSha(s) });
const METHODS = new Set(['ritual-hijack', 'rename-the-problem']);

test('the adapter names the venture, the hook, the held wall and no humour', () => {
  const a = JSON.parse(readFileSync(join(root, 'config/insight-desk.json'), 'utf8'));
  assert.equal(a.schema, 'insight-desk-adapter/1');
  assert.equal(a.repo, 'krishanraja/growth-legibility');
  assert.equal(a.skill.name, 'insight-desk');
  assert.equal(a.humour.allowed, false);
  assert.match(a.divergent.namespace, /^growth-legibility:/);
  assert.match(a.hook.object, /draft\.impact/);
  assert.match(a.approval, /holds it, the sheet stays local and puts no ask/);
  assert.match(a.sheets, /^runtime\//);
  for (const f of a.floor) assert.ok(readFileSync(join(root, f), 'utf8').length > 0, f);
});

test('the sample sheet is valid and its hash matches the canonical form', () => {
  const s = sample();
  assert.equal(sheetSha(s), s.sheet_sha256);
  assert.deepEqual(validateSheet(s, { methods: METHODS }), []);
  assert.deepEqual(validateSheet(s), []);
  assert.equal(canonicalJson({ b: 1, a: [{ d: 2, c: 'x' }] }), '{"a":[{"c":"x","d":2}],"b":1}');
});

test('rules a schema cannot hold are enforced', () => {
  const cases = [
    [s => { s.stall_check.diagnosis = 'distribution'; }, /not the idea/],
    [s => { s.north_star.urgency = 4; s.north_star.current = null; }, /every idea is a measurement idea/],
    [s => { s.blind_passes[1].lead = 'name-the-rush'; }, /both blind passes must pick the same lead/],
    [s => { s.blind_passes[1].order = [...s.blind_passes[0].order]; }, /shuffled differently/],
    [s => { s.lead = 'name-the-rush'; s.blind_passes.forEach(p => { p.lead = 'name-the-rush'; }); }, /analogue is unavailable/],
    [s => { s.ideas[0].tests.share.score = 9; }, /no scores/],
    [s => { delete s.ideas[0].conversion_path.link; }, /no full conversion path/],
    [s => { s.ideas[1].claim = s.discarded_obvious[0]; }, /restates a discarded obvious idea/],
    [s => { s.ideas[0].method = 'made-up'; }, /methods-by-category/],
    [s => { s.consults[0].result = 'exit-2'; }, /never pass/],
    [s => { s.insights[1].source = 'x'; }, /never both/],
    [s => { s.ideas[0].claim = `a ${String.fromCodePoint(0x2014)} b`; }, /em dash/]
  ];
  for (const [mutate, reason] of cases) {
    const s = sample(); mutate(s);
    const errors = validateSheet(resealed(s), { methods: METHODS });
    assert.ok(errors.some(e => reason.test(e)), `${reason}: ${errors.join(' | ')}`);
  }
  const tampered = sample(); tampered.ideas[0].claim += ' changed';
  assert.ok(validateSheet(tampered, { methods: METHODS }).some(e => /does not match/.test(e)));
  assert.deepEqual(validateSheet(null), ['the sheet is not a JSON object']);
});

test('a valid sheet adds insight angles, lead first; an invalid one adds none', () => {
  assert.deepEqual(sheetAngles(sample()), [`${ANGLE_PREFIX}own-date`, `${ANGLE_PREFIX}name-the-rush`]);
  const bad = sample(); bad.stall_check.diagnosis = 'offer';
  assert.deepEqual(sheetAngles(resealed(bad)), []);
});

test('without a sheet the reader keeps its three fixed angles, byte for byte', () => {
  const cand = (id, impact) => ({ id, pool: 'builder', company: 'Synthetic Co', project: 'a synthetic agent', draft: { text: 'Synthetic draft.', impact } });
  const list = [cand('a', 'cost_speed'), cand('b', 'insight:own-date'), cand('c', 'not_an_angle')];
  assert.deepEqual(impactsWith(), [...IMPACTS]);
  assert.deepEqual(selectDrafts(list).map(x => x.impact), ['cost_speed', null, null]);
  assert.deepEqual(JSON.stringify(selectDrafts(list)), JSON.stringify(selectDrafts(list, undefined, {})));
  // Pinned from the reader as it was before the insight desk (2d3612f): the same items and the same brief hashes.
  const facts = ['Your company: Synthetic Co.', 'What you are building: a synthetic agent.'];
  assert.equal(JSON.stringify(selectDrafts(list)), JSON.stringify([
    { id: 'a', role: 'builder', impact: 'cost_speed', facts, draft: 'Synthetic draft.' },
    { id: 'b', role: 'builder', impact: null, facts, draft: 'Synthetic draft.' },
    { id: 'c', role: 'builder', impact: null, facts, draft: 'Synthetic draft.' }
  ]));
  assert.deepEqual(selectDrafts(list).map(briefSha), [
    '8cc1a9d909a6377e79a634c67d2197660b04cc9075a945a430df18f3fbeb513c',
    'fee0289a6f23f126f145c7b8c7f4b2eb454e5b932ca764eaf16aafaf2bebefca',
    'b160d59fc7f659fdf06572ae25e48fb0118e5c9f22545ebbe2661d2073c9a755'
  ]);
  assert.deepEqual(IMPACTS, ['cost_speed', 'agent_revenue', 'trust_risk']);
  const angles = sheetAngles(sample());
  assert.deepEqual(selectDrafts(list, 10, { angles }).map(x => x.impact), ['cost_speed', 'insight:own-date', null]);
  assert.deepEqual(impactsWith(['not_prefixed', 'cost_speed']), [...IMPACTS], 'only insight: angles are added');
});

test('a held engine puts no ask on the list', () => {
  assert.equal(sheetMayAsk(['krish_local']), false);
  assert.equal(sheetMayAsk(['control_center']), false);
  assert.equal(sheetMayAsk(undefined), false);
  assert.equal(sheetMayAsk([]), true);
  // The engine as it stands in this checkout: held unless config/activation.json says active, and then no ask.
  const held = heldBy({ local: readActivation(join(root, 'config/activation.json')) });
  const activation = JSON.parse(readFileSync(join(root, 'config/activation.json'), 'utf8'));
  assert.equal(held.includes('krish_local'), activation.state !== 'active');
  assert.equal(sheetMayAsk(held), activation.state === 'active');
});

test('a sheet for another engine or venture is refused; the adapter must name this one', () => {
  const adapter = JSON.parse(readFileSync(join(root, 'config/insight-desk.json'), 'utf8'));
  const foreign = sample();
  assert.equal(foreign.repo, 'example-owner/example-engine');
  const errs = ownerErrors(foreign, adapter);
  assert.ok(errs.some(e => /^repo:/.test(e)) && errs.some(e => /^venture:/.test(e)), errs.join(' | '));
  const heartside = resealed({ ...sample(), repo: 'krishanraja/growth-heartside', venture: 'heartside' });
  assert.equal(ownerErrors(heartside, adapter).length, 2);
  const otherVenture = resealed({ ...sample(), repo: adapter.repo, venture: 'heartside' });
  assert.deepEqual(ownerErrors(otherVenture, adapter).map(e => e.split(':')[0]), ['venture']);
  const own = resealed({ ...sample(), repo: adapter.repo, venture: adapter.venture });
  assert.deepEqual(ownerErrors(own, adapter), []);
  assert.deepEqual(validateSheet(own, { methods: METHODS }), []);
  assert.equal(ownerErrors(own, null).length, 1);
  assert.equal(ownerErrors(own, { repo: adapter.repo }).length, 1);
});

test('reader brief refuses a bare --insight, an unreadable sheet and a foreign sheet, and keeps the last run', () => {
  const dir = mkdtempSync(join(tmpdir(), 'reader-'));
  const run = (...extra) => spawnSync(process.execPath, ['scripts/reader.mjs', 'brief', '--input', 'fixtures/snapshot.json', ...extra], { cwd: root, encoding: 'utf8', env: { ...process.env, READER_DIR: dir } });
  const plain = run();
  assert.equal(plain.status, 0, plain.stderr);
  const before = readFileSync(join(dir, 'run.json'), 'utf8');
  assert.ok(existsSync(join(dir, 'briefs')));
  const bare = run('--insight');
  assert.equal(bare.status, 1);
  assert.match(bare.stderr, /^Usage: --insight needs a sheet file/);
  const flagged = run('--insight', '--n', '2');
  assert.equal(flagged.status, 1);
  assert.match(flagged.stderr, /^Usage: --insight needs a sheet file/);
  const missing = run('--insight', join(dir, 'no-such-sheet.json'));
  assert.equal(missing.status, 1);
  assert.equal(missing.stderr.trim(), 'Refused: the insight sheet cannot be read as JSON.');
  const foreign = run('--insight', 'fixtures/insight-sheet.json');
  assert.equal(foreign.status, 1);
  assert.match(foreign.stderr, /^Refused: the insight sheet is not valid for this engine/);
  assert.equal(readFileSync(join(dir, 'run.json'), 'utf8'), before, 'a refused run leaves the last run as it was');
  const adapter = JSON.parse(readFileSync(join(root, 'config/insight-desk.json'), 'utf8'));
  const ownFile = join(dir, 'own-sheet.json');
  writeFileSync(ownFile, JSON.stringify(resealed({ ...sample(), repo: adapter.repo, venture: adapter.venture })));
  const own = run('--insight', ownFile);
  assert.equal(own.status, 0, own.stderr);
  assert.ok(JSON.parse(readFileSync(join(dir, 'run.json'), 'utf8')).insight.angles.length > 0);
});

test('methods are read from a local checkout the adapter names, else null', () => {
  const dir = mkdtempSync(join(tmpdir(), 'insight-'));
  mkdirSync(join(dir, 'skill/references'), { recursive: true });
  writeFileSync(join(dir, 'skill/references/methods-by-category.md'), '## A\n\n### `ritual-hijack`\n\ntext\n\n### `rename-the-problem`\n');
  assert.deepEqual([...methodsFromAdapter({ skill: { local_paths: ['missing', 'skill'] } }, dir)], ['ritual-hijack', 'rename-the-problem']);
  assert.equal(methodsFromAdapter({ skill: { local_paths: ['missing'] } }, dir), null);
  assert.equal(methodsFromAdapter(null, dir), null);
  assert.equal(knownMethods(join(dir, 'nothing.md')), null);
});
