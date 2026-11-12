import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { INSTRUCTION_ID, STATE_LIMITS, calendarDay, sha256, stateLine } from '../guards/wire.mjs';

// Control Center protocol 1.20.0 (ENGINE-PROTOCOL.md, "Krish's instruction and the engine's state"). Ruling (Krish,
// 2026-11-11): every growth engine's priorities, obsessions, next steps and outstanding items feed live across Control
// Centre, and Krish instructs each engine with his next best action, which starts it.
//
// Two things, both read only:
//   - his instruction, which the directive carries as krish_instruction (his verbatim words and an id). This runner reads
//     it, puts it first in the run's report and acknowledges it by id. It never prints, logs or commits the words: this
//     repository and its Actions logs are public, so the run summary carries the id and a SHA-256 digest only, and an ack
//     line never quotes him. An instruction is never an approval: the walls do not move.
//   - the engine's state, from this repository's own files and this run's own reading: priorities (the North Star line in
//     docs/NORTH_STAR.md and the run's recommended constraint), obsessions (only Krish's quoted aims, from
//     config/engine-state.json, each pinned to the document it is quoted from by tests/engine-state.test.mjs) and next
//     steps (docs/GET-GOING.md's first unticked phase item and NOW.md's "Waiting on Krish", leaving out any step whose own
//     deadline has passed). Never inferred, never a model: a field with no source is left out, and Control Center then says
//     "Not reported yet".
// Nothing new travels unless the directive says features.engine_state and Control Center takes 1.20.0.

