const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs-extra');
const path = require('path');
const { loadEmbedding, saveEmbedding } = require('../src/retrieval/embedding-cache');

test('embedding cache save and load', async () => {
  // Use a unique term to avoid collisions
  const term = `test-term-${Date.now()}`;
  const params = { provider: 'hash', size: 16, term };
  const vec = Array(16).fill(0).map((_,i)=> (i%3===0?1:0));
  await saveEmbedding(params, vec);
  const loaded = await loadEmbedding(params);
  assert.ok(Array.isArray(loaded));
  assert.equal(loaded.length, 16);
  assert.equal(loaded.filter(v=>v===1).length, vec.filter(v=>v===1).length);
});
