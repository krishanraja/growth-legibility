// The Reader Check (Ruling, Krish, 2026-11-10; docs/COPY-DOCTRINE.md, "The reader check"): before an invitation
// reaches Krish, a fresh reader who knows only what the candidate record says reads the exact draft and says
// whether they would reply within a week, whether they would run the test on their own products this week, which
// link of the persuasion chain stops them, and whether they felt remembered or worked. The method is the buyer
// panel of the founder-skill repository (MIT), rebuilt for this engine: readers come from the record, never
// invented, and every prediction is later scored against what happened.
//
// It is never evidence, a reply, a testimonial, a count toward the number, a Learning Judge verdict or a hold. It
// runs in shadow and earns weight only when its predictions beat chance on real sends (`calibrate`); otherwise it
// is retired. The answers come from fresh-context sub-agents in a Claude session, one per brief, never from the
// session that wrote the draft (scripts/reader.mjs). Pure: briefs in, answers checked, counts out.
import { createHash } from 'node:crypto';

/** The nine links of the persuasion chain (docs/COPY-DOCTRINE.md), and none. */
export const LINKS = Object.freeze(['relevance', 'attention', 'desire', 'difference', 'belief', 'value', 'safety', 'timing', 'action', 'none']);
export const FEELS = Object.freeze(['remembered', 'worked', 'neither']);
/** Wave 1's impact angles (docs/ENGINE-ARCHITECTURE.md, decision 13); a draft names one in `draft.impact`, or none yet. */
export const IMPACTS = Object.freeze(['cost_speed', 'agent_revenue', 'trust_risk']);
export const MAX_PER_RUN = 20;
export const DEFAULT_PER_RUN = 10;
/** The pre-registered stop rule, on replies; first trusted reads are reported beside it. */
export const CALIBRATION = Object.freeze({ min_matured: 20, min_replies: 3, mature_days: 7, lift: 2 });

const DAY = 86400000;
const str = v => (typeof v === 'string' && v.trim() ? v.trim() : null);
const sha = text => createHash('sha256').update(String(text)).digest('hex');

const ROLE_LINE = {
  commercial_leader: 'You lead the commercial side of the company named below. It buys product data for its own agents or products. You are busy, and most emails like this one go unanswered.',
  builder: 'You build the agent or product named below and decide what data it relies on. You have seen many product data APIs, and most emails like this one go unanswered.',
  recipient: 'You are the person this email is written to. You are busy, and most emails like this one go unanswered.'
};

/** The reader a candidate's pool gives: a commercial leader for `buyer`, a builder for `builder`, else a recipient. Pure. */
export const roleOf = c => (c?.pool === 'buyer' ? 'commercial_leader' : c?.pool === 'builder' ? 'builder' : 'recipient');

/** What is true about the reader: only the record's own lines, never an invented age, income or habit. Pure. */
export function readerFacts(c) {
  if (!c || typeof c !== 'object') return [];
  const out = [];
  if (str(c.company)) out.push(`Your company: ${str(c.company)}.`);
  if (str(c.project)) out.push(`What you are building: ${str(c.project)}.`);
  if (str(c.current_signal?.text)) out.push(`Something you did recently: ${str(c.current_signal.text)}`);
  const rel = c.relationship?.kind;
  if (rel === 'cold') out.push('You have never been in touch with the sender.');
  else if (str(rel)) out.push(`Your connection to the sender: ${rel}${str(c.relationship?.evidence) ? `, ${str(c.relationship.evidence)}` : ''}.`);
  return out;
}

/** The candidates this run reads, in order: a draft with words and a record with facts, at most `n`. Pure. */
export function selectDrafts(candidates, n = DEFAULT_PER_RUN) {
  const cap = Math.max(1, Math.min(MAX_PER_RUN, Number.isInteger(n) ? n : DEFAULT_PER_RUN));
  const out = [];
  for (const c of Array.isArray(candidates) ? candidates : []) {
    if (out.length >= cap) break;
    const text = str(c?.draft?.text), facts = readerFacts(c);
    if (typeof c?.id !== 'string' || !text || facts.length < 2) continue;
    out.push({ id: c.id, role: roleOf(c), impact: IMPACTS.includes(c.draft.impact) ? c.draft.impact : null, facts, draft: text });
  }
  return out;
}

