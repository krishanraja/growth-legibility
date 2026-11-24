// The insight desk's sheet, read by fixed rules (Ruling, Krish, 2026-11-24: the ai-harness insight-desk skill with a
// thin adapter in each growth engine; config/insight-desk.json). The desk writes ideas, never copy: a sheet names up to
// three ideas, each with a claim, a mechanic and a conversion path, and how each was screened. This file only reads a
// sheet a Claude session wrote into ignored runtime/insight/; it never writes one, calls a model or reaches Krish.
//
// The rules are the skill's own (insight-sheet/1, its scripts/validate_sheet.py), rewritten for Node so this engine
// can check a sheet without Python. The method list stays in ai-harness: it is read from a local checkout when the
// adapter can find one, and otherwise the method is checked only as filled and the result says so.
//
// Its one use here: a valid sheet's ideas become extra impact angles the reader check may carry beside Wave 1's three
// fixed ones (src/lib/reader.mjs), as `insight:<idea id>`. Without a sheet nothing changes. Pure, apart from
// knownMethods() and methodsFromAdapter(), which read files.
import { createHash } from 'node:crypto';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export const SCHEMA = 'insight-sheet/1';
const TOP_KEYS = ['schema', 'venture', 'repo', 'harness_skill_sha', 'made_at', 'north_star', 'stall_check', 'insights', 'chosen_insight', 'discarded_obvious', 'ideas', 'consults', 'lead', 'blind_passes', 'sheet_sha256'];
const DIAGNOSES = ['idea', 'distribution', 'offer', 'attribution', 'measurement'];
const LEVELS = ['execution', 'campaign', 'platform', 'business', 'measurement'];
const TEST_KEYS = ['specificity', 'share', 'analogue', 'floor', 'kill_the_favourite'];
const RESULTS = ['pass', 'fail', 'unavailable'];
const CONSULT_RESULTS = ['pass', 'flagged', 'unavailable'];
const ENGINES = ['divergent-thinker', 'humour-engine'];
const IDEA_KEYS = ['id', 'claim', 'mechanic', 'idea_level', 'method', 'channel_role', 'conversion_path', 'kill_condition', 'tests'];
const PATH_KEYS = ['offer', 'link', 'why_act'];
const ID_RE = /^[a-z0-9][a-z0-9-]{0,39}$/;
const REPO_RE = /^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/;
const SHA1_RE = /^[0-9a-f]{40}$/;
const SHA256_RE = /^[0-9a-f]{64}$/;
const SCORE_KEY = /^(score|scores|rating|points|weight|weighted_total|total)$/i;
const EM_DASH = String.fromCodePoint(0x2014);
/** The prefix an insight-sourced angle carries, so it can never be mistaken for one of the three fixed angles. */
export const ANGLE_PREFIX = 'insight:';

