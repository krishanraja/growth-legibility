// The invitation gate for items a session prepares by hand under stable ids, such as Wave 0 (docs/ENGINE-ARCHITECTURE.md,
// section 0), which `run` cannot carry: it runs the snapshot's candidate validation, the Mindmake holds and every draft check
// from prepare, with no approved ICP needed. The input stays in the ignored runtime/input spool, and the output is each
// item's sha256 prefix and its codes, never a name, link or word of a draft. An item with any code is not resubmitted.
// Usage: npm run check:invitation -- --input runtime/input/<file>.json [--at <UTC instant>]
// Input: { "captured_at": "<UTC instant the records were read>", "candidates": [ <snapshot candidates> ] }
import { realpathSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { loadJson } from '../src/orchestrator.mjs';
import { validateCandidate, capturedBy, utcInstant, sha256, canonical } from '../src/guards/wire.mjs';
import { mindmakeHolds, draftProblems } from '../src/stages/prepare.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const ID = /^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,159}$/;
// Only a code-shaped message is printed; anything else could quote private input.
const codeOf = e => /^[a-zA-Z0-9_:.-]+$/.test(e?.message ?? '') ? e.message : 'candidate_check_failed';

export function checkInvitations(input, at) {
  if (!input || typeof input !== 'object' || Array.isArray(input) || Object.keys(input).some(k => !['captured_at', 'candidates'].includes(k))) throw new Error('invalid_input');
  if (!utcInstant(input.captured_at) || Date.parse(input.captured_at) > Date.parse(at)) throw new Error('invalid_input_capture');
  if (!Array.isArray(input.candidates) || input.candidates.length === 0 || input.candidates.length > 100) throw new Error('invalid_input_candidates');
  const before = capturedBy(input.captured_at), seen = new Set();
  const items = input.candidates.map(c => {
    const codes = [];
    const ref = typeof c?.id === 'string' ? c.id : canonical(c);
    if (!ID.test(ref)) codes.push('invalid_candidate_id');
    if (seen.has(ref)) codes.push('duplicate_candidate_id');
    seen.add(ref);
    try {
      validateCandidate(c, before);
      if (c.contact.status !== 'clear') codes.push('contact_status_unknown');
      codes.push(...mindmakeHolds(c, at), ...draftProblems(c, at));
    } catch (e) { codes.push(codeOf(e)); }
    return { item:sha256(ref).slice(0, 16), codes:[...new Set(codes)].sort() };
  });
  return { checked:items.length, held:items.filter(i => i.codes.length).length, items };
}

function args(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 2) {
    if (!['--input', '--at'].includes(argv[i]) || !argv[i + 1] || argv[i + 1].startsWith('--')) throw new Error('invalid_cli_arguments');
    if (argv[i].slice(2) in out) throw new Error('duplicate_cli_argument');
    out[argv[i].slice(2)] = argv[i + 1];
  }
  if (!out.input) throw new Error('input_required');
  if (out.at !== undefined && !utcInstant(out.at)) throw new Error('invalid_cli_arguments');
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const opts = args(process.argv.slice(2));
    // Both sides as real paths, so a symlink, or a Windows short name for the temp folder, cannot slip past the spool check.
    const real = path => { try { return realpathSync.native(path); } catch { throw new Error('input_unreadable'); } };
    const inbox = real(resolve(root, 'runtime', 'input')), file = real(resolve(opts.input));
    if (![`${inbox}/`, `${inbox}\\`].some(prefix => file.startsWith(prefix))) throw new Error('input_must_be_private_runtime');
    let input;
    try { input = loadJson(file); } catch (e) { throw new Error(e.message === 'input_size_limit' ? e.message : 'input_unreadable'); }
    const result = checkInvitations(input, opts.at ?? new Date().toISOString());
    console.log(JSON.stringify(result, null, 2));
    if (result.held) process.exitCode = 1;
  } catch (e) {
    console.error(codeOf(e));
    process.exitCode = 1;
  }
}
