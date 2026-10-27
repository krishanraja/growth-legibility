// Contract tests for the engine's hard locks: the policy validator, the input size cap,
// the protocol run id check and the outbox identity check. Synthetic data only.
// Every policy case changes a copy of config/policy.json in memory; the file on disk is never written.
import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { validatePolicy, sha256 } from '../src/guards/wire.mjs';
import { buildReport, engineReport, loadJson, protocolRunId } from '../src/orchestrator.mjs';
import { Outbox } from '../src/outbox.mjs';

const POLICY = JSON.parse(readFileSync(new URL('../config/policy.json', import.meta.url)));
const policy = () => structuredClone(POLICY);
const AT = '2026-10-18T12:00:00Z';
const TARGETS = ['gross', 'net', 'keys', 'activated', 'returning', 'feedback', 'partners'];

// Windows will not delete a file that is still open, and once one after() hook throws node:test skips the rest, so one
// failed removal would skip the cleanups after it. So the journal closes before its folder is
// removed, and removal retries and never throws: a temp folder left behind is harmless, a hung suite is not.
function removeQuietly(dir) {
  try { rmSync(dir, { recursive: true, force: true, maxRetries: 5, retryDelay: 100 }); } catch {}
}
function scratch(t) {
  const dir = mkdtempSync(join(tmpdir(), 'growth-legibility-guards-'));
  t.after(() => removeQuietly(dir));
  return dir;
}
const show = v => v === undefined ? 'missing' : JSON.stringify(v);
function refused(change, label, note) {
  const p = policy(); change(p);
  assert.throws(() => validatePolicy(p), { message: `invalid_contract:${label}` }, `${note} should be refused with ${label}`);
}
function accepted(change, note) {
  const p = policy(); change(p);
  assert.doesNotThrow(() => validatePolicy(p), `${note} should be accepted`);
}
// Set a field to a value, or remove it when the value is undefined.
const put = (obj, key, v) => { if (v === undefined) delete obj[key]; else obj[key] = v; };

// src/guards/wire.mjs:37 fail(p.trust_gate === 0.7, 'trust_gate_locked')
test('the trust gate is locked at exactly 0.7 and any other value is refused', () => {
  accepted(() => {}, 'the shipped policy');
  for (const v of [0.69, 0.71, 0.1 * 7, 0.5, 0, 1, '0.7', null, undefined]) {
    refused(p => put(p, 'trust_gate', v), 'trust_gate_locked', `trust_gate ${show(v)}`);
  }
});

// src/guards/wire.mjs:38 fail(Number.isInteger(p.max_actions) && p.max_actions > 0 && p.max_actions <= 5, 'action_cap')
test('the action cap takes only whole numbers from 1 to 5', () => {
  for (const v of [1, 3, 5]) accepted(p => { p.max_actions = v; }, `max_actions ${v}`);
  for (const v of [0, -1, 6, 50, 2.5, '3', null, Number.NaN, Infinity, undefined]) {
    refused(p => put(p, 'max_actions', v), 'action_cap', `max_actions ${show(v)}`);
  }
});

// src/guards/wire.mjs:39 fail(p.max_followups === 1 && ..., 'contact_limits')
test('the follow-up limit is locked at exactly one follow-up', () => {
  accepted(p => { p.max_followups = 1; }, 'max_followups 1');
  for (const v of [0, 2, 3, 1.5, '1', true, null, undefined]) {
    refused(p => put(p, 'max_followups', v), 'contact_limits', `max_followups ${show(v)}`);
  }
});

// src/guards/wire.mjs:39 fail(... && p.max_candidate_age_days > 0 && p.max_candidate_age_days <= 30, 'contact_limits')
test('a candidate may be at most 30 days old and the age limit must be above zero', () => {
  for (const v of [1, 14, 30]) accepted(p => { p.max_candidate_age_days = v; }, `max_candidate_age_days ${v}`);
  for (const v of [0, -1, 30.5, 31, 365, null, undefined]) {
    refused(p => put(p, 'max_candidate_age_days', v), 'contact_limits', `max_candidate_age_days ${show(v)}`);
  }
});

// src/guards/wire.mjs:40 fail(p.max_snapshot_age_hours > 0 && p.max_snapshot_age_hours <= 24, 'snapshot_freshness')
test('a snapshot may be at most 24 hours old and the freshness limit must be above zero', () => {
  for (const v of [1, 12, 24]) accepted(p => { p.max_snapshot_age_hours = v; }, `max_snapshot_age_hours ${v}`);
  for (const v of [0, -1, 24.5, 25, 48, null, undefined]) {
    refused(p => put(p, 'max_snapshot_age_hours', v), 'snapshot_freshness', `max_snapshot_age_hours ${show(v)}`);
  }
});

// src/guards/wire.mjs:41 fail(date(p.source_review_due), 'source_review_due'), with date() at src/guards/wire.mjs:23-26
test('the source review date must be a real UTC timestamp written in the exact ISO form', () => {
  for (const v of ['2026-11-17T00:00:00Z', '2026-11-17T00:00:00.000Z']) accepted(p => { p.source_review_due = v; }, `source_review_due ${v}`);
  for (const v of ['2026-11-17', '2026-11-17 00:00:00Z', '2026-11-17T00:00:00+00:00', '2026-11-17T00:00:00.0Z',
    '2026-02-30T00:00:00Z', '2026-13-01T00:00:00Z', '', 1795392000000, null, undefined]) {
    refused(p => put(p, 'source_review_due', v), 'source_review_due', `source_review_due ${show(v)}`);
  }
});

