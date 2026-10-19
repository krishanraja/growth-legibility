import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';

const dir = new URL('../_corpus/', import.meta.url);
const manifest = JSON.parse(readFileSync(new URL('manifest.json', dir)));
const digest = bytes => createHash('sha256').update(bytes).digest('hex');

test('the playbook stays the primary corpus entry, so report seals keep the same digest', () => {
  assert.equal(manifest.file, 'legibility-growth-playbook.md');
  assert.equal(manifest.sha256, 'c74369b59a458299db5aaef93041bd0018ed1390778efc9a9a4719365d8035ff');
  assert.equal(manifest.received_at, '2026-10-18');
  const primary = manifest.sources.find(s => s.file === manifest.file);
  assert.equal(primary.sha256, manifest.sha256);
  assert.equal(primary.received_at, manifest.received_at);
});

test('every preserved source matches its registered bytes and is reference only', () => {
  assert.ok(manifest.sources.length >= 3);
  for (const s of manifest.sources) {
    const bytes = readFileSync(new URL(s.file, dir));
    assert.equal(bytes.length, s.bytes, s.file);
    assert.equal(digest(bytes), s.sha256, s.file);
    assert.equal(s.role, 'reference corpus, not execution authority');
  }
  const copy = manifest.sources.find(s => s.file === 'copywriting-offers-demand-corpus.md');
  assert.equal(copy.received_at, '2026-10-19');
  assert.equal(copy.sha256, '04fddb23da2cb210470f60b57a6d78b56d37c3f84316217e0e493caa6b9856d9');
});

test('no unregistered file sits in the corpus directory', () => {
  for (const f of readdirSync(dir)) {
    if (['README.md', 'manifest.json'].includes(f)) continue;
    assert.ok(manifest.sources.some(s => s.file === f), f);
  }
});

test('a single altered byte breaks the digest', () => {
  const s = manifest.sources.find(x => x.file === 'copywriting-offers-demand-corpus.md');
  const bytes = Buffer.from(readFileSync(new URL(s.file, dir)));
  bytes[100] ^= 1;
  assert.notEqual(digest(bytes), s.sha256);
});