/** One reader's brief: who they are (record facts only), the exact draft, and the JSON to write. Pure. */
export function briefFor(item, out) {
  return `You are one reader in a check of a draft email, before anyone decides to send it. Your answer is only useful if it is honest: a polite yes is worse than a clear no.

=== WHO YOU ARE ===
${ROLE_LINE[item.role]}
These lines are everything known about you. Do not invent anything else about yourself, the sender or their product.
${item.facts.map(f => `- ${f}`).join('\n')}
=== END ===

=== THE EMAIL, EXACTLY AS IT WOULD ARRIVE ===
${item.draft}
=== END ===

Decide as this person would, in a normal week. Do not be agreeable.

Create the file ${out} with your file-writing tool (do not just print it in your reply) containing ONLY this JSON, no markdown fence, nothing else:
{
  "id": "${item.id}",
  "replies": true or false (would you reply within 7 days),
  "reply": "what you would write back, in one or two sentences, or empty if you would not reply",
  "would_test": true or false (would you, or an engineer you pass it to, run the offered test on your own products this week),
  "weakest_link": one of ${JSON.stringify(LINKS)} (the part that most stops you: relevance is it for me, attention why notice it, desire do I want the result, difference why this over scraping or another data vendor, belief will it read my products, value is it worth the integration, safety what if my sources are not covered, timing why now, action what exactly do I do; none if nothing does),
  "why": "the one line of the email that decided it, quoted, and why, in one sentence",
  "feels": one of ${JSON.stringify(FEELS)} (did it make you feel remembered as a person, or worked as a target)
}
`;
}

export const briefSha = item => sha(JSON.stringify({ id: item.id, role: item.role, facts: item.facts, draft: item.draft }));

/** One reader's answer, read by fixed rules. { ok: true, answer } or { ok: false, reason }. Nothing is filled in. Pure. */
export function validAnswer(raw, id) {
  let a = raw;
  if (typeof raw === 'string') {
    const t = raw.trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
    try { a = JSON.parse(t); } catch { return { ok: false, reason: 'not_json' }; }
  }
  if (!a || typeof a !== 'object' || Array.isArray(a)) return { ok: false, reason: 'not_object' };
  if (a.id !== id) return { ok: false, reason: 'wrong_id' };
  if (typeof a.replies !== 'boolean') return { ok: false, reason: 'replies' };
  if (typeof a.reply !== 'string' || a.reply.length > 600 || (a.replies && !a.reply.trim())) return { ok: false, reason: 'reply' };
  if (typeof a.would_test !== 'boolean') return { ok: false, reason: 'would_test' };
  if (!LINKS.includes(a.weakest_link)) return { ok: false, reason: 'weakest_link' };
  if (typeof a.why !== 'string' || !a.why.trim() || a.why.length > 600) return { ok: false, reason: 'why' };
  if (!FEELS.includes(a.feels)) return { ok: false, reason: 'feels' };
  return { ok: true, answer: { id: a.id, replies: a.replies, reply: a.reply.trim(), would_test: a.would_test, weakest_link: a.weakest_link, why: a.why.trim(), feels: a.feels } };
}

const count = values => { const m = new Map(); for (const v of values) m.set(v, (m.get(v) ?? 0) + 1); return [...m].sort((x, y) => y[1] - x[1] || String(x[0]).localeCompare(String(y[0]))); };

/** Counts and codes for one run, never the words, with the reply and test rates by impact angle. Pure. */
export function tally(items, answers) {
  const got = items.filter(i => answers.has(i.id));
  const ans = got.map(i => answers.get(i.id));
  return {
    read: items.length, answered: ans.length, missing: items.length - ans.length,
    would_reply: ans.filter(a => a.replies).length, would_test: ans.filter(a => a.would_test).length,
    weakest_links: count(ans.filter(a => a.weakest_link !== 'none').map(a => a.weakest_link)),
    feels: count(ans.map(a => a.feels)),
    by_impact: count(got.map(i => `${i.impact ?? 'no_angle'}:${answers.get(i.id).replies ? 'reply' : 'silent'}`))
  };
}

export function tallyLine(t) {
  const pairs = list => (list.length ? list.map(([k, v]) => `${k} ${v}`).join(', ') : 'none');
  return `Reader check, in shadow: read ${t.read} draft${t.read === 1 ? '' : 's'}, ${t.answered} answered${t.missing ? `, ${t.missing} missing` : ''}; would reply ${t.would_reply} of ${t.answered}, would test ${t.would_test} of ${t.answered}; weakest links: ${pairs(t.weakest_links)}; feels: ${pairs(t.feels)}; by impact angle: ${pairs(t.by_impact)}. Simulated readers, never evidence and never a Learning Judge verdict; nothing is held.`;
}

/** A ledger entry: keys and the prediction, never a word. Pure. */
export const ledgerEntry = (item, a, at) => ({ id: item.id, role: item.role, impact: item.impact, brief_sha: briefSha(item), briefed_at: at, replies: a.replies, would_test: a.would_test, weakest_link: a.weakest_link, feels: a.feels });

