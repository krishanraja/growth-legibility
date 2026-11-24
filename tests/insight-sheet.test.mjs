// The insight desk adapter (config/insight-desk.json; src/lib/insight-sheet.mjs). The fixture is the skill's own
// synthetic sample sheet, so the hash here is the one the Python checker computes.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { tmpdir } from 'node:os';
import { validateSheet, sheetSha, canonicalJson, sheetAngles, sheetMayAsk, knownMethods, methodsFromAdapter, ANGLE_PREFIX } from '../src/lib/insight-sheet.mjs';
import { selectDrafts, impactsWith, IMPACTS } from '../src/lib/reader.mjs';

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
  const angles = sheetAngles(sample());
  assert.deepEqual(selectDrafts(list, 10, { angles }).map(x => x.impact), ['cost_speed', 'insight:own-date', null]);
  assert.deepEqual(impactsWith(['not_prefixed', 'cost_speed']), [...IMPACTS], 'only insight: angles are added');
});

test('a held engine puts no ask on the list', () => {
  assert.equal(sheetMayAsk(['krish_local']), false);
  assert.equal(sheetMayAsk(['control_center']), false);
  assert.equal(sheetMayAsk(undefined), false);
  assert.equal(sheetMayAsk([]), true);
  const activation = JSON.parse(readFileSync(join(root, 'config/activation.json'), 'utf8'));
  if (activation.state !== 'active') assert.equal(sheetMayAsk(['krish_local']), false);
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
