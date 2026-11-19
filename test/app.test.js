import test from 'node:test';
import assert from 'node:assert/strict';
import app from '../server.js';
import { validateItems } from '../model.js';

const source = 'Active recall asks learners to retrieve information from memory before seeing an answer. This effort strengthens later remembering. Progressive support offers small amounts of help when a learner needs it, allowing the learner to complete an attempt.';

test('rejects review items with invented source excerpts', () => {
  assert.throws(() => validateItems({ items: [{ question: 'What is active recall?', answer: 'Remembering', excerpt: 'This is not in the source.' }] }, source), /No source-grounded/);
});

test('generates grounded items and accepts a meaning-based assessment response', async () => {
  const originalFetch = globalThis.fetch;
  const oldKey = process.env.OPENAI_API_KEY;
  process.env.OPENAI_API_KEY = 'test-key';
  const calls = [];
  globalThis.fetch = async (_url, options) => {
    const body = JSON.parse(options.body); calls.push(body);
    const value = calls.length === 1
      ? { items: [{ question: 'What does active recall ask a learner to do?', answer: 'Retrieve information from memory before seeing an answer.', excerpt: 'Active recall asks learners to retrieve information from memory before seeing an answer.' }] }
      : { verdict: 'correct', feedback: 'Yes, you brought the idea to mind.' };
    return new Response(JSON.stringify({ status: 'completed', output: [{ content: [{ type: 'output_text', text: JSON.stringify(value) }] }] }), { status: 200 });
  };
  const server = app.listen(0);
  try {
    const base = `http://127.0.0.1:${server.address().port}`;
    const request = (path, body) => originalFetch(base + path, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const itemsResponse = await request('/api/items', { source });
    assert.equal(itemsResponse.status, 200);
    const { items } = await itemsResponse.json();
    assert.equal(items.length, 1);
    const assessResponse = await request('/api/assess', { item: items[0], answer: 'Recall it before the answer is shown', history: [] });
    assert.deepEqual(await assessResponse.json(), { verdict: 'correct', feedback: 'Yes, you brought the idea to mind.' });
    assert.equal(calls[0].store, false);
    assert.equal(calls[1].store, false);
    assert.equal((await request('/api/items', { source: 'too short' })).status, 400);
  } finally {
    await new Promise(resolve => server.close(resolve));
    globalThis.fetch = originalFetch;
    if (oldKey === undefined) delete process.env.OPENAI_API_KEY;
    else process.env.OPENAI_API_KEY = oldKey;
  }
});
