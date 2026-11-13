import { readFileSync } from 'node:fs';

// Legibility's AI answers through AEO-Engine, the one AI-answers specialist (protocol 1.22.0; Ruling, Krish,
// 2026-11-12: "AEO-Engine becomes the one specialist that every venture's growth engine calls for its AI-answer
// work."). This engine never asks an AI assistant itself. Each run reads Legibility's standing from the directive
// (`ai_answers`) and, when it is not held, no request is on file and config/ai-answer-questions.json holds real buyer
// questions, asks AEO once to track them (`POST answers`). Never fatal: a failure is one summary line.

const MONTHS = 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ');
const day = ymd => { const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(String(ymd ?? '')); return m ? `${Number(m[3])} ${MONTHS[Number(m[2]) - 1]}` : String(ymd ?? ''); };
const plural = (n, one) => `${n} ${one}${n === 1 ? '' : 's'}`;

/** The directive's standing, read loosely, or null. Pure. */
export function readAiAnswers(directive) {
  const s = directive?.ai_answers?.standing;
  return s && typeof s === 'object' && !Array.isArray(s) ? s : null;
}

/** Whether the directive serves AI answers (features.ai_answers). Pure. */
export const servesAiAnswers = directive => directive?.features?.ai_answers === true || !!(directive?.ai_answers && typeof directive.ai_answers === 'object');

/** Legibility's AI answers in one line, the words Control Center's tile uses. Pure. */
export function answersLine(s) {
  if (!s) return 'AI answers: not tracked yet.';
  if (s.latest) return `AI answers: cited first on ${s.latest.cited_first} of ${plural(s.latest.asked, 'question')}, ${day(s.latest.as_of)}.`;
  if (s.request?.state === 'open') return `AI answers: AEO tracks ${plural(s.request.questions, 'question')} from its next research run.`;
  return s.tracked ? 'AI answers: tracked, not asked yet.' : 'AI answers: not tracked yet.';
}

/** The questions and hosts on file, each question 8 to 300 characters, at most 25. */
export function configured(path = new URL('../config/ai-answer-questions.json', import.meta.url)) {
  let data;
  try { data = JSON.parse(readFileSync(path, 'utf8')); } catch { return { questions: [], domains: [] }; }
  const questions = [...new Set((data.questions ?? []).map(q => String(typeof q === 'object' && q ? q.question : q).replace(/\s+/g, ' ').trim()).filter(q => q.length >= 8 && q.length <= 300))].slice(0, 25);
  const domains = (data.domains ?? []).filter(d => typeof d === 'string').slice(0, 5);
  return { questions, domains };
}

/** The run's AI-answer lines; asks AEO once when it may. Never throws. */
export async function answersStep({ client, directive, held, file = configured() }) {
  if (!servesAiAnswers(directive)) return [];
  const s = readAiAnswers(directive);
  const lines = [answersLine(s)];
  if (held || s?.request) return lines;
  if (!file.questions.length) return [...lines, 'No buyer question is on file to ask AEO-Engine about yet.'];
  try {
    const out = await client.answers({ questions: file.questions, domains: file.domains });
    return [...lines, `Asked AEO-Engine to track ${plural(out.questions ?? file.questions.length, 'buyer question')} from its next research run.`];
  } catch { return [...lines, 'Could not ask AEO-Engine to track Legibility\'s buyer questions this run; the next run asks again.']; }
}