export function mergeLedger(ledger, entries) {
  const out = Array.isArray(ledger) ? [...ledger] : [];
  const seen = new Set(out.map(e => `${e.id}|${e.brief_sha}`));
  for (const e of entries) { const k = `${e.id}|${e.brief_sha}`; if (!seen.has(k)) { seen.add(k); out.push(e); } }
  return out;
}

/**
 * The outcomes input (section 6's connector-input contract): `{ captured_at, outcomes: [{ id, sent_at,
 * replied_at, first_read_at }] }`, each time an ISO instant or null, read from Krish's sent mail and the app
 * export into ignored runtime/input/. Throws `invalid_outcomes` on any other shape. Pure.
 */
export function validOutcomes(input) {
  const iso = v => v === null || (typeof v === 'string' && Number.isFinite(Date.parse(v)));
  if (!input || typeof input !== 'object' || !iso(input.captured_at) || input.captured_at === null || !Array.isArray(input.outcomes)) throw new Error('invalid_outcomes');
  for (const o of input.outcomes) if (!o || typeof o.id !== 'string' || !iso(o.sent_at) || !iso(o.replied_at) || !iso(o.first_read_at)) throw new Error('invalid_outcomes');
  return input;
}

/** What happened to one prediction: unsent, pending (under 7 days), replied or silent, and whether a first trusted read followed. Pure. */
export function outcomeOf(entry, outcomes, at) {
  const o = outcomes.find(x => x.id === entry.id && x.sent_at && Date.parse(x.sent_at) >= (Date.parse(entry.briefed_at) || 0));
  if (!o) return { state: 'unsent', read: null };
  const sent = Date.parse(o.sent_at);
  if (Date.parse(at) - sent < CALIBRATION.mature_days * DAY) return { state: 'pending', read: null };
  const within = v => v !== null && Date.parse(v) > sent && Date.parse(v) - sent <= CALIBRATION.mature_days * DAY;
  return { state: within(o.replied_at) ? 'replied' : 'silent', read: within(o.first_read_at) };
}

/**
 * Predictions against what happened, over sends at least 7 days old: `too_early` until `min_matured` sends with
 * `min_replies` replies; then `earns_weight` only above the majority guess and with drafts it said yes to answered
 * at least `lift` times as often as drafts it said no to; else `retire`. Pure.
 */
export function calibrate(ledger, outcomes, at) {
  const rows = (Array.isArray(ledger) ? ledger : []).map(e => ({ e, o: outcomeOf(e, outcomes, at) }));
  const matured = rows.filter(r => r.o.state === 'replied' || r.o.state === 'silent');
  const replied = matured.filter(r => r.o.state === 'replied').length;
  const rate = (list, hit) => (list.length ? list.filter(hit).length / list.length : null);
  const yes = matured.filter(r => r.e.replies), no = matured.filter(r => !r.e.replies);
  const yesRate = rate(yes, r => r.o.state === 'replied'), noRate = rate(no, r => r.o.state === 'replied');
  const accuracy = matured.length ? matured.filter(r => r.e.replies === (r.o.state === 'replied')).length / matured.length : null;
  const baseline = matured.length ? Math.max(replied, matured.length - replied) / matured.length : null;
  let standing = 'too_early';
  if (matured.length >= CALIBRATION.min_matured && replied >= CALIBRATION.min_replies) {
    const lifts = yesRate !== null && (noRate === 0 ? yesRate > 0 : noRate !== null && yesRate >= CALIBRATION.lift * noRate);
    standing = accuracy > baseline && lifts ? 'earns_weight' : 'retire';
  }
  return {
    predictions: rows.length, unsent: rows.filter(r => r.o.state === 'unsent').length, pending: rows.filter(r => r.o.state === 'pending').length,
    matured: matured.length, replied, first_reads: matured.filter(r => r.o.read).length, accuracy, baseline,
    reply_rate_when_yes: yesRate, reply_rate_when_no: noRate,
    read_rate_when_would_test: rate(matured.filter(r => r.e.would_test), r => r.o.read), read_rate_when_not: rate(matured.filter(r => !r.e.would_test), r => r.o.read),
    standing
  };
}

export function calibrationLine(c) {
  const pct = v => (v === null ? 'unknown' : `${Math.round(v * 100)}%`);
  return `Reader calibration: ${c.predictions} prediction${c.predictions === 1 ? '' : 's'}; ${c.matured} sent 7+ days ago (${c.replied} replied, ${c.first_reads} first trusted reads), ${c.pending} pending, ${c.unsent} never sent; accuracy ${pct(c.accuracy)} against ${pct(c.baseline)} for the majority guess; replies when it said yes ${pct(c.reply_rate_when_yes)}, when it said no ${pct(c.reply_rate_when_no)}; first reads when it would test ${pct(c.read_rate_when_would_test)}, when not ${pct(c.read_rate_when_not)}; standing ${c.standing}.`;
}
