import { test } from 'node:test';
import assert from 'node:assert/strict';
import { answersLine, answersStep, configured, readAiAnswers } from '../src/ai-answers.mjs';

// Protocol 1.22.0 (Ruling, Krish, 2026-11-12): AEO-Engine is the one AI-answers specialist every venture's engine calls.
// Every question and host here is invented.

const served = (standing, features = true) => ({ features: { engine_state: true, krish_instruction: true, ...(features ? { ai_answers: true } : {}) }, ...(standing === undefined ? {} : { ai_answers: { standing, rule: 'r' } }) });
const file = { questions: ['How do I know which AI answers about my product are right?'], domains: ['legibility.example'] };

test('the committed file names legibility.io and holds no invented question', () => {
  const f = configured();
  assert.deepEqual(f.domains, ['legibility.io']);
  assert.ok(f.questions.every(q => !q.includes('@')));
});

test('the standing reads loosely and says the tile\'s words', () => {
  assert.equal(readAiAnswers({}), null);
  assert.equal(answersLine(null), 'AI answers: not tracked yet.');
  assert.equal(answersLine({ latest: { as_of: '2026-11-22', asked: 3, cited_first: 1 } }), 'AI answers: cited first on 1 of 3 questions, 22 Nov.');
});

test('it asks AEO once with no request on file, and never while held, with a request on file, or unserved', async () => {
  const posted = [];
  const client = { async answers(body) { posted.push(body); return { ok: true, request_id: 'r', questions: body.questions.length }; } };
  const lines = await answersStep({ client, directive: served(null), held: false, file });
  assert.deepEqual(posted, [{ questions: file.questions, domains: file.domains }]);
  assert.match(lines[1], /^Asked AEO-Engine to track 1 buyer question/);
  await answersStep({ client, directive: served(null), held: true, file });
  await answersStep({ client, directive: served({ request: { state: 'open', questions: 1 } }), held: false, file });
  assert.deepEqual(await answersStep({ client, directive: served(undefined, false), held: false, file }), []);
  assert.equal(posted.length, 1);
  const none = await answersStep({ client, directive: served(null), held: false, file: { questions: [], domains: [] } });
  assert.match(none.at(-1), /No buyer question is on file/);
  const failing = { async answers() { throw new Error('down'); } };
  assert.match((await answersStep({ client: failing, directive: served(null), held: false, file })).at(-1), /^Could not ask AEO-Engine/);
});
