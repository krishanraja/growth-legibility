import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { canonical, isContactId, validateActionV2, validateSourceRevision } from '../guards/wire.mjs';

// Control Center's Draft press (protocol 1.12.0; Ruling, Krish, 2026-10-27: "Legibility drafts land in Krish's mindmake.co
// mailbox, and the press re-reads the Mindmake record first"). When Krish clears an approved invitation that travels as a
// version 2 email action, Control Center drafts its exact subject and words into his own Gmail; he sends it himself. This
// module only shapes that action from what prepare already approved and linted: it never writes words, reads a person, drafts
// or sends. Anything it cannot shape exactly stays plain words, which Clear approves as before and Krish copies.

/** The file every invitation's words are written from, by its path in this repository, with '/' on every platform. */
export const TEMPLATE_SOURCE = Object.freeze({ repo:'krishanraja/growth-legibility', path:'docs/OUTREACH-TEMPLATE.md' });

// A channel that is an email Krish sends from his own box. Anything else (a LinkedIn note, a form) stays plain words.
const EMAIL_CHANNEL = /^(?:manual-)?e-?mail$/;
const slug = channel => String(channel ?? '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

/**
 * The git blob SHA of a file's bytes, as Control Center reads it from GitHub's contents API on the default branch
 * (api/_sourceRevision.ts). `.gitattributes` stores text with LF line endings, so a text file checked out with CRLF is hashed
 * as git stored it; a file with a NUL byte is hashed as it is.
 */
export function gitBlobSha(bytes) {
  let content = Buffer.from(bytes);
  if (!content.includes(0)) content = Buffer.from(content.toString('latin1').replace(/\r\n/g, '\n'), 'latin1');
  return createHash('sha1').update(Buffer.concat([Buffer.from(`blob ${content.length}\0`), content])).digest('hex');
}

/** source_revision for the template as this checkout holds it. The runner checks out the default branch, as Control Center reads it. */
export function templateRevision(read = () => readFileSync(fileURLToPath(new URL(`../../${TEMPLATE_SOURCE.path}`, import.meta.url)))) {
  return validateSourceRevision([{ repo:TEMPLATE_SOURCE.repo, path:TEMPLATE_SOURCE.path, sha:gitBlobSha(read()) }]);
}

/**
 * The approved words split at their first line, as the template writes them ("Subject: ..." then the note). Null when the
 * words carry no subject line, or either part would be empty. Only edge whitespace is dropped, which Control Center trims anyway.
 */
export function splitSubject(text) {
  const m = typeof text === 'string' ? /^\s*Subject:[ \t]*([^\r\n]*)\r?\n([\s\S]*)$/.exec(text) : null;
  if (!m) return null;
  const subject = m[1].trim(), body = m[2].trim();
  return subject && body ? { subject, body } : null;
}

/**
 * The version 2 email action for one approval packet, or why not. Never one without the person's Control Center contact id
 * and the Mindmake record the words were written from (both bound into the packet by prepare), never for a channel that is
 * not email, and never unless the wire validator takes it. `exact_payload` is its canonical JSON, so the digest of the
 * payload binds the recipient, the subject, the words, the box and the record.
 */
export function emailAction(packet) {
  const refuse = reason => ({ ok:false, reason });
  if (packet?.status !== 'pending_human') return refuse('not_an_invitation');
  const contact = packet.candidate?.contact;
  if (!isContactId(contact?.contact_id)) return refuse('contact_id_missing');
  const record = contact?.prior_mindmake;
  if (!record || typeof record !== 'object') return refuse('prior_mindmake_missing');
  if (!EMAIL_CHANNEL.test(slug(packet.candidate?.channel))) return refuse('not_email');
  const parts = splitSubject(packet.exact_text);
  if (!parts) return refuse('subject_missing');
  const action = { version:2, channel:'email', recipient_contact_id:contact.contact_id, subject:parts.subject, body:parts.body, form:null, mailbox:'krish', prior_mindmake:structuredClone(record) };
  const exactPayload = canonical(action);
  try { validateActionV2(exactPayload, packet.lineage?.captured_at); } catch { return refuse('action_refused'); }
  return { ok:true, action, exact_payload:exactPayload };
}
