import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { PLAIN_SHA256, PLAIN_SYSTEM, HUMOUR_DAILY_CAP, analysisSchema, findings, guard, humourCall, namespaceOf, sha256 } from '../src/lib/humour.mjs';
import { parseArgs, run } from '../scripts/humour.mjs';
import { controlCenter } from '../src/transport.mjs';

// A stand-in Control Center: synthetic only, nothing leaves this process.
const served = { activation: 'active', features: { humour: true } };
const client = (payload, capabilities = served) => ({ calls: [], async humour(c) { this.calls.push(c); return { ok: true, payload }; }, async capabilities() { return capabilities; } });
const quiet = { out: () => {}, err: () => {}, read: async () => 'A synthetic joke.' };
const joke = { comic_reading: 'supported', humour_attempt: { status: 'reported' } };

// The hash Control Center accepts for comprehension-v1:plain (control-center api/_humour.ts HUMOUR_PROMPTS at dcf1919),
// written out here so a changed prompt fails this test rather than reaching Control Center and being refused.
const PUBLISHED_PLAIN = '782385f3d32678cfec7a9609d6f7d07d1dc869c88501ec5e1b15e3d212904bd3';
// growth-mindmake's references/humour/submit-analysis.schema.json at bcfb76b, which this copy must match byte for byte.
const MINDMAKE_SCHEMA = '31ceba5bb10b71f3677ac77a199f2385650df3804c03a142ebdbdf99e15810aa';

test('the prompt is the published comprehension-v1:plain, and the tool is submit_analysis', () => {
  assert.equal(PLAIN_SHA256, PUBLISHED_PLAIN);
  assert.equal(sha256(PLAIN_SYSTEM), PUBLISHED_PLAIN);
  const bytes = readFileSync(new URL('../references/humour/submit-analysis.schema.json', import.meta.url));
  assert.equal(sha256(bytes), MINDMAKE_SCHEMA);
  const call = humourCall(['A synthetic opening line.'], 'invitation');
  assert.equal(call.system, PLAIN_SYSTEM);
  assert.equal(call.tool.name, 'submit_analysis');
  assert.deepEqual(analysisSchema().required, ['comic_reading', 'humour_attempt']);
  assert.ok(JSON.stringify(call.tool.input_schema).length < 30000);
  assert.ok(!call.user.includes('<b>'));
});

test('the call carries exactly what Control Center\'s strict schema takes: no namespace is sent', () => {
  assert.deepEqual(Object.keys(humourCall(['x'])).sort(), ['max_output_tokens', 'system', 'tool', 'user']);
  assert.ok(!JSON.stringify(humourCall(['x'])).includes('growth-legibility'));
  assert.equal(namespaceOf(), 'growth-legibility');
  assert.equal(namespaceOf('copy'), 'growth-legibility:copy');
});

test('a joke on Legibility is flagged, a forced one noted, a plain line passes', async () => {
  assert.equal(findings(joke).rules.length, 1);
  assert.match(findings(joke).rules[0], /^legibility_humour:/);
  assert.equal(findings({ comic_reading: 'not_supported', humour_attempt: { status: 'supported_inference' } }).notes.length, 1);
  const plain = await guard(['A synthetic line.'], { cc: client({ comic_reading: 'not_supported', humour_attempt: { status: 'none' } }), capabilities: served, lane: 'copy' });
  assert.equal(plain.status, 'pass');
  assert.equal(plain.namespace, 'growth-legibility:copy');
  assert.ok(!JSON.stringify(plain).includes('synthetic line'));
  const flagged = await guard(['A synthetic joke.'], { cc: client(joke), capabilities: served });
  assert.equal(flagged.status, 'flagged');
  assert.equal(flagged.namespace, 'growth-legibility');
});

