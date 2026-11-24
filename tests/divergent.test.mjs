import test from 'node:test';
import assert from 'node:assert/strict';
import { run, parseArgs, bodyOf, namespaceOf, flaggedCount, failureReason } from '../scripts/divergent.mjs';
import { controlCenter } from '../src/transport.mjs';

// A stand-in Control Center: synthetic only, nothing leaves this process.
function stub({ features = { divergent:true }, activation = 'active', answer = { ok:true, results:[{ status:'accepted' }] }, status = 200 } = {}) {
  const sent = [];
  const makeClient = () => ({
    capabilities: async () => ({ activation, features }),
    divergent: async body => { sent.push(body); if (status !== 200) { const e = new Error('divergent_refused'); e.status = status; e.answer = 'daily_quick_cap_reached'; throw e; } return answer; },
  });
  return { sent, makeClient };
}
const io = () => { const o = { out:'', err:'' }; return { o, out:s => { o.out += s; }, err:s => { o.err += s; } }; };
const env = { CONTROL_CENTER_ENGINE_TOKEN:'synthetic' };
const read = async () => '["opener one", "opener two"]';

test('the namespace is this engine\'s slug, or slug:lane', () => {
  assert.equal(namespaceOf(), 'growth-legibility');
  assert.equal(namespaceOf('openers'), 'growth-legibility:openers');
  assert.throws(() => parseArgs(['map', '--problem', 'p', '--lane', 'Bad Lane']));
});

test('score is free with obvious answers and exits 1 when it flags an idea', async () => {
  const s = stub({ answer:{ ok:true, results:[{ status:'accepted' }, { status:'too_close_to_consensus' }] } });
  const { o, out, err } = io();
  const code = await run(['score', '--problem', 'p', '--ideas-file', 'a', '--obvious-file', 'b'], { env, makeClient:s.makeClient, read, out, err });
  assert.equal(code, 1);
  assert.equal(s.sent[0].op, 'score');
  assert.deepEqual(s.sent[0].obvious, ['opener one', 'opener two']);
  assert.equal(s.sent[0].namespace, 'growth-legibility');
  assert.match(o.err, /flagged 1 idea/);
});

test('nothing is asked when the route is not served, the bearer is missing, or the engine is held for a paid op', async () => {
  for (const [opts, args, environment] of [
    [{ features:{ divergent:false } }, ['record', '--items-file', 'x'], env],
    [{}, ['map', '--problem', 'p'], {}],
    [{ activation:'held' }, ['provoke', '--problem', 'p'], env],
  ]) {
    const s = stub(opts);
    const { out, err } = io();
    const code = await run(args, { env:environment, makeClient:environment.CONTROL_CENTER_ENGINE_TOKEN ? s.makeClient : () => { throw new Error('no bearer'); }, read, out, err });
    assert.equal(code, 2);
    assert.equal(s.sent.length, 0);
  }
});

test('a held engine may still score and record: they ask no model', async () => {
  const s = stub({ activation:'held' });
  const { out, err } = io();
  assert.equal(await run(['record', '--items-file', 'x', '--label', 'shipped'], { env, makeClient:s.makeClient, read, out, err }), 0);
  assert.equal(s.sent[0].op, 'record');
});

test('a cap is final: exit 2, the code named, nothing retried', async () => {
  const s = stub({ status:429 });
  const { o, out, err } = io();
  assert.equal(await run(['map', '--problem', 'p'], { env, makeClient:s.makeClient, read, out, err }), 2);
  assert.equal(s.sent.length, 1);
  assert.match(o.err, /daily cap was reached \(daily_quick_cap_reached\)/);
  assert.match(failureReason({ status:503 }), /not available/);
});

test('the transport posts to this engine\'s divergent route and surfaces a refusal by status and code', async () => {
  const calls = [];
  const fetcher = async (url, init) => {
    calls.push({ url, init });
    if (url.endsWith('/divergent') && JSON.parse(init.body).op === 'map') return new Response(JSON.stringify({ ok:false, error:'daily_quick_cap_reached' }), { status:429 });
    return new Response(JSON.stringify({ ok:true, results:[] }), { status:200 });
  };
  const cc = controlCenter({ token:'synthetic', fetcher });
  assert.deepEqual(await cc.divergent({ op:'score', problem:'p', ideas:['a'] }), { ok:true, results:[] });
  assert.equal(calls[0].url, 'https://controlcenter.krishraja.com/api/growth/engines/legibility/divergent');
  assert.equal(calls[0].init.method, 'POST');
  await assert.rejects(cc.divergent({ op:'map', problem:'p' }), e => e.status === 429 && e.answer === 'daily_quick_cap_reached');
  assert.equal(flaggedCount({ results:[{ status:'repeat' }] }), 1);
});

test('the body carries the puffery kill list and nothing else banned', async () => {
  const b = await bodyOf('provoke', parseArgs(['provoke', '--problem', 'p', '--cliche', 'a launch post']).o, read);
  assert.ok(b.bannedWords.includes('revolutionary'));
  assert.deepEqual(b.cliches, ['a launch post']);
});
