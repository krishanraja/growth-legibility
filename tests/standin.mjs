// A local, in-process stand-in for the Control Center growth engine routes (the engine sends protocol 1.0.0; with
// `priorOutreach` set it serves 1.11.0 and its prior-outreach read; with `draftPress` set it serves 1.12.0 and
// features.draft_press, and reads a version 2 email action as Control Center's parseReport does). Synthetic only: it listens
// on 127.0.0.1 and never reaches a live service.
import { createServer } from 'node:http';
import { readFileSync } from 'node:fs';
import { validateEngineEnvelope } from '../src/guards/wire.mjs';

export const PREFIX = '/api/growth/engines/legibility';
export const TOKEN = 'synthetic-standin-bearer-canary';
// Control Center's prior-outreach answers (api/_priorOutreach.ts): the unknown record, and the person link each record carries.
export const UNKNOWN_RECORD = Object.freeze({ state:'unknown', by:null, state_at:null, last_touch_at:null, record_url:null });
export const personLink = id => `https://controlcenter.krishraja.com/#/people?person=${id}`;
const CONTACT_IDS = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
export const REPORT_SCHEMA = JSON.parse(readFileSync(new URL('../docs/control-center/engine-report.schema.json', import.meta.url)));

// A small JSON Schema reader covering what engine-report.schema.json uses.
export function schemaErrors(value, schema, path = '$', errors = []) {
  const types = schema.type === undefined ? null : [].concat(schema.type);
  const typeOf = v => v === null ? 'null' : Array.isArray(v) ? 'array' : Number.isInteger(v) ? 'integer' : typeof v;
  if (types && !types.some(t => t === typeOf(value) || (t === 'number' && typeof value === 'number'))) { errors.push(`${path}: type`); return errors; }
  if ('const' in schema && JSON.stringify(schema.const) !== JSON.stringify(value)) errors.push(`${path}: const`);
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${path}: enum`);
  if (typeof value === 'string') {
    if (schema.maxLength !== undefined && value.length > schema.maxLength) errors.push(`${path}: maxLength`);
    if (schema.minLength !== undefined && value.length < schema.minLength) errors.push(`${path}: minLength`);
    if (schema.pattern && !new RegExp(schema.pattern, 'u').test(value)) errors.push(`${path}: pattern`);
    if (schema.format === 'date-time' && !Number.isFinite(Date.parse(value))) errors.push(`${path}: date-time`);
  }
  if (typeof value === 'number' && schema.minimum !== undefined && value < schema.minimum) errors.push(`${path}: minimum`);
  if (typeof value === 'number' && schema.maximum !== undefined && value > schema.maximum) errors.push(`${path}: maximum`);
  if (Array.isArray(value)) {
    if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(`${path}: maxItems`);
    if (schema.minItems !== undefined && value.length < schema.minItems) errors.push(`${path}: minItems`);
    if (schema.items) value.forEach((item, i) => schemaErrors(item, schema.items, `${path}[${i}]`, errors));
  }
  if (value && typeof value === 'object' && !Array.isArray(value)) {
    for (const key of schema.required ?? []) if (!(key in value)) errors.push(`${path}: missing ${key}`);
    for (const key of Object.keys(value)) {
      if (schema.properties?.[key]) schemaErrors(value[key], schema.properties[key], `${path}.${key}`, errors);
      else if (schema.additionalProperties === false || schema.properties) errors.push(`${path}: unknown ${key}`);
    }
  }
  return errors;
}

// Control Center's reading of a report at efad4667 (src/lib/growthEngines.ts: PROTOCOL_VERSIONS, proposalKeys, parseActionV2,
// parseBasis, the source_revision rule of parseRowFields and parseProposal's 1.12.0 branch for a send off the rows), ported
// line for line so a report the stand-in takes is one Control Center would take. Only what this engine can send is ported.
export const CC_VERSIONS = Object.freeze(['1.0.0', '1.1.0', '1.2.0', '1.3.0', '1.4.0', '1.5.0', '1.6.0', '1.7.0', '1.8.0', '1.9.0', '1.10.0', '1.11.0', '1.12.0']);
const CC_PROPOSAL_KEYS = ['proposal_id', 'title', 'why', 'kind', 'wall', 'amount_usd', 'channel', 'objective_key', 'exact_payload', 'payload_sha256', 'evidence', 'close_condition', 'expires_at'];
const CC_PROPOSAL_KEYS_1_8 = [...CC_PROPOSAL_KEYS, 'stage', 'parent_proposal_id', 'subject_ref', 'row', 'rank', 'reach', 'amplifier_kind', 'features', 'serves', 'source_revision', 'because', 'brief', 'card'];
const ccIsObj = v => !!v && typeof v === 'object' && !Array.isArray(v);
const ccStr = (v, max = 4000) => (typeof v === 'string' && v.trim() && v.length <= max ? v.trim() : null);
const ccIsTime = v => typeof v === 'string' && !Number.isNaN(Date.parse(v));
const ccHttpsOrNull = v => (v === null || v === undefined ? null : typeof v === 'string' && /^https:\/\/\S+$/.test(v) && v.length <= 2000 ? v : undefined);
const ccExtra = (o, allowed) => Object.keys(o).some(k => !allowed.includes(k));
export function ccAtLeast(v, min) {
  const [a, b] = [v, min].map(x => x.split('.').map(Number));
  for (let i = 0; i < 3; i++) if ((a[i] ?? 0) !== (b[i] ?? 0)) return (a[i] ?? 0) > (b[i] ?? 0);
  return true;
}
export function ccIsActionV2Text(text) {
  if (typeof text !== 'string' || !text.trimStart().startsWith('{')) return false;
  try { const a = JSON.parse(text); return ccIsObj(a) && a.version === 2; } catch { return false; }
}
export function ccParseActionV2(text) {
  let a; try { a = JSON.parse(text ?? ''); } catch { return { ok:false, error:'not json' }; }
  if (!ccIsObj(a) || ccExtra(a, ['version', 'channel', 'recipient_contact_id', 'subject', 'body', 'form', 'mailbox', 'prior_mindmake']) || a.version !== 2) return { ok:false, error:'shape' };
  if (!['email', 'x_message', 'whatsapp', 'form'].includes(a.channel)) return { ok:false, error:'channel' };
  const body = ccStr(a.body, a.channel === 'email' ? 7000 : a.channel === 'form' ? 6000 : 1000);
  if (!body) return { ok:false, error:'body' };
  const recipient = a.recipient_contact_id === null || a.recipient_contact_id === undefined ? null : typeof a.recipient_contact_id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(a.recipient_contact_id) ? a.recipient_contact_id : undefined;
  if (recipient === undefined || (a.channel !== 'form' && !recipient)) return { ok:false, error:'recipient' };
  const subject = a.subject === null || a.subject === undefined ? null : ccStr(a.subject, 200);
  if (a.channel === 'email' && (!subject || /[\r\n]/.test(subject))) return { ok:false, error:'subject' };
  if (a.channel !== 'form' && a.form !== null && a.form !== undefined) return { ok:false, error:'form' };
  const mailbox = a.mailbox === null || a.mailbox === undefined ? null : ['krish', 'jonny'].includes(a.mailbox) ? a.mailbox : undefined;
  if (mailbox === undefined || (mailbox && a.channel !== 'email')) return { ok:false, error:'mailbox' };
  let basis = null;
  if (a.prior_mindmake !== undefined && a.prior_mindmake !== null) {
    const b = a.prior_mindmake;
    if (a.channel !== 'email' || !ccIsObj(b) || ccExtra(b, ['state', 'by', 'state_at', 'last_touch_at', 'record_url'])) return { ok:false, error:'basis' };
    if (!['none', 'unknown', 'open', 'client', 'drafted', 'sent', 'replied', 'met'].includes(b.state) || !('state_at' in b) || !('last_touch_at' in b)) return { ok:false, error:'basis' };
    const when = v => (v === null ? null : ccIsTime(v) ? v : undefined);
    if (when(b.state_at) === undefined || when(b.last_touch_at) === undefined) return { ok:false, error:'basis' };
    if (b.by !== undefined && b.by !== null && b.by !== 'krish' && b.by !== 'other') return { ok:false, error:'basis' };
    if (b.record_url !== undefined && ccHttpsOrNull(b.record_url) === undefined) return { ok:false, error:'basis' };
    basis = { state:b.state, state_at:b.state_at, last_touch_at:b.last_touch_at };
  }
  return { ok:true, value:{ version:2, channel:a.channel, recipient_contact_id:recipient, subject:a.channel === 'email' ? subject : null, body, form:null, mailbox, ...(basis ? { prior_mindmake:basis } : {}) } };
}
/** Why Control Center would refuse one proposal of a report at `version`, or null when it takes it. */
export function ccProposalRefusal(p, version) {
  if (!ccIsObj(p) || ccExtra(p, version === '1.0.0' ? CC_PROPOSAL_KEYS : CC_PROPOSAL_KEYS_1_8)) return 'unknown_field';
  if (p.subject_ref !== undefined && p.subject_ref !== null && !/^(contact|target|event):[A-Za-z0-9_-]{1,64}$/.test(p.subject_ref)) return 'subject_ref';
  if (p.source_revision !== undefined && p.source_revision !== null) {
    if (!Array.isArray(p.source_revision) || !p.source_revision.length || p.source_revision.length > 8) return 'source_revision';
    for (const s of p.source_revision) {
      if (!ccIsObj(s) || typeof s.repo !== 'string' || !/^[A-Za-z0-9-]+\/[A-Za-z0-9._-]+$/.test(s.repo) || typeof s.path !== 'string' || !s.path || s.path.length > 300 || /(^|\/)\.\.(\/|$)/.test(s.path) || typeof s.sha !== 'string' || !/^[0-9a-f]{40}$/.test(s.sha)) return 'source_revision';
    }
  }
  if (p.wall === 'send' && ccIsActionV2Text(p.exact_payload)) {
    const action = ccParseActionV2(p.exact_payload);
    if (action.ok && action.value.prior_mindmake && !ccAtLeast(version, '1.12.0')) return 'basis_needs_1_12_0';
    if (!action.ok && ccAtLeast(version, '1.12.0')) return `action_${action.error}`;
  }
  return null;
}

/**
 * The checks Control Center's Draft press (api/_rowPress.ts pressLegibility) runs on what the engine wrote, in its order, for
 * one stored proposal: the action, the box, the files by their blob SHA (`shas`: { 'repo:path': sha }, a missing entry being
 * a file Control Center cannot read), the person, the basis against `record`, the record read again. The address, the
 * people checks and the words rules are Control Center's own and are not ported. Returns { hold } or { draft }.
 */
export function ccPress(p, { record, shas }) {
  const a = ccParseActionV2(typeof p.exact_payload === 'string' ? p.exact_payload : null);
  if (!a.ok) return { hold:'unreadable_action' };
  if (a.value.channel !== 'email' || !a.value.recipient_contact_id) return { hold:'not_an_email' };
  if (a.value.mailbox === 'jonny') return { hold:'not_krish_box' };
  const revs = Array.isArray(p.source_revision) ? p.source_revision : [];
  if (!revs.length || revs.some(r => !Object.hasOwn(shas, `${r.repo.toLowerCase()}:${r.path}`))) return { hold:'source_unreadable' };
  if (revs.some(r => shas[`${r.repo.toLowerCase()}:${r.path}`] !== r.sha)) return { hold:'stale' };
  const to = a.value.recipient_contact_id.toLowerCase();
  const person = typeof p.subject_ref === 'string' && p.subject_ref.startsWith('contact:') ? p.subject_ref.slice(8).toLowerCase() : null;
  if (!person || person !== to) return { hold:'prior_outreach_unlinked' };
  const basis = a.value.prior_mindmake ?? null;
  if (!basis) return { hold:'prior_outreach_undeclared' };
  if (!record || record.state === 'unknown') return { hold:'mindmake_history_unknown' };
  if (record.state === 'open') return { hold:'mindmake_thread_open' };
  if (record.state === 'client') return { hold:'mindmake_client' };
  if (basis.state !== record.state) return { hold:'prior_outreach_changed' };
  const now = record.last_touch_at ? Date.parse(record.last_touch_at) : NaN, then = basis.last_touch_at ? Date.parse(basis.last_touch_at) : NaN;
  if (Number.isFinite(now) && (!Number.isFinite(then) || now > then)) return { hold:'prior_outreach_changed' };
  return { draft:{ to:a.value.recipient_contact_id, subject:a.value.subject, body:a.value.body, mailbox:'krish' } };
}

export const DIRECTIVE = {
  // Control Center serves its newest 1.x; this engine still sends 1.0.0, which it accepts.
  schema_version:'1.2.0', directive_id:'legibility:2026-10-19', engine_id:'growth-legibility', for_date:'2026-10-19',
  aim:'Synthetic aim for the stand-in', objectives:[{ key:'activated', label:'Activated builders', target:75, unit:'builders', window:'campaign', timezone:'UTC', latest:null, availability:'unreported' }],
  next_action:{ proposal_id:null, instruction:'Propose your best move on the widest gap.', why:'Nothing is proposed yet.', close_condition:null },
  decisions_since:[], constraints:{ walls:'Nothing sends, posts, spends, deletes or changes a permission without a decision from Krish whose payload_sha256 matches what you are about to do.', spend_cap_usd:0, max_actions:5 },
};

export async function standIn(t, options = {}) {
  const {
    persist = true, badAck = false, dropAfterPersist = false, wrongCapability = false, beforePost = null, extraReceipt = false,
    hideReadbacks = 0, conflictWith = null, inactive = false, unauthorized = [], directive = DIRECTIVE, directiveStatus = 200, decisions = [],
    // { <contact id>: record } served as Control Center's reader would, or (ids) => a whole answer body; null serves no route.
    priorOutreach = null, priorOutreachStatus = 200,
    // Serve the Draft press (1.12.0, features.draft_press). `capabilities` may reshape the answer, to serve less.
    draftPress = false, capabilities = cap => cap,
  } = options;
  const reports = new Map(), attempts = new Map(), log = [], priorOutreachReads = [];
  const capabilitiesBody = () => {
    const served = draftPress ? { schema_version:'1.12.0', schema_versions:[...CC_VERSIONS] }
      : priorOutreach ? { schema_version:'1.11.0', schema_versions:['1.0.0','1.1.0','1.2.0','1.11.0'] } : { schema_version:'1.2.0', schema_versions:['1.0.0','1.1.0','1.2.0'] };
    return { ...served, engine_id:'growth-legibility', product_slug:wrongCapability ? 'other' : 'legibility', idempotency:true, activation:{ state:'active', activated_on:'2026-10-18' },
      features:{ directive:true, ...(priorOutreach ? { prior_outreach:true } : {}), ...(draftPress ? { draft_press:true } : {}) } };
  };
  let posts = 0, hidden = 0;
  if (conflictWith) reports.set(conflictWith.run_id, conflictWith);
  const server = createServer(async (req, res) => {
    let body = ''; for await (const chunk of req) body += chunk;
    const url = new URL(req.url, 'http://127.0.0.1');
    const route = url.pathname.startsWith(PREFIX) ? url.pathname.slice(PREFIX.length) : null;
    log.push({ method:req.method, route, headers:{ ...req.headers }, body });
    const send = (status, value) => { res.statusCode = status; res.setHeader('content-type', 'application/json'); res.end(JSON.stringify(value)); };
    const area = route?.split('/')[1]?.split('?')[0];
    if (req.headers.authorization !== `Bearer ${TOKEN}` || unauthorized.includes(area) || unauthorized.includes('all')) return send(401, { error:'unauthorized' });
    if (route === '/capabilities') {
      return send(200, capabilities(capabilitiesBody()));
    }
    if (route === '/prior-outreach' && req.method === 'GET') {
      if (!priorOutreach) return send(404, { ok:false, error:'prior_outreach_not_supported' });
      // As Control Center parses it: 1 to 50 distinct lowercase uuids, comma separated, or 400 and nothing read.
      const ids = (url.searchParams.get('contacts') ?? '').split(',');
      if (url.searchParams.getAll('contacts').length !== 1 || ids.length > 50 || ids.some(id => !CONTACT_IDS.test(id)) || new Set(ids).size !== ids.length) return send(400, { ok:false, error:'contacts' });
      priorOutreachReads.push(ids);
      if (priorOutreachStatus !== 200) return send(priorOutreachStatus, { ok:false, error:'unavailable' });
      if (typeof priorOutreach === 'function') return send(200, priorOutreach(ids));
      return send(200, { ok:true, schema_version:'1.11.0', read_at:'2026-10-19T05:10:30.000Z', prior_outreach:Object.fromEntries(ids.map(id => [id, priorOutreach[id] ?? UNKNOWN_RECORD])) });
    }
    if (route === '/directive' && req.method === 'GET') return directiveStatus === 200 ? send(200, { ok:true, chosen_by:'rule', directive }) : send(directiveStatus, { error:'unavailable' });
    if (route === '/decisions' && req.method === 'GET') return send(200, { ok:true, decisions });
    if (route === '/attempts' && req.method === 'POST') {
      const a = JSON.parse(body); const old = attempts.get(a.attempt_id);
      if (old && old.status !== 'started') return JSON.stringify(old) === JSON.stringify(a) ? send(200, { ok:true, attempt:a, replayed:true }) : send(409, { error:'attempt_conflict' });
      attempts.set(a.attempt_id, a); return send(200, { ok:true, attempt:a });
    }
    if (route?.startsWith('/attempts/') && req.method === 'GET') {
      const a = attempts.get(decodeURIComponent(route.slice('/attempts/'.length))); return a ? send(200, { ok:true, attempt:a }) : send(404, { error:'not_found' });
    }
    if (route?.startsWith('/reports/') && req.method === 'GET') {
      const id = decodeURIComponent(route.slice('/reports/'.length)); const r = reports.get(id);
      if (!r || hidden++ < hideReadbacks) return send(404, { error:'not_found' });
      return send(200, { accepted:true, run_id:r.run_id, payload_sha256:r.payload_sha256, mode:r.mode, accepted_at:'2026-10-19T05:11:00Z', report:r, ...(extraReceipt ? { private_debug:'SYNTHETIC-RECEIPT-CANARY' } : {}) });
    }
    if (route === '/reports' && req.method === 'POST') {
      posts++; if (beforePost) await beforePost();
      let r; try { r = JSON.parse(body); validateEngineEnvelope(r); } catch { return send(400, { error:'invalid_report' }); }
      if (schemaErrors(r, REPORT_SCHEMA).length) return send(400, { error:'schema' });
      // As Control Center: a version it does not take, or a proposal its parser refuses, is a 400 and nothing is stored.
      const cap = capabilities(capabilitiesBody());
      if (!(Array.isArray(cap.schema_versions) ? cap.schema_versions : [cap.schema_version]).includes(r.schema_version)) return send(400, { error:'schema_version' });
      if (r.proposals.some(p => ccProposalRefusal(p, r.schema_version))) return send(400, { error:'proposal' });
      if (req.headers['idempotency-key'] !== r.run_id) return send(400, { error:'idempotency_key_mismatch' });
      if (r.engine_id !== 'growth-legibility' || r.product_slug !== 'legibility') return send(403, { error:'wrong_engine' });
      if (inactive && r.mode === 'live') return send(409, { error:'engine_inactive' });
      const old = reports.get(r.run_id);
      if (old && old.payload_sha256 !== r.payload_sha256) return send(409, { error:'conflict' });
      if (persist) reports.set(r.run_id, r);
      if (dropAfterPersist) { req.socket.destroy(); return; }
      return send(200, { accepted:true, run_id:r.run_id, payload_sha256:badAck ? 'wrong' : r.payload_sha256, replayed:Boolean(old) });
    }
    return send(404, { error:'no_route' });
  });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  t.after(() => new Promise(resolve => server.close(resolve)));
  return { base:`http://127.0.0.1:${server.address().port}`, testMode:true, token:TOKEN, posts:() => posts, reports, attempts, log, priorOutreachReads };
}
