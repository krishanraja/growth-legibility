/**
 * Check an insight sheet (insight-sheet/1) from a Claude session (config/insight-desk.json; src/lib/insight-sheet.mjs).
 *
 *   npm run insight -- check <sheet.json>       valid for this engine, or every reason it is not (a sheet whose repo or
 *                                               venture is not the adapter's is refused); exit 0 valid, 1 invalid, 2 unreadable
 *   npm run insight -- sha <sheet.json>         the sheet_sha256 the sheet should carry
 *
 * It reads and reports; it writes nothing, calls no model and puts nothing on Krish's list. The method list is read
 * from a local ai-harness checkout the adapter names; when none is found, methods are checked only as named and the
 * output says so. While the engine is held it says the sheet stays local.
 */
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { resolve, join } from 'node:path';
import { validateSheet, ownerErrors, sheetSha, sheetAngles, sheetMayAsk, methodsFromAdapter } from '../src/lib/insight-sheet.mjs';
import { readActivation, heldBy } from '../src/lib/hold.mjs';

const root = fileURLToPath(new URL('../', import.meta.url));
const [cmd, file] = process.argv.slice(2);
if (!['check', 'sha'].includes(cmd) || !file) { console.error('Usage: npm run insight -- check <sheet.json> | sha <sheet.json>'); process.exit(2); }
let sheet;
try { sheet = JSON.parse(await readFile(resolve(file), 'utf8')); } catch (e) { console.error(`cannot read the sheet: ${e.message}`); process.exit(2); }
if (cmd === 'sha') { console.log(sheetSha(sheet)); process.exit(0); }

let adapter = null;
try { adapter = JSON.parse(await readFile(join(root, 'config/insight-desk.json'), 'utf8')); } catch { adapter = null; }
const methods = methodsFromAdapter(adapter, root);
const errors = [...ownerErrors(sheet, adapter), ...validateSheet(sheet, { methods })];
if (errors.length) { for (const e of errors) console.log(`INVALID  ${e}`); process.exit(1); }
const held = heldBy({ local: readActivation(join(root, 'config/activation.json')) });
console.log(`VALID ${sheet.schema}: ${sheet.ideas.length} idea(s), lead ${sheet.lead ?? 'none'}; reader angles ${sheetAngles(sheet, { methods }).join(', ')}.`);
console.log(methods ? `Methods checked against the local ai-harness skill (${methods.size} methods).` : 'Methods checked only as named: no local ai-harness checkout of the skill was found.');
console.log(sheetMayAsk(held) ? 'The engine is active: the sheet may go to Krish as stage plan behind strategy.' : `The engine is held (${held.join(', ')}): the sheet stays local and puts no ask on Krish's list.`);
