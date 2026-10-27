// The session ledger (docs/ENGINE-ARCHITECTURE.md, section 11, Phase 1C): what a Claude Code session cost, in counts.
//
//   node scripts/session-ledger.mjs [--until <UTC instant>] [--row] <transcript.jsonl | folder> [more ...]
//
// A transcript writes one line per content block, and every line of one API response repeats that response's usage,
// so usage is counted once per message.id (the largest value seen for each kind, which is the final one). Lines from a
// stand-in model ('<synthetic>') are not API calls and are skipped. A folder is read for its .jsonl files, recursively.
//
// --until counts only what the transcripts held at that instant: each file is cut after its last line stamped at or
// before it, and its SHA-256 is taken over exactly those bytes, so the same row comes back however much the files grow.
//
// It prints counts, instants and SHA-256 digests only: never message text, a path, a session, message or tool id.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const KINDS = ['input_tokens', 'output_tokens', 'cache_read_input_tokens', 'cache_creation_input_tokens'];
const INSTANT = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?Z$/;

export class LedgerError extends Error {
  constructor(code) { super(code); this.code = code; }
}

function jsonlFiles(path, out = []) {
  const stat = statSync(path);
  if (!stat.isDirectory()) { out.push(path); return out; }
  for (const name of readdirSync(path).sort()) {
    const child = join(path, name);
    if (statSync(child).isDirectory()) jsonlFiles(child, out);
    else if (name.endsWith('.jsonl')) out.push(child);
  }
  return out;
}

// The lines of one transcript up to the cut-off, as exact bytes, with the parsed entries they hold.
function cut(bytes, until) {
  const lines = [];
  let start = 0;
  while (start < bytes.length) {
    const end = bytes.indexOf(0x0a, start);
    const stop = end === -1 ? bytes.length : end + 1;
    lines.push(bytes.subarray(start, stop));
    start = stop;
  }
  const parsed = lines.map(line => { try { return JSON.parse(line.toString('utf8')); } catch { return undefined; } });
  let last = lines.length - 1;
  if (until !== null) {
    last = -1;
    parsed.forEach((entry, i) => { const at = Date.parse(entry?.timestamp ?? ''); if (Number.isFinite(at) && at <= until) last = i; });
  }
  const kept = lines.slice(0, last + 1);
  return { digest:createHash('sha256').update(Buffer.concat(kept)).digest('hex'), entries:parsed.slice(0, last + 1), lines:kept.length };
}

// Count one or more transcripts. Returns counts, instants and digests only.
export function ledger(paths, { until = null } = {}) {
  if (until !== null && (!INSTANT.test(until) || !Number.isFinite(Date.parse(until)))) throw new LedgerError('until_invalid');
  const limit = until === null ? null : Date.parse(until);
  const files = paths.flatMap(p => jsonlFiles(resolve(p)));
  if (!files.length) throw new LedgerError('transcript_missing');
  const calls = new Map();
  const transcripts = [];
  let unparsed = 0, synthetic = 0, latest = null;
  for (const file of files) {
    const { digest, entries, lines } = cut(readFileSync(file), limit);
    // A subagent transcript with nothing at the cut-off did not exist yet: leaving it out keeps the row the same however
    // many subagents start later. The session's own transcript (the first) is always listed.
    if (limit !== null && lines === 0 && transcripts.length > 0) continue;
    let ownCalls = 0;
    for (const entry of entries) {
      if (entry === undefined) { unparsed++; continue; }
      const at = Date.parse(entry?.timestamp ?? '');
      if (Number.isFinite(at) && (latest === null || at > latest)) latest = at;
      if (entry?.type !== 'assistant') continue;
      const message = entry.message;
      if (!message || typeof message.id !== 'string' || !message.usage || typeof message.usage !== 'object') continue;
      if (message.model === '<synthetic>') { synthetic++; continue; }
      let call = calls.get(message.id);
      if (!call) { call = Object.fromEntries(KINDS.map(k => [k, 0])); call.first = at; call.last = at; calls.set(message.id, call); ownCalls++; }
      for (const k of KINDS) { const v = message.usage[k]; if (Number.isInteger(v) && v > call[k]) call[k] = v; }
      if (Number.isFinite(at)) { call.first = Number.isFinite(call.first) ? Math.min(call.first, at) : at; call.last = Number.isFinite(call.last) ? Math.max(call.last, at) : at; }
    }
    transcripts.push({ sha256:digest, lines, api_calls:ownCalls });
  }
  const totals = Object.fromEntries(KINDS.map(k => [k, 0]));
  let first = null, last = null;
  for (const call of calls.values()) {
    for (const k of KINDS) totals[k] += call[k];
    if (Number.isFinite(call.first) && (first === null || call.first < first)) first = call.first;
    if (Number.isFinite(call.last) && (last === null || call.last > last)) last = call.last;
  }
  const iso = t => t === null ? null : new Date(t).toISOString();
  return {
    cut_off:until === null ? iso(latest) : new Date(limit).toISOString(),
    transcripts,
    api_calls:calls.size, ...totals,
    first_call_at:iso(first), last_call_at:iso(last),
    synthetic_entries_skipped:synthetic, unparsed_lines:unparsed,
  };
}

const n = v => v.toLocaleString('en-US');
// One row of docs/history/LEDGER.md. The first transcript is the session's own; the rest are its subagents, named by a
// digest of their digests in the order given.
export function ledgerRow(result) {
  const [main, ...subagents] = result.transcripts;
  const subDigest = subagents.length ? createHash('sha256').update(subagents.map(t => t.sha256).join('\n')).digest('hex') : 'none';
  return `| ${result.cut_off} | \`${main.sha256}\` | ${subagents.length} (\`${subDigest}\`) | ${n(result.api_calls)} | ${n(result.input_tokens)} | ${n(result.output_tokens)} | ${n(result.cache_read_input_tokens)} | ${n(result.cache_creation_input_tokens)} | ${result.first_call_at} | ${result.last_call_at} |`;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const argv = process.argv.slice(2);
    let until = null, row = false;
    const paths = [];
    for (let i = 0; i < argv.length; i++) {
      if (argv[i] === '--until') { until = argv[++i] ?? ''; continue; }
      if (argv[i] === '--row') { row = true; continue; }
      if (argv[i].startsWith('--')) throw new LedgerError('unknown_option');
      paths.push(argv[i]);
    }
    if (!paths.length) throw new LedgerError('transcript_missing');
    const result = ledger(paths, { until });
    console.log(row ? ledgerRow(result) : JSON.stringify(result, null, 2));
  } catch (e) {
    // A code only: an error message from the file system would carry the path.
    console.error(e instanceof LedgerError ? e.code : e?.code === 'ENOENT' ? 'transcript_missing' : 'ledger_failed');
    process.exitCode = 1;
  }
}