test('unserved, held, paused, capped, empty or unanswered is unavailable, never a pass, and no call is made where none may be', async () => {
  const cc = client({ comic_reading: 'not_supported' });
  assert.equal((await guard(['x'], { cc, capabilities: { activation: 'active', features: {} } })).status, 'unavailable');
  assert.equal((await guard(['x'], { cc, capabilities: { activation: 'held', features: { humour: true } } })).status, 'unavailable');
  assert.equal((await guard(['x'], { cc, capabilities: { activation: 'paused', features: { humour: true } } })).status, 'unavailable');
  assert.equal((await guard(['  '], { cc, capabilities: served })).status, 'unavailable');
  assert.equal((await guard(['x'], { cc, capabilities: served, lane: 'Not A Lane' })).status, 'unavailable');
  assert.equal(cc.calls.length, 0);
  const capped = { async humour() { throw Object.assign(new Error('humour_refused'), { status: 429, answer: 'daily_humour_cap_reached' }); } };
  const r = await guard(['x'], { cc: capped, capabilities: served });
  assert.equal(r.status, 'unavailable');
  assert.match(r.reason, new RegExp(`cap of ${HUMOUR_DAILY_CAP}`));
  assert.match(r.reason, /daily_humour_cap_reached/);
  assert.equal((await guard(['x'], { cc: client({}), capabilities: served })).status, 'unavailable');
});

test('the CLI exits 2 with no bearer, not served or held, and 1 when flagged', async () => {
  assert.equal(parseArgs([]), null);
  assert.equal(parseArgs(['--file', 'x', '--lane', 'Bad Lane']), null);
  assert.deepEqual(parseArgs(['--file', 'x', '--surface', 'post', '--lane', 'copy']), { file: 'x', surface: 'post', lane: 'copy' });
  assert.equal(await run(['--file', 'x'], { ...quiet, env: {}, makeClient: () => { throw new Error('no bearer'); } }), 2);
  const unserved = client(joke, { activation: 'active', features: { humour: false } });
  assert.equal(await run(['--file', 'x'], { ...quiet, env: {}, makeClient: () => unserved }), 2);
  assert.equal(unserved.calls.length, 0);
  const held = client(joke, { activation: 'held', features: { humour: true } });
  assert.equal(await run(['--file', 'x'], { ...quiet, env: {}, makeClient: () => held }), 2);
  assert.equal(held.calls.length, 0);
  assert.equal(await run(['--file', 'x', '--surface', 'invitation'], { ...quiet, env: {}, makeClient: () => client(joke) }), 1);
  let printed = '';
  assert.equal(await run(['--file', 'x', '--lane', 'copy'], { ...quiet, out: s => { printed += s; }, env: {}, makeClient: () => client({ comic_reading: 'not_supported', humour_attempt: { status: 'none' } }) }), 0);
  assert.equal(JSON.parse(printed).namespace, 'growth-legibility:copy');
  assert.ok(!printed.includes('synthetic joke'));
});

test('the transport posts to this engine\'s humour route and surfaces a refusal by status and code', async () => {
  const calls = [];
  let status = 200;
  const fetcher = async (url, init) => {
    calls.push({ url, init });
    if (status === 429) return new Response(JSON.stringify({ ok: false, error: 'daily_humour_cap_reached', cap: 200, used: 200 }), { status: 429 });
    if (status === 404) return new Response(JSON.stringify({ ok: false, error: 'not_found' }), { status: 404 });
    return new Response(JSON.stringify({ ok: true, payload: { comic_reading: 'not_supported' }, cap: 200, used: 1 }), { status: 200 });
  };
  const cc = controlCenter({ token: 'synthetic', fetcher });
  const call = humourCall(['A synthetic line.']);
  assert.equal((await cc.humour(call)).payload.comic_reading, 'not_supported');
  assert.equal(calls[0].url, 'https://controlcenter.krishraja.com/api/growth/engines/legibility/humour');
  assert.equal(calls[0].init.method, 'POST');
  assert.deepEqual(JSON.parse(calls[0].init.body), call);
  status = 429;
  await assert.rejects(cc.humour(call), e => e.code === 'humour_refused' && e.status === 429 && e.answer === 'daily_humour_cap_reached');
  status = 404;
  await assert.rejects(cc.humour(call), e => e.code === 'humour_not_supported' && e.status === 404);
  assert.equal(calls.length, 3);
});
