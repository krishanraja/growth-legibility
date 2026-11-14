/**
 * The Librarian's scan (docs/ENGINE-ARCHITECTURE.md section 4, "Check, at every check-in"), over the library
 * Control Center serves in the directive (protocol 1.35.0, fleet integration I-25; Ruling, Krish, 2026-11-14:
 * Control Center reads folder names and file titles, never contents, under Ventures once a day).
 *
 * Counts only, from titles and folders: files at the root other than START-HERE, files in a folder the taxonomy does
 * not name, names that fail the naming rule, "Copy of" or "Untitled" titles, duplicate names, and folders deeper than
 * the taxonomy allows. Findability is the share of files that conform. Private content cannot be scanned from titles,
 * so it stays unknown. A part Control Center cannot vouch for is unknown, never clean. Pure; it moves nothing.
 */
import { readFileSync } from 'node:fs';

let read = null;
/** librarian/drive-taxonomy.json, read the first time a served library is scanned. */
export function taxonomy() {
  read ??= JSON.parse(readFileSync(new URL('../../librarian/drive-taxonomy.json', import.meta.url), 'utf8'));
  return read;
}
export const COUNTS = ['loose_at_root', 'outside_map', 'bad_names', 'copies_or_untitled', 'duplicates', 'too_deep'];

const WAVE = (t) => (t.exceptions?.folder_patterns ?? []).map(p => new RegExp(p));

/** Whether a folder path (from the root's own name) is one the taxonomy names, a wave folder counting as 02_Waves/<wave-folder>. */
export function knownFolder(folder, t = taxonomy()) {
  const rel = folder === t.root ? '' : folder.startsWith(`${t.root}/`) ? folder.slice(t.root.length + 1) : null;
  if (rel === null) return false;
  if (rel === '') return true;
  if (t.folders.includes(rel)) return true;
  const [top, wave, ...rest] = rel.split('/');
  return top === '02_Waves' && !rest.length && WAVE(t).some(re => re.test(wave ?? ''));
}

export function scan(part, given = null) {
  if (!part || typeof part !== 'object') return { state: 'not_served', reason: 'library_not_served' };
  if (part.available !== true || part.complete !== true) return { state: 'unknown', reason: String(part.reason ?? 'not_available') };
  let t = given;
  try { t ??= taxonomy(); } catch { return { state: 'unknown', reason: 'taxonomy_unreadable' }; }
  const root = (Array.isArray(part.roots) ? part.roots : []).find(r => typeof r?.root === 'string' && r.root.endsWith(`/${t.root}`));
  if (!root) return { state: 'unknown', reason: 'declared_root_not_served' };
  const naming = new RegExp(t.naming);
  const files = (root.files ?? []).filter(f => typeof f?.title === 'string' && typeof f?.folder === 'string');
  const counts = Object.fromEntries(COUNTS.map(k => [k, 0]));
  const seen = new Map();
  let conform = 0;
  for (const f of files) {
    const exempt = (t.exceptions?.files ?? []).includes(f.title);
    const base = f.title.replace(/\.[a-z0-9]{1,5}$/i, '');
    let ok = true;
    if (f.folder === t.root && !exempt) { counts.loose_at_root++; ok = false; }
    if (!knownFolder(f.folder, t)) { counts.outside_map++; ok = false; }
    if (!exempt && !naming.test(f.title) && !naming.test(base)) { counts.bad_names++; ok = false; }
    if (/^(copy of |untitled)/i.test(f.title)) { counts.copies_or_untitled++; ok = false; }
    const key = `${f.folder}|${base.toLowerCase()}`;
    seen.set(key, (seen.get(key) ?? 0) + 1);
    if (ok) conform++;
  }
  for (const n of seen.values()) if (n > 1) counts.duplicates += n - 1;
  for (const d of root.folders ?? []) {
    const depth = String(d.folder ?? '').split('/').length - 1;
    if (depth > (t.max_depth ?? 3)) counts.too_deep++;
  }
  return { state: 'scanned', as_of: part.as_of ?? null, files: files.length, conform, findability: files.length ? Math.round((conform / files.length) * 100) : null, counts, private_content: 'unknown' };
}
