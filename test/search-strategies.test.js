const test = require('node:test');
const assert = require('node:assert/strict');
const { mergeWeighted } = require('../src/retrieval/search-strategies');

test('mergeWeighted merges by id and sorts by score', () => {
  const a = [ { id: 1, score: 0.9 }, { id: 2, score: 0.7 } ];
  const b = [ { id: 2, score: 0.8 }, { id: 3, score: 0.6 } ];
  const m = mergeWeighted(a, b, 0.5);
  assert.equal(m.length, 3);
  // Should contain ids 1,2,3
  assert.deepEqual(m.map(x=>x.id).sort(), [1,2,3]);
  // id 2 has combined score from both lists, should rank first
  assert.equal(m[0].id, 2);
});
