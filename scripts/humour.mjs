/**
 * The humour guard, at will, from any session in this repository: does this Legibility copy read as a joke?
 * Humour on outbound email is "Never" and on Legibility it is not ruled, so a reading that finds one flags it.
 * Through Control Center's humour route on this engine's own bearer (POST /api/growth/engines/legibility/humour,
 * src/lib/humour.mjs). Ported from growth-mindmake's command (growth-mindmake#170), same exit codes.
 *
 *   npm run humour -- --file PATH [--surface invitation|post|page|line] [--lane NAME]
 *
 * The file holds the lines to read, one a line. `--lane` labels the reading growth-legibility:<lane> instead of
 * growth-legibility; the label is printed, never sent. Capabilities are read first: nothing is asked unless
 * Control Center says features.humour, and nothing while it holds or pauses this engine. Control Center caps
 * this engine at 200 readings a day; a 429 is final for the day and nothing is retried.
 *
 * It prints counts and codes, never the words. Exit 0 pass, 1 flagged, 2 unavailable (no bearer, not served,
 * held, capped, refused, no reading or a malformed command): 2 is never a pass. It writes nothing to his list,
 * the report or the repository, and sends nothing.
 */
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { APPROVED_ORIGIN, controlCenter } from '../src/transport.mjs';
import { EXIT, LANE, SURFACES, engineHeld, guard, humourServed } from '../src/lib/humour.mjs';

export const DEFAULT_URL = APPROVED_ORIGIN;
export const engineClient = (base, token) => controlCenter({ base, token });
export const USAGE = `Usage: npm run humour -- --file PATH [--surface ${Object.keys(SURFACES).join('|')}] [--lane NAME]`;
export const NO_BEARER = 'Humour: not read. This machine has no Control Center engine bearer (CONTROL_CENTER_ENGINE_TOKEN, the one the daily dispatch uses). Write "humour engine not run" beside the draft and check it by hand.';

/** The options from argv, or null when malformed. Pure. */
export function parseArgs(argv) {
  const o = { surface: 'line' };
  for (let i = 0; i < argv.length; i++) {
    const v = argv[i + 1];
    if (argv[i] === '--file' && v && !v.startsWith('--')) { o.file = v; i++; }
    else if (argv[i] === '--surface' && Object.hasOwn(SURFACES, v ?? '')) { o.surface = v; i++; }
    else if (argv[i] === '--lane' && LANE.test(v ?? '')) { o.lane = v; i++; }
    else return null;
  }
  return o.file ? o : null;
}

export async function run(argv, { env = process.env, makeClient = engineClient, read = p => readFile(resolve(p), 'utf8'), out = s => process.stdout.write(s), err = s => process.stderr.write(s) } = {}) {
  const o = parseArgs(argv);
  if (!o) { err(`${USAGE}\n`); return EXIT.unavailable; }
  let lines;
  try { lines = String(await read(o.file)).split(/\r?\n/); }
  catch (e) { err(`Humour: not read, the file could not be read (${e?.code ?? 'unreadable'}).\n`); return EXIT.unavailable; }
  let cc;
  try { cc = makeClient(env.CONTROL_CENTER_URL || DEFAULT_URL, env.CONTROL_CENTER_ENGINE_TOKEN); }
  catch { err(`${NO_BEARER}\n`); return EXIT.unavailable; }
  let capabilities;
  try { capabilities = await cc.capabilities(); }
  catch { err('Humour: Control Center\'s capabilities could not be read, so nothing was asked.\n'); return EXIT.unavailable; }
  if (!humourServed(capabilities)) { err('Humour: not served. Control Center does not say features.humour, so no call was made. Unavailable is never a pass.\n'); return EXIT.unavailable; }
  if (engineHeld(capabilities)) { err('Humour: not asked. Control Center holds this engine, and a reading asks a model. Unavailable is never a pass.\n'); return EXIT.unavailable; }
  const result = await guard(lines, { cc, surface: o.surface, capabilities, lane: o.lane });
  out(`${JSON.stringify(result, null, 2)}\n`);
  if (result.status === 'unavailable') err(`Humour: unavailable, ${result.reason}. Unavailable is never a pass.\n`);
  return EXIT[result.status];
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) process.exitCode = await run(process.argv.slice(2));
