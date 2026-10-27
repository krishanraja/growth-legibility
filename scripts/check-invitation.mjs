// The invitation gate for items a session prepares by hand under stable ids, such as Wave 0 (docs/ENGINE-ARCHITECTURE.md,
// section 0), which `run` cannot carry: it runs the snapshot's candidate validation and prepare's whole per-candidate gate
// (candidateGate: contact history, the Mindmake holds, signal, relationship, scores and every draft check), with no approved
// ICP needed. It runs on the real clock, against records read in the last max_snapshot_age_hours (config/policy.json). The
// input stays in the ignored runtime/input spool, and the output is each item's sha256 prefix and its codes, never a name,
// link or word of a draft. An item with any code is not resubmitted.
// Usage: npm run check:invitation -- --input runtime/input/<file>.json
// Input: { "captured_at": "<UTC instant the records were read>", "candidates": [ <snapshot candidates> ] }
import { realpathSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadJson } from '../src/orchestrator.mjs';
import { validateCandidate, validatePolicy, capturedBy, utcInstant, sha256, canonical } from '../src/guards/wire.mjs';
import { candidateGate } from '../src/stages/prepare.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ID = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,159}$/;
// Only a code-shaped message is printed; anything else could quote private input.
const codeOf = e => /^[a-zA-Z0-9_:.-]+$/.test(e?.message ?? '') ? e.message : 'candidate_check_failed';

export function checkInvitations(input, at, policy = {}) {
  if (!utcInstant(at)) throw new Error('invalid_clock');
  const hours = policy.max_snapshot_age_hours ?? 24;
  if (!Number.isInteger(hours) || hours < 1 || hours > 24) throw new Error('invalid_policy');
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(k => !['captured_at', 'candidates'].includes(k))) throw new Error('invalid_input');
  if (!utcInstant(input.captured_at) || Date.parse(input.captured_at) > Date.parse(at)) throw new Error('invalid_input_capture');
  // A Mindmake record read days ago is not current: re-read every record on the day the items are resubmitted.
  if (Date.parse(at) - Date.parse(input.captured_at) > hours * 3_600_000) throw new Error('input_stale_capture');
  if (!Array.isArray(input.candidates) || input.candidates.length === 0 || input.candidates.length > 100) throw new Error('invalid_input_candidates');
  const before = capturedBy(input.captured_at);
  const refOf = c => typeof c?.id === 'string' ? c.id : canonical(c);
  // Every item that shares an id is held, so no version of a duplicated id ever shows an empty code list.
  const versions = new Map();
  for (const c of input.candidates) versions.set(refOf(c), [...(versions.get(refOf(c)) ?? []), sha256(canonical(c))]);
  const items = input.candidates.map(c => {
    const ref = refOf(c), same = versions.get(ref), codes = [];
    if (!ID.test(ref)) codes.push('invalid_candidate_id');
    if (same.length > 1) codes.push(new Set(same).size > 1 ? 'conflicting_candidate' : 'duplicate_candidate_id');
    try {
      validateCandidate(c, before);
      codes.push(...candidateGate(c, at, policy).codes);
    } catch (e) { codes.push(codeOf(e)); }
    return { item:sha256(ref).slice(0, 16), codes:[...new Set(codes)].sort() };
  });
  return { checked:items.length, held:items.filter(i => i.codes.length).length, items };
}

function args(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (argv[i] !== '--input' || !argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error('invalid_cli_arguments');
    if (argv[i].slice(2) in out) throw new Error('duplicate_cli_argument');
    out[argv[i].slice(2)] = argv[i + 1];
  }
  if (!out.input) throw new Error('input_required');
  return out;
}

// Both sides as real paths, so a symlink, or a Windows short name for a folder, cannot slip past a check.
const real = path => { try { return realpathSync.native(path); } catch { return null; } };
const self = real(fileURLToPath(import.meta.url));
if (process.argv[1] && self !== null && real(resolve(process.argv[1])) === self) {
  process.exitCode = 1;
  try {
    const opts = args(process.argv.slice(2));
    const inbox = real(resolve(root, 'runtime', 'input')), file = real(resolve(opts.input));
    if (inbox === null || file === null) throw new Error('input_unreadable');
    if (![`${inbox}/`, `${inbox}\\`].some(prefix => file.startsWith(prefix))) throw new Error('input_must_be_private_runtime');
    let policy, input;
    try { policy = validatePolicy(loadJson(resolve(root, 'config', 'policy.json'))); } catch { throw new Error('policy_unreadable'); }
    try { input = loadJson(file); } catch (e) { throw new Error(e.message === 'input_size_limit' ? e.message : 'input_unreadable'); }
    const result = checkInvitations(input, new Date().toISOString(), policy);
    console.log(JSON.stringify(result, null, 2));
    process.exitCode = result.held ? 1 : 0;
  } catch (e) {
    console.error(codeOf(e));
  }
}
