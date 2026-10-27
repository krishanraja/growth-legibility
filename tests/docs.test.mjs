import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { checkDocs, checkRelativeLinks, checkRegisters, checkEmails, checkStatusWords, checkDenyList, REQUIRED_DENY } from '../scripts/check-docs.mjs';

const root = resolve(import.meta.dirname, '..');
function fixture(files) {
  const dir = mkdtempSync(join(tmpdir(), 'docs-check-'));
  for (const [path, body] of Object.entries(files)) {
    mkdirSync(join(dir, path, '..'), { recursive: true });
    writeFileSync(join(dir, path), typeof body === 'string' ? body : JSON.stringify(body));
  }
  return dir;
}

test('the repository passes its own docs checks', () => {
  assert.deepEqual(checkDocs(root), []);
});

// scripts/check-docs.mjs checkRelativeLinks; docs/FAILURES.md F12 (6dafb79).
test('a relative link to a missing file fails the docs check', () => {
  const dir = fixture({
    'docs/a.md': 'See [b](b.md), [gone](missing.md), [out](../../outside.md), [web](https://example.com/x) and [here](#top).',
    'docs/b.md': 'b',
  });
  try {
    assert.deepEqual(checkRelativeLinks(dir).sort(), ['relative_link_unresolved:docs/a.md:../../outside.md', 'relative_link_unresolved:docs/a.md:missing.md']);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// scripts/check-docs.mjs checkRegisters; docs/FAILURES.md F13.
test('a register naming a test that does not exist fails the docs check', () => {
  const dir = fixture({
    'tests/x.test.mjs': "test('present behaviour', () => {});",
    'docs/FAILURES.md': '| F1 | a | b | c | `tests/x.test.mjs :: present behaviour` `tests/x.test.mjs :: renamed behaviour` | known-learning |\n',
    'pipeline/stage-conveyor.json': { learnings: [{ id: 'known-learning' }, { id: 'unlisted-learning' }] },
  });
  try {
    assert.deepEqual(checkRegisters(dir), ['register_test_missing:tests/x.test.mjs :: renamed behaviour', 'learning_unregistered:unlisted-learning']);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// scripts/check-docs.mjs checkEmails; docs/FAILURES.md F22. The real-looking address is assembled at run time
// so this file itself never carries one.
test('an email address in a doc fails the docs check, an example domain does not', () => {
  const real = ['someone', 'realco.io'].join('@');
  const dir = fixture({
    'docs/a.md': `Write to ${real} today.`,
    'docs/b.md': 'Synthetic: person@example.test and team@mail.example.com.',
    '_corpus/c.md': `Preserved bytes may quote ${real}.`,
  });
  try {
    assert.deepEqual(checkEmails(dir), ['email_address:docs/a.md']);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// scripts/check-docs.mjs checkStatusWords: readiness is computed, never written.
test('a written pass or done verdict in a spec fails the docs check', () => {
  const dir = fixture({
    'specs/examples/wave.json': { wave_id: 'wave-x', gates: [{ id: 'G1', status: 'done' }], verdict: 'pending-measurement' },
    'crew/x/check.json': { result: 'PASS' },
    'docs/notes.json': { status: 'done' },
  });
  try {
    assert.deepEqual(checkStatusWords(dir).sort(), ['written_status:crew/x/check.json:$.result', 'written_status:specs/examples/wave.json:$.gates[0].status']);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// scripts/check-docs.mjs checkDenyList; docs/FAILURES.md F23.
test('the settings deny list holds every required entry', () => {
  assert.deepEqual(checkDenyList(root), []);
  const settings = JSON.parse(readFileSync(join(root, '.claude/settings.json'), 'utf8'));
  settings.permissions.deny = settings.permissions.deny.filter(t => t !== 'mcp__Gmail__send_message');
  const dir = fixture({ '.claude/settings.json': settings });
  try {
    assert.deepEqual(checkDenyList(dir), ['deny_entry_missing:mcp__Gmail__send_message']);
    assert.ok(REQUIRED_DENY.includes('mcp__Instantly') && REQUIRED_DENY.includes('mcp__Google_Drive__share_file'));
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

// docs/FAILURES.md F21: a docs defect must never stop the daily Control Center run.
test('the operate gate does not run the docs check', () => {
  const operate = readFileSync(join(root, '.github/workflows/operate.yml'), 'utf8');
  const ci = readFileSync(join(root, '.github/workflows/ci.yml'), 'utf8');
  const pkg = JSON.parse(readFileSync(join(root, 'package.json'), 'utf8'));
  assert.match(operate, /npm run check\b/);
  assert.doesNotMatch(operate, /check:docs|check-docs/);
  assert.doesNotMatch(pkg.scripts.check, /check-docs/);
  assert.match(ci, /npm run check:docs/);
});