const isObj = v => v !== null && typeof v === 'object' && !Array.isArray(v);
const filled = v => typeof v === 'string' && v.trim() !== '';
const isInt = v => Number.isInteger(v);
const isDate = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T00:00:00Z`)) && new Date(`${v}T00:00:00Z`).toISOString().slice(0, 10) === v;
const isDateTime = v => typeof v === 'string' && v.includes('T') && Number.isFinite(Date.parse(v));
const sameSet = (obj, keys) => isObj(obj) && Object.keys(obj).length === keys.length && keys.every(k => Object.hasOwn(obj, k));
const extraKeys = (obj, keys) => Object.keys(obj).filter(k => !keys.includes(k)).sort();
const plain = s => String(s).toLowerCase().split(/\s+/).filter(Boolean).join(' ');

/** JSON with every object's keys sorted and no spaces: the bytes the sheet's hash is taken over. Pure. */
export function canonicalJson(value) {
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  if (isObj(value)) return `{${Object.keys(value).sort().map(k => `${JSON.stringify(k)}:${canonicalJson(value[k])}`).join(',')}}`;
  return JSON.stringify(value);
}

/** The sheet_sha256 a sheet should carry: SHA-256 of the canonical sheet without that field. Pure. */
export function sheetSha(sheet) {
  const { sheet_sha256, ...body } = isObj(sheet) ? sheet : {};
  return createHash('sha256').update(canonicalJson(body), 'utf8').digest('hex');
}

/** The method ids in an ai-harness checkout's methods-by-category.md, or null when it cannot be read. */
export function knownMethods(path) {
  try {
    const ids = [...readFileSync(path, 'utf8').matchAll(/^### `([a-z0-9-]+)`/gm)].map(m => m[1]);
    return ids.length ? new Set(ids) : null;
  } catch { return null; }
}

/**
 * The skill's method set from the first local ai-harness checkout the adapter names (`skill.local_paths`, relative to
 * the repository root), or null when none is found. Reads files; never throws.
 */
export function methodsFromAdapter(adapter, root) {
  for (const p of Array.isArray(adapter?.skill?.local_paths) ? adapter.skill.local_paths : []) {
    const file = resolve(root, String(p), 'references/methods-by-category.md');
    const m = existsSync(file) ? knownMethods(file) : null;
    if (m) return m;
  }
  return null;
}

function checkTest(label, test, errors, analogue) {
  if (!isObj(test)) { errors.push(`${label}: missing`); return; }
  const extra = extraKeys(test, analogue ? ['result', 'reason', 'url', 'read_at'] : ['result', 'reason']);
  if (extra.length) errors.push(`${label}: unexpected fields ${extra.join(', ')}`);
  if (!RESULTS.includes(test.result)) errors.push(`${label}: result must be pass, fail or unavailable`);
  if (!filled(test.reason)) errors.push(`${label}: needs a reason`);
  if (analogue) {
    for (const k of ['url', 'read_at']) if (!Object.hasOwn(test, k)) errors.push(`${label}: needs ${k} (null when none was found)`);
    if (test.result === 'pass') {
      if (!filled(test.url)) errors.push(`${label}: a passing analogue is linked`);
      if (!isDate(test.read_at)) errors.push(`${label}: a passing analogue records the date it was read`);
    }
  }
}

function checkIdea(i, idea, methods, errors) {
  const label = `ideas[${i}]`;
  if (!isObj(idea)) { errors.push(`${label}: not an object`); return; }
  const missing = IDEA_KEYS.filter(k => !Object.hasOwn(idea, k));
  if (missing.length) errors.push(`${label}: missing ${missing.join(', ')}`);
  const extra = extraKeys(idea, IDEA_KEYS);
  if (extra.length) errors.push(`${label}: unexpected fields ${extra.join(', ')}`);
  if (!(typeof idea.id === 'string' && ID_RE.test(idea.id))) errors.push(`${label}: id must be lower-case letters, digits and hyphens`);
  for (const k of ['claim', 'mechanic', 'channel_role', 'kill_condition']) if (Object.hasOwn(idea, k) && !filled(idea[k])) errors.push(`${label}: ${k} is empty`);
  if (!LEVELS.includes(idea.idea_level)) errors.push(`${label}: idea_level must be one of ${LEVELS.join(', ')}`);
  if (methods ? !methods.has(idea.method) : !filled(idea.method)) errors.push(`${label}: method is not in the skill's methods-by-category.md`);
  const path = idea.conversion_path;
  if (!isObj(path) || !PATH_KEYS.every(k => filled(path[k]))) errors.push(`${label}: an idea with no full conversion path (offer, link, why_act) is held off the sheet`);
  else if (extraKeys(path, PATH_KEYS).length) errors.push(`${label}: conversion_path has unexpected fields`);
  const tests = idea.tests;
  if (!isObj(tests)) { errors.push(`${label}: tests missing`); return; }
  const extraTests = extraKeys(tests, TEST_KEYS);
  if (extraTests.length) errors.push(`${label}: unexpected tests ${extraTests.join(', ')}`);
  for (const k of TEST_KEYS) checkTest(`${label}.tests.${k}`, tests[k], errors, k === 'analogue');
}

function checkInsight(i, insight, errors) {
  const label = `insights[${i}]`;
  if (!isObj(insight)) { errors.push(`${label}: not an object`); return; }
  for (const k of ['audience', 'wants', 'but', 'because']) if (!filled(insight[k])) errors.push(`${label}: ${k} is empty`);
  const extra = extraKeys(insight, ['audience', 'wants', 'but', 'because', 'source', 'read_at', 'assumption']);
  if (extra.length) errors.push(`${label}: unexpected fields ${extra.join(', ')}`);
  const sourced = Object.hasOwn(insight, 'source') || Object.hasOwn(insight, 'read_at');
  const assumed = Object.hasOwn(insight, 'assumption');
  if (sourced && assumed) errors.push(`${label}: either a source and read_at, or assumption: true, never both`);
  else if (assumed) { if (insight.assumption !== true) errors.push(`${label}: assumption must be true when present`); }
  else if (!(filled(insight.source) && isDate(insight.read_at))) errors.push(`${label}: needs a source and the date it was read, or assumption: true`);
}

