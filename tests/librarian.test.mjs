// The Librarian's scan over the library Control Center serves (protocol 1.35.0, fleet integration I-25). Synthetic.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scan, knownFolder, taxonomy } from '../src/lib/librarian.mjs';

const TAXONOMY = taxonomy();

const part = (files, folders = []) => ({ available: true, complete: true, as_of: '2026-11-14T06:02:00Z',
  roots: [{ root: 'Ventures/Active Ventures/Legibility/01_Growth', id: 'synthetic', folders, files }] });

test('the root is declared in drive-map/1, by path only', () => {
  assert.deepEqual(TAXONOMY.drive_map.roots, [{ path: 'Ventures/Active Ventures/Legibility/01_Growth' }]);
  assert.equal(JSON.stringify(TAXONOMY.drive_map).includes('"id"'), false);
});

test('a wave folder counts as 02_Waves/<wave-folder>; anything else outside the map does not', () => {
  assert.equal(knownFolder('01_Growth/02_Waves/Wave-01_2026-10-27_first-wave'), true);
  assert.equal(knownFolder('01_Growth/02_Waves/notes'), false);
  assert.equal(knownFolder('01_Growth/01_Strategy'), true);
});

test('the scan counts strays, bad names and copies, and findability is the share that conform', () => {
  const r = scan(part([
    { folder: '01_Growth', title: '00_START-HERE', mime: 'x' },
    { folder: '01_Growth/01_Strategy', title: '2026-10-27_offer_waitlist_v1', mime: 'x' },
    { folder: '01_Growth', title: 'Untitled document', mime: 'x' },
    { folder: '01_Growth/Elsewhere', title: 'Copy of 2026-10-27_offer_waitlist_v1', mime: 'x' }
  ], [{ folder: '01_Growth/a/b/c/d' }]));
  assert.equal(r.state, 'scanned');
  assert.equal(r.files, 4);
  assert.equal(r.conform, 2);
  assert.equal(r.findability, 50);
  assert.deepEqual(r.counts, { loose_at_root: 1, outside_map: 1, bad_names: 2, copies_or_untitled: 2, duplicates: 0, too_deep: 1 });
  assert.equal(r.private_content, 'unknown');
});

test('a library Control Center cannot vouch for is unknown, never clean', () => {
  assert.deepEqual(scan(undefined), { state: 'not_served', reason: 'library_not_served' });
  assert.deepEqual(scan({ available: false, complete: false, reason: 'read_stale', as_of: null }), { state: 'unknown', reason: 'read_stale' });
  assert.equal(scan({ available: true, complete: true, roots: [{ root: 'Ventures/Other', files: [] }] }).state, 'unknown');
});