// src/guards/wire.mjs:42 fail(p.campaign && (p.campaign.activated_at === null || date(p.campaign.activated_at)), 'activation')
test('the campaign start is either null or a real UTC timestamp, and a missing campaign is refused', () => {
  for (const v of [null, '2026-10-19T00:00:00Z', '2026-10-19T00:00:00.000Z']) accepted(p => { p.campaign.activated_at = v; }, `activated_at ${show(v)}`);
  for (const v of ['2026-10-19', '2026-10-19T00:00:00+01:00', '2026-02-30T00:00:00Z', '', 'null', 0, false, undefined]) {
    refused(p => put(p.campaign, 'activated_at', v), 'activation', `activated_at ${show(v)}`);
  }
  refused(p => { delete p.campaign; }, 'activation', 'a policy with no campaign');
  refused(p => { p.campaign = null; }, 'activation', 'a null campaign');
});

// src/guards/wire.mjs:43 fail(p.campaign.duration_days === 30, 'campaign_duration')
test('the campaign runs for exactly 30 days', () => {
  accepted(p => { p.campaign.duration_days = 30; }, 'duration_days 30');
  for (const v of [29, 31, 0, 60, 30.5, '30', null, undefined]) {
    refused(p => put(p.campaign, 'duration_days', v), 'campaign_duration', `duration_days ${show(v)}`);
  }
});

// src/guards/wire.mjs:44 for (const k of [...]) fail(Number.isInteger(p.campaign.targets?.[k]) && p.campaign.targets[k]>0, `target_${k}`)
test('every campaign target is a positive whole number, and the first bad target is named', () => {
  accepted(p => { for (const k of TARGETS) p.campaign.targets[k] = 1; }, 'every target at 1');
  for (const k of TARGETS) {
    for (const v of [0, -1, 1.5, '5', null, undefined]) {
      refused(p => put(p.campaign.targets, k, v), `target_${k}`, `targets.${k} ${show(v)}`);
    }
  }
  refused(p => { delete p.campaign.targets; }, 'target_gross', 'a campaign with no targets');
});

// src/orchestrator.mjs:39 if (bytes.length > 20*1024*1024) throw new Error('input_size_limit')
test('an input file larger than 20 MB is refused before it is parsed, and one of exactly 20 MB is read', t => {
  const dir = scratch(t);
  const LIMIT = 20 * 1024 * 1024;
  const jsonOf = size => `"${'a'.repeat(size - 2)}"`;
  const atLimit = join(dir, 'at-limit.json'), overJson = join(dir, 'over-limit.json'), overText = join(dir, 'over-limit.txt');
  writeFileSync(atLimit, jsonOf(LIMIT));
  writeFileSync(overJson, jsonOf(LIMIT + 1));
  writeFileSync(overText, 'x'.repeat(LIMIT + 1));
  assert.equal(loadJson(atLimit).length, LIMIT - 2);
  assert.throws(() => loadJson(overJson), { message: 'input_size_limit' });
  // Not valid JSON at all, yet the refusal is the size cap, not a parse error: the cap comes first.
  assert.throws(() => loadJson(overText), { message: 'input_size_limit' });
});

// src/orchestrator.mjs:56-57 the id `legibility:<date>:<command>:<discriminator>` must match /^[A-Za-z0-9][A-Za-z0-9:._-]{0,119}$/ or run_id_invalid
test('a protocol run id with unsafe characters or more than 120 characters is refused', () => {
  assert.equal(protocolRunId('run', AT, 'abc123'), 'legibility:2026-10-18:run:abc123');
  assert.equal(protocolRunId('operate', AT, 'a.b_c-d:e'), 'legibility:2026-10-18:operate:a.b_c-d:e');
  const longest = protocolRunId('run', AT, 'x'.repeat(94));
  assert.equal(longest.length, 120);
  for (const [command, discriminator] of [['run', 'x'.repeat(95)], ['run', 'has space'], ['run', 'slash/inside'],
    ['run', 'semi;colon'], ['run', 'line\nbreak'], ['run', 'café'], ['run now', 'abc'], ['run', '../etc']]) {
    assert.throws(() => protocolRunId(command, AT, discriminator), { message: 'run_id_invalid' }, `${JSON.stringify(command)} ${JSON.stringify(discriminator)} should be refused`);
  }
});

// src/outbox.mjs:20-21 if (old && old.digest !== report.payload_sha256) throw new Error('outbox_identity_conflict')
test('putting a different payload under a run id the outbox already holds is refused and the first payload is kept', t => {
  const dir = mkdtempSync(join(tmpdir(), 'growth-legibility-guards-'));
  const db = new Outbox(join(dir, 'outbox.sqlite'));
  t.after(() => { try { db.close(); } catch {} removeQuietly(dir); });
  const raw = JSON.parse(readFileSync(new URL('../fixtures/snapshot.json', import.meta.url)));
  const r = buildReport(raw, policy(), AT, 'a'.repeat(64));
  const first = engineReport(r, { runId: protocolRunId('run', r.observed_at, r.run_id.slice(3, 19)) });
  const { payload_sha256: _digest, ...body } = first;
  const changedBody = { ...body, activity: [...body.activity, { line: 'A synthetic extra line that changes the payload.', evidence_url: null }] };
  const second = { ...changedBody, payload_sha256: sha256(changedBody) };
  assert.equal(second.run_id, first.run_id);
  assert.notEqual(second.payload_sha256, first.payload_sha256);

  db.put(first);
  // The same sealed payload again is an idempotent no-op.
  assert.equal(db.put(first).digest, first.payload_sha256);
  assert.throws(() => db.put(second), { message: 'outbox_identity_conflict' });
  const row = db.get(first.run_id);
  assert.equal(row.digest, first.payload_sha256);
  assert.equal(sha256(JSON.parse(row.payload)), sha256(first));
  assert.equal(row.attempts, 0);
  assert.equal(row.status, 'pending');
});
