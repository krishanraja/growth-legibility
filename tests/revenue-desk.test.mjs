// The revenue desk adapter (config/revenue-desk.json). Ruling (Krish, 2026-11-24): measure first where nothing is
// counted; thresholds binding only after his yes. It checks the adapter parses, every source it names exists, and
// that the held wall keeps the desk local.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
import { readActivation, heldBy } from '../src/lib/hold.mjs';

const root = resolve(import.meta.dirname, '..');
const adapter = () => JSON.parse(readFileSync(join(root, 'config/revenue-desk.json'), 'utf8'));

test('the adapter parses, names the method and has no spend authority', () => {
  const a = adapter();
  assert.equal(a.schema, 'revenue-desk-adapter/1');
  assert.equal(a.repo, 'krishanraja/growth-legibility');
  assert.equal(a.method.name, 'revenue-desk');
  assert.equal(a.spend_authority, 'none');
  assert.equal(a.stage, 'measure_first');
  assert.match(a.sheets, /^runtime\//);
  assert.ok(existsSync(join(root, a.north_star.north_star)));
});

test('every source the adapter names exists, with its export and metric', async () => {
  const a = adapter();
  const reads = a.money_path.flatMap(s => s.read);
  assert.ok(reads.length > 0);
  for (const r of reads) {
    assert.ok(existsSync(join(root, r.path)), r.path);
    if (r.export) {
      const mod = await import(pathToFileURL(join(root, r.path)).href);
      assert.equal(typeof mod[r.export], 'function', `${r.path} ${r.export}`);
    }
    if (r.metric) assert.match(readFileSync(join(root, r.path), 'utf8'), new RegExp(`\\b${r.metric}\\b`), r.metric);
  }
  for (const f of [a.held.activation, a.trial_entry_gate.source]) assert.ok(existsSync(join(root, f)), f);
});

test('every step is measure first while the engine is held, and the trial gate stays free and hand granted', () => {
  const a = adapter();
  assert.deepEqual(a.money_path.map(s => s.step), ['invitation', 'trial_entry', 'first_trusted_read', 'returning', 'settled_revenue']);
  for (const s of a.money_path) assert.equal(s.stage, 'measure_first', s.step);
  assert.match(a.trial_entry_gate.offer, /30-day free trial/);
  assert.ok(a.trial_entry_gate.conditions.some(c => /Krish grants the trial himself/.test(c)));
  assert.match(a.held.rule, /no sheet, test or ask reaches Krish's list/);
  const held = heldBy({ local: readActivation(join(root, a.held.activation)) });
  if (held.length) assert.match(a.approval, /While held, nothing leaves this repository/);
});

test('bands are unset assumptions that bind only after his yes', () => {
  const b = adapter().bands;
  assert.equal(b.status, 'assumption');
  assert.equal(b.binding, false);
  for (const band of Object.values(b.per_step)) { assert.equal(band.warning, null); assert.equal(band.breach, null); }
});

test('the adapter carries no em dash, exclamation or dollar figure, and AGENTS.md points to it', () => {
  const text = readFileSync(join(root, 'config/revenue-desk.json'), 'utf8');
  assert.ok(!text.includes(String.fromCharCode(0x2014)));
  assert.ok(!text.includes('!'));
  assert.ok(!text.includes('$'));
  const agents = readFileSync(join(root, 'AGENTS.md'), 'utf8');
  assert.match(agents, /## Revenue desk/);
  assert.match(agents, /config\/revenue-desk\.json/);
});