const clip = (text, max) => {
  if (text.length <= max) return text;
  const cut = text.slice(0, max - 3);
  const space = cut.lastIndexOf(' ');
  return `${(space > max / 2 ? cut.slice(0, space) : cut).replace(/[\s,;:(]+$/, '')}...`;
};
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];
const longDate = day => { const d = new Date(`${day}T00:00:00Z`); return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} ${d.getUTCFullYear()}`; };

// A step's own deadline: "by 5 Nov", "on 2026-11-09", "before Monday 9 November 2026". Only a date after by, on or before
// counts, so a date inside an id or in a step's history does not. A day and month with no year take the year of `today`,
// or the next year when that would put it more than half a year behind (a "by 5 Jan" read in December).
const ABBR = MONTHS.map(m => m.slice(0, 3));
const DEADLINE = /\b(?:by|on|before) (?:(?:Monday|Tuesday|Wednesday|Thursday|Friday|Saturday|Sunday) )?(?:(\d{4}-\d{2}-\d{2})|(\d{1,2}) (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)[a-z]*\.?(?: (\d{4}))?)(?![\w-])/g;
/** The deadlines a step names, as YYYY-MM-DD, earliest first. `today` is YYYY-MM-DD. Pure. */
export function deadlines(text, today) {
  const year = Number(String(today).slice(0, 4));
  const out = [];
  for (const m of String(text ?? '').matchAll(DEADLINE)) {
    let day = m[1] ?? null;
    if (!day && Number.isInteger(year)) {
      const at = y => `${y}-${String(ABBR.indexOf(m[3]) + 1).padStart(2, '0')}-${m[2].padStart(2, '0')}`;
      day = m[4] ? at(m[4]) : at(year);
      if (!m[4] && Date.parse(`${today}T00:00:00Z`) - Date.parse(`${day}T00:00:00Z`) > 183 * 86400000) day = at(year + 1);
    }
    if (day && calendarDay(day)) out.push(day);
  }
  return out.sort();
}
/**
 * A next step as Control Center takes it, or null. A step whose own deadline has passed is left out: a dated line nobody
 * updated ("submit the directory listings by 5 Nov") would otherwise be shown on every place as something still to do.
 * A step with a deadline still ahead carries its earliest one as `when`.
 */
export function nextStep(text, waits_on, today) {
  const line = plainLine(text, STATE_LIMITS.line);
  if (!line) return null;
  const due = calendarDay(today ?? '') ? deadlines(text, today) : [];
  if (due.some(d => d < today)) return null;
  return { line, waits_on, when:due[0] ?? null };
}

/** Whether this run may report the engine's state: the directive says so and the receiver takes 1.20.0 (its capabilities). */
export function servesEngineState(directive, features) {
  return directive?.features?.engine_state === true && features?.engine_state === true;
}

const INSTRUCTION_KEYS = ['id', 'words', 'given_at', 'given_by', 'supersedes'];
const isTime = v => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(v) && Number.isFinite(Date.parse(v));

/**
 * Krish's instruction, as the directive carries it (1.20.0, krish_instruction). Returns { instruction, state, reason }:
 * state is not_served (the directive has no such field and does not serve it), unread (served but absent today, unknown),
 * none (null: nothing is open, or the engine is held in Control Center), refused (it broke the shape) or present. Only
 * present returns the instruction, { id, words, given_at, supersedes, words_sha256 }. The words stay in memory only.
 */
export function readInstruction(directive) {
  if (!directive || !Object.hasOwn(directive, 'krish_instruction')) {
    return directive?.features?.krish_instruction === true ? { instruction:null, state:'unread', reason:'instruction_unread' } : { instruction:null, state:'not_served', reason:null };
  }
  const k = directive.krish_instruction;
  if (k === null) return { instruction:null, state:'none', reason:null };
  const ok = k && typeof k === 'object' && !Array.isArray(k) && Object.keys(k).length === INSTRUCTION_KEYS.length && INSTRUCTION_KEYS.every(x => Object.hasOwn(k, x))
    && typeof k.id === 'string' && INSTRUCTION_ID.test(k.id) && typeof k.words === 'string' && k.words.trim().length > 0 && k.words.length <= 2000
    && isTime(k.given_at) && k.given_by === 'krish' && (k.supersedes === null || (typeof k.supersedes === 'string' && INSTRUCTION_ID.test(k.supersedes)));
  if (!ok) return { instruction:null, state:'refused', reason:'instruction_shape' };
  return { instruction:{ id:k.id, words:k.words, given_at:k.given_at, supersedes:k.supersedes, words_sha256:sha256(k.words) }, state:'present', reason:null };
}

/** What the run summary may say about the instruction: never the words, only the id and a digest. */
export function instructionSummary(read, acks = []) {
  const i = read?.instruction;
  return { state:read?.state ?? 'not_served', reason:read?.reason ?? null, id:i?.id ?? null, words_sha256:i?.words_sha256 ?? null, acks:acks.map(a => a.state) };
}

// The ack lines. Each says what the engine did, or why it is blocked and what would unblock it, and never quotes him.
export const RECEIVED_LINE = 'Received from today\'s directive and put first in this run. Its words stay in Control Center: this public repository logs only the id and a digest.';
export const HELD_LINE = 'engine held: config/activation.json still holds growth-legibility, so it acts on nothing and proposes nothing. It starts on this when Krish sets that file to active.';
export const CC_HELD_LINE = 'engine held: Control Center holds growth-legibility, so it acts on nothing and proposes nothing. It starts on this when Krish releases it on Growth > Engines.';
export const BY_RULE_LINE = 'This runner works by rule, with no model, so it cannot carry out free-text words yet. A session on growth-legibility can, inside the walls; anything walled comes back as a proposal.';

/**
 * The acks this run sends: received, then blocked with why. Held (`by`, heldBy's answer: the local flag or Control Center), the engine acts
 * on nothing until Krish releases it in both places; active, this runner has no model to carry out words, so it says so.
 * It keeps no memory between runs, so every run whose directive carries the instruction acks it again. Control Center
 * applies acks forward only: a repeated blocked with the same line changes nothing, one with a new line and a later `at`
 * replaces the line Krish sees, and the repeated received, a step back from blocked, is ignored and counted stale.
 */
export function instructionAcks(instruction, { by = [], at }) {
  if (!instruction) return [];
  const why = by.includes('krish_local') ? HELD_LINE : by.length ? CC_HELD_LINE : BY_RULE_LINE;
  return [
    { instruction_id:instruction.id, state:'received', line:RECEIVED_LINE, at, evidence_url:null },
    { instruction_id:instruction.id, state:'blocked', line:why, at, evidence_url:null },
  ];
}

/** The activity line that goes first on a run whose directive carries his instruction: the id and digest, never the words. */
export function instructionActivity(instruction, { by = [] } = {}) {
  if (!instruction) return null;
  const tail = by.length ? 'The engine is held, so it acted on nothing (its ack says why).' : 'This runner works by rule and cannot carry out free-text words, so its ack says blocked and why.';
  return { line:clip(`Received Krish's instruction ${instruction.id} (given ${instruction.given_at.slice(0, 10)}, digest ${instruction.words_sha256.slice(0, 12)}) and put it first. ${tail} Nothing was sent, posted or spent.`, 500), evidence_url:null };
}

// ---- This repository's own state, read from its files. Every reader returns null on any doubt; it never throws. ----