function walkForScores(node, where, errors) {
  if (Array.isArray(node)) node.forEach((v, i) => walkForScores(v, `${where}[${i}]`, errors));
  else if (isObj(node)) for (const [k, v] of Object.entries(node)) {
    if (SCORE_KEY.test(k)) errors.push(`${where}.${k}: no scores; the sheet carries results and reasons only`);
    walkForScores(v, `${where}.${k}`, errors);
  } else if (typeof node === 'string' && node.includes(EM_DASH)) errors.push(`${where}: carries an em dash`);
}

/**
 * Every reason a sheet is not a valid insight-sheet/1, in plain words; [] means valid. `methods` is the skill's method
 * set (knownMethods), or null to check only that a method is named. Never throws. Pure.
 */
export function validateSheet(sheet, { methods = null } = {}) {
  const errors = [];
  if (!isObj(sheet)) return ['the sheet is not a JSON object'];
  const missing = TOP_KEYS.filter(k => !Object.hasOwn(sheet, k));
  if (missing.length) errors.push(`missing ${missing.join(', ')}`);
  const extra = extraKeys(sheet, TOP_KEYS);
  if (extra.length) errors.push(`unexpected fields ${extra.join(', ')}`);
  if (sheet.schema !== SCHEMA) errors.push(`schema must be ${SCHEMA}`);
  if (!filled(sheet.venture)) errors.push('venture is empty');
  if (!(typeof sheet.repo === 'string' && REPO_RE.test(sheet.repo))) errors.push('repo must be owner/name');
  if (!(typeof sheet.harness_skill_sha === 'string' && SHA1_RE.test(sheet.harness_skill_sha))) errors.push('harness_skill_sha must be the 40-character commit the skill was read at');
  if (!isDateTime(sheet.made_at)) errors.push('made_at must be an ISO date-time');

  let urgency = null, current = null;
  const ns = sheet.north_star;
  if (!sameSet(ns, ['metric', 'urgency', 'current', 'as_of'])) errors.push('north_star needs exactly metric, urgency, current and as_of');
  else {
    ({ urgency, current } = ns);
    if (!filled(ns.metric)) errors.push('north_star.metric is empty');
    if (!(isInt(urgency) && urgency >= 1 && urgency <= 5)) errors.push('north_star.urgency must be 1 to 5');
    if (current !== null && !(typeof current === 'number' && Number.isFinite(current))) errors.push('north_star.current must be a number or null');
    if (ns.as_of !== null && !isDate(ns.as_of)) errors.push('north_star.as_of must be a date or null');
  }

  let diagnosis = null;
  const stall = sheet.stall_check;
  if (!sameSet(stall, ['diagnosis', 'evidence'])) errors.push('stall_check needs exactly diagnosis and evidence');
  else {
    diagnosis = stall.diagnosis;
    if (!DIAGNOSES.includes(diagnosis)) errors.push(`stall_check.diagnosis must be one of ${DIAGNOSES.join(', ')}`);
    else if (!['idea', 'measurement'].includes(diagnosis)) errors.push(`the stall is ${diagnosis}, not the idea; the desk stops and makes no sheet`);
    if (!filled(stall.evidence)) errors.push('stall_check.evidence is empty');
  }

  let insights = sheet.insights;
  if (!Array.isArray(insights) || insights.length < 1 || insights.length > 3) { errors.push('insights must hold one to three lines'); if (!Array.isArray(insights)) insights = []; }
  insights.forEach((x, i) => checkInsight(i, x, errors));
  if (!(isInt(sheet.chosen_insight) && sheet.chosen_insight >= 0 && sheet.chosen_insight < insights.length)) errors.push('chosen_insight must point at one of the insights');

  let obvious = sheet.discarded_obvious;
  if (!(Array.isArray(obvious) && obvious.length === 3 && obvious.every(filled))) { errors.push('discarded_obvious must hold exactly three ideas'); obvious = []; }

  let ideas = sheet.ideas;
  if (!Array.isArray(ideas) || ideas.length < 1 || ideas.length > 3) { errors.push('ideas must hold one to three ideas'); if (!Array.isArray(ideas)) ideas = []; }
  ideas.forEach((x, i) => checkIdea(i, x, methods, errors));
  const byId = new Map(ideas.filter(isObj).map(x => [x.id, x]));
  if (byId.size !== ideas.length) errors.push('idea ids must be unique');
  const obviousSet = new Set(obvious.map(plain));
  for (const idea of byId.values()) if (obviousSet.has(plain(idea.claim ?? ''))) errors.push(`idea ${idea.id}: restates a discarded obvious idea`);
  if (diagnosis === 'measurement' || (urgency === 4 && current === null)) {
    for (const idea of byId.values()) if (idea.idea_level !== 'measurement') errors.push(`idea ${idea.id}: nothing is measured, so every idea is a measurement idea`);
  }

  let consults = sheet.consults;
  if (!Array.isArray(consults)) { errors.push('consults must be a list (empty when no engine was called)'); consults = []; }
  consults.forEach((c, i) => {
    if (!sameSet(c, ['engine', 'op', 'result', 'ref'])) { errors.push(`consults[${i}]: needs exactly engine, op, result and ref`); return; }
    if (!ENGINES.includes(c.engine)) errors.push(`consults[${i}]: engine must be one of ${ENGINES.join(', ')}`);
    if (!CONSULT_RESULTS.includes(c.result)) errors.push(`consults[${i}]: result must be pass, flagged or unavailable; exit 2 is unavailable, never pass`);
    if (!filled(c.op) || !filled(c.ref)) errors.push(`consults[${i}]: op and ref are filled`);
  });

  let passes = sheet.blind_passes;
  if (!Array.isArray(passes) || passes.length !== 2) { errors.push('blind_passes must hold exactly two passes'); passes = []; }
  const ids = JSON.stringify([...byId.keys()].sort());
  passes.forEach((p, i) => {
    if (!sameSet(p, ['reader', 'order', 'lead'])) { errors.push(`blind_passes[${i}]: needs exactly reader, order and lead`); return; }
    if (!filled(p.reader)) errors.push(`blind_passes[${i}]: name the reader`);
    if (!Array.isArray(p.order) || JSON.stringify([...p.order].sort()) !== ids) errors.push(`blind_passes[${i}]: order must list every idea id once`);
    if (p.lead !== null && !byId.has(p.lead)) errors.push(`blind_passes[${i}]: lead is not an idea on the sheet`);
  });
  if (passes.length === 2 && passes.every(isObj)) {
    if (byId.size > 1 && JSON.stringify(passes[0].order) === JSON.stringify(passes[1].order)) errors.push('blind_passes: the two orders must be shuffled differently');
    if (passes.some(p => ['writer', 'author'].includes(p.reader))) errors.push('blind_passes: the reader is never the writer of the ideas');
  }

  const lead = sheet.lead;
  if (lead !== null && lead !== undefined) {
    if (!byId.has(lead)) errors.push('lead is not an idea on the sheet');
    else {
      if (!passes.length || passes.some(p => isObj(p) && p.lead !== lead)) errors.push('lead: both blind passes must pick the same lead; otherwise lead is null');
      const tests = byId.get(lead).tests ?? {};
      for (const k of TEST_KEYS) { const r = tests?.[k]?.result; if (r !== 'pass') errors.push(`lead ${lead}: ${k} is ${r}; an idea leads only when every test passed`); }
    }
  }

  walkForScores(sheet, 'sheet', errors);

  if (!(typeof sheet.sheet_sha256 === 'string' && SHA256_RE.test(sheet.sheet_sha256))) errors.push('sheet_sha256 must be 64 lower-case hex characters');
  else if (sheet.sheet_sha256 !== sheetSha(sheet)) errors.push('sheet_sha256 does not match the sheet; recompute it');
  return errors;
}

/**
 * The impact angles a sheet adds to the reader check: `insight:<idea id>` for each idea, the lead first. Only a valid
 * sheet adds any; an invalid one adds none, never a partial list. Pure.
 */
export function sheetAngles(sheet, opts = {}) {
  if (validateSheet(sheet, opts).length) return [];
  const ids = sheet.ideas.map(x => x.id);
  const ordered = sheet.lead ? [sheet.lead, ...ids.filter(id => id !== sheet.lead)] : ids;
  return ordered.map(id => `${ANGLE_PREFIX}${id}`);
}

/**
 * Whether a sheet may become an ask on Krish's list. While the engine is held (config/activation.json or Control
 * Center; src/lib/hold.mjs) it may not: the sheet stays local and the reader check still runs in shadow. Pure.
 */
export function sheetMayAsk(heldByList) {
  return Array.isArray(heldByList) && heldByList.length === 0;
}
