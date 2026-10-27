// The session ledger (scripts/session-ledger.mjs) on synthetic transcripts written to the OS temp directory.
// Synthetic only: the words, ids and paths below are invented, and the test proves none of them is ever printed.
import test from 'node:test';
import assert from 'node:assert/strict';
import { appendFileSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { ledger, ledgerRow } from '../scripts/session-ledger.mjs';

const SCRIPT = fileURLToPath(new URL('../scripts/session-ledger.mjs', import.meta.url));
const SECRET_TEXT = 'synthetic-transcript-words-canary';
// Removal retries and never throws (docs/FAILURES.md F27): a temp folder left behind is harmless, a failed hook is not.
function folder(t) {
  const dir = mkdtempSync(join(tmpdir(), 'growth-legibility-ledger-'));
  t.after(() => { try { rmSync(dir, { recursive:true, force:true, maxRetries:5, retryDelay:100 }); } catch {} });
  return dir;
}
const usage = (input, output, read, create) => ({ input_tokens:input, output_tokens:output, cache_read_input_tokens:read, cache_creation_input_tokens:create, service_tier:'standard' });
// One API response is written as one line per content block, each repeating the response's usage.
const block = (id, at, u, text = SECRET_TEXT, model = 'synthetic-model') => ({ type:'assistant', timestamp:at, sessionId:'synthetic-session-id', message:{ id, model, role:'assistant', content:[{ type:'text', text }], usage:u } });
const lines = rows => rows.map(r => typeof r === 'string' ? `${r}\n` : `${JSON.stringify(r)}\n`).join('');
const MAIN = [
  { type:'user', timestamp:'2026-10-27T10:00:00.000Z', message:{ role:'user', content:SECRET_TEXT } },
  block('msg_synthetic_one', '2026-10-27T10:00:05.000Z', usage(3, 10, 100, 1000)),
  block('msg_synthetic_one', '2026-10-27T10:00:06.000Z', usage(3, 10, 100, 1000)),
  block('msg_synthetic_one', '2026-10-27T10:00:07.000Z', usage(3, 10, 100, 1000)),
  { type:'mode', mode:'auto' },
  block('msg_synthetic_two', '2026-10-27T10:01:00.000Z', usage(5, 20, 200, 0)),
  block('msg_synthetic_two', '2026-10-27T10:01:01.000Z', usage(5, 20, 200, 0)),
  block('msg_synthetic_stub', '2026-10-27T10:01:30.000Z', usage(0, 0, 0, 0), 'stand-in', '<synthetic>'),
];

test('the session ledger counts usage once per message id and prints counts only', t => {
  const dir = folder(t);
  const main = join(dir, 'session-synthetic.jsonl');
  writeFileSync(main, lines(MAIN));
  const subagents = join(dir, 'subagents');
  mkdirSync(join(subagents, 'nested'), { recursive:true });
  // A subagent repeats one of the session's own responses: still one call.
  writeFileSync(join(subagents, 'agent-synthetic.jsonl'), lines([block('msg_synthetic_two', '2026-10-27T10:01:01.000Z', usage(5, 20, 200, 0)), block('msg_synthetic_three', '2026-10-27T10:02:00.000Z', usage(7, 30, 300, 50))]));
  writeFileSync(join(subagents, 'nested', 'agent-synthetic-nested.jsonl'), lines([block('msg_synthetic_four', '2026-10-27T10:03:00.000Z', usage(1, 2, 3, 4))]));
  writeFileSync(join(subagents, 'agent-synthetic.meta.json'), JSON.stringify({ note:SECRET_TEXT }));
  const result = ledger([main, subagents]);
  assert.equal(result.api_calls, 4);
  assert.deepEqual([result.input_tokens, result.output_tokens, result.cache_read_input_tokens, result.cache_creation_input_tokens], [3 + 5 + 7 + 1, 10 + 20 + 30 + 2, 100 + 200 + 300 + 3, 1000 + 0 + 50 + 4]);
  assert.equal(result.first_call_at, '2026-10-27T10:00:05.000Z');
  assert.equal(result.last_call_at, '2026-10-27T10:03:00.000Z');
  assert.equal(result.synthetic_entries_skipped, 1);
  assert.deepEqual(result.transcripts.map(x => x.api_calls), [2, 1, 1]);
  // A response whose later lines carry larger counts is counted at its final value, still once.
  writeFileSync(main, lines([...MAIN, block('msg_synthetic_five', '2026-10-27T10:04:00.000Z', usage(1, 5, 0, 0)), block('msg_synthetic_five', '2026-10-27T10:04:01.000Z', usage(1, 9, 0, 0))]));
  assert.equal(ledger([main]).output_tokens, 10 + 20 + 9);
  // The command prints counts, instants and digests: no words, paths, file names or ids from the transcripts.
  for (const args of [[main, subagents], ['--row', main, subagents]]) {
    const run = spawnSync(process.execPath, [SCRIPT, ...args], { encoding:'utf8' });
    assert.equal(run.status, 0, run.stderr);
    for (const secret of [SECRET_TEXT, 'msg_synthetic', 'synthetic-session-id', 'session-synthetic', 'agent-synthetic', dir, dir.replaceAll('\\', '/'), 'stand-in']) {
      assert.ok(!run.stdout.includes(secret) && !run.stderr.includes(secret), secret);
    }
  }
  const missing = spawnSync(process.execPath, [SCRIPT, join(dir, 'not-there.jsonl')], { encoding:'utf8' });
  assert.equal(missing.status, 1); assert.equal(missing.stderr.trim(), 'transcript_missing');
});

test('a cut-off counts only what the transcript held then, and its digest and row stay the same as the transcript grows', t => {
  const dir = folder(t);
  const main = join(dir, 'session-synthetic.jsonl');
  writeFileSync(main, lines(MAIN));
  const until = '2026-10-27T10:01:30.000Z';
  const whole = ledger([main]);
  const before = ledger([main], { until });
  assert.equal(before.cut_off, until);
  assert.equal(before.transcripts[0].sha256, whole.transcripts[0].sha256, 'cut at the last line, the digest is the whole file');
  // The session goes on: more calls, a line that is not JSON, and a half-written last line.
  appendFileSync(main, lines([block('msg_synthetic_later', '2026-10-27T11:00:00.000Z', usage(9, 9, 9, 9)), `not json ${SECRET_TEXT}`]) + '{"type":"assist');
  const after = ledger([main], { until });
  assert.deepEqual(after, before);
  assert.equal(ledgerRow(after), ledgerRow(before));
  // A subagent that starts after the cut-off leaves the row as it was.
  const later = join(dir, 'subagents'); mkdirSync(later);
  writeFileSync(join(later, 'agent-synthetic-later.jsonl'), lines([block('msg_synthetic_sub', '2026-10-27T11:30:00.000Z', usage(4, 4, 4, 4))]));
  assert.equal(ledgerRow(ledger([main, later], { until })), ledgerRow(before));
  assert.match(ledgerRow(before), /^\| 2026-10-27T10:01:30\.000Z \| `[0-9a-f]{64}` \| 0 \(`none`\) \| 2 \| 8 \| 30 \| 300 \| 1,000 \| 2026-10-27T10:00:05\.000Z \| 2026-10-27T10:01:01\.000Z \|$/);
  const grown = ledger([main]);
  assert.equal(grown.api_calls, 3);
  assert.equal(grown.unparsed_lines, 2);
  assert.notEqual(grown.transcripts[0].sha256, before.transcripts[0].sha256);
  assert.throws(() => ledger([main], { until:'27 October' }), /until_invalid/);
});