const stripMarkdown = text => text
  .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
  .replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\*([^*]+)\*/g, '$1')
  .replace(/`([^`]+)`/g, '$1')
  .replace(/\s+/g, ' ').trim();
const sentence = text => text.charAt(0).toUpperCase() + text.slice(1);

/** The North Star block of docs/NORTH_STAR.md: { metric, target, deadline, ladder: [[day, target]] }, or null. */
export function parseNorthStar(markdown) {
  const block = /```yaml north-star-metric\n([\s\S]*?)\n```/.exec(markdown ?? '')?.[1];
  if (!block) return null;
  const metric = /^metric:\s*"([^"\n]{1,120})"\s*$/m.exec(block)?.[1];
  const target = Number(/^target:\s*(\d{1,9})\s*$/m.exec(block)?.[1]);
  const deadline = /^deadline:\s*(\d{4}-\d{2}-\d{2})\s*$/m.exec(block)?.[1];
  if (!metric || !Number.isFinite(target) || !calendarDay(deadline ?? '')) return null;
  const ladder = [...block.matchAll(/^\s*-\s*\[(\d{4}-\d{2}-\d{2}),\s*(\d{1,9})\]\s*$/gm)].filter(m => calendarDay(m[1])).map(m => [m[1], Number(m[2])]).sort((a, b) => a[0].localeCompare(b[0]));
  return { metric, target, deadline, ladder };
}

/** docs/GET-GOING.md's first unticked item of its phase list (the build order), its child first when it has one. */
export function firstUnticked(markdown) {
  const section = /\n## The phases[^\n]*\n([\s\S]*?)(?:\n## |$)/.exec(markdown ?? '')?.[1];
  if (!section) return null;
  const lines = section.split('\n');
  for (let i = 0; i < lines.length; i++) {
    if (!/^- \[ \] /.test(lines[i])) continue;
    for (let j = i + 1; j < lines.length && /^\s+\S/.test(lines[j]); j++) if (/^\s+- \[ \] /.test(lines[j])) return stepLine(lines[j]);
    return stepLine(lines[i]);
  }
  return null;
}
function stepLine(raw) {
  const body = raw.replace(/^\s*- \[ \] /, '');
  const title = /^\*\*(.+?)\*\*\s*(.*)$/.exec(body);
  const head = title ? stripMarkdown(title[1]).replace(/[.:]$/, '') : null;
  const rest = stripMarkdown(title ? title[2] : body);
  const first = (/^(.+?[.;])(?:\s|$)/.exec(rest)?.[1] ?? rest).replace(/[.;]$/, '');
  return head ? (first ? `${head}: ${first.charAt(0).toLowerCase()}${first.slice(1)}` : head) : sentence(first);
}

/**
 * NOW.md's "What is next and what is waiting on Krish": { single: line|null, krish: [lines] }, or null. The single next
 * step is the closeout fold's `- Next (YYYY-MM-DD): ...` line (ai-harness .claude/hooks/harness-closeout.mjs, run by the
 * fold job in .github/workflows/ci.yml), or the older `- **Single next step:**` line.
 */
export function parseNowNext(markdown) {
  const section = /\n## What is next and what is waiting on Krish\n([\s\S]*?)(?:\n## |$)/.exec(markdown ?? '')?.[1];
  if (!section) return null;
  const lines = section.split('\n');
  const single = lines.find(l => /^- Next(?: \(\d{4}-\d{2}-\d{2}\))?:\s*\S/.test(l)) ?? lines.find(l => /^- \*\*Single next step:\*\*/.test(l));
  const krish = [];
  const at = lines.findIndex(l => /^- \*\*Waiting on Krish:\*\*/.test(l));
  if (at >= 0) for (let j = at + 1; j < lines.length && /^\s+- /.test(lines[j]); j++) krish.push(lines[j]);
  const tidy = raw => {
    const text = stripMarkdown(raw.replace(/^\s*- (?:\*\*[^*]+\*\*\s*|Next(?: \(\d{4}-\d{2}-\d{2}\))?:\s*)?/, '')).replace(/[;.]$/, '');
    // The clause before an explanation (": " after a whole instruction) is the step; the rest is why.
    const head = /^(.{20,}?): /.exec(text)?.[1];
    return sentence(head ?? text);
  };
  return { single:single ? tidy(single) : null, krish:krish.map(tidy) };
}

/** Krish's quoted aims, from config/engine-state.json: [{ line, since, source }]. */
export function parseObsessions(json) {
  try {
    const body = JSON.parse(json);
    if (!Array.isArray(body?.obsessions)) return null;
    return body.obsessions.filter(o => o && typeof o.quote === 'string' && typeof o.source === 'string' && (o.since === null || calendarDay(o.since ?? '')))
      .map(o => ({ line:`"${o.quote}"`, since:o.since, source:o.source }));
  } catch { return null; }
}

/** Everything this repository says about its own state, from its files at `root`. Each part is null when unreadable. */
export function readRepoState(root) {
  const read = path => { try { return readFileSync(join(root, path), 'utf8'); } catch { return null; } };
  return {
    northStar:parseNorthStar(read('docs/NORTH_STAR.md')),
    obsessions:parseObsessions(read('config/engine-state.json')),
    getGoing:firstUnticked(read('docs/GET-GOING.md')),
    now:parseNowNext(read('NOW.md')),
  };
}

/** This week's rung of the ladder at `at`: the last rung on or before the day, or null before the ladder starts. */
export function ladderRung(northStar, at) {
  const day = new Date(at).toISOString().slice(0, 10);
  const rung = (northStar?.ladder ?? []).filter(([d]) => d <= day).at(-1);
  return rung ? rung[1] : null;
}

// A whole line where one fits: first without its asides in brackets, then up to the last clause that fits, and only then
// cut with an ellipsis. Krish reads these in full on every place, so a cut is the last resort.
export function fitLine(text, max) {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const bare = t.replace(/\s*\([^()]*\)/g, '').replace(/\s+([,.;:])/g, '$1');
  if (bare.length <= max) return bare;
  const head = bare.slice(0, max + 1);
  const at = Math.max(head.lastIndexOf(', '), head.lastIndexOf('; '), head.lastIndexOf(' so '));
  if (at >= max / 2) return bare.slice(0, at).replace(/[\s,;:]+$/, '');
  return clip(bare, max);
}
const plainLine = (text, max) => { const line = fitLine(text, max); return stateLine(line, max) ? line : null; };

/**
 * priorities, obsessions and next_steps for a 1.20.0 report, each left out when it has no source. `repo` is
 * readRepoState's answer (or null), `recommendation` the run's constraint ({ code, action }), `weeklyBuilders` this run's
 * measurement ({ value, reason } or null), `objectiveFor` maps a constraint code to its objective key, and `registered`
 * says whether weekly_builders is a registered objective (registeredObjectives in src/orchestrator.mjs).
 */
export function stateFields({ repo = null, recommendation = null, objectiveFor = () => null, weeklyBuilders = null, registered = false, at }) {
  const out = {};
  const priorities = [];
  const ns = repo?.northStar;
  if (ns) {
    const rung = ladderRung(ns, at);
    const value = Number.isFinite(weeklyBuilders?.value) ? weeklyBuilders.value : null;
    const now = value === null ? 'not measured in this run' : `${value} this ISO week`;
    const week = rung === null ? '' : `, against this week's rung of ${rung}`;
    const line = plainLine(`${ns.metric}: ${now}${week}, on the way to ${ns.target} by ${longDate(ns.deadline)}.`, STATE_LIMITS.line);
    if (line) priorities.push({ rank:1, line, objective_key:registered ? 'weekly_builders' : null });
  }
  if (recommendation?.action) {
    const action = stripMarkdown(recommendation.action).replace(/\.$/, '');
    const line = plainLine(`Clear the constraint this run recommends: ${action.charAt(0).toLowerCase()}${action.slice(1)}.`, STATE_LIMITS.line);
    if (line) priorities.push({ rank:priorities.length + 1, line, objective_key:objectiveFor(recommendation.code) ?? null });
  }
  if (priorities.length) out.priorities = priorities;

  const obsessions = (repo?.obsessions ?? []).filter(o => stateLine(o.line, STATE_LIMITS.line)).slice(0, STATE_LIMITS.obsessions).map(o => ({ line:o.line, since:o.since }));
  if (obsessions.length) out.obsessions = obsessions;

  const steps = [];
  const today = new Date(at).toISOString().slice(0, 10);
  const own = repo?.getGoing ?? repo?.now?.single ?? null;
  const ownStep = own ? nextStep(own, 'engine', today) : null;
  if (ownStep) steps.push(ownStep);
  for (const item of repo?.now?.krish ?? []) {
    if (steps.length >= STATE_LIMITS.next_steps) break;
    const step = nextStep(item, 'krish', today);
    if (step && !steps.some(s => s.line === step.line)) steps.push(step);
  }
  if (steps.length) out.next_steps = steps;
  return out;
}

/**
 * The 1.20.0 fields to add to a report, with the instruction's acks, or {} when Control Center does not serve them (a
 * report without them is exactly the one sent before 1.20.0). `state` is operate's { served, repo, instruction, by, at }: `by` is who holds the engine (heldBy in src/lib/hold.mjs).
 */
export function engineStateFields(state, inputs) {
  if (!state?.served) return {};
  const fields = stateFields({ repo:state.repo, at:state.at, ...inputs });
  const acks = instructionAcks(state.instruction, { by:state.by, at:state.at });
  if (acks.length) fields.instruction_acks = acks;
  return fields;
}
