import test from 'node:test';
import assert from 'node:assert/strict';
import { cpSync, existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { loadJson } from '../src/orchestrator.mjs';

const repo = fileURLToPath(new URL('..', import.meta.url));
// A placeholder bearer. It is not a credential and is shaped so the credential scanner cannot match it.
const FAKE_TOKEN = 'test-token-not-real';
const AT = '2026-10-18T12:00:00Z';
const SNAPSHOT = ['--snapshot', 'fixtures/snapshot.json', '--at', AT];

// Each test runs the CLI from a byte copy of the engine in the OS temp directory, so anything a broken guard would
// write lands there and never in this repository's runtime/. A preloaded stub replaces fetch: it records the call and
// throws, so nothing leaves the machine and a test can see whether the CLI reached the network at all. The child gets
// only the environment a test names, plus Windows' SystemRoot, which Node needs to start there and the engine never
// reads. Removal of the copy retries and never throws (Windows can hold a just-closed file for a moment, and a throwing
// after() hook would skip the cleanups after it).
const OS_ENV = process.env.SystemRoot ? { SystemRoot:process.env.SystemRoot } : {};
function removeQuietly(dir) {
  try { rmSync(dir, { recursive:true, force:true, maxRetries:5, retryDelay:100 }); } catch {}
}
function sandbox(t) {
  const dir = mkdtempSync(join(tmpdir(), 'growth-legibility-cli-'));
  t.after(() => removeQuietly(dir));
  const root = join(dir, 'engine');
  for (const part of ['package.json', 'src', 'config', '_corpus', 'fixtures']) cpSync(join(repo, part), join(root, part), { recursive:true });
  const offline = join(dir, 'offline.mjs'), network = join(dir, 'network.log');
  writeFileSync(offline, "import { appendFileSync } from 'node:fs';\n"
    + "globalThis.fetch = async () => { appendFileSync(process.env.GL_TEST_NETWORK_LOG, 'fetch\\n'); throw new TypeError('offline'); };\n");
  const cli = (argv, env = {}) => spawnSync(process.execPath,
    ['--disable-warning=ExperimentalWarning', '--import', pathToFileURL(offline).href, join(root, 'src', 'cli.mjs'), ...argv],
    { cwd:root, env:{ ...OS_ENV, ...env, GL_TEST_NETWORK_LOG:network }, encoding:'utf8', timeout:30000 });
  const calls = () => existsSync(network) ? readFileSync(network, 'utf8').split('\n').filter(Boolean).length : 0;
  return { dir, root, runtime:join(root, 'runtime'), cli, calls };
}

function refused(r, code, label) {
  assert.equal(r.error, undefined, label);
  assert.equal(r.status, 1, label);
  assert.equal(r.stderr, `${code}\n`, label);
  assert.equal(r.stdout, '', label);
  assert.ok(!`${r.stdout}${r.stderr}`.includes(FAKE_TOKEN), label);
}

// src/cli.mjs:81-84: the output path is resolved and must be runtime/ itself or a path under runtime/ followed by a
// separator; anything else throws output_must_be_private_runtime before mkdirSync on src/cli.mjs:85.
test('an --out outside runtime/ is refused before anything is written there, while an --out inside runtime/ still runs', t => {
  const s = sandbox(t);
  const env = { CONTROL_CENTER_ENGINE_TOKEN:FAKE_TOKEN };
  // Elsewhere on disk, a climb out of runtime/, and a sibling whose name only starts with "runtime".
  for (const out of [join(s.dir, 'public'), 'runtime/../public', 'runtime-public']) {
    refused(s.cli(['run', ...SNAPSHOT, '--out', out], env), 'output_must_be_private_runtime', `run ${out}`);
    refused(s.cli(['operate', '--out', out], env), 'output_must_be_private_runtime', `operate ${out}`);
  }
  for (const path of [join(s.dir, 'public'), join(s.root, 'public'), join(s.root, 'runtime-public'), s.runtime]) assert.ok(!existsSync(path), path);
  assert.equal(s.calls(), 0);
  // The control: the same run into runtime/ succeeds, so the refusal is about where, not about running at all.
  const ok = s.cli(['run', ...SNAPSHOT, '--out', 'runtime/demo']);
  assert.equal(ok.status, 0, ok.stderr);
  assert.ok(existsSync(join(s.runtime, 'demo', 'latest-summary.json')));
});

// src/cli.mjs:20-21: each command has its own list of options; an option outside that list, or a command that is not
// on it, throws unknown_cli_option. args() is the first thing main() does (src/cli.mjs:61).
test('an option the command does not take, or a command that does not exist, is refused as unknown_cli_option before anything runs', t => {
  const s = sandbox(t);
  const env = { CONTROL_CENTER_ENGINE_TOKEN:FAKE_TOKEN };
  const cases = [
    ['operate', '--at', AT],
    ['doctor', '--out', 'runtime/doctor'],
    ['deliver', '--snapshot', 'fixtures/snapshot.json'],
    ['status', '--run-id', 'legibility:2026-10-18:run:x', '--policy', 'config/policy.json'],
    ['run', ...SNAPSHOT, '--send', 'yes'],
    ['publish', '--out', 'runtime/publish'],
  ];
  for (const argv of cases) refused(s.cli(argv, env), 'unknown_cli_option', argv.join(' '));
  assert.ok(!existsSync(s.runtime));
  assert.equal(s.calls(), 0);
});

// src/cli.mjs:16-17: an option already set, the command included, throws duplicate_cli_argument, so a second value
// can never quietly replace the first one.
test('a repeated option, or an option named after the command, is refused as duplicate_cli_argument', t => {
  const s = sandbox(t);
  const env = { CONTROL_CENTER_ENGINE_TOKEN:FAKE_TOKEN };
  const cases = [
    ['run', ...SNAPSHOT, '--out', 'runtime/first', '--out', 'runtime/second'],
    ['run', '--snapshot', 'fixtures/snapshot.json', ...SNAPSHOT, '--out', 'runtime/again'],
    ['run', '--command', 'operate'],
  ];
  for (const argv of cases) refused(s.cli(argv, env), 'duplicate_cli_argument', argv.join(' '));
  assert.ok(!existsSync(s.runtime));
  assert.equal(s.calls(), 0);
});

// src/cli.mjs:15: every option is --lower-case-words followed by a value that is present, not empty and not itself an
// option; anything else throws invalid_cli_arguments.
test('a malformed option is refused as invalid_cli_arguments', t => {
  const s = sandbox(t);
  const cases = [
    ['run', '--snapshot'],
    ['run', '--snapshot', ''],
    ['run', '--out', '--snapshot', 'fixtures/snapshot.json'],
    ['run', '--Out', 'runtime/x'],
    ['run', '-o', 'runtime/x'],
    ['run', '--snapshot=fixtures/snapshot.json'],
    ['run', 'fixtures/snapshot.json'],
  ];
  for (const argv of cases) refused(s.cli(argv), 'invalid_cli_arguments', argv.join(' '));
  assert.ok(!existsSync(s.runtime));
});

// src/cli.mjs:116: only a message made of letters, digits and _ : . - is printed. Any other message, which may quote
// a private path or the bytes of a private file, is replaced by engine_failed_private_details_suppressed, and the
// stack is never printed.
test('an error whose message could carry data is printed only as engine_failed_private_details_suppressed, with no message or stack', t => {
  const s = sandbox(t);
  // Short on purpose: the parser quotes only a short stretch of the input back in its message.
  const canary = 'CANARY9d2e';
  const unreadable = join(s.dir, 'policy.json');
  writeFileSync(unreadable, canary);
  const missing = join(s.dir, `${canary}.json`);
  for (const policy of [unreadable, missing]) {
    // The raw error does carry the canary: the parser quotes the bytes back, and the file system names the path.
    assert.throws(() => loadJson(policy), e => e.message.includes(canary));
    const r = s.cli(['run', ...SNAPSHOT, '--policy', policy, '--out', 'runtime/x']);
    refused(r, 'engine_failed_private_details_suppressed', policy);
    assert.ok(!r.stderr.includes(canary) && !r.stderr.includes(' at '));
  }
});

// src/cli.mjs:56 raises corpus_integrity_failed:<file>, and src/cli.mjs:116 lets a code-shaped message through
// unchanged, colon and file name included, so the operator still learns which check failed.
test('a code-shaped error is printed exactly as it was raised, colon and file name included', t => {
  const s = sandbox(t);
  const manifest = JSON.parse(readFileSync(join(s.root, '_corpus', 'manifest.json'), 'utf8'));
  // One flipped byte in a secondary source of the copy: the primary digest still holds, so the per-file check names it.
  const secondary = manifest.sources.find(x => x.file !== manifest.file);
  const path = join(s.root, '_corpus', secondary.file);
  const bytes = readFileSync(path); bytes[100] ^= 1; writeFileSync(path, bytes);
  refused(s.cli(['doctor']), `corpus_integrity_failed:${secondary.file}`, 'doctor');
});

// src/cli.mjs:34-35: a CC_DIRECTIVE_ID that is set must be exactly legibility:YYYY-MM-DD, or dispatch_directive_invalid
// is thrown. dispatch() runs on src/cli.mjs:80, after the client is built on src/cli.mjs:79 (which sends nothing) and
// before operate() makes its first request.
test('operate refuses a malformed CC_DIRECTIVE_ID with dispatch_directive_invalid before any network call, and a well-formed one goes on', t => {
  const s = sandbox(t);
  const env = { CONTROL_CENTER_ENGINE_TOKEN:FAKE_TOKEN };
  const bad = ['legibility:2026-10-19; touch pwned', 'legibility:2026-10-19\n', ' legibility:2026-10-19', 'legibility:2026-10-19:x',
    'legibility:latest', 'legibility:2026-10-1', 'heartside:2026-10-19'];
  for (const directive of bad) refused(s.cli(['operate'], { ...env, CC_DIRECTIVE_ID:directive }), 'dispatch_directive_invalid', JSON.stringify(directive));
  assert.equal(s.calls(), 0);
  assert.ok(!existsSync(s.runtime));
  // The control: a well-formed id passes the check and the next thing the run does is a request, which the stub refuses.
  const ok = s.cli(['operate'], { ...env, CC_DIRECTIVE_ID:'legibility:2026-10-19' });
  assert.ok(s.calls() > 0);
  assert.equal(ok.status, 1);
  assert.equal(JSON.parse(ok.stdout).error_code, 'receiver_transport_uncertain');
  assert.ok(!`${ok.stdout}${ok.stderr}`.includes(FAKE_TOKEN));
});

// src/cli.mjs:32-33: a CC_ENGINE_ID that is set must be exactly growth-legibility, or dispatch_engine_mismatch is
// thrown, on the same line of the run as the directive check (src/cli.mjs:80), before any request.
test('operate refuses a CC_ENGINE_ID for another engine with dispatch_engine_mismatch before any network call', t => {
  const s = sandbox(t);
  const env = { CONTROL_CENTER_ENGINE_TOKEN:FAKE_TOKEN, CC_DIRECTIVE_ID:'legibility:2026-10-19' };
  for (const engine of ['growth-heartside', 'growth-legibility ', 'Growth-Legibility', 'growth-legibility-staging', 'legibility']) {
    refused(s.cli(['operate'], { ...env, CC_ENGINE_ID:engine }), 'dispatch_engine_mismatch', JSON.stringify(engine));
  }
  assert.equal(s.calls(), 0);
  assert.ok(!existsSync(s.runtime));
  // The control: this engine's own id goes on to the network.
  const ok = s.cli(['operate'], { ...env, CC_ENGINE_ID:'growth-legibility' });
  assert.ok(s.calls() > 0);
  assert.equal(JSON.parse(ok.stdout).error_code, 'receiver_transport_uncertain');
});

// src/cli.mjs:36-37: GITHUB_RUN_ID and GITHUB_RUN_ATTEMPT reach the run id only when both are plain digits of a bounded
// length; otherwise the invocation is a random local id. The run id is printed in the operate summary.
test('a GitHub run number or attempt that is not plain digits never reaches the run id, which falls back to a random local id', t => {
  const s = sandbox(t);
  const env = { CONTROL_CENTER_ENGINE_TOKEN:FAKE_TOKEN };
  const runId = extra => JSON.parse(s.cli(['operate'], { ...env, ...extra }).stdout).run_id;
  for (const extra of [{ GITHUB_RUN_ID:'123;touch pwned', GITHUB_RUN_ATTEMPT:'1' }, { GITHUB_RUN_ID:'123', GITHUB_RUN_ATTEMPT:'1 2' },
    { GITHUB_RUN_ID:'1'.repeat(21), GITHUB_RUN_ATTEMPT:'1' }, { GITHUB_RUN_ID:'123', GITHUB_RUN_ATTEMPT:'1234567' }]) {
    assert.match(runId(extra), /^legibility:\d{4}-\d{2}-\d{2}:operate:local[0-9a-f]{12}$/, JSON.stringify(extra));
  }
  // The control: plain digits are carried into the run id as the GitHub invocation.
  assert.match(runId({ GITHUB_RUN_ID:'123', GITHUB_RUN_ATTEMPT:'2' }), /:operate:gh123\.2$/);
});
