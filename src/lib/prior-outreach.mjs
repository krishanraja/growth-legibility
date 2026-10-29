import { capturedBy, isContactId, utcInstant, validateMindmakeRecord } from '../guards/wire.mjs';
import { APPROVED_ORIGIN, MAX_PRIOR_OUTREACH_CONTACTS } from '../transport.mjs';

// The runner's one read of each person's Mindmake record (Ruling, Krish, 2026-10-27; Control Center protocol 1.11.0,
// GET .../prior-outreach). It fills candidate.contact.prior_mindmake from Control Center's answer, copied unchanged, and
// from nothing else: a record already in the snapshot is dropped first, because the record comes only from this reader.
// A candidate is read by its contact.contact_id alone, never by a name, a company or an address.
//
// Unknown is not none. The field stays absent, which prepare holds as mindmake_history_unknown, when the candidate has no
// contact id, when Control Center does not serve the route, when a read fails, when an id is missing from the answer,
// and when a record breaks the wire rules (src/guards/wire.mjs validateMindmakeRecord), is dated after the snapshot's
// capture, or links a record other than this person's. Nothing here ever writes `none`.
// It reads; it never writes, drafts or sends. Only counts and codes leave in the summary.

// The run asks for at most this many batches: 4 reads of 50, well inside the engine gate's rate limit.
export const MAX_PRIOR_OUTREACH_BATCHES = 4;
const SNAKE = /^[a-z][a-z0-9_]{0,63}$/;
const codeOf = e => SNAKE.test(e?.code ?? '') ? e.code : 'prior_outreach_unavailable';

/** The person's own record in Control Center, as its reader links it (api/_priorOutreach.ts personLink). */
export const personLink = id => `${APPROVED_ORIGIN}/#/people?person=${id}`;

/** Whether an answer is a record this engine may copy for this contact: the wire's rules, its dates by the capture, its link to this person. */
export function acceptableRecord(id, record, before) {
  try { validateMindmakeRecord(record, before); } catch { return false; }
  return record.record_url === null || record.record_url === personLink(id);
}

const contactOf = c => c && typeof c === 'object' && c.contact && typeof c.contact === 'object' && !Array.isArray(c.contact) ? c.contact : null;

/**
 * Drop every contact.prior_mindmake the snapshot brought with it: the record comes only from Control Center's reader, so
 * one already in a snapshot is never trusted. Returns a new snapshot and its contacts; the input is not changed. A held
 * run calls this alone, reads no record, and so holds each person as mindmake_history_unknown exactly as a failed read.
 */
export function dropPriorMindmake(raw) {
  const snapshot = structuredClone(raw);
  const contacts = (Array.isArray(snapshot?.candidates) ? snapshot.candidates : []).map(contactOf).filter(Boolean);
  for (const contact of contacts) delete contact.prior_mindmake;
  return { snapshot, contacts };
}

/**
 * Read the Mindmake record for every candidate with a contact id and copy it into contact.prior_mindmake.
 * Returns a new snapshot (the input is not changed) and a summary of counts and codes.
 */
export async function readPriorMindmake(client, raw) {
  const { snapshot, contacts } = dropPriorMindmake(raw);
  const linked = contacts.filter(c => isContactId(c.contact_id));
  const ids = [...new Set(linked.map(c => c.contact_id))].sort();
  const summary = { state:'not_needed', reason:null, candidates:contacts.length, unlinked:contacts.length - linked.length, contacts:ids.length, copied:0, refused:0, unread:ids.length };
  const done = (state, reason = null) => ({ snapshot, summary:Object.assign(summary, { state, reason }) });
  if (!ids.length) return done(contacts.length ? 'unlinked' : 'not_needed', contacts.length ? 'contact_id_missing' : null);

  let features;
  try { ({ features } = await client.capabilities()); }
  catch (e) { return done('unavailable', codeOf(e)); }
  if (features?.prior_outreach !== true) return done('unavailable', 'prior_outreach_not_served');

  const before = utcInstant(snapshot.captured_at) ? capturedBy(snapshot.captured_at) : () => false;
  const records = new Map();
  let reason = ids.length > MAX_PRIOR_OUTREACH_CONTACTS * MAX_PRIOR_OUTREACH_BATCHES ? 'prior_outreach_batch_cap' : null;
  for (let i = 0; i < Math.min(ids.length, MAX_PRIOR_OUTREACH_CONTACTS * MAX_PRIOR_OUTREACH_BATCHES); i += MAX_PRIOR_OUTREACH_CONTACTS) {
    const batch = ids.slice(i, i + MAX_PRIOR_OUTREACH_CONTACTS);
    let answer;
    try { answer = await client.priorOutreach(batch); }
    catch (e) { reason ??= codeOf(e); continue; }
    for (const id of batch) {
      if (!Object.hasOwn(answer, id)) continue;
      if (acceptableRecord(id, answer[id], before)) records.set(id, answer[id]);
      else summary.refused++;
    }
  }
  if (summary.refused) reason ??= 'prior_outreach_record_refused';
  for (const contact of linked) if (records.has(contact.contact_id)) { contact.prior_mindmake = structuredClone(records.get(contact.contact_id)); summary.copied++; }
  summary.unread = ids.length - records.size - summary.refused;
  return done(records.size === ids.length ? 'read' : records.size ? 'partial' : 'unavailable', reason);
}
