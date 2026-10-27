// A local, in-process stand-in for the Control Center growth engine routes (the engine sends protocol 1.0.0; with
// `priorOutreach` set it serves 1.11.0 and its prior-outreach read). Synthetic only: it listens on 127.0.0.1 and never
// reaches a live service.
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
    if (schema.pattern && !new RegExp(schema.pattern, 'u').test(value)) errors.push(`${path}: pattern`);
    if (schema.format === 'date-time' && !Number.isFinite(Date.parse(value))) errors.push(`${path}: date-time`);
  }
  if (typeof value === 'number' && schema.minimum !== undefined && value < schema.minimum) errors.push(`${path}: minimum`);
  if (Array.isArray(value)) {
    if (schema.maxItems !== undefined && value.length > schema.maxItems) errors.push(`${path}: maxItems`);
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
  } = options;
  const reports = new Map(), attempts = new Map(), log = [], priorOutreachReads = [];
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
      const served = priorOutreach ? { schema_version:'1.11.0', schema_versions:['1.0.0','1.1.0','1.2.0','1.11.0'] } : { schema_version:'1.2.0', schema_versions:['1.0.0','1.1.0','1.2.0'] };
      return send(200, { ...served, engine_id:'growth-legibility', product_slug:wrongCapability ? 'other' : 'legibility', idempotency:true, activation:{ state:'active', activated_on:'2026-10-18' }, features:{ directive:true, ...(priorOutreach ? { prior_outreach:true } : {}) } });
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
